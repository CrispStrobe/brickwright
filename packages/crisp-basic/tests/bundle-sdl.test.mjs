import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundleSDL, validateSDLAssetPath} from '../src/bundle-sdl.mjs';
import {prepareSource} from '../src/source.mjs';
import {hostNativeTarget} from '../scripts/native-targets.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = process.env.CRISP_BASIC_TEST_NATIVE_TARGET || hostNativeTarget();
const runtimePack = resolve(process.env.CRISP_BASIC_SDL_RUNTIME_PACK || join(root, '.build/sdl/native', target, 'runtime'));
assert.ok(existsSync(join(runtimePack, 'runtime.json')),
    'Full SDL runtime pack missing at ' + runtimePack + '; run npm run build:sdl:native or set CRISP_BASIC_SDL_RUNTIME_PACK');
const runner = process.env.CRISP_BASIC_TEST_NATIVE_RUNNER ? JSON.parse(process.env.CRISP_BASIC_TEST_NATIVE_RUNNER) : undefined;
const env = {...process.env, SDL_VIDEODRIVER: process.env.SDL_VIDEODRIVER || 'offscreen',
    SDL_RENDER_DRIVER: process.env.SDL_RENDER_DRIVER || 'software',
    SDL_AUDIODRIVER: process.env.SDL_AUDIODRIVER || 'dummy', CRISP_BASIC_VDU_STDOUT: '1', CRISP_BASIC_BATCH: '1'};
function run(binary, args, options) {
    const runnerEnv = runner ? {CRISP_BASIC_SDL_RUNNER_EXE: runner.executable,
        CRISP_BASIC_SDL_RUNNER_ARGC: String((runner.args || []).length),
        ...Object.fromEntries((runner.args || []).map((arg, i) => ['CRISP_BASIC_SDL_RUNNER_ARG_' + i, arg]))} : {};
    const result = spawnSync(runner?.executable || binary, runner ? [...(runner.args || []), binary, ...args] : args, {
        timeout: 60000, maxBuffer: 4 << 20, ...options, env: {...(options?.env || process.env), ...runnerEnv}
    });
    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.signal, null, `SDL process signal: ${result.signal}; stderr: ${result.stderr}`);
    return result;
}
async function fixture(t) {
    const directory = await mkdtemp(join(resolve(tmpdir()), 'sdl-bundle-test-'));
    t.after(() => rm(directory, {recursive: true, force: true}));
    await mkdir(join(directory, 'caller')); await mkdir(join(directory, 'extract')); return directory;
}
test('SDL asset paths reject traversal, absolute paths, controls and empty segments', () => {
    for (const value of ['../a', '/a', 'a/../b', 'a//b', './a', 'a/', 'a\\b', 'a\0b', 'a\nb', ''])
        assert.throws(() => validateSDLAssetPath(value), /relative file paths/);
    assert.equal(validateSDLAssetPath('images/my image.png'), 'images/my image.png');
});
const corpus = [
    {name: 'graphics draw and pixel readback', source: 'MODE 8\nGCOL 0,1\nPLOT 69,100,100\nPRINT "PIXEL=";POINT(100,100)\nEND', expected: /PIXEL=1\r\n/},
    {name: 'sound and envelope through real SDL audio queue', source: 'ENVELOPE 1,1,0,0,0,0,0,0,126,0,0,-126,126,126\nSOUND 1,1,100,1\nWAIT 10\nPRINT "AUDIO=";ADVAL(-6)\nEND', expected: /AUDIO=16\r\n/},
    {name: 'EVAL raw memory and native SDL system call', source: 'DIM memory% 16\nmemory%?3=81\nPRINT EVAL("6*7");memory%?3\nSYS "SDL_GetTicks" TO ticks%\nPRINT ticks%>=0;LEN(TIME$)>0\nEND', expected: /4281\r\n/},
    {name: 'ON ERROR trap keeps batch lifetime', source: 'ON ERROR PRINT "CAUGHT=";ERR:END\nERROR 123,"expected"', expected: /CAUGHT=123\r\n/},
    {name: 'interactive-state APIs and VDU bytes', source: 'MOUSE x%,y%,b%\nPRINT "MOUSE=";b%\nVDU 65,0,255,13,10\nEND', expected: /MOUSE=0\r\n/},
    {name: 'relative external file write and read', source: 'f%=OPENOUT("caller-data.bin")\nBPUT#f%,81\nCLOSE#f%\nf%=OPENIN("caller-data.bin")\nPRINT BGET#f%\nCLOSE#f%\nEND', expected: /81\r\n/},
    {name: 'QUIT preserves exit code', source: 'PRINT "EXIT"\nQUIT 7', expected: /EXIT\r\n/, status: 7}
];
const machineCode = {
    'linux-x64': 'mov eax,42\nret',
    'linux-armv7': 'mov r0,#42\nbx lr',
    'linux-arm64': 'mov w0,#42\nret'
}[target];
corpus.push({name: target + ' inline assembly and USR execution',
    source: 'DIM machine% 64\nmachine%=(machine%+3)AND-4\nP%=machine%\n[OPT 2\n' + machineCode + '\n]\nPRINT USR machine%\nEND', expected: /42\r\n/});
for (const entry of corpus) test('full SDL source/bundle bytes: ' + entry.name, async t => {
    const directory = await fixture(t), filename = join(directory, 'main.bas'), output = join(directory, 'relocated-app');
    await writeFile(filename, prepareSource(entry.source).numberedSource, 'latin1');
    const bundled = await bundleSDL(entry.source, {filename, output, target, runtimePack});
    const processEnv = {...env, TMPDIR: join(directory, 'extract')};
    const direct = run(join(runtimePack, 'bbcsdl'), [filename], {
        cwd: join(directory, 'caller'), env: {...processEnv, CRISP_BASIC_SOURCE: filename, CRISP_BASIC_CWD: join(directory, 'caller'), LD_LIBRARY_PATH: runtimePack}
    });
    const application = run(output, [], {cwd: join(directory, 'caller'), env: {...processEnv, PATH: runner ? process.env.PATH : ''}});
    assert.equal(direct.status, entry.status ?? 0, direct.stderr.toString());
    assert.equal(application.status, direct.status, application.stderr.toString());
    assert.deepEqual(application.stdout, direct.stdout);
    assert.match(application.stdout.toString('latin1'), entry.expected);
    assert.deepEqual(await readdir(join(directory, 'extract')), [], 'private extracted runtime is removed after exit');
    if (entry.name.includes('relative')) assert.deepEqual(await readFile(join(directory, 'caller/caller-data.bin')), Buffer.from([81]));
    const metadata = JSON.parse(run(output, ['--bundle-info'], {env: processEnv}).stdout);
    assert.equal(metadata.profile, 'bbcsdl-full-native'); assert.equal(metadata.capabilities.sound, true);
    assert.equal(metadata.capabilities.graphicsReadback, true); assert.equal(metadata.capabilities.timeout, false);
    assert.equal(metadata.sourceSha256, bundled.metadata.sourceSha256);
});
test('full SDL embeds application resources accessed through @dir$', async t => {
    const directory = await fixture(t), filename = join(directory, 'main.bas'), asset = join(directory, 'payload.bin');
    await writeFile(asset, Buffer.from([17, 42, 255]));
    const source = 'f%=OPENIN(@dir$+"data/payload.bin")\nPRINT BGET#f%;BGET#f%;BGET#f%\nCLOSE#f%\nEND';
    const {path} = await bundleSDL(source, {filename, output: join(directory, 'app'), runtimePack, target,
        assets: [{source: asset, path: 'data/payload.bin'}]});
    await rm(asset);
    const result = run(path, [], {cwd: join(directory, 'caller'), env: {...env, TMPDIR: join(directory, 'extract'), PATH: runner ? process.env.PATH : ''}});
    assert.equal(result.status, 0, result.stderr.toString()); assert.match(result.stdout.toString(), /1742255\r\n/);
    assert.deepEqual(await readdir(join(directory, 'extract')), []);
});
test('direct source runner preserves original @dir$ and matches the bundle', async t => {
    const directory = await fixture(t), filename = join(directory, 'unnumbered.bas'), asset = join(directory, 'payload.bin');
    const source = 'f%=OPENIN(@dir$+"payload.bin")\nPRINT BGET#f%\nCLOSE#f%\nf%=OPENOUT("runner-output.bin")\nBPUT#f%,88\nCLOSE#f%\nEND';
    await writeFile(filename, source); await writeFile(asset, Buffer.from([42]));
    const {path} = await bundleSDL(source, {filename, output: join(directory, 'app'), runtimePack, target,
        assets: [{source: asset, path: 'payload.bin'}]});
    const processEnv = {...env, TMPDIR: join(directory, 'extract'), CRISP_BASIC_SDL_RUNTIME_PACK: runtimePack,
        CRISP_BASIC_TARGET: target, ...(runner ? {CRISP_BASIC_SDL_RUNNER: JSON.stringify(runner)} : {})};
    const direct = spawnSync(process.execPath, [join(root, 'scripts/run-sdl-native.mjs'), filename], {
        cwd: join(directory, 'caller'), env: processEnv, timeout: 60000
    });
    assert.equal(direct.error, undefined, direct.error?.message); assert.equal(direct.status, 0, direct.stderr?.toString());
    assert.deepEqual(await readFile(join(directory, 'caller/runner-output.bin')), Buffer.from([88]));
    const application = run(path, [], {cwd: join(directory, 'caller'), env: processEnv});
    assert.equal(application.status, 0, application.stderr.toString()); assert.deepEqual(application.stdout, direct.stdout);
    assert.match(direct.stdout.toString(), /42\r\n/); assert.deepEqual(await readdir(join(directory, 'extract')), []);
});
test('full SDL packaging rejects duplicate assets and overwriting an input', async t => {
    const directory = await fixture(t), input = join(directory, 'asset.bin'); await writeFile(input, 'data');
    await assert.rejects(bundleSDL('END', {filename: join(directory, 'main.bas'), output: input, overwrite: true,
        runtimePack, target, assets: [{source: input, path: 'data.bin'}]}), /differ from source, runtime, and asset/);
    await assert.rejects(bundleSDL('END', {filename: join(directory, 'main.bas'), output: join(directory, 'app'),
        runtimePack, target, assets: [{source: input, path: 'main.bas'}]}), /Duplicate SDL archive path/);
    assert.equal(await readFile(input, 'utf8'), 'data');
});
