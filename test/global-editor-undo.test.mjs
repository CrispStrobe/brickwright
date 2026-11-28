import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';

import {
    activateUndoSurface,
    getUndoState,
    registerUndoSurface,
    subscribeUndoState,
    undoActiveSurface
} from '../overlay/scratch-gui/src/lib/global-undo.js';

const root = path.resolve(import.meta.dirname, '..');
const read = file => readFileSync(path.join(root, file), 'utf8');

test('global undo routes only to the active editor and reports its availability', () => {
    const calls = [];
    const states = [];
    let blocksCanUndo = true;
    const unregisterBlocks = registerUndoSurface('test-blocks', {
        canUndo: () => blocksCanUndo,
        undo: () => { calls.push('blocks'); blocksCanUndo = false; return true; }
    });
    const unregisterCode = registerUndoSurface('test-code', {
        canUndo: () => false,
        undo: () => { calls.push('code'); return true; }
    });
    const unsubscribe = subscribeUndoState(state => states.push(state));

    activateUndoSurface('test-code');
    assert.equal(getUndoState().surface, 'test-code');
    assert.equal(getUndoState().canUndo, false);
    assert.equal(undoActiveSurface(), false);
    assert.deepEqual(calls, []);

    activateUndoSurface('test-blocks');
    assert.equal(undoActiveSurface(), true);
    assert.deepEqual(calls, ['blocks']);
    assert.equal(getUndoState().surface, 'test-blocks');
    assert.equal(getUndoState().canUndo, false);
    assert.ok(states.some(state => state.surface === 'test-code' && !state.canUndo));

    unsubscribe();
    unregisterCode();
    unregisterBlocks();
});

test('Widget Editor mode switch is two compact accessible icons, not translated text', () => {
    const source = read('overlay/scratch-gui/src/components/tw-pseudocode/controller-panel-view.jsx');
    for (const [id, icon, label] of [
        ['bw-ctl-mode-edit', '✎', 'edit'],
        ['bw-ctl-mode-play', '▶', 'play']
    ]) {
        const at = source.indexOf(`data-testid="${id}"`);
        assert.ok(at > 0, `${id} is missing`);
        const button = source.slice(source.lastIndexOf('<button', at), source.indexOf('</button>', at));
        assert.match(button, new RegExp(`aria-label=\\{t\\('${label}'\\)\\}`));
        const width = Number(button.match(/width:\s*(\d+)/)?.[1]);
        assert.ok(width >= 24 && width <= 40, `${id} keeps a compact, usable fixed-width icon target`);
        assert.match(button, new RegExp(`aria-pressed=\\{mode === '${label}'\\}`));
        assert.match(button, new RegExp(`this\\._setMode\\('${label}'\\)`));
        assert.match(button, new RegExp(`\\{'${icon}'\\}`));
        assert.doesNotMatch(button, new RegExp(`>\\s*\\{t\\('${label}'\\)\\}`));
    }
});

test('each requested editor registers with the global control', () => {
    const sources = {
        blocks: read('overlay/scratch-gui/src/containers/blocks.jsx'),
        code: read('overlay/scratch-gui/src/lib/codemirror-editor.jsx'),
        circuit: read('overlay/scratch-gui/src/components/tw-pseudocode/circuit-tab.jsx'),
        widgets: read('overlay/scratch-gui/src/components/tw-pseudocode/controller-panel-view.jsx')
    };
    for (const [surface, source] of Object.entries(sources)) {
        assert.match(source, new RegExp(`registerUndoSurface\\('${surface}'`), `${surface} is not registered`);
    }
    const menu = read('overlay/scratch-gui/src/components/menu-bar/menu-bar.jsx');
    assert.match(menu, /data-testid="bw-global-undo"/);
    assert.match(menu, /disabled=\{!this\.state\.globalCanUndo\}/);
    assert.match(menu, /undoActiveSurface\(\)/);
});

test('Widget Editor records structural, layout, configuration and binding mutations', () => {
    const source = read('overlay/scratch-gui/src/components/tw-pseudocode/controller-panel-view.jsx');
    for (const method of ['_addWidget', '_removeWidget', '_layout', '_config', '_bind', '_rename']) {
        const at = source.indexOf(`    ${method}(`);
        const next = source.indexOf('\n    }', at);
        assert.ok(at > 0 && next > at, `${method} is missing`);
        assert.match(source.slice(at, next), /_recordUndo\(/, `${method} does not create an undo point`);
    }
    assert.match(source, /_restoreSnapshot\(this\._undoStack\.pop\(\)\)/);
});
