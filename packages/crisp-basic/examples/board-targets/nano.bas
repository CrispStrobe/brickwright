REM classic Arduino Nano GPIO surface
REM Host-driven logical simulation: no native firmware or physical board I/O.
REM D13 is logical 13; D2 is logical 2. See the matching JSON fixture.
signal%=13
sense%=2
PROCpinMode(signal%,"output")
PROCpinMode(sense%,"input-pullup")
PROCdigitalWrite(signal%,1)
PRINT STR$(FNdigitalRead(signal%))+":"+STR$(FNdigitalRead(sense%))+":"+STR$(FNmillis)
PROCdelay(25)
PROCdigitalToggle(signal%)
PRINT STR$(FNdigitalRead(signal%))+":"+STR$(FNdigitalRead(sense%))+":"+STR$(FNmillis)
PROCdelay(5)
PROCdigitalToggle(signal%)
PRINT STR$(FNdigitalRead(signal%))+":"+STR$(FNdigitalRead(sense%))+":"+STR$(FNmillis)
END
