/**
 * NO TRACKED TEXT FILE CONTAINS A NUL BYTE.
 *
 * Found 2026-09-07 by brickwright-lite-ea: test/fetch-pinning.test.mjs held a
 * literal NUL where the two-character escape was meant — the binary-detection
 * check had made its own file binary — which is why grep printed "binary file
 * matches" for lego-be, why git showed UU with no conflict markers, and why a
 * rebase stopped on a file nobody could read. MEASURED, every tracked file:
 * 11,370 files, 1,759 hold a NUL, 1,754 of them binary by format, and FIVE
 * text files — bw-board/board.js (4 NULs) and its packages mirror,
 * bw-circuit-ui importers/easyeda-pro-pcb.js (2) and model/board-lift.js (1),
 * and fetch-pinning (1). ONE SPECIES in all five: a literal NUL typed inside a
 * template literal used as a composite Map key where the escape was meant.
 * JavaScript reads the byte as the same character, so nothing ever
 * misbehaved; the cost is entirely to the tools that read source — grep,
 * diff, merge — which call the file binary. Three of the five are
 * byte-identical to their upstream at the pin (bw-board d5850e6, bw-circuit-ui
 * a879732) and are upstream findings; the fourth is lego-be's one character.
 *
 * Exempt BY ROLE: binary formats by extension — images, audio, firmware and
 * ROM images, WebAssembly, archives, Scratch project/sprite bundles. That is
 * the set of formats the sweep found, stated so a new binary format fails by
 * name once and gets its extension added with its reason.
 *
 * KNOWN carries the four files above with the pin their bytes came from.
 * Every entry EXPIRES: the moment the NUL is gone (upstream fixed and
 * re-vendored, or the test edited), the entry is red as stale and must be
 * removed — a ratchet cannot outlive the defect it names.
 *
 * Two sentences from lego-be, who read the first sweep: git samples roughly
 * the first 8 KB to decide binary, so the same defect was visible to git in
 * one file and invisible in the other — sweep by BYTE, never by symptom. And:
 * a count over the wrong set is a different question, not a smaller answer
 * (the sweep's 1,759 hits are mostly PNGs; the answer is the five). One from
 * the measuring: in zsh, quote every `<ref>:<path>` — `$P:src/board.js`
 * is a history modifier, and git will happily show a different object.
 *
 * Red names the file, the line, the byte offset and the surrounding text.
 * This file itself spells the byte only as an escape.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync, statSync, readdirSync, existsSync} from 'node:fs';
import path from 'node:path';
import {packageSourceRoot} from './helpers/package-source.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const NUL = String.fromCharCode(0);

/** Binary formats by role. A NUL is expected in these. */
export const BINARY_BY_ROLE = {
    image: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'icns', 'cur', 'webp'],
    audio: ['wav', 'mp3', 'ogg'],
    // `.rcx` joined this role 2026-09-21 with test/fixtures/rcx-images/: a
    // compiled LEGO RCX program image, produced by nqc and paired with the
    // .nqc it came from. The bytes ARE the artefact — they are what
    // test/nqc-wasm.test.mjs compares the WASM build against byte for byte —
    // so a NUL in one is the format, not a mistake.
    // `.exe` joined 2026-09-22 with static/roms/ubasic.exe: a real 16-bit MS-DOS
    // MZ executable (the libre uBASIC interpreter, code-tab BASIC-on-DOS). A DOS
    // .EXE is binary by role exactly like the .com already here — its NUL bytes
    // are the format.
    // `.rxe` joined 2026-10-20 with test/fixtures/nxt-rxe/: a compiled LEGO NXT
    // executable, NBC's output paired with the .nxc it came from — the bytes the
    // Virtual NXT's program VM loads, as for .rcx. `.rbf` joined 2026-10-20 with
    // test/fixtures/ev3-rbf/: a LEGO EV3 byte-code image, lmsasm's output paired with
    // the .lms it came from — what the Virtual EV3's program VM loads.
    firmware: ['bin', 'rom', 'com', 'exe', 'uf2', 'elf', 'rcx', 'rxe', 'rbf'],
    wasm: ['wasm'],
    // AutoCAD DWG is a binary drawing format. The canonical inch-plate browser
    // fixture is AC1032 binary output of the pinned CAD codec, not text with an
    // accidental NUL. STEP/STP and DXF remain text and are still inspected.
    cad: ['dwg'],
    // `.io` (BrickLink Studio) and `.lxf` (LEGO Digital Designer) joined 2026-10-18 with
    // test/fixtures/bw-sim/interop/: both formats ARE ZIP archives (model.ldr / IMAGE100.LXFML
    // inside), so their NUL bytes are the ZIP format, as for .sb3.
    // Robot Lab's .pack is gzip-compressed LDraw JSON, produced and verified
    // with gzipSync/gunzipSync by scripts/pack-robot-build-ldraw.mjs. Its NULs
    // belong to that binary archive, just as they do in the .gz role above.
    archive: ['zip', 'sb3', 'sb2', 'sprite3', 'sprite2', 'gz', 'tgz', 'io', 'lxf', 'pack'],
    object: ['lib', 'o', 'a'],
    // Typefaces. A font is binary by role in the same way a ROM is: the bytes
    // ARE the artefact. Added 2026-09-07 with the vendored replacement for the
    // CC BY-SA pixel face (overlay/scratch-gui/src/lib/render-fonts/), which
    // this gate caught on its first CI run — correctly, since nothing had told
    // it fonts existed here.
    font: ['ttf', 'otf', 'woff', 'woff2', 'eot'],
    // Disk images. Added 2026-09-21, and this gate found it the way its header
    // says a new binary format is found — except that it could not SAY so. The
    // real-DOS code-tab path (#238) tracks a 360K MS-DOS 2.0 FAT12 image under
    // static/dos/, twice, overlay and packages. 338,112 of its 368,640 bytes
    // are NUL, which is what an empty FAT12 data area IS, and nothing about
    // that is a defect in anything.
    disk: ['img', 'ima', 'iso', 'vhd', 'dsk']
};
const BINARY_EXT = new Set(Object.values(BINARY_BY_ROLE).flat());
export const isBinaryByRole = file => BINARY_EXT.has((file.match(/\.([^./]+)$/) || [, ''])[1].toLowerCase());

/** Files carrying a NUL that upstream must fix (or lego-be's one character); each expires when its NUL is gone. */
export const KNOWN = [
    {file: 'node_modules/bw-circuit-ui/src/importers/easyeda-pro-pcb.js', nuls: 2, pin: 'bw-circuit-ui a8797322', why: 'composite key at line 305; identical to upstream at the pin — fix in bw-circuit-ui, re-vendor'},
    {file: 'node_modules/bw-circuit-ui/src/model/board-lift.js', nuls: 1, pin: 'bw-circuit-ui a8797322', why: 'composite key at line 106; identical to upstream at the pin — fix in bw-circuit-ui, re-vendor'},
];

/**
 * How many NULs get a `context` string. Beyond this the hit is still COUNTED —
 * `.length` remains the true number of NULs, which KNOWN and the live-tree test
 * both compare against — but no evidence is built for it. Five is what a human
 * reads before scrolling; the point of the bound is that the cost of REPORTING
 * cannot depend on how bad the file is.
 */
export const MAX_DETAIL = 5;

/**
 * Every NUL in a buffer, as {offset, line, context}. Pure, LINEAR, and bounded.
 *
 * It was neither. The line number came from `buf.subarray(0, i).toString()
 * .split('\n').length` — a fresh copy of everything before the hit, for EVERY
 * hit — and a context string was built for every one. On text that is O(n); on
 * a file that is mostly NUL it is O(n²) in time and O(hits) in retained
 * strings. Measured 2026-09-21 on the 360K MS-DOS image #238 tracked twice:
 * 338,112 hits per copy, ~10^11 byte copies, 555 MB RSS and climbing after two
 * minutes, and the GitHub runner reclaimed with `exit code 143` before the
 * gate could print a single `not ok`. A gate that cannot report its finding is
 * not a gate, and this one had promised in its own header that a new binary
 * format "fails by name once".
 *
 * Now: one pass, newlines counted as they are passed, evidence for the first
 * MAX_DETAIL hits only.
 */
export const nulsIn = (buf, maxDetail = MAX_DETAIL) => {
    const out = [];
    let i = -1;
    let line = 1;
    let counted = 0;      // bytes of `buf` whose newlines are already in `line`
    while ((i = buf.indexOf(0, i + 1)) >= 0) {
        for (let j = counted; j < i; j++) if (buf[j] === 0x0a) line++;
        counted = i;
        const context = out.length < maxDetail
            ? buf.subarray(Math.max(0, i - 40), i + 20).toString('utf8').split(NUL).join('<NUL>').replace(/\n/g, '⏎')
            : null;
        out.push({offset: i, line, context});
    }
    return out;
};

/** Judge a list of {file, buf}. Pure; the mutation tests feed it. */
export const judge = (files, known = KNOWN) => {
    const findings = [], stale = [];
    const knownBy = new Map(known.map(k => [k.file, k]));
    let scanned = 0;
    for (const {file, buf} of files) {
        if (isBinaryByRole(file)) continue;
        scanned++;
        const hits = nulsIn(buf);
        const k = knownBy.get(file);
        if (k) {
            if (hits.length === 0) stale.push(`${file}: KNOWN says ${k.nuls} NUL(s) (${k.pin}) and the file has none — the defect is gone; remove the entry`);
            else if (hits.length !== k.nuls) findings.push(`${file}: KNOWN says ${k.nuls} NUL(s), the file has ${hits.length} — the count moved; re-measure and say why`);
            continue;
        }
        // Bounded, for the same reason nulsIn is: a file with 338,112 NULs must
        // produce a message a person can read, not 338,112 lines of it.
        for (const h of hits.slice(0, MAX_DETAIL)) findings.push(`${file}:${h.line} byte ${h.offset}: literal NUL — …${h.context}… (an escape was probably meant; a NUL makes grep, diff and merge call this file binary)`);
        if (hits.length > MAX_DETAIL) findings.push(`${file}: and ${hits.length - MAX_DETAIL} more NUL(s), ${hits.length} in all — if this file is binary by format, add its extension to BINARY_BY_ROLE with its reason`);
    }
    return {findings, stale, scanned};
};

// `git ls-files` decides what "tracked" means; git from PATH is the AMBIENT-
// BINDING shape, defused: the count floor below fails if it returned nothing.
// gate-shapes-allow
const tracked = () => execFileSync('git', ['-C', ROOT, 'ls-files', '-z'], {encoding: 'utf8', maxBuffer: 64 << 20}).split(NUL).filter(Boolean);

// npm migration changed ownership, not the obligation to inspect upstream
// text. Scan installed source recursively as well as every tracked app file.
function upstreamFiles (name) {
    const root = packageSourceRoot(name);
    const files = [];
    function visit (dir, relative = '') {
        for (const entry of readdirSync(dir, {withFileTypes: true})) {
            const rel = path.join(relative, entry.name);
            const file = path.join(dir, entry.name);
            if (entry.isDirectory()) visit(file, rel);
            else if (entry.isFile() && statSync(file).size > 0) {
                files.push({file: `node_modules/${name}/src/${rel.split(path.sep).join('/')}`, buf: readFileSync(file)});
            }
        }
    }
    visit(root);
    return files;
}

// The count comes from the list, not from a number typed in the name. It read
// "the KNOWN four" while KNOWN held two: the entries expire as their NULs are
// fixed upstream, and a name that restates a count goes stale the first time
// one does.
test(`tracked app and installed upstream source text is free of NUL bytes, except the ${KNOWN.length} KNOWN with their pins`, t => {
    const files = [];
    const unreadable = [];
    for (const f of tracked()) { const p = path.join(ROOT, f); let st; try { st = statSync(p); } catch (e) { unreadable.push(`${f} (${e.code})`); continue; } if (st.isFile() && st.size > 0) files.push({file: f, buf: readFileSync(p)}); }
    const trackedText = files.filter(({file}) => !isBinaryByRole(file)).length;
    const upstreamCounts = {};
    for (const name of ['bw-board', 'bw-circuit-ui']) {
        const upstream = upstreamFiles(name);
        upstreamCounts[name] = upstream.filter(({file}) => !isBinaryByRole(file)).length;
        files.push(...upstream);
    }
    const {findings, stale, scanned} = judge(files);
    // the skipped set, reported: binaries by role, and anything the walk could not stat
    t.diagnostic(`scanned ${scanned} text files; skipped ${files.length - scanned} binary by role; ${unreadable.length} unreadable${unreadable.length ? ': ' + unreadable.join(', ') : ''}`);
    assert.deepEqual(unreadable, [], 'tracked files this gate could not read');
    // Immutable trees: 411828a has 8,039 nonempty tracked text files. Migration
    // snapshot 44872243 removes 1,656 and adds 2 => 6,385: engine copies 189+162,
    // UI copies 679+609, docs 3, scripts 6, tests 8. The upstream source remains
    // scanned above, once per installed package instead of twice as copied
    // roots. Independent floors prevent package files hiding a collapsed app
    // walk (or the reverse). Measured installed pins 7fbdfa9 / 657e021: 232/678.
    assert.ok(trackedText >= 6385, `only ${trackedText} tracked text files; migration baseline is 6385`);
    assert.ok(upstreamCounts['bw-board'] >= 232, `engine source walk collapsed: ${upstreamCounts['bw-board']}`);
    assert.ok(upstreamCounts['bw-circuit-ui'] >= 678, `UI source walk collapsed: ${upstreamCounts['bw-circuit-ui']}`);
    assert.deepEqual(stale, [], 'KNOWN entries whose NUL is gone — remove them:\n  ' + stale.join('\n  '));
    assert.deepEqual(findings, [], 'literal NUL byte(s) in tracked text:\n  ' + findings.join('\n  '));
});

test('the binary roles name real formats, and no text format is among them', () => {
    for (const [role, exts] of Object.entries(BINARY_BY_ROLE)) assert.ok(exts.length > 0, role);
    for (const ext of ['js', 'mjs', 'jsx', 'json', 'md', 'yml', 'txt', 'html', 'css', 'svg', 'asm', 'sh', 'step', 'stp', 'dxf']) assert.equal(isBinaryByRole(`x.${ext}`), false, `${ext} is text`);
});

test('DWG is binary by format while the same NUL bytes in drawing text still fail', () => {
    const file = 'test/fixtures/cad/browser/inch-plate.dwg';
    const buf = readFileSync(path.join(ROOT, file));
    assert.equal(buf.subarray(0, 6).toString(), 'AC1032');
    assert.ok(buf.includes(0), 'the retained binary drawing contains NUL bytes');
    assert.equal(isBinaryByRole('another/path/renamed.DWG'), true, 'the role is a format, not one filename');
    const binary = judge([{file, buf}], []);
    assert.deepEqual(binary.findings, []);
    assert.equal(binary.scanned, 0);
    for (const file of ['drawing.step', 'drawing.stp', 'drawing.dxf', 'drawing.dwg.js']) {
        const text = judge([{file, buf}], []);
        assert.equal(text.scanned, 1);
        assert.ok(text.findings.some(finding => finding.includes('literal NUL')), `${file} must still report NUL bytes`);
    }
});

test('mutation: a NUL in a .js file is red naming file, line, offset and context; the same bytes in a .png are not', () => {
    const buf = Buffer.from(`const k = \`\${a}${NUL}\${b}\`;\nnext line\n`, 'utf8');
    const r = judge([{file: 'src/x.js', buf}, {file: 'img/x.png', buf}], []);
    assert.equal(r.findings.length, 1, r.findings.join('\n'));
    assert.match(r.findings[0], /^src\/x\.js:1 byte 15: literal NUL — …const k = `\$\{a\}<NUL>\$\{b\}`;⏎next line⏎…/);
});

test('a disk image is binary by role, and the one this repo tracks is skipped whole', () => {
    // The real file, not a fixture: #238 tracks a 360K MS-DOS 2.0 FAT12 image
    // twice, and 338,112 of its bytes are NUL because an empty FAT12 data area
    // IS NUL. Reading it as text is what reclaimed the CI runner.
    for (const ext of ['img', 'ima', 'iso', 'vhd', 'dsk']) assert.equal(isBinaryByRole(`d/x.${ext}`), true, ext);
    const image = path.join(ROOT, 'overlay/scratch-gui/static/dos/msdos200-base.img');
    if (!existsSync(image)) return;   // the lane that added it may be gone; the roles above still hold
    const buf = readFileSync(image);
    assert.ok(nulsIn(buf).length > 100000,
        'this image is the reason the role exists — if it stopped being mostly NUL, re-derive the claim');
    const r = judge([{file: 'overlay/scratch-gui/static/dos/msdos200-base.img', buf}], []);
    assert.deepEqual(r.findings, []);
    assert.equal(r.scanned, 0, 'the image must not be scanned as text at all');
});

test('REPORTING IS BOUNDED: a mostly-NUL file under an unlisted extension fails BY NAME, and fast', () => {
    // The promise in this file's header — a new binary format "fails by name
    // once and gets its extension added with its reason" — was not true, and
    // the cost of breaking it was the whole job. Both halves are held here.
    //
    // 256 KB of NUL under an extension nothing lists. The count stays exact,
    // because KNOWN and the live-tree test compare against it.
    const buf = Buffer.alloc(256 << 10);
    const started = Date.now();
    const hits = nulsIn(buf);
    assert.equal(hits.length, 256 << 10, 'every NUL is still counted');
    assert.equal(hits.filter(h => h.context !== null).length, MAX_DETAIL,
        'evidence is built for the first MAX_DETAIL hits and no more');

    const r = judge([{file: 'vendor/x.dat', buf}], []);
    assert.equal(r.findings.length, MAX_DETAIL + 1, r.findings.length + ' finding lines');
    assert.match(r.findings.at(-1), /and 262139 more NUL\(s\), 262144 in all/,
        'the last line must give the true total, or a bounded report becomes a lying one');
    assert.match(r.findings.at(-1), /add its extension to BINARY_BY_ROLE/,
        'and it must say what to do, since that is the whole promise');

    // LINEARITY, held by a budget rather than assumed, and the budget SEPARATES
    // two measured costs rather than guessing at one. MEASURED 2026-09-21 on
    // this box under load, three runs: 471 / 164 / 110 ms for this buffer.
    // The pre-fix implementation re-sliced the buffer from byte 0 for every hit
    // and took 95,296 ms on the SAME buffer — that is the number this budget
    // has to be under, and 10 s sits an order of magnitude below it while
    // leaving ~20x headroom over the slowest linear run seen.
    //
    // The size is chosen for that separation too: at 1 MB the linear scan is
    // still half a second, but a quadratic revert would take ~25 minutes and
    // be reported as a timeout somewhere else rather than as this sentence.
    const elapsed = Date.now() - started;
    assert.ok(elapsed < 10000, `scanning 256 KB of NUL took ${elapsed} ms; the scan is no longer linear`);
});

test('mutation: a KNOWN entry whose NUL is gone is stale, and one whose count moved is a finding', () => {
    const known = [{file: 'a.js', nuls: 1, pin: 'x', why: 'w'}, {file: 'b.js', nuls: 1, pin: 'x', why: 'w'}];
    const r = judge([{file: 'a.js', buf: Buffer.from('clean\n')}, {file: 'b.js', buf: Buffer.from(NUL + NUL)}], known);
    assert.equal(r.stale.length, 1); assert.match(r.stale[0], /^a\.js: KNOWN says 1 NUL/);
    assert.equal(r.findings.length, 1); assert.match(r.findings[0], /^b\.js: KNOWN says 1 NUL\(s\), the file has 2/);
});

test('the live tree: KNOWN today is exactly the files that still carry a NUL, and this file carries none', () => {
    for (const k of KNOWN) {
        const [, name, , ...relative] = k.file.split('/');
        const hits = nulsIn(readFileSync(path.join(packageSourceRoot(name), ...relative)));
        assert.equal(hits.length, k.nuls, `${k.file}: ${hits.length} NUL(s) today, KNOWN says ${k.nuls}`);
    }
    assert.equal(nulsIn(readFileSync(new URL(import.meta.url))).length, 0, 'this test spells the byte only as an escape');
});
