// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// Mechanism compiler entry: `compile(model, catalog, opts)` turns a
// PlacedModel + catalog into a CompiledMechanism (pure data in, pure data
// out). Runs validateCompiledMechanism on output and throws on bug.
//
// Registry-driven (docs/ROBOT-LAB-ARCHITECTURE.md §6.2, §6.3): which
// connectors join (graph.js), which tooth sets mesh (gears.js) and which other
// couplings exist (a module's `detect`) come from `opts.kinds` (default
// kinds/index.js BUILTIN_KINDS), so a new kind is a module, not an edit here.
// `opts.version: 2` emits CompiledMechanism v2 (contracts.js): the v1
// mechanism plus hubs, actuators bound to {hub, port}, couplings, devices,
// body roles and the no-collide pairs; the default is the v1 mechanism.

import {validateInternalEdgeRemovalPairs, validatePlacedModel, validateCompiledMechanism, GROUND_FRICTION, GROUND_RESTITUTION, GROUND_MATERIAL, MATERIALS, LDU_M, lduToWorld, dirToWorld,
    partHubProfile, partSensor, portRefOf, withBodyRoles, noCollidePairs, couplingBodyPairs, V1_COUPLING_KINDS} from '../contracts.js';
import {BUILTIN_KINDS} from '../kinds/index.js';
import {mat3MulVec3, vecAdd, quatNormalize} from './vec.js';

/** A tread wheel's collider adds next to nothing to its sprocket's mass (the tread's links are on the frame). */
const TREAD_WHEEL_MASS_KG = 0.0001;
import {buildGraph} from './graph.js';
import {buildIslands} from './islands.js';
import {buildJoints} from './joints.js';
import {buildGears} from './gears.js';
import {sharedAxisBodyPairs, localNoCollide, asBuiltOverlaps} from './collision-filter.js';
import {freePinWelds} from './free-pins.js';
import {rescueLoose, weldByContact, nearBallJoints} from './loose-rescue.js';
import {breakHingeLoops} from './loops.js';

/** Physical retaining links for connectivity diagnostics; transmission ratios
 * alone do not hold a body in space. Constraint construction is unchanged. */
export const structuralCouplingLinks = couplings => couplings.flatMap(c => {
    if (c.kind === 'rope') return c.points.map(p => ({type: 'rope', body1: p.body, body2: c.hook.body}));
    if (c.kind === 'universalJoint') return [{type: 'universalJoint', body1: c.body1, body2: c.body2}];
    return [];
});

/**
 * Solver iterations for the joints of a model from elsewhere that hold a light body (below massKg) against one ratio
 * times heavier (physics/jolt-core.js lightLinks). Bodies keep their parts' masses.
 */
export const FOREIGN_LIGHT_LINKS = Object.freeze({massKg: 0.01, ratio: 20, velocity: 30, position: 10});
// Explicit authored-model preset: light links in a closed linkage need velocity
// convergence from the first gravity step. Mass, contacts and topology stay unchanged.
export const AUTHORED_LIGHT_LINKS = Object.freeze({...FOREIGN_LIGHT_LINKS, velocity: 120});
/**
 * A model from elsewhere: no body moves faster than this (Jolt's own limit is 500 m/s). A LEGO model's fastest part
 * is well under it; a part the solver flings is caught before it reaches a non-finite pose (42109, 42052, 75253 and
 * 42066 went to NaN in the bench with every motor at 60 %, and held together with the limit).
 */
export const FOREIGN_MAX_SPEED_M_S = 5;
/**
 * A model from elsewhere: the friction (N·m) of a hinge nothing drives, limits or couples, as a Technic pin's. A
 * friction pin holds a 10 g liftarm level 6 cm out (0.006 N·m); 0.02 is that order. Bench (19 models, every motor at
 * 60 %, 2 s): NaN 13 with none, 9 at 0.005, 7 at 0.02, 6 at 0.05; the plain drivers' distances unchanged.
 */
export const FOREIGN_FREE_HINGE_NM = 0.02;
import {validateLoad, loadBody} from '../world/objects.js';
import {quatMul, quatConj} from './vec.js';

/** Half the floor's side (m): the floor is 20 m square. */
export const FLOOR_HALF_M = 10;

/** Rotate Vec3 v by unit quat q (xyzw) */
const quatRotateVec = (q, v) => {
    // q * v * q_conj, where v as quat [v,0]
    const qv = [v[0], v[1], v[2], 0];
    const qConj = quatConj(q);
    const t = quatMul(q, qv);
    const r = quatMul(t, qConj);
    return [r[0], r[1], r[2]];
};

/**
 * Create ground body (static box 2m x 2m, 0.02m thick) whose TOP is at lowest
 * world-y of any collider in the model (exact lowest point of each primitive).
 * Box: sum halfExtent_i * |y-component of local axis i in world|
 * Cylinder (axis a = rotated +y): halfHeight*|a_y| + radius*sqrt(1 - a_y^2)
 * Sphere: radius
 * @param {Array} bodies dynamic bodies already built
 * @returns {object} ground body
 */
const makeGround = (bodies, opts = {}) => {
    let lowest = Infinity;
    for (const b of bodies) {
        for (const col of b.colliders) {
            const colPos = col.position ? col.position : [0, 0, 0];
            const worldY = b.position[1] + colPos[1];
            let extent = 0;
            const rot = col.rotation ? col.rotation : [0, 0, 0, 1];
            if (col.shape === 'box') {
                const he = col.halfExtents;
                // Local axes X,Y,Z rotated
                const ax = quatRotateVec(rot, [1, 0, 0]);
                const ay = quatRotateVec(rot, [0, 1, 0]);
                const az = quatRotateVec(rot, [0, 0, 1]);
                extent = he[0] * Math.abs(ax[1]) + he[1] * Math.abs(ay[1]) + he[2] * Math.abs(az[1]);
            } else if (col.shape === 'cylinder') {
                const a = quatRotateVec(rot, [0, 1, 0]); // cylinder axis
                const ay = a[1];
                const hh = col.halfHeight; const r = col.radius;
                extent = hh * Math.abs(ay) + r * Math.sqrt(Math.max(0, 1 - ay * ay));
            } else if (col.shape === 'sphere') {
                extent = col.radius;
            }
            const bottom = worldY - extent;
            if (bottom < lowest) lowest = bottom;
        }
    }
    if (!isFinite(lowest)) lowest = 0;

    const halfThick = 0.01;
    const centerY = lowest - halfThick;
    // The floor reaches FLOOR_HALF_M every way: a robot driven about (the drive pad, the motor mixer, a
    // program) stays on it for minutes; the 2 m floor it had ended in a drop within seconds.
    return {
        id: 'ground',
        motion: 'static',
        position: [0, centerY, 0],
        rotation: [0, 0, 0, 1],
        massKg: 0,
        colliders: [{shape: 'box', halfExtents: [FLOOR_HALF_M, halfThick, FLOOR_HALF_M]}],
        parts: [],
        friction: GROUND_FRICTION,
        restitution: GROUND_RESTITUTION,
        material: GROUND_MATERIAL,
        color: opts.groundColor !== undefined ? opts.groundColor : 10,
        ...(opts.mat ? {mat: opts.mat} : {}),
    };
};

/**
 * The placed parts of every connected group of bodies (bodies linked by joints) other
 * than the main one: the group with the hub, or else the one with the most parts.
 * @returns {string[][]} part ids per loose group, each sorted, groups in body order
 */
const looseGroups = (bodies, joints, catalogMap, nodes) => {
    if (bodies.length < 2) return [];
    const parent = new Map(bodies.map(b => [b.id, b.id]));
    const find = x => (parent.get(x) === x ? x : find(parent.get(x)));
    for (const j of joints) {
        if (!parent.has(j.body1) || !parent.has(j.body2)) continue;
        const a = find(j.body1); const b = find(j.body2);
        if (a !== b) parent.set(b, a);
    }
    const groups = new Map(); // root -> Set(part ids)
    for (const b of bodies) {
        const r = find(b.id);
        if (!groups.has(r)) groups.set(r, new Set());
        for (const pid of b.parts) groups.get(r).add(pid);
    }
    if (groups.size < 2) return [];
    const hubParts = new Set();
    for (const node of nodes.values()) if (node.meta && partHubProfile(node.meta)) hubParts.add(node.partId);
    const list = [...groups.values()].map(set => [...set].sort((x, y) => x.localeCompare(y)));
    let main = list.findIndex(parts => parts.some(id => hubParts.has(id)));
    if (main < 0) {
        main = 0;
        list.forEach((parts, i) => { if (parts.length > list[main].length) main = i; });
    }
    return list.filter((_, i) => i !== main);
};

/**
 * Normalize catalog to Map.
 */
const toCatalogMap = catalog => {
    if (catalog instanceof Map) return catalog;
    if (catalog && typeof catalog === 'object') return new Map(Object.entries(catalog));
    return new Map();
};

/**
 * Compile a PlacedModel + catalog into a CompiledMechanism.
 * @param {object} model PlacedModel
 * @param {Map|object} catalog Map/record partName->PartMeta
 * @param {object} opts {ground?:boolean} ground===false disables ground body;
 *        {kinds?} the kind registries (kinds/index.js; default the built-in ones);
 *        {version?: 1|2} which CompiledMechanism to emit (default 1)
 * @returns {object} CompiledMechanism
 */
export const compile = (model, catalog, opts = {}) => {
    if (model?.motorDirection !== undefined && !['legacy', 'motor-frame'].includes(model.motorDirection)) {
        throw new RangeError('motorDirection must be legacy or motor-frame');
    }
    if (model?.rotor !== undefined && !['legacy', 'native'].includes(model.rotor)) {
        throw new RangeError('rotor must be legacy or native');
    }
    const edgeProblems = validateInternalEdgeRemovalPairs(model?.internalEdgeRemovalPairs, new Set((Array.isArray(model?.parts) ? model.parts : []).map(p => p?.id)), 'model.internalEdgeRemovalPairs');
    if (edgeProblems.length) throw new RangeError(edgeProblems.join('; '));
    if (model?.solver !== undefined && model.solver !== 'light-links') throw new RangeError('solver must be light-links');
    const diagnostics = [];
    const catalogMap = toCatalogMap(catalog);
    const kinds = opts.kinds || BUILTIN_KINDS;

    // Validate input model (including catalog membership)
    const problems = validatePlacedModel(model, catalogMap);
    // Map problems to diagnostics; a problem about one placed part names it (`model.parts[<id>]…`).
    const placedIds = new Set((model && Array.isArray(model.parts) ? model.parts : []).map(pl => pl && pl.id));
    const problemParts = p => {
        const m = p.match(/^model\.parts\[([^\]]+)\]/);
        return m && placedIds.has(m[1]) ? [m[1]] : [];
    };
    for (const p of problems) {
        const code = p.includes('is not in the part catalog') ? 'unknown-part' : 'invalid-model';
        diagnostics.push({severity: 'error', code, message: p, parts: problemParts(p)});
    }

    // Filter parts to known ones; skip unknown parts (they are error, not throw)
    const knownParts = [];
    for (const pl of (model && Array.isArray(model.parts) ? model.parts : [])) {
        if (catalogMap.has(pl.part)) knownParts.push(pl);
        // else already diagnosed as unknown-part, skip
    }

    const filteredModel = {version: 1, parts: knownParts};
    // Rubber bands round known parts only (kinds/belt.js reads them).
    if (model.belts) {
        const known = new Set(knownParts.map(p => p.id));
        const belts = model.belts.filter(b => b.around.every(id => known.has(id)));
        if (belts.length) filteredModel.belts = belts;
    }
    // Hoses between known parts (kinds/pneumatic.js).
    if (model.hoses) {
        const known = new Set(knownParts.map(p => p.id));
        const hoses = model.hoses.filter(h => known.has(h.a.part) && known.has(h.b.part));
        if (hoses.length) filteredModel.hoses = hoses;
    }
    // Ropes likewise (kinds/rope.js).
    if (model.ropes) {
        const known = new Set(knownParts.map(p => p.id));
        const ropes = model.ropes.filter(r => r.around.every(id => known.has(id)));
        if (ropes.length) filteredModel.ropes = ropes;
    }

    // If filtered model has no valid parts, we still need to produce a mechanism with maybe ground only plus diagnostics
    // Build graph (even if empty)
    const {nodes, edges: builtEdges} = buildGraph(filteredModel, catalogMap, diagnostics, kinds);
    // A model from elsewhere: groups that connect to nothing are joined by their nearest near-miss (mech/loose-rescue.js).
    let graphEdges = builtEdges;
    if (opts.rescueLoose) {
        // Towballs a file places a hair off their sockets first: they join what would otherwise look loose.
        const balls = nearBallJoints(nodes, builtEdges);
        if (balls.length) graphEdges = [...builtEdges, ...balls];
        const rescued = rescueLoose(nodes, graphEdges);
        if (rescued.edges.length) {
            graphEdges = [...graphEdges, ...rescued.edges];
            diagnostics.push({severity: 'warning', code: 'seated-loosely', parts: rescued.groups.flat(),
                message: `Joined where their pins or axles almost fit: ${rescued.groups.map(g => g.length).join(', ')} parts`});
        }
    }

    // Topology fixpoint. Islands come from rigid edges; two things can then
    // weld islands together and force a rebuild: hinges between one island pair
    // that are not collinear (locked-hinges), and a gear rigidly on the frame its
    // mesh partner turns in (gear-on-frame, gears.js). Each pass rebuilds islands,
    // joints and gears from the graph plus the welds found so far; the gear pass's
    // other diagnostics are kept from the final pass only.
    const extraRigidPairs = [];
    // ...and a group still connected to nothing is welded to what it touches most (mech/loose-rescue.js weldByContact).
    if (opts.rescueLoose) {
        const welded = weldByContact(nodes, graphEdges);
        if (welded.pairs.length) {
            extraRigidPairs.push(...welded.pairs);
            diagnostics.push({severity: 'warning', code: 'seated-loosely', parts: welded.groups.flat(),
                message: `Held where they touch the rest: ${welded.groups.map(g => g.length).join(', ')} parts`});
        }
    }
    const firstNodeOf = (islandsNow, bodyId) => {
        for (const [nid, bid] of islandsNow.nodeToBody.entries()) if (bid === bodyId) return nid;
        return null;
    };
    const weld = (islandsNow, bA, bB) => {
        const nA = firstNodeOf(islandsNow, bA);
        const nB = firstNodeOf(islandsNow, bB);
        if (nA && nB) extraRigidPairs.push([nA, nB]);
    };
    let islands;
    let jointsResult;
    let gearResult;
    let gearDiagnostics;
    let detected = {couplings: [], diagnostics: [], limits: [], wheels: [], springs: [], joints: [], replacements: []};
    // Every weld merges two islands, so this settles in at most one pass per node.
    for (let pass = 0; pass <= nodes.size + 1; pass++) {
        islands = buildIslands(nodes, graphEdges, catalogMap, diagnostics, opts, extraRigidPairs);
        jointsResult = buildJoints(nodes, graphEdges, islands, diagnostics, {motorDirection: model.motorDirection || 'legacy'});
        if (jointsResult.lockedPairs.length > 0) {
            jointsResult.lockedPairs.forEach(([bA, bB], i) => {
                const parts = (jointsResult.lockedParts && jointsResult.lockedParts[i]) || [];
                // One part mounted by its own two pins locks by design: welded, nothing to say (joints.js isPinMount).
                if (!(jointsResult.lockedMounts && jointsResult.lockedMounts[i])) {
                    diagnostics.push({severity: 'warning', code: 'locked-hinges', message: `Hinges between ${bA} and ${bB} lock, merging islands`, parts});
                }
                weld(islands, bA, bB);
            });
            continue;
        }
        // A free pin (mech/free-pins.js) is welded to one of the two parts it joins: one hinge, no
        // light body between two constraints.
        const freePins = freePinWelds(nodes, islands, jointsResult.joints, {dangling: Boolean(opts.rescueLoose)});
        if (freePins.length > 0) {
            for (const [bA, bB] of freePins) weld(islands, bA, bB);
            continue;
        }
        gearDiagnostics = [];
        // A model from elsewhere: gears a hair off square or parallel still mesh (mech/gears.js squaredUp).
        gearResult = buildGears(nodes, islands, jointsResult.joints, catalogMap, gearDiagnostics, jointsResult.jointEntries, kinds,
            opts.rescueLoose ? {slack: {deg: 2, ldu: 1.5, hingeLdu: 3.5}} : {});
        if (gearResult.lockedPairs.length === 0) {
            // Registered coupling detectors (kinds/worm.js, kinds/rack.js): their welds re-run the fixpoint too.
            detected = detectCouplings(kinds, {nodes, islands, joints: jointsResult.joints, jointEntries: jointsResult.jointEntries, catalog: catalogMap, model: filteredModel, gearCouplings: [...gearResult.gears,...(gearResult.relative||[])]});
            if (detected.welds.length === 0) break;
            // A lock a detector found (a worm or a rack fixed to its partner's frame) is said once, here.
            for (const d of detected.diagnostics) if (d.code === 'gear-on-frame') diagnostics.push(d);
            for (const [bA, bB] of detected.welds) weld(islands, bA, bB);
            gearResult = null;
            continue;
        }
        for (const d of gearDiagnostics) if (d.code === 'gear-on-frame' || d.code === 'gear-loop-locked') diagnostics.push(d);
        for (const [bA, bB] of gearResult.lockedPairs) weld(islands, bA, bB);
        gearResult = null;
    }
    if (!gearResult) throw new Error('compile: mechanism topology did not settle');
    // A gear welded by gear-on-frame is "not on a hinge" by construction; that is the lock, already said.
    const lockedGears = new Set(diagnostics.filter(d => d.code === 'gear-on-frame' || d.code === 'gear-loop-locked').flatMap(d => d.parts));
    for (const d of gearDiagnostics) {
        if (d.code === 'gear-not-on-hinge' && d.parts.every(p => lockedGears.has(p))) continue;
        diagnostics.push(d);
    }
    diagnostics.push(...detected.diagnostics);

    const replacements = new Map((detected.replacements || []).map(j=>[j.id,j]));
    const joints = [...jointsResult.joints.map(j=>replacements.get(j.id)||j), ...(detected.joints || []).map((j,i)=>({...j,id:'loop'+i}))];
    // A coupling detector may bound a joint's travel (kinds/rack.js: the pinion stays on the
    // rack's teeth): the joint keeps the narrower of its own limits and the coupling's.
    for (const {joint, limits} of detected.limits) {
        const j = joints.find(x => x.id === joint);
        if (!j) continue;
        j.limits = j.limits ? [Math.max(j.limits[0], limits[0]), Math.min(j.limits[1], limits[1])] : limits.slice();
    }
    // A detector may put a spring on a slider (kinds/shock.js): it pushes towards restM (m) with stiffness (N/m), damped.
    for (const {joint, restM, stiffness, damping} of detected.springs) {
        const j = joints.find(x => x.id === joint);
        if (j && j.type === 'slider') j.spring = {restM, stiffness, damping};
    }
    // Detected couplings get ids after the gears'; those of a kind the v1 contract has
    // (rackAndPinion) are in the v1 `gears` too, after the meshes (contracts.js mechanismV1Aliases).
    const detectedCouplings = detected.couplings.map((c, i) => ({...c, id: `c${i}`}));
    const gears = [...gearResult.gears, ...detectedCouplings.filter(c => V1_COUPLING_KINDS.includes(c.kind))
        .map(({id, kind, ...rest}) => ({id, type: kind, ...rest}))];

    // A model from elsewhere: each closed loop of hinges is broken with a ball joint (mech/loops.js).
    let loopBalls = [];
    if (opts.rescueLoose && opts.breakLoops !== false) {
        const named = JSON.stringify([gearResult.gears, gearResult.relative || [], detected.couplings]);
        const keep = new Set(joints.filter(j => j.motor || j.limits || j.spring || named.includes(`"${j.id}"`)).map(j => j.id));
        const massOf = id => islands.bodies.find(b => b.id === id)?.massKg ?? Infinity;
        const broken = breakHingeLoops(joints, {keep, massOf});
        joints.splice(0, joints.length, ...broken.joints);
        loopBalls = broken.balls;
    }
    // A model from elsewhere: a hinge nothing drives, limits or couples turns with a pin's friction
    // (FOREIGN_FREE_HINGE_NM). Frictionless, a light arm hit by its neighbours spun up until the solver flung it.
    // Not a wheel's (it rolls), not one on a motor (a train motor's idler axles are its own free joints), and not one on
    // a body a coupling moves (a CV joint's hub is driven through it).
    const freeNm = opts.rescueLoose ? (opts.freeHingeFrictionNm ?? FOREIGN_FREE_HINGE_NM) : 0;
    if (freeNm > 0) {
        const named = JSON.stringify([gearResult.gears, gearResult.relative || [], detected.couplings]);
        const partOf = new Map(model.parts.map(p => [p.id, p.part]));
        const rolls = meta => meta && (meta.category === 'wheel' || meta.category === 'motor' || Boolean(meta.device));
        const wheels = new Set(islands.bodies.filter(b => b.parts.some(id => rolls(catalogMap.get(partOf.get(id))))).map(b => b.id));
        const driven = j => named.includes(`"${j.id}"`) || named.includes(`"${j.body1}"`) || named.includes(`"${j.body2}"`);
        for (const j of joints) {
            if (j.type !== 'hinge' || j.motor || j.limits || j.spring || j.frictionNm !== undefined) continue;
            if (driven(j) || wheels.has(j.body1) || wheels.has(j.body2)) continue;
            j.frictionNm = freeNm;
        }
    }

    // Loose parts: bodies that no joint links, directly or through other bodies, to the
    // body carrying the hub (or, without a hub, to the largest connected group). They are
    // not held by the robot: they fall off or lie where they are.
    // Ropes and universal joints physically retain their endpoint bodies too.
    const retainingLinks = structuralCouplingLinks(detected.couplings);
    for (const group of looseGroups(islands.bodies, [...joints, ...retainingLinks], catalogMap, nodes)) {
        diagnostics.push({severity: 'warning', code: 'loose-part', message: `Not connected to the rest of the model: ${group.join(', ')}`, parts: group});
    }

    // A tread's sprockets meet the floor at the tread's outer face (kinds/chain.js `wheels`): a
    // cylinder of that radius on the sprocket's body, with the tread's grip; before the ground,
    // which goes under the lowest collider.
    for (const w of detected.wheels) {
        const body = islands.bodies.find(b => b.id === w.islandId);
        if (!body) continue;
        const axis = dirToWorld(w.axisLdu);
        // the cylinder's own axis is y: the shortest turn from y onto the sprocket's axis
        const q = Math.abs(axis[1] + 1) < 1e-9 ? [1, 0, 0, 0] : quatNormalize([axis[2], 0, -axis[0], 1 + axis[1]]);
        const c = lduToWorld(w.centerLdu).map((v, i) => v - body.position[i]);
        body.colliders.push({shape: 'cylinder', radius: w.radiusLdu * LDU_M, halfHeight: Math.max(w.halfWidthLdu, 1) * LDU_M,
            position: c, rotation: q, part: w.part, massKg: TREAD_WHEEL_MASS_KG});
        body.friction = Math.max(body.friction ?? 0, w.friction);
        // A tread's links meet the floor: they bounce and roll like a tread (contracts.js MATERIALS.tread).
        body.material = 'tread';
        body.restitution = MATERIALS.tread.restitution;
        body.rollingResistance = MATERIALS.tread.rollingResistance;
    }

    // Bodies final list: islands.bodies plus ground
    const bodies = [...islands.bodies];
    if (opts.ground !== false) {
        const ground = makeGround(bodies, opts);
        // Insert ground first to match example ordering (ground first)
        bodies.unshift(ground);
    }

    // Obstacles: each becomes a STATIC body sitting on the floor (bottom at ground top)
    if (Array.isArray(opts.obstacles)) {
        const seenIds = new Set();
        let groundTop = 0;
        if (bodies.length > 0) {
            const g = bodies.find(b => b.id === 'ground');
            if (g) groundTop = g.position[1] + 0.01;
            else {
                // No ground? Use lowest as 0 fallback already
                groundTop = 0;
            }
        }
        for (const obs of opts.obstacles) {
            const id = obs && typeof obs.id === 'string' ? obs.id : '';
            let bad = null;
            if (!id) bad = `obstacle id missing`;
            else if (seenIds.has(id)) bad = `duplicate obstacle id '${id}'`;
            else if (obs.shape !== 'box') bad = `obstacle '${id}' shape must be 'box'`;
            else if (!Array.isArray(obs.size) || obs.size.length !== 3 || !obs.size.every(v => typeof v === 'number' && Number.isFinite(v) && v > 0)) bad = `obstacle '${id}' size must be three positive numbers`;
            else if (!Array.isArray(obs.position) || obs.position.length !== 3 || !obs.position.every(v => typeof v === 'number' && Number.isFinite(v))) bad = `obstacle '${id}' position must be Vec3`;
            else if (obs.yawDeg !== undefined && !(typeof obs.yawDeg === 'number' && Number.isFinite(obs.yawDeg))) bad = `obstacle '${id}' yawDeg must be a number`;
            else if (obs.color !== undefined && !(Number.isInteger(obs.color) && obs.color >= 0 && obs.color <= 10)) bad = `obstacle '${id}' color must be 0..10`;
            // Also check size positive already, but also need to check duplicate id tracking even if bad due to other reason? We already.
            if (bad) {
                diagnostics.push({severity: 'error', code: 'bad-obstacle', message: bad, parts: []});
                if (id) seenIds.add(id);
                continue;
            }
            // Valid: record id
            seenIds.add(id);
            const size = obs.size;
            const pos = obs.position;
            const yawDeg = obs.yawDeg || 0;
            const yawRad = yawDeg * Math.PI / 180;
            const half = yawRad / 2;
            const qy = Math.sin(half);
            const qw = Math.cos(half);
            // rotation about Y: [0, sin(yaw/2), 0, cos(yaw/2)]
            const rot = [0, qy, 0, qw];
            const h = size[1];
            const bottomY = groundTop + pos[1];
            const centerY = bottomY + h / 2;
            const body = {
                id: `obstacle:${id}`,
                motion: 'static',
                position: [pos[0], centerY, pos[2]],
                rotation: rot,
                massKg: 0,
                colliders: [{shape: 'box', halfExtents: [size[0] / 2, size[1] / 2, size[2] / 2]}],
                parts: [],
                material: GROUND_MATERIAL, // a wall of the arena: rigid, as the floor
            };
            if (obs.color !== undefined) body.color = obs.color;
            bodies.push(body);
        }
    }

    // Loads (world/objects.js, §5.5): DYNAMIC world bodies the model moves by contact (a pallet),
    // standing on the floor like the obstacles; a mat carries them as it carries its obstacles.
    if (Array.isArray(opts.loads)) {
        const ground = bodies.find(b => b.id === 'ground');
        const groundTop = ground ? ground.position[1] + 0.01 : 0;
        const seenIds = new Set();
        for (const load of opts.loads) {
            const problems = validateLoad(load);
            if (!problems.length && seenIds.has(load.id)) problems.push(`duplicate load id '${load.id}'`);
            if (load && typeof load.id === 'string') seenIds.add(load.id);
            if (problems.length) {
                diagnostics.push({severity: 'error', code: 'bad-load', message: problems.join('; '), parts: []});
                continue;
            }
            bodies.push(loadBody(load, groundTop));
        }
    }

    // Sort bodies deterministically: ground first (if present), then b0,b1... already sorted by smallest part id, but ground is 'ground' should stay first.
    // Our islands bodies are already b0... sorted. We'll keep ground at front.

    // Sort joints already deterministic from buildJoints (j0..), gears deterministic.

    // Sensors: from placed parts whose catalog entry has a sensor.
    const sensors = [];
    const sensorParts = new Map(); // a sensor entry -> {part, device, ref}
    for (const pl of knownParts) {
        const sensor = partSensor(catalogMap.get(pl.part));
        if (!sensor) continue;
        const ref = portRefOf(pl);
        if (!ref) {
            diagnostics.push({severity: 'warning', code: 'sensor-without-port', message: 'Sensor ' + pl.id + ' has no port', parts: [pl.id]});
            continue;
        }
        let bodyId = islands.nodeToBody.get(pl.id);
        if (!bodyId) bodyId = islands.nodeToBody.get(pl.id + '#out');
        if (!bodyId) continue;
        const lduOrigin = vecAdd(mat3MulVec3(pl.rotation, sensor.probe.origin), pl.position);
        const worldOrigin = lduToWorld(lduOrigin);
        const lduDir = mat3MulVec3(pl.rotation, sensor.probe.direction);
        const worldDir = dirToWorld(lduDir);
        const entry = {port: ref.port, kind: sensor.device.sensor.kind, body: bodyId, origin: worldOrigin, direction: worldDir};
        sensors.push(entry);
        sensorParts.set(entry, {part: pl.id, device: sensor.device, ref});
    }
    sensors.sort((a, b) => a.port.localeCompare(b.port));

    // v2: the model's hubs, and what each motor and sensor plugs into ({hub, port}).
    const v2 = opts.version === 2
        ? bindings(model, knownParts, catalogMap, bodies, jointsResult.jointEntries, sensors, sensorParts, diagnostics, islands.nodeToBody) : null;

    // Diagnostics: ensure deterministic order? Sort by code then message
    diagnostics.sort((a, b) => {
        let c = a.code.localeCompare(b.code);
        if (c !== 0) return c;
        c = a.severity.localeCompare(b.severity);
        if (c !== 0) return c;
        c = (a.message || '').localeCompare(b.message || '');
        if (c !== 0) return c;
        return 0;
    });

    const mechanism = {
        version: 1,
        gravity: [0, -9.81, 0],
        bodies,
        joints,
        gears,
        diagnostics,
    };
    if (sensors.length > 0) mechanism.sensors = sensors;

    if (model.internalEdgeRemovalPairs?.length) {
        const bodyFor = part => {
            const matches = bodies.filter(b => b.parts.includes(part));
            if (matches.length !== 1) throw new RangeError(`internalEdgeRemovalPairs: '${part}' must name one compiled body`);
            return matches[0].id;
        };
        mechanism.internalEdgeRemovalPairs = model.internalEdgeRemovalPairs.map(pair => pair.map(bodyFor));
        const invalid = validateInternalEdgeRemovalPairs(mechanism.internalEdgeRemovalPairs, new Set(bodies.map(b => b.id)), 'internalEdgeRemovalPairs');
        if (invalid.length) throw new RangeError(invalid.join('; '));
    }
    const problemsOut = validateCompiledMechanism(mechanism);
    if (problemsOut.length > 0) {
        throw new Error(`compile produced invalid mechanism: ${problemsOut.join('; ')}`);
    }
    // Only an opted-in model carries the rotor setting: legacy mechanisms stay byte-identical.
    if (model.rotor === 'native') mechanism.rotor = 'native';
    if (model.solver === 'light-links') mechanism.solver = {lightLinks: {...AUTHORED_LIGHT_LINKS}};
    if (!v2) return mechanism;

    // Meshes relative to a frame that is not both hinges' (mech/gears.js, gearbox lane): v2 only.
    const relativeCouplings = (gearResult.relative || []).map(({type, ...rest}, i) => ({id: `r${i}`, kind: type, ...rest}));
    const couplings = [...gearResult.gears.map(({id, type, ...rest}) => ({id, kind: type, ...rest})), ...relativeCouplings, ...detectedCouplings];
    const mechanismV2 = {...mechanism, version: 2, bodies: withBodyRoles(mechanism.bodies), hubs: v2.hubs, actuators: v2.actuators,
        couplings, devices: v2.devices, noCollide: noCollidePairs(joints, couplings, kinds,
            [...seatedBodyPairs(graphEdges, islands), ...sharedAxisBodyPairs(graphEdges, islands)])};
    const slidingPairs = kinds.couplings.detectors().flatMap(module => module.collisionPairs?.({nodes, islands}) || []);
    const local = opts.rescueLoose ? [] : localNoCollide(mechanismV2.bodies, joints, mechanismV2.noCollide, couplingBodyPairs(joints, couplings, kinds), graphEdges, islands, nodes, slidingPairs);
    if (local.length) mechanismV2.noCollideParts = local;
    // A model from elsewhere: its light links solve with more iterations (FOREIGN_LIGHT_LINKS, physics/jolt-core.js);
    // every body pair a joint or a coupling relates, and every pair whose parts overlap as built (mech/collision-filter.js
    // asBuiltOverlaps), never collides — whole, not part by part. Our colliders are boxes: a beam's holes are solid,
    // so an axle swinging through them as the set means it to hits solid collider and is shot out (the 4x4 Off-Roader
    // went to NaN within 2 s with its motors coasting; 42131 and 42055 at 0.5–2 s a step). A real set is built so its
    // jointed parts do not collide; filtered whole, they do not, and no shape filter runs at all (3x faster steps).
    if (opts.rescueLoose) {
        mechanismV2.solver = {lightLinks: {...FOREIGN_LIGHT_LINKS}, maxLinearVelocity: FOREIGN_MAX_SPEED_M_S, ...(loopBalls.length ? {loopBalls} : {})};
        const pairs = new Set(mechanismV2.noCollide.map(([a, b]) => `${a}|${b}`));
        for (const [a, b] of asBuiltOverlaps(mechanismV2.bodies, mechanismV2.noCollide, [])) {
            if (!pairs.has(`${a}|${b}`)) { mechanismV2.noCollide.push([a, b]); pairs.add(`${a}|${b}`); }
        }
        mechanismV2.noCollide.sort((x, y) => (x[0] + '|' + x[1] < y[0] + '|' + y[1] ? -1 : 1));
        delete mechanismV2.noCollideParts;
    }
    if (model.solver === 'light-links') {
        mechanismV2.solver = {...mechanismV2.solver, lightLinks: {...AUTHORED_LIGHT_LINKS}};
    }
    const problemsV2 = validateCompiledMechanism(mechanismV2, {kinds});
    if (problemsV2.length > 0) {
        throw new Error(`compile produced invalid mechanism v2: ${problemsV2.join('; ')}`);
    }
    return mechanismV2;
};

/** Body pairs a connector edge joins (a shaft seated in a hole of another body, a motor's housing and output). */
const seatedBodyPairs = (edges, islands) => {
    const out = [];
    for (const e of edges) {
        const a = islands.nodeToBody.get(e._aNode || e.a.part);
        const b = islands.nodeToBody.get(e._bNode || e.b.part);
        if (a && b && a !== b) out.push([a, b]);
    }
    return out;
};

/** Every registered coupling detector, in registration order (registry/kinds.js CouplingKindRegistry). */
const detectCouplings = (kinds, ctx) => {
    const out = {couplings: [], welds: [], diagnostics: [], limits: [], wheels: [], springs: [], joints: [], replacements: []};
    for (const module of kinds.couplings.detectors()) {
        const r = module.detect({...ctx,couplings:out.couplings}) || {};
        for (const c of r.couplings || []) out.couplings.push({...c, kind: module.kind});
        out.welds.push(...(r.welds || []));
        out.diagnostics.push(...(r.diagnostics || []));
        out.limits.push(...(r.limits || []));
        out.wheels.push(...(r.wheels || []));
        out.springs.push(...(r.springs || []));
        out.joints.push(...(r.joints || []));
        out.replacements.push(...(r.replacements || []));
    }
    return out;
};

/**
 * CompiledMechanism v2's bindings: the hubs (hub parts in body order — hubs[0] is the hub
 * a port without one means, the one hubsOf picks), an actuator per motorised joint and a
 * device per sensor, each on {hub, port}. A port naming a part that is no hub is a warning
 * and plugs into the first hub.
 */
const bindings = (model, knownParts, catalogMap, bodies, jointEntries, sensors, sensorParts, diagnostics, nodeToBody = new Map()) => {
    const profiles = new Map();
    for (const pl of knownParts) {
        const profile = partHubProfile(catalogMap.get(pl.part));
        if (profile) profiles.set(pl.id, profile);
    }
    const hubs = [];
    // A hub with built-in motors (the BOOST Move Hub) is on several bodies: it is carried by its housing's.
    const seen = new Set();
    for (const b of bodies) {
        for (const id of b.parts) {
            if (!profiles.has(id) || seen.has(id)) continue;
            const housing = nodeToBody.get(id);
            if (housing && housing !== b.id) continue;
            seen.add(id);
            hubs.push({id, profile: profiles.get(id), body: b.id});
        }
    }
    const firstHub = hubs.length ? hubs[0].id : null;
    const hubOf = (ref, partId) => {
        if (ref.hub === null || ref.hub === undefined) return firstHub;
        if (profiles.has(ref.hub)) return ref.hub;
        diagnostics.push({severity: 'warning', code: 'port-hub-unknown', message: `${partId} plugs into '${ref.hub}', which is not a hub; it uses the first hub`, parts: [partId]});
        return firstHub;
    };
    const actuators = [];
    for (const {joint, members} of jointEntries) {
        if (!joint.motor) continue;
        const member = members.find(m => m.edge && m.edge.actuator);
        const ref = member ? member.edge.actuator.port : {hub: null, port: joint.motor.port};
        const partId = member ? member.edge.a.part : joint.id;
        actuators.push({id: `a${actuators.length}`, joint: joint.id, hub: hubOf(ref, partId), port: joint.motor.port,
            device: member ? member.edge.actuator.device : null, sign: 1, maxTorqueNm: joint.motor.maxTorqueNm,
            maxSpeedRadPerSec: joint.motor.maxSpeedRadPerSec, ids: Number.isInteger(joint.motor.deviceId) ? {lpf2: joint.motor.deviceId} : {}});
    }
    const devices = sensors.map((s, i) => {
        const {part, device, ref} = sensorParts.get(s);
        return {id: `d${i}`, part, device: device.id, class: device.class, hub: hubOf(ref, part), port: s.port, body: s.body,
            ids: {...device.ids}, sensor: s.kind, probe: {kind: 'ray', origin: s.origin, direction: s.direction}};
    });
    return {hubs, actuators, devices};
};
