// Observable checks for the gallery's Scratch-VM route. Each lesson declares
// what the real board should do under specific user input.
import {readFile} from 'node:fs/promises';
import {readBenchProgram, checkDocumentedPhysics, checkDeclaredIO} from './circuit-functional-coverage.mjs';
import {join} from 'node:path';
import {checkCp1Lesson} from './circuit-cp1-lessons.mjs';
import {checkArduinoLesson} from './circuit-arduino-lessons.mjs';
import {checkDisplayLesson} from './circuit-display-lessons.mjs';
import {checkInductiveLesson} from './circuit-inductive-lesson.mjs';
import {checkPassiveLesson} from './circuit-passive-lessons.mjs';
import {checkWaveformLesson} from './circuit-waveform-lessons.mjs';
import {checkPeripheralLesson} from './circuit-peripheral-lessons.mjs';
import {checkReferenceLesson} from './circuit-reference-lessons.mjs';
import {checkDigitalLesson} from './circuit-digital-lessons.mjs';
import {check6502Bench, checkCardiacNightLight, checkWiredTrainer, checkZ80Bench} from './circuit-retro-lessons.mjs';

const logicChecks = (and) => ({
    sampleMs: 20,
    durationMs: 580,
    controls: [[0, 'BTN_btnA', 0], [0, 'BTN_btnB', 0], [120, 'BTN_btnA', 1],
        [240, 'BTN_btnB', 1], [360, 'BTN_btnA', 0], [480, 'BTN_btnB', 0]],
    checks: [{at: 80, lit: false}, {at: 200, lit: !and}, {at: 320, lit: true},
        {at: 440, lit: !and}, {at: 560, lit: false}]
});

const behaviors = {
    'i8086-blink': {
        led: 'led0', sampleMs: 20, durationMs: 1500,
        checks: [{at: 200, lit: true}, {at: 700, lit: false}, {at: 1200, lit: true}]
    },
    '01-blink': {
        sampleMs: 20,
        durationMs: 1650,
        checks: [{until: 1650, rises: 2, falls: 2}]
    },
    'arduino-01-blink': {
        led: 'led1', sampleMs: 40, durationMs: 2440,
        checks: [{at: 400, lit: true}, {at: 1400, lit: false}, {at: 2400, lit: true}]
    },
    'arduino-02-blink-without-delay': {
        led: 'led1', sampleMs: 40, durationMs: 2440,
        checks: [{at: 400, lit: false}, {at: 1400, lit: true}, {at: 2400, lit: false}]
    },
    'arduino-02-button': {
        led: 'led1', sampleMs: 20, durationMs: 560,
        controls: [[0, 'btn1', 0], [180, 'btn1', 1], [360, 'btn1', 0]],
        checks: [{at: 100, lit: false}, {at: 300, lit: true}, {at: 500, lit: false}]
    },
    'arduino-02-digital-input-pullup': {
        led: 'led1', sampleMs: 20, durationMs: 660,
        controls: [[0, 'btn1', 0], [200, 'btn1', 1], [420, 'btn1', 0]],
        checks: [{at: 140, lit: false}, {at: 360, lit: true}, {at: 600, lit: false}]
    },
    'arduino-02-debounce': {
        led: 'led1', sampleMs: 10, durationMs: 720,
        controls: [[0, 'btn1', 0], [120, 'btn1', 1], [140, 'btn1', 0],
            [250, 'btn1', 1], [410, 'btn1', 0], [540, 'btn1', 1]],
        checks: [{at: 100, lit: true}, {at: 210, lit: true}, {at: 360, lit: false}, {at: 500, lit: false}, {at: 660, lit: true}]
    },
    '03-night-light': {
        sampleMs: 20,
        durationMs: 660,
        controls: [[0, 'LDR_ldr', 1], [220, 'LDR_ldr', 0], [440, 'LDR_ldr', 1]],
        checks: [{at: 200, lit: false}, {at: 420, lit: true}, {at: 640, lit: false}]
    },
    '09-relay-clicker': {
        relay: 'RELAY_relay_ctrl',
        sampleMs: 50,
        durationMs: 4300,
        checks: [{at: 200, lit: true}, {at: 2200, lit: false}, {at: 4200, lit: true}]
    },
    'arduino-sk-p15-hacking-buttons': {
        led: 'LED_opto',
        sampleMs: 20,
        durationMs: 1100,
        checks: [{at: 200, lit: true}, {at: 700, lit: false}, {at: 1080, lit: true}]
    },
    '11-toggle-button': {
        sampleMs: 20,
        durationMs: 820,
        controls: [[0, 'BTN_btn', 0], [120, 'BTN_btn', 1], [300, 'BTN_btn', 0],
            [500, 'BTN_btn', 1], [680, 'BTN_btn', 0]],
        checks: [{at: 80, lit: false}, {at: 240, lit: true}, {at: 420, lit: true},
            {at: 620, lit: false}, {at: 800, lit: false}]
    },
    '17-comparator': {
        sampleMs: 20,
        durationMs: 580,
        controls: [[0, 'POT_potA', 0], [0, 'POT_potB', 1], [200, 'POT_potA', 1],
            [200, 'POT_potB', 0], [400, 'POT_potA', 0.5], [400, 'POT_potB', 0.5]],
        checks: [{at: 160, lit: false}, {at: 360, lit: true}, {at: 560, lit: false}]
    },
    '18-logic-and-gate': logicChecks(true),
    '19-logic-or-gate': logicChecks(false),
    '51-555-astable': {
        led: 'led1',
        usesProgram: false,
        sampleMs: 10,
        durationMs: 1100,
        checks: [{expectedPeriodMs: 208, toleranceMs: 35}]
    },
    '05-counter': {
        sampleMs: 20,
        durationMs: 2640,
        controls: [[200, 'BTN_button', 1], [1220, 'BTN_button', 0],
            [1400, 'BTN_button', 1], [1500, 'BTN_button', 0]],
        checks: [{until: 200, rises: 0, falls: 0}, {from: 200, until: 1400, rises: 1, falls: 1},
            {from: 1400, until: 2640, rises: 2, falls: 2}]
    }
};

async function startProgram ({device, program}, circuit, examples, observeVM) {
    if (!program) throw new Error('The functional scenario requires the gallery program');
    const {runCreatedProgram, stepFrames} = await import('../../test/helpers/bw-vm.mjs');
    const creator = await readBenchProgram({device, program}, examples);
    const validation = creator.validate();
    if (!validation.isValid) throw new Error(validation.errors.join(', '));
    const run = await runCreatedProgram(creator, {
        frames: 0,
        circuitBoard: circuit.board,
        observeRun: ({vm}) => observeVM(vm)
    });
    if (!run.greenFlagThreadsStarted) throw new Error('Green flag started no program threads');
    return {errors: run.errors, stepFrames};
}

async function checkCrtc80 (bench, circuit, examples) {
    const [{flatWire}, {extract6502Machine}, {createM6502Adapter}] = await Promise.all([
        import('bw-circuit-ui/model/wire-endpoints.js'),
        import('bw-board/m6502-extract.js'),
        import('bw-board/m6502-adapter.js')
    ]);
    const config = extract6502Machine({parts: circuit.parts, wires: circuit.wires.map(flatWire)});
    if (!config.ok) throw new Error(config.reasons.join(', '));
    const rom = await readFile(join(examples, bench.rom));
    const adapter = createM6502Adapter({config: {clockHz: 1_000_000, ...config}, rom});
    adapter.attachBoard(circuit.board);
    adapter.advanceNs(50_000_000);
    const frame = circuit.board.getDeviceState('crtc1').videoFrame();
    const observed = {
        width: frame?.width,
        height: frame?.height,
        lastCell: adapter.machine.mem[0x39ff],
        bottomRightLit: frame?.rgba?.some((value, offset) => {
            const pixel = offset >> 2;
            return (offset & 3) !== 3 && value > 0 && pixel % frame.width >= 632 && pixel / frame.width >= 248;
        }) ?? false
    };
    const expected = {width: 640, height: 256, lastCell: 43, bottomRightLit: true};
    const ok = Object.keys(expected).every(key => expected[key] === observed[key]);
    return {status: ok ? 'pass' : 'fail', checks: [{expected, observed, ok}]};
}

async function checkStarterMotor (bench, circuit, examples) {
    const reverses = bench.id === 'arduino-sk-p10-zoetrope';
    const controls = reverses ? ['BTN_btnFwd', 'BTN_btnRev'] : ['BTN_btn'];
    const motor = reverses ? 'MOTOR_zoetrope' : 'MOTOR_motor';
    if (reverses) circuit.setControl('POT_pot', 1);
    let vm;
    try {
        const runtime = await startProgram(bench, circuit, examples, value => { vm = value; });
        const start = circuit.board.getTime();
        let elapsedMs = 0;
        vm.runtime.updateCurrentMSecs = () => { vm.runtime.currentMSecs = elapsedMs; };
        async function measure (ms) {
            const end = elapsedMs + ms;
            while (elapsedMs < end) {
                elapsedMs += 20;
                await runtime.stepFrames(vm, 1, 20);
                circuit.advanceTo(start + BigInt(elapsedMs) * 1_000_000n);
            }
            const velocity = circuit.board.getDeviceState(motor)?.velocity;
            if (!Number.isFinite(velocity)) throw new Error(`Missing velocity for ${motor}`);
            return velocity;
        }
        const idle = await measure(60);
        circuit.setControl(controls[0], 1);
        const forward = await measure(80);
        const checks = [
            {expected: 'motor stopped before pressing the button', observed: idle, ok: Math.abs(idle) < 0.001},
            {expected: 'motor turns forward while the button is pressed', observed: forward, ok: forward > 0.01}
        ];
        circuit.setControl(controls[0], 0);
        if (reverses) {
            circuit.setControl(controls[1], 1);
            const reverse = await measure(140);
            circuit.setControl(controls[1], 0);
            checks.push({expected: 'motor reverses when the reverse button is pressed',
                observed: reverse, ok: reverse < -0.01});
        }
        const coast = await measure(100);
        const running = Math.abs(checks.at(-1).observed);
        checks.push({expected: 'motor slows when the button is released',
            observed: coast, ok: Math.abs(coast) < running - 0.01});
        if (runtime.errors.length) throw new Error(runtime.errors.join(', '));
        return {status: checks.every(check => check.ok) ? 'pass' : 'fail', checks};
    } finally {
        vm?.stopAll();
        vm?.quit();
    }
}

async function checkSiren (bench, circuit, examples) {
    const [buzzer, ...others] = circuit.board.getBuzzers();
    if (!buzzer || others.length) throw new Error('The siren lesson needs one buzzer');
    let vm;
    try {
        const runtime = await startProgram(bench, circuit, examples, value => { vm = value; });
        const start = circuit.board.getTime();
        let now = 0;
        vm.runtime.updateCurrentMSecs = () => { vm.runtime.currentMSecs = now; };
        vm.runtime.updateCurrentMSecs();
        vm.runtime.ioDevices.clock.resetProjectTimer();
        const changes = [];
        let previous = 0;
        for (; now <= 1180; now += 20) {
            await runtime.stepFrames(vm, 1, 20);
            circuit.advanceTo(start + BigInt(now + 20) * 1_000_000n);
            const tone = circuit.board.buzzerTone(buzzer);
            const hz = tone.on ? tone.hz : 0;
            if (hz !== previous) changes.push({ms: now, hz});
            previous = hz;
        }
        if (runtime.errors.length) throw new Error(runtime.errors.join(', '));
        const expected = [440, 880, 440];
        const checks = [
            {expected, observed: changes.map(change => change.hz),
                ok: changes.length === expected.length && changes.every(({hz}, i) => Math.abs(hz - expected[i]) <= expected[i] * 0.05)},
            {expected: 'two 500 ms phases (±50 ms)', observed: changes.slice(1).map(({ms}, i) => ms - changes[i].ms),
                ok: changes.length === 3 && changes.slice(1).every(({ms}, i) => Math.abs(ms - changes[i].ms - 500) <= 50)}
        ];
        return {status: checks.every(check => check.ok) ? 'pass' : 'fail', checks};
    } finally {
        vm?.stopAll();
        vm?.quit();
    }
}

async function checkShiftRegister (bench, circuit, examples) {
    const chaser = bench.id === '08-led-chaser-595';
    const bits = Array.from({length: 8}, (_, bit) => bit);
    const usesNumberedDiodes = circuit.parts.some(part => part.id === 'd1');
    const ledIds = chaser
        ? bits.map(bit => usesNumberedDiodes ? `d${bit + 1}` : `LED_leds_q${bit}`)
        : bits.map(bit => `LED_595_q${bit}`);
    for (const id of ledIds) {
        if (!circuit.parts.some(part => part.id === id && part.kind === 'led')) {
            throw new Error(`Missing shift-register LED ${id}`);
        }
    }
    const ascending = bits.map(bit => 1 << bit);
    const sequence = chaser
        ? [...ascending, ...ascending.slice(0, -1).reverse(), ascending[1]]
        : [...bits, ...bits.map(value => 248 + value), 0];
    const periodMs = chaser ? 100 : 250;
    const sampleMs = chaser ? 25 : 5;
    const toleranceMs = 50;
    let vm;
    try {
        const runtime = await startProgram(bench, circuit, examples, value => { vm = value; });
        let now = 0;
        vm.runtime.updateCurrentMSecs = () => { vm.runtime.currentMSecs = now; };
        vm.runtime.updateCurrentMSecs();
        vm.runtime.ioDevices.clock.resetProjectTimer();
        const changes = [];
        // Allow for the frame in which Scratch schedules each wait.
        const deadline = sequence.length * (periodMs + toleranceMs);
        for (; now <= deadline && changes.length < sequence.length; now += sampleMs) {
            await runtime.stepFrames(vm, 1, sampleMs);
            // This resistive load settles at the pin edge. Sample current with
            // the VM clock controlling the program's waits.
            const mask = ledIds.reduce((value, id, bit) => {
                const brightness = circuit.board.ledBrightnessNow(id);
                if (!Number.isFinite(brightness)) throw new Error(`Missing brightness for ${id}`);
                return brightness >= 0.02 ? value | (1 << bit) : value;
            }, 0);
            if (changes.at(-1)?.mask !== mask) {
                changes.push({ms: now, mask});
                if (mask !== sequence[changes.length - 1]) break;
                if (!chaser && mask === 7) {
                    // Skip the middle counts so this gate exercises the high
                    // outputs and the actual program's rollover on every board.
                    const counter = vm.runtime.getTargetForStage().lookupVariableByNameAndType('counter', '');
                    if (counter?.value !== 8) throw new Error('Binary counter did not advance after latching 7');
                    counter.value = 248;
                }
            } else if (now - changes.at(-1).ms > 2 * periodMs + toleranceMs) {
                break;
            }
        }
        if (runtime.errors.length) throw new Error(runtime.errors.join(', '));
        const mismatch = sequence.findIndex((mask, index) => changes[index]?.mask !== mask);
        const timing = changes.slice(1).findIndex(({ms}, index) => {
            const previous = changes[index];
            const dwell = chaser && (index === 7 || index === 14) ? 2 * periodMs : periodMs;
            return Math.abs(ms - previous.ms - dwell) > toleranceMs;
        });
        const checks = [
            {check: 'LED patterns', expected: sequence.length, observed: changes.length,
                ...(mismatch >= 0 && {mismatch, expectedMask: sequence[mismatch], observedMask: changes[mismatch]?.mask}),
                ok: mismatch < 0},
            {check: 'LED dwell', periodMs, ...(timing >= 0 && {
                pattern: changes[timing].mask, observedMs: changes[timing + 1].ms - changes[timing].ms
            }), ok: timing < 0 && changes.length === sequence.length}
        ];
        return {status: checks.every(check => check.ok) ? 'pass' : 'fail', checks};
    } finally {
        vm?.stopAll();
        vm?.quit();
    }
}

function checkClapLatch (circuit) {
    const checks = [];
    const advance = ms => circuit.advanceTo(circuit.board.getTime() + BigInt(ms) * 1_000_000n);
    const checkLed = (expected, lit) => {
        const observed = Math.abs(circuit.board.branchCurrent('led_16', 'anode'));
        checks.push({expected, observed, ok: Number.isFinite(observed) &&
            (lit ? observed > 0.001 : observed < 0.00005)});
    };
    const sound = db => {
        circuit.setPartParam('speaker_3', 'soundDb', db);
        advance(20);
        circuit.setPartParam('speaker_3', 'soundDb', 0);
        advance(30);
    };
    advance(299);
    checkLed('LED dark at power-on', false);
    sound(80);
    checkLed('LED dark after speech', false);
    sound(120);
    checkLed('LED lit after a loud clap', true);
    advance(100);
    checkLed('LED still latched after 100 ms of silence', true);
    circuit.setControl('button_21', 1);
    advance(5);
    circuit.setControl('button_21', 0);
    advance(20);
    checkLed('LED dark after reset', false);
    return {status: checks.every(check => check.ok) ? 'pass' : 'fail', checks};
}

export async function checkBehavior (bench, circuit, examples) {
    if (bench.cp1) {
        const cp1 = await checkCp1Lesson(bench, circuit, examples);
        if (cp1) return cp1;
    }
    if (['eater6502-contention-bug', 'eater6502-bench', 'eater6502-blink', 'eater6502-vdp-hello',
        'aurora65-workstation'].includes(bench.id)) {
        return check6502Bench(bench, circuit, examples);
    }
    if (bench.id === 'kim1-wired-io' || bench.id === 'busch-microtronic-wired-io') {
        return checkWiredTrainer(bench, circuit);
    }
    if (bench.id === 'z80-bench' || bench.id === 'z80-pd-bench') return checkZ80Bench(bench, circuit, examples);
    if (bench.id === 'cardiac-night-light') return checkCardiacNightLight(circuit);
    if (bench.id === 'eater6502-crtc80') return checkCrtc80(bench, circuit, examples);
    if (bench.id === '07-buzzer-siren') return checkSiren(bench, circuit, examples);
    if (bench.id === '08-led-chaser-595' || bench.id === '20-shift-register-binary') {
        return checkShiftRegister(bench, circuit, examples);
    }
    if (bench.id === 'lab-amp-ic-clap-latch') return checkClapLatch(circuit);
    if (bench.id === 'arduino-sk-p09-motorized-pinwheel' || bench.id === 'arduino-sk-p10-zoetrope') {
        return checkStarterMotor(bench, circuit, examples);
    }
    if (bench.id === '33-inductive-no-flyback') return checkInductiveLesson(bench, circuit, examples, startProgram);
    const arduino = await checkArduinoLesson(bench, circuit, examples, startProgram);
    if (arduino) return arduino;
    const display = await checkDisplayLesson(bench, circuit, examples, startProgram);
    if (display) return display;
    const peripheral = await checkPeripheralLesson(bench, circuit, examples, startProgram);
    if (peripheral) return peripheral;
    const reference = await checkReferenceLesson(bench, circuit, examples);
    if (reference) return reference;
    const digital = checkDigitalLesson(bench, circuit);
    if (digital) return digital;
    const passive = checkPassiveLesson(bench, circuit);
    if (passive) return passive;
    const waveform = checkWaveformLesson(bench, circuit);
    if (waveform) return waveform;
    const spec = behaviors[bench.id];
    if (!spec) {
        // Check the authored operating point before perturbing this circuit's controls.
        const physics = await checkDocumentedPhysics(bench, circuit, examples);
        const io = await checkDeclaredIO(bench, circuit, examples);
        if (io && physics) return {
            status: io.status === 'pass' && physics.status === 'pass' ? 'pass' : 'fail',
            scope: 'physics-and-io', checks: [...physics.checks, ...io.checks]
        };
        return physics ?? io ?? {status: 'unverified', reason: 'No executable behavior matches this bench'};
    }
    const led = spec.led ?? 'LED_led1';
    if (!circuit.parts.some(part => part.id === led && part.kind === 'led')) {
        throw new Error(`Missing scenario LED ${led}`);
    }
    const controls = new Set(circuit.getControls().map(control => control.id));
    for (const [, id] of spec.controls ?? []) {
        if (!controls.has(id)) throw new Error(`Missing scenario control ${id}`);
    }

    let vm;
    try {
        const runtime = spec.usesProgram === false ? null : await startProgram(bench, circuit, examples, value => { vm = value; });
        let now = 0;
        if (vm) {
            vm.runtime.updateCurrentMSecs = () => { vm.runtime.currentMSecs = now; };
            vm.runtime.updateCurrentMSecs();
            vm.runtime.ioDevices.clock.resetProjectTimer();
        }
        const samples = new Map();
        const relaySamples = new Map();
        const transitions = [];
        let lit = false;
        const start = circuit.board.getTime();
        for (; now <= spec.durationMs; now += spec.sampleMs) {
            for (const [at, id, value] of spec.controls ?? []) {
                if (at === now) circuit.setControl(id, value);
            }
            // setControl solves the changed input immediately. Let the VM
            // drive the output before advancing the LED's integration clock.
            if (vm) await runtime.stepFrames(vm, 1, spec.sampleMs);
            circuit.advanceTo(start + BigInt(now + spec.sampleMs) * 1_000_000n);
            const brightness = circuit.ledBrightness(led);
            if (!Number.isFinite(brightness)) throw new Error(`Missing brightness for ${led}`);
            const next = brightness >= 0.02;
            if (next !== lit) transitions.push({ms: now, lit: next, brightness});
            lit = next;
            samples.set(now, lit);
            if (spec.relay) relaySamples.set(now, circuit.board.getDeviceState(spec.relay)?.energized);
        }
        if (runtime?.errors.length) throw new Error(runtime.errors.join(', '));
        const checks = spec.checks.map(check => {
            if (check.expectedPeriodMs !== undefined) {
                // Ignore the initial power-on pulse, which starts with an
                // empty capacitor rather than at the low threshold.
                const rising = transitions.filter(edge => edge.lit).slice(1);
                const periods = rising.slice(1).map((edge, index) => edge.ms - rising[index].ms);
                const ok = periods.length >= 2 && periods.every(period =>
                    Math.abs(period - check.expectedPeriodMs) <= check.toleranceMs);
                return {...check, observed: periods, ok};
            }
            if (check.at !== undefined) {
                const observed = samples.get(check.at);
                if (!spec.relay) return {...check, observed, ok: observed === check.lit};
                const energized = relaySamples.get(check.at);
                return {...check, observed: {lit: observed, energized},
                    ok: observed === check.lit && energized === check.lit};
            }
            const edges = transitions.filter(edge => edge.ms >= (check.from ?? 0) && edge.ms < check.until);
            const rises = edges.filter(edge => edge.lit).length;
            const falls = edges.length - rises;
            return {...check, observed: {rises, falls}, ok: rises === check.rises && falls === check.falls};
        });
        return {status: checks.every(check => check.ok) ? 'pass' : 'fail', checks, transitions};
    } finally {
        vm?.stopAll();
        vm?.quit();
    }
}
