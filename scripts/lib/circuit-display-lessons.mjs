// SPDX-License-Identifier: BSD-3-Clause

const meterIds = new Set(['73-voltmeter', '74-ammeter', '75-battery-tester', 'disp-bargraph']);

const lcdScenarios = {
    '49-lcd-hello': {title: 'HI BRICKWRIGHT', first: 'COUNT: 0', second: 'COUNT: 1'},
    'disp-lcd': {title: 'LCD DEMO', first: 'Count: 0', second: 'Count: 1'}
};
const oledScenarios = {
    '55-oled-hello': {text: [[0, 0, 'HI BRICKWRIGHT'], [1, 0, 'COUNT:']], counter: [1, 7], period: 1000},
    '72-pico-oled-hello': {text: [[2, 3, 'HELLO'], [4, 2, 'FROM PICO']]},
    'disp-oled': {text: [[0, 0, 'OLED DEMO'], [2, 0, 'Brickwright'], [4, 0, 'Count: ']], counter: [4, 7], period: 500},
    'disp-mono-lcd': {text: [[0, 0, 'MONO LCD'], [4, 0, 'Frame: ']], counter: [4, 7], period: 1000}
};

function check (checks, name, expected, observed) {
    checks.push({check: name, expected, observed, ok: JSON.stringify(observed) === JSON.stringify(expected)});
}

function findPart (circuit, kind) {
    return circuit.parts.find(part => part.kind === kind)?.id;
}

async function oledText (state, row, column, expected = ' '.repeat(16 - column)) {
    if (!state?.displayOn || !state.fb) return null;
    const {FUNSCII} = await import('bw-board/funscii-font.js');
    let text = '';
    for (let index = 0; index < expected.length; index++) {
        const offset = 128 * row + 8 * (column + index);
        const columns = state.fb.subarray(offset, offset + 8);
        const glyph = Array.from({length: 8}, (_, y) =>
            columns.reduce((bits, value, x) => bits | (((value >> y) & 1) << x), 0));
        const matches = code => glyph.every((bits, y) => bits === FUNSCII[code * 8 + y]);
        const expectedCode = expected.charCodeAt(index);
        if (matches(expectedCode)) {
            text += expected[index];
        } else {
            const ascii = Array.from({length: 95}, (_, i) => i + 32).find(matches);
            text += ascii === undefined ? '�' : String.fromCharCode(ascii);
        }
    }
    return text;
}

function checkRange (checks, name, target, tolerance, observed) {
    checks.push({check: name, expected: target, tolerance, observed: Number.isFinite(observed) ? observed : null,
        ok: Number.isFinite(observed) && Math.abs(observed - target) <= tolerance});
}

async function inspectMeter (id, circuit, until, now, state, checks) {
    if (id === '75-battery-tester') {
        for (const [volts, label] of [[1.45, 'FULL'], [1.30, 'GOOD'], [1.10, 'WEAK'], [0.90, 'DEAD']]) {
            circuit.setPartParam('cell1', 'volts', volts);
            await until(now() + 600);
            const oled = state('ssd1306');
            check(checks, `battery verdict for ${volts} V`, label, await oledText(oled, 5, 2, label));
        }
        return;
    }
    const pot = findPart(circuit, 'potentiometer');
    if (!pot) throw new Error('Missing meter input potentiometer');
    if (id === 'disp-bargraph') {
        for (const [position, expected] of [[0, 0], [0.5, 4], [1, 8]]) {
            circuit.setControl(pot, position);
            await until(now() + 150);
            const stateBar = state('bargraph');
            const active = stateBar?.brightness.map(value => value >= 0.02) ?? null;
            const expectedActive = Array.from({length: 10}, (_, segment) => segment < expected);
            check(checks, `bargraph segments at ${position * 100}%`, expectedActive, active);
        }
        return;
    }
    for (const position of [0, 0.5, 1]) {
        circuit.setControl(pot, position);
        await until(now() + 260);
        const voltmeter = id === '73-voltmeter';
        const title = voltmeter ? 'VOLTMETER' : 'AMMETER';
        const screen = voltmeter ? state('ssd1306') : state('char_lcd_i2c');
        const seenTitle = voltmeter ? await oledText(screen, 0, 0, title) : screen?.display?.[0]?.trim();
        check(checks, 'title at ' + position, title, seenTitle ?? null);
        const seen = voltmeter ? await oledText(screen, 3, 3) : screen?.display?.[1];
        const units = voltmeter ? 'mV' : 'mA';
        const match = (voltmeter ? /^(\d+) mV *$/ : /^(\d+\.\d) mA *$/).exec(seen || '');
        checks.push({check: `visible ${units} value and unit at ${position}`,
            expected: voltmeter ? 'whole mV' : 'mA with one decimal place', observed: seen?.trim() ?? null, ok: Boolean(match)});
        const board = circuit.board;
        const wiper = board.getNets().find(net => net.terminals.some(t => t.part === pot && t.terminal === 'wiper'));
        const actual = voltmeter ? board.nodeVoltage(wiper.id) * 1000 : Math.abs(board.branchCurrent('shunt1', 'a')) * 1000;
        const ideal = voltmeter ? position * 5000 : 5000 / (Math.max(1, 1000 * (1 - position)) + 10);
        checkRange(checks, `circuit at ${position * 100}%`, ideal, voltmeter ? 6 : 0.1, actual);
        // The 5 V / 10-bit ADC quantizes to 4.89 mV; the display then rounds to 1 mV.
        const toleranceMv = 5000 / 1023 / 2 + 0.5;
        checkRange(checks, `displayed measurement at ${position * 100}%`, actual,
            voltmeter ? toleranceMv : toleranceMv / 10, match ? Number(match[1]) : NaN);
    }
}

async function inspectDisplay (id, circuit, vm, stepFrames) {
    let now = 0;
    vm.runtime.updateCurrentMSecs = () => { vm.runtime.currentMSecs = now; };
    vm.runtime.updateCurrentMSecs();
    vm.runtime.ioDevices.clock.resetProjectTimer();
    const start = circuit.board.getTime();
    const stepMs = 25;
    async function until (end) {
        for (; now <= end; now += stepMs) {
            await stepFrames(vm, 1, stepMs);
            circuit.advanceTo(start + BigInt(now + stepMs) * 1_000_000n);
        }
    }
    const state = kind => circuit.board.getDeviceState(findPart(circuit, kind));
    const checks = [];
    await until(100);
    const lcd = lcdScenarios[id];
    const oled = oledScenarios[id];
    if (meterIds.has(id)) {
        await inspectMeter(id, circuit, until, () => now, state, checks);
    } else if (lcd) {
        const observed = state('char_lcd_i2c');
        check(checks, 'backlight', true, observed?.backlight ?? null);
        check(checks, 'LCD title', lcd.title, observed?.display?.[0]?.trim() ?? null);
        check(checks, 'LCD counter starts at zero', lcd.first, observed?.display?.[1]?.trim() ?? null);
        await until(1150);
        check(checks, 'LCD counter increments', lcd.second, state('char_lcd_i2c')?.display?.[1]?.trim() ?? null);
    } else if (oled) {
        const observed = state('ssd1306');
        for (const [row, column, text] of oled.text) {
            check(checks, `OLED glyphs at row ${row}, column ${column}`, text, await oledText(observed, row, column, text));
        }
        if (oled.counter) {
            check(checks, 'OLED counter starts at zero', '0', await oledText(observed, ...oled.counter, '0'));
            await until(oled.period + 150);
            check(checks, 'OLED counter increments', '1', await oledText(state('ssd1306'), ...oled.counter, '1'));
        }
    } else if (id === '51-tft-pixels') {
        const observed = state('ili9341');
        for (const [x, y, pixel] of [[10, 10, 0xf800], [109, 69, 0xf800], [70, 130, 0x07e0],
            [130, 250, 0x001f], [120, 160, 0xffff], [9, 10, 0]]) {
            check(checks, `TFT RGB565 pixel at ${x},${y}`, pixel, observed?.gram?.[y * 240 + x] ?? null);
        }
        check(checks, 'TFT enabled', true, Boolean(observed?.displayOn && !observed.sleeping));
    } else {
        const part = findPart(circuit, 'seven_segment');
        const expected = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f, 0x3f];
        const observed = [];
        for (let digit = 0; digit < expected.length; digit++) {
            await until(150 + 1025 * digit);
            const segments = circuit.board.sevenSegmentBrightness(part);
            observed.push([...'abcdefg'].reduce((mask, name, bit) => segments[name] >= 0.02 ? mask | (1 << bit) : mask, 0));
        }
        check(checks, 'lit seven-segment masks for digits 0–9 and rollover', expected, observed);
    }
    return checks;
}

export async function checkDisplayLesson (bench, circuit, examples, startProgram) {
    const {id} = bench;
    if (!meterIds.has(id) && !lcdScenarios[id] && !oledScenarios[id] && id !== '51-tft-pixels' && id !== 'disp-sevenseg') return null;
    let vm;
    try {
        const runtime = await startProgram(bench, circuit, examples, value => { vm = value; });
        const checks = await inspectDisplay(id, circuit, vm, runtime.stepFrames);
        if (runtime.errors.length) throw new Error(runtime.errors.join(', '));
        return {status: checks.every(result => result.ok) ? 'pass' : 'fail', checks};
    } finally {
        vm?.stopAll();
        vm?.quit();
    }
}
