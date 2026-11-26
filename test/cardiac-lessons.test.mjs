// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assembleCardiac, parseCardiacDeck} from '../overlay/scratch-gui/src/lib/cardiac-program.js';
import {CARDIAC_EXAMPLES} from '../overlay/scratch-gui/src/lib/cardiac-examples.js';
import {createCardiacMachine, controlCardiacMachine, runCardiacMachine} from 'bw-board/cardiac-machine.js';

const read = relative => readFileSync(new URL(relative, import.meta.url), 'utf8');
const wave = JSON.parse(read('../overlay/scratch-gui/src/components/gui/lesson-waves/cardiac-9.json'));
const index = JSON.parse(read('../overlay/scratch-gui/examples/index.json'));
const ids = Object.keys(CARDIAC_EXAMPLES);
const imageOf = assembly => ({entry: assembly.entry,
    words: assembly.words.map(({address, value}) => ({address, value}))});

test('six bilingual CARDIAC lessons provide connected manual checkpoints without claiming automatic completion', () => {
    assert.equal(ids.length, 6);
    assert.equal(wave.lessons.length, ids.length);
    const lessons = new Map(wave.lessons.map(lesson => [lesson.id, lesson]));
    assert.equal(lessons.size, wave.lessons.length);
    assert.deepEqual(wave.lessons.map(lesson => lesson.exampleId).sort(), [...ids].sort());
    let checkpoints = 0;
    for (const lesson of wave.lessons) {
        assert.equal(lesson.wave, wave.wave);
        assert.ok(Number.isInteger(lesson.version) && lesson.version > 0);
        assert.equal(lesson.environment, 'simulation');
        assert.ok(lesson.domains.includes('computer-architecture'));
        assert.deepEqual(lesson.languages, [], 'CARDIAC is not advertised as a generic language conversion');
        assert.equal(lesson.checkpoints.length, 3);
        assert.equal(new Set(lesson.checkpoints.map(checkpoint => checkpoint.id)).size, lesson.checkpoints.length);
        for (const prerequisite of lesson.prerequisites) {
            assert.ok(lessons.has(prerequisite), `${lesson.id}: existing prerequisite ${prerequisite}`);
            assert.notEqual(prerequisite, lesson.id);
        }
        for (const language of ['en', 'de']) {
            assert.ok(lesson.copy[language].title.trim());
            assert.ok(lesson.copy[language].objective.trim());
        }
        assert.notEqual(lesson.copy.en.title, lesson.copy.de.title);
        for (const checkpoint of lesson.checkpoints) {
            checkpoints++;
            assert.equal(checkpoint.observe, undefined, 'opening a CARDIAC source is not machine evidence');
            for (const language of ['en', 'de']) for (const field of ['action', 'explain', 'hint', 'manual']) {
                assert.ok(typeof checkpoint.copy[language][field] === 'string' && checkpoint.copy[language][field].trim(),
                    `${lesson.id}/${checkpoint.id}: ${language}.${field}`);
            }
            assert.notEqual(checkpoint.copy.en.action, checkpoint.copy.de.action);
        }
    }
    assert.equal(checkpoints, 18);
    const visit = (id, path = []) => {
        assert.ok(!path.includes(id), `prerequisite cycle: ${[...path, id].join(' -> ')}`);
        for (const prerequisite of lessons.get(id).prerequisites) visit(prerequisite, [...path, id]);
    };
    for (const id of lessons.keys()) visit(id);
});

test('CARDIAC gallery files match canonical source/decks and only the night-light requires a circuit', () => {
    const gallery = new Map(index.map(entry => [entry.id, entry]));
    for (const lesson of wave.lessons) {
        const example = CARDIAC_EXAMPLES[lesson.exampleId], entry = gallery.get(lesson.exampleId);
        assert.ok(entry, `${lesson.exampleId}: gallery registration`);
        assert.equal(entry.target, 'cardiac');
        assert.equal(entry.kind, 'program');
        assert.equal(entry.files.program, undefined, 'CARDIAC is not routed through program.bw');
        assert.deepEqual(entry.devices, [], 'no MCU retarget list');
        const source = read(`../overlay/scratch-gui/examples/${entry.files.cardiac}`);
        assert.equal(source, example.source);
        const deck = parseCardiacDeck(read(`../overlay/scratch-gui/examples/${entry.files.deck}`));
        assert.equal(deck.ok, true);
        assert.deepEqual(deck.values, [...example.input]);
        for (const field of ['intro', 'introDE', 'expected']) {
            assert.ok(read(`../overlay/scratch-gui/examples/${entry.files[field]}`).trim(), `${entry.id}: ${field}`);
        }
        assert.equal(lesson.loadMode, entry.files.circuit ? 'program-and-circuit' : 'program-only');
        assert.equal(Boolean(entry.files.circuit), entry.id === 'cardiac-night-light');
    }
    const night = gallery.get('cardiac-night-light');
    const circuit = JSON.parse(read(`../overlay/scratch-gui/examples/${night.files.circuit}`));
    const part = circuit.parts.find(item => item.kind === 'cardiac');
    assert.ok(part);
    assert.deepEqual(part.params.program, imageOf(assembleCardiac(CARDIAC_EXAMPLES[night.id].source)));
    assert.deepEqual(part.terminals, ['IN', 'OUT', '5v', 'gnd']);
    assert.ok(circuit.parts.some(item => item.kind === 'potentiometer'));
    assert.ok(circuit.parts.some(item => item.kind === 'resistor' && item.params.ohms === 1000));
    assert.ok(circuit.parts.some(item => item.kind === 'led'));
    assert.equal(circuit.wires.length, 6);
});

test('all six lesson programs execute their expected outputs on the adopted engine', () => {
    for (const example of Object.values(CARDIAC_EXAMPLES)) {
        const assembly = assembleCardiac(example.source);
        assert.equal(assembly.ok, true, example.id);
        const image = imageOf(assembly), before = JSON.stringify(image);
        const machine = createCardiacMachine(image);
        controlCardiacMachine(machine, 'enqueueInput', [...example.input]);
        const run = runCardiacMachine(machine, {maxSteps: 1000});
        assert.equal(run.reason, example.terminal === 'halted' ? 'halted' : 'input', example.id);
        assert.deepEqual(machine.output, [...example.expectedOutput], example.id);
        assert.equal(JSON.stringify(image), before, 'execution does not rewrite the authored image');
        if (example.id === 'cardiac-bootstrap') {
            assert.deepEqual(machine.memory.slice(20, 26), [80, 180, 281, 680, 580, 900]);
            assert.equal(machine.memory[81], 7);
        }
        if (example.id === 'cardiac-self-modify') {
            assert.equal(machine.memory[10], 583);
            assert.equal(image.words.find(cell => cell.address === 10).value, 580);
        }
    }
});

test('night-light boundary and negative countdown agree with their lesson explanations', () => {
    const cases = [
        ['cardiac-night-light', [499, 500, 501], [1, 0, 0], 'input'],
        ['cardiac-countdown', [0], [0], 'halted'],
        ['cardiac-countdown', [-1], [], 'halted'],
        ['cardiac-add', [-5, 12], [7], 'halted']
    ];
    for (const [id, input, output, reason] of cases) {
        const machine = createCardiacMachine(imageOf(assembleCardiac(CARDIAC_EXAMPLES[id].source)));
        controlCardiacMachine(machine, 'enqueueInput', input);
        assert.equal(runCardiacMachine(machine, {maxSteps: 1000}).reason, reason);
        assert.deepEqual(machine.output, output);
    }
});
