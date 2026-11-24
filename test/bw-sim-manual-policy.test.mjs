// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MODELS, catalogFrom, prepareModel} from '../overlay/scratch-gui/src/lib/bw-sim/sim-session.js';
import {parseModel, serializeModel} from '../overlay/scratch-gui/src/lib/bw-sim/model/ldraw-model.js';
import {createEditor} from '../overlay/scratch-gui/src/lib/bw-sim/editor/editor-state.js';
import {simLabRecordFromText, readSimLabStorage} from '../overlay/scratch-gui/src/lib/bw-sim/model/sim-lab-persist.js';
import {buildManualPolicyIndex} from '../overlay/scratch-gui/manual-policy-index.mjs';
import {manualAssemblyKey, createManualPolicyResolver} from '../overlay/scratch-gui/src/components/tw-pseudocode/sim-lab-manual-policy.js';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const source = read('overlay/scratch-gui/static/sim-lab/models/resonance-lab.ldr');
const mpd = read('overlay/scratch-gui/static/sim-lab/models/resonance-lab.mpd');
const catalog = catalogFrom(JSON.parse(read('overlay/scratch-gui/src/lib/bw-sim/part-meta/parts.json')));
const model = prepareModel(source, catalog).model;
const policy = MODELS.find(entry => entry.file === 'resonance-lab.ldr').manualJog;
const resonanceModels = MODELS.filter(m => m.file === 'resonance-lab.ldr');
const resolver = (models = resonanceModels, readSource) =>
    createManualPolicyResolver({models, referenceDigests: buildManualPolicyIndex(models, readSource)});

test('exact LDR, MPD and saved-pose structures share one indexed policy reference across all three aliases', async () => {
    const calls = [];
    const resolve = resolver(resonanceModels, file => { calls.push(file); return source; });
    for (const candidate of [parseModel(source).model, parseModel(mpd).model, model]) {
        assert.equal(await resolve(candidate), policy);
    }
    assert.deepEqual(calls, ['resonance-lab.ldr']);
    assert.equal(await resolve(parseModel(read('overlay/scratch-gui/static/sim-lab/models/driving-base.ldr')).model), null);
});

test('unchanged real editor, serialization and project-record reopen preserve the finite policy without stored gallery identity', async () => {
    const editor = createEditor({model, catalog});
    const text = serializeModel(editor.model, {name: 'my-model.ldr', title: 'My saved machine'});
    const record = simLabRecordFromText(text, {name: 'my-model.ldr', mat: 'plain'});
    const reopened = readSimLabStorage(JSON.stringify(record));
    assert.deepEqual(reopened.refusals, []);
    assert.deepEqual(Object.keys(record), ['ldraw', 'name', 'mat']);
    const saved = parseModel(reopened.record.ldraw, {catalog}).model;
    const resolve = resolver();
    assert.equal(manualAssemblyKey(saved), manualAssemblyKey(model));
    assert.equal(await resolve(saved), policy);
    assert.equal(await resolve(parseModel(serializeModel(saved)).model), policy);
});

test('attribution, instruction steps and object key order are nonphysical; no pose or part equivalence is inferred', async () => {
    const changedLabels = structuredClone(model);
    changedLabels.attribution = {author: 'My title metadata', license: 'Metadata only'};
    changedLabels.steps = [[...changedLabels.parts.map(part => part.id)].reverse()];
    changedLabels.parts = changedLabels.parts.map(part => Object.fromEntries(Object.entries(part).reverse()));
    assert.equal(manualAssemblyKey(changedLabels), manualAssemblyKey(model));
    assert.equal(await resolver()(changedLabels), policy);
    const translated = structuredClone(model);
    for (const part of translated.parts) part.position[0] += 1;
    assert.notEqual(manualAssemblyKey(translated), manualAssemblyKey(model));
});

test('physical placements, motor ports, bands and added custom geometry cannot inherit the unchanged assembly policy', async () => {
    const edits = [
        m => { m.parts[0].position[0] += 1; },
        m => { m.parts[0].rotation[0] = -1; },
        m => { m.parts[0].part = '3713.dat'; },
        m => { m.parts[0].color = 1; },
        m => { m.parts.find(part => part.port).port = 'B'; },
        m => { m.parts.find(part => part.port).rotorAngle = 1; },
        m => { m.parts[0].load = true; },
        m => { m.parts.pop(); },
        m => { m.parts.push({...structuredClone(m.parts[0]), id: 'extra'}); },
        m => { m.belts.pop(); },
        m => { m.belts[0].around.reverse(); },
        m => { m.belts[0].band = 'x37.dat'; },
        m => { m.decor = [{part: 'custom.dat', color: 16, position: [0, 0, 0], matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1]}]; },
        m => { m.files = {'custom.dat': '0 Custom geometry\n'}; },
        m => { m.ropes = [{id: 'extra-rope', lengthLdu: 100, around: ['input_key', 'output_key']}]; },
        m => { m.hoses = [{id: 'extra-hose', a: {part: 'input_key', port: 'A'}, b: {part: 'output_key', port: 'B'}}]; }
    ];
    const resolve = resolver();
    for (const edit of edits) {
        const changed = structuredClone(model);
        edit(changed);
        assert.equal(await resolve(changed), null, edit.toString());
    }
});

test('missing or malformed references prevent the app from building the policy index', () => {
    assert.throws(() => resolver(resonanceModels, () => { throw new Error('missing'); }), /missing/);
    assert.throws(() => resolver(resonanceModels, () => `${source}
2 16 0 0 0 1 1 1
`), /Could not read manual policy reference/);
    assert.throws(() => createManualPolicyResolver({models: resonanceModels, referenceDigests: {}}), /Missing manual policy reference/);
    assert.equal(resolver([], () => assert.fail('no reference needed'))(model), null);
    assert.equal(resolver()({version: 1, parts: []}), null);
});

test('conflicting aliases and nonfinite physical data fail instead of matching a policy', async () => {
    assert.throws(() => createManualPolicyResolver({models: [
        {file: 'same.ldr', manualJog: policy},
        {file: 'same.ldr', manualJog: {A: {...policy.A, maxDeg: 8}}}
    ], referenceDigests: {}}), /Conflicting manual policies/);
    const invalid = structuredClone(model);
    invalid.parts[0].position[0] = NaN;
    assert.throws(() => resolver()(invalid), /finite, serializable saved model/);
});


test('each bounded model resolves its own real source and saved project without aliasing another policy',async()=>{
 const resolve=resolver(MODELS);
 for(const entry of MODELS.filter(m=>m.manualJog)){
  const raw=read('overlay/scratch-gui/static/sim-lab/models/'+entry.file),parsed=parseModel(raw).model;
  assert.equal(await resolve(parsed),entry.manualJog,entry.file);
  assert.equal(await resolve(parseModel(serializeModel(parsed)).model),entry.manualJog,entry.file+' saved');
 }
});


test('rounded Root Bridge project retains its published finite controls',async()=>{
 const source=read('overlay/scratch-gui/static/sim-lab/models/root-bridge.ldr');
 const original=parseModel(source).model,saved=parseModel(serializeModel(original)).model;
 assert.notDeepEqual(saved.parts,original.parts,'The real serializer rounds the supplied non-cardinal placements');
 const limits=MODELS.find(m=>m.file==='root-bridge.ldr').manualJog;
 const resolve=resolver([{file:'root-bridge.ldr',manualJog:limits}],()=>source);
 assert.equal(await resolve(original),limits);assert.equal(await resolve(saved),limits);
 const moved=structuredClone(saved);moved.parts[0].position[0]+=.00001;
 assert.equal(await resolve(moved),null,'A representable physical edit is still a different assembly');
});
