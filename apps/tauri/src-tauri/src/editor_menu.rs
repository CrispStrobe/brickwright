// SPDX-License-Identifier: BSD-3-Clause
use serde::Deserialize;
use tauri::{menu::{Menu,MenuItem,SubmenuBuilder},Emitter,Manager};
#[derive(Deserialize)]
pub struct Item { name: Option<String>, id: Option<String>, label: String, enabled: bool }
#[derive(Deserialize)]
#[serde(rename_all="camelCase")]
pub struct Snapshot { can_undo:bool,can_redo:bool,surface: String, file: Vec<Item>, edit: Vec<Item>, tabs: Vec<Item> }
#[tauri::command]
pub fn update_editor_menu(window: tauri::WebviewWindow, snapshot: Snapshot) -> Result<(),String> {
    if window.label()!="main" {return Err("Editor menu belongs to the main window".into());}
    if snapshot.surface.len()>64 || snapshot.file.len()+snapshot.edit.len()+snapshot.tabs.len()>128 {return Err("Invalid editor menu".into());}
    build(window.app_handle(),snapshot).map_err(|error|error.to_string())
}
fn build(app:&tauri::AppHandle,s:Snapshot)->tauri::Result<()> {
    let menu=Menu::new(app)?;
    #[cfg(target_os="macos")]
    menu.append(&SubmenuBuilder::new(app,"Brickwright").about(None).separator().services().separator().hide().hide_others().show_all().separator().quit().build()?)?;
    let add=|parent:&tauri::menu::Submenu<tauri::Wry>,id:&str,label:&str,enabled:bool,key:Option<&str>|->tauri::Result<()> {
        parent.append(&MenuItem::with_id(app,id,label,enabled,key)?)
    };
    let file=SubmenuBuilder::new(app,"File").build()?;
    for(id,label,key)in[("project:new","New project…",Some("CmdOrCtrl+N")),("project:open","Open project…",Some("CmdOrCtrl+O")),("project:save","Save project",Some("CmdOrCtrl+S")),("project:save-as","Save project as…",Some("CmdOrCtrl+Shift+S")),("project:history","Project history…",None)]{add(&file,id,label,true,key)?;}
    for item in s.file {if let Some(name)=item.name {add(&file,&format!("editor:{}:{}",s.surface,name),&item.label,item.enabled,None)?;}}
    menu.append(&file)?;
    let edit=SubmenuBuilder::new(app,"Edit").build()?;
    // Shortcuts remain owned by the focused web editor; native entries invoke the same actions.
    add(&edit,"edit:undo","Undo",s.can_undo,None)?;add(&edit,"edit:redo","Redo",s.can_redo,None)?;
    edit.append(&tauri::menu::PredefinedMenuItem::separator(app)?)?;
    edit.append(&tauri::menu::PredefinedMenuItem::cut(app,None)?)?;edit.append(&tauri::menu::PredefinedMenuItem::copy(app,None)?)?;edit.append(&tauri::menu::PredefinedMenuItem::paste(app,None)?)?;edit.append(&tauri::menu::PredefinedMenuItem::select_all(app,None)?)?;
    menu.append(&edit)?;
    let tools=SubmenuBuilder::new(app,if s.surface=="cad"{"CAD"}else if s.surface.is_empty(){"Editor"}else{&s.surface}).build()?;
    for item in s.edit {if let Some(name)=item.name {add(&tools,&format!("editor:{}:{}",s.surface,name),&item.label,item.enabled,None)?;}}
    if !tools.items()?.is_empty(){menu.append(&tools)?;}
    let view=SubmenuBuilder::new(app,"Editors").build()?;
    for item in s.tabs {if let Some(id)=item.id {add(&view,&id,&item.label,item.enabled,None)?;}}
    menu.append(&view)?;
    menu.append(&SubmenuBuilder::new(app,"Window").minimize().maximize().close_window().build()?)?;
    app.set_menu(menu)?;Ok(())
}
pub fn install(app:&tauri::AppHandle) {
    app.on_menu_event(|app,event|{let id=event.id().as_ref();if id.starts_with("project:")||id.starts_with("editor:")||id.starts_with("edit:")||id.starts_with("tab:"){let _=app.emit_to("main","bw-desktop-menu",id);}});
}
