// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = readFileSync(path.join(root, 'overlay/scratch-gui/webpack.config.js'), 'utf8');
const expression = config.match(/const preserveProofAssetInfo = ([\s\S]*?);/)[1];
const info = vm.runInNewContext(`(${expression})`);
const glue = 'static/labwired/labwired_wasm.js';

test('the SHA-bound LabWired runtime glue retains its bytes through asset optimization', () => {
    assert.equal(info({filename: glue}).minimized, true);
    assert.equal(info({filename: String.raw`static\labwired\labwired_wasm.js`}).minimized, true);
});

test('the runtime exception leaves unrelated code and near-miss paths optimized', () => {
    for (const filename of [
        'gui.js', 'chunks/labwired_wasm.js', 'static/labwired/other.js',
        'static/labwired/labwired_wasm.js.map', 'static/labwired/labwired_wasm.js.extra',
        'static/labwired/../labwired/labwired_wasm.js',
        'static/native-broker/native-broker-host.js',
        'static/native-broker/proof-pins/sources/moving.js'
    ]) assert.equal(info({filename}).minimized, undefined, filename);
    assert.equal(info({filename: `static/native-broker/proof-pins/sources/${'a'.repeat(64)}.js`}).minimized, true);
});

test('both tracked configurations wire the same exact-byte static-copy hook', () => {
    assert.equal(readFileSync(path.join(root, 'packages/scratch-gui/webpack.config.js'), 'utf8'), config);
    assert.match(config, /from: 'static',\s+to: 'static',\s+(?:globOptions:[^\n]+\s+)?info: preserveProofAssetInfo/);
});

test('omitting the real runtime pathname removes its byte preservation', () => {
    const literal = `'${glue}'`;
    assert.equal(expression.split(literal).length, 2, 'one exact runtime pathname guard');
    const omitted = vm.runInNewContext(`(${expression.replace(literal, "'static/labwired/omitted.js'")})`);
    assert.equal(omitted({filename: glue}).minimized, undefined);
});

test('the pinned CAD SDK preserves manifest hashes through asset optimization',()=>{
 for(const filename of ['static/cad-sdk/sdk.js','static/cad-sdk/assets/simulation.worker.js'])assert.equal(info({filename}).minimized,true);
 assert.equal(info({filename:'static/cad-sdk-other/sdk.js'}).minimized,undefined);
});
