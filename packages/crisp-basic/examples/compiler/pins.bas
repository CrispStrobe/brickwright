REM Same portable pin program for the interpreter and compiled MCU images.
PROCpinMode(13,"output")
PROCdigitalWrite(13,1)
PROCdelay(10)
PROCdigitalWrite(13,0)
PROCdelay(5)
PROCdigitalToggle(13)
END
