// SPDX-License-Identifier: BSD-3-Clause
import test, {after, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import fixture from './helpers/sim-lab-pane-ux.cjs';
const {gui, load, paneClass, css, texts, source} = fixture;
const React = gui('react'), jsdom = gui('jsdom');
const document = jsdom.JSDOM ? new jsdom.JSDOM('<!doctype html><body></body>', {url: 'http://localhost'}).window.document : jsdom.jsdom('<!doctype html><body></body>');
globalThis.window = document.defaultView; globalThis.document = document;
Object.defineProperty(globalThis, 'navigator', {value: window.navigator, configurable: true});
window.requestAnimationFrame = cb => setTimeout(cb, 0); window.cancelAnimationFrame = clearTimeout;
const channel = globalThis.MessageChannel; globalThis.MessageChannel = undefined;
const ReactDOM = gui('react-dom'), {act} = gui('react-dom/test-utils'); globalThis.MessageChannel = channel;
let Notice = load('sim-lab-notice.jsx').default, Pane = paneClass(React, Notice);
after(() => window.close());
const sessionValues = new Map();
Object.defineProperty(window, 'sessionStorage', {configurable: true, value: {getItem: key => sessionValues.get(key) ?? null, setItem: (key,value) => sessionValues.set(key,String(value))}});
beforeEach(() => {
    sessionValues.clear();
    // Each test represents a fresh application session, including its in-memory fallback.
    Notice = load('sim-lab-notice.jsx').default; Pane = paneClass(React, Notice);
});
function mount(kind, compact, locale) {
    const pane = Object.create(Pane.prototype);
    pane.state = {status: 'ready', blockers: [], issues: []}; pane.compact = () => compact;
    pane.itext = texts[locale]; pane.text = {issues: locale === 'de' ? 'Hinweise zu diesem Modell' : 'Notes about this model'};
    pane.partNameById = id => pane.partNames?.[id] || id;
    const box = document.createElement('div'); document.body.appendChild(box);
    return {box, pane, render(items) {pane.state[kind] = items; act(() => {ReactDOM.render(kind === 'blockers' ? pane.renderBlockers() : pane.renderIssues(), box);});},
        close() {act(() => {ReactDOM.unmountComponentAtNode(box);}); box.remove();}};
}
for (const kind of ['blockers', 'issues']) for (const compact of [true, false]) {
    test(`${kind} ${compact ? 'compact' : 'wide'}: initially visible, X retains DOM, dismissal survives refresh; new diagnostic types remain visible`, () => {
        const v = mount(kind, compact, 'de');
        try {
            const first = [{code: 'no-motor', message: 'Motor fehlt', parts: ['a']}]; v.render(first);
            const notice = v.box.firstChild, warning = notice.firstChild, close = notice.querySelector('button[data-testid$="-close"]');
            assert.equal(notice.hidden, false); assert.equal(close.type, 'button'); assert.match(close.getAttribute('aria-label'), /^Schließen:/);
            assert.equal(close.querySelector('span').getAttribute('aria-hidden'), 'true'); assert.equal([...notice.querySelectorAll('summary')].some(summary => summary.contains(close)), false);
            act(() => close.click()); assert.equal(notice.hidden, true); assert.equal(notice.firstChild, warning);
            v.render(JSON.parse(JSON.stringify(first))); assert.equal(notice.hidden, true);
            v.render([{...first[0], message: 'Anderer Motor fehlt'}]);
            assert.equal(notice.hidden, false, 'changed diagnostic text reappears even when its code is unchanged');
            act(() => close.click());
            v.render([{code: 'no-hub', message: 'Hub fehlt'}]);
            assert.equal(notice.hidden, false, 'a different diagnostic remains visible');
        } finally {v.close();}
    });
}
test('English close label and native focusable close control', () => {
    const v = mount('issues', false, 'en'); try {
        v.render([{code: 'no-hub'}]); const close = v.box.querySelector('button[data-testid$="-close"]'); close.focus();
        assert.equal(document.activeElement, close); assert.equal(close.tabIndex, 0); assert.equal(close.getAttribute('aria-label'), 'Close: Notes about this model');
    } finally {v.close();}
});
test('pane root uses scoped CSS selection guard with native editable exceptions, no drag event guard', () => {
    assert.match(source, /ref=\{this.root\} className=\{paneStyles.root\}/);
    assert.match(css, /\.root\s*\{[^}]*-webkit-user-select:\s*none;[^}]*user-select:\s*none;/);
    assert.match(css, /\.root input,[\s\S]*\.root textarea,[\s\S]*contenteditable[\s\S]*user-select:\s*text/);
});

for (const kind of ['blockers', 'issues']) test(`${kind}: same-content dismissal survives remount; changed text reappears`, () => {
    const first = mount(kind, true, 'de'); first.render([{code: 'no-motor', message: 'Motor fehlt'}]);
    act(() => first.box.querySelector('button[data-testid$="-close"]').click()); first.close();
    const second = mount(kind, true, 'de');
    try {
        second.render([{code: 'no-motor', message: 'Motor fehlt'}]);
        assert.equal(second.box.firstChild.hidden, true);
        second.render([{code: 'no-motor', message: 'Anderer Motor fehlt'}]);
        assert.equal(second.box.firstChild.hidden, false);
        act(() => second.box.querySelector('button[data-testid$="-close"]').click());
        second.render([]); second.render([{code: 'no-motor', message: 'Anderer Motor fehlt'}]);
        assert.equal(second.box.firstChild.hidden, true);
        second.render([{code: 'no-hub'}]); assert.equal(second.box.firstChild.hidden, false);
        act(() => second.box.querySelector('button[data-testid$="-close"]').click());
        second.render([{code: 'no-motor', message: 'Motor fehlt'}]);
        assert.equal(second.box.firstChild.hidden, true, 'earlier dismissed content remains hidden after another dismissal');
    } finally {second.close();}
});

for (const kind of ['blockers', 'issues']) test(`${kind}: actual translated sentence and part label changes restore visibility`, () => {
    const v = mount(kind, false, 'en'), items = [{code: 'motor-without-port', parts: ['motor']}];
    try {
        v.pane.partNames = {motor: 'First motor'}; v.render(items);
        const firstSentence = v.box.querySelector('[data-testid="bw-sim-lab-issue"]').textContent;
        act(() => v.box.querySelector('button[data-testid$="-close"]').click());
        v.pane.partNames.motor = 'Renamed motor'; v.render(items);
        assert.notEqual(v.box.querySelector('[data-testid="bw-sim-lab-issue"]').textContent, firstSentence);
        assert.equal(v.box.firstChild.hidden, false, 'part display name changed');
        act(() => v.box.querySelector('button[data-testid$="-close"]').click());
        v.pane.itext = texts.de; v.pane.text.issues = 'Hinweise zu diesem Modell'; v.render(items);
        assert.equal(v.box.firstChild.hidden, false, 'localized warning text changed');
        act(() => v.box.querySelector('button[data-testid$="-close"]').click());
        v.render(items); assert.equal(v.box.firstChild.hidden, true);
    } finally {v.close();}
});

test('all dismissed content survives remount beyond 32 entries and 4096 characters', () => {
    const v = mount('issues', false, 'en');
    for (let n = 0; n < 40; n++) {
        v.render([{code: `warning-${n}`, message: 'x'.repeat(5000)}]); act(() => v.box.querySelector('button[data-testid$="-close"]').click());
    }
    v.close();
    const stored = JSON.parse(sessionValues.get('bw-robot-dismissed-notice:bw-sim-lab-issues'));
    assert.equal(stored.length, 40);
    const next = mount('issues', false, 'en');
    try {
        next.render([{code: 'warning-0', message: 'x'.repeat(5000)}]); assert.equal(next.box.firstChild.hidden, true);
        next.render([{code: 'new-warning'}]); assert.equal(next.box.firstChild.hidden, false);
    } finally {next.close();}
});

test('unavailable session storage preserves in-memory dismissal history', () => {
    const storage = window.sessionStorage;
    Object.defineProperty(window, 'sessionStorage', {configurable: true, value: {
        getItem() {throw new Error('storage unavailable');}, setItem() {throw new Error('quota exceeded');}
    }});
    const v = mount('issues', false, 'en');
    try {
        v.render([{code: 'first'}]); act(() => v.box.querySelector('button[data-testid$="-close"]').click());
        v.render([{code: 'second'}]); assert.equal(v.box.firstChild.hidden, false);
        act(() => v.box.querySelector('button[data-testid$="-close"]').click());
        v.render([{code: 'first'}]); assert.equal(v.box.firstChild.hidden, true);
        v.close();
        const remounted = mount('issues', false, 'en');
        try {
            remounted.render([{code: 'first'}]); assert.equal(remounted.box.firstChild.hidden, true);
            remounted.render([{code: 'third'}]); assert.equal(remounted.box.firstChild.hidden, false);
        } finally {remounted.close();}
    } finally {
        v.close(); Object.defineProperty(window, 'sessionStorage', {configurable: true, value: storage});
    }
});
