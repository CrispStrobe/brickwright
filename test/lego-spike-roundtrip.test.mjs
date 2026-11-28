import {test} from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {readFileSync} from 'node:fs';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator.js';


const PROGRAM = `DEVICE SPIKE

GLOBAL dist = 0

WHEN flag clicked:
  start motor A forward
  wait 250 ms
  set dist to spike distance B
  display text "GO"
  stop motor A
`;

const projectFrom = async bytes => JSON.parse(await (await JSZip.loadAsync(bytes))
    .file('project.json').async('string'));

test('vendored SPIKE compiler emits a canonical executable round-trip artifact', async () => {
    // The pin is asserted so a vendor bump cannot pass this file by accident:
    // whoever moves it re-reads the assertions below against the new compiler.
    // 4134b86 -> eb5b286 -> fdd9d7d -> b27da5a -> 73ac0b1 -> c20e434 -> 7952b31 -> ea30b80 -> 0a05c9c -> 414e8ef -> 365bf18 -> 5d17288 -> 42f5d92 -> 2a0280e -> d0b9e78 -> 01ed06a -> c8791ee -> a40a60d (P3/P2 shiftOut MicroPython driver; no SPIKE emitter change) (general not-equal parser repair and i8086 commented-zero refusal; no SPIKE emitter change) (N2d: SmallerC-safe i8086 minimum-int spelling; no SPIKE emitter change) (N2d: strict numeric-only i8086 C print; no SPIKE emitter change) (N2c: the i8086 toggle repair needed by two newly reachable wait programs; no SPIKE emitter change) (N2c: literal 8086 C waits; no SPIKE emitter change) (N2b step 2: i8086 numbers are a 16-bit int with refuse-by-name; goldens prove no other family moved a byte; no SPIKE emitter change) (P2 cont.: motor and servo each split into one protocol over per-family bus, byte-identical; no SPIKE emitter change) (0a05c9c P2: shift_out as one protocol over per-family bus, i8086 bus added) (2026-09-06: i8086 pins through the 8255 in generateC; the 64-byte raw-REPL write chunking moved upstream) on 2026-09-05: reader fixes (bitwise/shift,
    // MicroPython runtime skip, body fidelity, condition lift, loops) and one
    // emitter change (the STC driver is emitted for micro:bit/Pico targets so
    // STC pins resolve). Nothing in the SPIKE emitter changed; the artifact
    // assertions below were re-run at each pin.
    // -> 0a0e82e on 2026-09-08: the i8086-blink gallery example vendored, and
    // sb3-creator's tone work (setTone/tone_set, emitted AVR-only) rode the shared
    // pin. Neither touches the SPIKE emitter; this artifact is byte-identical and
    // was re-run at the new pin.
    // -> 6bda3b3 on 2026-09-08: the LED-polarity correction. This bump is the
    // rare one that carries NO emitter risk at all, and that is measured rather
    // than assumed: `git diff --name-only 0a0e82e 6bda3b3 -- src/` is EMPTY, so
    // every vendored `src/lib/sb3-creator*.js` file is byte-identical across it
    // and the sync reports `ok` for all of them. What moves is 135
    // `examples/**/circuit*.json` (69 benches re-wired to their target's output
    // polarity plus their 66 board-free twins), three generator scripts and one
    // manifest, none of which this file reads. The artifact assertions below
    // were re-run at the new pin regardless.
    // -> 8c17dfa on 2026-09-08: N2e adds bounded numeric lists only to the
    // i8086 C route. The SPIKE emitter is unchanged; this artifact is re-run
    // here rather than inferred from that scope statement.
    // -> e3ecc205e on 2026-09-08: P3 part 3 adds servo and DC-motor MicroPython
    // drivers for the Pico (upstream PR #11). MEASURED, not assumed: the range
    // `8c17dfa..e3ecc205e` touches ONE source file and ZERO examples, so this is
    // the rare pin bump with no gallery churn — no re-sync, no polarity or
    // flat-twin re-derivation. The servo/motor formula and clamp are rendered
    // from one shared body with the C arm, and the MicroPython arm is asserted
    // to within one `duty_u16` LSB of it rather than bit-exact, because the two
    // APIs have different resolutions over the 20 ms frame. Nothing in the SPIKE
    // emitter changed; the artifact assertions below were re-run at the new pin.
    // -> 5a0d559 on 2026-09-08: N2f adds deterministic bounded random and
    // direct-literal output to the i8086 C route. The SPIKE emitter is
    // unchanged; this artifact is re-run here rather than inferred from scope.
    // -> 33ab265 on 2026-09-08: 8051 debug builds make their scheduler state
    // and deadline volatile so SDCC must give the debugger linked RAM symbols;
    // release 8051 output and every other target retain their prior policy.
    // The SPIKE artifact below was re-run and remains byte-for-byte unchanged.
    // -> 9173ca75 on 2026-09-08: the active-low lesson repair and its follow-up
    // measurement corrections touch zero files under src/ through c593574;
    // the later range only converges the already-present examples catalogue
    // and adds upstream tests. The compiler emitter therefore does not move,
    // while this assertion still forces the round-trip artifact at the pin.
    // -> 2be3fe2b on 2026-09-20: this range DOES move the emitter — the SPIKE
    // consolidation rewrites `runtimeRegistry.generated.js` and
    // `spikeprimeDialect.js` (179 lines across two files under src/), which is
    // exactly why this assertion forces the round-trip artifact to be re-run at
    // the new pin rather than carried over. The rest of the range is the
    // examples work: 26 benches rebuilt from their programs, and three new
    // Codex trails for the digital and MCU domain.
    // -> 06a78ba2 on 2026-09-20: adds `PART <name> = SERVO|MOTOR <channel>` and
    // resolves a declared name at all seven actuator operand sites, so the
    // emitter changes again and the artifact is re-run, not carried over.
    // -> 8e1f4d11 on 2026-09-21: `git diff --name-only 06a78ba2 8e1f4d11 -- src/`
    // names ONE file, sb3Creator.js, and the change is the missing half of that
    // same feature: the DECOMPILER had no branch for the new part types, so it
    // fell through to the 74HC595 writer and threw on p.data for every retarget
    // of a program with a declared servo. The SPIKE emitter is untouched by it,
    // and the artifact below was re-run at the new pin rather than carried over.
    // The rest of the range is example data and gate repairs.
    // -> 830002ca on 2026-09-21: sb3-creator's CI siblings move to the engine
    // THIS APP ALREADY SHIPS — bw-board 1,409 commits forward, bw-circuit-ui 337
    // — and 37 numbers across its gallery are re-derived because an LED is now
    // solved on its junction instead of clamped at a knee. MEASURED, not
    // inferred: `git diff --name-only 8e1f4d11 830002ca -- src/` is EMPTY, so
    // every vendored compiler file is byte-identical across the range and the
    // SPIKE emitter cannot have moved. The artifact below is re-run at the new
    // pin regardless, which is the rule this assertion exists to enforce.
    // -> b7bfd2b71 on 2026-09-21: this range DOES move the emitter, and by
    // exactly one thing. MEASURED, not inferred: `git diff 830002ca b7bfd2b
    // -- src/` names ONE file, sb3Creator.js, and its 31 changed lines
    // content-hash identical to the escape fix alone (sb3-creator#21), so
    // nothing else in the range touched a vendored byte -- #17, #18, #19 and
    // #20 are gate and example work. What the fix changes: `display text
    // "..."` was parsed with `"([^"]*)"`, which stops at the first quote, so
    // a line carrying an escaped quote failed its own rule and fell through
    // to the GENERIC display handler -- a SPIKE program silently got a
    // micro:bit block, with no warning. The quieter half doubled a backslash
    // in the stored value, so `C:\path` was saved as `C:\\path`: corruption
    // rather than a parse failure, on every save. The decompiler now escapes
    // what it emits so the round trip closes. The artifact assertions below
    // were re-run at this pin, and test/transpiler-codegen.test.mjs now
    // asserts that no SPIKE program emits another device's block -- the
    // sentinel that was standing for this defect fired on the bump and was
    // replaced by that positive assertion.
    // PIN MOVED b7bfd2b7 -> 44d23f88 (2026-09-23), and the artifact assertions
    // below were re-run at it. What this bump costs is nothing, and that is
    // checked rather than hoped: `git diff --name-only b7bfd2b7..44d23f88`
    // names FIVE files — four under examples/ (sb3-creator#23, the AND and OR
    // gate lessons written as single boolean expressions instead of nested
    // IFs) and one under test/ (#22, driving ldr and ntc as continuous
    // controls). NO src/ FILE CHANGED, so the vendored sb3Creator.js is
    // byte-identical across the range and nothing the round trip reads can
    // have moved. The assertions below were still executed at the new pin.
    // PIN MOVED 44d23f88 -> 4a3996b9 (2026-09-25, sb3-creator#24): src/ DID
    // change this time — MakeCode's led/game helpers for generateMicroPython,
    // each emitted only when a microbitplus block uses it. None of the SPIKE
    // paths this round trip reads are touched; the assertions re-ran at it.
    // PIN MOVED 4a3996b9 -> 5546e6fb (2026-09-27, sb3-creator#25/#26):
    // ATtiny88 GPIO/ADC metadata, generated benches, and the Blinkenrocket
    // QFN32 circuit/licence boundary changed. The SPIKE compiler path is
    // unchanged, and this complete artifact round trip was re-run at the pin.
    // PIN MOVED 5546e6fb -> 48e2f174 (2026-09-27, sb3-creator#27): MakeCode
    // radio hats, music, the yield-less task guard, the json fallback and
    // off-grid plots in generateMicroPython — all micro:bit-only, none on the
    // SPIKE path this round trip reads. The assertions re-ran at the pin.
    // PIN MOVED 48e2f174 -> 5b98a28c (2026-09-27, sb3-creator#28): `show leds`
    // and `show icon` for micro:bit MicroPython only; the SPIKE path is
    // untouched, and the assertions re-ran at the pin.
    // PIN MOVED 5b98a28c -> fafa1fcd (2026-09-28, sb3-creator#30 LED sprites and
    // #29 sound/logo/signal strength): micro:bit MicroPython only; the SPIKE
    // path is untouched, and the assertions re-ran at the pin.
    // PIN MOVED fafa1fcd -> c5ffaf0a (2026-09-28, sb3-creator#31): a micro:bit
    // forever waits 20 ms after every pass — micro:bit MicroPython only; the
    // SPIKE path is untouched, and the assertions re-ran at the pin.
    // PIN MOVED c5ffaf0a -> d33fa40b (2026-09-28, sb3-creator#32): `show number`,
    // MakeCode's blocking showNumber — micro:bit MicroPython only; the SPIKE
    // path is untouched, and the assertions re-ran at the pin.
    // PIN MOVED d33fa40b -> 1cdc4fb5 (2026-09-28, sb3-creator#34): the SPIKE
    // driving-base words (set movement motors/speed, start moving steering,
    // start tank) plus one board-preset gallery example. The SPIKE path gains
    // four words and changes none this round trip reads; the assertions re-ran
    // at the pin.
    // PIN MOVED 1cdc4fb5 -> fa8739e2 (2026-09-28, sb3-creator#35/#36): SPIKE App 3
    // Python reader and exporter plus eight SPIKE dialect words (#35), and the
    // PRECHIN A2 preset's layout with the revision sha dropped from its intros
    // (#36). The words are additions; none of the SPIKE lines this round trip
    // reads changed, and the assertions re-ran at the pin.
    // PIN MOVED fa8739e2 -> 041ec7dc (2026-09-28, sb3-creator#37): i8086-blink's
    // 18 origin-stacked parts given coordinates. This is the rare bump that
    // carries NO emitter risk at all, and it is MEASURED rather than asserted:
    // `git diff --name-only fa8739e22 041ec7dc1 -- src/` is EMPTY, and the whole
    // range is one commit touching one file, examples/i8086-blink/circuit.json.
    // So every vendored src/lib/sb3-creator*.js is byte-identical across it and
    // no SPIKE line this round trip reads can have moved. Assertions re-ran at
    // the pin regardless, because an empty src/ diff is the reason to believe
    // that and not a substitute for checking.
    // PIN MOVED 041ec7dc -> 5c20cc83 (2026-09-29, sb3-creator#38): MakeCode's
    // images as values, radio serial numbers, the sound hat, plotBrightness/
    // point and parseFloat — micro:bit MicroPython and dialect words only,
    // plus the arrays shim's `set` growing the array. The SPIKE path is
    // untouched, and the assertions re-ran at the pin.
    // PIN MOVED 5c20cc83 -> b58a2254 (2026-09-29, sb3-creator#39): the DEVICE
    // EV3 words (ev3Dialect.js). Its command words exist on DEVICE EV3 only and
    // its reporters all start `ev3`, so no SPIKE line can read differently;
    // the assertions re-ran at the pin.
    // PIN MOVED b58a2254 -> a2032f71 (2026-09-29, sb3-creator#40, task D1):
    // this one DOES touch the SPIKE path. It adds five SPIKE words (gyro rate,
    // raw colour channel, centre light, volume, distance lights) and closes
    // seven SPIKE 3 Python refusals. It changes no existing spelling: every word
    // this fixture uses parses and decompiles as before, and
    // test/spike3-python-arena-d1.test.mjs runs the new ones in the arena.
    // The assertions re-ran at the pin.
    // PIN MOVED a2032f71 -> b4eb4073 (2026-09-30, sb3-creator#41 + #42, task D5):
    // this one touches the SPIKE PARSER, not the emitter. Every statement rule
    // now matches through matchTopLevel, so an argument may be a parenthesised
    // expression (`move forward (finds * 15) cm` reads; it was dropped), and a
    // line the dialect cannot read is refused (UnparsedLinesError) instead of
    // dropped with a warning. This fixture's words all parse as before — the
    // `assert.deepEqual(creator.warnings, [])` below still holds, and a dropped
    // line would now throw before it — and the artifact assertions re-ran.
    // #42 only narrows #41's cut-short-reporter check (a variable named
    // `item`); no SPIKE word is involved.
    // PIN MOVED b4eb4073 -> 82c04190 (2026-09-30, sb3-creator#43 + #44 + #45, task D6):
    // the parser again, not the emitter. A declaration the device cannot take
    // is refused instead of warned about and skipped; a text literal reads and
    // writes the escapes \" \\ \n \r \t (this fixture's `display text` has
    // none); an unbracketed reporter spilled over positional slots (`set pixel
    // round a 100`) is refused. Every word this fixture uses parses and
    // decompiles as before; the assertions re-ran at the pin. #44 names the
    // refused line in a retarget reason; #45 makes DEVICE 8086/8088/i8088 the
    // 8086. Neither touches a SPIKE word.
    // PIN MOVED 82c04190 -> 3250c2ca: generic driver wording cleanup; this
    // virtual SPIKE fixture keeps the same parser and generated program.
    // PIN MOVED 3250c2ca -> 5d8dcf05 (2026-10-05, sb3-creator#48, task B7): the
    // JS/Python simulator drivers only (devices actuators via setDeviceControl,
    // the stc12 PORT/595/keypad verbs); `git diff 3250c2ca 5d8dcf05 -- src/`
    // touches sb3Creator.js's driver generators and nothing the SPIKE emitter
    // or this fixture's parser path reads. The assertions re-ran at the pin.
    // PIN MOVED 5d8dcf05 -> 3125c1be (2026-10-05, sb3-creator#50's own commit, task
    // E0): the MakeCode Arcade / array-reference words (arcadeDialect.js), reached
    // only by lines starting `arcade`, `when arcade`, `mutate array reference` or
    // spelling one of its reporters. No SPIKE word and nothing this fixture parses
    // changed; the assertions re-ran at the pin.
    // PIN MOVED 3125c1be -> 0f14aedb (2026-10-05, sb3-creator#49 + the #50 merge,
    // task B10): thirteen gallery examples, plus `git diff 3125c1be 0f14aedb --
    // src/` = cMs (a computed `wait x ms` scales before dividing), the C reader's
    // pwm_set sentence, and the referee's matching ms scaling. None is a SPIKE
    // word or on this fixture's parse/decompile path; the assertions re-ran.
    // PIN MOVED 0f14aedb -> c8edc8cc (2026-10-05, sb3-creator#52, task B11):
    // device C on every chip (timing, tone, lists/random, sensor and I2C PARTs,
    // pin hats, ask/answer), the C reader and referee to match, eight gallery
    // examples. The parser change a SPIKE line could meet is the pin-role PART
    // declaration (HCSR04/DS18B20/DS3231/AT24C02/I2C) and `set time of`/`store`/
    // `byte ... of`/`i2c device ...` -- none is a SPIKE word or in this fixture;
    // the assertions re-ran.
    // PIN MOVED c8edc8cc -> a69547b7 (2026-10-06, sb3-creator#53, task B11
    // follow-up): the referee seeds declared lists, a bench layout fix, one
    // gallery example's green-flag script. No parser change; the assertions re-ran.
    // PIN MOVED a69547b7 -> 7b8415d5 (2026-10-06, sb3-creator#54, task D7): a
    // condition in a value position warns (none in this fixture), the decompiler
    // writes a Boolean block in a round slot as its condition, the C reader's
    // branch form. The assertions re-ran.
    // PIN MOVED 7b8415d5 -> fcea15f3 (2026-10-06, sb3-creator#55 + #56, task B12):
    // 8051 tone + print, several I2C buses, `chip temperature`, ATtiny print/
    // ask/tone, the chip-thermometer example, main() never returning on the
    // AVR/ARM (#56). The parser change a SPIKE line could meet is the
    // `chip temperature` reporter -- not a SPIKE word and not in this
    // fixture; the assertions re-ran.
    // PIN MOVED fcea15f3 -> 85973b6a (2026-10-06, sb3-creator#57, task B13):
    // the ATtinys' full-duplex software UART and ADC/PWM/servo emission, the
    // ATtiny88's chip temperature, gallery device lists. The parser changes are
    // ATtiny-only PIN declarations (ADC pins by port, PWM on PB1/PB4, none on
    // the tiny88) -- no SPIKE word and not in this fixture; the assertions re-ran.
    // PIN MOVED 85973b6a -> 98748eea (2026-10-07, sb3-creator#58, task F6): a
    // body's trailing comments stay in its script, an empty hat leaves the next
    // script alone, a comment above DEFINE is the definition's. Parser and host
    // C only; this fixture has no comments. The assertions re-ran.
    // PIN MOVED 98748eea -> 8ba3508e (2026-10-07, sb3-creator#59):
    // Arcade rotation/rotationDegrees/data property words only; the shared
    // parser includes #58's comment and empty-body repairs.
    // PIN MOVED 2d2a5628 -> 33ce7380 (2026-10-07, sb3-creator#62):
    // two Arcade animation resource reporters, native literal menu shadows and
    // quoted stable IDs; no SPIKE word changed. Exact-head producer checks
    // passed, merged tree equals reviewed fd1d93fa, and this fixture is rerun.
    // PIN MOVED 33ce7380 -> 983aa61f (2026-10-07, sb3-creator#63):
    // fresh Arcade resource lookup and reversible resource bridge metadata only.
    // Reviewed producer merge tree matches c7b74f1b; all enabled checks passed.
    // SPIKE declarations, extension URL, motor fields, distance and decompile
    // assertions below are unchanged and rerun at this exact consumer pin.
    // -> 0de6ae91: Arcade player/state, legacy maps and Tile dialect adoption.
    // Re-run every canonical SPIKE artifact assertion below at this exact pin;
    // this is finite artifact qualification, not an emitter-wide equivalence claim.
    // -> 49903b5d: Arcade instance destruction and parallel capture words only.
    // Re-run the unchanged canonical SPIKE artifact behavior at this pin.
    // -> de2ac6ce: one reversible Arcade palette hex command; SPIKE words unchanged.
    // -> 56f6307e (2026-10-09): boolean Arcade question reporter; SPIKE words unchanged.
    // -> e3d0e890 (2026-10-09): direct controller 1–4 movement/stopping; SPIKE words unchanged.
    // -> 0f401fc9 (2026-10-09): native Arcade truncation reporter; SPIKE words unchanged.
    // -> 887045e0 (2026-10-09): Boolean census correction and sibling fixture adoption; runtime words unchanged.
    // -> ef312b0a (2026-10-09): correct multiplayer Boolean census identity; runtime words unchanged.
    // -> 5a6782d9: native Arcade numeric sign word; SPIKE words unchanged.
    // -> 2b93a53d (2026-10-10): five Arcade particle effect words; runtime words unchanged.
    // -> 0e3c1348 (2026-10-10): screen image, image text and paint/shade words; runtime words unchanged.
    // -> e10b1bfa (2026-10-10): Arcade music words; runtime words unchanged.
    // -> fa1bbec9 (2026-10-10): parseInt and frame delta time words, with producer main merged; runtime words unchanged.
    // -> 4ce65254 (2026-10-10): game over and image screen effect words; runtime words unchanged.
    // -> 96a6da7a (2026-10-10): seven segment display words; runtime words unchanged.
    // -> 50721b3b (2026-10-10): darts and corgio words; runtime words unchanged.
    // -> 6e548a69 (2026-10-10): background scroller words; runtime words unchanged.
    // -> 44d11124 (2026-10-10): character animation words, with producer main merged; runtime words unchanged.
    // -> 06341e3d (2026-10-11): three Carnival grammar words; all SPIKE artifact assertions rerun.
    // -> c7096355 (2026-10-12): song playable word; canonical SPIKE artifact assertions rerun.
    // -> 2e830a48 (2026-10-12): sixteen Arcade Buffer words; the SPIKE artifact
    // assertions below are re-run against the exact adopted producer.
    // -> b76c61cd (2026-10-12): UTF8 Buffer word; unchanged SPIKE artifact re-qualified.
    // -> eecbbc71 (2026-10-12): Buffer readonly Boolean; SPIKE artifact re-qualified.
    // -> 5aa81ec0 (2026-10-12): Buffer concat/equality/search; SPIKE artifact re-qualified.
    // -> c63863d9 (2026-10-12): Buffer format-size reporter; re-qualify unchanged SPIKE artifact.
    // -> 647aed7e (2026-10-12): Buffer array bridge; re-qualify unchanged SPIKE artifact.
    // -> 4fc50baa (2026-10-12): Base64 Buffer vocabulary; SPIKE artifact unchanged.
    // -> 9541e81f (2026-10-12): Buffer chunking vocabulary; SPIKE artifact unchanged.
    // -> c94f428d (2026-10-12): Buffer packing vocabulary; SPIKE artifact unchanged.
    // -> 504abe93 (2026-10-13): producer main (2bc0bcb9) with the SEVENSEG8 show_number minus placement (B14, sb3-creator #109); runtime words unchanged.
    // -> 110787e7 (2026-10-13): tile/image/controller words; rerun SPIKE artifact assertions.
    // -> 0088c75b (2026-10-13): normal producer main merge; same artifact gate.
    // -> e1a40796 (2026-10-13): explicit Arcade source HAT/LOOP and AST census fix; rerun every SPIKE artifact assertion.
    // -> 846dcf05 (2026-10-13): clamp, typed bitwise and raw flags field choices; board main is retained; rerun SPIKE artifact assertions.
    // -> 288731b8 (2026-10-13): qualified native class descriptors; rerun every SPIKE artifact assertion.
    // -> a1fa275d (2026-10-14): canonical array-copy words and Settings native dropdown fields; rerun every SPIKE artifact assertion.
    // -> 7c84f8b0 (2026-10-14): merged Settings/Scene supplier; rerun every SPIKE artifact assertion.
    // -> 0e486e0f (2026-10-14): qualified CPX supplier support is retained in the later d4324e20 source; rerun every SPIKE artifact assertion.
    // -> 432f6118 (2026-10-14): five qualified Font value/printing words; SPIKE artifact assertions remain unchanged.
    // -> 4e8a2872 (2026-10-15): connected Arcade inspection reporter and STM32
    // test-only changes; producer diff leaves SPIKE emitters unchanged. Re-run
    // the complete executable artifact and round-trip assertions below.
    // -> c47b9680 (2026-10-13): board sections (DEVICE <id> AS <Name>:) and the Calliope motor word (sb3-creator #112, #113); SPIKE artifact unchanged.
    // -> 0e486e0f (2026-10-14): DEVICE CPX and cpxDialect.js (sb3-creator #136) plus the Arcade lane's words; `git diff c47b9680 0e486e0f -- src/` touches only the arcade/CPX dialects, the runtime registry and sb3Creator.js, with no SPIKE line among them; SPIKE artifact unchanged, re-run at the new pin.
    // -> 8472098b (2026-10-14): DEVICE ESP8266 C back end (sb3-creator #144) plus the Arcade repeat/typeof/font-metric words, explicit procedure calls and the SEVENSEG8 long show_number (#137-#142); `git diff 0e486e0f 8472098b -- src/` touches only arcadeDialect.js and sb3Creator.js.
    // -> c9be966f (2026-10-15): STM32G030/F103 C fixes, F103 ADC and chip temperature (sb3-creator #152) and DEVICE-line device C (sb3-creator #145, #149-#151) plus the Arcade callable/circle/font/inspect words (#143, #146-#148); src/ changes are sb3Creator.js and arcadeDialect.js only.
    // -> f2d4f879 (2026-10-15): qualified condition topology and named-label rename
    // repairs (#153/#154), retaining main STM32/i8086 work; re-run all artifact
    // and round-trip assertions with this exact combined producer.
    // -> a13f92b8 (2026-10-15): STM32 C correct on silicon (clock tree, G0 IOPORT, pulls, ADC, tone, named refusals; sb3-creator #155) plus #153/#154 Code-tab declaration fixes; src/ change is sb3Creator.js only.
    // -> 7d3f8be7 (2026-10-16): the reviewed shared producer pin. Keep the
    // complete executable artifact and round-trip assertions below required.
    // -> 74f89846 (2026-10-20): one canonical Arcade source-arithmetic word;
    // SPIKE producer bytes are unchanged. Re-run every artifact assertion.
    // -> f4b1a789 (2026-10-21): merged supplier #159, including the source
    // operation dialect and qualified compiler/sensor fixes; SPIKE producer
    // source remains unchanged from 7d3f8be7. All artifact assertions remain.
    // -> d7c25891 (2026-10-21): reviewed supplier #160 score callbacks and #161
    // SPIKE motor-power/PWM mapping adoption. SPIKE compiler/registry source changed;
    // rerun every executable artifact and round-trip assertion at this exact pin.
    // -> 37bfe287 (2026-10-21): canonical school examples and supplier provenance.
    // Compiler src is byte-identical to d7c25891; keep all artifact assertions.
    // -> 371a8f9d (2026-10-23): programmable Widgets and school battery variants;
    // preserve and re-run all executable SPIKE artifact checks below.
    // -> c10bc94c (2026-10-25): qualified atan2 selector only; SPIKE
    // emitter source is unchanged. Re-run every complete artifact assertion.
    // -> cdb48273 (2026-11-01): micro:bit LED, radio value, bluetooth and class
    // words (sb3-creator #168); SPIKE emitter unchanged. Re-run every assertion.
    // -> 11b019c5 (2026-11-01): #168 micro:bit words and #169 Arcade external-
    // reference words; neither touches the SPIKE emitter. Re-run every assertion.
    // -> 04fc423e (2026-11-01): #170 micro:bit API words and #171 external image
    // call and carnival label words. `git diff 11b019c5 04fc423e -- src/` is only
    // arcadeDialect.js and sb3Creator.js (the SPIKE emitter, spike3Python.js, is
    // untouched), so no SPIKE artifact assertion changes.
    // -> 69aaba2b (2026-11-01): radio in MakeCode's packet format and the serial, I2C, SPI,
    // buffer, sound and log words (sb3-creator #172); the SPIKE emitter is unchanged (no line
    // of spikeprimeDialect.js, spike3Python.js or the SPIKE generator moved). Re-run every assertion.
    // -> 2aeff387 (2026-11-01): the tilemap words (sb3-creator #173). `git diff 69aaba2b 2aeff387 -- src/`
    // is arcadeDialect.js only (15 added words); the SPIKE emitter is unchanged, so no SPIKE artifact assertion changes.
    // -> 17d06522 (2026-11-01): the micro:bit pin PWM, servo, pulse, touch-mode and game level words (#174) and the sibling refresh (#175); the SPIKE emitter is unchanged (no line of spikeprimeDialect.js or spike3Python.js moved). Re-run every assertion.
    // -> ab47b412 (2026-11-01): the micro:bit radio off/band, serial redirect/baud, reset, panic, compass and
    // accelerometer words (#176); the SPIKE emitter is unchanged (no line of spikeprimeDialect.js or spike3Python.js moved).
    // Re-run every assertion.
    // -> bc9070f9 (2026-11-01): serial polling and raw radio packet words (#177), the radio event frame, log rows and note-string melodies (#178, #179); the SPIKE emitter is unchanged (no line of spikeprimeDialect.js or spike3Python.js moved). Re-run every assertion.
    // -> 1424ec3f (2026-11-02): the arcade_mathUnary and arcade_play words (#180); `git diff bc9070f9 1424ec3f -- src/` is arcadeDialect.js only (two added words), so the SPIKE emitter is unchanged.
    // -> a7b8c394 (2026-11-03): the remaining micro:bit namespace words (#181); `git diff 1424ec3f a7b8c394 -- src/` is sb3Creator.js only (micro:bit words and helpers), so the SPIKE emitter is unchanged. Re-run every assertion.
    // -> 8e53c162 (2026-11-03): four Arcade tilemap words (#182); `git diff a7b8c394 8e53c162 -- src/` is arcadeDialect.js only, so the SPIKE emitter is unchanged.
    // -> 7befb941: reviewed Arcade vocabulary and bounded text-length schema.
    // -> e1e126ae (2026-11-21): doors for C-blocks of layered dialects (sb3-creator #185):
    // parseBodyHeader, the Python `with` and JS `() => { … }` readers. `git diff 7befb941 e1e126ae -- src/`
    // is sb3Creator.js (one inert branch), pythonToPseudocode.js and javascriptToPseudocode.js only; the
    // SPIKE emitter (spike3Python.js, spikeprimeDialect.js) is unchanged. Re-run every assertion.
    // -> e248ce71 (2026-11-23): 88 lab-* gallery examples and their benches (#186-#189);
    // `git diff e1e126ae e248ce71 -- src/` is empty, so the SPIKE emitter is unchanged. Re-run every assertion.
    // -> fc0e1c94 (2026-11-23): pot-knob layout fixes in four lab benches (#190); `src/` unchanged again.
    // -> 01e1280 (2026-11-23): five radio lab examples, every lab bench re-laid out and re-measured (#191); `src/` unchanged again.
    // -> 539a3d9 (2026-11-23): bw-circuit-ui df78c46 provenance re-stamp and the lab-meissner-am re-layout (#192); `src/` unchanged again.
    // -> cafdfb1 (2026-11-24): 38 round-4 lab benches (fields, transducers, optics, rf) and sibling pins bw-board 20c29a7 / bw-circuit-ui 6ea2239 (#193); `src/` unchanged again.
    // -> c048a55 (2026-11-24): RF benches read robustly, lab-shortwave-regen withdrawn, sibling pins bw-board 5c83e54 / bw-circuit-ui 089ee40 (#195); `src/` unchanged again.
    // -> de3c53c (2026-11-24): sibling pins bw-board 489ca7c / bw-circuit-ui 7f98562 (#196); `src/` unchanged again.
    // -> 2dace04 (2026-11-24): RF gaps (lab-shortwave-regen restored, broadcast pickup, MOSFET regen, metal detector at 96 kHz), the DIP/module reseat (#198) and sibling pins bw-board 7e0bf8c / bw-circuit-ui cb8dbb7 (#199); `src/` unchanged again.
    // -> 318a9ad (2026-11-24): flat-twin partition verdicts re-derived (#200) and the bw-circuit-ui pin 4c57f3a (#201); `src/` unchanged again.
    // -> 73f9490 (2026-11-24): independent CP1 assembler and teaching examples;
    // the SPIKE artifact assertions below are re-run at this exact supplier pin.
    // -> fdadba67 (2026-11-25): CP5 example and registration; the SPIKE
    // emitter is unchanged. Re-run the complete artifact assertions at this pin.
    // -> ece2e0d3 (2026-11-25): Independent CP1 gallery exercises.
    // -> df11b236 (2026-11-25): Kosmos CP1 curriculum and prior mainline examples.
    // -> 1c29f69f (2026-11-25): electronics benches and the CP3/CP4 lesson.
    // -> 0e75fbde (2026-11-26): KIM-1 and Busch gallery entries and expected behavior. The compiler source is unchanged.
    // -> f823a41b (2026-11-26): 6502 circuit and Controller gallery integration.
    // -> 1b414786 (2026-11-27): update multimeter guidance for LM358 input bias.
    // -> bf9edad9 (2026-11-28): game export (costume pixels, touching colour), owned
    // JavaScript console, gallery reconciliation. The SPIKE emitter is unchanged.
    // -> e3f17df5 (2026-11-28): explicit CrispBASIC generation and reverse-conversion
    // guards (the feature lane's 0b2224b7, merged onto sb3-creator main).
    // -> e8b8e255 (2026-11-28): bw-board master pin and the redesigned RF benches
    // (#254, #255); the SPIKE emitter is unchanged.
    // Keep the exact supplier identity gate and every SPIKE artifact assertion below.
    assert.equal(JSON.parse(readFileSync(new URL('../vendor-pins.json', import.meta.url)))['sb3-creator'],
        'e8b8e255f7ab2d8ad9cb081b9c2c2fd8b2637bf1');

    const creator = new SB3Creator();
    creator.parse(PROGRAM);
    assert.deepEqual(creator.warnings, []);
    const project = await projectFrom(Buffer.from(await (await creator.generateSB3()).arrayBuffer()));
    // This fixture's first line is `GLOBAL dist = 0`, and until sb3-creator af09a0d that
    // declared a variable literally NAMED "dist = 0" and then created a second, uninitialized
    // "dist" the moment `set dist to ...` used it. Two variables where the program declares one.
    //
    // Asserted here because nothing else in this file or in the browser gate can see it: both
    // check OPCODES and three motor phrases, none of which touch the declaration line. A green
    // SPIKE round trip is not, on its own, evidence that the declaration parses correctly — so
    // the evidence is added rather than assumed.
    const declared = project.targets.flatMap(target => Object.values(target.variables || {}));
    assert.deepEqual(declared, [['dist', 0]],
        'the initializer must set the value, not become part of the variable name');
    assert.deepEqual(project.extensions, ['spikeprime']);
    assert.equal(project.extensionURLs.spikeprime,
        'https://crispstrobe.github.io/extensions/CrispStrobe/legospike_turbowarp_transpile.js');

    const target = project.targets.find(item => Object.values(item.blocks)
        .some(block => block.opcode === 'event_whenflagclicked'));
    const blocks = Object.values(target.blocks);
    const motor = blocks.find(block => block.opcode === 'spikeprime_motorStart');
    assert.deepEqual(motor.fields.DIRECTION, ['1', null],
        'the shipped extension multiplies this field, so a translated label would become NaN');
    const assignment = blocks.find(block => block.opcode === 'data_setvariableto');
    assert.equal(target.blocks[assignment.inputs.VALUE[1]].opcode, 'spikeprime_getDistance');

    const roundTrip = new SB3Creator();
    const decompiled = roundTrip.decompile(project);
    assert.match(decompiled, /start motor A forward/);
    assert.match(decompiled, /set dist to \(spike distance B\)/);
    assert.match(decompiled, /stop motor A/);
});
