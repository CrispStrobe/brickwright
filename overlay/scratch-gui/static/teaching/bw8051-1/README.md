# Optional Timer0 scheduler lesson

Download [cute-os-timer0.c](cute-os-timer0.c) or the matching
[Intel HEX image](cute-os-timer0.ihx). Load the image on the **STC89C52RC**
profile with a **12 MHz** clock.

This is a small SDCC teaching adaptation of cute-os, not a change to Scratch or
Brickwright's generated scheduler. It uses Timer0 mode 1, idle wake-up, three
short ISR callbacks, and removal of the fast task after 200 ticks. The original
cute-os Timer2 configuration is not claimed to run unchanged.

When IRAM `36h` becomes `A5h`, inspect IRAM `30h–36h`:

```text
19 0C 06 00 F0 00 A5
```

The first three bytes are callback counts 25, 12 and 6; byte `33h` is zero API
errors; `34h–35h` is the little-endian tick count 240. P1 ends at `F6h`. The
requested tick interval is 5 ms plus ISR/reload latency.

The complete MIT license and adaptation notes are in the C source. Native
rebuild command in the Brickwright repository:

```sh
node scripts/build-8051-teaching.mjs --out artifacts/8051-teaching
```

That script reserves direct data at `40h` and above, preserving the fixed
observation bytes. Use it instead of compiling this particular fixture with
unspecified SDCC memory options.
