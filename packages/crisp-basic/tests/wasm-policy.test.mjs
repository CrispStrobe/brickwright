import assert from 'node:assert/strict';
import test from 'node:test';
import {createWasmSession} from '../src/wasm-session.mjs';

function sessionFor(t) {
    const session = createWasmSession();
    t.after(() => session.dispose());
    return session;
}

async function denied(t, program, message) {
    const session = sessionFor(t);
    const result = await session.run(program + '\nEND\n', {filename: 'restricted.bas'});
    assert.equal(result.status, 'error', JSON.stringify(result));
    assert.equal(result.error.kind, 'basic');
    assert.equal(result.error.code, 255, JSON.stringify(result.error));
    assert.equal(result.error.filename, 'restricted.bas');
    assert.match(result.error.message, message);
    assert.ok(result.error.line >= 1);
    assert.equal(result.exitCode, 1);
}

test('restricted WASM refuses every native call and OS command entry point', async t => {
    const cases = [
        ['named SYS', 'SYS "system", "not-executed"', /SYS/],
        ['numeric SYS', 'SYS 1', /SYS/],
        ['SYS address expression', 'PRINT SYS "system"', /SYS/],
        ['ON SYS event', 'ON SYS PROCevent\nEND\nDEF PROCevent\nENDPROC', /SYS/],
        ['CALL numeric address', 'CALL 1', /CALL/],
        ['CALL string module', 'CALL "module"', /CALL/],
        ['USR numeric address', 'PRINT USR 1', /USR/],
        ['USR emulated OS address', 'PRINT USR &FFF4', /USR/],
        ['OSCLI string', 'OSCLI "RUN program"', /OSCLI/],
        ['star command', '*RUN program', /OSCLI/],
        ['inline assembler', '[\nOPT 0\n]', /Assembler/]
    ];
    for (const [name, source, message] of cases) await t.test(name, t => denied(t, source, message));
});

test('restricted WASM has no ambient or virtual file access', async t => {
    const cases = [
        ['OPENIN', 'PRINT OPENIN("/etc/passwd")'],
        ['OPENOUT', 'PRINT OPENOUT("output.txt")'],
        ['OPENUP', 'PRINT OPENUP("output.txt")'],
        ['BGET', 'PRINT BGET#1'],
        ['BPUT', 'BPUT#1, 65'],
        ['PRINT#', 'PRINT#1, "data"'],
        ['INPUT#', 'INPUT#1, value$'],
        ['CLOSE#', 'CLOSE#1'],
        ['CLOSE#0', 'CLOSE#0'],
        ['PTR# read', 'PRINT PTR#1'],
        ['PTR# write', 'PTR#1 = 0'],
        ['EXT# read', 'PRINT EXT#1'],
        ['EXT# write', 'EXT#1 = 0'],
        ['EOF#', 'PRINT EOF#1'],
        ['CHAIN', 'CHAIN "program.bbc"'],
        ['RUN file', 'RUN "program.bbc"'],
        ['INSTALL', 'INSTALL "library.bbc"', /Memory resizing/]
    ];
    for (const [name, source, message = /File I\/O/] of cases) await t.test(name, t => denied(t, source, message));
});

test('restricted WASM refuses memory and pointer operations at execution time', async t => {
    const cases = [
        ['prefix byte read', 'PRINT ?65536', /Memory indirection/],
        ['prefix byte write into internal low memory', '?0 = 65', /Memory indirection/],
        ['prefix integer read', 'PRINT !65536', /Memory indirection/],
        ['prefix integer write', '!0 = 65', /Memory indirection/],
        ['prefix floating read', 'PRINT |65536', /Memory indirection/],
        ['prefix 64-bit read', 'PRINT ]65536', /Memory indirection/],
        ['CR-terminated indirect string', 'PRINT $65536', /Memory indirection/],
        ['NUL-terminated indirect string', 'PRINT $$65536', /Memory indirection/],
        ['infix byte read', 'address% = 65536\nPRINT address%?0', /Memory indirection/],
        ['infix byte write', 'address% = 0\naddress%?0 = 65', /Memory indirection/],
        ['infix integer read', 'address% = 65536\nPRINT address%!0', /Memory indirection/],
        ['infix integer write', 'address% = 0\naddress%!0 = 65', /Memory indirection/],
        ['address-of', 'value% = 1\nPRINT ^value%', /Address-of/],
        ['PTR string read', 'value$ = "data"\nPRINT PTR(value$)', /Pointer queries/],
        ['PTR string assignment', 'value$ = "data"\nPTR(value$) = 0', /Pointer assignment/],
        ['PTR array assignment', 'DIM values%(1)\nPTR(values%()) = 0', /Pointer assignment/],
        ['PTR structure assignment', 'DIM point{x%,y%}\nPTR(point{}) = 0', /Pointer assignment/],
        ['PAGE assignment', 'PAGE = 0', /Changing PAGE/],
        ['LOMEM assignment', 'LOMEM = 0', /Changing LOMEM/],
        ['HIMEM assignment', 'HIMEM = 0', /Changing HIMEM/],
        ['indirect PROC', 'PROC(65536)', /Indirect FN\/PROC/],
        ['indirect FN', 'PRINT FN(65536)', /Indirect FN\/PROC/],
        ['function pointer assignment', 'PRINT FNvalue\nLET FNvalue = 65536\nEND\nDEF FNvalue = 1', /Function pointer/],
        ['host system variable read', 'PRINT @platform%', /System variables/],
        ['host system variable write', '@flags% = 0', /System variables/],
        ['exposed function table', 'PRINT @fn%(0)', /System variables/]
    ];
    for (const [name, source, message] of cases) await t.test(name, t => denied(t, source, message));
});

test('EVAL cannot bypass restricted operation guards', async t => {
    for (const expression of ['USR 1', '?65536', '!65536', '$65536', '@platform%', 'SYS "system"']) {
        const quoted = expression.replaceAll('"', '""');
        await t.test(expression, t => denied(t, 'PRINT EVAL("' + quoted + '")', /not available/));
    }
});

test('EVAL rejects constructed internal tokens while preserving Latin-1 literal data', async t => {
    const session = sessionFor(t);
    for (const token of [25, 26, 27, 28, 29, 30, 31, 164, 186]) {
        const result = await session.run(`PRINT EVAL(CHR$(${token})+CHR$(255)+CHR$(255))`);
        assert.equal(result.status, 'error', JSON.stringify(result));
        assert.equal(result.error.code, 255);
        assert.match(result.error.message, /EVAL requires text source/);
    }
    const literals = await session.run('PRINT EVAL("""café""")\nPRINT EVAL(CHR$(34)+CHR$(186)+CHR$(34))\nPRINT EVAL("1"+CHR$(9)+"+"+CHR$(9)+"2")\n');
    assert.equal(literals.status, 'completed', JSON.stringify(literals.error));
    assert.equal(literals.text, 'café\r\nº\r\n         3\r\n');
});

test('unsupported host event traps fail explicitly without changing computed ON branches', async t => {
    for (const event of ['TIME', 'CLOSE', 'MOVE', 'MOUSE']) {
        await t.test('ON ' + event, t => denied(t, 'ON ' + event + ' PROCevent\nEND\nDEF PROCevent\nENDPROC', /Host event handlers/));
        await t.test('ON ' + event + ' OFF', t => denied(t, 'ON ' + event + ' OFF', /Host event handlers/));
    }
    const session = sessionFor(t);
    const result = await session.run('10 ON 2 GOTO 100,200\n20 END\n100 PRINT "wrong":END\n200 ON 1 GOSUB 300\n210 PRINT "dispatch":END\n300 PRINT "sub":RETURN\n');
    assert.equal(result.status, 'completed', JSON.stringify(result.error));
    assert.equal(result.text, 'sub\r\ndispatch\r\n');
});

test('unsupported screen, audio and wall-clock queries are explicit BASIC errors', async t => {
    const cases = [
        ['TIME$', 'PRINT TIME$', /TIME\$/],
        ['SOUND', 'SOUND 1,-15,100,10', /SOUND/],
        ['SOUND OFF', 'SOUND OFF', /SOUND/],
        ['ENVELOPE', 'ENVELOPE 1,1,0,0,0,0,0,0,0,0,0,0,0,0', /ENVELOPE/],
        ['MOUSE', 'MOUSE x%,y%,buttons%', /MOUSE/],
        ['MOUSE ON', 'MOUSE ON', /MOUSE/],
        ['ADVAL', 'PRINT ADVAL(1)', /ADVAL/],
        ['POINT', 'PRINT POINT(0,0)', /Graphics queries/],
        ['TINT', 'PRINT TINT(0,0)', /Graphics queries/],
        ['WIDTH of string', 'PRINT WIDTH("hello")', /Graphics queries/],
        ['screen character', 'PRINT GET(0,0)', /Screen queries/]
    ];
    for (const [name, source, message] of cases) await t.test(name, t => denied(t, source, message));
});

test('restricted errors retain ON ERROR semantics and original source locations', async t => {
    const session = sessionFor(t);
    const unhandled = await session.run('100 REM first\n\n450 SYS 1\n', {filename: 'guarded.bas'});
    assert.equal(unhandled.status, 'error');
    assert.equal(unhandled.error.code, 255);
    assert.equal(unhandled.error.filename, 'guarded.bas');
    assert.equal(unhandled.error.basicLine, 450);
    assert.equal(unhandled.error.line, 3);

    const handled = await session.run('ON ERROR PRINT "blocked:"+STR$(ERR):END\nSYS "system"\nPRINT "unreachable"\n');
    assert.equal(handled.status, 'completed', JSON.stringify(handled.error));
    assert.equal(handled.text, 'blocked:255\r\n');
    assert.equal(handled.error, undefined);
});

test('ordinary arrays, structures, function calls, exponentiation and formatting remain usable', async t => {
    const session = sessionFor(t);
    const result = await session.run(`DIM values%(2)
DIM point{x%,y%}
values%(0) = 5
values%(1) = 7
values%(2) = 11
point.x% = values%(0) + values%(1)
point.y% = values%(2)
@% = &90A
PRINT STR$(point.x%)+","+STR$(point.y%)
PRINT STR$(2^3)
PROCemit(FNdouble(point.x%))
END
DEF PROCemit(value%)
LOCAL text$
text$ = STR$(value%)
PRINT text$
ENDPROC
DEF FNdouble(value%) = value% * 2
`);
    assert.equal(result.status, 'completed', JSON.stringify(result.error));
    assert.equal(result.text, '12,11\r\n8\r\n24\r\n');
});
