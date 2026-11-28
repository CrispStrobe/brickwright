#!/usr/bin/env node
// Sync the vendored SB3 Creator compiler from its source repo into the overlay.
//
// The Code tab reuses files that live in the separate sb3-creator project. We vendor
// copies under overlay/scratch-gui/src/lib/ so the editor has no cross-repo import —
// which means they can drift. Run `npm run sync:sb3creator` to refresh them, then
// `npm run integrate` to copy the overlay over the vendored scratch-gui in packages/.
//
// Same contract as mainline brickwright's scripts/sync-sb3creator.mjs; only the
// destination differs (we overlay, mainline owns src/lib directly).
//
//   --check      exit non-zero (without writing) if a vendored file is stale,
//                for CI drift detection.
//   --dir <path> read the source files from a local sb3-creator checkout instead of
//                fetching over HTTP (deterministic; no CDN lag).
//   --pin        record the source sha in vendor-pins.json. A FILE SYNC NEVER MOVES THE
//                PIN; a pin moves only with --pin, and a sync that would move it without
//                --pin is a refusal that prints old and new sha, before anything is written.
//
// Override the HTTP source with SB3CREATOR_REF (branch/tag/sha), default "main".
//
// REMOTE MODE FETCHES BY RESOLVED SHA, never by the branch name. `main` is a
// mutable name and raw.githubusercontent caches branch URLs for minutes, so
// fetching it quotes a freshness it does not have — the exact failure that
// vendored a stale bw-board on 2026-08-23 while printing "@master". The
// commits API resolves the name once; every file after that is fetched from an
// immutable URL, and the sha is written to vendor-pins.json so a later reader
// can tell what was taken. See scripts/lib-pin.mjs.

import {readFile, writeFile} from 'node:fs/promises';
import { guardSource } from './lib-source-guard.mjs';
import { resolveRef, recordPin, localSha, baseForFile, assertPinMoveAllowed } from './lib-pin.mjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileP = promisify(execFile);
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import { applySb3CreatorRewrites } from './lib/vendor-rewrites.mjs';
import { mirrorIntoPackages } from './lib/mirror-pairs.mjs';

const REPO = 'CrispStrobe/sb3-creator';
const REF = process.env.SB3CREATOR_REF || 'main';
const here = path.dirname(fileURLToPath(import.meta.url));
const lib = path.join(here, '..', 'overlay', 'scratch-gui', 'src', 'lib');
const cliLib = path.join(here, 'lib', 'vendor');
const check = process.argv.includes('--check');
// Lite intentionally carries a small downstream UI/asset dialect on top of the
// shared compiler. Freshness CI passes this flag so it can report that delta
// without pretending it is an upstream-sync failure.
const allowStale = process.argv.includes('--allow-stale');
const dirIdx = process.argv.indexOf('--dir');
const srcDir = dirIdx !== -1 ? process.argv[dirIdx + 1] : null;
if (dirIdx !== -1 && srcDir) guardSource(srcDir);

// Resolve BEFORE the first content fetch, so nothing is ever read by name.
const remoteSha = srcDir ? null : (await resolveRef(REPO, REF)).sha;
// Before anything is written: a sync that would move the pin needs --pin (lib-pin.mjs).
if (!check) await assertPinMoveAllowed('sb3-creator', srcDir ? await localSha(srcDir) : remoteSha);

// The pin the vendored copy currently came from — the third point of the
// three-way comparison below. Read from vendor-pins.json BEFORE this run
// overwrites it.
const OLD_PIN = await readFile(new URL('../vendor-pins.json', import.meta.url), 'utf8')
    .then((t) => JSON.parse(t)['sb3-creator'] ?? null)
    .catch(() => null);
const RAW = `https://raw.githubusercontent.com/${REPO}/${remoteSha}`;

// [source path relative to the sb3-creator repo, local vendored destination]
const FILES = [
    ['scripts/lib/assert-blocks.mjs', path.join(cliLib, 'sb3-assert-blocks.mjs')],
    ['src/utils/cardiacProgram.js', path.join(lib, 'cardiac-program.js')],
    ['src/utils/cardiacExamples.js', path.join(lib, 'cardiac-examples.js')],
    ['src/utils/cp1Program.js', path.join(lib, 'cp1-program.js')],
    ['src/utils/sb3Creator.js', path.join(lib, 'sb3-creator.js')],
    ['src/utils/procedureParameterConstraints.js', path.join(lib, 'procedureParameterConstraints.js')],
    // The referee: reference trace interpreter + comparator (corpus-and-oracles.md).
    ['src/utils/traceOracle.js', path.join(lib, 'trace-oracle.js')],
    ['src/utils/examples.js', path.join(lib, 'sb3-creator-examples.js')],
    ['src/utils/pythonToPseudocode.js', path.join(lib, 'sb3-creator-python.js')],
    // MicroPython for a board -- micro:bit and Pico. Reached THROUGH the Python
    // entry point, which routes on the import line, so the importer's Python
    // tab takes either without the user choosing.
    ['src/utils/micropythonToPseudocode.js', path.join(lib, 'sb3-creator-micropython.js')],
    // LEGO SPIKE App 3 Python, reached the same way: the Python entry point
    // routes a program that imports runloop / hub / motor… here.
    ['src/utils/spike3Python.js', path.join(lib, 'sb3-creator-spike3.js')],
    // The MicroPython raw-REPL deploy protocol (transport-agnostic; the
    // app supplies webSerialTransport(port) — Chromium only, so the UI
    // must degrade to a main.py download elsewhere).
    ['src/utils/picoRepl.js', path.join(lib, 'pico-repl.js')],
    ['src/utils/javascriptToPseudocode.js', path.join(lib, 'sb3-creator-javascript.js')],
    ['src/utils/cToPseudocode.js', path.join(lib, 'sb3-creator-c.js')],
    ['src/utils/runtimeRegistry.generated.js', path.join(lib, 'sb3-creator-runtime.js')],
    ['src/utils/scratchRuntime.js', path.join(lib, 'sb3-creator-scratchruntime.js')],
    ['src/utils/cHostRuntime.js', path.join(lib, 'sb3-creator-chostruntime.js')],
    ['src/utils/cHostToPseudocode.js', path.join(lib, 'sb3-creator-chost.js')],
    ['src/utils/basicToPseudocode.js', path.join(lib, 'sb3-creator-basic.js')],
    ['src/utils/cubeDirections.js', path.join(lib, 'cubeDirections.js')],
    // The DEVICE EV3 word table, read by sb3Creator.js in both directions.
    ['src/utils/ev3Dialect.js', path.join(lib, 'ev3Dialect.js')],
    // Canonical Circuit Playground Express words are part of the shared compiler.
    ['src/utils/cpxDialect.js', path.join(lib, 'cpxDialect.js')],
    // The MakeCode Arcade / array-reference word table (task E0), the same design.
    ['src/utils/arcadeDialect.js', path.join(lib, 'arcadeDialect.js')],
    ['src/utils/cpxDialect.js', path.join(lib, 'cpxDialect.js')],
    // The pin-role PART table (HCSR04 / DS18B20 / DS3231 / AT24C02 / I2C), read by
    // sb3Creator.js and the C reader (sb3-creator #52).
    ['src/utils/pinRoleParts.js', path.join(lib, 'pinRoleParts.js')],
    // Game export: the current project -> a playable JS web game or a Python +
    // pygame project (sb3-creator docs/GAME-EXPORT.md). The runtime files travel
    // inside sources.generated.js, so the app needs no other upstream file.
    ['src/game/model.js', path.join(lib, 'sb3-creator-game-model.js')],
    ['src/game/emit.js', path.join(lib, 'sb3-creator-game-emit.js')],
    ['src/game/export.js', path.join(lib, 'sb3-creator-game-export.js')],
    ['src/game/runtime/sources.generated.js', path.join(lib, 'sb3-creator-game-sources.js')],
    // Costume rasters for pixel collisions and touching colour; the app rasterizes
    // with its own canvas (rasterizeInPage), so no browser dependency is added.
    ['src/game/raster.js', path.join(lib, 'sb3-creator-game-raster.js')]
];

// Downstream-only modules imported by synced compiler files. EMPTY, with no stated
// remainder: the SHAPE art dialect was upstreamed as an injectable registry
// (sb3-creator fdb1334), so no vendored file imports a downstream-only module any
// more and the forward resolve check has nothing to whitelist.
//
// The reverse orphan check below is deliberately KEPT rather than deleted. With an
// empty list it is inert, not gone — and it is the only thing that can see a
// silently-eaten downstream delta, because a sync that drops lite's dialect passes
// every other check here: every import it leaves behind still resolves, since there
// are none. That cost a day to learn (14 red tests, three commits and one push after
// the cause). The next downstream module will want it.
//
// The artwork itself stays lite's, and the app injects it through
// lib/sb3-creator-register-art.js — asserted at the bottom of this file, and more
// completely by test/vector-art-registration.test.mjs, which holds the stronger
// property that NO module under overlay/ can reach the compiler around that door.
const LOCAL_FILES = [];

async function readSource (rel) {
    if (srcDir) return readFile(path.join(srcDir, rel), 'utf8');
    const res = await fetch(`${RAW}/${rel}`);
    if (!res.ok) throw new Error(`fetch ${rel} @ ${remoteSha}: HTTP ${res.status}`);
    return res.text();
}

// Cross-file imports use the source repo's filenames; rewrite them to the vendored
// names (e.g. javascriptToPseudocode.js imports pythonToPseudocode.js).
//
// IMPORTED FROM scripts/lib/vendor-rewrites.mjs, NOT DEFINED HERE. The table used
// to live in this file — and this file does its work at import time, so no test
// could read it. That is exactly why sb3-creator had no judge-test while
// bw-board and bw-circuit-ui did: a gate cannot check a transformation it has no
// way to apply. vendor-identity.test.mjs carried the note "sb3-creator already
// has a CI pin-proof though no judge-test consumes it yet" for months because of
// where these six lines sat.
//
// Now the sync and test/sb3-creator-vendor-identity.test.mjs read one table, so
// a rewrite added to one cannot go missing from the other.
const rewriteImports = applySb3CreatorRewrites;

// REFUSE TO DELETE WORK THAT EXISTS ONLY HERE.
//
// This sync overwrote every file wholesale with no direction check. lego-ac
// filed one symptom -- a lite-only `i8086_counter` example that every sync
// deleted -- and deriving the set rather than trusting the count found FIVE:
// i8086_analog, i8086_blink, i8086_counter, i8086_events, i8086_keypad. lite
// has 40 example keys, sb3-creator has 35, and the five extra are the whole
// 8086 family.
//
// UPSTREAMING THEM WAS THE OBVIOUS FIX AND IT IS THE WRONG ONE. sb3-creator
// has NO i8086 support at all -- zero references in src/, every example
// `DEVICE STC12C5A60S2`. Moving them there puts content in a repository whose
// own tooling cannot parse it: present, unverifiable, and indistinguishable
// from working. The examples are lite-only because the DEVICE is lite-only.
//
// So the fix is the same one sync-bw-board.mjs got today: derive the direction
// from content on every run, and refuse. It protects every file this script
// touches, not just the one whose loss someone happened to notice -- which is
// the whole argument, since the reason a curated list fails is that it
// enumerates what you already know.
/**
 * THREE-WAY, NOT TWO-WAY, and the difference is whether this gate survives.
 *
 * The first version compared the vendored copy against the INCOMING one and
 * called every line that did not appear in the incoming "lost". That is wrong
 * for the ordinary case: when upstream EDITS a line that existed in both, the
 * old text is absent from the incoming and the rule reports it as lite-only
 * work about to be deleted.
 *
 * lego-ac measured it on the real bump this gate was about to meet --
 * sb3-creator eb5b286 -> fdd9d7d, 14 files -- and it called SIX lines lost
 * (1 in sb3Creator.js, 5 in micropythonToPseudocode.js), every one of them
 * upstream's own edit. So every ordinary bump would have needed --force, and
 * --force deletes the five lite-only i8086 examples this exists to protect.
 * A gate that must be bypassed to do the normal thing is a gate people learn
 * to bypass, and then it is not there for the abnormal thing either.
 *
 * THE THIRD POINT IS THE OLD PINNED VERSION. A line is lite-only if it is in
 * the vendored copy and was NOT in the upstream file at the pin the vendored
 * copy came from. Only those lines matter, and only their absence from the
 * incoming is a loss. Upstream editing its own line changes the incoming, not
 * the lite-only set, so it no longer fires.
 *
 * Falls back to the two-way rule when the old pinned version cannot be read
 * (no local checkout of that sha, a first-ever sync) -- and SAYS SO, because
 * a guard that quietly becomes stricter is worse than one that is loud about
 * which rule it applied.
 */
const linesLostBy = (current, next, base) => {
    const norm = (t) => t.split('\n').map((l) => l.trim());
    const trivial = (l) => !l || l === '}' || l === '};' || l === '{';
    const incoming = new Set(norm(next));
    const liteOnly = base === null
        ? norm(current)                                  // fallback: two-way
        : (() => { const b = new Set(norm(base)); return norm(current).filter((l) => !b.has(l)); })();
    return liteOnly.filter((l) => !trivial(l) && !incoming.has(l));
};

/** The file as it stood at the pin the vendored copy was taken from. */
const atOldPin = async (rel) => {
    if (!srcDir || !OLD_PIN) return null;
    try {
        const {stdout} = await execFileP('git', ['-C', srcDir, 'show', `${OLD_PIN}:${rel}`],
            {maxBuffer: 32 * 1024 * 1024});
        return stdout;
    } catch { return null; }        // not fetched, or the file did not exist then
};
const force = process.argv.includes('--force');
const wouldTruncate = [];
let warnedFallback = false;

// THE PIN MUST STILL BE THE OLD ONE WHEN THIS RUNS, and that is checkable
// rather than merely documented.
//
// The three-way comparison's base is `git show <pin>:<file>` — the file as it
// stood at the pin the vendored copy came from. If the pin has ALREADY been
// moved to the sha being synced (say, resolved by hand during a rebase
// conflict, which is exactly how I did it), the base becomes the INCOMING
// file. Every line upstream deleted then looks lite-only, and every line it
// added looks like work about to be lost. The guard inverts.
//
// It fails in the direction that makes the guard look broken rather than
// permissive, which is the safer half — but it is silent, and a maintainer
// reading four bogus refusals concludes the rule is wrong rather than that
// the pin moved early. So: say so, by name.
//
// The script records the new pin itself at the end. Nothing should set it
// beforehand.
const pinAlreadyMoved = async () => {
    // Never under --check: a check writes nothing, so the ordering hazard cannot
    // apply, and the nightly freshness workflow checks out each upstream AT the
    // pin, where HEAD == pin is the healthy state, not a moved pin (the first
    // nightly after this guard landed exited 2 on both vendor steps). Inside the
    // guard, not at the call site, so the next caller cannot forget it.
    if (check) return false;
    if (!srcDir || !OLD_PIN) return false;
    try {
        const {stdout} = await execFileP('git', ['-C', srcDir, 'rev-parse', 'HEAD']);
        return stdout.trim() === OLD_PIN.trim();
    } catch { return false; }
};
// PER-FILE, BY CONTENT. See sync-bw-board.mjs for the argument: a pin is a
// claim about a SET, a base is a question about a FILE, and a scoped bump
// makes the two disagree. `baseForFile` finds the commit the vendored copy
// actually came from by walking that file's own history; the recorded pin is
// used only when no commit holds that content, which is the only case where
// the ordering hazard can still bite.
const WALK_FROM = srcDir ? await localSha(srcDir).catch(() => null) : null;

const baseFor = async (rel, current) => {
    const found = await baseForFile(srcDir, WALK_FROM, rel, current);
    if (found) return {text: found.text, sha: found.sha, byContent: true};
    const text = await atOldPin(rel);
    return text === null ? null : {text, sha: OLD_PIN, byContent: false};
};

let stale = 0;
for (const [remote, dest] of FILES) {
    const next = rewriteImports(await readSource(remote));
    const current = await readFile(dest, 'utf8').catch(() => null);
    if (current === next) {
        console.log(`  ok    ${path.basename(dest)}`);
        continue;
    }
    stale++;
    if (check) {
        console.log(`  STALE ${path.basename(dest)}  (differs from sb3-creator@${REF})`);
    } else {
        const resolved = force ? null : await baseFor(remote, current);
        if (resolved !== null && !resolved.byContent && await pinAlreadyMoved()) {
            console.error(`\n  PIN ALREADY MOVED, and ${path.basename(dest)} has no content base.`);
            console.error(`  No commit reachable from ${(WALK_FROM || '').slice(0, 9)} along this file's history`);
            console.error('  holds the vendored copy byte for byte, so the base falls back to the');
            console.error(`  recorded pin (${OLD_PIN.slice(0, 9)}) -- the sha this run is syncing FROM, so the`);
            console.error('  base would be the INCOMING file and every upstream edit would read as');
            console.error('  lite-only work being deleted. Restore the PREVIOUS pin and re-run;');
            console.error('  this script records the new one itself.');
            process.exit(2);
        }
        const base = resolved === null ? null : resolved.text;
        if (!force && base === null && current !== null && !warnedFallback) {
            warnedFallback = true;
            console.error('  NOTE: the old pinned version is not readable here, so the guard is');
            console.error('  using the two-way rule, which reports upstream\'s own edits as losses.');
            console.error(`  (git -C ${srcDir || '<no --dir>'} show ${OLD_PIN ? OLD_PIN.slice(0, 9) : '<no pin>'}:<file>)`);
        }
        // Upstream did not touch this file since the old pin: the vendored copy
        // differs from the incoming only by what lite added on top, and there
        // is nothing to sync. Keeping it is not a refusal -- a permanently
        // lite-only addition (the i8086 examples) must not make EVERY bump
        // refuse, or the guard becomes the thing people --force past.
        if (!force && base !== null && rewriteImports(base) === next && current !== null) {
            const kept = linesLostBy(current, next, base).length;
            console.log(`  kept  ${path.basename(dest)} (unchanged upstream since ${OLD_PIN.slice(0, 9)}; ${kept} lite-only line(s) preserved)`);
            continue;
        }
        const lost = force ? [] : linesLostBy(current ?? '', next, base);
        if (lost.length) {
            wouldTruncate.push({file: path.basename(dest), count: lost.length, sample: lost.slice(0, 3)});
            console.log(`  REFUSED ${path.basename(dest)} (would delete ${lost.length} line(s) that exist only here)`);
            continue;
        }
        await writeFile(dest, next);
        console.log(`  wrote ${path.basename(dest)}`);
    }
}

if (wouldTruncate.length) {
    const total = wouldTruncate.reduce((n, f) => n + f.count, 0);
    console.error(`\nREFUSED: ${total} line(s) in ${wouldTruncate.length} file(s) exist here and not upstream.\n`);
    for (const f of wouldTruncate) {
        console.error(`  ${f.file}  (${f.count} lines)`);
        for (const l of f.sample) console.error(`      - ${l.slice(0, 92)}`);
    }
    console.error('\n  A sync OVERWRITES the vendored copy, so every one of those lines would');
    console.error('  be gone. Nothing would fail: an example that stops existing is not a');
    console.error('  test failure, it is a menu with fewer entries, which is why this went');
    console.error('  unnoticed long enough to be filed as a symptom rather than a defect.');
    console.error('\n  Measured from the content, not read from a list, so it stays true for');
    console.error('  files nobody has documented. If upstream genuinely supersedes this work,');
    console.error('  --force. Check the direction first.');
    process.exit(1);
}

// A hardcoded file list is only as good as the last person to edit it: a new
// module in sb3-creator would be missed here and surface as a webpack
// missing-module error far from the cause. So check that every relative import
// in what we just vendored actually resolves to something we vendored.
const vendored = new Set([...FILES.map(([, dest]) => path.basename(dest)), ...LOCAL_FILES]);
let unresolved = 0;
for (const [, dest] of FILES) {
    const text = await readFile(dest, 'utf8').catch(() => '');
    for (const m of text.matchAll(/from\s+['"](\.\/[^'"\n]+)['"]/g)) {
        const target = path.basename(m[1]);
        if (vendored.has(target)) continue;
        unresolved++;
        console.error(`  MISSING ${path.basename(dest)} imports ${m[1]} — add it to FILES`);
    }
}
if (unresolved) process.exit(1);

// The other direction: a downstream-only module that NOTHING imports any more.
// A sync that silently drops lite's dialect passes every check above — every
// import it left behind still resolves, because there are none.
if (!check) {
    const importers = new Map(LOCAL_FILES.map(f => [f, []]));
    for (const [, dest] of FILES) {
        const text = await readFile(dest, 'utf8').catch(() => '');
        for (const f of LOCAL_FILES) if (text.includes(`./${f}`)) importers.get(f).push(path.basename(dest));
    }
    const orphaned = [...importers].filter(([, who]) => who.length === 0).map(([f]) => f);
    if (orphaned.length) {
        console.error(`\nDOWNSTREAM DIALECT LOST: ${orphaned.join(', ')} is imported by nothing after`);
        console.error('this sync. The upstream file that used to import it was overwritten, so lite');
        console.error('just lost a feature it ships. Recover with a 3-way merge against the OLD pin:');
        console.error('  git merge-file <vendored> <upstream@oldpin> <upstream@newpin>');
        console.error('and then upstream the delta so the next sync does not have to.');
        process.exit(1);
    }
}

// Producer-must-assert-consumer for the upstream vector-art registry. Merely
// retaining the artwork file is not enough: without this host injection every
// game parses with an empty registry and refuses SHAPE art by name.
const importerPath = path.join(here, '..', 'overlay', 'scratch-gui', 'src',
    'components', 'tw-pseudocode', 'pseudocode-importer.jsx');
const importer = await readFile(importerPath, 'utf8').catch(() => '');
const registrarPath = path.join(here, '..', 'overlay', 'scratch-gui', 'src',
    'lib', 'sb3-creator-register-art.js');
const registrar = await readFile(registrarPath, 'utf8').catch(() => '');
if (!importer.includes('../../lib/sb3-creator-register-art.js') ||
    !registrar.includes("import art from './sb3-creator-vector-art.js'") ||
    !registrar.includes('SB3Creator.registerVectorArt(art)')) {
    console.error('\nVECTOR ART NOT INJECTED: the upstream dialect registry has no app consumer.');
    console.error('pseudocode-importer.jsx must load the registering compiler door, which must inject the art.');
    process.exit(1);
}

if (check && stale && !allowStale) {
    console.error(`\n${stale} vendored file(s) out of date — run: npm run sync:sb3creator`);
    process.exit(1);
}
// Name the SHA, never the ref. "synced from sb3-creator@main" is the sentence
// that was true and useless: it records the label, and the label is the part
// that moves.
const sourceSha = srcDir ? await localSha(srcDir) : remoteSha;
console.log(check ? (stale ? `\n${stale} intentional downstream file delta(s) allowed.` : '\nvendored files up to date.')
    : `\nsynced from ${REPO}@${sourceSha}${srcDir ? ` (local checkout ${srcDir})` : ` (resolved from ${REF})`}.`
      + ' Next: npm run integrate');

// Record the upstream commit this sync captured, so vendor-freshness CI
// compares against the PIN, not a moving HEAD (bump = re-run this sync).
// Remote mode records too — it resolved a real sha above; leaving the pin
// untouched is what made a remote sync lie about what it vendored.
if (!check) {
    try {
        await recordPin('sb3-creator', sourceSha);
    } catch (e) { console.warn(`  (pin not recorded: ${e.message})`); }
    // A pin bump and its examples sync belong in ONE commit — twice in one
    // day a bump shipped without the gallery and vendor-freshness went red
    // in CI (abcadd8, then f53f576). Refuse to end quietly while the
    // gallery lags the pin this sync just recorded.
    try {
        const { execFileSync } = await import('node:child_process');
        const args = ['scripts/sync-examples.mjs', '--check'];
        if (srcDir) args.push('--dir', srcDir);
        execFileSync(process.execPath, args, { stdio: 'pipe' });
    } catch {
        console.error('\nSTALE GALLERY: the examples no longer match the pin this sync just');
        console.error('recorded. Run `npm run sync:examples` and commit it WITH the bump —');
        console.error('shipping them apart is exactly what turned CI red twice on 2026-08-25.');
        process.exit(1);
    }

    // AND THE MIRROR THE BUILD ACTUALLY COMPILES. This sync writes overlay/;
    // webpack reads packages/scratch-gui/, which only `npm run integrate`
    // updated. Until 2026-09-21 that was a sentence printed at the end of a
    // successful run, and 0eb9a6a74 did not run it: the overlay got the new
    // emitter, packages/ kept the pre-bump bytes, and
    //
    //     git show 0eb9a6a74:packages/…/sb3-creator.js | grep -c escapeTextLiteral
    //     0
    //
    // so a commit titled "Pin sb3-creator past the literal that corrupted
    // itself on every save" shipped a build that still corrupted the literal.
    // `overlay-packages-pairs` caught the divergence, but only in CI and only
    // after the merge — the sync itself reported success.
    //
    // MIRRORS ONLY THE FILES THIS SYNC WROTE, and deliberately does not call
    // integrate. Integrate copies the WHOLE overlay/scratch-gui tree and
    // rewrites the mirror's package.json, so calling it from here would sweep
    // any unrelated in-progress overlay edit into packages/ and hand whoever
    // ran a sync a diff they did not make — a live hazard with several
    // sessions in this repo at once. Copying its own 14 destinations is the
    // same bytes integrate would write for them and touches nothing else.
    //
    // Refusing instead of writing was the first design and it was wrong: the
    // mirror is stale by construction the instant this sync writes, so the
    // refusal would fire on every legitimate bump, and a refusal that means
    // "nothing went wrong" trains people to re-run past it.
    //
    // packages/scratch-gui/examples is NOT tracked, so the gallery carries no
    // mirror obligation; all 14 compiler destinations do.
    const mirrorDir = path.join(here, '..', 'packages', 'scratch-gui', 'src', 'lib');
    const { copied, unreadable } = await mirrorIntoPackages(
        FILES.map(([, dest]) => dest).filter(dest => path.dirname(dest) === lib), mirrorDir, { readFile, writeFile });
    if (copied.length) {
        console.log(`  mirrored ${copied.length} file(s) into packages/scratch-gui/src/lib:`);
        for (const f of copied) console.log(`    ${f}`);
        console.log('  (the copy webpack compiles — commit it WITH this sync)');
    }
    if (unreadable.length) {
        console.error(`\nMIRROR INCOMPLETE: could not read ${unreadable.length} file(s) this sync`);
        console.error('just wrote, so the build copy may still be the old compiler:');
        for (const f of unreadable) console.error(`  ${f}`);
        process.exit(1);
    }
}

// The authoring vocabulary names this pin and inventories these exact dialect
// words. Regenerate it with a sync; check it without writing in check mode.
await execFileP(process.execPath, [path.join(here, 'generate-arcade-authoring-inventory.mjs'),
    ...(check ? ['--check'] : [])], {cwd: path.join(here, '..')});
