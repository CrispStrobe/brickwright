/**
 * MakeCode's own compiler, run here: an imported (or exported) MakeCode project
 * compiled by pxt itself, with no makecode.com.
 *
 * WHY THE REAL COMPILER. The rest of bw-makecode TRANSLATES MakeCode into our
 * dialect, and says out loud what does not survive (tilemaps, physics, music…).
 * This is the other road: keep the program as MakeCode wrote it, compile it with
 * MakeCode's compiler (pxt-core, MIT) against MakeCode's target (pxt-microbit /
 * pxt-arcade, MIT), and run it in MakeCode's simulator — nothing is lost, because
 * nothing is converted. For the micro:bit it also produces the REAL firmware: a
 * universal .hex that flashes a board.
 *
 * WHERE THE RUNTIME COMES FROM. scripts/sync-makecode-runtime.mjs fetches the
 * pinned npm tarballs and serves the files under static/makecode/<target>/:
 * target.json (the target bundle: libraries + compiler config), pxtworker.js
 * (the compiler), the simulator, and for the micro:bit the precompiled CODAL
 * firmware bases (hexcache/<sha>.hex) that a program is linked onto.
 *
 * HOW. pxtworker.js is the script MakeCode's editor runs in a Web Worker. The
 * glue below runs inside that same worker (or, in Node tests, inside a vm
 * sandbox with the same globals) and calls pxt's "simple compile" entry points —
 * the sequence Microsoft's makecode CLI (pxt-mkc, MIT) uses, minus its package
 * downloader, cache and project folder. Every network hook refuses and is
 * counted, so "offline" is a measured property, not an assumption: the spike
 * compiled with zero attempts, and a .hex byte-identical to the CLI's.
 *
 * THE ONE HARD LIMIT. A native build needs a precompiled firmware base for the
 * project's exact set of C++ packages. pxt-microbit ships those for its default
 * set (core + radio + microphone); pxt-arcade ships none, so its bases are BUILT
 * from source by scripts/build-makecode-arcade-bases.mjs (one per hardware
 * variant, default package set) and served by the sync when their sha256 is
 * pinned. Anything else would need MakeCode's cloud C++ compiler — refused here
 * by name (NO_BASE_HEX) rather than sent to the network. Simulation has no such
 * limit. An Arcade native build must name its hardware (`hwVariant`): the
 * generic default has no C++ runtime of its own, so it has no base either.
 *
 * @module
 */

import {makeCodeWorkerErrorEnvelope} from './dependency-diagnostics.js';
import {BASE_LICENCES, emulatorBaseVerdict} from './base-licences.js';
import {VENDORED_EXTENSIONS} from './extensions-vendored.js';
import {fetchMakeCodeExtensions, unresolvedGithubDependencies} from './extension-fetch.js';
import {remoteExtensionsAllowed} from '../distribution-policy.js';

/**
 * The third-party extensions this build carries (extensions-vendored.js, written
 * by scripts/sync-makecode-extensions.mjs at exact commits), as the glue reads
 * them: the source files pxt compiles, and what a pxt.json may call each one —
 * `github:<owner>/<repo>#<tag>` or `#<commit>`, owner/repo in any case, the way
 * MakeCode's editor writes it. Each serves the one target it was published for
 * (micro:bit unless the pin names another); `untagged` pins also answer the
 * unversioned spelling some tutorials use.
 */
export const EXTENSION_TABLE = Object.freeze(VENDORED_EXTENSIONS.map(e => ({
    id: e.id,
    repo: e.repo.toLowerCase(),
    refs: [e.tag, e.commit, ...(e.untagged ? [''] : [])],
    targets: [e.target || 'microbit'],
    // `native`: the Arcade translator handles this package's API at its call sites
    // (generated adapters); every other vendored package is translated from source.
    native: e.native === true,
    files: Object.fromEntries(Object.entries(e.files).map(([name, f]) => [name, f.text]))
})));

/**
 * The MakeCode targets whose runtime sync-makecode-runtime serves, by pxt
 * target id (the `pxtTarget` a MakeCode file names), and what each builds.
 * `firmware` is the file the firmware download produces. Arcade builds one only
 * for a chosen board (`hwVariant`, see ARCADE_HARDWARE and arcadeBoards): the
 * importer's download asks for the board first, a .uf2 for most and an Intel
 * .hex for the nRF52833 ones (micro:bit shields); a board-less native Arcade
 * build stays refused by name (NO_BASE_HEX).
 * `name` is the product's own name (a proper noun, the same in every language),
 * which is why it is not a `label` for the i18n rule to count.
 */
export const MAKECODE_BOARDS = Object.freeze({
    microbit: {name: 'micro:bit', firmware: 'hex'},
    calliopemini: {name: 'Calliope mini', firmware: 'hex'},
    ev3: {name: 'LEGO MINDSTORMS EV3', firmware: 'uf2'},
    adafruit: {name: 'Circuit Playground Express', firmware: 'uf2'},
    arcade: {name: 'Arcade', firmware: 'uf2', perBoard: true}
});
export const MAKECODE_TARGETS = Object.freeze(Object.keys(MAKECODE_BOARDS));

/** Where a target's runtime is served, relative to the app. */
export const runtimeBase = target => `static/makecode/${target}/`;

/**
 * The code that runs inside the pxt worker, after `pxtTargetBundle` is set and
 * pxtworker.js has loaded. Plain script (no modules): it is evaluated in a Web
 * Worker in the browser and in a vm context in tests, the same text in both.
 */
export const PXT_GLUE_JS = `
var bwMakeCode = {
    netAttempts: [],
    configured: false,
    extensions: ${JSON.stringify(EXTENSION_TABLE)},
    // id -> files, for the compile in progress: what pkgOverrideAsync answers.
    overrides: {},
    // A project's dependencies against the vendored extensions. Every
    // github: dependency is either served from the vendored source (its own
    // github: dependencies too) or listed as unresolved — pxt then asks the
    // network for it, is refused and counted, and compile() names it.
    // \`extra\`: extensions fetched on demand for this compile (extension-fetch.js).
    resolveExtensions: function (deps, target, extra) {
        var table = bwMakeCode.extensions.concat(extra || []);
        var overrides = Object.create(null), requested = Object.create(null), unresolved = [], queue = [];
        var push = function (d) { for (var k in d) queue.push([k, String(d[k])]); };
        push(deps || {});
        while (queue.length) {
            var dep = queue.shift(), id = dep[0], spec = dep[1];
            var m = /^github:([^#]+?)(?:#(.+))?$/i.exec(spec);
            if (!m && /^github:/i.test(spec)) {
                var unsupported = new Error('Unsupported MakeCode dependency identity for ' + id + ' (' + spec + ')');
                unsupported.code = 'UNSUPPORTED_EXTENSION';unsupported.extensions = [id + ' (' + spec + ')'];throw unsupported;
            }
            var repo = m ? m[1].toLowerCase().replace(/[/]$/, '').replace(/\\.git$/, '') : null;
            var ref = m ? m[2] || '' : null;
            var identity = m ? 'github:' + repo + '#' + ref : 'target:' + spec;
            if (Object.prototype.hasOwnProperty.call(requested,id) && requested[id] !== identity) {
                var conflict = new Error('Conflicting MakeCode dependency identity for ' + id + ': ' + requested[id] + ' versus ' + identity);
                conflict.code = 'DEPENDENCY_CONFLICT';conflict.extensions = [id];throw conflict;
            }
            requested[id] = identity;
            if (!m || Object.prototype.hasOwnProperty.call(overrides,id)) continue;
            var hit = null;
            for (var i = 0; i < table.length; i++) {
                var e = table[i];
                if (e.repo === repo && e.refs.indexOf(ref) >= 0 && e.targets.indexOf(target) >= 0) {
                    if (hit) {
                        var ambiguous = new Error('Ambiguous MakeCode dependency source for ' + id + ' (' + spec + ')');
                        ambiguous.code = 'AMBIGUOUS_EXTENSION';ambiguous.extensions = [id];throw ambiguous;
                    }
                    hit = e;
                }
            }
            if (!hit) { unresolved.push(id + ' (' + spec + ')'); continue; }
            overrides[id] = hit.files;
            push(JSON.parse(hit.files['pxt.json']).dependencies);
        }
        return {overrides: overrides, unresolved: unresolved, identities: requested};
    },
    configure: function () {
        if (bwMakeCode.configured) return;
        pxt.setupSimpleCompile({
            cacheGet: function () { return Promise.resolve(null); },
            cacheSet: function () { return Promise.resolve(); },
            httpRequestAsync: function (o) {
                bwMakeCode.netAttempts.push(o && o.url);
                return Promise.reject(new Error('offline: ' + (o && o.url)));
            },
            // A vendored extension's source, else pxt's own lookup (the target
            // bundle for core, radio…; the network — refused — for anything else).
            pkgOverrideAsync: function (id) { return Promise.resolve(bwMakeCode.overrides[id] || null); }
        });
        // The package config is fetched from the cloud on every compile otherwise.
        pxt.packagesConfigAsync = function () { return Promise.resolve({}); };
        pxt.setupWebConfig({cdnUrl: 'https://offline.invalid'});
        bwMakeCode.configured = true;
    },
    // The EMULATOR's base check, inside the worker: the served bytes' sha256
    // must be one of the bases base-licences.js classifies 'clean' (the list
    // comes with the request). Anything else — an official base with Nordic's
    // SoftDevice in it, unknown bytes — is refused BEFORE pxt links onto it;
    // the page names the reason (emulatorBaseVerdict).
    emulatorBase: async function (text, cleanSha256s) {
        var digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        var hex = Array.prototype.map.call(new Uint8Array(digest), function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join('');
        if ((cleanSha256s || []).indexOf(hex) < 0) {
            var e = new Error('firmware base ' + hex + ' is not a clean emulator base');
            e.code = 'BASE_REFUSED';
            e.baseSha256 = hex;
            throw e;
        }
        return text;
    },
    compile: async function (files, opts) {
        opts = opts || {};
        bwMakeCode.configure();
        var before = bwMakeCode.netAttempts.length;
        var cfg = JSON.parse(files['pxt.json']);
        var generatedRootFiles = {};
        var generatedRootProvenance = [];
        var authoredFiles = files;
        for (var rootName of (cfg.files || [])) {
            if (!/\\.g\\.jres$/.test(rootName) || typeof authoredFiles[rootName] !== 'string') continue;
            var companion = rootName.replace(/\\.jres$/, '.ts');
            if (Object.prototype.hasOwnProperty.call(authoredFiles, companion)) continue;
            var rootGallery = JSON.parse(authoredFiles[rootName]);
            var hasMaps = Object.keys(rootGallery).some(function (key) {
                return rootGallery[key] && rootGallery[key].mimeType === 'application/mkcd-tilemap';
            });
            var hasImages = rootName === 'images.g.jres' || Object.keys(rootGallery).some(function (key) {
                var entry = rootGallery[key];
                return key !== '*' && entry && !entry.tilemapTile && entry.mimeType &&
                    entry.mimeType !== 'application/mkcd-tilemap';
            });
            var emitted = [];
            for (var emitter of (hasMaps ? ['emitTilemapsFromJRes'] : []).concat(hasImages ? ['emitProjectImages'] : [])) {
                var text = pxt[emitter](rootGallery);
                if (typeof text !== 'string') throw new Error('Original PXT asset emitter did not return TypeScript');
                emitted.push(text);
                generatedRootProvenance.push({input: rootName, file: companion, emitter: 'pxt.' + emitter,
                    versions: Object.assign({}, pxt.appTarget.versions || {}),
                    workerSha256: typeof __bwOriginalWorkerSha256 === 'string' ? __bwOriginalWorkerSha256 : null});
            }
            if (emitted.length) generatedRootFiles[companion] = emitted.join('\\n');
        }
        cfg.files = Object.keys(generatedRootFiles).concat(cfg.files || []);
        files = Object.assign({}, authoredFiles, generatedRootFiles);
        cfg.binaryonly = true;
        files = Object.assign({}, files, {'pxt.json': JSON.stringify(cfg, null, 4)});
        if (files['main.ts'] === undefined) files['main.ts'] = '';
        var ext = bwMakeCode.resolveExtensions(cfg.dependencies, pxt.appTarget && pxt.appTarget.id, opts.extensions);
        bwMakeCode.overrides = ext.overrides;
        var copts;
        try {
            if (pxt.simpleInstallPackagesAsync) await pxt.simpleInstallPackagesAsync(files);
            // Arcade hardware: 'rp2040', 'samd51'... selects the hw---<variant> package
            // (and with it the C++ runtime and the firmware base). '' = the default.
            pxt.setHwVariant(opts.hwVariant || '');
            // A multi-variant target (micro:bit: mbdal = V1, mbcodal = V2) builds
            // EVERY variant into one universal .hex by default; 'mbcodal' builds only
            // that one — the emulator runs a V2 image, on a Bluetooth-free base
            // (compileMakeCodeForEmulator), and has no use for the V1 half. null = all.
            pxt.setAppTargetVariant(opts.appVariant || null);
            copts = await pxt.simpleGetCompileOptionsAsync(files, {native: !!opts.native});
        } catch (err) {
            // A GitHub extension this build does not carry: pxt went to the
            // network for it (refused, counted above). Say which one.
            if (ext.unresolved.length && bwMakeCode.netAttempts.length > before) {
                var ne = new Error('MakeCode extension not available offline: ' + ext.unresolved.join(', ') +
                    ' — this build vendors ' + bwMakeCode.extensions.map(function (x) { return x.repo; }).join(', '));
                ne.code = 'NO_EXTENSION';
                ne.extensions = ext.unresolved;
                throw ne;
            }
            throw err;
        }
        // Preparation uses PXT's real package loading and asset-pack generation
        // without claiming that the user's program compiled or ran.
        if (opts.projectInputs) {
            var packageInputs = {};
            var resourceIds = {};
            var collectResources = function (source, config, namespace) {
                var owned = {};
                for (var index = 0; index < (config.files || []).length; index++) {
                    var name = config.files[index];
                    if (!/\\.jres$/.test(name) || typeof source[name] !== 'string') continue;
                    var gallery = JSON.parse(source[name]);
                    if (namespace !== null) gallery = pxt.emitGalleryDeclarations(gallery, namespace)[0];
                    var parsed = pxt.Package.prototype.parseJRes.call({
                        getFiles: function () { return ['resources.jres']; },
                        readFile: function () { return JSON.stringify(gallery); }
                    }, {});
                    for (var key in parsed) { resourceIds[key] = true; owned[key] = true; }
                }
                return Object.keys(owned);
            };
            var rootResourceIds = collectResources(files, cfg, null);
            for (var id in ext.overrides) {
                var prefix = 'pxt_modules/' + id + '/';
                var inputs = {};
                for (var name in copts.fileSystem) {
                    if (name.indexOf(prefix) === 0) inputs[name.slice(prefix.length)] = copts.fileSystem[name];
                }
                var config = JSON.parse(ext.overrides[id]['pxt.json']);
                var namespace = null;
                if (config.assetPack) {
                    var match = /(?:^|\\n)namespace ([\\w.$]+) \\{/.exec(inputs['gallery.ts'] || '');
                    var hasResources = (config.files || []).some(function (name) {
                        return /\\.jres$/.test(name) && typeof ext.overrides[id][name] === 'string' &&
                            Object.keys(JSON.parse(ext.overrides[id][name])).some(function (key) { return key !== '*'; });
                    });
                    if (!match && hasResources) throw new Error('Cannot identify original asset-pack namespace: ' + id);
                    namespace = match ? match[1] : '';
                }
                var ownedResources = collectResources(ext.overrides[id], config, namespace);
                var vendored = bwMakeCode.extensions.some(function (entry) { return entry.native === true && entry.files === ext.overrides[id]; });
                packageInputs[id] = {files: inputs, identity: ext.identities[id], dependencyConfig: config, assetPack: config.assetPack === true, assetNamespace: namespace,
                    vendored: vendored, resourceIds: ownedResources,
                    sourceFiles: (copts.sourceFiles || []).filter(function (name) {
                    return name.indexOf(prefix) === 0;
                }).map(function (name) { return name.slice(prefix.length); })};
            }
            var sourceOrder = [];
            for (var index = 0; index < (copts.sourceFiles || []).length; index++) {
                var path = copts.sourceFiles[index];
                for (var id in packageInputs) {
                    var prefix = 'pxt_modules/' + id + '/';
                    if (path.indexOf(prefix) === 0) sourceOrder.push({id: id, file: path.slice(prefix.length)});
                }
            }
            var resources = {};
            for (var key in resourceIds) if (copts.jres && copts.jres[key]) resources[key] = copts.jres[key];
            // MainPackage.getJRes snapshots the effective palette actually
            // consumed by this compilation. appTarget.runtime may subsequently
            // change as PXT visits packages, so prefer the compiler resource.
            var originalPalette = copts.jres && copts.jres.__palette;
            var paletteHex = originalPalette && originalPalette.dataEncoding === 'hex' && originalPalette.data;
            var runtime = pxt.appTarget && pxt.appTarget.runtime;
            var palette = typeof paletteHex === 'string' && /^(?:[0-9a-f]{6})+$/i.test(paletteHex) ?
                paletteHex.match(/.{6}/g).map(function (color) { return '#' + color; }) :
                runtime && Array.isArray(runtime.palette) ? runtime.palette.slice() : null;
            var runtimeConfig = {palette: palette};
            return {target:pxt.appTarget.id,inputFiles:Object.assign({},authoredFiles),dependencyBindings:ext.identities,
                packages: packageInputs, sourceOrder: sourceOrder, jres: resources, runtimeConfig: runtimeConfig,
                rootResourceIds: rootResourceIds, generatedRootFiles: generatedRootFiles,
                generatedRootProvenance: generatedRootProvenance,
                netAttempts: bwMakeCode.netAttempts.slice(before)};
        }
        if (opts.native && copts.extinfo && copts.extinfo.sha) {
            var infos = [copts.extinfo].concat((copts.otherMultiVariants || []).map(function (v) { return v.extinfo; }));
            for (var i = 0; i < infos.length; i++) {
                var hex = await opts.getBaseHex(infos[i].sha);
                if (!hex) {
                    var e = new Error('no precompiled firmware base for this package set (' + infos[i].sha + ')');
                    e.code = 'NO_BASE_HEX';
                    e.sha = infos[i].sha;
                    throw e;
                }
                infos[i].hexinfo = {hex: hex.split(/\\r?\\n/)};
            }
        }
        if (opts.native && opts.embedSource) {
            // The project, embedded the way MakeCode's editor embeds it, so the
            // .hex opens as this PROJECT in makecode.microbit.org (and in our own
            // importer). binaryonly above stops pxt doing it from the package;
            // the compiler still places it — in flash when it fits, else as
            // records after the image. Uncompressed: pxt's importer accepts that.
            copts.embedMeta = JSON.stringify({
                name: opts.embedSource.name || 'project',
                eURL: opts.embedSource.editorUrl || '',
                eVER: (pxt.appTarget.versions && pxt.appTarget.versions.target) || '',
                pxtTarget: pxt.appTarget.id
            });
            copts.embedBlob = ts.pxtc.encodeBase64(ts.pxtc.Util.toUTF8(JSON.stringify(opts.embedSource.files)));
        }
        var res = pxtc.service.performOperation('compile', {options: copts});
        return {
            success: !!res.success,
            outfiles: res.outfiles || {},
            generatedRootFiles: generatedRootFiles, generatedRootProvenance: generatedRootProvenance,
            diagnostics: (res.diagnostics || []).map(function (d) {
                var m = d.messageText;
                while (m && typeof m === 'object') m = m.messageText;
                return {file: d.fileName, line: d.line, column: d.column, message: String(m || '')};
            }),
            netAttempts: bwMakeCode.netAttempts.slice(before)
        };
    }
};
`;

/**
 * The worker's message loop, around the glue. pxtworker.js is itself written as a
 * worker script and installs ITS OWN self.onmessage when it loads, so the handler
 * is re-installed after importScripts — otherwise every message after 'init'
 * goes to pxt's handler, which never answers in this format, and a compile hangs
 * (measured: the first browser run did exactly that).
 */
export const WORKER_JS = `${PXT_GLUE_JS}
var bwWorkerErrorEnvelope = ${makeCodeWorkerErrorEnvelope.toString()};
var bwOnMessage = async function (e) {
    var m = e.data;
    try {
        if (m.op === 'init') {
            try {
                var r = await fetch(m.base + 'target.json');
                if (!r.ok) throw new Error('target.json: HTTP ' + r.status);
                self.pxtTargetBundle = await r.json();
                importScripts(m.base + 'pxtworker.js');
            } catch (error) {
                throw Object.assign(new Error(error.message), {code: 'NO_RUNTIME'});
            }
            self.onmessage = bwOnMessage;
            postMessage({id: m.id, ok: true});
        } else if (m.op === 'resolveProjectInputs') {
            // Package loading and resource generation only. The glue returns
            // at projectInputs before the compiler service is invoked.
            var prepared = await bwMakeCode.compile(m.files, {
                projectInputs: true, native: false, extensions: m.extensions
            });
            postMessage({id: m.id, ok: true, result: prepared});
        } else if (m.op === 'compile') {
            var out = await bwMakeCode.compile(m.files, {
                native: m.native,
                embedSource: m.embedSource,
                hwVariant: m.hwVariant,
                appVariant: m.appVariant,
                extensions: m.extensions,
                getBaseHex: async function (sha) {
                    // The emulator links onto its own bases (hexcache-emu/), and
                    // only onto bytes proven clean; a download, onto the official ones.
                    var h = await fetch(m.base + (m.emulator ? 'hexcache-emu/' : 'hexcache/') + sha + '.hex');
                    if (!h.ok) return null;
                    var text = await h.text();
                    return m.emulator ? bwMakeCode.emulatorBase(text, m.cleanBases) : text;
                }
            });
            postMessage({id: m.id, ok: true, result: out});
        }
    } catch (err) {
        postMessage({id: m.id, ok: false, error: bwWorkerErrorEnvelope(err)});
    }
};
self.onmessage = bwOnMessage;
`;

/**
 * A MakeCode failure, with a code the UI can name: NO_RUNTIME, NO_BASE_HEX,
 * UNSUPPORTED_TARGET, COMPILE — and, for the emulator, CHIP_RESTRICTED_BASE,
 * UNAUDITED_BASE, UNKNOWN_BASE (base-licences.js emulatorBaseVerdict).
 */
export class MakeCodeError extends Error {
    constructor (message, code, extra = {}) {
        super(message);
        this.name = 'MakeCodeError';
        this.code = code;
        Object.assign(this, extra);
    }
}

/** A fresh compiler context per operation: PXT package/compiler state from a
 * previous project, including failed installations, must not affect this one.
 * The browser's HTTP cache still supplies the immutable target/runtime assets.
 */
function workerFor (base) {
    const url = URL.createObjectURL(new Blob([WORKER_JS], {type: 'application/javascript'}));
    let worker;
    try {worker = new Worker(url);} catch (error) {URL.revokeObjectURL(url);throw error;}
    let next = 0;
    const pending = new Map();
    worker.onerror = event => {
        for (const p of pending.values()) p.reject(new MakeCodeError(event.message || 'MakeCode worker failed', 'COMPILE'));
        pending.clear();
    };
    worker.onmessage = e => {
        const p = pending.get(e.data.id);
        if (!p) return;
        pending.delete(e.data.id);
        if (e.data.ok) p.resolve(e.data.result);
        else {
            const envelope = e.data.error;
            p.reject(new MakeCodeError(envelope.message, envelope.code || 'COMPILE',
                {...envelope,name:'MakeCodeError',workerError:envelope}));
        }
    };
    const call = msg => new Promise((resolve, reject) => {
        const id = ++next;
        pending.set(id, {resolve, reject});
        worker.postMessage(Object.assign({id, base}, msg));
    });
    return {call, ready: call({op: 'init'}), dispose() {
        worker.terminate();
        URL.revokeObjectURL(url);
        for (const p of pending.values()) p.reject(new MakeCodeError('MakeCode worker disposed', 'COMPILE'));
        pending.clear();
    }};
}

/**
 * Compile a MakeCode project in the browser.
 *
 * @param {object} args
 * @param {string} args.target 'microbit' or 'arcade'
 * @param {Object<string,string>} args.files the project, {filename: contents}, pxt.json included
 * @param {boolean} [args.native] build the firmware (.hex) instead of simulator JS
 * @param {{files: object, name: string, editorUrl?: string}} [args.embedSource] embed the
 *   project in the .hex, as MakeCode's editor does, so MakeCode opens it as a project
 * @param {string} [args.hwVariant] Arcade hardware for a native build (ARCADE_HARDWARE)
 * @param {string} [args.baseUrl] where static/ is served from (default: the page's base)
 * @param {boolean} [args.fetchExtensions] fetch github: extensions this build does not vendor
 *   (extension-fetch.js); default: allowed unless the build denies remote extensions
 * @returns {Promise<{success: boolean, outfiles: object, diagnostics: object[], netAttempts: string[],
 *   fetchedExtensions: object[]}>} `fetchedExtensions`: what was fetched, with its licence
 */
export async function compileMakeCode ({target, files, native = false, embedSource = null, hwVariant = '', baseUrl,
    fetchExtensions = remoteExtensionsAllowed(), fetch, fetchOptions} = {}) {
    if (!MAKECODE_TARGETS.includes(target)) {
        throw new MakeCodeError(`MakeCode ${target || 'unknown'} is not a target this build carries ` +
            `(${MAKECODE_TARGETS.join(', ')})`, 'UNSUPPORTED_TARGET');
    }
    if (!files || !files['pxt.json']) throw new MakeCodeError('a MakeCode project needs its pxt.json', 'COMPILE');
    const extensions = await onDemandExtensions(target, files, fetchExtensions, fetch, fetchOptions);
    const base = new URL(runtimeBase(target), baseUrl || document.baseURI).href;
    const w = workerFor(base);
    try {
        await w.ready;
        return withFetched(await callWithExtensions(w, {op: 'compile', files, native, embedSource, hwVariant}, extensions), extensions);
    } catch (error) {retainExtensionFailure(error,extensions);throw error;}
    finally { w.dispose(); }
}

/** Install the CURRENT project's declared package inputs without compiling.
 * Fetch policy and disposable worker lifetime match the existing compile route.
 */
export async function resolveProjectInputsMakeCode({target,files,baseUrl,
    fetchExtensions = remoteExtensionsAllowed(),fetch,fetchOptions} = {}) {
    if (!MAKECODE_TARGETS.includes(target)) throw new MakeCodeError('Unsupported MakeCode target: '+target,'UNSUPPORTED_TARGET');
    if (!files || typeof files['pxt.json'] !== 'string') throw new MakeCodeError('a MakeCode project needs its pxt.json','COMPILE');
    const extensions = await onDemandExtensions(target,files,fetchExtensions,fetch,fetchOptions);
    const base = new URL(runtimeBase(target),baseUrl || document.baseURI).href;
    let worker;
    try {
        worker = workerFor(base);
        await worker.ready;
        return withFetched(await callWithExtensions(worker,{op:'resolveProjectInputs',files},extensions),extensions);
    } catch (error) {retainExtensionFailure(error,extensions);throw error;}
    finally {if (worker) worker.dispose();}
}

/**
 * The github: extensions a project needs that this build does not vendor,
 * fetched (extension-fetch.js) unless fetching is off. Refusals are kept so a
 * missing extension's error can say why it could not be fetched.
 */
export async function onDemandExtensions (target, files, enabled, fetch, fetchOptions) {
    let deps;
    try { deps = JSON.parse(files['pxt.json']).dependencies || {}; } catch { return {extensions: [], refused: []}; }
    if (!unresolvedGithubDependencies(deps, target, EXTENSION_TABLE).length) return {extensions: [], refused: []};
    if (!enabled) return {extensions: [], refused: [], disabled: true};
    return fetchMakeCodeExtensions({dependencies: deps, target, table: EXTENSION_TABLE, ...(fetch ? {fetch} : {}), ...(fetchOptions || {})});
}

function retainExtensionFailure(error,onDemand) {
    if (!error || typeof error !== 'object') return;
    error.fetchRefusals = onDemand.refused;error.fetchedExtensions = fetchedExtensions(onDemand);
    if (onDemand.disabled) error.fetchDisabled = true;
}

async function callWithExtensions (w, msg, onDemand) {
    try {
        return await w.call({...msg, extensions: onDemand.extensions.map(({id, repo, refs, targets, files}) => ({id, repo, refs, targets, files}))});
    } catch (e) {
        retainExtensionFailure(e,onDemand);
        if (e && e.code === 'NO_EXTENSION') {
            const why = onDemand.disabled ? ' (this build does not fetch extensions)' :
                onDemand.refused.length ? ' — could not fetch: ' + onDemand.refused.map(r => `${r.id} (${r.reason})`).join('; ') : '';
            e.message += why;
            e.refused = onDemand.refused;
        }
        throw e;
    }
}

const fetchedExtensions = onDemand => onDemand.extensions.map(e =>
    ({id:e.id,repo:e.repo,ref:e.refs[0],...e.fetched}));
const withFetched = (result,onDemand) => ({...result,fetchedExtensions:fetchedExtensions(onDemand),
    fetchRefusals:onDemand.refused,...(onDemand.disabled ? {fetchDisabled:true} : {})});

/**
 * Refuse, by name, a firmware base the emulator must not run. The one check
 * every emulator path goes through (the worker's emulatorBase only sends back
 * the sha256 of what it refused). Throws MakeCodeError with the verdict's code.
 * @param {string} sha256 of the base's .hex bytes
 * @returns {object} the base's licence record, when it is clean
 */
export function assertEmulatorBase (sha256) {
    const v = emulatorBaseVerdict(sha256);
    if (!v.ok) throw new MakeCodeError(v.reason, v.code, {baseSha256: sha256});
    return v.licence;
}

/** The sha256s of the bases the emulator may run (base-licences.js: classification 'clean'). */
export const EMULATOR_CLEAN_BASES = Object.freeze(Object.keys(BASE_LICENCES).filter(k => emulatorBaseVerdict(k).ok));

/**
 * Compile a micro:bit project for the EMULATOR: the V2 variant only ('mbcodal'),
 * linked onto a Bluetooth-free base from static/makecode/microbit/hexcache-emu/
 * (scripts/build-makecode-emu-bases.mjs) — never onto the official bases, whose
 * Nordic SoftDevice may only run on a Nordic chip. A base that is not clean is
 * refused by name (assertEmulatorBase); a package set with no emulator base is
 * NO_BASE_HEX, as for a download. The result's outfiles['binary.hex'] is a plain
 * (not universal) V2 image with its vector table at 0.
 */
export async function compileMakeCodeForEmulator ({target = 'microbit', files, baseUrl, fetchExtensions = remoteExtensionsAllowed(), fetch, fetchOptions} = {}) {
    if (target !== 'microbit') {
        throw new MakeCodeError(`MakeCode ${target} has no emulator firmware bases (only the micro:bit V2 does)`, 'UNSUPPORTED_TARGET');
    }
    if (!files || !files['pxt.json']) throw new MakeCodeError('a MakeCode project needs its pxt.json', 'COMPILE');
    const extensions = await onDemandExtensions(target, files, fetchExtensions, fetch, fetchOptions);
    const base = new URL(runtimeBase(target), baseUrl || document.baseURI).href;
    const w = workerFor(base);
    try {
        await w.ready;
        return withFetched(await callWithExtensions(w, {op: 'compile', files, native: true, appVariant: 'mbcodal', emulator: true, cleanBases: EMULATOR_CLEAN_BASES}, extensions), extensions);
    } catch (e) {
        if (e && e.code === 'BASE_REFUSED') assertEmulatorBase(e.baseSha256);
        throw e;
    } finally { w.dispose(); }
}

/**
 * The Arcade hardware a native build can target: pxt-arcade's hw---<variant>
 * packages built by pxt's CODAL engine (hw---rpi and hw---vm are Linux builds,
 * not here). `family` is the UF2 family id pxt writes (null: the build is an
 * Intel HEX, not a UF2 — the nRF52833 boards). `chip` is the part number, the
 * same in every language. Which PRODUCT is which variant is pxt-arcade's own
 * list, not this table: arcadeBoards() reads it from the served runtime.
 */
export const ARCADE_HARDWARE = Object.freeze({
    rp2040: {name: 'Raspberry Pi Pico (RP2040)', chip: 'RP2040', family: 0xe48bff56},
    samd51: {name: 'SAMD51 ("D5")', chip: 'SAMD51', family: 0x55114460},
    samd51adafruit: {name: 'SAMD51, Adafruit bootloader layout (PyBadge, PyGamer, EdgeBadge)', chip: 'SAMD51', family: 0x55114460},
    stm32f401: {name: 'STM32F401 ("F4", Meowbit and similar)', chip: 'STM32F401', family: 0x57755a57},
    n3: {name: 'nRF52833 ("N3")', chip: 'nRF52833', family: null},
    gdk: {name: 'nRF52833 Game Designer\'s Kit', chip: 'nRF52833', family: null},
    n4: {name: 'nRF52840 ("N4", experimental)', chip: 'nRF52840', family: 0xada52840}
});

/** Where the board picker's list is served (scripts/sync-makecode-runtime.mjs arcadeHardwareList). */
export const ARCADE_BOARDS_FILE = 'hardware.json';

/**
 * The picker's entries from the served list: each board pxt-arcade names, with
 * the variant it builds for and the file it downloads. An entry whose variant
 * is not ARCADE_HARDWARE (a new pxt-arcade pin added one) is dropped, not
 * guessed at. `card` entries are pxt's per-chip cards ("R2", "D5"…), for a
 * board no product names.
 * @param {{name: string, variant: string, card?: boolean}[]} list
 * @returns {{name: string, variant: string, card: boolean, chip: string, ext: 'uf2'|'hex', family: number|null}[]}
 */
export function arcadeBoardsFrom (list) {
    return (Array.isArray(list) ? list : [])
        .filter(b => b && typeof b.name === 'string' && b.name && ARCADE_HARDWARE[b.variant])
        .map(b => {
            const hw = ARCADE_HARDWARE[b.variant];
            return {name: b.name, variant: b.variant, card: !!b.card, chip: hw.chip,
                ext: hw.family === null ? 'hex' : 'uf2', family: hw.family};
        });
}

/**
 * The Arcade boards this build can make firmware for — pxt-arcade's own
 * hardware list, as the sync served it (only boards whose base is served).
 * Absent (the runtime was not synced), [] — the picker then offers nothing.
 * @param {{baseUrl?: string}} [args]
 */
export async function arcadeBoards ({baseUrl} = {}) {
    const url = new URL(runtimeBase('arcade') + ARCADE_BOARDS_FILE, baseUrl || document.baseURI).href;
    const res = await fetch(url).catch(() => null);
    if (!res || !res.ok) return [];
    return arcadeBoardsFrom(await res.json().catch(() => []));
}

/**
 * The flashable file in a native build's outfiles. pxt returns a UF2 as BASE64
 * text (outfiles['binary.uf2']) and a .hex as text; this gives the bytes a
 * download writes, so the caller never has to know which.
 * @returns {{name: string, bytes: Uint8Array}|null}
 */
export function firmwareFile (outfiles = {}) {
    if (outfiles['binary.uf2']) {
        const bin = atob(outfiles['binary.uf2']);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return {name: 'binary.uf2', bytes};
    }
    if (outfiles['binary.hex']) return {name: 'binary.hex', bytes: new TextEncoder().encode(outfiles['binary.hex'])};
    return null;
}

/**
 * The C++ packages MakeCode's editor adds to a new micro:bit project; a project
 * whose package set is this one links onto a shipped firmware base. Exported so
 * a project WE write (the blocks export) uses the set that has a base.
 */
export const MICROBIT_DEFAULT_DEPENDENCIES = Object.freeze({core: '*', radio: '*', microphone: '*'});
