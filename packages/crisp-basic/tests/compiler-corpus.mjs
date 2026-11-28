// Inputs for the independent C99-vs-BBCSDL differential gate. Expected bytes
// come from BBCSDL at test time; the compiler never consumes interpreter code.
export const compilerCorpus = [
    {
        name: 'default numeric storage preserves exact integer values',
        source: `a=9007199254740993
PRINT a-9007199254740992
DIM values(1)
values(1)=VAL("9007199254740993")
PRINT values(1)-9007199254740992
PRINT FNdelta(a)
PROCscope
PRINT a-9007199254740992
END
DEF FNdelta(x)=x-9007199254740992
DEF PROCscope
LOCAL a
a=VAL("9007199254740995")
PRINT a-9007199254740992
ENDPROC
`
    },
    {
        name: 'VAL preserves exact integer tags and explicit real syntax',
        source: `PRINT VAL("9007199254740993")-9007199254740992
PRINT VAL("+0009007199254740993suffix")-9007199254740992
PRINT VAL("9007199254740993.0")-9007199254740992
PRINT VAL("9007199254740993E")-9007199254740992
PRINT VAL("9007199254740993e0")-9007199254740992
PRINT VAL("9223372036854775807")-9223372036854775806
PRINT VAL("-9223372036854775808")+9223372036854775807
PRINT VAL("18446744073709551616")=18446744073709551616
END
`
    },
    {
        name: 'decimal source and VAL share BBC digit scaling and exponent conversion',
        source: `PRINT 1E4294967296;VAL("1E4294967296");1E2147483648;VAL("1E-2147483648")
PRINT 0.100000000000000005551115123125782702;VAL("0.100000000000000005551115123125782702")
PRINT 1.7E308;VAL("1.7E308");1E-308;VAL("1E-308")
PRINT 5E-324;VAL("5E-324");VAL("000.125E2")
END
`
    },
    {
        name: 'scalar types and numeric print fields',
        source: `i%=42
x=1.25
s$="hello"
PRINT i%;x;s$
PRINT -12;0;123456789
PRINT STR$(i%)+":"+STR$(x)
END
`
    },
    {
        name: 'integer arithmetic and signed division',
        source: `a%=-17
b%=5
PRINT a% DIV b%;a% MOD b%;a% AND 255;a% OR 16;a% EOR 7
PRINT NOT 0;NOT -1;TRUE;FALSE
PRINT 7/2;2^3^2;INT(-1.2)
END
`
    },
    {
        name: 'FOR WHILE REPEAT and CASE',
        source: `total%=0
FOR i%=1 TO 5
  total%+=i%
NEXT i%
FOR j%=3 TO 1 STEP -1
  total%+=j%
NEXT
WHILE total%>18
  total%-=1
ENDWHILE
REPEAT
  total%+=1
UNTIL total%=20
CASE total% OF
WHEN 1,2: PRINT "bad"
WHEN 20
  PRINT "twenty"
OTHERWISE
  PRINT "bad-default"
ENDCASE
PRINT total%;i%;j%
END
`
    },
    {
        name: 'FOR post-test entry and evaluated bounds',
        source: `limit%=3
FOR i%=1 TO limit%
  limit%=0
  PRINT i%;
NEXT
PRINT
FOR i%=5 TO 1
  PRINT i%
NEXT
END
`
    },
    {
        name: 'nested block and inline conditionals',
        source: `FOR i%=0 TO 3
IF i%=1 THEN PRINT "one" ELSE PRINT STR$(i%)
IF i%<2 THEN
  IF i%=0 THEN
    PRINT "zero"
  ELSE
    PRINT "other"
  ENDIF
ELSE
  PRINT "large"
ENDIF
NEXT
END
`
    },
    {
        name: 'dynamic LOCAL and parameter restoration',
        source: `x%=91
a$="global"
PROCouter(7)
PRINT x%;a$
END
DEF PROCouter(x%)
LOCAL a$,z%
a$="outer"
PRINT x%;z%;a$
PROCinner
ENDPROC
DEF PROCinner
PRINT x%;a$
ENDPROC
`
    },
    {
        name: 'recursive functions and string returns',
        source: `PRINT FNfactorial(7)
PRINT FNdecorate("abc")
END
DEF FNfactorial(n%)
IF n%<=1 THEN =1
=n%*FNfactorial(n%-1)
DEF FNdecorate(s$)
LOCAL t$
t$="["+s$+"]"
=t$
`
    },
    {
        name: 'left to right effects and CASE evaluates once',
        source: `n%=0
PRINT FNnext+FNnext
CASE FNnext OF
WHEN 3: PRINT "three"
OTHERWISE: PRINT "wrong"
ENDCASE
PRINT n%
END
DEF FNnext
n%+=1
=n%
`
    },
    {
        name: 'multidimensional arrays and inclusive bounds',
        source: `DIM a%(2,3),b(1),s$(2)
FOR i%=0 TO 2
FOR j%=0 TO 3
  a%(i%,j%)=i%*10+j%
NEXT j%
s$(i%)=STR$(a%(i%,3))
NEXT i%
b(0)=1.5:b(1)=-0.25
PRINT s$(0)+","+s$(1)+","+s$(2)
PRINT b(0)+b(1);a%(2,3)
END
`
    },
    {
        name: 'string bytes slicing search and conversion',
        source: `s$="Grüße £éÿ"
PRINT LEFT$(s$,2);RIGHT$(s$,2);MID$(s$,3,3)
PRINT LEN(s$);ASC("A");INSTR("banana","na");INSTR("banana","na",4)
PRINT STRING$(3,"ab");CHR$(0);CHR$(255)
PRINT LEN(CHR$(0)+"x");VAL("12.5");STR$(12.5)
END
`
    },
    {
        name: 'mathematical functions',
        source: `PRINT ABS(-7);SGN(-2);SGN(0);SGN(3);SQR(81)
PRINT SIN(0);COS(0);TAN(0);ASN(0);ACS(1);ATN(0)
PRINT EXP(0);LN(1);LOG(100);RAD(180);DEG(PI)
END
`
    },
    {
        name: 'TIME assignment and centiseconds',
        source: `TIME=123
PRINT TIME>=123;TIME<200
TIME=0
PRINT TIME<100
END
`
    },
    {
        name: 'line INPUT and numeric INPUT',
        source: `INPUT "" name$
INPUT "" age%
PRINT name$+":"+STR$(age%)
END
`,
        input: 'Ada\n37\n'
    },
    {
        name: 'INPUT LINE preserves commas',
        source: `INPUT LINE "" s$
PRINT s$
END
`,
        input: 'one,two,three\n'
    },
    {name: 'numbered compact source', source: '10PRINT "compact"\n20a%=7\n30PRINT STR$(a%)\n40END\n'},
    {
        name: 'embedded NUL string comparison',
        source: `a$="a"+CHR$(0)+"b"
b$="a"+CHR$(0)+"c"
PRINT LEN(a$);a$=b$;a$<b$
PRINT MID$(a$,2,2)
END
`
    },
    {name: 'empty program', source: ''},
    {
        name: 'seeded RND integer results and parameter conversion',
        source: `PRINT RND(-9)+9007199254740993-9007199254740992
a%=RND(-9):x%=RND
a%=RND(-9):PRINT (RND+9007199254740993-9007199254740992)-x%
a%=RND(-9):x%=RND(99)
a%=RND(-9):PRINT (RND(99)+9007199254740993-9007199254740992)-x%
a%=RND(-9):x=RND(1)
a%=RND(-9):PRINT RND(9007199254740993)-x
END
`
    },
    {
        name: 'signed zero retains numeric profile semantics',
        source: `PRINT -0.0;",";STR$(-0.0)
PRINT -(1.0-1.0);",";(-1E-300)*0.0;",";0.0*(-1E-300)
PRINT (-0.0)*-2;",";(-0.0)*0.0
x#=-0.0:PRINT x#;",";x#+9007199254740993-9007199254740992
PRINT STR$(0.0);",";STR$(-0.0)
END
`
    },
    {
        name: 'integer exponentiation preserves arithmetic tags and order',
        source: `PRINT 2^53+1-9007199254740992
PRINT (2^63)-9223372036854775807
PRINT 3^20;",";3^-7;",";3^0
PRINT (1^2147483647)+9007199254740993-9007199254740992
PRINT (1^-2147483648)+9007199254740993-9007199254740992
PRINT (1^2147483648)+9007199254740993-9007199254740992
PRINT (2^0.0)+9007199254740993-9007199254740992
END
`
    },
    {
        name: 'fresh numeric zeros and double storage normalization',
        source: `DIM a(1),b#(1)
PRINT a(0)+9007199254740993-9007199254740992
PRINT b#(0)+9007199254740993-9007199254740992
PROCzeros
x#=0.0:PRINT x#+9007199254740993-9007199254740992
x#=1E-314:PRINT x#
x#=2E-314:PRINT x#
x#=3E-314:PRINT x#
x#=5E-324:PRINT x#
x#=-5E-324:PRINT x#
x#=1E-308:PRINT x#
END
DEF PROCzeros
LOCAL a,b#
PRINT a+9007199254740993-9007199254740992
PRINT b#+9007199254740993-9007199254740992
ENDPROC
`
    },
    {
        name: 'integer results from builtins retain exact tags',
        source: `PRINT SGN(1)+9007199254740993-9007199254740992
PRINT LEN("a")+9007199254740993-9007199254740992
PRINT ASC("A")+9007199254740993-9007199254740992
PRINT ASC("")+9007199254740993-9007199254740992
PRINT INSTR("abc","z")+9007199254740993-9007199254740992
PRINT ABS(9007199254740993)-9007199254740992
PRINT ABS(-9007199254740993)-9007199254740992
PRINT ABS(-9223372036854775807-1)-9223372036854775807
PRINT INT(1.2)+9007199254740993-9007199254740992
PRINT INT(9007199254740993)-9007199254740992
PRINT INT(-9223372036854775807-1)+9223372036854775807
END
`
    },
    {
        name: 'shifts retain int64 intermediates and default result widths',
        source: `PRINT (1<<0)+9007199254740993-9007199254740992
PRINT 4294967296>>0;",";4294967296>>32;",";4294967296>>>0
PRINT -1>>63;",";-1>>64;",";-1>>>0;",";-1>>>32
PRINT 1<<32;",";1<<63;",";1<<64;",";1<<-1
PRINT 1<<-64;",";1<<-65;",";-1>>>-64
PRINT -4294967296>>32;",";-4294967296>>63
END
`
    },
    {
        name: 'integer assignment truncates in-range fractional boundaries',
        source: `a%=2147483647.9:b%=-2147483648.9
PRINT a%;",";b%
DIM n%(1)
n%(0)=2147483647.9:n%(1)=-2147483648.9
PRINT n%(0);",";n%(1)
END
`
    },
    {
        name: 'FOR exact positive and negative integer bounds terminate',
        source: `count%=0
FOR i=9007199254740992 TO 9007199254740992
PRINT i-9007199254740992
count%+=1
IF count%>3 THEN EXIT FOR
NEXT
PRINT count%
count%=0
FOR i=-9007199254740992 TO -9007199254740992 STEP -1
PRINT i+9007199254740992
count%+=1
IF count%>3 THEN EXIT FOR
NEXT
PRINT count%
END
`
    }
];
