/**
 * The CAD tab's runtime opt-in: it must persist, notify, and default OFF.
 * The tab ships hidden even when its code is bundled, so a wrong default here
 * would show an advanced surface to everyone.
 *
 * The module caches a session value once it is set, so the storage-read tests
 * run FIRST, before any set() poisons that cache.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {getCadEnabled, setCadEnabled, CAD_ENABLED_KEY, CAD_TOGGLE_EVENT}
    from '../overlay/scratch-gui/src/lib/bw-cad-preferences.js';

function browser (store = {}) {
    const events = [];
    globalThis.localStorage = store === null ? undefined : {
        getItem: k => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); }
    };
    globalThis.window = {dispatchEvent: e => events.push(e)};
    globalThis.CustomEvent = class { constructor (type, opts) { this.type = type; this.detail = opts && opts.detail; } };
    return events;
}

test('with no stored value the tab is OFF (reads storage, session cache unset)', () => {
    browser({});
    assert.equal(getCadEnabled(), false);
});

test('a value that is not exactly "1" reads as OFF', () => {
    browser({[CAD_ENABLED_KEY]: 'true'});
    assert.equal(getCadEnabled(), false, 'only "1" means on; anything else is off');
});

test('setCadEnabled persists "1"/"0", notifies, and getCadEnabled round-trips', () => {
    const store = {};
    const events = browser(store);
    assert.equal(setCadEnabled(true), true, 'persisted to storage');
    assert.equal(store[CAD_ENABLED_KEY], '1', 'enabled is stored as exactly "1"');
    assert.equal(getCadEnabled(), true);
    assert.equal(events.at(-1).type, CAD_TOGGLE_EVENT);
    assert.deepEqual(events.at(-1).detail, {enabled: true}, 'the tab list learns the new value from the event');

    setCadEnabled(false);
    assert.equal(store[CAD_ENABLED_KEY], '0');
    assert.equal(getCadEnabled(), false);
    assert.deepEqual(events.at(-1).detail, {enabled: false});
});

test('with storage unavailable, the toggle still notifies but reports not-persisted', () => {
    const events = browser(null);
    assert.equal(setCadEnabled(true), false, 'no storage means not persisted');
    assert.equal(events.at(-1).detail.enabled, true, 'but the app is still told, for this tab');
});
