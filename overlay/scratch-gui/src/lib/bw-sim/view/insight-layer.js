// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// What the Build and Simulate views draw over the model so a child can see
// what it is made of (data from mech/insight.js):
//
//   port labels      a small badge next to each motor and sensor with its hub
//                    port letter, "?" when it is not plugged in. HTML over the
//                    canvas (crisp text, clickable in Build: it opens the
//                    pane's port picker);
//   hinge axes       a thin rod along each hinge's axis with an arrow head,
//                    red for motor hinges, blue for free ones; a dot at a ball
//                    joint;
//   gear pairs       a violet rod from one gear's centre to the other's, with
//                    the tooth ratio ("1:3") as a label at its middle;
//   cables           with the port labels: a dark cable arching from each plugged-in
//                    motor or sensor's cable exit to its assigned hub socket.
//                    Badge anchors are separate from these physical attachments.
//
// Everything is anchored: an anchor is a function returning the world point
// now (a body that moves, a part being dragged), read once per frame, so the
// overlay follows the simulation. Rods and heads are drawn on top of the parts
// (no depth test): an axle hidden inside the robot still shows.

import {ConeGeometry, CubicBezierCurve3, CurvePath, CylinderGeometry, Group, Mesh, MeshBasicMaterial, SphereGeometry, TubeGeometry, Vector3} from 'three';

export const INSIGHT_COLORS = Object.freeze({motorAxis: 0xdc2626, axis: 0x2563eb, gear: 0x7c3aed});
/** Rod radius, metres: thin, but more than a 1 px line. */
const ROD_RADIUS = 0.0007;
const HEAD_RADIUS = 0.0022;
const HEAD_LENGTH = 0.006;
const UP = new Vector3(0, 1, 0);
/**
 * A cable: 1.2 mm thick, LEGO's dark grey, arching up over the model (half its span plus 1.5 cm
 * above the middle) so it shows even between parts that touch.
 */
const CABLE_RADIUS = 0.0012;
const CABLE_ARCH = 0.5;
const CABLE_CLEARANCE = 0.015;
const CABLE_COLOR = 0x3a3f44;

// Two smooth spans retain the outward tangent at BOTH socket mouths. A single
// centre-to-centre arch instead cuts through the device or the hub's casing.
const cableCurve = (from, to, fromDirection, toDirection) => {
    const span = from.distanceTo(to), lead = Math.max(0.006, Math.min(0.03, span * 0.3));
    const mid = from.clone().add(to).multiplyScalar(0.5);
    mid.y = Math.max(from.y, to.y) + span * CABLE_ARCH + CABLE_CLEARANCE;
    const across = to.clone().sub(from); across.y = 0;
    if (across.lengthSq() < 1e-12) across.set(1, 0, 0);
    across.normalize().multiplyScalar(lead);
    const path = new CurvePath();
    path.add(new CubicBezierCurve3(from.clone(), from.clone().addScaledVector(fromDirection, lead), mid.clone().sub(across), mid.clone()));
    path.add(new CubicBezierCurve3(mid.clone(), mid.clone().add(across), to.clone().addScaledVector(toDirection, lead), to.clone()));
    return path;
};

const badgeStyle = (el, extra) => Object.assign(el.style, {
    position: 'absolute', left: '0', top: '0', pointerEvents: 'none', whiteSpace: 'nowrap',
    font: '600 11px/14px system-ui, sans-serif', padding: '1px 5px', borderRadius: '8px',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.35)', willChange: 'transform', ...extra
});

/**
 * @param {object} options
 * @param {HTMLElement} options.container the view's box (position: relative); labels go in a layer over it
 * @param {import('three').Object3D} options.scene where the rods are added
 * @param {(id: string, rect: DOMRect) => void} [options.onPortClick] Build: a port label was clicked
 */
export const createInsightLayer = ({container, scene, onPortClick = null}) => {
    const root = new Group();
    root.name = 'bw-insight';
    root.renderOrder = 30;
    scene.add(root);
    const dom = document.createElement('div');
    dom.dataset.testid = 'bw-sim-lab-insight-labels';
    Object.assign(dom.style, {position: 'absolute', inset: '0', overflow: 'hidden', pointerEvents: 'none'});
    container.appendChild(dom);

    const rodGeometry = new CylinderGeometry(1, 1, 1, 8, 1);
    const headGeometry = new ConeGeometry(1, 1, 12, 1);
    const dotGeometry = new SphereGeometry(1, 12, 8);
    const material = color => new MeshBasicMaterial({color, depthTest: false, depthWrite: false, transparent: true, opacity: 0.95});
    const materials = {motorAxis: material(INSIGHT_COLORS.motorAxis), axis: material(INSIGHT_COLORS.axis), gear: material(INSIGHT_COLORS.gear)};

    let show = {ports: true, motion: false};
    let ports = []; // {id, el, anchor}
    let rods = []; // {from, to, mesh, head}
    let dots = []; // {at, mesh}
    let ratios = []; // {from, to, el}

    const clearRods = () => {
        for (const r of rods) { root.remove(r.mesh); if (r.head) root.remove(r.head); }
        for (const d of dots) root.remove(d.mesh);
        for (const r of ratios) r.el.remove();
        rods = []; dots = []; ratios = [];
    };
    // Cables: their own group, shown with the port labels (not the motion overlay), depth-tested.
    const cableRoot = new Group();
    cableRoot.name = 'bw-insight-cables';
    scene.add(cableRoot);
    const cableMaterial = new MeshBasicMaterial({color: CABLE_COLOR});
    let cables = []; // {from, to, mesh, shape: {span, fromDirection, toDirection}|null}
    const clearCables = () => {
        for (const c of cables) { cableRoot.remove(c.mesh); c.mesh.geometry.dispose(); }
        cables = [];
    };
    const clearPorts = () => {
        for (const p of ports) p.el.remove();
        ports = [];
        clearCables();
    };

    /**
     * @param {{id: string, port: string|null, label: string, anchor: () => Vector3|null}[]} items
     */
    const setPorts = items => {
        clearPorts();
        for (const item of items) {
            const el = document.createElement(onPortClick ? 'button' : 'span');
            if (onPortClick) el.type = 'button';
            el.textContent = item.port || '?';
            el.dataset.testid = `bw-sim-lab-port-label-${item.id}`;
            el.dataset.port = item.port || '';
            el.setAttribute('aria-label', item.label);
            el.title = item.label;
            badgeStyle(el, {
                border: `1px solid ${item.port ? '#1e3a8a' : '#c2410c'}`,
                background: item.port ? '#dbeafe' : '#ffedd5', color: item.port ? '#1e3a8a' : '#9a3412',
                pointerEvents: onPortClick ? 'auto' : 'none', cursor: onPortClick ? 'pointer' : 'default'
            });
            if (onPortClick) {
                // The press must not reach the canvas (it would select or drag what is behind).
                el.addEventListener('pointerdown', event => event.stopPropagation());
                el.addEventListener('click', event => {
                    event.stopPropagation();
                    onPortClick(item.id, el.getBoundingClientRect());
                });
            }
            dom.appendChild(el);
            ports.push({id: item.id, el, anchor: item.anchor});
            if (item.port && item.cableAnchor && item.hubAnchor && item.cableDirection && item.hubDirection) {
                const mesh = new Mesh(undefined, cableMaterial);
                mesh.name = 'bw-insight-cable';
                mesh.userData.part = item.id;
                mesh.frustumCulled = false;
                cableRoot.add(mesh);
                cables.push({from: item.cableAnchor, to: item.hubAnchor,
                    fromDirection: item.cableDirection, toDirection: item.hubDirection, mesh, shape: null});
            }
        }
    };

    /**
     * @param {{axes: {from: Function, to: Function, motor: boolean}[], balls: {at: Function}[],
     *          gears: {from: Function, to: Function, text: string}[]}} data anchors are functions → Vector3
     */
    const setMotion = ({axes = [], balls = [], gears = []}) => {
        clearRods();
        for (const a of axes) {
            const m = a.motor ? materials.motorAxis : materials.axis;
            const mesh = new Mesh(rodGeometry, m);
            const head = new Mesh(headGeometry, m);
            mesh.name = a.motor ? 'bw-insight-motor-axis' : 'bw-insight-axis';
            head.name = 'bw-insight-axis-head';
            for (const o of [mesh, head]) { o.renderOrder = 30; o.frustumCulled = false; root.add(o); }
            rods.push({from: a.from, to: a.to, mesh, head, radius: ROD_RADIUS});
        }
        for (const b of balls) {
            const mesh = new Mesh(dotGeometry, materials.axis);
            mesh.name = 'bw-insight-ball';
            mesh.renderOrder = 30;
            mesh.scale.setScalar(HEAD_RADIUS * 1.4);
            root.add(mesh);
            dots.push({at: b.at, mesh});
        }
        for (const g of gears) {
            const mesh = new Mesh(rodGeometry, materials.gear);
            mesh.name = 'bw-insight-gear-link';
            mesh.renderOrder = 30;
            mesh.frustumCulled = false;
            root.add(mesh);
            rods.push({from: g.from, to: g.to, mesh, head: null, radius: ROD_RADIUS * 0.8});
            const el = document.createElement('span');
            el.textContent = g.text;
            el.dataset.testid = 'bw-sim-lab-gear-ratio';
            badgeStyle(el, {border: '1px solid #6d28d9', background: '#ede9fe', color: '#5b21b6'});
            dom.appendChild(el);
            ratios.push({from: g.from, to: g.to, el});
        }
    };

    const setVisible = next => {
        show = {...show, ...next};
    };

    const a = new Vector3();
    const b = new Vector3();
    const dir = new Vector3();
    const cableSpan = new Vector3();
    const cableOrigin = new Vector3();
    const place = (el, world, camera, w, h, lift) => {
        const v = world.clone().project(camera);
        if (v.z > 1 || v.z < -1) { el.style.display = 'none'; return; }
        el.style.display = '';
        const x = (v.x + 1) / 2 * w;
        const y = (1 - v.y) / 2 * h;
        el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, ${lift})`;
    };

    /** Per frame, after the scene's matrices are current: rods follow their anchors, labels their points. */
    const update = (camera, width, height) => {
        root.visible = show.motion;
        for (const r of rods) {
            const pa = r.from(); const pb = r.to();
            const on = show.motion && pa && pb;
            r.mesh.visible = Boolean(on);
            if (r.head) r.head.visible = Boolean(on);
            if (!on) continue;
            a.copy(pa); b.copy(pb);
            dir.subVectors(b, a);
            const len = dir.length();
            if (len < 1e-9) { r.mesh.visible = false; if (r.head) r.head.visible = false; continue; }
            dir.divideScalar(len);
            r.mesh.position.addVectors(a, b).multiplyScalar(0.5);
            r.mesh.quaternion.setFromUnitVectors(UP, dir);
            r.mesh.scale.set(r.radius, len, r.radius);
            if (r.head) {
                r.head.position.copy(b).addScaledVector(dir, HEAD_LENGTH / 2);
                r.head.quaternion.copy(r.mesh.quaternion);
                r.head.scale.set(HEAD_RADIUS, HEAD_LENGTH, HEAD_RADIUS);
            }
        }
        for (const d of dots) {
            const p = d.at();
            d.mesh.visible = Boolean(show.motion && p);
            if (p) d.mesh.position.copy(p);
        }
        for (const r of ratios) {
            const pa = r.from(); const pb = r.to();
            if (!show.motion || !pa || !pb) { r.el.style.display = 'none'; continue; }
            place(r.el, a.copy(pa).add(pb).multiplyScalar(0.5), camera, width, height, '-50%');
        }
        cableRoot.visible = show.ports;
        for (const c of cables) {
            const pa = show.ports ? c.from() : null;
            const pb = pa ? c.to() : null;
            const da = pa && pb ? c.fromDirection() : null;
            const db = da ? c.toDirection() : null;
            c.mesh.visible = Boolean(pa && pb && da && db);
            if (!pa || !pb || !da || !db) continue;
            // A rigid translation moves the mesh without changing the curve in
            // local coordinates. A change in span or socket tangent reshapes it.
            c.mesh.position.copy(pa);
            cableSpan.subVectors(pb, pa);
            const shape = c.shape;
            if (shape && shape.span.distanceToSquared(cableSpan) < 1e-10 &&
                shape.fromDirection.distanceToSquared(da) < 1e-10 && shape.toDirection.distanceToSquared(db) < 1e-10) continue;
            c.shape = {span: cableSpan.clone(), fromDirection: da.clone(), toDirection: db.clone()};
            c.mesh.geometry.dispose();
            c.mesh.geometry = new TubeGeometry(cableCurve(cableOrigin, cableSpan, da, db), 32, CABLE_RADIUS, 6, false);
        }
        for (const p of ports) {
            const at = show.ports ? p.anchor() : null;
            if (!at) { p.el.style.display = 'none'; continue; }
            place(p.el, at, camera, width, height, '-140%');
        }
    };

    /** What is shown now (for tests and the browser gate). */
    const stats = () => ({
        ports: ports.filter(p => p.el.style.display !== 'none').length,
        axes: rods.filter(r => r.head && r.mesh.visible).length,
        motorAxes: rods.filter(r => r.head && r.mesh.visible && r.mesh.name === 'bw-insight-motor-axis').length,
        balls: dots.filter(d => d.mesh.visible).length,
        gears: rods.filter(r => !r.head && r.mesh.visible).length,
        ratios: ratios.filter(r => r.el.style.display !== 'none').map(r => r.el.textContent),
        cables: cables.filter(c => c.mesh.visible).map(c => c.mesh.userData.part),
        cableAttachments: cables.filter(c => c.mesh.visible && c.shape).map(c => ({id: c.mesh.userData.part,
            from: c.mesh.position.toArray(), to: c.mesh.position.clone().add(c.shape.span).toArray(),
            fromDirection: c.shape.fromDirection.toArray(), toDirection: c.shape.toDirection.toArray()}))
    });

    const dispose = () => {
        clearRods();
        clearPorts();
        scene.remove(root);
        scene.remove(cableRoot);
        cableMaterial.dispose();
        rodGeometry.dispose();
        headGeometry.dispose();
        dotGeometry.dispose();
        for (const m of Object.values(materials)) m.dispose();
        dom.remove();
    };

    return {setPorts, setMotion, setVisible, update, stats, dispose, get shown () { return {...show}; }};
};

/**
 * Paints a part material in a flat tint (a body's pastel, or a warning red), or
 * back in its own colours when `tint` is null. A part whose faces carry their
 * own colours (vertex colours: a motor's azure, a tyre) is painted flat too,
 * since multiplying them by the tint would make a third colour that belongs to
 * no body.
 * @param {import('three').Material} m
 * @param {string|number|null} tint
 */
export const tintMaterial = (m, tint) => {
    if (!m || !m.color) return;
    const u = m.userData;
    if (!u.baseColor) {
        u.baseColor = m.color.clone();
        u.baseVertexColors = Boolean(m.vertexColors);
    }
    const on = tint !== null && tint !== undefined;
    if (on) m.color.set(tint);
    else m.color.copy(u.baseColor);
    const vertexColors = on ? false : u.baseVertexColors;
    if (m.vertexColors !== vertexColors) {
        m.vertexColors = vertexColors;
        m.needsUpdate = true;
    }
};

/**
 * Pulsing highlight for some meshes over a few seconds (Simulate: "show me
 * these parts"). Call `tick(now)` every frame; it sets and then restores each
 * material's emissive colour.
 */
export const createPulse = () => {
    let active = null; // {meshes, until}
    const set = (meshes, hexValue) => {
        for (const mesh of meshes) {
            for (const m of [].concat(mesh.material)) m.emissive?.setHex(hexValue);
        }
    };
    return {
        start (meshes, ms, now) {
            if (active) set(active.meshes, 0x000000);
            active = meshes.length ? {meshes, until: now + ms} : null;
        },
        tick (now) {
            if (!active) return;
            if (now >= active.until) {
                set(active.meshes, 0x000000);
                active = null;
                return;
            }
            // Two pulses a second between dark and a strong orange.
            const k = 0.5 + 0.5 * Math.sin(now / 1000 * Math.PI * 4);
            const r = Math.round(0xf9 * k); const g = Math.round(0x73 * k); const bl = Math.round(0x16 * k);
            set(active.meshes, (r << 16) | (g << 8) | bl);
        },
        /** How many meshes pulse now (0: none). */
        get count () { return active ? active.meshes.length : 0; }
    };
};
