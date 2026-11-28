REM Open circuit.json in Circuit, then select Connect Circuit in the BASIC panel.
REM Uno D3 = bridge enable; D7/D8 = forward/reverse inputs.
REM All delays advance the circuit solver's time, in integer milliseconds.
PROCpinMode(3, "output")
PROCpinMode(7, "output")
PROCpinMode(8, "output")

PROCdigitalWrite(3, 0)
PROCdigitalWrite(7, 1)
PROCdigitalWrite(8, 0)
PROCdigitalWrite(3, 1)
PRINT "forward"
PROCdelay(200)

REM Disable before changing direction, then drive the opposite winding polarity.
PROCdigitalWrite(3, 0)
PROCdigitalWrite(7, 0)
PROCdigitalWrite(8, 1)
PROCdigitalWrite(3, 1)
PRINT "reverse"
PROCdelay(300)

REM Equal direction inputs with enable high brake the spinning rotor.
PROCdigitalWrite(7, 0)
PROCdigitalWrite(8, 0)
PRINT "brake"
PROCdelay(300)

REM Disable the bridge after braking; the outputs are now high impedance.
PROCdigitalWrite(3, 0)
PRINT "coast"
PROCdelay(25)
PRINT "Elapsed ms: "; FNmillis
END
