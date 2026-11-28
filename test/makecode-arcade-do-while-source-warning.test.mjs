import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator.js';
import {projectToArcade} from '../overlay/scratch-gui/src/lib/bw-makecode/export-arcade.js';
import {codeDocumentEditorClass, codeEditorMethod} from './helpers/code-document-editor.mjs';
test('the imported Code and warning receipt name the original SDK do-while boundary',()=>{
 const imported=arcadeToPseudocode('let count=0;do{count++;if(count>3)break;continue}while(false)');
 assert.deepEqual(imported.unsupported,[]);assert.equal(imported.warnings.length,1);assert.match(imported.warnings[0],/Selected Arcade SDK do-while continue skips its posttest/);assert.match(imported.code,/^# source warning: Selected Arcade SDK/m);
 const creator=new SB3Creator();creator.parse(imported.code);assert.deepEqual(creator.warnings,[]);const exported=projectToArcade(creator.project);assert.deepEqual(exported.unsupported,[]);assert.deepEqual(arcadeToPseudocode(exported.files).warnings,[],'normalized export has no original do-while continue');
});
test('only continue owned by the do-while receives a source warning',()=>{
 for(const source of ['do{for(let i=0;i<2;i++){continue}}while(false)','do{function f(){for(let i=0;i<2;i++){continue}}}while(false)','do{break}while(true)','for(let i=0;i<2;i++){continue}'])assert.deepEqual(arcadeToPseudocode(source).warnings,[],source);
});

test('actual GUI import consumer displays the named warning and the annotated Code',async()=>{
 const {readFileSync}=await import('node:fs');const {importProjectFiles}=await import('../overlay/scratch-gui/src/lib/bw-makecode/index.js');
 const source='let count=0;do{count++;if(count>3)break;continue}while(false)';
 const imported=importProjectFiles({'main.ts':source,'pxt.json':JSON.stringify({name:'Owned loop control',dependencies:{device:'*'},files:['main.ts']})},{target:'arcade'});
 const gui=readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx',import.meta.url),'utf8');
 const Editor=codeDocumentEditorClass(gui,codeEditorMethod(gui,'applyMakeCodeImport (res, label) {'),{LANG_LABEL:{pseudocode:'Code'}});
 let state;const host=Object.assign(new Editor(),{state:{lang:'pseudocode',buffers:{pseudocode:''}},publishGameControls(){},loadArcadeBoards(){},props:{vm:{runtime:{getTargetForStage:()=>({})}}},L:{mcArcade:()=> 'Imported Arcade',toBlocks:'To blocks'},setState(next){state=next;Object.assign(this.state,next);}});
 host.applyMakeCodeImport(imported,'owned-control.ts');assert.match(state.status,/Selected Arcade SDK do-while continue skips its posttest/);assert.match(state.buffers.pseudocode,/^# source warning:/m);
});

test('actual CLI import prints the named warning and writes annotated Code',async()=>{
 const fs=await import('node:fs');const path=await import('node:path');const os=await import('node:os');const {spawnSync}=await import('node:child_process');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'arcade-do-warning-'));
 try{
  const input=path.join(dir,'owned-control.ts'),code=path.join(dir,'owned-control.bw');fs.writeFileSync(input,'let count=0;do{count++;if(count>3)break;continue}while(false)');
  const result=spawnSync(process.execPath,['scripts/makecode.mjs','to-sb3',input,'--target','arcade','-o',path.join(dir,'owned-control.sb3'),'--bw',code],{cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:30000});
  assert.equal(result.status,0,result.stderr);assert.match(result.stderr,/note: Selected Arcade SDK do-while continue skips its posttest/);assert.match(fs.readFileSync(code,'utf8'),/^# source warning:/m);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
