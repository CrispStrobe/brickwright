# Design spike: letting a Code-tab DOS language drive the board

For the current Cowgol implementation, including canvas/circuit conversion and
native CP/M/DOS execution, see [Cowgol support and limits](COWGOL.md). This page
retains the earlier DOS-interpreter host-call design discussion.

*Status: design + verified primitive. Not implemented. Needs one owner decision
(the device/port surface) before build. — 2026-10-12*

## The question

The Code tab's optional languages (fe · Tcl · Forth) run on the **8086 DOS
service bench**: a program is generated from blocks, mounted as `PROG.<X>`, and
a shipped interpreter (`static/roms/*.exe`) evaluates it. Today their only
output is **text** (`say` → console). They do not touch the machine's device
state — GPIO pins, LEDs, motors — the way the Scratch blocks + the lite dialect
do (those plug straight into the VM's device model).

Can a DOS-tab language *drive the board*? Yes in principle, and the two
load-bearing mechanisms already exist and are verified here. What's missing is a
small, deliberate integration and one surface decision.

## The two verified facts this rests on

1. **The interpreter has a host-syscall extension point a generated word can
   reach.** zForth's `sys` is a VM primitive: `<id> sys` calls the C front-end's
   `zf_host_sys(ctx, id, …)`. `core.zf` already wires `emit`=`0 sys`,
   `.`=`1 sys`, `tell`=`2 sys`, `quit`=`128 sys` (a *user* syscall, id ≥ 128).
   A generated word `: pin! 132 sys ;` would therefore call a new host handler.
   **Verified on the shipped `forth.exe`:** a program that runs `quit` (which is
   `128 sys` → the front-end's `ZF_SYSCALL_USER + 0`) short-circuits — the line
   after `quit` never prints (`test/dos-compile.test.mjs`, "a user syscall …
   reaches the host"). fe (C functions) and partcl (Tcl commands) have the
   equivalent extension point.

2. **The DOS bench already exposes port I/O.** `bw-board`'s i8086 machine fires
   `machine.hooks.onPortAccess({dir: 'out'|'in', port, value})` on every `OUT`
   and `IN` (`src/i8086-machine.js`). An 8086 `OUT dx, al` emitted by a host
   syscall is observable by the embedder — the lite DOS runner — which can map a
   port to a device register. (This is the same substrate the SmallerC route
   uses with its injected `bw_outb`/`bw_inb`.)

So the bridge is: **generated word → `sys` → host syscall does `OUT`/`IN` →
`onPortAccess` → lite maps the port to a device/GPIO register → the machine
surface (Widgets pane) shows it.** No new emulator, no recompile of the VM core
— a recompile of the *front-end* (a new "driving" interpreter build) plus
plumbing.

```
 blocks            generateForth           forth.exe (driving build)        bw-board i8086            lite
 ┌──────────┐      ┌─────────────┐         ┌──────────────────────┐        ┌───────────────┐        ┌──────────────┐
 │ set pin 3│ ───► │ 3 1 pin!    │ ──PROG─►│ zf_host_sys USER+4:  │ ──OUT─► │ onPortAccess  │ ─────► │ device model │
 │  to on   │      │             │         │   OUT (0xBW0+pin), v │        │ {out,port,val}│        │  → Widgets   │
 └──────────┘      └─────────────┘         └──────────────────────┘        └───────────────┘        └──────────────┘
```

## The one owner decision

**Which device surface, and which ports map to it?** Options, cheapest first:

- **A tiny GPIO LED strip** (e.g. 8 pins → 8 indicators on the Widgets pane).
  Smallest new surface; a pin write lights a box. Ports `0xBW0..0xBW7`.
- **The existing `simplevga` / machine-screen surface** the Widgets pane already
  mirrors. A DOS program can already write VGA memory (`0xB800`); a `vc!`
  syscall (char at col,row) would show text/graphics with *no* new device model
  — but it's a display, not GPIO/motors.
- **A motor/sensor model** mirroring the Scratch device blocks. Richest, but the
  biggest surface and the one most entangled with the VM's existing device state.

I recommend starting with the **GPIO LED strip**: it is self-contained, needs no
change to the Scratch device model, and is the clearest demonstration of "a
DOS-tab language drove the board." The port-base and pin count are the only
constants to fix.

## Implementation plan (per repo, once the surface is chosen)

1. **Interpreter — a "driving" build** (media-lab `forth-dos` variant, or a
   `forth-io` sibling): add `ZF_SYSCALL_USER + N` handlers in the front-end that
   do `OUT`/`IN` via inline asm (`__asm out (dx), al __endasm` under ia16-gcc),
   and `core.zf`-level words `: pin! 132 sys ;` `: pin@ 133 sys ;`. Ship it as a
   new `static/roms/forth-io.exe` with provenance, exactly like `forth.exe`.
   (The same pattern gives fe `(pin! p v)` and Tcl `pin! p v`.)
2. **lite DOS runner** (`bw-debug/dos-compile.js` / `runDosToolchain`): accept an
   `onPortAccess` and translate port writes in the chosen range into a device
   register array; expose it to the caller.
3. **lite VM/Widgets**: feed that register array into the chosen surface (a GPIO
   widget, or the existing machine screen), so pin writes are *observable*.
4. **Generator** (`bw-lang/forth.js` + fe/tcl): a "set pin P to V" / "pin P is
   on?" block ⇄ `P V pin!` / `P pin@`, with a refusal if the shipped interpreter
   is the plain (non-driving) build.

Each step is independently testable on the real bench (the DOS-compile tests
already run programs end-to-end; a captured-ports assertion is a one-liner once
the runner threads `onPortAccess`).

## Scope boundary (what this spike is NOT)

This document and its companion test establish the **extension point** and the
**bench port hook** — nothing more. No driving interpreter is built, no port is
mapped to a device, no block is added, and nothing drives a real or simulated
motor. The semantic/float caveats of each interpreter (e.g. integer cells on the
Z80/CP-M build, see media-lab `forth-cpm`) are orthogonal to this bridge.
