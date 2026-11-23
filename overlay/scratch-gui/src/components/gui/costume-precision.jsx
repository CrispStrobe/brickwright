// SPDX-License-Identifier: BSD-3-Clause
import React from 'react';
import PropTypes from 'prop-types';
import {CAD_OPEN_EVENT, CAD_READY_EVENT} from '../../lib/bw-cad-program.js';
import {getCadEnabled} from '../../lib/bw-cad-preferences.js';
import {getCadProjectGeneration} from '../../lib/bw-cad-project.js';
import {loadCadSDK} from '../../lib/bw-cad-sdk.js';
import {getCostumePrecision, COSTUME_PRECISION_EVENT} from '../../lib/bw-costume-precision.js';
import {getCostumeDocument} from '../../lib/bw-artwork-bundle.js';
import styles from './editor-help.css';
import layout from './costume-precision.css';

const readSvg = costume => {
    if (costume?.dataFormat !== 'svg') return null;
    const layers = getCostumeDocument(costume)?.layers;
    if (layers?.length === 1 && layers[0].content.kind === 'svg' && layers[0].visible && layers[0].opacity === 1) {
        return layers[0].content.value;
    }
    return costume.asset?.decodeText?.() || null;
};

const readyCad = signal => new Promise((resolve, reject) => {
    if (signal.aborted) {
        reject(signal.reason);
        return;
    }
    const cleanup = () => {
        clearTimeout(timer);
        window.removeEventListener(CAD_READY_EVENT, ready);
        signal.removeEventListener('abort', cancel);
    };
    const ready = () => {
        const current = window.__bwCad?.editor;
        if (current) {
            cleanup();
            resolve(current);
        }
    };
    const cancel = () => { cleanup(); reject(signal.reason); };
    const timer = setTimeout(() => {
        cleanup();
        reject(new Error('CAD Editor did not become ready.'));
    }, 30000);
    signal.addEventListener('abort', cancel, {once: true});
    window.addEventListener(CAD_READY_EVENT, ready);
    window.dispatchEvent(new Event(CAD_OPEN_EVENT));
    ready();
});

const drawingPath = loop => {
    if (loop.kind === 'outline') return `M ${loop.points.map(([x, y]) => `${x} ${-y}`).join(' L ')} Z`;
    const [x, y] = loop.center, r = loop.radius;
    return `M ${x - r} ${-y} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
};

export default function CostumePrecision ({getCostume, locale, buttonClass}) {
    const [enabled, setEnabled] = React.useState(getCostumePrecision);
    const dialog = React.useRef(null), button = React.useRef(null), active = React.useRef(null);
    const [snapshot, setSnapshot] = React.useState(null), [error, setError] = React.useState('');
    const [selected, select] = React.useState(0), [width, setWidth] = React.useState('40');
    const [plane, setPlane] = React.useState('XY'), [busy, setBusy] = React.useState(false);
    const [saved, setSaved] = React.useState(false);
    const sending = React.useRef(false);
    const de = /^de/i.test(locale), text = (english, german) => de ? german : english;
    React.useEffect(() => {
        const onPreference = () => {
            const value = getCostumePrecision();
            if (!value) {
                active.current?.abort();
                dialog.current?.close();
            }
            setEnabled(value);
        };
        const onEscape = event => {
            if (event.key !== 'Escape' || !dialog.current?.open) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            dialog.current.close();
        };
        window.addEventListener(COSTUME_PRECISION_EVENT, onPreference);
        window.addEventListener('keydown', onEscape, true);
        return () => {
            active.current?.abort();
            window.removeEventListener(COSTUME_PRECISION_EVENT, onPreference);
            window.removeEventListener('keydown', onEscape, true);
        };
    }, []);
    const costume = getCostume();
    if (!enabled || costume?.dataFormat !== 'svg') return null;

    const open = async () => {
        active.current?.abort();
        const request = new AbortController();
        active.current = request;
        setSnapshot(null); setError(''); setSaved(false); select(0); setWidth('40'); setPlane('XY'); setBusy(true);
        dialog.current.showModal();
        try {
            if (!getCadEnabled()) throw new Error(text('Enable CAD Editor in Settings → Workspace first.',
                'Aktiviere zuerst den CAD-Editor unter Einstellungen → Arbeitsbereich.'));
            const source = readSvg(costume);
            if (!source) throw new Error(text('The vector artwork is unavailable.', 'Die Vektorgrafik ist nicht verfügbar.'));
            const generation = getCadProjectGeneration();
            const sdk = await loadCadSDK();
            if (request.signal.aborted) return;
            sdk.setLocale(locale);
            const result = sdk.readCostumeProfiles(source);
            if (!result.profiles.length && !result.issues.length) setError(text('No filled closed regions found.',
                'Keine gefüllten, geschlossenen Flächen gefunden.'));
            setSnapshot({...result, costume, source, generation, sdk});
        } catch (e) {
            if (!request.signal.aborted) setError(e.message);
        } finally {
            if (!request.signal.aborted) setBusy(false);
        }
    };
    const profile = snapshot?.profiles[selected];
    const height = profile && Number(width) * profile.size[1] / profile.size[0];
    const validWidth = Boolean(width.trim() && Number(width) >= .01 && Number(width) <= 100000 && Number.isFinite(height));
    const send = async () => {
        if (sending.current || !profile || !validWidth) return;
        sending.current = true;
        const {signal} = active.current;
        setBusy(true); setError('');
        try {
            const shape = snapshot.sdk.costumeSketchProfile(profile, Number(width));
            const editor = await readyCad(signal);
            if (signal.aborted) return;
            if (!getCadEnabled() || getCadProjectGeneration() !== snapshot.generation ||
                getCostume() !== snapshot.costume || readSvg(snapshot.costume) !== snapshot.source) {
                throw new Error(text('The project or artwork changed. Reopen the preview.',
                    'Das Projekt oder die Grafik wurde geändert. Öffne die Vorschau erneut.'));
            }
            const name = String(costume.name || 'Artwork').trim().slice(0, 80) || 'Artwork';
            editor.session.addSketch(shape, {name, plane});
            setSaved(true);
        } catch (e) {
            if (!signal.aborted) setError(e.message);
        } finally {
            sending.current = false;
            if (!signal.aborted) setBusy(false);
        }
    };
    const title = text('Send to CAD', 'An CAD senden');
    return <>
        <button ref={button} type="button" className={buttonClass} data-testid="bw-costume-precision"
            title={title} onClick={open}>{title}</button>
        <dialog ref={dialog} className={`${styles.dialog} ${layout.dialog}`} aria-label={title}
            onClose={() => { active.current?.abort(); button.current?.focus({preventScroll: true}); }}>
            <form method="dialog" className={styles.header}>
                <h2>{title}</h2>
                <button type="submit" autoFocus>{text('Close', 'Schließen')}</button>
            </form>
            {error && <p role="alert">{error}</p>}
            {busy && <p role="status">{text('Working…', 'Wird verarbeitet…')}</p>}
            {saved ? <p role="status">{text('Sketch added to CAD. Open Objects to edit or extrude it.',
                'Skizze zu CAD hinzugefügt. Öffne Objekte zum Bearbeiten oder Extrudieren.')}</p> : <>
                {snapshot?.issues.length > 0 && <ul>{snapshot.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
                {snapshot?.strokes && <p>{text('The preview includes the fill. Stroke thickness is ignored.',
                    'Die Vorschau zeigt die Füllung. Die Konturstärke wird ignoriert.')}</p>}
                {profile && <>
                    <label>{text('Region', 'Fläche')}
                        <select aria-label={text('Region', 'Fläche')} value={selected} onChange={event => select(Number(event.target.value))}>
                            {snapshot.profiles.map((region, index) => <option key={index} value={index}>
                                {index + 1} · {region.loops.length - 1} {text('holes', 'Löcher')}
                            </option>)}
                        </select>
                    </label>
                    <svg role="img" aria-label={text('Closed profile preview', 'Vorschau der geschlossenen Fläche')}
                        viewBox={`${profile.origin[0]} ${-profile.origin[1] - profile.size[1]} ${profile.size.join(' ')}`}>
                        <path fillRule="evenodd" d={profile.loops.map(drawingPath).join(' ')} />
                    </svg>
                    <div className={layout.inputs}>
                        <label>{text('Width (mm)', 'Breite (mm)')}
                            <input type="number" min=".01" max="100000" step="any" value={width}
                                onChange={event => setWidth(event.target.value)} />
                        </label>
                        <label>{text('Sketch plane', 'Skizzenebene')}
                            <select aria-label={text('Sketch plane', 'Skizzenebene')} value={plane} onChange={event => setPlane(event.target.value)}>
                                {['XY', 'XZ', 'YZ'].map(value => <option key={value}>{value}</option>)}
                            </select>
                        </label>
                    </div>
                    <p>{validWidth && `${Number(width)} × ${Number(height.toFixed(3))} mm · `}{text('Lower-left corner at the sketch origin.',
                        'Die linke untere Ecke liegt am Skizzenursprung.')}</p>
                    <button type="button" className={buttonClass} disabled={busy || !validWidth} onClick={send}>
                        {text('Add editable sketch', 'Bearbeitbare Skizze hinzufügen')}
                    </button>
                </>}
            </>}
        </dialog>
    </>;
}


CostumePrecision.propTypes = {
    getCostume: PropTypes.func.isRequired,
    locale: PropTypes.string.isRequired,
    buttonClass: PropTypes.string.isRequired
};
