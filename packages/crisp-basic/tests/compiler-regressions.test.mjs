// Regressions discovered by independently executing edge cases in BBCSDL.
// Expected program bytes always come from the interpreter, not from compiler
// internals. Refused syntax must fail before invoking a C compiler.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import test from 'node:test';
import {createNativeSession} from '../index.mjs';
import {CompileError, compileSource} from '../src/compiler/index.mjs';
import {nativeOptions, target} from './native-test-target.mjs';
import {registerCompilerParity} from './compiler-parity-runner.mjs';
import {workspace, build, execute} from './compiler-regression-helpers.mjs';
import {registerCompilerNumericErrors} from './compiler-numeric-errors.mjs';

const fixtures = [
    {
        name: 'unary signs bind before exponentiation',
        source: `PRINT -2^2;(-2)^2;2^3^2
PRINT NOT 1=0;NOT 1+1;NOT -2^2
END
`
    },
    {
        name: 'predefined static integer variables and LOCAL restoration',
        source: `PRINT A%;M%;Z%
A%=9
PROCscope
PRINT A%
END
DEF PROCscope
LOCAL A%
PRINT A%
A%=10
ENDPROC
`
    },
    {
        name: 'signed radix literals and decimal leading zeroes',
        source: `PRINT &FFFFFFFF;&80000000;&FFFFFFFFFFFFFFFF
PRINT %11111111111111111111111111111111
PRINT 010;0012;08
END
`
    },
    {
        name: 'lowercase e remains a variable boundary',
        source: `e2=7
PRINT 1e2
PRINT 1E2
END
`
    },
    {
        name: 'large and negative shift counts',
        source: `PRINT 1<<32;1<<-1
PRINT -1>>32;-1>>>32;1<<31
END
`
    },
    {
        name: 'negative and wrapped substring bounds',
        source: `PRINT LEFT$("abc",-1);RIGHT$("abc",-1);MID$("abc",1,-1)
PRINT LEFT$("abc",4294967296);MID$("abc",4294967296,2)
PRINT LEFT$("abc");RIGHT$("abc");MID$("abc",0,2)
END
`
    },
    {
        name: 'keyword and punctuation strings do not become tokens',
        source: `PRINT "PRINT";"TIME";",";";";"ELSE";"REM";"EVAL";"[";"!";"SYS"
REM EVAL SYS OSCLI [ ] ! ? are harmless in a comment
END
`
    },
    {
        name: 'nested inline IF keeps the nearest ELSE',
        source: `IF 1 THEN IF 0 THEN PRINT "bad" ELSE PRINT "inner" ELSE PRINT "outer"
IF 0 THEN PRINT "bad" ELSE PRINT "yes":PRINT "tail"
END
`
    },
    {
        name: 'NEXT list closes the named nested loops',
        source: `FOR i%=1 TO 2
FOR j%=1 TO 2
PRINT i%;j%
NEXT j%,i%
END
`
    },
    {
        name: 'VAL does not inherit C radix or special-value syntax',
        source: `PRINT VAL("&FFFFFFFF");VAL("&80000000");VAL("-&FF");VAL("+&FF")
PRINT VAL("%11111111111111111111111111111111")
PRINT VAL("INF");VAL("NAN");VAL("infinity")
PRINT VAL("  -12.5e2junk");VAL("1e+");VAL("nothing")
PRINT VAL("1E2");VAL("1e2")
END
`
    },
    {
        name: 'INPUT preserves trailing whitespace in strings',
        source: `INPUT "" a$
PRINT "["+a$+"]"
END
`,
        input: '  hi  \n'
    },
    {
        name: 'INPUT unescapes doubled quotes',
        source: `INPUT "" a$,b$
PRINT "["+a$+"]["+b$+"]"
END
`,
        input: '"a""b",tail\n'
    },
    {
        name: 'empty and invalid numeric input retain BBC conversion',
        source: `INPUT "" a%
INPUT "" b%
PRINT a%;b%
END
`,
        input: 'oops\n\n'
    },
    {
        name: 'INSTR empty needle and wrapped start',
        source: `PRINT INSTR("abc","a",4294967296);INSTR("abc","",4294967296);INSTR("abc","",99)
PRINT INSTR("abc","a",0);INSTR("abc","b",-1)
END
`
    },
    {
        name: 'argument values are evaluated before formal binding',
        source: `x%=1
PROCfoo(2,x%)
PRINT x%
END
DEF PROCfoo(x%,y%)
PRINT x%;y%
ENDPROC
`
    },
    {
        name: 'formal globals are captured before argument side effects',
        source: `x%=10
PROCfoo(x%,FNset)
PRINT x%
END
DEF PROCfoo(x%,y%)
PRINT x%;y%
ENDPROC
DEF FNset
x%=20
=3
`
    },
    {
        name: 'compound assignment observes RHS side effects',
        source: `x%=10
x%+=FNset
PRINT x%
END
DEF FNset
x%=20
=3
`
    },
    {
        name: 'nested PRINT retains the caller formatting state',
        source: `PRINT FNp+1
PRINT ;FNp+1
END
DEF FNp
PRINT ;"x";
=2
`
    },
    {
        name: 'deterministic RND reseeding',
        source: `a%=RND(-123)
PRINT RND;RND;RND(1);RND(0);RND(10)
END
`
    },
    {
        name: 'function result retains a LOCAL string array element',
        source: `PRINT FNf$
END
DEF FNf$
LOCAL a$()
DIM a$(1)
a$(0)="local"
=a$(0)
`
    },
    {
        name: 'large decimal integer arithmetic',
        source: `PRINT 9007199254740993-9007199254740992
PRINT 9223372036854775807-9223372036854775806
PRINT 18446744073709551616
END
`
    },
    {
        name: 'CASE without a matching branch continues',
        source: `CASE 1 OF
WHEN 2: PRINT "bad"
ENDCASE
PRINT "after"
END
`
    }
];

function caseReturns(iterations) {
    return `FOR i%=1 TO ${iterations}
result$=FNselect("x")+FNexit("x")
NEXT
PRINT result$
END
DEF FNselect(s$)
CASE s$ OF
WHEN "x": ="yes"
OTHERWISE: ="other"
ENDCASE
="missing"
DEF FNexit(s$)
FOR j%=1 TO 1
CASE s$ OF
WHEN "x": EXIT FOR
ENDCASE
NEXT
="done"
`;
}
fixtures.push({name: 'string CASE permits early results and loop exits', source: caseReturns(25)});
registerCompilerParity({
    name: 'regression',
    createSession: () => createNativeSession(nativeOptions()),
    fixtures
});

const refusals = [
    {
        name: 'STOP cannot silently become END',
        source: '10 PRINT "before"\n200 STOP\n',
        line: 2,
        basicLine: 200,
        message: /STOP/
    },
    {
        name: 'execution cannot silently skip a definition',
        source: '10 PRINT "start"\n200 DEF PROCbad\n210 PRINT "body"\n220 ENDPROC\n',
        line: 2,
        basicLine: 200,
        message: /DEF.*END|definition/i
    },
    {
        name: 'PROC result is a source diagnostic',
        source: '10 PROCbad\n20 END\n200 DEF PROCbad=1\n',
        line: 3,
        basicLine: 200,
        message: /PROC.*return/
    },
    ...[
        ['EVAL', 'PRINT EVAL("1+1")'],
        ['inline assembler', '[ OPT 0 ]'],
        ['indirection', 'PRINT ?0'],
        ['raw memory DIM', 'DIM memory% 16'],
        ['dynamic variables', 'PRINT a%()'],
        ['OS calls', 'SYS "anything"'],
        ['OS commands', '*CAT']
    ].map(([name, statement]) => ({
        name,
        source: `10 REM regression\n200 ${statement}\n`,
        line: 2,
        basicLine: 200
    }))
];
for (const fixture of refusals) {
    test(`compiler source refusal: ${fixture.name}`, () => {
        assert.throws(
            () => compileSource(fixture.source, {filename: 'regression.bas'}),
            (error) => {
                assert.ok(error instanceof CompileError);
                assert.equal(error.filename, 'regression.bas');
                assert.equal(error.line, fixture.line);
                assert.equal(error.basicLine, fixture.basicLine);
                assert.ok(error.column >= 1);
                assert.equal(error.diagnostics[0].severity, 'error');
                if (fixture.message) assert.match(error.message, fixture.message);
                return true;
            }
        );
    });
}


for (const statement of [
    'PRINT ~2147483648',
    'PRINT STR$~(-2147483649)',
    'PRINT ~4294967296',
    'PRINT STR$~(4294967296)',
    'PRINT SQR(-1)',
    'PRINT RND2',
    'DIM a%(1):DIM a%(2)'
]) {
    test(`compiled runtime keeps an interpreter failure: ${statement}`, async (t) => {
        const directory = await workspace(t);
        const source = `PRINT "before"\n${statement}\nPRINT "unreachable"\nEND\n`;
        const session = createNativeSession(nativeOptions());
        t.after(() => session.dispose());
        const reference = await session.run(source);
        assert.equal(reference.status, 'error');
        const result = await execute(await build(directory, source));
        assert.equal(result.status, reference.exitCode);
        assert.deepEqual(result.stdout, Buffer.from(reference.output));
        assert.match(result.stderr.toString(), /BASIC line 2:/);
    });
}

test('string CASE returns and exits retain a bounded number of heap allocations', async (t) => {
    const directory = await workspace(t);
    const allocator = join(directory, 'allocation-count.c');
    // Link-level instrumentation counts the generated program's allocations.
    // Compare one run with many calls so intentionally live globals need not
    // be confused with leaked CASE temporaries or captured parameter frames.
    await writeFile(
        allocator,
        `#include <stdio.h>
#include <stdlib.h>
static long live;
void *__real_malloc(size_t);
void __real_free(void *);
void *__real_realloc(void *,size_t);
void *__wrap_malloc(size_t n){void *p=__real_malloc(n);if(p)live++;return p;}
void __wrap_free(void *p){if(p)live--;__real_free(p);}
void *__wrap_realloc(void *p,size_t n){void *q=__real_realloc(p,n);if(!p&&q)live++;else if(p&&!n&&!q)live--;return q;}
static void report(void){fprintf(stderr,"LIVE_ALLOCATIONS=%ld\\n",live);}
__attribute__((constructor)) static void initialize(void){atexit(report);}
`
    );
    const counts = [];
    for (const iterations of [1, 500]) {
        const binary = await build(directory, caseReturns(iterations), [
            allocator,
            '-Wl,--wrap=malloc',
            '-Wl,--wrap=free',
            '-Wl,--wrap=realloc'
        ]);
        const result = await execute(binary);
        assert.equal(result.status, 0, result.stderr.toString());
        assert.equal(result.stdout.toString('latin1'), 'yesdone\r\n');
        const match = /^LIVE_ALLOCATIONS=(\d+)\n$/.exec(result.stderr.toString());
        assert.ok(match, result.stderr.toString());
        counts.push(Number(match[1]));
    }
    assert.equal(counts[1], counts[0], 'completed calls must release CASE selectors and parameter frames');
});

registerCompilerNumericErrors({
    name: 'native',
    createSession: () => createNativeSession(nativeOptions()),
    saturatingIntegerConversions: target.name === 'linux-arm64',
    armv7Native: target.name === 'linux-armv7'
});
