import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {registerEditorMenuActions,notifyEditorMenuActions} from '../overlay/scratch-gui/src/lib/editor-menu-actions.js';
const source=(await readFile(new URL('../overlay/scratch-gui/src/lib/desktop-editor-menu.js',import.meta.url),'utf8')).replace(/from '\.\/([^']+)'/g,(_,p)=>`from '${new URL('../overlay/scratch-gui/src/lib/'+p+'.js',import.meta.url).href}'`);
const {desktopMenuSnapshot,runDesktopMenuAction,installDesktopEditorMenu}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('desktop menu invokes the visible editor provider and rejects stale or disabled commands',()=>{
 globalThis.document={querySelectorAll:()=>[]};let visible=true,calls=0;const off=registerEditorMenuActions('cad',()=>visible?{library:{label:'Model library',location:'file',enabled:true,run:()=>calls++},delete:{label:'Delete',location:'edit',enabled:false,run:()=>calls++}}:null);const owner={resolveAssetMenuSurface:()=>visible?'cad':'code'};
 try{assert.equal(desktopMenuSnapshot('cad').file[0].label,'Model library');assert.equal(runDesktopMenuAction('editor:cad:library',owner),true);assert.equal(calls,1);assert.equal(runDesktopMenuAction('editor:cad:delete',owner),false);visible=false;assert.equal(runDesktopMenuAction('editor:cad:library',owner),false);assert.equal(calls,1);}finally{off();delete globalThis.document;}
});
test('native menu refresh is deduplicated and listener disposal prevents late commands',async()=>{
 const snapshots=[],listeners=new Map();let saves=0;globalThis.document={querySelectorAll:()=>[]};globalThis.window={__TAURI__:{core:{invoke:async(_,value)=>snapshots.push(value.snapshot)},event:{listen:async(name,cb)=>{listeners.set(name,cb);return()=>listeners.delete(name);}}}};const owner={state:{nativeDocuments:true},resolveAssetMenuSurface:()=>null,_desktopSave:()=>saves++};
 try{const dispose=installDesktopEditorMenu(owner);await Promise.resolve();owner._refreshDesktopMenu();assert.equal(snapshots.length,1);listeners.get('bw-desktop-menu')({payload:'project:save'});assert.equal(saves,1);dispose();assert.equal(listeners.size,0);}finally{delete globalThis.document;delete globalThis.window;}
});
