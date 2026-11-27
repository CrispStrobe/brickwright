// Code-tab DOS toolchain routes: Pascal via ACK, GW-BASIC — built on the
// compile-on-DOS mechanism (dos-compile.js). The MECHANISM is proven (a real
// compiler .EXE runs on the browser DOS bench and its output is read back);
// what remains per toolchain is its exact command sequence and output name,
// which depend on the real fetched binaries. Those carry `verified: false` and
// are NOT yet offered as code-tab language buttons — a route that might type the
// wrong command is worse than an honest "coming once verified". Confirm each
// against its media-lab bundle on a real run, set `verified: true`, then wire
// the language button.

import {ubasicSource} from '../bw-machines/ubasic-source.js';
import {compileAndRunOnDos, runDosProgram} from './dos-compile.js';
import {runCpmProgram} from './cpm-compile.js';

// DOS-NATIVE toolchains only: the compiler/interpreter is ITSELF a 16-bit DOS
// program, so it runs on the DOS bench (dos-compile.js). GW-BASIC qualifies —
// GWBASIC.EXE is a real DOS .EXE (so do MASM/LINK). A HOST cross-compiler does
// NOT belong here (see HOSTED_TOOLCHAINS + the ACK note below).
/** @type {Record<string, object>} */
export const DOS_TOOLCHAINS = Object.freeze({
    // uBASIC (Adam Dunkels; Danyil Bohdan fork), BSD-3-Clause — a real 16-bit
    // MS-DOS interpreter cross-compiled with ia16-elf-gcc (media-lab project
    // `ubasic-dos`, ships as static/roms/ubasic.exe). It is an INTERPRETER, not
    // a compiler: it reads its program from PROG.BAS (INT 21h) and PRINTS the
    // result during its own run — so there is no output FILE (`outputName:
    // null`, `run: false`), and the caller reads the screen from the compile
    // stage. Needs the 80186 variant (ia16 emits LEAVE/PUSH imm/IMUL). VERIFIED:
    // test/dos-compile.test.mjs runs it on the real bench and reads back `42`.
    'ubasic': {
        id: 'ubasic', label: 'BASIC (uBASIC on DOS)', language: 'basic', kind: 'dos-native',
        source: 'ubasic-dos',                  // media-lab project; BSD-3-Clause interpreter
        compiler: 'ubasic.exe', compilerFormat: 'exe',
        variant: '80186',                      // ia16-elf-gcc targets the 186 instruction set
        sourceName: 'PROG.BAS', outputName: null,           // interpreted; output is on screen, not a file
        run: false, verified: true
    },
    // fe (rxi), MIT — a tiny Lisp (lambdas, closures, macros, GC) cross-compiled
    // with ia16-elf-gcc (media-lab project `fe-dos`, ships as static/roms/fe.exe).
    // Same shape as uBASIC: an INTERPRETER that reads its program from PROG.FE
    // (INT 21h) and PRINTS during its run — no output FILE, the caller reads the
    // compile-stage screen. 80186 variant (ia16). VERIFIED on the real bench.
    'fe': {
        id: 'fe', label: 'Lisp (fe on DOS)', language: 'fe', kind: 'dos-native',
        source: 'fe-dos',                      // media-lab project; MIT Lisp interpreter
        compiler: 'fe.exe', compilerFormat: 'exe',
        variant: '80186',
        sourceName: 'PROG.FE', outputName: null,
        run: false, verified: true
    },
    'forth': {
        id: 'forth', label: 'Forth (zForth on DOS)', language: 'forth', kind: 'dos-native',
        source: 'forth-dos',                   // media-lab project; MIT Forth (zevv/zForth)
        compiler: 'forth.exe', compilerFormat: 'exe',
        variant: '80186',
        sourceName: 'PROG.FTH', outputName: null,
        run: false, verified: true
    },
    'tcl': {
        id: 'tcl', label: 'Tcl (partcl on DOS)', language: 'tcl', kind: 'dos-native',
        source: 'tcl-dos',                     // media-lab project; MIT Tcl interpreter (zserge/partcl)
        compiler: 'tcl.exe', compilerFormat: 'exe',
        variant: '80186',
        sourceName: 'PROG.TCL', outputName: null,
        run: false, verified: true
    },
    // Jim Tcl (msteveb/jimtcl), BSD-2 — a complete small Tcl: lists, dicts,
    // expr with 64-bit integers and doubles, strings, regexp, format/scan,
    // upvar, apply, try. Built from jimtcl's amalgamation by tools/jim-dos
    // (every 16-bit change is listed in mkdos.py) and shipped as
    // static/roms/jim.exe. Same shape as partcl, plus a SUPPORT file: Jim's
    // Tcl-coded library commands are read on first use from JIMLIB.TCL
    // (static/roms/jimlib.tcl), so fetchToolchain must return it as
    // support['JIMLIB.TCL']. One 64 KB data segment holds Jim's statics,
    // heap and stack: deep recursion and very large lists fail with a Tcl
    // error rather than crash. VERIFIED on the real bench.
    'jim': {
        id: 'jim', label: 'Tcl (Jim Tcl on DOS)', language: 'tcl', kind: 'dos-native',
        source: 'jim-dos',                     // tools/jim-dos in this repo; BSD-2 interpreter
        compiler: 'jim.exe', compilerFormat: 'exe',
        variant: '80186',
        sourceName: 'PROG.TCL', outputName: null,
        support: ['JIMLIB.TCL'],
        run: false, verified: true
    },
    'gwbasic': {
        id: 'gwbasic', label: 'GW-BASIC (on DOS)', language: 'basic', kind: 'dos-native',
        source: 'gwbasic',                     // MIT GW-BASIC source (Microsoft, 2020) — needs a built GWBASIC.EXE
        compiler: 'GWBASIC.EXE', compilerFormat: 'exe',
        sourceName: 'PROG.BAS', outputName: null,           // interpreted, not compiled to a file
        runKeys: 'LOAD"PROG.BAS\rRUN\r', run: false, verified: false
    }
});

// HOSTED toolchains: the compiler is a HOST program, so it does NOT run on the
// DOS bench — it compiles on a server and returns an 8086 .COM the bench then
// runs (the pattern SmallerC's hosted assembler already uses, HOSTED_ASSEMBLER
// in assemble-route.js). ACK is exactly this: its own docs say "ACK's compiler
// is a host tool (`ack -mmsdos86`)", it "runs on a modern host", NOT on the
// 8086. So libre Pascal via ACK needs a compile ENDPOINT, not compile-on-DOS —
// which is why an earlier `pascal-ack` DOS route was wrong and is corrected to
// this. `endpoint` is null until such a server is stood up.
/** @type {Record<string, object>} */
export const HOSTED_TOOLCHAINS = Object.freeze({
    'pascal-ack': {
        id: 'pascal-ack', label: 'Pascal (ACK)', language: 'pascal', kind: 'hosted',
        source: 'ack',                         // media-lab ACK project (BSD-3), built on the host
        endpoint: null,                        // a server running `ack -mmsdos86 -O`
        outputFormat: 'com', verified: false
    }
});

// CP/M-80 (Z80) toolchain routes. Unlike the DOS routes above, the compiler is
// a HOST cross-compiler that emits a Z80 CP/M `.COM` (ACK's `z80`+`cpm` backend
// gives libre Pascal/C/Modula-2; SDCC gives libre C). The `.COM` does not run on
// the DOS bench — it runs on the CP/M bench (cpm-compile.js → cpm-z80.js), the
// Z80/CP/M twin of the DOS service layer. So, like the ACK-for-8086 route, these
// need a compile ENDPOINT (a server running `ack -mcpm` / `sdcc -mz80`); what is
// proven HERE is the second half — running a produced `.COM` correctly on the
// browser CP/M layer (test/cpm-z80.test.mjs runs a real SDCC-compiled program).
/** @type {Record<string, object>} */
export const CPM_TOOLCHAINS = Object.freeze({
    'ack-z80-cpm': {
        id: 'ack-z80-cpm', label: 'Pascal / C / Modula-2 (ACK, via CP/M)',
        language: 'pascal', kind: 'hosted-cpm',
        source: 'ack',            // Amsterdam Compiler Kit (BSD-3), z80 + cpm backend
        target: 'z80/cpm',
        endpoint: null,           // a server running `ack -mcpm -O`
        outputFormat: 'com',
        // VERIFIED: ACK's z80/cpm platform builds on CI (this box OOMs an ACK
        // build) and a real `ack -mcpm` Pascal `.COM` runs correctly on the
        // bench — built + proven end-to-end in .github/workflows/ack-z80-cpm.yml
        // and re-proven from the committed .COM in test/cpm-z80.test.mjs. What
        // is still OPEN is the in-browser one-click COMPILE: `ack` is a host
        // cross-compiler (like the msdos86 pascal-ack endpoint), so a button
        // needs a hosted `ack -mcpm` endpoint (endpoint stays null until one is
        // stood up); `verified` is the RUN fact, separate from that.
        runProven: true, verified: true
    },
    'sdcc-z80-cpm': {
        id: 'sdcc-z80-cpm', label: 'C (SDCC, via CP/M)', language: 'c', kind: 'hosted-cpm',
        source: 'sdcc',           // SDCC (GPL) z80 backend
        target: 'z80/cpm',
        endpoint: null,           // a server running `sdcc -mz80` + a CP/M crt0
        outputFormat: 'com',
        // A real SDCC-compiled Z80 CP/M .COM runs correctly on the bench
        // (test/cpm-z80.test.mjs); only the compile endpoint is not stood up.
        runProven: true, verified: false
    }
});

/**
 * Run a Z80 CP/M `.COM` a host cross-compiler already produced, on the browser
 * CP/M bench — the stage-two half of a hosted CP/M route. The compile stage
 * (fetching the toolchain, running `ack -mcpm`) is an endpoint's job; this is
 * the run.
 *
 * @param {string} routeId a key of CPM_TOOLCHAINS
 * @param {Uint8Array} com the produced `.COM` bytes
 * @param {object} [opts]
 * @param {Record<string,Uint8Array|string>} [opts.files] data files to mount
 * @param {string|number[]} [opts.keys]
 * @param {number} [opts.maxSteps]
 * @returns {Promise<object>} the runCpmProgram result
 */
export async function runCpmToolchain(routeId, com, opts = {}) {
    const route = CPM_TOOLCHAINS[routeId];
    if (!route) throw new Error(`unknown CP/M toolchain route: ${routeId}`);
    if (!(com instanceof Uint8Array)) {
        throw new Error('runCpmToolchain needs the produced .COM bytes (a host cross-compiler emits them)');
    }
    return runCpmProgram({bytes: com, files: opts.files, keys: opts.keys, maxSteps: opts.maxSteps});
}

/**
 * Run a code-tab program through a DOS toolchain: fetch its binaries, mount the
 * source, and compile+run on the DOS bench. The toolchain fetcher is injected —
 * a test stubs it; production fetches the media-lab bundle (URL + sha per the
 * project's fetch.sh) — so this module needs no network and no bundled binaries.
 *
 * @param {string} routeId a key of DOS_TOOLCHAINS
 * @param {Uint8Array|string} source the user's program text/bytes
 * @param {object} opts
 * @param {(route: object) => Promise<{compiler: Uint8Array, support?: object}>} opts.fetchToolchain
 * @param {string} [opts.variant]
 * @param {number} [opts.maxSteps]
 * @returns {Promise<object>} the compileAndRunOnDos result
 */
export async function runDosToolchain(routeId, source, opts = {}) {
    const route = DOS_TOOLCHAINS[routeId];
    if (!route) {
        if (HOSTED_TOOLCHAINS[routeId]) {
            throw new Error(`${routeId} is a HOSTED toolchain (a host cross-compiler): ` +
                'it compiles on a server and returns a .COM, it does not run on the DOS ' +
                'bench — use its endpoint, not runDosToolchain');
        }
        throw new Error(`unknown DOS toolchain route: ${routeId}`);
    }
    if (typeof opts.fetchToolchain !== 'function') {
        throw new Error('runDosToolchain needs a fetchToolchain(route) => {compiler, support?}');
    }
    const {compiler, support} = await opts.fetchToolchain(route);
    if (!(compiler instanceof Uint8Array)) throw new Error('fetchToolchain returned no compiler bytes');
    return compileAndRunOnDos({
        compiler, compilerFormat: route.compilerFormat,
        support: support || {},
        sources: {[route.sourceName]: routeId === 'ubasic' && typeof source === 'string' ? ubasicSource(source) : source},
        compileKeys: route.compileKeys, runKeys: route.runKeys,
        outputName: route.outputName, run: !!route.run,
        // A route may pin the CPU variant it was built for (uBASIC needs the
        // 80186 core: ia16-elf-gcc emits 186 opcodes). An explicit opts.variant
        // still wins, for a caller that knows better.
        variant: opts.variant || route.variant, maxSteps: opts.maxSteps,
        // Pass a port observer through to the 8086 bench. A DOS Forth `pin!`
        // OUTs to 0x378+pin, so the Code-tab run path uses this to drive a GPIO
        // widget; routes that do not pass it see the bench behave as before.
        onPortAccess: opts.onPortAccess
    });
}

/**
 * The compile endpoint for a hosted route, honouring an override.
 *
 * The route's own `endpoint` is null in the tracked source because no ACK
 * compile server is deployed yet; a deployment supplies the URL two ways — bake
 * it into this table in a follow-up, or inject it per call as `opts.endpoint`.
 * The call site (and the availability gate) go through this ONE function so the
 * "is it configured?" question has a single answer, the same lesson the
 * assemble tab learned: one function decides a route, the call site does not.
 *
 * @param {string} routeId a key of HOSTED_TOOLCHAINS
 * @param {{endpoint?: string}} [opts]
 * @returns {string|null}
 */
export function hostedEndpointFor (routeId, opts = {}) {
    const route = HOSTED_TOOLCHAINS[routeId];
    if (!route) return null;
    const ep = opts.endpoint || route.endpoint;
    return (typeof ep === 'string' && ep.trim()) ? ep : null;
}

/**
 * Whether a hosted toolchain may be OFFERED as a code-tab button.
 *
 * It is not enough that the route exists: a hosted route with no endpoint is a
 * button that can only fail, so the code tab must not show it. This returns true
 * only when an endpoint is configured (in the table or injected). `verified`
 * stays a SEPARATE fact the table carries — a deployed-but-unproven endpoint is
 * still gated off until a real end-to-end run flips it — so both must hold.
 *
 * @param {string} routeId
 * @param {{endpoint?: string, requireVerified?: boolean}} [opts]
 * @returns {boolean}
 */
export function hostedToolchainReady (routeId, opts = {}) {
    const route = HOSTED_TOOLCHAINS[routeId];
    if (!route) return false;
    if (!hostedEndpointFor(routeId, opts)) return false;
    return opts.requireVerified === false ? true : !!route.verified;
}

/**
 * Run a code-tab program through a HOSTED toolchain: POST the source to the
 * compile server, receive an 8086 `.COM`, and run that .COM on the DOS bench —
 * the SmallerC-assembler pattern (assemble-route.js `requestAssembly`'s hosted
 * arm), reused for a host cross-compiler whose output, not the compiler, is the
 * 8086 program. The `fetch` is injected so a test drives the whole path with a
 * known-good .COM and no network; production passes the tab's fetch.
 *
 * The request/response contract mirrors stc-compiler /assemble so both hosted
 * services speak one shape: POST JSON `{source}` → `{success, base64}` on
 * success, or `{success:false, errors:[{line,message}]}` when the compiler
 * rejected the program (the learner's problem, not a transport fault).
 *
 * @param {string} routeId a key of HOSTED_TOOLCHAINS
 * @param {string} source the user's program text
 * @param {object} [opts]
 * @param {string} [opts.endpoint] override the route's endpoint (deploy plumbing / tests)
 * @param {typeof fetch} [opts.fetch] injected fetch; defaults to globalThis.fetch
 * @param {string} [opts.variant] cpu variant for the DOS bench
 * @param {number} [opts.maxSteps] bench step bound
 * @param {boolean} [opts.run=true] also run the returned .COM on the bench
 * @returns {Promise<{route: string, com: Uint8Array, format: 'com',
 *   screen: string, screenText: string[], exitCode: number, terminated: boolean,
 *   exhausted: boolean, steps: number}>}
 */
export async function runHostedToolchain (routeId, source, opts = {}) {
    const route = HOSTED_TOOLCHAINS[routeId];
    if (!route) {
        if (DOS_TOOLCHAINS[routeId]) {
            throw new Error(`${routeId} is a DOS-native toolchain: it runs on the DOS ` +
                'bench — use runDosToolchain, not runHostedToolchain');
        }
        throw new Error(`unknown hosted toolchain route: ${routeId}`);
    }
    const endpoint = hostedEndpointFor(routeId, opts);
    if (!endpoint) {
        throw new Error(`${route.label} has no compile endpoint configured — a host ` +
            `cross-compiler server running \`ack -mmsdos86 -O\` must be deployed and its ` +
            `URL set (HOSTED_TOOLCHAINS['${routeId}'].endpoint or opts.endpoint)`);
    }
    if (typeof source !== 'string' || !source.trim()) {
        throw new Error(`${route.label}: there is no source to compile`);
    }
    const doFetch = opts.fetch || globalThis.fetch;
    if (typeof doFetch !== 'function') {
        throw new Error('runHostedToolchain needs a fetch (inject opts.fetch or run where globalThis.fetch exists)');
    }

    let res;
    try {
        res = await doFetch(endpoint, {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            body: JSON.stringify({source})
        });
    } catch (e) {
        throw new Error(`${route.label}: compile service unreachable (${e.message})`);
    }
    if (!res.ok) throw new Error(`${route.label}: compile service HTTP ${res.status}`);
    const result = await res.json();
    if (!result.success) {
        const msgs = (result.errors || []).map(e => (e.line ? `L${e.line}: ` : '') + e.message);
        throw new Error(msgs.join('; ') || result.error || `${route.label}: compilation failed`);
    }
    if (!result.base64) throw new Error(`${route.label}: the compile service returned no program`);
    const com = Uint8Array.from(atob(result.base64), c => c.charCodeAt(0));
    if (!com.length) throw new Error(`${route.label}: the compile service returned an empty program`);

    if (opts.run === false) {
        return {route: routeId, com, format: 'com',
            screen: '', screenText: [], exitCode: 0, terminated: false, exhausted: false, steps: 0};
    }
    const run = await runDosProgram({
        bytes: com, format: 'com', variant: opts.variant, maxSteps: opts.maxSteps
    });
    return {route: routeId, com, format: 'com', ...run};
}
