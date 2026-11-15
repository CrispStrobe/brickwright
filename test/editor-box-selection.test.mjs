// SPDX-License-Identifier: BSD-3-Clause
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectionRectangle, projectedBoxIntersects} from '../overlay/scratch-gui/src/lib/editor-interaction/box-selection.js';
const viewport = {width: 800, height: 600};
const box = (xs, ys, zs, w = 1) => xs.flatMap(x => ys.flatMap(y => zs.map(z => ({x, y, z, w}))));
const rectangle = {left: 200, right: 220, top: 200, bottom: 220};

test('rectangle works in all drag directions and catches a part edge whose center is outside', () => {
    assert.deepEqual(selectionRectangle(220, 220, 200, 200), rectangle);
    assert.equal(projectedBoxIntersects(box([-.5, .5], [-.5, .5], [-.5, .5]), rectangle, viewport), true);
    assert.equal(projectedBoxIntersects(box([.5, .8], [-.5, .5], [-.5, .5]), rectangle, viewport), false);
});

test('depth clipping rejects objects behind the eye and outside the near/far planes', () => {
    for (const points of [box([-.5,.5],[-.5,.5],[2,3]), box([-.5,.5],[-.5,.5],[-3,-2]), box([-.5,.5],[-.5,.5],[-.5,.5],-1)]) {
        assert.equal(projectedBoxIntersects(points, rectangle, viewport), false);
    }
    assert.equal(projectedBoxIntersects(box([-.5,.5],[-.5,.5],[-2,0]), rectangle, viewport), true);
    assert.equal(projectedBoxIntersects(box([-.5,.5],[-.5,.5],[0,2]), rectangle, viewport), true);
    assert.equal(projectedBoxIntersects(box([-.5,.5],[-.5,.5],[-2,2]), rectangle, viewport), true);
});

test('orthographic and perspective homogeneous coordinates produce the same projected selection', () => {
    const points = box([-.5,.5],[-.5,.5],[-.5,.5]);
    const scaled = points.map(p => Object.fromEntries(Object.entries(p).map(([k,v]) => [k,v*3])));
    assert.equal(projectedBoxIntersects(scaled, rectangle, viewport), true);
    assert.equal(projectedBoxIntersects(points, rectangle, {width:0,height:0}), false);
    assert.equal(projectedBoxIntersects([], rectangle, viewport), false);
});
