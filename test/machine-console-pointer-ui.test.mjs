import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile, writeFile, unlink} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {dirname, join} from 'node:path';
import {randomUUID} from 'node:crypto';

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const guiRequire = createRequire(join(root, 'packages/scratch-gui/package.json'));
const React = guiRequire('react');
const {create, act} = guiRequire('react-test-renderer');
const babel = guiRequire('@babel/core');

async function loadConsole() {
    const sourceUrl = new URL('../overlay/scratch-gui/src/components/tw-pseudocode/machine-console.jsx', import.meta.url);
    const tempUrl = new URL(`./machine-console-test-${randomUUID()}.mjs`, sourceUrl);
    const reactUrl = pathToFileURL(guiRequire.resolve('react')).href;
    const header = (await readFile(new URL('./machine-screen-header.jsx', sourceUrl), 'utf8'))
        .replace("import React from 'react';", '').replace('export default function', 'function');
    const source = (await readFile(sourceUrl, 'utf8'))
        .replace("from 'react'", `from '${reactUrl}'`)
        .replace("import MachineScreenHeader from './machine-screen-header.jsx';", header);
    const transformed = babel.transformSync(source, {
        filename: 'machine-console.jsx', babelrc: false, configFile: false,
        presets: [[guiRequire.resolve('@babel/preset-react'), {runtime: 'classic'}]]
    }).code;
    await writeFile(tempUrl, transformed);
    try { return (await import(tempUrl.href)).default; }
    finally { await unlink(tempUrl); }
}

const widget = {name: 'VGA', config: {width: 640, height: 480}, state: {signal: true}};
const pointer = (x, y, button = 0) => ({
    clientX: x, clientY: y, button, pointerId: 7,
    preventDefault() { this.prevented = true; },
    currentTarget: {setPointerCapture(id) { assert.equal(id, 7); }}
});

// react-test-renderer invokes the actual component's event props. It needs
// these globals for effects, but no browser, emulator or private media.
async function withConsole(testBody) {
    const beforeDocument = globalThis.document;
    const beforeWindow = globalThis.window;
    globalThis.document = {fullscreenElement: null, addEventListener() {}, removeEventListener() {}};
    globalThis.window = {addEventListener() {}, removeEventListener() {}};
    try { await testBody(await loadConsole()); }
    finally {
        if (beforeDocument === undefined) delete globalThis.document;
        else globalThis.document = beforeDocument;
        if (beforeWindow === undefined) delete globalThis.window;
        else globalThis.window = beforeWindow;
    }
}

test('Widgets console forwards ordered PS/2 movement and button transitions, releasing lost capture and blur',
    async () => withConsole(async MachineConsole => {
        const received = [];
        let renderer;
        await act(async () => {
            renderer = create(React.createElement(MachineConsole, {
                widget, mouseIn: packet => { received.push(packet); return true; }
            }));
        });
        const consoleFace = renderer.root.findByProps({'data-testid': 'bw-machine-console'});
        const surface = renderer.root.findAllByType('div').find(node =>
            typeof node.props.onPointerMove === 'function');
        assert.ok(surface, 'the rendered Widgets pointer surface exists');

        surface.props.onPointerMove(pointer(100, 100)); // establish the relative origin
        assert.deepEqual(received, []);
        surface.props.onPointerMove(pointer(106, 97));
        const left = pointer(106, 97, 0);
        surface.props.onPointerDown(left);
        assert.equal(left.prevented, true, 'press is captured by the guest console');
        surface.props.onPointerMove(pointer(109, 101));
        surface.props.onPointerDown(pointer(109, 101, 2)); // right while left is held
        surface.props.onPointerUp(pointer(109, 101, 0));
        surface.props.onLostPointerCapture();
        surface.props.onPointerMove(pointer(200, 200)); // new origin after lost capture
        surface.props.onPointerDown(pointer(200, 200, 1)); // middle
        await act(async () => { consoleFace.props.onBlur(); });
        assert.deepEqual(received, [
            {dx: 6, dy: -3, buttons: 0},
            {dx: 0, dy: 0, buttons: 1},
            {dx: 3, dy: 4, buttons: 1},
            {dx: 0, dy: 0, buttons: 3},
            {dx: 0, dy: 0, buttons: 2},
            {dx: 0, dy: 0, buttons: 0},
            {dx: 0, dy: 0, buttons: 4},
            {dx: 0, dy: 0, buttons: 0}
        ]);
        await act(async () => { renderer.unmount(); });
    }));

test('Widgets console leaves pointer input inert when no machine mouse callback is attached',
    async () => withConsole(async MachineConsole => {
        let renderer;
        await act(async () => {
            renderer = create(React.createElement(MachineConsole, {widget}));
        });
        const surface = renderer.root.findAllByType('div').find(node =>
            typeof node.props.onPointerMove === 'function');
        const down = pointer(20, 30);
        surface.props.onPointerMove(pointer(10, 10));
        surface.props.onPointerMove(pointer(20, 30));
        surface.props.onPointerDown(down);
        surface.props.onPointerUp(pointer(20, 30));
        surface.props.onLostPointerCapture();
        assert.equal(down.prevented, undefined, 'ordinary screen clicks are not intercepted');
        await act(async () => { renderer.unmount(); });
    }));


test('Widgets console distinguishes extended and keypad keys and releases both on blur and unmount',
    async () => withConsole(async MachineConsole => {
        const received = [];
        const listeners = new Map();
        window.addEventListener = (name, listener) => listeners.set(name, listener);
        window.removeEventListener = (name, listener) => {
            if (listeners.get(name) === listener) listeners.delete(name);
        };
        const focused = {};
        let renderer;
        await act(async () => {
            renderer = create(React.createElement(MachineConsole, {
                widget, keyboardSet: 'at-set1', keyIn: byte => received.push(byte)
            }), {createNodeMock: element => element.props['data-testid'] === 'bw-machine-console' ? focused : null});
        });
        const key = (code, down = true) => {
            const event = {code, preventDefault() { this.prevented = true; }, stopPropagation() {}};
            listeners.get(down ? 'keydown' : 'keyup')(event);
            return event;
        };
        assert.equal(key('ArrowLeft').prevented, undefined, 'unfocused console leaves keys alone');
        document.activeElement = focused;
        assert.equal(key('Unknown').prevented, undefined);
        assert.equal(key('ArrowLeft').prevented, true);
        key('ArrowLeft'); // repeated browser keydown does not duplicate a held make
        key('Numpad4'); // same trailing byte, distinct physical key
        key('ArrowLeft', false);
        key('Numpad4', false);
        key('ControlLeft');
        key('ControlRight');
        key('ControlLeft', false);
        await act(async () => { renderer.root.findByProps({'data-testid': 'bw-machine-console'}).props.onBlur(); });
        key('ControlRight', false); // already released on blur
        key('NumpadEnter');
        key('F12');
        const replacement = [];
        await act(async () => {
            renderer.update(React.createElement(MachineConsole, {
                widget, keyboardSet: 'at-set1', keyIn: byte => replacement.push(byte)
            }));
        });
        assert.deepEqual(replacement, [], 'held keys release into the old runner');
        key('ControlRight');
        await act(async () => { renderer.unmount(); });
        assert.deepEqual(replacement, [0xe0, 0x1d, 0xe0, 0x9d], 'new runner gets its own make and unmount break');
        assert.deepEqual(received, [
            0xe0, 0x4b, 0x4b, 0xe0, 0xcb, 0xcb,
            0x1d, 0xe0, 0x1d, 0x9d, 0xe0, 0x9d,
            0xe0, 0x1c, 0x58, 0xe0, 0x9c, 0xd8
        ]);
        assert.equal(listeners.size, 0, 'unmount removes keyboard listeners');
    }));

test('legacy Widgets keyboard ignores AT aliases while original keys remain held',
    async () => withConsole(async MachineConsole => {
        const received = [];
        const listeners = new Map();
        window.addEventListener = (name, listener) => listeners.set(name, listener);
        window.removeEventListener = name => listeners.delete(name);
        const focused = {};
        let renderer;
        await act(async () => {
            renderer = create(React.createElement(MachineConsole, {
                widget, keyIn: byte => received.push(byte)
            }), {createNodeMock: element => element.props['data-testid'] === 'bw-machine-console' ? focused : null});
        });
        document.activeElement = focused;
        const key = (code, down = true) => {
            const event = {code, preventDefault() { this.prevented = true; }, stopPropagation() {}};
            listeners.get(down ? 'keydown' : 'keyup')(event);
            return event;
        };
        key('ControlLeft');
        key('ArrowLeft');
        for (const code of ['ControlRight', 'AltRight', 'Numpad4', 'NumpadEnter', 'NumpadDivide', 'F11', 'F12']) {
            assert.equal(key(code).prevented, undefined, code);
            assert.equal(key(code, false).prevented, undefined, code);
        }
        assert.deepEqual(received, [0x1d, 0x4b], 'ignored aliases do not release the held original keys');
        key('ArrowLeft', false);
        await act(async () => { renderer.unmount(); });
        assert.deepEqual(received, [0x1d, 0x4b, 0xcb, 0x9d]);
    }));

test('serial machine screens send printable keys, CR and editing controls as ASCII',
    async () => withConsole(async MachineConsole => {
        const received = [];
        const listeners = new Map();
        window.addEventListener = (name, listener) => listeners.set(name, listener);
        const focused = {};
        let renderer;
        await act(async () => {
            renderer = create(React.createElement(MachineConsole, {
                widget, serialIn: byte => received.push(byte)
            }), {createNodeMock: element => element.props['data-testid'] === 'bw-machine-console' ? focused : null});
        });
        const input = (key, extras = {}, name = 'keydown') => {
            const event = {key, preventDefault() { this.prevented = true; }, stopPropagation() {}, ...extras};
            listeners.get(name)(event);
            return event.prevented;
        };
        assert.equal(input('A'), undefined);
        document.activeElement = focused;
        assert.equal(input('A'), true);
        assert.equal(input('A', {}, 'keyup'), undefined);
        assert.equal(input('Enter'), true);
        assert.equal(input('Backspace'), true);
        assert.equal(input('c', {ctrlKey: true}), true);
        assert.equal(input('Tab'), undefined);
        assert.equal(input('é'), undefined);
        assert.deepEqual(received, [65, 13, 8, 3]);
        await act(async () => { renderer.unmount(); });
    }));
