import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import JSZip from 'jszip';
import Creator from '../overlay/scratch-gui/src/lib/sb3-creator.js';
import {conversionFailure} from '../overlay/scratch-gui/src/lib/bw-conversion-error.js';
import {codeArtworkMatches} from '../overlay/scratch-gui/src/lib/bw-code-artwork.js';
import {balancedFrom} from './helpers/js-scope.mjs';
import {codeDocumentEditorClass, codeEditorMethod} from './helpers/code-document-editor.mjs';
import {VM} from './helpers/bw-vm.mjs';
import {importGuiDependency} from './helpers/bw-integrated.mjs';

test('serialized and object VM diagnostics retain every SB3 path and omit unrelated SB2 errors', () => {
    const error = {validationError: 'Invalid project', sb2Errors: [{message: 'missing objName'}], sb3Errors: [
        {dataPath: '.targets[1].costumes', message: 'duplicate costumes'},
        {instancePath: '/targets/0/blocks', message: 'invalid blocks'}
    ]};
    for (const value of [error, JSON.stringify(error)]) {
        const result = conversionFailure(value);
        assert.deepEqual(result.issues, ['.targets[1].costumes: duplicate costumes', '/targets/0/blocks: invalid blocks']);
        assert.match(result.message, /Invalid project/);
        assert.doesNotMatch(result.message, /objName|undefined/);
    }
    assert.deepEqual(conversionFailure(new Error('Broken asset')), {message: 'Broken asset', issues: ['Broken asset']});
    assert.equal(conversionFailure('plain rejection').message, 'plain rejection');
    const cyclic = {}; cyclic.self = cyclic;
    for (const value of [undefined, cyclic]) assert.match(conversionFailure(value).message, /without an error message/);
});

test('actual Code compile catch displays a real VM serialized validation rejection and preserves the loaded project', async () => {
    const source = await fs.readFile(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx', import.meta.url), 'utf8');
    const Editor = codeDocumentEditorClass(source,
        codeEditorMethod(source, 'async compile ({strict = false, pseudocode = null, scratchExample = false} = {}) {'), {
            TWO_WAY: new Set(['pseudocode']), LANG_LABEL: {pseudocode: 'Pseudocode'},
            codeArtworkMatches, conversionFailure, DOS_LANG: {}
        });
    class InvalidCostumes extends Creator {
        async generateSB3 () {
            const zip = await JSZip.loadAsync(await (await super.generateSB3()).arrayBuffer());
            const project = JSON.parse(await zip.file('project.json').async('text'));
            const target = project.targets.find(row => row.costumes.length);
            target.costumes.push(structuredClone(target.costumes[0]));
            zip.file('project.json', JSON.stringify(project));
            return new Blob([await zip.generateAsync({type: 'uint8array'})]);
        }
    }
    const vm = new VM();
    const Storage = (await importGuiDependency('scratch-storage/dist/node/scratch-storage.js')).default;
    vm.attachStorage(new Storage());
    const baseline = new Creator(); baseline.parse('SPRITE Game:\nWHEN flag clicked:\n  say "ready"');
    await vm.loadProject(await (await baseline.generateSB3()).arrayBuffer());
    const stage = vm.runtime.getTargetForStage(), before = vm.toJSON();
    const code = 'SPRITE Game:\nWHEN flag clicked:\n  say "changed"';
    const context = Object.assign(new Editor(), {props: {vm}, state: {lang: 'pseudocode',
        buffers: {pseudocode: code}, uploads: [], driverMode: 'shim', asyncMode: false,
        eventsMode: false, jsExecution: 'classic', basicProfile: 'bbc', basicLineNumbers: true},
        _animationImport: null, _codeArtwork: null,
        L: {stCompiling: 'Compiling', stError: message => `Error: ${message}`},
        activeCode: () => code,
        lib: async () => ({default: InvalidCostumes}), setState (patch) {
            // Match React's functional updater contract as well as object patches.
            const update = typeof patch === 'function' ? patch(this.state) : patch;
            if (update) Object.assign(this.state, update);
        }});
    try {
        await context.compile();
        assert.match(context.state.status, /Could not parse as a valid SB2 or SB3 project/);
        assert.match(context.state.status, /\.targets\[\d+\]\.costumes:.*duplicate/);
        assert.doesNotMatch(context.state.status, /undefined|objName/);
        assert.equal(context.state.conversionReport.preserved, false);
        assert.ok(context.state.conversionReport.unsupported.every(issue => issue.includes('costumes')));
        assert.equal(context.state.busy, false);
        assert.strictEqual(vm.runtime.getTargetForStage(), stage);
        assert.equal(vm.toJSON(), before);
        await assert.rejects(context.compile({strict: true}), rejection => typeof rejection === 'string' && rejection.includes('uniqueItems'));
        assert.equal(context.state.busy, false);
    } finally {vm.quit();}
});


test('Arcade reporting is isolated from existing Blocks/Code reports and observer errors', async () => {
    const source = await fs.readFile(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx', import.meta.url), 'utf8');
    const extract = signature => balancedFrom(source, source.indexOf(signature) + signature.length, '{', '}', signature).slice(1, -1);
    const invalidate = new Function(extract('invalidateArcadeReport ()'));
    const publish = new Function('request', 'out', 'operation', 'outcome', extract('publishArcadeReport (request, out, operation, outcome)'));
    const prior = {direction: 'Code → Blocks', preserved: true, changed: [], unsupported: []};
    const c = {props: {vm: {}}, state: {conversionReport: prior}, setState (patch) {Object.assign(this.state, patch);}};
    invalidate.call(c);assert.strictEqual(c.state.conversionReport, prior, 'ordinary conversion report remains owned by its original journey');
    const request = {vm: c.props.vm, revision: c._arcadeReportRevision};c._arcadeReportRequest = request;
    const original = new Error('report delivery failed');c.setState = () => {throw original;};
    assert.doesNotThrow(() => publish.call(c, request, {unsupported: ['original refusal']}, 'export', 'source saved'));
    assert.strictEqual(c.state.conversionReport, prior, 'a report transport failure does not invent a new result');
    const exportBody = extract('async exportArcade ()');
    assert.match(exportBody, /await downloadBlob/);assert.match(exportBody, /this\.L\.mcFailed\('MakeCode Arcade'/);
    assert.match(source, /if \(this\._unmounted \|\| this\._arcadeReportRequest !== request/);
});

// Execute only the extracted observer against synthetic data/fibers. These are
// source controls, never a claim about a mounted production GUI or browser.
const cleanExportObserver = async () => {
    const source = await fs.readFile(new URL('../scripts/verify-arcade-numeric-authoring-gui.mjs', import.meta.url), 'utf8');
    const signature = 'const observeCleanExport = (element, {phase, held, visibleText}) =>';
    const at = source.indexOf(signature);assert.ok(at >= 0, 'actual observer declaration');
    const body = balancedFrom(source, at + signature.length, '{', '}', 'clean export observer').slice(1, -1);
    return new Function('window', 'element', 'args', `const {phase, held, visibleText} = args;\n${body}`);
};
const cleanExportFixture = (key = '__reactFiber$sourceControl') => {
    let methods = 0;
    const forbidden = () => { methods++;throw new Error('observer called a product method'); };
    const vm = {toJSON: forbidden}, instance = {props: {vm}, state: {conversionReport: null, busy: false},
        _arcadeReportRequest: null, _arcadeReportRevision: 7, _unmounted: false,
        setState: forbidden, exportArcade: forbidden, arcadeFromStage: forbidden};
    const fiber = {stateNode: instance, return: null}, element = {[key]: fiber, parentElement: null};
    const window = {__brickwrightStore: {getState: () => ({scratchGui: {vm}})}};
    const observation = {schema: 'arcade-clean-export-observation-v1', origin: 'owned-json-export',
        captureStatus: 'COMPLETE', inputJson: '{"targets":[]}', resultJson: '{"unsupported":["receiver"]}',
        inputUtf8Bytes: 14, resultUtf8Bytes: 28, totalUtf8Bytes: 42, limitUtf8Bytes: 8388608};
    const publish = () => {
        instance._arcadeReportRequest = {vm, revision: 7};
        instance.state.conversionReport = {operation: 'export', unsupported: ['receiver'], observation};
    };
    return {window, element, fiber, instance, vm, observation, publish, methods: () => methods};
};

test('clean export observer retains the actual mount before one action and returns only current plain evidence', async () => {
    const observe = await cleanExportObserver();
    for (const key of ['__reactFiber$sourceControl', '__reactInternalInstance$sourceControl']) {
        const f = cleanExportFixture(key), held = observe(f.window, f.element, {phase: 'before'});
        assert.equal(held.status, 'READY');assert.strictEqual(held.instance, f.instance);assert.strictEqual(held.vm, f.vm);
        assert.equal(held.revision, 7);f.publish();
        const before = Object.getOwnPropertyDescriptors(f.instance), state = Object.getOwnPropertyDescriptors(f.instance.state);
        const result = observe(f.window, f.element, {phase: 'after', held, visibleText: 'Unsupported: receiver'});
        assert.deepEqual(result, f.observation);assert.notStrictEqual(result, f.observation);
        assert.ok(Object.values(result).every(value => typeof value === 'string' || typeof value === 'number'));
        assert.deepEqual(Object.getOwnPropertyDescriptors(f.instance), before);
        assert.deepEqual(Object.getOwnPropertyDescriptors(f.instance.state), state);assert.equal(f.methods(), 0);
    }
});

test('clean export observation refuses stale preconditions and foreign or changed post-action ownership', async () => {
    const observe = await cleanExportObserver(), refused = reasonCode => ({captureStatus: 'UNAVAILABLE_FRESHNESS', reasonCode});
    // An idle retained report is a prior identity, not evidence that the next
    // actual export may be skipped or its result reused.
    const prior = cleanExportFixture(), priorReport = {operation: 'export'};
    prior.instance.state.conversionReport = priorReport;
    const priorHeld = observe(prior.window, prior.element, {phase: 'before'});assert.equal(priorHeld.status, 'READY');
    assert.strictEqual(priorHeld.report, priorReport);assert.strictEqual(priorHeld.request, null);
    prior.publish();assert.notStrictEqual(prior.instance.state.conversionReport, priorReport);
    assert.deepEqual(observe(prior.window, prior.element, {phase: 'after', held: priorHeld, visibleText: 'Unsupported: receiver'}), prior.observation);
    assert.equal(prior.methods(), 0);
    const retained = cleanExportFixture(), retainedRequest = {vm: retained.vm, revision: 7};
    retained.instance._arcadeReportRequest = retainedRequest;
    const retainedHeld = observe(retained.window, retained.element, {phase: 'before'});assert.equal(retainedHeld.status, 'READY');
    assert.strictEqual(retainedHeld.request, retainedRequest);assert.strictEqual(retainedHeld.report, null);
    retained.instance.state.conversionReport = {operation: 'export', unsupported: ['receiver'], observation: retained.observation};
    assert.deepEqual(observe(retained.window, retained.element, {phase: 'after', held: retainedHeld, visibleText: 'Unsupported: receiver'}), refused('REQUEST_REUSED'));
    assert.strictEqual(retained.instance._arcadeReportRequest, retainedRequest);assert.equal(retained.methods(), 0);
    for (const [edit,reason] of [
        [f => { f.instance.state.busy = true; },'COMPONENT_BUSY'], [f => { f.instance._unmounted = true; },'COMPONENT_DISPOSED']
    ]) {
        const f = cleanExportFixture();edit(f);assert.deepEqual(observe(f.window, f.element, {phase: 'before'}), refused(reason));
    }
    for (const [edit,reason] of [
        [f => { f.fiber.stateNode = {...f.instance}; },'OWNER_CHANGED'],
        [f => { f.instance.props.vm = {}; },'OWNER_AMBIGUOUS'], [f => { f.instance._arcadeReportRevision++; },'REVISION_CHANGED'],
        [f => { f.instance._arcadeReportRequest = null; },'REQUEST_INVALID'],
        [f => { f.instance._arcadeReportRequest.vm = {}; },'REQUEST_INVALID'],
        [f => { f.instance._arcadeReportRequest.revision++; },'REQUEST_INVALID'],
        [f => { f.instance._unmounted = true; },'COMPONENT_DISPOSED'], [f => { f.instance.state.busy = true; },'COMPONENT_BUSY'],
        [f => { f.instance.state.conversionReport.operation = 'run'; },'REPORT_OPERATION']
    ]) {
        const f = cleanExportFixture(), held = observe(f.window, f.element, {phase: 'before'});assert.equal(held.status, 'READY');
        f.publish();edit(f);
        assert.deepEqual(observe(f.window, f.element, {phase: 'after', held, visibleText: 'Unsupported: receiver'}), refused(reason));
        assert.equal(f.methods(), 0);
    }
    const f = cleanExportFixture(), held = observe(f.window, f.element, {phase: 'before'});f.publish();
    assert.deepEqual(observe(f.window, f.element, {phase: 'after', held, visibleText: 'Unsupported: nothing reported'}), refused('VISIBLE_TEXT_CHANGED'));
});

test('clean export observer rejects missing ambiguous cyclic and incomplete fiber ancestry', async () => {
    const observe = await cleanExportObserver(), refused = reasonCode => ({captureStatus: 'UNAVAILABLE_FRESHNESS', reasonCode});
    for (const [edit,reason] of [
        [f => { delete f.element.__reactFiber$sourceControl; },'FIBER_POINTER_MISSING'],
        [f => { f.element.__reactFiber$second = f.fiber; },'FIBER_POINTER_AMBIGUOUS'],
        [f => { f.fiber.return = {stateNode: {...f.instance}, return: null}; },'OWNER_AMBIGUOUS'],
        [f => { f.fiber.return = f.fiber; },'FIBER_CYCLE'],
        [f => { let tail = f.fiber;for (let i = 0; i < 129; i++) tail = tail.return = {stateNode: null, return: null}; },'FIBER_DEPTH']
    ]) {
        const f = cleanExportFixture();edit(f);assert.deepEqual(observe(f.window, f.element, {phase: 'before'}), refused(reason));
        assert.equal(f.methods(), 0);
    }
});

test('clean export observer declines descriptor getters without invoking them or product methods', async () => {
    const observe = await cleanExportObserver(), refused = {captureStatus: 'UNAVAILABLE_FRESHNESS', reasonCode: 'NON_DATA_STATE'};
    for (const slot of ['state', 'request', 'unsupported', 'observation', 'payload']) {
        const f = cleanExportFixture(), held = observe(f.window, f.element, {phase: 'before'});f.publish();let gets = 0;
        const [object, name] = slot === 'state' ? [f.instance, 'state'] : slot === 'request' ? [f.instance, '_arcadeReportRequest'] :
            slot === 'payload' ? [f.observation, 'inputJson'] : [f.instance.state.conversionReport, slot];
        Object.defineProperty(object, name, {configurable: true, get () {gets++;throw new Error('unexpected getter');}});
        assert.deepEqual(observe(f.window, f.element, {phase: 'after', held, visibleText: 'Unsupported: receiver'}), refused);
        assert.equal(gets, 0, slot);assert.equal(f.methods(), 0);
    }
});

test('a genuine fresh constructor state with no request or revision slot observes only its new same-owner export', async () => {
    const observe = await cleanExportObserver(), f = cleanExportFixture();
    delete f.instance._arcadeReportRequest;delete f.instance._arcadeReportRevision;delete f.instance._unmounted;
    assert.equal(Object.hasOwn(f.instance, '_arcadeReportRequest'), false);
    assert.equal('_arcadeReportRequest' in f.instance, false);
    const instanceBefore = Object.getOwnPropertyDescriptors(f.instance), stateBefore = Object.getOwnPropertyDescriptors(f.instance.state);
    const held = observe(f.window, f.element, {phase: 'before'});
    assert.equal(held.status, 'READY');assert.strictEqual(held.instance, f.instance);assert.strictEqual(held.vm, f.vm);assert.equal(held.revision, 0);
    assert.deepEqual(Object.getOwnPropertyDescriptors(f.instance), instanceBefore);
    assert.deepEqual(Object.getOwnPropertyDescriptors(f.instance.state), stateBefore);
    assert.deepEqual(observe(f.window, f.element, {phase: 'after', held, visibleText: 'Unsupported: receiver'}),
        {captureStatus: 'UNAVAILABLE_FRESHNESS', reasonCode: 'REQUEST_INVALID'}, 'absence before cannot stand in for a new post-action request');
    f.instance._arcadeReportRequest = {vm: f.vm, revision: 0};
    f.instance.state.conversionReport = {operation: 'export', unsupported: ['receiver'], observation: f.observation};
    const after = Object.getOwnPropertyDescriptors(f.instance), stateAfter = Object.getOwnPropertyDescriptors(f.instance.state);
    const result = observe(f.window, f.element, {phase: 'after', held, visibleText: 'Unsupported: receiver'});
    assert.deepEqual(result, f.observation);assert.notStrictEqual(result, f.observation);
    assert.deepEqual(Object.getOwnPropertyDescriptors(f.instance), after);
    assert.deepEqual(Object.getOwnPropertyDescriptors(f.instance.state), stateAfter);assert.equal(f.methods(), 0);
});

test('own undefined and inherited request slots retain exact unavailable causes without reading a getter or admitting stale evidence', async () => {
    const observe = await cleanExportObserver();
    for (const kind of ['own undefined', 'inherited null', 'inherited getter']) {
        const f = cleanExportFixture();let gets = 0;
        if (kind === 'own undefined') f.instance._arcadeReportRequest = undefined;
        else {
            delete f.instance._arcadeReportRequest;
            const prototype = Object.create(Object.getPrototypeOf(f.instance));
            Object.defineProperty(prototype, '_arcadeReportRequest', kind === 'inherited null' ? {value: null} :
                {get () {gets++;throw new Error('inherited request getter must not execute');}});
            Object.setPrototypeOf(f.instance, prototype);
        }
        const reasonCode = kind === 'own undefined' ? 'PRE_REQUEST_UNDEFINED' : 'PRE_REQUEST_INHERITED';
        const before = Object.getOwnPropertyDescriptors(f.instance), held = observe(f.window, f.element, {phase: 'before'});
        assert.deepEqual(held, {captureStatus: 'UNAVAILABLE_FRESHNESS', reasonCode});
        assert.deepEqual(Object.getOwnPropertyDescriptors(f.instance), before);assert.equal(gets, 0);assert.equal(f.methods(), 0);
        // Make a real own current token without reading or assigning through an inherited accessor.
        Object.defineProperty(f.instance, '_arcadeReportRequest', {value: {vm: f.vm, revision: 7}, writable: true, configurable: true, enumerable: true});
        f.instance.state.conversionReport = {operation: 'export', unsupported: ['receiver'], observation: f.observation};
        assert.deepEqual(observe(f.window, f.element, {phase: 'after', held, visibleText: 'Unsupported: receiver'}),
            {captureStatus: 'UNAVAILABLE_FRESHNESS', reasonCode: 'HELD_NOT_READY', beforeReason: reasonCode});
        assert.equal(gets, 0);assert.equal(f.methods(), 0);
    }
    const f = cleanExportFixture(), held = observe(f.window, f.element, {phase: 'before'});f.publish();
    assert.deepEqual(observe(f.window, f.element, {phase: 'after', held: {...held, vm: {}}, visibleText: 'Unsupported: receiver'}),
        {captureStatus: 'UNAVAILABLE_FRESHNESS', reasonCode: 'VM_CHANGED'});
    delete f.instance._arcadeReportRequest;
    Object.setPrototypeOf(f.instance, {_arcadeReportRequest: {vm: f.vm, revision: 7}});
    assert.deepEqual(observe(f.window, f.element, {phase: 'after', held, visibleText: 'Unsupported: receiver'}),
        {captureStatus: 'UNAVAILABLE_FRESHNESS', reasonCode: 'REQUEST_INVALID'}, 'an inherited post request never acquires own token identity');
    assert.equal(f.methods(), 0);
    const verifier = await fs.readFile(new URL('../scripts/verify-arcade-numeric-authoring-gui.mjs', import.meta.url), 'utf8');
    assert.match(verifier, /reasonCode:\s*observed\.reasonCode/, 'Node artifact retains the bounded unavailable reason');
    assert.match(verifier, /beforeReason:\s*observed\.beforeReason/, 'Node artifact retains the actual failed precondition reason');
});


const realReportTransitions = async fixture => {
    const source = await fs.readFile(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx', import.meta.url), 'utf8');
    const extract = signature => {
        const at = source.indexOf(signature);assert.ok(at >= 0, signature);
        return balancedFrom(source, at + signature.length, '{', '}', signature).slice(1, -1);
    };
    assert.ok(source.includes('onClick={event => { event.stopPropagation(); this.setState({conversionReport: null}); }}'),
        'actual report-dismiss handler changes the report state without replacing the request');
    const begin = new Function(extract('beginArcadeReport ()'));
    const publish = new Function('request', 'out', 'operation', 'outcome', extract('publishArcadeReport (request, out, operation, outcome)'));
    let methods = 0;
    fixture.instance.setState = function (patch) {
        methods++;const update = typeof patch === 'function' ? patch(this.state) : patch;if (update) Object.assign(this.state, update);
    };
    const start = () => {methods++;return begin.call(fixture.instance);};
    const finish = (request, operation = 'export') => {
        methods++;publish.call(fixture.instance, request, {unsupported: ['receiver'], unsupportedDetails: [],
            refusalEvidence: {ownedJsonObservation: fixture.observation}}, operation, 'actual extracted report publication');
    };
    return {start, finish, methods: () => methods};
};

test('an idle prior export run import or dismissed report is followed by the actual new request and report at the same revision', async () => {
    const observe = await cleanExportObserver();
    for (const kind of ['prior export', 'prior run', 'import report', 'dismissed report']) {
        const f = cleanExportFixture(), transitions = await realReportTransitions(f);
        if (kind === 'import report') {
            f.instance.state.conversionReport = {direction: 'Code → Blocks', preserved: true, changed: [], unsupported: []};
        } else {
            const initial = transitions.start();transitions.finish(initial, kind === 'prior run' ? 'run' : 'export');
            if (kind === 'dismissed report') {
                assert.ok(f.instance.state.conversionReport);
                f.instance.setState({conversionReport: null});
                assert.strictEqual(f.instance._arcadeReportRequest, initial, 'the actual dismiss state update retains the prior request token');
                assert.equal(f.instance.state.conversionReport, null);
            }
        }
        const oldRequest = f.instance._arcadeReportRequest, oldReport = f.instance.state.conversionReport;
        const revision = f.instance._arcadeReportRevision, instance = Object.getOwnPropertyDescriptors(f.instance), state = Object.getOwnPropertyDescriptors(f.instance.state);
        const beforeMethods = transitions.methods(), held = observe(f.window, f.element, {phase: 'before'});
        assert.equal(held.status, 'READY');assert.equal(held.revision, revision);
        assert.strictEqual(held.request, oldRequest);assert.strictEqual(held.report, oldReport);
        assert.deepEqual(Object.getOwnPropertyDescriptors(f.instance), instance);assert.deepEqual(Object.getOwnPropertyDescriptors(f.instance.state), state);
        assert.equal(transitions.methods(), beforeMethods);assert.equal(f.methods(), 0);
        const next = transitions.start();transitions.finish(next);
        assert.notStrictEqual(next, oldRequest);assert.notStrictEqual(f.instance.state.conversionReport, oldReport);
        assert.equal(f.instance._arcadeReportRevision, revision, 'begin/publish create new identities without inventing a revision change');
        const afterMethods = transitions.methods(), afterInstance = Object.getOwnPropertyDescriptors(f.instance), afterState = Object.getOwnPropertyDescriptors(f.instance.state);
        assert.deepEqual(observe(f.window, f.element, {phase: 'after', held, visibleText: 'Unsupported: receiver'}), f.observation);
        assert.deepEqual(Object.getOwnPropertyDescriptors(f.instance), afterInstance);assert.deepEqual(Object.getOwnPropertyDescriptors(f.instance.state), afterState);
        assert.equal(transitions.methods(), afterMethods, 'the observer calls no actual product transition');assert.equal(f.methods(), 0);
    }
});

test('prior identity cannot substitute for a new request or new report and stale ownership still refuses', async () => {
    const observe = await cleanExportObserver();
    for (const reuse of ['request', 'report']) {
        const f = cleanExportFixture(), transitions = await realReportTransitions(f);
        const initial = transitions.start();transitions.finish(initial);
        const oldReport = f.instance.state.conversionReport, held = observe(f.window, f.element, {phase: 'before'});assert.equal(held.status, 'READY');
        if (reuse === 'request') transitions.finish(initial);
        else {transitions.start();f.instance.state.conversionReport = oldReport;}
        const methods = transitions.methods();
        assert.deepEqual(observe(f.window, f.element, {phase: 'after', held, visibleText: 'Unsupported: receiver'}),
            {captureStatus: 'UNAVAILABLE_FRESHNESS', reasonCode: reuse === 'request' ? 'REQUEST_REUSED' : 'REPORT_REUSED'});
        assert.equal(transitions.methods(), methods);assert.equal(f.methods(), 0);
    }
    for (const [change, reasonCode] of [
        [f => {f.instance._arcadeReportRequest.vm = {};}, 'PRE_REQUEST_INVALID'],
        [f => {f.instance._arcadeReportRequest.revision++;}, 'PRE_REQUEST_INVALID'],
        [f => {f.instance._unmounted = true;}, 'COMPONENT_DISPOSED'],
        [f => {f.instance.state.busy = true;}, 'COMPONENT_BUSY']
    ]) {
        const f = cleanExportFixture(), transitions = await realReportTransitions(f);const initial = transitions.start();transitions.finish(initial);change(f);
        const methods = transitions.methods();assert.deepEqual(observe(f.window, f.element, {phase: 'before'}), {captureStatus: 'UNAVAILABLE_FRESHNESS', reasonCode});
        assert.equal(transitions.methods(), methods);assert.equal(f.methods(), 0);
    }
    for (const report of [undefined, 7, 'prior report', []]) {
        const f = cleanExportFixture();f.instance.state.conversionReport = report;
        assert.deepEqual(observe(f.window, f.element, {phase: 'before'}), {captureStatus: 'UNAVAILABLE_FRESHNESS', reasonCode: 'PRE_REPORT_INVALID'});
        assert.equal(f.methods(), 0);
    }
    for (const request of [7, 'prior request', function () {}]) {
        const f = cleanExportFixture();f.instance._arcadeReportRequest = request;
        assert.deepEqual(observe(f.window, f.element, {phase: 'before'}), {captureStatus: 'UNAVAILABLE_FRESHNESS', reasonCode: 'PRE_REQUEST_INVALID'});
        assert.equal(f.methods(), 0);
    }
    const f = cleanExportFixture(), transitions = await realReportTransitions(f);const initial = transitions.start();transitions.finish(initial);
    let reads = 0;Object.defineProperty(f.instance.state, 'conversionReport', {configurable: true, get () {reads++;throw new Error('prior report getter must not execute');}});
    const methods = transitions.methods();assert.deepEqual(observe(f.window, f.element, {phase: 'before'}), {captureStatus: 'UNAVAILABLE_FRESHNESS', reasonCode: 'NON_DATA_STATE'});
    assert.equal(reads, 0);assert.equal(transitions.methods(), methods);assert.equal(f.methods(), 0);
});
