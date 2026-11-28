REM generic 8051 logical ports
REM Host-driven logical simulation: no native firmware or physical board I/O.
REM P1.0 is logical 8; P1.1 is logical 9. See the matching JSON fixture.
signal%=8
sense%=9
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
