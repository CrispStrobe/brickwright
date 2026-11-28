# Compile BBC BASIC to C99

The Code tab offers **Compile BASIC** for the CrispBASIC BBC profile and a
**BBC BASIC (compiled C99)** profile for Arduino Uno/ATmega328P and Pico.
Compilation uses the independent compiler in
[CrispStrobe/crispbasic](https://github.com/CrispStrobe/crispbasic).
It passes the edited BASIC directly to that compiler, retains the authored
BASIC document, and adds C as a generated view. Unsupported syntax produces a
physical source-line diagnostic; a failed or stale request cannot replace
the source.

## Compiler assets in ordinary builds

The standalone repository owns the compiler. The interpreter extraction in
`packages/crisp-basic` is not overwritten by this integration.

`npm run integrate`, `npm run build:gui`, and `npm run build:gui:force` stage
the compiler automatically. `crispbasic-compiler.lock.json` records the exact
standalone repository commit and the SHA-256 and byte count of every source
and license file. The packager fetches that commit into
`.build/crispbasic-compiler/`; it does not follow a branch or execute package
installation scripts. It verifies all five files before replacing staged
assets. A valid staged package or an existing immutable source cache can be
used for an offline incremental build.

The individual preparation and verification commands are:

```sh
npm run package:crispbasic:compiler
npm run package:crispbasic:compiler:check
```

The stage contains five original source/license files and a SHA-256 manifest under
`packages/scratch-gui/static/crispbasic-compiler/`. Modules are loaded only
when the user selects Compile BASIC. Missing compiler assets produce a
specific setup diagnostic; the editor does not substitute another compiler.

To use an existing checkout or package as the source location, pass
`npm run package:crispbasic:compiler -- --package /path/to/crispbasic`.
Its files must still match the reviewed lock. Changing compiler revisions
requires updating the commit and hashes together. The supplied package must
contain `src/compiler/index.mjs`, `runtime.mjs`, `platform.mjs`, its source
normalizer and license.

CI tests immutable fetching, branch drift, offline cache rebuilding, hash
failures, and editor behavior. Production CI verifies the emitted compiler
assets again after webpack copies them into the final app.

## Existing C routes

On an Uno, the generated C's **Build C and emulate** action uses the existing
hosted C compilation seam and hands the resulting Intel HEX to the same
AVR firmware path as other C programs. The ordinary flash action accepts the
generated C too. It stays an explicit user action; compiling to C does not
flash anything. Requests select ATmega328P, C99, 16 MHz and the required
`-mdouble=64 -mlong-double=64` flags. An older hosted AVR GCC installation
that lacks binary64 support fails visibly. No reduced-precision fallback is
used. Successful compilation by itself is reported as build evidence, not
simulator or physical-device evidence.

Pico output requires the Pico SDK. The existing hosted RP2040 C route uses an
SRAM-only linker layout and does not supply that SDK. The guard therefore
refuses that route before a network request. Build using
`crispbasic compile program.bas --target pico --pico-sdk PATH`, then use the
existing firmware loader for the generated UF2/ELF. The Pico interpreter and
UART listing-upload routes remain separate choices.

For native C, save the generated source and compile it with GCC, or use the
standalone `crispbasic compile` command. The browser does not claim to have
executed a native executable merely because it generated C.

## Checks

```sh
node --test test/crispbasic-compiler*.test.mjs test/code-device-languages.test.mjs
```

The focused suite exercises the actual editor/document methods, target and
service routing, physical-line failures, stale asynchronous loads, source
retention, and exact tracked mirrors. The complete importer JSX was parsed
with esbuild, and staging plus loading the real standalone compiler was
checked. This is not a complete production-browser or hosted-service proof.

The standalone repository's `scripts/verify-compiler-boards.mjs` independently
executes its BASIC pin fixture through BBCSDL, compiles firmware, and checks
two cold boots in Brickwright's pinned AVR and RP2040 simulators. See its
`COMPILING-BOARDS.md` for the source pins, commands, timing tolerance, observed
trace results and qualification limits.
