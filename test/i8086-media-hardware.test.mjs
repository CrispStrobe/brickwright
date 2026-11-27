// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import * as board from 'bw-board/i8086-machine.js';
import {i8086VirtualHardware, i8086CanUseBreadboard, isI8086Rom} from
    '../overlay/scratch-gui/src/lib/bw-debug/i8086-media-hardware.js';

test('every shipped ROM profile selects its matching virtual bus map', () => {
    for (const [profile, hardware] of Object.entries({
        blink: 'BLINK8086', cgademo: 'CGADEMO8086', deskdemo: 'DESKDEMO8086',
        egademo: 'EGADEMO8086', hercdemo: 'HERCDEMO8086', kbddemo: 'KBDDEMO8086',
        serialshell: 'SERIALSHELL8086', timerdemo: 'TIMERDEMO8086', vgademo: 'VGADEMO8086'
    })) assert.equal(i8086VirtualHardware(profile), board[hardware], profile);
    assert.equal(i8086VirtualHardware(null), board.PCXT8086);
    assert.ok(isI8086Rom({kind: 'i8088', slotId: 'rom'}));
    assert.equal(isI8086Rom({kind: 'i8086', slotId: 'com', profile: 'dos'}), false);
    assert.equal(isI8086Rom({kind: 'i80386', slotId: 'rom'}), false);
});

test('a wired boot requires the reset window and the ROM profile’s devices, addresses and IRQs', () => {
    const bytes = new Uint8Array(32768);
    const timer = {profile: 'timerdemo', bytes};
    const vga = {profile: 'vgademo', bytes};
    assert.ok(i8086CanUseBreadboard(board.TIMERDEMO8086, timer));
    assert.ok(i8086CanUseBreadboard(board.BLINK8086, {profile: 'blink', bytes}));
    assert.equal(i8086CanUseBreadboard(board.BLINK8086, vga), false);
    assert.equal(i8086CanUseBreadboard(board.TIMERDEMO8086, {...timer, romAt: 0xf7000}), false);
    const change = (kind, patch) => ({...board.TIMERDEMO8086, chips: board.TIMERDEMO8086.chips.map(chip =>
        chip.kind === kind ? {...chip, ...patch} : chip)});
    assert.equal(i8086CanUseBreadboard(change('pit', {irq: 1}), timer), false);
    assert.equal(i8086CanUseBreadboard(change('cga', {at: 0x3b0}), timer), false);
});

test('a fast key release cannot replace an XT key press awaiting IRQ1', async () => {
    const {createPcInputQueue} = await import(
        '../overlay/scratch-gui/src/lib/bw-machines/pc-input-queue.js');
    const delivered = [];
    let pending = false;
    const keyboard = createPcInputQueue(byte => {
        delivered.push(byte);
        pending = true;
    }, () => pending);
    assert.ok(keyboard.enqueue(0x2c));
    assert.ok(keyboard.enqueue(0xac));
    keyboard.pump();
    keyboard.pump();
    assert.deepEqual(delivered, [0x2c]);
    pending = false;
    keyboard.pump();
    assert.deepEqual(delivered, [0x2c, 0xac]);
    keyboard.enqueue(0x33);
    keyboard.clear();
    pending = false;
    keyboard.pump();
    assert.deepEqual(delivered, [0x2c, 0xac]);
});

test('serial delivery preserves a line across a single-byte receive register', async () => {
    const {createPcInputQueue} = await import('../overlay/scratch-gui/src/lib/bw-machines/pc-input-queue.js');
    let register = null;
    const queue = createPcInputQueue(byte => { register = byte; }, () => register !== null);
    assert.ok(queue.enqueue('HELLO\r'));
    assert.equal(queue.enqueue('x'.repeat(251)), false);
    const output = [];
    for (let index = 0; index < 6; index++) {
        queue.pump();
        queue.pump();
        output.push(register);
        register = null;
    }
    assert.equal(String.fromCharCode(...output), 'HELLO\r');
});
