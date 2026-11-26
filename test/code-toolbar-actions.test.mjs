// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TOOLBAR_ACTIONS, toolbarActionApplies} from '../overlay/scratch-gui/src/lib/code-toolbar-actions.js';

const importer = readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx', import.meta.url), 'utf8');
const scrollRow = readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/toolbar-scroll-row.jsx', import.meta.url), 'utf8');

test('SPIKE-only actions are hidden for every non-SPIKE device, even with the SPIKE extension loaded', () => {
    for (const device of ['arcade', 'microbit', 'calliopemini', 'pico', 'pybadge', 'ev3']) {
        for (const id of Object.keys(TOOLBAR_ACTIONS)) {
            assert.equal(toolbarActionApplies(id, {device, evidence: true}), false, `${id} on ${device}`);
        }
    }
});

test('SPIKE actions show for a SPIKE project', () => {
    for (const id of Object.keys(TOOLBAR_ACTIONS)) {
        assert.equal(toolbarActionApplies(id, {device: 'spike'}), true, id);
    }
});

test('with no target the arena and USB controls need evidence of a SPIKE hub', () => {
    assert.equal(toolbarActionApplies('spike-arena', {device: null}), false);
    assert.equal(toolbarActionApplies('spike-arena', {device: null, evidence: true}), true);
    assert.equal(toolbarActionApplies('spike-usb', {device: null}), false);
    assert.equal(toolbarActionApplies('spike-usb', {device: null, evidence: true}), true);
});

test('an id that is not in the table always applies, so a typo shows a button instead of hiding one', () => {
    assert.equal(toolbarActionApplies('no-such-action', {device: 'arcade'}), true);
});

test('the importer asks the table for every SPIKE-only button', () => {
    for (const id of ['spike-arena', 'spike-usb', 'spike-nuttx', 'spike-firmware']) {
        assert.match(importer, new RegExp(`applies\\('${id}'\\)`), id);
    }
    assert.match(importer, /_makeCodeProject && this\._makeCodeProject\.target\) \|\| this\.currentDevice\(\)/);
});

test('the toolbar is one non-wrapping row with Maximize pinned, and measures nothing', () => {
    assert.match(importer, /<ScrollRow testId="bw-lang-row"/);
    assert.match(importer, /data-testid="bw-editor-maximize"/);
    assert.match(scrollRow, /flexWrap: 'nowrap'/);
    assert.match(scrollRow, /overflowX: 'auto'/);
    assert.doesNotMatch(scrollRow, /ResizeObserver|getBoundingClientRect\(\)\.width/);
});

test('the Code actions menu closes on pick, on a file or example choice, and Popup closes on focus leaving', () => {
    const menu = importer.slice(importer.indexOf('    renderActionMenu (csel, renderCodeControls) {'), importer.indexOf('    renderActionMenu (csel, renderCodeControls) {') + 900);
    assert.doesNotMatch(menu, /closeOnPick=\{false\}/);
    assert.match(importer, /onChange=\{event => \{ this\.setState\(\{actionsOpen: false\}\); this\.openCodeFile\(event\); \}\}/);
    assert.match(importer, /onChange=\{e => \{ this\.setState\(\{actionsOpen: false\}\); this\.loadExample\(e\.target\.value\); \}\}/);
    const popup = readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/sim-lab-toolbar.jsx', import.meta.url), 'utf8');
    assert.match(popup, /onClose\('blur'\)/);
    assert.match(popup, /\[aria-expanded\], \[data-keep-open\]/);
});
