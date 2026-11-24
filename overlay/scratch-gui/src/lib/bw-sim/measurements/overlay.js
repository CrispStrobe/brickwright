// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
import {Matrix4, Vector3} from 'three';
import {measurementText} from './readings.js';
import {placeMeasurementLabel} from './layout.js';

const NS = 'http://www.w3.org/2000/svg';
const setAttribute = (element, name, value) => {
    if (element.getAttribute(name) !== value) element.setAttribute(name, value);
};
/** Separate from component/cable visibility. One SVG, no per-frame GPU resources. */
export const createMeasurementOverlay = ({container}) => {
    const svg = document.createElementNS(NS, 'svg');
    svg.dataset.testid = 'bw-sim-lab-measurement-overlay';
    Object.assign(svg.style, {position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'hidden'});
    container.appendChild(svg);
    const entries = new Map();
    const lastView = new Matrix4();
    const lastProjection = new Matrix4();
    let lastRows, lastWidth, lastHeight;
    const update = (rows, camera, width, height) => {
        if (!rows.length && !entries.size) return;
        // The pane replaces the rows on a read or edit. Camera and layout changes
        // can still move existing labels independently of a new sample.
        if (rows === lastRows && width === lastWidth && height === lastHeight &&
            lastView.equals(camera.matrixWorldInverse) && lastProjection.equals(camera.projectionMatrix)) return;
        lastRows = rows;
        lastWidth = width;
        lastHeight = height;
        lastView.copy(camera.matrixWorldInverse);
        lastProjection.copy(camera.projectionMatrix);
        const active = new Set();
        const occupied = [];
        for (const row of rows) {
            if (!row.visible || !row.available || !row.points.length) continue;
            const points = row.points.map(p => p.slice());
            // Explicit diagram scales: velocity 0.1 seconds; force 20 mm per newton.
            if (row.vector) points.push(points[0].map((v, i) => v + row.vector[i] * (row.kind === 'speed' ? 0.1 : 0.02)));
            const projected = points.map(p => new Vector3(...p).project(camera));
            if (projected.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.z < -1 || p.z > 1)) continue;
            active.add(row.id);
            let e = entries.get(row.id);
            if (!e) {
                const group = document.createElementNS(NS, 'g');
                group.dataset.measurementId = row.id;
                const line = document.createElementNS(NS, 'polyline');
                const text = document.createElementNS(NS, 'text');
                const title = document.createElementNS(NS, 'title');
                line.setAttribute('fill', 'none'); line.setAttribute('stroke', '#0891b2'); line.setAttribute('stroke-width', '2');
                text.setAttribute('fill', '#164e63'); text.setAttribute('stroke', 'white'); text.setAttribute('stroke-width', '4');
                text.setAttribute('paint-order', 'stroke'); text.setAttribute('font-size', '12');
                text.setAttribute('font-family', 'ui-monospace, monospace');
                group.appendChild(line); group.appendChild(text); group.appendChild(title); svg.appendChild(group);
                e = {group, line, text, title}; entries.set(row.id, e);
            }
            const xy = projected.map(p => [(p.x + 1) * width / 2, (1 - p.y) * height / 2]);
            const linePoints = xy.map(p => p.slice());
            if (row.vector && xy.length === 2) {
                const [a, b] = xy, dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy);
                if (n > 1) {
                    const ux = dx / n, uy = dy / n;
                    linePoints.push([b[0] - ux * 7 + uy * 4, b[1] - uy * 7 - ux * 4], b,
                        [b[0] - ux * 7 - uy * 4, b[1] - uy * 7 + ux * 4]);
                }
            }
            setAttribute(e.line, 'points', linePoints.map(p => p.join(',')).join(' '));
            const at = row.kind === 'distance' ? xy[0].map((v, i) => (v + xy[1][i]) / 2) : xy[Math.floor((xy.length - 1) / 2)];
            const label = `${row.label}: ${measurementText(row)}`;
            const [x, y] = placeMeasurementLabel(at, label, width, height, occupied);
            setAttribute(e.text, 'x', String(x));
            setAttribute(e.text, 'y', String(y));
            if (e.text.textContent !== label) e.text.textContent = label;
            const title = `${row.source}${row.vector ? row.kind === 'speed' ? '; vector × 0.1 s' : '; vector 20 mm/N' : ''}`;
            if (e.title.textContent !== title) e.title.textContent = title;
        }
        for (const [id, e] of entries) if (!active.has(id)) {e.group.remove(); entries.delete(id);}
    };
    return {update, dispose: () => {entries.clear(); svg.remove();}};
};
