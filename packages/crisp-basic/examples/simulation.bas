REM Deterministic logical pins; no circuit solver or physical hardware.
PROCpinMode(0, "output")
PROCpinMode(1, "input-pullup")
PROCdigitalWrite(0, 1)
PRINT "Before: " + STR$(FNdigitalRead(1))
PROCdelay(25)
PRINT "After: " + STR$(FNdigitalRead(1)) + " at " + STR$(FNmillis) + " ms"
PROCdigitalWrite(0, 0)
END
