/**
 * The first load must not carry what the first load does not use.
 *
 * Measured on the 2026-09-05 production build, BEFORE this campaign, the two
 * scripts index.html loads eagerly were 4.3 MB compressed, and over half of the
 * boot vendor chunk was three things no first paint needs:
 *
 *   music extension samples (61 files, base64 in JS)   1.46 MB compressed
 *   scratch-render-fonts (seven faces, base64)          0.64 MB
 *   text-encoding polyfill (encoding-indexes)           0.20 MB
 *
 * plus the LEGO hub drivers (~0.4 MB) and, in the entry bundle, the asset
 * library manifests (0.15 MB) and the lesson waves (0.07 MB). Each now lives in
 * a chunk requested on demand. Every one of those moves is a one-character
 * regression away from silently undoing itself — a `require` for an `import()`,
 * a lost alias, a static import of a JSON — and the app works exactly as well
 * either way, so nothing else notices. This does. Same shape as
 * verify-labwired-lazy-bundle.mjs: it reads the REAL build and asks where the
 * bytes are.
 *
 * Markers are string literals that survive minification and occur only in the
 * module that must stay lazy. Sizes are reported, not asserted: a byte budget
 * that is right for a production build is wrong for a development one, and a
 * gate that fails on the mode rather than the code is a gate people disable.
 *
 * Run after a build:  node scripts/verify-boot-payload.mjs
 * Point at a different build:  BW_BUILD=path/to/build node scripts/verify-boot-payload.mjs
 */
import {readFileSync, existsSync, readdirSync, statSync} from 'node:fs';
import {join, resolve, dirname, basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import {proveMenuLazyCompanion} from './lib/boot-lazy-companion.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = process.env.BW_BUILD
    ? resolve(process.env.BW_BUILD)
    : join(root, 'packages', 'scratch-gui', 'build');

/**
 * What must NOT be in an eagerly-loaded script, and the chunk it belongs in.
 * `chunk` is a prefix under build/chunks/ — production names carry a hash.
 */
const LAZY = [
    {what: 'Circuit Playground runtime', marker: 'ID: circuitplayground', chunk: 'ext-circuitplayground',
        why: 'lazyBuiltinExtensions.circuitplayground in extension-manager.js'},
    {what: 'music extension samples', marker: "'drums/1-snare.mp3'", altMarkers: ['"drums/1-snare.mp3"'],
        chunk: 'ext-music', why: 'lazyBuiltinExtensions.music in overlay/scratch-vm/src/extension-support/extension-manager.js'},
    {what: 'render fonts', marker: 'x-font-ttf', chunk: 'render-fonts',
        why: 'the scratch-render-fonts alias in overlay/scratch-gui/webpack.config.js and src/lib/lazy-render-fonts.js'},
    {what: 'LEGO NXT driver', marker: 'ID: legonxt', chunk: 'ext-legonxt',
        why: 'lazyBuiltinExtensions.legonxt in extension-manager.js'},
    {what: 'Arcade runtime (its speech fonts)', marker: 'font12: Adobe SIL OFL 1.1', chunk: 'ext-arcade',
        why: 'lazyBuiltinExtensions.arcade in extension-manager.js'},
    // The Arcade frame phase (~26 KiB) is handed to the runtime by the lazy extension, not required by runtime.js.
    {what: 'Arcade frame phase', marker: 'Arcade phase work budget must be finite and positive', chunk: 'ext-arcade',
        why: 'dependencies.framePhase in arcade/index.js (runtime._attachArcadeFramePhase receives the class)'},
    {what: 'Robot Lab blocks', marker: 'when part [PART] touches [OTHER]', chunk: 'ext-robotlab',
        why: 'lazyBuiltinExtensions.robotlab in extension-manager.js'},
    // The extension menu-shape table (~35 KB): read by the Code tab's compiler and by the
    // load-time repair of extension projects; the first load carries only the import() call.
    {what: 'extension menu shape table', marker: '+MULTIPLE_PORT', chunk: 'bw-extension-menus',
        menuCompanion: true,
        why: 'the import() in lib/arcade-project-migration.js (lib/extension-menu-args.js)'},
    // Autosave, project-structure history and error notes load after the first
    // paint; the History & autosave panel only when it is opened.
    {what: 'autosave and project history', marker: 'data-bw-error-notes', chunk: 'bw-project-safety',
        why: 'the import() in overlay/scratch-gui/src/playground/render-gui.jsx (webpackChunkName "bw-project-safety")'},
    {what: 'the History & autosave panel', marker: 'bw-autosave-confirm-restore', chunk: 'bw-history-panel',
        why: 'the import() in overlay/scratch-gui/src/lib/bw-project-safety.js (webpackChunkName "bw-history-panel")'},
    {what: 'the About dialog\'s app showcase', marker: 'about-app-showcase', chunk: 'about-apps',
        why: 'the React.lazy AppShowcase in overlay/scratch-gui/src/components/menu-bar/bw-about.jsx (webpackChunkName "about-apps")'},
    {what: 'Robot Lab tab', marker: 'Open the Robot Lab here', chunk: 'bw-robotlab-tab',
        why: 'the React.lazy RobotLabTab in components/gui/gui.jsx'},
    {what: 'LEGO SPIKE Prime driver', marker: 'ID: spikeprime\\n', altMarkers: ['ID: spikeprime\n'], chunk: 'ext-spikeprime',
        why: 'lazyBuiltinExtensions.spikeprime in extension-manager.js'},
    // `md5ext` is NOT the marker: the default project and scratch-vm's serializer
    // carry that key too. The first sprite's name occurs only in the manifests.
    {what: 'asset library manifests', marker: '"name":"Abby"', chunk: 'asset-library-index',
        why: 'the import() calls in the library containers and src/lib/offline-assets.js'},
    // The circuit designer and the board library (971bf4207 deferred them for the
    // debugger-only layouts). test/circuit-designer-load-policy.test.mjs asserts
    // the boundary by reading circuit-tab.jsx's TEXT; this asserts it in BYTES —
    // a specifier that moves to a third file the initial chunk still pulls in
    // passes the text and fails here. Location only: some layouts DO request
    // these chunks at first paint, so "not preloaded" is the eager-script check.
    // Since bw-circuit-ui's lazy per-kind part art (pin 7f98562f: one `part-art-*` chunk per
    // kind, a require.context in the designer), webpack's splitChunks moves the package's code
    // out of the named entry into an anonymous chunk that only the bw-circuit-ui request group
    // loads (build of 61eb1cda9: bw-circuit-ui.js is 10 KiB — the art context map — and the
    // DRC/board-canvas code sits in chunks/37071.*.js, 1.7 MiB, requested beside it). So these
    // three markers are looked for in lazy JS, like bw-board's; the eager-script and preload
    // checks are unchanged.
    {what: 'circuit DRC rules', marker: 'Check the address decode wiring on the breadboard.', chunk: 'bw-circuit-ui',
        sharedLazy: true,
        why: 'the guarded load in overlay/scratch-gui/src/components/tw-pseudocode/circuit-tab.jsx (webpackChunkName "bw-circuit-ui")'},
    // The German words for those findings (bw-circuit-ui src/i18n/drc-de.js) come with the
    // designer as well; the first-load budget has no room for a translation table. ASCII-only
    // marker, so minification cannot escape it into a different spelling.
    {what: 'German DRC texts', marker: 'Bus-Extraktor fehlgeschlagen: ', chunk: 'bw-circuit-ui',
        sharedLazy: true,
        why: 'the guarded load in circuit-tab.jsx (webpackChunkName "bw-circuit-ui"); drc-de.js is imported only by designer components'},
    {what: 'board canvas', marker: 'Could not recognise this file', chunk: 'bw-circuit-ui',
        sharedLazy: true,
        why: 'the guarded load in circuit-tab.jsx (webpackChunkName "bw-circuit-ui")'},
    // The Circuit tab's panel switch and panel views (Robot Lab conventions): loaded with the
    // designer, never at boot (the tab is mounted from the start). The marker is the panel
    // header's test id, which only circuit-panels.jsx carries.
    {what: 'the Circuit tab panels', marker: 'bw-circuit-panel-header', chunk: 'bw-circuit-panels',
        why: 'the guarded load in circuit-tab.jsx (webpackChunkName "bw-circuit-panels")'},
    {what: '6502 bus extractor (bw-board)', marker: 'no RAM, ROM, VIA or ACIA on the board', chunk: 'bw-board',
        // npm package modules shared by multiple lazy consumers may be extracted
        // into an anonymous split chunk. Keep the named entry requirement and
        // eager-byte prohibition; require the marker in emitted lazy JS too.
        sharedLazy: true,
        why: 'the guarded load in circuit-tab.jsx (webpackChunkName "bw-board")'},
    // three.js and the arena's 3D view (task D3): fetched when a learner opens
    // the 3D view, not with the simulator pane (chunk bw-spike-simulator), and never at
    // boot. The marker is a string in three's WebGLRenderer, the one class the
    // view cannot be without; the second is the view's own canvas test id.
    // webpack's splitChunks moves the three package itself into an anonymous
    // vendor chunk that only bw-arena-3d requests (measured on a production
    // build: 589 KiB raw, 144 KiB gz), so its marker is looked for in lazy JS.
    {what: 'three.js (the arena 3D view\'s renderer)', marker: 'WebGL 1 is not supported since r163.', chunk: 'bw-arena-3d',
        sharedLazy: true, notInChunks: ['bw-spike-simulator'],
        why: 'the dynamic import in overlay/scratch-gui/src/components/tw-pseudocode/spike-arena-pane.jsx (webpackChunkName "bw-arena-3d")'},
    {what: 'the arena 3D view', marker: 'bw-spike-arena-3d-canvas', chunk: 'bw-arena-3d',
        notInChunks: ['bw-spike-simulator'],
        why: 'the dynamic import in spike-arena-pane.jsx (webpackChunkName "bw-arena-3d")'},
    // The Sim Lab (docs/SIM-LAB-PLAN.md §0): the part catalog and the scene code
    // arrive when a learner opens the Sim Lab tab, never with the simulator pane
    // (chunk bw-spike-simulator), never at boot. Jolt's WebAssembly physics is
    // lazier still (ROADMAP §4.9): the physics worker (its own chunk) loads it, and
    // the Sim Lab's main-thread chunk must not carry it — the main thread fetches
    // it only where there is no worker. Jolt's marker is one of its emscripten
    // binding names; the view's is its canvas test id; the worker's is a refusal
    // only its message host (physics-host.js) says.
    {what: 'Jolt physics (the Sim Lab engine)', marker: 'JoltInterface_GetPhysicsSystem_', chunk: 'bw-sim-jolt',
        sharedLazy: true, notInChunks: ['bw-spike-simulator', 'bw-sim-lab'],
        why: 'loadJolt\'s dynamic import in overlay/scratch-gui/src/lib/bw-sim/physics/jolt-core.js (webpackChunkName "bw-sim-jolt")'},
    {what: 'the Sim Lab physics worker', marker: 'sim batch before sim load', chunk: 'bw-sim-physics-worker',
        notInChunks: ['bw-spike-simulator', 'bw-sim-lab'],
        why: 'startPhysicsWorker in overlay/scratch-gui/src/lib/bw-sim/sim-lab.js (new Worker(new URL(…)), webpackChunkName "bw-sim-physics-worker")'},
    // The Robot Lab editor itself (its pane and icon toolbar): its own editor tab loads it when the tab
    // is first shown (robot-lab-tab.jsx, React.lazy), so it is neither in the boot scripts nor in the
    // arena pane's chunk any more (the arena only offers "Open in Robot Lab"). The marker is the
    // toolbar's test id, which only sim-lab-toolbar.jsx carries.
    {what: 'the Robot Lab editor (pane and toolbar)', marker: 'bw-sim-lab-toolbar', chunk: 'bw-robot-lab',
        notInChunks: ['bw-spike-simulator'],
        why: 'React.lazy in overlay/scratch-gui/src/components/tw-pseudocode/robot-lab-tab.jsx (webpackChunkName "bw-robot-lab")'},
    {what: 'the Sim Lab 3D view', marker: 'bw-sim-lab-3d-canvas', chunk: 'bw-sim-lab',
        notInChunks: ['bw-spike-simulator'],
        why: 'the dynamic import in sim-lab-pane.jsx (webpackChunkName "bw-sim-lab")'},
    // The Robot Lab's Scratch Link doubles (docs/ROBOT-LAB-HUBS-PLAN.md P0): the BLE socket double
    // (lib/virtual-hub/scratch-link-ble.js) and the BT-classic peripheral registry
    // (lib/virtual-hub/bt-classic-registry.js) serve only the Lab's virtual hubs, so they come with
    // the Sim Lab chunk. The first load keeps only the classic URL test and WebSocket wrapper
    // (spike-classic-scratch-link.js) that SPIKE's 2.x REPL simulation claims through at boot;
    // render-gui.jsx once imported the BLE double eagerly.
    {what: 'the Scratch Link BLE double', marker: 'the virtual chooser refused this peripheral', chunk: 'bw-sim-lab',
        why: 'registerRobotLabBlePeripherals (lib/virtual-hub/lab-ble-peripherals.js) installs it, reached only through sim-lab.js (webpackChunkName "bw-sim-lab")'},
    {what: 'the BT-classic peripheral registry', marker: 'a virtual peripheral needs an id', chunk: 'bw-sim-lab',
        why: 'sim-lab.js re-exports registerVirtualClassicPeripheral; boot code imports spike-classic-scratch-link.js, never bt-classic-registry.js'},
    // The Build palette's part pictures (lib/bw-sim/view/part-thumbnails.js): three.js
    // draws them, so they come with the Sim Lab chunk, not with the pane that shows them.
    {what: 'the Sim Lab palette thumbnails', marker: 'bw-sim-part-thumbnails', chunk: 'bw-sim-lab',
        notInChunks: ['bw-spike-simulator'],
        why: 'part-thumbnails.js is reached only through sim-lab.js, the dynamic import in sim-lab-pane.jsx (webpackChunkName "bw-sim-lab")'},
    // The building instructions' 3D pages (lib/bw-sim/view/instructions-view.js) and their step order: three.js
    // draws them, so they too come with the Sim Lab chunk, not with the pane's Instructions button.
    {what: 'the Sim Lab building instructions', marker: 'bw-sim-instructions-canvas', chunk: 'bw-sim-lab',
        notInChunks: ['bw-spike-simulator'],
        why: 'instructions-view.js is reached only through sim-lab.js, the dynamic import in sim-lab-pane.jsx (webpackChunkName "bw-sim-lab")'},
    // The Robot Lab part catalogue in two pieces (overlay/scratch-gui/parts-subset-loader.js): the
    // hand-made core every shipped model uses rides in the Sim Lab chunk; the ~240 derived parts
    // (Build's palette) are their own chunk, fetched when Build opens or a model names one. The
    // markers: a derived part's German name and a core part's (the file's $comment, in both, names neither).
    {what: 'the Robot Lab catalogue\'s derived parts', marker: 'Technic-Stein 1 x 1 mit Loch', chunk: 'bw-sim-parts',
        notInChunks: ['bw-spike-simulator', 'bw-sim-lab'],
        why: 'loadFullCatalog\'s import of parts.json?derived in overlay/scratch-gui/src/lib/bw-sim/sim-lab.js (webpackChunkName "bw-sim-parts")'},
    {what: 'the Robot Lab catalogue\'s core parts', marker: 'Kugelrad-Halter', chunk: 'bw-sim-lab',
        notInChunks: ['bw-spike-simulator', 'bw-sim-parts'],
        why: 'sim-lab.js imports parts.json?core (parts-subset-loader.js); the derived chunk must not repeat it'},
    {what: 'lesson waves', marker: '"journeyId":"lesson-waves', altMarkers: ['journeyId:"lesson-waves'], chunk: 'guided-lessons',
        why: 'React.lazy(GuidedLessons) in src/components/gui/gui.jsx',
        // The core lessons.json IS eager (gui.jsx needs it for journey routing), so the
        // marker must be one only the waves carry. Checked below against the chunk.
        optional: true}
];
/**
 * Present in an EAGER script: the pieces whose absence would silently degrade
 * something rather than fail it. The render-fonts shim only works if
 * scratch-render's SVGSkin was patched to wait for it (scripts/apply-render-overlay.mjs);
 * a build that skipped that step draws text costumes in fallback faces and
 * looks fine to every other gate.
 */
const PRESENT = [
    {what: 'SVGSkin waits for the lazy render fonts', marker: '_bwFontWait',
        why: 'scripts/apply-render-overlay.mjs must run after npm install (build.yml, vercel-build.sh)'}
];
/** Present nowhere in the build: the polyfill is aliased away, not moved. */
const GONE = [
    {what: 'text-encoding polyfill (encoding-indexes)', marker: '"ibm866":[',
        why: "the text-encoding alias in overlay/scratch-gui/webpack.config.js"},
    // `IntlPolyfill` is the intl package's own global; react-intl's locale data
    // uses `addLocaleData` without the underscore prefix, so this does not
    // match the messages we do ship.
    {what: 'Intl polyfill (the intl package)', marker: 'IntlPolyfill',
        why: "overlay/scratch-gui/src/playground/index.jsx no longer imports 'intl'; every browserslist target has Intl"}
];

const failures = [];
const check = (name, ok, detail = '') => {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures.push(name);
};
const kib = n => `${(n / 1024).toFixed(0)} KiB`;
const has = (src, m) => src.includes(m.marker) || (m.altMarkers || []).some(a => src.includes(a));

if (!existsSync(join(build, 'index.html'))) {
    console.error('verify-boot-payload: packages/scratch-gui/build/index.html is missing.\n'
        + 'This gate inspects a real build; build first:\n'
        + '  node scripts/integrate.mjs && cd packages/scratch-gui && npm run build');
    process.exit(1);
}

const html = readFileSync(join(build, 'index.html'), 'utf8');
const fromHtml = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map(m => m[1])
    .map(s => s.replace(/^\.?\//, ''))
    .filter(s => !/^https?:/.test(s));
const atRoot = readdirSync(build).filter(f => f.endsWith('.js'));
const eager = [...new Set([...fromHtml, ...atRoot])]
    .map(rel => join(build, rel))
    .filter(p => existsSync(p) && statSync(p).isFile());

check('the build has eager scripts to inspect at all', eager.length > 0,
    eager.map(p => basename(p)).join(', '));

const eagerSources = eager.map(p => ({p, src: readFileSync(p, 'utf8')}));
let rawTotal = 0;
let gzTotal = 0;
for (const {p, src} of eagerSources) {
    const gz = gzipSync(src).length;
    rawTotal += src.length;
    gzTotal += gz;
    console.log(`     ${basename(p).slice(0, 60).padEnd(60)} ${kib(src.length).padStart(10)} raw ${kib(gz).padStart(9)} gz`);
}
console.log(`     ${'FIRST LOAD (scripts)'.padEnd(60)} ${kib(rawTotal).padStart(10)} raw ${kib(gzTotal).padStart(9)} gz`);
// A RATCHET on the compressed size of the eager scripts. verify-first-load-weight
// sees what the browser fetched from python's uncompressed server; this sees what
// webpack emitted, gzipped here, so it does not move with the serving stack. Lower
// it when the app gets lighter; never raise it to make a build pass.
//   2026-09-05: 1,130 KiB gz locally and 1,174 KiB gz on CI's runner for the same
//   tree (run 33989610164) — the two toolchains minify slightly differently, and
//   CI's number is the one this check meets, so the budget is set from it. The
//   morning's live site was ~4,238 KiB gz.
// Production builds only: a development build is 3-4x larger and unminified, and
// a budget that is right for one is meaningless for the other. Minified output
// has no `/***/ "./src/...":` module headers; that is the discriminator.
const EAGER_GZ_BUDGET_KIB = 1300;
const looksMinified = !eagerSources.some(({src}) => /^\/\*\*\*\/ "\.\/(?:src|node_modules)\//m.test(src));
if (looksMinified) {
    check(`eager scripts stay under ${EAGER_GZ_BUDGET_KIB} KiB gzipped`, gzTotal / 1024 <= EAGER_GZ_BUDGET_KIB,
        `${kib(gzTotal)} gz`);
} else {
    console.log(`skip eager gzip ratchet — development build (module headers present); ${kib(gzTotal)} gz here says nothing about production`);
}

const chunksDir = join(build, 'chunks');
const chunkFiles = existsSync(chunksDir) ? readdirSync(chunksDir) : [];
const chunkFor = prefix => chunkFiles.find(f => f === `${prefix}.js` || f.startsWith(`${prefix}.`));

for (const m of LAZY) {
    const contaminated = eagerSources.filter(({src}) => has(src, m)).map(({p}) => basename(p));
    check(`${m.what} are not in the first load`, contaminated.length === 0,
        contaminated.length
            ? `${contaminated.join(', ')} contains ${JSON.stringify(m.marker)} — check ${m.why}`
            : `${eager.length} eager script(s) clean`);
    const chunk = chunkFor(m.chunk);
    check(`${m.what} have their own chunk (chunks/${m.chunk}*.js)`, Boolean(chunk),
        chunk ? `${chunk}, ${kib(statSync(join(chunksDir, chunk)).size)}` : `no chunks/${m.chunk}*.js — check ${m.why}`);
    if (chunk && !m.optional) {
        if (m.menuCompanion && !has(readFileSync(join(chunksDir, chunk), 'utf8'), m)) {
            const matches = chunkFiles.filter(f => f.endsWith('.js') &&
                (f === `${m.chunk}.js` || f.startsWith(`${m.chunk}.`)));
            const eagerNames = new Set(eagerSources.map(({p}) => resolve(p)));
            const proof = matches.length === 1 ? proveMenuLazyCompanion({
                entryName: `chunks/${chunk}`, marker: m.marker, html,
                eagerSources: eagerSources.map(({p, src}) => ({name: p.slice(build.length + 1), source: src})),
                lazySources: chunkFiles.filter(f => f.endsWith('.js') && !eagerNames.has(resolve(chunksDir, f)))
                    .map(f => ({name: `chunks/${f}`, source: readFileSync(join(chunksDir, f), 'utf8')}))
            }) : {ok: false, reason: 'DUPLICATE_NAMED_ENTRY'};
            check(`the marker for ${m.what} belongs to its actual lazy request group`, proof.ok,
                proof.ok ? proof.markerFiles.join(', ') : proof.reason);
            check(`nothing preloads the menu request group`, proof.ok && proof.files.every(f =>
                !html.includes(f) && !html.includes(basename(f))),
            'named entry and every actual companion must be absent from HTML script/preload/prefetch references');
        } else {
        const candidates = m.sharedLazy ? chunkFiles.filter(f => f.endsWith('.js')) : [chunk];
        const found = candidates.filter(f => has(readFileSync(join(chunksDir, f), 'utf8'), m));
        check(`the marker for ${m.what} still discriminates (found in ${m.sharedLazy ? 'lazy JS' : 'its chunk'})`, found.length > 0,
            found.length ? found.join(', ') : `${JSON.stringify(m.marker)} is missing from its permitted lazy chunks — the marker rotted, so the "not in the first load" check above proves nothing`);
        if (m.sharedLazy) check(`nothing preloads shared ${m.what} payloads`,
            found.every(f => !html.includes(f)), 'index.html must not reference the matched shared payload assets');
        }
    }
    check(`nothing preloads ${m.what} into the first load`, !html.includes(m.chunk),
        `index.html must not reference chunks/${m.chunk}*`);
    // A lazy chunk that must not carry it either: loaded for something else.
    for (const other of m.notInChunks || []) {
        const otherChunks = chunkFiles.filter(f => f.endsWith('.js') && (f === `${other}.js` || f.startsWith(`${other}.`)));
        const carrying = otherChunks.filter(f => has(readFileSync(join(chunksDir, f), 'utf8'), m));
        check(`${m.what} are not in chunks/${other}*.js`, otherChunks.length > 0 && carrying.length === 0,
            !otherChunks.length ? `no chunks/${other}*.js to inspect — the check would be vacuous`
                : carrying.length ? `${carrying.join(', ')} contains ${JSON.stringify(m.marker)} — check ${m.why}` : `${otherChunks.join(', ')} clean`);
    }
}
for (const m of PRESENT) {
    const where = eagerSources.filter(({src}) => has(src, m)).map(({p}) => basename(p));
    check(`${m.what} is in the first load`, where.length > 0,
        where.length ? where.join(', ') : `no eager script contains ${JSON.stringify(m.marker)} — ${m.why}`);
}
for (const m of GONE) {
    const anywhere = [...eagerSources.map(({p, src}) => ({p, src})),
        ...chunkFiles.map(f => ({p: join(chunksDir, f), src: readFileSync(join(chunksDir, f), 'utf8')}))]
        .filter(({src}) => has(src, m)).map(({p}) => basename(p));
    check(`${m.what} is not in the build at all`, anywhere.length === 0,
        anywhere.length ? `${anywhere.join(', ')} — check ${m.why}` : `no script carries ${JSON.stringify(m.marker)}`);
}

if (failures.length) {
    console.error(`\n${failures.length} check(s) failed. The first load grew back; see the FAIL lines.`);
    process.exit(1);
}
console.log('\nverify-boot-payload: all checks passed');
