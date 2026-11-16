// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {parseModel} from '../overlay/scratch-gui/src/lib/bw-sim/model/ldraw-model.js';
import {upgradePartMeta} from '../overlay/scratch-gui/src/lib/bw-sim/contracts.js';
import {buildGraph} from '../overlay/scratch-gui/src/lib/bw-sim/mech/graph.js';
import {buildSteps} from '../overlay/scratch-gui/src/lib/bw-sim/instructions/steps.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const models = 'overlay/scratch-gui/static/sim-lab/models/';
const catalog = new Map(JSON.parse(read('overlay/scratch-gui/src/lib/bw-sim/part-meta/parts.json')).parts
    .map(part => [part.part, upgradePartMeta(part)]));
const ldr = read(models + 'tempest-pendulum.ldr');
const load = text => {
    const result = parseModel(text, {catalog});
    assert.deepEqual(result.refusals, []);
    return result.model;
};

test('Tempest keeps its original ordered placements in the LDR, MPD and source fixture', () => {
    const placements = ldr.split(/\r?\n/).filter(line => line.startsWith('1 ') || line.startsWith('0 !BW ID ')).join('\n') + '\n';
    // The 69 original placement records, including IDs, order, colours and transforms.
    assert.equal(createHash('sha256').update(placements).digest('hex'), '4a29778e2f3acdd3ce3a4918ede05fae62b3c7a35b5d9a24a5b326b85e09e0bf');
    assert.deepEqual(load(read(models + 'tempest-pendulum.mpd')), load(ldr));
    assert.equal(read('test/fixtures/model-files/tempest-pendulum-source/models/tempest-pendulum.ldr'), ldr);
});

test('Tempest instructions use connected pages of at most six parts', () => {
    const model = load(ldr);
    const plan = buildSteps(model, catalog);
    assert.equal(plan.source, 'auto', 'coarse authored stages must not bypass connected page generation');
    const {nodes, edges} = buildGraph(model, catalog, []);
    const adjacency = new Map(model.parts.map(part => [part.id, new Set()]));
    for (const edge of edges) {
        const a = nodes.get(edge.a.part).partId, b = nodes.get(edge.b.part).partId;
        if (a !== b) { adjacency.get(a).add(b); adjacency.get(b).add(a); }
    }
    const built = new Set();
    for (const [index, step] of plan.steps.entries()) {
        assert.equal(step.loose, false, `step ${index + 1} is connected`);
        assert.ok(step.parts.length >= 1 && step.parts.length <= 6, `step ${index + 1}: ${step.parts.length} parts`);
        const fresh = new Set(step.parts);
        const reached = new Set(built.size ? step.parts.filter(id => [...adjacency.get(id)].some(other => built.has(other))) : [step.parts[0]]);
        const queue = [...reached];
        while (queue.length) for (const other of adjacency.get(queue.shift())) {
            if (fresh.has(other) && !reached.has(other)) { reached.add(other); queue.push(other); }
        }
        assert.equal(reached.size, fresh.size, `step ${index + 1}: each part connects to the assembly`);
        for (const id of step.parts) { assert.ok(!built.has(id), `${id} placed only once`); built.add(id); }
    }
    assert.equal(built.size, 69);
    assert.deepEqual([...built].sort(), model.parts.map(part => part.id).sort());
});
