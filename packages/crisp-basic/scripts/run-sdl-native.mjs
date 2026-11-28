#!/usr/bin/env node
// Direct-source counterpart to the full SDL bundler.
import {spawn} from 'node:child_process';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareSource} from '../src/source.mjs';
import {hostNativeTarget} from './native-targets.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (!args.length || args[0] === '--help') {
    console.log('Usage: node scripts/run-sdl-native.mjs PROGRAM.bas [program arguments...]\n' +
        'Set CRISP_BASIC_SDL_RUNTIME_PACK to select a built runtime pack.\n' +
        'PRINT renders in the SDL window. Set CRISP_BASIC_VDU_STDOUT=1 for byte-exact stdout capture.');
    process.exitCode = args.length ? 0 : 2;
} else {
    const filename = resolve(args.shift());
    const source = prepareSource(await readFile(filename, 'utf8'), {filename});
    const pack = resolve(process.env.CRISP_BASIC_SDL_RUNTIME_PACK || join(root, '.build/sdl/native', process.env.CRISP_BASIC_TARGET || hostNativeTarget(), 'runtime'));
    const runner = process.env.CRISP_BASIC_SDL_RUNNER ? JSON.parse(process.env.CRISP_BASIC_SDL_RUNNER) : undefined;
    if (runner && (typeof runner.executable !== 'string' || !runner.executable ||
        (runner.args !== undefined && (!Array.isArray(runner.args) || runner.args.some(arg => typeof arg !== 'string'))))) {
        throw new TypeError('CRISP_BASIC_SDL_RUNNER must be {"executable":"...","args":["..."]}');
    }
    const directory = await mkdtemp(join(resolve(tmpdir()), 'crispbasic-sdl-source-'));
    const numbered = join(directory, 'source.bas');
    try {
        await writeFile(numbered, source.numberedSource, 'latin1');
        const executable = join(pack, 'bbcsdl');
        const child = spawn(runner?.executable || executable, runner ? [...(runner.args || []), executable, filename, ...args] : [filename, ...args], {stdio: 'inherit', env: {...process.env,
            LD_LIBRARY_PATH: pack + (process.env.LD_LIBRARY_PATH ? ':' + process.env.LD_LIBRARY_PATH : ''),
            CRISP_BASIC_SOURCE: numbered, CRISP_BASIC_PROGRAM_PATH: filename,
            CRISP_BASIC_CWD: process.cwd(), CRISP_BASIC_BATCH: '1'}});
        const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'];
        const handlers = signals.map(signal => { const handler = () => child.kill(signal); process.on(signal, handler); return handler; });
        try {
            process.exitCode = await new Promise((resolveStatus, reject) => {
                child.once('error', reject);
                child.once('exit', (code, signal) => resolveStatus(code ?? ({SIGINT: 130, SIGTERM: 143, SIGHUP: 129}[signal] || 1)));
            });
        } finally { signals.forEach((signal, i) => process.off(signal, handlers[i])); }
    } finally { await rm(directory, {recursive: true, force: true}); }
}
