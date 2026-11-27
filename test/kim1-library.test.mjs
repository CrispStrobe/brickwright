// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ControllerPanel} from 'bw-board';
import {addKim1Face, addKim1VideoFace, isKim1VideoFace} from '../overlay/scratch-gui/src/lib/controller-machine-faces.js';
import {libraryMedia, libraryLicenseUrl, readKim1LibraryTape} from '../overlay/scratch-gui/src/lib/bw-machines/library-media.js';

test('KIM-1 lesson tapes and licence are pinned to the same Media Lab revision', async context => {
    const entries = libraryMedia.filter(item => item.kim1Tape);
    assert.deepEqual(entries.map(item => [item.machine, item.kim1Tape.preset]), [
        ['kim1', 'ram-check'], ['kim1', 'video']
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
