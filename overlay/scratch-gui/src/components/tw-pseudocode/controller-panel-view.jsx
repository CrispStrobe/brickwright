import React, {useEffect, useRef} from 'react';
import { ControllerPanel, WIDGET_TYPES, WIDGET_DEFAULTS } from 'bw-board/controller.js';
import { bindPanelToBoard } from 'bw-board/controller-binding.js';
import {clearControllerPanel, createWidgetButtonInputs, releaseMomentaryButtons,
    serializeControllerPanel} from '../../lib/controller-inputs.js';
import EditorHelp from '../gui/editor-help.jsx';
import MachineConsole from './machine-console.jsx';
import 'bw-circuit-ui/components/kim1-panel.css';
import MachineScreenHeader from './machine-screen-header.jsx';
import MachineTerminal from './machine-terminal.jsx';
import {browserLocale, makeT} from '../../lib/bw-i18n.js';
import {activateUndoSurface, notifyUndoState, registerUndoSurface} from '../../lib/global-undo.js';
import {addAceKimFace, isAceKimFace, addCardiacFace, addKim1Face, addKim1VideoFace, addMicrotronicFace, isCardiacFace, isKim1Face, isKim1VideoFace, isMicrotronicFace, MACHINE_WIDGET_HEIGHT} from '../../lib/controller-machine-faces.js';
import {LOGIKUS_LAMP_WIDGETS, LOGIKUS_SWITCH_WIDGETS, LOGIKUS_TEST_WIDGET} from '../../lib/logikus/controller-bridge.js';
import SpikePortMonitor from './spike-port-monitor.jsx';
import {CONSOLE_6502_CHANGED, isConsoleMonitor, sendConsoleLine} from '../../lib/bw-debug/console-6502.js';

const AceKimFace = React.lazy(() => import(/* webpackChunkName: "bw-ace-kim-face" */ 'bw-circuit-ui/components/AceKimPanel.jsx')
    .then(module => ({default: module.AceKimFace})));
const MicrotronicSurface = React.lazy(() => import(/* webpackChunkName: "bw-microtronic-surface" */ './microtronic-surface.jsx'));
const Kim1Surface = React.lazy(() => import(/* webpackChunkName: "bw-kim1-surface" */ './kim1-surface.jsx'));

const L10N = {
    en: {
        virtualSerial: 'Virtual serial console',
        sendLine: 'Send console line',
        consoleInput: '6502 console input',
        surface: 'Controller surface',
        gridSnap: 'Grid snap',
        gridOn: 'Grid snap on',
        gridOff: 'Grid snap off',
        'cancel': 'Cancel',
        'pinPlaceholder': 'P1.0 / D9',
        'chooseImage': 'Choose an Image',
        title: 'Controller',
        edit: 'Edit', play: 'Play',
        enterFullScreen: 'Full screen',
        exitFullScreen: 'Exit full screen',
        addWidget: '+ Add Widget',
        joystick: 'Joystick', button: 'Button', slider: 'Slider',
        dpad: 'D-Pad', dial: 'Dial',
        bindPart: 'Bind to part…', bindProgram: 'Program only',
        unbind: 'Unbind', remove: 'Remove',
        hideBindings: 'Hide binding targets', keyboardKey: 'Keyboard key', compact: 'Compact card',
        namePlaceholder: 'name',
        noWidgets: 'No widgets yet. Click "+ Add Widget" to begin.',
        x: 'X', y: 'Y',
        config: 'Config', binding: 'Binding', bindTo: 'target',
        bind_program: 'Program only', bind_variable: 'Variable', bind_part: 'Board part',
        bind_pin: 'Pin', bind_none: 'Unbound',
        variable: 'name', part: 'part', param: 'param', pin: 'pin',
        toggleHint: 'latches on press',
    },
    de: {
        virtualSerial: 'Virtuelle serielle Konsole',
        sendLine: 'Konsolenzeile senden',
        consoleInput: '6502-Konsoleneingabe',
        surface: 'Controller-Oberfläche',
        gridSnap: 'Am Raster ausrichten',
        gridOn: 'Rasterfang ein',
        gridOff: 'Rasterfang aus',
        'cancel': 'Abbrechen',
        'pinPlaceholder': 'P1.0 / D9',
        'chooseImage': 'Ein Bild wählen',
        title: 'Controller',
        edit: 'Bearbeiten', play: 'Spielen',
        enterFullScreen: 'Vollbild',
        exitFullScreen: 'Vollbild verlassen',
        addWidget: '+ Widget hinzufügen',
        joystick: 'Joystick', button: 'Taste', slider: 'Schieberegler',
        dpad: 'Steuerkreuz', dial: 'Drehregler',
        bindPart: 'An Bauteil binden…', bindProgram: 'Nur Programm',
        unbind: 'Lösen', remove: 'Entfernen',
        hideBindings: 'Bindungsziele ausblenden', keyboardKey: 'Tastenkürzel', compact: 'Kompakte Karte',
        namePlaceholder: 'Name',
        noWidgets: 'Noch keine Widgets. Klicke auf „+ Widget hinzufügen".',
        x: 'X', y: 'Y',
        config: 'Konfiguration', binding: 'Bindung', bindTo: 'Ziel',
        bind_program: 'Nur Programm', bind_variable: 'Variable', bind_part: 'Bauteil',
        bind_pin: 'Pin', bind_none: 'Ungebunden',
        variable: 'Name', part: 'Bauteil', param: 'Parameter', pin: 'Pin',
        toggleHint: 'rastet beim Drücken ein',
    }
};
const translate = makeT(L10N);
const t = (key, locale = browserLocale()) => translate(locale, key);
const BASIC_INPUT_EXAMPLE = 'PRINT 2+2';

// ─── Functional widget config ─────────────────────────────────────────────
//
// What the inspector can EDIT about a widget, beyond its placement and its
// decoration. Until this table existed the inspector's only `onConfig` calls
// were `color`, `fontSize`, `src` and `text` — the two decoration widgets —
// so a button's `toggle`, a slider's `min`/`max`/`step`, a gauge's range and
// a matrix's `rows`/`cols` were reachable only by hand-editing
// `controller.json`. The behaviour behind every one of them was implemented
// and correct; it was simply unreachable, which is what broke
// `interactive-input-controls` (docs/LESSON-REVIEW-WAVE-4.md defect 4).
//
// Keys named here are CONFIG (the template). A widget's live reading lives in
// `state` and is not editable from the inspector — a gauge shows what the
// program writes, and a slider whose value the inspector could overwrite
// would fight the learner's thumb.
//
// `test/controller-inspector-config.test.mjs` checks this table against
// `WIDGET_DEFAULTS`, so a widget type that grows a config key and does not
// grow an editor here fails rather than quietly becoming JSON-only.
const CONFIG_FIELDS = {
    button: [{ key: 'toggle', kind: 'bool', label: 'toggle' },
        {key: 'label', kind: 'text', label: 'label'}, {key: 'key', kind: 'text', label: 'key'}],
    slider: [
        { key: 'min', kind: 'num', label: 'min' },
        { key: 'max', kind: 'num', label: 'max' },
        { key: 'step', kind: 'num', label: 'step', min: 0 },
    ],
    dial: [
        { key: 'min', kind: 'num', label: 'min' },
        { key: 'max', kind: 'num', label: 'max' },
    ],
    gauge: [
        { key: 'min', kind: 'num', label: 'min' },
        { key: 'max', kind: 'num', label: 'max' },
        { key: 'label', kind: 'text', label: 'units' },
    ],
    bargraph: [
        { key: 'min', kind: 'num', label: 'min' },
        { key: 'max', kind: 'num', label: 'max' },
        { key: 'segments', kind: 'num', label: 'segs', min: 1 },
        { key: 'label', kind: 'text', label: 'units' },
    ],
    // rows*cols must stay <= 32: the matrix's whole state is one row-major
    // bitmask, so a bigger face would lose bits to int coercion.
    matrix: [
        { key: 'rows', kind: 'num', label: 'rows', min: 1, max: 32 },
        { key: 'cols', kind: 'num', label: 'cols', min: 1, max: 32 },
    ],
    keypad: [
        { key: 'rows', kind: 'num', label: 'rows', min: 1 },
        { key: 'cols', kind: 'num', label: 'cols', min: 1 },
    ],
    lcd: [
        { key: 'rows', kind: 'num', label: 'rows', min: 1 },
        { key: 'cols', kind: 'num', label: 'cols', min: 1 },
    ],
    oled: [
        { key: 'rows', kind: 'num', label: 'rows', min: 1 },
        { key: 'cols', kind: 'num', label: 'cols', min: 1 },
    ],
    terminal: [
        { key: 'rows', kind: 'num', label: 'rows', min: 1 },
        { key: 'cols', kind: 'num', label: 'cols', min: 1 },
    ],
    sevenseg: [{ key: 'digits', kind: 'num', label: 'digits', min: 1, max: 12 }],
    simplevga: [
        { key: 'width', kind: 'num', label: 'width', min: 1 },
        { key: 'height', kind: 'num', label: 'height', min: 1 },
    ],
    mono_lcd: [
        { key: 'width', kind: 'num', label: 'width', min: 1 },
        { key: 'height', kind: 'num', label: 'height', min: 1 },
    ],
    rgb_light: [{ key: 'mode', kind: 'choice', label: 'mode', choices: ['rgb', 'legoColor'] }],
    text: [
        { key: 'text', kind: 'text', label: 'text' },
        { key: 'fontSize', kind: 'num', label: 'size', min: 1 },
        { key: 'color', kind: 'color', label: 'colour' },
    ],
    image: [{ key: 'alt', kind: 'text', label: 'alt' }],
};

// Config keys with no field in the table above, and why. Named explicitly so
// the coverage gate can tell "not editable on purpose" from "nobody wrote an
// editor" — which is the distinction that let the whole functional half go
// missing unnoticed.
//
//   value/pressed/x/y/up/down/left/right/lastKey/buffer — a widget's LIVE
//     READING, not its template. A gauge shows what the program writes; a
//     slider the inspector could overwrite would fight the learner's thumb.
//   text — a display's contents, written by its binding. (The `text`
//     DECORATION's own text IS editable; it has a field above.)
//   src — the image widget's picture, edited by the Library/Upload buttons
//     rather than by a text field.
//   labels — a keypad's custom key captions, an array with no sane inline
//     editor; still settable from controller.json.
const NON_FIELD_CONFIG_KEYS = new Set([
    'value', 'pressed', 'text', 'x', 'y', 'up', 'down', 'left', 'right',
    'lastKey', 'buffer', 'labels', 'src',
]);

/** Binding targets the panel model implements, in the order the UI offers them. */
const BIND_TARGETS = ['program', 'variable', 'part', 'pin', 'none'];

// Presentation-only widgets: neither input nor display, so nothing binds them.
// Mirrors DECORATION_TYPES in the panel model; the coverage gate checks it.
const DECORATION_NAMES = new Set(['text', 'image']);

// ─── Joystick widget ─────────────────────────────────────────────────────

const KNOB_RADIUS = 18;
const PAD_RADIUS = 50;

class JoystickWidget extends React.Component {
    constructor(props) {
        super(props);
        this.state = { dragging: false };
        this._padRef = React.createRef();
        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
    }

    _getRelative(e) {
        const rect = this._padRef.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        let dx = e.clientX - cx;
        let dy = e.clientY - cy;
        const maxR = rect.width / 2 - KNOB_RADIUS;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxR) { dx = dx / dist * maxR; dy = dy / dist * maxR; }
        // Map to -100..100
        const x = Math.round(dx / maxR * 100);
        const y = Math.round(-dy / maxR * 100); // Y up is positive
        return { x, y, px: dx, py: dy };
    }

    _onPointerDown(e) {
        if (this.props.mode !== 'play') return;
        e.preventDefault();
        e.target.setPointerCapture(e.pointerId);
        this.setState({ dragging: true });
        const { x, y } = this._getRelative(e);
        this.props.onInput(this.props.name, x, y);
    }

    _onPointerMove(e) {
        if (!this.state.dragging) return;
        const { x, y } = this._getRelative(e);
        this.props.onInput(this.props.name, x, y);
    }

    _onPointerUp(e) {
        if (!this.state.dragging) return;
        this.setState({ dragging: false });
        // Spring back to center
        this.props.onInput(this.props.name, 0, 0);
    }

    render() {
        const { widget, mode } = this.props;
        const { x = 0, y = 0 } = widget.state;
        const maxR = PAD_RADIUS - KNOB_RADIUS;
        const knobX = x / 100 * maxR;
        const knobY = -y / 100 * maxR; // screen Y is inverted
        const playable = mode === 'play';
        return (
            <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4}}>
            <div
                ref={this._padRef}
                style={{
                    width: PAD_RADIUS * 2,
                    height: PAD_RADIUS * 2,
                    borderRadius: '50%',
                    background: playable ? '#e2e8f0' : '#f1f5f9',
                    border: '2px solid #94a3b8',
                    position: 'relative',
                    cursor: playable ? 'pointer' : 'default',
                    touchAction: 'none',
                    userSelect: 'none',
                }}
                onPointerDown={this._onPointerDown}
                onPointerMove={this._onPointerMove}
                onPointerUp={this._onPointerUp}
            >
                {/* Crosshair */}
                <div style={{
                    position: 'absolute', left: '50%', top: 0, bottom: 0,
                    width: 1, background: '#cbd5e1', transform: 'translateX(-0.5px)'
                }} />
                <div style={{
                    position: 'absolute', top: '50%', left: 0, right: 0,
                    height: 1, background: '#cbd5e1', transform: 'translateY(-0.5px)'
                }} />
                {/* Knob */}
                <div style={{
                    position: 'absolute',
                    left: PAD_RADIUS + knobX - KNOB_RADIUS,
                    top: PAD_RADIUS + knobY - KNOB_RADIUS,
                    width: KNOB_RADIUS * 2,
                    height: KNOB_RADIUS * 2,
                    borderRadius: '50%',
                    background: this.state.dragging ? '#7C3AED' : '#6366f1',
                    border: '2px solid #4f46e5',
                    transition: this.state.dragging ? 'none' : 'left 0.15s, top 0.15s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }} />
            </div>
                {/* Value readout — in normal flow (not absolute) so the widget card
                    reserves height for it and it never overlaps the binding label
                    ("Program only") at the bottom of the card. */}
                <div style={{
                    textAlign: 'center', fontSize: 11, color: '#64748b', fontFamily: 'monospace'
                }}>
                    {t('x')}:{x} {t('y')}:{y}
                </div>
            </div>
        );
    }
}

// ─── D-pad widget ─────────────────────────────────────────────────────────

const DPAD_SIZE = 120;
const DPAD_BTN = 36;

function DpadWidget({ widget, name, mode, panel }) {
    const playable = mode === 'play';
    const { up = false, down = false, left = false, right = false } = widget.state;
    const dirs = [
        { key: 'up',    label: '▲', x: (DPAD_SIZE - DPAD_BTN) / 2, y: 0 },
        { key: 'down',  label: '▼', x: (DPAD_SIZE - DPAD_BTN) / 2, y: DPAD_SIZE - DPAD_BTN },
        { key: 'left',  label: '◄', x: 0, y: (DPAD_SIZE - DPAD_BTN) / 2 },
        { key: 'right', label: '►', x: DPAD_SIZE - DPAD_BTN, y: (DPAD_SIZE - DPAD_BTN) / 2 },
    ];
    const pressed = { up, down, left, right };
    return (
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4}}>
        <div style={{
            width: DPAD_SIZE, height: DPAD_SIZE,
            position: 'relative', userSelect: 'none',
        }}>
            {/* Center cross background */}
            <div style={{
                position: 'absolute',
                left: (DPAD_SIZE - DPAD_BTN) / 2, top: 0,
                width: DPAD_BTN, height: DPAD_SIZE,
                background: '#e2e8f0', borderRadius: 6,
            }} />
            <div style={{
                position: 'absolute',
                left: 0, top: (DPAD_SIZE - DPAD_BTN) / 2,
                width: DPAD_SIZE, height: DPAD_BTN,
                background: '#e2e8f0', borderRadius: 6,
            }} />
            {dirs.map(d => (
                <button
                    key={d.key}
                    disabled={!playable}
                    onPointerDown={() => panel.setDpadInput(name, d.key, true)}
                    onPointerUp={() => panel.setDpadInput(name, d.key, false)}
                    onPointerLeave={() => { if (pressed[d.key]) panel.setDpadInput(name, d.key, false); }}
                    style={{
                        position: 'absolute', left: d.x, top: d.y,
                        width: DPAD_BTN, height: DPAD_BTN,
                        border: 'none', borderRadius: 6,
                        background: pressed[d.key] ? '#7C3AED' : '#cbd5e1',
                        color: pressed[d.key] ? '#fff' : '#334155',
                        fontSize: 16, fontWeight: 700,
                        cursor: playable ? 'pointer' : 'default',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.1s',
                    }}
                >
                    {d.label}
                </button>
            ))}
        </div>
            {/* Readout — in normal flow so it never overlaps the binding label below. */}
            <div style={{
                textAlign: 'center', fontSize: 11, color: '#64748b', fontFamily: 'monospace'
            }}>
                {up ? '↑' : ''}{down ? '↓' : ''}{left ? '←' : ''}{right ? '→' : ''}{(!up && !down && !left && !right) ? '·' : ''}
            </div>
        </div>
    );
}

// ─── Matrix display face ──────────────────────────────────────────────────
// Read-only: a rows×cols grid of dots lit from the widget's bitmask state
// (bit r*cols+c). The program writes a bound variable; bindPanelToVariables
// pumps it into panel.setMatrixValue; the panel event re-renders this face.

function MatrixWidget({ widget }) {
    const rows = widget.config.rows | 0 || 5;
    const cols = widget.config.cols | 0 || 5;
    const bits = Number(widget.state.value) || 0;
    const dots = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const lit = (bits >>> (r * cols + c)) & 1;
            dots.push(
                <div key={`${r}-${c}`}
                    data-lit={lit ? '1' : '0'}
                    style={{
                        width: 12, height: 12, borderRadius: 3,
                        background: lit ? '#ef4444' : '#e2e8f0',
                        boxShadow: lit ? '0 0 6px rgba(239,68,68,0.7)' : 'none',
                        transition: 'background 80ms'
                    }}
                />
            );
        }
    }
    return (
        <div data-testid={`bw-ctl-matrix-${widget.name}`}
            style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${cols}, 12px)`,
                gap: 3, padding: 8,
                background: '#1e293b', borderRadius: 8
            }}>
            {dots}
        </div>
    );
}

// ─── Seven-segment display face ───────────────────────────────────────────
// Read-only numeric face: the bound variable's value, truncated to integer,
// right-aligned across config.digits tubes; dashes when it does not fit.
// Classic segment layout per tube (a top, g middle, dp omitted).

const SEVENSEG_FONT = {
    '0': 0x3F, '1': 0x06, '2': 0x5B, '3': 0x4F, '4': 0x66,
    '5': 0x6D, '6': 0x7D, '7': 0x07, '8': 0x7F, '9': 0x6F,
    '-': 0x40, ' ': 0x00
};

function SevenSegDigit({ bits }) {
    // segment geometry inside a 22x36 tube: a,b,c,d,e,f,g (bit 0..6)
    const on = (i) => (bits >> i) & 1;
    const seg = (lit, style) => (
        <div style={{
            position: 'absolute', background: lit ? '#f87171' : '#374151',
            boxShadow: lit ? '0 0 4px rgba(248,113,113,0.8)' : 'none',
            borderRadius: 2, ...style
        }} />
    );
    return (
        <div style={{ position: 'relative', width: 22, height: 36 }}>
            {seg(on(0), { left: 4, top: 0, width: 14, height: 4 })}
            {seg(on(1), { right: 0, top: 3, width: 4, height: 13 })}
            {seg(on(2), { right: 0, bottom: 3, width: 4, height: 13 })}
            {seg(on(3), { left: 4, bottom: 0, width: 14, height: 4 })}
            {seg(on(4), { left: 0, bottom: 3, width: 4, height: 13 })}
            {seg(on(5), { left: 0, top: 3, width: 4, height: 13 })}
            {seg(on(6), { left: 4, top: 16, width: 14, height: 4 })}
        </div>
    );
}

function SevenSegWidget({ widget }) {
    const digits = (widget.config.digits | 0) || 4;
    const raw = Math.trunc(Number(widget.state.value) || 0);
    const neg = raw < 0;
    let text = String(Math.abs(raw));
    let shown;
    if (text.length + (neg ? 1 : 0) > digits) shown = '-'.repeat(digits);
    else shown = ((neg ? '-' : '') + text).padStart(digits, ' ');
    return (
        <div data-testid={`bw-ctl-sevenseg-${widget.name}`} data-shown={shown}
            style={{
                display: 'flex', gap: 4, padding: '8px 10px',
                background: '#111827', borderRadius: 8
            }}>
            {shown.split('').map((ch, i) => (
                <SevenSegDigit key={i} bits={SEVENSEG_FONT[ch] ?? 0x40} />
            ))}
        </div>
    );
}

// ─── Keypad face ──────────────────────────────────────────────────────────
// Input: a rows×cols grid of labelled keys. Pressing key i calls
// panel.setKeypadInput(name, i), which writes config.labels[i] (or the index)
// to the widget value; the binding pushes that to the bound variable.

function KeypadWidget({ widget, mode, panel }) {
    const playable = mode === 'play';
    const cols = (widget.config.cols | 0) || 4;
    const rows = (widget.config.rows | 0) || 4;
    const labels = widget.config.labels;
    const keys = [];
    for (let i = 0; i < rows * cols; i++) {
        keys.push(
            <button key={i}
                data-testid={`bw-ctl-keypad-${widget.name}-${i}`}
                disabled={!playable}
                onPointerDown={() => panel.setKeypadInput(widget.name, i)}
                style={{
                    width: 36, height: 36, border: '1px solid #cbd5e1', borderRadius: 6,
                    background: '#f8fafc', color: '#1e293b', fontWeight: 700, fontSize: 15,
                    cursor: playable ? 'pointer' : 'default',
                }}
            >{labels ? (labels[i] ?? '') : String(i)}</button>
        );
    }
    return (
        <div data-testid={`bw-ctl-keypad-${widget.name}`}
            style={{
                display: 'grid', gridTemplateColumns: `repeat(${cols}, 36px)`,
                gap: 4, padding: 8, background: '#1e293b', borderRadius: 8,
            }}>
            {keys}
        </div>
    );
}

// ─── Character-matrix text faces (LCD, OLED) ──────────────────────────────
// Both are read-only text DISPLAYS: the program writes a bound variable, the
// pump calls setLcdText/setOledText, this face renders state.text as `rows`
// lines each clipped/padded to `cols`. LCD = classic teal-on-dark; OLED =
// white-on-black, denser. `data-shown` (rows joined by |) is the gate hook.

function makeTextRows(text, rows, cols) {
    const lines = String(text || '').split('\n');
    const out = [];
    for (let r = 0; r < rows; r++) out.push((lines[r] || '').slice(0, cols).padEnd(cols, ' '));
    return out;
}

function LcdWidget({ widget }) {
    const cols = (widget.config.cols | 0) || 8;
    const rows = (widget.config.rows | 0) || 2;
    const shown = makeTextRows(widget.state.text, rows, cols);
    return (
        <div data-testid={`bw-ctl-lcd-${widget.name}`} data-shown={shown.join('|')}
            style={{
                padding: '8px 10px', background: '#052e2b', borderRadius: 6,
                fontFamily: 'monospace', fontSize: 16, lineHeight: '20px',
                color: '#5eead4', letterSpacing: 2, whiteSpace: 'pre',
                textShadow: '0 0 4px rgba(94,234,212,0.6)',
            }}>
            {shown.join('\n')}
        </div>
    );
}

function OledWidget({ widget }) {
    const cols = (widget.config.cols | 0) || 21;
    const rows = (widget.config.rows | 0) || 4;
    // PIXEL mode: a part binding mirrors the circuit SSD1306's actual
    // GDDRAM (panel.setOledPixels). There is no text to show — the device
    // draws through a pixel font — so the face becomes a canvas. Text mode
    // below is unchanged for variable bindings.
    const fb = widget.state.fb;
    const fbW = widget.state.fbW || 128;
    const fbH = widget.state.fbH || 64;
    const canvasRef = React.useRef(null);
    React.useEffect(() => {
        if (!fb || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        const img = ctx.createImageData(fbW, fbH);
        for (let y = 0; y < fbH; y++) {
            for (let x = 0; x < fbW; x++) {
                // ssd1306 page layout: pages×width bytes, LSB at the top row.
                const on = (fb[(y >> 3) * fbW + x] >> (y & 7)) & 1;
                const o = (y * fbW + x) * 4;
                img.data[o] = on ? 0xe0 : 0x08;
                img.data[o + 1] = on ? 0xf2 : 0x0a;
                img.data[o + 2] = on ? 0xfe : 0x14;
                img.data[o + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
    }, [fb, fbW, fbH]);
    if (fb) {
        return (
            <canvas ref={canvasRef} width={fbW} height={fbH}
                data-testid={`bw-ctl-oled-${widget.name}`} data-pixels="1"
                style={{ width: '100%', display: 'block', imageRendering: 'pixelated',
                    background: '#000', borderRadius: 6 }} />
        );
    }
    const shown = makeTextRows(widget.state.text, rows, cols);
    return (
        <div data-testid={`bw-ctl-oled-${widget.name}`} data-shown={shown.join('|')}
            style={{
                padding: 8, background: '#000', borderRadius: 6,
                fontFamily: 'monospace', fontSize: 12, lineHeight: '15px',
                color: '#e0f2fe', whiteSpace: 'pre', letterSpacing: 1,
            }}>
            {shown.join('\n')}
        </div>
    );
}

/**
 * TERMINAL face: an OLED-like text display whose bound variable is a GROWING
 * transcript, so it shows the LAST `rows` lines rather than the first.
 *
 * `makeTextRows` above is head-anchored and correct for an LCD or OLED, where
 * the variable holds exactly what the screen should show. A terminal's
 * variable is appended to for as long as the program runs — `6502-terminal`'s
 * `serial_out` grows with every echoed keystroke — so head-anchoring would
 * freeze the face on the first screenful and never show the prompt the
 * learner just typed at. Long lines wrap rather than truncate, for the same
 * reason: the end of a line is exactly the part being read.
 */
function makeTerminalRows(text, rows, cols) {
    const wrapped = [];
    for (const line of String(text || '').split('\n')) {
        if (line.length <= cols) { wrapped.push(line); continue; }
        for (let i = 0; i < line.length; i += cols) wrapped.push(line.slice(i, i + cols));
    }
    const out = wrapped.slice(-rows);
    while (out.length < rows) out.push('');
    return out.map(l => l.padEnd(cols, ' '));
}

function TerminalWidget({ widget, text = widget.state.text }) {
    const cols = (widget.config.cols | 0) || 40;
    const rows = (widget.config.rows | 0) || 8;
    const shown = makeTerminalRows(text, rows, cols);
    return (
        <div data-testid={`bw-ctl-terminal-${widget.name}`} data-shown={shown.join('|')}
            style={{
                padding: 8, background: '#0b1020', borderRadius: 6,
                fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace',
                fontSize: 12, lineHeight: '15px',
                color: '#a7f3d0', whiteSpace: 'pre', letterSpacing: 0.5,
            }}>
            {shown.join('\n')}
        </div>
    );
}

// ─── Positioned widget (the layout editor's canvas item) ──────────────────
// Applies layout.{x,y,w,h,rotation}; in EDIT mode adds drag-to-move (grid
// snapped by the host), a corner resize handle and a rotate handle (15deg
// steps). layout is PLACEMENT — a joystick's state.{x,y} INPUT is unrelated.

function PositionedWidget({ widget, mode, selected, snap, onSelect, onLayout, children, fitCanvas }) {
    const L = widget.layout || {};
    const machine = widget.type === 'machine';
    const ref = React.useRef(null);
    const gesture = React.useRef(null);

    // Content scaling: a face renders at its own natural size, so resizing the
    // box did nothing to the content. Measure the natural (unscaled) size —
    // inline-block content sizes to itself, not the parent, and CSS transforms
    // don't affect offsetWidth — then scale the face to fill layout.w/h.
    const contentRef = React.useRef(null);
    const [natural, setNatural] = React.useState(null);
    React.useLayoutEffect(() => {
        const el = contentRef.current;
        if (!el) return;
        const w = el.offsetWidth, h = el.offsetHeight;
        setNatural(prev => (prev && prev.w === w && prev.h === h) ? prev : { w, h });
    }, [widget.type, widget.config]);
    const sx = (!machine && L.w && natural && natural.w) ? L.w / natural.w : 1;
    const sy = (!machine && L.h && natural && natural.h) ? L.h / natural.h : 1;

    const beginDrag = e => {
        if (mode !== 'edit') return;
        if (machine && e.target.closest('button, input, select, textarea, summary')) return;
        onSelect();
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic events have no active pointer */ }
        gesture.current = { kind: 'move', px: e.clientX, py: e.clientY, x: L.x || 0, y: L.y || 0 };
    };
    const beginResize = e => {
        e.stopPropagation();
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic events have no active pointer */ }
        const el = ref.current;
        gesture.current = { kind: 'resize', px: e.clientX, py: e.clientY,
            w: L.w || (el ? el.offsetWidth : 120), h: L.h || (el ? el.offsetHeight : 120) };
    };
    const beginRotate = e => {
        e.stopPropagation();
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic events have no active pointer */ }
        const el = ref.current;
        const r = el.getBoundingClientRect();
        gesture.current = { kind: 'rotate', cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    };
    const move = e => {
        const g = gesture.current;
        if (!g) return;
        if (g.kind === 'move') {
            onLayout({ x: Math.max(0, snap(g.x + e.clientX - g.px)),
                y: Math.max(0, snap(g.y + e.clientY - g.py)) }, false);
        } else if (g.kind === 'resize') {
            onLayout({ w: Math.max(40, snap(g.w + e.clientX - g.px)),
                h: Math.max(32, snap(g.h + e.clientY - g.py)) }, false);
        } else if (g.kind === 'rotate') {
            const deg = Math.atan2(e.clientY - g.cy, e.clientX - g.cx) * 180 / Math.PI + 90;
            onLayout({ rotation: ((Math.round(deg / 15) * 15) % 360 + 360) % 360 }, false);
        }
    };
    const end = () => {
        if (gesture.current) { gesture.current = null; onLayout({}, true); /* persist once */ }
    };

    return (
        <div
            ref={ref}
            data-testid={'bw-ctl-widget-' + widget.name}
            onPointerDown={beginDrag}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            style={{
                position: 'absolute',
                left: L.x || 0,
                top: L.y || 0,
                width: fitCanvas ? 'calc(100% - 16px)' : L.w || (machine ?
                    `min(440px, max(180px, calc(100% - ${(L.x || 0) + 8}px)))` : undefined),
                height: fitCanvas ? 'calc(100% - 16px)' : L.h || (machine ? MACHINE_WIDGET_HEIGHT : undefined),
                transform: L.rotation ? 'rotate(' + L.rotation + 'deg)' : undefined,
                transformOrigin: 'center center',
                outline: selected ? '2px solid #7C3AED' : 'none',
                outlineOffset: 2,
                borderRadius: 8,
                cursor: mode === 'edit' ? 'move' : 'default',
                touchAction: machine && mode === 'play' ? 'auto' : 'none',
                userSelect: 'none',
            }}
        >
            <div
                ref={contentRef}
                style={{
                    display: 'inline-block', width: machine ? '100%' : undefined, height: machine ? '100%' : undefined,
                    transformOrigin: 'top left',
                    transform: (sx !== 1 || sy !== 1) ? ('scale(' + sx + ', ' + sy + ')') : undefined,
                }}
            >
                {children}
            </div>
            {mode === 'edit' && selected && (
                <React.Fragment>
                    <div
                        data-testid={'bw-ctl-resize-' + widget.name}
                        onPointerDown={beginResize}
                        onPointerMove={move}
                        onPointerUp={end}
                        style={{
                            position: 'absolute', right: -7, bottom: -7, width: 14, height: 14,
                            background: '#7C3AED', borderRadius: 3, cursor: 'nwse-resize',
                            border: '2px solid #fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                        }}
                    />
                    <div
                        data-testid={'bw-ctl-rotate-' + widget.name}
                        onPointerDown={beginRotate}
                        onPointerMove={move}
                        onPointerUp={end}
                        style={{
                            position: 'absolute', left: '50%', top: -22, marginLeft: -7,
                            width: 14, height: 14, background: '#fff',
                            border: '2px solid #7C3AED', borderRadius: '50%', cursor: 'grab',
                        }}
                    />
                </React.Fragment>
            )}
        </div>
    );
}

// ─── Widget inspector (edit mode, selected widget) ─────────────────────────
// Name (stable/unique — the engine refuses collisions and the binding rides
// the widget object), label, colour, numeric layout entry, and the
// decoration configs (text content / image source).

function WidgetInspector({ widget, onRename, onLayout, onConfig, onBind, onOpenLibrary,
    variableNames = [], parts = [], onOk, onCancel }) {
    const L = widget.layout || {};
    const [name, setName] = React.useState(widget.name);
    React.useEffect(() => { setName(widget.name); }, [widget.name]);
    const commitName = () => { if (name !== widget.name && !onRename(name)) setName(widget.name); };
    const row = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 };
    const lbl = { width: 52, color: '#64748b', flexShrink: 0 };
    const inp = { flex: 1, minWidth: 0, fontSize: 12, padding: '3px 6px',
        border: '1px solid #cbd5e1', borderRadius: 4 };
    const num = (key, val, extra) => (
        <input type="number" value={val ?? ''} placeholder="auto"
            data-testid={'bw-ctl-insp-' + key}
            onChange={e => onLayout({ [key]: e.target.value === '' ? undefined : Number(e.target.value) })}
            style={{ ...inp, width: 54, flex: 'none' }} {...(extra || {})} />
    );
    return (
        <div data-testid="bw-ctl-inspector"
            style={{
                position: 'absolute', top: 12, right: 12, width: 210,
                background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: 10,
                display: 'flex', flexDirection: 'column', gap: 8, zIndex: 50,
            }}
            onPointerDown={e => e.stopPropagation()}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: '#7C3AED',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {widget.type} · {widget.name}
                </div>
                {/* ✓ accepts (edits apply live, so accept = close); ✕ reverts
                    every edit since the inspector opened, via the parent's
                    snapshot (owner request: the dialog needs OK/Cancel). */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button onClick={onOk} title="OK" data-testid="bw-ctl-insp-ok"
                        style={{ width: 24, height: 24, padding: 0, cursor: 'pointer',
                            background: '#dcfce7', color: '#15803d', fontWeight: 700,
                            border: '1px solid #86efac', borderRadius: 4 }}>✓</button>
                    <button onClick={onCancel} title={t('cancel')} data-testid="bw-ctl-insp-cancel"
                        style={{ width: 24, height: 24, padding: 0, cursor: 'pointer',
                            background: '#fee2e2', color: '#dc2626', fontWeight: 700,
                            border: '1px solid #fca5a5', borderRadius: 4 }}>✕</button>
                </div>
            </div>
            <div style={row}>
                <span style={lbl}>name</span>
                <input value={name} data-testid="bw-ctl-insp-name" style={inp}
                    onChange={e => setName(e.target.value)}
                    onBlur={commitName}
                    onKeyDown={e => { if (e.key === 'Enter') commitName(); }} />
            </div>
            <div style={row}>
                <span style={lbl}>label</span>
                <input value={L.label || ''} data-testid="bw-ctl-insp-label" style={inp}
                    onChange={e => onLayout({ label: e.target.value || undefined })} />
            </div>
            <div style={row}>
                <span style={lbl}>colour</span>
                <input type="color" value={L.color || '#7C3AED'} data-testid="bw-ctl-insp-color"
                    onChange={e => onLayout({ color: e.target.value })}
                    style={{ width: 40, height: 24, padding: 0, border: '1px solid #cbd5e1', borderRadius: 4 }} />
            </div>
            <div style={row}>
                <span style={lbl}>x / y</span>
                {num('x', L.x)}{num('y', L.y)}
            </div>
            <div style={row}>
                <span style={lbl}>w / h</span>
                {num('w', L.w)}{num('h', L.h)}
            </div>
            <div style={row}>
                <span style={lbl}>rotate</span>
                {num('rotation', L.rotation, { step: 15 })}
                <span style={{ color: '#94a3b8' }}>deg</span>
            </div>
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 6, marginTop: 2 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                    Style
                </div>
                <div style={row}>
                    <span style={lbl}>bg</span>
                    <input type="color" value={L.backgroundColor || '#ffffff'}
                        data-testid="bw-ctl-insp-bgcolor"
                        onChange={e => onLayout({ backgroundColor: e.target.value === '#ffffff' ? undefined : e.target.value })}
                        style={{ width: 40, height: 24, padding: 0, border: '1px solid #cbd5e1', borderRadius: 4 }} />
                </div>
                {[
                    ['compact', t('compact')],
                    ['borderless', 'No border'],
                    ['hideLabel', 'Hide label'],
                    ['hideValue', 'Hide value'],
                    ['hideText', 'Hide text'],
                    ['hideMaxOut', 'Hide range'],
                ].map(([key, label]) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6,
                        fontSize: 12, cursor: 'pointer', padding: '1px 0' }}>
                        <input type="checkbox" checked={!!L[key]}
                            data-testid={'bw-ctl-insp-' + key}
                            onChange={e => onLayout({ [key]: e.target.checked || undefined })} />
                        {label}
                    </label>
                ))}
            </div>
            {/* Functional config: what the widget IS, as against where it
                sits and how it is painted. A button's toggle contract, a
                slider's range, a matrix's shape. */}
            {(CONFIG_FIELDS[widget.type] || []).length > 0 && (
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 6, marginTop: 2 }}
                    data-testid="bw-ctl-insp-config">
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                        {t('config')}
                    </div>
                    {CONFIG_FIELDS[widget.type].map(f => (
                        <div key={f.key} style={row}>
                            <span style={lbl}>{f.label}</span>
                            {f.kind === 'bool' && (
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6,
                                    fontSize: 12, cursor: 'pointer', flex: 1 }}>
                                    <input type="checkbox" checked={!!widget.config[f.key]}
                                        data-testid={'bw-ctl-insp-cfg-' + f.key}
                                        onChange={e => onConfig({ [f.key]: e.target.checked })} />
                                    {f.key === 'toggle' ? t('toggleHint') : ''}
                                </label>
                            )}
                            {f.kind === 'num' && (
                                <input type="number" value={widget.config[f.key] ?? ''}
                                    min={f.min} max={f.max}
                                    data-testid={'bw-ctl-insp-cfg-' + f.key}
                                    onChange={e => {
                                        const n = Number(e.target.value);
                                        if (e.target.value === '' || !Number.isFinite(n)) return;
                                        // Clamp to the model's own limits rather than
                                        // letting a typo through: a matrix wider than
                                        // 32 cells loses bits to int coercion, and a
                                        // zero-row display renders nothing at all.
                                        const lo = f.min ?? -Infinity;
                                        const hi = f.max ?? Infinity;
                                        onConfig({ [f.key]: Math.max(lo, Math.min(hi, n)) });
                                    }}
                                    style={{ ...inp, width: 70, flex: 'none' }} />
                            )}
                            {f.kind === 'text' && (
                                <input value={widget.config[f.key] ?? ''} style={inp}
                                    data-testid={'bw-ctl-insp-cfg-' + f.key}
                                    onChange={e => onConfig({ [f.key]: e.target.value })} />
                            )}
                            {f.kind === 'color' && (
                                <input type="color" value={widget.config[f.key] || '#334155'}
                                    data-testid={'bw-ctl-insp-cfg-' + f.key}
                                    onChange={e => onConfig({ [f.key]: e.target.value })}
                                    style={{ width: 40, height: 24, padding: 0,
                                        border: '1px solid #cbd5e1', borderRadius: 4 }} />
                            )}
                            {f.kind === 'choice' && (
                                <select value={widget.config[f.key] ?? f.choices[0]} style={inp}
                                    data-testid={'bw-ctl-insp-cfg-' + f.key}
                                    onChange={e => onConfig({ [f.key]: e.target.value })}>
                                    {f.choices.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            )}
                        </div>
                    ))}
                </div>
            )}
            {/* Binding: WHO this widget talks to. The panel model has had
                bindToVariable / bindToPart / bindToPin since it was written
                and the GUI called none of them — the only binding call in the
                app was bindToProgram, inside "+ Add Widget". So removing a
                widget and adding it back silently converted a variable
                binding into a program binding, and only reloading the example
                put it back (docs/LESSON-REVIEW-WAVE-4.md defect 6). */}
            {!DECORATION_NAMES.has(widget.type) && widget.type !== 'machine' && (
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 6, marginTop: 2 }}
                    data-testid="bw-ctl-insp-binding">
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                        {t('binding')}
                    </div>
                    <div style={row}>
                        <span style={lbl}>{t('bindTo')}</span>
                        <select value={widget.binding ? widget.binding.target : 'none'} style={inp}
                            data-testid="bw-ctl-insp-bind-target"
                            onChange={e => onBind(e.target.value, '')}>
                            {BIND_TARGETS.map(target => (
                                <option key={target} value={target}>{t('bind_' + target)}</option>
                            ))}
                        </select>
                    </div>
                    {widget.binding && widget.binding.target === 'variable' && (
                        <div style={row}>
                            <span style={lbl}>{t('variable')}</span>
                            <input list="bw-ctl-varlist" style={inp}
                                value={widget.binding.variableName || ''}
                                data-testid="bw-ctl-insp-bind-variable"
                                onChange={e => onBind('variable', e.target.value)} />
                            <datalist id="bw-ctl-varlist">
                                {variableNames.map(n => <option key={n} value={n} />)}
                            </datalist>
                        </div>
                    )}
                    {widget.binding && widget.binding.target === 'part' && (
                        <React.Fragment>
                            <div style={row}>
                                <span style={lbl}>{t('part')}</span>
                                <select value={widget.binding.partId || ''} style={inp}
                                    data-testid="bw-ctl-insp-bind-part"
                                    onChange={e => onBind('part', e.target.value, widget.binding.param)}>
                                    <option value="">—</option>
                                    {widget.binding.partId && !parts.some(part => part.id === widget.binding.partId) &&
                                        <option value={widget.binding.partId}>{widget.binding.partId}</option>}
                                    {parts.map(part => <option key={part.id} value={part.id}>
                                        {part.id} · {part.kind}
                                    </option>)}
                                </select>
                            </div>
                            <div style={row}>
                                <span style={lbl}>{t('param')}</span>
                                <input value={widget.binding.param || ''} style={inp}
                                    placeholder="x / y"
                                    data-testid="bw-ctl-insp-bind-param"
                                    onChange={e => onBind('part', widget.binding.partId || '', e.target.value)} />
                            </div>
                        </React.Fragment>
                    )}
                    {widget.binding && widget.binding.target === 'pin' && (
                        <div style={row}>
                            <span style={lbl}>{t('pin')}</span>
                            <input value={widget.binding.pinName || ''} style={inp}
                                placeholder={t('pinPlaceholder')}
                                data-testid="bw-ctl-insp-bind-pin"
                                onChange={e => onBind('pin', e.target.value)} />
                        </div>
                    )}
                </div>
            )}
            {widget.type === 'image' && (
                <div style={{ display: 'flex', gap: 6 }}>
                    <button data-testid="bw-ctl-insp-library" onClick={onOpenLibrary}
                        style={{ flex: 1, fontSize: 12, padding: '4px 8px', borderRadius: 4,
                            border: '1px solid #7C3AED', background: '#faf5ff', color: '#7C3AED',
                            cursor: 'pointer', fontWeight: 600 }}>
                        Library…
                    </button>
                    <label style={{ flex: 1, fontSize: 12, padding: '4px 8px', borderRadius: 4,
                        border: '1px solid #cbd5e1', background: '#f8fafc', color: '#334155',
                        cursor: 'pointer', fontWeight: 600, textAlign: 'center' }}>
                        Upload…
                        <input type="file" accept="image/*" data-testid="bw-ctl-insp-upload"
                            style={{ display: 'none' }}
                            onChange={e => {
                                const f = e.target.files && e.target.files[0];
                                if (!f) return;
                                const r = new FileReader();
                                r.onload = () => onConfig({ src: String(r.result), alt: f.name });
                                r.readAsDataURL(f);
                            }} />
                    </label>
                </div>
            )}
        </div>
    );
}

// ─── Scratch-library image picker (reuses the costume library UI) ──────────
// Lazy: the library component + costume catalogue only load when opened.

const LazyLibrary = React.lazy(() => Promise.all([
    import(/* webpackChunkName: "bw-ctl-library" */ '../library/library.jsx'),
    import(/* webpackChunkName: "bw-ctl-library" */ '../../lib/libraries/costumes.json'),
]).then(([lib, data]) => ({
    default: function CostumePicker({ onSelect, onClose }) {
        const LibraryComponent = lib.default;
        return (
            <LibraryComponent
                data={data.default}
                id="bwControllerImageLibrary"
                title={t('chooseImage')}
                onItemSelected={onSelect}
                onRequestClose={onClose}
            />
        );
    },
})));

function ScratchImagePicker({ vm, onSelect, onClose }) {
    return (
        <React.Suspense fallback={null}>
            <LazyLibrary onSelect={onSelect} onClose={onClose} />
        </React.Suspense>
    );
}

// ─── Decoration faces ──────────────────────────────────────────────────────

function TextWidget({ widget }) {
    return (
        <div data-testid={'bw-ctl-text-' + widget.name}
            style={{
                fontSize: widget.config.fontSize || 16,
                color: widget.config.color || '#334155',
                fontWeight: 600, whiteSpace: 'pre-wrap', padding: 4,
            }}>
            {widget.config.text}
        </div>
    );
}

function ImageWidget({ widget }) {
    return widget.config.src ? (
        <img data-testid={'bw-ctl-image-' + widget.name}
            src={widget.config.src} alt={widget.config.alt || ''}
            draggable={false}
            style={{ maxWidth: '100%', maxHeight: '100%', display: 'block', pointerEvents: 'none' }} />
    ) : (
        <div data-testid={'bw-ctl-image-' + widget.name}
            style={{ width: 96, height: 72, display: 'flex', alignItems: 'center',
                justifyContent: 'center', background: '#f1f5f9', color: '#94a3b8',
                borderRadius: 6, fontSize: 24 }}>
            {'\u{1F5BC}️'}
        </div>
    );
}

function MonitorConsole({route, interactive, locale}) {
    const output = useRef(null);
    const [line, setLine] = React.useState('');
    useEffect(() => {
        output.current.scrollTop = output.current.scrollHeight;
    }, [route.text]);
    return <div data-6502-monitor-serial={route.source} style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: 8,
        background: '#0d1117', color: '#9ae6b4', font: '12px monospace', userSelect: 'text'
    }}>
        <span title={t('virtualSerial', locale)}>{route.source}</span>
        <pre ref={output} style={{flex: 1, minHeight: 0, margin: '4px 0', overflow: 'auto',
            whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'}}>{route.text}</pre>
        {interactive && <form style={{display: 'flex', gap: 4}} onSubmit={event => {
            event.preventDefault();
            event.stopPropagation();
            if (sendConsoleLine(route.runner, line)) setLine('');
        }}>
            <input aria-label={t('consoleInput', locale)} value={line} onChange={event => setLine(event.target.value)}
                autoCapitalize="off" autoComplete="off" spellCheck={false}
                style={{flex: 1, minWidth: 0, font: 'inherit'}} />
            <button type="submit" aria-label={t('sendLine', locale)} title={t('sendLine', locale)}>↵</button>
        </form>}
    </div>;
}

function useMonitorConsole(runtime, name) {
    const [route, setRoute] = React.useState(null);
    useEffect(() => {
        if (!runtime || !name) return;
        const update = () => {
            const current = runtime.bw6502Console;
            setRoute(current?.destination === name ? current : null);
        };
        runtime.on(CONSOLE_6502_CHANGED, update);
        update();
        return () => runtime.removeListener(CONSOLE_6502_CHANGED, update);
    }, [runtime, name]);
    return route;
}

function SimpleVgaWidget({widget, route, interactive, locale}) {
    const ref = useRef(null);
    useEffect(() => {
        const canvas = ref.current;
        const rgba = widget.state.rgba;
        if (!canvas || !rgba) return;
        const width = widget.config.width;
        const height = widget.config.height;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
    }, [widget.state.rgba, widget.state.frame, widget.config.width, widget.config.height]);
    return (
        <div data-testid={'bw-ctl-simplevga-' + widget.name}
            data-video-size={widget.state.signal ? `${widget.config.width}×${widget.config.height}` : undefined}
            style={{position: 'relative', background: '#000', borderRadius: 2, overflow: 'hidden'}}>
            <canvas ref={ref} style={{display: 'block', width: '100%', height: '100%', objectFit: 'contain',
                aspectRatio: `${widget.config.width} / ${widget.config.height}`, imageRendering: 'pixelated'}} />
            {route ? <MonitorConsole route={route} interactive={interactive} locale={locale} /> :
                !widget.state.signal && <span style={{position: 'absolute', inset: 0, display: 'grid',
                placeItems: 'center', color: '#0f0', fontSize: 10, fontFamily: 'monospace'}}>NO SIGNAL</span>}
        </div>
    );
}

// ─── Widget card (edit mode wrapper) ──────────────────────────────────────

function WidgetButton({widget, mode, inputs}) {
    const name = widget.name;
    React.useEffect(() => () => inputs?.release(name), [inputs, name]);
    const releasePointer = event => inputs?.release(name, `pointer:${event.pointerId}`);
    return <button disabled={mode !== 'play'} data-testid={`bw-ctl-button-${name}`}
        aria-label={`${name}: ${widget.config.label || 'Button'}`}
        aria-pressed={!!widget.state.pressed}
        title={widget.config.key ? `${t('keyboardKey')}: ${widget.config.key}` : undefined}
        onPointerDown={event => {
            if (event.button !== 0) return;
            event.stopPropagation();
            inputs?.press(name, `pointer:${event.pointerId}`);
            event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerUp={releasePointer} onPointerCancel={releasePointer}
        onLostPointerCapture={releasePointer}
        onPointerLeave={event => {
            if (!event.currentTarget.hasPointerCapture?.(event.pointerId)) releasePointer(event);
        }}
        onKeyDown={event => {
            if (![' ', 'Enter'].includes(event.key)) return;
            event.preventDefault();
            if (!event.repeat) inputs?.press(name, `focus:${event.key}`);
        }}
        onKeyUp={event => {
            if (![' ', 'Enter'].includes(event.key)) return;
            event.preventDefault();
            inputs?.release(name, `focus:${event.key}`);
        }}
        onBlur={() => { inputs?.release(name, 'focus: '); inputs?.release(name, 'focus:Enter'); }}
        style={{width: 56, height: 56, borderRadius: '50%', touchAction: 'none',
            border: '2px solid #4f46e5', background: widget.state.pressed ? '#7C3AED' : '#e2e8f0',
            color: widget.state.pressed ? '#fff' : '#334155', fontWeight: 700, fontSize: 14,
            cursor: mode === 'play' ? 'pointer' : 'default'}}>
        {widget.config.label || (widget.config.toggle ? (widget.state.pressed ? 'ON' : 'OFF') : '●')}
    </button>;
}

function RemoveWidgetButton({name, onRemove}) {
    // Keep pointer capture on the draggable widget from swallowing the click.
    return (
        <button
            onClick={onRemove}
            onPointerDown={e => e.stopPropagation()}
            data-testid={'bw-ctl-remove-' + name}
            title={t('remove')}
            aria-label={t('remove')}
            style={{
                position: 'absolute', top: 2, right: 2, zIndex: 20,
                width: 18, height: 18, lineHeight: '16px', padding: 0,
                background: '#fee2e2', color: '#dc2626',
                border: '1px solid #fca5a5', borderRadius: 4,
                cursor: 'pointer', fontSize: 12, fontWeight: 700,
            }}
        >
            ×
        </button>
    );
}

function SerialKeyboard({name, sendLine, label, placeholder}) {
    const input = useRef(null);
    return <form onSubmit={event => {
        event.preventDefault();
        if (sendLine(input.current.value) === true) input.current.value = '';
    }} style={{display: 'flex', gap: 4, width: '100%'}}>
        <input ref={input} aria-label={label} data-testid={'bw-ctl-keyboard-' + name}
            placeholder={placeholder} autoCapitalize="off" autoComplete="off" spellCheck={false}
            style={{minWidth: 0, flex: 1, fontFamily: 'monospace', padding: 4}} />
        <button type="submit" aria-label={label} title={label}>⏎</button>
    </form>;
}

function WidgetCard({ widget, mode, panel, onInput, onRemove, onBindPart, hideBindings, buttonInputs, sendBasicLine, runtime, videoKind, locale }) {
    const serialRoute = useMonitorConsole(runtime, isConsoleMonitor(widget) ? widget.name : null);
    const displayLabel = {tms9918: 'TMS9918', mc6845: 'MC6845'}[videoKind] || 'VGA';
    const typeLabels = {
        joystick: t('joystick'), button: t('button'), slider: t('slider'),
        dpad: t('dpad'), dial: t('dial'), gauge: 'Gauge', matrix: 'Matrix', sevenseg: '7-Seg',
        keypad: 'Keypad', lcd: 'LCD', oled: 'OLED', terminal: 'Terminal',
        text: 'Text', image: 'Image',
        keyboard: 'Keyboard', bargraph: 'Bar Graph', simplevga: serialRoute ? 'Serial' : displayLabel,
        mono_lcd: 'Mono LCD', rgb_light: 'RGB Light',
    };
    const bindingLabel = widget.binding
        ? (widget.binding.target === 'part'
            ? `→ ${widget.binding.partId}${widget.binding.param ? '.' + widget.binding.param : ''}`
            : t('bindProgram'))
        : '—';

    // layout.color tints the whole card — a 2px coloured border and a faint
    // wash (the 6-digit hex from the colour input + '22' alpha ≈ 13%) — not
    // just the type badge, so "colour" reads as the widget's colour.
    const cardColor = widget.layout && widget.layout.color;
    const L = widget.layout || {};
    return (
        <div style={{
            background: L.backgroundColor || (cardColor ? (cardColor + '22') : '#fff'),
            border: L.borderless ? 'none' : ('2px solid ' + (cardColor || '#e2e8f0')),
            borderRadius: L.borderless ? 0 : 8,
            padding: L.compact ? 4 : 12,
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            position: 'relative',
            minWidth: L.compact ? 0 : 130,
        }}>
            {!L.hideLabel && (
                <div style={{
                    fontWeight: 600, fontSize: 13, color: '#334155',
                    display: 'flex', alignItems: 'center', gap: 6
                }}>
                    {!L.compact && <span style={{
                        background: cardColor || '#7C3AED',
                        color: '#fff', borderRadius: 4,
                        padding: '1px 6px', fontSize: 10, textTransform: 'uppercase'
                    }}>
                        {typeLabels[widget.type] || widget.type}
                    </span>}
                    <span data-testid={'bw-ctl-title-' + widget.name}>
                        {serialRoute ? 'Console' : sendBasicLine ? 'ACIA keyboard' : (L.label || widget.name)}
                    </span>
                </div>
            )}

            {widget.type === 'joystick' && (
                <JoystickWidget
                    widget={widget}
                    name={widget.name}
                    mode={mode}
                    onInput={onInput}
                />
            )}

            {widget.type === 'dpad' && (
                <DpadWidget
                    widget={widget}
                    name={widget.name}
                    mode={mode}
                    panel={panel}
                />
            )}

            {widget.type === 'slider' && (
                <div style={{ width: L.compact ? 56 : '100%', padding: '0 4px' }}>
                    <input
                        type="range"
                        aria-label={widget.name}
                        min={widget.config.min}
                        max={widget.config.max}
                        step={widget.config.step}
                        value={widget.state.value}
                        disabled={mode !== 'play'}
                        onChange={e => {
                            panel.setSliderInput(widget.name, Number(e.target.value));
                        }}
                        style={{ width: '100%' }}
                    />
                    <div style={{ textAlign: 'center', fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
                        {widget.state.value}
                    </div>
                </div>
            )}

            {widget.type === 'button' && <WidgetButton widget={widget} mode={mode} inputs={buttonInputs} />}

            {widget.type === 'dial' && (
                <div style={{ width: '100%', padding: '0 4px' }}>
                    <input
                        type="range"
                        min={widget.config.min}
                        max={widget.config.max}
                        value={widget.state.value}
                        disabled={mode !== 'play'}
                        onChange={e => panel.setSliderInput(widget.name, Number(e.target.value))}
                        style={{ width: '100%' }}
                    />
                    <div style={{ textAlign: 'center', fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
                        {widget.state.value}°
                    </div>
                </div>
            )}

            {widget.type === 'matrix' && (
                <MatrixWidget widget={widget} />
            )}

            {widget.type === 'sevenseg' && (
                <SevenSegWidget widget={widget} />
            )}

            {widget.type === 'keypad' && (
                <KeypadWidget widget={widget} mode={mode} panel={panel} />
            )}

            {widget.type === 'lcd' && (
                <LcdWidget widget={widget} />
            )}

            {widget.type === 'terminal' && (
                <React.Fragment>
                    <TerminalWidget widget={widget} text={serialRoute?.text ?? widget.state.text} />
                    {mode === 'play' && serialRoute && <SerialKeyboard name={widget.name}
                        label={serialRoute.source}
                        sendLine={line => sendConsoleLine(serialRoute.runner, line)} />}
                </React.Fragment>
            )}

            {widget.type === 'oled' && (
                <OledWidget widget={widget} />
            )}

            {widget.type === 'text' && (
                <TextWidget widget={widget} />
            )}

            {widget.type === 'image' && (
                <ImageWidget widget={widget} />
            )}

            {widget.type === 'gauge' && (
                <div data-testid={'bw-ctl-gauge-' + widget.name}
                    style={{ width: '100%', textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'monospace', color: '#334155' }}>
                        {!L.hideValue && (widget.state.value ?? 0)}
                    </div>
                    {!L.hideMaxOut && (
                        <div style={{ fontSize: 10, color: '#94a3b8' }}>
                            {widget.config.min}..{widget.config.max} {widget.config.label}
                        </div>
                    )}
                </div>
            )}

            {widget.type === 'keyboard' && (sendBasicLine ?
                <SerialKeyboard name={widget.name} sendLine={sendBasicLine} placeholder={BASIC_INPUT_EXAMPLE}
                    label={/^de/i.test(navigator.language) ? 'BASIC-Serieneingabe' : 'BASIC serial input'} /> :
                <input type="text" data-testid={'bw-ctl-keyboard-' + widget.name}
                    disabled={mode !== 'play'}
                    placeholder={mode === 'play' ? 'Type here...' : 'Keyboard'}
                    onKeyDown={e => {
                        e.preventDefault();
                        if (e.key.length === 1) panel.pushKeyboardKey(widget.name, e.key.charCodeAt(0));
                        else if (e.key === 'Enter') panel.pushKeyboardKey(widget.name, 13);
                        else if (e.key === 'Backspace') panel.pushKeyboardKey(widget.name, 8);
                        else if (e.key === 'Escape') panel.pushKeyboardKey(widget.name, 27);
                        else if (e.key === 'Tab') panel.pushKeyboardKey(widget.name, 9);
                    }}
                    style={{ width: '100%', fontSize: 14, fontFamily: 'monospace',
                        padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: 4,
                        background: mode === 'play' ? '#f0fdf4' : '#f8fafc' }}
                />
            )}

            {widget.type === 'bargraph' && (
                <div data-testid={'bw-ctl-bargraph-' + widget.name}
                    style={{ width: '100%' }}>
                    <div style={{ width: '100%', height: 20, background: '#1e293b',
                        borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                            width: Math.max(0, Math.min(100,
                                ((widget.state.value - widget.config.min) /
                                 (widget.config.max - widget.config.min)) * 100)) + '%',
                            height: '100%',
                            background: cardColor || '#4ade80',
                            transition: 'width 0.15s',
                        }} />
                    </div>
                    {!L.hideValue && (
                        <div style={{ textAlign: 'center', fontSize: 11, color: '#64748b',
                            fontFamily: 'monospace', marginTop: 2 }}>
                            {widget.state.value} {widget.config.label}
                        </div>
                    )}
                </div>
            )}

            {widget.type === 'simplevga' && (
                <SimpleVgaWidget locale={locale} widget={widget} route={serialRoute} interactive={mode === 'play'} />
            )}

            {widget.type === 'mono_lcd' && (
                <div data-testid={'bw-ctl-mono_lcd-' + widget.name}
                    style={{ width: '100%', minHeight: 36, background: '#c5cba3',
                        color: '#222', fontFamily: 'monospace', fontSize: 11,
                        padding: 4, borderRadius: 2, whiteSpace: 'pre-wrap',
                        border: '1px solid #aab07a' }}>
                    {widget.state.text || ('LCD ' + widget.config.width + '\u00d7' + widget.config.height)}
                </div>
            )}

            {widget.type === 'rgb_light' && (
                <div data-testid={'bw-ctl-rgb_light-' + widget.name}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{
                        width: 44, height: 44, borderRadius: '50%',
                        background: '#' + ((widget.state.value || 0) & 0xFFFFFF).toString(16).padStart(6, '0'),
                        border: '2px solid #555',
                        boxShadow: widget.state.value
                            ? ('0 0 12px #' + ((widget.state.value || 0) & 0xFFFFFF).toString(16).padStart(6, '0'))
                            : 'none',
                    }} />
                    {!L.hideValue && (
                        <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>
                            #{((widget.state.value || 0) & 0xFFFFFF).toString(16).padStart(6, '0')}
                        </span>
                    )}
                </div>
            )}

            {mode === 'edit' && <RemoveWidgetButton name={widget.name} onRemove={onRemove} />}

            {/* Hidden by the panel-level hideBindings flag, which lives in
                bw-board's ControllerPanel because the serialised shape is that
                project's. It arrived with the pin bump this commit performs; the
                control was deliberately unwired until then, since a checkbox
                calling a method the vendored copy did not have would have been a
                control that throws when pressed. */}
            {!hideBindings && (!serialRoute || mode === 'edit') && (
                <div data-testid={'bw-ctl-binding-' + widget.name}
                    style={{ fontSize: 10, color: '#94a3b8' }}>
                    {bindingLabel}
                </div>
            )}
        </div>
    );
}

// ─── Main panel view ──────────────────────────────────────────────────────

class ControllerPanelView extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            addMenuOpen: false,
            revision: 0,    // bump to force re-render on panel events
            selected: null, // widget name selected in EDIT mode (inspector)
            snap: true,     // grid snapping for move/resize
            grid: 8,        // snap step in px
            libraryOpen: false, // the image widget's Scratch-library picker
        };
        this._onPanelEvent = this._onPanelEvent.bind(this);
        this._binding = null;
        this._undoStack = [];
        this._redoStack = [];
        this._undoLabels = [];
        this._redoLabels = [];
        this._layoutSnapshot = null;
    }

    componentDidMount() {
        const panel = this._getPanel();
        panel.addListener(this._onPanelEvent);
        this._buttonInputs = createWidgetButtonInputs(panel);
        this._onProgramStop = () => {
            this._buttonInputs.releaseAll();
            releaseMomentaryButtons(panel);
        };
        this.props.vm?.runtime?.on?.('PROJECT_STOP_ALL', this._onProgramStop);
        this.setState(s => ({revision: s.revision + 1}));
        // Expose panel on runtime for the extension to find
        this._exposeOnRuntime(panel);
        // If entering in play mode and board exists, bind
        if (panel.mode === 'play' && this.props.board) {
            this._bindToBoard(panel);
        }
        this._unregisterUndo = registerUndoSurface('widgets', {
            label: 'Widgets',
            canUndo: () => this._undoStack.length > 0,
            canRedo: () => this._redoStack.length > 0,
            depth: () => ({undo: this._undoStack.length, redo: this._redoStack.length}),
            steps: () => ({past: this._undoLabels.slice(), future: this._redoLabels.slice().reverse()}),
            undo: () => this._undo(),
            redo: () => this._redo()
        });
    }

    componentWillUnmount() {
        const panel = this._getPanel();
        panel.removeListener(this._onPanelEvent);
        this._buttonInputs?.dispose();
        // A host-owned runtime keeps program-held inputs when only this pane
        // closes. Standalone views own their board lifetime and release it.
        if (this.props.manageBoardBinding !== false) releaseMomentaryButtons(panel);
        this.props.vm?.runtime?.removeListener?.('PROJECT_STOP_ALL', this._onProgramStop);
        if (this._unregisterUndo) this._unregisterUndo();
        this._unbind();
    }

    componentDidUpdate(prevProps) {
        if (prevProps.machineTerminal !== this.props.machineTerminal && this.props.machineTerminal?.focusOnOpen) {
            this.setState({machineSurface: 'terminal'});
        }
        if (prevProps.board !== this.props.board) {
            const panel = this._getPanel();
            this._buttonInputs?.releaseAll();
            releaseMomentaryButtons(panel);
            this._unbind();
            if (panel.mode === 'play' && this.props.board) {
                this._bindToBoard(panel);
            }
        }
    }

    _getPanel() {
        return this.props.panel;
    }

    _exposeOnRuntime(panel) {
        // Make the panel accessible to the ControllerExtension via vm.runtime.controllerPanel
        if (this.props.vm && this.props.vm.runtime) {
            this.props.vm.runtime.controllerPanel = panel;
        }
    }

    _onPanelEvent(kind, detail) {
        this.setState(s => ({ revision: s.revision + 1 }));
        if (kind === 'mode') {
            const panel = this._getPanel();
            if (panel.mode === 'play') this._bindToBoard(panel);
            else {
                this._buttonInputs?.releaseAll();
                releaseMomentaryButtons(panel);
                this._unbind();
            }
        }
        if (kind === 'input' && ['slider', 'dial'].includes(this._getPanel().getWidget(detail.name)?.type)) {
            this._persist();
        }
        notifyUndoState();
    }

    _snapshot() {
        return JSON.parse(JSON.stringify(serializeControllerPanel(this._getPanel())));
    }

    _recordUndo(snapshot, label = 'Change') {
        this._undoStack.push(snapshot || this._snapshot());
        this._undoLabels.push(label);
        if (this._undoStack.length > 100) {
            this._undoStack.shift();
            this._undoLabels.shift();
        }
        this._redoStack = [];
        this._redoLabels = [];
        notifyUndoState();
    }

    _restoreSnapshot(snapshot) {
        const panel = this._getPanel();
        clearControllerPanel(panel);
        for (const widget of snapshot.widgets || []) {
            const added = panel.addWidget(widget.name, widget.type,
                widget.config || {}, widget.layout || {});
            if (widget.binding) added.binding = JSON.parse(JSON.stringify(widget.binding));
        }
        if (typeof panel.setHideBindings === 'function') panel.setHideBindings(!!snapshot.hideBindings);
        if (snapshot.mode) panel.setMode(snapshot.mode);
        this._persist();
        this.setState(s => ({selected: null, revision: s.revision + 1}));
    }

    _undo() {
        if (!this._undoStack.length) return false;
        this._redoStack.push(this._snapshot());
        this._redoLabels.push(this._undoLabels.pop());
        this._restoreSnapshot(this._undoStack.pop());
        notifyUndoState();
        return true;
    }

    _redo() {
        if (!this._redoStack.length) return false;
        this._undoStack.push(this._snapshot());
        this._undoLabels.push(this._redoLabels.pop());
        this._restoreSnapshot(this._redoStack.pop());
        notifyUndoState();
        return true;
    }

    _bindToBoard(panel) {
        this._unbind();
        if (this.props.board && this.props.manageBoardBinding !== false) {
            this._binding = bindPanelToBoard(panel, this.props.board);
            this._binding.sync();
        }
    }

    _unbind() {
        if (this._binding) {
            this._binding.dispose();
            this._binding = null;
        }
    }

    _setMode(mode) {
        const panel = this._getPanel();
        this._buttonInputs?.releaseAll();
        releaseMomentaryButtons(panel);
        panel.setMode(mode);
    }

    _addWidget(type) {
        const panel = this._getPanel();
        const before = this._snapshot();
        // Generate a unique name
        const existing = panel.getWidgetNames();
        const typeLabels = { joystick: 'joy', button: 'btn', slider: 'slider', dpad: 'dpad', dial: 'dial' };
        const prefix = typeLabels[type] || type;
        let idx = 1;
        while (existing.includes(`${prefix}${idx}`)) idx++;
        const name = `${prefix}${idx}`;
        panel.addWidget(name, type);
        // Default binding: program-facing
        panel.bindToProgram(name);
        this.setState({ addMenuOpen: false });
        // Persist immediately
        this._persist();
        this._recordUndo(before, 'Add widget');
    }

    _addMachineWidget(add) {
        const before = this._snapshot();
        add(this._getPanel());
        this.setState({addMenuOpen: false});
        this._persist();
        this._recordUndo(before, 'Add widget');
    }

    _removeWidget(name) {
        const before = this._snapshot();
        this._buttonInputs?.release(name);
        releaseMomentaryButtons(this._getPanel(), name);
        this._getPanel().removeWidget(name);
        this._persist();
        this._recordUndo(before, 'Remove widget');
    }

    _persist() {
        // Emit a persistence event so the host knows to save
        window.dispatchEvent(new CustomEvent('bw-controller-changed', {
            detail: { data: serializeControllerPanel(this._getPanel()) }
        }));
    }

    _handleJoystickInput(name, x, y) {
        this._getPanel().setJoystickInput(name, x, y);
    }

    _snap(v) {
        const g = this.state.grid || 8;
        return this.state.snap ? Math.round(v / g) * g : Math.round(v);
    }

    _layout(name, patch, persist) {
        if (!this._layoutSnapshot) this._layoutSnapshot = this._snapshot();
        this._getPanel().setWidgetLayout(name, patch);
        if (persist) {
            this._persist();
            this._recordUndo(this._layoutSnapshot, 'Move or resize widget');
            this._layoutSnapshot = null;
        }
    }

    _config(name, patch) {
        const before = this._snapshot();
        this._getPanel().setWidgetConfig(name, patch);
        this._persist();
        this._recordUndo(before, 'Change widget');
    }

    /**
     * Re-bind a widget. The one thing the app could not do.
     *
     * `bindToVariable`, `bindToPart` and `bindToPin` have existed on the panel
     * model since it was written and were called from nowhere in the GUI; the
     * only binding call the app made was `bindToProgram`, inside `_addWidget`.
     * So "remove a widget and add it back" silently turned a variable binding
     * into a program binding, and nothing short of reloading the example put it
     * back (docs/LESSON-REVIEW-WAVE-4.md defect 6).
     *
     * `value` is the identifier the chosen target needs — a variable name, a
     * part id, a pin name — and is allowed to be empty while the learner is
     * still typing it. An empty identifier is stored rather than refused,
     * because refusing it would make the field impossible to clear.
     */
    _bind(name, target, value, param) {
        const panel = this._getPanel();
        if (!name || !panel.getWidget(name)) return;
        const before = this._snapshot();
        switch (target) {
        case 'variable': panel.bindToVariable(name, String(value ?? '')); break;
        case 'part': panel.bindToPart(name, String(value ?? ''), param || null); break;
        case 'pin': panel.bindToPin(name, String(value ?? '')); break;
        case 'program': panel.bindToProgram(name); break;
        default: panel.unbind(name); break;
        }
        // A display bound to a new variable must show that variable's value,
        // not the last one's: the pump only writes on CHANGE, so without this
        // the face keeps the stale reading until the new variable happens to
        // move. The board binding is rebuilt for the same reason.
        if (panel.mode === 'play' && this.props.board) this._bindToBoard(panel);
        this._persist();
        this._recordUndo(before, 'Bind widget');
    }

    /** Stage variable names, for the binding field's suggestions. */
    _variableNames() {
        try {
            const stage = this.props.vm.runtime.getTargetForStage();
            return Object.values(stage.variables || {})
                .filter(v => v.type !== 'list')
                .map(v => v.name)
                .sort();
        } catch {
            return [];
        }
    }

    /** Board part ids, for the part binding's picker. */
    _circuitParts(widget) {
        const kinds = widget?.type === 'lcd' ? ['hd44780', 'char_lcd']
            : widget?.type === 'simplevga' ? ['simplevga_card', 'tms9918', 'mc6845'] : null;
        return [...(this.props.board?.parts || [])]
            .filter(part => !kinds || kinds.includes(part.kind))
            .sort((a, b) => a.id.localeCompare(b.id));
    }

    _rename(oldName, newName) {
        const before = this._snapshot();
        try {
            this._getPanel().renameWidget(oldName, newName);
            // Keep the inspector's revert snapshot attached across the
            // rename: the snapshot's job is "the widget as it was when the
            // inspector opened", and a rename is an edit, not a re-open.
            if (this._snapFor === oldName) this._snapFor = newName;
            this.setState({ selected: newName });
            this._persist();
            this._recordUndo(before, 'Rename widget');
            return true;
        } catch (e) {
            return false;   // collision/empty: the inspector keeps the old name
        }
    }

    /** Revert a widget to the snapshot taken when its inspector opened (✕). */
    _restoreWidget(currentName, snap) {
        const before = this._snapshot();
        try {
            const panel = this._getPanel();
            if (!snap || !panel.getWidget(currentName)) {
                this.setState({ selected: null });
                return;
            }
            if (currentName !== snap.name) {
                try { panel.renameWidget(currentName, snap.name); } catch (e) { /* collision: keep name */ }
            }
            const w = panel.getWidget(snap.name) || panel.getWidget(currentName);
            if (w) {
                w.config = JSON.parse(JSON.stringify(snap.config));
                w.layout = JSON.parse(JSON.stringify(snap.layout));
                w.binding = snap.binding ? JSON.parse(JSON.stringify(snap.binding)) : null;
            }
            this._persist();
            this._recordUndo(before, 'Restore widget');
        } catch (e) { /* a failed revert must still close the inspector */ }
        this._snapFor = null;
        this.setState(s => ({ selected: null, revision: s.revision + 1 }));
    }

    async _pickLibraryImage(item) {
        // A Scratch-library costume becomes the image widget's src as a
        // self-contained dataURL, so controller.json stays portable.
        const name = this.state.selected;
        this.setState({ libraryOpen: false });
        if (!name) return;
        try {
            const storage = this.props.vm.runtime.storage;
            const md5ext = item.md5ext || (item.costumes && item.costumes[0] && item.costumes[0].md5ext);
            const [md5, ext] = String(md5ext).split('.');
            const type = ext === 'svg' ? storage.AssetType.ImageVector : storage.AssetType.ImageBitmap;
            const asset = await storage.load(type, md5, ext);
            this._config(name, { src: asset.encodeDataURI(), alt: item.name || '' });
        } catch (e) {
            // the picker failing must not wedge the panel
        }
    }

    render() {
        const panel = this._getPanel();
        const mode = panel.mode;
        const widgets = panel.getWidgets();
        const {cp1WidgetSlot, cardiacWidgetSlot, aceKimMachine} = this.props;
        const logikusLabel = /^de/i.test(this.props.locale || '') ? 'Logikus-Labor' : 'Logikus Lab';
        const cardiacWidget = widgets.find(isCardiacFace);
        const kimParts = (this.props.board?.parts || []).filter(part => part.kind === 'kim-1');
        const german = /^de/i.test(this.props.locale || '');
        const sendLogikus = (type, detail) => window.dispatchEvent(new CustomEvent(`bw-logikus-${type}`, {detail}));
        const microtronicParts = (this.props.board?.parts || []).filter(part => part.kind === 'busch-microtronic');
        const machineChoices = [
            ...microtronicParts.map(part => ({
                label: microtronicParts.length > 1 ? `Busch Microtronic · ${part.id}` : 'Busch Microtronic',
                disabled: widgets.some(widget => isMicrotronicFace(widget) && widget.config.partId === part.id),
                run: () => this._addMachineWidget(target => addMicrotronicFace(target, part.id))
            })),
            ...kimParts.map(part => ({
                label: kimParts.length > 1 ? `KIM-1 · ${part.id}` : (german ? 'KIM-1-Frontplatte' : 'KIM-1 front panel'),
                disabled: widgets.some(widget => isKim1Face(widget) && widget.config.partId === part.id),
                run: () => this._addMachineWidget(panel => addKim1Face(panel, part.id))
            })),
            ...kimParts.filter(part => this.props.vm?.runtime?.circuitBoard?.getDeviceState?.(part.id)?.k1008)
                .map(part => ({
                    label: kimParts.length > 1 ? `K-1008 · ${part.id}` : 'K-1008',
                    disabled: widgets.some(widget => isKim1VideoFace(widget) && widget.config.partId === part.id),
                    run: () => this._addMachineWidget(panel => addKim1VideoFace(panel, part.id))
                })),
            aceKimMachine && {
                label: 'ACE KIM', disabled: widgets.some(isAceKimFace),
                run: () => this._addMachineWidget(addAceKimFace)
            },
            cardiacWidgetSlot && {
                label: german ? 'CARDIAC-Anzeige' : 'CARDIAC display', disabled: !!cardiacWidget,
                run: () => this._addMachineWidget(addCardiacFace)
            },
            {label: logikusLabel, run: () => {
                this.setState({addMenuOpen: false});
                sendLogikus('open');
            }},
            ...[
                [german ? 'Logikus-Schalter' : 'Logikus switch', LOGIKUS_SWITCH_WIDGETS],
                [german ? 'Logikus-Lampe' : 'Logikus lamp', LOGIKUS_LAMP_WIDGETS],
                ['Logikus Test', [LOGIKUS_TEST_WIDGET]]
            ].map(([label, names]) => {
                const name = names.find(candidate => !panel.getWidget(candidate));
                return {label, disabled: !name,
                    run: () => this._addMachineWidget(() => sendLogikus('add-control', {name}))};
            })
        ].filter(Boolean);
        const screen = mode === 'play' && this.props.machineConsole
            ? widgets.find(w => w.name === this.props.machineConsole.name && w.type === 'simplevga')
            : null;
        const session = mode === 'play' ? this.props.machineTerminal : null;
        const showTerminal = session && (screen ? this.state.machineSurface === 'terminal' :
            this.state.machineSurface !== 'widgets' || !widgets.length);
        const terminal = showTerminal ? session : null;
        const hasOtherWidgets = screen && widgets.some(widget => widget !== screen);
        const machineWidget = showTerminal || (hasOtherWidgets && this.state.machineSurface === 'widgets') ? null : screen;
        const machineFullScreen = Boolean((machineWidget || terminal) && this.props.isFullScreen);
        const aceFullScreen = this.props.isFullScreen && mode === 'play' &&
            !machineWidget && !terminal && aceKimMachine && widgets.length === 1 && isAceKimFace(widgets[0]);
        const toggleMachineFullScreen = this.props.isFullScreen ?
            this.props.onExitFullScreen : this.props.onEnterFullScreen;

        return (
            <div style={{
                position: 'absolute', inset: 0,
                background: '#f8fafc',
                display: 'flex', flexDirection: 'column',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                overflow: 'hidden',
                zIndex: 10,
            }} onPointerDown={() => activateUndoSurface('widgets')}>
                <div data-widgets-toolbar style={{
                    display: machineFullScreen || aceFullScreen ? 'none' : 'flex', alignItems: 'center', flexWrap: 'nowrap', gap: 3,
                    minWidth: 0, padding: '4px 6px',
                    borderBottom: '1px solid #e2e8f0', background: '#fff', flexShrink: 0
                }}>
                    <span title={t('title')} style={{flex: '1 1 auto', minWidth: 0, overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 700, fontSize: 12, color: '#7C3AED'}}>
                        {t('title')}
                    </span>
                    {((session && (screen || widgets.length > 0)) || hasOtherWidgets) && (
                        <select aria-label={t('surface', this.props.locale)} title={t('surface', this.props.locale)}
                            value={terminal ? 'terminal' : machineWidget ? 'screen' : 'widgets'}
                            onChange={event => this.setState({machineSurface: event.target.value})}>
                            {screen && <option value="screen">Screen</option>}
                            {(!screen || hasOtherWidgets) && <option value="widgets">Widgets</option>}
                            {session && <option value="terminal">{session.title}</option>}
                        </select>
                    )}
                    <EditorHelp editor="Widgets" label="Widgets" locale={this.props.locale} />
                    {widgets.some(widget => widget.config.logikus === true) && (
                        <button type="button" data-testid="bw-open-logikus"
                            aria-label={logikusLabel} title={logikusLabel}
                            onClick={() => window.dispatchEvent(new CustomEvent('bw-logikus-open'))}
                            style={{background: '#ede9fe', color: '#5b21b6', border: '1px solid #c4b5fd',
                                borderRadius: 6, width: 24, height: 28, padding: 0, cursor: 'pointer'}}>
                            <span aria-hidden="true">↗</span>
                        </button>
                    )}
                    {/* ENTERING full screen from here, because there is no other way in
                        on a phone: the stage header that normally offers it is capped
                        to 44px in this dock mode, and a sweep of the pane on a phone
                        found no reachable enter-fullscreen control at all. Exit was
                        already covered; entry was not. */}
                    {!this.props.isFullScreen && this.props.onEnterFullScreen && (
                        <button type="button" data-testid="bw-widgets-enter-fullscreen"
                            onClick={this.props.onEnterFullScreen}
                            aria-label={t('enterFullScreen')}
                            title={t('enterFullScreen')}
                            style={{
                                background: '#ede9fe', color: '#5b21b6',
                                border: '1px solid #c4b5fd', borderRadius: 6,
                                padding: 0, width: 24, height: 28, flexShrink: 0, cursor: 'pointer', fontSize: 14,
                            }}>
                            <span aria-hidden="true">⛶</span>
                        </button>
                    )}
                    {this.props.isFullScreen && (
                        <button type="button" data-testid="bw-widgets-exit-fullscreen"
                            onClick={this.props.onExitFullScreen}
                            aria-label={t('exitFullScreen')}
                            title={t('exitFullScreen')}
                            style={{border: '1px solid #cbd5e1', borderRadius: 6,
                                background: '#fff', color: '#334155', padding: 0, width: 24, height: 28, flexShrink: 0,
                                cursor: 'pointer', fontSize: 12}}>
                            <span aria-hidden="true">↙</span>
                        </button>
                    )}
                    {/* Mode toggle */}
                    <div style={{
                        display: 'flex', flexShrink: 0, borderRadius: 6,
                        border: '1px solid #cbd5e1', overflow: 'hidden'
                    }}>
                        <button
                            type="button"
                            data-testid="bw-ctl-mode-edit"
                            aria-label={t('edit')}
                            aria-pressed={mode === 'edit'}
                            title={t('edit')}
                            onClick={() => this._setMode('edit')}
                            style={{
                                width: 24, height: 28, padding: 0, fontSize: 16, border: 'none',
                                cursor: 'pointer', fontWeight: 600,
                                background: mode === 'edit' ? '#7C3AED' : '#f1f5f9',
                                color: mode === 'edit' ? '#fff' : '#64748b',
                            }}
                        >
                            {'✎'}
                        </button>
                        <button
                            type="button"
                            data-testid="bw-ctl-mode-play"
                            aria-label={t('play')}
                            aria-pressed={mode === 'play'}
                            title={t('play')}
                            onClick={() => this._setMode('play')}
                            style={{
                                width: 24, height: 28, padding: 0, fontSize: 16, border: 'none',
                                cursor: 'pointer', fontWeight: 600,
                                background: mode === 'play' ? '#7C3AED' : '#f1f5f9',
                                color: mode === 'play' ? '#fff' : '#64748b',
                            }}
                        >
                            {'▶'}
                        </button>
                    </div>
                    {/* Grid snap toggle (edit mode only) */}
                    {mode === 'edit' && (
                        <button
                            data-testid="bw-ctl-snap-toggle"
                            aria-label={t('gridSnap', this.props.locale)} aria-pressed={this.state.snap}
                            onClick={() => this.setState(st => ({ snap: !st.snap }))}
                            title={`${t(this.state.snap ? 'gridOn' : 'gridOff', this.props.locale)} (${this.state.grid}px)`}
                            style={{
                                padding: 0, width: 24, height: 28, flexShrink: 0, fontSize: 14, borderRadius: 6,
                                border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: 600,
                                background: this.state.snap ? '#ede9fe' : '#f1f5f9',
                                color: this.state.snap ? '#7C3AED' : '#64748b',
                            }}
                        >
                            <span aria-hidden="true">▦</span>
                        </button>
                    )}
                    {/* Hide the binding line on every card. PANEL-LEVEL, and it sits
                        in the toolbar rather than the per-widget inspector for that
                        reason: the per-widget flags describe one card's own face,
                        while a binding line is the same information on all of them.
                        Edit mode only -- there is nothing to change in Play -- but
                        the setting persists either way, because it is serialised
                        upstream. */}
                    {mode === 'edit' && (
                        <button type="button" data-testid="bw-ctl-hide-bindings"
                            aria-label={t('hideBindings')} title={t('hideBindings')} aria-pressed={!!panel.hideBindings}
                            style={{width: 24, height: 28, padding: 0, flexShrink: 0, border: '1px solid #cbd5e1',
                                borderRadius: 6, cursor: 'pointer', background: panel.hideBindings ? '#ede9fe' : '#f1f5f9'}}
                            onClick={() => {
                                const before = this._snapshot();
                                panel.setHideBindings(!panel.hideBindings);
                                this._persist();
                                this._recordUndo(before, 'Show or hide bindings');
                                this.forceUpdate();
                            }}>
                            <span aria-hidden="true">⌁</span>
                        </button>
                    )}

                    {/* Add widget (edit mode only) */}
                    {mode === 'edit' && (
                        <div style={{position: 'relative', flexShrink: 0}}>
                            <button
                                type="button" aria-label={t('addWidget')} title={t('addWidget')}
                                aria-expanded={this.state.addMenuOpen}
                                onClick={() => this.setState(s => ({ addMenuOpen: !s.addMenuOpen }))}
                                style={{
                                    background: '#7C3AED', color: '#fff', border: 'none',
                                    borderRadius: 6, width: 24, height: 28, padding: 0, fontSize: 16,
                                    cursor: 'pointer', fontWeight: 600,
                                }}
                            >
                                <span aria-hidden="true">+</span>
                            </button>
                            {this.state.addMenuOpen && (
                                <div style={{
                                    position: 'absolute', top: '100%', right: 0, marginTop: 4,
                                    background: '#fff', border: '1px solid #e2e8f0',
                                    borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                    padding: 4, zIndex: 100, minWidth: 120,
                                }}>
                                    <div style={{maxHeight: 'min(55vh, 360px)', overflowY: 'auto', scrollbarWidth: 'thin'}}>
                                        {[...machineChoices, ...Object.values(WIDGET_TYPES)
                                            .filter(type => type !== 'machine')
                                            .map(type => ({label: t(type), run: () => this._addWidget(type)}))]
                                            .map(({label, disabled, run}) => (
                                                <button key={label} disabled={disabled} onClick={run} style={{
                                                    display: 'block', width: '100%', textAlign: 'left', whiteSpace: 'nowrap',
                                                    padding: '6px 10px', border: 'none', background: 'none',
                                                    cursor: disabled ? 'default' : 'pointer', color: '#334155',
                                                    opacity: disabled ? .5 : 1, fontSize: 12, borderRadius: 4
                                                }}>{label}</button>
                                            ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {!machineFullScreen && <SpikePortMonitor vm={this.props.vm} locale={this.props.locale} />}

                {/* Widget canvas: absolute placement from layout.{x,y}, size from
                    layout.{w,h}, rotation + colour + label applied. In EDIT mode
                    widgets drag (grid-snapped), resize by the corner handle and
                    rotate by the top handle; click selects for the inspector. */}
                <div data-testid="bw-controller-canvas"
                    style={{flex: 1, minHeight: 0, overflow: machineFullScreen ? 'hidden' : 'auto',
                        position: 'relative', scrollbarWidth: 'thin'}}
                    onPointerDown={e => {
                        if (e.target === e.currentTarget) this.setState({ selected: null });
                    }}>
                    {cp1WidgetSlot && <div ref={cp1WidgetSlot} data-cp1-widget-slot hidden={machineFullScreen} />}
                    {widgets.length === 0 && !cp1WidgetSlot && !terminal && (
                        <div style={{
                            color: '#94a3b8', fontSize: 14, textAlign: 'center',
                            padding: '40px 20px',
                        }}>
                            {t('noWidgets')}
                        </div>
                    )}
                    {machineWidget && <MachineConsole widget={machineWidget} locale={this.props.locale}
                        keyboardSet={this.props.machineConsole.keyboardSet}
                        keyIn={this.props.machineConsole.keyIn}
                        serialIn={this.props.machineConsole.serialIn}
                        isFullScreen={this.props.isFullScreen}
                        onToggleFullScreen={toggleMachineFullScreen}
                        mouseIn={this.props.machineConsole.mouseIn} />}
                    {terminal && <div style={{height: '100%', minHeight: 0}}>
                        <MachineTerminal session={terminal} locale={this.props.locale} isFullScreen={this.props.isFullScreen}
                            onToggleFullScreen={toggleMachineFullScreen} />
                    </div>}
                    <div hidden={machineFullScreen || Boolean(terminal)} style={machineWidget || (cp1WidgetSlot && widgets.length) ? {
                        position: 'relative', minHeight: cp1WidgetSlot ? 240 : undefined
                    } : undefined}>
                        {widgets.filter(widget => widget !== screen).map(w => (
                            <PositionedWidget
                                key={w.name}
                                widget={w}
                                fitCanvas={widgets.length === 1 && w.layout.x === 8 && w.layout.y === 8 && !w.layout.w &&
                                    ((isCardiacFace(w) && w.layout.h === MACHINE_WIDGET_HEIGHT) || isAceKimFace(w))}
                                mode={mode}
                                selected={mode === 'edit' && this.state.selected === w.name}
                                snap={v => this._snap(v)}
                                onSelect={() => this.setState({ selected: w.name })}
                                onLayout={(patch, persist) => this._layout(w.name, patch, persist)}
                            >
                                {w.type === 'machine' ? (
                                    <section aria-label={w.layout.label || w.name}
                                        style={{background: '#f6f8f4', border: '1px solid #c5d5d8', borderRadius: 8,
                                            height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden'}}>
                                        {mode === 'play' && isAceKimFace(w) && aceKimMachine ?
                                            <MachineScreenHeader locale={this.props.locale} title="ACE KIM · 65C02"
                                                help={german ? 'ESC öffnet den Monitor. INS bearbeitet das Byte an der angezeigten Adresse.' :
                                                    'Press Esc to open the monitor. Press Ins to edit the byte at the displayed address.'}
                                                isFullScreen={this.props.isFullScreen} onToggleFullScreen={toggleMachineFullScreen} /> :
                                            <header data-testid={`bw-ctl-machine-header-${w.name}`}
                                            title={mode === 'edit' ? (german ? 'Zum Verschieben ziehen' : 'Drag to move') : undefined}
                                            style={{padding: '5px 26px 5px 8px', fontSize: 12, fontWeight: 700, color: '#16333c',
                                                borderBottom: '1px solid #c5d5d8'}}>
                                                {w.layout.label || w.name}
                                            </header>}
                                        {isAceKimFace(w) && aceKimMachine ?
                                            <div className="kim1-panel" style={{flex: 1, minHeight: 0, overflow: 'auto',
                                                width: '100%', maxWidth: 520, margin: '0 auto', boxSizing: 'border-box'}}>
                                                <React.Suspense fallback={null}>
                                                    <AceKimFace machine={aceKimMachine} disabled={mode === 'edit'} />
                                                </React.Suspense>
                                            </div> :
                                            w === cardiacWidget && cardiacWidgetSlot ?
                                            <div ref={cardiacWidgetSlot} data-cardiac-widget-slot
                                                style={{flex: 1, minHeight: 0, overflow: 'auto', scrollbarWidth: 'thin'}} /> :
                                            isMicrotronicFace(w) && microtronicParts.some(part => part.id === w.config.partId) ?
                                                <div style={{flex: 1, minHeight: 0, overflow: 'auto', scrollbarWidth: 'thin'}}>
                                                    <React.Suspense fallback={null}>
                                                        <MicrotronicSurface vm={this.props.vm} partId={w.config.partId}
                                                            variant="front" locale={this.props.locale} />
                                                    </React.Suspense>
                                                </div> :
                                            (isKim1Face(w) || isKim1VideoFace(w)) && kimParts.some(part => part.id === w.config.partId) ?
                                                <div style={{flex: 1, minHeight: 0, overflow: 'auto', scrollbarWidth: 'thin'}}>
                                                    <React.Suspense fallback={null}>
                                                        <Kim1Surface vm={this.props.vm} partId={w.config.partId}
                                                            variant={isKim1VideoFace(w) ? 'video' : 'front'}
                                                            locale={this.props.locale} />
                                                    </React.Suspense>
                                                </div> :
                                            <span style={{display: 'block', padding: 8}}>
                                                {german ? 'Nicht verbunden' : 'Disconnected'}
                                            </span>}
                                        {mode === 'edit' && <RemoveWidgetButton name={w.name} onRemove={() => {
                                            this._removeWidget(w.name);
                                            this.setState({selected: null});
                                        }} />}
                                    </section>
                                ) : <WidgetCard locale={this.props.locale}
                                    widget={w}
                                    mode={mode}
                                    panel={panel}
                                    buttonInputs={this._buttonInputs}
                                    runtime={this.props.vm?.runtime}
                                    videoKind={w.type === 'simplevga' && w.binding?.target === 'part' ?
                                        this.props.board?.parts?.find(part => part.id === w.binding.partId)?.kind : null}
                                    sendBasicLine={mode === 'play' && w.type === 'keyboard' && w.binding?.target === 'part' &&
                                        this.props.board?.parts?.some(part => part.id === w.binding.partId && part.kind === 'ps2')
                                        ? this.props.sendBasicLine : undefined}
                                    onInput={(name, x, y) => this._handleJoystickInput(name, x, y)}
                                    onRemove={() => { this._removeWidget(w.name); this.setState({ selected: null }); }}
                                    hideBindings={panel.hideBindings}
                                />}
                            </PositionedWidget>
                        ))}
                    </div>
                    {mode === 'edit' && this.state.selected && panel.getWidget(this.state.selected) && (() => {
                        // Snapshot the widget the moment its inspector opens,
                        // so ✕ can revert everything edited since (config,
                        // layout, binding, name). _rename keeps the snapshot
                        // attached across a rename; a NEW selection re-snaps.
                        if (this._snapFor !== this.state.selected) {
                            const sw = panel.getWidget(this.state.selected);
                            this._snapFor = this.state.selected;
                            this._inspectorSnap = {
                                name: sw.name,
                                config: JSON.parse(JSON.stringify(sw.config || {})),
                                layout: JSON.parse(JSON.stringify(sw.layout || {})),
                                binding: sw.binding ? JSON.parse(JSON.stringify(sw.binding)) : null
                            };
                        }
                        return (
                            <WidgetInspector
                                widget={panel.getWidget(this.state.selected)}
                                onRename={n => this._rename(this.state.selected, n)}
                                onLayout={patch => this._layout(this.state.selected, patch, true)}
                                onConfig={patch => this._config(this.state.selected, patch)}
                                onBind={(target, value, param) =>
                                    this._bind(this.state.selected, target, value, param)}
                                variableNames={this._variableNames()}
                                parts={this._circuitParts(panel.getWidget(this.state.selected))}
                                onOpenLibrary={() => this.setState({ libraryOpen: true })}
                                onOk={() => { this._snapFor = null; this.setState({ selected: null }); }}
                                onCancel={() => this._restoreWidget(this.state.selected, this._inspectorSnap)}
                            />
                        );
                    })()}
                </div>
                {this.state.libraryOpen && (
                    <ScratchImagePicker
                        vm={this.props.vm}
                        onSelect={item => this._pickLibraryImage(item)}
                        onClose={() => this.setState({ libraryOpen: false })}
                    />
                )}
            </div>
        );
    }
}

export default ControllerPanelView;
