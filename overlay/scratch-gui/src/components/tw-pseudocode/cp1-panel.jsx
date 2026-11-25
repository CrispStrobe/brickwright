// SPDX-License-Identifier: BSD-3-Clause
import React from 'react';
import {createPortal} from 'react-dom';
import {Cp1Surfaces} from './cp1-surfaces.js';
import PropTypes from 'prop-types';
import styles from './cp1-panel.css';
import {browserLocale, makeT} from '../../lib/bw-i18n.js';
import {parseCp1Program, exportCp1Program} from '../../lib/cp1-program.js';
import {loadCp1Monitor} from '../../lib/cp1-monitor.js';
import {cp1DebugView} from '../../lib/cp1-debug-view.js';
import {createCp1Project, serializeCp1Project, cp1RomReference} from '../../lib/cp1-project.js';
import {CP1_PHYSICAL_KEYS, createCp1KeyInput, cp1KeyForKeyboard, cp1KeyboardOwner, cp1IsTypingTarget,
    cp1DisplayDigits, cp1SegmentDescription, readCp1PanelSnapshot} from '../../lib/cp1-panel-input.js';
import downloadBlob from '../../lib/download-blob.js';


const COPY = {
    en: {
        title: 'Kosmos CP1', base: '128 cells', expanded: '256 cells · CP3', expansion: 'CP3 expansion (256 cells)',
        importRom: 'Import monitor ROM', useIndependentRom: 'Use Brickwright monitor',
        noRom: 'The bundled Brickwright monitor starts on Run.',
        independentRomError: 'The bundled Brickwright monitor is missing or damaged.',
        romLocal: 'The project keeps a ROM reference. Select the same monitor again when reopening.',
        run: 'Run CPU', pause: 'Pause CPU', step: 'CPU step', reset: 'Reset CPU',
        running: 'CPU running', paused: 'CPU paused',
        stepHint: 'CPU step advances one 8049 instruction. The keypad STEP and RUN keys operate the teaching program through the monitor ROM.',
        keyboard: 'Focus this panel to use digits, Enter (RUN), Escape (STP), Backspace (CLR), or F1–F10 for the function row.',
        display: 'Six raw segment displays', digit: 'Display {index}: lit segments {segments}',
        keys: 'CP1 keypad: 30 buttons, 20 shared contacts', duplicate: 'duplicate digit button',
        runProgram: 'Run CP1 program', shortRun: 'Run', shortLoad: 'Load', shortOpen: 'Open',
        shortExport: 'Export', shortSave: 'Save', help: 'CP1 editor help', close: 'Close',
        debuggerHelp: 'CP1 debugger help', diagnostics: 'Diagnostics',
        runHint: 'Run or the green flag assembles the source, loads it and starts the CP1 program.',
        program: 'Program', memory: 'Memory', ports: 'Ports',
        source: 'CP1 source or decimal listing', load: 'Load cells', listing: 'Export listing',
        save: 'Save CP1 project', openSource: 'Open source',
        loaded: 'Loaded {count} cells. Select the teaching PC and use the keypad RUN key.',
        sourceHint: 'Labels, ORG, EQU and DATA/DB are supported. 04.001 means opcode 4, operand 1. Pause the CPU before loading cells.',
        address: 'Cell', opcode: 'Opcode', operand: 'Operand', line: 'Source line',
        previous: 'Previous cells', next: 'Next cells', write: 'Write cell',
        memoryHint: 'RAM cells are read from the machine snapshot. Pause the CPU before writing a cell.',
        port: 'Port', value: 'Value', latch: 'Latch', direction: 'Direction', input: 'Input',
        inputHint: 'Input switches drive the external port inputs. CP1 selector 1 corresponds to circuit bit 0.',
        bit: '{port} input bit {bit}', unavailable: 'Unavailable',
        error: 'CP1 error', lineError: 'Line {line}, column {column}: {message}',
        fileTooLarge: 'CP1 source files must be no larger than 256 KB.',
        noLoader: 'No CP1 program loader is attached.', invalidCell: 'Use a valid cell address and two byte values (0–255).',
        saved: 'CP1 project prepared.', written: 'Cell {address} written.',
        romImported: 'Monitor ROM imported: {name}', raw: 'Raw masks', busy: 'Working…', cycles: 'cycles',
        invalidRom: 'Import a 2048-byte CP1 monitor ROM.',
        teaching: 'CP1 command debugger', commandStep: 'Step CP1 command', teachingPc: 'CP1 PC',
        accumulator: 'Accumulator', comparison: 'Comparison', yes: 'true', no: 'false',
        semanticUnavailable: 'Command debugging needs a qualified monitor ROM. Raw CPU stepping and the original keypad remain available.',
        semanticHint: 'Set a breakpoint at the starting cell, run the CPU, then select that cell and press RUN on the keypad. At the breakpoint, Step CP1 command advances through the monitor to the next command boundary.',
        monitorIdle: 'The monitor is waiting. Use its STEP key while the CPU runs, or set a cell breakpoint and start with keypad RUN.',
        sourceMismatch: 'The current cell has no matching source line. Check the draft and the actual RAM before loading or editing.',
        executionListing: 'Source and command breakpoints', breakpoint: 'Breakpoint',
        breakpointAt: 'Breakpoint at cell {address}', instruction: 'Cell value',
        currentSource: 'Current source: line {line}, cell {address}',
        stateReady: 'At a command boundary', stateRunning: 'Executing a command',
        stateHalted: 'Monitor waiting', stateError: 'Monitor error', stateUnknown: 'Waiting for a monitor observation',
        stepResult: 'Last command step: {completed} command(s), {instructions} CPU instructions, {cycles} machine cycles.',
        stepBudget: 'The command-step budget was reached. The CPU is paused; inspect the program or continue.',
        monitorError: 'Monitor error {code}', sourceDiffers: 'RAM differs'
    },
    de: {
        title: 'Kosmos CP1', base: '128 Zellen', expanded: '256 Zellen · CP3', expansion: 'CP3-Erweiterung (256 Zellen)',
        importRom: 'Monitor-ROM importieren', useIndependentRom: 'Brickwright-Monitor verwenden',
        noRom: 'Beim Start wird der eingebaute Brickwright-Monitor verwendet.',
        independentRomError: 'Der mitgelieferte Brickwright-Monitor fehlt oder ist beschädigt.',
        romLocal: 'Das Projekt speichert eine ROM-Referenz. Wähle beim erneuten Öffnen denselben Monitor.',
        run: 'CPU ausführen', pause: 'CPU pausieren', step: 'CPU-Schritt', reset: 'CPU zurücksetzen',
        running: 'CPU läuft', paused: 'CPU pausiert',
        stepHint: 'CPU-Schritt führt einen 8049-Befehl aus. STEP und RUN auf der Tastatur bedienen das Lernprogramm über das Monitor-ROM.',
        keyboard: 'Fokussiere dieses Feld: Ziffern, Eingabe (RUN), Escape (STP), Rücktaste (CLR) oder F1–F10 für die Funktionstasten.',
        display: 'Sechs rohe Segmentanzeigen', digit: 'Anzeige {index}: aktive Segmente {segments}',
        keys: 'CP1-Tastatur: 30 Tasten, 20 gemeinsame Kontakte', duplicate: 'zweite Zifferntaste',
        runProgram: 'CP1-Programm starten', shortRun: 'Start', shortLoad: 'Laden', shortOpen: 'Öffnen',
        shortExport: 'Export', shortSave: 'Speichern', help: 'Hilfe zum CP1-Editor', close: 'Schließen',
        debuggerHelp: 'Hilfe zum CP1-Debugger', diagnostics: 'Diagnose',
        runHint: 'Start oder die grüne Flagge assembliert, lädt und startet das CP1-Programm.',
        program: 'Programm', memory: 'Speicher', ports: 'Ports',
        source: 'CP1-Quelle oder Dezimallisting', load: 'Zellen laden', listing: 'Listing exportieren',
        save: 'CP1-Projekt speichern', openSource: 'Quelle öffnen',
        loaded: '{count} Zellen geladen. Wähle den Lernprogramm-PC und drücke RUN auf der Tastatur.',
        sourceHint: 'Labels, ORG, EQU und DATA/DB sind möglich. 04.001 bedeutet Befehl 4, Operand 1. Pausiere die CPU vor dem Laden der Zellen.',
        address: 'Zelle', opcode: 'Befehl', operand: 'Operand', line: 'Quellzeile',
        previous: 'Vorherige Zellen', next: 'Nächste Zellen', write: 'Zelle schreiben',
        memoryHint: 'Die RAM-Zellen stammen aus dem Maschinenzustand. Pausiere die CPU vor dem Schreiben.',
        port: 'Port', value: 'Wert', latch: 'Register', direction: 'Richtung', input: 'Eingang',
        inputHint: 'Die Schalter treiben die externen Porteingänge. CP1-Selektor 1 entspricht Schaltungsbit 0.',
        bit: '{port} Eingangsbit {bit}', unavailable: 'Nicht verfügbar',
        error: 'CP1-Fehler', lineError: 'Zeile {line}, Spalte {column}: {message}',
        fileTooLarge: 'CP1-Quelldateien dürfen höchstens 256 KB groß sein.',
        noLoader: 'Kein CP1-Programmlader verbunden.', invalidCell: 'Verwende eine gültige Zelladresse und zwei Bytewerte (0–255).',
        saved: 'CP1-Projekt vorbereitet.', written: 'Zelle {address} geschrieben.',
        romImported: 'Monitor-ROM importiert: {name}', raw: 'Rohe Masken', busy: 'Wird bearbeitet…', cycles: 'Zyklen',
        invalidRom: 'Importiere ein CP1-Monitor-ROM mit 2048 Bytes.',
        teaching: 'CP1-Befehlsdebugger', commandStep: 'CP1-Befehlsschritt', teachingPc: 'CP1-PC',
        accumulator: 'Akkumulator', comparison: 'Vergleich', yes: 'wahr', no: 'falsch',
        semanticUnavailable: 'Befehlsdebugging benötigt ein geprüftes Monitor-ROM. CPU-Schritte und die ursprüngliche Tastatur bleiben verfügbar.',
        semanticHint: 'Setze einen Haltepunkt an der Startzelle, starte die CPU, wähle die Zelle und drücke RUN auf der Tastatur. Am Haltepunkt führt ein CP1-Befehlsschritt den Monitor bis zur nächsten Befehlsgrenze aus.',
        monitorIdle: 'Der Monitor wartet. Verwende STEP bei laufender CPU oder setze einen Zellhaltepunkt und starte mit RUN auf der Tastatur.',
        sourceMismatch: 'Zur aktuellen Zelle passt keine Quellzeile. Prüfe Entwurf und tatsächliches RAM vor dem Laden oder Bearbeiten.',
        executionListing: 'Quelle und Befehlshaltepunkte', breakpoint: 'Haltepunkt',
        breakpointAt: 'Haltepunkt an Zelle {address}', instruction: 'Zellwert',
        currentSource: 'Aktuelle Quelle: Zeile {line}, Zelle {address}',
        stateReady: 'An einer Befehlsgrenze', stateRunning: 'Befehl wird ausgeführt',
        stateHalted: 'Monitor wartet', stateError: 'Monitorfehler', stateUnknown: 'Warten auf eine Monitorbeobachtung',
        stepResult: 'Letzter Befehlsschritt: {completed} Befehl(e), {instructions} CPU-Befehle, {cycles} Maschinenzyklen.',
        stepBudget: 'Das Budget für den Befehlsschritt wurde erreicht. Die CPU ist pausiert; prüfe das Programm oder setze fort.',
        monitorError: 'Monitorfehler {code}', sourceDiffers: 'RAM weicht ab'
    }
};
const translate = makeT(COPY);
// Draw one symmetric digit and slant it as a unit in the SVG.
const SEGMENTS = [
    '15,7 42,7 47,12 42,17 15,17 10,12',
    '45,15 50,20 50,41 45,46 40,41 40,20',
    '45,52 50,57 50,78 45,83 40,78 40,57',
    '15,81 42,81 47,86 42,91 15,91 10,86',
    '12,52 17,57 17,78 12,83 7,78 7,57',
    '12,15 17,20 17,41 12,46 7,41 7,20',
    '15,44 42,44 47,49 42,54 15,54 10,49'
];
const hex = value => Number.isInteger(value) ? value.toString(16).toUpperCase().padStart(2, '0') : '—';
const cellText = value => Number.isInteger(value) ? String(value).padStart(3, '0') : '—';
const readFile = (file, mode) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Could not read the selected file.'));
    reader.onload = () => resolve(reader.result);
    if (mode === 'bytes') reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
});

/** A view of one engine-owned CP1 machine. No CPU loop or teaching-language VM. */
class Cp1Panel extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            source: props.source || '', snapshot: null, view: 'program', errors: [], notice: '',
            busy: false, memoryPage: 0, editAddress: '0', editOpcode: '0', editOperand: '0', importedRom: null
        };
        this._romInput = React.createRef();
        this._sourceInput = React.createRef();
        this._assistiveTimers = new Set();
        this._assistiveCounter = 0;
        this._mounted = false;
        this._programHelp = React.createRef();
        this._debugHelp = React.createRef();
        this._programRun = null;
        this._keys = createCp1KeyInput((key, down) => {
            if (this.props.onKey) this.props.onKey(key, down);
            if (this._mounted) this.forceUpdate();
        });
        this._releaseAll = this._releaseAll.bind(this);
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
        this._visibility = () => { if (document.hidden) this._releaseAll(); };
    }

    componentDidMount () {
        this._mounted = true;
        window.addEventListener('bw-cp1-run-request', this._runProgram);
        window.addEventListener('bw-cp1-stop-request', this._stopProgram);
        this._controllerSlot = this.context?.controller;
        window.addEventListener('blur', this._releaseAll);
        window.addEventListener('keyup', this._onKeyUp);
        document.addEventListener('visibilitychange', this._visibility);
        let last = -Infinity;
        const refresh = now => {
            if (!this._mounted) return;
            if (!this.props.snapshot && this.props.machine && now - last >= 80) {
                last = now;
                this.setState({snapshot: readCp1PanelSnapshot(this.props.machine)});
            }
            this._frame = window.requestAnimationFrame(refresh);
        };
        this._frame = window.requestAnimationFrame(refresh);
    }

    componentDidUpdate (previous) {
        const slot = this.context?.controller;
        if (this._controllerSlot !== slot) {
            const previousSlot = this._controllerSlot;
            this._controllerSlot = slot;
            if (previousSlot) this._releaseAll();
        }
        if (previous.source !== this.props.source && typeof this.props.source === 'string' && this.props.source !== this.state.source) {
            this.setState({source: this.props.source, errors: []});
        }
        if (previous.machine !== this.props.machine) {
            // The old machine must also see its keys released when a caller
            // replaces the machine and callback together in one render.
            if (previous.onKey) for (const key of this._keys.heldKeys()) previous.onKey(key, false);
            if (previous.onReleaseKeys) previous.onReleaseKeys();
            this._releaseAll();
            this.setState({snapshot: readCp1PanelSnapshot(this.props.machine)});
        }
        if (previous.running && !this.props.running) this._releaseAll();
        if (previous.onKey && !this.props.onKey) this._releaseAll();
    }

    componentWillUnmount () {
        this._mounted = false;
        window.removeEventListener('bw-cp1-run-request', this._runProgram);
        window.removeEventListener('bw-cp1-stop-request', this._stopProgram);
        this._programRun?.abort();
        this._releaseAll();
        window.cancelAnimationFrame(this._frame);
        window.removeEventListener('blur', this._releaseAll);
        window.removeEventListener('keyup', this._onKeyUp);
        document.removeEventListener('visibilitychange', this._visibility);
    }

    _t (key, variables) { return translate(this.props.locale || browserLocale(), key, variables); }

    _releaseAll () {
        for (const timer of this._assistiveTimers) window.clearTimeout(timer);
        this._assistiveTimers.clear();
        this._keys.releaseAll();
        if (this.props.onReleaseKeys) this.props.onReleaseKeys();
    }

    _onKeyDown (event) {
        if (!this.props.onKey || !(this.props.snapshot || this.state.snapshot || this.props.machine) ||
            event.defaultPrevented || event.repeat || cp1IsTypingTarget(event.target) ||
            event.target?.closest?.('dialog[open]')) return;
        const button = event.target && event.target.closest && event.target.closest('[data-cp1-key]');
        if (!button && (event.key === 'Enter' || event.key === ' ') && event.target && event.target.closest && event.target.closest('button')) return;
        const key = button && (event.key === ' ' || event.key === 'Enter') ? button.dataset.cp1Key : cp1KeyForKeyboard(event);
        if (!key) return;
        event.preventDefault();
        this._keys.press(key, cp1KeyboardOwner(event));
    }

    _onKeyUp (event) { this._keys.release(cp1KeyboardOwner(event)); }

    _pressPointer (event, key) {
        if (!this.props.onKey || event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.focus();
        if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId);
        this._keys.press(key, `pointer:${event.pointerId}`);
    }

    _assistiveClick (event, key) {
        if (event.detail !== 0 || !this.props.onKey) return;
        const owner = `assistive:${key}:${this._assistiveCounter++}`;
        this._keys.press(key, owner);
        // An assistive-technology click has no held-up event. Give the monitor
        // a short real key closure; ordinary pointer/keyboard presses are held.
        const timer = window.setTimeout(() => {
            this._assistiveTimers.delete(timer);
            this._keys.release(owner);
        }, 150);
        this._assistiveTimers.add(timer);
    }

    _setSource (source) {
        this.setState({source, errors: [], notice: ''});
        if (this.props.onSourceChange) this.props.onSourceChange(source);
    }

    _assemble () {
        const result = parseCp1Program(this.state.source, {expansion: Boolean(this.props.expansion)});
        this.setState({errors: result.diagnostics, notice: ''});
        return result.ok ? result : null;
    }

    async _action (callback) {
        this.setState({busy: true, errors: [], notice: ''});
        try { await callback(); }
        catch (error) { if (this._mounted) this.setState({errors: [{message: error.message || String(error)}]}); }
        finally { if (this._mounted) this.setState({busy: false}); }
    }

    async _load () {
        const result = this._assemble();
        if (!result) return;
        await this._action(async () => {
            if (!this.props.onLoad) throw new Error(this._t('noLoader'));
            this._releaseAll();
            await this.props.onLoad(result, {source: this.state.source, clear: true});
            if (this._mounted) this.setState({notice: this._t('loaded', {count: result.usedCells})});
        });
    }

    async _installRom (bytes, name, expectedSha256) {
        const reference = await cp1RomReference(bytes, name);
        if (expectedSha256 && reference.sha256 !== expectedSha256) {
            throw new Error(this._t('independentRomError'));
        }
        if (!this._mounted) return;
        this._releaseAll();
        if (this.props.onImportRom) await this.props.onImportRom({bytes, name, reference});
        else window.dispatchEvent(new CustomEvent('bw-machine-media-load', {
            detail: {kind: 'cp1', slotId: 'rom', bytes, name}
        }));
        if (this._mounted) this.setState({importedRom: reference, notice: this._t('romImported', {name})});
    }

    async _importRom (file) {
        if (!file) return;
        await this._action(async () => {
            if (file.size !== 2048) throw new RangeError(this._t('invalidRom'));
            const bytes = new Uint8Array(await readFile(file, 'bytes'));
            await this._installRom(bytes, file.name);
        });
    }

    async _loadIndependentRom () {
        await this._action(async () => {
            const {bytes, name, reference} = await loadCp1Monitor().catch(() => {
                throw new Error(this._t('independentRomError'));
            });
            await this._installRom(bytes, name, reference.sha256);
        });
    }

    _runProgram = async () => {
        if (!this.props.onRunProgram || this.state.busy || this._programRun) return;
        const result = this._assemble();
        if (!result) return;
        const request = new AbortController();
        this._programRun = request;
        this._releaseAll();
        try {
            await this._action(() => this.props.onRunProgram(result, request.signal));
        } finally {
            this._programRun = null;
        }
    };

    _stopProgram = () => {
        this._programRun?.abort();
        this._releaseAll();
        if (this.props.snapshot || this.state.snapshot || this.props.machine) this.props.onPause?.();
    };

    async _openSource (file) {
        if (!file) return;
        await this._action(async () => {
            if (file.size > 256 * 1024) throw new RangeError(this._t('fileTooLarge'));
            const source = await readFile(file, 'text');
            if (this._mounted) this._setSource(source);
        });
    }

    async _saveProject () {
        const result = this._assemble();
        if (!result) return;
        await this._action(async () => {
            const project = createCp1Project({
                configuration: {expansion: Boolean(this.props.expansion), clockHz: this.props.clockHz || 6000000},
                rom: this.props.romReference || this.state.importedRom,
                source: this.state.source, words: result.words
            });
            if (this.props.onSaveProject) await this.props.onSaveProject(project);
            else await downloadBlob('kosmos-cp1.cp1.json', new Blob([serializeCp1Project(project)], {type: 'application/json'}));
            if (this._mounted) this.setState({notice: this._t('saved')});
        });
    }

    async _writeCell () {
        const capacity = this.props.expansion ? 256 : 128;
        const values = [this.state.editAddress, this.state.editOpcode, this.state.editOperand];
        const [address, opcode, operand] = values.map(Number);
        await this._action(async () => {
            if (!values.every(value => /^\d+$/.test(value)) || address >= capacity || opcode > 255 || operand > 255) {
                throw new RangeError(this._t('invalidCell'));
            }
            await this.props.onWriteCell(address, {opcode, operand});
            if (this._mounted) this.setState({notice: this._t('written', {address}), memoryPage: Math.floor(address / 16)});
        });
    }

    _renderDisplay (display) {
        const digits = cp1DisplayDigits(display);
        return <div className={styles.displaySection}>
            <div className={styles.display} role="group" aria-label={this._t('display')}>
                {digits.map((mask, index) => <svg key={index} className={styles.digit} viewBox="0 0 68 98"
                    role="img" aria-label={this._t('digit', {index: index + 1, segments: cp1SegmentDescription(mask)})}
                    data-cp1-digit={index} data-segments={mask}>
                    <g transform="translate(11.5 0) skewX(-7)">
                        {SEGMENTS.map((points, bit) => <polygon key={bit} points={points}
                            className={mask & (1 << bit) ? styles.segmentOn : styles.segmentOff} />)}
                    </g>
                    <circle cx="60" cy="86" r="4.5" className={mask & 128 ? styles.segmentOn : styles.segmentOff} />
                </svg>)}
            </div>
        </div>;
    }

    _renderKeypad (ready) {
        return <div className={styles.keypad} role="group" aria-label={this._t('keys')} title={this._t('keyboard')}>
            {CP1_PHYSICAL_KEYS.map(({id, key, group}) => <button key={id} type="button"
                data-cp1-key={key} data-cp1-physical-key={id} data-key-group={group}
                aria-label={group === 'lower' ? `${key} (${this._t('duplicate')})` : key}
                aria-pressed={this._keys.isHeld(key)} disabled={!ready || !this.props.onKey}
                className={group === 'function' ? styles.functionKey : styles.numberKey}
                onPointerDown={event => this._pressPointer(event, key)}
                onPointerUp={event => this._keys.release(`pointer:${event.pointerId}`)}
                onPointerCancel={event => this._keys.release(`pointer:${event.pointerId}`)}
                onLostPointerCapture={event => this._keys.release(`pointer:${event.pointerId}`)}
                onClick={event => this._assistiveClick(event, key)}>{key}</button>)}
        </div>;
    }

    _renderSemantic (view) {
        const waiting = view.execution === 'halted' || view.execution === 'error';
        const stateKey = {ready: 'stateReady', running: 'stateRunning', halted: 'stateHalted',
            error: 'stateError', unknown: 'stateUnknown'}[view.execution] || 'stateUnknown';
        const step = view.step;
        const result = step && step.status !== 'pending' ?
            [this._t('stepResult', {completed: step.completed, instructions: step.instructions, cycles: step.cycles}),
                step.status === 'limit' && this._t('stepBudget')].filter(Boolean).join(' ') : '';
        return <section className={styles.semantic} data-cp1-semantic="qualified"
            aria-label={this._t('teaching')}>
            {this._iconButton(this._t('commandStep'), '⇥', {
                'data-cp1-command-step': true,
                title: [this._t('commandStep'), this._t(waiting ? 'monitorIdle' : 'semanticHint'), result].filter(Boolean).join('\n'),
                disabled: this.props.running || this.state.busy || waiting || !this.props.onStepCommand,
                onClick: () => {
                    this._releaseAll();
                    this._action(() => this.props.onStepCommand());
                }
            })}
            <dl className={styles.teachingRegisters}>
                <div><dt title={this._t('teachingPc')}>PC</dt><dd data-cp1-teaching-pc>{cellText(view.pc)}</dd></div>
                <div><dt title={this._t('accumulator')}>ACC</dt><dd data-cp1-accumulator>{view.accumulator ?
                    `${String(view.accumulator.opcode).padStart(2, '0')}.${cellText(view.accumulator.operand)}` : '—'}</dd></div>
                <div><dt title={this._t('comparison')}>=</dt><dd data-cp1-comparison>{view.comparison === null ? '—' :
                    this._t(view.comparison ? 'yes' : 'no')}</dd></div>
            </dl>
            {this._iconButton(this._t(stateKey), view.execution === 'error' ? '⚠' : 'ⓘ', {
                'data-cp1-execution': view.execution,
                'aria-haspopup': 'dialog',
                title: [this._t(stateKey), result].filter(Boolean).join('\n'),
                onClick: () => this._debugHelp.current.showModal()
            })}
            {view.execution === 'error' ? '⚠' : 'ⓘ'}
            </span>
            {view.execution === 'error' && view.lastEvent && view.lastEvent.error ? <span data-cp1-monitor-error>
                {this._t('monitorError', {code: Number.isInteger(view.lastEvent.error.code) ?
                    cellText(view.lastEvent.error.code) : '—'})}</span> : null}
        </section>;
    }

    _iconButton (label, icon, props = {}) {
        return <button type="button" className={styles.iconButton} title={label} aria-label={label} {...props}>
            <span aria-hidden="true">{icon}</span>
        </button>;
    }

    _renderProgram (view, ready, compact = false, Editor) {
        const showEditor = compact || !this.context?.Editor;
        const sourceLabel = this._t('source');
        const fallback = <textarea value={this.state.source} aria-label={sourceLabel}
            spellCheck={false} autoCapitalize="off" autoCorrect="off" data-cp1-source="true"
            onChange={event => this._setSource(event.target.value)} />;
        const loadLabel = this._t('load');
        const canLoad = ready && !this.state.busy && !this.props.running && this.props.onLoad;
        return <div className={styles.program}>
            {showEditor && <div className={styles.compactActions}>
                {this.props.onRunProgram && <button type="button" className={styles.actionButton}
                    disabled={this.state.busy} title={this._t('runProgram')} aria-label={this._t('runProgram')}
                    onClick={this._runProgram}>
                    {this._t('shortRun')}
                </button>}
                <button type="button" className={styles.actionButton} title={loadLabel} aria-label={loadLabel}
                    disabled={!canLoad} onClick={() => this._load()}>{this._t('shortLoad')}</button>
                <button type="button" className={styles.actionButton} title={this._t('openSource')} aria-label={this._t('openSource')}
                    disabled={this.state.busy} onClick={() => this._sourceInput.current.click()}>{this._t('shortOpen')}</button>
                <button type="button" className={styles.actionButton} title={this._t('listing')} aria-label={this._t('listing')}
                    disabled={this.state.busy} onClick={() => {
                        const result = this._assemble();
                        if (result) this._action(() => downloadBlob('kosmos-cp1.cp1', new Blob(
                            [exportCp1Program(result)], {type: 'text/plain;charset=utf-8'})));
                    }}>{this._t('shortExport')}</button>
                <button type="button" className={styles.actionButton} title={this._t('save')} aria-label={this._t('save')}
                    disabled={this.state.busy} onClick={() => this._saveProject()}>{this._t('shortSave')}</button>
                {this._iconButton(this._t('help'), 'ⓘ', {
                    'aria-haspopup': 'dialog', onClick: () => this._programHelp.current.showModal()
                })}
                <dialog ref={this._programHelp} className={styles.helpDialog} aria-label={this._t('help')}>
                    <form method="dialog"><button type="submit">{this._t('close')}</button></form>
                    <p>{this._t('runHint')}</p>
                    <p>{this._t('sourceHint')}</p>
                </dialog>
            </div>}
            {!showEditor ? null : Editor ? <div className={styles.sharedEditor} role="group" aria-label={sourceLabel}
                data-cp1-source-editor><React.Suspense fallback={fallback}>
                    <Editor value={this.state.source} lang="cp1" onChange={text => this._setSource(text)} isVisible />
                </React.Suspense></div> : fallback}
            {view.current ? <p className={styles.hint} data-cp1-current-source>
                {this._t('currentSource', {line: view.current.line, address: cellText(view.current.address)})}
                {' '}<mark>{view.current.source}</mark></p> : null}
            {view.sourceMismatch ? <p className={styles.hint} data-cp1-source-mismatch>{this._t('sourceMismatch')}</p> : null}
            {view.rows.length ? <details className={styles.listing} open={compact ? undefined : true}>
                <summary>{this._t('executionListing')}</summary>
                <div className={styles.tableScroll}><table className={styles.table} data-cp1-source-listing>
                    <thead><tr>{['breakpoint', 'address', 'instruction', 'line', 'source'].map(key =>
                        <th key={key} scope="col">{this._t(key)}</th>)}</tr></thead>
                    <tbody>{view.rows.map(row => <tr key={row.address} data-cp1-source-cell={row.address}
                        aria-current={row.current ? 'step' : undefined}>
                        <td><button type="button" data-cp1-breakpoint={row.address} aria-pressed={row.breakpoint}
                            aria-label={this._t('breakpointAt', {address: row.address})}
                            disabled={!view.qualified || this.state.busy || !this.props.onToggleBreakpoint}
                            onClick={() => this._action(() => this.props.onToggleBreakpoint(row.address))}>
                            {row.breakpoint ? '●' : '○'}</button></td>
                        <th scope="row">{cellText(row.address)}</th>
                        <td>{String(row.opcode).padStart(2, '0')}.{cellText(row.operand)}</td>
                        <td>{row.line}</td><td><code>{row.source}</code>
                            {!row.matchesMemory ? <span className={styles.draftLabel}>{this._t('sourceDiffers')}</span> : null}</td>
                    </tr>)}</tbody>
                </table></div>
            </details> : null}
        </div>;
    }

    _renderMemory (snapshot, view) {
        const capacity = this.props.expansion ? 256 : 128;
        const page = Math.min(this.state.memoryPage, capacity / 16 - 1);
        const sourceRows = new Map(view.rows.filter(row => row.matchesMemory).map(row => [row.address, row]));
        return <div>
            <p className={styles.hint}>{this._t('memoryHint')}</p>
            <div className={styles.tableScroll}><table className={styles.table}>
                <thead><tr>{['address', 'opcode', 'operand', 'line'].map(key => <th key={key} scope="col">{this._t(key)}</th>)}</tr></thead>
                <tbody>{Array.from({length: 16}, (_, offset) => {
                    const address = page * 16 + offset;
                    const cell = snapshot && snapshot.cells && snapshot.cells[address];
                    return <tr key={address} aria-current={view.currentAddress === address ? 'step' : undefined}>
                        <th scope="row">{cellText(address)}</th>
                        <td>{cell ? cellText(cell.opcode) : '—'}</td><td>{cell ? cellText(cell.operand) : '—'}</td>
                        <td>{sourceRows.has(address) ? sourceRows.get(address).line : '—'}</td></tr>;
                })}</tbody>
            </table></div>
            <div className={styles.actions}>
                <button type="button" disabled={page === 0} onClick={() => this.setState({memoryPage: page - 1})}>{this._t('previous')}</button>
                <span>{page * 16}–{page * 16 + 15} / {capacity}</span>
                <button type="button" disabled={(page + 1) * 16 >= capacity} onClick={() => this.setState({memoryPage: page + 1})}>{this._t('next')}</button>
            </div>
            {this.props.onWriteCell ? <form className={styles.cellEditor} onSubmit={event => { event.preventDefault(); this._writeCell(); }}>
                {[['editAddress', 'address', capacity - 1], ['editOpcode', 'opcode', 255], ['editOperand', 'operand', 255]].map(([field, label, max]) =>
                    <label className={styles.field} key={field}>{this._t(label)}<input type="number" min="0" max={max} step="1"
                        value={this.state[field]} disabled={this.props.running || this.state.busy}
                        onChange={event => this.setState({[field]: event.target.value})} /></label>)}
                <button type="submit" disabled={this.props.running || this.state.busy}>{this._t('write')}</button>
            </form> : null}
        </div>;
    }

    _renderPorts (snapshot) {
        const ports = snapshot && snapshot.ports || {};
        const names = this.props.expansion ? ['P1', 'P2', 'P3', 'P4', 'P5'] : ['P1', 'P2'];
        return <div>
            <div className={styles.tableScroll}><table className={styles.table}>
                <thead><tr>{['port', 'value', 'latch', 'direction', 'input'].map(key => <th key={key} scope="col">{this._t(key)}</th>)}</tr></thead>
                <tbody>{names.map(name => <tr key={name}><th scope="row">{name}</th>
                    <td>{hex(ports[name] && ports[name].value)}</td><td>{hex(ports[name] && ports[name].latch)}</td>
                    <td>{ports[name] && ports[name].direction !== undefined ? String(ports[name].direction) : '—'}</td>
                    <td>{hex(ports[name] && ports[name].input)}</td></tr>)}</tbody>
            </table></div>
            {this.props.onPortInput ? <div className={styles.portInputs}>
                <p className={styles.hint}>{this._t('inputHint')}</p>
                {(this.props.expansion ? ['P1', 'P3'] : ['P1']).map(name => <fieldset key={name}>
                    <legend>{name}</legend><div className={styles.bitInputs}>
                        {Array.from({length: 8}, (_, bit) => <label key={bit}>
                            <input type="checkbox" aria-label={this._t('bit', {port: name, bit})}
                                checked={Boolean(ports[name] && (ports[name].input & (1 << bit)))}
                                disabled={!ports[name] || this.state.busy}
                                onChange={event => this.props.onPortInput(name, event.target.checked ?
                                    ports[name].input | (1 << bit) : ports[name].input & ~(1 << bit))} />
                            {bit}
                        </label>)}
                    </div>
                </fieldset>)}
            </div> : null}
        </div>;
    }

    _renderSourceStatus () {
        return <React.Fragment>
            {this.state.errors.length ? <div role="alert" className={styles.errors} aria-label={this._t('error')}>
                {this.state.errors.map((error, index) => <p key={index}>{error.line ? this._t('lineError', error) : error.message}</p>)}
            </div> : null}
            <div className={styles.notice} role="status">{this.state.busy ? this._t('busy') : this.state.notice}</div>
        </React.Fragment>;
    }

    _renderMonitorBar (ready, debug = false, rom = null, view = null, snapshot = null) {
        const {running, expansion, expansionDisabled, onExpansionChange, onPause, onRun, onStep, onReset} = this.props;
        const {busy} = this.state;
        const status = this._t(ready ? (running ? 'running' : 'paused') : 'noRom');
        return <header className={styles.monitorBar} aria-label={this._t('title')}>
            <strong className={styles.monitorName} title={this._t('title')}>{this._t('title')}</strong>
            {debug && onExpansionChange ? <label className={styles.expansionToggle}
                title={`${this._t('expansion')} · ${this._t(expansion ? 'expanded' : 'base')}`}>
                <input type="checkbox" aria-label={this._t('expansion')} checked={expansion}
                    disabled={expansionDisabled || busy} onChange={event => onExpansionChange(event.target.checked)} />
                <span aria-hidden="true">{expansion ? 'CP3 · 256' : '128'}</span>
            </label> : <span className={styles.monitorBadge} title={this._t(expansion ? 'expanded' : 'base')}>
                {expansion ? '256' : '128'}
            </span>}
            {!ready && this._iconButton(this._t('useIndependentRom'), '▣',
                {disabled: busy, onClick: () => this._loadIndependentRom()})}
            {(!ready || debug) && this._iconButton(this._t('importRom'), '↗',
                {disabled: busy, onClick: () => this._romInput.current.click()})}
            {(ready || !debug && onRun) && this._iconButton(this._t(running ? 'pause' : 'run'), running ? 'Ⅱ' : '▶',
                {disabled: busy || !(running ? onPause : onRun),
                    onClick: () => { this._releaseAll(); return running ? onPause() : onRun(); }})}
            {debug && ready && this._iconButton(this._t('step'), '▸|',
                {disabled: running || busy || !onStep, onClick: () => onStep()})}
            {debug && ready && onReset && this._iconButton(this._t('reset'), '↺',
                {disabled: busy, onClick: () => { this._releaseAll(); return onReset(); }})}
            {debug && <React.Fragment>
                {this._iconButton(this._t('debuggerHelp'), 'ⓘ', {
                    'aria-haspopup': 'dialog',
                    'data-cp1-semantic': view && !view.qualified ? 'unavailable' : undefined,
                    onClick: () => this._debugHelp.current.showModal()
                })}
                <dialog ref={this._debugHelp} className={styles.helpDialog} aria-label={this._t('debuggerHelp')}>
                    <form method="dialog"><button type="submit">{this._t('close')}</button></form>
                    <p><strong>{status}</strong></p>
                    <p>{this._t('stepHint')}</p>
                    <p>{this._t('keyboard')}</p>
                    {view && !view.qualified && <p>{this._t('semanticUnavailable')}</p>}
                    <details>
                        <summary>{this._t('diagnostics')}</summary>
                        <p>{this._t('raw')}: {cp1DisplayDigits(snapshot?.display).map(hex).join(' ')}</p>
                        {snapshot?.cpu && <p>8049 PC {hex(snapshot.cpu.pc)} · A {hex(snapshot.cpu.a)} ·
                            {' '}PSW {hex(snapshot.cpu.psw)} · {snapshot.cpu.cycles} {this._t('cycles')}</p>}
                        {rom && <p>{rom.name || 'ROM'} · SHA-256 {rom.sha256}. {this._t('romLocal')}</p>}
                    </details>
                </dialog>
            </React.Fragment>}
        </header>;
    }

    _renderSurfaceViews (snapshot, view, ready) {
        const slots = this.context;
        return <React.Fragment>
            {slots?.code && createPortal(<section className={`${styles.root} ${styles.codeEditor}`} data-cp1-code-editor data-color-mode={this.props.colorMode}>
                {this._renderProgram(view, ready, true, slots.Editor)}
                {this._renderSourceStatus()}
            </section>, slots.code)}
            {slots?.controller && createPortal(<section className={styles.root} data-cp1-controller-face data-controller-widget="cp1"
                tabIndex={0} onKeyDown={this._onKeyDown}
                onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) this._releaseAll(); }}>
                {this._renderMonitorBar(ready)}
                {this._renderDisplay(snapshot && snapshot.display)}
                {this._renderKeypad(ready)}
            </section>, slots.controller)}
        </React.Fragment>;
    }

    render () {
        const snapshot = this.props.snapshot || this.state.snapshot;
        const ready = Boolean(snapshot || this.props.machine);
        const rom = this.props.romReference || this.state.importedRom;
        const debugView = cp1DebugView(snapshot, this.state.source, {expansion: Boolean(this.props.expansion)});
        return <React.Fragment><section className={styles.root} data-cp1-panel="true" data-color-mode={this.props.colorMode}
            tabIndex={0} onKeyDown={this._onKeyDown}
            onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) this._releaseAll(); }}>
            {this._renderMonitorBar(ready, true, rom, debugView, snapshot)}
            {!this.context?.Editor && this._renderDisplay(snapshot && snapshot.display)}
            {!this.context?.Editor && this._renderKeypad(ready)}
            {debugView.qualified && this._renderSemantic(debugView)}
            <div className={styles.tabs} role="group" aria-label={this._t('title')}>
                {['program', 'memory', 'ports'].map(view => <button key={view} type="button" aria-pressed={this.state.view === view}
                    onClick={() => this.setState({view})}>{this._t(view)}</button>)}
            </div>
            {this.state.view === 'program' ? this._renderProgram(debugView, ready) : this.state.view === 'memory' ? this._renderMemory(snapshot, debugView) : this._renderPorts(snapshot)}
            {this._renderSourceStatus()}
            {this.props.children}
            <input ref={this._romInput} className={styles.hidden} type="file" accept=".bin,.rom,application/octet-stream"
                aria-label={this._t('importRom')} onChange={event => {
                    const file = event.target.files && event.target.files[0];
                    event.target.value = '';
                    this._importRom(file);
                }} />
            <input ref={this._sourceInput} className={styles.hidden} type="file" accept=".cp1,.asm,.txt,text/plain"
                aria-label={this._t('openSource')} onChange={event => {
                    const file = event.target.files && event.target.files[0];
                    event.target.value = '';
                    this._openSource(file);
                }} />
        </section>
        {this._renderSurfaceViews(snapshot, debugView, ready)}
        </React.Fragment>;
    }
}

Cp1Panel.contextType = Cp1Surfaces;
Cp1Panel.propTypes = {
    machine: PropTypes.object, snapshot: PropTypes.object, running: PropTypes.bool,
    expansion: PropTypes.bool, expansionDisabled: PropTypes.bool, onExpansionChange: PropTypes.func, clockHz: PropTypes.number, locale: PropTypes.string,
    colorMode: PropTypes.string, source: PropTypes.string, romReference: PropTypes.object,
    onRunProgram: PropTypes.func, onSourceChange: PropTypes.func, onKey: PropTypes.func, onReleaseKeys: PropTypes.func,
    onRun: PropTypes.func, onPause: PropTypes.func, onStep: PropTypes.func, onReset: PropTypes.func,
    onStepCommand: PropTypes.func, onToggleBreakpoint: PropTypes.func,
    onLoad: PropTypes.func, onWriteCell: PropTypes.func, onPortInput: PropTypes.func,
    onImportRom: PropTypes.func, onSaveProject: PropTypes.func, children: PropTypes.node
};
Cp1Panel.defaultProps = {running: false, expansion: false, clockHz: 6000000};

export default Cp1Panel;
