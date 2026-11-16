import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {focusSubmenuIfStillOnOpener} from '../overlay/scratch-gui/src/lib/menu-keyboard.js';

// Execute the component's own handler without a browser or a second handler implementation.
const source = readFileSync(new URL('../overlay/scratch-gui/src/components/menu/menu.jsx', import.meta.url), 'utf8');
const handler = source.match(/onKeyDown=\{event => \{([\s\S]*?)\n            \}\}\n            onClick=/)?.[1];
assert.ok(handler, 'actual MenuItem keyboard handler must be present');
const keyboard = new Function('disabled', 'hasSubmenu', 'setKeyboardClosed', 'setKeyboardOpen',
    'requestAnimationFrame', 'focusSubmenuIfStillOnOpener', 'ref', `return event => {${handler}}`);

const setup = () => {
    const frames = [];
    const document = {activeElement: null};
    const menu = {querySelectorAll: () => items};
    const item = name => ({name, closest: () => menu, getAttribute: () => null,
        focus () { document.activeElement = this; }, scrollIntoView () {}});
    const items = [item('Paint'), item('Walls')];
    const outside = item('Outside');
    const state = {open: false, closed: true};
    const parent = {ownerDocument: document, querySelector: () => menu, isConnected: true,
        getAttribute: name => name === 'aria-expanded' ? String(state.open && !state.closed) : null};
    document.activeElement = parent;
    const ref = {current: parent};
    const keydown = keyboard(false, true, value => {state.closed = value;}, value => {state.open = value;},
        callback => frames.push(callback), focusSubmenuIfStillOnOpener, ref);
    const event = {key: 'ArrowRight', target: parent, currentTarget: parent,
        preventDefault () {}, stopPropagation () {}};
    keydown(event);
    assert.deepEqual(state, {open: true, closed: false});
    assert.equal(frames.length, 1);
    return {document, parent, paint: items[0], walls: items[1], outside, ref, state,
        flush: () => frames.shift()()};
};

test('submenu opening focuses its first enabled item after rendering', () => {
    const s = setup();
    s.flush();
    assert.equal(s.document.activeElement, s.paint);
});

test('submenu deferred opening preserves a later intentional item focus', () => {
    const s = setup();
    s.walls.focus();
    s.flush();
    assert.equal(s.document.activeElement, s.walls);
});

test('submenu deferred opening preserves focus moved outside the menu', () => {
    const s = setup();
    s.outside.focus();
    s.flush();
    assert.equal(s.document.activeElement, s.outside);
});


test('submenu closed before its frame keeps focus on the parent', () => {
    const s = setup();
    s.state.closed = true;
    s.flush();
    assert.equal(s.document.activeElement, s.parent);
});

test('submenu unmounted before its frame leaves outside focus intact', () => {
    const s = setup();
    s.parent.isConnected = false;
    s.ref.current = null;
    s.outside.focus();
    s.flush();
    assert.equal(s.document.activeElement, s.outside);
});

test('submenu frame does not target a replacement parent ref', () => {
    const s = setup();
    const replacement = {...s.parent};
    s.ref.current = replacement;
    s.document.activeElement = replacement;
    s.flush();
    assert.equal(s.document.activeElement, replacement);
});
