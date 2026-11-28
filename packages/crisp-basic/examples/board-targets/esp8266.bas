REM ESP8266 GPIO surface
REM Host-driven logical simulation: no native firmware or physical board I/O.
REM GPIO12 is logical 12; GPIO0 is logical 0. See the matching JSON fixture.
signal%=12
sense%=0
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
