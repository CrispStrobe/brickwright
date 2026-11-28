// N2f's hosted corpus receipt. Forty-eight SmallerC compilations are deliberate
// CI work: this test belongs on GitHub's runner, not the tiny development VPS.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {existsSync, readdirSync} from 'node:fs';
import {mkdtemp, readFile, rm, symlink, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {basename, isAbsolute, join, resolve} from 'node:path';
import {promisify} from 'node:util';
import {fileURLToPath, pathToFileURL} from 'node:url';

const execFileP = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const guiScopeHook = fileURLToPath(new URL('../scripts/lib/register-gui-scope.mjs', import.meta.url));
const expectedEmitted = [
    '01-blink',
    '05-counter',
    '06-active-low-high',
    '08-led-chaser-595',
    '09-relay-clicker',
    '11-toggle-button',
    '12-dual-blink',
    '13-sos-morse',
    '14-traffic-light',
    '168p01-blink',
    '18-logic-and-gate',
    '19-logic-or-gate',
    '20-shift-register-binary',
    '24-pwm-fade',
    '25-reaction-timer',
    '26-debounce',
    '27-led-dice',
    '30-multi-led-pattern',
    '32-source-vs-sink',
    '33-inductive-no-flyback',
    '46-port-overcurrent',
    '50-7seg-chase',
    '56-logical-on-pin-level',
    '60-retro-console',
    'arduino-01-blink',
    'arduino-01-digital-read-serial',
    'arduino-02-button',
    'arduino-02-digital-input-pullup',
    'arduino-02-state-change',
    'arduino-04-ascii-table',
    'arduino-05-arrays',
    'arduino-05-for-loop',
    'arduino-05-switch-case-2',
    'arduino-06-ping',
    'arduino-sk-p02-spaceship',
    'arduino-sk-p09-motorized-pinwheel',
    'arduino-sk-p11-crystal-ball',
    'arduino-sk-p13-touch-lamp',
    'arduino-sk-p15-hacking-buttons',
    'aurora65-workstation',
    'avr01-blink',
    'avr05-button-led',
    'binary-counter-buttons',
    'blinkenrocket-pendant',
    'eater6502-bench',
    'eater6502-blink',
    'eater6502-full-build',
    'i8086-blink',
    'idea-generator',
    'mb01-display',
    'mega01-blink',
    'mega03-port-current',
    'morse-buzzer-message',
    'nano01-blink',
    'pico01-blink',
    'pico04-button',
    'reaction-duel',
    'sense-clap-switch',
    'sense-noise-counter',
    'sense-pir-alarm',
    'two-toggle-keys',
    'z80-pd-bench'
];
const programNames = prefix => {
    const dir = join(root, 'overlay/scratch-gui/examples');
    return readdirSync(dir).filter(name => name.startsWith(prefix) &&
        existsSync(join(dir, name, 'program.bw'))).sort();
};
const namesOf = rows => rows.map(row => row.split(': ')[0]);
const auditReach = (receipt, {compiled}) => {
    const s = receipt.summary;
    // c593574 adds lesson 56's numeric-only STC12 program. Its two literal
    // waits make it one new emitted/compiled program and one new wait program.
    // 282 -> 295 at sb3-creator 0f14aedb (task B10, #49): thirteen sensor and
    // game examples, all with literal waits (waitLiteralPrograms +13). Eight
    // emit and compile (named in expectedEmitted); four stop at the ADC/PWM
    // choke; dice-pips' slowing roll is a computed wait, refused before its
    // unsigned word could wrap (waitComputedPrograms and -Refused +1).
    // sense-noise-counter's only `long` is a `//` copy of its program comment;
    // the script now asks the route's cUsesLong, so it is emitted, not a leak
    // (test/i8086-reach-long-classifier.test.mjs holds both directions).
    // 295 -> 303 at sb3-creator c8edc8cc (task B11, #52): eight device and
    // language examples. None emits for i8086: the five whose PART (DS3231,
    // AT24C02, I2C, HC-SR04, DS18B20) the 8086 board does not have are refused
    // as unreadable lines (parseFailed +5, named below); melody-lists (tone,
    // now; a literal and a computed wait) and random-lucky-light (now; a
    // literal wait) stop at their chokes; guess-the-number's joined print is
    // refused (printRefused, named below). #52 also refuses tone + print on
    // the 8051 at retarget (both need Timer 1), which moves the existing
    // arduino-02-tone-pitch-follower from its adc+tone choke to retargetRefused
    // and takes its literal wait out of the count: waitLiteralPrograms +2 -1,
    // waitComputedPrograms +1.
    // 303 -> 304 at sb3-creator 70488a68 (task B12, #55): chip-thermometer,
    // refused at retarget (the STC12 has no on-die sensor). #55 also lets tone
    // and print share an 8051 again (the UART moves to the BRT), so
    // arduino-02-tone-pitch-follower leaves retargetRefused for its adc+tone
    // choke and brings its literal wait back: waitLiteralPrograms +1.
    // Three new analog school sketches remain refused at MCU retarget; emitted sets stay fixed.
    // 307 -> 399 at the sb3-creator pin moves e248ce71 (8109d45ad, +50),
    // 01e12806 (ca593fa3f, +5) and cafdfb1a (cc516deda, +38), less one at
    // de3c53c8 (f906dba5c, lab-shortwave-regen dropped its program.bw): 92
    // lab-* gallery programs, analog bench circuits with no hardware
    // declarations. Every one is refused at retarget (retargetRefused
    // 135 -> 227); no wait count, emit or compile moves.
    // The original 399 programs remain; 244 analog lab programs and 56
    // CP1 stubs add only to the retarget-refused denominator. Keep every
    // actual wait/print/lowering/compile expectation unchanged.
    assert.equal(s.programs, 699);
    assert.equal(s.retargetRefused, 527);
    const labPrograms = programNames('lab-');
    const cp1Programs = programNames('cp1-');
    assert.equal(labPrograms.length, 336, 'the lab-* gallery program count moved');
    assert.equal(cp1Programs.length, 56, 'the CP1 gallery program count moved');
    const retargetRows = new Map(receipt.retarget.map(row => row.split(': ')));
    for (const name of [...labPrograms, ...cp1Programs]) {
        assert.equal(retargetRows.get(name), 'the source has no hardware declarations to retarget', name);
    }
    for (const name of ["school-intercom-101455", "school-led-people-dog", "school-miniorgan-107056"]) assert.ok(namesOf(receipt.retarget).includes(name), name);
    // 122 -> 121 at sb3-creator fa96f5f5+ (task D5): 82-a2-led-row (a literal
    // `wait 150 ms`) names a LEDBANK8, which i8086 does not have; its LED line
    // was DROPPED with a warning and the rest counted as reached. An unreadable
    // line is refused now, so the program is parseFailed (1, named) instead.
    // 121 -> 120 at sb3-creator 8f4b6316 (task D6): 80-a2-lcd-moving-text's
    // parallel LCD1602 declaration, which i8086 cannot take, was skipped with a
    // warning; it is refused now, so the program is parseFailed (named below).
    assert.equal(s.waitLiteralPrograms, 135);
    assert.equal(s.waitComputedPrograms, 4);
    assert.equal(s.waitLiteralRefused, 0);
    assert.equal(s.waitComputedRefused, 2);
    assert.deepEqual(receipt.emits, expectedEmitted,
        'the exact safety-correct emitted set changed');
    assert.deepEqual(receipt.compiled, compiled ? expectedEmitted : []);
    // sb3-creator c9be966f (#151): a DEVICE line now builds that device's C, so
    // the 28 programs that used to emit host C (hostC 28 -> 0) reach the 8086
    // lowering: five emit and compile (expectedEmitted), the micro:bit/SPIKE
    // sensor reads are refused by name (loweringRefused +9), the Arduino String
    // examples' joined prints are refused by name (printRefused +13), and
    // mb05-faceplate-matrix's constant exceeds 16 bits (int16Refused +1).
    assert.equal(s.hostC, 0);
    assert.deepEqual(namesOf(receipt.int16), ['mb05-faceplate-matrix']);
    assert.deepEqual(namesOf(receipt.loweringRefused), [
        '70-calculator',
        '70-calculator-simple',
        '71-calculator-pcb',
        'arduino-02-blink-without-delay',
        'arduino-02-debounce',
        'mb02-sensors',
        'mb03-pins',
        'mb04-radio',
        'mb05-lesson',
        'mb06-reaction',
        'mb07-stepcounter',
        'mb08-thermometer',
        'microbit01-hello',
        'spike01-obstacle-avoid'
    ]);
    assert.deepEqual(namesOf(receipt.printRefused), [
        'arduino-08-char-analysis',
        'arduino-08-string-addition',
        'arduino-08-string-append',
        'arduino-08-string-case',
        'arduino-08-string-chars',
        'arduino-08-string-compare',
        'arduino-08-string-constructors',
        'arduino-08-string-indexof',
        'arduino-08-string-length',
        'arduino-08-string-length-trim',
        'arduino-08-string-replace',
        'arduino-08-string-startswith',
        'arduino-08-string-substring',
        'arduino-08-string-toint',
        'guess-the-number'
    ]);
    assert.equal(receipt.loweringRefused.every(row => row.includes(': ') && !row.endsWith(': ?')), true);
    assert.equal(receipt.printRefused.every(row => row.includes(': ') && !row.endsWith(': ?')), true);
    assert.equal(receipt.choke.every(row => row.includes(': ') && !row.endsWith(': ?')), true);
    assert.equal(receipt.choke.find(row => row.startsWith('arduino-03-smoothing: ')),
        'arduino-03-smoothing: adc',
        'N2e list lowering is implemented; ADC remains smoothing\'s sole terminal choke');
    assert.equal(receipt.choke.some(row => /(?:^|, )numericLists(?:,|$)/.test(row.split(': ')[1] || '')), false,
        'an implemented numeric-list feature must never be reported as unsupported');
    assert.equal(s.emits, 62,
        'c879 removes two unsafe timer fallbacks from N2c\'s historical 44, then N2d adds four prints, '
        + 'P7 adds i8086-blink, N2f adds crystal-ball, c593574 adds lesson 56, B10 adds eight of '
        + 'sb3-creator #49\'s examples, and sb3-creator c9be966f (#151 DEVICE-line C) adds five '
        + '(arduino-04-ascii-table, aurora65-workstation, eater6502-bench, eater6502-full-build, mb01-display)');
    if (compiled) {
        assert.equal(s.compiled, s.emits,
            `every emitted program must compile through SmallerC: ${JSON.stringify(receipt.compileFailed)}`);
        assert.equal(s.compileFailed, 0);
    }
    assert.equal(s.longLeaked, 0);
    // 1 -> 3 at sb3-creator 8f4b6316 (task D6): the two parallel-LCD1602
    // programs' declaration is refused on i8086 instead of skipped.
    assert.equal(s.parseFailed, 8);
    assert.deepEqual(receipt.parseFailed.map(row => row.split(': ')[0]),
        ['80-a2-lcd-moving-text', '81-8051-lcd1602-parallel', '82-a2-led-row',
            'clock-ds3231', 'eeprom-start-counter', 'i2c-scanner', 'sense-distance-alarm',
            'sense-thermometer-1wire']);
    assert.equal(s.retargetRefused + s.parseFailed + s.choke + s.printRefused + s.loweringRefused + s.hostC
        + s.int16Refused + s.waitLiteralRefused + s.waitComputedRefused + s.emits, s.programs,
    'every gallery program must land in exactly one outcome bucket');
};

test('the 699-program gallery records the wait/print gains and every emitted program compiles',
    {timeout: 300000}, async t => {
        const {stdout} = await execFileP(process.execPath, [
            '--import', guiScopeHook,
            'scripts/measure-i8086-numeric-reach.mjs',
            '--examples', 'overlay/scratch-gui/examples',
            '--compile'
        ], {cwd: root, maxBuffer: 8 * 1024 * 1024});
        const receipt = JSON.parse(stdout);
        const s = receipt.summary;
        t.diagnostic(`N2d reach: ${JSON.stringify(s)}; `
            + `emitted: ${JSON.stringify(receipt.emits)}; `
            + `compiled: ${JSON.stringify(receipt.compiled)}; `
            + `compile failures: ${JSON.stringify(receipt.compileFailed)}`);
        auditReach(receipt, {compiled: true});
    });

test('commented-zero mutation cannot put either timer program back into honest reach',
    {timeout: 120000}, async () => {
        const sourceDir = fileURLToPath(new URL('../overlay/scratch-gui/src/lib/', import.meta.url));
        const sourceFile = join(sourceDir, 'sb3-creator.js');
        const temp = await mkdtemp(join(tmpdir(), 'n2d-commented-zero-mutant-'));
        const mutantFile = join(temp, 'sb3-creator.mjs');
        const source = await readFile(sourceFile, 'utf8');
        const anchor = 'if (!this._cLoweringRefused.includes(shown)) this._cLoweringRefused.push(shown);';
        const guiRoot = process.env.BW_INTEGRATED_ROOT ?
            resolve(process.env.BW_INTEGRATED_ROOT) : join(root, 'packages/scratch-gui');
        const guiPackage = join(guiRoot, 'package.json');
        const guiRequire = createRequire(pathToFileURL(guiPackage));
        const jszipEntry = guiRequire.resolve('jszip');
        const jszip = pathToFileURL(jszipEntry).href;
        assert.equal(isAbsolute(jszipEntry), true,
            'isolated mutant JSZip entry must resolve to an absolute path');
        assert.equal(new URL(jszip).protocol, 'file:',
            'isolated mutant JSZip entry must be an absolute file URL');
        const jszipAnchor = "import JSZip from 'jszip';";
        const importBound = source.replace(jszipAnchor,
            `import JSZip from ${JSON.stringify(jszip)};`);
        assert.notEqual(importBound, source, 'isolated mutant JSZip import anchor moved');
        const mutant = importBound
            .replace(anchor, 'if (!this._cLoweringRefused.includes(shown)) void shown;');
        assert.notEqual(mutant, source, 'commented-zero mutation anchor moved');
        assert.doesNotMatch(mutant, /from ['"]jszip['"]/,
            'isolated mutant retained a bare GUI dependency outside test attribution');
        try {
            const dependencies = [
                'sb3-creator-runtime.js',
                'sb3-creator-scratchruntime.js',
                'sb3-creator-chostruntime.js',
                'cubeDirections.js',
                'ev3Dialect.js',
                'arcadeDialect.js',
                'cpxDialect.js',
                'pinRoleParts.js'
            ];
            if (/^import\s+[^\n]*\sfrom\s+['"]\.\/procedureParameterConstraints\.js['"]/m.test(source)) {
                dependencies.push('procedureParameterConstraints.js');
            }
            for (const dependency of dependencies) {
                await symlink(join(sourceDir, dependency), join(temp, basename(dependency)));
            }
            await writeFile(mutantFile, mutant);
            const {default: MutantCreator} = await import(pathToFileURL(mutantFile).href);
            assert.equal(typeof MutantCreator, 'function',
                'isolated mutant must load before checking the commented-zero mutation');
            const {stdout} = await execFileP(process.execPath, [
                '--import', guiScopeHook,
                'scripts/measure-i8086-numeric-reach.mjs',
                '--examples', 'overlay/scratch-gui/examples',
                '--sb3', mutantFile
            ], {cwd: root, maxBuffer: 8 * 1024 * 1024});
            const receipt = JSON.parse(stdout);
            assert.ok(receipt.emits.includes('arduino-02-blink-without-delay') ||
                receipt.emits.includes('arduino-02-debounce'),
            'mutation did not reproduce a timer program entering through commented zero');
            assert.throws(() => auditReach(receipt, {compiled: false}),
                /safety-correct emitted set changed/);
        } finally {
            await rm(temp, {recursive: true, force: true});
        }
    });
