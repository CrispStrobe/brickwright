# Logikus Lab

**The wires are the program.** Logikus Lab brings a mechanical contact computer
into Brickwright: set inputs, follow connections, change the wiring, and find
the exact input that makes an edited circuit disagree with its goal.

Open **Widgets → Logikus Lab**. For guided experiments, open **Lessons**, search
for **Logikus**, and choose **Open lesson project**. In German the lab is
**Logikus-Labor**. This document describes the implementation in this source
tree; deployment and native-app distribution follow the repository's usual
release process.

## Try an experiment

1. Choose **Half adder: 1 + 1 = 10**. In **Operate**, change S0 and S1 and read
   the result as **L1 L0**: carry followed by sum. The four inputs 00, 01, 10,
   11 produce 00, 01, 01, 10.
2. Select an illuminated lamp to show one complete source-to-lamp path. Open
   **Wire** to see the closed contacts and connections.
3. Remove a connection from the expandable wire list. Choose **Test all states**
   to compare the edited wiring with the preset. **Show counterexample** loads
   a failing input and selects a lamp whose output is wrong.
4. Use **Undo** to restore the edit, or reconnect the endpoints. Connections
   can be added by clicking two terminals or by choosing **From** and **To**
   and pressing **Add wire**. Crossing drawn wires do not form a junction.
5. Choose **Use in Widgets** to create an operating panel. The lab closes and
   the same circuit remains live behind its Widgets controls.

The contact program responds immediately. It does not require the green flag
or a running Scratch script. A blank patch board is available for new designs;
the panel title, switch labels and lamp labels can be edited. Undo and redo
cover edits during the current lab session, including preset changes. Export
provides a durable copy of a design.

## What the original machine did

The Kosmos Logikus, introduced in 1968, used ten binary sliders, ten lamps, a
momentary button, and a wire patch field. Each slider simultaneously operated
five electrically independent contact banks. Wires specified which selected
contacts had to conduct before a lamp received the source connection. The
lamps' returns were inside the machine. The original workbooks explain the
construction and wiring on printed pages 8–12 of volume 1, and the operator's
role as the control unit on page 17.

Each bank has **four separate terminals**. For the first bank of switch S0,
they are `S0.Aa`, `S0.Ab`, `S0.Ba`, and `S0.Bb`:

| S0 position | Closed pair | Pair left open |
| --- | --- | --- |
| 1 | Aa ↔ Ab | Ba / Bb |
| 0 | Ba ↔ Bb | Aa / Ab |

There is no shared electrical common between the A and B pairs. The same
mechanical input controls the other banks CD, EF, GH and IK. Thus at 1 the
A, C, E, G and I rows conduct; at 0 the B, D, F, H and K rows conduct. Using
separate banks lets one input participate in several conditions without
electrically joining their intermediate nodes.

The original terminal groups each offered three electrically equivalent wire
sockets. Brickwright represents each such group as one named node. `Q` is the
source; `L0` through `L9` are independent lamp inputs; `Ta` and `Tb` are the
momentary button's terminals. The UI retains the ten switches, five banks per
switch and ten lamps, while simplifying the socket representation.

Series contacts implement **AND**. Parallel complete paths implement inclusive
**OR**. Choosing the contact closed at input 0 implements **NOT**. These are
physical connectivity conditions: a wire is bidirectional, and an unintended
connection can feed another path in the reverse direction. The model therefore
evaluates an **undirected graph**, rather than treating drawn wires as one-way
Boolean gate connections.

The original does not execute a stored instruction sequence. The operator
supplies the sequence of switch changes, and the wires retain the chosen
logic. Switch positions persist until moved; that physical state is distinct
from a clocked register, CPU memory or an automatic sequencer. Lauff's modern
guide explains the same contact behavior and offers a separate rule-based
Excel representation; Brickwright evaluates the actual patch connections.

Sources: [original workbooks and information](https://www.logikus.info/),
[volume 1 download](https://www.logikus.info/downloads/handbuch-1.zip),
[volume 2 download](https://www.logikus.info/downloads/handbuch-2.zip), and
[Werner Lauff's simulator guide](https://www.lauff.org/Logikus.pdf), especially
pages 2–5. Workbook page references in this document are **printed page
numbers**, which do not always match a PDF viewer's page index.

## The nine supplied programs

Let A = S0, B = S1 and C = S2. All outputs are Boolean lamp states.

| Preset ID | Experiment | Output behavior |
| --- | --- | --- |
| `lamp` | A switch and a lamp | L0 = A |
| `and` | Two keys to launch | L0 = A AND B |
| `or` | Two ways to ring | L0 = A OR B, including A = B = 1 |
| `not` | The opposite contact | L0 = NOT A |
| `xor` | Exactly one | L0 = A XOR B |
| `half-adder` | Binary addition | L0 = A XOR B; L1 = A AND B; numeric result = 2 × L1 + L0 |
| `majority` | Three voters | L0 = at least two of S0, S1 and S2; 111 also passes |
| `river` | Wolf, goat and cabbage | L0 = danger left; L1 = danger right |
| `code-lock` | Ten-bit code lock | L0 = `1011101101` on S0…S9 AND Test held |

For the river program, S0 = farmer, S1 = wolf, S2 = goat, S3 = cabbage, with
0 = left and 1 = right. A bank is dangerous when the farmer is absent and the
goat is with the wolf or cabbage. The program detects dangerous arrangements;
the player still applies the boat rules. It does not reject a move or retain
a move history. This distinction is part of the lesson, along with the legal
seven-crossing solution. Volume 1, printed pages 38–39, supplies the historical
river-crossing teaching context; its binary arithmetic progression appears on
pages 75–83.

Ten independent binary switches have **2¹⁰ = 1024 combinations**. Including
both released and held Test states produces 2048 input combinations. Some
examples in the later Lauff guide contain arithmetic errors; the implemented
truth conditions and lesson arithmetic use independently checked values.

The presets, interface, explanations and tests are newly written for
Brickwright. They are inspired by Logikus's contact model and teaching ideas.
The application does not bundle original workbook scans or copy the original
simulator's source code.

## Follow a path and find a counterexample

**Amber means connected to Q.** It shows the part of the graph reachable from
the source through wires and currently closed contacts. A dangling wire can
be amber even when it does not reach a lamp. This is connectivity, not measured
current, voltage, lamp brightness or power dissipation.

**Purple shows one complete path to the selected lamp.** Several parallel
routes may exist; this is one explanation of why the lamp is on, not a claim
that every conducting route has been enumerated. An unlit lamp has no complete
path from Q.

**Test all states** enumerates the inputs relevant to both the edited program
and the preset goal. Including both matters: disconnecting a switch must not
make that input disappear from the comparison. Any lamp difference is a
mismatch, including an accidental output on a previously unused lamp. A
counterexample contains reproducible switch positions, the Test state and the
expected lamp values.

For a blank design there is no preset goal: the table describes the program's
behavior. An exhaustive table only proves agreement with a specification when
there is an independent specification to compare against. The guided lessons
ask the learner to predict that specification before inspecting the results.

Selecting a table row applies its inputs. For inspection, a row with Test = 1
holds that contact until the next input or reset. The ordinary **Hold Test**
button is momentary. A table selection is not a newly added memory element in
the contact circuit.

## Widgets and program interaction

**Use in Widgets** adds ten binary sliders, ten single-segment bargraph lamps,
and a momentary Test button. Existing unrelated widgets remain. Repeating the
action updates the Logikus controls without duplicating them and preserves
their layout. The panel is put into Play mode.

| Widget names | Role | Value / operation |
| --- | --- | --- |
| `logikus_S0` … `logikus_S9` | Inputs | 0 or 1; slider step 1 |
| `logikus_L0` … `logikus_L9` | Computed outputs | 0 or 1 |
| `logikus_test` | Momentary input | Pressed / released |

The visible labels can be renamed without changing these names. Names identify
the bridge endpoints, so keep them when using the connected Logikus controls.
A conflicting existing widget name is reported before the panel is changed.
Deleting a Logikus widget does not cause it to reappear during synchronization;
choosing **Use in Widgets** explicitly installs missing controls again.

The existing Controller extension reads these widgets. Its developer API uses
`controllerValue({NAME: 'logikus_S0'})` or
`controllerValue({NAME: 'logikus_L0'})` for numeric values and
`controllerPressed({NAME: 'logikus_test'})` for the Test button. With the panel
in Play mode, its existing
`setWidget({NAME: 'logikus_S0', VALUE: 1})` operation can drive a switch through
the same controller path. A program can respond to a lamp result by updating
sprites or other controls. Treat the `logikus_L*` widgets as computed results;
write the switch and Test inputs to change the circuit's behavior.

The controller connection lives outside the modal lab and outside the visible
Widgets view. Closing the lab does not stop the contact program. Test is
released on normal input release, loss of window focus, project stop and
project restoration; it is never restored as a held input from a saved file.

## Save, restore and share

The lab autosaves wiring, labels, switch settings, the selected preset goal
and controller participation in the browser. **Export** writes
`brickwright-logikus.json`; **Import** validates this format before replacing
the design. Importing a design does not silently install controller widgets.

The same state travels in a Brickwright **`.sb3` project**, in the optional
`logikus` section of `brickwright/state.json`. The normal `controller` section
carries widget arrangement and bindings. Loading a project with no Logikus
section clears the preceding project's Logikus state. A malformed Logikus
section is rejected before project-state storage writes are applied.

The workspace format is `brickwright.logikus`, version 1, with fields
`program`, `switches`, `presetId`, and `controller`. The program contains its
title, ten switch labels, ten lamp labels and wires `{id, from, to}`. Workspaces
are limited to 128 KiB and programs to 512 wires. Valid endpoints, unique wire
IDs and duplicate connections are checked. Held Test state, computed outputs,
inspection reports and undo history are transient and are not project content.

## Six guided lessons

Search for **Logikus** in Lessons. The sequence covers paths, AND/OR/NOT,
XOR/half-addition, majority testing, the river puzzle and the code-lock
controller. All six lessons have English and German guidance, hints and
manual completion checkpoints. The lessons distinguish opening a bench,
predicting a result, observing it, and explaining it. Opening the lab or
generating a table does not automatically complete a learning checkpoint.

The lab is a modal workspace. Close it to return to the lesson drawer and
record a checkpoint; reopening **Widgets → Logikus Lab** continues the current
design. **Open lesson project** selects the lesson's starting preset again.

## Model boundaries and next experiments

This is an ideal contact simulator. It does not calculate resistance, voltage,
current, supply loading, switch bounce or lamp warm-up. It collapses the
original socket triplets to nodes and does not enforce the physical limit of
three sockets per terminal group. It has no automatic clock, built-in
sequencer, flip-flop or CPU. The river program has no transition validator.
The new bridge operates Brickwright Widgets; it does not automatically bind
the contact graph to the analog circuit solver, GPIO or physical hardware.

The original books suggest useful next projects that fit Brickwright:

- **Traffic controller:** start with the manually selected traffic/pedestrian
  phases in volume 2, pages 23–26. A future sequencer can add explicit stored
  phase and elapsed time, with those new capabilities clearly visible.
- **Railway interlock:** use the single-track scenario in volume 2, pages
  30–31, to teach conflicting requests, safe outputs and counterexample tests.
- **Aquarium control:** adapt the temperature and aquarium discussions in
  volume 2, pages 37–42. A future sensor adapter could map measured thresholds
  to switch inputs and expose contradictory hot/cold indications as a fault.
- **Route failover:** the telephone-routing exercises in volume 2, pages
  26–30, motivate continuity checks and alternate-path explanations.

These are future extensions, not additional supplied presets. Direct sensor
and actuator adapters would need their own declared signal meanings and
tests; a control-panel demonstration does not establish a physical controller.

## Code map and verification entry points

| File | Responsibility |
| --- | --- |
| `src/lib/logikus/model.js` | Validated contact graph, reachability, lamp paths and truth tables |
| `src/lib/logikus/presets.js` | Nine immutable preset definitions; editable detached copies |
| `src/lib/logikus/inspection.js` | Relevant input discovery, comparison and counterexamples |
| `src/lib/logikus/workspace.js` | Validated persistence format and size limit |
| `src/lib/logikus/controller-bridge.js` | Two-way input synchronization and computed lamp widgets |
| `src/components/tw-pseudocode/logikus-host.jsx` | Persistent controller lifetime, opening and project restoration |
| `src/components/tw-pseudocode/logikus-lab.jsx` | Operate / Wire / Truth table interface |
| `src/components/gui/lesson-waves/logikus-9.json` | Bilingual guided lesson content |

The paths above are relative to `overlay/scratch-gui/`. This code and its
lessons are app-owned; they do not modify the example gallery vendored from
`sb3-creator`.

The focused tests are `test/logikus-model.test.mjs`,
`test/logikus-integration.test.mjs`, `test/logikus-inspection.test.mjs`, and
`test/logikus-lessons.test.mjs`, `test/logikus-lab.test.mjs`, and
`test/logikus-host-lifecycle.test.mjs`. They cover independent truth-condition
oracles, exact contact behavior, invalid input, controller operations, project
round-trips, counterexamples, actual React interactions and project lifecycles,
and the numerical claims in the lessons. Test
results and browser/release verification should be recorded for the actual
commit being delivered.
