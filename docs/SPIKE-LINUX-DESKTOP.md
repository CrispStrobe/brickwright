# Local Linux desktop package

For completed package/release evidence and the distinction between an upload
and actual tester availability, start with the
[current integration handoff](INTEGRATION-NEXT-STEPS.md#start-here-current-closeout).
This document describes the builder and its finite Linux acceptance boundary;
it does not authorize a new build or establish production-runtime distribution.

The offline builder assembles a Linux x64 `.deb` from a built Brickwright GUI,
a separately supplied Renode distribution and the closed MicroPython support
profile. Optional source-built guest and full NuttX profiles can be included.
It does not download firmware, bundle external user images, upload artifacts,
or install anything into the system. Keep its output outside public repositories.

```sh
node scripts/build-spike-linux-desktop.mjs \
  /private/staged-micropython-support /path/to/renode-distribution \
  /path/to/qualified-gui-build /private/new-linux-package
```

Prepare support with the Renode repository's `tools/stage_prime_micropython.py`.
Use a GUI build from the same source revision. Cargo dependencies must already
be cached: the builder uses `--locked --offline`. Linux development prerequisites
are the normal Tauri GTK/WebKit packages, Node, Rust/Cargo and `dpkg-deb`.
Allow several GB of free build space. `--prepare-only` verifies/stages resources
without invoking a compiler or building an installer. An existing output,
including a partial build, is preserved and refused. A dedicated existing cache
can be selected with `BW_LINUX_BUILD_TARGET_DIR`; use only a cache you own.

The builder copies the native source closure into a private build directory and
selects only the Rust library target needed by desktop. The repository retains
its mobile library targets. Desktop embeds the GUI in the executable; the mobile
entry point still creates its context in the mobile library. This prevents a
second large GUI copy in desktop Rust library metadata.

The installed layout is `usr/bin/brickwright-tauri` with resources under
`usr/lib/Brickwright` (the configured Tauri product name). Compile pins use paths relative to that resource
directory. The resource closure includes the exact Renode executable, fourteen
named native libraries, the runtime root marker and upstream monitor helper,
supplied notices and the seventeen verified support
artifacts. Test tools, plugins and firmware directories from the runtime input
are excluded. File hashes and package receipts are recorded privately.

You can inspect/extract the installer without changing the system:

```sh
dpkg-deb --info /private/new-linux-package/brickwright_0.1.23_amd64.deb
dpkg-deb --extract /private/new-linux-package/brickwright_0.1.23_amd64.deb /private/new-install
/private/new-install/usr/bin/brickwright-tauri
```

This builder configures the independent browser simulator and the supplied
MicroPython arena route. In the sandbox select MicroPython, choose your local
`.bin`, `.hex` or single-application `.dfu` through the native file chooser, and
run supported Code-tab Python. Six-motor topology exposes A–F with A/B as rover
wheels. The virtual hub panel exposes raw hub inputs while a supported firmware
session is running. Stop closes only that session. Images are local user inputs;
checks establish supported geometry/integrity, not firmware authenticity.

To include already staged source builds, add `--guest /private/staged-guest` and
`--nuttx /private/staged-nuttx`. These options freeze the closed manifests without
building firmware. The freezer verifies each digest, firmware identity and ARM
ELF32 header, preserves required notices, checks flash seed geometry, and accepts
only the known scenario templates. It rewrites their staging paths relative to
the included scenario origin, then regenerates scenario and manifest digests.
The flash seed uses that monitor origin explicitly because Renode changes the
process working directory to its runtime directory.
These checks establish consistency of supplied source-build declarations; they
are not proof of firmware origin or physical-hardware behavior.

Guest, NuttX and MicroPython live in separate resource directories and share one
verified Renode executable. The supervisor resolves fixed profile leaves under
Tauri's resource directory and refuses mixed relative/absolute profile modes.
Legacy separately configured absolute profiles remain supported. The builder
clears inherited `BW_RENODE_*` compile variables before applying its own pins, so
an unrelated workspace profile cannot override the installed package. Receipts
list included source-built profiles and continue marking redistribution as
unqualified. Full installed-GUI qualification of these optional combined profiles
must be recorded separately from the previously tested MicroPython-only package.

The supervisor registers launch ownership before starting its worker. A creation
timeout requests cancellation and keeps that ownership until process and private
resource cleanup completes; another launch cannot overlap the pending cleanup.
Normal Stop, close and timeout terminate the owned process group. On Linux the
persistent spawning thread also installs a parent-death signal, so abrupt desktop
termination kills the direct simulator child. This additional crash protection
does not cover forked descendants and is not qualified on other operating systems.

The Linux owner-death tests retain immediate owner death after child admission
and separately check a fresh delayed live-owner case. Both use the original
three-second post-crash assertion. They bind the expected parent and group leader
before holding a kernel process descriptor. They retain the original three-second
termination assertion, refuse incomplete PID publication and observe termination
through that held identity. Cleanup signals only the admitted direct child.
A negative fixture reads back the supervisor's registered kill signal, clears it,
then demonstrates survival through the same bound before exact cleanup. Linux
source tests require pidfd support and `/usr/bin/python3`; the Python fixture runs
isolated from inherited Python settings and adds no application dependency.
The earlier [native test failure](https://github.com/CrispStrobe/brickwright/actions/runs/40765450230)
is retained and remains unattributed; the observation repair does not establish
its cause or change production launch behavior. See the
[bounded claim](../lanes/2026-10-28-linux-owner-death-observation.md).

Original LEGO images remain a private bring-up path, without a
qualified Code-tab arena backend. See [NuttX](../SPIKE-NUTTX.md),
[MicroPython](spike-micropython-gui.md) and
[flash persistence](spike-flash-persistence.md) for their tested boundaries.

New builder and desktop packaging additions are BSD-3-Clause. Existing notices
remain applicable. Copying runtime notices alone does not establish redistribution
compliance. The current Renode distribution audit still needs matching .NET
native notices/provenance, an embedded-component inventory and applicable
copyleft source/relink evidence. Receipts therefore explicitly record
`redistributionValidated: false`; assembled packages stay private until that
review is complete. The commands reproduce the assembly process and record exact
inputs; they do not claim byte-identical Rust builds or physical SPIKE accuracy.


## Restarting a retained NuttX program

With retained-restart-capable full NuttX firmware, the arena offers **Restart
program** after completion, Stop or a runtime fault. This sends START for the
program already retained by the guest; it does not compile the current editor,
upload replacement bytes, reload storage or create a new emulator session. Use
the Code-tab Run action to upload edited source. Loading saved storage remains
explicit and reaches READY; **Run loaded program** starts that loaded program.

The arena exposes Stop while a program start is pending. Stop cancels a queued
START or sends STOP after an in-flight START, retaining the program/session.
Closed, uncertain, busy or uncommitted sessions refuse restart; errors from older
firmware remain visible. Completion feedback is rearmed only after an accepted
RUNNING response, and late responses cannot update a disposed/replacement pane.
Restarting a faulting program may reproduce its fault. No physical hub upload is
involved.

The focused command/session and actual-pane-method regressions are reproducible
from the repository root:

```sh
node --test test/spike-nuttx-restart.test.mjs test/spike-renode-arena-session.test.mjs test/spike-code-run-feedback.test.mjs
```

These synthetic boundary tests do not replace the actual guest and installed
GUI qualification required when adopting new firmware/package inputs.

The source-only native qualification driver imports the production policy,
supervisor, image-admission/staging and program-UART contract modules. Its unit
checks are reproducible independently of a WebView:

```sh
cargo test --locked --offline --manifest-path tools/renode-arena-proof/Cargo.toml
```

Execution through this closed test transport still requires the exact staged
package pins. It exercises the native runtime boundary, but does not establish
installed-GUI or Tauri ACL acceptance.


## Linux staging permissions

Use a new output directory on a filesystem that preserves Unix permission modes.
Preparation verifies its private mode before copying resources or compiling the
native application. Mounts with fixed modes are refused with an explicit staging
error; choose a POSIX staging directory and archive the completed package and
receipts afterward. Build targets also need executable filesystem support.

Before Debian assembly, the builder sets directories to `0755`, ordinary resource
and control files to `0644`, and only the desktop application and Renode executable
to `0755`. This makes resources readable after installation assigns root ownership,
independently of the build umask or input modes. Symlinks, special files and missing
native executables are refused. File contents, source pins and digest seals remain
unchanged. These checks do not close component provenance or redistribution review.

```sh
node --test test/spike-linux-package-modes.test.mjs test/spike-linux-package.test.mjs
```

## Distributed component inventory (G05, Linux, unqualified)

Derived from `scripts/build-spike-linux-desktop.mjs`, `apps/tauri/src-tauri/tauri.conf.json`,
`Cargo.toml`/`Cargo.lock` and the generated Rust section of
[THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md). This is an inventory, not a
licence clearance; `redistributionValidated` stays `false`.

| Installed component | Origin / provenance pointer | Licence (as declared) | Status |
|---|---|---|---|
| `usr/bin/brickwright-tauri` (debug-symbol-free dev build, desktop `rlib` profile) | This repository, `apps/tauri/src-tauri`; source closure hashed in `native-source-inputs.json` | BSD-3-Clause | Source-to-binary join is the recorded binary SHA only; no reproducible-byte claim |
| Statically linked Rust crates: 365 linked into the Linux binary (`custom-protocol`, `x86_64-unknown-linux-gnu`), 92 build-time only, 161 not linked on this target | [`docs/generated/spike-linux-crate-inventory.json`](generated/spike-linux-crate-inventory.json), generated by `scripts/gen-spike-linux-crate-inventory.mjs` from `cargo metadata --locked --offline`, bound to the Cargo.lock SHA-256 | Per crate in the inventory; review in [`spike-linux-licence-review.json`](spike-linux-licence-review.json) | Builder installs each linked crate's own licence files under `usr/share/doc/brickwright/rust-crates/`; 13 crates need the reviewed supplemental texts and per-file digests described below |
| `tauri-plugin-blec` git fork | Exact `rev` pin in `Cargo.toml` | Declared permissive in the generated list | Fork provenance by commit pin only |
| Embedded GUI (`frontendDist`) | Supplied GUI build; every file hashed in `build-inputs.json` | Lite BSD-3 plus [package notices](PACKAGE-UPSTREAM-NOTICES.md) | Must come from the same source revision; not re-verified at compile time |
| `renode/renode` + 14 named native libraries (.NET runtime `libcoreclr`, `libclrjit`, `libhostfxr`, `libhostpolicy`, `libSystem.*`, `libMono.Unix`, `libmscordaccore`, `libmscordbi`, `libllvm-disas`) | Separately supplied Renode distribution; hashes in `build-inputs.json` | Renode MIT; .NET runtime MIT; `libllvm-disas` LLVM (Apache-2.0 WITH LLVM-exception) — **unverified**, only supplied `licenses/*-license` notices are copied | Matching .NET native notices and source provenance still open |
| `renode/.renode-root`, `renode/scripts/monitor.py` | Renode distribution | Renode MIT (unverified per file) | Copied byte-exact |
| `renode/licenses/*-license` (at most 128; must include `renode-license`, `tlib-license`, `dotnet-runtime-0-license`, `dotnet-runtime-1-license`, `mono-unix-pinned-license`, `libllvm-disas-license`, `llvm-license`) | Renode distribution | As supplied | Required set enforced by the builder; the installed reference image carries all seven and 109 notices total. LGPL/GPL-referencing notices are flagged in the review |
| `micropython/` support profile (17 verified artifacts incl. Renode models, platform `.repl`, state/mailbox tools, boot seed, `licenses/renode-models-MIT.txt`, `licenses/brickwright-BSD-3-Clause.txt`) | `stage_prime_micropython.py` output; manifest digests checked by `prepare-spike-micropython-pins.mjs` | MIT / BSD-3-Clause | See [installed resources](spike-micropython-installed-resources.md); legacy overlay vs compiled support pairing is enforced at pin preparation (separate PR) |
| Optional `guest/`, `nuttx/` profiles | Source-built staged profiles frozen by `scripts/lib/spike-resource-profile.mjs` | Per their preserved notices (NuttX Apache-2.0; firmware notices per L11) | Firmware L11 / Runtime coordination open |
| `usr/share/applications/brickwright.desktop`, `DEBIAN/control` | Generated by the builder | BSD-3-Clause | — |

External user firmware images are never bundled. System libraries named in
`Depends` (GTK 3, WebKitGTK 4.1, libstdc++, zlib) are not distributed.

### Licence review of the linked crate set (2026-10-24)

The review file records, per flagged licence, the obligation and whether it fits
the policy (accepted MIT/BSD/Apache/MPL/LGPL; GPL only with a reviewed exception).
It is a notice-obligation review, not a licence clearance.

| Licence | Linked crates | Obligation | Policy |
|---|---|---|---|
| Unicode-3.0 | 15 icu4x-family crates, plus `unicode-ident` (`(MIT OR Apache-2.0) AND Unicode-3.0`) | Keep the copyright and permission notice | Notice retention, compatible |
| ISC | `libloading`, `rustls-webpki`, `untrusted`; `ring` is `Apache-2.0 AND ISC` | Keep the copyright and permission notice | Notice retention, compatible |
| Zlib | `foldhash` | Do not misrepresent origin; keep notice in source copies | Compatible |
| CC0-1.0 | none linked (`tiny-keccak` is build-time only; `dunce` taken under MIT-0/Apache-2.0) | None | Compatible |
| CDLA-Permissive-2.0 | `webpki-roots` (data) | Supply the licence text with the data | Notice retention, compatible |
| MPL-2.0 | `cssparser`, `dtoa-short`, `option-ext`, `selectors`, `serialport` (`cssparser-macros` build-time only) | Keep notices; tell recipients where the covered source is. All five are unmodified crates.io releases; exact URL and Cargo.lock checksum are recorded | Compatible; modifying them would require publishing those files |
| `MIT OR GPL-3.0-only` | `unescaper` | Taken under MIT | Compatible |
| `Apache-2.0 OR BSL-1.0` | `ryu` | Taken under Apache-2.0 | Compatible |

The builder now (full build only, after compilation) re-derives the linked set
with `cargo metadata --locked --offline` and refuses a package whose set differs
from the checked-in inventory. It copies every linked crate's own top-level
licence/notice files, the repository `LICENSE`, `THIRD-PARTY-NOTICES.md`, the
inventory and the review into `usr/share/doc/brickwright/`. Thirteen linked
crates publish no licence file in their crate source (`alloc-stdlib`,
`bluez-async`, `bluez-generated`, `custom_debug`, `dlopen2`,
`libappindicator-sys`, `seahash`, `selectors`, five `unic-*`). Reviewed texts for
them are in [`docs/notices/rust-crates-supplemental/`](notices/rust-crates-supplemental/provenance.json),
with per-file SHA-256 and origin. Where the upstream repository has licence files,
those are used (at a recorded default-branch commit, not necessarily the release).
`custom_debug` and `selectors` have none upstream, so they get the standard
Apache-2.0 and MPL-2.0 texts respectively, plus attribution notes. The builder
copies them after a digest check and refuses any other gap or a stale entry. An
offline run of the collection step against the local registry installed 651 notice
files for all 365 linked crates.

Renode composition, from a read-only scan of the installed bundle:

| Component | Shipped | Licence | Status |
|---|---|---|---|
| tlib (`Antmicro.Renode.translate-*.so`) | yes | LGPL-2.1 | Notice present. Source: `renode-infrastructure-spike-prime` at `1253d925`, submodule `src/Emulator/Cores/tlib` = `antmicro/tlib@d50c868f` |
| NetMQ | yes | LGPL-3.0 with static-link exception | Notice present. NuGet `NetMQ` 4.0.1.12 (embedded dependency record) |
| Packet.Net (`PacketDotNet.dll`) | yes | LGPL-3.0 | Notice present. Source: `renode-spike-prime` at `41338096`, submodule `lib/Packet.Net`; NuGet `PacketDotNet` 1.0.0 |
| pip 19.2.3 vendored module | yes | LGPL-2.1 notice | Notice present. Source pip 19.2.3 on PyPI. The covered module is not identified |
| Gtk# bindings | no | — | Not applicable (only gir.core GLib/GObject/Gst, MIT) |
| mcs | no | — | Not applicable |

LGPL is within policy. Each shipped item needs notice retention (done) and
corresponding source. The runtime's informational versions embed its source
commits: Renode `renode-spike-prime@41338096`, infrastructure
`renode-infrastructure-spike-prime@1253d925` (the same pair the compiled
MicroPython profile records) and upstream `antmicro/renode@33e5ab24`; the
runtime's private build record names the same commits plus resources
`14b80cde`. All named sources are public repositories.

### Full-build exercise — 2026-10-24

The builder on main `f51ec8c2` assembled a complete package locally
(`brickwright_0.1.26_amd64.deb`; Rust compile in an owned network-less
container, 9 min 21 s). The frontend input came from main `4ae82377`, the newest
published build at the time; the exercise covers packaging and notices, not that
frontend. Installed with a normal dpkg policy, the layout check passes all 36
checks, including 655 notice files. Ubuntu container base images exclude
`/usr/share/doc/*`; under that policy the doc checks fail, as they should, and
the crate-notice check now counts only directories that hold a file.

### Hosted packaging exercise

`.github/workflows/spike-linux-package.yml` runs the builder end to end on a
hosted Ubuntu 24.04 runner whenever a packaging path changes (and on main pushes
to those paths or dispatch). `scripts/ci-spike-linux-package-exercise.mjs` stages
the inputs and calls the unchanged builder without `--prepare-only`: the notice
and inventory gates, the `--locked --offline` Rust compile of the desktop binary,
the linked-crate comparison, crate-notice collection and `dpkg-deb`. The package
is then installed in a digest-pinned `ubuntu:24.04` container with the
`/usr/share/doc` exclude policy removed, and the installed-layout check must pass.
The package is not uploaded.

What the runner cannot obtain, and is therefore a labelled placeholder:

- the portable Renode runtime with its .NET/LLVM libraries and seven notices. The
  Renode fork is public, but no public release or artifact publishes this
  portable layout at a pinned digest. Building it on every packaging PR would
  also exceed the runner budget;
- the staged MicroPython support profile, including its 64 KiB boot seed (zeros
  in the exercise). It comes from the local staged-support pipeline;
- the frontend (two placeholder pages); the web build is covered by `build.yml`;
- `--guest` / `--nuttx` firmware profiles. No firmware goes to hosted CI.

So the hosted job proves the packaging pipeline, the notices and the installed
layout. It does not prove that the packaged app starts Renode or runs a guest.
That still needs the local full-build exercise above with real inputs.

### Installed layout check

`scripts/verify-spike-linux-installed-layout.sh` checks an installed system
read-only and prints only check names with PASS/FAIL. Run it inside the image:

```sh
docker run --rm --network none -v "$PWD/scripts:/check:ro" --entrypoint bash IMAGE /check/verify-spike-linux-installed-layout.sh
```

One run on 2026-10-24 against the installed Linux reference image (package
0.1.26, built before this change): the executable, the Renode executable, the 14
native libraries, all seven required runtime notices, the support notices, no
links, only regular files, data 0644 / directories 0755, root ownership and the
desktop entry all PASS. The five `usr/share/doc/brickwright` checks FAIL, as
expected: that image predates the crate-notice installation. That earlier image is a retained negative result. The later full-build exercise
above passed all 36 checks under normal dpkg policy; the excluded-documentation
image still fails, including the repaired nonempty-file crate-notice check.
The hosted workflow landed in PR1368, and its [post-merge v0.1.27 exercise](https://github.com/CrispStrobe/brickwright/actions/runs/40174318530) at `8b92fda6e998` passed all 36 checks. An [equivalent-input official exercise](https://github.com/CrispStrobe/brickwright/actions/runs/40172941760) also passed with labelled
placeholder inputs. Its independently reviewed job log records compilation, package creation,
651 crate-notice files and the package/executable digests. The package and
executable bytes are not retained by that workflow, so those logged digests are
not a separate independent audit of the payload bytes. These results qualify
the hosted packaging pipeline and installed layout; runtime, signed delivery
and redistribution clearance retain their separate boundaries.

Builder refusals covered by `test/spike-linux-package-refusals.test.mjs`: output
reached through a symlinked alias inside an input (fixed: the output parent is now
resolved before the containment check), missing/empty native libraries, a missing
`renode-license`, runtime helpers behind a directory link escaping the runtime
root, frontend links and missing broker assets, a tampered support artifact, and
compile pins free of staging paths. Owned-child cleanup is covered by the native
supervisor tests, not by this host test.
