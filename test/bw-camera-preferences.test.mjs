// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';

test('3D camera preferences use shared defaults, migrate legacy choices, and persist explicit overrides', async () => {
    const data = new Map();
    const window = new EventTarget();
    globalThis.window = window;
    globalThis.localStorage = {
        getItem: key => data.get(key) ?? null,
        setItem: (key, value) => data.set(key, value)
    };
    try {
        const module = '../overlay/scratch-gui/src/lib/bw-camera-preferences.js';
        const prefs = await import(module);
        assert.deepEqual(prefs.getCameraPreferences(), {trackpadSlide: 'pan', secondaryDrag: 'orbit'});
        data.set('bw-sim-lab-wheel-mode', 'trackpad');
        data.set('bw-sim-lab-mouse-preset', 'brickwright');
        assert.deepEqual(prefs.getCameraPreferences(), {trackpadSlide: 'orbit', secondaryDrag: 'pan'});
        let emitted;
        window.addEventListener(prefs.CAMERA_PREFERENCES_EVENT, event => { emitted = event.detail; });
        prefs.setCameraPreference('trackpadSlide', 'invalid');
        assert.equal(emitted, undefined);
        prefs.setCameraPreference('trackpadSlide', 'zoom');
        assert.deepEqual(emitted, {trackpadSlide: 'zoom', secondaryDrag: 'pan'});
        const reloaded = await import(module + '?reload');
        assert.deepEqual(reloaded.getCameraPreferences(), emitted);
        localStorage.setItem = () => { throw new Error('quota'); };
        prefs.setCameraPreference('secondaryDrag', 'orbit');
        assert.deepEqual(prefs.getCameraPreferences(), {trackpadSlide: 'zoom', secondaryDrag: 'orbit'});
    } finally {
        delete globalThis.window;
        delete globalThis.localStorage;
    }
});
