// SPDX-License-Identifier: BSD-3-Clause
// Exercise the real browser-gate predicates and public-tab sequence. This is a
// gate regression test; the full production application still runs in Chromium
// in the dedicated production job.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../scripts/verify-crispbasic-production.mjs', import.meta.url), 'utf8');
function section(text, start, end) {
    const first = text.indexOf(start), last = text.indexOf(end, first);
    assert.ok(first >= 0 && last > first, `gate boundary: ${start}`);
    return text.slice(first, last);
}
const statusMethods = section(source, 'async function codeStatus (', 'async function runSource (');
const cadMethod = section(source, 'async function openCadRobot (', 'async function connectCadSource (');

function statusFixture(text = statusMethods) {
    const editor = {dataset: {codeOperationStatus: 'Completed.'}};
    const run = {disabled: false};
    let stop = null;
    const document = {querySelector(selector) {
        if (selector === '[data-testid="bw-code-editor"]') return editor;
        if (selector === '[data-testid="bw-basic-run"]') return run;
        if (selector === '[data-testid="bw-crispbasic-stop"]') return stop;
        return null; // Info is closed: no bw-code-status element is mounted.
    }};
    const page = {
        getByTestId(id) {
            assert.equal(id, 'bw-code-editor');
            return {async getAttribute(name) {
                assert.equal(name, 'data-code-operation-status');
                return editor.dataset.codeOperationStatus ?? null;
            }};
        },
        async waitForFunction(predicate, argument) { return Boolean(predicate(argument)); }
    };
    // Functions are declarations in the context; return them without changing
    // their browser predicates or giving them an alternate state source.
    const api = new Function('document', `${text}\nreturn {codeStatus, waitForCodeStatus, finished};`)(document);
    return {...api, page, editor, run, setStop(value) { stop = value; }};
}

test('production completion observes the published status with Info closed and requires idle controls', async () => {
    const f = statusFixture();
    let result;
    f.page.waitForFunction = async predicate => { result = Boolean(predicate()); };
    await f.finished(f.page); assert.equal(result, true);
    f.run.disabled = true;
    await f.finished(f.page); assert.equal(result, false);
    f.run.disabled = false; f.setStop({});
    await f.finished(f.page); assert.equal(result, false);
    f.setStop(null); f.editor.dataset.codeOperationStatus = 'CrispBASIC is running.';
    await f.finished(f.page); assert.equal(result, false);
    f.editor.dataset.codeOperationStatus = 'CrispBASIC stopped.';
    await f.finished(f.page); assert.equal(result, true);
    delete f.editor.dataset.codeOperationStatus;
    await f.finished(f.page); assert.equal(result, false);
});

test('production refusal waits and result reads use the same current operation status', async () => {
    const f = statusFixture();
    let result;
    f.page.waitForFunction = async (predicate, argument) => { result = Boolean(predicate(argument)); };
    f.editor.dataset.codeOperationStatus = 'To blocks cannot preserve PROCdigitalToggle';
    await f.waitForCodeStatus(f.page, /To blocks cannot preserve/); assert.equal(result, true);
    assert.match(await f.codeStatus(f.page), /PROCdigitalToggle/);
    await f.waitForCodeStatus(f.page, 'Blocks loaded.'); assert.equal(result, false);
    f.editor.dataset.codeOperationStatus = 'Blocks loaded.';
    await f.waitForCodeStatus(f.page, 'Blocks loaded.'); assert.equal(result, true);
    await f.waitForCodeStatus(f.page, /To blocks cannot preserve/); assert.equal(result, false);
});

async function runCadSequence(text = cadMethod) {
    const actions = [];
    const gui = {vm: {runtime: {circuitBoard: {parts: []}, circuitModel: {}}}};
    const window = {__circuit: {}, __board: gui.vm.runtime.circuitBoard,
        __brickwrightStore: {getState: () => ({scratchGui: gui})},
        __bwCad: {editor: {session: {state: {document: {id: 'robot-tt-rover'}, revision: 2},
            serialize: () => 'unchanged CAD document'}, whenIdle: async () => {}}}};
    let uploaded = false;
    const control = {async click() {}, async waitFor() {}, first() { return this; },
        async evaluateAll() { throw new Error('use a named real control'); }};
    const page = {
        getByRole(role, {name}) {
            assert.equal(role, 'tab');
            return {async click() {
                actions.push(`tab:${String(name)}`);
                if (String(name) === '/Circuit/' && uploaded) {
                    gui.vm.runtime.circuitBoard = {parts: ['uno', 'left', 'right'].map(id => ({id}))};
                    window.__board = gui.vm.runtime.circuitBoard;
                }
            }};
        },
        getByTestId() { return {...control, getByRole(role, {name}) {
            return {...control, async evaluateAll() {
                return name === 'Circuit motor' ? ['left', 'right'] : ['drive-a', 'drive-b'];
            }};
        }}; },
        getByText() { return control; },
        async waitForEvent() { return {async setFiles() {
            actions.push('upload'); uploaded = true;
            gui.projectTitle = 'scout-encoder';
            gui.projectState = {loadingState: 'SHOWING_WITHOUT_ID'};
            gui.vm.runtime.circuitBoard = null; window.__board = null;
        }}; },
        async waitForFunction(predicate, argument) {
            assert.equal(Boolean(predicate(argument)), true, 'gate waited before opening the replacement Circuit');
        },
        async evaluate(predicate) { return predicate(); }
    };
    const open = new Function('window', 'assert', 'cadPayload', 'codeTab', `${text}\nreturn openCadRobot;`)(
        window, assert, async () => ({project: Buffer.from('uploaded archive'), source: 'PRINT "CAD"'}),
        async () => actions.push('tab:Code'));
    const result = await open(page);
    assert.equal(result.design.text, 'unchanged CAD document');
    return actions;
}

test('CAD qualification reopens Circuit after the successful SB3 upload before requiring its live board', async () => {
    assert.deepEqual(await runCadSequence(), ['tab:/Circuit/', 'upload', 'tab:/Circuit/', 'tab:CAD', 'tab:Code']);
});

test('the CAD gate regression control detects omitting the post-upload Circuit activation', async () => {
    const start = cadMethod.indexOf("    await (await chooser).setFiles(");
    const old = "    await page.getByRole('tab', {name: /Circuit/}).click();\n";
    const mutated = cadMethod.slice(0, start) + cadMethod.slice(start).replace(old, '');
    assert.notEqual(mutated, cadMethod);
    await assert.rejects(runCadSequence(mutated), /before opening the replacement Circuit/);
});
