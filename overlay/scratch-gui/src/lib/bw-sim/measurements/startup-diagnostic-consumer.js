// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
// Admission of an optional diagnostic after the physical batch was accepted.
// Failure affects diagnostics only; it never changes physics or reports qualification.
export const admitStartupDiagnostic = (packet, selection, startSeconds, endSeconds) => {
    const unavailable = reason => ({status: 'unavailable', reason, qualification: false, packet: null});
    const near = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-8;
    const vec = (value, n) => Array.isArray(value) && value.length === n && Array.from(value).every(Number.isFinite);
    const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    const finiteObservation = (value, depth = 0) => depth < 16 && (value === null ||
        ['string', 'boolean'].includes(typeof value) || typeof value === 'number' && Number.isFinite(value) ||
        Array.isArray(value) && Array.from(value).every(x => finiteObservation(x, depth + 1)) ||
        object(value) && Object.getPrototypeOf(value) === Object.prototype && Object.values(value).every(x => finiteObservation(x, depth + 1)));
    if (!packet || packet.schema !== 'robot-lab.startup-diagnostic.v1' ||
        packet.revision !== selection.revision || packet.qualification !== false ||
        packet.stopSeconds !== selection.stopSeconds || packet.overflow !== false ||
        !Number.isFinite(startSeconds) || startSeconds < 0 || !Number.isFinite(endSeconds) || endSeconds < startSeconds ||
        !Array.isArray(packet.samples) || packet.samples.length > 110 ||
        !Array.isArray(packet.unavailable) || packet.unavailable.length > 16 ||
        Array.from(packet.unavailable).some(x => typeof x !== 'string') ||
        !['hingeAnchorImpulses', 'contactImpulses', 'effectiveIslandIterations'].every(x => packet.unavailable.includes(x))) {
        return unavailable('missing-or-invalid-packet');
    }
    const absent = name => packet.unavailable.includes(name);
    const snapshot = (row, time, initial) => row && near(row.t, time) &&
        (initial ? row.stepSeconds === null : near(row.stepSeconds, 0.005)) &&
        Array.isArray(row.bodies) && row.bodies.length === selection.bodies.length && Array.from(row.bodies).every((b, i) =>
            b?.id === selection.bodies[i] &&
            (b.pose === null ? absent('bodyPose') : vec(b.pose?.position, 3) && vec(b.pose?.rotation, 4)) &&
            (b.linearVelocityMS === null ? absent('bodyLinearVelocity') : vec(b.linearVelocityMS, 3)) &&
            (b.angularVelocityRadS === null ? absent('bodyAngularVelocity') : vec(b.angularVelocityRadS, 3)) &&
            (b.dynamics === null ? absent('bodyDynamics') : object(b.dynamics) && finiteObservation(b.dynamics))) &&
        Array.isArray(row.joints) && row.joints.length === selection.joints.length && Array.from(row.joints).every((j, i) =>
            j?.id === selection.joints[i] && (j.state === null ? absent('jointState') : object(j.state) &&
                finiteObservation(j.state) && (Number.isFinite(j.state.angle) || Number.isFinite(j.state.position))) &&
            (j.dynamics === null || object(j.dynamics) && finiteObservation(j.dynamics))) &&
        (row.contactPairs === null ? absent('currentContactPairs') : Array.isArray(row.contactPairs) &&
            row.contactPairs.length <= 120 && Array.from(row.contactPairs).every(p => Array.isArray(p) && p.length === 2 && Array.from(p).every(x => typeof x === 'string')));
    const count = Math.max(0, Math.floor((Math.min(endSeconds, selection.stopSeconds) - startSeconds + 1e-8) / 0.005));
    if (packet.samples.length !== count ||
        (startSeconds <= selection.stopSeconds ? !snapshot(packet.initial, startSeconds, true) : packet.initial !== null) ||
        !Array.from(packet.samples).every((row, i) => snapshot(row, startSeconds + (i + 1) * 0.005, false))) {
        return unavailable('incomplete-or-invalid-step-prefix');
    }
    return {status: packet.unavailable.length > 3 ? 'unavailable' : 'observed',
        ...(packet.unavailable.length > 3 ? {reason: 'getter-unavailable'} : {}),
        qualification: false, packet: structuredClone(packet)};
};
