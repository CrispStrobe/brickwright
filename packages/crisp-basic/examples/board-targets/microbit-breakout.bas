REM micro:bit breakout GPIO surface
REM Host-driven logical simulation: no native firmware or physical board I/O.
REM P8 is logical 8; P16 is logical 16. See the matching JSON fixture.
signal%=8
sense%=16
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
