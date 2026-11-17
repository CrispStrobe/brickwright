// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import JSZip from 'jszip';
import {CAD_ROBOT_EXAMPLES} from '../overlay/scratch-gui/src/lib/bw-cad-robot-catalog.js';
import {inspectBrickwrightState} from '../overlay/scratch-gui/src/lib/bw-project-bundle.js';
import {validateConnections} from '../overlay/scratch-gui/src/lib/bw-cad-circuit/session.js';
import {ControllerPanel} from 'bw-board/controller.js';
import {BoardImpl,registerAllDevices} from 'bw-board';
registerAllDevices();
const base=new URL('../overlay/scratch-gui/static/cad-robots/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',base),'utf8'));
for(const item of CAD_ROBOT_EXAMPLES)test(`${item.name}: one project restores CAD, editable Blocks/Code, real circuit and live Widgets`,async()=>{
 const bytes=await readFile(new URL(item.file,base)),record=manifest.examples.find(e=>e.id===item.id);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),record.sha256);assert.equal(bytes.length,record.bytes);
 const zip=await JSZip.loadAsync(bytes),inspection=await inspectBrickwrightState(bytes);assert.equal(inspection.outcome,'loaded');
 const doc=JSON.parse(inspection.cadText),bundle=JSON.parse(await zip.file('brickwright/state.json').async('text')).state,project=JSON.parse(await zip.file('project.json').async('text'));
 assert.equal(project.stc.cadRobotProjectVersion,2);assert.equal(doc.simulation.selfCollisions,item.id==='robot-quasar-press', 'Quasar needs ram/dial and ejector/dial contacts; other mechanisms retain connector-controlled internal travel');
 assert.equal(bundle.circuit.parts.filter(p=>p.kind==='h_bridge').length,Math.ceil(bundle.cadCircuit.drives.length/2));
 assert.ok(bundle.circuit.parts.filter(p=>['dc_motor','dc_motor_encoder'].includes(p.kind)).every(p=>p.params.windingH===0));
 assert.equal(doc.id,item.id);const config=validateConnections(bundle.cadCircuit);assert.equal(config.enabled,true);assert.equal(config.cadDocumentId,doc.id);
 const parts=bundle.circuit.parts,widgets=ControllerPanel.fromJSON(bundle.controller);assert.equal(widgets.mode,'play');
 const actuators=[...config.drives,...config.servos];assert.equal(actuators.length,doc.joints.filter(j=>j.control?.port).length);assert.equal(widgets.getWidgets().length,actuators.length);
 const blocks=project.targets.flatMap(t=>Object.values(t.blocks));assert.ok(blocks.some(b=>b.opcode==='event_whenflagclicked'));assert.ok(blocks.some(b=>b.opcode==='controller_controllerValue'));assert.ok(!blocks.some(b=>b.opcode.startsWith('cadlab_')),'controller goes through Circuit rather than directly overriding CAD');
 assert.ok(bundle.code.code.includes('widget value'));assert.ok(zip.file('brickwright/licenses/ADAFRUIT-MIT-LICENSE.txt'));
 const nets=new Map();for(const w of bundle.circuit.wires){if(!nets.has(w.netId))nets.set(w.netId,new Map());for(const t of [w.from,w.to])nets.get(w.netId).set(t.part+':'+t.terminal,t);}
 const board=new BoardImpl(5);board.setNetlist(parts,[...nets].map(([id,ends])=>({id,terminals:[...ends.values()]})));board.setPower(true);
 for(const drive of config.drives){assert.ok(doc.joints.some(j=>j.id===drive.jointId));assert.ok(widgets.getWidget(drive.partId));assert.equal(board.setDeviceControl(drive.partId,'direction','forward'),true);assert.equal(board.setDeviceControl(drive.partId,'speed',35),true);assert.equal(board.setDeviceControl(drive.partId,'direction','reverse'),true);}
 for(const servo of config.servos){assert.ok(widgets.getWidget(servo.partId));assert.equal(board.setDeviceControl(servo.partId,'angle',100),true);}
 board.setPower(false);
});
