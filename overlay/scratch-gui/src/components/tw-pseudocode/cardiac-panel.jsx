// SPDX-License-Identifier: BSD-3-Clause
import React, {useContext, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import PropTypes from 'prop-types';
import {CardiacSurfaces} from './cardiac-surfaces.js';
import {CARDIAC_EXAMPLES} from '../../lib/cardiac-examples.js';
import {cardiacWord as word, cardiacAddress as addr, cardiacDebugView} from '../../lib/cardiac-debug-view.js';
import styles from './cardiac-panel.css';

const COPY = {
    en: {
        subtitle: '100 decimal words · 10 instructions · you can follow every change',
        program: 'Program', source: 'CARDIAC source or addressed decimal listing',
        load: 'Assemble & load', runSource: 'Run source + cards', run: 'Continue', pause: 'Pause', step: 'One instruction', reset: 'Reset loaded program',
        save: 'Save workspace', open: 'Open source / workspace', listing: 'Export listing', examples: 'Example program',
        sourceHint: 'Labels, ORG, ENTRY and DAT are supported. Loading replaces live memory and clears the trays. Continue keeps the current machine state.',
        dirty: 'This draft differs from the loaded program.', empty: 'No program loaded',
        loading: 'Opening CARDIAC…', state: 'State', running: 'Running', paused: 'Paused', halted: 'Halted (HRS)', waiting: 'Waiting for an input card',
        steps: 'Completed instructions', pc: 'Program counter', acc: 'Accumulator', ir: 'Instruction register',
        cards: 'Input cards', deck: 'Signed decimal input deck', enqueue: 'Queue cards', sample: 'Sample circuit once',
        manual: 'Manual cards', circuit: 'Circuit adapter', inputMode: 'Input source', queue: 'Reader queue', output: 'Output tray',
        noCards: 'Empty', ioHint: 'The modern adapter maps 0–5 V to 000–999. An output word 001 drives 5 V; every other output drives 0 V. Sampling is deliberate.',
        needsCircuit: 'Open the night-light circuit example to connect IN and OUT.',
        memory: 'Memory: 00–99', selected: 'Selected cell', write: 'Write live cell', setPc: 'Set PC', breakpoint: 'Toggle breakpoint',
        memoryHint: 'Select a cell to inspect it. 00 is fixed at 001; JMP writes its return instruction into 99. Live edits do not change your source.',
        current: 'Next instruction', changed: 'Written by the last instruction', read: 'Read by the last instruction',
        sourceDiffers: 'Live memory differs from the source here. The displayed memory is authoritative.',
        sourceLine: 'Source line', latest: 'Last completed instruction', reads: 'Read', writes: 'Wrote', branch: 'Branch', taken: 'taken', notTaken: 'not taken',
        prediction: 'You are the processor', predictHint: 'Predict the next PC and accumulator, then execute one instruction and compare.',
        predictPc: 'Predicted next PC (00–99)', predictAcc: 'Predicted next accumulator (−9999…9999)', check: 'Step & compare',
        correct: 'Your prediction matches.', different: 'Compare your prediction with the actual state below.',
        missing: 'Enter both predictions as decimal integers.', invalid: 'Use a two-digit PC and a signed four-digit accumulator.',
        waitPrediction: 'No instruction completed. Add an input card if the machine is waiting.',
        reference: 'Instruction guide', original: 'Original opcode order · Brickwright CARDIAC v1',
        mappings: ['INP: read a card into memory', 'CLA: load memory into ACC', 'ADD: add memory to ACC', 'TAC: branch if ACC < 0',
            'SFT: shift left, then right (decimal)', 'OUT: output a memory word', 'STO: store ACC’s low three digits',
            'SUB: subtract memory from ACC', 'JMP: save return in 99, then jump', 'HRS: halt and set PC to operand'],
        limits: 'Memory holds −999…999; ACC holds −9999…9999. Overflow keeps the low digits. An empty reader waits without inventing a zero. Negative instruction words are skipped.',
        clearOutput: 'Clear output tray', error: 'CARDIAC', loaded: 'Loaded program', modern: 'Modern Brickwright I/O adapter',
        threshold: 'Night-light: sample < 500 → 001; sample ≥ 500 → 000.', value: 'Cell value (−999…999)'
    },
    de: {
        subtitle: '100 Dezimalwörter · 10 Befehle · jede Änderung ist nachvollziehbar',
        program: 'Programm', source: 'CARDIAC-Quelltext oder adressiertes Dezimallisting',
        load: 'Assemblieren & laden', runSource: 'Quelle + Karten starten', run: 'Fortsetzen', pause: 'Pause', step: 'Ein Befehl', reset: 'Geladenes Programm zurücksetzen',
        save: 'Arbeitsstand speichern', open: 'Quelle / Arbeitsstand öffnen', listing: 'Listing exportieren', examples: 'Beispielprogramm',
        sourceHint: 'Labels, ORG, ENTRY und DAT sind möglich. Laden ersetzt den Speicher und leert die Ablagen. Fortsetzen behält den Maschinenzustand.',
        dirty: 'Dieser Entwurf unterscheidet sich vom geladenen Programm.', empty: 'Kein Programm geladen',
        loading: 'CARDIAC wird geöffnet…', state: 'Zustand', running: 'Läuft', paused: 'Pausiert', halted: 'Angehalten (HRS)', waiting: 'Wartet auf eine Eingabekarte',
        steps: 'Abgeschlossene Befehle', pc: 'Programmzähler', acc: 'Akkumulator', ir: 'Befehlsregister',
        cards: 'Eingabekarten', deck: 'Dezimaler Eingabestapel mit Vorzeichen', enqueue: 'Karten einlegen', sample: 'Schaltung einmal abtasten',
        manual: 'Manuelle Karten', circuit: 'Schaltungsadapter', inputMode: 'Eingabequelle', queue: 'Leserwarteschlange', output: 'Ausgabeablage',
        noCards: 'Leer', ioHint: 'Der moderne Adapter bildet 0–5 V auf 000–999 ab. Ein Ausgabewort 001 erzeugt 5 V; jede andere Ausgabe 0 V. Du löst jede Abtastung aus.',
        needsCircuit: 'Öffne das Nachtlicht-Schaltungsbeispiel, um IN und OUT zu verbinden.',
        memory: 'Speicher: 00–99', selected: 'Ausgewählte Zelle', write: 'Laufende Zelle schreiben', setPc: 'PC setzen', breakpoint: 'Haltepunkt umschalten',
        memoryHint: 'Wähle eine Zelle zum Untersuchen. 00 ist fest 001; JMP schreibt den Rücksprungbefehl nach 99. Speicheränderungen ändern deinen Quelltext nicht.',
        current: 'Nächster Befehl', changed: 'Vom letzten Befehl geschrieben', read: 'Vom letzten Befehl gelesen',
        sourceDiffers: 'Hier unterscheidet sich der Speicher vom Quelltext. Maßgeblich ist der angezeigte Speicher.',
        sourceLine: 'Quellzeile', latest: 'Letzter abgeschlossener Befehl', reads: 'Gelesen', writes: 'Geschrieben', branch: 'Sprung', taken: 'ausgeführt', notTaken: 'nicht ausgeführt',
        prediction: 'Du bist der Prozessor', predictHint: 'Sage den nächsten PC und Akkumulator voraus. Führe dann einen Befehl aus und vergleiche.',
        predictPc: 'Vorhergesagter nächster PC (00–99)', predictAcc: 'Vorhergesagter Akkumulator (−9999…9999)', check: 'Schritt & vergleichen',
        correct: 'Deine Vorhersage stimmt.', different: 'Vergleiche deine Vorhersage mit dem tatsächlichen Zustand unten.',
        missing: 'Gib beide Vorhersagen als dezimale ganze Zahlen ein.', invalid: 'Verwende einen zweistelligen PC und einen vorzeichenbehafteten vierstelligen Akkumulator.',
        waitPrediction: 'Kein Befehl abgeschlossen. Lege eine Karte ein, falls die Maschine wartet.',
        reference: 'Befehlsübersicht', original: 'Originale Opcode-Reihenfolge · Brickwright CARDIAC v1',
        mappings: ['INP: Karte in den Speicher lesen', 'CLA: Speicher nach ACC laden', 'ADD: Speicher zu ACC addieren', 'TAC: springen, falls ACC < 0',
            'SFT: dezimal nach links, dann rechts schieben', 'OUT: ein Speicherwort ausgeben', 'STO: die letzten drei ACC-Ziffern speichern',
            'SUB: Speicher von ACC subtrahieren', 'JMP: Rücksprung in 99 speichern und springen', 'HRS: anhalten und PC auf Operand setzen'],
        limits: 'Speicher: −999…999; ACC: −9999…9999. Bei Überlauf bleiben die letzten Ziffern. Ein leerer Leser wartet ohne erfundene Null. Negative Befehlswörter werden übersprungen.',
        clearOutput: 'Ausgabeablage leeren', error: 'CARDIAC', loaded: 'Geladenes Programm', modern: 'Moderner Brickwright-I/O-Adapter',
        threshold: 'Nachtlicht: Messwert < 500 → 001; Messwert ≥ 500 → 000.', value: 'Zellwert (−999…999)'
    }
};

export default function CardiacPanel ({workspace, assembly, snapshot, busy, error, locale, prediction,
    exampleId, suppliedCards = 0, onSource, onDeck, onMode, onExample, onLoad, onRunSource, onControl, onRun, onPredict, onSave, onOpen, onListing, attached}) {
    const language = /^de/i.test(locale || '') ? 'de' : 'en';
    const t = COPY[language];
    const surfaces = useContext(CardiacSurfaces);
    const sourceHelp = useRef(null);
    const faceHelp = useRef(null);
    const [cell, setCell] = useState(1);
    const [cellValue, setCellValue] = useState('');
    const [predictPc, setPredictPc] = useState('');
    const [predictAcc, setPredictAcc] = useState('');
    const state = cardiacDebugView(snapshot, assembly);
    const running = !!state?.running;
    const currentEvent = state?.lastInstruction || (state?.lastEvent?.type === 'instruction' ? state.lastEvent : null);
    const selectedWord = state?.memory[cell];
    const loaded = workspace.loadedProgram;
    const draftWords = assembly?.ok ? assembly.words.map(({address, value}) => ({address, value})) : null;
    const dirty = !loaded || !draftWords || JSON.stringify(draftWords) !== JSON.stringify(loaded.words) || assembly.entry !== loaded.entry;
    const status = !state ? t.loading : state.error ? state.error : state?.waiting ? t.waiting : state?.halted ? t.halted : running ? t.running : t.paused;
    const nextWord = state?.memory[state.pc];
    const predictionMessage = prediction?.kind === 'waiting' ? t.waitPrediction : t[prediction?.kind];

    const Editor = surfaces?.Editor;
    const exemplar = CARDIAC_EXAMPLES[exampleId];
    const exampleEdited = exemplar && exemplar.source.trim() !== workspace.source.trim();
    const readCards = Math.max(0, suppliedCards - (state?.inputQueue?.length || 0));
    const local = (en, de) => language === 'de' ? de : en;
    const examplesLabel = Editor ? local('Examples', 'Beispiele') : t.examples;
    const icon = (glyph, label) => Editor ? <span title={label} aria-hidden="true">{glyph}</span> : label;
    const sourceLine = item => {
        const text = item.source.trim();
        const match = /^([a-z_]\w*:|\d{1,2}:)\s*(.*)$/i.exec(text);
        return <span className={styles.listingLine}>
            <span>{item.line}</span><span title={match?.[1]}>{match?.[1]}</span><span>{match?.[2] ?? text}</span>
        </span>;
    };
    const sourceInput = <textarea aria-label={t.source} data-testid={Editor ? undefined : 'cardiac-source'} className={styles.source}
        value={workspace.source} onChange={event => onSource(event.target.value)} spellCheck={false} maxLength={131072} />;
    const tools = <div className={`${styles.panel} ${styles.toolbar}`} data-cardiac-code-tools>
            <select aria-label={t.examples} title={t.examples} value={exampleId || ''}
                onChange={event => onExample(event.target.value)} disabled={busy} className={styles.examplePicker}>
                <option value="" disabled>{examplesLabel}</option>
                {Object.values(CARDIAC_EXAMPLES).map(example => <option key={example.id} value={example.id}>
                    {exampleEdited && example.id === exampleId ? '* ' : ''}{example.title[language]}
                </option>)}
            </select>
            <button type="button" title={t.load} aria-label={t.load} onClick={onLoad}
                disabled={busy || !assembly.ok || assembly.entry === null}>{icon('↓', t.load)}</button>
            <button type="button" className={styles.primary} title={t.runSource} aria-label={t.runSource}
                onClick={onRunSource} disabled={busy || !assembly.ok || assembly.entry === null}>{icon('▶', t.runSource)}</button>
            <button type="button" title={t.save} aria-label={t.save} onClick={onSave}>{icon('▣', t.save)}</button>
            <label className={styles.fileButton} title={t.open}>{icon('↗', t.open)}
                <input type="file" aria-label={t.open} accept=".cardiac,.txt,.json" disabled={busy}
                    onChange={event => { const file = event.target.files[0]; event.target.value = ''; if (file) onOpen(file); }} /></label>
            <button type="button" title={t.listing} aria-label={t.listing} onClick={onListing}
                disabled={!assembly.ok || assembly.entry === null}>{icon('⇩', t.listing)}</button>
            {Editor && <button type="button" title={t.reference} aria-label={t.reference}
                onClick={() => sourceHelp.current.showModal()}>ⓘ</button>}
        </div>;
    const editor = <section className={Editor ? `${styles.panel} ${styles.codeEditor}` : styles.panel} data-cardiac-editor>
        {!Editor && <header className={styles.header}><strong>CARDIAC</strong><span>{t.program}</span></header>}
        {surfaces?.tools ? createPortal(tools, surfaces.tools) : tools}
        {error && <p className={styles.error} role="alert">{error}</p>}
        {Editor ? <div className={styles.sharedEditor} role="group" aria-label={t.source} data-testid="cardiac-source">
            <React.Suspense fallback={sourceInput}>
                <Editor value={workspace.source} lang="cardiac" onChange={onSource} isVisible />
            </React.Suspense>
        </div> : sourceInput}
        {dirty && <p className={styles.notice} data-cardiac-dirty>{t.dirty}</p>}
        {!!assembly.diagnostics?.length && <ul className={styles.diagnostics} aria-live="polite">
            {assembly.diagnostics.map((item, index) => <li key={index} data-severity={item.severity}>
                {item.line}:{item.column} — {item.message}</li>)}
        </ul>}
        {assembly.ok && !!assembly.listing?.length && <details open={Editor ? undefined : true}><summary>{local('Listing', 'Listing')}</summary>
            <div className={styles.tableScroll}><table className={styles.listing}><thead><tr><th>PC</th><th>{t.program}</th><th>{t.sourceLine}</th></tr></thead>
                <tbody>{assembly.listing.map(item => <tr key={item.address}
                    data-current={state?.pc === item.address && state?.memory[item.address] === item.value ? 'true' : undefined}>
                    <td>{addr(item.address)}</td><td>{word(item.value)}</td><td>{sourceLine(item)}</td>
                </tr>)}</tbody></table></div>
        </details>}
        {Editor ? <dialog ref={sourceHelp} aria-label={t.reference}>
            <form method="dialog"><button type="submit" aria-label={language === 'de' ? 'Schließen' : 'Close'}>×</button></form>
            <p>{t.sourceHint}</p><p>{t.original}</p>
            <ol start="0">{t.mappings.map(text => <li key={text}>{text}</li>)}</ol>
            <p>{t.limits}</p>
        </dialog> : <details><summary>{t.reference}</summary><p>{t.sourceHint}</p><p>{t.original}</p>
            <ol start="0">{t.mappings.map(text => <li key={text}>{text}</li>)}</ol>
            <p className={styles.hint}>{t.limits}</p>
        </details>}
    </section>;

    const machine = <section className={`${styles.panel} ${Editor ? styles.machine : ''}`} data-cardiac-controller data-cardiac-status={state?.status || 'ready'}>
        {!Editor && <header className={styles.header}><strong>CARDIAC</strong><span>{t.subtitle}</span></header>}
        {error && !surfaces?.code && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.registers}>
            <div><span title={t.pc}>{Editor ? 'PC' : t.pc}</span><output data-testid="cardiac-pc">{addr(state?.pc)}</output></div>
            <div><span title={t.acc}>{Editor ? 'ACC' : t.acc}</span><output data-testid="cardiac-acc">{word(state?.acc, 4)}</output></div>
            <div><span title={t.ir}>{Editor ? 'IR' : t.ir}</span><output data-testid="cardiac-ir">{word(state?.ir)}</output></div>
            <div><span title={t.steps}>{Editor ? local('Steps', 'Schritte') : t.steps}</span><output data-testid="cardiac-steps">{state?.steps ?? '—'}</output></div>
        </div>
        <div className={`${styles.actions} ${styles.machineActions}`}>
            <button type="button" className={styles.primary} title={t.run} aria-label={t.run}
                onClick={onRun} disabled={busy || running || !loaded}>{icon('▶', t.run)}</button>
            <button type="button" title={t.pause} aria-label={t.pause}
                onClick={() => onControl('pause')} disabled={busy || !running}>{icon('⏸', t.pause)}</button>
            <button type="button" title={t.step} aria-label={t.step}
                onClick={() => onControl('step')} disabled={busy || running || !loaded}>{icon('⏭', t.step)}</button>
            <button type="button" title={t.reset} aria-label={t.reset}
                onClick={() => onControl('reset')} disabled={busy}>{icon('↺', t.reset)}</button>
            <span role="status" className={styles.status} title={state ? `${t.current} · ${addr(state.pc)} / ${word(nextWord)}` : undefined}>
                {status}
            </span>
            <button type="button" title={local('About CARDIAC controls', 'Über die CARDIAC-Steuerung')}
                aria-label={local('About CARDIAC controls', 'Über die CARDIAC-Steuerung')}
                onClick={() => faceHelp.current.showModal()}>ⓘ</button>
        </div>
        <dialog ref={faceHelp} aria-label={local('CARDIAC controls', 'CARDIAC-Steuerung')}>
            <form method="dialog"><button type="submit" aria-label={local('Close', 'Schließen')}>×</button></form>
            <p>{local('Run source + cards loads the program and queues the draft cards. Each INP removes one card from the queue. Queue cards appends the current draft to the running or waiting machine.',
                'Quelle + Karten starten lädt das Programm und legt die Karten ein. Jeder INP-Befehl liest eine Karte. Karten einlegen hängt den Entwurf an die aktuelle Warteschlange an.')}</p>
            <p>{t.ioHint}</p><p>{t.memoryHint}</p><p>{t.predictHint}</p>
        </dialog>
        <div className={styles.trays}>
            <section><h3>{t.cards}</h3>
                {(attached || !Editor) && <label className={styles.field}>{t.inputMode}<select value={workspace.inputMode} onChange={event => onMode(event.target.value)}>
                    <option value="manual">{t.manual}</option><option value="circuit" disabled={!attached}>{t.circuit}</option>
                </select></label>}
                {workspace.inputMode === 'manual' ? <React.Fragment>
                    <textarea aria-label={t.deck} data-testid="cardiac-input-deck" rows={2} maxLength={32768}
                        value={workspace.inputDeck} onChange={event => onDeck(event.target.value)} spellCheck={false} />
                    <button type="button" title={t.enqueue} aria-label={t.enqueue}
                        onClick={() => onControl('queueDeck')} disabled={busy}>{icon('↓', t.enqueue)}</button>
                </React.Fragment> : <button type="button" onClick={() => onControl('sampleInput')} disabled={busy || !attached}>{t.sample}</button>}
                <span className={styles.trayLabel}>{t.queue}</span>
                <output data-testid="cardiac-input-queue" className={styles.cardTray}>
                    {state?.inputQueue?.length ? state.inputQueue.map((value, index) => <span key={index} title={state.inputSources?.[index] === 'circuit' ? t.circuit : t.manual}>
                        {word(value)}{state.inputSources?.[index] === 'circuit' ? ` · ${t.circuit}` : ''}</span>) : readCards ? local(`${readCards} read`, `${readCards} gelesen`) : t.noCards}
                </output>
            </section>
            <section><h3>{t.output}</h3><output data-testid="cardiac-output" className={styles.cardTray}>
                {state?.output?.length ? state.output.map((value, index) => <span key={index}>{word(value)}</span>) : t.noCards}
            </output>{!!state?.output?.length && <button type="button" title={t.clearOutput} aria-label={t.clearOutput}
                    onClick={() => onControl('clearOutput')} disabled={busy}>{icon('×', t.clearOutput)}</button>}
                {attached && <p className={styles.hint}>IN {Number.isFinite(state?.inputVoltage) ? state.inputVoltage.toFixed(3) : '—'} V · OUT {state?.outputHigh ? '5' : '0'} V</p>}
            </section>
        </div>
        <details open={Editor ? undefined : true} className={styles.prediction}><summary>{t.prediction}</summary>
            <div className={styles.actions}><label>{t.predictPc}<input inputMode="numeric" value={predictPc}
                onChange={event => setPredictPc(event.target.value)} /></label>
            <label>{t.predictAcc}<input inputMode="numeric" value={predictAcc} onChange={event => setPredictAcc(event.target.value)} /></label>
            <button type="button" onClick={() => onPredict(predictPc, predictAcc)} disabled={busy || running || !loaded}>{t.check}</button></div>
            {predictionMessage && <p role="status" data-cardiac-prediction={prediction.kind}>{predictionMessage}
                {prediction.expectedPc !== undefined && ` PC ${addr(prediction.expectedPc)} · ACC ${word(prediction.expectedAcc, 4)}`}</p>}
        </details>
        {currentEvent && <details open={Editor ? undefined : true} className={styles.trace} data-cardiac-last-instruction><summary>{t.latest}</summary>
            <p>{addr(currentEvent.pcBefore)}: {word(currentEvent.word)} {currentEvent.mnemonic} → PC {addr(currentEvent.pcAfter)} · ACC {word(currentEvent.accBefore, 4)} → {word(currentEvent.accAfter, 4)}</p>
            {!!currentEvent.reads?.length && <p>{t.reads}: {currentEvent.reads.map(item => `${addr(item.address)} = ${word(item.value)}`).join(', ')}</p>}
            {!!currentEvent.writes?.length && <p>{t.writes}: {currentEvent.writes.map(item => `${addr(item.address)}: ${word(item.before)} → ${word(item.after)}`).join(', ')}</p>}
            {currentEvent.input !== null && <p>{t.cards}: {word(currentEvent.input)} ({currentEvent.inputSource === 'circuit' ? t.circuit : t.manual})</p>}
            {currentEvent.output !== null && <p>{t.output}: {word(currentEvent.output)}</p>}
            {currentEvent.branchTaken !== null && <p>{t.branch}: {currentEvent.branchTaken ? t.taken : t.notTaken}</p>}
            {currentEvent.notes?.map(note => <p key={note}>{note}</p>)}
        </details>}
        <details open={Editor ? undefined : true}><summary>{t.memory}</summary>
            {state?.sourceDiffers && <p className={styles.notice}>{t.sourceDiffers}</p>}
            {state?.sourceLine && <p>{t.sourceLine}: {state.sourceLine}</p>}
            <div className={styles.memory} role="group" aria-label={t.memory}>
                {Array.from({length: 100}, (_, address) => <button type="button" key={address}
                    onClick={() => { setCell(address); setCellValue(String(state?.memory[address] || 0)); }}
                    aria-pressed={cell === address} aria-label={`${addr(address)}: ${word(state?.memory[address])}`}
                    data-testid={`cardiac-cell-${addr(address)}`} data-pc={state?.pc === address ? 'true' : undefined}
                    data-written={currentEvent?.writes?.some(item => item.address === address) ? 'true' : undefined}
                    data-read={currentEvent?.reads?.some(item => item.address === address) ? 'true' : undefined}>
                    <small>{addr(address)}{state?.breakpoints?.includes(address) ? '●' : ':'}</small><b>{word(state?.memory[address])}</b>
                </button>)}
            </div>
            <div className={styles.actions}><strong>{t.selected}: {addr(cell)} = {word(selectedWord)}</strong>
                <label>{t.value}<input value={cellValue} inputMode="numeric" onChange={event => setCellValue(event.target.value)} /></label>
                <button type="button" disabled={busy || running || cell === 0 || !/^-?\d+$/.test(cellValue)} onClick={() => onControl('writeWord', {address: cell, value: Number(cellValue)})}>{t.write}</button>
                <button type="button" disabled={busy || running} onClick={() => onControl('setPc', cell)}>{t.setPc}</button>
                <button type="button" disabled={busy} aria-pressed={!!state?.breakpoints?.includes(cell)} onClick={() => onControl('toggleBreakpoint', cell)}>{t.breakpoint}</button>
            </div>
        </details>
    </section>;
    return <React.Fragment>
        {surfaces?.code ? createPortal(editor, surfaces.code) : <details><summary>CARDIAC · {t.program}</summary>{editor}</details>}
        {surfaces?.controller ? createPortal(machine, surfaces.controller) : !surfaces && machine}
        {surfaces && !surfaces.controller && <p className={styles.hint}>CARDIAC · {status} · PC {addr(state?.pc)} · ACC {word(state?.acc, 4)}</p>}
    </React.Fragment>;
}

CardiacPanel.propTypes = {
    workspace: PropTypes.object.isRequired, assembly: PropTypes.object.isRequired, snapshot: PropTypes.object,
    exampleId: PropTypes.string, suppliedCards: PropTypes.number,
    busy: PropTypes.bool, error: PropTypes.string, locale: PropTypes.string, prediction: PropTypes.object, attached: PropTypes.bool,
    onSource: PropTypes.func.isRequired, onDeck: PropTypes.func.isRequired, onMode: PropTypes.func.isRequired,
    onExample: PropTypes.func.isRequired, onLoad: PropTypes.func.isRequired, onRunSource: PropTypes.func.isRequired,
    onControl: PropTypes.func.isRequired, onRun: PropTypes.func.isRequired, onPredict: PropTypes.func.isRequired,
    onSave: PropTypes.func.isRequired, onOpen: PropTypes.func.isRequired, onListing: PropTypes.func.isRequired
};
