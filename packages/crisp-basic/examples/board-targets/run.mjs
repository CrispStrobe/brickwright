// A real WASM interpreter with a fresh named logical host for each run.
import {readFile} from 'node:fs/promises';
import {createWasmSession, prepareTargetSimulation} from '../../browser.mjs';

const examples = new Map([
    ['8051', '8051'], ['stc15', 'stc15'], ['stm32', 'stm32'],
    ['pico', 'pico'], ['rp2040', 'pico'], ['nano', 'nano'],
    ['esp8266', 'esp8266'], ['8266', 'esp8266'],
    ['microbit', 'microbit'], ['micro:bit', 'microbit'],
    ['microbit-breakout', 'microbit-breakout']
]);
const name = process.argv[2] ?? 'pico';
const file = examples.get(name.toLowerCase());
if (!file || process.argv.length > 3) {
    console.error('Usage: node examples/board-targets/run.mjs [' + [...examples.keys()].join('|') + ']');
    process.exitCode = 2;
} else {
    const [source, json] = await Promise.all([
        readFile(new URL(file + '.bas', import.meta.url), 'utf8'),
        readFile(new URL(file + '.json', import.meta.url), 'utf8')
    ]);
    const prepared = prepareTargetSimulation(name, JSON.parse(json));
    let host;
    const session = createWasmSession({
        simulation: {maxRequests: prepared.maxRequests, createHost() {
            host = prepared.createHost();
            return host;
        }},
        onEvent(event) {
            if (event.type === 'output') process.stdout.write(event.bytes);
        }
    });
    try {
        const result = await session.run(source, {filename: file + '.bas'});
        if (result.error) console.error(JSON.stringify(result.error, null, 2));
        // Trace goes to stderr, leaving BASIC's stdout usable in pipelines.
        console.error(JSON.stringify({target: prepared.target.id, status: result.status,
            trace: host?.trace ?? []}, null, 2));
        process.exitCode = result.status === 'completed' ? result.exitCode : 1;
    } finally {
        await session.dispose();
    }
}
