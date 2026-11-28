# Cowgol integration — 2026-11-28

Status: active on `feat/cowgol-integration-20261128`.

Owner: ChatGPT, at the repository owner's request. Base: `b474327531ab9133f27c69fce9c6bd776bce2b50`.

Scope: Cowgol Code-tab language, + menu, source import/export and recovery, supported pseudocode/Blocks conversion, canvas/circuit bridge, truthful machine capabilities and compilation routing. Owning sibling boundaries: `sb3-creator` converters, `stc-compiler` compiler service, and `CrispStrobe/cowgol` compiler/runtime improvements. Examine `feature/crispbasic` for established integration patterns without replacing that work.

Delivery: the owner explicitly requests incremental saves to remote feature branches. This lane therefore stays on feature branches; it does not merge a claim or implementation into main. Upstream source identity, pin provenance, tracked mirrors and focused behavioral verification remain required.

Qualification: bidirectional conversion tests (including unsupported syntax), language/menu/recovery/routing tests, compiler smoke tests where toolchains are available, and generated capability/provenance checks. Native machine support is distinguished from conversion through an existing target backend.

Continuation: add real RISC-V console coverage through full Cowgol/cgen/GCC
and the checked Blocks console lowerer. Add a genuine Eater 65C02 ROM port
with its own memory/I/O contract, rather than treating the BBC Tube image as
compatible. Existing CP/M, DOS and C routes remain regression gates.

The producer pin moves deliberately along this feature branch from
`2823f4be81713dd1e0515cdf285cbb42faa77d13` to
`6b7f5966fcad4dbbdec6cb149bf71dca6df6364d`; its direct parent is the old pin.
The vendor sync uses its explicit deliberate-pin option, followed by exact
transformed-source identity and mirror checks. No default-branch merge is part
of this continuation.

RISC-V frontend checkpoint: `e4af9afccc4c2bc8b203c36ce07511faae899947`.
Eater continuation adds a validated 32 KiB ROM action and explicitly carries
the canonical board map through the existing ASM media handoff. This prevents
a previously extracted 6502 map from relocating the program or peripherals.
The focused editor workflow passes 105 tests; exact-machine execution is also
checked by the fork/service and the reusable local HTTP verifier. The upstream
compiler's final Eater argument-bound checkpoint is
`8e807002bc6d1d457995f2759da262c230d807e1`. Native host support and the checked
conversion subset remain separately qualified in docs/COWGOL.md.
