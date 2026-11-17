// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import JSZip from 'jszip';
import {CAD_ROBOT_EXAMPLES} from '../overlay/scratch-gui/src/lib/bw-cad-robot-catalog.js';
for(const item of CAD_ROBOT_EXAMPLES)test(`${item.name}: initial slider commands use available travel`,async()=>{
 const zip=await JSZip.loadAsync(await readFile(new URL(`../overlay/scratch-gui/static/cad-robots/${item.file}`,import.meta.url)));
 const doc=JSON.parse(await zip.file('brickwright/cad.json').async('text'));
 const state=JSON.parse(await zip.file('brickwright/state.json').async('text')).state;
 for(const drive of state.cadCircuit.drives.filter(d=>d.kind==='slider')){
  const joint=doc.joints.find(j=>j.id===drive.jointId);
  const widget=state.controller.widgets.find(w=>w.name===drive.partId);
  const command=widget.config.value*drive.direction;
  assert.notEqual(command,0,'Run must initially command motion');
  if(joint.limits){
   assert.ok(command>0?joint.limits[1]>0:joint.limits[0]<0,`${joint.id} pushes its initial travel stop`);
   if(-joint.limits[0]>joint.limits[1])assert.ok(command<0,`${joint.id} should use its longer negative travel`);
  }
 }
});
