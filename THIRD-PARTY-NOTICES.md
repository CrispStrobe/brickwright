# Third-Party Notices

Brickwright (this repo) is BSD-3-Clause (see LICENSE). It bundles the
following third-party software under their own licenses.

## JavaScript / the frozen Scratch stack

Brickwright is built on a frozen fork of **scratchfoundation/scratch-gui
@ 7a72429477eb** (v4.1.7, 2024-11-23) -- the last commit before the
Scratch Foundation's relicense to AGPL-3.0. Every package below is pinned
to the version that snapshot's package.json resolved to, and was verified
against its own published LICENSE at that version:

- scratch-gui 4.1.7 -- BSD-3-Clause -- https://github.com/scratchfoundation/scratch-gui
- scratch-vm 4.8.115 -- BSD-3-Clause -- https://github.com/scratchfoundation/scratch-vm
- scratch-blocks 1.3.0 -- Apache-2.0 -- https://github.com/scratchfoundation/scratch-blocks
- scratch-paint 2.2.518 -- BSD-3-Clause -- https://github.com/scratchfoundation/scratch-paint
- scratch-render 1.2.126 -- BSD-3-Clause -- https://github.com/scratchfoundation/scratch-render
- scratch-audio 1.0.332 -- BSD-3-Clause -- https://github.com/scratchfoundation/scratch-audio
- scratch-storage 2.3.284 -- BSD-3-Clause -- https://github.com/scratchfoundation/scratch-storage
- scratch-svg-renderer 2.5.46 -- BSD-3-Clause -- https://github.com/scratchfoundation/scratch-svg-renderer
- scratch-l10n ^4.0.0 -- presumed BSD-3-Clause (same org/monorepo family as the
  packages above; not independently re-verified against its own LICENSE file
  this pass) -- https://github.com/scratchfoundation/scratch-l10n

scratch-gui's own further dependencies (React, Redux, react-intl, and the
rest of its package.json) are pulled in transitively at vendor time
(`npm run vendor`) and are not individually re-listed here; scratch-gui
itself only depends on permissively-licensed packages as of the pinned
snapshot.

## Vendored sources that no package manager tracks

These are copied into the repository and SHIP INSIDE THE BINARY, so their
notices cannot be generated from a lockfile and are recorded by hand. BSD-3
clause 2 requires the copyright notice to be reproduced in materials
distributed with a binary — this section is that reproduction.

### scratch-link (Swift) -- BSD-3-Clause

The Scratch Foundation's own Scratch Link BLE session, carried so the app can
offer the REFERENCE implementation as a connection path on Apple platforms
(Settings > "How Scratch Link connects..." > "Original Scratch Link").

- Copyright (c) 2019, Scratch Foundation. All rights reserved.
- BSD-3-Clause -- full text, INCLUDING all three conditions and the warranty
  disclaimer, in `apps/tauri/src-tauri/vendor/scratch-link-swift/LICENSE` and
  shipped with the app at
  `overlay/scratch-gui/static/licenses/scratch-link.BSD-3-Clause.txt`.
  Clause 2 requires the notice, the conditions and the disclaimer to be
  reproduced in the materials distributed with a binary — an SPDX identifier
  and a hyperlink are neither.
- Source: https://github.com/bricklife/scratch-link @
  f78273b9003bc0272dbcfb8a39a5a1358de89007 (2022-02-18), path
  `macOS/Sources/scratch-link`
- The 2022 pin is deliberate: the Scratch Foundation relicensed to AGPL-3.0 on
  2024-11-25, and a later snapshot could not ship here.
- `TRADEMARK` is vendored beside it. The Scratch name, logo and characters may
  not be used to endorse a derived product; this app carries the code and none
  of that branding.
- Unmodified in `Sources/`, hash-gated by
  `test/scratchlink-vendor-integrity.test.mjs`. The buildable copy is generated
  by `scripts/gen-scratchlink-swift.mjs` with the ten patches that a modern
  SDK requires (CoreBluetooth optionals since iOS 15; `uint16`/`uint32` Darwin
  aliases that do not exist on iOS).

### WebSocket / PerfectWebSockets shim -- BSD-3-Clause

The vendored sources `import PerfectWebSockets` for two types. Rather than take
the Perfect web server as a dependency, an empty module of that name supplies
them. The approach, and the shape of the shim, are from Scrub:

- Copyright (c) 2021, Shinichiro Oba. BSD-3-Clause -- full text shipped at
  `overlay/scratch-gui/static/licenses/scrub.BSD-3-Clause.txt`.
- Source: https://github.com/bricklife/Scrub (`ScratchLinkKit`)

### labwired-core (WebAssembly) -- MIT

The heavy simulation tier's engine. Fetched at build time into `static/` by
`scripts/sync-labwired-wasm.mjs` and served on demand in the web build; it is
BUNDLED in the mobile app, because the mobile build runs `vercel-build.sh`.

- Copyright (c) 2026 Andrii Shylenko. MIT.
  Full text: `overlay/scratch-gui/static/licenses/labwired-core.MIT.txt`,
  shipped with the app -- MIT requires the copyright AND permission notice to
  accompany substantial portions, and a compiled 20 MB engine is substantial.
- https://github.com/w1ne/labwired-core
- Built from pin `41119903ced44a221a49aa0e8090ab012fbdba68`, published as
  release `labwired-wasm-41119903-r2` with both artefacts' sha256 pinned in the
  sync script and gated by `test/fetch-pinning.test.mjs`.

### esp32s3-rom -- Apache-2.0

The explicit ESP32-S3 merged-flash target loads the chip's IROM and DROM
windows, extracted from Espressif's published `esp32s3_rev0_rom.elf`.
Copyright Espressif Systems (Shanghai) Co., Ltd. These ROM objects are
licensed separately from the LabWired emulator.

- Upstream distribution and terms: https://github.com/espressif/esp-rom-elfs
- The pinned bw-board firmware-boot manifest records the exact LabWired
  extraction commit, byte counts and SHA-256 digests. `scripts/sync-esp32s3-roms.mjs`
  verifies these identities before writing `static/esp32s3/esp32s3_rom.bin`
  and `static/esp32s3/esp32s3_drom.bin`. The browser verifies the same digests.
- The flat files change the object container from ELF to its two addressed
  ROM windows; their payload is the upstream ROM. No ROM source is claimed.
- Full Apache License 2.0 and attribution accompany the app at
  `static/licenses/esp32s3-rom.Apache-2.0.txt`.

### 8086 example programs (Amey Thakur / Mega Satish) -- MIT

The six 8086 starter programs the ASM tab offers are FILES FROM ANOTHER
REPOSITORY, carried verbatim -- header, attribution and technical notes -- and
compiled into the JavaScript bundle, so they ship inside the web build and
inside the mobile binary. They are not written here and are not ours.

Each program keeps its own `AUTHOR` / `REPOSITORY` / `LICENSE` comment header,
so the notice reaches the editor along with the code and travels with anything
a learner copies out. `overlay/scratch-gui/src/lib/bw-asm/examples-i8086.js`
holds them; `test/i8086-asm-examples.test.mjs` refuses a build in which any of
those headers has been trimmed away, and compares the shipped text against the
upstream file when a checkout is available.

- Copyright (c) 2021 Amey Thakur and Mega Satish. MIT.
  Full text: `overlay/scratch-gui/static/licenses/amey-thakur-8086.MIT.txt`,
  shipped with the app and reachable from the About dialog offline.
- https://github.com/Amey-Thakur/8086-ASSEMBLY-LANGUAGE-PROGRAMS
- Shipped: `Introduction/hello_world_string.asm`,
  `Control Flow/loop_instruction_cx_register_control.asm`,
  `Input Output/display_hex.asm`, `Expression/fibonacci.asm`,
  `Stack Operations/reverse_string_stack.asm`,
  `BIOS Services/bios_character_with_attribute.asm`.
- Only two normalisations were applied: CRLF to LF, and trailing whitespace.
  Nothing was retitled, trimmed or rewritten.

### RISC-V RTOS demo images (FreeRTOS, RT-Thread Nano)

The RISC-V (RV32IMA) console offers, besides a clang "Hello", two real operating
systems that boot and multitask in the browser: **FreeRTOS** and **RT-Thread
Nano**. Each is that kernel's own source, cross-compiled (clang + ld.lld) to a
small RISC-V image and carried as the loadable bytes of that image, base64, in
`overlay/scratch-gui/src/lib/bw-debug/riscv-programs.js` — so they ship inside
the web build and the mobile binary. They are those projects' code, not ours; the
kernel sources are fetched at build time from the pinned commits below and are not
vendored here. The build recipe and the original demo/board glue (ours) live in
bw-board `test/fixtures/riscv-freertos/` and `test/fixtures/riscv-rtthread/`.

- **FreeRTOS-Kernel V11.1.0** — Copyright (C) 2021 Amazon.com, Inc. or its
  affiliates. **MIT.** Pinned commit `dbf70559`.
  Full text: `overlay/scratch-gui/static/licenses/freertos.MIT.txt`, shipped with
  the app and readable offline. https://github.com/FreeRTOS/FreeRTOS-Kernel
- **RT-Thread Nano V4.1.1** — Copyright (c) 2006-2022, RT-Thread Development Team.
  **Apache-2.0.** Pinned commit `8afd0416`.
  Full text: `overlay/scratch-gui/static/licenses/rt-thread.Apache-2.0.txt`,
  shipped with the app and readable offline. https://github.com/RT-Thread/rtthread-nano

## Our own code living in this repo

Some files were copied in from the CrispStrobe/brickwright mainline repo
(GPL-3.0, because of its own scratch-gui/scratch-blocks/scratch-paint base)
but are self-authored, so they carry no GPL obligation here -- copyright
in your own work isn't bound by whichever repo it happens to sit in:

- `overlay/scratch-gui/src/lib/crispfxr-core.js` -- (c) CrispStrobe,
  vendored from CrispStrobe/CrispFXR-web.
- `overlay/scratch-gui/static/images/brick-robot.svg` -- (c) CrispStrobe,
  original artwork (not derived from Scratch's CC-BY-SA library or any
  third party).
- `overlay/scratch-gui/src/lib/flasher.js` -- (c) CrispStrobe, vendored from
  CrispStrobe/stc-compiler (docs/flash.js, MIT) by `scripts/sync-flasher.mjs`.
- `overlay/scratch-gui/static/roms/i8086-bios.bin` and the nine `i8086-*-demo.bin`
  ROMs with a `*.provenance.json` beside them -- (c) CrispStrobe, built from
  CrispStrobe/bw-board (MIT) at the pinned sha the manifest names.
- `overlay/scratch-gui/static/roms/i8086-cga-demo.bin`, `i8086-serial-monitor.bin`,
  `i8086-timer-demo.bin`, `lcd-hello.bin`, `z80-mirror.bin` -- (c) CrispStrobe,
  demo ROMs assembled from the owner's own sources (bw-board's `rom/` and the
  bw-circuit-ui presets) and vendor-forwarded on 2026-08-17; no third-party code.
- `overlay/scratch-gui/src/lib/virtual-hub/spike-prime-peripheral.js`,
  `spike-classic-scratch-link.js`, `spike-hub-state.js` and `spike-panel.js` --
  (c) CrispStrobe, and deliberately **Apache-2.0** rather than this repository's
  BSD-3-Clause: each carries `SPDX-License-Identifier: Apache-2.0` on line 1, and
  `spike-prime-peripheral.js` line 2 records why -- its framing is shared with
  Brickwright SPIKE Firmware's independently authored `protocol/js/spike-codec.js`
  and that repository's Apache-2.0 conformance fixtures. Keeping the two sides
  under one licence is what lets the framing and the fixtures move between the
  repositories. They are not mis-tagged, and `web-bluetooth-shim.js` beside them
  carries no SPDX line because it is ordinary BSD-3-Clause repository code.

## Fonts shipped in the editor build (scratch-render-fonts 1.0.129)

Seven typefaces are compiled into the bundle as base64 `@font-face` data by
`packages/scratch-gui/node_modules/scratch-render-fonts/src/index.js`, one per
Scratch font menu entry. Each is recorded below from its own `name` table
(copyright is name ID 0, licence ID 13, licence URL ID 14), not from the
package's bundled `OFL.txt`: that file's copyright line names "Londrina", a face
this package does not ship, so it identifies the licence but not the works.

Five are under the SIL Open Font License 1.1, and OFL clause 2 requires the
copyright notice and the licence to travel with them:

- **Noto Sans Medium** (menu "Sans Serif") -- Copyright 2015 Google Inc. All
  Rights Reserved. -- SIL OFL 1.1 -- http://scripts.sil.org/OFL
- **Source Serif Pro Regular** (menu "Serif") -- Copyright 2014, 2015, 2016
  Adobe Systems Incorporated (http://www.adobe.com/), with Reserved Font Name
  'Source'. -- SIL OFL 1.1 -- http://scripts.sil.org/OFL
- **Handlee** (menu "Handwriting") -- Copyright (c) 2011, Admix Designs
  (http://www.admixdesigns.com/) with Reserved Font Name Handlee. -- SIL OFL 1.1
- **Knewave** (menu "Marker") -- Copyright (c) 2011 by Tyler Finck. All rights
  reserved. -- SIL OFL 1.1 (the face records the licence as "OFL"; the full text
  is reproduced below)
- **Griffy** (menu "Curly") -- Copyright (c) 2012 by Font Diner, Inc DBA
  Neapolitan (diner@fontdiner.com) with Reseved Font Name "Griffy" -- SIL OFL 1.1
  -- http://scripts.sil.org/OFL

The remaining two are NOT under the OFL, and are recorded here as they describe
themselves:

- **Grand9K Pixel** (menu "Pixel") -- (c) 2009-2013 Grand Chaos Productions.
  Some Rights Reserved. -- **Creative Commons Attribution-ShareAlike 3.0**,
  http://creativecommons.org/licenses/by-sa/3.0/. The face carries no name-table
  licence description, only that URL. CC BY-SA 3.0 is a share-alike licence and
  is not one of the licences this bundle otherwise ships under; it applies to the
  font file, which is distributed unmodified.
- **ScratchFont** (`Scratch.ttf`, menu "Scratch") -- "By Jakob Fischer aka
  PizzaDude *Distribute freely*", version field
  `http://hjem.get2net.dk/jfischer/`. **The face carries no licence
  identifier and no licence URL.** "Distribute freely" is the whole of the
  permission granted, in the copyright record itself. It is recorded here as
  found; nothing in this repository asserts a licence for it.

The `LICENSE.txt` in that package is Apache-2.0 and covers the package's own
JavaScript, not the typefaces.

### SIL Open Font License, Version 1.1

Reproduced as clause 2 requires, from
`packages/scratch-gui/node_modules/scratch-render-fonts/OFL.txt`; the copyright
line there names a face this package does not ship, so the notices above carry
each shipped face's own copyright instead.

```
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded, 
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```

## Retro-video design references

The independently written 6502 video-device models use the documented
interfaces and behavior of these permissively released reference designs:

- gfoot/simplevga6502 -- Unlicense -- https://github.com/gfoot/simplevga6502
- rene6502/6502-vga-prop -- Unlicense -- https://github.com/rene6502/6502-vga-prop

No EasyEDA, Gerber, PCB artwork, or source files from the unlicensed rehsd
6502/PS2/VGA article are distributed in this repository.

## Rust (apps/tauri/src-tauri)

Generated from `cargo metadata` against the current Cargo.lock (all
platform targets, so some entries only apply to specific OSes). The licences
are permissive or file-level MPL-2.0 terms; none extends copyleft to this
binary as a larger work. Where a crate offers a disjunction, this distribution
takes a permissive option: specifically, `unescaper` declares
`MIT OR GPL-3.0-only`, and this distribution elects MIT rather than GPL.

The `fs2` 0.4.3 file-lock implementation is distributed under its MIT option.
Its retained license text follows:

```text
Copyright (c) 2015 The Rust Project Developers

Permission is hereby granted, free of charge, to any
person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the
Software without restriction, including without
limitation the rights to use, copy, modify, merge,
publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software
is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice
shall be included in all copies or substantial portions
of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF
ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT
SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
```

### Only in a build with the `peers` Cargo feature (off by default)

Peer sessions (task E11, docs/PEERS-SECURITY-REVIEW.md) add these crates, all from the
RustCrypto project, only when the app is built with `--features peers`. No shipped build sets
it, so the generated list below (default features) does not contain them; a build that does
set it distributes them under their MIT option:

- aead 0.5.2 (MIT OR Apache-2.0) -- https://github.com/RustCrypto/traits
- chacha20 0.9.1 (Apache-2.0 OR MIT) -- https://github.com/RustCrypto/stream-ciphers
- chacha20poly1305 0.10.1 (Apache-2.0 OR MIT) -- https://github.com/RustCrypto/AEADs/tree/master/chacha20poly1305
- cipher 0.4.4 (MIT OR Apache-2.0) -- https://github.com/RustCrypto/traits
- hkdf 0.12.4 (MIT OR Apache-2.0) -- https://github.com/RustCrypto/KDFs/
- hmac 0.12.1 (MIT OR Apache-2.0) -- https://github.com/RustCrypto/MACs
- inout 0.1.4 (MIT OR Apache-2.0) -- https://github.com/RustCrypto/utils
- opaque-debug 0.3.1 (MIT OR Apache-2.0) -- https://github.com/RustCrypto/utils
- poly1305 0.8.0 (Apache-2.0 OR MIT) -- https://github.com/RustCrypto/universal-hashes
- universal-hash 0.5.1 (MIT OR Apache-2.0) -- https://github.com/RustCrypto/traits

<!-- BEGIN GENERATED RUST CRATE LIST: run `node scripts/gen-rust-notices.mjs` to refresh, do not hand-edit below this line -->

- adler2 2.0.1 (0BSD OR MIT OR Apache-2.0) -- https://github.com/oyvindln/adler2
- ahash 0.7.8 (MIT OR Apache-2.0) -- https://github.com/tkaitchuck/ahash
- aho-corasick 1.1.4 (Unlicense OR MIT) -- https://github.com/BurntSushi/aho-corasick
- alloc-no-stdlib 2.0.4 (BSD-3-Clause) -- https://github.com/dropbox/rust-alloc-no-stdlib
- alloc-stdlib 0.2.4 (BSD-3-Clause) -- https://github.com/dropbox/rust-alloc-no-stdlib
- android_log-sys 0.3.2 (MIT OR Apache-2.0) -- https://github.com/rust-mobile/android_log-sys-rs
- android_logger 0.15.1 (MIT OR Apache-2.0) -- https://github.com/rust-mobile/android_logger-rs
- android_system_properties 0.1.5 (MIT/Apache-2.0) -- https://github.com/nical/android_system_properties
- anyhow 1.0.103 (MIT OR Apache-2.0) -- https://github.com/dtolnay/anyhow
- arbitrary 1.4.2 (MIT OR Apache-2.0) -- https://github.com/rust-fuzz/arbitrary/
- arrayvec 0.7.8 (MIT OR Apache-2.0) -- https://github.com/bluss/arrayvec
- async-broadcast 0.7.2 (MIT OR Apache-2.0) -- https://github.com/smol-rs/async-broadcast
- async-channel 2.5.0 (Apache-2.0 OR MIT) -- https://github.com/smol-rs/async-channel
- async-executor 1.14.0 (Apache-2.0 OR MIT) -- https://github.com/smol-rs/async-executor
- async-io 2.6.0 (Apache-2.0 OR MIT) -- https://github.com/smol-rs/async-io
- async-lock 3.4.2 (Apache-2.0 OR MIT) -- https://github.com/smol-rs/async-lock
- async-process 2.5.0 (Apache-2.0 OR MIT) -- https://github.com/smol-rs/async-process
- async-recursion 1.1.1 (MIT OR Apache-2.0) -- https://github.com/dcchut/async-recursion
- async-signal 0.2.14 (Apache-2.0 OR MIT) -- https://github.com/smol-rs/async-signal
- async-task 4.7.1 (Apache-2.0 OR MIT) -- https://github.com/smol-rs/async-task
- async-trait 0.1.89 (MIT OR Apache-2.0) -- https://github.com/dtolnay/async-trait
- atk 0.18.2 (MIT) -- https://github.com/gtk-rs/gtk3-rs
- atk-sys 0.18.2 (MIT) -- https://github.com/gtk-rs/gtk3-rs
- atomic-waker 1.1.2 (Apache-2.0 OR MIT) -- https://github.com/smol-rs/atomic-waker
- autocfg 1.5.1 (Apache-2.0 OR MIT) -- https://github.com/cuviper/autocfg
- base64 0.21.7 (MIT OR Apache-2.0) -- https://github.com/marshallpierce/rust-base64
- base64 0.22.1 (MIT OR Apache-2.0) -- https://github.com/marshallpierce/rust-base64
- bit-set 0.8.0 (Apache-2.0 OR MIT) -- https://github.com/contain-rs/bit-set
- bit-vec 0.8.0 (Apache-2.0 OR MIT) -- https://github.com/contain-rs/bit-vec
- bitflags 1.3.2 (MIT/Apache-2.0) -- https://github.com/bitflags/bitflags
- bitflags 2.13.0 (MIT OR Apache-2.0) -- https://github.com/bitflags/bitflags
- bitvec 1.1.1 (MIT) -- https://github.com/bitvecto-rs/bitvec
- block-buffer 0.10.4 (MIT OR Apache-2.0) -- https://github.com/RustCrypto/utils
- block2 0.5.1 (MIT) -- https://github.com/madsmtm/objc2
- block2 0.6.2 (MIT) -- https://github.com/madsmtm/objc2
- blocking 1.6.2 (Apache-2.0 OR MIT) -- https://github.com/smol-rs/blocking
- bluer 0.17.4 (BSD-2-Clause) -- https://github.com/bluez/bluer
- bluez-async 0.8.2 (MIT OR Apache-2.0) -- https://github.com/bluez-rs/bluez-async/
- bluez-generated 0.4.0 (MIT OR Apache-2.0) -- https://github.com/bluez-rs/bluez-async/
- borsh 1.7.0 (MIT OR Apache-2.0) -- https://github.com/near/borsh-rs
- borsh-derive 1.7.0 (Apache-2.0) -- https://github.com/near/borsh-rs
- brotli 8.0.4 (BSD-3-Clause AND MIT) -- https://github.com/dropbox/rust-brotli
- brotli-decompressor 5.0.3 (BSD-3-Clause/MIT) -- https://github.com/dropbox/rust-brotli-decompressor
- bs58 0.5.1 (MIT/Apache-2.0) -- https://github.com/Nullus157/bs58-rs
- btleplug 0.11.8 (MIT/Apache-2.0/BSD-3-Clause) -- https://github.com/deviceplug/btleplug
- bumpalo 3.20.3 (MIT OR Apache-2.0) -- https://github.com/fitzgen/bumpalo
- byte-unit 5.2.5 (MIT) -- https://github.com/magiclen/byte-unit
- bytecheck 0.6.12 (MIT) -- https://github.com/djkoloski/bytecheck
- bytecheck_derive 0.6.12 (MIT) -- https://github.com/djkoloski/bytecheck
- bytemuck 1.25.0 (Zlib OR Apache-2.0 OR MIT) -- https://github.com/Lokathor/bytemuck
- byteorder 1.5.0 (Unlicense OR MIT) -- https://github.com/BurntSushi/byteorder
- bytes 1.12.0 (MIT) -- https://github.com/tokio-rs/bytes
- cairo-rs 0.18.5 (MIT) -- https://github.com/gtk-rs/gtk-rs-core
- cairo-sys-rs 0.18.2 (MIT) -- https://github.com/gtk-rs/gtk-rs-core
- camino 1.2.4 (MIT OR Apache-2.0) -- https://github.com/camino-rs/camino
- cargo_metadata 0.19.2 (MIT) -- https://github.com/oli-obk/cargo_metadata
- cargo_toml 0.22.3 (Apache-2.0 OR MIT) -- https://gitlab.com/lib.rs/cargo_toml
- cargo-platform 0.1.9 (MIT OR Apache-2.0) -- https://github.com/rust-lang/cargo
- cc 1.2.66 (MIT OR Apache-2.0) -- https://github.com/rust-lang/cc-rs
- cesu8 1.1.0 (Apache-2.0/MIT) -- https://github.com/emk/cesu8-rs
- cfb 0.7.3 (MIT) -- https://github.com/mdsteele/rust-cfb
- cfg_aliases 0.2.1 (MIT) -- https://github.com/katharostech/cfg_aliases
- cfg-expr 0.15.8 (MIT OR Apache-2.0) -- https://github.com/EmbarkStudios/cfg-expr
- cfg-if 1.0.4 (MIT OR Apache-2.0) -- https://github.com/rust-lang/cfg-if
- chacha20 0.10.1 (MIT OR Apache-2.0) -- https://github.com/RustCrypto/stream-ciphers
- chrono 0.4.45 (MIT OR Apache-2.0) -- https://github.com/chronotope/chrono
- combine 4.6.7 (MIT) -- https://github.com/Marwes/combine
- command-group 5.0.1 (Apache-2.0 OR MIT) -- https://github.com/watchexec/command-group
- concurrent-queue 2.5.0 (Apache-2.0 OR MIT) -- https://github.com/smol-rs/concurrent-queue
- const-random 0.1.18 (MIT OR Apache-2.0) -- https://github.com/tkaitchuck/constrandom
- const-random-macro 0.1.16 (MIT OR Apache-2.0) -- https://github.com/tkaitchuck/constrandom
- cookie 0.18.1 (MIT OR Apache-2.0) -- https://github.com/SergioBenitez/cookie-rs
- core-foundation 0.10.1 (MIT OR Apache-2.0) -- https://github.com/servo/core-foundation-rs
- core-foundation-sys 0.8.7 (MIT OR Apache-2.0) -- https://github.com/servo/core-foundation-rs
- core-graphics 0.25.0 (MIT OR Apache-2.0) -- https://github.com/servo/core-foundation-rs
- core-graphics-types 0.2.0 (MIT OR Apache-2.0) -- https://github.com/servo/core-foundation-rs
- cpufeatures 0.2.17 (MIT OR Apache-2.0) -- https://github.com/RustCrypto/utils
- cpufeatures 0.3.0 (MIT OR Apache-2.0) -- https://github.com/RustCrypto/utils
- crc32fast 1.5.0 (MIT OR Apache-2.0) -- https://github.com/srijs/rust-crc32fast
- crossbeam-channel 0.5.16 (MIT OR Apache-2.0) -- https://github.com/crossbeam-rs/crossbeam
- crossbeam-utils 0.8.22 (MIT OR Apache-2.0) -- https://github.com/crossbeam-rs/crossbeam
- crunchy 0.2.4 (MIT) -- https://github.com/eira-fransham/crunchy
- crypto-common 0.1.7 (MIT OR Apache-2.0) -- https://github.com/RustCrypto/traits
- cssparser 0.36.0 (MPL-2.0) -- https://github.com/servo/rust-cssparser
- cssparser-macros 0.6.1 (MPL-2.0) -- https://github.com/servo/rust-cssparser
- ctor 0.8.0 (Apache-2.0 OR MIT) -- https://github.com/mmastrac/rust-ctor
- ctor-proc-macro 0.0.7 (Apache-2.0 OR MIT) -- https://github.com/mmastrac/rust-ctor
- custom_debug 0.6.2 (Apache-2.0 OR MIT) -- https://github.com/panicbit/custom_debug
- custom_debug_derive 0.6.2 (Apache-2.0 OR MIT) -- https://github.com/panicbit/custom_debug
- darling 0.20.11 (MIT) -- https://github.com/TedDriggs/darling
- darling 0.23.0 (MIT) -- https://github.com/TedDriggs/darling
- darling_core 0.20.11 (MIT) -- https://github.com/TedDriggs/darling
- darling_core 0.23.0 (MIT) -- https://github.com/TedDriggs/darling
- darling_macro 0.20.11 (MIT) -- https://github.com/TedDriggs/darling
- darling_macro 0.23.0 (MIT) -- https://github.com/TedDriggs/darling
- dashmap 5.5.3 (MIT) -- https://github.com/xacrimon/dashmap
- dashmap 6.2.1 (MIT) -- https://github.com/xacrimon/dashmap
- data-encoding 2.11.0 (MIT) -- https://github.com/ia0/data-encoding
- dbus 0.9.12 (Apache-2.0/MIT) -- https://github.com/diwic/dbus-rs
- dbus-crossroads 0.5.3 (Apache-2.0/MIT) -- https://github.com/diwic/dbus-rs/
- dbus-tokio 0.7.6 (Apache-2.0/MIT) -- https://github.com/diwic/dbus-rs
- deranged 0.5.8 (MIT OR Apache-2.0) -- https://github.com/jhpratt/deranged
- derive_arbitrary 1.4.2 (MIT OR Apache-2.0) -- https://github.com/rust-fuzz/arbitrary
- derive_more 2.1.1 (MIT) -- https://github.com/JelteF/derive_more
- derive_more-impl 2.1.1 (MIT) -- https://github.com/JelteF/derive_more
- digest 0.10.7 (MIT OR Apache-2.0) -- https://github.com/RustCrypto/traits
- dirs 6.0.0 (MIT OR Apache-2.0) -- https://github.com/soc/dirs-rs
- dirs-sys 0.5.0 (MIT OR Apache-2.0) -- https://github.com/dirs-dev/dirs-sys-rs
- dispatch2 0.3.1 (Zlib OR Apache-2.0 OR MIT) -- https://github.com/madsmtm/objc2
- displaydoc 0.2.6 (MIT OR Apache-2.0) -- https://github.com/yaahc/displaydoc
- dlopen2 0.8.2 (MIT) -- https://github.com/OpenByteDev/dlopen2
- dlopen2_derive 0.4.3 (MIT) -- https://github.com/OpenByteDev/dlopen2
- dlv-list 0.5.2 (MIT OR Apache-2.0) -- https://github.com/sgodwincs/dlv-list-rs
- dom_query 0.27.0 (MIT) -- https://github.com/niklak/dom_query
- dpi 0.1.2 (Apache-2.0 AND MIT) -- https://github.com/rust-windowing/winit
- dtoa 1.0.11 (MIT OR Apache-2.0) -- https://github.com/dtolnay/dtoa
- dtoa-short 0.3.5 (MPL-2.0) -- https://github.com/upsuper/dtoa-short
- dtor 0.3.0 (Apache-2.0 OR MIT) -- https://github.com/mmastrac/rust-ctor
- dtor-proc-macro 0.0.6 (Apache-2.0 OR MIT) -- https://github.com/mmastrac/rust-ctor
- dunce 1.0.5 (CC0-1.0 OR MIT-0 OR Apache-2.0) -- https://gitlab.com/kornelski/dunce
- dyn-clone 1.0.20 (MIT OR Apache-2.0) -- https://github.com/dtolnay/dyn-clone
- either 1.16.0 (MIT OR Apache-2.0) -- https://github.com/rayon-rs/either
- embed_plist 1.2.2 (MIT OR Apache-2.0) -- https://github.com/nvzqz/embed-plist-rs
- embed-resource 3.0.11 (MIT) -- https://github.com/nabijaczleweli/rust-embed-resource
- endi 1.1.1 (MIT) -- https://github.com/zeenix/endi
- enumflags2 0.7.12 (MIT OR Apache-2.0) -- https://github.com/meithecatte/enumflags2
- enumflags2_derive 0.7.12 (MIT OR Apache-2.0) -- https://github.com/meithecatte/enumflags2
- env_filter 0.1.4 (MIT OR Apache-2.0) -- https://github.com/rust-cli/env_logger
- equivalent 1.0.2 (Apache-2.0 OR MIT) -- https://github.com/indexmap-rs/equivalent
- erased-serde 0.4.10 (MIT OR Apache-2.0) -- https://github.com/dtolnay/erased-serde
- errno 0.3.14 (MIT OR Apache-2.0) -- https://github.com/lambda-fairy/rust-errno
- event-listener 5.4.2 (Apache-2.0 OR MIT) -- https://github.com/smol-rs/event-listener
- event-listener-strategy 0.5.4 (Apache-2.0 OR MIT) -- https://github.com/smol-rs/event-listener-strategy
- fastrand 2.4.1 (Apache-2.0 OR MIT) -- https://github.com/smol-rs/fastrand
- fdeflate 0.3.7 (MIT OR Apache-2.0) -- https://github.com/image-rs/fdeflate
- fern 0.7.1 (MIT) -- https://github.com/daboross/fern
- field-offset 0.3.6 (MIT OR Apache-2.0) -- https://github.com/Diggsey/rust-field-offset
- find-msvc-tools 0.1.9 (MIT OR Apache-2.0) -- https://github.com/rust-lang/cc-rs
- flate2 1.1.9 (MIT OR Apache-2.0) -- https://github.com/rust-lang/flate2-rs
- fnv 1.0.7 (Apache-2.0 / MIT) -- https://github.com/servo/rust-fnv
- foldhash 0.2.0 (Zlib) -- https://github.com/orlp/foldhash
- foreign-types 0.5.0 (MIT/Apache-2.0) -- https://github.com/sfackler/foreign-types
- foreign-types-macros 0.2.3 (MIT/Apache-2.0) -- https://github.com/sfackler/foreign-types
- foreign-types-shared 0.3.1 (MIT/Apache-2.0) -- https://github.com/sfackler/foreign-types
- form_urlencoded 1.2.2 (MIT OR Apache-2.0) -- https://github.com/servo/rust-url
- fs2 0.4.3 (MIT/Apache-2.0) -- https://github.com/danburkert/fs2-rs
- funty 2.0.0 (MIT) -- https://github.com/myrrlyn/funty
- futures 0.3.32 (MIT OR Apache-2.0) -- https://github.com/rust-lang/futures-rs
- futures-channel 0.3.32 (MIT OR Apache-2.0) -- https://github.com/rust-lang/futures-rs
- futures-core 0.3.32 (MIT OR Apache-2.0) -- https://github.com/rust-lang/futures-rs
- futures-executor 0.3.32 (MIT OR Apache-2.0) -- https://github.com/rust-lang/futures-rs
- futures-io 0.3.32 (MIT OR Apache-2.0) -- https://github.com/rust-lang/futures-rs
- futures-lite 2.6.1 (Apache-2.0 OR MIT) -- https://github.com/smol-rs/futures-lite
- futures-macro 0.3.32 (MIT OR Apache-2.0) -- https://github.com/rust-lang/futures-rs
- futures-sink 0.3.32 (MIT OR Apache-2.0) -- https://github.com/rust-lang/futures-rs
- futures-task 0.3.32 (MIT OR Apache-2.0) -- https://github.com/rust-lang/futures-rs
- futures-util 0.3.32 (MIT OR Apache-2.0) -- https://github.com/rust-lang/futures-rs
- gdk 0.18.2 (MIT) -- https://github.com/gtk-rs/gtk3-rs
- gdk-pixbuf 0.18.5 (MIT) -- https://github.com/gtk-rs/gtk-rs-core
- gdk-pixbuf-sys 0.18.0 (MIT) -- https://github.com/gtk-rs/gtk-rs-core
- gdk-sys 0.18.2 (MIT) -- https://github.com/gtk-rs/gtk3-rs
- gdkwayland-sys 0.18.2 (MIT) -- https://github.com/gtk-rs/gtk3-rs
- gdkx11 0.18.2 (MIT) -- https://github.com/gtk-rs/gtk3-rs
- gdkx11-sys 0.18.2 (MIT) -- https://github.com/gtk-rs/gtk3-rs
- generic-array 0.14.7 (MIT) -- https://github.com/fizyk20/generic-array.git
- getrandom 0.2.17 (MIT OR Apache-2.0) -- https://github.com/rust-random/getrandom
- getrandom 0.3.4 (MIT OR Apache-2.0) -- https://github.com/rust-random/getrandom
- getrandom 0.4.3 (MIT OR Apache-2.0) -- https://github.com/rust-random/getrandom
- gio 0.18.4 (MIT) -- https://github.com/gtk-rs/gtk-rs-core
- gio-sys 0.18.1 (MIT) -- https://github.com/gtk-rs/gtk-rs-core
- glib 0.18.5 (MIT) -- https://github.com/gtk-rs/gtk-rs-core
- glib-macros 0.18.5 (MIT) -- https://github.com/gtk-rs/gtk-rs-core
- glib-sys 0.18.1 (MIT) -- https://github.com/gtk-rs/gtk-rs-core
- glob 0.3.3 (MIT OR Apache-2.0) -- https://github.com/rust-lang/glob
- gobject-sys 0.18.0 (MIT) -- https://github.com/gtk-rs/gtk-rs-core
- gtk 0.18.2 (MIT) -- https://github.com/gtk-rs/gtk3-rs
- gtk-sys 0.18.2 (MIT) -- https://github.com/gtk-rs/gtk3-rs
- gtk3-macros 0.18.2 (MIT) -- https://github.com/gtk-rs/gtk3-rs
- hashbrown 0.12.3 (MIT OR Apache-2.0) -- https://github.com/rust-lang/hashbrown
- hashbrown 0.14.5 (MIT OR Apache-2.0) -- https://github.com/rust-lang/hashbrown
- hashbrown 0.17.1 (MIT OR Apache-2.0) -- https://github.com/rust-lang/hashbrown
- heck 0.4.1 (MIT OR Apache-2.0) -- https://github.com/withoutboats/heck
- heck 0.5.0 (MIT OR Apache-2.0) -- https://github.com/withoutboats/heck
- hermit-abi 0.5.2 (MIT OR Apache-2.0) -- https://github.com/hermit-os/hermit-rs
- hex 0.4.3 (MIT OR Apache-2.0) -- https://github.com/KokaKiwi/rust-hex
- html5ever 0.38.0 (MIT OR Apache-2.0) -- https://github.com/servo/html5ever
- http 1.4.2 (MIT OR Apache-2.0) -- https://github.com/hyperium/http
- http-body 1.0.1 (MIT) -- https://github.com/hyperium/http-body
- http-body-util 0.1.3 (MIT) -- https://github.com/hyperium/http-body
- httparse 1.10.1 (MIT OR Apache-2.0) -- https://github.com/seanmonstar/httparse
- hyper 1.10.1 (MIT) -- https://github.com/hyperium/hyper
- hyper-rustls 0.27.9 (Apache-2.0 OR ISC OR MIT) -- https://github.com/rustls/hyper-rustls
- hyper-util 0.1.20 (MIT) -- https://github.com/hyperium/hyper-util
- iana-time-zone 0.1.65 (MIT OR Apache-2.0) -- https://github.com/strawlab/iana-time-zone
- iana-time-zone-haiku 0.1.2 (MIT OR Apache-2.0) -- https://github.com/strawlab/iana-time-zone
- ico 0.5.0 (MIT) -- https://github.com/mdsteele/rust-ico
- icu_collections 2.2.0 (Unicode-3.0) -- https://github.com/unicode-org/icu4x
- icu_locale_core 2.2.0 (Unicode-3.0) -- https://github.com/unicode-org/icu4x
- icu_normalizer 2.2.0 (Unicode-3.0) -- https://github.com/unicode-org/icu4x
- icu_normalizer_data 2.2.0 (Unicode-3.0) -- https://github.com/unicode-org/icu4x
- icu_properties 2.2.0 (Unicode-3.0) -- https://github.com/unicode-org/icu4x
- icu_properties_data 2.2.0 (Unicode-3.0) -- https://github.com/unicode-org/icu4x
- icu_provider 2.2.0 (Unicode-3.0) -- https://github.com/unicode-org/icu4x
- ident_case 1.0.1 (MIT/Apache-2.0) -- https://github.com/TedDriggs/ident_case
- idna 1.1.0 (MIT OR Apache-2.0) -- https://github.com/servo/rust-url/
- idna_adapter 1.2.2 (Apache-2.0 OR MIT) -- https://github.com/hsivonen/idna_adapter
- indexmap 1.9.3 (Apache-2.0 OR MIT) -- https://github.com/bluss/indexmap
- indexmap 2.14.0 (Apache-2.0 OR MIT) -- https://github.com/indexmap-rs/indexmap
- infer 0.19.0 (MIT) -- https://github.com/bojand/infer
- io-kit-sys 0.4.1 (MIT / Apache-2.0) -- https://github.com/jtakakura/io-kit-rs
- ipnet 2.12.0 (MIT OR Apache-2.0) -- https://github.com/krisprice/ipnet
- is-docker 0.2.0 (MIT) -- https://github.com/TheLarkInn/is-docker
- is-wsl 0.4.0 (MIT) -- https://github.com/TheLarkInn/is-wsl
- itertools 0.14.0 (MIT OR Apache-2.0) -- https://github.com/rust-itertools/itertools
- itoa 1.0.18 (MIT OR Apache-2.0) -- https://github.com/dtolnay/itoa
- javascriptcore-rs 1.1.2 (MIT) -- https://github.com/tauri-apps/javascriptcore-rs
- javascriptcore-rs-sys 1.1.1 (MIT) -- https://github.com/tauri-apps/javascriptcore-rs
- jni 0.19.0 (MIT/Apache-2.0) -- https://github.com/jni-rs/jni-rs
- jni 0.21.1 (MIT/Apache-2.0) -- https://github.com/jni-rs/jni-rs
- jni-sys 0.3.1 (MIT OR Apache-2.0) -- https://github.com/jni-rs/jni-sys
- jni-sys 0.4.1 (MIT OR Apache-2.0) -- https://github.com/jni-rs/jni-sys
- jni-sys-macros 0.4.1 (MIT OR Apache-2.0) -- https://github.com/jni-rs/jni-sys
- jni-utils 0.1.1 (BSD-3-Clause) -- https://github.com/deviceplug/jni-utils-rs
- js-sys 0.3.103 (MIT OR Apache-2.0) -- https://github.com/wasm-bindgen/wasm-bindgen/tree/master/crates/js-sys
- json-patch 3.0.1 (MIT/Apache-2.0) -- https://github.com/idubrov/json-patch
- jsonptr 0.6.3 (MIT OR Apache-2.0) -- https://github.com/chanced/jsonptr
- keyboard-types 0.7.0 (MIT OR Apache-2.0) -- https://github.com/pyfisch/keyboard-types
- lazy_static 1.5.0 (MIT OR Apache-2.0) -- https://github.com/rust-lang-nursery/lazy-static.rs
- libappindicator 0.9.0 (Apache-2.0 OR MIT)
- libappindicator-sys 0.9.0 (Apache-2.0 OR MIT)
- libc 0.2.186 (MIT OR Apache-2.0) -- https://github.com/rust-lang/libc
- libdbus-sys 0.2.7 (Apache-2.0/MIT) -- https://github.com/diwic/dbus-rs
- libloading 0.7.4 (ISC) -- https://github.com/nagisa/rust_libloading/
- libredox 0.1.18 (MIT) -- https://gitlab.redox-os.org/redox-os/libredox.git
- libudev 0.3.0 (MIT) -- https://github.com/dcuddeback/libudev-rs
- libudev-sys 0.1.4 (MIT) -- https://github.com/dcuddeback/libudev-sys
- linux-raw-sys 0.12.1 (Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT) -- https://github.com/sunfishcode/linux-raw-sys
- litemap 0.8.2 (Unicode-3.0) -- https://github.com/unicode-org/icu4x
- lock_api 0.4.14 (MIT OR Apache-2.0) -- https://github.com/Amanieu/parking_lot
- log 0.4.33 (MIT OR Apache-2.0) -- https://github.com/rust-lang/log
- lru-slab 0.1.2 (MIT OR Apache-2.0 OR Zlib) -- https://github.com/Ralith/lru-slab
- macaddr 1.0.1 (Apache-2.0 OR MIT) -- https://github.com/svartalf/rust-macaddr
- mach2 0.4.3 (BSD-2-Clause OR MIT OR Apache-2.0) -- https://github.com/JohnTitor/mach2
- markup5ever 0.38.0 (MIT OR Apache-2.0) -- https://github.com/servo/html5ever
- memchr 2.8.3 (Unlicense OR MIT) -- https://github.com/BurntSushi/memchr
- memoffset 0.9.1 (MIT) -- https://github.com/Gilnaa/memoffset
- mime 0.3.17 (MIT OR Apache-2.0) -- https://github.com/hyperium/mime
- miniz_oxide 0.8.9 (MIT OR Zlib OR Apache-2.0) -- https://github.com/Frommi/miniz_oxide/tree/master/miniz_oxide
- mio 1.2.1 (MIT) -- https://github.com/tokio-rs/mio
- muda 0.19.3 (Apache-2.0 OR MIT) -- https://github.com/tauri-apps/muda
- ndk 0.9.0 (MIT OR Apache-2.0) -- https://github.com/rust-mobile/ndk
- ndk-context 0.1.1 (MIT OR Apache-2.0) -- https://github.com/rust-windowing/android-ndk-rs
- ndk-sys 0.6.0+11769913 (MIT OR Apache-2.0) -- https://github.com/rust-mobile/ndk
- new_debug_unreachable 1.0.6 (MIT) -- https://github.com/mbrubeck/rust-debug-unreachable
- nix 0.26.4 (MIT) -- https://github.com/nix-rust/nix
- nix 0.27.1 (MIT) -- https://github.com/nix-rust/nix
- nix 0.29.0 (MIT) -- https://github.com/nix-rust/nix
- num_enum 0.7.6 (BSD-3-Clause OR MIT OR Apache-2.0) -- https://github.com/illicitonion/num_enum
- num_enum_derive 0.7.6 (BSD-3-Clause OR MIT OR Apache-2.0) -- https://github.com/illicitonion/num_enum
- num_threads 0.1.7 (MIT OR Apache-2.0) -- https://github.com/jhpratt/num_threads
- num-conv 0.2.2 (MIT OR Apache-2.0) -- https://github.com/jhpratt/num-conv
- num-derive 0.4.2 (MIT OR Apache-2.0) -- https://github.com/rust-num/num-derive
- num-traits 0.2.19 (MIT OR Apache-2.0) -- https://github.com/rust-num/num-traits
- objc-sys 0.3.5 (MIT) -- https://github.com/madsmtm/objc2
- objc2 0.5.2 (MIT) -- https://github.com/madsmtm/objc2
- objc2 0.6.4 (MIT) -- https://github.com/madsmtm/objc2
- objc2-app-kit 0.3.2 (Zlib OR Apache-2.0 OR MIT) -- https://github.com/madsmtm/objc2
- objc2-cloud-kit 0.3.2 (Zlib OR Apache-2.0 OR MIT) -- https://github.com/madsmtm/objc2
- objc2-core-bluetooth 0.2.2 (MIT) -- https://github.com/madsmtm/objc2
- objc2-core-data 0.3.2 (Zlib OR Apache-2.0 OR MIT) -- https://github.com/madsmtm/objc2
- objc2-core-foundation 0.3.2 (Zlib OR Apache-2.0 OR MIT) -- https://github.com/madsmtm/objc2
- objc2-core-graphics 0.3.2 (Zlib OR Apache-2.0 OR MIT) -- https://github.com/madsmtm/objc2
- objc2-core-image 0.3.2 (Zlib OR Apache-2.0 OR MIT) -- https://github.com/madsmtm/objc2
- objc2-core-location 0.3.2 (Zlib OR Apache-2.0 OR MIT) -- https://github.com/madsmtm/objc2
- objc2-core-text 0.3.2 (Zlib OR Apache-2.0 OR MIT) -- https://github.com/madsmtm/objc2
- objc2-encode 4.1.0 (MIT) -- https://github.com/madsmtm/objc2
- objc2-exception-helper 0.1.1 (Zlib OR Apache-2.0 OR MIT) -- https://github.com/madsmtm/objc2
- objc2-foundation 0.2.2 (MIT) -- https://github.com/madsmtm/objc2
- objc2-foundation 0.3.2 (MIT) -- https://github.com/madsmtm/objc2
- objc2-io-surface 0.3.2 (Zlib OR Apache-2.0 OR MIT) -- https://github.com/madsmtm/objc2
- objc2-quartz-core 0.3.2 (Zlib OR Apache-2.0 OR MIT) -- https://github.com/madsmtm/objc2
- objc2-ui-kit 0.3.2 (Zlib OR Apache-2.0 OR MIT) -- https://github.com/madsmtm/objc2
- objc2-user-notifications 0.3.2 (Zlib OR Apache-2.0 OR MIT) -- https://github.com/madsmtm/objc2
- objc2-web-kit 0.3.2 (Zlib OR Apache-2.0 OR MIT) -- https://github.com/madsmtm/objc2
- once_cell 1.21.4 (MIT OR Apache-2.0) -- https://github.com/matklad/once_cell
- open 5.4.0 (MIT) -- https://github.com/Byron/open-rs
- option-ext 0.2.0 (MPL-2.0) -- https://github.com/soc/option-ext.git
- ordered-multimap 0.7.3 (MIT) -- https://github.com/sgodwincs/ordered-multimap-rs
- ordered-stream 0.2.0 (MIT OR Apache-2.0) -- https://github.com/danieldg/ordered-stream
- pango 0.18.3 (MIT) -- https://github.com/gtk-rs/gtk-rs-core
- pango-sys 0.18.0 (MIT) -- https://github.com/gtk-rs/gtk-rs-core
- parking 2.2.1 (Apache-2.0 OR MIT) -- https://github.com/smol-rs/parking
- parking_lot 0.12.5 (MIT OR Apache-2.0) -- https://github.com/Amanieu/parking_lot
- parking_lot_core 0.9.12 (MIT OR Apache-2.0) -- https://github.com/Amanieu/parking_lot
- percent-encoding 2.3.2 (MIT OR Apache-2.0) -- https://github.com/servo/rust-url/
- phf 0.13.1 (MIT) -- https://github.com/rust-phf/rust-phf
- phf_codegen 0.13.1 (MIT) -- https://github.com/rust-phf/rust-phf
- phf_generator 0.13.1 (MIT) -- https://github.com/rust-phf/rust-phf
- phf_macros 0.13.1 (MIT) -- https://github.com/rust-phf/rust-phf
- phf_shared 0.13.1 (MIT) -- https://github.com/rust-phf/rust-phf
- pin-project 1.1.13 (Apache-2.0 OR MIT) -- https://github.com/taiki-e/pin-project
- pin-project-internal 1.1.13 (Apache-2.0 OR MIT) -- https://github.com/taiki-e/pin-project
- pin-project-lite 0.2.17 (Apache-2.0 OR MIT) -- https://github.com/taiki-e/pin-project-lite
- piper 0.2.5 (MIT OR Apache-2.0) -- https://github.com/smol-rs/piper
- pkg-config 0.3.33 (MIT OR Apache-2.0) -- https://github.com/rust-lang/pkg-config-rs
- plist 1.10.0 (MIT) -- https://github.com/ebarnard/rust-plist/
- png 0.17.16 (MIT OR Apache-2.0) -- https://github.com/image-rs/image-png
- png 0.18.1 (MIT OR Apache-2.0) -- https://github.com/image-rs/image-png
- polling 3.11.0 (Apache-2.0 OR MIT) -- https://github.com/smol-rs/polling
- potential_utf 0.1.5 (Unicode-3.0) -- https://github.com/unicode-org/icu4x
- powerfmt 0.2.0 (MIT OR Apache-2.0) -- https://github.com/jhpratt/powerfmt
- ppv-lite86 0.2.21 (MIT OR Apache-2.0) -- https://github.com/cryptocorrosion/cryptocorrosion
- precomputed-hash 0.1.1 (MIT) -- https://github.com/emilio/precomputed-hash
- proc-macro-crate 1.3.1 (MIT OR Apache-2.0) -- https://github.com/bkchr/proc-macro-crate
- proc-macro-crate 2.0.2 (MIT OR Apache-2.0) -- https://github.com/bkchr/proc-macro-crate
- proc-macro-crate 3.5.0 (MIT OR Apache-2.0) -- https://github.com/bkchr/proc-macro-crate
- proc-macro-error 1.0.4 (MIT OR Apache-2.0) -- https://gitlab.com/CreepySkeleton/proc-macro-error
- proc-macro-error-attr 1.0.4 (MIT OR Apache-2.0) -- https://gitlab.com/CreepySkeleton/proc-macro-error
- proc-macro2 1.0.106 (MIT OR Apache-2.0) -- https://github.com/dtolnay/proc-macro2
- ptr_meta 0.1.4 (MIT) -- https://github.com/djkoloski/ptr_meta
- ptr_meta_derive 0.1.4 (MIT) -- https://github.com/djkoloski/ptr_meta
- quick-xml 0.41.0 (MIT) -- https://github.com/tafia/quick-xml
- quinn 0.11.11 (MIT OR Apache-2.0) -- https://github.com/quinn-rs/quinn
- quinn-proto 0.11.16 (MIT OR Apache-2.0) -- https://github.com/quinn-rs/quinn
- quinn-udp 0.5.15 (MIT OR Apache-2.0) -- https://github.com/quinn-rs/quinn
- quote 1.0.46 (MIT OR Apache-2.0) -- https://github.com/dtolnay/quote
- r-efi 5.3.0 (MIT OR Apache-2.0 OR LGPL-2.1-or-later) -- https://github.com/r-efi/r-efi
- r-efi 6.0.0 (MIT OR Apache-2.0 OR LGPL-2.1-or-later) -- https://github.com/r-efi/r-efi
- radium 0.7.0 (MIT) -- https://github.com/bitvecto-rs/radium
- rand 0.8.6 (MIT OR Apache-2.0) -- https://github.com/rust-random/rand
- rand 0.10.2 (MIT OR Apache-2.0) -- https://github.com/rust-random/rand
- rand_chacha 0.3.1 (MIT OR Apache-2.0) -- https://github.com/rust-random/rand
- rand_core 0.6.4 (MIT OR Apache-2.0) -- https://github.com/rust-random/rand
- rand_core 0.10.1 (MIT OR Apache-2.0) -- https://github.com/rust-random/rand_core
- rand_pcg 0.10.2 (MIT OR Apache-2.0) -- https://github.com/rust-random/rngs
- raw-window-handle 0.6.2 (MIT OR Apache-2.0 OR Zlib) -- https://github.com/rust-windowing/raw-window-handle
- redox_syscall 0.5.18 (MIT) -- https://gitlab.redox-os.org/redox-os/syscall
- redox_users 0.5.2 (MIT) -- https://gitlab.redox-os.org/redox-os/users
- ref-cast 1.0.25 (MIT OR Apache-2.0) -- https://github.com/dtolnay/ref-cast
- ref-cast-impl 1.0.25 (MIT OR Apache-2.0) -- https://github.com/dtolnay/ref-cast
- regex 1.12.4 (MIT OR Apache-2.0) -- https://github.com/rust-lang/regex
- regex-automata 0.4.14 (MIT OR Apache-2.0) -- https://github.com/rust-lang/regex
- regex-syntax 0.8.11 (MIT OR Apache-2.0) -- https://github.com/rust-lang/regex
- rend 0.4.2 (MIT) -- https://github.com/djkoloski/rend
- reqwest 0.12.28 (MIT OR Apache-2.0) -- https://github.com/seanmonstar/reqwest
- reqwest 0.13.4 (MIT OR Apache-2.0) -- https://github.com/seanmonstar/reqwest
- rfd 0.16.0 (MIT) -- https://github.com/PolyMeilex/rfd
- ring 0.17.14 (Apache-2.0 AND ISC) -- https://github.com/briansmith/ring
- rkyv 0.7.46 (MIT) -- https://github.com/rkyv/rkyv
- rkyv_derive 0.7.46 (MIT) -- https://github.com/rkyv/rkyv
- rust_decimal 1.42.1 (MIT) -- https://github.com/paupino/rust-decimal
- rust-ini 0.21.3 (MIT) -- https://github.com/zonyitoo/rust-ini
- rustc_version 0.4.1 (MIT OR Apache-2.0) -- https://github.com/djc/rustc-version-rs
- rustc-hash 2.1.3 (Apache-2.0 OR MIT) -- https://github.com/rust-lang/rustc-hash
- rustix 1.1.4 (Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT) -- https://github.com/bytecodealliance/rustix
- rustls 0.23.43 (Apache-2.0 OR ISC OR MIT) -- https://github.com/rustls/rustls
- rustls-pki-types 1.15.1 (MIT OR Apache-2.0) -- https://github.com/rustls/pki-types
- rustls-webpki 0.103.13 (ISC) -- https://github.com/rustls/webpki
- rustversion 1.0.23 (MIT OR Apache-2.0) -- https://github.com/dtolnay/rustversion
- ryu 1.0.23 (Apache-2.0 OR BSL-1.0) -- https://github.com/dtolnay/ryu
- same-file 1.0.6 (Unlicense/MIT) -- https://github.com/BurntSushi/same-file
- schemars 0.8.22 (MIT) -- https://github.com/GREsau/schemars
- schemars 0.9.0 (MIT) -- https://github.com/GREsau/schemars
- schemars 1.2.1 (MIT) -- https://github.com/GREsau/schemars
- schemars_derive 0.8.22 (MIT) -- https://github.com/GREsau/schemars
- scopeguard 1.2.0 (MIT OR Apache-2.0) -- https://github.com/bluss/scopeguard
- seahash 4.1.0 (MIT) -- https://gitlab.redox-os.org/redox-os/seahash
- selectors 0.36.1 (MPL-2.0) -- https://github.com/servo/stylo
- semver 1.0.28 (MIT OR Apache-2.0) -- https://github.com/dtolnay/semver
- serde 1.0.228 (MIT OR Apache-2.0) -- https://github.com/serde-rs/serde
- serde_bytes 0.11.19 (MIT OR Apache-2.0) -- https://github.com/serde-rs/bytes
- serde_core 1.0.228 (MIT OR Apache-2.0) -- https://github.com/serde-rs/serde
- serde_derive 1.0.228 (MIT OR Apache-2.0) -- https://github.com/serde-rs/serde
- serde_derive_internals 0.29.1 (MIT OR Apache-2.0) -- https://github.com/serde-rs/serde
- serde_json 1.0.150 (MIT OR Apache-2.0) -- https://github.com/serde-rs/json
- serde_repr 0.1.20 (MIT OR Apache-2.0) -- https://github.com/dtolnay/serde-repr
- serde_spanned 0.6.9 (MIT OR Apache-2.0) -- https://github.com/toml-rs/toml
- serde_spanned 1.1.1 (MIT OR Apache-2.0) -- https://github.com/toml-rs/toml
- serde_urlencoded 0.7.1 (MIT/Apache-2.0) -- https://github.com/nox/serde_urlencoded
- serde_with 3.21.0 (MIT OR Apache-2.0) -- https://github.com/jonasbb/serde_with/
- serde_with_macros 3.21.0 (MIT OR Apache-2.0) -- https://github.com/jonasbb/serde_with/
- serde-untagged 0.1.9 (MIT OR Apache-2.0) -- https://github.com/dtolnay/serde-untagged
- serde-xml-rs 0.8.2 (MIT) -- https://github.com/RReverser/serde-xml-rs
- serialize-to-javascript 0.1.2 (MIT OR Apache-2.0) -- https://github.com/chippers/serialize-to-javascript
- serialize-to-javascript-impl 0.1.2 (MIT OR Apache-2.0) -- https://github.com/chippers/serialize-to-javascript
- serialport 4.9.0 (MPL-2.0) -- https://github.com/serialport/serialport-rs
- servo_arc 0.4.3 (MIT OR Apache-2.0) -- https://github.com/servo/stylo
- sha1 0.10.6 (MIT OR Apache-2.0) -- https://github.com/RustCrypto/hashes
- sha2 0.10.9 (MIT OR Apache-2.0) -- https://github.com/RustCrypto/hashes
- shlex 2.0.1 (MIT OR Apache-2.0) -- https://github.com/comex/rust-shlex
- signal-hook-registry 1.4.8 (MIT OR Apache-2.0) -- https://github.com/vorner/signal-hook
- simd-adler32 0.3.9 (MIT) -- https://github.com/mcountryman/simd-adler32
- simdutf8 0.1.5 (MIT OR Apache-2.0) -- https://github.com/rusticstuff/simdutf8
- siphasher 1.0.3 (MIT/Apache-2.0) -- https://github.com/jedisct1/rust-siphash
- slab 0.4.12 (MIT) -- https://github.com/tokio-rs/slab
- smallvec 1.15.2 (MIT OR Apache-2.0) -- https://github.com/servo/rust-smallvec
- socket2 0.6.4 (MIT OR Apache-2.0) -- https://github.com/rust-lang/socket2
- softbuffer 0.4.8 (MIT OR Apache-2.0) -- https://github.com/rust-windowing/softbuffer
- soup3 0.5.0 (MIT) -- https://gitlab.gnome.org/World/Rust/soup3-rs
- soup3-sys 0.5.0 (MIT) -- https://gitlab.gnome.org/World/Rust/soup3-rs
- stable_deref_trait 1.2.1 (MIT OR Apache-2.0) -- https://github.com/storyyeller/stable_deref_trait
- static_assertions 1.1.0 (MIT OR Apache-2.0) -- https://github.com/nvzqz/static-assertions-rs
- string_cache 0.9.0 (MIT OR Apache-2.0) -- https://github.com/servo/string-cache
- string_cache_codegen 0.6.1 (MIT OR Apache-2.0) -- https://github.com/servo/string-cache
- strsim 0.11.1 (MIT) -- https://github.com/rapidfuzz/strsim-rs
- strum 0.26.3 (MIT) -- https://github.com/Peternator7/strum
- strum_macros 0.26.4 (MIT) -- https://github.com/Peternator7/strum
- subtle 2.6.1 (BSD-3-Clause) -- https://github.com/dalek-cryptography/subtle
- swift-rs 1.0.7 (MIT OR Apache-2.0) -- https://github.com/Brendonovich/swift-rs
- syn 1.0.109 (MIT OR Apache-2.0) -- https://github.com/dtolnay/syn
- syn 2.0.118 (MIT OR Apache-2.0) -- https://github.com/dtolnay/syn
- sync_wrapper 1.0.2 (Apache-2.0) -- https://github.com/Actyx/sync_wrapper
- synstructure 0.13.2 (MIT) -- https://github.com/mystor/synstructure
- system-deps 6.2.2 (MIT OR Apache-2.0) -- https://github.com/gdesmott/system-deps
- tao 0.35.3 (Apache-2.0) -- https://github.com/tauri-apps/tao
- tao-macros 0.1.3 (MIT OR Apache-2.0) -- https://github.com/tauri-apps/tao
- tap 1.0.1 (MIT) -- https://github.com/myrrlyn/tap
- target-lexicon 0.12.16 (Apache-2.0 WITH LLVM-exception) -- https://github.com/bytecodealliance/target-lexicon
- tauri 2.11.5 (Apache-2.0 OR MIT) -- https://github.com/tauri-apps/tauri
- tauri-build 2.6.3 (Apache-2.0 OR MIT) -- https://github.com/tauri-apps/tauri
- tauri-codegen 2.6.3 (Apache-2.0 OR MIT) -- https://github.com/tauri-apps/tauri
- tauri-macros 2.6.3 (Apache-2.0 OR MIT) -- https://github.com/tauri-apps/tauri
- tauri-plugin 2.6.3 (Apache-2.0 OR MIT) -- https://github.com/tauri-apps/tauri
- tauri-plugin-blec 0.5.3 (MIT OR Apache-2.0) -- https://github.com/MnlPhlp/tauri-plugin-blec
- tauri-plugin-deep-link 2.4.9 (Apache-2.0 OR MIT) -- https://github.com/tauri-apps/plugins-workspace
- tauri-plugin-depth-capture 0.1.0 (MIT)
- tauri-plugin-dialog 2.7.1 (Apache-2.0 OR MIT) -- https://github.com/tauri-apps/plugins-workspace
- tauri-plugin-fs 2.5.1 (Apache-2.0 OR MIT) -- https://github.com/tauri-apps/plugins-workspace
- tauri-plugin-log 2.8.0 (Apache-2.0 OR MIT) -- https://github.com/tauri-apps/plugins-workspace
- tauri-plugin-opener 2.5.4 (Apache-2.0 OR MIT) -- https://github.com/tauri-apps/plugins-workspace
- tauri-plugin-scratchlink-original 0.1.0 (BSD-3-Clause)
- tauri-plugin-share 2.0.5 (MIT OR Apache-2.0) -- https://github.com/lindongchen/tauri-plugin-share
- tauri-runtime 2.11.3 (Apache-2.0 OR MIT) -- https://github.com/tauri-apps/tauri
- tauri-runtime-wry 2.11.4 (Apache-2.0 OR MIT) -- https://github.com/tauri-apps/tauri
- tauri-utils 2.9.3 (Apache-2.0 OR MIT) -- https://github.com/tauri-apps/tauri
- tauri-winres 0.3.6 (MIT) -- https://github.com/tauri-apps/winres
- tempfile 3.27.0 (MIT OR Apache-2.0) -- https://github.com/Stebalien/tempfile
- tendril 0.5.1 (MIT OR Apache-2.0) -- https://github.com/servo/html5ever
- thiserror 1.0.69 (MIT OR Apache-2.0) -- https://github.com/dtolnay/thiserror
- thiserror 2.0.18 (MIT OR Apache-2.0) -- https://github.com/dtolnay/thiserror
- thiserror-impl 1.0.69 (MIT OR Apache-2.0) -- https://github.com/dtolnay/thiserror
- thiserror-impl 2.0.18 (MIT OR Apache-2.0) -- https://github.com/dtolnay/thiserror
- time 0.3.53 (MIT OR Apache-2.0) -- https://github.com/time-rs/time
- time-core 0.1.9 (MIT OR Apache-2.0) -- https://github.com/time-rs/time
- time-macros 0.2.31 (MIT OR Apache-2.0) -- https://github.com/time-rs/time
- tiny-keccak 2.0.2 (CC0-1.0) -- https://github.com/debris/tiny-keccak
- tinystr 0.8.3 (Unicode-3.0) -- https://github.com/unicode-org/icu4x
- tinyvec 1.11.0 (Zlib OR Apache-2.0 OR MIT) -- https://github.com/Lokathor/tinyvec
- tinyvec_macros 0.1.1 (MIT OR Apache-2.0 OR Zlib) -- https://github.com/Soveu/tinyvec_macros
- tokio 1.52.3 (MIT) -- https://github.com/tokio-rs/tokio
- tokio-macros 2.7.0 (MIT) -- https://github.com/tokio-rs/tokio
- tokio-rustls 0.26.4 (MIT OR Apache-2.0) -- https://github.com/rustls/tokio-rustls
- tokio-stream 0.1.18 (MIT) -- https://github.com/tokio-rs/tokio
- tokio-tungstenite 0.24.0 (MIT) -- https://github.com/snapview/tokio-tungstenite
- tokio-util 0.7.18 (MIT) -- https://github.com/tokio-rs/tokio
- toml 0.8.2 (MIT OR Apache-2.0) -- https://github.com/toml-rs/toml
- toml 0.9.12+spec-1.1.0 (MIT OR Apache-2.0) -- https://github.com/toml-rs/toml
- toml 1.1.2+spec-1.1.0 (MIT OR Apache-2.0) -- https://github.com/toml-rs/toml
- toml_datetime 0.6.3 (MIT OR Apache-2.0) -- https://github.com/toml-rs/toml
- toml_datetime 0.7.5+spec-1.1.0 (MIT OR Apache-2.0) -- https://github.com/toml-rs/toml
- toml_datetime 1.1.1+spec-1.1.0 (MIT OR Apache-2.0) -- https://github.com/toml-rs/toml
- toml_edit 0.19.15 (MIT OR Apache-2.0) -- https://github.com/toml-rs/toml
- toml_edit 0.20.2 (MIT OR Apache-2.0) -- https://github.com/toml-rs/toml
- toml_edit 0.25.12+spec-1.1.0 (MIT OR Apache-2.0) -- https://github.com/toml-rs/toml
- toml_parser 1.1.2+spec-1.1.0 (MIT OR Apache-2.0) -- https://github.com/toml-rs/toml
- toml_writer 1.1.1+spec-1.1.0 (MIT OR Apache-2.0) -- https://github.com/toml-rs/toml
- tower 0.5.3 (MIT) -- https://github.com/tower-rs/tower
- tower-http 0.6.11 (MIT) -- https://github.com/tower-rs/tower-http
- tower-layer 0.3.3 (MIT) -- https://github.com/tower-rs/tower
- tower-service 0.3.3 (MIT) -- https://github.com/tower-rs/tower
- tracing 0.1.44 (MIT) -- https://github.com/tokio-rs/tracing
- tracing-attributes 0.1.31 (MIT) -- https://github.com/tokio-rs/tracing
- tracing-core 0.1.36 (MIT) -- https://github.com/tokio-rs/tracing
- tray-icon 0.24.1 (MIT OR Apache-2.0) -- https://github.com/tauri-apps/tray-icon
- try-lock 0.2.5 (MIT) -- https://github.com/seanmonstar/try-lock
- tungstenite 0.24.0 (MIT OR Apache-2.0) -- https://github.com/snapview/tungstenite-rs
- typeid 1.0.3 (MIT OR Apache-2.0) -- https://github.com/dtolnay/typeid
- typenum 1.20.1 (MIT OR Apache-2.0) -- https://github.com/paholg/typenum
- uds_windows 1.2.1 (MIT) -- https://github.com/haraldh/rust_uds_windows
- unescaper 0.1.10 (MIT OR GPL-3.0-only) -- https://github.com/hack-ink/unescaper
- unic-char-property 0.9.0 (MIT/Apache-2.0) -- https://github.com/open-i18n/rust-unic/
- unic-char-range 0.9.0 (MIT/Apache-2.0) -- https://github.com/open-i18n/rust-unic/
- unic-common 0.9.0 (MIT/Apache-2.0) -- https://github.com/open-i18n/rust-unic/
- unic-ucd-ident 0.9.0 (MIT/Apache-2.0) -- https://github.com/open-i18n/rust-unic/
- unic-ucd-version 0.9.0 (MIT/Apache-2.0) -- https://github.com/open-i18n/rust-unic/
- unicode-ident 1.0.24 ((MIT OR Apache-2.0) AND Unicode-3.0) -- https://github.com/dtolnay/unicode-ident
- unicode-segmentation 1.13.3 (MIT OR Apache-2.0) -- https://github.com/unicode-rs/unicode-segmentation
- untrusted 0.9.0 (ISC) -- https://github.com/briansmith/untrusted
- url 2.5.8 (MIT OR Apache-2.0) -- https://github.com/servo/rust-url
- urlpattern 0.3.0 (MIT) -- https://github.com/denoland/rust-urlpattern
- utf-8 0.7.6 (MIT OR Apache-2.0) -- https://github.com/SimonSapin/rust-utf8
- utf8_iter 1.0.4 (Apache-2.0 OR MIT) -- https://github.com/hsivonen/utf8_iter
- utf8-width 0.1.9 (MIT) -- https://github.com/magiclen/utf8-width
- uuid 1.23.4 (Apache-2.0 OR MIT) -- https://github.com/uuid-rs/uuid
- value-bag 1.12.0 (Apache-2.0 OR MIT) -- https://github.com/sval-rs/value-bag
- version_check 0.9.5 (MIT/Apache-2.0) -- https://github.com/SergioBenitez/version_check
- version-compare 0.2.1 (MIT) -- https://gitlab.com/timvisee/version-compare
- vswhom 0.1.0 (MIT) -- https://github.com/nabijaczleweli/vswhom.rs
- vswhom-sys 0.1.3 (MIT) -- https://github.com/nabijaczleweli/vswhom-sys.rs
- walkdir 2.5.0 (Unlicense/MIT) -- https://github.com/BurntSushi/walkdir
- want 0.3.1 (MIT) -- https://github.com/seanmonstar/want
- wasi 0.11.1+wasi-snapshot-preview1 (Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT) -- https://github.com/bytecodealliance/wasi
- wasip2 1.0.4+wasi-0.2.12 (Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT) -- https://github.com/bytecodealliance/wasi-rs
- wasm-bindgen 0.2.126 (MIT OR Apache-2.0) -- https://github.com/wasm-bindgen/wasm-bindgen
- wasm-bindgen-futures 0.4.76 (MIT OR Apache-2.0) -- https://github.com/wasm-bindgen/wasm-bindgen/tree/master/crates/futures
- wasm-bindgen-macro 0.2.126 (MIT OR Apache-2.0) -- https://github.com/wasm-bindgen/wasm-bindgen/tree/master/crates/macro
- wasm-bindgen-macro-support 0.2.126 (MIT OR Apache-2.0) -- https://github.com/wasm-bindgen/wasm-bindgen/tree/master/crates/macro-support
- wasm-bindgen-shared 0.2.126 (MIT OR Apache-2.0) -- https://github.com/wasm-bindgen/wasm-bindgen/tree/master/crates/shared
- wasm-streams 0.4.2 (MIT OR Apache-2.0) -- https://github.com/MattiasBuelens/wasm-streams/
- wasm-streams 0.5.0 (MIT OR Apache-2.0) -- https://github.com/MattiasBuelens/wasm-streams/
- web_atoms 0.2.5 (MIT OR Apache-2.0) -- https://github.com/servo/html5ever
- web-sys 0.3.103 (MIT OR Apache-2.0) -- https://github.com/wasm-bindgen/wasm-bindgen/tree/master/crates/web-sys
- web-time 1.1.0 (MIT OR Apache-2.0) -- https://github.com/daxpedda/web-time
- webkit2gtk 2.0.2 (MIT) -- https://github.com/tauri-apps/webkit2gtk-rs
- webkit2gtk-sys 2.0.2 (MIT) -- https://github.com/tauri-apps/webkit2gtk-rs
- webpki-roots 1.0.9 (CDLA-Permissive-2.0) -- https://github.com/rustls/webpki-roots
- webview2-com 0.38.2 (MIT) -- https://github.com/wravery/webview2-rs
- webview2-com-macros 0.8.1 (MIT) -- https://github.com/wravery/webview2-rs
- webview2-com-sys 0.38.2 (MIT) -- https://github.com/wravery/webview2-rs
- winapi 0.3.9 (MIT/Apache-2.0) -- https://github.com/retep998/winapi-rs
- winapi-i686-pc-windows-gnu 0.4.0 (MIT/Apache-2.0) -- https://github.com/retep998/winapi-rs
- winapi-util 0.1.11 (Unlicense OR MIT) -- https://github.com/BurntSushi/winapi-util
- winapi-x86_64-pc-windows-gnu 0.4.0 (MIT/Apache-2.0) -- https://github.com/retep998/winapi-rs
- window-vibrancy 0.6.0 (Apache-2.0 OR MIT) -- https://github.com/tauri-apps/tauri-plugin-vibrancy
- windows 0.58.0 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows 0.61.3 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows_aarch64_gnullvm 0.42.2 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows_aarch64_gnullvm 0.52.6 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows_aarch64_gnullvm 0.53.1 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows_aarch64_msvc 0.42.2 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows_aarch64_msvc 0.52.6 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows_aarch64_msvc 0.53.1 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows_i686_gnu 0.42.2 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows_i686_gnu 0.52.6 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows_i686_gnu 0.53.1 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows_i686_gnullvm 0.52.6 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows_i686_gnullvm 0.53.1 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows_i686_msvc 0.42.2 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows_i686_msvc 0.52.6 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows_i686_msvc 0.53.1 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows_x86_64_gnu 0.42.2 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows_x86_64_gnu 0.52.6 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows_x86_64_gnu 0.53.1 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows_x86_64_gnullvm 0.42.2 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows_x86_64_gnullvm 0.52.6 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows_x86_64_gnullvm 0.53.1 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows_x86_64_msvc 0.42.2 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows_x86_64_msvc 0.52.6 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows_x86_64_msvc 0.53.1 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows-collections 0.2.0 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows-core 0.58.0 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows-core 0.61.2 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows-core 0.62.2 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows-future 0.2.1 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows-implement 0.58.0 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows-implement 0.60.2 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows-interface 0.58.0 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows-interface 0.59.3 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows-link 0.1.3 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows-link 0.2.1 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows-numerics 0.2.0 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows-registry 0.5.3 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows-result 0.2.0 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows-result 0.3.4 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows-result 0.4.1 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows-strings 0.1.0 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows-strings 0.4.2 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows-strings 0.5.1 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows-sys 0.45.0 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows-sys 0.52.0 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows-sys 0.59.0 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows-sys 0.60.2 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows-sys 0.61.2 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows-targets 0.42.2 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows-targets 0.52.6 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows-targets 0.53.5 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows-threading 0.1.0 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- windows-version 0.1.7 (MIT OR Apache-2.0) -- https://github.com/microsoft/windows-rs
- winnow 0.5.40 (MIT) -- https://github.com/winnow-rs/winnow
- winnow 0.7.15 (MIT) -- https://github.com/winnow-rs/winnow
- winnow 1.0.3 (MIT) -- https://github.com/winnow-rs/winnow
- winreg 0.55.0 (MIT) -- https://github.com/gentoo90/winreg-rs
- wit-bindgen 0.57.1 (Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT) -- https://github.com/bytecodealliance/wit-bindgen
- writeable 0.6.3 (Unicode-3.0) -- https://github.com/unicode-org/icu4x
- wry 0.55.1 (Apache-2.0 OR MIT) -- https://github.com/tauri-apps/wry
- wyz 0.5.1 (MIT) -- https://github.com/myrrlyn/wyz
- x11 2.21.0 (MIT) -- https://github.com/AltF02/x11-rs.git
- x11-dl 2.21.0 (MIT) -- https://github.com/AltF02/x11-rs.git
- xml 1.3.0 (MIT) -- https://github.com/kornelski/xml-rs
- yoke 0.8.3 (Unicode-3.0) -- https://github.com/unicode-org/icu4x
- yoke-derive 0.8.2 (Unicode-3.0) -- https://github.com/unicode-org/icu4x
- zbus 5.18.0 (MIT) -- https://github.com/z-galaxy/zbus/
- zbus_macros 5.18.0 (MIT) -- https://github.com/z-galaxy/zbus/
- zbus_names 4.3.4 (MIT) -- https://github.com/z-galaxy/zbus/
- zerocopy 0.8.53 (BSD-2-Clause OR Apache-2.0 OR MIT) -- https://github.com/google/zerocopy
- zerocopy-derive 0.8.53 (BSD-2-Clause OR Apache-2.0 OR MIT) -- https://github.com/google/zerocopy
- zerofrom 0.1.8 (Unicode-3.0) -- https://github.com/unicode-org/icu4x
- zerofrom-derive 0.1.7 (Unicode-3.0) -- https://github.com/unicode-org/icu4x
- zeroize 1.9.0 (Apache-2.0 OR MIT) -- https://github.com/RustCrypto/utils
- zerotrie 0.2.4 (Unicode-3.0) -- https://github.com/unicode-org/icu4x
- zerovec 0.11.6 (Unicode-3.0) -- https://github.com/unicode-org/icu4x
- zerovec-derive 0.11.3 (Unicode-3.0) -- https://github.com/unicode-org/icu4x
- zip 2.4.2 (MIT) -- https://github.com/zip-rs/zip2.git
- zmij 1.0.21 (MIT) -- https://github.com/dtolnay/zmij
- zopfli 0.8.3 (Apache-2.0) -- https://github.com/zopfli-rs/zopfli
- zvariant 5.13.1 (MIT) -- https://github.com/z-galaxy/zbus/
- zvariant_derive 5.13.1 (MIT) -- https://github.com/z-galaxy/zbus/
- zvariant_utils 3.5.0 (MIT) -- https://github.com/z-galaxy/zbus/

<!-- END GENERATED RUST CRATE LIST -->

## bw-circuit-ui — MPL-2.0

**Installed location:** `node_modules/bw-circuit-ui/` (root tooling) and
`packages/scratch-gui/node_modules/bw-circuit-ui/` (application).

The application imports the pinned Git package **bw-circuit-ui** (circuit designer
UI: board canvas, schematic view, part models, interaction handlers, and wokwi
element wrappers), licensed under **MPL-2.0** (Mozilla Public License 2.0).

- **Licence:** MPL-2.0
- **Copyright:** (c) CrispStrobe
- **Upstream:** https://github.com/CrispStrobe/bw-circuit-ui
- **Source availability:** `static/licenses/bw-packages.sources.json` in the built
  application records the full pinned commit, public source tree and source
  archive URLs. The tracked source manifest lives in
  `overlay/scratch-gui/static/licenses/bw-packages.sources.json`.

`static/licenses/bw-circuit-ui.MPL-2.0.txt` preserves upstream's actual `LICENSE`
bytes. Package metadata at the current pin incorrectly says MIT; that metadata
does not replace the MPL-2.0 license file. The attribution is retained here
because the standard MPL text contains no project copyright line.

### Licence boundary

MPL-2.0 is a file-level copyleft licence. Each file under
the installed `bw-circuit-ui` package remains licensed under MPL-2.0
within this BSD-3-Clause project. MPL-2.0 §3.3 ("Larger Work") explicitly
permits distributing MPL-licensed files alongside files under a different
licence — which is how this bundle is structured.

Modifications to covered files must be made available under MPL-2.0. This
migration consumes the pinned upstream package without application-local source
patches; the source links identify that exact version. Other components retain
their respective licenses.

### Format knowledge, not code

bw-circuit-ui's importers and exporters read and write file formats nobody in
this project designed (KiCad, EasyEDA, SPICE, LTspice ASC). Its source cites
`THIRD-PARTY.md` for where those facts came from — e.g.
`src/importers/kicad-common.js`: "see THIRD-PARTY.md. The code is ours." That
file ships inside the installed package (`node_modules/bw-circuit-ui/THIRD-PARTY.md`);
its format-knowledge table is reproduced here so the pointer resolves from this
repository too. Facts about a format are not copyrightable and no third-party
implementation was copied; GPL/LGPL/AGPL projects named below were read for
facts only. `test/notices-format-knowledge.test.mjs` fails when upstream's
table gains or changes a row this copy lacks.

| Source | Licence | What was taken |
|---|---|---|
| KiCad file-format documentation (dev-docs.kicad.org) | CC-BY-SA 4.0 (docs) | the `.kicad_sch` and legacy EESchema grammars |
| [KiCadFiles](https://github.com/ImpulseAdventure/KiCadFiles) | MIT | schema knowledge for `.kicad_sch` tokens |
| KiCad dev-docs, EasyEDA import format (dev-docs.kicad.org/en/import-formats/easyeda) | CC-BY-SA 4.0 (docs) | the `docType` MAP only (1 sheet, 2 symbol, 3 PCB, 4 footprint, 5 container, 14 module) — a fact table, no code read |
| EasyEDA Pro file-format docs (github.com/easyeda/easyeda-pro-file-format, prodocs.easyeda.com) | none stated (docs quoted as facts, not vendored) | the record vocabulary of both Pro generations; several fields were found WRONG vs real files and re-decoded by measurement |
| KiCad source `pcbnew/pcb_io/easyedapro` | GPL-3.0 (read for FACTS only, no code ported) | three load-bearing facts cross-checked: 1 unit = 1 mil, POURED fills at 1/10 scale, the fixed Pro layer table |
| EasyEDA Standard PCB `.json` (docType 3) | — | the PCB half of the tilde DSL, decoded by MEASURING three real boards (2026-08-25); no reader's source was read while writing `src/importers/easyeda-pcb.js` |
| EasyEDA Standard `.json` documents | — | the tilde-delimited shape DSL, decoded by MEASURING published schematics; no reader's source was read while writing `src/importers/easyeda.js` |
| SPICE netlist language (ngspice manual, and every SPICE textbook) | the language is a published format, not a work | element letters and their node counts, node 0 as the reference, `.model`/`.subckt`/`.control`, and the scale factors. The suffix table was CHECKED against ngspice 42 rather than trusted: a deck of six resistors read back out of its own device table gives `1M` = 1e-3, `1MEG` = 1e6, `1MIL` = 2.54e-5, `1F` = 1e-15. No simulator's source was read while writing `src/importers/spice.js` or `src/model/exporters/spice.js` |
| [asc_viewer](https://github.com/ahaensler/asc_viewer) | MIT | Cross-check of ASC instance-record ownership, ASY `SpiceOrder`, attribute defaults and mirror-before-rotation behavior. No Python source was copied. |
| [Weave](https://github.com/senolgulgonul/weave) | MIT for Weave code; bundled elkjs is EPL-2.0 | Its independent ASC connectivity verifier was used as a differential oracle for endpoint-on-segment and crossing behavior, and its generated companion-ASY approach was reviewed. No embedded/vendor-derived symbol table or implementation code was copied. |
| [ltspice2kicad](https://github.com/LBurnsUF/ltspice2kicad) | MIT | Cross-format ASC record vocabulary and generated-KiCad behavior were reviewed. Its known detached-pin output was treated as a counterexample, not an oracle; no Zig source was copied. |

## bw-board — MIT

**Installed location:** `node_modules/bw-board/` (root tooling) and
`packages/scratch-gui/node_modules/bw-board/` (application).

The application imports the pinned Git package **bw-board** (simulation engine:
netlist inference, pin model, MNA solver, device drivers, emu8051 adapter),
licensed under the **MIT License**.

- **Licence:** MIT
- **Upstream:** https://github.com/CrispStrobe/bw-board
- **Independent CP1 monitor:** `static/roms/cp1-independent-monitor.bin` is
  built from the engine's original `firmware/cp1` sources. The focused CP1
  workflow rebuilds the image from the adopted Board revision and compares the
  complete binary. See [the firmware record](docs/CP1-EDITOR-CONTRACT.md).
- **Licence file:** `overlay/scratch-gui/static/licenses/bw-board.MIT.txt`,
  shipped as `static/licenses/bw-board.MIT.txt`.
- **Pinned source links:** `static/licenses/bw-packages.sources.json` in the application.

MIT requires the copyright and permission notice to be included in all copies
or substantial portions of the Software. The preserved upstream LICENSE file
carries both.

## sb3-creator — MPL-2.0

**Location in this repo:** `overlay/scratch-gui/src/lib/sb3-creator*.js`,
`overlay/scratch-gui/src/lib/cubeDirections.js` and
`overlay/scratch-gui/src/lib/ev3Dialect.js`

These 12 files are vendored from **sb3-creator** (the Code tab's pseudocode
compiler: Scratch blocks to/from C, Python, MicroPython, JavaScript, and
the runtime registries), relicensed to **MPL-2.0** as of commit `f72f1e7`.

- **Licence:** MPL-2.0
- **Upstream:** CrispStrobe/sb3-creator (private repository)
- **Licence file:** `overlay/scratch-gui/src/lib/sb3-creator-LICENSE`
- **Source availability:** the vendored files are readable JavaScript in this
  public repository and constitute the Corresponding Source Code for the
  purposes of MPL-2.0 §3.2(a).

### Licence boundary

Each of the 11 files named in the licence file remains licensed under MPL-2.0.
MPL-2.0 §3.3 ("Larger Work") permits distributing them alongside BSD-3-Clause
files. Modifications to any of those files must be made available under MPL-2.0.

## SmallerC — BSD-2-Clause (and ucpp, a BSD variant)

**Location in this repo:** `overlay/scratch-gui/src/lib/smallerc-wasm/dist/`

This directory contains SmallerC compiled to WebAssembly (Emscripten). It
turns C into NASM `bits 16` assembly text for the 8086 in the browser, with no
network and no installed toolchain. It is a separate program invoked at the
user's request — it is NOT linked into the BSD-3 editor code.

**Two works with two copyrights ship here, and both notices are discharged:**

- **SmallerC** — `smlrc.wasm` (the compiler) and `dist/headers.js` (six
  freestanding headers, copied verbatim from `v0100/include/`)
  - **Licence:** BSD-2-Clause
  - **Copyright:** © 2012–2021 Alexey Frunze
  - **Source:** https://github.com/alexfru/SmallerC
- **ucpp** — `smlrpp.wasm` (the preprocessor). ucpp merely *lives inside*
  SmallerC's source tree at `v0100/ucpp/`; it is its own work.
  - **Licence:** a three-condition BSD variant, recorded here as
    `BSD-3-Clause-ucpp`. Upstream numbers its conditions 1, 2 and 4, and its
    no-endorsement clause is worded differently from BSD-3-Clause, so the
    plain SPDX id would misstate it.
  - **Copyright:** © 1999–2002 Thomas Pornin

**Both full licence texts ship with the app**, in one file, reachable from the
About dialog with no network:
`overlay/scratch-gui/static/licenses/smallerc.BSD-2-Clause.txt`

- **Upstream commit:** `1865d79ce7a5ad3f8a9515a571437cee084b8b1d`
- **Build toolchain:** Emscripten 6.0.6 (no patches to SmallerC or ucpp source)
- **Components:** `smlrc.js`/`.wasm`, `smlrpp.js`/`.wasm`, `headers.js`
- **Build script:** `overlay/scratch-gui/src/lib/smallerc-wasm/build.sh`,
  provenance and measurements in the neighbouring `BUILD-INFO.md`

### Not shipped, deliberately

SmallerC's linker (`smlrl`), its driver (`smlrcc`), its standard library and
the hosted headers (`stdio.h`, `stdlib.h`, `string.h`, `math.h`) are NOT built
and NOT distributed. This path compiles to assembly text and stops; `smlrcc`
drives its stages with fork/exec, which WebAssembly has no equivalent of, so
the JavaScript in `compiler.js` is the driver.

### Licence boundary

Everything under `overlay/scratch-gui/src/lib/smallerc-wasm/dist/` is upstream
material under the two licences above. Both are permissive and impose no
copyleft, so — unlike SDCC — their presence raises no linking question; the
condition they do impose is attribution in binary form, which the shipped
licence file and the About dialog discharge. Everything else in this
repository is BSD-3-Clause (see LICENSE at the repo root).

## NQC (Not Quite C) — MPL-2.0

**Location in this repo:** `overlay/scratch-gui/src/lib/nqc-wasm/dist/`

This directory contains NQC compiled to WebAssembly (Emscripten). It turns NQC
source into an RCX bytecode image (`.rcx`) in the browser, with no network and
no installed toolchain, for the LEGO Mindstorms RCX. Like SmallerC, it is a
separate program invoked at the user's request — it is NOT linked into the
BSD-3 editor code, and nothing loads it until something compiles.

- **Licence:** MPL-2.0
- **Copyright:** portions (c) 1998-1999 David Baum; portions (c) 2005 John Hansen
- **Upstream:** https://github.com/jverne/nqc
- **Upstream commit:** `21c24ec1e520c736ce78e33e4c0dafca887fc2b7` (2022-09-10)
- **Build toolchain:** Emscripten 6.0.2 (no patches to NQC source; the build
  selects `RCX_USBTowerPipe_none` and `PSerial_none` instead, because this
  build compiles and does not drive hardware -- see below)
- **Licence file:** upstream's own `LICENSE.md` bytes, preserved as
  `overlay/scratch-gui/static/licenses/nqc.MPL-2.0.txt` and shipped as
  `static/licenses/nqc.MPL-2.0.txt`
- **Build script:** `overlay/scratch-gui/src/lib/nqc-wasm/build.sh`, with the
  provenance and measurements in the neighbouring `BUILD-INFO.md`
- **Source availability:** the upstream commit above, together with the build
  script, is the Corresponding Source for the purposes of MPL-2.0 SS 3.2(a).
  No NQC source file is modified.

### Why this one is vendored and SDCC is not

Both are compilers; only the licence differs, and that difference decides
everything. SDCC is GPL-2.0-or-later and this app is BSD-3-Clause, so SDCC is
fetched from its own origin on demand and `scripts/verify-no-gpl-in-build.mjs`
fails the build if a byte of it reappears. NQC is MPL-2.0, which SS 3.3
("Larger Work") expressly permits distributing alongside files under another
licence, so it ships. The practical consequence is the point: the RCX path
needs no service and works offline.

### Not shipped, deliberately

NQC's serial and USB tower transports are NOT built (`PSerial_none`,
`RCX_USBTowerPipe_none`). WebAssembly cannot open a serial port, and this
application drives the infrared link itself from
`overlay/scratch-gui/src/lib/rcx/rcx-protocol.js` over Web Serial or WebUSB.
So the vendored build compiles and stops; the downloading is ours.

NQC's output runs on LEGO's standard RCX firmware, which is proprietary and is
NOT distributed here in any form. See `docs/RCX-FIRMWARE.md`.

### Licence boundary

Everything under `overlay/scratch-gui/src/lib/nqc-wasm/dist/` is upstream
material under MPL-2.0 and remains so. MPL-2.0 is a file-level copyleft
licence: modifications to covered files must be made available under MPL-2.0,
and there are none. `compiler.js` in the parent directory is our own work --
it invokes the compiler, contains no NQC source, and is BSD-3-Clause with the
rest of this repository (see LICENSE at the repo root).

## SDCC (Small Device C Compiler) — GPL-2-or-later

**NOT IN THIS REPOSITORY, NOT IN THE BUILD, AND NOT IN THE PACKAGED APP.**

Both halves are now true, and they were not always. As of `dd603a5a4` no SDCC
byte is copied into `packages/scratch-gui/build`, so none reaches the `.app`
that `tauri.conf.json` assembles, and a CI guard fails the build if any
reappears. As of 2026-09-08 the **202 files** that remained in the source tree —
101 under the former SDCC `dist/` directory and 101 in its tracked
mirror — are removed from version control and gitignored, so a clone of this
repository receives no SDCC at all.

The removal waited for the fetch route to be proved in a browser rather than
argued: the opt-in run now records every toolchain request and asserts all nine
files came from the GPL origin (`9/9 from https://crispstrobe.github.io/sdcc-wasm/`).
The Node gates that read that directory have CI fetch it, and skip BY NAME when
that fetch is unavailable — a missing download is not a broken compiler.

**The GPL home of these binaries:** https://github.com/CrispStrobe/sdcc-wasm —
the COPYING text, the written offer of corresponding source, the build
provenance and the SHA-256 of each binary live there with the binaries they
describe. The artifacts are served from
`https://crispstrobe.github.io/sdcc-wasm/static/sdcc-wasm/<file>`; the site root
and `COPYING` serve too. (For a few hours on 2026-09-07 the root returned 404
while only the artifact paths served, which mattered because the GPL-2 section 3
offer points a human at that page — lego-b9 caught it and it is fixed. Prefer
the GitHub URL anyway: it is where the offer can be acted on, since the offer
says to open an issue there.)

**What changed, and why (2026-09-07).** `webpack.config.js` copied these
binaries into `static/sdcc-wasm/` in the build output. `apps/tauri/src-tauri/tauri.conf.json` bundles that build
directory wholesale, so the shipping Mac build carried **101 GPL files, 8.7 MB**,
inside a BSD-3-Clause application — measured in CI's own build artifact on
2026-09-07, four weeks after they were added in `305893119`. The copy rule is
gone, `scripts/verify-no-gpl-in-build.mjs` fails the build if any GPL payload
reappears in the output, and a CI step runs it against the real build.

SDCC 4.5.0, compiled to WebAssembly (Emscripten), is distributed under
**GPL-2.0-or-later**. It is a separate program invoked at the user's request to
compile C source to Intel HEX for the 8051/mcs51 target — it is NOT linked into
the BSD-3 editor code, and it is no longer distributed with it.

**How it reaches a user.** The default is `online`: nothing is downloaded
and the hosted compiler serves the request, as it already does for every target
this bundle cannot link. A user who wants offline compiling opts in, and the
toolchain is then fetched from the GPL origin above and kept in Cache Storage on
their own device. Web and native builds allow that separate, user-initiated GPL
download by default. A distribution built with `BW_REMOTE_CODE_POLICY=deny`
refuses it at both the routing predicate and downloader. See
`overlay/scratch-gui/src/lib/sdcc-wasm/toolchain-source.js`.

- **Version:** 4.5.0 (mcs51 port only)
- **Licence:** GPL-2.0-or-later
- **Source:** https://sourceforge.net/projects/sdcc/files/sdcc/4.5.0/sdcc-src-4.5.0.tar.bz2/download
- **Source SHA-256:** `d5030437fb436bb1d93a8dbdbfb46baaa60613318f4fb3f5871d72815d1eed80`
- **Build toolchain:** Emscripten 3.1.61 (no patches to SDCC source)
- **Components:** sdcc.js/wasm, sdas8051.js/wasm, sdld.js/wasm, include/mcs51/*.h

### Compiled output and headers

Each header in `include/mcs51/` carries the GPL-2+ licence **plus an explicit
linking exception**. The exception text appears in every header file (verified
in `stc12.h` lines 22-27, `8051.h` and others):

> "As a special exception, if you link this library with other files, some of
> which are compiled with SDCC, to produce an executable, this library does not
> by itself cause the resulting executable to be covered by the GNU General
> Public License. This exception does not however invalidate any other reasons
> why the executable file might be covered by the GNU General Public License."

**Source citation:** `include/mcs51/stc12.h` lines 22-27, in the GPL
distribution at https://crispstrobe.github.io/sdcc-wasm/static/sdcc-wasm/include/mcs51/stc12.h

Note what this exception does and does not do: it covers the OUTPUT a user
compiles, not redistribution of the compiler. It was never a licence to ship
these binaries inside a BSD-3 app, and it is not the reason the arrangement
above is correct — separation is.

This means a user's compiled `.hex` output does NOT carry GPL obligations.
The compiler itself (sdcc, sdas8051, sdld) is GPL-2+, but the exception
covers the headers and runtime libraries that user code links against.

### Licence boundary

Two different statements, because they have different dates.

**The shipped artifact:** no GPL byte is copied into the build output or into
the packaged application as of `dd603a5a4`, and
`scripts/verify-no-gpl-in-build.mjs` fails the build if any reappears.

**The source tree:** as of 2026-09-08 it carries no SDCC at all. The 202 files
that used to sit under the former SDCC `dist/` directory and its
tracked mirror are removed from version control and gitignored, so a clone
receives none of them. **Everything** in this repository is BSD-3-Clause (see
`LICENSE` at the root).

**Why this is a separate work, not a repackaging.** The compiler lives in a
different repository, under its own licence, with its own written offer of
source, and is fetched only when a user explicitly opts into offline compiling.
It runs as a separate program — its own WebAssembly modules, invoked with
arguments and files — and nothing in this application links against it or
includes its code. This application ships complete and works without it: the
default route is the hosted compiler. Both repositories happen to have the same
owner, which changes none of the above; the question the GPL asks is whether the
works are combined and conveyed as one, and here they are neither.

SDCC is the only GPL component. Every other third party named in this file is
permissive or public domain — checked heading by heading on 2026-09-07.

*(Licence-boundary wording and the 101 + 101 count: lego-b9, reviewing this
section rather than landing a competing rewrite of it.)*

## CodeMirror 6 — MIT

**CodeMirror** (MIT License, https://codemirror.net/) provides the Code tab's
source editor. The following packages are used (all MIT, all by Marijn
Haverbeke and contributors):

- codemirror (meta-package) — https://github.com/codemirror/dev
- @codemirror/view — editor view layer
- @codemirror/state — editor state
- @codemirror/language — language support infrastructure + StreamLanguage
- @codemirror/commands — keybindings (indent, undo, etc.)
- @codemirror/search — search/replace panel
- @codemirror/autocomplete — bracket closing
- @codemirror/lang-cpp — C/C++ language mode
- @codemirror/lang-python — Python language mode
- @codemirror/lang-javascript — JavaScript language mode
- @codemirror/theme-one-dark — dark theme

- **Licence:** MIT
- **Source:** https://github.com/codemirror/dev
- **Usage:** lazy-loaded chunk for the Code tab editor. No source code is
  modified; all packages are consumed as published npm dependencies.

## micropython-microbit-v2-simulator — MIT

**micropython-microbit-v2-simulator** (MIT License,
https://github.com/microbit-foundation/micropython-microbit-v2-simulator)
provides a client-side micro:bit v2 MicroPython simulator compiled to WASM.
Self-hosted under `static/microbit-sim/` (built from source with emscripten).

- **Licence:** MIT
- **Source:** https://github.com/microbit-foundation/micropython-microbit-v2-simulator
- **Author:** Micro:bit Educational Foundation
- **Usage:** The simulator runs MicroPython programs on a virtual micro:bit
  board (5x5 LED display, buttons, pins, accelerometer, radio) entirely
  client-side. Loaded in an iframe from the Code tab when the micro:bit
  device is selected. The built assets (firmware.js, firmware.wasm,
  simulator.js) are vendored; the source repo provides the build recipe.


## avr8js — MIT

**avr8js** (MIT License, https://github.com/wokwi/avr8js) provides
instruction-level ATmega328P emulation (Arduino Uno/Nano) for the
circuit simulator. Imported as `avr8js` via the bw-board adapter
(`bw-board/avr8js-adapter.js` in the installed package).

- **Version:** 0.21.1-bw.1 (upstream 0.21.1 plus one fix, below)
- **Licence:** MIT — Copyright (c) 2019-2025 Uri Shaked
- **Source:** https://github.com/CrispStrobe/avr8js at
  `feea84c43e36e578841b5fce640202823b69b7f7`, a fork of
  https://github.com/wokwi/avr8js; bw-board depends on it by git commit.
- **Modified:** the ATtiny25/45/85 Timer/Counter1 PWM mode counts
  single-slope (0..OCR1C, restart at $00) instead of up and down, latches
  OCR1A/OCR1B at OCR1C and drives the inverted ~OC1A/~OC1B outputs
  (datasheet 2586Q, section 12.2.2). The fork's FORK.md lists the changes;
  its built `dist/` is committed.
- **Usage:** AVR CPU simulation, I/O port + timer + ADC peripherals.

## digitaljs — BSD-2-Clause (HEADLESS CORE ONLY)

**digitaljs** (BSD-2-Clause, https://github.com/tilk/digitaljs) provides the
gate-level simulation behind the FPGA tier: a synthesised netlist evaluated gate
by gate, whose output ports drive real terminals on the circuit surface.

- **Version:** 0.14.2 (pinned exactly, not a range — see below)
- **Licence:** BSD-2-Clause — Copyright (c) Marek Materzok
- **Source:** https://github.com/tilk/digitaljs
- **Usage:** `HeadlessCircuit` only, reached through a webpack alias to
  `digitaljs/lib/circuit.js`.

**WHAT WE DO NOT TAKE, AND WHY IT MATTERS.** digitaljs's own `browser` export
condition is the full visual editor. That entry pulls **jquery-ui** and
**elkjs**, and elkjs is **EPL-2.0** — which is not in the licence set this
product ships. The headless core reaches neither. The alias is therefore a
licence boundary rather than an optimisation, and
`test/fpga-third-party-surface.test.mjs` fails if it is removed or if any source
imports the full entry.

What the headless core does reach, and what therefore ships when the FPGA
surface is enabled:

| package | licence |
|---|---|
| `@joint/core` 4.1.3 | MPL-2.0 |
| `3vl` 1.0.1 | BSD-2-Clause |
| `jquery` 3.7.1 | MIT |

The pin is EXACT because both the licence position and the module resolution are
version-specific facts, verified rather than assumed. A range could move onto a
version where the subpath or its tree differs and leave this notice silently
stale.

No digitaljs source is modified; the package is consumed as a published npm
dependency.

## yosys2digitaljs — BSD-2-Clause (`core` SUBPATH ONLY)

**yosys2digitaljs** (BSD-2-Clause, https://github.com/tilk/yosys2digitaljs)
converts a Yosys JSON netlist into the format digitaljs simulates.

- **Version:** 0.10.3 (pinned exactly)
- **Licence:** BSD-2-Clause — Copyright (c) Marek Materzok
- **Source:** https://github.com/tilk/yosys2digitaljs
- **Usage:** the `core` subpath only — pure JSON-to-JSON conversion.

**WHAT WE DO NOT TAKE.** Its `node` subpath shells out to a local Yosys and
pulls temp-file dependencies, one of which (`truncate-utf8-bytes`, via
`sanitize-filename`) is **WTFPL-only**. The `core` subpath requires exactly:

| package | licence |
|---|---|
| `3vl` 1.0.1 | BSD-2-Clause |
| `big-integer` 1.6.52 | Unlicense (public-domain dedication) |
| `hashmap` 2.4.0 | MIT |

That set is asserted by a test, so a future version adding a dependency to the
core path goes red before this notice goes stale.

No yosys2digitaljs source is modified; the package is consumed as a published
npm dependency.

## React Flow (@xyflow/react) — MIT

**React Flow** (MIT, https://reactflow.dev, https://github.com/xyflow/xyflow),
Copyright (c) xyflow GmbH, provides the interactive node/wire CANVAS for the FPGA
gate builder — drag, pan, zoom, a minimap, and connectable handles. It is a UI
library only; the design that synthesises stays this project's own model (a pure,
tested bridge translates React Flow state, and our own generator emits the
Verilog — xyflow does not).

- **Package:** `@xyflow/react` (scope `xyflow`)
- **Licence:** MIT — Copyright (c) xyflow GmbH
- **Source:** https://github.com/xyflow/xyflow
- **Usage:** lazy-imported and behind the FPGA build flag, so it is in the FPGA
  chunk only. Its stylesheet is injected GLOBALLY via an inline-loader import,
  because scratch-webpack-configuration hashes every `.css` and React Flow's own
  global classes must survive.

## xterm.js (@xterm/xterm) — MIT

**xterm.js** (MIT, https://xtermjs.org, https://github.com/xtermjs/xterm.js)
is the terminal emulator in the Linux-on-RISC-V lesson: it draws what the
guest's serial console sends (cursor movement, erase, colours, scrolling), so
busybox `vi`, `top`, `less` and ash's line editing display as on a real
terminal. The keyboard-to-bytes table the guest receives is this project's own
(`lib/bw-debug/terminal-keys.js`); xterm.js supplies the screen, text input
composition and paste.

- **Package:** `@xterm/xterm` 6.0.0 (exact pin, no dependencies)
- **Licence:** MIT — Copyright (c) 2017-2019, The xterm.js authors;
  Copyright (c) 2014-2016, SourceLair Private Company; Copyright (c)
  2012-2013, Christopher Jeffrey
- **Source:** https://github.com/xtermjs/xterm.js
- **Usage:** lazy-imported in its own chunk (`bw-xterm`), loaded only when a
  booted Linux shows its terminal. Its stylesheet is injected GLOBALLY via an
  inline-loader import (`!!raw-loader!`), because scratch-webpack-configuration
  hashes every `.css` and xterm's class names are global. No source is modified.

## three.js (three) — MIT

**three.js** (MIT, https://threejs.org, https://github.com/mrdoob/three.js)
draws the SPIKE arena's 3D view: the mat (textured with the 2D view's own
drawing), walls, crates and the rover, from the same simulation snapshot the
2D canvas draws. The scene graph is this project's own
(`lib/spike-arena/arena-scene3d.js`); three.js supplies the renderer, the
geometry and materials, and the orbit camera control (`OrbitControls`, from
the same package's `examples/jsm`, same licence).

- **Package:** `three` 0.186.1 (exact pin, no dependencies)
- **Licence:** MIT — Copyright © 2010-2026 three.js authors
- **Source:** https://github.com/mrdoob/three.js
- **Usage:** lazy-imported in its own chunk (`bw-arena-3d`), loaded only when
  the arena's 3D view is opened. No source is modified.

## Jolt Physics (jolt-physics) — MIT

**Jolt Physics** (MIT, https://github.com/jrouwe/JoltPhysics) compiled to
WebAssembly by its author's official binding **JoltPhysics.js**
(https://github.com/jrouwe/JoltPhysics.js) is the Sim Lab's rigid-body
engine: it steps a compiled LEGO Technic mechanism (rigid islands, hinges,
motorised hinges and gear constraints) so that a program's motor commands
move a simulated model. The mechanism compiler and the data it consumes are
this project's own (`lib/bw-sim/`, docs/SIM-LAB-PLAN.md); Jolt supplies the
solver.

- **Package:** `jolt-physics` 1.1.0-bw.11 (exact pin, no dependencies).
  The release inherits the scalar, debug, and multithread binaries from
  bw.10. The single-thread SIMD build adds conservative pruning for compound
  sweeps against boxes and convex hulls. The native fork also provides
  gear and rack constraints, the part-pair filter, and rotor support.
  [Package release](https://github.com/CrispStrobe/JoltPhysics.js/releases/tag/bw.11-qualified-20261127)
  [Native SIMD source](https://github.com/CrispStrobe/JoltPhysics/commit/7085d0d)
- **Licence:** MIT — Copyright (c) 2022-2024 Jorrit Rouwe (Jolt Physics and
  JoltPhysics.js). The WebAssembly glue is generated by Emscripten (MIT /
  University of Illinois/NCSA dual licence, runtime support code).
- **Source:** https://github.com/jrouwe/JoltPhysics.js (upstream);
  modified sources: the Brickwright wrapper and native forks (MIT, `LICENSE` unchanged,
  the added files carry the upstream SPDX header).
- **Usage:** loaded on demand by the Robot Lab physics core and by the shared
  CAD simulation SDK.

## LDraw Parts Library — CC BY 4.0 (some files dual CC BY 2.0 / CC BY 4.0)

The Sim Lab's part geometry is a curated subset of the official **LDraw Parts
Library** (https://library.ldraw.org), copied unmodified into
`overlay/scratch-gui/static/ldraw/` by `scripts/sync-ldraw-parts.mjs`: the
parts listed in `overlay/scratch-gui/src/lib/bw-sim/part-meta/parts.json`, every
sub-file and primitive they reference, and `LDConfig.ldr`.

- **Holder / credit:** The LDraw Parts Library, © LDraw.org and the individual
  part authors named in each file's `0 Author:` line (LDraw.org accepts this
  collective credit in place of a list of every author).
- **Licence:** each file states its own in its `0 !LICENSE` line — CC BY 4.0
  (https://creativecommons.org/licenses/by/4.0/), or dual CC BY 2.0
  (https://creativecommons.org/licenses/by/2.0/) and CC BY 4.0. Both are
  attribution-only. `static/ldraw/ldraw-lock.json` records every file's
  licence line, author, release and sha256; the sync refuses any other
  licence line and any unofficial part. `CAreadme.txt`, `CAlicense.txt` and
  `CAlicense4.txt` ship beside the parts.
- **Modifications:** none — the files are byte-identical to the release named
  in the lock (`complete.zip` of 2026-09-30).
- **Not affiliated:** LDraw is an independent community project. LEGO® is a
  trademark of the LEGO Group, which does not sponsor, authorize or endorse
  this project.
- **Our own data is not LDraw's:** the connector, collider and gear metadata
  in `parts.json` is this project's, authored by measuring the LDraw geometry
  (never copied from BrickLink Studio, LDCad or another connectivity
  database), and is BSD-3-Clause like the rest of the repository.
- **Parts from the whole catalogue (Robot Lab palette "+"):** where the build
  allows it (`BW_REMOTE_PARTS_POLICY`, default `allow`), a learner can add any
  other part of the library at run time. Those files are not in the repository
  or the app bundle: the app fetches them, unmodified, from the ldraw-stl mirror
  (https://crispstrobe.github.io/ldraw-stl/library/, built from the same official
  `complete.zip` by https://github.com/CrispStrobe/ldraw-stl; it mirrors only the
  CC BY files, with `CAreadme.txt`, `CAlicense.txt` and `CAlicense4.txt`, and
  states the source release and its sha256 in `manifest.json`). They are kept on
  the learner's device. The app renders them and saves models as references to
  them; the metadata it derives from them (connectors, colliders, mass; or a
  "decoration" without connectors) is this project's, made by
  `bw-sim/part-meta/derive.js` like the derived entries in `parts.json`. The
  palette's catalogue view names each added part's files with their author,
  licence line and source URL.

## rp2040js — MIT

**rp2040js** (MIT License, https://github.com/wokwi/rp2040js) provides the
Cortex-M0+ core used by the Raspberry Pi Pico target AND — through the
STM32F030 adapter's facade — by the LIGHT simulation tier for STM32. The
heavy tier for the same chip is labwired-core; both run the same flash
image, which is the point of having two.

- **Version:** 1.3.3
- **Licence:** MIT — Copyright (c) 2021 Uri Shaked
- **Source:** https://github.com/wokwi/rp2040js
- **Usage:** ARM Cortex-M0+ instruction execution and the RP2040 memory map.
  Consumed as a published npm dependency, unmodified. The STM32 side supplies
  its own peripherals (`cortex-m0-machine.js`, `stm32f0-board.js`) rather than
  patching rp2040js.

## wokwi-elements — MIT

**wokwi-elements** (MIT License, https://github.com/wokwi/wokwi-elements)
provides the web-component renderings of electronic parts (LED, resistor,
buzzer, etc.) used in the circuit designer. The elements are imported as
`@wokwi/elements` via `bw-circuit-ui/src/wokwi-wrappers/` in the installed package.

- **Licence:** MIT — Copyright (c) 2020-2025 Uri Shaked
- **Source:** https://github.com/wokwi/wokwi-elements
- **Usage:** runtime web components for part visualisation in the circuit
  designer canvas. No source code from wokwi-elements is modified; the
  components are consumed as published npm packages.

## jszip — MIT (dual-licensed MIT or GPL-3.0-or-later; taken under MIT)

**JSZip** (https://stuk.github.io/jszip/) reads and writes the `.sb3` project archives.
Copyright (c) 2009-2016 Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso.

- **Version:** 3.10.1 (`packages/scratch-gui/package.json`, added by `scripts/integrate.mjs`)
- **Licence:** MIT (JSZip is dual-licensed MIT or GPL-3.0-or-later; this repo takes it under MIT)
- **Source:** https://github.com/Stuk/jszip
- **Usage:** in the bundle — project save/load and the project-bundle archive.

## skulpt — MIT

**Skulpt** (https://skulpt.org/) runs the Code tab's Python programs in the browser.
Copyright (c) 2009-2010 Scott Graham; Copyright (c) 2010-2013 Brad Miller and the Skulpt
contributors.

- **Version:** 1.2.0 (added by `scripts/integrate.mjs`)
- **Licence:** MIT
- **Source:** https://github.com/skulpt/skulpt
- **Usage:** lazy-loaded for the Code tab's Run.

## lit and @lit/react — BSD-3-Clause

**Lit** (https://lit.dev/) is the web-component runtime the wokwi-elements parts render with;
**@lit/react** wraps them for React. Copyright (c) 2017-2025 Google LLC.

- **Versions:** lit 3.3.3, @lit/react 1.0.8 (added by `scripts/integrate.mjs`)
- **Licence:** BSD-3-Clause — the copyright notice, conditions and disclaimer are reproduced
  by the packages' own LICENSE files, shipped in the bundle's source map and named here.
- **Source:** https://github.com/lit/lit
- **Usage:** circuit part visualisation (the wokwi-elements host).

## emu8051 — MIT

**emu8051** (https://github.com/jarikomppa/emu8051) is the 8051 core behind the STC12
simulation, compiled to WebAssembly. Copyright (c) 2006 Jari Komppa. The STC12 model
layered on it is (c) CrispStrobe (CrispStrobe/emu8051-stc); the binary also carries
Emscripten's runtime glue (MIT / University of Illinois).

- **Location in this repo:** `overlay/scratch-gui/src/lib/emu8051/` (`emu8051.js`, `emu8051.wasm`),
  synced by `scripts/sync-emu8051-wasm.mjs` with a per-file SHA-256 check against the
  upstream BUILD-INFO.
- **Licence:** MIT
- **Usage:** the 8051 debugger and the offline STC12 compile-and-run path.

## MicroPython for RP2040 (Raspberry Pi Pico firmware) — MIT

**MicroPython** (https://micropython.org/) — the RP2040 port's UF2 firmware — boots the
simulated Pico's Python programs. Copyright (c) 2013-2025 Damien P. George and
MicroPython contributors.

- **What ships:** the versioned UF2 named in the installed `bw-board/rp2040-bootrom.js`,
  fetched at build time by `scripts/sync-pico-micropython.mjs`, verified against its
  SHA-256, written under `packages/scratch-gui/static/pico-micropython/` (gitignored) and
  copied into the app by webpack — so it is served, never committed.
- **Licence:** MIT
- **Source:** https://github.com/micropython/micropython
- **Usage:** the Pico ▶ Run simulator (plan N3c).

## Microsoft MakeCode (pxt-core, pxt-microbit, pxt-arcade, pxt-calliope, pxt-ev3, pxt-adafruit) — MIT

**Microsoft MakeCode** — its compiler (`pxt-core`), the micro:bit target
(`pxt-microbit`) and the Arcade target (`pxt-arcade`) — compiles imported and
exported MakeCode projects and runs them in MakeCode's own simulators, with no
makecode.com. Copyright (c) Microsoft Corporation. All rights reserved.

- **What ships:** from the pinned npm tarballs pxt-microbit 9.1.1, pxt-arcade 4.2.1,
  pxt-calliope 3.0.30 (Calliope mini; Calliope gGmbH, MIT), pxt-ev3 1.4.41 (LEGO
  MINDSTORMS EV3), pxt-adafruit 1.6.8 (Circuit Playground Express), and the pxt-core
  each was built against (13.0.1, 13.2.1, 6.0.23, 9.3.19, 6.2.6), fetched at build time by
  `scripts/sync-makecode-runtime.mjs` and verified against their SHA-256 before
  anything is extracted: each target's `target.json`, the compiler worker
  `pxtworker.js`, the simulator (`pxtsim.js`, `sim.js`, pxt-microbit's
  `sim/public/`), pxt-microbit's and pxt-calliope's precompiled firmware bases
  (`built/hexcache/`), and — for EV3 and Circuit Playground Express, whose npm
  packages ship none — the two firmware bases MakeCode's own CDN serves for their
  default package sets (`cdn.makecode.com/compile/<sha>.hex`, content-addressed by
  the package set, pinned here by sha256; the request names no user program).
  From the same CDN, the two micro:bit bases for the {core, radio} package set,
  which pxt-microbit's hexcache lacks: the V1 {core, radio} base (f7b3cfda…, DAL on
  nRF51822, with Nordic's S110 v8 SoftDevice) and the V2 {core, radio} base
  (137d8c97…, CODAL on nRF52833, with Nordic's S113 SoftDevice) — Microsoft's own
  cloud builds, the halves of the universal .hex a {core, radio} project downloads
  as. Their MBR and SoftDevice regions are byte-identical to the npm bases', and
  the Nordic terms below apply to them as to those. Written under `packages/scratch-gui/static/makecode/`
  (gitignored) with each package's own LICENSE file beside it, and copied into the
  app by webpack — served, never committed. The Arcade simulator page
  (`scripts/makecode/arcade-simulator.html`) is ours: pxt-arcade ships none.
- **Licence:** MIT
- **Source:** https://github.com/microsoft/pxt, https://github.com/microsoft/pxt-microbit,
  https://github.com/microsoft/pxt-arcade
- **Usage:** `lib/bw-makecode/pxt-runtime.js` — MakeCode projects compiled and
  simulated as MakeCode wrote them, and real micro:bit firmware (.hex) built in the
  browser, shipped unmodified, as pxt-microbit ships it.
- **The micro:bit firmware bases are NOT all MIT.** The CODAL / DAL runtime in
  them is MIT (Lancaster University / Micro:bit Educational Foundation), but each
  is a Bluetooth-enabled build that also carries **Nordic Semiconductor's
  SoftDevice, MBR and bootloader** as binaries: the V2 bases the **S113
  SoftDevice** (0x1000-0x1B3FF), the MBR (0x0-0xAFF) and a bootloader
  (0x77000); the V1 bases, and the Calliope mini bases (nRF51822), the **S110 v8 SoftDevice** (0x1000-0x16917), the MBR
  (0x0-0x7BF) and a bootloader (0x3C000). Their terms:
  - S113 / MBR / bootloader (V2), under the nRF5 SDK licence, Copyright (c)
    Nordic Semiconductor ASA: "2. Redistributions in binary form, except as
    embedded into a Nordic Semiconductor ASA integrated circuit in a product or
    a software update for such product, must reproduce the above copyright
    notice, this list of conditions and the following disclaimer in the
    documentation and/or other materials provided with the distribution. …
    4. This software, with or without modification, must only be used with a
    Nordic Semiconductor ASA integrated circuit. 5. Any software provided in
    binary form under this license must not be reverse engineered, decompiled,
    modified and/or disassembled."
  - S110 v8 (V1), under the S110 SoftDevice Licence Agreement, Copyright (c)
    Nordic Semiconductor ASA: a licence "(a) to use the SoftDevice solely in
    connection with a Nordic integrated circuit, and (b) to distribute the
    SoftDevice solely as integrated in Licensee Product", and "Licensee shall
    not, modify, reverse engineer, disassemble, decompile or otherwise attempt
    to discover the source code of any non-source code parts of the SoftDevice".
  These bases are served for ONE use, the one those terms allow: a .hex
  downloaded to and run on a micro:bit (a Nordic chip). lite's emulator never
  runs them: `lib/bw-makecode/base-licences.js` classifies every base by the
  sha256 of its bytes and refuses a chip-restricted one by name
  (CHIP_RESTRICTED_BASE); the emulator links onto the Bluetooth-free bases below.
  "LEGO" and "MINDSTORMS" are trademarks of the LEGO Group, "Calliope" of
  Calliope gGmbH, "Circuit Playground" of Adafruit Industries — named here only to
  say which board a file is for.
- "Microsoft" and "MakeCode" are trademarks of Microsoft Corporation, used here only
  to say whose files these are; this project is not affiliated with or endorsed by
  Microsoft.

### MakeCode Arcade runtime code and data (generated from the pinned bundle) — MIT, SIL OFL 1.1

Lite's Arcade runtime (the `arcade` VM extension and the Arcade importer, task
E1) runs imported games with MakeCode's own algorithms and artwork rather than
re-implementations. Generated from the pinned pxt-arcade 4.2.1 bundle above
(`packages/scratch-gui/static/makecode/arcade/`) and committed, so they are
compiled into the app; each generator has a `--check` mode that fails when the
committed file differs from the pinned bundle:

- **pxt-core13.2.1** (https://github.com/microsoft/pxt/tree/v13.2.1/pxtsim),
  MIT, Copyright (c) Microsoft Corporation: the complete simulator buffer
  algorithms, extracted without algorithm changes and formatted, in
  `overlay/scratch-vm/src/extensions/crispstrobe/arcade/buffer-pxt.js`
  (`scripts/generate-arcade-buffers.mjs`). The host supplies cast/error and UTF8
  decoding boundaries; `buffer.js` bounds allocation and preserves mutable byte
  storage for the mixer. Full notice: `static/licenses/pxt-core.MIT.txt`.
- **pxt-common-packages** (https://github.com/microsoft/pxt-common-packages),
  MIT, Copyright (c) Microsoft Corporation: the original simulator FNV-1 and
  k-bit Buffer hash functions from `sim/common-sim.js`, retained unadapted in
  `overlay/scratch-vm/src/extensions/crispstrobe/arcade/buffer-hash-pxt.js`
  (`scripts/generate-arcade-buffers.mjs`); the simulator's image algorithms
  (`sim/common-sim.js`: setPixel, fillRect, drawLine, drawImage, overlapsWith, ...)
  in `overlay/scratch-vm/src/extensions/crispstrobe/arcade/image-pxt.js`
  (`scripts/generate-arcade-image-operations.mjs`); text layout and speech bubbles
  (`game/renderText.ts`, `game/spritesay.ts`, transpiled) in `speech-pxt.js`, and the
  rotated sprite geometry (`game/rotation.ts`, transpiled) in
  `overlay/scratch-vm/src/extensions/crispstrobe/arcade/rotation-pxt.js`, and the
  6x8 `font8` (`screen/text.ts`) in `speech-fonts.json`
  (`scripts/generate-arcade-speech.mjs`); and the fixed-point helpers, random
  generator, image effects and particle sources, factories and effects
  (`base/fixed.ts`, `game/mathUtil.ts`, `game/effects.ts`, `game/particles.ts`,
  `game/particlefactories.ts`, `game/particleeffects.ts`, transpiled) in
  `overlay/scratch-vm/src/extensions/crispstrobe/arcade/particles-pxt.js`
  (`scripts/generate-arcade-particles.mjs`); and image text printing with `font5`
  (`screen/text.ts`, transpiled) and the simulator's `drawIcon` in
  `overlay/scratch-vm/src/extensions/crispstrobe/arcade/text-pxt.js`
  (`scripts/generate-arcade-text.mjs`); and the mixer music (`mixer/music.ts`,
  `mixer/melody.ts`, `mixer/playable.ts`, `mixer/legacy.ts`, `mixer/soundEffect.ts`,
  transpiled with pausing calls lowered to generators) in
  `overlay/scratch-vm/src/extensions/crispstrobe/arcade/music-pxt.js`
  (`scripts/generate-arcade-music.mjs`); and `parseInt` with `helpers.isWhitespace`
  (`base/pxt-helpers.ts`, transpiled) in
  `overlay/scratch-vm/src/extensions/crispstrobe/arcade/helpers-pxt.js`
  (`scripts/generate-arcade-helpers.mjs`); and the dialogs with the game-over
  dialog (`game/textDialogs.ts`) and game-over configuration (`game/game.ts`,
  `GameOverConfig`), transpiled, in
  `overlay/scratch-vm/src/extensions/crispstrobe/arcade/gameover-pxt.js`
  (`scripts/generate-arcade-gameover.mjs`).
- **pxt-arcade** (https://github.com/microsoft/pxt-arcade) 4.2.1, MIT, Copyright (c)
  Microsoft Corporation: the 763 built-in images (`sprites.castle.tileGrass1`, ...;
  `device/*.jres`) in `overlay/scratch-gui/src/lib/bw-makecode/arcade-builtin-images.js`
  (`scripts/generate-arcade-builtin-images.mjs`), and the seven segment extension
  (`libs/sevenseg/sevenseg.ts`, transpiled) in
  `overlay/scratch-vm/src/extensions/crispstrobe/arcade/sevenseg-pxt.js`
  (`scripts/generate-arcade-sevenseg.mjs`), and the darts and corgio extensions
  (`libs/darts/darts.ts`, `libs/corgio/corgio.ts`, transpiled) in
  `overlay/scratch-vm/src/extensions/crispstrobe/arcade/sprite-extensions-pxt.js`
  (`scripts/generate-arcade-sprite-extensions.mjs`).
- **font12** of pxt-common-packages (`screen/font12.jres`), a 12x12 pixel font based on
  **Adobe Source Han Sans** v2.001R (https://github.com/adobe-fonts/source-han-sans),
  in `speech-fonts.json` and `text-pxt.js`: SIL Open Font License 1.1, Copyright 2014-2019 Adobe
  (http://www.adobe.com/), with Reserved Font Name 'Source' — the notice
  pxt-common-packages' ThirdPartyNotice records for that version. "Source" is a
  trademark of Adobe in the United States and/or other countries.

Sprite following in `overlay/scratch-vm/src/extensions/crispstrobe/arcade/index.js`
manually adapts the `follow`/`unfollow` steering and lifecycle logic from
`pxt-common-packages`' bundled `game/sprite.ts` (MIT, Copyright (c) Microsoft
Corporation). Tests execute the original method against controlled times and
compare collision-aware snapping with the original Arcade simulator. The
existing MIT notice below covers this adapted runtime code as well.

Full texts: `overlay/scratch-gui/static/licenses/pxt-common-packages.MIT.txt` (both MIT
sources) and `overlay/scratch-gui/static/licenses/pxt-speech-font12.OFL.txt`, shipped
with the app and reachable from the About dialog offline.

### MakeCode extensions (vendored source) — MIT

Fourteen third-party MakeCode extensions ("packages") that MakeCode's own micro:bit
documentation projects, the surveyed Arcade programs and the approved-extension list depend on, vendored as SOURCE so a project naming one
compiles and simulates offline: `scripts/sync-makecode-extensions.mjs` fetches each
at an exact commit, checks every file against the git blob sha in that commit's
tree and the LICENSE against the pin (anything not redistributable is refused by
name), and writes them to `overlay/scratch-gui/src/lib/bw-makecode/extensions-vendored.js`,
compiled into the bundle. `lib/bw-makecode/pxt-runtime.js` hands them to MakeCode's
compiler when a project's pxt.json names them. Unmodified:

- **pxt-microturtle** v0.0.9 — `microsoft/pxt-microturtle` at
  `b8a0289980fcaff3b5e7ea6560b85b24f2b1492e`. MIT, Copyright (c) Microsoft Corporation.
- **pxt-radio-blockchain** v0.1.4 — `microsoft/pxt-radio-blockchain` at
  `fec2d45d8b514aff2c9c398a3e41711ecdca4e21`. MIT, Copyright (c) Microsoft Corporation.
- **pxt-kitronik-motor-driver** v0.0.3 — `KitronikLtd/pxt-kitronik-motor-driver` at
  `be38482e6a7a97dae80ef51b8b7e98767900dc00`. MIT, Copyright (c) 2017 Kitronik Ltd.
- **arcade-background-scroll** (scroller) v0.1.2 — `microsoft/arcade-background-scroll` at
  `941e0a3afee4cd4097c1f9853a9ee7299622c7e5`, for Arcade projects. MIT, Copyright (c)
  Microsoft Corporation. Its `main.ts` is also transpiled unchanged into
  `overlay/scratch-vm/src/extensions/crispstrobe/arcade/scroller-pxt.js`
  (`scripts/generate-arcade-scroller.mjs`) for converted Arcade projects.
- **arcade-character-animations** (characterAnimations) v0.1.0 — `microsoft/arcade-character-animations` at
  `7b40150c721eef4e11ef0aff247deedc266d292e`, for Arcade projects. MIT, Copyright (c)
  Microsoft Corporation. Its `main.ts` is also transpiled unchanged into
  `overlay/scratch-vm/src/extensions/crispstrobe/arcade/character-animations-pxt.js`
  (`scripts/generate-arcade-character-animations.mjs`) for converted Arcade projects.
- **pxt-ws2812b** v0.1.1 — `microsoft/pxt-ws2812b` at
  `725d33a65345c50c54240eb09b91f5ecc2805af8`. MIT, Copyright (c) Microsoft Corporation. Vendored for: dependency of pxt-neopixel.
- **pxt-neopixel** v0.7.6 — `microsoft/pxt-neopixel` at
  `9ef28dd8ec9e72548391746025a2c252fc8f9998`. MIT, Copyright (c) Microsoft Corporation. Vendored for: MakeCode approved list, preferred (Lights and Display); namespace neopixel.
- **pxt-sonar** v0.0.6 — `microsoft/pxt-sonar` at
  `d72f6d0733c1903b7097e055d6a12d32105365bb`. MIT, Copyright (c) Microsoft Corporation. Vendored for: MakeCode approved list, preferred (Science); namespace sonar.
- **pxt-status-bar** v0.4.1 — `jwunderl/pxt-status-bar` at
  `efcd376357ae7215e65616a11283e03bceaa7fa2`, for Arcade projects. MIT, Copyright (c) 2020 Joey Wunderlich. Vendored for: dependency of arcade-carnival.
- **arcade-text** v1.3.0 — `microsoft/arcade-text` at
  `fa2439314c6633943666a763fdae32a5c67a9ae8`, for Arcade projects. MIT, Copyright (c)
  Microsoft Corporation. Vendored for: dependency of arcade-carnival (its sources are also
  carried natively, see the text-sprite notice below).
- **arcade-sprite-util** v0.3.1 — `jwunderl/arcade-sprite-util` at
  `df4991a9793a0fff092225a67d0a81936b75d7e1`, for Arcade projects. MIT, Copyright (c) 2020 Joey Wunderlich. Vendored for: dependency of arcade-carnival.
- **arcade-carnival** v0.0.7 — `microsoft/arcade-carnival` at
  `915caca4a2d83a7071df59407a9987992c083750`, for Arcade projects. MIT, Copyright (c) Microsoft Corporation. Vendored for: 4 Arcade programs of the surveyed corpus (namespace carnival).
- **pxt-settings-blocks** v1.0.0 — `microsoft/pxt-settings-blocks` at
  `068d05d80a063b04d373bf9b411af45201d7ce7a`, for Arcade projects. MIT, Copyright (c) Microsoft Corporation.
. Vendored for: 1 Arcade program of the surveyed corpus (namespace blockSettings); approved list, preferred.
- **arcade-sprite-data** v0.2.1 — `microsoft/arcade-sprite-data` at
  `61a8caa503dcd83a192d935f6251f61013d60848`, for Arcade projects. MIT, Copyright (c) Microsoft Corporation.
. Vendored for: MakeCode approved list, preferred (Sprites, Gameplay).

Full texts: `overlay/scratch-gui/static/licenses/makecode-extensions.MIT.txt`,
shipped with the app and reachable from the About dialog offline.
"Kitronik" is a trademark of Kitronik Ltd, named here only to say whose files these are.

### micro:bit emulator firmware bases (built from source) — MIT, Apache-2.0, newlib

Bluetooth-free CODAL V2 builds of pxt-microbit's {core, radio} and
{core, radio, microphone} package sets, which `lib/bw-makecode/pxt-runtime.js`
(`compileMakeCodeForEmulator`) links a program onto for lite's EMULATOR only.
Built by `scripts/build-makecode-emu-bases.mjs` (codal-microbit-v2 with
DEVICE_BLE 0, Nordic's SoftDevice/MBR/bootloader objects removed before the
link), pinned by sha256 in `scripts/sync-makecode-runtime.mjs`
(MICROBIT_EMU_BASES), fetched by the sync from this repository's
`makecode-emu-bases-1` release (the build workflow's own bytes, published with
the component licence texts) unless built locally, and served under
`packages/scratch-gui/static/makecode/microbit/hexcache-emu/`, never committed.
The build refuses to write a base whose linker map places a byte of the
Nordic nRF5 SDK or of a SoftDevice/MBR/bootloader/UICR section in the image.
Measured on the pinned builds, the image holds, by component: codal-core,
codal-nrf52, codal-microbit-v2 (MIT, Copyright (c) Lancaster University; the
last also the Micro:bit Educational Foundation); pxt-microbit's C++ (MIT,
Microsoft Corporation); the nrfx MDK startup and system files
`gcc_startup_nrf52833.S` / `system_nrf52833.c` (Apache-2.0, Copyright (c) ARM
Limited, modified by Nordic Semiconductor ASA); newlib-nano, libgcc and libstdc++
from the build host's gcc-arm-none-eabi (newlib's BSD-style licences; the GCC
Runtime Library Exception). No nRF5 SDK member and no Nordic binary: 0 bytes.
- **Source:** https://github.com/lancaster-university/codal-microbit-v2,
  https://github.com/lancaster-university/microbit-v2-samples,
  https://github.com/microsoft/pxt-microbit

### MakeCode Arcade firmware bases (built from source) — MIT, BSD-3-Clause, Apache-2.0

Precompiled C++ runtimes that `lib/bw-makecode/pxt-runtime.js` links an Arcade
game onto for real hardware (one per board: RP2040, SAMD51, STM32F401, nRF52833,
nRF52840). pxt-arcade ships none. `scripts/sync-makecode-runtime.mjs` fetches
MakeCode's own cloud build of each (cdn.makecode.com/compile/<sha>.hex, the file
MakeCode's editor downloads, Microsoft Corporation) and serves it under
`packages/scratch-gui/static/makecode/arcade/hexcache/` only when its bytes match
the sha256 pinned there; alternatively our own from-source builds
(`scripts/build-makecode-arcade-bases.mjs`, proved in
`.github/workflows/makecode-arcade-bases.yml`), pinned the same way. Never
committed. Either way each image contains, compiled and unmodified:

- **pxt-common-packages** (the C++ of core, screen, mixer, game…, carried inside
  pxt-arcade's target.json) — MIT, Copyright (c) Microsoft Corporation.
- **CODAL** (`lancaster-university/codal`, `codal-core`, and the device targets
  `codal-pi-pico`, `codal-rp2040`, `codal-itsybitsy-m4`, `codal-samd`,
  `codal-big-brainpad`, `codal-stm32`, `microbit-v2-samples`, `codal-microbit-v2`,
  `codal-nrf52`, at the tags and target-locked commits the build manifest records)
  — MIT, Copyright (c) Lancaster University and contributors (codal-microbit-v2 also
  the Micro:bit Educational Foundation).
- **Raspberry Pi Pico SDK** (rp2040 base, via codal-rp2040) — BSD-3-Clause,
  Copyright 2020 (c) Raspberry Pi (Trading) Ltd.
- **Vendor HAL code, NOT MIT** — each image carries its chip vendor's support
  library, under that vendor's licence:
  - samd51 / samd51adafruit: **Microchip/Atmel ASF4** (via codal-samd) —
    Atmel's BSD-style licence with the condition "may only be redistributed and
    used in connection with an Atmel microcontroller product", and Apache-2.0
    device headers; plus **samd-peripherals**, MIT, Copyright (c) 2018 Scott
    Shawcroft for Adafruit Industries LLC.
  - stm32f401: **STM32Cube HAL** (via codal-stm32, MIT, Copyright (c) 2018
    Michał Moskal) — BSD-3-Clause, Copyright (c) 2017 STMicroelectronics.
  - n3 / gdk (nRF52833): the Nordic nRF5 SDK (via codal-microbit-nrf5sdk) is
    COMPILED but, measured on the linker maps of our builds, none of its
    members is linked; what the images carry from Nordic's side is the nrfx MDK
    startup and system files (Apache-2.0, ARM Limited, modified by Nordic) and
    an 8-byte UICR record (0x10001014: the bootloader and MBR-params addresses)
    from codal-microbit-v2's `lib/uicr.o`, which was converted from Nordic's
    bootloader hex. The SoftDevice, MBR and bootloader objects are offered to
    the linker and discarded.
  - rp2040: the Pico SDK is BSD-3-Clause, Copyright 2020 (c) Raspberry Pi
    (Trading) Ltd., except `pico_double/double_v1_rom_shim.S` (Copyright (c)
    2020 Mark Owen), linked into the image: "a non-exclusive license to use the
    software solely on a Raspberry Pi Pico device … also available from the
    copyright owner under GPLv2" (BSD-3-Clause upstream since pico-sdk
    73e71969; codal-rp2040's pin predates it).
  Each condition is met by what the file is FOR — firmware flashed onto that
  vendor's chip — but none of them is MIT. `lib/bw-makecode/base-licences.js`
  records each base's classification; the emulator runs none of these.
- **newlib / newlib-nano and libgcc** (from the build host's gcc-arm-none-eabi) —
  newlib's BSD-style licences (Red Hat and contributors); libgcc under the GCC
  Runtime Library Exception.
- **Source:** https://github.com/lancaster-university, https://github.com/microsoft/pxt-common-packages,
  https://github.com/raspberrypi/pico-sdk

## BBC BASIC interpreter attribution — zlib

The BASIC tab's "BBC BASIC" profile generates code for, and the reader
imports code from, **BBC BASIC (Z80) / PicoBB (C)** by R.T. Russell.

BBC BASIC (Z80) and PicoBB (the C/Pico port) are copyright
(c) R.T. Russell, distributed under the **zlib licence** (see
https://github.com/rtrussell/BBCSDL/blob/master/licence.txt). The
legacy Z80 interpreter binary is included **unmodified**.

The name "BBC BASIC" is used by permission of the BBC, granted to
R.T. Russell. This project uses the name only to describe compatibility
("runs BBC BASIC programs") and names its own feature plain "BASIC".

- **Upstream:** https://github.com/rtrussell/BBCSDL (cross-platform),
  https://github.com/breakintoprogram/agon-bbc-basic (Z80/eZ80),
  https://github.com/Memotech-Bill/PicoBB (RP2040)
- **Licence:** zlib
- **What ships:** `static/roms/bbcbasic.com` — the CP/M binary of BBC
  BASIC (Z80) from rtrussell/BBCZ80, shipped **unmodified**. Loaded at
  run time by BbcZ80Runner over a BDOS console shim on the Z80 core.

## Devices and STC12 extensions — MPL-2.0

The Devices and STC12 / 8051 pins extensions are by CrispStrobe. The
bundled copies retain their MPL-2.0 source headers. The corresponding upstream
sources are pinned in `bundled-upstream-pins.json`.

## BBC-style video lesson ROM — BSD-3-Clause

`static/roms/bbc-video-6502.rom` is built from the Brickwright lesson source
in `firmware/bbc-video-6502/main.s`. Copyright (c) 2026, Christian Ströbele
(CrispStrobe). Distributed under the BSD-3-Clause licence.

## CrispBASIC restricted WASM runtime — BSD-3-Clause / zlib

Builds prepared with `npm run build:crispbasic` also ship the restricted
CrispBASIC browser interpreter under `static/crispbasic/`. Its C interpreter
comes from **BBCSDL**, copyright (c) 2021 Richard T. Russell, under the
**zlib licence**, pinned to commit `6c302988ee2a08c5f9a65fa3eb8e76bcacc6079f` of
https://github.com/rtrussell/BBCSDL. CrispBASIC's host, worker and session code
is **BSD-3-Clause**, copyright (c) 2026 Christian Ströbele (CrispStrobe).
This is a modified integration: its explicit host replaces SDL/console
services and applies the restrictions recorded in the package's patch files.
It is branded CrispBASIC; BBC BASIC describes language compatibility.

Emscripten **3.1.64** supplies runtime/support code under its **MIT and
University of Illinois/NCSA licences**. The compiled library components retain
their own musl, math-library, dlmalloc and compiler-rt notices. The payload
includes the complete original notices under `static/crispbasic/licenses/`,
the CrispBASIC licence as `LICENSE.txt`, and the package's
`THIRD-PARTY-NOTICES.md`. Build and payload manifests record source inputs,
compiler settings, imports and artifact digests; the packaging command verifies
the upstream and toolchain licence hashes before writing the served files.

See `packages/crisp-basic/THIRD-PARTY-NOTICES.md`,
`packages/crisp-basic/upstream.lock.json` and
`packages/crisp-basic/wasm/toolchain.lock.json` for provenance. The browser
payload does not contain the native backend, SDL or the Matrix Brandy oracle.

## CP/M 2.2 (Z80) — redistributable (DRDOS grant) + MIT

The Z80 machine can boot a **real CP/M 2.2 computer** (an `A>` prompt, not
the BDOS shim above) via lite's `attachZ80` `cpm-system` profile, which loads
the CCP+BDOS and a BIOS ROM vendored **unmodified** from bw-board's `roms/cpm/` at the pinned sha
(recorded in `cpm-roms.provenance.json` beside them). The boot itself is
bw-board's `createCpmSystem`, reached through the z80 adapter's `cpmSystem`
option.

- **CCP+BDOS** — Digital Research's CP/M 2.2, assembled from Clark A. Calkins'
  Z80 disassembly (`cpm2-asm.zip`, cpm.z80.de). **Redistributable** under the
  Bryan Sparks / DRDOS, Inc. 2022 grant (the right to use, distribute, modify
  CP/M and its derivatives), which supersedes the 2001 Lineo/Caldera grant.
  Holder: DRDOS, Inc. (successor to Digital Research). Upstream:
  http://www.cpm.z80.de/
- **BIOS** — our own, no Digital Research code (MC6850 ACIA console + a host
  RAM-disk controller). **MIT**, (c) the BrickWright project.
- **What ships:** `static/roms/cpm22-64k.bin` (the CCP+BDOS) and
  `static/roms/cpm-bios.bin` (serial BIOS). The alternate serial and
  TMS9918A video BIOS is `static/roms/cpm-bios-vdp.bin` (MIT with
  public-domain FUNSCII glyphs). The `cpm-roms.provenance.json` file records
  upstream sources, licences, holders and SHA-256s for all three files.

## Microsoft BASIC for 6502 (V1.1) — MIT

The "Microsoft BASIC (6502)" machine lesson boots Microsoft's original 1978
6502 BASIC on the emulated Ben Eater 6502 (a `MICROSOFT BASIC V1.1` banner and
an `OK` prompt over the 65C51 ACIA). Microsoft released the source under the
**MIT licence**; the shipped ROM is that source assembled with `ca65` — not a
scanned or dumped cartridge.

- **Upstream:** https://github.com/microsoft/BASIC-M6502 (original macro source,
  commit `7460af2c03ae19c0e60ff327489229d2005b9357`); built from
  https://github.com/CrispStrobe/basic-m6502-bw (commit
  `e1dcf16430f216b21888492235eb2defae13aa03`), a modern-assemblable port.
- **Licence:** MIT, (c) Microsoft Corporation.
- **What ships:** `static/roms/msbasic-6502.rom` — the built 32 KB ROM (at
  `$8000`, vectors at `$FFFA`), with `msbasic-6502.provenance.json` beside it.
  Packaged as the media-lab project `projects/ms-basic-6502` (its `fetch.sh`
  reproduces this ROM byte-for-byte). Loaded at run time into the eater6502
  machine's ROM region by the Machine Manager's `lesson-msbasic-6502`.

## uBASIC (DOS-native BASIC) — BSD-3-Clause

The BASIC tab's "uBASIC on DOS" profile runs a real 16-bit MS-DOS
interpreter on the 8086 DOS bench. The interpreter is **uBASIC** by
R. Adam Dunkels (with a fork by Danyil Bohdan), a small line-numbered
BASIC in portable C, distributed under the **BSD-3-Clause licence** (the
header is on every source file).

It is compiled — unmodified except for widening its integer type and
adding a `PROG.BAS`-reading DOS front-end (`dosmain.c`) — to a 16-bit
MS-DOS `.EXE` with `ia16-elf-gcc` (the tkchia GCC port for 16-bit x86).
That GCC port is GPL, but it is a **build-time tool only**: the shipped
binary is BSD-3-Clause uBASIC linked against the permissive newlib +
libi86 runtime, and carries no GCC-runtime copyleft.

- **Upstream:** https://github.com/adamdunkels/ubasic (commit
  `cc07193c231e21ecb418335aba5b199a08d4685c`)
- **Licence:** BSD-3-Clause, (c) 2006 Adam Dunkels; (c) 2013 Danyil Bohdan
- **What ships:** `static/roms/ubasic.exe` — the built interpreter, with
  `ubasic.provenance.json` beside it. Packaged as the media-lab project
  `projects/ubasic-dos` (its `fetch.sh` reproduces this binary
  byte-for-byte). Loaded at run time and driven by
  `runDosToolchain('ubasic', …)` over the bw-board 8086 DOS bench, which
  mounts the user's program as `PROG.BAS`.

## fe (DOS-native Lisp) — MIT

The code tab's "Lisp (fe on DOS)" language runs a real 16-bit MS-DOS
interpreter on the 8086 DOS bench. The interpreter is **fe** by **rxi**,
a tiny Lisp in ~900 lines of portable C (lambdas, closures, macros, a
mark-and-sweep garbage collector over a fixed object pool, no allocation
after startup), distributed under the **MIT licence**.

It is compiled — unmodified except for an added `PROG.FE`-reading DOS
front-end (`dosmain.c`) — to a 16-bit MS-DOS `.EXE` with `ia16-elf-gcc`
(the tkchia GCC port for 16-bit x86). That GCC port is GPL, but it is a
**build-time tool only**: the shipped binary is MIT fe linked against the
permissive newlib + libi86 runtime, and carries no GCC-runtime copyleft.

- **Upstream:** https://github.com/rxi/fe (commit
  `ed4cda96bd582cbb08520964ba627efb40f3dd91`)
- **Licence:** MIT, (c) 2020 rxi
- **What ships:** `static/roms/fe.exe` — the built interpreter, with
  `fe.provenance.json` beside it. Packaged as the media-lab project
  `projects/fe-dos` (its `fetch.sh` reproduces this binary byte-for-byte).
  Loaded at run time and driven by `runDosToolchain('fe', …)` over the
  bw-board 8086 DOS bench, which mounts the user's program as `PROG.FE`.

### fe source for board targets

`overlay/scratch-gui/src/lib/bw-lang/fe-target-c.js` (mirrored under
`packages/scratch-gui`) embeds fe's `fe.h` and `fe.c` from the same commit,
unmodified except that the `#include "fe.h"` line and the `FE_STANDALONE`
`main` are left out, together with fe's MIT licence text. The Code tab joins
them with the user's program and a small `main` into one C file, which the
hosted RISC-V compiler builds; the resulting image runs in the browser
RISC-V simulator.

## partcl (DOS-native Tcl) — MIT

The code tab's "Tcl (partcl on DOS)" language runs a real 16-bit MS-DOS
interpreter on the 8086 DOS bench. The interpreter is **partcl** by **Serge
Zaitsev**, a minimal Tcl in a few hundred lines of portable C (`set`/`proc`/
`if`/`while`, command substitution, prefix arithmetic), distributed under the
**MIT licence**.

It is compiled — unmodified except for an added `PROG.TCL`-reading DOS
front-end (`dosmain.c`) — to a 16-bit MS-DOS `.EXE` with `ia16-elf-gcc` (the
tkchia GCC port for 16-bit x86). That GCC port is GPL, but it is a **build-time
tool only**: the shipped binary is MIT partcl linked against the permissive
newlib + libi86 runtime, and carries no GCC-runtime copyleft.

- **Upstream:** https://github.com/zserge/partcl (commit
  `1ed1df73907875ee770ac65e6546bd56fbc6f637`)
- **Licence:** MIT, (c) Serge Zaitsev
- **What ships:** `static/roms/tcl.exe` — the built interpreter, with
  `tcl.provenance.json` beside it. Packaged as the media-lab project
  `projects/tcl-dos` (its `fetch.sh` reproduces this binary byte-for-byte).
  Loaded at run time and driven by `runDosToolchain('tcl', …)` over the
  bw-board 8086 DOS bench, which mounts the user's program as `PROG.TCL`.

## Jim Tcl (DOS-native Tcl) — BSD-2-Clause

The code tab's Tcl tab runs **Jim Tcl**, a small but complete Tcl
interpreter (lists, dicts, `expr` with 64-bit integers and doubles, string
commands, `regexp`, `format`/`scan`, `upvar`/`uplevel`, `apply`, `try`), as a
real 16-bit MS-DOS program on the 8086 DOS bench. Jim Tcl is (c) 2005
Salvatore Sanfilippo, Clemens Hintze, Pat Thoyts, (c) 2008 Øyvind Harboe,
Andrew Lunn, Duane Ellis, Uwe Klein, Steve Bennett, (c) 2009 Nico Coesel,
Zachary T Welch, David Brownell and the Jim Tcl contributors, distributed
under the **BSD 2-Clause licence**.

It is built from jimtcl's own single-file amalgamation
(`autosetup/jimsh0.c`) by `tools/jim-dos/` in this repository: `mkdos.py`
applies and documents every change (16-bit integer fixes, a stack-bounded
recursion check, a heap that cannot grow into the stack, a smaller data
segment, the Tcl-coded library moved to a file read on first use), and
`build.sh` compiles it with `ia16-elf-gcc` (tkchia's GCC port for 16-bit x86).
That GCC port is GPL, but it is a **build-time tool only**: the shipped
binary is BSD-2 Jim Tcl linked against the permissive newlib + libi86
runtime, and carries no GCC-runtime copyleft.

- **Upstream:** https://github.com/msteveb/jimtcl (commit
  `5bac7c99ad65864c87da513e22e2f01703fa4e03`)
- **Licence:** BSD-2-Clause — the full text ships as `static/roms/jim.LICENSE.txt`
- **What ships:** `static/roms/jim.exe` — the built interpreter — and
  `static/roms/jimlib.tcl` — Jim's Tcl-coded `stdlib.tcl`/`tclcompat.tcl`
  commands, unchanged, one per section — with `jim.provenance.json` beside
  them. Loaded at run time and driven by `runDosToolchain('jim', …)` over the
  bw-board 8086 DOS bench, which mounts the user's program as `PROG.TCL` and
  the library as `JIMLIB.TCL`.

### Jim Tcl source for board targets

`static/roms/jimsh0.c` (overlay and packages copies) is Jim Tcl's
single-file build `autosetup/jimsh0.c` from the same commit, unmodified
(SHA-256 as recorded in `jim.provenance.json`). When asked to run Tcl on
RISC-V, `overlay/scratch-gui/src/lib/bw-lang/tcl-target-c.js` fetches it,
checks that hash, applies asserted edits (no exec/readdir/glob; a
channel-aware core `puts`; a renamed jimsh `main`), adds our `main` and
stubs for POSIX calls the target lacks, and sends the one C file to the
hosted RISC-V compiler. Jim Tcl is BSD-2-Clause; its full text ships as
`static/roms/jim.LICENSE.txt`.

## zForth (DOS-native Forth) — MIT

The code tab's "Forth (zForth on DOS)" language runs a real 16-bit MS-DOS
interpreter on the 8086 DOS bench. The interpreter is **zForth** by **Ico
Doornekamp (zevv)**, a tiny embeddable Forth — a small C VM plus a Forth-source
bootstrap (`core.zf`) defining the language (`:`/`;`, `if/else/fi`,
`begin/until/again`, `."`, `.`, `emit`, `cr`) — distributed under the **MIT
licence**.

It is compiled — unmodified except for an added `PROG.FTH`-reading DOS
front-end (`dosmain.c`) that also embeds `core.zf` — to a 16-bit MS-DOS `.EXE`
with `ia16-elf-gcc` (the tkchia GCC port for 16-bit x86). That GCC port is GPL,
but it is a **build-time tool only**: the shipped binary is MIT zForth linked
against the permissive newlib + libi86 runtime, and carries no GCC-runtime
copyleft.

- **Upstream:** https://github.com/zevv/zForth (commit
  `41db72d165c1539d57f3f79970fc57ea881a79dc`)
- **Licence:** MIT, (c) Ico Doornekamp
- **What ships:** `static/roms/forth.exe` — the built interpreter (with
  `core.zf` embedded; the stock `misc.zf` FizzBuzz demo and `memaccess.zf`
  load-time asserts excluded so nothing prints at startup), with
  `forth.provenance.json` beside it. Packaged as the media-lab project
  `projects/forth-dos` (its `fetch.sh` reproduces this binary byte-for-byte).
  Loaded at run time and driven by `runDosToolchain('forth', …)` over the
  bw-board 8086 DOS bench, which mounts the user's program as `PROG.FTH`. Blocks
  ⇄ Forth is `overlay/scratch-gui/src/lib/bw-lang/forth.js`.

### zForth source for board targets

`overlay/scratch-gui/src/lib/bw-lang/forth-target-c.js` (mirrored under
`packages/scratch-gui`) embeds zForth's `zforth.h`, `zforth.c` and
`forth/core.zf` from the same commit, with zForth's MIT licence text.
They are unmodified except that `zforth.h`'s `#include "zfconf.h"` is
replaced by our own configuration (after the upstream Linux `zfconf.h`:
float cells, trace off, 16 KiB dictionary) and `zforth.c`'s
`#include "zforth.h"` is left out. The host functions are ours. The Code
tab joins them with the user's program into one C file, which the hosted
RISC-V compiler builds; the image runs in the browser RISC-V simulator.

## Free 80386 AT firmware (Bochs BIOS + LGPL VGABios) — LGPL-2.1

The **fully-free 386** machine boots FreeDOS in the browser on redistributable
firmware only — **no proprietary IBM 5170 (AT) ROM**. lite's debug-runner
(`attachI80386`) loads two vendored LGPL binaries: the Bochs legacy system BIOS
at `0xF0000` (and the 386 high reset alias `0xFF0000`) and the LGPL VGABios as
the `0xC0000` video option ROM. Both are shipped **unmodified**, vendored from
bw-board's `roms/free-at-bios/` at the pinned sha (an unmodified copy of the
upstreams below). The copyrighted IBM AT ROM and its VGA option ROM remain an
**optional, maintainer-only fidelity oracle** (`AT_BIOS_ROM` / `VGA_BIOS_ROM`),
never fetched, stored, or committed.

- **Bochs legacy BIOS** — part of the **Bochs** x86 emulator, distributed under
  the **GNU LGPL**. Upstream: https://bochs.sourceforge.io/ (source
  `bios/rombios.c`; the prebuilt `BIOS-bochs-legacy` from Bochs 2.7,
  `(c) 2001-2021 The Bochs Project`).
- **LGPL VGABios** — the **VGABios** project, distributed under the **GNU
  LGPL**. Upstream: https://savannah.nongnu.org/projects/vgabios/ (revision
  `288`, 2021-05-28, `(C) 2002-2021 the LGPL VGABios developers Team`).
- **Licence:** GNU Lesser General Public License v2.1-or-later. The full text
  ships inside the application as
  `static/licenses/free-386-firmware.LGPL-2.1.txt`; both binaries are covered by
  it.
- **Corresponding source:**
  `static/licenses/free-386-firmware.sources.json` ships inside the application
  and records the exact Bochs 2.7 and VGABios 0.8a source archives plus their
  SHA-256 hashes. The About dialog links both this manifest and the offline
  licence text.
- **What ships:** `static/roms/free-386-bochs-bios.rom` (64 KiB) and
  `static/roms/free-386-vgabios-lgpl.bin` (38400 bytes), with
  `free-386-bios.provenance.json` beside them recording the upstreams, licences,
  holders, sizes, and SHA-256s. The reproducible ROM-free 386 qualification is
  bw-board's script run-i80386-free-bios-freedos.mjs (needs no external ROM).

## 6502 BASIC (basic-m6502-bw) — MIT

The BASIC tab's "6502 BASIC" profile generates code compatible with the
6502 BASIC interpreter. This is **derived from Microsoft's MIT-licensed
6502 BASIC source** (https://github.com/microsoft/BASIC-M6502, MIT
License, copyright (c) Microsoft Corporation).

The derived work is named **basic-m6502-bw** to distinguish it from the
original. It is never referred to as "Microsoft BASIC" in user-facing
labels.

- **Upstream:** https://github.com/microsoft/BASIC-M6502
- **Licence:** MIT
- **What ships:** `static/roms/basic.rom` — the 32 KB BASIC ROM from
  basic-m6502-bw, shipped **unmodified**. Loaded at run time by
  BasicMachineRunner on the emulated 6502 machine.

## Tali Forth 2 — Public Domain

**Tali Forth 2** (Public Domain, https://github.com/SamCoVT/TaliForth2)
is a Forth interpreter for the 6502, running on the py65mon memory map.

- **Upstream:** https://github.com/SamCoVT/TaliForth2
- **Licence:** Public Domain (no warranty)
- **What ships:** `static/roms/taliforth-py65mon.bin` — the 32 KB
  prebuilt binary, shipped **unmodified**. Loaded at run time by the
  eater6502 debug target with `py65mon: true` for interactive Forth.

## Interpreters that do NOT ship

The following BASIC interpreters were evaluated but are **not bundled,
not linked, and not distributed** in any form:

- **Acorn BBC BASIC ROM** — Crown Copyright, not redistributable
- **Enhanced BASIC (ehBASIC)** by Lee Davison — licence unclear, not used

## spike-sim — Independent SPIKE simulator backend — BSD-3-Clause

`overlay/scratch-gui/src/lib/spike-sim/independent-backend.js`,
`speed-envelope.mjs`, its backend
selection adapter, `spike-simulator-pane.jsx`, and newly authored validation tooling are Copyright (c)
2026 Brickwright contributors, BSD-3-Clause (see LICENSE). The controller was
authored by a fresh implementation agent from functional contracts and
synthetic black-box observations, with an audited instruction-based access
boundary; see `docs/independent-spike/INDEPENDENCE.md`. It is a standalone virtual controller and requires no external firmware runtime,
assets or build steps.

It reuses the existing Apache-2.0 virtual hub/protocol adapters and BSD-3-Clause
arena through their documented shared-state interfaces. Scratch and native
program readers retain their BSD-3-Clause/MPL-2.0 licences and source
availability obligations. The virtual simulator ships without an external firmware runtime. Evidence for retained component
licences is recorded in the private SPIKE audit archive; this addition does
not relicense any retained component.

### Arcade numeric sign

The native numeric sign reporter adapts `Math.sign` from the bundled MIT-licensed
Microsoft PXT `base/pxt-helpers.ts`. The retained PXT notices cover this adaptation.
Original source and simulator comparisons verify its positive-zero and NaN rules.

### Arcade image scrolling

Native mutable image scrolling adapts the signed32 offsets, clipping and
zero-filled pixel semantics of Microsoft PXT ImageMethods.scroll, retained
under the existing pxt-common-packages MIT notice. The implementation uses
row copies over native mutable buffers; comparisons execute the original
simulator RefImage, clone, transparent drawing and scrolling methods unchanged.

### Arcade in-place image copying

The native Image.copyFrom operation follows Microsoft PXT ImageMethods.copyFrom:
same image dimensions, transparent pixel copying and preserved destination pixel
buffer. The native implementation adapts these semantics for Brickwright's
4-bit indexed images under the Microsoft PXT MIT notice above. Original PXT
simulator source remains unchanged for comparisons.

### Arcade indexed scene composition

The internal compositor follows the Microsoft PXT Scene.render and
Background.draw ordering for background colour/image and Sprite pixel drawing,
using the already credited original PXT image raster operations. Original
source remains unchanged for full indexed pixel-plane comparisons. The initial
compositor covers background and sprites; tilemaps, callback renderables, HUD,
speech and effects remain separate integration work.

### Arcade indexed tile composition

The tile raster iteration and tile renderable identity follow Microsoft PXT
TileMap.draw and LegacyTilemap.draw: inclusive tile bounds, original camera
bit shifts, transparent blits and z/creation-ID order. These semantics adapt
the credited MIT PXT implementation; original source remains unchanged for
full indexed-frame comparisons.

### Indexed modern speech composition

Modern speech composition reuses the retained original Microsoft PXT
SpriteSayRenderer and font data, with a native write-mask bridge. The mask
preserves explicit colour-zero writes and owner-local draw ordering; original
PXT source stays unchanged for full pixel comparisons. Legacy speech's separate
bubble sprite remains an integration gap in this frame pipeline.

### Speech clock across scenes

Speech creation, raster animation and expiry use the existing global simulated
clock, following original PXT control.millis/game.runtime speech semantics.
Scene-local frame and physics clocks remain separate. Original PXT speech
sources and simulator remain unchanged for suspended-scene comparisons.

### Legacy speech camera bridge

The speech adapter follows the credited Microsoft PXT MIT Sprite.isOutOfScreen
and legacy speech camera/flag semantics. Native world coordinates and camera
draw offsets are passed through to the retained original renderer; generated
PXT sources and font data are unchanged. This does not integrate native bubble
identity, yielding callbacks or complete frame presentation.

### Negative sprite kind membership

The native kind collection queries and interchange follow the credited MIT
Microsoft PXT sprites.allOfKind and Sprite.setKind semantics: negative numeric
kinds retain their sprite/callback identity but do not join kind collections.
The existing scene, physics and callback implementations remain in use; original
PXT simulator/source comparisons exercise the behaviour without changing them.

### Native legacy speech constructor continuation

`overlay/scratch-vm/src/extensions/crispstrobe/arcade/speech-native-legacy.js`
adapts the credited Microsoft PXT Arcade4.2.1 game/spritesay.ts legacy renderer
(MIT, Copyright Microsoft Corporation). The constructor is a resumable factory
so native creation callbacks can pause before flags and text are installed.
Original geometry, glyph drawing and scrolling logic are retained with a native
sprite/image facade. The original generated speech-pxt.js and credited fonts
remain unchanged for comparisons. This is attributed PXT adaptation and
integration, not a clean-room implementation.

## spikeprime — MPL-2.0

The scoped `spikeprime` pin selects the LEGO SPIKE Prime / Robot Inventor
extension authored by CrispStrobe from https://github.com/CrispStrobe/extensions.
The complete source and original author/license header are retained in
`overlay/scratch-vm/src/extensions/crispstrobe/spikeprime/index.js` as the
JSON source string consumed by the separate host adapter.

The exact selected source is
https://github.com/CrispStrobe/extensions/blob/ff74f1309b8807713508884048292182a369f8f5/extensions/CrispStrobe/legospike_turbowarp_transpile.js.
`vendor-pins.json` and the generated per-file receipt record its commit and
content hash. MPL-2.0 text: https://www.mozilla.org/en-US/MPL/2.0/.

## wedo2unified — MPL-2.0

The scoped `wedo2unified` pin selects LEGO WeDo 2.0 Universal, authored by
CrispStrobe from https://github.com/CrispStrobe/extensions. Its source declares
MPL-2.0. The complete selected JavaScript source, including its original
author/license header, is retained in
`overlay/scratch-vm/src/extensions/crispstrobe/wedo2unified/index.js` and
distributed through the generated extension wrapper.

The exact selected source is
https://github.com/CrispStrobe/extensions/blob/5fe7033f8b320b2f5819c20860b10c05aeff3c16/extensions/CrispStrobe/lego_wedo2_universal.js.
`vendor-pins.json` and the per-file bundle receipt record its commit, byte count
and SHA-256. This notice covers that selected extension source. MPL-2.0 text:
https://www.mozilla.org/en-US/MPL/2.0/.

## ev3comprehensive — MPL-2.0

The scoped `ev3comprehensive` pin selects LEGO EV3 Universal, authored by
CrispStrobe from https://github.com/CrispStrobe/extensions. Its source declares
MPL-2.0. The complete selected JavaScript source, including its original
By and License headers, is retained as the JSON source string in
`overlay/scratch-vm/src/extensions/crispstrobe/ev3comprehensive/index.js`;
the host adapter is separate.

The exact selected source is
https://github.com/CrispStrobe/extensions/blob/ff74f1309b8807713508884048292182a369f8f5/extensions/CrispStrobe/ev3_universal.js.
`vendor-pins.json` and the generated per-file bundle receipt record its commit,
byte count and SHA-256. MPL-2.0 text: https://www.mozilla.org/en-US/MPL/2.0/.

## legoboostunified — MPL-2.0

The scoped `legoboostunified` pin selects LEGO Boost Universal, authored by
CrispStrobe from https://github.com/CrispStrobe/extensions. Its source declares
MPL-2.0. The complete selected JavaScript source, including its original
By and License headers, is retained as the JSON source string in
`overlay/scratch-vm/src/extensions/crispstrobe/legoboostunified/index.js`;
the host adapter is separate.

The exact selected source is
https://github.com/CrispStrobe/extensions/blob/ff74f1309b8807713508884048292182a369f8f5/extensions/CrispStrobe/legoboost_universal.js.
`vendor-pins.json` and the generated per-file bundle receipt record its commit,
byte count and SHA-256. MPL-2.0 text: https://www.mozilla.org/en-US/MPL/2.0/.

## legonxt — MPL-2.0

The scoped `legonxt` pin selects LEGO NXT Universal, authored by
CrispStrobe from https://github.com/CrispStrobe/extensions. Its source declares
MPL-2.0. The complete selected JavaScript source, including its original
By and License headers, is retained as the JSON source string in
`overlay/scratch-vm/src/extensions/crispstrobe/legonxt/index.js`;
the host adapter is separate.

The exact selected source is
https://github.com/CrispStrobe/extensions/blob/ff74f1309b8807713508884048292182a369f8f5/extensions/CrispStrobe/legonxt_transpile_universal.js.
`vendor-pins.json` and the generated per-file bundle receipt record its commit,
byte count and SHA-256. MPL-2.0 text: https://www.mozilla.org/en-US/MPL/2.0/.

## legopoweredup — MPL-2.0

The scoped `legopoweredup` pin selects LEGO Powered Up, authored by
CrispStrobe from https://github.com/CrispStrobe/extensions. Its source declares
MPL-2.0. The complete selected JavaScript source, including its original
By and License headers, is retained as the JSON source string in
`overlay/scratch-vm/src/extensions/crispstrobe/legopoweredup/index.js`;
the host adapter is separate.

The exact selected source is
https://github.com/CrispStrobe/extensions/blob/ff74f1309b8807713508884048292182a369f8f5/extensions/CrispStrobe/lego_poweredup.js.
`vendor-pins.json` and the generated per-file bundle receipt record its commit,
byte count and SHA-256. MPL-2.0 text: https://www.mozilla.org/en-US/MPL/2.0/.

## arrays-values — MPL-2.0

The scoped `arrays-values` pin selects the Arrays & Vectors extension authored
by CrispStrobe from https://github.com/CrispStrobe/extensions. Its declared
license is MPL-2.0. The complete source, including its original author/license
header, is retained in `overlay/scratch-vm/src/extensions/crispstrobe/arrays/index.js`
as a JSON source string; the host adapter is separate.

The exact selected source is
https://github.com/CrispStrobe/extensions/blob/035ab22a4d946fe5b8e367013caf898cd763e5f4/extensions/CrispStrobe/arrays.js.
`vendor-pins.json` and the generated per-file bundle receipt record the commit
and content hash. This scopes the adoption to Arrays; it does not advance other
extension sources. MPL-2.0 text: https://www.mozilla.org/en-US/MPL/2.0/.

## microbitplus — MPL-2.0

The scoped `microbitplus` pin selects the micro:bit+ extension authored by
CrispStrobe from https://github.com/CrispStrobe/extensions. Its declared
license is MPL-2.0. The complete source, including its original author/license
header, is retained in `overlay/scratch-vm/src/extensions/crispstrobe/microbitplus/index.js`
as a JSON source string; the host adapter is separate.

The exact selected source is
https://github.com/CrispStrobe/extensions/blob/3dc133320c2b9c3725bfc69b0f2d2406c4e8900f/extensions/CrispStrobe/microbitplus.js.
`vendor-pins.json` and the generated per-file bundle receipt record the commit
and content hash. This scopes the adoption to micro:bit+; it does not advance
other extension sources. MPL-2.0 text: https://www.mozilla.org/en-US/MPL/2.0/.

## circuitplayground — MPL-2.0 (incorporating MIT-licensed pxt-adafruit code)

The scoped `circuitplayground` pin selects the Circuit Playground extension
authored by CrispStrobe from https://github.com/CrispStrobe/extensions (task
A9). Its declared license is MPL-2.0. The complete source, including its
author/license header, is retained in
`overlay/scratch-vm/src/extensions/crispstrobe/circuitplayground/index.js` as a
JSON source string; the host adapter is separate.

It ports behaviour from pxt-adafruit 1.6.8 (Copyright (c) Microsoft
Corporation, MIT License): the NeoPixel strip, colour helpers and ring
animations, Math.isin (after FastLED, MIT), the animation queue, tempo and
beats, and the simulator's sensor thresholds and button timing. Its built-in
sounds and melody notation come from MicroPython on the micro:bit (Copyright
(c) 2013-2016 The MicroPython-on-micro:bit Developers, MIT License). Both MIT
notices are reproduced in the source header. No pxt-adafruit firmware or
chip-restricted ASF4 code is included.

The exact selected source is
https://github.com/CrispStrobe/extensions/blob/0c4e3b4a0cee57d65474082938c352818426eebb/extensions/CrispStrobe/circuitplayground.js.
`vendor-pins.json` and the generated per-file bundle receipt record the commit
and content hash. This scopes the adoption to Circuit Playground; it does not
advance other extension sources. MPL-2.0 text:
https://www.mozilla.org/en-US/MPL/2.0/. MIT text: https://opensource.org/licenses/MIT.

## Arcade Sprite Data

The native Sprite Data API adapter follows Microsoft arcade-sprite-data v0.0.5
(commit `332026d12c46286c7afe59bc4829ccf08471d5b1`), licensed under MIT.
Copyright (c) Microsoft Corporation. Original source, license and provenance:
`overlay/scratch-vm/src/extensions/crispstrobe/arcade/sprite-data-source/`.
The adapter covers the original nine Number, String, Boolean and
Sprite methods; arbitrary object data and Image/array methods are separate.

## Arcade typed Settings byte storage

The generated `settings-pxt.js` retains the pinned Arcade 4.2.1 bundle's
PXT common-package Settings, MessagePack and simulator storage algorithms
under MIT, copyright Microsoft Corporation. Existing pxt-common-packages
notices apply; input SHA256 values are retained in the generated header.
`scripts/generate-arcade-settings.mjs --check` verifies the reviewed inputs.
The application storage host uses the existing program-owned identity, device
records and portable SB3 snapshots; physical flash and SDK startup scopes are
separate qualification boundaries.

### Microsoft Arcade Text Sprite

The complete Text Sprite v1.3.0 source is retained at
`overlay/scratch-vm/src/extensions/crispstrobe/arcade/text-sprite-source/text.ts`,
from Microsoft `arcade-text` commit `fa2439314c6633943666a763fdae32a5c67a9ae8`.
It is MIT licensed, Copyright (c) Microsoft Corporation; the original notice is
retained beside the source. `scripts/generate-arcade-text-sprite.mjs` transpiles
those algorithms without replacing their font, outline, icon or setter logic.
The native host uses the separately retained PXT image operations and font
notices, including the existing SIL OFL font12 notice. Source identity and host
qualification are distinct from native blocks and whole-game qualification.

## MakeCode kickoff TeamData qualification source

The complete unchanged `teamdata.ts` from Microsoft pxt-kickoff revision
`c2c7f8193af1dafaebda3a7cda235df4c42b87ae` is retained in
`test/fixtures/arcade-teamdata-source` for class qualification. It is MIT licensed;
the original licence and fixed source provenance are retained beside it.
This fixture does not admit or bundle the complete kickoff game library.

## circuitplayground — MPL-2.0 (incorporating MIT-licensed pxt-adafruit code)

The scoped `circuitplayground` pin selects the Circuit Playground extension
authored by CrispStrobe from https://github.com/CrispStrobe/extensions (task
A9). Its declared license is MPL-2.0. The complete source, including its
author/license header, is retained in
`overlay/scratch-vm/src/extensions/crispstrobe/circuitplayground/index.js` as a
JSON source string; the host adapter is separate.

It ports behaviour from pxt-adafruit 1.6.8 (Copyright (c) Microsoft
Corporation, MIT License): the NeoPixel strip, colour helpers and ring
animations, Math.isin (after FastLED, MIT), the animation queue, tempo and
beats, and the simulator's sensor thresholds and button timing. Its built-in
sounds and melody notation come from MicroPython on the micro:bit (Copyright
(c) 2013-2016 The MicroPython-on-micro:bit Developers, MIT License). Both MIT
notices are reproduced in the source header. No pxt-adafruit firmware or
chip-restricted ASF4 code is included.

The exact selected source is
https://github.com/CrispStrobe/extensions/blob/0c4e3b4a0cee57d65474082938c352818426eebb/extensions/CrispStrobe/circuitplayground.js.
`vendor-pins.json` and the generated per-file bundle receipt record the commit
and content hash. This scopes the adoption to Circuit Playground; it does not
advance other extension sources. MPL-2.0 text:
https://www.mozilla.org/en-US/MPL/2.0/. MIT text: https://opensource.org/licenses/MIT.

## Original Robot Lab assemblies: ORBITAL LOOM and TIDAL TRIO

Copyright (c) 2026 CrispStrobe. BSD-3-Clause.
The owner confirmed these supplied designs are their own original work and specified this credit
and licence. Their generated download README/header wording is superseded for these assemblies.
The bundled notices identify simulator adaptations. Referenced LDraw geometry retains the separate
authors and licences recorded above. No supplied predicted animation is presented as physics output.

## Original Robot Lab assembly: PULSE PERCUSSION, governor and lesson content

Copyright (c) 2026 CrispStrobe. BSD-3-Clause.
Pulse Percussion is the owner's original design; their requested credit and licence
supersede generated download header wording. Its bundled notice identifies the
simulator adaptation. The centrifugal governor and bilingual Robot Lab lesson
prose are original work under the same licence. Referenced LDraw geometry retains
its own authors and licences above. No NC-licensed model or predicted animation
is included as functioning simulation content.

## Original Robot Lab assemblies: pendulum array and clutch load bench

Copyright (c) 2026 CrispStrobe. BSD-3-Clause.
The 54-piece motor-excited pendulum array and 26-piece clutch load bench, their
native example programs and bilingual lessons are original assemblies/content.
Referenced LDraw geometry retains its separate authors and licences above.

## Original Robot Lab assemblies: Mean Machine, Stepworks, Stride Lab, Twinpoint, Butterfly and Tempo Loop

Copyright (c) 2026 CrispStrobe. BSD-3-Clause.
Owner-supplied original designs, native programs and bilingual lessons. The
owner’s authorship/licence instruction supersedes initial generated archive
wording; exact source fixtures preserve provenance. Per-model notices are
packaged in `static/sim-lab/licenses/`. Referenced official LDraw geometry
retains its separate authors and CC BY licences. No NC model, downloaded
executable controller, or predicted animation is bundled as physics output.

Tilt Lab, its native bounded example and bilingual lesson are also original
CrispStrobe / BSD-3-Clause work supplied by the owner. Its independent ball
and referenced LDraw parts retain their separately documented geometry credits.

### Axis Plotter

Original model, native control programs and lessons: Copyright (c) 2026
CrispStrobe, BSD-3-Clause. Full notice: `static/sim-lab/licenses/axis-plotter.txt`.
Official LDraw part geometry retains its separate attribution and licence.

### Phase Bridge

Original apparatus, in-phase/misphased variants, native programs and bilingual
lessons: Copyright (c) 2026 CrispStrobe, BSD-3-Clause. Per-model notices retain
the full licence. Official LDraw geometry retains its separate authors and
CC BY licences. Two physically required universal-joint crosses are inferred
by the solver; the explicit-placement BOM counts 144 pieces, 146 with crosses.

### Orbit Mixer

Original 161-piece apparatus, two native programs and bilingual lessons:
Copyright (c) 2026 Christian Ströbele (CrispStrobe), BSD-3-Clause.
Full notice: `static/sim-lab/licenses/orbit-mixer.txt`. Referenced LDraw part
geometry retains its separate authors and CC BY licences. The paddle's motion
is solved from actual gears; predicted kinematics are not an animation input.

### Brickwright authored material parts

Copyright (c) 2026 CrispStrobe, BSD-3-Clause. Custom glass, printed board and
adhesive-gasket geometry are original owner-supplied work adapted for Magnetic
Chess. They are shipped separately from the unmodified official LDraw subset,
with their own hash lock and full BSD notice. Original supplied CC0 provenance
is retained with the model fixture. No non-commercial geometry is included.

### Magnetic Chess, Sarrus Lift and Quickstroke

Original owner-supplied apparatus, adapted models, native control programs and
bilingual lessons: Copyright (c) 2026 CrispStrobe, BSD-3-Clause. Full notices
ship in `static/sim-lab/licenses/`. Supplied Chess and Sarrus drafts also grant
CC0; fixture provenance preserves those grants. Chess uses one glass sheet
and four double-sided adhesive gaskets alongside 1,203 LEGO placements. Sarrus
adds four LEGO clearance plates to its supplied 140-piece layout. Quickstroke
preserves all 111 supplied placements. Official part geometry retains its
separate CC BY notices; authored material geometry retains its BSD notice.

### Ellipse Engine

Owner-supplied arrangement originally dedicated under CC0; application
adaptation, native program and bilingual lessons: Copyright (c) 2026
CrispStrobe, BSD-3-Clause. The source fixture preserves the original CC0 grant
and inherited BSD notice. All 169 authored LEGO placements are retained.
Referenced official LDraw geometry keeps its separate authors and CC BY terms.

### Scale Echo and Turnwise

Original owner-supplied designs and native programs; application adaptations and
bilingual lessons: Copyright (c) 2026 CrispStrobe, BSD-3-Clause. Scale Echo's
original assembly has a separate CC0 dedication retained in its source fixture.
All 148 Scale Echo and 127 Turnwise placements are preserved. Referenced official
LDraw part geometry keeps its separate authors and CC BY terms. Archive runtimes,
generators and claimed validation reports are not included as application code.

### Counterturn and Snapgate

Owner-supplied original designs, native programs, adaptations and bilingual
lessons: Copyright (c) 2026 CrispStrobe, BSD-3-Clause. Full source grants and
inherited notices ship with each model. Counterturn retains 120 placements and
uses two small axial retainer clearances. Snapgate uses 205 CAD placements
(204 stock items: the cylinder and rod are components of one complete 9L shock),
a longer anchor axle and a retained rod-eye axle. Official LDraw geometry keeps
its separate authors and CC BY terms. Downloaded runtimes, generators and
claimed validation reports are not included as application code.

### Integral friction-wheel integrator

Original CrispStrobe model, program and bilingual lessons, BSD-3-Clause; see
`overlay/scratch-gui/static/sim-lab/licenses/integral.txt`. The 155 placements
reuse 63 base, drive, hub and platter placements from Orbital Loom, also by
CrispStrobe under BSD-3-Clause. Referenced LDraw parts retain their own notices.
The free output wheel is driven by native frictional contact. Native and browser
checks describe simulation behavior; physical hardware accuracy is unverified.

### Resonance Lab

Original one-motor assembly, three finite programs, construction guide and
bilingual lessons: Copyright (c) 2026 Christian Ströbele (CrispStrobe),
BSD-3-Clause. The LDR, MPD and programs retain the exact supplied source bytes;
the full grant ships in `static/sim-lab/licenses/resonance-lab.txt`. Original
source, construction details and hashes are retained under
`test/fixtures/model-files/resonance-lab-source/`. The assembly has 142 rigid
placements and two physical rubber-band loops (144 components). Standard LDraw
part geometry retains its separate authors and CC BY licences. No external
mechanism CAD, illustration, unlicensed or noncommercial asset was copied.
Original source-release measurements describe their recorded simulator revision;
application integration and hardware qualification remain separate evidence.

### Product Plotter, Sky Courier and Gimbal Lab

Original arrangements, finite programs, construction guides and bilingual
lessons: Copyright (c) 2026 CrispStrobe, BSD-3-Clause. The full grant ships
with each model in `static/sim-lab/licenses/`. The delivered LDraw models and
programs are used as supplied; the MPD variants are not shipped. Standard LDraw
part geometry retains its separate authors and CC BY licences. Supplier
measurements describe their recorded simulator revision; application
integration, browser operation and hardware construction remain separate
evidence.

### Offset Orbit

Original arrangement, finite program, mechanics derivation and bilingual
lessons: Copyright (c) 2026 CrispStrobe, BSD-3-Clause; the full grant ships in
`static/sim-lab/licenses/offset-orbit.txt`. The delivered revision uses two
parallel shafts 24 mm apart with a floating Oldham cross; the Huco mechanism
reference in the package is a citation, not copied content. Standard LDraw part
geometry retains its separate authors and CC BY licences.

### Circle Splitter

Original arrangement, finite program and bilingual lessons: Copyright (c) 2026
CrispStrobe, BSD-3-Clause; the full grant ships in
`static/sim-lab/licenses/circle-splitter.txt`. The Baez rolling-circles article
the package cites is a reference, not copied content. Standard LDraw part
geometry retains its separate authors and CC BY licences.

### Cusp Lab

Original CrispStrobe arrangement, program and bilingual lessons, BSD-3-Clause;
see `static/sim-lab/licenses/cusp-lab.txt`. The model uses 128 standard parts
and one motor. Its two real marker holes illustrate a cycloid cusp and a
prolate trochoid loop. Referenced LDraw geometry retains its separate notices.
Native/browser simulation and physical hardware construction are separate scopes.

### Balance Engine

Original regenerated CrispStrobe assembly and finite program, BSD-3-Clause;
see `static/sim-lab/licenses/balance-engine.txt`. The arrangement reuses the
previously licensed CrispStrobe Quickstroke construction patterns and adds
two independent drives and two centring bands: 292 rigid placements and two
physical bands (294 components). External LDraw meshes retain their notices.
Simulation parameters do not establish calibrated hardware rubber stiffness.

### Root Bridge

Original model and program by Christian Ströbele (CrispStrobe), BSD-3-Clause.
The repaired rails and supports preserve the input-only geometric-mean mechanism.
Full license: `overlay/scratch-gui/static/sim-lab/licenses/root-bridge.txt`.

### Watt’s Line and TwinTempo original models

Copyright (c) 2026 Christian Ströbele (CrispStrobe), BSD-3-Clause.
Models, programs and lessons are shipped with complete notices in
`static/sim-lab/licenses/watt-line.txt` and `static/sim-lab/licenses/twin-tempo.txt`.
External LDraw parts retain their existing separate attribution and licences.

### SineShuttle and Quartermaster

Original model and program designs by CrispStrobe, BSD-3-Clause. SineShuttle supplies the full grant; Quartermaster uses the owner-authorized BSD grant and retains its corrected Crossglide cradle credit. Individual notices: `static/sim-lab/licenses/sine-shuttle.txt` and `quartermaster.txt`. Standard LDraw part meshes retain their individual authors and licences.


### Experimental Technic checkpoint sources

Original user-owned models and programs by CrispStrobe, BSD-3-Clause. The twenty-one checkpoint sources are listed with original and canonical hashes in `docs/data/robot-lab-experimental-checkpoint.json`; individual full notices are under `static/sim-lab/licenses/`. These are experimental, not physically qualified library examples. Standard LDraw part drawings retain their existing authors and licences.


## Optional Brickwright CAD SDK

The optional CAD Editor is packaged from CrispStrobe/brickwright-cad under
BSD-3-Clause. Its exact source commit and file hashes are recorded in
`overlay/scratch-gui/static/cad-sdk/manifest.json`. The complete SDK license and
runtime dependency notices ship alongside it as `LICENSE` and `NOTICE.txt`,
including Three.js (MIT), Manifold (Apache-2.0) and the bundled font licenses.
The SDK is copied to the application only when `BW_ENABLE_CAD=1`.

The SDK also carries CrispCAD's optional exact B-rep kernel,
`@crispcad/exact-kernel` 0.1.11 (https://github.com/CrispStrobe/crispcad-kernel-lab,
release `exact-kernel-v0.1.11`), MIT AND Apache-2.0. It prebundles smlibwasm 0.6.2
(`@classcad/smlibwasm`, MIT, Copyright 2026 AWV Informatik AG), built from source
by the kernel lab with recorded provenance, with SMLib
and its SM_API wrapper from USD BRep (Apache-2.0, Copyright 2020-2026 NVIDIA
CORPORATION & AFFILIATES, a few files modified by AWV Informatik AG), the
Emscripten runtime (MIT) and the Brotli static dictionary (MIT); it contains no
OpenCASCADE code. Its NOTICE, LICENSE and full MIT and Apache-2.0 texts are part
of the SDK's `NOTICE.txt`. The kernel lives under `static/cad-sdk/assets/exact/`
and is fetched only when a user runs an exact feature, exact measurement, STEP
export, STEP import (also of assemblies), STEP evidence, a surface-blend
inspection, a drawing from exact edges (also its datums and tolerance frames), an
exact section, a manufacturing check or the faces offered for assembly mates
(from the CAD tab's File menu, its toolbar or the terminal); the service worker caches it only after such a request.

The optional Scout TT project generator retains the Adafruit CAD Parts MIT
notice at `licenses/adafruit-cad-parts-MIT.txt` (Copyright (c) 2016 Adafruit
Industries). Generated SB3 examples include that notice and Brickwright's
BSD-3-Clause license under `brickwright/licenses/`. The supplied CAD document
retains the exact motor source revision, conversion and attribution records.

## YoWASP Yosys — ISC (optional FPGA synthesis worker)

The existing optional FPGA worker imports `@yowasp/yosys`. It is now an explicit,
exact dependency at **0.71.188-dev.1267**, so a clean install can build that worker
without relying on a leftover package. It is separate from CAD co-simulation.
The package exposes the Yosys application through a virtual-filesystem API.
Copyright (C) Catherine <whitequark@whitequark.org>.

Upstream package and licence: [YoWASP/yosys](https://github.com/YoWASP/yosys),
[ISC licence](https://github.com/YoWASP/yosys/blob/develop/LICENSE.txt).
Yosys source and licence: [YosysHQ/yosys](https://github.com/YosysHQ/yosys),
[COPYING](https://github.com/YosysHQ/yosys/blob/main/COPYING).
The original notices are shipped at `static/licenses/yowasp-yosys.LICENSE.txt`
and `static/licenses/yosys.COPYING.txt`.

## Native benchmark startup and result helpers — MIT

The native benchmark panel mechanically mirrors the owned media-lab
`native-dos.mjs`, `benchmark-output.mjs` and `whetstone-result.mjs` helpers at
commit `01d06fb63d5bdd4c0ede48e811e8fc1f6971d2ce` from
https://github.com/CrispStrobe/brickwright-media-lab/tree/01d06fb63d5bdd4c0ede48e811e8fc1f6971d2ce/projects/x86-benchmarks.
Copyright (c) 2026 Brickwright contributors. The complete MIT notice is retained
beside the helpers and shipped as `static/licenses/native-benchmark-helpers.MIT.txt`.
Payloads are fetched only on explicit request; the panel displays their own
retained notices and exact provenance before Run.

## bw-native-benchmarks — MIT

Copyright (c) 2026 Brickwright contributors. The vendored benchmark sources and
full MIT licence ship in `overlay/scratch-gui/src/lib/bw-native-benchmarks/`
(`LICENSE`).
