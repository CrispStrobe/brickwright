# bw8051_1: selected STC15 firmware and circuit lessons

This corpus adds reproducible guest firmware to Brickwright's existing
`emu8051-stc` → `bw-board` → circuit path. It qualifies a small part of
STC15lib, an early ElectronicHourGlassKit lesson, and a four-digit DIY clock.
The sources, licenses, compatibility patch, Intel HEX images, symbol maps and
teaching circuits are retained in
[`test/fixtures/bw8051_1`](../test/fixtures/bw8051_1).

The execution profile is **STC15W408AS, 11.0592 MHz, 5 V**, with pin edges
delivered in the adapter's push mode. It requires the emulator's corrected
STC15 Timer 0 mode 0 implementation and native W408AS part selection. A passing
program is integration evidence for the paths it executes; it does not qualify
every peripheral exposed by a header or every feature in the original project.

## Retained upstream sources

| Project | Immutable revision | Selected material | License |
|---|---|---|---|
| [STC15lib](https://github.com/mgoblin/STC15lib/tree/9b6dfece57540e344da6ce5f5dc1593274ee9321) | `9b6dfece57540e344da6ce5f5dc1593274ee9321`, tag `v0.18.0` | GPIO, Timer 0 mode 0 and ADC headers plus their header dependencies | Apache-2.0 |
| [ElectronicHourGlassKit](https://github.com/mgoblin/ElectronicHourGlassKit/tree/f434bb574ba5a89350bf26beca7cb0462db3c2dc) | `f434bb574ba5a89350bf26beca7cb0462db3c2dc` | Stage 2 `led_timer.c` and the `leds1` helper | MIT |
| [stc_diyclock](https://github.com/orangetrialtruck/stc_diyclock/tree/0a3972439846843dc3f4671a8bbc6f9846b2e17a) | `0a3972439846843dc3f4671a8bbc6f9846b2e17a` | Firmware sources and original Makefile | MIT |

All files under `vendor/` are unchanged upstream bytes.
[`sources.json`](../test/fixtures/bw8051_1/sources.json) records each source path,
commit, Git blob identity and SHA-256. The build verifies those hashes before
compiling. Each upstream license is retained beside its files. The clock's
`adc.c`, `adc.h` and `eeprom.c` also retain their STC MCU vendor attribution
comments. The clock's `stcgal` submodule is not imported. New test drivers,
build scripts and circuit generators in this corpus use the repository's MIT
license; the upstream material keeps its own license.

The HAL is pinned to the **v0.18.0 tag**, which is the version used by the
hourglass project. A later upstream main commit also advertised version
0.18.0; that does not make it the same source revision.

## What runs

| Image | Source and purpose | Independent expectation |
|---|---|---|
| `hal-gpio-adc.hex` | Small local guest calling the unchanged HAL | GPIO modes; a polled ADRJ=0 ADC result of 0, 256, 512 or 1023 for 0, 1.25, 2.5 or 5 V at VCC=5 V |
| `hal-timer-1t.hex` | Local Timer 0 guest with direct preload `0xfc00` | Repeated output edges every 1024 oscillator clocks, about 92.593 µs |
| `hal-timer-12t.hex` | Same guest in 12T mode | Repeated edges every 12288 oscillator clocks, about 1.111 ms |
| `hourglass-stage2.hex` | Unmodified upstream stage 2 and LED helper | Alternating source/sink and high-impedance states, plus actual light from the selected LED and no light from an unselected LED |
| `clock-mod4.hex` | Original clock plus the recorded six repairs below | RTC reads, periodic display refresh, correct electrical digit shapes, ADC endpoint progress, and RTC rollover reflected in guest state |

The timer tests calculate periods from oscillator frequency, divider and
preload. They do not copy the HAL's ticks-to-preload formula. The display test
uses conventional segment shapes for `1`, `2`, `3` and `4`, then observes the
circuit engine's current-derived brightness. Reading a display-buffer byte
alone cannot pass that test.

### Hourglass stage 2

The original lesson targets the STC15W201S/W204S kit. This import runs the
shared GPIO and Timer 0 behavior on the W408AS compatibility profile; it does
not claim an exact W201S/W204S package or memory model. The later complete
hourglass application is not part of this qualification.

The source drives L1's anode from **P3.0** and sinks its cathode through
**P1.0**. The off phase releases the ports into input-only mode. Its
`timer0_mode0_start(0xffff)` call produces a zero preload with the pinned HAL,
so each interrupt occurs after 65536 clocks and a complete on/off period takes
131072 clocks, about 11.852 ms. This observed behavior matters because the
emulator's previous classic-8051 13-bit mode 0 interpretation gave a different
period.

[`hourglass-stage2.json`](../test/fixtures/bw8051_1/circuits/hourglass-stage2.json)
keeps that polarity and adds 1 kΩ resistors for the teaching bench. L2 connects
an unused P3.1 anode to the same cathode. It checks that an input-only line does
not supply ghost current. The source is still the unmodified early lesson;
the bench is an explicitly simplified circuit.

### Four-digit DIY clock

The build is explicitly equivalent to **`MOD4=1 NMEA=0`**. `MOD4` is defined;
`WITH_NMEA` is absent. It keeps the original 4089-byte code limit, zero XRAM
configuration and `--data-loc 0x30`. The clock uses Timer 0 mode 0 in 12T mode
with preload `0xffd2`, yielding a nominal 46-count interval of about 49.913 µs.

The teaching circuit
[`clock-mod4.json`](../test/fixtures/bw8051_1/circuits/clock-mod4.json) contains
the following physical connections:

| MCU signal | Circuit role |
|---|---|
| P2.0–P2.7 | Active-low segment buses through 330 Ω resistors |
| P3.2–P3.5 | PNP digit bases through 4.7 kΩ resistors; emitters at VCC and collectors at the digit common anodes |
| P1.0 / P1.1 / P1.2 | DS1302 CE / bidirectional IO / SCLK |
| P1.6 / P1.7 | Light and temperature ADC voltages |
| P3.1 / P3.0 | Buttons to ground |
| P1.5 | Buzzer sink |

The four displays use the shared `seven_segment` component with
`params.common: 'anode'`. Their actual diode polarity is reversed by the
component expansion; there is no display-only inversion. The third package
retains the kit's rotated wiring: segment connections a/b/c and d/e/f exchange
positions. A crystal and 3 V backup battery are connected to the DS1302.
Adjustable 10 kΩ voltage dividers stand in for the light and temperature
sensors; these are voltage-input lessons, not calibrated sensor models.

The full electrical test starts the RTC at 12:34:56, then runs 150 ms of guest
time. It requires the guest to clear the halt bit, read BCD time over the
three signal nets, build the `1234` frame, and illuminate exactly those digit
shapes through the resistors, PNP drivers and common-anode LEDs. A separate
test starts at 12:59:59 and runs for 1.15 s, proving the physical RTC advances
to 13:00:00 and the guest reads it and produces the `1300` frame. That longer
test removes display loads to keep solver cost bounded while retaining the
RTC, rails, crystal, battery, ADC input circuits, buttons and buzzer. It does
not substitute a register mock or move the RTC ahead of MCU time.

Both gallery JSON files include explicit nets and equivalent star wires with
stable IDs. Nets serve `BoardImpl`; wires preserve the circuit editor's
rendering, editing and save/reload path. `make-circuits.mjs` regenerates both.

## Clock repairs are explicit

[`patches/clock-mod4.patch`](../test/fixtures/bw8051_1/patches/clock-mod4.patch)
applies to a temporary copy of the upstream source with patch fuzz disabled.
The upstream files remain available for review. The changes are:

1. Include `eeprom.h` directly in `main.c`, so the non-NMEA build has the IAP
   function declarations it uses.
2. Use the actual `temperature` variable in the four-digit temperature
   display, replacing two references to an undefined `temp` name.
3. Guard the NMEA settings comparison and resynchronization call with
   `WITH_NMEA`, so disabling NMEA also removes those undefined references.
4. Give the header-defined `led_digit_mask` arrays internal linkage with
   `static const`, avoiding duplicate global definitions across translation
   units.
5. Set the P1ASF bits for both selected ADC channels before sampling them.
   The [STC15 manual](https://stcmicro.com/datasheet/STC15F2K60S2-en.pdf), printed
   pages 662–663, requires this channel enable. Merely changing the GPIO mode
   does not enable the ADC function.
6. Stop the temperature approximation before its unsigned descending lookup
   value wraps below zero. The original loop could run forever at a valid
   zero ADC input. Both 0 V and 5 V endpoint tests now require main-loop
   progress through the later RTC read and frame update.

The endpoint test checks termination and continued clock operation. It does
not claim that the original temperature approximation is a calibrated or
meaningful thermometer over the full ADC range.

## Rebuild and verify

Install **SDCC 4.5.0**, including its assembler, linker, standard headers and
libraries. Put its `bin` directory on PATH. Node and the `patch` command are
also required. The build uses retained sources and performs no downloads.
From the `bw-board` repository root:

```sh
node test/fixtures/bw8051_1/build.mjs
```

Set `SDCC=/absolute/path/to/sdcc` if necessary; its companion tools must still
be on PATH. The builder rejects a different SDCC version. It records the
complete compiler version, flags, source and patch hashes, output hashes, and
data symbols from the linker map in `images/manifest.json`. Upstream warning
settings are preserved: an image being reproducible does not imply all
upstream source warnings have been eliminated.

For a comparison build without changing retained images:

```sh
node test/fixtures/bw8051_1/build.mjs --output /tmp/bw8051-1-rebuild
diff -r test/fixtures/bw8051_1/images /tmp/bw8051-1-rebuild
```

`--only clock-mod4` selects one image; use a separate output directory because
the resulting manifest describes only that selection. `--keep-work` retains
assembler listings and linker maps for diagnosis.

Build or obtain the matching `emu8051-stc` JS/WASM pair. The harness finds a
sibling checkout's `build/emu8051.js`, or accepts an absolute `EMU8051_JS`
override. The `.wasm` must be beside that glue file. Run the retained guests
and circuits with:

```sh
BW8051_REQUIRE_EMULATOR=1 node --test \
  test/bw8051-1-firmware.test.mjs \
  test/bw8051-1-circuits.test.mjs
```

All 13 tests ran and passed against the corrected native/WASM build during
qualification, with no skipped tests. The full electrical display test is
the main cost; the combined suite took about 26 seconds on the development
host. Timing assertions use simulated time, not host performance.

Without a discoverable emulator, the normal repository suite can report the
runtime tests as skipped. **A skip is not qualification.** The environment
variable above makes a missing emulator a hard failure for release/CI gates.

## Boundaries that remain visible

| Area | Qualification boundary |
|---|---|
| HAL | Selected GPIO, Timer 0 and polling ADC calls only; importing headers does not certify all their APIs |
| ADC justification | Guests use ADRJ=0. The pinned HAL's ADRJ=1 reconstruction shifts the wrong result byte; this path is deliberately unused. The manual's ADRJ=1 result is `(ADC_RES & 3) << 8 \| ADC_RESL` (printed p. 664) |
| ADC timing and IRQ | Results and polling flags are exercised. The emulator still uses the STC12 420/280/140/70-clock delay table rather than STC15's 540/360/180/90 clocks, and ADC interrupt dispatch is absent |
| IAP/EEPROM | No functional EEPROM controller or persistence model. The clock executes its existing settings routines using the current reset/register behavior; these tests neither seed fake EEPROM data nor validate persisted defaults or saves |
| NMEA and UART timing | Disabled in this clock configuration; ESP8266/NTP synchronization and a complete UART/baud-generator path are not claimed |
| Timer 2 | STC15 auto-reload and interrupt delivery remain outside the implemented model; the selected guests use Timer 0 |
| Complete applications | Full later-stage hourglass behavior, every clock menu, alarms, settings persistence and long-duration drift are not qualified |
| Hardware fidelity | W408AS family behavior is selected; exact package bond-out, strict part-sized memory bounds, calibrated analog devices and silicon measurements are not established by these tests |

The emulator's own `docs/bw8051-1-qualification.md` describes its independent
register-level tests and remaining peripheral limitations. This corpus adds
compiled third-party workload and circuit evidence on top of those checks.
