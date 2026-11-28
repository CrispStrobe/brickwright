// SPDX-License-Identifier: BSD-3-Clause
// Pure controls: run the pane's actual menu/toolbar methods against passive
// editor spies. No physics, program, WebGL, file download or worker starts.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {balancedAfter, balancedFrom, scopeAfter} from './helpers/js-scope.mjs';
import {TOOLBAR_TEXT} from '../overlay/scratch-gui/src/components/tw-pseudocode/sim-lab-toolbar-text.js';
import {registerEditorMenuActions, getEditorMenuItems, runEditorMenuAction}
    from '../overlay/scratch-gui/src/lib/editor-menu-actions.js';

const source = readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/sim-lab-pane.jsx', import.meta.url), 'utf8');
const TEXT = new Function(`return ${balancedAfter(source, 'const TEXT =', '{', '}')}`)();
const formats = new Function(`return ${balancedAfter(source, 'const SAVE_FORMATS =', '[', ']')}`)();
const method = (signature, args = '', extra = {}) => new Function(...Object.keys(extra),
    `return function(${args}) ${scopeAfter(source, signature)}`)(...Object.values(extra));
const toolbarRunSignature = '    async runFromToolbar ({loadExample = false} = {})';
assert.ok(source.includes(toolbarRunSignature), 'the real toolbar run entry must be present');
// Skip the destructured argument before matching the method's body braces.
const toolbarRunBody = balancedFrom(source, source.indexOf(toolbarRunSignature) + toolbarRunSignature.length, '{', '}');

function fixture (locale = 'en') {
    const calls = [];
    const host = {
        _menuMounted: true, props: {isVisible: true, locale}, surface: 'robots', locale,
        text: TEXT[locale], ttext: TOOLBAR_TEXT[locale], itext: {showPorts: 'Ports', showMotion: 'Motion'},
        etext: {eyedropperHelp: 'Colour'}, lib: {}, file: {current: {click: () => calls.push(['open'])}},
        state: {mode: 'build', status: 'ready', programLoading: false, editorTick: 0, selection: ['a', 'b'],
            placing: null, gizmoMode: 'move', hidden: [], pick: null, showPorts: true, showMotion: false,
            showSensors: false, measurementsOpen: false, readings: false, showStats: false, challengesOpen: false},
        editor: {model: {parts: [{id: 'a'}, {id: 'b'}], groups: []}, canUndo: true, canRedo: false},
        session: {model: {parts: [{id: 's'}]}}, view: {view: key => calls.push(['camera', key])},
        modeWords: () => true, dockProperties: () => false, compact: () => false,
        setState(next) {Object.assign(this.state, typeof next === 'function' ? next(this.state) : next);},
        setOverlay(next) {this.setState(next); calls.push(['overlay', next]);}
    };
    host.editView = Object.fromEntries(['groupSelection', 'ungroupSelection', 'duplicate', 'deleteSelection', 'escape',
        'copy', 'paste', 'selectAll', 'undo', 'redo', 'setMode', 'turn', 'fitSelection', 'mirror', 'hideSelection',
        'isolate', 'showAll', 'setPick', 'view'].map(key => [key, (...args) => calls.push([key, ...args])]));
    for (const name of ['run', 'pause', 'reset', 'saveAs']) host[name] = (...args) => calls.push([name, ...args]);
    host.runFromToolbar = new Function(`return async function({loadExample = false} = {}) ${toolbarRunBody}`)();
    host.camera3d = method('    camera3d ()');
    host.actions = method('    actions ()', '', {toolStyles: () => ({}), measurementWords: () => ({title: 'Measurements'})});
    host.toolbarGroups = method('    toolbarGroups ()');
    host.fileActions = method('    fileActions ()', '', {SAVE_FORMATS: formats});
    host.editorMenuActions = method('    editorMenuActions ()', '', {getUndoState: () => ({surface: host.surface})});
    return {host, calls};
}

test('Robot Edit menus reuse real grouped commands and omit render-only controls and duplicate history', () => {
    const {host, calls} = fixture();
    const actions = host.editorMenuActions();
    for (const name of ['mode-move', 'turn', 'group', 'delete', 'copy', 'paste', 'view-top', 'show-ports', 'properties']) {
        assert.equal(actions[name].location, 'edit', name);
        assert.ok(actions[name].submenu, `${name} retains its toolbar group label`);
    }
    for (const name of ['grid', 'speed', 'file-menu', 'undo', 'redo']) assert.equal(name in actions, false, name);
    assert.equal(actions['show-ports'].checked, true);
    assert.equal(actions['show-motion'].checked, false);
    for (const name of ['mode-move', 'measure', 'properties']) assert.equal('checked' in actions[name], false);
    actions.delete.run();
    actions.group.run();
    actions['show-motion'].run();
    assert.deepEqual(calls, [['deleteSelection'], ['groupSelection'], ['overlay', {showMotion: true}]]);
    assert.equal(host.state.editorTick, 1);
    assert.equal(host.editorMenuActions()['show-motion'].checked, true);
});

test('Robot registry revalidates selection, running state and explicit full-tab ownership at click time', () => {
    const {host, calls} = fixture();
    const unregister = registerEditorMenuActions('test-robot-menu', () => host.editorMenuActions());
    try {
        assert.equal(runEditorMenuAction('test-robot-menu', 'delete'), true);
        host.state.selection = [];
        assert.equal(runEditorMenuAction('test-robot-menu', 'delete'), false);
        host.state.mode = 'simulate';
        assert.equal(runEditorMenuAction('test-robot-menu', 'run'), true);
        host.state.status = 'running';
        assert.equal(runEditorMenuAction('test-robot-menu', 'run'), false);
        assert.equal(runEditorMenuAction('test-robot-menu', 'pause'), true);
        assert.equal(getEditorMenuItems('test-robot-menu', 'edit').some(item => item.name === 'pause'), true);
        for (const visibility of [false, undefined, null]) {
            host.props.isVisible = visibility;
            assert.equal(runEditorMenuAction('test-robot-menu', 'pause'), false, String(visibility));
            assert.deepEqual(getEditorMenuItems('test-robot-menu', 'file'), []);
        }
        host.props.isVisible = true;
        host.surface = 'blocks';
        assert.equal(host.editorMenuActions(), null);
        host.surface = 'robots';
        host._menuMounted = false;
        assert.equal(runEditorMenuAction('test-robot-menu', 'pause'), false);
        assert.deepEqual(calls, [['deleteSelection'], ['run'], ['pause']]);
    } finally {unregister();}
    assert.deepEqual(getEditorMenuItems('test-robot-menu', 'edit'), []);
});

test('Robot File commands share localized rows and preserve busy, library and model guards', () => {
    for (const locale of ['en', 'de']) {
        const {host, calls} = fixture(locale);
        const actions = host.editorMenuActions();
        assert.deepEqual(Object.keys(actions).filter(name => actions[name].location === 'file'), ['open', 'save-ldr', 'save-mpd', 'save-io']);
        actions.open.run();
        for (const format of formats) {
            assert.equal(actions[`save-${format}`].label, `${host.ttext.actions.save} ${host.text.saveFormats[format]}`);
            actions[`save-${format}`].run();
        }
        assert.deepEqual(calls, [['open'], ['saveAs', 'ldr'], ['saveAs', 'mpd'], ['saveAs', 'io']]);
        for (const busy of [{status: 'loading'}, {status: 'ready', programLoading: true}]) {
            Object.assign(host.state, busy);
            for (const item of host.fileActions()) assert.equal(item.disabled, true);
        }
        Object.assign(host.state, {status: 'ready', programLoading: false});
        host.lib = null;
        assert.equal(host.editorMenuActions().open.enabled, false);
        host.editor = null;
        host.session = null;
        for (const format of formats) assert.equal(host.editorMenuActions()[`save-${format}`].enabled, false);
    }
    assert.match(scopeAfter(source, '    renderFile (inMenu)'), /this\.fileActions\(\)\.map/);
});

test('Robot menu refresh follows command/UI changes without physics-frame notifications', () => {
    let notifications = 0;
    const update = method('    componentDidUpdate (prevProps, prevState)', 'prevProps, prevState',
        {notifyEditorMenuActions: () => { notifications++; }});
    const {host} = fixture();
    for (const name of ['mode', 'status', 'programLoading', 'editorTick', 'selection', 'placing', 'gizmoMode',
        'showPorts', 'showMotion', 'showSensors', 'readings', 'measurementsOpen', 'showStats', 'challengesOpen',
        'hidden', 'drawer', 'paletteOpen', 'propsDocked', 'propsOpen']) {
        const before = {...host.state};
        host.state[name] = {};
        const count = notifications;
        update.call(host, host.props, before);
        assert.equal(notifications, count + 1, name);
    }
    for (const name of ['simMs', 'rtf', 'readingsTick', 'measurementTick', 'replayFrames', 'thumbTick']) {
        const before = {...host.state};
        host.state[name] = 100;
        const count = notifications;
        update.call(host, host.props, before);
        assert.equal(notifications, count, `${name} must not churn menus every frame`);
    }
    const count = notifications;
    update.call(host, {...host.props, isVisible: false}, host.state);
    assert.equal(notifications, count + 1);
    assert.match(scopeAfter(source, '    async componentDidMount ()'), /this\._menuMounted = true;[\s\S]*registerEditorMenuActions\('robots'/);
    assert.match(scopeAfter(source, '    componentWillUnmount ()'), /this\._menuMounted = false;[\s\S]*this\.unregisterMenu\(\)/);
});
