// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {parse} from 'acorn';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = readFileSync(path.join(root, 'overlay/scratch-gui/webpack.config.js'), 'utf8');
const ast = parse(config, {ecmaVersion: 'latest', sourceType: 'script'});
const binding = ast.body.filter(node => node.type === 'VariableDeclaration')
    .flatMap(node => node.declarations).find(node => node.id.name === 'preserveProofAssetInfo');
assert.equal(binding?.init.type, 'ArrowFunctionExpression', 'the actual asset-info policy must exist');
const expression = config.slice(binding.init.start, binding.init.end);
const info = vm.runInNewContext(`(${expression})`);
const glue = 'static/labwired/labwired_wasm.js';
function* nodes (node) {
    if (!node || typeof node !== 'object') return;
    if (node.type) yield node;
    for (const child of Object.values(node)) yield* nodes(child);
}
const property = (node, name) => node?.properties?.find(item => !item.computed && item.key?.name === name)?.value;

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
    const patterns = [...nodes(ast)].filter(node => node.type === 'NewExpression' &&
        node.callee.type === 'Identifier' && node.callee.name === 'CopyWebpackPlugin')
        .flatMap(node => property(node.arguments[0], 'patterns')?.elements || [])
        .filter(node => property(node, 'from')?.value === 'static' && property(node, 'to')?.value === 'static');
    assert.equal(patterns.length, 1, 'one actual CopyWebpackPlugin pattern owns the static tree');
    assert.equal(property(patterns[0], 'info')?.type, 'Identifier');
    assert.equal(property(patterns[0], 'info').name, 'preserveProofAssetInfo');
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
