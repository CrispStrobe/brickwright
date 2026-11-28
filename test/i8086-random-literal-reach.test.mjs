import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readdirSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
    N2F_RNG_SEED,
    analyzeProgram,
    assertRefusalBucketCoverage,
    discoverCRefusalBuckets,
    discoverRuntimeRefusalBuckets,
    enumerateRuntimeRefusals,
    finalizeRefusalInventory,
    measureN2f,
    n2fRandomInt16
} from '../scripts/measure-i8086-random-literal-reach.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const examples = join(root, 'overlay/scratch-gui/examples');
const emitterFile = join(root, 'overlay/scratch-gui/src/lib/sb3-creator.js');
// 27 -> 46 entries at sb3-creator 0f14aedb (task B10): sb3-creator #49's
// idea-generator (13), reaction-duel (2), sense-pir-alarm (2) and
// sense-twilight-switch (2) print literal text; every earlier entry is unchanged.
// 46 -> 48 at sb3-creator c8edc8cc (task B11): guess-the-number (2).
const literalPrintBlocks = [
    'arduino-04-ascii-table:h(%a.I?g~**:9Pj+1?KE',
    'arduino-05-switch-case:0Q8p=FNNXb*[5]V+!AlU',
    'arduino-05-switch-case:6Or`*08d)3Z)bVOMU]iE',
    'arduino-05-switch-case:M.*rX[]Ft7mljRbaeIoN',
    'arduino-05-switch-case:We)x0J@e5ZqrhH2xuCX!',
    'arduino-06-knock:cfgCh.PtUrp%_r*|.)U#',
    'arduino-08-char-analysis::GlWhzUIQHTFp4y*RJOf',
    'arduino-08-string-append:rXb7DbgsT103VcFn#:wM',
    'arduino-08-string-case:p{2xxl-p4]cvH|=bm!iX',
    'arduino-08-string-chars:F[:)2{{jtv.8-W49/8%[',
    'arduino-08-string-compare::gH|=hz|NMTmT:!QC-,#',
    'arduino-08-string-constructors:{sd5]]sDRswLW%T#%F*]',
    'arduino-08-string-indexof:rDTp1!7#uN!kT]MF,DnU',
    'arduino-08-string-length:}(25D@RK+|5N1J4th3.]',
    'arduino-08-string-length-trim:,t)~/jH`pVI2ELie72Mh',
    'arduino-08-string-replace:u?=1EcopD`PG2C9a/Hdm',
    'arduino-08-string-startswith:J!-C-e!]l+Y@WuK1c/`4',
    'arduino-08-string-substring:{6k#vvA4K4rX0Fx?5LC3',
    'arduino-08-string-toint:a?:81t-HaCZp0=1Yy!@1',
    'arduino-sk-p11-crystal-ball:=f,X#0]A;C0Q@drdYsri',
    'arduino-sk-p11-crystal-ball:E7dWoJ0FZ(YYNQlep@2?',
    'arduino-sk-p11-crystal-ball:GqDngHvPqpIaXn.y960_',
    'arduino-sk-p11-crystal-ball:QShFHBm*O8O%}u2ob8zW',
    'arduino-sk-p11-crystal-ball:g|o^pvM2ifZXiOA=736R',
    'arduino-sk-p11-crystal-ball:l%b.,h,Wup`Z.eQZMxe8',
    'arduino-sk-p11-crystal-ball:xyw[e_p[]R#xTCFmz9Ox',
    'arduino-sk-p11-crystal-ball:|7l:fbD=GKrs~lY9V)s,',
    'guess-the-number:,9OMTnCv2EJf7F~?t}|H',
    'guess-the-number:6Q*v,JSJK3X46BnP)9ca',
    'idea-generator:9u9`Km+[5KYVDEZ-zjO.',
    'idea-generator:@u[)WmZ*)_5xvP~ecl9h',
    'idea-generator:D92@6@9~dz/Vh0u`zxK,',
    'idea-generator:DL{KRFXxlC/thyJwy3Z;',
    'idea-generator:KWgDu(box@33-};bp.i~',
    'idea-generator:P[;?%!UEK-HPp!svxj}Z',
    'idea-generator:WrjG*vKtJz9y/9^_=y7k',
    'idea-generator:XwK:5c%A}92ap(@g:kpv',
    'idea-generator:`2inHcyPnmP6IogUG:=|',
    'idea-generator:`YJTk8{{^WH!6wwv[5Ds',
    'idea-generator:leJZ+kF#YvAq^O3f*/oY',
    'idea-generator:uNDp%Bm_ie`ROKT#*vgd',
    'idea-generator:y#+W8t-shAlNAIQl#i{y',
    'reaction-duel:Z5SKqwc{.f|fx2AwJ(j9',
    'reaction-duel:ZcXOkx?2y;}@/2SN3z#|',
    'sense-pir-alarm:;V]Arob.AQ.kOC:E?#{,',
    'sense-pir-alarm:;z6r7hZ6u,nhK;=NM=9k',
    'sense-twilight-switch:/NL5w_#Pkq`+qFiN1hJ]',
    'sense-twilight-switch:zzu83yxwLX[i`6Rk5uRC'
];
// 1 -> 4 edges at sb3-creator c8edc8cc (task B11): guess-the-number (1) and
// random-lucky-light (2) pick random numbers; neither generates on the 8086.
// The lucky-light ids moved at sb3-creator a69547b7 (#53): its new green-flag
// script shifts the generated block ids; the two edges themselves are unchanged.
const integerRandomEdges = [{
    program: 'arduino-sk-p11-crystal-ball',
    randomBlockId: 'vkBNDwMf7d6Z16c3aQUc',
    consumerBlockId: 'g)MC,FVO^_s8s3]^E[uv',
    inputName: 'VALUE'
}, {
    program: 'guess-the-number',
    randomBlockId: 'lVncw)swRZ75f{{dYvF}',
    consumerBlockId: '}NV{rOJxrudnXL/;vbZ/',
    inputName: 'VALUE'
}, {
    program: 'random-lucky-light',
    randomBlockId: '?^`U-hkzO4)|+}5`4-B~',
    consumerBlockId: 'lPX[[Qcc:(En%bT6@*I3',
    inputName: 'VALUE'
}, {
    program: 'random-lucky-light',
    randomBlockId: 'F@+LrE~CuGlvWVD*2leV',
    consumerBlockId: '38j=*?2Q^rrwUq(CYPvJ',
    inputName: 'VALUE'
}];

test('N2f production holds device 62 and mixed generation 62 without neutralisation',
    {timeout: 120000}, async () => {
        const report = await measureN2f({examples});
        assert.equal(report.schema, 'n2f-i8086-random-literal-reach-v1');
        const refusalBuckets = ['_cI16Refused', '_cListRefused', '_cLoweringRefused',
            '_cPrintRefused', '_cWaitRefused'];
        assert.deepEqual(report.refusalBuckets, {
            source: refusalBuckets,
            runtime: refusalBuckets,
            union: refusalBuckets,
            enumerated: refusalBuckets
        });
        // c593574 adds lesson 56's numeric-only STC12 program. It parses and
        // generates device C in every lattice variant, so each corresponding
        // denominator grows by exactly one while the refusal sets stay fixed.
        // 151 parsed / 31 host / 80 total -> 150 / 30 / 79 at sb3-creator
        // fa96f5f5+ (task D5): 82-a2-led-row's LEDBANK8 line has no reading on
        // i8086 and was DROPPED with a warning, so its host C was generated for
        // a program missing its only output statement. An unreadable line is
        // refused now; the program is parseFailed, named, not a hollow success.
        // 150 parsed / 30 host / 79 total -> 148 / 28 / 77 at sb3-creator
        // 8f4b6316 (task D6): 80-a2-lcd-moving-text and 81-8051-lcd1602-parallel
        // declare a parallel LCD1602, which i8086 cannot take. The declaration
        // was skipped with a warning and host C was generated for a program
        // without its display; it is refused now, and both are parseFailed.
        // 282 / 148 parsed / 71 refused / 49 device / 77 total -> 295 / 161 / 76 /
        // 57 / 85 at sb3-creator 0f14aedb (task B10): sb3-creator #49's thirteen
        // examples all parse; eight generate device C (the eight named in
        // i8086-wait-reach's emitted set) and five are refused (four at the ADC
        // or PWM wall, dice-pips at its computed wait). No host C, and the
        // neutralisation lattice below still changes nothing.
        // 295 / 131 retarget-refused / 161 parsed / 3 parse-failed / 76 refused ->
        // 303 / 132 / 163 / 8 / 78 at sb3-creator c8edc8cc (task B11, #52): of
        // its eight examples the five PART programs are parseFailed on the 8086
        // and melody-lists, random-lucky-light and guess-the-number parse and are
        // refused; tone + print is refused at retarget on the 8051 now, which
        // moves arduino-02-tone-pitch-follower from refused to retargetRefused.
        // Generated reach is unchanged.
        // 303 / 163 parsed / 78 refused -> 304 / 164 / 79 at sb3-creator
        // 70488a68 (task B12): chip-thermometer is refused at retarget (no
        // sensor on the STC12), and the pitch follower, whose tone + print the
        // 8051 now takes, parses and is refused at its choke. Generation unchanged.
        // 79 refused / 28 host / 57 device / 85 total -> 102 / 0 / 62 / 62 at
        // sb3-creator c9be966f (#151): a DEVICE line builds that device's C, so
        // no program generates host C. Of the 28 former host-C programs five
        // generate device C (the five i8086-wait-reach adds) and 23 are refused
        // by name (micro:bit/SPIKE sensor reads, Arduino String joined prints,
        // one 32-bit constant). The neutralisation lattice still changes nothing.
        // Three analog school programs have no MCU; every lattice must refuse their retarget.
        for (const variant of Object.values(report.variants)) {
            for (const name of ["school-intercom-101455", "school-led-people-dog", "school-miniorgan-107056"]) assert.ok(variant.retargetRefused.includes(name), name);
        }
        // 307 / 135 retarget-refused -> 399 / 227 at the sb3-creator pin moves
        // e248ce71 (8109d45ad, +50), 01e12806 (ca593fa3f, +5) and cafdfb1a
        // (cc516deda, +38), less one at de3c53c8 (f906dba5c,
        // lab-shortwave-regen dropped its program.bw): 92 lab-* analog bench
        // programs with no hardware declarations, refused at retarget in every
        // lattice variant. Parsed, refused and generated counts are unchanged.
        const labPrograms = readdirSync(examples).filter(name => name.startsWith('lab-') &&
            existsSync(join(examples, name, 'program.bw')));
        // Current shipping gallery compared with f906dba5c: the original 399
        // programs all remain; 244 additional lab programs and 56 CP1 programs
        // are all refused at retarget in each of the four variants. Their
        // separate device/analog routes must not inflate i8086 generated reach.
        const cp1Programs = readdirSync(examples).filter(name => name.startsWith('cp1-') &&
            existsSync(join(examples, name, 'program.bw')));
        assert.equal(labPrograms.length, 336, 'the lab-* gallery program count moved');
        assert.equal(cp1Programs.length, 56, 'the CP1 gallery program count moved');
        for (const variant of Object.values(report.variants)) {
            for (const name of [...labPrograms, ...cp1Programs]) {
                assert.ok(variant.retargetRefused.includes(name), name);
            }
        }
        assert.deepEqual(report.variants.baseline.counts, {
            programs: 699, retargetRefused: 527, parsed: 164, parseFailed: 8,
            refused: 102, generatedHost: 0, generatedDevice: 62, generatedTotal: 62
        });
        assert.equal(report.variants.literalOnly.counts.generatedTotal, 62);
        assert.deepEqual(report.delta.literalOnly, [], 'literal neutralisation changed production reach');
        assert.equal(report.variants.randomOnly.counts.generatedTotal, 62);
        assert.deepEqual(report.delta.randomOnly, [], 'random neutralisation changed production reach');
        assert.equal(report.variants.randomAndLiteral.counts.generatedTotal, 62);
        assert.equal(report.variants.randomAndLiteral.counts.generatedDevice, 62);
        assert.deepEqual(report.delta.randomAndLiteral, [],
            'combined neutralisation changed production reach');
        assert.deepEqual(report.transforms.randomAndLiteral.integerRandomEdges, integerRandomEdges,
            'the parsed random candidate edge changed');
        assert.deepEqual(report.transforms.randomAndLiteral.literalPrintBlocks, literalPrintBlocks,
            'the parsed literal blocker set changed');
        assert.deepEqual(report.transforms.baseline,
            {literalPrintBlocks: [], integerRandomEdges: []});
        assert.deepEqual(report.transforms.literalOnly.literalPrintBlocks,
            report.transforms.randomAndLiteral.literalPrintBlocks,
            'the parsed literal blocker set changed across the lattice');
        assert.deepEqual(report.transforms.randomOnly.integerRandomEdges,
            report.transforms.randomAndLiteral.integerRandomEdges,
            'the parsed random blocker edge changed across the lattice');
        for (const name of ['arduino-05-switch-case', 'arduino-06-knock']) {
            const row = report.literalFallthrough[name];
            assert.equal(row.outcome, 'refused');
            assert.ok(row.activeUses.includes('adc'), `${name} did not fall through to the 8255-only wall`);
            assert.equal(Object.values(row.refusals).every(reasons => reasons.length === 0), true,
                `${name} retained an earlier structured refusal after literal neutralisation`);
            assert.match(row.header, /This program also uses: adc\./,
                `${name} did not terminate at the ADC feature wall`);
        }
        const crystal = report.literalFallthrough['arduino-sk-p11-crystal-ball'];
        assert.equal(crystal.outcome, 'deviceC');
        assert.equal(Object.values(crystal.refusals).every(reasons => reasons.length === 0), true);
        assert.ok(crystal.activeUses.includes('random'),
            'literal neutralisation lost the released crystal-ball random lowering');
        assert.equal(report.compile.status, 'deferred-to-hosted-ci');
    });

test('the refusal census derives every bucket from production source and an omitted bucket is red',
    async () => {
        const source = await readFile(emitterFile, 'utf8');
        const discovered = discoverCRefusalBuckets(source);
        for (const required of ['_cI16Refused', '_cPrintRefused', '_cLoweringRefused',
            '_cListRefused', '_cWaitRefused']) {
            assert.ok(discovered.includes(required), `${required} was not discovered from the emitter`);
        }
        assertRefusalBucketCoverage(discovered, discovered);
        const mutatedSource = source.replace('this._cListRefused = [];',
            'this._cListRefused = []; this["_cFutureRefused"] = [];');
        assert.notEqual(mutatedSource, source, 'future-bucket mutation anchor moved');
        const future = discoverCRefusalBuckets(mutatedSource);
        assert.ok(future.includes('_cFutureRefused'));
        assert.throws(() => assertRefusalBucketCoverage(future, discovered),
            /_cFutureRefused/, 'a future refusal bucket omitted by the census did not fail the guard');
        const futureRuntime = Object.fromEntries(future.map(name => [name, []]));
        const futureReport = enumerateRuntimeRefusals(futureRuntime, discovered);
        assert.ok(futureReport.names.includes('_cFutureRefused'),
            'a future runtime refusal bucket did not enter the report');
        assert.deepEqual(finalizeRefusalInventory(future, future, futureReport.names), {
            source: future,
            runtime: future,
            union: future,
            enumerated: future
        });
        assert.throws(() => finalizeRefusalInventory(future, future, discovered),
            /_cFutureRefused/, 'the live report finalizer accepted an omitted future bucket');
        assert.throws(() => enumerateRuntimeRefusals({_cFutureRefused: 'not an array'}, discovered),
            /_cFutureRefused must be undefined or an array/,
            'a malformed future bucket was silently treated as empty');

        const {default: SB3Creator} = await import(new URL(
            '../overlay/scratch-gui/src/lib/sb3-creator.js', import.meta.url));
        const minimal = [
            'DEVICE i8086',
            'PIN led = P1.0 OUTPUT',
            'WHEN flag clicked:',
            '  print "Yes"'
        ].join('\n');
        const result = analyzeProgram(SB3Creator, minimal, discovered);
        assert.equal(result.outcome, 'deviceC');
        assert.deepEqual(discoverRuntimeRefusalBuckets(Object.assign({},
            Object.fromEntries(discovered.map(name => [name, []])))), discovered);
        assert.deepEqual(result.refusals._cPrintRefused, []);
        assert.ok(result.activeUses.includes('printText'));
    });

test('candidate deterministic integer RNG is inclusive, repeatable and normalises reversed bounds', () => {
    const draw = (seed, from, to, count) => {
        const values = [];
        let state = seed;
        for (let index = 0; index < count; index++) {
            const result = n2fRandomInt16(state, from, to);
            values.push(result.value);
            state = result.state;
        }
        return {values, state};
    };
    const forward = draw(N2F_RNG_SEED, 1, 8, 32);
    assert.deepEqual(forward, {
        values: [2, 4, 4, 4, 1, 2, 5, 7, 5, 1, 6, 1, 5, 4, 7, 3,
            4, 6, 5, 5, 8, 5, 5, 3, 8, 3, 1, 2, 4, 2, 8, 1],
        state: 7325
    });
    assert.deepEqual(draw(N2F_RNG_SEED, 1, 8, 32), forward, 'same seed changed trace');
    assert.deepEqual(draw(N2F_RNG_SEED, 8, 1, 32), forward, 'reversed bounds changed trace');
    assert.equal(forward.values.every(value => value >= 1 && value <= 8), true);
    assert.deepEqual([...new Set(forward.values)].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8]);

    const equal = n2fRandomInt16(N2F_RNG_SEED, -32768, -32768);
    assert.deepEqual(equal, {value: -32768, state: 13658, draws: 1});
    assert.deepEqual(n2fRandomInt16(N2F_RNG_SEED, 32767, 32767),
        {value: 32767, state: 13658, draws: 1});
    assert.deepEqual(n2fRandomInt16(N2F_RNG_SEED, -32768, 32767),
        {value: -19110, state: 13658, draws: 1});
    assert.deepEqual(n2fRandomInt16(N2F_RNG_SEED, 32767, -32768),
        {value: -19110, state: 13658, draws: 1});
    assert.deepEqual(n2fRandomInt16(3915, -2, 2),
        {value: -1, state: 13849, draws: 2},
        'rejection no longer consumes and advances through a second draw');
    assert.deepEqual(n2fRandomInt16(N2F_RNG_SEED, -32768, -32767),
        {value: -32768, state: 13658, draws: 1});
    assert.deepEqual(n2fRandomInt16(N2F_RNG_SEED, 32766, 32767),
        {value: 32766, state: 13658, draws: 1});
    assert.deepEqual(n2fRandomInt16(N2F_RNG_SEED, -1, 0),
        {value: -1, state: 13658, draws: 1});
    assert.deepEqual(n2fRandomInt16(N2F_RNG_SEED, 0, 1),
        {value: 0, state: 13658, draws: 1});
    assert.throws(() => n2fRandomInt16(0, -32769, 0), /signed 16 bits/);
    assert.throws(() => n2fRandomInt16(0, 0, 32768), /signed 16 bits/);
    assert.throws(() => n2fRandomInt16(0, 0.5, 1), /integer/);
});

test('hosted CI compile-backs every production DEVICE C body', {skip: !process.env.CI, timeout: 300000},
    async () => {
        const report = await measureN2f({examples, compile: true});
        // Lesson 56 is the one new distinct device body at c593574; hosted CI
        // compiles it in all four variants along with the prior 48.
        // 49 -> 57 at sb3-creator 0f14aedb (task B10): sb3-creator #49's eight
        // device-C programs. Three of them print literal text (idea-generator,
        // reaction-duel, sense-pir-alarm), so neutralising literals gives each a
        // second body: 46 -> 54 distinct per variant, 49 -> 60 across variants
        // (measured locally with CI=1; every body compiled, none failed).
        // 57 -> 62 at sb3-creator c9be966f (#151): the five former host-C
        // programs now generating device C; arduino-04-ascii-table prints
        // literal text, so it adds a neutralised body too (60 -> 65 across
        // variants, 54 -> 58 distinct per variant; measured locally with the
        // same SmallerC route, every body compiled).
        assert.equal(report.compile.baseline.compiled.length, 62);
        assert.deepEqual(report.compile.baseline.failed, []);
        assert.equal(report.compile.literalOnly.compiled.length, 62);
        assert.deepEqual(report.compile.literalOnly.failed, []);
        assert.equal(report.compile.randomOnly.compiled.length, 62);
        assert.deepEqual(report.compile.randomOnly.failed, []);
        assert.equal(report.compile.randomAndLiteral.compiled.length, 62);
        assert.deepEqual(report.compile.randomAndLiteral.failed, []);
        assert.equal(report.compile.uniqueDeviceBodies, 65,
            'lesson 56 adds one body; crystal-ball, three #49 literal-print programs and ascii-table each add a neutralised body');
        assert.deepEqual(report.compile.bodyDelta, {
            baselineDistinct: 58,
            completeDistinct: 58,
            addedPrograms: ['arduino-04-ascii-table', 'arduino-sk-p11-crystal-ball', 'idea-generator', 'reaction-duel', 'sense-pir-alarm'],
            removedPrograms: ['arduino-04-ascii-table', 'arduino-sk-p11-crystal-ball', 'idea-generator', 'reaction-duel', 'sense-pir-alarm']
        }, 'neutralising both released features did not replace exactly the ascii-table, crystal-ball and #49 literal-print bodies');
    });
