# bw8051_1: firmware circuits and 8051 teaching

This adoption adds selected guest programs and teaching tools to Brickwright's
existing emulator, board and debugger. The shared emulator and electrical
behavior are maintained in `emu8051-stc` and `bw-board`; Brickwright consumes
their exact revisions.

## What was adopted from the six references

| Reference | Contribution to Brickwright | Existing foundation retained |
| --- | --- | --- |
| [cute-os](https://github.com/makaram99/cute-os) | Optional, reproducible SDCC Timer0 scheduling guest with observable task counts and task removal | Existing execution core and application scheduler |
| [STC15lib](https://github.com/mgoblin/STC15lib) | Pinned HAL regression guests for GPIO, ADC and Timer0 at 1T and 12T | Native STC peripheral model, corrected where real guests exposed defects |
| [STC15 visual simulator](https://github.com/mantou1233321/STC15F2K60S2_visual_simulator) | Teaching ideas for byte explanations and register/pointer markers; no source copied | Existing debugger snapshots and instruction core |
| [MicroController-Lab](https://github.com/AshrithSagar/MicroController-Lab) | Six attributed 8051 lessons, adapted for the existing assembler and stable debugger results | Hosted assembler and actual STC firmware runner |
| [stc_diyclock](https://github.com/orangetrialtruck/stc_diyclock) | Four-digit DS1302 clock guest, explicit build repairs and a complete electrical bench | Existing DS1302, transistor and LED models, with common-anode display expansion added |
| [ElectronicHourGlassKit](https://github.com/mgoblin/ElectronicHourGlassKit) | Unchanged early scanning guest and a driven/released-line circuit lesson | Existing physical GPIO and LED simulation |

Exact source revisions, hashes and original licenses accompany the fixtures.
The downloaded source archive includes the original firmware and each explicit
clock patch; the teaching directory retains the lab and scheduler notices.

## Open the examples

1. Choose an STC device in Code, then open the **ASM** tab in source mode.
2. The **Example** picker includes six small lab programs: 16-bit addition,
   byte AND, array copy, unsigned sorting, decimal digits and a two-byte
   rotate. Each source gives its inputs, prediction question and expected
   result. **Assemble & Run** now loads the resulting Intel HEX into the
   selected STC part and opens the debugger.
3. Each lab finishes in a stable loop at code address **0300h**. Pause there
   and inspect registers or memory. Memory-byte tooltips show hex, decimal,
   binary and printable ASCII, with the active register bank and the relevant
   SP/DPTR/PC locations marked from the actual snapshot.
4. The **Firmware circuit** picker loads either **Hourglass: LED scan and
   release** or **Clock: four digits and DS1302**. Opening one replaces the
   current project. The real circuit is validated and installed before its
   firmware starts. The adjacent source download contains the original
   sources, explicit patches, build commands, licenses and exact provenance.

Assembly uses the existing hosted SDAS8051 service. The two prebuilt firmware
circuits run locally after their same-origin assets load; they do not require
a compiler request. Source builds are independently reproducible with native
SDCC 4.5.0.

The optional **cute-os Timer0** guest is a separate source/HEX download under
`static/teaching/bw8051-1/`. Its guide explains the STC89/12 MHz selection and
the fixed observation bytes. It remains a guest exercise; it does not change
Brickwright's task scheduler. See [the teaching guide](BW8051-TEACHING.md).

## What the circuits establish

Both shipped circuits select **STC15W408AS at 11.0592 MHz and 5 V**.

The hourglass uses the unchanged early stage 2 source and LED helper. It
alternates driven and high-impedance phases on a simplified two-LED bench.
The selected LED conducts; the unselected line remains dark. This is a
lesson about the scanning stage, not the complete later hourglass application.

The clock uses the upstream four-digit build with NMEA disabled. Its bench
contains current-limiting resistors, PNP digit drivers, common-anode displays,
the rotated third digit, DS1302, crystal, backup battery, ADC input dividers,
buttons and buzzer. Qualification checks actual current-derived `12:34`
segment shapes, continued main-loop progress at both ADC voltage endpoints,
and the physical RTC transition from `12:59:59` to `13:00:00` reaching the
guest's display buffer.

Six clock repairs are recorded in a patch: missing EEPROM declarations,
undefined temperature references, unguarded NMEA references, duplicate digit
mask definitions, missing ADC channel enables, and unsigned temperature-loop
underflow. The vendor originals remain unchanged and hash-checked.

## Shared corrections

- STC15 Timer0 mode 0 uses 16-bit auto-reload, including writes buffered while
  the timer runs. STC12/STC89 retain classic mode-0 behavior.
- W408AS selects its own native part instead of F2K60S2. Its memory and
  peripheral identity, three PCA channels, STC15 routing and clock settings
  reach the running CPU.
- Checkpoint build `0x80510103` includes the hidden Timer0 state and uses
  443561 bytes. Earlier layouts are refused before restoration.
- Common-anode seven-segment parts reverse the actual LED polarity through
  `params.common: 'anode'`; the renderer observes the resulting brightness.
- Hardware and debugger reset preserve the configured oscillator, Vcc and board
  bindings. Adapter teardown detaches callbacks before releasing their slots,
  including when a module is reused.
- STC firmware without symbols can run, and its declared device and oscillator
  take precedence over a previously selected project's engine settings.

## Boundaries

EEPROM settings persistence, NMEA timing, later hourglass tilt/sleep stages,
complete clock menus/alarms, exact STC15 ADC conversion latency, ADC interrupts,
Timer2 auto-reload/interrupts, watchdog CPU reset, full UART timing and pin-level
SPI are not qualified by this adoption. The selected HAL test uses ADRJ=0;
the upstream HAL's ADRJ=1 reconstruction is not part of the accepted corpus.

The JavaScript visual simulator was studied for useful teaching interactions.
Its CPU and peripheral implementation were not imported. Byte explanations
and pointer markers use Brickwright's existing snapshots.

## Reproduce and verify

`scripts/build-8051-teaching.mjs --check` rebuilds the six lab images and the
optional scheduler guest. Set `BW_SDCC_BIN` to SDCC 4.5.0's binary directory.

The pinned board source contains `test/fixtures/bw8051_1/build.mjs` and the
firmware/circuit tests. Its required qualification command is:

```sh
BW8051_REQUIRE_EMULATOR=1 node --test \
  test/bw8051-1-firmware.test.mjs test/bw8051-1-circuits.test.mjs
```

`scripts/sync-bw8051-firmware.mjs --source /path/to/bw-board` copies committed
files only from the revision in `vendor-pins.json`; `--check` verifies the
packaged hashes and matching board revision. The emulator sync independently
checks the JavaScript and WASM SHA-256 values recorded by its build.
