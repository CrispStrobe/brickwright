// SPDX-License-Identifier: BSD-3-Clause
import React from 'react';
import PropTypes from 'prop-types';
import {CAD_OPEN_EVENT, CAD_READY_EVENT} from '../../lib/bw-cad-program.js';
import {CAD_TOGGLE_EVENT, getCadEnabled} from '../../lib/bw-cad-preferences.js';
import {getCadProjectGeneration} from '../../lib/bw-cad-project.js';
import {loadCadSDK} from '../../lib/bw-cad-sdk.js';
import {getCostumeDocument, getCostumeSourceId, proposeCostumeSourceId, setCostumeSourceId} from '../../lib/bw-artwork-bundle.js';
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

export default function CostumePrecision ({getCostume, locale, buttonClass, icon, labelClass}) {
    const [enabled, setEnabled] = React.useState(getCadEnabled);
    const dialog = React.useRef(null), button = React.useRef(null), active = React.useRef(null);
    const [snapshot, setSnapshot] = React.useState(null), [error, setError] = React.useState('');
    const [selected, select] = React.useState(0), [width, setWidth] = React.useState('40');
    const [plane, setPlane] = React.useState('XY'), [busy, setBusy] = React.useState(false);
    const [anchor, setAnchor] = React.useState('lower-left');
    const [horizontal, setHorizontal] = React.useState('0'), [vertical, setVertical] = React.useState('0');
    const [saved, setSaved] = React.useState(false);
    const [refresh, setRefresh] = React.useState(null), [updateId, setUpdateId] = React.useState('');
    const [needsRegionChoice, requireRegionChoice] = React.useState(false);
    const [review, setReview] = React.useState(null);
    const [linkArtwork, setLinkArtwork] = React.useState(false);
    const [approximate, setApproximate] = React.useState(false), [tolerance, setTolerance] = React.useState('0.2');
    const [closeGaps, setCloseGaps] = React.useState(false), [maxGap, setMaxGap] = React.useState('0.5');
    const [profileSource, setProfileSource] = React.useState('fill');
    const [createdSketch, setCreatedSketch] = React.useState(null);
    const sending = React.useRef(false), openingExtrusion = React.useRef(false);
    const de = /^de/i.test(locale), text = (english, german) => de ? german : english;
    React.useEffect(() => {
        const onPreference = () => {
            const value = getCadEnabled();
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
        window.addEventListener(CAD_TOGGLE_EVENT, onPreference);
        window.addEventListener('keydown', onEscape, true);
        return () => {
            active.current?.abort();
            window.removeEventListener(CAD_TOGGLE_EVENT, onPreference);
            window.removeEventListener('keydown', onEscape, true);
        };
    }, []);
    const validWidth = Boolean(width.trim() && Number(width) >= .01 && Number(width) <= 100000);
    const validTolerance = Boolean(tolerance.trim() && Number(tolerance) >= .01 && Number(tolerance) <= 10);
    const validGap = Boolean(maxGap.trim() && Number(maxGap) >= .01 && Number(maxGap) <= 10);
    const strokeOnly = profileSource === 'stroke', centerlineOnly = profileSource === 'centerline';
    const repairGaps = closeGaps && profileSource === 'fill';
    const preview = React.useMemo(() => {
        if (!snapshot || (!approximate && !repairGaps && profileSource === 'fill')) return snapshot;
        if (!validWidth || (approximate && !validTolerance) || (repairGaps && !validGap)) return null;
        try {
            return snapshot.sdk.readCostumeProfiles(snapshot.source, {
                widthMm: Number(width),
                toleranceMm: approximate ? Number(tolerance) : undefined,
                maxGapMm: repairGaps ? Number(maxGap) : undefined,
                strokeOnly, centerlineOnly
            });
        } catch (e) {
            return {issues: [e.message], profiles: [], strokes: false};
        }
    }, [snapshot, approximate, repairGaps, profileSource, strokeOnly, centerlineOnly, validWidth, validTolerance, validGap,
        width, tolerance, maxGap]);
    React.useEffect(() => {
        setReview(null);
    }, [selected, width, plane, anchor, horizontal, vertical, profileSource, approximate, tolerance, closeGaps, maxGap, updateId, linkArtwork, needsRegionChoice]);
    const costume = getCostume();
    if (!enabled || costume?.dataFormat !== 'svg') return null;

    const open = async () => {
        active.current?.abort();
        const request = new AbortController();
        active.current = request;
        setCreatedSketch(null);
        setSnapshot(null); setError(''); setSaved(false); select(0); setWidth('40'); setPlane('XY'); setBusy(true);
        setApproximate(false); setTolerance('0.2'); setCloseGaps(false); setMaxGap('0.5'); setProfileSource('fill');
        setAnchor('lower-left'); setHorizontal('0'); setVertical('0');
        setRefresh(null); setUpdateId(''); setReview(null); setLinkArtwork(false); requireRegionChoice(false);
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
            if (result.needsCurveApproximation) {
                setApproximate(true);
                select(null);
            }
            setSnapshot({...result, costume, source, generation, sdk});
        } catch (e) {
            if (!request.signal.aborted) setError(e.message);
        } finally {
            if (!request.signal.aborted) setBusy(false);
        }
    };
    const candidates = preview?.profiles ?? [];
    const area = item => item.size[0] * item.size[1];
    const regionIndex = selected === null ?
        candidates.reduce((best, item, index) => (area(item) > area(candidates[best]) ? index : best), 0) :
        selected < candidates.length ? selected : 0;
    const profile = candidates[regionIndex];
    const artworkPreview = snapshot && <figure>
        <figcaption>{text('Original artwork', 'Originalgrafik')}</figcaption>
        <img alt={text('Original artwork', 'Originalgrafik')} src={`data:image/svg+xml,${encodeURIComponent(snapshot.source)}`} />
    </figure>;
    const span = profile && (centerlineOnly ? Math.max(...profile.size) : profile.size[0]);
    const displayedSize = profile?.size.map(value => Number((value / span * Number(width)).toFixed(3))).join(' × ');
    const regionLabel = centerlineOnly ? text('Path', 'Pfad') : text('Region', 'Fläche');
    const placement = {anchor, position: [horizontal, vertical].map(value => value.trim() ? Number(value) : NaN)};
    const coordinateError = text('Enter sketch coordinates from −100000 to 100000 mm.',
        'Gib Skizzenkoordinaten von −100000 bis 100000 mm ein.');
    const validCoordinate = value => Number.isFinite(value) && Math.abs(value) <= 100000;
    const hasPlacement = anchor === 'center' || placement.position.some(value => value !== 0);
    const anchorLabel = anchor === 'center' ? text('Center', 'Mittelpunkt') : text('Lower-left corner', 'Linke untere Ecke');
    let placementError = placement.position.every(validCoordinate) ? '' : coordinateError;
    if (profile && validWidth && !placementError) {
        try { snapshot.sdk.costumeProfileBounds(profile, Number(width), placement); }
        catch (e) { placementError = e.message; }
    }
    const markerRadius = profile && (centerlineOnly ? Math.max(...profile.size) : Math.min(...profile.size)) * 0.045;
    const profileType = profile?.centerline ? 'path' : profile?.loops.length === 1 ? profile.loops[0].kind :
        profile ? 'region' : undefined;
    const target = refresh?.entries.find(entry => entry.id === updateId);
    const matchingTarget = target?.kind === profileType && target;
    const conversionChanged = () => {
        if (target?.artworkSourceId) requireRegionChoice(true);
    };
    const assertArtworkCurrent = () => {
        if (!getCadEnabled() || getCadProjectGeneration() !== snapshot.generation ||
            getCostume() !== snapshot.costume || readSvg(snapshot.costume) !== snapshot.source) {
            throw new Error(text('The project or artwork changed. Reopen the preview.',
                'Das Projekt oder die Grafik wurde geändert. Öffne die Vorschau erneut.'));
        }
    };
    const selectTarget = entry => {
        setLinkArtwork(false);
        setUpdateId(entry.id);
        setPlane(entry.plane);
        setAnchor('lower-left');
        const clean = value => Number(value.toPrecision(12));
        setHorizontal(String(clean(entry.min[0]))); setVertical(String(clean(entry.min[1])));
        const widthMm = clean(entry.kind === 'path' ? Math.max(...entry.size) : entry.size[0]);
        setWidth(String(widthMm));
        requireRegionChoice(Boolean(entry.artworkSourceId));
        const savedProfile = entry.artworkProfile;
        if (!savedProfile) return;

        const {mode, toleranceMm, maxGapMm} = savedProfile;
        setProfileSource(mode);
        setApproximate(toleranceMm !== undefined);
        setTolerance(String(toleranceMm ?? .2));
        setCloseGaps(maxGapMm !== undefined);
        setMaxGap(String(maxGapMm ?? .5));
        select(0);
        try {
            const {profiles} = snapshot.sdk.readCostumeProfiles(snapshot.source, {
                widthMm, toleranceMm, maxGapMm, strokeOnly: mode === 'stroke', centerlineOnly: mode === 'centerline'
            });
            const index = snapshot.sdk.matchCostumeProfile(profiles, savedProfile);
            if (index !== undefined) {
                select(index);
                requireRegionChoice(false);
            }
        } catch {
            // The conversion panel displays invalid settings or unusable source geometry.
        }
    };
    const chooseUpdate = async () => {
        if (sending.current) return;
        sending.current = true;
        const {signal} = active.current;
        setBusy(true); setError(''); setReview(null);
        try {
            const editor = await readyCad(signal);
            if (signal.aborted) return;
            assertArtworkCurrent();
            const sourceId = getCostumeSourceId(snapshot.costume);
            const entries = editor.artworkSketchTargets().filter(entry => entry.artworkSourceId ?
                entry.artworkSourceId === sourceId : entry.kind === profileType);
            const linked = entries.filter(entry => entry.artworkSourceId);
            setRefresh({editor, entries, revision: editor.session.state.revision});
            setUpdateId('');
            requireRegionChoice(false);
            if (linked.length === 1) selectTarget(linked[0]);
        } catch (e) {
            if (!signal.aborted) setError(e.message);
        } finally {
            sending.current = false;
            if (!signal.aborted) setBusy(false);
        }
    };
    const previewUpdate = async () => {
        if (!matchingTarget || needsRegionChoice || !validWidth || placementError || sending.current) return;
        sending.current = true;
        const {signal} = active.current;
        setBusy(true); setError(''); setReview(null);
        try {
            assertArtworkCurrent();
            if (window.__bwCad?.editor !== refresh.editor || refresh.revision !== refresh.editor.session.state.revision)
                throw new Error(text('The CAD design changed. Choose the target sketch again.',
                    'Der CAD-Entwurf wurde geändert. Wähle die Zielskizze erneut.'));
            const shape = snapshot.sdk.costumeSketchProfile(profile, Number(width), placement);
            const priorSourceId = getCostumeSourceId(snapshot.costume);
            const sourceId = linkArtwork ? proposeCostumeSourceId(snapshot.costume) : priorSourceId;
            const result = await refresh.editor.previewArtworkSketchRefresh(updateId, shape, {
                sourceId, link: linkArtwork, profile: profile.artworkProfile
            });
            if (!signal.aborted) {
                assertArtworkCurrent();
                setReview({...result, newSourceId: linkArtwork && !priorSourceId ? sourceId : undefined});
            }
        } catch (e) {
            if (!signal.aborted) setError(e.message);
        } finally {
            sending.current = false;
            if (!signal.aborted) setBusy(false);
        }
    };
    const applyUpdate = () => {
        if (!review || !matchingTarget || needsRegionChoice || active.current?.signal.aborted) return;
        try {
            assertArtworkCurrent();
            if (review.newSourceId && getCostumeSourceId(snapshot.costume))
                throw new Error(text('The artwork link changed. Preview the update again.',
                    'Die Grafikverknüpfung wurde geändert. Öffne die Vorschau erneut.'));
            review.apply();
            if (review.newSourceId) setCostumeSourceId(snapshot.costume, review.newSourceId);
            setSaved(true); setError('');
        } catch (e) {
            setReview(null); setError(e.message);
        }
    };
    const send = async () => {
        if (sending.current || !profile || !validWidth || placementError) return;
        sending.current = true;
        const {signal} = active.current;
        setBusy(true); setError('');
        try {
            const shape = snapshot.sdk.costumeSketchProfile(profile, Number(width), placement);
            const editor = await readyCad(signal);
            if (signal.aborted) return;
            assertArtworkCurrent();
            const name = String(costume.name || 'Artwork').trim().slice(0, 80) || 'Artwork';
            const sourceId = linkArtwork ? proposeCostumeSourceId(snapshot.costume) : undefined;
            const id = editor.session.addSketch(shape, {name, plane, artworkSourceId: sourceId,
                artworkProfile: sourceId ? profile.artworkProfile : undefined});
            if (sourceId) setCostumeSourceId(snapshot.costume, sourceId);
            if (shape.kind !== 'path') setCreatedSketch({editor, id});
            setSaved(true);
        } catch (e) {
            if (!signal.aborted) setError(e.message);
        } finally {
            sending.current = false;
            if (!signal.aborted) setBusy(false);
        }
    };
    const previewExtrusion = () => {
        try {
            const {editor, id} = createdSketch;
            if (!getCadEnabled() || getCadProjectGeneration() !== snapshot.generation || window.__bwCad?.editor !== editor)
                throw new Error(text('The CAD design changed. Open the sketch from Objects.',
                    'Der CAD-Entwurf wurde geändert. Öffne die Skizze über Objekte.'));
            openingExtrusion.current = true;
            editor.openSketchExtrusion(id);
            dialog.current.close();
        } catch (e) {
            openingExtrusion.current = false;
            setError(e.message);
        }
    };
    const title = text('Send to CAD', 'An CAD senden');
    return <>
        <button ref={button} type="button" className={buttonClass} data-testid="bw-costume-precision"
            aria-label={title} title={title} onClick={open}>{icon}<span className={labelClass}>{title}</span></button>
        <dialog ref={dialog} className={`${styles.dialog} ${layout.dialog}`} aria-label={title}
            onClose={() => {
                active.current?.abort();
                if (!openingExtrusion.current) button.current?.focus({preventScroll: true});
                openingExtrusion.current = false;
            }}>
            <form method="dialog" className={styles.header}>
                <h2>{title}</h2>
                <button type="submit" autoFocus>{text('Close', 'Schließen')}</button>
            </form>
            {error && <p role="alert">{error}</p>}
            {busy && <p role="status">{text('Working…', 'Wird verarbeitet…')}</p>}
            {saved ? <>
                <p role="status">{refresh ? text('CAD sketch updated.', 'CAD-Skizze aktualisiert.') : centerlineOnly ? text('Sketch added to CAD. Open Objects to edit the path.',
                'Skizze zu CAD hinzugefügt. Öffne Objekte zum Bearbeiten des Pfads.') :
                text('Sketch added to CAD. Open Objects to edit or extrude it.',
                    'Skizze zu CAD hinzugefügt. Öffne Objekte zum Bearbeiten oder Extrudieren.')}</p>
                {createdSketch && <button type="button" className={buttonClass} onClick={previewExtrusion}>
                    {text('Preview extrusion', 'Extrusionsvorschau')}
                </button>}
            </> : <>
                {preview?.issues.length > 0 && (profile ?
                    <details>
                        <summary>{text('Skipped artwork', 'Übersprungene Grafikteile')}</summary>
                        <ul>{preview.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>
                    </details> :
                    <ul>{preview.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>)}
                {preview && !preview.profiles.length && !preview.issues.length && <p>{centerlineOnly ?
                    text('No open paths found.', 'Keine offenen Pfade gefunden.') : strokeOnly ?
                    text('No visible strokes found.', 'Keine sichtbaren Linienzüge gefunden.') :
                    text('No filled closed regions found.', 'Keine gefüllten, geschlossenen Flächen gefunden.')}</p>}
                {snapshot && <>
                    {(snapshot.strokes || snapshot.centerlines) && <label>{text('Profile source', 'Profilquelle')}
                        <select aria-label={text('Profile source', 'Profilquelle')} value={profileSource} disabled={busy} onChange={event => {
                            setProfileSource(event.target.value); select(0); conversionChanged();
                        }}>
                            <option value="fill">{text('Filled areas', 'Gefüllte Flächen')}</option>
                            {snapshot.strokes && <option value="stroke">{text('Strokes', 'Linienzüge')}</option>}
                            {snapshot.centerlines && <option value="centerline">{text('Open paths', 'Offene Pfade')}</option>}
                        </select>
                    </label>}
                    <label className={layout.checkbox}>
                        <input type="checkbox" checked={approximate} disabled={busy} onChange={event => {
                            setApproximate(event.target.checked); select(0); conversionChanged();
                        }} />
                        {text('Approximate curves', 'Kurven annähern')}
                    </label>
                    {profileSource === 'fill' && <label className={layout.checkbox}>
                        <input type="checkbox" checked={closeGaps} disabled={busy} onChange={event => {
                            setCloseGaps(event.target.checked); select(0); conversionChanged();
                        }} />
                        {text('Close small gaps', 'Kleine Lücken schließen')}
                    </label>}
                    <div className={layout.inputs}>
                        <label>{centerlineOnly ? text('Span (mm)', 'Spannweite (mm)') : text('Width (mm)', 'Breite (mm)')}
                            <input type="number" min=".01" max="100000" step="any" value={width} disabled={busy}
                                aria-invalid={!validWidth} onChange={event => { setWidth(event.target.value); conversionChanged(); }} />
                        </label>
                        {approximate && <label>{text('Curve tolerance (mm)', 'Kurventoleranz (mm)')}
                            <input type="number" min=".01" max="10" step="any" value={tolerance} disabled={busy}
                                aria-invalid={!validTolerance} onChange={event => { setTolerance(event.target.value); conversionChanged(); }} />
                        </label>}
                        {repairGaps && <label>{text('Maximum gap (mm)', 'Maximale Lücke (mm)')}
                            <input type="number" min=".01" max="10" step="any" value={maxGap} disabled={busy}
                                aria-invalid={!validGap} onChange={event => { setMaxGap(event.target.value); conversionChanged(); }} />
                        </label>}
                    </div>
                    {!validWidth && <p role="status">{centerlineOnly ? text('Enter a span from 0.01 to 100000 mm.',
                        'Gib eine Spannweite von 0,01 bis 100000 mm ein.') : text('Enter a width from 0.01 to 100000 mm.',
                        'Gib eine Breite von 0,01 bis 100000 mm ein.')}</p>}
                    {approximate && !validTolerance && <p role="status">{text('Enter a curve tolerance from 0.01 to 10 mm.',
                        'Gib eine Kurventoleranz von 0,01 bis 10 mm ein.')}</p>}
                    {repairGaps && !validGap && <p role="status">{text('Enter a maximum gap from 0.01 to 10 mm.',
                        'Gib eine maximale Lücke von 0,01 bis 10 mm ein.')}</p>}
                </>}
                {!profile && artworkPreview && <div className={layout.comparison}>{artworkPreview}</div>}
                {profile && <>
                    <label>{regionLabel}
                        <select aria-label={regionLabel} value={needsRegionChoice ? '' : regionIndex} disabled={busy}
                            onChange={event => { select(Number(event.target.value)); requireRegionChoice(false); }}>
                            {needsRegionChoice && <option value="" disabled>
                                {text('Choose the source region…', 'Quellfläche auswählen…')}
                            </option>}
                            {preview.profiles.map((region, index) => <option key={index} value={index}>
                                {index + 1}{!centerlineOnly && ` · ${region.loops.length - 1} ${text('holes', 'Löcher')}`}
                                {region.approximated ? text(' · approximated', ' · angenähert') : ''}
                                {region.gapRepair ? text(' · closed gap', ' · Lücke geschlossen') : ''}
                            </option>)}
                        </select>
                    </label>
                    <div className={layout.comparison}>
                        {artworkPreview}
                        <figure>
                            <figcaption>{text('Selected CAD profile', 'Ausgewähltes CAD-Profil')}</figcaption>
                            <svg role="img" aria-label={centerlineOnly ? text('Open path preview', 'Vorschau des offenen Pfads') :
                                text('Closed profile preview', 'Vorschau der geschlossenen Fläche')}
                                viewBox={`${profile.origin[0] - markerRadius} ${-profile.origin[1] - profile.size[1] - markerRadius} ` +
                                    `${profile.size[0] + 2 * markerRadius} ${profile.size[1] + 2 * markerRadius}`}>
                                {profile.centerline ? <path className={layout.centerline} d={profile.centerline.d}
                                    vectorEffect="non-scaling-stroke" /> :
                                    <path fillRule="evenodd" d={profile.loops.map(drawingPath).join(' ')} />}
                                {profile.gapRepair?.edges.map(([[ax, ay], [bx, by]], index) =>
                                    <line key={index} className={layout.closingEdge} data-testid="bw-costume-closing-edge"
                                        x1={ax} y1={-ay} x2={bx} y2={-by} vectorEffect="non-scaling-stroke" />)}
                                {hasPlacement && <circle className={layout.anchorMarker} data-testid="bw-costume-placement-marker"
                                    cx={profile.origin[0] + (anchor === 'center' ? profile.size[0] / 2 : 0)}
                                    cy={-profile.origin[1] - (anchor === 'center' ? profile.size[1] / 2 : 0)}
                                    r={markerRadius * 0.75} vectorEffect="non-scaling-stroke" />}
                            </svg>
                        </figure>
                    </div>
                    {candidates.length > 1 && <p className={layout.selectionNote}>{text(
                        'Only the selected profile is sent to CAD.',
                        'Nur das ausgewählte Profil wird an CAD gesendet.')}</p>}
                    <label>{text('Sketch plane', 'Skizzenebene')}
                        <select aria-label={text('Sketch plane', 'Skizzenebene')} value={plane} disabled={busy || Boolean(matchingTarget)} onChange={event => setPlane(event.target.value)}>
                            {['XY', 'XZ', 'YZ'].map(value => <option key={value}>{value}</option>)}
                        </select>
                    </label>
                    {profile.approximated && <p>{text('Approximated curves use the straight segments shown in the preview.',
                        'Angenäherte Kurven verwenden die geraden Segmente aus der Vorschau.')}</p>}
                    {profile.gapRepair && <p>{text('Highlighted edges close gaps in the new sketch.',
                        'Die hervorgehobenen Kanten schließen Lücken in der neuen Skizze.')}</p>}
                    <details className={layout.placement}>
                        <summary>{text('Placement', 'Platzierung')}</summary>
                        <label>{text('Anchor', 'Anker')}
                            <select aria-label={text('Anchor', 'Anker')} value={anchor} disabled={busy}
                                onChange={event => setAnchor(event.target.value)}>
                                <option value="lower-left">{text('Lower-left corner', 'Linke untere Ecke')}</option>
                                <option value="center">{text('Center', 'Mittelpunkt')}</option>
                            </select>
                        </label>
                        <div className={layout.inputs}>
                            <label>{`${plane[0]} (mm)`}
                                <input type="number" min="-100000" max="100000" step="any" value={horizontal} disabled={busy}
                                    aria-invalid={!validCoordinate(placement.position[0])}
                                    onChange={event => setHorizontal(event.target.value)} />
                            </label>
                            <label>{`${plane[1]} (mm)`}
                                <input type="number" min="-100000" max="100000" step="any" value={vertical} disabled={busy}
                                    aria-invalid={!validCoordinate(placement.position[1])}
                                    onChange={event => setVertical(event.target.value)} />
                            </label>
                        </div>
                    </details>
                    {placementError && <p role="status">{placementError}</p>}
                    {validWidth && <p>{`${displayedSize} mm`}
                        {!placementError && ` · ${anchorLabel} ${plane[0]} ${placement.position[0]}, ${plane[1]} ${placement.position[1]} mm`}</p>}
                </>}
                {refresh ? <>
                    <label>{text('Target sketch', 'Zielskizze')}
                        <select aria-label={text('Target sketch', 'Zielskizze')} value={updateId} disabled={busy}
                            onChange={event => {
                                const target = refresh.entries.find(entry => entry.id === event.target.value);
                                if (target) selectTarget(target);
                            }}>
                            <option value="" disabled>{text('Choose a sketch', 'Skizze auswählen')}</option>
                            {refresh.entries.map((entry, index) => <option key={entry.id} value={entry.id}>
                                {`${index + 1}. ${entry.name} (${entry.plane})`}{entry.artworkSourceId ?
                                    text(' · linked', ' · verknüpft') : ''}
                            </option>)}
                        </select>
                    </label>
                    {needsRegionChoice && <p role="status">{text(
                        'Choose the source region before previewing the update.',
                        'Wähle die Quellfläche aus, bevor du die Aktualisierung prüfst.')}</p>}
                    {(!refresh.entries.length || (target && !matchingTarget && !needsRegionChoice)) && <p>{text(
                        'Choose a profile of the same sketch type.',
                        'Wähle ein Profil desselben Skizzentyps.')}</p>}
                    {matchingTarget && !matchingTarget.artworkSourceId && <label className={layout.checkbox}>
                        <input type="checkbox" checked={linkArtwork} disabled={busy}
                            onChange={event => setLinkArtwork(event.target.checked)} />
                        {text('Link to this costume or backdrop', 'Mit diesem Kostüm oder Bühnenbild verknüpfen')}
                    </label>}
                    {review && <div className={layout.review}>
                        <h3>{text('Review sketch update', 'Skizzenaktualisierung prüfen')}</h3>
                        <svg role="img" aria-label={text('Current and proposed sketch', 'Aktuelle und vorgeschlagene Skizze')}
                            viewBox={review.viewBox}>
                            <path className={layout.before} d={review.before} vectorEffect="non-scaling-stroke" />
                            <path className={layout.after} d={review.after} vectorEffect="non-scaling-stroke" />
                        </svg>
                        <p>{text('Dashed line shows the current sketch. Solid line shows the update.',
                            'Gestrichelt ist die aktuelle Skizze, durchgezogen die Aktualisierung.')}</p>
                        <p>{review.affectedBodies.length ? `${text('Affected solids', 'Betroffene Körper')} (${review.affectedBodies.length})` :
                            text('This sketch has no dependent solids.', 'Von dieser Skizze hängen keine Körper ab.')}</p>
                        {review.affectedBodies.length > 0 && <ul>{review.affectedBodies.map((name, index) =>
                            <li key={index}>{name}</li>)}</ul>}
                    </div>}
                    <div className={layout.updateActions}>
                        <button type="button" className={buttonClass} disabled={busy}
                            onClick={() => { setRefresh(null); setReview(null); setLinkArtwork(false); requireRegionChoice(false); setError(''); }}>
                            {text('Cancel update', 'Aktualisierung abbrechen')}
                        </button>
                        <button type="button" className={buttonClass} disabled={busy || !matchingTarget || needsRegionChoice || !validWidth || Boolean(placementError)}
                            onClick={review ? applyUpdate : previewUpdate}>
                            {review ? text('Apply sketch update', 'Skizze aktualisieren') : text('Preview update', 'Vorschau aktualisieren')}
                        </button>
                    </div>
                </> : (profile || snapshot && getCostumeSourceId(snapshot.costume)) && <>
                    {profile && <label className={layout.checkbox}>
                        <input type="checkbox" checked={linkArtwork} disabled={busy}
                            onChange={event => setLinkArtwork(event.target.checked)} />
                        {text('Link to this costume or backdrop', 'Mit diesem Kostüm oder Bühnenbild verknüpfen')}
                    </label>}
                    <div className={layout.updateActions}>
                        {profile && <button type="button" className={buttonClass} disabled={busy || !validWidth || Boolean(placementError)} onClick={send}>
                            {text('Add editable sketch', 'Bearbeitbare Skizze hinzufügen')}
                        </button>}
                        <button type="button" className={buttonClass} disabled={busy} onClick={chooseUpdate}>
                            {text('Update an existing sketch…', 'Vorhandene Skizze aktualisieren…')}
                        </button>
                    </div>
                </>}
            </>}
        </dialog>
    </>;
}


CostumePrecision.propTypes = {
    getCostume: PropTypes.func.isRequired,
    locale: PropTypes.string.isRequired,
    buttonClass: PropTypes.string.isRequired,
    icon: PropTypes.node.isRequired,
    labelClass: PropTypes.string.isRequired
};
