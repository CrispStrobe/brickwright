# Scout TT CAD integration — local validation receipt

Date: 2026-11-15. Environment: Node 24.22.1, npm 11.9.0.

- Pinned CAD source: [`0ee57d91be6f4f910f8b8d6106ba894b9b1a8d1d`](https://github.com/CrispStrobe/brickwright-cad/commit/0ee57d91be6f4f910f8b8d6106ba894b9b1a8d1d), built from a clean checkout.
- Lite SDK checkpoint: [`d1d97fc47b01f77a4fa291a45cf64ade982de5e3`](https://github.com/CrispStrobe/brickwright-lite/commit/d1d97fc47b01f77a4fa291a45cf64ade982de5e3).
- Integration branch: `feat/pla-rover-cad-20261115`. Its merge preserves the original latest-main and PR #1791 parents.

## Observed Lite and shared SDK checks

| Check | Local result |
| --- | --- |
| CAD `npm run build:brickwright-sdk` | PASS; production SDK packaged with 10 hashed runtime/notice files and `dirty: false` |
| Lite `node scripts/sync-cad-sdk.mjs <cad-checkout>` | PASS; exact SDK source commit pinned above |
| CAD `npm run verify:brickwright-sync -- <lite-checkout>` | PASS; all four shared interaction sources, vendor bytes, hashes and source commits agree; common Jolt URL/integrity and current SDK match |
| `scripts/verify-cad-rover-project.mjs <private-demo-directory>` with the GUI-scope loader | PASS against the final SDK; exact BCAD, A/B hinges, program, complete notices, ordinary SB3 inspection and all five artifact hashes |
| `npm run integrate`, VM overlay and paint overlay application | PASS |
| `node scripts/check-mirrors.mjs` | PASS; every duplicated fact agrees with its twin; optional `--sync` probes were not invoked |
| Focused Node tests listed below | PASS: 13 tests, 0 failures |
| `NODE_ENV=production BW_ENABLE_CAD=1 BW_ENABLE_FPGA=0 npm run build:gui` | PASS; final webpack compile 17,331 ms, with two asset/entrypoint size warnings and no compilation errors |
| Emitted `build/static/cad-sdk` byte verification | PASS; final manifest and all 10 file hashes match the pinned SDK exactly |

Focused tests used `node --test --import ./scripts/lib/register-gui-scope.mjs`
with `test/cad-project-bundle.test.mjs`, `test/bw-cad-preferences.test.mjs`,
`test/cad-lab-dialect.test.mjs`, `test/cad-program-api.test.mjs`, and
`test/cad-rover-project.test.mjs`. They cover opt-in preferences, control
compilation/round trips, host calls and cancellation, archive persistence, and
the nonblocking A/B demo program.

The inherited transform-math provenance referenced an unavailable historical
commit. CAD's metadata-only correction pins the identical shared bytes to the
existing Lite commit `acbcb1fc7b83af4002978ddb00a84df2beb6ec10`. All 10 SDK
runtime/notice hashes were identical before and after that correction.

## CAD checks observed by the CAD work owner

The same local qualification session reported **96 passing tests across 16
files**, a successful standalone production build, and successful offline
installation, geometry and real SI physics checks for all **six SDK packages**.
`robot:check` and `robot:collisions:check` passed for the complete print kit and
all **3,738 reproducible qualified collision hulls**. The i18n check passed
with **1,741 German messages and 1,355 literal/template references**. The final provenance correction changed metadata only;
manufacturing geometry, collision candidates, BCAD, STL and SB3 bytes did not
change.

## Exact private demo identities

The complete demo remains in the private CAD kit at
`examples/scout-tt-rover/lite/`; this public receipt contains hashes only.
The same saved artifacts were reverified after the final SDK pin without
regeneration. Their manifest deliberately contains no SDK commit.

| Artifact | SHA-256 |
| --- | --- |
| `tt-rover.bcad` | `0cc04d1fb74380ddfa55492110503b1c3dfde1d588cf5fc2e9a52c834374e0e9` |
| `tt-rover.sb3` | `72864f62b9fe00602d9023e0eaf52e8491647f163ab8e76b8919874579a590fb` |
| `tt-rover-program.txt` | `1885e6c1df4eb25aad1ce358c374c4a3cb5b023f3017e36d7d74d2c86a0ea924` |
| `ADAFRUIT-MIT-LICENSE.txt` | `f60436644e066301d4c2e8f1f0674a157b1f60e4fd5586717b99dde255cc18cd` |
| `BRICKWRIGHT-BSD-3-CLAUSE.txt` | `83b7bdeb9750ec95a69bd1929431c8bb4944caeed207c60297a0bed592ed9c36` |

All validation above was local. GitHub Actions were neither required nor
waited on. Browser UI interaction was not exercised because of executor access
limits. The CAD controls operate simulated actuators; these checks do not
establish physical Adafruit transport, physical fit or real robot performance.
