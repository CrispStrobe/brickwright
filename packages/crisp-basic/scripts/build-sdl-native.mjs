#!/usr/bin/env node
// Build the complete upstream SDL host from pinned, hash-verified source.
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {patchSDLSource} from '../sdl/patch-upstream.mjs';
import {hostNativeTarget, nativeTarget, verifyNativeBinary} from './native-targets.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = nativeTarget(process.env.CRISP_BASIC_TARGET || hostNativeTarget());
const cross = target.name !== hostNativeTarget();
if (process.platform !== 'linux') throw new Error('Full SDL native builds require Linux');
if (cross && !process.env.CC) throw new Error('Set CC explicitly when cross-compiling the full SDL host');
const work = join(root, '.build/sdl/native', target.name), output = join(work, 'runtime');
const checkout = resolve(process.env.CRISP_BASIC_UPSTREAM || join(root, '.build/BBCSDL'));
const lock = JSON.parse(readFileSync(join(root, 'sdl/upstream.lock.json'))).bbcSDL;
const executable = value => value.includes('/') ? resolve(value) : value;
const cc = executable(process.env.CC || 'gcc'), nasm = executable(process.env.NASM || 'nasm');
const triplet = {'linux-x64': 'x86_64-linux-gnu', 'linux-arm64': 'aarch64-linux-gnu', 'linux-armv7': 'arm-linux-gnueabihf'}[target.name];
const prefix = resolve(process.env.CRISP_BASIC_SDL_PREFIX || '/usr');
const libdir = resolve(process.env.CRISP_BASIC_SDL_LIBDIR || join(prefix, 'lib', triplet));
const env = {...process.env, TMPDIR: join(root, '.build/tmp')};
for (const dir of [work, output, env.TMPDIR]) mkdirSync(dir, {recursive: true});
const run = (command, args, options = {}) => execFileSync(command, args, {cwd: work, env, stdio: 'inherit', ...options});
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const git = args => execFileSync('git', ['-C', checkout, ...args], {env, maxBuffer: 16 << 20});
if (!existsSync(join(checkout, '.git'))) run('git', ['clone', '--filter=blob:none', '--no-checkout', lock.repository, checkout]);
try { git(['cat-file', '-e', lock.commit + '^{commit}']); }
catch { run('git', ['-C', checkout, 'fetch', 'origin', lock.commit]); }
for (const file of lock.files) {
    const bytes = git(['show', `${lock.commit}:${file.path}`]);
    if (digest(bytes) !== file.sha256) throw new Error('SDL source digest mismatch: ' + file.path);
    const path = join(work, file.path); mkdirSync(dirname(path), {recursive: true});
    writeFileSync(path, patchSDLSource(file.path, bytes.toString('utf8')));
}
copyFileSync(join(root, 'sdl/source-loader.h'), join(work, 'include/source-loader.h'));
const includes = ['-I', join(work, 'include'), '-I', join(prefix, 'include'), '-I', join(prefix, 'include/SDL2'), '-I', join(prefix, 'include', triplet)];
const common = ['-Wall', '-pthread', '-Wno-unused-result', '-Wno-array-bounds', ...target.flags, ...includes];
const core = ['bbmain', 'bbexec', 'bbeval'];
const names = [...core, 'bbcmos', 'bbccli', 'bbcvdu', 'bbcvtx', 'bbcsdl', 'flood',
    ...(target.name === 'linux-arm64' ? ['sort'] : []), 'SDL2_gfxPrimitives', target.assemblerSource];
const objects = [];
for (const name of names) {
    const flags = core.includes(name) ? ['-O2', '-freg-struct-return', '-ffast-math', '-fno-finite-math-only'] : ['-O2'];
    if (name === 'bbeval') flags.push('-fmath-errno');
    if (target.name === 'linux-armv7' && ['bbexec', 'bbcvdu'].includes(name)) flags.push('-DARMHF');
    if (target.name === 'linux-armv7' && name === 'bbcmos') flags.push('-mfpu=neon');
    const object = join(work, name + '.o');
    run(cc, [...common, ...flags, '-c', join(work, 'src', name + '.c'), '-o', object]); objects.push(object);
}
const data = join(work, 'bbdata.o');
if (target.nasm) run(nasm, ['-f', 'elf64', join(work, 'src', target.dataSource), '-o', data]);
else run(cc, [...target.flags, '-c', join(work, 'src', target.dataSource), '-o', data]);
objects.push(data);
const stb = join(work, 'SDL2_rotozoom.o');
run(cc, [...common, '-Os', '-fPIC', '-c', join(work, 'src/SDL2_rotozoom.c'), '-o', stb]);
run(cc, [...target.flags, '-shared', '-o', join(output, 'libstb.so'), stb]);
const runtime = join(output, 'bbcsdl');
run(cc, [...common, ...objects, '-L', output, '-L', libdir, '-lstb', '-lSDL2', '-lSDL2_ttf', '-lSDL2_net', '-lz', '-ldl', '-lm',
    '-Wl,-rpath,$ORIGIN', '-Wl,-z,noexecstack', '-rdynamic', '-o', runtime]);
run(cc, ['-std=c99', '-Wall', '-Wextra', '-O2', ...target.flags, '-o', join(output, 'launcher'), join(root, 'sdl/launcher.c')]);
verifyNativeBinary(readFileSync(runtime), target); verifyNativeBinary(readFileSync(join(output, 'launcher')), target);
const entries = [];
const add = (path, bytes, executable = false) => {
    const file = join(output, path); mkdirSync(dirname(file), {recursive: true}); writeFileSync(file, bytes);
    entries.push({path, sha256: digest(bytes), bytes: bytes.length, executable});
};
for (const path of ['bbcsdl', 'libstb.so']) add(path, readFileSync(join(output, path)), path === 'bbcsdl');
for (const soname of ['libSDL2-2.0.so.0', 'libSDL2_ttf-2.0.so.0', 'libSDL2_net-2.0.so.0']) {
    const path = join(libdir, soname);
    if (!existsSync(path)) throw new Error(`Missing SDL runtime ${path}; install matching target runtime libraries`);
    const bytes = readFileSync(path); verifyNativeBinary(bytes, target); add(soname, bytes);
}
add('notices/BBCSDL-LICENSE.txt', readFileSync(join(work, 'licence.txt')));
add('notices/CrispBASIC-LICENSE.txt', readFileSync(join(root, 'LICENSE')));
for (const packageName of ['libsdl2-dev', 'libsdl2-ttf-dev', 'libsdl2-net-dev']) {
    const notice = join(prefix, 'share/doc', packageName, 'copyright');
    if (!existsSync(notice)) throw new Error(`Missing SDL redistribution notice ${notice}; provide a prefix with development-package copyright files`);
    add(`notices/${packageName}.txt`, readFileSync(notice));
}
// Preserve the original complete notices in the compiled third-party sources.
for (const path of ['include/SDL2_gfxPrimitives_font.h', 'include/stb_image.h', 'include/dr_mp3.h', 'include/SDL_stbimage.h',
    'src/SDL2_gfxPrimitives.c', 'src/SDL2_rotozoom.c', 'src/flood.c']) add('notices/upstream/' + path, git(['show', `${lock.commit}:${path}`]));
const receipt = {
    schemaVersion: 1, format: 'crispbasic-sdl-runtime', target: target.name, upstreamCommit: lock.commit,
    profile: 'bbcsdl-full-native', architecture: target.architecture, compiler: run(cc, ['--version'], {stdio: 'pipe'}).toString().split('\n')[0],
    cpuRequirement: target.name === 'linux-armv7' ? 'ARMv7-A with NEON and hard-float ABI (upstream SDL audio mixer)' : target.architecture,
    crossCompiled: cross, launcher: {path: 'launcher', sha256: digest(readFileSync(join(output, 'launcher')))}, files: entries,
    systemDependencies: ['Linux ELF loader and glibc compatible with the build toolchain', 'zlib', 'FreeType and HarfBuzz',
        'SDL platform graphics/audio/input dependencies and drivers (as linked by the selected SDL build)'],
    excludedOptionalLibraries: ['Box2D and application-specific shared libraries; include explicitly when required'],
    resourcePolicy: 'Explicit application assets are relative to @dir$; additional runtime lib/ files may be included in the runtime pack'
};
writeFileSync(join(output, 'runtime.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log('Built full SDL runtime pack ' + output);
