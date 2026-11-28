# Reviewed schematic baselines

These SVGs are deterministic output from `scripts/render-schematic.mjs`. They
are deliberately checked into source control: a mechanically valid diagram can
still be a poor explanation, so the corpus geometry gate is necessary but not
sufficient.

Reviewed on 2026-08-21:

- `01-blink-circuit.pico.svg` — simple teaching loop; MCU, LED, resistor and
  power references remain identifiable and connected without a label thicket.
- `10-motor-speed-circuit.pico.svg` — analog/electromechanical case from the
  reported regression; potentiometer wiper and transistor B/C/E meet their
  drawn terminals, while motor and PWM paths route around symbols.
- `08-led-chaser-595-circuit.pico.svg` — dense repeated bank; conventional net
  labels are preferred to overlapping bus trunks.
- `z80-pd-bench-circuit.svg` — retro-machine stress case; packages remain
  separated and bounded, with labelled buses at a readable fit scale.

Regenerated 2026-08-24, after vendoring bw-circuit-ui `a5fbe12` ("Five nets
drawn as one wire, and an MCU drawn with no power"). Three of the four moved;
`z80-pd-bench` did not. What changed, and why it is an improvement rather than a
drift:

- the `pi_pico` symbol now draws `gnd_1` and `vbus` alongside `gp25`, so an MCU
  is no longer drawn with no power — which is half of what that commit's title
  names;
- nets that were being collapsed into one drawn wire are now separate, and the
  three GND connections render as labelled stubs instead of long routes across
  the sheet.

The evidence that this is intended rather than incidental is that the same
upstream commit reviewed and regenerated bw-circuit-ui's OWN baselines for the
same reason; these are the downstream half of that review, not a fresh
judgement made here.

Run `node --test test/schematic-visual-baselines.test.mjs` after an intentional
layout change. Review regenerated SVG/PNG output before updating these files.

## 2026-11-27 review

Rendered and inspected both the saved and current motor-speed SVGs as PNGs.
The current pinned renderer moves the three-segment PWM-to-resistor route
from y=201 to y=193, clearing the `pico1` label above the MCU. These three
line coordinates are the entire SVG delta: all eight symbols, labels,
terminals, net identities, other routes and the 540×396 view box are unchanged.
The motor, transistor, diode and potentiometer connections remain the same.
The reviewed motor-speed baseline now records that clearance improvement.

The Z80 bench was also rendered and inspected before acceptance. Its `in1`
74HC244 right-side pins now follow the installed sidecar's canonical terminal
order. Nine pin labels and their matching net stubs move together (27 changed
SVG elements); every terminal-to-net identity remains equal before and after.
All 37 symbols, the other chip pin layouts, and the view box are unchanged.
The blink and LED-chaser baselines remain byte-identical.
