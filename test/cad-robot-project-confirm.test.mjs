// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../overlay/scratch-gui/src/lib/bw-cad-robot-projects.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/\bexport /g,'');
function fixture(confirmAsync){
 const events=[],bytes=new Uint8Array([1,2]).buffer;
 const load=new Function('CAD_ROBOT_EXAMPLES','loadProjectFile','inspectBrickwrightState','confirmAsync','window','document','CustomEvent','fetch',source+';return openCadRobotProject;');
 const open=load([{id:'sample',file:'sample.sb3',name:'Sample'}],async()=>events.push('load'),async()=>{events.push('inspect');return {outcome:'loaded',cadText:'{"id":"sample"}',state:{'bw-ctl-widgets':{},'bw-circuit-autosave':{}}}},confirmAsync,{confirm:confirmAsync,dispatchEvent(){events.push('event')}},{baseURI:'https://example.invalid/app/'},class{constructor(type,options){this.type=type;this.detail=options.detail}},async()=>{events.push('fetch');return {ok:true,arrayBuffer:async()=>bytes}});
 return {events,open:()=>open({stopAll(){events.push('stop')}},'sample')};
}
test('a pending or cancelled native confirmation never fetches or replaces the project',async()=>{
 let answer;const {events,open}=fixture(()=>new Promise(resolve=>{answer=resolve}));const pending=open();await Promise.resolve();assert.deepEqual(events,[]);answer(false);assert.equal(await pending,false);assert.deepEqual(events,[]);
});
test('native confirmation failures propagate before destructive work',async()=>{
 const {events,open}=fixture(async()=>{throw Error('synthetic dialog failure')});await assert.rejects(open(),/synthetic dialog failure/);assert.deepEqual(events,[]);
});
test('accepted native confirmation completes inspection before stop and project replacement',async()=>{
 const {events,open}=fixture(async()=>true);assert.equal(await open(),true);assert.deepEqual(events,['fetch','inspect','stop','load','event']);
});
