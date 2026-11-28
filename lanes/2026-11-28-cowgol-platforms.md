# Cowgol platform expansion and default-branch integration — 2026-11-28

Status: active. Owner: ChatGPT, at the repository owner's request.
Branch: `feat/cowgol-integration-20261128`. Base: `2f5aebabc023d5473958a549318d99adfd92819a`; current default at claim: `ca1e54a6733d17f9a97ffca12747af28c8f3849d`.

Continue the existing Cowgol integration lane with two qualified expansions: booted MS-DOS 2.0 on the actual 80386 core (console and Controller display), and an explicit bare ATmega168P 16 MHz runtime with its own 16 KiB flash and 1 KiB SRAM limits. Retain source ownership, cancellation, image policy and target validation across both routes.

Owned paths: Cowgol editor/client/CLI routes, the 386 DOS bench and associated machine activation/schema/runner integration, Cowgol tests and witnesses, related documentation/workflows, and the exact producer pin plus its map-derived source/gallery/mirror outputs. Owning sibling boundaries: `CrispStrobe/cowgol` runtime and execution oracle, `CrispStrobe/stc-compiler` target build/service/demo, and `CrispStrobe/sb3-creator` checked generation/source contracts. Preserve unrelated main and open-PR work. Machine-engine pins remain fixed unless independently qualified.

The owner now explicitly requests incremental GitHub saves and an attempt to merge the completed integration into each repository's default branch. This supersedes the earlier lane's feature-only delivery direction. Use reviewed dependency order, normal protected-branch PR merges, and exact supplier identities; never overwrite newer default-branch work or bypass a failed gate.

Qualification: dedicated conversion/editor/ownership/refusal tests; exact-MCU cold-memory, heap/stack, flash and GPIO/delay execution for ATmega168P; full Cowgol and checked DOS programs booted through the guest kernel with live shell input and rendered text on 386; regression runs for existing compiler targets; canonical producer identity/gallery/mirror checks; normal enabled PR checks. No physical-board or production-app release claim follows merely from these software checks.
