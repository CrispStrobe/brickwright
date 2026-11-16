// History & autosave panel (menu bar ⟲ list, Settings > Autosave & history…).
// Lazy chunk: rendered into its own host by lib/bw-project-safety.js.
import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import {makeT} from '../../lib/bw-i18n.js';
import {subscribeUndoState} from '../../lib/global-undo.js';
import {moveHistory, timeline} from '../../lib/bw-undo-coordinator.js';
import {
    subscribeAutosave, writeSettings, listVersions, saveNow, restoreVersion, readVersion, deleteVersion,
    chooseFolder, clearFolder, regrantFolder, folderPickerAvailable, fixedFolder, isAndroidApp
} from '../../lib/bw-autosave.js';
import downloadBlob from '../../lib/download-blob';

const t = makeT({en: {
    history: 'Project history', autosave: 'Autosave', autosaveLink: 'Autosave…', close: 'Close',
    now: 'Now', noSteps: 'No changes yet.', older: 'Steps from before the last reload are kept as autosave versions:', showVersions: 'Show versions', undone: 'Undone: click to redo up to here', more: '… {n} more',
    enabled: 'Save versions automatically', every: 'Every', keep: 'Keep', versions: '{n} versions',
    where: 'Where', browser: 'In this browser (always)', folder: 'Also in folder: {name}',
    noFolder: 'No folder chosen', choose: 'Choose folder…', fixed: 'Also save into the app\'s Autosave folder (Files app)', change: 'Change folder…', forget: 'Stop using folder',
    regrant: 'Allow folder access again', folderUnsupported: 'This browser can only keep autosaves inside the browser. Use the desktop app or Chrome/Edge to also save into a folder.',
    androidStorage: 'Autosaves stay inside this app. Download a saved version below to keep a file.',
    saveNow: 'Save version now', saving: 'Saving…', last: 'Last saved {time}', never: 'Not saved yet',
    list: 'Saved versions', empty: 'No versions yet.', restore: 'Restore', confirm: 'Replace current project?',
    download: 'Download', remove: 'Delete', restored: 'Version restored. The project before it was saved as a version.',
    reasons_auto: 'auto', reasons_manual: 'manual', reasons_hidden: 'on leave', 'reasons_before-restore': 'before restore',
    sec: '{n} s', min: '{n} min'
}, de: {
    history: 'Projektverlauf', autosave: 'Autospeichern', autosaveLink: 'Autospeichern…', close: 'Schließen',
    now: 'Jetzt', noSteps: 'Noch keine Änderungen.', older: 'Schritte von vor dem letzten Neuladen sind als Autospeicherungen erhalten:', showVersions: 'Versionen zeigen', undone: 'Rückgängig gemacht: klicken, um bis hier wiederherzustellen',
    more: '… {n} weitere',
    enabled: 'Versionen automatisch speichern', every: 'Alle', keep: 'Behalten', versions: '{n} Versionen',
    where: 'Speicherort', browser: 'In diesem Browser (immer)', folder: 'Zusätzlich im Ordner: {name}',
    noFolder: 'Kein Ordner gewählt', choose: 'Ordner wählen…', fixed: 'Zusätzlich im Autosave-Ordner der App speichern (Dateien-App)', change: 'Ordner ändern…', forget: 'Ordner nicht mehr verwenden',
    regrant: 'Ordnerzugriff erneut erlauben', folderUnsupported: 'Dieser Browser kann Autospeicherungen nur im Browser ablegen. Mit der Desktop-App oder Chrome/Edge auch in einem Ordner.',
    androidStorage: 'Autospeicherungen bleiben in dieser App. Lade unten eine gespeicherte Version herunter, um eine Datei zu behalten.',
    saveNow: 'Version jetzt speichern', saving: 'Speichert…', last: 'Zuletzt gespeichert {time}', never: 'Noch nicht gespeichert',
    list: 'Gespeicherte Versionen', empty: 'Noch keine Versionen.', restore: 'Wiederherstellen', confirm: 'Aktuelles Projekt ersetzen?',
    download: 'Herunterladen', remove: 'Löschen', restored: 'Version wiederhergestellt. Der vorherige Stand wurde als Version gesichert.',
    reasons_auto: 'automatisch', reasons_manual: 'manuell', reasons_hidden: 'beim Verlassen', 'reasons_before-restore': 'vor Wiederherstellen',
    sec: '{n} s', min: '{n} min'
}});

const INTERVALS = [15, 30, 60, 120, 300, 600];
const KEEPS = [10, 30, 50, 100, 200];
const SHOW_STEPS = 100;
const button = {minHeight: 36, padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6,
    background: '#fff', color: '#0f172a', fontSize: 12, cursor: 'pointer'};
const row = {display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap'};

const stepRow = (current, undone) => ({display: 'block', width: '100%', textAlign: 'left', border: 0, borderRadius: 4,
    padding: '4px 8px', minHeight: 26, fontSize: 12, cursor: current ? 'default' : 'pointer', whiteSpace: 'nowrap',
    overflow: 'hidden', textOverflow: 'ellipsis', boxSizing: 'border-box', flexShrink: 0,
    background: current ? '#e0f2fe' : 'transparent', color: undone ? '#94a3b8' : '#0f172a',
    fontWeight: current ? 600 : 400, fontStyle: undone ? 'italic' : 'normal'});
const linkButton = {border: 0, background: 'none', color: '#0369a1', fontSize: 12, cursor: 'pointer', padding: '2px 4px'};
// A dropdown under the menu-bar History button (top right when it is not there).
const anchor = () => {
    const width = Math.min(340, window.innerWidth - 16);
    const button = document.querySelector('[data-testid="bw-global-history"]');
    const rect = button && button.getBoundingClientRect();
    if (!rect || !rect.width) return {top: 56, right: 8, width};
    return {top: rect.bottom + 4, left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), width};
};

const localeOf = () => {
    try {
        return window.__brickwrightStore.getState().locales.locale;
    } catch (e) {
        return 'en';
    }
};

class HistoryPanel extends React.Component {
    constructor (props) {
        super(props);
        this.state = {view: props.view, undo: null, timeline: null, autosave: null, versions: [], confirm: null,
            message: '', busy: false};
        this.root = React.createRef();
        // A dropdown: a press anywhere else closes it (the History button toggles it).
        this.handleOutside = event => {
            const target = event.target;
            if (this.root.current && !this.root.current.contains(target) &&
                !(target.closest && target.closest('[data-testid="bw-global-history"]'))) this.props.onClose();
        };
        this.list = React.createRef();
        this.handleKey = event => {
            if (event.key === 'Escape') this.props.onClose();
        };
        // Arrow keys walk the steps, Home/End jump to the newest/oldest; Enter
        // and Space press the focused step like any button.
        this.handleListKey = event => {
            const steps = Array.from(this.list.current.querySelectorAll('button:not([disabled])'));
            const at = steps.indexOf(document.activeElement);
            const next = {ArrowDown: at + 1, ArrowUp: at < 0 ? steps.length - 1 : at - 1,
                Home: 0, End: steps.length - 1}[event.key];
            if (next === undefined || !steps.length) return;
            event.preventDefault();
            steps[Math.max(0, Math.min(steps.length - 1, next))].focus();
        };
    }
    componentDidMount () {
        this.unsubscribeUndo = subscribeUndoState(undo => this.setState({undo, timeline: timeline('workspace')}));
        document.addEventListener('pointerdown', this.handleOutside, true);
        this.unsubscribeAutosave = subscribeAutosave(autosave => {
            const saved = this.state.autosave && this.state.autosave.lastSavedAt;
            this.setState({autosave});
            if (autosave.lastSavedAt !== saved) this.refreshVersions();
        });
        document.addEventListener('keydown', this.handleKey);
        this.refreshVersions();
    }
    componentDidUpdate (prevProps, prevState) {
        // Keep "Now" in view when the list first appears (long redo tails push it down).
        const shown = Boolean(prevState.timeline) !== Boolean(this.state.timeline) || prevState.view !== this.state.view;
        if (shown && this.list.current) {
            const now = this.list.current.querySelector('[aria-selected="true"]');
            if (now && now.scrollIntoView) now.scrollIntoView({block: 'nearest'});
        }
        if (prevProps.view !== this.props.view || prevProps.opened !== this.props.opened) {
            this.setState({view: this.props.view}); // eslint-disable-line react/no-did-update-set-state
        }
    }
    componentWillUnmount () {
        this.unsubscribeUndo();
        this.unsubscribeAutosave();
        document.removeEventListener('keydown', this.handleKey);
        document.removeEventListener('pointerdown', this.handleOutside, true);
    }
    refreshVersions () {
        listVersions().then(versions => this.setState({versions}), error => this.setState({message: error.message}));
    }
    run (work) {
        this.setState({busy: true, message: ''});
        return Promise.resolve().then(work)
            .then(message => this.setState({busy: false, message: typeof message === 'string' ? message : ''}),
                error => this.setState({busy: false, message: String(error && error.message || error)}));
    }
    renderHistory (L) {
        const {timeline, busy} = this.state;
        if (!timeline) return null;
        const {past, future} = timeline;
        // Undo steps live in memory; after a reload the autosave versions are the way back.
        if (!past.length && !future.length) {
            return <p style={{fontSize: 12, margin: '4px 8px'}}>{t(L, 'noSteps')}
                {this.state.versions.length ? <> {t(L, 'older')} <button type="button" style={linkButton}
                    data-testid="bw-history-show-versions" onClick={() => this.setState({view: 'autosave', message: ''})}>
                    {t(L, 'showVersions')}</button></> : null}</p>;
        }
        const shownFuture = future.slice(0, SHOW_STEPS);
        const jump = steps => this.run(() => moveHistory(steps, 'workspace').then(() => ''));
        return <div role="listbox" aria-label={t(L, 'history')} data-testid="bw-history-list" ref={this.list}
            onKeyDown={this.handleListKey}
            style={{maxHeight: 340, overflow: 'auto', display: 'flex', flexDirection: 'column'}}>
            {future.length > SHOW_STEPS ? <span style={stepRow(false, true)}>{t(L, 'more', {n: future.length - SHOW_STEPS})}</span> : null}
            {shownFuture.map((label, i) => ({label, distance: i + 1})).reverse().map(({label, distance}) =>
                <button key={`f${distance}`} type="button" role="option" aria-selected={false} disabled={busy}
                    data-testid={`bw-history-step-${distance}`} title={t(L, 'undone')}
                    style={stepRow(false, true)} onClick={() => jump(distance)}>{label}</button>)}
            <span role="option" aria-selected style={stepRow(true, false)}>● {t(L, 'now')}</span>
            {past.slice(0, SHOW_STEPS).map((label, i) =>
                <button key={`p${i}`} type="button" role="option" aria-selected={false} disabled={busy}
                    data-testid={`bw-history-step--${i + 1}`} style={stepRow(false, false)}
                    onClick={() => jump(-(i + 1))}>{label}</button>)}
            {past.length > SHOW_STEPS ? <span style={stepRow(false, true)}>{t(L, 'more', {n: past.length - SHOW_STEPS})}</span> : null}
        </div>;
    }

    renderAutosave (L) {
        const {autosave, versions, confirm, busy} = this.state;
        if (!autosave) return null;
        const {settings, folder} = autosave;
        const label = s => (s < 60 ? t(L, 'sec', {n: s}) : t(L, 'min', {n: s / 60}));
        return <div style={{display: 'grid', gap: 10, fontSize: 12}}>
            <label style={row}><input type="checkbox" checked={settings.enabled} data-testid="bw-autosave-enabled"
                onChange={event => writeSettings({enabled: event.target.checked})} /> {t(L, 'enabled')}</label>
            <div style={row}>
                <label>{t(L, 'every')} <select value={settings.intervalSec} data-testid="bw-autosave-interval"
                    onChange={event => writeSettings({intervalSec: Number(event.target.value)})}>
                    {INTERVALS.concat(INTERVALS.includes(settings.intervalSec) ? [] : [settings.intervalSec])
                        .map(s => <option key={s} value={s}>{label(s)}</option>)}</select></label>
                <label>{t(L, 'keep')} <select value={settings.keep} data-testid="bw-autosave-keep"
                    onChange={event => writeSettings({keep: Number(event.target.value)})}>
                    {KEEPS.concat(KEEPS.includes(settings.keep) ? [] : [settings.keep])
                        .map(n => <option key={n} value={n}>{t(L, 'versions', {n})}</option>)}</select></label>
            </div>
            <div style={{display: 'grid', gap: 6}}>
                <strong>{t(L, 'where')}</strong>
                <span>✓ {t(L, 'browser')}</span>
                {folderPickerAvailable() ? <>
                    <span data-testid="bw-autosave-folder">{folder ? `✓ ${t(L, 'folder', {name: folder.name})}` : t(L, 'noFolder')}</span>
                    <div style={row}>
                        {folder && fixedFolder() ? null : <button type="button" style={button} disabled={busy}
                            data-testid="bw-autosave-choose-folder" onClick={() => this.run(() => chooseFolder().then(() => ''))}>
                            {t(L, fixedFolder() ? 'fixed' : folder ? 'change' : 'choose')}</button>}
                        {folder ? <button type="button" style={button} disabled={busy}
                            onClick={() => this.run(() => clearFolder().then(() => ''))}>{t(L, 'forget')}</button> : null}
                        {folder && folder.kind === 'browser' && autosave.folderError ? <button type="button" style={button}
                            onClick={() => this.run(() => regrantFolder().then(() => ''))}>{t(L, 'regrant')}</button> : null}
                    </div>
                </> : <span>{t(L, isAndroidApp() ? 'androidStorage' : 'folderUnsupported')}</span>}
                {autosave.folderError ? <span role="alert" style={{color: '#b91c1c'}}>{autosave.folderError}</span> : null}
            </div>
            <div style={row}>
                <button type="button" style={button} disabled={busy || autosave.saving} data-testid="bw-autosave-save-now"
                    onClick={() => this.run(() => saveNow('manual').then(() => ''))}>
                    {autosave.saving ? t(L, 'saving') : t(L, 'saveNow')}</button>
                <span>{autosave.lastSavedAt ? t(L, 'last', {time: new Date(autosave.lastSavedAt).toLocaleTimeString()}) : t(L, 'never')}</span>
            </div>
            {autosave.lastError ? <span role="alert" style={{color: '#b91c1c'}}>{autosave.lastError}</span> : null}
            <strong>{t(L, 'list')}</strong>
            {versions.length ? <div style={{display: 'grid', gap: 4, maxHeight: 260, overflow: 'auto'}} data-testid="bw-autosave-versions">
                {versions.map(version => <div key={version.id} style={{...row, justifyContent: 'space-between',
                    borderBottom: '1px solid #e2e8f0', paddingBottom: 4}}>
                    <span>{new Date(version.at).toLocaleString()} · {version.title} · {Math.max(1, Math.round(version.size / 1024))} KB
                        {version.reason ? ` · ${t(L, `reasons_${version.reason}`)}` : ''}</span>
                    <span style={row}>
                        {confirm === version.id ? <>
                            <span>{t(L, 'confirm')}</span>
                            <button type="button" style={{...button, borderColor: '#f59e0b'}} disabled={busy}
                                data-testid="bw-autosave-confirm-restore"
                                onClick={() => this.run(() => restoreVersion(version.id).then(() => {
                                    this.setState({confirm: null});
                                    this.refreshVersions();
                                    return t(L, 'restored');
                                }))}>{t(L, 'restore')}</button>
                        </> : <button type="button" style={button} disabled={busy} data-testid="bw-autosave-restore"
                            onClick={() => this.setState({confirm: version.id})}>{t(L, 'restore')}</button>}
                        <button type="button" style={button} disabled={busy} onClick={() => this.run(() =>
                            readVersion(version.id).then(record => record && downloadBlob(
                                `${record.title} ${new Date(record.at).toISOString().slice(0, 16).replace(':', '-')}.sb3`,
                                record.blob)).then(() => ''))}>{t(L, 'download')}</button>
                        <button type="button" style={button} disabled={busy} aria-label={t(L, 'remove')} onClick={() => this.run(() =>
                            deleteVersion(version.id).then(() => {
                                this.refreshVersions();
                                return '';
                            }))}>✕</button>
                    </span>
                </div>)}
            </div> : <span>{t(L, 'empty')}</span>}
        </div>;
    }
    render () {
        const L = localeOf();
        const {view, message, undo} = this.state;
        const autosave = view === 'autosave';
        return <div ref={this.root} data-testid="bw-history-panel" role="dialog"
            aria-label={t(L, autosave ? 'autosave' : 'history')} style={{...anchor(), position: 'fixed',
                zIndex: 2147482000, maxHeight: 'calc(100vh - 72px)', overflow: 'auto', background: '#fff',
                color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.18)',
                padding: 6, font: '13px system-ui, sans-serif', boxSizing: 'border-box'}}>
            <div style={{...row, justifyContent: 'space-between', padding: '2px 4px 6px', borderBottom: '1px solid #e2e8f0',
                marginBottom: 4}}>
                <strong>{t(L, autosave ? 'autosave' : 'history')}</strong>
                <span style={row}>
                    <button type="button" style={linkButton} data-testid={`bw-history-tab-${autosave ? 'history' : 'autosave'}`}
                        onClick={() => this.setState({view: autosave ? 'history' : 'autosave', message: ''})}>
                        {t(L, autosave ? 'history' : 'autosaveLink')}</button>
                    <button type="button" style={linkButton} aria-label={t(L, 'close')} data-testid="bw-history-close"
                        onClick={this.props.onClose}>✕</button>
                </span>
            </div>
            {autosave ? <div style={{padding: '0 4px'}}>{this.renderAutosave(L)}</div> : this.renderHistory(L)}
            {!autosave && undo && undo.error ? <p role="alert" style={{color: '#b91c1c', fontSize: 12, margin: '4px 8px'}}>{undo.error}</p> : null}
            {message ? <p role="status" style={{fontSize: 12, margin: '4px 8px'}}>{message}</p> : null}
        </div>;
    }
}

HistoryPanel.propTypes = {
    onClose: PropTypes.func.isRequired,
    opened: PropTypes.number,
    view: PropTypes.oneOf(['history', 'autosave'])
};

let opened = 0;
let shownView = null;
// The History button toggles the dropdown; Settings > Autosave opens it on that view.
export const renderHistoryPanel = (host, view) => {
    const wanted = view === 'autosave' ? 'autosave' : 'history';
    const close = () => {
        shownView = null;
        ReactDOM.unmountComponentAtNode(host);
    };
    if (shownView === wanted) return close();
    shownView = wanted;
    ReactDOM.render(<HistoryPanel opened={++opened} view={wanted} onClose={close} />, host);
};
