---
level: intermediate
age: 11+
prereqs: [cp1-cp4-relay-signals, cp1-cp5-binary]
teaches: [cp1-input, cp1-output, relay, isolated-load, interference-suppression]
---
## Eight filtered inputs, eight relay contacts

This bench builds up all eight channels of the Kosmos CP4 with editable components. Each input has a bias divider, two clamp diodes and a 100 nF capacitor. Each output drives a transistor and relay coil, with a flyback diode across the coil. A separate 100 nF capacitor sits across each normally open contact. The load battery supplies the lamps through those contacts.

1. Choose **Use Brickwright monitor** and run the CPU to the ready display. All eight lamps light because the monitor initializes Port 2 high. Pause the CPU, load the program cells, then resume without resetting. Enter **0, 0, 0, PC, RUN**. With every request switch open, all lamps go dark.
2. In **Circuits → Instruments → Switches**, close switches 1, 3, 5 and 7. Predict the displayed value before checking the lamps. These positions add up to 85. Reopen them and try 2, 4, 6 and 8 for 170. The physical terminal labels count from zero, so switch 8 reads P1.7 and controls the relay on P2.7.
3. In **Code**, follow the byte through P1E 0, the inputs cell and SUB inputs. An open switch reads high. The program subtracts the sampled byte from 255 so a closed switch lights its own lamp.
4. Zoom into one channel to trace its supplies. Reference the input to computer ground and use the lamp battery negative terminal when measuring the load. The relay contact links each lamp only to its isolated supply.

The [CP4 manual, section IV](https://www.retrozone.ch/docs/cp1/CP4-Relais-Modul.pdf) specifies the input divider, clamping, driver and contact suppression used here. The bench uses a fixed 9 V coil supply, a separate 5 V load supply and generic relay models. It models switching with these loads. The transformer and rectifier, contact bounce, physical ratings and measured noise immunity require separate hardware qualification.
