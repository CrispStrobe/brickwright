import React, {useCallback, useEffect, useRef, useState} from 'react';
import PropTypes from 'prop-types';
import Cp1Panel from './cp1-panel.jsx';
import {validateCp1Workspace} from '../../lib/cp1-project.js';
import {browserLocale} from '../../lib/bw-i18n.js';

const STORAGE_KEY = 'bw-cp1-workspace';
const emptyWorkspace = () => ({format: 'brickwright.cp1-workspace', version: 1,
    configuration: {expansion: false, clockHz: 6000000}, rom: null, source: ''});
function readWorkspace () {
    try {
        const result = validateCp1Workspace(JSON.parse(localStorage.getItem(STORAGE_KEY)));
        if (result.ok) return result.project;
    } catch (error) { /* No project yet, unavailable storage, or an older invalid draft. */ }
    return emptyWorkspace();
}
const programConfig = config => ({expansion: config.expansion === true, clockHz: config.clockHz || 6000000});

/** Application state and persistence only. All execution belongs to the shared runner. */
export default function Cp1Host ({runner, running, locale, configuration, onImportRom, onConfigure, onRun}) {
    const [workspace, setWorkspace] = useState(readWorkspace);
    const [error, setError] = useState('');
    const [pending, setPending] = useState(0);
    const workspaceRef = useRef(workspace);
    const alive = useRef(true);
    const queue = useRef(Promise.resolve());
    const callbacks = useRef(null);
    callbacks.current = {runner, onImportRom, onConfigure, onRun, configuration,
        german: /^de/i.test(locale || browserLocale())};
    const message = useCallback((english, german) => callbacks.current.german ? german : english, []);
    const report = useCallback(failure => {
        if (alive.current) setError(failure.message || String(failure));
    }, []);
    const save = useCallback(update => {
        const next = typeof update === 'function' ? update(workspaceRef.current) : update;
        const result = validateCp1Workspace(next);
        if (!result.ok) throw new Error(result.errors.map(item => item.message).join('\n'));
        // Preserve the current edit in memory even when private mode/quota
        // refuses storage. The UI must never revert a line being typed.
        workspaceRef.current = result.project;
        if (alive.current) setWorkspace(result.project);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(result.project)); }
        catch (failure) {
            report(new Error(message('The current draft remains in this view, but browser storage could not save it: ',
                'Der aktuelle Entwurf bleibt in dieser Ansicht, konnte aber nicht im Browser gespeichert werden: ') +
                (failure.message || String(failure))));
        }
        return result.project;
    }, [message, report]);
    const configure = useCallback(next => {
        // Circuit association (including partId) belongs to machineConfig,
        // while the portable workspace stores only the two CP1 settings.
        const current = callbacks.current.configuration || {};
        return callbacks.current.onConfigure({...current, ...programConfig(next)});
    }, []);
    const enqueue = useCallback(operation => {
        if (alive.current) setPending(value => value + 1);
        callbacks.current.runner?.cp1ReleaseKeys?.();
        const result = queue.current.then(async () => {
            if (!alive.current) throw new Error('CP1 panel was closed.');
            return operation();
        }).finally(() => { if (alive.current) setPending(value => value - 1); });
        // ROM import/configuration requests are serialized. A delayed ROM read
        // cannot finish after a newer CP3/source selection and overwrite it.
        queue.current = result.catch(() => {});
        return result;
    }, []);
    const request = fn => async (...args) => {
        if (alive.current) setError('');
        try { return await fn(...args); }
        catch (failure) { report(failure); throw failure; }
    };
    const uiAction = fn => (...args) => { request(fn)(...args).catch(() => {}); };
    const callRunner = (method, ...args) => {
        const current = callbacks.current.runner;
        if (!current || typeof current[method] !== 'function') {
            throw new Error(message('Import a CP1 monitor ROM before operating the machine.',
                'Importiere ein CP1-Monitor-ROM, bevor du die Maschine bedienst.'));
        }
        const result = current[method](...args);
        if (result === false) throw new Error(message('The CP1 machine is unavailable.', 'Die CP1-Maschine ist nicht verfügbar.'));
        if (result && (result.unsupported || result.refused)) throw new Error(result.unsupported || result.refused);
        return result;
    };

    useEffect(() => {
        alive.current = true;
        const applyWorkspace = next => {
            workspaceRef.current = next;
            setWorkspace(next);
            enqueue(async () => {
                await configure(next.configuration);
                if (alive.current) save(previous => ({...previous, configuration: next.configuration, rom: next.rom}));
            }).catch(report);
        };
        const restore = event => {
            if (event.type === 'storage' && event.key !== null && event.key !== STORAGE_KEY) return;
            applyWorkspace(readWorkspace());
        };
        const loadSource = event => {
            if (typeof event.detail?.source !== 'string') return;
            try {
                setError('');
                const next = {expansion: event.detail.expansion === true, clockHz: 6000000};
                save(previous => ({...previous, source: event.detail.source, configuration: next}));
                enqueue(async () => {
                    await configure(next);
                    if (alive.current) save(previous => ({...previous, configuration: next}));
                }).catch(report);
            } catch (failure) { report(failure); }
        };
        window.addEventListener('bw-cp1-source-load', loadSource);
        window.addEventListener('storage', restore);
        window.addEventListener('bw-project-bundle-loaded', restore);
        return () => {
            alive.current = false;
            callbacks.current.runner?.cp1ReleaseKeys?.();
            window.removeEventListener('bw-cp1-source-load', loadSource);
            window.removeEventListener('storage', restore);
            window.removeEventListener('bw-project-bundle-loaded', restore);
        };
    }, [configure, enqueue, report, save]);
    useEffect(() => () => runner?.cp1ReleaseKeys?.(), [runner]);

    const config = programConfig(configuration || workspace.configuration);
    return <section data-cp1-host>
        <label><input type="checkbox" checked={config.expansion} disabled={running || pending > 0}
            onChange={event => {
                const next = {expansion: event.target.checked, clockHz: config.clockHz};
                uiAction(() => enqueue(async () => {
                    await configure(next);
                    if (alive.current) save(previous => ({...previous, configuration: next}));
                }))();
            }} />{' '}{message('CP3 expansion (256 cells)', 'CP3-Erweiterung (256 Zellen)')}</label>
        {error ? <p role="alert">{error}</p> : null}
        <Cp1Panel snapshot={runner?.cp1Snapshot?.()} running={running} locale={locale}
            expansion={config.expansion} clockHz={config.clockHz}
            source={workspace.source} romReference={workspace.rom}
            onSourceChange={source => {
                try { setError(''); save(previous => ({...previous, source})); }
                catch (failure) { report(failure); }
            }}
            onImportRom={request(image => enqueue(async () => {
                await configure(config);
                if (!alive.current) return;
                await callbacks.current.onImportRom(image);
                if (alive.current) save(previous => ({...previous, configuration: config, rom: image.reference}));
            }))}
            onKey={pending ? undefined : (key, down) => runner?.cp1Key(key, down)}
            onReleaseKeys={() => runner?.cp1ReleaseKeys?.()}
            onRun={pending ? undefined : uiAction(() => callbacks.current.onRun())}
            onPause={uiAction(() => callRunner('pause'))}
            onStep={pending ? undefined : uiAction(() => callRunner('step', 'insn'))}
            onStepCommand={pending ? undefined : request(() => callRunner('step', 'cp1'))}
            onToggleBreakpoint={pending ? undefined : request(address => callRunner('cp1ToggleBreakpoint', address))}
            onReset={pending ? undefined : uiAction(() => callRunner('cp1Reset'))}
            onLoad={pending ? undefined : request(assembly => callRunner('cp1LoadProgram', assembly))}
            onWriteCell={pending ? undefined : request((address, cell) => callRunner('cp1WriteCell', address, cell))}
            onPortInput={pending || runner?.cp1InputMode?.() === 'circuit' ? undefined :
                uiAction((port, value) => callRunner('cp1SetInput', port, value))} />
    </section>;
}
Cp1Host.propTypes = {runner: PropTypes.object, running: PropTypes.bool, locale: PropTypes.string,
    configuration: PropTypes.object, onImportRom: PropTypes.func.isRequired,
    onConfigure: PropTypes.func.isRequired, onRun: PropTypes.func.isRequired};
