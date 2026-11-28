// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
// G03: a saved Python view whose conversion to Pseudocode fails must not be a
// dead end; the learner gets an explicit way into an empty Pseudocode editor.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {codeDocumentEditorClass} from './helpers/code-document-editor.mjs';

const source = readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx', import.meta.url), 'utf8');
const method = name => {
    const begin = source.indexOf(`\n    ${name} (`);
    assert.ok(begin >= 0, name);
    const end = source.indexOf('\n    }\n', begin);
    return source.slice(begin + 1, end + 6).trim();
};
const hasOpen = source.includes('\n    openEmptyTab (');
const body = [method('switchTab'), ...(hasOpen ? [method('openEmptyTab')] : [])].join('\n');
const Pane = codeDocumentEditorClass(source, body);
const pane = (deriveResult) => {
    const p = new Pane();
    Object.assign(p, {
        props: {vm: {}},
        state: {lang: 'python', busy: false, status: '', driverMode: 'shim', asyncMode: false,
            eventsMode: false, jsExecution: 'classic',
            buffers: {python: 'import hub\nhub.light_matrix.show_image("HAPPY")\n', pseudocode: ''}},
        L: {stConverting: to => `Converting to ${to}…`, stCantShow: (to, e) => `Can't show as ${to}: ${e}`},
        leaveCp1 () {},
        detachCardiac () {},
        deriveBuffer: async () => deriveResult,
        setState (patch) { Object.assign(this.state, typeof patch === 'function' ? patch(this.state) : patch); }
    });
    return p;
};
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

test('a failed conversion keeps Python and offers an empty Pseudocode editor', async () => {
    const p = pane({error: 'unsupported construct'});
    p.switchTab('pseudocode'); await settle();
    assert.equal(p.state.lang, 'python');
    assert.match(p.state.status, /Can't show as pseudocode/);
    assert.equal(p.state.emptyTabOffer, 'pseudocode');
    assert.equal(typeof p.openEmptyTab, 'function');
    p.openEmptyTab('pseudocode');
    assert.equal(p.state.lang, 'pseudocode');
    assert.equal(p.state.buffers.pseudocode, '');
    assert.match(p.state.buffers.python, /light_matrix/, 'The Python source is kept');
    assert.equal(p.state.status, '');
    assert.equal(p.state.emptyTabOffer, null);
});

test('the offer is only usable for the tab whose conversion failed and not while busy', async () => {
    const p = pane({error: 'unsupported construct'});
    p.switchTab('pseudocode'); await settle();
    p.openEmptyTab('javascript');
    assert.equal(p.state.lang, 'python');
    p.state.busy = true; p.openEmptyTab('pseudocode');
    assert.equal(p.state.lang, 'python');
});

test('a successful conversion still switches with the converted code and no offer', async () => {
    const p = pane({code: 'WHEN flag clicked\n'});
    p.switchTab('pseudocode'); await settle();
    assert.equal(p.state.lang, 'pseudocode');
    assert.equal(p.state.buffers.pseudocode, 'WHEN flag clicked\n');
    assert.equal(p.state.emptyTabOffer ?? null, null);
});
