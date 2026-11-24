/**
 * Editable artwork lives beside, never instead of, Scratch costume assets.
 * Scratch reads project.json and its SVG/PNG assets; it ignores this ZIP entry.
 * A source record is used only when its renderedMd5ext still matches the
 * costume in project.json. This prevents a stale source from silently replacing
 * artwork edited by Scratch or an older Brickwright.
 */
import {animationResourceFromDocument} from './bw-animation-resources.js';
import {editablePixelSize, pixelDocumentWithinBudget} from './bw-makecode/pixel-image.js';

const ARTWORK_PATH = 'brickwright/artwork/v1.json';
const ARTWORK_FORMAT = 'brickwright-artwork';
const ARTWORK_VERSION = 9;
const MAX_ARTWORK_BYTES = 64 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 16 * 1024 * 1024;

let documents = new WeakMap();
let costumeSourceIds = new WeakMap();
let preservedFuture = null;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validCostumeSourceId = value => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value);
const getCostumeSourceId = costume => costume && costumeSourceIds.get(costume);
const setCostumeSourceId = (costume, id) => {
    const previous = getCostumeSourceId(costume);
    if (!costume || !validCostumeSourceId(id) || (previous && previous !== id)) {
        throw new Error('Artwork source identity changed');
    }
    costumeSourceIds.set(costume, id);
};
const proposeCostumeSourceId = costume => {
    if (preservedFuture) throw new Error('This project uses a newer artwork format and cannot store new links here.');
    return getCostumeSourceId(costume) || newAnimationResourceId();
};
const sourceIdentity = costume => {
    const sourceId = getCostumeSourceId(costume);
    return sourceId ? {sourceId} : {};
};
const byteLength = value => new TextEncoder().encode(value).byteLength;
const assetName = costume => costume && (costume.asset?.assetId ?
    `${costume.asset.assetId}.${costume.dataFormat}` : costume.md5ext || costume.md5);
const originals = vm => (vm?.runtime?.targets || []).filter(target => target.isOriginal !== false);
const costumeSignature = project => JSON.stringify((project.targets || []).map(target =>
    [target.isStage, target.name, (target.costumes || []).map(costume => costume.md5ext)]));
const loadZip = async () => {
    const module = await import('jszip');
    return module.default || module;
};

const validateLayers = (layers, expectedSize = null) => {
    if (!Array.isArray(layers) || !layers.length) throw new Error('artwork document must contain layers');
    const ids = new Set();
    let pixelSize = null;
    for (const layer of layers) {
        if (!isObject(layer) || typeof layer.id !== 'string' || !['vector', 'bitmap', 'pixel'].includes(layer.type) ||
            typeof layer.name !== 'string' || typeof layer.visible !== 'boolean' ||
            typeof layer.locked !== 'boolean' || !Number.isFinite(layer.opacity) ||
            layer.opacity < 0 || layer.opacity > 1 || !isObject(layer.content) ||
            !['asset', 'svg', 'data-uri', 'pixels'].includes(layer.content.kind)) {
            throw new Error('invalid artwork layer');
        }
        if (ids.has(layer.id)) throw new Error('duplicate artwork layer');
        ids.add(layer.id);
        if (layer.content.kind === 'pixels') {
            const value = layer.content.value;
            if (layer.type !== 'pixel' || !isObject(value) || !Number.isInteger(value.width) ||
                !editablePixelSize(value.width, value.height) || !Array.isArray(value.pixels) ||
                value.pixels.length !== value.width * value.height ||
                !value.pixels.every(pixel => Number.isInteger(pixel) && pixel >= 0 && pixel <= 15)) {
                throw new Error('invalid pixel source');
            }
            const size = `${value.width}x${value.height}`;
            if ((pixelSize && pixelSize !== size) || (expectedSize && expectedSize !== size)) {
                throw new Error('mismatched pixel layer size');
            }
            pixelSize = size;
        } else if (typeof layer.content.value !== 'string') {
            throw new Error('invalid artwork content');
        }
    }
    return pixelSize;
};

const validateDocument = (doc, maxBytes = MAX_DOCUMENT_BYTES) => {
    if (!isObject(doc) || ![1, 2, 3, 4, 5].includes(doc.version)) {
        throw new Error('artwork document must contain layers');
    }
    if (doc.version === 2 || ([3, 4, 5].includes(doc.version) && Object.prototype.hasOwnProperty.call(doc, 'palette'))) {
        if (!Array.isArray(doc.palette) || doc.palette.length !== 16 || doc.palette[0] !== null ||
            !doc.palette.slice(1).every(colour => /^#[0-9a-f]{6}$/i.test(colour))) {
            throw new Error('invalid artwork palette');
        }
    } else if (doc.version === 1 && Object.prototype.hasOwnProperty.call(doc, 'palette')) {
        throw new Error('palette requires artwork document version 2');
    }
    if (Object.prototype.hasOwnProperty.call(doc, 'pixelScale') && (!Number.isInteger(doc.pixelScale) ||
        doc.pixelScale < 1 || doc.pixelScale > 64)) throw new Error('invalid pixel scale');
    if (!pixelDocumentWithinBudget(doc)) throw new Error('invalid pixel source or artwork pixel budget exceeded');
    const pixelSize = validateLayers(doc.layers);
    if (Object.prototype.hasOwnProperty.call(doc, 'activeLayerId') &&
        !doc.layers.some(layer => layer.id === doc.activeLayerId)) throw new Error('invalid active layer');
    if (byteLength(JSON.stringify(doc)) > maxBytes) throw new Error('artwork document is too large');
    if (doc.animation) {
        if (![3, 4, 5].includes(doc.version) || !pixelSize || !isObject(doc.animation) ||
            !Array.isArray(doc.animation.frames) || doc.animation.frames.length < (doc.version === 5 ? 1 : 2) ||
            doc.animation.frames.length > 64 || typeof doc.animation.activeFrameId !== 'string') {
            throw new Error('invalid artwork animation');
        }
        const resource = doc.animation.resource;
        if (doc.version === 4 || (doc.version === 5 && resource !== undefined)) {
            if (!isObject(resource) || typeof resource.id !== 'string' ||
                !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resource.id) ||
                typeof resource.name !== 'string' || !resource.name.trim() || resource.name.length > 80) {
                throw new Error('invalid animation resource identity');
            }
        } else if (resource !== undefined) throw new Error('animation resources require artwork document version 4');
        const frameIds = new Set();
        for (const frame of doc.animation.frames) {
            if (!isObject(frame) || typeof frame.id !== 'string' || !frame.id || frameIds.has(frame.id) ||
                (Object.prototype.hasOwnProperty.call(frame, 'name') &&
                    (typeof frame.name !== 'string' || !frame.name.trim() || frame.name.length > 80)) ||
                !Number.isInteger(frame.durationMs) || frame.durationMs < (doc.version === 5 ? 1 : 20) || frame.durationMs > (doc.version === 5 ? 65535 : 10000) ||
                typeof frame.activeLayerId !== 'string') throw new Error('invalid artwork frame');
            frameIds.add(frame.id);
            if (!Array.isArray(frame.layers) || !frame.layers.some(layer => layer.id === frame.activeLayerId)) {
                throw new Error('invalid artwork frame layers');
            }
            validateLayers(frame.layers, pixelSize);
            if (!frame.layers.every(layer => layer.type === 'pixel' && layer.content.kind === 'pixels')) {
                throw new Error('animation frames require pixel layers');
            }
        }
        if (!frameIds.has(doc.animation.activeFrameId)) throw new Error('invalid active frame');
        const active = doc.animation.frames.find(frame => frame.id === doc.animation.activeFrameId);
        if (JSON.stringify(active.layers) !== JSON.stringify(doc.layers) ||
            active.activeLayerId !== doc.activeLayerId) throw new Error('active frame differs from costume source');
    } else if ([3, 4, 5].includes(doc.version)) {
        throw new Error(`version ${doc.version} artwork requires animation`);
    }
    return doc;
};

// Versions 1–3 readers cap indexed layers at128×128. Advertise the extended
// bounds at bundle level so those readers preserve the opaque source as future.
// Readers through bundle4 lack published resource bindings, which require bundle5.
// Native timing and single-frame timelines require document5/bundle6; older
// readers preserve this source as opaque future data instead of dropping frames.
const artworkBundleVersion = records => Math.max(1, ...records.map(record => {
    if (record.sourceId) return 9;
    const document = record.document;
    if (document.layers.some(layer => layer.content.kind === 'pixels' &&
        (layer.content.value.width > 160 || layer.content.value.height > 160))) return 8;
    const extended = document.layers.some(layer => layer.content.kind === 'pixels' &&
        (layer.content.value.width > 128 || layer.content.value.height > 128));
    return document.version === 5 ? 6 : document.version === 4 ? 5 : Math.max(document.version, extended ? 4 : 1);
}));

const fromRendered = costume => ({
    version: 1,
    layers: [{id: 'base',
        type: costume.dataFormat === 'svg' ? 'vector' : 'bitmap',
        name: 'Artwork',
        visible: true,
        locked: false,
        opacity: 1,
        content: {kind: 'asset', value: assetName(costume)}}]
});

/**
 * Store a richer document after an editor operation has rendered its Scratch asset.
 * @param {object} costume Scratch costume receiving the source
 * @param {object} document Editable artwork document
 * @returns {void}
 */
const setCostumeDocument = (costume, document) => {
    if (!costume) return;
    // The VM can finish writing the new asset after the editor calls updateSvg.
    // The editor source generated that render, so bind it to the final md5ext at save.
    documents.set(costume, {renderedMd5ext: assetName(costume),
        pendingRender: true,
        document: validateDocument(document, MAX_ARTWORK_BYTES)});
};

/**
 * A legacy editor changed the flattened asset. Its former layered source is now stale.
 * @param {object} costume Scratch costume whose source must be invalidated
 * @returns {void}
 */
const resetCostumeDocument = (costume, vm = null) => {
    if (costume) documents.delete(costume);
    if (vm) refreshAnimationResources(vm);
};

/**
 * Preserve source when Scratch duplicates a costume into a new object.
 * @param {object} original Original costume
 * @param {object} copy Newly created costume
 * @returns {void}
 */
const copyCostumeDocument = (original, copy, vm = null) => {
    if (!original || !copy) return;
    const record = documents.get(original);
    if (!record || (!record.pendingRender && record.renderedMd5ext !== assetName(original))) return;
    const document = JSON.parse(JSON.stringify(record.document));
    if (document.animation?.resource) document.animation.resource.id = newAnimationResourceId();
    documents.set(copy, {renderedMd5ext: assetName(copy), pendingRender: record.pendingRender, document});
    if (vm) refreshAnimationResources(vm);
};

const getCostumeDocument = costume => {
    const record = costume && documents.get(costume);
    if (record && (record.pendingRender || record.renderedMd5ext === assetName(costume))) return record.document;
    return costume ? fromRendered(costume) : null;
};

/** Preserve source across sprite Undo, whose ZIP roundtrip creates new costume objects. */
const captureTargetArtwork = target => (target?.sprite?.costumes || []).map(costume => ({
    renderedMd5ext: assetName(costume),
    ...sourceIdentity(costume),
    document: JSON.parse(JSON.stringify(getCostumeDocument(costume)))
}));

const restoreTargetArtwork = (target, snapshots, vm, {renewResourceIds = false} = {}) => {
    if (!originals(vm).includes(target)) throw new Error('Artwork restore target is no longer in this project');
    const costumes = target.sprite?.costumes || [];
    if (costumes.length !== snapshots.length) throw new Error('Artwork restore costume count differs');
    // Validate all bindings before attaching any source. Identical assets at
    // different positions can carry different editable documents.
    const restored = snapshots.map((snapshot, index) => {
        if (assetName(costumes[index]) !== snapshot.renderedMd5ext) {
            throw new Error('Artwork restore costume asset differs');
        }
        const document = JSON.parse(JSON.stringify(snapshot.document));
        if (renewResourceIds && document.animation?.resource) document.animation.resource.id = newAnimationResourceId();
        return {renderedMd5ext: snapshot.renderedMd5ext, document: validateDocument(document),
            ...(!renewResourceIds && validCostumeSourceId(snapshot.sourceId) ? {sourceId: snapshot.sourceId} : {})};
    });
    const previous = costumes.map(costume => documents.get(costume));
    costumes.forEach((costume, index) => documents.set(costume, restored[index]));
    try { syncAnimationResources(vm); }
    catch (error) {
        costumes.forEach((costume, index) => {
            if (previous[index]) documents.set(costume, previous[index]);
            else documents.delete(costume);
        });
        throw error;
    }
    costumes.forEach((costume, index) => {
        const id = restored[index].sourceId;
        if (id) costumeSourceIds.set(costume, id);
    });
};

/** Stable publication identity; independent of costume hashes, names and positions. */
const newAnimationResourceId = () => {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    if (!globalThis.crypto?.getRandomValues) throw new Error('Animation publication requires secure random identifiers');
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

/** Build first, then publish: invalid in-place edits cannot replace a valid registry. */
const syncAnimationResources = (vm, {costume: proposedCostume, document: proposedDocument, validateOnly = false} = {}) => {
    const resources = new Map();
    for (const target of originals(vm)) for (const costume of target.sprite?.costumes || []) {
        const document = costume === proposedCostume ? proposedDocument : getCostumeDocument(costume);
        if (!document?.animation?.resource) continue;
        validateDocument(document);
        const resource = animationResourceFromDocument(document);
        if (resources.has(resource.id)) throw new Error(`Duplicate animation resource ID: ${resource.id}`);
        resource.source = {targetId: target.id, targetName: target.getName?.() || target.sprite?.name,
            costumeName: costume.name};
        resources.set(resource.id, resource);
    }
    if (!validateOnly && vm?.runtime) vm.runtime.bwArcadeAnimationResources = resources;
    return resources;
};

// Replacement/removal cannot leave references to resources that no longer exist.
const refreshAnimationResources = vm => {
    try { syncAnimationResources(vm); return null; }
    catch (error) {
        if (vm?.runtime) vm.runtime.bwArcadeAnimationResources = new Map();
        vm?.runtime?.emit?.('BLOCKS_ERROR', error.message);
        return error.message;
    }
};

/**
 * Read-only preflight: malformed source must not stop an otherwise valid SB3 opening.
 * @param {ArrayBuffer} input Raw SB3 bytes
 * @returns {Promise<object>} Validated source records or a named failure
 */
const inspectArtwork = async input => {
    try {
        const JSZip = await loadZip();
        const zip = await JSZip.loadAsync(input);
        const entry = zip.file(ARTWORK_PATH);
        if (!entry) return {outcome: 'legacy', records: []};
        if (entry._data?.uncompressedSize > MAX_ARTWORK_BYTES) throw new Error('artwork bundle is too large');
        const raw = await entry.async('text');
        if (byteLength(raw) > MAX_ARTWORK_BYTES) throw new Error('artwork bundle is too large');
        const payload = JSON.parse(raw);
        if (!isObject(payload) || payload.format !== ARTWORK_FORMAT ||
            !Number.isInteger(payload.version) || payload.version < 1 ||
            !Array.isArray(payload.costumes)) throw new Error('invalid artwork bundle');
        const project = JSON.parse(await zip.file('project.json').async('text'));
        if (payload.version > ARTWORK_VERSION) {
            return {outcome: 'future', records: [], raw, signature: costumeSignature(project)};
        }
        const libraryInfo = payload.libraries === undefined ? {} :
            (await import('./bw-asset-library.js')).inspectAssetLibraries(project, payload);
        const records = [];
        const identityCounts = new Map();
        let inflatedLayerBytes = 0;
        for (const record of payload.costumes) {
            if (!isObject(record) || !Number.isInteger(record.targetIndex) ||
                !Number.isInteger(record.costumeIndex) || typeof record.renderedMd5ext !== 'string') {
                throw new Error('invalid artwork reference');
            }
            const costume = project.targets?.[record.targetIndex]?.costumes?.[record.costumeIndex];
            if (!costume || costume.md5ext !== record.renderedMd5ext) continue;
            validateDocument(record.document);
            if (artworkBundleVersion([{document: record.document}]) > payload.version || (record.document.version === 5 && payload.version < 6)) {
                throw new Error('artwork document exceeds bundle version');
            }
            // Every asset reference must point to the matching render or another ZIP asset.
            for (const layer of record.document.layers) {
                if (layer.content.kind === 'asset' && !zip.file(layer.content.value)) {
                    throw new Error(`missing artwork asset ${layer.content.value}`);
                }
                if (layer.type === 'bitmap' && layer.content.kind === 'asset' &&
                    layer.content.value.startsWith('brickwright/layers/')) {
                    const asset = zip.file(layer.content.value);
                    inflatedLayerBytes += asset._data?.uncompressedSize || 0;
                    if (inflatedLayerBytes > MAX_ARTWORK_BYTES) throw new Error('bitmap layers are too large');
                    layer.content = {kind: 'data-uri', value: `data:image/png;base64,${await asset.async('base64')}`};
                }
            }
            if (payload.version >= 9 && validCostumeSourceId(record.sourceId)) {
                identityCounts.set(record.sourceId, (identityCounts.get(record.sourceId) || 0) + 1);
            } else delete record.sourceId;
            records.push(record);
        }
        // Ambiguous bindings leave sketches intact and available as independent CAD geometry.
        for (const record of records) if (identityCounts.get(record.sourceId) > 1) delete record.sourceId;
        return {outcome: 'loaded', records, ...libraryInfo};
    } catch (error) {
        return {outcome: 'invalid', records: [], reason: error.message};
    }
};

/**
 * Call only after vm.loadProject succeeds; no source crosses a project boundary.
 * @param {object} inspection Preflight result
 * @param {object} vm Loaded Scratch VM
 * @returns {object} Number of source documents restored
 */
const applyArtwork = (inspection, vm) => {
    documents = new WeakMap();
    costumeSourceIds = new WeakMap();
    if (vm?.runtime) vm.runtime.bwArcadeAnimationResources = new Map();
    preservedFuture = inspection?.outcome === 'future' ?
        {raw: inspection.raw, signature: inspection.signature} : null;
    for (const target of originals(vm)) delete target.bwAssetLibrary;
    if (inspection?.outcome !== 'loaded') return {outcome: inspection?.outcome || 'legacy', count: 0};
    const targets = originals(vm);
    inspection.applyLibraries?.(targets);
    let count = 0;
    for (const record of inspection.records) {
        const costume = targets[record.targetIndex]?.sprite?.costumes?.[record.costumeIndex];
        if (assetName(costume) !== record.renderedMd5ext) continue;
        documents.set(costume, {renderedMd5ext: record.renderedMd5ext, document: record.document});
        if (record.sourceId) setCostumeSourceId(costume, record.sourceId);
        count++;
    }
    const resourceError = refreshAnimationResources(vm);
    if (inspection.libraries?.length) vm.emitTargetsUpdate?.();
    return {outcome: 'loaded', count, ...(resourceError ? {resourceError} : {})};
};

/**
 * Write artwork into an already-open SB3 ZIP, sharing its compression pass.
 * @param {object} zip Loaded JSZip archive
 * @param {object} vm Loaded Scratch VM
 * @returns {Promise<boolean>} Whether the entry was written
 */
const writeArtworkToZip = async (zip, vm) => {
    try {
        const project = JSON.parse(await zip.file('project.json').async('text'));
        if (preservedFuture && preservedFuture.signature === costumeSignature(project)) {
            zip.file(ARTWORK_PATH, preservedFuture.raw);
            return true;
        }
        const targets = originals(vm);
        const costumes = [];
        for (let targetIndex = 0; targetIndex < project.targets.length; targetIndex++) {
            const target = project.targets[targetIndex];
            const liveTarget = targets[targetIndex];
            for (let costumeIndex = 0; costumeIndex < (target.costumes || []).length; costumeIndex++) {
                const saved = target.costumes[costumeIndex];
                const live = liveTarget?.sprite?.costumes?.[costumeIndex];
                if (!saved.md5ext || !zip.file(saved.md5ext)) continue;
                const record = live && assetName(live) === saved.md5ext && documents.get(live);
                const document = JSON.parse(JSON.stringify(record &&
                    (record.pendingRender || record.renderedMd5ext === saved.md5ext) ?
                    record.document : fromRendered(saved)));
                for (let layerIndex = 0; layerIndex < document.layers.length; layerIndex++) {
                    const layer = document.layers[layerIndex];
                    if (layer.type !== 'bitmap' || layer.content.kind !== 'data-uri') continue;
                    const match = /^data:image\/png;base64,([a-z\d+/=]+)$/i.exec(layer.content.value);
                    if (!match) throw new Error('invalid bitmap layer PNG');
                    const bytes = Uint8Array.from(atob(match[1]), character => character.charCodeAt(0));
                    const assetPath = `brickwright/layers/t${targetIndex}-c${costumeIndex}-l${layerIndex}.png`;
                    zip.file(assetPath, bytes);
                    layer.content = {kind: 'asset', value: assetPath};
                }
                costumes.push({targetIndex,
                    costumeIndex,
                    renderedMd5ext: saved.md5ext,
                    ...(liveTarget?.sprite?.name === target.name && live?.name === saved.name &&
                        assetName(live) === saved.md5ext ? sourceIdentity(live) : {}),
                    document: validateDocument(document)});
            }
        }
        const libraries = targets.some(target => target.bwAssetLibrary) ?
            (await import('./bw-asset-library.js')).assetLibraryRecords(vm, project) : [];
        const version = Math.max(libraries.length ? 7 : 1, artworkBundleVersion(costumes));
        zip.file(ARTWORK_PATH, JSON.stringify({format: ARTWORK_FORMAT, version, costumes,
            ...(libraries.length ? {libraries} : {})}));
        return true;
    } catch (error) {
        // A source failure may not turn a valid Scratch project into an unsaveable one.
        // eslint-disable-next-line no-console
        console.warn('[brickwright] could not attach artwork source', error);
        if (originals(vm).some(target => target.bwAssetLibrary)) throw error;
        return false;
    }
};

/**
 * Standalone helper for callers that have not opened the SB3 ZIP already.
 * @param {Blob} blob Scratch VM's SB3
 * @param {object} vm Loaded Scratch VM
 * @returns {Promise<Blob>} SB3 with optional source entry
 */
const attachArtwork = async (blob, vm) => {
    try {
        const JSZip = await loadZip();
        const zip = await JSZip.loadAsync(await blob.arrayBuffer());
        if (!await writeArtworkToZip(zip, vm)) return blob;
        return await zip.generateAsync({type: 'blob', compression: 'DEFLATE'});
    } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('[brickwright] could not repack artwork source', error);
        if (originals(vm).some(target => target.bwAssetLibrary)) throw error;
        return blob;
    }
};

export {ARTWORK_PATH, ARTWORK_FORMAT, ARTWORK_VERSION, inspectArtwork, applyArtwork,
    attachArtwork, writeArtworkToZip, artworkBundleVersion, getCostumeDocument, setCostumeDocument,
    resetCostumeDocument, copyCostumeDocument, captureTargetArtwork, restoreTargetArtwork,
    newAnimationResourceId, getCostumeSourceId, proposeCostumeSourceId, setCostumeSourceId, syncAnimationResources, validateDocument};
