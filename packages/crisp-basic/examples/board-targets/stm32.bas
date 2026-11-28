REM STM32F030 GPIO surface
REM Host-driven logical simulation: no native firmware or physical board I/O.
REM PB1 is logical 17; PA0 is logical 0. See the matching JSON fixture.
signal%=17
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
