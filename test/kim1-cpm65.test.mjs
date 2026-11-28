// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {kim1CpmProfiles, readKim1CpmArchive} from '../overlay/scratch-gui/src/lib/bw-machines/kim1-cpm65.js';

test('CP/M-65 declares a separate pinned upstream archive and device for each drive', () => {
    assert.deepEqual(kim1CpmProfiles.map(({id, mount}) => ({id, mount})), [
        {id: 'sdcard', mount: 'mountSD'},
        {id: 'sdshield', mount: 'mountCorshamDisk'},
        {id: 'k1013', mount: 'mountK1013'}
    ]);
    for (const profile of kim1CpmProfiles) {
        assert.equal(profile.url, 'https://github.com/davidgiven/cpm65/releases/download/dev/kim-1-' + profile.id + '.zip');
        assert.match(profile.sha256, /^[a-f0-9]{64}$/);
    }
});

test('wrong profile and same-size corrupted archive fail before boot', async () => {
    const [spi, corsham] = kim1CpmProfiles;
    const file = new Blob([new Uint8Array(corsham.size)]);
    await assert.rejects(readKim1CpmArchive(spi.id, file), /pinned upstream ZIP/);
    await assert.rejects(readKim1CpmArchive(corsham.id, file), /checksum differs/);
    await assert.rejects(readKim1CpmArchive('unknown', file), /pinned upstream ZIP/);
});
