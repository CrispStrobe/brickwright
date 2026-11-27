#!/usr/bin/env node
/**
 * Build the prebuilt lesson firmware images — D2's second half.
 *
 * WHAT IT DOES, in one line: for every lesson whose example needs a compiler
 * the browser does not carry, compile that example's own program through the
 * SAME service the debug runner would have called, and write the result into
 * `overlay/scratch-gui/static/lesson-images/` with enough provenance that a
 * later reader can tell whether it still describes the program.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: build images for the five supported 8051
 * targets. Those compile in the browser since 2026-08-31 (D2's first half), and
 * shipping an image for them would create a second source of truth for a build
 * the app can already do — the failure mode being an image that goes stale
 * while the local toolchain quietly produces something else.
 *
 * It also skips the machine benches (they already ship ROMs — D7) and the
 * micro:bit / SPIKE benches (their runtimes are bundled simulators; they never
 * touch `/compile` at all).
 *
 * THE C MUST BE THE C THE BROWSER SENDS. This script parses `program.bw` with
 * lite's own vendored sb3-creator and calls `generateC(project, {debug: true})`
 * — the debug runner reaches the same emitter through a scratch-vm round trip
 * (`vm.toJSON()` with `runtime.stc` reattached). The round trip is asserted to
 * be byte-identical in `test/shipped-lesson-images.test.mjs`; if it ever stops
 * being so, that test goes red before anyone can ship a mismatched image.
 *
 * Usage:
 *   node scripts/build-lesson-images.mjs                 # build everything missing
 *   node scripts/build-lesson-images.mjs --force         # rebuild all
 *   node scripts/build-lesson-images.mjs --only <exampleId>[,<id>…]
 *   BW_COMPILER_URL=… node scripts/build-lesson-images.mjs
 */
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

import {
    compileTargetFor, compileFormatFor, LOCAL_8051_TARGETS, SHIPPED_IMAGE_DIR, canonicalCode
} from '../overlay/scratch-gui/src/lib/bw-debug/shipped-images.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, '..');
const OVERLAY = path.join(REPO, 'overlay/scratch-gui');
const EXAMPLES = path.join(OVERLAY, 'examples');
const WAVES = path.join(OVERLAY, 'src/components/gui/lesson-waves');
const OUT = path.join(OVERLAY, SHIPPED_IMAGE_DIR);
const INTEGRATED = process.env.BW_INTEGRATED_ROOT
    ? path.resolve(process.env.BW_INTEGRATED_ROOT)
    : path.join(REPO, 'packages/scratch-gui');
const COMPILER = process.env.BW_COMPILER_URL || 'https://stc-compiler.vercel.app';

const sha256 = s => createHash('sha256').update(s, 'utf8').digest('hex');

/**
 * Families that have no `/compile` route at all, so a shipped image would be
 * meaningless. Named rather than filtered by exclusion, because "the list of
 * things I did not build" is the part of a build script a reader needs.
 */
const NOT_COMPILED = new Map([
    ['microbit', 'runs on the bundled micro:bit simulator; no /compile route'],
    ['micro-bit', 'runs on the bundled micro:bit simulator; no /compile route'],
    ['spike', 'runs on the bundled SPIKE simulator; no /compile route'],
    ['eater6502', 'a machine bench: ships a ROM already (D7), never compiled']
]);

/** Every example any lesson names, with the device its program declares. */
export function surveyLessonExamples () {
    const index = JSON.parse(readFileSync(path.join(EXAMPLES, 'index.json'), 'utf8'));
    const entries = new Map((Array.isArray(index) ? index : index.examples).map(e => [e.id, e]));
    const rows = new Map();
    for (const file of readdirSync(WAVES).filter(f => f.endsWith('.json'))) {
        const wave = JSON.parse(readFileSync(path.join(WAVES, file), 'utf8'));
        for (const lesson of wave.lessons || []) {
            // Logikus opens a native logic-machine preset instead of a gallery circuit.
            if (lesson.loadMode === 'logikus' && lesson.presetId && !lesson.exampleId) continue;
            const entry = entries.get(lesson.exampleId);
            const programRel = entry && entry.files && entry.files.program;
            let program = null;
            if (programRel && existsSync(path.join(EXAMPLES, programRel))) {
                program = readFileSync(path.join(EXAMPLES, programRel), 'utf8');
            }
            const device = program
                ? String((program.match(/^DEVICE\s+([^\s:]+)/mi) || [])[1] || '').toLowerCase()
                : '';
            const row = rows.get(lesson.exampleId) || {
                exampleId: lesson.exampleId, device, program, programRel,
                hasRom: !!(entry && entry.files && entry.files.rom), lessons: []
            };
            row.lessons.push({wave: wave.wave || file.replace(/\.json$/, ''),
                id: lesson.id, environment: lesson.environment});
            rows.set(lesson.exampleId, row);
        }
    }
    for (const row of rows.values()) {
        row.target = row.device ? compileTargetFor(row.device) : null;
        row.format = row.device ? compileFormatFor(row.device) : null;
        row.reason =
            !row.program ? 'circuit-only: no program to compile'
                : !row.device ? 'the program declares no DEVICE'
                    : NOT_COMPILED.get(row.device) || NOT_COMPILED.get(row.target) ||
                (LOCAL_8051_TARGETS.has(row.target)
                    ? 'compiles in the browser (D2 first half)' : null);
        row.needsImage = row.reason === null;
    }
    return [...rows.values()].sort((a, b) => a.exampleId.localeCompare(b.exampleId));
}

/** The C the browser would POST, from this repo's own emitter. */
export async function generateDebugC (programSource) {
    const {default: SB3Creator} =
        await import(pathToFileURL(path.join(INTEGRATED, 'src/lib/sb3-creator.js')).href);
    const creator = new SB3Creator();
    creator.parse(programSource);
    return creator.generateC(undefined, {debug: true});
}

async function health () {
    const res = await fetch(`${COMPILER}/health`);
    if (!res.ok) throw new Error(`/health returned ${res.status}`);
    return res.json();
}

/** The toolchain string that belongs on an image for `target`, from /health. */
function toolchainFor (target, h) {
    if (h.arm_targets && h.arm_targets[target]) return h.arm_gcc;
    if (h.avr_targets && h.avr_targets[target]) return h.avr_gcc;
    if (h.targets && h.targets[target]) return h.sdcc;
    return null;
}

async function main () {
    const argv = process.argv.slice(2);
    const force = argv.includes('--force');
    const onlyArg = argv[argv.indexOf('--only') + 1];
    const only = argv.includes('--only') && onlyArg
        ? new Set(onlyArg.split(',').map(s => s.trim())) : null;

    const survey = surveyLessonExamples();
    const wanted = survey.filter(r => r.needsImage && (!only || only.has(r.exampleId)));

    console.log(`${survey.length} examples named by lessons; ${survey.filter(r => r.needsImage).length} need a shipped image`);
    for (const row of survey.filter(r => !r.needsImage)) {
        console.log(`  skip ${row.exampleId.padEnd(34)} ${row.reason}`);
    }

    const h = await health();
    console.log(`compiler ${COMPILER} @ ${h.version}`);

    mkdirSync(OUT, {recursive: true});
    const manifestPath = path.join(OUT, 'manifest.json');
    const previous = existsSync(manifestPath)
        ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {images: []};
    const previousByFile = new Map((previous.images || []).map(e => [e.file, e]));

    const images = [];
    const built = [];
    const refused = [];
    for (const row of wanted) {
        const code = await generateDebugC(row.program);
        // The key is the CANONICAL C: `generateC({debug:true})` writes a fresh
        // random block id into every `@bw yield` line on every parse, so the raw
        // string is different each time while the compiled image is not. See
        // shipped-images.js for the measurement.
        const canonical = canonicalCode(code);
        const codeSha256 = sha256(canonical);
        const file = `${row.exampleId}.${row.target}.${row.format}.json`;
        const old = previousByFile.get(file);
        const payloadPath = path.join(OUT, file);
        if (!force && old && old.codeSha256 === codeSha256 && existsSync(payloadPath)) {
            images.push(old);
            console.log(`  keep ${file} (${old.bytes} bytes)`);
            continue;
        }
        process.stdout.write(`  build ${file} … `);
        const res = await fetch(`${COMPILER}/compile`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                code, language: 'c', target: row.target, format: row.format, symbols: true
            })
        });
        const out = await res.json();
        if (!out.success) {
            // A refusal is RECORDED, not swallowed and not fatal. The example
            // that found this branch (`arduino-02-blink-without-delay`) cannot
            // be built by anyone, with or without a network — the emitter's AVR
            // preamble calls `bw_now()` and only defines it when something else
            // in the program set `_cUses.now`. Aborting the whole build here
            // would have hidden thirteen good images behind one upstream bug;
            // pretending it built would be worse. It goes in the manifest's
            // `refused` list, and the gate ratchets that list so a NEW refusal
            // fails CI while this known one does not.
            console.log('REFUSED');
            refused.push({
                exampleId: row.exampleId, target: row.target, format: row.format,
                lessons: row.lessons.map(l => `${l.wave}/${l.id}`),
                error: String(out.error || 'no reason given').replace(/\s+/g, ' ').slice(0, 300)
            });
            continue;
        }
        if (!out.symbols && row.format !== 'bin') {
            throw new Error(`${row.exampleId}: built but carries no symbol table ` +
                `(${out.symbols_error || 'no reason given'}) — the debugger could not ` +
                `say where it is, so this image is not worth shipping`);
        }
        // Only the fields build() reads, plus the exact canonical code that
        // produced them. Keeping `listing`/`disassembly`/`log` would triple the
        // asset for text the runner never looks at; keeping `code` is what makes
        // the lookup an identity rather than a hash bet.
        //
        // The echoed `block` id in each symbol yield is DELETED. It belongs to
        // the parse this script happened to do and to no other, nothing in
        // bw-board or lite reads it (both debug targets index
        // `${task.name}/${y.state}`), and an id that is wrong is worse than an
        // id that is absent: absent fails loudly the day someone needs it.
        const symbols = out.symbols ? JSON.parse(JSON.stringify(out.symbols)) : null;
        for (const task of (symbols && symbols.scheduler && symbols.scheduler.tasks) || []) {
            for (const y of task.yields || []) delete y.block;
        }
        const payload = {
            code: canonical,
            base64: out.base64,
            symbols,
            bytes: out.bytes,
            format: out.format || row.format,
            f_cpu: out.f_cpu || out.fcpu || out.clockHz || null
        };
        writeFileSync(payloadPath, `${JSON.stringify(payload, null, 0)}\n`);
        const entry = {
            exampleId: row.exampleId,
            file,
            target: row.target,
            format: row.format,
            device: row.device,
            bytes: out.bytes,
            codeLength: canonical.length,
            codeSha256,
            programSha256: sha256(row.program),
            program: row.programRel,
            toolchain: toolchainFor(row.target, h),
            lessons: row.lessons.map(l => `${l.wave}/${l.id}`)
        };
        images.push(entry);
        built.push(entry);
        console.log(`${out.bytes} bytes`);
    }

    if (!only) {
        // A manifest that keeps an entry for an example no lesson names any more
        // is a stale promise. Drop both the entry and its payload.
        const live = new Set(images.map(e => e.file));
        for (const f of readdirSync(OUT)) {
            if (f === 'manifest.json' || live.has(f)) continue;
            rmSync(path.join(OUT, f));
            console.log(`  drop ${f} (no lesson names it)`);
        }
    } else {
        for (const e of previous.images || []) if (!images.some(i => i.file === e.file)) images.push(e);
    }

    images.sort((a, b) => a.file.localeCompare(b.file));
    const manifest = {
        // What this file is, for whoever opens it without the script.
        note: 'Prebuilt lesson firmware. Generated by scripts/build-lesson-images.mjs; ' +
            'gated by test/shipped-lesson-images.test.mjs. Each image is keyed by the EXACT ' +
            'canonical C its payload carries — the generated C with the per-parse random ' +
            'block id in each `@bw yield` marker blanked, which is the only part of it that ' +
            'is not deterministic and the only part the compiler ignores. An edited program ' +
            'changes real code, misses, and is compiled fresh.',
        builtAt: new Date().toISOString().slice(0, 10),
        service: `${COMPILER} @ ${h.version}`,
        images,
        // Lesson benches that need a shipped image and could not be given one.
        // Kept in the shipped manifest deliberately: the honest residue belongs
        // where the promise is, not only in a review document.
        refused: only
            ? (previous.refused || [])
            : refused.sort((a, b) => a.exampleId.localeCompare(b.exampleId))
    };
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`wrote ${path.relative(REPO, manifestPath)}: ${images.length} images, ` +
        `${built.length} newly built, ${manifest.refused.length} refused`);
    for (const r of manifest.refused) console.log(`  REFUSED ${r.exampleId}: ${r.error.slice(0, 120)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch(e => {
        console.error(e && e.message ? e.message : e);
        process.exit(1);
    });
}
