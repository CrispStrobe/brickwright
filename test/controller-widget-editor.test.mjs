/**
 * THE WIDGET EDITOR'S REMOVE CONTROL, ITS BOX, AND THE BINDING TOGGLE.
 *
 * Four defects the owner reported from using the app, three of which turned out
 * to share machinery.
 *
 * THE REMOVE BUTTON NEVER FIRED. Not a missing handler: the wiring was complete
 * and correct all along -- onRemove -> _removeWidget -> panel.removeWidget,
 * which deletes and emits. It was dead because the widget card's own wrapper
 * takes POINTER CAPTURE in beginDrag, so pointerdown on the button delivered
 * pointerup to the wrapper and no click was ever synthesised. A button present,
 * styled, wired, and unpressable.
 *
 * The file already knew the remedy: the inspector panel carries
 * `onPointerDown={e => e.stopPropagation()}` for exactly this reason. So this
 * was a known hazard applied to one control and not another, which is why the
 * source assertion below is about the GUARD rather than about the click -- a
 * DOM-level click test would prove today's markup, while the guard is the thing
 * that must not be dropped by the next person who edits this card.
 *
 * THE BOX CHANGED SIZE BETWEEN MODES, for content-sized widgets only. The
 * wrapper takes `width: L.w || undefined`, so a widget with an explicit size was
 * never affected -- 59 of the 88 widgets in the shipped controller examples
 * carry one. The other 29 do not, and for those an edit-only row in normal flow
 * made the card taller in Edit than in Play, so a panel arranged in one mode
 * shifted in the other. The parity test below therefore uses a CONTENT-SIZED
 * widget on purpose: an explicitly sized one passes trivially and proves
 * nothing.
 *
 * THE BINDING LINE HAD NO TOGGLE. The flag itself is panel-level and lives in
 * the serialised shape, which belongs to bw-board: it landed there as
 * `hideBindings`, with its own round-trip gate written against that panel's
 * history of losing `mode` from toJSON for a year. It arrived here with the pin
 * bump, and the control is wired as of that commit -- until then it was
 * deliberately absent, because a checkbox calling a method the vendored copy
 * did not have would have been a control that throws when pressed.
 *
 * What is asserted HERE is the wiring: the view reads the flag, hides the line,
 * and the control reaches the panel. The serialised behaviour is upstream's and
 * is gated there.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { ControllerPanel } from 'bw-board/controller.js';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VIEW = join(repo, 'overlay', 'scratch-gui', 'src', 'components',
    'tw-pseudocode', 'controller-panel-view.jsx');

test('the remove control guards against the card that swallowed its click', () => {
    // The defect was pointer capture, so the assertion is about the guard that
    // defeats it. Written as "the remove button carries stopPropagation on
    // pointerdown", not "a click removes a widget": the second passes on a
    // button nobody can reach.
    const src = readFileSync(VIEW, 'utf8');
    const i = src.indexOf("data-testid={'bw-ctl-remove-'");
    assert.ok(i > 0, 'the remove control is gone or renamed');

    // The guard must be on the control itself. Search the JSX element, which
    // ends at the closing brace of its style object plus the tag.
    const el = src.slice(src.lastIndexOf('<button', i), src.indexOf('</button>', i));
    assert.match(el, /onPointerDown=\{e => e\.stopPropagation\(\)\}/,
        'the remove control lost its stopPropagation guard -- the card takes pointer '
        + 'capture in beginDrag, so without this the button cannot be clicked at all');
    assert.match(el, /onClick=\{onRemove\}/, 'the remove control is not wired');
});

test('the remove control is out of flow, so the box is identical in both modes', () => {
    // position:absolute is what makes the corner placement AND the size parity
    // one change instead of two. A relatively positioned control in the card's
    // flow would satisfy "top right" visually and still change the height.
    const src = readFileSync(VIEW, 'utf8');
    const i = src.indexOf("data-testid={'bw-ctl-remove-'");
    const el = src.slice(src.lastIndexOf('<button', i), src.indexOf('</button>', i));
    assert.match(el, /position:\s*'absolute'/,
        'the remove control is back in normal flow -- a content-sized widget will be '
        + 'taller in Edit than in Play again');
    assert.match(el, /top:\s*\d/, 'not anchored to the top');
    assert.match(el, /right:\s*\d/, 'not anchored to the right');
});

function contentSizedControllerCensus (dir) {
    let total = 0, contentSized = 0;
    const files = [];
    const walk = (d) => {
        for (const e of readdirSync(d, { withFileTypes: true })) {
            const p = join(d, e.name);
            if (e.isDirectory()) walk(p);
            else if (e.name === 'controller.json') files.push(p);
        }
    };
    walk(dir);
    assert.ok(files.length > 0, 'the shipped controller corpus must not be empty');
    for (const file of files) {
        const data = JSON.parse(readFileSync(file, 'utf8'));
        assert.ok(Array.isArray(data.widgets), `${file} must declare its widget list`);
        for (const w of data.widgets) {
            total++;
            const L = w.layout ?? {};
            if (!L.w && !L.h) contentSized++;
        }
    }
    assert.ok(total > 0, 'the shipped controller corpus must contain widgets');
    assert.ok(contentSized > 0,
        `all ${total} shipped widgets now carry an explicit size, so the parity test above `
        + 'no longer exercises the case it was written for -- re-anchor it');
    return {files: files.length, total, contentSized};
}

test('a CONTENT-SIZED widget is the one that proves parity, and the shipped set has some', t => {
    // Controllers ship in examples/, not static/. A missing or unreadable
    // corpus must fail instead of making the UI parity assertion vacuous.
    const census = contentSizedControllerCensus(join(repo, 'overlay', 'scratch-gui', 'examples'));
    t.diagnostic(`${census.files} controller files, ${census.total} widgets, ${census.contentSized} content-sized`);
});

test('controller coverage refuses an empty corpus or an unreadable member beside valid widgets', t => {
    const dir = mkdtempSync(join(tmpdir(), 'controller-coverage-'));
    t.after(() => rmSync(dir, {recursive: true, force: true}));
    assert.throws(() => contentSizedControllerCensus(dir), /corpus must not be empty/);
    const valid = join(dir, 'valid');
    const invalid = join(dir, 'invalid');
    mkdirSync(valid);
    mkdirSync(invalid);
    writeFileSync(join(valid, 'controller.json'), JSON.stringify({widgets: [{layout: {}}]}));
    assert.deepEqual(contentSizedControllerCensus(dir), {files: 1, total: 1, contentSized: 1});
    writeFileSync(join(invalid, 'controller.json'), '{unreadable');
    assert.throws(() => contentSizedControllerCensus(dir), SyntaxError,
        'one valid controller cannot conceal another that could not be read');
    writeFileSync(join(invalid, 'controller.json'), '{}');
    assert.throws(() => contentSizedControllerCensus(dir), /must declare its widget list/);
});

test('removing a widget removes it, and the panel still serialises', () => {
    // The owner cannot lose a panel to this. 13 catalogue examples ship a
    // controller.json, so a removal that leaves the saved shape invalid would
    // damage real work rather than a scratch file.
    const p = new ControllerPanel();
    p.addWidget('a', 'button', {}, { x: 10, y: 10 });
    p.addWidget('b', 'slider', {}, { x: 20, y: 20 });

    const events = [];
    p.addListener((kind, detail) => events.push([kind, detail?.name]));
    p.removeWidget('a');

    assert.equal(p.getWidget('a'), null, 'the widget is still there');
    assert.ok(p.getWidget('b'), 'the wrong widget was removed');
    assert.deepEqual(events.filter(([k]) => k === 'remove'), [['remove', 'a']],
        'removal did not emit exactly one remove event for the right widget');

    const back = ControllerPanel.fromJSON(JSON.parse(JSON.stringify(p.toJSON())));
    assert.equal(back.getWidget('a'), null, 'the removed widget came back through the round trip');
    assert.ok(back.getWidget('b'), 'the surviving widget did not survive the round trip');
});

test('removing a widget that is not there is refused, not silently ignored', () => {
    const p = new ControllerPanel();
    p.addWidget('a', 'button', {}, {});
    assert.throws(() => p.removeWidget('nope'), /not found/,
        'a removal that quietly does nothing is how a dead control looks from the outside');
});

test('the view reads the panel flag, and the control can reach the panel', () => {
    // The wiring half. The flag's own behaviour -- default, emit, round trip --
    // is bw-board's and is gated there; duplicating it here would be a second
    // claim about the same fact, going stale on its own schedule.
    const src = readFileSync(VIEW, 'utf8');
    assert.match(src, /hideBindings=\{panel\.hideBindings\}/,
        'the card is not told whether to hide the line');
    assert.match(src, /\{!hideBindings && \(/,
        'the card ignores the flag it is given');
    assert.match(src, /panel\.setHideBindings\(!panel\.hideBindings\)/,
        'the toolbar control cannot reach the panel');
    assert.match(src, /data-testid="bw-ctl-hide-bindings"/, 'the control is unnamed');
});

test('the flag the view depends on actually exists in the vendored copy', () => {
    // THE REASON THIS TEST EXISTS. The control was held back one landing because
    // `setHideBindings` lived upstream and the vendored copy did not have it yet;
    // wiring it early would have shipped a button that throws when pressed. This
    // fails loudly if a future pin ever moves BACKWARD past the field, which
    // would otherwise present as a dead control -- the exact defect this whole
    // lane began with.
    const p = new ControllerPanel();
    assert.equal(typeof p.setHideBindings, 'function',
        'the vendored ControllerPanel has no setHideBindings -- the pin predates it, '
        + 'and the toolbar control will throw when pressed');
    assert.equal(p.hideBindings, false, 'and its default must be showing');
});

test('display bindings present only compatible circuit part choices', () => {
    const source = readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/controller-panel-view.jsx', import.meta.url), 'utf8');
    const method = source.match(/^    (_circuitParts\(widget\) \{[\s\S]*?^    \})/m)?.[1];
    assert.ok(method, 'the Controller view owns the part picker');
    const Picker = new Function(`return class Picker { ${method} }`)();
    const picker = new Picker();
    picker.props = {board: {parts: [
        {id: 'vga', kind: 'simplevga_card'},
        {id: 'logic', kind: 'w65c22'},
        {id: 'video', kind: 'tms9918'},
        {id: 'small', kind: 'char_lcd'},
        {id: 'display', kind: 'hd44780'}
    ]}};
    assert.deepEqual(picker._circuitParts({type: 'lcd'}).map(part => part.id), ['display', 'small']);
    assert.deepEqual(picker._circuitParts({type: 'simplevga'}).map(part => part.id), ['vga', 'video']);
    assert.equal(picker._circuitParts({type: 'slider'}).length, 5);
    picker.props = {board: null};
    assert.deepEqual(picker._circuitParts({type: 'lcd'}), []);
});
