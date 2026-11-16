// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// Every reference model the Robot Lab's Model list offers (MODELS,
// static/sim-lab/models/) is a file that parses with no refusals and compiles
// with no error diagnostics and its motors on ports. The line follower is the
// fixture the lap test drives (test/bw-sim-line-follower.test.mjs), written
// out by serializeModel, so the shipped model is the one that was proven; its
// example program (static/sim-lab/programs/) is a DEVICE SPIKE text, run for a
// lap by test/bw-sim-line-follower-program.test.mjs. The Wall stopper's and the
// Colour explorer's examples are run by test/bw-sim-wall-stopper-program.test.mjs
// and test/bw-sim-colour-explorer-program.test.mjs.

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseModel, serializeModel} from '../overlay/scratch-gui/src/lib/bw-sim/model/ldraw-model.js';
import {MODELS, MODELS_BASE, PROGRAMS_BASE, prepareModel, catalogFrom} from '../overlay/scratch-gui/src/lib/bw-sim/sim-session.js';
import {MATS, createMat} from '../overlay/scratch-gui/src/lib/bw-sim/world/mats.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const GUI = path.join(ROOT, 'overlay/scratch-gui');
const CATALOG = catalogFrom(JSON.parse(readFileSync(path.join(GUI, 'src/lib/bw-sim/part-meta/parts.json'), 'utf8')));
const FIXTURE = JSON.parse(readFileSync(path.join(ROOT, 'test/fixtures/bw-sim/line-follower.json'), 'utf8'));

test('every model in the list is a shipped file that compiles cleanly, motors and sensors on ports', () => {
    assert.deepEqual(MODELS.map(m => m.id || m.file), ['driving-base.ldr', 'line-follower.ldr', 'wall-stopper.ldr', 'colour-explorer.ldr', 'sumo', 'forklift.ldr', 'maze-runner.ldr',
        'gearbox.ldr', 'differential.ldr', 'differential-car.ldr', 'chain-drive.ldr', 'pneumatic-press.ldr', 'drawing-robot.ldr', 'mean-machine.ldr', 'stepworks.ldr', 'stride-lab.ldr', 'twinpoint.ldr', 'butterfly.ldr', 'tempo-loop.ldr', 'tilt-lab.ldr', 'rod-ratio.ldr', 'vernier-drive.ldr', 'line-turner.ldr', 'dune-strider.ldr', 'atlas-six.ldr', 'oblique.ldr', 'cable-compass.ldr', 'cable-compass-control.ldr', 'rise-ratio.ldr', 'rise-ratio-control.ldr', 'cascade.ldr', 'cascade-control.ldr', 'wavemaker.ldr', 'wavemaker-control.ldr', 'sine-shuttle.ldr', 'quartermaster.ldr', 'toggle-lever.ldr', 'thirdline.ldr', 'tipline.ldr', 'twistspan.ldr', 'swayshift.ldr', 'samebeat.ldr', 'carry-ratio.ldr', 'air-budget.ldr', 'cross-ratio.ldr', 'foldback.ldr', 'ghost-pivot.ldr', 'travel-dial.ldr', 'pivot-exchange.ldr', 'phasor-twin.ldr', 'final-squeeze.ldr', 'high-select.ldr', 'poise.ldr', 'bend-ripple.ldr', 'offset-relay.ldr', 'rack-decoder.ldr', 'remote-pivot.ldr', 'schmidt-shift.ldr', 'equal-share.ldr', 'stroke-shift.ldr', 'triad-table.ldr', 'toggle-press.ldr', 'footfall.ldr', 'phasekeeper.ldr', 'vectorsum.ldr', 'pointweaver.ldr', 'kestrel-flapper.ldr', 'meridian-linkage.ldr', 'lumen-iris.ldr', 'tangent-table.ldr', 'paired-door-sync.ldr', 'rimrun.ldr', 'watt-line.ldr', 'twin-tempo.ldr', 'root-bridge.ldr', 'balance-engine.ldr', 'cusp-lab.ldr', 'gimbal-lab.ldr', 'resonance-lab.ldr', 'resonance-lab-slow', 'resonance-lab-fast', 'echo-bridge.ldr', 'linger.ldr', 'crossline.ldr', 'counterturn.ldr', 'afterturn.ldr', 'helixgate.ldr', 'looprelay.ldr', 'paritydial.ldr', 'counterslide.ldr', 'evenhand.ldr', 'obliquity-orrery.ldr', 'cadence-geneva.ldr', 'helios-transmission.ldr', 'orion-cardan.ldr', 'apex.ldr', 'tempest-pendulum.ldr', 'product-plotter.ldr', 'snapgate.ldr', 'bit-keeper.ldr', 'offset-orbit.ldr', 'circle-splitter.ldr', 'integral.ldr', 'ellipsa.ldr', 'momentum-twins.ldr', 'bloom-gate.ldr', 'amplify.ldr', 'pantograph-doubler.ldr', 'scale-studio.ldr', 'ripple-relay.ldr', 'crossglide.ldr', 'scale-echo.ldr', 'turnwise.ldr', 'ellipse-engine.ldr', 'quickstroke.ldr', 'sarrus-lift.ldr', 'magnetic-chess.ldr', 'orbit-mixer.ldr', 'phase-bridge.ldr', 'phase-bridge-misphased.ldr', 'axis-plotter.ldr', 'atlas-arm.ldr', 'switchback-lift.ldr', 'straight-eight.ldr', 'pendulum-array.ldr', 'clutch-bench.ldr', 'pulse-percussion.ldr', 'centrifugal-governor.ldr', 'tidal-trio.ldr', 'tidal-trio-together', 'tidal-trio-alternating', 'tidal-trio-reverse', 'orbital-loom.ldr', 'orbital-loom-sevenfold', 'orbital-loom-elevenfold', 'orbital-loom-eightfold', 'positioning-arm.ldr', 'ratio-workbench.ldr', 'rack-shuttle.ldr', 'crank-rocker.ldr', 'parallel-lift.ldr', 'screw-crane.ldr', 'sky-courier.ldr', 'pivot-rover.ldr', 'chain-transmission.ldr', 'flywheel-differential.ldr', 'survey-rover.ldr', 'excavator.ldr', 'crane.ldr', 'rcx-bumper-car.ldr', 'rcx-line-follower', 'ev3-wall-stopper.ldr', 'nxt-bumper-bot.ldr',
        'motor-bench.ldr', 'technic-hub-bench.ldr', 'boost-rover.ldr', 'wedo-milo.ldr']);
    // The pane lists entries by key (id, else file): keys are unique, and a file listed twice needs an id.
    const keys = MODELS.map(m => m.id || m.file);
    assert.equal(new Set(keys).size, keys.length, `unique keys: ${keys}`);
    for (const entry of MODELS.filter(m => m.example)) {
        assert.ok(existsSync(path.join(GUI, 'static/sim-lab/programs', entry.example)), `${entry.example} is shipped`);
    }
    for (const entry of MODELS) {
        assert.ok(entry.title.en && entry.title.de && entry.title.en !== entry.title.de, `${entry.file}: EN and DE titles`);
        const text = readFileSync(path.join(GUI, MODELS_BASE, entry.file), 'utf8');
        const {model, refusals} = parseModel(text, {catalog: CATALOG});
        assert.deepEqual(refusals, [], entry.file);
        const {mechanism, issues} = prepareModel(text, CATALOG, {mat: entry.mat || null});
        assert.deepEqual(issues.filter(i => i.severity === 'error'), [], entry.file);
        // The motor bench is the smallest thing the Robot Lab can turn: a motor, an axle and a gear, no hub.
        assert.ok(model.parts.length > (entry.file === 'motor-bench.ldr' ? 2 : 5), entry.file);
        // The driving bases drive their wheels on A and B; the Forklift (R4) stands, its lift motor on C;
        // the gearbox drives on A and shifts on B; the differential drives on A and holds a side on C; the chain drive turns A;
        // the Excavator: wheels on A and B, slew C, boom D, stick E, bucket F.
        // The RCX bumper car drives on outputs A and C (its sensors on inputs 1 and 2); the hubless motor bench turns A.
        // The radio hubs (hubs/lwp3, hubs/wedo2): the Technic Hub bench turns A; the BOOST rover drives on the Move Hub's
        // built-in A and B; the WeDo rover drives one wheel on A (its motion sensor on B).
        const ports = {'obliquity-orrery.ldr':['A'],'cadence-geneva.ldr':['A'],'orion-cardan.ldr':['A'],'apex.ldr':['A'],'tempest-pendulum.ldr':['A'],'helixgate.ldr':['A'],'looprelay.ldr':['A'],'paritydial.ldr':['A'],'counterslide.ldr':['A'],'toggle-press.ldr':['A'],'footfall.ldr':['A'],'phasekeeper.ldr':['A'],'paired-door-sync.ldr':['A'],'rimrun.ldr':['A'],'kestrel-flapper.ldr':['A'],'meridian-linkage.ldr':['A'],'lumen-iris.ldr':['A'],'triad-table.ldr':['A','B','C'],'equal-share.ldr':['A'],'schmidt-shift.ldr':['A'],'remote-pivot.ldr':['A'],'tipline.ldr':['A'],'twistspan.ldr':['A'],'swayshift.ldr':['A'],'final-squeeze.ldr':['A'],'high-select.ldr':['A','B'],'samebeat.ldr':['A'],'pivot-exchange.ldr':[],'phasor-twin.ldr':['A'],'rod-ratio.ldr':['A'],'vernier-drive.ldr':['A'],'line-turner.ldr':['A'],'dune-strider.ldr':['A'],'atlas-six.ldr':['A','B','C','D','E','F'],'oblique.ldr':['A','B'],'cable-compass.ldr':['A','B'],'cable-compass-control.ldr':['A','B'],'rise-ratio.ldr':['A'],'rise-ratio-control.ldr':['A'],'cascade.ldr':['A'],'cascade-control.ldr':['A'],'wavemaker.ldr':['A'],'wavemaker-control.ldr':['A'],'sine-shuttle.ldr':['A'],'quartermaster.ldr':['A','B'],'toggle-lever.ldr':['A'],'thirdline.ldr':['A'],'carry-ratio.ldr':['A'],'air-budget.ldr':['A'],'cross-ratio.ldr':['A'],'foldback.ldr':['A'],'ghost-pivot.ldr':['A'],'travel-dial.ldr':['A'],'watt-line.ldr':['A'],'twin-tempo.ldr':['A'],'root-bridge.ldr':['A','B'],'balance-engine.ldr':['A','B'],'cusp-lab.ldr':['A'],'gimbal-lab.ldr':['A','B','C'],'product-plotter.ldr':['A','B'],'sky-courier.ldr':['A','B'],'resonance-lab.ldr':['A'],'counterturn.ldr':['A'],'snapgate.ldr':['A'],'echo-bridge.ldr':['A'],'linger.ldr':['A'],'crossline.ldr':['A'],'bit-keeper.ldr':['A'],'momentum-twins.ldr':['A','B'],'bloom-gate.ldr':['A'],'offset-orbit.ldr':['A'],'circle-splitter.ldr':['A'],'integral.ldr':['A','B'],'ellipsa.ldr':['A'],'amplify.ldr':['A'],'pantograph-doubler.ldr':['A'],'scale-studio.ldr':['A'],'ripple-relay.ldr':['A'],'crossglide.ldr':['A'],'scale-echo.ldr':['A','B'],'turnwise.ldr':['A'],'ellipse-engine.ldr':['A'], 'quickstroke.ldr':['A'], 'sarrus-lift.ldr':['A'], 'magnetic-chess.ldr':['A','B','C'], 'phase-bridge.ldr': ['A'], 'phase-bridge-misphased.ldr': ['A'], 'axis-plotter.ldr': ['A','B','C'], 'tilt-lab.ldr': ['A','B'], 'tempo-loop.ldr': ['A'], 'mean-machine.ldr': ['A', 'B'], 'stepworks.ldr': ['A'], 'stride-lab.ldr': ['A'], 'twinpoint.ldr': ['A', 'B'], 'butterfly.ldr': ['A'], 'atlas-arm.ldr': ['A', 'B', 'D'], 'switchback-lift.ldr': ['A', 'B', 'D'], 'straight-eight.ldr': ['A'], 'pendulum-array.ldr': ['A'], 'clutch-bench.ldr': ['A', 'B'], 'pulse-percussion.ldr': ['A'], 'centrifugal-governor.ldr': ['A'], 'tidal-trio.ldr': ['A', 'B', 'C'], 'positioning-arm.ldr': ['A', 'B'], 'ratio-workbench.ldr': ['A', 'B', 'C'], 'rack-shuttle.ldr': ['A'], 'crank-rocker.ldr': ['A'], 'parallel-lift.ldr': ['A'], 'screw-crane.ldr': ['A', 'C'], 'pivot-rover.ldr': ['A', 'B', 'C'], 'chain-transmission.ldr': ['A'], 'flywheel-differential.ldr': ['A', 'C'], 'survey-rover.ldr': ['A', 'B', 'C'], 'forklift.ldr': ['C'], 'differential.ldr': ['A', 'C'], 'excavator.ldr': ['A', 'B', 'C', 'D', 'E', 'F'],
            'crane.ldr': ['A', 'B', 'C'], 'rcx-bumper-car.ldr': ['A', 'C'], 'motor-bench.ldr': ['A'], 'ev3-wall-stopper.ldr': ['B', 'C'],
            'nxt-bumper-bot.ldr': ['B', 'C'], 'technic-hub-bench.ldr': ['A'], 'wedo-milo.ldr': ['A'], 'chain-drive.ldr': ['A'], 'pneumatic-press.ldr': ['A']}[entry.file] || ['A', 'B'];
        assert.deepEqual(mechanism.joints.filter(j => j.motor).map(j => j.motor.port).sort(), ports, `${entry.file}: motors on ${ports}`);
        // SPIKE sensors on the LPF2 ports A-F, the RCX's on its inputs 1-3.
        const rcx = mechanism.hubs.some(h => h.profile === 'rcx');
        // The EV3's and NXT's sensors on their inputs 1-4.
        const mindstorms = mechanism.hubs.find(h => h.profile === 'ev3' || h.profile === 'nxt');
        for (const s of mechanism.sensors || []) assert.match(s.port, rcx ? /^[1-3]$/ : mindstorms ? /^[1-4]$/ : /^[A-F]$/, `${entry.file}: sensor port`);
        if (entry.mat) assert.ok(MATS.some(m => m.id === entry.mat), `${entry.file}: mat ${entry.mat} exists`);
        if (entry.example) {
            const program = path.join(GUI, PROGRAMS_BASE, entry.example);
            assert.ok(existsSync(program), `${entry.file}: example ${entry.example} is shipped`);
            // SPIKE examples are DEVICE SPIKE text; RCX examples are NQC source with a main task;
            // the hubless bench's is `lab` words, which need no DEVICE.
            const source = readFileSync(program, 'utf8');
            if (rcx) assert.match(source, /^task main\(\)\s*$/m, entry.example);
            // The EV3's example is DEVICE EV3 text; the NXT's, legonxt blocks.
            else if (mindstorms && mindstorms.profile === 'ev3') assert.match(source, /^DEVICE EV3\s*$/m, entry.example);
            else if (mindstorms) assert.deepEqual(JSON.parse(source).extensions, ['legonxt'], entry.example);
            else if (entry.file === 'motor-bench.ldr') assert.match(source, /^\s+lab run motor A /m, entry.example);
            // The radio hubs' examples are the LEGO extensions' words (lib/legoHubsDialect.js), which need no DEVICE.
            else if (mechanism.hubs.some(h => ['technic-hub', 'boost-move-hub', 'wedo2'].includes(h.profile))) {
                assert.match(source, /^\s+(pup|boost|wedo) /m, entry.example);
            }
            else assert.match(source, /^DEVICE SPIKE\s*$/m, entry.example);
        }
    }
});

test('the shipped line follower is the lap-tested fixture, byte for byte as serializeModel writes it', () => {
    const text = readFileSync(path.join(GUI, MODELS_BASE, 'line-follower.ldr'), 'utf8');
    const title = text.slice(2, text.indexOf('\r\n'));
    assert.equal(text, serializeModel(FIXTURE.model, {name: 'line-follower.ldr', title}));
    const {mechanism} = prepareModel(text, CATALOG, {mat: 'line-oval'});
    assert.deepEqual(mechanism.sensors.map(s => [s.port, s.kind]), [['C', 'color']]);
    assert.equal(MODELS.find(m => m.file === 'line-follower.ldr').mat, FIXTURE.mat);
});

test('a mat can carry obstacles: the Wall mat puts a wall in the scene, ahead of its start pose', () => {
    const wall = createMat('wall');
    assert.equal(wall.obstacles.length, 1);
    const [obstacle] = wall.obstacles;
    const text = readFileSync(path.join(GUI, MODELS_BASE, 'driving-base.ldr'), 'utf8');
    const {mechanism, issues} = prepareModel(text, CATALOG, {mat: 'wall'});
    assert.deepEqual(issues.filter(i => i.severity === 'error'), []);
    const body = mechanism.bodies.find(b => b.id === `obstacle:${obstacle.id}`);
    assert.ok(body && body.motion === 'static', 'the wall is a static body');
    assert.deepEqual(body.colliders[0].halfExtents, obstacle.size.map(v => v / 2));
    // It stands on the floor: its bottom face is the ground body's top face.
    const ground = mechanism.bodies.find(b => b.id === 'ground');
    const groundTop = ground.position[1] + ground.colliders[0].halfExtents[1];
    assert.ok(Math.abs(body.position[1] - obstacle.size[1] / 2 - groundTop) < 1e-9);
    // Ahead of the start pose along its heading, inside the mat.
    const {x, z, heading} = wall.startPose;
    const h = heading * Math.PI / 180;
    const ahead = (body.position[0] - x) * Math.cos(h) + (body.position[2] - z) * Math.sin(h);
    assert.ok(ahead > 0.5, `the wall is ${ahead} m ahead of the start`);
    assert.ok(Math.abs(body.position[0]) + obstacle.size[0] / 2 <= wall.sizeM[0] / 2, 'inside the mat');
    // Mats without obstacles compile none.
    for (const id of ['plain', 'line-oval', 'colour-zones']) {
        assert.deepEqual(createMat(id).obstacles, []);
        assert.equal(prepareModel(text, CATALOG, {mat: id}).mechanism.bodies.filter(b => b.id.startsWith('obstacle:')).length, 0, id);
    }
});
