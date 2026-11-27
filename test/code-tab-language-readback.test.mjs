// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {importSource} from './helpers/bw-integrated.mjs';

const {default: SB3Creator} = await importSource('src/lib/sb3-creator-register-art.js');
const {readPython, readJavaScript} = await importSource('src/lib/robot-lab-pseudocode.js');
const {default: readForth} = await importSource('src/lib/bw-lang/forth.js');

const readOpcodes = source => new SB3Creator().parse(source).targets.flatMap(target =>
    Object.values(target.blocks).map(block => block.opcode));

for (const [language, read, source] of [
    ['Python', readPython, 'print ("hello")'],
    ['JavaScript', readJavaScript, 'console.log("hello");'],
    ['Forth', readForth, '." hello" cr']
]) {
    test(`${language} top-level output becomes a runnable flag script`, () => {
        const result = read(source);
        assert.deepEqual(result.warnings, []);
        assert.deepEqual(readOpcodes(result.pseudocode), ['event_whenflagclicked', 'looks_say']);
        assert.match(result.pseudocode, /say "hello"/);
    });
}

test('startup preserves assignment and output order and avoids sprite-motion ambiguity', () => {
    const {pseudocode} = readPython('x_var = 10\nx = 1\nprint(x)\nx = 2\nprint(x_var)');
    assert.match(pseudocode, /set x_var to 10\s+set x_var_ to 1\s+say x_var_\s+set x_var_ to 2\s+say x_var\b/);
    assert.deepEqual(readOpcodes(pseudocode), ['event_whenflagclicked',
        'data_setvariableto', 'data_setvariableto', 'looks_say', 'data_setvariableto', 'looks_say']);
});

test('unsupported Python output does not create an empty placeholder script', () => {
    const result = readPython('sys.getsizeof(4)');
    assert.equal(result.pseudocode.trim(), '');
    assert.ok(result.warnings.length);
});

test('generated flag handlers are still read once', () => {
    const creator = new SB3Creator();
    const project = creator.parse('WHEN flag clicked:\n  say "hello"\n');
    for (const [read, source] of [
        [readPython, creator.generatePython(project)], [readJavaScript, creator.generateJavaScript(project)]
    ]) {
        assert.deepEqual(readOpcodes(read(source).pseudocode), ['event_whenflagclicked', 'looks_say']);
    }
});

test('Forth retains the order of loose words and main invocations', () => {
    const {pseudocode, warnings} = readForth(': main ." main" cr ; ." before" cr main ." after" cr');
    assert.deepEqual(warnings, []);
    assert.match(pseudocode, /say "before"\s+say "main"\s+say "after"/);
    assert.deepEqual(readOpcodes(pseudocode), ['event_whenflagclicked', 'looks_say', 'looks_say', 'looks_say']);
});
