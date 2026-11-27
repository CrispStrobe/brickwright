import {parentPort} from 'node:worker_threads';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {loadCircuitModel} from './polarity-oracle.mjs';
import {checkBehavior} from './circuit-example-behavior.mjs';

const root = join(import.meta.dirname, '../..');
const examples = join(root, 'overlay/scratch-gui/examples');
const {Circuit} = await loadCircuitModel(root);

async function run (bench) {
    const result = {smoke: 'fail', behavior: {status: 'unverified', reason: 'Smoke check did not finish'}};
    let circuit;
    try {
        const data = JSON.parse(await readFile(join(examples, bench.file), 'utf8'));
        circuit = Circuit.fromJSON(data);
        if (!circuit.board || circuit.netlistError || !circuit.board.parts.length) {
            throw new Error(circuit.netlistError || 'Empty circuit engine netlist');
        }
        circuit.setPower(true);
        const target = circuit.board.getTime() + 1_000_000n;
        const receipt = circuit.advanceToLive(target, {maxSteps: 128});
        if (!receipt.completed) {
            return {...result, smoke: 'incomplete', reason: `Reached ${receipt.processedTimeNs} ns within the smoke budget`};
        }
        result.smoke = 'pass';
    } catch (error) {
        return {...result, reason: error.message};
    }
    if (bench.smokeOnly) {
        return {...result, behavior: {status: 'unverified', reason: 'Smoke-only run'}};
    }
    parentPort.postMessage({type: 'behavior'});
    try {
        result.behavior = await checkBehavior(bench, circuit, examples);
    } catch (error) {
        result.behavior = {status: 'fail', reason: error.message};
    }
    return result;
}

parentPort.on('message', async bench => {
    parentPort.postMessage({type: 'result', result: await run(bench)});
});
parentPort.postMessage({type: 'ready'});
