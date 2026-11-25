import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const wave = JSON.parse(readFileSync(new URL('../overlay/scratch-gui/src/components/gui/lesson-waves/cp1-8.json', import.meta.url), 'utf8'));
const examples = new Set(['cp1-first-display', 'cp1-switch-input', 'cp1-blink', 'cp1-cp5-binary']);

test('CP1 learning wave has ten connected bilingual lessons using four original examples', () => {
    assert.equal(wave.wave, 'cp1-8');
    assert.ok(wave.title.en && wave.title.de);
    assert.equal(wave.lessons.length, 10);
    const ids = new Set(wave.lessons.map(lesson => lesson.id));
    assert.equal(ids.size, wave.lessons.length);
    const topics = new Set(wave.lessons.map(lesson => lesson.topic));
    assert.equal(topics.size, 10);
    for (const lesson of wave.lessons) {
        assert.ok(examples.has(lesson.exampleId), lesson.id);
        assert.equal(lesson.loadMode, 'circuit-only');
        assert.equal(lesson.wave, wave.wave);
        assert.equal(lesson.version, 1);
        assert.ok(lesson.checkpoints.length >= 2);
        assert.deepEqual(lesson.languages, [], 'the CP1 panel does not promise generic language conversion');
        for (const prerequisite of lesson.prerequisites) {
            assert.ok(ids.has(prerequisite), `${lesson.id}: ${prerequisite}`);
            assert.notEqual(prerequisite, lesson.id);
        }
        for (const locale of ['en', 'de']) {
            assert.ok(lesson.copy[locale].title && lesson.copy[locale].objective);
            for (const checkpoint of lesson.checkpoints) {
                for (const field of ['action', 'explain', 'hint', 'manual']) {
                    assert.ok(checkpoint.copy[locale][field], `${lesson.id}/${checkpoint.id}/${locale}/${field}`);
                }
            }
        }
    }
});

test('CP1 checks use explicit observations with one exact completed-command contract', () => {
    const observed = [];
    for (const lesson of wave.lessons) for (const checkpoint of lesson.checkpoints) {
        if (checkpoint.observe) observed.push({lesson: lesson.id, checkpoint: checkpoint.id, observe: checkpoint.observe});
    }
    assert.deepEqual(observed, [{lesson: 'cp1-command-debugging', checkpoint: 'complete-ako', observe: {
        event: 'cp1-command', match: {profileQualified: true, address: 0, opcode: 4, operand: 42,
            outcome: 'completed', accumulatorOpcode: 0, accumulatorOperand: 42}
    }}]);
    const text = JSON.stringify(wave);
    assert.match(text, /2048/);
    assert.match(text, /no ROM is bundled/);
    assert.match(text, /one 8049|many 8049|8049 instruction/i);
    assert.match(text, /requested waits|requested delay/i);
    assert.match(text, /requested wait time.*measured period separately from the matching edges/i);
    assert.match(text, /held keys|Gehaltene Tasten/);
    assert.match(text, /actual six segment masks|tatsächlichen Segmentmasken/);
});

test('CP1 lesson prerequisites form a directed acyclic progression', () => {
    const byId = new Map(wave.lessons.map(lesson => [lesson.id, lesson]));
    const completed = new Set();
    function visit (id, path = new Set()) {
        assert.ok(!path.has(id), `cyclic prerequisite ${[...path, id].join(' -> ')}`);
        if (completed.has(id)) return;
        const next = new Set([...path, id]);
        for (const prerequisite of byId.get(id).prerequisites) visit(prerequisite, next);
        completed.add(id);
    }
    for (const id of byId.keys()) visit(id);
    assert.equal(completed.size, 10);
});
