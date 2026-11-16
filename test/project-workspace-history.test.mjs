import test from 'node:test';
import assert from 'node:assert/strict';
import {registerUndoSurface,activateUndoSurface,notifyUndoState,getUndoState} from '../overlay/scratch-gui/src/lib/global-undo.js';
import {clearProjectHistory,moveHistory,timeline,recordProjectEdit} from '../overlay/scratch-gui/src/lib/bw-undo-coordinator.js';
test('project timeline traverses interleaved hidden CAD, Code and project edits, then redoes them',async()=>{
 clearProjectHistory();const calls=[];
 const stack=name=>{const past=[],future=[];return{past,future,label:name,depth:()=>({undo:past.length,redo:future.length}),steps:()=>({past,future:[...future].reverse()}),undo:()=>{calls.push(name+':undo');future.push(past.pop());},redo:()=>{calls.push(name+':redo');past.push(future.pop());}};};
 const cad=stack('CAD'),code=stack('Code'),a=registerUndoSurface('workspace-cad',cad),b=registerUndoSurface('workspace-code',code);
 try{
  activateUndoSurface('workspace-cad');cad.past.push('Add box');notifyUndoState();code.past.push('Change program');notifyUndoState();cad.past.push('Move box');notifyUndoState();recordProjectEdit({label:'Project: Rename',undo:()=>calls.push('Project:undo'),redo:()=>calls.push('Project:redo')});
  activateUndoSurface('workspace-code');assert.deepEqual(timeline('workspace').past,['Project: Rename','CAD: Move box','Code: Change program','CAD: Add box']);
  assert.equal(await moveHistory(-4,'workspace'),4);assert.deepEqual(calls,['Project:undo','CAD:undo','Code:undo','CAD:undo']);assert.equal(getUndoState().surface,'workspace-code');
  assert.equal(await moveHistory(4,'workspace'),4);assert.deepEqual(cad.past,['Add box','Move box']);assert.deepEqual(code.past,['Change program']);
 }finally{a();b();clearProjectHistory();}
});
test('workspace jump stops if its CAD owner is replaced during an async undo',async()=>{
 clearProjectHistory();let finish,n=2,replacement=0;
 const off=registerUndoSurface('pending-cad',{label:'CAD',depth:()=>({undo:n,redo:0}),undo:()=>new Promise(resolve=>{finish=()=>{n--;notifyUndoState();resolve(true);};})});let newer=()=>{};
 try{activateUndoSurface('pending-cad');const job=moveHistory(-2,'workspace');off();newer=registerUndoSurface('pending-cad',{depth:()=>({undo:1,redo:0}),undo:()=>{replacement++;}});finish();assert.equal(await job,1);assert.equal(replacement,0);}finally{off();newer();clearProjectHistory();}
});
