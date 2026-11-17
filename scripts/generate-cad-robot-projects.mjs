// SPDX-License-Identifier: BSD-3-Clause
// Complete projects: one Board/CAD/VM clock, real widgets read by the program.
import {readFile,writeFile,mkdir,cp,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import JSZip from 'jszip';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator-register-art.js';
import {CAD_ROBOT_EXAMPLES} from '../overlay/scratch-gui/src/lib/bw-cad-robot-catalog.js';
export function robotProjectState(doc){
 const joints=(doc.joints||[]).filter(j=>j.control?.port),parts=[{id:'uno',kind:'arduino_uno',terminals:[...Array.from({length:14},(_,i)=>'d'+i),'5v','gnd'],params:{},x:70,y:100},{id:'logic',kind:'vcc',terminals:['vcc'],params:{},x:70,y:20},{id:'ground',kind:'gnd',terminals:['gnd'],params:{},x:70,y:480},{id:'battery',kind:'battery',terminals:['pos','neg'],params:{volts:6,rInternal:.5},x:310,y:20}],wires=[];
 const t=(part,terminal)=>({part,terminal}),net=(id,...ends)=>ends.slice(1).forEach((end,i)=>wires.push({id:`${id}-${i}`,netId:id,from:ends[0],to:end}));
 net('logic',t('logic','vcc'),t('uno','5v'));net('ground',t('ground','gnd'),t('uno','gnd'),t('battery','neg'));
 const connections={version:1,cadDocumentId:doc.id,enabled:true,drives:[],servos:[],sensors:[]},widgets=[],lines=['# CAD robot controls: start Run, then use Widgets or the CAD Controls drawer.','# Widgets are simulation inputs; replace them with hardware inputs for firmware.','# Realtime motor model: R/back-EMF/torque; no coil inductance or flyback diodes.','DEVICE ARDUINO-UNO','CLOCK 16000000','','WHEN flag clicked:','  forever:'];
 const motors=joints.filter(j=>j.kind==='slider'||!j.limits),servos=joints.filter(j=>j.kind==='hinge'&&j.limits),pinsets=[['d5','d2','d3'],['d6','d4','d7'],['d9','d8','d10']];
 if(motors.length>3||servos.length>3)throw Error('Robot exceeds authored Uno wiring budget');
 const slider=(name,label,min,max,value)=>widgets.push({name,type:'slider',config:{min,max,step:1,value},layout:{x:12,y:12+widgets.length*100,w:320,h:88,label},binding:{target:'program'}});
 for(const [i,j]of motors.entries()){
  const id=doc.id==='robot-tt-rover'?['left','right'][i]:'motor'+j.control.port,bridge='bridge'+Math.floor(i/2),[enable,forward,reverse]=pinsets[i];
  // Linear stages use a nominal bare DC rotor; the TT value is output-shaft equivalent.
  // Applying that geared output constant to an 8 mm lead screw overstates its drive.
  const motorConstant=j.kind==='slider'?.005:.25;
  // Real-time functional circuit: keep resistance, back-EMF and torque coupling.
  // Coil ripple/flyback analysis belongs to the explicit detailed circuit model.
  parts.push({id,kind:doc.id==='robot-tt-rover'?'dc_motor_encoder':'dc_motor',terminals:doc.id==='robot-tt-rover'?['a','b','enc_a','enc_b']:['a','b'],params:{windingR:10,windingH:0,kV:motorConstant,kT:motorConstant,pulsesPerRev:2},x:580,y:70+i*150});
  const channel=i%2===0?['en1','in1','in2','out1','out2']:['en2','in3','in4','out3','out4'];
  if(i%2===0){
   parts.push({id:bridge,kind:'h_bridge',terminals:['vcc','gnd','en1','in1','in2','out1','out2','en2','in3','in4','out3','out4'],params:{clampDiodes:false},x:330,y:100+i*150});
   net('power-'+i,t('battery','pos'),t(bridge,'vcc'));net('return-'+i,t('ground','gnd'),t(bridge,'gnd'));
   if(i===motors.length-1)net('unused-'+i,t('ground','gnd'),t(bridge,'en2'),t(bridge,'in3'),t(bridge,'in4'));
  }
  for(const [pin,input]of[[enable,channel[0]],[forward,channel[1]],[reverse,channel[2]]])net(id+'-'+input,t('uno',pin),t(bridge,input));
  if(doc.id==='robot-tt-rover'&&i===0){net('encoder-a',t(id,'enc_a'),t('uno','d0'));net('encoder-b',t(id,'enc_b'),t('uno','d1'));}
  net(id+'-a',t(bridge,channel[3]),t(id,'a'));net(id+'-b',t(bridge,channel[4]),t(id,'b'));
  connections.drives.push({partId:id,jointId:j.id,kind:j.kind,direction:1,ratio:1,efficiency:1,leadMm:8});
  // Start within the available travel instead of pushing a limit at zero.
  const initialDirection=j.kind==='slider'&&j.limits&&-j.limits[0]>j.limits[1]?-1:1;
  slider(id,`${j.control.port} · ${j.name||j.id} (%)`,-100,100,initialDirection*(doc.id==='robot-tt-rover'?30:25));
  lines.push(`    IF NOT (widget value "${id}" = previous_${id}) THEN:`,`      IF widget value "${id}" < 0 THEN:`,`        set "${id}" direction reverse`,`        set "${id}" speed to (0 - widget value "${id}")`,'      ELSE:',`        set "${id}" direction forward`,`        set "${id}" speed to widget value "${id}"`,`      set previous_${id} to widget value "${id}"`);
 }
 for(const [i,j]of servos.entries()){
  const id='servo'+j.control.port,pin=['d11','d12','d13'][i];parts.push({id,kind:'servo',terminals:['signal','vcc','gnd'],params:{},x:580,y:100+(motors.length+i)*140});
  net(id+'-power',t('logic','vcc'),t(id,'vcc'));net(id+'-ground',t('ground','gnd'),t(id,'gnd'));net(id+'-signal',t('uno',pin),t(id,'signal'));
  connections.servos.push({partId:id,jointId:j.id,direction:1,centerDeg:90,torqueNm:.35});
  slider(id,`${j.control.port} · ${j.name||j.id} (°)`,Math.max(0,Math.ceil(90+j.limits[0]*180/Math.PI)),Math.min(180,Math.floor(90+j.limits[1]*180/Math.PI)),Math.max(0,Math.min(180,Math.floor(90+j.limits[1]*180/Math.PI),Math.max(90+j.limits[0]*180/Math.PI,105))));
  lines.push(`    IF NOT (widget value "${id}" = previous_${id}) THEN:`,`      set "${id}" angle to widget value "${id}"`,`      set previous_${id} to widget value "${id}"`);
 }
 lines.splice(lines.indexOf('WHEN flag clicked:')+1,0,...widgets.map(w=>`  set previous_${w.name} to -999`));
 lines.push('    wait 0.02 seconds','');
 return {circuit:{version:1,vcc:5,parts,wires,holeWires:[]},controller:{version:1,mode:'play',hideBindings:true,widgets},cadCircuit:connections,code:{lang:'pseudocode',code:lines.join('\n')}};
}
export async function packageRobot(doc){
 const state=robotProjectState(doc),creator=new SB3Creator();creator.parse(state.code.code);creator.project.stc.version=1;creator.project.stc.cadRobotProjectVersion=2;
 const valid=creator.validate();if(valid.errors?.length)throw Error(JSON.stringify(valid.errors));
 const zip=await JSZip.loadAsync(await(await creator.generateSB3()).arrayBuffer());zip.file('brickwright/cad.json',JSON.stringify(doc));zip.file('brickwright/state.json',JSON.stringify({format:'brickwright-state',version:2,state}));
 for(const [file,path]of[['ADAFRUIT-MIT-LICENSE.txt','../licenses/adafruit-cad-parts-MIT.txt'],['BRICKWRIGHT-BSD-3-CLAUSE.txt','../LICENSE']])zip.file('brickwright/licenses/'+file,await readFile(new URL(path,import.meta.url)));
 return {state,bytes:await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'})};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const root=resolve(process.argv[2]||'../circuit-cad-engine-work'),output=new URL('../overlay/scratch-gui/static/cad-robots/',import.meta.url),factories=[['tt-rover','createTTRoverDocument'],['steerable-rover','createSteerableRoverDocument'],['atlas-forklift','createAtlasForkliftDocument'],['mantis-walker','createMantisWalkerDocument'],['cyclone-sorter','createCycloneSorterDocument'],['helios-catapult','createHeliosCatapultDocument'],['labyrinth-tilter','createLabyrinthTilterDocument'],['apex-scara','createApexScaraDocument'],['orion-carousel','createOrionCarouselDocument'],['vortex-pinball','createVortexPinballDocument'],['titan-vise','createTitanViseDocument'],['hermes-crane','createHermesCraneDocument'],['chronos-drawbridge','createChronosDrawbridgeDocument'],['polaris-tracker','createPolarisTrackerDocument'],['boreal-launcher','createBorealLauncherDocument'],['zephyr-conveyor','createZephyrConveyorDocument'],['quasar-press','createQuasarPressDocument'],['nova-loader','createNovaLoaderDocument'],['vector-plotter','createVectorPlotterDocument'],['aegis-sentry','createAegisSentryDocument'],['stratos-gimbal','createStratosGimbalDocument'],['kestrel-arm','createKestrelArmDocument']],manifest=[];await mkdir(output,{recursive:true});
 for(const [i,item]of CAD_ROBOT_EXAMPLES.entries()){
  const [file,method]=factories[i],factory=(await import(pathToFileURL(resolve(root,`packages/editor/dist/${file}.js`)).href))[method],doc=factory();if(doc.id!==item.id)throw Error('Unexpected model identity');const {state,bytes}=await packageRobot(doc);await writeFile(new URL(item.file,output),bytes);manifest.push({...item,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),widgets:state.controller.widgets.map(w=>w.name),joints:[...state.cadCircuit.drives,...state.cadCircuit.servos].map(d=>d.jointId)});console.log(item.name,bytes.length,state.controller.widgets.length,'live controls');
 }
 await writeFile(new URL('manifest.json',output),JSON.stringify({version:1,examples:manifest},null,2)+'\n');
 const mirror=new URL('../packages/scratch-gui/static/',import.meta.url);try{await access(mirror);await cp(output,new URL('cad-robots/',mirror),{recursive:true});console.log('Synced canonical robot projects into the GUI build inputs');}catch(error){if(error.code!=='ENOENT')throw error;}
}
