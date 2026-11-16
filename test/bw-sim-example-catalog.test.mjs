// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {REPO} from './helpers/bw-integrated.mjs';
import {MODELS, prepareModel, catalogFrom} from '../overlay/scratch-gui/src/lib/bw-sim/sim-session.js';
import {MODEL_LESSONS} from '../overlay/scratch-gui/src/lib/bw-sim/model/example-catalog.js';
import {filterModelExamples, EXAMPLE_TOPICS} from '../overlay/scratch-gui/src/lib/bw-sim/model/example-browser.js';
const catalog = catalogFrom(JSON.parse(readFileSync(`${REPO}/overlay/scratch-gui/src/lib/bw-sim/part-meta/parts.json`)));
test('gallery metadata counts the actual models, motors and hubs and covers every menu entry', () => {
    assert.deepEqual(Object.keys(MODEL_LESSONS).sort(), MODELS.map(m => m.id || m.file).sort());
    for (const m of MODELS) {
        const d = MODEL_LESSONS[m.id || m.file];
        const p = prepareModel(readFileSync(`${REPO}/overlay/scratch-gui/static/sim-lab/models/${m.file}`, 'utf8'), catalog);
        assert.equal(d.pieces, p.model.parts.length + (p.model.belts || []).length, m.file);
        assert.equal(d.motors, p.mechanism.actuators.length, m.file);
        assert.deepEqual(d.hubs, [...new Set(p.mechanism.hubs.map(h => h.profile))]);
        assert.ok(d.description.en && d.description.de && EXAMPLE_TOPICS[d.topic]);
        assert.equal(d.license, 'BSD-3-Clause');
    }
});
test('filter physics, translated descriptions, hubs, and genuinely larger models', () => {
    const large = filterModelExamples(MODELS, MODEL_LESSONS, {size: 'large'});
    assert.deepEqual(large.map(m => m.id || m.file).sort(), ['afterturn.ldr', 'air-budget.ldr', 'amplify.ldr', 'apex.ldr', 'atlas-arm.ldr', 'atlas-six.ldr', 'axis-plotter.ldr', 'balance-engine.ldr', 'bend-ripple.ldr', 'bit-keeper.ldr', 'bloom-gate.ldr', 'butterfly.ldr', 'cable-compass-control.ldr', 'cable-compass.ldr', 'cadence-geneva.ldr', 'carry-ratio.ldr', 'cascade-control.ldr', 'cascade.ldr', 'chain-transmission.ldr', 'circle-splitter.ldr', 'counterturn.ldr', 'crane.ldr', 'cross-ratio.ldr', 'crossglide.ldr', 'crossline.ldr', 'cusp-lab.ldr', 'differential-car.ldr', 'dune-strider.ldr', 'echo-bridge.ldr', 'ellipsa.ldr', 'ellipse-engine.ldr', 'equal-share.ldr', 'evenhand.ldr', 'excavator.ldr', 'final-squeeze.ldr', 'flywheel-differential.ldr', 'foldback.ldr', 'footfall.ldr', 'ghost-pivot.ldr', 'gimbal-lab.ldr', 'helios-transmission.ldr', 'high-select.ldr', 'integral.ldr', 'kestrel-flapper.ldr', 'line-turner.ldr', 'linger.ldr', 'looprelay.ldr', 'lumen-iris.ldr', 'magnetic-chess.ldr', 'mean-machine.ldr', 'meridian-linkage.ldr', 'momentum-twins.ldr', 'oblique.ldr', 'obliquity-orrery.ldr', 'offset-orbit.ldr', 'offset-relay.ldr', 'orbit-mixer.ldr', 'orbital-loom-eightfold', 'orbital-loom-elevenfold', 'orbital-loom-sevenfold', 'orbital-loom.ldr', 'orion-cardan.ldr', 'paired-door-sync.ldr', 'pantograph-doubler.ldr', 'pendulum-array.ldr', 'phase-bridge-misphased.ldr', 'phase-bridge.ldr', 'phasekeeper.ldr', 'phasor-twin.ldr', 'pivot-exchange.ldr', 'pointweaver.ldr', 'poise.ldr', 'product-plotter.ldr', 'pulse-percussion.ldr', 'quartermaster.ldr', 'quickstroke.ldr', 'rack-decoder.ldr', 'ratio-workbench.ldr', 'remote-pivot.ldr', 'resonance-lab-fast', 'resonance-lab-slow', 'resonance-lab.ldr', 'rimrun.ldr', 'ripple-relay.ldr', 'rise-ratio-control.ldr', 'rise-ratio.ldr', 'rod-ratio.ldr', 'root-bridge.ldr', 'samebeat.ldr', 'sarrus-lift.ldr', 'scale-echo.ldr', 'scale-studio.ldr', 'schmidt-shift.ldr', 'sine-shuttle.ldr', 'sky-courier.ldr', 'snapgate.ldr', 'stepworks.ldr', 'straight-eight.ldr', 'stride-lab.ldr', 'stroke-shift.ldr', 'swayshift.ldr', 'switchback-lift.ldr', 'tangent-table.ldr', 'tempest-pendulum.ldr', 'tempo-loop.ldr', 'thirdline.ldr', 'tidal-trio-alternating', 'tidal-trio-reverse', 'tidal-trio-together', 'tidal-trio.ldr', 'tilt-lab.ldr', 'tipline.ldr', 'toggle-lever.ldr', 'toggle-press.ldr', 'travel-dial.ldr', 'triad-table.ldr', 'turnwise.ldr', 'twin-tempo.ldr', 'twinpoint.ldr', 'twistspan.ldr', 'vectorsum.ldr', 'vernier-drive.ldr', 'watt-line.ldr', 'wavemaker-control.ldr', 'wavemaker.ldr']);
    assert.deepEqual(filterModelExamples(MODELS, MODEL_LESSONS, {query: 'Schwungrad', locale: 'de'}).map(m => m.file), ['counterturn.ldr', 'flywheel-differential.ldr']);
    assert.deepEqual(filterModelExamples(MODELS, MODEL_LESSONS, {topic: 'chains', size: 'large'}).map(m => m.file), ['chain-transmission.ldr']);
    assert.equal(filterModelExamples(MODELS, MODEL_LESSONS, {query: 'no-such-model-123'}).length, 0);
    assert.ok(filterModelExamples(MODELS, MODEL_LESSONS, {query: 'ev3'}).length > 0);
    const fake = [{file: 'boundary.ldr', title: {en: 'Boundary'}}];
    assert.equal(filterModelExamples(fake, {'boundary.ldr': {pieces: 50, description: {en: ''}, hubs: [], author: ''}}, {size: 'large'}).length, 0);
});
