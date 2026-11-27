import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeMachineConfig, validateMachineConfig} from '../overlay/scratch-gui/src/lib/bw-machines/machine-config.js';
import {activateConfig} from '../overlay/scratch-gui/src/lib/bw-machines/activate.js';
import {runMachineConfig} from '../overlay/scratch-gui/src/lib/bw-machines/run-machine.js';

const bytes = Uint8Array.of(0xf4);
const config = rom => ({machine: 'i8086', slots: {rom}});
const fetcher = async () => ({bytes});

test('explicit ROM placement survives normalization, activation and machine-load dispatch', async () => {
    for (const romAt of [0, 0xf0000, 0xffff0]) {
        const original = config({url: 'local.rom', romAt});
        const once = normalizeMachineConfig(original);
        const twice = normalizeMachineConfig(once);
        assert.equal(validateMachineConfig(once).ok, true);
        assert.equal(once.slots.rom.romAt, romAt);
        assert.deepEqual(twice, once);
        const activated = await activateConfig(twice, {fetcher});
        assert.equal(activated.bootMedia.romAt, romAt);
        let dispatched;
        const result = await runMachineConfig(twice, {fetcher, dispatch: detail => { dispatched = detail; }});
        assert.equal(dispatched.romAt, romAt);
        assert.equal(result.detail, dispatched);
        assert.equal(dispatched.bytes, bytes);
        assert.deepEqual(original.slots.rom, {url: 'local.rom', romAt});
    }
});

test('omitted ROM placement keeps default boot behavior and canonical slot shape', async () => {
    for (const rom of ['local.rom', {url: 'local.rom'}]) {
        const normalized = normalizeMachineConfig(config(rom));
        assert.deepEqual(normalized.slots.rom, {url: 'local.rom', sha256: null, geometry: null});
        const activated = await activateConfig(normalized, {fetcher});
        assert.equal(Object.hasOwn(activated.bootMedia, 'romAt'), false);
        const {detail} = await runMachineConfig(normalized, {fetcher, dispatch() {}});
        assert.equal(Object.hasOwn(detail, 'romAt'), false);
    }
});

test('non-numeric ROM placement keeps the existing downstream number-only contract', async () => {
    const normalized = normalizeMachineConfig(config({url: 'local.rom', romAt: '0xf0000'}));
    assert.equal(Object.hasOwn(normalized.slots.rom, 'romAt'), false);
    const activated = await activateConfig(normalized, {fetcher});
    assert.equal(Object.hasOwn(activated.bootMedia, 'romAt'), false);
});

test('machine configuration source and shipped mirror stay identical', () => {
    assert.equal(
        readFileSync(new URL('../overlay/scratch-gui/src/lib/bw-machines/machine-config.js', import.meta.url), 'utf8'),
        readFileSync(new URL('../packages/scratch-gui/src/lib/bw-machines/machine-config.js', import.meta.url), 'utf8')
    );
});

test('a 6502 library ROM carries its declared memory and device map to the runner', async () => {
    const machineConfig = {
        clockHz: 2_000_000,
        regions: [{kind: 'rom', start: 0x8000, end: 0xffff}],
        chips: [{kind: 'vdp', name: 'video', at: 0x4000}]
    };
    let dispatched;
    await runMachineConfig({machine: 'eater6502', machineConfig, slots: {rom: 'firmware.rom'}}, {
        fetcher, dispatch: detail => {dispatched = detail;}
    });
    assert.equal(dispatched.kind, 'eater6502');
    assert.deepEqual(dispatched.machineConfig6502, machineConfig);
});
