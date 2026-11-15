// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// The Sim Lab's build view (docs/SIM-LAB-PLAN.md C3/C5): a small CAD editor
// for children, modelled on Tinkercad and BrickLink Studio. The first version
// only had "pick from the palette, click to place": a placed part could land
// inside the robot, the placing tool stayed armed so a click on a part placed
// another one instead of selecting it, and a placed part could not be moved.
// This version is the interaction core of a real editor:
//
//   click a part          select it (a grouped part selects its whole group)
//   Shift+click           add / remove a part;   click on empty space: clear
//   drag empty space      box-select (Shift adds)
//   drag a part           slide it on the surface under the pointer (floor or
//                         the top of another part), grid-snapped; the pressed
//                         point stays under the pointer
//   gizmo arrows/planes   move along world axes (W);  rings: turn (E),
//                         90° steps, 15° while Shift is held
//   R / Shift+R           turn 90° about the vertical (about the connection's
//                         axis when the part sits on a pin or an axle)
//   T / Shift+T           tip 90° about the horizontal axis facing the camera
//   magnet                a lone part moved near a matching hole or axle shows
//                         a green ghost and snaps there on release (Alt: off)
//   overlap               a move, turn or placement that would push a solid part
//                         into another one shows red, the status line names the
//                         part, and it is refused on release (overlap.js
//                         `moveVerdict`); pins, axles and the castor ball may sit
//                         inside holes and sockets, and a magnet snap is a
//                         legitimate connection
//   aiming                the pointer ray also hits the parts' colliders, which
//                         are solid: aiming into a beam's hole aims at the beam,
//                         not at the floor below it, so a part rests on the face
//                         the pointer is on; the magnet first tries the part
//                         centred on the pointer, so it takes the hole pointed
//                         at, from the side the pointer is on
//   gizmo                 sized to the selection (transform-math.js `gizmoSize`);
//                         a press on a part next to a handle, but not on the
//                         handle's visible shape, goes to the part
//   palette               click a part, then click in the view to place it; or
//                         press on a part in the palette and drag it into the
//                         view: the same ghost (magnet, resting on top, overlap)
//                         follows the pointer and letting go places it; let go
//                         outside the view, or Esc, and nothing is placed
//   Delete, Ctrl+D, Ctrl+C/V, Ctrl+A, Esc, Ctrl+Z / Ctrl+Y (Shift+Ctrl+Z), F
//   Studio's tools        (editor-parity.js does the arithmetic, editor-state.js the
//                         undoable commands) H hides the selection, Shift+H shows
//                         all, I isolates it (hidden parts cannot be picked); K is the
//                         eyedropper (click a part: its colour); M the measuring tape
//                         (click two points: snaps to holes and pins); mirror, align,
//                         distribute and "to the grid" act on the selection, refused
//                         like a move when a part would go into another; a double
//                         click on a grouped part edits inside the group (its members
//                         one by one, the rest dimmed) until Esc; Ctrl+C puts the
//                         selection on the system clipboard as LDraw text, so it
//                         pastes into another model, BrickLink Studio or LeoCAD, and
//                         Ctrl+V takes LDraw text from there; ? opens the shortcut sheet
//   camera                middle-drag: orbit;
//                         right-drag: pan; wheel: zoom toward the pointer;
//                         with nothing selected, arrows orbit, Shift+arrows
//                         pan, + / - zoom (view/camera-nav.js, as Simulate)
//   fingers               (tablets; touch-gestures.js) a finger on a part:
//                         select it, drag it (the mouse's drag: magnet,
//                         overlap); on empty space: orbit; two fingers: pinch
//                         zoom and pan; a long press on a part adds or removes
//                         it (Shift+click), on empty space then drag: box
//                         select; a tap places the palette's part; the gizmo's
//                         handles are bigger and easier to hit under a finger.
//                         Fingers never reach three's controls: this module
//                         moves the camera for them
//
// Every change goes through the editor's command stack (editor-state.js); a
// change to several parts is one `moveMany` / `batch` command, so one Ctrl+Z
// undoes it. The arithmetic (grid, exact rotations, pivots, groups) is pure and
// tested in transform-math.js; this module is the mouse, the keys and three.js.
//
// Frames: the model is LDraw (LDU, -y up); the scene is metres, +y up, via the
// contract's lduToWorld — a 180° turn about x, so a placed rotation R becomes
// F·R·F with F = diag(1, -1, -1).

import {selectionRectangle, projectedBoxIntersects} from '../../editor-interaction/box-selection.js';

import {
    Box3, BoxGeometry, CanvasTexture, Color, DoubleSide, EdgesGeometry, GridHelper, Group, LineBasicMaterial, LineSegments,
    BufferGeometry, Float32BufferAttribute, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, MOUSE, Object3D, PerspectiveCamera, Plane, Quaternion, Raycaster,
    RingGeometry, Scene, Sphere, SphereGeometry, Vector2, Vector3, Vector4, WebGLRenderer
} from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {
    BUILD_POLAR, CAMERA_ANIMATION_MS, VIEW_DIRECTIONS, applyCameraAction, cameraKeyAction, configureOrbitControls, easeOut, orbitAboutPivot, orbitButtonOf, MOUSE_PRESETS,
    viewCubeDirection, wheelIntent, wheelZoomFactor, zoomAbout
} from '../view/camera-nav.js';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {LDU_M, lduToWorld} from '../contracts.js';
import {partGeometry, partVisual} from '../view/part-geometry.js';
import {PART_SURFACE, addEdgeLines, addPartLights, edgeMaterials} from '../view/part-style.js';
import {createInstancedParts, useInstancing} from '../view/instanced-parts.js';
import {
    SNAP_PX, axisRotation, connectedComponent, connectionLine, connectorUnderPointer, joinRule, pairedParts, snapAtPointer, snapCandidates, rotateAboutSnap,
    turnAboutLine, hingeCandidates
} from './snap.js';
import {freeOffset, moveVerdict, rayHitParts, restingPosition, solidOverlaps} from './overlap.js';
import {chainRound} from './chain-path.js';
import {mat3MulVec3, vecDot, vecNormalize, vecSub} from '../mech/vec.js';
import {beltRound, beltPoints, BANDS} from './belt-path.js';
import {createBeltLayer} from '../view/belt-layer.js';
import {createRopeLayer, ropesFromModel} from '../view/rope-layer.js';
import {ropeTie, ropePoints} from './rope-path.js';
import {hoseTie, hosePoints} from './hose-path.js';
import {createHoseLayer} from '../view/hose-layer.js';
import {createSpatialIndex, partBounds} from '../mech/spatial-index.js';
import {
    DEFAULT_GRID, GRID_STEPS, HOLE_PITCH, IDENTITY, cleanRotation, expandToGroups, facingAxis, gizmoSize, mul3, mulVec3,
    placeCopies, rotatePoses, selectionPivot, snapDelta, translatePoses, worldAxisRotation
} from './transform-math.js';
import {portsForCopies} from './editor-state.js';
import {defaultRotation} from '../part-meta/canonical-frame.js';
import {
    alignMoves, clipboardText, distributeMoves, gridMoves, measureBetween, measurePoint, mirrorPivot, mirrorPoses, partsFromClipboard
} from './editor-parity.js';
import {portItems} from '../mech/insight.js';
import {createInsightLayer, tintMaterial} from '../view/insight-layer.js';
import {createCableAnchors} from '../view/cable-anchors.js';
import {
    COARSE_CENTRE_PX, COARSE_GIZMO_MIN_PX, COARSE_HANDLE_PX, LONG_PRESS_MS, TOUCH_SLOP_PX, createTouchTracker, orbitAngles,
    panAmounts, pinchDistance
} from './touch-gestures.js';

/** Default LDraw colour of a newly placed part (Light Bluish Grey). */
export const DEFAULT_COLOR = 71;
/**
 * How close (LDU) a moved part's connector must come to a matching one for the
 * magnet to pull it in: a bit over a hole pitch, so a pin slid onto a beam's top
 * (its centre 30 LDU above the hole's) still finds the hole under it.
 */
export const MAGNET_RADIUS = 32;
/** Pointer travel (px) below which a press is a click, not a drag. */
const CLICK_PX = 4;
/** How near (px) the pointer must be to a gizmo handle's visible shape for a press to grab it rather than a part. */
const HANDLE_PX = 8;
const QUARTER = Math.PI / 2;
const FINE = Math.PI / 12;
/** A finger carrying a part sees its ghost this far above it (px). */
const TOUCH_LIFT_PX = 60;

/** A placed pose (LDraw) as a world Matrix4. */
export const worldMatrix = (position, rotation) => {
    const f = [rotation[0], -rotation[1], -rotation[2], -rotation[3], rotation[4], rotation[5], -rotation[6], rotation[7], rotation[8]];
    const p = lduToWorld(position);
    return new Matrix4().set(f[0], f[1], f[2], p[0], f[3], f[4], f[5], p[1], f[6], f[7], f[8], p[2], 0, 0, 0, 1);
};

const transposeRotation = m => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
/** A world point (metres, y up) in LDraw units. */
export const worldToLdu = v => [v.x / LDU_M, (0 - v.y) / LDU_M, (0 - v.z) / LDU_M];
/** A world displacement (metres) in LDraw units. */
const worldDeltaToLdu = worldToLdu;
const tidy = v => (Object.is(v, -0) ? 0 : v);

/** Copied parts survive switching modes (module scope, like a real clipboard). */
let clipboard = [];

/**
 * @param {object} options
 * @param {HTMLElement} options.container
 * @param {Function} options.read LDraw file reader
 * @param {Map} options.colors LDraw colours
 * @param {Map} options.catalog part metadata
 * @param {object} options.editor editor-state.js editor
 * @param {(ids: string[]) => void} [options.onSelect] selection changed
 * @param {(model: object, info: object) => void} [options.onChange] model changed
 * @param {(status: {kind: string}) => void} [options.onStatus] what is happening / will happen
 * @param {(part: string|null) => void} [options.onTool] the placing tool started or ended
 * @param {(mode: 'move'|'rotate') => void} [options.onMode] gizmo mode changed
 * @param {(item: {id: string, part: string, kind: string, port: string|null}) => string} [options.portLabel]
 *        the accessible name of a motor's or sensor's port badge
 * @param {(id: string, rect: DOMRect) => void} [options.onPortLabel] a port badge was clicked
 * @param {(state: {hidden: string[], group: object|null, pick: string|null, measure: object|null}) => void} [options.onViewState]
 *        hidden parts, the group being edited, the picking tool (eyedropper/tape) or a measurement changed
 * @param {(color: number, id: string) => void} [options.onColorPicked] the eyedropper picked a part's colour
 * @param {(m: object) => string} [options.measureLabel] the words on the measuring tape's label
 * @param {() => void} [options.onShortcuts] ? was pressed
 * @param {(hold: {holding: boolean, tone: string|null, round: boolean, touch: boolean, keyboard: boolean, pinned: object|null}) => void} [options.onHold]
 *        what is in hand and how it would land (the pane's hint bar, target chip and touch buttons)
 * @param {(info: object) => void} [options.onAnnounce] a new target or a refusal, for the screen reader (aria-live)
 * @param {{top: string, bottom: string, front: string, back: string, left: string, right: string}} [options.viewCubeLabels] the view cube's faces
 */
export const createEditorView3D = ({container, read, colors, catalog, editor,
    onSelect = () => {}, onChange = () => {}, onStatus = () => {}, onTool = () => {}, onMode = () => {},
    portLabel = () => '', onPortLabel = null, onViewState = () => {}, onColorPicked = () => {},
    measureLabel = m => `${m.ldu} LDU`, onShortcuts = () => {}, onHold = () => {}, onAnnounce = () => {}, viewCubeLabels = null}) => {
    const renderer = new WebGLRenderer({antialias: true});
    const canvas = renderer.domElement;
    canvas.dataset.testid = 'bw-sim-lab-editor-canvas';
    canvas.tabIndex = 0;
    Object.assign(canvas.style, {width: '100%', height: '100%', display: 'block', borderRadius: '6px', touchAction: 'none', outline: 'none',
        userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none'});
    container.appendChild(canvas);
    const catalogMap = catalog instanceof Map ? catalog : new Map(Object.entries(catalog || {}));

    const stage = new Group();
    const modelGroup = new Group();
    const outlineGroup = new Group();
    const ghostGroup = new Group();
    // The connectors that light up (docs/ROBOT-LAB-UX.md §3.2) and the orbit's pivot dot.
    const connectorGroup = new Group();
    const pivotGroup = new Group();
    stage.add(modelGroup, outlineGroup, ghostGroup, connectorGroup, pivotGroup);
    const s = new Scene();
    s.background = new Color(0xe8eef5);
    s.add(stage);
    addPartLights(s);
    const grid = new GridHelper(2, 50, 0x64748b, 0xcbd5e1);
    s.add(grid);
    const floor = new Plane(new Vector3(0, 1, 0), 0);

    const camera = new PerspectiveCamera(40, 1, 0.005, 50);
    camera.position.set(0.35, 0.3, 0.45);

    // ---- state ---------------------------------------------------------------
    // Drawn on demand: a frame is drawn only when something in it changed (render below). On a
    // software GPU a 2,000-part model takes seconds to draw, so an idle view must not redraw it.
    let disposed = false;
    let dirty = true;
    const invalidate = () => { dirty = true; };
    const meshes = new Map(); // id → Mesh
    let selection = []; // ids
    let hovered = null;
    let mode = 'move';
    let gridStep = DEFAULT_GRID;
    let tool = null; // {part, turns}
    let paletteDrag = null; // a part pressed in the palette: {part, x, y, pointerId, dragging, onEnd}
    let candidate = null; // palette ghost: magnet candidate
    let freePose = null; // palette ghost: pose on a surface
    let floorY = null;
    let gesture = null; // what the pressed pointer is doing
    let preview = null; // {moves, candidate} while a selection is being moved
    let modifiers = {alt: false, shift: false};
    let cameraTouched = false;
    // Connection-first placement (snap.js snapAtPointer, docs/ROBOT-LAB-UX.md §3).
    let lastPointer = null; // {clientX, clientY, touch}: where the held part was last aimed
    let keyboardHold = false; // the held part is aimed with the keyboard (or a tap on a tile): no pointer
    let pinned = null; // Target-first: the connector clicked, {partId, connectorId, type, point, normal, part}
    let idleLit = null; // nothing in hand: the connector lit under the pointer
    let litList = []; // what is lit now: [{partId, connectorId, active, tone}]
    let ghostTone = null; // 'free' | 'snap' | 'blocked' | null
    let wheelMode = 'auto'; // 'auto' | 'mouse' | 'trackpad' (camera-nav.js wheelIntent)
    let mousePreset = 'brickwright'; // camera-nav.js MOUSE_PRESETS
    let lastAnnounced = null;
    // Studio's view state (not the model): hidden parts, the group being edited, the picking tool.
    const hidden = new Set();
    let editingGroup = null; // a group id
    let pickMode = null; // 'color' | 'measure'
    let measure = null; // {a, b, result}: points in LDU
    let placeColor = DEFAULT_COLOR;
    // Fingers: the last press was a touch, or the device's main pointer is coarse (bigger gizmo handles).
    let lastTouch = false;
    const coarseQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(pointer: coarse)') : null;
    const bigHandles = () => lastTouch || Boolean(coarseQuery && coarseQuery.matches);

    // The editor's model is frozen (editor-state.js): one id → part map per model, built when first asked.
    let byIdFor = null;
    let byIdMap = null;
    const partsById = () => {
        const parts = editor.model.parts;
        if (byIdFor !== parts) {
            byIdMap = new Map(parts.map(p => [p.id, p]));
            byIdFor = parts;
        }
        return byIdMap;
    };
    const selectedParts = () => {
        const byId = partsById();
        return selection.map(id => byId.get(id)).filter(Boolean);
    };
    let lastStatus = {kind: 'idle'};
    const status = info => { lastStatus = info; onStatus(info); };
    const groupById = id => (editor.model.groups || []).find(g => g.id === id) || null;
    /** A part the pointer may pick: shown, and inside the group being edited (when one is). */
    const pickable = id => {
        if (hidden.has(id)) return false;
        if (!editingGroup) return true;
        const g = groupById(editingGroup);
        return Boolean(g && g.parts.includes(id));
    };
    const viewState = () => {
        const g = editingGroup && groupById(editingGroup);
        onViewState({hidden: [...hidden], group: g ? {id: g.id, name: g.name, parts: g.parts.slice()} : null, pick: pickMode,
            measure: measure && measure.result ? {...measure.result, a: measure.a, b: measure.b} : null});
    };

    // ---- pointer, raycasts ---------------------------------------------------
    const pointer = new Vector2();
    const raycaster = new Raycaster();
    const ndc = event => {
        const rect = canvas.getBoundingClientRect();
        return {x: ((event.clientX - rect.left) / rect.width) * 2 - 1, y: -((event.clientY - rect.top) / rect.height) * 2 + 1};
    };
    const pick = event => {
        const p = ndc(event);
        pointer.set(p.x, p.y);
        // The camera may have moved since the last frame (a view button, a fit).
        camera.updateMatrixWorld();
        raycaster.setFromCamera(pointer, camera);
        return raycaster;
    };
    /**
     * The ray against the parts' colliders (overlap.js), nearest first, with world
     * points and distances. Colliders are solid where the mesh has holes: aiming
     * into a hole hits the part around it.
     */
    const colliderHits = (ray, exclude = []) => {
        const {origin, direction} = ray.ray;
        return rayHitParts(editor.model, catalogMap, worldToLdu(origin), [direction.x, -direction.y, -direction.z], {exclude: [...exclude, ...hidden]})
            .filter(h => meshes.has(h.part))
            .map(h => ({...h, world: new Vector3(...lduToWorld(h.point)), distance: h.t * LDU_M}));
    };
    /**
     * The meshes a ray may hit (world boxes of each part's mesh and colliders, spatial-index.js),
     * nearest-first order left to three: only these are raycast triangle by triangle.
     */
    const meshesAlong = (ray, keep) => {
        const index = pickIndex();
        const {origin, direction} = ray.ray;
        const out = [];
        for (const i of index.queryRay(origin.toArray(), direction.toArray())) {
            const mesh = meshes.get(index.ids[i]);
            if (mesh && keep(mesh.name)) out.push(mesh);
        }
        // A part being moved is drawn where the preview puts it, not where the index has it.
        if (preview) for (const m of preview.moves) { const mesh = meshes.get(m.id); if (mesh && keep(m.id) && !out.includes(mesh)) out.push(mesh); }
        return out;
    };
    /** The part under the pointer: its mesh or its collider, whichever the ray meets first. */
    const partUnder = event => {
        const ray = pick(event);
        const hits = ray.intersectObjects(meshesAlong(ray, pickable), false);
        const mesh = hits.length ? hits[0] : null;
        const solid = colliderHits(ray).filter(h => pickable(h.part))[0];
        if (solid && (!mesh || solid.distance < mesh.distance)) {
            return {object: meshes.get(solid.part), point: solid.world, distance: solid.distance};
        }
        return mesh;
    };
    /**
     * The surface under the pointer that a part would rest on: the top face of
     * a part (not one of `exclude`) — of its mesh or its collider, whichever is
     * nearer, so a hole counts as the face around it — or the floor.
     * @returns {{point: Vector3, part: string|null}|null}
     */
    const surfaceUnder = (event, exclude = []) => {
        const ray = pick(event);
        const skip = new Set([...exclude, ...hidden]);
        const hits = ray.intersectObjects(meshesAlong(ray, id => !skip.has(id)), false);
        const n = new Vector3();
        let best = null;
        for (const h of hits) {
            if (!h.face) continue;
            n.copy(h.face.normal).transformDirection(h.object.matrixWorld);
            if (n.y > 0.7 && h.point.y >= floorY - 1e-6) {
                best = {point: h.point.clone(), part: h.object.name, distance: h.distance};
                break;
            }
        }
        // LDraw is -y up: an upward face has a normal with negative y.
        const top = colliderHits(ray, exclude).find(h => h.normal[1] < -0.7 && h.world.y >= floorY - 1e-6);
        if (top && (!best || top.distance < best.distance)) best = {point: top.world, part: top.part};
        if (best) return {point: best.point, part: best.part};
        const p = ray.ray.intersectPlane(floor, new Vector3());
        return p ? {point: p, part: null} : null;
    };

    /** The pointer's ray in LDraw units (snap.js works there). */
    const rayLdu = event => {
        const r = pick(event).ray;
        return {origin: worldToLdu(r.origin), direction: [r.direction.x, -r.direction.y, -r.direction.z]};
    };
    const eyeLdu = () => worldToLdu(camera.position);
    /** A client point in the canvas's own pixels. */
    const canvasPx = event => {
        const rect = canvas.getBoundingClientRect();
        return [event.clientX - rect.left, event.clientY - rect.top];
    };
    const viewProjection = new Matrix4();
    /** LDU point → canvas pixels (null behind the eye) for the camera as it is now: plain arithmetic, called per connector. */
    const projector = () => {
        camera.updateMatrixWorld();
        viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        const e = viewProjection.elements;
        const w = canvas.clientWidth || 1;
        const h = canvas.clientHeight || 1;
        return p => {
            const x = p[0] * LDU_M; const y = -p[1] * LDU_M; const z = -p[2] * LDU_M;
            const cw = e[3] * x + e[7] * y + e[11] * z + e[15];
            if (cw <= 1e-9) return null;
            return [((e[0] * x + e[4] * y + e[8] * z + e[12]) / cw + 1) / 2 * w, (1 - (e[1] * x + e[5] * y + e[9] * z + e[13]) / cw) / 2 * h];
        };
    };
    /** The view's centre as a client point (keyboard placement and a tap on a tile aim there). */
    const viewCentre = () => {
        const rect = canvas.getBoundingClientRect();
        return {clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2};
    };

    // ---- the model's meshes and highlights -------------------------------------
    const materials = new Map();
    const materialsFor = color => {
        if (!materials.has(color)) {
            const info = colors.get(color) || colors.get(16);
            materials.set(color, [
                new MeshStandardMaterial({color: info ? info.value : '#cccccc', ...PART_SURFACE}),
                new MeshStandardMaterial({color: '#ffffff', ...PART_SURFACE, vertexColors: true})
            ]);
        }
        return materials.get(color);
    };
    // The parts' own LDraw edge lines, one shared material set per colour.
    const lineMaterials = new Map();
    const linesFor = color => {
        if (!lineMaterials.has(color)) lineMaterials.set(color, edgeMaterials(color, colors));
        return lineMaterials.get(color);
    };
    // One material pair per tone, kept for the view's life: a ghost is remade on every pointer move while
    // a part snaps, and a material made and disposed with it took its shader program with it (three.js
    // frees a program when its last material goes), so every move compiled and linked the program anew -
    // seconds each on a software GPU (SwiftShader), the GPU queue behind it growing with every move.
    const ghostMaterials = new Map();
    const ghostMaterial = tone => {
        const key = tone === 'snap' || tone === 'blocked' ? tone : 'plain';
        if (!ghostMaterials.has(key)) {
            ghostMaterials.set(key, [0, 1].map(() => new MeshStandardMaterial({
                color: {snap: '#22c55e', blocked: '#ef4444'}[key] || '#64748b', transparent: true, opacity: 0.55, depthWrite: false
            })));
        }
        return ghostMaterials.get(key);
    };
    const edges = new Map();
    const edgesFor = part => {
        if (!edges.has(part)) edges.set(part, new EdgesGeometry(partGeometry(part, read, colors), 35));
        return edges.get(part);
    };
    // Selected: crisp amber edges, plus a faint copy drawn over everything so a part
    // hidden inside the robot still shows where it is (a solid always-on-top copy
    // turns a beam's hole edges into a tangle).
    const selectedLine = new LineBasicMaterial({color: 0xf59e0b});
    const selectedHidden = new LineBasicMaterial({color: 0xf59e0b, depthTest: false, transparent: true, opacity: 0.22});
    const hoverLine = new LineBasicMaterial({color: 0x38bdf8});
    // A move that would push a part into another: red, like the status line.
    const blockedLine = new LineBasicMaterial({color: 0xdc2626});

    const posesOverride = () => (preview ? new Map(preview.moves.map(m => [m.id, m])) : new Map());
    /** Parts drawn somewhere else than the model has them (a previewed move): put back by the next placeMeshes. */
    let overridden = new Set();
    /** Moves the previewed parts' meshes (and puts back the ones no longer previewed); the rest stay as they are. */
    const placeMeshes = () => {
        const over = posesOverride();
        const byId = partsById();
        for (const id of new Set([...overridden, ...over.keys()])) {
            const mesh = meshes.get(id);
            const pose = over.get(id) || byId.get(id);
            if (mesh && pose) mesh.matrix.copy(worldMatrix(pose.position, pose.rotation));
        }
        overridden = new Set(over.keys());
        drawOutlines();
    };
    // Parts drawn other than plainly (hidden, selected, hovered, red, tinted, dimmed): drawOutlines
    // restyles these and the ones that join them, not every part of the model on every hover.
    const styled = new Set();
    /** One part's look: shown or hidden, dimmed outside the group being edited, its glow and tint. */
    const styleMesh = (mesh, id, {red, group, tints}) => {
        const hide = hidden.has(id);
        // Instanced: the proxy itself is never drawn (its instance is); the instance follows its flags.
        if (instanced) mesh.userData.hidden = hide;
        else mesh.visible = !hide;
        // Editing inside a group: the rest of the model steps back.
        const dim = Boolean(group && !group.has(id));
        mesh.userData.dim = dim;
        const on = selection.includes(id);
        const glow = red.has(id) ? 0x7f1d1d : (on ? 0x1e3a8a : (id === hovered ? 0x0c4a6e : 0x000000));
        for (const m of [].concat(mesh.material)) {
            if (m.transparent !== dim) { m.transparent = dim; m.needsUpdate = true; }
            m.opacity = dim ? 0.25 : 1;
            m.depthWrite = !dim;
            m.emissive?.setHex(glow);
            // Blocked: the part itself turns red (a tint over its own colour is too faint on grey).
            // "Show how it moves": its body's pastel.
            const tint = tints ? tints.get(id) : null;
            tintMaterial(m, red.has(id) ? 0xef4444 : (tint || null));
        }
        return hide || dim || glow !== 0 || Boolean(tints && tints.get(id)) || red.has(id);
    };
    const drawOutlines = () => {
        invalidate();
        outlineGroup.clear();
        const red = preview && preview.blocked ? new Set(preview.moves.map(m => m.id)) : new Set();
        const add = (id, material) => {
            const mesh = meshes.get(id);
            if (!mesh) return;
            const line = new LineSegments(edgesFor(mesh.userData.part), red.has(id) ? blockedLine : material);
            line.matrixAutoUpdate = false;
            line.matrix.copy(mesh.matrix);
            line.renderOrder = material === selectedLine ? 10 : 5;
            outlineGroup.add(line);
            if (material === selectedLine) {
                const ghost = new LineSegments(line.geometry, selectedHidden);
                ghost.matrixAutoUpdate = false;
                ghost.matrix.copy(mesh.matrix);
                ghost.renderOrder = 11;
                outlineGroup.add(ghost);
            }
        };
        if (hovered && !selection.includes(hovered) && !hidden.has(hovered)) add(hovered, hoverLine);
        for (const id of selection) if (!hidden.has(id)) add(id, selectedLine);
        const g = editingGroup && groupById(editingGroup);
        const look = {red, group: g ? new Set(g.parts) : null, tints: partTints && insight.shown.motion ? partTints : null};
        // Who may look other than plain now: the styled ones (they may go back), and every one with a reason.
        const touch = new Set(styled);
        for (const id of hidden) touch.add(id);
        for (const id of selection) touch.add(id);
        for (const id of red) touch.add(id);
        if (hovered) touch.add(hovered);
        if (look.tints) for (const id of look.tints.keys()) touch.add(id);
        if (look.group) for (const id of meshes.keys()) touch.add(id);
        styled.clear();
        for (const id of touch) {
            const mesh = meshes.get(id);
            if (mesh && styleMesh(mesh, id, look)) styled.add(id);
        }
    };
    // ---- seeing the model: port badges, hinge axes, gear pairs, body tints ---------------
    // (view/insight-layer.js). Port badges come straight from the model, so they change with
    // a port at once; the motion overlay comes from the pane's debounced compile (setMotion).
    const insight = createInsightLayer({container, scene: s, onPortClick: onPortLabel});
    let partTints = null;
    const partCentre = id => {
        const local = new Vector3();
        let geometry = null;
        return () => {
            const mesh = meshes.get(id);
            if (!mesh) return null;
            if (mesh.geometry !== geometry) {
                geometry = mesh.geometry;
                if (!geometry.boundingBox) geometry.computeBoundingBox();
                geometry.boundingBox.getCenter(local);
            }
            return local.clone().applyMatrix4(mesh.matrixWorld);
        };
    };
    const cableAnchors = createCableAnchors({read, partOf: id => editor.model.parts.find(p => p.id === id),
        meshOf: id => hidden.has(id) ? null : meshes.get(id)});
    const refreshPorts = () => insight.setPorts(portItems(editor.model, catalogMap).filter(item => !hidden.has(item.id))
        .map(item => ({...item, label: portLabel(item), anchor: partCentre(item.id), ...cableAnchors(item)})));
    const fixed = p => (p ? () => new Vector3(...p) : () => null);
    const setMotion = ({joints = [], gears = [], tints = null} = {}) => {
        insight.setMotion({
            axes: joints.filter(j => j.type === 'hinge').map(j => ({motor: j.motor, from: fixed(j.from), to: fixed(j.to)})),
            balls: joints.filter(j => j.type === 'ball').map(j => ({at: fixed(j.point)})),
            gears: gears.map(g => ({text: g.text, from: fixed(g.from), to: fixed(g.to)}))
        });
        partTints = tints;
        // Hidden, the motion overlay and its tints change nothing on screen: no restyle and no new frame (the
        // pane recompiles after every edit, and on a big model on a software GPU a frame is seconds).
        // Shown again, setOverlay restyles with the tints kept here.
        if (insight.shown.motion) drawOutlines();
    };
    const setOverlay = shown => {
        insight.setVisible(shown);
        drawOutlines();
    };

    // A big model is drawn instanced (view/instanced-parts.js): the meshes below stay as the
    // parts' invisible proxies, so picking, highlights and tints read and write them as before.
    let instanced = null;
    s.onBeforeRender = (_renderer, _scene, renderCamera) => instanced?.sync(false, renderCamera);
    const disposeMesh = mesh => {
        modelGroup.remove(mesh);
        for (const m of [].concat(mesh.material)) m.dispose();
    };
    /** A part's mesh (the instanced proxy, or a drawn mesh with its edge lines). */
    const makeMesh = (p, withLines) => {
        // Each mesh gets its own material pair so a highlight is per part.
        const mats = materialsFor(p.color ?? DEFAULT_COLOR).map(m => m.clone());
        const mesh = new Mesh(partGeometry(p.part, read, colors), mats);
        mesh.matrixAutoUpdate = false;
        mesh.matrix.copy(worldMatrix(p.position, p.rotation));
        mesh.name = p.id;
        mesh.userData.part = p.part;
        mesh.userData.placed = p;
        if (withLines) addEdgeLines(mesh, partVisual(p.part, read, colors), linesFor(p.color ?? DEFAULT_COLOR));
        modelGroup.add(mesh);
        return mesh;
    };
    /**
     * Brings the meshes up to the editor's model. The model is immutable with structural sharing
     * (editor-state.js): a part that is the same object as last time is unchanged and keeps its mesh;
     * one only moved keeps its mesh at the new pose; only a new, removed, re-coloured or swapped part
     * makes or drops a mesh, and only then are the instanced batches remade (from the same proxies).
     */
    // Rubber bands: drawn round their parts as the model has them (editor/belt-path.js).
    const beltLayer = createBeltLayer();
    s.add(beltLayer.group);
    let beltsDrawnFor = null;
    const ropeLayer = createRopeLayer();
    s.add(ropeLayer.group);
    const hoseLayer = createHoseLayer();
    s.add(hoseLayer.group);
    const drawBelts = model => {
        if (beltsDrawnFor === model) return;
        beltsDrawnFor = model;
        beltLayer.draw((model.belts || []).map(b => ({id: b.id, band: b.band, points: beltPoints(model, catalogMap, b)})));
        ropeLayer.draw(ropesFromModel(model, r => ropePoints(model, catalogMap, r.around)));
        hoseLayer.draw((model.hoses || []).map(h => ({id: h.id, points: hosePoints(model, catalogMap, h)})));
        invalidate();
    };
    // Decoration (model.decor: a cable's segments): drawn as the file has it, in its own group (never picked).
    const decorGroup = new Group();
    decorGroup.name = 'decor';
    s.add(decorGroup);
    let decorDrawnFor = null;
    const drawDecor = model => {
        if ((model.decor || null) === decorDrawnFor) return;
        decorDrawnFor = model.decor || null;
        for (const mesh of [...decorGroup.children]) {
            decorGroup.remove(mesh);
            for (const m of [].concat(mesh.material)) m.dispose();
        }
        for (const d of model.decor || []) {
            let geometry;
            try { geometry = partGeometry(d.part, read, colors); } catch { continue; }
            const mesh = new Mesh(geometry, materialsFor(d.color ?? DEFAULT_COLOR).map(m => m.clone()));
            mesh.matrixAutoUpdate = false;
            mesh.matrix.copy(worldMatrix(d.position, d.matrix));
            mesh.name = `decor:${d.part}`;
            decorGroup.add(mesh);
        }
    };
    const rebuild = () => {
        const model = editor.model;
        drawDecor(model);
        if (model.belts || model.ropes || model.hoses || beltLayer.count || ropeLayer.count || hoseLayer.count) drawBelts(model);
        const instancing = useInstancing(model.parts.length);
        let changed = false;
        if (instancing !== Boolean(instanced) || !meshes.size) {
            // Drawn the other way now (or the first time): every mesh is made anew.
            for (const mesh of meshes.values()) disposeMesh(mesh);
            meshes.clear();
            styled.clear();
            changed = true;
        }
        const ids = new Set(model.parts.map(p => p.id));
        for (const [id, mesh] of meshes) {
            if (ids.has(id)) continue;
            disposeMesh(mesh);
            meshes.delete(id);
            changed = true;
        }
        for (const p of model.parts) {
            const mesh = meshes.get(p.id);
            const was = mesh && mesh.userData.placed;
            if (was === p) continue;
            if (was && was.part === p.part && (was.color ?? DEFAULT_COLOR) === (p.color ?? DEFAULT_COLOR)) {
                mesh.matrix.copy(worldMatrix(p.position, p.rotation));
                mesh.userData.placed = p;
                continue;
            }
            if (mesh) disposeMesh(mesh);
            meshes.set(p.id, makeMesh(p, !instancing));
            changed = true;
        }
        if (changed && instanced) {
            s.remove(instanced.object);
            instanced.dispose();
            instanced = null;
        }
        if (changed && instancing) {
            const mirror = createInstancedParts({colors});
            for (const p of model.parts) {
                const mesh = meshes.get(p.id);
                mirror.add(mesh, partVisual(p.part, read, colors), p.color ?? DEFAULT_COLOR);
            }
            modelGroup.updateMatrixWorld(true);
            mirror.build();
            s.add(mirror.object);
            instanced = mirror;
        }
        pickIndexFor = null;
        // The floor is fixed where the model stood when the editor opened, so lifting
        // the lowest part does not move the floor away under it; it only ever goes down.
        modelGroup.updateMatrixWorld(true);
        const box = new Box3().setFromObject(modelGroup);
        const lowest = box.isEmpty() ? 0 : box.min.y;
        floorY = floorY === null ? lowest : Math.min(floorY, lowest);
        grid.position.y = floorY;
        floor.constant = -floorY;
        for (const id of [...hidden]) if (!meshes.has(id)) hidden.delete(id);
        if (editingGroup && !groupById(editingGroup)) { editingGroup = null; viewState(); }
        const kept = selection.filter(id => meshes.has(id));
        if (kept.length !== selection.length) setSelection(kept);
        if (hovered && !meshes.has(hovered)) hovered = null;
        placeMeshes();
        updateGizmo();
        refreshPorts();
        // A pinned target belongs to the model it was clicked on; the lit connector to the pointer's last move.
        if (pinned || idleLit) {
            pinned = null;
            idleLit = null;
            if (!tool && !gesture) showConnectors([]);
            emitHold();
        }
    };

    // The ray-picking index: each part's world box (its mesh's bounds and its colliders), per model.
    // A part object is frozen and keeps its pose, so its box is kept for it (WeakMap).
    const worldBoxes = new WeakMap();
    let pickIndexFor = null;
    let pickIndexed = null;
    const worldBoxOf = p => {
        let box = worldBoxes.get(p);
        if (box) return box;
        const geometry = partGeometry(p.part, read, colors);
        if (!geometry.boundingBox) geometry.computeBoundingBox();
        const b = geometry.boundingBox.clone().applyMatrix4(worldMatrix(p.position, p.rotation));
        const ldu = partBounds(p, catalogMap.get(p.part));
        if (ldu) {
            // LDraw → world is (x, -y, -z) in metres: a box's y and z bounds swap ends.
            b.expandByPoint(new Vector3(...lduToWorld(ldu.min)));
            b.expandByPoint(new Vector3(...lduToWorld(ldu.max)));
        }
        box = {min: b.min.toArray(), max: b.max.toArray()};
        worldBoxes.set(p, box);
        return box;
    };
    const pickIndex = () => {
        const parts = editor.model.parts;
        if (pickIndexFor !== parts) {
            const present = parts.filter(p => meshes.has(p.id));
            pickIndexed = createSpatialIndex(present.map(worldBoxOf), 40 * LDU_M);
            pickIndexed.ids = present.map(p => p.id);
            pickIndexFor = parts;
        }
        return pickIndexed;
    };

    // ---- selection -----------------------------------------------------------
    // The hinge tool's hinges for the selection they were worked out for (see nextHinge below).
    let hinge = {key: null, parts: null, list: [], index: 0};
    const setSelection = ids => {
        // Inside a group its members are picked one by one; hidden parts are never selected.
        selection = (editingGroup ? [...new Set(ids)] : expandToGroups(editor.model, ids)).filter(pickable);
        if (hinge.key !== null && hinge.key !== selection.join(',')) {
            hinge = {key: null, parts: null, list: [], index: 0};
            drawHinge(null);
        }
        drawOutlines();
        updateGizmo();
        onSelect(selection.slice());
    };

    // ---- gizmo ---------------------------------------------------------------
    const pivotObject = new Object3D();
    s.add(pivotObject);
    // Registered before OrbitControls and TransformControls: this listener decides
    // first what a press means (gizmo, part drag, box select or camera).
    canvas.addEventListener('pointerdown', event => onDown(event));
    // Fingers' moves and lifts too: a finger is followed here and kept from three's
    // controls (stopImmediatePropagation), except one that grabbed a gizmo handle.
    for (const type of ['pointermove', 'pointerup', 'pointercancel']) canvas.addEventListener(type, event => onTouchEvent(event));
    const transform = new TransformControls(camera, canvas);
    transform.setSpace('world');
    transform.setSize(1.25);
    // Only axis-aligned turns: free trackball and view-axis rings would make rotations
    // that are not quarter (or 15°) turns about a world axis.
    transform.showE = false;
    transform.showXYZE = false;
    transform.setRotationSnap(QUARTER);
    // No free "move in the screen plane" handle: it sits on top of the part, so a
    // child pressing on the part to slide it would grab it instead and move the
    // part toward or away from the camera. Pressing the part itself slides it.
    for (const set of [transform._gizmo?.gizmo?.translate, transform._gizmo?.picker?.translate]) {
        for (const handle of set ? set.children.filter(c => c.name === 'XYZ') : []) set.remove(handle);
    }
    s.add(transform.getHelper());
    // The wheel is this view's (onWheel, registered before three's controls so they never see it).
    canvas.addEventListener('wheel', event => onWheel(event), {passive: false});
    const controls = new OrbitControls(camera, canvas);
    // view/camera-nav.js, as in Simulate: the right drag pans (three's controls). Orbiting is this view's own
    // (about the point under the pointer: middle drag, one finger, a trackpad's scroll).
    configureOrbitControls(controls, MOUSE);
    controls.enableRotate = false;
    controls.enableZoom = false;
    // Build looks from 5° to 175°: under a part too (Simulate keeps the floor).
    controls.minPolarAngle = BUILD_POLAR.min;
    controls.maxPolarAngle = BUILD_POLAR.max;
    controls.addEventListener('start', () => { cameraTouched = true; });
    // The camera, the gizmo (a handle lit, moved, resized) and the controls changing: a new frame.
    controls.addEventListener('change', invalidate);
    transform.addEventListener('change', invalidate);
    controls.update();

    const pivotLdu = () => selectionPivot(selectedParts(), gridStep);
    let selectionRadius = 0;
    /** Sizes the gizmo to the selection as seen now (every frame: the camera moves). */
    const fitGizmo = () => {
        if (!transform.object || !selectionRadius) return;
        const size = gizmoSize({radius: selectionRadius, distance: camera.position.distanceTo(pivotObject.position),
            fov: camera.fov, viewHeightPx: canvas.clientHeight, minPx: bigHandles() ? COARSE_GIZMO_MIN_PX : undefined});
        if (Math.abs(size - transform.size) > 0.01) transform.setSize(size);
    };
    const updateGizmo = () => {
        invalidate();
        if (!selection.length || tool) {
            transform.detach();
            return;
        }
        if (gesture && gesture.kind === 'gizmo') return;
        modelGroup.updateMatrixWorld(true);
        selectionRadius = modelBox(selection).getBoundingSphere(new Sphere()).radius;
        pivotObject.position.fromArray(lduToWorld(pivotLdu()));
        pivotObject.quaternion.identity();
        pivotObject.updateMatrixWorld(true);
        transform.attach(pivotObject);
        transform.setMode(mode === 'rotate' ? 'rotate' : 'translate');
        fitGizmo();
    };

    // Where the pointer is on screen (px in the canvas) and the 2D distance to a triangle.
    const segmentDistance = (p, a, b) => {
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const len = dx * dx + dy * dy;
        const t = len ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len)) : 0;
        return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
    };
    const triangleDistance = (p, a, b, c) => {
        const side = (u, v) => (v[0] - u[0]) * (p[1] - u[1]) - (v[1] - u[1]) * (p[0] - u[0]);
        const s1 = side(a, b), s2 = side(b, c), s3 = side(c, a);
        if ((s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0)) return 0;
        return Math.min(segmentDistance(p, a, b), segmentDistance(p, b, c), segmentDistance(p, c, a));
    };
    /**
     * Whether the pointer is on the VISIBLE shape of the gizmo handle the picker
     * found (within HANDLE_PX). TransformControls picks with fat invisible shapes
     * that reach over neighbouring parts; a press there on a part is meant for
     * the part. A finger gets a wider margin (COARSE_HANDLE_PX).
     */
    const onHandleShape = (event, reach = HANDLE_PX) => {
        const gizmo = transform._gizmo && transform._gizmo.gizmo && transform._gizmo.gizmo[transform.mode];
        if (!gizmo) return true; // three's internals changed: trust the picker
        const rect = canvas.getBoundingClientRect();
        const p = [event.clientX - rect.left, event.clientY - rect.top];
        const v = new Vector3();
        for (const handle of gizmo.children) {
            if (handle.name !== transform.axis || !handle.visible || !handle.geometry) continue;
            const pos = handle.geometry.attributes.position;
            const screen = [];
            for (let i = 0; i < pos.count; i++) {
                v.fromBufferAttribute(pos, i).applyMatrix4(handle.matrixWorld).project(camera);
                screen.push([(v.x + 1) / 2 * rect.width, (1 - v.y) / 2 * rect.height]);
            }
            const index = handle.geometry.index;
            const n = index ? index.count : pos.count;
            for (let i = 0; i + 2 < n; i += 3) {
                const [a, b, c] = [0, 1, 2].map(k => screen[index ? index.getX(i + k) : i + k]);
                if (triangleDistance(p, a, b, c) <= reach) return true;
            }
        }
        return false;
    };
    /** The gizmo handle a press here would grab: the picker's, unless a part is under the pointer off the handle's shape. */
    const gizmoGrab = event => {
        if (!transform.object) return null;
        // The handles as they are now (size and pose change between frames), not as last drawn.
        fitGizmo();
        transform.getHelper().updateMatrixWorld(true);
        transform.pointerHover(ndc(event));
        if (transform.axis === null) return null;
        const finger = event.pointerType === 'touch';
        if (finger && partUnder(event)) {
            const rect = canvas.getBoundingClientRect();
            const c = pivotObject.position.clone().project(camera);
            const off = Math.hypot(rect.left + (c.x + 1) / 2 * rect.width - event.clientX, rect.top + (1 - c.y) / 2 * rect.height - event.clientY);
            if (off < COARSE_CENTRE_PX) { transform.axis = null; return null; }
        }
        if (onHandleShape(event, finger ? COARSE_HANDLE_PX : HANDLE_PX) || !partUnder(event)) return transform.axis;
        transform.axis = null; // the handle does not light up either
        return null;
    };
    let gizmoHover = null;

    transform.addEventListener('mouseDown', () => {
        controls.enabled = false;
        const parts = selectedParts();
        gesture = {kind: 'gizmo', start: parts, pivotWorld: pivotObject.position.clone(), pivot: pivotLdu()};
        preview = {moves: translatePoses(parts, [0, 0, 0]), candidate: null};
    });
    transform.addEventListener('objectChange', () => {
        if (!gesture || gesture.kind !== 'gizmo') return;
        if (transform.mode === 'translate') {
            const raw = worldDeltaToLdu(pivotObject.position.clone().sub(gesture.pivotWorld));
            const delta = snapDelta(raw, gridStep);
            // Show the gizmo where the parts will be: on the grid.
            pivotObject.position.copy(gesture.pivotWorld).add(new Vector3(...lduToWorld(delta)));
            showMove(gesture.start, translatePoses(gesture.start, delta), delta);
        } else {
            const a = transform.rotationAxis;
            const axes = ['x', 'y', 'z'];
            const k = [Math.abs(a.x), Math.abs(a.y), Math.abs(a.z)].reduce((best, v, i, all) => (v > all[best] ? i : best), 0);
            const angle = transform.rotationAngle * Math.sign(a.getComponent(k) || 1);
            const r = worldAxisRotation(axes[k], angle);
            const moves = rotatePoses(gesture.start, r, gesture.pivot);
            preview = {moves, candidate: null, blocked: blockedBy(moves)};
            placeMeshes();
            if (preview.blocked) status({kind: 'blocked', target: preview.blocked.target});
            else status({kind: 'turning', degrees: Math.round(angle * 180 / Math.PI)});
        }
    });
    transform.addEventListener('mouseUp', () => {
        const done = gesture && gesture.kind === 'gizmo';
        gesture = null;
        controls.enabled = true;
        if (done) commitPreview();
        updateGizmo();
    });

    /** Preview a moved selection; a lone part is offered to the magnet. */
    /**
     * `aimed`: for a drag with the pointer on a part, the lone part's pose with
     * its origin AT the pointer (resting on that face). The magnet tries it
     * first, so the hole the pointer is on wins, from the side the pointer is
     * on — as when placing from the palette.
     */
    const showMove = (start, moves, delta, aimed = null) => {
        let found = null;
        if (moves.length === 1 && !modifiers.alt) found = (aimed && magnetFor(aimed, start[0])) || magnetFor(moves[0], start[0]);
        const shown = found ? [{id: moves[0].id, position: found.position, rotation: found.rotation}] : moves;
        // A magnet snap is a connection: the parts it joins may touch the moved one.
        const blocked = blockedBy(shown, found ? found.pairs.map(pair => pair.fixed.part) : []);
        preview = {moves: shown, candidate: found, blocked};
        placeMeshes();
        showMagnet(found, start[0]);
        if (blocked) status({kind: 'blocked', target: blocked.target});
        else if (found) status(snapStatus(found));
        else status({kind: 'moving', delta: delta.map(tidy)});
    };

    /**
     * What a move would push a solid part into (overlap.js `moveVerdict`), or
     * null when it may go there. `target` is the part's type, for the status line.
     */
    const blockedBy = (moves, connected = []) => {
        const verdict = moveVerdict({model: editor.model, catalog: catalogMap, moves, connected});
        if (verdict.ok) return null;
        const into = partsById().get(verdict.into);
        return {part: verdict.part, into: verdict.into, target: into ? into.part : null};
    };
    /** The same for a new part placed at `pose`. */
    const placeBlockedBy = (part, pose) => {
        const placed = {id: '__placing__', part, position: pose.position, rotation: pose.rotation};
        const hit = solidOverlaps(editor.model, catalogMap, placed)[0];
        const into = hit && partsById().get(hit.part);
        return hit ? {part: placed.id, into: hit.part, target: into ? into.part : null} : null;
    };

    const samePose = (a, b) => a.position.every((v, i) => Math.abs(v - b.position[i]) < 0.5) &&
        a.rotation.every((v, i) => Math.abs(v - b.rotation[i]) < 1e-6);
    /**
     * The magnet's pick for a part moved to `pose`. The spot it started from is
     * not offered: a pin sitting in a hole would otherwise be pulled straight
     * back whenever it is moved less than the magnet's reach.
     */
    const magnetFor = (pose, placed) => {
        if (samePose(pose, placed)) return null;
        // The part itself is not something to attach to (`exclude`, not a copy of the model without it).
        const found = snapCandidates({model: editor.model, exclude: [placed.id], catalog: catalogMap, part: placed.part,
            pose: {position: pose.position, rotation: pose.rotation}, radius: MAGNET_RADIUS})
            .filter(c => !samePose(c, placed));
        if (!found.length) return null;
        return {...found[0], rotation: cleanRotation(found[0].rotation)};
    };

    // ---- ghosts and magnet markers -------------------------------------------
    const clearGhost = () => {
        invalidate();
        ghostTone = null;
        ghostGroup.clear(); // the ghosts' materials are the shared ghostMaterials, disposed with the view
    };
    const markerGeometry = new SphereGeometry(4 * LDU_M, 12, 8);
    const markerMaterials = {
        fixed: new MeshBasicMaterial({color: 0xf59e0b, depthTest: false}),
        moving: new MeshBasicMaterial({color: 0x16a34a, depthTest: false})
    };
    const marker = (lduPoint, which) => {
        invalidate();
        const m = new Mesh(markerGeometry, markerMaterials[which]);
        m.position.fromArray(lduToWorld(lduPoint));
        m.renderOrder = 20;
        ghostGroup.add(m);
    };
    const connectorWorld = (pose, connectorId, part) => {
        const meta = catalogMap.get(part);
        const c = meta && meta.connectors.find(x => x.id === connectorId);
        return c ? mulVec3(pose.rotation, c.position).map((v, i) => v + pose.position[i]) : null;
    };
    /** The green ghost at a magnet pose and the connector pairs it joins. */
    const showMagnet = (found, placed, part = placed && placed.part) => {
        clearGhost();
        if (!found) return;
        ghostTone = 'snap';
        const mesh = new Mesh(partGeometry(part, read, colors), ghostMaterial('snap'));
        mesh.matrixAutoUpdate = false;
        mesh.matrix.copy(worldMatrix(found.position, found.rotation));
        mesh.name = 'ghost';
        ghostGroup.add(mesh);
        const byId = partsById();
        for (const pair of found.pairs) {
            const fixed = byId.get(pair.fixed.part);
            const a = fixed && connectorWorld(fixed, pair.fixed.connector, fixed.part);
            const b = connectorWorld(found, pair.moving, part);
            if (a) marker(a, 'fixed');
            if (b) marker(b, 'moving');
        }
    };
    const showGhost = (part, position, rotation, tone) => {
        clearGhost();
        ghostTone = tone;
        const mesh = new Mesh(partGeometry(part, read, colors), ghostMaterial(tone));
        mesh.matrixAutoUpdate = false;
        mesh.matrix.copy(worldMatrix(position, rotation));
        mesh.name = 'ghost';
        ghostGroup.add(mesh);
    };
    /** One more ghost beside the ones shown (a carried selection snapped: each of its parts). */
    const showGhostAlso = (part, position, rotation, tone) => {
        const mesh = new Mesh(partGeometry(part, read, colors), ghostMaterial(tone));
        mesh.matrixAutoUpdate = false;
        mesh.matrix.copy(worldMatrix(position, rotation));
        mesh.name = 'ghost';
        ghostGroup.add(mesh);
        ghostTone = tone;
        invalidate();
    };
    const snapStatus = found => {
        const pair = found.pairs[0];
        const target = pair && partsById().get(pair.fixed.part);
        return {kind: 'snap', target: target ? target.part : null, connector: pair ? pair.fixed.connector : null};
    };

    // ---- committing ------------------------------------------------------------
    /** Applies a command; a refused one is reported, never thrown at the learner. */
    const run = (cmd, info = {}) => {
        try {
            editor.apply(cmd);
        } catch (error) {
            status({kind: 'refused', reason: 'invalid', detail: error.message});
            return false;
        }
        onChange(editor.model, info);
        return true;
    };
    const commitPreview = () => {
        const p = preview;
        preview = null;
        clearGhost();
        if (!p) return;
        const byId = partsById();
        const changed = p.moves.filter(m => {
            const was = byId.get(m.id);
            return was && (m.position.some((v, i) => v !== was.position[i]) || m.rotation.some((v, i) => v !== was.rotation[i]));
        });
        if (!changed.length) {
            placeMeshes();
            return;
        }
        if (p.blocked) {
            // Refused, never silently: the parts go back and the status says why.
            placeMeshes();
            status({kind: 'refused', reason: 'overlapMove', target: p.blocked.target});
            return;
        }
        if (run({type: 'moveMany', moves: changed}, {moved: changed.length, snapped: Boolean(p.candidate)})) {
            status(p.candidate ? {...snapStatus(p.candidate), kind: 'snapped'} : {kind: 'moved', count: changed.length});
        } else {
            placeMeshes();
        }
    };

    // ---- the placing tool (palette) ---------------------------------------------
    /**
     * Where a part rests on a surface at a world point: in its default placement
     * (part-meta/canonical-frame.js defaultRotation: studs up, a beam along x with its
     * holes horizontal, a shaft along x, a gear on a horizontal axle) or the turned
     * `rotation` the hand holds it in, its footprint centred on the point, its colliders'
     * bottom ON the surface (overlap.js `restingPosition`), x/z on the grid.
     */
    const restingPose = (part, point, rotationOrTurns = 0) => {
        const meta = catalogMap.get(part);
        const rotation = Array.isArray(rotationOrTurns) ? cleanRotation(rotationOrTurns) :
            cleanRotation(mul3(worldAxisRotation('y', (((rotationOrTurns % 4) + 4) % 4) * QUARTER), defaultRotation(meta)));
        if (meta && meta.colliders && meta.colliders.length) {
            return {position: restingPosition({meta, rotation, point: worldToLdu(point), grid: gridStep}), rotation};
        }
        const geom = partGeometry(part, read, colors);
        geom.computeBoundingBox();
        const probe = new Box3().copy(geom.boundingBox).applyMatrix4(worldMatrix([0, 0, 0], rotation));
        const centre = probe.getCenter(new Vector3());
        // Origin such that the footprint's centre is under the pointer and the lowest point touches the surface.
        const origin = new Vector3(point.x - centre.x, point.y - probe.min.y, point.z - centre.z);
        const ldu = worldToLdu(origin);
        return {position: [Math.round(ldu[0] / gridStep) * gridStep, Math.round(ldu[1]), Math.round(ldu[2] / gridStep) * gridStep].map(tidy), rotation};
    };
    /** A part's default placement rotation (canonical-frame.js). */
    const homeRotation = part => cleanRotation(defaultRotation(catalogMap.get(part)));

    // ---- connectors that light up (docs/ROBOT-LAB-UX.md §3.2) -------------------------------
    // Rings at a hole's entry face or a shaft's tip, a "+" in an axle hole, a sphere for balls:
    // cyan for what could take the part in hand, amber for the target, green for the held
    // connector, red when the pose is blocked. Depth-tested, so holes behind a part stay dark.
    const HL_COLOURS = {candidate: 0x38bdf8, active: 0xf59e0b, held: 0x22c55e, blocked: 0xef4444, pinned: 0xf59e0b};
    const hlMaterials = new Map();
    const hlMaterial = (tone, faint) => {
        const key = `${tone}:${faint}`;
        if (!hlMaterials.has(key)) {
            hlMaterials.set(key, new MeshBasicMaterial({color: HL_COLOURS[tone], transparent: true, opacity: faint ? 0.5 : 0.95, side: DoubleSide,
                depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4}));
        }
        return hlMaterials.get(key);
    };
    const ringGeometry = new RingGeometry(5 * LDU_M, 7.5 * LDU_M, 28);
    const pinnedRingGeometry = new RingGeometry(8.5 * LDU_M, 10 * LDU_M, 28);
    const barGeometry = new BoxGeometry(7 * LDU_M, 1.6 * LDU_M, 0.3 * LDU_M);
    const ballGeometry = new SphereGeometry(5 * LDU_M, 16, 12);
    const unitZ = new Vector3(0, 0, 1);
    /** Draws `items` ({point, normal, type, tone, faint, scale}, LDU) and remembers them for the gate. */
    const drawConnectors = items => {
        invalidate();
        connectorGroup.clear();
        for (const it of items) {
            const n = new Vector3(it.normal[0], -it.normal[1], -it.normal[2]).normalize();
            const at = new Vector3(...lduToWorld(it.point)).addScaledVector(n, 0.4 * LDU_M);
            const q = new Quaternion().setFromUnitVectors(unitZ, n);
            const mat = hlMaterial(it.tone, it.faint);
            const add = (geometry, spin = 0) => {
                const m = new Mesh(geometry, mat);
                m.position.copy(at);
                m.quaternion.copy(q);
                if (spin) m.rotateZ(spin);
                m.scale.setScalar(it.scale || 1);
                m.renderOrder = 15;
                connectorGroup.add(m);
            };
            if (it.type === 'ball' || it.type === 'ballsocket') add(ballGeometry);
            else add(ringGeometry);
            if (it.type === 'axlehole') { add(barGeometry); add(barGeometry, Math.PI / 2); }
            if (it.tone === 'pinned') add(pinnedRingGeometry);
        }
    };
    /** What is lit: the pinned target, then `extra` (the idle highlight, or the holding set). */
    const showConnectors = (extra = []) => {
        const items = [];
        if (pinned) items.push({...pinned, tone: 'pinned', scale: 1.3, active: true});
        for (const it of extra) if (!(pinned && it.partId === pinned.partId && it.connectorId === pinned.connectorId)) items.push(it);
        litList = items.filter(it => it.partId).map(it => ({partId: it.partId, connectorId: it.connectorId, active: Boolean(it.active), tone: it.tone}));
        drawConnectors(items);
    };
    /** Holding: every compatible free connector near the pointer, faint; the target opaque and bigger; the held one green. */
    const holdingLights = (lit, chosen, ghostPart) => {
        const items = [];
        const active = chosen && chosen.target;
        for (const l of lit) {
            if (active && l.partId === active.partId && l.connectorId === active.connectorId) continue;
            items.push({...l, tone: 'candidate', faint: true});
        }
        if (active) {
            items.push({partId: active.partId, connectorId: active.connectorId, type: active.type, point: active.point, normal: active.normal,
                tone: chosen.blocked ? 'blocked' : 'active', scale: 1.3, active: true});
            const lead = chosen.moves.find(m => m.id === chosen.lead.partId);
            const leadPart = lead ? lead.part || ghostPart : ghostPart;
            const p = lead && connectorWorld(lead, chosen.lead.connectorId, leadPart);
            if (p) items.push({point: p, normal: active.normal.map(v => -v), type: chosen.lead.type, tone: chosen.blocked ? 'blocked' : 'held'});
        }
        return items;
    };

    /** Nothing in hand: the free connector under the pointer (16 px; a finger 28 px), or null. */
    const litUnder = event => {
        const g = editingGroup && groupById(editingGroup);
        const outside = g ? editor.model.parts.filter(p => !g.parts.includes(p.id)).map(p => p.id) : [];
        return connectorUnderPointer(editor.model, catalogMap, rayLdu(event), projector(), {pointer: canvasPx(event), eye: eyeLdu(),
            radiusPx: event.touch || lastTouch ? SNAP_PX.idleTouch : SNAP_PX.idleMouse, exclude: [...hidden, ...outside]});
    };
    /** The hint bar, the target chip and the touch buttons follow this. */
    const emitHold = () => {
        const dragging = Boolean(gesture && gesture.kind === 'part' && gesture.started);
        onHold({holding: Boolean(tool) || dragging, tone: tool || dragging ? ghostTone : null, round: Boolean(candidate && candidate.round) ||
            Boolean(dragging && preview && preview.candidate && preview.candidate.round),
        touch: lastTouch, keyboard: keyboardHold, part: tool ? tool.part : null,
        pinned: pinned ? {partId: pinned.partId, connectorId: pinned.connectorId, part: pinned.part} : null});
    };
    /** Says a new target (or nothing) once, for the screen reader. */
    const announceTarget = (found, part) => {
        if (!found || !found.target) { lastAnnounced = null; return; }
        const key = `${found.target.partId}:${found.target.connectorId}:${found.target.entry}:${found.pairs.length}:${Boolean(found.blocked)}`;
        if (key === lastAnnounced) return;
        lastAnnounced = key;
        const into = partsById().get(found.target.partId);
        const meta = into && catalogMap.get(into.part);
        const same = meta ? meta.connectors.filter(c => c.type === found.target.type) : [];
        const n = found.target.normal;
        const k = [0, 1, 2].reduce((best, i) => (Math.abs(n[i]) > Math.abs(n[best]) ? i : best), 0);
        // LDraw: -y is up, +z is the front (towards the Home view).
        const face = [['right', 'left'], ['bottom', 'top'], ['front', 'back']][k][n[k] > 0 ? 0 : 1];
        onAnnounce({kind: found.blocked ? 'blocked' : 'target', part, target: into ? into.part : null, connector: found.target.connectorId,
            index: Math.max(0, same.findIndex(c => c.id === found.target.connectorId)), of: same.length, face, pairs: found.pairs.length,
            into: found.blocked ? partsById().get(found.blocked.into)?.part || null : null});
    };
    const setCursor = cursor => {
        if (canvas.style.cursor !== cursor) canvas.style.cursor = cursor;
    };

    /** The palette ghost's free pose, and what it would push into. */
    const setFreePose = pose => {
        freePose = pose ? {...pose, blocked: placeBlockedBy(tool.part, pose)} : null;
        if (freePose) showGhost(tool.part, freePose.position, freePose.rotation, freePose.blocked ? 'blocked' : 'free');
    };
    const HELD_ID = '__held__';
    /** Where the pointer (or, keyboard / a tapped tile, the view's centre) would put the part in hand. */
    const holdResult = () => {
        if (!tool || modifiers.alt) return null;
        const held = {parts: [{id: HELD_ID, part: tool.part, position: [0, 0, 0], rotation: tool.rotation}]};
        const project = projector();
        const common = {eye: eyeLdu(), cycle: tool.cycle, flip: tool.flip, exclude: [...hidden]};
        if (keyboardHold) {
            const w = canvas.clientWidth; const h = canvas.clientHeight;
            return snapAtPointer(editor.model, catalogMap, held, null, project, {...common, pointer: [w / 2, h / 2], allParts: true, startNearest: true, viewport: [w, h]});
        }
        if (!lastPointer) return null;
        return snapAtPointer(editor.model, catalogMap, held, rayLdu(lastPointer), project, {...common, pointer: canvasPx(lastPointer),
            radiusPx: lastPointer.touch ? SNAP_PX.targetTouch : SNAP_PX.targetMouse, previous: tool.prevKey});
    };
    /**
     * The palette ghost for the pointer at `where` (client point; null: aim again where it was).
     * Snapped: green on its target (red where it was aimed when it would push into a part); else
     * resting on the surface under the pointer, as before.
     */
    const updateGhost = (where = null, {keyboard = false} = {}) => {
        if (!tool) return;
        if (where) {
            lastPointer = {clientX: where.clientX, clientY: where.clientY, touch: Boolean(where.touch)};
            keyboardHold = keyboard;
        } else if (keyboard) keyboardHold = true;
        const r = holdResult();
        const chosen = r && r.chosen;
        if (chosen) {
            tool.prevKey = r.chosenKey;
            candidate = {...chosen, position: chosen.moves[0].position, rotation: cleanRotation(chosen.moves[0].rotation)};
            freePose = null;
            const tone = chosen.blocked ? 'blocked' : 'snap';
            showGhost(tool.part, candidate.position, candidate.rotation, tone);
            showConnectors(holdingLights(r.lit, chosen, tool.part));
            const into = chosen.blocked && partsById().get(chosen.blocked.into);
            status(chosen.blocked ? {kind: 'blocked', target: into ? into.part : null} : snapStatus(candidate));
            announceTarget(candidate, tool.part);
            setCursor(chosen.blocked ? 'not-allowed' : 'grabbing');
            emitHold();
            return;
        }
        tool.prevKey = null;
        candidate = null;
        const surface = surfaceUnder(keyboardHold || !lastPointer ? viewCentre() : lastPointer);
        showConnectors(r ? r.lit.map(l => ({...l, tone: 'candidate', faint: true})) : []);
        announceTarget(null);
        if (!surface) { emitHold(); return; }
        setFreePose(restingPose(tool.part, surface.point, tool.rotation));
        const on = surface.part && partsById().get(surface.part);
        if (freePose.blocked) status({kind: 'blocked', target: freePose.blocked.target});
        else status(on ? {kind: 'onTop', target: on.part} : {kind: 'floor'});
        setCursor(freePose.blocked ? 'not-allowed' : 'grabbing');
        emitHold();
    };

    const place = ({keepTool = false} = {}) => {
        const pose = candidate || freePose;
        if (!tool || !pose) return null;
        const blocked = candidate ? candidate.blocked : freePose.blocked;
        if (blocked) {
            const into = candidate ? partsById().get(blocked.into)?.part || null : blocked.target;
            status({kind: 'refused', reason: 'overlapPlace', target: into});
            onAnnounce({kind: 'refused', reason: 'overlapPlace', target: into});
            return null;
        }
        const snapped = Boolean(candidate);
        const part = tool.part;
        if (!run({type: 'place', part, position: pose.position, rotation: pose.rotation, color: placeColor}, {placed: part})) return null;
        const placed = editor.model.parts[editor.model.parts.length - 1];
        status(snapped ? {...snapStatus(candidate), kind: 'snapped'} : {kind: 'placed', part});
        if (!keepTool) {
            // Tinkercad: the new part is selected, ready to be moved or turned.
            setTool(null);
            setSelection([placed.id]);
        } else {
            // Shift+click: still in hand, aimed again (the spot it took is not free any more).
            tool.prevKey = null;
            updateGhost(null);
        }
        return {id: placed.id, snapped};
    };

    const setTool = (part, {centre = false} = {}) => {
        // Esc, the palette or Build closing: a drag of another part (or any) is over.
        if (paletteDrag && (!part || part !== paletteDrag.part)) {
            const d = detachPaletteDrag();
            d.onEnd({dragged: d.dragging, placed: null});
        }
        tool = part ? {part, turns: 0, rotation: homeRotation(part), cycle: 0, flip: false, prevKey: null} : null;
        candidate = null;
        freePose = null;
        keyboardHold = false;
        lastPointer = null;
        clearGhost();
        if (!part) {
            ghostTone = null;
            showConnectors([]);
            setCursor('');
        }
        if (part) {
            setSelection([]);
            canvas.focus();
            status({kind: 'placing', part});
            // Keyboard (Enter on a tile) or a tapped tile: the ghost goes to the target nearest the view's centre.
            if (centre) updateGhost(null, {keyboard: true});
        }
        updateGizmo();
        onTool(part || null);
        emitHold();
    };

    /** Turns or flips what is in hand (docs/ROBOT-LAB-UX.md §3.5): R ±90°, [ ] ±15° (round only), T tip, X flip. */
    const quarterOnlyReason = c => (c && (c.lead?.type === 'stud' || c.target?.type === 'stud' || c.target?.type === 'antistud' || c.target?.type === 'tube') ?
        'studsQuarterOnly' : 'axleQuarterOnly');
    const turnHeld = (how, direction) => {
        if (!tool) return false;
        const about = (axis, angle, from) => turnAboutLine([{position: [0, 0, 0], rotation: from}], axis, [0, 0, 0], angle)[0].rotation;
        if (how === 'flip') {
            tool.flip = !tool.flip;
            status({kind: 'flipped'});
        } else if (how === 'fine') {
            if (!candidate) { status({kind: 'refused', reason: 'fineNeedsConnection'}); return true; }
            if (!candidate.round) { status({kind: 'refused', reason: quarterOnlyReason(candidate)}); return true; }
            tool.rotation = about(candidate.axis, direction * FINE, candidate.rotation);
        } else if (how === 'tip') {
            const axis = facingAxis(camera.getWorldDirection(new Vector3()));
            tool.rotation = cleanRotation(mul3(worldAxisRotation(axis, direction * QUARTER), candidate ? candidate.rotation : tool.rotation));
        } else if (candidate) {
            tool.rotation = about(candidate.axis, direction * QUARTER, candidate.rotation);
        } else {
            tool.turns = (tool.turns + direction + 4) % 4;
            tool.rotation = cleanRotation(mul3(worldAxisRotation('y', direction * QUARTER), freePose ? freePose.rotation : tool.rotation));
        }
        updateGhost(null);
        return true;
    };
    /** Tab / Shift+Tab: the next (previous) way to put the part in hand here. */
    const cycleHeld = direction => {
        if (!tool) return false;
        if (!lastPointer) keyboardHold = true;
        tool.cycle += direction;
        updateGhost(null);
        return true;
    };
    /** Holding, keyboard: the arrows move the free ghost one grid step along the floor axes nearest the screen's. */
    const nudgeHeld = key => {
        if (!tool) return false;
        const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
        const ahead = camera.getWorldDirection(new Vector3());
        const along = v => (Math.abs(v.x) >= Math.abs(v.z) ? [Math.sign(v.x) || 1, 0, 0] : [0, 0, Math.sign(v.z) || 1]);
        const dir = {ArrowRight: along(right), ArrowLeft: along(right).map(v => -v), ArrowUp: along(ahead), ArrowDown: along(ahead).map(v => -v)}[key];
        if (!dir) return false;
        const base = candidate || freePose;
        if (!base) return true;
        // World x/z → LDraw x/-z.
        const step = [dir[0] * gridStep, 0, -dir[2] * gridStep];
        candidate = null;
        tool.prevKey = null;
        keyboardHold = true;
        setFreePose({position: base.position.map((v, i) => tidy(v + step[i])), rotation: base.rotation});
        showConnectors([]);
        if (freePose.blocked) status({kind: 'blocked', target: freePose.blocked.target});
        else status({kind: 'moving', delta: step});
        emitHold();
        return true;
    };

    // ---- Target-first (Mecabricks): a lit connector clicked, then a palette part goes into it --------
    const setPinned = lit => {
        const p = lit && partsById().get(lit.partId);
        pinned = p ? {partId: lit.partId, connectorId: lit.connectorId, type: lit.type, point: lit.point, normal: lit.normal, part: p.part} : null;
        showConnectors(idleLit ? [{...idleLit, tone: 'candidate'}] : []);
        if (pinned) status({kind: 'targetPinned', target: pinned.part, connector: pinned.connectorId});
        emitHold();
    };
    /** Whether a part from the palette could go into the pinned target (the palette dims the rest). */
    const fitsTarget = part => {
        if (!pinned) return true;
        const meta = catalogMap.get(part);
        const into = catalogMap.get(pinned.part);
        const t = into && into.connectors.find(c => c.id === pinned.connectorId);
        return Boolean(meta && t && meta.connectors.some(c => joinRule(c, t)));
    };
    /** A palette part straight into the pinned target: placed (one undo step), selected, the target cleared. */
    const placeIntoTarget = part => {
        if (!pinned) return null;
        const held = {parts: [{id: HELD_ID, part, position: [0, 0, 0], rotation: homeRotation(part)}]};
        const project = projector();
        const eye = eyeLdu();
        const q = project(pinned.point) || [canvas.clientWidth / 2, canvas.clientHeight / 2];
        const r = snapAtPointer(editor.model, catalogMap, held, {origin: eye, direction: pinned.point.map((v, i) => v - eye[i])}, project,
            {pointer: q, eye, only: {partId: pinned.partId, connectorId: pinned.connectorId}, exclude: [...hidden]});
        const chosen = r.chosen;
        if (!chosen) { status({kind: 'refused', reason: 'targetNoFit', target: pinned.part}); return null; }
        if (chosen.blocked) {
            const into = partsById().get(chosen.blocked.into);
            status({kind: 'refused', reason: 'overlapPlace', target: into ? into.part : null});
            onAnnounce({kind: 'refused', reason: 'overlapPlace', target: into ? into.part : null});
            return null;
        }
        if (tool) setTool(null);
        const mv = chosen.moves[0];
        if (!run({type: 'place', part, position: mv.position, rotation: cleanRotation(mv.rotation), color: placeColor}, {placed: part})) return null;
        const placed = editor.model.parts[editor.model.parts.length - 1];
        pinned = null;
        setSelection([placed.id]);
        status({...snapStatus({pairs: chosen.pairs}), kind: 'snapped'});
        announceTarget(chosen, part);
        emitHold();
        return {id: placed.id, snapped: true};
    };

    // ---- dragging a part out of the palette -------------------------------------------
    // The press is on the palette (a DOM element outside the canvas), so the drag is
    // followed on the window. Once the pointer has travelled CLICK_PX it is a drag: the
    // placing tool starts, and over the canvas the ghost follows the pointer through the
    // same updateGhost (magnet, resting on top, overlap) as a click-armed tool's. A
    // press that never travels is a click: the palette arms the tool itself.
    const insideCanvas = event => {
        const rect = canvas.getBoundingClientRect();
        return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    };
    const onPaletteMove = event => {
        const d = paletteDrag;
        if (!d || event.pointerId !== d.pointerId) return;
        if (!d.dragging) {
            if (travelled(event, d) <= (event.pointerType === 'touch' ? TOUCH_SLOP_PX : CLICK_PX)) return;
            d.dragging = true;
            setTool(d.part);
        }
        readModifiers(event);
        if (insideCanvas(event)) {
            updateGhost(event);
        } else {
            candidate = null;
            freePose = null;
            clearGhost();
            status({kind: 'dragging', part: d.part});
        }
    };
    const onPaletteUp = event => {
        const d = paletteDrag;
        if (!d || event.pointerId !== d.pointerId) return;
        detachPaletteDrag();
        let placed = null;
        if (d.dragging) {
            if (insideCanvas(event) && event.type === 'pointerup') {
                readModifiers(event);
                updateGhost(event);
                placed = place(); // null: refused (overlap, said in the status) or nothing under the pointer
            }
            if (tool) {
                // Not placed: the tool ends with the drag (a click arms it; a drag only carries it).
                const refused = lastStatus.kind === 'refused';
                setTool(null);
                if (!refused) status({kind: 'idle'});
            }
        }
        d.onEnd({dragged: d.dragging, placed});
    };
    const onPaletteKey = event => {
        if (event.key !== 'Escape' || !paletteDrag) return;
        event.preventDefault();
        const d = detachPaletteDrag();
        if (d.dragging) {
            setTool(null);
            status({kind: 'idle'});
        }
        d.onEnd({dragged: d.dragging, placed: null});
    };
    function detachPaletteDrag () {
        const d = paletteDrag;
        paletteDrag = null;
        window.removeEventListener('pointermove', onPaletteMove, true);
        window.removeEventListener('pointerup', onPaletteUp, true);
        window.removeEventListener('pointercancel', onPaletteUp, true);
        window.removeEventListener('keydown', onPaletteKey, true);
        return d;
    }
    /**
     * A press on a palette part. Returns at once; `onEnd({dragged, placed})` reports how
     * it ended: `dragged` false for a click (the palette then arms the tool), `placed`
     * the new part's {id, snapped} when a drag dropped it in the view.
     */
    const pressPalettePart = (part, event, onEnd = () => {}) => {
        if (paletteDrag) detachPaletteDrag();
        paletteDrag = {part, x: event.clientX, y: event.clientY, pointerId: event.pointerId, dragging: false, onEnd};
        window.addEventListener('pointermove', onPaletteMove, true);
        window.addEventListener('pointerup', onPaletteUp, true);
        window.addEventListener('pointercancel', onPaletteUp, true);
        window.addEventListener('keydown', onPaletteKey, true);
    };

    // ---- selection actions -----------------------------------------------------------
    const needSelection = () => {
        if (selection.length) return true;
        status({kind: 'refused', reason: 'nothingSelected'});
        return false;
    };
    const attachmentOf = placed => {
        const found = snapCandidates({model: editor.model, exclude: [placed.id], catalog: catalogMap, part: placed.part,
            pose: {position: placed.position, rotation: placed.rotation}, radius: HOLE_PITCH});
        return found.find(c => samePose(c, placed)) || null;
    };
    /**
     * Turns the selection a quarter turn. `axis` 'up' is the vertical, 'facing'
     * the horizontal world axis nearest the view direction. A lone part sitting
     * on a pin or an axle turns about that connection instead (R only).
     */
    const dragging = () => Boolean(gesture && gesture.kind === 'part' && gesture.started);
    const turnSelection = (axis, direction) => {
        // In hand (from the palette, or being dragged): turned about the connection it would make, or the vertical.
        if (tool) { turnHeld(axis === 'facing' ? 'tip' : 'quarter', direction); return; }
        if (dragging()) { turnDrag(axis === 'facing' ? 'tip' : 'quarter', direction); return; }
        if (!needSelection()) return;
        const parts = selectedParts();
        if (axis === 'up' && parts.length === 1) {
            const on = attachmentOf(parts[0]);
            if (on) {
                const turned = rotateAboutSnap(on, direction);
                const move = {id: parts[0].id, position: turned.position.map(v => tidy(Math.round(v * 1e6) / 1e6)), rotation: cleanRotation(turned.rotation)};
                const blocked = blockedBy([move], on.pairs.map(pair => pair.fixed.part));
                if (blocked) { status({kind: 'refused', reason: 'overlapTurn', target: blocked.target}); return; }
                if (run({type: 'moveMany', moves: [move]}, {turned: 1})) status({...snapStatus(on), kind: 'turnedAbout'});
                return;
            }
        }
        let worldAxis = 'y';
        if (axis === 'facing') worldAxis = facingAxis(camera.getWorldDirection(new Vector3()));
        const moves = rotatePoses(parts, worldAxisRotation(worldAxis, direction * QUARTER), selectionPivot(parts, gridStep));
        const blocked = blockedBy(moves);
        if (blocked) { status({kind: 'refused', reason: 'overlapTurn', target: blocked.target}); return; }
        if (run({type: 'moveMany', moves}, {turned: moves.length})) status({kind: 'turned', count: moves.length});
    };
    // The hinge tool: the selection turns on a round connection line next to it, carrying what
    // hangs off it (snap.js hingeCandidates, the fewest moving parts first); N tries the next one.
    // Worked out only when asked for ([ ], N), never on a selection change: a Select all of a
    // 2,000-part model would search every joint.
    const hingeGroup = new Group();
    s.add(hingeGroup);
    const hingeLine = new LineBasicMaterial({color: 0x16a34a, depthTest: false, transparent: true});
    const HINGE_HALF_LDU = 50;
    const drawHinge = h => {
        for (const c of [...hingeGroup.children]) { hingeGroup.remove(c); c.geometry.dispose(); }
        invalidate();
        if (!h) return;
        const ends = [-1, 1].map(k => lduToWorld(h.point.map((v, i) => v + h.axis[i] * k * HINGE_HALF_LDU)));
        const g = new BufferGeometry();
        g.setAttribute('position', new Float32BufferAttribute([...ends[0], ...ends[1]], 3));
        const line = new LineSegments(g, hingeLine);
        line.renderOrder = 30;
        hingeGroup.add(line);
    };
    const hingesNow = () => {
        const key = selection.join(',');
        if (hinge.key !== key || hinge.parts !== editor.model.parts) {
            const index = hinge.key === key ? hinge.index : 0;
            const list = hingeCandidates(editor.model, catalogMap, selection);
            hinge = {key, parts: editor.model.parts, list, index: index < list.length ? index : 0};
        }
        return hinge;
    };
    const hingeStatus = (h, extra) => ({count: h.list[h.index].moving.length, index: h.index, of: h.list.length, ...extra});
    /** N: the selection's hinge, shown as a green line on its axis; pressed again, the next one. */
    const nextHinge = (step = 1) => {
        if (tool || dragging() || !needSelection()) return;
        const shown = hinge.key === selection.join(',') && hingeGroup.children.length > 0;
        const h = hingesNow();
        if (!h.list.length) { drawHinge(null); status({kind: 'refused', reason: 'hingeNone'}); return; }
        if (shown) h.index = (h.index + step + h.list.length) % h.list.length;
        drawHinge(h.list[h.index]);
        status({kind: 'hingeShown', ...hingeStatus(h)});
    };
    /** The selection and what hangs off it turned by `degrees` on its hinge; false when there is none or it is blocked. */
    const turnOnHinge = degrees => {
        const h = hingesNow();
        if (!h.list.length) return false;
        const c = h.list[h.index];
        const byId = partsById();
        const moves = turnAboutLine(c.moving.map(id => byId.get(id)), c.axis, c.point, degrees * Math.PI / 180)
            .map(m => ({id: m.id, position: m.position, rotation: m.rotation}));
        const blocked = blockedBy(moves, c.fixed);
        if (blocked) { status({kind: 'refused', reason: 'overlapTurn', target: blocked.target}); return true; }
        if (run({type: 'moveMany', moves}, {turned: moves.length})) {
            drawHinge(c);
            status({kind: 'hinged', ...hingeStatus(h, {degrees})});
        }
        return true;
    };
    /**
     * [ / ]: 15° about a round connection (a pin or an axle in a round hole, a ball), in hand, or for
     * the selection on its hinge (with what hangs off it); refused on an axle in an axle hole and on studs.
     */
    const fineTurn = direction => {
        if (tool) { turnHeld('fine', direction); return; }
        if (dragging()) { turnDrag('fine', direction); return; }
        if (!needSelection()) return;
        if (turnOnHinge(15 * direction)) return;
        const parts = selectedParts();
        const line = parts.length === 1 ? connectionLine(editor.model, catalogMap, parts[0].id) : null;
        if (!line || line.many) { status({kind: 'refused', reason: parts.length > 1 ? 'hingeNone' : 'fineNeedsConnection'}); return; }
        if (!line.round) {
            const studs = ['stud', 'antistud', 'tube'].includes(line.shaft) || ['stud', 'antistud', 'tube'].includes(line.hole);
            status({kind: 'refused', reason: studs ? 'studsQuarterOnly' : 'axleQuarterOnly'});
            return;
        }
        const [turned] = turnAboutLine([parts[0]], line.axis, line.point, direction * FINE);
        const move = {id: parts[0].id, position: turned.position, rotation: turned.rotation};
        const blocked = blockedBy([move], pairedParts(editor.model, catalogMap, parts[0].id));
        if (blocked) { status({kind: 'refused', reason: 'overlapTurn', target: blocked.target}); return; }
        if (run({type: 'moveMany', moves: [move]}, {turned: 1})) status({kind: 'turnedBy', degrees: 15 * direction});
    };
    /** X: end for end along the connection (in hand: the other way round; a lone selected part: about its connection). */
    const flipSelection = () => {
        if (tool) { turnHeld('flip', 1); return; }
        if (dragging()) { turnDrag('flip', 1); return; }
        if (!needSelection()) return;
        const parts = selectedParts();
        const line = parts.length === 1 ? connectionLine(editor.model, catalogMap, parts[0].id) : null;
        if (!line || line.many) { status({kind: 'refused', reason: 'flipNeedsConnection'}); return; }
        // Half a turn about the world axis most across the connection, through the part's middle on that line.
        const perp = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].sort((a, b) => Math.abs(a[0] * line.axis[0] + a[1] * line.axis[1] + a[2] * line.axis[2]) -
            Math.abs(b[0] * line.axis[0] + b[1] * line.axis[1] + b[2] * line.axis[2]))[0];
        const box = partBounds(parts[0], catalogMap.get(parts[0].part));
        const mid = box ? box.min.map((v, i) => (v + box.max[i]) / 2) : parts[0].position;
        const along = mid.reduce((acc, v, i) => acc + (v - line.point[i]) * line.axis[i], 0);
        const point = line.point.map((v, i) => v + line.axis[i] * along);
        const [turned] = turnAboutLine([parts[0]], perp, point, Math.PI);
        const move = {id: parts[0].id, position: turned.position, rotation: turned.rotation};
        const blocked = blockedBy([move], pairedParts(editor.model, catalogMap, parts[0].id));
        if (blocked) { status({kind: 'refused', reason: 'overlapTurn', target: blocked.target}); return; }
        if (run({type: 'moveMany', moves: [move]}, {turned: 1})) status({kind: 'flipped'});
    };
    /**
     * Chain round the selected gears, or a tread round the selected sprockets (editor/chain-path.js):
     * the links laid round their pitch circles in one undo step, then selected; refused when a link
     * would go into a part.
     */
    const chainRoundSelection = () => {
        if (!needSelection()) return;
        const r = chainRound(editor.model, catalogMap, selection);
        if (r.error) { status({kind: 'refused', reason: `chain_${r.error}`}); return; }
        const blocked = r.links.map(l => placeBlockedBy(l.part, l)).find(Boolean);
        if (blocked) { status({kind: 'refused', reason: 'overlapPlace', target: blocked.target}); return; }
        const before = new Set(editor.model.parts.map(p => p.id));
        const commands = r.links.map(l => ({type: 'place', part: l.part, position: l.position, rotation: l.rotation, color: l.color}));
        if (!run({type: 'batch', commands}, {placed: commands[0].part})) return;
        setSelection(editor.model.parts.filter(p => !before.has(p.id)).map(p => p.id));
        status({kind: 'chained', count: commands.length, gears: r.gears.length, tread: r.links[0].part !== '3711.dat'});
    };
    /** A rubber band round the selected parts (editor/belt-path.js), one undo step; refused with the reason. */
    const beltRoundSelection = () => {
        if (!needSelection()) return;
        const r = beltRound(editor.model, catalogMap, selection);
        if (r.error) { status({kind: 'refused', reason: `band_${r.error}`}); return; }
        if (!run({type: 'addBelt', around: r.around, band: r.band})) return;
        const band = BANDS.find(b => b.part === r.band);
        status({kind: 'banded', mm: band.mm, stretch: Math.round(r.lengthLdu / band.restLdu * 10) / 10});
    };
    /**
     * A rope from the first selected part (the drum: round, on an axle) over the middle ones to the last
     * (the hook), taut as they stand (editor/rope-path.js), one undo step; refused with the reason.
     */
    const ropeSelection = () => {
        if (!needSelection()) return;
        const r = ropeTie(editor.model, catalogMap, selection);
        if (r.error) { status({kind: 'refused', reason: `rope_${r.error}`}); return; }
        if (run({type: 'addRope', around: r.around, lengthLdu: r.lengthLdu})) status({kind: 'roped', cm: Math.round(r.lengthLdu * 0.04 * 10) / 10});
    };
    /** A hose between the two selected parts' nearest free air ports, a valve's outlet to a cylinder first (editor/hose-path.js). */
    const hoseSelection = () => {
        if (!needSelection()) return;
        const h = hoseTie(editor.model, catalogMap, selection);
        if (h.error) { status({kind: 'refused', reason: `hose_${h.error}`}); return; }
        if (run({type: 'addHose', a: h.a, b: h.b})) status({kind: 'hosed', from: h.roles[0], to: h.roles[1]});
    };
    /** Removes every hose on a selected part, one undo step. */
    const removeHosesOfSelection = () => {
        if (!needSelection()) return;
        const ids = (editor.model.hoses || []).filter(h => selection.includes(h.a.part) || selection.includes(h.b.part)).map(h => h.id);
        if (!ids.length) { status({kind: 'refused', reason: 'hose_none'}); return; }
        if (run({type: 'batch', commands: ids.map(id => ({type: 'removeHose', id}))})) status({kind: 'unhosed', count: ids.length});
    };
    /** Unties every rope from or to a selected part, one undo step. */
    const removeRopesOfSelection = () => {
        if (!needSelection()) return;
        const ids = (editor.model.ropes || []).filter(r => r.around.some(id => selection.includes(id))).map(r => r.id);
        if (!ids.length) { status({kind: 'refused', reason: 'rope_none'}); return; }
        if (run({type: 'batch', commands: ids.map(id => ({type: 'removeRope', id}))})) status({kind: 'unroped', count: ids.length});
    };
    /** Takes off every rubber band round a selected part, one undo step. */
    const removeBeltsOfSelection = () => {
        if (!needSelection()) return;
        const ids = (editor.model.belts || []).filter(b => b.around.some(id => selection.includes(id))).map(b => b.id);
        if (!ids.length) { status({kind: 'refused', reason: 'band_none'}); return; }
        if (run({type: 'batch', commands: ids.map(id => ({type: 'removeBelt', id}))})) status({kind: 'unbanded', count: ids.length});
    };
    /** Selects every part joined to the selection through pairs (Studio's "By Connected"). */
    const selectConnected = () => {
        if (!needSelection()) return;
        setSelection(connectedComponent(editor.model, catalogMap, selection));
        status({kind: 'connectedSelected', count: selection.length});
    };
    const deleteSelection = () => {
        if (!needSelection()) return;
        const ids = selection.slice();
        if (run({type: 'batch', commands: ids.map(id => ({type: 'delete', id}))}, {deleted: ids.length})) {
            setSelection([]);
            status({kind: 'deleted', count: ids.length});
        }
    };
    const PASTE_OFFSETS = [
        [20, 0, 0], [-20, 0, 0], [0, 0, 20], [0, 0, -20],
        [40, 0, 0], [-40, 0, 0], [0, 0, 40], [0, 0, -40],
        [0, -24, 0]
    ];
    const pasteParts = (parts, offsets = PASTE_OFFSETS) => {
        const offset = freeOffset({model: editor.model, catalog: catalogMap, parts, offsets});
        if (!offset) {
            status({kind: 'refused', reason: 'noRoom'});
            return;
        }
        const before = editor.model.parts.length;
        const ports = portsForCopies(editor.model, catalog, parts);
        if (!run({type: 'batch', commands: placeCopies(parts, offset, ports)}, {pasted: parts.length})) return;
        setSelection(editor.model.parts.slice(before).map(p => p.id));
        status({kind: 'pasted', count: parts.length});
    };
    /** Ctrl+G: the selection becomes one group (editor-state.js `group`): clicking any member then selects all of it. */
    const groupSelection = () => {
        if (selection.length < 2) { status({kind: 'refused', reason: 'groupNeedsTwo'}); return; }
        const ids = selection.slice();
        if (run({type: 'group', ids}, {grouped: ids.length})) status({kind: 'grouped', count: ids.length});
    };
    /** Ctrl+Shift+G: every group the selection touches is taken apart (one undo step). */
    const ungroupSelection = () => {
        const groups = (editor.model.groups || []).filter(g => g.parts.some(id => selection.includes(id)));
        if (!groups.length) { status({kind: 'refused', reason: 'notGrouped'}); return; }
        if (run({type: 'batch', commands: groups.map(g => ({type: 'ungroup', id: g.id}))}, {ungrouped: groups.length})) {
            status({kind: 'ungrouped', count: groups.length});
        }
    };
    const duplicate = () => {
        if (needSelection()) pasteParts(selectedParts());
    };
    /**
     * Copies the selection: kept here (it survives switching models) and returned as
     * LDraw text, which the toolbar writes to the system clipboard and Ctrl+C puts there
     * through the copy event — so it pastes into another model, Studio or LeoCAD.
     */
    const copy = () => {
        if (!needSelection()) return null;
        clipboard = selectedParts().map(p => ({...p, position: p.position.slice(), rotation: p.rotation.slice()}));
        clipboard.pasted = 0;
        status({kind: 'copied', count: clipboard.length});
        const text = clipboardText(editor.model, selection);
        lastCopied = text;
        // Until the copy is known to be on the system clipboard, what is there is older than it.
        systemHasCopy = false;
        try {
            const written = navigator.clipboard?.writeText(text);
            if (written) written.then(() => { if (lastCopied === text) systemHasCopy = true; }, () => {});
        } catch { /* no clipboard access: the copy above still pastes here */ }
        return text;
    };
    /** Pastes LDraw text (from the system clipboard), or what was copied here when it has no parts. */
    let lastCopied = null;
    let systemHasCopy = false;
    const pasteText = text => {
        // Our own copy, read back from the system clipboard: pasted like the copy kept here (beside it).
        // A copy made here that never reached the system clipboard (no permission) is newer than
        // whatever text is there, so it wins; once it did reach it, other text there came later.
        const stale = clipboard.length && lastCopied !== null && !systemHasCopy;
        const fromText = !text || stale || text === lastCopied ? null : partsFromClipboard(text, catalogMap);
        if (fromText && fromText.parts.length) {
            // Parts from elsewhere go where they were in their model, when that spot is free.
            // Fresh ids: the text's own may name parts of this model, which the overlap test would skip.
            pasteParts(fromText.parts.map((p, i) => ({...p, id: `__paste${i}`})), [[0, 0, 0], ...PASTE_OFFSETS]);
            return true;
        }
        if (!clipboard.length) {
            status({kind: 'refused', reason: fromText ? 'clipboardUnknown' : 'clipboardEmpty'});
            return false;
        }
        pasteParts(clipboard);
        return true;
    };
    const paste = async () => {
        if (disposed) return false;
        // Our copy is the newest thing to paste and is here already: no need to wait for the system clipboard.
        if (clipboard.length && !systemHasCopy) return pasteText(null);
        let text = null;
        try {
            text = navigator.clipboard && navigator.clipboard.readText ? await navigator.clipboard.readText() : null;
        } catch { /* not allowed: what was copied here */ }
        // Closing the view also cancels a pending clipboard read or permission prompt.
        if (disposed) return false;
        return pasteText(text);
    };
    const undo = () => {
        if (!editor.canUndo) { status({kind: 'refused', reason: 'nothingToUndo'}); return; }
        editor.undo();
        onChange(editor.model, {undo: true});
        status({kind: 'undone'});
    };
    const redo = () => {
        if (!editor.canRedo) { status({kind: 'refused', reason: 'nothingToRedo'}); return; }
        editor.redo();
        onChange(editor.model, {redo: true});
        status({kind: 'redone'});
    };
    const setMode = next => {
        mode = next === 'rotate' ? 'rotate' : 'move';
        updateGizmo();
        onMode(mode);
    };

    // ---- Studio's tools: hide, colour, mirror, align, measure, edit inside a group --------------
    const afterVisibility = () => {
        setSelection(selection);
        drawOutlines();
        refreshPorts();
        viewState();
    };
    /** H: the selection disappears from view (not from the model) until "Show all". */
    const hideSelection = () => {
        if (!needSelection()) return;
        const n = selection.length;
        for (const id of selection) hidden.add(id);
        afterVisibility();
        status({kind: 'hidden', count: n});
    };
    /** I: only the selection stays in view. */
    const isolate = () => {
        if (!needSelection()) return;
        const keep = new Set(selection);
        hidden.clear();
        for (const p of editor.model.parts) if (!keep.has(p.id)) hidden.add(p.id);
        afterVisibility();
        status({kind: 'isolated', count: keep.size});
    };
    /** Shift+H: every part in view again. */
    const showAll = () => {
        if (!hidden.size) { status({kind: 'refused', reason: 'nothingHidden'}); return; }
        const n = hidden.size;
        hidden.clear();
        afterVisibility();
        status({kind: 'shownAll', count: n});
    };
    /** The pane restores what was hidden (it keeps it for the browser session). */
    const setHidden = ids => {
        hidden.clear();
        for (const id of ids || []) if (meshes.has(id)) hidden.add(id);
        afterVisibility();
    };

    /**
     * A model command whose effect is new poses for some parts (mirror, align, a typed
     * position): refused like a move when a part would go into another, else ONE undo step.
     */
    const runMoves = (cmd, moves, info, done) => {
        if (!moves.length) { status({kind: 'refused', reason: 'nothingMoves'}); return false; }
        const blocked = blockedBy(moves.map(m => ({id: m.id, position: m.position, rotation: m.rotation})));
        if (blocked) { status({kind: 'refused', reason: 'overlapMove', target: blocked.target}); return false; }
        if (!run(cmd, info)) return false;
        status(done);
        return true;
    };
    const unchanged = poses => {
        const byId = partsById();
        return poses.every(m => {
            const p = byId.get(m.id);
            return p && (!m.part || m.part === p.part) && m.position.every((v, i) => v === p.position[i]) && m.rotation.every((v, i) => v === p.rotation[i]);
        });
    };
    /** Mirror across x (left ↔ right) or z (front ↔ back), in place (editor-parity.js mirrorPoses). */
    const mirrorSelection = axis => {
        if (!needSelection()) return false;
        const ids = selection.slice();
        const pivot = mirrorPivot(editor.model, catalogMap, ids, axis);
        const poses = mirrorPoses(selectedParts(), catalogMap, axis, pivot);
        if (unchanged(poses)) { status({kind: 'refused', reason: 'mirrorSame'}); return false; }
        const count = how => poses.filter(m => m.how === how).length;
        return runMoves({type: 'mirror', ids, axis, pivot}, poses, {mirrored: ids.length},
            {kind: 'mirrored', count: ids.length, swapped: count('swapped'), kept: count('kept')});
    };
    /** Edges or centres of the selected parts (groups move as one) lined up on a model axis. */
    const alignSelection = (axis, alignTo) => {
        const ids = selection.slice();
        const moves = alignMoves({model: editor.model, catalog: catalogMap, ids, axis, mode: alignTo});
        if (ids.length < 2) { status({kind: 'refused', reason: 'alignNeedsTwo'}); return false; }
        return runMoves({type: 'align', ids, axis, mode: alignTo}, moves, {aligned: moves.length}, {kind: 'aligned', count: moves.length});
    };
    const distributeSelection = axis => {
        const ids = selection.slice();
        const moves = distributeMoves({model: editor.model, catalog: catalogMap, ids, axis});
        if (ids.length < 3) { status({kind: 'refused', reason: 'distributeNeedsThree'}); return false; }
        return runMoves({type: 'distribute', ids, axis}, moves, {distributed: moves.length}, {kind: 'distributed', count: moves.length});
    };
    const selectionToGrid = () => {
        if (!needSelection()) return false;
        const ids = selection.slice();
        const moves = gridMoves({model: editor.model, catalog: catalogMap, ids, grid: gridStep});
        if (!moves.length) { status({kind: 'refused', reason: 'onGridAlready'}); return false; }
        return runMoves({type: 'toGrid', ids, grid: gridStep}, moves, {gridded: moves.length}, {kind: 'gridded', count: moves.length});
    };
    /** The colour picker: one colour on the whole selection (one undo step). */
    const paintSelection = color => {
        if (!needSelection()) return false;
        const ids = selection.slice();
        const byId = partsById();
        if (ids.every(id => (byId.get(id)?.color ?? DEFAULT_COLOR) === color)) { status({kind: 'refused', reason: 'sameColour'}); return false; }
        if (!run({type: 'paint', ids, color}, {painted: ids.length})) return false;
        status({kind: 'painted', count: ids.length, color});
        return true;
    };
    /** Typed numbers (the properties panel): a part's pose, or the selection moved or turned. */
    const setPartPose = (id, position, rotation) => {
        const p = partsById().get(id);
        if (!p) return false;
        const moves = [{id, position: position.map(v => tidy(Math.round(v * 1e6) / 1e6)), rotation: cleanRotation(rotation)}];
        if (unchanged(moves)) return false;
        return runMoves({type: 'moveMany', moves}, moves, {moved: 1}, {kind: 'moved', count: 1});
    };
    const moveSelectionBy = delta => {
        if (!needSelection()) return false;
        const moves = translatePoses(selectedParts(), delta);
        if (unchanged(moves)) return false;
        return runMoves({type: 'moveMany', moves}, moves, {moved: moves.length}, {kind: 'moved', count: moves.length});
    };
    const turnSelectionBy = (axis, degrees) => {
        if (!needSelection()) return false;
        const parts = selectedParts();
        const moves = rotatePoses(parts, worldAxisRotation(axis, degrees * Math.PI / 180), selectionPivot(parts, gridStep));
        if (unchanged(moves)) return false;
        return runMoves({type: 'moveMany', moves}, moves, {turned: moves.length}, {kind: 'turnedBy', count: moves.length, degrees});
    };

    // The eyedropper and the measuring tape: the next click picks, it does not select.
    const measureGroup = new Group();
    s.add(measureGroup);
    const measureLine = new LineBasicMaterial({color: 0x7c3aed, depthTest: false, transparent: true});
    const measureDot = new MeshBasicMaterial({color: 0x7c3aed, depthTest: false});
    const measureDiv = document.createElement('div');
    measureDiv.dataset.testid = 'bw-sim-lab-measure-label';
    Object.assign(measureDiv.style, {position: 'absolute', display: 'none', transform: 'translate(-50%, -130%)', pointerEvents: 'none',
        background: '#7c3aed', color: '#fff', font: '600 12px system-ui, sans-serif', padding: '3px 7px', borderRadius: '6px',
        whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(15, 23, 42, 0.3)', zIndex: 4});
    container.appendChild(measureDiv);
    const drawMeasure = () => {
        invalidate();
        for (const c of [...measureGroup.children]) {
            measureGroup.remove(c);
            if (c.geometry !== markerGeometry) c.geometry.dispose();
        }
        measureDiv.style.display = 'none';
        if (!measure || !measure.a) return;
        for (const p of [measure.a, measure.b].filter(Boolean)) {
            const dot = new Mesh(markerGeometry, measureDot);
            dot.position.fromArray(lduToWorld(p));
            dot.renderOrder = 30;
            measureGroup.add(dot);
        }
        if (measure.b) {
            const g = new BufferGeometry();
            g.setAttribute('position', new Float32BufferAttribute([...lduToWorld(measure.a), ...lduToWorld(measure.b)], 3));
            const line = new LineSegments(g, measureLine);
            line.renderOrder = 30;
            measureGroup.add(line);
            measureDiv.textContent = measureLabel(measure.result);
            measureDiv.style.display = 'block';
        }
    };
    const placeMeasureLabel = () => {
        if (!measure || !measure.b) return;
        const mid = new Vector3(...lduToWorld(measure.a.map((v, i) => (v + measure.b[i]) / 2))).project(camera);
        measureDiv.style.left = `${(mid.x + 1) / 2 * canvas.clientWidth}px`;
        measureDiv.style.top = `${(1 - mid.y) / 2 * canvas.clientHeight}px`;
    };
    /** Arms (or, given the armed one, disarms) the eyedropper ('color') or the measuring tape ('measure'). */
    const setPick = next => {
        pickMode = next && next !== pickMode ? next : null;
        hovered = null; // the next pointer move says again what is under it
        if (pickMode && tool) setTool(null);
        // While picking, a press on the gizmo picks the part under it instead.
        transform.enabled = !pickMode;
        measure = pickMode === 'measure' ? {a: null, b: null, result: null} : null;
        drawMeasure();
        status({kind: pickMode === 'color' ? 'eyedropper' : pickMode === 'measure' ? 'measureFirst' : 'idle'});
        viewState();
    };
    const doPick = event => {
        const hit = partUnder(event);
        const placed = hit && partsById().get(hit.object.name);
        if (pickMode === 'color') {
            if (!placed) { status({kind: 'refused', reason: 'pickAPart'}); return; }
            const color = placed.color ?? DEFAULT_COLOR;
            pickMode = null;
            hovered = null;
            transform.enabled = true;
            viewState();
            status({kind: 'pickedColor', color, part: placed.part});
            onColorPicked(color, placed.id);
            return;
        }
        if (pickMode !== 'measure') return;
        let point;
        if (placed) {
            point = measurePoint(placed, catalogMap.get(placed.part), worldToLdu(hit.point)).point;
        } else {
            const f = pick(event).ray.intersectPlane(floor, new Vector3());
            if (!f) return;
            point = worldToLdu(f).map(v => tidy(Math.round(v * 10) / 10));
        }
        if (!measure || !measure.a || measure.b) measure = {a: point, b: null, result: null};
        else measure = {...measure, b: point, result: measureBetween(measure.a, point)};
        drawMeasure();
        viewState();
        status(measure.result ? {kind: 'measured', ...measure.result} : {kind: 'measureSecond'});
    };

    /** Double click on a grouped part: edit inside its group (members one by one) until Esc. */
    const enterGroup = (gid, id = null) => {
        const g = groupById(gid);
        if (!g) { status({kind: 'refused', reason: 'notGrouped'}); return false; }
        if (tool) setTool(null);
        editingGroup = gid;
        setSelection(id ? [id] : []);
        drawOutlines();
        status({kind: 'groupEdit', name: g.name});
        viewState();
        return true;
    };
    const leaveGroup = () => {
        if (!editingGroup) return false;
        const g = groupById(editingGroup);
        editingGroup = null;
        setSelection(g ? g.parts.slice() : []);
        drawOutlines();
        status({kind: 'groupLeft', name: g ? g.name : ''});
        viewState();
        return true;
    };
    const onDblClick = event => {
        if (tool || pickMode || cubeHit(event)) return;
        const hit = partUnder(event);
        if (!hit) { leaveGroup(); return; }
        const id = hit.object.name;
        const g = (editor.model.groups || []).find(x => x.parts.includes(id));
        // A grouped part: edit inside its group (as before); any other part: the view centres on the clicked point.
        if (g && editingGroup !== g.id) enterGroup(g.id, id);
        else focusOn(hit.point);
    };

    // Ctrl+C / Ctrl+V reach the system clipboard through the copy and paste events (no permission
    // needed); a browser that sends no paste event to a canvas pastes what was copied here.
    let copyText = null;
    let pendingPaste = null;
    const onCopyEvent = event => {
        if (copyText === null) return;
        if (event.clipboardData) {
            event.clipboardData.setData('text/plain', copyText);
            systemHasCopy = true;
        }
        event.preventDefault();
        copyText = null;
    };
    const onPasteEvent = event => {
        if (pendingPaste === null) return;
        clearTimeout(pendingPaste);
        pendingPaste = null;
        event.preventDefault();
        pasteText(event.clipboardData ? event.clipboardData.getData('text/plain') : null);
    };

    // ---- camera ---------------------------------------------------------------------
    // docs/ROBOT-LAB-UX.md §3.7: orbit about the point under the pointer (camera and target turn
    // together, so it stays put), zoom to the point under the pointer, a trackpad's scroll orbits,
    // every camera move the program makes eases (or jumps, with prefers-reduced-motion).
    /** Puts the camera and its target where `to` says ({position, target}, world arrays). */
    const applyCamera = ({position, target}) => {
        camera.position.fromArray(position);
        controls.target.fromArray(target);
        const d = camera.position.distanceTo(controls.target);
        camera.near = Math.max(0.001, d / 200);
        camera.far = Math.max(1, d * 100);
        camera.updateProjectionMatrix();
        camera.lookAt(controls.target);
        controls.update();
        invalidate();
    };
    let camAnim = null; // {from, to, start}
    const prefersReducedMotion = () => {
        try { return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch { return false; }
    };
    /** A camera move the program makes: eased over CAMERA_ANIMATION_MS, or at once (`animate` false, reduced motion). */
    const moveCamera = (to, {animate = true} = {}) => {
        if (!animate || prefersReducedMotion()) {
            camAnim = null;
            applyCamera(to);
            return;
        }
        camAnim = {from: {position: camera.position.toArray(), target: controls.target.toArray()}, to, start: performance.now()};
        invalidate();
    };
    function stopCameraAnimation () { camAnim = null; }
    /** One frame of the camera's eased move: the target slides, the view direction turns, the distance changes. */
    const stepCamera = () => {
        if (!camAnim) return;
        const k = easeOut((performance.now() - camAnim.start) / CAMERA_ANIMATION_MS);
        const {from, to} = camAnim;
        if (k >= 1) {
            camAnim = null;
            applyCamera(to);
            return;
        }
        const target = from.target.map((v, i) => v + (to.target[i] - v) * k);
        const o0 = new Vector3().fromArray(from.position).sub(new Vector3().fromArray(from.target));
        const o1 = new Vector3().fromArray(to.position).sub(new Vector3().fromArray(to.target));
        const length = o0.length() + (o1.length() - o0.length()) * k;
        const turn = new Quaternion().slerp(new Quaternion().setFromUnitVectors(o0.clone().normalize(), o1.clone().normalize()), k);
        const dir = o0.normalize().applyQuaternion(turn);
        applyCamera({position: dir.multiplyScalar(length).add(new Vector3().fromArray(target)).toArray(), target});
    };
    const fitBox = (box, direction, {animate = false} = {}) => {
        const b = box.isEmpty() ? new Box3(new Vector3(-0.05, floorY ?? 0, -0.05), new Vector3(0.05, (floorY ?? 0) + 0.05, 0.05)) : box;
        const sphere = b.getBoundingSphere(new Sphere());
        const radius = Math.max(0.02, sphere.radius);
        const vHalf = camera.fov * Math.PI / 360;
        const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
        const distance = radius / Math.sin(Math.min(vHalf, hHalf)) * 1.15;
        const dir = (direction || camera.position.clone().sub(controls.target)).clone().normalize();
        moveCamera({position: sphere.center.clone().addScaledVector(dir, distance).toArray(), target: sphere.center.toArray()}, {animate});
    };
    /** Double click on a part: the view centres on the clicked point, at the same distance. */
    const focusOn = point => {
        const shift = point.clone().sub(controls.target);
        moveCamera({position: camera.position.clone().add(shift).toArray(), target: point.toArray()});
        cameraTouched = true;
    };
    /** Where an orbit turns about: the point under the pointer when the gesture starts, else the target. */
    const orbitStart = event => {
        const hit = partUnder(event);
        return {pivot: hit ? hit.point.clone() : controls.target.clone(), x: event.clientX, y: event.clientY};
    };
    const pivotDot = new Mesh(new SphereGeometry(2.5 * LDU_M, 12, 8), new MeshBasicMaterial({color: 0xf59e0b, depthTest: false, transparent: true, opacity: 0.9}));
    pivotDot.renderOrder = 40;
    /** Turns camera and target together about `pivot` (screen pixels dragged; the view's polar range holds). */
    const orbitBy = (dx, dy, pivot = controls.target) => {
        const a = orbitAngles(dx, dy, canvas.clientHeight);
        applyCamera(orbitAboutPivot({position: camera.position.toArray(), target: controls.target.toArray(), pivot: pivot.toArray(),
            theta: a.theta, phi: a.phi, minPolar: controls.minPolarAngle, maxPolar: controls.maxPolarAngle}));
        cameraTouched = true;
    };
    const orbitDrag = (event, o) => {
        const dx = event.clientX - o.x;
        const dy = event.clientY - o.y;
        o.x = event.clientX;
        o.y = event.clientY;
        if (!pivotDot.parent) {
            pivotDot.position.copy(o.pivot);
            pivotGroup.add(pivotDot);
        }
        if (dx || dy) orbitBy(dx, dy, o.pivot);
        setCursor('grabbing');
    };
    const endOrbit = () => {
        if (pivotDot.parent) { pivotGroup.remove(pivotDot); invalidate(); }
        setCursor('');
    };
    /** Slides camera and target together by screen pixels. */
    const panBy = (dx, dy) => {
        const distance = camera.position.distanceTo(controls.target);
        camera.updateMatrix();
        const [right, up] = panAmounts(dx, dy, distance, camera.fov, canvas.clientHeight);
        const shift = new Vector3().setFromMatrixColumn(camera.matrix, 0).multiplyScalar(right)
            .add(new Vector3().setFromMatrixColumn(camera.matrix, 1).multiplyScalar(up));
        applyCamera({position: camera.position.clone().add(shift).toArray(), target: controls.target.clone().add(shift).toArray()});
        cameraTouched = true;
    };
    /** The world point a zoom at the pointer keeps under it: a part, else the floor, else the target's depth. */
    const zoomPointAt = event => {
        const hit = partUnder(event);
        if (hit) return hit.point.toArray();
        const ray = raycaster.ray;
        const distance = camera.position.distanceTo(controls.target);
        const f = ray.intersectPlane(floor, new Vector3());
        if (f && f.distanceTo(camera.position) < distance * 20) return f.toArray();
        return ray.at(distance, new Vector3()).toArray();
    };
    let wheelOrbit = null; // a trackpad's scroll: its pivot, kept while the scrolling goes on
    /** The wheel and the trackpad (camera-nav.js wheelIntent): zoom to the pointer, orbit, or pan. */
    const onWheel = event => {
        event.preventDefault();
        event.stopImmediatePropagation(); // three's OrbitControls never zooms here: this does, to the point under the pointer
        stopCameraAnimation();
        const intent = wheelIntent(event, wheelMode);
        if (intent === 'zoom') {
            const d = camera.position.distanceTo(controls.target);
            const wanted = Math.min(controls.maxDistance, Math.max(Math.max(0.01, controls.minDistance), d * wheelZoomFactor(event)));
            applyCamera(zoomAbout({position: camera.position.toArray(), target: controls.target.toArray(), point: zoomPointAt(event), factor: wanted / d}));
        } else if (intent === 'orbit') {
            if (!wheelOrbit || event.timeStamp > wheelOrbit.until) wheelOrbit = {pivot: orbitStart(event).pivot};
            wheelOrbit.until = event.timeStamp + 300;
            orbitBy(-event.deltaX, -event.deltaY, wheelOrbit.pivot);
        } else {
            panBy(-(event.deltaX || event.deltaY), event.deltaX ? -event.deltaY : 0);
        }
        cameraTouched = true;
    };
    const modelBox = ids => {
        const box = new Box3();
        if (!ids) for (const mesh of meshes.values()) box.expandByObject(mesh);
        else for (const id of new Set(ids)) { const mesh = meshes.get(id); if (mesh) box.expandByObject(mesh); }
        return box;
    };
    const VIEWS = Object.fromEntries(Object.entries(VIEW_DIRECTIONS).map(([name, d]) => [name, new Vector3(...d)]));
    const view = name => {
        modelGroup.updateMatrixWorld(true);
        fitBox(modelBox(), VIEWS[name] || VIEWS.home, {animate: true});
        cameraTouched = true;
    };
    const fitSelection = () => {
        modelGroup.updateMatrixWorld(true);
        fitBox(modelBox(selection.length ? selection : null), null, {animate: true});
        cameraTouched = true;
    };
    const frameModel = () => {
        modelGroup.updateMatrixWorld(true);
        fitBox(modelBox(), VIEWS.home);
    };

    // ---- pointer handling -----------------------------------------------------------
    const boxDiv = document.createElement('div');
    boxDiv.dataset.testid = 'bw-sim-lab-box-select';
    Object.assign(boxDiv.style, {position: 'absolute', display: 'none', border: '1.5px dashed #2563eb', background: 'rgba(37,99,235,0.08)', pointerEvents: 'none'});
    container.appendChild(boxDiv);

    const readModifiers = event => {
        modifiers = {alt: event.altKey, shift: event.shiftKey};
        transform.setRotationSnap(event.shiftKey ? Math.PI / 12 : QUARTER);
    };
    const travelled = (event, g) => Math.hypot(event.clientX - g.x, event.clientY - g.y);

    function onDown (event) {
        lastTouch = event.pointerType === 'touch';
        stopCameraAnimation();
        if (lastTouch) { onTouchDown(event); return; }
        readModifiers(event);
        canvas.focus();
        if (cubeHit(event)) {
            // The view cube: its face, edge or corner turns the view there (OrbitControls never sees the press).
            event.stopImmediatePropagation();
            event.preventDefault();
            clickViewCube(event);
            gesture = null;
            return;
        }
        if (event.button === orbitButtonOf(mousePreset)) {
            // Middle drag (right drag in the Studio preset): orbit about the point under the pointer.
            gesture = {x: event.clientX, y: event.clientY, pointerId: event.pointerId, kind: 'orbit', orbit: orbitStart(event), button: event.button};
            canvas.setPointerCapture(event.pointerId);
            return;
        }
        // The right button pans (OrbitControls) or orbits (above); a right click without a drag puts down what is in hand.
        if (event.button === 2) { gesture = {x: event.clientX, y: event.clientY, pointerId: event.pointerId, kind: 'right'}; return; }
        if (event.button !== 0) { gesture = null; return; }
        if (pickMode) { gesture = {x: event.clientX, y: event.clientY, pointerId: event.pointerId, kind: 'pick'}; return; }
        // The gizmo gets the press when the pointer is on one of its handles (on a
        // part, only on the handle's visible shape: the picker reaches further).
        if (gizmoGrab(event)) { controls.enabled = false; return; }
        const base = {x: event.clientX, y: event.clientY, pointerId: event.pointerId};
        if (tool) { gesture = {...base, kind: 'tool', orbit: orbitStart(event)}; return; }
        const hit = partUnder(event);
        if (hit && (event.ctrlKey || event.metaKey)) {
            // Ctrl+click: the part and everything joined to it (Studio's "By Connected"); Ctrl+drag glides a
            // pin or an axle along its hole. Not the camera: OrbitControls pans on Ctrl+drag.
            controls.enabled = false;
            gesture = {...base, kind: 'connected', id: hit.object.name};
            return;
        }
        if (event.shiftKey || !hit) {
            // Empty-space drag replaces selection; Shift adds and Shift+click toggles.
            event.preventDefault();
            event.stopImmediatePropagation();
            controls.enabled = false;
            transform.enabled = false; // even when the gizmo's picker reaches over the part
            gesture = {...base, kind: 'box', hit: hit ? hit.object.name : null, additive: event.shiftKey, base: selection.slice()};
            canvas.setPointerCapture(event.pointerId);
            return;
        }
        if (hit) {
            const id = hit.object.name;
            const wasSelected = selection.includes(id);
            if (!wasSelected) setSelection([id]);
            controls.enabled = false;
            transform.enabled = false;
            // The pressed point on the part, and how high above the part's own bottom it is:
            // while dragging, that point stays under the pointer and the bottom rests on
            // the surface under it.
            modelGroup.updateMatrixWorld(true);
            const bottom = modelBox(selection).min.y;
            gesture = {...base, kind: 'part', start: selectedParts(), grab: hit.point.clone(), bottom, started: false,
                // Target-first: a lit hole of a part already selected (the first click selects, the next one pins).
                lit: wasSelected ? litUnder(event) : null};
            canvas.setPointerCapture(event.pointerId);
            return;
        }
        gesture = {...base, kind: 'empty', orbit: orbitStart(event)};
    }

    // Ctrl+drag on a pin or an axle in its holes glides it along them, a little at a time (Studio's Ctrl
    // on an axle). It stays in at least one hole; a pose into another part is refused when let go.
    const GLIDE_SHAFTS = ['pin', 'axle'];
    /** Where along line (point + axis·t) a ray passes closest: t (LDU), or null when the ray runs along it. */
    const alongLine = (ray, point, axis) => {
        const b = vecDot(axis, ray.direction);
        const den = 1 - b * b;
        if (den < 1e-4) return null;
        const w = vecSub(point, ray.origin);
        return (b * vecDot(ray.direction, w) - vecDot(axis, w)) / den;
    };
    const glideStart = (id, event) => {
        const pl = partsById().get(id);
        const meta = pl && catalogMap.get(pl.part);
        const line = pl ? connectionLine(editor.model, catalogMap, id) : null;
        if (!line || line.many) return null;
        const shaft = (meta.connectors || []).some(c => GLIDE_SHAFTS.includes(c.type) &&
            Math.abs(Math.abs(vecDot(vecNormalize(mat3MulVec3(pl.rotation, c.axis)), line.axis)) - 1) < 1e-3);
        const t0 = shaft ? alongLine(rayLdu(event), line.point, line.axis) : null;
        return t0 === null ? null : {id, start: pl, axis: line.axis, point: line.point, t0, delta: 0};
    };
    let lastGlide = null; // for the browser gate: the last glide step {t0, t, delta, out}
    const glideMove = (g, event) => {
        const t = alongLine(rayLdu(event), g.point, g.axis);
        lastGlide = {t0: g.t0, t, delta: g.delta, out: false};
        if (t === null) return;
        const delta = tidy(Math.round((t - g.t0) * 10) / 10);
        const move = {id: g.id, position: g.start.position.map((v, i) => tidy(v + g.axis[i] * delta)), rotation: g.start.rotation};
        // Still in a hole? The model with the part moved there must pair it with something.
        const parts = editor.model.parts.map(p => (p.id === g.id ? {...p, position: move.position} : p));
        if (!pairedParts({...editor.model, parts}, catalogMap, g.id).length) { lastGlide.out = true; status({kind: 'refused', reason: 'glideOut'}); return; }
        g.delta = delta;
        preview = {moves: [move], candidate: null, blocked: blockedBy([move], pairedParts(editor.model, catalogMap, g.id))};
        placeMeshes();
        status(preview.blocked ? {kind: 'blocked', target: preview.blocked.target} : {kind: 'gliding', ldu: delta});
        setCursor(preview.blocked ? 'not-allowed' : 'grabbing');
    };

    const onMove = event => {
        if (gesture && !gesture.touch && gesture.pointerId !== event.pointerId) return;
        if (event.pointerType === 'mouse') lastTouch = false;
        readModifiers(event);
        if (paletteDrag && paletteDrag.dragging) return; // onPaletteMove follows it
        if (gesture && gesture.kind === 'connected' && (gesture.glide || travelled(event, gesture) > CLICK_PX)) {
            if (gesture.glide === undefined) {
                gesture.glide = glideStart(gesture.id, event);
                if (!gesture.glide) status({kind: 'refused', reason: 'glideNeedsHole'});
                else canvas.setPointerCapture(gesture.pointerId);
            }
            if (gesture.glide) { glideMove(gesture.glide, event); return; }
        }
        if (gesture && gesture.orbit && (gesture.kind === 'orbit' || travelled(event, gesture) > CLICK_PX) &&
            (gesture.kind === 'orbit' || gesture.kind === 'empty' || gesture.kind === 'tool')) {
            orbitDrag(event, gesture.orbit);
            return;
        }
        if (tool && (!gesture || travelled(event, gesture) <= CLICK_PX)) { updateGhost(event); return; }
        if (!gesture) {
            if (transform.dragging) return;
            if (cubeHit(event)) { setCursor('pointer'); return; }
            gizmoHover = pickMode ? null : gizmoGrab(event);
            if (gizmoHover) {
                if (hovered !== `gizmo:${transform.axis}`) {
                    hovered = null;
                    drawOutlines();
                    hovered = `gizmo:${transform.axis}`;
                    status({kind: 'gizmo', axis: transform.axis, mode});
                }
                return;
            }
            const hit = partUnder(event);
            const id = hit ? hit.object.name : null;
            setCursor(id && !pickMode ? 'grab' : '');
            // Nothing in hand: the one free connector under the pointer lights up (a click pins it as the target).
            const lit = id && !pickMode ? litUnder(event) : null;
            if ((lit && lit.connectorId) !== (idleLit && idleLit.connectorId) || (lit && lit.partId) !== (idleLit && idleLit.partId)) {
                idleLit = lit;
                showConnectors(lit ? [{...lit, tone: 'candidate', active: true}] : []);
            }
            if (id !== hovered) {
                hovered = id;
                drawOutlines();
                const p = id && partsById().get(id);
                if (pickMode) return; // the tool's own instruction stays
                if (p) status({kind: 'hover', part: p.part, selected: selection.includes(id)});
                else status({kind: 'idle'});
            }
            return;
        }
        if (gesture.kind === 'part') {
            if (!gesture.started && travelled(event, gesture) <= CLICK_PX) return;
            if (!gesture.started) startDrag(gesture);
            dragPart(event, gesture);
        } else if (gesture.kind === 'box') {
            drawBox(event, gesture);
        }
    };

    /**
     * A drag starts: what it carries (the selection), the pressed point in LDU (its nearest held
     * connector leads the snap), and the part it pulls away from ("Released from …").
     */
    const startDrag = g => {
        g.started = true;
        g.spin = IDENTITY;
        g.cycle = 0;
        g.flip = false;
        g.prevKey = null;
        g.grabLdu = worldToLdu(g.grab);
        const inside = new Set(g.start.map(p => p.id));
        const outside = g.start.flatMap(p => pairedParts(editor.model, catalogMap, p.id)).find(id => !inside.has(id));
        const from = outside && partsById().get(outside);
        g.released = from ? from.part : null;
        if (pinned) { pinned = null; showConnectors([]); }
    };
    /** The carried parts as turned in the hand (R, [ ], T while dragging): turned about the pressed point. */
    const heldBase = g => (g.spin === IDENTITY ? g.start : rotatePoses(g.start, g.spin, g.grabLdu).map((m, i) => ({...m, part: g.start[i].part})));
    /** A pressed part (and the rest of the selection) follows the pointer or finger at `event` (clientX/Y). */
    const dragPart = (event, g) => {
        g.last = {clientX: event.clientX, clientY: event.clientY, touch: Boolean(event.touch)};
        const surface = surfaceUnder(event, selection);
        if (!surface) return;
        // Where the pressed point would be: on the pointer's ray, as high above the
        // surface as it was above the part's bottom.
        const ray = raycaster.ray;
        const height = surface.point.y + (g.grab.y - g.bottom);
        const t = Math.abs(ray.direction.y) > 1e-6 ? (height - ray.origin.y) / ray.direction.y : -1;
        const at = t > 0 ? ray.at(t, new Vector3()) : surface.point.clone();
        const d = worldDeltaToLdu(new Vector3(at.x - g.grab.x, surface.point.y - g.bottom, at.z - g.grab.z));
        const delta = [Math.round(d[0] / gridStep) * gridStep, Math.round(d[1]), Math.round(d[2] / gridStep) * gridStep].map(tidy);
        const base = heldBase(g);
        // The connection the pointer asks for (snap.js snapAtPointer): any selection, all of its pairs counted.
        let found = null;
        let lit = [];
        if (!modifiers.alt) {
            const r = snapAtPointer(editor.model, catalogMap, {parts: base, grab: g.grabLdu}, rayLdu(event), projector(),
                {pointer: canvasPx(event), eye: eyeLdu(), radiusPx: g.touch ? SNAP_PX.targetTouch : SNAP_PX.targetMouse, previous: g.prevKey,
                    cycle: g.cycle, flip: g.flip, exclude: [...hidden]});
            found = r.chosen;
            lit = r.lit;
            g.prevKey = r.chosenKey;
        }
        if (found) {
            const moves = found.moves.map(m => ({id: m.id, position: m.position, rotation: cleanRotation(m.rotation)}));
            const into = found.blocked && partsById().get(found.blocked.into);
            const blocked = found.blocked ? {part: found.blocked.part, into: found.blocked.into, target: into ? into.part : null} : null;
            preview = {moves, candidate: {...found, position: moves[0].position, rotation: moves[0].rotation}, blocked};
            placeMeshes();
            clearGhost();
            ghostTone = blocked ? 'blocked' : 'snap';
            if (!blocked) for (const m of found.moves) showGhostAlso(m.part, m.position, m.rotation, 'snap');
            showConnectors(holdingLights(lit, found, null));
            status(blocked ? {kind: 'blocked', target: blocked.target} : snapStatus(found));
            announceTarget(found, g.start[0].part);
        } else {
            const moves = translatePoses(base, delta);
            const blocked = blockedBy(moves);
            preview = {moves, candidate: null, blocked};
            placeMeshes();
            clearGhost();
            ghostTone = blocked ? 'blocked' : 'free';
            showConnectors(lit.map(l => ({...l, tone: 'candidate', faint: true})));
            announceTarget(null);
            if (blocked) status({kind: 'blocked', target: blocked.target});
            else if (g.released) status({kind: 'released', target: g.released, delta});
            else {
                const on = surface.part && partsById().get(surface.part);
                status(on ? {kind: 'onTop', target: on.part, delta} : {kind: 'floor', delta});
            }
        }
        setCursor(preview.blocked ? 'not-allowed' : 'grabbing');
        emitHold();
    };
    /** R, [ ], T, X and Tab while a selection is dragged: turned in the hand, then aimed again where the pointer is. */
    const turnDrag = (how, direction) => {
        const g = gesture;
        if (!g || g.kind !== 'part' || !g.started || !g.last) return false;
        const c = preview && preview.candidate;
        const base = heldBase(g);
        // The turn the snap applied to the hand (base → seated), so a turn about the connection keeps the seat.
        const seat = c ? mul3(c.moves[0].rotation, transposeRotation(base[0].rotation)) : IDENTITY;
        const spinBy = R => { g.spin = cleanRotation(mul3(R, g.spin)); };
        if (how === 'cycle') g.cycle += direction;
        else if (how === 'flip') { g.flip = !g.flip; status({kind: 'flipped'}); }
        else if (how === 'fine') {
            if (!c) { status({kind: 'refused', reason: 'fineNeedsConnection'}); return true; }
            if (!c.round) { status({kind: 'refused', reason: quarterOnlyReason(c)}); return true; }
            spinBy(mul3(axisRotation(c.axis, direction * FINE), seat));
        } else if (how === 'tip') {
            spinBy(mul3(worldAxisRotation(facingAxis(camera.getWorldDirection(new Vector3())), direction * QUARTER), seat));
        } else if (c) {
            spinBy(mul3(axisRotation(c.axis, direction * QUARTER), seat));
        } else {
            spinBy(worldAxisRotation('y', direction * QUARTER));
        }
        dragPart(g.last, g);
        return true;
    };
    /** The selection box from where `g` was pressed to `event`. */
    const drawBox = (event, g, slop = CLICK_PX) => {
        const crect = container.getBoundingClientRect();
        const x0 = Math.min(g.x, event.clientX), y0 = Math.min(g.y, event.clientY);
        Object.assign(boxDiv.style, {display: travelled(event, g) > slop ? 'block' : 'none',
            left: `${x0 - crect.left}px`, top: `${y0 - crect.top}px`,
            width: `${Math.abs(event.clientX - g.x)}px`, height: `${Math.abs(event.clientY - g.y)}px`});
    };

    /** Shift+click, or a finger's long press: the part (and its group) joins or leaves the selection. */
    const toggleSelected = id => {
        const group = expandToGroups(editor.model, [id]);
        const on = selection.includes(id);
        setSelection(on ? selection.filter(x => !group.includes(x)) : [...selection, ...group]);
    };
    const boxSelect = (g, event) => {
        const rect = canvas.getBoundingClientRect();
        const rectangle = selectionRectangle(g.x - rect.left, g.y - rect.top, event.clientX - rect.left, event.clientY - rect.top);
        camera.updateMatrixWorld();
        modelGroup.updateMatrixWorld(true);
        const inside = [];
        for (const [id, mesh] of meshes) {
            if (!pickable(id)) continue;
            const box = new Box3().setFromObject(mesh), corners = [];
            for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
                corners.push(new Vector4(x, y, z, 1).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix));
            }
            if (projectedBoxIntersects(corners, rectangle, rect)) inside.push(id);
        }
        return inside;
    };

    const onUp = event => {
        const g = gesture;
        if (g && g.pointerId !== event.pointerId) return;
        gesture = null;
        controls.enabled = true;
        transform.enabled = !pickMode;
        boxDiv.style.display = 'none';
        if (!g) return;
        try { canvas.releasePointerCapture(event.pointerId); } catch { /* not captured */ }
        if (g.orbit) endOrbit();
        if (event.type === 'pointercancel') {
            preview = null; clearGhost(); placeMeshes(); showConnectors([]); setCursor(''); emitHold();
            return;
        }
        const click = travelled(event, g) <= CLICK_PX;
        if ((g.kind === 'right' || (g.kind === 'orbit' && g.button === 2)) && click) {
            if (tool) { setTool(null); status({kind: 'idle'}); }
            return;
        }
        if (g.kind === 'tool') {
            if (!click) return; // a drag orbited the camera
            updateGhost(event);
            place({keepTool: event.shiftKey});
        } else if (g.kind === 'connected') {
            if (g.glide) { commitPreview(); setCursor(''); return; }
            if (!click) return;
            const ids = connectedComponent(editor.model, catalogMap, [g.id]);
            setSelection(ids);
            status({kind: 'connectedSelected', count: selection.length});
        } else if (g.kind === 'part') {
            if (g.started) {
                commitPreview();
                showConnectors([]);
                setCursor('');
                announceTarget(null);
            } else {
                // A plain click on a part: just that part (and its group); on a lit free connector, that is the target too.
                setSelection([partUnder(event)?.object.name].filter(Boolean));
                status({kind: 'selected', count: selection.length});
                if (g.lit) setPinned(g.lit);
                else if (pinned) setPinned(null);
            }
            emitHold();
            updateGizmo();
        } else if (g.kind === 'box') {
            if (click) {
                if (g.hit) toggleSelected(g.hit);
                else if (!g.additive) { setSelection([]); if (pinned) setPinned(null); }
            } else {
                const inside = boxSelect(g, event);
                setSelection(g.additive ? [...new Set([...g.base, ...inside])] : inside);
            }
            status({kind: 'selected', count: selection.length});
        } else if (g.kind === 'pick' && click) {
            doPick(event);
        } else if (g.kind === 'empty' && click) {
            setSelection([]);
            if (pinned) setPinned(null);
            status({kind: editingGroup ? 'groupEdit' : 'idle', name: editingGroup ? groupById(editingGroup)?.name : undefined});
        }
    };

    // ---- fingers ----------------------------------------------------------------------
    // touch-gestures.js says what the fingers mean; here it is done with the same
    // functions the mouse uses. A part pressed by a finger is not selected at once:
    // a long press adds it to the selection instead (the finger's Shift+click), a
    // drag or a tap selects it then.
    const tracker = createTouchTracker();
    let touchGizmo = null; // the finger on a gizmo handle: three's TransformControls follows it, as a mouse
    let longPressTimer = null;
    const touchAt = event => ({id: event.pointerId, x: event.clientX, y: event.clientY, t: event.timeStamp});
    const at = (x, y) => ({clientX: x, clientY: y});
    const stopLongPress = () => {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    };
    /** A finger's part drag or box ends without a change (a second finger, or the browser took the finger). */
    const dropTouchGesture = () => {
        stopLongPress();
        boxDiv.style.display = 'none';
        if (gesture && gesture.kind === 'part' && gesture.started) {
            preview = null;
            clearGhost();
            placeMeshes();
            status({kind: 'idle'});
        }
    };
    function onTouchDown (event) {
        if (touchGizmo !== null || transform.dragging || (paletteDrag && paletteDrag.dragging)) {
            // Another finger while one turns a handle or carries a part from the palette: ignored.
            event.stopImmediatePropagation();
            return;
        }
        canvas.focus();
        if (!tracker.count && !tool && !pickMode && gizmoGrab(event)) {
            // To three's TransformControls, like a mouse press on the handle (its events go on to it).
            touchGizmo = event.pointerId;
            controls.enabled = false;
            gesture = null;
            return;
        }
        event.stopImmediatePropagation(); // OrbitControls and TransformControls never see this finger
        if (!tracker.count && cubeHit(event)) { clickViewCube(event); return; }
        const out = tracker.down(touchAt(event));
        if (!out) return;
        if (out.type === 'pinchStart') {
            dropTouchGesture();
            gesture = {kind: 'pinch', touch: true};
            return;
        }
        modifiers = {alt: false, shift: false};
        const base = {x: event.clientX, y: event.clientY, pointerId: event.pointerId, touch: true};
        const hit = tool || pickMode ? null : partUnder(event);
        if (tool) gesture = {...base, kind: 'tool'};
        else if (pickMode) gesture = {...base, kind: 'pick'};
        else if (hit) gesture = {...base, kind: 'part', id: hit.object.name, grab: hit.point.clone(), started: false};
        else gesture = {...base, kind: 'empty', orbit: orbitStart(event)};
        stopLongPress();
        const due = event.timeStamp + LONG_PRESS_MS;
        longPressTimer = setTimeout(() => onTouch(tracker.tick(Math.max(due, performance.now()))), LONG_PRESS_MS);
    }
    function onTouchEvent (event) {
        if (event.pointerType !== 'touch') return;
        if (event.pointerId === touchGizmo) {
            if (event.type === 'pointermove') return;
            touchGizmo = null;
            if (event.type === 'pointercancel') {
                // The browser took the finger: the handle lets go and nothing changes (TransformControls has no cancel).
                preview = null;
                clearGhost();
                transform.pointerUp({x: 0, y: 0, button: 0});
                placeMeshes();
            }
            return;
        }
        event.stopImmediatePropagation();
        const p = touchAt(event);
        onTouch(event.type === 'pointermove' ? tracker.move(p) : tracker.up(p, {cancelled: event.type === 'pointercancel'}),
            at(event.clientX, event.clientY));
    }
    /** Acts on what the fingers did (touch-gestures.js); `where` is the finger's position for a move or a lift. */
    function onTouch (out, where) {
        const g = gesture;
        if (!out) return;
        if (out.type === 'longPress') {
            stopLongPress();
            if (g && g.kind === 'part') {
                toggleSelected(g.id);
                status({kind: 'selected', count: selection.length});
                gesture = {...g, kind: 'held'};
            } else if (g && g.kind === 'empty') {
                gesture = {...g, kind: 'box'};
                status({kind: 'boxing'});
            }
        } else if (out.type === 'dragStart' || out.type === 'drag') {
            stopLongPress();
            if (!g) return;
            if (g.kind === 'part') {
                if (!g.started) {
                    if (!selection.includes(g.id)) setSelection([g.id]);
                    modelGroup.updateMatrixWorld(true);
                    g.start = selectedParts();
                    g.bottom = modelBox(selection).min.y;
                    startDrag(g);
                }
                dragPart({...at(out.x, out.y), touch: true}, g);
            } else if (g.kind === 'tool') {
                // A finger carrying the part: the ghost a little above it, so the finger does not hide it.
                g.dragged = true;
                updateGhost({clientX: out.x, clientY: out.y - TOUCH_LIFT_PX, touch: true});
            } else if (g.kind === 'empty' || g.kind === 'pick') {
                orbitBy(out.dx, out.dy, g.orbit ? g.orbit.pivot : controls.target);
            }
        } else if (out.type === 'heldDrag') {
            if (g && g.kind === 'box') drawBox(at(out.x, out.y), g, TOUCH_SLOP_PX);
        } else if (out.type === 'pinch') {
            pinchBy(out.scale, out.pan);
        } else if (out.type === 'end') {
            if (out.cancelled) {
                dropTouchGesture();
                gesture = null;
                return;
            }
            stopLongPress();
            gesture = null;
            boxDiv.style.display = 'none';
            if (!g || g.kind === 'pinch') return;
            const still = out.was === 'tap' || out.was === 'longPress' || out.was === 'held';
            if (g.kind === 'tool') {
                // A tap places where it tapped; a lifted finger places what it carried (Snapped, or free and not in the way).
                if (still) {
                    updateGhost({...where, touch: true});
                    place();
                } else if (g.dragged) {
                    place();
                }
            } else if (g.kind === 'part') {
                if (g.started) {
                    commitPreview();
                } else if (out.was === 'longPress') {
                    toggleSelected(g.id);
                    status({kind: 'selected', count: selection.length});
                } else if (out.was === 'tap') {
                    setSelection([g.id]);
                    status({kind: 'selected', count: selection.length});
                }
                updateGizmo();
            } else if (g.kind === 'box') {
                if (out.was === 'heldDrag') setSelection([...new Set([...selection, ...boxSelect(g, where)])]);
                status({kind: 'selected', count: selection.length});
            } else if (g.kind === 'pick' && out.was === 'tap') {
                doPick(where);
            } else if (g.kind === 'empty' && out.was === 'tap') {
                setSelection([]);
                status({kind: 'idle'});
            }
        }
    }
    /** Two fingers: closer to the target as they spread, and the scene follows their midpoint. */
    const pinchBy = (scale, [dx, dy]) => {
        const offset = camera.position.clone().sub(controls.target);
        const distance = pinchDistance(offset.length(), scale, {min: Math.max(0.01, controls.minDistance), max: controls.maxDistance});
        camera.position.copy(controls.target).add(offset.setLength(distance));
        camera.updateMatrix();
        const [right, up] = panAmounts(dx, dy, distance, camera.fov, canvas.clientHeight);
        const shift = new Vector3().setFromMatrixColumn(camera.matrix, 0).multiplyScalar(right)
            .add(new Vector3().setFromMatrixColumn(camera.matrix, 1).multiplyScalar(up));
        camera.position.add(shift);
        controls.target.add(shift);
        controls.update();
        cameraTouched = true;
    };
    const onContextMenu = event => {
        // A long press is a selection gesture here, not the browser's menu.
        if (lastTouch) event.preventDefault();
    };

    /** Esc (or its button): a drag in progress is called off, else the placing tool ends, else the selection is cleared. */
    const escape = () => {
        if (gesture && gesture.kind === 'box') {
            onUp({pointerId: gesture.pointerId, type: 'pointercancel'});
            stopLongPress(); tracker.reset();
            return;
        }
        if (gesture && gesture.kind === 'part') {
            preview = null; gesture = null; clearGhost(); placeMeshes(); showConnectors([]); setCursor(''); emitHold();
            return;
        }
        if (pickMode) setPick(null);
        else if (tool) setTool(null);
        else if (pinned) { setPinned(null); status({kind: 'targetCleared'}); }
        else if (editingGroup) leaveGroup();
        else { setSelection([]); status({kind: 'idle'}); }
    };

    const onKey = event => {
        readModifiers(event);
        const ctrl = event.ctrlKey || event.metaKey;
        const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
        if (key === 'Escape') {
            escape();
            return;
        }
        if (ctrl) {
            // Copy and paste let the browser's own copy/paste event follow (the system clipboard).
            if (key === 'c') { copyText = copy(); return; }
            if (key === 'v') {
                clearTimeout(pendingPaste);
                pendingPaste = setTimeout(() => { pendingPaste = null; pasteText(null); }, 80);
                return;
            }
            const actions = {z: () => (event.shiftKey ? redo() : undo()), y: redo, d: duplicate,
                g: () => (event.shiftKey ? ungroupSelection() : groupSelection()),
                a: () => { setSelection(editor.model.parts.map(p => p.id)); status({kind: 'selected', count: selection.length}); }};
            if (actions[key]) { event.preventDefault(); actions[key](); }
            return;
        }
        // [ ] turn 15° (German keyboards type them with Alt/AltGr, so before the Alt check).
        if (key === '[' || key === ']') { event.preventDefault(); fineTurn(key === ']' ? 1 : -1); return; }
        // In hand: Tab tries the next way to put it here, Enter or Space places it, the arrows nudge it.
        if (tool || dragging()) {
            if (key === 'Tab') {
                event.preventDefault();
                if (tool) cycleHeld(event.shiftKey ? -1 : 1);
                else turnDrag('cycle', event.shiftKey ? -1 : 1);
                return;
            }
            if (tool && (key === 'Enter' || key === ' ')) { event.preventDefault(); place({keepTool: event.shiftKey}); return; }
            if (tool && key.startsWith('Arrow')) { event.preventDefault(); nudgeHeld(key); return; }
        }
        if (event.altKey) return;
        // With nothing selected (and no tool armed) the arrows, + and - move the camera (camera-nav.js).
        if (!selection.length && !tool && !pickMode) {
            const camAction = cameraKeyAction(event);
            if (camAction) {
                event.preventDefault();
                if (applyCameraAction(camera, controls, camAction, canvas.clientHeight)) cameraTouched = true;
                return;
            }
        }
        const plain = {
            w: () => setMode('move'), e: () => setMode('rotate'),
            r: () => turnSelection('up', event.shiftKey ? -1 : 1),
            x: flipSelection,
            t: () => turnSelection('facing', event.shiftKey ? -1 : 1),
            f: fitSelection,
            h: () => (event.shiftKey ? showAll() : hideSelection()),
            i: isolate,
            k: () => setPick('color'),
            n: () => nextHinge(event.shiftKey ? -1 : 1),
            m: () => setPick('measure'),
            '?': onShortcuts,
            Delete: deleteSelection, Backspace: deleteSelection
        };
        if (plain[key]) { event.preventDefault(); plain[key](); }
    };
    const onKeyUp = event => readModifiers(event);
    const cancelPointer = () => { if (gesture && !gesture.touch) onUp({pointerId: gesture.pointerId, type: 'pointercancel'}); };
    const lostCapture = event => { if (gesture?.kind === 'box' && gesture.pointerId === event.pointerId) cancelPointer(); };
    canvas.addEventListener('lostpointercapture', lostCapture);
    window.addEventListener('blur', cancelPointer);
    const onLeave = () => {
        if (hovered && !gesture) { hovered = null; drawOutlines(); }
        if (idleLit && !gesture && !tool) { idleLit = null; showConnectors([]); }
        if (!gesture && !tool) setCursor('');
    };

    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('contextmenu', onContextMenu);
    canvas.addEventListener('keydown', onKey);
    canvas.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('dblclick', onDblClick);
    document.addEventListener('copy', onCopyEvent);
    document.addEventListener('paste', onPasteEvent);
    const unsubscribe = editor.subscribe(() => rebuild());

    // ---- the view cube (docs/ROBOT-LAB-UX.md §3.7): a face, an edge or a corner turns the view there --------
    const CUBE_PX = 84;
    const CUBE_MARGIN = 10;
    const cubeScene = new Scene();
    const cubeCamera = new PerspectiveCamera(30, 1, 0.1, 10);
    const cubeLabels = {right: 'Right', left: 'Left', top: 'Top', bottom: 'Bottom', front: 'Front', back: 'Back', ...(viewCubeLabels || {})};
    const cubeFace = text => {
        const c = document.createElement('canvas');
        c.width = 128;
        c.height = 128;
        const g = c.getContext('2d');
        if (g) {
            g.fillStyle = '#f8fafc';
            g.fillRect(0, 0, 128, 128);
            g.strokeStyle = '#94a3b8';
            g.lineWidth = 6;
            g.strokeRect(3, 3, 122, 122);
            g.fillStyle = '#1e293b';
            g.font = `700 ${text.length > 7 ? 24 : 30}px system-ui, sans-serif`;
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.fillText(text, 64, 66);
        }
        return new CanvasTexture(c);
    };
    // BoxGeometry's faces: +x, -x, +y, -y, +z, -z (world: +z is the Front view's side, +x the Side view's).
    const cubeMaterials = [cubeLabels.right, cubeLabels.left, cubeLabels.top, cubeLabels.bottom, cubeLabels.front, cubeLabels.back]
        .map(text => new MeshBasicMaterial({map: cubeFace(text)}));
    const cubeGeometry = new BoxGeometry(1, 1, 1);
    const cube = new Mesh(cubeGeometry, cubeMaterials);
    const cubeEdges = new LineSegments(new EdgesGeometry(cubeGeometry), new LineBasicMaterial({color: 0x64748b}));
    cubeScene.add(cube, cubeEdges);
    /** The cube's square in canvas pixels: the view's bottom-right corner. */
    const cubeRect = () => ({left: canvas.clientWidth - CUBE_PX - CUBE_MARGIN, top: canvas.clientHeight - CUBE_PX - CUBE_MARGIN, size: CUBE_PX});
    const aimCubeCamera = () => {
        const dir = camera.position.clone().sub(controls.target).normalize();
        cubeCamera.position.copy(dir.multiplyScalar(3.4));
        cubeCamera.up.copy(camera.up);
        cubeCamera.lookAt(0, 0, 0);
        cubeCamera.updateMatrixWorld();
    };
    const cubeRay = new Raycaster();
    /** The point (cube coordinates) the pointer is on, or null off the cube. */
    function cubeHit (event) {
        if (!canvas.clientWidth || canvas.clientWidth < 4 * CUBE_PX) return null;
        const [x, y] = canvasPx(event);
        const r = cubeRect();
        if (x < r.left || y < r.top || x > r.left + r.size || y > r.top + r.size) return null;
        aimCubeCamera();
        cubeRay.setFromCamera(new Vector2((x - r.left) / r.size * 2 - 1, -((y - r.top) / r.size) * 2 + 1), cubeCamera);
        const h = cubeRay.intersectObject(cube, false)[0];
        return h ? h.point.toArray() : null;
    }
    function clickViewCube (event) {
        const p = cubeHit(event);
        if (!p) return;
        const dir = new Vector3(...viewCubeDirection(p)).normalize();
        const distance = camera.position.distanceTo(controls.target);
        moveCamera({position: controls.target.clone().addScaledVector(dir, distance).toArray(), target: controls.target.toArray()});
        cameraTouched = true;
    }
    const drawViewCube = () => {
        const r = cubeRect();
        if (r.left < 0 || r.top < 0 || canvas.clientWidth < 4 * CUBE_PX) return;
        aimCubeCamera();
        const bottom = canvas.clientHeight - r.top - r.size;
        renderer.setScissorTest(true);
        renderer.setScissor(r.left, bottom, r.size, r.size);
        renderer.setViewport(r.left, bottom, r.size, r.size);
        renderer.autoClear = false;
        renderer.clearDepth();
        renderer.render(cubeScene, cubeCamera);
        renderer.autoClear = true;
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, canvas.clientWidth, canvas.clientHeight);
    };

    // ---- frame loop hooks -----------------------------------------------------------
    const drawSize = new Vector2();
    const resize = () => {
        const width = Math.max(1, container.clientWidth || 0);
        const height = Math.max(1, container.clientHeight || Math.round(width * 0.6));
        // Only on a change: setting the pixel ratio (or the size) resets the canvas — its drawing
        // buffer is reallocated and cleared — which every frame was a GPU stall and a forced redraw.
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        if (renderer.getPixelRatio() !== ratio) {
            renderer.setPixelRatio(ratio);
            invalidate();
        }
        const size = renderer.getSize(drawSize);
        if (size.x !== width || size.y !== height) {
            invalidate();
            renderer.setSize(width, height, false);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            // Until the learner moves the camera, keep the whole model in view as the pane settles.
            if (!cameraTouched) frameModel();
        }
    };
    const drawnCamera = new Matrix4();
    const drawnProjection = new Matrix4();
    // One frame in flight. A pointer move that changes a highlight or drags the gizmo asks for a
    // frame; on a software GPU (SwiftShader) a 2,054-part frame takes seconds to draw, and the
    // browser does not hold the animation loop back, so every move queued another whole frame: 23
    // for one hover, click and drag, up to minutes of GPU work that the next screenshot, readback or
    // pick waited behind. A fence after each frame says when the GPU is done with it; until then the
    // view stays dirty and draws the latest state once the GPU is free. (Two in flight let the
    // renderer stall in the browser's own queue instead: a 12-move drag took 15 s, not 0.3 s.)
    const MAX_FRAMES_IN_FLIGHT = 1;
    const gl = renderer.getContext();
    const canFence = typeof gl.fenceSync === 'function';
    const inFlight = [];
    const dropFences = () => {
        if (!gl.isContextLost()) for (const f of inFlight) gl.deleteSync(f);
        inFlight.length = 0;
    };
    /** Frees the finished frames' fences; true while MAX_FRAMES_IN_FLIGHT are still pending. */
    const gpuBusy = () => {
        if (gl.isContextLost()) { inFlight.length = 0; return false; }
        while (inFlight.length && gl.getSyncParameter(inFlight[0], gl.SYNC_STATUS) === gl.SIGNALED) gl.deleteSync(inFlight.shift());
        return inFlight.length >= MAX_FRAMES_IN_FLIGHT;
    };
    /**
     * Draws a frame when anything in it changed since the last one (`invalidate`: the model, a
     * highlight, a ghost, the gizmo, the controls; or the camera, compared here), or when `force`d.
     * @returns {boolean} whether it drew
     */
    const render = ({force = false} = {}) => {
        resize();
        stepCamera();
        fitGizmo();
        camera.updateMatrixWorld();
        if (!force && !dirty && camera.matrixWorld.equals(drawnCamera) && camera.projectionMatrix.equals(drawnProjection)) return false;
        if (!force && gpuBusy()) {
            dirty = true; // drawn once the GPU has finished the frame before
            return false;
        }
        dirty = false;
        drawnCamera.copy(camera.matrixWorld);
        drawnProjection.copy(camera.projectionMatrix);
        s.updateMatrixWorld();
        const size = renderer.getSize(drawSize);
        insight.update(camera, size.x, size.y);
        placeMeasureLabel();
        renderer.render(s, camera);
        drawViewCube();
        if (canFence && !gl.isContextLost()) {
            // a forced frame while one is in flight: the newest fence covers the ones before it
            while (inFlight.length >= MAX_FRAMES_IN_FLIGHT) gl.deleteSync(inFlight.shift());
            inFlight.push(gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0));
        }
        return true;
    };
    const dispose = () => {
        disposed = true;
        cancelPointer();
        window.removeEventListener('blur', cancelPointer);
        canvas.removeEventListener('lostpointercapture', lostCapture);
        unsubscribe();
        dropFences();
        if (paletteDrag) detachPaletteDrag();
        insight.dispose();
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('pointercancel', onUp);
        canvas.removeEventListener('pointerleave', onLeave);
        canvas.removeEventListener('contextmenu', onContextMenu);
        canvas.removeEventListener('keydown', onKey);
        stopLongPress();
        tracker.reset();
        canvas.removeEventListener('keyup', onKeyUp);
        canvas.removeEventListener('dblclick', onDblClick);
        document.removeEventListener('copy', onCopyEvent);
        document.removeEventListener('paste', onPasteEvent);
        clearTimeout(pendingPaste);
        measure = null;
        drawMeasure();
        measureLine.dispose();
        measureDot.dispose();
        drawHinge(null);
        hingeLine.dispose();
        beltLayer.dispose();
        ropeLayer.dispose();
        hoseLayer.dispose();
        measureDiv.remove();
        clearGhost();
        for (const mesh of meshes.values()) for (const m of [].concat(mesh.material)) m.dispose();
        if (instanced) instanced.dispose();
        for (const pair of materials.values()) for (const m of pair) m.dispose();
        for (const set of lineMaterials.values()) for (const m of [...set.edges, ...set.conditional]) m.dispose();
        for (const g of edges.values()) g.dispose();
        selectedLine.dispose();
        selectedHidden.dispose();
        hoverLine.dispose();
        blockedLine.dispose();
        markerGeometry.dispose();
        for (const m of hlMaterials.values()) m.dispose();
        for (const pair of ghostMaterials.values()) for (const m of pair) m.dispose();
        for (const g of [ringGeometry, pinnedRingGeometry, barGeometry, ballGeometry, cubeGeometry]) g.dispose();
        for (const m of cubeMaterials) { if (m.map) m.map.dispose(); m.dispose(); }
        cubeEdges.geometry.dispose();
        cubeEdges.material.dispose();
        pivotDot.geometry.dispose();
        pivotDot.material.dispose();
        markerMaterials.fixed.dispose();
        markerMaterials.moving.dispose();
        grid.geometry.dispose();
        grid.material.dispose();
        transform.detach();
        transform.dispose();
        controls.dispose();
        renderer.dispose();
        // Give the context back now, not at garbage collection: a big model's buffers live in it, and
        // on a software GPU the next view's context is slow to make while the old one still holds them.
        renderer.forceContextLoss();
        boxDiv.remove();
        canvas.remove();
    };

    rebuild();
    resize();
    frameModel();
    status({kind: 'idle'});
    return {
        canvas, render, resize, dispose, setTool, frameModel, pressPalettePart,
        /** A frame waits to be drawn, or the GPU has not finished the frames drawn (render's fences). */
        get drawing () { gpuBusy(); return dirty || inFlight.length > 0; },
        /** Target-first: whether a palette part could go into the pinned target, and placing it there. */
        fitsTarget, placeIntoTarget,
        get pinnedTarget () { return pinned ? {partId: pinned.partId, connectorId: pinned.connectorId, part: pinned.part} : null; },
        clearTarget: () => setPinned(null),
        /** In hand: place it (the touch ✓), turn it (⟳), the next way (Tab). */
        placeHeld: () => place(), cycleHeld, fineTurn, flip: flipSelection, selectConnected, chainRoundSelection,
        /** Rubber bands: one round the selection, or off the selection. */
        beltRoundSelection, removeBeltsOfSelection,
        /** Ropes: one from the first selected part (the drum) to the last (the hook); untied. */
        ropeSelection, removeRopesOfSelection, hoseSelection, removeHosesOfSelection,
        /** The hinge tool: the next hinge (N), and a turn of the selection on it (±15° is [ ]). */
        nextHinge, turnOnHinge,
        /** How a scroll is read: 'auto' (wheel or trackpad, guessed), 'mouse' (zoom), 'trackpad' (orbit). */
        setWheelMode (next) { if (['auto', 'mouse', 'trackpad'].includes(next)) wheelMode = next; },
        /** The mouse preset (camera-nav.js MOUSE_PRESETS): 'brickwright' (right drag pans) or 'studio' (right drag orbits). */
        setMousePreset (next) {
            if (!MOUSE_PRESETS[next]) return;
            mousePreset = next;
            configureOrbitControls(controls, MOUSE, next);
        },
        get mousePreset () { return mousePreset; },
        get wheelMode () { return wheelMode; },
        /** For the browser gate (docs/ROBOT-LAB-UX.md §5): what is lit, the candidate pose, the ghost's tone, the view cube. */
        debug: {
            highlights: () => litList.map(h => ({partId: h.partId, connectorId: h.connectorId, active: h.active})),
            candidate: () => {
                const c = tool ? candidate : preview && preview.candidate;
                if (!c) return null;
                const blocked = tool ? Boolean(c.blocked) : Boolean(preview.blocked);
                return {pose: {position: c.position.slice(), rotation: c.rotation.slice()}, moves: (c.moves || []).map(m => ({id: m.id, position: m.position.slice(), rotation: m.rotation.slice()})),
                    pairs: c.pairs.map(p => ({...p, fixed: {...p.fixed}})), blocked, target: c.target ? {...c.target} : null, lead: c.lead ? {...c.lead} : null, round: Boolean(c.round)};
            },
            ghostTone: () => ghostTone,
            viewCube: () => {
                const rect = canvas.getBoundingClientRect();
                const r = cubeRect();
                return {left: rect.left + r.left, top: rect.top + r.top, size: r.size};
            },
            animating: () => Boolean(camAnim),
            /** The last Ctrl-glide step: where along the line it started and is, the delta kept, whether it was out. */
            glide: () => lastGlide,
            /** How many rubber bands are drawn. */
            bands: () => beltLayer.count,
            /** How many ropes are drawn. */
            ropes: () => ropeLayer.count,
            hoses: () => hoseLayer.count,
            /** The hinge [ ] would turn on now (null: none, or not asked for yet): its line, what moves, what stays. */
            hinge: () => {
                const c = hinge.key === selection.join(',') && hinge.list[hinge.index];
                return c ? {axis: c.axis.slice(), point: c.point.slice(), moving: c.moving.slice(), fixed: c.fixed.slice(), index: hinge.index, of: hinge.list.length,
                    shown: hingeGroup.children.length > 0} : null;
            }
        },
        /** Whether a part from the palette is being dragged right now. */
        get draggingFromPalette () { return Boolean(paletteDrag && paletteDrag.dragging); },
        get selected () { return selection[0] || null; },
        get selection () { return selection.slice(); },
        get mode () { return mode; },
        get grid () { return gridStep; },
        /** The camera now (for the browser gate to read what a gesture did): position, target, distance (metres). */
        get camera () {
            return {position: camera.position.toArray(), target: controls.target.toArray(), distance: camera.position.distanceTo(controls.target)};
        },
        /** The gizmo handle under the pointer ('X', 'Y', 'XY', …) or null: what a press would grab. */
        get gizmoAxis () { return transform.object ? gizmoHover : null; },
        /** While a move is previewed: the part it would push into (shown red), else null. */
        get blockedInto () { return preview && preview.blocked ? preview.blocked.into : null; },
        setGrid (step) { if (GRID_STEPS.includes(step)) gridStep = step; },
        setMode,
        select: ids => setSelection([].concat(ids || [])),
        selectAll: () => { setSelection(editor.model.parts.map(p => p.id)); status({kind: 'selected', count: selection.length}); },
        deleteSelection, duplicate, copy, paste, pasteText, undo, redo, view, fitSelection, groupSelection, ungroupSelection, escape,
        /** A camera key (view/camera-nav.js), as on the focused view; true when the camera moved. */
        nudge: event => { const moved = applyCameraAction(camera, controls, cameraKeyAction(event), canvas.clientHeight); if (moved) cameraTouched = true; return moved; },
        setMotion, setOverlay,
        hideSelection, isolate, showAll, setHidden, mirror: mirrorSelection, align: alignSelection, distribute: distributeSelection,
        toGrid: selectionToGrid, paint: paintSelection, setPick, enterGroup, leaveGroup, setPartPose, moveSelectionBy, turnSelectionBy,
        /** The colour new parts are placed in (the colour picker's current colour). */
        setPlaceColor (color) { if (Number.isInteger(color) && color >= 0) placeColor = color; },
        get placeColor () { return placeColor; },
        get hidden () { return [...hidden]; },
        get pick () { return pickMode; },
        get editingGroup () { return editingGroup; },
        /** The last measurement: {a, b, delta, ldu, studs, mm} (LDU points) or null. */
        get measurement () { return measure && measure.result ? {...measure.result, a: measure.a, b: measure.b} : null; },
        /** What the overlay shows now (for the browser gate). */
        overlayStats: () => ({...insight.stats(),
            tinted: [...meshes.values()].filter(m => [].concat(m.material).some(x => x.userData.baseColor && !x.color.equals(x.userData.baseColor))).length}),
        turn: (axis, direction = 1) => turnSelection(axis, direction),
        /** World position (metres) of a point on a part (LDU, part frame) or of the gizmo, for the browser gate to aim at. */
        debugPoint: (id, local = [0, 0, 0]) => {
            if (id === 'gizmo') return transform.object ? pivotObject.position.toArray() : null;
            const p = partsById().get(id);
            return p ? lduToWorld(mulVec3(p.rotation, local).map((v, i) => v + p.position[i])) : null;
        },
        /** The floor point (LDU) under a client pixel, or null (for the browser gate to read where a drop aimed). */
        floorPointAt: (clientX, clientY) => {
            const ray = pick({clientX, clientY});
            const p = ray.ray.intersectPlane(floor, new Vector3());
            return p ? worldToLdu(p).map(tidy) : null;
        },
        /** Projects a world point to client pixels (for the browser gate). */
        toScreen: worldPoint => {
            const rect = canvas.getBoundingClientRect();
            camera.updateMatrixWorld();
            const v = new Vector3(...worldPoint).project(camera);
            return [rect.left + (v.x + 1) / 2 * rect.width, rect.top + (1 - v.y) / 2 * rect.height];
        },
        // For the browser gate: place a part as a click at a world point would.
        placeAt (part, worldPoint, turns = 0) {
            setTool(part);
            tool.turns = turns;
            const p = new Vector3(...worldPoint);
            const found = snapCandidates({model: editor.model, catalog: catalogMap, part, pose: {position: worldToLdu(p), rotation: IDENTITY}});
            candidate = found.length ? {...rotateAboutSnap(found[0], turns)} : null;
            if (candidate) candidate.rotation = cleanRotation(candidate.rotation);
            setFreePose(candidate ? null : restingPose(part, new Vector3(p.x, floorY, p.z), turns));
            const done = place();
            return {snapped: Boolean(done && done.snapped)};
        }
    };
};
