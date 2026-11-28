// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {libraryLicenseUrl, libraryMedia, openLibraryMedia} from '../overlay/scratch-gui/src/lib/bw-machines/library-media.js';
import {runMachineConfig} from '../overlay/scratch-gui/src/lib/bw-machines/run-machine.js';

const releases = [
    ['f83', 'LicenseRef-Public-Domain', 'PUBLIC-DOMAIN.txt', 'f83.com'],
    ['volksforth', 'BSD-2-Clause', 'LICENSE', 'volks4th.com']
];

test('the reviewed Forth entries launch distinct checksum-pinned 8086 COM programs', async t => {
    const bytes = Uint8Array.of(0x90, 0xc3);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const github = 'https://raw.githubusercontent.com/';
    const upstream = 'https://raw.githubusercontent.com/forth/test/8482c3a6fdfb273851c177e46f1f568b65e223a7/';
    let requested;
    let expectedEntry;
    let intact = true;
    const fetch = t.mock.method(globalThis, 'fetch', async href => {
        requested = href;
        const [id, license, , file] = expectedEntry;
        if (href === upstream + file) return new Response(intact ? bytes : Uint8Array.of(0));
        return new Response(JSON.stringify({title: id, machine: 'i8086', license,
            program: {kind: 'dos', variant: '8086'}, slots: {com: {url: upstream + file, sha256}}}));
    });
    for (const release of releases) {
        expectedEntry = release;
        const [id, license, notice, file] = release;
        const item = libraryMedia.find(entry => entry.id === id);
        assert.equal(item.machine, 'i8086');
        assert.equal(item.license, license);
        assert.match(item.revision, /^[a-f0-9]{40}$/);
        const base = `${github}CrispStrobe/brickwright-media-lab/${item.revision}/projects/${id}/`;
        assert.equal(libraryLicenseUrl(item), base + notice);
        const config = await openLibraryMedia(item);
        assert.equal(requested, base + 'brickwright-media.json');
        await runMachineConfig(config, {
            dispatch: detail => {
                assert.equal(detail.slotId, 'com');
                assert.equal(detail.kind, 'i8086');
                assert.equal(detail.dosVariant, '8086');
                assert.deepEqual(detail.bytes, bytes);
            }
        });
        assert.equal(requested, upstream + file);
        intact = false;
        await assert.rejects(runMachineConfig(config, {dispatch: () => assert.fail('invalid bytes dispatched')}),
            /com: sha256 mismatch/);
        intact = true;
    }
    assert.equal(fetch.mock.callCount(), 6);
});
