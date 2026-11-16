// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Christian Ströbele (CrispStrobe)
// Intake checks only. Native motion and browser qualification are separate gates.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {MODELS, catalogFrom, prepareModel} from '../overlay/scratch-gui/src/lib/bw-sim/sim-session.js';
import {parseModel} from '../overlay/scratch-gui/src/lib/bw-sim/model/ldraw-model.js';
import {MODEL_LESSONS} from '../overlay/scratch-gui/src/lib/bw-sim/model/example-catalog.js';
import {loadModelLesson} from '../overlay/scratch-gui/src/lib/bw-sim/model/lesson-loader.js';

const ROOT = new URL('../', import.meta.url);
const BASE = 'overlay/scratch-gui/static/sim-lab/';
const SOURCE = 'test/fixtures/model-files/resonance-lab-source/';
const read = path => readFileSync(new URL(path, ROOT));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(read(`${SOURCE}source.json`));
const CATALOG = catalogFrom(JSON.parse(read('overlay/scratch-gui/src/lib/bw-sim/part-meta/parts.json')));
const CHOICES = [
    ['resonance-lab.ldr', 'resonance-lab.bw', 13],
    ['resonance-lab-slow', 'resonance-lab-slow.bw', 5],
    ['resonance-lab-fast', 'resonance-lab-fast.bw', 80]
];
const SOURCE_HASHES = {
    'models/resonance-lab.ldr': '0adcbb261ecdbdc3ccc26ba92573b3e7a453ed565ab624c5e10457105fabae72',
    'models/resonance-lab.mpd': '8aff904d6aa9c8020e7047763601eb9f7d4b8c00dc54b5d478a5bf6c13fac45e',
    'programs/resonance-lab.bw': '7f368813047e06be5667408c701aa9434679e549a0ccc68a4b7a0068c2b1735d',
    'programs/resonance-lab-slow.bw': '13edb10e7a235061ed71c018a6aaaf9bb3145c5bf24efb6afe406cfafce786e3',
    'programs/resonance-lab-fast.bw': '580a9071b78a84649aa96755b44c8fb998f5daa20a957ada4becf989238069d5',
    'licenses/resonance-lab.txt': 'ed121de3496066a2ddc8c11b30b48142165ab84bdb066fee351392ecaccf36ad'
};
const choiceKey = entry => entry.id || entry.file;

test('Resonance intake preserves exact released models, finite programs, author grant and original construction sources', () => {
    assert.equal(manifest.sourceArchiveSha256, '34c3a00e565806dd4a4ff50b9f343cd64619bca9432960a05bcda27b455d09f3');
    assert.equal(manifest.sourceQualifiedRevision, 'df32b7ff33595406ce7356d249ec61baec1fecf6');
    assert.equal(manifest.license, 'BSD-3-Clause');
    assert.match(manifest.author, /Christian Ströbele \(CrispStrobe\)/);
    assert.deepEqual(manifest.shippedUnchanged, Object.keys(SOURCE_HASHES));
    for (const [path, expected] of Object.entries(SOURCE_HASHES)) {
        assert.equal(hash(read(BASE + path)), expected, `${path}: exact shipping bytes`);
        assert.equal(hash(read(SOURCE + path)), expected, `${path}: preserved source bytes`);
        assert.equal(manifest.sourceFiles[path], expected, `${path}: manifest identity`);
    }
    for (const [path, expected] of Object.entries(manifest.sourceFiles)) {
        assert.equal(hash(read(SOURCE + path)), expected, `original ${path}`);
    }
    assert.match(read(`${SOURCE}assembly/BUILD-STEPS.md`).toString(), /142 rigid placements and two real bands/);
    assert.match(read(`${SOURCE}SOURCES.txt`).toString(), /No external model, illustration, prose, program/);
});

test('three Resonance presets share one assembly; the original files and behaviour are unchanged', () => {
    const newFiles = new Set(['obliquity-orrery.ldr', 'cadence-geneva.ldr', 'helios-transmission.ldr', 'orion-cardan.ldr', 'apex.ldr', 'tempest-pendulum.ldr', 'evenhand.ldr', 'helixgate.ldr', 'looprelay.ldr', 'paritydial.ldr', 'counterslide.ldr', 'toggle-press.ldr', 'footfall.ldr', 'phasekeeper.ldr', 'vectorsum.ldr', 'pointweaver.ldr', 'afterturn.ldr', 'paired-door-sync.ldr', 'rimrun.ldr', 'kestrel-flapper.ldr', 'meridian-linkage.ldr', 'lumen-iris.ldr', 'tangent-table.ldr', 'tipline.ldr', 'twistspan.ldr', 'swayshift.ldr', 'toggle-lever.ldr', 'thirdline.ldr', 'samebeat.ldr', 'carry-ratio.ldr', 'air-budget.ldr', 'cross-ratio.ldr', 'foldback.ldr', 'ghost-pivot.ldr', 'travel-dial.ldr', 'pivot-exchange.ldr', 'phasor-twin.ldr', 'final-squeeze.ldr', 'high-select.ldr', 'poise.ldr', 'bend-ripple.ldr', 'offset-relay.ldr', 'rack-decoder.ldr', 'remote-pivot.ldr', 'schmidt-shift.ldr', 'equal-share.ldr', 'stroke-shift.ldr', 'triad-table.ldr', 'rod-ratio.ldr', 'vernier-drive.ldr', 'line-turner.ldr', 'dune-strider.ldr', 'atlas-six.ldr', 'oblique.ldr', 'cable-compass.ldr', 'cable-compass-control.ldr', 'rise-ratio.ldr', 'rise-ratio-control.ldr', 'cascade.ldr', 'cascade-control.ldr', 'wavemaker.ldr', 'wavemaker-control.ldr', 'sine-shuttle.ldr', 'quartermaster.ldr', 'watt-line.ldr', 'twin-tempo.ldr', 'root-bridge.ldr', 'balance-engine.ldr', 'cusp-lab.ldr', 'gimbal-lab.ldr', 'product-plotter.ldr', 'sky-courier.ldr', 'circle-splitter.ldr', 'integral.ldr']);
    const previous = MODELS.filter(entry => entry.file !== 'resonance-lab.ldr' && !newFiles.has(entry.file));
    assert.equal(previous.length, 80);
    assert.equal(new Set(previous.map(entry => entry.file)).size, 72);
    // The legacy titles now carry their mechanical explanation, and some gained an
    // intro. Those are deliberate; the files, ids, programs, mats and jog policies
    // that the Resonance patch found must stay byte-for-byte the same.
    const structure = previous.map(({file, id, example, mat, manualJog}) => ({file, id, example, mat, manualJog}));
    assert.equal(hash(JSON.stringify(structure)), 'abcdfa1b102676bfb722410acad20e0a4f786103dde3c541a78c0a44f3f16cbe');
    assert.equal(MODELS.length, 157);
    assert.equal(new Set(MODELS.map(entry => entry.file)).size, 147);
    for (const file of newFiles) assert.ok(MODELS.some(entry => entry.file === file), file);
    const added = MODELS.filter(entry => entry.file === 'resonance-lab.ldr');
    assert.deepEqual(added.map(choiceKey), CHOICES.map(([key]) => key));
    for (const [key, program, speed] of CHOICES) {
        const entry = added.find(model => choiceKey(model) === key);
        assert.equal(entry.example, program);
        assert.equal(entry.mat, 'plain');
        assert.ok(entry.title.en && entry.title.de && entry.title.en !== entry.title.de);
        const metadata = MODEL_LESSONS[key];
        assert.equal(metadata.pieces, 144);
        assert.equal(metadata.motors, 1);
        assert.deepEqual(metadata.hubs, ['spike-prime']);
        assert.equal(metadata.author, 'CrispStrobe');
        assert.equal(metadata.license, 'BSD-3-Clause');
        const source = read(`${BASE}programs/${program}`).toString();
        assert.match(source, new RegExp(`degrees at ${speed} degrees per second`));
        assert.match(source, /REPEAT 4:/);
        assert.match(source, /wait 10 seconds/);
        assert.match(source, /RELOAD the saved model before each experiment/);
    }
});

test('both Resonance import formats retain the passive output, two physical bands and mounted hub in ordinary and strict preparation', () => {
    const texts = ['ldr', 'mpd'].map(ext => read(`${BASE}models/resonance-lab.${ext}`).toString());
    const parsed = texts.map(text => parseModel(text, {catalog: CATALOG}));
    for (const result of parsed) assert.deepEqual(result.refusals, []);
    assert.deepEqual(parsed[0].model.parts, parsed[1].model.parts);
    assert.deepEqual(parsed[0].model.belts, parsed[1].model.belts);
    const retainedMounts = [
        ['input_anchor_axle_neg', 'input_anchor_axle_pos', 'input_anchor_bridge', 'input_axle', 'input_key'],
        ['input_anchor_axle_neg', 'input_anchor_axle_pos', 'input_beam'],
        ['output_anchor_axle_neg', 'output_anchor_axle_pos', 'output_anchor_bridge', 'output_axle', 'output_key'],
        ['output_anchor_axle_neg', 'output_anchor_axle_pos', 'output_beam']
    ];
    for (const text of texts) for (const options of [{}, {autoPorts: false}]) {
        const {model, mechanism, issues} = prepareModel(text, CATALOG, options);
        assert.equal(model.parts.length, 142);
        assert.equal(model.belts.length, 2);
        assert.ok(model.belts.every(band => band.band === '85546.dat'));
        assert.equal(mechanism.bodies.length, 4);
        const bodyOf = part => mechanism.bodies.find(body => body.parts.includes(part));
        const frame = bodyOf('frame_reference'), input = bodyOf('input_key'), output = bodyOf('output_key');
        assert.equal(new Set([frame.id, input.id, output.id]).size, 3);
        assert.equal(bodyOf('hub').id, frame.id, 'hub is mounted on the frame');
        assert.equal(mechanism.hubs.length, 1);
        assert.equal(mechanism.hubs[0].body, frame.id);
        assert.equal(mechanism.actuators.length, 1);
        assert.equal(mechanism.actuators[0].port, 'A');
        assert.equal(mechanism.actuators[0].hub, 'hub');
        assert.deepEqual(mechanism.joints.map(joint => joint.type), ['hinge', 'hinge']);
        assert.equal(mechanism.joints.filter(joint => joint.motor).length, 1);
        assert.equal(mechanism.couplings.length, 2);
        for (const spring of mechanism.couplings) {
            assert.equal(spring.kind, 'spring');
            assert.deepEqual([spring.body1, spring.body2], [input.id, output.id]);
        }
        // These four paired-pin anchor mounts intentionally weld their rigid islands.
        // No unrelated compiler warning is admitted by a blanket code exemption.
        assert.equal(issues.length, retainedMounts.length);
        assert.deepEqual(issues.map(issue => ({severity: issue.severity, code: issue.code, parts: issue.parts})),
            retainedMounts.map(parts => ({severity: 'warning', code: 'locked-hinges', parts})));
    }
});

test('all three presets load complete English and German lessons through the production loader', async () => {
    const keys = new Set(MODELS.map(choiceKey));
    const fetcher = async path => ({ok: true, json: async () => JSON.parse(read(`overlay/scratch-gui/${path}`))});
    for (const [key] of CHOICES) for (const lang of ['en', 'de']) {
        const entry = MODELS.find(model => choiceKey(model) === key);
        const lesson = await loadModelLesson(entry, lang, {fetcher});
        assert.equal(lesson.id, key.replace(/\.ldr$/, ''));
        assert.equal(lesson.language, lang);
        assert.ok(lesson.try.length >= 4 && lesson.further.length >= 5);
        assert.ok(lesson.related.every(related => keys.has(related) && related !== key));
        for (const [other] of CHOICES.filter(([other]) => other !== key)) assert.ok(lesson.related.includes(other));
        assert.doesNotMatch(lesson.try.join(' '), /To blocks/);
        assert.match(lesson.try[0], lang === 'en' ? /automatically/ : /automatisch/);
        assert.match(lesson.try[2], lang === 'en' ? /reloads the same saved assembly/ : /gespeicherte Anordnung/);
        assert.match(lesson.formula, lang === 'en' ? /Source-design undamped estimate/ : /Vorhersage des Quellentwurfs/);
    }
});
