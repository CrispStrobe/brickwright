// SPDX-License-Identifier: BSD-3-Clause
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDebugTarget} from 'bw-board';
import createEmu8051 from '../overlay/scratch-gui/src/lib/emu8051/emu8051.js';
import {DEVICE_GROUPS} from '../overlay/scratch-gui/src/lib/bw-matrix/capabilities.js';
import {selectDebugTargetKind} from '../overlay/scratch-gui/src/lib/bw-debug/debug-runner.js';

const deviceChoices = DEVICE_GROUPS.flatMap(group => group.devices);
const avrCases = {
    'arduino-uno': {pin: 'D13', ddr: 4, port: 5, bit: 5, flash: 32768},
    'arduino-nano': {pin: 'D13', ddr: 4, port: 5, bit: 5, flash: 32768},
    'arduino-mega': {pin: 'D13', ddr: 4, port: 5, bit: 7, flash: 262144},
    atmega328p: {pin: 'D13', ddr: 4, port: 5, bit: 5, flash: 32768},
    atmega168p: {pin: 'D13', ddr: 4, port: 5, bit: 5, flash: 16384},
    attiny88: {pin: 'PB0', ddr: 4, port: 5, bit: 0, flash: 8192},
    attiny85: {pin: 'PB0', ddr: 0x17, port: 0x18, bit: 0, flash: 8192}
};

function pinProbe () {
    const changes = [];
    return {
        changes,
        setPin: (pin, mode, high) => changes.push({pin, mode, high}),
        advanceTo () {},
        readPin () { return 1; },
        readAnalog () { return 0; }
    };
}

for (const {id} of deviceChoices.filter(device => device.emulator === 'emu8051')) {
    test(`${id} executes its 8051 firmware and drives P1.0 low and high`, async () => {
        const wasm = await createEmu8051();
        const board = pinProbe();
        // MOV P1,#FEh; MOV R7,#0; DJNZ R7,$; MOV P1,#FFh; SJMP $.
        // Hold each level long enough for the production polling bridge.
        const {adapter} = await createDebugTarget(selectDebugTargetKind(id), {
            wasm, board, part: id, hex: ':0C0000007590FE7F00DFFE7590FF80FE13\n:00000001FF\n'
        });
        adapter.runNs(10_000_000);
        const levels = board.changes.filter(record => record.pin === 'P1.0').map(record => Boolean(record.high));
        assert.deepEqual(new Set(levels), new Set([false, true]));
    });
}

const avrDevices = deviceChoices.filter(device => ['avr8js', 'attiny88', 'attiny85'].includes(device.emulator));
assert.deepEqual(avrDevices.map(device => device.id).sort(), Object.keys(avrCases).sort());

for (const {id} of avrDevices) {
    test(`${id} executes firmware with the selected flash size and changes a GPIO`, async () => {
        const {pin, ddr, port, bit, flash} = avrCases[id];
        const board = pinProbe();
        const {adapter} = await createDebugTarget(selectDebugTargetKind(id), {
            board, chip: id === 'atmega168p' ? id : undefined
        });
        assert.equal(adapter.cpu.progMem.byteLength, flash);
        const sbi = (address, offset) => 0x9a00 | (address << 3) | offset;
        const cbi = (address, offset) => 0x9800 | (address << 3) | offset;
        adapter.loadProgram(Uint16Array.of(sbi(ddr, bit), sbi(port, bit), cbi(port, bit), 0xcffd));
        adapter.advanceNs(100_000);
        const levels = board.changes.filter(record => record.pin === pin && record.mode === 'pushpull')
            .map(record => record.high);
        assert.deepEqual(new Set(levels), new Set([false, true]));
    });
}
