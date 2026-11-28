// Deliberately small protocol peer, not an interpreter replacement. The pure
// JavaScript bridge tests use it to send records that real C cannot produce.
import {parentPort} from 'node:worker_threads';

let started = false;
let waiting = null;
const send = record => parentPort.postMessage(record);
const finish = () => send({type: 'result', version: 1, status: 'completed', exitCode: 0, diagnostics: ''});

parentPort.on('message', message => {
    if (message.type === 'simulation-reply' && waiting) {
        const resolve = waiting;
        waiting = null;
        resolve(message);
    } else if (message.type === 'start' && !started) {
        started = true;
        void execute(message).catch(error => send({type: 'result', version: 1,
            status: 'host-error', exitCode: null, diagnostics: '',
            error: {kind: 'host', message: error.message}}));
    }
});

async function execute(config) {
    const match = /^\d+ REM (.+)\n$/.exec(config.source);
    if (!match) throw new Error('Expected one REM line containing the fixture script');
    const script = JSON.parse(match[1]);
    const replies = [];
    let nextId = 1;
    for (const step of script) {
        if (step.type === 'pause') return await new Promise(() => {});
        if (step.type === 'complete') return finish();
        if (step.type === 'output') {
            send({type: 'output', version: 1, bytes: Uint8Array.from(step.bytes)});
            continue;
        }
        const record = {type: 'simulation-request', version: 1, runId: config.runId,
            requestId: nextId++, operation: 5, args: [0, 0], ...step.record};
        if (step.runOffset !== undefined) record.runId = config.runId + step.runOffset;
        for (const key of step.omit ?? []) delete record[key];
        for (const index of step.argumentHoles ?? []) delete record.args[index];
        if (step.extraArgumentProperty) record.args.extra = 'unexpected payload';
        if (step.await === false) send(record);
        else {
            const reply = new Promise(resolve => { waiting = resolve; });
            send(record);
            replies.push(await reply);
        }
    }
    send({type: 'output', version: 1, bytes: new TextEncoder().encode(JSON.stringify(replies))});
    finish();
}
