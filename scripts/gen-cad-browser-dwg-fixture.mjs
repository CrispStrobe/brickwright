#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
// Reproduce the canonical CrispCAD inch-plate fixture with the exact DWG codec
// already shipped by this consumer. CI uses the committed bytes, not a download.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire, stripTypeScriptTypes} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
const {parse} = createRequire(import.meta.url)('acorn');
const root = path.resolve(import.meta.dirname, '..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const DWG_WORKER_SHA256 = 'b61636ee4049a98623f2eea55d3bd514d4536de4a2f9ff11958c5037e6e21d4d';
export const DWG_FACTORY_SHA256 = 'd225cc313329a7afb6d61415cfbc8606366adaf654598204146cc1764455f9a3';
const fixtureDirectory = path.join(root, 'test/fixtures/cad/browser');
const defaultWorker = path.join(root, 'overlay/scratch-gui/static/cad-sdk/assets/sketch-dwg.worker-FWEoDxb0.js');

export function generateCadBrowserDwg ({worker = defaultWorker,
    factory = path.join(fixtureDirectory, 'sketch-dwg-fixture.ts')} = {}) {
    assert.equal(process.env.TZ, 'UTC', 'Run deterministic fixture generation with TZ=UTC');
    const workerBytes = readFileSync(worker), factoryBytes = readFileSync(factory);
    assert.equal(sha(workerBytes), DWG_WORKER_SHA256, 'exact shipping DWG worker bytes are required');
    assert.equal(sha(factoryBytes), DWG_FACTORY_SHA256, 'exact canonical fixture factory bytes are required');
    const workerSource = workerBytes.toString('utf8');
    const workerAst = parse(workerSource, {ecmaVersion: 'latest', sourceType: 'script'});
    const bindings = [...new Set(workerAst.body.filter(node => node.type === 'VariableDeclaration')
        .flatMap(node => node.declarations.map(declaration => declaration.id.name)).filter(Boolean))];
    const time = Date.UTC(2026, 0, 1);
    class FixtureDate extends Date {
        constructor (...args) { super(...(args.length ? args : [time])); }
        static now () { return time; }
    }
    let uuid = 0;
    const replies = [];
    const context = vm.createContext({console, TextEncoder, TextDecoder, Date: FixtureDate,
        crypto: {randomUUID: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, '0')}`},
        self: {postMessage: value => replies.push(value)}});
    vm.runInContext(workerSource, context, {timeout: 10000, filename: 'pinned-sketch-dwg.worker.js'});
    const values = vm.runInContext(`[${bindings.join(',')}]`, context);
    // Node's type stripper removes the canonical factory's non-null assertions
    // without transforming its expressions or control flow.
    const factorySource = stripTypeScriptTypes(factoryBytes.toString('utf8'));
    const factoryAst = parse(factorySource, {ecmaVersion: 'latest', sourceType: 'module'});
    const imports = factoryAst.body.filter(node => node.type === 'ImportDeclaration');
    assert.equal(imports.length, 1);
    assert.equal(imports[0].source.value, '@node-projects/acad-ts');
    for (const specifier of imports[0].specifiers) {
        const name = specifier.imported.name;
        const matches = [...new Set(values.filter(value => name === 'ACadVersion'
            ? value && typeof value === 'object' && value.AC1032 === 33 && value.AC1021 === 27
            : typeof value === 'function' && value.name === name))];
        assert.equal(matches.length, 1, `the pinned worker must expose exactly one ${name} implementation`);
        context[specifier.local.name] = matches[0];
    }
    // Bind the original import to the identical codec classes in the pinned
    // worker. Remove only module syntax after stripping TypeScript annotations.
    const exported = factoryAst.body.filter(node => node.type === 'ExportNamedDeclaration');
    assert.equal(exported.length, 1);
    const removals = [[imports[0].start, imports[0].end], [exported[0].start, exported[0].declaration.start]];
    let executable = factorySource;
    for (const [start, end] of removals.sort((a, b) => b[0] - a[0])) {
        executable = executable.slice(0, start) + executable.slice(end);
    }
    vm.runInContext(`${executable}\nglobalThis.fixtureBytes = sketchDwgFixture();`, context,
        {timeout: 10000, filename: 'canonical-sketch-dwg-fixture.js'});
    const bytes = Buffer.from(context.fixtureBytes);
    assert.equal(bytes.subarray(0, 6).toString(), 'AC1032');
    // Decode through the unmodified public worker protocol as a fixture sanity
    // check; the actual import/export UI verdict remains the browser gate.
    vm.runInContext('self.onmessage({data: {kind: "read", bytes: fixtureBytes}});', context, {timeout: 10000});
    assert.equal(replies.length, 1);
    assert.equal(replies[0].kind, 'read', 'the exact shipped decoder must accept this fixture');
    assert.match(replies[0].text, /CUT/);
    assert.match(replies[0].text, /GUIDES/);
    return bytes;
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
    const bytes = generateCadBrowserDwg();
    const second = generateCadBrowserDwg();
    assert.deepEqual(bytes, second, 'fresh codec contexts must reproduce identical fixture bytes');
    const output = path.join(fixtureDirectory, 'inch-plate.dwg');
    writeFileSync(output, bytes);
    console.log(JSON.stringify({file: path.relative(root, output), bytes: bytes.length, sha256: sha(bytes)}));
}
