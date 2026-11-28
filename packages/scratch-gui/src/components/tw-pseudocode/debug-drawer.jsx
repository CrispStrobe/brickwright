import React from 'react';
import PropTypes from 'prop-types';

import {
    IO_SFRS, TIMER_SFRS, formatBytes, formatCodeAddress, hex8, hex16
} from '../../lib/bw-debug/trace.js';
import {PSW_BITS, sfrName} from '../../lib/bw-debug/opcodes.js';
import {downloadTraceCsv} from '../../lib/bw-debug/trace-csv.js';
import {promptAsync} from '../../lib/native-dialog.js';
import {memorySpaces, memoryPage, memoryJump, readMemoryPage, formatMemoryAddress,
    memorySessionCurrent, memoryWritable, memorySpacesDeclared}
    from '../../lib/bw-debug/memory-view.js';
import {memoryByteHelp, memoryByteMarkerStyle} from '../../lib/bw-debug/memory-byte-help.js';

/**
 * "Under the hood" — parity with emu8051's TUI, as a GUI.
 *
 * ## What parity means here
 *
 * `mainview.c` draws eight boxes: a disassembly of executed instructions, a
 * register row per instruction, PSW bits, SP/ports/IP/IE, the timer and serial
 * SFRs, a memory window that cycles Low/Upr/SFR/Ext/ROM, the stack, and a
 * cycles/time readout. `memeditor.c` is a fuller hex editor on the same five
 * spaces, `logicboard.c` is the board, `options.c` the clock. The keys are:
 * step, run, speed, breakpoint at an address, go to address, reset, wipe,
 * reset the tick counter, and edit any value in place.
 *
 * Everything above is here, except the board — which is not missing, it is the
 * Circuit tab, and a second worse copy of it would be the wrong kind of parity.
 *
 * ## Where this deliberately differs, and why that is not a shortfall
 *
 * **Five of those eight boxes are one table.** They are not independent panes in
 * the TUI either: `mainview.c` keeps a single history ring and draws five
 * columns of it, scrolled together. Eight boxes across 80 columns is a terminal
 * layout constraint, not a design. Showing them as one row per instruction —
 * PC, opcode bytes, assembly, then registers, ports and timers as toggleable
 * column groups — is the same information with the relationship made visible
 * instead of implied.
 *
 * **Nothing is a bare number where a name exists.** `PSW` is eight named flags,
 * an SFR address is `TMOD` rather than `0x89` (names from stc_disasm's table),
 * and the register bank in use is marked rather than left to be decoded out of
 * PSW.4:3. The TUI's users know the 8051; this one's are learning it.
 *
 * **The trace says what it did not record.** The TUI records per instruction
 * because its loop single-steps; at speed it cannot keep up either. Here a free
 * run records at stops only, unless you ask for per-instruction tracing — and
 * the pane labels the difference rather than presenting a gap as a history.
 */

const MONO = {fontFamily: 'monospace', fontSize: 11};
const PANE = {
    background: '#12121f', border: '1px solid #2c3e50', borderRadius: 6,
    padding: 8, ...MONO, color: '#bdc3c7', overflow: 'auto'
};
const TITLE = {color: '#7f8c8d', fontSize: 10, textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: 6};
const CELL = {padding: '1px 5px', textAlign: 'right', whiteSpace: 'nowrap'};
const BTN = {
    padding: '3px 8px', borderRadius: 3, border: '1px solid #2c3e50',
    background: '#16213e', color: '#ecf0f1', cursor: 'pointer', ...MONO
};

const L10N = {
    en: {
        title: 'Under the hood', hide: 'Hide', show: 'Show',
        trace: 'Execution trace', now: 'Registers', sfrs: 'Special function registers',
        memory: 'Memory', stack: 'Stack', clock: 'Clock', code: 'Code at the program counter',
        clickBreak: 'Click to pause here',
        codeNote: 'Anchored at the program counter and read forwards — an 8051 cannot be ' +
            'disassembled backwards, because nothing marks where an instruction starts.',
        cols: 'Columns', regs: 'registers', ports: 'ports', timers: 'timers',
        stepInsn: 'Step instruction', over: 'Step over', out: 'Step out',
        runTo: 'Run to address', runToHint: 'Run to a code address and stop before it executes',
        stepCycle: 'Step cycle',
        cycleHint: 'One CPU clock — finer than one instruction. A multi-cycle ' +
            'instruction takes several presses, and the PC only moves on the one ' +
            'that retires it.',
        noCycle: 'This engine executes a whole instruction per step, so it has no ' +
            'cycle to stop on. Step one instruction; the register row reports what ' +
            'it cost in cycles.',
        watch: 'Watchpoints', addWatch: 'Watch a byte…',
        watchHint: 'Stop when this byte CHANGES. Writing the value already there is ' +
            'invisible, and a byte the peripherals move fires on its own.',
        noWatch: 'This engine has no write watchpoints.',
        removeWatch: 'Stop watching this byte',
        setPc: 'Set PC', breakAt: 'Break at', reset: 'Reset', wipe: 'Wipe',
        noSetPc: 'This engine cannot move the program counter',
        noWipe: 'This engine cannot wipe memory',
        stepTen: 'Step ×10', clear: 'Clear',
        csvTitle: 'Export the trace as CSV — every row with time, registers, SFRs and captured variables',
        tenHint: 'Ten instructions, each one a row in the trace',
        empty: 'Nothing has run yet. Press Run, then pause or hit a pause point.',
        gapNote: 'A row is recorded whenever the program stops — so stepping traces it ' +
            'instruction by instruction, while a free run records only where it stopped. ' +
            'Recording every instruction of a full-speed run is not possible: that is ' +
            'millions a second.',
        dropped: 'older rows dropped',
        bank: 'bank', cycles: 'cycles', ms: 'ms',
        spaceNote: 'SFR and internal RAM share these addresses and are different memories.',
        memoryMarkers: 'Yellow: SP · purple: DPTR · green: PC · blue: active register bank. Hover for byte values.',
        editHint: 'Click a byte to edit it.'
    },
    de: {
        title: 'Unter der Haube', hide: 'Verbergen', show: 'Zeigen',
        trace: 'Ablaufprotokoll', now: 'Register', sfrs: 'Spezialregister',
        memory: 'Speicher', stack: 'Stapel', clock: 'Takt', code: 'Code am Programmzähler',
        clickBreak: 'Klicken, um hier anzuhalten',
        codeNote: 'Ab dem Programmzähler vorwärts gelesen — ein 8051 lässt sich nicht ' +
            'rückwärts disassemblieren, da nichts den Befehlsanfang markiert.',
        cols: 'Spalten', regs: 'Register', ports: 'Ports', timers: 'Timer',
        stepInsn: 'Ein Befehl', over: 'Überspringen', out: 'Heraus',
        runTo: 'Bis Adresse', runToHint: 'Bis zu einer Codeadresse laufen und davor anhalten',
        stepCycle: 'Ein Takt',
        cycleHint: 'Ein CPU-Takt — feiner als ein Befehl. Ein mehrtaktiger Befehl ' +
            'braucht mehrere Klicks, und der PC bewegt sich nur bei dem Takt, der ihn ' +
            'abschließt.',
        noCycle: 'Diese Engine führt pro Schritt einen ganzen Befehl aus und hat daher ' +
            'keinen Takt zum Anhalten. Gehe einen Befehl weiter; die Registerzeile zeigt, ' +
            'wie viele Takte er gekostet hat.',
        watch: 'Watchpoints', addWatch: 'Byte beobachten…',
        watchHint: 'Anhalten, wenn sich dieses Byte ÄNDERT. Denselben Wert erneut zu ' +
            'schreiben bleibt unsichtbar, und ein Byte, das die Peripherie bewegt, löst ' +
            'von selbst aus.',
        noWatch: 'Diese Engine hat keine Schreib-Watchpoints.',
        removeWatch: 'Dieses Byte nicht mehr beobachten',
        setPc: 'PC setzen', breakAt: 'Halt bei', reset: 'Reset', wipe: 'Löschen',
        noSetPc: 'Diese Engine kann den Programmzähler nicht setzen',
        noWipe: 'Diese Engine kann den Speicher nicht löschen',
        stepTen: 'Schritt ×10', clear: 'Leeren',
        csvTitle: 'Trace als CSV exportieren — jede Zeile mit Zeit, Registern, SFRs und erfassten Variablen',
        tenHint: 'Zehn Befehle, jeder eine Zeile im Protokoll',
        empty: 'Es lief noch nichts. Auf Start drücken, dann anhalten.',
        gapNote: 'Eine Zeile entsteht bei jedem Anhalten — Einzelschritte protokollieren ' +
            'also Befehl für Befehl, ein freier Lauf nur die Haltepunkte. Jeden Befehl eines ' +
            'Laufs mit voller Geschwindigkeit aufzuzeichnen geht nicht: das sind Millionen ' +
            'pro Sekunde.',
        dropped: 'ältere Zeilen verworfen',
        bank: 'Bank', cycles: 'Zyklen', ms: 'ms',
        spaceNote: 'Spezialregister und internes RAM teilen sich diese Adressen und sind ' +
            'verschiedene Speicher.',
        memoryMarkers: 'Gelb: SP · violett: DPTR · grün: PC · blau: aktive Registerbank. Bytewerte beim Zeigen.',
        editHint: 'Auf ein Byte klicken zum Ändern.'
    }
};

// Machine-class targets (6502, Z80) have one flat 64K space; the 8051
// list below would page through spaces their readMem refuses.
const MACHINE_SPACES = [
    {id: 'mem', label: 'Memory', size: 0x10000}
];
const SPACES = [
    {id: 'iram', label: 'Internal RAM', size: 0x100},
    {id: 'sfr', label: 'SFR', size: 0x100, base: 0x80},
    {id: 'xram', label: 'External RAM', size: 0x400},
    {id: 'code', label: 'Program (ROM)', size: 0x1000},
    {id: 'bit', label: 'Bit space', size: 0x100}
];

class DebugDrawer extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            open: false,
            space: 'iram',
            page: 0,
            showRegs: true,
            showPorts: false,
            showTimers: false
        };
        this.toggle = this.toggle.bind(this);
    }

    componentDidMount () { this.memoryViewMounted = true; }

    componentWillUnmount () { this.memoryViewMounted = false; }

    tx (key) {
        const table = L10N[this.props.locale] || L10N.en;
        return table[key] || L10N.en[key];
    }

    toggle () { this.setState(s => ({open: !s.open})); }

    /**
     * Ask the user for a hex address. A prompt is honest about being a stopgap. Awaited: in the
     * desktop/iOS app `prompt` returns null at once (lib/native-dialog.js).
     */
    async askAddress (label, fallback, maximum = 0xFFFF) {
        const initial = Math.max(0, Number(fallback) || 0).toString(16).toUpperCase()
            .padStart(maximum > 0xFFFF ? 5 : 4, '0');
        const raw = await promptAsync(`${label} (hex)`, initial);
        if (raw === null) return null;
        const n = parseInt(String(raw).replace(/^0x/i, ''), 16);
        return Number.isSafeInteger(n) && n >= 0 && n <= maximum ? n : null;
    }

    renderControls () {
        const {runner} = this.props;
        const caps = (this.props.ui && this.props.ui.capabilities) || null;
        const debugCaps = (this.props.ui && this.props.ui.debugCapabilities) || null;
        const can = kind => !caps || caps.steps.includes(kind);
        // `can` defaults to TRUE when capabilities have not arrived, which is
        // right for the controls every engine has and wrong for one that must
        // be ASSERTED. A cycle step is the second kind: absent capabilities
        // must mean no button, not a button that turns out to refuse. This is
        // the D5 lesson in one line.
        const hasCycle = !!(caps && (caps.steps || []).includes('cycle'));
        const runToAddress = debugCaps && (debugCaps.runTo || []).find(item =>
            item.kind === 'address' && item.space === 'code' &&
            item.stopSides.includes('before'));
        const runToDisabled = !runToAddress || ['running', 'stepping', 'building', 'attaching']
            .includes(this.props.ui?.phase);
        const hasWatch = !!(caps && (caps.breakpoints || []).includes('write'));
        // Set PC and Wipe are NOT capability flags — only the 8051 target
        // implements them at all. These two buttons were ungated while their
        // neighbours were, so on any other engine they threw a TypeError
        // rather than being visibly unavailable.
        const has = name => !runner.supports || runner.supports(name);
        const off = {...BTN, color: '#4a5568', cursor: 'not-allowed'};
        return (
            <div style={{display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8}}>
                <button
                    style={BTN}
                    onClick={() => runner.stepInstruction(1)}
                >{this.tx('stepInsn')}</button>
                {/* One CPU clock — offered ONLY where the engine says it has
                    one. Every core here except emu8051 executes a whole
                    instruction per call, so on those this button would be the
                    instruction step with a different label: the D5 lie. It is
                    absent there rather than disabled, because a greyed-out
                    control implies a feature that could be switched on. The
                    `noCycle` sentence explains it in the drawer's note line. */}
                {hasCycle ? (
                    <button
                        style={BTN}
                        data-step-cycle
                        title={this.tx('cycleHint')}
                        onClick={() => runner.stepCycle(1)}
                    >{this.tx('stepCycle')}</button>
                ) : null}
                <button
                    style={can('over') ? BTN : off}
                    disabled={!can('over')}
                    title={can('over') ? 'Run until SP returns to its current depth'
                        : 'This target cannot step over'}
                    onClick={() => runner.stepOver()}
                >{this.tx('over')}</button>
                <button
                    style={can('out') ? BTN : off}
                    disabled={!can('out')}
                    onClick={() => runner.stepOut()}
                >{this.tx('out')}</button>
                {runToAddress ? <button
                    style={runToDisabled ? off : BTN}
                    disabled={runToDisabled}
                    data-run-to-address
                    title={this.tx('runToHint')}
                    onClick={async () => {
                        const address = await this.askAddress(this.tx('runTo'), this.currentPc(),
                            runToAddress.addressMax);
                        if (address !== null) runner.runToAddress(address);
                    }}
                >{this.tx('runTo')}</button> : null}
                <button
                    style={has('setPc') ? BTN : off}
                    disabled={!has('setPc')}
                    title={has('setPc') ? undefined : this.tx('noSetPc')}
                    onClick={async () => {
                        const a = await this.askAddress(this.tx('setPc'), this.currentPc());
                        if (a !== null) runner.setPc(a);
                    }}
                >{this.tx('setPc')}</button>
                <button style={BTN} onClick={() => runner.resetCpu()}>{this.tx('reset')}</button>
                <button
                    style={has('wipe') ? BTN : off}
                    disabled={!has('wipe')}
                    title={has('wipe') ? undefined : this.tx('noWipe')}
                    onClick={() => runner.wipe()}
                >{this.tx('wipe')}</button>
                <button
                    style={BTN}
                    title={this.tx('tenHint')}
                    onClick={() => runner.stepInstruction(10)}
                >{this.tx('stepTen')}</button>
                {/* Say why the finer step is missing, rather than leaving its
                    absence to be read as an oversight. A learner who wonders
                    "why can I not step a cycle here?" gets the architecture
                    answer instead of filing a bug. */}
                {hasCycle ? null : (
                    <span style={{fontSize: 11, color: '#5d6d7e', alignSelf: 'center', maxWidth: 320}}>
                        {this.tx('noCycle')}
                    </span>
                )}
            </div>
        );
    }

    /**
     * Write watchpoints, by address.
     *
     * Lives in the drawer rather than the main panel for the same reason the
     * memory editor does: it is addressed in hex, and the person who wants it
     * has already said so by opening this. The main panel's pause points are
     * addressed by BLOCK, which is the same idea in the user's own nouns.
     */
    renderWatchpoints () {
        const {runner} = this.props;
        const caps = (this.props.ui && this.props.ui.capabilities) || null;
        const hasWatch = !!(caps && (caps.breakpoints || []).includes('write'));
        if (!hasWatch) {
            return (
                <div style={{...PANE, marginTop: 8}} data-watchpoints>
                    <div style={TITLE}>{this.tx('watch')}</div>
                    <div style={{fontSize: 11, color: '#5d6d7e'}}>{this.tx('noWatch')}</div>
                </div>
            );
        }
        const list = runner.watchpoints ? runner.watchpoints() : [];
        return (
            <div style={{...PANE, marginTop: 8}} data-watchpoints>
                <div style={TITLE}>{this.tx('watch')}</div>
                <div style={{display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center'}}>
                    <button
                        style={BTN}
                        data-add-watchpoint
                        title={this.tx('watchHint')}
                        onClick={async () => {
                            const a = await this.askAddress(this.tx('addWatch'), 0x30);
                            if (a === null) return;
                            const r = runner.toggleWatchpoint('iram', a);
                            // A refusal is shown, never swallowed: a watchpoint
                            // that looks armed and is not is the exact failure
                            // this feature exists to avoid.
                            if (r && r.refused) window.alert(r.refused);
                            this.forceUpdate();
                        }}
                    >{this.tx('addWatch')}</button>
                    {list.map(w => (
                        <button
                            key={`${w.space}:${w.addr}`}
                            style={{...BTN, borderColor: '#f39c12', color: '#f39c12'}}
                            title={this.tx('removeWatch')}
                            data-watchpoint-entry
                            onClick={() => {
                                runner.toggleWatchpoint(w.space, w.addr);
                                this.forceUpdate();
                            }}
                        >{`${w.space} ${hex16(w.addr)} ✕`}</button>
                    ))}
                </div>
                <div style={{fontSize: 11, color: '#5d6d7e', marginTop: 4}}>
                    {this.tx('watchHint')}
                </div>
            </div>
        );
    }

    currentPc () {
        const snap = this.props.runner.inspect();
        return snap ? snap.pc : 0;
    }

    renderTrace () {
        const {runner} = this.props;
        const rows = runner.trace();
        const {showRegs, showPorts, showTimers} = this.state;
        const dropped = runner.traceDropped();

        return (
            <div style={{...PANE, maxHeight: 260}}>
                <div style={{...TITLE, display: 'flex', gap: 10, alignItems: 'center'}}>
                    <span>{this.tx('trace')}</span>
                    <span style={{marginLeft: 'auto', textTransform: 'none'}}>
                        {this.tx('cols')}
                        {[['showRegs', 'regs'], ['showPorts', 'ports'], ['showTimers', 'timers']]
                            .map(([key, label]) => (
                                <label key={key} style={{marginLeft: 6}}>
                                    <input
                                        type="checkbox"
                                        checked={this.state[key]}
                                        onChange={() => this.setState(s => ({[key]: !s[key]}))}
                                    />
                                    {this.tx(label)}
                                </label>
                            ))}
                    </span>
                    <button
                        style={BTN}
                        title={this.tx('csvTitle')}
                        disabled={!rows.length}
                        onClick={() => downloadTraceCsv(rows,
                            `bw-trace-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`)}
                    >{'CSV'}</button>
                    <button style={BTN} onClick={() => runner.clearTrace()}>{this.tx('clear')}</button>
                </div>
                {!rows.length ? (
                    <div style={{color: '#5d6d7e'}}>{this.tx('empty')}</div>
                ) : (
                    <table style={{borderCollapse: 'collapse', width: '100%'}}>
                        <thead>
                            <tr style={{color: '#7f8c8d'}}>
                                <th style={CELL}>{'PC'}</th>
                                <th style={{...CELL, textAlign: 'left'}}>{'Opcodes'}</th>
                                <th style={{...CELL, textAlign: 'left'}}>{'Assembly'}</th>
                                {showRegs ? ['A', 'B', 'DPTR', 'SP', 'PSW'].map(h =>
                                    <th key={h} style={CELL}>{h}</th>) : null}
                                {showRegs ? [0, 1, 2, 3, 4, 5, 6, 7].map(n =>
                                    <th key={n} style={CELL}>{`R${n}`}</th>) : null}
                                {showPorts ? IO_SFRS.map(s =>
                                    <th key={s.name} style={CELL}>{s.name}</th>) : null}
                                {showTimers ? TIMER_SFRS.map(s =>
                                    <th key={s.name} style={CELL}>{s.name}</th>) : null}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.slice(-200).map(row => (
                                <tr key={row.seq} style={{color: '#ecf0f1'}}>
                                    <td style={{...CELL, color: '#3498db'}}>{hex16(row.pc)}</td>
                                    <td style={{...CELL, textAlign: 'left', color: '#7f8c8d'}}>
                                        {formatBytes(row.bytes)}
                                    </td>
                                    <td style={{...CELL, textAlign: 'left'}}>{row.text}</td>
                                    {showRegs ? [
                                        <td key="a" style={CELL}>{hex8(row.a)}</td>,
                                        <td key="b" style={CELL}>{hex8(row.b)}</td>,
                                        <td key="d" style={CELL}>{hex16(row.dptr)}</td>,
                                        <td key="s" style={CELL}>{hex8(row.sp)}</td>,
                                        <td key="p" style={CELL}>{hex8(row.psw)}</td>
                                    ] : null}
                                    {showRegs ? row.r.map((v, n) =>
                                        <td key={`r${n}`} style={CELL}>{hex8(v)}</td>) : null}
                                    {showPorts ? IO_SFRS.map(s =>
                                        <td key={s.name} style={CELL}>{hex8(row.sfr[s.name])}</td>) : null}
                                    {showTimers ? TIMER_SFRS.map(s =>
                                        <td key={s.name} style={CELL}>{hex8(row.sfr[s.name])}</td>) : null}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                <div style={{color: '#5d6d7e', marginTop: 6, fontSize: 10}}>
                    {dropped ? `${dropped} ${this.tx('dropped')}. ` : ''}
                    {this.tx('gapNote')}
                </div>
            </div>
        );
    }

    /**
     * Write a register by writing where it LIVES. Every 8051 register is a
     * memory location — the accumulator is SFR 0xE0, R3 is internal RAM at
     * bank×8+3 — so editing one needs no new emulator API, and going through
     * the same writeMem the hex view uses means the two can never disagree
     * about what a register is.
     */
    async editRegister (name, value, where) {
        const raw = await promptAsync(`${name}`, where.wide ? hex16(value) : hex8(value));
        if (raw === null) return;
        const v = parseInt(String(raw).replace(/^0x/i, ''), 16);
        if (!Number.isFinite(v)) return;
        if (where.wide) {
            this.props.runner.writeMem(where.space, where.addr, (v >> 8) & 0xFF);
            this.props.runner.writeMem(where.space, where.addr + 1, v & 0xFF);
        } else {
            this.props.runner.writeMem(where.space, where.addr, v);
        }
        this.forceUpdate();
    }

    /**
     * Where the program is, in code.
     *
     * The trace pane is history; this is the present, and every debugger has
     * one. It is anchored at the PC and walks FORWARD with the opcode length
     * table — an 8051 cannot be disassembled backwards, since instructions are
     * one to three bytes and nothing marks where one starts. Showing a window
     * that pretends to include earlier instructions would be guessing.
     *
     * Clicking a line sets or clears a breakpoint there, which is why the
     * drawer needs no "type an address" dialog for the common case.
     */
    renderCode () {
        const {runner, ui} = this.props;
        const snap = runner.inspect();
        if (!snap) return null;
        const rows = runner.listing(snap.pc, 12);
        // A target without a disassembler (AVR, RP2040) yields no listing —
        // say so instead of an empty pane, and never crash the app over it.
        if (!rows.length) {
            return (
                <div style={{...PANE, maxHeight: 240}}>
                    <div style={TITLE}>{this.tx('code')}</div>
                    <div style={{opacity: 0.7, fontStyle: 'italic'}}>
                        {'no disassembly on this target'}
                    </div>
                </div>
            );
        }
        const bps = new Set(runner.addressBreakpoints());
        return (
            <div style={{...PANE, maxHeight: 240}}>
                <div style={TITLE}>{this.tx('code')}</div>
                {rows.map((r, i) => {
                    const here = r.addr === snap.pc;
                    const marked = bps.has(r.addr);
                    return (
                        <div
                            key={r.addr}
                            role="button"
                            tabIndex={-1}
                            title={this.tx('clickBreak')}
                            onClick={() => { runner.toggleAddressBreakpoint(r.addr); this.forceUpdate(); }}
                            style={{
                                display: 'flex', gap: 8, whiteSpace: 'nowrap', cursor: 'pointer',
                                background: here ? '#1e3a5f' : 'transparent',
                                borderLeft: `3px solid ${marked ? '#e74c3c' : 'transparent'}`,
                                paddingLeft: 4
                            }}
                        >
                            <span style={{color: here ? '#f39c12' : '#5d6d7e', width: 12}}>
                                {here ? '▶' : (marked ? '●' : '')}
                            </span>
                            <span style={{color: '#3498db'}}>{formatCodeAddress(r.addr)}</span>
                            <span style={{color: '#5d6d7e'}}>{formatBytes(r.bytes)}</span>
                            <span style={{color: here ? '#ecf0f1' : '#bdc3c7'}}>{r.text}</span>
                            {i === 0 && ui && ui.session && ui.session.tasks ? (
                                <span style={{marginLeft: 'auto', color: '#7f8c8d', fontSize: 10}}>
                                    {ui.session.tasks
                                        .filter(t => t.state !== 0xFFFF)
                                        .map(t => `${t.task}:${t.state}`).join(' ')}
                                </span>
                            ) : null}
                        </div>
                    );
                })}
                <div style={{color: '#5d6d7e', marginTop: 6, fontSize: 10}}>
                    {this.tx('codeNote')}
                </div>
            </div>
        );
    }

    renderNow () {
        const snap = this.props.runner.inspect();
        if (!snap) return null;
        const {regs} = snap;
        if (snap.flavor === 'generic') return this.renderNowGeneric(regs);
        const editable = (name, value, where) => (
            <span
                key={name}
                role="button"
                tabIndex={-1}
                title={this.tx('editHint')}
                style={{cursor: 'pointer'}}
                onClick={() => this.editRegister(name, value, where)}
            >
                <span style={{color: '#7f8c8d'}}>{`${name} `}</span>
                <span style={{color: '#ecf0f1', borderBottom: '1px dotted #2c3e50'}}>
                    {where.wide ? hex16(value) : hex8(value)}
                </span>
            </span>
        );
        // DPH is 0x83 and DPL 0x82, so a 16-bit DPTR is written high byte first
        // at 0x83 — hence `wide` writing addr then addr+1 with DPH given first.
        return (
            <div style={PANE}>
                <div style={TITLE}>{this.tx('now')}</div>
                <div style={{display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 6}}>
                    <span
                        role="button"
                        tabIndex={-1}
                        title={this.tx('setPc')}
                        style={{cursor: 'pointer'}}
                        onClick={async () => {
                            const a = await this.askAddress(this.tx('setPc'), regs.pc);
                            if (a !== null) { this.props.runner.setPc(a); this.forceUpdate(); }
                        }}
                    >
                        <span style={{color: '#7f8c8d'}}>{'PC '}</span>
                        <span style={{color: '#ecf0f1', borderBottom: '1px dotted #2c3e50'}}>
                            {hex16(regs.pc)}
                        </span>
                    </span>
                    {editable('A', regs.a, {space: 'sfr', addr: 0xE0})}
                    {editable('B', regs.b, {space: 'sfr', addr: 0xF0})}
                    {editable('DPTR', regs.dptr, {space: 'sfr', addr: 0x83, wide: true})}
                    {editable('SP', regs.sp, {space: 'sfr', addr: 0x81})}
                    {editable('PSW', regs.psw, {space: 'sfr', addr: 0xD0})}
                    <span style={{color: '#f39c12'}}>
                        {`${this.tx('bank')} ${regs.bank}`}
                    </span>
                </div>
                {/* R0-R7 are the CURRENT bank's — the bank is stated rather than
                    left to be decoded out of PSW.4:3, as §6 requires, and it is
                    also what decides where a write to R3 lands. */}
                <div style={{display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6}}>
                    {regs.r.map((v, n) =>
                        editable(`R${n}`, v, {space: 'iram', addr: (regs.bank * 8) + n}))}
                </div>
                {/* PSW as named flags. The TUI prints eight bare digits under a
                    "C-ACF0R1R0Ov--P" header and expects you to know it. */}
                <div style={{display: 'flex', gap: 4, flexWrap: 'wrap'}}>
                    {PSW_BITS.map(b => {
                        const on = (regs.psw >> b.bit) & 1;
                        return (
                            <span
                                key={b.name}
                                title={b.title}
                                style={{
                                    padding: '1px 5px', borderRadius: 3,
                                    border: '1px solid #2c3e50',
                                    background: on ? '#1e5631' : 'transparent',
                                    color: on ? '#2ecc71' : '#5d6d7e'
                                }}
                            >{b.name}</span>
                        );
                    })}
                </div>
            </div>
        );
    }

    // The machine targets' registers, as the target names them — PC stays
    // editable (setPc is generic); everything else reads out. 16-bit when the
    // name says so or the value needs it.
    renderNowGeneric (regs) {
        const WIDE = new Set(['pc', 'sp', 'bc', 'de', 'hl', 'ix', 'iy', 'af_', 'bc_', 'de_', 'hl_', 'dptr']);
        const entries = Object.entries(regs).filter(([k, v]) =>
            k !== 'cycles' && (typeof v === 'number' || typeof v === 'boolean'));
        return (
            <div style={PANE}>
                <div style={TITLE}>{this.tx('now')}</div>
                <div style={{display: 'flex', gap: 12, flexWrap: 'wrap'}}>
                    <span
                        role="button"
                        tabIndex={-1}
                        title={this.tx('setPc')}
                        style={{cursor: 'pointer'}}
                        onClick={async () => {
                            const a = await this.askAddress(this.tx('setPc'), regs.pc);
                            if (a !== null) { this.props.runner.setPc(a); this.forceUpdate(); }
                        }}
                    >
                        <span style={{color: '#7f8c8d'}}>{'PC '}</span>
                        <span style={{color: '#ecf0f1', borderBottom: '1px dotted #2c3e50'}}>
                            {formatCodeAddress(regs.pc)}
                        </span>
                    </span>
                    {entries.filter(([k]) => k !== 'pc').map(([k, v]) => (
                        <span
                            key={k}
                            role={this.props.runner.canWriteRegs && this.props.runner.canWriteRegs() ? 'button' : undefined}
                            tabIndex={-1}
                            style={this.props.runner.canWriteRegs && this.props.runner.canWriteRegs() &&
                                typeof v === 'number' ? {cursor: 'pointer'} : undefined}
                            onClick={async () => {
                                const runner = this.props.runner;
                                if (!runner.canWriteRegs || !runner.canWriteRegs() || typeof v !== 'number') return;
                                const nv = await this.askAddress(`${k.toUpperCase()} =`, v);
                                if (nv === null) return;
                                const r = runner.writeReg(k, nv);
                                this.setState({regWriteError: r && r.unsupported ? r.unsupported : null});
                                this.forceUpdate();
                            }}
                        >
                            <span style={{color: '#7f8c8d'}}>{`${k.toUpperCase().replace(/_$/, "'")} `}</span>
                            <span style={{color: '#ecf0f1'}}>
                                {/* hex16 keeps the low 16 bits by design (a Z80 pair), so a
                                    32-bit core's SP 0x20004000 read as 4000: wider values get all
                                    eight digits. */}
                                {typeof v === 'boolean' ? (v ? '1' : '0') :
                                    v > 0xFFFF ? (v >>> 0).toString(16).toUpperCase().padStart(8, '0') :
                                        (WIDE.has(k) || v > 0xFF) ? hex16(v) : hex8(v)}
                            </span>
                        </span>
                    ))}
                </div>
                {this.state && this.state.regWriteError ? (
                    <div style={{color: '#e74c3c', fontSize: 11}}>{this.state.regWriteError}</div>
                ) : null}
            </div>
        );
    }

    renderSfrs () {
        const snap = this.props.runner.inspect();
        if (!snap || !snap.sfr) return null;
        return (
            <div style={PANE}>
                <div style={TITLE}>{this.tx('sfrs')}</div>
                {[['I/O', IO_SFRS], ['Timers / serial', TIMER_SFRS]].map(([group, list]) => (
                    <div key={group} style={{marginBottom: 6}}>
                        <div style={{color: '#5d6d7e', fontSize: 10}}>{group}</div>
                        <div style={{display: 'flex', gap: 10, flexWrap: 'wrap'}}>
                            {list.map(s => (
                                <span key={s.name} title={`${sfrName(s.addr)} @ 0x${hex8(s.addr)}`}>
                                    <span style={{color: '#7f8c8d'}}>{`${s.name} `}</span>
                                    <span style={{color: '#ecf0f1'}}>{hex8(snap.sfr[s.name])}</span>
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    renderStack () {
        const snap = this.props.runner.inspect();
        if (!snap || !snap.stack) return null;
        return (
            <div style={{...PANE, maxHeight: 160}}>
                <div style={TITLE}>{this.tx('stack')}</div>
                {!snap.stack.length ? (
                    <div style={{color: '#5d6d7e'}}>{'empty'}</div>
                ) : snap.stack.slice().reverse().map(e => (
                    <div key={e.addr}>
                        <span style={{color: '#7f8c8d'}}>{`${hex8(e.addr)} `}</span>
                        <span style={{color: e.addr === snap.regs.sp ? '#f39c12' : '#ecf0f1'}}>
                            {hex8(e.value)}
                        </span>
                    </div>
                ))}
            </div>
        );
    }

    renderMemory () {
        const {runner} = this.props;
        const snap = runner.inspect();
        const capabilities = this.props.ui && this.props.ui.debugCapabilities;
        const spacesDeclared = memorySpacesDeclared(this.props.ui && this.props.ui.capabilities);
        const spaces = memorySpaces(capabilities,
            snap && snap.flavor === 'generic' ? MACHINE_SPACES : SPACES, spacesDeclared);
        const spec = spaces.find(s => s.id === this.state.space) || spaces[0];
        if (!spec) return <div style={PANE}>Memory inspection is unavailable for this target.</div>;
        const page = memoryPage(spec, this.state.page) ? this.state.page : 0;
        const result = readMemoryPage(runner, spec, page);
        const {start, length, pages} = memoryPage(spec, page);
        const rows = [];
        for (let i = 0; i < result.bytes.length; i += 16) {
            rows.push({addr: start + i, data: result.bytes.slice(i, i + 16)});
        }
        const address = value => formatMemoryAddress(value, spec);
        const writable = memoryWritable(spec, this.props.ui && this.props.ui.phase);
        const session = {runner, capabilities, spacesDeclared};
        const current = () => ({runner: this.props.runner, capabilities: this.props.ui?.debugCapabilities,
            spacesDeclared: memorySpacesDeclared(this.props.ui?.capabilities), mounted: this.memoryViewMounted === true});

        return (
            <div style={{...PANE, maxHeight: 240}}>
                <div style={{...TITLE, display: 'flex', gap: 8, alignItems: 'center'}}>
                    <span>{this.tx('memory')}</span>
                    <select
                        value={spec.id}
                        onChange={e => this.setState({space: e.target.value, page: 0, memoryError: null})}
                        style={{...BTN, textTransform: 'none'}}
                    >
                        {spaces.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                    <button
                        style={BTN}
                        disabled={page === 0}
                        onClick={() => this.setState({page: Math.max(0, page - 1), memoryError: null})}
                    >{'◀'}</button>
                    <span>{`${address(start)}–${address(start + length - 1)}`}</span>
                    <button style={BTN} onClick={async () => {
                        const raw = await promptAsync('Memory address (hex)', address(start));
                        if (raw === null || !memorySessionCurrent(session, current())) return;
                        const next = memoryJump(spec, raw);
                        this.setState(next === null ? {memoryError: 'Address is outside the declared space'} :
                            {space: spec.id, page: next, memoryError: null});
                    }}>Go to address</button>
                    <button
                        style={BTN}
                        disabled={page >= pages - 1}
                        onClick={() => this.setState({page: Math.min(pages - 1, page + 1), memoryError: null})}
                    >{'▶'}</button>
                </div>
                {result.error || this.state.memoryError ? <div role="alert" style={{color: '#e74c3c'}}>
                    {result.error || this.state.memoryError}
                </div> : null}
                {!writable ? <div>Read-only memory</div> : null}
                {snap && snap.flavor === '8051' ? (
                    <div style={{fontSize: 10, marginBottom: 4}}>{this.tx('memoryMarkers')}</div>
                ) : null}
                {rows.map(row => (
                    <div key={row.addr} style={{whiteSpace: 'nowrap'}}>
                        <span style={{color: '#3498db'}}>{`${address(row.addr)}  `}</span>
                        {row.data.map((b, i) => {
                            const help = memoryByteHelp({space: spec.id, address: row.addr + i,
                                value: b, snapshot: snap, locale: this.props.locale});
                            return (
                            <span
                                key={i}
                                role={writable ? 'button' : undefined}
                                tabIndex={-1}
                                data-memory-byte={`${spec.id}:${address(row.addr + i)}`}
                                data-memory-markers={help.markers.join(' ')}
                                title={`${help.title}\n${writable ? this.tx('editHint') : 'read-only'}`}
                                style={{color: b ? '#ecf0f1' : '#4a5568', cursor: writable ? 'pointer' : 'default',
                                    padding: '0 2px', ...memoryByteMarkerStyle(help.markers)}}
                                onClick={async () => {
                                    if (!writable) return;
                                    const raw = await promptAsync(
                                        `${spec.label} ${address(row.addr + i)}`, hex8(b));
                                    if (raw === null || !memorySessionCurrent(session, current()) ||
                                        !memoryWritable(spec, this.props.ui?.phase)) return;
                                    const v = /^[0-9a-f]{1,2}$/i.test(String(raw).replace(/^0x/i, '')) ?
                                        parseInt(String(raw).replace(/^0x/i, ''), 16) : NaN;
                                    if (Number.isFinite(v)) {
                                        const outcome = runner.writeMem(spec.id, row.addr + i, v);
                                        this.setState({memoryError: outcome && (outcome.unsupported || outcome.refused) || null});
                                        this.forceUpdate();
                                    }
                                }}
                            >{hex8(b)}</span>
                            );
                        })}
                    </div>
                ))}
                {/* The trap §6 names: these two spaces overlap numerically and
                    are different memories. A hex view that does not say so
                    invites reading one and believing the other. */}
                {spec.id === 'sfr' || spec.id === 'iram' ? (
                    <div style={{color: '#5d6d7e', marginTop: 6, fontSize: 10}}>
                        {this.tx('spaceNote')}
                    </div>
                ) : null}
            </div>
        );
    }

    renderClock () {
        const snap = this.props.runner.inspect();
        if (!snap) return null;
        const ms = Number(snap.tNs) / 1e6;
        const hz = this.props.clockHz || 11059200;
        // The TUI shows "Cycles"; this emulator counts nanoseconds, so cycles
        // are derived rather than read. Stated, not silently presented as if
        // counted.
        const cycles = Math.round((Number(snap.tNs) / 1e9) * hz);
        return (
            <div style={PANE}>
                <div style={TITLE}>{this.tx('clock')}</div>
                <div>{`${ms.toFixed(3)} ${this.tx('ms')}`}</div>
                <div style={{color: '#7f8c8d'}}>
                    {`${cycles.toLocaleString()} ${this.tx('cycles')} @ ${(hz / 1e6).toFixed(3)} MHz`}
                </div>
            </div>
        );
    }

    render () {
        const {runner} = this.props;
        if (!runner) return null;
        const {open} = this.state;
        return (
            <div style={{marginTop: 8}}>
                <button
                    style={{...BTN, width: '100%', textAlign: 'left', padding: '6px 10px'}}
                    onClick={this.toggle}
                >
                    {open ? '▾ ' : '▸ '}
                    {this.tx('title')}
                </button>
                {!open ? null : (
                    <div style={{display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8}}>
                        {this.renderControls()}
                        {this.renderWatchpoints()}
                        {this.renderCode()}
                        {this.renderTrace()}
                        <div style={{display: 'grid', gap: 8,
                            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))'}}>
                            {this.renderNow()}
                            {this.renderSfrs()}
                            {this.renderStack()}
                            {this.renderClock()}
                        </div>
                        {this.renderMemory()}
                    </div>
                )}
            </div>
        );
    }
}

DebugDrawer.propTypes = {
    runner: PropTypes.object,
    ui: PropTypes.object,
    locale: PropTypes.string,
    clockHz: PropTypes.number
};

export {DebugDrawer};
export default DebugDrawer;
