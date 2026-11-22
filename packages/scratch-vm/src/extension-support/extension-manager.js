const dispatch = require('../dispatch/central-dispatch');
const resultFactory = require('../util/bw-extension-result-factory');
const log = require('../util/log');
const maybeFormatMessage = require('../util/maybe-format-message');

const BlockType = require('./block-type');
const {
    GALLERY_EXTENSION_IDS,
    extensionIdForGalleryURL,
    galleryURLForExtensionId,
    galleryURLForProjectEntry,
    pinForURL,
    pinStatusFor,
    verifyGallerySource
} = require('./gallery-integrity');
// The four SPIKE ids that became `spikeprime`.
//
// Inlined rather than imported: the canonical table lives in the GUI
// (scratch-gui/src/lib/spike-legacy-migration.js, which explains why), and
// this overlay is applied INTO scratch-gui's node_modules — so there is no
// path from here to there that survives the build. Four strings is a cheap
// duplication and test/spike-legacy-ids-resolve.test.mjs fails if it drifts
// from the table.
const SPIKE_LEGACY_IDS = ['spikeprimeBTC', 'spikeprimeBridge', 'spikeprimeble', 'legospikeprimeBLE'];
const SPIKE_UNIFIED_ID = 'spikeprime';
// The two EV3 ids that became `ev3comprehensive`, inlined for the same reason
// and held against ev3-legacy-migration.js by test/ev3-legacy-ids-resolve.test.mjs.
// `ev3dev` is NOT here: it runs a different operating system on the brick and
// is still its own extension.
const EV3_LEGACY_IDS = ['ev3lms', 'legoev3direct'];
const EV3_UNIFIED_ID = 'ev3comprehensive';

/**
 * The id an extension request should actually load.
 *
 * A project saved before the five SPIKE extensions became one names an id
 * that no longer exists. The project loader rewrites those ids, but not every
 * path into the manager goes through it — shareBlocksToTarget and direct
 * loadExtensionURL calls do not — so the last word is here. Without it those
 * paths would fall through to the bare-id branch below and log a missing
 * implementation for an extension that is present under another name.
 */
const resolveExtensionId = (id, options = {}) => {
    if (typeof id !== 'string') return id;
    // Only a deliberate gallery selection may load an archived driver. Old
    // projects keep resolving their ids to the unified extension by default.
    if (options.legacySpikeDebug === true && SPIKE_LEGACY_IDS.includes(id)) return id;
    if (SPIKE_LEGACY_IDS.indexOf(id) !== -1) return SPIKE_UNIFIED_ID;
    if (EV3_LEGACY_IDS.indexOf(id) !== -1) return EV3_UNIFIED_ID;
    return id;
};

// Gallery extensions a project names by id (tasks E3, E5).
//
// A project records the extensions it uses as ids (`extensions: ["Encoding"]`,
// opcodes `Encoding_*`) and, when TurboWarp or Lite saved it, an `extensionURLs`
// entry beside each. Without a route a gallery id fell to the "Unknown extension
// id" branch below and every block of the extension stopped working on open.
// Every PINNED gallery id now routes to the gallery's CONTENT-PINNED copy (the
// bytes TurboWarp runs: CrispStrobe/extensions tracks TurboWarp/extensions),
// fetched and hash-checked like any gallery pick, then run in the worker or the
// adapter as its pin says. No copy is bundled here.
//
// The id -> slug map is DATA, not a hand list: each pin's generator-owned
// `extensionId` (gallery-pins.json, read from the pinned source's getInfo() by
// scripts/sync-gallery-pins.mjs). E3's two entries (Encoding, lmsTempVars2) are
// two of its 128 rows. Bundled and lazy built-in ids are matched first in
// loadExtensionURL, so a gallery copy of an extension Lite bundles never
// replaces the bundled one.
//
// The parked WIP (23e9c7f44) bundled two partial clean-room re-implementations
// under E3's ids instead. They were not ported: Encoding offered 2 of the 9
// blocks and Base64 only (the URL mode threw; unpadded input the original
// decodes came back empty), and the temporary variables offered 4 of 13 opcodes
// with 0 where the original reports "" and no reset on green flag / stop.
//
// Held by test/gallery-project-extensions.test.mjs, test/turbowarp-encoding.test.mjs
// and test/turbowarp-tempvars.test.mjs.

// HTTP(S) URLs are candidates for the content-pinned compatibility path. Unpinned URLs are always
// sent to the extension worker; see isTrustedExtensionURL / loadExtensionURL.
const isRemoteExtensionURL = url =>
    typeof url === 'string' && /^https?:\/\//.test(url);

// These extensions are currently built into the VM repository but should not be loaded at startup.
// TODO: move these out into a separate repository?
// TODO: change extension spec so that library info, including extension ID, can be collected through static methods

// Built-in extensions the VM instantiates synchronously. Everything here is small
// or is what the lessons' hardware flows reach for first (stc12, circuit,
// controller, devices), so it stays in the first load.
const builtinExtensions = {
    arrays: () => require('../extensions/crispstrobe/arrays'),
    // The pin blocks sb3-creator has always emitted for hardware projects. Without
    // this line every one of them failed to load with "Unknown extension: stc12".
    // sb3-creator's bitwise reporters (bitand/bitor/.../shiftright). Without
    // this line the id fell to the SANDBOXED loader: importScripts('bitops')
    // 404'd and the blocks were dropped (gallery sweep, 2026-08-10).
    bitops: () => require('../extensions/crispstrobe/bitops'),
    microbitplus: () => require('../extensions/crispstrobe/microbitplus'),
    stc12: () => require('../extensions/crispstrobe/stc12'),
    stc12live: () => require('../extensions/crispstrobe/stc12live'),
    // Lite-native generic GPIO pins: `set pin N to V` / `read pin N`, driving the
    // Widgets pane's GPIO strip (bw-fpga-leds/output) and round-tripping with the
    // DOS Forth bench's pin!/pin@ words through the Code tab. LITE_ONLY (no
    // upstream file); classified in scripts/spike/bundled-upstream.mjs.
    bwgpio: () => require('../extensions/crispstrobe/bwgpio'),
    circuit: () => require('../extensions/crispstrobe/circuit'),
    // Vendored from the bw-board PACKAGE, not from CrispStrobe/extensions —
    // bw-board ships this extension and Lite had carried a five-block copy of
    // its fourteen, so the panel offered lcd, oled, simplevga, keyboard,
    // bargraph and rgb widgets that no block could drive. The path is
    // unchanged because only the bundle's contents moved; see MAP in
    // scripts/spike/bundled-upstream.mjs.
    controller: () => require('../extensions/crispstrobe/controller'),
    // Device convenience blocks: servo, motor, relay, sensors, LCD, NeoPixel.
    // 7 stubs (showdigit, setrgb, setpixel, clearmatrix, devicestate, ircode,
    // whenirreceived) are hidden from the palette; methods remain so saved
    // projects load.  NeoPixel hidden on 12T, servo/motor hidden on STC89 (no PCA).
    devices: () => require('../extensions/crispstrobe/devices'),
    brickwrightTTS: () => require('../extensions/crispstrobe/text2speech'),
    csp: () => require('../extensions/crispstrobe/csp'),
    // This is an example that isn't loaded with the other core blocks,
    // but serves as a reference for loading core blocks as extensions.
    coreExample: () => require('../blocks/scratch3_core_example'),
    pen: () => require('../extensions/scratch3_pen'),
    makeymakey: () => require('../extensions/scratch3_makeymakey')
};

// Built-in extensions that are LOADED ON DEMAND. Each `import()` is its own
// webpack chunk, so none of this code — nor the sound samples and hub drivers it
// carries — is in the first load. Measured on the 2026-09-05 production build:
// the music extension's 61 samples were 1.46 MB compressed of the 3.5 MB boot
// vendor chunk, the LEGO hub drivers roughly another 0.4 MB, and none of it is
// needed until a project or the extension library asks for it.
//
// `loadExtensionURL` resolves these asynchronously — the same promise the GUI's
// extension library and the project loader already wait on. The ids are the
// same as before; only WHEN the code arrives changed. `scripts/verify-boot-payload.mjs`
// fails the build if any of this lands back in an eagerly-loaded script.
//
// Our own extensions, hard-bundled (permissive, offline). Kept in the gallery
// repo too; the bundledIds dedup removes the gallery copy from the picker.
// Specifiers name `index.js` explicitly: the unit suite boots this VM in Node,
// where `import()` follows ES-module resolution even from CommonJS, and that
// has no directory imports. webpack is indifferent.
const lazyBuiltinExtensions = {
    // This board belongs to CPX projects and its dock, not the initial editor.
    circuitplayground: () => import(/* webpackChunkName: "ext-circuitplayground" */ '../extensions/crispstrobe/circuitplayground/index.js'),
    // The Arcade runtime (task E1) carries MakeCode's speech fonts (font12 alone is
    // ~137 KiB gzipped) and sprite/image engines: needed only by an Arcade project.
    arcade: () => import(/* webpackChunkName: "ext-arcade" */ '../extensions/crispstrobe/arcade/index.js'),
    // Lite-native Robot Lab blocks: every block one call of runtime.robotLab, the API the
    // Robot Lab pane installs (gui lib/bw-sim/api/robot-lab-api.js). LITE_ONLY, classified in
    // scripts/spike/bundled-upstream.mjs. Lazy: only a Robot Lab project needs them, and eager
    // they pushed the 8086 benchmark's initial JS over its budget (PR #1097).
    cadlab: () => import(/* webpackChunkName: "ext-cadlab" */ '../extensions/crispstrobe/cadlab/index.js'),
    // CAD shapes: nesting 3D modelling blocks compiled by Brickwright CAD (gui lib/bw-cad-blocks.js). Lazy, like cadlab.
    cadshapes: () => import(/* webpackChunkName: "ext-cadshapes" */ '../extensions/crispstrobe/cadshapes/index.js'),
    robotlab: () => import(/* webpackChunkName: "ext-robotlab" */ '../extensions/crispstrobe/robotlab/index.js'),
    planetemaths: () => import(/* webpackChunkName: "ext-planetemaths" */ '../extensions/crispstrobe/planetemaths/index.js'),
    legopoweredup: () => import(/* webpackChunkName: "ext-legopoweredup" */ '../extensions/crispstrobe/legopoweredup/index.js'),
    legoboostunified: () => import(/* webpackChunkName: "ext-legoboostunified" */ '../extensions/crispstrobe/legoboostunified/index.js'),
    wedo2unified: () => import(/* webpackChunkName: "ext-wedo2unified" */ '../extensions/crispstrobe/wedo2unified/index.js'),
    // One SPIKE extension. spikeprimeble, spikeprimeBTC, spikeprimeBridge and
    // legospikeprimeBLE used to sit beside this line; they were the same hub
    // reached four ways, and they now resolve here through SPIKE_LEGACY_IDS.
    // See extension-support/spike-legacy-migration.js.
    spikeprime: () => import(/* webpackChunkName: "ext-spikeprime" */ '../extensions/crispstrobe/spikeprime/index.js'),
    spikeprimeBTC: () => import(/* webpackChunkName: "ext-spikeprimeBTC" */ '../extensions/crispstrobe/spikeprimeBTC/index.js'),
    spikeprimeBridge: () => import(/* webpackChunkName: "ext-spikeprimeBridge" */ '../extensions/crispstrobe/spikeprimeBridge/index.js'),
    spikeprimeble: () => import(/* webpackChunkName: "ext-spikeprimeble" */ '../extensions/crispstrobe/spikeprimeble/index.js'),
    legospikeprimeBLE: () => import(/* webpackChunkName: "ext-legospikeprimeBLE" */ '../extensions/crispstrobe/legospikeprimeBLE/index.js'),
    // One EV3 extension for the stock LEGO firmware. legoev3direct and ev3lms
    // used to sit beside this line; they were the same brick reached with the
    // same protocol, split across a block surface, a working live
    // implementation and a compiler, and they now resolve here through
    // EV3_LEGACY_IDS. ev3dev below is deliberately separate — different OS.
    ev3comprehensive: () => import(/* webpackChunkName: "ext-ev3comprehensive" */ '../extensions/crispstrobe/ev3comprehensive/index.js'),
    legorcx: () => import(/* webpackChunkName: "ext-legorcx" */ '../extensions/crispstrobe/legorcx/index.js'),
    legonxt: () => import(/* webpackChunkName: "ext-legonxt" */ '../extensions/crispstrobe/legonxt/index.js'),
    ev3dev: () => import(/* webpackChunkName: "ext-ev3dev" */ '../extensions/crispstrobe/ev3dev/index.js'),
    universalgamepad: () => import(/* webpackChunkName: "ext-universalgamepad" */ '../extensions/crispstrobe/universalgamepad/index.js'),
    // These are the non-core built-in extensions.
    wedo2: () => import(/* webpackChunkName: "ext-wedo2" */ '../extensions/scratch3_wedo2/index.js'),
    music: () => import(/* webpackChunkName: "ext-music" */ '../extensions/scratch3_music/index.js'),
    microbit: () => import(/* webpackChunkName: "ext-microbit" */ '../extensions/scratch3_microbit/index.js'),
    text2speech: () => import(/* webpackChunkName: "ext-text2speech" */ '../extensions/scratch3_text2speech/index.js'),
    translate: () => import(/* webpackChunkName: "ext-translate" */ '../extensions/scratch3_translate/index.js'),
    videoSensing: () => import(/* webpackChunkName: "ext-videosensing" */ '../extensions/scratch3_video_sensing/index.js'),
    cameracapture: () => import(/* webpackChunkName: "ext-cameracapture" */ '../extensions/crispstrobe/cameracapture/index.js'),
    ev3: () => import(/* webpackChunkName: "ext-ev3" */ '../extensions/scratch3_ev3/index.js'),
    boost: () => import(/* webpackChunkName: "ext-boost" */ '../extensions/scratch3_boost/index.js'),
    gdxfor: () => import(/* webpackChunkName: "ext-gdxfor" */ '../extensions/scratch3_gdx_for/index.js'),
    // Peer sessions (task E11): only in a build made with BW_ENABLE_PEERS=1 (a DefinePlugin
    // literal, so a default build carries neither the entry nor the chunk). In node, where
    // process.env holds strings, `=== true` keeps it off.
    ...(process.env.BW_ENABLE_PEERS === true ? {
        peersessions: () => import(/* webpackChunkName: "ext-peersessions" */ '../extensions/crispstrobe/peers/index.js')
    } : {})
};

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/**
 * Unwrap whatever `import()` handed back into the extension class. Every
 * built-in is a CommonJS module whose `module.exports` IS the class, which
 * webpack surfaces as the namespace's `default`; an ES module with a default
 * export lands in the same place.
 * @param {object} mod - the namespace object from a dynamic import
 * @returns {Function} the extension constructor
 */
const extensionClassFrom = mod => (mod && mod.default) || mod;

/**
 * @typedef {object} ArgumentInfo - Information about an extension block argument
 * @property {ArgumentType} type - the type of value this argument can take
 * @property {*|undefined} default - the default value of this argument (default: blank)
 */

/**
 * @typedef {object} ConvertedBlockInfo - Raw extension block data paired with processed data ready for scratch-blocks
 * @property {ExtensionBlockMetadata} info - the raw block info
 * @property {object} json - the scratch-blocks JSON definition for this block
 * @property {string} xml - the scratch-blocks XML definition for this block
 */

/**
 * @typedef {object} CategoryInfo - Information about a block category
 * @property {string} id - the unique ID of this category
 * @property {string} name - the human-readable name of this category
 * @property {string|undefined} blockIconURI - optional URI for the block icon image
 * @property {string} color1 - the primary color for this category, in '#rrggbb' format
 * @property {string} color2 - the secondary color for this category, in '#rrggbb' format
 * @property {string} color3 - the tertiary color for this category, in '#rrggbb' format
 * @property {Array.<ConvertedBlockInfo>} blocks - the blocks, separators, etc. in this category
 * @property {Array.<object>} menus - the menus provided by this category
 */

/**
 * @typedef {object} PendingExtensionWorker - Information about an extension worker still initializing
 * @property {string} extensionURL - the URL of the extension to be loaded by this worker
 * @property {Function} resolve - function to call on successful worker startup
 * @property {Function} reject - function to call on failed worker startup
 */

class ExtensionManager {
    constructor (runtime) {
        /**
         * The ID number to provide to the next extension worker.
         * @type {int}
         */
        this.nextExtensionWorker = 0;

        /**
         * FIFO queue of extensions which have been requested but not yet loaded in a worker,
         * along with promise resolution functions to call once the worker is ready or failed.
         *
         * @type {Array.<PendingExtensionWorker>}
         */
        this.pendingExtensions = [];

        /**
         * Map of worker ID to workers which have been allocated but have not yet finished initialization.
         * @type {Array.<PendingExtensionWorker>}
         */
        this.pendingWorkers = [];

        // URL -> in-flight promoted-pin load. _loadedExtensions is populated only
        // after registration, so it cannot by itself close the fetch/verify race
        // between two callers loading the same gallery URL concurrently.
        this.pendingPinnedLoads = new Map();

        // id -> in-flight chunk load for a lazyBuiltinExtensions entry. Two
        // callers asking for the same extension while its chunk is downloading
        // must share one registration, not race to two.
        this._pendingBuiltinLoads = new Map();

        /**
         * Map of loaded extension URLs/IDs (equivalent for built-in extensions) to service name.
         * @type {Map.<string,string>}
         * @private
         */
        this._loadedExtensions = new Map();

        /**
         * Ids the project being loaded named with a URL that was refused (see
         * loadProjectExtension). Its bare id must not then load a gallery copy by
         * the back door (installTargets asks again by id). Reset per project.
         * @type {Map.<string,string>} id -> the refusal message
         * @private
         */
        this._refusedProjectExtensions = new Map();

        /**
         * Keep a reference to the runtime so we can construct internal extension objects.
         * TODO: remove this in favor of extensions accessing the runtime as a service.
         * @type {Runtime}
         */
        this.runtime = runtime;

        dispatch.setService('extensions', this).catch(e => {
            log.error(`ExtensionManager was unable to register extension service: ${JSON.stringify(e)}`);
        });
    }

    /**
     * Check whether an extension is registered or is in the process of loading. This is intended to control loading or
     * adding extensions so it may return `true` before the extension is ready to be used. Use the promise returned by
     * `loadExtensionURL` if you need to wait until the extension is truly ready.
     * @param {string} extensionID - the ID of the extension.
     * @returns {boolean} - true if loaded, false otherwise.
     */
    isExtensionLoaded (extensionID) {
        return this._loadedExtensions.has(extensionID);
    }

    /**
     * Synchronously load an internal extension (core or non-core) by ID. This call will
     * fail if the provided id is not does not match an internal extension.
     * @param {string} extensionId - the ID of an internal extension
     */
    loadExtensionIdSync (extensionId) {
        extensionId = resolveExtensionId(extensionId);
        if (hasOwn(lazyBuiltinExtensions, extensionId)) {
            // Nothing calls this for a lazy id today (CORE_EXTENSIONS is empty);
            // if something starts to, it gets the extension a moment later
            // rather than never, and a warning that says why.
            log.warn(`Extension ${extensionId} is loaded on demand; loading it asynchronously.`);
            this._loadLazyBuiltinExtension(extensionId);
            return;
        }
        if (!hasOwn(builtinExtensions, extensionId)) {
            log.warn(`Could not find extension ${extensionId} in the built in extensions.`);
            return;
        }

        /** @TODO dupe handling for non-builtin extensions. See commit 670e51d33580e8a2e852b3b038bb3afc282f81b9 */
        if (this.isExtensionLoaded(extensionId)) {
            const message = `Rejecting attempt to load a second extension with ID ${extensionId}`;
            log.warn(message);
            return;
        }

        const extension = builtinExtensions[extensionId]();
        const extensionInstance = new extension(this.runtime);
        const serviceName = this._registerInternalExtension(extensionInstance);
        this._loadedExtensions.set(extensionId, serviceName);
    }

    /**
     * Load a built-in extension whose code lives in its own chunk.
     * @param {string} extensionId - a key of lazyBuiltinExtensions
     * @returns {Promise} resolved once the chunk has arrived and the extension is registered
     * @private
     */
    _loadLazyBuiltinExtension (extensionId) {
        if (this.isExtensionLoaded(extensionId)) {
            log.warn(`Rejecting attempt to load a second extension with ID ${extensionId}`);
            return Promise.resolve();
        }
        if (this._pendingBuiltinLoads.has(extensionId)) {
            return this._pendingBuiltinLoads.get(extensionId);
        }
        const pending = lazyBuiltinExtensions[extensionId]().catch(err => {
            // The callers (deserializeProject's pre-load, installTargets,
            // shareBlocksToTarget) tolerate this rejection on purpose, so that a
            // chunk that fails to arrive costs its blocks and not the project.
            // Which means that without this line "the module never came" is
            // indistinguishable from "nobody asked" — a feature that asks for
            // something must leave a trace its absence cannot produce. Rethrown
            // unchanged: the callers' contract is not this line's to alter.
            log.error(`Built-in extension ${extensionId} failed to load its chunk: ` +
                `${(err && err.message) || err}`);
            throw err;
        }).then(mod => {
            // loadExtensionIdSync's fallback also arrives here without going
            // through the pending map, so the registration check is repeated.
            if (this.isExtensionLoaded(extensionId)) return;
            const extension = extensionClassFrom(mod);
            const extensionInstance = new extension(this.runtime);
            const serviceName = this._registerInternalExtension(extensionInstance);
            this._loadedExtensions.set(extensionId, serviceName);
        });
        const settle = () => this._pendingBuiltinLoads.delete(extensionId);
        pending.then(settle, settle);
        this._pendingBuiltinLoads.set(extensionId, pending);
        return pending;
    }

    /**
     * Load an extension by URL or internal extension ID
     * @param {string} extensionURL - the URL for the extension to load OR the ID of an internal extension
     * @returns {Promise} resolved once the extension is loaded and initialized or rejected on failure
     */
    loadExtensionURL (extensionURL, options) {
        extensionURL = resolveExtensionId(extensionURL, options);
        if (hasOwn(lazyBuiltinExtensions, extensionURL)) {
            return this._loadLazyBuiltinExtension(extensionURL);
        }
        if (hasOwn(builtinExtensions, extensionURL)) {
            /** @TODO dupe handling for non-builtin extensions. See commit 670e51d33580e8a2e852b3b038bb3afc282f81b9 */
            if (this.isExtensionLoaded(extensionURL)) {
                const message = `Rejecting attempt to load a second extension with ID ${extensionURL}`;
                log.warn(message);
                return Promise.resolve();
            }

            const extension = builtinExtensions[extensionURL]();
            const extensionInstance = new extension(this.runtime);
            const serviceName = this._registerInternalExtension(extensionInstance);
            this._loadedExtensions.set(extensionURL, serviceName);
            return Promise.resolve();
        }

        // A distribution built with remote extensions denied is self-contained at this boundary. Apply that
        // BUILD-TIME choice at the VM boundary as well as the picker so projects, deep links and
        // direct API callers all fail closed. Do not infer it from Tauri: ordinary native builds,
        // Android and Windows retain URL extensions. Bundled IDs already returned above.
        if (process.env.BW_REMOTE_EXTENSIONS_POLICY === 'deny') {
            return Promise.reject(new Error(
                'This distribution can load only bundled extensions; use an unrestricted build for URL extensions.'
            ));
        }

        // An id this project named with a refused URL stays refused (loadProjectExtension).
        if (this._refusedProjectExtensions.has(extensionURL)) {
            return Promise.reject(new Error(this._refusedProjectExtensions.get(extensionURL)));
        }

        // A pinned gallery id (see GALLERY_EXTENSION_IDS) loads the pinned gallery
        // copy below, exactly as if its URL had been picked from the gallery.
        const galleryURL = galleryURLForExtensionId(extensionURL);
        if (galleryURL) {
            if (this.isExtensionLoaded(extensionURL) || this.isExtensionLoaded(galleryURL)) {
                return Promise.resolve();
            }
            extensionURL = galleryURL;
        }

        // Brickwright: a BARE ID that is not a builtin is a missing implementation,
        // not a URL. Treating it as one spawned a sandbox worker whose
        // importScripts('<id>') 404'd as a page error on every project load
        // (id 'devices', example 53, 2026-08-10). Warn once, loudly, and skip —
        // the blocks stay dropped either way until the extension exists.
        if (!/^(https?:|data:|blob:|\.|\/)/.test(extensionURL)) {
            log.warn(`Unknown extension id "${extensionURL}" — no builtin and not a URL; skipping.`);
            return Promise.resolve();
        }

        // Only exact, content-pinned gallery URLs retain the in-process compatibility adapter.
        // Everything else — including a new file on the same Pages host — is imported by the VM's
        // worker and therefore cannot see the DOM or Tauri IPC. Hostname and a confirm dialog are
        // not isolation boundaries.
        if (isRemoteExtensionURL(extensionURL) && pinForURL(extensionURL)) {
            const pin = pinForURL(extensionURL);
            // Promotion is explicit and fail closed. Candidate/deferred pins retain the compatibility
            // adapter until their individual review changes the manifest; only `worker` pins enter
            // the source-bootstrap protocol.
            if (pin.migration && pin.migration.status === 'worker') {
                return this._loadPinnedWorkerExtension(extensionURL);
            }
            return this._loadTrustedRemoteExtension(extensionURL);
        }

        return this._loadSandboxedExtension(extensionURL);
    }

    /**
     * Start loading a new project's extensions: forget the previous project's refusals.
     */
    beginProjectExtensions () {
        this._refusedProjectExtensions.clear();
    }

    /**
     * Load one extension a project file declares (task E5).
     *
     * Bundled and lazy built-in ids load as themselves whatever URL the file
     * records. Otherwise the file's `extensionURLs` entry is honoured only when it
     * names a pinned gallery extension registering this id (galleryURLForProjectEntry):
     * then the PINNED copy loads, hash-checked. Any other URL is refused by name and
     * never fetched, and the id stays refused for this project. With no entry the
     * bare id routes through GALLERY_EXTENSION_IDS as before.
     * @param {string} id extension id from the project's `extensions` list
     * @param {?string} url the project's `extensionURLs[id]`, if any
     * @returns {Promise} resolved once loaded; rejected with a message naming the id otherwise
     */
    loadProjectExtension (id, url) {
        const resolved = resolveExtensionId(id);
        if (hasOwn(lazyBuiltinExtensions, resolved) || hasOwn(builtinExtensions, resolved) ||
            url === undefined || url === null) {
            return this.loadExtensionURL(id);
        }
        const pinned = galleryURLForProjectEntry(id, url);
        if (!pinned) {
            const message = `Refusing extension "${id}": the project names ${JSON.stringify(String(url))}, ` +
                'which is not a pinned gallery extension with that id. A project file cannot choose ' +
                'code to load; add the extension from the gallery or a trusted URL instead.';
            log.warn(message);
            this._refusedProjectExtensions.set(id, message);
            return Promise.reject(new Error(message));
        }
        if (this.isExtensionLoaded(id) || this.isExtensionLoaded(pinned)) return Promise.resolve();
        return this.loadExtensionURL(pinned);
    }

    /**
     * The exact pinned gallery URL a loaded extension id came from, for saving
     * as the project's `extensionURLs[id]` (task E5). Null for bundled and lazy
     * built-in ids, for an id loaded from any other URL, and for an id not loaded.
     * @param {string} id extension id
     * @returns {string|null} pinned gallery URL
     */
    galleryURLForLoadedExtension (id) {
        if (hasOwn(lazyBuiltinExtensions, id) || hasOwn(builtinExtensions, id)) return null;
        const serviceName = this._loadedExtensions.get(id);
        if (!serviceName) return null;
        for (const [key, service] of this._loadedExtensions) {
            if (service === serviceName && extensionIdForGalleryURL(key) === id) return key;
        }
        return null;
    }

    /**
     * Load an unpinned extension in the Scratch VM worker.
     * @param {string} extensionURL - URL imported inside the worker
     * @returns {Promise} resolved once the worker has registered its extension
     */
    _loadSandboxedExtension (extensionURL) {
        return new Promise((resolve, reject) => {
            // If we `require` this at the global level it breaks non-webpack targets, including tests
            const worker = new Worker('./extension-worker.js');

            this.pendingExtensions.push({extensionURL, resolve, reject});
            dispatch.addWorker(worker);
        });
    }

    /**
     * Fetch and authenticate a promoted gallery extension before creating its worker. The host owns
     * the allocation and source: downloaded code cannot choose an ID, URL, or replacement payload.
     * There is deliberately no adapter fallback if any stage fails.
     * @param {string} extensionURL exact pinned gallery URL
     * @returns {Promise<number>} resolved with the immutable worker ID after initialization
     */
    _loadPinnedWorkerExtension (extensionURL) {
        // Re-derive authority at this boundary. A same-realm caller can invoke this method directly,
        // so a caller-supplied object must never be able to invent a digest, identity or declaration.
        const pin = pinForURL(extensionURL);
        if (!pin || !pin.migration || pin.migration.status !== 'worker') {
            return Promise.reject(new Error(`URL is not an immutable promoted worker pin: ${extensionURL}`));
        }
        if (this.isExtensionLoaded(extensionURL)) {
            log.warn(`Rejecting attempt to load a second extension with URL ${extensionURL}`);
            return;
        }
        if (this.pendingPinnedLoads.has(extensionURL)) return this.pendingPinnedLoads.get(extensionURL);
        const loading = this._startPinnedWorkerExtension(extensionURL, pin)
            .finally(() => this.pendingPinnedLoads.delete(extensionURL));
        this.pendingPinnedLoads.set(extensionURL, loading);
        return loading;
    }

    async _startPinnedWorkerExtension (extensionURL, pin) {

        const response = await fetch(extensionURL);
        if (!response.ok) throw new Error(`HTTP ${response.status} loading ${extensionURL}`);
        const bytes = await response['arrayBuffer']();
        const verifyPinnedBytes = verifyGallerySource;
        await verifyPinnedBytes(extensionURL, bytes);
        const source = new TextDecoder('utf-8', {fatal: true}).decode(bytes);

        // Allocate only after all fallible fetch/verification/decoding work. A failed pin therefore
        // consumes neither an ID nor a pending slot and never constructs an execution realm.
        const workerId = this.nextExtensionWorker++;
        const capabilities = Object.freeze((pin.brokerCapabilities || []).slice());
        const hostRecord = Object.freeze({
            protocol: 1,
            workerId,
            url: extensionURL,
            slug: pin.slug,
            digest: pin.served,
            capabilities,
            proof: pin.proof === true,
            source
        });
        return new Promise((resolve, reject) => {
            this.pendingWorkers[workerId] = {extensionURL, resolve, reject, hostRecord, serviceNames: []};
            try {
                const worker = new Worker('./extension-worker.js');
                dispatch.addWorker(worker, hostRecord);
            } catch (error) {
                delete this.pendingWorkers[workerId];
                reject(error);
            }
        });
    }

    /**
     * Whether a URL names exact reviewed gallery content (loads without a user prompt). A hostname
     * alone is not trust: new entries and URL variants use the custom-URL path; changed pinned bytes
     * are refused after fetch and before evaluation.
     * @param {string} extensionURL - candidate URL
     * @returns {boolean} true only for an exact URL in the shipped pin map
     */
    isTrustedExtensionURL (extensionURL) {
        return Boolean(pinForURL(extensionURL));
    }

    /**
     * Why a URL is or is not trusted, for the UI to word its warning with.
     * @param {string} extensionURL - candidate URL
     * @returns {string} 'pinned', 'unpinned' (a plain gallery URL we have no pin for) or 'foreign'
     */
    pinStatusFor (extensionURL) {
        return pinStatusFor(extensionURL);
    }

    /**
     * Fetch content-pinned gallery source and load it unsandboxed via the compatibility adapter.
     * @param {string} extensionURL - an https URL to the extension's .js source
     * @returns {Promise} resolved once the extension is registered
     */
    _loadTrustedRemoteExtension (extensionURL) {
        if (this.isExtensionLoaded(extensionURL)) {
            log.warn(`Rejecting attempt to load a second extension with URL ${extensionURL}`);
            return Promise.resolve();
        }
        // require lazily so non-webpack/test targets that never hit this branch don't need it
        const makeCrispExtension = require('../extensions/crispstrobe/adapter');
        return fetch(extensionURL)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status} loading ${extensionURL}`);
                return res.arrayBuffer();
            })
            .then(async bytes => {
                await verifyGallerySource(extensionURL, bytes);
                const source = new TextDecoder('utf-8', {fatal: true}).decode(bytes);
                const Extension = makeCrispExtension(source);
                const extensionInstance = new Extension(this.runtime);
                const serviceName = this._registerInternalExtension(extensionInstance);
                // Key by both the URL (what the library UI checks) and the extension's own id.
                this._loadedExtensions.set(extensionURL, serviceName);
                const info = extensionInstance.getInfo && extensionInstance.getInfo();
                if (info && info.id) this._loadedExtensions.set(info.id, serviceName);
            });
    }

    /**
     * Regenerate blockinfo for any loaded extensions
     * @param {object} options refresh behaviour
     * @param {boolean} options.throwOnError reject if any extension cannot refresh
     * @returns {Promise} resolved once all the extensions have been reinitialized
     */
    refreshBlocks ({throwOnError = false} = {}) {
        const failures = [];
        // Deduplicate: an extension loaded by URL is keyed by both URL and ID,
        // so iterating values() would call getInfo twice for the same service.
        const allPromises = Array.from(new Set(this._loadedExtensions.values())).map(serviceName =>
            dispatch.call(serviceName, 'getInfo')
                .then(info => {
                    info = this._prepareExtensionInfo(serviceName, info);
                    return dispatch.call('runtime', '_refreshExtensionPrimitives', info);
                })
                .catch(e => {
                    log.error(`Failed to refresh built-in extension primitives: ${JSON.stringify(e)}`);
                    if (throwOnError) failures.push(e);
                })
        );
        return Promise.all(allPromises).then(results => {
            // A failed apply must remain busy until sibling registrations drain,
            // otherwise their late schema updates can overwrite the next apply.
            if (failures.length) throw failures[0];
            return results;
        });
    }

    allocateWorker () {
        const id = this.nextExtensionWorker++;
        const workerInfo = this.pendingExtensions.shift();
        this.pendingWorkers[id] = workerInfo;
        return [id, workerInfo.extensionURL];
    }

    /**
     * Synchronously collect extension metadata from the specified service and begin the extension registration process.
     * @param {string} serviceName - the name of the service hosting the extension.
     */
    registerExtensionServiceSync (serviceName) {
        const info = dispatch.callSync(serviceName, 'getInfo');
        this._registerExtensionInfo(serviceName, info);
    }

    /**
     * Collect extension metadata from the specified service and begin the extension registration process.
     * @param {string} serviceName - the name of the service hosting the extension.
     */
    registerExtensionService (serviceName) {
        return dispatch.call(serviceName, 'getInfo').then(info => {
            const extensionInfo = this._prepareExtensionInfo(serviceName, info);
            return dispatch.call('runtime', '_registerExtensionPrimitives', extensionInfo).then(() => {
                this._loadedExtensions.set(extensionInfo.id, serviceName);
                const match = /^extension\.(\d+)\.\d+$/.exec(serviceName);
                const workerInfo = match && this.pendingWorkers[Number(match[1])];
                if (workerInfo && Array.isArray(workerInfo.serviceNames)) workerInfo.serviceNames.push(serviceName);
            });
        });
    }

    /**
     * Called by an extension worker to indicate that the worker has finished initialization.
     * @param {int} id - the worker ID.
     * @param {*?} e - the error encountered during initialization, if any.
     */
    onWorkerInit (id, e) {
        const workerInfo = this.pendingWorkers[id];
        delete this.pendingWorkers[id];
        if (!workerInfo) throw new Error(`Unknown extension worker ${id} initialized`);
        if (e) {
            workerInfo.reject(e);
        } else {
            if (workerInfo.extensionURL && workerInfo.serviceNames && workerInfo.serviceNames.length) {
                this._loadedExtensions.set(workerInfo.extensionURL, workerInfo.serviceNames[0]);
            }
            workerInfo.resolve(id);
        }
    }

    /**
     * Register an internal (non-Worker) extension object
     * @param {object} extensionObject - the extension object to register
     * @returns {string} The name of the registered extension service
     */
    _registerInternalExtension (extensionObject) {
        const extensionInfo = extensionObject.getInfo();
        const fakeWorkerId = this.nextExtensionWorker++;
        const serviceName = `extension_${fakeWorkerId}_${extensionInfo.id}`;
        dispatch.setServiceSync(serviceName, extensionObject);
        dispatch.callSync('extensions', 'registerExtensionServiceSync', serviceName);
        return serviceName;
    }

    /**
     * Sanitize extension info then register its primitives with the VM.
     * @param {string} serviceName - the name of the service hosting the extension
     * @param {ExtensionInfo} extensionInfo - the extension's metadata
     * @private
     */
    _registerExtensionInfo (serviceName, extensionInfo) {
        extensionInfo = this._prepareExtensionInfo(serviceName, extensionInfo);
        dispatch.call('runtime', '_registerExtensionPrimitives', extensionInfo).catch(e => {
            log.error(`Failed to register primitives for extension on service ${serviceName}:`, e);
        });
    }

    /**
     * Modify the provided text as necessary to ensure that it may be used as an attribute value in valid XML.
     * @param {string} text - the text to be sanitized
     * @returns {string} - the sanitized text
     * @private
     */
    _sanitizeID (text) {
        return text.toString().replace(/[<"&]/, '_');
    }

    /**
     * Apply minor cleanup and defaults for optional extension fields.
     * TODO: make the ID unique in cases where two copies of the same extension are loaded.
     * @param {string} serviceName - the name of the service hosting this extension block
     * @param {ExtensionInfo} extensionInfo - the extension info to be sanitized
     * @returns {ExtensionInfo} - a new extension info object with cleaned-up values
     * @private
     */
    _prepareExtensionInfo (serviceName, extensionInfo) {
        extensionInfo = Object.assign({}, extensionInfo);
        if (!/^[a-z0-9]+$/i.test(extensionInfo.id)) {
            throw new Error('Invalid extension id');
        }
        extensionInfo.name = extensionInfo.name || extensionInfo.id;
        extensionInfo.blocks = extensionInfo.blocks || [];
        extensionInfo.targetTypes = extensionInfo.targetTypes || [];
        extensionInfo.blocks = extensionInfo.blocks.reduce((results, blockInfo) => {
            try {
                let result;
                switch (blockInfo) {
                case '---': // separator
                    result = '---';
                    break;
                default: // an ExtensionBlockMetadata object
                    result = this._prepareBlockInfo(serviceName, blockInfo);
                    break;
                }
                results.push(result);
            } catch (e) {
                // TODO: more meaningful error reporting
                log.error(`Error processing block: ${e.message}, Block:\n${JSON.stringify(blockInfo)}`);
            }
            return results;
        }, []);
        extensionInfo.menus = extensionInfo.menus || {};
        extensionInfo.menus = this._prepareMenuInfo(serviceName, extensionInfo.menus);
        return extensionInfo;
    }

    /**
     * Prepare extension menus. e.g. setup binding for dynamic menu functions.
     * @param {string} serviceName - the name of the service hosting this extension block
     * @param {Array.<MenuInfo>} menus - the menu defined by the extension.
     * @returns {Array.<MenuInfo>} - a menuInfo object with all preprocessing done.
     * @private
     */
    _prepareMenuInfo (serviceName, menus) {
        const menuNames = Object.getOwnPropertyNames(menus);
        for (let i = 0; i < menuNames.length; i++) {
            const menuName = menuNames[i];
            let menuInfo = menus[menuName];

            // If the menu description is in short form (items only) then normalize it to general form: an object with
            // its items listed in an `items` property.
            if (!menuInfo.items) {
                menuInfo = {
                    items: menuInfo
                };
                menus[menuName] = menuInfo;
            }
            // If `items` is a string, it should be the name of a function in the extension object. Calling the
            // function should return an array of items to populate the menu when it is opened.
            if (typeof menuInfo.items === 'string') {
                const menuItemFunctionName = menuInfo.items;
                const serviceObject = dispatch.services[serviceName];
                // Bind the function here so we can pass a simple item generation function to Scratch Blocks later.
                menuInfo.items = this._getExtensionMenuItems.bind(this, serviceObject, menuItemFunctionName);
            }
        }
        return menus;
    }

    /**
     * Fetch the items for a particular extension menu, providing the target ID for context.
     * @param {object} extensionObject - the extension object providing the menu.
     * @param {string} menuItemFunctionName - the name of the menu function to call.
     * @returns {Array} menu items ready for scratch-blocks.
     * @private
     */
    _getExtensionMenuItems (extensionObject, menuItemFunctionName) {
        // Fetch the items appropriate for the target currently being edited. This assumes that menus only
        // collect items when opened by the user while editing a particular target.
        const editingTarget = this.runtime.getEditingTarget() || this.runtime.getTargetForStage();
        const editingTargetID = editingTarget ? editingTarget.id : null;
        const extensionMessageContext = this.runtime.makeMessageContextForTarget(editingTarget);

        // TODO: Fix this to use dispatch.call when extensions are running in workers.
        const menuFunc = extensionObject[menuItemFunctionName];
        const menuItems = menuFunc.call(extensionObject, editingTargetID).map(
            item => {
                item = maybeFormatMessage(item, extensionMessageContext);
                switch (typeof item) {
                case 'object':
                    return [
                        maybeFormatMessage(item.text, extensionMessageContext),
                        item.value
                    ];
                case 'string':
                    return [item, item];
                default:
                    return item;
                }
            });

        if (!menuItems || menuItems.length < 1) {
            throw new Error(`Extension menu returned no items: ${menuItemFunctionName}`);
        }
        return menuItems;
    }

    /**
     * Apply defaults for optional block fields.
     * @param {string} serviceName - the name of the service hosting this extension block
     * @param {ExtensionBlockMetadata} blockInfo - the block info from the extension
     * @returns {ExtensionBlockMetadata} - a new block info object which has values for all relevant optional fields.
     * @private
     */
    _prepareBlockInfo (serviceName, blockInfo) {
        const originalMetadata = blockInfo;
        blockInfo = Object.assign({}, {
            blockType: BlockType.COMMAND,
            terminal: false,
            blockAllThreads: false,
            arguments: {}
        }, blockInfo);
        blockInfo.opcode = blockInfo.opcode && this._sanitizeID(blockInfo.opcode);
        blockInfo.text = blockInfo.text || blockInfo.opcode;

        switch (blockInfo.blockType) {
        case BlockType.EVENT:
            if (blockInfo.func) {
                log.warn(`Ignoring function "${blockInfo.func}" for event block ${blockInfo.opcode}`);
            }
            break;
        case 'label': // palette section header (see runtime patchPaletteStructure)
        case BlockType.BUTTON:
            if (blockInfo.opcode) {
                log.warn(`Ignoring opcode "${blockInfo.opcode}" for button with text: ${blockInfo.text}`);
            }
            break;
        default: {
            if (!blockInfo.opcode) {
                throw new Error('Missing opcode for block');
            }

            const funcName = blockInfo.func ? this._sanitizeID(blockInfo.func) : blockInfo.opcode;

            const getBlockInfo = blockInfo.isDynamic ?
                args => args && args.mutation && args.mutation.blockInfo :
                () => blockInfo;
            let ownedBlockFunc = null;
            const callBlockFunc = (() => {
                if (dispatch._isRemoteService(serviceName)) {
                    return (args, util, realBlockInfo) =>
                        dispatch.call(serviceName, funcName, args, util, realBlockInfo);
                }

                // avoid promise latency if we can call direct
                const serviceObject = dispatch.services[serviceName];
                // Source-owned result factories construct their own known
                // wrapper, while preserving this ordinary local dispatch.
                const owned = resultFactory.prepare(originalMetadata, serviceObject, funcName, blockInfo);
                if (typeof owned === 'function') {ownedBlockFunc = owned; return owned;}
                if (!serviceObject[funcName]) {
                    // The function might show up later as a dynamic property of the service object
                    log.warn(`Could not find extension block function called ${funcName}`);
                }
                return (args, util, realBlockInfo) =>
                    serviceObject[funcName](args, util, realBlockInfo);
            })();

            blockInfo.func = ownedBlockFunc || ((args, util) => {
                const realBlockInfo = getBlockInfo(args);
                // TODO: filter args using the keys of realBlockInfo.arguments? maybe only if sandboxed?
                return callBlockFunc(args, util, realBlockInfo);
            });
            break;
        }
        }

        return blockInfo;
    }
}

// Read by the tests that hold the id map to its pins and the sources' declared ids.
ExtensionManager.GALLERY_EXTENSION_IDS = GALLERY_EXTENSION_IDS;

module.exports = ExtensionManager;
