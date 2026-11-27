// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
// Run production worker source, with only the browser transport adapted to Node.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {Worker} from 'node:worker_threads';

const sourceRoot = process.env.BW_CODE_RUNTIME_SOURCE_ROOT ||
    new URL('../overlay/scratch-gui/src/lib/', import.meta.url).pathname;
const load = async name => import(`data:text/javascript;base64,${Buffer.from(
    readFileSync(path.join(sourceRoot, name), 'utf8')).toString('base64')}`);
const {createCodeExecutionSession} = await load('code-execution-session.js');
const {JAVASCRIPT_WORKER_SOURCE} = await load('code-execution-workers.js');
function run(t, code, options = {}) {
    const messages = [];
    const outputs = [];
    const inputs = [];
    // Keep Node worker bootstrap out of the small execution budgets. Some
    // tests deliberately measure the difference between the execution budget and the input
    // probe deadline on a busy test runner.
    const thread = new Worker(`const {parentPort} = require('node:worker_threads');
        globalThis.self = globalThis;
        globalThis.postMessage = data => parentPort.postMessage(data);
        parentPort.on('message', data => self.onmessage({data}));
        ${JAVASCRIPT_WORKER_SOURCE}
        parentPort.postMessage('fixture-ready');`, {eval: true, execArgv: []});
    const initialized = new Promise((resolve, reject) => {
        thread.once('message', message => {
            if (message === 'fixture-ready') resolve(JAVASCRIPT_WORKER_SOURCE);
            else reject(new Error('Unexpected worker initialization message'));
        });
        thread.once('error', reject);
    });
    const exited = new Promise(resolve => thread.once('exit', resolve));
    let terminated = 0;
    let released = 0;
    const session = createCodeExecutionSession({
        workerSource: initialized, code, timeoutMs: 2000,
        inputProbeIntervalMs: 30, inputProbeTimeoutMs: 1000, flushIntervalMs: 5,
        ...options,
        onOutput(text) { outputs.push(text); options.onOutput?.(text, session); },
        onInput(request) { inputs.push(request); options.onInput?.(request, session); },
        createWorker(source) {
            assert.equal(source, JAVASCRIPT_WORKER_SOURCE);
            const worker = {
                postMessage: data => thread.postMessage(data),
                terminate() { terminated++; return thread.terminate(); },
                onmessage: null, onerror: null, onmessageerror: null
            };
            thread.on('message', data => { messages.push(data); worker.onmessage?.({data}); });
            thread.on('error', error => worker.onerror?.({message: error.message, preventDefault() {}}));
            return {worker, release() { released++; }};
        }
    });
    t.after(async () => { session.dispose(); await thread.terminate(); });
    return {
        session, messages, outputs, inputs,
        async result() {
            const result = await session.promise;
            await exited;
            assert.equal(terminated, 1);
            assert.equal(released, 1);
            assert.ok(messages.every(message => message.runId === session.id));
            return result;
        }
    };
}

test('registered concurrent and nested tasks finish before the owned run', {timeout: 15000}, async t => {
    const f = run(t, `
        codeRun.spawn(async task => {
            console.log('first'); await task.sleep(80);
            task.spawn(async child => { await child.sleep(40); console.log('nested'); });
            console.log('parent');
        });
        codeRun.spawn(async task => { await task.sleep(20); console.log('second'); });
        console.log('entry');
    `);
    const result = await f.result();
    assert.equal(result.status, 'completed');
    assert.equal(result.output, 'entry\nfirst\nsecond\nparent\nnested\n');
    assert.ok(f.outputs.some(text => text === 'entry\nfirst\n'));
    assert.equal(f.messages.at(-1).type, 'done');
});

test('an ignored registered rejection ends the run and cancels sibling delays', {timeout: 15000}, async t => {
    const f = run(t, `
        codeRun.spawn(async task => { await task.sleep(200); console.log('late'); });
        codeRun.spawn(async task => { await task.sleep(20); throw new Error('owned-rejection'); });
    `);
    const result = await f.result();
    assert.equal(result.status, 'error');
    assert.match(result.error, /owned-rejection/);
    assert.equal(result.output, '');
    assert.equal(f.messages.filter(message => message.type === 'error').length, 1);
});

test('synchronous task throws and returned rejected promises are owned', {timeout: 15000}, async t => {
    for (const task of ["() => { throw new Error('sync-task'); }", "() => Promise.reject(new Error('promise-task'))"]) {
        const result = await run(t, `codeRun.spawn(${task});`).result();
        assert.equal(result.status, 'error');
        assert.match(result.error, /(?:sync|promise)-task/);
    }
});

test('owned input stays alive beyond the execution budget with responsive probes', {timeout: 15000}, async t => {
    const timers = [];
    t.after(() => timers.forEach(clearTimeout));
    const f = run(t, "codeRun.spawn(async task => console.log(await task.input('Name?')));", {
        timeoutMs: 1200,
        onInput(request, session) {
            if (request) timers.push(setTimeout(() => session.replyToInput(request.requestId, 'Ada'), 2000));
        }
    });
    const result = await f.result();
    assert.equal(result.status, 'completed');
    assert.equal(result.output, 'Ada\n');
    assert.equal(f.inputs.filter(Boolean).length, 1);
    assert.equal(f.inputs.at(-1), null);
    assert.ok(f.messages.some(message => message.type === 'input-pong'));
});

test('input does not suspend the budget of an executing sibling task', {timeout: 15000}, async t => {
    const f = run(t, `
        codeRun.spawn(async task => { await task.input('Waiting?'); });
        codeRun.spawn(() => { while (true) {} });
    `, {timeoutMs: 1000, inputProbeTimeoutMs: 3000});
    const result = await f.result();
    assert.equal(result.status, 'timeout');
    assert.equal(result.reason, undefined, 'the execution budget remains active before the probe deadline');
    assert.equal(f.inputs.filter(Boolean).length, 1);
    assert.equal(f.messages.find(message => message.type === 'input').pauseBudget, false);
    assert.equal(f.inputs.at(-1), null);
});

test('unawaited legacy input followed by a busy loop cannot disable all timeouts', {timeout: 15000}, async t => {
    const f = run(t, 'input("Question?"); while (true) {}', {timeoutMs: 1400, inputProbeTimeoutMs: 600});
    const result = await f.result();
    assert.equal(result.status, 'timeout');
    assert.equal(result.reason, 'input-unresponsive');
    assert.equal(f.inputs.filter(Boolean).length, 1);
    assert.equal(f.inputs.at(-1), null);
});

test('responsive but unfinished siblings still consume the execution budget during input', {timeout: 15000}, async t => {
    const f = run(t, `
        codeRun.spawn(async task => { await task.input('Waiting?'); });
        codeRun.spawn(async task => { while (true) await task.sleep(10); });
    `, {timeoutMs: 1500});
    const result = await f.result();
    assert.equal(result.status, 'timeout');
    assert.equal(result.reason, undefined);
    assert.ok(f.messages.some(message => message.type === 'input-pong'));
});

test('sibling completion admits a long human wait without replenishing the run', {timeout: 15000}, async t => {
    const timers = [];
    t.after(() => timers.forEach(clearTimeout));
    const f = run(t, `
        codeRun.spawn(async task => { console.log(await task.input('Waiting?')); });
        codeRun.spawn(async task => { await task.sleep(50); console.log('sibling'); });
    `, {timeoutMs: 1400, onInput(request, session) {
        if (request) timers.push(setTimeout(() => session.replyToInput(request.requestId, 'answer'), 2200));
    }});
    const result = await f.result();
    assert.equal(result.status, 'completed');
    assert.equal(result.output, 'sibling\nanswer\n');
    assert.equal(f.messages.find(message => message.type === 'input').pauseBudget, false);
    assert.ok(f.messages.some(message => message.type === 'input-state' && message.pauseBudget));
});

test('overlapping owned asks fail explicitly and clear the first question', {timeout: 15000}, async t => {
    const f = run(t, "codeRun.spawn(task => task.input('First?')); codeRun.spawn(task => task.input('Second?'));");
    const result = await f.result();
    assert.equal(result.status, 'error');
    assert.match(result.error, /Only one input request/);
    assert.equal(f.inputs.filter(Boolean).length, 1);
    assert.equal(f.inputs.at(-1), null);
});

test('Stop during owned delays or input settles once and rejects late answers', {timeout: 15000}, async t => {
    for (const code of [
        "codeRun.spawn(async task => { console.log('ready'); await task.sleep(5000); console.log('late'); });",
        "codeRun.spawn(async task => { await task.input('Waiting?'); console.log('late'); });"
    ]) {
        const f = run(t, code, {
            onOutput(text, session) { if (text.includes('ready')) session.stop('task-stop'); },
            onInput(request, session) { if (request) session.stop('task-stop'); }
        });
        const result = await f.result();
        assert.equal(result.status, 'stopped');
        assert.equal(result.reason, 'task-stop');
        assert.ok(!result.output.includes('late'));
        assert.equal(f.session.replyToInput(1, 'late'), false);
    }
});

test('registered tasks cannot mix with synchronous prompt replay in either order', {timeout: 15000}, async t => {
    for (const code of [
        "codeRun.spawn(async () => {}); prompt('No replay');",
        "try { prompt('No replay'); } catch (error) {} codeRun.spawn(async () => {});"
    ]) {
        const f = run(t, code);
        const result = await f.result();
        assert.equal(result.status, 'error');
        assert.match(result.error, /prompt replay cannot be mixed/);
        assert.equal(f.inputs.length, 0);
        assert.equal(f.messages.filter(message => message.type === 'output-reset').length, 0);
    }
});

test('pending unawaited owned resources and invalid task operations fail visibly', {timeout: 15000}, async t => {
    const cases = [
        ["codeRun.sleep(1000);", /Await input and codeRun.sleep/],
        ["codeRun.input('Unawaited');", /Await input and codeRun.sleep/],
        ["codeRun.spawn(5);", /requires a function/],
        ["await codeRun.sleep(Infinity);", /finite milliseconds/],
        ["await codeRun.sleep(-1);", /finite milliseconds/],
        ["for (let n=0; n<257; n++) codeRun.spawn(() => new Promise(() => {}));", /task limit/],
        ["for (let n=0; n<257; n++) codeRun.sleep(1000);", /sleep limit/]
    ];
    for (const [code, error] of cases) {
        const result = await run(t, code).result();
        assert.equal(result.status, 'error', code);
        assert.match(result.error, error, code);
    }
});

test('task output floods remain bounded and a fresh worker has no old state', {timeout: 15000}, async t => {
    const flooded = await run(t, `globalThis.taskState = 42;
        codeRun.spawn(() => { while (true) console.log('x'.repeat(100)); });`, {maxOutputChars: 512}).result();
    assert.equal(flooded.status, 'output-limit');
    assert.equal(flooded.output.length, 512);
    const fresh = await run(t, 'codeRun.spawn(() => console.log(typeof taskState));').result();
    assert.equal(fresh.status, 'completed');
    assert.equal(fresh.output, 'undefined\n');
});

test('the worker API does not reserve a new local name in legacy authored source', {timeout: 15000}, async t => {
    const result = await run(t, 'const codeRun = 7; console.log(codeRun);').result();
    assert.equal(result.status, 'completed');
    assert.equal(result.output, '7\n');
});

test('spawn registers concurrent work and returns no join handle', {timeout: 15000}, async t => {
    const result = await run(t, `
        const handle = codeRun.spawn(async task => { await task.sleep(20); console.log('child'); });
        console.log(typeof handle);
        async function sequential(task) { await task.sleep(10); console.log('sequential'); }
        await sequential(codeRun);
        console.log('entry-after');
    `).result();
    assert.equal(result.status, 'completed');
    assert.equal(result.output, 'undefined\nsequential\nentry-after\nchild\n');
});

test('abandoned entry or task input fails before exempting an unrelated responsive sibling', {timeout: 15000}, async t => {
    for (const start of [
        "codeRun.input('Orphan?');",
        "codeRun.spawn(task => { task.input('Orphan?'); });"
    ]) {
        const f = run(t, `${start}
            codeRun.spawn(async task => { while (true) await task.sleep(10); });`, {timeoutMs: 1200});
        const result = await f.result();
        assert.equal(result.status, 'error');
        assert.match(result.error, /owning entry or task/);
        assert.equal(f.inputs.filter(Boolean).length, 1);
        assert.equal(f.inputs.at(-1), null);
        assert.ok(!f.messages.some(message => message.type === 'input-state' && message.pauseBudget === true),
            'an abandoned question must not transfer its budget exemption to the sibling');
    }
});

test('abandoned task delays and late use of a completed task API fail visibly', {timeout: 15000}, async t => {
    for (const code of [
        "codeRun.spawn(task => { task.sleep(1000); }); codeRun.spawn(async task => { await task.sleep(2000); });",
        `let oldApi; codeRun.spawn(task => { oldApi = task; });
         codeRun.spawn(async task => { await task.sleep(20); oldApi.spawn(() => console.log('late')); });`,
        "codeRun.spawn(async task => { await task.sleep(20); await codeRun.input('Wrong owner'); });"
    ]) {
        const result = await run(t, code).result();
        assert.equal(result.status, 'error');
        assert.match(result.error, /owning entry or task|task has ended/);
        assert.equal(result.output, '');
    }
});

test('an input owner cannot keep performing owned work while its execution budget is paused', {timeout: 15000}, async t => {
    for (const code of [
        "codeRun.spawn(async task => { task.input('Unawaited'); while (true) await task.sleep(10); });",
        "codeRun.spawn(task => { task.input('Unawaited'); task.spawn(async child => { await child.sleep(100); }); });",
        "codeRun.spawn(async task => { task.sleep(1000); await task.input('Early input'); });"
    ]) {
        const result = await run(t, code, {timeoutMs: 1200}).result();
        assert.equal(result.status, 'error');
        assert.match(result.error, /Await the pending input|Await pending sleeps/);
        assert.equal(result.output, '');
    }
});
