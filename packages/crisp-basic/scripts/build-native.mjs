#!/usr/bin/env node
// Reproducible source inputs; output depends on the selected host toolchain.
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {patchUpstream} from '../native/patch-upstream.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = join(root, '.build');
const work = join(build, 'native');
const checkout = process.env.CRISP_BASIC_UPSTREAM ? resolve(process.env.CRISP_BASIC_UPSTREAM) : join(build, 'BBCSDL');
const lock = JSON.parse(readFileSync(join(root, 'upstream.lock.json'), 'utf8')).bbcSDL;
const executable = value => value.includes('/') ? resolve(value) : value;
const cc = executable(process.env.CC || 'gcc');
const nasm = executable(process.env.NASM || 'nasm');
const architecture = process.arch;
if (process.platform !== 'linux' || !['x64', 'arm64'].includes(architecture)) {
    throw new Error('The CrispBASIC native backend supports Linux x64 and ARM64. Use the WASM backend on other hosts.');
}
for (const folder of [build, work, join(work, 'src'), join(work, 'include'), join(build, 'tmp')]) {
    mkdirSync(folder, {recursive: true});
}
const env = {...process.env, TMPDIR: join(build, 'tmp')};
const run = (command, args, options = {}) => execFileSync(command, args, {
    cwd: work, env, stdio: 'inherit', ...options
});
try {
    run(cc, ['--version'], {stdio: 'pipe'});
    if (architecture === 'x64') run(nasm, ['--version'], {stdio: 'pipe'});
} catch {
    throw new Error(architecture === 'x64' ?
        'Install GCC and NASM, or set CC and NASM to their executable paths.' :
        'Install GCC and GNU binutils, or set CC to the native ARM64 compiler executable path.');
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
const assemblerSource = architecture === 'arm64' ? 'bbasmb_arm_64' : 'bbasmb_x86_64';
const dataSource = architecture === 'arm64' ? 'bbdata_arm_64.s' : 'bbdata_x86_64.nas';
const host = [assemblerSource, 'bbccos', 'bbccon'];
const objects = [];
for (const name of [...core, ...host]) {
    const object = join(work, name + '.o');
    const flags = core.includes(name) ? ['-O2', '-ffast-math', '-fno-finite-math-only'] : ['-Os'];
    if (name === 'bbeval') flags.push('-fmath-errno');
    run(cc, ['-Wall', '-Wno-array-bounds', '-Wno-unused-result', ...includes, ...flags,
        '-c', join(work, 'src', name + '.c'), '-o', object]);
    objects.push(object);
}
const data = join(work, 'bbdata.o');
if (architecture === 'arm64') {
    // The upstream rpi64 console makefile converts Mach-O symbol spelling to
    // ELF before assembling. The exact transformation is in patchUpstream.
    run(cc, ['-c', join(work, 'src', dataSource), '-o', data]);
} else {
    run(nasm, ['-f', 'elf64', join(work, 'src', dataSource), '-o', data]);
}
objects.push(data);
const hostObject = join(work, 'crispbasic.o');
run(cc, ['-Wall', '-Wextra', '-O2', ...includes, '-c', join(root, 'native', 'crispbasic.c'), '-o', hostObject]);
objects.push(hostObject);
const binary = join(build, 'crispbasic-native');
run(cc, [...objects, '-ldl', '-lm', '-lrt', '-pthread', '-Wl,-z,noexecstack', '-o', binary]);
writeFileSync(join(build, 'BBCSDL-LICENSE.txt'), readFileSync(join(work, 'licence.txt')));
writeFileSync(join(build, 'native-build.json'), JSON.stringify({
    version: 1, backend: 'bbcsdl-native', upstreamCommit: revision,
    platform: process.platform, architecture, target: `${process.platform}-${architecture}`,
    assemblerSource: `src/${assemblerSource}.c`, dataSource: `src/${dataSource}`,
    compiler: run(cc, ['--version'], {stdio: 'pipe'}).toString().split('\n')[0],
    assembler: architecture === 'x64' ? run(nasm, ['--version'], {stdio: 'pipe'}).toString().trim() :
        'GNU assembly via the selected C compiler',
    binarySha256: createHash('sha256').update(readFileSync(binary)).digest('hex')
}, null, 2) + '\n');
console.log('Built ' + binary);
