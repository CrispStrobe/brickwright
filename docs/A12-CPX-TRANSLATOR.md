# Circuit Playground Express MakeCode import

A recovered MakeCode TypeScript project for Circuit Playground Express opens
as `DEVICE CPX` code. Building it produces the existing `circuitplayground`
blocks and device world. The original recovered files remain available for
MakeCode's own simulator and the original-source download.

Delivered on 2026-10-16 in [PR1009](https://github.com/CrispStrobe/brickwright/pull/1009),
merge `e0b89072`, reviewed source `16dda603`. Required hosted qualification
passed with the exact timing limits described below.

This is a translator for the pinned **pxt-adafruit 1.6.8** vocabulary, using the
45 words delivered by [A9](A9-CPX-SCOPING.md). It adds no firmware emulator,
extension implementation or dependency pin.

## Target and source identity

An Adafruit editor URL selects `adafruit`. The project's non-empty
`circuit-playground` dependency also identifies CPX, including programs using
input/sound names shared by other target bundles. A target version number is
not a target name. Without a positive hint or that board-package identity,
CPX-specific vocabulary is checked before the shared micro:bit `input.on`
spelling. Comments and literal text cannot supply that CPX evidence. A known
micro:bit, Calliope, EV3 or Arcade hint retains priority. Shared vocabulary
alone cannot establish an otherwise ambiguous project's target.

Source-only `.mkcd` projects use the same import path as recovered firmware
projects and shares. Unknown container metadata may recover CPX from its
distinct vocabulary. CPX Python source and projects without `main.ts` are
refused by name; their original files remain available.

## Mappings and limits

Ring colours, brightness, gradients, graphs, animations, sensors, tones,
tempo, built-in sounds and static event handlers use the existing CPX words.
Commands and inputs are read by the actual dialect parser. Enum and built-in
sound spellings follow the MIT-licensed Microsoft target sources; their
upstream licence notices remain with the pinned runtime.

CPX already has event hats for buttons, touch, gestures, the switch, light,
temperature and loud sounds. These use the existing device input dispatcher,
rather than introducing a second polling implementation. Inline zero-argument
callbacks and uniquely declared zero-argument functions retain their bodies;
expression-bodied callbacks execute their command before returning.

Project hats start with the project. Dynamic registration and registration
after potentially yielding initialization are therefore refused by name.
This is conservative: a helper that could yield can withhold a later handler
even when one invocation would return immediately. No general event-bus,
registration-order, interruption or timing-equivalence claim follows from the
finite comparisons.

Photon operations, external strips, IR/cable networking, HID, storage,
datalogging, settings and unsupported pin/bus operations remain named refusals.
Custom melodies and per-play sound-volume arguments also remain refused.
Every returned refusal includes a reason and appears in an `# unsupported:`
comment. Calls inside an entirely refused construct are named too.

There is no qualified CPX MakeCode emitter. **MakeCode export is refused for
CPX**, instead of producing micro:bit source. Downloading the original recovered
source is a separate action and preserves the files as imported.

## Evidence and acceptance

Run `node scripts/makecode-census.mjs --only adafruit` to regenerate only the
CPX section of [the census](generated/MAKECODE-CENSUS.md), preserving the other
target sections. The source archive must match the existing exact tarball pin.
The exhaustive input is **244 code fences**, including 163 in projects and
tutorials; the earlier 149-program estimate was not the archive's full count.
There is no deduplication. Original source is checked by its own compiler;
compiler infrastructure failures cannot count as invalid source programs.

The import census records 149 full, 33 partial, 27 refused by name, 26
parser-warning cases and nine original-compiler refusals, with **zero silent
call losses**. “Full” describes import, parsing and source-call accounting;
it does not mean every program has a behavioural or re-export proof. Original
compiler failures include stale animation APIs and an incomplete `Anim`
example. Empty-body parser warnings remain visible.

Required behavioural qualification compares fifteen unchanged documentation
programs in the original PXT simulator and, after translation and parsing,
through the original CPX extension. The finite block-stack driver consumes the
parsed project; it does not provide board behaviour. Ring frames and ordered
tones are compared, with positive light/sound assertions to reject empty runs.
Ten programs require exact equality at every capture and for every ordered tone.
Five separately named runtime-boundary tests retain the exact observed
original and native values: five exceptional ring captures and two differing
ordered tone sequences. Every other capture remains an equality check. There is
no timestamp tolerance, capture shift or dropped input; any change to either
side of a recorded difference fails. These boundaries describe the two existing
runtimes and the finite headless driver; they do not establish actual Scratch
VM timing parity or physical device timing.
The production browser proof separately uses the actual VM and visible CPX
pane: import, build, Start, button A and Shake must render the expected ten
red, blue and green pixels. It also checks named export refusal, unchanged
source download and the preserved original MakeCode run path.

These are qualification requirements, not a statement that a pending candidate
has passed hosted CI. All enabled final-head checks and these affected proofs
must pass before its source merge.

## First hosted comparison findings

The first hosted candidate is **not qualified**. In
[run 38897566772](https://github.com/CrispStrobe/brickwright/actions/runs/38897566772),
seven documentation comparisons pass and five fail their exact frame/tone
checks: `set-brightness#0`, `show-animation#0`, `tutorials/siren#4`,
`learnsystem/beep-beep#0` and `set-pixel-color#0`. The failed run remains the
original evidence; passing individual cases do not qualify its failed shard.

The pinned original PXT scheduler can suspend a continuation for five
milliseconds after its elapsed-time check. Its simulated NeoPixel state also
retains a reference to the supplied pixel buffer. Native CPX hats and the
extension's completed ring state have different scheduling and publication
boundaries. These source observations are relevant to the differences; they
do not establish a complete cause or timing equivalence. Button Click maps
to release in both implementations.

The next candidate corrects the census reader's nested-template handling,
the export menu control, and two browser control mistakes: waiting for the
replacement program rather than any CPX header, and selecting the visible
CPX dock rather than a hidden firmware button. It records complete comparison
differences before retaining the original strict assertions. The actual native
Start/button/Shake journey and timing boundary remain unqualified. In the
[next run](https://github.com/CrispStrobe/brickwright/actions/runs/38902268468),
source import, original simulation and native block loading pass; after Start,
the expected red ring is absent and the pane button is no longer found. A
[read-only Start diagnostic](https://github.com/CrispStrobe/brickwright/actions/runs/38905304607)
then observes that the native board does contain all ten red pixels at full
brightness while the CPX pane has unmounted. Local storage still says `cpx`;
the actual dock-change event was not captured.

The earlier serial scenario retains a user-firmware override. The global flag
intentionally restarts retained firmware, and its LabWired display can request
the Widgets dock without updating that local-storage key. This source path is
consistent with the disappearance; it is not a captured full attribution.
The next browser candidate clears only that scenario's firmware through the
existing “back to blocks” control, requiring the firmware chip to disappear
and the debugger to become idle before later device scenarios. The
[first cleanup run](https://github.com/CrispStrobe/brickwright/actions/runs/38907684694)
finds that control visible and enabled after the serial checks pass, but the
retained LabWired display canvas intercepts its clicks. The next control path closes the actions menu and explicitly
opens the debugger through its existing button before clearing the firmware.
Pixel values, input actions and observation bounds stay unchanged. Clean native browser
qualification remains pending. The five recorded differences do not establish
timing parity.

Three additional original programs extend the existing twelve comparisons:
`projects/star-projector/code#1`, `reference/light/show-ring#2` and
`projects/cartoon-network/enchiridion#1`. They require ten equal lit pixels,
a three-color repeated ring and six lit pixels with four authored black
positions respectively. All original cases and capture times remain intact.
These are among the ten exact matching cases in the diagnostic run below;
the combined follow-up still requires fresh hosted qualification.

A separate diagnostic observer is prepared for the five differing comparisons.
It wraps the original compiled factory, retains its exact bytes and forwards
its original yield, event, fiber, send-buffer and audio calls. These are
instrumented derivatives, identified by source/factory hashes. Observer records
use the existing collector only for these programs without serial operations;
the pinned compiler/simulator files and existing clock, snapshot and sound-reader
helpers stay unchanged.
Every derivative must reproduce every uninstrumented captured frame, ordered
tone and original serial line exactly before its trace is admitted. Individual trace records have an explicit count, digest
and completion record, so a truncated log cannot supply a complete trace. The
original native-versus-PXT assertions on earlier candidates produced the five
retained failures. Their failed runs remain original evidence. The separately
named boundary tests assert both sides of each exact recorded difference, plus
strict equality at every other capture. They do not qualify timing parity or
rewrite an original failed run.

## Live-share sample

On 2026-10-16, the three shares linked by the pinned documentation were still
retrievable: [kitchen example one](https://makecode.com/_F1oDHqek78qA),
[kitchen example two](https://makecode.com/_TspAH0g8gcvv) and
[beaded necklace](https://makecode.com/_MtgXgUKHhX1o). Their project metadata
identifies target versions 1.4.43, 1.4.43 and 1.4.36 respectively. All three
compile with the pinned target, infer CPX and retain named refusals for their
unsupported photon, custom-melody or external-strip operations. This sample
does not establish compatibility with newer editor APIs.

## Observed original-runtime boundaries

The [fifteen-program diagnostic run](https://github.com/CrispStrobe/brickwright/actions/runs/38917231822)
has ten exact matching comparisons and the same five strict failures. The
instrumented derivatives preserve every original captured frame, ordered tone
and serial line before reaching those failures. All five original factory
hashes match the compiler-only source maps used to interpret their function
names and continuation positions. This admits the diagnostic observations;
the failed unit shard remains failed.

In the brightness program, the original `NeoPixelStrip.show()` yields at
300 ms while its published ring still aliases the buffer being scaled. Six
pixels already have the new brightness and four retain the previous value.
At 900 ms, three pixels have changed and seven retain the previous value.
The completed buffers are sent at 305 and 905 ms respectively. These are the
exact partial arrays captured by the original headless reader; they are not
evidence that the translator lost a pixel command.

For the animation and single-pixel programs, the original runtime yields
at the 300 ms button-release boundary before the first buffer is published
at 305 ms. The native extension has already completed its frame at 300 ms.
For the siren, the original mixer queues both notes at 205 ms, with offsets
of zero and 125 ms, producing requested start times of 205 and 330 ms;
the native readings are 200 and 326 ms. For beep-beep, the original yields
at 300 ms, publishes its orange frame at 305 ms, and its SDK `autoShow()`
then pauses for one millisecond before the tone is queued at 306 ms.
The native tone is recorded at 300 ms.

These observations explain the selected original-runtime boundaries in this
finite headless comparison. They do not establish actual Scratch VM or physical
device timing parity. Separately named exact timing-boundary tests now enforce
both recorded results at every exceptional capture and tone sequence; all
other captures retain strict equality. The original five failures remain in
the diagnostic run.

That run's complete light-browser job also passes: the real serial fixture
releases its firmware through the existing UI, source-only CPX import keeps
its own target, original-source download and simulation, and native Start,
button A and Shake render ten red, blue and green pixels respectively.
The follow-up integrates current main, including its circuit-UI pin, and
requires fresh qualification of that combined head before merge.

## Diagnostic transport follow-up

The [combined-head run](https://github.com/CrispStrobe/brickwright/actions/runs/38931471960)
passes the complete CPX browser journey and the first unit shard. The second
shard remains failed: its census reports zero tests for the comparison file
and rejects 30,125 raw stdout bytes from its observer diagnostics. Those
records retain the same five exact differences, but they cannot qualify a
file whose test results were not reported.

The follow-up sends the four observer message types through `t.diagnostic()`.
All record content, assertions, programs, inputs and capture times stay fixed.
A synthetic transport control reports all fifteen tests with zero raw stdout
bytes; changing those same calls back to `console.log()` reproduces 30,125 raw
bytes. The standalone reader still recovers all five difference records and
93 ordered trace records. This is a transport control, not guest qualification;
the changed head still requires fresh hosted unit and browser results.

## Delivered qualification

The [final source run](https://github.com/CrispStrobe/brickwright/actions/runs/38945485781)
passes both complete unit shards, including all fifteen comparisons: ten exact
matches and five separately named exact runtime-boundary controls. All 459 files
in the affected shard report tests, with zero raw stdout bytes. The standalone
reader admits all five complete ordered observer traces and their original
source/factory identities; the original failed runs remain retained.

The complete production browser job passes all thirteen required CPX observations,
including firmware cleanup, target identity, named MakeCode export refusal,
untouched original-source download and simulation, and actual native Start,
button A and Shake producing ten red, blue and green pixels. All eleven enabled
checks on `16dda603` pass; deployment and its deployed-GUI check are conditional
skips for this pull-request event.

The reviewed merge `e0b89072` preserves the qualified A12 implementation and newer
peer work. Its actual parents and tree match the predicted composition. The
original tested checkout is recorded separately; the final whole tree is not
claimed to be that checkout. These results do not establish physical device or
actual Scratch VM timing parity for the five documented boundary programs.
