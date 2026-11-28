import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {shouldLoadCircuitDesigner} from
    '../overlay/scratch-gui/src/lib/bw-debug/circuit-designer-load-policy.js';

const tabSource = () => readFileSync(new URL(
    '../overlay/scratch-gui/src/components/tw-pseudocode/circuit-tab.jsx', import.meta.url), 'utf8');

test('right and solo Code layouts load only the debugger until Circuit is requested', () => {
    for (const debugDock of ['right', 'solo']) {
        assert.equal(shouldLoadCircuitDesigner({portalOn: true, debugDock}), false);
    }
    assert.equal(shouldLoadCircuitDesigner({portalOn: false, debugDock: 'right'}), false);
});

test('every layout which paints CircuitDesigner still loads it', () => {
    for (const debugDock of ['top', 'off']) {
        assert.equal(shouldLoadCircuitDesigner({portalOn: true, debugDock}), true);
    }
    for (const debugDock of ['right', 'solo', 'top', 'off']) {
        assert.equal(shouldLoadCircuitDesigner({isVisible: true, debugDock}), true);
    }
    assert.equal(shouldLoadCircuitDesigner({explicit: true, debugDock: 'right'}), true,
        'cold File-menu and circuit-starter actions must wake their receiver');
});

test('CircuitTab keeps broad circuit imports behind the guarded load boundary', () => {
    const source = tabSource();
    const beforeClass = source.slice(0, source.indexOf('class CircuitTab'));
    for (const specifier of [
        `bw-circuit-ui/model/drc.js`,
        `bw-board/m6502-extract.js`,
        `bw-board/z80-extract.js`,
        `bw-board/i8086-extract.js`
    ]) {
        assert.ok(!beforeClass.includes(specifier), `${specifier} returned to the initial import graph`);
    }

    const load = source.slice(source.indexOf('async loadDesigner ('), source.indexOf('handleCircuitReady ('));
    assert.match(load, /shouldLoadCircuitDesigner\(\{/,
        'load itself must defend against incidental callers, not only one lifecycle path');
    for (const specifier of [
        `bw-board`,
        `bw-board/m6502-extract.js`,
        `bw-board/z80-extract.js`,
        `bw-board/i8086-extract.js`,
        `bw-circuit-ui`
    ]) {
        // Containment, not co-presence: the specifier must sit INSIDE a dynamic
        // import with a chunk name, not merely somewhere in the same slice as one.
        const escaped = specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        assert.match(load, new RegExp(`import\\(/\\* webpackChunkName: "[^"]+" \\*/ '${escaped}'\\)`),
            `${specifier} is no longer dynamically owned by the guarded designer load`);
    }
    const wake = source.slice(source.indexOf('_circuitFileWake ('), source.indexOf('componentDidMount ()'));
    assert.match(wake, /this\.load\(\{explicit: true\}\)/,
        'a cold File-menu action must bypass presentation-only deferral');
    const starter = source.slice(source.indexOf('async loadStarterJourney ('),
        source.indexOf('async applyControllerLayout ('));
    assert.match(starter, /this\.load\(\{explicit: true\}\)/,
        'a circuit starter must bypass presentation-only deferral');
});

test('the hosted receipt rejects broad circuit chunks before its existing Circuit click', () => {
    const source = readFileSync(new URL('../scripts/bench-i8086-browser.mjs', import.meta.url), 'utf8');
    const mark = source.indexOf("await mark('circuit-open-request')");
    const click = source.indexOf("getByRole('tab', {name: /Circuit/}).click", mark);
    assert.ok(mark >= 0 && mark < click, 'the pre-Circuit boundary moved after the Circuit click');
    assert.match(source, /from: 0,[\s\S]*to: circuitOpenAt,[\s\S]*preCircuitResources/);
    assert.match(source, /bw-\(\?:board\|circuit-ui\)\\\.js/,
        'the browser gate no longer rejects both deferred named chunks');
});
