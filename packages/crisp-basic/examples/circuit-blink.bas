REM In Brickwright choose BBC BASIC, CrispBASIC, and Connect Circuit.
REM The active Circuit must contain one supported Uno or Nano board.
REM Connect D13 through a resistor and LED to GND in the same Circuit.
PROCpinMode(13, "output")
FOR pulse% = 1 TO 4
  PROCdigitalWrite(13, 1)
  PROCdelay(250)
  PROCdigitalWrite(13, 0)
  PROCdelay(250)
NEXT
PRINT "Simulated " + STR$(FNmillis) + " ms"
END
