// SPDX-License-Identifier: BSD-3-Clause

const peripheral = {
    '53-servo-sweep': 'servo',
    '60-retro-console': 'matrix8x8',
    '61-console-pong': 'matrix8x8',
    '77-keypad-keyshow': 'keypad_4x4',
    '79-a2-sampler': 'keypad_4x4',
    '80-a2-lcd-moving-text': 'char_lcd',
    '81-8051-lcd1602-parallel': 'char_lcd',
    '82-a2-led-row': 'ledbank8',
    'disp-led-matrix': 'max7219',
    'disp-rgb-light': 'neopixel'
};

export async function checkPeripheralLesson (bench, circuit, examples, startProgram) {
    const {id} = bench;
    if (!Object.hasOwn(peripheral, id)) return null;
    const {board} = circuit;
    const parts = kind => circuit.parts.filter(part => part.kind === kind);
    const component = parts(peripheral[id])[0];
    if (!component) throw new Error(`Missing ${peripheral[id]} on ${id}`);
    const device = () => board.getDeviceState(component.id);
    const checks = [];
    function measure (check, expected, observed, ok = JSON.stringify(observed) === JSON.stringify(expected)) {
        checks.push({check, expected, observed, ok});
    }
    let vm;
    try {
        const runtime = await startProgram(bench, circuit, examples, value => { vm = value; });
        let now = 0;
        vm.runtime.updateCurrentMSecs = () => { vm.runtime.currentMSecs = now; };
        vm.runtime.updateCurrentMSecs();
        vm.runtime.ioDevices.clock.resetProjectTimer();
        const start = board.getTime();
        async function step (ms, stepMs = 5) {
            for (const end = now + ms; now < end; now += stepMs) {
                await runtime.stepFrames(vm, 1, stepMs);
                circuit.advanceTo(start + BigInt(now + stepMs) * 1_000_000n);
            }
        }
        if (id === '53-servo-sweep') {
            const pin = board.nets.find(net => net.terminals.some(term =>
                term.part === component.id && term.terminal === 'signal'))?.terminals.find(term => term.part !== component.id);
            const samples = [];
            let decodedPulses = false;
            let maxActualAngle = 0;
            for (let index = 0; index < 780; index++) {
                await step(5);
                const servo = device();
                const angle = servo?.targetAngle ?? null;
                const pulse = board.getPwm(pin?.terminal);
                decodedPulses ||= servo?.signal === 'pulse';
                maxActualAngle = Math.max(maxActualAngle, servo?.actualAngle ?? 0);
                if (samples.at(-1)?.angle !== angle) {
                    samples.push({angle, hz: pulse?.hz ?? null, pulseUs: pulse ? Math.round(pulse.duty / pulse.hz * 1e6) : null});
                }
                if (angle === 0 && samples.some(sample => sample.angle === 180)) break;
            }
            const expected = [...Array.from({length: 18}, (_, index) => (index + 1) * 10),
                ...Array.from({length: 18}, (_, index) => 170 - index * 10)];
            measure('servo sweeps up and back through the full travel', expected, samples.map(sample => sample.angle));
            const widths = [samples.at(-1)?.pulseUs ?? null,
                samples.find(sample => sample.angle === 90)?.pulseUs ?? null,
                samples.find(sample => sample.angle === 180)?.pulseUs ?? null];
            const calibrated = [500, 1500, 2500];
            measure('wired servo pulse widths at 0°, 90° and 180° in microseconds', calibrated, widths,
                widths.every((value, index) => value !== null && Math.abs(value - calibrated[index]) <= 15));
            measure('the servo decodes its wired 50 Hz signal', true,
                decodedPulses && samples.every(sample => sample.hz === 50));
            measure('the horn reaches full travel after the control pulse', 180, maxActualAngle, maxActualAngle >= 179);
            measure('chip aggregate-current warnings', [], board.getWarnings().filter(warning =>
                warning.type === 'aggregate-current').map(warning => warning.message));
        } else if (id === '77-keypad-keyshow' || id === '79-a2-sampler') {
            const shown = () => {
                if (id === '79-a2-sampler') {
                    const display = parts('sevenseg8')[0];
                    return board.getDeviceState(display?.id)?.text?.join('').trim() ?? null;
                }
                const display = parts('seven_segment')[0];
                const segments = board.sevenSegmentBrightness(display?.id);
                return Array.from('abcdefg').reduce((mask, name, i) => segments[name] >= 0.02 ? mask | (1 << i) : mask, 0);
            };
            const expected = id === '79-a2-sampler' ? ['0', '6', '6', '14', '14', '0', '0'] :
                [0, 0x06, 0x06, 0x5b, 0x4f, 0x77, 0x66, 0x6d, 0x7d, 0x7c, 0x07, 0x7f, 0x6f, 0x39, 0x5e, 0x3f, 0x79, 0x71];
            const keys = id === '79-a2-sampler' ? [-1, 6, -1, 14, -1, 12, -1] :
                [-1, 0, -1, ...Array.from({length: 15}, (_, index) => index + 1)];
            const values = [];
            for (const key of keys) {
                circuit.setPartParam(component.id, 'pressed', key);
                await step(160);
                values.push(shown());
            }
            measure('display follows physical keypad presses and holds after release', expected, values);
            if (id === '79-a2-sampler') {
                const hash = vm.runtime.getTargetForStage()?.lookupVariableByNameAndType('hash_seen', '')?.value;
                measure('physical # key fires its handler', 1, Number(hash));
            }
        } else if (id === '80-a2-lcd-moving-text' || id === '81-8051-lcd1602-parallel') {
            await step(100);
            const lines = () => device()?.text?.map(text => text.trimEnd()) ?? null;
            const rawLines = () => {
                const data = device()?.ddram;
                return data ? [0, 40].map(offset => String.fromCharCode(...data.slice(offset, offset + 16)).trimEnd()) : null;
            };
            if (id === '80-a2-lcd-moving-text') {
                const first = lines();
                await step(1250);
                measure('animated LCD text starts at the left', ['BRICKWRIGHT', 'PRECHIN A2'], first);
                measure('animated LCD text moves five columns', ['     BRICKWRIGHT', 'PRECHIN A2'], lines());
                measure('the LCD character RAM contains the final text', ['     BRICKWRIGHT', 'PRECHIN A2'], rawLines());
            } else {
                measure('parallel LCD displays two lines', ['8051 + LCD1602', '4-BIT PARALLEL'], lines());
                measure('the LCD character RAM contains both lines', ['8051 + LCD1602', '4-BIT PARALLEL'], rawLines());
            }
        } else if (id === '82-a2-led-row') {
            const seen = [];
            for (let index = 0; index <= 8; index++) {
                await step(index === 0 ? 30 : 155);
                seen.push(device()?.leds.reduce((mask, value, bit) => mask | (value << bit), 0) ?? null);
            }
            measure('one LED moves across eight outputs and wraps', [1, 2, 4, 8, 16, 32, 64, 128, 1], seen);
        } else if (id === 'disp-led-matrix') {
            await step(80);
            const initial = device()?.digits?.slice() ?? null;
            await step(200);
            measure('first complete scan line lights', [255, 0, 0, 0, 0, 0, 0, 0], initial);
            measure('the scan line advances after 200 ms', [0, 255, 0, 0, 0, 0, 0, 0], device()?.digits ?? null);
            measure('LED driver is awake', false, device()?.shutdown ?? null);
        } else if (id === 'disp-rgb-light') {
            const colors = () => parts('neopixel').map(part => board.getDeviceState(part.id)?.pixels[0] ?? null);
            await step(20);
            const first = colors();
            await step(55);
            measure('three pixels start red, blue and green', [0xff0000, 0x0000ff, 0x00ff00], first);
            measure('three pixels change color after 50 ms', [0xfa0503, 0x0503fa, 0x03fa05], colors());
        } else {
            const matrix = parts('matrix8x8');
            const live = matrix.map(() => new Set());
            const display = parts('seven_seg_3')[0];
            const scoreDigits = new Set();
            const sampleFrames = id === '60-retro-console' ? 180 : 120;
            for (let tick = 0; tick < sampleFrames; tick++) {
                await step(5);
                matrix.forEach((part, index) => board.getDeviceState(part.id)?.levels.forEach((level, pixel) => {
                    if (level) live[index].add(pixel);
                }));
                if (display && id === '60-retro-console') {
                    const bits = board.sevenSeg3Brightness(display.id).map(segments =>
                        Array.from('abcdefg').reduce((mask, name, bit) => segments[name] >= 0.02 ? mask | (1 << bit) : mask, 0));
                    const digit = bits.findIndex(mask => mask === 0x7f);
                    if (digit >= 0 && bits.every((mask, index) => index === digit || mask === 0)) scoreDigits.add(digit);
                }
            }
            const counts = live.map(pixels => pixels.size);
            if (id === '60-retro-console') {
                measure('self-test sweeps all pixels on both wired matrix halves', [64, 64], counts);
                measure('self-test displays 8 on each score digit independently', [0, 1, 2], [...scoreDigits].sort());
                const buzzer = parts('buzzer')[0];
                const button = parts('button')[0];
                if (!buzzer || !button) throw new Error('Missing wired button or buzzer');
                circuit.setControl(button.id, 1);
                const held = [];
                for (let frame = 0; frame < 80; frame++) {
                    await step(10);
                    held.push(board.buzzerTone(buzzer.id).on);
                }
                measure('held button activates buzzer', true, held.includes(true));
                circuit.setControl(button.id, 0);
                await step(120);
                const released = [];
                for (let frame = 0; frame < 80; frame++) {
                    await step(10);
                    released.push(board.buzzerTone(buzzer.id).on);
                }
                measure('releasing button silences buzzer', true, released.every(on => !on));
            } else {
                measure('Pong changes multiple pixels on each wired matrix half', 'at least two on each half',
                    counts, counts.length === 2 && counts.every(count => count >= 2));
                const pad = () => vm.runtime.getTargetForStage()?.lookupVariableByNameAndType('padX', '')?.value;
                const buttons = parts('button');
                const initial = Number(pad());
                circuit.setControl(buttons[1]?.id, 1);
                await step(420);
                circuit.setControl(buttons[1]?.id, 0);
                const left = Number(pad());
                circuit.setControl(buttons[2]?.id, 1);
                await step(420);
                circuit.setControl(buttons[2]?.id, 0);
                const right = Number(pad());
                measure('wired left and right inputs move the paddle', 'left < initial and right > left',
                    {initial, left, right}, left < initial && right > left);
            }
        }
        if (runtime.errors.length) throw new Error(runtime.errors.join(', '));
        return {status: checks.every(result => result.ok) ? 'pass' : 'fail', checks};
    } finally {
        vm?.stopAll();
        vm?.quit();
    }
}
