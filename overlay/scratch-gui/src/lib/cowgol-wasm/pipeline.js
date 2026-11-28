// SPDX-License-Identifier: BSD-3-Clause
/**
 * The compiler service's native Cowgol request, run on WebAssembly tools.
 *
 * This is a line-for-line port of the native (non-cgen) branch of
 * `build_cowgol` in CrispStrobe/stc-compiler `cowgol_build.py` at the service
 * commit pinned in build-inputs.json. It returns the SAME JSON object the
 * service's POST /compile returns, so `compileCowgol` validates a local reply
 * with exactly the checks it already applies to a hosted one. The service is
 * the specification: a difference here is a defect, and
 * scripts/verify-cowgol-wasm.mjs compares both, field by field and byte by
 * byte, over the qualification corpus.
 *
 * It owns no I/O. `runTool(tool, argv, files)` executes one isolated tool
 * instance (runtime.js provides it over Emscripten MEMFS) and resolves to
 * `{status, stdout: Uint8Array, stderr: Uint8Array, files: Map<path, Uint8Array>}`.
 */

export const MAX_SOURCE_BYTES = 1_000_000;
export const MAX_ARTIFACT_BYTES = 4 * 1024 * 1024;
const LOG_LIMIT = 65536;

/** Paths the tools see; the service strips its equivalent private roots. */
export const WORK = '/work';
export const BUNDLE = '/bundle';

/** Native targets only. cgen/RV32/AVR need a C cross toolchain (see BUILD-INFO.md). */
export const NATIVE_TARGETS = Object.freeze({
    'z80-cpm': {family: 'cpmz', format: 'bin', extension: 'com', origin: 0x100},
    'i8080-cpm': {family: 'cpm', format: 'bin', extension: 'com', origin: 0x100},
    dos: {family: 'msdos', format: 'bin', extension: 'exe'},
    eater6502: {family: 'eater6502', format: 'bin', extension: 'bin', origin: 0x8000}
});
const ALIASES = {'cowgol-z80-cpm': 'z80-cpm', '8080-cpm': 'i8080-cpm', 'cowgol-8080-cpm': 'i8080-cpm', 'i8086-dos': 'dos'};
const INCLUDES = ['cowgol.coh', 'strings.coh', 'malloc.coh', 'file.coh', 'argv.coh', 'brickwright.coh'];
/** Tools per family; names match the service bundle's bin/ entries. */
export const FAMILY_TOOLS = Object.freeze({
    cpmz: {cowfe: 'cowfe-16bit', cowbe: 'cowbe-z80', cowlink: 'cowlink-ncpmz', assemblers: ['zmac']},
    cpm: {cowfe: 'cowfe-16bit', cowbe: 'cowbe-8080', cowlink: 'cowlink-ncpm', assemblers: ['zmac']},
    msdos: {cowfe: 'cowfe-16bit', cowbe: 'cowbe-8086', cowlink: 'cowlink-msdos', assemblers: ['nasm', 'djlink']},
    eater6502: {cowfe: 'cowfe-6502', cowbe: 'cowbe-65c02-rom', cowlink: 'cowlink-eater6502', assemblers: ['64tass']}
});
export const toolsForTarget = target => {
    const spec = NATIVE_TARGETS[ALIASES[String(target).toLowerCase()] || String(target).toLowerCase()];
    if (!spec) return [];
    const tools = FAMILY_TOOLS[spec.family];
    return [...new Set([tools.cowfe, tools.cowbe, tools.cowlink, ...tools.assemblers])];
};

// Python's str.isspace() / re `\s` set for str patterns (not JavaScript's).
const WS = '\\t\\n\\v\\f\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';
const isPyWhitespace = text => new RegExp(`^[${WS}]+$`, 'u').test(text);
const TOKENS = () => new RegExp(
    `#[^\\n]*|[${WS}]+|"(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'|@?[A-Za-z_][A-Za-z_0-9]*|.`, 'gsu');

const utf8 = new TextEncoder();
const lineOf = (source, index) => {
    let line = 1;
    for (let i = 0; i < index; i++) if (source.charCodeAt(i) === 10) line++;
    return line;
};

/** `reject_source`: size, NUL, inline assembly and the trusted-header list. */
export function rejectSource (source, family) {
    if (utf8.encode(source).length > MAX_SOURCE_BYTES) return {success: false, stage: 'source', error: 'Cowgol source too large'};
    if (source.includes('\0')) return {success: false, stage: 'source', error: 'Cowgol source cannot contain NUL'};
    const tokens = [...source.matchAll(TOKENS())].filter(m => !isPyWhitespace(m[0]) && !m[0].startsWith('#'));
    const allowed = ['riscv32', 'eater6502', 'avr'].includes(family) ? INCLUDES.filter(n => n !== 'file.coh') : INCLUDES;
    for (let index = 0; index < tokens.length; index++) {
        const word = tokens[index][0].toLowerCase();
        let error = null;
        if (['@asm', '@extern', 'extern'].includes(word)) {
            error = 'inline assembly and external symbol directives are unavailable in hosted Cowgol; use the local compiler';
        } else if (word === 'include') {
            const name = index + 1 < tokens.length ? tokens[index + 1][0] : '';
            const terminator = index + 2 < tokens.length ? tokens[index + 2][0] : '';
            if (!allowed.map(item => `"${item}"`).includes(name) || terminator !== ';') {
                error = 'Cowgol includes must name one trusted bundled header: ' + [...allowed].sort().join(', ');
            }
        }
        if (error) return {success: false, stage: 'source', line: lineOf(source, tokens[index].index), error};
    }
    return null;
}

/** Python's `int(..., 16)`-style formatting helpers for the memory strings. */
const hex = (value, width) => '$' + value.toString(16).toUpperCase().padStart(width, '0');

class CompileError extends Error {}

/** `cpm_memory`: TOP / ws / LOMEM from the zmac listing. */
export function cpmMemory (listing, imageBytes) {
    const matches = [...listing.matchAll(/^[ \t\n\r\f\v]*(top|ws|lomem)[ \t\n\r\f\v]+(?:=[ \t\n\r\f\v]*)?([0-9a-f]+)[ \t\n\r\f\v]*$/gim)];
    const values = {};
    for (const m of matches) values[m[1].toLowerCase()] = parseInt(m[2], 16);
    if (matches.length !== 3 || Object.keys(values).sort().join() !== 'lomem,top,ws') {
        throw new CompileError('Cowgol CP/M assembly is missing its memory layout symbols');
    }
    if (values.top !== 0x100 + imageBytes || values.ws !== values.top + 128 || values.lomem < values.ws) {
        throw new CompileError('Cowgol CP/M assembly has an inconsistent code/stack/workspace layout');
    }
    if (values.lomem > 0xd000) throw new CompileError('Cowgol CP/M code, stack and static workspace exceed the $0100–$CFFF area');
    return values;
}

const EATER_NAMES = ['LOMEM', 'eater_workspace_end', 'eater_zp_end', 'eater_code_end',
    'eater_data_load', 'eater_data_size', 'eater_reset', 'eater_irq', 'eater_halt'];

/** `eater_memory`: the 64tass label file against the ROM contract. */
export function eaterMemory (labels, artifact) {
    const pattern = new RegExp(`^[ \\t\\n\\r\\f\\v]*(${EATER_NAMES.join('|')})[ \\t\\n\\r\\f\\v]*=[ \\t\\n\\r\\f\\v]*(\\$[0-9a-f]+|[0-9]+)[ \\t\\n\\r\\f\\v]*$`, 'gim');
    const matches = [...labels.matchAll(pattern)];
    const values = {};
    for (const [, name, value] of matches) {
        values[name.toLowerCase()] = value.startsWith('$') ? parseInt(value.slice(1), 16) : parseInt(value, 10);
    }
    if (matches.length !== EATER_NAMES.length ||
        Object.keys(values).sort().join() !== EATER_NAMES.map(n => n.toLowerCase()).sort().join()) {
        throw new CompileError('Cowgol EATER6502 assembly is missing its memory layout symbols');
    }
    if (artifact.length !== 32768) throw new CompileError('Cowgol EATER6502 must produce an exact 32 KiB ROM');
    const v = values;
    if (!(0x200 <= v.eater_workspace_end && v.eater_workspace_end <= v.lomem && v.lomem <= 0x3ff8 &&
        v.eater_zp_end >= 0 && v.eater_zp_end <= 0x100)) {
        throw new CompileError('Cowgol EATER6502 workspace/data exceed RAM $0200–$3FF7 or zero page');
    }
    if (!(v.eater_reset === 0x8000 &&
        v.eater_halt > 0x8000 && v.eater_halt < v.eater_data_load &&
        v.eater_irq > 0x8000 && v.eater_irq < v.eater_data_load &&
        v.eater_data_load <= v.eater_code_end && v.eater_code_end <= 0xfffa &&
        v.eater_data_size === v.lomem - v.eater_workspace_end &&
        v.eater_data_load + v.eater_data_size === v.eater_code_end)) {
        throw new CompileError('Cowgol EATER6502 has an inconsistent ROM/data relocation layout');
    }
    const word = offset => artifact[offset] | (artifact[offset + 1] << 8);
    if (word(0x7ffa) !== v.eater_irq || word(0x7ffc) !== 0x8000 || word(0x7ffe) !== v.eater_irq) {
        throw new CompileError('Cowgol EATER6502 ROM hardware vectors do not match its executable code');
    }
    if (artifact[v.eater_halt - 0x8000] !== 0xdb) throw new CompileError('Cowgol EATER6502 ROM is missing its STP exit instruction');
    if (artifact[v.eater_irq - 0x8000] !== 0x40) throw new CompileError('Cowgol EATER6502 ROM is missing its RTI interrupt handler');
    return values;
}

const base64 = bytes => {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
};
/** Python `bytes.decode('utf-8', 'replace')` of at most LOG_LIMIT bytes. */
const logText = bytes => new TextDecoder('utf-8', {fatal: false}).decode(bytes.subarray(0, LOG_LIMIT));
const strictText = bytes => {
    try { return new TextDecoder('utf-8', {fatal: true}).decode(bytes); } catch {
        throw new CompileError("'utf-8' codec can't decode the tool output");
    }
};
const concat = (a, b) => {
    const out = new Uint8Array(a.length + b.length);
    out.set(a);
    out.set(b, a.length);
    return out;
};

/**
 * @param {{code: string, target: string, format: string, options?: string[], defines?: object,
 *          disassemble?: boolean, symbols?: boolean}} req
 * @param {{runTool: Function, commit: string}} toolchain
 */
export async function buildCowgolNative (req, toolchain) {
    const requested = String(req.target || '');
    const target = ALIASES[requested.toLowerCase()] || requested.toLowerCase();
    const spec = Object.prototype.hasOwnProperty.call(NATIVE_TARGETS, target) ? NATIVE_TARGETS[target] : null;
    if (!spec) return {success: false, stage: 'target', unsupported: true, error: `Offline Cowgol has no target ${JSON.stringify(requested)}`};
    if (req.format !== spec.format) return {success: false, stage: 'target', error: `Cowgol target ${target} requires format '${spec.format}'`};
    if ((req.options && req.options.length) || (req.defines && Object.keys(req.defines).length)) {
        return {success: false, stage: 'options', error: 'hosted Cowgol accepts no custom options or defines'};
    }
    if (req.disassemble || req.symbols) return {success: false, stage: 'options', error: 'Cowgol debug symbols and disassembly are not available yet'};
    const family = spec.family;
    const refusal = rejectSource(String(req.code), family);
    if (refusal) return refusal;
    const tools = FAMILY_TOOLS[family];
    const logs = [];
    const run = async (tool, command, argv, files, outputs) => {
        const result = await toolchain.runTool(tool, [`${BUNDLE}/bin/${command}`, ...argv], files, outputs);
        // stdout and stderr shared one file in the service: stderr is
        // unbuffered and stdout block-buffered, so stderr bytes land first.
        let text = logText(concat(result.stderr, result.stdout));
        for (const root of [WORK, BUNDLE]) text = text.split(root + '/').join('');
        logs.push(text);
        if (result.status) throw new CompileError(`${command} exited with status ${result.status}`);
        return result.files;
    };
    const source = utf8.encode(req.code);
    const work = name => `${WORK}/${name}`;
    try {
        const includePaths = [`-I${BUNDLE}/rt/`, `-I${BUNDLE}/rt/${family}/`];
        let out = await run(tools.cowfe, `cowfe-${family}`, [...includePaths, work('main.cow'), work('main.cob')],
            {[work('main.cow')]: source}, [work('main.cob')]);
        out = await run(tools.cowbe, `cowbe-${family}`, [work('main.cob'), work('main.coo')],
            {[work('main.cob')]: out.get(work('main.cob'))}, [work('main.coo')]);
        const assembly = work(family === 'msdos' || family === 'eater6502' ? 'main.asm' : 'main.z80');
        out = await run(tools.cowlink, `cowlink-${family}`,
            ['-o', assembly, work('main.coo'), `${BUNDLE}/rt/${family}/cowgol.coo`],
            // rt/ (headers and cowgol.coo) is mounted read-only in every instance.
            {[work('main.coo')]: out.get(work('main.coo'))}, [assembly]);
        const asmBytes = out.get(assembly);
        const output = work(`main.${spec.extension}`);
        let artifact = null;
        let memoryLayout = null;
        if (family === 'msdos') {
            out = await run('nasm', 'nasm', ['-f', 'obj', '-o', work('main.obj'), assembly],
                {[assembly]: asmBytes}, [work('main.obj')]);
            out = await run('djlink', 'djlink', ['-o', output, work('main.obj')],
                {[work('main.obj')]: out.get(work('main.obj'))}, [output]);
            artifact = out.get(output) || null;
        } else if (family === 'eater6502') {
            out = await run('64tass', '64tass', ['--quiet', '--long-branch', '--ascii', '--case-sensitive',
                '--nostart', '--labels', work('main.labels'), '-o', output, assembly],
            {[assembly]: asmBytes}, [output, work('main.labels')]);
            artifact = out.get(output) || null;
            if (!artifact || artifact.length !== 32768) throw new CompileError('Cowgol EATER6502 must produce an exact 32 KiB ROM');
            const labels = out.get(work('main.labels'));
            if (!labels) throw new CompileError(`[Errno 2] No such file or directory: '${work('main.labels')}'`);
            memoryLayout = eaterMemory(strictText(labels), artifact);
        } else {
            out = await run('zmac', 'zmac', ['-j', '-m', family === 'cpmz' ? '-z' : '-8',
                '-o', work('main.cim'), '-o', work('main.lst'), assembly],
            {[assembly]: asmBytes}, [work('main.cim'), work('main.lst')]);
            const cim = out.get(work('main.cim'));
            const listing = out.get(work('main.lst'));
            if (!cim || !listing) throw new CompileError('[Errno 2] No such file or directory: zmac output');
            memoryLayout = cpmMemory(strictText(listing), cim.length);
            artifact = cim;
        }
        const maximum = spec.origin === 0x100 ? 0xcf00 : family === 'eater6502' ? 32768 : MAX_ARTIFACT_BYTES;
        if (!artifact || !(artifact.length > 0 && artifact.length <= maximum)) {
            throw new CompileError(`Cowgol output is empty or exceeds ${maximum} bytes for ${target}`);
        }
        if (family === 'msdos' && (artifact[0] !== 0x4d || artifact[1] !== 0x5a)) {
            throw new CompileError('Cowgol DOS linker did not produce an MZ executable');
        }
        const response = {success: true, base64: base64(artifact), filename: `main.${spec.extension}`,
            bytes: artifact.length, log: logs.join(''), language: 'cowgol', target, format: spec.format,
            toolchain: `cowgol-${family}`, compiler_commit: toolchain.commit, artifact_kind: 'executable'};
        if (spec.origin === 0x100) {
            response.origin = spec.origin;
            response.memory_end = memoryLayout.lomem;
            response.memory = `CP/M image ${artifact.length} bytes, stack 128 bytes, ` +
                `static workspace ${memoryLayout.lomem - memoryLayout.ws} bytes; ` +
                `end ${hex(memoryLayout.lomem, 4)} (limit $D000)`;
        }
        if (family === 'eater6502') {
            Object.assign(response, {origin: 0x8000, entry: 0x8000, mcu: 'w65c02', memory_end: memoryLayout.lomem,
                memory_layout: memoryLayout,
                memory: `EATER6502 ROM 32768 bytes; code/data end ${hex(memoryLayout.eater_code_end, 4)}; ` +
                    `RAM end ${hex(memoryLayout.lomem, 4)} (limit $3FF8); ` +
                    `zero-page end ${hex(memoryLayout.eater_zp_end, 2)}`});
        }
        return response;
    } catch (error) {
        if (error instanceof CompileError || error?.name === 'CowgolToolError') {
            return {success: false, stage: 'compile', error: error.message, log: logs.join('')};
        }
        throw error;
    }
}
