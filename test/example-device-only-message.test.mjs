/**
 * A device-only example is not a broken one, and the surface must say so.
 *
 * `mb05-lesson` ships no circuit file because a micro:bit IS the board. The
 * Circuit tab used to answer that with "lists no circuit file, so there is
 * nothing to place on the board" — a fault report about a state that is correct
 * by design, reached by a lesson that sends learners straight to it.
 *
 * What made it possible is worth stating, because it is not the shape it looks
 * like: the gate and the surface did not hold two DIFFERENT definitions of
 * "device-only". `test/declared-pins-wired.test.mjs` had one and the surface had
 * NONE — it tested file presence alone. So the fix is not a flag on the entry
 * (mb05-lesson qualifies through `authored`, and setting `deviceOnly: true`
 * would change nothing); it is one predicate, imported by both.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';

import {isDeviceOnlyExample, noCircuitMessage} from
    '../overlay/scratch-gui/src/lib/example-device-only.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const EXAMPLES = path.join(ROOT, 'overlay/scratch-gui/examples');
const index = JSON.parse(readFileSync(path.join(EXAMPLES, 'index.json'), 'utf8'));
const entries = Array.isArray(index) ? index : index.examples || [];

test('every example with no circuit file is device-only, and gets an explanation not a fault', () => {
    const noCircuit = entries.filter(e => !(e.files && e.files.circuit));
    assert.ok(noCircuit.length > 0, 'no example ships without a circuit — this gate would assert nothing');
    const complained = noCircuit.filter(e => !noCircuitMessage(e).deviceOnly);
    assert.deepEqual(complained.map(e => e.id), [],
        'example(s) with no circuit that the surface would call a fault:\n  ' +
        complained.map(e => e.id).join('\n  '));
    // and the explanation names the device rather than the missing file
    for (const e of noCircuit) {
        const {message} = noCircuitMessage(e);
        assert.doesNotMatch(message, /lists no circuit file/, `${e.id}: still reads as a fault report`);
        assert.match(message, /micro:bit|SPIKE hub|CARDIAC machine/, `${e.id}: the explanation does not name the device`);
    }
});

test('mb05-lesson is the case the owner hit, and it qualifies WITHOUT a deviceOnly flag', () => {
    const entry = entries.find(e => e.id === 'mb05-lesson');
    assert.ok(entry, 'mb05-lesson is gone from the index');
    assert.equal(entry.files.circuit, undefined, 'mb05-lesson ships a circuit now — this gate needs re-aiming');
    assert.equal('deviceOnly' in entry, false,
        'mb05-lesson now declares deviceOnly; the predicate still holds, but the note in ' +
        'example-device-only.js about it qualifying through `authored` is stale');
    assert.equal(entry.authored, 'microbit');
    assert.equal(isDeviceOnlyExample(entry), true);
    assert.match(noCircuitMessage(entry).message, /the device is the whole board/);
});

test('CARDIAC strip programs are self-contained, while the wired adapter example still needs its circuit', () => {
    const standalone = entries.filter(e => e.target === 'cardiac' && !e.files?.circuit);
    assert.ok(standalone.length >= 5, 'the five CARDIAC strip examples are missing');
    for (const example of standalone) {
        assert.ok(example.files.cardiac, example.id + ' has no CARDIAC program');
        assert.equal(isDeviceOnlyExample(example), true, example.id);
        assert.match(noCircuitMessage(example).message, /CARDIAC machine.*input and output strips/);
    }
    const wired = entries.find(e => e.id === 'cardiac-night-light');
    assert.ok(wired?.files.circuit, 'the CARDIAC adapter example no longer supplies a circuit');
    assert.equal(isDeviceOnlyExample(wired), false);
    const example = standalone[0];
    for (const broken of [
        {...example, target: 'unknown-machine'},
        {...example, files: {}},
        {...example, files: {cardiac: ''}},
        {...example, files: {cardiac: true}},
        {...example, files: {...example.files, circuit: 'missing/circuit.json'}}
    ]) {
        assert.equal(isDeviceOnlyExample(broken), false);
        assert.equal(noCircuitMessage(broken).deviceOnly, false);
    }
});

test('an example that really is missing its circuit still gets the fault (mutation)', () => {
    const broken = {id: 'not-a-device', files: {program: 'x/program.bw'}};
    assert.equal(isDeviceOnlyExample(broken), false);
    const {deviceOnly, message} = noCircuitMessage(broken);
    assert.equal(deviceOnly, false);
    assert.match(message, /lists no circuit file/,
        'a genuinely missing circuit must still be reported as one');
    // and each way of qualifying works on its own
    assert.equal(isDeviceOnlyExample({deviceOnly: true}), true);
    assert.equal(isDeviceOnlyExample({authored: 'spike'}), true);
    assert.equal(isDeviceOnlyExample({authored: 'arduino-uno'}), false);
    assert.equal(isDeviceOnlyExample(null), false);
    assert.match(noCircuitMessage({id: 'x', authored: 'spike'}).message, /SPIKE hub/);
});

test('the surface and the gate share one predicate, not two copies of it', () => {
    const surface = readFileSync(
        path.join(ROOT, 'overlay/scratch-gui/src/components/tw-pseudocode/circuit-tab.jsx'), 'utf8');
    const gate = readFileSync(path.join(ROOT, 'test/declared-pins-wired.test.mjs'), 'utf8');
    assert.match(surface, /noCircuitMessage\(ex\)/, 'the Circuit tab no longer asks the shared predicate');
    assert.match(gate, /isDeviceOnlyExample\(e\)/, 'the wiring gate no longer asks the shared predicate');
    for (const [name, source] of [['circuit-tab.jsx', surface], ['declared-pins-wired.test.mjs', gate]]) {
        assert.doesNotMatch(source, /authored === 'microbit'/,
            `${name} restates the predicate instead of importing it — two copies drift`);
    }
});
