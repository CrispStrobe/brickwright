//! Native project file I/O.
//!
//! * Export: `save_project` is the Save-As the web app calls in place of a browser download
//!   (sprites, costumes, sounds, archives), and `write_temp_project` feeds the share sheets.
//! * Project documents (desktop): Open, Save, Save As, Recent Projects. The OS picker is the
//!   only way a path enters the document state; the web layer never names a path it may
//!   write. Save writes back only to the document the user opened or saved, and refuses when
//!   that file changed on disk since (another device, another app) so it cannot be clobbered.
//! * File associations / "open with" / deep links read the file here and hand the bytes to the
//!   web VM as a `load-project` event (and keep them as `pending_project` for a cold launch,
//!   whose event fires before the webview listens).
//!
//! Every native dialog runs on a blocking worker, never on the thread that dispatches IPC:
//! synchronous commands run on the main thread, and the dialog plugin's `blocking_*` calls
//! must not (they wait for the event loop that thread is running).
//!
//! On iOS/Android the GUI keeps its web file input and share-sheet export; a document opened
//! there (association, share "open with") is a sandbox copy, so it is never written back.

use std::{
    io::Write,
    path::{Path, PathBuf},
    sync::{Mutex, MutexGuard},
};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_dialog::DialogExt;

/// Formats the editor opens. Only `.sb3` is ever written back in place: an opened `.sb2` or
/// `.lms` saves through Save As to a new `.sb3`.
const PROJECT_EXTENSIONS: [&str; 3] = ["sb3", "sb2", "lms"];
const MAX_RECENTS: usize = 8;
const MAX_BACKUPS: usize = 10;

/// True on iOS/Android. Lets the web layer pick the share sheet (mobile) vs the
/// native Save dialog (desktop) for exports.
#[tauri::command]
pub fn is_mobile() -> bool {
    cfg!(mobile)
}

/// Present the native macOS share picker for a prepared file. Other desktop
/// platforms return false so the web layer falls back to Save As.
#[tauri::command]
pub fn share_file_native(path: String) -> Result<bool, String> {
    let path = Path::new(&path);
    if !path.is_file() {
        return Err("share file does not exist".into());
    }
    #[cfg(target_os = "macos")]
    {
        use std::ffi::CString;
        extern "C" {
            fn brickwright_share_file(path: *const std::os::raw::c_char);
        }
        let value = CString::new(path.to_string_lossy().as_bytes()).map_err(|e| e.to_string())?;
        unsafe {
            brickwright_share_file(value.as_ptr());
        }
        return Ok(true);
    }
    #[cfg(not(target_os = "macos"))]
    Ok(false)
}

/// Write project bytes to a temp file in the app cache dir and return its path,
/// so the web layer can hand it to the OS share sheet (mobile share plugin).
#[tauri::command]
pub fn write_temp_project(
    app: AppHandle,
    filename: String,
    bytes: Vec<u8>,
) -> Result<String, String> {
    let dir = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    // Keep the extension; sanitise the stem so it can't escape the cache dir.
    let name = Path::new(&filename)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("project.sb3");
    let path = dir.join(name);
    std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

/// Show a native Save dialog defaulting to `filename` and write `bytes` there.
/// Returns Ok(true) if saved, Ok(false) if the user cancelled.
#[tauri::command]
pub async fn save_project(
    app: AppHandle,
    filename: String,
    bytes: Vec<u8>,
) -> Result<bool, String> {
    let ext = Path::new(&filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("sb3")
        .to_string();
    let picked = off_ipc_thread(move || {
        app.dialog()
            .file()
            .set_file_name(&filename)
            .add_filter("Scratch project", &[ext.as_str()])
            .blocking_save_file()
    })
    .await?;

    let Some(path) = picked else { return Ok(false) };
    let path = path.into_path().map_err(|e| e.to_string())?;
    std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;
    log::info!("[fileio] saved {} ({} bytes)", path.display(), bytes.len());
    Ok(true)
}


const FAT_EXPORT_LIMIT: u64 = 128 * 1024 * 1024;
const FAT_EXPORT_CHUNK_LIMIT: usize = 192 * 1024;

fn fat_export_dir(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    if id.len() != 32 || !id.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err("Invalid disk export ID.".into());
    }
    Ok(app
        .path()
        .app_cache_dir()
        .map_err(|error| error.to_string())?
        .join("fat-exports")
        .join(id))
}

#[tauri::command]
pub fn stage_fat_image_chunk(
    app: AppHandle,
    id: String,
    offset: u64,
    data: String,
) -> Result<(), String> {
    use base64::{engine::general_purpose::STANDARD, Engine};
    if data.len() > FAT_EXPORT_CHUNK_LIMIT / 3 * 4 {
        return Err("Disk export chunk is too large.".into());
    }
    let bytes = STANDARD.decode(data).map_err(|error| error.to_string())?;
    if bytes.is_empty() || offset > FAT_EXPORT_LIMIT - bytes.len() as u64 {
        return Err("Disk export exceeds its size limit.".into());
    }
    let dir = fat_export_dir(&app, &id)?;
    if offset == 0 {
        std::fs::create_dir_all(dir.parent().ok_or("Disk export has no cache directory.")?)
            .map_err(|error| error.to_string())?;
        std::fs::create_dir(&dir).map_err(|error| error.to_string())?;
    }
    let mut staged = std::fs::OpenOptions::new()
        .create_new(offset == 0)
        .append(true)
        .open(dir.join("pending"))
        .map_err(|error| error.to_string())?;
    if staged.metadata().map_err(|error| error.to_string())?.len() != offset {
        return Err("Disk export chunks arrived out of order.".into());
    }
    staged.write_all(&bytes).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn discard_fat_image_export(app: AppHandle, id: String) -> Result<(), String> {
    match std::fs::remove_dir_all(fat_export_dir(&app, &id)?) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

fn save_fat_image_copy(source: &Path, destination: &Path, id: &str) -> std::io::Result<()> {
    let temporary = destination.with_file_name(format!(".brickwright-fat-{id}.tmp"));
    let mut target = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary)?;
    let result = (|| {
        std::io::copy(&mut std::fs::File::open(source)?, &mut target)?;
        target.sync_all()?;
        drop(target);
        std::fs::rename(&temporary, destination)
    })();
    if result.is_err() {
        let _ = std::fs::remove_file(temporary);
    }
    result
}

#[tauri::command]
pub async fn finish_fat_image_export(
    app: AppHandle,
    id: String,
    filename: String,
    size: u64,
) -> Result<Option<String>, String> {
    let dir = fat_export_dir(&app, &id)?;
    let source = dir.join("pending");
    if size == 0
        || size > FAT_EXPORT_LIMIT
        || std::fs::metadata(&source)
            .map_err(|error| error.to_string())?
            .len()
            != size
    {
        return Err("Disk export is incomplete.".into());
    }
    let name = Path::new(&filename)
        .file_name()
        .and_then(|part| part.to_str())
        .filter(|part| part.ends_with(".img"))
        .unwrap_or("xkim-updated.img")
        .to_string();
    if cfg!(mobile) {
        let path = dir.join(name);
        std::fs::rename(source, &path).map_err(|error| error.to_string())?;
        return Ok(Some(path.to_string_lossy().into_owned()));
    }
    off_ipc_thread(move || {
        if let Some(chosen) = app
            .dialog()
            .file()
            .set_file_name(&name)
            .add_filter("Disk image", &["img"])
            .blocking_save_file()
        {
            let destination = chosen.into_path().map_err(|error| error.to_string())?;
            save_fat_image_copy(&source, &destination, &id).map_err(|error| error.to_string())?;
        }
        std::fs::remove_dir_all(dir).map_err(|error| error.to_string())?;
        Ok(None)
    })
    .await?
}

/// Run a blocking native dialog (and the file I/O around it) on a blocking worker.
async fn off_ipc_thread<T: Send + 'static>(
    work: impl FnOnce() -> T + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------------------------
// Project documents
// ---------------------------------------------------------------------------------------------

#[derive(Clone, Debug)]
struct Document {
    path: PathBuf,
    /// SHA-256 of the bytes this app last read from or wrote to `path`.
    digest: String,
    /// Save may write back to `path` (desktop `.sb3` only).
    writable: bool,
}

/// The open document, the one being loaded (not yet accepted by the VM), and a cold-launch
/// association waiting for the web layer.
#[derive(Default)]
pub struct Documents {
    current: Mutex<Option<Document>>,
    candidate: Mutex<Option<Document>>,
    pending: Mutex<Option<LoadPayload>>,
    /// Serialises saves, so two Save requests cannot interleave their conflict check and write.
    saving: Mutex<()>,
}

#[derive(Clone, Serialize)]
pub struct LoadPayload {
    name: String,
    bytes: Vec<u8>,
    path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveResult {
    saved: bool,
    conflict: bool,
    name: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct RecentDocument {
    name: String,
    path: String,
}

fn lock<T>(mutex: &Mutex<T>) -> Result<MutexGuard<'_, T>, String> {
    mutex.lock().map_err(|e| e.to_string())
}

fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn display_name(path: &Path) -> String {
    path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("project.sb3")
        .to_string()
}

/// The lower-case project extension of `path`, if it is one the editor opens.
fn project_extension(path: &Path) -> Option<&'static str> {
    let ext = path.extension()?.to_str()?.to_ascii_lowercase();
    PROJECT_EXTENSIONS.iter().copied().find(|known| *known == ext)
}

/// A path the user picked in a Save dialog, with `.sb3` appended when they typed none.
fn with_sb3_extension(path: PathBuf) -> PathBuf {
    if project_extension(&path) == Some("sb3") {
        return path;
    }
    let mut name = path.file_name().unwrap_or_default().to_os_string();
    name.push(".sb3");
    path.with_file_name(name)
}

/// True when `path` still holds exactly the bytes this app last saw there.
fn unchanged_on_disk(path: &Path, expected_digest: &str) -> bool {
    std::fs::read(path).is_ok_and(|bytes| digest(&bytes) == expected_digest)
}

fn stamp() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

/// Keep the bytes being replaced in private app storage (the newest `MAX_BACKUPS`).
fn back_up(backups: &Path, previous: &[u8]) -> std::io::Result<()> {
    std::fs::create_dir_all(backups)?;
    let name = format!("{}-{}.sb3", stamp(), &digest(previous)[..12]);
    std::fs::write(backups.join(name), previous)?;
    let mut files: Vec<_> = std::fs::read_dir(backups)?
        .flatten()
        .filter(|entry| entry.path().extension().is_some_and(|e| e == "sb3"))
        .filter_map(|entry| Some((entry.metadata().ok()?.modified().ok()?, entry.path())))
        .collect();
    files.sort();
    let excess = files.len().saturating_sub(MAX_BACKUPS);
    for (_, old) in files.into_iter().take(excess) {
        let _ = std::fs::remove_file(old);
    }
    Ok(())
}

/// Replace `path` with `bytes`: back up what is there, write a sibling temporary file and
/// rename it over the target, so a failed write never leaves a half-written project. A
/// symlink is written through (renaming over it would replace the link itself), and where the
/// platform refuses the rename the backup above is what protects the old bytes.
fn write_document(path: &Path, bytes: &[u8], backups: &Path) -> Result<(), String> {
    if let Ok(previous) = std::fs::read(path) {
        back_up(backups, &previous).map_err(|e| format!("could not back up the old file: {e}"))?;
    }
    if !path.is_symlink() {
        let mut temporary = path.as_os_str().to_os_string();
        temporary.push(format!(".{}.tmp", stamp()));
        let temporary = PathBuf::from(temporary);
        let written = std::fs::File::create(&temporary)
            .and_then(|mut file| file.write_all(bytes).and_then(|_| file.sync_all()));
        match written.and_then(|_| std::fs::rename(&temporary, path)) {
            Ok(()) => return Ok(()),
            Err(_) => {
                let _ = std::fs::remove_file(&temporary);
            }
        }
    }
    let mut file = std::fs::File::create(path).map_err(|e| e.to_string())?;
    file.write_all(bytes)
        .and_then(|_| file.sync_all())
        .map_err(|e| e.to_string())
}

/// Most recent first, unique, at most `MAX_RECENTS`, and only files that still exist.
fn remembered(mut recents: Vec<RecentDocument>, path: &Path) -> Vec<RecentDocument> {
    let entry = RecentDocument {
        name: display_name(path),
        path: path.display().to_string(),
    };
    recents.retain(|recent| recent.path != entry.path);
    recents.insert(0, entry);
    recents.truncate(MAX_RECENTS);
    recents
}

fn existing(recents: Vec<RecentDocument>) -> Vec<RecentDocument> {
    recents
        .into_iter()
        .filter(|recent| Path::new(&recent.path).is_file())
        .collect()
}

fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|e| e.to_string())
}

fn recents_file(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(data_dir(app)?.join("recent-projects.json"))
}

fn read_recents(app: &AppHandle) -> Vec<RecentDocument> {
    let stored = recents_file(app)
        .ok()
        .and_then(|file| std::fs::read(file).ok())
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default();
    existing(stored)
}

/// Desktop only: a mobile path is a sandbox copy that means nothing after relaunch.
fn remember(app: &AppHandle, path: &Path) {
    if cfg!(mobile) {
        return;
    }
    let recents = remembered(read_recents(app), path);
    if let (Ok(file), Ok(json)) = (recents_file(app), serde_json::to_vec(&recents)) {
        if let Some(dir) = file.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        let _ = std::fs::write(file, json);
    }
}

/// Read a project and make it the load candidate. It becomes the open document only when the
/// web layer reports the VM accepted it (`activate_project_document`).
fn read_document(app: &AppHandle, path: PathBuf) -> Result<LoadPayload, String> {
    let extension = project_extension(&path).ok_or("Choose a .sb3, .sb2 or .lms project")?;
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let payload = LoadPayload {
        name: display_name(&path),
        path: path.display().to_string(),
        bytes,
    };
    *lock(&app.state::<Documents>().candidate)? = Some(Document {
        digest: digest(&payload.bytes),
        writable: extension == "sb3" && !cfg!(mobile),
        path,
    });
    Ok(payload)
}

/// File > Load from your computer (desktop): the native Open dialog.
#[tauri::command]
pub async fn open_project_document(app: AppHandle) -> Result<Option<LoadPayload>, String> {
    let picker = app.clone();
    let picked = off_ipc_thread(move || {
        picker
            .dialog()
            .file()
            .add_filter("Project", &PROJECT_EXTENSIONS)
            .blocking_pick_file()
    })
    .await?;
    let Some(picked) = picked else { return Ok(None) };
    let path = picked.into_path().map_err(|e| e.to_string())?;
    read_document(&app, path).map(Some)
}

/// Reopen an entry of Recent Projects. Only a path already in that list is accepted, so the
/// web layer cannot use this to read an arbitrary file.
#[tauri::command]
pub fn open_recent_project(app: AppHandle, path: String) -> Result<LoadPayload, String> {
    if !read_recents(&app).iter().any(|recent| recent.path == path) {
        return Err("This project is not in Recent Projects".into());
    }
    read_document(&app, PathBuf::from(path))
}

#[tauri::command]
pub fn recent_projects(app: AppHandle) -> Vec<RecentDocument> {
    read_recents(&app)
}

/// The association a cold launch received before the web layer was listening.
#[tauri::command]
pub fn pending_project(app: AppHandle) -> Result<Option<LoadPayload>, String> {
    Ok(lock(&app.state::<Documents>().pending)?.take())
}

/// Something other than a native open replaced the project (New, an example, an importer, the
/// web file input): Save must no longer write to the old file.
#[tauri::command]
pub fn clear_project_document(app: AppHandle) -> Result<(), String> {
    let documents = app.state::<Documents>();
    *lock(&documents.current)? = None;
    *lock(&documents.candidate)? = None;
    *lock(&documents.pending)? = None;
    Ok(())
}

/// The VM accepted the candidate read from `path`: it is now the open document.
#[tauri::command]
pub fn activate_project_document(app: AppHandle, path: String) -> Result<(), String> {
    let documents = app.state::<Documents>();
    let candidate = lock(&documents.candidate)?.take();
    let Some(candidate) = candidate else {
        return Err("No opened project to activate".into());
    };
    if candidate.path.display().to_string() != path {
        return Err("The opened project changed while it was loading".into());
    }
    *lock(&documents.pending)? = None;
    remember(&app, &candidate.path);
    *lock(&documents.current)? = Some(candidate);
    Ok(())
}

/// The VM refused the candidate, or the user kept the current project.
#[tauri::command]
pub fn discard_open_project(app: AppHandle) -> Result<(), String> {
    let documents = app.state::<Documents>();
    *lock(&documents.candidate)? = None;
    *lock(&documents.pending)? = None;
    Ok(())
}

/// `mode`: `save` writes back to the open document (or asks where, when there is none or it
/// cannot be written back); `saveAs` always asks and makes the result the open document;
/// `copy` always asks and leaves the open document as it is.
#[tauri::command]
pub async fn save_project_document(
    app: AppHandle,
    filename: String,
    bytes: Vec<u8>,
    mode: String,
) -> Result<SaveResult, String> {
    if !matches!(mode.as_str(), "save" | "saveAs" | "copy") {
        return Err(format!("unknown save mode {mode}"));
    }
    if project_extension(Path::new(&filename)) != Some("sb3") {
        return Err("A project is saved as .sb3".into());
    }
    let backups = data_dir(&app)?.join("project-versions");
    off_ipc_thread(move || {
        let documents = app.state::<Documents>();
        let _saving = lock(&documents.saving)?;
        let current = lock(&documents.current)?.clone();
        let in_place = if mode == "save" {
            current.clone().filter(|document| document.writable)
        } else {
            None
        };
        let path = match &in_place {
            Some(document) => {
                if !unchanged_on_disk(&document.path, &document.digest) {
                    return Ok(SaveResult {
                        saved: false,
                        conflict: true,
                        name: Some(display_name(&document.path)),
                    });
                }
                document.path.clone()
            }
            None => {
                let picked = app
                    .dialog()
                    .file()
                    .set_file_name(&filename)
                    .add_filter("Scratch project", &["sb3"])
                    .blocking_save_file();
                let Some(picked) = picked else {
                    return Ok(SaveResult {
                        saved: false,
                        conflict: false,
                        name: None,
                    });
                };
                with_sb3_extension(picked.into_path().map_err(|e| e.to_string())?)
            }
        };
        if mode == "copy" && current.as_ref().is_some_and(|document| document.path == path) {
            return Err("Choose a different name or folder for the copy".into());
        }
        write_document(&path, &bytes, &backups)?;
        log::info!("[fileio] saved project {} ({} bytes)", path.display(), bytes.len());
        if mode != "copy" {
            remember(&app, &path);
            *lock(&documents.current)? = Some(Document {
                path: path.clone(),
                digest: digest(&bytes),
                writable: !cfg!(mobile),
            });
        }
        Ok(SaveResult {
            saved: true,
            conflict: false,
            name: Some(display_name(&path)),
        })
    })
    .await?
}

/// Read a project at `path` and emit it to the web VM as `load-project` (file association,
/// share "open with", deep link, or a desktop launch argument). It is also kept as the
/// pending project until the web layer takes it, because a cold launch emits before the
/// webview listens.
pub fn emit_load_project(app: &AppHandle, path: &Path) {
    match read_document(app, path.to_path_buf()) {
        Ok(payload) => {
            log::info!("[fileio] opening {} ({} bytes)", payload.name, payload.bytes.len());
            if let Ok(mut pending) = lock(&app.state::<Documents>().pending) {
                *pending = Some(payload.clone());
            }
            let _ = app.emit("load-project", payload);
        }
        Err(e) => log::warn!("[fileio] failed to open {}: {e}", path.display()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch_dir(label: &str) -> PathBuf {
        let mut random = [0u8; 8];
        getrandom::getrandom(&mut random).unwrap();
        let dir = std::env::temp_dir().join(format!("bw-fileio-{label}-{:x?}", random));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn only_project_formats_open_and_only_sb3_is_named_for_saving() {
        assert_eq!(project_extension(Path::new("a/b.SB3")), Some("sb3"));
        assert_eq!(project_extension(Path::new("b.sb2")), Some("sb2"));
        assert_eq!(project_extension(Path::new("b.lms")), Some("lms"));
        assert_eq!(project_extension(Path::new("b.txt")), None);
        assert_eq!(project_extension(Path::new("sb3")), None);
        assert_eq!(with_sb3_extension(PathBuf::from("/x/game")), PathBuf::from("/x/game.sb3"));
        assert_eq!(with_sb3_extension(PathBuf::from("/x/game.lms")), PathBuf::from("/x/game.lms.sb3"));
        assert_eq!(with_sb3_extension(PathBuf::from("/x/game.SB3")), PathBuf::from("/x/game.SB3"));
    }

    #[test]
    fn a_save_backs_up_the_replaced_bytes_and_leaves_no_temporary_file() {
        let dir = scratch_dir("write");
        let backups = dir.join("versions");
        let path = dir.join("game.sb3");
        write_document(&path, b"first", &backups).unwrap();
        assert!(!backups.exists(), "a new file has nothing to back up");
        write_document(&path, b"second", &backups).unwrap();
        assert_eq!(std::fs::read(&path).unwrap(), b"second");
        let kept: Vec<_> = std::fs::read_dir(&backups).unwrap().flatten().collect();
        assert_eq!(kept.len(), 1);
        assert_eq!(std::fs::read(kept[0].path()).unwrap(), b"first");
        let stray: Vec<_> = std::fs::read_dir(&dir)
            .unwrap()
            .flatten()
            .filter(|entry| entry.file_name().to_string_lossy().ends_with(".tmp"))
            .collect();
        assert!(stray.is_empty(), "temporary file left behind: {stray:?}");
        for round in 0..(MAX_BACKUPS + 3) {
            write_document(&path, format!("round {round}").as_bytes(), &backups).unwrap();
        }
        assert_eq!(std::fs::read_dir(&backups).unwrap().count(), MAX_BACKUPS);
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn fat_image_copy_replaces_only_after_a_complete_write() {
        let dir = scratch_dir("fat-copy");
        let source = dir.join("staged");
        let destination = dir.join("saved.img");
        std::fs::write(&destination, b"old disk").unwrap();
        assert!(save_fat_image_copy(&source, &destination, "test").is_err());
        assert_eq!(std::fs::read(&destination).unwrap(), b"old disk");
        assert!(!dir.join(".brickwright-fat-test.tmp").exists());
        std::fs::write(&source, [0, 5, 128, 255]).unwrap();
        save_fat_image_copy(&source, &destination, "test").unwrap();
        assert_eq!(std::fs::read(&destination).unwrap(), [0, 5, 128, 255]);
        assert_eq!(std::fs::read(&source).unwrap(), [0, 5, 128, 255]);
        assert!(!dir.join(".brickwright-fat-test.tmp").exists());
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn a_file_changed_or_removed_on_disk_is_a_conflict() {
        let dir = scratch_dir("conflict");
        let path = dir.join("game.sb3");
        std::fs::write(&path, b"opened").unwrap();
        let seen = digest(b"opened");
        assert!(unchanged_on_disk(&path, &seen));
        std::fs::write(&path, b"edited elsewhere").unwrap();
        assert!(!unchanged_on_disk(&path, &seen));
        std::fs::remove_file(&path).unwrap();
        assert!(!unchanged_on_disk(&path, &seen));
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn recents_are_unique_newest_first_bounded_and_existing() {
        let dir = scratch_dir("recents");
        let mut recents = Vec::new();
        for index in 0..(MAX_RECENTS + 2) {
            let path = dir.join(format!("p{index}.sb3"));
            std::fs::write(&path, b"x").unwrap();
            recents = remembered(recents, &path);
        }
        recents = remembered(recents, &dir.join("p3.sb3"));
        assert_eq!(recents.len(), MAX_RECENTS);
        assert_eq!(recents[0].name, "p3.sb3");
        assert_eq!(recents.iter().filter(|r| r.name == "p3.sb3").count(), 1);
        std::fs::remove_file(dir.join("p3.sb3")).unwrap();
        let shown = existing(recents);
        assert_eq!(shown.len(), MAX_RECENTS - 1);
        assert!(shown.iter().all(|r| r.name != "p3.sb3"));
        std::fs::remove_dir_all(dir).unwrap();
    }
}
