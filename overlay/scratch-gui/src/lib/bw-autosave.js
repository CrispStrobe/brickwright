// Whole-project autosave with a version list, like Tinkercad's.
//
// WHAT: the same archive File > Save writes (blocks, costumes, sounds, plus the
// Code / Circuit / Widgets / Robot Lab state and editable artwork that ride in
// it, lib/bw-project-bundle.js), so restoring a version restores every editor.
//
// WHEN: at most once per interval while something changed (the project's
// changed flag or any editor's history), and when the page is hidden. An
// archive identical to the newest version is not stored again.
//
// WHERE (Settings > Autosave & history…):
//   - always: this browser's IndexedDB, newest `keep` versions;
//   - optionally a folder: the desktop app writes into a folder chosen in a
//     native dialog (the Rust side owns the path, apps/tauri/src-tauri/src/
//     fileio.rs); Chromium browsers can use a folder picked with the File
//     System Access API. Folder failures never stop the browser copy.

import {attachBrickwrightState} from './bw-project-bundle.js';
import {writeArtworkToZip} from './bw-artwork-bundle.js';
import {subscribeUndoState} from './global-undo.js';

const SETTINGS_KEY = 'bw-autosave-settings';
// Set while the project has unsaved changes, cleared when it is saved or
// replaced: still set at the next start means the last session ended unsaved
// (a crash, a killed app, a closed tab), and its autosave is offered back.
const UNCLEAN_KEY = 'bw-autosave-unclean';
const RECOVERY_WINDOW_MS = 24 * 60 * 60 * 1000;
let previousUnclean = null;
const DB_NAME = 'bw-autosave';
const DEFAULTS = Object.freeze({enabled: true, intervalSec: 60, keep: 30});
const MIN_INTERVAL = 15;
const MAX_KEEP = 200;

const listeners = new Set();
let status = {lastSavedAt: 0, lastError: '', saving: false, folder: null, folderError: ''};
let dirty = false;
let timer = null;
let vmRef = null;
let storeRef = null;
let lastDigest = '';

const nativeInvoke = () => {
    const tauri = typeof window !== 'undefined' && window.__TAURI__;
    return tauri && tauri.core && typeof tauri.core.invoke === 'function' ? tauri.core.invoke : null;
};

export const isAndroidApp = () => !!nativeInvoke() && typeof navigator !== 'undefined' &&
    /Android/i.test(navigator.userAgent);

export const readSettings = () => {
    try {
        const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
        return {
            enabled: saved.enabled !== false,
            intervalSec: Math.max(MIN_INTERVAL, Number(saved.intervalSec) || DEFAULTS.intervalSec),
            keep: Math.min(MAX_KEEP, Math.max(1, Number(saved.keep) || DEFAULTS.keep))
        };
    } catch (e) {
        return {...DEFAULTS};
    }
};

const emit = () => {
    const snapshot = {...status, settings: readSettings()};
    for (const listener of listeners) {
        try {
            listener(snapshot);
        } catch (e) { /* a broken listener must not stop autosave */ }
    }
};

export const subscribeAutosave = listener => {
    listeners.add(listener);
    listener({...status, settings: readSettings()});
    return () => listeners.delete(listener);
};

export const writeSettings = changes => {
    const next = {...readSettings(), ...changes};
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch (e) { /* private mode: the defaults keep working */ }
    schedule();
    emit();
    return next;
};

// ---- IndexedDB ----
let dbPromise = null;
const openDb = () => {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB is unavailable'));
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains('versions')) {
                    db.createObjectStore('versions', {keyPath: 'id', autoIncrement: true});
                }
                if (!db.objectStoreNames.contains('handles')) db.createObjectStore('handles');
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        dbPromise.catch(() => {
            dbPromise = null;
        });
    }
    return dbPromise;
};

const tx = async (storeName, mode, work) => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const result = work(transaction.objectStore(storeName));
        transaction.oncomplete = () => resolve(result && 'result' in result ? result.result : result);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || new Error('Autosave storage aborted'));
    });
};

/**
 * @returns {Promise<Array<{id: number, at: number, title: string, size: number}>>} newest first
 */
export const listVersions = async () => {
    const all = await tx('versions', 'readonly', store => store.getAll());
    return (all || []).map(({id, at, title, size, reason}) => ({id, at, title, size, reason}))
        .sort((a, b) => b.at - a.at);
};

const prune = async keep => {
    const versions = await listVersions();
    const doomed = versions.slice(keep).map(version => version.id);
    if (doomed.length) await tx('versions', 'readwrite', store => doomed.forEach(id => store.delete(id)));
};

// ---- folder targets ----
const folderLabel = async () => {
    // An older Android build may have enabled an app-private folder. Keep the
    // accessible in-app versions, but stop writing that invisible extra copy.
    if (isAndroidApp()) return null;
    const invoke = nativeInvoke();
    if (invoke) {
        const folder = await Promise.resolve(invoke('autosave_folder')).catch(() => null);
        return folder ? {kind: 'native', name: folder} : null;
    }
    const handle = await tx('handles', 'readonly', store => store.get('folder')).catch(() => null);
    return handle ? {kind: 'browser', name: handle.name, handle} : null;
};

export const folderPickerAvailable = () => !isAndroidApp() && (!!nativeInvoke() ||
    (typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'));

/**
 * The app on a phone or tablet has no folder picker: "choosing" turns on its own
 * Autosave folder (on iPad/iPhone visible in the Files app), so there is nothing to change.
 * @returns {boolean} true in the native app on a touch device
 */
export const fixedFolder = () => !isAndroidApp() && !!nativeInvoke() && typeof navigator !== 'undefined' &&
    navigator.maxTouchPoints > 1 && /iPad|iPhone|Macintosh/.test(navigator.userAgent);

/**
 * Choose the autosave folder (native dialog in the app, directory picker in Chromium).
 * @returns {Promise<?string>} the folder's name, or null when cancelled
 */
export const chooseFolder = async () => {
    if (isAndroidApp()) throw new Error('Android autosaves stay inside the app; download a saved version to keep a file.');
    const invoke = nativeInvoke();
    if (invoke) {
        const folder = await invoke('choose_autosave_folder');
        await refreshFolder();
        return folder || null;
    }
    if (typeof window.showDirectoryPicker !== 'function') throw new Error('This browser cannot save into a folder');
    const handle = await window.showDirectoryPicker({id: 'bw-autosave', mode: 'readwrite'});
    await tx('handles', 'readwrite', store => store.put(handle, 'folder'));
    await refreshFolder();
    return handle.name;
};

export const clearFolder = async () => {
    const invoke = nativeInvoke();
    if (invoke) await invoke('clear_autosave_folder');
    else await tx('handles', 'readwrite', store => store.delete('folder'));
    await refreshFolder();
};

const refreshFolder = async () => {
    const folder = await folderLabel().catch(() => null);
    status = {...status, folder: folder ? {kind: folder.kind, name: folder.name} : null, folderError: ''};
    emit();
    return folder;
};

const safeName = title => (String(title || 'Project').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_')
    .trim()
    .slice(0, 60) || 'Project');
const stamp = date => date.toISOString().replace(/[:]/g, '-')
    .replace(/\..*$/, '');

const writeFolder = async (blob, title, keep) => {
    const folder = await folderLabel();
    if (!folder) return;
    const filename = `${safeName(title)} autosave ${stamp(new Date())}.sb3`;
    if (folder.kind === 'native') {
        const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
        await nativeInvoke()('write_autosave', {filename, bytes, keep});
        return;
    }
    const handle = folder.handle;
    if (handle.queryPermission && (await handle.queryPermission({mode: 'readwrite'})) !== 'granted') {
        throw new Error(`Allow access to the folder "${handle.name}" again in Settings > Autosave & history`);
    }
    const file = await handle.getFileHandle(filename, {create: true});
    const writable = await file.createWritable();
    await writable.write(blob);
    await writable.close();
    const prefix = `${safeName(title)} autosave `;
    const names = [];
    for await (const [name, entry] of handle.entries()) {
        if (entry.kind === 'file' && name.startsWith(prefix) && name.endsWith('.sb3')) names.push(name);
    }
    names.sort().reverse();
    for (const name of names.slice(keep)) await handle.removeEntry(name).catch(() => {});
};

/** Ask the browser again for a remembered folder (needs a click). */
export const regrantFolder = async () => {
    const folder = await folderLabel();
    if (folder && folder.handle && folder.handle.requestPermission) {
        await folder.handle.requestPermission({mode: 'readwrite'});
    }
    return refreshFolder();
};

// ---- saving ----
const digestOf = async blob => {
    const buffer = await blob.arrayBuffer();
    if (typeof crypto !== 'undefined' && crypto.subtle) {
        const hash = await crypto.subtle.digest('SHA-256', buffer);
        return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
    }
    return String(buffer.byteLength);
};

const projectTitle = () => {
    try {
        return storeRef.getState().scratchGui.projectTitle || 'Project';
    } catch (e) {
        return 'Project';
    }
};

/**
 * Save a version now.
 * @param {string} [reason] shown in the version list ('auto', 'manual', 'hidden', 'before-restore')
 * @returns {Promise<boolean>} whether a new version was stored
 */
export const saveNow = async (reason = 'manual') => {
    if (!vmRef || status.saving) return false;
    const project = vmRef.runtime?.getTargetForStage?.();
    const settings = readSettings();
    status = {...status, saving: true};
    emit();
    try {
        let blob = await vmRef.saveProjectSb3();
        blob = await attachBrickwrightState(blob, {project,
            mutateZip: zip => writeArtworkToZip(zip, vmRef)});
        const digest = await digestOf(blob);
        dirty = false;
        if (digest === lastDigest && reason !== 'manual') {
            status = {...status, saving: false, lastError: ''};
            emit();
            return false;
        }
        const title = projectTitle();
        await tx('versions', 'readwrite', store => store.add({at: Date.now(), title, size: blob.size, reason, blob}));
        lastDigest = digest;
        await prune(settings.keep);
        let folderError = '';
        try {
            await writeFolder(blob, title, settings.keep);
        } catch (error) {
            folderError = String(error && error.message || error);
        }
        status = {...status, saving: false, lastSavedAt: Date.now(), lastError: '', folderError};
        emit();
        return true;
    } catch (error) {
        status = {...status, saving: false, lastError: String(error && error.message || error)};
        emit();
        return false;
    }
};

/**
 * Replace the current project with a stored version. The current state is
 * saved as a version first, so a restore can itself be undone.
 * @param {number} id version id
 * @returns {Promise<void>}
 */
export const restoreVersion = async id => {
    const record = await tx('versions', 'readonly', store => store.get(id));
    if (!record || !record.blob) throw new Error('That autosave is no longer stored');
    if (dirty || (storeRef && storeRef.getState().scratchGui.projectChanged)) await saveNow('before-restore');
    // The shared loader (every way a project arrives uses it), fetched when needed.
    const {default: loadProjectFile} = await import('./bw-project-load.js');
    await loadProjectFile(vmRef, await record.blob.arrayBuffer(), `${safeName(record.title)}.sb3`);
    lastDigest = '';
};

/**
 * @param {number} id version id
 * @returns {Promise<?{blob: Blob, title: string}>} the stored archive
 */
export const readVersion = async id => {
    const record = await tx('versions', 'readonly', store => store.get(id));
    return record ? {blob: record.blob, title: record.title, at: record.at} : null;
};

export const deleteVersion = id => tx('versions', 'readwrite', store => store.delete(id)).then(emit);

function schedule () {
    if (timer) clearTimeout(timer);
    timer = null;
    const settings = readSettings();
    if (!settings.enabled || !vmRef) return;
    timer = setTimeout(() => {
        timer = null;
        const changed = dirty || (storeRef && storeRef.getState().scratchGui.projectChanged);
        const next = changed ? saveNow('auto') : Promise.resolve();
        next.finally(schedule);
    }, settings.intervalSec * 1000);
}

/**
 * Start autosave for this VM and Redux store (once).
 * @param {object} vm the scratch-vm instance
 * @param {object} store the GUI's Redux store
 * @returns {void}
 */
export const startAutosave = (vm, store) => {
    if (vmRef) return;
    vmRef = vm;
    storeRef = store;
    try {
        previousUnclean = Number(localStorage.getItem(UNCLEAN_KEY)) || null;
        localStorage.removeItem(UNCLEAN_KEY);
    } catch (e) { /* no storage: no recovery offer */ }
    let lastProjectChanged = false;
    store.subscribe(() => {
        const changed = store.getState().scratchGui.projectChanged;
        if (changed && !lastProjectChanged) dirty = true;
        if (changed !== lastProjectChanged) {
            try {
                if (changed) localStorage.setItem(UNCLEAN_KEY, String(Date.now()));
                else localStorage.removeItem(UNCLEAN_KEY);
            } catch (e) { /* private mode */ }
        }
        lastProjectChanged = changed;
    });
    // Editors that never set the project's changed flag (Code, Circuit, Widgets)
    // still announce their history; any new step there is a change.
    let last = null;
    subscribeUndoState(state => {
        const signature = `${state.undoDepth}:${state.redoDepth}:${state.project.past.length}`;
        if (last && last.surface === state.surface && last.signature !== signature) dirty = true;
        last = {surface: state.surface, signature};
    });
    if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden' && dirty && readSettings().enabled) saveNow('hidden');
        });
    }
    refreshFolder();
    schedule();
};

/**
 * The autosave to offer when the previous session ended with unsaved changes.
 * @returns {Promise<?{id: number, at: number, title: string}>} null when there is nothing to recover
 */
export const recoveryCandidate = async () => {
    if (!previousUnclean) return null;
    const [latest] = await listVersions().catch(() => []);
    if (!latest || latest.reason === 'before-restore' || Math.abs(latest.at - previousUnclean) > RECOVERY_WINDOW_MS) return null;
    return {id: latest.id, at: latest.at, title: latest.title};
};
