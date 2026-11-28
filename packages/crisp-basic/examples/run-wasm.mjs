// Run the same source as the native structured example in a fresh WASM worker.
import {readFile} from 'node:fs/promises';
import {createWasmSession} from '../browser.mjs';

const source = await readFile(new URL('./structured.bas', import.meta.url), 'utf8');
const session = createWasmSession({
    onEvent(event) {
        if (event.type === 'output') process.stdout.write(event.bytes);
    }
});
try {
    const result = await session.run(source, {filename: 'structured.bas'});
    if (result.error) console.error(result.error);
    process.exitCode = result.status === 'completed' ? result.exitCode : 1;
} finally {
    await session.dispose();
}
