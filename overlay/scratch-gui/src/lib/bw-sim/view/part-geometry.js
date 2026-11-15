// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// Build three.js geometry for a single LDraw part, the way LEGO CAD tools
// (LDView, LeoCAD, Studio) draw it:
//
//   - faces: triangulated, wound counter-clockwise from outside (flattenPart
//     resolves LDraw BFC), with CREASED normals: a vertex averages the normals
//     of the faces around it that meet at less than CREASE_DEG, so cylinders,
//     tyres and a beam's round ends shade smoothly while a beam's flat sides
//     and its hole rims stay crisp;
//   - edges: the part's own type-2 lines, the dark outlines LDraw authors
//     draw on every crease (drawn in the colour's LDConfig EDGE value);
//   - conditional edges: type-5 lines, shown only where they are a silhouette
//     (part-style.js's conditionalEdgeMaterial), which outlines curved surfaces.
//
// Every geometry has two draw groups: group 0 is in the part's own colour
// (LDraw 16, coloured by the material per placement), group 1 holds colours
// the part fixes itself (a printed face, a motor's drive hub), coloured by
// vertex colours so they are never tinted by the placed colour.
//
// Cached per part name (and piece), never per placement; geometry is in
// metres, LDraw → world (x, -y, -z)*0.0004, a proper rotation that keeps winding.

import {BufferGeometry, Color, Float32BufferAttribute} from 'three';
import {flattenPart, refKey} from '../ldraw/ldraw-geometry.js';
import {visualAssembly} from '../ldraw/visual-assemblies.js';
import {phasedMotorRead} from '../ldraw/motor-phase.js';
export {driveHubRef} from '../ldraw/motor-phase.js';

const LDU_M = 0.0004;

/** Faces meeting at less than this angle share a smooth normal (LDView's default smoothing is 30–40°). */
export const CREASE_DEG = 35;

const cache = new Map();

/** LDraw colours are sRGB hex; vertex colours must be in three's linear working space. */
const linearRgb = hex => new Color(hex).toArray();

const toWorld = v => [v[0] * LDU_M, -v[1] * LDU_M, -v[2] * LDU_M];

/**
 * Per-vertex creased normals for a non-indexed triangle list (positions in
 * metres). Vertices are matched by position (quantised to 1e-7 m = 0.00025 LDU,
 * far below LDraw's own precision); each vertex sums the unit normals of the
 * faces at its position whose normal lies within `creaseDeg` of its own face's
 * normal. Like three's toCreasedNormals, but that one quantises to 1 cm, which
 * merges whole Technic holes at our metre scale.
 * @param {Float32Array} positions
 * @param {number} creaseDeg
 * @returns {Float32Array}
 */
export const creasedNormals = (positions, creaseDeg = CREASE_DEG) => {
    const faces = positions.length / 9;
    const faceN = new Float64Array(faces * 3);
    for (let f = 0; f < faces; f++) {
        const o = f * 9;
        const e1x = positions[o + 3] - positions[o], e1y = positions[o + 4] - positions[o + 1], e1z = positions[o + 5] - positions[o + 2];
        const e2x = positions[o + 6] - positions[o], e2y = positions[o + 7] - positions[o + 1], e2z = positions[o + 8] - positions[o + 2];
        const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
        const len = Math.hypot(nx, ny, nz);
        // Degenerate triangles keep a zero normal and smooth with nothing.
        if (len > 0) {
            faceN[f * 3] = nx / len;
            faceN[f * 3 + 1] = ny / len;
            faceN[f * 3 + 2] = nz / len;
        }
    }
    const key = i => `${Math.round(positions[i * 3] * 1e7)},${Math.round(positions[i * 3 + 1] * 1e7)},${Math.round(positions[i * 3 + 2] * 1e7)}`;
    const at = new Map(); // position key → face indices
    const keys = new Array(faces * 3);
    for (let i = 0; i < faces * 3; i++) {
        const k = key(i);
        keys[i] = k;
        const list = at.get(k);
        if (list) list.push(i / 3 | 0);
        else at.set(k, [i / 3 | 0]);
    }
    const minDot = Math.cos(creaseDeg * Math.PI / 180);
    const out = new Float32Array(positions.length);
    for (let i = 0; i < faces * 3; i++) {
        const f = i / 3 | 0;
        const fx = faceN[f * 3], fy = faceN[f * 3 + 1], fz = faceN[f * 3 + 2];
        let sx = 0, sy = 0, sz = 0;
        const seen = new Set();
        for (const g of at.get(keys[i])) {
            if (seen.has(g)) continue; // a face touching the point twice counts once
            seen.add(g);
            const gx = faceN[g * 3], gy = faceN[g * 3 + 1], gz = faceN[g * 3 + 2];
            if (fx * gx + fy * gy + fz * gz >= minDot) {
                sx += gx;
                sy += gy;
                sz += gz;
            }
        }
        const len = Math.hypot(sx, sy, sz) || 1;
        out[i * 3] = sx / len;
        out[i * 3 + 1] = sy / len;
        out[i * 3 + 2] = sz / len;
    }
    return out;
};

/** The colour a line is drawn in, or null when it follows the placed colour (group 0). */
const lineRgb = (code, direct, colors) => {
    if (code === 16 || !colors.has(code)) return null;
    const info = colors.get(code);
    return linearRgb(direct ? info.value : info.edge);
};

const facesGeometry = (flat, colors) => {
    // Group 0: polygons in the part's own colour (LDraw 16); group 1: fixed colours.
    const out = [0, 1].map(() => ({positions: [], colors: [], uses: [], triColor: []}));
    for (let i = 0; i < flat.polys.length; i++) {
        const poly = flat.polys[i];
        const col = flat.polyColours[i];
        const tris = poly.length === 3 ? [[0, 1, 2]] : [[0, 1, 2], [0, 2, 3]];
        const fixed = col !== 16 && colors.has(col);
        const o = out[fixed ? 1 : 0];
        const rgb = fixed ? linearRgb(colors.get(col).value) : [1, 1, 1];
        for (const tri of tris) {
            for (const v of tri) {
                o.positions.push(...toWorld(poly[v]));
                o.colors.push(rgb[0], rgb[1], rgb[2]);
                o.uses.push(fixed ? 0 : 1);
            }
            o.triColor.push(col);
        }
    }
    const cat = k => [...out[0][k], ...out[1][k]];
    const positions = new Float32Array(cat('positions'));
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new Float32BufferAttribute(creasedNormals(positions), 3));
    geo.setAttribute('color', new Float32BufferAttribute(new Float32Array(cat('colors')), 3));
    geo.setAttribute('usesPartColour', new Float32BufferAttribute(new Float32Array(cat('uses')), 1));
    const ownVertices = out[0].positions.length / 3;
    const fixedVertices = out[1].positions.length / 3;
    if (ownVertices) geo.addGroup(0, ownVertices, 0);
    if (fixedVertices) geo.addGroup(ownVertices, fixedVertices, 1);
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    geo.userData.triColor = cat('triColor');
    return geo;
};

/**
 * Lines (type 2, or type 5 with `conditional`) as a LineSegments geometry with
 * the same two groups as the faces. Group 0 is drawn in the placed colour's
 * edge (edgeMaterial); group 1 carries its colour per vertex.
 */
const linesGeometry = (lines, codes, direct, colors, conditional) => {
    const out = [0, 1].map(() => ({positions: [], colors: [], c0: [], c1: [], dir: []}));
    for (let i = 0; i < lines.length; i++) {
        const rgb = lineRgb(codes[i], direct[i], colors);
        const o = out[rgb ? 1 : 0];
        const [a, b, c0, c1] = lines[i].map(toWorld);
        for (const p of [a, b]) {
            o.positions.push(...p);
            o.colors.push(...(rgb || [1, 1, 1]));
            if (conditional) {
                o.c0.push(...c0);
                o.c1.push(...c1);
                o.dir.push(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
            }
        }
    }
    const geo = new BufferGeometry();
    const attr = (name, k) => geo.setAttribute(name, new Float32BufferAttribute(new Float32Array([...out[0][k], ...out[1][k]]), 3));
    attr('position', 'positions');
    attr('color', 'colors');
    if (conditional) {
        attr('control0', 'c0');
        attr('control1', 'c1');
        attr('direction', 'dir');
    }
    const own = out[0].positions.length / 3;
    const fixed = out[1].positions.length / 3;
    if (own) geo.addGroup(0, own, 0);
    if (fixed) geo.addGroup(own, fixed, 1);
    geo.computeBoundingSphere();
    return geo;
};

/**
 * A part's drawable geometry: faces, edges and conditional edges.
 *
 * `piece` draws only part of the part file: {ref, take: 'ref'} is its
 * type-1 reference number `ref` (a motor's drive hub), {ref, take: 'rest'}
 * everything else (the housing). Cached per part and piece.
 *
 * @param {string} name  e.g. '32524.dat'
 * @param {(path: string) => string|undefined} read
 * @param {Map<number, {value: string, edge: string, alpha: number}>} colors
 * @param {{ref: number, take: 'ref'|'rest'}|null} [piece]
 * @returns {{faces: BufferGeometry, edges: BufferGeometry, conditional: BufferGeometry}}
 */
export const partVisual = (name, read, colors, piece = null) => {
    const key = name.toLowerCase() + (piece?.ref !== undefined ? `#${piece.take}${piece.ref}` : '') + `@${piece?.rotor?.angle || 0}`;
    if (cache.has(key)) return cache.get(key);
    const source = piece?.rotor ? phasedMotorRead(name, read, piece.rotor.meta, piece.rotor.angle) : read;
    const flat = flattenPart(visualAssembly(name), source, piece?.ref !== undefined ? {topRef: i => (i === piece.ref) === (piece.take === 'ref'), topOwn: piece.take === 'rest'} : {});
    const visual = {
        faces: flat.polys.length ? facesGeometry(flat, colors) : new BufferGeometry(),
        edges: linesGeometry(flat.edges, flat.edgeColours, flat.edgeDirect, colors, false),
        conditional: linesGeometry(flat.optional, flat.optionalColours, flat.optionalDirect, colors, true)
    };
    // A part whose own file is not there yet (one being added from the LDraw catalogue, its
    // files on the way) is drawn empty this once and not remembered, so the next draw has it.
    if (!flat.missing.includes(refKey(name))) cache.set(key, visual);
    return visual;
};

/**
 * Which type-1 reference of a motor's LDraw file is its turning drive hub.
 * LDraw draws a SPIKE motor as housing + hub sub-files (54696p01 → u9364c01 +
 * u9363p01); the part metadata says which colliders turn with the output
 * (motor.outputColliders). The hub is the reference whose placed extent holds
 * the centres of all output colliders, the smallest one if several do.
 * @param {string} name e.g. '54696p01.dat'
 * @param {(path: string) => string|undefined} read
 * @param {object} meta the part's PartMeta (a motor: its turning joint's movingColliders)
 * @returns {number} the reference's index in file order, or -1
 */

/**
 * The part's face geometry (see partVisual).
 * @returns {BufferGeometry}
 */
export const partGeometry = (name, read, colors, piece = null) => partVisual(name, read, colors, piece).faces;

export const _clearCache = () => cache.clear();
