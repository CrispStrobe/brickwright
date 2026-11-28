/**
 * A FILE SYNC NEVER MOVES THE PIN; A PIN MOVES ONLY WITH --pin (plan T9b).
 *
 * 2026-09-07, lego-be: `scripts/sync-bw-board.mjs --only <file> --dir <tip>`
 * silently rewrote vendor-pins.json to the tip — a stealth pin bump inside a
 * one-file sync commit, caught only by reading `git status` before committing.
 * Every other vendored file was still at the old pin, so the pin then lied
 * about all of them, and there was no flag to say "do not".
 *
 * Now: scripts/lib-pin.mjs refuses a pin move unless --pin is on the command
 * line, BEFORE any sync writes (each sync calls assertPinMoveAllowed as soon
 * as it knows its source sha) and again inside recordPin as the backstop.
 *
 * The list of syncs is DERIVED — every scripts/sync-*.mjs that calls
 * recordPin — never typed here. (sync-bw-board, which took --only, is gone:
 * bw-board is a package now; its pin moves through scripts/pin-packages.mjs.) The
 * others are whole-tree syncs, and the rule is the same for them: without
 * --pin, a source at a different sha is a refusal naming old and new.
 *
 * The live half runs each sync in a THROWAWAY git worktree of this repo (so a
 * refusal that came too late could not touch the tree we are in) against a
 * checkout named by BW_BOARD_DIR / SB3_CREATOR_DIR / BW_CIRCUIT_UI_DIR whose
 * HEAD is not the pin, and asserts vendor-pins.json is byte-identical
 * afterwards and the process refused by name. Unset → skipped by name.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {readFileSync, readdirSync, writeFileSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {assertPinMoveAllowed, recordPin, PinMoveRefused} from '../scripts/lib-pin.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const A = 'a'.repeat(40), B = 'b'.repeat(40);

// `git` from PATH is the AMBIENT-BINDING shape audit-gate-shapes flags, kept and
// DEFUSED the way i8086-bios-provenance does: the first thing the live half
// does with it is assert a 40-hex HEAD, so an absent or broken git fails by
// name instead of agreeing that nothing moved. The syncs under test shell out
// to git themselves; a test of them without git would be a test of nothing.
// gate-shapes-allow
const git = (...args) => execFileSync('git', args, {encoding: 'utf8'});

// ---- the helper -------------------------------------------------------------

const tmpPins = pins => { const d = mkdtempSync(path.join(tmpdir(), 'pins-')); const f = path.join(d, 'vendor-pins.json'); writeFileSync(f, JSON.stringify(pins, null, 1) + '\n'); return f; };

test('an unchanged pin is nothing to decide; a moved pin without --pin is a refusal naming old and new; with --pin it moves', async () => {
    const f = tmpPins({'bw-board': A});
    assert.deepEqual(await assertPinMoveAllowed('bw-board', A, {pinsFile: f, explicit: false}), {moves: false, old: A});
    await assert.rejects(assertPinMoveAllowed('bw-board', B, {pinsFile: f, explicit: false, scoped: true}), err => {
        assert.ok(err instanceof PinMoveRefused);
        assert.match(err.message, /refusing to move the bw-board pin aaaaaaaaa -> bbbbbbbbb/);
        assert.match(err.message, /scoped --only run/);
        assert.match(err.message, /Nothing was written/);
        return true;
    });
    assert.deepEqual(await assertPinMoveAllowed('bw-board', B, {pinsFile: f, explicit: true}), {moves: true, old: A});
    assert.equal(JSON.parse(readFileSync(f, 'utf8'))['bw-board'], A, 'assert never writes');
});

test('recordPin is the backstop: it refuses the same move, keeps the file byte-identical, and records with --pin', async () => {
    const f = tmpPins({'bw-board': A, 'sb3-creator': B});
    const before = readFileSync(f, 'utf8');
    await assert.rejects(recordPin('bw-board', B, {pinsFile: f, explicit: false, log: () => {}}), /pin was NOT recorded/);
    assert.equal(readFileSync(f, 'utf8'), before, 'byte-identical after the refusal');
    await recordPin('bw-board', A, {pinsFile: f, explicit: false, log: () => {}});
    assert.equal(readFileSync(f, 'utf8'), before, 'the no-op path still writes nothing new');
    await recordPin('bw-board', B, {pinsFile: f, explicit: true, log: () => {}});
    assert.equal(JSON.parse(readFileSync(f, 'utf8'))['bw-board'], B);
});

// ---- the syncs, derived -----------------------------------------------------

const syncs = readdirSync(path.join(ROOT, 'scripts')).filter(f => /^sync-.*\.mjs$/.test(f))
    .filter(f => /\brecordPin\(/.test(readFileSync(path.join(ROOT, 'scripts', f), 'utf8')));

test('every sync that records a pin pre-checks the move before it writes, and says the rule where its usage lives', () => {
    // sync-crispbasic.mjs (2026-11-28) copies the whole CrispStrobe/crispbasic
    // package tree; like the flasher it moves its pin only by hand, with --pin.
    assert.deepEqual([...syncs].sort(), ['sync-crispbasic.mjs', 'sync-examples.mjs', 'sync-flasher.mjs', 'sync-sb3creator.mjs'],
        'copy-sync authorities changed: board/UI pins now belong to pin-packages.mjs, not a sync');
    for (const f of syncs) {
        const text = readFileSync(path.join(ROOT, 'scripts', f), 'utf8');
        const pre = text.indexOf('assertPinMoveAllowed(');
        const firstWrite = text.search(/\bawait writeFile\(|\bwriteFileSync\(/);
        assert.ok(pre > 0, `${f} never calls assertPinMoveAllowed — a moved pin would only be refused after the files were written`);
        assert.ok(firstWrite < 0 || pre < firstWrite, `${f} pre-checks the pin move at ${pre} but its first write is at ${firstWrite}`);
        assert.match(text, /A FILE SYNC NEVER MOVES THE\n\/\/\s+PIN; a pin moves only with --pin/, `${f}: the rule is not written in its usage header`);
    }
});

test('the tool that exists to move the pins passes --pin to every pin-recording sync it runs', t => {
    const fwd = readFileSync(path.join(ROOT, 'scripts', 'vendor-forward.mjs'), 'utf8');
    const ran = [];
    for (const f of syncs) {
        const calls = [...fwd.matchAll(new RegExp(`node scripts/${f.replace('.', '\\.')}[^\`\\n]*`, 'g'))].map(m => m[0]);
        if (calls.length === 0) { t.diagnostic(`vendor-forward does not run ${f}; its pin moves only by hand, with --pin`); continue; }
        ran.push(f);
        for (const c of calls) assert.match(c, /--pin\b/, `vendor-forward runs ${f} without --pin: ${c}`);
    }
    assert.deepEqual(ran.sort(), ['sync-examples.mjs', 'sync-sb3creator.mjs'],
        'vendor-forward must cover both remaining sb3 copy syncs; flasher is explicitly manual');
});

// ---- live: a scoped sync against a checkout at another sha leaves the pin alone --

const CHECKOUT = {'sync-sb3creator.mjs': ['sb3-creator', 'SB3_CREATOR_DIR', ''], 'sync-examples.mjs': ['sb3-creator', 'SB3_CREATOR_DIR', ''], 'sync-flasher.mjs': ['stc-compiler-flasher', 'STC_COMPILER_DIR', ''], 'sync-crispbasic.mjs': ['crispbasic', 'CRISPBASIC_DIR', '']};

for (const f of syncs) {
    const [repo, envVar, scope] = CHECKOUT[f] || [null, null, ''];
    const dir = envVar && process.env[envVar];
    test(`${f}${scope ? ` ${scope}` : ''} --dir <checkout at another sha> refuses by name and leaves vendor-pins.json byte-identical`,
        {skip: !repo ? `${f} records a pin but this test does not know its checkout variable — add it` : !dir ? `${envVar} unset` : false}, () => {
            const head = git('-C', dir, 'rev-parse', 'HEAD').trim();
            assert.match(head, /^[0-9a-f]{40}$/, `${envVar}=${dir} is set, but git could not read a HEAD sha there — refusing to report on a checkout it never saw`);
            const pins = JSON.parse(readFileSync(path.join(ROOT, 'vendor-pins.json'), 'utf8'));
            if (head === pins[repo]) { assert.ok(true, `${envVar} is AT the pin; nothing to refuse`); }
            // throwaway worktree: the sync's writes and any refusal land there, never here
            const wt = mkdtempSync(path.join(tmpdir(), 'pin-wt-'));
            git('-C', ROOT, 'worktree', 'add', '--detach', '-q', wt, 'HEAD');
            // the WORKING tree's scripts, not HEAD's: this test must judge the edit in hand
            for (const s of ['lib-pin.mjs', f]) writeFileSync(path.join(wt, 'scripts', s), readFileSync(path.join(ROOT, 'scripts', s)));
            let ahead = false;
            try { git('-C', dir, 'merge-base', '--is-ancestor', pins[repo], head); ahead = true; } catch { /* behind or divergent */ }
            try {
                const before = readFileSync(path.join(wt, 'vendor-pins.json'), 'utf8');
                const r = spawnSync(process.execPath, [`scripts/${f}`, ...scope.split(' ').filter(Boolean), '--dir', dir], {cwd: wt, encoding: 'utf8', timeout: 180000});
                assert.equal(readFileSync(path.join(wt, 'vendor-pins.json'), 'utf8'), before, `${f} moved the pin without --pin`);
                if (head !== pins[repo]) {
                    assert.notEqual(r.status, 0, `${f} exited 0 against a checkout at ${head.slice(0, 9)} (pin ${pins[repo].slice(0, 9)}) without --pin:\n${r.stdout}\n${r.stderr}`);
                    if (ahead) {
                        assert.match(r.stdout + r.stderr, new RegExp(`refusing to move the ${repo} pin ${pins[repo].slice(0, 9)} -> ${head.slice(0, 9)}`), r.stdout + r.stderr);
                        assert.match(r.stdout + r.stderr, /Nothing was written/);
                    } else {
                        // a checkout BEHIND or beside the pin is refused by the sync's own stale-source guard first; the pin still may not move
                        assert.match(r.stdout + r.stderr, /refusing|Refusing|BACKWARD|stale/i, r.stdout + r.stderr);
                    }
                    // everything but the two scripts this test copied in must be untouched
                    const dirty = git('-C', wt, 'status', '--porcelain', '--', '.', ':!scripts/lib-pin.mjs', `:!scripts/${f}`).trim();
                    assert.equal(dirty, '', `${f} wrote before refusing:\n${dirty}`);
                }
            } finally {
                git('-C', ROOT, 'worktree', 'remove', '--force', wt);
                rmSync(wt, {recursive: true, force: true});
            }
        });
}
