// SPDX-License-Identifier: BSD-3-Clause
import paper from '@scratch/paper';
import {DEFAULT_COLOR} from '../../reducers/fill-style';
import {ART_BOARD_WIDTH, SVG_ART_BOARD_WIDTH, CENTER, MAX_WORKSPACE_BOUNDS} from '../view';

export const ART_BOARD_UNITS_PER_COSTUME_UNIT = ART_BOARD_WIDTH / SVG_ART_BOARD_WIDTH;

/** Convert exact costume units to the same center-based coordinates used by Transform. */
export const precisionShapeBounds = ({kind, x, y, width, height}) => {
    if (kind !== 'rectangle' && kind !== 'circle') return null;
    const h = kind === 'circle' ? width : height;
    if (![x, y, width, h].every(Number.isFinite) || width < .01 || h < .01) return null;
    const units = ART_BOARD_UNITS_PER_COSTUME_UNIT;
    const bounds = new paper.Rectangle(CENTER.x + (x - width / 2) * units,
        CENTER.y + (y - h / 2) * units, width * units, h * units);
    return MAX_WORKSPACE_BOUNDS.contains(bounds) ? bounds : null;
};

export const insertPrecisionShape = draft => {
    const layer = paper.project?.activeLayer;
    const bounds = precisionShapeBounds(draft);
    if (!layer?.data?.isPaintingLayer || !bounds) return false;
    const shape = draft.kind === 'circle' ?
        new paper.Path.Circle({center: bounds.center, radius: bounds.width / 2, insert: false}) :
        new paper.Path.Rectangle({rectangle: bounds, insert: false});
    shape.fillColor = DEFAULT_COLOR;
    if (draft.kind === 'circle') shape.data.bwPrecisionCircle = true;
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
