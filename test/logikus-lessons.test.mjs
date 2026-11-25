import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

import {evaluateProgram, truthTable} from '../overlay/scratch-gui/src/lib/logikus/model.js';
import {getPreset, LOGIKUS_PRESETS} from '../overlay/scratch-gui/src/lib/logikus/presets.js';
import {lessonMatchesQuery} from '../overlay/scratch-gui/src/components/gui/lesson-search.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const wave = JSON.parse(read('../overlay/scratch-gui/src/components/gui/lesson-waves/logikus-9.json'));
const byId = new Map(wave.lessons.map(lesson => [lesson.id, lesson]));

test('Logikus lessons open real presets and contain complete bilingual learning sequences', () => {
    assert.equal(wave.wave, 'logikus-9');
    assert.ok(wave.title.en && wave.title.de);
    assert.equal(wave.lessons.length, 7);
    assert.equal(byId.size, wave.lessons.length);
    const availablePresets = new Set(LOGIKUS_PRESETS.map(preset => preset.id));
    const topics = new Set();
    for (const lesson of wave.lessons) {
        assert.equal(lesson.wave, wave.wave);
        assert.equal(lesson.version, 1);
        assert.equal(lesson.loadMode, 'logikus');
        assert.ok(availablePresets.has(lesson.presetId), `${lesson.id} opens an actual contact program`);
        assert.equal(lesson.exampleId, undefined, 'the bench does not depend on a vendored example');
        assert.deepEqual(lesson.languages, [], 'contact programs do not promise generic code conversion');
        assert.ok(lesson.domains.includes('circuits'));
        assert.ok(lesson.depth && lesson.environment && lesson.ageGuidance && lesson.minutes > 0);
        assert.ok(lesson.checkpoints.length >= 3, `${lesson.id} goes beyond opening the bench`);
        assert.equal(new Set(lesson.checkpoints.map(checkpoint => checkpoint.id)).size,
            lesson.checkpoints.length);
        topics.add(lesson.topic);
        for (const locale of ['en', 'de']) {
            assert.ok(lesson.copy[locale].title && lesson.copy[locale].objective);
            assert.ok(lessonMatchesQuery(lesson, lesson.copy[locale], 'Logikus'),
                `${lesson.id} is discoverable in ${locale}`);
            for (const checkpoint of lesson.checkpoints) {
                for (const field of ['action', 'explain', 'hint', 'manual']) {
                    assert.ok(checkpoint.copy[locale][field]?.trim(),
                        `${lesson.id}/${checkpoint.id}/${locale}/${field}`);
                }
            }
        }
    }
    assert.equal(topics.size, wave.lessons.length);
    const guided = read('../overlay/scratch-gui/src/components/gui/guided-lessons.jsx');
    assert.match(guided, /import logikusWave from '\.\/lesson-waves\/logikus-9\.json'/);
    assert.match(guided, /\.\.\.logikusWave\.lessons/);
});

test('Logikus progression is acyclic and does not mark reasoning complete on opening or table generation', () => {
    const complete = new Set();
    const visit = (id, path = new Set()) => {
        assert.ok(byId.has(id), `missing prerequisite ${id}`);
        assert.ok(!path.has(id), `cyclic prerequisite ${id}`);
        if (complete.has(id)) return;
        const next = new Set([...path, id]);
        for (const prerequisite of byId.get(id).prerequisites) visit(prerequisite, next);
        complete.add(id);
    };
    for (const lesson of wave.lessons) {
        visit(lesson.id);
        for (const checkpoint of lesson.checkpoints) {
            assert.equal(checkpoint.observe, undefined,
                `${lesson.id}/${checkpoint.id}: the learner must confirm the prediction or comparison`);
        }
    }
    assert.equal(complete.size, wave.lessons.length);
});

// Run the production routing function, not a copy of its condition. A Logikus
// lesson previously would have tried to load a nonexistent gallery example;
// the branch must preserve the current editor and still carry a result token.
const lessonHandler = () => {
    const gui = read('../overlay/scratch-gui/src/components/gui/gui.jsx');
    const start = gui.indexOf('const openLessonProject = event => {');
    assert.ok(start >= 0);
    const end = gui.indexOf('\n        };', start);
    assert.ok(end > start);
    const source = gui.slice(start, end + '\n        };'.length);
    const events = [];
    const tabs = [];
    const handler = runInNewContext(`${source}\nopenLessonProject`, {
        window: {dispatchEvent: event => events.push({type: event.type,
            detail: JSON.parse(JSON.stringify(event.detail))})},
        CustomEvent: class { constructor (type, options) { this.type = type; this.detail = options.detail; } },
        props: {onActivateTab: index => tabs.push(index)}
    });
    return {handler, events, tabs};
};

test('each Logikus lesson opens the intended preset without activating an editor or loading gallery content', () => {
    for (const lesson of wave.lessons) {
        const {handler, events, tabs} = lessonHandler();
        handler({detail: lesson});
        assert.deepEqual(tabs, []);
        assert.deepEqual(events, [{type: 'bw-logikus-open', detail: {
            presetId: lesson.presetId, journeyId: `lesson:${lesson.id}`
        }}]);
    }
});

test('ordinary lesson routes still select their existing editor and example', () => {
    for (const [loadMode, tab] of [['program-only', 3], ['circuit-only', 4], ['program-and-circuit', 4]]) {
        const {handler, events, tabs} = lessonHandler();
        handler({detail: {id: 'existing-lesson', exampleId: 'existing-example', loadMode}});
        assert.deepEqual(tabs, [tab]);
        assert.deepEqual(events, [{type: 'bw-start-journey', detail: {
            id: 'lesson:existing-lesson', exampleId: 'existing-example', mode: loadMode
        }}]);
    }
});

test('the half-adder lesson reads actual lamps as carry then sum', () => {
    const program = getPreset(byId.get('logikus-half-adder').presetId).program;
    const rows = truthTable(program);
    assert.equal(rows.length, 4);
    for (const {switches, lamps} of rows) {
        assert.equal(2 * Number(lamps[1]) + Number(lamps[0]),
            Number(switches[0]) + Number(switches[1]));
    }
    for (const locale of ['en', 'de']) {
        const copy = byId.get('logikus-half-adder').checkpoints.find(checkpoint => checkpoint.id === 'predict').copy[locale];
        assert.match(copy.action, /L1 L0/);
        assert.match(copy.explain, /00, 01, 01, 10/);
    }
});

test('the river lesson hint is a legal seven-crossing solution on the shipped detector', () => {
    const lesson = byId.get('logikus-river');
    const program = getPreset(lesson.presetId).program;
    const hints = lesson.checkpoints.find(checkpoint => checkpoint.id === 'cross').copy;
    const route = hints.en.hint.match(/\b[01]{4}\b/g);
    assert.deepEqual(hints.de.hint.match(/\b[01]{4}\b/g), route,
        'both languages teach the same route');
    assert.equal(route.length, 8, 'initial state plus seven crossings');
    assert.equal(route[0], '0000');
    assert.equal(route.at(-1), '1111');
    for (let i = 0; i < route.length; i++) {
        const bits = Array.from(route[i], bit => bit === '1');
        const lamps = evaluateProgram(program, {switches: [...bits, ...Array(6).fill(false)]}).lamps;
        assert.deepEqual(lamps.slice(0, 2), [false, false], `completed crossing ${route[i]} is safe`);
        if (i === 0) continue;
        const previous = route[i - 1];
        assert.notEqual(previous[0], route[i][0], 'the farmer always crosses');
        const passengers = [1, 2, 3].filter(index => previous[index] !== route[i][index]);
        assert.ok(passengers.length <= 1, 'at most one passenger');
        for (const passenger of passengers) assert.equal(previous[passenger], previous[0],
            'the passenger starts on the farmer\'s bank');
    }
    for (const row of truthTable(program)) {
        assert.equal(row.lamps[0] && row.lamps[1], false,
            'the lesson\'s two alarms are mutually exclusive across all 16 states');
    }
});

test('the taught code and all ten single-bit fault trials operate the real momentary-gated preset', () => {
    const lesson = byId.get('logikus-code-lock');
    const copy = lesson.checkpoints.find(checkpoint => checkpoint.id === 'count').copy;
    const code = copy.en.explain.match(/\b[01]{10}\b/)?.[0];
    assert.ok(code);
    assert.equal(copy.de.explain.match(/\b[01]{10}\b/)?.[0], code);
    for (const locale of ['en', 'de']) assert.match(copy[locale].explain, /1024/);
    assert.equal(2 ** code.length, 1024);
    const program = getPreset(lesson.presetId).program;
    const switches = Array.from(code, bit => bit === '1');
    const lamp = (values, button) => evaluateProgram(program, {switches: values, button}).lamps[0];
    assert.equal(lamp(switches, false), false);
    assert.equal(lamp(switches, true), true);
    assert.equal(lamp(switches, false), false);
    for (let index = 0; index < switches.length; index++) {
        const faulty = switches.slice();
        faulty[index] = !faulty[index];
        assert.equal(lamp(faulty, true), false, `S${index} must matter`);
        assert.equal(lamp(switches, true), true, 'restoring the bit restores the correct code');
    }
});

test('the railway lesson lists exactly the four combinations that grant a route', () => {
    const lesson = byId.get('logikus-railway');
    const prediction = lesson.checkpoints.find(checkpoint => checkpoint.id === 'predict').copy;
    const program = getPreset(lesson.presetId).program;
    const rows = truthTable(program);
    const granted = rows.filter(row => row.lamps[0] || row.lamps[1]);
    const bits = row => row.switches.slice(0, 5).map(Number).join('');
    assert.equal(rows.length, 32);
    assert.equal(granted.length, 4);
    assert.equal(rows.filter(row => !row.lamps[0] && !row.lamps[1]).length, 28);
    for (const locale of ['en', 'de']) {
        const taught = prediction[locale].explain.match(/\b[01]{5}\b/g);
        assert.deepEqual(taught?.slice(0, 2), ['10000', '10001']);
        assert.deepEqual(taught?.slice(2), ['01000', '01010']);
        assert.deepEqual(taught.slice().sort(), granted.map(bits).sort());
        assert.match(prediction[locale].explain, /32/);
        assert.match(prediction[locale].explain, /28/);
    }
    for (const row of granted) {
        assert.equal(row.lamps[0], row.switches[0]);
        assert.equal(row.lamps[1], row.switches[1]);
    }
    const both = evaluateProgram(program, {switches: [1, 1, 0, 0, 0, 0, 0, 0, 0, 0]});
    assert.deepEqual(both.lamps.slice(0, 2), [false, false]);
});

test('the railway lesson bypass is a real unsafe permission at the taught input', () => {
    const lesson = byId.get('logikus-railway');
    const challenge = lesson.checkpoints.find(checkpoint => checkpoint.id === 'unsafe').copy;
    const program = getPreset(lesson.presetId).program;
    for (const locale of ['en', 'de']) {
        assert.match(challenge[locale].action, /S2\.Ba/);
        assert.match(challenge[locale].action, /S2\.Bb/);
        assert.match(challenge[locale].action, /10100/);
    }
    const inputs = {switches: [1, 0, 1, 0, 0, 0, 0, 0, 0, 0]};
    assert.equal(evaluateProgram(program, inputs).lamps[0], false,
        'the original circuit blocks the occupied crossing');
    program.wires.push({id: 'lesson-crossing-bypass', from: 'S2.Ba', to: 'S2.Bb'});
    const result = evaluateProgram(program, inputs);
    assert.equal(result.lamps[0], true, 'the taught bypass grants A into an occupied crossing');
    assert.equal(result.lamps[1], false);
    assert.ok(result.paths[0].includes('lesson-crossing-bypass'),
        'the path inspector can identify the fault the lesson asks the learner to trace');
});

test('disconnecting the two taught lamp leads avoids every unsafe permission but blocks four valid requests', () => {
    const lesson = byId.get('logikus-railway');
    const program = getPreset(lesson.presetId).program;
    const target = truthTable(program);
    const originalCount = program.wires.length;
    program.wires = program.wires.filter(wire => !['L0', 'L1'].includes(wire.to));
    assert.equal(originalCount - program.wires.length, 2);
    const rows = truthTable(program, {switchIndices: [0, 1, 2, 3, 4]});
    assert.equal(rows.length, 32);
    assert.ok(rows.every(row => !row.lamps[0] && !row.lamps[1]));
    assert.equal(rows.filter((row, index) =>
        row.lamps[0] !== target[index].lamps[0] || row.lamps[1] !== target[index].lamps[1]).length, 4);
    const useful = lesson.checkpoints.find(checkpoint => checkpoint.id === 'useful').copy;
    for (const locale of ['en', 'de']) {
        assert.match(useful[locale].action, /L0/);
        assert.match(useful[locale].action, /L1/);
        assert.match(useful[locale].hint, /10000/);
    }
});
