import {test} from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {attachBrickwrightState, BUNDLE_PATH, inspectBrickwrightState, parseBundleDocument} from '../overlay/scratch-gui/src/lib/bw-project-bundle.js';
import {capturePicoFlashProject, mountPicoFlashStorage, picoFlashStorageFor, restorePicoFlashProject} from '../overlay/scratch-gui/src/lib/bw-machines/pico-basic-flash.js';

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
    save.dispose();

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
    saveNew.dispose();
    saveOld.dispose();
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


test('a live flash write marks the project changed once and is captured before runner disposal', async () => {
    const stage = {};
    const flash = emptyFlash();
    let changes = 0;
    const mounted = mountPicoFlashStorage(stage, flash, 0x80000, layout, () => { changes++; });
    mounted.tick(0);
    assert.equal(capturePicoFlashProject(stage), undefined);
    flash[layout.offset] = 42;
    flash[layout.offset - 1] = 41;
    mounted.tick(1_000);
    mounted.tick(2_000);
    assert.equal(changes, 1);

    const zip = new JSZip();
    zip.file('project.json', '{}');
    const blank = await zip.generateAsync({type: 'blob'});
    const archived = await attachBrickwrightState(blank, {project: stage});
    const loaded = await inspectBrickwrightState(await archived.arrayBuffer());
    assert.equal(loaded.outcome, 'loaded');
    assert.equal(loaded.state.picoFlash, undefined);
    const reopened = {};
    restorePicoFlashProject(reopened, loaded.picoFlash);
    const reopenedFlash = emptyFlash();
    mountPicoFlashStorage(reopened, reopenedFlash, 0x80000, layout);
    assert.equal(reopenedFlash[layout.offset - 1], 0xff);
    assert.equal(reopenedFlash[layout.offset], 42);
    restorePicoFlashProject(reopened);
    assert.equal(capturePicoFlashProject(reopened), undefined);
    assert.equal((await JSZip.loadAsync(await (await attachBrickwrightState(blank)).arrayBuffer())).file(BUNDLE_PATH), null);
});

test('project inspection refuses truncated, duplicate, and oversized flash partitions', () => {
    const stage = {};
    const flash = emptyFlash();
    mountPicoFlashStorage(stage, flash, 0x80000, layout);
    flash[layout.offset] = 42;
    const [partition] = capturePicoFlashProject(stage).partitions;
    const inspect = partitions => parseBundleDocument(JSON.stringify({format: 'brickwright-state', version: 2,
        state: {picoFlash: {partitions}}}));
    assert.equal(inspect([partition]).outcome, 'loaded');
    assert.equal(inspect([{...partition, data: partition.data.slice(4)}]).outcome, 'invalid');
    assert.equal(inspect([partition, partition]).outcome, 'invalid');
    assert.match(inspect(Array.from({length: 5}, (_, index) => ({...partition, sha256: `${index}`.repeat(64)}))).reason,
        /exceeds 512 KiB/);
});
