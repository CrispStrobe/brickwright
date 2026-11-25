## Public lane metadata cleanup — 2026-10-12

DONE candidate — Codex, isolated branch `fix/public-lane-metadata-followup-20261012`.
Follow-up to [#824](https://github.com/CrispStrobe/brickwright/pull/824):
remove one newly introduced operator location and session identifier from a claim;
keep its worker identity, task envelope and status unchanged.
Envelope: this ledger only. Remove operator machine locations, private session
and terminal identifiers from public coordination prose; preserve task owners,
branch/source identities, statuses, evidence links and acceptance criteria.
No executable, workflow, package pin or peer implementation change.
