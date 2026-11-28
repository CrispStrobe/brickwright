#!/usr/bin/env node
// Build BBCSDL's full WebAssembly SDL host from reviewed, hash-pinned inputs.
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {basename, dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {patchSDLSource} from '../sdl/patch-upstream.mjs';
import {patchSDLWebSource} from '../sdl/patch-web.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = join(root, '.build');
const work = resolve(process.env.CRISP_BASIC_SDL_WEB_OUTPUT || join(build, 'sdl-web'));
const checkout = resolve(process.env.CRISP_BASIC_UPSTREAM || join(build, 'BBCSDL'));
const lock = JSON.parse(readFileSync(join(root, 'sdl/upstream.lock.json'), 'utf8')).bbcSDL;
const toolchain = JSON.parse(readFileSync(join(root, 'wasm/toolchain.lock.json'), 'utf8')).emscripten;
const command = process.env.EMCC || 'emcc';
const emcc = command.includes('/') ? resolve(command) : command;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const localSourceInputs = [
    'scripts/build-sdl-web.mjs', 'sdl/upstream.lock.json', 'sdl/patch-upstream.mjs',
    'sdl/patch-web.mjs', 'sdl/source-loader.h', 'sdl/web-host.c'
].map(path => ({path, sha256: digest(readFileSync(join(root, path)))}));

for (const folder of [work, join(work, 'src'), join(work, 'include'), join(work, 'licenses'), join(build, 'tmp')]) {
    mkdirSync(folder, {recursive: true});
}
const env = {...process.env, TMPDIR: join(build, 'tmp')};
const run = (program, args, options = {}) => execFileSync(program, args, {
    cwd: work, env, stdio: 'inherit', ...options
});
let compiler;
try { compiler = run(emcc, ['--version'], {stdio: 'pipe'}).toString().split('\n')[0]; }
catch { throw new Error('Install Emscripten 3.1.64, or set EMCC to its emcc executable.'); }
if (!compiler.includes(' ' + toolchain.version + ' ')) {
    throw new Error(`SDL web builds are qualified with Emscripten ${toolchain.version}; found ${compiler}.`);
}
for (const notice of toolchain.notices) {
    if (digest(readFileSync(join(root, notice.path))) !== notice.sha256) {
        throw new Error('Toolchain notice SHA-256 mismatch: ' + notice.path);
    }
}

if (!existsSync(join(checkout, '.git'))) {
    if (process.env.CRISP_BASIC_UPSTREAM) throw new Error('CRISP_BASIC_UPSTREAM must name a BBCSDL git checkout.');
    run('git', ['clone', '--filter=blob:none', '--no-checkout', lock.repository, checkout]);
}
const git = args => execFileSync('git', ['-C', checkout, ...args], {env, maxBuffer: 16 << 20});
try { git(['cat-file', '-e', lock.commit + '^{commit}']); }
catch { run('git', ['-C', checkout, 'fetch', 'origin', lock.commit]); }
if (git(['rev-parse', lock.commit + '^{commit}']).toString().trim() !== lock.commit) {
    throw new Error('BBCSDL commit verification failed.');
}
const sourceNames = [
    'bbmain', 'bbexec', 'bbeval', 'bbcmos', 'bbccli', 'bbcvdu', 'bbcvtx', 'flood',
    'sort', 'bbdata_wasm32', 'bbcsdl', 'bbasmb_wasm32', 'SDL2_gfxPrimitives', 'SDL2_rotozoom'
];
const selected = [
    ...sourceNames.map(name => `src/${name}.c`),
    ...['SDL2_gfxPrimitives.h', 'SDL2_gfxPrimitives_font.h', 'SDL2_rotozoom.h',
        'SDL_stbimage.h', 'stb_image.h', 'dr_mp3.h', 'version.h'].map(name => `include/${name}`),
    'bin/wasm/BBC.h', 'bin/wasm/bbcsdl.h', 'licence.txt'
];
const verified = [];
const originalFiles = new Map();
for (const path of selected) {
    const expected = lock.files.find(file => file.path === path);
    if (!expected) throw new Error('SDL web source input missing from lock: ' + path);
    const bytes = git(['show', lock.commit + ':' + path]);
    if (digest(bytes) !== expected.sha256) throw new Error('BBCSDL SHA-256 mismatch: ' + path);
    originalFiles.set(path, bytes);
    const destination = join(work, path.startsWith('bin/wasm/') ? 'include/' + basename(path) : path);
    mkdirSync(dirname(destination), {recursive: true});
    writeFileSync(destination, path.endsWith('.c') || path.endsWith('.h')
        ? patchSDLWebSource(path, patchSDLSource(path, bytes.toString('utf8'))) : bytes);
    verified.push(expected);
}

// Build these ports before linking. SDL_ttf's nested port dependency otherwise
// attempts to reacquire Emscripten 3.1.64's cache lock on a fresh installation.
const sibling = name => emcc.includes('/') ? join(dirname(emcc), name) : name;
run(sibling('embuilder'), ['build', 'sdl2-mt', 'sdl2_net', 'sdl2_ttf']);
const memoryFlags = ['-fno-delete-null-pointer-checks'];
const common = ['-O2', '-Wall', '-Wno-pthreads-mem-growth', ...memoryFlags, '-pthread',
    '-sUSE_SDL=2', '-sUSE_SDL_TTF=2', '-sUSE_SDL_NET=2',
    '-I', join(work, 'include'), '-I', join(root, 'sdl')];
const objects = [];
for (const name of sourceNames) {
    const object = join(work, name + '.o');
    run(emcc, [...common, '-c', join(work, 'src', name + '.c'), '-o', object]);
    objects.push(object);
}
const hostObject = join(work, 'web-host.o');
run(emcc, [...common, '-c', join(root, 'sdl/web-host.c'), '-o', hostObject]);
objects.push(hostObject);
const settings = [
    '-O2', '-pthread', '-sUSE_SDL=2', '-sUSE_SDL_TTF=2', '-sUSE_SDL_NET=2',
    '-Wno-pthreads-mem-growth', '-sMODULARIZE=1', '-sEXPORT_NAME=createCrispBasicSDL',
    '-sENVIRONMENT=web,worker', '-sPTHREAD_POOL_SIZE=2', '-sALLOW_MEMORY_GROWTH=1',
    '-sINITIAL_MEMORY=134217728', '-sMAXIMUM_MEMORY=1073741824', '-sSTACK_SIZE=5242880',
    '-sASSERTIONS=1', '-sEXPORTED_RUNTIME_METHODS=["FS","ENV","HEAPU8","PThread"]',
    '-sEXPORTED_FUNCTIONS=["_main","_crisp_sdl_output","_crisp_sdl_output_length","_crisp_sdl_output_overflow","_crisp_sdl_finished","_crisp_sdl_exit_code","_crisp_sdl_startup_failed","_crisp_sdl_write_key","_crisp_sdl_stop"]',
    '-lidbfs.js'
];
run(emcc, [...objects, ...settings, '-o', join(work, 'crispbasic-sdl.js')]);

const cache = run(sibling('em-config'), ['CACHE'], {stdio: 'pipe'}).toString().trim();
const noticeSources = [
    {name: 'CrispBASIC', bytes: readFileSync(join(root, 'LICENSE'))},
    {name: 'BBCSDL', bytes: originalFiles.get('licence.txt')},
    ...toolchain.notices.map(notice => ({name: basename(notice.path), bytes: readFileSync(join(root, notice.path))})),
    ...[
        ['SDL2', 'ports/sdl2/SDL-release-2.28.4/LICENSE.txt'],
        ['SDL2_ttf', 'ports/sdl2_ttf/SDL_ttf-release-2.20.2/LICENSE.txt'],
        ['SDL2_net', 'ports/sdl2_net/SDL2_net-version_2/COPYING.txt'],
        ['FreeType', 'ports/freetype/FreeType-version_1/docs/FTL.TXT'],
        ['HarfBuzz', 'ports/harfbuzz/harfbuzz-3.2.0/COPYING'],
        ['zlib', 'ports/zlib/zlib-1.2.13/LICENSE']
    ].map(([name, path]) => ({name, bytes: readFileSync(join(cache, path))})),
    ...['include/stb_image.h', 'include/dr_mp3.h', 'src/SDL2_gfxPrimitives.c', 'src/SDL2_rotozoom.c']
        .map(path => ({name: basename(path) + ' source notices', bytes: originalFiles.get(path)}))
];
const notices = noticeSources.map(({name, bytes}, index) => {
    const path = `licenses/${index}-${name.replace(/[^A-Za-z0-9._-]/g, '_')}.txt`;
    writeFileSync(join(work, path), bytes);
    return {name, path};
});
const files = ['crispbasic-sdl.js', 'crispbasic-sdl.wasm', ...notices.map(notice => notice.path)].map(path => {
    const bytes = readFileSync(join(work, path));
    return {path, bytes: bytes.length, sha256: digest(bytes)};
});
for (const input of localSourceInputs) {
    if (digest(readFileSync(join(root, input.path))) !== input.sha256) {
        throw new Error('Local SDL web input changed during compilation: ' + input.path);
    }
}
writeFileSync(join(work, 'build.json'), JSON.stringify({
    schemaVersion: 1, hostABI: 1, format: 'crispbasic-sdl-web-runtime', backend: 'bbcsdl-sdl-wasm',
    upstreamCommit: lock.commit, compiler, toolchain, settings, memoryFlags,
    sourceInputs: verified, localSourceInputs, module: 'crispbasic-sdl.js', wasm: 'crispbasic-sdl.wasm',
    files, notices, assets: [],
    capabilities: {
        graphics: true, sound: true, filesystem: 'browser-virtual', sys: 'upstream-wasm-wrapper-table',
        assembler: false, box2d: false, sharedMemory: true, requiresCrossOriginIsolation: true
    },
    limitations: [
        'Upstream BBCSDL WebAssembly does not provide machine-code inline assembly, CALL or USR.',
        'Box2D231.o is not in the pinned upstream source tree; its SYS export is unavailable and fails explicitly.',
        'Operating system APIs and files are browser-local; native shared objects cannot be loaded.',
        'Fonts, BASIC libraries and application data are explicit bundle assets.'
    ]
}, null, 2) + '\n');
console.log('Built full SDL web runtime in ' + work);
