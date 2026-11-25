# micro:bit Firmware Provenance

Reproducibility audit and build provenance for the two MicroPython→WASM
firmwares that Brickwright vendors under
`overlay/scratch-gui/static/microbit-sim/`.

## What Brickwright ships

| Path | Variant | Size | Purpose |
|------|---------|------|---------|
| `build/firmware.wasm` | Stock (OFF) | 1,245,599 B | Default micro:bit simulator |
| `build/firmware.js` | Emscripten glue | 107,189 B | Shared by both variants |
| `build-debug/firmware.wasm` | Settrace (ON) | 1,259,735 B | Line-level debugger firmware |

The debug build shares the stock `build/firmware.js` glue (byte-identical
between OFF and ON builds). Only the wasm differs.

## Toolchain (pinned — the only one that works)

| Component | Version | Why pinned |
|-----------|---------|------------|
| Emscripten | 3.1.25 | Only emsdk that builds this 2022 MicroPython source |
| Python | 3.8 (bundled in image) | Newer Python breaks `makeqstrdefs` at `emcc -E` |
| Docker image | `emscripten/emsdk:3.1.25` | Bundles both; native on x86_64 |

Source: [`micropython-microbit-v2-simulator`](https://github.com/microbit-foundation/micropython-microbit-v2-simulator)
commit `07b1ed7` (cloned with `--recursive` submodules).

## Exact build invocation

Inside `docker run --rm -v <src>:/src -w /src emscripten/emsdk:3.1.25 bash -c`:

```bash
# 1. Drop the esbuild UI bundle prereq (not needed, not built):
sed -i "s| simulator-js||" src/Makefile

# 2. Warm emscripten sysroot cache single-threaded (avoids parallel race):
echo "int main(void){return 0;}" > /tmp/w.c && emcc -O3 -c /tmp/w.c -o /tmp/w.o

# 3. Build mpy-cross (host tool):
make -C lib/micropython-microbit-v2/lib/micropython/mpy-cross -j2

# 4. STOCK (OFF) build — pristine mpconfigport.h, no changes:
make -C src clean && make -C src -j1
# → produces src/build/firmware.wasm (1,245,599 B) + src/build/firmware.js (107,189 B)

# 5. SETTRACE (ON) build — add three defines to src/mpconfigport.h
#    after the existing MICROPY_ENABLE_SOURCE_LINE line:
#      #define MICROPY_PY_SYS_SETTRACE        (1)
#      #define MICROPY_PERSISTENT_CODE_SAVE    (1)
#      #define MICROPY_COMP_CONST              (0)
make -C src clean && make -C src -j1
# → produces src/build/firmware.wasm (1,259,735 B)
```

Automated script: `build-mbit-debug-fw.sh` (Docker-wrapped, memory-safe, `-j1`).

### Settrace flags explained

`MICROPY_PY_SYS_SETTRACE=1` enables the `sys.settrace()` hook that the
line-level debugger uses. It requires two prerequisites:
- `MICROPY_PERSISTENT_CODE_SAVE=1` — bytecode serialization (needed for trace data)
- `MICROPY_COMP_CONST=0` — disables constant folding (settrace errors without it)

## Reproducibility verification

Three independent builds from the same source + toolchain, across two machines:

### Debug firmware (settrace ON) — `build-debug/firmware.wasm`

| Build | Machine | Size | sha256 |
|-------|---------|------|--------|
| Original | Mac (arm64, emulated x86 via Docker) | 1,259,735 B | `ec6e535b781323afa174fd4b5952a7ddde5a05e37ac13f1934b52aa9fba1a850` |
| VPS run 1 | VPS (native x86_64) | 1,259,735 B | `ec6e535b781323afa174fd4b5952a7ddde5a05e37ac13f1934b52aa9fba1a850` |
| VPS run 2 (clean) | VPS (native x86_64) | 1,259,735 B | `ec6e535b781323afa174fd4b5952a7ddde5a05e37ac13f1934b52aa9fba1a850` |

**Result: BYTE-IDENTICAL across all three builds, two machines, two architectures.**

Matches vendored `build-debug/firmware.wasm` on `feat/microbit-settrace`: **YES**.

### Stock firmware (OFF) — `build/firmware.wasm`

| Build | Machine | Size | sha256 |
|-------|---------|------|--------|
| VPS run 1 | VPS (native x86_64) | 1,245,599 B | `59a40b89c281ac40dac745d7de45075c3f394b8abc455cabbaf4b114e9a61f17` |
| VPS run 2 (clean) | VPS (native x86_64) | 1,245,599 B | `59a40b89c281ac40dac745d7de45075c3f394b8abc455cabbaf4b114e9a61f17` |

**Result: BYTE-IDENTICAL across both builds.**

Matches vendored `build/firmware.wasm` on `main`: **NO** — main still has the
ancient pre-07b1ed7 build (1,091,643 B / sha256 `000728eb…`). The rebuild is the
correct replacement (fixes the OOB crash on `for v in g():` generator task loops).

### Emscripten glue — `build/firmware.js`

| Build | Size | sha256 |
|-------|------|--------|
| VPS run 1 | 107,189 B | `600b489a4879452617229136036453ca17abe5822c31cac364c8a7219bcd25fd` |
| VPS run 2 (clean) | 107,189 B | `600b489a4879452617229136036453ca17abe5822c31cac364c8a7219bcd25fd` |

**Result: BYTE-IDENTICAL.** Glue is identical between OFF and ON builds (verified).

Matches vendored `build/firmware.js` on `main`: **NO** — main has the ancient
glue (101,806 B). The rebuild is the correct replacement.

### Settrace delta

| Metric | Value |
|--------|-------|
| Raw size delta (ON − OFF) | +14,136 B |
| Gzipped delta | +6,406 B (~1.18%) |

## Staged artifacts

Rebuild outputs are staged at `out/` (gitignored, not committed) for the main
session to fold into lite's overlay:

| Staged file | Target in lite | Action |
|-------------|---------------|--------|
| `out/fw-off.wasm` | `overlay/…/build/firmware.wasm` | Replace ancient vendored stock |
| `out/firmware.js` | `overlay/…/build/firmware.js` | Replace ancient vendored glue |
| `out/fw-on.wasm` | `overlay/…/build-debug/firmware.wasm` | Already matches vendored (no-op) |
