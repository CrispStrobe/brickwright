// Host delivery starts an emitted service hat on the callable's actual target.
// The service body invokes the ordinary managed procedure with a real VM util.
// Registration threads and their transient BlockUtility are never retained.
class ArcadeCallableDispatch {
    constructor(runtime, callables, invoke, {opcode = 'arcade_whenCallableDispatched',
        runOpcode = 'arcade_runCallableDispatch'} = {}) {
        this.runtime = runtime;
        this.callables = callables;
        this.invoke = invoke;
        this.opcode = opcode;
        this.runOpcode = runOpcode;
        this.pending = new Set();
        this.generation = 0;
        this.cancel = () => {
            this.generation++;
            for (const request of this.pending) {
                runtime.sequencer?.retireThread(request.thread);
                request.resolve(undefined);
            }
            this.pending.clear();
        };
        this.removeReset = callables.onReset(this.cancel);
    }

    dispatch(reference, args, event) {
        const invocation = this.callables.invocation(reference, args);
        const scripts = [];
        this.runtime.allScriptsByOpcodeDo(this.opcode, (script, target) => {
            if (target !== invocation.target) return;
            const hat = target.blocks.getBlock(script.blockId);
            const name = target.blocks.getBlock(hat?.inputs?.NAME?.block);
            const body = target.blocks.getBlock(hat?.next);
            if (name?.opcode === 'text' && name.fields?.TEXT?.value === invocation.definition.procedure)
                scripts.push({script, valid:body?.opcode === this.runOpcode && !body.next});
        });
        if (scripts.length !== 1 || !scripts[0].valid) throw new Error('Callable requires one exact native service hat');
        const thread = this.runtime._pushThread(scripts[0].script.blockId, invocation.target);
        let resolve, reject;
        const result = new Promise((done, fail) => { resolve = done; reject = fail; });
        const request = {invocation, thread, generation:this.generation, resolve, reject, state:'queued'};
        thread.bwCallableDispatch = request;
        thread.bwArcadeEvent = event;
        thread.bwArcadeCaptures = invocation.captures;
        this.pending.add(request);
        if (this.runtime.bwArcadeFrameAuthority !== 'manual') {
            const phase = this.runtime._arcadeFramePhase;
            if (!phase || typeof phase.requestContinuation !== 'function') {
                this.pending.delete(request);this.runtime.sequencer.retireThread(thread);
                throw new Error('Callable service requires the native source phase');
            }
            phase.requestContinuation().catch(error => {
                if (!this.pending.delete(request)) return;
                this.runtime.sequencer.retireThread(thread);request.reject(error);
            });
        }
        return result;
    }

    request(util) {
        const request = util?.thread?.bwCallableDispatch;
        if (!request || !this.pending.has(request) || request.thread !== util.thread ||
            request.generation !== this.generation || !this.runtime.threads.includes(request.thread)) return null;
        return request;
    }

    matches(name, util) {
        const request = this.request(util);
        return !!request && request.invocation.definition.procedure === String(name);
    }

    run(util, operationArgs) {
        const request = this.request(util);
        if (!request || request.state !== 'queued') throw new Error('Missing or repeated callable service request');
        request.state = 'running';
        const finish = (value, error) => {
            if (!this.pending.delete(request)) return undefined;
            if (error) { request.reject(error); throw error; }
            request.resolve(value);
            return value;
        };
        try {
            // Recheck the canonical resource after queueing: deletion or a load
            // cannot resurrect an executable closure from a saved reference.
            this.callables.hold(request.invocation.reference);
            const result = this.invoke(request.invocation, util, operationArgs);
            return result && typeof result.then === 'function' ?
                result.then(value => finish(value), error => finish(undefined, error)) : finish(result);
        } catch (error) {
            if (!this.pending.has(request)) throw error;
            return finish(undefined, error);
        }
    }

    dispose() {
        this.removeReset();
        this.cancel();
    }
}

module.exports = ArcadeCallableDispatch;
