# x86 user paths in Lite

Current documentation checkpoint: 2026-10-27; see [the handoff and acceptance tasks](X86-NEXT-LANES.md#current-handoff-2026-10-27). Main selects board `836867513c3e7fac420ddaa32c17e1c7b6d3e513` in [vendor-pins.json](../vendor-pins.json). This is a source-backed guide, not a fresh installed-browser or guest acceptance. PR1318 remains pending, and newer board qualification does not silently update this consumer. The original guide checkpoint was [Lite 2796d2f5](https://github.com/CrispStrobe/brickwright/tree/2796d2f5ac344986a9fb870d0b2f06344b3d259b) with board `3b03d226`.

## Pick the right machine

| Route | Use | Boundary |
|---|---|---|
| Functional 8086 DOS bench | Authored/free `.COM` and MZ `.EXE`, Code/DOS-service workflows | Does not boot an OS disk or select wired execution. |
| Functional 8086 board | Supported BIOS/floppy manifest | Requires its board configuration and BIOS; program-service results are separate. |
| Wired 8086 circuit | `executionMode: "wired"` plus `circuit.ref` and its realized circuit | Functional DOS-service/floppy proofs are separate from actual pin/bus execution. |
| Wired Harris 80286 | An explicit circuit reference and admitted circuit backend | Not selected by DOSBox CPU settings or an ordinary DOS variant. |
| Experimental functional 386 AT | Machine Manager raw disks or the named FreeDOS VGA profile | No wired 386 route or general native-addon guest loader is implied. |

For runnable Node commands, see the [board user paths](https://github.com/CrispStrobe/bw-board/blob/master/docs/X86-USER-PATHS.md) and [loading guide](https://github.com/CrispStrobe/bw-board/blob/master/docs/X86-LOADING-GUIDE.md). The live 386 CLI is a TTY console with keyboard, Ctrl-] quit and Ctrl-L redraw; it is separate from this browser debugger.

## Open a local disk

1. In **Code**, open **Manage machines…** from the machine/device controls.
2. For an arbitrary supported raw HDD, use **Boot a local DOSBox HDD**. Select the disk and optionally its `.conf`, then **Boot disk**. This always selects the functional 386 AT. The selected filename and explicit `imgmount -size` geometry must agree. Explicit geometry requires four values and 512-byte sectors; malformed, repeated or unsupported `-size` declarations are rejected. Automatic geometry applies only when `-size` is omitted and only covers the documented 4-head/17-sector case.
3. For the named route, use **FreeDOS VGA (named 386 profile)**, choose supported floppy/HDD files and optionally BIOS/VGA ROM files, then **Boot FreeDOS VGA**. This applies media, resets and starts the machine. The preset's fixed HDD geometry is not an arbitrary-disk geometry detector.
4. Leave **Native blocks (experimental)** unchecked for ordinary execution. That option is not the separately reviewed Bochs native addon.
5. Open **Controller** / Widgets and focus the **AT VGA** screen for keyboard input. **Play** enables widget interaction; **Edit** changes widget layout. These controls do not reset the CPU.

**Full screen** enlarges the Controller pane; **Exit full screen** returns to the layout. This does not change guest video resolution. Pointer capture supports drags; there is no Pointer Lock, and the guest must enable PS/2 mouse reporting. Browser-reserved keys and screen-edge relative movement remain limitations.

Selected file bytes live only in this tab; they are not uploaded, saved in the machine library or exported with reusable configuration. Saved/imported configs retain URL references and fetch on Run, checking supplied hashes. A pasted host pathname does not grant browser filesystem access. Disk changes remain in memory unless a separately documented export workflow supplies persistence.

## Import and format limits

| Input | What the reviewed route does |
|---|---|
| Machine config / `brickwright-media.json` | Imports configuration and media references; **Run** activates them. |
| DOSBox `.conf` | Translates a subset of CPU/machine/program/image declarations. `mount` is provenance, not a host-directory mount; arbitrary autoexec commands do not run. |
| Raw floppy / HDD | Loads supported slot bytes and geometry. A `.vhd` suffix does not decode a VHD container. |
| ZIP / JS-DOS bundle | No general package extraction in these forms. Unpack separately and inspect the supported input. |
| ISO / CD | No reviewed CD/ATAPI, ISO-filesystem or El Torito route. Renaming the input is not conversion. |
| Debugger firmware picker | `.bin`, `.hex`, `.ihx` firmware; not a disk/ISO/package picker. |

## Debug the running machine

Open **Debugger** to enlarge the debugger view rather than the Controller screen. The dock is available across Circuits/Code, but its presence is **not a complete 386 debugger qualification**. Lite's pinned board composes the 386 adapter with an 8086-shaped target. Debug-event register capture calls a method that the 386 AT explicitly rejects; an active subscriber can make stepping fail before instruction retirement.

| Surface | Existing shared behavior | 386 qualification limit |
|---|---|---|
| Run/Pause/Step | Forward instruction controls | Ordinary running exists; debug subscription can fail. Do not promise a working traced step until corrected. |
| Step over/out, run to address | Shared 8086 target advertises these | 16-bit decoding/control flow and 20-bit address/run-to bounds are incomplete for protected-mode/32-bit code. |
| Code/write/port/interrupt breakpoints | Shared hooks and capability declarations | Full 386 address/event capture is not qualified. Pending IRQ is not delivered IRQ; write does not mean read watchpoint. |
| Registers/disassembly/memory | 8086-style inspection | AX-style register projection/8086 disassembler are not full EAX/EIP/segment-cache or 32-bit protected-mode inspection. |
| Cycle/phase step | Not advertised | No physical bus-cycle step promise. |
| 386 checkpoint/replay | Explicit refusal | No reverse/replay claim. |

See the pinned [shared target](https://github.com/CrispStrobe/bw-board/blob/3b03d226cb1e7ecfcbbd28bc42fe492f8d2b6cf1/src/i8086-debug.js) and [386 AT refusal](https://github.com/CrispStrobe/bw-board/blob/3b03d226cb1e7ecfcbbd28bc42fe492f8d2b6cf1/src/experimental/i80386-at-machine.js). A separate correction must establish source-backed 386 semantics or explicit refusals before an installed GUI debugging claim.

## Evidence and the next useful check

Existing [FreeDOS interaction acceptance](I80386-FREEDOS-INTERACTION.md) covers one bounded real Chromium shell/input/pane-switch scenario; its earlier failures and remaining mouse/input limitations stay recorded. [The 386 GUI guide](I80386-GUI.md) distinguishes synthetic media-attachment checks from actual boot. Board-only MIT xv6 and owned DOS32A/DPMI client completions, including existing high-memory/timer acceptance, do not qualify the current installed Lite package.

[Media Lab](https://github.com/CrispStrobe/brickwright-media-lab) keeps separately licensed software/assets outside the app. Its Minix 2 README's login/shell narrative is historical project evidence, not newly audited here. Freedoom/FastDoom was not executed in its packaging environment; OpenGEM's full-run proof remains pending. Use free or authored examples and their exact notices, not an assumption that every packaged project runs.

Coordinate a supplier-pin update with its active owner before editing shared package/lock/generated files. After the separate debugger correction, qualify one existing free client through the actual installed package: visible completion/input, pause, breakpoint, step, register/memory change, resume and pane switch without losing the session. Record the exact package/pin/source and observable failure state. This guide changes no pin and claims no new GUI adoption, performance, physical RTx or full OS compatibility.

## Finite inventory bootstrap checkpoint — 2026-10-26

The [once-selected finite V7 inventory](https://github.com/CrispStrobe/brickwright/actions/runs/40352829291)
failed Chromium dependency setup before inventory observation. Its failure is
retained and the event is spent. The [distinct F8 lane](../lanes/2026-10-26-x86-finite-v8-browser-bootstrap.md)
starts disabled and reuses the existing official-Ubuntu mirror preparation
helper unchanged, with explicit Git/workspace source admission before package
setup. Historical readers, supplier identities and limits remain separate.

This bootstrap source change adds no GUI feature or successful installed graph.
Fresh source/Build and F8 original qualification are required before the
separate actual-V8 HDD/JSON export, fresh reload/readback and forward-debug
acceptance. Those actual GUI results remain pending; no whole-OS, physical or
performance result follows from bootstrap or synthetic controls.

## Reviewed F8 source arming — 2026-10-26

The preceding bootstrap checkpoint records disabled Phase A. A separately
reviewed source commit now arms only the F8 producer, independent reader and
workflow route. F7 execution stays retired; its failed original and historical
reader are retained. Fixed supplier epochs, the unchanged mirror helper and
all limits are held. Source controls pass, but final exact-head source/Build
qualification and separate one-shot F8 admission remain pending. Actual V8
GUI export/reload and forward-debug acceptance remain unselected and unproved.

## Finite V9 resolver-role source checkpoint — 2026-10-27

The [once-selected V8 inventory](https://github.com/CrispStrobe/brickwright/actions/runs/40422314383)
passed source and trusted setup, then refused `/etc/resolv.conf` because its
selected alias role did not match the observed regular file. Its independent
negative reader joined the event with qualification false. Preserve that
failure and the earlier V7 setup failure; both events are spent.

The [distinct V9 continuation](../lanes/2026-10-27-x86-finite-v9-resolver-role.md)
has a disabled source candidate selecting only that path as a regular file.
Historical V8 wire meanings and strict alias checks remain held. Source controls
and pin-role separation do not qualify a new hosted inventory. Separate reviewed
arming, exact-head source/Build admission, one V9 event and independent original
reading precede native/runtime joins and the still-pending actual-V8 FreeDOS
export/reload and forward-debug GUI acceptance.

Current source status: [separately reviewed V9 arming](../lanes/2026-10-27-x86-finite-v9-resolver-role.md#separate-v9-source-arming-checkpoint--2026-10-27)
is armed but unselected; final source CI, Build admission and actual events remain pending.
