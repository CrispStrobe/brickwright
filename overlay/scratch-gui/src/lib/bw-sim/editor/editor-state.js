// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// Editor state: commands, undo/redo, palette (C7 + C4, pure). Pure, no DOM, no three.
//
// One user action is one undo step. Moving or turning a multi-part selection,
// or pasting several parts, is a `moveMany` / `batch` command: its steps run
// against a scratch copy, and only when every one of them is valid does the
// model change, with a single history entry (all or nothing).
//
// The model is IMMUTABLE with structural sharing: every model the editor holds,
// hands out (`editor.model`, `apply`, `undo`, `redo`, subscribers) or keeps in its
// history is deeply frozen, so reading it costs nothing (no copy: a 2,000-part
// model used to be deep-copied on every read, several times per pointer move) and
// no caller can change the editor's state through it (a write throws in strict
// code). A command builds a new model that shares every part it did not touch:
// an unchanged part is the SAME object before and after, which is what lets the
// build view's spatial index (spatial-index.js) and per-part caches skip it.

import {validatePlacedModel, partMotorJoint} from '../contracts.js';
import {alignMoves, distributeMoves, gridMoves, mirrorPivot, mirrorPoses} from './editor-parity.js';

/** A deep copy of a plain value (part fields: numbers, strings, arrays, small objects such as a v2 port). */
const copyValue = v => {
    if (Array.isArray(v)) return v.map(copyValue);
    if (v && typeof v === 'object') {
        const out = {};
        for (const k of Object.keys(v)) out[k] = copyValue(v[k]);
        return out;
    }
    return v;
};
/** Freezes a value and everything inside it. */
const deepFreeze = v => {
    if (v && typeof v === 'object' && !Object.isFrozen(v)) {
        Object.freeze(v);
        for (const k of Object.keys(v)) deepFreeze(v[k]);
    }
    return v;
};
/** A frozen part: `fields` copied (a caller's arrays are never kept). */
const frozenPart = fields => deepFreeze(copyValue(fields));

/** A frozen model from parts (already frozen), and groups / steps / rubber bands (frozen or not). */
const makeModel = (version, parts, groups, steps, belts = null, ropes = null, hoses = null, carried = null) => {
    const out = {version, parts: Object.freeze(parts)};
    // What the editor does not edit but a save must keep: decoration (a cable's segments) and the parts a file ships.
    if (carried && carried.decor && carried.decor.length) out.decor = carried.decor;
    if (carried && carried.files) out.files = carried.files;
    if (carried && carried.motorDirection !== undefined) out.motorDirection = carried.motorDirection;
    if (carried && carried.rotor !== undefined) out.rotor = carried.rotor;
    if (carried && carried.internalEdgeRemovalPairs !== undefined) out.internalEdgeRemovalPairs = carried.internalEdgeRemovalPairs;
    if (carried && carried.solver !== undefined) out.solver = carried.solver;
    if (groups) out.groups = deepFreeze(groups);
    if (steps) out.steps = deepFreeze(steps);
    if (belts && belts.length) out.belts = deepFreeze(belts);
    if (ropes && ropes.length) out.ropes = deepFreeze(ropes);
    if (hoses && hoses.length) out.hoses = deepFreeze(hoses);
    return Object.freeze(out);
};
/** The editor's own frozen copy of a model given to it (the caller's model is never kept or changed). */
const importModel = model => {
    const groups = model.groups ? model.groups.map(g => ({id: g.id, name: g.name, parts: g.parts.slice()})) : null;
    // Building steps from `0 STEP` lines ride along; parts deleted since are skipped where they are read.
    const steps = model.steps ? model.steps.map(ids => ids.slice()) : null;
    const belts = model.belts ? model.belts.map(b => ({id: b.id, band: b.band, around: b.around.slice()})) : null;
    const ropes = model.ropes ? model.ropes.map(r => ({id: r.id, lengthLdu: r.lengthLdu, around: r.around.slice()})) : null;
    const hoses = model.hoses ? model.hoses.map(h => ({id: h.id, a: {...h.a}, b: {...h.b}})) : null;
    const carried = {decor: model.decor ? deepFreeze(model.decor.map(d => ({...d, position: d.position.slice(), matrix: d.matrix.slice()}))) : null,
        files: model.files ? Object.freeze({...model.files}) : null,
        ...(model.motorDirection !== undefined ? {motorDirection: model.motorDirection} : {}),
        ...(model.rotor !== undefined ? {rotor: model.rotor} : {}),
        ...(model.internalEdgeRemovalPairs !== undefined ? {internalEdgeRemovalPairs: deepFreeze(model.internalEdgeRemovalPairs.map(pair => pair.slice()))} : {}),
        ...(model.solver !== undefined ? {solver: model.solver} : {})};
    return makeModel(model.version, model.parts.map(frozenPart), groups, steps, belts, ropes, hoses, carried);
};

/** The next free part id, as snap.js placePart picks it (`p<n+1>`, then counting up). */
const nextPartId = (parts, ids) => {
    let id = `p${parts.length + 1}`;
    let counter = 1;
    while (ids.has(id)) {
        id = `p${parts.length + counter}`;
        counter++;
    }
    return id;
};

const byIdCache = new WeakMap();
/**
 * id → placed part for a model, built once per frozen parts array (an editor model's), so a
 * lookup by id is not a scan of every part; a parts array that may still change gets a fresh map.
 * @param {{parts: object[]}} model
 * @returns {Map<string, object>}
 */
export const partsByIdOf = model => {
    const parts = model.parts;
    let map = Object.isFrozen(parts) ? byIdCache.get(parts) : null;
    if (!map) {
        map = new Map(parts.map(p => [p.id, p]));
        if (Object.isFrozen(parts)) byIdCache.set(parts, map);
    }
    return map;
};

export const groupOf = (model, partId) => {
    if (!model.groups) return null;
    for (const g of model.groups) if (g.parts.includes(partId)) return g;
    return null;
};

export const expandSelection = (model, ids) => {
    if (!model.groups || !ids.length) return ids.slice();
    const set = new Set(ids);
    for (const id of ids) {
        const g = groupOf(model, id);
        if (g) for (const pid of g.parts) set.add(pid);
    }
    return [...set];
};

const isProperRotation = m => {
    const det = m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
    return Math.abs(det - 1) < 1e-6;
};

const nextGroupId = model => {
    let n = 1;
    const ids = new Set((model.groups || []).map(g => g.id));
    while (ids.has(`g${n}`)) n++;
    return `g${n}`;
};

/** Groups with fewer than two members dissolve; null when none is left. */
const keptGroups = groups => {
    const kept = groups.filter(g => g.parts.length >= 2);
    return kept.length ? kept : null;
};

export const portsForCopies = (model, catalog, parts) => {
    const catalogMap = catalog instanceof Map ? catalog : new Map(Object.entries(catalog || {}));
    // Build used ports set from current model
    const used = new Set();
    for (const pl of model.parts) if (pl.port) used.add(pl.port);
    // Free ports in order A..F not used
    const allPorts = ['A','B','C','D','E','F'];
    const free = allPorts.filter(p => !used.has(p));
    const freeSet = new Set(free);
    // For each part in model order, determine its copy's port
    // parts is array of placed parts (with id, part, port, etc.) in model order
    // We need to preserve order as given, but task says "assign in model order"
    // So we should sort parts by their order in model.parts
    const orderIndex = new Map(model.parts.map((pl, i) => [pl.id, i]));
    const sorted = [...parts].sort((a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0));
    // Map from original id to assigned port for quick lookup
    const assigned = new Map();
    for (const part of sorted) {
        const meta = catalogMap.get(part.part);
        const isMotor = Boolean(partMotorJoint(meta));
        const isSensor = !!(meta && meta.category === 'sensor');
        if (!isMotor && !isSensor) {
            assigned.set(part.id, undefined);
            continue;
        }
        const origPort = part.port;
        // Check if no other part in model uses this port
        let otherUses = false;
        if (origPort) {
            for (const pl of model.parts) if (pl.id !== part.id && pl.port === origPort) { otherUses = true; break; }
        }
        let chosen;
        if (origPort && !otherUses) {
            // Keep original's port if no other part uses it
            chosen = origPort;
            // If this port was free, remove it from freeSet (now used)
            if (freeSet.has(chosen)) freeSet.delete(chosen);
            // Also, we need to consider that this port is now considered used for subsequent copies
            // But if it was already used by the original, it's already in used, but we have not added it to freeSet, so it's fine
            // However, we need to ensure that if the port was not in freeSet (because it was used by original), we still mark it as now used for future copies (but it's already used, so freeSet doesn't contain it)
            // For the purpose of freeSet, we don't need to add it, just ensure that if it was free, we remove it
        } else {
            // Get first free port in order A..F
            const freeList = allPorts.filter(p => freeSet.has(p));
            chosen = freeList.length ? freeList[0] : undefined;
            if (chosen) freeSet.delete(chosen);
        }
        assigned.set(part.id, chosen);
    }
    // Return ports in the same order as input parts (not sorted), but task says assign in model order, each taking port out of free set
    // The input parts may not be in model order, but we have assigned in model order, so we need to return in input order?
    // The spec says "Copying several parts at once: assign in model order, each assignment taking the port out of the free set."
    // That means the assignment order is model order, but the returned ports should correspond to the input parts in model order?
    // For cloneMany, ids are given, and we will assign ports for each clone in the order of ids as they appear in model.parts, not the order of ids argument.
    // To make it deterministic, we should return ports in the order of the input parts array as sorted by model order.
    // But the caller (cloneMany) will have ids in some order, and we need to map each clone's port correctly.
    // So we can return an array in the order of sorted parts, or we can return a map.
    // Simpler: return array in the order of sorted parts, and the caller can use it in that order.
    // However, the task's example: "a pure helper in editor-state.js, e.g. portsForCopies(model, catalog, parts) => ports[]"
    // It takes parts (array) and returns ports[] (array) corresponding to each part in the same order as parts.
    // And it says "Copying several parts at once: assign in model order, each assignment taking the port out of the free set."
    // That means even if parts are given in arbitrary order, the assignment should be done in model order, but the returned ports should match the input order? Or should the assignment be done in model order but the ports returned in input order?
    // We need to decide.
    // For simplicity, we will assign in model order, but return in input order: we have assigned map from id to port, so we can return ports in input order by mapping each input part's id to assigned port.
    return parts.map(p => assigned.get(p.id));
};

// History list names for editor commands.
const STEP_WORDS = {place: 'Add', delete: 'Remove', deleteMany: 'Remove', move: 'Move', moveMany: 'Move',
    clone: 'Duplicate', cloneMany: 'Duplicate', recolor: 'Colour', paint: 'Colour', setPort: 'Set port',
    group: 'Group', ungroup: 'Ungroup', renameGroup: 'Rename group', align: 'Align', distribute: 'Distribute',
    mirror: 'Mirror', toGrid: 'Snap to grid', addBelt: 'Add band', removeBelt: 'Remove band', addRope: 'Add rope',
    removeRope: 'Remove rope', addHose: 'Add hose', removeHose: 'Remove hose', setPen: 'Pen'};

export const createEditor = ({model, catalog}) => {
    const catalogMap = catalog instanceof Map ? catalog : new Map(Object.entries(catalog || {}));
    let current = importModel(model);
    // History holds the frozen models themselves: nothing in them can change, so no copies.
    const undoStack = [];
    const redoStack = [];
    // The History list's name for each step, parallel to the stacks.
    const undoLabels = [];
    const redoLabels = [];
    const subs = new Set();

    // > 0 while a batch runs its steps: they neither notify nor record history.
    let batching = 0;

    const notify = () => {
        if (batching) return;
        for (const fn of subs) fn(current);
    };

    const pushHistory = (prev, label = 'Edit') => {
        if (batching) return;
        undoStack.push(prev);
        undoLabels.push(label);
        redoStack.length = 0;
        redoLabels.length = 0;
    };

    const stepLabel = cmd => {
        const word = STEP_WORDS[cmd && cmd.type] || 'Edit';
        const meta = cmd && cmd.type === 'place' && catalogMap.get(cmd.part);
        return meta && meta.name ? `${word} ${meta.name}` : word;
    };
    const indexOf = id => current.parts.findIndex(p => p.id === id);
    const hasPart = id => current.parts.some(p => p.id === id);
    /**
     * A new model: `parts` (frozen parts, unchanged ones shared) and the current groups and steps unless
     * given. A rubber band or a rope goes with the parts it is round: one round a part that is gone goes too.
     */
    const derive = (parts, groups = current.groups || null, belts = current.belts || null, ropes = current.ropes || null, hoses = current.hoses || null) => {
        const ids = parts !== current.parts && ((belts && belts.length) || (ropes && ropes.length) || (hoses && hoses.length) || current.internalEdgeRemovalPairs?.length) ? new Set(parts.map(p => p.id)) : null;
        const keep = list => (list && ids ? list.filter(b => b.around.every(id => ids.has(id))) : list);
        const keptHoses = hoses && ids ? hoses.filter(h => ids.has(h.a.part) && ids.has(h.b.part)) : hoses;
        const carried = current.internalEdgeRemovalPairs && ids ? {...current, internalEdgeRemovalPairs: deepFreeze(current.internalEdgeRemovalPairs.filter(pair => pair.every(id => ids.has(id))))} : current;
        return makeModel(current.version, parts, groups, current.steps || null, keep(belts), keep(ropes), keptHoses, carried);
    };
    /** `parts` with the part at `idx` replaced by a frozen copy carrying `changes` (a field set to undefined is removed). */
    const withPart = (parts, idx, changes) => {
        const fields = {...parts[idx], ...changes};
        for (const k of Object.keys(changes)) if (changes[k] === undefined) delete fields[k];
        const out = parts.slice();
        out[idx] = frozenPart(fields);
        return out;
    };
    /**
     * A new part appended to `parts` as snap.js placePart (the next free id; a truthy port), then the colour
     * and port the command asks for. Returns the new parts array.
     */
    const appended = (parts, {part, position, rotation, port}, {color, setPort, pen}) => {
        const ids = new Set(parts.map(p => p.id));
        const fields = {id: nextPartId(parts, ids), part, position, rotation};
        if (port) fields.port = port;
        if (color !== undefined) fields.color = color;
        if (pen !== undefined) fields.pen = pen;
        if (setPort !== undefined) {
            if (setPort) fields.port = setPort;
            else delete fields.port;
        }
        return [...parts, frozenPart(fields)];
    };

    const editor = {
        get model() { return current; },
        get canUndo() { return undoStack.length > 0; },
        get canRedo() { return redoStack.length > 0; },
        get undoDepth() { return undoStack.length; },
        get redoDepth() { return redoStack.length; },
        /** Step names for the History list: past oldest first, future next redo first. */
        get historyLabels() { return {past: undoLabels.slice(), future: redoLabels.slice().reverse()}; },
        subscribe(fn) {
            subs.add(fn);
            return () => subs.delete(fn);
        },
        apply(cmd) {
            // moveMany has two shapes, both ONE undo step: `moves: [{id, position, rotation}]` (the build
            // view's gizmo and drags) runs as an all-or-nothing batch of moves; `ids` + `delta` or `poses`
            // (group moves) is handled below.
            if (cmd && (cmd.type === 'batch' || (cmd.type === 'moveMany' && Array.isArray(cmd.moves)))) return applyBatch(cmd);
            const prev = current;
            let next;
            if (cmd.type === 'place') {
                const {part, position, rotation, color, port} = cmd;
                if (!catalogMap.has(part)) throw new Error(`unknown part '${part}'`);
                if (!Array.isArray(position) || position.length !== 3) throw new Error('bad position');
                if (!Array.isArray(rotation) || rotation.length !== 9) throw new Error('bad rotation');
                if (color !== undefined && !(Number.isInteger(color) && color >= 0)) throw new Error(`bad colour ${color}`);
                if (port !== undefined && port !== null) {
                    const meta = catalogMap.get(part);
                    const isMotor = Boolean(partMotorJoint(meta));
                    const isSensor = meta.category === 'sensor';
                    if (!isMotor && !isSensor) throw new Error(`port on non-motor/sensor part '${part}'`);
                    if (!['A','B','C','D','E','F'].includes(port)) throw new Error(`bad port '${port}'`);
                }
                next = derive(appended(current.parts, {part, position, rotation, port},
                    {color, setPort: port === undefined ? undefined : port}));
            } else if (cmd.type === 'move') {
                const {id, position, rotation} = cmd;
                const idx = indexOf(id);
                if (idx === -1) throw new Error(`unknown id '${id}'`);
                if (!Array.isArray(position) || position.length !== 3) throw new Error('bad position');
                if (!Array.isArray(rotation) || rotation.length !== 9) throw new Error('bad rotation');
                next = derive(withPart(current.parts, idx, {position, rotation}));
            } else if (cmd.type === 'delete') {
                const {id} = cmd;
                const idx = indexOf(id);
                if (idx === -1) throw new Error(`unknown id '${id}'`);
                const parts = current.parts.slice();
                parts.splice(idx, 1);
                // Remove from groups, dissolve small
                const groups = current.groups ?
                    keptGroups(current.groups.map(g => (g.parts.includes(id) ? {id: g.id, name: g.name, parts: g.parts.filter(pid => pid !== id)} : g))) :
                    null;
                next = derive(parts, groups);
            } else if (cmd.type === 'clone') {
                const {id, offset} = cmd;
                const orig = current.parts.find(p => p.id === id);
                if (!orig) throw new Error(`unknown id '${id}'`);
                const off = offset || [40, 0, 0];
                const newPos = [orig.position[0] + off[0], orig.position[1] + off[1], orig.position[2] + off[2]];
                const port = portsForCopies(current, catalogMap, [orig])[0];
                // A single clone forms no group (a group needs two); cloneMany handles groups.
                next = derive(appended(current.parts, {part: orig.part, position: newPos, rotation: orig.rotation, port},
                    {color: orig.color, setPort: port || null, pen: orig.pen}));
            } else if (cmd.type === 'group') {
                const {ids, name} = cmd;
                if (!Array.isArray(ids) || ids.length < 2) throw new Error('group needs at least 2 parts');
                for (const pid of ids) if (!hasPart(pid)) throw new Error(`unknown id '${pid}'`);
                // The new group: ids plus every member of an old group that contains any of them (merged).
                const toMerge = new Set(ids);
                let groups = current.groups ? current.groups.slice() : [];
                const merged = groups.filter(g => g.parts.some(pid => ids.includes(pid)));
                for (const g of merged) for (const pid of g.parts) toMerge.add(pid);
                if (merged.length) groups = groups.filter(g => !merged.includes(g));
                const gid = nextGroupId({groups});
                groups.push({id: gid, name: name || `Group ${gid}`, parts: [...toMerge]});
                next = derive(current.parts, groups);
            } else if (cmd.type === 'setPen') {
                // A part that draws on the floor in Simulate (view/pen-layer.js): `pen: true`, or gone.
                const {id, pen} = cmd;
                const idx = indexOf(id);
                if (idx === -1) throw new Error(`unknown id '${id}'`);
                next = derive(withPart(current.parts, idx, {pen: pen ? true : undefined}));
            } else if (cmd.type === 'addBelt') {
                // A rubber band round two or more parts (editor/belt-path.js lays it, kinds/belt.js simulates it).
                const {around, band} = cmd;
                if (!Array.isArray(around) || around.length < 2 || new Set(around).size !== around.length) throw new Error('a rubber band goes round at least 2 parts');
                for (const pid of around) if (!hasPart(pid)) throw new Error(`unknown id '${pid}'`);
                if (typeof band !== 'string' || !band) throw new Error('bad band');
                const ids = new Set((current.belts || []).map(b => b.id));
                let n = 1;
                while (ids.has(`b${n}`)) n++;
                next = derive(current.parts, current.groups || null, [...(current.belts || []), {id: `b${n}`, band, around: around.slice()}], current.ropes || null);
            } else if (cmd.type === 'removeBelt') {
                const {id} = cmd;
                if (!current.belts || !current.belts.some(b => b.id === id)) throw new Error(`unknown rubber band '${id}'`);
                next = derive(current.parts, current.groups || null, current.belts.filter(b => b.id !== id), current.ropes || null);
            } else if (cmd.type === 'addRope') {
                // A rope from a drum over sheaves to a hook (editor/rope-path.js lays it, kinds/rope.js simulates it).
                const {around, lengthLdu} = cmd;
                if (!Array.isArray(around) || around.length < 2 || new Set(around).size !== around.length) throw new Error('a rope runs from a drum to a hook');
                for (const pid of around) if (!hasPart(pid)) throw new Error(`unknown id '${pid}'`);
                if (!(Number.isFinite(lengthLdu) && lengthLdu > 0)) throw new Error('bad rope length');
                const ids = new Set((current.ropes || []).map(r => r.id));
                let n = 1;
                while (ids.has(`r${n}`)) n++;
                next = derive(current.parts, current.groups || null, current.belts || null, [...(current.ropes || []), {id: `r${n}`, lengthLdu, around: around.slice()}]);
            } else if (cmd.type === 'removeRope') {
                const {id} = cmd;
                if (!current.ropes || !current.ropes.some(r => r.id === id)) throw new Error(`unknown rope '${id}'`);
                next = derive(current.parts, current.groups || null, current.belts || null, current.ropes.filter(r => r.id !== id));
            } else if (cmd.type === 'addHose') {
                // A pneumatic hose from one part's air port to another's (kinds/pneumatic.js reads them).
                const {a, b} = cmd;
                for (const end of [a, b]) {
                    if (!end || !hasPart(end.part) || typeof end.port !== 'string') throw new Error('a hose joins two parts\' ports');
                }
                if (a.part === b.part) throw new Error('a hose joins two parts');
                const ids = new Set((current.hoses || []).map(h => h.id));
                let n = 1;
                while (ids.has(`h${n}`)) n++;
                next = derive(current.parts, current.groups || null, current.belts || null, current.ropes || null,
                    [...(current.hoses || []), {id: `h${n}`, a: {part: a.part, port: a.port}, b: {part: b.part, port: b.port}}]);
            } else if (cmd.type === 'removeHose') {
                const {id} = cmd;
                if (!current.hoses || !current.hoses.some(h => h.id === id)) throw new Error(`unknown hose '${id}'`);
                next = derive(current.parts, current.groups || null, current.belts || null, current.ropes || null, current.hoses.filter(h => h.id !== id));
            } else if (cmd.type === 'ungroup') {
                const {id} = cmd;
                if (!current.groups || !current.groups.some(g => g.id === id)) throw new Error(`unknown group '${id}'`);
                const groups = current.groups.filter(g => g.id !== id);
                next = derive(current.parts, groups.length ? groups : null);
            } else if (cmd.type === 'renameGroup') {
                const {id, name} = cmd;
                if (!current.groups || !current.groups.some(g => g.id === id)) throw new Error(`unknown group '${id}'`);
                if (typeof name !== 'string' || !name) throw new Error('bad name');
                next = derive(current.parts, current.groups.map(g => (g.id === id ? {id: g.id, name, parts: g.parts.slice()} : g)));
            } else if (cmd.type === 'moveMany') {
                const {ids, delta, poses} = cmd;
                if (!Array.isArray(ids) || ids.length === 0) throw new Error('moveMany needs ids');
                for (const pid of ids) if (!hasPart(pid)) throw new Error(`unknown id '${pid}'`);
                if (delta !== undefined) {
                    if (!Array.isArray(delta) || delta.length !== 3) throw new Error('bad delta');
                }
                if (poses !== undefined) {
                    if (!Array.isArray(poses)) throw new Error('bad poses');
                    for (const po of poses) {
                        if (!po.id || !Array.isArray(po.position) || po.position.length !== 3) throw new Error('bad pose position');
                        if (!Array.isArray(po.rotation) || po.rotation.length !== 9) throw new Error('bad pose rotation');
                        if (!isProperRotation(po.rotation)) throw new Error('bad rotation det');
                        if (!ids.includes(po.id)) throw new Error(`pose id '${po.id}' not in ids`);
                    }
                }
                if (delta === undefined && poses === undefined) throw new Error('moveMany needs delta or poses');
                let parts = current.parts;
                if (poses) {
                    for (const po of poses) parts = withPart(parts, parts.findIndex(p => p.id === po.id), {position: po.position, rotation: po.rotation});
                } else {
                    for (const pid of new Set(ids)) {
                        const idx = parts.findIndex(p => p.id === pid);
                        const at = parts[idx].position;
                        parts = withPart(parts, idx, {position: [at[0] + delta[0], at[1] + delta[1], at[2] + delta[2]]});
                    }
                }
                next = derive(parts);
            } else if (cmd.type === 'deleteMany') {
                const {ids} = cmd;
                if (!Array.isArray(ids) || ids.length === 0) throw new Error('deleteMany needs ids');
                for (const pid of ids) if (!hasPart(pid)) throw new Error(`unknown id '${pid}'`);
                const delSet = new Set(ids);
                const groups = current.groups ?
                    keptGroups(current.groups.map(g => (g.parts.some(pid => delSet.has(pid)) ? {id: g.id, name: g.name, parts: g.parts.filter(pid => !delSet.has(pid))} : g))) :
                    null;
                next = derive(current.parts.filter(p => !delSet.has(p.id)), groups);
            } else if (cmd.type === 'cloneMany') {
                const {ids, offset} = cmd;
                if (!Array.isArray(ids) || ids.length === 0) throw new Error('cloneMany needs ids');
                for (const pid of ids) if (!hasPart(pid)) throw new Error(`unknown id '${pid}'`);
                const selection = [...new Set(ids)];
                const off = offset || [40, 0, 0];
                if (!Array.isArray(off) || off.length !== 3) throw new Error('bad offset');
                // Ports for the copies (in model order).
                const partsToCopy = selection.map(pid => current.parts.find(p => p.id === pid));
                const ports = portsForCopies(current, catalogMap, partsToCopy);
                const origToCloneId = new Map();
                let parts = current.parts;
                selection.forEach((pid, i) => {
                    const orig = partsToCopy[i];
                    const port = ports[i];
                    const newPos = [orig.position[0] + off[0], orig.position[1] + off[1], orig.position[2] + off[2]];
                    parts = appended(parts, {part: orig.part, position: newPos, rotation: orig.rotation, port}, {color: orig.color, setPort: port || null, pen: orig.pen});
                    origToCloneId.set(pid, parts[parts.length - 1].id);
                });
                // Clones keep their group structure: a cloned group (two or more members copied) becomes a new group.
                let groups = current.groups || null;
                if (current.groups) {
                    groups = current.groups.slice();
                    for (const og of current.groups.filter(g => g.parts.some(pid => selection.includes(pid)))) {
                        const clonedParts = og.parts.filter(pid => selection.includes(pid)).map(pid => origToCloneId.get(pid));
                        if (clonedParts.length >= 2) groups.push({id: nextGroupId({groups}), name: og.name, parts: clonedParts});
                    }
                }
                next = derive(parts, groups);
            } else if (cmd.type === 'recolor') {
                const {id, color} = cmd;
                const idx = indexOf(id);
                if (idx === -1) throw new Error(`unknown id '${id}'`);
                if (!(Number.isInteger(color) && color >= 0)) throw new Error(`bad colour ${color}`);
                next = derive(withPart(current.parts, idx, {color}));
            } else if (cmd.type === 'paint') {
                // The colour picker and the eyedropper: one colour on every part of a selection, one undo step.
                const {ids, color} = cmd;
                if (!Array.isArray(ids) || ids.length === 0) throw new Error('paint needs ids');
                if (!(Number.isInteger(color) && color >= 0)) throw new Error(`bad colour ${color}`);
                for (const pid of ids) if (!hasPart(pid)) throw new Error(`unknown id '${pid}'`);
                const want = new Set(ids);
                if (current.parts.every(p => !want.has(p.id) || p.color === color)) throw new Error('paint: nothing changes');
                next = derive(current.parts.map(p => (want.has(p.id) ? frozenPart({...p, color}) : p)));
            } else if (cmd.type === 'mirror' || cmd.type === 'align' || cmd.type === 'distribute' || cmd.type === 'toGrid') {
                const {ids} = cmd;
                if (!Array.isArray(ids) || ids.length === 0) throw new Error(`${cmd.type} needs ids`);
                for (const pid of ids) if (!hasPart(pid)) throw new Error(`unknown id '${pid}'`);
                let poses;
                if (cmd.type === 'mirror') {
                    // A left part becomes its right counterpart, a symmetric one its mirror image, the rest keep
                    // their handedness at the mirrored spot (editor-parity.js): never an improper rotation.
                    const pivot = cmd.pivot ?? mirrorPivot(current, catalogMap, ids, cmd.axis);
                    const want = new Set(ids);
                    poses = mirrorPoses(current.parts.filter(p => want.has(p.id)), catalogMap, cmd.axis, pivot);
                } else if (cmd.type === 'align') {
                    poses = alignMoves({model: current, catalog: catalogMap, ids, axis: cmd.axis, mode: cmd.mode});
                } else if (cmd.type === 'distribute') {
                    poses = distributeMoves({model: current, catalog: catalogMap, ids, axis: cmd.axis});
                } else {
                    poses = gridMoves({model: current, catalog: catalogMap, ids, grid: cmd.grid});
                }
                let parts = current.parts;
                let changed = false;
                for (const po of poses) {
                    const idx = parts.findIndex(x => x.id === po.id);
                    const p = parts[idx];
                    if (!isProperRotation(po.rotation)) throw new Error(`${cmd.type}: improper rotation for '${po.id}'`);
                    const changes = {position: po.position, rotation: po.rotation};
                    if (po.part && po.part !== p.part) { changes.part = po.part; changed = true; }
                    if (po.position.some((v, i) => v !== p.position[i]) || po.rotation.some((v, i) => v !== p.rotation[i])) changed = true;
                    parts = withPart(parts, idx, changes);
                }
                if (!changed) throw new Error(`${cmd.type}: nothing moves`);
                next = derive(parts);
            } else if (cmd.type === 'setPort') {
                const {id, port} = cmd;
                const idx = indexOf(id);
                if (idx === -1) throw new Error(`unknown id '${id}'`);
                const meta = catalogMap.get(current.parts[idx].part);
                if (port !== null && port !== undefined) {
                    const isMotor = Boolean(partMotorJoint(meta));
                    const isSensor = meta.category === 'sensor';
                    if (!isMotor && !isSensor) throw new Error(`port on non-motor/sensor part '${current.parts[idx].part}'`);
                    if (!['A','B','C','D','E','F'].includes(port)) throw new Error(`bad port '${port}'`);
                }
                next = derive(withPart(current.parts, idx, {port: port === null || port === undefined ? undefined : port}));
            } else {
                throw new Error(`unknown command type '${cmd.type}'`);
            }

            // Validate the new model
            const errs = validatePlacedModel(next, catalog);
            if (errs.length) throw new Error(errs[0]);

            pushHistory(prev, stepLabel(cmd));
            current = next;
            notify();
            return current;
        },
        undo() {
            if (!undoStack.length) return current;
            redoStack.push(current);
            redoLabels.push(undoLabels.pop());
            current = undoStack.pop();
            notify();
            return current;
        },
        redo() {
            if (!redoStack.length) return current;
            undoStack.push(current);
            undoLabels.push(redoLabels.pop());
            current = redoStack.pop();
            notify();
            return current;
        }
    };

    /**
     * `{type: 'batch', commands: [...]}` or `{type: 'moveMany', moves: [{id, position, rotation}]}`:
     * all steps or none, one undo entry, one notification.
     */
    const applyBatch = cmd => {
        const steps = cmd.type === 'moveMany' ?
            (Array.isArray(cmd.moves) ? cmd.moves.map(m => ({...m, type: 'move'})) : null) :
            (Array.isArray(cmd.commands) ? cmd.commands : null);
        if (!steps || !steps.length) throw new Error(`${cmd.type}: needs at least one step`);
        if (cmd.type === 'moveMany') {
            const ids = steps.map(s => s.id);
            if (new Set(ids).size !== ids.length) throw new Error('moveMany: a part is moved twice');
        }
        const prev = current;
        batching++;
        try {
            for (const step of steps) editor.apply(step);
        } catch (error) {
            current = prev;
            throw error;
        } finally {
            batching--;
        }
        pushHistory(prev, cmd.type === 'moveMany' ? stepLabel(cmd) :
            steps.every(step => step.type === steps[0].type) ? stepLabel(steps[0]) : 'Edit');
        notify();
        return current;
    };

    return editor;
};
