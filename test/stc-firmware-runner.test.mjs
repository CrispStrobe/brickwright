// Boot firmware through the real GUI runner, adapter and shipped WASM. A
// hand-off event or a helper's return value alone does not prove attach works.
import test from 'node:test';
import assert from 'node:assert/strict';
import {copyFileSync, mkdirSync, mkdtempSync, rmSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createDebugRunner} from '../overlay/scratch-gui/src/lib/bw-debug/debug-runner.js';
import {stcAssemblyFirmware} from '../overlay/scratch-gui/src/lib/bw-asm/stc-image.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shippedWasm = path.join(root, 'overlay/scratch-gui/src/lib/emu8051/emu8051.wasm');

function hexImage (bytes) {
    const record = [bytes.length, 0, 0, 0, ...bytes];
    record.push((-record.reduce((sum, byte) => sum + byte, 0)) & 255);
    return ':' + record.map(byte => byte.toString(16).padStart(2, '0')).join('') +
        '\n:00000001FF\n';
}

async function withFirmware ({project, bytes, device = 'stc15w408as', clockHz = 12000000,
    designer = true}, check) {
    // Keep the production locateFile callback: the runner resolves
    // static/emu8051.wasm relative to document.baseURI. Copy the exact shipped
    // bytes into a disposable document root; no alternate core or factory.
    const artifacts = path.join(root, 'artifacts');
    mkdirSync(artifacts, {recursive: true});
    const work = mkdtempSync(path.join(artifacts, 'stc-firmware-runner-'));
    mkdirSync(path.join(work, 'static'));
    copyFileSync(shippedWasm, path.join(work, 'static/emu8051.wasm'));
    const names = ['window', 'document', 'CustomEvent', 'requestAnimationFrame', 'cancelAnimationFrame'];
    const saved = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
    const events = new EventTarget();
    globalThis.window = Object.assign(Object.create(globalThis), {
        addEventListener: events.addEventListener.bind(events),
        removeEventListener: events.removeEventListener.bind(events),
        dispatchEvent: events.dispatchEvent.bind(events)
    });
    globalThis.document = {baseURI: pathToFileURL(work + path.sep).href};
    globalThis.CustomEvent = class extends Event {
        constructor (type, options = {}) { super(type); this.detail = options.detail; }
    };
    // The test drives instructions explicitly; no wall-clock frame can race
    // a register or timing assertion.
    globalThis.requestAnimationFrame = () => 1;
    globalThis.cancelAnimationFrame = () => {};

    const runtime = {targets: [], on () {}, off () {}, emit () {}, glowBlock () {}};
    if (project !== undefined) runtime.stc = project;
    if (designer) runtime.circuitBoard = {
        parts: [{id: 'MCU', kind: 'mcu', params: {}, terminals: []}], getNets: () => []
    };
    const vm = {runtime, toJSON () { throw new Error('Firmware must not compile the block project'); }};
    const detail = stcAssemblyFirmware({target: device,
        bytes: new TextEncoder().encode(hexImage(bytes))}, clockHz);
    const runner = createDebugRunner({vm, targetKind: detail.kind, onChange () {}});
    try {
        runner.setFirmware(detail.firmware);
        await runner.start();
        assert.equal(runner.state().phase, 'running', runner.state().message);
        runner.pause();
        assert.equal(runner.inspect().flavor, '8051', 'the image reached the 8051 core');
        assert.equal(runner.state().cycleProvider.clockHz, clockHz,
            'the debugger clock domain belongs to this image');
        await check(runner, runtime);
    } finally {
        runner.destroy();
        for (const [name, descriptor] of saved) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else delete globalThis[name];
        }
        rmSync(work, {recursive: true, force: true});
    }
}

test('fresh-project STC firmware boots without runtime.stc or a designer board', async () => {
    await withFirmware({bytes: [0x74, 0x2a, 0x80, 0xfe], designer: false}, (runner, runtime) => {
        assert.equal(runtime.bwBoardSource, 'inferred', 'exercise the no-pins inference path');
        assert.equal(runner.stepInstruction(), undefined);
        assert.equal(runner.inspect().regs.a, 42);
        assert.deepEqual(runner.variables(), []);
    });
});

test('an existing STC project can run firmware with no symbol table', async () => {
    await withFirmware({project: {device: 'stc12c5a60s2', clock: 11059200, pins: []},
        bytes: [0x74, 0x5a, 0x80, 0xfe]}, runner => {
        assert.equal(runner.stepInstruction(), undefined);
        assert.equal(runner.inspect().regs.a, 0x5a);
        assert.deepEqual(runner.variables(), []);
        assert.equal(runner.state().bwMs, undefined, 'no scheduler position is invented');
    });
});

test('W408AS firmware overrides a prior AVR project and uses the native W408AS model', async () => {
    // Configure T1 as a 1T counter and attempt to switch DPTR. W408AS has
    // neither T1 nor a second DPTR; the former F2K60S2 alias fails both facts.
    const bytes = [0x75, 0x89, 0x10, 0x75, 0x8e, 0x40, 0x75, 0x88, 0x40,
        0x75, 0x82, 0x34, 0x75, 0x83, 0x12, 0x75, 0xa2, 0x01,
        0x74, 0x2a, 0x80, 0xfe];
    await withFirmware({project: {device: 'atmega328p', clock: 16000000, pins: []}, bytes}, runner => {
        assert.equal(runner.stepInstruction(16), undefined);
        assert.equal(runner.inspect().regs.a, 42);
        assert.equal(runner.inspect().regs.dptr, 0x1234, 'W408AS has one DPTR');
        assert.deepEqual(runner.readMem('sfr', 0x8b, 1), [0], 'W408AS has no TL1 counter');
        assert.deepEqual(runner.readMem('sfr', 0x8d, 1), [0], 'W408AS has no TH1 counter');
    });
});

test('leading NOPs are executable firmware and use the image oscillator', async () => {
    await withFirmware({project: {device: 'stc15f2k60s2', clock: 16000000, pins: []},
        bytes: [0, 0, 0, 0x74, 0x5a, 0x80, 0xfe]}, runner => {
        const before = Number(runner.inspect().tNs);
        assert.equal(runner.stepInstruction(3), undefined);
        const after = runner.inspect();
        assert.equal(after.pc, 3, 'three NOPs retire before MOV A');
        const elapsed = Number(after.tNs) - before;
        assert.ok(elapsed >= 249 && elapsed <= 251,
            `three 1T NOPs at 12MHz need 250ns (within fixed-point rounding), got ${elapsed}`);
        assert.equal(runner.stepInstruction(), undefined);
        assert.equal(runner.inspect().regs.a, 0x5a);
    });
});
