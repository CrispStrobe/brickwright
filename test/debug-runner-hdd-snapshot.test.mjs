import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../overlay/scratch-gui/src/lib/bw-debug/debug-runner.js', import.meta.url), 'utf8');
const between = (a, b) => {
    const start = source.indexOf(a); assert.ok(start >= 0);
    const end = source.indexOf(b, start + a.length); assert.ok(end > start);
    return source.slice(start, end);
};
// Execute actual source methods, with unrelated engine/GUI services replaced by
// inert collaborators. Attach runs its real entry up to engine selection, where
// the authored project collaborator deliberately stops construction.
function fixture () {
    const sandbox = {assert, AbortController}; vm.createContext(sandbox);
    const declarations = `let session = null;\n${between('    // Invalidate stop/start', '    let i8086ExecutionResult')}`;
    const method = between('        async snapshotAtaMaster()', '\n\n        /** Move the PC.');
    const stop = between('        stop() {', '\n\n        setSpeed');
    const destroy = between('        destroy({preserveRuntime = false} = {}) {', '\n    };');
    const basic = between('    function publishBasicSerial(active)', '    const runner = {');
    const attach = between('    async function attach(built) {', '        const device =');
    vm.runInContext(`
        ${declarations}
        let destroyed = false, activeRunTo = null, vm = null;
        let board = null, symbols = null, runToTarget = null, runToController = null;
        let unsubscribeBps = null, unsubscribeDebugEvents = null, unsubscribeDebugInputs = null;
        let debugEventsTarget = null, i8086ExecutionResult = null;
        let engineNotes, serialTerminal, serialEsc, terminalOutput, linuxProgressWatch;
        const i8086ExecutionLifetime = new AbortController();
        let releaseHook = () => {};
        const i8086Execution = {release() {releaseHook();}};
        const forkRecordingStore = {summaries: () => []};
        const debugFoundation = {clear() {}};
        const unschedule = () => {}, clearGlow = () => {}, setStatus = () => {};
        const setValueResolver = () => {}, unsubscribeRecordingEvents = () => {};
        const resetEventBreakpointRuntime = () => {};
        ${basic}
        const runner = {${method}\n${stop}\n${destroy}};
        ${attach} throw new Error('authored-engine-construction-stop'); }
        globalThis.api = {runner, attach,
            onAbort(fn) {i8086ExecutionLifetime.signal.addEventListener('abort',fn);},
            onRelease(fn) {releaseHook = fn;},
            set(t, s) {target = t; session = s;},
            get() {return {target, session};}};
    `, sandbox);
    let calls = 0, intent = 'paused', state = 'halted';
    const result = {bytes: new Uint8Array([9]), boundary: {cpuCycles: 4}};
    const target = {state: () => state, snapshotAtaMaster: async function () {assert.equal(this, target); calls++; return result;}};
    const session = {state: () => ({intent}), stop() {intent = 'stopped';}, destroy() {}};
    sandbox.api.set(target, session);
    return {api: sandbox.api, target, session, result, calls: () => calls,
        intent: value => {intent = value;}, state: value => {state = value;}};
}
const deferred = () => {let resolve, reject; const promise = new Promise((a,b) => {resolve=a; reject=b;}); return {promise,resolve,reject};};
test('actual bridge requires active paused halted supported target, with zero supplier calls', async () => {
    for (const mode of ['absent', 'running', 'stepping', 'halt-mismatch', 'unsupported', 'destroyed']) {
        const f = fixture();
        if (mode === 'absent') f.api.set(null, null);
        if (mode === 'running' || mode === 'stepping') f.intent('running');
        if (mode === 'halt-mismatch') f.state('running');
        if (mode === 'unsupported') delete f.target.snapshotAtaMaster;
        if (mode === 'destroyed') f.api.runner.destroy();
        assert.ok((await f.api.runner.snapshotAtaMaster()).refused, mode);
        assert.equal(f.calls(), 0);
    }
});
test('returns exact result and structured refusal objects, preserves thrown error identity', async () => {
    const f = fixture(); assert.equal(await f.api.runner.snapshotAtaMaster(), f.result);
    const refused = {refused: {code:'ata-busy',reason:'DRQ'}};
    f.target.snapshotAtaMaster = async () => refused;
    assert.equal(await f.api.runner.snapshotAtaMaster(), refused);
    const error = new Error('exact supplier error'); f.target.snapshotAtaMaster = async () => {throw error;};
    await assert.rejects(f.api.runner.snapshotAtaMaster(), e => e === error);
});
for (const kind of ['stop-start', 'destroy', 'attach-entry', 'target-replaced', 'session-replaced']) {
    test(`pending result refused after actual ${kind} boundary`, async () => {
        const f=fixture(), gate=deferred(); f.target.snapshotAtaMaster=()=>gate.promise;
        const pending=f.api.runner.snapshotAtaMaster();
        if(kind==='stop-start') {f.api.runner.stop(); f.intent('paused');}
        if(kind==='destroy') f.api.runner.destroy();
        if(kind==='attach-entry') await assert.rejects(f.api.attach({}), /authored-engine/);
        if(kind==='target-replaced') f.api.set({...f.target},f.session);
        if(kind==='session-replaced') f.api.set(f.target,{...f.session});
        gate.resolve(f.result);
        assert.equal((await pending).refused.code,'snapshot-stale-session');
    });
}
test('resume after detached copy is not a continuous pause lease', async () => {
    const f=fixture(), gate=deferred(); f.target.snapshotAtaMaster=()=>gate.promise;
    const pending=f.api.runner.snapshotAtaMaster(); f.intent('running'); f.state('running');
    gate.resolve(f.result); assert.equal(await pending,f.result);
});
test('stale rejection supersedes an obsolete supplier exception', async () => {
    const f=fixture(), gate=deferred(); f.target.snapshotAtaMaster=()=>gate.promise;
    const pending=f.api.runner.snapshotAtaMaster(); f.api.runner.stop(); gate.reject(new Error('obsolete'));
    assert.equal((await pending).refused.code,'snapshot-stale-session');
});
test('tracked package mirror matches canonical bytes', () => {
    assert.equal(source,readFileSync(new URL('../packages/scratch-gui/src/lib/bw-debug/debug-runner.js',import.meta.url),'utf8'));
});

test('actual abort listener cannot start a reentrant snapshot before release', async () => {
    const f=fixture();let reentrant;
    f.api.onAbort(()=>{reentrant=f.api.runner.snapshotAtaMaster();});
    f.api.runner.destroy();
    assert.equal((await reentrant).refused.code,'snapshot-no-session');
    assert.equal(f.calls(),0);
});
test('release failure preserves destroyed lifetime fence for pending and future snapshots', async () => {
    const f=fixture(), gate=deferred(), primary=new Error('execution-release-primary');
    f.target.snapshotAtaMaster=()=>gate.promise;
    const pending=f.api.runner.snapshotAtaMaster();
    f.api.onRelease(()=>{throw primary;});
    assert.throws(()=>f.api.runner.destroy(),e=>e===primary);
    gate.resolve(f.result);
    assert.equal((await pending).refused.code,'snapshot-stale-session');
    assert.equal((await f.api.runner.snapshotAtaMaster()).refused.code,'snapshot-no-session');
});
