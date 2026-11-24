// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// Ropes drawn (editor/rope-path.js lays them; kinds/rope.js and physics/rope.js simulate them): a
// thin dark tube from the drum's centre over each sheave to the hook. Build draws the model's
// ropes where they are; Simulate (createSimRopes) draws each from the bodies' points every frame,
// so the hook swings and rises on it. A slack rope is drawn straight: the line, not its sag.

import {CatmullRomCurve3, TubeGeometry, Vector3} from 'three';
import {lduToWorld} from '../contracts.js';
import {createTubeLayer} from './tube-layer.js';

const ROPE_RADIUS_M = 0.0006;
const ROPE_COLOR = 0x2b2b2b;

/** A group of rope meshes whose points are in world metres. */
export const createRopeLayer = () => createTubeLayer({
    name: 'ropes', prefix: 'rope', color: ROPE_COLOR, roughness: 0.9, toWorld: point => point,
    geometryOf: points => new TubeGeometry(new CatmullRomCurve3(points, false, 'catmullrom', 0),
        8 * (points.length - 1), ROPE_RADIUS_M, 5, false)
});

/** Build: the model's ropes from their points (LDU). */
export const ropesFromModel = (model, pointsOf) => (model.ropes || []).map(r => {
    const pts = pointsOf(r);
    return {id: r.id, points: pts ? pts.map(lduToWorld) : null};
});

/**
 * Simulate: each 'rope' coupling drawn from its bodies every update(). null without a rope.
 * @param {{mechanism, built: {scene, bodyGroups: Map}}} args
 */
export const createSimRopes = ({mechanism, built}) => {
    const ropes = (mechanism.couplings || []).filter(c => c.kind === 'rope');
    if (!ropes.length) return null;
    const layer = createRopeLayer();
    built.scene.add(layer.group);
    const v = new Vector3();
    const worldOf = p => {
        const g = built.bodyGroups.get(p.body);
        if (!g) return null;
        g.updateWorldMatrix(true, false);
        return v.set(...p.local).applyMatrix4(g.matrixWorld).toArray();
    };
    const update = () => layer.draw(ropes.map(c => {
        const pts = [...c.points, c.hook].map(worldOf);
        return {id: c.id, points: pts.every(Boolean) ? pts : null};
    }));
    update();
    return {update, dispose: () => layer.dispose(), get count () { return layer.count; }};
};
