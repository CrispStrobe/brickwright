// A private instance belongs to the builtin adapter module. A separately
// constructed instance cannot issue records to that adapter's reader.
module.exports = function createLocalArrayResultBindings() {
    const factories=require('../../../util/bw-extension-result-factory');
    const cachedOwner=require('../../../util/bw-cached-primitive-owner');
    const runtimes=new WeakMap(),adapters=new WeakMap();
    const names=Object.freeze(['createReference','mutateReference','referenceItem','referenceLength']),heldNames=[...names,'getInfo'];
    const descriptor=Object.getOwnPropertyDescriptor,prototype=Object.getPrototypeOf,apply=Reflect.apply;
    // Observe held native data descriptors, never a subsequently installed getter.
    const lookup=(object,name)=>{
        const path=[];let value;
        for(let at=object;at;at=prototype(at)){
            const d=descriptor(at,name),next=prototype(at);path.push({at,next,d});
            if(d){if(!Object.hasOwn(d,'value'))return null;value=d.value;break;}
            if(path.length>16)return null;
        }
        if(typeof value!=='function')return null;
        return {value,current:()=>path.every(({at,next,d})=>{
            if(prototype(at)!==next)return false;const now=descriptor(at,name);
            return d?!!now&&Object.hasOwn(now,'value')&&now.value===d.value&&now.writable===d.writable&&now.enumerable===d.enumerable&&now.configurable===d.configurable:!now;
        })};
    };
    const constructorCurrent=row=>row.valid&&descriptor(row.adapter,'_inst')?.value===row.instance&&heldNames.every(name=>row.adapterLookups.get(name)?.current()&&row.methods.get(name)?.current());
    const refuse=row=>{row.valid=false;return false;};
    function bindConstructor(runtime,adapter,instance,NativeRuntime){
        if(!runtime?.on||!Array.isArray(runtime.targets))return;
        const reader=descriptor(NativeRuntime,'sourceResultOrigins');
        const read=reader&&!reader.writable&&!reader.configurable&&reader.value;
        const origin=typeof read==='function'&&apply(read,null,[runtime]);
        const row={runtime,adapter,instance,read,table:origin?.table,categories:origin?.categories,getterLookup:lookup(runtime,'getOpcodeFunction'),getter:lookup(runtime,'getOpcodeFunction')?.value,
            delegates:new Map(names.map(name=>[name,descriptor(adapter,name)?.value])),adapterLookups:new Map(heldNames.map(name=>[name,lookup(adapter,name)])),methods:new Map(heldNames.map(name=>[name,lookup(instance,name)])),
            prepared:new WeakMap(),entries:new Map(),valid:true,category:null,blocks:null,disposed:false};
        if(runtimes.has(runtime)||!origin||names.some(name=>typeof row.delegates.get(name)!=='function'||!row.methods.get(name)))row.valid=false;
        runtimes.set(runtime,row);adapters.set(adapter,row);
        const capture=category=>{
            if(descriptor(category||{},'id')?.value!=='arrays'||!row.valid)return;
            const original=apply(read,null,[runtime,category]);
            if(!original?.blocks||descriptor(category,'blocks')?.value!==original.blocks||row.category&&row.category!==category){refuse(row);return;}
            const entries=new Map();
            for(const name of names){
                const found=original.blocks.filter(entry=>entry.json?.type==='arrays_'+name),entry=found.length===1&&found[0],record=entry&&row.prepared.get(entry.info?.func);
                if(!record||record.name!==name||entry.info.func!==record.func||row.getter.call(runtime,'arrays_'+name)!==record.func){refuse(row);return;}
                entries.set(name,{entry,record,info:entry.info,json:entry.json});
            }
            row.category=category;row.blocks=original.blocks;row.entries=entries;
        };
        runtime.on('EXTENSION_ADDED',capture);runtime.on('BLOCKSINFO_UPDATE',capture);
        runtime.on('RUNTIME_DISPOSED',()=>{row.disposed=true;});
        runtime.on('PROJECT_LOADED',()=>{if(runtime.targets.some(target=>target.isOriginal!==false))row.disposed=false;});
    }
    function bindInfo(info,adapter,instance){
        const row=adapters.get(adapter);if(!row||!constructorCurrent(row)||instance!==row.instance||info?.id!=='arrays')return;
        for(const name of names){
            const found=info.blocks.filter(block=>block.opcode===name),metadata=found.length===1&&found[0];
            if(!metadata){refuse(row);return;}
            factories.register(metadata,(service,funcName,prepared)=>{
                if(service!==adapter||funcName!==name||!constructorCurrent(row)||!prepared||prepared.arguments!==metadata.arguments){refuse(row);return null;}
                const original=row.delegates.get(name);
                const owned=function(args,util){
                    if(!constructorCurrent(row)||!row.getterLookup?.current()||row.getter.call(row.runtime,'arrays_'+name)!==owned){refuse(row);throw Error('Local Array result operation binding changed');}
                    try{if(util)cachedOwner(row.runtime,util,args,'arrays_'+name,[],'Local Array result operation: ');}
                    catch(error){refuse(row);throw error;}
                    return apply(original,service,[args,util]);
                };
                row.prepared.set(owned,{name,func:owned,original,arguments:metadata.arguments});return owned;
            });
        }
    }
    function current(runtime){
        const row=runtimes.get(runtime);if(!row||row.disposed||!constructorCurrent(row)||!row.category||row.entries.size!==names.length)return false;
        if(!row.getterLookup?.current()||descriptor(runtime,'_primitives')?.value!==row.table||descriptor(runtime,'_blockInfo')?.value!==row.categories||
            !row.categories.includes(row.category)||descriptor(row.category,'blocks')?.value!==row.blocks)return refuse(row);
        for(const name of names){const {entry,record,info,json}=row.entries.get(name);
            if(!row.blocks.includes(entry)||descriptor(entry,'info')?.value!==info||descriptor(entry,'json')?.value!==json||descriptor(json,'type')?.value!=='arrays_'+name||descriptor(info,'arguments')?.value!==record.arguments||descriptor(info,'func')?.value!==record.func||row.prepared.get(record.func)!==record||descriptor(row.table,'arrays_'+name)?.value!==record.func||row.getter.call(runtime,'arrays_'+name)!==record.func)return refuse(row);
        }
        return true;
    }
    return Object.freeze({bindConstructor,bindInfo,current});
};
