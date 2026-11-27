/**
 * Arduboy: a compiled game, actually running.
 *
 * Every other importer in this repo answers a parsing question — MakeCode
 * embeds its project source in every artefact, so bringing a game in is a
 * matter of finding and reading it. An Arduboy `.hex` has nothing in it
 * but AVR machine code. The only way to know whether we support it is to
 * execute it and look at the screen, which is what these do.
 *
 * The one thing worth knowing about this chip: the Arduino core for the
 * 32U4 spins on PLLCSR waiting for the USB PLL to lock, three instructions
 * in, before any game code runs. It reads like "USB is not emulated, this
 * is hopeless". It is one bit, and `createArduboy` sets it.
 */

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';

import {SOURCE, INTEGRATED, REPO, guiDependencyFile, importSource} from './helpers/bw-integrated.mjs';

const CHIPS = join(INTEGRATED, 'node_modules', 'bw-board', 'src', 'avr-chips.js');
const canRun = existsSync(CHIPS) &&
    existsSync(join(INTEGRATED, 'node_modules', 'avr8js'));
const SKIP = canRun ? false : 'needs the integrated tree and avr8js';

const arduboy = canRun ?
    await import(join(SOURCE, 'src', 'lib', 'bw-arduboy', 'index.js')) : {};
const GAME = join(REPO, 'test', 'fixtures', 'arduboy', 'rysk.hex');
const hex = () => readFileSync(GAME, 'utf8');

/** Lit pixels in a framebuffer, as a cheap "is there a picture" measure. */
const litPixels = fb => {
    const pixels = arduboy.framebufferToPixels(fb);
    let n = 0;
    for (const p of pixels) if (p) n++;
    return n;
};

test('DEVICE ARDUBOY converts to Scratch blocks and survives the SB3 round trip', async () => {
    const {default: SB3Creator} = await importSource('src/lib/sb3-creator.js');
    const creator = new SB3Creator();
    const project = creator.parse('DEVICE ARDUBOY\nGLOBAL score = 0\nSTAGE:\nWHEN flag clicked:\n    set score to 42\n');
    assert.equal(project.stc.device, 'arduboy');
    assert.equal(project.stc.clock, 16000000);
    assert.ok(Object.values(project.targets[0].blocks).some(block => block.opcode === 'data_setvariableto'));
    assert.match(creator.generateC(project), /Use an Arduboy sketch or a compiled \.hex/);
    const {default: JSZip} = await import(guiDependencyFile('jszip/lib/index.js'));
    const archive = await JSZip.loadAsync(await (await creator.generateSB3()).arrayBuffer());
    const saved = JSON.parse(await archive.file('project.json').async('string'));
    delete saved.stc; // Scratch VM keeps the stage comment when it serializes an SB3.
    assert.match(new SB3Creator().decompile(saved), /^DEVICE ARDUBOY/m);
});

test('the ATmega32U4 is a chip definition, not new emulator code', {skip: SKIP}, async () => {
    // avr8js ships a generic AVR core and no chip definitions at all, so a
    // new part is a data file beside the 328P — which is why this was a
    // day and not a project.
    const {CHIPS: chips} = await import(CHIPS);
    const chip = chips.atmega32u4;
    assert.ok(chip, `no atmega32u4 in ${Object.keys(chips).join(', ')}`);
    assert.equal(chip.flashWords, 0x4000, '32 KB of flash, word-addressed');
    assert.equal(chip.sramBytes, 2560);
    assert.deepEqual(Object.keys(chip.ports), ['B', 'C', 'D', 'E', 'F']);
    // Timer4 is deliberately absent: it is the 10-bit high-speed one, whose
    // register layout avr8js's timer model does not describe.
    assert.equal(chip.timers.length, 3);
});

test('the vector table matches the one the games were built against', {skip: SKIP}, async () => {
    // A wrong vector fires every interrupt into the middle of the wrong
    // handler, and the failure looks like anything at all. The game's own
    // binary is the reference: its used vectors must land where we say.
    const {parseIntelHex} = await import(guiDependencyFile('bw-board/src/intel-hex.js'));
    const program = parseIntelHex(hex(), 0x8000);
    const target = word => program[word + 1];
    const counts = new Map();
    for (let w = 0; w < 86; w += 2) counts.set(target(w), (counts.get(target(w)) || 0) + 1);
    const unused = [...counts].sort((a, b) => b[1] - a[1])[0][0];

    // Timer0 overflow drives millis(); Timer1 and Timer3 compare-A drive
    // the frame timer and the tone generator. All three are real handlers.
    for (const [word, what] of [[0x2e, 'TIMER0 OVF'], [0x22, 'TIMER1 COMPA'], [0x40, 'TIMER3 COMPA']]) {
        assert.notEqual(target(word), unused,
            `word 0x${word.toString(16)} (${what}) points at the unused-vector handler`);
    }
});

test('a compiled game boots and reaches its title screen', {skip: SKIP}, () => {
    const game = arduboy.createArduboy(hex());
    game.advance(400);

    assert.ok(game.display.displayOn, 'the display was never switched on');
    assert.ok(game.bytesToDisplay > 20_000,
        `only ${game.bytesToDisplay} bytes reached the display — a stalled boot looks like this`);
    const lit = litPixels(game.framebuffer);
    assert.ok(lit > 200, `only ${lit} pixels lit — the screen is blank`);
    assert.ok(lit < 8000, `${lit} of 8192 pixels lit — that is a filled screen, not a picture`);
});

test('it holds 60 frames a second, which is what the game asks for', {skip: SKIP}, () => {
    const game = arduboy.createArduboy(hex());
    game.advance(200);                       // boot and title
    const before = game.bytesToDisplay;
    game.advance(500);
    // A full screen is 1024 bytes; the Arduboy pushes all of it every frame.
    const fps = (game.bytesToDisplay - before) / 1024 / 0.5;
    assert.ok(fps > 45 && fps < 75, `${fps.toFixed(1)} frames/s — expected about 60`);
});

test('without the PLL bit the same game never runs at all', {skip: SKIP}, async () => {
    // The regression this whole thing turns on. Built by hand rather than
    // through createArduboy, because createArduboy's job IS setting it.
    const {parseIntelHex} = await import(guiDependencyFile('bw-board/src/intel-hex.js'));
    const {createAvr8jsAdapter} = await import(
        guiDependencyFile('bw-board/src/avr8js-adapter.js'));
    const program = parseIntelHex(hex(), 0x8000);
    const adapter = createAvr8jsAdapter({chip: 'atmega32u4', program});
    adapter.attachBoard({readPin: () => 1, setPin: () => {}, advanceTo: () => {}});

    let spi = 0;
    const cpu = adapter.cpu;
    const previous = cpu.writeHooks[0x4e];
    cpu.writeHooks[0x4e] = (v, ...rest) => {
        spi++;
        return previous ? previous(v, ...rest) : (cpu.data[0x4e] = v, true);
    };
    for (let i = 0; i < 300; i++) { adapter.syncInputs(); adapter.advanceNs(1_000_000); }

    assert.equal(spi, 0, 'expected the PLL spin to stop the program before it touches SPI');
    // And it is genuinely spinning on PLLCSR, not merely quiet: the loop is
    // IN r0,0x29 / SBRS r0,0 / RJMP -3.
    assert.ok([0x1496, 0x1497, 0x1498].includes(cpu.pc) || (program[cpu.pc] & 0xf000) === 0xc000,
        `stopped at 0x${cpu.pc.toString(16)} (op 0x${program[cpu.pc].toString(16)})`);
});

test('buttons reach the game', {skip: SKIP}, () => {
    const game = arduboy.createArduboy(hex());
    game.advance(400);
    const idle = Buffer.from(game.framebuffer).toString('base64');

    game.press('a');
    game.advance(400);
    game.release('a');
    game.advance(400);
    const after = Buffer.from(game.framebuffer).toString('base64');
    assert.notEqual(after, idle, 'pressing A changed nothing on screen');
});

test('the framebuffer unpacks to the shape a canvas wants', {skip: SKIP}, () => {
    // SSD1306 GDDRAM is page-major with 8 VERTICAL pixels per byte; a
    // canvas wants row-major. Getting this wrong shows as a picture sliced
    // into eight bands, which still looks like "something rendered".
    const fb = new Uint8Array(1024);
    fb[0] = 0b00000001;          // page 0, column 0, top pixel only
    fb[128] = 0b10000000;        // page 1, column 0, bottom pixel of that page
    const pixels = arduboy.framebufferToPixels(fb);
    assert.equal(pixels[0], 255, 'pixel (0,0)');
    assert.equal(pixels[1 * 128], 0, 'pixel (0,1) should be dark');
    assert.equal(pixels[15 * 128], 255, 'pixel (0,15) — page 1, bit 7');
});

test('an AVR hex is told apart from a MakeCode one', {skip: SKIP}, async () => {
    const {looksLikeAvrHex} = arduboy;
    assert.equal(looksLikeAvrHex(hex()), true);
    const makecode = readFileSync(
        join(REPO, 'test', 'fixtures', 'makecode', 'microbit-blocks.hex'), 'utf8');
    assert.equal(looksLikeAvrHex(makecode), false,
        'a MakeCode hex must not be offered to the console');
    assert.equal(looksLikeAvrHex(''), false);
    assert.equal(looksLikeAvrHex(':00000001FF\n'), false, 'an empty image is not a program');
});

test('the importer routes a compiled game to the console, not the translator',
    {skip: SKIP}, async () => {
    const {importArtefact} = await import(join(SOURCE, 'src', 'lib', 'bw-makecode', 'index.js'));
    const result = await importArtefact(new Uint8Array(readFileSync(GAME)), {name: 'rysk.hex'});
    assert.equal(result.kind, 'avr-hex');
    assert.equal(result.project.target, 'arduboy');
    assert.ok(result.hex.startsWith(':'), 'the hex text itself has to come through');

    // And a MakeCode hex still goes where it always did.
    const makecode = await importArtefact(
        new Uint8Array(readFileSync(join(REPO, 'test', 'fixtures', 'makecode', 'microbit-blocks.hex'))),
        {name: 'microbit-blocks.hex'});
    assert.equal(makecode.kind, 'makecode');
});

test('the speaker reports a real note, not a pin state', {skip: SKIP}, () => {
    // There is no frequency register worth reading — a game is free to make
    // noise however it likes — so what gets measured is the thing that is
    // actually true of a tone: the pin toggles, and at some rate. RYSK
    // answers a button press with one.
    const game = arduboy.createArduboy(hex());
    game.advance(400);
    const quiet = game.takeSpeaker();
    assert.equal(quiet.edges, 0, 'the title screen should be silent');

    game.press('a');
    game.advance(300);
    game.release('a');
    game.advance(300);
    const sound = game.takeSpeaker();
    assert.ok(sound.edges > 100, `only ${sound.edges} speaker edges — no tone was played`);
    // Averaged across the silence either side, so this is a floor on the
    // real note rather than the note itself; the point is that it lands in
    // the band a piezo is asked for and not at DC or ultrasound.
    assert.ok(sound.hz > 100 && sound.hz < 4000, `${sound.hz.toFixed(0)} Hz is not a note`);
});

test('reading the speaker resets it, because it is a rate', {skip: SKIP}, () => {
    const game = arduboy.createArduboy(hex());
    game.press('a');
    game.advance(500);
    const first = game.takeSpeaker();
    const second = game.takeSpeaker();
    assert.ok(first.edges > 0);
    assert.equal(second.edges, 0, 'a total that is never cleared only ever goes up');
});

test('the RGB LED is a duty cycle, not a pin level', {skip: SKIP}, () => {
    // The LED is common-anode and driven by PWM: the pin is only ever fully
    // low or fully high, and the colour is entirely in how long it stays
    // each way. Reading the level at any instant would report a game's dim
    // red as either full red or nothing, depending when you looked.
    const game = arduboy.createArduboy(hex());
    game.advance(600);
    for (let i = 0; i < 6; i++) {
        game.press('a');
        game.advance(150);
        game.release('a');
        game.advance(400);
    }
    game.takeLed();

    const seen = [];
    for (let i = 0; i < 6; i++) {
        game.press('right');
        game.advance(200);
        game.release('right');
        game.advance(300);
        const led = game.takeLed();
        if (led.r + led.g + led.b > 0.01) seen.push(led);
    }
    assert.ok(seen.length > 0, 'the LED was never lit during play');
    // The game asks for level 16 of 255, which is a duty of about 0.063 —
    // so a channel that is on should land near there and nowhere near 1.
    for (const led of seen) {
        for (const channel of ['r', 'g', 'b']) {
            assert.ok(led[channel] >= 0 && led[channel] <= 1,
                `${channel} duty ${led[channel]} is not a fraction`);
        }
    }
    const brightest = Math.max(...seen.flatMap(l => [l.r, l.g, l.b]));
    assert.ok(brightest > 0.02 && brightest < 0.5,
        `brightest channel ${brightest.toFixed(3)} — expected a dim PWM level, not full on`);
});
