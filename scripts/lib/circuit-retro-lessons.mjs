import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

const summarize = checks => ({status: checks.every(check => check.ok) ? 'pass' : 'fail', checks});

const eq = (check, expected, observed) => ({
    check, expected, observed, ok: JSON.stringify(expected) === JSON.stringify(observed)
});

const run6502 = async (bench, circuit, examples, config) => {
    const {createM6502Adapter} = await import('bw-board/m6502-adapter.js');
    const rom = await readFile(join(examples, bench.rom));
    const adapter = createM6502Adapter({config: {clockHz: 1_000_000, ...config}, rom});
    adapter.attachBoard(circuit.board);
    return adapter;
};

export async function check6502Bench (bench, circuit, examples) {
    const [{flatWire}, {extract6502Machine}] = await Promise.all([
        import('bw-circuit-ui/model/wire-endpoints.js'),
        import('bw-board/m6502-extract.js')
    ]);
    const wires = circuit.wires.map(flatWire);
    const config = extract6502Machine({parts: circuit.parts, wires});
    if (bench.id === 'eater6502-contention-bug') {
        const diagnosis = config.reasons.find(reason => /bus contention/i.test(reason)) ?? '';
        return summarize([{
            check: 'intentionally miswired chip select reports contention at $2000 between RAM and VIA',
            observed: diagnosis,
            ok: !config.ok && /\$2000/i.test(diagnosis) && /\bram\b/i.test(diagnosis) && /\bvia\b/i.test(diagnosis)
        }]);
    }
    if (!config.ok) throw new Error(config.reasons.join(', '));
    const adapter = await run6502(bench, circuit, examples, config);

    if (bench.id === 'eater6502-bench') {
        adapter.advanceNs(25_000_000);
        const regions = config.regions.map(({kind, start, end}) => [kind, start, end]);
        const checks = [
            eq('decoded memory', [['ram', 0, 0x3fff], ['rom', 0x8000, 0xffff]], regions),
            eq('decoded I/O', [0x6000, 0x5000], ['via', 'acia'].map(name =>
                config.chips.find(chip => chip.name === name)?.at)),
            eq('Timer 1 IRQ handler incremented VIA port B six times in 25 ms', 6, adapter.machine.chips.via.orb)
        ];
        return summarize(checks);
    }
    if (bench.id === 'eater6502-blink') {
        const progress = [];
        for (let step = 0; step < 120 && progress.length < 9; step++) {
            adapter.advanceNs(10_000_000);
            const lit = Array.from({length: 8}, (_, bit) => bit).filter(bit =>
                Math.abs(circuit.board.branchCurrent(`led${bit}`, 'anode')) > 0.001);
            if (lit.length && String(progress.at(-1)) !== String(lit)) progress.push(lit);
        }
        return summarize([eq('wired LEDs walk in order and wrap to PB0',
            [[0], [1], [2], [3], [4], [5], [6], [7], [0]], progress)]);
    }

    if (bench.id === 'aurora65-workstation') {
        adapter.advanceNs(4_000_000_000);
        const card = adapter.machine.chips.vga;
        const oled = circuit.board.getDeviceState('oled1');
        const frame = circuit.board.getDeviceState('vga').videoFrame();
        const before = card.writes;
        const pixels = Uint8Array.from(oled.fb);
        const keyboard = circuit.board.setDeviceControl('kbd', 'type', 'A');
        adapter.advanceNs(500_000_000);
        const oledChanged = oled.fb.some((byte, index) => byte !== pixels[index]);
        return summarize([
            eq('booted VGA signal and resolution', [true, 160, 128], [frame.signal, frame.width, frame.height]),
            eq('VIA sends visible pixels to the OLED', true, oled.displayOn && pixels.some(byte => byte !== 0)),
            eq('wired PS/2 keyboard updates both displays', [true, true, true], [keyboard, card.writes > before, oledChanged])
        ]);
    }
    adapter.advanceNs(60_000_000);
    const vdp = adapter.machine.chips.vdp1;
    const frame = circuit.board.getDeviceState('vdp1').videoFrame();
    const caption = 0x3800 + 11 * 32 + 13;
    const glyphs = Array.from({length: 5}, (_, letter) => {
        const colors = new Set();
        for (let y = 88; y < 96; y++) {
            for (let x = (13 + letter) * 8; x < (14 + letter) * 8; x++) {
                const offset = (y * frame.width + x) * 4;
                colors.add(frame.rgba.slice(offset, offset + 3).join(','));
            }
        }
        return colors.size;
    });
    return summarize([
        eq('VDP name table caption', 'HELLO', String.fromCharCode(...vdp.vram.slice(caption, caption + 5))),
        eq('wired video output dimensions and painted glyphs', [256, 192, 2, 2, 2, 2, 2],
            [frame.width, frame.height, ...glyphs])
    ]);
}

export function checkCardiacNightLight (circuit) {
    const board = circuit.board;
    const state = board.getDeviceState('cardiac');
    if (!board.setDeviceControl('cardiac', 'run')) throw new Error('CARDIAC refused to start');
    const checks = [];
    for (const [lightLevel, expected] of [[0, 1], [1, 0], [0, 1]]) {
        circuit.setControl('light-level', lightLevel);
        if (!board.setDeviceControl('cardiac', 'sampleInput')) throw new Error('CARDIAC refused to sample IN');
        circuit.advanceTo(board.getTime() + 1_500_000_000n);
        const lampCurrent = Math.abs(board.branchCurrent('lamp', 'anode'));
        checks.push(eq(`CARDIAC card output with potentiometer at ${lightLevel}`, expected, state.machine.lastOutput));
        checks.push({
            check: `wired LED current with potentiometer at ${lightLevel}`,
            expected: expected ? 'above 1 mA' : 'below 0.05 mA',
            observed: lampCurrent,
            ok: Number.isFinite(lampCurrent) && (expected ? lampCurrent > 0.001 : lampCurrent < 0.00005)
        });
    }
    return summarize(checks);
}

export function checkWiredTrainer (bench, circuit) {
    const kim = bench.id === 'kim1-wired-io';
    const id = kim ? 'kim1' : 'microtronic';
    const board = circuit.board;
    const state = board.getDeviceState(id);
    if (!board.setDeviceControl(id, kim ? 'key' : 'run', kim ? 'GO' : undefined)) {
        throw new Error(`${id} refused to start the shipped program`);
    }
    const switches = kim ? [0, 1, 2] : [1, 2, 3];
    const checks = [];
    for (const mask of [5, 2, 0]) {
        for (const [bit, terminal] of switches.entries()) {
            circuit.setControl(`input${terminal}`, (mask >> bit) & 1);
        }
        circuit.advanceTo(board.getTime() + (kim ? 100_000_000n : 450_000_000n));
        const input = (kim ? state.portB : state.input) & 7;
        const output = (kim ? state.portA : state.output) & 7;
        const lamps = switches.reduce((bits, terminal, bit) => {
            const current = Math.abs(board.branchCurrent(`lamp${terminal}`, 'anode'));
            return current > 0.001 ? bits | (1 << bit) : bits;
        }, 0);
        checks.push(eq(`switch pattern ${mask} reaches the trainer and its external LEDs`,
            [mask, mask, mask], [input, output, lamps]));
    }
    return summarize(checks);
}

export async function checkZ80Bench (bench, circuit, examples) {
    const [{flatWire}, {extractZ80Machine}, {createZ80Adapter}] = await Promise.all([
        import('bw-circuit-ui/model/wire-endpoints.js'),
        import('bw-board/z80-extract.js'),
        import('bw-board/z80-adapter.js')
    ]);
    const config = extractZ80Machine({parts: circuit.parts, wires: circuit.wires.map(flatWire)});
    if (!config.ok) throw new Error(config.reasons.join(', '));
    const checks = [eq('decoded memory map', [['rom', 0, 0x7fff], ['ram', 0x8000, 0xffff]],
        config.regions.map(({kind, start, end}) => [kind, start, end]).sort((a, b) => a[1] - b[1]))];
    if (bench.id === 'z80-bench') {
        // No program is bundled with this bench. Exercise its decoded ACIA
        // through a small ROM that waits for a byte and echoes it.
        const echo = Uint8Array.of(0x3e, 3, 0xd3, 0x80, 0x3e, 0x16, 0xd3, 0x80,
            0xdb, 0x80, 0xe6, 1, 0x28, 0xfa, 0xdb, 0x81, 0xd3, 0x81, 0x18, 0xf4);
        const adapter = createZ80Adapter({config: {clockHz: 4_000_000, ...config}, rom: echo});
        adapter.attachBoard(circuit.board);
        const observed = [];
        adapter.onSerial(byte => observed.push(byte));
        adapter.advanceNs(1_000_000);
        for (const byte of [0x42, 0x57]) {
            adapter.sendSerial(byte);
            adapter.advanceNs(10_000_000);
        }
        checks.push(eq('ACIA is decoded at port $80', 0x80, config.ports.find(port => port.name === 'acia')?.at),
            eq('ROM echoes both bytes through ACIA', [0x42, 0x57], observed));
        return summarize(checks);
    }

    const leds = () => Array.from({length: 8}, (_, bit) => bit).reduce((mask, bit) =>
        Math.abs(circuit.board.branchCurrent(`led${bit}`, 'anode')) > 0.001 ? mask | (1 << bit) : mask, 0);
    const rom = await readFile(join(examples, bench.rom));
    const adapter = createZ80Adapter({config: {clockHz: 4_000_000, ...config}, rom});
    adapter.attachBoard(circuit.board);
    const walking = [];
    for (let sample = 0; sample < 120 && walking.length < 8; sample++) {
        adapter.advanceNs(20_000_000);
        const mask = leds();
        if (mask && mask !== walking.at(-1)) walking.push(mask);
    }
    checks.push(eq('bundled ROM walks the wired latch output LEDs', [1, 2, 4, 8, 16, 32, 64, 128], walking));

    const mirror = await readFile(join(examples, '../static/roms/z80-mirror.bin'));
    const mirrorAdapter = createZ80Adapter({config: {clockHz: 4_000_000, ...config}, rom: mirror});
    mirrorAdapter.attachBoard(circuit.board);
    for (const mask of [5, 2, 0]) {
        circuit.setPartParam('dip1', 'switches', mask);
        mirrorAdapter.advanceNs(200_000);
        checks.push(eq(`Switch Mirror sends DIP pattern ${mask} to the latch and LEDs`, mask, leds()));
    }
    return summarize(checks);
}
