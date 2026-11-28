#!/usr/bin/env node
import {withVmPackageExports} from './lib/vm-package-exports.mjs';
import {patchPrimitiveOwner} from './lib/primitive-owner-hooks.mjs';
import {patchProcedureConstraints} from './lib/procedure-constraint-hooks.mjs';
import {patchArcadeExceptions} from './lib/arcade-exception-hooks.mjs';
import engineActivationHooks from './lib/engine-activation-hooks.cjs';
const {patchThreadActivations,patchExecuteActivations,stripThreadActivations,stripExecuteActivations,patchSequencerActivations}=engineActivationHooks;
// Lay our owned scratch-vm delta (built-in extensions + their registration in the builtinExtensions
// map) over the installed node_modules/scratch-vm. Run AFTER `npm install`, BEFORE `npm run build`.
//
// Why post-install instead of a file:../scratch-vm package: a file: symlink makes npm skip
// installing scratch-vm's own transitive deps (format-message, etc.), so the from-source build
// can't resolve them. Keeping scratch-vm as a normal pinned NPM dep gets all deps hoisted into
// scratch-gui/node_modules; we then overlay our src changes in place. overlay/scratch-vm/ is the
// editable source of truth — edit there and rebuild.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import {patchArcadeSettingsSB3} from './lib/arcade-settings-sb3-hooks.mjs';
import {patchArcadeManagedThread} from './lib/arcade-managed-thread-hooks.mjs';
import {patchSavedProjectDeviceReset} from './lib/saved-project-device-vm-hooks.mjs';
import {patchExtensionPrimitiveCaches} from './lib/extension-primitive-cache-hooks.mjs';
import {patchNestedExecuteContext} from './lib/nested-execute-context-hooks.mjs';
import {patchPaletteStructure} from './lib/palette-hooks.mjs';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'overlay', 'scratch-vm');
const DEST = path.join(ROOT, 'packages', 'scratch-gui', 'node_modules', 'scratch-vm');
const vmOnly = process.argv.includes('--vm-only');

if (!existsSync(DEST)) {
    console.error(`node_modules/scratch-vm missing at ${DEST} — run npm install first.`);
    process.exit(1);
}
cpSync(SRC, DEST, { recursive: true });
console.log('  applied scratch-vm overlay onto node_modules/scratch-vm (built-in extensions)');

// GUI and native constraints must resolve the SAME installed source module.
// Upstream exports only its conditional root. Preserve that root verbatim and
// expose this one owned utility through the package's normal exports map.
const vmPackagePath=path.join(DEST,'package.json');
writeFileSync(vmPackagePath,JSON.stringify(withVmPackageExports(
    JSON.parse(readFileSync(vmPackagePath,'utf8'))),null,2)+'\n');
console.log('  exposed the canonical shared procedure model in scratch-vm package exports');

// Upstream one-line bugfix (too small to justify carrying the whole 3000-line runtime.js as an
// overlay): the base VM builds the extension palette category as `<category name="${name}" ...>`
// with the RAW extension name. Any extension whose name contains & < > " (e.g. "Arrays & Tensors")
// produces not-well-formed toolbox XML, so scratch-blocks fails to build the category and the
// extension's blocks never appear. `xmlEscape` is already imported in runtime.js — wrap the name.
const runtimePath = path.join(DEST, 'src', 'engine', 'runtime.js');
// Read-only construction origins for optional source-result evidence. No
// extension can register a replacement table or renew an origin certificate.
function patchExtensionResultOrigins(source) {
    const marker = '// bw-source-result-native-origins-v1';
    if (source.includes(marker)) {
        for (const token of ['const bwResultPrimitiveTable = {};', 'const bwResultCategoryList = [];',
            'const bwResultBlocks = [];', 'const bwResultCategoryOrigin =', "'sourceResultOrigins'"])
            if (!source.includes(token)) throw new Error('runtime source-result origin patch is incomplete');
        return source;
    }
    const replaceOnce = (before, after) => {
        if (source.split(before).length !== 2) throw new Error('runtime source-result origin anchor differs: ' + before);
        source = source.replace(before, after);
    };
    replaceOnce('class Runtime extends EventEmitter {', `${marker}
const bwResultRuntimeOrigins = new WeakMap();
const bwResultCategoryOrigins = new WeakMap();
const bwResultOriginGet = WeakMap.prototype.get, bwResultOriginSet = WeakMap.prototype.set;
const bwResultOriginApply = Reflect.apply, bwResultOriginFreeze = Object.freeze, bwResultOriginDefine = Object.defineProperty;
class Runtime extends EventEmitter {`);
    replaceOnce('        this._primitives = {};', '        const bwResultPrimitiveTable = {};\n        this._primitives = bwResultPrimitiveTable;');
    replaceOnce('        this._blockInfo = [];', `        const bwResultCategoryList = [];
        this._blockInfo = bwResultCategoryList;
        bwResultOriginApply(bwResultOriginSet, bwResultRuntimeOrigins, [this,
            bwResultOriginFreeze({table: bwResultPrimitiveTable, categories: bwResultCategoryList})]);`);
    replaceOnce('        this._blockInfo.push(categoryInfo);', `        bwResultOriginApply(bwResultOriginSet, bwResultCategoryOrigins, [categoryInfo,
            bwResultOriginFreeze({runtime: this, blocks: null})]);
        this._blockInfo.push(categoryInfo);`);
    replaceOnce('        categoryInfo.blocks = [];', `        const bwResultBlocks = [];
        const bwResultCategoryOrigin = bwResultOriginApply(bwResultOriginGet, bwResultCategoryOrigins, [categoryInfo]);
        if (bwResultCategoryOrigin && bwResultCategoryOrigin.runtime === this)
            bwResultOriginApply(bwResultOriginSet, bwResultCategoryOrigins, [categoryInfo,
                bwResultOriginFreeze({runtime: this, blocks: bwResultBlocks})]);
        categoryInfo.blocks = bwResultBlocks;`);
    replaceOnce('module.exports = Runtime;', `bwResultOriginDefine(Runtime, 'sourceResultOrigins', {value: (runtime, category) => {
    const origin = bwResultOriginApply(bwResultOriginGet, bwResultRuntimeOrigins, [runtime]);
    if (!origin) return null;
    if (category === undefined) return origin;
    const row = bwResultOriginApply(bwResultOriginGet, bwResultCategoryOrigins, [category]);
    return row && row.runtime === runtime ? row : null;
}, writable: false, configurable: false});
module.exports = Runtime;`);
    return source;
}
let rt = readFileSync(runtimePath, 'utf8');
rt = patchExtensionResultOrigins(rt);
rt = patchExtensionPrimitiveCaches(rt);
rt = patchPaletteStructure(rt);
writeFileSync(runtimePath, rt);
// Arcade sprites need one deterministic physics tick per Scratch VM frame.
// Extensions subscribe to this event; the project stores ordinary extension
// blocks in .sb3 and the event only supplies their runtime clock.
const arcadeFrameAnchor = '    _step () {\n';
const arcadeFrameLegacy = arcadeFrameAnchor + "        this.emit('ARCADE_FRAME');\n";
const arcadeFramePatched = `    _step (arcadeDeltaMs) {
        this.updateCurrentMSecs();
        const arcadeNow = this.currentMSecs;
        const arcadeElapsed = Number.isFinite(arcadeDeltaMs) && arcadeDeltaMs >= 0 ? arcadeDeltaMs :
            (this._arcadeFrameTime === undefined ? 0 : Math.max(0, arcadeNow - this._arcadeFrameTime));
        this._arcadeFrameTime = arcadeNow;
        this.emit('ARCADE_FRAME', arcadeElapsed);
`;
const arcadePhaseKernel = arcadeFramePatched.replace('    _step (arcadeDeltaMs)',
    '    _stepArcadeKernel (arcadeDeltaMs)');
if (!rt.includes(arcadeFramePatched) && !rt.includes(arcadePhaseKernel)) {
    const anchor = rt.includes(arcadeFrameLegacy) ? arcadeFrameLegacy : arcadeFrameAnchor;
    if (!rt.includes(anchor)) throw new Error('runtime.js Arcade frame anchor not found');
    rt = rt.replace(anchor, arcadeFramePatched);
    writeFileSync(runtimePath, rt);
    console.log('  patched runtime.js (elapsed Arcade frame clock)');
}
// Delegate only projects with explicit source entry/loops or native callback
// hats. Other projects retain the original synchronous sequencer entry.
// The frame-phase class (~26 KiB) is NOT required here: runtime.js is in the first load and
// P17 caps it. The lazy Arcade extension passes the class in when it attaches.
const arcadePhaseImport = "const ArcadeFramePhase = require('../extensions/crispstrobe/arcade/frame-phase');\n";
if (rt.includes(arcadePhaseImport)) rt = rt.replace(arcadePhaseImport, '');
const arcadePhaseOldEntry = `    _attachArcadeFramePhase (extension) {
        if (this._arcadeFramePhase?.ext === extension) return;
        this._arcadeFramePhase?.detach();
        this._arcadeFramePhase = new ArcadeFramePhase(this, extension);
    }
`;
const arcadePhaseNewEntry = `    _attachArcadeFramePhase (extension, ArcadeFramePhase) {
        if (this._arcadeFramePhase?.ext === extension) return;
        this._arcadeFramePhase?.detach();
        this._arcadeFramePhase = new ArcadeFramePhase(this, extension);
    }
`;
if (rt.includes(arcadePhaseOldEntry)) rt = rt.replace(arcadePhaseOldEntry, arcadePhaseNewEntry);
const arcadePhaseEntry = `${arcadePhaseNewEntry}
    _step (arcadeDeltaMs) {
        const phase = this._arcadeFramePhase;
        if (phase?.hasSourceProject()) return phase.requestStep(arcadeDeltaMs);
        return this._stepArcadeKernel(arcadeDeltaMs);
    }

`;
if (!rt.includes(arcadePhaseKernel)) {
    if (!rt.includes(arcadeFramePatched)) throw new Error('runtime.js Arcade phase entry anchor not found');
    rt = rt.replace(arcadeFramePatched, arcadePhaseEntry + arcadePhaseKernel);
}
writeFileSync(runtimePath, rt);
for (const anchor of ['        this.emit(Runtime.PROJECT_START);', '        this.currentStepTime = interval;']) {
    const patched = '        this._arcadeFrameTime = undefined;\n' + anchor;
    if (!rt.includes(patched)) {
        if (!rt.includes(anchor)) throw new Error('runtime.js Arcade clock reset anchor not found');
        rt = rt.replace(anchor, patched);
        writeFileSync(runtimePath, rt);
    }
}
// Resume Arcade callbacks completed by this tick before the next physics tick.
// Resolving only at ARCADE_FRAME start adds an unintended frame of motion.
const arcadeDoneAnchor = '        const doneThreads = this.sequencer.stepThreads();';
const arcadeDonePatched = arcadeDoneAnchor + "\n        this.emit('ARCADE_FRAME_END');";
if (!rt.includes(arcadeDonePatched)) {
    if (!rt.includes(arcadeDoneAnchor)) throw new Error('runtime.js Arcade frame-end anchor not found');
    rt = rt.replace(arcadeDoneAnchor, arcadeDonePatched);
    writeFileSync(runtimePath, rt);
    console.log('  patched runtime.js (Arcade callback completion)');
}
const anchor = '<category name="${name}" id="${';
if (rt.includes(anchor)) {
    rt = rt.replace(anchor, '<category name="${xmlEscape(name)}" id="${');
    writeFileSync(runtimePath, rt);
    console.log('  patched runtime.js (xmlEscape extension category name)');
} else if (rt.includes('<category name="${xmlEscape(name)}"')) {
    console.log('  runtime.js category-name escape already applied');
} else {
    console.error('  ! runtime.js category-name anchor not found — base VM version changed?');
    process.exit(1);
}

// Preserve real keyboard transitions for Arcade's event bus, including taps
// shorter than a VM frame. Scratch's KEY_PRESSED event retains its original
// repeated-keydown behavior; this additional event emits only after a change.
const keyboardPath = path.join(DEST, 'src', 'io', 'keyboard.js');
let keyboardSource = readFileSync(keyboardPath, 'utf8');
for (const [anchor, event] of [
    ['                this._keysPressed.push(scratchKey);',
        "                this.runtime.emit('KEY_STATE_CHANGED', scratchKey, true);"],
    ['            this._keysPressed.splice(index, 1);',
        "            this.runtime.emit('KEY_STATE_CHANGED', scratchKey, false);"]
]) {
    if (!keyboardSource.includes(event)) {
        if (!keyboardSource.includes(anchor)) throw new Error('keyboard.js state transition anchor missing');
        keyboardSource = keyboardSource.replace(anchor, anchor + '\n' + event);
    }
}
writeFileSync(keyboardPath, keyboardSource);

// Null is a valid reporter result. Upstream uses null for "no pending
// report", which otherwise repeats an asynchronous call returning null.
// Track promise completion separately from its payload on the owning frame.
const executePath = path.join(DEST, 'src', 'engine', 'execute.js');
let executeSource = stripExecuteActivations(readFileSync(executePath, 'utf8'));
executeSource = patchNestedExecuteContext(executeSource);
writeFileSync(executePath, executeSource);
executeSource = patchPrimitiveOwner(executeSource);
writeFileSync(executePath, executeSource);
if (!executeSource.includes('bwPromiseReported')) {
    const patches = [
        ['    primitiveReportedValue.then(resolvedValue => {',
            '    const promiseFrame = thread.peekStackFrame();\n    primitiveReportedValue.then(resolvedValue => {\n        promiseFrame.bwPromiseReported = true;'],
        ['if (thread.justReported !== null && ops[i] && ops[i].id === currentStackFrame.reporting)',
            'if ((currentStackFrame.bwPromiseReported || thread.justReported !== null) && ops[i] && ops[i].id === currentStackFrame.reporting)'],
        ['            const inputValue = thread.justReported;\n\n            thread.justReported = null;',
            '            const inputValue = thread.justReported;\n\n            currentStackFrame.bwPromiseReported = false;\n            thread.justReported = null;']
    ];
    for (const [before, after] of patches) {
        if (!executeSource.includes(before)) throw new Error('execute.js promise completion anchor missing');
        executeSource = executeSource.replace(before, after);
    }
    writeFileSync(executePath, executeSource);
    console.log('  patched execute.js (null promise reporter results)');
}

executeSource = patchArcadeExceptions(executeSource);
executeSource = patchExecuteActivations(executeSource);
writeFileSync(executePath, executeSource);

// Empty authored branches must complete before the sequencer releases them.
const structuredSequencerPath=path.join(DEST,'src','engine','sequencer.js');
writeFileSync(structuredSequencerPath,patchSequencerActivations(readFileSync(structuredSequencerPath,'utf8')));

// Validate the actual ordinary-procedure call before installing its body frame.
const procedurePath = path.join(DEST, 'src', 'blocks', 'scratch3_procedures.js');
writeFileSync(procedurePath, patchProcedureConstraints(readFileSync(procedurePath, 'utf8')));

// Managed Arcade functions retain argument cells in a non-executable root.
// Ordinary Scratch procedures can be called from those functions; recursion
// checks must retain both managed ancestry and real Scratch call frames.
const managedThreadPath = path.join(DEST, 'src', 'engine', 'thread.js');
writeFileSync(managedThreadPath,patchThreadActivations(patchArcadeManagedThread(
    stripThreadActivations(readFileSync(managedThreadPath,'utf8')))));

// Per-device palettes: _refreshExtensionPrimitives must propagate color changes.
// Upstream only updates `name` on refresh; our stc12 extension changes color1/color2
// when the device family changes (8051 vs AVR vs Pico).
const refreshAnchor = `        if (categoryInfo) {
            categoryInfo.name = maybeFormatMessage(extensionInfo.name);
            this._fillExtensionCategory(categoryInfo, extensionInfo);`;
const refreshPatched = `        if (categoryInfo) {
            categoryInfo.name = maybeFormatMessage(extensionInfo.name);
            // Brickwright: propagate color changes on refresh (per-device palettes).
            if (extensionInfo.color1) {
                categoryInfo.color1 = extensionInfo.color1;
                categoryInfo.color2 = extensionInfo.color2;
                categoryInfo.color3 = extensionInfo.color3;
            }
            this._fillExtensionCategory(categoryInfo, extensionInfo);`;
if (rt.includes('// Brickwright: propagate color changes')) {
    console.log('  runtime.js refresh-color patch already applied');
} else if (rt.includes(refreshAnchor)) {
    rt = rt.replace(refreshAnchor, refreshPatched);
    writeFileSync(runtimePath, rt);
    console.log('  patched runtime.js (refresh extension colors)');
} else {
    console.error('  ! runtime.js refresh-color anchor not found — base VM version changed?');
    process.exit(1);
}

// A2 8x8 brightness matrix: add a `led8x8` argument type that plugs the
// FieldLed8x8 grid (registered in the GUI at lazy-scratch-blocks load) into a
// command block via a `led8x8` shadow — the exact parallel of the built-in
// MATRIX -> `matrix` shadow micro:bit uses. One map entry, too small to carry
// the whole runtime.js as an overlay, so patched like the fixes above.
const led8x8Anchor = `    map[ArgumentType.MATRIX] = {
        shadow: {
            type: 'matrix',
            fieldName: 'MATRIX'
        }
    };`;
const led8x8Patched = led8x8Anchor + `
    // Brickwright: the A2 8x8 brightness grid (FieldLed8x8).
    map['led8x8'] = {
        shadow: {
            type: 'led8x8',
            fieldName: 'MATRIX'
        }
    };`;
if (rt.includes("map['led8x8']")) {
    console.log('  runtime.js led8x8 argument-type patch already applied');
} else if (rt.includes(led8x8Anchor)) {
    rt = rt.replace(led8x8Anchor, led8x8Patched);
    writeFileSync(runtimePath, rt);
    console.log('  patched runtime.js (led8x8 argument type)');
} else {
    console.error('  ! runtime.js MATRIX argument-type anchor not found — base VM version changed?');
    process.exit(1);
}

// Brickwright UI improvement (parity with the Scratch Foundation / Xcratch
// editor): accept full-width (double-byte) digits and signs as numbers, so
// "１２３" typed in a number field is used as 123. One-line change to
// Cast.toNumber — too small to vendor the whole cast.js as an overlay.
// Full-width ０-９ ＋ － ． all map to ASCII by subtracting 0xFEE0.
const castPath = path.join(DEST, 'src', 'util', 'cast.js');
let cast = readFileSync(castPath, 'utf8');
const castAnchor = '        const n = Number(value);';
const castPatched = '        // Brickwright: accept full-width (double-byte) digits/signs.\n' +
    '        const nv = (typeof value === \'string\') ?\n' +
    '            value.replace(/[\\uFF10-\\uFF19\\uFF0B\\uFF0D\\uFF0E]/g, ch =>\n' +
    '                String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)) : value;\n' +
    '        const n = Number(nv);';
if (cast.includes('// Brickwright: accept full-width')) {
    console.log('  cast.js full-width number patch already applied');
} else if (cast.includes(castAnchor)) {
    cast = cast.replace(castAnchor, castPatched);
    writeFileSync(castPath, cast);
    console.log('  patched cast.js (full-width numbers)');
} else {
    console.error('  ! cast.js toNumber anchor not found — base VM version changed?');
    process.exit(1);
}

// Slice 3: stc persistence — round-trip the top-level `stc` key through save/load.
//
// The sb3 serializer emits targets/monitors/extensions/meta and drops everything else.
// sb3-creator writes `stc: { device, clock, pins }` into the project, but it vanishes on
// save from the editor. This patches both directions:
//   serialize:   writes `stc` when runtime.stc is set
//   deserialize: restores runtime.stc from the saved stc key
//
// Interop caveat (written as a comment in the patched code): a .sb3 with a top-level `stc`
// key stays loadable everywhere (tools ignore unknown keys), but a round trip through
// vanilla Scratch or TurboWarp strips it. Acceptable: a project whose hardware blocks are
// an unknown extension there cannot run anyway.

const sb3Path = path.join(DEST, 'src', 'serialization', 'sb3.js');
let sb3 = readFileSync(sb3Path, 'utf8');

// --- serialize: add stc after meta ---
const serAnchor = '    obj.meta = meta;\n    return obj;';
const serPatched = `    obj.meta = meta;
    // Brickwright: persist hardware declarations so they survive save/reload.
    // Versioned so a future pin-table shape change is detectable.
    // Interop: unknown top-level keys are ignored by all Scratch tools, so a .sb3
    // with \`stc\` opens everywhere — but a round trip through vanilla Scratch or
    // TurboWarp strips it, since those rewrite from what they understood. That is
    // acceptable: the hardware blocks are unknown extensions there.
    if (runtime.stc) {
        obj.stc = Object.assign({version: 1}, runtime.stc);
    }
    return obj;`;
if (sb3.includes('// Brickwright: persist hardware declarations')) {
    console.log('  sb3.js serialize stc patch already applied');
} else if (sb3.includes(serAnchor)) {
    sb3 = sb3.replace(serAnchor, serPatched);
    console.log('  patched sb3.js (serialize stc)');
} else {
    console.error('  ! sb3.js serialize anchor not found — base VM version changed?');
    process.exit(1);
}

// --- deserialize: restore stc from project JSON ---
const desAnchor = `        .then(targets => ({
            targets,
            extensions
        }));`;
const desPatched = `        .then(targets => {
            // Brickwright: restore hardware declarations from the saved project.
            if (json.stc && json.stc.version === 1) {
                runtime.stc = json.stc;
            }
            return {targets, extensions};
        });`;
if (sb3.includes('// Brickwright: restore hardware declarations')) {
    console.log('  sb3.js deserialize stc patch already applied');
} else if (sb3.includes(desAnchor)) {
    sb3 = sb3.replace(desAnchor, desPatched);
    console.log('  patched sb3.js (deserialize stc)');
} else {
    console.error('  ! sb3.js deserialize anchor not found — base VM version changed?');
    process.exit(1);
}

// E3b: variable and list values stock sb3 cannot write (BWValues UNDEFINED and
// references, NaN/±Infinity/-0, null, other objects). Stock writes them as JSON
// objects, null or 0 — a project scratch-parser refuses, or a silently changed
// number. The rules live in the overlay module serialization/bw-sb3-values.js;
// these three hooks call it: require it, `save` after serializeVariables in
// serializeTarget (project save AND sprite export), `restore` after the lists
// are read in parseScratchObject (project load AND sprite import).
const bwSb3Hooks = [
    ['require', `const log = require('../util/log');\n`,
        `const log = require('../util/log');\n// Brickwright E3b: save/load values stock sb3 cannot write (bw-sb3-values.js).\nconst bwSb3Values = require('./bw-sb3-values');\n`,
        `const bwSb3Values = require('./bw-sb3-values');`],
    ['save', `    obj.broadcasts = vars.broadcasts;\n`,
        `    obj.broadcasts = vars.broadcasts;\n    // Brickwright E3b: schema-valid fields + the exact values in obj.bwValues.\n    bwSb3Values.save(target.variables, obj);\n`,
        `bwSb3Values.save(target.variables, obj);`],
    ['restore', `    if (Object.prototype.hasOwnProperty.call(object, 'broadcasts')) {\n`,
        `    // Brickwright E3b: restore the exact values recorded in object.bwValues.\n    bwSb3Values.restore(object, target.variables);\n    if (Object.prototype.hasOwnProperty.call(object, 'broadcasts')) {\n`,
        `bwSb3Values.restore(object, target.variables);`]
];
for (const [name, anchor, patch, marker] of bwSb3Hooks) {
    if (sb3.includes(marker)) {
        console.log(`  sb3.js E3b ${name} hook already applied`);
    } else if (sb3.split(anchor).length === 2) {
        sb3 = sb3.replace(anchor, patch);
        console.log(`  patched sb3.js (E3b ${name} hook)`);
    } else {
        console.error(`  ! sb3.js E3b ${name} anchor not found exactly once — base VM version changed?`);
        process.exit(1);
    }
}

// Arcade program records travel with project saves without becoming ordinary
// learner variables. Keep each idempotent hook separate from exact-value tags.
sb3 = patchArcadeSettingsSB3(sb3);

writeFileSync(sb3Path, sb3);

// --- vm.setStc() + pre-load extensions: two patches on virtual-machine.js ---
const vmPath2 = path.join(DEST, 'src', 'virtual-machine.js');
let vm2 = readFileSync(vmPath2, 'utf8');

// Pre-load declared extensions before deserialization.
// sb3.js builds extensionIDs from block opcodes DURING deserialization, but
// drops blocks whose extension prefix is unknown. Fix: load declared
// extensions before the deserializer runs — and WAIT for them. Since
// 2026-09-05 (ROADMAP §2.4) the music and LEGO builtins are import()ed
// chunks, so loadExtensionURL for them resolves later, not synchronously:
// fire-and-forget left them "not loaded" when the extensionURLs strip below
// ran, and installTargets then fetched the same extension a second time from
// its gallery URL into a sandboxed worker. The method is split at the anchor:
// deserializeProject clears, pre-loads and awaits; _bwDeserializeCleared
// strips the URLs and continues into the upstream body.
const deserAnchor = `    deserializeProject (projectJSON, zip) {
        // Clear the current runtime
        this.clear();`;
const deserPatch = `    deserializeProject (projectJSON, zip) {
        // Clear the current runtime
        this.clear();

        // Brickwright: pre-load declared extensions so their blocks survive
        // deserialization. Without this, sb3.js drops blocks whose extension
        // prefix is unknown, and the extension is never requested — circular.
        // AWAITED: lazy builtins (music, the LEGO family) arrive as chunks, and
        // the URL strip below must see them registered. A load that fails is
        // not fatal here — installTargets reports it the way it always did.
        // E5: the URL a file records beside an id (extensionURLs, as TurboWarp and
        // Lite save it) is honoured only when it names the pinned gallery copy of
        // that id; anything else is refused by name and never fetched
        // (ExtensionManager.loadProjectExtension).
        this.extensionManager.beginProjectExtensions();
        const declaredURLs = projectJSON.extensionURLs && typeof projectJSON.extensionURLs === 'object' ?
            projectJSON.extensionURLs : {};
        const preloads = [];
        if (projectJSON.extensions && Array.isArray(projectJSON.extensions)) {
            for (const id of projectJSON.extensions) {
                if (!this.extensionManager.isExtensionLoaded(id)) {
                    const url = Object.prototype.hasOwnProperty.call(declaredURLs, id) ? declaredURLs[id] : null;
                    preloads.push(Promise.resolve(this.extensionManager.loadProjectExtension(id, url))
                        .catch(e => log.warn('Extension "' + id + '" did not load: ' + ((e && e.message) || e))));
                }
            }
        }
        if (preloads.length) {
            return Promise.all(preloads).then(() => this._bwDeserializeCleared(projectJSON, zip));
        }
        return this._bwDeserializeCleared(projectJSON, zip);
    }

    /**
     * Brickwright: the rest of deserializeProject, entered once every declared
     * extension is registered. The upstream body follows.
     * @param {object} projectJSON - the parsed project
     * @param {?JSZip} zip - optional zipped project containing assets
     * @returns {Promise} resolves after the project has loaded
     */
    _bwDeserializeCleared (projectJSON, zip) {
        // Brickwright: ids that just loaded as BUILTINS must not load a second
        // time from extensionURLs — the sb3 carries gallery URLs so the file
        // stays openable in stock TurboWarp, but here a URL load spawns a
        // SANDBOXED extension worker: importScripts noise at best, a slower
        // duplicate registration at worst (the duplicate block-definition
        // warnings, 2026-08-10). An id with no URL entry used to fall through
        // to the sandbox too, with the bare id as the URL ('bitops' 404).
        if (projectJSON.extensionURLs) {
            for (const id of Object.keys(projectJSON.extensionURLs)) {
                if (this.extensionManager.isExtensionLoaded(id)) {
                    delete projectJSON.extensionURLs[id];
                }
            }
        }`;
const preloadBlock = `        if (projectJSON.extensions && Array.isArray(projectJSON.extensions)) {
            for (const id of projectJSON.extensions) {
                if (!this.extensionManager.isExtensionLoaded(id)) {
                    this.extensionManager.loadExtensionURL(id);
                }
            }
        }`;
const stripBlock = deserPatch.slice(deserPatch.indexOf('\n        // Brickwright: ids that just loaded as BUILTINS'));
// The fire-and-forget shape this patch used until 2026-09-05: everything from
// the anchor through the end of the URL strip. Rebuilt here so an installed
// tree carrying it can be moved to the awaited shape in place.
const oldDeserPatch = deserAnchor + '\n' + preloadBlock.replace(
    `        if (projectJSON.extensions`,
    `
        // Brickwright: pre-load declared extensions so their blocks survive
        // deserialization. Without this, sb3.js drops blocks whose extension
        // prefix is unknown, and the extension is never requested — circular.
        if (projectJSON.extensions`) + stripBlock;
// The awaited shape before E5 (2026-10-06): preloads by bare id only. Moved to
// the current shape in place, so an installed tree does not keep reading ids
// while the manager expects project URLs to pass through loadProjectExtension.
const e5Preload = deserPatch.slice(deserPatch.indexOf('        // E5: the URL a file records'),
    deserPatch.indexOf('        if (preloads.length) {'));
const e3Preload = `        const preloads = [];
        if (projectJSON.extensions && Array.isArray(projectJSON.extensions)) {
            for (const id of projectJSON.extensions) {
                if (!this.extensionManager.isExtensionLoaded(id)) {
                    preloads.push(Promise.resolve(this.extensionManager.loadExtensionURL(id)).catch(() => {}));
                }
            }
        }
`;
const e3DeserPatch = deserPatch.replace(e5Preload, e3Preload);
if (vm2.includes(deserPatch)) {
    console.log('  virtual-machine.js awaited pre-load + URL-strip already applied');
} else if (vm2.includes(e3DeserPatch)) {
    vm2 = vm2.replace(e3DeserPatch, deserPatch);
    writeFileSync(vmPath2, vm2);
    console.log('  patched virtual-machine.js (pre-load honours pinned project extension URLs)');
} else if (vm2.includes('_bwDeserializeCleared (projectJSON, zip) {')) {
    console.error('  ! virtual-machine.js carries an unrecognised awaited deserializeProject patch — reinstall scratch-vm');
    process.exit(1);
} else if (vm2.includes(oldDeserPatch)) {
    vm2 = vm2.replace(oldDeserPatch, deserPatch);
    writeFileSync(vmPath2, vm2);
    console.log('  patched virtual-machine.js (pre-load is now awaited before the URL strip)');
} else if (vm2.includes('// Brickwright: ids that just loaded as BUILTINS')) {
    console.error('  ! virtual-machine.js carries an unrecognised Brickwright deserializeProject patch — reinstall scratch-vm');
    process.exit(1);
} else if (vm2.includes(preloadBlock)) {
    // The 2026-08 preload-only shape. It must NOT fall through to the anchor
    // replace below: the anchor is a SUBSTRING of that text, so replacing it
    // would emit a second preload. Too old to migrate in place; reinstall.
    console.error('  ! virtual-machine.js carries the pre-strip deserializeProject patch — reinstall scratch-vm (npm install) and re-run');
    process.exit(1);
} else if (vm2.includes(deserAnchor)) {
    vm2 = vm2.replace(deserAnchor, deserPatch);
    writeFileSync(vmPath2, vm2);
    console.log('  patched virtual-machine.js (pre-load declared extensions + URL strip)');
} else {
    console.error('  ! virtual-machine.js deserializeProject anchor not found');
    process.exit(1);
}
writeFileSync(vmPath2, patchSavedProjectDeviceReset(readFileSync(vmPath2, 'utf8')));
vm2 = readFileSync(vmPath2, 'utf8');
const vmSetStcAnchor = '    installTargets (targets, extensions, wholeProject) {';
const vmSetStcPatch = `    /**
     * Set hardware declarations (device, clock, pin table). The single entry point
     * for the importer, the deserializer, and the Circuit tab's onDeclarationChange.
     * @param {object|null} stc - { version: 1, device, clock, pins: [...] } or null
     */
    setStc (stc) {
        this.runtime.stc = stc;
        this.emit('stcChanged', stc);
    }

    installTargets (targets, extensions, wholeProject) {`;
if (vm2.includes('setStc (stc)')) {
    console.log('  virtual-machine.js setStc already applied');
} else if (vm2.includes(vmSetStcAnchor)) {
    vm2 = vm2.replace(vmSetStcAnchor, vmSetStcPatch);
    writeFileSync(vmPath2, vm2);
    console.log('  patched virtual-machine.js (setStc)');
} else {
    console.error('  ! virtual-machine.js setStc anchor not found');
    process.exit(1);
}

// E5: a saved project records the pinned gallery URL of each gallery extension
// it uses (extensionURLs, as TurboWarp writes it). The rules live in the overlay
// module serialization/bw-gallery-urls.js; this hook calls it from toJSON, which
// saveProjectSb3 and every in-app project read go through. A sprite has no
// `extensions` list and passes through unchanged.
vm2 = readFileSync(vmPath2, 'utf8');
const vmToJSONAnchor = `        const sb3 = require('./serialization/sb3');
        return StringUtil.stringify(sb3.serialize(this.runtime, optTargetId));`;
const vmToJSONPatch = `        const sb3 = require('./serialization/sb3');
        // Brickwright E5: + extensionURLs for pinned gallery extensions (bw-gallery-urls.js).
        const bwGalleryURLs = require('./serialization/bw-gallery-urls');
        return StringUtil.stringify(bwGalleryURLs.save(sb3.serialize(this.runtime, optTargetId), this.extensionManager));`;
if (vm2.includes(`require('./serialization/bw-gallery-urls')`)) {
    console.log('  virtual-machine.js E5 extensionURLs save hook already applied');
} else if (vm2.split(vmToJSONAnchor).length === 2) {
    vm2 = vm2.replace(vmToJSONAnchor, vmToJSONPatch);
    writeFileSync(vmPath2, vm2);
    console.log('  patched virtual-machine.js (E5 extensionURLs save hook)');
} else {
    console.error('  ! virtual-machine.js toJSON anchor not found exactly once — base VM version changed?');
    process.exit(1);
}

// F10: an imported MakeCode project keeps its own files in the saved project,
// with a fingerprint of the program it was imported as (owner decision
// 2026-10-12: keep, marked stale). The rules live in the overlay module
// serialization/bw-makecode-original.js. Two hooks: toJSON writes the record
// (after E5's extensionURLs), and deserializeProject reads it before the
// targets install and fingerprints a new one from the VM's own serialization
// once they have. Separate steps with their own anchors, so a store already
// carrying the E5 patch still gets these.
vm2 = readFileSync(vmPath2, 'utf8');
const f10SaveAnchor = `        return StringUtil.stringify(bwGalleryURLs.save(sb3.serialize(this.runtime, optTargetId), this.extensionManager));`;
const f10SavePatch = `        // Brickwright F10: + bwMakeCode, the imported MakeCode original (bw-makecode-original.js).
        const bwMakeCodeOriginal = require('./serialization/bw-makecode-original');
        return StringUtil.stringify(bwMakeCodeOriginal.save(
            bwGalleryURLs.save(sb3.serialize(this.runtime, optTargetId), this.extensionManager), this.runtime));`;
const f10LoadAnchor = `                return this.installTargets(targets, extensions, true);
            });`;
const f10LoadPatch = `                // Brickwright F10: the imported MakeCode original (bw-makecode-original.js).
                const bwMakeCodeOriginal = require('./serialization/bw-makecode-original');
                bwMakeCodeOriginal.load(projectJSON, runtime);
                return this.installTargets(targets, extensions, true).then(installed => {
                    bwMakeCodeOriginal.settle(runtime, () => require('./serialization/sb3').serialize(runtime));
                    return installed;
                });
            });`;
if (vm2.includes(`bwMakeCodeOriginal.save(`)) {
    console.log('  virtual-machine.js F10 MakeCode-original save hook already applied');
} else if (vm2.split(f10SaveAnchor).length === 2) {
    vm2 = vm2.replace(f10SaveAnchor, f10SavePatch);
    writeFileSync(vmPath2, vm2);
    console.log('  patched virtual-machine.js (F10 MakeCode-original save hook)');
} else {
    console.error('  ! virtual-machine.js F10 save anchor (the E5 toJSON line) not found exactly once');
    process.exit(1);
}
vm2 = readFileSync(vmPath2, 'utf8');
if (vm2.includes(`bwMakeCodeOriginal.load(projectJSON, runtime);`)) {
    console.log('  virtual-machine.js F10 MakeCode-original load hook already applied');
} else if (vm2.split(f10LoadAnchor).length === 2) {
    vm2 = vm2.replace(f10LoadAnchor, f10LoadPatch);
    writeFileSync(vmPath2, vm2);
    console.log('  patched virtual-machine.js (F10 MakeCode-original load hook)');
} else {
    console.error('  ! virtual-machine.js F10 load anchor (deserializeProject installTargets) not found exactly once');
    process.exit(1);
}

// A builtin extension that fails to load must cost its own blocks, not the
// project. Before 2026-09-05 a builtin COULD not fail: its code was in the
// bundle. Now music and the LEGO family are import()ed chunks, so their
// loadExtensionURL can reject — offline, or a cache miss on a redeployed hash —
// and the vanilla VM has two places that put ALL its work inside a bare
// Promise.all over those loads: installTargets (addTarget for every target is
// in the .then, so one rejection = an EMPTY project, silently) and
// shareBlocksToTarget. Measured by scripts/verify-lazy-extension-degradation.mjs
// against e0bebbf43: targets 0, opcodes [], pageErrors [] — the worst shape,
// found by bw-ci. The deserializeProject pre-load above already swallows
// per-extension; these are the other two sites. An absent extension then
// leaves its blocks unrenderable, which is what a missing gallery extension
// has always done.
vm2 = readFileSync(vmPath2, 'utf8');
const vmInstallAnchor = `                extensionPromises.push(this.extensionManager.loadExtensionURL(extensionURL));`;
const vmInstallPatch = `                // Brickwright: a lazy builtin's chunk can fail to arrive; that must cost
                // its blocks, not the whole project (see apply-vm-overlay.mjs).
                extensionPromises.push(
                    Promise.resolve(this.extensionManager.loadExtensionURL(extensionURL)).catch(() => {}));`;
const vmShareAnchor = `        const extensionPromises = Array.from(extensionIDs,
            id => this.extensionManager.loadExtensionURL(id)
        );`;
const vmSharePatch = `        // Brickwright: same per-extension tolerance as installTargets.
        const extensionPromises = Array.from(extensionIDs,
            id => Promise.resolve(this.extensionManager.loadExtensionURL(id)).catch(() => {})
        );`;
for (const [name, anchor, patch, marker] of [
    ['installTargets', vmInstallAnchor, vmInstallPatch, 'that must cost\n                // its blocks, not the whole project'],
    ['shareBlocksToTarget', vmShareAnchor, vmSharePatch, 'same per-extension tolerance as installTargets']
]) {
    if (vm2.includes(marker)) {
        console.log(`  virtual-machine.js ${name} extension-load tolerance already applied`);
    } else if (vm2.includes(anchor)) {
        vm2 = vm2.replace(anchor, patch);
        writeFileSync(vmPath2, vm2);
        console.log(`  patched virtual-machine.js (${name} tolerates a failed extension load)`);
    } else {
        console.error(`  ! virtual-machine.js ${name} extension-load anchor not found`);
        process.exit(1);
    }
}

// E3b: a project scratch-parser refuses went on to the Scratch 1 converter
// whatever its bytes, and the converter's own assertion on a JSON text or a zip
// ("Non-ascii character in FixedAsciiString") replaced the real reason. Only
// input that starts with the Scratch 1 signature is tried as Scratch 1 now;
// anything else is rejected with scratch-parser's own error, which names the
// failing path (e.g. .targets[0].variables['v'][1]).
vm2 = readFileSync(vmPath2, 'utf8');
const vmSb1Anchor = `            .catch(error => {
                const {SB1File, ValidationError} = require('scratch-sb1-converter');
`;
const vmSb1Patch = `            .catch(error => {
                // Brickwright E3b: only a Scratch 1 signature goes to the SB1 converter.
                if (!bwLooksLikeSb1(input)) return Promise.reject(error);
                const {SB1File, ValidationError} = require('scratch-sb1-converter');
`;
const vmSb1Helper = `const bwLooksLikeSb1 = function (input) {
    // Brickwright E3b: a Scratch 1 file starts with 'ScratchV01' or 'ScratchV02'.
    let head = '';
    try {
        if (typeof input === 'string') {
            head = input.slice(0, 10);
        } else {
            const bytes = ArrayBuffer.isView(input) ?
                new Uint8Array(input.buffer, input.byteOffset, Math.min(10, input.byteLength)) :
                new Uint8Array(input, 0, Math.min(10, input.byteLength));
            head = String.fromCharCode.apply(null, bytes);
        }
    } catch (e) {
        return true; // unknown input shape: keep the stock path
    }
    return head === 'ScratchV01' || head === 'ScratchV02';
};

class VirtualMachine extends EventEmitter {`;
if (vm2.includes('Brickwright E3b: only a Scratch 1 signature')) {
    console.log('  virtual-machine.js E3b SB1 signature check already applied');
} else if (vm2.split(vmSb1Anchor).length === 2 && vm2.split('class VirtualMachine extends EventEmitter {').length === 2) {
    vm2 = vm2.replace(vmSb1Anchor, vmSb1Patch).replace('class VirtualMachine extends EventEmitter {', vmSb1Helper);
    writeFileSync(vmPath2, vm2);
    console.log('  patched virtual-machine.js (E3b: SB1 fallback only for a Scratch 1 signature)');
} else {
    console.error('  ! virtual-machine.js E3b SB1 fallback anchor not found exactly once');
    process.exit(1);
}

// Trim locale data: editor-msgs.js is 3.9 MiB with 80 locales; brickwright-lite ships only
// en + de. Extract those two at build-prep time so webpack aliases to a 81 KiB file instead.
// This runs here (post-install) because node_modules/scratch-l10n is needed.
// Focused source qualification may use an owned VM projection with other
// dependencies linked read-only. Stop before worker builds or GUI/locale writes.
if (vmOnly) {
    console.log('  VM-only overlay complete; GUI and linked locale dependencies untouched');
    process.exit(0);
}
const GUI = path.join(ROOT, 'packages', 'scratch-gui');

// scratch-gui's webpack config copies extension-worker.js from scratch-vm's prebuilt dist tree.
// Rebuild that one entry after applying our source overlay; otherwise the main VM contains our
// broker while the shipped worker silently remains the upstream package's old implementation.
// Use the GUI's installed webpack rather than adding another root dependency.
const guiRequire = createRequire(path.join(GUI, 'package.json'));
const webpack = guiRequire('webpack');
const workerOutputDir = path.join(DEST, 'dist', 'web');
await new Promise((resolve, reject) => {
    webpack({
        mode: 'production',
        target: 'webworker',
        devtool: false,
        entry: path.join(DEST, 'src', 'extension-support', 'extension-worker.js'),
        output: {
            path: workerOutputDir,
            filename: 'extension-worker.js'
        },
        // Keep an executable provenance marker in the minified asset. A comment banner is
        // not reliable here: production minimizers are allowed to discard comments.
        plugins: [new webpack.BannerPlugin({
            banner: "self.__BRICKWRIGHT_SANDBOX_WORKER__='v1';",
            raw: true,
            entryOnly: true
        })]
    }, (error, stats) => {
        if (error) {
            reject(error);
            return;
        }
        if (stats.hasErrors()) {
            reject(new Error(stats.toString({all: false, errors: true, errorDetails: true})));
            return;
        }
        resolve();
    });
});
const workerBundle = readFileSync(path.join(workerOutputDir, 'extension-worker.js'), 'utf8');
if (!workerBundle.includes('__BRICKWRIGHT_SANDBOX_WORKER__')) {
    throw new Error('built extension-worker.js is missing the Brickwright sandbox marker');
}
console.log('  rebuilt dist/web/extension-worker.js from the overlaid sandbox source');

const editorMsgsPath = path.join(GUI, 'node_modules', 'scratch-l10n', 'locales', 'editor-msgs.js');
if (existsSync(editorMsgsPath)) {
    const src = readFileSync(editorMsgsPath, 'utf8');
    const tmpPath = editorMsgsPath + '.tmp.mjs';
    writeFileSync(tmpPath, src.replace(/^\/\/ GENERATED FILE:\n/, ''));
    const allMessages = (await import(tmpPath)).default;
    const { unlinkSync } = await import('node:fs');
    unlinkSync(tmpPath);

    const trimmed = { en: allMessages.en, de: allMessages.de };
    const trimmedDir = path.join(GUI, 'src', 'generated');
    mkdirSync(trimmedDir, { recursive: true });
    const trimmedPath = path.join(trimmedDir, 'editor-msgs-lite.js');
    writeFileSync(trimmedPath,
        '// AUTO-GENERATED by apply-vm-overlay.mjs — trimmed locale data (en + de only).\n' +
        '// The full editor-msgs.js has 80 locales (3.9 MiB); this keeps ~90 KiB.\n' +
        'export default ' + JSON.stringify(trimmed, null, 2) + ';\n'
    );
    console.log('  wrote src/generated/editor-msgs-lite.js (en + de only, ' +
        Math.round(JSON.stringify(trimmed).length / 1024) + ' KiB vs ' +
        Math.round(src.length / 1024) + ' KiB original)');
}

// Trim scratch-blocks locale messages the same way. scratch_msgs.js is 1.1 MiB with 80
// locales using goog.provide format. Extract en + de into a generated file.
const scratchMsgsPath = path.join(GUI, 'node_modules', 'scratch-blocks', 'msg', 'scratch_msgs.js');
if (existsSync(scratchMsgsPath)) {
    const src = readFileSync(scratchMsgsPath, 'utf8');
    const lines = src.split('\n');
    const keep = new Set(['en', 'de']);
    const outLines = [];
    let inLocale = null;
    let keeping = false;

    for (const line of lines) {
        const m = line.match(/^Blockly\.ScratchMsgs\.locales\["([^"]+)"\]/);
        if (m) {
            inLocale = m[1];
            keeping = keep.has(inLocale);
        }
        // Keep header lines (goog.provide, goog.require, 'use strict', blank, comments)
        if (inLocale === null || keeping) {
            outLines.push(line);
        }
    }

    // Overwrite in place — the shim loads this via a relative require through imports-loader,
    // so a webpack alias can't intercept it. This is safe: vendor.mjs re-fetches on every
    // clean build, so the original is always recoverable.
    writeFileSync(scratchMsgsPath, outLines.join('\n'));
    console.log('  trimmed scratch-blocks/msg/scratch_msgs.js in place (en + de only, ' +
        Math.round(outLines.join('\n').length / 1024) + ' KiB vs ' +
        Math.round(src.length / 1024) + ' KiB original)');
}
