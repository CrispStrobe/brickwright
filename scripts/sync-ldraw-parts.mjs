#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
// Vendor the Sim Lab's curated subset of the official LDraw parts library
// (docs/SIM-LAB-PLAN.md, tasks B1/D3).
//
// WHY VENDORED, NOT FETCHED AT BUILD TIME
// ---------------------------------------
// LDraw publishes the library as one `complete.zip` at a fixed URL whose
// contents change with every parts update (146 MB, 2026-09-30). A build-time
// fetch pinned by hash would break at the next LDraw release, and a build-time
// fetch NOT pinned by hash would ship whatever the URL served that day. So the
// subset we use — the parts (and reference assemblies) in bw-sim/part-meta/parts.json plus every subfile
// and primitive they reference, LDConfig.ldr and the licence texts — is
// committed under overlay/scratch-gui/static/ldraw/, unmodified, and
// static/ldraw/ldraw-lock.json records where it came from (the zip's sha256
// and date) and each file's sha256, LDraw release line and licence line.
// Refreshing is an explicit act: download and unzip a newer complete.zip and
// run this script against it.
//
// LICENCE
// -------
// Official LDraw parts are CC BY 4.0, dual CC BY 2.0 / CC BY 4.0, or (older
// files whose authors could not re-agree) CC BY 2.0 only — every one is
// attribution-only (CAreadme.txt, LDraw Contributor Agreement 2024-06-06).
// The script refuses any file whose `!LICENSE` line is not one of those, and
// any file that is not part of the official library (unofficial parts carry
// no such line). Every file keeps its own `Author`/`!LICENSE` header lines,
// and CAreadme.txt + both licence texts ship beside them.
//
// USAGE
//   node scripts/sync-ldraw-parts.mjs --from <dir containing ldraw/> \
//        --source-sha256 <sha256 of complete.zip> --source-date <YYYY-MM-DD>   # write
//   node scripts/sync-ldraw-parts.mjs --check                                   # verify, offline
//
// --check verifies, with no network: every locked file is present with its
// recorded hash; nothing unlocked sits in the tree; every part in parts.json
// resolves with its full closure inside the vendored tree; every file carries
// an accepted licence line.
//
// WHAT THIS SHIPS, for THIRD-PARTY-NOTICES.md: test/notices-drift.test.mjs reads this
// declaration (strict JSON) from every sync script that places an artifact under static/,
// and fails by name when the notices do not carry the name, licence and holder.
export const NOTICE = {"name":"LDraw Parts Library","licence":"CC BY 4.0","holder":"LDraw.org"};
import {readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname, join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkOwnedParts} from './sync-bw-material-parts.mjs';
import {flattenPart, parseLDraw} from '../overlay/scratch-gui/src/lib/bw-sim/ldraw/ldraw-geometry.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DEST = join(ROOT, 'overlay/scratch-gui/static/ldraw');
export const LOCK = join(DEST, 'ldraw-lock.json');
export const PART_META = join(ROOT, 'overlay/scratch-gui/src/lib/bw-sim/part-meta/parts.json');

/** Library files that ship beside the parts. */
export const EXTRA_FILES = Object.freeze(['LDConfig.ldr', 'CAreadme.txt', 'CAlicense.txt', 'CAlicense4.txt']);

/** The `!LICENSE` lines of the official library that this project accepts. */
export const ACCEPTED_LICENSES = Object.freeze([
    'Licensed under CC BY 4.0 : see CAreadme.txt',
    'Licensed under CC BY 2.0 and CC BY 4.0 : see CAreadme.txt',
    'Redistributable under CCAL version 2.0 : see CAreadme.txt'
]);

const sha256 = buf => createHash('sha256').update(buf).digest('hex');

/** LDraw files are ASCII/Latin-1 text; read them byte-preserving. */
const reader = libDir => {
    // The library's on-disk case differs between releases (parts/s vs parts/S);
    // build a lower-cased index once.
    const index = new Map();
    const walk = dir => {
        for (const name of readdirSync(join(libDir, dir))) {
            const rel = dir ? `${dir}/${name}` : name;
            if (statSync(join(libDir, rel)).isDirectory()) walk(rel);
            else index.set(rel.toLowerCase(), rel);
        }
    };
    for (const top of ['parts', 'p']) if (existsSync(join(libDir, top))) walk(top);
    return {
        read: p => {
            const real = index.get(p.toLowerCase());
            return real === undefined ? undefined : readFileSync(join(libDir, real), 'latin1');
        },
        real: p => index.get(p.toLowerCase())
    };
};

/** Every LDraw file parts.json needs: its parts, and the reference assemblies the metadata test reads. */
export const partList = () => {
    const meta = JSON.parse(readFileSync(PART_META, 'utf8'));
    return [...meta.parts.filter(p => !p.ownedGeometry).map(p => p.part), ...(meta.references ?? [])];
};

/** Closure of every listed part: library-relative lower-case paths. */
export const closureOf = (parts, read) => {
    const files = new Set();
    const missing = [];
    for (const part of parts) {
        const flat = flattenPart(part, read);
        for (const f of flat.files) files.add(f.toLowerCase());
        for (const m of flat.missing) missing.push(`${part}: ${m}`);
    }
    return {files: [...files].sort(), missing};
};

/** Header facts of one library file, and a refusal reason or null. */
export const judgeFile = (path, text) => {
    const {header} = parseLDraw(text);
    if (!header.ldrawOrg) return {header, problem: `${path}: no !LDRAW_ORG line (not an official library file)`};
    if (/^Unofficial/i.test(header.ldrawOrg)) return {header, problem: `${path}: unofficial (${header.ldrawOrg})`};
    if (!ACCEPTED_LICENSES.includes(header.license)) return {header, problem: `${path}: licence line not accepted: ${header.license ?? '(none)'}`};
    return {header, problem: null};
};

const write = (from, sourceSha256, sourceDate) => {
    const libDir = existsSync(join(from, 'ldraw')) ? join(from, 'ldraw') : from;
    const lib = reader(libDir);
    const {files, missing} = closureOf(partList(), lib.read);
    if (missing.length) throw new Error(`unresolved references:\n  ${missing.join('\n  ')}`);
    const problems = [];
    const lock = {
        $comment: 'Written by scripts/sync-ldraw-parts.mjs — do not edit by hand. The files listed here are unmodified copies from the official LDraw parts library.',
        source: {name: 'complete.zip', url: 'https://library.ldraw.org/library/updates/complete.zip', sha256: sourceSha256, date: sourceDate},
        files: {}
    };
    rmSync(DEST, {recursive: true, force: true});
    for (const f of files) {
        const buf = readFileSync(join(libDir, lib.real(f)));
        const {header, problem} = judgeFile(f, buf.toString('latin1'));
        if (problem) problems.push(problem);
        lock.files[f] = {sha256: sha256(buf), release: header.ldrawOrg, license: header.license, author: header.author ?? null};
        mkdirSync(dirname(join(DEST, f)), {recursive: true});
        writeFileSync(join(DEST, f), buf);
    }
    for (const f of EXTRA_FILES) {
        const buf = readFileSync(join(libDir, f));
        lock.files[f] = {sha256: sha256(buf)};
        writeFileSync(join(DEST, f), buf);
    }
    if (problems.length) {
        rmSync(DEST, {recursive: true, force: true});
        throw new Error(`refused:\n  ${problems.join('\n  ')}`);
    }
    writeFileSync(LOCK, `${JSON.stringify(lock, null, 1)}\n`);
    return lock;
};

/** @returns {string[]} problems; empty when the vendored tree matches its lock and covers parts.json. */
export const check = () => {
    const materialProblems = checkOwnedParts();
    const out = [];
    if (!existsSync(LOCK)) return [`${relative(ROOT, LOCK)} is missing; run the sync`];
    const lock = JSON.parse(readFileSync(LOCK, 'utf8'));
    const onDisk = new Set();
    const walk = dir => {
        for (const name of readdirSync(join(DEST, dir))) {
            const rel = dir ? `${dir}/${name}` : name;
            if (statSync(join(DEST, rel)).isDirectory()) walk(rel);
            else if (rel !== 'ldraw-lock.json') onDisk.add(rel);
        }
    };
    walk('');
    for (const [f, entry] of Object.entries(lock.files)) {
        if (!onDisk.has(f)) {
            out.push(`${f}: in the lock, not on disk`);
            continue;
        }
        const buf = readFileSync(join(DEST, f));
        if (sha256(buf) !== entry.sha256) out.push(`${f}: hash differs from the lock`);
        if (!EXTRA_FILES.includes(f)) {
            const {problem} = judgeFile(f, buf.toString('latin1'));
            if (problem) out.push(problem);
        }
    }
    for (const f of onDisk) if (!Object.hasOwn(lock.files, f)) out.push(`${f}: on disk, not in the lock`);
    const read = p => (onDisk.has(p.toLowerCase()) ? readFileSync(join(DEST, p.toLowerCase()), 'latin1') : undefined);
    const {files, missing} = closureOf(partList(), read);
    for (const m of missing) out.push(`closure: ${m} is not vendored`);
    for (const f of Object.keys(lock.files)) {
        if (!EXTRA_FILES.includes(f) && !files.includes(f)) out.push(`${f}: vendored but no part in parts.json needs it`);
    }
    return [...out, ...materialProblems];
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const {packRobotBuildLDraw} = await import('./pack-robot-build-ldraw.mjs');
    const args = process.argv.slice(2);
    const opt = name => {
        const i = args.indexOf(name);
        return i >= 0 ? args[i + 1] : undefined;
    };
    if (args.includes('--check')) {
        const problems = check();
        if (problems.length) {
            console.error(`sync:ldraw:check — ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
            process.exit(1);
        }
        packRobotBuildLDraw({check: true});
        console.log('sync:ldraw:check — vendored LDraw subset matches its lock and covers parts.json');
    } else {
        const from = opt('--from');
        const sum = opt('--source-sha256');
        const date = opt('--source-date');
        if (!from || !/^[0-9a-f]{64}$/.test(sum || '') || !/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
            console.error('usage: sync-ldraw-parts.mjs --from <dir> --source-sha256 <hex> --source-date <YYYY-MM-DD> | --check');
            process.exit(2);
        }
        const lock = write(from, sum, date);
        packRobotBuildLDraw();
        console.log(`sync:ldraw — vendored ${Object.keys(lock.files).length} files into ${relative(ROOT, DEST)}`);
    }
}
