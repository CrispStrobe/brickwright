import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {parseArgs} from 'node:util';
import {Worker} from 'node:worker_threads';

const help = `bwlite circuit test [EXAMPLE_ID] [--device DEVICE] [--smoke-only] [--jobs N] [--timeout-ms MS] [--json]

Without an ID test every circuit and device variant listed in the gallery.
Every bench is loaded, powered on and advanced 1 ms in the circuit engine.
--timeout-ms sets the worker wall-clock budget for this startup check.
Functional checks cover lesson scenarios, separately measured electrical I/O,
or non-rail voltage/current assertions on the exact authored circuit.
Exit 1 indicates a failed or incomplete startup check, or a bench without a passing functional check.
--smoke-only checks startup alone and reports functional coverage as unverified.`;

function startWorker (smokeTimeout) {
    const worker = new Worker(new URL('./lib/circuit-example-worker.mjs', import.meta.url), {
        execArgv: ['--import', new URL('./lib/register-gui-scope.mjs', import.meta.url).href],
        stdout: true,
        stderr: true
    });
    // Engine and VM diagnostics can't interleave with the result stream.
    worker.stdout.resume();
    worker.stderr.resume();
    let request;
    let phase;

    const fail = error => request?.(error);
    worker.on('error', fail);
    worker.on('exit', code => fail(new Error(`Circuit worker exited (${code})`)));
    function waitFor (type, ms) {
        return new Promise((resolve, reject) => {
            const onTimeout = () => finish(new Error('Circuit worker timed out'));
            let timeout = setTimeout(onTimeout, ms);
            const onMessage = message => {
                if (message.type === type) finish(null, message.result);
                else if (message.type === 'behavior') {
                    phase = 'behavior';
                    clearTimeout(timeout);
                    timeout = setTimeout(onTimeout, 30_000);
                }
            };
            function finish (error, result) {
                clearTimeout(timeout);
                worker.off('message', onMessage);
                request = undefined;
                if (error) reject(error);
                else resolve(result);
            }
            request = finish;
            worker.on('message', onMessage);
        });
    }
    return {
        ready: waitFor('ready', 30_000),
        run (bench) {
            phase = 'smoke';
            const result = waitFor('result', smokeTimeout);
            worker.postMessage(bench);
            return result;
        },
        phase: () => phase,
        close: () => worker.terminate()
    };
}

async function main () {
    const {positionals, values} = parseArgs({
        allowPositionals: true,
        options: {device: {type: 'string'}, jobs: {type: 'string'}, 'timeout-ms': {type: 'string'},
            json: {type: 'boolean'}, 'smoke-only': {type: 'boolean'}, help: {type: 'boolean'}}
    });
    const [command, id, extra] = positionals;
    if (values.help) {
        console.log(help);
        return;
    }
    if (command !== 'test' || extra) throw new Error(help);
    const jobs = Number(values.jobs ?? 4);
    if (!Number.isInteger(jobs) || jobs < 1 || jobs > 8) throw new Error('--jobs must be between 1 and 8');

    const smokeTimeout = Number(values['timeout-ms'] ?? 8_000);
    if (!Number.isInteger(smokeTimeout) || smokeTimeout < 1 || smokeTimeout > 300_000) {
        throw new Error('--timeout-ms must be between 1 and 300000');
    }

    const catalog = JSON.parse(await readFile(join(import.meta.dirname, '../overlay/scratch-gui/examples/index.json'), 'utf8'));
    const benches = [];
    for (const item of catalog) {
        if (id && item.id !== id) continue;
        const variants = Object.entries(item.benches ?? {});
        const defaultFile = item.files?.circuit;
        const sameAsDefault = variants.some(([, file]) => file === defaultFile);
        if (defaultFile && !sameAsDefault) variants.unshift([null, defaultFile]);
        for (const [device, file] of variants) {
            if (!values.device || device === values.device) {
                benches.push({id: item.id, device, file, program: item.files?.program, rom: item.files?.rom,
                    cp1: file === defaultFile ? item.files.cp1 : undefined,
                    expected: file === defaultFile
                        ? item.files.expected ?? join(file, '..', 'EXPECTED.md') : undefined});
            }
        }
    }
    if (!benches.length) throw new Error('No matching gallery circuit benches');
    const rows = new Array(benches.length);
    let cursor = 0;
    async function checkBenches () {
        let worker;
        try {
            while (cursor < benches.length) {
                const index = cursor++;
                const bench = benches[index];
                if (!worker) {
                    worker = startWorker(smokeTimeout);
                    await worker.ready;
                }
                let result;
                try {
                    result = await worker.run({...bench, smokeOnly: values['smoke-only']});
                } catch (error) {
                    result = worker.phase() === 'behavior'
                        ? {smoke: 'pass', behavior: {status: 'incomplete', reason: error.message}}
                        : {smoke: 'incomplete', reason: error.message,
                            behavior: {status: 'unverified', reason: 'Worker interrupted'}};
                    await worker.close();
                    worker = null;
                }
                const row = {...bench, ...result};
                rows[index] = row;
                if (!values.json) {
                    const detail = row.reason ?? row.behavior.reason;
                    const label = row.device ? `${row.id}/${row.device}` : row.id;
                    console.log(`${label}  smoke=${row.smoke}  behavior=${row.behavior.status}${row.behavior.scope ? '/' + row.behavior.scope : ''}${detail ? '  ' + detail : ''}`);
                    for (const check of row.behavior.checks ?? []) {
                        console.log(`  ${check.ok ? 'PASS' : 'FAIL'} ${JSON.stringify(check)}`);
                    }
                }
            }
        } finally {
            await worker?.close();
        }
    }
    const results = await Promise.allSettled(Array.from({length: Math.min(jobs, benches.length)}, checkBenches));
    const failure = results.find(result => result.status === 'rejected');
    if (failure) throw failure.reason;
    const countBy = statuses => statuses.reduce((counts, status) => {
        counts[status] = (counts[status] || 0) + 1;
        return counts;
    }, {});
    const summary = {examples: new Set(rows.map(row => row.id)).size, benches: rows.length,
        smoke: countBy(rows.map(row => row.smoke)), behavior: countBy(rows.map(row => row.behavior.status)),
        functionalCoverage: countBy(rows.filter(row => row.behavior.status === 'pass')
            .map(row => row.behavior.scope ?? 'lesson'))};
    if (values.json) console.log(JSON.stringify({summary, rows}, null, 2));
    else console.log(JSON.stringify(summary));
    if (rows.some(row => row.smoke !== 'pass' ||
        (!values['smoke-only'] && row.behavior.status !== 'pass'))) process.exitCode = 1;
}

try {
    await main();
} catch (error) {
    console.error(error.message);
    process.exitCode = 2;
}
