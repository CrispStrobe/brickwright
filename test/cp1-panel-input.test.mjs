import test from 'node:test';
import assert from 'node:assert/strict';
import {CP1_LOGICAL_KEYS, CP1_PHYSICAL_KEYS, createCp1KeyInput, cp1KeyForKeyboard, cp1KeyboardOwner,
    cp1DisplayDigits, cp1SegmentDescription, readCp1PanelSnapshot} from '../overlay/scratch-gui/src/lib/cp1-panel-input.js';

test('30 physical CP1 buttons share exactly 20 logical contacts', () => {
    assert.equal(CP1_LOGICAL_KEYS.length, 20);
    assert.equal(CP1_PHYSICAL_KEYS.length, 30);
    assert.equal(new Set(CP1_PHYSICAL_KEYS.map(key => key.id)).size, 30);
    assert.deepEqual(new Set(CP1_PHYSICAL_KEYS.map(key => key.key)), new Set(CP1_LOGICAL_KEYS));
    for (let digit = 0; digit < 10; digit++) assert.equal(CP1_PHYSICAL_KEYS.filter(key => key.key === String(digit)).length, 2);
});

test('two digit buttons and a keyboard hold the same contact until the last owner releases', () => {
    const events = [];
    const keys = createCp1KeyInput((key, down) => events.push([key, down]));
    keys.press('4', 'pointer:1');
    keys.press('4', 'pointer:2');
    keys.press('4', 'keyboard:Digit4');
    keys.press('4', 'keyboard:Digit4');
    assert.deepEqual(events, [['4', true]], 'repeat keydown is not a second closure');
    keys.release('pointer:1');
    keys.release('keyboard:Digit4');
    assert.equal(keys.isHeld('4'), true);
    assert.deepEqual(events, [['4', true]]);
    keys.release('pointer:2');
    assert.deepEqual(events, [['4', true], ['4', false]]);
    assert.equal(keys.isHeld('4'), false);
});

test('cancel, blur, visibility loss and unmount can release all contacts idempotently', () => {
    const events = [];
    const keys = createCp1KeyInput((key, down) => events.push([key, down]));
    keys.press('run', 'keyboard:Enter');
    keys.press('1', 'pointer:1');
    keys.press('1', 'pointer:2');
    keys.releaseAll();
    keys.releaseAll();
    keys.release('pointer:1');
    assert.deepEqual(events, [['RUN', true], ['1', true], ['RUN', false], ['1', false]]);
    assert.deepEqual(keys.heldKeys(), []);
    keys.press('1', 'pointer:1');
    keys.press('2', 'pointer:1');
    assert.deepEqual(events.slice(-3), [['1', true], ['1', false], ['2', true]]);
    assert.throws(() => keys.press('RESET', 'key'), RangeError);
    assert.throws(() => keys.press('RUN'), TypeError);
});

test('React 16 keyboard owners preserve separate digit and numpad holds through native keyup', () => {
    const events = [];
    const keys = createCp1KeyInput((key, down) => events.push([key, down]));
    for (const code of ['Digit4', 'Numpad4']) {
        const event = {key: '4', nativeEvent: {key: '4', code}};
        keys.press(cp1KeyForKeyboard(event), cp1KeyboardOwner(event));
    }
    assert.deepEqual(events, [['4', true]]);
    // A modifier may change key between down and up; the physical code is stable.
    keys.release(cp1KeyboardOwner({key: '$', code: 'Digit4'}));
    assert.deepEqual(keys.heldKeys(), ['4'], 'the numpad owner must remain held');
    keys.release(cp1KeyboardOwner({key: '4', code: 'Numpad4'}));
    assert.deepEqual(keys.heldKeys(), []);
    assert.deepEqual(events, [['4', true], ['4', false]]);
});

test('keyboard ownership also accepts modern synthetic events and code-less native events', () => {
    const keys = createCp1KeyInput(() => {});
    keys.press('RUN', cp1KeyboardOwner({key: 'Enter', code: 'NumpadEnter', nativeEvent: {code: 'NumpadEnter'}}));
    keys.release(cp1KeyboardOwner({key: 'Enter', code: 'NumpadEnter'}));
    assert.deepEqual(keys.heldKeys(), []);
    keys.press('STP', cp1KeyboardOwner({key: 'Escape', nativeEvent: {key: 'Escape'}}));
    keys.release(cp1KeyboardOwner({key: 'Escape'}));
    assert.deepEqual(keys.heldKeys(), []);
});

test('keyboard mappings keep browser modifier shortcuts out of CP1 input', () => {
    assert.equal(cp1KeyForKeyboard({key: '0'}), '0');
    assert.equal(cp1KeyForKeyboard({key: 'F1'}), 'CAS');
    assert.equal(cp1KeyForKeyboard({key: 'F10'}), 'INP');
    assert.equal(cp1KeyForKeyboard({key: 'F11'}), null);
    assert.equal(cp1KeyForKeyboard({key: 'Enter'}), 'RUN');
    assert.equal(cp1KeyForKeyboard({key: 'Escape'}), 'STP');
    assert.equal(cp1KeyForKeyboard({key: 'Backspace'}), 'CLR');
    for (const flag of ['ctrlKey', 'altKey', 'metaKey']) assert.equal(cp1KeyForKeyboard({key: '1', [flag]: true}), null);
});

test('raw segment masks preserve letters, blank digits and decimal points without numeric inference', () => {
    const raw = [0x79, 0x50, 0x80, 0, 0x3f, 0xff];
    const view = cp1DisplayDigits({digits: raw});
    assert.deepEqual(view, raw);
    view[0] = 0;
    assert.equal(raw[0], 0x79);
    assert.equal(cp1SegmentDescription(0x80), 'dp');
    assert.equal(cp1SegmentDescription(0x79), 'a, d, e, f, g');
    assert.deepEqual(cp1DisplayDigits(null), [0, 0, 0, 0, 0, 0]);
});

test('panel snapshot helper only reads engine observations and never advances or writes the machine', () => {
    const snapshot = {display: {digits: [1, 2, 3, 4, 5, 6]}, cells: [{opcode: 4, operand: 1}]};
    const forbidden = () => {throw new Error('view attempted execution or mutation');};
    const machine = {snapshot: () => structuredClone(snapshot), step: forbidden, advanceCycles: forbidden,
        loadProgram: forbidden, writeCell: forbidden, setKey: forbidden};
    assert.deepEqual(readCp1PanelSnapshot(machine), snapshot);
    assert.equal(readCp1PanelSnapshot(null), null);
    const fallback = readCp1PanelSnapshot({expansion: true, getDisplay: () => snapshot.display,
        readCell: address => ({opcode: 0, operand: address}), step: forbidden});
    assert.equal(fallback.cells.length, 256);
    assert.deepEqual(fallback.cells[255], {opcode: 0, operand: 255});
});
