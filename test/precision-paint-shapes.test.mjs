// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// Exercise the numeric placement with the same artboard constants as Paper's view.
const paper = {Rectangle: class {
    constructor(x, y, width, height) { Object.assign(this, {x, y, width, height}); }
}};
const view = {
    ART_BOARD_WIDTH: 960,
    SVG_ART_BOARD_WIDTH: 480,
    CENTER: {x:480,y:360},
    MAX_WORKSPACE_BOUNDS: {contains: ({x,y,width,height}) =>
        x >= -240 && y >= -180 && x + width <= 1200 && y + height <= 900}
};
const source = readFileSync(new URL('../overlay/scratch-paint/src/helper/bw/precision-shape.js',import.meta.url),'utf8');
const bounds = new Function('paper',...Object.keys(view),
    source.replace(/^import .*;\n/gm,'').replace(/^export const /gm,'const ') + '\nreturn precisionShapeBounds;'
)(paper,...Object.values(view));

test('precise rectangles and circles share the existing center and artwork scale',()=>{
    const rect = bounds({kind:'rectangle',x:12.5,y:-7.25,width:60,height:30});
    assert.deepEqual({...rect},{x:445,y:315.5,width:120,height:60});
    const circle = bounds({kind:'circle',x:-20,y:10,width:25,height:0});
    assert.deepEqual({...circle},{x:415,y:355,width:50,height:50});
});

test('bad sizes, unsupported shapes, and off-canvas placements are rejected',()=>{
    const draft = {kind:'rectangle',x:0,y:0,width:60,height:30};
    for (const patch of [{width:0},{height:NaN},{y:Infinity},{x:345},{kind:'arc'}]) {
        assert.equal(bounds({...draft,...patch}),null);
    }
    assert.ok(bounds({...draft,x:330}));
});

test('line bounds include the stroke and reject coincident endpoints',()=>{
    const draft = {kind:'line',x:-20,y:-10,endX:40,endY:10,stroke:4};
    assert.deepEqual({...bounds(draft)},{x:436,y:336,width:128,height:48});
    assert.equal(bounds({...draft,endX:-20,endY:-10}),null);
    assert.equal(bounds({...draft,stroke:0}),null);
});

test('a major counterclockwise arc includes the extrema it crosses',()=>{
    const draft = {kind:'arc',x:10,y:-20,radius:25,startAngle:45,sweep:-225,stroke:4};
    const arc = bounds(draft);
    assert.deepEqual([arc.x,arc.y,arc.width],[446,266,108]);
    assert.ok(Math.abs(arc.height - (25 + 25 * Math.SQRT1_2 + 4) * 2) < 1e-10);
    const clockwise = bounds({...draft,sweep:90});
    assert.ok(clockwise.y > arc.y);
    assert.ok(Math.abs(clockwise.height - (25 * (1 - Math.SQRT1_2) + 4) * 2) < 1e-10);
});

test('arcs reject whole turns, vanishing lengths, and visible strokes beyond the workspace',()=>{
    const draft = {kind:'arc',x:0,y:0,radius:40,startAngle:0,sweep:90,stroke:2};
    for (const patch of [{sweep:0},{sweep:360},{sweep:-360},{radius:.01,sweep:.01},{x:319,stroke:4}]) {
        assert.equal(bounds({...draft,...patch}),null);
    }
});
