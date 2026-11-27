// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// The Circuit tab's panels follow the Robot Lab's conventions (circuit-panels.jsx): named
// icon buttons with "name · what it does" tooltips, one scrolling header row, empty states
// that say what to do next. This pins the decisions (lib/circuit-panels-model.js) and the
// host wiring that keeps all of it off the first-load bundle.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CIRCUIT_PANELS, CIRCUIT_PANEL_TEXT, bomView, circuitPanelLabel, warningsBadge, warningsView} from
    '../overlay/scratch-gui/src/lib/circuit-panels-model.js';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const TAB = read('overlay/scratch-gui/src/components/tw-pseudocode/circuit-tab.jsx');
const PANELS = read('overlay/scratch-gui/src/components/tw-pseudocode/circuit-panels.jsx');

test('four panels, each with an English and a German name and help line', () => {
    assert.deepEqual(CIRCUIT_PANELS.map(p => p.id), ['designer', 'warnings', 'bom', 'examples']);
    for (const lang of ['en', 'de']) {
        assert.deepEqual(Object.keys(CIRCUIT_PANEL_TEXT[lang]).sort(), Object.keys(CIRCUIT_PANEL_TEXT.en).sort(), `${lang} has every key`);
    }
    // The browser gates and the Edit menu address the buttons by these English names.
    assert.deepEqual(CIRCUIT_PANELS.map(p => circuitPanelLabel('en', p.id).name), ['Designer', 'Circuit Check', 'Parts list', 'Examples']);
    assert.equal(circuitPanelLabel('de-CH', 'bom').name, 'Stückliste');
    assert.match(circuitPanelLabel('en', 'warnings').tooltip, /^Circuit Check · Design-rule check/);
});

test('warnings: a clean circuit, a check that could not run and a failure read differently', () => {
    const clean = warningsView('en', {warnings: []});
    assert.equal(clean.kind, 'empty');
    assert.equal(clean.tone, 'ok');
    assert.equal(clean.action, 'designer');
    assert.equal(warningsView('en', {error: 'noCircuit'}).tone, 'info');
    assert.doesNotMatch(warningsView('en', {error: 'noCircuit'}).message, /onCircuitReady/, 'no developer jargon for learners');
    const failed = warningsView('de', {error: 'failed', message: 'boom'});
    assert.equal(failed.tone, 'error');
    assert.match(failed.message, /fehlgeschlagen: boom/);
    assert.equal(warningsView('en', {error: 'noExport'}).action, null, 'nothing the learner can do about a build');
    const list = warningsView('en', {warnings: [{severity: 'danger'}]});
    assert.equal(list.kind, 'list');
});

test('the Warnings badge counts only real findings', () => {
    assert.equal(warningsBadge({error: 'noCircuit'}), null, 'never "0" for a check that did not run');
    assert.equal(warningsBadge({warnings: []}), null);
    assert.deepEqual(warningsBadge({warnings: [{severity: 'warning'}, {severity: 'danger'}]}), {count: 2, danger: true});
    assert.equal(warningsBadge({warnings: [{severity: 'info'}]}), null);
    assert.equal(warningsView('en', {warnings: [{severity: 'info'}]}).warnings.length, 1);
});

test('parts list: empty board offers the Designer and the examples; a full one offers the vendor CSV', () => {
    const ui = {generateBom: parts => parts.map(p => ({qty: 1, label: p.kind})), bomToCsv: rows => `qty,label\n${rows.map(r => `${r.qty},${r.label}`).join('\n')}`};
    assert.equal(bomView('en', null, null).action, null);
    assert.equal(bomView('en', ui, null).action, 'designer');
    const empty = bomView('en', ui, {parts: []});
    assert.equal(empty.kind, 'empty');
    assert.deepEqual([empty.action, empty.second], ['designer', 'examples']);
    const full = bomView('en', ui, {parts: [{kind: 'led'}]});
    assert.equal(full.kind, 'list');
    assert.equal(full.csv, 'qty,label\n1,led');
    assert.equal(bomView('en', {generateBom: ui.generateBom}, {parts: [{kind: 'led'}]}).csv, null);
});

test('the panels arrive with the designer, never on first load', () => {
    assert.match(TAB, /import\(\/\* webpackChunkName: "bw-circuit-panels" \*\/ '\.\/circuit-panels\.jsx'\)/);
    assert.doesNotMatch(TAB, /^import [^\n]*circuit-panels/m, 'a static import would put the panels on first load');
    assert.match(TAB, /this\.setState\(\{Designer: ui\.CircuitDesigner, ui, panels\}\)/, 'Designer and panels land in one update');
    assert.match(TAB, /panelNav=\{this\.renderPanelStrip\(\)\}/);
    // The designer speaks the app's language, as the Robot Lab does.
    assert.match(TAB, /lang=\{String\(this\.props\.locale \|\| 'en'\)\.slice\(0, 2\) === 'de' \? 'de' : 'en'\}/);
    // So do the vendor panels the host draws: the Warnings list words each finding, the
    // parts list its names, in the app's language.
    assert.match(PANELS, /const designerLang = locale => \(String\(locale \|\| 'en'\)\.slice\(0, 2\) === 'de' \? 'de' : 'en'\);/);
    assert.match(PANELS, /<ui\.DrcPanel warnings=\{view\.warnings\} lang=\{designerLang\(locale\)\} \/>/);
    assert.match(PANELS, /<ui\.BomPanel parts=\{circuit\.parts\} lang=\{designerLang\(locale\)\} \/>/);
    assert.match(PANELS, /<ui\.ExamplesBrowser[\s\S]*?lang=\{designerLang\(locale\)\} \/>/);
});

test('the panel header is one scrolling row, and the switch fits the designer toolbar slot', () => {
    assert.match(PANELS, /import ScrollRow from '\.\/toolbar-scroll-row\.jsx'/);
    assert.match(PANELS, /<ScrollRow testId="bw-circuit-panel-header"/);
    // 4 × 34 px + 3 × 2 px gaps = 142 px inside bw-circuit-ui's 150 px slot, 34 px tall.
    assert.match(PANELS, /width: 34, minWidth: 34, height: 34, padding: 0/);
    assert.match(PANELS, /gap: 2, padding: 0, borderRadius: 7,\s*background: '#e2e8f0', flex: '0 0 auto', height: 34/);
    assert.match(PANELS, /data-panel-navigation role="group"/);
    assert.match(PANELS, /aria-pressed=\{on\}/);
});
