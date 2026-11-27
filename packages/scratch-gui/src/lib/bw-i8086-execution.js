// App policy: preferences are requests, never declarations of provider support.
export const I8086_EXECUTION_KEY = 'bw-i8086-execution';
const modes = ['auto', 'functional', 'wired'];
const catalog = ['8086', '80186', '80286'].flatMap(family =>
    ['dos-services', 'functional-hardware'].map(semantics => ({
        id: `${family}-${semantics}-js`, family, semantics, implementation: 'javascript',
        rank: 0, capabilities: [], reference: false, experimental: false,
        qualification: 'qualified',
        evidence: family === '80286'
            ? 'bw-board i8086-286-variant and i80286-blink-demo real-mode fixtures'
            : 'brickwright-lite@411828a304dd84759cd4c1fb82444e72944ffbdc: existing i8086 DOS/hardware constructors and test/i8086-{checkpoints,bios-boots,execution-workload}.test.mjs'
    })));

/** Injectable only for tests; production owns the catalog and the package loader. */
export function createI8086ExecutionController({
    storage = () => globalThis.localStorage,
    loadPolicy = () => import('bw-board/execution-policy')
} = {}) {
    let tabMode;
    let state = Object.freeze({active: null, refusal: null});
    let generation = 0;
    let activeResult = null;
    const statuses = new WeakMap();
    const listeners = new Set();
    const publish = next => {
        state = Object.freeze(next);
        for (const listener of listeners) {
            try { listener(state); } catch { /* An observer cannot veto target creation. */ }
        }
    };
    const getPreference = () => {
        if (tabMode) return tabMode;
        try { const value = storage()?.getItem(I8086_EXECUTION_KEY); return modes.includes(value) ? value : 'auto'; }
        catch { return 'auto'; }
    };
    const setPreference = value => {
        if (!modes.includes(value)) throw new Error('Unknown 8086 execution preference');
        tabMode = value;
        try {
            const store = storage();
            if (!store) return false;
            store.setItem(I8086_EXECUTION_KEY, value);
            return true;
        } catch { return false; }
    };
    const release = result => {
        if (!result || activeResult !== result) return;
        activeResult = null;
        publish({active: null, refusal: null});
    };
    const construct = async ({context, family = '8086', signal}, factory) => {
        const ticket = ++generation;
        const preference = getPreference(); // snapshot BEFORE async package loading
        activeResult = null;
        publish({active: null, refusal: null});
        const fail = (code, reason) => {
            const refusal = Object.freeze({code, reason, preference, family, context});
            if (ticket === generation && !signal?.aborted) publish({active: null, refusal});
            const error = new Error(`${code}: ${reason}`);
            error.executionRefusal = refusal;
            return error;
        };
        try {
            if (!['dos', 'hardware'].includes(context)) throw fail('invalid-context', 'Expected DOS or hardware construction context.');
            if (signal?.aborted) throw fail('construction-cancelled', 'Target was disposed before construction.');
            const semantics = preference === 'wired' ? 'wired-digital'
                : context === 'dos' ? 'dos-services' : 'functional-hardware';
            const {createExecutionPolicy} = await loadPolicy();
            const policy = createExecutionPolicy(catalog);
            const available = catalog.filter(entry => entry.family === family &&
                entry.semantics === (context === 'dos' ? 'dos-services' : 'functional-hardware')).map(entry => entry.id);
            const admission = policy.select({family, semantics, mode: 'auto', requiredCapabilities: []}, {available});
            if (!admission.accepted) throw fail(admission.code,
                preference === 'wired' ? 'Wired digital project execution is unavailable; no functional substitute was started.' : admission.reason);
            if (signal?.aborted) throw fail('construction-cancelled', 'Target was disposed before construction.');
            const result = await factory();
            if (signal?.aborted) {
                const target = result?.target || result;
                if (typeof target?.destroy === 'function') target.destroy();
                throw fail('construction-cancelled', 'Constructed target was disposed.');
            }
            if (!result || typeof result !== 'object') throw fail('construction-failed', 'The target factory returned no target.');
            const active = Object.freeze({preference, requested: admission.requested,
                actual: admission.selected, reason: admission.reason, restartRequired: true});
            statuses.set(result, active);
            // Independent benches may construct concurrently. Keep each result
            // valid but only the newest request may own the shared GUI status.
            if (ticket === generation) {
                activeResult = result;
                publish({active, refusal: null});
            }
            // Covers disposal after publication but before the awaiting runner
            // has received/stored the result and can explicitly release it.
            signal?.addEventListener('abort', () => release(result), {once: true});
            return result;
        } catch (error) {
            if (error?.executionRefusal) throw error;
            throw fail('construction-failed', error?.message || String(error));
        }
    };
    return Object.freeze({getPreference, setPreference, construct, release,
        statusFor: result => statuses.get(result) || null,
        snapshot: () => state,
        subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); }});
}

export const i8086Execution = createI8086ExecutionController();
