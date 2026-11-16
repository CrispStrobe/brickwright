# CAD SIM optimization continuation — 2026-11-16

## Recovered and integrated source

The interrupted Lite branch `feat/cad-sim-optimization-20261116` ended at
`b85ffc5334fa338c08d812f0a9656c59a12dc3a6`. It was already an ancestor of
current main `259a563d71391f8b310b2c4b7fb2d3bb4d607971` when this continuation
started. The compact feedback, servo/motor connection choices, document
ownership and panel polling improvements had therefore survived.

Work continues on `feat/cad-sim-optimization-resume-20261116`. All remote branch
refs were fetched, recent PRs reviewed, and these checkpoints saved remotely:

| Checkpoint | Change |
| --- | --- |
| `c272854df4a9e62286003b8f1bc4a75b35a1f9da` | Current main plus Mantis packaging work, preserving its branch ancestry |
| `c9cd717b2666190da6c5f576bf38d3eb9b541649` | Immediate cancellation of Circuit readiness and owner acknowledgement waits |
| `4f971858567cf1d9a1dac5e8fdc7245c3cdc7ba6` | Immediate release of circuit ports and clock during cancelled initial sensing |
| `77b392bcbcd21f0226d9cf5fcf82623a8b064e3f` | Newly pushed current-versus-historical x86 dependency identity correction |

The current CAD SDK stays pinned to
`fb8c3671aef1a2d5dc3673e7eb04bde38cc3f77b`. CAD main
`f685ef9c742873d1957eeae49a5406a96cceb2d9` is its direct documentation-only
successor. The recovered optimization implementation is already in that SDK.
No generated SDK chunks or supplier pins were rewritten in this continuation.

The Mantis branch `59376b45ced382c3a9f8dcadddc9bd876c8e9b58` supplies the
public project packager and packaging tests. Its older SDK was not adopted:
it lacks the newer library cohort. The packager accepts a supplied Mantis CAD
document; the current catalogue does not include that experimental model. Its
sequential movement program remains physically unqualified. Kestrel's gripper
failure and the dependency-reuse tooling deferral recorded in the existing
integration receipt remain in force.

The later x86 correction `23bb8ef1fbcb7909ab5a7e55f0e8b0769285ed7f`
separates live package declarations from sealed historical finite-v10 sources.
It retains exact source seals and negative mutation controls; no runtime,
supplier pin or historical producer/reader changed.

## Cancellation fixes

Stop or disposal could leave a Circuit readiness promise, event listener and
30-second deadline alive. The owner-acknowledgement wait could similarly remain
pending for 10 seconds. Each preparation attempt now owns an AbortController;
cancellation removes both waiters immediately. Genuine timeout/rejection errors
still propagate, while late callbacks cannot alter a restarted run.

A second case occurred after circuit ports and the Board clock had been claimed
but before the first asynchronous CAD sensor reading completed. The session was
not yet returned to the bridge, so Stop could not release those resources until
the worker replied. An optional preparation signal now releases those ports and
the clock immediately and settles the cancelled start. Late worker success and
failure remain handled without publishing data to a new session.

Regression controls failed against the preceding implementations: four readiness
cancellation cases before the first fix, and two sensor-ownership cases before
the second. The twelve resulting cancellation tests cover Stop, disposal,
synchronous cancellation inside host events, repeated attempts, restart
isolation, late success/failure and genuine errors.

## Fresh local results

Node **22.23.5** was used for the installed dependency verification and final
integration tests. The canonical `worktree-deps.mjs link` install and subsequent
verification completed with the exact lockfiles and supplier pins.

- **57/57 CAD integration tests passed**, with no failures or skips. They include
  cancellation, panel observation, compact feedback, real H-bridge current and
  back-EMF, AVR encoder stopping, project persistence, language/control APIs and
  Scout/Atlas/Mantis packaging.
- **6/6 focused x86 identity and source-reconstruction controls passed**, including
  rejection of altered historical source extents and individual live-pin errors.
- `check-mirrors.mjs` passed. GUI dependency-scope logging observed no redirects.
- All ten vendored CAD SDK files match their manifest hashes.

The focused x86 command was:

```sh
node --test \
  --test-name-pattern='live GUI declarations and frozen finite-v10|reviewed scheduler-test delta|reviewed fixture inverse|a Board pin advance|F10 keeps every|live SB3 stays current' \
  test/i80386-hdd-gui-actual.test.mjs test/pin-move-chain.test.mjs
```

This does not rerun the broad physical x86 qualification suite. Historical
vendor-pin blobs were fetched in a batch to avoid serial lazy fetches from the
fresh partial clone; no history or qualification policy was changed.

## Real shipped-worker feedback equivalence

Run the reusable local check with:

```sh
node scripts/verify-cad-telemetry.mjs
```

It extracts the existing Scout CAD document from the shipped SB3, verifies the
SDK hashes before and after, and runs the untouched simulation worker, geometry
engine and release Jolt WASM through a small Node WebWorker environment adapter.
It uses no hosted compiler. The portable script was run from outside the repo
working directory under Node 22.

Two runs apply identical mechanical impulses and a body-mounted ray for
100 steps of **5 ms**. Full feedback is compared with compact feedback whose
complete pose frame appears every fourth step (50 Hz presentation).

| Observation | Full feedback | Compact feedback |
| --- | ---: | ---: |
| Physics steps | 100 | 100 |
| Complete pose replies | 100 | 25 |
| Compact replies | 0 | 75 |
| Bodies in each complete frame | 23 | 23 |
| Serialized feedback, UTF-8 JSON bytes | 472,059 | 136,149 |

The serialized feedback representation is **71.1585% smaller**. All 100 joint,
speed and ray telemetry samples, all 25 corresponding complete pose frames,
and the final state match exactly. Stop/sense do not advance physics; invalid
impulses are refused; restart exactly reproduces the initial frame and first
step. The source document, SB3 and SDK files stay unchanged.

The [dated receipt](../receipts/2026-11-16-cad-telemetry-worker.json) includes
source, SDK, verification-script and adapter hashes. Its elapsed times are
diagnostic values, not a controlled wall-time or frame-rate benchmark. The
worker check does not exercise the mounted editor or complete circuit/firmware
stack; the separate integration tests cover the stated circuit/AVR behavior.

## Production build and browser boundary

The production CAD+FPGA GUI build is being completed locally from runtime source
at `77b392bcbcd21f0226d9cf5fcf82623a8b064e3f`. The unchanged production
webpack configuration uses its default two-pass Terser options with serial
minification and a 4 GiB heap to bound local resource use. This receipt will be
updated with the observed build and packaged-SDK results.

Chromium was attempted with a writable temporary directory and aborted before
opening the page because `process_singleton_posix.cc` could not create a Unix
socket: `Operation not permitted (1)`. No fresh browser pass is claimed. No
sandbox escalation or hosted compiler upload was performed.

GitHub Actions were not awaited, dispatched or rerun. No release, deployment,
native application install or TestFlight upload is part of this continuation.
