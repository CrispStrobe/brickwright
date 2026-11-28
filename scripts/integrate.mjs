#!/usr/bin/env node
// Apply the Brickwright delta onto the vendored (BSD/Apache) Scratch stack.
//
// We are FROZEN on pinned versions (see vendor.mjs), so the pristine base never shifts under
// us. That means we can OWN our modified files outright instead of re-deriving edits with fragile
// string patches every build: `overlay/` holds full copies of every file we changed or added, and
// they simply replace the vendored originals. To change base behaviour, edit the file in overlay/.
//
// overlay/scratch-gui/  — Code tab (tw-pseudocode + sb3-creator libs), the 4th "Code ⇄ Blocks" tab
//   in gui.jsx, webpack.config.js (devtool:false + `scratch-vm`->src alias), de-branded render-gui
//   & stage-header (no scratch.mit.edu redirect), the extension-library picker, the SoundFX creator.
// overlay/scratch-vm/   — built-in extensions under src/extensions/crispstrobe/ + their registration
//   in extension-manager.js's builtinExtensions map.
//
// Idempotent; run after `vendor`.
import { cpSync, readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {AVR8JS_SPEC} from './lib/avr8js-spec.mjs';

const ROOT = process.cwd();
const GUI = path.join(ROOT, 'packages', 'scratch-gui');
if (!existsSync(GUI)) { console.error('Run `npm run vendor` first (packages/scratch-gui missing).'); process.exit(1); }
const proofPins = spawnSync(process.execPath, [path.join(ROOT, 'scripts/package-native-broker-proof-pins.mjs'), '--check'],
    {cwd: ROOT, stdio: 'inherit'});
if (proofPins.status !== 0) throw new Error('native broker proof package freshness check failed');
const brokerAssets = spawnSync(process.execPath, [path.join(ROOT, 'scripts/package-native-broker-assets.mjs'), '--check'],
    {cwd: ROOT, stdio: 'inherit'});
if (brokerAssets.status !== 0) throw new Error('native broker asset freshness check failed');

// 1) overlay our owned scratch-gui files onto the vendored source. (The scratch-vm delta lives
// in overlay/scratch-vm and is applied to node_modules/scratch-vm AFTER install by
// apply-vm-overlay.mjs — see step 3 for why it can't be a file: package.)
// The CAD SDK is one immutable snapshot: do not retain chunks from an older pin.
if (existsSync(path.join(ROOT,'overlay/scratch-gui/static/cad-sdk'))) rmSync(path.join(GUI,'static/cad-sdk'),{recursive:true,force:true});
cpSync(path.join(ROOT, 'overlay', 'scratch-gui'), GUI, { recursive: true });
console.log('  overlaid scratch-gui delta (Code tab, SoundFX, de-brand, webpack, extension picker)');

// CrispBASIC is an optional locally built payload, copied as plain ESM/WASM
// rather than entering webpack's dependency graph. Re-stage after vendor/overlay
// so a fresh vendored GUI cannot discard a previously built interpreter.
// If an older payload is present, require its build record as well: never ship
// a stale engine merely because its generated directory survived a cache restore.
if (existsSync(path.join(ROOT, 'packages/crisp-basic/.build/wasm/build.json')) ||
    existsSync(path.join(GUI, 'static/crispbasic'))) {
    const crispBasic = spawnSync(process.execPath, [path.join(ROOT, 'scripts/package-crispbasic.mjs')],
        {cwd: ROOT, stdio: 'inherit'});
    if (crispBasic.status !== 0) throw new Error('CrispBASIC asset packaging failed; run npm run build:crispbasic');
}

// 2) micro:bit stub. Install runs with --ignore-scripts (upstream prepublish.mjs downloads
// micro:bit firmware from a flaky URL), so src/generated/microbit-hex-url.cjs is never created
// and webpack fails to resolve it. Only the firmware flasher path needs it; stub it empty.
const genDir = path.join(GUI, 'src', 'generated');
mkdirSync(genDir, { recursive: true });
writeFileSync(path.join(genDir, 'microbit-hex-url.cjs'), "module.exports = '';\n");
console.log('  wrote src/generated/microbit-hex-url.cjs stub');

// 3) package.json: our runtime deps + pin scratch-vm. We keep scratch-vm as a normal NPM dep
// (NOT file:../scratch-vm) so npm installs ALL of its transitive deps hoisted into
// scratch-gui/node_modules (a file: symlink makes npm skip installing the linked package's own
// deps — e.g. format-message — and the src build then can't resolve them). We then build the VM
// from source via a webpack alias (scratch-vm$ -> node_modules/scratch-vm/src) and lay our owned
// VM delta over node_modules/scratch-vm after install (apply-vm-overlay.mjs). Pin to the exact
// vendored version so the hoisted deps + dist/web match our overlay's base.
const pkgPath = path.join(GUI, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
pkg.dependencies.skulpt = pkg.dependencies.skulpt || '^1.2.0';   // in-browser Python (Code tab Run)
pkg.dependencies.jszip = pkg.dependencies.jszip || '^3.10.1';    // .sb3 read/write
// Circuit designer part graphics. All three are permissive (MIT / BSD-3), and measured at
// ~14.3 KB gzipped once tree-shaken — cheap enough to keep the real component drawings
// rather than hand-rolling SVGs for every part.
pkg.dependencies.lit = pkg.dependencies.lit || '^3.3.3';                        // BSD-3
pkg.dependencies['@lit/react'] = pkg.dependencies['@lit/react'] || '^1.0.8';    // BSD-3
pkg.dependencies['@wokwi/elements'] = pkg.dependencies['@wokwi/elements'] || '^1.9.2';   // MIT
pkg.dependencies['avr8js'] = AVR8JS_SPEC;   // MIT — AVR emulator: bw-board's own fork commit (scripts/lib/avr8js-spec.mjs)
pkg.dependencies['rp2040js'] = pkg.dependencies['rp2040js'] || '1.3.3';                // MIT — RP2040/Pico emulator (lazy-imported)
pkg.dependencies['@xyflow/react'] = pkg.dependencies['@xyflow/react'] || '^12.3.0';  // MIT — node/wire canvas for the FPGA gate builder (lazy-imported, flag-gated)
pkg.dependencies['@xterm/xterm'] = '6.0.0';                       // MIT — the Linux lesson's terminal emulator (lazy-imported, exact pin)
pkg.dependencies['three'] = '0.186.1';                               // MIT — the SPIKE arena's 3D view (lazy-imported, exact pin)
// MIT — the Sim Lab physics engine (WASM, lazy-imported). OUR FORK, pinned to an immutable release
// tarball (sha256 d23a2315953cc196119e909a7206cd57d649ed20faca1ec33f7a96233dba7c62): upstream Jolt's GearConstraint passed
// torque across a mesh 1:1 (an 8:24 train put 3× the load on its motor) and is angular-only (no axle
// reaction: a gearbox on a free frame gained angular momentum). The fork fixes the ratio and adds
// GearMeshConstraint (a tooth contact at the pitch point); built on upstream Jolt master 01adafb (release bw.11-qualified-20261127, package 1.1.0-bw.11, branch brickwright/part-pair-filter on brickwright/gear-mesh-master; bw.3 adds the CCD bounce fix and MaterialPairs, bw.4 RackMeshConstraint, bw.5 PartPairSimShapeFilter: the Robot Lab's part-pair collision filter in C++; bw.6 adds optional single-thread SIMD with unchanged physical controls and regression hash; bw.7 adds retained distance-constraint velocity impulses without changing solver trajectories; bw.8 adds the optional native relative hinge rotor; bw.9 couples the native soft-motor and rotor rows, with built/packed scalar/SIMD qualification in the owning forks).
// https://github.com/CrispStrobe/JoltPhysics.js/blob/brickwright/gear-mesh-master/BRICKWRIGHT.md
// The release URL names a tag, which can move; the bytes are what is trusted: npm checks the tarball
// against the lockfile's integrity before it unpacks anything, and the lockfile must carry THIS value.
// bw.11 prunes disjoint children during box and convex-hull compound sweeps.
const JOLT_PHYSICS_URL = 'https://github.com/CrispStrobe/JoltPhysics.js/releases/download/bw.11-qualified-20261127/jolt-physics-1.1.0-bw.11.tgz';
const JOLT_PHYSICS_INTEGRITY = 'sha512-m5W5At6s1Tz+KO8rfSA7ihBcRDtqXYhXwGG0XRfYwaV0SEcvqxeyq8Hm/emNIgvCkZDRBRFyCPOhjlQYSWNiiw==';
pkg.dependencies['jolt-physics'] = JOLT_PHYSICS_URL;
{
    const lockPath = path.join(GUI, 'package-lock.json');
    const entry = existsSync(lockPath) ? (JSON.parse(readFileSync(lockPath, 'utf8')).packages || {})['node_modules/jolt-physics'] : null;
    if (entry && (entry.resolved !== JOLT_PHYSICS_URL || entry.integrity !== JOLT_PHYSICS_INTEGRITY)) {
        throw new Error(`packages/scratch-gui/package-lock.json: jolt-physics must resolve to ${JOLT_PHYSICS_URL} with integrity ${JOLT_PHYSICS_INTEGRITY}`);
    }
}
// The board engine and the circuit designer are OUR upstream repos, taken as git-sha
// dependencies rather than copied in: vendor-pins.json stays the single authority for the
// sha (the same file every pin gate reads), and the package.json spec is DERIVED from it
// here, so a pin bump is one edit and the installed tree is the pinned tree by construction.
// Preserve each package's actual LICENSE/notices (bw-circuit-ui's LICENSE is
// MPL-2.0 despite its current package.json MIT label). bw-circuit-ui declares
// bw-board as a peer, so one engine copy serves both.
const pins = JSON.parse(readFileSync(path.join(ROOT, 'vendor-pins.json'), 'utf8'));
for (const name of ['bw-board', 'bw-circuit-ui']) {
    const sha = pins[name];
    if (!/^[0-9a-f]{40}$/.test(sha || '')) throw new Error(`vendor-pins.json: ${name} must be a 40-hex sha, got ${JSON.stringify(sha)}`);
    pkg.dependencies[name] = `github:CrispStrobe/${name}#${sha}`;
}
// The gate-level FPGA tier, behind BW_ENABLE_FPGA and absent from a flag-off build.
// PINNED EXACTLY, and not as a range, because BOTH the licence position and the
// module resolution are version-specific facts we verified rather than assumed:
//   digitaljs@0.14.2        BSD-2. Reached through its HEADLESS core by the alias in
//                           webpack.config.js. Its `browser` entry is the full visual
//                           editor and pulls jquery-ui plus elkjs, and elkjs is EPL-2.0 —
//                           outside the allowed set. The headless core reaches neither.
//   yosys2digitaljs@0.10.3  BSD-2. Only its `core` subpath is used: that requires exactly
//                           3vl (BSD-2), big-integer (Unlicense) and hashmap (MIT). The
//                           `node` subpath shells out to Yosys and pulls temp-file deps,
//                           one of them WTFPL-only.
// A range on either could move onto a version where those subpaths or their trees differ,
// and the audit would be silently stale. See docs/TANG-NANO.md §8a.
pkg.dependencies['@yowasp/yosys'] = '0.71.188-dev.1267';          // ISC; existing optional FPGA synthesis worker
pkg.dependencies['digitaljs'] = '0.14.2';                        // BSD-2 (headless core only)
pkg.dependencies['yosys2digitaljs'] = '0.10.3';                  // BSD-2 (core subpath only)
pkg.dependencies['scratch-vm'] = '4.8.115';                      // last BSD-3; built from src via alias
// Pin scratch-paint exactly, for the same reason as scratch-vm: overlay/scratch-paint holds FULL
// FILE COPIES of the costume-designer files we own, authored against one exact base. The base
// range was `^2.2.151`, and 2.2.518 happens to be both the highest 2.2.x ever published and the
// last permissive (BSD-3) one — but a range would let a republish move the floor under our
// overlay. webpack builds it from src (package `browser` field), and apply-paint-overlay.mjs
// lays our delta over node_modules/scratch-paint after install.
pkg.dependencies['scratch-paint'] = '2.2.518';                   // last BSD-3
// CodeMirror 6 — MIT, lazy-loaded for the Code tab editor. The `codemirror` meta-package
// bundles view/state/commands/autocomplete/lint/language basics + bracket matching.
pkg.dependencies['codemirror'] = pkg.dependencies['codemirror'] || '^6.0.1';                       // MIT
pkg.dependencies['@codemirror/lang-cpp'] = pkg.dependencies['@codemirror/lang-cpp'] || '^6.0.2';   // MIT
pkg.dependencies['@codemirror/lang-python'] = pkg.dependencies['@codemirror/lang-python'] || '^6.1.6'; // MIT
pkg.dependencies['@codemirror/lang-javascript'] = pkg.dependencies['@codemirror/lang-javascript'] || '^6.2.2'; // MIT
pkg.dependencies['@codemirror/language'] = pkg.dependencies['@codemirror/language'] || '^6.10.8';   // MIT
pkg.dependencies['@codemirror/search'] = pkg.dependencies['@codemirror/search'] || '^6.5.8';       // MIT
pkg.dependencies['@codemirror/theme-one-dark'] = pkg.dependencies['@codemirror/theme-one-dark'] || '^6.1.2'; // MIT
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('  ensured deps (skulpt, jszip, lit + wokwi elements, codemirror, digitaljs + yosys2digitaljs, bw-board + bw-circuit-ui at vendor-pins.json) + avr8js at the bw-board fork commit, rp2040js@1.3.3, scratch-vm@4.8.115, scratch-paint@2.2.518');

console.log('Integration applied. `cd packages/scratch-gui && npm install --ignore-scripts && npm run build`.');
