import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {compileSource, CompileError} from '../src/compiler/index.mjs';

const forbidden = [
    ['EVAL', 'PRINT EVAL("1+2")'],
    ['inline assembler', '[ OPT 2 : mov eax,1 ]'],
    ['word indirection', 'PRINT !address%'],
    ['byte indirection', 'PRINT ?address%'],
    ['string indirection', 'PRINT $address%'],
    ['memory DIM', 'DIM memory% 100'],
    ['SYS', 'SYS "system","echo hello"'],
    ['OSCLI', 'OSCLI "dir"'],
    ['star OS command', '*HELP'],
    ['CALL', 'CALL address%'],
    ['USR', 'PRINT USR(address%)'],
    ['dynamic library', 'LIBRARY "more.bbc"'],
    ['dynamic program', 'CHAIN "next.bbc"']
];
for (const [name, statement] of forbidden) {
    test(`compiler refuses ${name} with the original physical and BASIC line`, () => {
        assert.throws(
            () => compileSource(`10 REM header\n\n120 ${statement}\n`, {filename: 'refused.bas'}),
            (error) => {
                assert.ok(error instanceof CompileError);
                assert.equal(error.filename, 'refused.bas');
                assert.equal(error.line, 3);
                assert.equal(error.basicLine, 120);
                assert.ok(error.column >= 1);
                assert.equal(error.diagnostics[0].severity, 'error');
                assert.match(error.message, /refused\.bas:3:/);
                return true;
            }
        );
    });
}

test('forbidden spellings in comments and strings are ordinary data', () => {
    const result = compileSource('REM EVAL SYS [ ! ? $\nPRINT "EVAL";"SYS";"[";"!";"ELSE";"+"\nEND\n');
    assert.equal(result.diagnostics.length, 0);
    assert.equal(result.metadata.interpreterEmbedded, false);
    assert.equal(result.metadata.independentImplementation, true);
    assert.match(result.c, /int main\(void\)/);
});

test('unsupported syntax is not silently deleted or handed to GCC', () => {
    for (const source of [
        'PRINT "start"\nDEF PROCfoo\nENDPROC\n',
        'IF FALSE THEN END\nDEF PROCfoo\nENDPROC\n',
        'STOP\n',
        'END\nDEF PROCfoo=1\n',
        'FOR i%=1 TO 2\nNEXT i%,j%\n',
        'PROCmissing\nEND\n',
        'PRINT FNmissing(1)\nEND\n',
        'PRINT MID$("a")\nEND\n',
        'EXIT FOR\n',
        'LOCAL x%\n',
        'ON ERROR PRINT "handled"\n',
        'GOTO 10\n'
    ])
        assert.throws(() => compileSource(source), CompileError, source);
});

test('full lexical pass diagnoses even unreachable unsupported features', () => {
    assert.throws(() => compileSource('END\nSYS "dangerous"\n'), CompileError);
});

test('multiple NEXT variables close the matching nested FOR loops', () => {
    const source = 'FOR i%=1 TO 2\nFOR j%=1 TO 3\nPRINT i%;j%\nNEXT j%,i%\nEND\n';
    assert.doesNotThrow(() => compileSource(source));
    assert.throws(() => compileSource(source.replace('NEXT j%,i%', 'NEXT i%,j%')), /NEXT must match/);
});

test('dynamic LOCAL arrays and scalar bindings emit cleanup for function results', () => {
    const result = compileSource(
        'PRINT FNsum(3)\nEND\nDEF FNsum(n%)\nLOCAL a%(),i%,s%\nDIM a%(n%)\nFOR i%=0 TO n%\na%(i%)=i%\ns%+=a%(i%)\nNEXT\n=s%\n'
    );
    assert.equal(result.metadata.arrays, 1);
    assert.match(result.c, /cb_local_array\(&cb_scope/);
    assert.match(result.c, /cb_capture\(&cb_parameters_/);
});

test('binary64 profile is explicit, browser safe and rejects wide integer variables', () => {
    const result = compileSource('a=1/3\nPRINT a\nEND\n', {numericProfile: 'binary64'});
    assert.equal(result.metadata.numericProfile, 'binary64');
    assert.match(result.c, /#define CB_REAL_BINARY64 1/);
    assert.match(result.c, /typedef double cb_real/);
    for (const target of ['pico', 'arduino-uno']) {
        assert.equal(compileSource('END\n', {target}).metadata.numericProfile, 'binary64');
        assert.throws(
            () => compileSource('a%%=1\nEND\n', {target}),
            (error) => error.code === 'target-precision' && error.line === 1
        );
    }
    assert.throws(() => compileSource('END', {numericProfile: 'guess'}), /unknown numeric profile/);
});

test('emitted binary64 C refuses an incompatible floating format at C compilation', async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'crisp-binary64-guard-'));
    t.after(() => rm(directory, {recursive: true, force: true}));
    const program = join(directory, 'program.c');
    const executable = join(directory, 'program');
    await writeFile(program, compileSource('PRINT 1.25\nEND\n', {numericProfile: 'binary64'}).c);
    const compiler = process.env.CRISP_BASIC_C99_CC || 'gcc';
    const build = (args) => spawnSync(compiler, ['-std=c99', '-pedantic-errors', ...args], {
        encoding: 'utf8', timeout: 30000
    });
    const compatible = build([program, '-lm', '-o', executable]);
    assert.ifError(compatible.error);
    assert.equal(compatible.status, 0, compatible.stderr);
    const run = spawnSync(executable, [], {encoding: 'latin1', timeout: 5000});
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stdout, '      1.25\r\n');

    // Exercise the emitted C guard through the real compiler. A deliberately
    // incompatible float.h models toolchains that ignore a requested ABI flag;
    // no AVR cross compiler is needed for this regression on each CI host.
    const headers = join(directory, 'headers');
    await mkdir(headers);
    const binary64 = {FLT_RADIX: 2, DBL_MANT_DIG: 53, DBL_MIN_EXP: -1021, DBL_MAX_EXP: 1024};
    for (const [field, value] of Object.entries({FLT_RADIX: 10, DBL_MANT_DIG: 24, DBL_MIN_EXP: -125, DBL_MAX_EXP: 128})) {
        const profile = {...binary64, [field]: value};
        await writeFile(join(headers, 'float.h'), Object.entries(profile).map(([key, number]) => `#define ${key} ${number}\n`).join(''));
        const rejected = build(['-I', headers, '-fsyntax-only', program]);
        assert.ifError(rejected.error);
        assert.notEqual(rejected.status, 0, `${field}=${value} must not compile silently`);
        assert.match(rejected.stderr, /CrispBASIC binary64 profile requires IEEE binary64 double/);
    }
});

test('source mapping and compiler output are deterministic', () => {
    const source = '100 x%=2\n\n200 PRINT x%\n300 END\n';
    const first = compileSource(source, {filename: 'source.bas'});
    assert.equal(first.c, compileSource(source, {filename: 'source.bas'}).c);
    assert.deepEqual(first.sourceMap, {100: 1, 200: 3, 300: 4});
});

test('reentrant INPUT inside a target subscript is diagnosed before emitting C', () => {
    const source =
        'DIM a%(0)\nINPUT "outer" a%(FNindex)\nEND\nDEF FNindex\nPROCread\n=0\nDEF PROCread\nINPUT "inner" s$\nENDPROC\n';
    assert.throws(
        () => compileSource(source),
        (error) => error.code === 'reentrant-input' && error.line === 2
    );
    assert.doesNotThrow(() => compileSource(source.replace('INPUT "inner" s$', 's$=""')));
});
