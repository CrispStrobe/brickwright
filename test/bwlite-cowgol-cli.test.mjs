import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const cli = resolve(root, 'bin/bwlite.mjs');
const run = (...args) => spawnSync(process.execPath, [cli, ...args], {
    cwd: tmpdir(), encoding: 'utf8', timeout: 30000
});
const fixture = () => {
    const dir = mkdtempSync(join(tmpdir(), 'bwlite-cowgol-'));
    return {
        path: name => join(dir, name),
        put (name, text) { const path = join(dir, name); writeFileSync(path, text); return path; },
        close () { rmSync(dir, {recursive: true, force: true}); }
    };
};
const succeeded = result => assert.equal(result.status, 0, result.stderr);

test('CLI reads .cow and .cowgol, checks them and executes converted arithmetic/text', () => {
    const f = fixture();
    try {
        const source = 'include "cowgol.coh"; include "brickwright.coh";\n' +
            'var n: int32 := 2; n := n + 5; bw_print_number(n); bw_print_text("München");\n';
        for (const extension of ['cow', 'cowgol', 'COW']) {
            const input = f.put(`program.${extension}`, source);
            const read = run('read', input);
            succeeded(read);
            assert.match(read.stdout, /set n to \(n \+ 5\)/);
            assert.match(read.stdout, /say "München"/);
            assert.match(read.stderr, /signed int32/);
            assert.doesNotMatch(read.stdout, /warning:/);
            const check = run('check', input);
            succeeded(check);
            assert.equal(check.stdout.trim(), 'ok');
        }
        const js = f.path('program.js');
        succeeded(run('convert', f.path('program.cow'), '--to', 'javascript', '--out', js));
        const execution = spawnSync(process.execPath, [js], {encoding: 'utf8', timeout: 5000});
        succeeded(execution);
        assert.deepEqual(execution.stdout.trim().split('\n'), ['7', 'München']);
    } finally { f.close(); }
});

test('Cowgol export and read preserve the device, pins and executable source edits', () => {
    const f = fixture();
    try {
        const input = f.put('pins.bw', 'DEVICE ARDUINO-UNO\nPIN lamp = D13 OUTPUT ACTIVE LOW\n' +
            'PIN button = D2 INPUT\nWHEN flag clicked:\n  turn on lamp\n' +
            '  IF read button = 1 THEN:\n    toggle lamp\n  say 42\n');
        const cow = f.path('pins.cow');
        const result = run('convert', input, '--to', 'cowgol', '--out', cow);
        succeeded(result);
        assert.match(result.stderr, /signed int32/);
        let emitted = readFileSync(cow, 'utf8');
        assert.match(emitted, /bw_digital_write\(13, 0\)/);
        assert.match(emitted, /bw_digital_read\(2\)/);
        emitted = emitted.replace('bw_print_number(42)', 'bw_print_number(73)');
        writeFileSync(cow, emitted);
        const back = run('read', cow);
        succeeded(back);
        assert.match(back.stdout, /DEVICE ARDUINO-UNO/);
        assert.match(back.stdout, /PIN lamp = D13 OUTPUT ACTIVE LOW/);
        assert.match(back.stdout, /PIN button = D2 INPUT/);
        assert.match(back.stdout, /say 73/);
        assert.doesNotMatch(back.stdout, /say 42/);
    } finally { f.close(); }
});

test('Cowgol travels through SB3 and both conversion command aliases', () => {
    const f = fixture();
    try {
        const input = f.put('program.cow', 'var n: int32 := 5; bw_print_number(n);\n');
        const project = f.path('program.sb3');
        succeeded(run('convert', input, '--to', 'sb3', '--out', project));
        const cow = f.path('recovered.cow');
        succeeded(run('transpile', project, '--to', 'cowgol', '--out', cow));
        const recovered = run('read', cow);
        succeeded(recovered);
        assert.match(recovered.stdout, /GLOBAL n = 5/);
        assert.match(recovered.stdout, /say n/);
        const alias = run('compile', project, '--to', 'cowgol');
        succeeded(alias);
        assert.equal(alias.stdout, readFileSync(cow, 'utf8'));
    } finally { f.close(); }
});

test('Cowgol input keeps the explicit checked retargeting option', () => {
    const f = fixture();
    try {
        const input = f.put('console.cowgol', 'bw_print_number(17);\n');
        const result = run('read', input, '--device', 'riscv32');
        succeeded(result);
        assert.match(result.stdout, /DEVICE RISCV32/);
        assert.match(result.stdout, /say 17/);
    } finally { f.close(); }
});

test('unsupported Cowgol fails before emitting or replacing output on every reader command', () => {
    const f = fixture();
    try {
        const input = f.put('unsupported.cow', 'bw_print_number(42);\nvar values: int32[4];\n');
        const output = f.put('keep.bw', 'KEEP EXISTING OUTPUT\n');
        for (const args of [
            ['read', input, '--out', output],
            ['convert', input, '--to', 'pseudocode', '--out', output],
            ['convert', input, '--to', 'sb3', '--out', output],
            ['convert', input, '--to', 'cowgol', '--out', output],
            ['check', input], ['devices', input], ['retarget', input, 'riscv32', '--out', output]
        ]) {
            const result = run(...args);
            assert.equal(result.status, 2, result.stderr);
            assert.match(result.stderr, /Cowgol import refused: Line 2:/);
            assert.equal(result.stdout, '');
            assert.equal(readFileSync(output, 'utf8'), 'KEEP EXISTING OUTPUT\n');
        }
    } finally { f.close(); }
});

test('unsupported Blocks and unparsed pseudocode cannot become successful Cowgol output', () => {
    const f = fixture();
    try {
        const output = f.put('keep.cow', 'KEEP EXISTING OUTPUT\n');
        for (const [source, diagnostic] of [
            ['WHEN flag clicked:\n  say (3 / 2)\n', /Cowgol generation refused:/],
            ['WHEN flag clicked:\n  say 1\nWHEN flag clicked:\n  say 2\n', /Cowgol generation refused:/],
            ['WHEN flag clicked:\n  say 1\n  unknown command here\n', /Line 3: unknown command here/]
        ]) {
            const input = f.put('unsupported.bw', source);
            const result = run('convert', input, '--to', 'cowgol', '--out', output);
            assert.equal(result.status, 2, result.stderr);
            assert.match(result.stderr, diagnostic);
            assert.equal(result.stdout, '');
            assert.equal(readFileSync(output, 'utf8'), 'KEEP EXISTING OUTPUT\n');
        }
    } finally { f.close(); }
});

test('CLI help names the Cowgol reader and exporter', () => {
    const result = run('--help');
    succeeded(result);
    assert.match(result.stdout, /bwlite read .*\.cow\|\.cowgol/);
    assert.match(result.stdout, /--to .*\|cowgol/);
});
