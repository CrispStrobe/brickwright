// Run a CrispBASIC program on the pinned, unmodified PicoBB firmware inside
// bw-board's rp2040js RP2040 emulator, with a wired Circuit netlist, and
// observe what the emulated chip actually does.
//
// The evidence comes from the emulator, not from the BASIC program: pad
// state changes are rp2040js GPIOPinState listener events stamped with the
// emulator clock, the time origin is the CPU's own read of the RP2040 TIMER
// (TIMERAWL) that the library performs when a run first uses it, electrical
// effects are read from bw-board's circuit solver, and program output is the
// UART0 transcript. The program is entered exactly as Brickwright's Pico
// route types it: one line per PicoBB prompt, then RUN.
import {parseUF2, FLASH_BASE} from 'bw-board/uf2.js';
import {createRp2040jsAdapter} from 'bw-board/rp2040js-adapter.js';
import {BoardImpl} from 'bw-board/board.js';
import {registerBoardKinds} from 'bw-board/devices/board-kinds.js';
import {GPIOPinState} from 'rp2040js';
import {crispBasicPicoProgram, PICOBB_CRISPBASIC_PINS} from
    '../../packages/crisp-basic/pico/picobb-library.mjs';

const CLOCK_HZ = 125_000_000;
const TIMERAWL = 0x28;
const STEP_NS = 1_000_000;
const ansi = /\x1b\[[\d;?]*[A-Za-z]/g;
const visible = text => text.replace(ansi, '');
const atPrompt = text => /(^|\n)>$/.test(visible(text));

let registered = false;

/** A small, explicit pi_pico circuit: the Pico part plus whatever loads the caller lists. */
export function picoCircuit ({leds = [], buttons = []} = {}) {
    if (!registered) {
        registerBoardKinds();
        registered = true;
    }
    const board = new BoardImpl(3.3);
    const terminals = ['gnd_1', ...leds.map(pin => `gp${pin}`), ...buttons.map(pin => `gp${pin}`)];
    const parts = [{id: 'pico', kind: 'pi_pico', terminals, params: {}},
        {id: 'ground', kind: 'gnd', terminals: ['gnd'], params: {}}];
    const groundNet = {id: 'ground', terminals: [{part: 'pico', terminal: 'gnd_1'}, {part: 'ground', terminal: 'gnd'}]};
    const nets = [groundNet];
    for (const pin of leds) {
        parts.push({id: `R${pin}`, kind: 'resistor', terminals: ['a', 'b'], params: {ohms: 330}},
            {id: `LED${pin}`, kind: 'led', terminals: ['anode', 'cathode'], params: {vf: 2}});
        nets.push({id: `drive${pin}`, terminals: [{part: 'pico', terminal: `gp${pin}`}, {part: `R${pin}`, terminal: 'a'}]},
            {id: `light${pin}`, terminals: [{part: `R${pin}`, terminal: 'b'}, {part: `LED${pin}`, terminal: 'anode'}]});
        groundNet.terminals.push({part: `LED${pin}`, terminal: 'cathode'});
    }
    for (const pin of buttons) {
        parts.push({id: `KEY${pin}`, kind: 'button', terminals: ['a', 'b'], params: {}});
        nets.push({id: `sense${pin}`, terminals: [{part: 'pico', terminal: `gp${pin}`}, {part: `KEY${pin}`, terminal: 'a'}]});
        groundNet.terminals.push({part: `KEY${pin}`, terminal: 'b'});
    }
    board.setNetlist(parts, nets);
    board.setPower(true);
    return board;
}

/**
 * @param {object} options
 * @param {Uint8Array} options.uf2   the pinned PicoBB console UF2 (with its LittleFS image)
 * @param {string} options.source    CrispBASIC source, exactly as authored
 * @param {object} [options.circuit] {leds, buttons} for picoCircuit
 * @param {{atMs: number, button: number, pressed: boolean}[]} [options.stimuli]
 *        button actions at absolute times after the library's time origin
 * @param {number} [options.maxRunMs] emulated milliseconds allowed after RUN
 */
export function runCrispBasicOnEmulatedPico ({uf2, source, circuit = {}, stimuli = [], maxRunMs = 20_000}) {
    const {base, image} = parseUF2(uf2);
    if (base !== FLASH_BASE) throw new Error('not a pico-sdk flash UF2');
    const {commands} = crispBasicPicoProgram(source);
    const board = picoCircuit(circuit);
    const adapter = createRp2040jsAdapter({clockHz: CLOCK_HZ, vcc: 3.3});
    adapter.attachBoard(board);
    const {rp2040} = adapter;
    const uart = rp2040.uart[0];
    const pending = [];
    let out = '';
    let probe = '';
    adapter.onSerial(byte => {
        const ch = String.fromCharCode(byte);
        probe = (probe + ch).slice(-4);
        // The same VT100 cursor-report answer the GUI's terminal gives PicoBB.
        if (probe === '\x1b[6n') {
            pending.push(...'\x1b[24;80R');
            probe = '';
        }
        out += ch;
    });
    adapter.bootFromFlash(image);

    const nowNs = () => Number(adapter.timeNs());
    const pinEvents = [];
    for (let pin = 0; pin <= 29; pin++) {
        // Registered after attachBoard's listener, so the solver has already
        // received this edge: the recorded voltage/current is its solution.
        rp2040.gpio[pin].addListener(state => pinEvents.push({ns: nowNs(), pin, state: GPIOPinState[state],
            volts: board.readAnalog(`gp${pin}`),
            ledMilliamps: circuit.leds?.includes(pin) ? Math.abs(board.branchCurrent(`LED${pin}`, 'anode')) * 1000 : null}));
    }
    // The library's first call in a run configures every admitted pin as a
    // plain SIO input and then reads the timer once; that read is the run's
    // time origin. Identify it from chip state, not from BASIC output: the
    // first TIMERAWL read after RUN at which all admitted pins are SIO
    // inputs without pulls. Stimuli are then scheduled relative to it.
    const timer = rp2040.peripherals[0x40054];
    const readTimer = timer.readUint32.bind(timer);
    let watching = false;
    let originNs = null;
    let originUs = null;
    let initialStates = null;
    let scheduled = [];
    const initialized = () => PICOBB_CRISPBASIC_PINS.every(pin => {
        const gpio = rp2040.gpio[pin];
        return gpio.functionSelect === 5 && !gpio.outputEnable && !gpio.pullupEnabled && !gpio.pulldownEnabled;
    });
    timer.readUint32 = offset => {
        const value = readTimer(offset);
        if (watching && originNs === null && offset === TIMERAWL && initialized()) {
            originNs = nowNs();
            originUs = value;
            initialStates = Object.fromEntries(PICOBB_CRISPBASIC_PINS.map(pin =>
                [pin, GPIOPinState[rp2040.gpio[pin].value]]));
            scheduled = stimuli.map(item => ({...item, ns: originUs * 1000 + item.atMs * 1e6}))
                .sort((a, b) => a.ns - b.ns);
        }
        return value;
    };

    const advanceTo = targetNs => {
        while (nowNs() < targetNs) {
            while (pending.length && uart.rxFIFO.empty) {
                for (let k = 0; k < 16 && pending.length; k++) uart.feedByte(pending.shift().charCodeAt(0));
            }
            let next = Math.min(targetNs, nowNs() + STEP_NS);
            if (scheduled.length) next = Math.min(next, scheduled[0].ns);
            adapter.advanceNs(Math.max(1, next - nowNs()));
            while (scheduled.length && scheduled[0].ns <= nowNs()) {
                const action = scheduled.shift();
                board.setControl(`KEY${action.button}`, action.pressed ? 1 : 0);
                adapter.syncInputs();
                action.appliedNs = nowNs();
            }
        }
    };
    const until = (predicate, maxMs, what) => {
        const end = nowNs() + maxMs * 1e6;
        while (!predicate()) {
            if (nowNs() >= end) throw new Error(`emulated Pico timed out ${what}: ${JSON.stringify(visible(out).slice(-400))}`);
            advanceTo(nowNs() + STEP_NS);
        }
    };

    until(() => out.includes('Waiting for connection'), 3000, 'before its console wait');
    pending.push('\r');
    until(() => atPrompt(out), 5000, 'before its first prompt');
    const banner = visible(out);
    for (const command of commands.slice(0, -1)) {
        const mark = out.length;
        pending.push(...command + '\r');
        until(() => out.length > mark + command.length && atPrompt(out.slice(mark)), 5000, `entering ${JSON.stringify(command)}`);
        // The 80-column terminal wraps a long echo; the line itself is one record.
        const echo = visible(out.slice(mark)).replace(/\r\n/g, '');
        if (!echo.startsWith(command)) throw new Error(`PicoBB did not echo ${JSON.stringify(command)}: ${JSON.stringify(echo)}`);
        if (echo.slice(command.length) !== '>') throw new Error(`PicoBB rejected ${JSON.stringify(command)}: ${JSON.stringify(echo)}`);
    }
    const runMark = out.length;
    const runNs = nowNs();
    const eventMark = pinEvents.length;
    pending.push(...'RUN\r');
    watching = true;
    const end = runNs + maxRunMs * 1e6;
    let finished = false;
    while (nowNs() < end) {
        advanceTo(nowNs() + STEP_NS);
        if (atPrompt(out.slice(runMark + 4))) {
            finished = true;
            break;
        }
    }
    const transcript = visible(out.slice(runMark));
    const programOutput = transcript.replace(/^RUN\r\n/, '').replace(/>$/, '');
    const runEvents = pinEvents.slice(eventMark);
    const afterOrigin = originNs === null ? [] : runEvents.filter(event => event.ns >= originNs);
    return {
        finished,
        banner,
        commands,
        programOutput,
        runMachineMs: (nowNs() - runNs) / 1e6,
        originUs,
        initialStates,
        events: afterOrigin.map(({ns, ...event}) => ({...event, sinceOriginUs: ns / 1000 - originUs})),
        stimuli: scheduled,
        board
    };
}

/** Collapse emulator events to per-pin state changes, in time order. */
export function collapseTransitions (events, initialStates) {
    const last = new Map(Object.entries(initialStates).map(([pin, state]) => [Number(pin), state]));
    const result = [];
    for (const event of events) {
        if (last.get(event.pin) === event.state) continue;
        last.set(event.pin, event.state);
        result.push(event);
    }
    return result;
}
