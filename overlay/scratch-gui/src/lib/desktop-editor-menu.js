// SPDX-License-Identifier: BSD-3-Clause
// The desktop menu uses the same providers and project saver as the ribbon.
import {getEditorMenuItems,runEditorMenuAction} from './editor-menu-actions';
import {undoActiveSurface,redoActiveSurface,getUndoState} from './global-undo';
export function desktopMenuSnapshot(surface) {
    const tabs=[...document.querySelectorAll('[data-bw-editor-tabs] [role="tab"]')];
    return {surface:surface||'',canUndo:getUndoState().canUndo,canRedo:getUndoState().canRedo,file:getEditorMenuItems(surface,'file'),edit:surface==='blocks'?[{name:'run',label:'Run project',enabled:true},{name:'stop',label:'Stop project',enabled:true}]:getEditorMenuItems(surface,'edit'),tabs:tabs.map((tab,index)=>({id:`tab:${index}`,label:tab.textContent.trim(),enabled:tab.getAttribute('aria-disabled')!=='true'}))};
}
export function runDesktopMenuAction(id,owner) {
    if(id==='project:new')return owner.handleClickNew();
    if(id==='project:open')return owner.handleNativeOpen();
    if(id==='project:save'||id==='project:save-as')return owner._desktopSave?.(id==='project:save'?'save':'saveAs');
    if(id==='project:history')return window.dispatchEvent(new CustomEvent('bw-open-history-panel'));
    if(id==='edit:undo')return undoActiveSurface();
    if(id==='edit:redo')return redoActiveSurface();
    if(id==='blocks:run')return owner.props.vm.greenFlag();
    if(id==='blocks:stop')return owner.props.vm.stopAll();
    if(id.startsWith('tab:'))return document.querySelectorAll('[data-bw-editor-tabs] [role="tab"]')[Number(id.slice(4))]?.click();
    if(id.startsWith('editor:')){const [,surface,name]=id.split(':');if(surface!==(owner.resolveAssetMenuSurface()||owner._activeEditorSurface))return false;if(surface==='blocks'&&name==='run')return owner.props.vm.greenFlag();if(surface==='blocks'&&name==='stop')return owner.props.vm.stopAll();return runEditorMenuAction(surface,name);}
    return false;
}
export function installDesktopEditorMenu(owner) {
    const tauri=window.__TAURI__;if(!tauri?.core?.invoke||!tauri?.event?.listen)return()=>{};
    let disposed=false,unlisten,last='';
    const refresh=()=>{
        if(disposed||!owner.state.nativeDocuments)return;
        const snapshot=desktopMenuSnapshot(owner.resolveAssetMenuSurface()||owner._activeEditorSurface),text=JSON.stringify(snapshot);if(text===last)return;last=text;
        tauri.core.invoke('update_editor_menu',{snapshot}).catch(error=>{last='';console.warn('Desktop menu update failed',error);});
    };
    tauri.event.listen('bw-desktop-menu',event=>{if(!disposed)Promise.resolve(runDesktopMenuAction(event.payload,owner)).catch(error=>console.warn('Desktop menu action failed',error));}).then(off=>{if(disposed)off();else unlisten=off;});
    owner._refreshDesktopMenu=refresh;refresh();
    return()=>{disposed=true;unlisten?.();owner._refreshDesktopMenu=null;};
}
