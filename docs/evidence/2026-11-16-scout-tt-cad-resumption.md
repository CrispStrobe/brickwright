# Scout TT CAD integration — resumption verification

Date: 2026-11-16. Environment: Node 24.22.1, npm 11.9.0.

This continuation recovered the existing work from GitHub and verified it
without changing runtime source, the SDK pin or the saved private demo.

- Tested Lite source: [`3ae00ea69a307d1eb8647bd514037c53da692901`](https://github.com/CrispStrobe/brickwright-lite/commit/3ae00ea69a307d1eb8647bd514037c53da692901).
- Clean-source CAD SDK: [`0ee57d91be6f4f910f8b8d6106ba894b9b1a8d1d`](https://github.com/CrispStrobe/brickwright-cad/commit/0ee57d91be6f4f910f8b8d6106ba894b9b1a8d1d).
- Working branch: `feat/pla-rover-cad-20261115`.
- Its merge retains main `6e8f065c6798cc4bfa1261f5c9413e69c4cbf367`
  and the shared CAD/control branch `fc333ddf88023cf17e9bb5973109b74a350f2ab7`
  as parents. Both remain ancestors of the tested source.

## Fresh local results

| Check | Result |
| --- | --- |
| Five focused test files listed below | PASS: 13 tests, no failures or skips |
| Vendored SDK manifest and file digests | PASS: clean source identity and all 10 SHA-256 hashes |
| `node scripts/check-mirrors.mjs` | PASS; optional sync probes not invoked |
| Saved private Scout TT demo | PASS: exact BCAD, A/B hinges, program, complete notices and all five artifact hashes |
| Production GUI build with serial minification | PASS: webpack 242,856 ms; two asset/entrypoint size warnings, no compilation errors |
| Emitted `build/static/cad-sdk` | PASS: manifest bytes and all 10 runtime/notice hashes match the pinned SDK |

The focused tests ran through the repository's normal GUI dependency resolver:

```sh
node --test --import ./scripts/lib/register-gui-scope.mjs \
  test/cad-project-bundle.test.mjs test/bw-cad-preferences.test.mjs \
  test/cad-lab-dialect.test.mjs test/cad-program-api.test.mjs \
  test/cad-rover-project.test.mjs
```

Dependencies were installed from the committed GUI lockfile with
`npm ci --ignore-scripts --legacy-peer-deps`, following the repository's
legacy-peer installation mode. Standard integration and VM, paint and render
overlays were applied. Tracked source remained unchanged after verification.

The existing `scripts/verify-cad-rover-project.mjs` verified the saved
`examples/scout-tt-rover/lite/` files restored from CAD source `0ee57d91`.
It accepted the same five artifact identities recorded in the
[original integration receipt](2026-11-15-scout-tt-cad-integration.md);
the demo was not regenerated or copied into this public repository.

## Build resource handling and browser limit

The first ordinary `NODE_ENV=production BW_ENABLE_CAD=1 BW_ENABLE_FPGA=0 npm run build:gui`
attempt reached Terser minification and was killed with exit 137. It is retained
as a failed attempt, not counted as a build pass.

The successful retry loaded the unchanged production webpack configuration in
a temporary runner. It reproduced webpack 5.96.1's default Terser options
(`compress.passes: 2`) and changed only `parallel: false`, with a 4 GiB Node
heap. Compilation, minification and the SDK byte-preservation checks all
completed. No build configuration or runtime source was edited for this retry.

The existing SDK browser smoke was attempted with system Chromium and a
workspace temporary directory. Chromium failed before opening the application
because its process-singleton socket was denied (`Operation not permitted`).
No fresh browser interaction, native application release or deployment is
claimed. The earlier receipt's browser limit remains explicit.

## Branch scope

The later `feat/steerable-3d-robot-20261115` branch
(`272d913eaf86d2b3e176363aa3097566e6523927`) is a separate Trident steering
experiment based on an earlier Scout checkpoint. It was inspected and left
intact rather than folded into this Scout continuation. The qualified Scout
SDK continues to use `0ee57d91`; subsequent CAD documentation clarifications
do not change that runtime identity.

GitHub Actions were not used or awaited. These checks establish the stated
software behavior and artifact identities. Physical Adafruit transport,
printed fit and real robot performance remain separate hardware work.
