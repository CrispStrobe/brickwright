// Which bundled extension claims which file in CrispStrobe/extensions, and at
// which commit — the data behind test/bundled-extensions-match-upstream.test.mjs.
//
// WHY THIS EXISTS
// ---------------
// On 2026-09-20 an audit compared every bundle under
// overlay/scratch-vm/src/extensions/crispstrobe/ against its upstream file and
// found five carrying changes that had never gone up: `arrays` had nine extra
// blocks, `lego_poweredup` and `legoboost_universal` each carried a Scratch
// Link endpoint fix without which that connection type could never connect
// inside the app, and two carried lint directives. None of it was careless —
// every fork had a reason visible in its own comments. What was missing, every
// time, was the step that sends the change up.
//
// Those five were reclaimed and the count reached zero. This file is what stops
// it climbing again, because a count that was measured once decays: the whole
// point is that nobody noticed the first five either.
//
// WHY NOT REUSE gallery-pins.json
// -------------------------------
// It already records a sha256 of each upstream file (`repo`) beside the bytes
// GitHub Pages serves (`served`), which is nearly this. But it is generated for
// a different job — verifying what a RUNTIME URL load hands us — so its pin
// moves when Pages redeploys, and a Pages hiccup would break a gate about
// whether OUR TREE has diverged. Two questions, two records. The commit below
// is the same repository, and `npm run sync:gallery-pins` moves the other one.
//
// WHY THE MAP IS WRITTEN OUT
// --------------------------
// A bundle's directory name is its extension id (`spikeprime`); the upstream
// file is named for what it was when it was written
// (`legospike_turbowarp_transpile.js`). Deriving one from the other would mean
// guessing, and a gate that guesses its own subject is worse than no gate. The
// claim "this bundle is that file" is exactly what should be reviewable.
import {registeredArraysSource} from '../lib/arrays-carrier.mjs';
import {createHash} from 'node:crypto';
import {readFileSync, existsSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(here, '../..');
export const BUNDLES = resolve(ROOT, 'overlay/scratch-vm/src/extensions/crispstrobe');

/** CrispStrobe/extensions commit these sha256s were taken at. */
export const UPSTREAM_COMMIT = 'cc7b802cd4c149d401ef0d289baa975aed6ea443';
export const UPSTREAM_REPO = 'CrispStrobe/extensions';

/**
 * bundle directory name → where its source lives upstream.
 *
 * A bare string is a path in CrispStrobe/extensions at UPSTREAM_COMMIT. An
 * object names another repository and the vendor-pins.json key that pins it —
 * `controller` comes from the bw-board package, which already ships the
 * extension and is pinned by sha like every other package.
 */
export const MAP = {
    arrays: {repo: 'CrispStrobe/extensions', pin: 'arrays-values', path: 'extensions/CrispStrobe/arrays.js'},
    // Circuit Playground Express device world (task A9), scoped to its own pin
    // so adding it moves no other bundled extension.
    circuitplayground: {repo: 'CrispStrobe/extensions', pin: 'circuitplayground', path: 'extensions/CrispStrobe/circuitplayground.js'},
    csp: 'extensions/CrispStrobe/csp.js',
    circuit: 'extensions/CrispStrobe/circuit.js',
    // ev3lms and legoev3direct were mapped here until 2026-09-21. They were the
    // same stock-firmware brick as this one, with the block surface, the
    // working live implementation and the LMS compiler split between the
    // three; they are retired into ev3comprehensive and their ids resolve to
    // it. ev3dev stays — it is a different operating system on the brick.
    ev3comprehensive: {repo: 'CrispStrobe/extensions', pin: 'ev3comprehensive', path: 'extensions/CrispStrobe/ev3_universal.js'},
    ev3dev: 'extensions/CrispStrobe/ev3dev_py_transpile.js',
    legoboostunified: {repo: 'CrispStrobe/extensions', pin: 'legoboostunified', path: 'extensions/CrispStrobe/legoboost_universal.js'},
    legonxt: {repo: 'CrispStrobe/extensions', pin: 'legonxt', path: 'extensions/CrispStrobe/legonxt_transpile_universal.js'},
    legopoweredup: {repo: 'CrispStrobe/extensions', pin: 'legopoweredup', path: 'extensions/CrispStrobe/lego_poweredup.js'},
    // The RCX, the oldest brick in the family. Its blocks transpile to NQC and
    // the NQC is compiled to an .rcx image — locally by `runtime.nqcCompile`
    // (lib/nqc-runtime-hook.js, which this vendoring is what finally gives a
    // consumer), and by the hosted service only where that is absent.
    legorcx: 'extensions/CrispStrobe/lego_rcx.js',
    planetemaths: 'extensions/CrispStrobe/planetemaths.js',
    spikeprime: {repo: 'CrispStrobe/extensions', pin: 'spikeprime', path: 'extensions/CrispStrobe/legospike_turbowarp_transpile.js'},
    // Opt-in hardware diagnostics: archive the four pre-consolidation drivers
    // at the same immutable upstream pin as the unified driver.
    spikeprimeBTC: 'extensions/CrispStrobe/legospikeprime_btc_scratchlink.js',
    spikeprimeBridge: 'extensions/CrispStrobe/legospike_bridge.js',
    spikeprimeble: 'extensions/CrispStrobe/legospike_ble.js',
    legospikeprimeBLE: 'extensions/CrispStrobe/legospikeprime_ble.js',
    stc12: {repo: 'CrispStrobe/extensions', pin: 'stc12', path: 'extensions/CrispStrobe/stc12.js'},
    stc12live: 'extensions/CrispStrobe/stc12live.js',
    universalgamepad: 'extensions/CrispStrobe/gamepad.js',
    wedo2unified: {repo: 'CrispStrobe/extensions', pin: 'wedo2unified', path: 'extensions/CrispStrobe/lego_wedo2_universal.js'},

    // Written in Lite, upstreamed 2026-09-20 (CrispStrobe/extensions#4), and
    // vendored back so the gate covers them like everything else. bitops and
    // devices are sb3-creator OUTPUT CONTRACTS — the generator emits
    // bitops_* and devices_* opcodes — so the gallery is their proper home
    // rather than a courtesy copy.
    bitops: 'extensions/CrispStrobe/bitops.js',
    devices: 'extensions/CrispStrobe/devices.js',
    microbitplus: {repo: 'CrispStrobe/extensions', pin: 'microbitplus', path: 'extensions/CrispStrobe/microbitplus.js'},
    // Keyed by DIRECTORY, which is not this one's extension id: the folder is
    // `text2speech` (it replaced the stock extension of that name) while the
    // id it registers is `brickwrightTTS`. Renaming the folder would move the
    // path extension-manager requires, for no gain.
    text2speech: 'extensions/CrispStrobe/brickwright_tts.js',

    // Not CrispStrobe/extensions. bw-board ships this extension and Lite had a
    // five-block copy of its fourteen — the panel offered lcd, oled,
    // simplevga, keyboard, bargraph and rgb widgets that no block could drive.
    controller: {repo: 'CrispStrobe/bw-board', pin: 'bw-board', path: 'src/controller-extension.js'}
};

/** Where an entry's source is, resolved against the pins. */
export const sourceOf = function (id, pins) {
    const entry = MAP[id];
    if (!entry) return null;
    if (typeof entry === 'string') {
        return {repo: UPSTREAM_REPO, commit: UPSTREAM_COMMIT, path: entry};
    }
    const commit = (pins || {})[entry.pin];
    if (!commit) throw new Error(`${id} is pinned by vendor-pins.json["${entry.pin}"], which is absent`);
    return {repo: entry.repo, commit, path: entry.path};
};

/**
 * Bundles with no upstream file, and why.
 *
 * Not a loophole: a bundle absent from BOTH this list and MAP fails the gate,
 * so a new extension has to be classified deliberately. Saying "this is ours"
 * is cheap; saying it by accident is what this prevents.
 */
export const LITE_ONLY = {
    arcade: 'Lite-native. Reads the GUI console\'s runtime state, so upstreaming it ' +
        'would mean upstreaming that contract too.',
    cameracapture: 'Lite-native. Integrates with the app\'s shared Video Sensing provider and preview ' +
        'to capture still images without opening a competing camera stream.',
    peers: 'Lite-native and gated (task E11): the Peer Sessions blocks call the app\'s own native ' +
        'peer commands, exist only in a BW_ENABLE_PEERS=1 build with the `peers` Cargo feature, and ' +
        'must not be upstreamed while no default build carries them (docs/PEERS-SECURITY-REVIEW.md).',
    bwgpio: 'Lite-native. Generic GPIO pin blocks (set pin / read pin) that drive the Widgets pane\'s ' +
        'GPIO strip and round-trip with the DOS Forth bench\'s pin!/pin@ words through the Code tab.',
    cadlab: 'Lite-native. CAD motor blocks use runtime.cadSimulation, installed by the opt-in CAD host. ' +
        'The independent CAD SDK exposes motor controls; this Scratch VM adapter belongs to Lite.',
    cadshapes: 'Lite-native. CAD modelling blocks are compiled (not run) by gui lib/bw-cad-blocks.js through ' +
        'runtime.cadShapes into Brickwright CAD code bodies; without the opt-in CAD host they report not-open.',
    robotlab: 'Lite-native. The Robot Lab blocks call runtime.robotLab, the API the app\'s Robot Lab pane ' +
        'installs over its physics session; without that app there is nothing to steer.',
};

/**
 * Bundles allowed to differ from upstream, with the reason and a review date.
 *
 * EMPTY, and that is the state worth defending. An entry here is a fork that
 * has been argued for in review rather than one that arrived unannounced —
 * which is the only difference between this and the situation the audit found.
 */
// SPIKE's encoder-based movement wait is preserved byte-for-byte in the
// selected supplier (#51, retained by #62), so it no longer needs a divergence.
export const ALLOWED_DIVERGENCE = {};

/**
 * The extension source a bundle holds, or null if it is not a bundle at all.
 *
 * The bundle is EVALUATED with a stubbed adapter rather than parsed out of the
 * text, because the wrapper comes in two encodings — a JSON string
 * (makeExt("…")) and a template literal (makeExt(`…`)) — and a reader that
 * handles only one reports the other as "not a bundle".
 *
 * That is not hypothetical. The 2026-09-20 audit classified circuit, stc12 and
 * stc12live as un-comparable Lite ports on exactly that mistake: they are
 * ordinary bundles in the template-literal form. A tool's blind spot had been
 * written down as a fact about the repository. Evaluating cannot make that
 * error, because it asks the module what it holds instead of inferring it from
 * punctuation.
 */
export const bundlePath = id => resolve(BUNDLES, id, 'index.js');

export const bundleSource = function (id) {
    const p = bundlePath(id);
    if (!existsSync(p)) return null;
    const text = readFileSync(p, 'utf8');
    if (id === 'arrays') return registeredArraysSource(text);
    if (!text.includes('makeExt(')) return null;

    let captured = null;
    const mod = {exports: {}};
    const stubRequire = request => {
        if (request === '../adapter') return source => { captured = source; return null; };
        throw new Error(`bundle ${id} required ${request}, which a bundle should not`);
    };
    try {
        // eslint-disable-next-line no-new-func
        new Function('require', 'module', 'exports', text)(stubRequire, mod, mod.exports);
    } catch (error) {
        return null;
    }
    return typeof captured === 'string' ? captured : null;
};

export const sha256 = value => createHash('sha256').update(value, 'utf8').digest('hex');

/** Every bundle directory that actually ships an extension. */
export const bundleIds = function (readdirSync) {
    return readdirSync(BUNDLES, {withFileTypes: true})
        .filter(e => e.isDirectory() && existsSync(resolve(BUNDLES, e.name, 'index.js')))
        .map(e => e.name)
        .sort();
};

export const rawURL = (path, repo = UPSTREAM_REPO, commit = UPSTREAM_COMMIT) =>
    `https://raw.githubusercontent.com/${repo}/${commit}/${path}`;
