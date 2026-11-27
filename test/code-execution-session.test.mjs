// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Worker} from 'node:worker_threads';

// This module has no GUI/runtime dependencies, so exercise the actual overlay
// source without a generated scratch-gui checkout or package installation.
const source = readFileSync(new URL('../overlay/scratch-gui/src/lib/code-execution-session.js', import.meta.url), 'utf8');
const {createCodeExecutionSession} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const drain = async () => { for (let n = 0; n < 6; n++) await Promise.resolve(); };

const fakeClock = () => {
    let now = 0;
    let sequence = 0;
    const timers = new Map();
    return {
        now: () => now,
        setTimeout: (fn, delay) => { const id = ++sequence; timers.set(id, {fn, at: now + delay}); return id; },
        clearTimeout: id => timers.delete(id),
        advance (ms) {
            const target = now + ms;
            for (;;) {
                const next = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
                if (!next) break;
                now = next[1].at;
                timers.delete(next[0]);
                next[1].fn();
            }
            now = target;
        },
        get pending () { return timers.size; }
    };
};
const fixture = options => {
    const clock = fakeClock();
    const output = [];
    const inputs = [];
    const sent = [];
    let terminated = 0;
    let released = 0;
    const worker = {
        postMessage: data => sent.push(data),
        terminate: () => { terminated++; },
        emit: data => worker.onmessage?.({data})
    };
    const session = createCodeExecutionSession({
        workerSource: '/* fake transport; behavior is exercised through messages */', code: 'source snapshot',
        clock, timeoutMs: 100, flushIntervalMs: 10,
        onOutput: (text, metadata) => output.push({text, ...metadata}),
        onInput: request => inputs.push(request),
        createWorker: () => ({worker, release: () => { released++; }}),
        ...options
    });
    return {session, worker, clock, output, inputs, sent,
        emit: data => worker.emit({runId: session.id, ...data}),
        get terminated () { return terminated; }, get released () { return released; }};
};

test('live output batches, ignores other runs, and flushes before final cleanup', async () => {
    const f = fixture();
    await drain();
    assert.equal(f.sent[0].code, 'source snapshot');
    assert.equal(f.sent[0].runId, f.session.id);
    f.emit({type: 'out', text: 'a'});
    f.emit({type: 'out', text: 'b'});
    f.worker.emit({runId: 'old-run', type: 'out', text: 'stale'});
    f.worker.emit({runId: 'old-run', type: 'done'});
    assert.equal(f.output.length, 0);
    f.clock.advance(10);
    assert.equal(f.output.length, 1);
    assert.equal(f.output[0].text, 'ab');
    f.emit({type: 'out', text: 'c'});
    f.emit({type: 'done'});
    const result = await f.session.promise;
    assert.equal(result.status, 'completed');
    assert.equal(result.output, 'abc');
    assert.equal(f.output.at(-1).text, 'abc');
    assert.equal(f.clock.pending, 0);
    assert.equal(f.terminated, 1);
    assert.equal(f.released, 1);
    assert.equal(f.session.stop(), false);
    assert.equal(f.worker.onmessage, null);
});

test('output reset removes replay duplicates without replenishing the budget', async () => {
    const f = fixture({maxOutputChars: 6});
    await drain();
    f.emit({type: 'out', text: 'abc'});
    f.emit({type: 'output-reset'});
    assert.equal(f.output.at(-1).text, '');
    assert.equal(f.output.at(-1).reset, true);
    f.emit({type: 'out', text: 'defghi'});
    const result = await f.session.promise;
    assert.equal(result.status, 'output-limit');
    assert.equal(result.output, 'def');
    assert.equal(result.totalOutputChars, 6);
    assert.equal(result.truncated, true);
    assert.equal(f.output.at(-1).text, 'def');
    assert.equal(f.terminated, 1);
});

test('input flushes output, pauses only the remaining execution budget, and validates replies', async () => {
    const f = fixture();
    await drain();
    f.clock.advance(30);
    f.emit({type: 'out', text: 'before\n'});
    f.emit({type: 'input', requestId: 1, prompt: 'Name?'});
    assert.equal(f.output.at(-1).text, 'before\n');
    assert.equal(f.inputs.at(-1).prompt, 'Name?');
    f.clock.advance(10000);
    assert.equal(f.terminated, 0, 'human waiting time is not execution time');
    assert.equal(f.session.replyToInput(2, 'wrong request'), false);
    assert.equal(f.session.replyToInput(1, 'Ada'), true);
    assert.equal(f.inputs.at(-1), null);
    assert.deepEqual(f.sent.at(-1), {type: 'input-reply', runId: f.session.id, requestId: 1, value: 'Ada'});
    assert.equal(f.session.replyToInput(1, 'duplicate'), false);
    f.clock.advance(69);
    assert.equal(f.terminated, 0);
    f.clock.advance(1);
    assert.equal((await f.session.promise).status, 'timeout');
    assert.equal(f.terminated, 1);
    assert.equal(f.clock.pending, 0);
});

test('Stop while waiting clears input and ignores a late answer and queued messages', async () => {
    const f = fixture();
    await drain();
    f.emit({type: 'input', requestId: 'question-1', prompt: 'Value?'});
    const queuedHandler = f.worker.onmessage;
    assert.equal(f.session.stop('user'), true);
    assert.equal(f.session.replyToInput('question-1', 'late'), false);
    queuedHandler({data: {runId: f.session.id, type: 'out', text: 'late output'}});
    assert.equal(f.inputs.at(-1), null);
    assert.equal(f.sent.length, 1);
    const result = await f.session.promise;
    assert.equal(result.status, 'stopped');
    assert.equal(result.reason, 'user');
    assert.equal(result.output, '');
    assert.equal(f.terminated, 1);
    assert.equal(f.clock.pending, 0);
});

test('overlapping and reused input IDs cannot redirect another answer', async () => {
    for (const reuse of [false, true]) {
        const f = fixture();
        await drain();
        f.emit({type: 'input', requestId: 1, prompt: 'First'});
        if (reuse) f.session.replyToInput(1, 'one');
        f.emit({type: 'input', requestId: reuse ? 1 : 2, prompt: 'Second'});
        assert.equal((await f.session.promise).status, 'error');
        assert.equal(f.session.replyToInput(1, 'late'), false);
        assert.equal(f.terminated, 1);
    }
});

test('disposing during a lazy load prevents a worker from being created later', async () => {
    let resolveSource;
    let created = 0;
    const sourcePromise = new Promise(resolve => { resolveSource = resolve; });
    const session = createCodeExecutionSession({workerSource: () => sourcePromise, code: '',
        createWorker: () => { created++; throw new Error('must not start'); }});
    await drain();
    session.dispose();
    resolveSource('late runtime source');
    await drain();
    const result = await session.promise;
    assert.equal(result.status, 'stopped');
    assert.equal(result.reason, 'disposed');
    assert.equal(created, 0);
});

test('worker errors stay in the session and release their resources once', async () => {
    const f = fixture();
    await drain();
    let prevented = false;
    const handler = f.worker.onerror;
    handler({message: 'worker load failure', preventDefault: () => { prevented = true; }});
    handler({message: 'duplicate error', preventDefault () {}});
    const result = await f.session.promise;
    assert.equal(prevented, true);
    assert.equal(result.status, 'error');
    assert.equal(result.error, 'worker load failure');
    assert.equal(f.terminated, 1);
    assert.equal(f.released, 1);
    assert.equal(f.clock.pending, 0);
});

test('source, creation and dispatch failures settle without leaking an owned worker', async () => {
    const sourceFailure = createCodeExecutionSession({workerSource: () => { throw new Error('source failed'); }, code: ''});
    assert.equal((await sourceFailure.promise).status, 'unavailable');
    const creationFailure = fixture({createWorker: () => { throw new Error('worker unavailable'); }});
    assert.equal((await creationFailure.session.promise).status, 'unavailable');
    const f = fixture();
    f.worker.postMessage = () => { throw new Error('clone failed'); };
    const result = await f.session.promise;
    assert.equal(result.status, 'error');
    assert.equal(result.error, 'clone failed');
    assert.equal(f.terminated, 1);
    assert.equal(f.released, 1);
    assert.equal(f.clock.pending, 0);
});

test('Stop terminates an actual busy worker while the parent remains responsive', {timeout: 5000}, async () => {
    let thread;
    let exited;
    let sawOutput;
    const firstOutput = new Promise(resolve => { sawOutput = resolve; });
    const session = createCodeExecutionSession({
        workerSource: `const {parentPort} = require('node:worker_threads');
            parentPort.on('message', message => {
                parentPort.postMessage({runId: message.runId, type: 'out', text: 'started\\n'});
                while (true) {}
            });`,
        code: '', timeoutMs: 2000, flushIntervalMs: 0,
        onOutput: text => { if (text.includes('started')) sawOutput(); },
        createWorker: workerSource => {
            thread = new Worker(workerSource, {eval: true});
            exited = new Promise(resolve => thread.once('exit', resolve));
            const adapter = {
                postMessage: data => thread.postMessage(data),
                terminate: () => thread.terminate(),
                onmessage: null, onerror: null, onmessageerror: null
            };
            thread.on('message', data => adapter.onmessage?.({data}));
            thread.on('error', error => adapter.onerror?.({message: error.message, preventDefault () {}}));
            return {worker: adapter};
        }
    });
    try {
        await firstOutput;
        let parentResponsive = false;
        await new Promise(resolve => setTimeout(() => { parentResponsive = true; resolve(); }, 20));
        assert.equal(parentResponsive, true);
        session.stop('user');
        const result = await session.promise;
        await exited;
        assert.equal(result.status, 'stopped');
        assert.equal(result.output, 'started\n');
    } finally {
        session.dispose();
        if (thread) await thread.terminate();
    }
});
