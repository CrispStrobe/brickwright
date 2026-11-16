# Native benchmark panel browser evidence

Actual tested source: `869f8df1c57f7e19da810cee278ec14bb464d83a`.
The production bundle and seven completed React/cache tests came from
`da17bc965786c89d1da01910496835566187c214`; production panel, native engine,
asset catalog and test inputs remained unchanged. Only the browser fixture's
UTF-8 declaration and failure diagnostics changed. The retained production JS
was reused byte for byte; npm, tests and webpack were not repeated.

The [machine-readable result](browser.json) records actual native execution,
exact runtime module/bundle hashes, original output, Stop progress, source and
media identities. [TOPBENCH screenshot](native-topbench.png) and
[Whetstone screenshot](native-whetstone.png) show the actual rendered panel.
The boundary is a focused production bundle of the shipped React panel,
including its real launcher, fetching owned immutable media and invoking the
actual native engine. This does not establish a full installed Lite app run.

TOPBENCH `-i` intentionally prints six result rows and calls `halt(4)` in the
[pinned owned source](https://github.com/CrispStrobe/brickwright-media-lab/blob/c8dc584d39b69b1ed9f98af69e548d9da3d5b240/projects/x86-benchmarks/topbench/source/TOPBENCH.PAS#L1459).
The observed native run had all six finite positive rows, no unsupported
services, the declared CGA absence-query contract, and exit 4 after 2,222,281
retired instructions. Stop was exercised during actual execution at 49,999
retired instructions and remained stopped. This proves the declared functional
CGA/`-i` path, without claiming general TOPBENCH or hardware-detection conformance.
The release 0.40c/displayed 0.40b discrepancy is preserved.

Whetstone's exact software floating point PRINTOUT validation bytes completed
with exit 0 after 24,021,261 retired instructions. All ten numeric modules and
a positive guest-clock duration passed; the required runtime exception and
Berkeley notices were displayed before Run. Functional counters and guest-clock
scores establish no physical CPU calibration, speedup or performance comparison.

The browser phase completed in 69.59 seconds with 735,997,952 bytes peak
process-tree RSS under the existing limits. These host resource observations
are qualification limits, not guest benchmark measurements.
