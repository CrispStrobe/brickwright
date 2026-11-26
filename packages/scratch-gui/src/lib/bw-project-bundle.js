import {CONNECTIONS_KEY, validateConnections} from './bw-cad-circuit/connections.js';
import {validateCp1Workspace} from './cp1-project.js';
import {LOGIKUS_STORAGE_KEY, LOGIKUS_WORKSPACE_MAX_BYTES, validateWorkspace as validateLogikusWorkspace,
    getLiveWorkspace as getLiveLogikusWorkspace, setLiveWorkspace as setLiveLogikusWorkspace,
    getWorkspaceGeneration as getLogikusGeneration, setWorkspaceGeneration as setLogikusGeneration} from './logikus/workspace.js';
import {validateCardiacWorkspace} from './cardiac-project.js';
import {CAD_PROJECT_PATH, CAD_STORAGE_KEY, CAD_PROJECT_LIMIT, inspectCadText, readCadText, getLiveCadText, setLiveCadText, getCadProjectGeneration, setCadProjectGeneration} from './bw-cad-project.js';
import {sandboxWorld, SANDBOX_STORAGE_KEY} from './spike-arena/arena-sandbox.js';
import {simLabRecord, SIM_LAB_STORAGE_KEY, SIM_LAB_LIMIT} from './bw-sim/model/sim-lab-persist.js';
import {simLabSaveFailure, refuseSimLabSave, clearSimLabSaveFailure} from './bw-sim/model/sim-lab-save-state.js';
/**
 * Carry the Circuit, Code and Widgets tabs (and the SPIKE arena sandbox and the
 * Sim Lab model) inside the .sb3, in ONE format.
 *
 * THE PROBLEM
 * -----------
 * "Save to Computer" writes `vm.saveProjectSb3()` — sprites, blocks, costumes,
 * sounds. Nothing else. The other three tabs live only in this browser's
 * localStorage (`bw-circuit-autosave`, `bw-code-autosave`, `bw-ctl-widget-*`),
 * so a project that spans all four tabs COULD NOT BE MOVED BETWEEN MACHINES AT
 * ALL: the file the user carefully saved never contained three quarters of it,
 * and clearing site data, private browsing or a new device lost the rest.
 *
 * WHY ONE FORMAT AND NOT TWO
 * --------------------------
 * A .sb3 is a ZIP. scratch-vm's deserializer reads `project.json` and then
 * fetches only the assets that project.json NAMES by md5ext — verified by
 * reading it: nothing enumerates the archive, there is no manifest and no
 * whitelist. Unknown entries are never opened.
 *
 * So an extra `brickwright/state.json` entry is invisible to every existing
 * reader. Backwards compatibility is not a promise we maintain, it is a property
 * of the container:
 *
 *   - vanilla Scratch and older Brickwright open our files as ordinary projects
 *   - we open theirs, find no bundle, and treat that as "legacy, no circuit"
 *
 * A second format would double the load paths and give a user two files to keep
 * together. The same trick is already used in this codebase by MediaPanel, which
 * packs and unpacks `brickwright-media.json` inside a .zip.
 */

const BUNDLE_PATH = 'brickwright/state.json';
const BUNDLE_FORMAT = 'brickwright-state';
const BUNDLE_VERSION = 2;
const MAX_BUNDLE_BYTES = 2 * 1024 * 1024;
const SECTION_LIMITS = Object.freeze({code: 512 * 1024, circuit: 1024 * 1024,
    controller: 512 * 1024, spikeArena: 1024 * 1024, simLab: SIM_LAB_LIMIT, cadCircuit: 32 * 1024, fpga: 512 * 1024, cp1: 256 * 1024,
    cardiac: 256 * 1024, logikus: LOGIKUS_WORKSPACE_MAX_BYTES});
const KNOWN_SECTIONS = Object.freeze(['code', 'circuit', 'controller', 'legacyWidgets', 'spikeArena', 'simLab', 'fpga', 'cadCircuit', 'cp1', 'logikus', 'cardiac']);
// The FPGA lab's Verilog/constraints and its gate-builder canvas (fpga-tab.jsx,
// fpga-gate-builder-rf.jsx) travel as one optional `fpga` section.
const FPGA_DESIGN_KEY = 'bw-fpga-autosave';
const FPGA_GATES_KEY = 'bw-fpga-gates-autosave';
let preservedBundle = null;
const utf8Size = value => new TextEncoder().encode(value).byteLength;

/**
 * The localStorage keys that are PROJECT CONTENT, as opposed to per-device UI
 * preference. Theme, panel toggles, instrument visibility and the rest are
 * deliberately NOT carried: they belong to the person and the screen, not the
 * project, and copying them between machines would be a surprise.
 */
const EXACT_KEYS = ['bw-circuit-autosave', 'bw-code-autosave', 'bw-ctl-widgets', SANDBOX_STORAGE_KEY,
    SIM_LAB_STORAGE_KEY, FPGA_DESIGN_KEY, FPGA_GATES_KEY, CAD_STORAGE_KEY, CONNECTIONS_KEY, 'bw-cp1-workspace', LOGIKUS_STORAGE_KEY, 'bw-cardiac-workspace'];
// The old per-widget prefix stays on the allowlist so a file saved while it
// was documented (nothing ever wrote such keys, but a hand-built bundle
// might) still restores; the panel itself serializes to ONE key above.
const KEY_PREFIXES = ['bw-ctl-widget-'];

const isContentKey = key =>
    EXACT_KEYS.indexOf(key) !== -1 || KEY_PREFIXES.some(p => key.startsWith(p));

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

const decodeSection = (name, value) => {
    if (!isRecord(value)) throw new Error(`${name} must be an object`);
    const limit = SECTION_LIMITS[name];
    if (limit && utf8Size(JSON.stringify(value)) > limit) {
        throw new Error(`${name} exceeds ${limit} bytes`);
    }
    if (name === 'code' && (typeof value.lang !== 'string' || typeof value.code !== 'string')) {
        throw new Error('code must contain string lang and code');
    }
    if (name === 'circuit' && !Array.isArray(value.parts)) {
        throw new Error('circuit must contain a parts array');
    }
    if (name === 'controller' && !Array.isArray(value.widgets)) {
        throw new Error('controller must contain a widgets array');
    }
    if (name === 'spikeArena') return sandboxWorld(value);
    if (name === 'logikus') return validateLogikusWorkspace(value);
    if (name === 'cardiac') {
        const result = validateCardiacWorkspace(value);
        if (!result.ok) throw new Error(result.errors.map(item => item.message).join('; '));
        return result.project;
    }
    if (name === 'cp1') {
        const result = validateCp1Workspace(value);
        if (!result.ok) throw new Error(result.errors.map(item => item.message).join('; '));
        return result.project;
    }
    // The Sim Lab model (LDraw text, bw-sim/model/sim-lab-persist.js).
    if (name === 'simLab') return simLabRecord(value);
    if (name === 'cadCircuit') return validateConnections(value);
    if (name === 'fpga') {
        const {design, gates} = value;
        if (design !== undefined && (!isRecord(design) || (design.hdl !== undefined && typeof design.hdl !== 'string') ||
            (design.text !== undefined && typeof design.text !== 'string'))) {
            throw new Error('fpga design must contain string hdl and text');
        }
        if (gates !== undefined && !isRecord(gates)) throw new Error('fpga gates must be an object');
        return {...(design !== undefined && {design}), ...(gates !== undefined && {gates})};
    }
    return value;
};

const decodeStored = (name, value) => {
    if (typeof value !== 'string') throw new Error(`${name} storage value must be a string`);
    return decodeSection(name, JSON.parse(value));
};

/** Convert allowlisted storage strings into the typed v2 state. */
const encodeProjectState = raw => {
    const state = {};
    if (raw[LOGIKUS_STORAGE_KEY] !== undefined) state.logikus = decodeStored('logikus', raw[LOGIKUS_STORAGE_KEY]);
    if (raw['bw-cardiac-workspace'] !== undefined) state.cardiac = decodeStored('cardiac', raw['bw-cardiac-workspace']);
    if (raw['bw-cp1-workspace'] !== undefined) state.cp1 = decodeStored('cp1', raw['bw-cp1-workspace']);
    if (raw[CONNECTIONS_KEY] !== undefined) state.cadCircuit = decodeStored('cadCircuit', raw[CONNECTIONS_KEY]);
    if (raw[SANDBOX_STORAGE_KEY] !== undefined) state.spikeArena = decodeStored('spikeArena', raw[SANDBOX_STORAGE_KEY]);
    if (raw['bw-code-autosave'] !== undefined) {
        state.code = decodeStored('code', raw['bw-code-autosave']);
    }
    if (raw['bw-circuit-autosave'] !== undefined) {
        state.circuit = decodeStored('circuit', raw['bw-circuit-autosave']);
    }
    if (raw['bw-ctl-widgets'] !== undefined) {
        state.controller = decodeStored('controller', raw['bw-ctl-widgets']);
    }
    if (raw[SIM_LAB_STORAGE_KEY] !== undefined) state.simLab = decodeStored('simLab', raw[SIM_LAB_STORAGE_KEY]);
    if (raw[FPGA_DESIGN_KEY] !== undefined || raw[FPGA_GATES_KEY] !== undefined) {
        const parse = key => (raw[key] === undefined ? undefined : JSON.parse(raw[key]));
        state.fpga = decodeSection('fpga', {design: parse(FPGA_DESIGN_KEY), gates: parse(FPGA_GATES_KEY)});
    }
    const legacyWidgets = Object.fromEntries(Object.entries(raw)
        .filter(([key, value]) => KEY_PREFIXES.some(prefix => key.startsWith(prefix)) &&
            typeof value === 'string'));
    if (Object.keys(legacyWidgets).length) state.legacyWidgets = legacyWidgets;
    return state;
};

/** Convert a typed v2 state into the exact storage records consumed by mounted tabs. */
const decodeProjectState = state => {
    if (!isRecord(state)) throw new Error('state must be an object');
    const raw = {};
    if (state.logikus !== undefined) raw[LOGIKUS_STORAGE_KEY] = JSON.stringify(decodeSection('logikus', state.logikus));
    if (state.cardiac !== undefined) raw['bw-cardiac-workspace'] = JSON.stringify(decodeSection('cardiac', state.cardiac));
    if (state.cp1 !== undefined) raw['bw-cp1-workspace'] = JSON.stringify(decodeSection('cp1', state.cp1));
    if (state.cadCircuit !== undefined) raw[CONNECTIONS_KEY] = JSON.stringify(decodeSection('cadCircuit', state.cadCircuit));
    if (state.spikeArena !== undefined) raw[SANDBOX_STORAGE_KEY] = JSON.stringify(decodeSection('spikeArena', state.spikeArena));
    if (state.code !== undefined) raw['bw-code-autosave'] = JSON.stringify(decodeSection('code', state.code));
    if (state.circuit !== undefined) {
        raw['bw-circuit-autosave'] = JSON.stringify(decodeSection('circuit', state.circuit));
    }
    if (state.controller !== undefined) {
        raw['bw-ctl-widgets'] = JSON.stringify(decodeSection('controller', state.controller));
    }
    if (state.simLab !== undefined) raw[SIM_LAB_STORAGE_KEY] = JSON.stringify(decodeSection('simLab', state.simLab));
    if (state.fpga !== undefined) {
        const fpga = decodeSection('fpga', state.fpga);
        if (fpga.design) raw[FPGA_DESIGN_KEY] = JSON.stringify(fpga.design);
        if (fpga.gates) raw[FPGA_GATES_KEY] = JSON.stringify(fpga.gates);
    }
    if (state.legacyWidgets !== undefined) {
        if (!isRecord(state.legacyWidgets)) throw new Error('legacyWidgets must be an object');
        for (const [key, value] of Object.entries(state.legacyWidgets)) {
            if (!KEY_PREFIXES.some(prefix => key.startsWith(prefix)) || typeof value !== 'string') {
                throw new Error(`invalid legacy widget ${key}`);
            }
            raw[key] = value;
        }
    }
    return raw;
};

const migrateV1 = doc => {
    if (!isRecord(doc.state)) throw new Error('v1 state must be an object');
    const raw = {};
    for (const [key, value] of Object.entries(doc.state)) {
        if (!isContentKey(key)) continue;
        if (typeof value !== 'string') throw new Error(`${key} must be a string`);
        raw[key] = value;
    }
    // Validate every recognized section before returning any of it.
    return decodeProjectState(encodeProjectState(raw));
};

/** Pure parser: classify and normalize before anything touches localStorage. */
const parseBundleDocument = text => {
    if (typeof text !== 'string' || utf8Size(text) > MAX_BUNDLE_BYTES) {
        return {outcome: 'invalid', reason: `bundle exceeds ${MAX_BUNDLE_BYTES} bytes`,
            report: {action: 'refused', supportedVersion: BUNDLE_VERSION}};
    }
    let doc;
    try { doc = JSON.parse(text); } catch (error) {
        return {outcome: 'invalid', reason: `invalid JSON: ${error.message}`,
            report: {action: 'refused', supportedVersion: BUNDLE_VERSION}};
    }
    if (!isRecord(doc)) return {outcome: 'invalid', reason: 'document must be an object'};
    const version = doc.version === undefined ? 1 : doc.version;
    if (!Number.isInteger(version) || version < 1) {
        return {outcome: 'invalid', reason: 'version must be a positive integer'};
    }
    if (version > BUNDLE_VERSION) return {outcome: 'future', version, passthrough: doc,
        passthroughText: text,
        report: {action: 'preserved-not-applied', version, supportedVersion: BUNDLE_VERSION}};
    try {
        if (version === 1) return {outcome: 'loaded', version, state: migrateV1(doc),
            report: {action: 'migrated-and-applied', version, supportedVersion: BUNDLE_VERSION}};
        if (doc.format !== BUNDLE_FORMAT) {
            return {outcome: 'invalid', version, reason: `format must be ${BUNDLE_FORMAT}`};
        }
        const state = decodeProjectState(doc.state);
        const unknownSections = Object.fromEntries(Object.entries(doc.state)
            .filter(([key]) => !KNOWN_SECTIONS.includes(key)));
        return {outcome: 'loaded', version, state, passthrough: doc, unknownSections,
            report: {action: 'applied', version, supportedVersion: BUNDLE_VERSION,
                unknownSections: Object.keys(unknownSections)}};
    } catch (error) {
        return {outcome: 'invalid', version, reason: error.message};
    }
};

const contentSnapshot = storage => {
    const snapshot = {};
    for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && isContentKey(key)) snapshot[key] = storage.getItem(key);
    }
    return snapshot;
};

const writeSnapshot = (storage, state) => {
    for (const key of Object.keys(contentSnapshot(storage))) storage.removeItem(key);
    for (const [key, value] of Object.entries(state)) storage.setItem(key, value);
};

/** Replace the project namespace as one transaction, restoring it on any failure. */
const replaceProjectState = (storage, next) => {
    const previous = contentSnapshot(storage);
    try {
        writeSnapshot(storage, next);
        return {outcome: 'loaded', keys: Object.keys(next).length, previous};
    } catch (error) {
        try {
            writeSnapshot(storage, previous);
            return {outcome: 'storage-failed', keys: 0, rolledBack: true, reason: error.message, errorName: error.name};
        } catch (rollbackError) {
            return {outcome: 'storage-failed', keys: 0, rolledBack: false,
                reason: error.message, rollbackReason: rollbackError.message};
        }
    }
};

/** Inspect the archive and normalize its sidecar without mutating browser state. */
const inspectBrickwrightState = async buffer => {
    try {
        const JSZip = await loadJSZip();
        const zip = await JSZip.loadAsync(buffer);
        const cadEntry = zip.file(CAD_PROJECT_PATH);
        if (cadEntry?._data?.uncompressedSize > CAD_PROJECT_LIMIT) throw new Error('CAD project exceeds 16 MiB');
        const cadText = cadEntry ? inspectCadText(await cadEntry.async('text')) : null;
        const cadState = cadText === null ? {} : {[CAD_STORAGE_KEY]: cadText};
        const entry = zip.file(BUNDLE_PATH);
        if (!entry) {
            return {outcome: 'legacy', version: 0, state: cadState, found: Boolean(cadText),
                report: {action: 'cleared', supportedVersion: BUNDLE_VERSION}};
        }
        if (entry._data?.uncompressedSize > MAX_BUNDLE_BYTES) {
            return {outcome: 'invalid', keys: 0, found: false,
                reason: `bundle exceeds ${MAX_BUNDLE_BYTES} bytes`,
                report: {action: 'refused', supportedVersion: BUNDLE_VERSION}};
        }
        const parsed = parseBundleDocument(await entry.async('text'));
        return {...parsed, state: parsed.state ? {...parsed.state, ...cadState} : parsed.state, cadText, found: parsed.outcome === 'loaded', keys: 0};
    } catch (error) {
        return {outcome: 'invalid', found: false, keys: 0, reason: error.message,
            report: {action: 'refused', supportedVersion: BUNDLE_VERSION}};
    }
};

/** Apply one already-inspected compatible sidecar and retain rollback material. */
const applyBrickwrightInspection = (inspection, storage = localStorage) => {
    if (inspection.outcome !== 'loaded' && inspection.outcome !== 'legacy') return inspection;
    const previousPreserved = preservedBundle;
    const previousSimLabRefusal = simLabSaveFailure();
    const previousCadText = getLiveCadText();
    const previousCadGeneration = getCadProjectGeneration();
    const previousLogikusWorkspace = getLiveLogikusWorkspace();
    const previousLogikusGeneration = getLogikusGeneration();
    let result = replaceProjectState(storage, inspection.state || {});
    let sessionCad;
    if (result.outcome === 'storage-failed' && result.rolledBack &&
        ['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED'].includes(result.errorName) &&
        typeof inspection.state?.[CAD_STORAGE_KEY] === 'string') {
        // CAD supports 16 MiB; localStorage often supports only 5 MiB for the
        // entire origin. Keep the exact CAD sidecar live for SB3/IndexedDB
        // autosaves while committing the smaller editor state transactionally.
        const {[CAD_STORAGE_KEY]: cad, ...smallState} = inspection.state;
        result = replaceProjectState(storage, smallState);
        if (result.outcome === 'loaded') sessionCad = cad;
    }
    if (result.outcome !== 'loaded') return {...result, report: inspection.report};
    // Retire the previous circuit before controller teardown can emit input
    // events. The host adopts this generation on the bundle-loaded event.
    setLiveLogikusWorkspace(undefined);
    setLogikusGeneration(previousLogikusGeneration + 1);
    clearSimLabSaveFailure();
    setLiveCadText(undefined);
    if (sessionCad !== undefined) setLiveCadText(sessionCad);
    preservedBundle = inspection.outcome === 'loaded' && inspection.version === BUNDLE_VERSION ?
        {outcome: 'loaded', document: inspection.passthrough} : null;
    return {...result, storageMode: sessionCad === undefined ? 'persistent' : 'session-cad', outcome: inspection.outcome, version: inspection.version,
        found: inspection.outcome === 'loaded', report: inspection.report, previousPreserved, previousSimLabRefusal, previousCadText, previousCadGeneration,
        previousLogikusWorkspace, previousLogikusGeneration};
};

/** Restore auxiliary state when the Scratch half fails after a successful apply. */
const rollbackBrickwrightInspection = (applied, storage = localStorage) => {
    if (!applied || !isRecord(applied.previous)) {
        return {outcome: 'storage-failed', rolledBack: false, reason: 'rollback snapshot missing'};
    }
    const restored = replaceProjectState(storage, applied.previous);
    if (restored.outcome === 'loaded') {
        preservedBundle = applied.previousPreserved || null;
        setLiveCadText(applied.previousCadText);
        setCadProjectGeneration(applied.previousCadGeneration ?? getCadProjectGeneration());
        setLiveLogikusWorkspace(applied.previousLogikusWorkspace);
        setLogikusGeneration(applied.previousLogikusGeneration ?? getLogikusGeneration());
        if (applied.previousSimLabRefusal) refuseSimLabSave(applied.previousSimLabRefusal);
        else clearSimLabSaveFailure();
    }
    return {...restored, rolledBack: restored.outcome === 'loaded'};
};

/** Read the content keys out of localStorage. Returns {} when unavailable. */
const collectState = () => {
    const out = {};
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && isContentKey(key)) out[key] = localStorage.getItem(key);
        }
    } catch (e) {
        // Private mode, or storage disabled. An empty bundle is correct here:
        // there is nothing to carry, and refusing to save would be worse.
    }
    const cad = readCadText();
    if (cad !== null) out[CAD_STORAGE_KEY] = cad;
    else delete out[CAD_STORAGE_KEY];
    const logikus = getLiveLogikusWorkspace();
    if (logikus === null) delete out[LOGIKUS_STORAGE_KEY];
    else if (logikus !== undefined) out[LOGIKUS_STORAGE_KEY] = JSON.stringify(logikus);
    return out;
};

const loadJSZip = async () => {
    const mod = await import('jszip');
    return mod.default || mod;
};

/**
 * Add the Brickwright bundle to a freshly serialized .sb3 blob.
 *
 * Returns the ORIGINAL blob unchanged if there is nothing to add or if the
 * repack fails — saving the Scratch half is strictly better than saving
 * nothing. Explicit live-tab history refusals and the bundle byte cap reject
 * the save so stale or unreadable content cannot look like a successful export.
 *
 * @param {Blob} blob - the .sb3 produced by vm.saveProjectSb3()
 * @param {object} options - injectable clock for deterministic archive tests
 * @returns {Promise<Blob>} the blob to hand to the download
 */
const attachBrickwrightState = async (blob, {now = () => new Date(), mutateZip = null} = {}) => {
    // Save-what-you-SEE, not what the debounced autosaves last wrote: the
    // circuit autosave only updates on an EDIT, so a loaded-but-untouched
    // example saved the PREVIOUS bench (measured: the screen showed the
    // 27-part calculator while the file carried the 4-part demo). Ask the
    // live tabs to flush their current state synchronously before reading.
    // Widgets never persisted at all until this event existed — the panel
    // lives on vm.runtime and its listener writes `bw-ctl-widgets` here.
    const simLabSaveRefusals = [];
    try {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('bw-project-bundle-collect', {detail: {
                refuseSimLabSave: message => simLabSaveRefusals.push(String(message).slice(0, 512))
            }}));
        }
    } catch (e) { /* unrelated listener failures keep the established save behavior */ }
    // An explicit history refusal must not turn the previous stored model into a successful save.
    const pendingSimLabFailure = simLabSaveFailure();
    if (pendingSimLabFailure || simLabSaveRefusals.length) throw new Error(pendingSimLabFailure || simLabSaveRefusals[0]);
    const state = collectState();
    if (state[CAD_STORAGE_KEY]) inspectCadText(state[CAD_STORAGE_KEY]);
    if (Object.keys(state).length === 0 && !preservedBundle && !mutateZip) return blob;
    try {
        const JSZip = await loadJSZip();
        const zip = await JSZip.loadAsync(await blob.arrayBuffer());
        let document;
        if (preservedBundle?.outcome === 'future') {
            zip.file(BUNDLE_PATH, preservedBundle.text);
        } else if (Object.keys(state).length || preservedBundle) {
            const previous = preservedBundle?.outcome === 'loaded' ? preservedBundle.document : {};
            const priorState = isRecord(previous.state) ? previous.state : {};
            const unknown = Object.fromEntries(Object.entries(priorState)
                .filter(([key]) => !KNOWN_SECTIONS.includes(key)));
            document = {...previous, format: BUNDLE_FORMAT, version: BUNDLE_VERSION,
                savedAt: now().toISOString(), state: {...unknown, ...encodeProjectState(state)}};
        }
        if (document) {
            const serialized = JSON.stringify(document);
            if (utf8Size(serialized) > MAX_BUNDLE_BYTES) {
                const error = new Error('Project data is too large to reopen safely. Export recordings as CSV or clear unused project content, then save again.');
                error.code = 'BW_PROJECT_BUNDLE_SIZE';
                throw error;
            }
            zip.file(BUNDLE_PATH, serialized);
        }
        const cadText = preservedBundle?.outcome === 'future' ? preservedBundle.cadText : state[CAD_STORAGE_KEY];
        if (cadText) zip.file(CAD_PROJECT_PATH, inspectCadText(cadText));
        else zip.remove(CAD_PROJECT_PATH);
        if (mutateZip) await mutateZip(zip);
        return await zip.generateAsync({type: 'blob', compression: 'DEFLATE'});
    } catch (e) {
        if (e.code === 'BW_PROJECT_BUNDLE_SIZE') throw e;
        // eslint-disable-next-line no-console
        console.warn('[brickwright] could not attach tab state to the project', e);
        return blob;
    }
};

/**
 * Restore the Brickwright bundle from a loaded .sb3.
 *
 * @param {ArrayBuffer} buffer - the raw file the user opened
 * @returns {Promise<object>} named load outcome and what was restored
 */
const extractBrickwrightState = async buffer => {
    try {
        const inspection = await inspectBrickwrightState(buffer);
        if (inspection.outcome === 'future') {
            preservedBundle = {outcome: 'future', text: inspection.passthroughText, cadText: inspection.cadText};
            return inspection;
        }
        if (inspection.outcome === 'invalid') {
            preservedBundle = null;
            return inspection;
        }
        return applyBrickwrightInspection(inspection);
    } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[brickwright] could not read tab state from the project', e);
        return {outcome: 'invalid', found: false, keys: 0, reason: e.message};
    }
};

export {
    attachBrickwrightState, extractBrickwrightState, inspectBrickwrightState,
    applyBrickwrightInspection, rollbackBrickwrightInspection, parseBundleDocument, replaceProjectState,
    encodeProjectState, decodeProjectState, isContentKey, BUNDLE_PATH, BUNDLE_FORMAT, BUNDLE_VERSION
};
