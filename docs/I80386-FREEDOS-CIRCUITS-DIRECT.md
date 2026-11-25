# FreeDOS direct Circuit input gate

**The bounded direct-input guest gate passed at tested source `327143c40bfd0e0655395ec7c6cdb940de72c305`.** The optional browser gate extends the accepted
[FreeDOS interaction probe](I80386-FREEDOS-INTERACTION.md) from its exact
source bytes. It keeps the same owned marker HDD, FreeDOS floppy, Widgets
boot/listing/fullscreen/PS/2 steps and Code roundtrip. While the Circuit tab
remains selected, it focuses the visible VDP face, sends the physical browser
keys for `echo circuitok`, and requires `circuitok` to appear as a separate
guest shell output line in the Circuit VDP **canvas pixels**. The observation
reads rendered pixels; it does not write guest memory or call the diagnostic
target's input API. After returning to Code, the probe requires both that
output and `PS2 DONE` to remain visible, a working `tabok` command, and
nondecreasing guest time.

The source-only control authenticates the earlier probe SHA-256
`0cb78e14ac17c882fa4bfe62d65320f5fe27d66891d76ccaa1cd01436d75fc92`,
proves a reversible derivative and parses the generated module. It does not
prove the Circuit VDP receives a key in a running browser. Run the actual
gate only from an exact reviewed pull-request head with the dedicated
`x86-freedos-circuits-actual` label. The hosted workflow builds that same app
head, verifies the installed board and Circuit UI pins, authenticates the
official FreeDOS 1.4 floppy and owned HDD, then keeps original screenshots,
guest text, clocks and first-failure logs. It uploads no guest media or app
bundle. The result must be audited against the original artifact before any
acceptance claim.

The [first hosted attempt](https://github.com/CrispStrobe/brickwright/actions/runs/37627418944)
stopped before build completion or guest launch. The installed-package verifier
rejected the exact GitHub HTTPS checkout origin without the optional `.git`
suffix. The narrow correction accepts that exact owner/repository URL while
retaining the pinned commit, package payload and single-engine checks. The
first artifact's inventory named the generated probe, but its upload omitted
the `.mjs` file; the corrected workflow retains it for independent rehashing.
That attempt establishes no Circuit key or guest result.

The [second hosted attempt](https://github.com/CrispStrobe/brickwright/actions/runs/37629972190)
built the app and authenticated the free media, but stopped at the preguest
build admission. Webpack stamped the ambient pull-request merge revision in
its seven-character build manifest, while the gate expected the reviewed
pull-request head. The corrected build supplies the exact checked-out head
to Webpack at build time and verifies its seven-character manifest projection
against that full head. The original second failure remains a failure; no
guest input or Circuit pixel response was observed in it.

The [third hosted attempt](https://github.com/CrispStrobe/brickwright/actions/runs/37632115411)
passed source, build and free-media admission and booted the guest, retaining
the listing and PS/2 output. It stopped before sending Circuit keys: the
probe tried to click the VDP parent while the Controller pane's AT canvas
covered its click point. The correction uses the visible Debugger view button
to show the full VDP while keeping the Circuit tab selected, clicks the VDP
canvas through the browser pointer path, and checks actual VDP focus before
typing. The third attempt does not establish a Circuit input response; the
corrected source has not yet passed the hosted guest gate.

The [fourth hosted attempt](https://github.com/CrispStrobe/brickwright/actions/runs/37640159639)
passed the physical Debugger-button and VDP-canvas focus checks. Its retained
screen visibly shows FreeDOS and `PS2 DONE`, but the probe stopped before
Circuit keys because its pixel observer was supplied to Playwright as a
string containing an arrow function. The locator evaluated that string as a
function value without invoking it on the canvas, so the pixel assertion
received no decoded text. The correction supplies an actual callable canvas
observer. A deterministic source control verifies that it decodes rendered
glyph pixels and rejects changed pixels and frame dimensions. The fourth
attempt remains a failure, and the corrected probe still requires a fresh
hosted pixel-response result.

The [fifth hosted attempt](https://github.com/CrispStrobe/brickwright/actions/runs/37643740464)
at `50f12bdf215b1a572cbade711c4fd2d6b773004f` reached the corrected
pixel observer. The Circuit VDP decoded the prior FreeDOS prompt and `PS2 DONE`,
and the visible canvas accepted a physical click and retained focus. After
physical `echo circuitok` keys, guest time advanced from 68.2 to 99.9 seconds,
but the before/after Circuit canvas pixel SHA-256 and decoded text were
identical. The run therefore failed the real guest-response gate. Its
[original artifact 11494886005](https://api.github.com/repos/CrispStrobe/brickwright/actions/artifacts/11494886005)
is 245,565 bytes, SHA-256
`ebee7c6199b94d90c0511cbdb70074ba533d95b8fcd1dcf1573a17e078c16e10`.
The retained Widgets-keyboard scan list observes only the Widgets mirror
callback, so its lack of new scans does not establish whether the Circuit VDP
forwarded keys. This follow-up records trusted VDP DOM key events and actual
target `keyIn` calls while forwarding the original method with the same
receiver and return value. It still requires visible guest pixels to change;
the fifth failure is not a passing result.

The [sixth hosted attempt](https://github.com/CrispStrobe/brickwright/actions/runs/37647337533)
at `780b7a7ff7c737f632a90152f0d9ca38890aec10` retained
[original artifact 11496105114](https://api.github.com/repos/CrispStrobe/brickwright/actions/artifacts/11496105114)
(247,016 bytes, SHA-256
`c5123adaa338ebaac36584f734fd76cb30f07e966b1fd74aa9df1e2aeb28e785`).
All 30 physical VDP keydown/up events were trusted and targeted the focused
screen, but the wrapped target method received zero `keyIn` calls; the guest
pixels were unchanged as time advanced. The route between focused DOM events
and the observed target remains unresolved: a missing React callback prop,
an unhandled React key event, or a changed runner/target remain possible. The
next probe records those route facts without synthesizing input or relaxing
the pixel gate.

The [seventh hosted attempt](https://github.com/CrispStrobe/brickwright/actions/runs/37650021025)
at `a5e63608dca10706ab619c8d1d5a0db60802202c` retained
[original artifact 11496508160](https://api.github.com/repos/CrispStrobe/brickwright/actions/artifacts/11496508160)
(249,068 bytes, SHA-256
`74b6bc8c2dc815229e7ce0746c156ea1f17bb2d2cd3ff1147567b3b6d61244a1`).
All 15 keydown and 15 keyup events were trusted, focused and bubbled through
the document. The VDP's mounted React props and panel runner exposed the
scancode callback, yet the observed target received no calls. No keydown was
consumed and the guest pixels stayed identical while guest time advanced.
The installed React 16 renderer omits `code` from its synthetic keyboard
event, although the native event retains it; the pinned Circuit UI reads only
the synthetic field and therefore returns before forwarding a recognized
PC key. A narrow Circuit UI source correction reads the native field when
the synthetic one is absent. Lite's eighth-attempt
[consumer pin `0f4a005b`](https://github.com/CrispStrobe/bw-circuit-ui/commit/0f4a005b79c57f77ff0a5f0e875f3c8968c58803)
contains only that source correction, its keyboard test and CI gate relative
to the previously installed Circuit UI pin. The separate
[Circuit UI PR81](https://github.com/CrispStrobe/bw-circuit-ui/pull/81)
applies the same change on the newer main line; Lite does not adopt its other
changes here.

The [eighth hosted attempt](https://github.com/CrispStrobe/brickwright/actions/runs/37653831331)
at `c766b2c2ec05b3654ca7865d451134eb8d12d97c` retained
[original artifact 11498327697](https://api.github.com/repos/CrispStrobe/brickwright/actions/artifacts/11498327697)
(102,499 bytes, SHA-256
`a048b699d4b3e122e9f94f1dbf2136b1cc1db00c5b73ad833b0552d6e5e5be6c`).
The direct Circuit input portion passed: all 30 trusted, focused make/break
events were accepted by the target, the actual VDP canvas changed, and its
decoded guest pixels showed `echo circuitok` and a separate `circuitok` output
line. The **full interaction gate still failed** after the probe clicked Code:
it waited for the AT canvas while the Debugger view remained selected, so the
canvas was hidden and the later `tabok` shell check never ran. The corrected
probe physically selects the Controller view, checks its selected state, and
retains the original canvas, shell-output and guest-time checks. That corrected
source has not yet run in the hosted browser. The proposed narrow
[consumer pin `557c4716`](https://github.com/CrispStrobe/bw-circuit-ui/commit/557c4716236536829456818789c50772d0e65fa8)
adds only the CI registration correction to the eighth-attempt pin; it does
not adopt unrelated Circuit UI main-line changes.

The [ninth hosted attempt](https://github.com/CrispStrobe/brickwright/actions/runs/37660250589)
at `428c00934938f596200466ed838aeb157fac101a` retained
[original artifact 11501990608](https://api.github.com/repos/CrispStrobe/brickwright/actions/artifacts/11501990608)
(11,228 bytes, SHA-256
`e5a38a9976eb06f0dbfcfebc3e5a454e649e2675012d6c31e98d2ed9de354ca3`)
and stopped before media or guest execution. Its source-control and exact
probe materialization passed,
but the build gate found two stale `bw-packages.sources.json` notice mirrors:
they still named the eighth-attempt Circuit UI pin after the proposed pin
advanced to `557c4716`. The existing notice generator now emits both mirrors
from the pinned packages' unchanged license bytes and the current source pins.
The ninth attempt establishes no result for the corrected Controller-view
roundtrip; a fresh installed browser run is required for full acceptance.

The [tenth hosted run](I80386-FREEDOS-CIRCUITS-DIRECT-RESULTS.md) passed the
full direct-input and tab-continuity gate on the reviewed source. Its compact
[receipt](receipts/2026-10-07-freedos-circuits-direct.json) binds the original
artifact, exact installed pins, actual canvas pixel change, physical key
delivery and later shell output. The first nine attempts above remain
historical failures or partial results; none is retroactively passing.

This bounded input check does not establish drag capture beyond the canvas,
browser-reserved key handling, an INT33 mouse application, disk writeback,
or a general native 386 backend. A live terminal CLI scenario remains a
separate acceptance task.
