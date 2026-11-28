// Compile-on-DOS: run a real DOS toolchain (a compiler .EXE/.COM) in the
// browser and read back the program it produced — the enabling primitive behind
// "Pascal via ACK" / "GW-BASIC" in the code tab.
//
// It rests entirely on capabilities the pinned bw-board already has: the DOS
// service bench loads MZ .EXE and .COM (i8086-dos.js `loadExe`/`loadCom` — the
// heap is even sized for LINK/MASM), and its INT 21h implements real file I/O
// (create/open/read/write) against a `Map<name, Uint8Array>` disk. So a compiler
// opens SOURCE.PAS, writes OUTPUT.COM, and we hand it the source through the Map
// and read the output back out. No pin bump, no booted DOS.
//
// The per-toolchain command sequence (what to type, what the compiler names its
// output) is the toolchain's own contract, supplied by the caller — this module
// is the mechanism, not a toolchain database.

import {createI8086DosBench} from './i8086-dos-bench.js';

const asKeyBytes = k => (typeof k === 'string'
    ? [...k].map(c => c.charCodeAt(0))
    : Array.isArray(k) ? k : []);

const asFileBytes = d => (d instanceof Uint8Array ? d
    : typeof d === 'string' ? new TextEncoder().encode(d)
        : new Uint8Array(d || 0));

/**
 * Run one DOS program to completion with a mounted disk, and return the disk
 * afterwards (so a caller reads back files the program wrote) plus its output.
 *
 * @param {object} opts
 * @param {Uint8Array} opts.bytes the program image
 * @param {'com'|'exe'} [opts.format='com']
 * @param {Map<string,Uint8Array>} [opts.files] the disk (mounted inputs; read back after)
 * @param {string|number[]} [opts.keys] keystrokes fed to the program (stdin/INT 16h)
 * @param {string} [opts.variant] cpu variant ('8086' default; '80186' for SmallerC-style)
 * @param {number} [opts.maxSteps=20000000] a bound so a runaway compile cannot hang the tab
 * @returns {Promise<{files: Map, screen: string, screenText: string[], exitCode: number,
 *                    terminated: boolean, exhausted: boolean, steps: number}>}
 */
export async function runDosProgram(opts = {}) {
    if (!(opts.bytes instanceof Uint8Array) || !opts.bytes.length) {
        throw new Error('runDosProgram: no program bytes');
    }
    opts.signal?.throwIfAborted();
    const files = opts.files instanceof Map ? opts.files : new Map();
    const chars = [];
    const bench = await createI8086DosBench({
        bytes: opts.bytes,
        format: opts.format || 'com',
        files,
        keys: asKeyBytes(opts.keys),
        variant: opts.variant,
        args: opts.args,
        executionSignal: opts.signal,
        onChar: ch => chars.push(ch),
        // Observe every 8086 OUT/IN. A DOS Forth `pin!` does an OUT to 0x378+pin
        // (dosmain.c), so this is how a Code-tab program drives a device.
        onPortAccess: typeof opts.onPortAccess === 'function' ? opts.onPortAccess : undefined
    });
    const max = opts.maxSteps || 20_000_000;
    let steps = 0;
    const batch = opts.yieldEvery || max;
    while (!bench.terminated && steps < max) {
        opts.signal?.throwIfAborted();
        const end = Math.min(steps + batch, max);
        while (!bench.terminated && steps < end) {
            bench.step();
            steps += 1;
        }
        if (!bench.terminated && steps < max) await new Promise(resolve => setTimeout(resolve, 0));
    }
    let screenText = [];
    try { screenText = bench.screenText(); } catch { /* renderer optional */ }
    return {
        files,
        screen: chars.join(''),
        screenText,
        exitCode: bench.exitCode,
        terminated: bench.terminated,
        exhausted: !bench.terminated && steps >= max,
        steps
    };
}

/**
 * Two stages: run a compiler with the sources mounted, then (optionally) run the
 * program it produced — the shape a code-tab "Pascal via ACK" / "GW-BASIC" route
 * uses. The SAME disk Map flows through both stages, so the compiler's output is
 * exactly what stage two loads.
 *
 * @param {object} opts
 * @param {Uint8Array} opts.compiler the compiler image (as fetched from the toolchain)
 * @param {'com'|'exe'} [opts.compilerFormat='exe']
 * @param {Record<string, Uint8Array|string>} [opts.sources] files to mount (name → bytes/text)
 * @param {Record<string, Uint8Array>} [opts.support] extra toolchain files to mount (libs, etc.)
 * @param {string|number[]} [opts.compileKeys] what to type at the compiler
 * @param {string} opts.outputName the file the compiler is expected to write (e.g. 'OUTPUT.COM')
 * @param {boolean} [opts.run=false] also run the produced program
 * @param {string|number[]} [opts.runKeys] what to type at the produced program
 * @param {string} [opts.variant]
 * @param {number} [opts.maxSteps]
 * @returns {Promise<object>} `{stage, compile, output, ...runResult?}` — `output` is the
 *   produced bytes (or null if the compiler wrote none), `stage` is 'compile' or 'run'.
 */
export async function compileAndRunOnDos(opts = {}) {
    if (!(opts.compiler instanceof Uint8Array)) throw new Error('compileAndRunOnDos: no compiler bytes');
    const files = opts.files instanceof Map ? opts.files : new Map();
    for (const [name, data] of Object.entries(opts.sources || {})) files.set(name, asFileBytes(data));
    for (const [name, data] of Object.entries(opts.support || {})) files.set(name, asFileBytes(data));

    const compile = await runDosProgram({
        bytes: opts.compiler, format: opts.compilerFormat || 'exe', files,
        keys: opts.compileKeys, variant: opts.variant, maxSteps: opts.maxSteps,
        onPortAccess: opts.onPortAccess
    });

    const output = opts.outputName ? (files.get(opts.outputName) || null) : null;
    if (!output || !opts.run) return {stage: 'compile', compile, files, output};

    const run = await runDosProgram({
        bytes: output, format: /\.exe$/i.test(opts.outputName) ? 'exe' : 'com', files,
        keys: opts.runKeys, variant: opts.variant, maxSteps: opts.maxSteps,
        onPortAccess: opts.onPortAccess
    });
    return {stage: 'run', compile, run, files, output};
}
