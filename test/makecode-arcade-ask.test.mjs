import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {SB3Creator, runProgram} from './helpers/bw-vm.mjs';

test('a pinned Arcade prompt waits for the answer before using it', async () => {
    const source = readFileSync(join(import.meta.dirname, 'fixtures/makecode/arcade-ask-name.ts'), 'utf8');
    const translated = arcadeToPseudocode(source);
    assert.deepEqual(translated.unsupported, []);
    assert.match(translated.code, /set name to \(arcade ask text "What is your name\?"\)/);
    const creator = new SB3Creator();
    creator.parse(translated.code);
    assert.deepEqual(creator.warnings, []);
    const run = await runProgram(translated.code, {frames: 3});
    assert.deepEqual(run.errors, []);
    const getName = () => run.vm.runtime.targets.flatMap(target => Object.values(target.variables || {}))
        .find(variable => variable.name === 'name')?.value;
    assert.notEqual(getName(), 'Ada');
    run.vm.runtime.emit('ANSWER', 'Ada');
    await new Promise(setImmediate);
    for (let i = 0; i < 8; i++) run.vm.runtime._step(1000 / 30);
    assert.equal(getName(), 'Ada');
});

test('parseInt around a nested prompt converts the answer with PXT parseInt', () => {
    const translated = arcadeToPseudocode('let valid = parseInt(game.askForString("Number?"))');
    assert.deepEqual(translated.unsupported, []);
    assert.match(translated.code, /arcade parse integer \(arcade ask text "Number\?"\)/);
});

test('Arcade text prompt options stay visible until their semantics are implemented', () => {
    const translated = arcadeToPseudocode('let name = game.askForString("Name?", 8)');
    assert.ok(translated.unsupported.some(gap => gap.includes('length limit')));
});

test('Arcade number prompt waits and stores a numeric answer', async () => {
    const translated = arcadeToPseudocode('let n = game.askForNumber("Number?")');
    assert.deepEqual(translated.unsupported, []);
    assert.match(translated.code, /set n to \(arcade ask number "Number\?"\)/);
    const creator = new SB3Creator();
    creator.parse(translated.code);
    assert.deepEqual(creator.warnings, []);
    assert.match(creator.decompile(), /arcade ask number "Number\?"/);
    const run = await runProgram(translated.code, {frames: 3});
    assert.deepEqual(run.errors, []);
    const value = () => run.vm.runtime.targets.flatMap(target => Object.values(target.variables || {}))
        .find(variable => variable.name === 'n')?.value;
    assert.notEqual(value(), 13.5);
    run.vm.runtime.emit('ANSWER', '13.5');
    await new Promise(setImmediate);
    for (let i = 0; i < 8; i++) run.vm.runtime._step(1000 / 30);
    assert.equal(value(), 13.5);
});

test('Arcade number prompt keyboard option stays visible until its semantics are implemented', () => {
    const translated = arcadeToPseudocode('let n = game.askForNumber("Number?", 2, true)');
    assert.ok(translated.unsupported.some(gap => gap.includes('digit limit')));
});
