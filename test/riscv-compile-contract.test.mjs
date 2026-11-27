// The hosted RISC-V C-compile client (lib/bw-debug/riscv-compile.js). It ships
// and REFUSES until a compiler endpoint is deployed — the exact shape the FPGA
// synthesis client had before synth.crispstro.be existed. These pin the v1
// contract so the client and the reference server (services/riscv-cc/) agree.

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileRiscvC, validateResponse, compileUrl, compileHealthUrl, CONTRACT_VERSION}
    from '../overlay/scratch-gui/src/lib/bw-debug/riscv-compile.js';

const HELLO = 'int main(){ return 0; }\n';
const okBody = () => ({contract: 1, ok: true, image: {entry: 0x1000, segments: [{addr: 0x1000, bytes: 'AAAA'}]}, log: ''});

test('with no endpoint it REFUSES — it does not fake a compile', async () => {
    const r = await compileRiscvC({source: HELLO});
    assert.equal(r.ok, false);
    assert.equal(r.code, 'no-compile-service');
    assert.match(r.reason, /select browser for supported C programs/i);
});

test('empty source is a source refusal before anything is sent', async () => {
    let called = false;
    const r = await compileRiscvC({source: '   ', endpoint: 'https://x/api', fetchImpl: () => { called = true; }});
    assert.equal(r.ok, false);
    assert.equal(r.code, 'no-source');
    assert.equal(called, false, 'nothing is uploaded for an empty program');
});

test('the POST goes to <base>/compile, not to the base', async () => {
    let url = null;
    const fetchImpl = async (u, opts) => { url = u; return {status: 200, json: async () => okBody()}; };
    await compileRiscvC({source: HELLO, endpoint: 'https://cc.example/api/', fetchImpl});
    assert.equal(url, 'https://cc.example/api/compile');
    assert.equal(compileUrl('https://cc.example/api/'), 'https://cc.example/api/compile');
    assert.equal(compileHealthUrl('https://cc.example/api'), 'https://cc.example/api/health');
});

test('the request carries the contract version and the source', async () => {
    let sent = null;
    const fetchImpl = async (u, opts) => { sent = JSON.parse(opts.body); return {status: 200, json: async () => okBody()}; };
    await compileRiscvC({source: HELLO, endpoint: 'https://x/api', fetchImpl});
    assert.equal(sent.contract, CONTRACT_VERSION);
    assert.equal(sent.source, HELLO);
});

test('the request ALSO carries the stc-compiler shape (code/language/target, list options)', async () => {
    let sent = null;
    const fetchImpl = async (u, opts) => { sent = JSON.parse(opts.body); return {status: 200, json: async () => okBody()}; };
    await compileRiscvC({source: HELLO, endpoint: 'https://x/api', fetchImpl});
    assert.equal(sent.code, HELLO, 'stc-compiler needs `code`');
    assert.equal(sent.language, 'c');
    assert.equal(sent.target, 'riscv32-gcc', 'defaults to the full-C native target');
    assert.ok(Array.isArray(sent.options), 'stc-compiler options is a LIST, not a dict');
});

test('the target selects the compiler (riscv32 = shecc, riscv32-gcc = full C)', async () => {
    let sent = null;
    const fetchImpl = async (u, opts) => { sent = JSON.parse(opts.body); return {status: 200, json: async () => okBody()}; };
    await compileRiscvC({source: HELLO, endpoint: 'https://x/api', target: 'riscv32', fetchImpl});
    assert.equal(sent.target, 'riscv32', 'the chosen target is forwarded verbatim');
});

test('a well-formed reply is accepted and its base64 segments decode to bytes', async () => {
    const fetchImpl = async () => ({status: 200, json: async () => okBody()});
    const r = await compileRiscvC({source: HELLO, endpoint: 'https://x/api', fetchImpl});
    assert.equal(r.ok, true);
    assert.equal(r.image.entry, 0x1000);
    assert.equal(r.image.segments[0].addr, 0x1000);
    assert.ok(r.image.segments[0].bytes instanceof Uint8Array);
    assert.deepEqual([...r.image.segments[0].bytes], [0, 0, 0]); // atob('AAAA') = 3 NUL bytes
});

test('a contract mismatch refuses rather than guessing', () => {
    const r = validateResponse({contract: 2, ok: true, image: {entry: 0, segments: [{addr: 0, bytes: 'AA=='}]}});
    assert.equal(r.ok, false);
    assert.equal(r.code, 'contract-mismatch');
});

test('a compile error is reported as the program\'s, with its log', () => {
    const r = validateResponse({contract: 1, ok: false, code: 'compile-failed', reason: 'x.c:3: expected \';\'', log: 'gcc: ...'});
    assert.equal(r.ok, false);
    assert.equal(r.code, 'compile-failed');
    assert.match(r.reason, /expected/);
    assert.equal(r.log, 'gcc: ...');
});

test('success without a loadable image is a refusal, not a partial result', () => {
    assert.equal(validateResponse({contract: 1, ok: true}).code, 'bad-response');
    assert.equal(validateResponse({contract: 1, ok: true, image: {entry: 0, segments: []}}).code, 'bad-response');
});

test('an unreachable service and an HTTP error are named, not swallowed', async () => {
    const boom = await compileRiscvC({source: HELLO, endpoint: 'https://x/api', fetchImpl: () => { throw new Error('ECONNREFUSED'); }});
    assert.equal(boom.code, 'service-unreachable');
    const http = await compileRiscvC({source: HELLO, endpoint: 'https://x/api', fetchImpl: async () => ({status: 503, json: async () => ({})})});
    assert.equal(http.code, 'service-error');
});

// ── the route wrapper in assemble-route.js (what the Code tab calls) ──
import {requestRiscvCBuild} from '../overlay/scratch-gui/src/lib/bw-asm/assemble-route.js';

test('requestRiscvCBuild compiles IN THE BROWSER by default — no endpoint, no server', async () => {
    // The primary road: bw-board's riscv-cc-wasm (shecc→wasm). No fetch, no
    // endpoint. Returns the shared riscv image shape debug-runner boots.
    const out = await requestRiscvCBuild({source: 'int main(){ printf("%d\\n", 6*7); return 0; }'});
    assert.equal(out.route, 'local-wasm', 'compiled in-browser, not on a service');
    assert.equal(out.format, 'riscv');
    assert.equal(out.target, 'riscv32');
    assert.equal(out.slotId, 'riscv');
    assert.equal(typeof out.entry, 'number');
    assert.ok(out.image.segments.length >= 1);
    assert.ok(out.image.segments[0].bytes instanceof Uint8Array);
});

test('an in-browser compile error is the PROGRAM\'s (source reason), not a service error', async () => {
    await assert.rejects(
        () => requestRiscvCBuild({source: 'int main(){ this is not C ; }'}),
        e => { assert.equal(e.route, 'local-wasm'); assert.equal(e.reason, 'source'); return true; });
});

test('the HOSTED fallback (preferHosted) still returns the shared riscv image shape', async () => {
    const fetchImpl = async () => ({status: 200, json: async () => ({contract: 1, ok: true,
        image: {entry: 0x1000, segments: [{addr: 0x1000, bytes: 'AAAA'}]}, log: ''})});
    const out = await requestRiscvCBuild({source: 'int main(){return 0;}',
        endpoint: 'https://cc/api', fetchImpl, preferHosted: true});
    assert.equal(out.route, 'hosted');
    assert.equal(out.format, 'riscv');
    assert.equal(out.entry, 0x1000);
    assert.ok(out.image.segments[0].bytes instanceof Uint8Array);
    assert.equal(out.slotId, 'riscv');
});

test('the hosted fallback tolerates the stc-compiler {success, image} shape', async () => {
    // stc-compiler shares one base response shape across targets: success/image,
    // no top-level {contract, ok}. riscv-compile.js accepts it.
    const fetchImpl = async () => ({status: 200, json: async () => ({success: true,
        image: {entry: 0x1000, segments: [{addr: 0x1000, bytes: 'AAAA'}]}, log: ''})});
    const out = await requestRiscvCBuild({source: 'int main(){return 0;}',
        endpoint: 'https://stc/api', fetchImpl, preferHosted: true});
    assert.equal(out.route, 'hosted');
    assert.equal(out.entry, 0x1000);
});

test('a hosted compile error becomes a SOURCE-reason route error', async () => {
    const fetchImpl = async () => ({status: 200, json: async () => ({contract: 1, ok: false, code: 'compile-failed', reason: 'x.c:1: bad', log: 'gcc'})});
    await assert.rejects(
        () => requestRiscvCBuild({source: 'oops', endpoint: 'https://cc/api', fetchImpl, preferHosted: true}),
        e => { assert.equal(e.reason, 'source'); return true; });
});
