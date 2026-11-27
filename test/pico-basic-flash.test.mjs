import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mountPicoFlashStorage, picoFlashStorageFor} from '../overlay/scratch-gui/src/lib/bw-machines/pico-basic-flash.js';

const hash = 'a'.repeat(64);
const layout = picoFlashStorageFor({offset: 0x1df000, length: 0x20000}, hash);
const emptyFlash = () => new Uint8Array(2 * 1024 * 1024).fill(0xff);

test('a Pico rerun retains only the declared filesystem for the same project and firmware', () => {
    const project = {};
    const first = emptyFlash();
    const save = mountPicoFlashStorage(project, first, 0x80000, layout);
    first[0] = 0;
    first[layout.offset - 1] = 1;
    first[layout.offset] = 2;
    first[layout.offset + layout.length - 1] = 3;
    first[layout.offset + layout.length] = 4;
    save();

    const next = emptyFlash();
    next[0] = 0x42;
    mountPicoFlashStorage(project, next, 0x80000, layout);
    assert.equal(next[0], 0x42);
    assert.equal(next[layout.offset - 1], 0xff);
    assert.equal(next[layout.offset], 2);
    assert.equal(next[layout.offset + layout.length - 1], 3);
    assert.equal(next[layout.offset + layout.length], 0xff);

    const otherProject = emptyFlash();
    mountPicoFlashStorage({}, otherProject, 0x80000, layout);
    assert.equal(otherProject[layout.offset], 0xff);
    const otherImage = emptyFlash();
    mountPicoFlashStorage(project, otherImage, 0x80000, {...layout, sha256: 'b'.repeat(64)});
    assert.equal(otherImage[layout.offset], 0xff);
});

test('an older Pico runner cannot overwrite a more recent filesystem snapshot', () => {
    const project = {};
    const oldFlash = emptyFlash();
    const newFlash = emptyFlash();
    const saveOld = mountPicoFlashStorage(project, oldFlash, 0x80000, layout);
    const saveNew = mountPicoFlashStorage(project, newFlash, 0x80000, layout);
    oldFlash[layout.offset] = 1;
    newFlash[layout.offset] = 2;
    saveNew();
    saveOld();
    const latest = emptyFlash();
    mountPicoFlashStorage(project, latest, 0x80000, layout);
    assert.equal(latest[layout.offset], 2);
});

test('Pico storage requires a pinned image and a separate, sector-aligned region', () => {
    assert.equal(picoFlashStorageFor(undefined, hash), null);
    assert.throws(() => picoFlashStorageFor(layout, null), /Invalid Pico/);
    assert.throws(() => picoFlashStorageFor({...layout, offset: layout.offset + 1}, hash), /Invalid Pico/);
    assert.throws(() => picoFlashStorageFor({...layout, length: 0x40000}, hash), /Invalid Pico/);
    assert.throws(() => mountPicoFlashStorage({}, emptyFlash(), layout.offset + 1, layout), /overlaps/);
    assert.throws(() => mountPicoFlashStorage({}, new Uint8Array(64), 0, layout), /outside flash/);
});
