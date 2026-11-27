/**
 * The HOSTED C route for the riscv32 console — the twin of bw-fpga/synthesis.js
 * for compilation instead of synthesis.
 *
 * riscv32 is already programmable from ASSEMBLY in the browser (the local
 * RV32IM assembler, bw-asm/assemble-route.js). C is the other half, and it needs
 * a real cross-compiler: clang/gcc targeting rv32, which is far too heavy to run
 * in the browser. So C is compiled on a HOSTED service — a small endpoint that
 * runs `riscv64-unknown-elf-gcc` (or clang + lld) and returns a loadable image.
 * The reference server that answers this contract lives in `services/riscv-cc/`.
 *
 * WHAT IT NEVER DOES: succeed without a service. An unconfigured endpoint is a
 * named refusal (`no-compile-service`), returned BEFORE anything is uploaded —
 * never a stub, never a faked image. This is exactly how the FPGA synthesis
 * client shipped and refused until `synth.crispstro.be` was deployed; a compile
 * endpoint flips C on the same way, with no code change here.
 *
 * THE CONTRACT (v1), so the service and this client agree before either is
 * written:
 *
 *   POST <endpoint>/compile        GET <endpoint>/health
 *
 *   Request body (JSON):
 *     { "contract": 1,
 *       "source":   "<C source>",
 *       "options":  { "opt": "2", "std": "c11" }   // optional, advisory
 *     }
 *
 *   Response body (JSON), success:
 *     { "contract": 1, "ok": true,
 *       "image": { "entry": <pc>, "segments": [ { "addr": <a>, "bytes": "<base64>" } ] },
 *       "log":  "<compiler stderr, may be empty>" }
 *
 *   Response body (JSON), a compile error is the program's, not the service's:
 *     { "contract": 1, "ok": false, "code": "compile-failed",
 *       "reason": "<message>", "log": "<gcc stderr naming the line>" }
 *
 * `endpoint` is a BASE, not a full URL — the request goes to `<endpoint>/compile`,
 * mirroring the synthesis client so one configured value can feed both a probe
 * and a build. @module
 */

export const CONTRACT_VERSION = 1;

const refusal = (code, reason, extra = {}) => ({ok: false, code, reason, ...extra});

/** `<base>/compile` and `<base>/health`, tolerant of a trailing slash. */
export const compileUrl = base => `${String(base).replace(/\/+$/, '')}/compile`;
export const compileHealthUrl = base => `${String(base).replace(/\/+$/, '')}/health`;

/**
 * A malformed reply is a named refusal, never a partial or faked result. Decodes
 * each segment's base64 to a Uint8Array so the image is exactly the {entry,
 * segments:[{addr,bytes}]} shape debug-runner's attachRiscV32 already boots.
 */
export function validateResponse (body) {
    if (!body || typeof body !== 'object') {
        return refusal('bad-response', 'The compile service did not return an object.');
    }
    // A `contract` field, when present, must match; a service that omits it
    // (e.g. stc-compiler, which shares one base response shape across targets)
    // is accepted on the strength of its `image`.
    if (body.contract !== undefined && body.contract !== CONTRACT_VERSION) {
        return refusal('contract-mismatch',
            `The service speaks contract ${body.contract}, this client speaks `
            + `${CONTRACT_VERSION}. Refusing rather than guessing at the difference.`);
    }
    // `ok:false` (v1 contract) and `success:false` (stc-compiler) both mean the
    // program did not compile; `error` is stc-compiler's word for `reason`.
    if (body.ok === false || body.success === false) {
        return refusal(body.code || 'compile-failed',
            body.reason || body.error || 'The service reported a failure without a reason.',
            {log: body.log ?? null});
    }
    const img = body.image;
    if (!img || typeof img !== 'object' || !Array.isArray(img.segments) || !img.segments.length) {
        return refusal('bad-response',
            'The service reported success but returned no loadable image.');
    }
    let segments;
    try {
        segments = img.segments.map(s => ({
            addr: s.addr >>> 0,
            bytes: s.bytes instanceof Uint8Array ? s.bytes
                : Uint8Array.from(atob(String(s.bytes)), c => c.charCodeAt(0))
        }));
    } catch {
        return refusal('bad-response', 'A segment carried bytes that are not valid base64.');
    }
    return {ok: true, image: {entry: img.entry >>> 0, segments}, log: body.log ?? null};
}

/**
 * Compile C to a loadable rv32 image on the hosted service.
 *
 * @param {object} req
 * @param {string} req.source
 * @param {string|null} [req.endpoint]  BASE url; the request goes to `<endpoint>/compile`.
 * @param {object} [req.options]
 * @param {Function} [req.fetchImpl]    injected for tests
 * @returns {Promise<{ok:true, image:object, log:?string}|{ok:false, code:string, reason:string}>}
 */
export async function compileRiscvC ({source, endpoint = null, target = 'riscv32-gcc',
    options = [], fetchImpl = null} = {}) {
    if (typeof source !== 'string' || !source.trim()) {
        return refusal('no-source', 'There is no C to compile.');
    }
    if (!endpoint) {
        return refusal('no-compile-service',
            'The hosted RISC-V C compiler is unavailable in this build. Select Browser for supported C programs.');
    }
    const doFetch = fetchImpl || (typeof fetch === 'function' ? fetch : null);
    if (!doFetch) return refusal('no-fetch', 'This environment has no fetch implementation.');

    let res;
    try {
        res = await doFetch(compileUrl(endpoint), {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            // The stc-compiler shape: `code` + `language` + `target` (its
            // `options` is a LIST). `source`/`contract` ride along for the
            // reference `services/riscv-cc/` server and are ignored by
            // stc-compiler (extra fields). `target` picks the compiler:
            // 'riscv32-gcc' (full C, native gcc+picolibc) or 'riscv32' (shecc).
            body: JSON.stringify({
                contract: CONTRACT_VERSION, source,
                code: source, language: 'c', target,
                options: Array.isArray(options) ? options : []
            })
        });
    } catch (e) {
        return refusal('service-unreachable',
            `The compile service could not be reached: ${e.message}`);
    }
    if (!res || typeof res.status !== 'number' || res.status < 200 || res.status >= 300) {
        return refusal('service-error', `The compile service answered HTTP ${res && res.status}.`);
    }
    let body;
    try { body = await res.json(); }
    catch { return refusal('bad-response', 'The compile service returned a body that is not JSON.'); }
    return validateResponse(body);
}

export default compileRiscvC;
