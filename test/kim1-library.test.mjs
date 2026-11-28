// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ControllerPanel} from 'bw-board';
import {addKim1Face, addKim1VideoFace, isKim1VideoFace} from '../overlay/scratch-gui/src/lib/controller-machine-faces.js';
import {libraryMedia, libraryLicenseUrl, readKim1LibraryTape} from '../overlay/scratch-gui/src/lib/bw-machines/library-media.js';

test('KIM-1 lesson tapes and licence are pinned to the same Media Lab revision', async context => {
    const entries = libraryMedia.filter(item => item.kim1Tape);
    assert.deepEqual(entries.map(item => [item.machine, item.kim1Tape.preset]), [
        ['kim1', 'ram-check'], ['kim1', 'video'], ['kim1', 'memory-map'], ['kim1', 'sd-read'], ['kim1', 'corsham-read']
    ]);
    for (const item of entries) {
        assert.equal(item.license, 'MIT');
        assert.match(libraryLicenseUrl(item), /\/[a-f0-9]{40}\/projects\/kim1-expansion-demos\/LICENSE$/);
    }
    const fetcher = context.mock.method(globalThis, 'fetch', async () => new Response('changed tape'));
    const item = entries[1];
    await assert.rejects(readKim1LibraryTape(item), /sha256 mismatch/);
    assert.deepEqual(fetcher.mock.calls[0].arguments, [
        new URL('video.ptp', libraryLicenseUrl(item)).href
    ]);
});

test('a valid tape with a corrupt disk image cannot produce a launch', async context => {
    const hash = async bytes => Buffer.from(await crypto.subtle.digest('SHA-256', bytes)).toString('hex');
    const tape = new TextEncoder().encode('0200: 00');
    const image = new Uint8Array([1, 2, 3]);
    const entry = libraryMedia.find(item => item.kim1Tape?.preset === 'sd-read');
    const fixture = {...entry, kim1Tape: {...entry.kim1Tape, sha256: await hash(tape),
        image: {...entry.kim1Tape.image, sha256: await hash(image)}}};
    const sectorUrl = new URL('sectors.img', libraryLicenseUrl(entry)).href;
    let disk = new Uint8Array([1, 2, 4]);
    const fetcher = context.mock.method(globalThis, 'fetch', async url => new Response(url === sectorUrl ? disk : tape));
    await assert.rejects(readKim1LibraryTape(fixture), /sha256 mismatch.*sectors[.]img/);
    disk = image;
    const result = await readKim1LibraryTape(fixture);
    assert.equal(result.program, '0200: 00');
    assert.deepEqual(result.image, image);
    assert.equal(fetcher.mock.calls.filter(call => call.arguments[0] === sectorUrl).length, 2);
});

test('K-1008 is a separate, deduplicated Controller widget bound to its own KIM-1', () => {
    const panel = new ControllerPanel();
    const keypad = addKim1Face(panel, 'trainer');
    const screen = addKim1VideoFace(panel, 'trainer');
    assert.equal(isKim1VideoFace(keypad), false);
    assert.equal(isKim1VideoFace(screen), true);
    assert.equal(screen.config.partId, 'trainer');
    assert.ok(screen.layout.y >= keypad.layout.y + keypad.layout.h);
    assert.equal(addKim1VideoFace(panel, 'trainer'), undefined);
    assert.deepEqual(panel.getWidgets().map(widget => widget.name), ['kim1', 'kim1-video']);
});
