#!/usr/bin/env node
// Build the restricted host with the real pinned BBCSDL WASM32 ABI. No SDL,
// native console, assembler, filesystem or dynamic-linker host is linked.
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {patchWasmUpstream} from '../wasm/patch-upstream.mjs';
import {WASM_LOCAL_INPUTS, WASM_UPSTREAM_INPUTS} from '../wasm/build-inputs.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = join(root, '.build');
const work = join(build, 'wasm');
const checkout = process.env.CRISP_BASIC_UPSTREAM ? resolve(process.env.CRISP_BASIC_UPSTREAM) : join(build, 'BBCSDL');
const lock = JSON.parse(readFileSync(join(root, 'upstream.lock.json'), 'utf8')).bbcSDL;
const toolchain = JSON.parse(readFileSync(join(root, 'wasm/toolchain.lock.json'), 'utf8')).emscripten;
const emcc = (process.env.EMCC || 'emcc').includes('/') ? resolve(process.env.EMCC) : (process.env.EMCC || 'emcc');
const selected = new Set(WASM_UPSTREAM_INPUTS);
const localSourceInputs = WASM_LOCAL_INPUTS.map(path => ({path,
    sha256: createHash('sha256').update(readFileSync(join(root, path))).digest('hex')}));

for (const folder of [work, join(work, 'src'), join(work, 'include'), join(build, 'tmp')]) {
    mkdirSync(folder, {recursive: true});
}
const env = {...process.env, TMPDIR: join(build, 'tmp')};
const run = (command, args, options = {}) => execFileSync(command, args, {
    cwd: work, env, stdio: 'inherit', ...options
});
let compiler;
try { compiler = run(emcc, ['--version'], {stdio: 'pipe'}).toString().split('\n')[0]; }
catch { throw new Error('Install Emscripten 3.1.64 (the validated version), or set EMCC to emcc.'); }
if (!compiler.includes(' ' + toolchain.version + ' ')) {
    throw new Error(`This WASM build is qualified with Emscripten ${toolchain.version}; found ${compiler}. Update the toolchain lock and notices when qualifying a new SDK.`);
}
for (const notice of toolchain.notices) {
    const bytes = readFileSync(join(root, notice.path));
    if (createHash('sha256').update(bytes).digest('hex') !== notice.sha256) {
        throw new Error('Toolchain notice SHA-256 mismatch: ' + notice.path);
    }
}

if (!existsSync(join(checkout, '.git'))) {
    if (process.env.CRISP_BASIC_UPSTREAM) throw new Error('CRISP_BASIC_UPSTREAM must name a BBCSDL git checkout.');
    run('git', ['clone', '--filter=blob:none', '--no-checkout', lock.repository, checkout]);
}
const git = args => execFileSync('git', ['-C', checkout, ...args], {env, maxBuffer: 8 << 20});
try { git(['cat-file', '-e', lock.commit + '^{commit}']); }
catch { run('git', ['-C', checkout, 'fetch', 'origin', lock.commit]); }
if (git(['rev-parse', lock.commit + '^{commit}']).toString().trim() !== lock.commit) {
    throw new Error('BBCSDL commit verification failed.');
}
const verified = [];
for (const file of lock.files) {
    if (!selected.has(file.path)) continue;
    const bytes = git(['show', lock.commit + ':' + file.path]);
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (digest !== file.sha256) throw new Error('BBCSDL SHA-256 mismatch: ' + file.path);
    const destination = join(work, file.path === 'bin/wasm/BBC.h' ? 'include/BBC.h' : file.path);
    mkdirSync(dirname(destination), {recursive: true});
    writeFileSync(destination, patchWasmUpstream(file.path, bytes.toString('utf8')));
    verified.push(file);
    selected.delete(file.path);
}
if (selected.size) throw new Error('WASM source inputs missing from lock: ' + [...selected].join(', '));

const objects = [];
const includes = ['-I', join(work, 'include'), '-I', join(root, 'wasm')];
for (const name of ['bbmain', 'bbexec', 'bbeval', 'bbdata_wasm32']) {
    const object = join(work, name + '.o');
    // Keep default math semantics: WASM uses binary64 while native x86-64 uses
    // extended precision. Differential fixtures use explicit expected anchors.
    run(emcc, ['-O2', '-Wall', ...includes, '-c', join(work, 'src', name + '.c'), '-o', object]);
    objects.push(object);
}
for (const name of ['crispbasic', 'emscripten-host']) {
    const object = join(work, name + '.o');
    run(emcc, ['-O2', '-Wall', '-Wextra', ...includes, '-c', join(root, 'wasm', name + '.c'), '-o', object]);
    objects.push(object);
}
const output = join(work, 'crispbasic.mjs');
const settings = [
    '-O2', '--no-entry',
    '-sMODULARIZE=1', '-sEXPORT_ES6=1', '-sENVIRONMENT=web,worker,node',
    '-sASYNCIFY=1', '-sASYNCIFY_STACK_SIZE=1048576',
    '-sSTACK_SIZE=2097152', '-sINITIAL_MEMORY=67108864', '-sALLOW_MEMORY_GROWTH=0',
    '-sFILESYSTEM=0', '-sDYNAMIC_EXECUTION=0', '-sALLOW_TABLE_GROWTH=0',
    '-sASSERTIONS=1', '-sSTACK_OVERFLOW_CHECK=2', '-sABORTING_MALLOC=0',
    '-sEXPORTED_FUNCTIONS=["_crisp_run","_crisp_simulation_abi","_malloc","_free"]',
    '-sEXPORTED_RUNTIME_METHODS=["ccall"]'
];
run(emcc, [...objects, ...settings, '-o', output]);

// Reviewable import manifest: adding host powers must be an explicit change.
const binary = readFileSync(join(work, 'crispbasic.wasm'));
const module = await WebAssembly.compile(binary);
const imports = WebAssembly.Module.imports(module);
const allowed = new Set([
    'crisp_host_output', 'crisp_host_input_event', '__asyncjs__crisp_host_read_byte',
    '__asyncjs__crisp_host_sleep_ms', '__asyncjs__crisp_host_simulation_request',
    'crisp_host_now_ms', 'crisp_host_error', 'crisp_host_exit',
    '_emscripten_throw_longjmp', '_emscripten_memcpy_js', 'emscripten_resize_heap',
    '__handle_stack_overflow',
    'invoke_v', 'invoke_vi', 'invoke_vii', 'invoke_viii', 'invoke_viiii',
    'invoke_i', 'invoke_ii', 'invoke_iii', 'invoke_iiii', 'invoke_iiiiiii',
    'invoke_j', 'invoke_ji'
]);
const unexpected = imports.filter(entry => entry.kind !== 'function' ||
    entry.module !== 'env' || !allowed.has(entry.name));
if (unexpected.length) throw new Error('Unexpected WASM host import(s): ' + JSON.stringify(unexpected));
writeFileSync(join(work, 'BBCSDL-LICENSE.txt'), readFileSync(join(work, 'licence.txt')));
mkdirSync(join(work, 'licenses'), {recursive: true});
for (const notice of toolchain.notices) {
    writeFileSync(join(work, 'licenses', notice.path.split('/').at(-1)), readFileSync(join(root, notice.path)));
}
for (const input of localSourceInputs) {
    if (createHash('sha256').update(readFileSync(join(root, input.path))).digest('hex') !== input.sha256) {
        throw new Error('Local WASM build input changed during compilation: ' + input.path);
    }
}
writeFileSync(join(work, 'build.json'), JSON.stringify({
    schemaVersion: 1, backend: 'bbcsdl-wasm', upstreamCommit: lock.commit,
    compiler, settings, sourceInputs: verified, toolchain, imports,
    localSourceInputs,
    moduleSha256: createHash('sha256').update(readFileSync(output)).digest('hex'),
    wasmSha256: createHash('sha256').update(binary).digest('hex')
}, null, 2) + '\n');
console.log('Built ' + output + ' and crispbasic.wasm');
