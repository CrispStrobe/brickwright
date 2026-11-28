REM @bw device arduino-uno
REM @bw pin led D13 output
REM Numeric procedures and explicit simulation time survive pseudocode round trips.
PROCpinMode(13,"output")
PROCpulse(0.0015)
PROCpulse(0.0025)
PRINT FNmillis
END
DEF PROCpulse(seconds)
PROCdigitalWrite(13,1)
IF seconds<0 OR seconds>2147483.647 THEN ERROR 204,"CrispBASIC wait seconds outside 0..2147483.647"
PROCdelay(INT(seconds*1000+0.5))
PROCdigitalWrite(13,0)
ENDPROC
