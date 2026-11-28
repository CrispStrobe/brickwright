import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {createNativeSession} from '../index.mjs';
import {hostNativeTarget, nativeTarget, verifyNativeBinary} from '../scripts/native-targets.mjs';

test('target selection keeps ARM32 and ARM64 layouts distinct and refuses unknown CPUs', () => {
    assert.equal(hostNativeTarget('linux', 'arm'), 'linux-armv7');
    assert.equal(nativeTarget('linux-armv7').dataSource, 'bbdata_arm_32.s');
    assert.equal(nativeTarget('linux-arm64').dataSource, 'bbdata_arm_64.s');
    assert.throws(() => nativeTarget('linux-riscv64'), /Unsupported native target/);
    assert.throws(() => nativeTarget('win32-x64'), /Unsupported native target/);
});

test('binary verification rejects a wrong CPU, ELF class, byte order or ARM soft-float ABI', () => {
    const arm = nativeTarget('linux-armv7');
    const bytes = Buffer.alloc(52);
    bytes.set([0x7f, 0x45, 0x4c, 0x46, 1, 1]);
    bytes.writeUInt16LE(40, 18);
    bytes.writeUInt32LE(0x5000400, 36);
    verifyNativeBinary(bytes, arm);
    for (const [offset, value] of [[4, 2], [5, 2], [18, 62], [37, 0]]) {
        const wrong = Buffer.from(bytes);
        wrong[offset] = value;
        assert.throws(() => verifyNativeBinary(wrong, arm), /incompatible ELF|hard-float/);
    }
});

test('native runner validation rejects malformed configuration without launching a child', () => {
    for (const runner of [null, [], {}, {executable: ''}, {executable: 'bad\0'},
        {executable: 'qemu-arm', args: '-L /sysroot'}, {executable: 'qemu-arm', args: [42]}]) {
        assert.throws(() => createNativeSession({runner}), /runner must provide/);
    }
});

test('a configured runner receives copied literal argv without shell evaluation', async t => {
    const directory = await mkdtemp(join(tmpdir(), 'crispbasic-runner-'));
    t.after(() => rm(directory, {recursive: true, force: true}));
    const script = join(directory, 'runner.mjs');
    await writeFile(script, `import {writeSync} from 'node:fs';
process.stdout.write(JSON.stringify(process.argv.slice(2)) + '\\n');
writeSync(3, JSON.stringify({type:'result', version:1, status:'completed', exitCode:0}) + '\\n');
`);
    const args = [script, 'literal $(echo unsafe); with spaces'];
    const session = createNativeSession({executable: join(directory, 'arm interpreter'),
        runner: {executable: process.execPath, args}});
    t.after(() => session.dispose());
    args.push('mutation must not affect launch');
    const result = await session.run('END');
    assert.equal(result.status, 'completed', result.error?.message);
    const argv = JSON.parse(result.text);
    assert.equal(argv.length, 3);
    assert.equal(argv[0], 'literal $(echo unsafe); with spaces');
    assert.equal(argv[1], join(directory, 'arm interpreter'));
    assert.match(argv[2], /program\.bas$/);
});

test('CLI refuses native runner flags on WASM and runner arguments without a runner', () => {
    const cli = fileURLToPath(new URL('../bin/crispbasic.mjs', import.meta.url));
    for (const args of [['--backend', 'wasm', '--native-runner', 'qemu-arm', '--capabilities'],
        ['--native-runner-arg=-L', '--capabilities']]) {
        const result = spawnSync(process.execPath, [cli, ...args], {encoding: 'utf8'});
        assert.equal(result.status, 1);
        assert.match(result.stderr, /require/);
        assert.equal(result.stdout, '');
    }
});
