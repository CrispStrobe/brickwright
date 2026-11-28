# Language and platform extension plan — 2026-11-28

Status: DONE — current audit, LP0–LP5 sequence and distribution boundary recorded.

Owner: Language/platform extension maintainer, at the repository owner's request.
Branch: `codex/language-platform-plan-2026-11-28`.
Base: `b474327531ab9133f27c69fce9c6bd776bce2b50`.
Work is prepared in an isolated checkout. Publish small remote checkpoints and
land with guarded, non-force updates; preserve all unrelated tree entries.

## Scope

- Add the audited current language/target distinctions, LP0–LP5 sequence,
  Simulator/silicon acceptance criteria and distribution policy to `PLAN.md`.
- Add matching milestones and the existing matrix cross-link to `ROADMAP.md`.
- Maintain this claim's status and evidence.

Merge this claim before changing the plan. The new track extends the existing
R0–R4/G0–G4/J0–J6 plans and capability registry. Existing Code document,
Pico simulator and integration qualification work stays with its current owners,
including PR #1855. Application sources, supplier code, dependency pins, generated
mirrors, workflows and actual runtime adoption are outside this documentation
lane. A separately claimed LP1 slice follows the completed planning merge.

## Qualification

Review source-backed route claims and repository links. Confirm that only these
two root documents and this claim change, preserve their existing content, check
the repository tree shape, and use the existing documentation-only qualification
rules. Planning does not close pending runtime, hardware or license reviews.

## Completion

The claim landed first at `84bcc53b16c3a4f98d9c75a9fc592bed0184c60b`.
The implementation commit for this documentation lane adds the dated plan and
roadmap sections, preserves the existing runtime milestones, and cross-links the
older language/device section. Source audit baseline and open integration
ownership are stated explicitly. Only the two root documents and this claim
change; unrelated tree entries are preserved. The distribution boundary follows
the owner's explicit non-NC/non-GPL vendoring and optional GPL WASM instruction.

LP1 implementation requires its own claim. No source, runtime, firmware, compiler
payload, dependency pin or hardware qualification changes in this lane.
