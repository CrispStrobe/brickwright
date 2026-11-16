// Frame workers follow PXT base/eventcontext.ts and game/scene.ts (MIT;
// poll-events.LICENSE preserves the Microsoft notice). Each registered scene
// starts with delta 0, owns its actual timer cadence, and retains a sleeping
// predecessor until that worker observes unregister. Restoration waits for the
// predecessor through the same condition-poll queue, just as EventContext does.
module.exports = function createSceneFrameContexts({now,setTimeout:delay,clearTimeout:clear,polls,runFrame,onError,onFrameBegin=()=>{},onFrameEnd=()=>{}}) {
    const contexts=new Map();let generation=0;
    const schedule=(context,ms,callback)=>{
        const handle=delay(callback,ms);context.timers.add(handle);handle?.unref?.();return handle;
    };
    const start=(context,worker,epoch)=>{
        const begin=async()=>{
            if(epoch!==generation)return;
            context.running=true;
            try {onFrameBegin(context.owner);}
            catch(error){context.running=false;onError(error);return;}
            context.previous=now();
            const tick=async()=>{
                if(epoch!==generation)return;
                if(worker!==context.worker){context.running=false;return;}
                const began=now(),delta=began-context.previous;context.previous=began;
                let finished=false;
                const finish=()=>{
                    if(epoch!==generation || finished)return;finished=true;
                    const runtime=now()-began;
                    try {if(!context.dead)onFrameEnd(context.owner,runtime);}
                    catch(error){context.running=false;onError(error);return;}
                    // A frame paused in an authored callback retains its worker;
                    // its next sleep starts when the real callback completes.
                    let handle;handle=schedule(context,Math.max(1,20-runtime),async()=>{context.timers.delete(handle);await tick();});
                };
                try {
                    const result=await runFrame(context.owner,delta);
                    if(result?.completion?.then)result.completion.then(finish,error=>{context.running=false;onError(error);});
                    else finish();
                }catch(error){context.running=false;onError(error);}
            };
            await tick();
        };
        let handle;handle=schedule(context,0,async()=>{
            context.timers.delete(handle);if(epoch!==generation)return;
            if(context.running)polls().enqueue(()=>!context.running,begin);
            else await begin();
        });
    };
    return {
        register(owner) {
            let context=contexts.get(owner);
            if(!context){context={owner,worker:0,running:false,registered:false,timers:new Set()};contexts.set(owner,context);}
            if(context.registered||context.dead)return;
            context.registered=true;start(context,context.worker,generation);
        },
        // The frame fiber died with an uncaught exception. PXT leaves
        // runningCallbacks set, so a restored context never starts again.
        kill(owner) {
            let context=contexts.get(owner);
            if(!context){context={owner,worker:0,running:false,registered:false,timers:new Set()};contexts.set(owner,context);}
            context.dead=true;context.running=false;
            if(context.registered){context.registered=false;context.worker++;}
            for(const timer of context.timers)clear(timer);context.timers.clear();
        },
        unregister(owner) {const context=contexts.get(owner);if(context?.registered){context.registered=false;context.worker++;}},
        cancel() {generation++;for(const context of contexts.values()){for(const timer of context.timers)clear(timer);context.timers.clear();context.registered=false;context.running=false;}contexts.clear();},
        get active(){return [...contexts.values()].some(context=>context.registered);}
    };
};
