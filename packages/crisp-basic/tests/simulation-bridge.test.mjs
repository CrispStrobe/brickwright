import assert from 'node:assert/strict';
import test from 'node:test';
import {Worker} from 'node:worker_threads';
import {createWasmSession} from '../browser.mjs';
import {createNativeSession} from '../src/native-session.mjs';
import {createSimulationHost, SimulationError} from '../src/simulation-host.mjs';

const fixtureWorker = new URL('./fixtures/simulation-worker.mjs', import.meta.url);
const actualWorker = new URL('../src/wasm-worker.mjs', import.meta.url);
const scriptedSource = steps => `REM ${JSON.stringify(steps)}\n`;
const request = (operation = 5, args = [0, 0], extra = {}) => ({record: {operation, args, ...extra}});
const settle = () => new Promise(resolve => setImmediate(resolve));

test('the native backend explicitly refuses simulation configuration', async () => {
    assert.throws(() => createNativeSession({simulation: {}}), /simulation.*createWasmSession/);
    const native = createNativeSession();
    assert.equal(native.capabilities.simulation.available, false);
    assert.equal(native.capabilities.simulation.basicBridge, false);
    await native.dispose();
});

function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return {promise, resolve, reject};
}

function sessionFor(t, options = {}) {
    const session = createWasmSession({workerURL: fixtureWorker, timeoutMs: 3000, ...options});
    t.after(() => session.dispose());
    return session;
}

function hostFor(overrides = {}) {
    const calls = [];
    const host = {
        pinMode(...args) { calls.push(['pinMode', ...args]); },
        digitalWrite(...args) { calls.push(['digitalWrite', ...args]); },
        digitalRead(...args) { calls.push(['digitalRead', ...args]); return 1; },
        delay(...args) { calls.push(['delay', ...args]); },
        millis(...args) { calls.push(['millis', ...args]); return 23; },
        dispose() { calls.push(['dispose']); },
        ...overrides
    };
    return {host, calls};
}

test('bridge routes only the five scalar operations and acknowledges void methods', async t => {
    const {host, calls} = hostFor();
    let context;
    const session = sessionFor(t, {simulation: {createHost: value => { context = value; return host; }}});
    const result = await session.run(scriptedSource([
        request(1, [7, 0]), request(1, [7, 1]), request(1, [7, 2]),
        request(2, [7, 1]), request(3, [7, 0]), request(4, [100, 0]), request()
    ]));
    assert.equal(result.status, 'completed', JSON.stringify(result.error));
    assert.deepEqual(calls, [
        ['pinMode', 7, 'input'], ['pinMode', 7, 'output'], ['pinMode', 7, 'input-pullup'],
        ['digitalWrite', 7, 1], ['digitalRead', 7], ['delay', 100], ['millis'], ['dispose']
    ]);
    const replies = JSON.parse(result.text);
    assert.deepEqual(replies.map(reply => reply.value), [0, 0, 0, 0, 1, 0, 23]);
    assert.deepEqual(replies.map(reply => reply.requestId), [1, 2, 3, 4, 5, 6, 7]);
    assert.ok(replies.every(reply => reply.type === 'simulation-reply' && reply.version === 1 && reply.ok === true));
    assert.ok(replies.every(reply => reply.runId === context.runId));
    assert.ok(context.signal instanceof AbortSignal);
    assert.equal(context.signal.aborted, true);
    assert.equal(Object.isFrozen(context), true);
});

test('a request without an explicitly enabled bridge is rejected', async t => {
    const result = await sessionFor(t).run(scriptedSource([request()]));
    assert.equal(result.status, 'host-error');
    assert.equal(result.output.length, 0);
});

test('host promises are awaited serially and results remain bound to their request', async t => {
    const gate = deferred();
    const entered = deferred();
    let active = 0, maximum = 0;
    const {host, calls} = hostFor({
        async millis() {
            active++;
            maximum = Math.max(maximum, active);
            entered.resolve();
            await gate.promise;
            active--;
            return 71;
        }
    });
    const session = sessionFor(t, {simulation: {createHost: () => host}});
    const pending = session.run(scriptedSource([request(), request(3, [2, 0])]));
    await entered.promise;
    assert.deepEqual(calls, []);
    gate.resolve();
    const result = await pending;
    assert.equal(result.status, 'completed', JSON.stringify(result.error));
    assert.equal(maximum, 1);
    assert.deepEqual(JSON.parse(result.text).map(reply => reply.value), [71, 1]);
    assert.deepEqual(calls, [['digitalRead', 2], ['dispose']]);
});

for (const [name, step] of [
    ['wrong protocol version', {record: {version: 2}}],
    ['missing run ownership', {omit: ['runId']}],
    ['another run', {runOffset: 1}],
    ['missing request ID', {omit: ['requestId']}],
    ['zero request ID', {record: {requestId: 0}}],
    ['future request ID', {record: {requestId: 2}}],
    ['fractional request ID', {record: {requestId: 1.5}}],
    ['string request ID', {record: {requestId: '1'}}],
    ['unknown operation', {record: {operation: 6}}],
    ['string operation', {record: {operation: '5'}}],
    ['missing arguments', {omit: ['args']}],
    ['too many arguments', {record: {args: [0, 0, 0]}}],
    ['a sparse argument tuple', {record: {operation: 4}, argumentHoles: [0]}],
    ['an extra argument property', {extraArgumentProperty: true}],
    ['object argument', {record: {args: [{value: 0}, 0]}}],
    ['string argument', {record: {operation: 4, args: ['0', 0]}}],
    ['fractional argument', {record: {operation: 4, args: [0.5, 0]}}],
    ['out of range pin', {record: {operation: 3, args: [65536, 0]}}],
    ['invalid mode enum', {record: {operation: 1, args: [0, 3]}}],
    ['invalid digital value', {record: {operation: 2, args: [0, 2]}}],
    ['negative delay', {record: {operation: 4, args: [-1, 0]}}],
    ['overflowing delay', {record: {operation: 4, args: [2147483648, 0]}}],
    ['unused nonzero argument', {record: {operation: 5, args: [1, 0]}}]
]) {
    test(`bridge rejects ${name} before invoking the host`, async t => {
        const {host, calls} = hostFor();
        const result = await sessionFor(t, {simulation: {createHost: () => host}})
            .run(scriptedSource([step]));
        assert.equal(result.status, 'host-error', JSON.stringify(result.error));
        assert.deepEqual(calls, [['dispose']]);
        assert.equal(result.output.length, 0);
    });
}

test('an overlapping request terminates the run instead of executing concurrently', async t => {
    const {host, calls} = hostFor({millis() { calls.push(['millis']); return new Promise(() => {}); }});
    const result = await sessionFor(t, {simulation: {createHost: () => host}}).run(scriptedSource([
        {...request(), await: false}, {...request(), await: false}, {type: 'pause'}
    ]));
    assert.equal(result.status, 'host-error', JSON.stringify(result.error));
    assert.deepEqual(calls, [['millis'], ['dispose']]);
});

test('a duplicate request cannot repeat an already acknowledged mutation', async t => {
    const {host, calls} = hostFor();
    const result = await sessionFor(t, {simulation: {createHost: () => host}}).run(scriptedSource([
        request(2, [0, 1]), request(2, [0, 1], {requestId: 1})
    ]));
    assert.equal(result.status, 'host-error', JSON.stringify(result.error));
    assert.deepEqual(calls, [['digitalWrite', 0, 1], ['dispose']]);
});

test('completion while a host operation is pending is a protocol failure', async t => {
    const {host, calls} = hostFor({millis() { calls.push(['millis']); return new Promise(() => {}); }});
    const result = await sessionFor(t, {simulation: {createHost: () => host}}).run(scriptedSource([
        {...request(), await: false}, {type: 'complete'}
    ]));
    assert.equal(result.status, 'host-error', JSON.stringify(result.error));
    assert.deepEqual(calls, [['millis'], ['dispose']]);
});

test('typed argument and state errors cross as bounded codes, without arbitrary host text', async t => {
    const codes = ['invalid-pin', 'invalid-mode', 'invalid-level', 'invalid-time',
        'pin-not-output', 'floating-input', 'disposed', 'unavailable', 'invalid-operation'];
    let count = 0;
    const {host} = hostFor({millis() { throw new SimulationError(codes[count++], 'private detail '.repeat(10000)); }});
    const result = await sessionFor(t, {simulation: {createHost: () => host}})
        .run(scriptedSource(codes.map(() => request())));
    assert.equal(result.status, 'completed', JSON.stringify(result.error));
    const replies = JSON.parse(result.text);
    assert.deepEqual(replies.map(reply => reply.error), codes.map(code => ({code})));
    assert.ok(replies.every(reply => reply.ok === false && !('value' in reply)));
    assert.ok(result.output.length < 3000);
});

for (const code of ['trace-limit', 'input-limit', 'time-limit', 'solver-limit']) {
    test(`${code} remains a parent terminal outcome and never becomes a BASIC reply`, async t => {
        const {host, calls} = hostFor({millis() { throw new SimulationError(code, 'budget exhausted'); }});
        const result = await sessionFor(t, {simulation: {createHost: () => host}})
            .run(scriptedSource([request()]));
        assert.equal(result.status, 'simulation-limit', JSON.stringify(result.error));
        assert.equal(result.error.kind, 'simulation');
        assert.equal(result.error.code, code);
        assert.equal(result.output.length, 0);
        assert.deepEqual(calls, [['dispose']]);
    });
}

test('the request ceiling includes operations such as millis that produce no trace', async t => {
    const host = createSimulationHost();
    const session = sessionFor(t, {simulation: {createHost: () => host, maxRequests: 2}});
    const result = await session.run(scriptedSource([request(), request(), request()]));
    assert.equal(result.status, 'simulation-limit', JSON.stringify(result.error));
    assert.equal(result.error.code, 'request-limit');
    assert.equal(result.output.length, 0);
    assert.deepEqual(host.trace, []);
    assert.equal(host.state, 'disposed');
});

for (const [name, error] of [
    ['ordinary Error', new Error('unexpected adapter failure')],
    ['code-shaped object', {code: 'invalid-pin', message: 'not a SimulationError'}],
    ['unknown SimulationError', new SimulationError('new-unknown-code', 'unknown')]
]) {
    test(`${name} is a host failure, never a catchable simulation response`, async t => {
        const {host} = hostFor({millis() { throw error; }});
        const result = await sessionFor(t, {simulation: {createHost: () => host}}).run(scriptedSource([request()]));
        assert.equal(result.status, 'host-error', JSON.stringify(result.error));
        assert.equal(result.output.length, 0);
    });
}

for (const [name, operation, value] of [
    ['digital read outside 0/1', 3, 2],
    ['boolean digital read', 3, true],
    ['fractional millis', 5, 1.5],
    ['negative millis', 5, -1],
    ['overflowing millis', 5, 2147483648],
    ['string millis', 5, '1'],
    ['object result', 5, {value: 1}],
    ['NaN result', 5, NaN],
    ['unexpected void result', 4, 1]
]) {
    test(`bridge rejects ${name} from the adapter`, async t => {
        const {host} = hostFor({millis: () => value, digitalRead: () => value, delay: () => value});
        const result = await sessionFor(t, {simulation: {createHost: () => host}})
            .run(scriptedSource([request(operation)]));
        assert.equal(result.status, 'host-error', JSON.stringify(result.error));
        assert.equal(result.output.length, 0);
    });
}

test('cancellation aborts and disposes a pending host before the run settles', async t => {
    const entered = deferred(), late = deferred();
    const order = [];
    let signal;
    const {host} = hostFor({
        millis() { entered.resolve(); return late.promise; },
        dispose() { order.push('dispose'); assert.equal(signal.aborted, true); }
    });
    const session = sessionFor(t, {simulation: {createHost: context => {
        signal = context.signal;
        signal.addEventListener('abort', () => order.push('abort'), {once: true});
        return host;
    }}});
    const pending = session.run(scriptedSource([request()]));
    await entered.promise;
    assert.equal(session.cancel(), true);
    assert.equal((await pending).status, 'cancelled');
    order.push('resolved');
    assert.deepEqual(order, ['abort', 'dispose', 'resolved']);
    late.reject(new Error('rejected after cancellation'));
    await settle();
    assert.equal(session.state, 'idle');
});

test('late replies from a cancelled run cannot leak into the next run', async t => {
    const entered = deferred(), late = deferred();
    const contexts = [], disposed = [];
    let count = 0;
    const session = sessionFor(t, {simulation: {createHost: context => {
        const index = count++;
        contexts.push(context);
        return hostFor({
            millis() {
                if (index === 0) { entered.resolve(); return late.promise; }
                return 82;
            },
            dispose() { disposed.push(index); }
        }).host;
    }}});
    const old = session.run(scriptedSource([request()]));
    await entered.promise;
    await session.reset();
    assert.equal((await old).status, 'cancelled');
    const next = session.run(scriptedSource([request()]));
    late.resolve(19);
    const result = await next;
    assert.equal(result.status, 'completed', JSON.stringify(result.error));
    assert.deepEqual(JSON.parse(result.text).map(reply => reply.value), [82]);
    assert.notEqual(contexts[0].runId, contexts[1].runId);
    assert.deepEqual(disposed, [0, 1]);
});

test('timeout covers an uncooperative pending host promise', async t => {
    let disposed = 0;
    const entered = deferred();
    const {host} = hostFor({
        millis() { entered.resolve(); return new Promise(() => {}); },
        dispose() { disposed++; }
    });
    const session = sessionFor(t, {timeoutMs: 300, simulation: {createHost: () => host}});
    const pending = session.run(scriptedSource([request()]));
    await entered.promise;
    const result = await pending;
    assert.equal(result.status, 'timeout');
    assert.equal(disposed, 1);
    assert.ok(result.durationMs < 2000);
});

test('AbortSignal, reset and dispose all release an outstanding request', async t => {
    for (const action of ['signal', 'reset', 'dispose']) {
        const entered = deferred();
        let disposed = 0, receivedSignal;
        const controller = new AbortController();
        const session = sessionFor(t, {simulation: {createHost: ({signal}) => {
            receivedSignal = signal;
            return hostFor({millis() { entered.resolve(); return new Promise(() => {}); },
                dispose() { disposed++; }}).host;
        }}});
        const pending = session.run(scriptedSource([request()]), {signal: controller.signal});
        await entered.promise;
        if (action === 'signal') controller.abort();
        else await session[action]();
        assert.equal((await pending).status, 'cancelled');
        assert.equal(receivedSignal.aborted, true);
        assert.equal(disposed, 1);
        assert.equal(session.state, action === 'dispose' ? 'disposed' : 'idle');
    }
});

test('each run claims a fresh host, including across different sessions', async t => {
    const {host, calls} = hostFor();
    const options = {simulation: {createHost: () => host}};
    const first = sessionFor(t, options);
    assert.equal((await first.run(scriptedSource([]))).status, 'completed');
    assert.equal((await first.run(scriptedSource([]))).status, 'host-error');
    const other = sessionFor(t, options);
    assert.equal((await other.run(scriptedSource([]))).status, 'host-error');
    assert.deepEqual(calls, [['dispose']]);
});

test('two concurrent sessions have distinct host ownership and results', async t => {
    const contexts = [];
    const run = value => {
        const session = sessionFor(t, {simulation: {createHost: context => {
            contexts.push(context);
            return hostFor({millis: async () => value}).host;
        }}});
        return session.run(scriptedSource([request()]));
    };
    const results = await Promise.all([run(12), run(34)]);
    assert.deepEqual(results.map(result => result.status), ['completed', 'completed']);
    assert.deepEqual(results.map(result => JSON.parse(result.text)[0].value), [12, 34]);
    assert.notEqual(contexts[0].runId, contexts[1].runId);
    assert.ok(contexts.every(context => context.signal.aborted));
});

test('a synchronous factory failure is reported without starting the interpreter', async t => {
    const result = await sessionFor(t, {simulation: {createHost() { throw new Error('factory failed'); }}})
        .run(scriptedSource([]));
    assert.equal(result.status, 'host-error');
    assert.equal(result.output.length, 0);
});

test('invalid factory results and asynchronous disposal fail clearly', async t => {
    for (const createHost of [() => null, () => ({}), () => Promise.resolve(hostFor().host),
        () => hostFor({dispose: () => Promise.resolve()}).host]) {
        const result = await sessionFor(t, {simulation: {createHost}}).run(scriptedSource([]));
        assert.equal(result.status, 'host-error', JSON.stringify(result.error));
    }
});

test('dispose failure is reported and the session can still create a fresh next host', async t => {
    let count = 0;
    const session = sessionFor(t, {simulation: {createHost: () => hostFor({dispose() {
        if (count++ === 0) throw new Error('cleanup failed');
    }}).host}});
    assert.equal((await session.run(scriptedSource([]))).status, 'host-error');
    assert.equal(session.state, 'idle');
    assert.equal((await session.run(scriptedSource([]))).status, 'completed');
});

test('output limits stop a run before a following simulation request can mutate its host', async t => {
    let aborted = false;
    let invoked = false;
    const session = sessionFor(t, {maxOutputBytes: 2, simulation: {createHost: ({signal}) => {
        signal.addEventListener('abort', () => { aborted = true; });
        return hostFor({millis() { invoked = true; return 0; }}).host;
    }}});
    const result = await session.run(scriptedSource([
        {type: 'output', bytes: [65, 66, 67]}, {...request(), await: false}, {type: 'pause'}
    ]));
    assert.equal(result.status, 'output-limit');
    assert.deepEqual([...result.output], [65, 66]);
    assert.equal(aborted, true);
    assert.equal(invoked, false);
});

test('source validation and already-aborted runs do not allocate simulation hosts', async t => {
    let count = 0;
    const session = sessionFor(t, {simulation: {createHost: () => { count++; return hostFor().host; }}});
    await assert.rejects(session.run('PRINT "\u{1f600}"\n'), /Latin-1/);
    const controller = new AbortController();
    controller.abort();
    assert.equal((await session.run(scriptedSource([]), {signal: controller.signal})).status, 'cancelled');
    assert.equal(count, 0);
});

test('cancellation inside the host factory still disposes its returned host without running it', async t => {
    const {host, calls} = hostFor();
    let context;
    const session = sessionFor(t, {simulation: {createHost: value => {
        context = value;
        session.cancel();
        return host;
    }}});
    const result = await session.run(scriptedSource([request()]));
    assert.equal(result.status, 'cancelled');
    assert.equal(context.signal.aborted, true);
    assert.deepEqual(calls, [['dispose']]);
});

test('cancellation inside a host callback suppresses its returned reply', async t => {
    let disposed = 0;
    const session = sessionFor(t, {simulation: {createHost: () => hostFor({
        millis() { session.cancel(); return Promise.reject(new Error('after cancellation')); },
        dispose() { disposed++; }
    }).host}});
    const result = await session.run(scriptedSource([request()]));
    assert.equal(result.status, 'cancelled');
    assert.equal(result.output.length, 0);
    assert.equal(disposed, 1);
    await settle();
});

for (const stage of ['factory', 'operation', 'disposal']) {
    test(`a non-coercible ${stage} exception is reported without leaving the session running`, async t => {
        const value = Object.create(null);
        let attempts = 0;
        const session = sessionFor(t, {simulation: {createHost: () => {
            const first = attempts++ === 0;
            if (first && stage === 'factory') throw value;
            return hostFor({
                millis() { if (first && stage === 'operation') throw value; return 0; },
                dispose() { if (first && stage === 'disposal') throw value; }
            }).host;
        }}});
        const result = await session.run(scriptedSource([request()]));
        assert.equal(result.status, 'host-error');
        assert.equal(session.state, 'idle');
        assert.equal((await session.run(scriptedSource([request()]))).status, 'completed');
    });
}

// A data: module supplies only the Emscripten JavaScript shape. The production
// worker still handles the actual request/reply transport and validation; no
// C execution or language correctness is claimed by these protocol fixtures.
const moduleURL = new URL(`data:text/javascript,${encodeURIComponent(`
export default async function ({crispHost}) {
    return {
        HEAPU8: new Uint8Array(8192),
        _malloc: () => 1, _free() {}, _crisp_simulation_abi: () => 1,
        async ccall(name, resultType, argumentTypes, args) {
            if (name !== 'crisp_run' || args.length !== 3 || args[2] !== 1) throw new Error('Missing bridge enable flag');
            const value = await crispHost.simulationRequest(5, 0, 0);
            crispHost.output(value & 255);
            return 0;
        }
    };
}`)}`);

test('the production worker carries a delayed host reply through its JavaScript ABI', async t => {
    const {host} = hostFor({millis: async () => { await settle(); return 65; }});
    const session = sessionFor(t, {workerURL: actualWorker, moduleURL, simulation: {createHost: () => host}});
    const result = await session.run('END\n');
    assert.equal(result.status, 'completed', JSON.stringify(result.error));
    assert.deepEqual([...result.output], [65]);
});

for (const [name, abiExport] of [['missing', ''], ['stale', '_crisp_simulation_abi: () => 0,']]) {
    test(`a ${name} simulation ABI is rejected before the interpreter is called`, async t => {
        const incompatible = new URL(`data:text/javascript,${encodeURIComponent(`
            export default async function ({crispHost}) {
                return {${abiExport} HEAPU8: new Uint8Array(8192), _malloc: () => 1, _free() {},
                    ccall() { crispHost.output(88); return 0; }};
            }`)}`);
        const {host, calls} = hostFor();
        const result = await sessionFor(t, {workerURL: actualWorker, moduleURL: incompatible,
            simulation: {createHost: () => host}}).run('END\n');
        assert.equal(result.status, 'host-error', JSON.stringify(result.error));
        assert.equal(result.output.length, 0);
        assert.deepEqual(calls, [['dispose']]);
    });
}

for (const [name, change] of [
    ['wrong run', reply => ({...reply, runId: reply.runId + 1})],
    ['wrong request', reply => ({...reply, requestId: reply.requestId + 1})],
    ['wrong version', reply => ({...reply, version: 2})],
    ['invalid success value', reply => ({...reply, value: '12'})],
    ['unknown error code', reply => ({...reply, ok: false, error: {code: 'unknown'}})],
    ['missing result discriminator', reply => { const value = {...reply}; delete value.ok; return value; }]
]) {
    test(`the production worker rejects a ${name} reply`, {timeout: 5000}, async t => {
        const worker = new Worker(actualWorker, {type: 'module', execArgv: []});
        t.after(() => worker.terminate());
        const terminal = new Promise((resolve, reject) => {
            worker.on('error', reject);
            worker.on('message', message => {
                if (message.type === 'simulation-request') worker.postMessage(change({
                    type: 'simulation-reply', version: 1, runId: message.runId,
                    requestId: message.requestId, ok: true, value: 12
                }));
                else if (message.type === 'result') resolve(message);
            });
        });
        worker.postMessage({type: 'start', version: 1, runId: 19, moduleURL: moduleURL.href,
            source: '1 END\n', input: new Uint8Array(), inputEnded: true, maxOutputBytes: 1024,
            simulationEnabled: true, maxSimulationRequests: 4096});
        const result = await terminal;
        assert.equal(result.status, 'host-error', JSON.stringify(result.error));
    });
}

test('a malformed reply produces exactly one terminal record even as the pending hook rejects', {timeout: 5000}, async t => {
    const fixtureModule = new URL(`data:text/javascript,${encodeURIComponent(`
        import {parentPort} from 'node:worker_threads';
        export default async function ({crispHost}) {
            return {_crisp_simulation_abi: () => 1, HEAPU8: new Uint8Array(8192), _malloc: () => 1,
                async ccall() { await crispHost.simulationRequest(5, 0, 0); return 0; },
                _free() { parentPort.postMessage({type: 'fixture-freed'}); }};
        }`)}`);
    const worker = new Worker(actualWorker, {type: 'module', execArgv: []});
    t.after(() => worker.terminate());
    const records = [];
    const cleanup = new Promise((resolve, reject) => {
        worker.on('error', reject);
        worker.on('message', message => {
            if (message.type === 'simulation-request') worker.postMessage({
                type: 'simulation-reply', version: 1, runId: message.runId,
                requestId: message.requestId + 1, ok: true, value: 0
            });
            else if (message.type === 'fixture-freed') resolve();
            else records.push(message);
        });
    });
    worker.postMessage({type: 'start', version: 1, runId: 25, moduleURL: fixtureModule.href,
        source: '1 END\n', input: new Uint8Array(), inputEnded: true, maxOutputBytes: 1024,
        simulationEnabled: true});
    await cleanup;
    assert.equal(records.length, 1, JSON.stringify(records));
    assert.equal(records[0].type, 'result');
    assert.equal(records[0].status, 'host-error');
});
