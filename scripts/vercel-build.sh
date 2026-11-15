#!/usr/bin/env bash
# Vercel build for the permissive base: vendor the pinned BSD-3/Apache Scratch sources,
# install scratch-gui, and webpack it. Output lands in packages/scratch-gui/build, which
# vercel.json serves. Root-hosted on *.vercel.app, so no base-path rewriting needed.
set -euo pipefail
# Reuse bw-board's completed heavy CI at this exact pin; do not download and
# rerun its vector and program corpora in every product/release build.
npm run verify:bwboard-ci
node scripts/vendor.mjs
node scripts/integrate.mjs
# The heavy simulation tier's engine (labwired-wasm, ~20 MB / 2 MB brotli).
# Deployed as a static asset, NOT bundled: lib/labwired-engine.js fetches it at
# runtime and only when someone selects that engine, so it costs nothing at
# first paint and the build does not depend on it. Same-origin on purpose —
# a GitHub-hosted runtime fetch would be zero deploy bytes and would break the
# PWA offline, since the service worker only caches our own GETs.
# Non-fatal: a network hiccup here must not take the whole site down; the
# engine simply is not offered, which lib/labwired-engine.js already handles.
node scripts/sync-labwired-wasm.mjs || echo "labwired-wasm unavailable — the heavy tier will not be offered"
node scripts/sync-esp32s3-roms.mjs || echo "ESP32-S3 ROM assets unavailable — merged-flash boot will report the missing assets"
# The pinned MakeCode runtimes (static/makecode/<target>/target.json, pxtworker.js,
# firmware bases; ~55 MB), which the MakeCode import/compile worker fetches
# same-origin. build.yml's Pages build syncs them; without this step Vercel served
# no static/makecode/ and every MakeCode share link failed with
# "target.json: HTTP 404". After integrate.mjs, which clears the synced runtime.
# One retry for a registry hiccup; then non-fatal like labwired-wasm: MakeCode is
# simply not offered rather than the whole site failing to deploy.
node scripts/sync-makecode-runtime.mjs || node scripts/sync-makecode-runtime.mjs || echo "MakeCode runtime unavailable — MakeCode import and compile will not be offered"
cd packages/scratch-gui
npm install --ignore-scripts --legacy-peer-deps --no-audit --no-fund
# The deployable build is FLAG-ON (matches .github/workflows/build.yml): the FPGA
# surface ships, so the settings toggle appears. @yowasp/yosys is the real package
# for the in-browser local synthesis tier (an off build gets the yosys-absent stub).
npm install --no-save --ignore-scripts --legacy-peer-deps --no-audit --no-fund @yowasp/yosys
cd ../.. && node scripts/apply-vm-overlay.mjs && node scripts/apply-paint-overlay.mjs && node scripts/apply-render-overlay.mjs && cd packages/scratch-gui
NODE_ENV=production CI=true NODE_OPTIONS=--max-old-space-size=2560 BW_ENABLE_CAD=1 BW_ENABLE_FPGA=1 BW_SYNTHESIS_ENDPOINT=https://synth.crispstro.be/api npm run build
cd ../..
BW_EXPECT_REMOTE_CODE_POLICY=allow node scripts/verify-build-policy.mjs packages/scratch-gui/build

# A public receipt contains only the deployed commit, never audit evidence.
node -e 'const fs=require("fs"),cp=require("child_process");fs.writeFileSync("packages/scratch-gui/build/brickwright-version.json", JSON.stringify({commit:cp.execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim()})+"\n");'
