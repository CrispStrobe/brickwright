import React, {useCallback, useEffect, useRef, useState} from 'react';
import PropTypes from 'prop-types';
import {createWorkspace, validateWorkspace, LOGIKUS_STORAGE_KEY, getLiveWorkspace,
    setLiveWorkspace, getWorkspaceGeneration} from '../../lib/logikus/workspace.js';
import {getPreset} from '../../lib/logikus/presets.js';
import {connectLogikusController} from '../../lib/logikus/controller-bridge.js';
import {serializeControllerPanel} from '../../lib/controller-inputs.js';

const LogikusLab = React.lazy(() => import(/* webpackChunkName: "bw-logikus-lab" */ './logikus-lab.jsx'));

const readWorkspace = (allowLive = true) => {
    const live = allowLive ? getLiveWorkspace() : undefined;
    if (live !== undefined) return live;
    const text = localStorage.getItem(LOGIKUS_STORAGE_KEY);
    return text ? validateWorkspace(JSON.parse(text)) : null;
};

/** Own the running circuit outside the visible pane, just like normal Widgets.
 * Closing the lab does not stop its controller. A project load replaces it.
 */
export default function LogikusHost ({panel, locale, vm}) {
    const [workspace, setWorkspace] = useState(() => {
        try { return readWorkspace(); } catch { return null; }
    });
    const [opened, setOpened] = useState(false);
    const [button, setButton] = useState(false);
    const [error, setError] = useState('');
    const [generation, setGeneration] = useState(0);
    const generationRef = useRef(0);
    const current = useRef(workspace);
    const projectGeneration = useRef(getWorkspaceGeneration());
    const pressed = useRef(false);
    const bridge = useRef(null);
    const german = /^de/i.test(locale || 'en');
    const retireLab = useCallback(() => {
        generationRef.current++;
        setGeneration(generationRef.current);
    }, []);

    const save = useCallback(next => {
        if (projectGeneration.current !== getWorkspaceGeneration()) {
            throw new Error(german ? 'Das Projekt wurde inzwischen ersetzt.' : 'The project has been replaced.');
        }
        const valid = validateWorkspace(next);
        setError('');
        if (current.current?.presetId !== valid.presetId ||
            JSON.stringify(current.current?.program) !== JSON.stringify(valid.program)) {
            pressed.current = false;
            setButton(false);
        }
        current.current = valid;
        setLiveWorkspace(valid);
        setWorkspace(valid);
        try { localStorage.setItem(LOGIKUS_STORAGE_KEY, JSON.stringify(valid)); }
        catch (failure) {
            setError(`${german ? 'Im Browser nicht gespeichert. Exportiere deinen Entwurf: ' :
                'Browser save failed. Export your draft: '}${failure.message}`);
        }
        bridge.current?.sync(valid, pressed.current);
        return valid;
    }, [german]);

    const setTest = useCallback(down => {
        const active = projectGeneration.current === getWorkspaceGeneration();
        pressed.current = active && !!down;
        setButton(pressed.current);
        if (active && current.current) bridge.current?.sync(current.current, pressed.current);
    }, []);

    useEffect(() => {
        const connection = connectLogikusController(panel, {
            getWorkspace: () => projectGeneration.current === getWorkspaceGeneration() ?
                (current.current || createWorkspace()) : createWorkspace(),
            onInputs: inputs => {
                if (projectGeneration.current !== getWorkspaceGeneration() || !current.current?.controller) return;
                pressed.current = !!inputs.button;
                setButton(!!inputs.button);
                save({...current.current, switches: inputs.switches.map(Number)});
            }
        });
        bridge.current = connection;
        if (current.current) connection.sync(current.current, false);
        return () => { connection.dispose(); bridge.current = null; };
    }, [panel, save]);

    useEffect(() => {
        const open = event => {
            try {
                setError('');
                const presetId = event.detail?.presetId;
                if (presetId || !current.current) {
                    const preset = getPreset(presetId || 'lamp');
                    save(createWorkspace({program: preset.program, presetId: preset.id,
                        controller: !!current.current?.controller}));
                    retireLab();
                }
                setTest(false);
                setOpened(true);
                if (event.detail?.journeyId) window.dispatchEvent(new CustomEvent('bw-lesson-project-result',
                    {detail: {journeyId: event.detail.journeyId, ok: true}}));
            } catch (failure) {
                setError(failure.message);
                if (event.detail?.journeyId) window.dispatchEvent(new CustomEvent('bw-lesson-project-result',
                    {detail: {journeyId: event.detail.journeyId, ok: false, error: failure.message}}));
            }
        };
        const release = () => setTest(false);
        const visibility = () => { if (document.hidden) release(); };
        const restore = event => {
            if (event && !['loaded', 'legacy'].includes(event.detail?.outcome)) return;
            try {
                const next = readWorkspace(false);
                projectGeneration.current = getWorkspaceGeneration();
                current.current = next;
                setLiveWorkspace(next);
                setWorkspace(next);
                retireLab();
                setError('');
                release();
                // The parent's normal controller restore runs in the same
                // dispatch. Synchronize after both consumers have their data.
                Promise.resolve().then(() => {
                    if (current.current) bridge.current?.sync(current.current, false);
                });
                if (!next) setOpened(false);
            } catch (failure) { setError(failure.message); }
        };
        const collect = () => { if (current.current) save(current.current); };
        const addControl = event => {
            const name = event.detail?.name;
            if (!name || projectGeneration.current !== getWorkspaceGeneration()) return;
            const preset = getPreset('lamp');
            const next = current.current || createWorkspace({program: preset.program, presetId: preset.id});
            save(bridge.current.install(next, name));
        };
        window.addEventListener('bw-logikus-add-control', addControl);
        window.addEventListener('bw-logikus-open', open);
        window.addEventListener('bw-project-bundle-loaded', restore);
        window.addEventListener('bw-project-bundle-collect', collect);
        window.addEventListener('blur', release);
        document.addEventListener('visibilitychange', visibility);
        vm?.runtime?.on?.('PROJECT_STOP_ALL', release);
        return () => {
            window.removeEventListener('bw-logikus-add-control', addControl);
            window.removeEventListener('bw-logikus-open', open);
            window.removeEventListener('bw-project-bundle-loaded', restore);
            window.removeEventListener('bw-project-bundle-collect', collect);
            window.removeEventListener('blur', release);
            document.removeEventListener('visibilitychange', visibility);
            vm?.runtime?.removeListener?.('PROJECT_STOP_ALL', release);
            release();
        };
    }, [save, setTest, vm, retireLab]);

    const install = () => {
        try {
            setError('');
            setTest(false);
            const next = validateWorkspace({...current.current, controller: true});
            bridge.current.install(next);
            save(next);
            const data = serializeControllerPanel(panel);
            localStorage.setItem('bw-ctl-widgets', JSON.stringify(data));
            window.dispatchEvent(new CustomEvent('bw-controller-changed', {detail: {data}}));
            window.dispatchEvent(new CustomEvent('bw-settings-change',
                {detail: {key: 'bw-debug-dock', value: 'controller'}}));
            retireLab();
            setOpened(false);
        } catch (failure) { setError(failure.message); }
    };

    if (!opened || !workspace) return null;
    // A file read or callback from a retired pane must not replace the project
    // that has since loaded, even before React finishes unmounting that pane.
    const fromLab = callback => (...args) => {
        if (generation === generationRef.current) return callback(...args);
        return undefined;
    };
    return <React.Suspense fallback={<div role="status">{german ? 'Logikus-Labor wird geladen…' : 'Loading Logikus Lab…'}</div>}>
        <LogikusLab key={generation} workspace={workspace} button={button} locale={locale} error={error}
            onChange={fromLab(save)} onTest={fromLab(setTest)} onInstall={fromLab(install)}
            onError={fromLab(failure => setError(failure.message || String(failure)))}
            onClose={fromLab(() => { setTest(false); retireLab(); setOpened(false); })} />
    </React.Suspense>;
}

LogikusHost.propTypes = {panel: PropTypes.object.isRequired, locale: PropTypes.string, vm: PropTypes.object};
