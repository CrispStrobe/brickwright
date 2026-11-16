// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
// Explicit opt-in diagnostic only. Independent of production measurements.
const MAX_SECONDS = 0.55;
const MAX_SAMPLES = 110;
export const startupDiagnosticSelection = (value, mechanism) => {
    if (value == null) return null;
    const validIds = (ids, limit, entries, admit) => Array.isArray(ids) && ids.length > 0 &&
        ids.length <= limit && new Set(ids).size === ids.length &&
        Array.from(ids).every(id => typeof id === 'string' && entries.some(entry => entry.id === id && admit(entry)));
    if (mechanism.bodies.length > 16 || mechanism.joints.length > 32 ||
        !Number.isSafeInteger(value.revision) || value.revision < 1 ||
        !Number.isFinite(value.stopSeconds) || value.stopSeconds <= 0 || value.stopSeconds > MAX_SECONDS ||
        !validIds(value.bodies, 6, mechanism.bodies, b => b.motion === 'dynamic') ||
        !validIds(value.joints, 7, mechanism.joints, j => ['hinge','slider'].includes(j.type))) {
        throw new Error('invalid startup diagnostic selection');
    }
    return {revision: value.revision, stopSeconds: value.stopSeconds, bodies: [...value.bodies], joints: [...value.joints]};
};
export const collectStartupDiagnostic = (core, selection) => {
    if (!selection) return null;
    const missing = new Set(['hingeAnchorImpulses', 'contactImpulses', 'effectiveIslandIterations']);
    const read = (method, id) => {
        if (typeof core[method] !== 'function') { missing.add(method); return null; }
        // Copy immediately: getters may share binding-owned temporaries.
        return structuredClone(id === undefined ? core[method]() : core[method](id));
    };
    const snapshot = (t, stepSeconds) => ({t, stepSeconds,
        bodies: selection.bodies.map(id => ({id, pose: read('bodyPose', id),
            linearVelocityMS: read('bodyLinearVelocity', id), angularVelocityRadS: read('bodyAngularVelocity', id),
            dynamics: read('bodyDynamics', id)})),
        joints: selection.joints.map(id => ({id, state: read('jointState', id), dynamics: read('jointDynamics', id)})),
        contactPairs: read('currentContactPairs')
    });
    // This is the invocation's start, which is t0 only for its first batch.
    const initial = core.time <= selection.stopSeconds ? snapshot(core.time, null) : null;
    const samples = [];
    let attached = true, overflow = false;
    const detach = typeof core.observeFixedSteps === 'function' ? core.observeFixedSteps(step => {
        if (!attached || step.t > selection.stopSeconds + 1e-12) return;
        if (samples.length >= MAX_SAMPLES) { overflow = true; return; }
        samples.push(snapshot(step.t, step.stepSeconds));
    }) : null;
    if (!detach) missing.add('observeFixedSteps');
    return {
        take: () => ({schema: 'robot-lab.startup-diagnostic.v1', revision: selection.revision,
            qualification: false, stopSeconds: selection.stopSeconds, initial, samples, overflow,
            unavailable: [...missing].sort()}),
        detach: () => { if (attached) { attached = false; detach?.(); } }
    };
};
