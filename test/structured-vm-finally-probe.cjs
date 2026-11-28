// SPDX-License-Identifier: BSD-3-Clause
'use strict';
// One real cached VM/Blocks/execute/sequencer probe. A process-private source
// overlay and authored control graph exercise the disabled seam. No compiler,
// source-language admission, renderer, default registration or corpus claim.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const snapshot=path.resolve(process.argv[2]),vmSource=fs.realpathSync(process.argv[3]),output=path.resolve(process.argv[4]);
const digest=data=>crypto.createHash('sha256').update(data).digest('hex');
const hooks=require(path.join(snapshot,'scripts/lib/engine-activation-hooks.cjs'));
const overlay=new Map(),loaded={};
for(const name of ['bw-engine-activations','bw-arcade-exceptions','bw-primitive-owner','bw-cached-primitive-owner','bw-structured-completions','bw-structured-continuations'])
    overlay.set(path.join(vmSource,'util',name+'.js'),fs.readFileSync(path.join(snapshot,'overlay/scratch-vm/src/util',name+'.js'),'utf8'));
for(const [name,producer]of [['thread',hooks.patchThreadActivations],['execute',hooks.patchExecuteActivations],['sequencer',hooks.patchSequencerActivations]])
    overlay.set(path.join(vmSource,'engine',name+'.js'),producer(fs.readFileSync(path.join(snapshot,'reference',name+'.js'),'utf8')));
const originalResolve=Module._resolveFilename,originalJS=Module._extensions['.js'];
Module._resolveFilename=function(request,parent,...rest){
    if(request.startsWith('.')&&parent?.filename){
        let candidate=path.resolve(path.dirname(parent.filename),request);if(!candidate.endsWith('.js'))candidate+='.js';
        if(overlay.has(candidate))return candidate;
    }
    return originalResolve.call(this,request,parent,...rest);
};
Module._extensions['.js']=function(module,filename){
    const replacement=overlay.get(filename),bytes=replacement===undefined?fs.readFileSync(filename):Buffer.from(replacement);
    loaded[filename]={sha256:digest(bytes),privateOverlay:replacement!==undefined};
    if(replacement!==undefined)return module._compile(replacement,filename);
    return originalJS(module,filename);
};
let vm,result={status:'UNRUN',scope:'Actual cached VM core authored-block graph; private experimental seam, no source compiler/native/PXT/SB3 round trip'};
try{
    const VM=require(path.join(vmSource,'index.js')),Sprite=require(path.join(vmSource,'sprites/sprite.js'));
    const exceptions=require(path.join(vmSource,'util/bw-arcade-exceptions.js'));
    vm=new VM();const runtime=vm.runtime,sprite=new Sprite(null,runtime),target=sprite.createClone();
    target.isStage=true;target.setName('Stage');runtime.targets.push(target);target.createVariable('trace','trace','list');
    const owner=exceptions.createStructuredEngine(runtime,args=>args.VALUE),errors=[];runtime.on('BLOCKS_ERROR',error=>errors.push(error));
    // Private runtime-only primitive installation. Product registration and
    // parser vocabulary remain unchanged; every command executes in real VM.
    runtime._primitives.arcade_structuredTry=(args,util)=>owner.startStructuredHandler(args,util);
    runtime._primitives.arcade_throwValue=(args,util)=>owner.raise(args,util);
    const block=(id,opcode,next,parent,fields={},inputs={},shadow=false)=>target.blocks.createBlock({id,opcode,next,parent,fields,inputs,shadow,topLevel:parent===null});
    const field=(name,value,id)=>({name,value,...(id?{id}:{})});
    block('try','arcade_structuredTry','after',null,
        {HAS_CATCH:field('HAS_CATCH','1'),HAS_FINALLY:field('HAS_FINALLY','1'),CATCH_NAME:field('CATCH_NAME','caught')},
        {SUBSTACK:{name:'SUBSTACK',block:'body',shadow:null},SUBSTACK2:{name:'SUBSTACK2',block:'catch',shadow:null},SUBSTACK3:{name:'SUBSTACK3',block:'finally',shadow:null}});
    const add=(id,label,next,parent)=>{
        block(id,'data_addtolist',next,parent,{LIST:field('LIST','trace','trace')},{ITEM:{name:'ITEM',block:id+'Text',shadow:id+'Text'}});
        block(id+'Text','text',null,id,{TEXT:field('TEXT',label)},{},true);
    };
    add('body','body','throw','try');block('throw','arcade_throwValue',null,'body',{VALUE:field('VALUE','boom')});
    add('catch','catch',null,'try');add('finally','finally',null,'try');add('after','after',null,'try');
    runtime.emit('PROJECT_START');const thread=runtime._pushThread('try',target);runtime.sequencer.activeThread=thread;
    runtime.sequencer.stepThread(thread);
    assert.deepEqual(target.variables.trace.value,['body','catch','finally','after']);assert.deepEqual(errors,[]);
    assert.equal(thread.status,thread.constructor.STATUS_DONE);assert.equal(owner.failure(thread),null);
    result={...result,status:'PASS',actualVMProbes:1,trace:target.variables.trace.value,errors:errors.length,threadStatus:thread.status,
        changedEngineModules:[...overlay.keys()].filter(file=>loaded[file]).map(file=>path.relative(vmSource,file))};
    console.log(JSON.stringify(result));
}catch(error){result={...result,status:'FAIL',errorName:error.name,errorMessage:error.message,stack:error.stack};console.error(error);process.exitCode=1;}
finally{
    try{if(vm){vm.stopAll();vm.quit();}}finally{
        Module._resolveFilename=originalResolve;Module._extensions['.js']=originalJS;
        fs.writeFileSync(output,JSON.stringify({...result,loadedModules:loaded},null,2)+'\n');
    }
}
