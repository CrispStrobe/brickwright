// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {selectVdpExample} from '../scripts/lib/select-vdp-example.mjs';

test('selection waits for the actual example to become visible', async () => {
    let reveal;
    const ready = new Promise(resolve => { reveal = resolve; });
    const events = [];
    const input = {first () { return this; }, async fill (value) { events.push(`search:${value}`); }};
    const example = {first () { return this; }, async waitFor (options) { assert.equal(options.state, 'visible'); events.push('wait'); await ready; }, async click (options) { assert.ok(options.timeout > 0 && options.timeout <= 30000); events.push('click'); }};
    const page = {locator (selector) { return selector.startsWith('input') ? input : example; }};
    const pending = selectVdpExample(page);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(events, ['search:VDP', 'wait']);
    reveal(); await pending;
    assert.deepEqual(events, ['search:VDP', 'wait', 'click']);
});

test('an invisible example fails without clicking, even if search is unavailable', async () => {
    let clicked = false;
    const input = {first () { return this; }, async fill () { throw new Error('no search'); }};
    const example = {first () { return this; }, async waitFor () { throw new Error('not visible'); }, async click () { clicked = true; }};
    await assert.rejects(selectVdpExample({locator: selector => selector.startsWith('input') ? input : example}), /not visible/);
    assert.equal(clicked, false);
});
