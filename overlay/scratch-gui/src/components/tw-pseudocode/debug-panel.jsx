import React from 'react';
import {s040PartIds} from '../../lib/bw-debug/s040-part-ids.js';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';

import DebugDrawer from './debug-drawer.jsx';
import Cp1Host from './cp1-host.jsx';
import DebugInspector from './debug-inspector.jsx';
import DebugPipeline from './debug-pipeline.jsx';
import DebugFrames from './debug-frames.jsx';
import DebugTimingWaveform from './debug-timing-waveform.jsx';
import DebugSessionTransfer from './debug-session-transfer.jsx';
import DebugDivergenceBisection from './debug-divergence-bisection.jsx';
import DebugCorrelatedTargets from './debug-correlated-targets.jsx';
import {mergeTargetKinds} from '../../lib/bw-debug/target-kinds.js';
import {reverseCycleControlStatus} from '../../lib/bw-debug/reverse-cycle-ui.js';
import {createRunnerOwnership} from '../../lib/bw-debug/runner-ownership.js';
import {ps2ButtonBit, ps2Delta} from '../../lib/bw-machines/ps2-pointer.js';
import {promptAsync} from '../../lib/native-dialog.js';
import {createRawHddDownload} from '../../lib/bw-machines/raw-hdd-download.js';

// VDP screen — lazy-loaded, only renders when the runner has video output.
const PortLeds = React.lazy(() =>
    import(/* webpackChunkName: "bw-debug-faces" */ 'bw-circuit-ui/components/PortLeds.jsx')
        .then(m => ({default: m.PortLeds}))
);
const SwitchPanel = React.lazy(() =>
    import(/* webpackChunkName: "bw-debug-faces" */ 'bw-circuit-ui/components/SwitchPanel.jsx')
        .then(m => ({default: m.SwitchPanel}))
);
// The Linux lesson's terminal (xterm.js) — lazy, its own chunk, only for a booted Linux.
const LinuxTerminal = React.lazy(() =>
    import(/* webpackChunkName: "bw-xterm" */ './linux-terminal.jsx')
);
const VdpScreen = React.lazy(() =>
    import(/* webpackChunkName: "bw-debug-faces" */ 'bw-circuit-ui/components/VdpScreen.jsx')
        .then(m => ({default: m.VdpScreen}))
);

/**
 * The debugger's controls: ⚑ ⏸ ⏭ ⏹, a speed dial, and what the program is doing.
 *
 * Design: `sb3-creator/reference/debugger-ui.md`. Two things it deliberately gets right:
 *
 * 1. **`block` is the only step verb here.** It is the one kind every target supports —
 *    emulator, ucsim, and the on-chip monitor — and "run to the next yield" is what a
 *    Scratch user means by "next". `insn` / `over` / `out` belong in the advanced drawer,
 *    which does not exist yet; `line` is refused outright by the target and is not offered.
 * 2. **A control that cannot work says why.** Capabilities are queried, never assumed, and
 *    a disabled button carries its reason in the tooltip. A dead button that explains
 *    itself teaches the hardware; a dead button that does not reads as a bug.
 *
 * **Why it lives in the Circuit tab rather than the stage header**, which is what the design
 * note describes: the stage header is shown for EVERY project, including pure Scratch ones,
 * where a debugger strip is meaningless. Putting it there means teaching shared chrome to
 * detect hardware projects. The Circuit tab is already the hardware surface, already gated,
 * and already shows the board you want to watch while stepping. The glow lands in the Blocks
 * tab either way — `vm.runtime.glowBlock` does not care which tab is open. Moving the strip
 * into the stage header, once the chrome knows what an STC project is, changes nothing here.
 */

const L10N = {
    en: {
        run: 'Run', pause: 'Pause', step: 'Step', reverseStep: 'Reverse Step', reverseCycle: 'Reverse Cycle',
        reverseContinue: 'Reverse Continue', stop: 'Stop',
        speed: 'Speed', idle: 'not running', building: 'building…', attaching: 'starting…',
        ready: 'ready', running: 'running', paused: 'paused', stepping: 'stepping…',
        error: 'error',
        hddDownload: 'Download HDD image + JSON',
        hddDownloadHint: 'Download a detached paused master-disk copy and its geometry/hash metadata',
        hddDownloadPreparing: 'Preparing HDD image and metadata…',
        hddDownloadInitiated: 'HDD image and JSON downloads initiated; check browser downloads. This is not a guest flush.',
        stepHint: 'Run to the next block boundary',
        serialHint: 'type a line, Enter sends it',
        terminalHint: 'Click the terminal and type: every key goes straight to Linux. ' +
            'Ctrl-C interrupts, arrows recall history, Ctrl-Shift-V pastes. 80×24.',
        serialSend: 'Send this line to the machine (ends with CR)',
        modem: 'Blinkenrocket audio modem',
        modemHint: 'message for the badge',
        modemSend: 'Encode and transmit this message on PA0/ADC6',
        modemSent: 'transmitted',
        firmwareRunning: 'running',
        firmwareLoaded: 'loaded',
        noImageLoaded: 'No program or firmware loaded in the debugger.',
        savePoint: 'Save point',
        engineReverse: 'Reverse (slower)',
        engineReverseTitle: 'Record every instruction so Reverse Step / Reverse Continue work here — the run is much slower while this is on',
        savePointTitle: 'Remember this exact moment; ↺ returns here',
        restorePointTitle: 'Return the chip to this save point',
        engineFault: 'Firmware fault',
        engineFidelity: 'The engine skipped something here — the run may not match the chip',
        labwiredChipProject: 'project board',
        labwiredChipTitle: 'Choose the project board, an addressed ELF, a supported Cortex-M UF2, or explicit ESP32-S3 merged-flash boot',
        esp32s3Flash: 'ESP32-S3 ROM boot (merged .bin)',
        esp32s3Console: 'Console output',
        esp32s3Both: 'Both (diagnostics)',
        esp32s3FlashHint: 'Merged ESP32-S3 .bin at flash offset zero: bootloader, partition table and application. App-only images are refused.',
        firmwareBack: 'Blocks',
        firmwareBackTitle: 'Stop running this image and go back to debugging the blocks program',
        firmwareBareChip: 'No circuit is drawn, so this image runs on the bare chip: pins, serial and stepping all work. Draw a circuit in the Circuit tab to wire parts to its pins.',
        consumes: 'Debugging this board uses:',
        lwCaveats: 'Heavy tier, one known limit: analog inputs are not injected — a pot or ' +
            'LDR reads the engine’s own counter, not the voltage this board solves. ' +
            'Use the light tier for analog work.',
        pausedAt: 'Paused at', afterMs: 'after',
        noPins: 'Declare pins in the Code tab to debug this project.',
        bps: 'Pause points', noBps: 'Right-click a block and choose “Pause here”.',
        skipped: 'hits passed over — a wait is re-entered constantly, and conditions filter the rest',
        unreachable: 'cannot be stopped at',
        unreachableWhy: 'The program only stops at a wait or a loop, so these marks have ' +
            'nowhere to land in this build. They are kept in case a later edit gives them one.',
        yieldNote: 'The program can only stop at a wait or a loop — so the highlight marks ' +
            'the last one it passed, not every block in between.',
        watchHit: 'Stopped on a write to',
        watchWas: 'was',
        watchNow: 'now',
        watchNote: 'A watchpoint here reports a CHANGE, not every store: writing the value ' +
            'that is already there is invisible, and a byte the peripherals move fires ' +
            'with no instruction of yours responsible.',
        record: 'Record', recording: 'Recording', checkpoint: 'Checkpoint', restore: 'Restore',
        recordUnsupported: 'This target cannot capture a complete deterministic checkpoint',
        reverseHint: 'Restore and replay to the previous recorded instruction',
        reverseCycleHint: 'Restore and verify replay to the previous recorded hardware cycle',
        reverseContinueHint: 'Restore and replay to the previous recorded breakpoint halt',
        timeline: 'Timeline', timelineRefresh: 'Read events', timelineOlder: 'Older',
        timelineNewer: 'Newer', timelineLatest: 'Latest', timelineCheckpoint: 'Last checkpoint',
        timelineGoSelected: 'Go to selected',
        history: 'History', target: 'Target', firmwareFile: 'Load firmware file',
        timelineGoSelectedHint: 'Restore and replay to the selected event boundary',
        actionActivity: 'Breakpoint actions', actionFailures: 'Failures',
        actionLog: 'Log', actionCounters: 'Counters', actionEvent: 'event'
    },
    de: {
        run: 'Start', pause: 'Pause', step: 'Schritt', reverseStep: 'Zurück', reverseCycle: 'Takt zurück',
        reverseContinue: 'Zurück fortsetzen', stop: 'Stopp',
        speed: 'Tempo', idle: 'läuft nicht', building: 'wird gebaut…', attaching: 'startet…',
        ready: 'bereit', running: 'läuft', paused: 'angehalten', stepping: 'Schritt…',
        error: 'Fehler',
        stepHint: 'Bis zur nächsten Blockgrenze laufen',
        serialHint: 'Zeile eingeben, Enter sendet',
        terminalHint: 'Ins Terminal klicken und tippen: jede Taste geht direkt an Linux. ' +
            'Strg-C bricht ab, Pfeiltasten holen frühere Befehle, Strg-Umschalt-V fügt ein. 80×24.',
        serialSend: 'Diese Zeile an die Maschine senden (endet mit CR)',
        modem: 'Blinkenrocket-Audiomodem',
        modemHint: 'Nachricht für das Badge',
        modemSend: 'Diese Nachricht kodieren und an PA0/ADC6 senden',
        modemSent: 'gesendet',
        firmwareRunning: 'läuft',
        firmwareLoaded: 'geladen',
        noImageLoaded: 'Im Debugger ist noch kein Programm oder Firmware-Abbild geladen.',
        savePoint: 'Speicherpunkt',
        engineReverse: 'Rückwärts (langsamer)',
        engineReverseTitle: 'Jeden Befehl aufzeichnen, damit Rückwärts-Schritt / -Fortsetzen hier gehen — der Lauf ist dabei deutlich langsamer',
        savePointTitle: 'Diesen Moment merken; ↺ kehrt hierher zurück',
        restorePointTitle: 'Den Chip auf diesen Speicherpunkt zurücksetzen',
        engineFault: 'Firmware-Fehler',
        engineFidelity: 'Die Engine hat hier etwas übersprungen — der Lauf entspricht evtl. nicht dem Chip',
        labwiredChipProject: 'Projekt-Board',
        labwiredChipTitle: 'Projekt-Board, adressiertes ELF, unterstütztes Cortex-M-UF2 oder ESP32-S3-ROM-Start mit zusammengeführtem Flash-Abbild wählen',
        esp32s3Flash: 'ESP32-S3-ROM-Start (zusammengeführte .bin)',
        esp32s3Console: 'Konsolenausgabe',
        esp32s3Both: 'Beide (Diagnose)',
        esp32s3FlashHint: 'Zusammengeführte ESP32-S3-.bin ab Flash-Adresse null: Bootloader, Partitionstabelle und Anwendung. Reine App-Abbilder werden abgelehnt.',
        firmwareBack: 'Blöcke',
        firmwareBackTitle: 'Dieses Abbild beenden und wieder das Blockprogramm debuggen',
        firmwareBareChip: 'Es ist keine Schaltung gezeichnet, daher läuft dieses Abbild auf dem nackten Chip: Pins, Seriell und Einzelschritte funktionieren. Zeichne im Circuit-Tab eine Schaltung, um Bauteile an seine Pins anzuschließen.',
        consumes: 'Das Debuggen dieser Platine belegt:',
        lwCaveats: 'Schwere Stufe, eine bekannte Grenze: Analogeingänge werden nicht ' +
            'eingespeist — ein Poti oder LDR liest den internen Zähler der Engine, nicht die ' +
            'Spannung, die diese Platine löst. Für Analoges die leichte Stufe verwenden.',
        pausedAt: 'Angehalten bei', afterMs: 'nach',
        noPins: 'Für das Debuggen im Code-Tab Pins deklarieren.',
        bps: 'Haltepunkte', noBps: 'Rechtsklick auf einen Block, dann „Hier anhalten“.',
        skipped: 'übergangene Treffer — ein Warten wird ständig neu betreten, Bedingungen filtern den Rest',
        unreachable: 'nicht anhaltbar',
        unreachableWhy: 'Das Programm hält nur bei einem Warten oder einer Schleife an; diese ' +
            'Markierungen haben in diesem Build keinen Platz. Sie bleiben erhalten, falls eine ' +
            'spätere Änderung einen schafft.',
        yieldNote: 'Das Programm kann nur bei einem Warten oder einer Schleife anhalten — die ' +
            'Markierung zeigt also die letzte solche Stelle, nicht jeden Block dazwischen.',
        watchHit: 'Angehalten bei einem Schreibzugriff auf',
        watchWas: 'war',
        watchNow: 'jetzt',
        watchNote: 'Ein Watchpoint meldet hier eine ÄNDERUNG, nicht jeden Schreibzugriff: ' +
            'denselben Wert erneut zu schreiben bleibt unsichtbar, und ein Byte, das die ' +
            'Peripherie bewegt, löst aus, ohne dass eine deiner Anweisungen schuld ist.',
        record: 'Aufzeichnen', recording: 'Aufzeichnung', checkpoint: 'Prüfpunkt', restore: 'Wiederherstellen',
        recordUnsupported: 'Dieses Ziel kann keinen vollständigen deterministischen Prüfpunkt erfassen',
        reverseHint: 'Zum vorherigen aufgezeichneten Befehl zurückkehren und verifiziert abspielen',
        reverseCycleHint: 'Zum vorherigen aufgezeichneten Hardwaretakt zurückkehren und verifiziert abspielen',
        reverseContinueHint: 'Zum vorherigen aufgezeichneten Haltepunkt zurückkehren und verifiziert abspielen',
        timeline: 'Zeitleiste', timelineRefresh: 'Ereignisse lesen', timelineOlder: 'Älter',
        timelineNewer: 'Neuer', timelineLatest: 'Neueste', timelineCheckpoint: 'Letzter Prüfpunkt',
        timelineGoSelected: 'Zur Auswahl springen',
        history: 'Verlauf', target: 'Zielsystem', firmwareFile: 'Firmwaredatei laden',
        timelineGoSelectedHint: 'Bis zur ausgewählten Ereignisgrenze wiederherstellen und abspielen',
        actionActivity: 'Haltepunkt-Aktionen', actionFailures: 'Fehler',
        actionLog: 'Protokoll', actionCounters: 'Zähler', actionEvent: 'Ereignis'
    }
};

const BTN = {
    padding: '6px 12px', borderRadius: 4, border: '1px solid #2c3e50',
    background: '#16213e', color: '#ecf0f1', fontFamily: 'monospace', fontSize: 12,
    cursor: 'pointer'
};
const OFF = {...BTN, color: '#4a5568', cursor: 'not-allowed'};

class DebugPanel extends React.Component {
    constructor (props) {
        super(props);
        // The target is chosen BEFORE a runner exists, so it lives here rather
        // than in the runner: picking "Live board" and then pressing Run is the
        // order a user works in.
        this.state = {runner: null, ui: {phase: 'idle', message: ''}, kind: 'emulator', kinds: null,
            labwiredChip: '', labwiredChips: null, esp32S040McuId: '', esp32s3Console: 'uart0', samdInputError: null,
            machineConfig: null, serialInput: '', modemInput: '', modemStatus: null,
            firmwareName: null,
            recordingStatus: null, reverseStatus: null, timelineStatus: null,
            sessionTransferStatus: null, hddDownloadStatus: null, hddDownloadBusy: false};
        // Only the runner the panel currently owns may publish into it; see
        // lib/bw-debug/runner-ownership.js for the replaced-runner race.
        this._runnerOwnership = createRunnerOwnership();
        this._samdPressed = new Set();
        this._hddDownloadMounted = false;
        this._hddDownloadToken = {};
        this._hddDownloadRunner = null;
        this._hddDownloadPhase = 'idle';
        this._hddDownloadHalt = undefined;
        this._hddDownload = null;
        this._hddDownloadPending = false;
        this.onHddDownload = this.onHddDownload.bind(this);
        this.onStart = this.onStart.bind(this);
        this.onPause = this.onPause.bind(this);
        this.onStep = this.onStep.bind(this);
        this.onReverseStep = this.onReverseStep.bind(this);
        this.onReverseCycle = this.onReverseCycle.bind(this);
        this.onReverseContinue = this.onReverseContinue.bind(this);
        this.onStop = this.onStop.bind(this);
        this.onSpeed = this.onSpeed.bind(this);
        this.onSerialInput = this.onSerialInput.bind(this);
        this.onSerialKeyDown = this.onSerialKeyDown.bind(this);
        this.onSerialSend = this.onSerialSend.bind(this);
        this.onModemInput = this.onModemInput.bind(this);
        this.onModemKeyDown = this.onModemKeyDown.bind(this);
        this.onModemSend = this.onModemSend.bind(this);
        this.onRecord = this.onRecord.bind(this);
        this.onCheckpoint = this.onCheckpoint.bind(this);
        this.onRestoreLast = this.onRestoreLast.bind(this);
        this.onTimelineRefresh = this.onTimelineRefresh.bind(this);
        this.onTimelineOlder = this.onTimelineOlder.bind(this);
        this.onTimelineNewer = this.onTimelineNewer.bind(this);
        this.onTimelineLatest = this.onTimelineLatest.bind(this);
        this.onTimelineCheckpoint = this.onTimelineCheckpoint.bind(this);
        this.onTimelineGoSelected = this.onTimelineGoSelected.bind(this);
        this.onWaveformSelect = this.onWaveformSelect.bind(this);
        this.onWaveformZoom = this.onWaveformZoom.bind(this);
        this.onWaveformPan = this.onWaveformPan.bind(this);
        this.onWaveformSetTrigger = this.onWaveformSetTrigger.bind(this);
        this.onWaveformPreviousTrigger = this.onWaveformPreviousTrigger.bind(this);
        this.onWaveformNextTrigger = this.onWaveformNextTrigger.bind(this);
        this.onWaveformExport = this.onWaveformExport.bind(this);
        this.onDebugSessionExport = this.onDebugSessionExport.bind(this);
        this.onDebugSessionImport = this.onDebugSessionImport.bind(this);
        this.onBisectionMarkGood = this.onBisectionMarkGood.bind(this);
        this.onBisectionMarkBad = this.onBisectionMarkBad.bind(this);
        this.onBisectionStart = this.onBisectionStart.bind(this);
        this.onBisectionCancel = this.onBisectionCancel.bind(this);
        this.onCorrelatedTarget = this.onCorrelatedTarget.bind(this);
        this.onCorrelatedEvent = this.onCorrelatedEvent.bind(this);
        this.onCorrelatedTrigger = this.onCorrelatedTrigger.bind(this);
        this.onCorrelatedCause = this.onCorrelatedCause.bind(this);
        this.onCorrelatedCheckpoint = this.onCorrelatedCheckpoint.bind(this);
        this.onCorrelatedRestore = this.onCorrelatedRestore.bind(this);
        this.syncProjectTokens = this.syncProjectTokens.bind(this);
        this.onGreenFlag = this.onGreenFlag.bind(this);
        this._onMachineExtracted = this._onMachineExtracted.bind(this);
        this._onMediaLoad = this._onMediaLoad.bind(this);
        this._onAsmRomReady = this._onAsmRomReady.bind(this);
        /** Boot image handed over by the Machine Loader / ASM tab —
         *  {slot, bytes, profile, name, romAt}. Kept off state: the bytes are
         *  runner input, not render input. */
        this._bootMedia = null;
        /** STABLE identity, bound once: the panel re-renders on every
         *  runner emit (rAF cadence), and an inline arrow here gave
         *  VdpScreen a new videoFn each render — its paint effect then
         *  cancelled and rescheduled its own rAF every frame, so the
         *  paint callback never once ran and the screen stayed black
         *  while the machine rendered perfect frames behind it. */
        /** STABLE identity, bound once -- same reason as _videoFn below. An
         *  inline arrow here would give VdpScreen a new sendScancodeFn every
         *  render, and its key handlers are useCallback'd on that prop, so
         *  every render would rebuild them. Returns undefined when the runner
         *  has no keyIn, which is how VdpScreen decides not to offer a
         *  keyboard at all. */
        /** STABLE identity, bound once -- SwitchPanel's toggle handler is
         *  useCallback'd on it, so an inline arrow would rebuild every
         *  switch's handler on every runner emit (rAF cadence). */
        /** STABLE identity, bound once -- PortLeds calls it on every render
         *  and an inline arrow would defeat any memoisation above it. */
        this._outputsFn = () => {
            const r = this.state.runner;
            return r && typeof r.outputs === 'function' ? r.outputs() : null;
        };
        this._setInputFn = (chip, port, bit, level) => {
            const r = this.state.runner;
            return r && typeof r.setInput === 'function'
                ? r.setInput(chip, port, bit, level) : false;
        };
        this._scancodeFn = (sc) => {
            const r = this.state.runner;
            if (r && typeof r.keyIn === 'function') r.keyIn(sc);
        };
        this._videoFn = () => {
            const r = this.state.runner;
            return r && typeof r.video === 'function' ? r.video() : null;
        };
        this._mousePoint = null;
        this._mouseButtons = 0;
        this._mouseMove = e => {
            const point = {x: e.clientX, y: e.clientY};
            const previous = this._mousePoint;
            this._mousePoint = point;
            if (!previous) return;
            const dx = ps2Delta(point.x - previous.x);
            const dy = ps2Delta(point.y - previous.y);
            if (dx || dy) this._mouseFn({dx, dy, buttons: this._mouseButtons});
        };
        this._mouseDown = e => {
            e.preventDefault();
            e.currentTarget.querySelector('[data-vdp-screen]')?.focus();
            this._mousePoint = {x: e.clientX, y: e.clientY};
            this._mouseButtons |= ps2ButtonBit(e.button);
            this._mouseFn({dx: 0, dy: 0, buttons: this._mouseButtons});
        };
        this._mouseUp = e => {
            this._mouseButtons &= ~ps2ButtonBit(e.button);
            this._mouseFn({dx: 0, dy: 0, buttons: this._mouseButtons});
        };
        this._mouseLeave = () => {
            this._mousePoint = null;
            if (this._mouseButtons) {
                this._mouseButtons = 0;
                this._mouseFn({dx: 0, dy: 0, buttons: 0});
            }
        };
        this._mouseFn = event => this.state.runner?.mouseIn?.(event) ?? false;
    }

    /** Build Machine succeeded: the bus extractor's {regions, chips}.
     *  Stored, and any live runner destroyed, so the NEXT boot threads
     *  the config into createDebugTarget — the machine the user wired,
     *  not a hardcoded preset. */
    _onMachineExtracted (e) {
        const detail = e.detail || {};
        if (!detail.config) return;
        this._teardownRunner();
        // Build Machine can happen AFTER an example has already delivered its
        // ROM. Extraction changes the wiring/config, not the disk/ROM sitting
        // in the loader; dropping _bootMedia here made the visible Sim control
        // run an all-zero image. Keep the media and recreate the runner so the
        // newly extracted machine and the already loaded image boot together.
        if (detail.kind === 'cp1' && (this.state.kind !== 'cp1' || detail.useDefaultMonitor)) {
            this._bootMedia = detail.resumeCp1 ? this._suspendedCp1Media : null;
            this._suspendedCp1Media = null;
        }
        const hasBootMedia = !!this._bootMedia;
        const kind = detail.kind === 'cp1' ? 'cp1' : detail.kind === 'z80' ? 'z80'
            : detail.kind === 'eater6502' || detail.kind === '6502' ? 'eater6502'
                : this.state.kind;
        this.setState({machineConfig: detail.config, kind, runner: null,
            ui: {phase: 'idle', message: hasBootMedia ?
                'machine extracted — loaded program ready' :
                'machine extracted — load a program (presets, file, or ASM tab)'}});
    }

    /** Machine Loader (presets / file picker) delivered an image. The
     *  runner is recreated rather than hot-patched: config and image
     *  must boot TOGETHER so the CPU reads its reset vector from the
     *  real bytes, not from a zero-filled ROM it booted with earlier. */
    async _onMediaLoad (e) {
        try {
            const consumed = await this._bootFromMedia(e);
            if (consumed) e.detail?.bootCompletion?.resolve();
        } catch (error) {
            // DOM dispatch does not await an async listener. Return attachment
            // failures to Machine Manager when it requested completion.
            if (e.detail?.bootCompletion) {
                e.detail.bootCompletion.reject(error);
                return;
            }
            throw error;
        }
    }

    async _bootFromMedia (e) {
        const {slotId, bytes, kind, profile, name, romAt, chips, widgets, geometry} = e.detail || {};
        // A RISC-V program from the local RV32IM assembler carries a loadable
        // {entry, segments} image, not a flat ROM — the one media that is not
        // `bytes`. Read on their own line so the fixed field-list gate above
        // (i8086-chips-wiring) still sees the canonical destructure unchanged.
        const {riscvImage, riscvEcallTraps} = e.detail || {};
        // A Linux kernel boots WITH its initramfs (the Machine Manager's
        // `kernel` + `initrd` slots, both sha256-checked by activateConfig).
        // Its own line, for the same fixed-field-list reason as above.
        const {linuxInitrd} = e.detail || {};
        // Its post-boot snapshot (the lesson's default Run), likewise.
        const {linuxSnapshot} = e.detail || {};
        const {nativeBlocks, machinePreset, i80386Media} = e.detail || {};
        if (!bytes && !riscvImage) return;
        // THE SAME LOAD, DELIVERED TWICE. circuit-tab stashes every media-load
        // and, when that flips it to "machine booted", re-dispatches the very
        // same detail object a frame later (for a panel that was not mounted
        // the first time). A panel that already took it would tear down the
        // machine it is booting and boot a second one — for Linux, a second
        // 64 MiB kernel. Identity, not equality: a new Run makes a new detail.
        if (e.detail && e.detail === this._lastMediaDetail) return false;
        this._lastMediaDetail = e.detail || null;
        this._teardownRunner();
        this._bootMedia = {
            slot: slotId,
            bytes: bytes ? (bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)) : null,
            riscvImage: riscvImage || null,
            riscvEcallTraps: riscvEcallTraps || false,
            linuxInitrd: linuxInitrd
                ? (linuxInitrd instanceof Uint8Array ? linuxInitrd : new Uint8Array(linuxInitrd)) : null,
            linuxSnapshot: linuxSnapshot
                ? (linuxSnapshot instanceof Uint8Array ? linuxSnapshot : new Uint8Array(linuxSnapshot)) : null,
            profile: profile || null,
            name: name || null,
            nativeBlocks: kind === 'i80386' && nativeBlocks === true,
            machinePreset: kind === 'i80386' ? machinePreset || null : null,
            i80386Media: kind === 'i80386' ? i80386Media || null : null,
            // HARDWARE THE PROGRAM ASKED FOR, and it has to be listed here
            // explicitly: this destructure is a fixed field list, so a new
            // field on the event is silently dropped unless it is named in
            // both places. An ANALOG pin's converter and a scheduled
            // program's interrupt controller both arrive this way.
            chips: chips || null,
            geometry: geometry || null,
            // WHERE the image is mapped, when the sender knows and we cannot
            // infer it. A raw .bin carries no origin, so without this the
            // runner falls back to the machine's default ROM base — and for
            // an 8086 that is wrong for every image that is not exactly 64K.
            // The loader computes `0x100000 - length` so the reset vector at
            // FFFF0h lands INSIDE the image: a 32K monitor maps at F8000h, a
            // 64K BIOS at F0000h. Dropped silently before this, and the
            // symptom is a machine that starts executing open bus and looks
            // identical to one that failed to start.
            romAt: typeof romAt === 'number' ? romAt : null
        };
        const nextKind = kind === 'cp1' ? 'cp1' : kind === 'riscv32' ? 'riscv32'
            // The RP2040 media bundle (a pico-sdk .uf2 in a `flash` slot) boots
            // on the rp2040js target from flash — debug-runner's
            // attachRp2040jsBundle, UART0 REPL on the serial terminal below.
            : kind === 'rp2040js' || kind === 'rp2040' || kind === 'pico' ? 'rp2040js'
            : kind === 'z80' ? 'z80'
            : kind === 'eater6502' || kind === '6502' ? 'eater6502'
                // All four spellings. The 8088 is an 8086 with an eight-bit
                // bus -- same ISA, same registers, same core here -- so
                // refusing it by name would refuse a machine we can run.
                : kind === 'i8086' || kind === '8086' || kind === 'i8088' || kind === '8088' ? 'i8086'
                    // The fully-free 386 is its OWN target kind, not the 8086
                    // tier: it boots the LGPL Bochs BIOS on the experimental
                    // 80386 AT machine (debug-runner's attachI80386). Mapping it
                    // onto i8086 would run a 386 boot floppy on the XT map.
                    : kind === 'i80386' || kind === '80386' ? 'i80386'
                        : this.state.kind;
        await new Promise(resolve => this.setState(
            {kind: nextKind, runner: null, ui: {phase: 'idle', message: ''}}, resolve));
        const runner = await this.runner();
        await runner.start({paused: nextKind === 'cp1'});
        // The runner reports attachment failures in state() rather than
        // rejecting start(). Promote that failure to the media completion
        // promise before the manager closes or a dead screen is mirrored.
        const bootState = e.detail?.bootCompletion ? runner.state() : null;
        if (bootState?.phase === 'error') {
            throw new Error(bootState.message || 'the 386 machine failed to attach');
        }
        // A machine that declares a screen widget (a source:'video' display in
        // its config/manifest) mirrors its framebuffer into the Widgets pane —
        // a machine's screen is a widget (design §4.2). gui.jsx owns the pump
        // (window.bwMirrorMachineVideo); guard in case this panel mounts without
        // it. A bare image with no declared screen keeps its video in the Debug
        // instrument, exactly as before — this only adds a surface, never removes
        // one. The video-widget declaration rides the media-load event's
        // `widgets` field (the machine-manager activate action supplies it).
        const screen = (Array.isArray(widgets)
            ? widgets.find(w => w && w.source === 'video') : null) ||
            (nextKind === 'i80386' ? {name: 'AT VGA', type: 'simplevga', source: 'video',
                config: {width: 640, height: 480}} : null);
        if (screen && typeof runner.video === 'function' &&
            typeof window !== 'undefined' &&
            typeof window.bwMirrorMachineVideo === 'function') {
            window.bwMirrorMachineVideo({videoFn: () => runner.video(), widget: screen,
                keyboardSet: nextKind === 'i80386' ? 'at-set1' : 'xt-set1',
                keyInFn: typeof runner.keyIn === 'function' ? sc => runner.keyIn(sc) : null,
                mouseInFn: typeof runner.mouseIn === 'function' ? event => runner.mouseIn(event) : null});
        }
        // A declared keyboard widget (source:'keyIn') steers the machine: its
        // keys are drained and fed runner.keyIn (design §4.5, the input side of
        // the screen mirror). Only when the machine can actually take keys.
        const kbd = Array.isArray(widgets)
            ? widgets.find(w => w && w.source === 'keyIn') : null;
        if (kbd && typeof runner.keyIn === 'function' &&
            typeof window !== 'undefined' &&
            typeof window.bwSteerMachineKeyboard === 'function') {
            window.bwSteerMachineKeyboard({keyInFn: sc => runner.keyIn(sc), widget: kbd});
        }
        // A machine with a sound chip plays through the browser speakers: its
        // audio() (an array of {hz,on} voices) drives Web Audio (design §4.5).
        // Automatic — a silent machine reports on:false and makes no sound; the
        // Run/boot click is the gesture that lets the browser start audio.
        if (typeof runner.audio === 'function' &&
            typeof window !== 'undefined' &&
            typeof window.bwPlayMachineAudio === 'function') {
            window.bwPlayMachineAudio({audioFn: () => runner.audio()});
        }
        return true;
    }

    /**
     * ASM tab assembled a binary — same delivery path as the loader.
     *
     * `slotId` and `profile` are carried rather than hardcoded to 'rom'
     * because a .COM/.EXE from the local 8086 assembler is NOT a ROM: the
     * runner has to know to build the DOS bench for it, and a .COM loaded as
     * a ROM at F0000 executes nothing while looking exactly like a machine
     * that failed to start. The default stays 'rom' so a hosted 6502/Z80
     * build behaves as it always did.
     */
    _onAsmRomReady (e) {
        // THE SAME PROGRAM, DELIVERED TWICE — the media-load guard in
        // _bootFromMedia, for the ASM hand-off. circuit-tab re-dispatches the
        // stashed detail a frame later (machineBooted / re-entering Circuit),
        // and every route below wraps it in a FRESH detail, so that guard never
        // matched: each assembled Run booted twice, the first runner torn down
        // mid-attach. Its late `ready` then landed over the second runner's
        // `running` ("not running — assembled image on the Searle map") — the
        // intermittent verify-debug-run-to-inspection timeout. A new Run sends
        // a new detail object, so identity is the right key here as well. Only
        // while the runner it booted lives: a repeat after something else tore
        // that runner down (an edit, a device change) still boots it again.
        if (e.detail && e.detail === this._lastAsmDetail &&
            (this._runnerPromise || this.state.runner)) return false;
        this._lastAsmDetail = e.detail || null;
        const {rom, target, slotId, profile, chips} = e.detail || {};
        // A local RV32IM build is a loadable {entry, segments} image, not a flat
        // ROM — boot it on the RISC-V bench through _onMediaLoad's riscvImage
        // path. Read on their own line so the canonical destructure above stays
        // exactly as the i8086-chips-wiring source gate asserts it.
        const {format, image} = e.detail || {};
        if (format === 'riscv' && image) {
            return this._onMediaLoad({detail: {
                kind: 'riscv32', riscvImage: image, riscvEcallTraps: false,
                name: 'assembled RISC-V program'
            }});
        }
        // A compiled Arduino sketch (the C tab's ▶ Run sketch) is an Intel HEX
        // image with no symbol table: exactly what "Load firmware" takes. It
        // goes through that same path, on the board's own engine.
        // 'firmware' is the same hand-off for any engine that runs an image
        // the page built elsewhere (N4: hosted ARM assembly on the STM32F030
        // light tier or rp2040js).
        if (format === 'avr-sketch' || format === 'firmware') return this._runSketch(e.detail);
        if (!rom) return;
        return this._onMediaLoad({detail: {
            slotId: slotId || 'rom', bytes: rom,
            profile: profile || null,
            // The chips the program's own declarations require. Carried with
            // the image because they are a property of the PROGRAM, not of
            // the board the user happened to draw.
            chips: chips || null,
            kind: target === 'z80' ? 'z80'
                : target === 'i8086' ? 'i8086' : 'eater6502',
            name: 'assembled image'
        }});
    }

    componentDidMount () {
        this._hddDownloadMounted = true;
        this.syncDeviceKind();
        // A NEW PROGRAM must not debug through the OLD program's runner:
        // loading an example kept the previous runner alive whenever the
        // device stayed the same, and the PINS panel showed the former
        // example's pins (owner report, 2026-08-17). Keyed on the pin
        // A live run survives same-pin edits. Once stopped, however, its
        // session still holds the old image; the next Run would skip build().
        // Code/Circuit navigation no longer unmounts this panel, so an edit
        // must invalidate that stopped session explicitly.
        const rt0 = this.props.vm && this.props.vm.runtime;
        this._pinSig = JSON.stringify((rt0 && rt0.stc && rt0.stc.pins) || []);
        this._onProjectChanged = () => {
            const rt = this.props.vm && this.props.vm.runtime;
            const sig = JSON.stringify((rt && rt.stc && rt.stc.pins) || []);
            const pinsChanged = sig !== this._pinSig;
            const stoppedImage = this._runnerStoppedExplicitly &&
                (this.state.runner || this._runnerPromise);
            if (this._projectChangeInvalidating || (!pinsChanged && !stoppedImage)) return;
            this._projectChangeInvalidating = true;
            this._pinSig = sig;
            this._teardownRunner();
            this.setState({runner: null, ui: {phase: 'idle', message: ''}}, () => {
                this._projectChangeInvalidating = false;
            });
        };
        if (rt0 && rt0.on) rt0.on('PROJECT_CHANGED', this._onProjectChanged);
        // The runner announces WHICH board it drives (designer / example /
        // inferred). An inferred LED-per-pin board must announce itself in
        // red instead of impersonating the example's circuit.
        this._onBoardSource = (e) => this.setState({boardSource: (e.detail && e.detail.source) || null});
        window.addEventListener('bw-board-source', this._onBoardSource);
        if (window.__bwBoardSource) this.setState({boardSource: window.__bwBoardSource.source});
        // The machine-bench pipeline: Build Machine → config; Machine
        // Loader / ASM tab → image; both meet in _onMediaLoad's reboot.
        window.addEventListener('bw-machine-extracted', this._onMachineExtracted);
        this._onCp1CircuitDetached = event => {
            this._suspendedCp1Media = event.detail?.suspended ? this._bootMedia : null;
            if (this.state.kind !== 'cp1') return;
            this._teardownRunner();
            this._bootMedia = null;
            this.setState({kind: 'emulator', machineConfig: null, runner: null,
                ui: {phase: 'idle', message: ''}}, () => this.syncDeviceKind());
        };
        window.addEventListener('bw-cp1-circuit-detached', this._onCp1CircuitDetached);
        window.addEventListener('bw-machine-media-load', this._onMediaLoad);
        window.addEventListener('bw-asm-rom-ready', this._onAsmRomReady);
        // Replay what was dispatched before this panel existed: the panel
        // mounts LAZILY in response to bw-machine-extracted, so the first
        // of these events is structurally always gone by the time the
        // listeners above are registered. circuit-tab stashes them.
        if (window.__bwMachineExtracted && window.__bwMachineExtracted.config &&
            !this.state.machineConfig) {
            this._onMachineExtracted({detail: window.__bwMachineExtracted});
        }
        // The stash is deliberately NOT cleared on consumption: the runner
        // dies with this panel (tab switches remount the whole designer),
        // and a bench that forgets its program on every tab switch is a
        // bench the ASM workflow cannot use. Replaying the last program is
        // the bench's continuity — same stance as the config replay above.
        const pending = window.__bwPendingMedia;
        let pendingReplay = null;
        if (pending) {
            pendingReplay = pending.type === 'asm'
                ? this._onAsmRomReady({detail: pending.detail})
                : this._onMediaLoad({detail: pending.detail});
        }
        // AFTER the replays: an example's auto-run token fired onStart()
        // here, BEFORE the config/media replays ran — so the token built a
        // second runner with neither, and on a machine bench that runner
        // booted the extracted machine with an EMPTY ROM, won state.runner,
        // and put a black VDP on screen while the real program ran unseen.
        // _onMediaLoad awaits setState before constructing its runner. Do not
        // let token auto-run race through that await and install a generic
        // no-pin runner first.
        if (pendingReplay) {
            Promise.resolve(pendingReplay).then(() => this.syncProjectTokens({}, true));
        } else {
            this.syncProjectTokens({}, true);
        }
        // The menu comes from bw-board, not from a list duplicated here: it owns
        // which targets exist and what each one is called.
        import(/* webpackChunkName: "bw-debug-target-kinds" */ 'bw-board/target-kinds.js')
            .then(async m => {
                if (!m.getTargetKinds) return;
                // ...plus the kinds the app can SELECT and bw-board does not
                // yet LIST. A <select> whose value matches no option shows
                // the first one instead, so an 8086 run would have read
                // "Simulated (STC12 / 8051)". See lib/bw-debug/target-kinds.js
                // — the merge is idempotent, so the upstream fix costs
                // nothing here.
                const kinds = mergeTargetKinds(m.getTargetKinds(), this.props.locale);
                // The heavy tier is offered only if its engine is actually
                // here. It is a 20 MB artifact fetched at deploy time and
                // loaded on demand, so unlike every other kind it can be
                // genuinely absent — and an entry that fails when clicked is
                // worse than one that is not there. The probe never throws:
                // absence is an answer.
                try {
                    const {isLabwiredAvailable} = await import(
                        /* webpackChunkName: "labwired-probe" */ '../../lib/labwired-engine.js');
                    if (await isLabwiredAvailable() && m.LABWIRED_KIND) kinds.push(m.LABWIRED_KIND);
                } catch (e) {
                    // Probe module missing entirely — same outcome, no entry.
                }
                this.setState({kinds});
            })
            .catch(e => {
                // Degrading to "no picker" is the right call for a genuine
                // failure, but swallowing the reason is not: if the chunk is
                // missing because the deploy moved on, this catch hides it from
                // the global stale-build recovery (which only sees UNHANDLED
                // rejections) and the user gets a silently reduced UI. Ask the
                // recovery first, and if it declines, at least say why the
                // picker is absent instead of pretending it was never there.
                const recovering = typeof window !== 'undefined' &&
                    window.__bwRecoverFromStaleBuild &&
                    window.__bwRecoverFromStaleBuild(e && e.message);
                if (!recovering) console.warn('[brickwright] target picker unavailable:', e);
            });
    }

    componentDidUpdate (prevProps) {
        this.syncDeviceKind();
        this.syncProjectTokens(prevProps, false);
        this.ensureLabwiredChips();
    }

    // The chip list for "your own firmware on the LabWired engine" — the
    // engine's own chip descriptors, a 160 KB chunk, so fetched only once the
    // LabWired engine is actually picked. Failure leaves the picker absent
    // (the project-board route still works) and says why in the console.
    ensureLabwiredChips () {
        if (this.state.kind !== 'labwired' || this.state.labwiredChips || this._labwiredChipsLoading) return;
        this._labwiredChipsLoading = true;
        import(/* webpackChunkName: "labwired-catalog" */ 'bw-board/labwired-catalog.js')
            .then(m => {
                const chips = [
                    {value: 'software:samd51-no-asf-simulation', label: 'SAMD51 software simulation (ELF / UF2)'},
                    {value: 'firmware:esp32s3-merged-flash', labelKey: 'esp32s3Flash'},
                    ...((m.LABWIRED_BOARDS || {})['esp32-4848s040'] ? [
                        {value: 'firmware:esp32-4848s040-merged-flash', label: 'ESP32-4848S040 ROM boot (merged .bin)'}
                    ] : []),
                    ...Object.values(m.LABWIRED_CATALOG || {}).map(c => ({value: c.name, label: `${c.name} (${c.arch})`})),
                    // Boards: the chip plus the devices its manifest wires, a
                    // display among them — what the firmware draws reaches Widgets.
                    ...Object.values(m.LABWIRED_BOARDS || {}).map(b => ({value: `board:${b.name}`,
                        label: b.softdevice
                            ? `${b.name} (${b.chip}, emulated ${b.softdevice.toUpperCase()} SoftDevice — .hex)`
                            : `${b.name} (${b.chip} + ${b.displays.map(d => d.type).join(', ')})`}))
                ];
                this.setState({labwiredChips: chips});
            })
            .catch(e => console.warn('[brickwright] LabWired chip list unavailable:', e))
            .finally(() => { this._labwiredChipsLoading = false; });
    }

    // When the project's DEVICE declaration changes, switch the default
    // target kind to match the architecture. The user can still override
    // it via the picker — this only sets the default so an Arduino project
    // does not start with "Simulated (emu8051)" selected.
    syncDeviceKind () {
        const rt = this.props.vm && this.props.vm.runtime;
        if (!rt) return;
        const core = rt.bwDeviceCore;
        const dev = rt.bwDeviceId;
        const cp1Selected = window.__bwMachineExtracted?.kind === 'cp1';
        const key = `${core}/${dev}/${cp1Selected}`;
        if (key === this._lastCore) return;
        this._lastCore = key;
        // Device-specific engines first: an ATtiny88 on the coarse
        // core→kind map landed on avr8js (ATmega328P memory map) — or,
        // when no core was published at all, stayed on the 8051 emulator
        // and the pendant's matrix never lit (owner report, 3791c09).
        const DEVICE_TO_KIND = {
            cp1: 'cp1', 'kosmos-cp1': 'cp1',
            attiny88: 'attiny88', attiny85: 'attiny85',
            'arduino-mega': 'atmega2560', atmega2560: 'atmega2560',
            pico: 'rp2040js', stm32f030: 'stm32f0', esp8266: 'esp8266', eater6502: 'eater6502',
            z80: 'z80', zx48: 'z80', zx128: 'z80', i8086: 'i8086',
        };
        // i8086 was MISSING from this map while the 8086 debug target,
        // extractor and machine were all present: choosing the 8086 (or
        // seating one on the board, which publishes bwDeviceCore = 'i8086')
        // left the panel on whatever engine it already had — the 8051
        // emulator by default — and the 8086 image would have been run as
        // 8051 opcodes. Plausible and wrong, which is the same shape as the
        // ATtiny88 note above.
        const CORE_TO_KIND = { cp1: 'cp1', '8049': 'cp1', '8051': 'emulator', arduino: 'avr8js', rp2040: 'rp2040js', arm: 'stm32f0', esp8266: 'esp8266', micropython: 'rp2040js', w65c02: 'eater6502', z80: 'z80', i8086: 'i8086' };
        // The user's remembered pick for THIS device wins over the map:
        // choosing an engine in the picker persists per device (see
        // onChange below), so "I always debug my Uno on the 2560 engine"
        // survives a reload. An unknown stored kind (an engine that no
        // longer exists) falls back to the map rather than a dead panel.
        let stored = null;
        try { stored = localStorage.getItem(`bw-emulator-pref:${dev}`); } catch { /* private mode */ }
        const preferred = stored || DEVICE_TO_KIND[dev] || CORE_TO_KIND[core];
        const kind = cp1Selected ? 'cp1' : (preferred === 'cp1' ? 'emulator' : preferred);
        if (kind && kind !== this.state.kind) {
            // Changing the kind while a runner exists would leave it on the
            // wrong engine. Destroy it so the next Start creates a fresh one.
            this._teardownRunner();
            this.setState({ kind, runner: null, ui: { phase: 'idle', message: '' } });
        }
    }

    async onFirmwareFile (e) {
        const file = e.target.files && e.target.files[0];
        e.target.value = ''; // same file again should re-trigger
        if (!file) return;
        const buf = new Uint8Array(await file.arrayBuffer());
        const isText = /\.(hex|ihx)$/i.test(file.name) || (buf.length && buf[0] === 0x3a);
        this._userFirmware = {
            name: file.name,
            bytes: isText ? null : buf,
            text: isText ? new TextDecoder().decode(buf) : null
        };
        // The next Start must attach fresh with this image.
        this._teardownRunner();
        this.setState({firmwareName: file.name, runner: null, ui: {phase: 'idle', message: ''}});
    }

    /**
     * Boot a compiled sketch as the user firmware and start it. The detail
     * names the engine (`kind`) because the sketch route knows the board: an
     * image built for an ATtiny88 must not run on the ATmega328P engine just
     * because the panel was last left there. The firmware stays loaded, shown
     * by name with its clear button, exactly as a picked .hex file would be —
     * clearing it returns the panel to debugging the blocks.
     */
    _runSketch (detail) {
        const {firmware, kind, labwiredChip} = detail || {};
        if (!firmware || (!firmware.text && !(firmware.bytes && firmware.bytes.length))) return;
        // One hand-off reaches this panel more than once: the Circuit tab stashes
        // it and re-dispatches it a frame later so a panel that was still mounting
        // cannot miss it. The same image, already starting or running here, is not
        // restarted — tearing down an attach that is still loading its engine
        // reports that attach's failure over the run that replaced it.
        if (this._userFirmware === firmware && this._runnerPromise &&
            !this._runnerStoppedExplicitly && this.state.ui.phase !== 'error') return;
        this._userFirmware = firmware;
        this._teardownRunner();
        return new Promise(resolve => this.setState({
            firmwareName: firmware.name,
            kind: kind || this.state.kind,
            // A hand-off that names its LabWired chip or board (the MakeCode
            // emulator image: board:microbit-v2) runs there, not on whatever the
            // chip picker was last left at.
            ...(kind === 'labwired' && typeof labwiredChip === 'string' ? {labwiredChip} : {}),
            runner: null,
            ui: {phase: 'idle', message: ''}
        }, () => resolve(this.onStart())));
    }

    onFirmwareClear () {
        this._userFirmware = null;
        this._teardownRunner();
        this.setState({firmwareName: null, runner: null, ui: {phase: 'idle', message: ''}});
    }

    syncProjectTokens (prevProps, initial) {
        if (this.props.runToken && (initial || this.props.runToken !== prevProps.runToken)) {
            this.onGreenFlag();
        }
        if (!initial && this.props.stopToken && this.props.stopToken !== prevProps.stopToken) {
            this.onStop();
        }
    }

    /**
     * The green flag is ONE run, by ONE runtime, on ONE board (task B8).
     *
     * When this runner would compile the project's own blocks, the Scratch VM
     * is already running that same program on the designer's board — the
     * board the designer shows and the VM's blocks write. Starting it here as
     * well was a second copy of the program on a private board, and once it had
     * built (seconds in) the designer displayed THAT board while the VM's
     * writes went to one that was neither shown nor clocked — from the second
     * green flag on, every run (measured in a real browser on production,
     * 54-motor-driver). So the flag starts this runner only when it runs
     * something the VM does not: a machine bench, boot media, the user's
     * firmware. Otherwise the flag ends any debug session of the blocks, which
     * hands the display back to the designer's board; the Debug pane's own
     * Start is the explicit way to run the blocks on the emulator, and the
     * designer labels that board as the emulator's while it is shown.
     */
    async onGreenFlag () {
        const {runnerCompilesProjectBlocks, selectDebugTargetKind} = await import(
            /* webpackChunkName: "bw-debug" */ '../../lib/bw-debug/debug-runner.js');
        const rt = this.props.vm && this.props.vm.runtime;
        const device = String((rt && rt.stc && rt.stc.device) || '').toLowerCase();
        const selectedKind = selectDebugTargetKind(device, this.state.kind);
        if (runnerCompilesProjectBlocks({selectedKind, bootMedia: this._bootMedia, userFirmware: this._userFirmware})) {
            this.onStop();
            return;
        }
        return this.onStart();
    }

    componentWillUnmount () {
        this._hddDownloadMounted = false;
        const rt = this.props.vm && this.props.vm.runtime;
        if (rt && rt.off && this._onProjectChanged) rt.off('PROJECT_CHANGED', this._onProjectChanged);
        else if (rt && rt.removeListener && this._onProjectChanged) rt.removeListener('PROJECT_CHANGED', this._onProjectChanged);
        window.removeEventListener('bw-machine-extracted', this._onMachineExtracted);
        window.removeEventListener('bw-cp1-circuit-detached', this._onCp1CircuitDetached);
        if (this._onBoardSource) window.removeEventListener('bw-board-source', this._onBoardSource);
        window.removeEventListener('bw-machine-media-load', this._onMediaLoad);
        window.removeEventListener('bw-asm-rom-ready', this._onAsmRomReady);
        this._teardownRunner();
    }

    tx (key) {
        const table = L10N[this.props.locale] || L10N.en;
        return table[key] || L10N.en[key];
    }

    /** Destroy whatever runner exists OR is still being created. The
     *  creation is async (a chunk import), so a plain state check races —
     *  two concurrent runner() calls once produced two live machines. */
    _teardownRunner () {
        const p = this._runnerPromise;
        this._runnerPromise = null;
        this._runnerOwnership.release();
        // Accepted release writes publish synchronously. Silence the old
        // runner first, while its target is still alive to receive touch-up.
        this.releaseSamdButtons();
        this._invalidateHddDownload();
        this._hddDownloadRunner = null;
        this._hddDownloadPhase = 'idle';
        this._runnerStoppedExplicitly = false;
        this._mouseLeave();
        // The host shows a runner's board only while that runner lives (B8).
        if (this.props.onRunnerGone) this.props.onRunnerGone();
        // Stop mirroring the old machine's video / draining its keyboard into the
        // Widgets pane before it is destroyed; the next boot starts its own.
        // An idle debugger owns no machine outputs and must not stop an external mirror.
        if ((p || this.state.runner) && typeof window !== 'undefined' && typeof window.bwStopMachineVideo === 'function') {
            window.bwStopMachineVideo();
        }
        if ((p || this.state.runner) && typeof window !== 'undefined' && typeof window.bwStopMachineKeyboard === 'function') {
            window.bwStopMachineKeyboard();
        }
        if ((p || this.state.runner) && typeof window !== 'undefined' && typeof window.bwStopMachineAudio === 'function') {
            window.bwStopMachineAudio();
        }
        if (p) {
            p.then(r => { if (r) r.destroy(); }).catch(() => {});
        } else if (this.state.runner) {
            this.state.runner.destroy();
        }
    }

    async runner () {
        if (this._runnerPromise) return this._runnerPromise;
        this._runnerPromise = this._createRunner(this._runnerOwnership.claim());
        return this._runnerPromise;
    }

    async _createRunner (claim) {
        const {createDebugRunner} = await import(
            /* webpackChunkName: "bw-debug" */ '../../lib/bw-debug/debug-runner.js');
        const runner = createDebugRunner({
            vm: this.props.vm,
            targetKind: this.state.kind,
            machineConfig: this.state.machineConfig,
            bootMedia: this._bootMedia,
            labwiredChip: this.state.kind === 'labwired' ? (this.state.labwiredChip || null) : null,
            esp32s3Console: this.state.esp32s3Console,
            esp32S040McuId: this.state.esp32S040McuId || null,
            // A replaced runner still inside its attach await publishes
            // attaching/ready when that await resolves; dropped, not applied
            // over its replacement's phase.
            onChange: this._runnerOwnership.guard(claim, (ui) => {
                this._updateHddDownloadSession(runner, ui);
                // Runner notifications arrive from rAF/target callbacks, outside
                // React 16's event batching. The local panel and its CircuitTab
                // parent both consume the same snapshot; without an explicit
                // batch their two setState calls cause two complete legacy-root
                // render/commit passes. Batching changes only when React flushes
                // these synchronous consumers, not which snapshot either sees.
                ReactDOM.unstable_batchedUpdates(() => {
                    this.setState({ui});
                    // The board only exists after attach, and the tab has to be told:
                    // until it is, the designer is showing a board of its own that
                    // nothing drives. See circuit-tab.jsx.
                    if (this.props.onRunnerChange) this.props.onRunnerChange(runner, ui);
                });
            })
        });
        if (this._userFirmware && typeof runner.setFirmware === 'function') {
            runner.setFirmware(this._userFirmware);
        }
        // Torn down while the chunk import was pending: the teardown destroys
        // this instance, so it must not become the panel's runner either.
        if (!this._runnerOwnership.isCurrent(claim)) return runner;
        if (this.props.onRunnerChange) this.props.onRunnerChange(runner, this.state.ui);
        // setState is async, so hand the instance back directly rather than
        // reading it out of state on the very next line.
        this.setState({runner});
        return runner;
    }

    async onStart () {
        this._invalidateHddDownload();
        // The runner is no longer a stopped image once a new start begins.
        // `ui.phase` may still read idle while attach() is awaiting chunks.
        this._runnerStoppedExplicitly = false;
        const pending = this.runner();
        const owner = this._runnerPromise;
        const runner = await pending;
        if (this._runnerPromise !== owner) return;
        const phase = this.state.ui.phase;
        if (phase === 'paused') runner.resume();
        else {
            await runner.start();
            // Loading and attaching can outlive this panel's ownership. Its
            // replacement alone may publish a Widgets display.
            if (this._runnerPromise !== owner) return;
            this.mirrorLabwiredDisplay(runner);
        }
    }

    async runCp1Program (assembly, signal) {
        if (signal.aborted) return;
        const pending = this.runner();
        const owner = this._runnerPromise;
        const runner = await pending;
        if (signal.aborted || this._runnerPromise !== owner) return;
        if (!runner.cp1Snapshot()) {
            await runner.start({paused: true});
            if (signal.aborted || this._runnerPromise !== owner) return;
            if (!runner.cp1Snapshot()) throw new Error(this.state.ui.message || 'The CP1 monitor could not start.');
        }
        runner.cp1RunProgram(assembly);
    }

    // A LabWired board with a display: its screen is a widget (the same mirror
    // a machine's VGA uses), sized from the first frame the engine reports.
    mirrorLabwiredDisplay (runner) {
        // A placed S040 already owns its display and touch face in the circuit.
        // Do not replace that view with the generic controller mirror.
        if (runner?.esp32S040PartId) return;
        const selected = String(this.state.labwiredChip || '');
        if (this.state.kind !== 'labwired' || !(selected.startsWith('board:') ||
            selected === 'firmware:esp32-4848s040-merged-flash' ||
            selected === 'software:samd51-no-asf-simulation')) return;
        if (typeof runner.video !== 'function' || typeof window === 'undefined' ||
            typeof window.bwMirrorMachineVideo !== 'function') return;
        const first = runner.video();
        // The micro:bit console must remain visible for run state and serial;
        // Widgets still receives its live display and can be opened on demand.
        window.bwMirrorMachineVideo({videoFn: () => runner.video(),
            ...(selected === 'board:microbit-v2' ? {focusController: false} : {}), widget: {
            name: 'LabWired display', type: 'simplevga', source: 'video',
            config: {width: (first && first.width) || (selected.includes('esp32-4848s040') ? 480 : 128),
                height: (first && first.height) || (selected.includes('esp32-4848s040') ? 480 :
                    selected.startsWith('software:') ? 160 : 64)}
        }});
    }

    setSamdButton (name, pressed) {
        const runner = this.state.runner;
        if (!runner || typeof runner.setInputs !== 'function' || this._samdPressed.has(name) === pressed) return;
        const result = runner.setInputs([{component: 'buttons', channel: name, value: pressed ? 1 : 0}]);
        if (result.accepted) {
            if (pressed) this._samdPressed.add(name); else this._samdPressed.delete(name);
        }
        this.setState({samdInputError: result.accepted ? null : result.reason || result.code});
    }

    releaseSamdButtons () {
        const runner = this.state.runner;
        if (runner && typeof runner.setInputs === 'function' && this._samdPressed.size) {
            runner.setInputs([...this._samdPressed].map(channel => ({component: 'buttons', channel, value: 0})));
        }
        this._samdPressed.clear();
    }

    onSerialInput (e) { this.setState({serialInput: e.target.value}); }

    onSerialKeyDown (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        this.onSerialSend();
    }

    /** Send the typed line to the machine's UART, terminated with CR.
     *
     *  CR (0x0d), not LF: that is what an ACIA monitor and every BASIC on
     *  these benches read as "line ends here" — bw-circuit-ui's SerialConsole
     *  defaults to the same byte.
     *
     *  NO local echo. BBC BASIC, Tali Forth and the Searle monitor all echo
     *  what they receive, so painting the line here too would double every
     *  character. The console shows what the MACHINE said; if nothing comes
     *  back, that is a fact about the machine worth seeing, not one to hide
     *  behind an echo the UI invented. */
    onSerialSend () {
        const runner = this.state.runner;
        const line = this.state.serialInput;
        if (!runner || typeof runner.sendSerial !== 'function') return;
        runner.sendSerial(`${line}\r`);
        this.setState({serialInput: ''});
    }

    onModemInput (e) { this.setState({modemInput: e.target.value, modemStatus: null}); }

    onModemKeyDown (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        this.onModemSend();
    }

    async onModemSend () {
        const runner = this.state.runner;
        const message = this.state.modemInput;
        if (!runner || typeof runner.sendBlinkenrocket !== 'function' || !message) return;
        try {
            const result = await runner.sendBlinkenrocket(message);
            this.setState({modemInput: '', modemStatus: result});
        } catch (error) {
            this.setState({modemStatus: {accepted: false, reason: error.message}});
        }
    }

    _supportsHddDownload (runner) {
        return !!(runner && typeof runner.snapshotAtaMaster === 'function' &&
            typeof runner.supports === 'function' && runner.supports('snapshotAtaMaster') === true);
    }

    _invalidateHddDownload () {
        this._hddDownloadToken = {};
        if (this._hddDownload) this._hddDownload.dispose();
        this._hddDownload = null;
        this._hddDownloadPending = false;
        if (this._hddDownloadMounted && (this.state.hddDownloadBusy || this.state.hddDownloadStatus)) {
            this.setState({hddDownloadBusy: false, hddDownloadStatus: null});
        }
    }

    _updateHddDownloadSession (runner, ui) {
        if (runner !== this._hddDownloadRunner ||
            (this._hddDownloadPhase === 'paused' && ui.phase !== 'paused') ||
            (this._hddDownloadPhase === 'paused' && ui.phase === 'paused' &&
                ui.session?.why !== this._hddDownloadHalt)) {
            this._invalidateHddDownload();
        }
        this._hddDownloadRunner = runner;
        this._hddDownloadPhase = ui.phase;
        this._hddDownloadHalt = ui.session?.why;
    }

    _hddDownloadSession () {
        const runner = this.state.runner;
        if (!this._hddDownloadMounted || this.state.ui.phase !== 'paused' ||
            this._hddDownloadPhase !== 'paused' || runner !== this._hddDownloadRunner ||
            !this._supportsHddDownload(runner)) return null;
        return {target: runner, identity: this._hddDownloadToken};
    }

    async onHddDownload () {
        const session = this._hddDownloadSession();
        if (!session || this._hddDownloadPending) return;
        if (!this._hddDownload) this._hddDownload = createRawHddDownload({
            getActiveSession: () => this._hddDownloadSession()
        });
        const helper = this._hddDownload;
        this._hddDownloadPending = true;
        this.setState({hddDownloadBusy: true, hddDownloadStatus: this.tx('hddDownloadPreparing')});
        let result;
        try { result = await helper.download(); }
        catch (error) { result = {refused: {reason: String(error?.message || error)}}; }
        if (!this._hddDownloadMounted || this._hddDownload !== helper ||
            this._hddDownloadToken !== session.identity || this.state.runner !== session.target) return;
        this._hddDownloadPending = false;
        this.setState({hddDownloadBusy: false, hddDownloadStatus: result.refused ?
            result.refused.reason : this.tx('hddDownloadInitiated')});
    }

    onPause () { if (this.state.runner) this.state.runner.pause(); }
    onStop () {
        this._invalidateHddDownload();
        if (!this.state.runner) return;
        this.releaseSamdButtons();
        this._runnerStoppedExplicitly = true;
        this.state.runner.stop();
    }
    async onStep () {
        this._invalidateHddDownload();
        (await this.runner()).step('block');
    }
    onReverseStep () {
        this._invalidateHddDownload();
        const runner = this.state.runner;
        if (!runner) return;
        const result = runner.reverseStepDebugInstruction();
        this.setState({reverseStatus: result.accepted ? null : result});
    }

    onReverseCycle () {
        this._invalidateHddDownload();
        const runner = this.state.runner;
        if (!runner || typeof runner.reverseStepDebugCycle !== 'function') return;
        const result = runner.reverseStepDebugCycle();
        this.setState({reverseStatus: result.accepted ? null : result});
    }

    onReverseContinue () {
        this._invalidateHddDownload();
        const runner = this.state.runner;
        if (!runner) return;
        const result = runner.reverseContinueDebug();
        this.setState({reverseStatus: result.accepted ? null : result});
    }
    onSpeed (e) { if (this.state.runner) this.state.runner.setSpeed(Number(e.target.value)); }

    onRecord () {
        const runner = this.state.runner;
        if (!runner) return;
        const current = runner.debugRecordingStatus();
        const result = current.active ? runner.stopDebugRecording() : runner.startDebugRecording();
        this.setState({recordingStatus: result.accepted === false ? result : runner.debugRecordingStatus()});
    }

    onCheckpoint () {
        const runner = this.state.runner;
        if (!runner) return;
        const result = runner.checkpointDebugRecording();
        this.setState({recordingStatus: result.accepted === false ? result : runner.debugRecordingStatus()});
    }

    onRestoreLast () {
        this._invalidateHddDownload();
        const runner = this.state.runner;
        if (!runner) return;
        const checkpoints = runner.debugRecorder().checkpointSummary();
        const latest = checkpoints.at(-1);
        if (!latest) return;
        const result = runner.restoreDebugCheckpoint(latest.eventCursor);
        this.setState({recordingStatus: result.accepted === false ? result : runner.debugRecordingStatus()});
    }

    onTimelineRefresh () {
        const runner = this.state.runner;
        if (!runner) return;
        runner.drainDebugEvents(512);
        this.setState({timelineStatus: null});
    }

    navigateTimeline (operation) {
        const runner = this.state.runner;
        if (!runner) return;
        const result = operation(runner.debugTimeline());
        if (result.accepted && result.event) runner.debugTimingWaveform().selectEvent(result.event.seq);
        this.setState({timelineStatus: result.accepted ? null : result});
    }

    onTimelineOlder () { this.navigateTimeline(timeline => timeline.older()); }
    onTimelineNewer () { this.navigateTimeline(timeline => timeline.newer()); }
    onTimelineLatest () { this.navigateTimeline(timeline => timeline.latest()); }
    onTimelineCheckpoint () {
        const runner = this.state.runner;
        const latest = runner?.debugRecorder().checkpointSummary().at(-1);
        if (!latest) return;
        this.navigateTimeline(timeline => timeline.seekCursor(latest.eventCursor));
    }

    onTimelineGoSelected () {
        this._invalidateHddDownload();
        const runner = this.state.runner;
        if (!runner) return;
        const result = runner.seekSelectedDebugEvent();
        this.setState({timelineStatus: result.accepted ? null : result});
    }

    selectedHistoryCursor () {
        const runner = this.state.runner;
        const event = runner?.debugTimeline().state().selectedEvent;
        const branch = runner?.debugBranchSummaries().find(item => item.active);
        const boundary = event && runner.debugTimeline().selectedBoundaryCursor();
        return boundary?.accepted && branch ?
            {branchId: branch.branchId, eventCursor: boundary.boundaryCursor} : null;
    }

    async onAddBookmark () {
        const cursor = this.selectedHistoryCursor();
        if (!cursor) return;
        const label = await promptAsync('Bookmark label');
        if (label === null) return;
        const result = this.state.runner.addDebugBookmark({cursor, label});
        this.setState({historyStatus: result});
    }

    async onAddAnnotation () {
        const cursor = this.selectedHistoryCursor();
        if (!cursor) return;
        const annotation = await promptAsync('Annotation');
        if (annotation === null) return;
        const result = this.state.runner.addDebugAnnotation({cursor, annotation});
        this.setState({historyStatus: result});
    }

    onCompareCheckpoints () {
        const runner = this.state.runner;
        if (!runner) return;
        const branch = runner.debugBranchSummaries().find(item => item.active);
        const checkpoints = branch?.checkpoints || [];
        if (checkpoints.length < 2) return;
        const cursor = checkpoint => ({branchId: branch.branchId, eventCursor: checkpoint.eventCursor});
        this.setState({historyStatus: runner.compareDebugCheckpoints(
            cursor(checkpoints.at(-2)), cursor(checkpoints.at(-1)))});
    }

    onWaveformSelect (seq) {
        const runner = this.state.runner;
        if (!runner) return;
        const result = runner.debugTimeline().selectEvent(seq);
        if (result.accepted) runner.debugTimingWaveform().selectEvent(seq);
        this.setState({timelineStatus: result.accepted ? null : result});
    }

    updateWaveform (operation) {
        const waveform = this.state.runner?.debugTimingWaveform();
        if (!waveform) return;
        const result = operation(waveform);
        if (result.accepted && result.selectedSeq !== undefined) {
            this.state.runner.debugTimeline().selectEvent(result.selectedSeq);
        }
        this.setState({timelineStatus: result.accepted ? null : result});
    }

    onWaveformZoom (factor) { this.updateWaveform(waveform => waveform.zoom(factor)); }
    onWaveformPan (delta) { this.updateWaveform(waveform => waveform.pan(delta)); }
    onWaveformSetTrigger (lane) {
        if (lane) this.updateWaveform(waveform => waveform.setTrigger({lane, edge: 'change'}));
    }
    onWaveformPreviousTrigger () { this.updateWaveform(waveform => waveform.previousTrigger()); }
    onWaveformNextTrigger () { this.updateWaveform(waveform => waveform.nextTrigger()); }
    onWaveformExport (format) {
        const waveform = this.state.runner?.debugTimingWaveform();
        if (!waveform) return;
        try {
            const body = format === 'vcd' ? waveform.exportVCD() : waveform.exportJSON();
            const blob = new Blob([body], {type: format === 'vcd' ? 'text/plain' : 'application/json'});
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url; anchor.download = `debug-timing.${format}`; anchor.click();
            URL.revokeObjectURL(url);
            this.setState({timelineStatus: null});
        } catch (error) {
            this.setState({timelineStatus: {accepted: false, code: 'waveform-export-refused',
                reason: error?.message || String(error)}});
        }
    }

    async onDebugSessionExport () {
        const runner = this.state.runner;
        if (!runner) return;
        this.setState({sessionTransferStatus: {message: 'Preparing session…'}});
        try {
            const result = await runner.exportDebugSession();
            if (!result.accepted) return this.setState({sessionTransferStatus: result});
            const blob = new Blob([result.text], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url; anchor.download = result.filename || 'debug-session.bwdebug'; anchor.click();
            URL.revokeObjectURL(url);
            this.setState({sessionTransferStatus: {accepted: true, message: 'Session exported'}});
        } catch (error) {
            this.setState({sessionTransferStatus: {accepted: false, code: 'session-export-failed',
                reason: error?.message || String(error)}});
        }
    }

    async onDebugSessionImport (file) {
        const runner = this.state.runner;
        if (!runner) return;
        this.setState({sessionTransferStatus: {message: 'Validating session…'}});
        try {
            const text = await file.text();
            this._invalidateHddDownload();
            const result = await runner.importDebugSession(text);
            this.setState({sessionTransferStatus: result.accepted ?
                {accepted: true, message: 'Session imported'} : result});
        } catch (error) {
            this.setState({sessionTransferStatus: {accepted: false, code: 'session-import-failed',
                reason: error?.message || String(error)}});
        }
    }

    onBisectionMarkGood () { this.state.runner?.markDebugBisectionEndpoint('good'); }
    onBisectionMarkBad () { this.state.runner?.markDebugBisectionEndpoint('bad'); }
    onBisectionStart () { this.state.runner?.startDebugBisection(); }
    onBisectionCancel () { this.state.runner?.cancelDebugBisection(); }
    onCorrelatedTarget (targetId) { this.state.runner?.selectCorrelatedDebugTarget(targetId); }
    onCorrelatedEvent (cursor) { this.state.runner?.selectCorrelatedDebugEvent(cursor); }
    onCorrelatedTrigger () { this.state.runner?.addCorrelatedDebugTrigger(); }
    onCorrelatedCause () { this.state.runner?.followCorrelatedDebugCause(); }
    onCorrelatedCheckpoint () { this.state.runner?.checkpointCorrelatedDebugTargets(); }
    onCorrelatedRestore () { this._invalidateHddDownload(); this.state.runner?.restoreCorrelatedDebugTargets(); }

    render () {
        const {ui} = this.state;
        const {phase, message} = ui;
        const running = phase === 'running' || phase === 'stepping';
        const paused = phase === 'paused';
        const canDownloadHdd = this._supportsHddDownload(this.state.runner);
        const busy = phase === 'building' || phase === 'attaching';
        const noImageLoaded = phase === 'idle' && !this.state.runner &&
            !this._userFirmware && !this._bootMedia;
        const s040Selected = this.state.kind === 'labwired' &&
            ['board:esp32-4848s040', 'firmware:esp32-4848s040-merged-flash'].includes(this.state.labwiredChip);
        const s040Parts = this.props.s040PartIds || s040PartIds(this.props.vm?.runtime?.circuitBoard);
        const why = ui.session && ui.session.why;

        // Capabilities decide what is offered — never an assumption about which
        // target is attached. Before one is attached there is nothing to ask,
        // so the buttons reflect the phase alone.
        const caps = ui.capabilities;
        const canStep = !caps || caps.steps.includes('block');
        // A capability, asked of the runner — the same stance as the step
        // buttons. An 8051 that only prints has no sendSerial and gets no
        // input line rather than a dead one.
        const canSendSerial = !!(this.state.runner &&
            typeof this.state.runner.sendSerial === 'function');
        const canSendBlinkenrocket = !!(this.state.runner &&
            typeof this.state.runner.sendBlinkenrocket === 'function');
        const recording = this.state.runner && this.state.runner.debugRecordingStatus();
        const recordingCaps = caps && (caps.recording || []);
        const canCheckpoint = !!(recordingCaps && recordingCaps.includes('checkpoint'));
        const canRestore = !!(recordingCaps && recordingCaps.includes('restore'));
        // Summary deliberately excludes the potentially-megabyte target
        // snapshots; render runs at live UI cadence and must not clone RAM.
        const checkpoints = this.state.runner ?
            this.state.runner.debugRecorder().checkpointSummary() : [];
        const recordingRefusal = this.state.recordingStatus?.accepted === false ?
            this.state.recordingStatus.reason : null;
        const reverse = this.state.runner && this.state.runner.reverseStepDebugStatus();
        const canReverse = !!(reverse && reverse.accepted);
        const reverseCycleRunner = this.state.runner &&
            typeof this.state.runner.reverseStepDebugCycleStatus === 'function' ?
            this.state.runner.reverseStepDebugCycleStatus() : null;
        const reverseCycle = reverseCycleControlStatus({provider: ui.cycleProvider,
            capabilities: caps, runnerStatus: reverseCycleRunner});
        const canReverseCycle = reverseCycle.accepted;
        const reverseContinue = this.state.runner && this.state.runner.reverseContinueDebugStatus();
        const canReverseContinue = !!(reverseContinue && reverseContinue.accepted);
        const reverseRefusal = this.state.reverseStatus?.accepted === false ?
            this.state.reverseStatus.reason : null;
        const timeline = this.state.runner ? this.state.runner.debugTimeline().state() : null;
        const timelineEvent = timeline?.selectedEvent;
        const canTimelineOlder = !!(timeline?.retained &&
            String(timeline.selectedSeq) !== String(timeline.firstSeq));
        const canTimelineNewer = !!(timeline?.retained &&
            String(timeline.selectedSeq) !== String(timeline.lastSeq));
        const selectedSeek = this.state.runner ? this.state.runner.seekSelectedDebugStatus() : null;
        const canSeekSelected = !!(selectedSeek && selectedSeek.accepted);
        const timelineRefusalResult = this.state.timelineStatus?.accepted === false ?
            this.state.timelineStatus : selectedSeek?.accepted === false ? selectedSeek : null;
        const timelineRefusal = timelineRefusalResult ?
            (timelineRefusalResult.reason || timelineRefusalResult.code) : null;
        const historyEntries = this.state.runner ? this.state.runner.debugHistoryAnnotations() : [];
        // Asked at render rather than subscribed to. Refusals accumulate while
        // the program runs, so "on each new refusal" is what re-rendering
        // already gives us; a subscription would be a second source of the
        // same truth. Empty on every bench that is not the 8086, which is the
        // honest answer rather than a header over nothing.
        // `?? []` because the handle returns null on a bench with no collector,
        // which renders the same as nothing refused but is a different fact.
        const chipRefusalsRaw = this.state.runner ? this.state.runner.debugChipRefusals() : null;
        const chipRefusals = chipRefusalsRaw ?? [];
        // Stated on the panel root because the two states LOOK identical — no
        // block either way — and a reader who cannot tell them apart blames the
        // panel when the answer is the machine config. 'none' means this bench
        // has no collector at all; 'empty' means it has one and nothing has been
        // refused yet. Cheap, and it is the first thing anyone debugging this
        // will want to know.
        const chipRefusalState = chipRefusalsRaw === null ? 'none'
            : chipRefusals.length === 0 ? 'empty' : String(chipRefusals.length);
        const historyStatus = this.state.historyStatus;
        const selectedInspection = timelineEvent && this.state.runner ?
            this.state.runner.selectedEventInspection() : null;
        const timingWaveform = this.state.runner ? this.state.runner.debugTimingWaveform().view() : null;
        const correlatedView = this.state.runner ? this.state.runner.correlatedDebugView() : null;
        // This is a bounded summary API: no event bodies, target snapshots or
        // checkpoint payloads cross the render path. Cap the visible tail too,
        // so a crowded action setup cannot grow the panel without bound.
        const actionStatus = this.state.runner ?
            this.state.runner.eventBreakpointActionStatus() : null;
        const actionFailures = (actionStatus?.failures || []).slice(-3);
        const actionLog = (actionStatus?.log || []).slice(-3);
        const actionCounters = Object.entries(actionStatus?.counters || {}).slice(-4);
        const hasActionStatus = actionFailures.length || actionLog.length || actionCounters.length;

        if (this.state.kind === 'cp1') return <div data-debug-panel data-debug-phase={phase}>
            <Cp1Host
                    runner={this.state.runner} running={running} locale={this.props.locale}
                    configuration={this.state.machineConfig}
                    onConfigure={config => {
                        const machine = window.__bwMachineExtracted;
                        if (machine?.kind === 'cp1') window.__bwMachineExtracted = {...machine, config};
                        this._onMachineExtracted({detail: {kind: 'cp1', config}});
                        return new Promise(resolve => this.setState({machineConfig: config}, resolve));
                    }}
                    onImportRom={image => this._onMediaLoad({detail: {kind: 'cp1', slotId: 'rom',
                        bytes: image.bytes, name: image.name}})}
                    onRun={() => this.onStart()}
                    onRunProgram={(assembly, signal) => this.runCp1Program(assembly, signal)} />
        </div>;

        // The red "improvised board" alert exists because a BLOCKS program has
        // an example circuit the inferred bench can be mistaken for. Firmware
        // (a compiled sketch, a picked .hex) has no example and no PIN lines:
        // the inferred bench is simply the bare chip, which is true and worth
        // saying calmly rather than as an error.
        const inferredBoard = this.state.boardSource === 'inferred' && !this.state.firmwareName;
        const bareChipFirmware = this.state.boardSource === 'inferred' && !!this.state.firmwareName;
        return (
            <div data-debug-panel data-debug-phase={phase} data-debug-chip-refusal-state={chipRefusalState} style={{
                display: 'flex', flexDirection: 'column', gap: 8, padding: 10,
                background: '#1a1a2e', border: '1px solid #2c3e50', borderRadius: 8,
                fontFamily: 'monospace', fontSize: 12, color: '#bdc3c7'
            }}>
                {inferredBoard ? (
                    <div data-inferred-board-warning role="alert" style={{
                        display: 'flex', gap: 8, alignItems: 'flex-start',
                        background: '#7f1d1d', border: '1px solid #ef4444',
                        borderRadius: 6, padding: '6px 8px', color: '#fecaca',
                        fontWeight: 700
                    }}>
                        <span aria-hidden style={{fontSize: 14}}>{'\u26a0'}</span>
                        <span>
                            {/^de/i.test(String(this.props.locale || (typeof navigator !== 'undefined' && navigator.language) || 'en'))
                                ? 'IMPROVISIERTES Testboard: Der Debugger hat aus den PIN-Zeilen ein Ersatzboard erraten — das ist NICHT die Schaltung des Beispiels. Öffne den Circuit-Tab, um das echte Board zu laden.'
                                : 'IMPROVISED test board: the debugger guessed a stand-in from the PIN lines — this is NOT the example\u2019s circuit. Open the Circuit tab to load the real board.'}
                        </span>
                    </div>
                ) : null}
                {bareChipFirmware ? (
                    <div data-bare-chip-note role="note" style={{
                        background: '#1e293b', border: '1px solid #475569',
                        borderRadius: 6, padding: '6px 8px', color: '#cbd5e1'
                    }}>{this.tx('firmwareBareChip')}</div>
                ) : null}
                <div data-debug-transport style={{display: 'flex', gap: 4, alignItems: 'center'}}>
                    <button
                        data-debug-run
                        style={running || busy ? OFF : {...BTN, borderColor: '#2ecc71', color: '#2ecc71'}}
                        disabled={running || busy}
                        onClick={this.onStart}
                        title={paused ? 'Resume' : 'Build, load and run'}
                        aria-label={this.tx('run')}
                    >{'▶'}</button>

                    <button
                        style={running ? BTN : OFF}
                        disabled={!running}
                        onClick={this.onPause}
                        title={this.tx('pause')}
                        aria-label={this.tx('pause')}
                    >{'⏸'}</button>

                    <button
                        style={canStep && !busy ? BTN : OFF}
                        disabled={!canStep || busy}
                        onClick={this.onStep}
                        title={canStep ? this.tx('stepHint')
                            : 'This target cannot step one block'}
                        aria-label={this.tx('step')}
                    >{'⏭'}</button>

                    <button
                        style={running || paused ? {...BTN, borderColor: '#c0392b', color: '#e74c3c'} : OFF}
                        disabled={!running && !paused}
                        onClick={this.onStop}
                        title={this.tx('stop')}
                        aria-label={this.tx('stop')}
                    >{'⏹'}</button>

                </div>
                <div data-debug-target-controls style={{display: 'flex', gap: 4, alignItems: 'flex-start', minWidth: 0}}>
                    {this.state.kinds && this.state.kinds.length > 1 ? (
                        <span style={{display: 'flex', flexWrap: 'wrap', flex: '1 1 0', minWidth: 0, alignItems: 'center', gap: 6}}>
                            <select
                                aria-label={this.tx('target')}
                                value={this.state.kind}
                                disabled={running || paused || busy}
                                title={(this.state.kinds.find(k => k.kind === this.state.kind) || {}).description}
                                onChange={e => {
                                    const kind = e.target.value;
                                    // Persist per device — the setting the
                                    // picker IS. Cleared by picking the
                                    // device's default again.
                                    try {
                                        const rt = this.props.vm && this.props.vm.runtime;
                                        const dev = rt && rt.bwDeviceId;
                                        if (dev) localStorage.setItem(`bw-emulator-pref:${dev}`, kind);
                                    } catch { /* private mode */ }
                                    this.setState({kind});
                                }}
                                style={{...BTN, padding: '3px 6px', minWidth: 0, maxWidth: '100%'}}
                            >
                                {this.state.kinds.map(k => (
                                    <option key={k.kind} value={k.kind}>{k.label}</option>
                                ))}
                            </select>
                            {this.state.kind === 'labwired' && this.state.labwiredChips ? (
                                <select
                                    value={this.state.labwiredChip}
                                    disabled={running || paused || busy}
                                    title={this.tx('labwiredChipTitle')}
                                    onChange={e => {
                                        // A different chip is a different machine:
                                        // the next Start must attach fresh.
                                        this._teardownRunner();
                                        this.setState({labwiredChip: e.target.value, runner: null,
                                            ui: {phase: 'idle', message: ''}});
                                    }}
                                    style={{...BTN, padding: '3px 6px', minWidth: 0, maxWidth: '100%'}}
                                >
                                    <option value="">{this.tx('labwiredChipProject')}</option>
                                    {this.state.labwiredChips.map(c => (
                                        <option key={c.value} value={c.value}>{c.labelKey ? this.tx(c.labelKey) : c.label}</option>
                                    ))}
                                </select>
                            ) : null}
                            {s040Selected ? (
                                <label style={{display: 'flex', alignItems: 'center', gap: 4}}>
                                    {String(this.props.locale || 'en').startsWith('de') ? 'Platine' : 'Circuit board'}
                                    <select data-esp32s040-part value={this.state.esp32S040McuId}
                                        disabled={running || paused || busy}
                                        onChange={e => {
                                            this._teardownRunner();
                                            this.setState({esp32S040McuId: e.target.value, runner: null,
                                                ui: {phase: 'idle', message: ''}});
                                        }} style={{...BTN, padding: '3px 6px', minWidth: 0, maxWidth: '100%'}}>
                                        <option value="">{String(this.props.locale || 'en').startsWith('de')
                                            ? 'Automatisch (eine Platine)' : 'Automatic (one board)'}</option>
                                        {s040Parts.map(id => <option key={id} value={id}>{id}</option>)}
                                    </select>
                                </label>
                            ) : null}
                            {this.state.kind === 'labwired' &&
                                ['firmware:esp32s3-merged-flash', 'firmware:esp32-4848s040-merged-flash'].includes(this.state.labwiredChip) ? (
                                <label title={this.tx('esp32s3FlashHint')} style={{display: 'flex', alignItems: 'center', gap: 4}}>
                                    {this.tx('esp32s3Console')}
                                    <select data-esp32s3-console value={this.state.esp32s3Console}
                                        disabled={running || paused || busy}
                                        onChange={e => {
                                            this._teardownRunner();
                                            this.setState({esp32s3Console: e.target.value, runner: null,
                                                ui: {phase: 'idle', message: ''}});
                                        }}
                                        style={{...BTN, padding: '3px 6px', minWidth: 0, maxWidth: '100%'}}
                                    >
                                        <option value="uart0">{'UART0'}</option>
                                        <option value="usb_serial_jtag">{'USB Serial/JTAG'}</option>
                                        <option value="both">{this.tx('esp32s3Both')}</option>
                                    </select>
                                </label>
                            ) : null}
                        </span>
                    ) : null}

                    <span style={{marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6}}>
                        <select
                            id="bw-debug-speed"
                            aria-label={this.tx('speed')}
                            title={this.tx('speed')}
                            defaultValue="1"
                            onChange={this.onSpeed}
                            style={{...BTN, padding: '3px 6px'}}
                        >
                            <option value="0.1">{'0.1×'}</option>
                            <option value="0.5">{'0.5×'}</option>
                            <option value="1">{'1×'}</option>
                            <option value="4">{'4×'}</option>
                        </select>
                    </span>
                    <span style={{display: 'inline-flex', alignItems: 'center', gap: 4}}>
                        <button type="button" style={{...BTN, padding: '3px 6px'}}
                            title={this.tx('firmwareFile')} aria-label={this.tx('firmwareFile')}
                            disabled={running || paused || busy} onClick={() => this.firmwareInput.click()}>
                            {'📂'}
                        </button>
                        <input
                            ref={input => { this.firmwareInput = input; }}
                            type="file"
                            accept={s040Selected ? '.elf,.bin' : this.state.kind === 'labwired'
                                ? '.elf,.uf2,.bin,.hex,.ihx' : '.bin,.hex,.ihx'}
                            hidden
                            disabled={running || paused || busy}
                            onChange={e => this.onFirmwareFile(e)}
                        />
                    </span>
                </div>
                {this.state.firmwareName ? (
                    <span data-firmware-chip style={{fontSize: 11, opacity: 0.9}}>
                        {this.state.firmwareName}{' '}{this.tx(running ? 'firmwareRunning' : 'firmwareLoaded')}
                        <button
                            data-firmware-back
                            style={{...BTN, padding: '0 6px', marginLeft: 6}}
                            title={this.tx('firmwareBackTitle')}
                            aria-label={this.tx('firmwareBackTitle')}
                            onClick={() => this.onFirmwareClear()}
                        >{'⟲ '}{this.tx('firmwareBack')}</button>
                    </span>
                ) : null}
                {canDownloadHdd ? (
                    <button
                        data-debug-hdd-download
                        style={paused && !this.state.hddDownloadBusy ? BTN : OFF}
                        disabled={!paused || this.state.hddDownloadBusy}
                        onClick={this.onHddDownload}
                        title={this.tx('hddDownloadHint')}
                    >{this.tx('hddDownload')}</button>
                ) : null}
                {this.state.hddDownloadStatus ? (
                    <span data-debug-hdd-download-status role="status">{this.state.hddDownloadStatus}</span>
                ) : null}

                <details data-debug-history>
                    <summary style={{...BTN, display: 'inline-block', padding: '4px 8px'}}
                        aria-label={this.tx('history')}>
                        {'› '}{this.tx('history')}{recording?.active ? ' ●' : ''}
                    </summary>
                    <div style={{display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6}}>
                        <button
                            data-debug-reverse-step
                            style={canReverse && !busy ? BTN : OFF}
                            disabled={!canReverse || busy}
                            onClick={this.onReverseStep}
                            title={canReverse ? this.tx('reverseHint') : (reverse?.reason || this.tx('reverseHint'))}
                        >{'⏮ '}{this.tx('reverseStep')}</button>

                        <button
                            data-debug-reverse-cycle
                            style={canReverseCycle && !busy ? BTN : OFF}
                            disabled={!canReverseCycle || busy}
                            onClick={this.onReverseCycle}
                            title={canReverseCycle ? this.tx('reverseCycleHint') : reverseCycle.reason}
                        >{'↤ '}{this.tx('reverseCycle')}</button>

                        <button
                            data-debug-reverse-continue
                            style={canReverseContinue && !busy ? BTN : OFF}
                            disabled={!canReverseContinue || busy}
                            onClick={this.onReverseContinue}
                            title={canReverseContinue ? this.tx('reverseContinueHint') :
                                (reverseContinue?.reason || this.tx('reverseContinueHint'))}
                        >{'◀ '}{this.tx('reverseContinue')}</button>

                        <button
                            data-debug-record
                            style={canCheckpoint ? (recording && recording.active ?
                                {...BTN, borderColor: '#e74c3c', color: '#e74c3c'} : BTN) : OFF}
                            disabled={!canCheckpoint}
                            onClick={this.onRecord}
                            title={canCheckpoint ? this.tx('record') : this.tx('recordUnsupported')}
                        >{'● '}{recording && recording.active ? this.tx('recording') : this.tx('record')}</button>

                        <button
                            data-debug-checkpoint
                            style={canCheckpoint && recording && recording.active ? BTN : OFF}
                            disabled={!canCheckpoint || !recording || !recording.active}
                            onClick={this.onCheckpoint}
                        >{'◆ '}{this.tx('checkpoint')}</button>

                        <button
                            data-debug-restore
                            style={canRestore && checkpoints.length ? BTN : OFF}
                            disabled={!canRestore || !checkpoints.length}
                            onClick={this.onRestoreLast}
                        >{'↶ '}{this.tx('restore')}</button>
                        {recordingRefusal ? (
                            <span data-debug-recording-refusal role="status">{recordingRefusal}</span>
                        ) : null}
                        {reverseRefusal ? (
                            <span data-debug-reverse-refusal role="status">{reverseRefusal}</span>
                        ) : null}

                    </div>
                    <div data-debug-history-annotations style={{display: 'flex', gap: 6, marginTop: 6,
                        alignItems: 'center', flexWrap: 'wrap'}}>
                        <button data-debug-add-bookmark style={timelineEvent ? BTN : OFF}
                            disabled={!timelineEvent} onClick={() => this.onAddBookmark()}>{'🔖 Bookmark'}</button>
                        <button data-debug-add-annotation style={timelineEvent ? BTN : OFF}
                            disabled={!timelineEvent} onClick={() => this.onAddAnnotation()}>{'✎ Note'}</button>
                        <button data-debug-compare-checkpoints style={checkpoints.length > 1 ? BTN : OFF}
                            disabled={checkpoints.length < 2}
                            onClick={() => this.onCompareCheckpoints()}>{'⇄ Compare checkpoints'}</button>
                        <span data-debug-history-count>{`${historyEntries.length} saved`}</span>
                        {historyStatus?.accepted === false ? <span role="status" data-debug-history-refusal>
                            {historyStatus.reason || historyStatus.code}
                        </span> : null}
                        {historyStatus?.accepted && Object.hasOwn(historyStatus, 'identical') ?
                            <span role="status" data-debug-checkpoint-comparison>
                                {historyStatus.identical ? 'Checkpoints identical' :
                                    `${historyStatus.differences.length} changed fields`}
                            </span> : null}
                    </div>

                    <div data-debug-timeline-controls style={{display: 'flex', gap: 6, marginTop: 6,
                        alignItems: 'center', flexWrap: 'wrap'}}>
                        <span>{`${this.tx('timeline')}: ${timelineEvent ?
                            `#${String(timelineEvent.seq)} ${timelineEvent.kind}${timelineEvent.phase ?
                                `/${timelineEvent.phase}` : ''}` : '—'}`}</span>
                        <button data-debug-timeline-refresh style={this.state.runner ? BTN : OFF}
                            disabled={!this.state.runner} onClick={this.onTimelineRefresh}>
                            {this.tx('timelineRefresh')}
                        </button>
                        <button data-debug-timeline-older style={canTimelineOlder ? BTN : OFF}
                            disabled={!canTimelineOlder} onClick={this.onTimelineOlder}>
                            {'← '}{this.tx('timelineOlder')}
                        </button>
                        <button data-debug-timeline-newer style={canTimelineNewer ? BTN : OFF}
                            disabled={!canTimelineNewer} onClick={this.onTimelineNewer}>
                            {this.tx('timelineNewer')}{' →'}
                        </button>
                        <button data-debug-timeline-latest style={timeline?.retained ? BTN : OFF}
                            disabled={!timeline?.retained} onClick={this.onTimelineLatest}>
                            {this.tx('timelineLatest')}
                        </button>
                        <button data-debug-timeline-checkpoint
                            style={timeline?.retained && checkpoints.length ? BTN : OFF}
                            disabled={!timeline?.retained || !checkpoints.length}
                            onClick={this.onTimelineCheckpoint}>{this.tx('timelineCheckpoint')}</button>
                        <button data-debug-timeline-go-selected
                            style={canSeekSelected ? BTN : OFF}
                            disabled={!canSeekSelected}
                            title={selectedSeek?.reason || this.tx('timelineGoSelectedHint')}
                            onClick={this.onTimelineGoSelected}>{this.tx('timelineGoSelected')}</button>
                        {timelineRefusal ? <span role="status" data-debug-timeline-refusal>
                            {timelineRefusal}
                        </span> : null}
                    </div>

                    {!ui.breakpoints?.length ? (
                        <p style={{margin: '6px 0 0'}}>{this.tx('noBps')}</p>
                    ) : null}
                </details>

                {this.state.kind === 'labwired' && this.state.labwiredChip === 'software:samd51-no-asf-simulation' ?
                    <div data-samd-software-buttons style={{display: 'flex', gap: 4, flexWrap: 'wrap'}}>
                        {['left', 'up', 'down', 'right', 'select', 'start', 'a', 'b'].map(name =>
                            <button key={name} style={this.state.runner ? BTN : OFF} disabled={!this.state.runner}
                                aria-pressed={this._samdPressed.has(name)}
                                onPointerDown={e => { e.preventDefault(); if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId); this.setSamdButton(name, true); }}
                                onPointerUp={() => this.setSamdButton(name, false)}
                                onPointerCancel={() => this.setSamdButton(name, false)}
                                onLostPointerCapture={() => this.setSamdButton(name, false)}
                                onBlur={() => this.setSamdButton(name, false)}
                                onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this.setSamdButton(name, true); } }}
                                onKeyUp={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this.setSamdButton(name, false); } }}
                            >{name.toUpperCase()}</button>)}
                        {this.state.samdInputError ? <span role="status">{this.state.samdInputError}</span> : null}
                    </div> : null}

                {chipRefusals.length > 0 ? <div data-debug-chip-refusals
                    style={{display: 'flex', flexDirection: 'column', gap: 2, margin: '6px 0'}}>
                    {/* One line per collector row. The block is absent, not empty,
                        when nothing was refused: a heading over no rows tells a
                        learner the bench has a problem it does not have. */}
                    {chipRefusals.map(r => <div key={r.key} role="status"
                        data-debug-chip-refusal data-debug-chip-refusal-part={r.part}
                        style={{color: '#92400e', fontSize: 12}}>{r.text}</div>)}
                </div> : null}

                {this.state.runner ? <DebugSessionTransfer
                    disabled={running || busy}
                    status={this.state.sessionTransferStatus}
                    onExport={this.onDebugSessionExport}
                    onImport={this.onDebugSessionImport}
                /> : null}

                {this.state.runner ? <DebugDivergenceBisection
                    disabled={running || busy}
                    status={this.state.runner.debugBisectionStatus()}
                    onMarkGood={this.onBisectionMarkGood}
                    onMarkBad={this.onBisectionMarkBad}
                    onStart={this.onBisectionStart}
                    onCancel={this.onBisectionCancel}
                /> : null}

                {correlatedView ? <DebugCorrelatedTargets
                    view={correlatedView}
                    selectedTarget={this.state.runner.selectedCorrelatedDebugTarget()}
                    status={this.state.runner.correlatedDebugStatus()}
                    onSelectTarget={this.onCorrelatedTarget}
                    onSelectEvent={this.onCorrelatedEvent}
                    onAddTrigger={this.onCorrelatedTrigger}
                    onFollowCause={this.onCorrelatedCause}
                    onCheckpoint={this.onCorrelatedCheckpoint}
                    onRestore={this.onCorrelatedRestore}
                /> : null}

                {selectedInspection?.accepted ? (
                    <div data-debug-selected-inspection data-inspection-provenance="recorded-event"
                        style={{display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                            gap: 8, border: '1px solid #2c3e50', borderRadius: 4, padding: 7}}>
                        <div data-debug-selected-registers>
                            <strong>{`${this.tx('now')} · recorded event`}</strong>
                            {selectedInspection.registers.full.available ?
                                Object.entries(selectedInspection.registers.full.values).slice(0, 16)
                                    .map(([name, value]) => <div key={name}>{`${name}: ${String(value)}`}</div>) :
                                <div role="status">{selectedInspection.registers.full.refusal}</div>}
                            {Object.entries(selectedInspection.registers.changes.values).slice(0, 8)
                                .map(([name, value]) => <div key={`change-${name}`}>
                                    {`${name}: ${String(value.before)} → ${String(value.after)}`}
                                </div>)}
                        </div>
                        <div data-debug-selected-disassembly>
                            <strong>{`${this.tx('code')} · recorded event`}</strong>
                            {selectedInspection.disassembly ? <div>
                                {selectedInspection.disassembly.instruction?.text ||
                                    selectedInspection.disassembly.instruction?.mnemonic || '—'}
                            </div> : <div role="status">{'No recorded instruction evidence'}</div>}
                            {selectedInspection.disassembly?.instruction?.bytes ? <div>
                                {selectedInspection.disassembly.instruction.bytes.map(byte =>
                                    Number(byte).toString(16).padStart(2, '0')).join(' ')}
                            </div> : null}
                        </div>
                        <div data-debug-selected-memory>
                            <strong>{`${this.tx('memory')} · recorded writes`}</strong>
                            {selectedInspection.memory.changes.slice(-8).map(change =>
                                <div key={`${change.seq}:${change.memory.space}:${change.memory.address}`}>
                                    {`${change.memory.space || 'mem'}:${Number(change.memory.address)
                                        .toString(16)} ${String(change.memory.before ?? '—')} → ` +
                                        `${String(change.memory.value)}`}
                                </div>)}
                            {selectedInspection.memory.changes.length ? null :
                                <div role="status">{'No recorded memory writes'}</div>}
                        </div>
                    </div>
                ) : null}

                {timingWaveform?.samples.length ? (
                    <DebugTimingWaveform
                        view={timingWaveform}
                        selectedSeq={timeline?.selectedSeq}
                        refusal={timelineRefusal}
                        onSelect={this.onWaveformSelect}
                        onZoom={this.onWaveformZoom}
                        onPan={this.onWaveformPan}
                        onSetTrigger={this.onWaveformSetTrigger}
                        onPreviousTrigger={this.onWaveformPreviousTrigger}
                        onNextTrigger={this.onWaveformNextTrigger}
                        onExport={this.onWaveformExport}
                    />
                ) : null}

                {hasActionStatus ? (
                    <div data-debug-event-action-status style={{display: 'flex', gap: 10,
                        alignItems: 'flex-start', flexWrap: 'wrap', fontSize: 11,
                        border: '1px solid #2c3e50', borderRadius: 4, padding: '5px 7px'}}>
                        <strong>{this.tx('actionActivity')}</strong>
                        {actionFailures.length ? (
                            <span data-debug-event-action-failures role="status" style={{color: '#ff9f8f'}}>
                                {`${this.tx('actionFailures')}: ${actionFailures.map(item =>
                                    `${item.breakpointId || '?'} ${item.actionType || '?'} ` +
                                    `${item.code || item.message || '?'}`).join(' · ')}`}
                            </span>
                        ) : null}
                        {actionLog.length ? (
                            <span data-debug-event-action-log>
                                {`${this.tx('actionLog')}: ${actionLog.map(item =>
                                    `${item.breakpointId || '?'} (${this.tx('actionEvent')} ` +
                                    `${item.eventSeq == null ? '—' : String(item.eventSeq)})`).join(' · ')}`}
                            </span>
                        ) : null}
                        {actionCounters.length ? (
                            <span data-debug-event-action-counters>
                                {`${this.tx('actionCounters')}: ${actionCounters.map(([name, value]) =>
                                    `${name}=${String(value)}`).join(' · ')}`}
                            </span>
                        ) : null}
                    </div>
                ) : null}

                {/* What this target cannot do, named rather than left as greyed
                    buttons with no explanation. The capability matrix is a teaching
                    surface: a live chip has no code breakpoints because the part has
                    no PSEN, and saying so is the point. */}
                {caps && caps.consumes && caps.consumes.length ? (
                    <div style={{color: '#f39c12', fontSize: 11}}>
                        {`${this.tx('consumes')} ${caps.consumes.join(', ')}`}
                    </div>
                ) : null}

                {/* THE HEAVY TIER'S CAVEATS, STATED WHERE THE ENGINE IS PICKED.
                    Both are properties of the engine and both are measured (the
                    light tier is the control in each case — bw-board
                    LABWIRED-BRIDGE.md §4 and §4c), so they are true before the
                    first Run and must be readable before it, not discovered
                    afterwards from a blink that comes out at half the asked
                    period. Once a session attaches, ui.engineNotes carries the
                    same two plus this bench's own refusal ledger, so this static
                    pair steps aside rather than being said twice. */}
                {this.state.kind === 'labwired' && !(ui.engineNotes || []).length ? (
                    <div style={{color: '#f39c12', fontSize: 11}}>
                        {this.tx('lwCaveats')}
                    </div>
                ) : null}
                {(ui.engineNotes || []).length ? (
                    <div style={{color: '#f39c12', fontSize: 11}}>
                        {ui.engineNotes.map((n, i) => (
                            <div key={i}>{`• ${n}`}</div>
                        ))}
                    </div>
                ) : null}

                {/* WHAT THE ENGINE KNOWS AND THE RUN DOES NOT SHOW. A fault looks
                    like firmware idling in its handler, and a skipped instruction
                    like firmware running correctly — the engine knows both, so
                    say them. Red for the fault (the run stopped because of it),
                    amber for the skipped instructions (the run may be wrong). */}
                {ui.engineDiagnostics && ui.engineDiagnostics.fault ? (
                    <div data-engine-fault style={{color: '#e74c3c', fontSize: 11}}>
                        {`${this.tx('engineFault')}: ${ui.engineDiagnostics.fault.summary}`}
                    </div>
                ) : null}
                {/* SAVE POINTS (LabWired, your own firmware on a chip). The engine
                    rebuilds the machine and replays to the point, refusing when
                    the replay does not match — so a restore either lands exactly
                    or says why. Shown only while stopped; a bench with a circuit
                    gets none (the circuit cannot be rewound with the firmware). */}
                {ui.savePoints && !ui.savePoints.unavailable && this.state.runner ? (
                    <div data-save-points style={{display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', fontSize: 11}}>
                        <button
                            style={{...BTN, padding: '2px 6px'}}
                            title={this.tx('savePointTitle')}
                            onClick={() => {
                                const r = this.state.runner.saveSnapshot(`#${ui.savePoints.points.length + 1}`);
                                if (r && r.unsupported) this.setState({savePointError: r.unsupported});
                                else this.setState({savePointError: null});
                            }}
                        >{`💾 ${this.tx('savePoint')}`}</button>
                        {ui.savePoints.points.map(p => (
                            <button
                                key={p.id}
                                style={{...BTN, padding: '2px 6px'}}
                                title={`${this.tx('restorePointTitle')} (${p.cycles} cycles)`}
                                onClick={() => {
                                    this._invalidateHddDownload();
                                    const r = this.state.runner.restoreSnapshot(p.id);
                                    this.setState({savePointError: r && r.unsupported ? r.unsupported : null});
                                }}
                            >{`↺ ${p.label || p.id}`}</button>
                        ))}
                        <label style={{display: 'inline-flex', alignItems: 'center', gap: 3}}
                            title={this.tx('engineReverseTitle')}>
                            <input
                                type="checkbox"
                                checked={!!this.state.runner.engineRecording}
                                onChange={e => {
                                    const r = this.state.runner.setEngineRecording(e.target.checked);
                                    this.setState({savePointError: r && r.unsupported ? r.unsupported : null});
                                }}
                            />
                            {this.tx('engineReverse')}
                        </label>
                        {this.state.savePointError ? (
                            <span style={{color: '#e74c3c'}}>{this.state.savePointError}</span>
                        ) : null}
                    </div>
                ) : null}
                {ui.engineDiagnostics && ui.engineDiagnostics.consoleMismatch ? (
                    <div data-engine-console style={{color: '#f39c12', fontSize: 11}}>
                        {`• ${ui.engineDiagnostics.consoleMismatch}`}
                    </div>
                ) : null}
                {ui.engineDiagnostics && ui.engineDiagnostics.fidelityGapCount ? (
                    <div data-engine-fidelity style={{color: '#f39c12', fontSize: 11}}>
                        <div>{`${this.tx('engineFidelity')} (${ui.engineDiagnostics.fidelityGapCount})`}</div>
                        {ui.engineDiagnostics.fidelityGaps.map((g, i) => (
                            <div key={i}>{`• ${typeof g === 'string' ? g : JSON.stringify(g)}`}</div>
                        ))}
                    </div>
                ) : null}

                {/* WHERE THIS IMAGE CAME FROM, when it was not compiled just now.
                    Neutral grey and not amber: a prebuilt image is provenance,
                    not a refusal, and the amber block above is where a learner
                    reads "something here does not work". The sentence says all
                    three parts — nothing was compiled, what it was built from
                    and when, and that an edit makes it stop applying — because
                    a reader who edits the program must not be left believing
                    the prebuilt image still describes it. See D2 in
                    docs/WAVE-OPEN-DEFECTS.md. */}
                {ui.imageProvenance ? (
                    <div
                        data-image-provenance={ui.imageProvenance.exampleId}
                        data-image-toolchain={ui.imageProvenance.toolchain || ''}
                        style={{color: '#7f8c8d', fontSize: 11}}
                    >{ui.imageProvenance.sentence}</div>
                ) : null}

                <div data-debug-status style={{display: 'flex', gap: 6, alignItems: 'baseline', overflowWrap: 'anywhere'}}>
                    <strong style={{color: phase === 'error' ? '#e74c3c'
                        : running ? '#2ecc71' : paused ? '#f39c12' : '#7f8c8d'}}>
                        {this.tx(phase) || phase}
                    </strong>
                    {message ? <span style={{color: '#7f8c8d'}}>{message}</span> : null}
                    {noImageLoaded ? <span data-debug-no-image style={{color: '#7f8c8d'}}>
                        {this.tx('noImageLoaded')}
                    </span> : null}
                </div>

                {/* What the user has marked, and what this build can actually do
                    with it. A mark on a block with no yield point is kept rather
                    than refused (block-menu.js), so it has to be VISIBLE — an
                    invisible mark that never fires is the worst of both. */}
                {ui.breakpoints?.length ? (
                    <div style={{borderTop: '1px solid #2c3e50', paddingTop: 8}}>
                        <div style={{color: '#7f8c8d', marginBottom: 4}}>
                            {this.tx('bps')}{` (${ui.breakpoints.length})`}
                        </div>
                        <div style={{color: '#95a5a6'}}>
                            {ui.breakpoints.map(id => {
                                const dead = (ui.unreachableBreakpoints || []).includes(id);
                                return (
                                    <div key={id} style={{color: dead ? '#7f8c8d' : '#ecf0f1'}}>
                                        {'● '}
                                        {(ui.yieldKinds && ui.yieldKinds[id]) || id.slice(0, 8)}
                                        {/* The condition belongs NEXT TO the mark:
                                            a pause point that has one and does not
                                            say so is the hardest kind to debug. */}
                                        {ui.conditions && ui.conditions[id] ? (
                                            <span style={{color: '#3498db', marginLeft: 6}}>
                                                {`when ${ui.conditions[id]}`}
                                            </span>
                                        ) : null}
                                        {ui.conditionErrors && ui.conditionErrors[id] ? (
                                            <span style={{color: '#e74c3c', marginLeft: 6}}>
                                                {ui.conditionErrors[id]}
                                            </span>
                                        ) : null}
                                        {dead ? ` — ${this.tx('unreachable')}` : ''}
                                    </div>
                                );
                            })}
                            {ui.skippedHits ? (
                                <div style={{fontSize: 11, marginTop: 4, color: '#5d6d7e'}}>
                                    {`${ui.skippedHits.toLocaleString()} ${this.tx('skipped')}`}
                                </div>
                            ) : null}
                            {(ui.unreachableBreakpoints || []).length ? (
                                <div style={{fontSize: 11, marginTop: 4, color: '#7f8c8d'}}>
                                    {this.tx('unreachableWhy')}
                                </div>
                            ) : null}
                        </div>
                    </div>
                ) : null}

                {/* VDP screen — video output from machines with a TMS9918A.
                    Polls runner.video() per animation frame. Only renders
                    when video() returns non-null (the machine has a VDP). */}
                {this.state.runner && typeof this.state.runner.video === 'function' ? (
                    <React.Suspense fallback={null}>
                      <div onMouseMove={this.state.runner.mouseIn ? this._mouseMove : undefined}
                          onMouseDown={this.state.runner.mouseIn ? this._mouseDown : undefined}
                          onMouseUp={this.state.runner.mouseIn ? this._mouseUp : undefined}
                          onMouseLeave={this.state.runner.mouseIn ? this._mouseLeave : undefined}
                          onContextMenu={this.state.runner.mouseIn ? e => e.preventDefault() : undefined}
                          style={{width: 'fit-content'}}>
                        <VdpScreen
                            videoFn={this._videoFn}
                            {...(this.state.runner && typeof this.state.runner.keyIn === 'function'
                                ? {sendScancodeFn: this._scancodeFn} : {})}
                            lang={this.props.locale}
                            data-testid="bw-vdp-screen"
                        />
                      </div>
                    </React.Suspense>
                ) : null}

                {/* LEDS. Mounted only when the machine has ports to show --
                    eight lamps that never light read as a broken program
                    rather than an absent chip. */}
                {this.state.runner && typeof this.state.runner.outputs === 'function' ? (
                    <React.Suspense fallback={null}>
                        <PortLeds outputsFn={this._outputsFn} />
                    </React.Suspense>
                ) : null}

                {/* SWITCHES AND SENSORS. Mounted only when the machine
                    declares inputs -- a panel of toggles that drive nothing
                    is indistinguishable from a program ignoring the user, so
                    the absence of hardware is the absence of the control. */}
                {this.state.runner && Array.isArray(this.state.runner.inputs)
                    && this.state.runner.inputs.length ? (
                        <React.Suspense fallback={null}>
                            <SwitchPanel
                                inputs={this.state.runner.inputs}
                                setInputFn={this._setInputFn}
                            />
                        </React.Suspense>
                    ) : null}

                {/* What is happening, in the user's own nouns. This comes FIRST
                    and the machine's view comes underneath — the order every
                    mature debugger uses, and the one this could not offer until
                    the symbol table learned which memory holds `counter`. */}
                {this.state.runner ? (
                    <DebugInspector runner={this.state.runner} locale={this.props.locale} />
                ) : null}

                {/* Where the program is, and what may honestly be said about
                    how it got there (D28). Sits between the user's nouns and
                    the machine's view because that is what it is: the position
                    in the user's terms, with the addresses that make it
                    checkable. On the C target it leads with the reason there
                    is no call stack to list. */}
                {this.state.runner ? (
                    <DebugFrames
                        runner={this.state.runner}
                        ui={ui}
                        kind={this.state.kind}
                        locale={this.props.locale}
                    />
                ) : null}

                {/* CPU internals (E8): a pipeline diagram with cache and
                    branch-predictor statistics, for a target that offers timing
                    models (the RISC-V bench). An instrument, so it lives here in
                    Debug; closed by default, and off until the user turns it on. */}
                {this.state.runner ? (
                    <DebugPipeline runner={this.state.runner} locale={this.props.locale} />
                ) : null}

                {/* Parity with emu8051's TUI, closed by default: opening it is
                    the user declaring they want the engineer's view. */}
                {this.state.runner ? (
                    <DebugDrawer
                        runner={this.state.runner}
                        ui={ui}
                        locale={this.props.locale}
                        clockHz={this.props.clockHz}
                    />
                ) : null}

                {/* Serial console — print output from the AVR USART / 8051 UART,
                    and the BASIC/monitor prompt on a retro bench. The runner
                    buffers serialLines and exposes snapshot.serialOutput; this
                    is the UI consumer.

                    It shows as soon as the machine can RECEIVE, not only once
                    it has said something: a console that is output-only is a
                    terminal with the keyboard unplugged — you can watch BBC
                    BASIC print its banner and have no way to answer it. */}
                {(ui.serialOutput && ui.serialOutput.length) || canSendSerial ? (
                    <div style={{borderTop: '1px solid #2c3e50', paddingTop: 8}}>
                        <div style={{color: '#7f8c8d', marginBottom: 4}}>
                            {this.state.runner && this.state.runner.terminal
                                ? `Terminal ${this.state.runner.terminal.cols}×${this.state.runner.terminal.rows}`
                                : 'Serial'}
                            {ui.serialOutput && ui.serialOutput.length &&
                                !(this.state.runner && this.state.runner.terminal)
                                ? ` (${ui.serialOutput.length})` : ''}
                        </div>
                        {this.state.runner && this.state.runner.terminal ? (
                            // A booted Linux: a real terminal, keys straight
                            // to the guest's tty (linux-terminal.jsx).
                            <React.Suspense fallback={<div data-testid="bw-linux-terminal-loading">{'…'}</div>}>
                                <LinuxTerminal
                                    key={this.state.runner.terminal.id}
                                    terminal={this.state.runner.terminal}
                                    hint={this.tx('terminalHint')}
                                />
                            </React.Suspense>
                        ) : <React.Fragment>
                            <pre
                                data-testid="bw-serial-console"
                                style={{
                                    margin: 0, padding: 6, maxHeight: 120, overflow: 'auto',
                                    background: '#0d1117', color: '#2ecc71', fontSize: 11,
                                    borderRadius: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                                    fontFamily: 'monospace'
                                }}
                            >{(ui.serialOutput || []).join('\n')}</pre>
                            {canSendSerial ? (
                                <div style={{display: 'flex', gap: 6, marginTop: 4, alignItems: 'center'}}>
                                    <span style={{color: '#2ecc71'}}>{'>'}</span>
                                    <input
                                        data-testid="bw-serial-input"
                                        type="text"
                                        value={this.state.serialInput}
                                        onChange={this.onSerialInput}
                                        onKeyDown={this.onSerialKeyDown}
                                        placeholder={this.tx('serialHint')}
                                        aria-label={this.tx('serialSend')}
                                        style={{
                                            flex: '1 1 auto', minWidth: 0, padding: '4px 6px',
                                            background: '#0d1117', color: '#2ecc71',
                                            border: '1px solid #2c3e50', borderRadius: 4,
                                            fontFamily: 'monospace', fontSize: 11
                                        }}
                                    />
                                    <button
                                        data-testid="bw-serial-send"
                                        style={{...BTN, padding: '3px 10px'}}
                                        onClick={this.onSerialSend}
                                        title={this.tx('serialSend')}
                                    >{'⏎'}</button>
                                </div>
                            ) : null}
                        </React.Fragment>}
                    </div>
                ) : null}

                {/* Blinkenrocket has no command UART. Its phone/web editor
                    sends an FSK audio packet to PA0/ADC6, so present that
                    hardware input as its own debugger capability. */}
                {canSendBlinkenrocket ? (
                    <div data-testid="bw-blinkenrocket-modem"
                        style={{borderTop: '1px solid #2c3e50', paddingTop: 8}}>
                        <div style={{color: '#7f8c8d', marginBottom: 4}}>
                            {this.tx('modem')}
                        </div>
                        <div style={{display: 'flex', gap: 6, alignItems: 'center'}}>
                            <input
                                data-testid="bw-blinkenrocket-modem-input"
                                type="text"
                                value={this.state.modemInput}
                                onChange={this.onModemInput}
                                onKeyDown={this.onModemKeyDown}
                                placeholder={this.tx('modemHint')}
                                aria-label={this.tx('modemSend')}
                                style={{
                                    flex: '1 1 auto', minWidth: 0, padding: '4px 6px',
                                    background: '#0d1117', color: '#f1c40f',
                                    border: '1px solid #2c3e50', borderRadius: 4,
                                    fontFamily: 'monospace', fontSize: 11
                                }}
                            />
                            <button
                                data-testid="bw-blinkenrocket-modem-send"
                                style={{...BTN, padding: '3px 10px'}}
                                disabled={!this.state.modemInput}
                                onClick={this.onModemSend}
                                title={this.tx('modemSend')}
                            >{'▶'}</button>
                        </div>
                        {this.state.modemStatus ? (
                            <div data-testid="bw-blinkenrocket-modem-status"
                                style={{fontSize: 10, color: this.state.modemStatus.accepted ? '#2ecc71' : '#e74c3c'}}>
                                {this.state.modemStatus.accepted ?
                                    `${this.tx('modemSent')} (${this.state.modemStatus.samples} samples)` :
                                    this.state.modemStatus.reason}
                            </div>
                        ) : null}
                    </div>
                ) : null}

                {/* Level 1 is yield-to-yield. Say so, rather than letting the
                    highlight imply a precision the position does not have. */}
                {paused && why ? (
                    <div style={{color: '#95a5a6'}}>
                        <div>
                            {this.tx('pausedAt')}
                            {' '}
                            <code style={{color: '#ecf0f1'}}>
                                {`PC ${Number.isFinite(why.pc) ? '0x' + why.pc.toString(16).padStart(4, '0') : '?'}`}
                            </code>
                            {' '}
                            {this.tx('afterMs')}
                            {' '}
                            {`${(Number(why.tNs) / 1e6).toFixed(2)} ms`}
                        </div>
                        {/* A watchpoint halt is the one stop whose subject is
                            an ADDRESS rather than a PC. "Paused at PC 0x0142"
                            is not an answer to "what wrote my variable?", so
                            the byte and its transition are reported here. The
                            previous value travels with the new one because the
                            transition is the evidence — a value with no before
                            is half a measurement. */}
                        {why.cause === 'watchpoint' && Number.isFinite(why.addr) ? (
                            <div style={{marginTop: 4}} data-watch-hit>
                                <span style={{color: '#f39c12'}}>{this.tx('watchHit')}</span>
                                {' '}
                                <code style={{color: '#ecf0f1'}}>
                                    {`${why.space || 'iram'} 0x${why.addr.toString(16).toUpperCase().padStart(2, '0')}`}
                                </code>
                                {Number.isFinite(why.value) ? (
                                    <span>
                                        {' — '}
                                        {this.tx('watchWas')}
                                        {' '}
                                        <code style={{color: '#95a5a6'}}>
                                            {`0x${(why.prev >>> 0).toString(16).toUpperCase().padStart(2, '0')}`}
                                        </code>
                                        {', '}
                                        {this.tx('watchNow')}
                                        {' '}
                                        <code style={{color: '#2ecc71'}}>
                                            {`0x${(why.value >>> 0).toString(16).toUpperCase().padStart(2, '0')}`}
                                        </code>
                                        {` (${why.value})`}
                                    </span>
                                ) : null}
                                <div style={{fontSize: 11, marginTop: 2, color: '#7f8c8d'}}>
                                    {this.tx('watchNote')}
                                </div>
                            </div>
                        ) : null}
                        <div style={{fontSize: 11, marginTop: 4}}>{this.tx('yieldNote')}</div>
                    </div>
                ) : null}
            </div>
        );
    }
}

DebugPanel.propTypes = {
    clockHz: PropTypes.number,
    onRunnerChange: PropTypes.func,
    onRunnerGone: PropTypes.func,
    runToken: PropTypes.number,
    stopToken: PropTypes.number,
    locale: PropTypes.string,
    vm: PropTypes.shape({toJSON: PropTypes.func, runtime: PropTypes.object}).isRequired
};

export default connect(state => ({
    vm: state.scratchGui.vm,
    locale: state.locales.locale
}))(DebugPanel);
