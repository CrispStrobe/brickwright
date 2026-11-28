// Original code, BSD-3-Clause. No network resources are used by this document.
// Keep the browser function self-contained: its source is embedded verbatim.
function offlineMain(assets) {
    const output = document.getElementById('output');
    const status = document.getElementById('status');
    const form = document.getElementById('input-form');
    const input = document.getElementById('input');
    const bytes = value => Uint8Array.from(atob(value), character => character.charCodeAt(0));
    const text = value => new TextDecoder().decode(bytes(value));
    const encode = value => {
        const data = new TextEncoder().encode(value);
        let binary = '';
        for (let offset = 0; offset < data.length; offset += 8192) {
            binary += String.fromCharCode(...data.subarray(offset, offset + 8192));
        }
        return btoa(binary);
    };
    // A file: document has an opaque origin. Separate blob: module URLs cannot
    // be imported reliably across that origin; data: dependencies are portable.
    const moduleURL = base64 => `data:text/javascript;base64,${base64}`;
    const runtimeURL = moduleURL(assets.module);
    const factoryURL = moduleURL(btoa(`import factory from ${JSON.stringify(runtimeURL)};
        const binary=Uint8Array.from(atob(${JSON.stringify(assets.wasm)}), c=>c.charCodeAt(0));
        export default options=>factory({...options,wasmBinary:binary,locateFile:path=>path});`));
    const protocolURL = moduleURL(assets.protocol);
    const workerURL = moduleURL(encode(
        text(assets.worker).replace("'./simulation-protocol.mjs'", JSON.stringify(protocolURL))));
    const source = atob(assets.program);
    document.getElementById('metadata').textContent = JSON.stringify(assets.metadata, null, 2);
    let active = null, runId = 0, lastResult = null;

    const latin1 = array => {
        let result = '';
        for (let offset = 0; offset < array.length; offset += 8192) {
            result += String.fromCharCode(...array.subarray(offset, offset + 8192));
        }
        return result;
    };
    const asBytes = value => {
        if (value instanceof Uint8Array) return value.slice();
        if (typeof value !== 'string') throw new TypeError('Input must be Latin-1 text or Uint8Array');
        if ([...value].some(character => character.codePointAt(0) > 255)) throw new Error('Input must contain Latin-1 characters');
        return Uint8Array.from(value, character => character.charCodeAt(0));
    };
    const finish = (run, result) => {
        if (run.finished) return;
        run.finished = true;
        run.worker.terminate();
        const raw = new Uint8Array(run.length);
        let offset = 0;
        for (const chunk of run.chunks) { raw.set(chunk, offset); offset += chunk.length; }
        lastResult = {...result, output: raw, text: latin1(raw)};
        if (active === run) {
            active = null;
            status.textContent = result.status === 'completed' ? `Completed (exit ${result.exitCode})` :
                `${result.status}: ${result.error?.message || ''}`;
            form.hidden = true;
        }
        run.resolve(lastResult);
    };
    const stop = () => {
        if (active) finish(active, {status: 'cancelled', exitCode: null});
    };
    const writeInput = value => {
        if (!active || !active.interactive || active.inputEnded) throw new Error('No interactive input stream is open');
        const data = asBytes(value);
        if (active.inputBytes + data.length > 1024 * 1024) throw new Error('Input exceeds the 1 MiB limit');
        active.inputBytes += data.length;
        active.worker.postMessage({type: 'input', bytes: data});
    };
    const endInput = () => {
        if (!active || active.inputEnded) return;
        active.inputEnded = true;
        active.worker.postMessage({type: 'end-input'});
        form.hidden = true;
    };
    const run = ({input: initialInput = '', interactive = true} = {}) => {
        const data = asBytes(initialInput);
        if (data.length > 1024 * 1024) throw new Error('Input exceeds the 1 MiB limit');
        if (typeof interactive !== 'boolean') throw new TypeError('interactive must be boolean');
        stop();
        output.textContent = '';
        form.hidden = !interactive;
        status.textContent = 'Running';
        const worker = new Worker(workerURL, {type: 'module', name: 'CrispBASIC bundle'});
        const current = {worker, chunks: [], length: 0, finished: false, inputBytes: data.length,
            interactive, inputEnded: !interactive};
        const done = new Promise(resolve => { current.resolve = resolve; });
        active = current;
        worker.addEventListener('message', event => {
            if (current.finished) return;
            const message = event.data;
            if (message.type === 'output') {
                current.chunks.push(message.bytes);
                current.length += message.bytes.length;
                output.textContent += latin1(message.bytes).replace(/\r/g, '');
            } else if (message.type === 'input') {
                status.textContent = 'Waiting for input';
                if (current.interactive) input.focus();
            } else if (message.type === 'result') finish(current, message);
        });
        worker.addEventListener('error', event => {
            event.preventDefault();
            finish(current, {status: 'host-error', exitCode: null,
                error: {message: event.message || 'Cannot load the embedded runtime worker'}});
        });
        worker.addEventListener('messageerror', () => finish(current,
            {status: 'host-error', exitCode: null, error: {message: 'Cannot decode worker output'}}));
        worker.postMessage({version: 1, type: 'start', runId: ++runId, moduleURL: factoryURL,
            source, input: data, inputEnded: !interactive, simulationEnabled: false,
            maxOutputBytes: 16 * 1024 * 1024});
        return done;
    };
    document.getElementById('run').addEventListener('click', () => { void run(); });
    document.getElementById('stop').addEventListener('click', stop);
    document.getElementById('eof').addEventListener('click', endInput);
    form.addEventListener('submit', event => {
        event.preventDefault();
        try { writeInput(input.value + '\n'); input.value = ''; status.textContent = 'Running'; }
        catch (error) { status.textContent = error.message; }
    });
    document.getElementById('download').addEventListener('click', () => {
        if (!lastResult) return;
        const url = URL.createObjectURL(new Blob([lastResult.output], {type: 'application/octet-stream'}));
        const link = document.createElement('a');
        link.href = url; link.download = 'output.bin'; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    // Public automation hook: bytes are unmodified, including VDU/control bytes.
    window.crispbasicBundle = Object.freeze({run, stop, writeInput, endInput,
        metadata: assets.metadata, get lastResult() { return lastResult; }});
    void run();
}

const escapeHTML = value => String(value).replace(/[&<>"']/g, character =>
    ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]));

export function renderBundlePage(assets, title) {
    // Base64 assets and escaped JSON cannot terminate the enclosing script.
    const json = JSON.stringify(assets).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHTML(title)}</title><style>
:root{color-scheme:dark}body{max-width:72rem;margin:2rem auto;padding:0 1rem;font:16px system-ui;background:#10161e;color:#eef2f6}h1{font-size:1.5rem}button,input{font:inherit;padding:.55rem .8rem;border:1px solid #657487;border-radius:.3rem;background:#1c2938;color:inherit}button{cursor:pointer}nav{display:flex;gap:.6rem;flex-wrap:wrap;align-items:center}#status{color:#aac6e5}pre{white-space:pre-wrap;overflow-wrap:anywhere}#output{min-height:18rem;padding:1rem;background:#080d13;border:1px solid #2e4054;font:15px/1.45 monospace}form{display:flex;gap:.5rem}form[hidden]{display:none}input{flex:1;min-width:0}details{margin-top:1.5rem;color:#bac9d8}#metadata{font-size:12px}a{color:#afd4ff}
</style></head><body><h1>${escapeHTML(title)}</h1>
<nav><button id="run">Run again</button><button id="stop">Stop</button><button id="download">Save output bytes</button><span id="status" role="status">Loading</span></nav>
<pre id="output" aria-live="polite"></pre><form id="input-form"><label for="input">Input</label><input id="input" autocomplete="off"><button>Send line</button><button id="eof" type="button">End input</button></form>
<details><summary>Runtime capabilities and software notices</summary><pre id="metadata"></pre></details>
<script>(${offlineMain.toString()})(${json});</script></body></html>\n`;
}
