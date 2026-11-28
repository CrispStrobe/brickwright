# Full SDL application bundles

The `sdl` profile packages the complete Linux SDL host from the pinned BBCSDL
revision in `sdl/upstream.lock.json`. It retains upstream graphics, pixel
readback, keyboard and mouse events, sound and envelopes, files, `TIME$`,
`EVAL`, raw memory, native `SYS`/`CALL`, OS commands and the target's inline
assembler. It embeds BASIC source and the interpreter; it does not translate
BASIC into another language.

The explicit `headless` profile remains available for terminal programs and the
restricted WASM worker. Its capabilities differ. A GUI program's direct
reference execution must use the full SDL host described here: SDL keyboard
input and display output are not the headless session's line-input protocol.

## Build a native runtime pack

On Debian or Ubuntu, install the target's GCC, SDL2 development/runtime packages,
zlib development package, and NASM for x64:

```sh
sudo apt-get install gcc nasm libsdl2-dev libsdl2-ttf-dev libsdl2-net-dev zlib1g-dev
node scripts/build-sdl-native.mjs
```

The output is `.build/sdl/native/linux-x64/runtime` on an x64 machine. The builder
uses `git show` to read the pinned commit, checks each source SHA-256, and works
in a separate directory. The upstream checkout is not patched. Source inputs
are reproducible; machine code also depends on the selected compiler and system
libraries.

Targets are `linux-x64`, `linux-arm64`, and `linux-armv7`. For example:

```sh
CRISP_BASIC_TARGET=linux-arm64 CC=aarch64-linux-gnu-gcc \
  CRISP_BASIC_SDL_PREFIX=/path/to/target/usr \
  node scripts/build-sdl-native.mjs
```

`CC`, `NASM`, `CRISP_BASIC_UPSTREAM`, `CRISP_BASIC_SDL_PREFIX` and
`CRISP_BASIC_SDL_LIBDIR` select the compiler, assembler, existing BBCSDL checkout,
target header/library prefix and library directory. Cross builds need an
explicit `CC` and matching SDL/zlib target libraries. The default library
directory is `PREFIX/lib/<target-triplet>`. A custom prefix must include the
SDL development packages' `share/doc/*/copyright` notices; packaging refuses
to omit these redistribution notices.

**ARMv7 requires NEON and the hard-float ABI**, matching upstream's full SDL
audio mixer. The headless ARMv7 profile requires only VFPv3-D16. The runtime
receipt and bundle metadata record the full host's CPU requirement.

## Package and run

```sh
crispbasic bundle demo.bas --profile sdl --target linux-x64 \
  --runtime-pack .build/sdl/native/linux-x64/runtime --output demo
./demo
./demo --bundle-info
```

The single ELF file contains the interpreter, SDL2, SDL2_ttf, SDL2_net,
`libstb`, BASIC source, explicit application resources, metadata and notices.
A matching launcher is already compiled into the runtime pack, so packaging
does not require GCC. Runtime and launcher hashes are checked against the pack
receipt, along with ELF class, machine and ARM hard-float ABI.

The launcher extracts ordinary files into a new private directory under
`TMPDIR` or `/tmp`, executes the runtime, waits and removes that directory.
The temporary filesystem must allow execution. No separate BASIC interpreter
or Node.js installation is required to run the resulting application. Normal
platform dependencies remain: a compatible Linux loader/glibc, zlib, FreeType,
HarfBuzz, and the graphics/audio/input dependencies and drivers of the selected
SDL build. These dependencies appear in the receipt and `--bundle-info`;
the application is not statically linked. Optional shared libraries such as
Box2D are not automatically discovered or bundled.

`PRINT` and VDU output render in the SDL window. Input uses SDL's keyboard and
event system. `END` and source fallthrough close the application; `QUIT`
preserves the exit status. `ON ERROR` remains active, and completing an error
handler still closes the application. There is no artificial execution deadline
or output limit. The launcher forwards SIGINT, SIGTERM and SIGHUP and cleans up
after normal child termination.

## Files and resources

Supply each resource explicitly:

```sh
crispbasic bundle demo.bas --profile sdl \
  --asset assets/picture.png=images/picture.png \
  --asset assets/data.bin=data/input.bin --output demo
```

The program can use `OPENIN(@dir$+"data/input.bin")`. Asset paths must be
relative, cannot contain parent/control segments, and cannot replace the
embedded program. Resources continue to work after relocating the executable
and deleting their original source files. Fonts and BASIC libraries are
explicit resources too; their licenses remain the distributor's responsibility.
No optional fonts, libraries or application data are inferred from source text.

Ordinary relative file operations preserve the **caller working directory**.
For example, `OPENOUT("result.bin")` writes where the user launched the program.
`@dir$` points to the extracted source and resources. Files written there are
temporary and removed at exit. `@lib$` points to the runtime's `lib/` directory;
a custom runtime pack can include additional libraries there, with their hashes
and notices recorded in its receipt.

## Direct source execution and byte parity

Run numbered or unnumbered source through the full SDL host:

```sh
node scripts/run-sdl-native.mjs demo.bas
```

The runner preserves the original program directory for `@dir$` and the caller
working directory for external files. It prepares temporary numbered Latin-1
source using the same `prepareSource` function as bundling; BBCSDL's original
`lexan` tokenizes both. `CRISP_BASIC_SDL_RUNTIME_PACK` selects a nondefault pack.

An optional raw VDU tee captures bytes while retaining the real display queue:

```sh
CRISP_BASIC_VDU_STDOUT=1 node scripts/run-sdl-native.mjs demo.bas > source.vdu
CRISP_BASIC_VDU_STDOUT=1 ./demo > bundled.vdu
cmp source.vdu bundled.vdu
```

The output includes CR/LF, control characters, NUL and high-bit bytes. It is
neither screenshot data nor UTF-8-normalized terminal text. Time, random seeds,
pointer state, paths and other external inputs must be controlled or excluded
from deterministic byte comparisons. This comparison uses the same interpreter
and demonstrates that packaging preserves execution. The independent C99
compiler has a separate differential corpus.

## Qualification

```sh
node --test tests/bundle-sdl.test.mjs
```

The dedicated suite fails if its selected runtime pack is absent. It compares
direct source and relocated single-file applications, checking drawing and
`POINT`, real sound/envelope queue completion, SDL `SYS`, `EVAL`, memory access,
the target's inline assembly/`USR`, `TIME$`, mouse access, error trapping, external files,
embedded resources, direct source runner semantics, exit statuses and cleanup.

The recorded qualification on 2026-11-28 is **36 tests passed, zero failures and
zero skips**:

| Target | Execution environment | Result |
| --- | --- | --- |
| Linux x64 | Native x86-64 | 12/12 passed |
| Linux ARMv7 | QEMU 10.0.13, Cortex-A7 | 12/12 passed |
| Linux ARM64 | QEMU 10.0.13, Cortex-A53 | 12/12 passed |

All three suites assemble and execute target machine code through `USR`, using
an explicitly four-byte-aligned entry address. The builds used Debian GCC
14.2.0-19 and the pinned BBCSDL revision. The tracked
[`validation/native-bundles.json`](validation/native-bundles.json) records the
input hashes, runtime and launcher hashes, target CPUs, results and limits.
ARM execution is CPU emulation; physical ARM hardware was not used.

Tests default to SDL's offscreen video driver, software renderer and dummy audio
device. Applications retain upstream's normal desktop renderer selection. The
software renderer is used because this workspace's offscreen OpenGL readback
was unstable even for direct source execution. Dummy audio verifies queue and
mixer behavior without claiming audible speaker output. Physical keyboard,
pointer and speaker behavior requires desktop/hardware qualification.

Cross-target execution uses the native suite's explicit runner settings. When
matching ARMhf dependencies are installed in normal system multiarch locations:

```sh
CRISP_BASIC_TEST_NATIVE_TARGET=linux-armv7 \
CRISP_BASIC_SDL_RUNTIME_PACK=.build/sdl/native/linux-armv7/runtime \
CRISP_BASIC_TEST_NATIVE_RUNNER='{"executable":"qemu-arm","args":["-cpu","cortex-a7","-L","/"]}' \
  node --test tests/bundle-sdl.test.mjs
```

For an isolated target filesystem, replace the `-L` argument with that root;
it must contain the target loader and the runtime's shared-library dependencies.
The harness passes the emulator's argument vector to both the outer launcher
and its extracted interpreter, without requiring global binfmt registration.
For the direct source runner, `CRISP_BASIC_SDL_RUNNER` accepts the same JSON
object; set `CRISP_BASIC_TARGET` or the explicit pack. These are testing and
development inputs. Native applications execute their interpreter directly.

The adaptations in `sdl/patch-upstream.mjs` are limited to source transport,
optional program/caller directory overrides, optional raw VDU capture and
application lifetime. They retain the upstream graphics/audio, file handling,
native call dispatch, assembler, expressions and statements.
