// N2d measurement gate. This is parse/generate only: candidate compilation and
// live output belong to hosted acceptance after the boundary is chosen.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {existsSync, readdirSync} from 'node:fs';
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {
    printDependsOnNumericList,
    printDependsOnRandomControlFlow
} from '../scripts/lib/i8086-print-reach.mjs';

const execFileP = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const hook = join(root, 'scripts/lib/register-gui-scope.mjs');
const script = join(root, 'scripts/measure-i8086-print-reach.mjs');
const measureRaw = async examples => (await execFileP(process.execPath,
    ['--import', hook, script, '--examples', examples],
    {cwd: root, maxBuffer: 8 * 1024 * 1024})).stdout;
const programNames = prefix => {
    const dir = join(root, 'overlay/scratch-gui/examples');
    return readdirSync(dir).filter(name => name.startsWith(prefix) &&
        existsSync(join(dir, name, 'program.bw'))).sort();
};
const measure = async examples => JSON.parse(await measureRaw(examples));

test('the exact 699-program post-production print census is disjoint and exhaustive',
    {timeout: 120000}, async () => {
        const absolute = join(root, 'overlay/scratch-gui/examples');
        const absoluteBytes = await measureRaw(absolute);
        const relativeBytes = await measureRaw('overlay/scratch-gui/examples');
        assert.equal(relativeBytes, absoluteBytes,
            'equivalent corpus paths must produce byte-identical JSON');
        const report = JSON.parse(absoluteBytes);
        assert.equal(report.schema, 'n2f-i8086-print-reach-v5');
        // c593574 adds lesson 56's program.bw. It has no output opcode, so it
        // grows only the exhaustive corpus/opcode denominators and no print bucket.
        // 282 -> 295 at sb3-creator 0f14aedb (task B10, #49): thirteen sensor and
        // game examples. Their terminal outcomes: emitted binary-counter-buttons,
        // idea-generator, reaction-duel, sense-noise-counter, sense-pir-alarm (5);
        // no output opcode morse-buzzer-message, sense-auto-dimmer,
        // sense-clap-switch, sense-noise-light, two-toggle-keys (5); ADC choke
        // sense-light-barrier, sense-twilight-switch (2); computed wait refused
        // dice-pips (1). sense-noise-counter's C says "long" only in a `//` copy
        // of its program comment; the classifier is now the route's own
        // cUsesLong (test/i8086-reach-long-classifier.test.mjs), so it is
        // emitted, not longLeaked.
        // 295 -> 303 at sb3-creator c8edc8cc (task B11, #52): eight examples.
        // Output-bearing: clock-ds3231, eeprom-start-counter, i2c-scanner,
        // sense-distance-alarm, sense-thermometer-1wire (computed) and
        // guess-the-number (mixed); no output opcode: melody-lists,
        // random-lucky-light. The five PART programs are parseFailed on the
        // 8086 (it has none of those parts), so their output is notReached;
        // guess-the-number's joined print is printRefused. #52 also refuses
        // tone + print on the 8051 at retarget (Timer 1 is the baud clock):
        // arduino-02-tone-pitch-follower leaves the adc+tone choke for
        // retargetRefused, and its output becomes notReached.
        // 303 -> 304 at sb3-creator 70488a68 (task B12, #55): chip-thermometer,
        // one computed print, refused at retarget (no sensor on the STC12), so
        // its output is notReached. tone + print is allowed on the 8051 again,
        // so arduino-02-tone-pitch-follower parses and stops at its adc+tone
        // choke (refused, no longer notReached).
        // Three school analog-only projects add no output opcodes and are retarget refused.
        // 307 -> 399 at the sb3-creator pin moves e248ce71 (8109d45ad, +50),
        // 01e12806 (ca593fa3f, +5) and cafdfb1a (cc516deda, +38), less one at
        // de3c53c8 (f906dba5c, lab-shortwave-regen dropped its program.bw): 92
        // lab-* gallery programs. They are analog bench circuits with no
        // hardware declarations, so every one is retarget refused and adds only
        // to the program/none/retargetRefused denominators (135 -> 227); every
        // other bucket, the emitted set and the opcode inventory are unchanged.
        // The original 399 programs remain. The shipping cohort adds 244
        // analog lab and 56 CP1 stubs; all add only to no-output/retarget
        // buckets. The actual print inventory and emitted sets stay fixed.
        assert.equal(report.programs, 699);
        const labPrograms = programNames('lab-');
        const cp1Programs = programNames('cp1-');
        assert.equal(labPrograms.length, 336, 'the lab-* gallery program count moved');
        assert.equal(cp1Programs.length, 56, 'the CP1 gallery program count moved');
        const retargetRows = new Map(report.terminal.retargetRefused.map(row => row.split(': ')));
        for (const name of [...labPrograms, ...cp1Programs]) {
            assert.equal(retargetRows.get(name), 'the source has no hardware declarations to retarget', name);
        }
        assert.deepEqual(report.source.operations, {say: 0, sayForSecs: 0, print: 120, total: 120});
        assert.deepEqual(report.source.values, {literalText: 48, numericLiteral: 0, computed: 72});
        assert.deepEqual(report.source.programCounts,
            {literalText: 6, numericLiteral: 0, computed: 34, mixed: 16, none: 643});
        // Until B11 every output-bearing program parsed on the 8086, so the
        // opcode inventory equalled the source one. 7 computed prints do not
        // reach an opcode: those of the five PART programs (parseFailed, 6) and
        // chip-thermometer's (retargetRefused, 1); since B12 the pitch
        // follower's reach it again.
        assert.deepEqual(report.opcode.operations, {say: 0, sayForSecs: 0, print: 113, total: 113},
            'retarget/parse changed the output-opcode inventory');
        assert.deepEqual(report.opcode.values, {literalText: 48, numericLiteral: 0, computed: 65},
            'retarget/parse changed the output-value inventory');
        assert.equal(report.invariants.sourceLiteralTextPrograms, 22);
        assert.equal(report.invariants.sourceNumericOrComputedPrograms, 50);
        assert.equal(report.invariants.sourceOutputPrograms, 56);
        assert.equal(report.invariants.sourceProgramCount, 699);
        // 151 -> 150 at sb3-creator fa96f5f5+ (task D5): 82-a2-led-row's
        // `light only led step on leds` names a LEDBANK8, which i8086 does not
        // have, so the line was DROPPED with a warning and the program counted
        // as parsed with no output opcode. An unreadable line is refused now;
        // the program is parseFailed, named, instead of hollow.
        // 150 -> 148 at sb3-creator 8f4b6316 (task D6): 80-a2-lcd-moving-text
        // and 81-8051-lcd1602-parallel declare a parallel LCD1602, which i8086
        // cannot take (`should use the I2C LCD wiring`). The declaration was
        // skipped with a warning and the programs counted as parsed with no
        // output opcode; the declaration is refused now, so they are
        // parseFailed, named. (82-a2-led-row's LEDBANK8 line is refused too.)
        // 148 -> 161 at sb3-creator 0f14aedb (task B10): the thirteen #49 examples
        // all parse on the 8086.
        // 161 -> 163 at sb3-creator c8edc8cc (task B11): +3 parsed (melody-lists,
        // random-lucky-light, guess-the-number), -1 retarget-refused
        // (arduino-02-tone-pitch-follower); the five PART examples are parseFailed.
        // 163 -> 164 at 70488a68 (task B12): the pitch follower parses again.
        assert.equal(report.invariants.opcodeProgramCount, 164);
        assert.equal(report.invariants.sourceProgramExhaustive, true);
        assert.equal(report.invariants.opcodeProgramExhaustive, true);
        assert.equal(report.invariants.currentOutputCount, 56);
        assert.equal(report.invariants.currentOutputExhaustiveForSource, true);
        // sb3-creator c9be966f (#151): a DEVICE line builds that device's C, so
        // the 15 output programs that generated host C reach the 8086 device
        // route: arduino-04-ascii-table and eater6502-full-build emit, and the
        // other 13 (the Arduino String examples' joined prints) are printRefused.
        assert.deepEqual(report.currentOutput.counts,
            {notReached: 6, hostC: 0, refused: 38, emitted: 12, commentOnly: 0});
        assert.deepEqual(report.terminalCounts, {
            retargetRefused: 527, parseFailed: 8, noOutputOpcode: 114, hostC: 0,
            printRefused: 15, remainingChoke: 22, waitRefused: 1, int16Refused: 0,
            longLeaked: 0, emitted: 12, commentOnly: 0
        });
        assert.equal(report.invariants.terminalCount, 699);
        assert.equal(report.invariants.terminalExhaustive, true);
        assert.deepEqual(report.chokeCombinationCounts, {
            adc: 17, none: 28, 'adc + tone': 1,
            'adc + pwm': 1, 'adc + now': 3
        });
        assert.deepEqual(report.remainingChokeCounts, {adc: 22, tone: 1, pwm: 1, now: 3});
        // 17 -> 32 at c9be966f: the former host-C programs' variable prints are device occurrences now.
        assert.equal(report.computedForms.variable.deviceOccurrences, 32);
        assert.equal(report.computedForms.stc12_read.deviceOccurrences, 15);
        assert.equal(report.computedForms.operator_join.deviceOccurrences, 5);
        assert.deepEqual(report.computedForms.operator_join.devicePrograms,
            ['arduino-08-string-addition', 'guess-the-number']);
        assert.deepEqual(report.currentOutput.emitted, [
            'arduino-01-digital-read-serial',
            'arduino-02-digital-input-pullup',
            'arduino-02-state-change',
            'arduino-04-ascii-table',
            'arduino-06-ping',
            'arduino-sk-p11-crystal-ball',
            'binary-counter-buttons',
            'eater6502-full-build',
            'idea-generator',
            'reaction-duel',
            'sense-noise-counter',
            'sense-pir-alarm'
        ]);
        const smoothingEvidence = report.numericListDependencyEvidence['arduino-03-smoothing'];
        assert.ok(smoothingEvidence.some(row => /ADC/.test(row)),
            'smoothing must retain its named post-N2e ADC choke');
        assert.equal(smoothingEvidence.some(row => /list.*not emitted|data_itemoflist/.test(row)), false,
            'N2e list lowering must not remain in smoothing refusal evidence');
        assert.equal(Object.hasOwn(report.printRefusalEvidence, 'arduino-03-smoothing'), false,
            'N2e list lowering crossed, so smoothing must no longer be a print refusal');
        assert.ok(report.terminal.remainingChoke.includes('arduino-03-smoothing: adc'),
            'N2e must move smoothing only to its honest remaining ADC choke');
        assert.equal(report.terminal.remainingChoke.some(row => /numericLists/.test(row)), false,
            'the reach classifier contradicts the emitter by calling N2e list lowering unsupported');
        assert.match(report.printRefusalEvidence['arduino-08-string-addition'].reasons.join('\n'),
            /operator_join is string-valued/);
        for (const name of ['arduino-05-switch-case', 'arduino-06-knock']) {
            assert.equal(Object.hasOwn(report.printRefusalEvidence, name), false,
                `${name}: released literal output remained a print refusal instead of its ADC choke`);
        }
        // +13 at c9be966f: the Arduino String examples left host C and are refused by name.
        assert.deepEqual(Object.keys(report.printRefusalEvidence), [
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
        assert.ok(report.terminal.emitted.includes('arduino-sk-p11-crystal-ball'),
            'N2f crystal-ball did not reach emitted terminal output');
        assert.equal(report.terminal.printRefused.every(row => row.includes(': ')), true,
            'numeric print refusals must retain their named reason');
        for (const obsolete of ['postChokeCandidates', 'printChokeEvidence']) {
            assert.equal(Object.hasOwn(report, obsolete), false,
                `post-production schema retained hypothetical ${obsolete}`);
        }
        assert.equal(Object.hasOwn(report.terminal, 'prospectiveEmit'), false,
            'post-production terminal retained hypothetical prospectiveEmit');
        assert.equal(report.terminal.retargetRefused.every(row => row.includes(': ')), true,
            'retarget failures must retain their named reason');
        assert.equal(report.terminal.remainingChoke.every(row => row.includes(': ')), true,
            'remaining-choke outcomes must retain their named reason');
    });

test('a parsed say is reported as comment-only, never mistaken for emitted device output', async () => {
    const temp = await mkdtemp(join(tmpdir(), 'n2d-say-'));
    try {
        const example = join(temp, 'say-fixture');
        await mkdir(example);
        await writeFile(join(example, 'program.bw'), [
            'DEVICE STC12C5A60S2',
            'PIN led = P1.0 OUTPUT',
            'WHEN flag clicked:',
            '  say "hello"'
        ].join('\n') + '\n');
        const report = await measure(temp);
        assert.deepEqual(report.source.operations, {say: 1, sayForSecs: 0, print: 0, total: 1});
        assert.deepEqual(report.opcode.operations, report.source.operations);
        assert.deepEqual(report.currentOutput.counts,
            {notReached: 0, hostC: 0, refused: 0, emitted: 0, commentOnly: 1});
        assert.deepEqual(report.terminalCounts, {
            retargetRefused: 0, parseFailed: 0, noOutputOpcode: 0, hostC: 0,
            printRefused: 0, remainingChoke: 0, waitRefused: 0, int16Refused: 0,
            longLeaked: 0, emitted: 0, commentOnly: 1
        });
    } finally {
        await rm(temp, {recursive: true, force: true});
    }
});

const valueVariable = (name, id) => [3, [12, name, id]];
const valueBlock = id => [3, id];
const fieldVariable = (name, id) => [name, id];
const projectWith = blocks => ({targets: [{blocks}]});

test('numeric-list dependency follows direct and transitive print inputs but ignores non-feeding lists', () => {
    const direct = projectWith({
        print: {opcode: 'stc12_print', inputs: {VALUE: valueBlock('item')}},
        item: {opcode: 'data_itemoflist', inputs: {INDEX: [1, [4, 1]]}}
    });
    assert.equal(printDependsOnNumericList(direct), true, 'direct list reporter was missed');

    const transitive = projectWith({
        print: {opcode: 'stc12_print', inputs: {VALUE: valueVariable('out', 'out-id')}},
        setOut: {
            opcode: 'data_setvariableto', fields: {VARIABLE: fieldVariable('out', 'out-id')},
            inputs: {VALUE: valueVariable('middle', 'middle-id')}
        },
        setMiddle: {
            opcode: 'data_setvariableto', fields: {VARIABLE: fieldVariable('middle', 'middle-id')},
            inputs: {VALUE: valueBlock('item')}
        },
        item: {opcode: 'data_itemoflist', inputs: {INDEX: [1, [4, 1]]}}
    });
    assert.equal(printDependsOnNumericList(transitive), true, 'transitive scalar provenance was missed');

    const nonFeeding = projectWith({
        print: {opcode: 'stc12_print', inputs: {VALUE: valueVariable('out', 'out-id')}},
        setOut: {
            opcode: 'data_setvariableto', fields: {VARIABLE: fieldVariable('out', 'out-id')},
            inputs: {VALUE: [1, [4, 7]]}
        },
        unrelated: {opcode: 'data_itemoflist', inputs: {INDEX: [1, [4, 1]]}}
    });
    assert.equal(printDependsOnNumericList(nonFeeding), false, 'an unrelated list poisoned print reach');
});

test('random control-flow dependency follows a printed branch through scalar provenance', () => {
    const project = projectWith({
        setRoll: {
            opcode: 'data_setvariableto', fields: {VARIABLE: fieldVariable('roll', 'roll-id')},
            inputs: {VALUE: valueBlock('random')}
        },
        random: {opcode: 'operator_random', inputs: {FROM: [1, [4, 1]], TO: [1, [4, 8]]}},
        equals: {
            opcode: 'operator_equals',
            inputs: {OPERAND1: valueVariable('roll', 'roll-id'), OPERAND2: [1, [4, 1]]}
        },
        branch: {
            opcode: 'control_if', inputs: {CONDITION: valueBlock('equals'), SUBSTACK: valueBlock('print')}
        },
        print: {opcode: 'stc12_print', parent: 'branch', inputs: {VALUE: [1, [10, 'yes']]}}
    });
    assert.equal(printDependsOnRandomControlFlow(project), true);
});
