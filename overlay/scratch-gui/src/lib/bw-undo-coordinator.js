// The shared history behind the menu bar's Undo / Redo / History.
// Loaded after the first paint (lib/bw-project-safety.js) and installed into
// the small first-load core, lib/global-undo.js.
//
// Structural project edits (adding, deleting, renaming or moving a sprite,
// costume or sound) do not belong to any one editor, so they go on the shared
// PROJECT stack via recordProjectEdit({label, undo, redo}). Every editor step
// and every project step carries a sequence number, so Undo always reverts
// whichever happened LAST: delete a costume while painting, press Undo, and
// the costume comes back; press it again and the paint stroke goes.

import {installUndoCoordinator} from './global-undo.js';
import {circuitSteps} from './bw-circuit-step-names.js';

export const PROJECT_SURFACE = 'project';
const PROJECT_LIMIT = 200;
const projectPast = [];
const projectFuture = [];
const editSeqs = new Map();
const lastDepth = new Map();
let seq = 0;
let projectGeneration = 0;
let core = null;

/**
 * A new edit in a surface: its undo depth grew other than by a redo, or its
 * redo steps were discarded (a capped stack keeps the same undo depth).
 * @param {?{undo: number, redo: number}} before depth at the last announcement
 * @param {{undo: number, redo: number}} after depth now
 * @returns {boolean} whether this is a new edit
 */
export const isNewEdit = (before, after) => {
    if (!before) return false;
    const redid = after.undo === before.undo + 1 && after.redo === before.redo - 1;
    if (redid) return false;
    if (after.undo > before.undo) return true;
    return before.redo > 0 && after.redo === 0 && after.undo >= before.undo;
};

// Each surface's steps carry sequence numbers in the same order as project
// steps: `past` holds when each undoable step was made, `future` when each
// undone step was undone. Undo picks the newest made step, Redo the most
// recently undone one, across the active editor and the project.
const stepsOf = name => {
    if (!editSeqs.has(name)) editSeqs.set(name, {past: [], future: []});
    return editSeqs.get(name);
};

const track = () => {
    for (const [name, surface] of core.surfaces) {
        const depth = core.depthOf(surface);
        const before = lastDepth.get(name);
        const steps = stepsOf(name);
        if (before) {
            if (isNewEdit(before, depth)) {
                for (let i = Math.max(1, depth.undo - before.undo); i > 0; i--) steps.past.push(++seq);
                steps.future = [];
            } else if (depth.undo < before.undo && depth.redo > before.redo) {
                for (let i = before.undo - depth.undo; i > 0 && steps.past.length; i--) {
                    steps.past.pop();
                    steps.future.push(++seq);
                }
            } else if (depth.undo > before.undo && depth.redo < before.redo) {
                for (let i = depth.undo - before.undo; i > 0; i--) {
                    steps.future.pop();
                    steps.past.push(++seq);
                }
            }
        }
        // A stack that was capped or reset keeps only as many numbers as steps.
        if (steps.past.length > depth.undo) steps.past.splice(0, steps.past.length - depth.undo);
        if (steps.future.length > depth.redo) steps.future.splice(0, steps.future.length - depth.redo);
        lastDepth.set(name, depth);
    }
};

const top = list => (list.length ? list[list.length - 1] : 0);
const activeDepth = () => core.depthOf(core.surfaces.get(core.active()));

const projectNewer = () => {
    if (!projectPast.length) return false;
    if (!activeDepth().undo) return true;
    return top(projectPast).seq > top(stepsOf(core.active()).past);
};

const redoProjectNewer = () => {
    if (!projectFuture.length) return false;
    if (!activeDepth().redo) return true;
    return top(projectFuture).undoneSeq > top(stepsOf(core.active()).future);
};

const message = error => String(error && error.message || error);

const runProject = (from, to, direction) => {
    const entry = from.pop();
    if (direction === 'undo') entry.undoneSeq = ++seq;
    else entry.seq = ++seq;
    to.push(entry);
    core.setError('');
    return Promise.resolve()
        .then(() => {
            if (typeof entry[direction] !== 'function') throw new Error(`Cannot ${direction} "${entry.label}"`);
            return entry[direction]();
        })
        .then(() => true, error => {
            // The step could not be applied (the project changed under it): drop
            // it rather than keep a step that will fail again.
            const index = to.indexOf(entry);
            if (index !== -1) to.splice(index, 1);
            core.setError(message(error));
            return false;
        })
        .finally(core.announce);
};

const undoProject = () => runProject(projectPast, projectFuture, 'undo');
const redoProject = () => runProject(projectFuture, projectPast, 'redo');

/**
 * Move the history by `steps` (negative = back): ten undos for "10 back",
 * stopped early at the end. Async steps (the sound editor) finish one by one.
 * @param {number} steps signed step count
 * @param {string} [scope] 'editor' (the active editor, default), PROJECT_SURFACE, or 'all'
 *     (the merged timeline of the History list)
 * @returns {Promise<number>} steps actually moved
 */
export const moveHistory = async (steps, scope = 'editor') => {
    let moved = 0;
    const back = steps < 0;
    const generation = projectGeneration;
    const surfaceName = core.active();
    const surface = core.surfaces.get(surfaceName);
    const owners=new Map(core.surfaces);
    for (let i = Math.abs(steps | 0); i > 0; i--) {
        // A jump describes the timeline shown when it started. Do not continue
        // into a different editor or a replacement project's history.
        if (generation !== projectGeneration || (scope !== PROJECT_SURFACE &&
            (scope !== 'workspace' && (core.active() !== surfaceName || core.surfaces.get(surfaceName) !== surface)))) break;
        if(scope==='workspace'&&([...owners].some(([name,owner])=>core.surfaces.get(name)!==owner)||core.surfaces.size!==owners.size))break;
        let ok;
        if(scope==='workspace'){
            ok=await stepWorkspace(back?'undo':'redo');
        } else if (scope === 'all') {
            // The merged timeline: each step is whichever Undo / Redo would do next.
            ok = await Promise.resolve(back ? undoNewest() : redoNewest()).catch(error => {
                core.setError(message(error));
                return false;
            }) !== false;
        } else if (scope === PROJECT_SURFACE) {
            if (!(back ? projectPast : projectFuture).length) break;
            ok = await (back ? undoProject() : redoProject());
        } else {
            const result = core.step(back ? 'undo' : 'redo');
            ok = await Promise.resolve(result).catch(error => {
                core.setError(message(error));
                return false;
            }) !== false;
        }
        if (!ok) break;
        moved++;
    }
    core.announce();
    return moved;
};

/**
 * Record a structural project edit that some other code already performed.
 * @param {{label: string, undo: Function, redo?: Function}} entry undo/redo may return Promises
 * @returns {void}
 */
export const recordProjectEdit = entry => {
    if (!entry || typeof entry.undo !== 'function') return;
    projectPast.push({label: String(entry.label || 'Edit'), undo: entry.undo, redo: entry.redo, seq: ++seq});
    if (projectPast.length > PROJECT_LIMIT) projectPast.shift();
    projectFuture.length = 0;
    core.announce();
};

/** A loaded project replaces every structural edit before it. */
export const clearProjectHistory = () => {
    projectGeneration++;
    projectPast.length = 0;
    projectFuture.length = 0;
    core.announce();
};

const stepEditor = direction => {
    const result = core.step(direction);
    // Sound edits resolve after re-encoding. Preserve that completion boundary
    // before selecting the next entry from the merged project/editor timeline.
    if (result && typeof result.then === 'function') {
        return Promise.resolve(result).then(value => {
            core.announce();
            return value !== false;
        }, error => {
            core.setError(message(error));
            core.announce();
            return false;
        });
    }
    return result !== false;
};

const undoNewest = () => (projectNewer() ? undoProject() : stepEditor('undo'));
const redoNewest = () => (redoProjectNewer() ? redoProject() : stepEditor('redo'));

// Project History may traverse a hidden editor without switching tabs or focus.
const stepWorkspace = async direction => {
    const back=direction==='undo',candidates=[];
    for(const [name,surface] of core.surfaces){if(core.depthOf(surface)[direction]>0)candidates.push({name,order:top(stepsOf(name)[back?'past':'future'])});}
    const project=back?projectPast:projectFuture;
    if(project.length)candidates.push({name:PROJECT_SURFACE,order:back?top(project).seq:top(project).undoneSeq});
    candidates.sort((a,b)=>b.order-a.order);const next=candidates[0];if(!next)return false;
    if(next.name===PROJECT_SURFACE)return back?undoProject():redoProject();
    try{return await core.step(direction,next.name)!==false;}catch(error){core.setError(message(error));return false;}
};

/**
 * The History list: the active editor's steps and the project steps in one
 * order, each named "Area: action" ("Blocks: Add whenflagclicked",
 * "Costumes: Remove “costume1”"). An editor names its steps with an optional
 * `steps()` → {past: oldest first, future: next redo first}; without it a
 * step is "<editor>: Edit". Moving k entries back is k Undos (moveHistory 'all').
 * @returns {{past: Array<string>, future: Array<string>}} past newest first, future next first
 */
const surfaceTimeline = name => {
    const surface = core.surfaces.get(name);
    const depth = core.depthOf(surface);
    let labels = null;
    try {
        labels = surface && typeof surface.steps === 'function' ? surface.steps() : null;
        // A surface that keeps whole snapshots (the Circuit tab) hands them over to be compared.
        const snapshots = !labels && surface && typeof surface.snapshots === 'function' ? surface.snapshots() : null;
        if (snapshots) labels = circuitSteps(snapshots.stack, snapshots.cursor);
    } catch (e) { /* unnamed steps below */ }
    const area = surface ? surface.label || name : '';
    const named = (list, count, newestLast) => {
        const out = Array.from({length: count}, () => 'Edit');
        const given = (list || []).slice(newestLast ? -count : 0, newestLast ? undefined : count);
        if (newestLast) given.forEach((label, i) => { out[count - given.length + i] = label; });
        else given.forEach((label, i) => { out[i] = label; });
        return out.map(label => `${area}: ${label}`);
    };
    const steps = stepsOf(name);
    // Editor steps made before tracking began sort below every numbered step.
    const pastLabels = named(labels && labels.past, depth.undo, true);
    const past = pastLabels.map((label, i) => ({label,
        order: steps.past[i - (depth.undo - steps.past.length)] || (i - depth.undo)}));
    const futureLabels = named(labels && labels.future, depth.redo, false);
    const future = futureLabels.map((label, i) => ({label,
        order: steps.future[steps.future.length - 1 - i] || -(i + 1)}));
    return {past,future};
};
export const timeline = (scope='editor') => {
    const names=scope==='workspace'?[...core.surfaces.keys()]:[core.active()];
    const lists=names.map(surfaceTimeline);
    const past=lists.flatMap(list=>list.past).concat(projectPast.map(entry=>({label:entry.label,order:entry.seq})));
    const future=lists.flatMap(list=>list.future).concat(projectFuture.map(entry=>({label:entry.label,order:entry.undoneSeq})));
    return {past:past.sort((a,b)=>b.order-a.order).map(entry=>entry.label),future:future.sort((a,b)=>b.order-a.order).map(entry=>entry.label)};
};

core = installUndoCoordinator({
    track: () => track(),
    lists: () => ({past: projectPast.map(entry => entry.label), future: projectFuture.map(entry => entry.label).reverse()}),
    undo: undoNewest,
    redo: redoNewest
});
core.announce();

// scratch-paint reaches the control through the global bridge (lib/global-undo.js).
if (typeof globalThis !== 'undefined' && globalThis.__bwGlobalUndo) {
    globalThis.__bwGlobalUndo.recordProjectEdit = recordProjectEdit;
}
