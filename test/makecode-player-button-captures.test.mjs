import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import Creator from '../overlay/scratch-gui/src/lib/sb3-creator-register-art.js';
import {analyseConsoleCaptures} from '../overlay/scratch-gui/src/lib/bw-makecode/console-capture-provenance.js';
import {createArrayReferenceExportAuthority} from '../overlay/scratch-gui/src/lib/bw-makecode/array-reference-export-authority.js';
import {createProjectJsonSnapshot} from '../overlay/scratch-gui/src/lib/bw-makecode/project-json-snapshot.js';
const native=createRequire(import.meta.url)('../overlay/scratch-vm/src/extensions/crispstrobe/arcade/console-capture-provenance.js');
const code=`DEVICE ARCADE
GLOBAL out
SPRITE Game:
WHEN arcade source starts:
  arcade set local kept to (new array reference from ("[1,2]"))
  arcade register player (2) button "A" event (2049) as "later" capturing "kept"
WHEN arcade button handler "later" runs:
  set out to (length of array reference (arcade captured kept))
`;
function fixture(duplicate=false){const c=new Creator();c.parse(duplicate?code.replace('WHEN arcade button handler','  arcade register button "A" event (2049) as "later" capturing "kept"\nWHEN arcade button handler'):code);assert.deepEqual(c.warnings,[]);return c.project;}
test('new registration joins the same captured cell in GUI and native provenance without ambiguous token authority',()=>{
 for(const analyse of [analyseConsoleCaptures,native])for(const duplicate of [false,true]){
  const project=fixture(duplicate),target=project.targets.find(t=>!t.isStage),all=target.blocks;
  const input=(n,key,t)=>{const edge=n.inputs?.[key];return t.blocks[Array.isArray(edge)?edge[1]:edge?.block]};
  const proof=analyse({targets:project.targets,blocks:t=>t.blocks,input,literal:(n,key,t)=>n.fields?.[key]?.[0]??(Array.isArray(n.inputs?.[key]?.[1])?n.inputs[key][1][1]:input(n,key,t)?.fields?.TEXT?.[0])});
  const row=Object.values(all).find(n=>n.opcode==='arcade_getCaptured'),registration=Object.values(all).find(n=>n.opcode==='arcade_registerPlayerButtonHandler'),local=proof.local(proof.scopeOf(registration),'kept');assert.ok(local);
  assert.equal(proof.captured(proof.scopeOf(row),'kept'),duplicate?null:local);
 }
});
test('array export uses actual initialized new registration entry and retains duplicate-token refusal',()=>{
 for(const duplicate of [false,true]){const project=createProjectJsonSnapshot(JSON.stringify(fixture(duplicate))),target=project.targets.find(t=>!t.isStage),length=Object.values(target.blocks).find(n=>n.opcode==='arrays_referenceLength');assert.ok(length);assert.equal(createArrayReferenceExportAuthority(project).validateInput(target,length).ok,!duplicate);}
});
