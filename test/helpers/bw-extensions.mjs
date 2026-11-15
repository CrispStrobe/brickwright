import {packageSourceFile} from './package-source.mjs';
/**
 * Load lite's BUNDLED extensions the way the shipped app loads them, from the
 * git source of truth (`overlay/scratch-vm/...`) rather than from the installed
 * `node_modules/scratch-vm` copy.
 *
 * Why overlay and not node_modules: `scripts/apply-vm-overlay.mjs` copies the
 * overlay onto node_modules as a post-install step. A developer machine whose
 * last apply-vm-overlay predates an extension edit therefore holds a STALE
 * copy — measured 2026-08-23: three extensions (stc12, stc12live, controller)
 * differed, and the stale stc12 reported 12 opcodes where the shipped one has
 * 20. Reading the overlay removes that whole class of false reading.
 *
 * The four `extension-support` / `util` modules the adapter pulls in are stock
 * upstream scratch-vm and come from the installed copy; the overlay does not
 * carry them. The fifth, `util/bw-values`, IS an overlay file, and it also comes
 * from the installed copy: it keeps module-level state (the per-runtime scope
 * and the reference intern table), so an extension built here and a VM module
 * that requires it (sb3.js, once E3 lands) must share ONE instance. Reading the
 * installed copy alone would bring back the stale-copy reading above, so the
 * helper refuses an installed copy that differs from the overlay and names the
 * remedy.
 *
 * Extensions are resolved to their ids STATICALLY and constructed LAZILY.
 * Constructing all 26 does not terminate: several LEGO BLE extensions start a
 * reconnect/poll loop in their constructor (measured — a full sweep ran past
 * 10 minutes). Only the handful an example actually needs is ever built.
 */
import {readFileSync, readdirSync, existsSync, statSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {REPO, INTEGRATED} from './bw-integrated.mjs';

export {REPO};
export const OVERLAY_EXT = path.join(REPO, 'overlay', 'scratch-vm', 'src', 'extensions', 'crispstrobe');
export const VM_SRC = path.join(INTEGRATED, 'node_modules', 'scratch-vm', 'src');

const nodeRequire = createRequire(import.meta.url);
const SUPPORT = {
    'argument-type': 'extension-support/argument-type',
    'block-type': 'extension-support/block-type',
    'target-type': 'extension-support/target-type',
    cast: 'util/cast',
    'bw-values': 'util/bw-values',
    'bw-array-operations': 'util/bw-array-operations',
    'bw-array-source-values': 'util/bw-array-source-values',
    'bw-extension-result-factory': 'util/bw-extension-result-factory',
    'bw-primitive-owner': 'util/bw-primitive-owner',
    'bw-source-condition-waits': 'util/bw-source-condition-waits',
    'bw-procedure-entry': 'util/bw-procedure-entry',
    'bw-procedure-constraint-model': 'util/bw-procedure-constraint-model',
    'bw-graph-version': 'util/bw-graph-version',
    'bw-arcade-exceptions': 'util/bw-arcade-exceptions',
    'bw-null-sprite-getter': 'util/bw-null-sprite-getter',
    'bw-tile-lookup-faults': 'util/bw-tile-lookup-faults',
    'bw-scene-clock-number': 'util/bw-scene-clock-number',
    'bw-frame-delta-number': 'util/bw-frame-delta-number',
    'bw-current-number-input': 'util/bw-current-number-input',
    'bw-cached-primitive-owner': 'util/bw-cached-primitive-owner',
    'bw-animation-resource-menu': 'util/bw-animation-resource-menu'
};
// Overlay-owned support modules: same installed instance, but only when its bytes are the overlay's.
const OVERLAY_SUPPORT = new Set(['bw-frame-delta-number', 'bw-scene-clock-number', 'bw-null-sprite-getter', 'bw-tile-lookup-faults', 'bw-procedure-entry', 'bw-procedure-constraint-model', 'bw-graph-version', 'bw-values', 'bw-array-operations', 'bw-array-source-values', 'bw-extension-result-factory', 'bw-animation-resource-menu', 'bw-primitive-owner', 'bw-current-number-input', 'bw-cached-primitive-owner', 'bw-arcade-exceptions', 'bw-source-condition-waits']);
function installedOverlaySupport (base) {
    const installed = path.join(VM_SRC, `${SUPPORT[base]}.js`);
    const overlay = path.join(REPO, 'overlay', 'scratch-vm', 'src', `${SUPPORT[base]}.js`);
    const theirs = existsSync(installed) ? readFileSync(installed, 'utf8') : null;
    if (theirs !== readFileSync(overlay, 'utf8')) {
        throw new Error(`bw-extensions: installed ${SUPPORT[base]}.js ${theirs === null ? 'is missing' : 'differs from the overlay'}` +
            ' — run `node scripts/apply-vm-overlay.mjs`');
    }
    if (base === 'bw-current-number-input' || base === 'bw-frame-delta-number') {
        installedOverlaySupport('bw-primitive-owner');
        installedOverlaySupport('bw-cached-primitive-owner');
    }
    return nodeRequire(installed);
}

let adapterCache = null;
function shimRequire (spec, from) {
    const base = path.basename(spec);
    // This one lazy consumer needs the actual Runtime class whose constructor
    // issued the private origin facts. Do not admit an arbitrary engine path
    // or make another source-evaluated Runtime/metadata-factory instance.
    if (spec === '../../../engine/runtime' && from === path.join(OVERLAY_EXT, 'arcade', 'console-inspect-values.js') ||
        spec === '../../engine/runtime' && from === path.join(OVERLAY_EXT, 'adapter.js')) {
        return nodeRequire(path.join(VM_SRC, 'engine', 'runtime.js'));
    }
    if (base === 'adapter') return loadAdapter();
    if (spec === 'format-message') return nodeRequire(path.join(INTEGRATED, 'node_modules', spec));
    if (OVERLAY_SUPPORT.has(base)) return installedOverlaySupport(base);
    if (SUPPORT[base]) return nodeRequire(path.join(VM_SRC, SUPPORT[base]));
    if (spec.startsWith('./')) {
        const candidate = path.resolve(path.dirname(from), spec);
        if (candidate.startsWith(OVERLAY_EXT + path.sep)) {
            const file = existsSync(candidate) ? candidate : candidate + '.js';
            if (file.endsWith('.json')) return JSON.parse(readFileSync(file, 'utf8'));
            return evalCjs(file);
        }
    }
    throw new Error(`bw-extensions: unresolved require(${spec})`);
}
function evalCjs (file) {
    const module_ = {exports: {}};
    // eslint-disable-next-line no-new-func
    new Function('require', 'module', 'exports', '__filename', '__dirname',
        readFileSync(file, 'utf8'))(spec => shimRequire(spec, file), module_, module_.exports, file, path.dirname(file));
    return module_.exports;
}
function loadAdapter () {
    if (!adapterCache) adapterCache = evalCjs(path.join(OVERLAY_EXT, 'adapter.js'));
    return adapterCache;
}

/**
 * `extension id -> directory`, read statically from the source.
 *
 * The directory name is NOT the id in general (`ev3dev/` registers as
 * `scratchtoev3`), so the id is taken from the extension's own
 * `// ID: <id>` header or, failing that, the `id:` field of its getInfo
 * literal. Static because construction is not safe (see the file header).
 */
/** Extension directories with no index.js: skipped by bundledExtensionIds, and SAID so here. */
export const extensionDirsWithoutEntry = [];
export function bundledExtensionIds () {
    const ids = new Map();
    extensionDirsWithoutEntry.length = 0;
    for (const name of readdirSync(OVERLAY_EXT)) {
        const dir = path.join(OVERLAY_EXT, name);
        if (!statSync(dir).isDirectory()) continue; // a file beside the extension dirs is not an extension (role)
        const entry = path.join(dir, 'index.js');
        // ABSENCE, reported: a directory that is not an extension is a fact the caller can print
        if (!existsSync(entry)) { extensionDirsWithoutEntry.push(name); continue; }
        const source = readFileSync(entry, 'utf8');
        const header = source.match(/^\s*\/\/\s*ID:\s*([\w.-]+)\s*$/m);
        const field = source.match(/\bid:\s*["']([\w.-]+)["']/);
        const id = (header && header[1]) || (field && field[1]) || name;
        ids.set(id, name);
    }
    return ids;
}

/** Build the class for one bundled extension directory. */
export function loadExtensionClass (dir) {
    return evalCjs(path.join(OVERLAY_EXT, dir, 'index.js'));
}

/**
 * A runtime stub with the surface the bundled extensions touch at construction
 * time. `stc` carries the pin/port/part/table declarations, because stc12 gates
 * its port and matrix blocks on them: probing against an empty runtime
 * under-reports its opcode set (12 instead of 20), which would make this gate
 * accuse a correct extension of missing blocks.
 */
export function stubRuntime (stc) {
    return {
        stc: stc || {device: 'stc89c52rc', pins: [], ports: [], parts: [], tables: []},
        targets: [], ioDevices: {}, peripheralExtensions: {}, _events: {},
        emit () {}, on () {}, once () {}, off () {}, addListener () {}, removeListener () {},
        registerPeripheralExtension () {}, getTargetForStage () { return null; },
        requestRedraw () {}, startHats () {}, requestBlocksUpdate () {}
    };
}

/**
 * Construct one extension and report what it defines.
 *
 * Returns `{id, opcodes, methods, error}`. Both sets matter: scratch-vm needs
 * getInfo() to DEFINE the block and a same-named method to RUN it, and the two
 * can disagree — a block listed with no implementation loads into the palette
 * and then does nothing.
 *
 * Timers started during construction are cleared afterwards. Several
 * extensions start a poll loop on construct; left running, node:test never
 * exits and the gate reads as a hang rather than a result.
 */
export function probeExtension (Cls, runtime) {
    const timers = [];
    const realInterval = globalThis.setInterval;
    const realTimeout = globalThis.setTimeout;
    const realRaf = globalThis.requestAnimationFrame;
    globalThis.setInterval = (...args) => { const h = realInterval(...args); timers.push(h); return h; };
    globalThis.setTimeout = (...args) => { const h = realTimeout(...args); timers.push(h); return h; };
    globalThis.requestAnimationFrame = globalThis.requestAnimationFrame || (() => 0);
    try {
        const instance = new Cls(runtime);
        const info = instance.getInfo();
        const opcodes = new Set();
        for (const block of info.blocks || []) {
            if (block && typeof block === 'object' && block.opcode) opcodes.add(block.opcode);
        }
        const methods = new Set();
        for (let o = instance; o && o !== Object.prototype; o = Object.getPrototypeOf(o)) {
            for (const key of Object.getOwnPropertyNames(o)) {
                try { if (typeof instance[key] === 'function') methods.add(key); } catch { /* getter */ }
            }
        }
        // Reporter menus are implemented by the VM's field reporter path. They
        // have no same-named extension method; field-only menus are not inputs.
        const menus = new Set(Object.entries(info.menus || {})
            .filter(([, menu]) => menu?.acceptReporters)
            .map(([name]) => `menu_${name}`));
        return {id: info.id, instance, opcodes, methods, menus, error: null};
    } catch (error) {
        return {id: null, instance: null, opcodes: new Set(), methods: new Set(), menus: new Set(),
            error: (error && error.message) || String(error)};
    } finally {
        for (const handle of timers) { try { clearInterval(handle); clearTimeout(handle); } catch { /* noop */ } }
        globalThis.setInterval = realInterval;
        globalThis.setTimeout = realTimeout;
        if (realRaf === undefined) delete globalThis.requestAnimationFrame;
    }
}



/**
 * Blank out comments before a source scan.
 *
 * A gate that derives facts by scanning source must not read the prose that
 * DESCRIBES it, or documenting the thing it checks breaks it. bw-cui2 hit this
 * exactly: their debug-status contract gate failed on its own explanation,
 * because the comment they wrote naming `task.name` and `task.label` was picked
 * up as live bindings.
 *
 * Measured here on 2026-08-23: 24 matches across the devices extension, 0 of
 * them in comments — so this is latent rather than live, and it goes live the
 * moment someone explains the guard shape in a comment, which is what people do
 * when they touch it.
 *
 * Block comments and whole-line `//` only. A trailing comment on a code line is
 * left alone deliberately: blanking it means finding the `//` that starts a
 * comment rather than one inside a string or a regex literal, and getting that
 * wrong would corrupt the code being scanned — a worse failure than the one
 * being prevented. The risk it leaves is a trailing comment containing an
 * entire `if (b && b.X) b.X(` or a whole `_KINDS = /^(...)$/i`, which is not a
 * shape trailing comments take.
 */
export function stripComments (source) {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, match => match.replace(/[^\n]/g, ' '))
        .split('\n').map(line => (/^\s*\/\//.test(line) ? '' : line)).join('\n');
}

/**
 * Board members a bundled extension guards on, as `member -> [extension ids]`.
 *
 * Every actuator in the `devices` extension has the shape
 *
 *     verb (args) { const b = this._board(); if (b && b.someMethod) b.someMethod(...); }
 *
 * which means a verb whose `someMethod` does not exist on the board is a
 * TRUTHINESS-GUARDED NO-OP: getInfo() lists the block, a same-named method
 * exists, scratch-vm registers and calls it, the call returns, and nothing
 * happens. It passes an opcode-conformance check and it passes an execution
 * check that counts an invoked extension method as reaching hardware.
 *
 * Parsed rather than executed, because the guard is what we want to see: running
 * the method just takes the false branch silently, which is the whole problem.
 */
export function guardedBoardMembers () {
    const found = new Map();
    for (const [id, dir] of bundledExtensionIds()) {
        const file = path.join(OVERLAY_EXT, dir, 'index.js');
        if (!existsSync(file)) continue;
        const source = stripComments(readFileSync(file, 'utf8'));
        for (const match of source.matchAll(/\bif\s*\(\s*(\w+)\s*&&\s*\1\.(\w+)\s*\)\s*\1\.\2\s*\(/g)) {
            const member = match[2];
            if (!found.has(member)) found.set(member, new Set());
            found.get(member).add(id);
        }
    }
    return found;
}

/**
 * Method names the board object the app attaches actually defines.
 *
 * Two sources, unioned, because the object the extension receives as
 * `runtime.circuitBoard` is bw-circuit-ui's Circuit, which delegates to
 * bw-board's board: a member on either is reachable.
 */
export function boardMemberNames () {
    const names = new Set();
    const roots = [
        packageSourceFile('bw-circuit-ui/model/circuit.js'),
        packageSourceFile('bw-board/board.js')
    ];
    for (const file of roots) {
        if (!existsSync(file)) continue;
        // readFileSync, not grep. board.js contains a literal NUL byte at line
        // 1412 (`const key = `${partId}\0${verb}`` — a composite-key separator),
        // which makes GNU grep classify the whole file as BINARY and silently
        // search nothing. That is not hypothetical: it produced a confident,
        // wrong "setDeviceControl is defined nowhere" that reached three other
        // sessions before anyone executed the code path. `file board.js` says
        // "data"; `grep -a` works; reading the bytes always works.
        const source = stripComments(readFileSync(file, 'utf8'));
        for (const match of source.matchAll(/^[ \t]{2,4}([a-zA-Z_]\w*)\s*\(/gm)) names.add(match[1]);
        for (const match of source.matchAll(/^[ \t]{2,6}([a-zA-Z_]\w*)\s*[:=]\s*(?:function\b|\()/gm)) {
            names.add(match[1]);
        }
    }
    for (const keyword of ['if', 'for', 'while', 'switch', 'catch', 'return']) names.delete(keyword);
    return names;
}
