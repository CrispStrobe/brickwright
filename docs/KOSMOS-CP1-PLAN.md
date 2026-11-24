# Kosmos CP1 integration plan

Date: 2026-11-24. Owner: Brickwright CP1 implementation lane.
Primary feature branch: `feat/kosmos-cp1-20261124`.
Status: accepted implementation plan; progress is recorded in `KOSMOS-CP1-PROGRESS.md`.

This records the architecture, implementation sequence, and acceptance criteria agreed in the planning conversation. New implementation and working checkpoints are to be saved incrementally to remote GitHub feature branches. Source behavior belongs in its owning upstream package and is adopted by Lite through explicit pins, not private copied forks.

## User constraint: GPL and independent implementation

GPL code may only be used to gather behavioral ideas or as an external test oracle. Any implementation informed by such research must be independently written by a fresh subagent that has not received GPL source, translated code, pseudocode derived from it, or its implementation structure. The research/oracle side may pass factual hardware requirements and input/output observations. Independent implementation agents may consult original Intel/Kosmos specifications and separately audited permissive sources. Record consulted sources, authorship boundaries, limitations, and oracle versions. Do not vendor GPL CP1 emulator code, historical ROMs, or manual scans into the shipped feature.

## 1. Machine definition

Add the CP1 as a first-class machine, with a reusable 8049 core, a separate 8155 peripheral model, and one shared machine instance behind Circuit, Widgets, Debug, Code, and Lessons.

CP1 programs and 8049 programs are different. Learners enter decimal CP1 instructions. The firmware interprets those instructions on the 8049. Learners should be able to step a CP1 command and inspect the processor instructions and bus transactions implementing it.

| Element | CP1 specification | Required implementation |
|---|---|---|
| Processor | Intel 8049 at 6 MHz | Distinct MCS-48 instruction interpreter |
| Firmware | 2,048-byte ROM | Loading, identification, execution |
| CPU working memory | 128-byte internal RAM | Registers, stack, firmware variables, inspection |
| External peripheral | Intel 8155 with 256 bytes of RAM | RAM, I/O, directions, documented timer support |
| User memory | 128 cells | Opcode and operand byte per cell |
| Display | Six seven-segment digits | Raw segments, decimal points, multiplexing |
| External connections | Eight bidirectional Port 1 lines, eight Port 2 outputs | Real circuit-engine connections |
| CP3 expansion | Another 128 cells and additional ports | Second 8155 and expansion detection |

The base machine has 256 external bytes holding 128 CP1 cells, in addition to the CPU's internal RAM. Use distinct identities: CPU family `mcs48` (initially 8049), machine `kosmos-cp1`, and program language `cp1`.

Primary hardware source: [original CP1 manual, technical data section](https://manualzz.com/doc/62077556/kosmos-cp1-benutzerhandbuch).

### One runtime, several views

The CPU runs the ROM; the CP1 machine maps the 8155 bus and pins; the circuit solves connected external devices; the panel reads actual display scan state and injects keyboard contacts; the debugger observes both CPU and CP1 state; lessons consume real observations. All views share one machine and simulation clock.

Follow Lite's existing `test/b8-one-board-per-run.test.mjs` ownership contract. Do not implement a second CP1 interpreter in the panel.

## 2. Device models in bw-board

### Reference selection

| Source | Value | Role |
|---|---|---|
| MAME MCS-48 and 8155 device files | Individually BSD-3-Clause device implementations | Audited permissive technical references; framework dependencies require review |
| Andreas Signer's CP1 emulator | GPL implementation, annotated firmware, schematic, assembler | Research/oracle side only under the user constraint |
| Michael Wessel's browser emulator | GPL JavaScript machine running historical firmware | External compatibility oracle and observable UI reference |

Sources:
- https://github.com/mamedev/mame/blob/master/src/devices/cpu/mcs48/mcs48.cpp
- https://github.com/mamedev/mame/blob/master/src/devices/machine/i8155.cpp
- https://docs.mamedev.org/license.html
- https://github.com/asig/kosmos-cp1
- https://github.com/lambdamikel/kosmos-cp1-emulator

Prefer independently authored JavaScript matching bw-board's existing small-core style. WASM extraction is possible but incurs framework/dependency work. A compact CP1-specific oracle does not establish complete generic 8049 or 8155 support.

### CPU scope

Implement the 8049 instruction set and flags, register banks, indirect RAM, RAM-resident stack, calls/returns and program addressing. Include documented instruction cycle counts and interrupt entry, timer/prescaler/overflow, external event counting and interrupts, BUS/MOVX/P1/P2/test pins, and expander-operation behavior. Separate output latches from sampled pin levels. Provide disassembly and versioned serializable state.

At 6 MHz, division by 15 gives 400,000 machine cycles per second, or 2.5 microseconds per cycle. Do not reuse 8051 decode or divide-by-12 timing. Claim instruction-level execution and tested cycle accounting; do not claim universal pin-cycle accuracy without evidence. MAME's core itself documents fine timer/IRQ timing uncertainties.

### 8155 scope

Implement 256 x 8 RAM, two eight-bit ports, one six-bit port, command/status registers, and timer behavior appropriate to the declared capability. Address/data and I/O-versus-memory selection are bus transactions. A freely wireable generic component must either implement additional modes or explicitly report unsupported ones.

The machine, not the generic CPU, owns CP1 chip selection and wiring. Writes reach every selected 8155. Distinguish power-on, CPU reset, and peripheral reset, preserving firmware-driven RAM clearing as observable behavior.

[MAME PR #16967](https://github.com/mamedev/mame/pull/16967), opened 2026-11-21 and still open at planning time, reports 12.6 million compared instructions and fixes for timer-interrupt entry cost and simultaneous 8155 writes. These are upstream-reported results, not Brickwright qualification. Known ROMs differ in keyboard reads (`IN A,P2` versus `MOVD A,P4`). Test both identified variants before claiming both.

### Proposed modules

| File | Responsibility |
|---|---|
| `src/mcs48.js` | CPU core |
| `src/mcs48-disasm.js` | Instruction decoding |
| `src/i8155.js` | RAM, I/O, timer |
| `src/cp1-machine.js` | Wiring, ROM, keyboard, display, expansions |
| `src/cp1-adapter.js` | Circuit pins and simulated time |
| `src/cp1-debug.js` | Debug target and CP1 semantic inspection |
| `src/cp1-rom-profiles.js` | Known hashes and firmware-specific symbols |
| `src/cp1-extract.js` | Supported editable circuit validation/extraction |

Use `src/m6502-adapter.js` as a package-owned architectural reference for `board.setPin`, `board.readPin`, and `board.advanceTo`. Publish new exports/targets through normal registries and package entry points.

## 3. Circuits

### Complete CP1 component

Provide a placeable CP1 with Port 1 terminals 1-8, Port 2 terminals 1-8, ground/supply, and optional expansion connections. Its internal wiring is fixed and its external terminals participate in ordinary circuit simulation. Support real switches, LED drivers, relays, sensors, and feedback wiring through the running firmware.

### Expanded schematic

Provide an Inside the CP1 example exposing 8049, 8155, multiplexed address/data bus, control signals, digit/segment drivers, key matrix, clock/reset, and optional second 8155. Use the [original schematic](https://github.com/asig/kosmos-cp1/blob/master/docs/schaltplan.pdf) as factual reference; draw original assets.

Editable internal connections must affect execution through the extractor/bus model. A validated canonical assembly is an acceptable intermediate capability with explicit unsupported-wiring diagnostics. Do not present decorative internal wires as electrically authoritative.

### Electrical behavior

Port 1 is quasi-bidirectional: a released-high latch permits external grounding. Preserve latch versus sampled level. Existing `src/pin-model.js` constants are STC approximations; add justified device-specific electrical parameters rather than silently treating them as measured 8049 values.

The CP3 manual distinguishes potentially indeterminate open Port 3 inputs from base Port 1 released-high inputs. Surface floating inputs and let learners apply biasing. Use a documented deterministic sampling policy; do not hide floating inputs with arbitrary automatic pull-ups.

The original CP5 and CP4 manuals describe all output LEDs/relays active at startup because outputs initialize high. Use that as an initialization lesson and regression case.

References:
- https://www.manualslib.de/manual/643552/Kosmos-Cp-3.html?page=7
- https://www.retrozone.ch/docs/cp1/CP5-Ein_Ausgabe-Universalinterface.pdf
- https://www.retrozone.ch/docs/cp1/CP4-Relais-Modul.pdf

### Scheduling

Advance CPU execution in bounded instruction batches. Deliver relevant pin changes at simulated timestamps. Let the circuit solver use its existing event/integration deadlines. Accumulate display segment on-time in simulation time; browser frame rate must not change program results or measured periods. Keep one clock owner.

### Expansions

| Module | Scope |
|---|---|
| CP3 | Second 8155, cells 128-255, Port 3 inputs, Port 4 outputs, six-bit Port 5 |
| CP5 | Connected switches/LED interface and compact panel |
| CP4 | Relay drivers/contacts and supported filtered inputs |
| CP2 | Cassette data/control, logical pulse tape, then WAV and analog work |

CP3 and CP5 are early priorities. CP2 memory-image import and genuine firmware CAS/CAL transfer are distinct operations. Reference: https://www.retrozone.ch/docs/cp1/CP2-Kassetten-Modul.pdf

## 4. Widgets and debugging

Existing Lite `controller-panel-view.jsx` formats integer values as seven-segment digits and sends keypad values on pointer-down. CP1 requires raw segments and held contacts.

### Front panel

Provide six raw-segment digits with decimal points and blanking, original function keys and duplicated digit keys, mouse/touch/keyboard operation, key-down/up, pointer cancel, blur/release handling, and firmware-produced startup/errors/status. There are 20 logical key positions, with duplicated number buttons producing 30 physical buttons. Physical duplicates map to the same contact. Follow `controller-inputs.js` ownership/release patterns.

### Views

| View | Content |
|---|---|
| CP1 memory | Decimal addresses, opcode/operand, mnemonic, current command |
| CP1 registers | Teaching-machine accumulator, PC, comparison state |
| 8049 debugger | CPU registers, RAM, stack, timer, disassembly |
| I/O strip | Output latch, sampled input, electrical state |
| Display scan | Selected digit, segments, scan timing |
| Bus trace | Chip select, RAM/I/O, address, value |

Expose separate Step CP1 command and Step 8049 instruction controls. CP1 HLT/STP differs from pausing the emulator: firmware can continue refreshing/scanning while the user's program is stopped.

Semantic stepping observes ROM-profile dispatch boundaries and remains bounded. Firmware symbols and internal RAM meanings must be hash-keyed. Unknown ROMs may use raw CPU debug without invented semantic labels. Preserve entire two-byte CP1 accumulator cells where firmware uses them.

## 5. Program editor, examples, and persistence

### CP1 assembly

The separately MIT-licensed [kosmos-cp1-devel-toolchain](https://github.com/lambdamikel/kosmos-cp1-devel-toolchain) is a possible assembler/cassette-tool reference, distinct from GPL emulators. Its `cp1asm.py` assembles CP1 mnemonics, not 8049 opcodes. Any adaptation retains appropriate notices; independently authored implementation is also suitable.

Synchronize numeric cells (`04.001`), mnemonics (`AKO 1`), and bytes (opcode 4, operand 1). Parse numeric cells as structured text, never floating-point values. Support labels, source maps, ranges, duplicate-address errors, and explicit CP3 requirements. Keep ROM loading separate from CP1 program loading.

The historical firmware is authoritative for behavior. Overflow/underflow errors and Boolean-only NEG/UND must not silently become wrapping arithmetic or broad bitwise operations. Reference: https://www.retrozone.ch/docs/cp1/CP1-QuickRef-Card.pdf

### First measured example

This original seven-cell program was smoke-tested against the external browser reference with the 2716 firmware, before implementation began:

| Cell | Mnemonic | Numeric entry | Meaning |
|---|---|---|---|
| 000 | AKO 1 | 04.001 | Load one |
| 001 | P2A 1 | 18.001 | Set Port 2 terminal 1 high |
| 002 | VZG 200 | 03.200 | Request 200 ms delay |
| 003 | AKO 0 | 04.000 | Load zero |
| 004 | P2A 1 | 18.001 | Set terminal 1 low |
| 005 | VZG 200 | 03.200 | Request another delay |
| 006 | SPU 0 | 09.000 | Repeat |

Connect an appropriate LED driver/current-limiting circuit and scope probe. Reference observation: Port 2 alternated 255/254, with transition intervals approximately 225.6-226.0 ms including firmware/program overhead. This was not physical-hardware timing or Brickwright qualification. ROM SHA1: `ff4befcf82a664950186d3af1843fdef70d2209f`.

### Portable .sb3 projects

Add a versioned CP1 representation to `brickwright/state.json`: configuration/expansions, ROM identity/reference, source and initial cells, circuit/panel bindings, and optionally a separately versioned execution checkpoint. Machine Manager's separate IndexedDB store alone does not make a project portable.

Checkpoints include CPU internal state, both 8155s, timer/interrupt phase, time, and relevant input state. Normal saves preserve the project without reopening with transient user keys held. Validate and bound serialized values before state mutation.

## 6. Repository integration

| Owner | Changes |
|---|---|
| bw-board | CPU, 8155, machine, adapter/debug, registration, snapshots |
| bw-circuit-ui | Parts/terminals/art, schematic, extraction, circuit views |
| sb3-creator | Language tooling where appropriate, examples, curriculum assets |
| brickwright-lite | Target routing, Code/Widgets, Machine Manager, persistence, lessons |

Owning upstreams land behavior first; Lite adopts reviewed exact pins. Do not create private source copies under Lite. Candidate feature branches may be used for incremental preservation while qualification and upstream landing are pending.

Existing Lite hooks:
- `overlay/scratch-gui/src/lib/bw-debug/debug-runner.js`: target routing, attachment, run ownership. A ROM-backed CP1 must not enter default block compilation or fall back to 8051.
- `overlay/scratch-gui/src/lib/bw-machines/machine-config.js`: machine kind, CPU variant, ROM slot, config and widgets.
- `bw-machines/activate.js` and `run-machine.js`: media/activation routing.
- `tw-pseudocode/debug-panel.jsx` and `circuit-tab.jsx`: core/device mapping.
- `controller-panel-view.jsx`: panel rendering.
- `bw-project-bundle.js`: portable project state.
- `scripts/sync-examples.mjs`: extend the HTTP path beyond its current hardcoded `program.bw`, `circuit.json`, `EXPECTED.md` filenames for declared `.cp1` assets.

Read current lane/protocol files before implementation. Preserve unrelated owners, required tests, package identity, and mirror rules. Do not claim a feature as shipped merely because a source checkpoint exists.

## 7. English/German lesson trail

| Lesson | Activity | Observable outcome |
|---|---|---|
| Meet the CP1 | Panel, memory, built-in test | Key sequence and display |
| First program | Load/display/halt | Accumulator and halt cell |
| Follow a command | CP1 single step | Expected PC/accumulator |
| Count and compare | Loop/branch | Predicted sequence/stop |
| Read a switch | Port 1 to ground | Released-high/pressed-low |
| Blink an LED | Driver/LED/scope | Transitions and measured period |
| Binary numbers | CP5 interface | Input/display/output agreement |
| Control a sequence | Traffic lights/signals | Correct order/timing |
| Indirect addressing | Pattern table | Expected selected cells |
| Expand the computer | CP3 | Memory boundary and defined inputs |
| Look inside | Display/key scanning | Interrupt/row/segment relation |
| Save and restore | CP2 | Firmware transfer recovers memory |

Later projects: reaction timer, railway signal, light-controlled counter, melody circuit, relay-controlled model. Author original text/programs rather than copying manual pages.

Lesson observations are a closed contract in `guided-lessons.jsx` and `scripts/detect-lesson-defects.mjs`. Add actual machine-produced events for command completion, output transition, halt/error, and measured intervals, with defined payloads and reachability checks. Loading a circuit prepares a checkpoint; observing the requested outcome completes it. Supply honest manual fallbacks.

## 8. ROM and asset handling

Historical ROMs/manual programs are not automatically licensed by an emulator repository. Ship emulator code independently, allow local ROM import, identify known hashes, and author original lessons/assets. Bundle historical assets only with documented permission. Keep ROM variants distinct and test their different input paths. No historical ROM bytes are to enter this feature's Git commits.

## 9. Delivery sequence

| Increment | Deliverable | Acceptance |
|---|---|---|
| 1 | 8049, disassembler, 8155 | CPU/timing/I/O/peripheral controls |
| 2 | Bootable headless CP1 | ROM boot, keys, scan, base/CP3 selection |
| 3 | First complete lesson | Panel/program/circuit/save/load and measured blink |
| 4 | Circuit/debug depth | CP3/CP5, expanded schematic, both step levels |
| 5 | Curriculum | Complete EN/DE assets and reachable checks |
| 6 | Additional interfaces | CP4 and genuine CP2 transfers |

Initial product target: base CP1 plus optional CP3, authentic panel, numeric/mnemonic loading, shared circuit I/O, both debug levels, portable state, and three lessons (first program, switch input, measured blink).

## 10. Verification and progress discipline

- Meaningful CPU vectors include flags, stack, register banks, page-edge jumps, MOVX/ports, timer/IRQ entry, and pin/latch distinctions.
- Test every advertised 8155 register/mode, simultaneous selected writes, and reset behavior.
- Boot known firmware variants; test keypad entry/readback/run/step/stop and memory limits.
- Preserve CP1 errors, including arithmetic errors rather than silent wrapping.
- Verify circuit input -> firmware decision -> real circuit output on one timeline.
- Vary render cadence without changing simulated results.
- Verify save/reload and checkpoint continuation, including validation failures before mutation.
- Keep existing target-routing, project-bundle, controller, one-board-per-run, and lesson gates.
- Separate original tests, external-oracle observations, hardware measurements, candidate source, and shipped capability.
- Push small coherent checkpoints to the feature branches and record exact remote commits plus validation in `KOSMOS-CP1-PROGRESS.md`.
- Stop optional testing once the concrete risk is resolved; do not weaken or bypass required gates.
