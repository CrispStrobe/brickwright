// SPDX-License-Identifier: BSD-3-Clause
// CAD keeps its fixed solver quantum; BASIC owns the exact electrical clock.
import {createCoupledSession} from './bw-cad-circuit/session.js';
import {readConnections, validateConnections} from './bw-cad-circuit/connections.js';

const stopped = () => new Error('The BASIC circuit–CAD run was stopped');

// A worker can finish acquiring its clock after Stop. Settle the caller now,
// then release that late lease without installing it in a later BASIC run.
const acquire = (action, signal) => new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
        if (settled) return false;
        settled = true;signal.removeEventListener('abort', abort);callback(value);return true;
    };
    const abort = () => finish(reject, stopped());
    if (signal.aborted) {abort();return;}
    signal.addEventListener('abort', abort, {once: true});
    try {
        Promise.resolve(action()).then(value => {
            if (!finish(resolve, value)) {
                try {value?.release();} catch { /* Never affect a newer owner. */ }
            }
        }, error => finish(reject, error));
    } catch (error) {finish(reject, error);}
});

export async function prepareCrispBasicCadClock({runtime, board, signal,
    connections = readConnections(),
    documentId = () => globalThis.__bwCad?.editor?.session.state.document.id,
    onFrame = () => {}} = {}) {
    if (!(signal instanceof AbortSignal)) throw new TypeError('The CAD clock requires an AbortSignal');
    if (signal.aborted) throw stopped();
    const config = validateConnections(connections);
    if (!config.enabled || (!config.drives.length && !config.servos.length)) {
        throw new Error('Enable and save circuit–CAD motor connections first');
    }
    if (typeof runtime?.cadSimulation?.acquireExternalClock !== 'function') {
        throw new Error('Open the CAD Editor and connect a circuit motor to a joint first');
    }
    const check = () => {
        if (signal.aborted) throw stopped();
        if (runtime.circuitBoard !== board) throw new Error('The Circuit changed while CAD was loading');
        if (documentId() !== config.cadDocumentId) throw new Error('These connections belong to a different CAD design');
    };
    // No board or CAD reset: both retain their current physical state. Their
    // acquired origins can differ; only elapsed time belongs to this new run.
    const acquired = await acquire(() => runtime.cadSimulation.acquireExternalClock(), signal);
    let released = false, coupled = null;
    const release = () => {if (!released) {released = true;acquired?.release();}};
    try {
        check();
        if (!acquired || ['snapshot', 'step', 'release'].some(name => typeof acquired[name] !== 'function')) {
            throw new Error('The CAD Editor returned an invalid mechanical clock');
        }
        const mechanics = {
            snapshot: () => acquired.snapshot(),
            step: (...args) => acquired.step(...args),
            ...(typeof acquired.stepTelemetry === 'function' ? {stepTelemetry: (...args) => acquired.stepTelemetry(...args)} : {}),
            present: () => acquired.present?.(),
            ...(typeof acquired.sense === 'function' ? {sense: (...args) => acquired.sense(...args)} : {}),
            release
        };
        coupled = await createCoupledSession({board, mechanics, connections: config, signal,
            clockMode: 'program', onFrame});
        check();
        return coupled.programClock;
    } catch (error) {
        try {if (coupled) coupled.stop();else release();} catch { /* Preserve the preparation error. */ }
        throw error;
    }
}
