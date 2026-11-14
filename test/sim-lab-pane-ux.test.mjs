// SPDX-License-Identifier: BSD-3-Clause
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fixture from './helpers/sim-lab-pane-ux.cjs';
const {gui, load, paneClass, css, texts, source} = fixture;
const React = gui('react'), jsdom = gui('jsdom');
const document = jsdom.JSDOM ? new jsdom.JSDOM('<!doctype html><body></body>').window.document : jsdom.jsdom('<!doctype html><body></body>');
globalThis.window = document.defaultView; globalThis.document = document;
Object.defineProperty(globalThis, 'navigator', {value: window.navigator, configurable: true});
window.requestAnimationFrame = cb => setTimeout(cb, 0); window.cancelAnimationFrame = clearTimeout;
const channel = globalThis.MessageChannel; globalThis.MessageChannel = undefined;
const ReactDOM = gui('react-dom'), {act} = gui('react-dom/test-utils'); globalThis.MessageChannel = channel;
const Notice = load('sim-lab-notice.jsx').default, Pane = paneClass(React, Notice);
after(() => window.close());
function mount(kind, compact, locale) {
    const pane = Object.create(Pane.prototype);
    pane.state = {status: 'ready', blockers: [], issues: []}; pane.compact = () => compact;
    pane.itext = texts[locale]; pane.text = {issues: locale === 'de' ? 'Hinweise zu diesem Modell' : 'Notes about this model'};
    pane.renderIssue = (issue, key) => React.createElement('li', {key}, issue.message || issue.code);
    const box = document.createElement('div'); document.body.appendChild(box);
    return {box, render(items) {pane.state[kind] = items; act(() => {ReactDOM.render(kind === 'blockers' ? pane.renderBlockers() : pane.renderIssues(), box);});},
        close() {act(() => {ReactDOM.unmountComponentAtNode(box);}); box.remove();}};
}
for (const kind of ['blockers', 'issues']) for (const compact of [true, false]) {
    test(`${kind} ${compact ? 'compact' : 'wide'}: initially visible, X retains DOM, same content stays hidden and changed content reappears`, () => {
        const v = mount(kind, compact, 'de');
        try {
            const first = [{code: 'no-motor', message: 'Motor fehlt', parts: ['a']}]; v.render(first);
            const notice = v.box.firstChild, warning = notice.firstChild, close = notice.querySelector('button');
            assert.equal(notice.hidden, false); assert.equal(close.type, 'button'); assert.match(close.getAttribute('aria-label'), /^Schließen:/);
            assert.equal(close.querySelector('span').getAttribute('aria-hidden'), 'true'); assert.equal([...notice.querySelectorAll('summary')].some(summary => summary.contains(close)), false);
            act(() => close.click()); assert.equal(notice.hidden, true); assert.equal(notice.firstChild, warning);
            v.render(JSON.parse(JSON.stringify(first))); assert.equal(notice.hidden, true);
            v.render([{...first[0], message: 'Anderer Motor fehlt'}]); assert.equal(notice.hidden, false);
            act(() => close.click()); v.render(first); assert.equal(notice.hidden, false, 'returning warning after a different warning is new content');
        } finally {v.close();}
    });
}
test('English close label and native focusable close control', () => {
    const v = mount('issues', false, 'en'); try {
        v.render([{code: 'no-hub'}]); const close = v.box.querySelector('button'); close.focus();
        assert.equal(document.activeElement, close); assert.equal(close.tabIndex, 0); assert.equal(close.getAttribute('aria-label'), 'Close: Notes about this model');
    } finally {v.close();}
});
test('pane root uses scoped CSS selection guard with native editable exceptions, no drag event guard', () => {
    assert.match(source, /ref=\{this.root\} className=\{paneStyles.root\}/);
    assert.match(css, /\.root\s*\{[^}]*-webkit-user-select:\s*none;[^}]*user-select:\s*none;/);
    assert.match(css, /\.root input,[\s\S]*\.root textarea,[\s\S]*contenteditable[\s\S]*user-select:\s*text/);
});
