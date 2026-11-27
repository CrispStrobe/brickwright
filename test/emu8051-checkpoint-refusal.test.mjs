/** Checkpoint honesty against the real vendored emu8051 WASM (supported since task B11). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const WASM_JS = path.join(ROOT, 'overlay/scratch-gui/src/lib/emu8051/emu8051.js');
const DEBUG_JS = path.join(ROOT, 'node_modules/bw-board/src/emu8051-debug.js');
const have = existsSync(WASM_JS) && existsSync(DEBUG_JS);

const CLOCK_HZ = 11059200;
const PROGRAM = ':0800000075300075304280FEEE\n:00000001FF\n';

async function fixture() {
    const {default: createEmu8051} = await import(WASM_JS);
    const {createEmu8051DebugTarget} = await import(DEBUG_JS);
    const wasm = await createEmu8051();
    wasm._emu_init(1);
    wasm._emu_set_fosc(CLOCK_HZ);
    const target = createEmu8051DebugTarget(wasm, {clockHz: CLOCK_HZ});
    wasm.ccall('emu_load_hex', 'number', ['string', 'number'], [PROGRAM, PROGRAM.length]);
    target.reset();
    return target;
}

function settle(target) {
    for (let i = 0; i < 4096 && target.state() === 'running'; i++) target.runFor(1000);
    assert.equal(target.state(), 'halted');
}

function visibleState(target) {
    return {
        regs: target.regs(),
        iram: [...target.readMem('iram', 0, 256)],
        sfr: [...target.readMem('sfr', 0x80, 128)],
        xram: [...target.readMem('xram', 0, 256)],
        timeNs: target.timeNs()
    };
}

function digest(value) {
    const text = JSON.stringify(value, (_key, item) =>
        typeof item === 'bigint' ? `0x${item.toString(16)}` : item);
    return createHash('sha256').update(text).digest('hex');
}

// Until task B11 the vendored build had no complete-state ABI and the target
// declined checkpoints. The shipping native pin exports the UART receive FIFO
// and hidden Timer0 state, and the shipping bw-board pin accepts that layout.
// The target offers checkpoints: a snapshot must restore the exact visible
// state and continuation, and a malformed one must still be refused untouched.
test('8051 offers checkpoints for the vendored build and keeps no generic snapshot alias', {skip: have ? false : 'the vendored emu8051 WASM is not present'}, async () => {
    const target = await fixture();
    const caps = target.capabilities();
    assert.deepEqual(caps.recording, ['checkpoint', 'restore']);
    assert.deepEqual(caps.extensions.checkpoint,
        {supported: true, version: 1, buildId: 0x80510103, size: 443561});
    assert.equal(target.saveState, undefined,
        'generic machine snapshot callers go through captureCheckpoint, not an alias');
    assert.equal(target.loadState, undefined);
});

test('a checkpoint restores the exact visible state and the same continuation', {skip: have ? false : 'the vendored emu8051 WASM is not present'}, async () => {
    const target = await fixture();
    const events = [];
    target.onDebugEvent(event => events.push(event));
    target.step('insn', 1);
    settle(target);
    const before = visibleState(target);
    const snapshot = target.captureCheckpoint();
    assert.equal(snapshot.refused, undefined, JSON.stringify(snapshot.refused));
    // A restore opens a new time domain (8051-oscillator-reset-N+1), so ticks
    // are not compared across the two timelines; everything else must match.
    const domains = new Set();
    const continueThree = () => {
        const mark = events.length;
        for (let i = 0; i < 3; i++) {
            target.step('insn', 1);
            settle(target);
        }
        const fresh = events.slice(mark).map(event => {
            if (!event.time) return event;
            domains.add(event.time.domain);
            return {...event, time: {...event.time, domain: undefined}};
        });
        return {state: visibleState(target), events: digest(fresh)};
    };
    const first = continueThree();
    assert.notDeepEqual(first.state, before, 'the continuation must move the machine');
    assert.equal(target.restoreCheckpoint(snapshot), true);
    assert.deepEqual(visibleState(target), before);
    assert.deepEqual(continueThree(), first, 'a restored machine must continue exactly as the original did');
    assert.equal(domains.size, 2, 'the restored timeline must be a new time domain');
});

test('a malformed checkpoint is refused and leaves the real emulator state untouched', {skip: have ? false : 'the vendored emu8051 WASM is not present'}, async () => {
    const target = await fixture();
    target.step('insn', 1);
    settle(target);
    const before = visibleState(target);
    const restore = target.restoreCheckpoint({partial: new Uint8Array([1, 2, 3])});
    assert.equal(restore.code, 'invalid-checkpoint-envelope');
    assert.deepEqual(visibleState(target), before);
});

test('refused checkpoint calls leave subsequent recorded replay hashes unchanged', {skip: have ? false : 'the vendored emu8051 WASM is not present'}, async () => {
    const run = async interfere => {
        const target = await fixture();
        const events = [];
        target.onDebugEvent(event => events.push(event));
        if (interfere) {
            target.captureCheckpoint();
            target.restoreCheckpoint({partial: new Uint8Array([1, 2, 3])});
        }
        for (let i = 0; i < 3; i++) {
            target.step('insn', 1);
            settle(target);
        }
        return digest(events);
    };
    assert.equal(await run(true), await run(false),
        'a refused restore must not perturb deterministic continuation or its event trace');
});
