// The File menu's four circuit actions must reach a receiver — including from a
// cold start, before the Circuit tab has ever been opened.
//
// THE CLASS OF BUG THIS HOLDS. bw-circuit-ui 1397493 deleted an import entry that
// "did nothing, said nothing and logged nothing for its entire life", and two whole
// menu COMPONENTS that were imported and placed in no tree. Lite has the same shape
// available to it in a different form: menu-bar.jsx dispatches a `bw-circuit-file`
// CustomEvent, and the only receiver is bw-circuit-ui's CircuitDesigner, which lite
// mounts LAZILY — `circuit-tab.jsx` calls `load()` only when the tab is visible or
// portalled into the stage column. A user who opens the File menu first therefore
// dispatched into an empty room: four menu items, no listener, no error.
//
// Two properties, because they fail independently:
//   1. every action the menu can dispatch is one the vendored receiver handles;
//   2. lite registers a cold-start listener that is NOT behind the visibility guard,
//      and replays the queued action once the receiver exists.
//
// A source scan rather than a rendered probe: there is no DOM harness in this repo
// (no jsdom, no testing-library), and the browser gates cover the designer once it is
// already up — which is precisely the state in which this bug is invisible.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scopeAfter} from './helpers/js-scope.mjs';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const requireGui = createRequire(new URL('../packages/scratch-gui/package.json', import.meta.url));
const requireBabel = createRequire(requireGui.resolve('@babel/core'));
const {parse} = requireBabel('@babel/parser');

const MENU_BAR = 'overlay/scratch-gui/src/components/menu-bar/menu-bar.jsx';
const CIRCUIT_TAB = 'overlay/scratch-gui/src/components/tw-pseudocode/circuit-tab.jsx';
const DESIGNER = 'node_modules/bw-circuit-ui/src/components/CircuitDesigner.jsx';
const CANVAS = 'node_modules/bw-circuit-ui/src/components/BoardCanvas.jsx';
const REGISTRY = 'node_modules/bw-circuit-ui/src/model/exporters/registry.js';
const SCOPE = 'node_modules/bw-circuit-ui/src/components/ScopePanel.jsx';
const SWEEP = 'node_modules/bw-circuit-ui/src/components/SweepPanel.jsx';
const EXPORT_PROOF = 'scripts/verify-circuit-export-completeness.mjs';

const dispatchedActions = src => {
    const found = new Set();
    // `new CustomEvent('bw-circuit-file', {detail: {action: 'load'}})`
    const re = /'bw-circuit-file'[^)]*?action:\s*'([a-z]+)'/g;
    let m;
    while ((m = re.exec(src))) found.add(m[1]);
    return found;
};

test('every circuit action the File menu dispatches is one the vendored receiver handles', () => {
    const actions = [...dispatchedActions(read(MENU_BAR))].sort();
    // The owner's design note in menu-bar.jsx: "exactly four top-level actions and
    // nothing more". Pinned, so adding a fifth has to come here and be checked
    // against the receiver rather than shipping as another silent no-op.
    assert.deepStrictEqual(actions, ['export', 'import', 'load', 'save'],
        'the File menu no longer dispatches exactly the four documented circuit actions');

    const designer = read(DESIGNER);
    // The receiver's own switch, read out of the vendored source. Not a hand-copied
    // list: if a re-vendor drops a branch, this goes red naming the action.
    const handled = new Set();
    for (const m of designer.matchAll(/action\s*===\s*'([a-z]+)'/g)) handled.add(m[1]);
    for (const action of actions) {
        assert.ok(handled.has(action),
            `File menu dispatches '${action}' and bw-circuit-ui's CircuitDesigner ` +
            `listener has no branch for it — the menu item is a silent no-op`);
    }
});

test('the cold-start listener is registered unconditionally, and replays what it queued', () => {
    const tab = read(CIRCUIT_TAB);

    // A direct statement in the actual mount body cannot be hidden inside its
    // visibility guard or borrowed from a later method that happens to load examples.
    const ast = parse(tab, {sourceType: 'module', plugins: ['jsx']});
    const host = ast.program.body.find(node => node.type === 'ClassDeclaration' && node.id.name === 'CircuitTab');
    const mount = host?.body.body.find(node => node.key?.name === 'componentDidMount');
    assert.ok(mount, 'actual Circuit tab mount method');
    const registrations = mount.body.body.filter(node => {
        const call = node.type === 'ExpressionStatement' && node.expression;
        return call?.type === 'CallExpression' && call.callee.type === 'MemberExpression' &&
            call.callee.object.name === 'window' && call.callee.property.name === 'addEventListener' &&
            call.arguments[0]?.value === 'bw-circuit-file' && call.arguments[1]?.type === 'MemberExpression' &&
            call.arguments[1].object.type === 'ThisExpression' && call.arguments[1].property.name === '_circuitFileWake';
    });
    assert.equal(registrations.length, 1,
        'one unconditional mount statement registers the real cold-start wake handler');

    // It must hand the action on rather than swallow it, and it must not echo itself.
    assert.match(tab, /_circuitFilePending/,
        'no queue for the action that arrived before the receiver existed');
    assert.match(tab, /bwReplay/,
        'the replay carries no marker, so the wake handler would re-queue its own echo');
    assert.match(tab, /removeEventListener\('bw-circuit-file'/,
        'the listener is never removed on unmount');
});

test('the replayed export is owned above all three circuit views', () => {
    const designer = read(DESIGNER);
    const canvas = read(CANVAS);
    assert.match(designer, /import \{ BoardCanvas, FileMenu \}/,
        'the designer does not own the same registry-backed picker as the canvas');
    assert.match(designer, /data-host-file-command[\s\S]*<FileMenu[\s\S]*fileAction=\{fileAction\}/,
        'the host export command has no actionable picker outside the view branch');
    const canvasMount = designer.slice(designer.indexOf('<BoardCanvas'),
        designer.indexOf('<BoardCanvas') + 9000);
    assert.doesNotMatch(canvasMount, /fileAction=|onFileActionDone=/,
        'host export still terminates in BoardCanvas and disappears in Schematic/Board view');
    assert.match(canvas, /export function FileMenu/,
        'the persistent owner copied a format list instead of reusing the actionable picker');
});

test('the vendored export registry and instruments expose the completed formats', () => {
    const registry = read(REGISTRY);
    assert.match(registry, /id: 'circuitikz'[\s\S]*name: 'schematic\.tex'[\s\S]*mime: 'text\/x-tex'/,
        'the pinned registry does not ship the deterministic Circuitikz document');
    assert.match(read(SCOPE), /scope-trace\.csv/);
    assert.match(read(SCOPE), /scope-spectrum\.csv/);
    assert.match(read(SWEEP), /mode === 'vi' \? 'sweep-vi\.csv' : 'sweep-bode\.csv'/);
});

test('the deployed export proof uses ScopePanel actual channel label', () => {
    const proof = read(EXPORT_PROOF);
    assert.match(proof, /name: \/\^\\\+ \(\?:channel\|Kanal\)\$\//,
        'the browser proof must select the compact bilingual + channel button');
    assert.doesNotMatch(proof, /name: \/Add channel\//,
        'the prose label is not rendered by ScopePanel and makes production proof time out');
    assert.match(proof, /item\.id === '50-rc-scope'/,
        'the deployed journey must load the named, time-varying scope fixture');
    assert.match(proof, /getByRole\('radio', \{name: 'Sim mode'\}\)\.click/,
        'a pure circuit only advances and captures trace data in simulation mode');
});

function wakeFixture (text = read(CIRCUIT_TAB), mounted = false) {
    const calls = [];
    const host = {state: {Designer: function CachedDesigner () {}, error: null},
        _boxRef: {current: mounted ? {} : null},
        props: {onShowCircuit: () => calls.push('show')},
        load: options => calls.push(options)};
    const wake = new Function('e', scopeAfter(text, '_circuitFileWake (e)')).bind(host);
    return {host, calls, wake};
}

test('cached designer code without a mounted receiver wakes the real Circuit tab for every File action', () => {
    for (const action of ['save', 'load', 'import', 'export']) {
        const {host, calls, wake} = wakeFixture();
        wake({detail: {action}});
        assert.deepEqual(calls, ['show', {explicit: true}], action);
        assert.equal(host._circuitFilePending, action);
    }
});

test('a mounted receiver owns direct delivery; a replay never queues itself', () => {
    const live = wakeFixture(undefined, true);
    live.wake({detail: {action: 'save'}});
    assert.deepEqual(live.calls, []);
    const hidden = wakeFixture();
    hidden.wake({detail: {action: 'save', bwReplay: true}});
    assert.deepEqual(hidden.calls, []);
});

function replayJourney (text = read(CIRCUIT_TAB)) {
    const frames = [], events = [];
    const host = {_boxRef: {current: null}, _circuitFilePending: 'save', _circuitFileReplayFrame: null};
    const replay = new Function('requestAnimationFrame', 'window', 'CustomEvent',
        scopeAfter(text, '_replayCircuitFile ()')).bind(host,
        fn => {frames.push(fn); return frames.length;},
        {dispatchEvent: event => events.push(event)}, class {constructor (type, options) {this.type = type; this.detail = options.detail;}});
    replay();
    assert.equal(frames.length, 0);
    host._boxRef.current = {};
    replay(); replay();
    assert.equal(frames.length, 1);
    assert.equal(events.length, 0);
    frames[0]();
    assert.equal(host._circuitFilePending, null);
    assert.equal(host._circuitFileReplayFrame, null);
    assert.deepEqual(events.map(event => ({type: event.type, detail: event.detail})),
        [{type: 'bw-circuit-file', detail: {action: 'save', bwReplay: true}}]);
    replay();
    assert.equal(frames.length, 1);
}

test('replay waits for a receiver and coalesces updates until its frame fires', () => replayJourney());

test('omitting the actual replay fails the same queued-command journey', () => {
    const text = read(CIRCUIT_TAB);
    const body = scopeAfter(text, '_replayCircuitFile ()');
    const mutant = text.replace(body, body.replace('window.dispatchEvent(', 'void ('));
    assert.notEqual(mutant, text);
    assert.throws(() => replayJourney(mutant), /deep-equal/);
});

test('omitting tab activation fails the cached-receiver wake journey', () => {
    const text = read(CIRCUIT_TAB);
    const mutant = text.replace('this.props.onShowCircuit?.();', '/* omitted */');
    assert.notEqual(mutant, text);
    const {calls, wake} = wakeFixture(mutant);
    wake({detail: {action: 'save'}});
    assert.notDeepEqual(calls, ['show', {explicit: true}]);
});

test('a hidden receiver preserves the actual current circuit before changing tabs', () => {
    const {host, calls, wake} = wakeFixture();
    const saved = {parts: [{id: 'authored', kind: 'resistor', params: {ohms: 1234}}], wires: []};
    host.state.circuit = {toJSON: () => saved};
    host.setState = patch => {Object.assign(host.state, patch); calls.push('snapshot');};
    wake({detail: {action: 'save'}});
    assert.deepEqual(calls, ['snapshot', 'show', {explicit: true}]);
    assert.equal(host.state.circuitData, saved);
});
