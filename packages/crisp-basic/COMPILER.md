# Compiling BBC BASIC to C99

`crispbasic compile` translates a defined, structured BBC BASIC subset into a
self-contained C translation unit and invokes a real C toolchain. Generated
programs contain C statements, C functions, and a small support runtime. They do
not contain the BBCSDL interpreter, tokenized BASIC, an evaluator, or a bytecode
dispatch loop.

Use [`bundle`](BUNDLING.md) when the program needs the interpreter's broader
language surface. Compilation and interpreter bundling are separate routes.

## Commands

From a checkout:

```sh
node bin/crispbasic.mjs compile examples/structured.bas -o ./structured
./structured

# Inspect or integrate the generated translation unit without a toolchain.
node bin/crispbasic.mjs compile examples/structured.bas --emit-c -o ./structured.c
gcc -std=c99 -O2 structured.c -lm -o structured

# Board toolchains produce normal firmware artifacts.
node bin/crispbasic.mjs compile examples/compiler/pins.bas --target pico \
  --pico-sdk /path/to/pico-sdk -o ./pins.uf2
node bin/crispbasic.mjs compile examples/compiler/pins.bas --target arduino-uno \
  -o ./pins.hex
```

The native command writes the generated `.c` beside the executable. Pico keeps
UF2, ELF and BIN artifacts; Uno keeps Intel HEX and ELF. `--json` returns source
diagnostics, artifact paths and build evidence. `--cc` selects an executable
without shell interpolation. `--build-dir` retains the toolchain project for
inspection. `compile --help` lists all options.

Pico uses an existing pico-sdk checkout and its GCC toolchain. Its SDK-facing
project uses C11 because current SDK headers require it; the generated language
and support runtime use C99. Uno uses AVR GCC/avr-libc with 64-bit `double`
support (`-mdouble=64 -mlong-double=64`) and GCC's libf7 arithmetic and math
symbols; GCC 14.2 is the qualified AVR toolchain. Older toolchains that provide only
32-bit floating point or omit that runtime are refused with a toolchain diagnostic. The generated C
also contains C99-compatible floating-format and `sizeof(double)` checks,
so compiling `--emit-c` output with incompatible defaults cannot
silently reduce its precision. The Uno link checks flash and static RAM usage
and reserves 512 bytes for stack; that
reservation is not proof that an arbitrary recursive or allocation-heavy
program fits the board.

## Supported language

Source uses the same Latin-1 preparation and physical-line mapping as the
interpreter frontend. Optional BASIC line numbers must be consistent and
increasing. Keywords retain BBC BASIC's uppercase spelling; names retain their
case. Decimal exponent syntax uses uppercase `E`.

| Area | Compiled syntax and behavior |
| --- | --- |
| Variables | Default numeric variables, double variables ending in `#`, 32-bit integer variables ending in `%`, and strings ending in `$`. Extended-profile native programs also accept `%%` integer variables. |
| Expressions | Arithmetic, signed `DIV`/`MOD`, exponentiation, comparisons, `AND`/`OR`/`EOR`/`NOT`, and shifts. Operands are evaluated in source order. True is `-1`; false is `0`. |
| Assignment | `=`, `+=`, `-=`, `*=`, `/=` and optional `LET`. Numeric conversion and overflow checks follow the target interpreter rather than relying on C signed overflow. |
| Arrays | `DIM` with inclusive upper bounds and one or more dimensions; numeric, integer and string elements; computed subscripts; runtime dimension and bounds checks. |
| Procedures/functions | `DEF PROCname(...)`, `PROCname(...)`, `ENDPROC`, `DEF FNname(...)`, single-line `= expression` results, multiline functions, recursion and scalar parameters. Zero-argument calls may omit parentheses. |
| Local scope | Scalar `LOCAL` and `LOCAL array%()` followed by `DIM`. Parameters and locals have BBC BASIC's dynamic scope, with saved bindings restored on return. Parameter bindings are captured before argument side effects. |
| Conditionals | Inline and block `IF ... THEN ... ELSE`, `ENDIF`, and `CASE ... OF` with comma-separated `WHEN` values, optional `OTHERWISE`, and `ENDCASE`. The selector is evaluated once. |
| Loops | `FOR ... TO ... STEP ... NEXT`, `WHILE ... ENDWHILE`, `REPEAT ... UNTIL`, and `EXIT FOR`/`WHILE`/`REPEAT`. A `NEXT` list can close matching nested loops. `FOR` captures typed bounds and step on entry, preserves post-test entry behavior, and compares the incremented value before storage conversion. |
| Output | `PRINT`, semicolon/comma separators, apostrophe newlines and hexadecimal `~`. Numeric fields, CRLF, Latin-1 and embedded NUL string bytes are preserved. A nested `PRINT` inside a function retains its caller's formatting state. |
| Input | `INPUT`, a leading literal prompt, comma-separated targets, numeric/string input and `INPUT LINE`. Quoted fields support doubled quotes. |
| Strings | `ASC`, `CHR$`, `LEN`, `LEFT$`, `RIGHT$`, `MID$`, `STRING$`, `INSTR`, `STR$`, hexadecimal `STR$~`, and `VAL`. Strings carry an explicit byte length. |
| Maths | `ABS`, `ACS`, `ASN`, `ATN`, `COS`, `DEG`, `EXP`, `INT`, `LN`, `LOG`, `PI`, `RAD`, `SGN`, `SIN`, `SQR`, `TAN`, and `RND`. Seeded random sequences can be compared deterministically. |
| Time/termination | Read/write numeric `TIME` in centiseconds, `END`, `QUIT` and explicit `ERROR`. Unhandled runtime errors terminate with a line diagnostic. |
| Portable pins | `PROCpinMode`, `PROCdigitalWrite`, `PROCdigitalToggle`, `FNdigitalRead`, `PROCdelay` and `FNmillis`. |

The compiler's parser is independent of the BBCSDL tokenizer/parser. In
particular, it preserves BBC's unary-operator binding and left-associative
exponentiation, signed radix literals, predefined zero-valued `A%` through
`Z%`, string slice boundary rules and decimal-only `VAL` behavior. These rules
have dedicated interpreter comparisons; familiar C operator behavior is not
used as a substitute for BASIC semantics.

Definitions must follow an unconditional top-level `END` or `QUIT`. This avoids
silently changing a program that actually executes into a definition in the
interpreter. An `END` inside a conditional is not taken as proof of termination.

## Refusals and current boundaries

Compilation fails before emitting C when it encounters `EVAL`, inline assembly,
indirection (`!`, `?`, `$` and related forms), raw-memory `DIM`, dynamic program
or library loading, native `CALL`/`USR`, `SYS`, `OSCLI`, or star OS commands. It
does not replace these with no-ops or interpreter calls. The full source is
checked, including unreachable statements.

Other syntax outside the table also receives a source diagnostic. Current
examples include `GOTO`/`GOSUB`, `DATA`/`READ`/`RESTORE`, `ON ERROR`, file/graphics/
sound operations, interpreter formatting-system variables, whole-array
expressions and array parameters. `STOP` is refused because its interpreter
diagnostic behavior differs from plain program termination; use `END` where
normal termination is intended. `INPUT` forms with multiple embedded prompt
segments are outside the supported input grammar.

An `INPUT` target subscript may call an ordinary function. If that function (or
a function/procedure it calls) can itself execute `INPUT`, compilation refuses
the reentrant input-buffer behavior. Evaluate that index in a preceding BASIC
statement to make the order explicit. Unsupported constructs are diagnosed at
the source, never left for accidental C parsing or silently skipped.

A diagnostic contains the filename, physical editor line, column, BASIC line
number and an error code. Runtime-only conditions such as an out-of-range
subscript, undefined variable, division by zero or exhausted memory are checked
by the generated support runtime. A successful compilation is not a proof that
every runtime path will complete.

## Numeric profiles

BBCSDL itself uses different floating representations on its supported CPU
families. The compiler makes that choice explicit instead of presenting one
host's arithmetic as universal:

| Profile | Representation | Independent reference used by tests |
| --- | --- | --- |
| `native-bbcsdl` | Extended `long double` on x64; binary64 on ARM/ARM64/WASM, selected in generated C | Native BBCSDL on the matching host |
| `binary64` | 64-bit IEEE `double`, including its math and number formatting paths | BBCSDL WASM's binary64 evaluator |
| `extended` | Explicit host `long double` | Native x64 BBCSDL |

Pico and Uno select `binary64`. `#` variables store a double in every profile,
including BBCSDL's stored-zero representation. Integer expression values have
a separate signed 64-bit representation. Unsuffixed variables, arrays, scalar
parameters and `LOCAL` bindings retain that integer tag; assigning an exact
integer above 2^53 does not silently round it through binary64. Ordinary `%`
arithmetic likewise retains exact intermediate integers before its checked
32-bit assignment conversion. The explicit binary64 profile currently refuses
`%%` variable declarations with a source diagnostic; it does not claim complete
wide-integer variable/loop support on those targets.

Decimal literals and `VAL` use the same original numeric-text routine. It
preserves integer results and follows BBCSDL's separate whole/fraction scaling
and exponent conversion. Substituting a host's `strtod` would change observable
rounding and overflow boundaries. These cases, integer-returning functions,
64-bit shift intermediates and typed `FOR` bounds have differential fixtures
for both profiles.

For Pico, the build selects the compiler's full double and `printf`
implementations instead of the SDK's compact alternatives. For Uno, an original
binary64 decimal formatter and GCC libf7 packing adapter preserve subnormals
and nearest-even rounding. Independent host cases and actual MCU UART output
check these paths; see [COMPILING-BOARDS.md](COMPILING-BOARDS.md). Generated
statement scopes let AVR GCC reuse temporary stack storage between statements.

Real wall-clock timing and unseeded randomness are not deterministic test
outputs. Tests seed `RND` and check `TIME` invariants rather than comparing two
different runs' elapsed time as though they happened simultaneously.

## Portable pin behavior

The pin API uses the existing BASIC signatures:

```basic
PROCpinMode(13,"output")
FOR pulse%=1 TO 3
  PROCdigitalWrite(13,1)
  PROCdelay(20)
  PROCdigitalToggle(13)
  PROCdelay(20)
NEXT
PRINT FNmillis
END
```

Native generated programs provide a deterministic logical host with pins
0..255, retained output latches, pull-up input reads and an explicit millisecond
clock. Reading a floating input or writing an input pin is an error. Set
`CRISPBASIC_TRACE=/path/to/events.jsonl` to record pin operations and delays.
`PROCdelay` advances this logical clock; native `TIME` continues to use elapsed
host time independently.

The Pico adapter calls pico-sdk GPIO/time functions and uses UART stdio. The
Uno adapter uses the ATmega328P GPIO ports, UART0 and Timer0. Board pin numbers
refer to their actual target pin maps; `FNmillis` and delays use target time.
The generated firmware goes through the same ELF/HEX/UF2 formats expected by
the existing flash and emulation routes.

Building firmware is recorded as **build-only** until a simulator or physical
board actually runs it. The board verification script accepts Brickwright's
checkout, runs supported emulators and compares observed pin transitions where
available; unavailable emulator routes remain explicitly build-only. A native
logical pin trace is not described as an AVR or RP2040 CPU simulation.

## Browser and JavaScript API

The frontend is browser-safe: it uses no Node filesystem APIs, external process,
network request or interpreter. Its platform and runtime sources are normal
module strings. Brickwright can therefore generate C in its existing browser
editor before handing it to the ordinary build/flash/emulate routes.

```js
import {compileSource, CompileError} from '@crispstrobe/crispbasic/compiler';

try {
    const result = compileSource('PRINT "hello"\nEND\n', {
        filename: 'hello.bas',
        target: 'native',
        numericProfile: 'native-bbcsdl'
    });
    // result.c is the complete translation unit.
    // result.sourceMap maps BASIC numbers to physical editor lines.
    // result.metadata records the target, profile and independent compiler.
} catch (error) {
    if (error instanceof CompileError) console.error(error.diagnostics);
    else throw error;
}
```

`target` is `native`, `pico` or `arduino-uno`. Omit `numericProfile` to use the
target default. `numericProfile: 'binary64'` with the native platform also lets
the host test runner execute the board arithmetic profile without pretending
to execute firmware.

## Evidence and clean-room boundary

```sh
npm run test:compiler
npm run test:compiler:parity
npm run test:compiler:wasm-parity
```

The differential suites compile generated C with GCC, execute it independently,
execute the source in the real BBCSDL core, and compare stdout as bytes. The
same core does not implement both sides. The native and binary64 suites have
separate reference backends and backend-specific entrypoints. Missing required runtime/toolchain artifacts are
failures, not passing skips. Regression tests cover source refusals, actual
runtime failures and retained allocation counts around recursive/local and
string `CASE` paths.

The compiler was written without studying or copying ABC, !BBC_C, or any other
proprietary compiler. BBCSDL's permitted zlib source was used for interpreter
builds and semantic reference (including the `RND` sequence), alongside direct
language probes. The compiler lexer, parser, C generator and support runtime are
original BSD-3-Clause code. Existing BBCSDL notices remain in the interpreter
builds and [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).

Passing a corpus is evidence about the tested behavior, not a claim that every
possible BBC BASIC program or every resource-constrained board program has
been proven equivalent. The supported syntax, explicit refusals, target
profiles and recorded execution evidence define the current contract.
