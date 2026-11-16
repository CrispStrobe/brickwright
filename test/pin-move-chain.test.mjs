/**
 * THE PIN-MOVE CHAIN ENUMERATES ITSELF (plan T9).
 *
 * A vendor pin bump must regenerate every document that carries the pin —
 * on 2026-09-07 lego-be's bw-board move had to regenerate FOUR (the census
 * snapshot + census-snapshot.js, the matrix doc, the ROM provenance, the 8086
 * capability report) and the fourth was found by CI, not by any checklist.
 * Keeping a checklist is keeping a second list. This test derives the set:
 * no tracked file may carry a full 40-hex sha of a bw-board, sb3-creator or
 * bw-circuit-ui commit other than the CURRENT pins in vendor-pins.json.
 *
 * Two sources of "a sha of theirs", each with its own reach:
 *   1. PREVIOUS PIN VALUES, from `git log -p -- vendor-pins.json` — every sha
 *      the file ever held. Runs wherever the pins file's history is present;
 *      a checkout too shallow to hold it (CI's default depth-1) is refused BY
 *      NAME rather than passed on an empty set (build.yml deepens the history
 *      without blobs before the unit step for exactly this).
 *   2. THE REPOS' WHOLE HISTORY, when a checkout or a bare/blobless clone is
 *      reachable: BW_BOARD_DIR / SB3_CREATOR_DIR / BW_CIRCUIT_UI_DIR (working
 *      checkouts, the convention of bw-board-census and i8086-bios-provenance)
 *      or BW_VENDOR_HISTORY_DIR holding <repo>.git bare clones (what build.yml
 *      makes, ~1 s each without blobs). Unset → that half is SKIPPED by name.
 *
 * Exempt BY ROLE, and why each class is history rather than a reference:
 *   - ledgers (LANES.md and lanes/*, CI-POINTERS.md, HISTORY.md, ROADMAP.md, PLAN.md, BLOCKED.md,
 *     HANDOFF.md): records of what happened; a sha there is dated.
 *   - docs prose (docs/**.md EXCEPT docs/generated/**): narrative cites the
 *     commit it discusses. docs/generated is the opposite — it is one of the
 *     four documents this test exists to keep current.
 *   - comment lines in code (// * # in .js/.mjs/.jsx/.ts/.yml/.sh): notes
 *     beside code, e.g. "pin moved 4134b86 -> ... -> 5d17288" in a test. The
 *     CODE line beside them is not exempt.
 *   - one FIELD by role, and this one is CHECKED, not assumed: the ROM
 *     provenance manifest's `lastTouchedBy.sha` is the bios.asm commit that
 *     last changed the ROM's source. It is exempt here because a different
 *     test owns it — test/i8086-bios-provenance.test.mjs asserts, against real
 *     bw-board history when BW_BOARD_DIR is set, that the manifest's source sha
 *     is an ancestor of the pin and that behindPinBy is the true count. On
 *     main today that field is 7b8d1404, the one non-pin sha outside prose and
 *     ledgers. Every other sha in that manifest must be the pin.
 *   - three exact frozen executable admission constants have source-bound
 *     historical roles, listed in frozen-control-pin-admissions.json. Whole
 *     file bytes/mode/Git blob are independently checked; only the supported
 *     token can keep its shipped previous pin. Other code remains current.
 *     Their old-candidate admission is preserved, never upgraded to a current
 *     qualification by this exception.
 *   - run receipts (docs/receipts/*.json and original model-source READMEs)
 *     are their own role, and it
 *     is NARROWER than a ledger. A receipt is evidence of what was measured
 *     at a named pin (the Doom browser receipt's boardPin is the bw-board pin
 *     it ran against, which a later bump replaced). Rewriting that sha on a
 *     pin bump would falsify the receipt: it would claim a measurement at a
 *     pin nobody measured. So a receipt may carry the current pin OR any
 *     previous pin of a vendored repo. What it may NOT carry is a vendored-
 *     repo commit that was never a pin: that is a receipt citing a source the
 *     lite tree never shipped, and it stays red. The limit, stated: "never a
 *     pin" is only recognisable when the repo-history half runs (the three
 *     *_DIR checkouts or BW_VENDOR_HISTORY_DIR); without it such a sha is an
 *     unknown hex string, invisible here as it is in every other role.
 *   - packages/** is not scanned: packages/scratch-gui/src is a byte-identical
 *     mirror of overlay/ (test/overlay-packages-pairs holds it) and the rest is
 *     upstream Scratch, whose CHANGELOGs carry thousands of shas of their own.
 *
 * What this cannot see, stated: a sha assembled from parts (a prefix constant
 * plus a suffix, a short sha widened at runtime) is out of reach of a by-name
 * scan, the same limit the doc-trigger and ROM censuses carry.
 *
 * Red names the file, the line, the stale sha, the repo, and which pin it was
 * (replaced in which lite commit, on which date) or that it was never a pin.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync, existsSync, lstatSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {hddBeforeConcurrencyControl, hddHistoricalHashBody, studyBeforeConcurrencyPolicy} from './helpers/reviewed-concurrency-projections.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const PINS = path.join(ROOT, 'vendor-pins.json');
const REPOS = ['bw-board', 'sb3-creator', 'bw-circuit-ui'];
const SCOPED_PINS = ['stc-compiler-flasher', 'arrays-values', 'microbitplus', 'circuitplayground', 'wedo2unified', 'spikeprime',
    'ev3comprehensive', 'legoboostunified', 'legonxt', 'legopoweredup'];
const ENV_DIR = {'bw-board': 'BW_BOARD_DIR', 'sb3-creator': 'SB3_CREATOR_DIR', 'bw-circuit-ui': 'BW_CIRCUIT_UI_DIR'};
const PROVENANCE = 'overlay/scratch-gui/static/roms/i8086-bios.provenance.json';
const HEX40 = /\b[0-9a-f]{40}\b/g;

// These consumed-study inputs describe a measured historical runtime. They
// cannot follow today's installed packages without falsifying that evidence.
// The role is admitted only for these exact complete-file bytes; changing even
// a comment refuses. Ordinary source and never-pinned receipt checks stay live.
export const SEALED_STUDY_FILES = Object.freeze({
    '.github/workflows/reference-qualified-instruments.yml': '657110ef93474d26f03dc1ae2fa8b8ce49063f8288ef65550fb0c558f0a9cd29',
    'scripts/lib/reference-qualified-circuits.mjs': '6efaeccdcb7aa855715020420dc9714f56c6f023a277f34a373aaf8f640bc341',
    'scripts/read-reference-qualified-instruments.py': 'b4fda49432bfc5cea9ad6ee81fea413c2acaa0dd551aeb48f959e0f35b2c491c',
    'docs/receipts/reference-qualified-v2-ui-package.json': 'aa2e7cdd01c31f9622339ebccf16fcd5c3728d497903b4230fbd1842fd1ddc16'
});

const HISTORICAL_X86_CUI_V5_V7 = '91d8434a79d373cef2837c137ab356356f1a3b44';
// The CUI pin the F7/F8 x86 epochs were reviewed and executed at. It was the
// current pin until the capture-select fix moved CUI to CURRENT_X86_CUI; from
// then on it is a previous pin that only the exact reviewed F7/F8 literal maps
// (historicalV8CuiSpans) and this declaration may carry.
const HISTORICAL_X86_V8_CUI = '1bc233c9297e03abb9b7eb603e045b4e92b0bb40';
const CURRENT_X86_CUI = 'a5860b9cf6cb0e7f652130ce987d51dc42651b8b';
// CURRENT_X86_CUI retains the F9 epoch meaning; only these F10 values are live.
const LIVE_X86_CUI = '6b4d70290d7ebd088ad32b525f99eb02af475533';
const LIVE_X86_BOARD = '33d3ee399db9224105e70f34864f1af962ccdb41';
const HISTORICAL_X86_BOARD = '761153ff92d521c01107ee7b32922ba7adc10ee2';
const HISTORICAL_X86_CURRENT_BOARD = '836867513c3e7fac420ddaa32c17e1c7b6d3e513';
// The sb3-creator pin every reviewed F7/F8/F9 x86 epoch was executed at. It
// was current until the Arcade atan2 move to LIVE_X86_SB3; from then on it is
// a previous pin that only the exact named SB3/CURRENT_SB3/F7/F8 positions of
// the reviewed bodies (historicalSb3Spans) and this declaration may carry.
const HISTORICAL_X86_SB3 = '1cbaeed325f5a890e43b78a4211acae8f801f2d2';
// The live F10 sb3-creator identity; it follows the current pin.
const LIVE_X86_SB3 = '8e53c1621a1b9eeb42e0565f987c4c47ab598961';
const HISTORICAL_X86_FINITE_V7_PINS = "FINITE_V7_PINS = {'bw-board':'" + HISTORICAL_X86_CURRENT_BOARD + "','bw-circuit-ui':'" + HISTORICAL_X86_V8_CUI + "','sb3-creator':'" + HISTORICAL_X86_SB3 + "'}";
const HISTORICAL_X86_FINITE_V8_PINS = "FINITE_V8_PINS = {'bw-board':'" + HISTORICAL_X86_CURRENT_BOARD + "','bw-circuit-ui':'" + HISTORICAL_X86_V8_CUI + "','sb3-creator':'" + HISTORICAL_X86_SB3 + "'}";
const CURRENT_X86_FINITE_V9_PRODUCER = "FINITE_V9_PINS = {'bw-board':CURRENT_BOARD,'bw-circuit-ui':CUI,'sb3-creator':CURRENT_SB3}";
const CURRENT_X86_FINITE_V9_READER = "FINITE_V9_PINS = {'bw-board':CURRENT_BOARD,'bw-circuit-ui':CUI_V8,'sb3-creator':CURRENT_SB3}";
// Reviewed arming-preparation F10/Actual-V9 bodies; actual admission is separate. Historical
// F7/F8/F9 meanings remain fixed; only named positions are admitted below.
// These profiles follow independent protocol/role review and connected controls,
// including clock and core/full-runtime parity. Any later source edit revokes
// their occurrence roles until another explicit review; never auto-restamp.
// The prior profile stays binding through an exact reversible source-delta check below.
const PRE_CONCURRENCY_X86_TEST_PROFILE = Object.freeze({bytes: 646674, sha256: '45ef06f71b0bec8064d4f2bee31e1a78dcaa50cd9e6a4fd10fa8ad39cdd857ae'});
const HISTORICAL_X86_SOURCE_PROFILES = Object.freeze({
    'scripts/run-i80386-hdd-gui-actual.py': Object.freeze({bytes: 352633, sha256: '48f4a46bad836b352181f5c200e4fd65970e5cd54463aa33a56f1d194d32e0c3'}),
    'scripts/read-i80386-hdd-gui-originals.py': Object.freeze({bytes: 468793, sha256: 'd5c7c652549a2bdb1b603f401f8d4af83ee60a8c1e88c76e2cf5812f74aac011'}),
    'test/i80386-hdd-gui-actual.test.mjs': Object.freeze({concurrencyControl: true, bytes: 646674, sha256: '45ef06f71b0bec8064d4f2bee31e1a78dcaa50cd9e6a4fd10fa8ad39cdd857ae'}),
});

import {explainGitFailure} from './helpers/git-absence.mjs';

// `git` from PATH: the same AMBIENT-BINDING shape i8086-bios-provenance keeps
// and defuses — every use below proves git answered before anything is judged.
// gate-shapes-allow
const git = (cwd, ...args) => execFileSync('git', ['-c', 'gc.auto=0', '-c', 'maintenance.auto=false', '-C', cwd, ...args], {encoding: 'utf8', maxBuffer: 64 << 20});

/** `git`, but a missing-blob failure explains itself instead of reading as a pin defect. */
const gitReadingContent = (cwd, ...args) => {
    try {
        return git(cwd, ...args);
    } catch (e) {
        const why = explainGitFailure(`${e.message || ''} ${e.stderr || ''}`);
        if (why) throw new Error(why);
        throw e;
    }
};

export const currentPins = () => JSON.parse(readFileSync(PINS, 'utf8'));

/** Every sha the pins file ever held, with the lite commit that replaced it. Pure over `git log -p` text. */
/**
 * Former pin values, read out of the diff git prints for vendor-pins.json.
 *
 * A `-` LINE IS NOT PROOF A PIN MOVED, which is the whole reason `currentShas`
 * exists. Any rewrite of the file — a changed indent, a reordered key, a
 * trailing-newline fix — makes git print a `-` line for EVERY pin, including the
 * ones whose value is unchanged. Measured 2026-09-11: `scripts/lib-pin.mjs`
 * wrote the file with `JSON.stringify(pins, null, 1)` where the file uses indent
 * 2, so one bw-board bump reformatted all three lines and put bw-circuit-ui's
 * and sb3-creator's CURRENT shas into this map as "previous pins".
 *
 * What that costs downstream is silent and wrong in both directions: the
 * staleness scan starts reporting live pins as stale, and the fixture that
 * plants "a previous pin" to prove the detector works plants a sha that is still
 * current, finds nothing, and reads as a broken detector.
 *
 * So a sha that IS a current pin is never a previous pin, whatever the diff
 * looked like. That also covers the honest case the indent bug only imitated: a
 * pin moved away and then back.
 */
export const parsePreviousPins = (logText, currentShas = new Set(), allowedKeys = new Set(REPOS)) => {
    const prev = new Map();
    let commit = null;
    for (const line of logText.split('\n')) {
        const c = line.match(/^COMMIT ([0-9a-f]{40}) (\S+)/);
        if (c) { commit = {sha: c[1], date: c[2]}; continue; }
        const m = line.match(/^-\s*"([\w-]+)":\s*"([0-9a-f]{40})"/);
        if (m && allowedKeys.has(m[1]) && commit && !prev.has(m[2]) && !currentShas.has(m[2])) {
            prev.set(m[2], {repo: m[1], replacedIn: commit.sha.slice(0, 9), on: commit.date});
        }
    }
    return prev;
};

/** Role of a tracked file for this test: 'ledger' | 'receipt' | 'docs-prose' | 'skip' | 'code'. */
export const roleOf = file => {
    if (Object.hasOwn(SEALED_STUDY_FILES, file)) return 'receipt';
    if (/^(LANES|HISTORY|ROADMAP|PLAN|BLOCKED|HANDOFF|CI-POINTERS)\.md$/.test(file) || /^lanes\/[^/]+\.(md|tsv)$/.test(file)) return 'ledger';
    if (/^docs\/generated\//.test(file)) return 'code';
    // A dated run receipt records the pin it was MEASURED at; moving that sha
    // on a pin bump would falsify the evidence. Its own role rather than
    // 'ledger' because it is still judged: previous pins pass, a vendored
    // commit that was never a pin does not (see the header).
    if (/^docs\/receipts\/[^/]+\.json$/.test(file)) return 'receipt';
    // Original model-source READMEs record checks at a fixed app snapshot.
    // They keep that measured pin, with the same never-pinned-SHA rejection
    // as run receipts. Executable/model/JSON siblings remain current inputs.
    if (/^test\/fixtures\/model-files\/[^/]+-source\/README\.(txt|md)$/.test(file)) return 'receipt';
    // This imported source archive also records its capture's compiler pin.
    if (['test/fixtures/model-files/crossglide-source/SOURCES.txt', 'test/fixtures/model-files/resonance-lab-source/SOURCES.txt', 'test/helpers/resonance/original-inputs.json'].includes(file)) return 'receipt';
    if (/^docs\/.*\.md$/.test(file)) return 'docs-prose';
    // An example's prose cites where its circuit was generated and
    // bench-verified, e.g. "verified in bw-circuit-ui at revision <sha>". That
    // is narrative about a commit, which is exactly why docs/**.md is exempt;
    // the only difference is which directory the prose lives in. Moving the sha
    // on a pin bump would claim a verification nobody performed.
    if (/^overlay\/scratch-gui\/examples\/.*\.md$/.test(file)) return 'docs-prose';
    if (/^packages\//.test(file)) return 'skip';
    return 'code';
};
const COMMENT = /^\s*(\/\/|\*|\/\*|#(?!!))/;
const CODE_EXT = /\.(m?js|cjs|jsx|ts|yml|yaml|sh)$/;

// These are occurrence roles, not file roles. A small non-executing lexical
// reader distinguishes declarations from comments/quoted lookalikes. Unknown
// or unfinished syntax refuses the exception; normal stale-pin scanning stays
// in charge. It never imports or executes Python or the inline test program.
const historicalTokens = (text, python = false) => {
    const tokens = []; let at = 0, depth = 0;
    const push = (kind, start, end) => tokens.push({kind, text: text.slice(start, end),
        start, end, depth, column: start - text.lastIndexOf('\n', start - 1) - 1});
    while (at < text.length) {
        const start = at, char = text[at];
        if (/\s/.test(char)) { at++; continue; }
        if ((python && char === '#') || (!python && text.startsWith('//', at))) {
            const end = text.indexOf('\n', at); at = end < 0 ? text.length : end; continue;
        }
        if (!python && text.startsWith('/*', at)) {
            const end = text.indexOf('*/', at + 2); if (end < 0) return null;
            at = end + 2; continue;
        }
        let quoteAt = at;
        if (python) {
            const prefix = text.slice(at).match(/^(?:br|rb|fr|rf|r|u|b|f)(?=['"])/i);
            if (prefix) quoteAt += prefix[0].length;
        }
        if (text[quoteAt] === "'" || text[quoteAt] === '"' || (!python && char === '`')) {
            const quote = text[quoteAt], triple = python && text.startsWith(quote.repeat(3), quoteAt);
            const terminator = triple ? quote.repeat(3) : quote; at = quoteAt + terminator.length;
            let closed = false;
            while (at < text.length) {
                if (text[at] === '\\') { at += 2; continue; }
                if (text.startsWith(terminator, at)) { at += terminator.length; closed = true; break; }
                if (!triple && quote !== '`' && /[\r\n]/.test(text[at])) return null;
                at++;
            }
            if (!closed) return null; push('string', start, at); continue;
        }
        // Only needed for the bounded JS prefixes before the two declarations;
        // regexp bodies are opaque, including quotes and bracket characters.
        if (!python && char === '/' && (!tokens.length || /^(?:[=(:,!\[{};?]|return)$/.test(tokens.at(-1).text))) {
            at++; let bracket = false, closed = false;
            while (at < text.length && !/[\r\n]/.test(text[at])) {
                if (text[at] === '\\') { at += 2; continue; }
                if (text[at] === '[') bracket = true;
                if (text[at] === ']') bracket = false;
                if (text[at] === '/' && !bracket) { at++; closed = true; break; }
                at++;
            }
            if (!closed) return null;
            while (/[a-z]/i.test(text[at] || '0')) at++;
            push('regexp', start, at); continue;
        }
        const name = text.slice(at).match(/^[A-Za-z_][A-Za-z_0-9]*/);
        if (name) { at += name[0].length; push('name', start, at); continue; }
        push('punctuation', at, at + 1); at++;
        if ('([{'.includes(char)) depth++;
        if (')]}'.includes(char) && --depth < 0) return null;
    }
    return depth === 0 ? tokens : null;
};

const historicalLine = (text, token) => text.slice(text.lastIndexOf('\n', token.start - 1) + 1,
    text.indexOf('\n', token.start) < 0 ? text.length : text.indexOf('\n', token.start));
const historicalFunction = (tokens, name, indent, text) => {
    const found = tokens.filter((t, i) => t.text === 'def' && t.column === indent &&
        t.depth === 0 && tokens[i + 1]?.text === name);
    if (found.length !== 1) return null;
    const start = found[0].start;
    const end = tokens.find(t => t.start > start && t.kind === 'name' &&
        ['def', 'class'].includes(t.text) && t.depth === 0 && t.column <= indent)?.start ?? text.length;
    return {start, end};
};

// The nonexported profile input is only a seam for manufactured portable tests.
// The public wrapper below always selects the source-fixed reviewed profiles.
const historicalCuiSpansForProfile = (file, text, known, profiles) => {
    const pin = HISTORICAL_X86_CUI_V5_V7;
    if (!known.current.has(CURRENT_X86_CUI) || known.current.has(pin) ||
        known.previous.get(pin)?.repo !== 'bw-circuit-ui') return [];
    const quoted = `'${pin}'`;
    if (file === 'test/pin-move-chain.test.mjs') {
        const line = `const HISTORICAL_X86_CUI_V5_V7 = ${quoted};`;
        const rows = [...text.matchAll(/^const HISTORICAL_X86_CUI_V5_V7 = .*$/gm)];
        if (rows.length !== 1 || rows[0][0] !== line) return [];
        const end = rows[0].index + line.length, tokens = historicalTokens(text.slice(0, end));
        const declaration = tokens?.find(t => t.start === rows[0].index && t.text === 'const' && t.depth === 0 && t.column === 0);
        return declaration ? [rows[0].index + line.indexOf(pin)] : [];
    }
    const profile = profiles[file];
    if (!profile || Buffer.byteLength((profile.concurrencyControl ? hddHistoricalHashBody(file, text) : text)) !== profile.bytes ||
        createHash('sha256').update((profile.concurrencyControl ? hddHistoricalHashBody(file, text) : text)).digest('hex') !== profile.sha256) return []; // REVIEWED_BODY_GUARD
    if (file === 'scripts/run-i80386-hdd-gui-actual.py') {
        const tokens = historicalTokens(text, true);
        if (!tokens || tokens.some(t => t.kind === 'name' && t.text === 'globals')) return [];
        const currentDeclarations = [
            ['CUI', `CUI = '${CURRENT_X86_CUI}'`],
            ['CURRENT_BOARD', `CURRENT_BOARD = '${HISTORICAL_X86_CURRENT_BOARD}'`],
            ['SB3', `SB3 = '${HISTORICAL_X86_SB3}'`],
            ['CURRENT_SB3', `CURRENT_SB3 = '${HISTORICAL_X86_SB3}'`],
            ['FINITE_V7_PINS', HISTORICAL_X86_FINITE_V7_PINS],
            ['FINITE_V8_PINS', HISTORICAL_X86_FINITE_V8_PINS],
            ['FINITE_V9_PINS', CURRENT_X86_FINITE_V9_PRODUCER],
        ];
        if (currentDeclarations.some(([name, line]) => {
            const declared = tokens.filter(t => t.kind === 'name' && t.text === name && t.column === 0 && t.depth === 0);
            return declared.length !== 1 || historicalLine(text, declared[0]) !== line;
        })) return [];
        const names = tokens.filter(t => t.kind === 'name' && t.text === 'HISTORICAL_CUI');
        if (names.length !== 2 || names[0].column !== 0 || names[0].depth !== 0 ||
            historicalLine(text, names[0]) !== `HISTORICAL_CUI = ${quoted}` ||
            tokens.some(t => t.kind === 'string' && t.text.includes('HISTORICAL_CUI'))) return [];
        const range = historicalFunction(tokens, 'execute', 0, text);
        const legacyFallback = "(request['dependencyPins'] if request['schema']=='bw.gui-hdd.actual-request.v8' else\n" +
            "              {'bw-board': BOARD, 'bw-circuit-ui': HISTORICAL_CUI, 'sb3-creator': SB3})";
        const sameJobFallback = "(request['dependencyPins'] if request['schema'] in ('bw.gui-hdd.actual-request.v8','bw.gui-hdd.actual-request.v9') else\n" +
            "              {'bw-board': BOARD, 'bw-circuit-ui': HISTORICAL_CUI, 'sb3-creator': SB3})";
        const candidates = [legacyFallback, sameJobFallback].filter(value => text.includes(value));
        if (candidates.length !== 1) return [];
        const fallback = candidates[0], where = text.indexOf(fallback);
        if (!range || names[1].start < range.start || names[1].start >= range.end ||
            where < range.start || where >= range.end || where !== text.lastIndexOf(fallback)) return [];
        const use = where + fallback.indexOf('HISTORICAL_CUI');
        return use === names[1].start ? [names[0].start + `HISTORICAL_CUI = '`.length] : [];
    }
    if (file !== 'test/i80386-hdd-gui-actual.test.mjs') return [];
    const opening = 'const controls = String.raw`\n', begin = text.indexOf(opening);
    if (begin < 0 || begin !== text.lastIndexOf(opening)) return [];
    const prefix = historicalTokens(text.slice(0, begin + opening.length - 2));
    if (!prefix || prefix.slice(-6).map(t => t.text).join(' ') !== 'const controls = String . raw' ||
        prefix.at(-6).column !== 0 || prefix.at(-6).depth !== 0) return [];
    const start = begin + opening.length, end = text.indexOf('\n`;\n', start);
    if (end < 0) return [];
    const python = text.slice(start, end); if (python.includes('${')) return [];
    const tokens = historicalTokens(python, true); if (!tokens) return [];
    const method = 'test_actual_v8_real_originals_seal_and_bounded_git_envelopes';
    const range = historicalFunction(tokens, method, 4, python);
    const classes = tokens.filter((t, i) => t.text === 'class' && t.column === 0 && tokens[i + 1]?.text === 'Originals');
    const classEnd = classes.length === 1 ? (tokens.find(t => t.start > classes[0].start &&
        ['class', 'def'].includes(t.text) && t.depth === 0 && t.column === 0)?.start ?? python.length) : 0;
    const names = tokens.filter(t => t.kind === 'name' && t.text === 'old_pin');
    if (!range || classes.length !== 1 || range.start < classes[0].start || range.end > classEnd ||
        historicalLine(python, tokens.find(t => t.start === range.start)) !== `    def ${method}(self):` ||
        names.length !== 4 || names.some(t => t.start < range.start || t.start >= range.end) ||
        historicalLine(python, names[0]) !== `            old_pin=${quoted}` ||
        tokens.some(t => t.kind === 'string' && t.text.includes('old_pin'))) return [];
    const uses = ["external_drift['dependencyPins']['bw-circuit-ui']=old_pin",
        "result['dependencyPins']['bw-circuit-ui']=old_pin",
        "vendor_envelope=D(raw_vendor[vendor_role]);vendor=E({'bw-board':c.CURRENT_BOARD,'bw-circuit-ui':old_pin,'sb3-creator':c.SB3})"];
    if (names.slice(1).some((t, i) => historicalLine(python, t) !== '            ' + uses[i])) return [];
    return [start + names[0].start + `old_pin='`.length];
};

/** Offsets only; callers cannot supply or refresh reviewed source profiles. */
export const historicalCuiSpans = (file, text, known) =>
    historicalCuiSpansForProfile(file, text, known, HISTORICAL_X86_SOURCE_PROFILES);

// Admit only the old Board declaration in each reviewed Python body. A
// different or newly routed current use changes that whole body and revokes
// the role until a separate source/profile review. Only the three exact
// reviewed bodies above can use their named historical positions.
const historicalBoardSpansForProfile = (file, text, known, profiles) => {
    const pin = HISTORICAL_X86_BOARD;
    if (!known.current.has(HISTORICAL_X86_CURRENT_BOARD) || known.current.has(pin) ||
        known.previous.get(pin)?.repo !== 'bw-board') return [];
    const quoted = `'${pin}'`;
    if (file === 'test/pin-move-chain.test.mjs') {
        const line = `const HISTORICAL_X86_BOARD = ${quoted};`;
        const rows = [...text.matchAll(/^const HISTORICAL_X86_BOARD = .*$/gm)];
        if (rows.length !== 1 || rows[0][0] !== line) return [];
        const end = rows[0].index + line.length, tokens = historicalTokens(text.slice(0, end));
        const declaration = tokens?.find(t => t.start === rows[0].index && t.text === 'const' && t.depth === 0 && t.column === 0);
        return declaration ? [rows[0].index + line.indexOf(pin)] : [];
    }
    if (!['scripts/run-i80386-hdd-gui-actual.py', 'scripts/read-i80386-hdd-gui-originals.py'].includes(file)) return [];
    const profile = profiles[file];
    if (!profile || Buffer.byteLength(text) !== profile.bytes ||
        createHash('sha256').update(text).digest('hex') !== profile.sha256) return []; // REVIEWED_BOARD_BODY_GUARD
    const tokens = historicalTokens(text, true);
    if (!tokens || tokens.some(t => t.kind === 'name' && t.text === 'globals')) return [];
    const historical = tokens.filter(t => t.kind === 'name' && t.text === 'BOARD' && t.column === 0 && t.depth === 0);
    const current = tokens.filter(t => t.kind === 'name' && t.text === 'CURRENT_BOARD' && t.column === 0 && t.depth === 0);
    if (historical.length !== 1 || current.length !== 1 ||
        historicalLine(text, historical[0]) !== `BOARD = ${quoted}` ||
        historicalLine(text, current[0]) !== `CURRENT_BOARD = '${HISTORICAL_X86_CURRENT_BOARD}'`) return [];
    const selectedMap = file === 'scripts/run-i80386-hdd-gui-actual.py' ?
        CURRENT_X86_FINITE_V9_PRODUCER : CURRENT_X86_FINITE_V9_READER;
    const declarations = [
        ['SB3', `SB3 = '${HISTORICAL_X86_SB3}'`],
        ['CURRENT_SB3', `CURRENT_SB3 = '${HISTORICAL_X86_SB3}'`],
        ['FINITE_V7_PINS', HISTORICAL_X86_FINITE_V7_PINS],
        ['FINITE_V8_PINS', HISTORICAL_X86_FINITE_V8_PINS],
        ['FINITE_V9_PINS', selectedMap],
    ];
    if (declarations.some(([name, line]) => {
        const declared = tokens.filter(t => t.kind === 'name' && t.text === name && t.column === 0 && t.depth === 0);
        return declared.length !== 1 || historicalLine(text, declared[0]) !== line;
    })) return [];
    return [historical[0].start + `BOARD = '`.length];
};

export const historicalBoardSpans = (file, text, known) =>
    historicalBoardSpansForProfile(file, text, known, HISTORICAL_X86_SOURCE_PROFILES);

// Admit the previous F7/F8 CUI pin only inside the two exact literal F7/F8 maps
// of each reviewed Python body, and only while the body routes the current CUI
// through the exact CURRENT_X86_CUI declaration and F9 through current symbols.
// Any other occurrence, a never-shipped pin, or a changed body is not admitted.
const historicalV8CuiSpansForProfile = (file, text, known, profiles) => {
    const pin = HISTORICAL_X86_V8_CUI;
    if (!known.current.has(CURRENT_X86_CUI) || known.current.has(pin) ||
        known.previous.get(pin)?.repo !== 'bw-circuit-ui') return [];
    const quoted = `'${pin}'`;
    if (file === 'test/pin-move-chain.test.mjs') {
        const line = `const HISTORICAL_X86_V8_CUI = ${quoted};`;
        const rows = [...text.matchAll(/^const HISTORICAL_X86_V8_CUI = .*$/gm)];
        if (rows.length !== 1 || rows[0][0] !== line) return [];
        const end = rows[0].index + line.length, tokens = historicalTokens(text.slice(0, end));
        const declaration = tokens?.find(t => t.start === rows[0].index && t.text === 'const' && t.depth === 0 && t.column === 0);
        return declaration ? [rows[0].index + line.indexOf(pin)] : [];
    }
    const producer = file === 'scripts/run-i80386-hdd-gui-actual.py';
    if (!producer && file !== 'scripts/read-i80386-hdd-gui-originals.py') return [];
    const profile = profiles[file];
    if (!profile || Buffer.byteLength(text) !== profile.bytes ||
        createHash('sha256').update(text).digest('hex') !== profile.sha256) return []; // REVIEWED_V8_CUI_BODY_GUARD
    const tokens = historicalTokens(text, true);
    if (!tokens || tokens.some(t => t.kind === 'name' && t.text === 'globals')) return [];
    const declarations = [
        producer ? ['CUI', `CUI = '${CURRENT_X86_CUI}'`] : ['CUI_V8', `CUI_V8 = '${CURRENT_X86_CUI}'`],
        ['FINITE_V7_PINS', HISTORICAL_X86_FINITE_V7_PINS],
        ['FINITE_V8_PINS', HISTORICAL_X86_FINITE_V8_PINS],
        ['FINITE_V9_PINS', producer ? CURRENT_X86_FINITE_V9_PRODUCER : CURRENT_X86_FINITE_V9_READER],
    ];
    const found = [];
    for (const [name, line] of declarations) {
        const declared = tokens.filter(t => t.kind === 'name' && t.text === name && t.column === 0 && t.depth === 0);
        if (declared.length !== 1 || historicalLine(text, declared[0]) !== line) return [];
        found.push(declared[0]);
    }
    if (text.split(quoted).length - 1 !== 2) return [];
    const inner = `'bw-circuit-ui':${quoted}`;
    return found.slice(1, 3).map(t => t.start + historicalLine(text, t).indexOf(inner) + "'bw-circuit-ui':'".length);
};

export const historicalV8CuiSpans = (file, text, known) =>
    historicalV8CuiSpansForProfile(file, text, known, HISTORICAL_X86_SOURCE_PROFILES);

// A new current epoch does not turn the consumed F7/F8/F9 identities into
// current inputs. Reuse their exact named-role readers in an explicit legacy
// context ONLY to obtain positions. judgeFile still scans every other token
// using the ORIGINAL live current/previous sets. No caller supplies profiles.
const F10_CURRENT_MAP = "FINITE_V10_PINS = {'bw-board':'" + LIVE_X86_BOARD +
    "','bw-circuit-ui':'" + LIVE_X86_CUI + "','sb3-creator':'" + LIVE_X86_SB3 + "'}";
// The F10 sb3-creator identity follows the current pin. Once it moved past
// HISTORICAL_X86_SB3, the consumed SB3/CURRENT_SB3/F7/F8 positions of the same
// reviewed bodies keep that shipped previous pin, exactly like the CUI/Board
// epochs above. A never-shipped value or any other occurrence stays red.
const sb3Moved = known => known.current.has(LIVE_X86_SB3) && !known.current.has(HISTORICAL_X86_SB3) &&
    known.previous.get(HISTORICAL_X86_SB3)?.repo === 'sb3-creator';
const historicalV10SpansForProfile = (file, text, known, profiles) => {
    if (!known.current.has(LIVE_X86_CUI) || !known.current.has(LIVE_X86_BOARD) ||
        known.current.has(CURRENT_X86_CUI) || known.current.has(HISTORICAL_X86_CURRENT_BOARD) ||
        known.previous.get(CURRENT_X86_CUI)?.repo !== 'bw-circuit-ui' ||
        known.previous.get(HISTORICAL_X86_CURRENT_BOARD)?.repo !== 'bw-board') return [];
    const moved = sb3Moved(known);
    const legacy = {...known, current: new Set([...known.current, CURRENT_X86_CUI, HISTORICAL_X86_CURRENT_BOARD,
        ...(moved ? [HISTORICAL_X86_SB3] : [])])};
    const policy = file === 'test/pin-move-chain.test.mjs';
    const producer = file === 'scripts/run-i80386-hdd-gui-actual.py';
    const reader = file === 'scripts/read-i80386-hdd-gui-originals.py';
    const control = file === 'test/i80386-hdd-gui-actual.test.mjs';
    if (!policy && !producer && !reader && !control) return [];
    if (!policy) {
        const profile = profiles[file];
        if (!profile || Buffer.byteLength((profile.concurrencyControl ? hddHistoricalHashBody(file, text) : text)) !== profile.bytes ||
            createHash('sha256').update((profile.concurrencyControl ? hddHistoricalHashBody(file, text) : text)).digest('hex') !== profile.sha256) return []; // REVIEWED_F10_BODY_GUARD
    }
    const slots = [];
    if (policy) {
        for (const [name, pin] of [['CURRENT_X86_CUI', CURRENT_X86_CUI],
            ['HISTORICAL_X86_CURRENT_BOARD', HISTORICAL_X86_CURRENT_BOARD],
            ...(moved ? [['HISTORICAL_X86_SB3', HISTORICAL_X86_SB3]] : [])]) {
            const line = `const ${name} = '${pin}';`;
            const rows = [...text.matchAll(new RegExp('^const ' + name + ' = .*$', 'gm'))];
            if (rows.length !== 1 || rows[0][0] !== line) return [];
            const tokens = historicalTokens(text.slice(0, rows[0].index + line.length));
            if (!tokens?.some(t => t.start === rows[0].index && t.text === 'const' &&
                t.depth === 0 && t.column === 0)) return [];
            slots.push(rows[0].index + line.indexOf(pin));
        }
    } else if (producer || reader) {
        const tokens = historicalTokens(text, true);
        if (!tokens || tokens.some(t => t.kind === 'name' && t.text === 'globals')) return [];
        const cuiName = producer ? 'CUI' : 'CUI_V8';
        const declarations = [
            ['BOARD', `BOARD = '${HISTORICAL_X86_BOARD}'`],
            ['CURRENT_BOARD', `CURRENT_BOARD = '${HISTORICAL_X86_CURRENT_BOARD}'`],
            [cuiName, `${cuiName} = '${CURRENT_X86_CUI}'`],
            ['SB3', `SB3 = '${HISTORICAL_X86_SB3}'`],
            ['CURRENT_SB3', `CURRENT_SB3 = '${HISTORICAL_X86_SB3}'`],
            ['FINITE_V7_PINS', HISTORICAL_X86_FINITE_V7_PINS],
            ['FINITE_V8_PINS', HISTORICAL_X86_FINITE_V8_PINS],
            ['FINITE_V9_PINS', producer ? CURRENT_X86_FINITE_V9_PRODUCER : CURRENT_X86_FINITE_V9_READER],
            ['FINITE_V10_PINS', F10_CURRENT_MAP],
        ];
        const positions = new Map();
        for (const [name, line] of declarations) {
            const found = tokens.filter(t => t.kind === 'name' && t.text === name && t.column === 0 && t.depth === 0);
            if (found.length !== 1 || historicalLine(text, found[0]) !== line) return [];
            positions.set(name, found[0].start);
        }
        const pin = HISTORICAL_X86_CURRENT_BOARD;
        if (text.split(`'${pin}'`).length - 1 !== 3 ||
            text.split(`'${CURRENT_X86_CUI}'`).length - 1 !== 1) return [];
        for (const name of ['CURRENT_BOARD', 'FINITE_V7_PINS', 'FINITE_V8_PINS']) {
            const line = declarations.find(([key]) => key === name)[1];
            slots.push(positions.get(name) + line.indexOf(pin));
        }
        slots.push(positions.get(cuiName) + declarations.find(([key]) => key === cuiName)[1].indexOf(CURRENT_X86_CUI));
        if (moved) {
            if (text.split(`'${HISTORICAL_X86_SB3}'`).length - 1 !== 4) return [];
            for (const name of ['SB3', 'CURRENT_SB3', 'FINITE_V7_PINS', 'FINITE_V8_PINS']) {
                const line = declarations.find(([key]) => key === name)[1];
                slots.push(positions.get(name) + line.indexOf(`'${HISTORICAL_X86_SB3}'`) + 1);
            }
        }
    }
    return [...new Set([...slots,
        ...historicalCuiSpansForProfile(file, text, legacy, profiles),
        ...historicalBoardSpansForProfile(file, text, legacy, profiles),
        ...historicalV8CuiSpansForProfile(file, text, legacy, profiles)])];
};
export const historicalV10Spans = (file, text, known) =>
    historicalV10SpansForProfile(file, text, known, HISTORICAL_X86_SOURCE_PROFILES);

// This completed-study workflow changed only scheduler policy. Project that
// exact reviewed block back to its consumed predecessor; the original full-body
// digest still rejects every other byte. No job, pin, trigger or cap is normalized.
const REVIEWED_STUDY_CONCURRENCY = "concurrency:\n" +
    "  group: ${{ github.workflow }}${{ !(github.ref_type != 'tag' && (github.event_name == 'push' || github.event_name == 'pull_request')) && format('-isolated-{0}', github.run_id) || '' }}-${{ github.ref }}\n" +
    "  cancel-in-progress: ${{ github.ref_type != 'tag' && (github.event_name == 'push' || github.event_name == 'pull_request') }}\n";
const PREVIOUS_STUDY_CONCURRENCY = "concurrency:\n" +
    "  group: reference-qualified-instruments-${{ github.event_name }}-${{ github.sha }}\n" +
    "  cancel-in-progress: false\n\n";
const studyBeforeReviewedConcurrency = text => {
    const error = 'sealed completed-study source changed: exact reviewed scheduler policy required';
    assert.equal((text.match(/^concurrency:/gm) || []).length, 1, error);
    assert.equal(text.split(REVIEWED_STUDY_CONCURRENCY).length, 2, error);
    return text.replace(REVIEWED_STUDY_CONCURRENCY, PREVIOUS_STUDY_CONCURRENCY);
};

const sealedStudyBody = (file, text) => file === '.github/workflows/reference-qualified-instruments.yml' ?
    studyBeforeReviewedConcurrency(text) : text;

/**
 * Judge one file's text. Pure; the mutation tests plant shas through it.
 * @param {string} file - repo-relative path
 * @param {string} text
 * @param {{current: Set<string>, previous: Map<string, object>, history: Map<string, string>}} known
 * @returns {Array<{file: string, line: number, sha: string, repo: string, was: string}>}
 */
export const judgeFile = (file, text, known, frozenAdmissions = new Map()) => {
    const role = roleOf(file);
    if (role !== 'code' && role !== 'receipt') return [];
    if (Object.hasOwn(SEALED_STUDY_FILES, file)) {
        assert.equal(studyBeforeConcurrencyPolicy(file, text), sealedStudyBody(file, text),
            'reviewed completed-study projections preserve the same historical bytes');
        assert.equal(createHash('sha256').update(studyBeforeConcurrencyPolicy(file, text)).digest('hex'), SEALED_STUDY_FILES[file],
            `${file}: sealed completed-study source changed; preserve the consumed experiment`);
    }
    let body = text;
    if (file === PROVENANCE) {
        // the one history FIELD, exempt by role (see header); everything else in the manifest must be the pin
        try { const m = JSON.parse(text); if (m.source && m.source.lastTouchedBy && m.source.lastTouchedBy.sha) body = text.split(m.source.lastTouchedBy.sha).join('<lastTouchedBy>'); } catch { /* judged as text */ }
    }
    const admission = frozenAdmissions.get(file);
    if (admission) {
        assert.equal(createHash('sha256').update(text).digest('hex'), admission.sha256, 'frozen bytes remain bound at judgment');
        assert.equal(blobOf(Buffer.from(text)), admission.gitBlob);
    }
    if (admission && known.previous.get(admission.value)?.repo === admission.repo) {
        // Only a fully source-bound constant token is historical. Every other
        // byte, including another old pin on this line, remains ordinary code.
        const bytes = Buffer.from(body);
        assert.equal(bytes.subarray(...admission.span).toString(), admission.value);
        body = Buffer.concat([bytes.subarray(0, admission.span[0]), Buffer.alloc(40, 32), bytes.subarray(admission.span[1])]).toString();
    }
    const historical = new Set([...historicalCuiSpans(file, text, known),
        ...historicalBoardSpans(file, text, known), ...historicalV8CuiSpans(file, text, known),
        ...historicalV10Spans(file, text, known)]);
    const out = []; let lineAt = 0;
    body.split('\n').forEach((line, i) => {
        const offset = lineAt; lineAt += line.length + 1;
        if (CODE_EXT.test(file) && COMMENT.test(line)) return;
        for (const m of line.matchAll(HEX40)) {
            const sha = m[0];
            if (historical.has(offset + m.index)) continue;
            if (known.current.has(sha)) continue;
            const p = known.previous.get(sha);
            if (p && role === 'receipt') continue;   // the pin it was measured at: history, kept as evidence
            const repo = p ? p.repo : known.history.get(sha);
            if (!repo) continue;
            out.push({file, line: i + 1, sha, repo, was: p ? `the ${p.repo} pin until lite ${p.replacedIn} (${p.on})`
                : `a ${repo} commit that was never a pin${role === 'receipt' ? ' (a receipt may record only a pin, current or previous)' : ''}`});
        }
    });
    return out;
};

// Frozen executable contracts keep their original candidate refusal. This is
// an exact constant role, never a file exemption or permission to run them on
// a newer candidate. Roles are code-owned; the receipt cannot add a role.
const FROZEN_ADMISSIONS = 'docs/receipts/frozen-control-pin-admissions.json';
const FROZEN_SCOPE = 'Exact frozen executable admission/reference contracts, not current supplier inputs or runtime qualification. Controllers remain unchanged and cannot qualify a new candidate.';
// The robot WebKit controller key is joined from parts: a literal path here
// would make the browser-scope census treat every sim-lab gate as a
// prerequisite of all shards (this test is reachable from a prerequisite step).
const frozenRoles = new Map([
    [['scripts', 'qualify-robot-model-webkit.mjs'].join('/'), {field:'FROZEN.producerSha', pattern:/^    "producerSha": "([0-9a-f]{40})",$/gm}],
    ['scripts/read-i80386-hdd-gui-originals.py', {field:'SB3', pattern:/^SB3 = '([0-9a-f]{40})'$/gm}],
    ['scripts/run-i80386-hdd-gui-actual.py', {field:'SB3', pattern:/^SB3 = '([0-9a-f]{40})'$/gm}]
]);
const exactFields = (value, keys) => {
    assert.ok(value && typeof value === 'object' && !Array.isArray(value));
    assert.deepEqual(Object.keys(value).sort(), [...keys].sort());
};
const blobOf = bytes => createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
export function validateFrozenAdmissions(manifest, observations, knownPins, pins) {
    exactFields(manifest, ['schema','scope','files']);
    assert.equal(manifest.schema, 'bw.frozen-control-pin-admissions.v1');
    assert.equal(manifest.scope, FROZEN_SCOPE);
    assert.ok(Array.isArray(manifest.files));
    assert.equal(manifest.files.length, frozenRoles.size);
    const admitted = new Map();
    for (const row of manifest.files) {
        exactFields(row, ['file','mode','sha256','gitBlob','field','repo','value','span']);
        const role = frozenRoles.get(row.file);
        assert.ok(role && !admitted.has(row.file), 'unique supported frozen file role');
        assert.equal(row.field, role.field); assert.equal(row.repo, 'sb3-creator');
        assert.equal(row.mode, '100644');
        assert.match(row.sha256, /^[0-9a-f]{64}$/); assert.match(row.gitBlob, /^[0-9a-f]{40}$/);
        assert.match(row.value, /^[0-9a-f]{40}$/);
        assert.ok(pins[row.repo] === row.value || knownPins.previous.get(row.value)?.repo === row.repo,
            'frozen admission is a shipped pin of its exact supplier');
        const observed = observations.get(row.file);
        assert.ok(observed && observed.regular, 'actual regular frozen file');
        assert.equal(observed.mode, row.mode); assert.equal(observed.gitBlob, row.gitBlob);
        const bytes = observed.bytes;
        assert.ok(Buffer.isBuffer(bytes));
        assert.equal(createHash('sha256').update(bytes).digest('hex'), row.sha256);
        assert.equal(blobOf(bytes), row.gitBlob, 'whole live bytes equal the tracked Git blob');
        const text = bytes.toString('utf8'), matches = [...text.matchAll(new RegExp(role.pattern))];
        assert.equal(matches.length, 1, 'one exact supported constant declaration');
        const match = matches[0], start = Buffer.byteLength(text.slice(0, match.index + match[0].indexOf(match[1])));
        assert.equal(match[1], row.value);
        assert.deepEqual(row.span, [start, start + 40], 'exact constant token byte span');
        admitted.set(row.file, row);
    }
    assert.deepEqual([...admitted.keys()].sort(), [...frozenRoles.keys()].sort());
    return admitted;
}
function parseFrozenAdmissionReceipt(text) {
    const manifest = JSON.parse(text);
    assert.equal(text, JSON.stringify(manifest, null, 2) + '\n', 'canonical receipt excludes duplicate or ambiguous JSON keys');
    return manifest;
}
function frozenAdmissionInventory() {
    const manifest = parseFrozenAdmissionReceipt(readFileSync(path.join(ROOT, FROZEN_ADMISSIONS), 'utf8'));
    const observations = new Map();
    for (const file of frozenRoles.keys()) {
        const stat = lstatSync(path.join(ROOT, file));
        const entries = git(ROOT, 'ls-files', '--stage', '-z', '--', file).split('\0').filter(Boolean);
        assert.equal(entries.length, 1, 'one tracked frozen file');
        const match = /^(100644|100755) ([0-9a-f]{40}) 0\t(.+)$/.exec(entries[0]);
        assert.ok(match && match[3] === file, 'regular stage-zero tracked frozen file');
        observations.set(file, {regular:stat.isFile(), mode:stat.mode & 0o111 ? '100755' : '100644',
            gitBlob:match[2], bytes:readFileSync(path.join(ROOT, file))});
        assert.equal(match[1], observations.get(file).mode, 'live/tracked file mode');
    }
    return validateFrozenAdmissions(manifest, observations, known, currentPins());
}

const formatFindings = f => f.map(x => `${x.file}:${x.line}  ${x.sha.slice(0, 9)}  ${x.was}; current ${x.repo} pin is ${currentPins()[x.repo].slice(0, 9)}`).join('\n  ');

// ---- sources ---------------------------------------------------------------

const previousPinsFromHistory = () => {
    const count = Number(git(ROOT, 'rev-list', '--count', 'HEAD', '--', 'vendor-pins.json').trim());
    const shallow = git(ROOT, 'rev-parse', '--is-shallow-repository').trim() === 'true';
    // `-p` reads file CONTENT, which is the operation that needs blobs a
    // blobless clone has not fetched yet.
    const log = gitReadingContent(ROOT, 'log', '--diff-merges=first-parent', '-p', '--format=COMMIT %H %ad', '--date=short', '--', 'vendor-pins.json');
    return {count, shallow, previous: parsePreviousPins(log, new Set(Object.values(currentPins())))};
};

const repoHistory = () => {
    const history = new Map();
    const where = {};
    for (const repo of REPOS) {
        const dir = process.env[ENV_DIR[repo]] || (process.env.BW_VENDOR_HISTORY_DIR && [`${repo}.git`, repo].map(d => path.join(process.env.BW_VENDOR_HISTORY_DIR, d)).find(existsSync)) || '';
        if (!dir) continue;
        const head = git(dir, 'rev-parse', 'HEAD').trim();
        assert.match(head, /^[0-9a-f]{40}$/, `${dir} is set for ${repo} but git could not read a HEAD there`);
        const shas = git(dir, 'rev-list', '--all').split('\n').filter(Boolean);
        assert.ok(shas.length > 100, `${dir} holds only ${shas.length} commits for ${repo} — not its history`);
        for (const s of shas) history.set(s, repo);
        where[repo] = `${dir} (${shas.length} commits)`;
    }
    return {history, where};
};

const trackedCodeFiles = () => git(ROOT, 'ls-files', '-z').split('\0').filter(f => f && roleOf(f) === 'code');

// ---- the gate --------------------------------------------------------------

const {count, shallow, previous} = previousPinsFromHistory();
const {history, where} = repoHistory();
const current = new Set(REPOS.map(repo => currentPins()[repo]));
const known = {current, previous, history};

const historicalRoleFixtures = () => {
    const pin = HISTORICAL_X86_CUI_V5_V7;
    const producer = `HISTORICAL_CUI = '${pin}'\n` +
        `CUI = '${CURRENT_X86_CUI}'\n` +
        `CURRENT_BOARD = '${HISTORICAL_X86_CURRENT_BOARD}'\n` +
        `SB3 = '${HISTORICAL_X86_SB3}'\n` +
        `CURRENT_SB3 = '${HISTORICAL_X86_SB3}'\n` +
        HISTORICAL_X86_FINITE_V7_PINS + "\n" +
        HISTORICAL_X86_FINITE_V8_PINS + "\n" +
        CURRENT_X86_FINITE_V9_PRODUCER + "\n" +
        "def execute(request):\n    pins = (request['dependencyPins'] if request['schema']=='bw.gui-hdd.actual-request.v8' else\n" +
        "              {'bw-board': BOARD, 'bw-circuit-ui': HISTORICAL_CUI, 'sb3-creator': SB3})\n";
    const method = 'test_actual_v8_real_originals_seal_and_bounded_git_envelopes';
    const python = `class Originals(unittest.TestCase):\n    def ${method}(self):\n        try:\n` +
        `            old_pin='${pin}'\n` +
        "            external_drift['dependencyPins']['bw-circuit-ui']=old_pin\n" +
        "            result['dependencyPins']['bw-circuit-ui']=old_pin\n" +
        "            vendor_envelope=D(raw_vendor[vendor_role]);vendor=E({'bw-board':c.CURRENT_BOARD,'bw-circuit-ui':old_pin,'sb3-creator':c.SB3})\n        finally: pass\n";
    const control = 'const controls = String.raw`\n' + python + '\n`;\n';
    const producerPath = 'scripts/run-i80386-hdd-gui-actual.py', controlPath = 'test/i80386-hdd-gui-actual.test.mjs';
    const profile = text => ({bytes: Buffer.byteLength(text), sha256: createHash('sha256').update(text).digest('hex')});
    return {pin, producer, control, method, producerPath, controlPath, policyPath: 'test/pin-move-chain.test.mjs',
        profiles: {[producerPath]: profile(producer), [controlPath]: profile(control)}};
};
const historicalTestKnown = () => ({current: new Set([CURRENT_X86_CUI]),
    previous: new Map([[HISTORICAL_X86_CUI_V5_V7, {repo: 'bw-circuit-ui', replacedIn: 'fixture', on: 'fixture'}]]),
    history: new Map()});
const historicalFixtureSpans = f => (file, text, known) =>
    historicalCuiSpansForProfile(file, text, known, f.profiles);
const historicalJudgeWith = (recognize, recognizeBoard = () => [], recognizeV8 = () => [], recognizeV10 = () => []) => vm.runInNewContext(`(${judgeFile.toString()})`,
    {roleOf, PROVENANCE, COMMENT, CODE_EXT, HEX40, SEALED_STUDY_FILES, assert, createHash, studyBeforeConcurrencyPolicy, sealedStudyBody,
        historicalCuiSpans: recognize,
        historicalBoardSpans: recognizeBoard, historicalV8CuiSpans: recognizeV8, historicalV10Spans: recognizeV10});

test('three exact historical CUI occurrences are previous-pin roles, not code-file exemptions', () => {
    const f = historicalRoleFixtures(), k = historicalTestKnown();
    const recognize = historicalFixtureSpans(f), judge = historicalJudgeWith(recognize);
    assert.equal(previous.get(f.pin)?.repo, 'bw-circuit-ui', 'the actual historical identity was shipped');
    assert.ok(!current.has(f.pin), 'historical identity is not a current pin');
    for (const [file, text] of [[f.producerPath, f.producer], [f.controlPath, f.control],
        [f.policyPath, readFileSync(path.join(ROOT, f.policyPath), 'utf8')]]) {
        assert.equal(roleOf(file), 'code');
        assert.equal(recognize(file, text, k).length, 1, file);
        assert.equal(judge(file, text, k).length, 0, file);
        const unshipped = {current: k.current, previous: new Map(), history: new Map([[f.pin, 'bw-circuit-ui']])};
        assert.equal(recognize(file, text, unshipped).length, 0, 'never-shipped is not admitted');
        assert.ok(judge(file, text, unshipped).length > 0);
    }
    for (const [file, text] of [[f.producerPath, f.producer], [f.controlPath, f.control]]) {
        assert.deepEqual(historicalCuiSpans(file, text, k, f.profiles), [], 'public wrapper ignores caller profile data');
        assert.equal(judgeFile(file, text, k).length, 1, 'production gate refuses synthetic/unreviewed bodies');
    }
});

test('historical CUI syntax/context cannot be borrowed, duplicated, quoted or redirected to current use', () => {
    const f = historicalRoleFixtures(), k = historicalTestKnown();
    const recognize = historicalFixtureSpans(f), judge = historicalJudgeWith(recognize);
    const declaration = f.producer.split('\n')[0];
    for (const text of [
        f.producer.replace('HISTORICAL_CUI =', 'CUI ='),
        f.producer.replace(declaration, '    ' + declaration),
        f.producer + declaration + '\n',
        f.producer.replace(declaration, declaration + '; CUI=HISTORICAL_CUI'),
        f.producer + 'CURRENT_CUI = HISTORICAL_CUI\n',
        f.producer + 'FINITE_V7_PINS = {"bw-circuit-ui": HISTORICAL_CUI}\n',
        f.producer.replace("=='bw.gui-hdd.actual-request.v8'", "=='bw.gui-hdd.actual-request.v7'"),
        f.producer.replace(declaration, '# ' + declaration),
        f.producer.replace(declaration, '"""\n' + declaration + '\n"""'),
        f.producer.replace('def execute', 'def other'),
        f.producer + 'current = f"{HISTORICAL_CUI}"\n',
    ]) {
        assert.equal(recognize(f.producerPath, text, k).length, 0);
        assert.ok(judge(f.producerPath, text, k).length > 0);
    }
    for (const text of [
        f.control.replace(f.method, 'test_other'), f.control.replace('class Originals', 'class Other'),
        f.control.replace('old_pin=', 'other_pin='),
        f.control.replace('            old_pin=', '        old_pin='),
        f.control.replace(`old_pin='${f.pin}'`, `old_pin='${f.pin}'; current=old_pin`),
        f.control.replace('        finally:', '            duplicate=old_pin\n        finally:'),
        f.control.replace("result['dependencyPins']['bw-circuit-ui']=old_pin", 'CURRENT_CUI=old_pin'),
        f.control.replace('const controls', 'const other'),
        '/*\n' + f.control + '\n*/',
        f.control.replace(`            old_pin='${f.pin}'`, `            """old_pin='${f.pin}'"""`),
    ]) {
        assert.equal(recognize(f.controlPath, text, k).length, 0);
        assert.ok(judge(f.controlPath, text, k).length > 0);
    }
    assert.ok(judgeFile('scripts/another.py', f.producer, k).length > 0);
    assert.ok(judgeFile('test/another.test.mjs', f.control, k).length > 0);
    const otherPastPin = 'e'.repeat(40);
    const anotherPrevious = {...k, previous: new Map([...k.previous,
        [otherPastPin, {repo: 'bw-circuit-ui', replacedIn: 'other', on: 'other'}]])};
    for (const [file, text] of [[f.producerPath, f.producer], [f.controlPath, f.control]]) {
        const changed = text.replace(f.pin, otherPastPin);
        assert.equal(recognize(file, changed, anotherPrevious).length, 0);
        assert.equal(judge(file, changed, anotherPrevious).length, 1, 'not an arbitrary previous CUI pin');
    }
    const policy = `const HISTORICAL_X86_CUI_V5_V7 = '${f.pin}';`;
    for (const text of ['/*\n' + policy + '\n*/', policy + '\n' + policy,
        policy + ' active();', `const other = '${f.pin}';`]) {
        assert.equal(recognize(f.policyPath, text, k).length, 0);
        assert.ok(judge(f.policyPath, text, k).length > 0);
    }
});

test('current input tokens remain red beside historical roles and expose broad-exemption mutants', () => {
    const f = historicalRoleFixtures(), k = historicalTestKnown();
    const judge = historicalJudgeWith(historicalFixtureSpans(f));
    const noRoles = historicalJudgeWith(() => []);
    assert.equal(noRoles(f.producerPath, f.producer, k).length, 1, 'original producer finding restored');
    assert.equal(noRoles(f.controlPath, f.control, k).length, 1, 'original control finding restored');
    const broad = historicalJudgeWith((file, text) => [...text.matchAll(HEX40)].map(m => m.index));
    for (const file of ['vendor-pins.json', 'package.json', 'package-lock.json',
        '.github/workflows/i80386-hdd-gui-actual.yml', 'scripts/current.py',
        'test/current.test.mjs', 'docs/generated/current.json']) {
        const text = `CURRENT_CUI = '${f.pin}'\n`;
        assert.equal(judgeFile(file, text, k).length, 1, file);
        assert.equal(broad(file, text, k).length, 0, 'broad mutant would miss the active plant');
    }
    for (const [file, text] of [[f.producerPath, f.producer + `CUI = '${f.pin}'\n`],
        [f.controlPath, f.control + `const active = '${f.pin}';\n`]]) {
        assert.equal(judge(file, text, k).length, 2, 'changed unreviewed body admits neither token');
        assert.equal(broad(file, text, k).length, 0);
    }
    const dynamic = "globals()['HISTORICAL' + '_CUI']";
    const aliases = [
        f.producer.replace(`CUI = '${CURRENT_X86_CUI}'`, 'CUI = ' + dynamic),
        f.producer + '\nCUI = ' + dynamic + '\n',
        f.producer + "\nglobals()['CUI'] = " + dynamic + '\n',
        f.producer + "\nglobals().update({'CUI': " + dynamic + '})\n',
        f.producer + "\nFINITE_V7_PINS['bw-circuit-ui'] = " + dynamic + '\n',
    ];
    for (const text of aliases) {
        assert.equal(historicalFixtureSpans(f)(f.producerPath, text, k).length, 0);
        assert.equal(judge(f.producerPath, text, k).length, 1, 'dynamic/current edit cannot borrow the source profile');
        assert.equal(historicalCuiSpans(f.producerPath, text, k).length, 0);
    }
    const bodyGuard = "    const profile = profiles[file];\n" +
        "    if (!profile || Buffer.byteLength((profile.concurrencyControl ? hddHistoricalHashBody(file, text) : text)) !== profile.bytes ||\n" +
        "        createHash('sha256').update((profile.concurrencyControl ? hddHistoricalHashBody(file, text) : text)).digest('hex') !== profile.sha256) return []; // REVIEWED_BODY_GUARD\n";
    const original = historicalCuiSpansForProfile.toString(), without = original.replace(bodyGuard, '');
    assert.notEqual(without, original, 'remove exactly the reviewed-body guard');
    const noBodyGuard = vm.runInNewContext(`(${without})`, {HISTORICAL_X86_CUI_V5_V7,
        CURRENT_X86_CUI, HISTORICAL_X86_V8_CUI, HISTORICAL_X86_CURRENT_BOARD,
        HISTORICAL_X86_SB3, HISTORICAL_X86_FINITE_V7_PINS, HISTORICAL_X86_FINITE_V8_PINS, CURRENT_X86_FINITE_V9_PRODUCER,
        historicalTokens, historicalLine, historicalFunction});
    assert.equal(noBodyGuard(f.producerPath, aliases[2], k, f.profiles).length, 0,
        'a split-string globals alias is refused even with a manufactured profile');
    const indirect = f.producer + "\nsetattr(sys.modules[__name__], 'CUI', getattr(sys.modules[__name__], 'HISTORICAL' + '_CUI'))\n";
    assert.equal(noBodyGuard(f.producerPath, indirect, k, f.profiles).length, 1,
        'the immutable full-body guard remains necessary for other indirect aliases');
    assert.equal(historicalFixtureSpans(f)(f.producerPath, indirect, k).length, 0);
});

const historicalBoardFixtures = () => {
    const pin = HISTORICAL_X86_BOARD;
    const producer = `BOARD = '${pin}'\nCURRENT_BOARD = '${HISTORICAL_X86_CURRENT_BOARD}'\n` +
        `SB3 = '${HISTORICAL_X86_SB3}'\n` +
        `CURRENT_SB3 = '${HISTORICAL_X86_SB3}'\n` +
        HISTORICAL_X86_FINITE_V7_PINS + "\n" +
        HISTORICAL_X86_FINITE_V8_PINS + "\n" +
        CURRENT_X86_FINITE_V9_PRODUCER + "\n" +
        "def parse_request(request):\n    if request['schema']=='bw.gui-hdd.actual-request.v8':\n" +
        "        need(request['dependencyPins']['bw-board']==CURRENT_BOARD)\n" +
        "def execute(request):\n    old = {'bw-board': BOARD}\n" +
        "    selected = CURRENT_BOARD if request['schema']=='bw.gui-hdd.actual-request.v8' else BOARD\n";
    const reader = `BOARD = '${pin}'\nCURRENT_BOARD = '${HISTORICAL_X86_CURRENT_BOARD}'\n` +
        `SB3 = '${HISTORICAL_X86_SB3}'\n` +
        `CURRENT_SB3 = '${HISTORICAL_X86_SB3}'\n` +
        HISTORICAL_X86_FINITE_V7_PINS + "\n" +
        HISTORICAL_X86_FINITE_V8_PINS + "\n" +
        CURRENT_X86_FINITE_V9_READER + "\n" +
        "def audit(request):\n    selected_board = CURRENT_BOARD if request['schema']=='bw.gui-hdd.actual-request.v8' else BOARD\n" +
        "    need(admission['boardPin']==selected_board and proof['boardPin']==selected_board)\n";
    const producerPath = 'scripts/run-i80386-hdd-gui-actual.py';
    const readerPath = 'scripts/read-i80386-hdd-gui-originals.py';
    const profile = text => ({bytes: Buffer.byteLength(text), sha256: createHash('sha256').update(text).digest('hex')});
    return {pin, producer, reader, producerPath, readerPath, policyPath: 'test/pin-move-chain.test.mjs',
        profiles: {[producerPath]: profile(producer), [readerPath]: profile(reader)}};
};
const historicalBoardTestKnown = () => ({current: new Set([HISTORICAL_X86_CURRENT_BOARD]),
    previous: new Map([[HISTORICAL_X86_BOARD, {repo: 'bw-board', replacedIn: 'fixture', on: 'fixture'}]]),
    history: new Map()});
const historicalBoardFixtureSpans = f => (file, text, known) =>
    historicalBoardSpansForProfile(file, text, known, f.profiles);

test('historical Board roles require exact reviewed producer, reader and policy positions', () => {
    const f = historicalBoardFixtures(), k = historicalBoardTestKnown();
    const recognize = historicalBoardFixtureSpans(f), judge = historicalJudgeWith(() => [], recognize);
    for (const [file, text] of [[f.producerPath, f.producer], [f.readerPath, f.reader],
        [f.policyPath, readFileSync(path.join(ROOT, f.policyPath), 'utf8')]]) {
        assert.equal(recognize(file, text, k).length, 1, file);
        assert.equal(judge(file, text, k).length, 0, file);
        const neverShipped = {...k, previous: new Map(), history: new Map([[f.pin, 'bw-board']])};
        assert.equal(recognize(file, text, neverShipped).length, 0);
        assert.ok(judge(file, text, neverShipped).length > 0);
    }
    for (const [file, text] of [[f.producerPath, f.producer], [f.readerPath, f.reader]]) {
        assert.deepEqual(historicalBoardSpans(file, text, k, f.profiles), [],
            'public gate does not accept caller-provided profiles');
        assert.equal(judgeFile(file, text, k).length, 1, 'final source profile remains unset');
    }
});

test('old Board source roles never admit current routing, aliases, moved slots or extra literals', () => {
    const f = historicalBoardFixtures(), k = historicalBoardTestKnown();
    const recognize = historicalBoardFixtureSpans(f), judge = historicalJudgeWith(() => [], recognize);
    for (const [file, source] of [[f.producerPath, f.producer], [f.readerPath, f.reader]]) {
        const mutants = [
            source.replace(`BOARD = '${f.pin}'`, `CURRENT_BOARD = '${f.pin}'`),
            source.replace(`BOARD = '${f.pin}'`, `    BOARD = '${f.pin}'`),
            source + `\nBOARD = '${f.pin}'\n`,
            source.replace("'bw-board':CURRENT_BOARD", "'bw-board':BOARD"),
            source.replace("else BOARD", "else CURRENT_BOARD"),
            source + "\nglobals()['CURRENT_BOARD'] = BOARD\n",
            source + "\ncurrent = f'{BOARD}'\n",
        ];
        for (const text of mutants) {
            assert.equal(recognize(file, text, k).length, 0);
            assert.ok(judge(file, text, k).length > 0);
        }
        assert.ok(judge('scripts/another.py', source, k).length > 0, 'wrong path refuses');
    }
    const broad = historicalJudgeWith(() => [], (file, text) => [...text.matchAll(HEX40)].map(m => m.index));
    for (const path of ['vendor-pins.json', 'package-lock.json', 'scripts/current.py',
        '.github/workflows/i80386-hdd-gui-actual.yml']) {
        const active = `CURRENT_BOARD = '${f.pin}'\n`;
        assert.equal(judgeFile(path, active, k).length, 1);
        assert.equal(broad(path, active, k).length, 0, 'broad exemption would miss current misuse');
    }
    const bodyGuard = "    const profile = profiles[file];\n" +
        "    if (!profile || Buffer.byteLength(text) !== profile.bytes ||\n" +
        "        createHash('sha256').update(text).digest('hex') !== profile.sha256) return []; // REVIEWED_BOARD_BODY_GUARD\n";
    const original = historicalBoardSpansForProfile.toString(), without = original.replace(bodyGuard, '');
    assert.notEqual(without, original);
    const noBodyGuard = vm.runInNewContext(`(${without})`, {HISTORICAL_X86_BOARD, HISTORICAL_X86_V8_CUI,
        HISTORICAL_X86_CURRENT_BOARD, HISTORICAL_X86_SB3, HISTORICAL_X86_FINITE_V7_PINS, HISTORICAL_X86_FINITE_V8_PINS,
        CURRENT_X86_FINITE_V9_PRODUCER, CURRENT_X86_FINITE_V9_READER,
        historicalTokens, historicalLine});
    const alias = f.producer + "\nglobals()['CURRENT_BOARD'] = BOARD\n";
    assert.equal(noBodyGuard(f.producerPath, alias, k, f.profiles).length, 0,
        'globals alias refuses even with manufactured profile');
    assert.equal(recognize(f.producerPath, alias, k).length, 0);
    const indirect = f.producer + "\nsetattr(sys.modules[__name__], 'CURRENT_BOARD', getattr(sys.modules[__name__], 'BO' + 'ARD'))\n";
    assert.equal(noBodyGuard(f.producerPath, indirect, k, f.profiles).length, 1,
        'the immutable full-body guard remains necessary for other indirect aliases');
    assert.equal(recognize(f.producerPath, indirect, k).length, 0);
});

test('historical F7 and F8 maps stay literal while current F9 uses exact symbols', () => {
    const cui = historicalRoleFixtures(), board = historicalBoardFixtures();
    const cases = [
        [cui.producerPath, cui.producer, historicalTestKnown(), historicalCuiSpansForProfile],
        [board.producerPath, board.producer, historicalBoardTestKnown(), historicalBoardSpansForProfile],
        [board.readerPath, board.reader, historicalBoardTestKnown(), historicalBoardSpansForProfile],
    ];
    for (const [file, source, knownRoles, recognize] of cases) {
        const coherentProfile = body => ({[file]: {bytes: Buffer.byteLength(body),
            sha256: createHash('sha256').update(body).digest('hex')}});
        assert.equal(recognize(file, source, knownRoles, coherentProfile(source)).length, 1);
        const fixed7 = source.split('\n').find(line => line.startsWith('FINITE_V7_PINS = '));
        const fixed8 = source.split('\n').find(line => line.startsWith('FINITE_V8_PINS = '));
        const current9 = source.split('\n').find(line => line.startsWith('FINITE_V9_PINS = '));
        assert.ok(fixed7 && fixed8 && current9, 'three distinct versioned maps in every body');
        assert.equal(fixed8, HISTORICAL_X86_FINITE_V8_PINS, 'F8 is a fixed historical literal');
        assert.equal(current9, file === board.readerPath ? CURRENT_X86_FINITE_V9_READER :
            CURRENT_X86_FINITE_V9_PRODUCER, 'F9 alone routes through current symbols');
        const changes = [
            [fixed7, fixed7.replace("'bw-board':'" + HISTORICAL_X86_CURRENT_BOARD + "'", "'bw-board':CURRENT_BOARD")],
            [fixed7, fixed7.replace("'bw-circuit-ui':'" + HISTORICAL_X86_V8_CUI + "'", "'bw-circuit-ui':CUI")],
            [fixed7, fixed7.replace("'sb3-creator':'" + HISTORICAL_X86_SB3 + "'", "'sb3-creator':CURRENT_SB3")],
            [fixed8, fixed8.replace("'bw-board':'" + HISTORICAL_X86_CURRENT_BOARD + "'", "'bw-board':CURRENT_BOARD")],
            [fixed8, fixed8.replace("'bw-circuit-ui':'" + HISTORICAL_X86_V8_CUI + "'", "'bw-circuit-ui':CUI")],
            [fixed8, fixed8.replace("'sb3-creator':'" + HISTORICAL_X86_SB3 + "'", "'sb3-creator':CURRENT_SB3")],
            [fixed8, current9.replace('FINITE_V9_PINS', 'FINITE_V8_PINS')],
            [current9, current9.replace("'bw-board':CURRENT_BOARD", "'bw-board':BOARD")],
            [current9, current9.replace("'bw-circuit-ui':" + (file === board.readerPath ? 'CUI_V8' : 'CUI'),
                "'bw-circuit-ui':HISTORICAL_CUI")],
            [current9, current9.replace("'sb3-creator':CURRENT_SB3", "'sb3-creator':SB3")],
            [current9, fixed8.replace('FINITE_V8_PINS', 'FINITE_V9_PINS')],
            [`CURRENT_SB3 = '${HISTORICAL_X86_SB3}'`, 'CURRENT_SB3 = SB3'],
            [`SB3 = '${HISTORICAL_X86_SB3}'`, 'SB3 = CURRENT_SB3'],
        ];
        for (const [before, after] of changes) {
            const changed = source.replace(before, after);
            assert.notEqual(changed, source, 'each cut changes the intended declaration');
            assert.equal(recognize(file, changed, knownRoles, coherentProfile(changed)).length, 0,
                'exact epoch syntax refuses even with a coherently changed body digest');
        }
        for (const suffix of ["\nCURRENT_SB3 = SB3\n", "\nglobals()['CURRENT_SB3'] = SB3\n",
            "\nFINITE_V8_PINS['sb3-creator'] = SB3\n", "\nFINITE_V9_PINS['bw-board'] = BOARD\n"]) {
            const changed = source + suffix;
            assert.ok(judgeFile(file, changed, knownRoles).length > 0,
                'unset production profile rejects later aliases, namespace writes and map redirection');
        }
    }
});

const historicalV8Fixtures = () => {
    const body = current => `${current}\n` +
        `SB3 = '${HISTORICAL_X86_SB3}'\n` +
        HISTORICAL_X86_FINITE_V7_PINS + '\n' + HISTORICAL_X86_FINITE_V8_PINS + '\n';
    const producer = body(`CUI = '${CURRENT_X86_CUI}'`) + CURRENT_X86_FINITE_V9_PRODUCER + '\n';
    const reader = body(`CUI_V8 = '${CURRENT_X86_CUI}'`) + CURRENT_X86_FINITE_V9_READER + '\n';
    const producerPath = 'scripts/run-i80386-hdd-gui-actual.py', readerPath = 'scripts/read-i80386-hdd-gui-originals.py';
    return {producer, reader, producerPath, readerPath};
};
const coherent = (file, body) => ({[file]: {bytes: Buffer.byteLength(body),
    sha256: createHash('sha256').update(body).digest('hex')}});
const historicalV8Known = () => ({current: new Set([CURRENT_X86_CUI]),
    previous: new Map([[HISTORICAL_X86_V8_CUI, {repo: 'bw-circuit-ui', replacedIn: 'fixture', on: 'fixture'}]]),
    history: new Map()});

test('the previous F7/F8 CUI pin is admitted only in the exact literal F7/F8 maps', () => {
    const f = historicalV8Fixtures(), k = historicalV8Known();
    assert.equal(previous.get(HISTORICAL_X86_V8_CUI)?.repo, 'bw-circuit-ui', 'the F7/F8 CUI was actually shipped');
    assert.ok(current.has(LIVE_X86_CUI) && !current.has(HISTORICAL_X86_V8_CUI), 'CUI moved past the F7/F8 pin');
    for (const [file, text] of [[f.producerPath, f.producer], [f.readerPath, f.reader]]) {
        const recognize = (fl, t, kn) => historicalV8CuiSpansForProfile(fl, t, kn, coherent(file, text));
        const judge = historicalJudgeWith(() => [], () => [], recognize);
        const noRoles = historicalJudgeWith(() => [], () => [], () => []);
        assert.equal(recognize(file, text, k).length, 2, file);
        assert.equal(judge(file, text, k).length, 0, file);
        assert.equal(noRoles(file, text, k).length, 2, 'both literals are red without the role');
        const unshipped = {current: k.current, previous: new Map(), history: new Map([[HISTORICAL_X86_V8_CUI, 'bw-circuit-ui']])};
        assert.equal(recognize(file, text, unshipped).length, 0, 'never-shipped is not admitted');
        const stillCurrent = {current: new Set([HISTORICAL_X86_V8_CUI]), previous: new Map(), history: new Map()};
        assert.equal(recognize(file, text, stillCurrent).length, 0, 'no role while it is the current pin');
        assert.deepEqual(historicalV8CuiSpans(file, text, k), [], 'public wrapper ignores manufactured bodies');
        assert.equal(judgeFile(file, text, k).length, 2, 'production gate refuses unreviewed bodies');
        const decl = file === f.producerPath ? 'CUI' : 'CUI_V8';
        const v9 = file === f.producerPath ? CURRENT_X86_FINITE_V9_PRODUCER : CURRENT_X86_FINITE_V9_READER;
        for (const changed of [
            text + `EXTRA = '${HISTORICAL_X86_V8_CUI}'\n`,
            text.replace(`${decl} = '${CURRENT_X86_CUI}'`, `${decl} = '${HISTORICAL_X86_V8_CUI}'`),
            text.replace(v9, v9.replace(`'bw-circuit-ui':${decl}`, `'bw-circuit-ui':'${HISTORICAL_X86_V8_CUI}'`)),
            text.replace(HISTORICAL_X86_FINITE_V8_PINS, HISTORICAL_X86_FINITE_V8_PINS.replace('FINITE_V8_PINS', 'FINITE_V9_PINS')),
            text + "globals()['CUI'] = FINITE_V8_PINS['bw-circuit-ui']\n",
            text.replace(HISTORICAL_X86_FINITE_V7_PINS, '    ' + HISTORICAL_X86_FINITE_V7_PINS),
        ]) {
            assert.notEqual(changed, text);
            assert.equal(historicalV8CuiSpansForProfile(file, changed, k, coherent(file, changed)).length, 0,
                'changed syntax refuses even with a coherent manufactured profile');
        }
    }
    for (const file of ['vendor-pins.json', 'package.json', 'package-lock.json',
        '.github/workflows/i80386-hdd-gui-actual.yml', 'test/current.test.mjs']) {
        assert.equal(judgeFile(file, `CUI = '${HISTORICAL_X86_V8_CUI}'\n`, k).length, 1, `${file} stays red`);
    }
});

test('reviewed scheduler-test delta reconstructs the original historical test bytes', () => {
    const file = 'test/i80386-hdd-gui-actual.test.mjs';
    const source = readFileSync(path.join(ROOT, file), 'utf8');
    const delta = JSON.parse(readFileSync(path.join(ROOT, 'test/fixtures/i80386-concurrency-test-review.json'), 'utf8'));
    assert.equal(delta.length, 4, 'one helper and three caller changes, no producer or reader change');
    let restored = source;
    for (const {before, after} of delta) {
        assert.equal(restored.split(after).length, 2, 'each exact reviewed source replacement occurs once');
        restored = restored.replace(after, before);
    }
    assert.equal(Buffer.byteLength(restored), PRE_CONCURRENCY_X86_TEST_PROFILE.bytes);
    assert.equal(createHash('sha256').update(restored).digest('hex'), PRE_CONCURRENCY_X86_TEST_PROFILE.sha256,
        'the original complete source profile remains binding after reversing the reviewed delta');
});

test('completed study scheduler projection rejects policy drift and retains unrelated bytes', () => {
    const file = '.github/workflows/reference-qualified-instruments.yml';
    const text = readFileSync(path.join(ROOT, file), 'utf8');
    const original = studyBeforeReviewedConcurrency(text);
    assert.equal(createHash('sha256').update(original).digest('hex'), SEALED_STUDY_FILES[file]);
    for (const mutation of [
        text.replace(REVIEWED_STUDY_CONCURRENCY, ''),
        text + REVIEWED_STUDY_CONCURRENCY,
        text.replace(REVIEWED_STUDY_CONCURRENCY, PREVIOUS_STUDY_CONCURRENCY),
        text.replace('${{ github.workflow }}', 'other-workflow'),
        text.replace('${{ github.ref }}', '${{ github.sha }}'),
        text.replace("github.ref_type != 'tag'", "github.ref_type == 'tag'"),
        text.replace("github.event_name == 'push'", "github.event_name == 'workflow_dispatch'"),
        text.replace("github.event_name == 'pull_request'", "github.event_name == 'pull_request_target'"),
        text.replace('  contents: read', '  contents: write'),
        text.replace('timeout-minutes: 75', 'timeout-minutes: 76'),
        text.replace('if: github.repository', 'if: true || github.repository'),
        text + '# unrelated drift\n',
    ]) {
        assert.notEqual(mutation, text);
        assert.throws(() => judgeFile(file, mutation, known), /sealed completed-study source changed/);
    }
    assert.equal(studyBeforeReviewedConcurrency(text + '# unrelated drift\n'), original + '# unrelated drift\n');
});

test('reviewed current bodies preserve the four original historical source positions', () => {
    const files = [
        'scripts/run-i80386-hdd-gui-actual.py',
        'scripts/read-i80386-hdd-gui-originals.py',
        'test/i80386-hdd-gui-actual.test.mjs',
    ];
    const knownRoles = {current: new Set([CURRENT_X86_CUI, HISTORICAL_X86_CURRENT_BOARD]),
        previous: new Map([[HISTORICAL_X86_CUI_V5_V7, {repo: 'bw-circuit-ui'}],
            [HISTORICAL_X86_V8_CUI, {repo: 'bw-circuit-ui'}],
            [HISTORICAL_X86_BOARD, {repo: 'bw-board'}]]), history: new Map()};
    let admittedV8 = 0;
    let admitted = 0;
    for (const file of files) {
        const body = readFileSync(path.join(ROOT, file), 'utf8');
        const profile = HISTORICAL_X86_SOURCE_PROFILES[file];
        const heldBody = hddBeforeConcurrencyControl(file, body);
        assert.equal(Buffer.byteLength(heldBody), profile.bytes, `${file} reviewed byte extent`);
        assert.equal(createHash('sha256').update(heldBody).digest('hex'), profile.sha256,
            `${file} reviewed body hash`);
        const cui = historicalCuiSpans(file, body, knownRoles);
        const board = historicalBoardSpans(file, body, knownRoles);
        assert.equal(cui.length, file === 'scripts/read-i80386-hdd-gui-originals.py' ? 0 : 1,
            `${file} exact historical CUI position`);
        assert.equal(board.length, file === 'test/i80386-hdd-gui-actual.test.mjs' ? 0 : 1,
            `${file} exact historical Board position`);
        const v8 = historicalV8CuiSpans(file, body, knownRoles);
        assert.equal(v8.length, file.endsWith('.py') ? 2 : 0, `${file} exact F7/F8 historical CUI positions`);
        for (const at of v8) assert.equal(body.slice(at, at + 40), HISTORICAL_X86_V8_CUI);
        admittedV8 += v8.length;
        admitted += cui.length + board.length;
        assert.deepEqual(judgeFile(file, body, knownRoles), [],
            'only exact reviewed historical positions are admitted');
        if (file.endsWith('.test.mjs')) {
            const changedHelper = body.replace('policy drift refuses', 'policy drift accepted');
            assert.notEqual(changedHelper, body);
            assert.deepEqual(historicalCuiSpans(file, changedHelper, knownRoles), [],
                'even a change confined to the reviewed scheduler helper revokes historical occurrence roles');
            assert.ok(judgeFile(file, changedHelper, knownRoles).length > 0);
        }
        const alias = file.endsWith('.py') ? body + "\nglobals()['CURRENT_BOARD'] = BOARD\n" :
            body + '\nconst CURRENT_CUI = HISTORICAL_X86_CUI_V5_V7;\n';
        assert.ok(judgeFile(file, alias, knownRoles).length > 0, 'dynamic alias cannot gain a role');
    }
    assert.equal(admitted, 4, 'exactly four reviewed historical source positions');
    assert.equal(admittedV8, 4, 'exactly four reviewed F7/F8 literal CUI positions');
    for (const file of ['vendor-pins.json', 'package-lock.json', '.github/workflows/i80386-hdd-gui-actual.yml']) {
        assert.equal(judgeFile(file, `CURRENT_BOARD = '${HISTORICAL_X86_BOARD}'`, knownRoles).length, 1,
            `${file} current input cannot borrow historical Board role`);
    }
});

// A scoped key is admitted only with the source bytes its receipt names.
const requireWeDo2Receipt = (pins, bundles, moduleSource) => {
    assert.match(pins.wedo2unified || '', /^[0-9a-f]{40}$/);
    const receipt = bundles.files.wedo2unified;
    assert.equal(receipt.repo, 'CrispStrobe/extensions');
    assert.equal(receipt.path, 'extensions/CrispStrobe/lego_wedo2_universal.js');
    assert.equal(receipt.commit, pins.wedo2unified);
    const encoded = moduleSource.match(/module\.exports\s*=\s*makeExt\(("(?:\\.|[^"\\])*")\);?/);
    assert.ok(encoded, 'the shipped WeDo2 module must retain its original source');
    const source = Buffer.from(JSON.parse(encoded[1]), 'utf8');
    assert.equal(source.length, receipt.bytes);
    assert.equal(createHash('sha256').update(source).digest('hex'), receipt.sha256);
};

test('the scoped WeDo2 pin matches the actual bundled source and its receipt', () => {
    requireWeDo2Receipt(currentPins(), JSON.parse(readFileSync(path.join(ROOT,
        'overlay/scratch-vm/src/extension-support/bundled-upstream-pins.json'), 'utf8')),
    readFileSync(path.join(ROOT, 'overlay/scratch-vm/src/extensions/crispstrobe/wedo2unified/index.js'), 'utf8'));
});

test('WeDo2 receipt correlation rejects wrong identity, lengths, hashes and source bytes', () => {
    const source = '// Name: WeDo2\n// By: ExampleAuthor\n// License: MPL-2.0\n';
    const pins = {wedo2unified: 'a'.repeat(40)};
    const bundles = {files: {wedo2unified: {repo: 'CrispStrobe/extensions',
        path: 'extensions/CrispStrobe/lego_wedo2_universal.js', commit: pins.wedo2unified,
        bytes: Buffer.byteLength(source), sha256: createHash('sha256').update(source).digest('hex')}}};
    const moduleSource = `module.exports = makeExt(${JSON.stringify(source)});`;
    requireWeDo2Receipt(pins, bundles, moduleSource);
    for (const [field, value] of [['repo', 'Other/extensions'], ['path', 'other.js'],
        ['commit', 'b'.repeat(40)], ['bytes', Buffer.byteLength(source) + 1], ['sha256', '0'.repeat(64)]]) {
        const wrong = structuredClone(bundles); wrong.files.wedo2unified[field] = value;
        assert.throws(() => requireWeDo2Receipt(pins, wrong, moduleSource), undefined, field);
    }
    assert.throws(() => requireWeDo2Receipt({}, bundles, moduleSource));
    assert.throws(() => requireWeDo2Receipt(pins, {files: {}}, moduleSource));
    assert.throws(() => requireWeDo2Receipt(pins, bundles, 'module.exports = broken;'));
    assert.throws(() => requireWeDo2Receipt(pins, bundles,
        `module.exports = makeExt(${JSON.stringify(source.replace('ExampleAuthor', 'SomeoneElse!!'))});`));
});

test('the pins file names three global repos plus explicitly scoped artifact pins', () => {
    const pins = currentPins();
    assert.deepEqual(Object.keys(pins).sort(), [...REPOS, ...SCOPED_PINS].sort());
    for (const [repo, sha] of Object.entries(pins)) assert.match(sha, /^[0-9a-f]{40}$/, `${repo} pin is not a full sha`);
    const bundles = JSON.parse(readFileSync(path.join(ROOT,
        'overlay/scratch-vm/src/extension-support/bundled-upstream-pins.json'), 'utf8'));
    assert.equal(bundles.files.arrays.commit, pins['arrays-values'], 'scoped Arrays pin must name the actual bundled source');
    assert.equal(bundles.files.arrays.repo, 'CrispStrobe/extensions', 'scoped Arrays source belongs to its declared repository');
    assert.equal(bundles.files.circuitplayground.commit, pins.circuitplayground, 'scoped Circuit Playground pin must name the actual bundled source');
    assert.equal(bundles.files.circuitplayground.repo, 'CrispStrobe/extensions', 'scoped Circuit Playground source belongs to its declared repository');
    for (const repo of REPOS) {
        const sha = pins[repo];
        if (where[repo]) assert.equal(history.get(sha), repo, `${repo}'s pin ${sha.slice(0, 9)} is not a commit in ${where[repo]}`);
    }
});

test('the previous-pin half can see history: the pins file has more than one commit here', () => {
    assert.ok(count > 1 || !shallow, `only ${count} commit(s) of vendor-pins.json are visible and the checkout is shallow — the previous-pin half would pass on an empty set. Deepen the history first (git fetch --unshallow --filter=blob:none; build.yml does this before the unit step).`);
    assert.ok(previous.size >= 1, `history holds ${count} commits of vendor-pins.json but no previous pin value parsed — the parser stopped matching, not the file`);
});

test('no tracked file outside a history role carries a vendored-repo sha other than the current pins', t => {
    // THE SKIPPED SET IS REPORTED, NOT SILENT. This walk once had
    // `if (text.includes(NUL)) continue;` — and for as long as fetch-pinning.test.mjs
    // held a literal NUL, the gate reported CLEAN while an old bw-board pin sat on
    // one of its code lines (lego-be's proof, 2026-09-07). A file with a NUL is text
    // here and is judged like any other; the only files not judged are the ones
    // outside a code role, and the count and reason are printed on every run.
    const frozenAdmissions = frozenAdmissionInventory();
    const findings = [];
    const skipped = {role: 0, unreadable: []};
    const all = git(ROOT, 'ls-files', '-z').split('\0').filter(Boolean);
    let scanned = 0;
    let receipts = 0;
    for (const file of all) {
        const role = roleOf(file);
        if (role !== 'code' && role !== 'receipt') { skipped.role++; continue; }
        if (role === 'receipt') receipts++;
        let text;
        try { text = readFileSync(path.join(ROOT, file), 'utf8'); } catch (e) { skipped.unreadable.push(`${file} (${e.code || e.message})`); continue; }
        scanned++;
        findings.push(...judgeFile(file, text, known, frozenAdmissions));
    }
    t.diagnostic(`judged ${scanned} files (${receipts} receipts, which may also carry a previous pin); skipped ${skipped.role} by role (ledgers, docs prose, packages/) and ${skipped.unreadable.length} unreadable${skipped.unreadable.length ? ': ' + skipped.unreadable.join(', ') : ''}`);
    assert.deepEqual(skipped.unreadable, [], 'tracked files this gate could not read — it cannot say they are clean');
    assert.ok(scanned > 1000, `only ${scanned} files scanned — the walk collapsed`);
    assert.deepEqual(findings, [],
        `stale vendored-repo sha(s) in a file that must carry the CURRENT pin — regenerate the document (or, if the sha is a citation, the file's role is wrong: see the header):\n  ${formatFindings(findings)}`);
});

test('the repo-history half ran, or says by name that it could not', t => {
    if (Object.keys(where).length === 0) {
        t.skip('no vendored-repo history reachable (set BW_BOARD_DIR / SB3_CREATOR_DIR / BW_CIRCUIT_UI_DIR to checkouts, or BW_VENDOR_HISTORY_DIR to a directory of <repo>.git bare clones) — only PREVIOUS PIN values were checked above');
        return;
    }
    for (const repo of REPOS) assert.ok(where[repo], `${repo} history not reachable while the others are: ${JSON.stringify(where)}`);
});

// ---- fire it on purpose ----------------------------------------------------

test('a previous pin planted in a generated document is red, naming the file, the sha and which pin it was', () => {
    // THE FIXTURE ACCUSES ITSELF BEFORE IT ACCUSES THE DETECTOR.
    //
    // Measured 2026-09-11: this case failed `0 !== 1` and read as "the staleness
    // detector is broken". The detector was right. `previous` had been poisoned
    // by a reformat of vendor-pins.json, so the sha this planted was STILL A
    // CURRENT PIN, and finding nothing was the correct answer to the question
    // actually asked.
    //
    // A failing fixture means the subject is wrong OR the plant was degenerate,
    // and the failure text always accuses the subject — it is written from the
    // fixture's point of view. Mutation testing cannot catch that, because the
    // thing is already red and red is what you were hoping for. The only defence
    // is to assert what the fixture PRODUCED before asserting what it concluded.
    const first = [...previous.entries()][0];
    assert.ok(first, 'fixture: no previous pin exists to plant, so this case proves nothing '
        + 'about the detector — see previousPinsFromHistory');
    const [sha, meta] = first;
    assert.ok(!REPOS.map(repo => currentPins()[repo]).includes(sha),
        `fixture: the "previous" pin ${sha.slice(0, 9)} is STILL A CURRENT PIN, so planting `
        + 'it is planting nothing stale and finding nothing is correct. The defect is in the '
        + 'previous-pin map, not in the detector this case is about.');
    const doc = `docs/generated/I8086-CAPABILITY-REPORT.md`;
    const original = readFileSync(path.join(ROOT, doc), 'utf8');
    const text = original.replace(currentPins()['bw-board'], sha);
    assert.notEqual(text, original,
        `fixture: the plant was a NO-OP — ${doc} does not contain the current bw-board pin, `
        + 'so nothing was replaced and the document under test is unmodified');
    const f = judgeFile(doc, text, known);
    assert.equal(f.length, 1, 'exactly the planted sha');
    assert.equal(f[0].sha, sha);
    assert.match(f[0].was, new RegExp(`the ${meta.repo} pin until lite ${meta.replacedIn}`));
    assert.match(formatFindings(f), new RegExp(`^${doc}:\\d+  ${sha.slice(0, 9)}  the ${meta.repo} pin until lite ${meta.replacedIn} \\(${meta.on}\\); current ${meta.repo} pin is`));
});

test('the same sha in a ledger, in docs prose, or on a comment line is history and is not reported', () => {
    const [sha] = [...previous.entries()][0];
    assert.deepEqual(judgeFile('LANES.md', `| row | ${sha} |`, known), []);
    assert.deepEqual(judgeFile('docs/SOMETHING.md', `measured at ${sha}`, known), []);
    assert.deepEqual(judgeFile('overlay/scratch-gui/examples/example/intro.md',
        `bench-verified at ${sha}`, known), []);
    assert.deepEqual(judgeFile('test/x.test.mjs', `// pin moved ${sha} -> now`, known), []);
    assert.equal(judgeFile('test/x.test.mjs', `const PIN = '${sha}';`, known).length, 1, 'the code line beside the comment is not exempt');
    assert.equal(judgeFile('docs/generated/report.md', `Vendored engine: \`x@${sha}\``, known).length, 1, 'docs/generated is not prose');
});

test('a receipt keeps the previous pin it was measured at; the same sha outside a receipt is still red', () => {
    const [sha, meta] = [...previous.entries()][0];
    const receipt = `{\n  "boardPin": "${sha}"\n}`;
    assert.equal(roleOf('docs/receipts/2026-01-01-run.json'), 'receipt');
    assert.deepEqual(judgeFile('docs/receipts/2026-01-01-run.json', receipt, known), [], 'a receipt recording a previous pin is evidence, not staleness');
    // the real receipt that motivated the role: it was measured at a bw-board pin a later bump replaced
    const doom = 'docs/receipts/2026-09-28-i80386-doom-widgets-browser.json';
    const doomText = readFileSync(path.join(ROOT, doom), 'utf8');
    const doomPin = JSON.parse(doomText).source.boardPin;
    assert.ok(previous.has(doomPin) || current.has(doomPin), `fixture: ${doom} boardPin ${doomPin.slice(0, 9)} is no longer a known pin, so this case proves nothing`);
    assert.deepEqual(judgeFile(doom, doomText, known), []);
    // the same bytes anywhere that must carry the CURRENT pin are still reported
    for (const file of ['docs/generated/run.json', 'scripts/run.json', 'docs/receipts/nested/run.json', 'docs/receipts-2026.json']) {
        const f = judgeFile(file, receipt, known);
        assert.equal(f.length, 1, `${file} is not a receipt and must not inherit its exemption`);
        assert.match(f[0].was, new RegExp(`the ${meta.repo} pin until lite ${meta.replacedIn}`));
    }
});

test('a receipt still may not carry a vendored-repo commit that was never a pin', () => {
    // synthetic history so this runs with or without the *_DIR checkouts
    const neverPin = 'f'.repeat(40);
    const k = {...known, history: new Map([...known.history, [neverPin, 'bw-board']])};
    assert.ok(!k.current.has(neverPin) && !k.previous.has(neverPin), 'fixture: the planted sha must be neither a current nor a previous pin');
    const f = judgeFile('docs/receipts/2026-01-01-run.json', `{"boardPin":"${neverPin}"}`, k);
    assert.equal(f.length, 1);
    assert.match(f[0].was, /a bw-board commit that was never a pin \(a receipt may record only a pin/);
});

test('the provenance manifest: lastTouchedBy.sha is exempt by role, any other non-pin sha is not', () => {
    const real = JSON.parse(readFileSync(path.join(ROOT, PROVENANCE), 'utf8'));
    assert.deepEqual(judgeFile(PROVENANCE, JSON.stringify(real), known), [], 'today\'s manifest is at the pin');
    const [sha] = [...previous.entries()][0];
    const stale = JSON.parse(JSON.stringify(real)); stale.pinAtBuild = sha;
    assert.equal(judgeFile(PROVENANCE, JSON.stringify(stale), known).length, 1, 'a stale pinAtBuild is reported');
});

test('the previous-pin parser reads the diff shape git prints, and ignores everything else', () => {
    const log = 'COMMIT aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 2026-09-07\n-  "bw-board": "1111111111111111111111111111111111111111",\n+  "bw-board": "2222222222222222222222222222222222222222",\nCOMMIT bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb 2026-09-06\n-  "sb3-creator": "3333333333333333333333333333333333333333"\n+  "sb3-creator": "4444444444444444444444444444444444444444"\n';
    const p = parsePreviousPins(log);
    assert.deepEqual([...p.keys()], ['1'.repeat(40), '3'.repeat(40)]);
    assert.deepEqual(p.get('1'.repeat(40)), {repo: 'bw-board', replacedIn: 'aaaaaaaaa', on: '2026-09-07'});
});

test('global previous-pin parsing excludes scoped flasher history at the parsing boundary', () => {
    const globalOld = '1111111111111111111111111111111111111111';
    const flasherOld = '2222222222222222222222222222222222222222';
    const log = `COMMIT ${'a'.repeat(40)} 2026-09-13\n-  "bw-board": "${globalOld}"\n-  "stc-compiler-flasher": "${flasherOld}"`;
    const global = parsePreviousPins(log, new Set(), new Set(REPOS));
    assert.deepEqual([...global.keys()], [globalOld]);
    const scoped = parsePreviousPins(log, new Set(), new Set(SCOPED_PINS));
    assert.deepEqual([...scoped.keys()], [flasherOld]);
    const globalKnown = {current, previous: global, history: new Map()};
    assert.deepEqual(judgeFile('test/independent-stc.js', `const SHA = '${flasherOld}';`, globalKnown), [],
        'a former scoped flasher pin leaked into the global judge');
    assert.deepEqual(judgeFile('test/independent-stc.js',
        `const SHA = '${currentPins()['stc-compiler-flasher']}';`, globalKnown), [],
    'the current scoped flasher pin leaked into the global judge');
    assert.deepEqual(judgeFile('test/independent-stc.js',
        `const SHA = '79df4b6d37c78e463f5c1d8caa3cfaa7712935ad';`, globalKnown), [],
    'an independent hosted-target stc revision entered global pin authority');
});

test('a REFORMAT of the pins file does not invent previous pins for pins that never moved', () => {
    // THE DEFECT THIS EXISTS FOR, measured 2026-09-11. `scripts/lib-pin.mjs`
    // wrote vendor-pins.json with `JSON.stringify(pins, null, 1)` while the file
    // uses indent 2, so every --pin run rewrote all three lines. Git prints a `-`
    // for each, and two pins that had not moved at all entered the previous-pin
    // map — while still being the current pins.
    //
    // Nothing connected the whitespace default to the three tests it broke. This
    // is the connection, stated as the invariant rather than as the indent: a
    // current pin is never a previous pin.
    const current = {'bw-board': 'b'.repeat(40), 'sb3-creator': 'c'.repeat(40)};
    const reformatted = [
        'COMMIT ' + 'a'.repeat(40) + ' 2026-09-11',
        '-  "bw-board": "' + 'd'.repeat(40) + '",',     // really moved
        '-  "sb3-creator": "' + 'c'.repeat(40) + '"',   // only reindented
        '+ "bw-board": "' + 'b'.repeat(40) + '",',
        '+ "sb3-creator": "' + 'c'.repeat(40) + '"'
    ].join('\n');

    const naive = parsePreviousPins(reformatted);
    assert.ok(naive.has('c'.repeat(40)),
        'fixture: the unguarded parser did NOT pick up the reindented line, so this case '
        + 'is not reproducing the defect and proves nothing about the guard');

    const guarded = parsePreviousPins(reformatted, new Set(Object.values(current)));
    assert.deepEqual([...guarded.keys()], ['d'.repeat(40)],
        'a pin that only changed INDENTATION is being reported as a former pin. Every '
        + 'downstream reader then treats a live sha as stale, and the fixture that plants '
        + '"a previous pin" plants one that is still current and finds nothing.');
    assert.equal(guarded.get('d'.repeat(40)).repo, 'bw-board',
        'the one pin that really moved lost its repo name to the filter');
});

test('the pins file keeps the indentation its own history is diffed against', () => {
    // Not a style rule. The previous-pin map is read out of `git log -p` on this
    // file, so its FORMATTING is an input to a gate. A writer using a different
    // indent reformats every line and manufactures the finding above. Asserted
    // here so the two cannot drift apart again in silence.
    const raw = readFileSync(path.join(ROOT, 'vendor-pins.json'), 'utf8');
    assert.equal(raw, JSON.stringify(JSON.parse(raw), null, 2) + '\n',
        'vendor-pins.json is not `JSON.stringify(pins, null, 2)` + newline. Whatever wrote '
        + 'it last uses a different shape, so the next pin bump will rewrite every line and '
        + 'put unchanged pins into the previous-pin map. Fix the WRITER '
        + '(scripts/lib-pin.mjs), not this file.');
});


test('an original model-source README retains its actual historical measurement pin', () => {
    const file = 'test/fixtures/model-files/axis-plotter-source/README.txt';
    const text = readFileSync(path.join(ROOT, file), 'utf8');
    const measured = /app's pinned sb3-creator revision is:\s*([0-9a-f]{40})/.exec(text)?.[1];
    assert.ok(measured, 'the original records its measured compiler pin');
    assert.ok(previous.has(measured), 'the original measurement retains a previous shipped pin');
    assert.equal(roleOf(file), 'receipt');
    assert.deepEqual(judgeFile(file, text, known), []);
    for (const sibling of ['original.ldr', 'setup.mjs', 'snapshot.json', 'nested/README.txt']) {
        const active = `test/fixtures/model-files/axis-plotter-source/${sibling}`;
        assert.equal(roleOf(active), 'code');
        assert.equal(judgeFile(active, `measured at ${measured}`, known).length, 1,
            'the historical pin must still fail in an active input');
    }
});

test('original source README receipts still reject never-pinned supplier commits', () => {
    const neverPin = 'f'.repeat(40);
    const k = {...known, history: new Map([...known.history, [neverPin, 'sb3-creator']])};
    assert.ok(!k.current.has(neverPin) && !k.previous.has(neverPin));
    for (const extension of ['txt', 'md']) {
        const file = `test/fixtures/model-files/archived-source/README.${extension}`;
        const findings = judgeFile(file, `measured at ${neverPin}`, k);
        assert.equal(roleOf(file), 'receipt');
        assert.equal(findings.length, 1);
        assert.match(findings[0].was, /never a pin/);
    }
    assert.equal(roleOf('test/fixtures/model-files/active/README.txt'), 'code');
    assert.equal(roleOf('test/fixtures/README.txt'), 'code');
});

test('the captured Crossglide provenance keeps its actual historical compiler pin', () => {
    const file = 'test/fixtures/model-files/crossglide-source/SOURCES.txt';
    const text = readFileSync(path.join(ROOT, file), 'utf8');
    const measured = /Registered compiler revision:\s*([0-9a-f]{40})/.exec(text)?.[1];
    assert.ok(measured, 'the captured document records its compiler revision');
    assert.ok(previous.has(measured), 'the capture records a previously shipped pin');
    assert.equal(roleOf(file), 'receipt');
    assert.deepEqual(judgeFile(file, text, known), []);
    for (const active of [
        'test/fixtures/model-files/crossglide-source/active.json',
        'test/fixtures/model-files/crossglide-source/SOURCES.md',
        'test/fixtures/model-files/crossglide-source/nested/SOURCES.txt',
        'test/fixtures/model-files/other-source/SOURCES.txt'
    ]) {
        assert.equal(roleOf(active), 'code');
        assert.equal(judgeFile(active, text, known).length, 1);
    }
});

test('the captured Crossglide provenance still rejects a never-pinned supplier commit', () => {
    const file = 'test/fixtures/model-files/crossglide-source/SOURCES.txt';
    const neverPin = 'f'.repeat(40);
    const k = {...known, history: new Map([...known.history, [neverPin, 'sb3-creator']])};
    assert.ok(!k.current.has(neverPin) && !k.previous.has(neverPin));
    const findings = judgeFile(file, `Registered compiler revision:\n${neverPin}`, k);
    assert.equal(findings.length, 1);
    assert.match(findings[0].was, /never a pin/);
});


test('captured Resonance source receipts preserve actual old pins but refuse invented supplier commits', () => {
 const oldPin=JSON.parse(readFileSync(path.join(ROOT,'test/helpers/resonance/original-inputs.json'),'utf8')).originalCompilerPin,neverPin='f'.repeat(40);
 const k={...known,history:new Map([...known.history,[neverPin,'sb3-creator']])};
 for(const file of ['test/fixtures/model-files/resonance-lab-source/SOURCES.txt','test/helpers/resonance/original-inputs.json']){
  assert.equal(roleOf(file),'receipt');assert.ok(previous.has(oldPin));
  assert.deepEqual(judgeFile(file,readFileSync(path.join(ROOT,file),'utf8'),known),[]);
  const findings=judgeFile(file,neverPin,k);assert.equal(findings.length,1);assert.match(findings[0].was,/never a pin/);
 }
 assert.equal(roleOf('test/helpers/resonance/active.json'),'code');
 assert.equal(roleOf('test/fixtures/model-files/resonance-lab-source/active.json'),'code');
});


test('F10 keeps every consumed supplier position historical and every new input current', () => {
    const f = historicalRoleFixtures();
    const source = `BOARD = '${HISTORICAL_X86_BOARD}'\n` + f.producer + F10_CURRENT_MAP + '\n';
    const file = f.producerPath;
    const k = {current: new Set([LIVE_X86_CUI, LIVE_X86_BOARD, LIVE_X86_SB3]),
        previous: new Map([[CURRENT_X86_CUI, {repo:'bw-circuit-ui'}],
            [HISTORICAL_X86_SB3, {repo:'sb3-creator'}],
            [HISTORICAL_X86_CURRENT_BOARD, {repo:'bw-board'}],
            [HISTORICAL_X86_BOARD, {repo:'bw-board'}],
            [HISTORICAL_X86_CUI_V5_V7, {repo:'bw-circuit-ui'}],
            [HISTORICAL_X86_V8_CUI, {repo:'bw-circuit-ui'}]]), history:new Map()};
    const profile = text => ({[file]:{bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex')}});
    const recognize = (path, text, known) => historicalV10SpansForProfile(path, text, known, profile(source));
    const judge = historicalJudgeWith(() => [], () => [], () => [], recognize);
    assert.equal(recognize(file, source, k).length, 12, 'eight CUI/Board positions plus four consumed SB3 positions');
    assert.equal(judge(file, source, k).length, 0);
    assert.equal(historicalV10Spans(file, source, k).length, 0, 'public API refuses a manufactured body');
    assert.equal(historicalJudgeWith(() => [], () => [], () => [])(file, source, k).length, 12,
        'omitting the new role restores every stale-supplier finding');
    assert.equal(historicalV10Spans(file, source, {...k, profiles:profile(source)}).length, 0,
        'caller-supplied profiles cannot replace the fixed public policy');
    for (const changed of [
        source.replace(F10_CURRENT_MAP, F10_CURRENT_MAP.replace(LIVE_X86_CUI, CURRENT_X86_CUI)),
        source.replace(F10_CURRENT_MAP, F10_CURRENT_MAP.replace(LIVE_X86_BOARD, HISTORICAL_X86_CURRENT_BOARD)),
        source.replace(CURRENT_X86_FINITE_V9_PRODUCER, CURRENT_X86_FINITE_V9_PRODUCER.replace('CURRENT_BOARD','BOARD')),
        source + `EXTRA = '${CURRENT_X86_CUI}'\n`,
        source + `CURRENT_BOARD = '${HISTORICAL_X86_CURRENT_BOARD}'\n`,
        source + "globals()['FINITE_V10_PINS'] = FINITE_V9_PINS\n",
    ]) {
        assert.notEqual(changed, source);
        assert.equal(historicalV10SpansForProfile(file, changed, k, profile(changed)).length, 0,
            'coherently hashed role changes still refuse');
        assert.ok(judge(file, changed, k).length > 0);
    }
    assert.equal(recognize('scripts/another.py', source, k).length, 0);
    const unshipped = {...k, previous:new Map(k.previous),history:new Map([[CURRENT_X86_CUI,'bw-circuit-ui']])};
    unshipped.previous.delete(CURRENT_X86_CUI);
    assert.equal(recognize(file, source, unshipped).length, 0);
    const indirect = source + "setattr(sys.modules[__name__], 'FINITE_V10_PINS', FINITE_V9_PINS)\n";
    assert.equal(recognize(file, indirect, k).length, 0, 'reviewed full body remains mandatory for indirect aliases');
    for (const path of ['vendor-pins.json','package-lock.json','scripts/current.py',
        '.github/workflows/i80386-hdd-gui-actual.yml','test/current.test.mjs']) {
        assert.ok(judgeFile(path, `CURRENT = '${CURRENT_X86_CUI}'\n`, k).length > 0);
    }
});


test('a real merge replacement remains previous-pin evidence instead of a never-pinned finding', () => {
    const directory=mkdtempSync(path.join(tmpdir(),'bw-pin-merge-history-'));
    writeFileSync(path.join(directory,'git'),'#!/bin/sh\nexit 87\n',{mode:0o755});
    const cleanEnv={...Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('GIT_'))),
        PATH:directory+path.delimiter+(process.env.PATH||''),
        GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_NOSYSTEM:'1',
        GIT_AUTHOR_NAME:'pin history control',GIT_AUTHOR_EMAIL:'pins@example.invalid',
        GIT_COMMITTER_NAME:'pin history control',GIT_COMMITTER_EMAIL:'pins@example.invalid'};
    const invoke=(...args)=>execFileSync('/usr/bin/git',['-c','core.hooksPath=/dev/null','-c','commit.gpgsign=false',...args],
        {cwd:directory,env:cleanEnv,encoding:'utf8',stdio:['ignore','pipe','pipe']});
    const base='0'.repeat(40), former='a'.repeat(40), selected='b'.repeat(40), never='d'.repeat(40);
    const setPin=pin=>writeFileSync(path.join(directory,'vendor-pins.json'),JSON.stringify({'bw-board':pin},null,2)+'\n');
    const commit=message=>{invoke('add','vendor-pins.json');invoke('commit','-qm',message);};
    try{
        invoke('init','-q','-b','main');setPin(base);commit('base');
        invoke('checkout','-qb','side');setPin(selected);commit('side pin');
        invoke('checkout','-q','main');setPin(former);commit('former main pin');
        assert.throws(()=>invoke('merge','--no-ff','--no-commit','side'), 'the fixture creates a real pin conflict');
        setPin(selected);commit('resolved merge adopts side pin');
        const args=['-p','--format=COMMIT %H %ad','--date=short','--','vendor-pins.json'];
        const incomplete=invoke('log',...args), complete=invoke('log','--diff-merges=first-parent',...args);
        assert.equal(parsePreviousPins(incomplete,new Set([selected])).has(former),false,
            'default merge omission reproduces the observed false never-pinned result');
        const previous=parsePreviousPins(complete,new Set([selected]));
        assert.equal(previous.get(former)?.repo,'bw-board');
        assert.equal(previous.get(former)?.replacedIn,invoke('rev-parse','HEAD').trim().slice(0,9));
        assert.equal(previous.has(selected),false,'current values still cannot become historical exemptions');
        assert.equal(previous.has(never),false,'unrecorded values remain unrecorded');
    }finally{rmSync(directory,{recursive:true,force:true});}
});


for (const file of Object.keys(SEALED_STUDY_FILES)) {
    test(`completed-study historical role requires exact sealed bytes: ${file}`, () => {
        const text = readFileSync(path.join(ROOT, file), 'utf8');
        assert.equal(roleOf(file), 'receipt');
        assert.deepEqual(judgeFile(file, text, known), []);
        assert.throws(() => judgeFile(file, text + '\n', known), /sealed completed-study source changed/);
        const former = previous.keys().next().value;
        assert.ok(former, 'history authority is populated');
        assert.equal(judgeFile('scripts/current-package-authority.mjs',
            `const PIN = '${former}';`, known).length, 1, 'ordinary current code still rejects a former pin');
    });
}

test('frozen historical admission inventory remains exact independently of current-pin scanning', () => {
    const admitted = frozenAdmissionInventory();
    assert.equal(admitted.size, 3);
    for (const [file, row] of admitted) {
        assert.equal(roleOf(file), 'code');
        assert.deepEqual(judgeFile(file, readFileSync(path.join(ROOT, file), 'utf8'), known, admitted), []);
        assert.ok(currentPins()[row.repo] === row.value || previous.get(row.value)?.repo === row.repo,
            'actual frozen value remains a shipped pin of its supplier');
    }
});

// Negative controls use an explicit later-pin context, including when the
// repository legitimately rolls back to the frozen pin. This never changes
// the live inventory or the real whole-repository judgment above.
const frozenHistoricalTestContext = manifest => {
    const old = manifest.files[0].value, next = old === '0'.repeat(40) ? '1'.repeat(40) : '0'.repeat(40);
    const pins = {...currentPins(), 'sb3-creator':next}, previous = new Map(known.previous);
    for (const row of manifest.files) previous.set(row.value, {repo:row.repo});
    return {pins, known:{...known, current:new Set(Object.values(pins)), previous}};
};

test('frozen admission bindings reject source, inventory, schema and unshipped-value mutations', () => {
    const original = parseFrozenAdmissionReceipt(readFileSync(path.join(ROOT, FROZEN_ADMISSIONS), 'utf8'));
    const observe = () => new Map(original.files.map(row => [row.file, {regular:true, mode:row.mode,
        gitBlob:row.gitBlob, bytes:readFileSync(path.join(ROOT, row.file))}]));
    const context = frozenHistoricalTestContext(original);
    const validate = (manifest, observations = observe(), k = context.known) => validateFrozenAdmissions(manifest, observations, k, context.pins);
    assert.equal(validate(original).size, 3);
    for (const mutate of [
        m => {m.extra = true;}, m => {m.schema = 'foreign';}, m => {delete m.files;},
        m => {m.files.pop();}, m => {m.files[1] = structuredClone(m.files[0]);},
        m => {m.files[0].file = 'scripts/copied-controller.mjs';},
        m => {m.files[0].file = './' + m.files[0].file;},
        m => {m.files[0].field = 'other';}, m => {m.files[0].repo = 'bw-board';},
        m => {m.files[0].mode = '100755';}, m => {m.files[0].sha256 = '0'.repeat(64);},
        m => {m.files[0].gitBlob = '0'.repeat(40);}, m => {m.files[0].span[0]++;},
        m => {m.files[0].value = 'f'.repeat(40);}, m => {m.files[0].extra = true;}
    ]) {
        const manifest = structuredClone(original); mutate(manifest);
        assert.throws(() => validate(manifest), undefined, String(mutate));
    }
    for (const mutate of [
        o => {o.regular = false;}, o => {o.mode = '100755';}, o => {o.gitBlob = '0'.repeat(40);},
        o => {o.bytes = Buffer.concat([o.bytes, Buffer.from('\n')]);},
        o => {o.bytes = Buffer.from(o.bytes.toString().replace(original.files[0].value, context.pins['sb3-creator']));}
    ]) {
        const observations = observe(); mutate(observations.get(original.files[0].file));
        assert.throws(() => validate(original, observations), undefined, String(mutate));
    }
    const observations = observe(); observations.delete(original.files[0].file);
    assert.throws(() => validate(original, observations));
    const duplicateJSON = JSON.stringify(original).replace('"schema":', '"schema":"duplicate","schema":');
    assert.throws(() => parseFrozenAdmissionReceipt(duplicateJSON));
    const wrongSupplier = {...context.known, previous:new Map(context.known.previous)};
    wrongSupplier.previous.set(original.files[0].value, {repo:'bw-board'});
    assert.throws(() => validate(original, observe(), wrongSupplier));
    const never = 'f'.repeat(40), invented = structuredClone(original), row = invented.files[0];
    const observed = observe(), before = observed.get(row.file).bytes;
    const bytes = Buffer.concat([before.subarray(0,row.span[0]),Buffer.from(never),before.subarray(row.span[1])]);
    row.value=never;row.sha256=createHash('sha256').update(bytes).digest('hex');row.gitBlob=blobOf(bytes);
    observed.set(row.file,{regular:true,mode:row.mode,gitBlob:row.gitBlob,bytes});
    const neverKnown={...context.known,previous:new Map(context.known.previous),history:new Map(context.known.history)};
    neverKnown.previous.delete(never);neverKnown.history.set(never,'sb3-creator');
    assert.throws(()=>validate(invented,observed,neverKnown),/shipped pin/,'a consistently rebound never-shipped token still cannot gain this role');
    const currentPinsContext={...context.pins,'sb3-creator':original.files[0].value};
    const currentKnown={...context.known,current:new Set(Object.values(currentPinsContext)),previous:new Map(context.known.previous)};
    currentKnown.previous.delete(original.files[0].value);
    const currentAdmission=validateFrozenAdmissions(original,observe(),currentKnown,currentPinsContext);
    assert.equal(currentAdmission.size,3,'frozen contract remains valid when its pin is current');
    const first=original.files[0];
    assert.deepEqual(judgeFile(first.file,observe().get(first.file).bytes.toString(),currentKnown,currentAdmission),[]);

});

test('one frozen constant token never exempts another active pin or a copied controller', () => {
    const manifest = parseFrozenAdmissionReceipt(readFileSync(path.join(ROOT, FROZEN_ADMISSIONS), 'utf8'));
    const row = manifest.files[0], bytes = readFileSync(path.join(ROOT, row.file));
    const context=frozenHistoricalTestContext(manifest);
    const observations = new Map(manifest.files.map(r => [r.file, {regular:true, mode:r.mode,
        gitBlob:r.gitBlob, bytes:readFileSync(path.join(ROOT, r.file))}]));
    const rebound = (m, raw) => {
        const changed = m.files[0];
        changed.sha256 = createHash('sha256').update(raw).digest('hex'); changed.gitBlob = blobOf(raw);
        observations.set(changed.file, {regular:true, mode:changed.mode, gitBlob:changed.gitBlob, bytes:raw});
        return validateFrozenAdmissions(m, observations, context.known, context.pins);
    };
    // Even if a proposed new receipt binds the changed whole file, only the
    // supported token has this role. A second active old pin still fails.
    const extra = Buffer.concat([bytes, Buffer.from(`\nconst activeSupplier = "${row.value}";\n`)]);
    const admitted = rebound(structuredClone(manifest), extra);
    assert.equal(judgeFile(row.file, extra.toString(), context.known, admitted).length, 1);
    assert.equal(judgeFile('scripts/copied-controller.mjs', bytes.toString(), context.known, admitted).length, 1);
    assert.throws(() => judgeFile(row.file, extra.toString(), known, frozenAdmissionInventory()));
    const duplicate = Buffer.concat([bytes, Buffer.from(`\n    "producerSha": "${row.value}",\n`)]);
    assert.throws(() => rebound(structuredClone(manifest), duplicate));
    const never = 'f'.repeat(40), k = {...known, history:new Map([...known.history, [never,'sb3-creator']])};
    const wrong = structuredClone(manifest); wrong.files[0].value = never;
    assert.ok(!known.current.has(never) && !known.previous.has(never));
    assert.throws(() => validateFrozenAdmissions(wrong, observations, k, currentPins()));
});


test('reviewed policy projections retain historical hashes and reject helper and policy cuts', () => {
    const controlPath = 'test/i80386-hdd-gui-actual.test.mjs';
    const control = readFileSync(path.join(ROOT, controlPath), 'utf8');
    const held = hddBeforeConcurrencyControl(controlPath, control);
    assert.equal(Buffer.byteLength(held), 646674);
    assert.equal(createHash('sha256').update(held).digest('hex'),
        '45ef06f71b0bec8064d4f2bee31e1a78dcaa50cd9e6a4fd10fa8ad39cdd857ae');
    for (const changed of [
        control.replace('const heldBeforeConcurrencyPolicy =', 'const alteredProjection ='),
        control.replace('heldBeforeConcurrencyPolicy(name,workflow)', 'workflow'),
        control.replace('assert.equal(workflow.split(policy).length, 2', 'assert.equal(workflow.split(policy).length, 1'),
    ]) assert.throws(() => hddBeforeConcurrencyControl(controlPath, changed));
    const drift = hddBeforeConcurrencyControl(controlPath, control + '// unrelated drift\n');
    assert.notEqual(createHash('sha256').update(drift).digest('hex'),
        '45ef06f71b0bec8064d4f2bee31e1a78dcaa50cd9e6a4fd10fa8ad39cdd857ae');
    const studyPath = '.github/workflows/reference-qualified-instruments.yml';
    const study = readFileSync(path.join(ROOT, studyPath), 'utf8');
    for (const changed of [
        study.replace('${{ github.workflow }}', '${{ github.run_id }}'),
        study.replace("github.ref_type != 'tag'", "github.ref_type == 'tag'"),
        study + '\nconcurrency:\n',
    ]) assert.throws(() => judgeFile(studyPath, changed, known));
    assert.throws(() => judgeFile(studyPath, study.replace('contents: read', 'contents: write'), known),
        /sealed completed-study source changed/);
});
