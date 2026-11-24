// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// Pneumatic hoses drawn (editor/hose-path.js lays them): a blue tube from one nozzle to the other.
// Build draws the model's hoses; Simulate (createSimHoses) draws each from the bodies the two parts
// ride on, every frame, so a hose follows a moving cylinder.

import {CatmullRomCurve3, Matrix4, TubeGeometry, Vector3} from 'three';
import {LDU_M, lduToWorld} from '../contracts.js';
import {hoseCurve, placedPorts} from '../editor/hose-path.js';
import {createTubeLayer} from './tube-layer.js';

const HOSE_RADIUS_M = 0.0018;
const HOSE_COLOR = 0x3c78c8;

/** A group of hose meshes whose points are in LDraw units. */
export const createHoseLayer = () => createTubeLayer({
    name: 'hoses', prefix: 'hose', color: HOSE_COLOR, roughness: 0.6, toWorld: lduToWorld,
    geometryOf: points => new TubeGeometry(new CatmullRomCurve3(points, false, 'centripetal'), 32, HOSE_RADIUS_M, 6, false)
});

const worldToLdu = v => [v.x / LDU_M, -v.y / LDU_M, -v.z / LDU_M];

/**
 * Simulate: the model's hoses, each end on the body its part rides on, redrawn every update(). null without one.
 * @param {{model, mechanism, catalog: Map|object, built: {scene, bodyGroups: Map}}} args
 */
export const createSimHoses = ({model, mechanism, catalog, built}) => {
    if (!model.hoses || !model.hoses.length || !catalog) return null;
    const metaOf = part => (catalog instanceof Map ? catalog.get(part) : catalog[part]);
    const byId = new Map(model.parts.map(p => [p.id, p]));
    const bodyOf = id => (mechanism.bodies || []).find(b => b.parts.includes(id));
    const hoses = [];
    for (const h of model.hoses) {
        const ends = [];
        for (const e of [h.a, h.b]) {
            const pl = byId.get(e.part);
            const port = pl && placedPorts(pl, metaOf(pl.part)).find(x => x.id === e.port);
            const body = pl && bodyOf(pl.id);
            const g = body && built.bodyGroups.get(body.id);
            if (!port || !g) break;
            g.updateWorldMatrix(true, false);
            const inv = new Matrix4().copy(g.matrixWorld).invert();
            const at = new Vector3(...lduToWorld(port.at)).applyMatrix4(inv);
            const tip = new Vector3(...lduToWorld(port.at.map((v, i) => v + port.out[i]))).applyMatrix4(inv);
            ends.push({g, at, tip});
        }
        if (ends.length === 2) hoses.push({id: h.id, ends});
    }
    if (!hoses.length) return null;
    const layer = createHoseLayer();
    built.scene.add(layer.group);
    const p = new Vector3();
    const q = new Vector3();
    const update = () => layer.draw(hoses.map(h => {
        const [a, b] = h.ends.map(e => {
            e.g.updateWorldMatrix(true, false);
            const at = worldToLdu(p.copy(e.at).applyMatrix4(e.g.matrixWorld));
            const tip = worldToLdu(q.copy(e.tip).applyMatrix4(e.g.matrixWorld));
            return {at, out: tip.map((v, i) => v - at[i])};
        });
        return {id: h.id, points: hoseCurve(a.at, a.out, b.at, b.out)};
    }));
    update();
    return {update, dispose: () => layer.dispose(), get count () { return layer.count; }};
};
