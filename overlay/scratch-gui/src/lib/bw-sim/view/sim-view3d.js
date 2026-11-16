// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// The Sim Lab's 3D view: a WebGL renderer, an orbit camera and the scene graph
// from sim-scene3d.js, moved by the physics snapshot. Built like the arena's
// view (lib/spike-arena/arena-view3d.js) and reached the same way, only through
// the pane's dynamic import of bw-sim/sim-lab.js (chunk "bw-sim-lab").

import {Box3, BufferGeometry, Color, Float32BufferAttribute, GridHelper, LineBasicMaterial, LineSegments, MOUSE, Mesh, MeshBasicMaterial,
    PerspectiveCamera, Raycaster, Sphere, SphereGeometry, Vector2, Vector3, WebGLRenderer} from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createMeasurementPicker} from '../measurements/picking.js';
import {parseLDConfig} from './ldraw-colors.js';
import {LDU_M, dirToWorld, lduToWorld} from '../contracts.js';
import {buildSimScene, applySnapshot, movingMassCentre} from './sim-scene3d.js';
import {createChainMotion} from './chain-motion.js';
import {createSimBelts} from './belt-layer.js';
import {createPenLayer} from './pen-layer.js';
import {sampleDrawingSnapshot} from './drawing-sampler.js';
import {createSimRopes} from './rope-layer.js';
import {createSimHoses} from './hose-layer.js';
import {addPartLights} from './part-style.js';
import {createInsightLayer, createPulse, tintMaterial} from './insight-layer.js';
import {createCableAnchors} from './cable-anchors.js';
import {VIEW_DIRECTIONS, applyCameraAction, cameraKeyAction, configureOrbitControls, framePosition} from './camera-nav.js';
import {modelMeshBounds, cameraFollowBody} from './model-bounds.js';
import {createDrawingPreview} from './drawing-preview.js';
import {createMeasurementOverlay} from '../measurements/overlay.js';
import {createGpuFrameQueue} from './gpu-frame-queue.js';

export class WebGLUnavailableError extends Error {
    constructor (reason) {
        super(`WebGL is not available: ${reason}`);
        this.name = 'WebGLUnavailableError';
        this.code = 'no-webgl';
    }
}

let webgl2Seen = false;
/**
 * WebGL 2 or nothing (three.js dropped WebGL 1 in r163). window.__bwSimLabForceNoWebGL forces the fallback.
 * The probe's context is released at once, and a yes is remembered for the page: every probe used to leave
 * a live context behind until garbage collection, and on a software GPU each new context is slow to make.
 */
export const webglAvailable = () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;
    if (window.__bwSimLabForceNoWebGL) return false;
    if (webgl2Seen) return true;
    try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return false;
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        webgl2Seen = true;
        return true;
    } catch {
        return false;
    }
};

/** Camera framing: look at the model's centre from the front-right, above, at a distance that fits it. */
export const frameModel = (box, aspect, fovDeg = 40) => {
    const centre = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());
    const radius = Math.max(0.05, size.length() / 2);
    const distance = radius / Math.sin((fovDeg * Math.PI / 180) / 2) * (aspect < 1 ? 1.4 : 1.1);
    const direction = new Vector3(1, 0.8, 1.2).normalize();
    return {position: centre.clone().add(direction.multiplyScalar(distance)), target: centre};
};

/**
 * @param {object} options
 * @param {HTMLElement} options.container
 * @param {object} options.model the PlacedModel
 * @param {object} options.mechanism its CompiledMechanism
 * @param {(path: string) => string|undefined} options.read LDraw files (fetchLDrawClosure with withConfig)
 * @param {Map<string, object>} [options.catalog] the part catalog; with it a motor's drive hub turns with its output
 * @param {function} [options.onContextLost]
 * @returns {{canvas, render(snapshot), resize(), resetCamera(), dispose()}}
 */
export const createSimView3D = ({container, model, mechanism, read, catalog = null, onContextLost = null, drawingLabel = 'Drawing'}) => {
    if (!webglAvailable()) throw new WebGLUnavailableError('this browser gives a canvas no WebGL 2 context');
    const config = read('ldconfig.ldr');
    if (!config) throw new Error('LDConfig.ldr (the LDraw colour table) is missing');
    let renderer;
    try {
        renderer = new WebGLRenderer({antialias: true});
    } catch (error) {
        throw new WebGLUnavailableError(error.message);
    }
    const canvas = renderer.domElement;
    canvas.dataset.testid = 'bw-sim-lab-3d-canvas';
    canvas.setAttribute('role', 'img');
    // touch-action none: one finger orbits, two pinch and pan (OrbitControls), the page does not scroll or zoom instead.
    Object.assign(canvas.style, {width: '100%', height: '100%', display: 'block', borderRadius: '6px', touchAction: 'none',
        userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none'});
    container.appendChild(canvas);
    const measurementOverlay = createMeasurementOverlay({container});
    let measurementRows = null;

    const ldColors = parseLDConfig(config);
    const built = buildSimScene({model, mechanism, read, colors: ldColors, catalog});
    // Chain links run round with their sprocket (drawing only: the core welds them to the frame).
    const chainMotion = createChainMotion({model, mechanism, catalog, built});
    // Rubber bands laid round their parts where the bodies are (drawing; kinds/belt.js simulates them).
    const simBelts = createSimBelts({model, mechanism, catalog, built});
    // Pens draw on the floor (model parts marked `pen`; view/pen-layer.js).
    const pens = createPenLayer({model, mechanism, built, colors: ldColors});
    const drawingPreview = pens && model.parts.some(p => p.pen) ?
        createDrawingPreview({container, pens, label: drawingLabel}) : null;
    // Ropes from their bodies' points (view/rope-layer.js).
    const simRopes = createSimRopes({mechanism, built});
    // Pneumatic hoses between their parts' nozzles, following the bodies (view/hose-layer.js).
    const simHoses = createSimHoses({model, mechanism, catalog, built});
    // The scene builder owns the model; the view adds light only when the builder brought none.
    if (!built.scene.children.some(c => c.isLight)) addPartLights(built.scene);
    // A light sky and a 1 cm grid on the floor (10 cm major lines): without them a
    // driving robot on a plain floor shows no motion at all.
    built.scene.background = new Color(0xe8eef5);
    let grid = null;
    if (built.ground) {
        const floorY = new Box3().setFromObject(built.ground).max.y;
        grid = new GridHelper(4, 40, 0x64748b, 0xcbd5e1);
        // and 10 cm lines over the rest of the floor (mech/compile.js FLOOR_HALF_M), so driving far still shows motion
        const far = new GridHelper(20, 200, 0x94a3b8, 0xdde3ea);
        far.renderOrder = 1;
        grid.renderOrder = 2; // near lines cover coincident far lines consistently
        grid.add(far);
        grid.position.y = floorY; // the floor faces have depth bias; lines stay below thin parts
        built.scene.add(grid);
    }
    const camera = new PerspectiveCamera(40, 1, 0.005, 50);
    const controls = new OrbitControls(camera, canvas);
    // camera-nav.js: left or middle drag orbits, right (or Shift+left) drag pans, the wheel zooms toward the pointer.
    configureOrbitControls(controls, MOUSE);
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // never under the floor
    controls.minDistance = 0.05;
    controls.maxDistance = 5;
    // The view takes the keyboard when clicked: arrows orbit, Shift+arrows pan, + and - zoom.
    canvas.tabIndex = 0;
    canvas.style.outline = 'none';
    const onKey = event => {
        if (applyCameraAction(camera, controls, cameraKeyAction(event), canvas.clientHeight)) {
            event.preventDefault();
            event.stopPropagation();
        }
    };
    canvas.addEventListener('keydown', onKey);
    const focusCanvas = () => canvas.focus({preventScroll: true});
    canvas.addEventListener('pointerdown', focusCanvas);

    const modelBox = () => modelMeshBounds(built);
    const resetCamera = () => {
        const size = renderer.getSize(new Vector2());
        const {position, target} = frameModel(modelBox(), size.x / Math.max(1, size.y));
        camera.position.copy(position);
        controls.target.copy(target);
        controls.update();
    };

    /** Home, Top, Front or Side: the whole model, seen from that side. */
    const viewFrom = name => {
        const box = modelBox();
        const sphere = box.isEmpty() ? new Sphere(new Vector3(), 0.1) : box.getBoundingSphere(new Sphere());
        const size = renderer.getSize(new Vector2());
        const {position} = framePosition({centre: sphere.center.toArray(), radius: sphere.radius,
            direction: VIEW_DIRECTIONS[name] || VIEW_DIRECTIONS.home, fovDeg: camera.fov, aspect: size.x / Math.max(1, size.y)});
        camera.position.set(...position);
        controls.target.copy(sphere.center);
        controls.update();
        followed = null;
    };
    /** Fit: the whole model in view, from where the camera looks now. */
    const fit = () => {
        const dir = camera.position.clone().sub(controls.target).toArray();
        const box = modelBox();
        if (box.isEmpty()) return;
        const sphere = box.getBoundingSphere(new Sphere());
        const size = renderer.getSize(new Vector2());
        const {position} = framePosition({centre: sphere.center.toArray(), radius: sphere.radius, direction: dir,
            fovDeg: camera.fov, aspect: size.x / Math.max(1, size.y)});
        camera.position.set(...position);
        controls.target.copy(sphere.center);
        controls.update();
        followed = null;
    };

    const onLost = event => {
        event.preventDefault();
        if (onContextLost) onContextLost();
    };
    canvas.addEventListener('webglcontextlost', onLost);

    const resize = ({defer = true} = {}) => {
        const width = Math.max(1, container.clientWidth || 0);
        const height = Math.max(1, container.clientHeight || Math.round(width * 0.6));
        // Only when it changes: setPixelRatio re-sizes the canvas, and assigning a canvas its size, even
        // the same size, throws its drawing buffer away and waits for the GPU — every frame, a stall
        // that scales with the model (most of a big model's frame time on a software renderer).
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        const size = renderer.getSize(new Vector2());
        const resized = renderer.getPixelRatio() !== ratio || size.x !== width || size.y !== height;
        if (!resized) return false;
        // A backing-buffer change needs a redraw even when logical size and pose stay
        // unchanged (pixel ratio only), including calls through the public resize API.
        dirty = true;
        // Keep the displayed frame while its GPU work finishes. Resizing first clears
        // the canvas, then the busy-frame guard would leave it blank without a redraw.
        if (defer && gpuFrames.busy()) return null;
        if (renderer.getPixelRatio() !== ratio) renderer.setPixelRatio(ratio);
        if (size.x !== width || size.y !== height) {
            renderer.setSize(width, height, false);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        }
        return true;
    };

    // Follow the chassis translation: moving arms must not move the camera.
    // Explicit API part following still tracks the requested part.
    const followFrame = built.bodyGroups.get(cameraFollowBody(mechanism));
    let followed = null;
    /** A part the camera follows instead of the model's centre (the Robot Lab API's camera({follow})), or null. */
    let followPartId = null;
    // ---- seeing the model (mech/insight.js data, view/insight-layer.js) -------------
    const insight = createInsightLayer({container, scene: built.scene});
    const pulse = createPulse();
    const bodyStart = new Map(mechanism.bodies.map(b => [b.id, new Vector3(...b.position)]));
    // The followed centre: the moving bodies' centre of mass (sim-scene3d.js movingMassCentre), not the meshes' box.
    const massCentre = () => movingMassCentre(built, mechanism);
    /** An anchor on a body: a world point at t = 0, carried along by the body's pose now. */
    const onBody = (bodyId, world) => {
        const group = built.bodyGroups.get(bodyId);
        if (!group || !world) return () => null;
        // Bodies start at their origin with no rotation, so the local point is an offset.
        const local = new Vector3(...world).sub(bodyStart.get(bodyId));
        return () => group.localToWorld(local.clone());
    };
    const partCentre = id => {
        const mesh = built.partMeshes.get(id);
        if (!mesh) return () => null;
        if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
        const local = mesh.geometry.boundingBox.getCenter(new Vector3());
        return () => mesh.localToWorld(local.clone());
    };
    const allMeshes = () => [...built.partMeshes.values(), ...built.hubMeshes.values()];
    let tints = null;
    const paintTints = () => {
        const on = tints && insight.shown.motion;
        for (const mesh of allMeshes()) {
            const tint = on ? tints.get(mesh.parent && mesh.parent.name) : null;
            for (const m of [].concat(mesh.material)) tintMaterial(m, tint || null);
        }
    };
    // Sensor rays (Show sensor rays): each sensor's probe (PartMeta probe: origin and direction in the
    // part's LDraw frame, LDU) as a line from the sensor, with a dot at its end. A part's mesh holds its
    // geometry in metres in the world's axes (part-geometry.js: x, -y, -z), so the probe is taken there
    // first. A distance sensor's line is as long as what it measures; the others are short.
    let sensorItems = [];
    let lastRays = [];
    const rayMaterial = new LineBasicMaterial({color: 0xdc2626, depthTest: false, transparent: true, opacity: 0.9});
    const rays = new LineSegments(new BufferGeometry(), rayMaterial);
    rays.renderOrder = 10;
    rays.frustumCulled = false;
    rays.visible = false;
    built.scene.add(rays);
    const tipGeometry = new SphereGeometry(1, 12, 8);
    const tipMaterial = new MeshBasicMaterial({color: 0xdc2626, depthTest: false, transparent: true, opacity: 0.9});
    let tips = [];
    const updateSensors = () => {
        if (!rays.visible) return;
        const points = [];
        sensorItems.forEach((item, i) => {
            const mesh = built.partMeshes.get(item.id);
            if (!mesh) return;
            const len = Math.max(1, item.lengthOf()) * LDU_M;
            const origin = new Vector3(...lduToWorld(item.origin));
            const direction = new Vector3(...dirToWorld(item.direction)).normalize();
            const from = mesh.localToWorld(origin.clone());
            const to = mesh.localToWorld(origin.clone().addScaledVector(direction, len));
            points.push(...from.toArray(), ...to.toArray());
            lastRays[i] = {from: from.toArray(), to: to.toArray()};
            const tip = tips[i];
            if (tip) {
                tip.position.copy(to);
                tip.scale.setScalar(3 * LDU_M); // a dot 6 LDU across
            }
        });
        rays.geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
        rays.geometry.computeBoundingSphere();
    };
    /**
     * The sensors whose rays can be shown: items {id (the part in the model), origin, direction (part frame),
     * lengthOf: () => LDU}; `shown` turns the overlay on or off.
     */
    const setSensors = (items, shown) => {
        sensorItems = items.filter(item => built.partMeshes.has(item.id));
        lastRays = [];
        for (const tip of tips) built.scene.remove(tip);
        tips = sensorItems.map(() => {
            const tip = new Mesh(tipGeometry, tipMaterial);
            tip.renderOrder = 10;
            built.scene.add(tip);
            return tip;
        });
        rays.visible = Boolean(shown) && sensorItems.length > 0;
        for (const tip of tips) tip.visible = rays.visible;
        dirty = true;
    };

    /** Port badges: items {id, port, label} (motors and sensors). */
    const cableAnchors = createCableAnchors({read, partOf: id => model.parts.find(p => p.id === id), meshOf: id => built.partMeshes.get(id)});
    const setPorts = items => {
        insight.setPorts(items.map(item => ({...item, anchor: partCentre(item.id), ...cableAnchors(item)})));
        dirty = true;
    };
    /** Hinge axes, gear pairs and body tints from insightOf(runModel, mechanism, …). */
    const setMotion = ({joints = [], gears = [], tints: bodyTintMap = null} = {}) => {
        insight.setMotion({
            axes: joints.filter(j => j.type === 'hinge').map(j => ({motor: j.motor, from: onBody(j.body1, j.from), to: onBody(j.body1, j.to)})),
            balls: joints.filter(j => j.type === 'ball').map(j => ({at: onBody(j.body1, j.point)})),
            gears: gears.map(g => ({text: g.text, from: onBody(g.bodies[0], g.from), to: onBody(g.bodies[1], g.to)}))
        });
        tints = bodyTintMap;
        paintTints();
        dirty = true;
    };
    const setOverlay = shown => {
        insight.setVisible(shown);
        paintTints();
        dirty = true;
    };
    /** Pulse these parts for `ms` (a motor's drive hub too). */
    const highlight = (ids, ms = 3000) => {
        const want = new Set(ids);
        const meshes = allMeshes().filter(m => want.has(m.name.replace(/#hub$/, '')));
        pulse.start(meshes, ms, performance.now());
        dirty = true;
        return meshes.length;
    };

    const measurementRay = new Raycaster();
    const measurementPicker = createMeasurementPicker({canvas, highlight, pick: (x, y) => {
        const rect = canvas.getBoundingClientRect();
        if (!(rect.width > 0 && rect.height > 0)) return null;
        camera.updateMatrixWorld();
        built.scene.updateMatrixWorld(true);
        measurementRay.setFromCamera(new Vector2((x - rect.left) / rect.width * 2 - 1, 1 - (y - rect.top) / rect.height * 2), camera);
        // Per-part proxies preserve authored identity in both ordinary and instanced scenes.
        const hit = measurementRay.intersectObjects(allMeshes(), false)[0];
        return hit ? hit.object.name.replace(/#hub$/, '') : null;
    }});

    // A big (instanced) model is drawn on demand: a frame where no body moved, the camera stayed,
    // the size and the overlay are the same and nothing pulses is not drawn again — the pane's
    // animation loop asks every frame, and redrawing thousands of unchanged parts would keep the
    // page busy for nothing. Small models are drawn every frame, as always.
    const onDemand = Boolean(built.instanced);
    let dirty = true;
    const sampleDrawing = snapshot => {
        if (sampleDrawingSnapshot({built, pens, snapshot})) dirty = true;
    };
    let lastBodies = null;
    // Float64: the camera matrix is doubles, and a float32 copy differs from it in nearly every
    // element, so "the camera moved" was true every frame and an idle big model was redrawn forever
    // (seconds a frame on a software GPU, queueing up behind whatever comes next).
    const lastCamera = new Float64Array(16);
    const lastSize = new Vector2();
    const changed = (snapshot, size) => {
        let moved = false;
        const bodies = snapshot && snapshot.bodies;
        if (bodies && (!lastBodies || lastBodies.length !== bodies.length || bodies.some((v, i) => v !== lastBodies[i]))) {
            lastBodies = Float64Array.from(bodies);
            moved = true;
        }
        camera.updateMatrixWorld();
        const cam = camera.matrixWorld.elements;
        if (cam.some((v, i) => v !== lastCamera[i])) {
            lastCamera.set(cam);
            moved = true;
        }
        if (!size.equals(lastSize)) {
            lastSize.copy(size);
            moved = true;
        }
        return moved || pulse.count > 0;
    };
    controls.addEventListener('change', () => { dirty = true; });

    /**
     * Draw the scene at this snapshot.
     * @param {object} [snapshot] the physics snapshot
     * @param {{force?: boolean}} [options] force: draw even when nothing changed (frame timing)
     */
    const gpuFrames = createGpuFrameQueue(renderer.getContext());
    const render = (snapshot, {force = false} = {}) => {
        if (resize({defer: !force}) === null) return;
        if (onDemand && !force && !dirty && !changed(snapshot, renderer.getSize(new Vector2()))) {
            const size = renderer.getSize(new Vector2());
            measurementOverlay.update(measurementRows ? measurementRows() : [], camera, size.x, size.y);
            return;
        }
        if (!force && gpuFrames.busy()) { dirty = true; return; }
        dirty = false;
        if (snapshot) applySnapshot(built, snapshot);
        if (snapshot && chainMotion) chainMotion.update();
        if (snapshot && simBelts) simBelts.update();
        if (snapshot && pens) pens.update();
        if (drawingPreview) drawingPreview.update();
        if (snapshot && simRopes) simRopes.update();
        if (snapshot && simHoses) simHoses.update();
        const centre = (followPartId && partCentre(followPartId)()) || followFrame?.position.clone() || massCentre() || modelBox().getCenter(new Vector3());
        if (followed && centre) {
            const delta = centre.clone().sub(followed);
            delta.y = 0;
            camera.position.add(delta);
            controls.target.add(delta);
            controls.update();
        }
        followed = centre;
        updateSensors();
        pulse.tick(performance.now());
        built.scene.updateMatrixWorld();
        camera.updateMatrixWorld();
        const size = renderer.getSize(new Vector2());
        insight.update(camera, size.x, size.y);
        measurementOverlay.update(measurementRows ? measurementRows() : [], camera, size.x, size.y);
        renderer.render(built.scene, camera);
        gpuFrames.submitted();
    };

    const dispose = () => {
        gpuFrames.dispose();
        insight.dispose();
        measurementOverlay.dispose();
        if (simBelts) simBelts.dispose();
        if (drawingPreview) drawingPreview.dispose();
        if (pens) pens.dispose();
        if (simRopes) simRopes.dispose();
        if (simHoses) simHoses.dispose();
        rays.geometry.dispose();
        rayMaterial.dispose();
        tipGeometry.dispose();
        tipMaterial.dispose();
        if (grid) {
            for (const g of [grid, ...grid.children]) {
                g.geometry.dispose();
                g.material.dispose();
            }
        }
        canvas.removeEventListener('webglcontextlost', onLost);
        canvas.removeEventListener('keydown', onKey);
        canvas.removeEventListener('pointerdown', focusCanvas);
        measurementPicker.dispose();
        controls.dispose();
        built.dispose();
        renderer.dispose();
        // Give the context back now, not at garbage collection: a big model's buffers live in it, and
        // on a software GPU the next view's context is slow to make while the old one still holds them.
        renderer.forceContextLoss();
        canvas.remove();
    };

    resize();
    resetCamera();
    const recentre = () => {
        followed = null;
        dirty = true;
        resetCamera();
    };
    /** The mouse preset (camera-nav.js MOUSE_PRESETS): which button orbits, which pans. */
    const setMousePreset = preset => { configureOrbitControls(controls, MOUSE, preset); };
    /** What the pens have drawn: strokes of [x, z] floor points (world metres). */
    const penStrokes = () => (pens ? pens.strokes() : []);
    /** The pens' tips' heights above the floor (m), [] without a pen. */
    const penHeights = () => (pens ? pens.heights() : []);
    return {canvas, render, sampleDrawing, resize, resetCamera: recentre, dispose, setPorts, setMotion, setOverlay, setSensors, highlight, setMousePreset, penStrokes, penHeights,
        /** How many pneumatic hoses are drawn (view/hose-layer.js), for the browser gate. */
        hoseCount: () => (simHoses ? simHoses.count : 0),
        /** The sensor rays as last drawn, {from, to} in world space (metres), for the browser gate. */
        setMeasurements: read => { measurementRows = read; dirty = true; },
        setMeasurementPick: handler => measurementPicker.set(handler),
        /** Read-only projection for scene-selection and accessibility controls. */
        partScreenPoint: id => {
            const mesh = built.partMeshes.get(id);
            if (!mesh) return null;
            built.scene.updateMatrixWorld(true); camera.updateMatrixWorld();
            const point = new Box3().setFromObject(mesh).getCenter(new Vector3()).project(camera);
            const rect = canvas.getBoundingClientRect();
            return {x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2, z: point.z};
        },
        sensorRays: () => (rays.visible ? lastRays.filter(Boolean).map(r => ({...r})) : []),
        /** The pane's view buttons: 'home', 'top', 'front' or 'side'; and Fit. */
        view: name => { viewFrom(name); dirty = true; },
        fit: () => { fit(); dirty = true; },
        /** Follow a part (its id in the model) instead of the whole model's centre; null: the model again. */
        followPart: id => {
            followPartId = id && built.partMeshes.has(id) ? id : null;
            followed = null;
            dirty = true;
            return followPartId;
        },
        /** A camera key (camera-nav.js), as if pressed on the focused view; true when the camera moved. */
        nudge: event => { const moved = applyCameraAction(camera, controls, cameraKeyAction(event), canvas.clientHeight); dirty = dirty || moved; return moved; },
        /** The camera now (for the browser gate to read what a gesture did): position, target, distance (metres). */
        get camera () {
            return {position: camera.position.toArray(), target: controls.target.toArray(), distance: camera.position.distanceTo(controls.target)};
        },
        /** World bounds and their projected corners, for camera-framing diagnostics. */
        framingStats: () => {
            const box = modelBox();
            camera.updateMatrixWorld();
            const corners = [box.min.x, box.max.x].flatMap(x => [box.min.y, box.max.y].flatMap(y =>
                [box.min.z, box.max.z].map(z => new Vector3(x, y, z).project(camera).toArray())));
            return {min: box.min.toArray(), max: box.max.toArray(), corners};
        },
        /** What the last frame cost: three's draw calls and triangles, GPU objects, and the instancing (scale gate). */
        // `frames`: frames drawn so far (three counts each render), so a gate can see an idle big model is not redrawn.
        renderStats: () => ({calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, lines: renderer.info.render.lines,
            frames: renderer.info.render.frame,
            geometries: renderer.info.memory.geometries, programs: renderer.info.programs?.length ?? null,
            parts: model.parts.length, instanced: built.instanced ? built.instanced.stats() : null}),
        /** What the overlay shows now, plus the parts pulsing (for the browser gate). */
        overlayStats: () => ({...insight.stats(), pulsing: pulse.count,
            tinted: allMeshes().filter(m => [].concat(m.material).some(x => x.userData.baseColor && !x.color.equals(x.userData.baseColor))).length})};
};
