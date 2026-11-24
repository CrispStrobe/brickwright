// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
// Manual UI policy follows unchanged saved structure, independently of gallery/program identity.
import {sha256Text} from '../../lib/bw-sim/measurements/binding-digest.js';

// The model writer stores geometry with six decimal places. Compare that same
// representation so an unchanged save cannot drop finite controls. Physical
// parameters (including bearing resistance) retain their full numeric value.
const GEOMETRY = new Set(['position', 'rotation', 'matrix', 'rotorAngle', 'lengthLdu', 'tip', 'center', 'radiusLdu']);
const canonical = (value, geometry = false) => {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return geometry ? Number(value.toFixed(6)) : value;
    if (Array.isArray(value)) return value.map(item => canonical(item, geometry));
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort()
        .filter(key => value[key] !== undefined).map(key => [key, canonical(value[key], geometry || GEOMETRY.has(key))]));
    throw new Error('Manual policy requires a finite, serializable saved model');
};

/** Saved structure at the writer's precision, including custom geometry; omit attribution and instruction steps. */
export const manualAssemblyKey = model => {
    if (!model || !Array.isArray(model.parts) || !model.parts.length) return null;
    const structure = Object.fromEntries(Object.entries(model).filter(([key]) => key !== 'attribution' && key !== 'steps'));
    return JSON.stringify(canonical(structure));
};

export const manualAssemblyDigest = model => {
    const key = manualAssemblyKey(model);
    return key ? sha256Text(key) : null;
};

/** Match only one of the bounded model structures indexed at build time. */
export const createManualPolicyResolver = ({models, referenceDigests}) => {
    const policies = new Map();
    for (const entry of models) if (entry.manualJog !== undefined) {
        if (policies.has(entry.file) && JSON.stringify(canonical(policies.get(entry.file))) !== JSON.stringify(canonical(entry.manualJog))) {
            throw new Error(`Conflicting manual policies for ${entry.file}`);
        }
        policies.set(entry.file, entry.manualJog);
    }
    const byDigest = new Map();
    for (const [file, policy] of policies) {
        const digest = referenceDigests[file];
        if (typeof digest !== 'string' || !/^[0-9a-f]{64}$/.test(digest)) {
            throw new Error(`Missing manual policy reference for ${file}`);
        }
        if (byDigest.has(digest) && JSON.stringify(canonical(byDigest.get(digest))) !== JSON.stringify(canonical(policy))) {
            throw new Error(`Conflicting manual policies for assemblies matching ${file}`);
        }
        if (!byDigest.has(digest)) byDigest.set(digest, policy);
    }
    return model => byDigest.size ? byDigest.get(manualAssemblyDigest(model)) ?? null : null;
};
