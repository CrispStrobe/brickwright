// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import test from 'node:test';
import {SB3Creator, runCreatedProgram, stepFrames} from './helpers/bw-vm.mjs';

const parse = source => {
    const creator = new SB3Creator();
    creator.parse(source);
    assert.equal(creator.validate().isValid, true);
    return creator;
};

async function printLines (creator) {
    const {vm, errors} = await runCreatedProgram(creator, {frames: 0});
    const lines = [];
    const original = console.log;
    console.log = value => lines.push(value);
    try {
        await stepFrames(vm, 3);
        assert.deepEqual(errors, []);
        return lines;
    } finally {
        console.log = original;
        vm.stopAll();
        vm.quit();
    }
}

test('computed print values retain their runtime type and round-trip through Code', async () => {
    const creator = parse(`DEVICE ARDUINO-UNO
STAGE:
  WHEN flag clicked:
    set value to "007"
    print value
    print ("value=" join value)
    print length of value
    set value to (40 + 2)
    print value
    print "007"
`);
    const expected = ['007', 'value=007', 3, 42, '007'];
    assert.deepEqual(await printLines(creator), expected);
    assert.deepEqual(await printLines(parse(creator.decompile())), expected);
});

test('existing number-mode blocks still coerce their reporter to a number', async () => {
    const creator = parse(`DEVICE ARDUINO-UNO
STAGE:
  WHEN flag clicked:
    set value to "007"
    print value
`);
    const output = creator.project.targets.flatMap(target => Object.values(target.blocks))
        .find(block => block.opcode === 'stc12_print');
    output.fields.MODE = ['number', null];
    assert.deepEqual(await printLines(creator), [7]);
});
