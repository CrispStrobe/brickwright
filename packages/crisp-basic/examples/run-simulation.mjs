// Run the ordinary BASIC library against a fresh deterministic host per run.
import {readFile} from 'node:fs/promises';
import {createWasmSession} from '../browser.mjs';
import {createSimulationHost} from '../src/simulation-host.mjs';

const source = await readFile(new URL('./simulation.bas', import.meta.url), 'utf8');
let host;
const session = createWasmSession({
    simulation: {
        maxRequests: 100,
        createHost() {
            host = createSimulationHost({pins: [0, 1]});
            host.scheduleInput(1, 0, 25);
            return host;
        }
    },
    onEvent(event) {
        if (event.type === 'output') process.stdout.write(event.bytes);
    }
});
try {
    const result = await session.run(source, {filename: 'simulation.bas'});
    if (result.error) console.error(result.error);
    console.log(JSON.stringify(host?.trace ?? [], null, 2));
    process.exitCode = result.status === 'completed' ? result.exitCode : 1;
} finally {
    await session.dispose();
}
