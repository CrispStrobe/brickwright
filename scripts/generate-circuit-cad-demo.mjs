// SPDX-License-Identifier: BSD-3-Clause
import {writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const cadRoot=process.argv[2];if(!cadRoot)throw new Error('Usage: node scripts/generate-circuit-cad-demo.mjs <built-cad-checkout>');
const {createTTRoverDocument}=await import(pathToFileURL(resolve(cadRoot,'packages/editor/dist/tt-rover.js')).href);
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator-register-art.js';
import JSZip from 'jszip';
const out=new URL('../overlay/scratch-gui/static/circuit-cad/',import.meta.url).pathname;
const program=await readFile(out+'scout-encoder.bw','utf8'),creator=new SB3Creator();creator.parse(program);creator.project.stc.version=1;console.log('program',creator.validate());
const t=(part,terminal)=>({part,terminal:part==='uno'?terminal.toLowerCase():terminal}),parts=[
 {id:'uno',kind:'arduino_uno',terminals:['D2','D3','D5','D6','D8','D9','D10','D11','5v','gnd'].map(s=>s.toLowerCase()),params:{},x:80,y:60},
 {id:'logic',kind:'vcc',terminals:['vcc'],params:{},x:80,y:0},{id:'ground',kind:'gnd',terminals:['gnd'],params:{},x:80,y:240},
 {id:'battery',kind:'battery',terminals:['pos','neg'],params:{volts:6,rInternal:.5},x:320,y:0},
 {id:'driver',kind:'h_bridge',terminals:['vcc','gnd','en1','in1','in2','out1','out2','en2','in3','in4','out3','out4'],params:{},x:320,y:130},
 ...['left','right'].map((id,i)=>({id,kind:'dc_motor_encoder',terminals:['a','b','enc_a','enc_b'],params:{windingR:10,windingH:.005,kV:.25,kT:.25,pulsesPerRev:2},x:550,y:70+i*150}))];
const nets=[['logic',t('logic','vcc'),t('uno','5v')],['ground',t('ground','gnd'),t('uno','gnd'),t('battery','neg'),t('driver','gnd')],['motor-power',t('battery','pos'),t('driver','vcc')],
 ...[['D5','en1'],['D6','en2'],['D8','in1'],['D9','in2'],['D10','in3'],['D11','in4']].map(([pin,input])=>['control-'+pin,t('uno',pin),t('driver',input)]),
 ...[['left','a','out1'],['left','b','out2'],['right','a','out3'],['right','b','out4']].map(([id,terminal,output])=>[id+terminal,t(id,terminal),t('driver',output)]),
 ['encoder-a',t('left','enc_a'),t('uno','D2')],['encoder-b',t('left','enc_b'),t('uno','D3')]];
const circuit={version:1,vcc:5,parts,wires:nets.flatMap(([netId,first,...rest])=>rest.map((last,i)=>({id:netId+'-'+i,netId,from:first,to:last}))),holeWires:[]};
const cad=createTTRoverDocument(),connections={version:1,cadDocumentId:cad.id,enabled:true,drives:[{partId:'left',jointId:'drive-a',ratio:1,efficiency:1,direction:1},{partId:'right',jointId:'drive-b',ratio:1,efficiency:1,direction:1}],servos:[],sensors:[]};
const zip=await JSZip.loadAsync(await(await creator.generateSB3()).arrayBuffer());zip.file('brickwright/cad.json',JSON.stringify(cad));zip.file('brickwright/state.json',JSON.stringify({format:'brickwright-state',version:2,state:{circuit,code:{lang:'pseudocode',code:program},cadCircuit:connections}}));
for(const [name,value]of[['scout-encoder.circuit.json',circuit],['scout-encoder.connections.json',connections]])await writeFile(out+name,JSON.stringify(value,null,2)+'\n');
await writeFile(out+'scout-encoder.sb3',await zip.generateAsync({type:'nodebuffer'}));console.log('wrote self-contained Scout circuit/CAD/blocks project');
