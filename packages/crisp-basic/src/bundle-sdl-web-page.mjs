const escapeHTML = text => text.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));
const inlineJSON = value => JSON.stringify(value).replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

/** Pure renderer: all executable bytes, source, notices and assets are inline. */
export function renderSDLWebPage(payload, title) {
    return String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHTML(title)} — CrispBASIC</title><link rel="icon" href="data:,">
<style>
:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#101820;color:#eaf1f6}*{box-sizing:border-box}
body{margin:0 auto;padding:28px 20px 60px;max-width:1040px}h1{font-size:clamp(1.5rem,4vw,2.3rem);margin:.3em 0}
p{line-height:1.6;color:#bdcbd6}.controls{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:20px 0}
button{font:inherit;border:1px solid #516272;border-radius:6px;background:#263d50;color:inherit;padding:9px 16px;cursor:pointer}
button:disabled{opacity:.45;cursor:default}button:first-child{background:#265e79}label{display:flex;align-items:center;gap:7px;font-size:.9rem}
#status{margin-left:auto;font-size:.9rem;color:#9cd8b4}#status.failed{color:#ffb4a9}
canvas{display:block;max-width:100%;height:auto;background:#000;border:1px solid #405361;margin:auto;outline:none}
details{margin:20px 0;padding:15px;background:#172630;border:1px solid #2b4252;border-radius:8px}summary{cursor:pointer;font-weight:600}
pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:.8rem;line-height:1.5;color:#c4d2dc}#output{min-height:4em}a{color:#9dd8fa}
</style></head><body>
<h1>${escapeHTML(title)}</h1><p>BBC BASIC with SDL graphics, sound and a browser-local filesystem. Start the program to enable audio and keyboard input.</p>
<div class="controls"><button id="start">Start</button><button id="stop" disabled>Stop</button><button id="restart">Restart</button>
<label><input id="capture" type="checkbox">Capture output bytes</label><span id="status" role="status">Ready</span></div>
<canvas id="canvas" width="640" height="500" tabindex="0" aria-label="BBC BASIC display"></canvas>
<details><summary>Output bytes</summary><p>Optional capture records raw VDU bytes; the canvas remains the program's display.</p>
<button id="download">Download output.bin</button><pre id="output">Byte capture is disabled by default.</pre></details>
<details><summary>Runtime capabilities and limitations</summary><pre id="limits"></pre></details>
<details><summary>Copyright and licence notices</summary><pre id="notices"></pre></details>
<script type="application/json" id="crispbasic-sdl-payload">${inlineJSON(payload)}</script>
<script>
(() => {
    'use strict';
    const payload = JSON.parse(document.getElementById('crispbasic-sdl-payload').textContent);
    const canvas = document.getElementById('canvas');
    const status = document.getElementById('status');
    const startButton = document.getElementById('start');
    const stopButton = document.getElementById('stop');
    const captureBox = document.getElementById('capture');
    const decode = text => Uint8Array.from(atob(text), character => character.charCodeAt(0));
    const urls = [], errors = [];
    let module, starting, completion, finish, timer, state = 'idle', exitCode = null;
    let output = new Uint8Array(), stopped = false, captureEnabled = false;
    const setState = (next, message) => {
        state = next;
        status.textContent = message || next;
        status.className = next === 'failed' ? 'failed' : '';
    };
    const refresh = () => {
        if (!module) return output;
        const length = module._crisp_sdl_output_length();
        if (length !== output.length) {
            const address = module._crisp_sdl_output();
            output = module.HEAPU8.slice(address, address + length);
            document.getElementById('output').textContent = new TextDecoder('windows-1252').decode(output);
        }
        return output;
    };
    const settle = (next, code, error) => {
        if (['completed', 'cancelled', 'failed'].includes(state)) return;
        clearInterval(timer);
        refresh();
        exitCode = code;
        setState(next, error || (next === 'completed' ? 'Finished (exit ' + code + ')' : next));
        stopButton.disabled = true;
        if (finish) finish({status: next, exitCode: code, output: output.slice(), captured: captureEnabled, error: error || null});
    };
    async function startRuntime() {
        if (!crossOriginIsolated || typeof SharedArrayBuffer === 'undefined') {
            throw new Error('This SDL page needs isolation headers. Run crispbasic serve your-program.html, then open its local URL.');
        }
        const runtimeURL = URL.createObjectURL(new Blob([decode(payload.module)], {type: 'text/javascript'}));
        const wasmBytes = decode(payload.wasm);
        const wasmURL = URL.createObjectURL(new Blob([wasmBytes], {type: 'application/wasm'}));
        urls.push(runtimeURL, wasmURL);
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = runtimeURL;
            script.onload = resolve;
            script.onerror = () => reject(new Error('Unable to load the embedded SDL runtime'));
            document.head.appendChild(script);
        });
        module = await createCrispBasicSDL({
            canvas, wasmBinary: wasmBytes, mainScriptUrlOrBlob: runtimeURL,
            arguments: ['/program.bas'],
            locateFile: name => {
                if (name.endsWith('.wasm')) return wasmURL;
                throw new Error('Unexpected external runtime asset: ' + name);
            },
            print: text => errors.push(String(text)),
            printErr: text => errors.push(String(text)),
            onAbort: message => settle('failed', null, String(message)),
            onExit: code => settle(code ? 'failed' : 'completed', code, code ? 'Runtime exited with code ' + code : null),
            preRun: [runtime => {
                runtime.FS.mkdirTree('/lib');
                runtime.FS.writeFile('/program.bas', decode(payload.program));
                for (const asset of payload.resources) {
                    const path = '/' + asset.path;
                    const slash = path.lastIndexOf('/');
                    if (slash > 0) runtime.FS.mkdirTree(path.slice(0, slash));
                    runtime.FS.writeFile(path, decode(asset.data));
                }
                runtime.ENV.CRISP_BASIC_SOURCE = '/program.bas';
                runtime.ENV.CRISP_BASIC_BATCH = '1';
                runtime.ENV.CRISP_BASIC_CAPTURE_VDU = captureEnabled ? '1' : '0';
            }]
        });
        if (module._crisp_sdl_startup_failed()) {
            settle('failed', module._crisp_sdl_exit_code(), errors.at(-1) || 'SDL initialization failed');
            module.PThread.terminateAllThreads();
            return;
        }
        if (stopped) {
            module._crisp_sdl_stop();
            module.PThread.terminateAllThreads();
            return;
        }
        setState('running', 'Running');
        canvas.focus({preventScroll: true});
        timer = setInterval(() => {
            refresh();
            if (module._crisp_sdl_output_overflow()) {
                module._crisp_sdl_stop();
                module.PThread.terminateAllThreads();
                settle('failed', null, 'Optional VDU capture exceeded 16 MiB; restart with capture disabled for unbounded execution.');
            } else if (module._crisp_sdl_finished()) {
                settle('completed', module._crisp_sdl_exit_code());
            }
        }, 16);
    }
    const validateInput = text => {
        if (typeof text !== 'string' || text.length > (1 << 20) || [...text].some(character => character.codePointAt(0) > 255)) {
            throw new Error('Input must be a Latin-1 string of at most 1 MiB');
        }
    };
    async function writeInput(text) {
        validateInput(text);
        await starting;
        for (const character of text.replace(/\r\n?/g, '\n')) {
            const byte = character === '\n' ? 13 : character.charCodeAt(0);
            while (state === 'running' && !module._crisp_sdl_write_key(byte)) {
                await new Promise(resolve => setTimeout(resolve, 5));
            }
            if (state !== 'running') break;
        }
    }
    function run({input = '', capture = false} = {}) {
        if (state !== 'idle') return completion || Promise.reject(new Error('Restart this page to run again'));
        validateInput(input);
        if (typeof capture !== 'boolean') throw new Error('capture must be a boolean');
        captureEnabled = capture;
        captureBox.checked = capture;
        captureBox.disabled = true;
        if (!capture) document.getElementById('output').textContent = 'Byte capture is disabled for this run.';
        setState('starting', 'Starting');
        startButton.disabled = true;
        stopButton.disabled = false;
        completion = new Promise(resolve => { finish = resolve; });
        starting = startRuntime().catch(error => {
            errors.push(error.message);
            settle('failed', null, error.message);
        });
        if (input) writeInput(input).catch(error => settle('failed', null, error.message));
        return completion;
    }
    function stop() {
        stopped = true;
        if (module) {
            module._crisp_sdl_stop();
            module.PThread.terminateAllThreads();
        }
        settle('cancelled', null);
    }
    window.crispbasicSDL = {
        run, stop, writeInput, metadata: payload.metadata,
        get captured() { return captureEnabled; },
        get status() { return state; },
        get exitCode() { return exitCode; },
        get output() { return refresh().slice(); },
        get errors() { return errors.slice(); },
        readFile(path) {
            if (!module) throw new Error('The runtime has not started');
            return module.FS.readFile(path);
        }
    };
    startButton.addEventListener('click', () => run({capture: captureBox.checked}));
    stopButton.addEventListener('click', stop);
    document.getElementById('restart').addEventListener('click', () => location.reload());
    document.getElementById('download').addEventListener('click', () => {
        const url = URL.createObjectURL(new Blob([refresh()], {type: 'application/octet-stream'}));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'output.bin';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    document.getElementById('limits').textContent = (payload.metadata.limitations || []).join('\n\n');
    document.getElementById('notices').textContent = payload.metadata.notices.map(notice => notice.name + '\n\n' + notice.text).join('\n\n────────\n\n');
    addEventListener('pagehide', () => {
        if (module) module.PThread.terminateAllThreads();
        for (const url of urls) URL.revokeObjectURL(url);
    });
})();
</script></body></html>`;
}
