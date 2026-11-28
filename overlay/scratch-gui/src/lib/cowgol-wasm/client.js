// SPDX-License-Identifier: BSD-3-Clause
/**
 * The page side of the offline Cowgol compiler: decides whether this build
 * and installation can compile a target locally, and runs the compile in a
 * dedicated Web Worker with cancellation and a wall-clock bound.
 *
 * `null` from `defaultCowgolLocalCompiler()` means "no local route": Node
 * harnesses (which inject their own), builds without a verified payload, and
 * pages without Worker support. Callers then use the hosted service exactly
 * as before.
 */
import {COWGOL_WASM_PINS} from './pins.js';
import {toolsForTarget} from './pipeline.js';
import {remoteToolchainsAllowed} from '../distribution-policy.js';

export const COWGOL_LOCAL_TIMEOUT_MS = 60_000;
export const COWGOL_GPL_OPT_IN_KEY = 'bw-cowgol-gpl-toolchain';

/** Optional GPL payload origin (djlink, 64tass). Unset: DOS/Eater stay hosted. */
const gplOrigin = () => {
    let configured = null;
    // DefinePlugin replaces this exact expression with a literal.
    try { configured = process.env.BW_COWGOL_GPL_ORIGIN; } catch { configured = null; }
    return typeof configured === 'string' && /^https:\/\//.test(configured) ? configured.replace(/\/?$/, '/') : null;
};

export class CowgolLocalUnavailable extends Error {
    constructor (message) { super(message); this.name = 'CowgolLocalUnavailable'; }
}

/**
 * @param {{pins?, bundledBase: string, gplBase?: string|null, spawn: () => Worker,
 *          timeoutMs?: number}} options
 */
export function createCowgolWorkerCompiler ({pins = COWGOL_WASM_PINS, bundledBase, gplBase = null, spawn,
    timeoutMs = COWGOL_LOCAL_TIMEOUT_MS}) {
    if (!pins?.bundled) return null;
    const installed = tool => Boolean(pins.bundled.tools[tool] || (gplBase && pins.gpl?.tools?.[tool]));
    const supports = target => {
        const tools = toolsForTarget(target);
        return tools.length > 0 && tools.every(installed);
    };
    let worker = null;
    let sequence = 0;
    let queue = Promise.resolve();
    const discard = () => { if (worker) worker.terminate(); worker = null; };
    const once = (req, signal) => new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
            return;
        }
        worker ||= spawn();
        const id = ++sequence;
        let timer = null;
        const finish = () => {
            clearTimeout(timer);
            worker?.removeEventListener('message', onMessage);
            worker?.removeEventListener('error', onError);
            signal?.removeEventListener('abort', onAbort);
        };
        const onMessage = ({data}) => {
            if (!data || data.id !== id) return;
            finish();
            if (data.response) resolve(data.response);
            else reject(data.unavailable ? new CowgolLocalUnavailable(data.error) : new Error(data.error));
        };
        const onError = event => {
            finish();
            discard();
            reject(new CowgolLocalUnavailable(`Offline Cowgol worker failed: ${event?.message || 'unknown error'}`));
        };
        const onAbort = () => {
            finish();
            discard(); // the only way to stop a running stage
            reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
        };
        timer = setTimeout(() => {
            finish();
            discard();
            reject(new Error(`Offline Cowgol compile timed out after ${Math.round(timeoutMs / 1000)}s`));
        }, timeoutMs);
        worker.addEventListener('message', onMessage);
        worker.addEventListener('error', onError);
        signal?.addEventListener('abort', onAbort, {once: true});
        worker.postMessage({id, bundledBase, gplBase, req});
    });
    return {
        kind: 'wasm-worker',
        supports,
        compile (req, {signal} = {}) {
            const run = queue.then(() => once(req, signal));
            queue = run.catch(() => {});
            return run;
        }
    };
}

let browserDefault;
/** The browser's offline compiler, or null where there is none. */
export function defaultCowgolLocalCompiler () {
    if (browserDefault !== undefined) return browserDefault;
    browserDefault = null;
    if (typeof window !== 'object' || typeof Worker !== 'function' || typeof document !== 'object') return browserDefault;
    if (!COWGOL_WASM_PINS?.bundled) return browserDefault;
    let optIn = false;
    try { optIn = window.localStorage?.getItem(COWGOL_GPL_OPT_IN_KEY) === 'local'; } catch { optIn = false; }
    const base = new URL('static/cowgol-wasm/', document.baseURI).href;
    browserDefault = createCowgolWorkerCompiler({
        bundledBase: base,
        // The GPL payload is a remote toolchain download: opt-in AND policy.
        gplBase: optIn && remoteToolchainsAllowed() ? gplOrigin() : null,
        spawn: () => new Worker(/* webpackChunkName: "cowgol-wasm-worker" */
            new URL('./worker.js', import.meta.url), {type: 'module'})
    });
    return browserDefault;
}
