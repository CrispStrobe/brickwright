// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {packRobotBuildLDraw} from '../scripts/pack-robot-build-ldraw.mjs';
import {fetchBuildLDraw} from '../overlay/scratch-gui/src/lib/bw-sim/ldraw/build-pack.js';

const root = new URL('../overlay/scratch-gui/', import.meta.url);
const packPath = 'static/sim-lab/robot-build-ldraw.pack';
const local = url => {
    try {
        return new Response(readFileSync(new URL(url, root)));
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        return new Response(null, {status: 404});
    }
};
const parts = ['45601.dat', '54696p01.dat', 'chess_custom_board_gasket_00.dat'];

test('the packed Build drawing matches the checked-in source and avoids individual requests', async () => {
    packRobotBuildLDraw({check: true});
    const requests = [];
    const packed = await fetchBuildLDraw(parts, {
        fetchImpl: async url => {
            requests.push(url.split('?')[0]);
            return local(url);
        }
    });
    const unpacked = await fetchBuildLDraw(parts, {fetchImpl: async url => local(url), Decompress: null});
    assert.deepEqual(requests, [packPath]);
    assert.deepEqual(packed.files, unpacked.files);
    assert.deepEqual(packed.missing, []);
});

test('a missing or unreadable pack still loads the original geometry', async () => {
    const expected = await fetchBuildLDraw(parts, {fetchImpl: async url => local(url), Decompress: null});
    for (const response of [new Response(null, {status: 404}), new Response('invalid gzip')]) {
        const result = await fetchBuildLDraw(parts, {
            fetchImpl: async url => url.startsWith(packPath) ? response : local(url)
        });
        assert.deepEqual(result.files, expected.files);
        assert.deepEqual(result.missing, expected.missing);
    }
});
