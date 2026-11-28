REM Loops, a structured conditional, arrays and a procedure.
DIM squares%(5)
FOR index% = 1 TO 5
    squares%(index%) = index% * index%
NEXT index%

total% = 0
index% = 1
WHILE index% <= 5
    total% += squares%(index%)
    index% += 1
ENDWHILE

IF total% = 55 THEN
    PROCmessage("The sum of the first five squares is 55.")
ELSE
    PROCmessage("Unexpected result.")
ENDIF

count% = 3
REPEAT
    PRINT count%
    count% -= 1
UNTIL count% = 0
END

DEF PROCmessage(text$)
    PRINT text$
ENDPROC
