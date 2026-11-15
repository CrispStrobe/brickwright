// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// One camera navigation for both Robot Lab views (Simulate: sim-view3d.js, Build:
// editor/editor-view3d.js), so the 3D view moves the same way in either mode:
//
//   middle-drag (Build); left-drag (Simulate) orbit about the target
//   right-drag, Shift+drag (Simulate)        pan (slide the view)
//   wheel                                    zoom toward the pointer
//   one finger / two fingers                 orbit / pinch-zoom and pan
//   arrow keys (3D view focused)             orbit in 15° steps
//   Shift+arrow keys                         pan by a tenth of the view
//   + / -                                    zoom in / out
//   Home / Fit / Top / Front / Side          the pane's view buttons
//
// In Build a press on a part, or on the gizmo, belongs to the part (editor-view3d.js
// decides first); Shift+drag there draws a selection box, so Build pans with the
// right button (or Shift+arrows, or two fingers). Empty-space left drag selects. The arithmetic here has no DOM
// and no three.js (test/bw-sim-camera-nav.test.mjs); the views apply it.

import {orbitOffset, panAmounts} from '../editor/touch-gestures.js';

/** How far one arrow key turns the view (radians). */
export const ORBIT_STEP = Math.PI / 12;
/** How far one Shift+arrow slides the view: this share of the view's height. */
export const PAN_STEP_SHARE = 0.1;
/** One + or - zooms by this factor of the distance. */
export const ZOOM_STEP = 0.8;

/**
 * The mouse presets (docs/ROBOT-LAB-UX.md §3.7): 'brickwright' (left or middle drag orbits, right
 * drag pans) and 'studio' (BrickLink Studio and LDD: right drag orbits, middle drag pans). Left drag
 * on empty space orbits in Simulate; in Build it draws a selection rectangle.
 */
export const MOUSE_PRESETS = Object.freeze({brickwright: 'brickwright', studio: 'studio'});
/** The mouse button that orbits about the point under the pointer in Build: middle, or right in 'studio'. */
export const orbitButtonOf = preset => (preset === 'studio' ? 2 : 1);

/** Where each named view looks from (a direction from the target, y up). */
export const VIEW_DIRECTIONS = {
    home: [1, 0.8, 1.2],
    top: [0, 1, 0.0001],
    front: [0, 0.0001, 1],
    side: [1, 0.0001, 0]
};

/**
 * three's OrbitControls set up the Robot Lab way (both views): left orbits, the
 * middle button orbits too, the right button pans, the wheel zooms toward the
 * pointer. `MOUSE` is three's enum (passed in, so this module needs no three).
 */
export const configureOrbitControls = (controls, MOUSE, preset = 'brickwright') => {
    controls.mouseButtons = MOUSE_PRESETS[preset] === 'studio' ? {LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.PAN, RIGHT: MOUSE.ROTATE} :
        {LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.ROTATE, RIGHT: MOUSE.PAN};
    controls.zoomToCursor = true;
    controls.screenSpacePanning = true;
    controls.enableDamping = false;
    return controls;
};

/**
 * What a key on a focused 3D view does to the camera, or null when it is not a
 * camera key. Ctrl/Cmd/Alt combinations are never camera keys.
 * @returns {{orbit: [number, number]}|{pan: [number, number]}|{zoom: number}|null}
 *   orbit: radians about the vertical and from it; pan: share of the view's height, right and up; zoom: distance factor
 */
export const cameraKeyAction = ({key, shiftKey = false, ctrlKey = false, metaKey = false, altKey = false}) => {
    if (ctrlKey || metaKey || altKey) return null;
    const arrows = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1]};
    const arrow = arrows[key];
    if (arrow) {
        // Shift slides the view the way the arrow points; plain arrows turn the model that way.
        if (shiftKey) return {pan: [arrow[0] * PAN_STEP_SHARE, arrow[1] * PAN_STEP_SHARE]};
        return {orbit: [-arrow[0] * ORBIT_STEP, arrow[1] * ORBIT_STEP]};
    }
    if (key === '+' || key === '=') return {zoom: ZOOM_STEP};
    if (key === '-' || key === '_') return {zoom: 1 / ZOOM_STEP};
    return null;
};

/**
 * Moves the camera as `action` says (cameraKeyAction's result). The camera keeps
 * looking at the controls' target; orbiting never goes under the floor.
 * @param {object} camera a three PerspectiveCamera
 * @param {object} controls three OrbitControls (its target, min/max distance and polar angle)
 * @param {object} action
 * @param {number} heightPx the view's height in CSS pixels
 * @returns {boolean} whether the camera moved
 */
export const applyCameraAction = (camera, controls, action, heightPx) => {
    if (!action) return false;
    const target = controls.target;
    const offset = [camera.position.x - target.x, camera.position.y - target.y, camera.position.z - target.z];
    const distance = Math.hypot(...offset);
    if (action.orbit) {
        const maxPolar = Number.isFinite(controls.maxPolarAngle) ? controls.maxPolarAngle : Math.PI / 2;
        const minPolar = Number.isFinite(controls.minPolarAngle) && controls.minPolarAngle > 0 ? controls.minPolarAngle : 1e-3;
        const next = orbitOffset(offset, action.orbit[0], -action.orbit[1], {minPolar, maxPolar});
        camera.position.set(target.x + next[0], target.y + next[1], target.z + next[2]);
    } else if (action.pan) {
        const px = Math.max(1, heightPx);
        const [right, up] = panAmounts(-action.pan[0] * px, action.pan[1] * px, distance, camera.fov, px);
        camera.updateMatrix();
        const m = camera.matrix.elements; // columns 0 and 1: the camera's right and up, in world space
        const shift = [m[0] * right + m[4] * up, m[1] * right + m[5] * up, m[2] * right + m[6] * up];
        camera.position.set(camera.position.x + shift[0], camera.position.y + shift[1], camera.position.z + shift[2]);
        target.set(target.x + shift[0], target.y + shift[1], target.z + shift[2]);
    } else if (action.zoom) {
        const min = Number.isFinite(controls.minDistance) ? controls.minDistance : 0;
        const max = Number.isFinite(controls.maxDistance) ? controls.maxDistance : Infinity;
        const wanted = Math.min(max, Math.max(min, distance * action.zoom));
        const k = distance ? wanted / distance : 1;
        camera.position.set(target.x + offset[0] * k, target.y + offset[1] * k, target.z + offset[2] * k);
    } else {
        return false;
    }
    camera.lookAt(target);
    controls.update();
    return true;
};

/**
 * Where the camera stands to show a sphere (centre, radius) whole from `direction`.
 * @returns {{position: number[], distance: number}}
 */
export const framePosition = ({centre, radius, direction, fovDeg, aspect, margin = 1.15}) => {
    const vHalf = fovDeg * Math.PI / 360;
    const hHalf = Math.atan(Math.tan(vHalf) * Math.max(1e-3, aspect));
    const distance = Math.max(0.02, radius) / Math.sin(Math.min(vHalf, hHalf)) * margin;
    const n = Math.hypot(...direction) || 1;
    return {position: centre.map((c, i) => c + direction[i] / n * distance), distance};
};

// ---- Build's camera (docs/ROBOT-LAB-UX.md §3.7) ----------------------------------------------
//
//   orbit        about the point under the pointer when the gesture starts (else the target):
//                camera and target turn together about it, so that point stays where it is on
//                screen and nothing jumps
//   polar range  Build looks from 5° to 175° (under a part too); Simulate keeps the floor
//   wheel        a mouse wheel zooms to the point under the pointer; a trackpad's two-finger
//                scroll orbits, Shift+scroll pans, a pinch (ctrlKey wheel) zooms
//   animation    a camera move the program makes (Fit, a view, a double click, the view cube)
//                eases over CAMERA_ANIMATION_MS; with prefers-reduced-motion it jumps

/** Build's polar range (radians from straight up): a look underneath, never quite at the poles. */
export const BUILD_POLAR = Object.freeze({min: 5 * Math.PI / 180, max: 175 * Math.PI / 180});
/** How long a programmatic camera move takes (ms). */
export const CAMERA_ANIMATION_MS = 300;

const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const len3 = v => Math.hypot(v[0], v[1], v[2]);
/** v turned by `angle` about the unit `axis` (Rodrigues). */
const turn3 = (v, axis, angle) => {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const d = axis[0] * v[0] + axis[1] * v[1] + axis[2] * v[2];
    const x = [axis[1] * v[2] - axis[2] * v[1], axis[2] * v[0] - axis[0] * v[2], axis[0] * v[1] - axis[1] * v[0]];
    return [0, 1, 2].map(k => v[k] * c + x[k] * s + axis[k] * d * (1 - c));
};
const polarOf = offset => Math.acos(Math.max(-1, Math.min(1, offset[1] / (len3(offset) || 1))));

/**
 * Camera and target turned together about `pivot` (world, y up): `theta` about the vertical through
 * the pivot, then `phi` (positive: the camera goes lower) about the camera's horizontal axis through
 * it. The view's polar angle (camera from target) stays within [minPolar, maxPolar].
 * @returns {{position: number[], target: number[]}}
 */
export const orbitAboutPivot = ({position, target, pivot, theta, phi, minPolar = BUILD_POLAR.min, maxPolar = BUILD_POLAR.max}) => {
    const offset = sub3(position, target);
    const polar = polarOf(offset);
    const clamped = Math.min(maxPolar, Math.max(minPolar, polar + phi)) - polar;
    let p = sub3(position, pivot);
    let t = sub3(target, pivot);
    p = turn3(p, [0, 1, 0], theta);
    t = turn3(t, [0, 1, 0], theta);
    const off = sub3(p, t);
    const h = Math.hypot(off[0], off[2]);
    if (h > 1e-12 && Math.abs(clamped) > 0) {
        // The camera's right, horizontal: turning about it tips the view up or down.
        const right = [off[2] / h, 0, -off[0] / h];
        p = turn3(p, right, clamped);
        t = turn3(t, right, clamped);
    }
    return {position: add3(pivot, p), target: add3(pivot, t)};
};

/** Camera and target scaled about `point` by `factor` (< 1 closer): `point` stays put on screen. */
export const zoomAbout = ({position, target, point, factor}) => ({
    position: add3(point, sub3(position, point).map(v => v * factor)),
    target: add3(point, sub3(target, point).map(v => v * factor))
});

/**
 * What a wheel event means in Build: 'zoom', 'orbit' or 'pan'. A pinch is a ctrlKey wheel. A
 * mouse wheel scrolls by lines, or by whole pixel steps of 100 or more; a trackpad by small or
 * fractional pixels. `mode` overrides the guess: 'mouse' (every scroll zooms), 'trackpad'.
 */
export const wheelIntent = ({deltaMode = 0, deltaX = 0, deltaY = 0, ctrlKey = false, shiftKey = false}, mode = 'auto') => {
    if (ctrlKey) return 'zoom';
    const mouse = mode === 'mouse' || (mode !== 'trackpad' && (deltaMode === 1 || deltaMode === 2 ||
        [deltaX, deltaY].some(d => d !== 0 && Number.isInteger(d) && Math.abs(d) >= 100)));
    if (mouse) return 'zoom';
    return shiftKey ? 'pan' : 'orbit';
};

/** The distance factor of one zooming wheel event (< 1: closer). A pinch's deltas are small, a wheel's big. */
export const wheelZoomFactor = ({deltaMode = 0, deltaY = 0, ctrlKey = false}) => {
    const px = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? 400 : 1);
    return Math.exp(px * (ctrlKey ? 0.01 : 0.0015));
};

/** Ease-out (cubic) at t in [0, 1]. */
export const easeOut = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/**
 * The view-cube direction for a point on a unit cube's surface (cube coordinates in [-0.5, 0.5]):
 * a face, an edge or a corner, by which coordinates lie within `band` of the surface.
 * @returns {number[]} a direction from the target (y up), never exactly vertical
 */
export const viewCubeDirection = (point, band = 0.18) => {
    const d = point.map(v => (Math.abs(v) >= 0.5 - band ? Math.sign(v) : 0));
    if (!d.some(Boolean)) {
        const k = [0, 1, 2].reduce((best, i) => (Math.abs(point[i]) > Math.abs(point[best]) ? i : best), 0);
        d[k] = Math.sign(point[k]) || 1;
    }
    if (d[0] === 0 && d[2] === 0) d[2] = 0.0001;
    return d;
};
