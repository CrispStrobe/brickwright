# Native i80386 benchmark panel

Open Settings → **Benchmarks (native i80386)…**. Fetch verifies immutable owned
media-lab metadata, byte counts and SHA-256 hashes. Review the retained license
notice before Run. Cache storage is optional; every cache read is rehashed.
Stop or Close aborts fetch/execution and prevents stale completion publication.
Execution uses an isolated machine and never changes the current project.

TOPBENCH release 0.40c displays a 0.40b banner. The native DOS startup and CGA
query contract are the exact media-lab helpers recorded in
`src/lib/bw-native-benchmarks/provenance.json` inside the GUI package. They are
mechanical mirrors, with retained MIT license and digest checks. Engine code
comes from the existing pinned `bw-board` package. Ordinary machine stepping,
DOS service startup, six screen score checks, exit4 and zero unsupported services
are required; a terminal exit alone is insufficient. These values are functional
guest-clock results, without a physical CPU timing or speedup claim.

Whetstone fetches the exact already-qualified software floating point PRINTOUT
validation executable, unmodified source, all runtime notices and a 139-member
source/notice inventory from the owned `whetstone-validation` package. It uses
full floating-point printf; admission requires all ten numeric modules, a
positive guest-clock duration, exit0 and zero unsupported services. The original
build did not capture runtime archive hashes: the supplied current package
archive hashes/source mappings do not establish bit-identical historical
archives or blanket license clearance. The complete Berkeley acknowledgment,
Newlib/Libgloss notices and applicable GCC runtime exception are displayed
before Run. The executable is fetched separately and is not bundled into Lite.

Asset identity is pinned to media-lab commit
`c8dc584d39b69b1ed9f98af69e548d9da3d5b240`, introduced by
[the owned validation asset PR](https://github.com/CrispStrobe/brickwright-media-lab/pull/37).
The startup/result helper byte identity remains pinned separately to
`01d06fb63d5bdd4c0ede48e811e8fc1f6971d2ce`.

Validation commands:

```sh
node --test test/native-benchmarks.test.mjs test/native-benchmarks-component.test.mjs
NATIVE_BENCHMARK_EVIDENCE=artifacts/native-benchmarks node scripts/verify-native-benchmarks-browser.mjs
```

The component controls use mock asynchronous boundaries and are labeled as
such. The browser script builds the shipped panel in a focused production
bundle with the real pinned native engine, fetches exact owned media and drives
Run/Stop/render/terminal status. It is not a full installed application proof,
benchmark comparison or new performance measurement. The screenshot and JSON
receipt bind the actual native result and source/package identity.

On a bounded Linux host, npm can start parallel Git dependency preparation
installs despite the outer `--ignore-scripts`. The canonical dependency helper
can serialize those subprocesses without changing package inputs, pins, scripts
or the store key:

```sh
mkdir -p artifacts
BW_LITE_SERIAL_GIT_PREPARE=1 BW_LITE_NPM_PREPARE_LOCK="$PWD/artifacts/git-prepare.lock" \
  node scripts/worktree-deps.mjs link
```

This opt-in scheduler leaves top-level npm commands unchanged, permits
descendant preparation without self-deadlock, and bounds queue waits. Existing
RSS, disk and time guards still apply. Its synthetic subprocess controls are
separate from the actual browser/native-engine proof.
