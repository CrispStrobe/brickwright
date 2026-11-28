import {remoteToolchainsAllowed} from '../distribution-policy.js';

export const COWGOL_COMPILE_ENDPOINT = 'https://stc-compiler.vercel.app/compile';
export const COWGOL_COMPILE_TARGETS = Object.freeze({
    'z80-cpm': {format: 'bin', toolchain: 'cowgol-cpmz', filename: 'program.com', maxBytes: 0xcf00},
    'i8080-cpm': {format: 'bin', toolchain: 'cowgol-cpm', filename: 'program.com', maxBytes: 0xcf00},
    dos: {format: 'bin', toolchain: 'cowgol-msdos', filename: 'program.exe', maxBytes: 1024 * 1024},
    'cowgol-cgen': {format: 'c', toolchain: 'cowgol-cgen', filename: 'program.c', maxBytes: 8 * 1024 * 1024}
});

/** Full Cowgol compilation, independent of the deliberately smaller Blocks reader. */
export async function compileCowgol (code, target, {fetcher = globalThis.fetch, signal,
    endpoint = COWGOL_COMPILE_ENDPOINT} = {}) {
    if (!remoteToolchainsAllowed()) throw new Error('Hosted Cowgol compilation is unavailable in this build.');
    const spec = COWGOL_COMPILE_TARGETS[target];
    if (!spec) throw new Error(`Unsupported Cowgol compiler target: ${target}`);
    if (typeof code !== 'string' || !code.trim()) throw new Error('Write a Cowgol program first.');
    if (new TextEncoder().encode(code).byteLength > 256 * 1024) throw new Error('Cowgol source exceeds 256 KiB.');
    const response = await fetcher(endpoint, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, signal,
        body: JSON.stringify({language: 'cowgol', code, target, format: spec.format})
    });
    let out;
    try { out = await response.json(); } catch (error) {
        throw new Error(`Cowgol compiler returned an invalid response (HTTP ${response.status}).`);
    }
    if (!response.ok || !out?.success) {
        const error = new Error(out?.error || `Cowgol compiler HTTP ${response.status}`);
        error.log = out?.log || '';
        throw error;
    }
    // The native route must never accept the ordinary C compiler's reply or
    // mistake a generated-C file for a runnable CP/M program.
    if (out.toolchain !== spec.toolchain || out.target !== target || out.language !== 'cowgol' ||
        typeof out.base64 !== 'string' ||
        out.base64.length > Math.ceil(spec.maxBytes / 3) * 4 ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(out.base64)) {
        throw new Error('Cowgol compiler returned an invalid artifact.');
    }
    const bytes = Uint8Array.from(atob(out.base64), char => char.charCodeAt(0));
    if (!bytes.length || bytes.length > spec.maxBytes || bytes.length !== out.bytes ||
        (target.endsWith('-cpm') && out.origin !== 0x100) ||
        (target === 'dos' && (bytes[0] !== 0x4d || bytes[1] !== 0x5a))) {
        throw new Error('Cowgol compiler returned an invalid artifact size or load address.');
    }
    return {...out, bytes, target, filename: spec.filename};
}

/** A CP/M transient program uses the existing Z80 service machine loader. */
export const cowgolCpmConfig = () => ({
    id: 'cowgol-cpm', title: 'Cowgol — CP/M Z80', machine: 'z80',
    executionMode: 'functional', cpu: {variant: 'z80'},
    slots: {}, bootOrder: ['com'], widgets: [],
    provenance: {language: 'cowgol', compilerTarget: 'z80-cpm'}
});

export const cowgolDosConfig = () => ({
    id: 'cowgol-dos', title: 'Cowgol — DOS 8086', machine: 'i8086',
    executionMode: 'functional', cpu: {variant: '8086'},
    slots: {exe: {url: 'local-media:cowgol.exe'}}, bootOrder: ['exe'], widgets: [],
    provenance: {language: 'cowgol', compilerTarget: 'dos'}
});
