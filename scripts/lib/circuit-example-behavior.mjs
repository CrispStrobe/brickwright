// Observable checks for the gallery's Scratch-VM route. Each lesson declares
// what the real board should do under specific user input.
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

const behaviors = {
    '01-blink': {
        sampleMs: 20,
        durationMs: 1650,
        checks: [{until: 1650, rises: 2, falls: 2}]
    },
    '03-night-light': {
        sampleMs: 20,
        durationMs: 660,
        controls: [[0, 'LDR_ldr', 1], [220, 'LDR_ldr', 0], [440, 'LDR_ldr', 1]],
        checks: [{at: 200, lit: false}, {at: 420, lit: true}, {at: 640, lit: false}]
    },
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
    const {SB3Creator, runCreatedProgram, stepFrames} = await import('../../test/helpers/bw-vm.mjs');
    let source = await readFile(join(examples, program), 'utf8');
    const authored = source.match(/^DEVICE\s+(\S+)/im)?.[1].toLowerCase();
    if (device && authored !== device) {
        const result = SB3Creator.retargetPseudocode(source, device);
        if (!result.ok) throw new Error(`Retarget refused: ${result.reasons.join(', ')}`);
        source = result.pseudocode;
    }

    const creator = new SB3Creator();
    creator.parse(source);
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

export async function checkBehavior (bench, circuit, examples) {
    const spec = behaviors[bench.id];
    if (!spec) return {status: 'unverified', reason: 'No functional scenario for this lesson'};
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
        if (vm) vm.runtime.updateCurrentMSecs = () => { vm.runtime.currentMSecs = now; };
        const samples = new Map();
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
                return {...check, observed, ok: observed === check.lit};
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
