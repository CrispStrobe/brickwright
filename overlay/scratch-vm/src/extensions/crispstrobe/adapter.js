const localArrayResultBindings = require('./arcade/local-array-result-bindings')();
const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const TargetType = require('../../extension-support/target-type');
const Cast = require('../../util/cast');
const BWValues = require('../../util/bw-values');
const currentNumberInput = require('../../util/bw-current-number-input');
const formatMessage = require('format-message');

// Older bundled extensions sometimes use stable English menu values directly
// as their labels. Preserve those values for saved projects and localize only
// what the learner sees. This also covers bundles whose own translation table
// predates a newly added menu item (for example `forward`).
const GERMAN_MENU_LABELS = {
    forward: 'vorwärts', backward: 'rückwärts', reverse: 'umkehren',
    brake: 'bremsen', coast: 'ausrollen', on: 'an', off: 'aus', any: 'beliebig',
    up: 'oben', down: 'unten', left: 'links', right: 'rechts'
};
const localizeLegacyMenus = info => {
    const locale = String(formatMessage.setup().locale || 'en').toLowerCase();
    if (!locale.startsWith('de') || !info || !info.menus) return info;
    for (const menu of Object.values(info.menus)) {
        if (!menu || !Array.isArray(menu.items)) continue;
        menu.items = menu.items.map(item => {
            if (typeof item !== 'string' || !GERMAN_MENU_LABELS[item]) return item;
            return {text: GERMAN_MENU_LABELS[item], value: item};
        });
    }
    return info;
};

// Xcratch extensions ship as ES modules (`.mjs`) with top-level `export`
// statements, but we run source through `new Function` (a function body, where
// `export` is a syntax error: "export declarations may only appear at top level
// of a module"). These bundles are self-contained (no top-level `import`), so we
// rewrite their exports to CommonJS assignments the adapter already understands.
// Anchored at line start to avoid touching `export`-like text inside code.
const esmToCjs = source => source
    .replace(/^[ \t]*export[ \t]+default[ \t]+/m, 'module.exports.default = ')
    .replace(/^[ \t]*export[ \t]*\{([^}]*)\}[ \t]*;?[ \t]*$/gm, (_match, names) =>
        names
            .split(',')
            .map(n => {
                const [local, exported] = n.trim().split(/\s+as\s+/);
                if (!local) return '';
                return `module.exports[${JSON.stringify((exported || local).trim())}] = ${local.trim()};`;
            })
            .join(' '))
    .replace(/^([ \t]*)export[ \t]+(const|let|var|function|class|async)\b/gm, '$1$2');

// The program's clock (docs/SIM-LAB-PLAN.md §4.9, "One clock"). While the Robot Lab owns
// the clock it sets `runtime.bwProgramClock` (gui lib/bw-sim/sim-clock.js): program time
// then advances only as fast as the simulated world, and an extension's timers must run on
// it too, or `move for 2 seconds` ends early in simulated time whenever the physics is
// slower than real time. So each extension's source sees these names in place of the
// globals: they use the program clock while one is set, and the browser's own otherwise
// (every other moment, and every extension outside the Robot Lab, behaves as before). A
// handle the program clock made is cancelled by it, wherever the timer runs by then.
// `window.setTimeout` and friends stay the browser's: an explicit global is a wall-clock
// wait on purpose (Bluetooth discovery).
const PROGRAM_CLOCK_NAMES = ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'];
const programClockBindings = runtime => {
    const clock = () => (runtime && runtime.bwProgramClock) || null;
    const ownTimer = handle => handle !== null && typeof handle === 'object' && handle.bwProgramTimer === true;
    const now = () => {
        const c = clock();
        return c ? c.now() : Date.now();
    };
    return [
        (fn, ms, ...args) => {
            const c = clock();
            return c ? c.setTimeout(fn, ms, ...args) : globalThis.setTimeout(fn, ms, ...args);
        },
        handle => (ownTimer(handle) ? handle.clock.clearTimer(handle) : globalThis.clearTimeout(handle)),
        (fn, ms, ...args) => {
            const c = clock();
            return c ? c.setInterval(fn, ms, ...args) : globalThis.setInterval(fn, ms, ...args);
        },
        handle => (ownTimer(handle) ? handle.clock.clearTimer(handle) : globalThis.clearInterval(handle)),
        // `new Date()`, Date.UTC, instanceof: the real Date; only Date.now reads the program clock.
        new Proxy(Date, {get: (target, key) => (key === 'now' ? now : Reflect.get(target, key))})
    ];
};

// Build a `Scratch` shim and run a CrispStrobe extension source, returning a built-in
// extension CLASS (the scratch-vm ExtensionManager instantiates it with `new Cls(runtime)`).
// TurboWarp modules self-register via Scratch.extensions.register; Xcratch modules export
// { blockClass, entry }. Both converge on an object with getInfo() + opcode methods.
module.exports = function makeCrispExtension (source, dependencies = null, arrayRegistration = null) {
    return class CrispStrobeExtension {
        constructor (runtime) {
            this.runtime = runtime;
            let captured = null, inst = null;
            const Scratch = {
                BlockType, ArgumentType, TargetType, Cast, BWValues,
                BWNumberInput: (args, util, opcode, name) => currentNumberInput(runtime, args, util, opcode, name),
                translate: Object.assign(m => (m && typeof m === 'object' ? (m.default || '') : m), { setup: () => {} }),
                extensions: { register: inst => { captured = inst; }, unsandboxed: true, isPenguinMod: false },
                vm: runtime && runtime.emit ? { runtime } : {}, runtime,
                // TurboWarp's Scratch.fetch, as the extension worker gives it (legonxt's compile block).
                fetch: (...a) => fetch(...a)
            };
            // Only a trusted module-held registration may install Array guards.
            // Existing two-argument callers retain the ordinary adapter path.
            if (arrayRegistration !== null) {
                const service = require('../../util/bw-array-operations').bind(runtime, arrayRegistration, source, () => inst);
                Object.defineProperty(Scratch, 'BWArrayOperations', {value: service, enumerable: true});
            }
            // Trusted built-ins opt into modules with their compiled closures intact.
            if (dependencies !== null) Scratch.BWExtensionDependencies = dependencies;
            // Yes/no questions an extension can wait for (task E7). In the desktop/iOS app
            // `window.confirm` returns a Promise (tauri-plugin-dialog), always truthy, so the
            // CrispStrobe extensions ask through `Scratch.BWConfirm(message) -> Promise<boolean>`
            // when the host offers it, and the browser's confirm otherwise. The GUI installs
            // `runtime.confirmAsync` (lib/extension-confirm-hook.js: E6's confirmAsync, a native
            // OK/Cancel in the app). Read at each question, not at load, so a hook installed
            // after an extension loaded still answers; absent, the field is absent and the
            // extension's own fallback runs.
            Object.defineProperty(Scratch, 'BWConfirm', {
                enumerable: true,
                get: () => (runtime && typeof runtime.confirmAsync === 'function' ?
                    message => runtime.confirmAsync(String(message)) :
                    undefined)
            });
            // In the browser the extension's top-level code (language detection etc.) runs with
            // the real window/navigator; we only inject Scratch.
            // eslint-disable-next-line no-new-func
            const run = new Function('Scratch', 'module', 'exports', ...PROGRAM_CLOCK_NAMES, esmToCjs(source));
            const mod = { exports: {} };
            run(Scratch, mod, mod.exports, ...programClockBindings(runtime));
            const xcx = mod.exports && (mod.exports.blockClass || (mod.exports.default && mod.exports.default.blockClass));
            inst = captured || (xcx && new xcx(runtime)) ||
                (typeof mod.exports === 'function' ? new mod.exports(runtime) : mod.exports);
            // delegate getInfo + every opcode method onto this
            this._inst = inst;
            for (let p = inst; p && p !== Object.prototype; p = Object.getPrototypeOf(p)) {
                for (const k of Object.getOwnPropertyNames(p)) {
                    if (k !== 'constructor' && typeof inst[k] === 'function' && !(k in this)) this[k] = inst[k].bind(inst);
                }
            }
            if (arrayRegistration !== null) {
                localArrayResultBindings.bindConstructor(runtime, this, inst, require('../../engine/runtime'));
            }
            // Capture genuine source-operation delegates before this adapter
            // escapes; later getInfo/registration cannot bless a replacement.
            if (typeof dependencies?.bindSourceOperationAdapter === 'function') {
                if (typeof this._inst._bindSourceOperationAdapter !== 'function') throw new Error('Source-operation constructor binding is missing');
                this._inst._bindSourceOperationAdapter(this);
            }
        }
        getInfo () {
            const info = localizeLegacyMenus(this._inst.getInfo());
            if (arrayRegistration !== null) localArrayResultBindings.bindInfo(info, this, this._inst);
            // Only Arcade's supplied module closure owns this optional hook.
            // Ordinary adapters and the separate Array token path are unchanged.
            if (typeof dependencies?.bindScoreAdapterInfo === 'function') {
                dependencies.bindScoreAdapterInfo(info, this, this._inst);
            }
            if (typeof dependencies?.bindSceneClockAdapterInfo === 'function') {
                dependencies.bindSceneClockAdapterInfo(info, this, this._inst);
            }
            if (typeof dependencies?.bindFrameDeltaAdapterInfo === 'function') {
                dependencies.bindFrameDeltaAdapterInfo(info, this, this._inst);
            }
            if (typeof dependencies?.bindNullSpriteAdapterInfo === 'function') {
                dependencies.bindNullSpriteAdapterInfo(info, this, this._inst);
            }
            return info;
        }
    };
};

Object.defineProperty(module.exports, 'localArrayResultBindingsCurrent', {value: localArrayResultBindings.current});
