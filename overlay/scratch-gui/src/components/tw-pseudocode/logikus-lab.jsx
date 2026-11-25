/* eslint-disable react/jsx-no-bind, max-len */
import React, {useEffect, useMemo, useRef, useState} from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import {CONTACT_ROWS, ENDPOINTS, createEmptyProgram, evaluateProgram} from '../../lib/logikus/model.js';
import {LOGIKUS_PRESETS, getPreset} from '../../lib/logikus/presets.js';
import {createWorkspace, validateWorkspace, LOGIKUS_WORKSPACE_MAX_BYTES} from '../../lib/logikus/workspace.js';
import {inspectProgram} from '../../lib/logikus/inspection.js';
import {inspectRailway} from '../../lib/logikus/railway.js';
import LogikusRailway, {railwayViolationText} from './logikus-railway.jsx';
import downloadBlob from '../../lib/download-blob.js';
import styles from './logikus-lab.css';

const copy = (value, de) => value[de ? 'de' : 'en'] || value.en;
const clone = value => JSON.parse(JSON.stringify(value));
const point = node => {
    const lamp = /^L(\d)$/.exec(node);
    if (lamp) return {x: 85 + Number(lamp[1]) * 96, y: 35};
    if (node === 'Q') return {x: 85, y: 575};
    if (node === 'Ta') return {x: 469, y: 575};
    if (node === 'Tb') return {x: 661, y: 575};
    const contact = /^S(\d)\.([A-K])([ab])$/.exec(node);
    return {x: 85 + Number(contact[1]) * 96 + (contact[3] === 'a' ? -23 : 23),
        y: 126 + CONTACT_ROWS.indexOf(contact[2]) * 42};
};

function WiringBoard ({program, result, selectedLamp, pending, onTerminal, de}) {
    const powered = new Set(result.poweredNodes);
    const path = new Set(result.paths[selectedLamp] || []);
    const poweredWires = new Set(result.poweredWires);
    return <div className={styles.boardScroll}>
        <div className={styles.board} aria-label={de ? 'Steckfeld mit zehn Schaltern' : 'Ten-switch patch board'}>
            <svg width="1034" height="620" viewBox="0 0 1034 620" aria-hidden="true">
                {Array.from({length: 10}, (_, i) => <g key={i}>
                    <text x={85 + i * 96} y="85" textAnchor="middle" className={styles.boardHeading}>{`S${i} · ${result.inputs.switches[i] ? 1 : 0}`}</text>
                    {Array.from({length: 5}, (__, bank) => <rect key={bank} x={45 + i * 96} y={108 + bank * 84}
                        width="80" height="77" rx="8" fill={bank % 2 ? '#f1f5f9' : '#e8eef5'} />)}
                </g>)}
                {result.closedContacts.map(edge => {
                    const a = point(edge.from), b = point(edge.to);
                    return <line key={edge.from} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                        stroke={powered.has(edge.from) ? '#b45309' : '#94a3b8'} strokeWidth="5" />;
                })}
                {result.inputs.button && <line x1="469" y1="575" x2="661" y2="575" stroke="#b45309" strokeWidth="5" />}
                {program.wires.map(wire => {
                    const a = point(wire.from), b = point(wire.to);
                    const bend = Math.min(44, Math.max(18, Math.abs(a.y - b.y) / 4));
                    return <path key={wire.id} d={`M ${a.x},${a.y} C ${a.x + bend},${a.y - bend} ${b.x - bend},${b.y - bend} ${b.x},${b.y}`}
                        fill="none" stroke={path.has(wire.id) ? '#7c3aed' : poweredWires.has(wire.id) ? '#b45309' : '#94a3b8'}
                        strokeWidth={path.has(wire.id) ? 4 : 2} opacity={path.has(wire.id) ? 1 : 0.7} />;
                })}
                <text x="85" y="611" textAnchor="middle" className={styles.boardHeading}>{de ? 'Q · Quelle' : 'Q · Supply'}</text>
                <text x="565" y="611" textAnchor="middle" className={styles.boardHeading}>{de ? 'Ta / Tb · Tasterkontakt' : 'Ta / Tb · Test contact'}</text>
            </svg>
            {ENDPOINTS.map(node => {
                const p = point(node);
                return <button key={node} type="button" className={styles.terminal}
                    data-powered={powered.has(node)} data-selected={pending === node}
                    style={{left: p.x - 18, top: p.y - 13}}
                    title={node} aria-label={`${de ? 'Anschluss' : 'Terminal'} ${node}`}
                    aria-pressed={pending === node} onClick={() => onTerminal(node)}>
                    {node.includes('.') ? node.split('.')[1] : node}
                </button>;
            })}
        </div>
    </div>;
}

export default function LogikusLab ({workspace, button, locale, error, onChange, onTest, onInstall, onClose, onError}) {
    const de = /^de/i.test(locale || 'en');
    const say = (en, german) => de ? german : en;
    const [tab, setTab] = useState('operate');
    const [selectedLamp, setSelectedLamp] = useState(0);
    const [pending, setPending] = useState(null);
    const [from, setFrom] = useState('Q');
    const [to, setTo] = useState('S0.Aa');
    const [history, setHistory] = useState([]);
    const [future, setFuture] = useState([]);
    const [inspectionReport, setInspection] = useState(null);
    const [page, setPage] = useState(0);
    const [showHint, setShowHint] = useState(false);
    const [notice, setNotice] = useState('');
    const modal = useRef(null);
    const close = useRef(null);
    const importRef = useRef(null);
    const currentProgram = useRef(workspace.program);
    const currentGoal = useRef(workspace.presetId);
    const importGeneration = useRef(0);
    const alive = useRef(true);
    const testOwners = useRef(new Set());
    const callbacks = useRef({onClose, onTest});
    callbacks.current = {onClose, onTest};
    const preset = LOGIKUS_PRESETS.find(item => item.id === workspace.presetId);
    const isRailway = workspace.presetId === 'railway';
    // A prop change renders before effects clear the old report. Bind reports
    // to both wiring and goal, while keeping them valid when only inputs move.
    const inspectionSignature = JSON.stringify([workspace.presetId, workspace.program]);
    const inspection = inspectionReport?.signature === inspectionSignature ? inspectionReport.result : null;
    const brief = preset ? copy(preset.copy, de) : null;
    const result = useMemo(() => evaluateProgram(workspace.program, {switches: workspace.switches, button}),
        [workspace.program, workspace.switches, button]);

    useEffect(() => {
        alive.current = true;
        const lastFocus = document.activeElement;
        close.current?.focus();
        const key = event => {
            if (event.key === 'Escape') { event.preventDefault(); callbacks.current.onClose(); }
            if (event.key !== 'Tab') return;
            const nodes = [...(modal.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), select, textarea, summary, a[href], [tabindex="0"]') || [])]
                .filter(node => node.getClientRects().length);
            if (!nodes.length) return;
            const first = nodes[0], last = nodes[nodes.length - 1];
            if (event.shiftKey && (document.activeElement === first || !modal.current.contains(document.activeElement))) {
                event.preventDefault(); last.focus();
            } else if (!event.shiftKey && (document.activeElement === last || !modal.current.contains(document.activeElement))) {
                event.preventDefault(); first.focus();
            }
        };
        document.addEventListener('keydown', key);
        return () => { alive.current = false; importGeneration.current++;
            document.removeEventListener('keydown', key); lastFocus?.focus?.(); };
    }, []);

    useEffect(() => { if (!button) testOwners.current.clear(); }, [button]);

    useEffect(() => {
        // Imported/replaced projects invalidate reports and any half-drawn wire.
        if (currentGoal.current !== workspace.presetId ||
            JSON.stringify(currentProgram.current) !== JSON.stringify(workspace.program)) {
            setInspection(null); setPending(null); setNotice('');
            currentProgram.current = workspace.program;
            currentGoal.current = workspace.presetId;
        }
        importGeneration.current++;
    }, [workspace]);

    const act = callback => {
        try { return callback(); } catch (failure) { onError(failure); return null; }
    };
    const change = next => act(() => {
        const checked = validateWorkspace(next);
        onTest(false);
        onChange(checked);
        setHistory(items => [...items.slice(-49), clone(workspace)]);
        setFuture([]);
        setInspection(null); setPending(null);
    });
    const editProgram = program => change({...workspace, program});
    const choosePreset = id => {
        const selected = getPreset(id);
        change(createWorkspace({program: selected.program, presetId: selected.id, controller: workspace.controller}));
        setSelectedLamp(0); setShowHint(false); setTab('operate');
    };
    const undo = () => {
        if (!history.length) return;
        const next = history[history.length - 1];
        setFuture(items => [...items, clone(workspace)]);
        setHistory(items => items.slice(0, -1));
        act(() => onChange({...next, controller: workspace.controller}));
        onTest(false);
    };
    const redo = () => {
        if (!future.length) return;
        const next = future[future.length - 1];
        setHistory(items => [...items, clone(workspace)]);
        setFuture(items => items.slice(0, -1));
        act(() => onChange({...next, controller: workspace.controller}));
        onTest(false);
    };
    const connect = (a, b) => act(() => {
        if (a === b) throw new Error(say('Choose two different terminals.', 'Wähle zwei verschiedene Anschlüsse.'));
        const exists = workspace.program.wires.find(w => (w.from === a && w.to === b) || (w.from === b && w.to === a));
        if (exists) throw new Error(say('These terminals already have a wire.', 'Diese Anschlüsse sind bereits verdrahtet.'));
        let id = 1;
        const ids = new Set(workspace.program.wires.map(w => w.id));
        while (ids.has(`w${id}`)) id++;
        editProgram({...workspace.program, wires: [...workspace.program.wires, {id: `w${id}`, from: a, to: b}]});
        setPending(null);
    });
    const selectTerminal = node => {
        if (!pending) { setPending(node); setFrom(node); }
        else if (pending === node) setPending(null);
        else { setTo(node); connect(pending, node); }
    };
    const setInputs = (switches, down = false) => act(() => {
        onChange({...workspace, switches: switches.map(Number)});
        onTest(down);
    });
    const toggleSwitch = index => {
        const next = [...workspace.switches]; next[index] = Number(!next[index]); setInputs(next);
    };
    const showWiring = () => {
        setTab('wire');
        // Inspect/replay controls disappear with their panel. Keep keyboard
        // focus inside the dialog at the requested view instead of on body.
        modal.current?.querySelector('#logikus-tab-wire')?.focus();
    };
    const pressTest = source => {
        if (testOwners.current.has(source)) return;
        testOwners.current.add(source);
        onTest(true);
    };
    const releaseTest = source => {
        testOwners.current.delete(source);
        onTest(testOwners.current.size > 0);
    };
    const testAll = () => act(() => {
        const checked = isRailway ? inspectRailway(workspace.program) : inspectProgram(workspace.program, preset?.program);
        setInspection({signature: inspectionSignature, result: checked}); setPage(0); setTab('table');
        window.dispatchEvent(new CustomEvent('bw-logikus-tested', {detail: {
            presetId: workspace.presetId, states: checked.rows.length,
            matched: checked.matched, goal: !!preset,
            ...(isRailway ? {safe: checked.safeCount} : {})
        }}));
    });
    const exportJson = async () => {
        try {
            await downloadBlob('brickwright-logikus.json', new Blob([JSON.stringify(workspace, null, 2)], {type: 'application/json'}));
            setNotice(say('Design exported.', 'Entwurf exportiert.'));
        } catch (failure) { onError(failure); }
    };
    const importJson = async event => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        const request = ++importGeneration.current;
        try {
            if (file.size > LOGIKUS_WORKSPACE_MAX_BYTES) throw new Error(say('This Logikus file is too large.', 'Diese Logikus-Datei ist zu groß.'));
            const text = await file.text();
            if (!alive.current || request !== importGeneration.current) return;
            const next = validateWorkspace(JSON.parse(text));
            // Importing wiring cannot opt into creating/rebinding controls.
            change({...next, controller: workspace.controller});
        } catch (failure) { if (alive.current && request === importGeneration.current) onError(failure); }
    };
    const trace = result.paths[selectedLamp];
    const lampName = workspace.program.lampLabels[selectedLamp] || `L${selectedLamp}`;

    return ReactDOM.createPortal(<div className={styles.backdrop}>
        <section ref={modal} role="dialog" aria-modal="true" aria-labelledby="bw-logikus-title"
            className={styles.lab} data-testid="bw-logikus-lab">
            <header className={styles.header}>
                <div><span className={styles.eyebrow}>{say('BRICKWRIGHT / EXPERIMENTS', 'BRICKWRIGHT / EXPERIMENTE')}</span>
                    <h2 id="bw-logikus-title">{say('Logikus Lab', 'Logikus-Labor')}</h2>
                    <p>{say('The wires are the program. Follow a path, light a lamp.', 'Die Drähte sind das Programm. Verfolge einen Weg, bringe eine Lampe zum Leuchten.')}</p></div>
                <button ref={close} type="button" className={styles.close} onClick={onClose}>{say('Close', 'Schließen')}</button>
            </header>
            <div className={styles.toolbar}>
                <div className={styles.tabs} role="tablist" aria-label={say('Lab views', 'Laboransichten')}>
                    {[['operate', 'Operate', 'Bedienen'], ['wire', 'Wire', 'Verdrahten'], ['table', 'Truth table', 'Wahrheitstabelle']].map(([id, en, german]) =>
                        <button key={id} type="button" role="tab" aria-selected={tab === id}
                            aria-controls={`logikus-${id}`} id={`logikus-tab-${id}`} onClick={() => setTab(id)}>{say(en, german)}</button>)}
                </div>
                <button type="button" onClick={undo} disabled={!history.length}>{say('Undo', 'Rückgängig')}</button>
                <button type="button" onClick={redo} disabled={!future.length}>{say('Redo', 'Wiederholen')}</button>
                <div className={styles.toolbarSpacer} />
                <button type="button" onClick={() => importRef.current.click()}>{say('Import', 'Importieren')}</button>
                <button type="button" onClick={exportJson}>{say('Export', 'Exportieren')}</button>
                <button type="button" className={styles.primary} onClick={onInstall}>{say('Use in Widgets', 'In Widgets nutzen')}</button>
                <input ref={importRef} type="file" accept=".json,application/json" hidden onChange={importJson} />
            </div>
            {error && <div role="alert" className={styles.error}>{error}</div>}
            {notice && <div role="status" className={styles.notice}>{notice}</div>}
            <div className={styles.body}>
                <aside className={styles.sidebar}>
                    <h3>{say('Choose an experiment', 'Experiment wählen')}</h3>
                    <nav aria-label={say('Experiments', 'Experimente')} className={styles.presets}>
                        {LOGIKUS_PRESETS.map(item => <button type="button" key={item.id}
                            data-active={workspace.presetId === item.id} aria-pressed={workspace.presetId === item.id}
                            onClick={() => choosePreset(item.id)}>{copy(item.copy, de).title}</button>)}
                        <button type="button" data-active={!workspace.presetId}
                            onClick={() => { change(createWorkspace({program: createEmptyProgram(), controller: workspace.controller})); setTab('wire'); }}>
                            {say('Blank patch board', 'Leeres Steckfeld')}</button>
                    </nav>
                    {brief && <div className={styles.challenge}>
                        <h3>{say('Try this', 'Probiere es aus')}</h3><p>{brief.challenge}</p>
                        <button type="button" onClick={() => setShowHint(value => !value)} aria-expanded={showHint}>
                            {showHint ? say('Hide hint', 'Hinweis ausblenden') : say('Show hint', 'Hinweis zeigen')}</button>
                        {showHint && <p>{brief.hint}</p>}
                    </div>}
                    <details className={styles.about}><summary>{say('How the original worked', 'So funktionierte das Original')}</summary>
                        <p>{say('The 1968 Logikus used ten mechanical sliders. Each moved five independent banks of paired contacts together. At 1 the upper contacts A, C, E, G, I close; at 0 the lower B, D, F, H, K close. Each socket group is one node here.',
                            'Der Logikus von 1968 hatte zehn mechanische Schieber. Jeder bewegte fünf unabhängige Kontaktgruppen gemeinsam. Bei 1 schließen A, C, E, G, I; bei 0 schließen B, D, F, H, K. Jede Buchsengruppe wird hier als ein Knoten dargestellt.')}</p>
                        <p>{say('Series paths give AND; parallel paths give OR; the opposite contacts give NOT. The return from each lamp is inside the machine. There is no CPU, clock, or automatic memory. This lab models ideal contacts, not voltage or current.',
                            'Reihenwege bilden UND, Parallelwege ODER, die Gegenkontakte NICHT. Der Rückweg jeder Lampe liegt im Gehäuse. Es gibt weder CPU noch Takt oder automatischen Speicher. Dieses Labor modelliert ideale Kontakte, keine Spannung oder Stromstärke.')}</p>
                        <a href="https://www.logikus.info/" target="_blank" rel="noreferrer">{say('Original manuals', 'Originalhandbücher')}</a>
                        <a href="https://www.lauff.org/Logikus.pdf" target="_blank" rel="noreferrer">{say('Lauff’s simulator guide', 'Lauffs Simulator-Anleitung')}</a>
                    </details>
                </aside>
                <main className={styles.main}>
                    <div className={styles.experimentHeading}><div><h3>{workspace.program.title}</h3>
                        <p>{brief?.summary || say('Connect Q to a lamp through contacts of your choice.', 'Verbinde Q über selbst gewählte Kontakte mit einer Lampe.')}</p></div>
                        <button type="button" className={styles.primary} onClick={testAll}>{say('Test all states', 'Alle Zustände testen')}</button></div>
                    {isRailway && tab === 'operate' && <LogikusRailway result={result} selectedLamp={selectedLamp}
                        onSwitch={toggleSwitch} onSelectLamp={setSelectedLamp} onInspect={showWiring} de={de} />}
                    <div className={styles.lamps} aria-label={say('Lamp outputs', 'Lampenausgänge')}>
                        {result.lamps.map((on, i) => <button type="button" key={i}
                            className={styles.lamp} data-on={on} data-selected={selectedLamp === i}
                            aria-pressed={selectedLamp === i} aria-label={`L${i} ${workspace.program.lampLabels[i]}: ${on ? say('on', 'an') : say('off', 'aus')}`}
                            onClick={() => setSelectedLamp(i)}>
                            <span className={styles.lampBulb} aria-hidden="true" /><b>{`L${i}`}</b>
                            <span>{workspace.program.lampLabels[i]}</span><small>{on ? say('ON', 'AN') : say('OFF', 'AUS')}</small>
                        </button>)}
                    </div>
                    <div className={styles.switches} aria-label={say('Switch inputs', 'Schaltereingänge')}>
                        {workspace.switches.map((value, i) => <button key={i} type="button" role="switch"
                            aria-checked={!!value} aria-label={`S${i} ${workspace.program.switchLabels[i]}`}
                            className={styles.switch} data-on={!!value} onClick={() => toggleSwitch(i)}><span>{`S${i}`}</span><span className={styles.switchTrack}><b>{value ? '1' : '0'}</b></span>
                            <strong>{workspace.program.switchLabels[i]}</strong></button>)}
                    </div>
                    <div className={styles.inputTools}>
                        <button type="button" className={styles.testButton} data-on={button} aria-pressed={button}
                            onPointerDown={event => {
                                if (event.button !== 0 || event.isPrimary === false) return;
                                event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
                                pressTest(`pointer:${event.pointerId}`);
                            }}
                            onPointerUp={event => releaseTest(`pointer:${event.pointerId}`)}
                            onPointerCancel={event => releaseTest(`pointer:${event.pointerId}`)}
                            onLostPointerCapture={event => releaseTest(`pointer:${event.pointerId}`)}
                            onBlur={() => { testOwners.current.clear(); onTest(false); }}
                            onKeyDown={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); pressTest(`key:${event.key}`); } }}
                            onKeyUp={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); releaseTest(`key:${event.key}`); } }}>
                            {button ? say('Test contact closed', 'Tasterkontakt geschlossen') : say('Hold Test', 'Test gedrückt halten')}</button>
                        <button type="button" onClick={() => setInputs(Array(10).fill(0))}>{say('Reset inputs', 'Eingänge zurücksetzen')}</button>
                        <span>{say('Outputs respond immediately. The Test key matters only when Ta/Tb is wired.', 'Ausgänge reagieren sofort. Der Taster wirkt nur, wenn Ta/Tb verdrahtet ist.')}</span>
                    </div>

                    {tab === 'operate' && <section role="tabpanel" id="logikus-operate" aria-labelledby="logikus-tab-operate" className={styles.operation}>
                        <h3>{say('Why is this lamp on?', 'Warum leuchtet diese Lampe?')}</h3>
                        <p className={styles.traceTitle}><strong>{`L${selectedLamp} · ${lampName}`}</strong>{' — '}
                            {trace ? say('a complete path reaches this lamp.', 'ein geschlossener Weg erreicht diese Lampe.') :
                                say('no closed path from Q reaches this lamp.', 'kein geschlossener Weg von Q erreicht diese Lampe.')}</p>
                        {trace ? <div className={styles.path}>{trace.map(id => {
                            const wire = workspace.program.wires.find(w => w.id === id);
                            return wire ? <span key={id}>{wire.from}<b> ↔ </b>{wire.to}</span> : null;
                        })}</div> : <p>{say('Change an input, or inspect the contacts in Wire view. Open contacts interrupt the route.', 'Ändere einen Eingang oder prüfe die Kontakte unter Verdrahten. Offene Kontakte unterbrechen den Weg.')}</p>}
                        <button type="button" onClick={showWiring}>{say('Inspect the wiring', 'Verdrahtung ansehen')}</button>
                        <div className={styles.explainer}><div><h4>{say('Predict', 'Vorhersagen')}</h4><p>{say('Pick an input combination. Which lamps should light?', 'Wähle eine Eingangskombination. Welche Lampen sollten leuchten?')}</p></div>
                            <div><h4>{say('Experiment', 'Experimentieren')}</h4><p>{say('Flip the switches. Select a lamp to reveal its route.', 'Betätige die Schalter. Wähle eine Lampe und entdecke ihren Weg.')}</p></div>
                            <div><h4>{say('Remix', 'Verändern')}</h4><p>{say('Move a wire, then test every state against the example.', 'Versetze einen Draht und prüfe alle Zustände gegen das Beispiel.')}</p></div></div>
                    </section>}

                    {tab === 'wire' && <section role="tabpanel" id="logikus-wire" aria-labelledby="logikus-tab-wire">
                        <div className={styles.legend}><span>{say('Amber: connected to Q', 'Bernstein: mit Q verbunden')}</span>
                            <span>{say('Purple: selected lamp’s path', 'Violett: Weg zur gewählten Lampe')}</span></div>
                        <p className={styles.hint}>{say('Click two terminals to add a wire. Crossings never make a junction. Amber marks source connectivity, not measured current.', 'Klicke zwei Anschlüsse an, um einen Draht hinzuzufügen. Kreuzungen sind keine Verbindungen. Bernstein zeigt die Verbindung zur Quelle, keine gemessene Stromstärke.')}</p>
                        <div className={styles.connect}>
                            <label>{say('From', 'Von')}<select value={from} onChange={event => setFrom(event.target.value)}>{ENDPOINTS.map(node => <option key={node}>{node}</option>)}</select></label>
                            <label>{say('To', 'Nach')}<select value={to} onChange={event => setTo(event.target.value)}>{ENDPOINTS.map(node => <option key={node}>{node}</option>)}</select></label>
                            <button type="button" onClick={() => connect(from, to)}>{say('Add wire', 'Draht hinzufügen')}</button>
                            <span role="status">{pending ? `${say('Connect from', 'Verbinden von')} ${pending}` : say('Choose a terminal', 'Anschluss wählen')}</span>
                            {pending && <button type="button" onClick={() => setPending(null)}>{say('Cancel', 'Abbrechen')}</button>}
                        </div>
                        <WiringBoard program={workspace.program} result={result} selectedLamp={selectedLamp} pending={pending} onTerminal={selectTerminal} de={de} />
                        <details className={styles.wireList}><summary>{`${workspace.program.wires.length} ${say('wires · edit connections', 'Drähte · Verbindungen bearbeiten')}`}</summary>
                            {workspace.program.wires.map(wire => <div key={wire.id}><code>{wire.from} ↔ {wire.to}</code>
                                <button type="button" aria-label={`${say('Remove wire', 'Draht entfernen')} ${wire.from} ${wire.to}`}
                                    onClick={() => editProgram({...workspace.program, wires: workspace.program.wires.filter(w => w.id !== wire.id)})}>{say('Remove', 'Entfernen')}</button></div>)}
                        </details>
                    </section>}

                    {tab === 'table' && <section role="tabpanel" id="logikus-table" aria-labelledby="logikus-tab-table">
                        {!inspection ? <div className={styles.emptyTable}><h3>{say('Check every possibility', 'Prüfe jede Möglichkeit')}</h3>
                            <p>{say('Test all states generates the complete table. For an example, it also checks your wiring against the original goal and finds a counterexample if it differs.', 'Alle Zustände testen erstellt die vollständige Tabelle. Bei einem Beispiel prüft es deine Verdrahtung auch gegen das ursprüngliche Ziel und findet bei Abweichungen ein Gegenbeispiel.')}</p>
                            <button type="button" onClick={testAll}>{say('Test all states', 'Alle Zustände testen')}</button></div> : <>
                            {isRailway && <div className={styles.railwayReport}>
                                <div role="status" className={styles.verdict} data-pass={!inspection.safetyCounterexample} data-testid="railway-safety-result">
                                    <div><span>{say('Safety checks', 'Sicherheitsprüfungen')}</span>
                                        <strong>{`${inspection.safeCount} / ${inspection.rows.length} ${say('states have no unsafe permissions', 'Zustände ohne unsichere Freigabe')}`}</strong></div>
                                    {inspection.safetyCounterexample && <button type="button" onClick={() => {
                                        const row = inspection.safetyCounterexample;
                                        setInputs(row.switches, row.button);
                                        const incorrectSignal = row.different.find(index => index < 2 && row.lamps[index]);
                                        setSelectedLamp(incorrectSignal ?? (row.lamps[0] ? 0 : 1)); showWiring();
                                    }}>{say('Show unsafe state', 'Unsicheren Zustand zeigen')}</button>}
                                </div>
                                {inspection.safetyCounterexample && <p className={styles.hint}>
                                    {inspection.safetyCounterexample.violations.map(code => railwayViolationText(code, de)).join(' ')}</p>}
                                <p className={styles.hint}>{say('An always-red circuit can pass these safety checks and still fail the target behavior. Both requests must give both red; a clear route requested alone must get green.',
                                    'Eine immer rote Schaltung kann diese Sicherheitsprüfungen bestehen und trotzdem das Ziel verfehlen. Bei zwei Anforderungen müssen beide Signale rot sein; ein einzeln angeforderter freier Fahrweg muss grün erhalten.')}</p>
                            </div>}
                            <div role="status" className={styles.verdict} data-pass={!inspection.counterexample} data-testid="logikus-target-result">
                                <div>{isRailway && <span>{say('Target behavior', 'Zielverhalten')}</span>}
                                <strong>{preset ? `${inspection.matched} / ${inspection.rows.length} ${say('states match the goal', 'Zustände entsprechen dem Ziel')}` :
                                    `${inspection.rows.length} ${say('states enumerated', 'Zustände aufgelistet')}`}</strong></div>
                                {inspection.counterexample && <button type="button" onClick={() => {
                                    setInputs(inspection.counterexample.switches, inspection.counterexample.button);
                                    setSelectedLamp(inspection.counterexample.different[0]); showWiring();
                                }}>{say('Show counterexample', 'Gegenbeispiel zeigen')}</button>}
                            </div>
                            <p className={styles.hint}>{say('All relevant inputs are included, even a switch removed from the goal circuit. Select a row to try it; a Test = 1 row holds the test contact until the next input or reset.', 'Alle relevanten Eingänge sind enthalten, auch ein aus der Zielschaltung entfernter Schalter. Wähle eine Zeile zum Ausprobieren; bei Test = 1 bleibt der Tasterkontakt bis zur nächsten Eingabe oder zum Zurücksetzen geschlossen.')}</p>
                            <div className={styles.tableScroll}><table><thead><tr><th>{say('Try', 'Testen')}</th>
                                {inspection.switchIndices.map(i => <th key={i}>{`S${i}`}</th>)}{inspection.button && <th>Test</th>}
                                {Array.from({length: 10}, (_, i) => <th key={i}>{`L${i}`}</th>)}{isRailway && <th>{say('Safety', 'Sicherheit')}</th>}{preset && <th>{say('Goal', 'Ziel')}</th>}</tr></thead>
                                <tbody>{inspection.rows.slice(page * 16, page * 16 + 16).map((row, i) => <tr key={page * 16 + i} data-match={row.matches}>
                                    <td><button type="button" onClick={() => setInputs(row.switches, row.button)}>{page * 16 + i + 1}</button></td>
                                    {inspection.switchIndices.map(index => <td key={index}>{Number(row.switches[index])}</td>)}{inspection.button && <td>{Number(row.button)}</td>}
                                    {row.lamps.map((on, index) => <td key={index} className={row.different.includes(index) ? styles.mismatch : undefined}
                                        title={row.expected ? `${say('Expected', 'Erwartet')}: ${Number(row.expected[index])}` : undefined}>{Number(on)}</td>)}
                                    {isRailway && <td className={row.safe ? undefined : styles.mismatch}
                                        title={row.violations.map(code => railwayViolationText(code, de)).join(' ')}>
                                        {row.safe ? '✓' : say('Unsafe', 'Unsicher')}</td>}
                                    {preset && <td>{row.matches ? '✓' : row.different.map(index => `L${index}=${Number(row.expected[index])}`).join(', ')}</td>}
                                </tr>)}</tbody></table></div>
                            <div className={styles.pagination}><button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>{say('Previous', 'Zurück')}</button>
                                <span>{page + 1} / {Math.ceil(inspection.rows.length / 16)}</span>
                                <button type="button" disabled={(page + 1) * 16 >= inspection.rows.length} onClick={() => setPage(page + 1)}>{say('Next', 'Weiter')}</button></div>
                        </>}
                    </section>}

                    <details className={styles.labels}><summary>{say('Rename the panel, switches and lamps', 'Panel, Schalter und Lampen benennen')}</summary>
                        <label>{say('Panel title', 'Paneltitel')}<input key={workspace.program.title} defaultValue={workspace.program.title} maxLength="80"
                            onBlur={event => { if (event.target.value !== workspace.program.title) editProgram({...workspace.program, title: event.target.value}); }} /></label>
                        <div>{Array.from({length: 10}, (_, i) => <div key={i}>
                            {['switchLabels', 'lampLabels'].map((field, index) => <label key={field}>{`${index ? 'L' : 'S'}${i}`}
                                <input key={workspace.program[field][i]} defaultValue={workspace.program[field][i]} maxLength="40"
                                    onBlur={event => { if (event.target.value === workspace.program[field][i]) return;
                                        const labels = [...workspace.program[field]]; labels[i] = event.target.value;
                                        editProgram({...workspace.program, [field]: labels}); }} /></label>)}
                        </div>)}</div>
                    </details>
                    <p className={styles.footer}>{say('Wiring and switch settings travel with your Brickwright project. Export also makes a standalone Logikus file. Widgets keep running when you close this lab.', 'Verdrahtung und Schalterstellungen werden im Brickwright-Projekt gespeichert. Export erstellt zusätzlich eine eigene Logikus-Datei. Widgets arbeiten nach dem Schließen dieses Labors weiter.')}</p>
                </main>
            </div>
        </section>
    </div>, document.body);
}

LogikusLab.propTypes = {workspace: PropTypes.object.isRequired, button: PropTypes.bool, locale: PropTypes.string,
    error: PropTypes.string, onChange: PropTypes.func.isRequired, onTest: PropTypes.func.isRequired,
    onInstall: PropTypes.func.isRequired, onClose: PropTypes.func.isRequired, onError: PropTypes.func.isRequired};
