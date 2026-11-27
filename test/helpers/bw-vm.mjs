/**
 * Run a shipped BrickWright program in the REAL Scratch VM, headless.
 *
 * The path mirrors what the Code tab does when you press "⇦ To blocks" and then
 * the green flag: SB3Creator.parse -> generateSB3 -> vm.loadProject ->
 * runtime.stc = project.stc -> greenFlag -> step. Nothing here is a
 * re-implementation of the runtime; the assertions are made against the same
 * scratch-vm the browser bundle builds from.
 *
 * Two deliberate deviations from the browser, both stated rather than hidden:
 *
 *  1. Extensions are registered INTERNALLY (`_registerInternalExtension`) from
 *     lite's bundled sources instead of being fetched into a sandbox Worker,
 *     because node has no Worker. The extension object is the same one the
 *     browser builds — see bw-extensions.mjs.
 *  2. There is no renderer. Storage is optional (`storage: true`); otherwise
 *     costumes/sounds do not load and
 *     motion/looks blocks are inert. Variables, control flow, custom blocks and
 *     extension blocks all run for real.
 *
 * `import VM from '<...>/scratch-vm/src/index.js'` and not `'scratch-vm'`: the
 * package main points at `dist/node/scratch-vm.js`, which is the UNPATCHED
 * bundle. The browser builds from `src` through a webpack alias, so `src` is
 * what ships and `src` is what this measures.
 */
import path from 'node:path';
import {REPO, INTEGRATED, importSource, importGuiDependency} from './bw-integrated.mjs';
import {bundledExtensionIds, loadExtensionClass, probeExtension, stubRuntime} from './bw-extensions.mjs';

export {REPO, INTEGRATED};

export const SB3Creator = (await importSource('src/lib/sb3-creator.js')).default;
export const VM = (await importGuiDependency('scratch-vm/src/index.js')).default;

const EXTENSION_IDS = bundledExtensionIds();
const classCache = new Map();
function extensionClass (id) {
    if (!classCache.has(id)) classCache.set(id, loadExtensionClass(EXTENSION_IDS.get(id)));
    return classCache.get(id);
}

/** The bundled extension id that owns an opcode, or null. Longest prefix wins. */
export function ownerOf (opcode) {
    let owner = null;
    for (const id of EXTENSION_IDS.keys()) {
        if (opcode.startsWith(`${id}_`) && (!owner || id.length > owner.length)) owner = id;
    }
    return owner;
}

export const CORE_PREFIX = /^(motion|looks|sound|event|control|sensing|operator|data|procedures|argument|music|pen)_/;

/** Every opcode a parsed project contains, before it reaches the VM. */
export function projectOpcodes (project) {
    const opcodes = new Set();
    for (const target of project.targets || []) {
        for (const block of Object.values(target.blocks || {})) {
            if (block && block.opcode) opcodes.add(block.opcode);
        }
    }
    return opcodes;
}

/**
 * What the bundled extensions provide for THIS project's declarations.
 * Returns `{provided: Set<opcode>, missing: [{opcode, defined, implemented}], errors: []}`.
 */
export function conformance (project) {
    const runtime = stubRuntime(project.stc);
    const probes = new Map();
    const provided = new Set();
    const missing = [];
    const errors = [];
    for (const opcode of projectOpcodes(project)) {
        if (CORE_PREFIX.test(opcode) || !opcode.includes('_')) continue;
        const id = ownerOf(opcode);
        if (!id) { missing.push({opcode, defined: false, implemented: false, extension: null}); continue; }
        if (!probes.has(id)) probes.set(id, probeExtension(extensionClass(id), runtime));
        const probe = probes.get(id);
        if (probe.error) { errors.push({extension: id, error: probe.error}); continue; }
        const bare = opcode.slice(id.length + 1);
        const menu = probe.menus.has(bare);
        const defined = menu || probe.opcodes.has(bare);
        const implemented = menu || probe.methods.has(bare);
        if (defined && implemented) provided.add(opcode);
        else missing.push({opcode, defined, implemented, extension: id});
    }
    return {provided, missing, errors};
}

/**
 * Register lite's bundled extensions on a VM in-process (no Worker in node),
 * with every opcode method counted.
 *
 * The call counter is the gate's liveness instrument. "The program ran" is
 * cheap to satisfy — an empty forever-loop satisfies it. "A hardware verb this
 * program authored was actually invoked by the real VM through the real shipped
 * extension" is not, and it is exactly what the five inert gallery examples
 * (`set variable X to Y`) failed to do: they parse, they load, they step, and no
 * extension method is ever reached.
 *
 * Reads are counted alongside writes on purpose. A program whose actuation sits
 * behind a sensor threshold may legitimately never take that branch in a
 * headless run, but it still polls — so counting reads keeps the signal free of
 * false accusations while still going to zero for a program that lost its
 * hardware verbs to a syntax slip.
 */
function registerBundledExtensions (vm, calls, countExtensionCalls = true) {
    const manager = vm.extensionManager;
    const original = manager.loadExtensionURL.bind(manager);
    manager.loadExtensionURL = id => {
        const key = String(id);
        if (EXTENSION_IDS.has(key)) {
            // Production rejects a second built-in instance for the same ID.
            // Reopening an SB3 must reset the existing extension through its
            // lifecycle events, without adding another frame listener.
            if (manager.isExtensionLoaded(key)) return Promise.resolve();
            const instance = new (extensionClass(key))(vm.runtime);
            // Ownership-sensitive cases select genuine production delegates.
            // No call-counter observation is available in that explicit mode.
            for (const name of countExtensionCalls ? Object.getOwnPropertyNames(instance) : []) {
                const method = instance[name];
                if (typeof method !== 'function' || name === 'getInfo') continue;
                instance[name] = function (...args) {
                    calls.set(`${key}_${name}`, (calls.get(`${key}_${name}`) || 0) + 1);
                    return method.apply(this, args);
                };
            }
            const service = manager._registerInternalExtension(instance);
            manager._loadedExtensions.set(key, service);
            return Promise.resolve();
        }
        return original(id);
    };
}

/**
 * Timers an extension starts while a project runs.
 *
 * Several bundled extensions (BLE reconnect, gamepad poll) install an interval
 * on construction or on first use. `vm.quit()` clears the runtime's own stepping
 * interval but knows nothing about theirs, so node:test finishes every assertion
 * and then never exits — which reads as a hang, not as a result. Capture and
 * clear them around every run.
 */
const strayTimers = new Set();
{
    // Patched for the lifetime of the harness rather than around each call:
    // extensions install timers from async continuations too, and a
    // try/finally around a promise-returning call restores the globals before
    // those run.
    const realInterval = globalThis.setInterval;
    const realTimeout = globalThis.setTimeout;
    globalThis.setInterval = (...args) => { const h = realInterval(...args); strayTimers.add(h); return h; };
    globalThis.setTimeout = (...args) => { const h = realTimeout(...args); strayTimers.add(h); return h; };
}
export function clearStrayTimers () {
    for (const handle of strayTimers) {
        try { clearInterval(handle); } catch { /* noop */ }
        try { clearTimeout(handle); } catch { /* noop */ }
    }
    strayTimers.clear();
}

const started = new Set();
const realStart = VM.prototype.start;
VM.prototype.start = function () { started.add(this); return realStart.call(this); };
const realQuit = VM.prototype.quit;
VM.prototype.quit = function () { started.delete(this); return realQuit.call(this); };
/** Kill any VM a failed assertion left stepping — otherwise node:test never exits. */
export function quitStrandedVMs () {
    for (const vm of started) { try { vm.quit(); } catch { /* noop */ } }
    started.clear();
    clearStrayTimers();
}

/**
 * Parse, package, load and step one program.
 *
 * Returns everything an assertion might need: the creator (for the parsed
 * project), the vm, the opcodes that survived deserialization, and the
 * extension ids the VM actually loaded.
 */
function variableSnapshot (vm) {
    const snapshot = new Map();
    for (const target of vm.runtime.targets) {
        for (const variable of Object.values(target.variables || {})) {
            snapshot.set(`${target.id}/${variable.name}`, JSON.stringify(variable.value));
        }
    }
    return snapshot;
}

/** Advance explicit physics frames with the normal Promise continuation queue.
 * This does not fast-forward wait timers; controlled-clock tests inject the
 * runtime clock too, while ordinary fixtures retain their real wait clock.
 */
export async function stepFrames(vm, frames, frameMs = 1000 / 30) {
    for (let i = 0; i < frames; i++) {
        await vm.runtime._step(frameMs);
        await new Promise(resolve => setImmediate(resolve));
    }
}

export async function runProgram (source, {frames = 12, keys = [], uploads = [], storage = false, retainExtensionTimers = false, frameAuthority = 'manual', observeCreator = null, countExtensionCalls = true} = {}) {
    if(typeof countExtensionCalls!=='boolean')throw new Error('Extension call observation must be explicitly boolean');
    const creator = new SB3Creator();
    try { creator.parse(source); }
    catch (parseError) {
        // Observing a failed parse must never replace the actual parser error.
        try { if (observeCreator) observeCreator(creator, parseError); }
        catch (observerError) { try { process.stderr.write(JSON.stringify({kind:'creator-observer-failed',message:String(observerError?.message ?? observerError),stack:observerError?.stack})+'\n'); } catch {} }
        throw parseError;
    }
    if (observeCreator) observeCreator(creator, null);
    return runCreatedProgram(creator, {frames, keys, uploads, storage, retainExtensionTimers,
        frameAuthority, countExtensionCalls});
}

/** Continue an actual parsed Creator through the original VM path. Optional
 * resource inputs mirror the GUI archive transaction; defaults preserve the
 * historical runProgram route. observeRun retains raw events and owns cleanup
 * even if load/start/step throws before a successful return.
 */
export async function runCreatedProgram (creator, {frames = 12, keys = [], uploads = [], storage = false,
    retainExtensionTimers = false, frameAuthority = 'manual', countExtensionCalls = true,
    animationResources = [], artworkContext = null, artworkVM = null, observeRun = null, circuitBoard} = {}) {
    if(typeof countExtensionCalls!=='boolean')throw new Error('Extension call observation must be explicitly boolean');
    for (const upload of uploads) {
        if (upload.mode === 'add') {
            // Code read back from blocks already declares the frame (COSTUME name);
            // fill that slot, as the app's live-artwork transaction does, rather
            // than appending a second costume after it.
            const target = creator.project.targets.find(t => !t.isStage && t.name === upload.sprite);
            const slot = target ? target.costumes.findIndex((c, i) => i > 0 && c.name === upload.name) : -1;
            if (creator.addCustomSVGCostume(upload.sprite, upload.svg, upload.name) && slot > 0) {
                const filled = target.costumes.pop();
                const [declared] = target.costumes.splice(slot, 1, filled);
                if (declared?.assetId && !target.costumes.some(c => c.assetId === declared.assetId)) creator.assets.delete(declared.assetId);
            }
        } else creator.applyCustomSVG(upload.sprite, upload.svg);
    }
    let bytes = await (await creator.generateSB3()).arrayBuffer();
    let artwork = null, preparedStorage = null;
    if (animationResources.length || artworkContext) {
        if (!storage) throw new Error('Journey artwork requires actual VM storage');
        const Storage = (await importGuiDependency('scratch-storage/dist/node/scratch-storage.js')).default;
        preparedStorage = new Storage();
        const ZIP = (await importGuiDependency('jszip/lib/index.js')).default;
        const zip = await ZIP.loadAsync(bytes);
        const {inspectArtwork} = await importSource('src/lib/bw-artwork-bundle.js');
        let revision;
        let codeArtwork;
        if (artworkContext) {
            codeArtwork = await importSource('src/lib/bw-code-artwork.js');
            if (!codeArtwork.retainCodeArtwork(zip, creator.project, artworkVM, artworkContext, uploads)) {
                throw new Error('Code artwork context no longer matches the loaded VM');
            }
            revision = codeArtwork.captureCodeArtworkRevision(artworkVM, artworkContext);
        }
        if (animationResources.length) {
            const {installAnimationImport} = await importSource('src/lib/bw-animation-import.js');
            await installAnimationImport(zip, animationResources, data => preparedStorage.createAsset(
                preparedStorage.AssetType.ImageVector, preparedStorage.DataFormat.SVG, data, null, true).assetId);
        }
        bytes = await zip.generateAsync({type: 'arraybuffer', compression: 'DEFLATE'});
        artwork = await inspectArtwork(bytes);
        if (artwork.outcome === 'invalid') throw new Error(artwork.reason);
        if (artworkContext && (!codeArtwork.codeArtworkMatches(artworkVM, artworkContext) ||
            !codeArtwork.codeArtworkRevisionMatches(artworkVM, revision))) {
            throw new Error('Code artwork changed while preparing the next project');
        }
    }
    const buffer = Buffer.from(bytes);
    if(!['manual','timed'].includes(frameAuthority))throw new Error('Frame authority must be manual or timed');
    const errors = [], errorEvents = [];
    const onError = (message, ...details) => {
        // An owned journey keeps the raw event even if String(message) itself
        // throws. Historical default callback/coercion order remains unchanged.
        if (observeRun) errorEvents.push({message, details});
        errors.push(String(message));
        if (!observeRun) errorEvents.push({message, details});
    };
    const vm = new VM();
    const partial = observeRun ? {vm, creator, buffer, errors, errorEvents, state: 'constructed'} : null;
    if (partial) {
        vm.runtime.on('BLOCKS_ERROR', onError); vm.on('BLOCKS_ERROR', onError);
        observeRun(partial);
    }
    // Historical finite fixtures explicitly supply manual physical frames and
    // retain their real program/wait clock. GUI runtimes never receive this flag.
    // Exact source timer/scene controls select timed and inject an independent
    // now/setTimeout/clearTimeout platform; a frame delta is not a timer clock.
    vm.runtime.bwArcadeFrameAuthority=frameAuthority;
    if (storage) {
        const Storage = (await importGuiDependency('scratch-storage/dist/node/scratch-storage.js')).default;
        vm.attachStorage(preparedStorage || new Storage());
    }
    const calls = new Map();
    registerBundledExtensions(vm, calls, countExtensionCalls);
    if (partial) partial.state = 'load-begin';
    await vm.loadProject(buffer);
    if (partial) partial.state = 'load-return';
    let appliedArtwork = null;
    if (artwork) {
        const {applyArtwork} = await importSource('src/lib/bw-artwork-bundle.js');
        appliedArtwork = applyArtwork(artwork, vm);
        if (Object.hasOwn(appliedArtwork, 'resourceError')) throw appliedArtwork.resourceError;
        if (appliedArtwork.outcome !== artwork.outcome || appliedArtwork.count !== artwork.records.length) {
            throw new Error('Loaded VM did not retain every inspected artwork document');
        }
    }
    if (creator.project.stc) vm.runtime.stc = creator.project.stc;
    if (circuitBoard) vm.runtime.circuitBoard = circuitBoard;
    const loadedOpcodes = new Set();
    let blockCount = 0;
    for (const target of vm.runtime.targets) {
        for (const block of Object.values(target.blocks._blocks || {})) {
            loadedOpcodes.add(block.opcode);
            blockCount++;
        }
    }
    if (!partial) { vm.runtime.on('BLOCKS_ERROR', onError); vm.on('BLOCKS_ERROR', onError); }
    const before = variableSnapshot(vm);
    if (partial) partial.state = 'start-begin';
    vm.start();
    if (partial) partial.state = 'green-flag-begin';
    vm.greenFlag();
    const greenFlagThreadsStarted = vm.runtime.threads.length;
    for (const key of keys) vm.postIOData('keyboard', {key, isDown: true});
    const threadsStarted = vm.runtime.threads.length;
    // Drive deterministic frames ourselves, while allowing Promise reporters
    // and callback completions to resume between frames as they do in-browser.
    vm.quit();
    if (partial) partial.state = 'step-begin';
    await stepFrames(vm, frames);
    if (partial) partial.state = 'step-return';
    const after = variableSnapshot(vm);
    vm.quit();
    // Fiber-driven extension fixtures keep timers until their explicit cleanup.
    if (!retainExtensionTimers) clearStrayTimers();
    let variablesChanged = 0;
    for (const [name, value] of after) if (before.get(name) !== value) variablesChanged++;
    let extensionCalls = 0;
    for (const count of calls.values()) extensionCalls += count;
    if (partial) partial.state = 'return';
    return {creator, vm, buffer, loadedOpcodes, blockCount, threadsStarted, greenFlagThreadsStarted, errors, errorEvents, artwork, appliedArtwork,
        calls, extensionCalls, extensionCallsObserved: countExtensionCalls, variablesChanged,
        loadedExtensions: new Set(vm.extensionManager._loadedExtensions.keys())};
}
