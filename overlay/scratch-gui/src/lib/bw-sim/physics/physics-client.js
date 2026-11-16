// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// Main-thread client for the physics worker. Wraps a Worker-like port
// with postMessage/onmessage and correlates replies by id. Also exports
// interpolate() for rendering between snapshots. The worker itself is started
// by sim-lab.js (startPhysicsWorker): its entry wires the hub families in, and
// physics/ imports no hub.

/**
 * Linear interpolation for positions, nlerp for quaternions, linear for joint angles.
 * @param {{t:number, bodies:Float32Array, joints:Float32Array}} prev
 * @param {{t:number, bodies:Float32Array, joints:Float32Array}} next
 * @param {number} alpha 0..1
 * @returns {{t:number, bodies:Float32Array, joints:Float32Array}}
 */
export const interpolate = (prev, next, alpha) => {
    const t = prev.t + (next.t - prev.t) * alpha;
    const bodies = new Float32Array(prev.bodies.length);
    for (let i = 0; i < prev.bodies.length; i += 7) {
        // positions lerp
        bodies[i] = prev.bodies[i] + (next.bodies[i] - prev.bodies[i]) * alpha;
        bodies[i + 1] = prev.bodies[i + 1] + (next.bodies[i + 1] - prev.bodies[i + 1]) * alpha;
        bodies[i + 2] = prev.bodies[i + 2] + (next.bodies[i + 2] - prev.bodies[i + 2]) * alpha;
        // quaternions nlerp
        let qx1 = prev.bodies[i + 3], qy1 = prev.bodies[i + 4], qz1 = prev.bodies[i + 5], qw1 = prev.bodies[i + 6];
        let qx2 = next.bodies[i + 3], qy2 = next.bodies[i + 4], qz2 = next.bodies[i + 5], qw2 = next.bodies[i + 6];
        // shortest arc: flip if dot <0
        let dot = qx1 * qx2 + qy1 * qy2 + qz1 * qz2 + qw1 * qw2;
        if (dot < 0) { qx2 = -qx2; qy2 = -qy2; qz2 = -qz2; qw2 = -qw2; dot = -dot; }
        let qx = qx1 + (qx2 - qx1) * alpha;
        let qy = qy1 + (qy2 - qy1) * alpha;
        let qz = qz1 + (qz2 - qz1) * alpha;
        let qw = qw1 + (qw2 - qw1) * alpha;
        const len = Math.hypot(qx, qy, qz, qw) || 1;
        qx /= len; qy /= len; qz /= len; qw /= len;
        bodies[i + 3] = qx; bodies[i + 4] = qy; bodies[i + 5] = qz; bodies[i + 6] = qw;
    }
    const joints = new Float32Array(prev.joints.length);
    for (let i = 0; i < joints.length; i++) {
        joints[i] = prev.joints[i] + (next.joints[i] - prev.joints[i]) * alpha;
    }
    return { t, bodies, joints };
};

/**
 * Physics client for the main thread.
 */
export class PhysicsClient {
    /**
     * @param {{postMessage: (msg:any, transfer?:Transferable[])=>void, onmessage?:any, addEventListener?:any, on?:any}} port
     */
    constructor(port) {
        this._port = port;
        this._nextId = 1;
        this._pending = new Map();
        const onMessage = e => {
            const msg = e?.data ?? e;
            if (!msg || typeof msg.id === 'undefined') return;
            const pending = this._pending.get(msg.id);
            if (!pending) return;
            this._pending.delete(msg.id);
            if (msg.type === 'error') {
                pending.reject(new Error(msg.message ?? 'physics error'));
            } else {
                pending.resolve(msg);
            }
        };
        // A worker whose script failed to load, or that died, answers nothing: fail
        // every request instead of leaving it pending (the session then falls back).
        // Unreadable replies likewise cannot be correlated to a request, so a
        // messageerror must fail the whole connection rather than strand a batch.
        const onError = e => {
            const error = new Error(e?.message || 'the physics worker failed');
            for (const pending of this._pending.values()) pending.reject(error);
            this._pending.clear();
            this.failed = error;
        };
        if (typeof port.addEventListener === 'function') {
            port.addEventListener('message', onMessage);
            port.addEventListener('error', onError);
            port.addEventListener('messageerror', onError);
        } else if (typeof port.on === 'function') {
            port.on('message', onMessage);
            port.on('error', onError);
            port.on('messageerror', onError);
        } else {
            port.onmessage = onMessage;
            port.onerror = onError;
            port.onmessageerror = onError;
        }
        this.failed = null;
    }

    _request(msg, transfer) {
        if (this.failed) return Promise.reject(this.failed);
        const id = this._nextId++;
        msg.id = id;
        return new Promise((resolve, reject) => {
            this._pending.set(id, { resolve, reject });
            try {
                if (transfer) this._port.postMessage(msg, transfer);
                else this._port.postMessage(msg);
            } catch (err) {
                this._pending.delete(id);
                reject(err);
            }
        });
    }

    /**
     * Load a mechanism.
     * @param {any} mechanism
     * @param {{stepHz?:number}} [opts]
     * @returns {Promise<{bodyIds:string[], jointIds:string[]}>}
     */
    async load(mechanism, { stepHz } = {}) {
        const reply = await this._request({ type: 'load', mechanism, stepHz });
        if (reply.type !== 'loaded') throw new Error(reply.message ?? 'load failed');
        return { bodyIds: reply.bodyIds, jointIds: reply.jointIds };
    }

    /**
     * Step the simulation.
     * @param {number} dtSeconds
     * @param {{joint:string, cmd:any}[]} [motors]
     * @returns {Promise<{t:number, bodies:Float32Array, joints:Float32Array}>}
     */
    async step(dtSeconds, motors) {
        const reply = await this._request({ type: 'step', dtSeconds, motors: motors ?? [] });
        if (reply.type !== 'snapshot') throw new Error(reply.message ?? 'step failed');
        return { t: reply.t, bodies: reply.bodies, joints: reply.joints };
    }

    /**
     * Reset to t=0.
     * @returns {Promise<{bodyIds:string[], jointIds:string[]}>}
     */
    async reset() {
        const reply = await this._request({ type: 'reset' });
        if (reply.type !== 'loaded') throw new Error(reply.message ?? 'reset failed');
        return { bodyIds: reply.bodyIds, jointIds: reply.jointIds };
    }

    /**
     * Load a Sim Lab scene (../sim-worker-protocol.js): the physics and the hub bridge's
     * mirror hubs. Resolves to the poses and the hubs' readings at t = 0 (by hub id) and
     * the scene's id (batches name it).
     * @param {{mechanism: object, hubs: {id: string, profile: string, body: string}[], stepMs: number}} scene
     * @returns {Promise<{scene: number, t: number, bodies: Float64Array, joints: Float64Array, air: object[], readings: object}>}
     */
    async simLoad({ mechanism, hubs = [], stepMs }) {
        const reply = await this._request({ type: 'sim-load', mechanism, hubs, stepMs });
        if (reply.type !== 'sim-loaded') throw new Error(reply.message ?? 'sim load failed');
        return { scene: reply.id, t: reply.t, bodies: reply.bodies, joints: reply.joints, air: reply.air ?? [], linear: reply.linear, angular: reply.angular, rolling: reply.rolling, ropes: reply.ropes, bodyDynamics: reply.bodyDynamics, jointDynamics: reply.jointDynamics, readings: reply.readings ?? {} };
    }

    /**
     * Run one batch of fixed steps.
     * @param {{scene: number, steps?: number, ticks?: number[], hubs?: object, redo?: boolean}} batch
     *        hubs: each hub's exportState() by hub id
     * @returns {Promise<{frames: object[], t: number, bodies: Float64Array, joints: Float64Array, air: object[], workMs: number}>}
     */
    async simBatch({ scene, steps = 0, ticks = [], hubs = {}, redo = false, observation = null, startupDiagnostic = null }) {
        const reply = await this._request({ type: 'sim-batch', scene, steps, ticks, hubs, redo, observation,
            ...(startupDiagnostic == null ? {} : {startupDiagnostic}) });
        if (reply.type !== 'sim-frames') throw new Error(reply.message ?? 'sim batch failed');
        return reply;
    }

    /** @param {number} scene @returns {Promise<void>} */
    async simDispose(scene) {
        await this._request({ type: 'sim-dispose', scene });
    }

    /** Stop the worker (the pane does, when it goes away). */
    terminate() {
        for (const pending of this._pending.values()) pending.reject(new Error('the physics worker was stopped'));
        this._pending.clear();
        this.failed = new Error('the physics worker was stopped');
        if (typeof this._port.terminate === 'function') this._port.terminate();
    }

    /**
     * Dispose the core.
     * @returns {Promise<void>}
     */
    async dispose() {
        const reply = await this._request({ type: 'dispose' });
        if (reply.type !== 'disposed' && reply.type !== 'error') throw new Error(reply.message ?? 'dispose failed');
    }
}
