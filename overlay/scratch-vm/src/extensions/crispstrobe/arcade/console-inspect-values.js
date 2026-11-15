// console.inspect's primitive branch from the selected MIT PXT console
// contract. Domain admission is separate from conversion: never call a
// reference, getter, custom toString or Object.keys inspection path here.
const primitiveOwner = require('../../../util/bw-primitive-owner');
const graphVersion = require('../../../util/bw-graph-version');
const reporterOwner = require('./font-selector-owner');
const resultFactory = require('../../../util/bw-extension-result-factory');
const analyseCaptures = require('./console-capture-provenance');
const kinds = new Set(['Number','Boolean','String','Any']);
// The readable Sprite fields the extension returns as Numbers (the menu of arcade_spriteProperty minus `data`).
const SPRITE_NUMBER_PROPERTIES = new Set(['x','y','left','right','top','bottom','vx','vy','ax','ay','fx','fy','sx','sy','scale',
    'width','height','z','lifespan','rotation','rotationDegrees','kind','flags']);
const semantic = block => JSON.stringify([block.opcode,block.fields,block.inputs,block.next,
    block.mutation,block.shadow,block.parent,block.topLevel]);
const scoreRegistrations = new WeakMap();
const scoreInfoOwner = Symbol('actual Arcade score declaration owner');
const scoreAdapters = new WeakMap();
const scoreSourceRows = new WeakMap();
const scoreIssue = Symbol('actual Arcade score metadata issuance');
const scoreIssues = new WeakMap();
// Only the constructor hook can capture the genuine source delegates before
// an adapter escapes. Result evidence never grants operand/body authority.
const sourceAdapters = new WeakMap(),sourcePrepared = new WeakMap();
const sourceDescriptor=Object.getOwnPropertyDescriptor,sourceDefine=Object.defineProperty,sourcePrototype=Object.getPrototypeOf,sourceKeys=Reflect.ownKeys,sourceApply=Reflect.apply,sourceText=String;
const sourceAppend=(array,value)=>sourceDefine(array,sourceText(array.length),{__proto__:null,value,writable:true,enumerable:true,configurable:true});
const sourceWeakGet=WeakMap.prototype.get,sourceWeakSet=WeakMap.prototype.set,sourceWeakHas=WeakMap.prototype.has;
const sourceHeld=owner=>sourceApply(sourceWeakGet,sourceAdapters,[owner]);
const sourceOpcodes = ['sourceValueBinary','sourceValueUnary','highScore'];
const sourceNames=owner=>sourceOpcodes.filter(name=>name!=='highScore'||typeof owner.isHighScoreCurrent==='function');
function bindSourceOperationAdapter(adapter,instance,owner) {
    if(!owner?.isInstance(instance)||typeof owner.isSourceCurrent!=='function'||!owner.isSourceCurrent())throw Error('Arcade source result owner differs');
    if(sourceApply(sourceWeakHas,sourceAdapters,[owner]))throw Error('Arcade source result adapter was already bound');
    const delegates=sourceNames(owner).map(name=>sourceDescriptor(adapter,name)?.value);
    if(delegates.some(delegate=>typeof delegate!=='function')||sourceDescriptor(adapter,'_inst')?.value!==instance)throw Error('Arcade source result delegates are missing');
    sourceApply(sourceWeakSet,sourceAdapters,[owner,{adapter,instance,delegates}]);
}
const sourceAdapterCurrent=(owner,name=null)=>{
    const held=sourceHeld(owner);
    if(!held||!(name==='highScore'?owner.isHighScoreCurrent?.():owner.isSourceCurrent())||!owner.isInstance(held.instance)||sourceDescriptor(held.adapter,'_inst')?.value!==held.instance)return false;
    const names=sourceNames(owner);for(let i=0;i<names.length;i++)if((name==='highScore'?names[i]==='highScore':names[i]!=='highScore')&&sourceDescriptor(held.adapter,names[i])?.value!==held.delegates[i])return false;
    return true;
};
const sourcePreparedRecord=func=>sourceApply(sourceWeakGet,sourcePrepared,[func]);
const sourceMember=(list,value)=>{
    if(!list)return false;
    const size=sourceDescriptor(list,'length')?.value;if(typeof size!=='number')return false;
    for(let i=0;i<size;i++)if(sourceDescriptor(list,sourceText(i))?.value===value)return true;
    return false;
};
function registerSourceResultFactory(metadata,adapter,owner,name){
    resultFactory.register(metadata,(serviceObject,funcName,preparedInfo)=>{
        try{
            const held=sourceHeld(owner),index=sourceNames(owner).indexOf(name);
            if(!held||held.adapter!==adapter||serviceObject!==adapter||funcName!==name||!sourceAdapterCurrent(owner,name)||
                sourceDescriptor(preparedInfo,'opcode')?.value!==name||sourceDescriptor(preparedInfo,'blockType')?.value!=='reporter'||
                sourceDescriptor(preparedInfo,'isDynamic')?.value)return null;
            const record={owner,adapter,name,delegate:held.delegates[index],info:preparedInfo,valid:true};
            const func=(args,util)=>{
                // Preserve the original one dynamic property read/call and
                // receiver/three arguments. A forwarding/replacement method
                // still executes; it can never regain Number evidence by ABA.
                if(sourceDescriptor(serviceObject,funcName)?.value!==record.delegate)record.valid=false;
                return serviceObject[funcName](args,util,preparedInfo);
            };
            sourceApply(sourceWeakSet,sourcePrepared,[func,record]);return func;
        }catch(_){return null;} // Optional result evidence cannot break old dispatch.
    });
}
const sourceSameDescriptor=(a,b)=>{
    if(!a||!b)return a===b;
    const fields=['value','writable','get','set','enumerable','configurable'];
    for(let i=0;i<fields.length;i++){
        const key=fields[i],aa=sourceDescriptor(a,key),bb=sourceDescriptor(b,key);
        if(!!aa!==!!bb||aa&&aa.value!==bb.value)return false;
    }
    return true;
};
const sourceLookup=(runtime,getter)=>{
    const rows=[];let object=runtime;
    while(object){
        const descriptor=sourceDescriptor(object,'getOpcodeFunction'),prototype=sourcePrototype(object);sourceAppend(rows,{object,descriptor,prototype});
        if(descriptor){
            if(descriptor.value!==getter)return null;
            return ()=>{for(let i=0;i<rows.length;i++){const row=rows[i];if(sourcePrototype(row.object)!==row.prototype||!sourceSameDescriptor(sourceDescriptor(row.object,'getOpcodeFunction'),row.descriptor))return false;}return true;};
        }
        object=prototype;
    }
    return null;
};
const sourceSchema=(node,name,all)=>{
    const rows=[],keyRows=[];
    const data=(object,key)=>{const d=sourceDescriptor(object,key);if(!d||!sourceDescriptor(d,'value'))throw Error('source result schema data differs');sourceAppend(rows,{object,key,descriptor:d});return d.value;};
    const keys=(object,expected)=>{const saved=sourceKeys(object);if(saved.length!==expected.length||saved.some((key,index)=>key!==expected[index]))throw Error('source result schema keys differ');sourceAppend(keyRows,{object,keys:saved});};
    try{
        if(data(node,'opcode')!=='arcade_'+name||data(node,'shadow')!==false||data(node,'topLevel')!==false||data(node,'next')!=null||sourceDescriptor(node,'mutation')?.value!=null)return null;
        sourceAppend(rows,{object:node,key:'mutation',descriptor:sourceDescriptor(node,'mutation')});
        const fields=data(node,'fields'),inputs=data(node,'inputs'),id=data(node,'id'),parentId=data(node,'parent');if(typeof id!=='string'||typeof parentId!=='string')return null;keys(fields,name==='highScore'?[]:['OP']);
        const selector=name==='highScore'?null:data(fields,'OP'),op=selector&&data(selector,'value'),slots=name==='highScore'?[]:name==='sourceValueBinary'?['LEFT','RIGHT']:['VALUE'];
        if(name!=='highScore'&&(name==='sourceValueBinary'?!['&','|','^','<<','>>','>>>'].includes(op):op!=='~'))return null;
        keys(inputs,slots);
        for(const slot of slots){const edge=data(inputs,slot),childId=data(edge,'block');if(typeof childId!=='string')return null;const child=data(all,childId);if(data(child,'parent')!==id)return null;}
        const parent=data(all,parentId),parentInputs=data(parent,'inputs'),parentKeys=sourceKeys(parentInputs);sourceAppend(keyRows,{object:parentInputs,keys:parentKeys});
        let count=0;for(const key of parentKeys)if(data(data(parentInputs,key),'block')===id)count++;
        if(count!==1)return null;
        return ()=>{
            for(let i=0;i<rows.length;i++){const row=rows[i];if(!sourceSameDescriptor(sourceDescriptor(row.object,row.key),row.descriptor))return false;}
            for(let i=0;i<keyRows.length;i++){const row=keyRows[i],actual=sourceKeys(row.object);if(actual.length!==row.keys.length)return false;for(let j=0;j<actual.length;j++)if(actual[j]!==row.keys[j])return false;}
            return true;
        };
    }catch(_){return null;}
};
let scoreIssueSerial = 0;
// Only the actual finite player literals can select this existing score role.
// Do not execute a tag, getter, toString or valueOf to establish that identity.
const fixedScorePlayer = value => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 4 ? value :
    typeof value === 'string' && /^[1-4]$/.test(value) ? value.charCodeAt(0) - 48 : null;
function scoreInfo(info,owner) {
    const entries=info?.id==='arcade'&&info.blocks?.filter(block=>block.opcode==='getPlayerScore');
    if(entries?.length!==1||!owner)throw Error('Arcade score declaration owner is missing');
    Object.defineProperty(entries[0],scoreInfoOwner,{value:owner,enumerable:true});
    scoreSourceRows.set(entries[0],owner);
    if(typeof owner.isSourceCurrent==='function')for(const name of sourceNames(owner)){
        const rows=info.blocks.filter(block=>block.opcode===name);if(rows.length!==1)continue;
        Object.defineProperty(rows[0],scoreInfoOwner,{value:owner,enumerable:true});scoreSourceRows.set(rows[0],owner);
    }
    return info;
}
function scoreAdapterCurrent(owner,record) {
    return !!record&&record.valid&&owner.isCurrent()&&owner.isInstance(record.instance)&&
        Object.getOwnPropertyDescriptor(record.adapter,'_inst')?.value===record.instance&&
        Object.getOwnPropertyDescriptor(record.adapter,'getPlayerScore')?.value===record.delegate&&
        Object.getPrototypeOf(record.adapter)===record.prototype&&!Object.prototype.hasOwnProperty.call(record.adapter,'getInfo')&&
        Object.getOwnPropertyDescriptor(record.prototype,'getInfo')?.value===record.getInfo;
}
function bindScoreAdapterInfo(info,adapter,instance) {
    const entry=info?.id==='arcade'&&info.blocks?.find(block=>block.opcode==='getPlayerScore');
    const owner=entry&&Object.getOwnPropertyDescriptor(entry,scoreInfoOwner)?.value;
    if(scoreSourceRows.get(entry)!==owner||!owner?.isInstance(instance)||!owner.isCurrent())throw Error('Arcade score adapter source owner differs');
    const delegate=Object.getOwnPropertyDescriptor(adapter,'getPlayerScore')?.value;
    if(Object.getOwnPropertyDescriptor(adapter,'_inst')?.value!==instance||typeof delegate!=='function')throw Error('Arcade score adapter delegate is missing');
    const existing=scoreAdapters.get(owner);
    if(existing){if(existing.adapter!==adapter||existing.instance!==instance||existing.delegate!==delegate)existing.valid=false;}
    else {
        const prototype=Object.getPrototypeOf(adapter),getInfo=Object.getOwnPropertyDescriptor(prototype,'getInfo')?.value;
        if(typeof getInfo!=='function'||Object.prototype.hasOwnProperty.call(adapter,'getInfo'))throw Error('Arcade score adapter getInfo owner differs');
        scoreAdapters.set(owner,{adapter,instance,delegate,prototype,getInfo,valid:true});
    }
    // Only genuine source getInfo rows may issue metadata. The ExtensionManager
    // shallow preparation preserves this token and the actual argument schema.
    if(!scoreAdapterCurrent(owner,scoreAdapters.get(owner)))throw Error('Arcade score adapter issuance owner differs');
    if(Object.prototype.hasOwnProperty.call(entry,scoreIssue))throw Error('Arcade score metadata row was already issued');
    const token=Object.freeze({});
    const sourceRows=typeof owner.isSourceCurrent==='function'?sourceNames(owner).map(name=>{const row=info.blocks.find(block=>block.opcode===name);
        if(!row||scoreSourceRows.get(row)!==owner||Object.getOwnPropertyDescriptor(row,scoreInfoOwner)?.value!==owner)return null;
        try{registerSourceResultFactory(row,adapter,owner,name);}catch(_){return null;}
        return {name,arguments:row.arguments};}):[];
    scoreIssues.set(token,{owner,adapter:scoreAdapters.get(owner),arguments:entry.arguments,sourceRows:sourceRows.some(row=>!row)?[]:sourceRows,serial:++scoreIssueSerial,consumed:false});
    Object.defineProperty(entry,scoreIssue,{value:token,enumerable:true});
}
// Initial registration and ordinary refresh consume genuine, single-use source
// metadata issuances. Reading the current primitive alone never grants renewal.
function scoreRegistration(runtime,owner) {
    if (!runtime || typeof runtime.on!=='function' || !owner) return null;
    const existing=scoreRegistrations.get(runtime);
    if(existing)return existing.owner===owner ? existing : null;
    // Lazy require: actual Runtime has completed module construction before an
    // Arcade instance exists. The immutable accessor only reads Runtime-private
    // origins allocated before any extension callback; it cannot register one.
    const NativeRuntime=require('../../../engine/runtime');
    const originDescriptor=sourceDescriptor(NativeRuntime,'sourceResultOrigins');
    const originReader=originDescriptor&&!originDescriptor.writable&&!originDescriptor.configurable&&originDescriptor.value;
    const sourceOrigin=typeof originReader==='function'?sourceApply(originReader,null,[runtime]):null;
    const sourceTable=sourceOrigin?.table,sourceCategories=sourceOrigin?.categories;
    const getter=runtime.getOpcodeFunction;
    const record={owner,category:null,entry:null,func:null,valid:true,reason:null,disposed:false,targets:new Set(),getter,serial:0,sourceOperations:[]};
    const refuseRegistration=reason=>{record.valid=false;record.reason=reason;};
    const capture=(category,refresh=false)=>{
        if(category?.id!=='arcade')return;
        if(!record.valid)return;
        if(refresh ? !record.category||category!==record.category : !!record.category){refuseRegistration(refresh?'refresh category identity differs':'registration was republished');return;}
        const categoryOrigin=typeof originReader==='function'?sourceApply(originReader,null,[runtime,category]):null;
        const sourceBlocks=categoryOrigin?.blocks;
        const entries=(category.blocks||[]).filter(value=>value.json?.type==='arcade_getPlayerScore');
        const entry=entries.length===1&&entries[0],func=entry?.info?.func;
        const adapter=scoreAdapters.get(owner);
        const issue=scoreIssues.get(entry?.info?.[scoreIssue]);
        if(!issue||issue.consumed||issue.serial<=record.serial||issue.owner!==owner||issue.adapter!==adapter||issue.arguments!==entry?.info?.arguments){refuseRegistration('metadata issuance is missing, stale or foreign');return;}
        // _prepareBlockInfo's Object.assign preserves the private row Symbol;
        // runtime retains that exact prepared row as convertedBlock.info.
        if(entry?.info?.[scoreInfoOwner]!==owner){refuseRegistration('original declaration owner differs');return;}
        if(!scoreAdapterCurrent(owner,adapter)){refuseRegistration('original implementation or adapter differs');return;}
        if(!runtime._blockInfo?.includes(category)){refuseRegistration('original category is not installed');return;}
        if(typeof func!=='function'){refuseRegistration('original score primitive is missing');return;}
        if(typeof getter!=='function'){refuseRegistration('original primitive lookup is missing');return;}
        if(runtime.getOpcodeFunction!==getter){refuseRegistration('original primitive lookup changed');return;}
        if(getter.call(runtime,'arcade_getPlayerScore')!==func){refuseRegistration('original score primitive differs');return;}
        // Commit the old score facet before optional source-result lookups.
        // A newfacet lookup failure must not disable the established score role.
        issue.consumed=true;record.serial=issue.serial;
        record.category=category;record.entry=entry;record.func=func;record.adapter=adapter;
        const sourceOperations=[];
        try {
            for(const row of issue.sourceRows||[]){
                const matches=(category.blocks||[]).filter(value=>value.json?.type==='arcade_'+row.name),prepared=matches.length===1&&matches[0];
                if(!prepared||prepared.info?.[scoreInfoOwner]!==owner||prepared.info?.arguments!==row.arguments||typeof prepared.info?.func!=='function'||sourceApply(getter,runtime,['arcade_'+row.name])!==prepared.info.func){sourceOperations.length=0;break;}
                const bound=sourcePreparedRecord(prepared.info.func),lookupCurrent=sourceLookup(runtime,getter);
                if(!sourceOrigin||!categoryOrigin||sourceDescriptor(runtime,'_primitives')?.value!==sourceTable||sourceDescriptor(runtime,'_blockInfo')?.value!==sourceCategories||sourceDescriptor(category,'blocks')?.value!==sourceBlocks||!lookupCurrent||!bound||bound.owner!==owner||bound.adapter!==adapter.adapter||bound.name!==row.name||bound.info!==prepared.info||!bound.valid){sourceOperations.length=0;break;}
                sourceAppend(sourceOperations,{name:row.name,entry:prepared,func:prepared.info.func,bound,lookupCurrent,table:sourceTable,categories:sourceCategories,blocks:sourceBlocks});
            }
        }catch(_){sourceOperations.length=0;}
        record.sourceOperations=sourceOperations;
    };
    scoreRegistrations.set(runtime,record);
    const categories=(runtime._blockInfo||[]).filter(value=>value.id==='arcade');
    // This constructor precedes its genuine builtin registration. Never turn
    // an arbitrary preexisting same-opcode category into a producer certificate.
    if(categories.length)refuseRegistration('registration existed before this implementation');
    runtime.on('EXTENSION_ADDED',capture);
    runtime.on('BLOCKSINFO_UPDATE',category=>capture(category,true));
    runtime.on('RUNTIME_DISPOSED',()=>{record.disposed=true;});
    runtime.on('PROJECT_LOADED',()=>{
        // VM.loadProject disposes the previous target graph, retaining builtins.
        // Resume only for new targets under the identical captured registration;
        // the old local inspector stays disposed and cannot borrow this renewal.
        if(record.disposed&&runtime.targets?.length&&runtime.targets.every(target=>!record.targets.has(target))&&
            record.valid&&scoreAdapterCurrent(owner,record.adapter)&&runtime.getOpcodeFunction===getter&&
            getter.call(runtime,'arcade_getPlayerScore')===record.func){record.disposed=false;record.targets=new Set(runtime.targets);}
    });
    return record;
}

function primitive(value) {
    if (value === null || ['undefined','string','number','boolean'].includes(typeof value)) return value;
    if (!value || typeof value !== 'object') throw new Error('opaque inspection value');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Object.keys(descriptors).filter(key => descriptors[key].enumerable);
    if (keys.length !== 1) throw new Error('reference or opaque inspection value');
    const field = descriptors[keys[0]];
    if (!Object.prototype.hasOwnProperty.call(field,'value')) throw new Error('inspection accessor');
    if (keys[0] === 'bwUndefined' && field.value === true) return undefined;
    if (keys[0] === 'bwNumber' && ['NaN','Infinity','-Infinity','-0'].includes(field.value))
        return field.value === 'NaN' ? NaN : field.value === '-0' ? -0 : Number(field.value);
    throw new Error('reference or opaque inspection value');
}

function create(runtime, cells, scoreOwner=null, sceneClock=null, frameDelta=null) {
    let snapshots = new Map(), disposed = false, active = false;
    const bound = !!runtime && typeof runtime.on === 'function' && Array.isArray(runtime.targets);
    const score=scoreRegistration(runtime,scoreOwner);
    const fail = reason => {throw new Error('Arcade inspection: ' + reason);};
    // The graph is unchanged while every original target's container keeps its edit version,
    // its variable table keeps its size and the target list is the one last verified in full.
    let verifiedStamp = null, proofs = new Map();
    const stampOf = () => {
        const originals = runtime.targets.filter(target => target.isOriginal !== false);
        const parts = [originals.length];
        for (const target of originals) {
            const version = graphVersion.versionOf(target.blocks);
            if (version < 0) return null;
            parts.push(version, Object.keys(target.variables || {}).length);
        }
        return {originals, key: parts.join(','), targets: originals};
    };
    const current = () => {
        if (!bound || disposed || !snapshots.size) fail('inactive native owner; start the current project');
        const stamp = stampOf();
        if (stamp && verifiedStamp && verifiedStamp.key === stamp.key && verifiedStamp.targets.length === stamp.targets.length &&
            verifiedStamp.targets.every((target, index) => target === stamp.targets[index])) return;
        currentFull();
        verifiedStamp = stamp;
    };
    const currentFull = () => {
        const originals = runtime.targets.filter(target => target.isOriginal !== false);
        if (originals.length !== snapshots.size || originals.some(target => {
            const saved = snapshots.get(target), blocks = Object.entries(target.blocks?._blocks || {}), variables=Object.entries(target.variables||{});
            return !saved || saved.container !== target.blocks || blocks.length !== saved.blocks.size ||
                variables.length!==saved.variables.size || variables.some(([id,variable])=>saved.variables.get(id)?.variable!==variable || saved.variables.get(id)?.signature!==JSON.stringify([variable.id,variable.name,variable.type])) ||
                blocks.some(([id,block]) => saved.blocks.get(id)?.block !== block || saved.blocks.get(id)?.semantic !== semantic(block));
        })) fail('source graph changed; restart the project');
    };
    const snapshot = () => {
        snapshots = new Map();verifiedStamp = null;proofs = new Map();
        if (!bound || disposed) return;
        for (const target of runtime.targets) if (target.isOriginal !== false) graphVersion.track(target.blocks);
        if(score&&!score.disposed)score.targets=new Set(runtime.targets);
        for (const target of runtime.targets) if (target.isOriginal !== false)
            snapshots.set(target,{stage:target.isStage===true,container:target.blocks,variables:new Map(Object.entries(target.variables||{}).map(([id,variable])=>[id,{variable,signature:JSON.stringify([variable.id,variable.name,variable.type])}])),blocks:new Map(Object.entries(target.blocks._blocks).map(([id,block]) =>
                [id,{block,semantic:semantic(block)}]))});
    };
    const prove = (target, block, requested=null, possible=null, util=null, args=null, liveProof=null) => {
        let structural=false;
        const nativeCell=id=>{
            const local=id&&snapshots.get(target)?.variables.get(id),stages=id&&!local?[...snapshots].filter(([,saved])=>saved.stage):[];
            const owner=local?target:stages.length===1?stages[0][0]:null,saved=local||stages.length===1&&stages[0][1].variables.get(id),table=owner&&sourceDescriptor(owner,'variables')?.value;
            return saved&&sourceDescriptor(table,id)?.value===saved.variable&&sourceDescriptor(owner,'variables')?.value===table?saved.variable:null;
        };
        const all = target.blocks._blocks, read = id => target.blocks.getBlock(id);
        const input = (node,name) => read(node?.inputs?.[name]?.block);
        const text = node => node?.opcode === 'text' ? node.fields?.TEXT?.value : null;
        const literal = (node,name) => node?.fields?.[name]?.value ?? text(input(node,name));
        let scoreRefusal=null;
        const refuseScore=reason=>{scoreRefusal=reason;return false;};
        const scoreDetail=()=>scoreRefusal?' (score producer: '+scoreRefusal+')':'';
        const scoreNumber=node=>{
            if(!score?.valid)return refuseScore(score?'original registration invalid: '+score.reason:'original registration unavailable');
            if(score.disposed)return refuseScore('registration suspended');
            if(!score.category)return refuseScore('original registration missing');
            if(!scoreOwner.isCurrent())return refuseScore('implementation changed');
            if(!scoreAdapterCurrent(scoreOwner,score.adapter))return refuseScore('adapter changed');
            if(runtime.getOpcodeFunction!==score.getter)return refuseScore('primitive lookup changed');
            if(score.getter.call(runtime,'arcade_getPlayerScore')!==score.func)return refuseScore('score primitive changed');
            if(!runtime._blockInfo?.includes(score.category))return refuseScore('registered category changed');
            if(score.category.id!=='arcade')return refuseScore('registered category identity changed');
            if(score.category.blocks?.filter(entry=>entry.json?.type==='arcade_getPlayerScore').length!==1)return refuseScore('registered score declaration is missing or ambiguous');
            if(!score.category.blocks?.includes(score.entry))return refuseScore('registered score declaration changed');
            if(score.entry.json?.type!=='arcade_getPlayerScore')return refuseScore('registered score opcode changed');
            if(score.entry.info?.[scoreInfoOwner]!==scoreOwner)return refuseScore('registered source owner changed');
            if(score.entry.info?.func!==score.func)return refuseScore('registered score function changed');
            if(node.shadow!==false||node.topLevel!==false||node.next!=null||node.mutation!=null||Object.keys(node.fields||{}).length||
                Object.keys(node.inputs||{}).join(',')!=='PLAYER')return refuseScore('score reporter schema differs');
            const player=input(node,'PLAYER');
            if(!player||player.parent!==node.id||player.opcode!=='math_number'||player.shadow!==true||player.topLevel!==false||player.next!=null||player.mutation!=null||
                Object.keys(player.inputs||{}).length||Object.keys(player.fields||{}).join(',')!=='NUM')return refuseScore('fixed player shadow schema differs');
            const numberField=Object.getOwnPropertyDescriptor(player.fields,'NUM')?.value;
            const selectedPlayer=fixedScorePlayer(numberField&&Object.getOwnPropertyDescriptor(numberField,'value')?.value);
            if(selectedPlayer===null)return refuseScore('fixed player literal differs');
            const parent=read(node.parent);
            if(!parent||Object.values(parent.inputs||{}).filter(slot=>slot.block===node.id).length!==1)return refuseScore('score parent ownership differs');
            const root=util?.thread?.peekStack?.(),operations=target.blocks._cache?._executeCached?.[root]?._ops||[];
            const reachable=new Set();
            const visit=id=>{if(reachable.has(id))return;reachable.add(id);for(const slot of Object.values(read(id)?.inputs||{}))if(slot.block)visit(slot.block);};visit(root);
            if(reachable.has(node.id)){
                const actual=operations.filter(operation=>operation.id===node.id);
                if(actual.length!==1)return refuseScore('active score cache is missing or ambiguous');
                const operation=actual[0];
                try{if(reporterOwner(runtime,util,operation._argValues,'arcade_getPlayerScore',[])!==node)return refuseScore('active score primitive ownership differs');}catch{return refuseScore('active score primitive ownership refused');}
                const shadow=target.blocks._cache?._executeCached?.[player.id];
                if(operation._blockFunction!==score.func)return refuseScore('active score function differs');
                if(Object.keys(operation._argValues||{}).sort().join(',')!=='PLAYER,mutation')return refuseScore('active score argument schema differs');
                if(operation._argValues.mutation!==operation.mutation||operation.mutation!==node.mutation)return refuseScore('active score mutation differs');
                const cachedPlayer=Object.getOwnPropertyDescriptor(operation._argValues,'PLAYER')?.value;
                if(fixedScorePlayer(cachedPlayer)!==selectedPlayer)return refuseScore('active player argument differs');
                if(shadow?.id!==player.id||shadow.opcode!=='math_number'||shadow.fields!==player.fields||
                    shadow.inputs!==target.blocks.getInputs(player))return refuseScore('active player shadow cache differs');
                if(shadow._isShadowBlock!==true||Object.getOwnPropertyDescriptor(shadow,'_shadowValue')?.value!==cachedPlayer||
                    shadow._parentValues!==operation._argValues||shadow._parentKey!=='PLAYER')return refuseScore('active player shadow value or ownership differs');
                if(!operation._parentValues||typeof operation._parentValues[operation._parentKey]!=='number')return refuseScore('active score result is not native Number');
            }
            return true;
        };
        const sourceNumber=node=>{
            // Only Number-on-normal-return; operands still execute and validate.
            const name=node.opcode==='arcade_sourceValueBinary'?'sourceValueBinary':node.opcode==='arcade_sourceValueUnary'?'sourceValueUnary':node.opcode==='arcade_highScore'?'highScore':null;
            if(!score?.valid||score.disposed||!score.category||!scoreAdapterCurrent(scoreOwner,score.adapter)||!sourceAdapterCurrent(scoreOwner,name)||runtime.getOpcodeFunction!==score.getter)return false;
            let row;for(let i=0;i<score.sourceOperations.length;i++)if(score.sourceOperations[i].name===name)row=score.sourceOperations[i];
            if(!row)return false;
            const schema=sourceSchema(node,name,all);if(!schema)return false;
            const category=score.category,opcode='arcade_'+name,actual=sourceApply(score.getter,runtime,[opcode]),oldFacetCurrent=scoreAdapterCurrent(scoreOwner,score.adapter);current();
            // Complete potentially trapping source reflection before final
            // membership and private revocation checks. These reflections do
            // not mint or renew a registration or operand proof.
            if(actual!==row.func||!oldFacetCurrent||!row.lookupCurrent()||
                sourceDescriptor(runtime,'_primitives')?.value!==row.table)return false;
            // A completed direct writer may be inspected later. Admit only its
            // current actual native Number cell; no String/handle or historical
            // result claim follows from the writer's opcode.
            const parent=name==='highScore'&&read(node.parent),cellId=parent?.opcode==='data_setvariableto'&&parent.inputs?.VALUE?.block===node.id&&parent.fields?.VARIABLE?.id;
            const cell=nativeCell(cellId);
            const currentNumberCell=cell&&typeof sourceDescriptor(cell,'value')?.value==='number';
            if(name==='highScore')liveProof?.(); // Recheck live Number/owner evidence on every query; never cache it by graph stamp.
            const root=util?.thread?.peekStack?.(),operations=target.blocks._cache?._executeCached?.[root]?._ops||[];
            if(!currentNumberCell){
            let operation,count=0;
            for(let i=0;i<operations.length;i++)if(operations[i].id===node.id){operation=operations[i];count++;}
            if(count!==1||operation._blockFunction!==row.func)return false;
            // Join the actual already-executed source reporter, not merely a
            // current table entry restored after a foreign cached function ran.
            const actualArgs=operation._argValues,slots=name==='highScore'?[]:name==='sourceValueBinary'?['LEFT','RIGHT']:['VALUE'];
            const expectedKeys=name==='highScore'?['mutation']:name==='sourceValueBinary'?['LEFT','RIGHT','OP','mutation']:['VALUE','OP','mutation'];
            const actualKeys=sourceKeys(actualArgs||{});if(actualKeys.length!==expectedKeys.length)return false;
            for(let i=0;i<expectedKeys.length;i++){let found=false;for(let j=0;j<actualKeys.length;j++)if(actualKeys[j]===expectedKeys[i])found=true;if(!found)return false;}
            if(name!=='highScore'&&sourceDescriptor(actualArgs,'OP')?.value!==sourceDescriptor(sourceDescriptor(node.fields,'OP')?.value,'value')?.value||
                sourceDescriptor(actualArgs,'mutation')?.value!==operation.mutation||operation.mutation!==node.mutation)return false;
            for(let i=0;i<slots.length;i++){
                const child=read(node.inputs[slots[i]].block),cached=child&&target.blocks._cache?._executeCached?.[child.id];
                if(!child||child.parent!==node.id||!sourceDescriptor(actualArgs,slots[i]))return false;
                // Cached native evaluator links are present for inline shadow
                // inputs; reporter child operations share the parent values.
                const childOperation=operations.find(value=>value.id===child.id);
                if(childOperation&&(childOperation._parentValues!==actualArgs||childOperation._parentKey!==slots[i]))return false;
                if(!childOperation&&cached&&cached._parentValues&&
                    (cached._parentValues!==actualArgs||cached._parentKey!==slots[i]))return false;
            }
            try{if(reporterOwner(runtime,util,actualArgs,opcode,name==='highScore'?[]:['OP'])!==node)return false;}catch(_){return false;}
            if(!operation._parentValues||typeof sourceDescriptor(operation._parentValues,operation._parentKey)?.value!=='number')return false;
            }
            if(!schema()||currentNumberCell&&(nativeCell(cellId)!==cell||typeof sourceDescriptor(cell,'value')?.value!=='number'))return false;
            const reflected=sourceDescriptor(row.entry,'info')?.value===row.bound.info&&
                sourceDescriptor(row.bound.info,scoreInfoOwner)?.value===scoreOwner&&
                sourceDescriptor(row.bound.info,'func')?.value===row.func&&sourceAdapterCurrent(scoreOwner,name);
            // Runtime-private construction origins close these containers; no
            // observational shape or constructor-time snapshot proves native origin.
            // No reflective schema/table work follows these
            // native membership reads and closed private latches.
            return reflected&&sourceDescriptor(runtime,'_primitives')?.value===row.table&&
                sourceDescriptor(runtime,'_blockInfo')?.value===row.categories&&
                sourceDescriptor(category,'blocks')?.value===row.blocks&&sourceDescriptor(row.table,opcode)?.value===row.func&&
                sourceMember(row.categories,category)&&sourceMember(row.blocks,row.entry)&&
                score.valid&&!score.disposed&&score.category===category&&
                sourcePreparedRecord(row.func)===row.bound&&row.bound.valid;

        };
        const captureProof=analyseCaptures({targets:runtime.targets.filter(value=>value.isOriginal!==false),blocks:value=>value.blocks._blocks,
            input:(node,name,owner)=>owner.blocks.getBlock(node?.inputs?.[name]?.block),
            literal:(node,name,owner)=>node?.fields?.[name]?.value??(owner.blocks.getBlock(node?.inputs?.[name]?.block)?.opcode==='text'?owner.blocks.getBlock(node.inputs[name].block).fields?.TEXT?.value:null)});
        const owners = new Map(), seen = new Map([[false,new Set()],[true,new Set()]]);
        const localPositionalElement=node=>{
            const index=input(node,'INDEX'),receiver=input(node,'ARRAY');
            const k=index?.opcode==='math_number'&&index.shadow===true?Number(index.fields?.NUM?.value):NaN;
            if(!Number.isSafeInteger(k)||k<0||String(index.fields?.NUM?.value).trim()===''||receiver?.opcode!=='arcade_getLocal'||
                index.parent!==node.id||receiver.parent!==node.id||Object.keys(index.inputs||{}).length||index.next!=null||receiver.next!=null)return null;
            const closedInputs=(b,names)=>Object.keys(b?.inputs||{}).sort().join(',')===names.slice().sort().join(',');
            const primitiveLiteral=b=>{
                if(!b||b.next!=null)return false;
                const fields=b.fields||{},keys=Object.keys(fields);
                // The importer wraps an ordinary Number literal as 0 + N.
                // Admit only its exact closed two-shadow numeric shape.
                if(b.opcode==='operator_add'){
                    if(keys.length||!closedInputs(b,['NUM1','NUM2']))return false;
                    const left=input(b,'NUM1'),right=input(b,'NUM2');
                    const numeric=n=>n?.opcode==='math_number'&&n.shadow===true&&n.parent===b.id&&n.next==null&&
                        !Object.keys(n.inputs||{}).length&&Object.keys(n.fields||{}).join(',')==='NUM'&&
                        ['string','number'].includes(typeof n.fields.NUM?.value)&&String(n.fields.NUM.value).trim()!==''&&Number.isFinite(Number(n.fields.NUM.value));
                    return numeric(left)&&numeric(right)&&Number(left.fields.NUM.value)===0;
                }
                if(Object.keys(b.inputs||{}).length)return false;
                if(b.opcode==='text')return keys.length===1&&keys[0]==='TEXT'&&typeof fields.TEXT?.value==='string';
                if(b.opcode==='math_number'){
                    const raw=fields.NUM?.value;
                    return keys.length===1&&keys[0]==='NUM'&&['string','number'].includes(typeof raw)&&
                        String(raw).trim()!==''&&Number.isFinite(Number(raw));
                }
                return b.opcode==='arrays_specialValue'&&keys.length===1&&keys[0]==='KIND'&&
                    ['null','undefined','NaN','Infinity','-Infinity','-0'].includes(fields.KIND?.value);
            };
            const localName=b=>closedInputs(b,['NAME'])&&input(b,'NAME')?.opcode==='text'&&input(b,'NAME').parent===b.id&&input(b,'NAME').next==null&&Object.keys(input(b,'NAME').inputs||{}).length===0?literal(b,'NAME'):null;
            const name=localName(receiver),scope=captureProof.scopeOf(receiver);
            if(typeof name!=='string'||!scope||scope.target!==target||captureProof.scopeOf(node)!==scope||
                !['arcade_whenSourceStarts','procedures_definition'].includes(scope.root.opcode))return null;
            const cell=captureProof.local(scope,name),proof=captureProof.proof(cell);
            if(!proof||proof.escaped||proof.index!==-1)return null;
            const chain=[],visited=new Set();let previous=scope.root;
            for(let b=read(previous.next);b;b=read(b.next)){
                if(visited.has(b)||b.parent!==previous.id)return null;
                visited.add(b);chain.push(b);previous=b;
            }
            let statement=node;const climbed=new Set();
            while(statement&&!chain.includes(statement)&&!climbed.has(statement)){climbed.add(statement);statement=read(statement.parent);}
            const end=chain.indexOf(statement);if(end<0)return null;
            // The endpoint's inputs execute too. Closing only the preceding
            // statements would let an earlier sibling call run before this read.
            // Admit a closed primitive expression tree, not an unknown effect.
            const endpointSeen=new Set();
            const endpoint=b=>{
                if(!b||endpointSeen.has(b))return false;endpointSeen.add(b);
                if(b===node)return closedInputs(b,['ARRAY','INDEX']);
                if(['math_number','text','arrays_specialValue','operator_add'].includes(b.opcode))return primitiveLiteral(b);
                let valid=b.opcode==='arcade_inspectValue'&&closedInputs(b,['VALUE','LIMIT'])||
                    b.opcode==='arcade_functionArgument'&&closedInputs(b,['VALUE','REST']);
                if(b===statement)valid=b.opcode==='data_setvariableto'&&closedInputs(b,['VALUE'])||
                    b.opcode==='arcade_setLocal'&&closedInputs(b,['NAME','VALUE'])||b.opcode==='procedures_call';
                return !!valid&&Object.values(b.inputs||{}).every(edge=>{const child=read(edge.block);return child?.parent===b.id&&endpoint(child);});
            };
            if(!endpoint(statement))return null;
            let allocation=-1;const resets=[];
            for(const {node:writer,scope:writerScope}of proof.writers){
                if(writerScope!==scope||writer.opcode!=='arcade_setLocal')return null;
                const at=chain.indexOf(writer),value=input(writer,'VALUE');if(at<0||at>=end||!closedInputs(writer,['NAME','VALUE'])||input(writer,'NAME')?.opcode!=='text'||input(writer,'NAME').parent!==writer.id||Object.keys(input(writer,'NAME').inputs||{}).length)return null;
                if(fixedReset(value)){resets.push(at);continue;}
                if(allocation>=0||value?.opcode!=='arrays_createReference'||value.parent!==writer.id||value.next!=null||!closedInputs(value,['VALUES'])||text(input(value,'VALUES'))!=='[]'||Object.keys(input(value,'VALUES').inputs||{}).length||input(value,'VALUES').parent!==value.id)return null;
                allocation=at;
            }
            if(allocation<0||resets.some(at=>at>=allocation))return null;
            const pushes=[];
            for(const b of Object.values(all)){
                if(['arcade_getCaptured','arcade_setCaptured'].includes(b.opcode)&&(typeof literal(b,'NAME')!=='string'||literal(b,'NAME')===name))return null;
                if(captureProof.scopeOf(b)!==scope||b.opcode!=='arcade_getLocal')continue;
                const found=localName(b);if(typeof found!=='string')return null;if(found!==name)continue;
                if(b===receiver)continue;
                const parent=read(b.parent),at=chain.indexOf(parent);
                const ignoredIndex=input(parent,'INDEX'),indexValue=ignoredIndex?.fields?.NUM?.value;
                if(parent?.opcode!=='arrays_mutateReference'||!closedInputs(parent,['ARRAY','OP','INDEX','VALUE'])||parent.inputs?.ARRAY?.block!==b.id||literal(parent,'OP')!=='push'||input(parent,'OP')?.opcode!=='text'||Object.keys(input(parent,'OP').inputs||{}).length||input(parent,'OP').parent!==parent.id||
                    ignoredIndex?.opcode!=='math_number'||ignoredIndex.shadow!==true||ignoredIndex.parent!==parent.id||ignoredIndex.next!=null||
                    Object.keys(ignoredIndex.inputs||{}).length||Object.keys(ignoredIndex.fields||{}).join(',')!=='NUM'||
                    !['string','number'].includes(typeof indexValue)||String(indexValue).trim()===''||!Number.isFinite(Number(indexValue))||
                    at<=allocation||at>=end)return null;
                pushes.push(parent);
            }
            // No call, branch, yield or unrelated effect can occur between the
            // fresh allocation and the read. Every element is a plain literal;
            // calls returning primitives do not gain side-effect authority.
            for(let at=allocation+1;at<end;at++)if(!pushes.includes(chain[at]))return null;
            pushes.sort((a,b)=>chain.indexOf(a)-chain.indexOf(b));
            if(pushes.some(push=>{const value=input(push,'VALUE');return !primitiveLiteral(value)||value.parent!==push.id;}))return null;
            return k<pushes.length?input(pushes[k],'VALUE'):null;
        };
        const positionalElement=node=>{
            const index=input(node,'INDEX'),receiver=input(node,'ARRAY');
            const k=index?.opcode==='math_number'&&index.shadow===true?Number(index.fields?.NUM?.value):NaN;
            if(!Number.isInteger(k)||k<0||String(index.fields?.NUM?.value).trim()===''||receiver?.opcode!=='data_variable')return null;
            const vid=receiver.fields?.VARIABLE?.id;if(typeof vid!=='string')return null;
            let writer=null,writerTarget=null;const globalResets=[];
            for(const t of runtime.targets)for(const b of Object.values(t.blocks?._blocks||{})){
                if(b.fields?.VARIABLE?.id!==vid&&b.fields?.LIST?.id!==vid)continue;
                if(b.opcode==='data_variable'){const parent=t.blocks.getBlock(b.parent);
                    // The source type declaration names the variable without writing it.
                    if(parent?.opcode==='arcade_declareSourceReference'&&parent.inputs?.VARIABLE?.block===b.id)continue;
                    if(!['arrays_referenceItem','arrays_referenceLength'].includes(parent?.opcode)||parent.inputs?.ARRAY?.block!==b.id)return null;continue;}
                if(b.opcode!=='data_setvariableto')return null;
                const resetValue=t.blocks.getBlock(b.inputs?.VALUE?.block);
                if(resetValue?.opcode==='arrays_specialValue'&&!Object.keys(resetValue.inputs||{}).length&&['undefined','null'].includes(resetValue.fields?.KIND?.value)){globalResets.push({b,t});continue;}
                if(writer)return null;writer=b;writerTarget=t;
            }
            if(!writer||writerTarget!==target)return null;
            const local=input(writer,'VALUE');if(local?.opcode!=='arcade_getLocal')return null;const name=literal(local,'NAME');if(typeof name!=='string')return null;
            // Walk the writer's script back to its hat.
            let first=writer,guard=new Set();while(first.parent&&!guard.has(first)){guard.add(first);const up=read(first.parent);if(!up||up.next!==first.id)return null;first=up;}
            // A source-start script or a procedure body: each run rebuilds and
            // publishes before the reads that follow on the same chain.
            if(!['arcade_whenSourceStarts','procedures_definition'].includes(first.opcode))return null;
            const chain=[];guard=new Set();for(let n=read(first.next);n&&!guard.has(n);n=read(n.next)){guard.add(n);chain.push(n);}
            const w=chain.indexOf(writer);if(w<0)return null;
            // Each global reset either precedes the publication on this chain, or
            // sits on a source-start script's top chain before the only call of
            // the procedure that publishes (the exporter's startup prologue).
            const topOf=(t,b0)=>{let n=b0,seen=new Set();while(n.parent&&!seen.has(n)){seen.add(n);const up=t.blocks.getBlock(n.parent);if(!up||up.next!==n.id)return null;n=up;}return n;};
            const chainOf=(t,hat)=>{const out=[],seen=new Set();for(let n=t.blocks.getBlock(hat.next);n&&!seen.has(n);n=t.blocks.getBlock(n.next)){seen.add(n);out.push(n);}return out;};
            for(const {b:reset,t:rt} of globalResets){
                if(rt===target&&chain.includes(reset)){if(chain.indexOf(reset)>=w)return null;continue;}
                if(first.opcode!=='procedures_definition')return null;
                const proto=read(first.inputs?.custom_block?.block),proccode=proto?.mutation?.proccode;if(typeof proccode!=='string')return null;
                const hat=topOf(rt,reset);if(hat?.opcode!=='arcade_whenSourceStarts')return null;
                const sChain=chainOf(rt,hat),at=sChain.indexOf(reset);if(at<0)return null;
                const callers=[];
                for(const t of runtime.targets)for(const c of Object.values(t.blocks?._blocks||{})){
                    if(c.opcode==='procedures_call'&&c.mutation?.proccode===proccode)callers.push({c,t});
                    else if(c.opcode==='arcade_callFunction'){const nameBlock=t.blocks.getBlock(c.inputs?.NAME?.block);const callName=nameBlock?.opcode==='text'?nameBlock.fields?.TEXT?.value:null;
                        if(callName===null||callName===proccode||String(callName).split(' ')[0]===proccode.split(' ')[0])callers.push({c,t});}}
                if(callers.length!==1||callers[0].t!==rt)return null;
                let callStmt=callers[0].c,climb=new Set();while(callStmt&&!sChain.includes(callStmt)&&!climb.has(callStmt)){climb.add(callStmt);callStmt=rt.blocks.getBlock(callStmt.parent);}
                if(!callStmt||sChain.indexOf(callStmt)<=at)return null;
            }
            // The read must follow the writer on the same chain.
            let stmt=node;guard=new Set();while(stmt&&!chain.includes(stmt)&&!guard.has(stmt)){guard.add(stmt);stmt=read(stmt.parent);}
            if(!stmt||chain.indexOf(stmt)<=w)return null;
            const sameLocal=b=>['arcade_setLocal','arcade_getLocal'].includes(b?.opcode)&&literal(b,'NAME')===name;
            const pushes=[],resets=[];let alloc=-1;
            for(const b of Object.values(all)){if(!sameLocal(b))continue;
                if(b===local)continue;
                if(b.opcode==='arcade_setLocal'){const value=input(b,'VALUE');
                    // A declaration reset (null/undefined) on the chain before the allocation.
                    if(fixedReset(value)){const at=chain.indexOf(b);if(at<0)return null;resets.push(at);continue;}
                    if(alloc>=0)return null;alloc=chain.indexOf(b);
                    if(alloc<0||alloc>=w||value?.opcode!=='arrays_createReference'||text(input(value,'VALUES'))!=='[]')return null;continue;}
                const parent=read(b.parent);
                if(parent?.opcode!=='arrays_mutateReference'||parent.inputs?.ARRAY?.block!==b.id||literal(parent,'OP')!=='push')return null;
                const at=chain.indexOf(parent);if(at<0)return null;pushes.push({at,parent});
            }
            if(alloc<0||resets.some(at=>at>=alloc)||pushes.some(p=>p.at<=alloc||p.at>=w))return null;
            pushes.sort((x,y)=>x.at-y.at);
            return k<pushes.length?input(pushes[k].parent,'VALUE'):null;
        };
        const mark = (node,owner,path=new Set()) => {
            if (!node || path.has(node)) return;
            path.add(node);
            if (owners.has(node) && owners.get(node) !== owner) fail('ambiguous procedure ownership');
            owners.set(node,owner);
            for (const slot of Object.values(node.inputs || {})) mark(read(slot.block),owner,path);
            mark(read(node.next),owner,path);
        };
        for (const node of Object.values(all)) if (node.topLevel)
            mark(read(node.next),node.opcode === 'procedures_definition' ? input(node,'custom_block')?.mutation?.proccode : node);
        const argumentsFor = (call,index) => {
            let argument = input(call,'ARGS');const visited = new Set();
            for (let i=0;i<=index;i++) {
                if (text(argument) === '[]') return null; // Actual omitted argument is Undefined.
                if (!argument || visited.has(argument) || argument.opcode !== 'arcade_functionArgument') return false;
                visited.add(argument);
                if (i === index) return input(argument,'VALUE') || false;
                argument=input(argument,'REST');
            }
            return false;
        };
        const terminalDomain=(node,domains)=>{
            if(!domains)return;
            const op=node.opcode;
            if(['text','bw_stringLiteral','operator_join','operator_letter_of'].includes(op))domains.add('string');
            else if(['math_number','bw_numberLiteral','operator_length','operator_add','operator_subtract','operator_multiply','operator_divide','operator_mod','operator_round','operator_random'].includes(op))domains.add('number');
            else if(['operator_equals','operator_gt','operator_lt','operator_not','operator_and','operator_or','arrays_valueTruthy','arrays_valueCompare'].includes(op))domains.add('boolean');
            else if(op==='arrays_specialValue'){const kind=literal(node,'KIND');domains.add(['null','undefined'].includes(kind)?kind:['NaN','Infinity','-Infinity','-0'].includes(kind)?'number':'unknown');}
            else domains.add('unknown'); // The primitive inspector's legacy surface is unchanged.
        };
        // For domain queries, only reachable normal completions contribute.
        // Throw contributes no Undefined or implicit normal-result evidence.
        const normalReturns=definition=>{
            const results=new Set(),visited=new Set();
            const sequence=node=>{
                while(node){
                    if(visited.has(node))return true;visited.add(node);
                    if(node.opcode==='arcade_throwValue')return false;
                    if(node.opcode==='arcade_returnValue'){results.add(node);return false;}
                    if(node.opcode==='control_if_else'){
                        const left=sequence(input(node,'SUBSTACK')),right=sequence(input(node,'SUBSTACK2'));
                        if(!left&&!right)return false;
                    }else for(const name of Object.keys(node.inputs||{}))if(name.startsWith('SUBSTACK'))sequence(input(node,name));
                    if(node.opcode==='control_forever')return false;
                    node=read(node.next);
                }
                return true;
            };
            const fallthrough=sequence(read(definition.next));return {results:[...results],fallthrough};
        };
        // A declaration reset (local := undefined/null) cannot reach a read when
        // every path from it to the read's statement on the same chain passes a
        // definite overwrite (a direct set, or an if/else assigning in both
        // branches before any exit) whose value does not read the cell.
        const fixedReset=node=>node?.opcode==='arrays_specialValue'&&!Object.keys(node.inputs||{}).length&&['undefined','null'].includes(node.fields?.KIND?.value);
        const localCellOf=node=>['arcade_setLocal','arcade_getLocal'].includes(node?.opcode)?captureProof.local(captureProof.scopeOf(node),literal(node,'NAME')):null;
        const readsCell=(node,cell,path=new Set())=>{
            if(!node||path.has(node))return false;path.add(node);
            if(node.opcode==='arcade_getCaptured'||node.opcode==='arcade_getLocal'&&localCellOf(node)===cell)return true;
            return Object.entries(node.inputs||{}).some(([name,slot])=>!name.startsWith('SUBSTACK')&&readsCell(read(slot.block),cell,path));
        };
        const exits=node=>/return|stop|break|continue|throw/i.test(node?.opcode||'');
        const assigns=(node,cell)=>{
            if(node?.opcode==='arcade_setLocal'&&localCellOf(node)===cell){const value=input(node,'VALUE');return !!value&&!fixedReset(value)&&!readsCell(value,cell);}
            if(node?.opcode==='control_if_else')return chainAssigns(node.inputs?.SUBSTACK?.block,cell)&&chainAssigns(node.inputs?.SUBSTACK2?.block,cell);
            return false;
        };
        const chainAssigns=(id,cell)=>{const path=new Set();for(let node=read(id);node&&!path.has(node);node=read(node.next)){path.add(node);if(assigns(node,cell))return true;if(exits(node))return false;}return false;};
        const deadReset=(writer,cell,at)=>{
            if(!at||!fixedReset(input(writer,'VALUE')))return false;
            const chain=[],path=new Set();for(let node=read(writer.next);node&&!path.has(node);node=read(node.next)){path.add(node);chain.push(node);}
            const climbed=new Set();
            for(let node=at;node&&!climbed.has(node);node=read(node.parent)){climbed.add(node);const index=chain.indexOf(node);if(index>=0)return chain.slice(0,index).some(statement=>assigns(statement,cell));}
            return false;
        };
        // A local Array family: locals rooted at one empty allocation and only
        // aliased, pushed to, measured or read by item. Its elements are exactly
        // the pushed values and it never shrinks, so an in-bounds item read
        // yields one of them. In bounds: a constant below the straight-line
        // pushes before the read, or the importer's lowered map loop
        // `repeat while I < LEN` with LEN its length, I from 0 by +1 only.
        const constNumber=node=>{
            if(node?.opcode==='math_number'&&!Object.keys(node.inputs||{}).length){const v=Number(node.fields?.NUM?.value);return String(node.fields?.NUM?.value).trim()!==''&&Number.isFinite(v)?v:null;}
            if(node?.opcode==='operator_add'){const a=constNumber(input(node,'NUM1')),b=constNumber(input(node,'NUM2'));return a===null||b===null?null:a+b;}
            return null;
        };
        const localsOf=cell=>Object.values(all).filter(b=>localCellOf(b)===cell);
        const pushFamily=(cell,family=new Map())=>{
            if(!cell||family.has(cell))return family;
            const proof=captureProof.proof(cell);if(!proof||proof.escaped||cell.scope.target!==target||proof.index>=0)return null;
            family.set(cell,{pushes:[],resets:[]});
            for(const b of localsOf(cell)){
                if(b.opcode==='arcade_setLocal'){
                    const value=input(b,'VALUE');
                    if(value?.opcode==='arrays_createReference'&&text(input(value,'VALUES'))==='[]'&&!Object.keys(value.fields||{}).length)continue;
                    if(fixedReset(value)){family.get(cell).resets.push(b);continue;}
                    if(value?.opcode==='arcade_getLocal'){if(!pushFamily(localCellOf(value),family))return null;continue;}
                    return null;
                }
                const parent=read(b.parent),slot=Object.entries(parent?.inputs||{}).find(([,v])=>v?.block===b.id)?.[0];
                if(parent?.opcode==='arrays_mutateReference'&&slot==='ARRAY'&&literal(parent,'OP')==='push'){family.get(cell).pushes.push(parent);continue;}
                if(['arrays_referenceLength','arrays_referenceItem'].includes(parent?.opcode)&&slot==='ARRAY')continue;
                if(parent?.opcode==='arcade_setLocal'&&slot==='VALUE'){if(!pushFamily(localCellOf(parent),family))return null;continue;}
                return null;
            }
            return family;
        };
        const rootCount=family=>{const roots=[];for(const cell of family.keys())for(const b of localsOf(cell))if(b.opcode==='arcade_setLocal'&&input(b,'VALUE')?.opcode==='arrays_createReference')roots.push(b);
            if(roots.length!==1)return roots.length;
            // A null/undefined reset of a member must precede the allocation on its own chain.
            const chain=chainOf(roots[0]),resets=[...family.values()].flatMap(entry=>entry.resets);
            return chain&&resets.every(reset=>chain.includes(reset)&&chain.indexOf(reset)<chain.indexOf(roots[0]))?1:0;};
        // The statement holding a reporter: climb out of input slots, but a
        // SUBSTACK reference is a statement boundary.
        const statementOf=node=>{let n=node;const seen=new Set();while(n?.parent&&!seen.has(n)){seen.add(n);const up=read(n.parent);
            const slot=Object.entries(up?.inputs||{}).find(([,v])=>v?.block===n.id)?.[0];if(!slot||/^SUBSTACK/.test(slot))break;n=up;}return n;};
        const chainOf=node=>{let first=statementOf(node),guard=new Set();while(first?.parent&&!guard.has(first)){guard.add(first);const up=read(first.parent);if(!up)return null;if(up.next!==first.id)break;first=up;}
            const out=[];guard=new Set();for(let n=first;n&&!guard.has(n);n=read(n.next)){guard.add(n);out.push(n);}return out;};
        const statementIn=(node,chain)=>{const guard=new Set();for(let n=node;n&&!guard.has(n);n=read(n.parent)){guard.add(n);if(chain.includes(n))return n;}return null;};
        // The canonical lowered map loop: `repeat while I < LEN`, LEN set once
        // before the loop to the length of a push-only family, I set to 0
        // before it and advanced by exactly +1 as the body's last statement.
        const writersOf=cell=>localsOf(cell).filter(b=>b.opcode==='arcade_setLocal');
        const loopFacts=loop=>{
            if(loop?.opcode!=='arcade_sourceWhile')return null;
            const body=chainOf(read(loop.inputs?.SUBSTACK?.block)),outer=chainOf(loop);if(!body?.length||!outer)return null;
            const condition=input(loop,'CONDITION'),left=input(condition,'LEFT'),right=input(condition,'RIGHT');
            if(condition?.opcode!=='arrays_valueCompare'||literal(condition,'OP')!=='<'||left?.opcode!=='arcade_getLocal'||right?.opcode!=='arcade_getLocal')return null;
            const counter=localCellOf(left),limit=localCellOf(right);
            const limitWriters=writersOf(limit),counterWriters=writersOf(counter);
            if(!limitWriters.length||limitWriters.some(b=>!outer.includes(b)||outer.indexOf(b)>outer.indexOf(loop)))return null;
            const lastLimit=limitWriters.reduce((a,b)=>outer.indexOf(b)>outer.indexOf(a)?b:a);
            const length=input(lastLimit,'VALUE');if(length?.opcode!=='arrays_referenceLength'||input(length,'ARRAY')?.opcode!=='arcade_getLocal')return null;
            const receiver=pushFamily(localCellOf(input(length,'ARRAY')));if(!receiver||rootCount(receiver)!==1)return null;
            const step=body[body.length-1],inits=counterWriters.filter(b=>b!==step);
            if(!counterWriters.includes(step)||!inits.length||inits.some(b=>!outer.includes(b)||outer.indexOf(b)>outer.indexOf(loop)||constNumber(input(b,'VALUE'))!==0))return null;
            const plus=input(step,'VALUE'),unary=input(plus,'LEFT');
            if(plus?.opcode!=='arrays_valueBinary'||literal(plus,'OP')!=='+'||constNumber(input(plus,'RIGHT'))!==1||unary?.opcode!=='arrays_valueUnary'||literal(unary,'OP')!=='+'||localCellOf(input(unary,'VALUE'))!==counter)return null;
            return {body,outer,counter,receiver};
        };
        const straightPushesBefore=(family,chain,at)=>[...family.values()].flatMap(entry=>entry.pushes).filter(push=>chain.indexOf(push)>=0&&chain.indexOf(push)<chain.indexOf(at)).length;
        const familyElement=node=>{
            const array=input(node,'ARRAY');if(array?.opcode!=='arcade_getLocal')return null;
            const family=pushFamily(localCellOf(array));if(!family||rootCount(family)!==1)return null;
            const pushes=[...family.values()].flatMap(entry=>entry.pushes);if(!pushes.length)return null;
            const values=pushes.map(push=>input(push,'VALUE'));
            const index=input(node,'INDEX'),k=constNumber(index);
            if(k!==null){
                if(!Number.isInteger(k)||k<0)return null;
                const chain=chainOf(node),at=chain&&statementIn(node,chain);if(!at)return null;
                if(k<straightPushesBefore(family,chain,at))return values;
                // Every push is the one unconditional push of a canonical map
                // loop that finished before this read: one element per receiver
                // element, and the receiver had at least its straight pushes.
                if(pushes.length!==1)return null;
                let loop=null;const climb=new Set();for(let n=read(pushes[0].parent);n&&!climb.has(n);n=read(n.parent)){climb.add(n);if(n.opcode==='arcade_sourceWhile'){loop=n;break;}}
                const facts=loopFacts(loop);
                if(!facts||!facts.body.includes(pushes[0])||!chain.includes(loop)||chain.indexOf(loop)>=chain.indexOf(at))return null;
                const roots=[...family.keys()].flatMap(cell=>writersOf(cell)).filter(b=>input(b,'VALUE')?.opcode==='arrays_createReference');
                if(roots.length!==1||!chain.includes(roots[0])||chain.indexOf(roots[0])>chain.indexOf(loop))return null;
                return k<straightPushesBefore(facts.receiver,chain,loop)?values:null;
            }
            if(index?.opcode!=='arcade_getLocal')return null;
            let loop=null,guard=new Set();for(let n=read(node.parent);n&&!guard.has(n);n=read(n.parent)){guard.add(n);if(n.opcode==='arcade_sourceWhile'){loop=n;break;}}
            const facts=loopFacts(loop);
            if(!facts||!statementIn(node,facts.body)||localCellOf(index)!==facts.counter||!facts.receiver.has(localCellOf(array)))return null;
            return values;
        };
        // Independent lowered normal-result proof. Unlike familyElement this
        // establishes no bounds and admits no alias: only a fresh local empty
        // Array, Number pushes and the literal zero-argument reverse operation.
        // Every absent slot remains Undefined. No source type/loan is read.
        const numericFamilyResult=(node,origins)=>{
            const array=input(node,'ARRAY'),cell=localCellOf(array),scope=cell?.scope,proof=cell&&captureProof.proof(cell);
            if(array?.opcode!=='arcade_getLocal'||!proof||proof.index>=0||proof.escaped||scope.target!==target||typeof scope.procedure!=='string')return null;
            const closed=(b,names)=>!!b&&Object.keys(b.fields||{}).length===0&&Object.keys(b.inputs||{}).sort().join(',')===names.slice().sort().join(',');
            const fixedText=(b,name,value)=>{const child=input(b,name);return child?.opcode==='text'&&child.parent===b.id&&child.next==null&&!Object.keys(child.inputs||{}).length&&text(child)===value;};
            if(!closed(node,['ARRAY','INDEX'])||array.parent!==node.id)return null;
            // Closed native source effects only; no callback, captured cell,
            // object/prototype access, extension effect or computed call entry.
            const allowed=new Set(['math_number','bw_numberLiteral','text','bw_stringLiteral','data_variable','data_setvariableto','data_changevariableby',
                'looks_hide','procedures_definition','procedures_prototype','procedures_call','argument_reporter_string_number','argument_reporter_boolean',
                'arcade_whenSourceStarts','arcade_declareParameterConstraint','arcade_declareSourceScalar','arcade_functionArgument','arcade_callFunction',
                'arcade_getLocal','arcade_setLocal','arcade_returnValue','arcade_sourceWhile','control_if','control_if_else','arcade_break','arcade_continue',
                'arrays_createReference','arrays_referenceItem','arrays_referenceLength','arrays_mutateReference','arrays_specialValue',
                'arrays_valueBinary','arrays_valueUnary','arrays_valueCompare','arrays_valueTruthy','arcade_inspectValue',
                'operator_add','operator_subtract','operator_multiply','operator_divide','operator_mod','operator_equals','operator_lt','operator_gt',
                'operator_not','operator_and','operator_or','operator_join','operator_length','operator_letter_of']);
            for(const t of runtime.targets)if(t.isOriginal!==false)for(const b of Object.values(t.blocks?._blocks||{})){
                if(!allowed.has(b.opcode))return null;
                if(b.opcode==='arrays_mutateReference'&&!['push','reverse'].includes(literal(b,'OP')))return null;
                if(b.opcode==='arcade_callFunction'){
                    const name=literal(b,'NAME');if(typeof name!=='string'||Object.values(t.blocks._blocks).filter(d=>d.opcode==='procedures_definition'&&t.blocks.getBlock(d.inputs?.custom_block?.block)?.mutation?.proccode===name).length!==1)return null;
                }
            }
            let allocation=null;const mutations=[];
            for(const use of localsOf(cell)){
                if(captureProof.scopeOf(use)!==scope)return null;
                if(use.opcode==='arcade_setLocal'){
                    if(!closed(use,['NAME','VALUE'])||!fixedText(use,'NAME',cell.name))return null;
                    const value=input(use,'VALUE');if(fixedReset(value))continue;
                    if(allocation||!closed(value,['VALUES'])||value.opcode!=='arrays_createReference'||value.parent!==use.id||!fixedText(value,'VALUES','[]'))return null;
                    allocation=use;continue;
                }
                if(!closed(use,['NAME'])||!fixedText(use,'NAME',cell.name))return null;
                const parent=read(use.parent);
                if(!parent||parent.inputs?.ARRAY?.block!==use.id)return null;
                if(parent.opcode==='arrays_mutateReference'){
                    const op=literal(parent,'OP');
                    if(!closed(parent,['ARRAY','OP','INDEX','VALUE'])||!['push','reverse'].includes(op)||!fixedText(parent,'OP',op)||constNumber(input(parent,'INDEX'))!==0)return null;
                    if(op==='reverse'&&constNumber(input(parent,'VALUE'))!==0)return null;
                    mutations.push(parent);continue;
                }
                if(parent.opcode==='arrays_referenceItem'&&closed(parent,['ARRAY','INDEX'])||parent.opcode==='arrays_referenceLength'&&closed(parent,['ARRAY']))continue;
                return null;
            }
            if(!allocation||!mutations.some(b=>literal(b,'OP')==='push')||!mutations.some(b=>literal(b,'OP')==='reverse'))return null;
            const chain=chainOf(allocation),before=at=>{const statement=chain&&statementIn(at,chain);return !!statement&&chain.indexOf(allocation)<chain.indexOf(statement);};
            if(!before(node)||mutations.some(b=>!before(b))||proof.writers.some(({node:b})=>b!==allocation&&(!fixedReset(input(b,'VALUE'))||!chain?.includes(b)||chain.indexOf(b)>chain.indexOf(allocation))))return null;
            const domains=new Set(['number','undefined']);
            const number=value=>{const found=new Set();if(!safe(value,false,origins,found)||!found.has('number')||[...found].some(type=>!['number',PENDING].includes(type)))return false;if(found.has(PENDING))domains.add(PENDING);return true;};
            if(!number(input(node,'INDEX'))||mutations.some(b=>literal(b,'OP')==='push'&&!number(input(b,'VALUE'))))return null;
            // Genuine builtin constructor/metadata/current cached delegates,
            // independently of source flags or the proposed primitive domain.
            if(!require('../adapter').localArrayResultBindingsCurrent(runtime))return null;
            liveProof?.(); // Never cache across operation/delegate changes.
            origins?.add(node);return domains;
        };
        const constantLogicalOverwrite=(writer,cell,at)=>{
            const proof=captureProof.proof(cell),scope=cell?.scope;
            if(!at||!proof||proof.escaped||proof.index!==-1||scope?.target!==target||scope.root.opcode!=='arcade_whenSourceStarts'||captureProof.scopeOf(at)!==scope)return false;
            const closed=(b,names)=>Object.keys(b?.inputs||{}).sort().join(',')===names.slice().sort().join(',');
            const literalText=(b,parent)=>b?.opcode==='text'&&b.shadow===true&&b.parent===parent.id&&b.next==null&&!Object.keys(b.inputs||{}).length&&Object.keys(b.fields||{}).join(',')==='TEXT'&&typeof b.fields.TEXT?.value==='string';
            const localRead=b=>b?.opcode==='arcade_getLocal'&&closed(b,['NAME'])&&literalText(input(b,'NAME'),b);
            const number=(b,path=new Set())=>{
                if(!b||path.has(b)||b.next!=null)return null;const next=new Set([...path,b]);
                if(b.opcode==='math_number'){if(b.shadow!==true||Object.keys(b.inputs||{}).length||Object.keys(b.fields||{}).join(',')!=='NUM'||!['string','number'].includes(typeof b.fields.NUM?.value))return null;const value=Number(b.fields?.NUM?.value);return String(b.fields?.NUM?.value).trim()!==''&&Number.isFinite(value)?value:null;}
                if(!['operator_add','operator_subtract','operator_multiply'].includes(b.opcode)||!closed(b,['NUM1','NUM2']))return null;
                const left=input(b,'NUM1'),right=input(b,'NUM2');if(left?.parent!==b.id||right?.parent!==b.id)return null;
                const x=number(left,next),y=number(right,next);if(x===null||y===null)return null;
                const value=b.opcode==='operator_add'?x+y:b.opcode==='operator_subtract'?x-y:x*y;return Number.isFinite(value)?value:null;
            };
            const chain=[];let previous=scope.root;const walked=new Set();
            for(let b=read(previous.next);b;b=read(b.next)){if(walked.has(b)||b.parent!==previous.id)return false;walked.add(b);chain.push(b);previous=b;}
            if(!closed(scope.root,[])||!closed(writer,['NAME','VALUE'])||!literalText(input(writer,'NAME'),writer)||input(writer,'VALUE')?.parent!==writer.id||!localRead(at))return false;
            const begin=chain.indexOf(writer),readStatement=read(at.parent),end=chain.indexOf(readStatement);
            if(begin<0||end!==begin+2||readStatement?.opcode!=='data_setvariableto'||!closed(readStatement,['VALUE'])||readStatement.inputs.VALUE.block!==at.id)return false;
            const branch=chain[begin+1],overwrite=input(branch,'SUBSTACK');
            if(branch?.opcode!=='control_if'||!closed(branch,['CONDITION','SUBSTACK'])||overwrite?.parent!==branch.id||overwrite.next!=null||
                overwrite.opcode!=='arcade_setLocal'||localCellOf(overwrite)!==cell||!closed(overwrite,['NAME','VALUE'])||!literalText(input(overwrite,'NAME'),overwrite)||number(input(overwrite,'VALUE'))===null)return false;
            if(proof.writers.length!==2||!proof.writers.every(row=>row.scope===scope&&(row.node===writer||row.node===overwrite)))return false;
            const literalBoolean=b=>{
                if(!b)return null;
                if(b.opcode==='arrays_valueCompare'){
                    const opInput=input(b,'OP'),fields=Object.keys(b.fields||{});
                    if(opInput?fields.length||!closed(b,['LEFT','OP','RIGHT'])||!literalText(opInput,b):fields.join(',')!=='OP'||!closed(b,['LEFT','RIGHT'])||typeof b.fields.OP?.value!=='string')return null;
                    const op=literal(b,'OP'),leftInput=input(b,'LEFT'),rightInput=input(b,'RIGHT');
                    if(leftInput?.parent!==b.id||rightInput?.parent!==b.id)return null;
                    const left=number(leftInput),right=number(rightInput);if(left===null||right===null)return null;
                    return op==='<'?left<right:op==='>'?left>right:op==='==='?left===right:op==='!=='?left!==right:null;
                }
                // Even ordinary globals can change through monitor/host paths.
                // Block-writer enumeration is not closed-world authority here.
                return null;
            };
            const initial=literalBoolean(input(writer,'VALUE'));if(typeof initial!=='boolean')return false;
            let condition=input(branch,'CONDITION'),negated=false;
            if(condition?.parent!==branch.id)return false;
            if(condition?.opcode==='operator_not'&&closed(condition,['OPERAND'])){negated=true;const nested=input(condition,'OPERAND');if(nested?.parent!==condition.id)return false;condition=nested;}
            if(condition?.opcode!=='arrays_valueTruthy'||!closed(condition,['VALUE']))return false;
            const guard=input(condition,'VALUE');if(!localRead(guard)||guard.parent!==condition.id||localCellOf(guard)!==cell)return false;
            if((negated?!initial:initial)!==true)return false;
            for(const b of Object.values(all)){
                if(['arcade_getCaptured','arcade_setCaptured'].includes(b.opcode)&&(typeof literal(b,'NAME')!=='string'||literal(b,'NAME')===cell.name))return false;
                if(captureProof.scopeOf(b)===scope&&b.opcode==='arcade_getLocal'&&
                    (typeof literal(b,'NAME')!=='string'||localCellOf(b)===cell&&b!==guard&&b!==at))return false;
            }
            return true;
        };
        // Class metadata identifies dispatch edges, never a primitive domain.
        // Keep this boundary to non-inherited classes and closed straight-line
        // construction. Every backing writer and every dispatched argument is
        // still checked below against its actual producer.
        let classFieldDepth=0;
        const classRows=()=>{
            if(runtime.targets.some(t=>t.isOriginal!==false&&t!==target&&Object.values(t.blocks._blocks).some(b=>/ObjectField|declareClass|declareSubclass/.test(b.opcode))))return null;
            const rows=[];
            try{for(const b of Object.values(all)){
                if(b.opcode==='arcade_declareSubclass')return null;
                if(b.opcode!=='arcade_declareClass')continue;
                const name=literal(b,'NAME'),fields=JSON.parse(literal(b,'FIELDS')),parameters=JSON.parse(literal(b,'PARAMETERS')),methods=JSON.parse(literal(b,'METHODS'));
                if(typeof name!=='string'||!name||rows.some(r=>r.name===name)||!Array.isArray(fields)||!Array.isArray(parameters)||!Array.isArray(methods)||
                    fields.some(f=>!f||typeof f.name!=='string')||new Set(fields.map(f=>f.name)).size!==fields.length)return null;
                rows.push({declaration:b,name,fields,parameters,methods,initializer:literal(b,'INITIALIZER'),constructor:literal(b,'CONSTRUCTOR')});
            }}catch{return null;}
            // A conservative subset of object-heap.register's declaration
            // schema. Do not construct a heap during proof (even a detached
            // heap advances its identity counter). Native/reference/callable
            // descriptors require their separate services and stay refused.
            const identifier=name=>typeof name==='string'&&/^[A-Za-z_]\w*$/.test(name);
            const type=value=>['number','boolean','string','any','void'].includes(value);
            const keys=(value,allowed)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>allowed.includes(key));
            const visibility=value=>value===undefined||['public','private','protected'].includes(value);
            const parameters=list=>Array.isArray(list)&&new Set(list.map(p=>p?.name)).size===list.length&&list.every(p=>
                keys(p,['name','type','optional','default'])&&identifier(p.name)&&type(p.type)&&typeof p.optional==='boolean'&&
                (!Object.hasOwn(p,'default')||p.optional&&(p.default===null||typeof p.default==='boolean'||typeof p.default==='number'&&Number.isFinite(p.default))));
            for(const row of rows){
                if(!identifier(row.name)||['BaseSprite','Sprite','ExtendableSprite','BaseDialog','SplashDialog','Font'].includes(row.name)||(row.name.startsWith('__bwSDK_')||row.name.startsWith('__bwOwned'))||
                    !parameters(row.parameters)||typeof row.initializer!=='string'||typeof row.constructor!=='string')return null;
                for(const field of row.fields){
                    if(!keys(field,['name','type','readonly','visibility','initializer','parameterProperty','getter','setter'])||!identifier(field.name)||!type(field.type)||
                        typeof field.readonly!=='boolean'||!visibility(field.visibility)||field.initializer!==undefined&&typeof field.initializer!=='string'||
                        field.parameterProperty!==undefined&&typeof field.parameterProperty!=='boolean'||
                        field.getter!==undefined&&(typeof field.getter!=='string'||!field.getter))return null;
                    if(field.setter!==undefined&&(!keys(field.setter,['procedure','parameters'])||typeof field.setter.procedure!=='string'||!field.setter.procedure||
                        !parameters(field.setter.parameters)||field.setter.parameters.length!==1||field.setter.parameters[0].optional||Object.hasOwn(field.setter.parameters[0],'default')))return null;
                    if((field.getter||field.setter)&&(field.initializer!==undefined||field.parameterProperty||field.readonly!==!!(field.getter&&!field.setter)))return null;
                }
                if(new Set(row.methods.map(m=>m?.name)).size!==row.methods.length||row.methods.some(m=>
                    !keys(m,['name','procedure','parameters','returnType','visibility'])||!identifier(m.name)||row.fields.some(f=>f.name===m.name)||
                    typeof m.procedure!=='string'||!parameters(m.parameters)||!type(m.returnType)||!visibility(m.visibility)))return null;
            }
            const roles=new Map();
            for(const cls of rows)for(const role of [
                {procedure:cls.initializer,kind:'initializer',parameters:[]},{procedure:cls.constructor,kind:'constructor',parameters:cls.parameters},
                ...cls.methods.map(m=>({...m,kind:'method'})),...cls.fields.flatMap(f=>[
                    ...(f.getter?[{procedure:f.getter,kind:'getter',parameters:[],field:f}]:[]),
                    ...(f.setter?[{...f.setter,kind:'setter',field:f}]:[])])]){
                if(!role.procedure)continue;
                if(role.procedure.startsWith('__bwOwned')||/^__bwClass_(?:__bwSDK_|(?:BaseSprite|Sprite|ExtendableSprite|BaseDialog|SplashDialog|Font)_)/.test(role.procedure))return null;
                const scopes=captureProof.scopes.filter(s=>s.target===target&&s.procedure===role.procedure&&!s.invalid);
                if(roles.has(role.procedure)||scopes.length!==1||!Array.isArray(role.parameters)||scopes[0].params.length!==role.parameters.length+1||
                    role.parameters.some((p,i)=>!p||p.name!==scopes[0].params[i+1]))return null;
                roles.set(role.procedure,{...role,cls,scope:scopes[0]});
            }
            const reachable=new Set(captureProof.scopes.filter(s=>!s.procedure));
            for(const role of roles.values())reachable.add(role.scope);
            let grew=true;while(grew){grew=false;for(const b of Object.values(all)){
                if(!reachable.has(captureProof.scopeOf(b)))continue;
                if(b.opcode==='arcade_createCallable'||b.opcode==='arcade_callCallable')return null;
                if(!['arcade_callFunction','procedures_call'].includes(b.opcode))continue;
                const name=b.opcode==='procedures_call'?b.mutation?.proccode:literal(b,'NAME');if(typeof name!=='string')return null;
                for(const scope of captureProof.scopes)if(scope.procedure===name&&!reachable.has(scope)){reachable.add(scope);grew=true;}
            }}
            return {rows,roles,reachable};
        };
        const sourceBefore=(left,right)=>{
            const scope=captureProof.scopeOf(left);if(!scope||captureProof.scopeOf(right)!==scope)return false;
            const chain=[],seen=new Set();let b=read(scope.root.next);
            while(b){if(seen.has(b))return false;seen.add(b);chain.push(b);b=read(b.next);}
            const statement=node=>{const path=new Set();while(node&&!path.has(node)){if(chain.includes(node))return chain.indexOf(node);path.add(node);const parent=read(node.parent);if(!Object.values(parent?.inputs||{}).some(slot=>slot.block===node.id))return -1;node=parent;}return -1;};
            const l=statement(left),r=statement(right);return l>=0&&r>l;
        };
        const receiverClass=(node,model,path=new Set())=>{
            if(!node||path.has(node))return null;const next=new Set([...path,node]);
            if(node.opcode==='arcade_createObject'){
                const cls=model.rows.find(r=>r.name===literal(node,'CLASS'));if(!cls||!sourceBefore(cls.declaration,node))return null;
                let arg=input(node,'ARGS'),count=0;const visited=new Set();
                while(text(arg)!=='[]'){
                    if(!arg||visited.has(arg)||arg.opcode!=='arcade_functionArgument'||!input(arg,'VALUE')||++count>cls.parameters.length)return null;
                    visited.add(arg);arg=input(arg,'REST');
                }
                return cls;
            }
            const scope=captureProof.scopeOf(node),role=model.roles.get(scope?.procedure);
            if(node.opcode==='arcade_getLocal'&&role&&literal(node,'NAME')===scope.params[0]){
                const proof=captureProof.proof(captureProof.local(scope,scope.params[0]));
                if(!proof||proof.index!==0||proof.writers.length||proof.escaped)return null;
                for(const call of Object.values(all))if(model.reachable.has(captureProof.scopeOf(call))&&
                    (call.opcode==='arcade_callFunction'&&literal(call,'NAME')===role.procedure||call.opcode==='procedures_call'&&call.mutation?.proccode===role.procedure))return null;
                return role.cls;
            }
            let writers;
            if(node.opcode==='data_variable'){
                const variable=target.lookupVariableById(node.fields?.VARIABLE?.id);if(!variable||variable.isCloud)return null;
                writers=runtime.targets.filter(t=>t.isOriginal!==false).flatMap(t=>Object.values(t.blocks._blocks).filter(b=>
                    b.fields?.VARIABLE?.id&&t.lookupVariableById(b.fields.VARIABLE.id)===variable).map(b=>({b,t}))).filter(({b})=>b.opcode!=='data_variable');
                if(writers.some(({b,t})=>t!==target||b.opcode!=='data_setvariableto'))return null;writers=writers.map(({b})=>b);
            }else if(node.opcode==='arcade_getLocal'){
                const proof=captureProof.proof(captureProof.local(scope,literal(node,'NAME')));if(!proof||proof.index>=0||proof.escaped)return null;writers=proof.writers.map(w=>w.node);
            }else return null;
            // Null/undefined resets cannot produce an object; successful field
            // access still requires an allocation. No arbitrary reference alias.
            const live=writers.filter(w=>!fixedReset(input(w,'VALUE')));
            if(!live.length)return null;
            const classes=live.map(w=>receiverClass(input(w,'VALUE'),model,next));
            return classes[0]&&classes.every(c=>c===classes[0])?classes[0]:null;
        };
        const readyReceiver=(node,at,model,path=new Set())=>{
            if(!node||path.has(node))return false;const next=new Set([...path,node]);
            const scope=captureProof.scopeOf(node),role=model.roles.get(scope?.procedure);
            if(node.opcode==='arcade_getLocal'&&role&&literal(node,'NAME')===scope.params[0])return !!receiverClass(node,model)&&!['initializer','constructor'].includes(role.kind);
            if(node.opcode==='arcade_createObject')return true;
            let writers;
            if(node.opcode==='arcade_getLocal'){
                const proof=captureProof.proof(captureProof.local(scope,literal(node,'NAME')));if(!proof||proof.index>=0||proof.escaped)return false;writers=proof.writers.map(w=>w.node);
            }else if(node.opcode==='data_variable'){
                const variable=target.lookupVariableById(node.fields?.VARIABLE?.id);if(!variable)return false;
                writers=Object.values(all).filter(b=>b.opcode==='data_setvariableto'&&target.lookupVariableById(b.fields?.VARIABLE?.id)===variable);
            }else return false;
            const live=writers.filter(w=>!fixedReset(input(w,'VALUE')));if(live.length!==1)return false;
            const writer=live[0],owner=captureProof.scopeOf(at);if(!owner||captureProof.scopeOf(writer)!==owner)return false;
            const chain=[],seen=new Set();let b=read(owner.root.next);
            while(b){if(seen.has(b))return false;seen.add(b);chain.push(b);b=read(b.next);}
            const position=value=>{const seen=new Set();while(value&&!seen.has(value)){if(chain.includes(value))return chain.indexOf(value);seen.add(value);const parent=read(value.parent);if(parent?.inputs&&Object.values(parent.inputs).some(slot=>slot.block===value.id))value=parent;else return -1;}return -1;};
            const w=position(writer),r=position(at);
            return w>=0&&r>w&&writers.every(value=>position(value)>=0&&position(value)<=w)&&readyReceiver(input(writer,'VALUE'),writer,model,next);
        };
        const classDefinition=procedure=>Object.values(all).find(b=>b.opcode==='procedures_definition'&&input(b,'custom_block')?.mutation?.proccode===procedure);
        const constructedField=(cls,field,model)=>{
            const closedText=(owner,key)=>{
                const value=input(owner,key);
                return value?.opcode==='text'&&value.shadow===true&&value.parent===owner.id&&value.next==null&&
                    !Object.keys(value.inputs||{}).length&&Object.keys(value.fields||{}).join(',')==='TEXT'&&
                    typeof value.fields.TEXT?.value==='string'?value.fields.TEXT.value:null;
            };
            // A constructor unary operand needs a closed Number producer all the
            // way through actual formals. General domain shortcuts for value
            // arithmetic do not prove that opaque conversion returned a Number.
            const ownedStatement=node=>{
                const root=captureProof.scopeOf(node)?.root,visited=new Set();if(!root)return false;
                while(node!==root){
                    if(!node||visited.has(node))return false;visited.add(node);const parent=read(node.parent);
                    if(!parent||parent.next!==node.id&&(!['control_if','control_if_else','control_repeat','control_repeat_until','control_forever'].includes(parent.opcode)||
                        !(parent.opcode==='control_if_else'?['SUBSTACK','SUBSTACK2']:['SUBSTACK']).some(key=>input(parent,key)===node)))return false;
                    node=parent;
                }
                return true;
            };
            const closedArguments=call=>{
                const values=[],visited=new Set();let owner=call,key='ARGS';
                while(true){
                    if(closedText(owner,key)==='[]')return values;
                    const node=input(owner,key);
                    if(!node||visited.has(node)||node.opcode!=='arcade_functionArgument'||node.parent!==owner.id||node.next!=null||
                        Object.keys(node.fields||{}).length||Object.keys(node.inputs||{}).sort().join(',')!=='REST,VALUE'||input(node,'VALUE')?.parent!==node.id)return null;
                    visited.add(node);values.push(input(node,'VALUE'));owner=node;key='REST';
                }
            };
            const closedActualNumber=(value,path=new Set(),owner=null)=>{
                if(!value||path.has(value)||value.next!=null||owner&&value.parent!==owner.id)return false;const next=new Set([...path,value]);
                const fields=Object.keys(value.fields||{}).join(','),inputs=Object.keys(value.inputs||{}).sort().join(',');
                const child=key=>{const node=input(value,key);return node?.parent===value.id&&closedActualNumber(node,next);};
                const operation=(keys,allowed)=>fields==='OP'&&inputs===keys.sort().join(',')&&allowed.includes(value.fields.OP?.value)||
                    !fields&&inputs===[...keys,'OP'].sort().join(',')&&allowed.includes(closedText(value,'OP'));
                if(value.opcode==='math_number')return fields==='NUM'&&!inputs&&['string','number'].includes(typeof value.fields.NUM?.value)&&String(value.fields.NUM?.value).trim()!==''&&Number.isFinite(Number(value.fields.NUM?.value));
                if(value.opcode==='arrays_specialValue')return false;
                if(value.opcode==='arrays_valueUnary')return operation(['VALUE'],['+','-','~'])&&child('VALUE');
                if(value.opcode==='arrays_valueBinary')return operation(['LEFT','RIGHT'],['+','-','*'])&&child('LEFT')&&child('RIGHT');
                if(['operator_add','operator_subtract','operator_multiply'].includes(value.opcode))return !fields&&inputs==='NUM1,NUM2'&&child('NUM1')&&child('NUM2');
                if(value.opcode==='arcade_getLocal'){
                    const name=closedText(value,'NAME'),scope=captureProof.scopeOf(value),cell=captureProof.local(scope,name),proof=cell&&captureProof.proof(cell);
                    if(fields||inputs!=='NAME'||!proof||!proof.writers.every(({node})=>node.opcode==='arcade_setLocal'&&ownedStatement(node)&&!Object.keys(node.fields||{}).length&&Object.keys(node.inputs||{}).sort().join(',')==='NAME,VALUE'&&closedText(node,'NAME')===name&&closedActualNumber(input(node,'VALUE'),next,node)))return false;
                    if(proof.index<0)return proof.writers.length>0;
                    if(scope.procedure!==cls.constructor||proof.index===0)return false;
                    const allocations=Object.values(all).filter(node=>node.opcode==='arcade_createObject'&&literal(node,'CLASS')===cls.name);
                    const calls=Object.values(all).filter(node=>(node.opcode==='arcade_callFunction'&&literal(node,'NAME')===scope.procedure||node.opcode==='procedures_call'&&node.mutation?.proccode===scope.procedure)&&model.reachable.has(captureProof.scopeOf(node)));
                    return allocations.length>0&&!calls.length&&allocations.every(node=>{const args=closedArguments(node);return !Object.keys(node.fields||{}).length&&Object.keys(node.inputs||{}).sort().join(',')==='ARGS,CLASS'&&closedText(node,'CLASS')===cls.name&&args?.length===cls.parameters.length&&closedActualNumber(args[proof.index-1],next);});
                }
                if(value.opcode==='data_variable'){
                    const variable=target.lookupVariableById(value.fields?.VARIABLE?.id);if(!variable)return false;
                    const writers=Object.values(all).filter(node=>node.opcode==='data_setvariableto'&&target.lookupVariableById(node.fields?.VARIABLE?.id)===variable);
                    return fields==='VARIABLE'&&!inputs&&writers.length>0&&writers.every(node=>ownedStatement(node)&&Object.keys(node.fields||{}).join(',')==='VARIABLE'&&Object.keys(node.inputs||{}).join(',')==='VALUE'&&closedActualNumber(input(node,'VALUE'),next,node));
                }
                if(value.opcode==='arcade_callFunction'){
                    const name=closedText(value,'NAME'),definition=classDefinition(name);if(fields||inputs!=='ARGS,NAME'||!definition||closedArguments(value)?.length!==0)return false;
                    const completion=normalReturns(definition);
                    return !completion.fallthrough&&completion.results.length>0&&completion.results.every(node=>captureProof.scopeOf(node)?.params.length===0&&ownedStatement(node)&&!Object.keys(node.fields||{}).length&&Object.keys(node.inputs||{}).join(',')==='VALUE'&&closedActualNumber(input(node,'VALUE'),next,node));
                }
                return false;
            };
            let assigned=false;
            for(const procedure of [cls.initializer,cls.constructor]){
                if(!procedure)continue;const definition=classDefinition(procedure);if(!definition)return false;
                let b=read(definition.next),previous=definition;const visited=new Set();
                while(b){
                    if(visited.has(b)||b.parent!==previous.id)return false;visited.add(b);
                    const receiver=input(b,'OBJECT');
                    if(b.opcode!=='arcade_setObjectField'||Object.keys(b.fields||{}).length||Object.keys(b.inputs||{}).sort().join(',')!=='FIELD,OBJECT,VALUE'||
                        closedText(b,'FIELD')===null||receiver?.opcode!=='arcade_getLocal'||receiver.parent!==b.id||receiver.next!=null||
                        Object.keys(receiver.fields||{}).length||Object.keys(receiver.inputs||{}).join(',')!=='NAME'||
                        closedText(receiver,'NAME')!==captureProof.scopeOf(b)?.params[0]||receiverClass(receiver,model)!==cls)return false;
                    const written=cls.fields.find(f=>f.name===literal(b,'FIELD'));if(!written||written.getter||written.setter)return false;
                    // Construction cannot publish the unfinished receiver or
                    // call a reader before its backing field is initialized.
                    const pure=(value,path=new Set(),owner=null,numberOnly=false)=>{
                        if(!value||path.has(value)||value.next!=null||owner&&value.parent!==owner.id)return false;const next=new Set([...path,value]);
                        // Unary Number evidence cannot use an opaque actual formal.
                        // Check each descendant too: numeric reporters can otherwise
                        // hide an object/reference behind their coercion result.
                        if(numberOnly){const domains=new Set();if(!closedActualNumber(value)||!safe(value,false,null,domains)||domains.size!==1||!domains.has('number'))return false;}
                        // Source arithmetic keeps JS Number behavior. Its operation
                        // must be static and every operand must stay construction-pure.
                        if(value.opcode==='arrays_valueUnary'){
                            const fields=Object.keys(value.fields||{}).join(','),inputs=Object.keys(value.inputs||{}).sort().join(',');
                            const fixed=fields==='OP'&&inputs==='VALUE'&&['+','-','~'].includes(value.fields.OP?.value);
                            const reporter=!fields&&inputs==='OP,VALUE'&&['+','-','~'].includes(closedText(value,'OP'));
                            return (fixed||reporter)&&pure(input(value,'VALUE'),next,value,true);
                        }
                        if(value.opcode==='arrays_valueBinary'){
                            const operation=input(value,'OP');
                            const fields=Object.keys(value.fields||{}).join(','),inputs=Object.keys(value.inputs||{}).sort().join(',');
                            const fixed=fields==='OP'&&inputs==='LEFT,RIGHT'&&['+','-','*'].includes(value.fields.OP?.value);
                            const reporter=!fields&&inputs==='LEFT,OP,RIGHT'&&operation?.opcode==='text'&&operation.shadow===true&&
                                operation.parent===value.id&&operation.next==null&&!Object.keys(operation.inputs||{}).length&&
                                Object.keys(operation.fields||{}).join(',')==='TEXT'&&['+','-','*'].includes(operation.fields.TEXT?.value);
                            return (fixed||reporter)&&pure(input(value,'LEFT'),next,value,numberOnly)&&pure(input(value,'RIGHT'),next,value,numberOnly);
                        }
                        if(!['text','math_number','bw_numberLiteral','arrays_specialValue','arcade_getLocal','operator_add','operator_subtract','operator_multiply','operator_divide','operator_mod','operator_not','operator_equals','operator_lt','operator_gt'].includes(value.opcode))return false;
                        if(value.opcode==='arcade_getLocal'){
                            const name=input(value,'NAME');
                            return !Object.keys(value.fields||{}).length&&Object.keys(value.inputs||{}).join(',')==='NAME'&&
                                name?.opcode==='text'&&name.shadow===true&&name.parent===value.id&&name.next==null&&
                                !Object.keys(name.inputs||{}).length&&Object.keys(name.fields||{}).join(',')==='TEXT'&&
                                typeof name.fields.TEXT?.value==='string'&&name.fields.TEXT.value!==captureProof.scopeOf(value)?.params[0];
                        }
                        return Object.keys(value.inputs||{}).every(name=>pure(input(value,name),next,value,numberOnly));
                    };
                    if(!pure(input(b,'VALUE'),new Set(),b))return false;
                    if(field&&literal(b,'FIELD')===field.name)assigned=true;
                    previous=b;b=read(b.next);
                }
            }
            return !field||assigned;
        };
        const safeCell = (cell,player=false,origins=null,domains=null,at=null) => {
            const proof=captureProof.proof(cell);
            if(!proof||cell.scope.target!==target)return false;
            const evidence=new Set();
            if(!proof.writers.filter(({node:writer})=>!deadReset(writer,cell,at)&&!constantLogicalOverwrite(writer,cell,at)).every(({node:writer})=>safe(input(writer,'VALUE'),player,evidence,domains)))return false;
            let valid=proof.writers.length>0;
            if(proof.index>=0){
                const procedure=cell.scope.procedure;if(typeof procedure!=='string')return false;
                let calls=Object.values(all).filter(value=>value.opcode==='arcade_callFunction'&&literal(value,'NAME')===procedure||value.opcode==='procedures_call'&&value.mutation?.proccode===procedure);
                if(Object.values(all).some(value=>value.opcode==='arcade_callFunction'&&typeof literal(value,'NAME')!=='string'))return false;
                const model=player?null:classRows(),role=model?.roles.get(procedure);
                let dispatched=false;
                if(role&&proof.index>0){
                    calls=calls.filter(call=>model.reachable.has(captureProof.scopeOf(call)));
                    const index=proof.index-1,dispatch=[];
                    if(role.kind==='constructor'&&classFieldDepth>0)for(const node of Object.values(all))if(node.opcode==='arcade_createObject'&&literal(node,'CLASS')===role.cls.name){if(receiverClass(node,model)!==role.cls)return false;dispatch.push({node,index});}
                    if(role.kind==='setter'&&index===0)for(const node of Object.values(all))if(node.opcode==='arcade_setObjectField'){
                        const receiver=receiverClass(input(node,'OBJECT'),model),field=literal(node,'FIELD');
                        if(!receiver||typeof field!=='string')return false;
                        if(receiver===role.cls&&field===role.field.name){if(!readyReceiver(input(node,'OBJECT'),node,model))return false;dispatch.push({node,index:null});}
                    }
                    // Explicit ordinary calls remain obligations too. Dispatch
                    // metadata cannot hide a contradictory direct caller.
                    if(dispatch.length){valid=dispatch.every(({node,index})=>{
                        const arg=index===null?input(node,'VALUE'):argumentsFor(node,index);
                        if(arg===null){const param=role.parameters[index];if(Object.hasOwn(param,'default')){const value=param.default;if(value!==null&&!['number','string','boolean'].includes(typeof value))return false;domains?.add(value===null?'null':typeof value);}else domains?.add('undefined');evidence.add(node);return true;}
                        return arg!==false&&safe(arg,false,evidence,domains);
                    });if(!valid)return false;dispatched=true;}
                    else if(!calls.length)return false;
                    valid=valid||dispatch.length>0;
                }
                valid=(calls.length>0||dispatched)&&calls.every(call=>{
                    if(call.opcode==='procedures_call'){let ids;try{ids=JSON.parse(call.mutation?.argumentids||'[]');}catch{return false;}if(!Array.isArray(ids)||ids.length!==cell.scope.params.length||ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length)return false;if(domains){let expected;try{expected=JSON.parse(input(cell.scope.root,'custom_block')?.mutation?.argumentids||'[]');}catch{return false;}if(JSON.stringify(ids)!==JSON.stringify(expected))return false;}return safe(input(call,ids[proof.index]),player,evidence,domains);}
                    const arg=argumentsFor(call,proof.index);if(arg===null&&!player){evidence.add(call);domains?.add('undefined');return true;}return arg!==false&&safe(arg,player,evidence,domains);});
            }
            if(!valid||proof.escaped&&!evidence.size)return false;
            for(const origin of evidence)origins?.add(origin);return true;
        };
        // Domain queries are a least fixpoint over flow cycles. A backedge
        // contributes the domains its node produced in the previous round, or
        // PENDING (bottom) in the first; rounds repeat until no node's domains
        // grow, and a result still PENDING is refused.
        let cycleDomains=null,cycleGrew=false;
        const PENDING='pending';
        const safe = (node,player=false,origins=null,domains=null) => {
            if (!node) return false;
            const visited=seen.get(player);
            if (visited.has(node)) { // A flow backedge cannot introduce an opaque producer; every outgoing writer is still checked.
                if(domains&&!player){const prior=cycleDomains?.get(node);if(prior?.size)for(const type of prior)domains.add(type);else domains.add(PENDING);}
                return !player;
            }
            if(!domains||player||!cycleDomains)return safeNode(node,player,origins,domains);
            const local=new Set(),valid=safeNode(node,player,origins,local);
            const known=cycleDomains.get(node)||new Set();
            for(const type of local){domains.add(type);if(type!==PENDING&&!known.has(type)){known.add(type);cycleGrew=true;}}
            cycleDomains.set(node,known);return valid;
        };
        const safeNode = (node,player,origins,domains) => {
            const visited=seen.get(player);
            visited.add(node);
            try {
                const op=node.opcode;
                if(!player&&op==='arcade_objectField'){
                    classFieldDepth++;try{
                    const model=classRows();if(!model)return false;
                    const cls=receiverClass(input(node,'OBJECT'),model),name=literal(node,'FIELD');
                    const field=cls?.fields.find(f=>f.name===name);if(!field||field.valueKind||!readyReceiver(input(node,'OBJECT'),node,model))return false;
                    const ownRole=model.roles.get(captureProof.scopeOf(node)?.procedure);
                    if(ownRole&&['constructor','initializer'].includes(ownRole.kind))return false;
                    if(field.getter){
                        if(!constructedField(cls,null,model))return false;
                        const definition=classDefinition(field.getter);if(!definition)return false;
                        const completion=normalReturns(definition);if(completion.fallthrough||!completion.results.length)return false;
                        return completion.results.every(ret=>safe(input(ret,'VALUE'),false,origins,domains));
                    }
                    if(field.setter||!constructedField(cls,field,model))return false;
                    let writers=0;
                    for(const writer of Object.values(all))if(writer.opcode==='arcade_setObjectField'){
                        const receiver=receiverClass(input(writer,'OBJECT'),model),property=literal(writer,'FIELD');
                        if(!receiver||typeof property!=='string')return false;
                        if(receiver===cls&&property===name){writers++;if(!safe(input(writer,'VALUE'),false,origins,domains))return false;}
                    }
                    if(writers)origins?.add(node);return writers>0;
                    }finally{classFieldDepth--;}
                }
                if(!player&&op==='arcade_sceneMillis'){
                    // A dormant call is only a structural obligation of another
                    // ordinary caller. It is never a completed supplied value.
                    if(!(structural?sceneClock?.eligible(target,node):sceneClock?.prove(target,node,args,util)))return false;
                    origins?.add(node);domains?.add('number');return true;
                }
                if(!player&&op==='arcade_frameDeltaTime'){
                    // A dormant call is only a structural obligation of another
                    // ordinary caller. It is never a completed supplied value.
                    if(!(structural?frameDelta?.eligible(target,node):frameDelta?.prove(target,node,args,util)))return false;
                    origins?.add(node);domains?.add('number');return true;
                }
                if(!player&&op==='arcade_spriteProperty'){
                    // PXT Sprite fields are typed. The extension reads each numeric field as a Number
                    // (lifespan is undefined until set); `data` is an arbitrary value, so it stays unproven.
                    const property=node.fields?.PROPERTY?.value;
                    if(!SPRITE_NUMBER_PROPERTIES.has(property))return false;
                    origins?.add(node);domains?.add('number');if(property==='lifespan')domains?.add('undefined');return true;
                }
                if(!player&&domains&&['arcade_signNumber','arcade_truncateNumber','arcade_controllerStep','arcade_randomNumber','arcade_backgroundColor'].includes(op)){
                    // These reporters return a Number on every normal completion; an operand the
                    // block cannot convert throws, which supplies no value. The input-free
                    // background color reads state its only writer stores as Number(COLOR)||0
                    // (scene.backgroundColor(): number in the pinned SDK).
                    origins?.add(node);domains.add('number');return true;
                }
                if(!player&&domains&&op==='arcade_mathUnary'&&['truncate','sign'].includes(literal(node,'OP'))){
                    // The same Number-valued reporters as arcade_truncateNumber and arcade_signNumber.
                    origins?.add(node);domains.add('number');return true;
                }
                if(!player&&op==='arrays_referenceItem'){
                    // Literal-index reads use the separately closed local prefix
                    // or the existing global publication proof. The selected
                    // pushed element still needs its own primitive domain proof.
                    const slot=localPositionalElement(node)||positionalElement(node);
                    if(slot){const valid=safe(slot,false,origins,domains);if(valid)origins?.add(node);return valid;}
                    const elements=familyElement(node);
                    if(elements){const valid=elements.every(value=>safe(value,false,origins,domains));if(valid)origins?.add(node);return valid;}
                    const normal=numericFamilyResult(node,origins);if(normal){for(const type of normal)domains?.add(type);return true;}
                }
                if(!player&&op==='arcade_getPlayerScore'){
                    if(!scoreNumber(node))return false;
                    origins?.add(node);domains?.add('number');return true;
                }
                if(player&&op==='arcade_eventPlayer'){
                    const owner=owners.get(node),token=literal(owner,'TOKEN');
                    if(owner?.opcode!=='arcade_whenRegisteredMultiplayerConnection'||typeof token!=='string'||!token)return false;
                    const hats=Object.values(all).filter(value=>value.opcode===owner.opcode&&literal(value,'TOKEN')===token);
                    const registrations=Object.values(all).filter(value=>value.opcode==='arcade_registerMultiplayerConnection'&&literal(value,'TOKEN')===token);
                    const event=registrations.length===1&&input(registrations[0],'EVENT');
                    const valid=hats.length===1&&hats[0]===owner&&event?.opcode==='math_number'&&[1,2].includes(Number(event.fields?.NUM?.value));if(valid)origins.add(node);return valid;
                }
                if(player&&op==='arrays_specialValue')return ['null','undefined'].includes(literal(node,'KIND'));
                if(player&&!['data_variable','arcade_getLocal','arcade_getCaptured','arcade_callFunction'].includes(op)&&!/^argument_reporter_/.test(op))return false;
                if(!player&&op==='arcade_playerProperty'){
                    const property=input(node,'PROPERTY');
                    const evidence=new Set(),valid=literal(node,'READ')==='safe'&&property?.opcode==='math_number'&&Number(property.fields?.NUM?.value)===2&&safe(input(node,'PLAYER'),true,evidence)&&evidence.size>0;if(valid){origins?.add(node);domains?.add('number');}return valid;
                }
                if (['text','bw_stringLiteral','math_number','bw_numberLiteral','arrays_specialValue',
                    'operator_join','operator_letter_of','operator_length','operator_add','operator_subtract',
                    'operator_multiply','operator_divide','operator_mod','operator_round','operator_random',
                    'operator_equals','operator_gt','operator_lt','operator_not','operator_and','operator_or',
                    'arrays_valueTruthy','arrays_valueCompare','arcade_sourceTypeOf','arcade_askForString',
                    'arcade_spriteToString','arcade_bufferToString','arcade_bufferToHex'].includes(op)) {origins?.add(node);terminalDomain(node,domains);return true;}
                if(!player&&(op==='arcade_highScore'||domains&&(op==='arcade_sourceValueBinary'||op==='arcade_sourceValueUnary'))){
                    if(!sourceNumber(node))return false;
                    origins?.add(node);domains?.add('number');return true;
                }
                if(!player&&op==='arrays_referenceLength'){
                    // The length of an array held in a plain variable or local is
                    // a side-effect-free Number; any other array producer is opaque.
                    const array=input(node,'ARRAY');
                    if(!['data_variable','arcade_getLocal','arcade_getCaptured'].includes(array?.opcode))return false;
                    origins?.add(node);domains?.add('number');return true;
                }
                if (op === 'arcade_inspectValue') {
                    if(!domains)return safe(input(node,'VALUE'))&&safe(input(node,'LIMIT'));
                    const limit=new Set();if(!safe(input(node,'VALUE'))||!safe(input(node,'LIMIT'),false,null,limit))return false;
                    domains.add(limit.has(PENDING)?PENDING:limit.size&&[...limit].every(type=>['number','undefined'].includes(type))?'string':'unknown');return true;
                }
                if (op === 'data_variable') {
                    const id=node.fields?.VARIABLE?.id, variable=target.lookupVariableById(id);
                    if (!variable || nativeCell(id)!==variable || cells.referenceTypeOf(target,id) || (player?!!cells.typeOf(target,id):cells.typeOf(target,id) && !kinds.has(cells.typeOf(target,id)))) return false;
                    const writers=runtime.targets.filter(t=>t.isOriginal!==false).flatMap(t=>Object.values(t.blocks._blocks)
                        .filter(b=>['data_setvariableto','data_changevariableby'].includes(b.opcode) && t.lookupVariableById(b.fields?.VARIABLE?.id)===variable)
                        .map(writer=>({target:t,writer})));
                    if(!writers.length&&!player){try{const value=primitive(variable.value);domains?.add(value===null?'null':typeof value);origins?.add(variable);}catch{return false;}}
                    return (!player||writers.length>0)&&writers.every(entry=>{if(entry.target!==target)return false;if(domains&&entry.writer.opcode==='data_changevariableby'){domains.add('number');return safe(input(entry.writer,'VALUE'),player,origins);}return safe(input(entry.writer,'VALUE'),player,origins,domains);});
                }
                if (op === 'arcade_getLocal' || op === 'arcade_getCaptured' || /^argument_reporter_/.test(op)) {
                    const name=/^argument_reporter_/.test(op)?node.fields?.VALUE?.value:literal(node,'NAME');
                    const scope=captureProof.scopeOf(node),cell=op==='arcade_getCaptured'?captureProof.captured(scope,name):captureProof.local(scope,name);
                    return safeCell(cell,player,origins,domains,op==='arcade_getLocal'?node:null);
                }
                if (op === 'arcade_callFunction') {
                    const name=literal(node,'NAME'),definitions=Object.values(all).filter(value=>value.opcode==='procedures_definition'&&input(value,'custom_block')?.mutation?.proccode===name);
                    if(definitions.length!==1)return false;const definition=definitions[0];
                    if(domains&&!player){const completion=normalReturns(definition);if(completion.fallthrough)domains.add('undefined');return (completion.fallthrough||completion.results.length>0)&&completion.results.every(ret=>safe(input(ret,'VALUE'),false,origins,domains));}
                    const returns=Object.values(all).filter(b=>owners.get(b)===name && b.opcode==='arcade_returnValue');
                    if(player){let last=read(definition.next);const chain=new Set();while(last?.next&&!chain.has(last)){chain.add(last);last=read(last.next);}if(last?.opcode!=='arcade_returnValue')return false;}
                    return returns.length>0 && returns.every(ret=>safe(input(ret,'VALUE'),player,origins));
                }
                if (op==='arrays_valueBinary') {
                    if(!domains)return safe(input(node,'LEFT'))&&safe(input(node,'RIGHT'));
                    // Numeric-only operators complete with a Number whatever their operands are.
                    if(['-','*','/','%','**','&','|','^','<<','>>','>>>'].includes(literal(node,'OP'))){origins?.add(node);domains.add('number');return true;}
                    const left=new Set(),right=new Set();if(!safe(input(node,'LEFT'),false,null,left)||!safe(input(node,'RIGHT'),false,null,right))return false;
                    const operation=literal(node,'OP');
                    if(operation==='+') {
                        if(left.has(PENDING)||right.has(PENDING))domains.add(PENDING);
                        const l=new Set([...left].filter(type=>type!==PENDING)),r=new Set([...right].filter(type=>type!==PENDING));
                        if(l.has('string')||r.has('string'))domains.add('string');if([...l].some(type=>type!=='string')&&[...r].some(type=>type!=='string'))domains.add('number');
                        if(!l.size&&!left.has(PENDING)||!r.size&&!right.has(PENDING)||l.has('unknown')||r.has('unknown'))domains.add('unknown');}
                    else domains.add(['-','*','/','%','**','&','|','^','<<','>>','>>>'].includes(operation)?'number':'unknown');
                    return true;
                }
                if (op==='arcade_mathBinary') {
                    // mathBinary returns one actual operand for min/max and a
                    // Number for atan2/randomRange; other operations throw.
                    const operation=literal(node,'OP');
                    if(!['min','max','atan2','randomRange'].includes(operation))return false;
                    if(!domains)return safe(input(node,'A'))&&safe(input(node,'B'));
                    const left=new Set(),right=new Set();if(!safe(input(node,'A'),false,null,left)||!safe(input(node,'B'),false,null,right))return false;
                    if(operation==='min'||operation==='max'){
                        if(!left.size||!right.size)domains.add('unknown');
                        for(const type of [...left,...right])domains.add(type);
                    }else domains.add('number');
                    return true;
                }
                if (op==='arrays_valueUnary') {
                    if(domains&&['+','-','~','!','typeof'].includes(literal(node,'OP'))){const operation=literal(node,'OP');domains.add(operation==='typeof'?'string':operation==='!'?'boolean':'number');origins?.add(node);return true;}
                    if(!safe(input(node,'VALUE')))return false;
                    if(domains){const operation=literal(node,'OP');domains.add(operation==='typeof'?'string':operation==='!'?'boolean':['+','-','~'].includes(operation)?'number':'unknown');}return true;
                }
                return false;
            } finally {visited.delete(node);}
        };
        if(requested){for(const [index,request]of requested.entries()){const domains=new Set();structural=!!request.procedure;if(request.procedure){const scopes=captureProof.scopes.filter(scope=>scope.target===target&&scope.procedure===request.procedure);if(scopes.length!==1||!scopes[0].params.includes(request.formal))fail('actual formal binding differs');request.cell=captureProof.local(scopes[0],request.formal);}let valid=false;cycleDomains=new Map();try{for(let round=0;round<16;round++){domains.clear();cycleGrew=false;valid=request.cell?safeCell(request.cell,false,null,domains):safe(input(request.node,request.name),false,null,domains);if(!valid||!cycleGrew)break;}}finally{cycleDomains=null;}if(cycleGrew)valid=false;if(!valid||!domains.size||domains.has('unknown')||domains.has(PENDING))fail('connected input lacks complete primitive domain evidence'+scoreDetail());possible.set(index,domains);}return;}
        if (!safe(input(block,'VALUE')) || !safe(input(block,'LIMIT'))) fail('connected input lacks primitive producer authority'+scoreDetail());
        return {value:input(block,'VALUE'),limit:input(block,'LIMIT')};
    };
    const inspect = (args,util,onError) => {
        if (active) fail('reentrant inspection');
        active=true;
        try {
            current();
            const block=primitiveOwner.current(util,args);
            if (!block || block.opcode!=='arcade_inspectValue') fail('actual current primitive ownership is missing');
            reporterOwner(runtime,util,args,'arcade_inspectValue',[]);
            const target=util.thread.target;
            if (!snapshots.has(target)) fail('foreign or cloned target');
            const source=prove(target,block,null,null,util,args);
            const actual = (node,value) => {
                const decoded=primitive(value);
                if (node.opcode!=='math_number') return decoded;
                const field=node.fields?.NUM?.value;
                if (!Number.isFinite(Number(field)) || String(decoded)!==String(field)) fail('numeric shadow input differs');
                return Number(field);
            };
            const value=actual(source.value,args.VALUE),limit=actual(source.limit,args.LIMIT);
            if (limit!==undefined && typeof limit!=='number') fail('LIMIT requires Number or Undefined');
            return ''+value;
        } catch (error) {
            if (typeof onError!=='function') throw error;
            return onError(error);
        } finally {active=false;}
    };
    const inputDomains=(args,util,inputNames)=>{
        if(active)fail('reentrant primitive domain query');
        active=true;
        try{
            current();const block=primitiveOwner.current(util,args);
            if(!block)fail('actual current primitive ownership is missing');
            reporterOwner(runtime,util,args,block.opcode,[]);
            const target=util.thread.target;
            if(!snapshots.has(target)||!Array.isArray(inputNames)||new Set(inputNames.map(value=>JSON.stringify(value))).size!==inputNames.length)fail('actual primitive input slots are missing');
            const requests=inputNames.map(value=>{
                if(value&&typeof value==='object'&&!Array.isArray(value)){
                    if(Object.keys(value).sort().join(',')!=='formal,procedure'||typeof value.procedure!=='string'||typeof value.formal!=='string')fail('actual formal query differs');
                    return {procedure:value.procedure,formal:value.formal};
                }
                const path=typeof value==='string'?[value]:value;
                if(!Array.isArray(path)||!path.length||path.some(name=>typeof name!=='string'))fail('actual primitive input path differs');
                let node=block;
                for(const name of path.slice(0,-1)){
                    const child=target.blocks.getBlock(node.inputs?.[name]?.block);
                    if(!child||child.parent!==node.id)fail('actual primitive input path is not connected');node=child;
                }
                const name=path[path.length-1],child=target.blocks.getBlock(node.inputs?.[name]?.block);if(!child||child.parent!==node.id)fail('actual primitive input slot is missing or disconnected');
                return {node,name};
            });
            // A completed proof of this call site is reused until the graph (stamp) changes.
            const key=block.id+'|'+JSON.stringify(requests.map(request=>request.node?[request.node.id,request.name]:[request.procedure,request.formal]));
            const stamp=verifiedStamp&&verifiedStamp.key;
            const cached=stamp&&proofs.get(key);
            if(cached&&cached.stamp===stamp)return cached.result;
            let cacheable=true;const possible=new Map();prove(target,block,requests,possible,util,args,()=>{cacheable=false;});
            const result=Object.freeze(requests.map((_,index)=>Object.freeze([...possible.get(index)])));
            if(stamp&&cacheable)proofs.set(key,{stamp,result});
            return result;
        }finally{active=false;}
    };
    return Object.freeze({inspect,inputDomains,snapshot,invalidate:()=>{snapshots=new Map();verifiedStamp=null;proofs=new Map();},dispose:()=>{disposed=true;snapshots=new Map();verifiedStamp=null;proofs=new Map();}});
}
module.exports=Object.assign(create,{primitive,scoreInfo,bindScoreAdapterInfo,bindSourceOperationAdapter});
