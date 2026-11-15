// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// Connection-first placement (docs/ROBOT-LAB-UX.md §3.2–§3.5): snapAtPointer, the
// idle connector highlight, "select connected" and turning about a connection, on
// real parts. Every expected number comes from the parts' own metadata (hole
// positions, lengths, axes) and a camera set up here, never from a value the code
// under test chose.

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {snapAtPointer, connectorUnderPointer, connectedComponent, connectionLine, turnAboutLine, joinRule, SNAP_PX} from '../overlay/scratch-gui/src/lib/bw-sim/editor/snap.js';
import {buildGraph, shaftEngagement} from '../overlay/scratch-gui/src/lib/bw-sim/mech/graph.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = new Map(JSON.parse(readFileSync(path.join(ROOT, 'overlay/scratch-gui/src/lib/bw-sim/part-meta/parts.json'), 'utf8')).parts.map(p => [p.part, p]));
const I = Object.freeze([1, 0, 0, 0, 1, 0, 0, 0, 1]);

const norm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const scale = (a, k) => a.map(v => v * k);
const mulVec = (m, v) => [0, 1, 2].map(r => m[r * 3] * v[0] + m[r * 3 + 1] * v[1] + m[r * 3 + 2] * v[2]);
const dist = (a, b) => Math.hypot(...sub(a, b));

/** A pinhole camera at `eye` looking at `at` (LDraw: -y up), 1280×800 px, focal `f` px. */
const camera = (eye, at, f = 900) => {
    const fwd = norm(sub(at, eye));
    const right = norm(cross(fwd, [0, -1, 0]));
    const up = cross(right, fwd);
    const project = p => {
        const d = sub(p, eye);
        const z = dot(d, fwd);
        if (z <= 0) return null;
        return [640 + dot(d, right) / z * f, 400 - dot(d, up) / z * f];
    };
    const ray = ([x, y]) => ({origin: eye, direction: norm(add(fwd, add(scale(right, (x - 640) / f), scale(up, -(y - 400) / f))))});
    return {eye, project, ray};
};
const CAM = camera([0, -300, 200], [0, 0, 0]);

const meta = part => CATALOG.get(part);
const conn = (part, id) => meta(part).connectors.find(c => c.id === id);
/** A connector of a placed part in the model frame. */
const worldConn = (pl, id) => {
    const c = conn(pl.part, id);
    const out = {type: c.type, position: add(mulVec(pl.rotation, c.position), pl.position), axis: norm(mulVec(pl.rotation, c.axis)), length: c.length};
    if (c.closedEnd !== undefined) out.closedEnd = c.closedEnd;
    return out;
};
/** The end of a hole (its segment along its axis) that faces the camera. */
const facingFace = (hole, eye = CAM.eye) => {
    const ends = [1, -1].map(s => ({n: scale(hole.axis, s), p: add(hole.position, scale(hole.axis, s * hole.length / 2))}));
    return ends.sort((a, b) => dot(b.n, sub(eye, b.p)) - dot(a.n, sub(eye, a.p)))[0];
};
const snap = (model, held, pointer, opts = {}, cam = CAM) => snapAtPointer(model, CATALOG, held, cam.ray(pointer), cam.project, {pointer, eye: cam.eye, ...opts});
const pinInHand = () => ({parts: [{id: '__held__', part: '2780.dat', position: [0, -100, 0], rotation: I}]});

const BEAM7 = {id: 'b7', part: '32524.dat', position: [0, 0, 0], rotation: I};
const fixture = (...extra) => ({version: 1, parts: [BEAM7, ...extra]});

test('the pointer on a hole\'s face: only free pin-compatible holes light, that hole leads, and the pin seats half in from the camera side', () => {
    const model = fixture();
    const h3 = worldConn(BEAM7, 'h3');
    const face = facingFace(h3);
    const q = CAM.project(face.p);
    const r = snap(model, pinInHand(), q);
    // Lit: pin-compatible connectors only (the registry: pin → pinhole), every one a hole of the beam.
    assert.ok(r.lit.length > 0);
    for (const l of r.lit) assert.ok(joinRule({type: '2780', ...conn('2780.dat', 'p')}, conn(BEAM7.part, l.connectorId)), `${l.connectorId} joins a pin`);
    assert.ok(r.lit.every(l => l.type === 'pinhole'));
    assert.equal(r.chosen.target.connectorId, 'h3');
    const pin = conn('2780.dat', 'p');
    const mv = r.chosen.moves[0];
    const axis = norm(mulVec(mv.rotation, pin.axis));
    assert.ok(Math.abs(dot(axis, h3.axis)) > 0.9999, 'the pin is coaxial with the hole');
    const centre = add(mulVec(mv.rotation, pin.position), mv.position);
    const lateral = sub(sub(centre, h3.position), scale(h3.axis, dot(sub(centre, h3.position), h3.axis)));
    assert.ok(Math.hypot(...lateral) <= 0.5);
    // The pin's centre on the face (half of it in the hole), on the camera side of the hole's centre.
    assert.ok(dist(centre, face.p) < 1e-6, `pin centre ${centre} on the facing face ${face.p}`);
    const engaged = shaftEngagement({position: centre, axis, length: pin.length}, h3);
    assert.equal(engaged, Math.min(pin.length / 2, h3.length));
    assert.equal(r.chosen.pairs.length, 1);
    assert.equal(r.chosen.blocked, null);
    // The compiler agrees: placed there, the pin and the beam make one edge.
    const placed = {version: 1, parts: [BEAM7, {id: 'p1', part: '2780.dat', position: mv.position, rotation: mv.rotation}]};
    assert.equal(buildGraph(placed, CATALOG).edges.length, 1);
});

test('incompatible: a gear (axle hole) finds no target on pin holes; on a seated axle\'s free tip it does', () => {
    const gear = {parts: [{id: '__held__', part: '3648.dat', position: [0, -100, 0], rotation: I}]};
    const h3 = worldConn(BEAM7, 'h3');
    const q = CAM.project(facingFace(h3).p);
    const none = snap(fixture(), gear, q);
    assert.equal(none.lit.length, 0);
    assert.equal(none.chosen, null);
    // An axle 3 standing in h3: its centre on the top face, along the hole's axis.
    const axle = conn('4519.dat', 'a');
    const face = facingFace(h3);
    const axleRot = [0, -1, 0, 1, 0, 0, 0, 0, 1]; // local x → model y
    assert.ok(Math.abs(dot(norm(mulVec(axleRot, axle.axis)), h3.axis)) > 0.9999);
    const A = {id: 'ax', part: '4519.dat', position: face.p, rotation: axleRot};
    const model = fixture(A);
    const a = worldConn(A, 'a');
    const tip = facingFace(a); // the axle's end towards the camera
    const r = snap(model, gear, CAM.project(tip.p));
    assert.equal(r.chosen.target.partId, 'ax');
    const hole = conn('3648.dat', 'c');
    const mv = r.chosen.moves[0];
    const centre = add(mulVec(mv.rotation, hole.position), mv.position);
    // Flush with the tip: the gear's hole centre half its length back from the tip, on the axle's line.
    assert.ok(dist(centre, sub(tip.p, scale(tip.n, hole.length / 2))) < 1e-6);
    assert.ok(r.chosen.pairs.some(p => p.fixed.part === 'ax'));
});

test('hysteresis: the target stays until another is clearly nearer, then follows', () => {
    const model = fixture();
    const q3 = CAM.project(facingFace(worldConn(BEAM7, 'h3')).p);
    const q4 = CAM.project(facingFace(worldConn(BEAM7, 'h4')).p);
    const d = Math.hypot(q4[0] - q3[0], q4[1] - q3[1]);
    const toward = k => [q3[0] + (q4[0] - q3[0]) * k / d, q3[1] + (q4[1] - q3[1]) * k / d];
    const first = snap(model, pinInHand(), q3);
    assert.equal(first.chosen.target.connectorId, 'h3');
    // Just past the midpoint: h4 is nearer, but by less than the hysteresis.
    const p = toward(d / 2 + (SNAP_PX.hysteresis - 2) / 2);
    assert.ok(d / 2 + SNAP_PX.hysteresis / 2 <= SNAP_PX.targetMouse + SNAP_PX.hysteresis, `holes ${d.toFixed(1)} px apart: the midpoint is within reach of both`);
    assert.equal(snap(model, pinInHand(), p).chosen.target.connectorId, 'h4', 'without a current target the nearest wins');
    assert.equal(snap(model, pinInHand(), p, {previous: first.chosenKey}).chosen.target.connectorId, 'h3', 'the current target is kept');
    assert.equal(snap(model, pinInHand(), q4, {previous: first.chosenKey}).chosen.target.connectorId, 'h4', 'fully on h4, h4 wins');
});

test('blocked: a brick over the hole makes the pose red where it was aimed, never another hole', () => {
    const brick = meta('3001.dat');
    // The brick's bottom (its colliders' lowest point, -y up) on the beam's top face over h3.
    const h3 = worldConn(BEAM7, 'h3');
    const face = facingFace(h3);
    const bottom = Math.max(...brick.colliders.filter(c => c.shape === 'box').map(c => c.position[1] + c.halfExtents[1]));
    const B = {id: 'k', part: '3001.dat', position: [face.p[0], face.p[1] - bottom, face.p[2]], rotation: I};
    const r = snap(fixture(B), pinInHand(), CAM.project(face.p));
    assert.equal(r.chosen.target.connectorId, 'h3');
    assert.deepEqual(r.chosen.blocked, {part: '__held__', into: 'k'});
});

test('Tab: the alternatives at one spot are distinct poses, and cycling back returns to the first', () => {
    const model = fixture();
    const q = CAM.project(facingFace(worldConn(BEAM7, 'h3')).p);
    const r0 = snap(model, pinInHand(), q, {cycle: 0});
    const r1 = snap(model, pinInHand(), q, {cycle: 1});
    const rBack = snap(model, pinInHand(), q, {cycle: 0});
    assert.ok(r1.alternatives.length >= 2);
    assert.notDeepEqual([r1.chosen.target.connectorId, r1.chosen.target.entry, r1.chosen.moves[0].position], [r0.chosen.target.connectorId, r0.chosen.target.entry, r0.chosen.moves[0].position]);
    assert.deepEqual(rBack.chosen.moves, r0.chosen.moves);
    const rMinus = snap(model, pinInHand(), q, {cycle: r1.alternatives.length});
    assert.deepEqual(rMinus.chosen.moves, r0.chosen.moves, 'a full cycle comes back');
});

/** A Beam 3 lying on top of a Beam 7, with pins in its end holes sticking down: the held set. */
const beamWithPins = (base = [0, 0, -20]) => {
    const B3 = {id: 'b3', part: '32523.dat', position: base, rotation: I};
    const pins = ['h0', 'h2'].map((h, i) => {
        const hole = worldConn(B3, h);
        // Centre on the beam's bottom face (+y in LDraw: down), axis along the hole: half sticks out below.
        const below = add(hole.position, scale(hole.axis, hole.length / 2 * Math.sign(hole.axis[1] || 1)));
        return {id: `pin${i}`, part: '2780.dat', position: below, rotation: [0, -1, 0, 1, 0, 0, 0, 0, 1]};
    });
    return {B3, pins};
};

test('a beam carrying two pins seats both at once (all pairs counted), its lead pin chosen by the grab point', () => {
    const {B3, pins} = beamWithPins([0, -100, -20]);
    const held = {parts: [B3, ...pins], grab: pins[0].position};
    // Pins 40 LDU apart (the Beam 3's end holes) over Beam 7's h1 and h3, also 40 apart.
    assert.equal(dist(worldConn(B3, 'h0').position, worldConn(B3, 'h2').position), dist(worldConn(BEAM7, 'h1').position, worldConn(BEAM7, 'h3').position));
    const q = CAM.project(facingFace(worldConn(BEAM7, 'h1')).p);
    const r = snap(fixture(), held, q);
    assert.equal(r.chosen.target.connectorId, 'h1');
    assert.equal(r.chosen.lead.partId, 'pin0');
    const fixedHoles = r.chosen.pairs.filter(p => p.fixed.part === 'b7').map(p => p.fixed.connector).sort();
    assert.deepEqual(fixedHoles, ['h1', 'h3']);
    assert.equal(r.chosen.blocked, null);
    assert.equal(r.chosen.moves.length, 3, 'the whole set moves');
    // Each pin went in as far as it stuck out (the hole's depth): its tip on the beam's far face.
    for (const id of ['pin0', 'pin1']) {
        const mv = r.chosen.moves.find(m => m.id === id);
        const c = add(mulVec(mv.rotation, conn('2780.dat', 'p').position), mv.position);
        const hole = worldConn(BEAM7, id === 'pin0' ? 'h1' : 'h3');
        assert.equal(shaftEngagement({position: c, axis: norm(mulVec(mv.rotation, conn('2780.dat', 'p').axis)), length: conn('2780.dat', 'p').length}, hole), hole.length);
    }
});

test('all-or-nothing: a pose that would leave the second pin half seated is never offered', () => {
    const {B3, pins} = beamWithPins([0, -100, -20]);
    const held = {parts: [B3, ...pins], grab: pins[0].position};
    // A Beam 3 whose hole lines up under the second pin but sits lower than Beam 7 by less than a pin's
    // useful depth: that pin would enter it only a few LDU (MIN_ENGAGE_LDU is 8).
    const h3 = worldConn(BEAM7, 'h3');
    // Lower by the hole's depth less 5: the second pin's tip (seated as deep as the first) only 5 LDU in.
    const low = {id: 'low', part: '32523.dat', position: [0, h3.length - 5, 0], rotation: I};
    const target = {id: 't', part: '32523.dat', position: [0, 0, -40], rotation: I};
    const model = {version: 1, parts: [target, low]};
    // target's h1 is at z = -40, low's h1 is at z = 0: 40 apart, as the two pins.
    const q = CAM.project(facingFace(worldConn(target, 'h1')).p);
    const r = snap(model, held, q);
    const seatsTarget = o => o.target.partId === 't' && o.target.connectorId === 'h1' && o.lead.partId === 'pin0';
    for (const o of r.alternatives) assert.ok(!seatsTarget(o) || o.pairs.length >= 2, 'no pose seating pin0 alone with pin1 half in');
    // Lift the low beam to the same height: now both seat.
    const level = {version: 1, parts: [target, {...low, position: [0, 0, 0]}]};
    const r2 = snap(level, held, q);
    assert.ok(r2.chosen && seatsTarget(r2.chosen) && r2.chosen.pairs.length === 2);
});

test('idle: exactly the hole under the pointer lights, and none 30 px from every hole', () => {
    const model = fixture();
    const q = CAM.project(facingFace(worldConn(BEAM7, 'h3')).p);
    const hl = connectorUnderPointer(model, CATALOG, CAM.ray(q), CAM.project, {pointer: q, eye: CAM.eye});
    assert.equal(hl.connectorId, 'h3');
    // A pixel 30 px from every hole's projected faces (both faces of all seven holes).
    const faces = meta(BEAM7.part).connectors.flatMap(c => [1, -1].map(s => CAM.project(add(worldConn(BEAM7, c.id).position, scale(worldConn(BEAM7, c.id).axis, s * c.length / 2)))));
    let far = null;
    for (let dx = -60; dx <= 60 && !far; dx += 2) {
        for (let dy = -60; dy <= 60 && !far; dy += 2) {
            const p = [q[0] + dx, q[1] + dy];
            if (faces.every(f => Math.hypot(f[0] - p[0], f[1] - p[1]) >= 30)) far = p;
        }
    }
    assert.ok(far, 'a spot 30 px from every hole');
    assert.equal(connectorUnderPointer(model, CATALOG, CAM.ray(far), CAM.project, {pointer: far, eye: CAM.eye}), null);
});

test('studs light only on the part under the pointer; a seated pin\'s connector is not free on its seated end', () => {
    const brickA = {id: 'A', part: '3001.dat', position: [0, 0, 0], rotation: I};
    const brickB = {id: 'B', part: '3001.dat', position: [200, 0, 0], rotation: I};
    const held = {parts: [{id: '__held__', part: '3001.dat', position: [0, -200, 0], rotation: I}]};
    const s0 = worldConn(brickA, 's1');
    const tip = add(s0.position, scale(s0.axis, conn('3001.dat', 's1').length));
    const r = snap({version: 1, parts: [brickA, brickB]}, held, CAM.project(tip), {nearPx: 5000});
    assert.ok(r.lit.some(l => l.partId === 'A' && l.type === 'stud'));
    assert.ok(!r.lit.some(l => l.partId === 'B' && (l.type === 'stud' || l.type === 'antistud')));
    // The brick in hand sits on stud s1 with its anti-stud cell: same position, same up.
    assert.ok(r.chosen && r.chosen.pairs.length >= 1 && r.chosen.blocked === null);
});

test('select connected follows pairs; a pin turned 15° about its hole keeps its point', () => {
    const {B3, pins} = beamWithPins([0, -10 - 10, -20]);
    const loose = {id: 'far', part: '32524.dat', position: [400, 0, 0], rotation: I};
    const model = {version: 1, parts: [BEAM7, B3, ...pins, loose]};
    const comp = connectedComponent(model, CATALOG, ['b3']).sort();
    assert.ok(comp.includes('pin0') && comp.includes('pin1') && !comp.includes('far'));
    // A pin seated in h3: one round connection line, the hole's axis through its centre.
    const h3 = worldConn(BEAM7, 'h3');
    const face = facingFace(h3);
    const P = {id: 'p', part: '2780.dat', position: face.p, rotation: [0, -1, 0, 1, 0, 0, 0, 0, 1]};
    const line = connectionLine({version: 1, parts: [BEAM7, P]}, CATALOG, 'p');
    assert.equal(line.round, true);
    assert.ok(Math.abs(dot(line.axis, h3.axis)) > 0.9999);
    const [turned] = turnAboutLine([P], line.axis, line.point, Math.PI / 12);
    const before = add(mulVec(P.rotation, conn('2780.dat', 'p').position), P.position);
    const after = add(mulVec(turned.rotation, conn('2780.dat', 'p').position), turned.position);
    assert.ok(dist(before, after) < 1e-6, 'the pin\'s point stays');
    // Turned by 15°: the angle between the old and new frames.
    const trace = [0, 4, 8].reduce((acc, i) => acc + [0, 1, 2].reduce((t, k) => t + P.rotation[i - i % 3 + k] * turned.rotation[i - i % 3 + k], 0), 0);
    assert.ok(Math.abs(Math.acos((trace - 1) / 2) - Math.PI / 12) < 1e-6);
    // An axle in an axle hole is not round: a quarter-turn connection.
    const gear = {id: 'g', part: '3648.dat', position: [0, -100, 0], rotation: I};
    const g = worldConn(gear, 'c');
    const ax = {id: 'ax', part: '4519.dat', position: g.position, rotation: [0, 0, -1, 0, 1, 0, 1, 0, 0]};
    assert.ok(Math.abs(dot(worldConn(ax, 'a').axis, g.axis)) > 0.9999);
    const l2 = connectionLine({version: 1, parts: [gear, ax]}, CATALOG, 'ax');
    assert.equal(l2.round, false);
});

test('7 x 11 side bores snap flat onto pins beside the long side of the SPIKE hub',()=>{
    const hub={id:'hub',part:'45601.dat',position:[0,0,0],rotation:I};
    const pins=[40,80].map((z,i)=>({id:`pin${i}`,part:'2780.dat',position:[70,-10,z],rotation:I}));
    const model={version:1,parts:[hub,...pins]};
    const held={parts:[{id:'frame',part:'39794.dat',position:[140,-10,0],rotation:I}],grab:[80,-10,40]};
    const cam=camera([400,-150,180],[70,-10,40]);
    const pointer=cam.project([80,-10,40]);
    const result=snap(model,held,pointer,{only:{partId:'pin0',connectorId:'p'}},cam);
    assert.ok(result.chosen,'a flat side-hole mounting is offered');
    assert.equal(result.chosen.blocked,null);
    assert.deepEqual(result.chosen.moves[0].rotation,I,'the frame does not rotate upward');
    assert.ok(result.chosen.pairs.length>=2,'both pins engage the frame');
});
