// SPDX-License-Identifier: BSD-3-Clause
// Standalone CrispBASIC programs: the pinned interpreter plus one prepared
// program. Native bundles append the program to a prebuilt interpreter stub
// (native/crispbasic.c built with CRISP_BUNDLE); web bundles inline the
// restricted WASM runtime, its worker and the program into one HTML page.
// Neither path translates or reinterprets BASIC: the bundled BBCSDL core
// tokenizes and executes it exactly as the CLI does.
import {readFileSync, existsSync, readdirSync} from 'node:fs';
import {join, dirname, basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareSource} from './source.mjs';
import {hostNativeTarget, nativeTarget, verifyNativeBinary} from '../scripts/native-targets.mjs';
import {VERSION} from './capabilities.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const BUNDLE_MAGIC = 'CRISPBASICBUNDLE';
export const NATIVE_BUNDLE_TARGETS = Object.freeze(['linux-x64', 'linux-arm64', 'linux-armv7']);

function noticeText(files) {
    return files.map(({title, path}) => `===== ${title} (${basename(path)}) =====\n` +
        readFileSync(path, 'latin1').replace(/\r\n?/g, '\n').trimEnd() + '\n').join('\n');
}

/** Licence notices that must accompany a native bundle. */
export function nativeNotices(stubDirectory) {
    const bbcsdl = existsSync(join(stubDirectory, 'BBCSDL-LICENSE.txt')) ?
        join(stubDirectory, 'BBCSDL-LICENSE.txt') : join(root, 'native', 'BBCSDL-LICENSE.txt');
    return `CrispBASIC ${VERSION} standalone program.\n` +
        'This executable contains the BBCSDL interpreter by R. T. Russell (zlib licence),\n' +
        'modified for CrispBASIC, and CrispBASIC host code (BSD-3-Clause).\n' +
        'BBC BASIC references describe language compatibility; no endorsement is implied.\n\n' +
        noticeText([
            {title: 'CrispBASIC', path: join(root, 'LICENSE')},
            {title: 'BBCSDL interpreter', path: bbcsdl},
            {title: 'Third-party notices', path: join(root, 'THIRD-PARTY-NOTICES.md')}
        ]);
}

export function defaultStubPath(target = hostNativeTarget()) {
    nativeTarget(target);
    return target === hostNativeTarget() ? join(root, '.build', 'crispbasic-bundle-stub') :
        join(root, '.build', 'targets', target, 'crispbasic-bundle-stub');
}

function u64le(value) {
    const bytes = Buffer.alloc(8);
    bytes.writeBigUInt64LE(BigInt(value));
    return bytes;
}

/** Build the payload the CRISP_BUNDLE stub reads (see load_bundle in native/crispbasic.c). */
export function nativePayload(prepared, notices) {
    const source = Buffer.from(prepared.numberedSource, 'latin1');
    const noticeBytes = Buffer.from(notices, 'latin1');
    const map = prepared.lines.map(({basicLine, line}) => `${basicLine} ${line}\n`).join('');
    const filename = basename(prepared.filename).replace(/[\r\n]/g, '_');
    const payload = Buffer.concat([
        Buffer.from(`CRISPBASIC-BUNDLE 1\nfilename ${filename}\nmap ${prepared.lines.length}\n${map}source ${source.length}\n`, 'latin1'),
        source,
        Buffer.from(`notices ${noticeBytes.length}\n`, 'latin1'),
        noticeBytes
    ]);
    return Buffer.concat([payload, u64le(payload.length), Buffer.from(BUNDLE_MAGIC, 'latin1')]);
}

/**
 * @param {string} source BASIC program text
 * @param {{filename?: string, target?: string, stub?: string}} options
 * @returns {{executable: Buffer, notices: string, target: string}}
 */
export function createNativeBundle(source, {filename = 'main.bas', target = hostNativeTarget(), stub} = {}) {
    const configuration = nativeTarget(target);
    const prepared = prepareSource(source, {filename});
    const stubPath = stub ?? defaultStubPath(target);
    if (!existsSync(stubPath)) {
        throw new Error(`No ${target} bundle stub at ${stubPath}; run npm run build:native` +
            (target === hostNativeTarget() ? '' : ` with CRISP_BASIC_TARGET=${target} and a cross CC`));
    }
    const stubBytes = readFileSync(stubPath);
    verifyNativeBinary(stubBytes, configuration);
    if (stubBytes.subarray(-16).toString('latin1') === BUNDLE_MAGIC) {
        throw new Error('The selected stub already contains a bundled program');
    }
    const notices = nativeNotices(dirname(stubPath));
    return {executable: Buffer.concat([stubBytes, nativePayload(prepared, notices)]), notices, target};
}

// ---------------------------------------------------------------------------
// Web bundle

const WEB_MODULES = ['source.mjs', 'capabilities.mjs', 'wasm-capabilities.mjs', 'simulation-protocol.mjs',
    'simulation-host.mjs', 'wasm-session.mjs'];

/** Convert one of this package's own ES modules into an expression that
 * evaluates to its export object. Only the simple forms used in src/ are
 * accepted; anything else fails loudly instead of producing a broken page. */
function moduleExpression(name, text, modules) {
    let body = text;
    const imports = [];
    body = body.replace(/^import\s*\{([^}]*)\}\s*from\s*'\.\/([\w-]+\.mjs)';?\s*$/gm, (_, names, from) => {
        if (!modules.has(from)) throw new Error(`Web bundle: ${name} imports unbundled ${from}`);
        imports.push(`const {${names.replace(/\s+/g, ' ').trim()}} = __crispModules[${JSON.stringify(from)}];`);
        return '';
    });
    if (/^\s*import\s/m.test(body) || /^\s*export\s*\{/m.test(body) || /^\s*export\s+default/m.test(body)) {
        throw new Error(`Web bundle: unsupported module syntax in ${name}`);
    }
    const exported = [];
    body = body.replace(/^export\s+((?:async\s+)?function\*?|class|const|let)\s+([A-Za-z_$][\w$]*)/gm, (_, kind, id) => {
        exported.push(id);
        return `${kind} ${id}`;
    });
    if (/^\s*export\s/m.test(body)) throw new Error(`Web bundle: unsupported export in ${name}`);
    return `(() => {\n${imports.join('\n')}\n${body}\nreturn {${exported.join(', ')}};\n})()`;
}

function exactReplace(text, before, after, what) {
    const count = text.split(before).length - 1;
    if (count !== 1) throw new Error(`Web bundle: expected one ${what} in the worker source, found ${count}`);
    return text.split(before).join(after);
}

function workerSource(wasmModuleText, wasmBase64) {
    const modules = new Set(['simulation-protocol.mjs']);
    let worker = readFileSync(join(root, 'src', 'wasm-worker.mjs'), 'utf8');
    worker = worker.replace(/^import\s*\{([^}]*)\}\s*from\s*'\.\/simulation-protocol\.mjs';?\s*$/m,
        (_, names) => `const {${names.replace(/\s+/g, ' ').trim()}} = __crispProtocol;`);
    if (/^\s*import\s*\{/m.test(worker)) throw new Error('Web bundle: unexpected worker import');
    // The page has no file layout: the module factory and WASM bytes are
    // inlined instead of fetched. These exact-match edits apply only to the
    // bundled copy, mirroring the package's patch-upstream convention.
    worker = exactReplace(worker, 'const {default: factory} = await import(moduleURL.href);',
        'const factory = __crispFactory;', 'module import');
    worker = exactReplace(worker, 'locateFile: path => new URL(path, moduleURL).href,',
        'locateFile: path => path, wasmBinary: __crispWasmBinary(),', 'locateFile option');
    const protocol = moduleExpression('simulation-protocol.mjs',
        readFileSync(join(root, 'src', 'simulation-protocol.mjs'), 'utf8'), modules);
    const factory = exactReplace(wasmModuleText, 'export default Module;', '', 'module export')
        .replace(/^var Module\s*=/m, 'var __crispFactoryValue =');
    if (!/var __crispFactoryValue\s*=/.test(factory)) throw new Error('Web bundle: unrecognized Emscripten module layout');
    return `// CrispBASIC bundled WASM worker. Generated by crispbasic bundle --web.\n` +
        `${factory}\nconst __crispFactory = __crispFactoryValue;\n` +
        `const __crispWasmBinary = () => Uint8Array.from(atob(${JSON.stringify(wasmBase64)}), c => c.charCodeAt(0));\n` +
        `const __crispProtocol = ${protocol};\n${worker}`;
}

function sessionSource() {
    const modules = new Set(WEB_MODULES);
    const parts = WEB_MODULES.map(name => `__crispModules[${JSON.stringify(name)}] = ` +
        moduleExpression(name, readFileSync(join(root, 'src', name), 'utf8'), modules) + ';');
    return `const __crispModules = {};\n${parts.join('\n')}\n`;
}

const escapeScript = text => text.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
const escapeHTML = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * @param {string} source
 * @param {{filename?: string, wasmDirectory?: string, title?: string}} options
 * @returns {{html: string, notices: string}}
 */
export function createWebBundle(source, {filename = 'main.bas', wasmDirectory = join(root, '.build', 'wasm'), title} = {}) {
    const prepared = prepareSource(source, {filename});
    const modulePath = join(wasmDirectory, 'crispbasic.mjs');
    const wasmPath = join(wasmDirectory, 'crispbasic.wasm');
    if (!existsSync(modulePath) || !existsSync(wasmPath)) {
        throw new Error(`No built WASM runtime in ${wasmDirectory}; run npm run build:wasm`);
    }
    const licenses = join(wasmDirectory, 'licenses');
    const noticeFiles = [
        {title: 'CrispBASIC', path: join(root, 'LICENSE')},
        {title: 'BBCSDL interpreter', path: existsSync(join(wasmDirectory, 'BBCSDL-LICENSE.txt')) ?
            join(wasmDirectory, 'BBCSDL-LICENSE.txt') : join(root, 'native', 'BBCSDL-LICENSE.txt')},
        {title: 'Third-party notices', path: join(root, 'THIRD-PARTY-NOTICES.md')},
        ...(existsSync(licenses) ? readdirSync(licenses).sort().map(name =>
            ({title: 'Emscripten toolchain', path: join(licenses, name)})) : [])
    ];
    const notices = `CrispBASIC ${VERSION} standalone web program.\n` +
        'This page contains the BBCSDL interpreter by R. T. Russell (zlib licence), modified for\n' +
        'CrispBASIC and compiled to WebAssembly with Emscripten, and CrispBASIC code (BSD-3-Clause).\n\n' +
        noticeText(noticeFiles);
    const worker = workerSource(readFileSync(modulePath, 'utf8'), readFileSync(wasmPath).toString('base64'));
    const pageTitle = title ?? `${basename(prepared.filename)} — CrispBASIC`;
    const program = {filename: basename(prepared.filename), source: prepared.source};
    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="CrispBASIC ${VERSION} bundle">
<title>${escapeHTML(pageTitle)}</title>
<style>
:root { --bg: #fbfbf8; --fg: #1d1d1b; --muted: #6b6b66; --line: #d9d9d2; --accent: #2457a6; }
@media (prefers-color-scheme: dark) { :root { --bg: #161615; --fg: #e9e9e4; --muted: #9a9a93; --line: #34342f; --accent: #8db4f0; } }
body { margin: 0; background: var(--bg); color: var(--fg); font: 15px/1.5 system-ui, sans-serif; }
main { max-width: 900px; margin: 0 auto; padding: 16px; }
h1 { font-size: 18px; margin: 0 0 8px; }
#status { color: var(--muted); font-size: 13px; }
#output { min-height: 12em; white-space: pre-wrap; word-break: break-all; border: 1px solid var(--line);
  border-radius: 6px; padding: 12px; font: 14px/1.4 ui-monospace, Menlo, Consolas, monospace; overflow-wrap: anywhere; }
form { display: flex; gap: 8px; margin: 8px 0; }
#line { flex: 1; font: inherit; padding: 6px; }
button { font: inherit; padding: 6px 12px; }
details { margin-top: 16px; color: var(--muted); }
details pre { white-space: pre-wrap; font-size: 12px; }
</style>
</head>
<body>
<main>
<h1>${escapeHTML(basename(prepared.filename))}</h1>
<div id="status">Loading…</div>
<pre id="output" aria-live="polite"></pre>
<form id="input-form"><input id="line" autocomplete="off" aria-label="Program input" placeholder="Input for the program" disabled><button id="send" disabled>Send</button><button type="button" id="run">Run again</button></form>
<details><summary>About and licences</summary><pre>${escapeHTML(notices)}</pre></details>
</main>
<script type="text/plain" id="crispbasic-worker">${escapeScript(worker)}</script>
<script type="module">
${escapeScript(sessionSource())}
const {createWasmSession} = __crispModules['wasm-session.mjs'];
const program = ${escapeScript(JSON.stringify(program))};
const workerURL = URL.createObjectURL(new Blob([document.getElementById('crispbasic-worker').textContent],
    {type: 'text/javascript'}));
const output = document.getElementById('output');
const status = document.getElementById('status');
const line = document.getElementById('line');
const send = document.getElementById('send');
let session = null;
const latin1 = bytes => String.fromCharCode(...bytes);
function show(bytes) {
    // A minimal text view of the raw VDU stream; the exact bytes are kept in
    // the result's output. CR returns are folded with the following LF.
    output.textContent += latin1(bytes).replace(/\\r\\n?/g, '\\n');
}
async function run({input, interactive = input === undefined, timeoutMs = 2147483647} = {}) {
    if (session) await session.dispose();
    output.textContent = '';
    status.textContent = 'Running';
    session = createWasmSession({moduleURL: location.href, workerURL, timeoutMs, maxOutputBytes: 16 * 1024 * 1024,
        onEvent(event) {
            if (event.type === 'output') show(event.bytes);
            if (event.type === 'input') { line.disabled = send.disabled = false; line.focus(); }
        }});
    const result = await session.run(program.source, {filename: program.filename,
        input: input ?? '', interactive});
    line.disabled = send.disabled = true;
    status.textContent = result.status === 'completed' ? \`Finished (exit \${result.exitCode})\` :
        \`CrispBASIC: \${result.error?.filename ? result.error.filename + (result.error.line ? ':' + result.error.line : '') + ': ' : ''}\${result.error?.message || result.status}\`;
    return result;
}
document.getElementById('input-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!session) return;
    session.writeInput(line.value + '\\n');
    output.textContent += line.value + '\\n';
    line.value = '';
    line.disabled = send.disabled = true;
});
document.getElementById('run').addEventListener('click', () => { void run(); });
// Test and embedding hook: run with fixed input and return the full result.
window.crispbasicRun = options => run(options);
if (!location.hash.includes('noautorun')) void run();
else status.textContent = 'Ready';
</script>
</body>
</html>
`;
    return {html, notices};
}
