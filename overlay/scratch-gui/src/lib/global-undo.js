// One Undo / Redo control for every editor (menu bar).
//
// Each editor keeps its own stack and registers it here as a SURFACE:
//   registerUndoSurface(name, {canUndo, undo, canRedo?, redo?, depth?, label?})
// `depth()` returns {undo, redo} step counts; without it they are 1/0 from
// canUndo/canRedo. The menu acts on the active surface (the visible editor).
//
// This module is in the first load, so it stays small. The project history
// (sprite/costume/sound steps ordered against each editor's own), multi-step
// moves and the History list live in lib/bw-undo-coordinator.js, which the
// after-first-paint chunk installs here (installUndoCoordinator).
//
// A surface that throws never takes the app down: the failure is reported to
// listeners (`error`) and the control stays usable.

const surfaces = new Map();
const listeners = new Set();
let activeSurface = 'blocks';
let lastError = '';
let coordinator = null;

const safe = (fn, fallback) => {
    try {
        return fn();
    } catch (error) {
        lastError = String(error && error.message || error);
        return fallback;
    }
};

const depthOf = surface => {
    if (!surface) return {undo: 0, redo: 0};
    if (typeof surface.depth === 'function') {
        const depth = safe(() => surface.depth(), null);
        if (depth) return {undo: Math.max(0, depth.undo | 0), redo: Math.max(0, depth.redo | 0)};
    }
    return {
        undo: safe(() => surface.canUndo(), false) ? 1 : 0,
        redo: typeof surface.canRedo === 'function' && safe(() => surface.canRedo(), false) ? 1 : 0
    };
};

const snapshot = () => {
    const surface = surfaces.get(activeSurface);
    const depth = depthOf(surface);
    const project = coordinator ? coordinator.lists() : {past: [], future: []};
    return {
        surface: activeSurface,
        label: surface ? surface.label || activeSurface : '',
        canUndo: depth.undo > 0 || project.past.length > 0,
        canRedo: depth.redo > 0 || project.future.length > 0,
        undoDepth: depth.undo,
        redoDepth: depth.redo,
        project,
        error: lastError
    };
};

const announce = () => {
    if (coordinator) coordinator.track();
    const state = snapshot();
    for (const listener of listeners) safe(() => listener(state));
};

export const registerUndoSurface = (name, surface) => {
    surfaces.set(name, surface);
    announce();
    return () => {
        if (surfaces.get(name) === surface) surfaces.delete(name);
        announce();
    };
};

export const activateUndoSurface = name => {
    if (name) activeSurface = name;
    announce();
};

export const notifyUndoState = () => announce();

/**
 * Run one step of the active surface.
 * @param {'undo'|'redo'} direction which way
 * @returns {*} the surface's result; false when there was nothing to do
 */
const step = (direction, name = activeSurface) => {
    const surface = surfaces.get(name);
    const depth = depthOf(surface);
    if (!surface || typeof surface[direction] !== 'function' || !depth[direction]) return false;
    lastError = '';
    const result = safe(() => surface[direction](), false);
    announce();
    return result;
};

/**
 * Undo the newest step: the active editor's, or (once the coordinator runs) a
 * project step made after it.
 * @returns {boolean|Promise<boolean>} whether a step was undone
 */
export const undoActiveSurface = () => (coordinator ? coordinator.undo() : step('undo') !== false);

/** @returns {boolean|Promise<boolean>} whether a step was redone */
export const redoActiveSurface = () => (coordinator ? coordinator.redo() : step('redo') !== false);

export const subscribeUndoState = listener => {
    listeners.add(listener);
    safe(() => listener(snapshot()));
    return () => listeners.delete(listener);
};

export const getUndoState = snapshot;

/**
 * For lib/bw-undo-coordinator.js only.
 * @param {object} next {track, lists, undo, redo}
 * @returns {object} the core's internals the coordinator builds on
 */
export const installUndoCoordinator = next => {
    coordinator = next;
    return {
        surfaces, depthOf, announce, step,
        active: () => activeSurface,
        setError: message => {
            lastError = message;
        }
    };
};

// scratch-paint (a separate package) reaches the control through this bridge.
if (typeof globalThis !== 'undefined') {
    globalThis.__bwGlobalUndo = {registerUndoSurface, activateUndoSurface, notifyUndoState};
}
