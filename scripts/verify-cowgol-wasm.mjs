#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
/**
 * Byte-identity of the offline (WebAssembly) Cowgol compiler against the
 * compiler service.
 *
 *   node scripts/verify-cowgol-wasm.mjs --wasm DIR --gpl DIR --bundle DIR \
 *     --service STC_CHECKOUT --cowgol COWGOL_CHECKOUT --report report.json
 *
 * For every corpus program and native target (z80-cpm, i8080-cpm, dos,
 * eater6502) the SAME request goes to
 *   - the service's own `cowgol_build.build_cowgol` (stc-compiler checkout)
 *     over the native Linux bundle (`--bundle`, e.g. the service CI artifact),
 *   - Brickwright's offline pipeline over the WASM payloads (`--wasm`, `--gpl`),
 * and the two JSON replies must be equal in EVERY field: artifact base64,
 * length, memory layout, log text, refusal stage/line/message. The WASM reply
 * must then pass `compileCowgol`'s own client validation. Any difference fails
 * the run and is written to the report with both values.
 *
 * Corpus: the lane's HTTP/CLI witness program (whose DOS MZ is the 2,074-byte
 * artifact with SHA-256 3a1c8283…), its Eater ROM program, all 46 Cowgol
 * tests/*.test.cow (framework inlined), the examples, and deliberate failures.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import {createCowgolWasmToolchain} from '../overlay/scratch-gui/src/lib/cowgol-wasm/runtime.js';
import {pinsFromManifest, verifyPayload} from './package-cowgol-wasm.mjs';
import {compileCowgol} from '../overlay/scratch-gui/src/lib/bw-lang/cowgol-compile.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const {values} = parseArgs({options: {
    wasm: {type: 'string'}, gpl: {type: 'string'}, bundle: {type: 'string'}, service: {type: 'string'},
    cowgol: {type: 'string'}, report: {type: 'string'}, python: {type: 'string'}, targets: {type: 'string'}
}});
for (const key of ['wasm', 'bundle', 'service', 'cowgol', 'report']) assert.ok(values[key], `--${key} is required`);
const python = values.python || process.env.PYTHON || 'python3';
const TARGETS = (values.targets || 'z80-cpm,i8080-cpm,dos,eater6502').split(',');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

// The witness programs, verbatim from scripts/verify-cowgol-platforms.mjs.
const fullSource = `include "cowgol.coh";
include "brickwright.coh";
include "strings.coh";
include "malloc.coh";
var values: int32[3];
values[0] := 20;
values[1] := 22;
values[2] := values[0] + values[1];
var quotient: uint32;
var remainder: uint32;
var dividend: uint32 := 85;
var divisor: uint32 := 2;
quotient := dividend / divisor;
remainder := dividend % divisor;
var memory := Alloc(8);
[memory] := 17;
bw_print_text("HTTP Cowgol");
bw_print_number(values[2]);
bw_print_number(quotient as int32);
bw_print_number(remainder as int32);
bw_print_number([memory] as int32);
Free(memory);
bw_print_number(-2147483647 as int32 - 1);
bw_print_number(2147483647 as int32);
`;
const romSource = `include "cowgol.coh";
include "brickwright.coh";
bw_print_text("HTTP Cowgol 6502");
bw_print_number(42 as int32);
bw_print_number(-2147483647 as int32 - 1);
bw_print_number(2147483647 as int32);
`;
// Recorded by the lane's native qualification (brickwright run 46164623688,
// artifact cowgol-native-surfaces): the service's artifacts for fullSource.
const WITNESSES = {
    'witness-full:dos': {bytes: 2074, sha256: '3a1c8283ecfd892d78c87ba6673621ca4d1fe0bff54c31aff7349ea95ac4f17b'},
    'witness-full:z80-cpm': {bytes: 1509},
    'witness-full:i8080-cpm': {bytes: 1673}
};

const corpus = [['witness-full', fullSource], ['witness-rom', romSource],
    ['hello', 'include "cowgol.coh";\nprint("Hello from Cowgol!\\n");\n'],
    ['syntax-error', 'include "cowgol.coh";\nvar x: uint8 := ;\n'],
    ['undefined-name', 'include "cowgol.coh";\nnope := 1;\n'],
    ['inline-asm', 'include "cowgol.coh";\n@asm "nop";\n'],
    ['untrusted-include', 'include "../secret.coh";\n'],
    ['file-header', 'include "cowgol.coh";\ninclude "file.coh";\n'],
    ['too-big-static', 'include "cowgol.coh";\nvar big: uint8[60000];\nbig[0] := 1;\n']];
const framework = readFileSync(path.join(values.cowgol, 'tests/_framework.coh'), 'utf8');
for (const name of readdirSync(path.join(values.cowgol, 'tests')).filter(f => f.endsWith('.test.cow')).sort()) {
    const text = readFileSync(path.join(values.cowgol, 'tests', name), 'utf8')
        .replace('include "tests/_framework.coh";', framework);
    corpus.push([`test-${name.replace(/\.test\.cow$/, '')}`, text]);
}
for (const name of readdirSync(path.join(values.cowgol, 'examples')).filter(f => f.endsWith('.cow')).sort()) {
    corpus.push([`example-${name.replace(/\.cow$/, '')}`, readFileSync(path.join(values.cowgol, 'examples', name), 'utf8')]);
}
const requests = [];
for (const [name, code] of corpus) {
    for (const target of TARGETS) requests.push({id: `${name}:${target}`, code, target, format: 'bin'});
}

// 1. The service, unchanged, over the native bundle.
const work = mkdtempSync(path.join(tmpdir(), 'bw-cowgol-wasm-'));
let service;
try {
    writeFileSync(path.join(work, 'requests.json'), JSON.stringify(requests));
    execFileSync(python, [path.join(ROOT, 'scripts/lib/cowgol-service-reference.py'), values.service, values.bundle,
        path.join(work, 'requests.json'), path.join(work, 'service.json')], {stdio: 'inherit', timeout: 1_800_000});
    service = JSON.parse(readFileSync(path.join(work, 'service.json'), 'utf8'));
} finally { rmSync(work, {recursive: true, force: true}); }

// 2. The offline pipeline over the verified WASM payloads.
const bundledManifest = JSON.parse(readFileSync(path.join(values.wasm, 'manifest.json'), 'utf8'));
await verifyPayload(values.wasm, bundledManifest);
let gplManifest = null;
if (values.gpl) {
    gplManifest = JSON.parse(readFileSync(path.join(values.gpl, 'manifest.json'), 'utf8'));
    await verifyPayload(values.gpl, gplManifest);
}
const pins = {bundled: pinsFromManifest(bundledManifest, 'bundled'),
    gpl: gplManifest ? pinsFromManifest(gplManifest, 'gpl-origin') : null};
const dir = d => pathToFileURL(path.resolve(d) + '/').href;
const toolchain = createCowgolWasmToolchain({bundledBase: dir(values.wasm),
    gplBase: values.gpl ? dir(values.gpl) : null, pins});

const results = [];
const summary = {};
const started = Date.now();
for (const request of requests) {
    const expected = service.results[request.id];
    const t0 = performance.now();
    let actual;
    try { actual = await toolchain.compile(request); } catch (error) { actual = {thrown: String(error?.stack || error)}; }
    const ms = Math.round(performance.now() - t0);
    const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort();
    const differences = keys.filter(key => JSON.stringify(expected[key]) !== JSON.stringify(actual[key]))
        .map(key => ({field: key, service: expected[key], wasm: actual[key]}));
    let client = null;
    if (actual.success) {
        // The offline reply must satisfy the editor's own validation unchanged.
        const local = {supports: () => true, compile: async () => actual};
        try {
            const validated = await compileCowgol(request.code, request.target, {local, fetcher: () => assert.fail('network touched')});
            client = {ok: true, route: validated.route};
        } catch (error) { client = {ok: false, error: error.message}; }
    }
    const bytes = actual.success ? Buffer.from(actual.base64, 'base64') : null;
    const witness = WITNESSES[request.id];
    const witnessOk = !witness || (bytes && bytes.length === witness.bytes && (!witness.sha256 || sha256(bytes) === witness.sha256));
    const row = {id: request.id, target: request.target, success: Boolean(expected.success), identical: differences.length === 0,
        stage: expected.stage ?? null, bytes: bytes?.length ?? null, sha256: bytes ? sha256(bytes) : null, ms,
        client, witness: witness ? {expected: witness, ok: witnessOk} : undefined,
        differences: differences.length ? differences : undefined};
    results.push(row);
    const s = summary[request.target] ||= {requests: 0, compiled: 0, refused: 0, identical: 0, different: 0, clientRejected: 0};
    s.requests++;
    if (expected.success) s.compiled++; else s.refused++;
    if (row.identical) s.identical++; else s.different++;
    if (client && !client.ok) s.clientRejected++;
    console.log(`${row.identical ? 'same' : 'DIFF'} ${request.id} ${expected.success ? `${row.bytes} B` : `refused (${expected.stage})`} ${ms} ms` +
        (row.identical ? '' : ` fields: ${differences.map(d => d.field).join(',')}`));
}
const payloadBytes = manifest => Object.values(manifest.files).reduce((sum, f) => sum + f.bytes, 0);
const report = {schemaVersion: 1, generatedBy: 'scripts/verify-cowgol-wasm.mjs',
    serviceCommit: bundledManifest.serviceCommit, cowgolCommit: bundledManifest.cowgolCommit,
    nativeBundle: service.bundle_status, compiler: bundledManifest.compiler,
    payloads: {bundled: payloadBytes(bundledManifest), gpl: gplManifest ? payloadBytes(gplManifest) : null},
    elapsedMs: Date.now() - started, summary, results};
writeFileSync(values.report, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
const failures = results.filter(r => !r.identical || (r.client && !r.client.ok) || (r.witness && !r.witness.ok));
const compiled = results.filter(r => r.success).length;
assert.ok(compiled >= TARGETS.length * 20, `the corpus must compile substantially (${compiled} artifacts)`);
if (failures.length) {
    console.error(`${failures.length} request(s) differ or fail validation: ${failures.map(r => r.id).join(', ')}`);
    process.exit(1);
}
console.log(`All ${results.length} requests identical (${compiled} artifacts). Report: ${values.report}`);
if (!existsSync(values.report)) process.exit(1);
