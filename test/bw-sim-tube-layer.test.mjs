// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Vector3} from 'three';
import {lduToWorld} from '../overlay/scratch-gui/src/lib/bw-sim/contracts.js';
import {createHoseLayer} from '../overlay/scratch-gui/src/lib/bw-sim/view/hose-layer.js';
import {createRopeLayer} from '../overlay/scratch-gui/src/lib/bw-sim/view/rope-layer.js';

for (const {name, create, toWorld} of [
    {name: 'rope', create: createRopeLayer, toWorld: point => point},
    {name: 'hose', create: createHoseLayer, toWorld: lduToWorld}
]) {
    test(`${name} meshes keep their buffers through translation and deformation`, () => {
        const layer = create();
        try {
            const id = 'a';
            const points = [[0.02, 0, 0], [0.03, 0.01, 0], [0.06, 0, 0.01]];
            layer.draw([{id, points}]);
            const mesh = layer.group.children[0];
            const geometry = mesh.geometry;
            const positions = geometry.getAttribute('position');
            const normals = geometry.getAttribute('normal');
            const index = geometry.index;
            const before = positions.array.slice();
            const shift = [0.12, 0.02, -0.04];
            const translated = points.map(point => point.map((value, axis) => value + shift[axis]));
            layer.draw([{id, points: translated}]);
            assert.equal(layer.count, 1);
            assert.equal(layer.group.children[0], mesh);
            assert.equal(mesh.geometry, geometry);
            assert.equal(positions.version, 0);
            assert.deepEqual(positions.array, before);
            assert.ok(mesh.position.distanceTo(new Vector3(...toWorld(translated[0]))) < 1e-12);

            translated[1][1] += 0.06;
            geometry.computeBoundingSphere();
            layer.draw([{id, points: translated}]);
            assert.equal(mesh.geometry, geometry);
            assert.equal(geometry.index, index);
            assert.equal(geometry.getAttribute('position'), positions);
            assert.equal(geometry.getAttribute('normal'), normals);
            assert.equal(positions.version, 1);
            assert.equal(normals.version, 1);
            assert.notDeepEqual(positions.array, before);
            assert.equal(geometry.boundingSphere, null);
            const curve = geometry.parameters.path;
            assert.ok(mesh.localToWorld(curve.getPoint(1)).distanceTo(new Vector3(...toWorld(translated[2]))) < 1e-12);

            let disposals = 0;
            geometry.addEventListener('dispose', () => disposals++);
            layer.draw([]);
            assert.equal(layer.count, 0);
            assert.equal(layer.group.children.length, 0);
            assert.equal(disposals, 1);
        } finally {
            layer.dispose();
        }
    });
}

test('adding a rope guide resizes the buffers without replacing the mesh', () => {
    const layer = createRopeLayer();
    try {
        const points = [[0, 0, 0], [0.02, 0.01, 0]];
        layer.draw([{id: 'a', points}]);
        const mesh = layer.group.children[0];
        const original = mesh.geometry;
        let disposals = 0;
        original.addEventListener('dispose', () => disposals++);
        layer.draw([{id: 'a', points: [...points, [0.03, 0, 0.01]]}]);
        assert.equal(layer.group.children[0], mesh);
        assert.notEqual(mesh.geometry, original);
        assert.ok(mesh.geometry.index.count > original.index.count);
        assert.equal(disposals, 1);
    } finally {
        layer.dispose();
    }
});
