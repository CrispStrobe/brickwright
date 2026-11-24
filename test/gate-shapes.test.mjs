/**
 * The population of gate-shape suspects must not grow while it is being triaged.
 *
 * `scripts/audit-gate-shapes.mjs` finds four shapes that each let a defect reach main on
 * 2026-09-02. Its hits are SUSPECTS, not verdicts — most need a human to decide whether the
 * captured region can really contain its terminator, or whether an appearance assertion ought
 * to have a matching absence one. Triaging 58 of them is not a thing to do in one pass.
 *
 * What can be enforced today is that the number does not increase. A ratchet is honest about
 * the debt while making it impossible to add more silently — and unlike the gates this sweep
 * exists to find, this one CAN fail: lowering the baseline after real triage is a deliberate
 * edit, and adding a new suspect is a red test.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');

// Measured 2026-09-02. LOWER these as suspects are triaged; never raise one to make a push
// green. A new suspect is a new place a gate can stop biting without saying so.
const BASELINE = {
    // 11 -> 0 on 2026-09-02. Three were generators (gen-/make-/sync-), which the rule no longer
    // asks: a generator invoking the developer's cargo is intended behaviour. The rest were
    // triaged at their sites and every one FAILS CLOSED on absence. What that does NOT settle is
    // version identity — a different sdcc or simavr is still a different verdict — and nothing
    // here pins one. See docs/GATES-THAT-CANNOT-FAIL.md.
    // 0 -> 3 on 2026-09-04. All three are `git` from PATH in
    // test/vendor-source-guard.test.mjs, triaged in a comment at that site: the
    // subject under test IS git's ancestry answer, a stub would assert the
    // test's opinion of git instead of git's behaviour, and absence FAILS
    // CLOSED (execFileSync throws ENOENT, rig() does not catch, every test in
    // the file goes red). Verified, not assumed. Unpinned: git's version.
    // 3 -> 4 on 2026-09-07 (lego-be, pin leg to 2c568ca). The fourth is `git` from
    // PATH in test/vendor-absent-by-design.test.mjs, and it is there because the
    // absent-by-design proof now has to know TWO shas it cannot get any other
    // way: the source tree's own HEAD, and the previous bw-board pin out of
    // lite's history of vendor-pins.json. A pin leg makes the recorded pin equal
    // to the source sha by construction, and the sync then refuses for want of a
    // content base -- so without git this proof cannot run on the branches where
    // it matters most. A hardcoded previous pin was the alternative and is worse:
    // a fifth constant to keep in step with the pin.
    //
    // ABSENCE FAILS CLOSED, MEASURED RATHER THAN ASSUMED. Run with git removed
    // from PATH, both conditions go RED and neither passes: with pin == source
    // the rewind cannot happen and the sync refuses; with pin behind source the
    // sync itself cannot run. What absence does cost is the MESSAGE -- it reverts
    // to the old misleading 'i8088-cycles.js was not refused by name', because
    // with no git there is no sync output for the named assertion to read. So the
    // guard is honest about pass/fail and unhelpful about why, which is the right
    // way round and is stated here rather than discovered later.
    //
    // Unpinned, same as the three below: git's version.
    // 4 -> 6 on 2026-09-07, same lane, once the proof moved into a sandbox
    // worktree. CI counted six where this comment had claimed four, and the
    // right response is to NAME EACH ONE rather than raise the number to match
    // -- which is the whole reason the fourth was triaged individually. All six
    // are `git` from PATH; three are vendor-source-guard's, below. The three
    // here are:
    //
    //   :151  `git worktree add` -- creates the throwaway checkout the sync
    //         writes into. NOT wrapped: if git is absent or the add fails,
    //         execFileSync throws, the test errors, and the run is red. Fails
    //         closed by construction.
    //   :156  `git worktree remove` -- cleanup, deliberately swallowed, because
    //         a cleanup failure must not mask the result the test just
    //         measured. The directory is removed with rmSync regardless, so the
    //         worst case is a stale admin record. MEASURED after ~10 runs:
    //         zero stale `bw-absent` entries in `git worktree list`, so no
    //         prune call is warranted; adding one to be safe would be code
    //         nothing has been shown to need.
    //   :223  the two shas the rewind needs -- the source tree's HEAD and the
    //         previous bw-board pin out of lite's own history of
    //         vendor-pins.json. Absence returns null, which either changes
    //         nothing (no rewind was needed) or reds on the named content-base
    //         assertion. Never a false pass.
    //
    // ABSENCE FAILS CLOSED THROUGHOUT, MEASURED NOT ASSUMED: with git removed
    // from PATH both conditions go red and neither passes. What absence costs
    // is the MESSAGE -- it reverts to the old misleading 'i8088-cycles.js was
    // not refused by name', because with no git there is no sync output for the
    // named assertion to read. The guard is honest about pass/fail and
    // unhelpful about why, which is the right way round and is stated here
    // rather than left to be rediscovered.
    //
    // Unpinned, same as the three below: git's version. Raised 6 -> 9 on
    // 2026-09-08: no-tracked-package-examples adds three `git`-from-PATH
    // sites because Git's index is the subject of that gate. They match the
    // six pre-existing sites in vendor-absent-by-design and
    // vendor-source-guard; a missing Git still throws rather than passing an
    // empty census, and the fixture fires the cwd-rooting guard deliberately.
    // 9 -> 6 on 2026-09-12: vendor-absent-by-design.test.mjs is retired with the
    // sync it proved (bw-board is an npm package now; nothing copies files that
    // could accidentally create an absent-by-design one). Its three sites go
    // with it; vendor-source-guard's three and no-tracked-package-examples'
    // three remain.
    //
    // 6 -> 9 on 2026-09-22: test/ci-serve-threaded.test.mjs adds three `python3`
    // -from-PATH sites (one spawn of the server under test, two execFileSync
    // reads of the interpreter's own version and ServerClass default). Pinning
    // an interpreter here would be the WRONG fix: the subject of that gate is
    // precisely the ambient `python3` that CI's serve step invokes, so a pinned
    // one would answer for a program nobody runs.
    //
    // ABSENCE FAILS CLOSED, MEASURED NOT ASSUMED: with a `python3` on PATH that
    // exits 127, four of that file's five tests go red and the run exits 1. The
    // fifth is a source assertion over build.yml, which needs no interpreter and
    // is right to keep passing. No arrangement of a missing or broken python
    // produces a green gate.
    //
    // 9 -> 10 on 2026-11-24: test/x86-v10-cui-witness-pin.test.mjs (597f1a533)
    // runs `git log -p -- vendor-pins.json` from PATH to learn which Circuit UI
    // pins lite has ever shipped. The binding is to this repository's own
    // history, not to a tool the build ships, and every way it can be wrong
    // FAILS CLOSED, measured: a `git` on PATH that exits 127, no `git` on PATH
    // at all, and a one-commit checkout of the same files (no `-` lines, so
    // no former pins) each turn the pin test red, because the sealed V10 pin
    // is not the canonical one and nothing else admits it.
    'AMBIENT-BINDING': 10,
    // 12 -> 0 on 2026-09-02. The rule now ignores an appearance that is immediately followed by
    // a click/fill/count/evaluate — synchronisation before the real assertion, and the correct
    // way to write a browser gate. The five that survived that narrowing were each triaged at
    // their site: in every one, absence FAILS. What none of them assert is DISAPPEARANCE, which
    // is a different property; where a contract includes it (a dialog that must close) it still
    // needs writing.
    // Added 2026-09-07 (lego-b9, from lego-be's proof that T9's NUL skip hid a former pin): a
    // guarded continue/return directly inside a loop over a file walk, with no report within
    // reach. Measured 3 on arrival; one was a name-only extension filter (a role skip, exempt by
    // the rule's own text). The two that remain are BOTH in test/fetch-pinning.test.mjs (:134 a
    // catch-on-read, :135 the NUL skip) — lego-be's file, in flight for its own one-character fix,
    // asked to report its skipped set in that landing, at which point this goes to 0. The rule
    // is new, so this number is a measured starting point, not a raised baseline.
    // 2 -> 1 on 2026-09-24. The population the note above describes is gone:
    // fetch-pinning's two no longer appear, and the one that remains is
    // test/controller-widget-editor.test.mjs:97. This is a TIGHTENING to the
    // measured value, not a raise — a ratchet with slack it did not earn is
    // how the sleep census ended up 69 over its tree. It only bites someone
    // who ADDS a silent skip, which is the intent.
    'SILENT-SKIP': 1,
    // 0 held on 2026-11-24 by recognising `assert.equal(await x.isVisible(), false)` as an
    // absence proof (scripts/audit-gate-shapes.mjs): verify-cad-robot-projects.mjs (b15ff59f0)
    // and verify-cad-fasteners.mjs (2f2a25f00) each assert something is NOT visible in that
    // form, and their flagged `waitFor()`s are a re-render sync before a waitForFunction state
    // check, not the gates' verdicts. Both had kept this test red since 2026-11-17/18.
    'EVENT-AS-STATE': 0,
    // Added 2026-09-02, from triaging EVENT-AS-STATE: an awaited precondition inside a try whose
    // catch is empty or comment-only. Four instances, all bounded by a downstream hard assertion
    // and marked with the assertion that bounds them.
    'SWALLOWED-PRECONDITION': 0,
    // 1 -> 0 on 2026-09-02: the single hit was triaged and kept, marked at the site. The
    // widening is real but bounded to one dot-prefixed spelling whose receiver is a per-game
    // variable name; a SECOND entry of that form is what should be refused.
    'SEGMENT-MATCH': 0,
    // 8 -> 0 on 2026-09-02. Seven were converted to bracket-matched regions via
    // test/helpers/js-scope.mjs (balancedAfter / balancedFrom); the eighth is this suite's own
    // demonstration of the shape and is marked at the site.
    'TRUNCATED-CAPTURE': 0,
    // 37 -> 0 on 2026-09-02: three real conversions to brace-matched scopes, and 34 that were
    // never defects. The rule asked whether an assertion sat within 200 characters of the slice;
    // it now asks whether the slice's RESULT reaches a predicate. Truncating a failure MESSAGE
    // is good practice and made up the bulk of the old count.
    'WINDOWED-SEARCH': 0
};

// The detector must still bite. Each fixture is a shape the rules exist to catch, or a sound
// idiom they must leave alone; without these, tightening a rule to silence false positives is
// indistinguishable from deleting it.
const scan = source => {
    const dir = mkdtempSync(path.join(tmpdir(), 'gate-shapes-'));
    // Named for the convention the AMBIENT-BINDING rule keys on, so all six rules are reachable
    // from a fixture. With every class at zero, these tests are the only thing standing between
    // this detector and a dead one.
    writeFileSync(path.join(dir, 'verify-fixture.mjs'), source);
    const raw = execFileSync(process.execPath,
        [path.join(root, 'scripts/audit-gate-shapes.mjs'), '--json', '--root', dir],
        {cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024});
    rmSync(dir, {recursive: true, force: true});
    return JSON.parse(raw).findings.map(f => f.kind);
};

test('a guarded skip inside a file walk with no report beside it is caught; a reported one, a name-only one and a nested line loop are not', () => {
    // gate-shapes-allow: the fixtures ARE the shape
    assert.deepEqual(scan("for (const f of readdirSync(d)) {\n    if (!existsSync(f)) continue;\n}\n"), ['SILENT-SKIP']);
    // gate-shapes-allow: the fixture IS the shape
    assert.deepEqual(scan("for (const f of walk(root)) {\n    let t; try { t = readFileSync(f, 'utf8'); } catch { continue; }\n}\n"), ['SILENT-SKIP']);
    assert.deepEqual(scan("for (const f of readdirSync(d)) {\n    if (!existsSync(f)) { skipped.push(f); continue; }\n}\n"), [], 'a skip that reports itself is not silent');
    assert.deepEqual(scan("for (const f of readdirSync(d)) {\n    if (!f.endsWith('.js')) continue;\n}\n"), [], 'a predicate on the name alone is a role skip');
    assert.deepEqual(scan("for (const f of readdirSync(d)) {\n    for (const line of lines) { if (isComment(line)) continue; }\n}\n"), [], 'a nested loop over lines is not a file skip');
    assert.deepEqual(scan("for (const row of rows) {\n    if (!row.ok) continue;\n}\n"), [], 'a loop over rows is not a file walk');
    const marked = "for (const f of readdirSync(d)) {\n    if (!existsSync(f)) continue; // gate-shapes-allow: the missing case is asserted below\n}\n";
    assert.deepEqual(scan(marked), [], 'the marker is honoured');
});

test('a window whose result reaches a predicate is still caught', () => {
    assert.deepEqual(scan("assert.match(body.slice(0, 600), /guard/);"), ['WINDOWED-SEARCH']);  // gate-shapes-allow: the fixture IS the shape
    assert.deepEqual(scan("if (/guard/.test(body.slice(0, 600))) ok();"), ['WINDOWED-SEARCH']);  // gate-shapes-allow: the fixture IS the shape
    assert.deepEqual(scan("const hit = body.slice(0, 600).includes('guard');"), ['WINDOWED-SEARCH']);  // gate-shapes-allow: the fixture IS the shape
});

test('a window that only shortens a failure message is not a suspect', () => {
    // The 34 that were never defects. `check(label, predicate, evidence)`: the third argument
    // is prose for a human, and truncating it is the right thing to do.
    assert.deepEqual(scan("check('the engines are offered', labels.length > 1, labels.join(' | ').slice(0, 160));"), []);
    assert.deepEqual(scan("assert.ok(vars.includes('count'), `missing: ${JSON.stringify(vars.slice(0, 80))}`);"), []);
});

test('truncating a diff against an empty expectation cannot change a verdict', () => {
    assert.deepEqual(scan("assert.deepEqual(degraded.slice(0, 10), [], 'none may degrade');"), []);
});

test('selecting a row of a structure is a domain, not a window', () => {
    assert.deepEqual(scan("assert.ok([...level.cells.slice(0, 32)].every(c => c === 0), 'the sky is empty');"), []);
});

test('a deliberate demonstration may be marked, and the marker must be honoured', () => {
    const demo = "assert.match(src.slice(0, 200), /call/); // gate-shapes-allow\n";
    assert.deepEqual(scan(demo), []);
    assert.deepEqual(scan(demo.replace(' // gate-shapes-allow', '')), ['WINDOWED-SEARCH'],
        'removing the marker must bring the finding back, or the marker is a blanket silence');
});

test('a discarded precondition failure is caught', () => {
    // gate-shapes-allow: the fixture IS the shape (ninth time this detector has found itself)
    const swallowed = "try { await el.waitFor({state: 'visible'}); await el.fill('x'); } catch { }";
    assert.deepEqual(scan(swallowed), ['SWALLOWED-PRECONDITION']);
    assert.deepEqual(scan(swallowed.replace('catch { }', 'catch { skipped = true; }')), [],
        'a handler that RECORDS the failure is doing its job');
    assert.deepEqual(scan(swallowed.replace('catch { }', 'catch (e) { throw e; }')), []);
});

test('an appearance used to synchronise is not an appearance assertion', () => {
    // The correct way to write a browser gate, and 7 of the original 12 hits.
    // gate-shapes-allow
    assert.deepEqual(scan("await panel.waitFor({state: 'visible'});\nawait panel.click();"), []);
    assert.deepEqual(scan("await panel.waitFor({state: 'visible'});\nconst n = await panel.count();"), []);
    // Standing alone, with nothing in the file proving the thing ever leaves, it is a suspect.
    // gate-shapes-allow
    assert.deepEqual(scan("await panel.waitFor({state: 'visible'});\nreport('done');"), ['EVENT-AS-STATE']);
    // node:assert's spelling of absence counts as proving the thing leaves; asserting it is
    // still visible does not.
    // gate-shapes-allow
    assert.deepEqual(scan("await panel.waitFor();\nreport('done');\nassert.equal(await panel.isVisible(), false);"), []);
    // gate-shapes-allow
    assert.deepEqual(scan("await panel.waitFor();\nreport('done');\nassert.equal(await panel.isVisible(), true);"), ['EVENT-AS-STATE']);
});

test('every rule still fires — all seven, from one fixture', () => {
    const kinds = new Set(scan([
        "assert.match(body.slice(0, 600), /guard/);",          // gate-shapes-allow
        // gate-shapes-allow
        "const seg = name.split('::').pop();\nif (allow.has(seg)) ok();",
        // gate-shapes-allow
        "const cap = src.match(/LIST = \\[([\\s\\S]*?)\\]/);",
        // gate-shapes-allow
        // gate-shapes-allow
        "execFileSync('sdcc', ['--version']);",
        // gate-shapes-allow
        "try { await el.waitFor({state: 'visible'}); } catch { }",
        // gate-shapes-allow
        "await panel.waitFor({state: 'visible'});\nreport('done');",
        // gate-shapes-allow
        "for (const f of readdirSync(d)) {\n    if (!existsSync(f)) continue;\n}"
    ].join('\n')));
    assert.deepEqual([...kinds].sort(), ['AMBIENT-BINDING', 'EVENT-AS-STATE', 'SEGMENT-MATCH', 'SILENT-SKIP',
        'SWALLOWED-PRECONDITION', 'TRUNCATED-CAPTURE', 'WINDOWED-SEARCH'],
        'a rule that fires on nothing is indistinguishable from a rule that is correct, and ' +
        'every baseline in this file is now zero');
});

test('AMBIENT-BINDING fires on a path that is READ, not on one merely mentioned', () => {
    // The narrowing of 2026-09-05 must not have deleted the rule. Both halves
    // proved from one fixture, because a rule that stopped firing and a rule
    // that stopped false-firing look identical from the count alone.
    // gate-shapes-allow
    const read = "const src = readFileSync('../../../bw-board/src/i8086.js', 'utf8');";
    assert.deepEqual(scan(read), ['AMBIENT-BINDING'],
        'a sibling checkout that is actually READ is the hazard this rule exists for');

    // gate-shapes-allow
    const needle = "assert.ok(!before.includes('../../lib/bw-board/m6502-extract.js'));";
    assert.deepEqual(scan(needle), [],
        'a module specifier used as a SEARCH NEEDLE reaches nothing -- this fired 9 times ' +
        'on a correct test and left main red');

    // An ABSOLUTE machine path stays flagged however it is used: it is
    // machine-specific whether or not this particular line opens it.
    // gate-shapes-allow
    assert.deepEqual(scan("const p = '/mnt/volume1/code/bw-board/src/i8086.js';"), ['AMBIENT-BINDING']);
});

test('no new gate-shape suspects', () => {
    const raw = execFileSync(process.execPath,
        [path.join(root, 'scripts/audit-gate-shapes.mjs'), '--json'],
        {cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024});
    const {counts, roots, scanned} = JSON.parse(raw);

    // ASSERT THE SCOPE, not just the count. A baseline of 3 is a statement
    // about the set that was walked, and until 2026-09-05 nothing checked
    // which set that was -- so narrowing the scan to one directory, or
    // breaking the directory walk outright, would have made this test GREENER
    // rather than red. The number and the set it counted over have to be
    // asserted together or the number means nothing.
    //
    // The scope is deliberately test/ + scripts/ and NOT the whole repo:
    // measured, --root . adds 15 SEGMENT-MATCH hits in overlay/ and packages/,
    // and reading them showed every one is `split('.').pop()` taking a file
    // extension or a deliberate basename compare. `.pop()` on a split is a
    // truncated membership test in a GATE and an ordinary extraction in
    // source. Widening the scan would add fifteen false positives and teach
    // everyone to ignore the tool.
    assert.deepEqual(roots, ['test', 'scripts'],
        'the audit scope changed. The baselines below are counts over test/ + scripts/; ' +
        'a different scope makes them meaningless rather than merely wrong.');
    assert.ok(scanned > 300,
        `the audit walked only ${scanned} files. It walked 379 on 2026-09-05, and a ` +
        'collapsed walk yields few findings, which reads as a clean repo.');
    for (const [kind, allowed] of Object.entries(BASELINE)) {
        const found = counts[kind] || 0;
        assert.ok(found <= allowed,
            `${kind}: ${found} suspects, baseline ${allowed}. A gate whose capture can be ` +
            'truncated, whose scope is a fixed character window, whose membership test sees only ' +
            'the last path segment, or which proves a thing appears but never that it leaves, ' +
            'stops biting silently. Fix it, or state why it is safe and raise the baseline in ' +
            'the same commit.');
    }
    for (const kind of Object.keys(counts)) {
        assert.ok(kind in BASELINE, `unrecognised suspect kind ${kind} — add it to the baseline`);
    }
});
