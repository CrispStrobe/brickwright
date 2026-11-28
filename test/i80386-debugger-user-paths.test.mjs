import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeDebugCapabilities} from '../overlay/scratch-gui/src/lib/bw-debug/debug-capabilities.js';
import {memorySpaces, memoryPage, memoryJump, readMemoryPage, formatMemoryAddress,
    memorySessionCurrent, memoryWritable, memorySpacesDeclared}
    from '../overlay/scratch-gui/src/lib/bw-debug/memory-view.js';
const legacy = [{id: 'mem', label: 'Memory', size: 65536}];
const mem = {read: true, write: false, passiveRead: true, addressSpace: 'physical',
    addressMin: 0, addressMax: 0xffffffff, maxReadBytes: 1048576};
const specs = descriptor => memorySpaces(normalizeDebugCapabilities({spaces: {mem: descriptor}}), legacy);

test('physical page/jump reaches high addresses and last byte without wrap or one-past UI access', () => {
    const [spec] = specs(mem);
    const page = memoryJump(spec, 'FFFFFFFF');
    assert.deepEqual(memoryPage(spec, page), {start: 0xffffff80, length: 128, pages: 33554432, page: 33554431});
    assert.equal(memoryJump(spec, '80000000'), 16777216);
    assert.equal(formatMemoryAddress(0x80000000, spec), '80000000');
    assert.equal(formatMemoryAddress(1, spec), '00000001');
    for (const input of ['100000000', '-1', '1junk', '', '1.5', 'Infinity']) assert.equal(memoryJump(spec, input), null);
    assert.equal(memoryPage(spec, page + 1), null);
    assert.equal(memoryPage(spec, -1), null);
    assert.equal(memoryPage(spec, 0.5), null);
    const calls = [];
    const result = readMemoryPage({readMem: (...args) => {calls.push(args); return new Uint8Array(128).fill(0x5a);}}, spec, page);
    assert.deepEqual(calls, [['mem', 0xffffff80, 128]]);
    assert.equal(result.bytes[127], 0x5a);
});

test('per-read cap and inclusive nonzero bounds govern page requests', () => {
    const [spec] = specs({...mem, addressMin: 0x80000003, addressMax: 0x80000023, maxReadBytes: 16});
    assert.deepEqual(memoryPage(spec, 2), {start: 0x80000023, length: 1, pages: 3, page: 2});
    assert.equal(memoryJump(spec, '80000002'), null);
    assert.equal(memoryJump(spec, '80000024'), null);
    let request;
    readMemoryPage({readMem: (...args) => {request = args; return [0x7b];}}, spec, 2);
    assert.deepEqual(request, ['mem', 0x80000023, 1]);
});

test('refused, thrown, short or invalid reads become visible errors without fabricated bytes', () => {
    const [spec] = specs(mem);
    for (const value of [{unsupported: 'passive read refused'}, {refused: 'not paused'}, [], [256], null]) {
        const result = readMemoryPage({readMem: () => value}, spec, 0);
        assert.ok(result.error); assert.deepEqual(result.bytes, []);
    }
    assert.equal(readMemoryPage({readMem: () => {throw Error('device refuses');}}, spec, 0).error, 'device refuses');
    let calls = 0;
    assert.ok(readMemoryPage({readMem: () => {calls++;}}, spec, 33554432).error);
    assert.equal(calls, 0);
});

test('malformed/unknown explicit spaces never become editable legacy pages', () => {
    for (const descriptor of [{...mem, addressMax: undefined}, {read: true, write: true, addressMax: 255},
        Object.assign(Object.create({addressMax: 255}), {read: true, write: true}), Object.assign([], mem)]) {
        assert.deepEqual(specs(descriptor), []);
    }
    assert.deepEqual(memorySpaces(normalizeDebugCapabilities({runTo: [{kind: 'address', space: 'code',
        addressMin: 0, addressMax: 0xffffffff, stopSides: ['before'], installation: 'sync'}]}), legacy), []);
    assert.equal(specs(mem)[0].writable, false);
    assert.equal(specs({...mem, read: false}) .length, 0);
});

test('legacy targets retain declared spaces, bounds and curated write behavior', () => {
    const absent = memorySpaces(null, legacy)[0];
    assert.equal(absent.writable, true); assert.equal(absent.addressMax, 65535);
    const old = memorySpaces(normalizeDebugCapabilities({spaces: ['mem'], writable: ['mem']}), legacy)[0];
    assert.equal(old.writable, true); assert.equal(memoryJump(old, 'FFFF'), 511);
    const curated = memorySpaces(normalizeDebugCapabilities({spaces: {mem: {read: true, write: 'curated'}}}), legacy)[0];
    assert.equal(curated.writable, true);
});


test('pending edit/jump session is rejected after target or normalized rights switch', async () => {
    const runner = {}, writableCaps = normalizeDebugCapabilities({spaces: ['mem'], writable: ['mem']});
    const expected = {runner, capabilities: writableCaps};
    const [oldSpec] = memorySpaces(writableCaps, legacy);
    let release;
    const prompt = new Promise(resolve => {release = resolve;});
    let current = expected, writes = 0;
    const edit = (async () => {
        await prompt;
        if (memorySessionCurrent(expected, current) && memoryWritable(oldSpec, current.phase)) writes++;
    })();
    current = {runner, capabilities: normalizeDebugCapabilities({spaces: {mem}}), phase: 'paused'};
    release(); await edit;
    assert.equal(writes, 0);
    assert.equal(memorySessionCurrent(expected, {runner: {}, capabilities: writableCaps}), false);
    assert.equal(memorySessionCurrent(expected, current), false);
    assert.equal(memorySessionCurrent(expected, expected), true);
    assert.equal(memoryWritable(oldSpec, 'running'), false);
    assert.equal(memoryWritable(specs(mem)[0], 'paused'), false);
    assert.equal(memoryWritable(oldSpec, 'paused'), true);
});


test('actual legacy 8086 absence differs from explicit empty or rejected memory declarations', () => {
    const raw8086 = {steps: ['insn'], breakpoints: ['code'], timeFreezes: true};
    const normalized = normalizeDebugCapabilities(raw8086);
    assert.deepEqual(normalized.spaces, {});
    const [old] = memorySpaces(normalized, legacy, memorySpacesDeclared(raw8086));
    assert.equal(old.addressMax, 65535); assert.equal(old.writable, true);
    const rawWithRunTo = {...raw8086, runTo: [{kind: 'address', space: 'code', addressMin: 0,
        addressMax: 0xffffffff, stopSides: ['before'], installation: 'sync'}]};
    assert.equal(memorySpaces(normalizeDebugCapabilities(rawWithRunTo), legacy,
        memorySpacesDeclared(rawWithRunTo))[0].addressMax, 65535);
    for (const raw of [{spaces: {}}, {spaces: {mem: {read: true, write: true, addressMax: 255}}},
        {spaces: {mem: Object.assign(Object.create({addressMax: 255}), {read: true, write: true})}}]) {
        assert.deepEqual(memorySpaces(normalizeDebugCapabilities(raw), legacy, memorySpacesDeclared(raw)), []);
    }
    assert.equal(memorySpacesDeclared(Object.create({spaces: {}})), true);
    assert.deepEqual(memorySpaces(null, legacy, true), []);
    const raw = {spaces: {mem: {...mem, write: true}}};
    const strict = normalizeDebugCapabilities({spaces: {mem}});
    assert.equal(memorySpaces(strict, legacy, memorySpacesDeclared(raw))[0].writable, false);
});

test('unmounted drawer cancels pending memory writes and address jumps', async () => {
    const runner = {}, capabilities = normalizeDebugCapabilities({spaces: ['mem'], writable: ['mem']});
    const expected = {runner, capabilities, spacesDeclared: true};
    let release;
    const prompt = new Promise(resolve => {release = resolve;});
    let current = {...expected, mounted: true};
    let writes = 0, jumps = 0;
    const pending = (async () => {await prompt;
        if (!memorySessionCurrent(expected, current)) return;
        writes++; jumps++;
    })();
    current = {...expected, mounted: false}; release(); await pending;
    assert.equal(writes, 0); assert.equal(jumps, 0);
    assert.equal(memorySessionCurrent(expected, {...expected, mounted: true}), true);
    assert.equal(memorySessionCurrent(expected, {...expected, spacesDeclared: false, mounted: true}), false);
});

// Source-component unit test, not a browser or installed-GUI qualification.
// Use existing scratch-gui Babel dependencies; no generated product source.
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as memoryView from '../overlay/scratch-gui/src/lib/bw-debug/memory-view.js';
import * as memoryByteHelp from '../overlay/scratch-gui/src/lib/bw-debug/memory-byte-help.js';
import * as trace from '../overlay/scratch-gui/src/lib/bw-debug/trace.js';
import * as opcodes from '../overlay/scratch-gui/src/lib/bw-debug/opcodes.js';
const guiRequire = createRequire(new URL('../packages/scratch-gui/package.json', import.meta.url));
function loadDrawer (prompt) {
    const babel = guiRequire('@babel/core');
    const jsx = guiRequire('@babel/plugin-transform-react-jsx');
    const commonjs = guiRequire('@babel/plugin-transform-modules-commonjs');
    const source = readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/debug-drawer.jsx', import.meta.url), 'utf8');
    const code = babel.transformSync(source, {babelrc: false, configFile: false, plugins: [jsx, commonjs]}).code;
    class Component {
        constructor (props) {this.props = props; this.state = {};}
        setState (update) {Object.assign(this.state, typeof update === 'function' ? update(this.state) : update);}
        forceUpdate () {}
    }
    const react = {Component, createElement: (type, props, ...children) => ({type, props: props || {}, children: children.flat(Infinity)})};
    const modules = {react, 'prop-types': {}, '../../lib/bw-debug/trace.js': trace,
        '../../lib/bw-debug/opcodes.js': opcodes, '../../lib/bw-debug/trace-csv.js': {},
        '../../lib/native-dialog.js': {promptAsync: prompt}, '../../lib/bw-debug/memory-view.js': memoryView,
        '../../lib/bw-debug/memory-byte-help.js': memoryByteHelp};
    const context = {exports: {}, require: name => {
        assert.ok(Object.hasOwn(modules, name), `unexpected drawer import ${name}`); return modules[name];
    }};
    vm.runInNewContext(code, context, {timeout: 1000});
    return context.exports.DebugDrawer;
}
function elements (tree) {
    if (!tree || typeof tree !== 'object') return [];
    return [tree, ...tree.children.flatMap(elements)];
}
function componentFixture (Drawer, raw) {
    const reads = [], writes = [];
    const runner = {inspect: () => ({flavor: 'generic'}),
        readMem: (...args) => {reads.push(args); return Array(args[2]).fill(0x5a);},
        writeMem: (...args) => {writes.push(args); return null;}};
    const ui = {phase: 'paused', capabilities: raw, debugCapabilities: normalizeDebugCapabilities(raw)};
    const drawer = new Drawer({runner, ui}); drawer.componentDidMount();
    return {drawer, runner, reads, writes};
}

test('actual drawer cells respect read-only rights; legacy cell writes through its real handler', async () => {
    let prompts = 0;
    const Drawer = loadDrawer(async () => {prompts++; return 'AB';});
    const readonly = componentFixture(Drawer, {spaces: {mem}});
    const cell = elements(readonly.drawer.renderMemory()).find(e => e.type === 'span' && e.children[0] === '5A');
    assert.equal(cell.props.role, undefined);
    await cell.props.onClick(); assert.equal(prompts, 0); assert.equal(readonly.writes.length, 0);
    const old = componentFixture(Drawer, {steps: ['insn']});
    const editable = elements(old.drawer.renderMemory()).find(e => e.props.role === 'button');
    await editable.props.onClick();
    assert.equal(prompts, 1); assert.deepEqual(old.writes, [['mem', 0, 0xab]]);
});

test('actual pending drawer edit cancels on target switch, rights switch, running or unmount', async () => {
    for (const change of ['target', 'rights', 'running', 'unmount']) {
        let release;
        const Drawer = loadDrawer(() => new Promise(resolve => {release = resolve;}));
        const f = componentFixture(Drawer, {steps: ['insn']});
        const cell = elements(f.drawer.renderMemory()).find(e => e.props.role === 'button');
        const pending = cell.props.onClick();
        if (change === 'target') f.drawer.props = {...f.drawer.props, runner: {}};
        if (change === 'rights') f.drawer.props = {...f.drawer.props, ui: {phase: 'paused', capabilities: {spaces: {mem}}, debugCapabilities: normalizeDebugCapabilities({spaces: {mem}})}};
        if (change === 'running') f.drawer.props.ui.phase = 'running';
        if (change === 'unmount') f.drawer.componentWillUnmount();
        release('AB'); await pending; assert.equal(f.writes.length, 0, change);
    }
});

test('actual jump handler reads high last page; unmounted jump makes no state/read request', async () => {
    let release;
    const Drawer = loadDrawer(() => new Promise(resolve => {release = resolve;}));
    const f = componentFixture(Drawer, {spaces: {mem}});
    const jump = () => elements(f.drawer.renderMemory()).find(e => e.type === 'button' && e.children[0] === 'Go to address');
    let pending = jump().props.onClick(); release('FFFFFFFF'); await pending;
    f.drawer.renderMemory(); assert.deepEqual(f.reads.at(-1), ['mem', 0xffffff80, 128]);
    pending = jump().props.onClick(); f.drawer.componentWillUnmount();
    const before = f.drawer.state.page, reads = f.reads.length;
    release('0'); await pending; assert.equal(f.drawer.state.page, before); assert.equal(f.reads.length, reads);
});


test('raw absence never overrides known normalized read-only or denied spaces', () => {
    const normalized = normalizeDebugCapabilities({spaces: {mem}});
    const [spec] = memorySpaces(normalized, legacy, false);
    assert.equal(spec.writable, false); assert.equal(spec.addressMax, 0xffffffff);
    assert.equal(memoryJump(spec, 'FFFFFFFF'), 33554431);
    assert.deepEqual(memorySpaces(normalizeDebugCapabilities({spaces: {mem: {...mem, read: false}}}), legacy, false), []);
});

test('actual drawer preserves normalized read-only bounds despite inconsistent raw absence', async () => {
    let prompts = 0;
    const Drawer = loadDrawer(async () => {prompts++; return 'AA';});
    const f = componentFixture(Drawer, {steps: ['insn']});
    f.drawer.props.ui.debugCapabilities = normalizeDebugCapabilities({spaces: {mem}});
    f.drawer.state.page = 33554431;
    const cell = elements(f.drawer.renderMemory()).find(e => e.type === 'span' && e.children[0] === '5A');
    assert.deepEqual(f.reads.at(-1), ['mem', 0xffffff80, 128]);
    assert.equal(cell.props.role, undefined); await cell.props.onClick();
    assert.equal(prompts, 0); assert.equal(f.writes.length, 0);
    f.drawer.props.ui.debugCapabilities = normalizeDebugCapabilities({spaces: {mem: {...mem, read: false}}});
    const count = f.reads.length;
    assert.equal(f.drawer.renderMemory().children[0], 'Memory inspection is unavailable for this target.');
    assert.equal(f.reads.length, count);
});
