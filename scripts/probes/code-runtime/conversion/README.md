# Python reader semantic witnesses

This bounded probe records what Brickwright's Python reader emits for eight small, originally authored Python programs. It compares the **input programs' actual CPython stdout** with the **reader's emitted pseudocode and warnings**. It does not execute that pseudocode in Creator or Scratch VM, and it does not measure the Code tab, a browser, a board runtime, or game behavior.

The input uses the reader's existing `when_flag_clicked` convention. The harness loads the actual `Tokenizer`, `Parser`, and `Translator` classes and their actual Scratch runtime helpers. It removes only ES module import/export declarations to load them in isolated Node execution. The application wrapper and board-specific routing are outside this probe.

## Reproduce

From the repository root, with Node.js and CPython 3 installed:

```sh
node scripts/probes/code-runtime/conversion/reader-semantic-probe.cjs
```

The default source root is four directories above the harness, matching its intended `scripts/probes/code-runtime/conversion` location. To use another checkout or Python executable:

```sh
node scripts/probes/code-runtime/conversion/reader-semantic-probe.cjs --source-root=/path/to/brickwright --python=python3 --output=/path/to/results-rerun.json
```

`--python` names an executable, not a shell command; on systems where CPython is named `python`, use `--python=python`. No npm dependencies are needed. The original run used Node v24.22.3 and Python 3.12.14 on Linux x64; other environments have not been qualified by this result.

The harness reads these files from the checkout, with no vendored reader/helper copies:

- `overlay/scratch-gui/src/lib/sb3-creator-python.js`
- `overlay/scratch-gui/src/lib/sb3-creator-scratchruntime.js`

It verifies both the Git blob SHA-1 and SHA-256 in `metadata.json` before loading either file. The pinned content was read at commit [`14de1c42bd2e2ea84086a2162d1eff1fdbbac20d`](https://github.com/CrispStrobe/brickwright/commit/14de1c42bd2e2ea84086a2162d1eff1fdbbac20d). A later checkout is acceptable only while these file bytes still match. An altered source file or checkout line endings produce a deliberate hash error; use the pinned LF source to reproduce these historical observations. Do not update the hashes and present a new result as the original measurement.

The default output is `results-rerun.json`, leaving `results.json` untouched. The latter preserves the original raw run and its timestamp, source hashes, exact fixture bytes, CPython output, reader output, and warnings. Its `sources[].local` fields refer to the original scratch input locations; those inputs are not bundled here. `metadata.json` uses repository-relative source paths for reruns.

## Recorded observations

Each fixture consists of ordinary separate Python lines inside the event function. All eight input programs completed in native CPython with the expected stdout. All eight reader results had an empty warning list.

| Fixture | Native CPython stdout | Observed reader output |
| --- | --- | --- |
| `floor_division` | `3` | Changes `7 // 2` to `(7 / 2)` |
| `negative_floor_division` | `-4` | Changes `-7 // 2` to `(-7 / 2)` |
| `multiply_assignment` | `6` | Changes `x *= 2` to `change x by 2` |
| `divide_assignment` | `4.0` | Changes `x /= 2` to `change x by 2` |
| `modulo_assignment` | `2` | Changes `x %= 3` to `change x by 3` |
| `break` | `3` | Omits `break` and emits a `FOREVER` loop with an empty conditional body |
| `continue` | `2`, then `3` | Omits `continue`, leaving an empty conditional body |
| `supported_plus_assignment` | `5` | Emits `change x by 2`, a supported control case |

These observations demonstrate reader-level translation changes without diagnostics. The inferred downstream arithmetic or control-flow consequences must not be presented as measured Scratch VM output: this probe does not run Creator or the VM. The recorded cases are evidence for explicit subset boundaries and semantic preservation work, not a coverage score for the entire converter or an execution-runtime benchmark.

## Contents and exit behavior

`fixtures/` contains the exact input programs. `metadata.json` contains source pins and expected native stdout. `results.json` contains the original raw observations. `reader-semantic-probe.cjs` reproduces the bounded reader exercise from a matching checkout.

The process exits nonzero for a source-hash mismatch, native execution/output failure, or reader exception. Known reader semantic changes are intentionally recorded rather than made a failing regression gate: fixing them should eventually change the recorded output, after which new evidence and a separate preservation test should be added deliberately.
