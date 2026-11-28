// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CAMERA_PREFERENCES_EVENT} from '../overlay/scratch-gui/src/lib/bw-camera-preferences.js';

const source = readFileSync(new URL('../overlay/scratch-gui/src/lib/bw-sim/editor/editor-view3d.js', import.meta.url), 'utf8');
// Run the shipped async paste closure and disposal's entry, without a renderer.
// The rest of disposal releases WebGL/DOM resources and is outside this boundary.
const lifetime = source.match(/^    let disposed = false;$/m)?.[0] || '';
const cancelPointer = source.match(/^    const cancelPointer = .*;$/m)?.[0] || '';
assert.ok(cancelPointer, 'the real pointer cancellation closure must be present');
const paste = source.slice(source.indexOf('    const paste = async () => {'), source.indexOf('    const undo = () => {'));
const dispose = source.slice(source.indexOf('    const dispose = () => {'), source.indexOf('        unsubscribe();', source.indexOf('    const dispose = () => {')));
const fixture = ({local = false, denied = false} = {}) => {
    const events = [];
    let resolve, reject;
    const read = new Promise((yes, no) => { resolve = yes; reject = no; });
    const navigator = {clipboard: {readText: () => {
        events.push('read');
        if (denied) throw Error('clipboard denied');
        return read;
    }}};
    const cancelled = [];
    const removedWindowListeners = new Map();
    const updateCameraGestures = () => {};
    const onNativeCameraInput = () => {};
    const api = new Function('navigator', 'clipboard', 'systemHasCopy', 'pasteText', 'onUp', 'window', 'canvas',
        'releaseSpace', 'lostCapture', 'CAMERA_PREFERENCES_EVENT', 'updateCameraGestures', 'onNativeCameraInput',
        `let spaceHeld = true, gesture = {touch: false, pointerId: 7}; ${lifetime} ${paste} ${cancelPointer} ${dispose}}; return {paste, dispose, spaceHeld: () => spaceHeld};`)(
        navigator, local ? [{}] : [], false, text => { events.push(['paste', text]); return true; },
        event => cancelled.push(event), {removeEventListener: (name, listener) => removedWindowListeners.set(name, listener)},
        {removeEventListener() {}}, () => {}, () => {}, CAMERA_PREFERENCES_EVENT, updateCameraGestures, onNativeCameraInput);
    return {...api, events, resolve, reject, cancelled, removedWindowListeners, updateCameraGestures, onNativeCameraInput};
};

for (const outcome of ['resolve', 'reject']) {
    test(`pending clipboard ${outcome} after closing the view does not paste`, async () => {
        const f = fixture();
        const pending = f.paste();
        assert.deepEqual(f.events, ['read']);
        f.dispose();
        outcome === 'resolve' ? f.resolve('external model') : f.reject(Error('permission denied'));
        assert.equal(await pending, false);
        assert.deepEqual(f.events, ['read']);
    });
}

test('a closed view refuses both clipboard reads and immediate local paste', async () => {
    for (const local of [false, true]) {
        const f = fixture({local});
        f.dispose();
        f.resolve('external model');
        assert.equal(await f.paste(), false);
        assert.deepEqual(f.events, []);
    }
});

test('an open view still pastes the completed clipboard read', async () => {
    const f = fixture();
    const pending = f.paste();
    f.resolve('external model');
    assert.equal(await pending, true);
    assert.deepEqual(f.events, ['read', ['paste', 'external model']]);
});

test('an open view keeps local and denied-clipboard fallbacks', async () => {
    for (const options of [{local: true}, {denied: true}, {}]) {
        const f = fixture(options);
        const pending = f.paste();
        if (!options.local && !options.denied) f.reject(Error('permission denied'));
        assert.equal(await pending, true);
        assert.deepEqual(f.events, options.local ? [['paste', null]] : ['read', ['paste', null]]);
    }
});

test('disposal cancels an active pointer and releases space before clipboard completion', () => {
    const f = fixture(); f.dispose();
    assert.equal(f.spaceHeld(), false);
    assert.deepEqual(f.cancelled, [{pointerId: 7, type: 'pointercancel'}]);
    assert.equal(f.removedWindowListeners.get(CAMERA_PREFERENCES_EVENT), f.updateCameraGestures);
    assert.equal(f.removedWindowListeners.get('brickwright-camera-input'), f.onNativeCameraInput);
});
