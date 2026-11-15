// SPDX-License-Identifier: BSD-3-Clause
/** The actual preview pose relative to the model, in the Robot viewport's
 * X/right, Y/up, Z/front frame. LDraw uses 0.4 mm/LDU and the opposite Y/Z.
 * Rotation is the shortest orientation change (0–180°), not accumulated turns.
 * Read-only: neither the preview nor the original model is changed. */
export const transformPreviewMetrics = (start, moves) => {
    if (!start || !moves?.length) return null;
    const before = new Map(start.map(part => [part.id, part]));
    const next = moves.find(part => before.has(part.id));
    if (!next) return null;
    const previous = before.get(next.id);
    const deltaMm = next.position.map((value, i) => (value - previous.position[i]) * (i === 0 ? 0.4 : -0.4));
    const dot = next.rotation.reduce((sum, value, i) => sum + value * previous.rotation[i], 0);
    const angleDegrees = Math.acos(Math.min(1, Math.max(-1, (dot - 1) / 2))) * 180 / Math.PI;
    if (![...deltaMm, angleDegrees].every(Number.isFinite)) return null;
    return {deltaMm: deltaMm.map(v => Math.abs(v) < 1e-8 ? 0 : v), distanceMm: Math.hypot(...deltaMm), angleDegrees: angleDegrees < 1e-5 ? 0 : angleDegrees};
};
