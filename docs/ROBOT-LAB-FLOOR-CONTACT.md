# Driven linkage floor contact

Status: complete. [PR #1445](https://github.com/CrispStrobe/brickwright/pull/1445)
merged normally as `7b4f2f84ac55e238bbb75663acbdc1e26f3d0358` and closed
[issue #1436](https://github.com/CrispStrobe/brickwright/issues/1436).
The reviewed source was `65cb2cded84aca8b74f6e43eb80901608fd2dfce`;
34 enabled checks succeeded, seven conditional checks were declared skipped.
All six unit shards passed: 13,069 passes, zero failures. The eight actual floor
cases, original Sarrus assertions, API sampling controls and four selected
browser jobs were independently audited from retained originals. These are
finite source/engine observations, not deployment or physical-accuracy evidence.

No floor source task remains from this change. Keep the regression cases and
rejected-candidate failures. The separate resting-frame task is scoped in
[the successor handoff](ROBOT-LAB-RESTING-CREEP.md). The contract below explains
what the merged implementation and its acceptance tests establish; references
to the candidate describe that qualified implementation.

Issue #1436 reports that the collapsed single-chain Sarrus, driven with the
intact model's original program, crosses the thin generated floor and then
falls freely. The shipped observe-only control avoids driving the collapse;
it does not correct collision handling.

The candidate keeps the original floor box, body origin, material, convex
radius and footprint. Complex compounds normally remain Discrete. Before each
fixed step, a complex body whose downward travel exceeds the existing 0.2 mm
penetration slop is checked against the floor. If its lowest overlapping collider
support, projected by that travel, would exceed the existing 2 mm contact margin
below the surface, that step temporarily uses LinearCast. Motion quality is
restored before observers or checkpoints, including when a native step throws.
Explicit Discrete/collider-cutoff experiments retain their original policies;
whole-body ground collision exclusions remain honored. Small bodies retain their
existing sweep policy. No returned pose is clamped or teleported.

Authored geometry, the eight-collider default cutoff, solver settings, fixed
steps, models and drive programs remain unchanged. The trigger uses linear
velocity and conservative collider bounds; it does not promise to catch every
angular or constraint-driven contact failure. Hosted qualification must establish
the named scenarios and unchanged ordinary models before landing.

Two geometry prototypes are rejected. A plane-at-top candidate failed unchanged
RCX drive, loaded-rack hold and Powered Up comparisons. A deeper box passed all
eight targeted cases but failed the existing differential-car return-distance
and loaded-rack hold assertions. Both tests passed in the retained qualified
baseline with unchanged test and actuator sources. These are candidate regressions;
no existing assertion or threshold is weakened to accommodate them.

The fixture manifest binds the served models, original drive, observe-only
program, licences, SDK version and integrity. It reads the SDK URL from the
existing canonical declaration in `scripts/integrate.mjs`; it performs no SDK
fetch or dependency-pin change. The fetch-pinning census and mutation proof
remain unchanged. A duplicated fixture URL made the first candidate's census
red and is removed in favor of that single authoritative pin source.

Separate processes load the byte-exact retained old core and current candidate
at the original module URL, preserving relative imports without overwriting
source files. Eight actual hosted cases are required: old/candidate nine-collider
fast drop, old/candidate driven single-chain, original intact Sarrus, and held
controls at requested cold starts of 0, 275 and 1000 ms. The unchanged helper's
frame clock quantizes cold-start timing. All original intact Sarrus assertions
remain required, including motion, phase, axes, clearance and rollback.

Every fixed step records conservative transformed collider AABB bounds, without
clamping engine poses. Candidate Sarrus bodies must stay within the footprint
and none may pass wholly below the original slab. The deliberately fast compound
drop has a separately predeclared 20-step recovery bound. The old kernel must
show an escape while over the footprint. Its series remains finite and retained
even if the failing model subsequently leaves the footprint; that later flight
cannot manufacture the required in-footprint failure.

The original drive remains unchanged on the single-chain model. A blocked drive
can time out or stop early; its completion state is separate from floor safety.
No timeout is called program success. The driven observation lasts at least
30 simulated seconds. The real motor API is observed and called unchanged;
driven cases must request the original first target, held cases must not drive,
and the intact motion judge prevents a muted-motor false pass.

The Sarrus test invokes the fixture qualifier using its existing GUI dependency
declaration, then executes the standalone scalar reader on the original reports.
It also requires that reader to reject a missing case. Hosted TAP retains the
full scalar series. The compound drop also requires a ten-step trajectory to
repeat bit-identically after native/core rollback before its measured series.
After metadata admission, the same reader can audit the
retained TAP without producer imports or an engine replay:

`node scripts/verify-sim-floor-contact.mjs <retained-tap-file>`

Run it from the frozen tested checkout to bind the reported candidate hash to
that exact source. This audits the retained scalar series, not an independently
reconstructed full pose trajectory. Source checks and a finite pose alone do
not qualify contact. Real engine cases run in hosted CI; local pure tests do
not establish physics acceptance.

Finite footprint and linear-risk-trigger limits remain explicit. No general
solver-stability, hardware, calibration, performance or physical-accuracy claim
is made. Issue #1435's separate resting-frame creep is fixed outside this lane
([ROBOT-LAB-RESTING-CREEP.md](ROBOT-LAB-RESTING-CREEP.md#fix-2026-10-30)): the
core drops idle speculative floor hits of compound bodies; this floor sweep is unchanged.
A red actual case keeps the source unmerged and must be diagnosed without
changing its acceptance thresholds.
