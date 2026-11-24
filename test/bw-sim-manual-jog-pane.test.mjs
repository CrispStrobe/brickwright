// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
// Execute the production pane methods and API at their hub/clock boundary; no physics is stepped here.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {MODELS, catalogFrom, prepareModel} from '../overlay/scratch-gui/src/lib/bw-sim/sim-session.js';
import {createRobotLabApi} from '../overlay/scratch-gui/src/lib/bw-sim/api/robot-lab-api.js';
import {manualDriveAllowed, setMixerMotorJog, setMixerMotorPower} from '../overlay/scratch-gui/src/components/tw-pseudocode/sim-lab-motor-control.js';
import {buildManualPolicyIndex} from '../overlay/scratch-gui/manual-policy-index.mjs';
import {createManualPolicyResolver} from '../overlay/scratch-gui/src/components/tw-pseudocode/sim-lab-manual-policy.js';
import {parseModel, serializeModel} from '../overlay/scratch-gui/src/lib/bw-sim/model/ldraw-model.js';

const guiRequire = createRequire(new URL('../packages/scratch-gui/package.json', import.meta.url));
const React = guiRequire('react');
const babel = guiRequire('@babel/core');
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('overlay/scratch-gui/src/components/tw-pseudocode/sim-lab-pane.jsx');
const ast = babel.parseSync(source, {babelrc: false, configFile: false, parserOpts: {plugins: ['jsx']}});
const paneClass = ast.program.body.find(node => node.type === 'ClassDeclaration' && node.id.name === 'SimLabPane');
const names = ['apiEnsureRunning', 'drive', 'renderMixer', 'renderConnections', 'manualControlPolicy', 'resolveManualControlPolicy',
    'setManualOverride'];
const methods = names.map(name => {
    const method = paneClass.body.body.find(node => node.key?.name === name);
    assert.ok(method, `production ${name} method`);
    return source.slice(method.start, method.end);
});
const code = babel.transformSync(`class PaneMethods {${methods.join('\n')}}\nmodule.exports = PaneMethods;`, {
    babelrc: false, configFile: false, presets: [[guiRequire.resolve('@babel/preset-react'), {runtime: 'classic'}]]
}).code;
const loaded = {exports: {}};
new Function('React', 'SimLabMotorMixer', 'manualDriveAllowed', 'setMixerMotorJog', 'setMixerMotorPower', 'createManualPolicyResolver', 'MIXER_OPEN_KEY', 'module', code)(
    React, () => null, manualDriveAllowed, setMixerMotorJog, setMixerMotorPower, createManualPolicyResolver, 'mixer-test', loaded);
const PaneMethods = loaded.exports;
const limits = MODELS.find(model => model.file === 'resonance-lab.ldr').manualJog;

const pane = ({manualJog = limits, pair = ['A', 'B'], status = 'ready'} = {}) => {
    const calls = [];
    const context = Object.create(PaneMethods.prototype);
    context.session = {bridge: true, lockstep: false};
    context.state = {status, manualOverride: false, driveSpeed: 50, mixerOpen: true,
        mixer: {session: context.session, power: {}}};
    context.manualPolicy = {session: context.session, available: true, manualJog};
    context.hub = {movementPair: pair,
        setSimulationEnabled: enabled => calls.push(['simulation', enabled]),
        motors: {
            percentToDps: (port, pct) => pct * 10,
            runAtSpeed: (port, dps) => calls.push(['speed', port, dps]),
            stop: port => calls.push(['stop', port])
        }};
    context.shippedModel = () => ({manualJog});
    context.spikeScene = () => true;
    context.startClock = () => calls.push(['clock']);
    context.setState = update => {
        const value = typeof update === 'function' ? update(context.state) : update;
        Object.assign(context.state, value);
        if (value.status) calls.push(['status', value.status]);
    };
    context.pause = () => calls.push(['pause']);
    context.props = {vm: {stopAll: () => calls.push(['vm-stop'])}};
    context.api = {
        motors: () => [{id: 'a0', port: 'A', hub: 'hub', direct: true}],
        encoder: () => ({ok: true, angleDeg: 0}),
        stopMotor: (id, action) => { calls.push(['motor-stop', id, action]); return {ok: true}; }
    };
    context.manualJogs = new Map();
    context.locale = 'en';
    context.renderDrive = () => { calls.push(['drive-pad']); return 'drive-pad'; };
    return {context, calls};
};

test('production drive handler refuses every continuous direction before override, clock or motor dispatch', () => {
    for (const port of ['A', 'B']) for (const direction of ['forward', 'back', 'left', 'right']) {
        const {context, calls} = pane({manualJog: {[port]: limits.A}});
        context.drive(direction);
        assert.deepEqual(calls, [], `${port}: ${direction}`);
        assert.equal(context.state.status, 'ready');
        assert.equal(context.state.manualOverride, false);
    }
    const {context, calls} = pane();
    context.drive('stop');
    assert.deepEqual(calls.filter(call => call[0] === 'stop'), [['stop', 'A'], ['stop', 'B']]);
    assert.equal(context.driving, null);
});

test('production pane resolves unchanged saved/imported assembly policy without restoring gallery, program or title identity', async () => {
    const {context} = pane();
    const source = read('overlay/scratch-gui/static/sim-lab/models/resonance-lab.ldr');
    const savedText = serializeModel(parseModel(source).model, {name: 'my-model.ldr', title: 'My saved machine'});
    const saved = parseModel(savedText).model;
    context.lib = {parseModel};
    context.state.shipped = null;
    context.state.modelFile = 'my-model.ldr';
    context.shippedModel = () => null;
    context.manualPolicyResolver = createManualPolicyResolver({models: MODELS, referenceDigests: buildManualPolicyIndex(MODELS)});
    const result = await context.resolveManualControlPolicy(saved, savedText);
    assert.deepEqual(result, {available: true, manualJog: limits});
    context.manualPolicy = {session: context.session, ...result};
    const controls = context.renderMixer({});
    assert.equal(controls.props.drive, null);
    assert.equal(controls.props.motors[0].manualJog, limits.A);
    assert.equal(context.state.shipped, null);
    assert.equal(context.state.modelFile, 'my-model.ldr');
    const changed = structuredClone(saved);
    changed.parts[0].position[0] += 1;
    assert.deepEqual(await context.resolveManualControlPolicy(changed, serializeModel(changed)), {available: true, manualJog: null});
    assert.deepEqual(await context.resolveManualControlPolicy(saved, `${savedText}\n2 16 0 0 0 1 1 1\n`), {available: true, manualJog: null});
});

test('failed or obsolete policy resolution blocks continuous controls and override while Stop all remains real hold', async () => {
    const {context, calls} = pane();
    const source = read('overlay/scratch-gui/static/sim-lab/models/resonance-lab.ldr');
    context.lib = {parseModel};
    context.manualPolicyResolver = () => { throw new Error('reference unavailable'); };
    context.manualPolicy = {session: context.session, ...await context.resolveManualControlPolicy(parseModel(source).model, source)};
    assert.equal(context.manualControlPolicy().available, false);
    context.setManualOverride(true);
    context.drive('forward');
    assert.deepEqual(calls, []);
    assert.equal(context.state.manualOverride, false);
    context.state.manualOverride = true; // stale UI state must also be guarded at dispatch.
    const controls = context.renderMixer({});
    assert.equal(controls.props.available, false);
    assert.equal(controls.props.drive, null);
    controls.props.onPower('a0', 5);
    controls.props.onJog('a0', 1);
    assert.deepEqual(calls, []);
    controls.props.onStopAll();
    assert.deepEqual(calls, [['vm-stop'], ['motor-stop', 'a0', 'hold']]);
    context.manualPolicy = {session: {}, available: true, manualJog: null};
    assert.equal(context.manualControlPolicy().available, false, 'an old scene cannot enable the new scene');
});

test('production drive handler respects a changed movement pair and retains all other shipped models', () => {
    const changed = pane({manualJog: {D: limits.A}, pair: ['C', 'D']});
    changed.context.drive('forward');
    assert.deepEqual(changed.calls, []);
    for (const model of MODELS.filter(model => model.manualJog === undefined)) {
        const {context, calls} = pane({manualJog: model.manualJog || {}});
        context.drive('forward');
        assert.deepEqual(calls.filter(call => call[0] === 'speed'), [['speed', 'A', -500], ['speed', 'B', 500]], model.file);
    }
});

test('production mixer omits the drive pad for either bounded pair port and preserves unrelated ports', () => {
    for (const port of ['A', 'B']) {
        const {context, calls} = pane({manualJog: {[port]: limits.A}});
        const element = context.renderMixer({});
        assert.equal(element.props.drive, null);
        assert.deepEqual(calls, []);
    }
    for (const manualJog of [{}, {C: limits.A}]) {
        const {context, calls} = pane({manualJog});
        assert.equal(context.renderMixer({}).props.drive, 'drive-pad');
        assert.deepEqual(calls, [['drive-pad']]);
    }
});

test('finite jog and slider commands use the real API callback to start the pane clock before hub dispatch from ready or paused', async () => {
    const catalog = catalogFrom(JSON.parse(read('overlay/scratch-gui/src/lib/bw-sim/part-meta/parts.json')));
    const {model, mechanism} = prepareModel(read('overlay/scratch-gui/static/sim-lab/models/resonance-lab.ldr'), catalog);
    for (const status of ['ready', 'paused']) for (const kind of ['jog', 'slider']) {
        const {context, calls} = pane({status});
        const hub = {
            readPort: () => ({kind: 'motor', angleDeg: 0, speedDps: 0}),
            directCommand: (port, command) => {
                calls.push(['command', port, command]);
                return {ok: true, done: Promise.resolve('completed')};
            }
        };
        context.session = {model, mechanism, catalog, hubs: [{id: 'hub', profile: 'spike-prime', hub}]};
        const api = createRobotLabApi({getSession: () => context.session, getStatus: () => context.state.status,
            ensureRunning: () => context.apiEnsureRunning()});
        try {
            const result = kind === 'jog' ? setMixerMotorJog(api, 'a0', limits.A, 1, {enabled: true}) : setMixerMotorPower(api, 'a0', 5);
            assert.equal(result.ok, true);
            assert.equal(context.state.status, 'running');
            assert.deepEqual(calls.slice(0, 3), [['simulation', true], ['clock'], ['status', 'running']], `${status}: ${kind}`);
            assert.deepEqual(calls[3], ['command', 'A', kind === 'jog' ? {degrees: 0.5, speedDps: 5, then: 'hold'} : {power: 5}]);
            assert.equal(await result.done, 'completed');
            calls.length = 0;
            assert.equal(setMixerMotorPower(api, 'a0', 0).ok, true);
            assert.deepEqual(calls, [['command', 'A', {stop: 'hold'}]], 'Stop does not restart the clock');
        } finally { api.dispose(); }
    }
});
