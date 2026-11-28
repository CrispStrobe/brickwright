#!/usr/bin/env node
/**
 * The assignment of root-level source test files to their CI steps.
 *
 * `npm test` runs the root-level source suite. CI splits that suite in two:
 * the `corpus` job runs
 * the two lesson walks (every bench in the catalog, solved twice over — ~14 CPU
 * minutes), and required unit shards partition the rest as `test:fast:shard`.
 * The local `test:fast` command runs the complete non-corpus source suite. Both the npm
 * scripts and scripts/check-test-run.mjs (which verifies that every file handed
 * to `node --test` actually reported tests) read the split from HERE, so the
 * list cannot drift between the runner and the check that audits the runner.
 * Runtime-dependent tests under test/crispbasic-wasm/ run explicitly in the
 * CrispBASIC workflow after its real interpreter build. Their required route
 * is guarded by the fast crispbasic-cad-ci.test.mjs test; the source clock and
 * cancellation tests remain in the ordinary fast set.
 *
 *   node scripts/list-tests.mjs all|fast|corpus [--shard index/count]
 *                                                   -> one path per line
 *
 * Shards are balanced by measured time, not by filename (2026-10-25: a modulo
 * split left one leg at 23 of its 30 minutes while another took 12).
 * scripts/data/unit-test-timings.json holds each file's summed top-level test
 * seconds from one hosted run (regenerate with scripts/gen-unit-test-timings.mjs).
 * Timed files (each weighted by its seconds plus FILE_OVERHEAD_SECONDS) are assigned greedily, longest first (ties by name), each to the
 * currently lightest shard (ties to the lowest index). A file the table does not
 * know (new since the reading) falls back to sha256(name) mod count, so the
 * assignment stays deterministic and every file still runs exactly once.
 */
import {readdirSync, readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const TIMINGS = JSON.parse(readFileSync(path.join(root, 'scripts', 'data', 'unit-test-timings.json'), 'utf8')).seconds;

// Each file also costs its own process start and imports, which no test
// duration covers; a small constant keeps fast files from piling onto one leg.
export const FILE_OVERHEAD_SECONDS = 0.5;

const hashIndex = (file, count) => createHash('sha256').update(file).digest().readUInt32BE(0) % count;

/** Shard index (0-based) for each file of `files`, balanced by TIMINGS. */
export const assignShards = (files, count, timings = TIMINGS) => {
    const loads = new Array(count).fill(0), out = new Map();
    const timed = files.filter(f => Object.hasOwn(timings, f))
        .sort((a, b) => timings[b] - timings[a] || (a < b ? -1 : a > b ? 1 : 0));
    for (const f of timed) {
        let best = 0;
        for (let i = 1; i < count; i++) if (loads[i] < loads[best]) best = i;
        loads[best] += timings[f] + FILE_OVERHEAD_SECONDS;
        out.set(f, best);
    }
    for (const f of files) if (!out.has(f)) out.set(f, hashIndex(path.basename(f), count));
    return out;
};

const CORPUS = new Set(['lesson-numeric-contract.test.mjs', 'lesson-defect-detector.test.mjs']);

export const listTests = (set = 'all', shard = null) => {
    if (!['all','fast','corpus'].includes(set)) throw new Error('Unknown test set: '+set);
    const files = readdirSync(path.join(root, 'test')).filter(f => f.endsWith('.test.mjs')).sort();
    const pick = set === 'corpus' ? f => CORPUS.has(f) : set === 'fast' ? f => !CORPUS.has(f) : () => true;
    let selected = files.filter(pick);
    if (shard !== null) {
        if (set !== 'fast') throw new Error('Only the fast set may be sharded');
        const match = /^([1-9]\d*)\/([1-9]\d*)$/.exec(shard);
        const index = match && Number(match[1]), count = match && Number(match[2]);
        if (!match || !Number.isSafeInteger(index) || !Number.isSafeInteger(count) || index > count || count > 64)
            throw new Error('Expected test shard index/count with 1 <= index <= count <= 64');
        const assigned = assignShards(selected.map(f => path.posix.join('test', f)), count);
        selected = selected.filter(f => assigned.get(path.posix.join('test', f)) === index - 1);
        if (!selected.length) throw new Error('Test shard '+shard+' is empty');
    }
    return selected.map(f => path.posix.join('test', f));
};

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
    const set = process.argv[2] || 'all';
    if (!['all', 'fast', 'corpus'].includes(set)) {
        console.error(`usage: list-tests.mjs all|fast|corpus (got ${set})`);
        process.exit(2);
    }
    const extra = process.argv.slice(3);
    if (extra.length && (extra.length !== 2 || extra[0] !== '--shard')) throw new Error('Expected --shard index/count');
    process.stdout.write(listTests(set, extra[1] ?? null).join('\n') + '\n');
}
