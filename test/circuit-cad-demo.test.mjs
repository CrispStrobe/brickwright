// SPDX-License-Identifier: BSD-3-Clause
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import JSZip from 'jszip';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator-register-art.js';
import {inspectBrickwrightState} from '../overlay/scratch-gui/src/lib/bw-project-bundle.js';
import {validateConnections} from '../overlay/scratch-gui/src/lib/bw-cad-circuit/session.js';
test('Scout demo contains loadable versioned pin declarations, a complete circuit, CAD, and editable blocks',async()=>{
 const bytes=await readFile(new URL('../overlay/scratch-gui/static/circuit-cad/scout-encoder.sb3',import.meta.url)),zip=await JSZip.loadAsync(bytes),project=JSON.parse(await zip.file('project.json').async('text'));
 assert.equal(project.stc.version,1,'VM deserializer deliberately refuses unversioned hardware declarations');assert.equal(project.stc.device,'arduino-uno');assert.equal(project.stc.pins.length,7);
 const inspection=await inspectBrickwrightState(bytes);assert.equal(inspection.outcome,'loaded',inspection.reason);
 const state=JSON.parse(await zip.file('brickwright/state.json').async('text')).state,connections=validateConnections(state.cadCircuit),cad=JSON.parse(await zip.file('brickwright/cad.json').async('text'));
 assert.equal(cad.id,connections.cadDocumentId);assert.equal(cad.simulation.fixBase,false);assert.equal(connections.drives.length,2);
 for(const drive of connections.drives){assert.ok(state.circuit.parts.some(p=>p.id===drive.partId && p.kind==='dc_motor_encoder'));assert.ok(cad.joints.some(j=>j.id===drive.jointId && j.kind==='hinge'));}
 for(const p of project.stc.pins)assert.ok(state.circuit.wires.some(w=>[w.from,w.to].some(t=>t.part==='uno' && t.terminal.toLowerCase()===p.where.toLowerCase())),'every declared pin has a wire');
 const text=await readFile(new URL('../overlay/scratch-gui/static/circuit-cad/scout-encoder.bw',import.meta.url),'utf8'),creator=new SB3Creator();creator.parse(text);assert.equal(creator.validate().isValid,true);assert.equal(state.code.code,text);
 assert.ok(creator.generateC(project,{debug:true}).includes('main'),'same blocks emit actual Arduino C');
});
