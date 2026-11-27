// Fixed expected anchors shared by the native and WASM execution tests.
// Agreement between builds of this same core is compatibility evidence, not
// an independent BBC BASIC language implementation oracle.
export const corpus = [
    {
        name: 'structured loops, procedures, functions, arrays and strings',
        source: `DIM values%(4)
FOR i% = 0 TO 4
    values%(i%) = i% * i%
NEXT
total% = 0
i% = 0
WHILE i% <= 4
    total% += values%(i%)
    i% += 1
ENDWHILE
REPEAT
    total% -= 1
UNTIL total% = 28
IF total% = 28 THEN
    PROCemit("ok")
ELSE
    PROCemit("wrong")
ENDIF
PRINT STR$(FNdouble(total%))
END
DEF PROCemit(value$)
    LOCAL decorated$
    decorated$ = LEFT$(value$, 1) + RIGHT$(value$, 1)
    PRINT decorated$
ENDPROC
DEF FNdouble(value%) = value% * 2
`,
        text: 'ok\r\n56\r\n'
    },
    {
        name: 'numbered source and real tokenization',
        source: '10PRINT "compact"\n20\n30\tvalue%\t= 7\n40PRINT STR$(value%)\n50END\n',
        text: 'compact\r\n7\r\n'
    },
    {
        name: 'Latin-1 string bytes',
        source: 'PRINT "Grüße £éÿ"\nEND\n',
        text: 'Grüße £éÿ\r\n'
    },
    {
        name: 'nested function stack and local scope',
        source: `PRINT STR$(FNfactorial(7))
END
DEF FNfactorial(n%)
IF n% <= 1 THEN =1
= n% * FNfactorial(n%-1)
`,
        text: '5040\r\n'
    },
    {
        name: 'DATA, READ and RESTORE',
        source: `READ label$, number%
PRINT label$ + STR$(number%)
RESTORE
READ again$
PRINT again$
END
DATA "value:",42
`,
        text: 'value:42\r\nvalue:\r\n'
    },
    {
        name: 'fixed line input and byte input',
        source: 'INPUT "" name$\nPRINT "hello " + name$\nPRINT STR$(GET)\nEND\n',
        input: 'Ada\nx',
        text: '\r\nhello Ada\r\n120\r\n'
    },
    {
        name: 'raw VDU bytes',
        source: 'VDU 22,8,25,69,0,1,128,255\nEND\n',
        bytes: [22, 8, 25, 69, 0, 1, 128, 255]
    },
    {
        name: 'handled BASIC errors',
        source: 'ON ERROR PRINT "handled" : END\nERROR 100, "deliberate"\n',
        text: 'handled\r\n'
    },
    {
        name: 'explicit program exit',
        source: 'PRINT "leaving"\nQUIT 7\nPRINT "unreachable"\n',
        text: 'leaving\r\n',
        exitCode: 7
    },
    {name: 'empty source', source: '', text: ''}
];
