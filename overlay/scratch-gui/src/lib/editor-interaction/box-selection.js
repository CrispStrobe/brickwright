// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
// Shared by Robots and CAD. No DOM, model, coordinate-system or three.js dependency.

/** @typedef {{x:number,y:number,z:number,w:number}} ClipPoint */
/** @typedef {{left:number,right:number,top:number,bottom:number}} Rectangle */

/**
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @returns {Rectangle}
 */
export const selectionRectangle = (x0, y0, x1, y1) => ({
    left: Math.min(x0, x1), right: Math.max(x0, x1),
    top: Math.min(y0, y1), bottom: Math.max(y0, y1)
});

/**
 * Does a projected world bounding box overlap a canvas-local rectangle?
 * Corners are homogeneous clip coordinates, ordered by nested x/y/z loops.
 * Clip the twelve edges to the near/far planes before dividing by w: boxes
 * behind the eye must not select, and boxes crossing the near plane stay finite.
 * @param {ClipPoint[]} corners
 * @param {Rectangle} rectangle
 * @param {{width:number,height:number}} viewport
 */
export const projectedBoxIntersects = (corners, rectangle, viewport) => {
    if (corners.length !== 8 || viewport.width <= 0 || viewport.height <= 0 ||
        corners.some(p => ![p.x, p.y, p.z, p.w].every(Number.isFinite))) return false;
    const points = [];
    for (let i = 0; i < 8; i++) {
        for (const bit of [1, 2, 4]) {
            if (i & bit) continue;
            const a = corners[i], b = corners[i | bit];
            let start = 0, end = 1;
            for (const sign of [-1, 1]) {
                const da = a.w + sign * a.z, db = b.w + sign * b.z;
                if (da < 0 && db < 0) { end = -1; break; }
                if (da < 0) start = Math.max(start, da / (da - db));
                if (db < 0) end = Math.min(end, da / (da - db));
            }
            if (start > end) continue;
            for (const t of [start, end]) {
                const w = a.w + (b.w - a.w) * t;
                if (w <= 0) continue;
                points.push({x: (a.x + (b.x - a.x) * t) / w, y: (a.y + (b.y - a.y) * t) / w});
            }
        }
    }
    if (!points.length || rectangle.right < 0 || rectangle.bottom < 0 ||
        rectangle.left > viewport.width || rectangle.top > viewport.height) return false;
    const xs = points.map(p => (p.x + 1) * viewport.width / 2);
    const ys = points.map(p => (1 - p.y) * viewport.height / 2);
    return Math.max(...xs) >= Math.max(0, rectangle.left) && Math.min(...xs) <= Math.min(viewport.width, rectangle.right) &&
        Math.max(...ys) >= Math.max(0, rectangle.top) && Math.min(...ys) <= Math.min(viewport.height, rectangle.bottom);
};
