// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// Pure message handler for the physics worker. No globals, no DOM.
// The host is created with {loadJolt, createPhysicsCore, post} and
// exposes handle(msg) which processes messages strictly in order via
// an internal promise chain. See task P2 for message types.
//
// The Sim Lab's messages (ROADMAP §4.9; the protocol is ../sim-worker-protocol.js,
// generic over hubs per docs/ROBOT-LAB-ARCHITECTURE.md §6.5):
//   sim-load  {mechanism, hubs: [{id, profile, body}], stepMs} -> sim-loaded {t, bodies, joints, air, readings}
//   sim-batch {scene, steps | ticks, hubs: {id: state}, redo}  -> sim-frames {frames, t, bodies, joints, air, workMs}
//   (air: each air network's pressure, physics/air.js)
//   sim-dispose {scene}                    -> disposed
// (a batch and a dispose name their scene: the id of the sim-load that made it)
// They need {createSimRunner} as well, injected: this module carries hub states and
// frames as opaque data and imports no hub.

/**
 * Create a physics host.
 * @param {object} opts
 * @param {() => Promise<any>} opts.loadJolt - async Jolt loader
 * @param {(J: any, mechanism: any, opts?: any) => any} opts.createPhysicsCore - core factory
 * @param {(msg: any, transfer?: Transferable[]) => void} opts.post - reply sender
 * @returns {{handle: (msg: any) => Promise<void>}}
 */
export const createPhysicsHost = ({ loadJolt, createPhysicsCore, createSimRunner = null, post }) => {
    let J = null;
    let core = null;
    let sim = null;
    /** The sim-load request id of the scene loaded now: batches and disposes name it, so a stale one is refused. */
    let simScene = null;
    const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    let lastMechanism = null;
    let lastStepHz = 120;
    let chain = Promise.resolve();

    const ensureJolt = async () => {
        if (!J) J = await loadJolt();
        return J;
    };

    const doHandle = async msg => {
        try {
            if (!msg || typeof msg.type !== 'string') {
                post({ type: 'error', id: msg?.id ?? null, message: 'unknown message type' });
                return;
            }
            switch (msg.type) {
                case 'load': {
                    const { id, mechanism, stepHz } = msg;
                    try {
                        if (core) {
                            try { core.destroy(); } catch (_) {}
                            core = null;
                        }
                        const jolt = await ensureJolt();
                        const hz = typeof stepHz === 'number' && Number.isFinite(stepHz) ? stepHz : 120;
                        const c = createPhysicsCore(jolt, mechanism, { stepHz: hz });
                        core = c;
                        lastMechanism = mechanism;
                        lastStepHz = hz;
                        const bodyIds = mechanism.bodies.map(b => b.id);
                        const jointIds = mechanism.joints.map(j => j.id);
                        post({ type: 'loaded', id, bodyIds, jointIds });
                    } catch (err) {
                        post({ type: 'error', id, message: err.message ?? String(err) });
                    }
                    break;
                }
                case 'step': {
                    const { id, dtSeconds, motors } = msg;
                    if (!core) {
                        post({ type: 'error', id, message: 'step before load' });
                        break;
                    }
                    try {
                        if (Array.isArray(motors)) {
                            for (const m of motors) {
                                if (!m || typeof m.joint !== 'string' || !m.cmd) continue;
                                core.setMotor(m.joint, m.cmd);
                            }
                        }
                        core.step(dtSeconds);
                        const snap = core.snapshot();
                        post({ type: 'snapshot', id, t: snap.t, bodies: snap.bodies, joints: snap.joints }, [snap.bodies.buffer, snap.joints.buffer]);
                    } catch (err) {
                        post({ type: 'error', id, message: err.message ?? String(err) });
                    }
                    break;
                }
                case 'reset': {
                    const { id } = msg;
                    try {
                        if (!lastMechanism) {
                            post({ type: 'error', id, message: 'reset before load' });
                            break;
                        }
                        if (core) {
                            try { core.destroy(); } catch (_) {}
                            core = null;
                        }
                        const jolt = await ensureJolt();
                        const c = createPhysicsCore(jolt, lastMechanism, { stepHz: lastStepHz });
                        core = c;
                        const bodyIds = lastMechanism.bodies.map(b => b.id);
                        const jointIds = lastMechanism.joints.map(j => j.id);
                        post({ type: 'loaded', id, bodyIds, jointIds });
                    } catch (err) {
                        post({ type: 'error', id, message: err.message ?? String(err) });
                    }
                    break;
                }
                case 'dispose': {
                    const { id } = msg;
                    try {
                        if (core) {
                            try { core.destroy(); } catch (_) {}
                            core = null;
                        }
                        lastMechanism = null;
                        post({ type: 'disposed', id });
                    } catch (err) {
                        post({ type: 'error', id, message: err.message ?? String(err) });
                    }
                    break;
                }
                case 'sim-load': {
                    const { id, mechanism, hubs, stepMs } = msg;
                    try {
                        if (!createSimRunner) throw new Error('this host has no Sim Lab runner');
                        if (sim) { try { sim.destroy(); } catch (_) {} sim = null; }
                        const jolt = await ensureJolt();
                        sim = createSimRunner({ J: jolt, createPhysicsCore, mechanism, hubs: hubs || [], stepMs });
                        simScene = id;
                        const { t, bodies, joints, air, linear, angular, rolling, ropes, bodyDynamics, jointDynamics } = sim.poses();
                        post({ type: 'sim-loaded', id, t, bodies, joints, air, linear, angular, rolling, ropes, bodyDynamics, jointDynamics, readings: sim.readings() }, [bodies.buffer, joints.buffer]);
                    } catch (err) {
                        post({ type: 'error', id, message: err.message ?? String(err) });
                    }
                    break;
                }
                case 'sim-batch': {
                    const { id } = msg;
                    if (!sim) {
                        post({ type: 'error', id, message: 'sim batch before sim load' });
                        break;
                    }
                    if (msg.scene !== simScene) {
                        post({ type: 'error', id, message: 'sim batch for a scene that is no longer loaded' });
                        break;
                    }
                    try {
                        const start = now();
                        const { frames, t, bodies, joints, air, linear, angular, rolling, ropes, bodyDynamics, jointDynamics, screws, contacts, observations, startupDiagnostic } = sim.run(msg);
                        post({ type: 'sim-frames', id, frames, t, bodies, joints, air, linear, angular, rolling, ropes, bodyDynamics, jointDynamics, screws, contacts, observations, workMs: now() - start,
                            ...(startupDiagnostic ? {startupDiagnostic} : {})}, [bodies.buffer, joints.buffer]);
                    } catch (err) {
                        post({ type: 'error', id, message: err.message ?? String(err) });
                    }
                    break;
                }
                case 'sim-dispose': {
                    const { id } = msg;
                    // Only the scene it names: a load that was given up on must not end the next one.
                    if (sim && msg.scene === simScene) { try { sim.destroy(); } catch (_) {} sim = null; simScene = null; }
                    post({ type: 'disposed', id });
                    break;
                }
                default: {
                    post({ type: 'error', id: msg.id ?? null, message: `unknown message type: ${msg.type}` });
                    break;
                }
            }
        } catch (err) {
            try {
                post({ type: 'error', id: msg?.id ?? null, message: err.message ?? String(err) });
            } catch (_) {}
        }
    };

    return {
        handle(msg) {
            const p = chain.then(() => doHandle(msg));
            chain = p.catch(() => {});
            return p;
        },
    };
};
