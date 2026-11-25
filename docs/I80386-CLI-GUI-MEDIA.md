# Load and use x86 guests from CLI and GUI

This guide describes source available on 2026-10-24. A loader accepting an input
does not establish that its guest boots. Current installed-browser HDD
export/reload and forward-debug qualification remain pending. Use FreeDOS or
owned freely licensed fixtures and retain each component's licence notices.

## Choose an execution path

| Path | Entry point | Intended input and boundary |
|---|---|---|
| Functional 8086/80286 DOS service | Board `scripts/run-dos.mjs` | `.COM`/`.EXE` with an emulated DOS service; separate from booting an AT operating system. |
| Wired 8086/Harris 80286 | An explicitly configured circuit and backend | Circuit-level wiring experiments. A DOSBox CPU setting does not select this path. |
| Experimental functional 386 AT | Board console or Lite Machine Manager | Raw disk/floppy, BIOS and VGA; ordinary JavaScript by default. There is no wired 386 equivalent. |
| Experimental accelerated 386 | Explicit native-block or Code16 WASM options where exposed | Separate execution choices with their own limitations and qualification. They do not establish a native-addon or physical bus model. |

## Board CLI

Run these commands from a checkout of
[bw-board](https://github.com/CrispStrobe/bw-board), with Node and the selected
free inputs available. Names below are relative example files.

For a DOS program:

```sh
node scripts/run-dos.mjs PROGRAM.COM --variant 8086 --preset xt --max 1000000 --screen
node scripts/run-dos.mjs PROGRAM.EXE --variant 80286 --preset at --max 1000000 --screen
node scripts/run-dos.mjs --dosbox-conf dosbox.conf --variant 8086 --screen
```

`--keys TEXT` supplies input; repeated `--file DOSNAME=FILE` supplies DOS files;
`--out DIR` writes supported outputs. The config importer understands a subset
of DOSBox declarations and a selected program. It does not run an arbitrary
host shell or recursively mount host directories. The functional 80286 choice
does not select the distinct BIOS-booting 286 AT profile.

For the experimental 386 AT console, set `AT_BIOS_ROM`, `AT_BIOS_SHA256`,
`VGA_BIOS_ROM`, `VGA_BIOS_SHA256` and `AT_HDD_SHA256` to the selected files and
exact SHA256s, then run:

```sh
node scripts/run-i80386-at-console.mjs --hdd-image disk.img --geometry 306,4,17 --steps 1000000 --live
```

The example CHS applies only to a matching 10,653,696-byte image. Supply the
actual supported geometry for other images. `--dosbox-conf dosbox.conf` can
supply a supported raw image declaration and geometry instead. Optional
`--floppy-image floppy.img` also requires `AT_FLOPPY_SHA256`. A step budget is
a bound, not a boot-completion guarantee.

`--live` requires a terminal: type to send keys, use Ctrl-] to quit and Ctrl-L
to redraw. SGR mouse input depends on the terminal and guest enabling mouse
reporting. The CLI does not open a DOSBox-style graphical window.
`--hdd-output saved.img` writes a new raw image after an admitted safe stop on
the ordinary JavaScript path; it refuses overwriting an existing output.
`AT_CONSOLE_REPORT` selects a separate report file, not the disk export.
`--native-blocks` and `--code16-wasm` are explicit experimental alternatives.

See the Board [loading guide](https://github.com/CrispStrobe/bw-board/blob/master/docs/X86-LOADING-GUIDE.md)
for exact argument, size and hash admission rules.

## Bounded headless xv6 compatibility

One [owned hosted xv6 run](https://github.com/CrispStrobe/bw-board/actions/runs/40052112356)
passed three headless compatibility cases: a filesystem command with 4 MiB RAM,
a shell with 14 MiB, and `forktest` with 4 MiB. Its reviewed
[Board head 0518babf](https://github.com/CrispStrobe/bw-board/commit/0518babf70d9c4a6563b2fd2c1bb3ab1c1a4cc1e)
ran checkout
[18d1b585](https://github.com/CrispStrobe/bw-board/commit/18d1b585192172581c4a66362b9b2dbc98c43529),
with [tree f01819f5](https://github.com/CrispStrobe/bw-board/tree/f01819f567702d988eb76db3f6fc19a39440d937);
all 78 reported source hashes matched that checkout. This is bounded ordinary
compatibility with APIC/CR4.PSE extensions. It does not qualify strict 386DX,
current Lite GUI execution, a full OS, or physical 16 MHz/RTx behavior.

## Lite GUI

1. In **Code**, choose **Manage machines…**.
2. Choose **Boot a local DOSBox HDD**, select a raw image and optional `.conf`,
   then **Boot disk**. An explicit `imgmount -size 512,sectors,heads,cylinders`
   must match the selected image. Automatic inference covers only the supported
   four-head, seventeen-sector case.
3. Alternatively choose **FreeDOS VGA (named 386 profile)**. It accepts a
   supported 360 KiB or 1.2 MiB floppy and/or its fixed 306×4×17 raw HDD,
   with optional BIOS and VGA ROMs. Choose **Boot FreeDOS VGA**. With both
   disks attached, the floppy boots and the HDD is the data disk.
4. Open **Controller** / Widgets, select **Play**, and click **AT VGA** to focus
   keyboard input. **Edit** changes widget layout. **Full screen** expands the
   pane; it does not change the guest's display resolution. Pointer capture
   supports dragging, with screen-edge and browser-reserved-key limitations.
5. Open **Debugger** for Run/Pause/Step and the supported breakpoint, register
   and read-only memory views. Full-width forward-debug acceptance in the
   current installed package is still pending; do not infer reverse execution,
   physical cycle stepping or arbitrary protected-mode debugging.

The session is retained across the supported Circuits/Code pane switches.
Saved machine configurations contain browser-resolvable media URLs; a host
pathname is not a browser filesystem mount. Local selected bytes stay in the
current tab. Pause before using an available disk-download action. An exported
image/geometry sidecar is not imported as a machine config; select the raw
image again with its matching geometry. Fresh-session persistence qualification
is a separate pending check.

## Current GUI qualification work

The [current source candidate](https://github.com/CrispStrobe/brickwright/pull/1318)
prepares a distinct finite inventory v4 bootstrap; actual GUI execution remains
disabled. Its next acceptance sequence is:

1. Select a new core-runtime/library scope and canonical body/SHA. Preserve the
   historical failed 306-file global-font roster unchanged. Before package or
   Chromium setup, the guard checks the exact source/event and all 21 tracked
   source files; after trusted setup, inventory records current runtime and
   the complete installed Circuit UI census. Library-closure, font-selection,
   browser and guest approval remain false. Use one admitted current event and
   the standalone original-only reader, without replaying consumed originals.
2. Separately admit a successful native-font original from the selected
   five-file source, its outside-service original, and an exact current Build
   whose actual checkout tree matches the selected GUI source. Earlier runs
   and metadata cannot supply installed state to this job.
3. Admit the current inputs/resources and v5 request, then qualify real HDD
   export, fresh-session reload and forward debugging in the installed browser.
   Source tests and the headless xv6 case above do not qualify those GUI paths.

The [owned admission lane](../lanes/2026-10-23-x86-gui-current-actual-admission.md#current-finite-inventory-v4-bootstrap--2026-10-24)
holds the detailed source, event and reader contract. Heads, trees and
request/template SHA bindings must be regenerated when the selected source
changes. An unbound proposal is not an approved event or request. The existing
Chromium/Board-JavaScript cases do not require an Arcade change or QEMU setup.

## DOSBox packages and image formats

| Input | Supported route or remaining gap |
|---|---|
| Raw HDD `.img` | CLI AT console or GUI local HDD; explicit supported CHS and exact byte size are required. |
| Raw floppy | Explicit CLI floppy or named GUI FreeDOS route with supported size. |
| DOSBox `.conf` | A restricted translation of configuration and image/program declarations, not general DOSBox compatibility. |
| Bounded STORED ZIP HDD package | Current GUI **Local DOS package (STORED ZIP)** → **Boot package HDD**. Source is present; fresh installed guest acceptance remains pending. |
| Compressed ZIP, JS-DOS package, arbitrary COM/EXE archive | No general package loader in this slice. CLI same-archive loading is unsupported. |
| ISO/CD-ROM, VHD container | No reviewed ISO boot/CD-ROM slot or VHD decoding. Renaming a file does not convert it. |
| `brickwright-media.json` / machine-config JSON | Imports configuration with media references; **Run** activates it. Debugger firmware pickers are separate. |

The bounded ZIP route requires exactly one `dosbox.conf`, one matching
config-relative raw HDD `.img`, explicit HDD CHS and `boot -l c`. Optional
`LICENSE.txt` notices are allowed. Entries must be uncompressed STORED regular
ASCII names, with no extra fields/comments, at most 32 entries and 16 MiB total;
config text is limited to 16 KiB. Unsupported commands/members fail visibly.
There is no arbitrary autoexec interpreter, missing-member download or host mount.

[Media Lab](https://github.com/CrispStrobe/brickwright-media-lab) keeps separately
licensed media and notices outside the app. FreeDOS, ELKS, xv6 and authored
fixtures are candidates for distinct tests; their availability does not prove
current GUI compatibility. See [the GUI guide](I80386-GUI.md) for earlier bounded
FreeDOS interaction evidence and its unresolved input limits. A previous guest
result cannot qualify a newer build or a different execution path.
