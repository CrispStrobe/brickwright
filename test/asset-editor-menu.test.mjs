import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {balancedAfter, scopeAfter} from './helpers/js-scope.mjs';
import {makeT} from '../overlay/scratch-gui/src/lib/bw-i18n.js';
import {registerEditorMenuActions, getEditorMenuItems, runEditorMenuAction, editorMenuActionEnabled} from '../overlay/scratch-gui/src/lib/editor-menu-actions.js';
const read = file => readFileSync(new URL(`../overlay/scratch-gui/src/${file}`, import.meta.url), 'utf8');
const pixel = read('components/tw-pseudocode/pixel-art-editor.jsx');
const tilemap = read('components/tw-pseudocode/tilemap-editor.jsx');
const provider = (source, surface, extra = {}) => new Function('getUndoState', 't', 'browserLocale', ...Object.keys(extra),
    `return function() ${scopeAfter(source, '    editorMenuActions ()')}`)(
    () => ({surface}), makeT(new Function(`return ${balancedAfter(source, 'const L10N =', '{', '}')}`)()),
    () => 'en', ...Object.values(extra));
const pixelHost = () => {
    const calls = [];
    const layer = {id: 'layer', visible: true, locked: false};
    const host = {_menuMounted: true, props: {locale: 'en'}, state: {image: {}, layers: [layer], frames: [{id: 'frame', layers: [layer]}],
        activeLayerId: 'layer', activeFrameId: 'frame', w: 16, h: 16, selection: null},
    activeLayer() {return this.state.layers.find(layer => layer.id === this.state.activeLayerId);},
    materializeFrames() {return this.state.frames;}, hasUnsavedChanges: () => true,
    paletteFile: {current: {click: () => calls.push(['palette'])}}, sheetFile: {current: {click: () => calls.push(['sheet'])}},
    setState(next) {Object.assign(this.state, next);}};
    for (const name of ['save','exportPng','exportSheet','exportFramesAsCostumes','copySelection','cutSelection',
        'pasteSelection','clearSelection','cropToSelection','revert','addLayer','deleteLayer','moveLayer','addFrame',
        'deleteFrame','moveFrame','togglePlayback','transform']) host[name] = (...args) => calls.push([name, ...args]);
    host.canTransform = operation => new Function(`return function(operation) ${scopeAfter(pixel, '    canTransform (operation)')}`)().call(host, operation);
    return {host, calls};
};

test('Pixel exposes 26 localized commands with real callbacks and grouped transforms/layers/frames', () => {
    const {host, calls} = pixelHost();
    const get = provider(pixel, 'pixel');
    const unregister = registerEditorMenuActions('test-pixel', () => get.call(host));
    try {
        assert.equal(Object.keys(get.call(host)).length, 26);
        const files = getEditorMenuItems('test-pixel', 'file');
        assert.equal(files.length, 6);
        assert.equal(files[0].label, 'Save pixel artwork');
        assert.equal('run' in files[0], false, 'render snapshots do not leak callbacks');
        assert.deepEqual([...new Set(getEditorMenuItems('test-pixel', 'edit').map(item => item.submenu))],
            ['', 'Transform', 'Layers', 'Frames']);
        assert.equal(runEditorMenuAction('test-pixel', 'add-layer'), true);
        assert.equal(runEditorMenuAction('test-pixel', 'flip-h'), true);
        assert.equal(runEditorMenuAction('test-pixel', 'palette'), true);
        assert.equal(host.state.panel, 'palette');
        assert.deepEqual(calls, [['addLayer'], ['transform','flip-h'], ['palette']]);
        host.props.locale = 'de';
        assert.equal(getEditorMenuItems('test-pixel', 'file')[0].label, 'Pixelgrafik speichern');
        assert.ok(getEditorMenuItems('test-pixel', 'edit').some(item => item.submenu === 'Ebenen'));
    } finally {unregister();}
});

test('Pixel refuses locked, absent selection, empty clipboard, frame limits and stale owners', () => {
    const {host, calls} = pixelHost(); const get = provider(pixel, 'pixel');
    const unregister = registerEditorMenuActions('test-pixel-guards', () => get.call(host));
    try {
        for (const name of ['cut','copy','paste','clear','crop','delete-layer','delete-frame','export-sheet','export-frames']) {
            assert.equal(runEditorMenuAction('test-pixel-guards', name), false, name);
        }
        host.state.selection = {x: 0, y: 0, width: 2, height: 2};
        host.state.layers[0].locked = true;
        for (const name of ['cut','clear','flip-h','rotate-cw']) assert.equal(runEditorMenuAction('test-pixel-guards', name), false, name);
        assert.equal(runEditorMenuAction('test-pixel-guards', 'copy'), true, 'locked visible pixels can still be copied');
        host.state.frames = Array.from({length:64}, (_,i) => ({id:String(i),layers:host.state.layers}));
        for (const name of ['add-frame','duplicate-frame']) assert.equal(runEditorMenuAction('test-pixel-guards', name), false);
        host._menuMounted = false;
        assert.equal(runEditorMenuAction('test-pixel-guards','save'), false);
        assert.deepEqual(calls, [['copySelection']]);
        host._menuMounted = true;
        assert.equal(provider(pixel, 'code').call(host), null);
    } finally {unregister();}
});

test('Pixel rotation rejects locked animation layers and oversized selection', () => {
    const {host} = pixelHost(); const get = provider(pixel, 'pixel');
    host.state.frames.push({id:'other',layers:[{locked:true}]});
    assert.equal(get.call(host)['rotate-cw'].enabled, false);
    assert.equal(get.call(host)['flip-h'].enabled, true);
    assert.match(pixel, /disabled=\{!this\.canTransform\(operation\)\}/, 'toolbar uses the same transform guard');
    host.state.selection = {width:32,height:2};
    assert.equal(get.call(host)['rotate-cw'].enabled, false);
});

test('Tilemap exposes 10 localized actions and preserves legacy-map tool restrictions', () => {
    const calls = [];
    const host = {_menuMounted:true,props:{locale:'en'},state:{maps:[{kind:'tilemap'}],selected:0,
        history:{present:{}},tile:1}, hasUnsavedChanges:()=>true,
        newMap:()=>calls.push('new'),save:()=>calls.push('save'),revertMap:()=>calls.push('revert'),
        addEditorTile:()=>calls.push('add'),apply:data=>calls.push(data),setState:state=>calls.push(state)};
    const get = provider(tilemap,'tilemap',{removeTile:(_,tile)=>({removed:tile})});
    const unregister = registerEditorMenuActions('test-tilemap',()=>get.call(host));
    try {
        assert.equal(Object.keys(get.call(host)).length,10);
        assert.equal(runEditorMenuAction('test-tilemap','new'),true);
        assert.equal(runEditorMenuAction('test-tilemap','save'),true);
        assert.equal(runEditorMenuAction('test-tilemap','wall'),true);
        assert.equal(runEditorMenuAction('test-tilemap','remove-tile'),true);
        assert.deepEqual(calls,['new','save',{tool:'wall'},{removed:1}]);
        host.state.maps[0].kind='legacyLayout';
        for(const name of ['wall','place','add-tile','remove-tile']) assert.equal(runEditorMenuAction('test-tilemap',name),false,name);
        host.state.history=null;
        assert.equal(runEditorMenuAction('test-tilemap','save'),false);
        assert.equal(runEditorMenuAction('test-tilemap','new'),true);
        host._menuMounted=false;
        assert.equal(runEditorMenuAction('test-tilemap','new'),false);
    } finally {unregister();}
});

test('asset dispatch requires the current editor and current enabled descriptor', () => {
    const source=read('components/menu-bar/menu-bar.jsx'); const calls=[];
    let enabled=true;
    const run=new Function('getEditorMenuItems','runEditorMenuAction',`return function(name,location) ${scopeAfter(source,'    handleAssetMenuAction (name, location)')}`)(
        ()=>[{name:'save',enabled}],(...args)=>{calls.push(args);return true;});
    const resolve = new Function('editorMenuActionEnabled',
        `return function() ${scopeAfter(source, '    resolveAssetMenuSurface ()')}`)(editorMenuActionEnabled);
    const host={resolveAssetMenuSurface: resolve, _activeEditorSurface:'pixel',props:{activeTabIndex:1,onRequestCloseFile:()=>{},onRequestCloseEdit:()=>{}}};
    assert.equal(run.call(host,'save','file'),true);
    enabled=false;assert.equal(run.call(host,'save','file'),false);
    enabled=true;host.props.activeTabIndex=3;assert.equal(run.call(host,'save','file'),false);
    assert.deepEqual(calls,[['pixel','save']]);
});


test('menu snapshots cannot authorize a stale action after the editor changes', () => {
    let enabled = true, calls = 0;
    const unregister = registerEditorMenuActions('test-snapshot', () => ({save: {
        label: 'Save', location: 'file', enabled, run: () => calls++
    }}));
    try {
        const snapshot = getEditorMenuItems('test-snapshot', 'file');
        assert.equal(snapshot[0].enabled, true);
        enabled = false;
        assert.equal(runEditorMenuAction('test-snapshot', snapshot[0].name), false);
        assert.equal(calls, 0);
    } finally {unregister();}
});
