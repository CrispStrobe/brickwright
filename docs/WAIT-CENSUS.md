# Every wait in the browser gates: what bounds it, and what nobody counted

> Ratchet integration note (2026-08-28): the measurements below preserve the
> original five-gate sweep. By the time its gate reached `main`, CI ran eleven
> browser-gate scripts: Arduboy, labwired, debugger-only, example-selection and
> both micro:bit gates had been added. The current zero-headroom baseline is
> therefore 153 bounds and 261 fixed sleeps repository-wide; CI-run scripts own
> 106 of those sleeps (116.880 s). `test/wait-census.test.mjs` records these
> exact values so any further increase must be explained.

2026-08-24, branch `probe/lite-timeout-thresholds`, from `main` at `c552d9332`.

The lite half of the campaign in `sb3-creator/docs/MEASURED-THRESHOLDS.md`. That sweep asks,
of every number that bounds a verdict, **who measured it** — and it stops at lite's browser
gates with a stated reason:

> `brickwright-lite`'s 118 timeouts are almost all Playwright/puppeteer waits in
> `scripts/verify-*.mjs`, which need a built editor and a browser. They are listed and left;
> probing them is a lane of its own.

This is that lane. Four findings, in rough order of how much they matter:

- **D** — four fifths of the time the CI browser gates spend inside Playwright is
  `waitForTimeout`: **65.9 s of 82.0 s**, asleep on purpose, in no inventory anywhere (§4).
- **C** — the 119 counted literals govern **32** of the 279 real waits; the other 247 inherit a
  30 s default nobody wrote (§4).
- **B** — there are **249 fixed sleeps against 119 bounds**, and no threshold inventory collects
  them, correctly and unhelpfully (§2).
- **A** — **40 of the 119** are in `_tmp-` scratch scripts nothing runs (§2).

A and B needed no browser at all. Plus one found by accident that is bigger than the lane: a
test suite that cannot be *constructed* was reading as green in CI (§5).

---

## 1. Why not probe them one at a time

`threshold-probe.mjs` binary-searches a threshold's flip point, and the flip point *is* the
measurement. That is the right instrument for a floor under a corpus: cheap, exact, repeatable.

It is the wrong instrument for a browser wait. Each probe needs a built editor, a browser and a
full page load, so bisecting 119 of them is on the order of **600 browser runs** to learn
something **one run already contains**: how long the thing actually took.

A bound's evidence is the observed duration under it. So: instrument one sweep, and every
literal it reaches gets a number.

`scripts/observe-timeouts.mjs` is a Node module-resolution hook that redirects `playwright` to a
wrapper proxying Browser / Page / Locator. Every awaited call is timed and attributed to the
**caller's `file:line`** — the same key `threshold-inventory.mjs` reports a literal under, so
the two join with no mapping for anyone to maintain. **No call site is edited**, and a run
without `--import` behaves exactly as before (verified by running one gate both ways and getting
the same failure at the same line).

```
OBSERVE_OUT=/tmp/obs.jsonl PROOF_URL=http://localhost:8619/ \
  node --import ./scripts/observe-timeouts.mjs scripts/verify-editor.mjs
node scripts/aggregate-timeouts.mjs --observed /tmp/obs.jsonl
```

---

## 2. The census, and the population nobody counts

`scripts/aggregate-timeouts.mjs --census` — static, no browser, acorn not grep.

|  | bounds (`timeout: N`) | fixed sleeps (`waitForTimeout(N)`) | sleeping per run |
|---|---|---|---|
| run by CI | 26 | 64 | **61.9 s** |
| runnable, not in CI | 53 | 130 | 192.2 s |
| `_tmp-` scratch | 40 | 55 | 155.5 s |
| **total** | **119** | **249** | **409.6 s** |

The 119 agrees **exactly** with `sb3-creator/scripts/threshold-inventory.mjs`, which was written
independently and by someone else. That agreement is what makes the 249 believable, because the
249 is a population that inventory does not collect at all.

### Finding A — 40 of the 119 are in files named `_tmp-`

Ten tracked scripts whose names say they are temporary hold **a third of the entire "unmeasured
timeouts" population**, plus 155.5 s of sleeps. Nothing runs them: not CI, not `npm test`, not
`package.json`.

So a third of the population costs nothing to leave unmeasured, and saying so is worth more than
measuring it. `test/wait-census.test.mjs` ratchets the count so they cannot multiply. Deleting
them is somebody else's call — several may still be useful probes — but a file named `_tmp-`
that outlives its afternoon is not temporary, it is debt with a misleading name.

### Finding B — the sleeps outnumber the bounds two to one, and no inventory sees them

The threshold inventory counts `timeout: N` and not `waitForTimeout(N)`. **That is correct by
its own definition** — a fixed sleep bounds nothing and decides no verdict. But *correct by
definition* is not *not worth counting*, and the definition is precisely why nobody has ever had
to justify one.

A fixed sleep is a guess about how long the app needs, and it is the one kind of guess that
**cannot be checked by watching**: it costs exactly what it was given, every time. Timing it
returns the literal back.

- too short → a flake nobody can reproduce;
- too long → wall-clock on every CI run, forever.

Neither shows up anywhere. The five CI browser gates spend **61.9 s asleep per run by
construction**, before the app is asked to do anything.

An outside observer cannot measure these. It can refuse to let the total grow silently, which is
what `test/wait-census.test.mjs` does — ceilings at the measured values with zero headroom, and
a stated procedure for moving them (down freely, up only with a reason).

---

## 3. What the instrument had to survive to be trusted

Three ways this could have reported a clean sweep over nothing, all three hit for real:

**The wrapper wrapped nothing.** The first two versions keyed on `constructor.name`. Playwright
ships bundled, so the runtime names are neither stable nor documented: a Browser reported
`Browser2` through one path and `''` through another, and a Page is `_Page`. Matching `Page`
wrapped the Browser and nothing below it — **two calls recorded out of hundreds**, and a summary
table would have called that a sweep. It duck-types now: what the object *does*, not what it is
called. That is the grep-hit mistake in miniature — a name found by inspection is not a
contract, and three spellings of one class are indistinguishable from three classes.

**The hook might not install at all**, which produces an empty file — and an empty file is what a
broken instrument and a clean sweep look like alike. Every run writes an `installed` marker
before any browser exists, and the aggregator refuses a file without one, and refuses one with
zero bounded observations.

**The "run by CI" bucket could be too small.** The first draft of that resolution scanned the
workflows for `node scripts/x.mjs` only, and I wrote a comment claiming the `npm run` expansion
had fixed a ~40 % undercount. It had not: `grep -rn 'npm run verify' .github/workflows/` returns
nothing, CI spells all five browser gates the literal way, and adding the expansion moved the
counts by **zero**. The claim was written before it was checked. The expansion stays as cheap
insurance and the comment now says it currently earns nothing.

And one in the ratchet itself: the first ceiling was `61_900`, read off the report's rounded
"61.9 s". The true total is `61_930`, so the gate went red **on the very tree it was measured
against**. A threshold whose evidence is a formatting decision is not measured — and it fails in
the direction that looks like a real finding.

Mutation-proved 4/4 (`node --test test/wait-census.test.mjs` after each edit):

```
+9 s of sleep in a CI gate ............................ RED
a new _tmp- script carrying a wait .................... RED
the sleep detector edited to match nothing ............ RED  (instrument test)
the census's parse-yield guard disabled ............... RED, exit 1
```

---

## 4. The observed sweep — measured on a CI runner

**Run [32780994663](https://github.com/CrispStrobe/brickwright/actions/runs/32780994663), branch tip `d739ff4d9`.**

Not on a developer box. This repo's own `check-system-load.mjs` reported **6.1 load per CPU
against an allowed 1.5** here and refused to build at all — and it was right to. These
thresholds exist to protect CI, so CI's runner is the box whose durations matter, and it already
has the built editor and the browser this needs. `build.yml` grew a `workflow_dispatch`-only step
that re-runs the same five gates under the observer and uploads the JSONL.

**Five gates, 745 playwright calls, 279 bounded waits, 73 fixed sleeps.**

### Every observed bound has at least 35× headroom, and none timed out

| site | literal | observed | headroom |
|---|---|---|---|
| `verify-debug-dock.mjs:187` | 60,000 ms | 26 ms | 2273× |
| `verify-circuit-ux.mjs:45` | 60,000 ms | 34 ms | 1786× |
| `verify-circuit-rendering.mjs:61` | 10,000 ms | 7 ms | 1515× |
| `verify-circuit-ux.mjs:192` | 3,000 ms | 2 ms | 1500× |
| … 17 more between 1770× and 55× … | | | |
| `verify-view-buttons.mjs:33` | 60,000 ms | 697 ms | 86× |
| `verify-debug-dock.mjs:186` | 90,000 ms | 1,561 ms | 58× |
| `verify-circuit-ux.mjs:44` | 60,000 ms | 1,679 ms | **35.6× — the tightest** |

279 bounded waits, outcome `ok` on **all** of them. The full table is in the run's
`wait-observations` artifact (`wait-report.txt`, `wait-report.json`).

### What this does and does not establish

**25 of the 119 literals were reached.** 54 runnable ones were not — the report lists every one
by `file:line` rather than omitting them — and 40 more are in `_tmp-` scratch. A sweep that
reaches a fifth of the population and says so is worth more than one that reports a fraction it
did not compute.

**n is 1 or 2 at every site**, so "p50/p90/max" are one observation wearing three column
headings. The tool now prints that caveat itself rather than leaving it to the reader. The
headroom is a real fact — a 60,000 ms bound over a wait seen at 1,679 ms is a fact about that
bound — but **the tail is unmeasured, and the tail is what a timeout exists for.** Nothing here
licenses dropping 60,000 ms to 2,000 ms; it licenses asking why it is 60,000.

### Finding C — the literals are not where the waiting happens

**247 of the 279 bounded waits passed no timeout at all**, inheriting Playwright's 30 s default.
The slowest of them took 219 ms.

So the 119 literals the inventory counts govern **32** of the 279 real waits. The other 247 are
bounded by a number nobody wrote, which no inventory can count because there is no literal to
count, and which is the same 30,000 ms everywhere regardless of what it is waiting for.

### Finding D — 80 % of the browser gates' Playwright time is unconditional sleeping

| | time |
|---|---|
| bounded waits (279) — actually waiting for something | 14.4 s |
| **fixed sleeps (73) — `waitForTimeout`** | **65.9 s** |
| everything else (393 calls) | 1.7 s |
| **total inside playwright** | **82.0 s** |

Measured, on the runner, in the run linked above. Section 2 predicted 61.9 s of sleeping from
static analysis; the sweep observed 65.9 s, the difference being sleeps inside loops that the
static count sees once. Two independent methods, 6 % apart, agreeing on the shape.

**Four fifths of the time these gates spend in the browser, they are asleep on purpose.** That
is the largest single number in this whole census, and until now it appeared in no inventory,
no report and no budget — because a fixed sleep bounds nothing, and only bounds get counted.

---

## 5. Found by accident, and bigger than this lane: a suite that cannot be built reads as green

`test/wait-census.test.mjs` shells out to `aggregate-timeouts.mjs`, which imported `acorn` —
present on a developer box that ran a root `npm install`, absent in CI, which installs into
`packages/scratch-gui` and never at the root. So in run **32779945069** the `describe` body threw
while the suite was being **constructed**, and the runner printed:

```
not ok 662 - the wait census: fixed sleeps are counted, and may only shrink
    failureType: 'testCodeFailure'
    error: Cannot find package 'acorn' …
# tests 1014   # pass 1013   # fail 0   # skipped 1
```

**`# fail 0`, and the step went green.** The build failed later, at my own measurement step, for
the same missing import — which is the only reason this was noticed at all. Had the aggregator
been called from nowhere but the test, the run would have been entirely green with a gate that
never ran.

A construction failure is the worst kind to lose. A gate that failed found something; a gate
that could not be *built* found nothing and cannot have, and a green line says it did. This repo
has already found five gates that could not fail. This is one that could not be assembled.

What is established, and by what:

| claim | evidence |
|---|---|
| CI printed `not ok`, counted `# fail 0`, and the step concluded `success` | run 32779945069 log + `gh run view --json jobs` step conclusion, node 22.23.2 |
| the same shape exits **1** on node 20.20.2 | minimal repro (a `describe` whose body throws, plus one passing test) run locally |
| so the miscount is version-independent; the **exit code** is not | both of the above — I had no node 22 to test on directly, and say so |

The fix is not to trust the summary. `build.yml`'s unit-test step now tees the TAP stream and
fails on any `^not ok ` line the summary did not count, with the reason in the error. Proved
both ways against the minimal repro (caught 1 / clean), and against the archived log of the run
that produced it: exactly 1 line, exactly the right one.

Two dependency fixes came with it: the aggregator now resolves `acorn` from the copy webpack
already commits under `packages/scratch-gui/node_modules`, so it needs no install anywhere, and
that is verified by deleting the root install and re-running.

---

## 6. Reproducing

```bash
node scripts/aggregate-timeouts.mjs --census          # findings A and B, no browser
node --test test/wait-census.test.mjs                 # the ratchet

# the sweep, once the load guard passes
npm run integrate && (cd packages/scratch-gui && NODE_ENV=production npm run build)
(cd packages/scratch-gui/build && python3 -m http.server 8619 &)
for g in verify-circuit-ux verify-circuit-rendering verify-view-buttons verify-editor verify-debug-dock; do
  OBSERVE_OUT=/tmp/obs.jsonl PROOF_URL=http://localhost:8619/ \
    node --import ./scripts/observe-timeouts.mjs scripts/$g.mjs
done
node scripts/aggregate-timeouts.mjs --observed /tmp/obs.jsonl
```
