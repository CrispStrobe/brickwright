// SPDX-License-Identifier: BSD-3-Clause
import React from 'react';
import CadCircuitPanel from './cad-circuit-panel.jsx';
import PropTypes from 'prop-types';
import {CAD_READY_EVENT} from '../../lib/bw-cad-program.js';
import download from '../../lib/download-blob.js';
import {loadCadSDK, cadAssetURL} from '../../lib/bw-cad-sdk.js';
import {CAD_STORAGE_KEY, readCadText, setLiveCadText, getCadProjectGeneration} from '../../lib/bw-cad-project.js';
import {registerUndoSurface, activateUndoSurface, notifyUndoState} from '../../lib/global-undo.js';
import {registerEditorMenuActions, notifyEditorMenuActions} from '../../lib/editor-menu-actions.js';

// A settings toggle remounts the view, while its host-owned session retains undo.
let retainedSession = null;
let retainedText;
let retainedGeneration;
const pickFile = (accept, signal) => new Promise((resolve, reject) => {
    if (signal.aborted) { resolve(null); return; }
    const input = document.createElement('input');
    let settled = false;
    const finish = (file, error) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', cancel);
        input.onchange = input.oncancel = null;
        input.remove();
        if (error) reject(error);
        else resolve(file);
    };
    const cancel = () => finish(null);
    input.type = 'file';
    input.accept = accept;
    input.onchange = async () => {
        try {
            const file = input.files[0];
            if (file && file.size > 64 * 1024 * 1024) throw new Error('Project exceeds 64 MiB');
            finish(file ? {name: file.name, bytes: new Uint8Array(await file.arrayBuffer())} : null);
        } catch (error) { finish(null, error); }
    };
    input.oncancel = cancel;
    signal.addEventListener('abort', cancel, {once: true});
    input.style.display = 'none';
    document.body.appendChild(input);
    input.click();
});

const CadTab = ({vm, isVisible, locale, theme, onEditProgram, onOpenCircuit}) => {
    const colorMode = theme === 'dark' ? 'dark' : 'light';
    const mode = React.useRef(colorMode);
    mode.current = colorMode;
    const host = React.useRef(null);
    const editor = React.useRef(null);
    const visible = React.useRef(isVisible);
    visible.current = isVisible;
    const [error, setError] = React.useState('');
    const [storageWarning, setStorageWarning] = React.useState(false);
    const [retry, setRetry] = React.useState(0);
    const [toolbarHost,setToolbarHost]=React.useState(null);
    React.useEffect(()=>{
        if(!isVisible)return undefined;
        window.dispatchEvent(new CustomEvent('bw-chrome-compact-request',{detail:{compact:true}}));
        return()=>{let compact=false;try{compact=localStorage.getItem('bw:compact-chrome')==='1';}catch{/* private mode */}window.dispatchEvent(new CustomEvent('bw-chrome-compact-request',{detail:{compact}}));};
    },[isVisible]);
    React.useEffect(() => {
        let stopped = false, removeUndo, removeMenus, sdk, mountedGeneration;
        const fileSelection = new AbortController();
        const fail = error => { if (!stopped) setError(String(error.message || error)); };
        const persist = doc => {
            if (stopped || mountedGeneration !== getCadProjectGeneration()) return;
            const text = sdk.serializeDocument(doc);
            retainedText = text;
            setLiveCadText(text);
            try { localStorage.setItem(CAD_STORAGE_KEY, text); setStorageWarning(false); }
            catch { setStorageWarning(true); }
        };
        const reload = event => {
            if (!['loaded', 'legacy'].includes(event.detail?.outcome)) return;
            setStorageWarning(event.detail.storageMode === 'session-cad');
            // Retire the previous view even when the incoming CAD version cannot be
            // opened. Keeping its old editor writable would overwrite the new sidecar.
            setRetry(value => value + 1);
        };
        const requestFile = async accept => {
            const session = retainedSession;
            const generation = getCadProjectGeneration(), revision = session.state.revision;
            const isCurrent = () => !stopped && generation === getCadProjectGeneration() &&
                session === retainedSession && revision === session.state.revision;
            try {
                const file = await pickFile(accept, fileSelection.signal);
                return isCurrent() ? file : null;
            } catch (error) {
                if (isCurrent()) throw error;
                return null;
            }
        };
        window.addEventListener('bw-project-bundle-loaded', reload);
        setError('');
        loadCadSDK().then(loaded => {
            if (stopped) return;
            sdk = loaded;
            sdk.setLocale(locale);
            const text = readCadText();
            const doc = text ? sdk.parseDocument(text) : sdk.createDocument();
            if (!retainedSession || retainedText !== text || retainedGeneration !== getCadProjectGeneration()) {
                if (retainedSession) retainedSession.dispose();
                retainedSession = sdk.createCadSession(doc);
            }
            retainedText = text;
            retainedGeneration = getCadProjectGeneration();
            mountedGeneration = retainedGeneration;
            const controls=document.createElement('div');
            const mounted = sdk.mountCadEditor(host.current, {
                session: retainedSession,
                embedded:true, toolbarContent:controls,
                colorMode: mode.current,
                wasmURL: cadAssetURL('cad-assets/manifold.wasm'),
                onDocumentChange: persist,
                onCommandStateChange: () => {notifyUndoState();notifyEditorMenuActions();},
                onSimulationInterrupt: () => window.dispatchEvent(new CustomEvent('bw-cad-simulation-interrupt')),
                onExport: file => download(file.name, new Blob([file.bytes], {type: file.mime})),
                saveProject: () => download('design.bcad', new Blob([retainedSession.serialize()], {type: 'application/json'})),
                requestOpen: () => requestFile('.bcad,.json,.stl'), requestImport: () => requestFile('.stl'),
                onError: fail
            });
            editor.current = mounted;
            setToolbarHost(controls);
            removeMenus=registerEditorMenuActions('cad',()=>{
                if(!visible.current)return null;
                const de=locale.startsWith('de'),label=(en,ger)=>de?ger:en;
                const action=(title,command,enabled=true)=>({label:title,location:'file',enabled,run:()=>{mounted.executeCommand(command).catch(fail);}});
                return {
                    cadNew:action(label('New CAD design…','Neues CAD-Modell…'),'new'),
                    cadOpen:action(label('Open CAD design…','CAD-Modell öffnen…'),'open'),
                    cadSave:action(label('Save CAD design (.bcad)…','CAD-Modell speichern (.bcad)…'),'save'),
                    cadImport:action(label('Import STL into CAD…','STL ins CAD importieren…'),'import'),
                    cadExport:action(label('Export CAD model…','CAD-Modell exportieren…'),'export',mounted.commandState.canExport),
                    cadLibrary:action(label('Model library…','Modellbibliothek…'),'model-library')
                };
            });
            removeUndo = registerUndoSurface('cad', {
                label: 'CAD', canUndo: () => retainedSession.state.canUndo, canRedo: () => retainedSession.state.canRedo,
                undo: () => retainedSession.undo(), redo: () => retainedSession.redo()
            });
            if (visible.current) { activateUndoSurface('cad'); mounted.focus(); }
            // Same diagnostic boundary as __bwSimLab, for focused browser checks.
            window.__bwCad = {editor: mounted, sdk};
            window.dispatchEvent(new CustomEvent(CAD_READY_EVENT));
        }).catch(fail);
        return () => {
            stopped = true;
            fileSelection.abort();
            window.removeEventListener('bw-project-bundle-loaded', reload);
            if (removeUndo) removeUndo();
            if (removeMenus) removeMenus();
            if (editor.current) editor.current.dispose();
            editor.current = null;
            delete window.__bwCad;
        };
    }, [locale, retry]);
    React.useEffect(() => { if (editor.current) editor.current.setColorMode(colorMode); }, [colorMode]);
    React.useEffect(() => {
        if (isVisible && editor.current) { activateUndoSurface('cad'); editor.current.focus(); }
        notifyEditorMenuActions();
    }, [isVisible]);
    return <div data-testid="bw-cad-tab" style={{position:'relative',width: '100%', height: '100%', flex: 1, minWidth: 0, minHeight: 350, display: 'flex', flexDirection: 'column'}}>
        <CadCircuitPanel vm={vm} locale={locale} colorMode={colorMode} isVisible={isVisible} toolbarHost={toolbarHost} onEditProgram={onEditProgram} onOpenCircuit={onOpenCircuit} />
        {storageWarning ? <div role="status" style={{position:'absolute',bottom:30,left:10,zIndex:20,maxWidth:320,padding:8,borderRadius:6,background:colorMode==='dark'?'#152432':'#fff',color:colorMode==='dark'?'#edf3fa':'#1c3042',fontSize:12}}>{locale.startsWith('de')
            ? 'Nur für diese Sitzung gespeichert. Speichere das Projekt als Datei.'
            : 'Saved for this session. Save the project to a file to keep it.'}</div> : null}
        {error ? <div role="alert">{error} <button onClick={() => setRetry(value => value + 1)}>
            {locale.startsWith('de') ? 'Erneut versuchen' : 'Retry'}
        </button></div> : null}
        <div ref={host} style={{width: '100%', flex: 1, minWidth: 0, minHeight: 350}} />
    </div>;
};
CadTab.propTypes = {
    vm: PropTypes.object.isRequired,
    theme: PropTypes.string,
    isVisible: PropTypes.bool.isRequired,
    locale: PropTypes.string.isRequired,
    onEditProgram:PropTypes.func,
    onOpenCircuit:PropTypes.func
};
export default CadTab;
