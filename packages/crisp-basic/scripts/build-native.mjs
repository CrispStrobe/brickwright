#!/usr/bin/env node
// Reproducible source inputs; output depends on the selected host toolchain.
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {patchUpstream} from '../native/patch-upstream.mjs';
import {hostNativeTarget, nativeTarget, verifyNativeBinary} from './native-targets.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = join(root, '.build');
const target = nativeTarget(process.env.CRISP_BASIC_TARGET || hostNativeTarget());
const cross = target.name !== hostNativeTarget();
const work = join(build, 'native', target.name);
const output = cross ? join(build, 'targets', target.name) : build;
const checkout = process.env.CRISP_BASIC_UPSTREAM ? resolve(process.env.CRISP_BASIC_UPSTREAM) : join(build, 'BBCSDL');
const lock = JSON.parse(readFileSync(join(root, 'upstream.lock.json'), 'utf8')).bbcSDL;
const executable = value => value.includes('/') ? resolve(value) : value;
const cc = executable(process.env.CC || 'gcc');
const nasm = executable(process.env.NASM || 'nasm');
const {architecture} = target;
if (process.platform !== 'linux') throw new Error('The native builder currently requires a Linux build host.');
if (cross && !process.env.CC) throw new Error('Cross-building requires an explicit CC for CRISP_BASIC_TARGET=' + target.name);
for (const folder of [build, output, work, join(work, 'src'), join(work, 'include'), join(build, 'tmp')]) {
    mkdirSync(folder, {recursive: true});
}
const env = {...process.env, TMPDIR: join(build, 'tmp')};
const run = (command, args, options = {}) => execFileSync(command, args, {
    cwd: work, env, stdio: 'inherit', ...options
});
try {
    run(cc, ['--version'], {stdio: 'pipe'});
    if (target.nasm) run(nasm, ['--version'], {stdio: 'pipe'});
} catch {
    throw new Error(target.nasm ?
        'Install GCC and NASM, or set CC and NASM to their executable paths.' :
        'Install GCC and GNU binutils, or set CC to the compiler executable for ' + target.name + '.');
}
if (!existsSync(join(checkout, '.git'))) {
    if (process.env.CRISP_BASIC_UPSTREAM) throw new Error('CRISP_BASIC_UPSTREAM must name a BBCSDL git checkout.');
    run('git', ['clone', '--filter=blob:none', '--no-checkout', lock.repository, checkout]);
}
const git = args => execFileSync('git', ['-C', checkout, ...args], {env, maxBuffer: 8 << 20});
try { git(['cat-file', '-e', lock.commit + '^{commit}']); }
catch { run('git', ['-C', checkout, 'fetch', 'origin', lock.commit]); }
const revision = git(['rev-parse', lock.commit + '^{commit}']).toString().trim();
if (revision !== lock.commit) throw new Error('BBCSDL commit verification failed.');
for (const file of lock.files) {
    const bytes = git(['show', lock.commit + ':' + file.path]);
    const actual = createHash('sha256').update(bytes).digest('hex');
    if (actual !== file.sha256) throw new Error('BBCSDL SHA-256 mismatch: ' + file.path);
    const output = join(work, file.path);
    mkdirSync(dirname(output), {recursive: true});
    writeFileSync(output, patchUpstream(file.path, bytes.toString('utf8')));
}
const includes = ['-I', join(work, 'include')];
const core = ['bbmain', 'bbexec', 'bbeval'];
const {assemblerSource, dataSource} = target;
const host = [assemblerSource, 'bbccos', 'bbccon'];
const objects = [];
for (const name of [...core, ...host]) {
    const object = join(work, name + '.o');
    const flags = core.includes(name) ? ['-O2', '-ffast-math', '-fno-finite-math-only'] : ['-Os'];
    if (name === 'bbeval') flags.push('-fmath-errno');
    // Upstream's ARMHF switch belongs to the SYS argument packer only.
    // Defining it for bbccon would enable its obsolete soft-float fallback,
    // corrupting subsequent floating arguments when the first is zero.
    if (target.name === 'linux-armv7' && name === 'bbexec') flags.push('-DARMHF');
    run(cc, ['-Wall', '-Wno-array-bounds', '-Wno-unused-result', ...target.flags, ...includes, ...flags,
        '-c', join(work, 'src', name + '.c'), '-o', object]);
    objects.push(object);
}
const data = join(work, 'bbdata.o');
if (!target.nasm) {
    // The upstream rpi64 console makefile converts Mach-O symbol spelling to
    // ELF before assembling. The exact transformation is in patchUpstream.
    run(cc, [...target.flags, '-c', join(work, 'src', dataSource), '-o', data]);
} else {
    run(nasm, ['-f', 'elf64', join(work, 'src', dataSource), '-o', data]);
}
objects.push(data);
const hostObject = join(work, 'crispbasic.o');
run(cc, ['-Wall', '-Wextra', '-O2', ...target.flags, ...includes, '-c', join(root, 'native', 'crispbasic.c'), '-o', hostObject]);
objects.push(hostObject);
const binary = join(output, 'crispbasic-native');
run(cc, [...target.flags, ...objects, '-ldl', '-lm', '-lrt', '-pthread', '-Wl,-z,noexecstack', '-o', binary]);
verifyNativeBinary(readFileSync(binary), target);
// The standalone bundle stub is the same interpreter and host, compiled with
// CRISP_BUNDLE: it runs the program appended to its own executable file.
const bundleObject = join(work, 'crispbasic-bundle.o');
run(cc, ['-Wall', '-Wextra', '-O2', '-DCRISP_BUNDLE', ...target.flags, ...includes, '-c',
    join(root, 'native', 'crispbasic.c'), '-o', bundleObject]);
const stub = join(output, 'crispbasic-bundle-stub');
run(cc, [...target.flags, ...objects.filter(object => object !== hostObject), bundleObject,
    '-ldl', '-lm', '-lrt', '-pthread', '-Wl,-z,noexecstack', '-o', stub]);
verifyNativeBinary(readFileSync(stub), target);
writeFileSync(join(output, 'BBCSDL-LICENSE.txt'), readFileSync(join(work, 'licence.txt')));
writeFileSync(join(output, 'native-build.json'), JSON.stringify({
    version: 1, backend: 'bbcsdl-native', upstreamCommit: revision,
    platform: 'linux', architecture, target: target.name,
    buildHost: `${process.platform}-${process.arch}`, crossCompiled: cross,
    compilerFlags: target.flags,
    assemblerSource: `src/${assemblerSource}.c`, dataSource: `src/${dataSource}`,
    compiler: run(cc, ['--version'], {stdio: 'pipe'}).toString().split('\n')[0],
    assembler: target.nasm ? run(nasm, ['--version'], {stdio: 'pipe'}).toString().trim() :
        'GNU assembly via the selected C compiler',
    binarySha256: createHash('sha256').update(readFileSync(binary)).digest('hex'),
    bundleStubSha256: createHash('sha256').update(readFileSync(stub)).digest('hex')
}, null, 2) + '\n');
console.log('Built ' + binary);
