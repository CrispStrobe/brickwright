import assert from 'node:assert/strict';
import {test} from 'node:test';
import {basicProfileFor, basicProfilesFor, codeLanguageAvailable, hiddenCodeDrafts, picoBasicProfileForDialect, standaloneBasicDrafts} from '../overlay/scratch-gui/src/lib/bw-matrix/code-languages.js';
import {picoBasicCommands} from '../overlay/scratch-gui/src/lib/bw-machines/pico-basic-source.js';

const languages = ['pseudocode', 'python', 'javascript', 'c', 'basic', 'asm', 'forth', 'tcl', 'fe'];
const allowed = device => languages.filter(language => codeLanguageAvailable(language, device));

test('the selected machine exposes the languages it can run or deploy', () => {
    assert.deepEqual(allowed(null), languages);
    for (const device of ['pico', 'z80', 'eater6502', 'i8086', 'riscv32', 'stc12c5a60s2', 'i80386']) {
        const expected = {
            pico: ['pseudocode', 'python', 'c', 'basic', 'asm'],
            z80: ['pseudocode', 'c', 'basic', 'asm'],
            eater6502: ['pseudocode', 'c', 'basic', 'asm'],
            i8086: ['pseudocode', 'c', 'basic', 'asm', 'forth', 'tcl', 'fe'],
            riscv32: ['pseudocode', 'c', 'asm', 'forth', 'tcl', 'fe'],
            stc12c5a60s2: ['pseudocode', 'c', 'asm'],
            i80386: ['pseudocode']
        };
        assert.deepEqual(allowed(device), expected[device], device);
    }
});

test('BASIC profiles respect the selected machine and retain a compatible preference', () => {
    assert.deepEqual(basicProfilesFor('i8086').map(profile => profile.id), ['i8086', 'i8086-dos', 'i8086-ubasic']);
    assert.equal(basicProfileFor('i8086', 'i8086-ubasic').id, 'i8086-ubasic');
    assert.equal(basicProfileFor('eater6502', 'bbc').id, 'ms');
    assert.equal(basicProfileFor('z80', 'ms').id, 'bbc');
    assert.equal(basicProfileFor('pico', 'ms').id, 'pico-bbcbasic');
    assert.equal(basicProfileFor(null, 'pico-bbcbasic').id, 'bbc');
    assert.equal(basicProfileFor('pico', 'ms').dialect, 'bbc');
    assert.deepEqual(basicProfilesFor('pico').map(profile => profile.id), ['pico-bbcbasic', 'pico-piccolo', 'pico-stefan']);
    assert.equal(basicProfileFor('pico', 'pico-piccolo').media, 'piccolobasic-rp2040');
    assert.equal(codeLanguageAvailable('basic', 'pico', {remoteImages: false}), false);
    assert.equal(basicProfileFor('stm32f030', 'ms'), undefined);
    assert.equal(codeLanguageAvailable('tcl', 'riscv32', {riscvHosted: false}), false);
    assert.equal(codeLanguageAvailable('asm', 'riscv32', {riscvHosted: false}), true);
    assert.deepEqual(allowed('spike'), ['pseudocode', 'python']);
});

test('PicoBB receives a complete numbered listing and one RUN command', () => {
    assert.deepEqual(picoBasicCommands('10 PRINT 40+2\r\n20 END\n'), ['10 PRINT 40+2', '20 END', 'RUN']);
    assert.deepEqual(picoBasicCommands('  PRINT 42\n\n  END'), ['10 PRINT 42', '20 END', 'RUN']);
    assert.throws(() => picoBasicCommands('10 PRINT 42\nEND'), /every BASIC source line/);
    assert.throws(() => picoBasicCommands('PRINT "' + 'x'.repeat(240) + '"'), /240 characters/);
    assert.throws(() => picoBasicCommands('PRINT "λ"'), /printable ASCII/);
});

test('machine filtering keeps authored drafts and lets stale generated views regenerate', () => {
    const authored = {javascript: 'authored JS', python: 'old Python'};
    const buffers = {javascript: 'authored JS', python: 'new generated Python'};
    assert.deepEqual(hiddenCodeDrafts(authored, buffers, 'eater6502', 'pseudocode'), {javascript: 'authored JS'});
    assert.deepEqual(hiddenCodeDrafts(authored, buffers, null, 'pseudocode'), {});
});

test('PiccoloBASIC receives unnumbered lowercase source and keeps labels and string case', () => {
    assert.deepEqual(picoBasicCommands('entry:\r\nlet a=40\nprint "Keep Case ";a+2', 'piccolo'),
        ['entry:', 'let a=40', 'print "Keep Case ";a+2', 'RUN']);
    assert.throws(() => picoBasicCommands('10 print 42', 'piccolo'), /unnumbered/);
    assert.throws(() => picoBasicCommands('print 42\nNEW', 'piccolo'), /Remove RUN/);
    assert.throws(() => picoBasicCommands('rem filler\n'.repeat(400), 'piccolo'), /4095 ASCII/);
});

test('Stefan’s BASIC uses numbered lines and respects the UART editor limit', () => {
    assert.deepEqual(picoBasicCommands('INPUT A\nPRINT A*2', 'stefan'), ['10 INPUT A', '20 PRINT A*2', 'RUN']);
    assert.deepEqual(picoBasicCommands('30 GOTO 30', 'stefan'), ['30 GOTO 30', 'RUN']);
    assert.throws(() => picoBasicCommands('10 REM ' + 'x'.repeat(114), 'stefan'), /120 characters/);
});

test('the two standalone Pico editors retain independent drafts across conversions', () => {
    assert.equal(picoBasicProfileForDialect('stefan').id, 'pico-stefan');
    assert.equal(picoBasicProfileForDialect('bbc').standalone, undefined);
    const buffers = {basic: '10 PRINT "BBC"', 'pico-piccolo': 'print "Piccolo"', 'pico-stefan': '10 PRINT "Stefan"'};
    assert.deepEqual(standaloneBasicDrafts(buffers),
        {'pico-piccolo': 'print "Piccolo"', 'pico-stefan': '10 PRINT "Stefan"'});
});
