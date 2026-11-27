// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// The Robot Lab part catalogue in two pieces: the webpack loader that cuts
// parts.json into `?core` (bundled with the Sim Lab) and `?derived` (its own
// chunk), and model/lazy-catalog.js, which loads the second piece when Build
// opens or a model names a part the core lacks — so a shipped or imported model
// never has a part refused for not being loaded yet, and the shipped models
// never pay for the second piece.

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createLazyCatalog} from '../overlay/scratch-gui/src/lib/bw-sim/model/lazy-catalog.js';
import {parseModel} from '../overlay/scratch-gui/src/lib/bw-sim/model/ldraw-model.js';
import {catalogFrom} from '../overlay/scratch-gui/src/lib/bw-sim/sim-session.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = readFileSync(path.join(ROOT, 'overlay/scratch-gui/src/lib/bw-sim/part-meta/parts.json'), 'utf8');
const ALL = JSON.parse(SOURCE);
const loader = createRequire(import.meta.url)('../overlay/scratch-gui/parts-subset-loader.js');
/** What the loader makes of parts.json for a query: the module's default export. */
const piece = query => {
    const out = loader.call({resourceQuery: query}, SOURCE);
    const m = out.match(/^export default (.*);\n$/s);
    assert.ok(m, 'the loader emits one default export');
    return JSON.parse(m[1]);
};
const MODELS = path.join(ROOT, 'overlay/scratch-gui/static/sim-lab/models');
const line = (part, z = 0) => `1 71 0 0 ${z} 1 0 0 0 1 0 0 0 1 ${part}`;

test('the loader cuts parts.json in two: the hand-made core and the derived rest, nothing lost, nothing twice', () => {
    const core = piece('?core');
    const rest = piece('?derived');
    assert.ok(core.parts.length > 0 && rest.parts.length > 0);
    assert.ok(core.parts.every(p => !p.derived), 'the core has no derived part');
    assert.ok(rest.parts.every(p => p.derived === true), 'the rest has only derived parts');
    assert.deepEqual([...core.parts, ...rest.parts].map(p => p.part).sort(), ALL.parts.map(p => p.part).sort());
    for (const key of Object.keys(ALL)) if (key !== 'parts') assert.deepEqual(core[key], ALL[key], `core keeps ${key}`);
    assert.deepEqual(rest.parts.find(p => p.part === '6541.dat'), ALL.parts.find(p => p.part === '6541.dat'), 'a part comes through whole');
    assert.throws(() => loader.call({resourceQuery: '?all'}, SOURCE), /\?core or \?derived/);
    assert.ok(Buffer.byteLength(JSON.stringify(core)) < Buffer.byteLength(SOURCE) / 2, 'the core is the smaller piece');
});

/** A lazy catalogue over the real two pieces, counting fetches of the second (a promise, as import() is). */
const lazy = ({fail = 0} = {}) => {
    const fetched = {count: 0};
    const cat = createLazyCatalog({
        core: catalogFrom(piece('?core')),
        loadRest: async () => {
            fetched.count++;
            if (fetched.count <= fail) throw new Error('offline');
            return catalogFrom(piece('?derived'));
        }
    });
    return {...cat, fetched};
};

/**
 * The gear-mechanics examples (gearbox lane) are built from derived transmission parts (clutch
 * gears, driving ring, changeover catch, differential casing): opening one loads the rest first,
 * as any model naming a derived part does (the next test); so do the Excavator and the Crane (turntable, linear
 * actuators, bucket: derived parts) and the RCX bumper car. Every other shipped model stays core.
 */
// The RCX bumper car (hubs/rcx/) stands its castor on derived System and Technic bricks and holds its
// light sensor with a derived pin/bush connector; the EV3 wall stopper and the NXT bumper bot carry their free front
// wheels on derived axles. The radio-hub examples (hubs/lwp3, hubs/wedo2) are pinned and stacked on derived beams, bricks and axles.
// The governor's perpendicular axle/pin connectors (15100) are derived parts, as are Vector Delta's steering links (5996).
const NEEDS_REST = ['rod-ratio.ldr', 'vernier-drive.ldr', 'line-turner.ldr', 'dune-strider.ldr', 'atlas-six.ldr', 'oblique.ldr', 'cable-compass.ldr', 'cable-compass-control.ldr', 'rise-ratio.ldr', 'rise-ratio-control.ldr', 'cascade.ldr', 'cascade-control.ldr', 'wavemaker.ldr', 'wavemaker-control.ldr', 'sine-shuttle.ldr', 'quartermaster.ldr', 'watt-line.ldr', 'twin-tempo.ldr', 'root-bridge.ldr', 'balance-engine.ldr', 'cusp-lab.ldr', 'gimbal-lab.ldr', 'product-plotter.ldr', 'sky-courier.ldr', 'resonance-lab.ldr', 'resonance-lab.mpd', 'counterturn.ldr', 'snapgate.ldr', 'echo-bridge.ldr', 'linger.ldr', 'crossline.ldr', 'bit-keeper.ldr', 'offset-orbit.ldr', 'circle-splitter.ldr', 'integral.ldr', 'ellipsa.ldr', 'momentum-twins.ldr', 'bloom-gate.ldr', 'amplify.ldr', 'pantograph-doubler.ldr', 'scale-studio.ldr', 'ripple-relay.ldr', 'crossglide.ldr', 'scale-echo.ldr', 'turnwise.ldr', 'ellipse-engine.ldr', 'quickstroke.ldr', 'sarrus-lift.ldr', 'magnetic-chess.ldr', 'orbit-mixer.ldr', 'phase-bridge.ldr', 'phase-bridge-misphased.ldr', 'axis-plotter.ldr', 'tilt-lab.ldr', 'mean-machine.ldr', 'stepworks.ldr', 'stride-lab.ldr', 'twinpoint.ldr', 'butterfly.ldr', 'tempo-loop.ldr', 'atlas-arm.ldr', 'switchback-lift.ldr', 'straight-eight.ldr', 'pendulum-array.ldr', 'clutch-bench.ldr', 'centrifugal-governor.ldr', 'pulse-percussion.ldr', 'tidal-trio.ldr', 'orbital-loom.ldr', 'flywheel-differential.ldr', 'screw-crane.ldr', 'differential.ldr', 'differential-car.ldr', 'gearbox.ldr', 'excavator.ldr', 'crane.ldr', 'rcx-bumper-car.ldr', 'ev3-wall-stopper.ldr', 'nxt-bumper-bot.ldr',
    'technic-hub-bench.ldr', 'boost-rover.ldr', 'wedo-milo.ldr',
    // Reviewed nine-model intake: each listed assembly actually names derived stock parts.
    'looprelay.ldr', 'looprelay.mpd', 'paritydial.ldr', 'paritydial.mpd', 'counterslide.ldr', 'counterslide.mpd', 'toggle-press.ldr', 'toggle-press.mpd', 'footfall.ldr', 'footfall.mpd', 'phasekeeper.ldr', 'phasekeeper.mpd', 'vectorsum.ldr', 'vectorsum.mpd', 'pointweaver.ldr', 'pointweaver.mpd',
    // The 21 experimental Technic examples (ldr + MPD wrapper) are built on derived pins, connectors and links.
    'apex.ldr', 'apex.mpd', 'aster-governor.ldr', 'aster-governor.mpd', 'bend-ripple.ldr', 'bend-ripple.mpd', 'bloom.ldr', 'bloom.mpd', 'cadence-geneva.ldr', 'cadence-geneva.mpd', 'cross-ratio.ldr', 'cross-ratio.mpd', 'equinox-differential.ldr', 'equinox-differential.mpd', 'helios-transmission.ldr', 'helios-transmission.mpd', 'inertia-loop.ldr', 'inertia-loop.mpd', 'kestrel-flapper.ldr', 'kestrel-flapper.mpd', 'lumen-iris.ldr', 'lumen-iris.mpd', 'meridian-linkage.ldr', 'meridian-linkage.mpd', 'offset-relay.ldr', 'offset-relay.mpd', 'orion-cardan.ldr', 'orion-cardan.mpd', 'pan-shift.ldr', 'pan-shift.mpd', 'rack-decoder.ldr', 'rack-decoder.mpd', 'remote-pivot.ldr', 'remote-pivot.mpd', 'solstice-pumpjack.ldr', 'solstice-pumpjack.mpd', 'tangent-table.ldr', 'tangent-table.mpd', 'vesper-quickreturn.ldr', 'vesper-quickreturn.mpd', 'vector-delta.ldr', 'vector-delta.mpd',
    // The later experimental intakes and their physical controls stand on the same derived connectors.
    'tempest-pendulum.ldr', 'tempest-pendulum.mpd', 'schmidt-shift.ldr', 'schmidt-shift.mpd', 'poise.ldr', 'poise.mpd', 'poise-mass-control.ldr', 'poise-mass-control.mpd', 'equal-share.ldr', 'equal-share.mpd', 'equal-share-even-springs.ldr', 'equal-share-even-springs.mpd', 'spiral-scribe.ldr', 'spiral-scribe.mpd', 'stroke-shift.ldr', 'stroke-shift.mpd', 'triad-table.ldr', 'triad-table.mpd', 'paired-door-sync.ldr', 'paired-door-sync.mpd', 'toggle-lever.ldr', 'toggle-lever.mpd', 'impulse-line.ldr', 'impulse-line.mpd', 'impulse-line-missing-middle.ldr', 'impulse-line-missing-middle.mpd', 'final-squeeze.ldr', 'final-squeeze.mpd', 'travel-dial.ldr', 'travel-dial.mpd', 'travel-dial-wheel-raised.ldr', 'travel-dial-wheel-raised.mpd', 'ghost-pivot.ldr', 'ghost-pivot.mpd', 'ghost-pivot-unequal-link.ldr', 'ghost-pivot-unequal-link.mpd', 'afterturn.ldr', 'afterturn.mpd', 'afterturn-fixed-masses.ldr', 'afterturn-fixed-masses.mpd', 'quiet-partner.ldr', 'quiet-partner.mpd', 'quiet-partner-control.ldr', 'quiet-partner-control.mpd', 'high-select.ldr', 'high-select.mpd', 'high-select-mirror.ldr', 'high-select-mirror.mpd', 'obliquity-orrery.ldr', 'obliquity-orrery.mpd', 'obliquity-orrery-turned-axis.ldr', 'obliquity-orrery-turned-axis.mpd', 'pivot-exchange.ldr', 'pivot-exchange.mpd', 'pivot-exchange-wide.ldr', 'pivot-exchange-wide.mpd', 'air-budget.ldr', 'air-budget.mpd', 'air-budget-two-tanks.ldr', 'air-budget-two-tanks.mpd', 'foldback.ldr', 'foldback.mpd', 'foldback-open.ldr', 'foldback-open.mpd', 'thirdline.ldr', 'thirdline.mpd', 'thirdline-control.ldr', 'thirdline-control.mpd', 'samebeat.ldr', 'samebeat.mpd', 'samebeat-conjugate.ldr', 'samebeat-conjugate.mpd', 'samebeat-control.ldr', 'samebeat-control.mpd', 'carry-ratio.ldr', 'carry-ratio.mpd', 'carry-ratio-control.ldr', 'carry-ratio-control.mpd', 'sarrus-lift-single-chain.ldr', 'sarrus-lift-single-chain.mpd', 'phasor-twin.ldr', 'phasor-twin.mpd', 'phasor-twin-control.ldr', 'phasor-twin-control.mpd', 'rimrun.ldr', 'rimrun.mpd', 'rimrun-swapped.ldr', 'rimrun-swapped.mpd', 'swayshift.ldr', 'swayshift.mpd', 'tipline.ldr', 'tipline.mpd', 'tipline-swapped.ldr', 'tipline-swapped.mpd', 'twistspan.ldr', 'twistspan.mpd', 'twistspan-inner.ldr', 'twistspan-inner.mpd', 'evenhand.ldr', 'evenhand.mpd', 'evenhand-control.ldr', 'evenhand-control.mpd'];

test('the gear-mechanics examples and the Excavator load the rest once and parse with nothing refused', async () => {
    const cat = lazy();
    for (const f of NEEDS_REST) {
        const text = readFileSync(path.join(MODELS, f), 'utf8');
        const catalog = await cat.catalogFor(text);
        assert.deepEqual(parseModel(text, {catalog}).refusals, [], `${f}: nothing refused`);
    }
    assert.equal(cat.fetched.count, 1, 'the rest is fetched once');
});

test('every shipped model loads and parses on the core alone: opening one never fetches the rest', async () => {
    const files = readdirSync(MODELS).filter(f => /\.(ldr|mpd)$/i.test(f) && !NEEDS_REST.includes(f));
    assert.ok(files.length >= 5, files.join(', '));
    const cat = lazy();
    for (const f of files) {
        const text = readFileSync(path.join(MODELS, f), 'utf8');
        const catalog = await cat.catalogFor(text);
        assert.equal(catalog, cat.catalog);
        const {model, refusals} = parseModel(text, {catalog});
        assert.deepEqual(refusals, [], `${f}: nothing refused`);
        assert.ok(model.parts.length > 0, f);
    }
    assert.equal(cat.fetched.count, 0, 'the second piece was not fetched');
    assert.equal(cat.loaded(), false);
});

test('a model naming a derived part loads the rest first, into the same Map: the part is placed, not refused', async () => {
    const cat = lazy();
    const text = ['0 a brick on a beam', line('32524.dat'), line('6541.dat', 40)].join('\n');
    // Without the rest the brick would be refused: that is what loading it first prevents.
    assert.equal(parseModel(text, {catalog: cat.catalog}).refusals.length, 1);
    const held = cat.catalog;
    const catalog = await cat.catalogFor(text);
    assert.equal(catalog, held, 'the very Map everyone holds, now complete');
    assert.equal(cat.fetched.count, 1);
    assert.equal(catalog.size, ALL.parts.length);
    const {model, refusals} = parseModel(text, {catalog});
    assert.deepEqual(refusals, []);
    assert.deepEqual(model.parts.map(p => p.part), ['32524.dat', '6541.dat']);
    // Loaded once: Build opening later, or another such model, fetches nothing.
    await cat.loadFullCatalog();
    await cat.catalogFor(text);
    assert.equal(cat.fetched.count, 1);
});

test('Build opening loads the whole palette once, however many ask at the same time', async () => {
    const cat = lazy();
    const [a, b, c] = await Promise.all([cat.loadFullCatalog(), cat.loadFullCatalog(), cat.catalogFor(line('3001.dat'))]);
    assert.equal(a, b);
    assert.equal(b, c);
    assert.equal(cat.fetched.count, 1);
    assert.equal(cat.loaded(), true);
    assert.ok(a.has('3001.dat') && a.has('2780.dat'));
});

test('a part no catalogue has is still refused (after looking), and a failed fetch may be tried again', async () => {
    const cat = lazy({fail: 1});
    const text = line('99999.dat');
    await assert.rejects(cat.catalogFor(text), /offline/);
    const catalog = await cat.catalogFor(text);
    assert.equal(cat.fetched.count, 2, 'tried again after the failure');
    assert.equal(parseModel(text, {catalog}).refusals.length, 1, 'an unknown part stays unknown');
});

test('the pane asks for the rest before it parses a model and before Build opens its palette', () => {
    const lab = readFileSync(path.join(ROOT, 'overlay/scratch-gui/src/lib/bw-sim/sim-lab.js'), 'utf8');
    assert.match(lab, /import CORE_PARTS from '\.\/part-meta\/parts\.json\?core'/);
    assert.match(lab, /import\(\/\* webpackChunkName: "bw-sim-parts" \*\/ '\.\/part-meta\/parts\.json\?derived'\)/);
    assert.doesNotMatch(lab, /from '\.\/part-meta\/parts\.json'/, 'the whole file is not bundled as well');
    const pane = readFileSync(path.join(ROOT, 'overlay/scratch-gui/src/components/tw-pseudocode/sim-lab-pane.jsx'), 'utf8');
    const babel = createRequire(path.join(ROOT, 'packages/scratch-gui/package.json'))('@babel/core');
    const ast = babel.parseSync(pane, {babelrc: false, configFile: false, parserOpts: {plugins: ['jsx']}});
    const methods = new Map();
    babel.traverse(ast, {ClassMethod(path) {
        if (!['openText', 'enterBuild'].includes(path.node.key.name)) return;
        assert.ok(!methods.has(path.node.key.name), 'one production method for each catalog boundary');
        methods.set(path.node.key.name, path);
    }});
    const call = (method, callee) => {
        const found = [];
        assert.ok(methods.has(method), `${method} is present`);
        methods.get(method).traverse({
            Function(path) { path.skip(); },
            CallExpression(path) {
                if (pane.slice(path.node.callee.start, path.node.callee.end) === callee) found.push(path);
            }
        });
        assert.equal(found.length, 1, `${method} directly calls ${callee} once`);
        return found[0];
    };
    const catalog = call('openText', 'this.lib.catalogFor');
    assert.equal(catalog.parent.type, 'AwaitExpression', 'model-specific catalog loading is awaited');
    assert.ok(catalog.node.start < call('openText', 'SimSession.fromText').node.start,
        'openText: catalogFor before the model is parsed');
    const full = call('enterBuild', 'this.lib.loadFullCatalog');
    const geometry = call('enterBuild', 'fetchBuildLDraw');
    assert.equal(full.parent.type, 'AwaitExpression', 'the full catalog is awaited');
    assert.equal(geometry.parent.type, 'AwaitExpression', 'packed geometry is awaited');
    const spread = geometry.node.arguments[0]?.elements?.[0];
    assert.equal(spread?.type, 'SpreadElement');
    assert.equal(spread.argument?.callee?.object?.name, 'CATALOG');
    assert.equal(spread.argument?.callee?.property?.name, 'keys');
    assert.ok(full.node.start < geometry.node.start && geometry.node.start < call('enterBuild', 'createEditor').node.start,
        'enterBuild: the whole catalog before packed geometry and the editor palette');
    const imports = ast.program.body.filter(node => node.type === 'ImportDeclaration' &&
        node.source.value === '../../lib/bw-sim/ldraw/build-pack.js');
    assert.equal(imports.length, 1);
    assert.ok(imports[0].specifiers.some(node => node.imported?.name === 'fetchBuildLDraw' &&
        node.local?.name === 'fetchBuildLDraw'), 'the actual packed geometry loader is imported');
    const config = readFileSync(path.join(ROOT, 'overlay/scratch-gui/webpack.config.js'), 'utf8');
    assert.match(config, /resourceQuery: \/\^\\\?\(core\|derived\)\$\//);
    assert.match(config, /parts-subset-loader\.js/);
});
