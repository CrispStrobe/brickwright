#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-3-Clause
#
# Build Brickwright's offline Cowgol compiler stages as WebAssembly.
#
# This script does not choose a compiler revision or invent a build recipe.
# It runs AFTER the compiler service's own bundle script
# (stc-compiler scripts/build-cowgol-bundle.py, at the commit pinned in
# build-inputs.json) has built the pinned Cowgol checkout natively. That native
# build is the service's deployed recipe; it leaves the C that Cowgol's cgen
# backend generated for each compiler stage under .obj/. This script compiles
# those exact C files, the same third-party assemblers and the same runtime
# objects with Emscripten instead of the host C compiler.
#
# Heavy: needs emsdk, the Debian bullseye snapshot build dependencies and a
# full Cowgol bootstrap. It runs in .github/workflows/cowgol-wasm.yml, never
# on a developer laptop as part of the app build.
#
# Usage:
#   build.sh --cowgol DIR --sources DIR --out DIR --gpl-out DIR --work DIR
#     --cowgol   pinned Cowgol checkout, already built by the service script
#     --sources  directory holding `apt-get source --download-only` results
#                for nasm and 64tass (the versions installed in the image)
#     --out      permissive payload (Cowgol stages, zmac, nasm, runtime)
#     --gpl-out  GPL payload (djlink, 64tass); never copied into the app
#     --work     scratch directory
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INPUTS="$HERE/build-inputs.json"
COWGOL="" SOURCES="" OUT="" GPL_OUT="" WORK=""
while [ $# -gt 0 ]; do
  case "$1" in
    --cowgol) COWGOL="$(cd "$2" && pwd)"; shift 2 ;;
    --sources) SOURCES="$(cd "$2" && pwd)"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    --gpl-out) GPL_OUT="$2"; shift 2 ;;
    --work) WORK="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
for v in COWGOL SOURCES OUT GPL_OUT WORK; do
  [ -n "${!v}" ] || { echo "--${v,,} is required" >&2; exit 2; }
done
for d in "$OUT" "$GPL_OUT"; do
  [ ! -e "$d" ] || { echo "output already exists: $d (choose a fresh directory)" >&2; exit 2; }
done
mkdir -p "$OUT" "$GPL_OUT" "$WORK"
OUT="$(cd "$OUT" && pwd)"; GPL_OUT="$(cd "$GPL_OUT" && pwd)"; WORK="$(cd "$WORK" && pwd)"

pin() { python3 -c "import json,sys; d=json.load(open('$INPUTS')); print(eval('d'+sys.argv[1]))" "$1"; }
COWGOL_COMMIT="$(pin "['cowgol']['commit']")"
EMSCRIPTEN_VERSION="$(pin "['emscripten']['version']")"

# --- Pinned inputs ----------------------------------------------------------
HAVE="$(git -C "$COWGOL" rev-parse HEAD)"
[ "$HAVE" = "$COWGOL_COMMIT" ] || { echo "Cowgol checkout is $HAVE, expected $COWGOL_COMMIT" >&2; exit 1; }
[ -z "$(git -C "$COWGOL" status --porcelain --untracked-files=no)" ] || {
  echo "Cowgol checkout has tracked modifications" >&2; exit 1; }
command -v emcc >/dev/null || { echo "emcc not on PATH; activate emsdk first" >&2; exit 1; }
EMCC_VERSION="$(emcc --version | head -n1)"
case "$EMCC_VERSION" in
  *" $EMSCRIPTEN_VERSION "*) ;;
  *) echo "need Emscripten $EMSCRIPTEN_VERSION, found: $EMCC_VERSION" >&2; exit 1 ;;
esac
EMROOT="$(dirname "$(command -v emcc)")"
[ -f "$EMROOT/LICENSE" ] || EMROOT="$(em-config EMSCRIPTEN_ROOT)"

# --- Compiler settings ------------------------------------------------------
# cgen C: the same language flags Cowgol's own driver uses (compile.py). -w
# because generated code is warning-dense by construction.
CGEN_CFLAGS=(-std=gnu99 -O2 -g0 -w -fwrapv -fno-strict-aliasing)
TOOL_CFLAGS=(-O2 -g0 -w)
# One isolated module instance per tool invocation:
#   EXIT_RUNTIME=1  flushes stdio at exit (the output files and the log).
#   FORCE_FILESYSTEM + FS export: the driver stages inputs in MEMFS.
#   DYNAMIC_EXECUTION=0: no eval/new Function in the glue.
LINK=(
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createCowgolTool
  -sENVIRONMENT=web,worker,node
  -sINVOKE_RUN=1 -sEXIT_RUNTIME=1
  -sFORCE_FILESYSTEM=1 -sEXPORTED_RUNTIME_METHODS=FS
  -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=16777216
  -sSTACK_SIZE=1048576 -sSTACK_OVERFLOW_CHECK=1
  -sDYNAMIC_EXECUTION=0 -sALLOW_TABLE_GROWTH=0
)
printf '%s\n' "${CGEN_CFLAGS[@]}" > "$WORK/cgen-cflags.txt"
printf '%s\n' "${TOOL_CFLAGS[@]}" > "$WORK/tool-cflags.txt"
printf '%s\n' "${LINK[@]}" > "$WORK/link-flags.txt"
: > "$WORK/inputs.tsv"   # tool<TAB>path<TAB>sha256 for every compiled source

record_inputs() { # tool file...
  local tool="$1"; shift
  for f in "$@"; do
    printf '%s\t%s\t%s\n' "$tool" "${f#"$COWGOL"/}" "$(sha256sum "$f" | cut -d' ' -f1)" >> "$WORK/inputs.tsv"
  done
}

# --- 1. Cowgol compiler stages (cgen C from the native build) --------------
# The native ab/ninja build writes each stage's cowlink output (C) under .obj.
# Locate it by the stage's upstream target name; exactly one must exist.
python3 - "$INPUTS" > "$WORK/cgen-tools.tsv" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
for name, tool in d["tools"].items():
    if tool["kind"] == "cgen":
        print(name + "\t" + tool["upstream"].split("/", 1)[1])
PY
while IFS=$'\t' read -r name upstream; do
  mapfile -t found < <(find "$COWGOL/.obj" -type f -name '*.c' -path "*${upstream}*" | sort)
  # Prefer the cowlink output: it is the whole linked program.
  mapfile -t linked < <(printf '%s\n' "${found[@]}" | grep '/cowlink/' || true)
  if [ "${#linked[@]}" -ne 1 ]; then
    echo "cannot identify the generated C for $upstream; candidates:" >&2
    printf '  %s\n' "${found[@]}" >&2
    exit 1
  fi
  src="${linked[0]}"
  echo "cgen  $name <- ${src#"$COWGOL"/}"
  record_inputs "$name" "$src" "$COWGOL/rt/cgen/cowgol.h"
  emcc "${CGEN_CFLAGS[@]}" -I "$COWGOL/rt/cgen" "$src" "${LINK[@]}" -o "$OUT/$name.mjs"
done < "$WORK/cgen-tools.tsv"

# --- 2. zmac (public domain), from the native build's bison output ---------
mapfile -t zparser < <(find "$COWGOL/.obj" -type f -name '*.c' -path '*third_party/zmac*' | sort)
[ "${#zparser[@]}" -eq 1 ] || { echo "zmac parser C not unique:" >&2; printf '  %s\n' "${zparser[@]}" >&2; exit 1; }
echo "zmac  <- ${zparser[0]#"$COWGOL"/}"
record_inputs zmac "${zparser[0]}" "$COWGOL/third_party/zmac/mio.c" "$COWGOL/third_party/zmac/zi80dis.cpp"
mkdir -p "$WORK/zmac"
emcc "${TOOL_CFLAGS[@]}" -I "$COWGOL/third_party/zmac" -I "$(dirname "${zparser[0]}")" -c "${zparser[0]}" -o "$WORK/zmac/parser.o"
emcc "${TOOL_CFLAGS[@]}" -I "$COWGOL/third_party/zmac" -c "$COWGOL/third_party/zmac/mio.c" -o "$WORK/zmac/mio.o"
em++ "${TOOL_CFLAGS[@]}" -I "$COWGOL/third_party/zmac" -c "$COWGOL/third_party/zmac/zi80dis.cpp" -o "$WORK/zmac/zi80dis.o"
em++ "$WORK/zmac/parser.o" "$WORK/zmac/mio.o" "$WORK/zmac/zi80dis.o" "${LINK[@]}" -o "$OUT/zmac.mjs"

# --- 3. Debian source packages (exact versions installed in the image) -----
unpack_debian() { # package -> echoes unpacked directory
  local pkg="$1" version dsc dir
  version="$(dpkg-query -W -f '${Version}' "$pkg")"
  dsc="$(ls "$SOURCES"/"${pkg}"_*.dsc)"
  case "$(basename "$dsc")" in
    "${pkg}_${version#*:}.dsc") ;;
    *) echo "$pkg source $dsc does not match installed $version" >&2; exit 1 ;;
  esac
  dir="$WORK/src-$pkg"
  rm -rf "$dir"
  dpkg-source --no-check -x "$dsc" "$dir" >&2
  printf '%s\t%s\t%s\t%s\n' "$pkg" "$version" "$(basename "$dsc")" "$(sha256sum "$dsc" | cut -d' ' -f1)" >> "$WORK/debian.tsv"
  echo "$dir"
}
: > "$WORK/debian.tsv"

# nasm (BSD-2-Clause): autoconf; the shipped release already contains the
# generated tables, so no host program runs during the cross build.
NASM_SRC="$(unpack_debian nasm)"
( cd "$NASM_SRC" && emconfigure ./configure >"$WORK/nasm-configure.log" 2>&1 || { cat "$WORK/nasm-configure.log"; exit 1; }
  emmake make -j"$(nproc)" nasm LDFLAGS="${LINK[*]}" >"$WORK/nasm-make.log" 2>&1 || { tail -n 80 "$WORK/nasm-make.log"; exit 1; } )
[ -f "$NASM_SRC/nasm.wasm" ] || { echo "nasm.wasm was not produced" >&2; tail -n 40 "$WORK/nasm-make.log" >&2; exit 1; }
cp "$NASM_SRC/nasm" "$OUT/nasm.mjs"
cp "$NASM_SRC/nasm.wasm" "$OUT/nasm.wasm"
record_inputs nasm "$NASM_SRC/asm/nasm.c"

# 64tass (GPL-2.0-or-later): plain Makefile.
TASS_SRC="$(unpack_debian 64tass)"
( cd "$TASS_SRC" && emmake make -j"$(nproc)" CC=emcc CFLAGS="${TOOL_CFLAGS[*]}" LDFLAGS="${LINK[*]}" 64tass >"$WORK/64tass-make.log" 2>&1 ||
  { tail -n 80 "$WORK/64tass-make.log"; exit 1; } )
[ -f "$TASS_SRC/64tass.wasm" ] || { echo "64tass.wasm was not produced" >&2; tail -n 40 "$WORK/64tass-make.log" >&2; exit 1; }
cp "$TASS_SRC/64tass" "$GPL_OUT/64tass.mjs"
cp "$TASS_SRC/64tass.wasm" "$GPL_OUT/64tass.wasm"
record_inputs 64tass "$TASS_SRC/64tass.c"

# --- 4. djlink (GPL-2.0 + executable exception), unmodified Cowgol copy ----
DJ="$COWGOL/third_party/djlink"
DJ_SOURCES=(djlink.cc fixups.cc libs.cc list.cc map.cc objs.cc out.cc quark.cc segments.cc stricmp.cc symbols.cc)
record_inputs djlink "${DJ_SOURCES[@]/#/$DJ/}"
em++ "${TOOL_CFLAGS[@]}" "${DJ_SOURCES[@]/#/$DJ/}" "${LINK[@]}" -o "$GPL_OUT/djlink.mjs"

# --- 5. Runtime headers and objects (the service bundle's rt/ subset) ------
for family in cpm cpmz msdos eater6502; do
  mkdir -p "$OUT/rt/$family"
  for f in "$COWGOL/rt/$family"/*; do
    case "$(basename "$f")" in build.py|__pycache__) continue ;; esac
    cp "$f" "$OUT/rt/$family/"
  done
  cp "$COWGOL/.obj/rt/$family/+cowgolcoo/cowgol.coo" "$OUT/rt/$family/cowgol.coo"
done
cp "$COWGOL"/rt/*.coh "$OUT/rt/"

# --- 6. Licences and corresponding source -----------------------------------
mkdir -p "$OUT/licenses" "$GPL_OUT/licenses" "$GPL_OUT/source"
cp "$COWGOL/COPYING" "$OUT/licenses/Cowgol-BSD-2-Clause.txt"
cp "$COWGOL/third_party/zmac/COPYING.publicdomain" "$OUT/licenses/zmac-public-domain.txt"
cp "$NASM_SRC/LICENSE" "$OUT/licenses/nasm-LICENSE.txt"
cp "$NASM_SRC/debian/copyright" "$OUT/licenses/nasm-debian-copyright.txt"
python3 - "$INPUTS" "$EMROOT" "$OUT/licenses" > "$WORK/notices.tsv" <<'PY'
import hashlib, json, shutil, sys
from pathlib import Path
d = json.load(open(sys.argv[1]))
root, out = Path(sys.argv[2]), Path(sys.argv[3])
for notice in d["emscripten"]["notices"]:
    data = (root / notice["source"]).read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if notice["sha256"] and digest != notice["sha256"]:
        sys.exit(f"Emscripten notice changed: {notice['source']} {digest}")
    (out / notice["name"]).write_bytes(data)
    print(f"{notice['name']}\t{notice['source']}\t{digest}")
PY
cp "$DJ/copying" "$GPL_OUT/licenses/djlink-COPYING.txt"
cp "$DJ/copying.dj" "$GPL_OUT/licenses/djlink-copying.dj.txt"
cp "$TASS_SRC/debian/copyright" "$GPL_OUT/licenses/64tass-debian-copyright.txt"
for l in GPL-2 GPL-3 LGPL-2; do cp "/usr/share/common-licenses/$l" "$GPL_OUT/licenses/$l.txt"; done
cp "$OUT"/licenses/EMSCRIPTEN-*.txt "$OUT"/licenses/MUSL-COPYRIGHT.txt "$OUT"/licenses/COMPILER-RT-LICENSE.txt \
   "$OUT"/licenses/LIBCXX*-LICENSE.txt "$GPL_OUT/licenses/"
# Corresponding source for the GPL binaries travels with them.
tar -C "$COWGOL/third_party" -czf "$GPL_OUT/source/djlink-source.tar.gz" djlink
for f in "$SOURCES"/64tass_*; do cp "$f" "$GPL_OUT/source/"; done

# --- 7. Manifests ------------------------------------------------------------
python3 - "$INPUTS" "$WORK" "$OUT" "$GPL_OUT" "$EMCC_VERSION" <<'PY'
import hashlib, json, sys
from pathlib import Path
inputs, work, out, gpl, emcc = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3]), Path(sys.argv[4]), sys.argv[5]
d = json.load(open(inputs))
rows = [line.split("\t") for line in (work / "inputs.tsv").read_text().splitlines() if line]
debian = {r[0]: {"version": r[1], "dsc": r[2], "dscSha256": r[3]}
          for r in (line.split("\t") for line in (work / "debian.tsv").read_text().splitlines() if line)}
notices = {r[0]: {"source": r[1], "sha256": r[2]}
           for r in (line.split("\t") for line in (work / "notices.tsv").read_text().splitlines() if line)}
lines = lambda name: (work / name).read_text().split()
def manifest(root, payload):
    tools = {}
    for name, tool in d["tools"].items():
        if not (root / f"{name}.mjs").is_file():
            continue
        tools[name] = {"module": f"{name}.mjs", "wasm": f"{name}.wasm", "upstream": tool["upstream"],
                       "license": tool.get("license", d["cowgol"]["license"]),
                       "inputs": [{"path": r[1], "sha256": r[2]} for r in rows if r[0] == name]}
    files = {}
    for path in sorted(p for p in root.rglob("*") if p.is_file() and p.name != "manifest.json"):
        data = path.read_bytes()
        files[path.relative_to(root).as_posix()] = {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
    return {"schemaVersion": 1, "format": "brickwright-cowgol-wasm", "payload": payload,
            "cowgolCommit": d["cowgol"]["commit"], "serviceCommit": d["service"]["commit"],
            "compiler": emcc, "emsdkCommit": d["emscripten"]["installerCommit"],
            "debianSnapshot": d["debian"]["snapshot"], "debianSources": debian,
            "cgenCflags": lines("cgen-cflags.txt"), "toolCflags": lines("tool-cflags.txt"),
            "linkFlags": lines("link-flags.txt"), "emscriptenNotices": notices,
            "families": d["families"], "tools": tools, "files": files}
for root, payload in ((out, "bundled"), (gpl, "gpl-origin")):
    (root / "manifest.json").write_text(json.dumps(manifest(root, payload), indent=2, sort_keys=True) + "\n")
PY
du -ab "$OUT" "$GPL_OUT" | sort -n | tail -n 40
echo "Built $OUT and $GPL_OUT with $EMCC_VERSION"
