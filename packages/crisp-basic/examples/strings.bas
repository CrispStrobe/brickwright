REM String functions use the interpreter's byte-oriented Latin-1 character set.
word$ = "CrispBASIC"
PRINT LEFT$(word$, 5)
PRINT MID$(word$, 6)
PRINT LEN(word$)
PRINT STRING$(3, "Hi! ")
END
