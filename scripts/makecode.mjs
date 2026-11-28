#!/usr/bin/env node
/**
 * The MakeCode command line: Scratch projects to MakeCode firmware and back,
 * offline, with MakeCode's own compiler (the runtime `npm run sync:makecode`
 * fetches). The app's Code tab does the same through the same libraries.
 *
 *   node scripts/makecode.mjs to-hex <in.sb3|in.bw> [-o out.hex] [--target microbit|arcade]
 *       A real micro:bit firmware (V1 + V2 universal .hex) with the project
 *       embedded, so makecode.microbit.org reopens it as the project. For
 *       --target arcade it needs --board <variant> (ARCADE_HARDWARE, e.g. rp2040)
 *       and writes that board's firmware (.uf2, or .hex for nRF52833 boards);
 *       --source writes legacy source HEX for Brickwright. Use to-project
 *       for a native project file the original MakeCode editors can open.
 *   node scripts/makecode.mjs to-project <in.sb3|in.bw> [-o out.mkcd] [--target microbit|arcade]
 *   node scripts/makecode.mjs to-ts  <in.sb3|in.bw> [-o out.ts] [--target microbit|arcade]
 *       Just the MakeCode TypeScript (and the named list of what did not map).
 *   node scripts/makecode.mjs to-sb3 <in.ts|in.hex|in.uf2|in.png|in.mkcd|share-url> [-o out.sb3] [--bw out.bw] [--target microbit|arcade]
 *       A MakeCode project (from a bare main.ts for --target, its firmware, cartridge or share link) as a
 *       Scratch project, through the importer's translation; what did not
 *       translate is listed.
 *
 * TARGETS (task A6). --target is microbit, arcade, calliopemini (alias
 * calliope) or ev3 — the targets whose translators the app's Code tab uses.
 * A Calliope mini goes through export-calliope.js (the micro:bit walk with
 * pxt-calliope's differences and its own default packages); an EV3 project
 * through export-ev3.js. A file's own target wins on import; --target
 * names it for a bare main.ts and for the export commands.
 *
 *   node scripts/makecode.mjs run <in.hex|in.ts|in.sb3|in.bw> [--target microbit|calliopemini] [--board v1|v2] [--seconds N] [--json]
 *   node scripts/makecode.mjs run <boards.bw|boards.sb3> [--press <Board>:<A|B>@<from>-<to>]... [--seconds N] [--json]
 *       (a program with several boards: every board its own machine, their radios on one simulated air)
 *       Runs the program on LabWired's micro:bit V1 board (nRF51822, Nordic
 *       S110 SoftDevice EMULATED: only the application region of the .hex is
 *       loaded), headless, for N seconds of guest time (default 5): prints the
 *       serial console as it arrives and the 5x5 LED matrix when it changes.
 *       A firmware .hex runs as it is; a .ts/.sb3/.bw, or a .hex that only
 *       carries a project, is compiled first (task A7). --board v2 runs a
 *       micro:bit program on the V2 board (nRF52833), compiled for the
 *       emulator onto the Bluetooth-free bases; a universal hex is refused
 *       there (its V2 section carries Nordic's SoftDevice) (task A8).
 *
 * Exit codes: 0 done, 1 the program does not compile / refused / faulted, 2 bad usage,
 * 3 the runtime (or, for run, the LabWired engine) is not synced. What was not translated is always printed.
 */
import {createProjectedCostumePaletteLookup} from './lib/project-palette-lookup.mjs';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import JSZip from 'jszip';
import {createRequire} from 'node:module';
import {compile, hasRuntime} from './lib/pxt-node.mjs';
import {integratedGuiLibrary} from './lib/integrated-gui-library.mjs';
import {validateCrispBasicPseudocode, validateCrispBasicProject, crispBasicModeError}
    from '../packages/scratch-gui/src/lib/sb3-creator-crispbasic-mode.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const guiLibraries = integratedGuiLibrary(ROOT);
const lib = rel => guiLibraries.import(rel);
// F10: an imported MakeCode project's own files, kept in the .sb3 (the VM overlay module).
const makeCodeOriginal = createRequire(import.meta.url)(
    path.join(ROOT, 'overlay/scratch-vm/src/serialization/bw-makecode-original.js'));

const USAGE = `usage:
  node scripts/makecode.mjs tutorial-to-project <tutorial.md> --main <main.ts> [-o out.mkcd] [--target arcade|microbit]
  node scripts/makecode.mjs to-project <in.sb3|in.bw> [-o out.mkcd] [--target TARGET]
  node scripts/makecode.mjs to-hex <in.sb3|in.bw> [-o out.hex|out.uf2] [--target TARGET] [--board variant] [--source]
  node scripts/makecode.mjs to-ts  <in.sb3|in.bw> [-o out.ts]  [--target TARGET]
  node scripts/makecode.mjs to-sb3 <in.ts|in.hex|in.uf2|in.png|in.mkcd|share-url> [-o out.sb3] [--bw out.bw] [--target TARGET] [--fetch-extensions [--extension-cache DIR]]
  node scripts/makecode.mjs run <in.hex|in.ts|in.sb3|in.bw> [--target microbit|calliopemini] [--board v1|v2] [--seconds N] [--json]
  node scripts/makecode.mjs run <boards.bw|boards.sb3> [--press <Board>:<A|B>@<from>-<to>]... [--seconds N] [--json]
TARGET: microbit (default), arcade, calliopemini (or calliope), ev3`;

/** The targets the CLI exports to and imports for: the Code tab's translators. */
const TARGETS = ['microbit', 'arcade', 'calliopemini', 'ev3'];
const TARGET_ALIAS = {calliope: 'calliopemini'};
const EDITOR_URL = {microbit: 'https://makecode.microbit.org/', arcade: 'https://arcade.makecode.com/',
    calliopemini: 'https://makecode.calliope.cc/', ev3: 'https://makecode.mindstorms.com/'};
const TARGET_NAME = {microbit: 'micro:bit (V1 + V2)', calliopemini: 'Calliope mini', ev3: 'LEGO MINDSTORMS EV3'};
/** Each target's own new-project packages, for a bare main.ts and the export's pxt.json. */
const DEFAULT_DEPENDENCIES = {microbit: {core: '*', radio: '*', microphone: '*'}, arcade: {device: '*'},
    calliopemini: {core: '*', radio: '*'}, ev3: {ev3: '*'}};

function args (argv) {
    const out = {cmd: argv[0], input: null, output: null, target: 'microbit', board: '', source: false, bw: null, mainSource: null,
        seconds: 5, json: false, press: []};
    for (let i = 1; i < argv.length; i++) {
        const a = argv[i];
        if (a === '-o') out.output = argv[++i];
        else if (a === '--target') out.target = TARGET_ALIAS[argv[i + 1]] || argv[i + 1], i++;
        else if (a === '--board') out.board = argv[++i];
        else if (a === '--source') out.source = true;
        else if (a === '--bw') out.bw = argv[++i];
        else if (a === '--main') out.mainSource = argv[++i];
        else if (a === '--seconds') out.seconds = Number(argv[++i]);
        else if (a === '--json') out.json = true;
        else if (a === '--press') out.press.push(argv[++i]);
        else if (a === '--fetch-extensions') out.fetchExtensions = true;
        else if (a === '--extension-cache') out.extensionCache = argv[++i];
        else if (!out.input) out.input = a;
        else throw Object.assign(new Error(`unexpected argument ${a}`), {usage: true});
    }
    if (!out.cmd || !out.input) throw Object.assign(new Error('missing command or input'), {usage: true});
    if (!TARGETS.includes(out.target)) throw Object.assign(new Error(`unknown --target ${out.target} (${TARGETS.join(', ')})`), {usage: true});
    if (out.cmd === 'run') {
        if (out.board && !RUN_BOARDS[out.board]) throw Object.assign(new Error(`run --board is v1 or v2, not ${out.board}`), {usage: true});
        if (out.board === 'v2' && out.target !== 'microbit') {
            throw Object.assign(new Error(`--board v2 is the micro:bit V2; a ${out.target} runs on --board v1`), {usage: true});
        }
    } else if (out.board && out.target !== 'arcade') throw Object.assign(new Error('--board is for Arcade only'), {usage: true});
    if (!(out.seconds > 0 && out.seconds <= 600)) throw Object.assign(new Error('--seconds must be between 0 and 600'), {usage: true});
    if (out.press.length && out.cmd !== 'run') throw Object.assign(new Error('--press is for run'), {usage: true});
    if (out.extensionCache && !out.fetchExtensions) throw Object.assign(new Error('--extension-cache needs --fetch-extensions'), {usage: true});
    if (out.fetchExtensions && out.cmd !== 'to-sb3') throw Object.assign(new Error('--fetch-extensions is for to-sb3'), {usage: true});
    return out;
}

const base = f => path.basename(f).replace(/\.[^.]+$/, '');

/** A project JSON plus a costume lookup, from an .sb3 or a .bw. */
async function readProject (file) {
    // Reject the durable runtime requirement before compiler/VM admission.
    // Unmarked programs still use the canonical integrated library boundary.
    const requireOrdinaryProject = project => {
        if (validateCrispBasicProject(project)) throw crispBasicModeError('MakeCode export and execution');
    };
    if (/\.bw$|\.txt$/i.test(file)) {
        const source = fs.readFileSync(file, 'utf8');
        if (validateCrispBasicPseudocode(source)) throw crispBasicModeError('MakeCode export and execution');
        const {default: SB3Creator} = await lib('sb3-creator.js');
        const cr = new SB3Creator();
        cr.parse(source);
        requireOrdinaryProject(cr.project);
        const costumeSvg = (t, c) => {
            const a = cr.assets.get(c.assetId);
            return a && a.type === 'svg' ? a.data : null;
        };
        const soundData = (t, s) => cr.assets.get(s.assetId)?.data || null;
        return {project: cr.project, costumeSvg, costumePalette: () => null, soundData};
    }
    const input = fs.readFileSync(file);
    const zip = await JSZip.loadAsync(input);
    const json = zip.file('project.json');
    if (!json) throw new Error(`${file}: no project.json — not an .sb3`);
    const project = JSON.parse(await json.async('string'));
    requireOrdinaryProject(project);
    // Before anything rewrites the targets: the fingerprint is over the saved program.
    const original = makeCodeOriginal.original(project);
    const svgs = new Map();
    for (const name of Object.keys(zip.files)) if (/\.svg$/i.test(name)) svgs.set(name, await zip.file(name).async('string'));
    const costumeSvg = (t, c) => svgs.get(c.md5ext || `${c.assetId}.${c.dataFormat}`) || null;
    // Sound files, for the Arcade export's tone check (a steady tone plays; sampled audio is named).
    const audio = new Map();
    for (const name of Object.keys(zip.files)) if (/\.wav$/i.test(name)) audio.set(name, await zip.file(name).async('uint8array'));
    const soundData = (t, s) => audio.get(s.md5ext || `${s.assetId}.${s.dataFormat}`) || null;
    const palettes = new Map(), animationDocuments = [], warnings = [];
    const {inspectArtwork} = await lib('bw-artwork-bundle.js');
    const artwork = await inspectArtwork(input);
    if (artwork.outcome === 'loaded') {
        for (const record of artwork.records) {
            if (record.document.palette) palettes.set(`${record.targetIndex}:${record.costumeIndex}`, record.document.palette);
            if (record.document.animation?.resource) animationDocuments.push(record.document);
        }
    } else if (artwork.outcome === 'invalid' || artwork.outcome === 'future') {
        warnings.push(`Editable artwork source not exported: ${artwork.reason || 'unsupported future artwork version'}`);
    }
    const {withoutAssetLibraries} = await lib('bw-asset-library.js');
    const exportedProject = withoutAssetLibraries(project, artwork.libraries || []);
    const costumePalette = createProjectedCostumePaletteLookup(project, exportedProject, palettes);
    return {project: exportedProject,
        costumeSvg, costumePalette, soundData, animationDocuments, warnings, original};
}

/** The MakeCode files for a project, for a target, with what did not map. */
async function toMakeCode (file, target) {
    const {project, costumeSvg, costumePalette, soundData, animationDocuments = [], warnings = [], original} = await readProject(file);
    const name = base(file).slice(0, 40);
    // F10: a project imported from MakeCode and not changed since exports its
    // own files; once changed, the blocks are exported and the original is only
    // reported as stale.
    if (original && original.status === 'current' && original.target === target) {
        return {ts: original.files['main.ts'], files: original.files, unsupported: [],
            warnings: ['the original MakeCode files: the program is unchanged since it was imported'], name};
    }
    if (original && original.status === 'stale' && original.target === target) {
        warnings.push('the imported MakeCode original no longer matches this program (it changed since import); exported from the blocks');
    }
    if (target === 'arcade') {
        const {projectJsonToArcade} = await lib('bw-makecode/export-arcade.js');
        const out = projectJsonToArcade(JSON.stringify(project), {name, costumeSvg, costumePalette, soundData, animationDocuments});
        return {...out, warnings: [...warnings, ...out.warnings], name};
    }
    if (target === 'ev3') {
        const {exportToMakeCodeEv3} = await lib('bw-makecode/export-ev3.js');
        const out = exportToMakeCodeEv3(project, {name});
        return {ts: out.ts, files: out.files, unsupported: out.unsupported, warnings, name};
    }
    if (target === 'calliopemini') {
        // The micro:bit walk with pxt-calliope's differences (export-calliope.js).
        const {exportToMakeCodeCalliope} = await lib('bw-makecode/export-calliope.js');
        const out = exportToMakeCodeCalliope(project, {name});
        return {ts: out.ts, files: out.files, unsupported: out.unsupported, warnings, name};
    }
    const {exportToMakeCode} = await lib('bw-makecode/export.js');
    const out = exportToMakeCode(project, {name, target});
    return {ts: out.ts, files: out.files, unsupported: out.unsupported, warnings, name};
}

function report (out) {
    for (const u of out.unsupported || []) console.error(`  not translated: ${u}`);
    for (const w of out.warnings || []) console.error(`  note: ${w}`);
}

async function main () {
    let a;
    try {
        a = args(process.argv.slice(2));
    } catch (e) {
        console.error(`${e.message}\n${USAGE}`);
        return 2;
    }
    if (a.cmd === 'tutorial-to-project') {
        if (!['microbit', 'arcade'].includes(a.target)) {
            console.error(`tutorial-to-project is for microbit and arcade tutorials, not ${a.target}`);
            return 2;
        }
        if (!a.mainSource) { console.error(`tutorial-to-project requires --main <main.ts>\n${USAGE}`); return 2; }
        const {tutorialProjectFiles, hasTutorialJres} = await lib('bw-makecode/tutorial-project.js');
        const {makeCodeProjectFile} = await lib('bw-makecode/project-file.js');
        const markdown = fs.readFileSync(a.input, 'utf8');
        const {getTutorialTilemapGenerator} = await import('./lib/pxt-node.mjs');
        const project = tutorialProjectFiles(markdown, fs.readFileSync(a.mainSource, 'utf8'), {name: base(a.input), target: a.target,
            jresToTypeScript: hasTutorialJres(markdown) ? await getTutorialTilemapGenerator(a.target) : undefined});
        const dest = a.output || `${base(a.input)}.${a.target}.mkcd`;
        fs.writeFileSync(dest, makeCodeProjectFile(project.files, {name: base(a.input), target: a.target}));
        console.log(`wrote ${dest} (${Object.keys(project.files).length} project files; package dependencies preserved, not fetched)`);
        if (project.customFiles.length) console.error(`  note: supplemental tutorial code preserved: ${project.customFiles.join(', ')}`);
        return 0;
    }
    if (a.cmd === 'to-ts') {
        const out = await toMakeCode(a.input, a.target);
        report(out);
        const dest = a.output || `${base(a.input)}.ts`;
        fs.writeFileSync(dest, out.ts);
        console.log(`wrote ${dest} (${out.unsupported.length} not translated)`);
        return 0;
    }
    if (a.cmd === 'to-project') {
        const out = await toMakeCode(a.input, a.target);
        report(out);
        const {makeCodeProjectFile} = await lib('bw-makecode/project-file.js');
        const dest = a.output || `${base(a.input)}.${a.target}.mkcd`;
        fs.writeFileSync(dest, makeCodeProjectFile(out.files, {name: out.name, target: a.target}));
        console.log(`wrote ${dest} — native MakeCode project (no firmware)`);
        return 0;
    }
    if (a.cmd === 'to-hex') {
        const out = await toMakeCode(a.input, a.target);
        report(out);
        if (a.source) {
            const {makeCodeSourceHex} = await lib('bw-makecode/export.js');
            const dest = a.output || `${base(a.input)}.${a.target}-project.hex`;
            fs.writeFileSync(dest, makeCodeSourceHex(out.files, {name: out.name, target: a.target,
                editorUrl: EDITOR_URL[a.target]}));
            console.log(`wrote ${dest} — legacy source HEX for Brickwright (no firmware); use to-project for the original MakeCode editor`);
            return 0;
        }
        if (!hasRuntime(a.target)) {
            console.error('the MakeCode runtime is not synced — run `npm run sync:makecode`');
            return 3;
        }
        if (a.target === 'arcade') {
            const {ARCADE_HARDWARE} = await lib('bw-makecode/pxt-runtime.js');
            if (!a.board || !ARCADE_HARDWARE[a.board]) {
                console.error(`Arcade firmware needs --board (${Object.keys(ARCADE_HARDWARE).join(', ')}); ` +
                    'to-project --target arcade writes a native project file instead');
                return 2;
            }
        }
        let r;
        try {
            r = await compile(a.target, out.files, {native: true, hwVariant: a.board,
                embedSource: {files: out.files, name: out.name, editorUrl: EDITOR_URL[a.target]}});
        } catch (e) {
            if (e.code === 'NO_BASE_HEX') {
                console.error(`refused: ${e.message}. ${a.target === 'arcade' ?
                    `no firmware base is synced for ${a.board} — \`npm run sync:makecode\` fetches it; to-project --target arcade writes a native project file.` :
                    'A C++ package outside MakeCode\'s default set needs its cloud compiler.'}`);
                return 1;
            }
            throw e;
        }
        if (!r.success) {
            for (const d of r.diagnostics.slice(0, 10)) console.error(`  ${d.file}:${d.line + 1}: ${d.message}`);
            console.error(`MakeCode did not compile the export (${r.diagnostics.length} error(s))`);
            return 1;
        }
        const {firmwareFile} = await lib('bw-makecode/pxt-runtime.js');
        const firmware = firmwareFile(r.outfiles);
        if (!firmware) { console.error('MakeCode compiled no firmware file'); return 1; }
        const dest = a.output || `${base(a.input)}${a.target === 'arcade' ? `-${a.board}` : ''}${path.extname(firmware.name)}`;
        fs.writeFileSync(dest, firmware.bytes);
        console.log(`wrote ${dest} — ${(firmware.bytes.length / 1024).toFixed(0)} KB ` +
            `${a.target === 'arcade' ? `Arcade ${a.board}` : TARGET_NAME[a.target]} firmware, project embedded; ` +
            `${out.unsupported.length} not translated`);
        return 0;
    }
    if (a.cmd === 'to-sb3') {
        const mc = await lib('bw-makecode/index.js');
        const extensionCache = a.extensionCache ? (await import('./lib/extension-file-cache.mjs')).fileExtensionCache(path.resolve(a.extensionCache)) : null;
        const dependencyOptions = a.fetchExtensions ? {prepareDependencies:true,fetchExtensions:true,
            ...(extensionCache ? {extensionCache} : {}),
            resolveProjectInputs:async (...args) => (await import('./lib/pxt-node.mjs')).resolveProjectInputs(...args)} : {};
        let res;
        if (/\.ts$/i.test(a.input)) {
            // A bare main.ts carries no pxt.json: give it the target's default
            // packages. A program that needs another package fails by name.
            const dependencies = DEFAULT_DEPENDENCIES[a.target];
            const files = {'main.ts': fs.readFileSync(a.input, 'utf8'),
                'pxt.json': JSON.stringify({name: base(a.input), dependencies, files: ['main.ts']})};
            res = a.fetchExtensions ? await mc.importProjectFilesWithDependencies(files,{target:a.target,name:base(a.input),animationResources:true,...dependencyOptions}) :
                mc.importProjectFiles(files,{target:a.target,name:base(a.input),animationResources:true});
        } else {
            res = /^https?:\/\//.test(a.input) || /^[_S][A-Za-z0-9-]{10,}$/.test(a.input) ?
                await mc.importShareLink(a.input,{animationResources:true,...dependencyOptions}) :
                await mc.importArtefact(new Uint8Array(fs.readFileSync(a.input)),{name:path.basename(a.input),animationResources:true,...dependencyOptions});
        }
        for (const e of res.extensions || []) console.error(`  extension: ${e.id} (${e.via}${e.commit ? ` ${e.commit.slice(0, 12)}` : ''}) — ${e.licence || 'unidentified licence'}`);
        for (const e of res.dependencyInputs?.fetchedExtensions || []) console.error(`  dependency: ${e.id} (${e.repo}#${e.ref}) — ${e.licence || 'unidentified licence'}`);
        if (res.lang !== 'pseudocode') {
            console.error(`this is a ${res.project && res.project.target} project in ${res.lang}; only translated projects become .sb3`);
            return 1;
        }
        report(res);
        for (const message of res.dependencyMessages || []) console.error('  dependency: '+message);
        const {default: SB3Creator} = await lib('sb3-creator.js');
        const cr = new SB3Creator();
        cr.parse(res.code);
        // F10: keep the imported files; the first VM load fingerprints the program.
        cr.project.bwMakeCode = makeCodeOriginal.record(res.project.target, res.files, res.project.name);
        if (res.dependencyInputs) cr.project.bwMakeCode.dependencyInputs = res.dependencyInputs;
        for (const c of res.costumes || []) {
            if (c.mode === 'add') cr.addCustomSVGCostume(c.sprite, c.svg, c.name);
            else cr.applyCustomSVG(c.sprite, c.svg);
        }
        const blob = await cr.generateSB3();
        const dest = a.output || `${base(a.input) || 'project'}.sb3`;
        let bytes = new Uint8Array(await blob.arrayBuffer());
        if (res.animationResources?.length || res.dependencyInputs) {
            const {default: ZIP} = await import('jszip');
            const {installAnimationImport} = await lib('bw-animation-import.js');
            const zip = await ZIP.loadAsync(bytes);
            if (res.animationResources?.length) {
                await installAnimationImport(zip, res.animationResources, data => createHash('md5').update(data).digest('hex'));
            }
            if (res.dependencyInputs) zip.file('bw.makecode-dependencies.json', JSON.stringify({version: 1, ...res.dependencyInputs}, null, 2));
            bytes = await zip.generateAsync({type: 'uint8array', compression: 'DEFLATE'});
            const {inspectArtwork} = await lib('bw-artwork-bundle.js');
            const inspection = await inspectArtwork(bytes);
            if (res.animationResources?.length && inspection.outcome !== 'loaded') throw new Error(inspection.reason || 'Invalid animation import');
        }
        fs.writeFileSync(dest, bytes);
        if (a.bw) fs.writeFileSync(a.bw, res.code);
        console.log(`wrote ${dest}${a.bw ? ` and ${a.bw}` : ''} — ${res.project.target} project "${res.project.name}", ` +
            `${(res.unsupported || []).length} not translated`);
        return 0;
    }
    if (a.cmd === 'run') {
        try {
            return await runCommand(a);
        } catch (e) {
            // A --press that names no board, or is given to a one-board program.
            if (!e.usage) throw e;
            console.error(e.message);
            return 2;
        }
    }
    console.error(`unknown command ${a.cmd}\n${USAGE}`);
    return 2;
}

/** The targets `run` has a board model for: nRF51822 + S110 (task A7), and the micro:bit V2 (A8). */
const RUN_TARGETS = ['microbit', 'calliopemini'];

/**
 * `run --board`: v1 (default) is the nRF51822 + S110 model, which takes MakeCode's
 * own firmware (a universal hex's V1 section). v2 is the nRF52833: the program is
 * compiled for the EMULATOR (pxt-node compile {emulator: true}, the CLI twin of
 * compileMakeCodeForEmulator) onto the Bluetooth-free bases, because the official
 * V2 base carries Nordic's SoftDevice, which the emulator never runs (task A8).
 */
const RUN_BOARDS = {v1: {board: 'microbit-v1', name: 'micro:bit V1'}, v2: {board: 'microbit-v2', name: 'micro:bit V2'}};

/** The files of a program to compile for `run`, from a .ts, an .sb3/.bw, or a project-only .hex. */
async function programFiles (a) {
    if (/\.ts$/i.test(a.input)) {
        return {target: a.target, files: {'main.ts': fs.readFileSync(a.input, 'utf8'),
            'pxt.json': JSON.stringify({name: base(a.input), dependencies: DEFAULT_DEPENDENCIES[a.target], files: ['main.ts']})}};
    }
    if (/\.(sb3|bw|txt)$/i.test(a.input)) {
        const out = await toMakeCode(a.input, a.target);
        report(out);
        return {target: a.target, files: out.files};
    }
    const mc = await lib('bw-makecode/index.js');
    const res = await mc.importArtefact(new Uint8Array(fs.readFileSync(a.input)), {name: path.basename(a.input)});
    if (!res.files || !res.files['pxt.json']) throw Object.assign(new Error(`${a.input} carries neither firmware nor a MakeCode project`), {refused: true});
    console.error(`  note: ${path.basename(a.input)} carries the project, not firmware; compiled for ${res.project.target}`);
    return {target: res.project.target, files: res.files};
}

/**
 * `run` for a program with several boards (a `DEVICE <id> AS <Name>:` section
 * each): compile every board for its own target, then run them as separate
 * machines whose radios share one simulated air (lib/makecode-run-boards.mjs).
 */
async function runBoardsCommand (a, project) {
    // --board picks the model for a one-board run; here every board has its own.
    if (a.board) throw Object.assign(new Error('--board is for a program with one board; each board of this program runs on its own model'), {usage: true});
    const many = await import('./lib/makecode-run-boards.mjs');
    const {boardMakeCodeProjects} = await lib('bw-boards/makecode-boards.js');
    const {exportToMakeCode} = await lib('bw-makecode/index.js');
    let subjects;
    try {
        subjects = boardMakeCodeProjects(project, {exportToMakeCode, name: base(a.input).slice(0, 40)});
    } catch (e) {
        if (e.code !== 'NOT_MAKECODE_BOARD') throw e;
        console.error(`refused: ${e.message}`);
        return 1;
    }
    const presses = many.resolvePresses(a.press.map(many.parsePress), subjects.map(s => s.name));
    const {firmwareFile} = await lib('bw-makecode/pxt-runtime.js');
    const boards = [];
    for (const s of subjects) {
        if (!many.BOARD_OF_TARGET[s.target]) {
            console.error(`refused: board "${s.name}" is a ${s.target}; run has a board model for the micro:bit and the Calliope mini`);
            return 1;
        }
        if (!hasRuntime(s.target)) { console.error('the MakeCode runtime is not synced — run `npm run sync:makecode`'); return 3; }
        const r = await compile(s.target, s.files, {native: true});
        if (!r.success) {
            for (const d of r.diagnostics.slice(0, 10)) console.error(`  ${s.name}: ${d.file}:${d.line + 1}: ${d.message}`);
            console.error(`MakeCode did not compile board "${s.name}" (${r.diagnostics.length} error(s))`);
            return 1;
        }
        const firmware = firmwareFile(r.outfiles);
        if (!firmware) { console.error(`MakeCode compiled no firmware file for board "${s.name}"`); return 1; }
        boards.push({name: s.name, target: s.target, hex: new TextDecoder().decode(firmware.bytes)});
    }
    console.error(`  note: ${boards.map(b => `${b.name} (${TARGET_NAME[b.target] || b.target})`).join(' and ')} on one simulated radio air; ` +
        'a Calliope motor is reported as its driver input line switching, not as a turning motor');
    const live = !a.json;
    const stamp = t => `[${t.toFixed(2)} s]`;
    const onEvent = live ? e => {
        if (e.type === 'serial') { if (e.text !== '\0') process.stdout.write(e.text); return; }
        if (e.type === 'press') process.stdout.write(`\n${stamp(e.t)} ${e.board}: button ${e.button === 'button_a' ? 'A' : 'B'} ${e.down ? 'pressed' : 'released'}\n`);
        else if (e.type === 'line') process.stdout.write(`\n${stamp(e.t)} ${e.board}: ${e.line} ${e.switching ? 'is being driven' : 'is still'}\n`);
        else if (e.type === 'matrix') process.stdout.write(`\n${stamp(e.t)} ${e.board}: LED matrix\n${e.rows.map(r => `  ${r}`).join('\n')}\n`);
    } : null;
    let result;
    try {
        result = await many.runBoards({boards, seconds: a.seconds, presses, onEvent});
    } catch (e) {
        if (e.code === 'NO_ENGINE' || e.code === 'NO_BOARDS_MODEL') { console.error(e.message); return 3; }
        throw e;
    }
    if (a.json) {
        process.stdout.write(`${JSON.stringify({guestSeconds: result.guestSeconds, sharedAir: result.sharedAir, presses,
            boards: result.boards.map(b => ({...b, serial: b.serial.replace(/\0/g, '')}))})}\n`);
    } else {
        process.stdout.write(`\n— ran ${result.guestSeconds.toFixed(2)} s of guest time on ${result.boards.length} boards\n`);
    }
    let code = 0;
    for (const b of result.boards) {
        if (b.fault) { console.error(`fault on ${b.name}: ${b.fault.cause}${b.fault.message ? ` — ${b.fault.message}` : ''}`); code = 1; }
    }
    return code;
}

async function runCommand (a) {
    if (/\.(sb3|bw|txt)$/i.test(a.input)) {
        const {project} = await readProject(a.input);
        const {readBoards} = await lib('bw-boards/model.js');
        if (readBoards(project)) return runBoardsCommand(a, project);
    }
    const run = await import('./lib/makecode-run.mjs');
    if (a.press.length) throw Object.assign(new Error('--press is for a program with several boards'), {usage: true});
    const rb = RUN_BOARDS[a.board || 'v1'];
    const v2 = rb.board === 'microbit-v2';
    let hex = /\.hex$/i.test(a.input) ? fs.readFileSync(a.input, 'utf8') : null;
    let target = a.target;
    if (!hex || !run.hasFirmware(hex)) {
        let program;
        try {
            program = await programFiles(a);
        } catch (e) {
            if (!e.refused) throw e;
            console.error(`refused: ${e.message}`);
            return 1;
        }
        target = program.target;
        if (!RUN_TARGETS.includes(target)) {
            console.error(`refused: run has a board model for the micro:bit and the Calliope mini, not ${target}`);
            return 1;
        }
        if (!hasRuntime(target)) { console.error('the MakeCode runtime is not synced — run `npm run sync:makecode`'); return 3; }
        if (v2 && target !== 'microbit') {
            console.error(`refused: --board v2 is the micro:bit V2; this ${target} program runs on --board v1`);
            return 1;
        }
        let r;
        try {
            r = await compile(target, program.files, v2 ? {emulator: true} : {native: true});
        } catch (e) {
            if (e.code === 'BASE_REFUSED') {
                console.error(`refused: firmware base ${e.baseSha256} is not a clean emulator base — the emulator runs only ` +
                    'the Bluetooth-free bases (base-licences.js)');
                return 1;
            }
            throw e;
        }
        if (!r.success) {
            for (const d of r.diagnostics.slice(0, 10)) console.error(`  ${d.file}:${d.line + 1}: ${d.message}`);
            console.error(`MakeCode did not compile the program (${r.diagnostics.length} error(s))`);
            return 1;
        }
        const {firmwareFile} = await lib('bw-makecode/pxt-runtime.js');
        const firmware = firmwareFile(r.outfiles);
        if (!firmware) {
            console.error(v2 ? 'MakeCode compiled no firmware file — for the V2 board the Bluetooth-free emulator bases must be ' +
                'synced (`npm run sync:makecode` fetches them)' : 'MakeCode compiled no firmware file');
            return 1;
        }
        hex = new TextDecoder().decode(firmware.bytes);
    } else if (!RUN_TARGETS.includes(target)) {
        console.error(`refused: run has a board model for the micro:bit and the Calliope mini, not ${target}`);
        return 1;
    }
    if (target === 'calliopemini') {
        console.error('  note: a Calliope mini runs on the micro:bit V1 board model (the same nRF51822 + S110): ' +
            'serial and the 5x5 matrix; its RGB LED, motor driver and own pins are not modelled');
    }
    const live = !a.json;
    let result;
    try {
        result = await run.runNrf51({hex, seconds: a.seconds, board: rb.board,
            onSerial: live ? c => { if (c !== '\0') process.stdout.write(c); } : null,
            onMatrix: live ? f => process.stdout.write(`\n[${f.t.toFixed(2)} s] LED matrix\n${f.rows.map(r => `  ${r}`).join('\n')}\n`) : null});
    } catch (e) {
        if (e.code === 'NO_ENGINE') { console.error(e.message); return 3; }
        if (/universal micro:bit hex|no vector table at 0/.test(e.message)) { console.error(`refused: ${e.message}`); return 1; }
        throw e;
    }
    if (a.json) {
        process.stdout.write(`${JSON.stringify({target, board: rb.board, universal: result.universal,
            guestSeconds: result.guestSeconds, serial: result.serial.replace(/\0/g, ''),
            frames: result.frames, fault: result.fault})}\n`);
    } else {
        process.stdout.write(`\n— ran ${result.guestSeconds.toFixed(2)} s of guest time on the ${rb.name} board model\n`);
    }
    if (result.fault) { console.error(`fault: ${result.fault.cause}${result.fault.message ? ` — ${result.fault.message}` : ''}`); return 1; }
    return 0;
}

main().then(code => process.exit(code), e => {
    if (e?.code === 'crispbasic-runtime-required' || e?.code === 'crispbasic-source-version') {
        console.error(`refused: ${e.message}`);
        process.exit(1);
    }
    for (const refusal of e?.refused || []) console.error(`  dependency refused: ${refusal.id} (${refusal.spec}) — ${refusal.reason}`);
    console.error(e && e.stack || e);
    process.exit(e && e.code === 'NO_RUNTIME' ? 3 : 1);
});
