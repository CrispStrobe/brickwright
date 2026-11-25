# Fetch pinning: every place brickwright-lite resolves a name to content

2026-08-24, branch `fix/lite-fetch-pinning`, from `main` at `b8afbc5e3`.

Companion to `sb3-creator/docs/PROVENANCE-AUDIT.md`, which did the same sweep one repo over.
That audit found four defects **in lite** and correctly did not fix them in someone else's
repository. This is that lane, closed.

## The one sentence

**A fetch by mutable name quotes a freshness it does not have.**

It is not a hypothetical here. On 2026-08-23 `scripts/sync-bw-board.mjs` fetched
`<repo>/master/<file>` from the raw CDN, the CDN served a cached copy of the **previous**
commit, the run printed `synced from bw-board@master`, and `vendor-pins.json` was never
touched. Every word of that sentence was well-formed. The content was wrong, and nothing in
the tree recorded which commit had actually arrived — so the failure was discovered by
noticing a *marker that never showed up*, not by any check.

The fix pattern is the one this repo had already invented for exactly that incident and had
applied to exactly one script:

1. **resolve** the ref to a 40-hex sha through the commits API (which is not the raw CDN, and
   answers with the current head);
2. **fetch sha-addressed**, because a sha-addressed raw URL is immutable and the cache cannot
   lie about it;
3. **record** the resolved sha, so a later reader can tell what was taken.

All three are needed. Doing (1) and (2) without (3) is what the state was on 2026-08-24: correct
content, no record. Doing (1) without (2) is a label.

---

## 1. The denominator

**65 sites in brickwright-lite resolve an external name to content.** A *site* is one
syntactic location that turns an external name into bytes, in the files lite authors:

| | count |
|---|---|
| `uses:` in `.github/workflows/` | 48 |
| `raw` / `codeload` / release-download / `git clone` / `git ls-remote` (the census in the gate) | 9 |
| `npm pack <name>@<version>` in `vendor.mjs` (one call, seven named packages) | 7 |
| `assets.scratch.mit.edu/<md5ext>` in `offline-assets.js` | 1 |

**Before this branch: 55 of 65 named a mutable object while being relied on for content**
— all 48 tags, plus 7 of the 9 census sites. **After: 1.** The remaining one is stated in §4
with the reason it could not be closed here.

Vendored trees (`packages/`, `overlay/scratch-gui/src/lib/{bw-board,bw-circuit-ui,emu8051,…}`,
the examples gallery — including the 13 already-sha-pinned extension URLs the sb3-creator
provenance branch fixed) are **outside** the denominator: their provenance is `vendor-pins.json`'s
job, and counting their contents would double-count the pin. `.md` files are outside it too —
a `git clone` in a document is an instruction to a human. There is exactly one
(`MBIT-BUILD.md`, the micro:bit simulator rebuild recipe, `git clone --recursive` with no ref);
it is listed here rather than gated, because a person following it will notice a build failure
and a script will not.

---

## 2. Converted to immutable (54 of the 55)

| # | site | named before | class | now |
|---|---|---|---|---|
| 1–48 | 48 `uses:` across 6 workflows | `actions/checkout@v4`, `setup-node@v4`, `upload-artifact@v4`, `download-artifact@v4`, `setup-java@v4`, `upload-pages-artifact@v3`, `deploy-pages@v4`, `Swatinem/rust-cache@v2`, `dtolnay/rust-toolchain@stable`, `tauri-apps/tauri-action@v0`, `softprops/action-gh-release@v2`, `android-actions/setup-android@v3` | **mutable tag** — repointed by the publisher | full 40-hex sha, version in a trailing comment |
| 49 | `scripts/sync-sb3creator.mjs` | `SB3CREATOR_REF \|\| 'main'`, fetched from the raw CDN | **mutable branch on a caching CDN** | `resolveRef()` → sha, every file sha-addressed, sha recorded |
| 50 | `scripts/sync-examples.mjs` | same | same, and worse: ~1500 files over many minutes, so one run could straddle a push | same |
| 51 | `scripts/vendor-forward.mjs` | `git clone --depth 1 <url>` — **no ref at all** | the entire specification of what got vendored was "whatever the default branch was when this ran" | `git ls-remote` → sha, fetch **at** that sha, **assert `HEAD == resolved`**, `--at repo=sha` to re-derive |
| 52 | `scripts/sync-emu8051-wasm.mjs` | `const PIN = '2f1855a'` — **seven characters** | an abbreviation is unique within one repo at one moment | full 40-hex; `--ref` resolved before any fetch |

Three more were repaired in the same pass because they are the same defect wearing other hats:

| site | what was wrong | now |
|---|---|---|
| `sync-bw-board.mjs` — the final line | resolved the sha correctly and then **printed `synced from bw-board@master`**. The one part of the sentence guaranteed not to be about what arrived. | prints the sha, and says whether it was resolved or read from a local checkout |
| `sync-bw-board.mjs` — `${remoteSha ?? REF}` | a fallback to the mutable name, which looked harmless and was the whole defect in a hat: one failed API call and every file comes from a cached branch URL again, silently | resolution failing is a failed sync; `lib-pin.mjs` throws with the reason |
| `.github/workflows/build.yml` — `FLOOR=85ed23d` | abbreviated, and compared against the (formerly abbreviated) WASM `PIN` with `merge-base --is-ancestor`, which reports an unresolvable rev as "not a descendant" — a true-looking error about the wrong thing | `85ed23d94a1fbf8a15c2ddff068d438a832913cc` |

### The one that also changed what CI *means*

`build.yml`'s **"Guard — vendored sources are not stale"** compared the vendored overlay against
**upstream `master`, with a `main` fallback, through the raw CDN**. Three things wrong in one
line:

1. It named a mutable ref, so upstream advancing made it warn — the warning meant "someone
   pushed", not "lite is broken", and a warning that fires for a non-problem is one nobody reads.
2. It read the caching CDN, so a run right after a push compares against the previous commit and
   says *up to date* about a tree it did not see. **That is the exact mechanism of the
   2026-08-23 incident, sitting inside the guard meant to catch it.**
3. `master || main` guessed the branch name, and a wrong guess curls a 404 into `$upstream`,
   which the step reported as `upstream not accessible (private repo?)` — a confident,
   well-formed, wrong statement about why nothing had been compared.

It now compares the overlay against **the sha lite pins**, fetched sha-addressed, and is renamed
to what it actually checks: *the vendored overlay matches the commit it PINS*. A difference is
now an integrity failure about lite, not news about upstream. Freshness-vs-HEAD is a different
question and it already has its own workflow (`vendor-freshness.yml`, nightly). Verified against
the live tree before landing: `bw-circuit-ui` and `bw-board` both match their pins.

---

## 3. Already immutable (10 of the 65)

| site | why it is immutable |
|---|---|
| `scripts/vendor.mjs` — `GUI_COMMIT` | full 40-hex; the last BSD-3 commit of scratch-gui. Asserted by the gate. |
| `scripts/vendor.mjs` — 7 × `npm pack <name>@<exact version>` | npm forbids republishing a version, so `scratch-vm@4.8.115` **is** an immutable object |
| `offline-assets.js` — `assets.scratch.mit.edu/<md5ext>` | content-addressed already: `md5ext` is the md5 of the content. Nothing to do. |
| `sync-emu8051-wasm.mjs` — `EXPECT` | **stronger than sha-addressing**: sha-256 per file, and the script refuses to write a binary that does not match. This is the only vendored artifact that cannot be read by eye, and it is the only one with content verification. |
| `build.yml` — `git clone --bare` of emu8051-stc | **ancestry, not content**: both endpoints are 40-hex shas and the clone only holds the graph relating them. There is no ref here to pin. |

---

## 4. Mutable, and why — one site, open

### The offline library pack

`overlay/scratch-gui/src/lib/offline-assets.js` fetches

```
https://github.com/CrispStrobe/brickwright/releases/download/library-pack-v1/brickwright-library.zip
```

A release **tag** is movable and a release **asset** can be deleted and re-uploaded under the
same name. `apps/tauri/src-tauri/src/downloads.rs::download_pack_zip` streams it into memory and
calls `extract_zip_flat` — **it hashes nothing**. So a ~40 MB archive is fetched by mutable name
and written onto the user's device with no integrity check at all. This is the largest single
piece of content lite delivers and it is the least verified.

Measured, not assumed — what GitHub serves for that name today:

```
sha256  ca484cfe2161be602b54947217ecc855b7304667fdec833b58b0747314bba436
size    42,054,931 bytes
uploaded 2026-07-08T15:18:35Z
```

**The fix** is to thread that digest through `download_pack_zip(app, pack, url, sha256)` and
verify `data` before `extract_zip_flat`; `sha2` is already in `Cargo.lock`. **It is not done
here**, and the reason is stated rather than dressed up: it is a Rust change to the Tauri app,
this branch could not build the crate to verify it (the box had 2.2 GB free and no `target/`),
and shipping an unbuilt change to the code path that writes files to users' machines is worse
than leaving a listed hole. The digest is recorded in the gate's census row so whoever does it
has the number.

For contrast, the *other* asset path in the same file is already content-addressed and needs
nothing: individual library assets are fetched from `assets.scratch.mit.edu` by `md5ext`, which
is the md5 of the content.

---

### Graph-only clones — waived, and not holes (2026-09-07)

Two rows in the census are `waived` for a reason that is the opposite of the library pack's:
they fetch NO content that ships. The emu8051-stc bare blobless clone in build.yml exists to
answer whether the WASM pin is a descendant of the crash-fix floor, and the three bare blobless
clones of bw-board, sb3-creator and bw-circuit-ui (added with plan T9, `test/pin-move-chain
.test.mjs`) exist to answer whether a 40-hex string in the tree is a commit of theirs other than
the current pin. Both endpoints of every such question are full shas already; the clone holds
the graph that relates them. A stale clone can only make the gate know less — a brand-new
upstream commit not yet seen — never change what ships, and there is no ref to pin because the
whole history is the argument. The census test names the waived set exactly (three rows: these two and the pack) so a fourth cannot join quietly.

### The moving absent-file proof was retired (2026-09-09)

The earlier T13c workaround cloned the default-branch tip and could skip when
upstream advanced. The proof now consumes the existing `BW_BOARD_DIR`, asserts
its HEAD equals `vendor-pins.json`, and passes `--allow-stale` only inside its
throwaway sync checkout. This bypasses the unrelated freshness precondition,
not the absent-file or pin-move guards. Source-freshness behavior remains
separately tested. The live-tip clone and its waiver are removed: three waived
sites remain (the two graph queries and the library pack).

## 5. What now catches the next one

`test/fetch-pinning.test.mjs`, 9 subtests, run by `npm test`. It is a **census**, not a pattern
matcher: the set of fetch sites in the tree must equal a declared table, each row carrying the
class that makes it immutable or the reason it is not. A site that is new, moved, or reworded is
red until somebody writes down which it is. Declaring is cheap; the point is that it cannot
happen silently.

Three ways it could report a clean sweep over nothing, each closed:

- **the detectors stop matching** — a subtest runs them over a synthetic offender built inside
  the file, so their liveness does not depend on the tree containing an offender (which, now,
  it does not);
- **the scan walks no files** — floor asserted, and the gate must be tracked by git, because an
  untracked gate is excluded from the walk *for the wrong reason*;
- **the scan walks the gate itself** — this file necessarily contains examples of what it
  forbids. It is excluded by exact path, that exclusion is one named constant, and a subtest
  asserts the exclusion is that one path and nothing else, so widening it to hide a real
  offender is a visible diff. This is the shape of the best finding of the whole campaign: a
  gate that walked a tree containing its own prover, so every string-literal target matched
  itself and it could never fail.

**It caught its own prover, on the first commit.** `scripts/prove-fetch-pinning.mjs` was
untracked while the gate was being written, so `git ls-files` never mentioned it and it was
outside the walk *for the wrong reason*. The moment it was committed the census reported four
undeclared fetch sites in it — the mutation targets, which are necessarily the text of real
fetch sites. That is the same shape as the finding this gate was built around, one file over.

The fix was **not** a second exclusion. URL literals in the prover are now assembled from
pieces, so what that file contains is a *recipe* for a URL and not a URL, and the exclusion
stays at exactly one path. A future mutation that pastes a whole URL in will turn the gate red
and say so — which is the correct outcome, not a nuisance.

The `uses:` detector is deliberately scoped to workflow files and anchored to the head of a
step. An unanchored `/uses:/` reads `refuses: ${…}` in a script and `'…board uses:'` in a
component as action references — three false offenders in its first run, which is its own small
lesson about detectors that match on a suffix.

### Mutation-proved: 11/11

`node scripts/prove-fetch-pinning.mjs` (also `npm run prove:pins`, and a CI step in
`build.yml`). Every mutation is checked for having **changed the file** before the gate is run —
a mutation that does not mutate is a prover failure, not a gate success. The baseline is
asserted green before, and the tree asserted green after.

```
baseline: GREEN

 1. an action tag is un-pinned back to @v4 .................... RED, for the stated reason
 2. a NEW mutable fetch appears in a script nobody declared .... RED, for the stated reason
 3. a declared fetch site is removed but its census row stays .. RED, for the stated reason
 4. the WASM pin is abbreviated back to seven characters ....... RED, for the stated reason
 5. CI's ancestry FLOOR is abbreviated ......................... RED, for the stated reason
 6. a vendor pin is recorded as a short sha .................... RED, for the stated reason
 7. a sync script falls back to the mutable ref ................ RED, for the stated reason
 8. a sync script stops resolving the ref at all ............... RED, for the stated reason
 9. the raw-CDN detector is edited into uselessness ............ RED, for the stated reason
10. the self-exclusion is widened to hide another file ......... RED, for the stated reason
11. a waived fetch site loses its stated reason ................ RED, for the stated reason

11/11 mutations caught; tree restored, gate green.
```

The headline one — DoD's *"catches a new mutable fetch"* — in full. A line is appended to
`scripts/integrate.mjs` fetching `bw-board/master`:

```
not ok 5 - every content-fetch site is in the declared census, and every census row is in the tree
  ---
  error: |-
    UNDECLARED FETCH SITE(S). Each of these resolves an external name to content and
    nothing in the tree says whether that name is immutable. Add a row to CENSUS in this
    file with its class and, if it is `waived`, the reason it cannot be sha-addressed:
    + actual - expected
    + [
    +   'scripts/integrate.mjs  [raw]  raw.githubusercontent.com/CrispStrobe/bw-board/master/src/index.js'
    + ]
    - []
```

And the self-referential one, mutation 10, which is the finding this gate was built around —
widening the exclusion by one file:

```
not ok 3 - the scan walks a real tree, and excludes exactly one file: itself
  ---
  error: |-
    the self-exclusion is meant to be exactly one path. These non-vendored, non-markdown
    files are also being skipped:
    + [ 'scripts/vendor.mjs', 'test/fetch-pinning.test.mjs' ]
    - [ 'test/fetch-pinning.test.mjs' ]
```

---

## 6. Two things noticed in passing, not fixed here

Both are about pinning, both are in `vendor-freshness.yml`, and neither is mine to change
without the lane that owns that workflow — recorded so the next reader does not have to
re-derive them.

1. **Two pinning steps, and the second defeats the first's stated intent.** The workflow says
   push runs are an integrity gate (compare against the pin) while the nightly is the staleness
   alarm (compare against HEAD). But the step *"Check out pinned upstream commits"* has no `if:`
   and so runs on the nightly too, checking out the pin — so the nightly is currently a second
   integrity run, not a staleness alarm. Nothing is *wrong* in the sense of a false green; the
   alarm the comment describes is simply not armed.

2. **A path that cannot exist.** The same step reads `lego/brickwright-lite/vendor-pins.json`
   first and `brickwright-lite/vendor-pins.json` second. Only the second can exist under the
   checkout paths this workflow declares. It is harmless because the fallback is right, and it
   is the kind of harmless that stops being harmless when someone deletes "the redundant line".

---

## 7. Where the numbers come from

Every count in this document is reproducible from the tree:

```bash
# the 48 uses:, all pinned
grep -rhoE 'uses:[[:space:]]*[^[:space:]#]+' .github/workflows/*.yml | wc -l
grep -rEn 'uses:[[:space:]]*[^[:space:]#]+' .github/workflows/ | grep -vcE '@[0-9a-f]{40}'   # 0

# the census, and the gate that keeps it honest
node --test test/fetch-pinning.test.mjs
node scripts/prove-fetch-pinning.mjs
```
