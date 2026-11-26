// SPDX-License-Identifier: BSD-3-Clause
import React from 'react';
import {editorOverflowStyles} from './editor-overflow-styles.js';
import {CAD_ROBOT_EXAMPLES} from '../../lib/bw-cad-robot-catalog.js';
import {openCadRobotProject} from '../../lib/bw-cad-robot-projects.js';
import CadCircuitPanel from './cad-circuit-panel.jsx';
import PropTypes from 'prop-types';
import {CAD_READY_EVENT} from '../../lib/bw-cad-program.js';
import download from '../../lib/download-blob.js';
import {CAMERA_PREFERENCES_EVENT, getCameraPreferences} from '../../lib/bw-camera-preferences.js';
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

const CadTab = ({vm, isVisible, docked, locale, theme, onEditProgram, onOpenCircuit}) => {
    const colorMode = theme === 'dark' ? 'dark' : 'light';
    const mode = React.useRef(colorMode);
    mode.current = colorMode;
    const host = React.useRef(null);
    const editor = React.useRef(null);
    const visible = React.useRef(isVisible);
    visible.current = isVisible;
    // Docked beside the blocks, the editor shows the model but does not take the
    // keyboard or the Undo menu from the workspace the learner is typing in.
    const owns = React.useRef(isVisible && !docked);
    owns.current = isVisible && !docked;
    const [error, setError] = React.useState('');
    const [storageWarning, setStorageWarning] = React.useState(false);
    const [retry, setRetry] = React.useState(0);
    const [toolbarHost,setToolbarHost]=React.useState(null);
    React.useEffect(() => {
        let stopped = false, removeUndo, removeMenus, sdk, mountedGeneration;
        const fileSelection = new AbortController();
        // Messages name their feature by its internal id ("feature <uuid>: …"): show the rest.
        const fail = error => { if (!stopped) setError(String(error.message || error).replace(/^feature [0-9a-f-]{36}: /i, '')); };
        const persist = doc => {
            if (stopped || mountedGeneration !== getCadProjectGeneration()) return;
            // An edit replaces whatever went wrong before; a new failure reports itself again.
            setError('');
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
            const controls=document.createElement('div');controls.dataset.bwProjectRibbon='';controls.style.cssText='display:flex;align-items:center;gap:6px';
            const mounted = sdk.mountCadEditor(host.current, {
                session: retainedSession,
                embedded:true, showDocumentTitle:false, toolbarContent:controls,
                presetProjects:{
                    items:CAD_ROBOT_EXAMPLES.map(item=>({id:item.id,title:item.name,note:locale.startsWith('de')?item.simulationNoteDe:item.simulationNote})),
                    open:id=>openCadRobotProject(vm,id,locale)
                },
                colorMode: mode.current,
                cameraGestures: getCameraPreferences(),
                wasmURL: cadAssetURL('cad-assets/manifold.wasm'),
                onDocumentChange: persist,
                onCommandStateChange: () => {notifyUndoState();notifyEditorMenuActions();},
                onSimulationInterrupt: () => window.dispatchEvent(new CustomEvent('bw-cad-simulation-interrupt')),
                onExport: file => download(file.name, new Blob([file.bytes], {type: file.mime})),
                saveProject: () => download('design.bcad', new Blob([retainedSession.serialize()], {type: 'application/json'})),
                requestOpen: () => requestFile('.bcad,.json,.stl,.step,.stp'), requestImport: () => requestFile('.stl,.step,.stp'),
                onError: fail
            });
            const menuStyles = document.createElement('style');
            menuStyles.textContent = editorOverflowStyles;
            host.current.shadowRoot?.appendChild(menuStyles);
            editor.current = mounted;
            setToolbarHost(controls);window.dispatchEvent(new Event('bw-project-ribbon-changed'));
            removeMenus=registerEditorMenuActions('cad',()=>{
                if(!owns.current)return null;
                const de=locale.startsWith('de'),label=(en,ger)=>de?ger:en;
                const action=(title,command,enabled=true)=>({label:title,location:'file',enabled,run:()=>{mounted.executeCommand(command).catch(fail);}});
                return {
                    cadNew:action(label('New CAD design…','Neues CAD-Modell…'),'new'),
                    cadOpen:action(label('Open CAD design…','CAD-Modell öffnen…'),'open'),
                    cadSave:action(label('Save CAD design (.bcad)…','CAD-Modell speichern (.bcad)…'),'save'),
                    cadImport:action(label('Import STL or STEP into CAD…','STL oder STEP ins CAD importieren…'),'import'),
                    cadExport:action(label('Export CAD model…','CAD-Modell exportieren…'),'export',mounted.commandState.canExport),
                    cadPrintability:action(label('Check printability…','Druckbarkeit prüfen…'),'printability',mounted.commandState.canExport),
                    cadRobotProjects:action(label('Robot projects…','Roboterprojekte…'),'robot-projects'),
                    cadLibrary:action(label('Model library…','Modellbibliothek…'),'model-library'),
                    ...Object.fromEntries([
                        ['run','Run program','Programm starten','[data-testid="bw-cad-run"]'],
                        ['stop','Stop program','Programm stoppen','[aria-label="Stop program"], [aria-label="Programm stoppen"]'],
                        ['reset','Reset simulation','Simulation zurücksetzen','[aria-label="Reset simulation"], [aria-label="Simulation zurücksetzen"]'],
                        ['controls','Robot controls…','Robotersteuerung…','[aria-label="Robot controls"], [aria-label="Robotersteuerung"]'],
                        ['program','Program & connections…','Programm und Verbindungen…','[data-testid="bw-cad-program-settings"]']
                    ].map(([name,en,ger,selector])=>['cad-'+name,{label:label(en,ger),location:'edit',submenu:label('Robot program','Roboterprogramm'),enabled:!!controls.querySelector(selector)&&!controls.querySelector(selector).disabled,run:()=>controls.querySelector(selector)?.click()}])),
                    ...Object.fromEntries([
                        ['cut','Cut objects','Objekte ausschneiden'],['copy','Copy objects','Objekte kopieren'],['paste','Paste objects','Objekte einfügen'],['duplicate','Duplicate objects','Objekte duplizieren'],['delete','Delete objects','Objekte löschen'],['select-all','Select all objects','Alle Objekte auswählen'],['deselect','Clear selection','Auswahl aufheben'],
                        ['shapes','Shapes…','Formen…'],['sketch','Sketch…','Skizze…'],['sketch-path','Sketch path…','Skizzenpfad…'],['code','Code an object…','Objekt programmieren…'],['parameters','Model parameters…','Modellparameter…'],['model-source','Model source…','Modellquelltext…'],
                        ['select','Select tool','Auswahlwerkzeug'],['move','Move tool','Verschieben'],['rotate','Rotate tool','Drehen'],['scale','Scale tool','Skalieren'],['union','Union solids','Körper vereinigen'],['subtract','Subtract solids','Körper abziehen'],['intersect','Intersect solids','Körper schneiden'],
                        ['fit','Fit model in view','Modell einpassen'],['home','Home view','Startansicht'],['top','Top view','Ansicht von oben'],['front','Front view','Vorderansicht'],['right','Right view','Rechte Ansicht'],['objects','Toggle Objects panel','Objektliste umschalten'],['properties','Toggle Properties panel','Eigenschaften umschalten']
                    ].map(([command,en,ger])=>['cad-'+command,{...action(label(en,ger),command,['union','subtract','intersect'].includes(command)?mounted.commandState.canCombine:['cut','copy','duplicate','delete'].includes(command)?mounted.commandState.hasSelection:true),location:'edit',submenu:label('CAD tools','CAD-Werkzeuge')}]))
                };
            });
            removeUndo = registerUndoSurface('cad', {
                label: 'CAD', depth:()=>({undo:retainedSession.history?.past.length||0,redo:retainedSession.history?.future.length||0}),steps:()=>retainedSession.history, canUndo: () => retainedSession.state.canUndo, canRedo: () => retainedSession.state.canRedo,
                undo: () => retainedSession.undo(), redo: () => retainedSession.redo()
            });
            if (owns.current) { activateUndoSurface('cad'); mounted.focus(); }
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
    React.useEffect(() => {
        const update = event => editor.current?.setCameraGestures(event.detail);
        window.addEventListener(CAMERA_PREFERENCES_EVENT, update);
        return () => window.removeEventListener(CAMERA_PREFERENCES_EVENT, update);
    }, []);
    React.useEffect(() => { if (editor.current) editor.current.setColorMode(colorMode); }, [colorMode]);
    React.useEffect(() => {
        if (isVisible && !docked && editor.current) { activateUndoSurface('cad'); editor.current.focus(); }
        notifyEditorMenuActions();window.dispatchEvent(new Event('bw-project-ribbon-changed'));
    }, [isVisible, docked]);
    return <div data-testid="bw-cad-tab" style={{position:'relative',width: '100%', height: '100%', flex: 1, minWidth: 0, minHeight: 350, display: 'flex', flexDirection: 'column'}}>
        <CadCircuitPanel vm={vm} locale={locale} colorMode={colorMode} isVisible={isVisible} toolbarHost={toolbarHost} onEditProgram={onEditProgram} onOpenCircuit={onOpenCircuit} />
        {storageWarning ? <div role="status" style={{position:'absolute',bottom:30,left:10,zIndex:20,pointerEvents:'none',maxWidth:320,padding:8,borderRadius:6,background:colorMode==='dark'?'#152432':'#fff',color:colorMode==='dark'?'#edf3fa':'#1c3042',fontSize:12}}>{locale.startsWith('de')
            ? 'Nur für diese Sitzung gespeichert. Speichere das Projekt als Datei.'
            : 'Saved for this session. Save the project to a file to keep it.'}</div> : null}
        {error ? <div role="alert" style={{position:'absolute',top:56,left:'50%',transform:'translateX(-50%)',zIndex:30,display:'flex',alignItems:'center',gap:10,maxWidth:'90%',padding:'8px 12px',borderRadius:8,border:'1px solid #f3b4b4',background:colorMode==='dark'?'#3a1f22':'#fff5f5',color:colorMode==='dark'?'#ffd7d7':'#9b1c1c',fontSize:13,boxShadow:'0 4px 14px rgba(0,0,0,.15)'}}>
            {error}
            <button type="button" style={{border:'1px solid currentColor',background:'transparent',color:'inherit',borderRadius:6,padding:'2px 8px',cursor:'pointer'}} onClick={() => setRetry(value => value + 1)}>
                {locale.startsWith('de') ? 'Erneut versuchen' : 'Retry'}
            </button>
            <button type="button" aria-label={locale.startsWith('de') ? 'Schließen' : 'Dismiss'} style={{border:'none',background:'transparent',color:'inherit',fontSize:16,cursor:'pointer'}} onClick={() => setError('')}>{'×'}</button>
        </div> : null}
        <div ref={host} style={{width: '100%', flex: 1, minWidth: 0, minHeight: 350}} />
    </div>;
};
CadTab.propTypes = {
    vm: PropTypes.object.isRequired,
    theme: PropTypes.string,
    isVisible: PropTypes.bool.isRequired,
    docked: PropTypes.bool,
    locale: PropTypes.string.isRequired,
    onEditProgram:PropTypes.func,
    onOpenCircuit:PropTypes.func
};
export default CadTab;
