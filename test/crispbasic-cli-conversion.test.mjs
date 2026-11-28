import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import JSZip from 'jszip';

const root = resolve(import.meta.dirname, '..');
const cli = join(root, 'bin/bwlite.mjs');
const makecode = join(root, 'scripts/makecode.mjs');
const marker = '# @crispbasic-portable 1';
const portableBasic = `REM @bw device arduino-uno
REM @bw pin led D13 output
REM @bw pin button D2 input active-low
PROCpinMode(13,"output")
PROCpinMode(2,"input-pullup")
PROCdigitalToggle(13)
PROCdelay(25)
PRINT FNdigitalRead(2)
END
`;
const ordinary = `DEVICE ARDUINO-UNO
PIN led = D13 OUTPUT
PIN button = D2 INPUT ACTIVE LOW
WHEN flag clicked:
  toggle led
  wait 0.025 seconds
  print read button
`;
const marked = `${marker}\n${ordinary}`;
const sentinel = 'previous output must survive a refused conversion\n';

function fixture(t) {
    const directory = mkdtempSync(join(tmpdir(), 'bwlite-crispbasic-'));
    t.after(() => rmSync(directory, {recursive: true, force: true}));
    const put = (name, source) => {
        const path = join(directory, name);
        writeFileSync(path, source);
        return path;
    };
    const execute = (script, args) => spawnSync(process.execPath, [script, ...args], {
        cwd: directory, encoding: 'utf8', timeout: 15000,
        // A refused hardware route must stop before even looking for Python.
        env: {...process.env, BWLITE_PYTHON: join(directory, 'must-not-spawn-python')}
    });
    const run = (...args) => execute(cli, args);
    const runMakeCode = (...args) => execute(makecode, args);
    const refuses = (args, expected = /requires CrispBASIC mode/, name = 'output.txt') => {
        const output = put(name, sentinel);
        const result = run(...args, '--out', output);
        assert.equal(result.status, 2, result.stderr || result.error?.message);
        assert.match(result.stderr, expected);
        assert.equal(result.stdout, '', 'a refusal must not print partial generated source');
        assert.equal(readFileSync(output, 'utf8'), sentinel);
        return result;
    };
    return {directory, put, run, runMakeCode, refuses};
}

test('portable BASIC input requires an explicit mode and preserves the old output on refusal', t => {
    const f = fixture(t);
    const input = f.put('pins.bas', portableBasic);
    f.refuses(['convert', input, '--to', 'pseudocode'], /CrispBASIC|portable|simulation|cannot|unsupported|unmodelled/i, 'existing.bw');
    const legacy = f.put('legacy.bas', 'PRINT 7\nEND\n');
    const result = f.run('read', legacy);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /print 7/);
    assert.doesNotMatch(result.stdout, /@crispbasic-portable/);
});

for (const command of ['read', 'convert']) {
    test(`${command} --crispbasic produces durable source that regenerates the actual operations`, t => {
        const f = fixture(t);
        const input = f.put('pins.BAS', portableBasic);
        const output = join(f.directory, 'portable.bw');
        const result = f.run(command, input, '--crispbasic', ...(command === 'convert' ? ['--to', 'pseudocode'] : []), '--out', output);
        assert.equal(result.status, 0, result.stderr);
        const source = readFileSync(output, 'utf8');
        assert.equal((source.match(/^# @crispbasic-portable 1$/gm) || []).length, 1);
        assert.match(source, /PIN button = D2 INPUT ACTIVE LOW/);
        assert.match(source, /toggle led/);
        assert.match(source, /wait 0\.025 seconds/);
        assert.match(source, /print \(1 - \(read button\)\)/, 'electrical read keeps the active-low compensation');
        const regenerated = f.run('transpile', output, '--to', 'crispbasic');
        assert.equal(regenerated.status, 0, regenerated.stderr);
        assert.match(regenerated.stdout, /PROCdigitalToggle\(13\)/);
        assert.match(regenerated.stdout, /PROCdelay\(25\)/);
        assert.equal((regenerated.stdout.match(/FNdigitalRead/g) || []).length, 1);
        const copied = f.run('convert', output, '--to', 'pseudocode');
        assert.equal(copied.status, 0, copied.stderr);
        assert.equal(copied.stdout, source, 'save/copy does not erase the durable mode marker');
        const checked = f.run('check', output);
        assert.equal(checked.status, 0, checked.stderr);
        assert.equal(checked.stdout, 'ok\n');
    });
}

test('explicit portable output works for ordinary pseudocode and supports numbered source', t => {
    const f = fixture(t);
    const input = f.put('pins.bw', ordinary);
    const result = f.run('convert', input, '--to', 'crispbasic', '--numbered');
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^\d+ REM @bw device arduino-uno/m);
    assert.match(result.stdout, /^\d+ PROCdelay\(25\)$/m);
    assert.match(result.stdout, /^\d+ PROCdigitalToggle\(13\)$/m);
    const legacy = f.run('convert', input, '--to', 'basic');
    assert.equal(legacy.status, 0, legacy.stderr);
    assert.doesNotMatch(legacy.stdout, /PROCdigitalToggle|PROCdelay|FNdigitalRead/);
    assert.match(legacy.stdout, /REM/);
});

test('direct portable canvas source becomes editable source and regenerates VDU drawing', t => {
    const f = fixture(t);
    const input = f.put('canvas.basic', 'CLG\nGCOL 0,4\nMOVE 640,512\nDRAW 680,552\nEND\n');
    const converted = f.run('read', input, '--crispbasic');
    assert.equal(converted.status, 0, converted.stderr);
    assert.match(converted.stdout, /go to x: 0 y: 0/);
    assert.match(converted.stdout, /go to x: 10 y: 10/);
    const output = f.put('canvas.bw', converted.stdout);
    const generated = f.run('convert', output, '--to', 'crispbasic');
    assert.equal(generated.status, 0, generated.stderr);
    assert.match(generated.stdout, /CLG/);
    assert.match(generated.stdout, /DRAW/);
});

for (const target of ['sb3', 'c', 'host-c', 'python', 'javascript', 'micropython', 'basic']) {
    test(`saved portable pseudocode refuses ${target} before overwriting the destination`, t => {
        const f = fixture(t);
        const input = f.put('portable.bw', marked);
        f.refuses(['convert', input, '--to', target]);
    });
}

test('explicit BASIC reading cannot be combined with an unqualified target', t => {
    const f = fixture(t);
    const input = f.put('pins.bas', portableBasic);
    f.refuses(['convert', input, '--crispbasic', '--to', 'sb3'], /requires CrispBASIC mode/, 'blocks.sb3');
    f.refuses(['compile', input, '--crispbasic', '--to', 'c'], /requires CrispBASIC mode/, 'firmware.c');
});

test('portable sources refuse device analysis, retargeting and implicit device overrides', t => {
    const f = fixture(t);
    const input = f.put('portable.bw', marked);
    f.refuses(['retarget', input, 'pico'], /requires CrispBASIC mode/, 'retargeted.bw');
    f.refuses(['retarget', input, 'arduino-uno'], /requires CrispBASIC mode/, 'same-device.bw');
    f.refuses(['convert', input, '--to', 'crispbasic', '--device', 'pico'], /requires CrispBASIC mode/, 'target.bas');
    f.refuses(['check', input, '--device', 'pico']);
    f.refuses(['devices', input]);
});

test('portable native and SPIKE hardware routes refuse before launching a compiler or runner', t => {
    const f = fixture(t);
    const input = f.put('portable.bw', marked.replace('ARDUINO-UNO', 'STC12C5A60S2'));
    const result = f.refuses(['8051', 'build', input], /requires CrispBASIC mode/, 'firmware.ihx');
    assert.doesNotMatch(result.stderr, /SDCC is required/);
    const spike = f.run('spike', 'run', input);
    assert.equal(spike.status, 2, spike.stderr);
    assert.match(spike.stderr, /requires CrispBASIC mode/);
    assert.doesNotMatch(spike.stderr, /must-not-spawn-python|ENOENT/);
});

for (const [tool, verb, extra] of [
    ['toolchain', 'compile', ['--mode', 'online']],
    ['machine', 'normalize', []],
    ['fpga', 'synth', ['--mode', 'online']],
    ['makecode', 'to-hex', []]
]) {
    test(`delegated ${tool} route refuses portable source before starting the external tool`, t => {
        const f = fixture(t);
        const input = f.put('portable.bw', marked);
        f.refuses([tool, verb, input, ...extra]);
    });
}

for (const [name, directive] of [
    ['future', '# @crispbasic-portable 2'],
    ['malformed', '# @crispbasic-portable'],
    ['duplicate', `${marker}\n${marker}`]
]) {
    test(`${name} source markers refuse even the portable and source-copy routes`, t => {
        const f = fixture(t);
        const input = f.put('portable.bw', `${directive}\n${ordinary}`);
        for (const target of ['crispbasic', 'pseudocode']) {
            f.refuses(['convert', input, '--to', target], /Unsupported or duplicate CrispBASIC portable source marker/);
        }
        f.refuses(['check', input], /Unsupported or duplicate CrispBASIC portable source marker/);
        f.refuses(['retarget', input, 'pico'], /Unsupported or duplicate CrispBASIC portable source marker/);
        f.refuses(['8051', 'build', input], /Unsupported or duplicate CrispBASIC portable source marker/, 'firmware.ihx');
        f.refuses(['toolchain', 'compile', input, '--mode', 'online'], /Unsupported or duplicate CrispBASIC portable source marker/);
    });
}

test('quoted marker text remains ordinary printable data', t => {
    const f = fixture(t);
    const input = f.put('text.bw', `WHEN flag clicked:\n  print "${marker}"\n`);
    const result = f.run('convert', input, '--to', 'python');
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /@crispbasic-portable/);
});

for (const [name, source] of [
    ['computed pin', portableBasic.replace('PROCdigitalToggle(13)', 'PROCdigitalToggle(pin)')],
    ['missing initialization', portableBasic.replace('PROCpinMode(13,"output")\n', '')],
    ['unsupported command', `${portableBasic.replace('END\n', '')}PROCadcRead(1)\nEND\n`],
    ['generation error banner', '10 REM === Cannot show as BASIC ===\n20 PRINT 1\n']
]) {
    test(`explicit mode refuses ${name} without replacing the source output`, t => {
        const f = fixture(t);
        const input = f.put('refused.bas', source);
        f.refuses(['read', input, '--crispbasic'], /CrispBASIC|unsupported|unrecognised|unrecognized|declared|initializ|generation was refused/i, 'existing.bw');
    });
}

test('the delegated MakeCode text alias also retains the runtime boundary', t => {
    const f = fixture(t);
    const input = f.put('portable.txt', marked);
    f.refuses(['makecode', 'to-ts', input]);
});

for (const extension of ['bw', 'txt']) {
    for (const command of ['to-ts', 'to-project', 'to-hex', 'run']) {
        test(`direct MakeCode ${command} refuses marked .${extension} before writing or execution`, t => {
            const f = fixture(t);
            const input = f.put(`portable.${extension}`, marked);
            const output = f.put('existing.out', sentinel);
            const result = f.runMakeCode(command, input, '-o', output);
            assert.equal(result.status, 1, result.stderr || result.error?.message);
            assert.match(result.stderr, /refused: .*requires CrispBASIC mode/);
            assert.doesNotMatch(result.stderr, /at readProject|runtime is not synced/, 'refusal precedes parser/runtime loading');
            assert.equal(result.stdout, '');
            assert.equal(readFileSync(output, 'utf8'), sentinel);
        });
    }
}

for (const [name, directive] of [
    ['future', '# @crispbasic-portable 2'],
    ['malformed', '# @crispbasic-portable'],
    ['duplicate', `${marker}\n${marker}`]
]) {
    test(`direct MakeCode validates ${name} source markers before export`, t => {
        const f = fixture(t);
        const input = f.put('portable.txt', `${directive}\n${ordinary}`);
        const output = f.put('existing.ts', sentinel);
        const result = f.runMakeCode('to-ts', input, '-o', output);
        assert.equal(result.status, 1, result.stderr);
        assert.match(result.stderr, /refused: Unsupported or duplicate CrispBASIC portable source marker/);
        assert.equal(result.stdout, '');
        assert.equal(readFileSync(output, 'utf8'), sentinel);
    });
}

for (const [name, requirement] of [
    ['current', {schemaVersion: 1, requiredRuntime: 'crispbasic'}],
    ['future', {schemaVersion: 2, requiredRuntime: 'crispbasic'}],
    ['malformed', null]
]) {
    test(`direct MakeCode rejects ${name} portable project IR before target/asset export`, async t => {
        const f = fixture(t);
        const zip = new JSZip();
        zip.file('project.json', JSON.stringify({crispbasicSource: requirement, targets: [], meta: {}}));
        const input = f.put('portable.sb3', await zip.generateAsync({type: 'nodebuffer'}));
        const output = f.put('existing.mkcd', sentinel);
        for (const command of ['to-project', 'run']) {
            const result = f.runMakeCode(command, input, '-o', output);
            assert.equal(result.status, 1, result.stderr);
            assert.match(result.stderr, name === 'current' ? /requires CrispBASIC mode/ : /Unsupported CrispBASIC project source requirement/);
            assert.equal(result.stdout, '');
            assert.equal(readFileSync(output, 'utf8'), sentinel);
        }
    });
}
