const path = require('path');
const {readFileSync} = require('node:fs');
const webpack = require('webpack');
const {artworkDirectory, buildGalleryArtworkIndexes} = require('./gallery-artwork-index.cjs');

// Plugins
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
// Older single-machine examples carry their target in the program itself.
function addExampleTargets (bytes, filename) {
    if (filename !== path.resolve(__dirname, 'examples/index.json')) return bytes;
    const manifest = JSON.parse(bytes);
    for (const entry of Array.isArray(manifest) ? manifest : manifest.examples || []) {
        const program = entry.files?.program;
        if (!program || entry.device || entry.devices?.length) continue;
        let target = entry.authored;
        if (!target) {
            try {
                const source = readFileSync(path.resolve(path.dirname(filename), program), 'utf8');
                target = source.match(/^\s*DEVICE[ \t]+([\w-]+)/im)?.[1];
            } catch (error) {
                if (error.code !== 'ENOENT') throw error;
            }
        }
        if (target) entry.device = target.toLowerCase().replace(/_/g, '-');
    }
    return JSON.stringify(manifest);
}

const reactProfiling = process.env.BW_REACT_PROFILE === '1';
const remoteCodePolicy = process.env.BW_REMOTE_CODE_POLICY || 'allow';
const distributionPolicy = {
    remoteExtensions: process.env.BW_REMOTE_EXTENSIONS_POLICY || remoteCodePolicy,
    executableToolchains: process.env.BW_REMOTE_TOOLCHAINS_POLICY || remoteCodePolicy,
    machineImages: process.env.BW_REMOTE_MACHINE_IMAGES_POLICY || remoteCodePolicy
};
// Parts from the LDraw catalogue (the Robot Lab palette's "+") are DATA fetched from the
// ldraw-stl mirror, not code: their switch is separate from the remote-code policies and
// their receipt. `deny` builds the app without the catalogue (only the vendored parts).
const remotePartsPolicy = process.env.BW_REMOTE_PARTS_POLICY || 'allow';
if (!['allow', 'deny'].includes(remotePartsPolicy)) {
    throw new Error(`BW_REMOTE_PARTS_POLICY must be "allow" or "deny", got ${JSON.stringify(remotePartsPolicy)}`);
}
const distributionPolicyReceipt = `remote-extensions=${distributionPolicy.remoteExtensions} ` +
    `toolchains=${distributionPolicy.executableToolchains} machine-images=${distributionPolicy.machineImages}`;

if (!['allow', 'deny'].includes(remoteCodePolicy)) {
    throw new Error(`BW_REMOTE_CODE_POLICY must be "allow" or "deny", got ${JSON.stringify(remoteCodePolicy)}`);
}
for (const [name, value] of Object.entries(distributionPolicy)) {
    if (!['allow', 'deny'].includes(value)) {
        throw new Error(`${name} policy must be "allow" or "deny", got ${JSON.stringify(value)}`);
    }
}

const ScratchWebpackConfigBuilder = require('scratch-webpack-configuration');

// Digest-bound proof sources, runtime glue and the pinned CAD SDK retain their verified bytes.
// CopyWebpackPlugin forwards this flag; Terser skips only the marked assets.
const preserveProofAssetInfo = ({filename}) =>
    (/^static\/native-broker\/proof-pins\/sources\/[0-9a-f]{64}\.js$/.test(filename.replace(/\\/g, '/')) ||
        filename.replace(/\\/g, '/') === 'static/labwired/labwired_wasm.js' ||
        filename.replace(/\\/g, '/').startsWith('static/crispbasic/') ||
        filename.replace(/\\/g, '/').startsWith('static/cad-sdk/'))
        ? {minimized: true} : {};

// SDK filenames and imports are owned by Vite. Webpack's RealContentHash
// pass can rewrite hash-like strings in copied JS without renaming those files.
// Restore the digest-verified snapshot AFTER all hash/minify passes.
class PinnedCadSdkPlugin {
    apply(compiler) {
        compiler.hooks.thisCompilation.tap('PinnedCadSdk', compilation => {
            compilation.hooks.processAssets.tap({name:'PinnedCadSdk',stage:webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT}, () => {
                if (process.env.BW_ENABLE_CAD !== '1') return;
                const fs=require('fs'),crypto=require('crypto'),base=path.resolve(__dirname,'static/cad-sdk');
                const manifestBytes=fs.readFileSync(path.join(base,'manifest.json'));
                const manifest=JSON.parse(manifestBytes);
                if(manifest.format!=='brickwright-cad-sdk'||manifest.dirty)throw new Error('CAD SDK must be a clean pinned build');
                for(const name of Object.keys(compilation.assets))if(name.startsWith('static/cad-sdk/'))compilation.deleteAsset(name);
                for(const [name,hash] of Object.entries(manifest.files)){
                    if(name.includes('..')||path.isAbsolute(name))throw new Error('Invalid CAD SDK asset path');
                    const bytes=fs.readFileSync(path.join(base,name));
                    if(crypto.createHash('sha256').update(bytes).digest('hex')!==hash)throw new Error(`CAD SDK source digest mismatch: ${name}`);
                    compilation.emitAsset(`static/cad-sdk/${name}`,new webpack.sources.RawSource(bytes),{minimized:true});
                }
                compilation.emitAsset('static/cad-sdk/manifest.json',new webpack.sources.RawSource(manifestBytes),{minimized:true});
            });
        });
    }
}

/**
 * The commit this bundle was built from, short form.
 *
 * CI exports GITHUB_SHA and Vercel exports VERCEL_GIT_COMMIT_SHA; a local build has neither, so
 * fall back to asking git. Never throws — a missing version must not be able to fail a build,
 * it just leaves the About box saying "unknown".
 * @returns {string} A short commit sha, or 'unknown'.
 */
const buildVersion = () => {
    const fromEnv = process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA;
    if (fromEnv) return fromEnv.slice(0, 7);
    try {
        return require('child_process')
            // This file runs from packages/scratch-gui, which is vendored and gitignored — the
            // repository is two levels up.
            .execSync('git rev-parse --short=7 HEAD', {
                cwd: path.resolve(__dirname, '..', '..'),
                stdio: ['ignore', 'pipe', 'ignore']
            })
            .toString().trim() || 'unknown';
    } catch (e) {
        return 'unknown';
    }
};

// One identity shared by DefinePlugin, the About dialog and the emitted manifest. Calling either
// producer twice would allow a build straddling a second (or a moving checkout) to describe itself
// with two different values.
const buildCommit = buildVersion();
const buildTime = new Date().toISOString();
const buildManifest = `${JSON.stringify({
    schema: 2,
    product: 'Brickwright',
    commit: buildCommit,
    builtAt: buildTime,
    distributionPolicy
}, null, 2)}\n`;

const galleryManifest = path.resolve(__dirname, artworkDirectory, 'manifest.json');
class GalleryArtworkIndexesPlugin {
    apply (compiler) {
        let indexes;
        compiler.hooks.beforeCompile.tap('GalleryArtworkIndexes', () => {
            indexes = buildGalleryArtworkIndexes(JSON.parse(readFileSync(galleryManifest, 'utf8')));
        });
        new webpack.DefinePlugin({
            'process.env.BW_GALLERY_ARTWORK_INDEXES': webpack.DefinePlugin.runtimeValue(() =>
                JSON.stringify(Object.fromEntries(Object.entries(indexes).map(([editor, index]) => [editor, index.path]))),
            {fileDependencies: [galleryManifest]})
        }).apply(compiler);
        compiler.hooks.thisCompilation.tap('GalleryArtworkIndexes', compilation => {
            compilation.fileDependencies.add(galleryManifest);
            compilation.hooks.processAssets.tap({
                name: 'GalleryArtworkIndexes',
                stage: webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT
            }, () => {
                for (const {path: filename, bytes} of Object.values(indexes)) {
                    compilation.emitAsset(filename, new webpack.sources.RawSource(bytes), {immutable: true});
                }
            });
        });
    }
}

/**
 * bw-circuit-ui loads each part kind's art lazily with
 * `import(/* webpackChunkName: "part-art-[request]" *\/ ...)` (part-art-loader.js, pin 7f98562f):
 * ~220 named chunks, and webpack's chunk-filename runtime in the FIRST LOAD carries an
 * id->name entry for every named chunk (~9 KiB for these). Unnamed, they fall back to
 * `chunks/[id].js` and need no entry. Nothing looks the art chunks up by name.
 */
class AnonymousPartArtChunksPlugin {
    apply (compiler) {
        compiler.hooks.thisCompilation.tap('AnonymousPartArtChunks', compilation => {
            compilation.hooks.afterOptimizeChunks.tap('AnonymousPartArtChunks', chunks => {
                for (const chunk of chunks) {
                    if (typeof chunk.name === 'string' && chunk.name.startsWith('part-art-')) {
                        compilation.namedChunks.delete(chunk.name);
                        chunk.name = null;
                    }
                }
            });
        });
    }
}

/** Emit generated build identity without pretending in-memory bytes are a CopyPlugin path. */
class BuildManifestPlugin {
    apply (compiler) {
        compiler.hooks.thisCompilation.tap('BrickwrightBuildManifest', compilation => {
            compilation.hooks.processAssets.tap({
                name: 'BrickwrightBuildManifest',
                stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL
            }, () => {
                compilation.emitAsset('brickwright-build.json', new webpack.sources.RawSource(buildManifest));
            });
        });
    }
}

// const STATIC_PATH = process.env.STATIC_PATH || '/static';

const baseConfig = new ScratchWebpackConfigBuilder(
    {
        rootPath: path.resolve(__dirname),
        enableReact: true,
        shouldSplitChunks: true
    })
    .setTarget('browserslist')
    .merge({
        output: {
            assetModuleFilename: 'static/assets/[name].[hash][ext][query]',
            library: {
                name: 'GUI',
                type: 'umd2'
            }
        },
        resolve: {
            alias: reactProfiling ? {
                'react-dom$': 'react-dom/profiling',
                'scheduler/tracing$': 'scheduler/tracing-profiling'
            } : {},
            fallback: {
                Buffer: require.resolve('buffer/'),
                stream: require.resolve('stream-browserify'),
                // Emscripten's glue (src/lib/emu8051/emu8051.js) carries a Node
                // branch that does require("node:fs") to read the .wasm off
                // disk. The branch is dead in a browser — ENVIRONMENT_IS_NODE
                // guards it — but webpack still parses the specifier, and these
                // map it to an empty module once the `node:` prefix has been
                // stripped by the NormalModuleReplacementPlugin below. The
                // prefix has to go first: an unknown SCHEME fails before
                // resolution ever runs, so a fallback alone cannot catch it.
                // bw-board's riscv-cc-wasm.js does the same for the RISC-V C
                // compiler: a `fetch` guard picks the browser road (new URL +
                // fetch of the .wasm) and its dead Node road imports
                // `node:fs/promises` — parsed, never run — so `fs/promises`
                // needs the same empty mapping as `fs`.
                fs: false,
                'fs/promises': false,
                path: false,
                // jolt-physics (the Sim Lab engine) is Emscripten glue too: its
                // dead Node road does createRequire from `module`.
                module: false
            }
        }
    })
    // Resolve bounded Robot Lab controls from the built-in models at build time.
    .addModuleRule({
        test: /sim-lab-manual-policy\.js$/,
        resourceQuery: /^\?reference-index$/,
        use: path.resolve(__dirname, 'manual-policy-index-loader.js')
    })
    // The Robot Lab part catalogue in two pieces (parts-subset-loader.js): `parts.json?core` in
    // the Sim Lab chunk, `parts.json?derived` in its own (src/lib/bw-sim/sim-lab.js loadFullCatalog).
    .addModuleRule({
        test: /[\\/]part-meta[\\/]parts\.json$/,
        resourceQuery: /^\?(core|derived)$/,
        type: 'javascript/auto',
        use: path.resolve(__dirname, 'parts-subset-loader.js')
    })
    .addModuleRule({
        test: /\.(svg|png|wav|mp3|gif|jpg)$/,
        resourceQuery: /^$/, // reject any query string
        type: 'asset' // let webpack decide on the best type of asset
    })
    // `node:fs` -> `fs`, which resolve.fallback above then maps to nothing.
    // Webpack rejects an unrecognised URI scheme while PARSING, before any
    // resolution or fallback applies, so the prefix must be rewritten rather
    // than resolved away. Only Emscripten's dead Node branch reaches this.
    .addPlugin(new webpack.NormalModuleReplacementPlugin(/^node:/, resource => {
        resource.request = resource.request.replace(/^node:/, '');
    }))
    .addPlugin(new webpack.DefinePlugin({
        // Brickwright: stamp the build so a running page can say which commit it is. Without
        // this there is no way to tell a stale tab from a deployed regression except by
        // comparing bundle hashes against the repo by hand, which is not something a user can
        // be asked to do — and every bug report is unanswerable until you know the version.
        // CI sets GITHUB_SHA; a local build falls back to asking git; neither is fatal.
        // Brickwright: the FPGA/HDL surface is OFF unless a build asks for it.
        // A BUILD-TIME flag, not a runtime toggle, on purpose: webpack
        // dead-code-eliminates the branch, so an off build carries no tab, no
        // chunk and no gate-level dependency at all. First-load payload measured
        // 5.53 MB and ratchets against 7 (see bw-board target-kinds.js), which a
        // runtime toggle could not promise. Enabling it by DEFAULT is a separate,
        // later decision that may never be taken -- see docs/TANG-NANO.md.
        'process.env.BW_ENABLE_CAD': JSON.stringify(process.env.BW_ENABLE_CAD === '1'),
        'process.env.BW_ENABLE_FPGA': JSON.stringify(process.env.BW_ENABLE_FPGA === '1'),
        // Peer sessions (task E11, docs/PEERS-SECURITY-REVIEW.md): LAN sharing between two
        // apps, OFF unless a build asks for it. A BUILD-TIME boolean so an off build carries no
        // peer code at all: every consumer tests `process.env.BW_ENABLE_PEERS === true`, which
        // webpack folds, and node (where process.env holds strings) always reads as off.
        // Pair it with the app's `peers` Cargo feature. scripts/verify-no-peer-surface.mjs
        // checks the emitted default build; test/peers-gate.test.mjs checks the sources.
        'process.env.BW_ENABLE_PEERS': JSON.stringify(process.env.BW_ENABLE_PEERS === '1'),
        // Distribution policy, selected at BUILD TIME. This is intentionally not inferred from
        // Tauri: Android, Windows and direct-download desktop builds have different store rules,
        // and even Apple's educational-code exception is a submission decision rather than a
        // property of the runtime. Use `BW_REMOTE_CODE_POLICY=deny` only for a deliberately
        // self-contained artifact; the normal web and native profile is `allow`.
        'process.env.BW_REMOTE_CODE_POLICY': JSON.stringify(remoteCodePolicy),
        'process.env.BW_REMOTE_EXTENSIONS_POLICY': JSON.stringify(distributionPolicy.remoteExtensions),
        'process.env.BW_REMOTE_TOOLCHAINS_POLICY': JSON.stringify(distributionPolicy.executableToolchains),
        'process.env.BW_REMOTE_MACHINE_IMAGES_POLICY': JSON.stringify(distributionPolicy.machineImages),
        'process.env.BW_REMOTE_PARTS_POLICY': JSON.stringify(remotePartsPolicy),
        // One precomputed literal lets diagnostics and artifact verification quote the exact
        // compiled profile; deriving it from object properties lets minifiers retain fragments.
        'process.env.BW_DISTRIBUTION_POLICY_RECEIPT': JSON.stringify(distributionPolicyReceipt),
        // Where hosted synthesis lives, when it exists. Null means "not configured",
        // which the backend probe reports as a REASON rather than an empty picker.
        'process.env.BW_SYNTHESIS_ENDPOINT': JSON.stringify(process.env.BW_SYNTHESIS_ENDPOINT || null),
        // The hosted RISC-V C-compile endpoint (services/riscv-cc/). Null unless a
        // deployment is configured, which keeps the C route an honest refusal.
        // RISC-V C compiles IN THE BROWSER (bw-board's riscv-cc-wasm) — no
        // endpoint needed. This is only the FALLBACK the C route uses if the
        // in-browser compiler cannot load: stc-compiler's hosted /compile, which
        // riscv-compile.js tolerates. Override with BW_RISCV_CC_ENDPOINT.
        'process.env.BW_RISCV_CC_ENDPOINT':
            JSON.stringify(process.env.BW_RISCV_CC_ENDPOINT || 'https://stc-compiler.vercel.app'),
        'process.env.BW_VERSION': JSON.stringify(buildCommit),
        'process.env.BW_BUILD_TIME': JSON.stringify(buildTime),
        'process.env.DEBUG': Boolean(process.env.DEBUG),
        'process.env.GA_ID': `"${process.env.GA_ID || 'UA-000000-01'}"`,
        'process.env.GTM_ENV_AUTH': `"${process.env.GTM_ENV_AUTH || ''}"`,
        'process.env.GTM_ID': process.env.GTM_ID ? `"${process.env.GTM_ID}"` : null
    }))
    .addPlugin(new BuildManifestPlugin())
    .addPlugin(new PinnedCadSdkPlugin())
    .addPlugin(new GalleryArtworkIndexesPlugin())
    .addPlugin(new AnonymousPartArtChunksPlugin())
    .addPlugin(new CopyWebpackPlugin({
        patterns: [
            {
                from: 'node_modules/scratch-blocks/media',
                to: 'static/blocks-media/default'
            },
            {
                from: 'node_modules/scratch-blocks/media',
                to: 'static/blocks-media/high-contrast'
            },
            {
                // overwrite some of the default block media with high-contrast versions
                // this entry must come after copying scratch-blocks/media into the high-contrast directory
                from: 'src/lib/themes/high-contrast/blocks-media',
                to: 'static/blocks-media/high-contrast',
                force: true
            },
            {
                context: 'node_modules/scratch-vm/dist/web',
                from: 'extension-worker.{js,js.map}',
                noErrorOnMissing: true
            },
            {
                // The 8051 emulator's WASM. Webpack bundles the Emscripten GLUE
                // (it is an ordinary module) but never sees the .wasm, which the
                // glue fetches by URL at runtime — so without this the debugger
                // loads its chunk and then 404s. The runner passes a locateFile
                // that points here; see bw-debug/debug-runner.js.
                from: 'src/lib/emu8051/emu8051.wasm',
                to: 'static/emu8051.wasm'
            },
            // SDCC IS NOT COPIED HERE, AND MUST NOT BE.
            // It is GPL-2.0-or-later; this app is BSD-3-Clause, and
            // tauri.conf.json bundles this build directory wholesale, so a copy
            // rule here put 8.7 MB of GPL binaries inside the shipping .app
            // (measured 2026-09-07 in CI's own github-pages artifact: 101 files
            // under static/sdcc-wasm). The toolchain now lives in its own GPL
            // repository and is fetched only when a user opts in:
            //   https://github.com/CrispStrobe/sdcc-wasm
            // `scripts/verify-no-gpl-in-build.mjs` fails the build if it ever
            // comes back. See src/lib/sdcc-wasm/toolchain-source.js.
            {
                // SmallerC as WASM — C to 16-bit NASM for the 8086, offline.
                // Only smlrc and smlrpp are here; headers.js is imported
                // normally and so is bundled rather than copied.
                from: 'src/lib/smallerc-wasm/dist',
                to: 'static/smallerc-wasm',
                noErrorOnMissing: true
            },
            {
                // NQC as WASM — NQC to an RCX bytecode image, offline.
                //
                // This one IS copied, unlike SDCC above, because NQC is
                // MPL-2.0 rather than GPL: verify-no-gpl-in-build.mjs is a
                // gate on the licence, not on the idea of a vendored compiler,
                // and MPL is not what it blocks. The consequence is worth
                // stating plainly — the RCX path needs no service and no
                // network, which is the only reason it works on a classroom
                // machine that is offline.
                //
                // 358 kB, and nothing loads it until something compiles: the
                // wrapper import()s the glue on first use.
                from: 'src/lib/nqc-wasm/dist',
                to: 'static/nqc-wasm',
                noErrorOnMissing: true
            }
        ]
    }));

if (!process.env.CI) {
    baseConfig.addPlugin(new webpack.ProgressPlugin());
}

// build the shipping library in `dist/`
const distConfig = baseConfig.clone()
    .merge({
        entry: {
            'scratch-gui': path.join(__dirname, 'src/index.js')
        },
        output: {
            path: path.resolve(__dirname, 'dist')
        }
    })
    .addPlugin(
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: 'src/lib/libraries/*.json',
                    to: 'libraries',
                    flatten: true
                }
            ]
        })
    );

// build the examples and debugging tools in `build/`
const buildConfig = baseConfig.clone()
    .enableDevServer(process.env.PORT || 8601)
    .merge({
        entry: {
            gui: './src/playground/index.jsx'
        },
        output: {
            // React strips Profiler timings from its ordinary production
            // renderer. CI builds a separate profiling artifact for the 8086
            // benchmark; the deployable build remains on the ordinary
            // renderer and keeps its normal runtime cost.
            path: path.resolve(__dirname, process.env.BW_GUI_OUTPUT_DIR || (reactProfiling ? 'build-profile' : 'build')),
            filename: '[name].[contenthash:8].js',
            // Keep lazy feature chunks addressable across Pages deploys.
            // Hashed lazy URLs let a cached HTML/runtime request a chunk that
            // the next clean deployment has already removed.
            chunkFilename: 'chunks/[name].js',
            // No UMD library wrapper for the web app — it boots itself.
            // (The library config is only for dist/, which we skip.)
            library: undefined
        }
    })
    .addPlugin(new HtmlWebpackPlugin({
        chunks: ['gui'],
        template: 'src/playground/index.ejs',
        title: 'Brickwright'
    }))
    .addPlugin(new CopyWebpackPlugin({
        patterns: [
            {
                // The native broker validates this exact origin-root pathname. The general
                // static copy below intentionally nests everything else under /static/.
                from: 'static/capability-broker.html',
                to: 'capability-broker.html'
            },
            {
                from: 'static',
                to: 'static',
                globOptions: {ignore: [
                    '**/gallery-artwork/manifest.json',
                    ...(process.env.BW_ENABLE_CAD === '1' ? [] : ['**/cad-sdk/**'])
                ]},
                info: preserveProofAssetInfo
            },
            {
                from: 'extensions/**',
                to: 'static',
                context: 'src/examples'
            },
            {
                // Brickwright PWA service worker — must sit at the build root so its scope covers
                // the whole app (a file under static/ could only control static/).
                from: 'sw.js',
                to: 'sw.js'
            },
            {
                // Code and Circuit use the same gallery metadata.
                from: 'examples',
                to: 'examples',
                transform: addExampleTargets,
                noErrorOnMissing: true
            }
        ]
    }));

// Skip building `dist/` unless explicitly requested via BUILD_MODE=dist.
// The Vercel deploy only serves `build/`; the `dist/` library compilation roughly doubles
// peak memory and is not needed for production deploys.
const buildDist = process.env.BUILD_MODE === 'dist';

const vmSrc = path.resolve(__dirname, 'node_modules/scratch-vm/src/index.js');
const cfgs = buildDist ? [buildConfig.get(), distConfig.get()] : [buildConfig.get()];
cfgs.forEach(c => {
    c.devtool = false; // Brickwright: no source maps -> fits CI RAM
    // A persistent compile cache for LOCAL builds: every build here was a cold
    // compile at a 2.5 GiB heap (73 s on CI's runner, minutes on a shared box).
    // Off on CI on purpose — a runner's node_modules/.cache is gone next run, so
    // there it would only cost the write. Keyed on this file so an alias or a
    // loader change invalidates it.
    if (!process.env.CI) {
        c.cache = {
            type: 'filesystem',
            buildDependencies: {config: [__filename]}
        };
        // webpack treats node_modules as immutable by default (snapshot.managedPaths):
        // a package is assumed unchanged unless its version changes, and its files
        // are never re-read. This project WRITES into node_modules — apply-vm-overlay
        // and apply-paint-overlay lay our deltas over scratch-vm and scratch-paint
        // after install — so with that default a cached build silently shipped the
        // PREVIOUS virtual-machine.js (2026-09-05: a 40 s "build" whose bundle lacked
        // the patch that had just been applied). Snapshot everything by content.
        c.snapshot = Object.assign({}, c.snapshot, {managedPaths: []});
    }
    c.resolve = c.resolve || {};
    c.resolve.alias = Object.assign({}, c.resolve.alias);
    // Build the VM from source (node_modules/scratch-vm/src, over which apply-vm-overlay.mjs has
    // laid our owned delta) so our built-in extensions bundle in. Its deps resolve from the
    // hoisted scratch-gui/node_modules; babel already transpiles node_modules/*scratch*.
    c.resolve.alias['scratch-vm$'] = vmSrc;
    // This owned broker adapter is deliberately reached from the overlaid source,
    // since the dependency exports only its main entry.
    c.resolve.alias['scratch-vm/src/extension-support/native-renode-capability.js$'] =
        path.join(path.dirname(vmSrc), 'extension-support/native-renode-capability.js');
    // The GUI and sandboxed Arcade extension share UUID-preserving menu labels.
    c.resolve.alias['scratch-vm/src/util/bw-animation-resource-menu.js$'] =
        path.join(path.dirname(vmSrc), 'util/bw-animation-resource-menu.js');
    // F10: the imported-MakeCode-original rules the Code tab shares with the VM's save/load.
    c.resolve.alias['scratch-vm/src/serialization/bw-makecode-original.js$'] =
        path.join(path.dirname(vmSrc), 'serialization/bw-makecode-original.js');
    // cat-blocks is a 65 MiB Easter-egg dependency (cat-themed blocks for "time travel to
    // 2020"). Aliasing it to scratch-blocks eliminates a duplicate blockly parse+compile
    // pass — the feature degrades gracefully to showing normal blocks.
    c.resolve.alias['cat-blocks'] = path.resolve(__dirname, 'node_modules/scratch-blocks');
    // digitaljs: take the HEADLESS core, never the package's own entry.
    //
    // This alias is a LICENCE boundary, not an optimisation. digitaljs's `browser`
    // export condition is the full visual editor, which pulls jquery-ui (4.6 MB)
    // and elkjs — and elkjs is EPL-2.0, outside the allowed set in
    // THIRD-PARTY-NOTICES.md. The headless core (lib/circuit.js) reaches neither:
    // its imports are @joint/core (MPL-2.0), 3vl (BSD-2) and jquery (MIT).
    //
    // An alias is also the only mechanism available. The package declares no
    // subpath exports, so `digitaljs/lib/circuit.js` is not importable directly
    // (ERR_PACKAGE_PATH_NOT_EXPORTED); webpack's alias bypasses the exports map,
    // which is exactly what is wanted here and nowhere else.
    //
    // Nothing enforces this at build time. test/fpga-third-party-surface.test.mjs
    // asserts the alias is present and that no source imports the full entry, so
    // deleting these three lines goes red instead of quietly shipping EPL-2.0.
    c.resolve.alias['digitaljs$'] = path.resolve(__dirname, 'node_modules/digitaljs/lib/circuit.js');

    // @yowasp/yosys: present only when the local tier was asked for.
    //
    // THE FLAG DOES NOT STOP RESOLUTION, which is the thing this repository's
    // notes about the flagged surface had wrong. `process.env.BW_ENABLE_FPGA` is
    // a DefinePlugin substitution, so it drops the flagged code from the OUTPUT,
    // after webpack has already resolved the graph — and `new Worker(new URL(…))`
    // is detected statically, so yosys-worker.js is pulled in either way. A
    // default build therefore tried to resolve a 75 MB package nobody installed
    // and failed (run 35185515757).
    //
    // Depending on it unconditionally would put 75 MB into every install to serve
    // a tier that is off by default — the exact trade the local tier exists to
    // avoid. So an off build resolves it to a stub that throws if reached, and an
    // on build is left alone to use the real package.
    if (process.env.BW_ENABLE_FPGA !== '1') {
        c.resolve.alias['@yowasp/yosys$'] =
            path.resolve(__dirname, 'src/lib/bw-fpga/yosys-absent.js');
    }
    // Trimmed locale data: only en + de (generated by integrate.mjs).
    // The full editor-msgs.js is 3.9 MiB with 80 locales; the trimmed copy is ~90 KiB.
    const trimmedMsgs = path.resolve(__dirname, 'src/generated/editor-msgs-lite.js');
    c.resolve.alias['scratch-l10n/locales/editor-msgs'] = trimmedMsgs;
    // The seven render fonts (1.34 MiB of base64, incompressible) leave the boot
    // chunk: scratch-svg-renderer's require('scratch-render-fonts') gets a
    // same-shaped shim that fetches the real module — reachable only under the
    // second alias — as its own chunk. See src/lib/lazy-render-fonts.js.
    c.resolve.alias['scratch-render-fonts$'] = path.resolve(__dirname, 'src/lib/lazy-render-fonts.js');
    // OUR FORK of the font table, not the package's. Two of the seven faces
    // upstream ships cannot be redistributed on this bundle's terms (Grand9K
    // Pixel is CC BY-SA 3.0; Scratch.ttf carries no licence at all), and the
    // package has no `license` field. src/lib/render-fonts/index.js keeps all
    // seven KEYS — a saved project stores the family name, so a key that
    // disappears strips the style from existing work — and requires the five
    // OFL faces straight from the package.
    c.resolve.alias['scratch-render-fonts-base64$'] =
        path.resolve(__dirname, 'src/lib/render-fonts/index.js');
    // `text-encoding` is a 618 KiB (201 KiB compressed) TextDecoder polyfill for
    // browsers without one; every browser in .browserslistrc has one. Its three
    // requirers (scratch-vm, scratch-sb1-converter, @vernier/godirect) all guard
    // on `typeof TextDecoder === 'undefined'` before touching it, so they get the
    // 5 KiB polyfill scratch-storage already ships, which hands back the native
    // classes when they exist.
    c.resolve.alias['text-encoding$'] = 'fastestsmallesttextencoderdecoder';
    // Skip babel for pre-minified blockly files — they're already compiled and 'use strict',
    // and babel deoptimising 977 KiB of minified code wastes time and memory for no benefit.
    const babelRule = (c.module.rules || []).find(r => r.loader === 'babel-loader');
    if (babelRule) {
        const origExclude = babelRule.exclude || [];
        // The base rule (scratch-webpack-configuration) excludes node_modules EXCEPT paths
        // containing "scratch". bw-board and bw-circuit-ui are our own upstream repos taken
        // as git-sha packages (vendor-pins.json -> integrate.mjs -> package.json), and
        // bw-circuit-ui is JSX: without this `not:` term the designer does not parse at
        // all, and the engine ships without preset-env. Same treatment as scratch-*.
        const OWN_PACKAGES = /node_modules[\\/](bw-board|bw-circuit-ui)[\\/]/;
        babelRule.exclude = [
            ...origExclude.map(e => (e && Array.isArray(e.and) && Array.isArray(e.not))
                ? {...e, not: [...e.not, OWN_PACKAGES]}
                : e),
            /scratch-blocks[\\/]blockly_compressed/
        ];
    }
});
module.exports = buildDist ? cfgs : cfgs[0];
