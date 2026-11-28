/**
 * packages/crisp-basic/ IS CrispStrobe/crispbasic AT THE PIN.
 *
 * CrispBASIC's upstream home is its own repository (extracted with history on
 * 2026-11-28). Brickwright vendors the whole package unmodified, so the claim
 * is the strongest one available: every vendored file is the upstream blob at
 * vendor-pins.json's `crispbasic` commit, same mode, and no file exists on one
 * side only. The vendored set and the comparison live in
 * scripts/lib/crispbasic-vendor.mjs, shared with scripts/sync-crispbasic.mjs,
 * so the writer and the judge cannot disagree about which files count.
 *
 * WHO MAY JUDGE. Git blob identity needs only upstream TREES, so a bare
 * blobless clone is enough. The judge is CRISPBASIC_DIR (any checkout or clone
 * holding the pin), else BW_VENDOR_HISTORY_DIR/crispbasic.git, the bare clone
 * build.yml's vendor-history step makes. With neither, the comparison is
 * SKIPPED BY NAME. It is never passed on an empty set: the upstream listing is
 * asserted non-empty and to contain the package's own markers.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {CRISPBASIC_PIN_NAME, CRISPBASIC_UPSTREAM_ONLY, isVendored, upstreamFiles, localFiles, diffFiles} from '../scripts/lib/crispbasic-vendor.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const PIN = JSON.parse(readFileSync(path.join(ROOT, 'vendor-pins.json'), 'utf8'))[CRISPBASIC_PIN_NAME];

const judge = () => {
    if (process.env.CRISPBASIC_DIR) return {dir: process.env.CRISPBASIC_DIR, named: 'CRISPBASIC_DIR'};
    const bare = process.env.BW_VENDOR_HISTORY_DIR && path.join(process.env.BW_VENDOR_HISTORY_DIR, 'crispbasic.git');
    if (bare && existsSync(bare)) return {dir: bare, named: 'BW_VENDOR_HISTORY_DIR/crispbasic.git'};
    return null;
};
const holdsPin = dir => {
    try { execFileSync('git', ['-C', dir, 'cat-file', '-e', `${PIN}^{commit}`], {stdio: 'ignore'}); return true; } catch { return false; }
};

test('vendor-pins.json pins crispbasic to a full sha', () => {
    assert.match(PIN || '', /^[0-9a-f]{40}$/, 'vendor-pins.json has no full-sha crispbasic pin');
});

test('the vendored set excludes only the upstream repository-only paths', () => {
    assert.deepEqual([...CRISPBASIC_UPSTREAM_ONLY], ['.github/', 'tools/']);
    assert.equal(isVendored('.github/workflows/ci.yml'), false);
    assert.equal(isVendored('tools/sync-from-brickwright.mjs'), false);
    for (const rel of ['package.json', 'LICENSE', 'THIRD-PARTY-NOTICES.md', 'native/BBCSDL-LICENSE.txt', 'upstream.lock.json', 'src/index.mjs']) {
        assert.equal(isVendored(rel), true, rel);
    }
});

test('the copy carries the package licence and upstream notices', () => {
    const local = localFiles(ROOT);
    assert.ok(local.size > 50, `packages/crisp-basic lists only ${local.size} tracked files`);
    for (const rel of ['LICENSE', 'THIRD-PARTY-NOTICES.md', 'native/BBCSDL-LICENSE.txt', 'upstream.lock.json', 'wasm/toolchain.lock.json']) {
        assert.ok(local.has(rel), `packages/crisp-basic/${rel} is missing`);
    }
});

test('packages/crisp-basic equals CrispStrobe/crispbasic at the pin', t => {
    const j = judge();
    if (!j) { t.skip('no crispbasic clone: set CRISPBASIC_DIR, or BW_VENDOR_HISTORY_DIR with crispbasic.git (build.yml does)'); return; }
    assert.ok(holdsPin(j.dir), `${j.named} (${j.dir}) does not hold the pinned commit ${PIN}; fetch it`);
    const upstream = upstreamFiles(j.dir, PIN);
    assert.ok(upstream.size > 50, `upstream lists only ${upstream.size} vendored files at ${PIN}`);
    for (const marker of ['package.json', 'LICENSE', 'native/BBCSDL-LICENSE.txt']) assert.ok(upstream.has(marker), `upstream has no ${marker}`);
    const diffs = diffFiles(upstream, localFiles(ROOT));
    assert.deepEqual(diffs, [], `packages/crisp-basic differs from crispbasic@${PIN}. `
        + 'Change CrispBASIC upstream, then run: node scripts/sync-crispbasic.mjs --dir <crispbasic checkout> --pin');
});
