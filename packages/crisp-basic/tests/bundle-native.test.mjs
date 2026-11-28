import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {chmod, mkdir, mkdtemp, readFile, rename, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createNativeSession} from '../index.mjs';
import {bundle as createBundle} from '../src/bundle.mjs';
const bundle = (source, options) => createBundle(source, {...options, profile: 'headless'});
import {corpus} from './wasm-corpus.mjs';
import {executable, target, runner, nativeOptions, nativeCliArgs} from './native-test-target.mjs';

function execute(path, args = [], input = '', cwd) {
    return spawnSync(runner?.executable ?? path, runner ? [...(runner.args ?? []), path, ...args] : args,
        {input: Buffer.from(input, 'latin1'), timeout: 10000, cwd,
            env: runner ? process.env : {...process.env, PATH: ''}});
}

const fixtures = [...corpus, {
    name: 'EVAL remains an interpreter feature in bundles',
    source: 'x%=21\nPRINT STR$(EVAL("x%*2"))\nEND\n', text: '42\r\n'
}];

test('source CLI and native bundle use the caller directory for exact binary file I/O', async t => {
    const directory = await mkdtemp(join(tmpdir(), 'crispbasic-bundle-cwd-'));
    t.after(() => rm(directory, {recursive: true, force: true}));
    const filename = join(directory, 'files.bas');
    const source = `f%=OPENIN("input.bin")
WHILE NOT EOF#f%
VDU BGET#f%
ENDWHILE
CLOSE#f%
f%=OPENOUT("created.bin")
BPUT#f%,0
BPUT#f%,255
CLOSE#f%
END
`;
    await writeFile(filename, source);
    const artifact = await bundle(source, {filename, target: target.name, runtime: executable, output: join(directory, 'files')});
    for (const [name, contents] of [['a', [0, 1, 13, 10, 200, 255]], ['b', [34, 128, 0, 255]]]) {
        const cwd = join(directory, name);
        await mkdir(cwd);
        await writeFile(join(cwd, 'input.bin'), Buffer.from(contents));
        const direct = spawnSync(process.execPath,
            [fileURLToPath(new URL('../bin/crispbasic.mjs', import.meta.url)), ...nativeCliArgs([filename])],
            {cwd, input: '', timeout: 10000});
        assert.equal(direct.status, 0, direct.stderr?.toString());
        const directFile = await readFile(join(cwd, 'created.bin'));
        const packed = execute(artifact.path, [], '', cwd);
        assert.equal(packed.status, 0, packed.stderr?.toString());
        assert.deepEqual(packed.stdout, direct.stdout);
        assert.deepEqual(packed.stdout, Buffer.from(contents));
        assert.deepEqual(await readFile(join(cwd, 'created.bin')), directFile);
        assert.deepEqual(directFile, Buffer.from([0, 255]));
    }
});

for (const fixture of fixtures) {
    test(`native bundle byte parity: ${fixture.name}`, async t => {
        const directory = await mkdtemp(join(tmpdir(), 'crisp-bundle-native-'));
        t.after(() => rm(directory, {recursive: true, force: true}));
        const session = createNativeSession(nativeOptions());
        t.after(() => session.dispose());
        const direct = await session.run(fixture.source, {filename: 'program.bas', input: fixture.input ?? ''});
        assert.equal(direct.status, 'completed', JSON.stringify(direct.error));
        const artifact = await bundle(fixture.source, {filename: 'program.bas', target: target.name,
            runtime: executable, output: join(directory, 'original')});
        const moved = join(directory, 'renamed executable');
        await rename(artifact.path, moved);
        const result = execute(moved, [], fixture.input ?? '');
        assert.ifError(result.error);
        assert.equal(result.status, direct.exitCode, result.stderr.toString());
        assert.deepEqual(result.stdout, Buffer.from(direct.output));
        assert.deepEqual(result.stdout, Buffer.from(fixture.bytes ?? Buffer.from(fixture.text, 'latin1')));
        const info = execute(moved, ['--bundle-info']);
        assert.equal(info.status, 0, info.stderr.toString());
        assert.equal(JSON.parse(info.stdout).target, target.name);
    });
}

test('bundled runtime reports malformed overlay and runtime errors separately from stdout', async t => {
    const directory = await mkdtemp(join(tmpdir(), 'crisp-bundle-errors-'));
    t.after(() => rm(directory, {recursive: true, force: true}));
    const artifact = await bundle('10 PRINT "before"\n200 ERROR 100,"deliberate"', {
        target: target.name, runtime: executable, output: join(directory, 'error')});
    const result = execute(artifact.path);
    assert.equal(result.status, 1);
    assert.equal(result.stdout.toString(), 'before\r\n');
    assert.match(result.stderr.toString(), /line 200: deliberate/);
    const corrupt = await readFile(artifact.path);
    corrupt.writeUInt32LE(0xffffffff, corrupt.length - 24);
    await writeFile(artifact.path, corrupt); await chmod(artifact.path, 0o755);
    const rejected = execute(artifact.path);
    assert.equal(rejected.status, 1);
    assert.equal(rejected.stdout.length, 0);
    assert.match(rejected.stderr.toString(), /invalid embedded program/);
});
