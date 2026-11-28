import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdtemp, readFile, readdir, rm, writeFile, symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {promisify} from 'node:util';
import {createRequire} from 'node:module';

const root = resolve(import.meta.dirname, '..');
const cli = join(root, 'bin/bwlite.mjs');
const execute = promisify(execFile);
const require = createRequire(import.meta.url);
const run = async (args, env = {}) => {
    try {
        return {status: 0, ...await execute(process.execPath, [cli, ...args], {
            cwd: tmpdir(), encoding: 'utf8', timeout: 15000, env: {...process.env, ...env}
        })};
    } catch (error) {
        return {status: error.code, stdout: error.stdout, stderr: error.stderr};
    }
};
const success = result => assert.equal(result.status, 0, result.stderr);
const cpmReply = () => ({success: true, language: 'cowgol', target: 'z80-cpm',
    toolchain: 'cowgol-cpmz', format: 'bin', artifact_kind: 'executable',
    origin: 0x100, base64: 'yQ==', bytes: 1});
async function fixture (t, responder = () => cpmReply()) {
    const directory = await mkdtemp(join(tmpdir(), 'bwlite-cowgol-build-'));
    const requests = [];
    const server = createServer(async (request, response) => {
        let body = '';
        for await (const chunk of request) body += chunk;
        requests.push({path: request.url, method: request.method, body: JSON.parse(body)});
        const reply = await responder(requests.at(-1));
        if (!reply) return; // Deliberate never-reply fixture for the timeout check.
        response.writeHead(reply.httpStatus || 200, {'Content-Type': 'application/json', ...reply.headers});
        response.end(JSON.stringify(reply));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(async () => {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        await rm(directory, {recursive: true, force: true});
    });
    const endpoint = `http://127.0.0.1:${server.address().port}/compile`;
    return {directory, requests, endpoint,
        path: name => join(directory, name),
        async put (name, value) { const file = join(directory, name); await writeFile(file, value); return file; },
        build: (input, target, output, extra = [], env = {}) => run([
            'cowgol', 'build', input, '--target', target, '--out', output, '--endpoint', endpoint, ...extra
        ], env)};
}

test('native CLI submits full Cowgol unchanged and atomically saves validated bytes', async t => {
    const f = await fixture(t);
    const source = 'include "cowgol.coh";\nvar values: int32[4];\nvalues[0] := 42;\n';
    const input = await f.put('full.cowgol', source);
    const output = await f.put('program.com', 'OLD ARTIFACT');
    const result = await f.build(input, 'z80-cpm', output);
    success(result);
    assert.match(result.stdout, /1 bytes; cowgol-cpmz/);
    assert.deepEqual(f.requests, [{method: 'POST', path: '/compile', body: {
        language: 'cowgol', target: 'z80-cpm', format: 'bin', code: source
    }}]);
    assert.deepEqual(await readFile(output), Buffer.from([0xc9]));
    assert.equal(await readFile(input, 'utf8'), source);
    assert.equal((await readdir(f.directory)).some(name => name.startsWith('.bwlite-cowgol-')), false);
});

test('native CLI builds checked pseudocode and the original SB3 graph', async t => {
    const f = await fixture(t);
    const source = 'DEVICE Z80\nGLOBAL n = 2\nWHEN flag clicked:\n  set n to (n + 3)\n  say n\n';
    const pseudo = await f.put('program.bw', source);
    const sb3 = f.path('program.sb3');
    success(await run(['convert', pseudo, '--to', 'sb3', '--out', sb3]));
    for (const input of [pseudo, sb3]) {
        const result = await f.build(input, 'z80-cpm', f.path('program.com'));
        success(result);
        assert.match(result.stderr, /checked signed int32/);
        assert.match(f.requests.at(-1).body.code, /sub bw_checked_add/);
        assert.match(f.requests.at(-1).body.code, /bw_print_number/);
    }
    const zip = await require('jszip').loadAsync(await readFile(sb3));
    const project = JSON.parse(await zip.file('project.json').async('string'));
    const target = project.targets.find(target => Object.values(target.blocks).some(block => block.opcode === 'looks_say'));
    const block = Object.values(target.blocks).find(block => block.opcode === 'looks_say');
    block.opcode = 'unsupported_extension_call';
    zip.file('project.json', JSON.stringify(project));
    const unsupported = await f.put('unsupported.sb3', await zip.generateAsync({type: 'nodebuffer'}));
    const before = f.requests.length;
    const result = await f.build(unsupported, 'z80-cpm', f.path('program.com'));
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /unsupported_extension_call/);
    assert.equal(f.requests.length, before);
    assert.deepEqual(await readFile(f.path('program.com')), Buffer.from([0xc9]));
    const prior = await f.put('keep.cow', 'KEEP');
    for (const options of [[], ['--target', 'z80-cpm'], ['--target', 'z80-cpm', '--device', 'z80']]) {
        const converted = await run(['convert', unsupported, '--to', 'cowgol', '--out', prior, ...options]);
        assert.equal(converted.status, 2, converted.stderr);
        assert.match(converted.stderr, /unsupported_extension_call/);
        assert.equal(await readFile(prior, 'utf8'), 'KEEP');
    }
});

test('native CLI refuses mismatched devices, unsupported source and unsafe arguments before HTTP', async t => {
    const f = await fixture(t);
    const output = await f.put('keep.com', 'KEEP');
    for (const [name, source, target, extra, diagnostic] of [
        ['wrong.bw', 'DEVICE ARDUINO-UNO\nWHEN flag clicked:\n  say 42\n', 'z80-cpm', [], /cannot run DEVICE/],
        ['unknown.bw', 'WHEN flag clicked:\n  unknown command\n', 'z80-cpm', [], /Line 2: unknown command/],
        ['source.cow', 'bw_print_number(42);', 'prototype', [], /supported --target/],
        ['source.cow', 'bw_print_number(42);', 'z80-cpm', ['--timeout-ms', '0'], /timeout-ms/],
        ['source.cow', 'bw_print_number(42);', 'z80-cpm', ['--endpoint', ''], /Invalid URL/],
        ['source.txt', 'bw_print_number(42);', 'z80-cpm', [], /input must be/],
        ['source.bw', 'WHEN flag clicked:\n  say 42\n', 'cowgol-cgen', [], /C export requires/]
    ]) {
        const input = await f.put(name, source);
        const result = await f.build(input, target, output, extra);
        assert.equal(result.status, 2, result.stderr);
        assert.match(result.stderr, diagnostic);
        assert.equal(await readFile(output, 'utf8'), 'KEEP');
    }
    const input = await f.put('original.cow', 'bw_print_number(42);');
    const result = await f.build(input, 'z80-cpm', input);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /differ from the input/);
    assert.equal(await readFile(input, 'utf8'), 'bw_print_number(42);');
    const alias = f.path('alias.cow');
    await symlink(input, alias);
    for (const [source, destination] of [[alias, input], [input, alias]]) {
        const same = await f.build(source, 'z80-cpm', destination);
        assert.equal(same.status, 2, same.stderr);
        assert.match(same.stderr, /differ from the input/);
        assert.equal(await readFile(input, 'utf8'), 'bw_print_number(42);');
    }
    assert.equal(f.requests.length, 0);
});


for (const [target, device, mcu, flashLimit, ramEnd, heapSize, bootloader] of [
    ['arduino-nano', 'NANO', 'atmega328p', 0x7800, 0x900, 512, 2048],
    ['atmega168p', 'ATMEGA168P', 'atmega168p', 0x4000, 0x500, 128, 0]
]) {
    test('native CLI builds ' + target + ' timed GPIO and refuses a different chip profile', async t => {
        const image = Buffer.alloc(128);
        image.set([0x0c, 0x94, 0x34, 0]);
        const lines = [];
        for (let address = 0; address < image.length; address += 16) {
            const data = [16, 0, address, 0, ...image.subarray(address, address + 16)];
            data.push((-data.reduce((sum, byte) => sum + byte, 0)) & 255);
            lines.push(':' + Buffer.from(data).toString('hex').toUpperCase());
        }
        const hex = Buffer.from(lines.join('\n') + '\n:00000001FF\n');
        const heapEnd = 0x104 + heapSize;
        const f = await fixture(t, () => ({success: true, language: 'cowgol', target,
            toolchain: 'cowgol-' + target, format: 'hex', artifact_kind: 'executable',
            board: target, bootloader_reserve: bootloader, mcu, origin: 0, entry: 0,
            f_cpu: 16000000, uart_baud: 9600, base64: hex.toString('base64'), bytes: hex.length,
            memory_end: heapEnd, memory_layout: {flash_end: 128, flash_limit: flashLimit,
                data_start: 0x100, data_end: 0x102, bss_end: heapEnd, heap_start: 0x104,
                heap_end: heapEnd, stack_start: ramEnd - 512, stack_reserve: 512, ram_end: ramEnd,
                halted_addr: 0x102, status_addr: 0x103, mcu, heap_size: heapSize,
                flash_size: mcu === 'atmega168p' ? 0x4000 : 0x8000}}));
        const input = await f.put('program.bw', 'DEVICE ' + device + '\nPIN led = D13 OUTPUT\nWHEN flag clicked:\n' +
            '  turn on led\n  wait 0.001 seconds\n  turn off led\n');
        const output = await f.put('program.hex', 'OLD');
        success(await f.build(input, target, output));
        assert.equal(f.requests[0].body.target, target);
        assert.match(f.requests[0].body.code, /bw_delay\(1\)/);
        assert.match(f.requests[0].body.code, /bw_digital_write\(13/);
        assert.deepEqual(await readFile(output), hex);
        const rejected = await f.build(input, 'atmega328p', output);
        assert.equal(rejected.status, 2, rejected.stderr);
        assert.match(rejected.stderr, /cannot run DEVICE/);
        assert.equal(f.requests.length, 1);
        assert.deepEqual(await readFile(output), hex);
    });
}

test('native CLI preserves prior artifacts on compiler refusal, invalid bytes and policy denial', async t => {
    let response = cpmReply();
    const f = await fixture(t, () => response);
    const input = await f.put('program.cow', 'bw_print_number(42);');
    const output = await f.put('keep.com', 'KEEP');
    for (const reply of [
        {...cpmReply(), toolchain: 'sdcc'}, {...cpmReply(), bytes: 2},
        {...cpmReply(), format: 'hex'}, {...cpmReply(), artifact_kind: 'source'},
        {...cpmReply(), origin: 0}, {...cpmReply(), base64: '!!!!'},
        {httpStatus: 503, success: false, error: 'bundle unavailable', log: 'Compiler diagnostic'}
    ]) {
        response = reply;
        const result = await f.build(input, 'z80-cpm', output);
        assert.equal(result.status, 2, result.stderr);
        assert.match(result.stderr, /invalid artifact|bundle unavailable/);
        if (reply.log) assert.match(result.stderr, /Compiler diagnostic/);
        assert.equal(await readFile(output, 'utf8'), 'KEEP');
    }
    const count = f.requests.length;
    const result = await f.build(input, 'z80-cpm', output, [], {BW_REMOTE_TOOLCHAINS_POLICY: 'deny'});
    assert.equal(result.status, 2);
    assert.match(result.stderr, /unavailable in this build/);
    assert.equal(f.requests.length, count);
    assert.equal(await readFile(output, 'utf8'), 'KEEP');
});

test('native CLI refuses redirects without forwarding source or replacing output', async t => {
    const receiver = await fixture(t);
    const redirector = await fixture(t, () => ({httpStatus: 307, headers: {Location: receiver.endpoint}}));
    const input = await redirector.put('program.cow', 'bw_print_number(42);');
    const output = await redirector.put('keep.com', 'KEEP');
    const result = await redirector.build(input, 'z80-cpm', output);
    assert.equal(result.status, 2, result.stderr);
    assert.equal(redirector.requests.length, 1);
    assert.equal(receiver.requests.length, 0);
    assert.equal(await readFile(output, 'utf8'), 'KEEP');
    const emptyEndpoint = await run(['cowgol', 'build', input, '--target', 'z80-cpm', '--out', output],
        {BWLITE_COWGOL_ENDPOINT: ''});
    assert.equal(emptyEndpoint.status, 2, emptyEndpoint.stderr);
    assert.match(emptyEndpoint.stderr, /Invalid URL/);
    assert.equal(await readFile(output, 'utf8'), 'KEEP');
});

test('native CLI enforces timeout and retains an earlier output', async t => {
    const f = await fixture(t, () => null);
    const input = await f.put('program.cow', 'bw_print_number(42);');
    const output = await f.put('keep.com', 'KEEP');
    const result = await f.build(input, 'z80-cpm', output, ['--timeout-ms', '100']);
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /timeout|aborted/i);
    assert.equal(await readFile(output, 'utf8'), 'KEEP');
});

test('native C export uses the configured endpoint and writes the exact C source', async t => {
    const generated = 'int main(void) { return 0; }\n';
    const f = await fixture(t, () => ({...cpmReply(), target: 'cowgol-cgen', toolchain: 'cowgol-cgen',
        format: 'c', artifact_kind: 'source', bytes: Buffer.byteLength(generated), base64: Buffer.from(generated).toString('base64')}));
    const input = await f.put('program.cow', 'var values: int32[4];');
    const output = f.path('program.c');
    const result = await run(['cowgol', 'build', input, '--target', 'cowgol-cgen', '-o', output],
        {BWLITE_COWGOL_ENDPOINT: f.endpoint});
    success(result);
    assert.equal(await readFile(output, 'utf8'), generated);
    assert.equal(f.requests[0].body.format, 'c');
});

test('conversion exports native Cowgol explicitly and keeps the old alias as conversion', async t => {
    const f = await fixture(t);
    const input = await f.put('program.bw', 'GLOBAL n = 2\nWHEN flag clicked:\n  say (n + 3)\n');
    const output = await f.put('native.cow', 'KEEP');
    for (const command of ['convert', 'transpile', 'compile']) {
        for (const options of [['--target', 'z80-cpm'], ['--target=dos']]) {
            const result = await run([command, input, '--to', 'cowgol', ...options]);
            success(result);
            assert.match(result.stdout, /sub bw_checked_add/);
            assert.match(result.stderr, /checked signed int32/);
        }
    }
    for (const options of [['--target', 'invalid'], ['--target'], ['--target='], ['--target=invalid']]) {
        const result = await run(['convert', input, '--to', 'cowgol', '--out', output, ...options]);
        assert.equal(result.status, 2, result.stderr);
        assert.equal(await readFile(output, 'utf8'), 'KEEP');
    }
    const wrongLanguage = await run(['convert', input, '--to', 'c', '--target', 'z80-cpm', '--out', output]);
    assert.equal(wrongLanguage.status, 2);
    assert.equal(await readFile(output, 'utf8'), 'KEEP');
    assert.equal(f.requests.length, 0);
});

test('native Cowgol conversion refuses original parse warnings before device retargeting', async t => {
    const f = await fixture(t);
    const input = await f.put('pins.bw', 'DEVICE PICO\nPIN led = GP25 OUTPUT\nWHEN flag clicked:\n' +
        '  turn on led\n  say (1 > 0)\n');
    const output = await f.put('keep.cow', 'KEEP');
    const result = await run(['convert', input, '--to=cowgol', '--target=atmega328p',
        '--device=arduino-uno', '--out', output]);
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /Cowgol generation refused:/);
    assert.equal(await readFile(output, 'utf8'), 'KEEP');
    assert.equal(f.requests.length, 0);
});

test('native command help and discovery enumerate every existing compiler output', async () => {
    const list = await run(['cowgol', 'targets']);
    success(list);
    for (const target of ['z80-cpm', 'i8080-cpm', 'dos', 'riscv32', 'eater6502', 'atmega328p', 'arduino-nano', 'atmega168p', 'cowgol-cgen']) {
        assert.match(list.stdout, new RegExp(`^${target}\\s`, 'm'));
    }
    const help = await run(['cowgol', '--help']);
    success(help);
    assert.match(help.stdout, /Native Cowgol builds/);
    assert.match(help.stdout, /BWLITE_COWGOL_ENDPOINT/);
});
