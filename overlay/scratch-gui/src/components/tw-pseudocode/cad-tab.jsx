// SPDX-License-Identifier: BSD-3-Clause
import React from 'react';
import CadCircuitPanel from './cad-circuit-panel.jsx';
import PropTypes from 'prop-types';
import {CAD_READY_EVENT} from '../../lib/bw-cad-program.js';
import download from '../../lib/download-blob.js';
import {loadCadSDK, cadAssetURL} from '../../lib/bw-cad-sdk.js';
import {CAD_STORAGE_KEY, readCadText, setLiveCadText, getCadProjectGeneration} from '../../lib/bw-cad-project.js';
import {registerUndoSurface, activateUndoSurface, notifyUndoState} from '../../lib/global-undo.js';

// A settings toggle remounts the view, while its host-owned session retains undo.
let retainedSession = null;
let retainedText;
let retainedGeneration;
const pickFile = accept => new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async () => {
        try {
            const file = input.files[0];
            if (file && file.size > 64 * 1024 * 1024) throw new Error('Project exceeds 64 MiB');
            resolve(file ? {name: file.name, bytes: new Uint8Array(await file.arrayBuffer())} : null);
        } catch (error) { reject(error); }
        finally { input.remove(); }
    };
    input.oncancel = () => { resolve(null); input.remove(); };
    input.style.display = 'none';
    document.body.appendChild(input);
    input.click();
});

const CadTab = ({vm, isVisible, locale, theme}) => {
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
    React.useEffect(() => {
        let stopped = false, removeUndo, sdk;
        const fail = error => { if (!stopped) setError(String(error.message || error)); };
        const persist = doc => {
            const text = sdk.serializeDocument(doc);
            retainedText = text;
            setLiveCadText(text);
            try { localStorage.setItem(CAD_STORAGE_KEY, text); setStorageWarning(false); }
            catch { setStorageWarning(true); }
        };
        const reload = event => {
            if (!['loaded', 'legacy'].includes(event.detail?.outcome) || !editor.current) return;
            try {
                const text = readCadText();
                // Validate before touching the live session; unsupported versions stay intact.
                const doc = text ? sdk.parseDocument(text) : sdk.createDocument();
                retainedSession.load(doc);
                retainedGeneration = getCadProjectGeneration();
                persist(doc);
                setError('');
            } catch (error) { fail(error); }
        };
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
            const mounted = sdk.mountCadEditor(host.current, {
                session: retainedSession,
                colorMode: mode.current,
                wasmURL: cadAssetURL('cad-assets/manifold.wasm'),
                onDocumentChange: persist,
                onCommandStateChange: () => notifyUndoState(),
                onSimulationInterrupt: () => window.dispatchEvent(new CustomEvent('bw-cad-simulation-interrupt')),
                onExport: file => download(file.name, new Blob([file.bytes], {type: file.mime})),
                saveProject: () => download('design.bcad', new Blob([retainedSession.serialize()], {type: 'application/json'})),
                requestOpen: () => pickFile('.bcad,.json,.stl'), requestImport: () => pickFile('.stl'),
                onError: fail
            });
            editor.current = mounted;
            removeUndo = registerUndoSurface('cad', {
                label: 'CAD', canUndo: () => retainedSession.state.canUndo, canRedo: () => retainedSession.state.canRedo,
                undo: () => retainedSession.undo(), redo: () => retainedSession.redo()
            });
            window.addEventListener('bw-project-bundle-loaded', reload);
            if (visible.current) { activateUndoSurface('cad'); mounted.focus(); }
            // Same diagnostic boundary as __bwSimLab, for focused browser checks.
            window.__bwCad = {editor: mounted, sdk};
            window.dispatchEvent(new CustomEvent(CAD_READY_EVENT));
        }).catch(fail);
        return () => {
            stopped = true;
            window.removeEventListener('bw-project-bundle-loaded', reload);
            if (removeUndo) removeUndo();
            if (editor.current) editor.current.dispose();
            editor.current = null;
            delete window.__bwCad;
        };
    }, [locale, retry]);
    React.useEffect(() => { if (editor.current) editor.current.setColorMode(colorMode); }, [colorMode]);
    React.useEffect(() => {
        if (isVisible && editor.current) { activateUndoSurface('cad'); editor.current.focus(); }
    }, [isVisible]);
    return <div data-testid="bw-cad-tab" style={{width: '100%', height: '100%', flex: 1, minWidth: 0, minHeight: 350, display: 'flex', flexDirection: 'column'}}>
        <CadCircuitPanel vm={vm} locale={locale} colorMode={colorMode} isVisible={isVisible} />
        {storageWarning ? <div role="status">{locale.startsWith('de')
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
    locale: PropTypes.string.isRequired
};
export default CadTab;
