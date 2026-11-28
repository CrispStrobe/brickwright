// SPDX-License-Identifier: BSD-3-Clause
// Invoke real C toolchains. A successful build is never a simulation result.
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {access, copyFile, mkdir, mkdtemp, readFile, rename, rm, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';

const targets = Object.freeze({
    native: Object.freeze({id: 'native', aliases: ['host'], toolchain: 'gcc', format: 'executable'}),
    pico: Object.freeze({id: 'pico', aliases: ['rp2040', 'pi_pico', 'raspberry-pi-pico'], toolchain: 'pico-sdk', format: 'uf2'}),
    'arduino-uno': Object.freeze({id: 'arduino-uno', aliases: ['uno', 'arduino_uno', 'atmega328p'], toolchain: 'avr-gcc', format: 'ihex'})
});

export function listCompilerTargets() { return Object.values(targets); }
export function resolveCompilerTarget(name = 'native') {
    const key = typeof name === 'string' ? name.toLowerCase() : '';
    const target = Object.values(targets).find(entry => entry.id === key || entry.aliases.includes(key));
    if (!target) throw new TypeError(`Unknown compiler target ${JSON.stringify(name)}; choose native, pico or arduino-uno`);
    return target;
}

export class CompilerBuildError extends Error {
    constructor(code, message, details = {}) {
        super(message);
        this.name = 'CompilerBuildError';
        this.code = code;
        Object.assign(this, details);
    }
}

async function runTool(executable, args, {cwd, timeoutMs, signal}, commands) {
    if (typeof executable !== 'string' || !executable.length || executable.includes('\0')) {
        throw new TypeError('Compiler executable must be a nonempty executable name or path');
    }
    const command = {executable, args: [...args]};
    commands.push(command);
    return new Promise((resolve, reject) => {
        let child;
        try { child = spawn(executable, args, {cwd, stdio: ['ignore', 'pipe', 'pipe'], signal, shell: false}); }
        catch (error) { reject(new CompilerBuildError('toolchain-unavailable', `${executable}: ${error.message}`, {command})); return; }
        let stdout = '', stderr = '', length = 0, done = false;
        const finish = (error, result) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            error ? reject(error) : resolve(result);
        };
        const timer = setTimeout(() => {
            child.kill('SIGKILL');
            finish(new CompilerBuildError('build-timeout', `${executable} exceeded ${timeoutMs} ms`, {command, stdout, stderr}));
        }, timeoutMs);
        const collect = stream => chunk => {
            length += chunk.length;
            if (length > 1024 * 1024) {
                child.kill('SIGKILL');
                finish(new CompilerBuildError('build-output-limit', 'C toolchain output exceeded 1 MiB', {command}));
                return;
            }
            if (stream === 'stdout') stdout += chunk; else stderr += chunk;
        };
        child.stdout.on('data', collect('stdout'));
        child.stderr.on('data', collect('stderr'));
        child.once('error', error => finish(new CompilerBuildError(
            error.name === 'AbortError' ? 'build-cancelled' : 'toolchain-unavailable',
            `${executable}: ${error.message}`, {command, stdout, stderr})));
        child.once('close', (code, killedBy) => {
            if (code !== 0) finish(new CompilerBuildError('build-failed',
                `${executable} failed (${killedBy || code})${stderr ? `\n${stderr.trim()}` : ''}`, {command, stdout, stderr, exitCode: code}));
            else finish(null, {stdout, stderr});
        });
    });
}

function resolveExecutable(executable) {
    return executable && /[\\/]/.test(executable) ? path.resolve(executable) : executable;
}

async function publish(from, to) {
    const temporary = `${to}.crispbasic-${process.pid}-${Math.random().toString(16).slice(2)}`;
    try { await copyFile(from, temporary); await rename(temporary, to); }
    finally { await rm(temporary, {force: true}); }
    const bytes = await readFile(to);
    return {path: to, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')};
}

function picoProject() {
    return `cmake_minimum_required(VERSION 3.13)
include("$ENV{PICO_SDK_PATH}/external/pico_sdk_import.cmake")
set(PICO_BOARD pico CACHE STRING "CrispBASIC board")
project(crispbasic_program C CXX ASM)
# The generated language/runtime is C99. Pico SDK 2.x headers require C11.
set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)
pico_sdk_init()
add_executable(crispbasic_program program.c)
target_compile_options(crispbasic_program PRIVATE -Os -ffunction-sections -fdata-sections)
target_link_libraries(crispbasic_program pico_stdlib hardware_gpio m)
# The SDK's compact printf does not preserve C99 %g formatting semantics.
pico_set_printf_implementation(crispbasic_program compiler)
# The ROM-oriented fast double implementation flushes IEEE subnormals.
pico_set_double_implementation(crispbasic_program compiler)
pico_enable_stdio_uart(crispbasic_program 1)
pico_enable_stdio_usb(crispbasic_program 0)
pico_add_extra_outputs(crispbasic_program)
`;
}

function companionOutput(output, extension) {
    const parsed = path.parse(output);
    return path.join(parsed.dir, `${parsed.name}${extension}`);
}

/** Build an already generated, self-contained C99 file through a real toolchain.
 * This API never flashes hardware or labels host execution as an MCU emulator.
 * output is the executable, Uno .hex, or Pico .uf2; board .elf companions are
 * retained for the same existing Brickwright flash/debug/emulation routes.
 */
export async function buildCompiledC({sourcePath, target: targetName = 'native', output,
    cc, picoSdkPath = process.env.PICO_SDK_PATH, buildDirectory, timeoutMs = 120000,
    signal, objcopy = 'avr-objcopy', size = 'avr-size', cmake = 'cmake'} = {}) {
    const target = resolveCompilerTarget(targetName);
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 3600000) {
        throw new TypeError('Build timeout must be an integer from 1 to 3600000 ms');
    }
    if (typeof sourcePath !== 'string' || typeof output !== 'string' || !sourcePath || !output) {
        throw new TypeError('sourcePath and output are required file paths');
    }
    const source = path.resolve(sourcePath), destination = path.resolve(output);
    if (source === destination) throw new TypeError('Compiler output must not replace its generated C input');
    if (target.id === 'pico' && !destination.endsWith('.uf2')) throw new TypeError('Pico output must use the .uf2 extension');
    if (target.id === 'arduino-uno' && !destination.endsWith('.hex')) throw new TypeError('Arduino Uno output must use the .hex extension');
    cc = resolveExecutable(cc);
    objcopy = resolveExecutable(objcopy);
    size = resolveExecutable(size);
    cmake = resolveExecutable(cmake);
    if (!(await stat(source)).isFile()) throw new TypeError('Generated C source must be a regular file');
    await mkdir(path.dirname(destination), {recursive: true});
    const work = buildDirectory ? path.resolve(buildDirectory) : await mkdtemp(path.join(path.dirname(destination), '.crispbasic-build-'));
    if (buildDirectory) await mkdir(work, {recursive: true});
    const commands = [], artifacts = [];
    const runOptions = {cwd: work, timeoutMs, signal};
    let resources;
    try {
        if (source !== path.join(work, 'program.c')) await copyFile(source, path.join(work, 'program.c'));
        if (target.id === 'native') {
            const executable = cc || resolveExecutable(process.env.CC) || 'gcc';
            await runTool(executable, ['-std=c99', '-Os', '-ffunction-sections', '-fdata-sections', 'program.c', '-Wl,--gc-sections', '-lm', '-o', 'program'], runOptions, commands);
            artifacts.push({...await publish(path.join(work, 'program'), destination), format: 'executable'});
        } else if (target.id === 'arduino-uno') {
            const executable = cc || resolveExecutable(process.env.AVR_CC) || 'avr-gcc';
            try {
                await runTool(executable, ['-std=c99', '-Os', '-mmcu=atmega328p', '-DF_CPU=16000000UL',
                    '-mdouble=64', '-mlong-double=64', '-ffunction-sections', '-fdata-sections',
                    'program.c', '-Wl,--gc-sections', '-Wl,-u,vfprintf', '-lprintf_flt', '-lm', '-o', 'program.elf'], runOptions, commands);
            } catch (error) {
                if (/unrecognized.*m(?:long-)?double|unknown.*m(?:long-)?double/.test(error.stderr || '')) {
                    throw new CompilerBuildError('toolchain-incompatible',
                        'Arduino Uno compilation requires an AVR GCC toolchain and avr-libc with 64-bit double support (-mdouble=64 -mlong-double=64). The installed toolchain only supplies reduced precision.',
                        {command: error.command, stderr: error.stderr});
                }
                throw error;
            }
            const sizes = await runTool(size, ['-A', 'program.elf'], runOptions, commands);
            const sections = Object.fromEntries([...sizes.stdout.matchAll(/^\s*(\.\S+)\s+(\d+)\s+/gm)].map(match => [match[1], Number(match[2])]));
            if (!Object.hasOwn(sections, '.text')) throw new CompilerBuildError('invalid-size-report', 'avr-size did not report an ELF .text section');
            const data = sections['.data'] || 0, bss = sections['.bss'] || 0, noinit = sections['.noinit'] || 0;
            resources = {flashBytes: sections['.text'] + data, staticRamBytes: data + bss + noinit,
                flashLimitBytes: 32256, staticRamLimitBytes: 1536, reservedStackBytes: 512,
                numericFormat: 'binary64'};
            if (resources.flashBytes > resources.flashLimitBytes || resources.staticRamBytes > resources.staticRamLimitBytes) {
                throw new CompilerBuildError('board-capacity', `Arduino Uno image exceeds its flash/SRAM budget (${resources.flashBytes}/32256 flash, ${resources.staticRamBytes}/1536 static RAM bytes)`, {resources});
            }
            await runTool(objcopy, ['-O', 'ihex', '-R', '.eeprom', 'program.elf', 'program.hex'], runOptions, commands);
            artifacts.push({...await publish(path.join(work, 'program.hex'), destination), format: 'ihex'},
                {...await publish(path.join(work, 'program.elf'), companionOutput(destination, '.elf')), format: 'elf'});
        } else {
            if (!picoSdkPath) throw new CompilerBuildError('toolchain-unavailable', 'Pico build requires --pico-sdk PATH or PICO_SDK_PATH');
            const sdk = path.resolve(picoSdkPath);
            try { await access(path.join(sdk, 'external', 'pico_sdk_import.cmake')); }
            catch { throw new CompilerBuildError('toolchain-unavailable', `Pico SDK import file is missing below ${sdk}`); }
            // Use an explicit CMake cache path, with no network fetch fallback.
            await writeFile(path.join(work, 'CMakeLists.txt'), picoProject().replace('"$ENV{PICO_SDK_PATH}/external/pico_sdk_import.cmake"',
                '"${PICO_SDK_PATH}/external/pico_sdk_import.cmake"'));
            await runTool(cmake, ['-S', '.', '-B', 'build', `-DPICO_SDK_PATH=${sdk}`, '-DPICO_BOARD=pico',
                '-DPICO_PLATFORM=rp2040', '-DPICO_SDK_FETCH_FROM_GIT=OFF', '-DCMAKE_BUILD_TYPE=MinSizeRel',
                ...(cc ? [`-DCMAKE_C_COMPILER=${cc}`] : [])], runOptions, commands);
            await runTool(cmake, ['--build', 'build', '--parallel', '2'], runOptions, commands);
            for (const [suffix, dest] of [['uf2', destination], ['elf', companionOutput(destination, '.elf')], ['bin', companionOutput(destination, '.bin')]]) {
                artifacts.push({...await publish(path.join(work, 'build', `crispbasic_program.${suffix}`), dest), format: suffix});
            }
        }
        return {schemaVersion: 1, target: target.id, toolchain: target.toolchain, artifacts,
            ...(resources ? {resources} : {}), commands,
            validation: {status: 'build-only', simulator: 'not-run', hardware: 'not-run'}};
    } finally {
        if (!buildDirectory) await rm(work, {recursive: true, force: true});
    }
}
