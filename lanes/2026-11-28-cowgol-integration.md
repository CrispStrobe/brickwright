# Cowgol integration — 2026-11-28

Status: active on `feat/cowgol-integration-20261128`.

Owner: ChatGPT, at the repository owner's request. Base: `b474327531ab9133f27c69fce9c6bd776bce2b50`.

Scope: Cowgol Code-tab language, + menu, source import/export and recovery, supported pseudocode/Blocks conversion, canvas/circuit bridge, truthful machine capabilities and compilation routing. Owning sibling boundaries: `sb3-creator` converters, `stc-compiler` compiler service, and `CrispStrobe/cowgol` compiler/runtime improvements. Examine `feature/crispbasic` for established integration patterns without replacing that work.

Delivery: the owner explicitly requests incremental saves to remote feature branches. This lane therefore stays on feature branches; it does not merge a claim or implementation into main. Upstream source identity, pin provenance, tracked mirrors and focused behavioral verification remain required.

Qualification: bidirectional conversion tests (including unsupported syntax), language/menu/recovery/routing tests, compiler smoke tests where toolchains are available, and generated capability/provenance checks. Native machine support is distinguished from conversion through an existing target backend.

Continuation: add real RISC-V console coverage through full Cowgol/cgen/GCC
and the checked Blocks console lowerer. Add a genuine Eater 65C02 ROM port
with its own memory/I/O contract, rather than treating the BBC Tube image as
compatible. Existing CP/M, DOS and C routes remain regression gates.

The producer pin moves deliberately along this feature branch from
`2823f4be81713dd1e0515cdf285cbb42faa77d13` to
`6b7f5966fcad4dbbdec6cb149bf71dca6df6364d`; its direct parent is the old pin.
The vendor sync uses its explicit deliberate-pin option, followed by exact
transformed-source identity and mirror checks. No default-branch merge is part
of this continuation.

RISC-V frontend checkpoint: `e4af9afccc4c2bc8b203c36ce07511faae899947`.
Eater continuation adds a validated 32 KiB ROM action and explicitly carries
the canonical board map through the existing ASM media handoff. This prevents
a previously extracted 6502 map from relocating the program or peripherals.
The focused editor workflow passes 105 tests; exact-machine execution is also
checked by the fork/service and the reusable local HTTP verifier. The upstream
compiler's final Eater argument-bound checkpoint is
`8e807002bc6d1d457995f2759da262c230d807e1`. Native host support and the checked
conversion subset remain separately qualified in docs/COWGOL.md.

## Platform and surface continuation

The repository owner requested broader coverage from Brickwright after the
four published checkpoints. This continuation expands executable surfaces
without treating a related processor as a qualified board runtime:

- Full CP/M 2.2 Computer execution with a mounted `COWGOL.COM`, automatic
  launch after `A>`, and both serial and TMS9918 Controller output. Both Z80
  and 8080-compatible compiler output execute on the existing pinned Z80 CPU.
- `bwlite cowgol build` for all seven compiler outputs, accepting full Cowgol
  source or checked native Blocks/pseudocode. Native source export also has
  an explicit `--target`; the old `compile` alias keeps its conversion meaning.
- Native Uno blocking millisecond delays and checked literal waits, qualified
  using real AVR GPIO edge cycles, cold resets, negative-duration refusal and
  preservation of a 32-bit delay count.
- Matching producer CLI and embedded native-profile APIs and target metadata;
  original SB3 graphs and parser diagnostics remain visible to validation.

Published dependencies for this continuation:

| Repository | Commit |
| --- | --- |
| Cowgol runtime | `4082aaba5c023b17f469f74d7a84504e3dbbebd4` |
| Compiler service | `933435f42a7c7e6b236b5032e1b1137ae1820e65` |
| Producer | `7cca9ea2554a9cd0b7a650a7b7e20b1bc2a738fd` |

The service CI rebuilt and qualified the complete seven-target bundle from
the new runtime. The producer CI now executes generated AVR programs alongside
the previous native machines. Brickwright's HTTP/CLI witness runs compiler
output through the actual CP/M OS, filesystem and display target, rather than
only the service-call bench. All native facts remain deployment-open until
the companion service and app are released. Hardware and full GUI-build
qualification remain separate.

The platform audit found that i80386 currently accepts disk/BIOS media rather
than a direct DOS executable; a genuine Cowgol route needs the 386 service
adapter or FAT image injection. ARM board ports need freestanding runtime,
startup and memory contracts; Cowgol's ARM Linux ABI cannot provide those by
renaming a target. At this checkpoint Nano and other AVR boards still needed
explicit memory and bootloader contracts; the classic Nano contract is added below.


## Further platform and surface expansion

The next continuation adds classic ATmega328P Nano as a distinct native
compiler/generator profile, and exposes additional verified uses of the
existing PC cores:

- `arduino-nano` explicitly fixes ATmega328P at 16 MHz and reserves the final
  2 KiB of flash. Its 30720-byte application ceiling is enforced by the linker,
  independent HEX/ELF checks and the editor client. SRAM/heap/stack and GPIO
  contracts remain shared with the existing 16 MHz AVR runtime. The eight-target
  bundle continues to pin Cowgol `4082aaba5c023b17f469f74d7a84504e3dbbebd4`.
- Full-source and checked I8086 programs can select actual 8086, 80186 or
  real-mode 80286 execution, each with serial output or the 720x400 Controller
  text screen. The DOS-service ASCII keyboard queue is now advertised to the
  Controller for compiled Cowgol. No full DOS boot or 386 adapter is claimed.
- The editor exposes the existing 8080-compatible CP/M compiler through
  explicit full CP/M computer/display actions, both running on the Z80 core.
- Checked draft downloads from pseudocode/Cowgol use a temporary producer
  graph, preserving the current project and source. Parser diagnostics,
  unsupported operations and conflicting device contracts refuse before
  compilation. Pending downloads retain the existing source/project/Blocks/
  device/cancellation ownership checks.
- Exact documented UNO/NANO source aliases normalize only for the native
  board contract. Tests invoke the real source-device methods so parser aliases
  cannot silently remove actions from the menu or bypass device conflicts.

Published sibling dependencies:

| Repository | Commit |
| --- | --- |
| Compiler/runtime | `4082aaba5c023b17f469f74d7a84504e3dbbebd4` (unchanged) |
| Compiler service | `d54f5d9d9583a1cafecc5f2e4d5ec33b3f1db7e6` |
| Producer | `8c26badb54cdf3ef6a98978dfedfac60c88e0362` |

The service checkpoint passes 45 tests, including the full six-test AVR
execution suite repeated with Nano's separate build target. The producer
checkpoint passes 62 conversion tests and 26 native execution groups. Its only
changed vendored source is `src/utils/cowgol.js`; all 28 mapped converter
sources match the app after its standard import rewrites. The producer gallery
tree is unchanged across this pin move. All 6130 app-vendored gallery files have
identical Git blob identities at the new producer pin; the four producer-only
root audit notes are not app gallery inputs.

Brickwright's dedicated workflow now parses the complete editor JSX, executes
the editor/CLI/ownership regressions, builds real DOS and CP/M output through
its client and CLI, and qualifies all six DOS CPU/surface combinations. A
separate job builds Uno and Nano through actual HTTP and CLI routes and boots
the exact returned HEX with cold SRAM on the GUI-pinned AVR engine. Witness
reports retain machine/compiler identities, exact artifact bytes or hashes,
console traces and display hashes. Native capabilities remain deployment-open;
physical Nano flashing, a full production GUI build, protected-mode 286,
80386 DOS loading and board-specific ARM runtime ports remain separate work.
