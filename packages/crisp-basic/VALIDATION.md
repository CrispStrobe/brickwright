# Restricted WASM milestone validation

Local validation recorded on 2026-11-27 for version `0.1.0-dev.2`.
These are local results. GitHub Actions is configured independently and its
live run must be checked before claiming CI success.

## Environment

| Component | Tested version |
| --- | --- |
| Host | Linux x86-64 |
| Node | 24.22.3 |
| GCC | 14.2.0 |
| NASM | 2.16.03 |
| Emscripten | 3.1.64 (`a1fe3902bf73a3802eae0357d273d0e37ea79898`) |
| Playwright | 1.62.1 |
| Chromium headless shell | 156.0.8078.79 |
| BBCSDL | `6c302988ee2a08c5f9a65fa3eb8e76bcacc6079f` |

The workflow uses Node 22 on Ubuntu 24.04. That CI environment is a separate
qualification from the local Node 24 results recorded here.

## Results

| Suite | Tests reported | Result |
| --- | ---: | --- |
| Source preparation | 13 | Passed |
| Native runtime and CLI | 41 | Passed |
| WASM runtime and restricted-host policy | 120 | Passed |
| Native/WASM corpus with fixed expected bytes | 10 | Passed |
| Real Chromium workers | 13 | Passed |
| **Package total** | **197** | **Zero failures or skips** |

The WASM count includes grouped policy subtests. Its runtime cases exercise
interactive input through recursive functions inside procedures, `ON ERROR
LOCAL` after suspension, GET/INKEY and CRLF handling, WAIT/TIME, output limits,
hard deadlines, cancellation, repeat-instance isolation, concurrent sessions,
observer failures and malformed worker messages.

Policy checks verify actual BASIC errors for host calls, file operations,
address access, pointer retargeting, system variables, host events, sound and
screen queries. Regression checks cover constructed EVAL token bytes, while
ordinary EVAL, Latin-1 literals, arrays, structures, functions and formatting
retain their expected behavior. Ordinary restriction errors remain catchable
with ON ERROR; parent-owned deadlines and termination do not depend on it.

Browser tests use real module workers over HTTP without cross-origin isolation.
They verify page responsiveness during tight BASIC loops and verify that workers
are gone after completion, cancellation, reset and disposal. They also test
delayed recursive input, output bytes, error mapping and simultaneous sessions.

The ten parity cases compare each backend with a fixed expected byte sequence,
then compare the two results. They exercise the same BBCSDL implementation and
are not evidence from an independent language implementation.

Thirty-five repository workflow checks also passed:

```sh
node --test test/ci-workflow-inputs.test.mjs \
  test/workflow-concurrency-isolation.test.mjs \
  test/workflow-step-refs.test.mjs
```

## Reproduction

From `packages/crisp-basic`, with both toolchains available:

```sh
npm run build:native
npm run build:wasm
npm run test:all
npm ci --ignore-scripts
npx playwright install chromium
npm run test:browser
node examples/run-wasm.mjs
```

The local browser run used the documented `CRISP_BASIC_PLAYWRIGHT` and
`CRISP_BASIC_CHROMIUM` overrides to select installed tools. The standalone WASM
example printed the anchored structured-program result successfully.

The final locally tested WASM artifact was 210,635 bytes, with SHA-256
`1c1322a8ac209f925a35be6b8c722ac63736ae627c750d2fcfe042b3a9c5b6e5`.
The builder recorded six verified upstream inputs, 23 allowed runtime imports,
and five preserved toolchain notice files. These measurements describe this
build; another qualified toolchain/host may produce different binary bytes.

## Boundaries

The browser engine is qualified here in Chromium only. Brickwright adapters,
other browser engines, graphics rendering/queries, virtual files, source
debugging, GPIO and physical-board execution are not implemented or validated
by these results. WASM/worker isolation restricts the host boundary; it does not
prove the upstream C interpreter free of faults within its own linear memory.
