#!/usr/bin/env node
// Sync the gallery examples from sb3-creator into overlay/scratch-gui/examples/.
//
// The examples gallery (index.json + per-example directories with program.bw,
// circuit.json, EXPECTED.md) is maintained in sb3-creator and vendored here.
// sb3-creator's index.json carries computed `devices` and `refusals` fields that
// the ExamplesBrowser uses to grey out incompatible examples — without them, every
// example shows as available for every device.
//
// Same contract as the other sync-*.mjs scripts:
//
//   --check      exit non-zero (without writing) if vendored files are stale.
//   --dir <path> read from a local sb3-creator checkout instead of over HTTP.
//   --pin        record the source sha in vendor-pins.json. A FILE SYNC NEVER MOVES THE
//                PIN; a pin moves only with --pin, and a sync that would move it without
//                --pin is a refusal that prints old and new sha, before anything is written.
//
// Override the HTTP source with SB3CREATOR_REF (branch/tag/sha), default "main".
//
// House vendor discipline: the entire tree is read into memory first. If any
// referenced file is missing the script fails before writing anything — no partial
// vendor.

import {readFile, writeFile, mkdir, readdir, rm, stat} from 'node:fs/promises';
import { resolveRef, recordPin, localSha, assertPinMoveAllowed, listTree } from './lib-pin.mjs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const REPO = 'CrispStrobe/sb3-creator';
const REF = process.env.SB3CREATOR_REF || 'main';
const here = path.dirname(fileURLToPath(import.meta.url));
const dest = path.join(here, '..', 'overlay', 'scratch-gui', 'examples');
const check = process.argv.includes('--check');
const dirIdx = process.argv.indexOf('--dir');
const srcDir = dirIdx !== -1 ? process.argv[dirIdx + 1] : null;

// Resolve the mutable name to a sha ONCE, before any content is read, then
// address every file by that sha. `main` on the raw CDN is a cached branch
// URL: it serves whatever it last saw, and this script fetches ~1500 example
// files across many minutes, so a branch-addressed run can straddle a push and
// vendor two different commits into one tree. A sha cannot. See lib-pin.mjs.
const remoteSha = srcDir ? null : (await resolveRef(REPO, REF)).sha;
// Before anything is written: a sync that would move the pin needs --pin (lib-pin.mjs).
if (!check) await assertPinMoveAllowed('sb3-creator', srcDir ? await localSha(srcDir) : remoteSha);
const RAW = `https://raw.githubusercontent.com/${REPO}/${remoteSha}`;

// ── helpers ──────────────────────────────────────────────────────────────────

async function readSource (rel) {
    if (srcDir) return readFile(path.join(srcDir, 'examples', rel));
    // Git path bytes are not URL syntax: preserve literal percent signs,
    // question marks and fragments, including names such as "%2e%2e".
    const encoded = rel.split('/').map(encodeURIComponent).join('/');
    const res = await fetch(`${RAW}/examples/${encoded}`);
    if (!res.ok) throw new Error(`fetch examples/${rel} @ ${remoteSha}: HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
}

// Discover all example directories and their files from a local checkout.
async function discoverLocal () {
    const root = path.join(srcDir, 'examples');
    const entries = await readdir(root, {withFileTypes: true});
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();
    const files = new Map(); // relative path → Buffer

    // index.json
    files.set('index.json', await readFile(path.join(root, 'index.json')));

    // READMEs, and the Codex manifest.
    //
    // curriculum.json is what turns the gallery into a curriculum: trails ->
    // chapters -> stations over these same examples. It was never synced, so
    // the app fetched a 404 and CircuitDesigner — which shows the Codex only
    // when handed BOTH examples and curriculum — silently fell back to the
    // grid. Optional like the READMEs: a source tree without one still syncs.
    for (const name of ['README.md', 'README.de.md', 'curriculum.json']) {
        try {
            files.set(name, await readFile(path.join(root, name)));
        } catch { /* optional */ }
    }

    // per-directory files
    for (const dir of dirs) {
        const dirPath = path.join(root, dir);
        const children = await readdir(dirPath);
        for (const child of children.sort()) {
            const rel = `${dir}/${child}`;
            files.set(rel, await readFile(path.join(dirPath, child)));
        }
    }
    return {dirs, files};
}

// Discover the same source set as the local walk, at one immutable commit.
// index.json names loadable assets, not every circuit variant or lesson file.
async function discoverRemote () {
    const sourcePaths = (await listTree(REPO, remoteSha))
        .filter(name => name.startsWith('examples/'))
        .map(name => name.slice('examples/'.length));
    const sourceSet = new Set(sourcePaths);
    if (!sourceSet.has('index.json')) throw new Error('source tree has no examples/index.json');

    const dirs = new Set();
    const perDirectory = [];
    for (const rel of sourcePaths) {
        const parts = rel.split('/');
        if (rel.includes('\\') || parts.some(part => !part || part === '.' || part === '..')) {
            throw new Error(`invalid example tree path: ${rel}`);
        }
        if (parts.length > 2) {
            // discoverLocal reads each immediate child as a file and refuses
            // nested directories. Do not silently omit them in remote mode.
            throw new Error(`nested example path is unsupported by local discovery: ${rel}`);
        }
        if (parts.length === 2) {
            dirs.add(parts[0]);
            perDirectory.push(rel);
        }
    }

    const indexBytes = await readSource('index.json');
    const index = JSON.parse(indexBytes.toString('utf8'));
    const files = new Map([['index.json', indexBytes]]);
    for (const name of index.flatMap(entry => Object.values(entry.files || {}))) {
        if (typeof name !== 'string' || name.startsWith('/') || name.includes('\\') || name.split('/').includes('..')) {
            throw new Error(`invalid declared example path: ${String(name)}`);
        }
    }

    // Match discoverLocal's root-file policy: the other top-level files are
    // internal audit/TODO documents. Every file inside a lesson is included,
    // even when the lesson or circuit variant is absent from index.json.
    const rootFiles = ['README.md', 'README.de.md', 'curriculum.json']
        .filter(name => sourceSet.has(name));
    for (const rel of [...rootFiles, ...perDirectory.sort()]) {
        // A listed file is required. An HTTP error must not turn it into an
        // apparent orphan that a subsequent mutation would delete.
        files.set(rel, await readSource(rel));
    }
    return {dirs: [...dirs].sort(), files};
}

// ── main ─────────────────────────────────────────────────────────────────────

const {dirs, files} = srcDir ? await discoverLocal() : await discoverRemote();

// Validate: every file path referenced in index.json must be in our tree.
const index = JSON.parse(files.get('index.json').toString('utf8'));
let missing = 0;
for (const entry of index) {
    if (!entry.files) continue;
    for (const [key, fpath] of Object.entries(entry.files)) {
        if (!files.has(fpath)) {
            console.error(`  MISSING ${entry.id}: files.${key} = ${fpath}`);
            missing++;
        }
    }
}
if (missing) {
    console.error(`\n${missing} referenced file(s) missing from source — aborting.`);
    process.exit(1);
}

console.log(`source: ${files.size} files across ${dirs.length} directories`);

// Compare against destination
let stale = 0;
let added = 0;
for (const [rel, buf] of files) {
    const destPath = path.join(dest, rel);
    let current = null;
    try { current = await readFile(destPath); } catch { /* doesn't exist */ }
    if (current && current.equals(buf)) continue;
    if (current === null) added++;
    stale++;
    if (check) {
        console.log(`  STALE ${rel}`);
    }
}

// Check for destination files that are no longer in source (excluding .gitkeep etc)
const IGNORE = new Set(['.gitkeep']);
async function listDest () {
    const result = [];
    try {
        const entries = await readdir(dest, {withFileTypes: true});
        for (const e of entries) {
            if (IGNORE.has(e.name)) continue;
            if (e.isDirectory()) {
                const children = await readdir(path.join(dest, e.name));
                for (const c of children) result.push(`${e.name}/${c}`);
            } else {
                result.push(e.name);
            }
        }
    } catch { /* dest doesn't exist yet */ }
    return result;
}

const destFiles = await listDest();
const orphans = destFiles.filter(f => !files.has(f));
if (orphans.length && check) {
    for (const f of orphans) console.log(`  ORPHAN ${f}`);
}

/**
 * Record the upstream commit, exactly as sync-sb3creator.mjs does.
 *
 * THIS SCRIPT DID NOT, and that was a hole rather than an omission. Two sync
 * scripts vendor from sb3-creator — this one (the examples gallery) and
 * sync-sb3creator.mjs (the compiler) — and vendor-freshness's PUSH run checks
 * lite's tree against whatever single sha `vendor-pins.json` names for the
 * repo. So vendoring examples forward moved 92 files while the pin stayed
 * where the last COMPILER sync left it, and CI reported all 92 stale against a
 * sha lite had deliberately moved past. Found 2026-08-24, by that CI run.
 *
 * One repo, one pin: vendoring either half from a commit commits lite to the
 * other half from the same commit. That is the truth of a single-repo
 * upstream, and writing the pin here makes the tooling say so.
 *
 * Called on the NO-OP path too. A sync that found nothing to write has still
 * established that lite's examples match this commit, and that is exactly the
 * fact the pin records — leaving it unwritten there is how a correct tree keeps
 * a stale pin.
 *
 * REMOTE MODE RECORDS TOO. It did not, and `!srcDir` was the whole of the
 * reason: a remote sync had no sha to write because it fetched by branch name.
 * Now it resolves one before reading anything, so the asymmetry has no cause
 * left — and an unrecorded remote sync is precisely the state that made
 * "synced from sb3-creator@main" a sentence with no checkable content.
 */
async function writePin () {
    if (check) return;
    try {
        await recordPin('sb3-creator', srcDir ? await localSha(srcDir) : remoteSha);
    } catch (e) { console.warn(`  (pin not recorded: ${e.message})`); }
}

if (check) {
    if (stale || orphans.length) {
        console.error(`\n${stale} stale, ${orphans.length} orphan(s) — run: npm run sync:examples`);
        process.exit(1);
    }
    console.log('\nexamples up to date.');
    process.exit(0);
}

if (!stale && !orphans.length) {
    console.log('examples up to date.');
    await writePin();
    process.exit(0);
}

// Write phase: ensure directories exist, then write all files
const dirSet = new Set();
for (const rel of files.keys()) {
    const dir = path.dirname(rel);
    if (dir !== '.') dirSet.add(dir);
}
for (const d of dirSet) {
    await mkdir(path.join(dest, d), {recursive: true});
}

for (const [rel, buf] of files) {
    await writeFile(path.join(dest, rel), buf);
}

// Remove orphans
for (const f of orphans) {
    await rm(path.join(dest, f), {force: true});
}
// Remove empty orphan directories
for (const f of orphans) {
    const dir = path.dirname(f);
    if (dir === '.') continue;
    try {
        const remaining = await readdir(path.join(dest, dir));
        if (remaining.length === 0) await rm(path.join(dest, dir), {recursive: true});
    } catch { /* already gone */ }
}

console.log(`wrote ${stale} file(s) (${added} new), removed ${orphans.length} orphan(s).`);
// The sha, not the label. `${srcDir ? 'local' : REF}` named neither a commit
// nor a place — "local" identifies nothing at all, and REF is the part of the
// sentence that moves.
console.log(`\nsynced from ${REPO}@${srcDir ? await localSha(srcDir) : remoteSha}`
    + `${srcDir ? ` (local checkout ${srcDir})` : ` (resolved from ${REF})`}. `
    + `${index.length} examples in index.`);

await writePin();
