import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pcSet1Bytes} from '../overlay/scratch-gui/src/lib/bw-machines/pc-scancodes.js';
import {ps2ButtonBit, ps2Delta} from '../overlay/scratch-gui/src/lib/bw-machines/ps2-pointer.js';

// Execute the actual component hooks and handlers without React/Babel installs.
// JSX rendering and browser event delivery are outside these focused controls.
const source = readFileSync(new URL(
    '../overlay/scratch-gui/src/components/tw-pseudocode/machine-console.jsx', import.meta.url), 'utf8');
const start = source.indexOf('export default function MachineConsole(');
const end = source.lastIndexOf('\n    return (\n');
assert.ok(start >= 0 && end > start, 'component body and JSX boundary exist');
const componentBody = source.slice(start, end).replace('export default ', '') +
    '\nreturn {pointerDown, pointerMove, pointerUp, release};\n}';

function harness(props) {
    const previous = {window: globalThis.window, document: globalThis.document};
    const listeners = new Map();
    const root = {focus() { document.activeElement = root; }};
    globalThis.document = {activeElement: root, fullscreenElement: null,
        addEventListener() {}, removeEventListener() {}};
    globalThis.window = {
        addEventListener(name, fn) {
            if (!listeners.has(name)) listeners.set(name, new Set());
            listeners.get(name).add(fn);
        },
        removeEventListener(name, fn) {
            listeners.get(name)?.delete(fn);
            if (!listeners.get(name)?.size) listeners.delete(name);
        }
    };
    const refs = [], effects = [];
    let refIndex, effectIndex, pending, handlers;
    const React = {
        useRef(value) {
            const index = refIndex++;
            return refs[index] ||= {current: index === 0 ? root : value};
        },
        useState: value => [value, () => {}],
        useEffect(fn, deps) {
            const index = effectIndex++;
            const old = effects[index];
            if (!old || deps.some((dep, i) => !Object.is(dep, old.deps[i]))) {
                pending.push(() => {
                    old?.cleanup?.();
                    effects[index] = {deps, cleanup: fn()};
                });
            }
        }
    };
    const Component = new Function('React', 'pcSet1Bytes', 'ps2ButtonBit', 'ps2Delta',
        `${componentBody}; return MachineConsole;`)(React, pcSet1Bytes, ps2ButtonBit, ps2Delta);
    // The controller supplies a concrete video widget, even before a frame
    // arrives. Match its AT VGA shape so the real component can read config.
    const widget = {name: 'AT VGA', type: 'simplevga', source: 'video',
        config: {width: 640, height: 480}, state: {signal: false}};
    const render = nextProps => {
        refIndex = 0; effectIndex = 0; pending = [];
        handlers = Component({widget, ...nextProps});
        for (const effect of pending) effect();
    };
    render(props);
    const dispatch = (name, event = {}) => {
        for (const listener of listeners.get(name) || []) listener(event);
    };
    return {
        listeners, render, dispatch,
        key(code, down = true) {
            dispatch(down ? 'keydown' : 'keyup', {code, preventDefault() {}, stopPropagation() {}});
        },
        down(button = 0) {
            handlers.pointerDown({clientX: 10, clientY: 20, button, pointerId: 1,
                preventDefault() {}, currentTarget: {setPointerCapture() {}}});
        },
        move(x, y) { handlers.pointerMove({clientX: x, clientY: y}); },
        unmount() { for (const effect of effects) effect?.cleanup?.(); },
        restore() {
            for (const name of ['window', 'document']) {
                if (previous[name] === undefined) delete globalThis[name];
                else globalThis[name] = previous[name];
            }
        }
    };
}

for (const keyboardSet of ['at-set1', undefined]) {
    test(`window blur releases held keys/buttons and permits fresh input (${keyboardSet || 'XT'})`, () => {
        const keys = [], mouse = [];
        const ui = harness({keyboardSet, keyIn: byte => keys.push(byte), mouseIn: packet => mouse.push(packet)});
        try {
            ui.key('ArrowLeft'); ui.key('ControlLeft'); ui.down();
            ui.dispatch('blur');
            assert.deepEqual(keys, [
                ...pcSet1Bytes('ArrowLeft', true, keyboardSet === 'at-set1'), 0x1d,
                ...pcSet1Bytes('ArrowLeft', false, keyboardSet === 'at-set1'), 0x9d
            ]);
            assert.deepEqual(mouse, [{dx: 0, dy: 0, buttons: 1}, {dx: 0, dy: 0, buttons: 0}]);
            const count = keys.length;
            ui.dispatch('blur'); ui.key('ArrowLeft', false); ui.key('ControlLeft', false);
            assert.equal(keys.length, count, 'late keyup/repeated blur do not duplicate breaks');
            assert.equal(mouse.length, 2, 'repeated blur does not duplicate mouse release');
            ui.move(100, 100);
            assert.equal(mouse.length, 2, 'first movement after window blur establishes a new origin');
            ui.move(103, 98);
            assert.deepEqual(mouse.at(-1), {dx: 3, dy: -2, buttons: 0});
            ui.key('ControlLeft'); ui.key('ControlLeft', false);
            assert.deepEqual(keys.slice(count), [0x1d, 0x9d], 'normal input resumes after refocus');
        } finally { ui.unmount(); ui.restore(); }
    });
}

test('window blur also releases a mouse-only console', () => {
    const mouse = [];
    const ui = harness({mouseIn: packet => mouse.push(packet)});
    try {
        ui.down(2); ui.dispatch('blur');
        assert.deepEqual(mouse, [{dx: 0, dy: 0, buttons: 2}, {dx: 0, dy: 0, buttons: 0}]);
    } finally { ui.unmount(); ui.restore(); }
});

test('runner replacement releases into the old runner and removes obsolete blur handlers', () => {
    const oldKeys = [], newKeys = [], oldMouse = [], newMouse = [];
    const ui = harness({keyboardSet: 'at-set1', keyIn: b => oldKeys.push(b), mouseIn: p => oldMouse.push(p)});
    try {
        ui.key('ControlRight'); ui.down();
        ui.render({keyIn: b => newKeys.push(b), mouseIn: p => newMouse.push(p)});
        assert.deepEqual(oldKeys, [0xe0, 0x1d, 0xe0, 0x9d]);
        assert.deepEqual(oldMouse, [{dx: 0, dy: 0, buttons: 1}, {dx: 0, dy: 0, buttons: 0}]);
        assert.equal(ui.listeners.get('blur')?.size, 1, 'only current runner owns window blur');
        ui.key('ControlLeft'); ui.down(2); ui.dispatch('blur');
        assert.deepEqual(newKeys, [0x1d, 0x9d]);
        assert.deepEqual(newMouse, [{dx: 0, dy: 0, buttons: 2}, {dx: 0, dy: 0, buttons: 0}]);
        ui.key('ControlLeft'); ui.down();
        ui.unmount();
        assert.deepEqual(newKeys, [0x1d, 0x9d, 0x1d, 0x9d]);
        assert.deepEqual(newMouse.slice(-2), [{dx: 0, dy: 0, buttons: 1}, {dx: 0, dy: 0, buttons: 0}]);
        assert.equal(ui.listeners.size, 0, 'unmount removes all window listeners');
    } finally { ui.restore(); }
});
