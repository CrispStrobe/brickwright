// SPDX-License-Identifier: BSD-3-Clause
// C99 compilation is supplied by the independent crispbasic package. This
// adapter owns only editor target selection and existing C-route handoff.
import {hexImageBytes} from './bw-debug/arduino-sketch.js';

const marker = /^\/\* CrispBASIC C99 target: (native|pico|arduino-uno) \*\//;
const importCompiler = url => import(/* webpackIgnore: true */ url);

export function compiledBasicTarget (source) {
    return marker.exec(String(source))?.[1] || null;
}

export function basicCompilerTarget (device) {
    if (!device || device === 'native') return 'native';
    if (['pico', 'pi_pico', 'rp2040'].includes(device)) return 'pico';
    if (['arduino-uno', 'arduino_uno', 'atmega328p'].includes(device)) return 'arduino-uno';
    throw new Error(`Compile BASIC supports native, Raspberry Pi Pico and Arduino Uno; '${device}' has no C99 platform adapter.`);
}

export async function prepareCompiledBasic ({source, device, filename = 'editor.bas',
    loadCompiler = importCompiler, baseURL} = {}) {
    const target = basicCompilerTarget(device);
    const url = new URL('src/compiler/index.mjs', baseURL ||
        new URL('static/crispbasic-compiler/', globalThis.document?.baseURI || globalThis.location?.href)).href;
    let compiler;
    try { compiler = await loadCompiler(url); }
    catch (error) {
        throw new Error(`The C99 BASIC compiler is unavailable. Rebuild the app or restore its locked assets with npm run package:crispbasic:compiler. ${error.message}`);
    }
    if (typeof compiler.compileSource !== 'function') throw new Error('The staged BASIC compiler has no compileSource entrypoint.');
    const result = compiler.compileSource(source, {filename, target});
    return {...result, c: `/* CrispBASIC C99 target: ${target} */\n${result.c}`, target,
        evidence: {build: 'not-run', simulator: 'not-run', hardware: 'not-run'}};
}

/** Do not send Pico SDK C to the SRAM-only hosted RP2040 compiler. */
export function assertCompiledBasicRoute (source, target, language = 'c') {
    const compiled = compiledBasicTarget(source);
    if (!compiled) return;
    if (compiled === 'pico') {
        throw new Error('This BASIC program requires the Pico SDK. Build with crispbasic compile --target pico, then load the resulting UF2/ELF with the existing firmware route. The hosted SRAM C compiler does not supply the Pico SDK.');
    }
    if (compiled === 'native') throw new Error('This BASIC program targets native gcc. Save the C file or use crispbasic compile to build it locally.');
    if (target !== 'atmega328p' || language !== 'c') {
        throw new Error('Compiled Uno BASIC requires the atmega328p C route, not the Arduino C++ sketch route.');
    }
}

/** Same output object as requestSketchBuild, so the existing firmware/flash
 * handoff is reused. Compilation alone supplies no MCU execution evidence. */
export async function requestCompiledBasicBuild ({source, device, compile}) {
    if (basicCompilerTarget(device) !== 'arduino-uno' || compiledBasicTarget(source) !== 'arduino-uno') {
        throw new Error('The compiled BASIC target does not match the selected Arduino Uno.');
    }
    const out = await compile(source, 'atmega328p', 'hex', 'c', {symbols: true, fosc: 16000000,
        options: ['-mdouble=64', '-mlong-double=64', '-Wl,-u,vfprintf', '-lprintf_flt', '-lm']});
    const hex = atob(String(out.base64 || ''));
    if (!/^\s*:/.test(hex) || !/:00000001FF\s*$/i.test(hex)) throw new Error('The C compiler did not return a complete Intel HEX image.');
    if (out.f_cpu && Number(out.f_cpu) !== 16000000) throw new Error('The C compiler returned firmware for the wrong Uno clock.');
    const bytes = hexImageBytes(hex);
    if (bytes > 32256) throw new Error('Compiled BASIC exceeds the Uno application flash capacity.');
    return {hex, bytes, target: 'atmega328p', kind: 'avr8js', clockHz: 16000000,
        builtForHz: Number(out.f_cpu) || null, symbols: out.symbols || null,
        prototypes: [], libraries: [], log: out.log || '', memory: out.memory || '',
        evidence: {build: 'passed', simulator: 'not-run', hardware: 'not-run'}};
}
