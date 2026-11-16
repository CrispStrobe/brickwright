// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// The Sim Lab with its physics in a Web Worker (ROADMAP §4.9, docs/SIM-LAB-PLAN.md
// "§4.9 The physics worker"; generalised to any hub in docs/ROBOT-LAB-ARCHITECTURE.md
// §3.4, §6.5). Both sides of one batch live here; physics/physics-host.js carries
// the messages and sim-session.js decides when to send them. This module sits
// beside hub-bridge.js, not under physics/: it is where hubs and physics meet,
// and physics/ imports no hub (test/bw-sim-hub-boundary.test.mjs).
//
// WHO OWNS WHAT. The hubs and their controllers stay on the main thread (they are
// "main-resident", §3.4): the VM reads and writes them synchronously, and a
// run-for-degrees promise has to finish there. The physics core runs in the
// worker. Within one 5 ms step the two are a closed loop (the hub's drive moves the
// hinge, the hinge's angle is the next step's encoder), so a batch of N steps
// cannot be split across the message boundary without adding a step of latency to
// every encoder reading.
//
// THE PROTOCOL (one batch = the steps one tick() makes due):
//
//   load            {mechanism, hubs: [{id, profile, body}], stepMs}: the worker
//                   creates a MIRROR VirtualHub of each profile (hub registry)
//   main → worker   {steps, hubs: {id: hub.exportState()}}
//   worker          checkpoint the physics and the bridge; import each hub's state
//                   into its mirror; run the very same SimHubBridge.step() N times —
//                   route, drives, physics step, encoders, pose, sensor probes —
//                   recording each step's FRAME {t, hubs: {id: {drives, readings, pose}}}
//   worker → main   {frames, poses after the last step}
//   main            if every hub's state is still the one sent (stateKey): replay —
//                   each REAL hub advances once per frame (its waits and promises
//                   finish on their step), must choose the drives the mirror chose,
//                   and is given the frame's readings exactly as the in-thread
//                   bridge gives them; then one publish() per hub.
//                   If something changed a hub while the batch was in flight (the VM
//                   set a motor, the drive pad, Pause): ask for the batch AGAIN from
//                   the checkpoint with the new state ({redo}). In-thread, that
//                   command would have reached the hub before this tick, so the
//                   redone batch is what in-thread gives.
//
// So the worker computes exactly the in-thread sequence of operations, on the
// same numbers: the results are bit-identical (test/bw-sim-physics-worker-session.test.mjs).
// The cost is one round trip of latency between a tick and its result reaching the
// hubs and the view — the clock the hubs and the VM see does not advance meanwhile.

import {collectFixedObservations, observationSelection} from './measurements/precision.js';
import {collectStartupDiagnostic, startupDiagnosticSelection} from './measurements/startup-diagnostic.js';
import {SimHubBridge} from './hub-bridge.js';
import {hubRegistry} from './hubs/index.js';

const copyObservation = value => value == null ? null : JSON.parse(JSON.stringify(value));

/**
 * Every body's pose and every joint's state (a hinge's angle and rate, a slider's position
 * and rate; a ball joint: zeros), in the core's snapshot order, at full
 * precision (the core's own snapshot() is Float32; the mirror on the main thread
 * answers bodyPose/jointState with the doubles the in-thread core would return).
 */
export const posesOf = (core, mechanism, observations = null) => {
    const bodies = new Float64Array(mechanism.bodies.length * 7);
    mechanism.bodies.forEach((b, i) => {
        const {position, rotation} = core.bodyPose(b.id);
        bodies.set(position, i * 7);
        bodies.set(rotation, i * 7 + 3);
    });
    // Observational telemetry travels with the accepted batch, including after a redo.
    const linear = new Float64Array(mechanism.bodies.length * 3);
    const angular = new Float64Array(mechanism.bodies.length * 3);
    const rolling = {};
    mechanism.bodies.forEach((b, i) => {
        linear.set(core.bodyLinearVelocity ? core.bodyLinearVelocity(b.id) : [NaN, NaN, NaN], i * 3);
        angular.set(core.bodyAngularVelocity ? core.bodyAngularVelocity(b.id) : [NaN, NaN, NaN], i * 3);
        const wheel = core.rollingWheel ? core.rollingWheel(b.id) : null;
        if (wheel) rolling[b.id] = {...wheel};
    });
    const ropes = core.ropeState ? core.ropeState() : [];
    const joints = new Float64Array(mechanism.joints.length * 2);
    mechanism.joints.forEach((j, i) => {
        if (j.type === 'hinge') {
            const {angle, velocity} = core.jointState(j.id);
            joints[i * 2] = angle;
            joints[i * 2 + 1] = velocity;
        } else if (j.type === 'slider') {
            const {position, velocity} = core.jointState(j.id);
            joints[i * 2] = position;
            joints[i * 2 + 1] = velocity;
        }
    });
    // Each air network's pressure (physics/air.js), for the pane's readout.
    const bodyDynamics = Object.fromEntries(mechanism.bodies.map(b => [b.id, core.bodyDynamics ? core.bodyDynamics(b.id) : null]));
    const jointDynamics = Object.fromEntries(mechanism.joints.map(j => [j.id, core.jointDynamics ? core.jointDynamics(j.id) : null]));
    const screws = observations?.screws && typeof core.screwState === 'function' ? core.screwState() : null;
    const contacts = observations?.contacts && mechanism.bodies.length <= 128 && typeof core.currentContactPairs === 'function' ? core.currentContactPairs() : null;
    return {t: core.time, bodies, joints, linear, angular, rolling, ropes, bodyDynamics, jointDynamics, screws, contacts, air: core.airState ? core.airState() : []};
};

/**
 * The worker's side: one scene, its bridge to mirror hubs, and batches.
 * @param {object} options
 * @param {object} options.J the Jolt namespace
 * @param {Function} options.createPhysicsCore physics/jolt-core.js's
 * @param {object} options.mechanism a CompiledMechanism
 * @param {{id: string, profile: string, body: string}[]} options.hubs the scene's hubs (empty: a model without one)
 * @param {number} options.stepMs the fixed step (hub-bridge.js STEP_MS)
 * @param {object} [options.registry] the hub registry the mirrors come from (default: the built-in families)
 */
export const createSimRunner = ({J, createPhysicsCore, mechanism, hubs = [], stepMs, registry = hubRegistry}) => {
    const core = createPhysicsCore(J, mechanism, {stepHz: 1000 / stepMs});
    const mirrors = hubs.map(({id, profile, body}) => ({hub: registry.create(profile, {id}), body}));
    const bridge = mirrors.length ? new SimHubBridge({hubs: mirrors, core, mechanism, stepMs}) : null;
    let saved = null;
    return {
        core,
        poses: () => posesOf(core, mechanism),
        /** The sensors' readings at t = 0 by hub id (the main thread's hubs show them before the first batch). */
        readings: () => (bridge ? bridge.initialReadings() : {}),
        /**
         * @param {{steps?: number, ticks?: number[], hubs?: object, redo?: boolean}} batch
         *        steps (with hubs: their exported states by id) or the ticks' ms (without
         *        a hub: the core steps them as the in-thread session does); redo: from the
         *        last batch's checkpoint again
         */
        run ({steps = 0, ticks = [], hubs: states = {}, redo = false, observation = null, startupDiagnostic = null}) {
            observation = observationSelection(observation, mechanism);
            const diagnosticSelection = startupDiagnostic == null ? null : startupDiagnosticSelection(startupDiagnostic, mechanism);
            if (redo) {
                core.rollback();
                if (bridge) bridge.restoreState(saved);
            } else {
                core.checkpoint();
                saved = bridge ? bridge.saveState() : null;
            }
            const frames = [];
            const collector = collectFixedObservations(core, mechanism, observation);
            let diagnostic = null;
            try {
                if (diagnosticSelection) diagnostic = collectStartupDiagnostic(core, diagnosticSelection);
                if (bridge) {
                    for (const {hub} of mirrors) hub.importState(states[hub.id]);
                    for (let i = 0; i < steps; i++) frames.push(bridge.step());
                } else {
                    for (const ms of ticks) core.step(ms / 1000);
                }
                return {frames, ...posesOf(core, mechanism, observation), observations: collector.take(),
                    ...(diagnostic ? {startupDiagnostic: diagnostic.take()} : {})};
            } finally { diagnostic?.detach(); collector.detach(); }
        },
        destroy: () => core.destroy()
    };
};

/**
 * The main thread's view of the worker's core: the poses after the last applied
 * batch, through the same calls the in-thread core answers (the 3D view, the pane,
 * the browser gate's instruments). What only the physics can answer — a ray, a
 * step — is not here: those run in the worker, inside the step they belong to.
 */
export class MirrorCore {
    constructor (mechanism, poses) {
        this.bodyIds = mechanism.bodies.map(b => b.id);
        this.jointIds = mechanism.joints.map(j => j.id);
        this.bodyIndex = new Map(this.bodyIds.map((id, i) => [id, i]));
        this.jointIndex = new Map(this.jointIds.map((id, i) => [id, i]));
        this.hinges = new Set(mechanism.joints.filter(j => j.type === 'hinge').map(j => j.id));
        this.sliders = new Set(mechanism.joints.filter(j => j.type === 'slider').map(j => j.id));
        this.update(poses);
    }

    update ({t, bodies, joints, air = [], linear = null, angular = null, rolling = {}, ropes = [], bodyDynamics = {}, jointDynamics = {}, screws = null, contacts = null}) {
        this.t = t;
        this.bodies = bodies;
        this.joints = joints;
        this.air = air;
        this.linear = linear; this.angular = angular;
        this.rolling = rolling; this.ropes = ropes;
        this.screws = copyObservation(screws); this.contacts = copyObservation(contacts);
        this.bodyObservations = copyObservation(bodyDynamics); this.jointObservations = copyObservation(jointDynamics);
    }

    /** Each air network's pressure, as the worker's core last had it. */
    airState () { return this.air; }

    get time () { return this.t; }

    snapshot () {
        return {t: this.t, bodyIds: [...this.bodyIds], jointIds: [...this.jointIds],
            bodies: Float32Array.from(this.bodies), joints: Float32Array.from(this.joints)};
    }

    bodyPose (bodyId) {
        const i = this.bodyIndex.get(bodyId);
        if (i === undefined) throw new Error(`unknown body ${bodyId}`);
        const b = this.bodies;
        return {position: [b[i * 7], b[i * 7 + 1], b[i * 7 + 2]], rotation: [b[i * 7 + 3], b[i * 7 + 4], b[i * 7 + 5], b[i * 7 + 6]]};
    }

    bodyDynamics (bodyId) {
        if (!this.bodyIndex.has(bodyId)) throw new Error(`unknown body ${bodyId}`);
        return Object.hasOwn(this.bodyObservations, bodyId) ? copyObservation(this.bodyObservations[bodyId]) : null;
    }
    jointDynamics (jointId) {
        if (!this.jointIndex.has(jointId)) throw new Error(`unknown joint ${jointId}`);
        return Object.hasOwn(this.jointObservations, jointId) ? copyObservation(this.jointObservations[jointId]) : null;
    }
    screwState () { return copyObservation(this.screws); }
    currentContactPairs () { return copyObservation(this.contacts); }
    bodyLinearVelocity (bodyId) { return this._velocity(this.linear, bodyId); }
    bodyAngularVelocity (bodyId) { return this._velocity(this.angular, bodyId); }
    _velocity (values, bodyId) {
        const i = this.bodyIndex.get(bodyId);
        if (i === undefined) throw new Error(`unknown body ${bodyId}`);
        if (!values) throw new Error('velocity telemetry unavailable');
        return Array.from(values.slice(i * 3, i * 3 + 3));
    }
    rollingWheel (bodyId) { return this.rolling[bodyId] ? {...this.rolling[bodyId]} : null; }
    ropeState () { return this.ropes.map(r => ({...r})); }

    jointState (jointId) {
        const i = this.jointIndex.get(jointId);
        if (i === undefined) throw new Error(`unknown joint ${jointId}`);
        if (this.sliders.has(jointId)) return {position: this.joints[i * 2], velocity: this.joints[i * 2 + 1]};
        if (!this.hinges.has(jointId)) throw new Error(`joint ${jointId} is not a hinge or a slider`);
        return {angle: this.joints[i * 2], velocity: this.joints[i * 2 + 1]};
    }

    castRay () { throw new Error('the physics runs in the worker: rays are cast there, inside the step they belong to'); }

    step () { throw new Error('the physics runs in the worker: SimSession.tick() steps it'); }

    setMotor () { throw new Error('the physics runs in the worker: motors are driven through the hubs\' ports'); }

    destroy () {}
}
