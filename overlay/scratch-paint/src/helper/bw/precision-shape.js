// SPDX-License-Identifier: BSD-3-Clause
import paper from '@scratch/paper';
import {DEFAULT_COLOR} from '../../reducers/fill-style';
import {ART_BOARD_WIDTH, SVG_ART_BOARD_WIDTH, CENTER, MAX_WORKSPACE_BOUNDS} from '../view';

export const ART_BOARD_UNITS_PER_COSTUME_UNIT = ART_BOARD_WIDTH / SVG_ART_BOARD_WIDTH;

const toRadians = degrees => degrees * Math.PI / 180;
const toCanvas = ([x, y]) => new paper.Point(CENTER.x + x * ART_BOARD_UNITS_PER_COSTUME_UNIT,
    CENTER.y + y * ART_BOARD_UNITS_PER_COSTUME_UNIT);

const strokeGeometry = draft => {
    const {kind, x, y, stroke} = draft;
    if (![x, y, stroke].every(Number.isFinite) || stroke < .01) return null;
    if (kind === 'line') {
        const {endX, endY} = draft;
        if (![endX, endY].every(Number.isFinite) || Math.hypot(endX - x, endY - y) < .01) return null;
        return {points: [[x, y], [endX, endY]], stroke};
    }
    const {radius, startAngle, sweep} = draft;
    if (![radius, startAngle, sweep].every(Number.isFinite) || radius < .01 || Math.abs(sweep) < .01 ||
        Math.abs(sweep) >= 360 || radius * toRadians(Math.abs(sweep)) < .01) return null;
    const start = startAngle % 360;
    const end = start + sweep;
    const low = Math.min(start, end), high = Math.max(start, end);
    const quarters = [];
    for (let angle = (Math.floor(low / 90) + 1) * 90; angle < high; angle += 90) {
        if (angle - low > 1e-9 && high - angle > 1e-9) quarters.push(angle);
    }
    const angles = [start, ...(sweep > 0 ? quarters : quarters.reverse()), end].map(toRadians);
    const points = angles.map(angle => [x + radius * Math.cos(angle), y + radius * Math.sin(angle)]);
    return {points, angles, radius, stroke};
};

const precisionGeometry = draft => {
    const {kind, x, y, width, height} = draft;
    const units = ART_BOARD_UNITS_PER_COSTUME_UNIT;
    if (kind === 'line' || kind === 'arc') {
        const geometry = strokeGeometry(draft);
        if (!geometry) return null;
        const xs = geometry.points.map(point => point[0]), ys = geometry.points.map(point => point[1]);
        const left = Math.min(...xs), top = Math.min(...ys), half = geometry.stroke / 2;
        const bounds = new paper.Rectangle(CENTER.x + (left - half) * units, CENTER.y + (top - half) * units,
            (Math.max(...xs) - left + geometry.stroke) * units, (Math.max(...ys) - top + geometry.stroke) * units);
        return MAX_WORKSPACE_BOUNDS.contains(bounds) ? {...geometry, bounds} : null;
    }
    if (kind !== 'rectangle' && kind !== 'circle') return null;
    const h = kind === 'circle' ? width : height;
    if (![x, y, width, h].every(Number.isFinite) || width < .01 || h < .01) return null;
    const bounds = new paper.Rectangle(CENTER.x + (x - width / 2) * units,
        CENTER.y + (y - h / 2) * units, width * units, h * units);
    return MAX_WORKSPACE_BOUNDS.contains(bounds) ? {bounds} : null;
};

/** Convert exact costume units to the same center-based coordinates used by Transform. */
export const precisionShapeBounds = draft => precisionGeometry(draft)?.bounds ?? null;

const createStroke = geometry => {
    const {points, angles, stroke, radius} = geometry;
    const units = ART_BOARD_UNITS_PER_COSTUME_UNIT;
    const segments = angles ? angles.map((angle, index) => {
        // Cubic sub-arcs end at each quadrant, keeping their axis extrema exact.
        const tangent = new paper.Point(-Math.sin(angle), Math.cos(angle));
        const handle = delta => tangent.multiply((4 / 3) * Math.tan(delta / 4) * radius * units);
        return new paper.Segment(toCanvas(points[index]), handle((angles[index - 1] ?? angle) - angle),
            handle((angles[index + 1] ?? angle) - angle));
    }) : points.map(toCanvas);
    return new paper.Path({segments, insert: false, strokeColor: DEFAULT_COLOR, strokeWidth: stroke * units,
        strokeCap: 'round'});
};

export const insertPrecisionShape = draft => {
    const layer = paper.project?.activeLayer;
    const geometry = precisionGeometry(draft);
    if (!layer?.data?.isPaintingLayer || !geometry) return false;
    const {bounds} = geometry;
    let shape;
    if (geometry.points) {
        shape = createStroke(geometry);
    } else if (draft.kind === 'circle') {
        shape = new paper.Path.Circle({center: bounds.center, radius: bounds.width / 2, insert: false});
        shape.data.bwPrecisionCircle = true;
    } else {
        shape = new paper.Path.Rectangle({rectangle: bounds, insert: false});
    }
    if (!geometry.points) shape.fillColor = DEFAULT_COLOR;
    if (draft.kind === 'arc') shape.data.bwPrecisionArc = true;
    paper.project.deselectAll();
    layer.addChild(shape);
    shape.selected = true;
    return true;
};

const CIRCLE_HANDLE = 4 * (Math.sqrt(2) - 1) / 3;
// Paper rounds coordinates in its Undo snapshots and SVG. Allow that rounding
// without treating a reshaped path as an analytic circle.
const CIRCLE_ROUNDING = .00005;

/** Keep a precision circle analytic in SVG while its Paper path remains editable. */
export const exportPrecisionCircle = (item, node) => {
    if (!(item instanceof paper.Path) || !item.data?.bwPrecisionCircle || !item.closed || item.segments.length !== 4)
        return node;
    const segments = item.segments;
    const center = segments[0].point.add(segments[2].point).divide(2);
    const start = segments[0].point.subtract(center);
    const turn = Math.sign(start.cross(segments[1].point.subtract(center)));
    if (!turn || start.length <= 0) return node;
    const close = (a, b) => a.getDistance(b) <= CIRCLE_ROUNDING;
    const offsets = segments.map((_, index) => start.rotate(turn * 90 * index));
    const circlePath = segments.every((segment, index) =>
        close(segment.point,center.add(offsets[index])) &&
        close(segment.handleIn,offsets[(index + 3) % 4].multiply(CIRCLE_HANDLE)) &&
        close(segment.handleOut,offsets[(index + 1) % 4].multiply(CIRCLE_HANDLE)));
    if (!circlePath) return node;
    const circle = node.ownerDocument.createElementNS(node.namespaceURI, 'circle');
    circle.setAttribute('cx', String(center.x));
    circle.setAttribute('cy', String(center.y));
    circle.setAttribute('r', String(start.length));
    if (node.hasAttribute('transform')) circle.setAttribute('transform', node.getAttribute('transform'));
    // Paper applies the original item's style and serialized data to this replacement node.
    return circle;
};
