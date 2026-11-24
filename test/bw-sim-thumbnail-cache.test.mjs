// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readPartThumbnail, writePartThumbnail} from '../overlay/scratch-gui/src/lib/bw-sim/view/part-thumbnail-cache.js';

test('generated thumbnails survive reinstantiation, keep build keys separate and evict old entries', async () => {
    const values = new Map();
    const cache = {
        put: async (key, value) => { values.set(key, value); },
        match: async key => values.get(key)?.clone(),
        keys: async () => [...values.keys()],
        delete: async key => values.delete(key)
    };
    const previous = globalThis.caches;
    const previousLocation = globalThis.location;
    globalThis.caches = {open: async () => cache};
    globalThis.location = {href: 'https://example.test/'};
    try {
        const image = 'data:image/png;base64,AA==';
        await writePartThumbnail('release-a:128:beam', image);
        assert.equal(await readPartThumbnail('release-a:128:beam'), image);
        assert.equal(await readPartThumbnail('release-b:128:beam'), null);
        for (let n = 0; n < 384; n++) await writePartThumbnail(`release-b:128:${n}`, image);
        assert.equal(values.size, 384);
        assert.equal(await readPartThumbnail('release-a:128:beam'), null);
        assert.equal(await readPartThumbnail('release-b:128:383'), image);
        await writePartThumbnail('invalid', 'not a thumbnail');
        assert.equal(await readPartThumbnail('invalid'), null);
        globalThis.caches = {open: async () => { throw new Error('disabled'); }};
        assert.equal(await readPartThumbnail('release-b:128:383'), null);
        await writePartThumbnail('unavailable', image);
    } finally {
        globalThis.caches = previous;
        globalThis.location = previousLocation;
    }
});
