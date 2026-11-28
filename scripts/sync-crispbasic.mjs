#!/usr/bin/env node
// Sync packages/crisp-basic/ from a local CrispStrobe/crispbasic checkout.
//
// CrispBASIC's upstream home is https://github.com/CrispStrobe/crispbasic,
// extracted with its history from this directory on 2026-11-28. Brickwright
// takes the whole package, unmodified: packages/crisp-basic/<path> is upstream
// <path> at the pin in vendor-pins.json, except the upstream repository-only
// paths (.github/, tools/; see scripts/lib/crispbasic-vendor.mjs).
// test/crispbasic-vendor-identity.test.mjs holds the copy to that.
//
//   --dir <path>  the crispbasic checkout to read (required; no network fetch).
//                 Its HEAD is the commit taken, unless --ref names another.
//   --ref <sha>   a commit in that checkout to take instead of HEAD.
//   --check       exit non-zero, writing nothing, if the copy differs.
//   --pin         record the taken commit in vendor-pins.json. A FILE SYNC NEVER
//                 MOVES THE PIN; without --pin a sync that would move it is
//                 refused before anything is written (scripts/lib-pin.mjs).
//
// The working-tree edits of the checkout are never read: content comes from
// the commit's Git objects, so what is written is exactly what the pin names.
import {mkdir, rm, writeFile, chmod} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {assertPinMoveAllowed, recordPin, FULL_SHA} from './lib-pin.mjs';
import {CRISPBASIC_DEST, CRISPBASIC_PIN_NAME, upstreamFiles, localFiles, diffFiles, readBlob} from './lib/crispbasic-vendor.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const value = name => { const i = argv.indexOf(name); return i === -1 ? undefined : argv[i + 1]; };
const dir = value('--dir');
const check = argv.includes('--check');
if (!dir) {
    console.error('usage: node scripts/sync-crispbasic.mjs --dir <crispbasic checkout> [--ref <sha>] [--check] [--pin]');
    process.exit(2);
}
const sha = execFileSync('git', ['-C', dir, 'rev-parse', `${value('--ref') || 'HEAD'}^{commit}`], {encoding: 'utf8'}).trim();
if (!FULL_SHA.test(sha)) throw new Error(`cannot resolve the crispbasic commit in ${dir}`);

const upstream = upstreamFiles(dir, sha);
const local = localFiles(ROOT);
const diffs = diffFiles(upstream, local);
if (check) {
    for (const d of diffs) console.log(`  ${d}`);
    if (diffs.length) { console.error(`\n${diffs.length} difference(s) from crispbasic@${sha}. Run: node scripts/sync-crispbasic.mjs --dir ${dir}`); process.exit(1); }
    console.log(`${CRISPBASIC_DEST} equals crispbasic@${sha} (${upstream.size} files).`);
    process.exit(0);
}

await assertPinMoveAllowed(CRISPBASIC_PIN_NAME, sha);
const dest = path.join(ROOT, CRISPBASIC_DEST);
for (const rel of local.keys()) {
    if (!upstream.has(rel)) { await rm(path.join(dest, rel)); console.log(`  removed ${rel}`); }
}
for (const [rel, u] of upstream) {
    const l = local.get(rel);
    if (l && l.oid === u.oid && l.mode === u.mode) continue;
    const out = path.join(dest, rel);
    await mkdir(path.dirname(out), {recursive: true});
    await writeFile(out, readBlob(dir, u.oid));
    await chmod(out, u.mode === '100755' ? 0o755 : 0o644);
    console.log(`  ${l ? 'updated' : 'added'} ${rel}`);
}
await recordPin(CRISPBASIC_PIN_NAME, sha);
console.log(`\nsynced ${CRISPBASIC_DEST} from crispbasic@${sha} (${upstream.size} files). `
    + 'Stage new/removed files with git add -A packages/crisp-basic.');
