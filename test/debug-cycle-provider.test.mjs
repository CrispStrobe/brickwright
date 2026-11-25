import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {pathToFileURL} from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const PROVIDER = path.join(ROOT, 'overlay/scratch-gui/src/lib/bw-debug/cycle-provider.js');
const DEBUG = path.join(ROOT, 'node_modules/bw-board/src/emu8051-debug.js');
const WASM_JS = path.join(ROOT, 'overlay/scratch-gui/src/lib/emu8051/emu8051.js');
const WASM = path.join(ROOT, 'overlay/scratch-gui/src/lib/emu8051/emu8051.wasm');

const {normalizeCycleProvider, negotiateCycleProvider} = await import(pathToFileURL(PROVIDER));

test('cycle-provider negotiation never promotes predicted timing into execution', () => {
    const predicted = normalizeCycleProvider({
        schema: 1, engine: 'table', boundary: 'instruction-total', timeDomain: 'cpu',
        fidelity: 'predicted', resumable: false, signals: ['total-cycles'], checkpoint: false
    });
    assert.equal(predicted.fidelity, 'predicted');
    assert.equal(predicted.resumable, false);
    assert.deepEqual(predicted.signals, ['total-cycles']);
    assert.equal(negotiateCycleProvider({}), null);
    assert.equal(negotiateCycleProvider({cycleProvider: () => null}), null);
    assert.throws(() => negotiateCycleProvider({
        cycleProvider: () => ({...predicted, fidelity: 'recorded', resumable: true}),
        capabilities: () => ({steps: ['insn']})
    }), /requires an explicit cycle step/);
});

test('cycle-provider descriptions reject ambiguous clocks and unknown fidelity', () => {
    const base = {schema: 1, engine: 'core', boundary: 'tick', timeDomain: 'cpu',
        fidelity: 'recorded', resumable: true};
    assert.throws(() => normalizeCycleProvider({...base, clockHz: 0}), /clockHz/);
    assert.throws(() => normalizeCycleProvider({...base, fidelity: 'exact-ish'}), /fidelity/);
    assert.throws(() => normalizeCycleProvider({...base, signals: ['ALE', 7]}), /signals/);
});

test('vendored 8051 exposes its native oscillator provider and its limits', async t => {
    if (!fs.existsSync(WASM_JS) || !fs.existsSync(WASM)) return t.skip('vendored WASM absent');
    const {default: createEmu8051} = await import(pathToFileURL(WASM_JS));
    const {createEmu8051DebugTarget} = await import(pathToFileURL(DEBUG));
    const wasm = await createEmu8051();
    wasm._emu_init(1);
    const target = createEmu8051DebugTarget(wasm, {clockHz: 12000000});
    target.reset();
    const provider = negotiateCycleProvider(target);
    assert.deepEqual(provider, {
        schema: 1,
        engine: 'emu8051-stc',
        boundary: 'oscillator-clock',
        timeDomain: '8051-oscillator-reset-1',
        clockHz: 12000000,
        fidelity: 'recorded',
        resumable: true,
        signals: [],
        // The shipping emu8051-stc pin exports the checkpoint ABI, and
        // the shipping bw-board pin accepts the same complete-state layout.
        checkpoint: true
    });
    assert.ok(target.capabilities().steps.includes('cycle'));
    assert.equal(target.capabilities().extensions.busSignals, false);
    target.detach();
});
