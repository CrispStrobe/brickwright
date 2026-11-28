#!/usr/bin/env node
/**
 * Exclude registered optional-only payloads and known prohibited signatures
 * from the build output. This is not a complete dependency or licence audit.
 *
 * THE GATE THAT DID NOT EXIST. On 2026-08-10, commit 305893119 added SDCC as
 * WebAssembly ("add SDCC WASM binaries + headers (4.7 MiB, GPL-2+)") and
 * webpack.config.js copied `src/lib/sdcc-wasm/dist` to `static/sdcc-wasm`.
 * `apps/tauri/src-tauri/tauri.conf.json` sets frontendDist to this build
 * directory and bundles it wholesale, so the Mac TestFlight build shipped
 * GPL-2.0-or-later binaries inside a BSD-3-Clause application. Measured in CI's
 * own github-pages artifact on 2026-09-07: 101 files, 8.7 MB.
 *
 * Nothing caught it for four weeks because nothing looked. This looks.
 *
 * It checks the OUTPUT, not the config, because the config is only one of the
 * ways a file can arrive — a stray `static/` commit, a plugin, or a future copy
 * rule would all be invisible to a source-level assertion.
 */
import {existsSync, readdirSync, readFileSync, statSync, openSync, readSync, closeSync} from 'node:fs';
import {join, relative, resolve} from 'node:path';
import {gunzipSync, constants as zlibConstants} from 'node:zlib';
import {contentOffences} from './lib/lgpl-sparse-tripwire.mjs';
import {readRuntimePackageInventory, optionalPackageBuildExclusions} from './lib/runtime-package-inventory.mjs';

const build = resolve(process.argv[2] || 'packages/scratch-gui/build');
if (!existsSync(build)) {
    console.error(`no build at ${build} — build first, or pass the path`);
    process.exit(2);
}

// The inventory holds selected delivery decisions, including the JS glue as
// well as WASM. Generic members such as runtime.json are only excluded under
// their package directory. Known signatures below remain independent controls.
const {directories: FORBIDDEN_DIRS, filenames: FORBIDDEN_FILES} =
    optionalPackageBuildExclusions(readRuntimePackageInventory());

/**
 * GPL BOOT MEDIA, recognised by CONTENT, not by name: the Linux-on-RISC-V
 * lesson's kernel and initramfs (GPL-2.0 / LGPL-2.1) are fetched at run time
 * from brickwright-media-lab (lib/bw-machines/lessons.js) and must never be
 * copied into this output under any filename. A RISC-V Linux `Image` carries
 * the magic "RSC\x05" at byte 0x38 (Documentation/riscv/boot-image-header);
 * a newc initramfs starts "070701" (or "070702" with checksums). The lesson's
 * post-boot SNAPSHOT (the machine at the shell prompt, holding kernel and
 * BusyBox memory) starts "BWRV32S1" (bw-board src/riscv32-snapshot.js) — and is
 * shipped gzip'd, so a gzip stream is opened far enough to read that magic.
 */
const SNAPSHOT_MAGIC = 'BWRV32S1';
const bootMediaOffence = head => {
    if (head.length >= 8 && String.fromCharCode(...head.subarray(0, 8)) === SNAPSHOT_MAGIC) {
        return 'a RISC-V Linux machine snapshot (kernel + BusyBox memory, GPL-2.0) — fetched at run time, never bundled';
    }
    if (head.length >= 0x3c && head[0x38] === 0x52 && head[0x39] === 0x53 && head[0x3a] === 0x43 &&
        head[0x3b] === 0x05) {
        return 'a RISC-V Linux kernel Image (GPL-2.0) — fetched at run time from brickwright-media-lab, never bundled';
    }
    if (head.length >= 6 && /^07070[12]$/.test(String.fromCharCode(...head.subarray(0, 6)))) {
        return 'a cpio archive (an initramfs: BusyBox GPL-2.0, glibc LGPL-2.1) — fetched at run time, never bundled';
    }
    return null;
};
const headOf = file => {
    const fd = openSync(file, 'r');
    try {
        const buf = new Uint8Array(64);
        const n = readSync(fd, buf, 0, 64, 0);
        if (n < 2 || buf[0] !== 0x1f || buf[1] !== 0x8b) return buf.subarray(0, n);
        // gzip: what matters is what it inflates to. The first 64 KiB of the
        // stream is plenty for a 64-byte head; a truncated stream is fine
        // with SYNC_FLUSH, and anything that will not inflate is judged raw.
        const big = new Uint8Array(65536);
        const m = readSync(fd, big, 0, big.length, 0);
        try {
            const out = gunzipSync(big.subarray(0, m), {finishFlush: zlibConstants.Z_SYNC_FLUSH});
            return new Uint8Array(out.buffer, out.byteOffset, Math.min(64, out.length));
        } catch {
            return buf.subarray(0, n);
        }
    } finally { closeSync(fd); }
};

const offences = [];
const walk = dir => {
    for (const entry of readdirSync(dir, {withFileTypes: true})) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            const why = FORBIDDEN_DIRS.get(entry.name);
            if (why) {
                const n = countFiles(full);
                offences.push(`${relative(build, full)}/ — ${n} file(s): ${why}`);
                continue; // named once, not once per file
            }
            walk(full);
        } else if (FORBIDDEN_FILES.has(entry.name)) {
            offences.push(`${relative(build, full)} — ${FORBIDDEN_FILES.get(entry.name)}`);
        } else if (/blinkenrocket.*\.(?:hex|elf|eep|bin)$/i.test(entry.name)) {
            offences.push(`${relative(build, full)} — Blinkenrocket firmware images are GPL-3.0 and must remain external/user-supplied`);
        } else if (bootMediaOffence(headOf(full))) {
            offences.push(`${relative(build, full)} — ${bootMediaOffence(headOf(full))}`);
        } else if (/\.(m?js|cjs)$/.test(entry.name)) {
            // The LGPL sparse-solver family (KLU/CSparse, mathjs's sparse
            // module) arrives as JavaScript, so it is looked for in the bundles.
            for (const why of contentOffences(readFileSync(full, 'utf8'))) {
                offences.push(`${relative(build, full)} — ${why} (LGPL sparse-solver family; see scripts/lib/lgpl-sparse-tripwire.mjs)`);
            }
        }
    }
};
const countFiles = dir => readdirSync(dir, {withFileTypes: true})
    .reduce((n, e) => n + (e.isDirectory() ? countFiles(join(dir, e.name)) : 1), 0);

walk(build);

if (offences.length) {
    console.error(`Registered optional-only payload or known prohibited signature in the build output at ${build}:`);
    for (const line of offences) console.error(`  ${line}`);
    console.error('\nThis build directory is bundled into the .app by tauri.conf.json,');
    console.error('so these files violate Brickwright\'s bundled-payload policy.');
    if (offences.some(o => /sparse-solver/.test(o))) {
        console.error('The LGPL sparse-solver family (KLU, CSparse, mathjs\'s sparse module) must not be');
        console.error('used, ported or bundled — bw-board ROADMAP §"Backends and licence policy".');
        console.error('Find what imports it (the bundle\'s source map names the module) and remove it.');
    }
    if (offences.some(o => !/sparse-solver/.test(o))) {
        console.error('Check the runtime-package inventory and the external source for the reported payload.');
        console.error('Registered optional toolchains are downloaded on request, never copied into this build.');
    }
    process.exit(1);
}

const total = countFiles(build);
console.log(`No registered optional-only payloads or known prohibited signatures found: ${total} files checked under ${relative(process.cwd(), build) || '.'}.`);
console.log('Scope: selected package paths/names and known content signatures; not a complete dependency or licence audit.');
