// The ▶ Run C on RISC-V button wiring in the Code tab. Source-text gates (the
// button, the handler, and that it reuses the shared riscv-image event) so the
// path a build compiles cannot silently lose a hop — the same discipline
// i8086-chips-wiring applies to the 8086 route.

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src = readFileSync(new URL(
    '../overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx', import.meta.url), 'utf8');

test('the Code tab offers a ▶ Run C on RISC-V button + a route chooser, for the riscv32 device', () => {
    assert.match(src, /data-testid=\{menu \? "bw-run-c-riscv-menu" : "bw-run-c-riscv"\}/, 'the C tab has a ▶ for RISC-V');
    assert.match(src, /asmTargetForDevice\(this\.currentDevice\(\)\) === 'riscv32'/,
        'the button appears only for the riscv32 target');
    assert.match(src, /onClick=\{\(\) => this\.runCOnRiscv\(\)\}/, 'it is wired to the handler');
    // the user picks browser (wasm subset) vs server (hosted full C)
    assert.match(src, /data-testid=\{menu \? "bw-riscv-c-route-menu" : "bw-riscv-c-route"\}/, 'a route <select> is offered');
    assert.match(src, /riscvCRoute: e\.target\.value/, 'the select updates the chosen route');
    assert.match(src, /value="browser"[^]*value="server"/, 'both routes are options');
    // a C-example picker seeds the buffer
    assert.match(src, /data-testid=\{menu \? "bw-riscv-c-examples-menu" : "bw-riscv-c-examples"\}/, 'a C-example <select> is offered');
    assert.match(src, /this\.loadRiscvCExample\(e\.target\.value\)/, 'it loads the chosen example');
});

test('a subset failure offers a one-click retry on the full (server) compiler', () => {
    assert.match(src, /data-testid=\{menu \? "bw-run-c-riscv-server-menu" : "bw-run-c-riscv-server"\}/, 'the retry button exists');
    assert.match(src, /this\.runCOnRiscv\('server'\)/, 'it forces the server route');
    assert.match(src, /riscvCanRetryServer/, 'gated on the subset-rejected flag');
    // the flag is only set for a browser-route source error with an endpoint
    assert.match(src, /route === 'browser' && e\.reason === 'source' && !!RISCV_CC_ENDPOINT/,
        'retry is offered only when the browser subset rejected it and a server exists');
});

test('the build status reports what was produced and by which compiler', () => {
    assert.match(src, /out\.route === 'local-wasm' \? 'shecc' : 'gcc'/, 'names the compiler');
    assert.match(src, /runCRiscvBuilt\(bytes, out\.image\.segments\.length,\s*\n?\s*out\.image\.entry >>> 0, compiler\)/,
        'the built message carries bytes, segment count, entry and compiler');
});

test('the handler runs the CHOSEN route and boots the shared riscv image path', () => {
    assert.match(src, /async runCOnRiscv \(forceRoute, sourceOverride\)/, 'the handler exists (optional forced route; optional source, used by fe)');
    // it passes the user's (or forced) route + the full-C hosted target
    assert.match(src, /const route = typeof forceRoute === 'string' \? forceRoute : this\.state\.riscvCRoute;/,
        'the chosen route (or a forced retry route) drives the build');
    assert.match(src, /out = await requestRiscvCBuild\(\{source, route, hostedTarget: 'riscv32-gcc'\}\);/,
        'it calls the C route with that route and the full-C target');
    // the image travels the SAME bw-asm-rom-ready event as an assembled program
    assert.match(src, /format: 'riscv'/, 'the detail is a riscv image, not a flat ROM');
    assert.match(src, /image: out\.image/, 'the loadable image is carried');
    assert.match(src, /new CustomEvent\('bw-asm-rom-ready', \{detail\}\)/,
        'it dispatches the shared boot event debug-panel already routes');
    assert.match(src, /this\.runCOnRiscv = this\.runCOnRiscv\.bind\(this\)/, 'the handler is bound');
    assert.match(src, /riscvCRoute: 'browser'/, 'the default route keeps the no-server path');
});

test('refusal and compile-error are told apart in the status', () => {
    assert.match(src, /e\.reason === 'source'\s*\n?\s*\?\s*this\.L\.runCRiscvRefused/,
        'a compile error (reason source) is the program\'s');
    assert.match(src, /runCRiscvUnavailable/, 'a missing/unreachable service (reason transport) is the service\'s');
});

test('the button\'s strings exist in both locales', () => {
    for (const key of ['runCRiscv', 'runCRiscvTitle', 'runCRiscvBuilding', 'runCRiscvBuilt',
        'runCRiscvRefused', 'runCRiscvUnavailable', 'runCRiscvEmpty',
        'runCRiscvRouteTitle', 'runCRiscvRouteBrowser', 'runCRiscvRouteServer',
        'runCRiscvTryServer', 'runCRiscvTryServerTitle']) {
        assert.equal(src.split(`${key}:`).length - 1 >= 2, true, `${key} is missing from a locale`);
    }
});
