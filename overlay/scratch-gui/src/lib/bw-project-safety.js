// Project safety net, loaded after the first paint (render-gui.jsx) so none of
// it counts against the startup budget:
//   - project-structure undo/redo (lib/bw-project-history.js),
//   - whole-project autosave (lib/bw-autosave.js),
//   - the History & autosave panel (menu bar, Settings),
//   - a visible note when an editor's error boundary stopped it.

import {instrumentProjectHistory} from './bw-project-history.js';
import {recoveryCandidate, restoreVersion, readVersion, startAutosave} from './bw-autosave.js';
import download from './download-blob.js';
import {getUndoState, redoActiveSurface, undoActiveSurface} from './global-undo.js';

const waitFor = (read, tries = 150) => new Promise((resolve, reject) => {
    const check = n => {
        const value = read();
        if (value) return resolve(value);
        if (n <= 0) return reject(new Error('Brickwright editor did not start'));
        return setTimeout(() => check(n - 1), 200);
    };
    check(tries);
});

let panelHost = null;
const openPanel = view => import(/* webpackChunkName: "bw-history-panel" */
    '../components/bw-history-panel/history-panel.jsx').then(module => {
    if (!panelHost) {
        panelHost = document.createElement('div');
        panelHost.setAttribute('data-bw-history-host', '');
        document.body.appendChild(panelHost);
    }
    module.renderHistoryPanel(panelHost, view);
});

// ---- error notes ----
const NOTE_LIMIT = 3;
const shown = new Map();
const note = (title, message) => {
    if (typeof document === 'undefined') return;
    const key = `${title}:${message}`;
    if (shown.has(key)) return;
    let stack = document.querySelector('[data-bw-error-notes]');
    if (!stack) {
        stack = document.createElement('div');
        stack.setAttribute('data-bw-error-notes', '');
        Object.assign(stack.style, {position: 'fixed', right: '12px', bottom: '12px', zIndex: 2147483000,
            display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: 'min(420px, calc(100vw - 24px))'});
        document.body.appendChild(stack);
    }
    while (stack.children.length >= NOTE_LIMIT) stack.removeChild(stack.firstChild);
    const item = document.createElement('div');
    item.setAttribute('role', 'alert');
    item.setAttribute('data-testid', 'bw-error-note');
    Object.assign(item.style, {background: '#fef2f2', color: '#7f1d1d', border: '1px solid #fca5a5',
        borderRadius: '8px', padding: '10px 32px 10px 12px', font: '13px system-ui, sans-serif',
        boxShadow: '0 4px 14px rgba(0,0,0,.15)', position: 'relative', wordBreak: 'break-word'});
    const strong = document.createElement('strong');
    strong.textContent = title;
    const text = document.createElement('div');
    text.textContent = String(message).slice(0, 300);
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Dismiss');
    Object.assign(close.style, {position: 'absolute', top: '4px', right: '6px', border: 0, background: 'none',
        fontSize: '18px', cursor: 'pointer', color: 'inherit'});
    const dismiss = () => {
        item.remove();
        shown.delete(key);
    };
    close.onclick = dismiss;
    item.append(close, strong, text);
    stack.appendChild(item);
    shown.set(key, item);
    setTimeout(dismiss, 12000);
};

// Uncaught errors elsewhere already raise the page's crash banner
// (playground/index.ejs); this note is for an editor that a boundary stopped,
// which otherwise only shows its notice inside its own (maybe hidden) tab.
const describe = reason => (reason && (reason.message || reason.reason)) || String(reason || 'Unknown error');

const installErrorNotes = () => {
    window.addEventListener('bw-editor-error', event => {
        const {name, message} = event.detail || {};
        note(`${name || 'An editor'} stopped after an error`, `${message} — use “Try again” in the editor. ` +
            'Your project and the other editors keep running.');
    });
};

// Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z and Ctrl/Cmd+Y with nothing focused (just after
// deleting a costume or sprite from its list) go to the shared history. Inside
// an editor its own handler runs instead, and Blocks' workspace listens on the
// whole document, so it keeps its keys.
const installShortcuts = () => {
    window.addEventListener('keydown', event => {
        if (event.defaultPrevented || !(event.metaKey || event.ctrlKey) || event.altKey) return;
        const key = event.key.toLowerCase();
        if (key !== 'z' && key !== 'y') return;
        if (event.target !== document.body && event.target !== document.documentElement) return;
        if (getUndoState().surface === 'blocks') return;
        event.preventDefault();
        if (key === 'y' || event.shiftKey) redoActiveSurface();
        else undoActiveSurface();
    });
};

// After a session that ended with unsaved changes: offer its last autosave.
const RECOVERY_TEXT = {
    en: {title: 'Brickwright closed with unsaved changes', body: 'Reopen “{title}” as autosaved at {time}?',
        opening: 'Reopening…', copy: 'Save autosave copy…', open: 'Reopen', later: 'Not now', failed: 'Could not reopen it: {error}'},
    de: {title: 'Brickwright wurde mit ungespeicherten Änderungen beendet', body: '„{title}“ wie um {time} automatisch gespeichert wieder öffnen?',
        opening: 'Wird geöffnet…', copy: 'Autosave-Kopie speichern…', open: 'Wieder öffnen', later: 'Nicht jetzt', failed: 'Konnte nicht geöffnet werden: {error}'}
};
const offerRecovery = async store => {
    const candidate = await recoveryCandidate();
    if (!candidate || typeof document === 'undefined') return;
    let locale = 'en';
    try {
        locale = store.getState().locales.locale;
    } catch (e) { /* English */ }
    const T = RECOVERY_TEXT[String(locale).startsWith('de') ? 'de' : 'en'];
    const fill = (text, values) => text.replace(/\{(\w+)\}/g, (m, k) => values[k]);
    const box = document.createElement('div');
    box.setAttribute('role', 'dialog');
    box.setAttribute('data-testid', 'bw-autosave-recovery');
    Object.assign(box.style, {position: 'fixed', left: '12px', bottom: '12px', zIndex: 2147483000,
        maxWidth: 'min(420px, calc(100vw - 24px))', background: '#eff6ff', color: '#1e3a8a',
        border: '1px solid #93c5fd', borderRadius: '8px', padding: '10px 12px',
        font: '13px system-ui, sans-serif', boxShadow: '0 4px 14px rgba(0,0,0,.15)'});
    const title = document.createElement('strong');
    title.textContent = T.title;
    const body = document.createElement('div');
    body.style.margin = '4px 0 8px';
    body.textContent = fill(T.body, {title: candidate.title, time: new Date(candidate.at).toLocaleString()});
    const button = (label, primary) => {
        const element = document.createElement('button');
        element.type = 'button';
        element.textContent = label;
        Object.assign(element.style, {minHeight: '32px', padding: '4px 10px', marginRight: '6px', borderRadius: '6px',
            border: '1px solid #93c5fd', cursor: 'pointer', background: primary ? '#1d4ed8' : '#fff',
            color: primary ? '#fff' : '#1e3a8a'});
        return element;
    };
    const open = button(T.open, true);
    open.setAttribute('data-testid', 'bw-autosave-recovery-open');
    const later = button(T.later, false);
    open.onclick = () => {
        open.disabled = true;open.textContent = T.opening;
        restoreVersion(candidate.id).then(() => box.remove(), error => {
            body.textContent = fill(T.failed, {error: describe(error)});
            open.disabled = false;open.textContent = T.open;backup.hidden = false;
        });
    };
    const backup = button(T.copy, false);backup.hidden = true;
    backup.onclick = async () => {try {const saved = await readVersion(candidate.id);if (saved) await download(`${candidate.title || 'Recovered project'}.sb3`, saved.blob);} catch (error) {body.textContent = fill(T.failed, {error: describe(error)});}};
    later.onclick = () => box.remove();
    const close = button('×', false);
    close.setAttribute('aria-label', String(locale).startsWith('de') ? 'Wiederherstellung schließen' : 'Dismiss recovery');
    Object.assign(close.style, {float: 'right', marginRight: 0});
    close.onclick = () => box.remove();
    box.append(close, title, body, open, later, backup);
    document.body.appendChild(box);
};

/**
 * @returns {Promise<void>} resolves once the safety net is running
 */
export default async function initProjectSafety () {
    if (typeof window === 'undefined') return;
    installErrorNotes();
    installShortcuts();
    window.addEventListener('bw-open-history-panel', event => {
        openPanel((event.detail && event.detail.view) || 'history').catch(error => note('History', describe(error)));
    });
    const store = await waitFor(() => window.__brickwrightStore);
    const vm = await waitFor(() => store.getState().scratchGui.vm);
    instrumentProjectHistory(vm);
    startAutosave(vm, store);
    offerRecovery(store).catch(() => { /* recovery is an offer, never a failure */ });
}
