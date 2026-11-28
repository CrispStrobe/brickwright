REM Open the saved Scout encoder project and connect BASIC to Circuit + CAD.
REM The electrical clock is exact; mechanics consumes one impulse every 5 ms.
PROCpinMode(5, "output")
PROCpinMode(6, "output")
PROCpinMode(8, "output")
PROCpinMode(9, "output")
PROCpinMode(10, "output")
PROCpinMode(11, "output")
PROCpinMode(2, "input")
PROCpinMode(3, "input")
PROCdigitalWrite(8, 1)
PROCdigitalWrite(9, 0)
PROCdigitalWrite(10, 1)
PROCdigitalWrite(11, 0)
PROCdigitalWrite(5, 1)
PROCdigitalWrite(6, 1)
PROCdelay(2)
PROCdelay(3)
PROCdelay(200)
PRINT "Elapsed ms: "; FNmillis
PRINT "Encoder: "; FNdigitalRead(2)
END
