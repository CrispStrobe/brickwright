# Language and platform extension plan — 2026-11-28

Status: CLAIMED.

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
