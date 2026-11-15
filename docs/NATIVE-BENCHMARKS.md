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

Whetstone currently fetches its source and retained permission only. The owned
package does not host its qualified software floating point PRINTOUT executable.
The generated build links ia16 runtime libraries; source permission alone does
not establish those runtime redistribution obligations. Automatic browser Run
remains disabled until an owned executable package carries the exact build,
source, linked-runtime notices/exception and byte identity. This explicit
boundary does not reclassify the already-qualified native CLI path.

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
