// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';
import {transformPreviewMetrics as metrics} from '../overlay/scratch-gui/src/lib/bw-sim/editor/transform-preview.js';
const I=[1,0,0,0,1,0,0,0,1],original={id:'a',position:[20,-20,40],rotation:I};
test('actual snapped poses report millimetres and viewport axis directions without changing their inputs',()=>{
 const start=[original],moves=[{...original,position:[40,-40,20]}],before=JSON.stringify([start,moves]);
 const m=metrics(start,moves);assert.deepEqual(m.deltaMm,[8,8,8]);assert.ok(Math.abs(m.distanceMm-Math.sqrt(192))<1e-9);assert.equal(m.angleDegrees,0);assert.equal(JSON.stringify([start,moves]),before);
});
test('orientation change is invariant to initial orientation and suppresses floating point noise',()=>{
 const quarter=[0,-1,0,1,0,0,0,0,1];assert.equal(metrics([original],[{...original,rotation:quarter}]).angleDegrees,90);
 assert.equal(metrics([{...original,rotation:quarter}],[original]).angleDegrees,90);
 assert.equal(metrics([original],[{...original,position:[20+1e-12,-20,40]}]).deltaMm[0],0);
 assert.equal(metrics([original],[{...original,rotation:I.map((v,i)=>i===0?v+1e-12:v)}]).angleDegrees,0);
});
test('a canceled, unmatched or invalid preview produces no readout',()=>{
 assert.equal(metrics([original],[]),null);assert.equal(metrics([original],[{...original,id:'new'}]),null);
 assert.equal(metrics([original],[{...original,position:[NaN,0,0]}]),null);
});
