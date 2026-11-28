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
                try {
                    const released = typeof value?.releasePaused === 'function' ? value.releasePaused() : value?.release();
                    Promise.resolve(released).catch(() => {});
                } catch { /* Never affect a newer owner. */ }
            }
        }, error => finish(reject, error));
    } catch (error) {finish(reject, error);}
});

export async function prepareCrispBasicCadClock({runtime, board, signal,
    connections = readConnections(),
    documentId = () => globalThis.__bwCad?.editor?.session.state.document.id,
    onFrame = () => {}, cleanupTimeoutMs = 30000} = {}) {
    if (!(signal instanceof AbortSignal)) throw new TypeError('The CAD clock requires an AbortSignal');
    if (!Number.isSafeInteger(cleanupTimeoutMs) || cleanupTimeoutMs < 1 || cleanupTimeoutMs > 60000) throw new TypeError('Invalid CAD cleanup timeout');
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
    check();
    // No board or CAD reset: both retain their current physical state. Their
    // acquired origins can differ; only elapsed time belongs to this new run.
    const acquired = await acquire(() => runtime.cadSimulation.acquireExternalClock(), signal);
    let released = false, releaseTask, coupled = null;
    const rays = config.sensors.map(sensor => ({id: sensor.partId, ...sensor}));
    const release = () => {
        if (released) return releaseTask;
        released = true;
        const result = acquired.releasePaused(rays);
        if (result && typeof result.then === 'function') {
            let timer;
            const deadline = new Promise((resolve, reject) => {
                timer = setTimeout(() => reject(new Error('Timed out releasing the CAD clock')), cleanupTimeoutMs);
            });
            releaseTask = Promise.race([result, deadline]).finally(() => clearTimeout(timer));
            releaseTask.catch(() => {});
        } else releaseTask = result;
        return releaseTask;
    };
    try {
        check();
        if (!acquired || ['snapshot', 'step', 'release', 'releasePaused'].some(name => typeof acquired[name] !== 'function')) {
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
            clockMode: 'program', onFrame, cleanupTimeoutMs});
        check();
        return coupled.programClock;
    } catch (error) {
        try {
            if (coupled) await coupled.stop();
            else if (typeof acquired?.releasePaused === 'function') await release();
            else acquired?.release?.();
        } catch { /* Preserve the preparation error. */ }
        throw error;
    }
}
