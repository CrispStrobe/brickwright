import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {BbcVideo} from 'bw-board/bbc-video.js';
import {createM6502Adapter} from 'bw-board/m6502-adapter.js';
import {lessonMachines} from '../overlay/scratch-gui/src/lib/bw-machines/lessons.js';

const modes = [
    [640, 256, 80, 32], [320, 256, 40, 32], [160, 256, 20, 32],
    [640, 200, 80, 25], [320, 256, 40, 32], [160, 256, 20, 32], [320, 200, 40, 25]
];
const white = [255, 255, 255, 255];
const black = [0, 0, 0, 255];
const pixel = ({width, rgba}, x, y) => [...rgba.slice(4 * (y * width + x), 4 * (y * width + x + 1))];

test('BBC-style scanout respects packed bit planes and raster-interleaved RAM', () => {
    const memory = new Uint8Array(65536);
    const video = new BbcVideo({memory, clockHz: 2_000_000});
    assert.equal(video.videoFrame().signal, false);
    video.write(0, 2);
    video.write(1, 0x81); // logical 8 = red
    video.write(1, 0x12); // logical 1 = green
    memory[0x3000] = 0x81; // left pixel 8, right pixel 1
    memory[0x3001] = 0x02; // second raster, left pixel 1
    memory[0x3008] = 0x80; // next byte-column, left pixel 8
    const frame = video.videoFrame();
    assert.deepEqual(pixel(frame, 0, 0), [255, 0, 0, 255]);
    assert.deepEqual(pixel(frame, 1, 0), [0, 255, 0, 255]);
    assert.deepEqual(pixel(frame, 0, 1), [0, 255, 0, 255]);
    assert.deepEqual(pixel(frame, 2, 0), [255, 0, 0, 255]);
    const state = video.saveState();
    memory[0x3000] = 0;
    video.advance(40_000);
    assert.equal(video.videoFrame().frame, 1);
    assert.deepEqual(pixel(video.videoFrame(), 0, 0), black);
    video.write(0, 7);
    assert.equal(video.videoFrame().signal, false);
    video.loadState(state);
    assert.equal(video.videoFrame().width, 160);
    assert.deepEqual(pixel(video.videoFrame(), 2, 0), [255, 0, 0, 255]);
});

test('the packaged 65C02 lesson boots and renders seven real framebuffer modes from keyboard input', () => {
    const {config} = lessonMachines('en').find(row => row.config.id === 'lesson-bbc-video-6502');
    const {url, sha256} = config.slots.rom;
    const rom = readFileSync(new URL(`../overlay/scratch-gui/${url}`, import.meta.url));
    assert.equal(createHash('sha256').update(rom).digest('hex'), sha256);
    const adapter = createM6502Adapter({rom, config: config.machineConfig});
    adapter.attachBoard({setPin() {}});
    const video = adapter.machine.chips.bbcVideo;
    for (const [mode, [width, height, columns, rows]] of modes.entries()) {
        if (mode) assert.equal(adapter.sendSerial(0x30 + mode), true);
        adapter.advanceNs(150_000_000);
        const frame = video.videoFrame();
        assert.equal(video.read(0), mode);
        assert.deepEqual([frame.width, frame.height, frame.textColumns, frame.textRows],
            [width, height, columns, rows]);
        assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map(x => pixel(frame, x, 0)),
            [white, white, black, black, black, black, white, white], 'the guest drew the letter M');
        assert.deepEqual(pixel(frame, width - 5, height - 1), white, 'last cell reaches the final scanline');
        assert.deepEqual(pixel(frame, width - 1, height - 1), black);
        const colours = new Set();
        for (let x = 0; x < width; x++) colours.add(pixel(frame, x, 128).join(','));
        assert.equal(colours.size, [2, 4, 4, 1, 2, 3, 1][mode], 'packed colours in the centre band');
    }
});
