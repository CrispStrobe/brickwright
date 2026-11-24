import React, {useEffect, useState} from 'react';
import PropTypes from 'prop-types';
import Cp1Panel from './cp1-panel.jsx';
import {validateCp1Workspace} from '../../lib/cp1-project.js';

const STORAGE_KEY = 'bw-cp1-workspace';
const emptyWorkspace = () => ({format: 'brickwright.cp1-workspace', version: 1,
    configuration: {expansion: false, clockHz: 6000000}, rom: null, source: ''});
function readWorkspace () {
    try {
        const result = validateCp1Workspace(JSON.parse(localStorage.getItem(STORAGE_KEY)));
        if (result.ok) return result.project;
    } catch (error) { /* No project yet, or an older invalid draft. */ }
    return emptyWorkspace();
}

/** Application state and persistence only. All execution belongs to the shared runner. */
export default function Cp1Host ({runner, running, locale, configuration, onImportRom, onConfigure, onRun}) {
    const [workspace, setWorkspace] = useState(readWorkspace);
    const [error, setError] = useState('');
    const save = next => {
        const result = validateCp1Workspace(next);
        if (!result.ok) throw new Error(result.errors.map(item => item.message).join('\n'));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(result.project));
        setWorkspace(result.project);
    };
    useEffect(() => {
        const restore = () => setWorkspace(readWorkspace());
        const loadSource = event => {
            if (typeof event.detail?.source !== 'string') return;
            const next = {...readWorkspace(), source: event.detail.source,
                configuration: {expansion: event.detail.expansion === true, clockHz: 6000000}};
            save(next);
        };
        window.addEventListener('bw-cp1-source-load', loadSource);
        window.addEventListener('storage', restore);
        window.addEventListener('bw-project-bundle-loaded', restore);
        return () => {
            runner?.cp1ReleaseKeys?.();
            window.removeEventListener('bw-cp1-source-load', loadSource);
            window.removeEventListener('storage', restore);
            window.removeEventListener('bw-project-bundle-loaded', restore);
        };
    }, [runner]);
    const config = configuration || workspace.configuration;
    const safely = fn => async (...args) => {
        try { setError(''); return await fn(...args); }
        catch (failure) { setError(failure.message || String(failure)); return false; }
    };
    return <section data-cp1-host>
        <label><input type="checkbox" checked={config.expansion === true} disabled={running}
            onChange={safely(event => {
                const next = {expansion: event.target.checked, clockHz: 6000000};
                save({...workspace, configuration: next});
                onConfigure(next);
            })} />{' CP3 expansion (256 cells)'}</label>
        {error ? <p role="alert">{error}</p> : null}
        <Cp1Panel snapshot={runner?.cp1Snapshot?.()} running={running} locale={locale}
            expansion={config.expansion === true} clockHz={config.clockHz || 6000000}
            source={workspace.source} romReference={workspace.rom}
            onSourceChange={safely(source => save({...workspace, source}))}
            onImportRom={safely(async image => {
                save({...workspace, configuration: config, rom: image.reference});
                await onConfigure(config);
                await onImportRom(image);
            })}
            onKey={(key, down) => runner?.cp1Key(key, down)}
            onReleaseKeys={() => runner?.cp1ReleaseKeys()}
            onRun={onRun} onPause={() => runner?.pause()}
            onStep={() => runner?.step('insn')} onReset={() => runner?.cp1Reset()}
            onLoad={safely(assembly => runner?.cp1LoadProgram(assembly))}
            onWriteCell={safely((address, cell) => runner?.cp1WriteCell(address, cell))}
            onPortInput={safely((port, value) => runner?.cp1SetInput(port, value))} />
    </section>;
}
Cp1Host.propTypes = {runner: PropTypes.object, running: PropTypes.bool, locale: PropTypes.string,
    configuration: PropTypes.object, onImportRom: PropTypes.func.isRequired,
    onConfigure: PropTypes.func.isRequired, onRun: PropTypes.func.isRequired};
