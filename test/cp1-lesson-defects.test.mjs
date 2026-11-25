// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {detect, loadCatalog, cp1ExampleCapabilities} from '../scripts/detect-lesson-defects.mjs';

const firstLesson = loadCatalog().find(lesson => lesson.id === 'cp1-first-display');
const index = JSON.parse(readFileSync(
    new URL('../overlay/scratch-gui/examples/index.json', import.meta.url), 'utf8'));
const firstExample = index.find(example => example.id === firstLesson.exampleId);
const cp1Bench = {
    partial: false, stateCount: 1, controls: [], controlKinds: [], partKinds: ['kosmos-cp1'],
    timeVarying: false, alternates: false, capDischarges: false, ledSwitches: false
};

function lessonWith(action, options = {}) {
    const lesson = structuredClone(firstLesson);
    Object.assign(lesson, options);
    lesson.checkpoints = [{
        id: 'probe',
        copy: {en: {action, hint: '', explain: ''}}
    }];
    return lesson;
}

const scan = (lesson, capability = cp1Bench) => detect({
    lessons: [lesson], progress: false,
    capabilities: new Map([[lesson.exampleId, capability]])
});
const demands = report => report.findings.filter(finding => finding.check === 'B')
    .map(finding => finding.evidence.demand);

test('the actual CP1 first-display lesson has reachable named controls and a real teaching source', async () => {
    const report = await detect({lessons: [firstLesson], progress: false});
    assert.equal(report.lessons, 1);
    assert.equal(report.checkpoints, 2);
    assert.deepEqual(report.findings, []);
});

test('a loaded CP1 system recognizes its named digit and function key presses', async () => {
    for (const action of [
        'Press RUN on the CP1 keypad.',
        "Press the CP1 keypad's STEP key.",
        'Press the CP1 RUN button.',
        'Press 7 on the CP1 keypad.',
        'Press PC, press 0, then press RUN.'
    ]) {
        assert.deepEqual((await scan(lessonWith(action))).findings, [], action);
    }
});

test('a named CP1 action does not hide a later missing external button or switch', async () => {
    for (const [action, missing] of [
        ['Press RUN on the CP1 keypad, then press the external button.', 'press-a-button'],
        ['Press RUN. Press the external button.', 'press-a-button'],
        ['Press RUN on the CP1 keypad, then close the external switch.', 'operate-a-switch'],
        ['Press the RUN switch.', 'press-a-button'],
        ['Press the external RUN button.', 'press-a-button']
    ]) {
        const report = await scan(lessonWith(action));
        assert.ok(demands(report).includes(missing), action);
        assert.ok(report.findings.some(finding => finding.severity === 'blocking'), action);
    }
});

test('an unknown CP1 key remains a missing control', async () => {
    assert.deepEqual(demands(await scan(lessonWith('Press the CP1 RESET key.'))), ['press-a-button']);
});

test('CP1 source recognition requires the declared, nonempty and valid teaching file', () => {
    const options = {loadMode: 'circuit-only', partKinds: ['kosmos-cp1']};
    assert.deepEqual(cp1ExampleCapabilities(firstExample, options),
        {hasCp1Keypad: true, hasCp1Program: true});
    for (const source of [
        undefined,
        'cp1-first-display/missing.cp1',
        firstExample.files.program, // existing comments-only pseudocode placeholder
        firstExample.files.intro // existing prose is not CP1 source
    ]) {
        const entry = {...firstExample, files: {...firstExample.files, cp1: source}};
        assert.deepEqual(cp1ExampleCapabilities(entry, options),
            {hasCp1Keypad: true, hasCp1Program: false}, String(source));
    }
});

test('CP1 metadata cannot supply a keypad or program when its system circuit is absent or not loaded', async () => {
    const action = 'Press RUN on the CP1 keypad.';
    for (const [lesson, capability] of [
        [lessonWith(action), {...cp1Bench, partKinds: []}],
        [lessonWith(action, {loadMode: 'program-only'}), cp1Bench]
    ]) {
        assert.deepEqual(demands(await scan(lesson, capability)).sort(),
            ['press-a-button', 'run-the-program']);
    }
    const wrongCircuit = {...firstExample,
        files: {...firstExample.files, circuit: index.find(example => example.id === '42-diode-rectifier').files.circuit}};
    assert.deepEqual(cp1ExampleCapabilities(wrongCircuit,
        {loadMode: 'circuit-only', partKinds: ['kosmos-cp1']}),
    {hasCp1Keypad: false, hasCp1Program: false}, 'the actual circuit must contain the CP1 system part');
});

test('another circuit-only lesson still fails when it asks to run a missing program', async () => {
    const lesson = lessonWith('Run the program.', {exampleId: '42-diode-rectifier'});
    const report = await scan(lesson, {...cp1Bench, partKinds: ['diode', 'resistor', 'vcc', 'gnd']});
    assert.deepEqual(demands(report), ['run-the-program']);
    assert.equal(report.findings[0].severity, 'blocking');
});

test('CP1 teaching source does not invent a generic project-run completion event', async () => {
    const lesson = lessonWith('Read the CP1 cells.');
    lesson.checkpoints[0].observe = {event: 'project-run'};
    const report = await scan(lesson);
    assert.equal(report.findings.length, 1);
    assert.equal(report.findings[0].check, 'A');
    assert.equal(report.findings[0].severity, 'blocking');
    assert.match(report.findings[0].message, /project-run/);
});

test('qualified CP1 events require a loaded real system and a valid teaching source', async () => {
    for (const event of ['cp1-command', 'cp1-halt', 'cp1-error']) {
        const lesson = lessonWith('Read the CP1 cells.');
        lesson.checkpoints[0].observe = {event};
        assert.deepEqual((await scan(lesson)).findings, [], event);
        for (const [candidate, capability] of [
            [lesson, {...cp1Bench, partKinds: []}],
            [{...lesson, loadMode: 'program-only'}, cp1Bench],
            [{...lesson, exampleId: '42-diode-rectifier'}, cp1Bench]
        ]) {
            const findings = (await scan(candidate, capability)).findings;
            assert.ok(findings.some(finding => finding.check === 'A' && finding.severity === 'blocking' &&
                finding.message.includes(`observes ${event}`)), `${event}: missing system/source`);
        }
    }
});
