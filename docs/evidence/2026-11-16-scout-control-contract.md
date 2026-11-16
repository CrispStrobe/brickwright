# Scout TT control and saved-program verification

Date: 2026-11-16. Continued from Lite `e10b5a586da28e5a68176c7989a0a17a3d278828`
(PR #1792). The existing clean CAD SDK pin remains
`0ee57d91be6f4f910f8b8d6106ba894b9b1a8d1d`.

## Change and reason

The rover packager previously accepted any two A/B hinges, including a fixed
base or wheel axes that would drive in opposite directions. The saved-example
verifier checked its source-text sidecar and hashes without independently
checking the executable block graph. A changed `project.json` could therefore
pass after refreshing the artifact hash while retaining the original text.

`scripts/lib/cad-rover-contract.mjs` now checks the explicit mobile-base
setting, dynamic chassis/wheel assemblies, fixed-joint connectivity and signed
world-space axes. Separate casings and equivalent reversed connector body
ordering are accepted. Axis transformation uses the CAD connector contract:
degree rotations applied X, then Y, then Z; body scale does not rotate axes.
No model geometry, simulation runtime, tolerance policy or existing saved
artifact is changed.

Both packaging and saved-file verification now inspect the actual executable
SB3 graph. They require the intended green-flag sequence, simultaneous A/B
speed commands before each wait, braking and final simulation Stop. Native
menu shadows, input literals and parent/next ownership are checked; additional
scripts, detached blocks and cycles are refused. Authored CAD bytes and the
MIT/BSD notices remain intact, and artifact identities remain independent of
SDK pins.

## Fresh local evidence

```sh
node --test --import ./scripts/lib/register-gui-scope.mjs \
  test/cad-rover-project.test.mjs test/cad-lab-dialect.test.mjs \
  test/cad-project-bundle.test.mjs test/bw-cad-preferences.test.mjs
node scripts/check-mirrors.mjs
git diff --check
```

The four focused files pass all 16 tests. Controls include anchored and static
assemblies, fixed loops, a shared wheel, disconnected chassis, transformed
axes, equivalent reversed connectors, modified speed, a wait inserted before
wheel B, broken ownership, cyclic links, extra scripts, detached blocks,
changed braking and dynamic inputs. A CLI regression first accepts an intact
saved project, then rejects an executable speed edit even with its artifact
SHA-256 refreshed. Mirror and whitespace checks pass.

The exact recovered private Scout BCAD (3,486,736 bytes) also passes the new
contract. The normal generator produced a fresh demonstration from those
bytes, and the normal saved-file verifier passed its exact CAD, executable
program, notices and five artifact hashes. A second copy with compiled speed
changed from 120 to 121 and its SB3 hash recomputed was refused, while its CAD,
program-text sidecar and notices remained unchanged. This checks the real
Scout geometry input with a newly generated SB3; the original saved private
SB3 was not rewritten.

The existing SDK's ten runtime/notice SHA-256 values all match its manifest.
The only test dependency linkage was an untracked symlink to preinstalled
JSZip 3.10.1, the same version in the committed GUI lockfile. No package or
lockfile changed. The earlier `cad-program-api.test.mjs` attempt was blocked
at extension loading by the missing installed Scratch VM `argument-type`
module; it is not included in the passing count. A full GUI installation or
build was unnecessary for these offline packaging scripts.

These are nominal document/control and executable-artifact checks. Collision
qualification, traction, printed fit, physical motor transport and a hardware
build require their separate evidence. GitHub Actions were not used or
awaited.
