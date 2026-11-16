import {arrayMenuLiteral,isArrayMenuSelector,isKnownArrayMenuOperation} from './array-menu-literal.js';
import {createArrayDefiniteOverwrite} from './array-definite-overwrite.js';
import {createArrayNativeFrameReset} from './array-native-frame-reset.js';
import {createArraySourceStartResetEffects} from './array-source-start-reset-effects.js';
import {createProjectConditionalArrayEntry,createProjectArrayPublicationFrontier} from './project-conditional-array-entry.js';
import {isProjectJsonSnapshot} from './project-json-snapshot.js';
import {createClosedOrdinaryProjectEntry} from './closed-ordinary-project-entry.js';
import {SDK_CLASS_NODES,SDK_SPRITE_CLASS_NODES,SDK_DIALOG_CLASS_NODES} from './sdk-class-descriptors.js';
const watcherOwnDescriptor=Object.getOwnPropertyDescriptor,watcherOwnKeys=Reflect.ownKeys,watcherIsArray=Array.isArray,watcherFinite=Number.isFinite,watcherCreate=Object.create,watcherNumber=Number;
const prefixGetPrototype=Object.getPrototypeOf,prefixHasOwn=Object.hasOwn,prefixSameValue=Object.is;
const prefixAmbient=[Object.prototype,Array.prototype].map(object=>({object,parent:prefixGetPrototype(object),
    entries:watcherOwnKeys(object).map(key=>[key,watcherOwnDescriptor(object,key)])}));
const privatePrefixAmbientCurrent=()=>{
    for(let i=0;i<prefixAmbient.length;i++){
        const row=prefixAmbient[i],keys=watcherOwnKeys(row.object);
        if(prefixGetPrototype(row.object)!==row.parent||keys.length!==row.entries.length)return false;
        for(let j=0;j<keys.length;j++){
            const entry=row.entries[j],key=entry[0],before=entry[1],now=watcherOwnDescriptor(row.object,keys[j]);
            if(keys[j]!==key||!now||now.enumerable!==before.enumerable||now.configurable!==before.configurable||
                prefixHasOwn(now,'value')!==prefixHasOwn(before,'value')||
                (prefixHasOwn(before,'value')?!prefixSameValue(now.value,before.value)||now.writable!==before.writable:
                    now.get!==before.get||now.set!==before.set))return false;
        }
    }
    return true;
};
// Read only own data slots: a changed descriptor cannot run an SDK metadata
// getter while checking this private dependency. The profile is solely a
// refusal inventory of intrinsic class/member names, never a receiver fact.
const privatePrefixSdkProfile=()=>{
    const slots=[],prototypes=new Map();let valid=true;
    const own=(object,key)=>{
        if(!object||typeof object!=='object')return undefined;
        const parent=prefixGetPrototype(object),expected=watcherIsArray(object)?Array.prototype:Object.prototype;
        if(parent!==expected){valid=false;return undefined;}
        prototypes.set(object,parent);
        const descriptor=watcherOwnDescriptor(object,key);
        slots.push({object,key,descriptor});
        if(!descriptor||!prefixHasOwn(descriptor,'value'))return undefined;
        return descriptor.value;
    };
    const list=value=>watcherIsArray(value)&&Number.isSafeInteger(own(value,'length'))&&own(value,'length')<=256;
    if(!list(SDK_CLASS_NODES))return null;
    // The aggregate is a spread snapshot. Source exporters reread the two
    // supplier arrays, so their exact lengths, slots and composition are also
    // required; neither replacement nor an appended class can hide behind it.
    let offset=0;
    for(const supplier of [SDK_SPRITE_CLASS_NODES,SDK_DIALOG_CLASS_NODES]){
        if(!list(supplier))return null;
        for(let i=0;i<own(supplier,'length');i++)if(own(supplier,i+'')!==own(SDK_CLASS_NODES,offset++ +''))return null;
    }
    if(offset!==own(SDK_CLASS_NODES,'length'))return null;
    const names=new Set(),members=new Set();
    for(let i=0;i<own(SDK_CLASS_NODES,'length');i++){
        const cls=own(SDK_CLASS_NODES,i+''),name=own(cls,'name'),base=own(cls,'base');
        if(typeof name!=='string'||names.has(name)||base!==undefined&&typeof base!=='string')return null;
        names.add(name);
        for(const slot of ['fields','methods']){
            const rows=own(cls,slot);if(!list(rows))return null;
            for(let j=0;j<own(rows,'length');j++){
                const name=own(own(rows,j+''),'name');if(typeof name!=='string')return null;members.add(name);
            }
        }
    }
    if(!valid)return null;
    const current=()=>[...prototypes].every(([object,parent])=>prefixGetPrototype(object)===parent)&&slots.every(({object,key,descriptor:d})=>{
        const now=watcherOwnDescriptor(object,key);
        if(!d)return !now;
        return !!now&&prefixHasOwn(now,'value')&&prefixSameValue(now.value,d.value)&&now.writable===d.writable&&
            now.enumerable===d.enumerable&&now.configurable===d.configurable;
    });
    return {names,members,current};
};
const privatePrefixParse=JSON.parse;
import {sourceValueOperation} from './source-value-operator-helpers.js';
import {createArrayOccurrenceExportAuthority} from './array-occurrence-export-authority.js';
import {analyseConsoleCaptures} from './console-capture-provenance.js';
import {createAnimationFrameArrayProducers, isAnimationFrameArrayProducer} from './animation-frame-array-producers.js';

// SDK reporters whose native implementation returns a fresh Array reference
// (or reports an error), keyed to their exact input schema.
const FRESH_SDK_ARRAYS=Object.freeze({arcade_tilesOfType:Object.freeze(['IMAGE']),arcade_legacyTilesOfType:Object.freeze(['INDEX']),
    arcade_bufferChunked:Object.freeze(['BUFFER','SIZE']),arcade_bufferChunkedFromUTF8:Object.freeze(['TEXT','SIZE']),
    arcade_bufferUnpack:Object.freeze(['BUFFER','FORMAT','OFFSET']),arcade_bufferToArray:Object.freeze(['BUFFER','FORMAT']),
    // mp.allPlayers() returns a fresh Player[] in PXT; Lite issues a fresh reference per call.
    arcade_allPlayers:Object.freeze([]),
    // TileMapData.getTileset() returns the map's own Image[] (an actual Array, never
    // null: a map without a tileset holds an empty one). Its elements are Images.
    arcade_tilemapTileset:Object.freeze(['DATA'])});

// Producer facts are deliberately separate from the exporter's annotation graph.
// Merely being plugged into an ARRAY input never creates an Array fact.
export function createArrayReferenceExportAuthority(project, options = {}, animationProducer = null) {
    const ordinaryEntry=createClosedOrdinaryProjectEntry(project);
    const animationProducers = animationProducer === null ? createAnimationFrameArrayProducers(options) :
        isAnimationFrameArrayProducer(animationProducer, options) ? animationProducer : createAnimationFrameArrayProducers({});
    // `missing` is an element read whose presence is unproved: possibly an
    // absent (undefined, hence falsy) slot. It is otherwise exactly `bad`.
    const missing=Symbol('possibly absent element'),bad=Symbol('unproved value'),targets=project.targets||[],nodes=new Map(),records=[],owners=new WeakMap(),invalid=new WeakSet(),snapshots=[];
    const cells=new Map(),values=new WeakMap(),tokens=new WeakMap(),scopes=[],procedures=new Map(),calls=[],mutations=[];
    let invalidGlobalBinding=false;
    const block=(target,id)=>typeof id==='string'?target.blocks?.[id]:null;
    const child=(node,name,target)=>block(target,node?.inputs?.[name]?.[1]);
    const literal=(node,name,target)=>{
        if(isArrayMenuSelector(node,name))return arrayMenuLiteral(target,node,name);
        if(node?.fields?.[name])return typeof node.fields[name][0]==='string'?node.fields[name][0]:null;
        const value=node?.inputs?.[name]?.[1];if(Array.isArray(value)&&value[0]===10)return String(value[1]);
        const leaf=block(target,value);return leaf?.shadow&&leaf.opcode==='text'?leaf.fields?.TEXT?.[0]:null;
    };
    const captures=analyseConsoleCaptures({targets,blocks:target=>target.blocks||{},input:(node,name,target)=>child(node,name,target),literal});
    const snapshot=()=>JSON.stringify(targets.map(target=>[target.variables,target.blocks]));
    const original=snapshot();
    for(const target of targets){
        const all=target.blocks||{};nodes.set(target,new Map(Object.entries(all)));
        for(const [id,node]of Object.entries(all)){
            const inputRows=Object.entries(node.inputs||{}).map(([name,input])=>[name,input,input?.[1],input?.[2]]);
            snapshots.push({target,id,node,inputs:node.inputs,fields:node.fields,mutation:node.mutation,inputRows});
        }
        const incoming=new Map();
        for(const node of Object.values(all))for(const id of [node.next,...Object.values(node.inputs||{}).flatMap(input=>[input?.[1],input?.[2]])])if(typeof id==='string'){
            if(!all[id]){invalid.add(node);continue;}if(!incoming.has(id))incoming.set(id,[]);incoming.get(id).push(node);
        }
        for(const [id,node]of Object.entries(all))for(const slot of Object.values(node.inputs||{})){
            if(!Array.isArray(slot)||![1,2,3].includes(slot[0])||slot.length!==(slot[0]===3?3:2)){invalid.add(node);continue;}
            const leaf=(value,fallback=false)=>{
                if(Array.isArray(value))return value.length===2&&[4,5,6,7,8,9,10,11].includes(value[0])||!fallback&&value.length===3&&value[0]===12&&typeof value[1]==='string'&&typeof value[2]==='string';
                const child=all[value];if(typeof value!=='string'||!child||child.parent!==id||(incoming.get(value)||[]).length!==1)return false;
                if(fallback||slot[0]===1&&node.opcode!=='procedures_definition')return child.shadow===true&&!child.next&&!Object.keys(child.inputs||{}).length;
                return node.opcode==='procedures_definition'&&child.opcode==='procedures_prototype'||child.shadow!==true;
            };
            if(!leaf(slot[1])||slot[0]===3&&!leaf(slot[2],true))invalid.add(node);
        }
        for(const [id,node]of Object.entries(all))if(node.topLevel){
            const proto=node.opcode==='procedures_definition'?child(node,'custom_block',target):null;
            let names=[],ids=[],defaults=[],proc=null;
            if(proto)try{names=JSON.parse(proto.mutation.argumentnames);ids=JSON.parse(proto.mutation.argumentids);defaults=JSON.parse(proto.mutation.argumentdefaults);proc=proto.mutation.proccode;}catch{invalid.add(node);}
            const scope={target,root:node,id,proc,params:names,ids,invalid:invalid.has(node),before:new WeakMap(),returns:[],callers:[]};scopes.push(scope);
            if(proto){if(!Array.isArray(names)||!Array.isArray(ids)||!Array.isArray(defaults)){scope.invalid=true;names=[];ids=[];defaults=[];scope.params=names;scope.ids=ids;}
                if(proto.parent!==id||proto.next||Object.keys(proto.inputs||{}).sort().join('|')!==[...ids].sort().join('|')||ids.some((arg,index)=>{const edge=proto.inputs[arg],reporter=all[edge?.[1]];return !reporter||reporter.parent!==Object.keys(all).find(key=>all[key]===proto)||reporter.shadow!==true||reporter.next||Object.keys(reporter.inputs||{}).length||Object.keys(reporter.fields||{}).join('|')!=='VALUE'||reporter.fields.VALUE?.[0]!==names[index];}))scope.invalid=true;
                if(!Array.isArray(names)||!Array.isArray(ids)||!Array.isArray(defaults)||names.length!==ids.length||names.length!==defaults.length||new Set(names).size!==names.length||new Set(ids).size!==ids.length||typeof proc!=='string')scope.invalid=true;
                const key=target;let map=procedures.get(key);if(!map)procedures.set(key,map=new Map());if(map.has(proc)){scope.invalid=true;map.get(proc).invalid=true;}else map.set(proc,scope);}
            const visit=(value,path=new Set())=>{
                if(!value)return;if(path.has(value)){scope.invalid=true;invalid.add(value);return;}if(owners.has(value)){scope.invalid=true;owners.get(value).invalid=true;return;}
                owners.set(value,scope);records.push({target,node:value,scope});const next=new Set([...path,value]);
                const actualId=Object.keys(all).find(key=>all[key]===value),edges=incoming.get(actualId)||[];
                if(value!==node&&(edges.length!==1||all[value.parent]!==edges[0]))invalid.add(value);
                for(const input of Object.values(value.inputs||{}))if(typeof input?.[1]==='string')visit(all[input[1]],next);
                if(typeof value.next==='string')visit(all[value.next],next);
            };
            // Prototype argument reporters are declarations, not executable reads.
            owners.set(node,scope);records.push({target,node,scope});if(node.next)visit(all[node.next],new Set([node]));
        }
    }
    let dynamicFields=false;const fieldCell=name=>cell('field:'+name);
    const cell=key=>{if(!cells.has(key))cells.set(key,{key,writers:[],types:new Set(),formal:null});return cells.get(key);};
    const globalCell=(target,id)=>{
        const own=targets.filter(t=>Object.hasOwn(t.variables||{},id));if(own.length!==1)return null;
        const actual=own[0];if(actual!==target&&!actual.isStage)return null;
        const name=actual.variables[id]?.[0];if(typeof name!=='string'||Object.values(actual.variables).filter(row=>row?.[0]===name).length!==1||actual!==target&&Object.values(target.variables||{}).some(row=>row?.[0]===name))return null;
        if(!nodes.has(actual))return null;let map=globalCell.maps.get(actual);if(!map)globalCell.maps.set(actual,map=new Map());if(!map.has(id))map.set(id,{});const value=cell(map.get(id));value.global=true;return value;
    };globalCell.maps=new Map();
    const localCell=(scope,name)=>{if(!scope||scope.invalid||typeof name!=='string'||name==='__proto__')return null;let map=localCell.maps.get(scope);if(!map)localCell.maps.set(scope,map=new Map());if(!map.has(name))map.set(name,{});return cell(map.get(name));};localCell.maps=new Map();
    const capturedCell=(scope,name)=>{const origin=captures.captured(captures.scopeOf(scope.root.next?block(scope.target,scope.root.next):scope.root),name);const value=origin?localCell(scopes.find(s=>s.root===origin.scope.root),name):null;if(value&&!captures.proof(origin))(value.directBad=true,value.types.add(bad));return value;};
    const binding=(target,node)=>{
        const scope=owners.get(node);if(node.opcode==='data_variable'){const id=node.fields?.VARIABLE?.[1],declaration=targets.find(t=>Object.hasOwn(t.variables||{},id))?.variables[id];return declaration?.[0]===node.fields?.VARIABLE?.[0]?globalCell(target,id):null;}
        if(node.opcode==='arcade_getLocal'){const name=literal(node,'NAME',target),value=localCell(scope,name),origin=captures.local(captures.scopeOf(node),name);if(value&&origin&&!captures.proof(origin))(value.directBad=true,value.types.add(bad));return value;}
        if(node.opcode==='arcade_getCaptured')return capturedCell(scope,literal(node,'NAME',target));
        if(node.opcode.startsWith('argument_reporter_'))return localCell(scope,node.fields?.VALUE?.[0]);return null;
    };
    const input=(node,name,target)=>{const raw=node?.inputs?.[name]?.[1];if(typeof raw==='string')return {target,node:block(target,raw)};if(Array.isArray(raw)&&raw[0]===12){const value=globalCell(target,raw[2]);const declaration=targets.find(t=>Object.hasOwn(t.variables||{},raw[2]))?.variables[raw[2]];return declaration?.[0]===raw[1]?{target,cell:value,at:node}:{target,raw:null,at:node};}return {target,raw,at:node};};
    const exactKeys=(node,inputs,fields=[])=>Object.keys(node.inputs||{}).sort().join('|')===[...inputs].sort().join('|')&&Object.keys(node.fields||{}).every(name=>fields.includes(name));
    const schemas={arrays_referenceTruthy:['ARRAY','INDEX'],arrays_referenceItem:['ARRAY','INDEX'],arrays_referenceRemove:['ARRAY','VALUE'],arrays_referenceRandom:['ARRAY'],arrays_referenceLength:['ARRAY'],arrays_referenceSlice:['ARRAY','START','END'],arrays_referenceConcat:['ARRAY','OTHER'],arrays_referenceIndexOf:['ARRAY','VALUE','INDEX'],arrays_referenceTake:['ARRAY','OP','INDEX'],arrays_mutateReference:['ARRAY','OP','INDEX','VALUE']};
    const operationShape=node=>{const expected=schemas[node.opcode];if(!expected)return false;if(isArrayMenuSelector(node,'OP')&&!isKnownArrayMenuOperation(node,literal(node,'OP',owners.get(node)?.target)))return false;const fieldOp=Object.hasOwn(node.fields||{},'OP'),inputs=fieldOp?expected.filter(name=>name!=='OP'):expected;return exactKeys(node,inputs,fieldOp?['OP']:[]);};
    const argumentList=(target,node)=>{
        const args=[],seen=new Set();let edge=node.inputs?.ARGS?.[1];
        while(typeof edge==='string'){
            const value=block(target,edge);if(!value||seen.has(value)||invalid.has(value))return null;seen.add(value);
            if(value.opcode==='text'&&value.shadow&&value.fields?.TEXT?.[0]==='[]')return args;
            if(value.opcode!=='arcade_functionArgument'||!exactKeys(value,['VALUE','REST']))return null;
            args.push(input(value,'VALUE',target));edge=value.inputs.REST?.[1];
        }
        return Array.isArray(edge)&&edge[0]===10&&edge[1]==='[]'?args:null;
    };
    // VM variable sockets use IDs; this exporter resolves the current name.
    // Both must identify the same unique visible declaration. A mismatch must
    // not lend facts to either the VM destination or the emitted destination.
    const agrees=(target,name,id)=>{
        const c=globalCell(target,id),owner=targets.find(t=>Object.hasOwn(t.variables||{},id));
        return !!c&&typeof name==='string'&&owner.variables[id][0]===name;
    };
    for(const target of targets)for(const node of Object.values(target.blocks||{})){
        if(['data_setvariableto','data_changevariableby','data_variable'].includes(node.opcode)){
            const field=node.fields?.VARIABLE;
            if(!Array.isArray(field)||field.length!==2||!agrees(target,field[0],field[1]))invalidGlobalBinding=true;
            if(!exactKeys(node,node.opcode==='data_variable'?[]:['VALUE'],['VARIABLE'])||node.mutation!=null)invalidGlobalBinding=true;
        }
        for(const slot of Object.values(node.inputs||{}))for(const value of [slot?.[1],slot?.[2]])if(Array.isArray(value)&&value[0]===12&&
            (value.length!==3||!agrees(target,value[1],value[2])))invalidGlobalBinding=true;
    }
    for(const scope of scopes)for(const name of scope.params||[]){const value=localCell(scope,name);if(value)value.formal=scope;}
    // A statement in the untaken branch of an if/else (or if) whose condition
    // is a comparison of two literal Numbers never runs: both PXT and Lite
    // evaluate the same constant (the `true ? a : b` lowering emits 0 < 1).
    const literalOperand=(node,name)=>{const raw=node.inputs?.[name]?.[1];
        return Array.isArray(raw)&&raw.length===2&&[4,5,6,7,8].includes(raw[0])&&String(raw[1]).trim()!==''&&Number.isFinite(Number(raw[1]))?Number(raw[1]):null;};
    const staticCondition=(target,parent)=>{
        const cond=block(target,parent.inputs?.CONDITION?.[1]);
        if(cond?.opcode!=='arrays_valueCompare'||cond.mutation!=null||!exactKeys(cond,['LEFT','RIGHT'],['OP']))return null;
        const l=literalOperand(cond,'LEFT'),r=literalOperand(cond,'RIGHT'),op=literal(cond,'OP',target);
        if(l===null||r===null)return null;
        return {'<':l<r,'>':l>r,'<=':l<=r,'>=':l>=r,'===':l===r,'!==':l!==r}[op]??null;
    };
    const staticallyUntaken=(target,node)=>{
        const seen=new Set();let current=node;
        while(current&&!seen.has(current)){seen.add(current);
            const parent=block(target,current.parent);if(!parent)return false;
            const id=Object.keys(target.blocks).find(key=>target.blocks[key]===current);
            if(parent.mutation==null&&(parent.opcode==='control_if_else'&&exactKeys(parent,['CONDITION','SUBSTACK','SUBSTACK2'])||
                parent.opcode==='control_if'&&exactKeys(parent,['CONDITION','SUBSTACK']))){
                const taken=staticCondition(target,parent);
                if(taken===false&&parent.inputs.SUBSTACK?.[1]===id)return true;
                if(taken===true&&parent.opcode==='control_if_else'&&parent.inputs.SUBSTACK2?.[1]===id)return true;
            }
            current=parent;
        }
        return false;
    };
    for(const {target,node,scope}of records){
        if(ordinaryEntry.isUnreachable(target,node)||staticallyUntaken(target,node))continue;
        let destination=null;
        if(node.opcode==='data_setvariableto'||node.opcode==='data_changevariableby')destination=globalCell(target,node.fields?.VARIABLE?.[1]);
        else if(node.opcode==='arcade_setLocal')destination=localCell(scope,literal(node,'NAME',target));
        else if(node.opcode==='arcade_setCaptured')destination=capturedCell(scope,literal(node,'NAME',target));
        if(destination&&['arcade_setLocal','arcade_setCaptured'].includes(node.opcode)&&(!exactKeys(node,['NAME','VALUE'])||node.mutation!=null))(destination.directBad=true,destination.types.add(bad));
        if(destination)destination.writers.push({target,node,scope,value:node.opcode==='data_changevariableby'?null:input(node,'VALUE',target)});
        if(node.opcode==='arcade_returnValue')scope.returns.push(input(node,'VALUE',target));
        if(['arcade_callFunction','procedures_call'].includes(node.opcode)){
            const name=node.opcode==='arcade_callFunction'?literal(node,'NAME',target):node.mutation?.proccode,fn=procedures.get(target)?.get(name);
            let args=node.opcode==='arcade_callFunction'?argumentList(target,node):null;
            if(node.opcode==='procedures_call'&&fn){let ids;try{ids=JSON.parse(node.mutation.argumentids);}catch{}if(JSON.stringify(ids)===JSON.stringify(fn.ids)&&Object.keys(node.inputs||{}).sort().join('|')===[...fn.ids].sort().join('|'))args=fn.ids.map(id=>input(node,id,target));}
            const call={target,node,scope,fn,args};calls.push(call);if(fn){fn.callers.push(call);if(!args||args.length!==fn.params.length)fn.invalid=true;else fn.params.forEach((name,index)=>localCell(fn,name)?.writers.push({target,node,scope,value:args[index],argument:true}));}
        }
        // Object fields: one pseudo cell per literal field name, written by every
        // actual setObjectField with that name. A dynamic name poisons all.
        if(node.opcode==='arcade_setObjectField'){const f=literal(node,'FIELD',target);if(typeof f==='string'&&exactKeys(node,['OBJECT','FIELD','VALUE']))fieldCell(f).writers.push({target,node,scope,value:input(node,'VALUE',target)});else dynamicFields=true;}
        if(['arrays_mutateReference','arrays_referenceTake','arrays_referenceRemove'].includes(node.opcode))mutations.push({target,node,value:input(node,'VALUE',target)});
    }
    // An unproved dynamic or value-based entry cannot disappear from a
    // procedure's complete caller obligations. Declaration metadata is used
    // only to refuse such escapes, never to issue an Array fact.
    for(const {target,node}of records){
        const functions=procedures.get(target);if(!functions)continue;
        if(node.opcode==='arcade_callFunction'&&literal(node,'NAME',target)===null)for(const fn of functions.values())fn.unknownEntry=true;
        if(node.opcode==='arcade_createCallable'){
            const fn=functions.get(literal(node,'NAME',target));if(fn)fn.unknownEntry=true;
        }
        if(node.opcode==='arcade_declareCallable'){
            let owners;try{owners=JSON.parse(literal(node,'METADATA',target)).plan.owners;}catch{}
            if(!Array.isArray(owners))for(const fn of functions.values())fn.unknownEntry=true;
            else for(const owner of owners){const fn=functions.get(owner?.procedure);if(fn)fn.unknownEntry=true;}
        }
    }
    const fieldSdkOriginal=privatePrefixSdkProfile();
    let eventCopyPrefixUsed=false,eventCopyPrefixExpired=false,fieldPrefixUsed=false;
    const eventCopyPrefixCurrent=()=>{
        if(!eventCopyPrefixUsed)return true;
        if(!eventCopyPrefixExpired)try{if(!privatePrefixAmbientCurrent()||fieldPrefixUsed&&
            (!fieldSdkOriginal||!fieldSdkOriginal.current()))eventCopyPrefixExpired=true;}
        catch(_){eventCopyPrefixExpired=true;}
        return !eventCopyPrefixExpired;
    };
    let inertStorePrefixUsed=false,inertStorePrefixExpired=false;
    const inertStorePrefixCurrent=()=>{
        if(!inertStorePrefixUsed)return true;
        if(!inertStorePrefixExpired)try{if(!privatePrefixAmbientCurrent())inertStorePrefixExpired=true;}
        catch(_){inertStorePrefixExpired=true;}
        return !inertStorePrefixExpired;
    };
    let literalPrefixUsed=false,literalPrefixExpired=false;
    const literalPrefixCurrent=()=>{
        if(!literalPrefixUsed)return true;
        if(literalPrefixExpired)return false;
        try{if(!privatePrefixAmbientCurrent())literalPrefixExpired=true;}
        catch(error){literalPrefixExpired=true;throw error;}
        return !literalPrefixExpired;
    };
    // A local's explicit null reset may be dead before its first read. This is
    // proved from the current linear body, never a declaration/type exemption.
    const deadReset=(destination,writer)=>{
        if(writer.node.opcode!=='arcade_setLocal'||writer.value?.node?.opcode!=='arrays_specialValue'||!['null','undefined'].includes(literal(writer.value.node,'KIND',writer.target)))return false;
        // Plain-object frames can acquire an inherited setter/nonwritable
        // property through a prototype write. The old adjacent-reset proof
        // has no pointwise prototype-state model, so retain its reset when
        // such a writer could affect this frame.
        if(records.some(r=>literal(r.node,'NAME',r.target)==='__proto__'&&
            (r.scope===writer.scope&&r.node.opcode==='arcade_setLocal'||r.target===writer.target&&r.node.opcode==='arcade_setCaptured')))return false;
        const pure=new Set(['arcade_getLocal','data_variable','math_number','text','arrays_specialValue','arrays_referenceValues','arrays_createReference']);
        const safe=(node,path=new Set())=>{if(!node)return true;if(path.has(node)||!pure.has(node.opcode)||binding(writer.target,node)===destination)return false;const next=new Set([...path,node]);return Object.values(node.inputs||{}).every(slot=>typeof slot[1]!=='string'||safe(block(writer.target,slot[1]),next));};
        // Separate from the legacy read-only palette: adding arithmetic there
        // would also admit stored/local operands and their coercion effects.
        // Only this exact literal addition tree can cross an intervening write.
        const literalAddition=statement=>{
            if(!isProjectJsonSnapshot(project)||!literalPrefixCurrent()||!privatePrefixAmbientCurrent())return false;
            let budget=128;const active=new Set();
            const exact=(object,names)=>!!object&&watcherOwnKeys(object).length===names.length&&names.every(k=>prefixHasOwn(object,k));
            const primitive=value=>(typeof value==='string'||typeof value==='number')&&watcherFinite(watcherNumber(value));
            const numericRaw=value=>watcherIsArray(value)&&value.length===2&&[4,5,6,7,8].includes(value[0])&&primitive(value[1]);
            const numeric=(node,parent,shadow)=>{
                if(--budget<0||!node||active.has(node)||invalid.has(node)||owners.get(node)!==writer.scope||
                    node.parent!==parent||node.shadow!==shadow||node.topLevel!==false||node.next!==null||node.mutation!=null)return false;
                const id=watcherOwnKeys(writer.target.blocks).find(key=>writer.target.blocks[key]===node);
                if(!id)return false;active.add(node);
                let ok=false;
                if(['math_number','math_whole_number','math_positive_number','math_integer','math_angle'].includes(node.opcode)){
                    const row=node.fields?.NUM;
                    ok=shadow&&exact(node.inputs,[])&&exact(node.fields,['NUM'])&&watcherIsArray(row)&&
                        (row.length===1||row.length===2&&row[1]===null)&&primitive(row[0]);
                }else if(node.opcode==='operator_add')ok=!shadow&&exact(node.inputs,['NUM1','NUM2'])&&exact(node.fields,[])&&
                    ['NUM1','NUM2'].every(name=>socket(node.inputs[name],id));
                active.delete(node);return ok;
            };
            const socket=(slot,parent)=>{
                if(--budget<0||!watcherIsArray(slot)||![1,2,3].includes(slot[0])||slot.length!==(slot[0]===3?3:2))return false;
                const value=slot[1];
                if(slot[0]===3&&!numericRaw(slot[2]))return false;
                return watcherIsArray(value)?slot[0]===1&&numericRaw(value):typeof value==='string'&&
                    prefixHasOwn(writer.target.blocks,value)&&numeric(writer.target.blocks[value],parent,slot[0]===1);
            };
            const root=child(statement,'VALUE',writer.target),id=watcherOwnKeys(writer.target.blocks).find(key=>writer.target.blocks[key]===statement);
            return !!id&&root?.opcode==='operator_add'&&socket(statement.inputs?.VALUE,id);
        };
        const frameName=node=>{
            const slot=node.inputs?.NAME;if(!watcherIsArray(slot)||slot.length!==2||slot[0]!==1)return null;
            const v=slot[1];
            if(watcherIsArray(v))return v.length===2&&v[0]===10&&typeof v[1]==='string'?v[1]:null;
            const text=typeof v==='string'&&block(writer.target,v),row=text?.fields?.TEXT;
            return text&&owners.get(text)===writer.scope&&!invalid.has(text)&&text.opcode==='text'&&text.shadow===true&&
                text.topLevel===false&&!text.next&&text.mutation==null&&
                text.parent===watcherOwnKeys(writer.target.blocks).find(key=>writer.target.blocks[key]===node)&&
                !watcherOwnKeys(text.inputs||{}).length&&watcherOwnKeys(text.fields||{}).length===1&&
                watcherIsArray(row)&&(row.length===1||row.length===2&&row[1]===null)&&typeof row[0]==='string'?row[0]:null;
        };
        const ownFrameWrite=node=>{
            if(!node||invalid.has(node)||owners.get(node)!==writer.scope||writer.scope.invalid||writer.scope.unknownEntry||
                node.opcode!=='arcade_setLocal'||node.shadow!==false||node.topLevel!==false||node.mutation!=null||
                watcherOwnKeys(node.fields||{}).length||watcherOwnKeys(node.inputs||{}).length!==2||
                !prefixHasOwn(node.inputs,'NAME')||!prefixHasOwn(node.inputs,'VALUE')||prefixGetPrototype(Object.prototype)!==null)return false;
            const name=frameName(node),inherited=typeof name==='string'&&watcherOwnDescriptor(Object.prototype,name);
            return typeof name==='string'&&name!=='__proto__'&&(!inherited||prefixHasOwn(inherited,'value')&&inherited.writable===true);
        };
        // A hoisted reset may also precede closed suspending SDK statements.
        // A frame local is private (closedEffects excludes captures), so such a
        // statement reads it only through its own argument subtree; an abort
        // or error leaves the reset unread. This grants no value or effect fact.
        const resetName=frameName(writer.node),effectInputs={control_wait:['DURATION'],arcade_splash:['TITLE','SUBTITLE'],arcade_playSound:['SOUND','UNTIL_DONE']};
        const closedOperands=new Set(['math_number','math_whole_number','math_positive_number','math_integer','math_angle','text','data_variable',
            'arcade_getLocal','arrays_valueBinary','arrays_valueCompare','arrays_valueUnary','arrays_valueTruthy','arrays_specialValue',
            'operator_add','operator_subtract','operator_multiply','operator_divide','operator_mod','operator_equals','operator_lt','operator_gt',
            'operator_not','arcade_soundMelody']);
        const closedOperand=(node,budget={n:256})=>{
            if(--budget.n<0||!node||invalid.has(node)||owners.get(node)!==writer.scope||!closedOperands.has(node.opcode)||node.next||node.mutation!=null)return false;
            if(node.opcode==='arcade_getLocal'&&(typeof frameName(node)!=='string'||frameName(node)===resetName))return false;
            return Object.values(node.inputs||{}).every(slot=>watcherIsArray(slot)&&[1,2,3].includes(slot[0])&&slot.slice(1).every(v=>
                watcherIsArray(v)?v[0]!==12||v.length===3:typeof v==='string'&&closedOperand(block(writer.target,v),budget)));
        };
        const closedEffect=node=>!!node&&prefixHasOwn(effectInputs,node.opcode)&&!invalid.has(node)&&owners.get(node)===writer.scope&&
            node.shadow===false&&node.mutation==null&&exactKeys(node,effectInputs[node.opcode])&&!watcherOwnKeys(node.fields||{}).length&&
            Object.values(node.inputs).every(slot=>watcherIsArray(slot)&&[1,2,3].includes(slot[0])&&slot.slice(1).every(v=>
                watcherIsArray(v)?v[0]!==12||v.length===3:typeof v==='string'&&closedOperand(block(writer.target,v))));
        let id=writer.node.next,usesLiteral=false;const seen=new Set(),prefix=[writer.node];
        while(id&&!seen.has(id)){
            seen.add(id);const node=block(writer.target,id);
            // An ordinary zero-argument callee runs in its own fresh frame.
            const frameCall=!!node&&node.opcode==='procedures_call'&&!invalid.has(node)&&owners.get(node)===writer.scope&&node.shadow===false&&
                exactKeys(node,[])&&!watcherOwnKeys(node.fields||{}).length&&calls.some(c=>c.node===node&&c.fn&&!c.fn.invalid&&!c.fn.params.length);
            // A global write with a closed operand cannot reach a frame local.
            const globalWrite=!!node&&node.opcode==='data_setvariableto'&&!invalid.has(node)&&owners.get(node)===writer.scope&&node.shadow===false&&
                node.mutation==null&&exactKeys(node,['VALUE'],['VARIABLE'])&&watcherIsArray(node.inputs.VALUE)&&[1,2,3].includes(node.inputs.VALUE[0])&&
                node.inputs.VALUE.slice(1).every(v=>watcherIsArray(v)?v[0]!==12||v.length===3:typeof v==='string'&&closedOperand(block(writer.target,v)));
            if(typeof resetName==='string'&&(frameCall||globalWrite||closedEffect(node))){id=node.next;continue;}
            if(!node||node.opcode!=='arcade_setLocal')return false;
            if(!safe(child(node,'VALUE',writer.target))){if(!literalAddition(node))return false;usesLiteral=true;}
            prefix.push(node);
            if(localCell(writer.scope,literal(node,'NAME',writer.target))===destination){
                if(usesLiteral){
                    if(!isProjectJsonSnapshot(project)||!prefix.every(ownFrameWrite)||
                        localCell(writer.scope,frameName(writer.node))!==destination||localCell(writer.scope,frameName(node))!==destination||
                        !literalPrefixCurrent()||!privatePrefixAmbientCurrent())return false;
                    literalPrefixUsed=true;
                }
                return true;
            }
            id=node.next;
        }
        return false;
    };
    // This is a closed-project effect proof, not another value/type producer.
    // The bundled procedure primitive creates a fresh params object even for
    // zero arguments. A prefix with no call/registration/capture cannot have
    // published that object into a handler's {values,key} capture storage.
    // In that prefix palette redraw publishes device state, never params;
    // requestRedraw only sets a flag. The builtin device-pane listener only
    // updates its revision. Privileged external JS inspecting runtime threads
    // is outside this closed project boundary (see the compatibility notes).
    // Arrays resolves through the builtin route to the adopted implementation;
    // a saved gallery URL is checked only for consistency, never as authority.
    const effectMetadata=()=>JSON.stringify(['extensions','extensionURLs','monitors'].map(key=>[Object.hasOwn(project,key),project[key]]));
    const originalEffects=effectMetadata();let extendedResetUsed=false,privatePrefixUsed=false,privatePrefixExpired=false;
    const privatePrefixCurrent=()=>{
        if(!privatePrefixUsed)return true;
        if(!privatePrefixExpired&&!privatePrefixAmbientCurrent())privatePrefixExpired=true;
        return !privatePrefixExpired;
    };
    const closedEffects=()=>{
        if(!Array.isArray(project.extensions)||new Set(project.extensions).size!==project.extensions.length||
            !project.extensions.includes('arcade')||!project.extensions.includes('arrays')||
            project.extensions.some(id=>!['arcade','arrays'].includes(id)))return false;
        // SB3 infers owners from every physical opcode, including orphans and
        // monitor blocks; its declared extensions list is not an inventory.
        // Match getExtensionIdForOpcode's prefix/core rules as a refusal check,
        // never as a producer or effect certificate for an individual block.
        const core=new Set(['argument','colour','control','data','event','looks','math','motion','operator','procedures','sensing','sound']);
        const inferred=new Set();
        const ownerAllowed=opcode=>{
            if(typeof opcode!=='string')return false;
            const index=opcode.indexOf('_');if(index<0)return opcode==='text';
            const prefix=opcode.substring(0,index).replace(/[^\w-]/g,'-');
            if(core.has(prefix))return true;
            if(!['arcade','arrays'].includes(prefix))return false;
            inferred.add(prefix);return true;
        };
        for(const target of targets){
            // Native variable and block dictionaries are ordinary objects;
            // inherited input-cache IDs cannot identify the intended row.
            if(Object.hasOwn(target.variables||{},'__proto__'))return false;
            for(const [id,n]of Object.entries(target.blocks||{})){
                if(Object.hasOwn(Object.prototype,id)||!ownerAllowed(n?.opcode))return false;
                if(n.opcode==='procedures_call'){
                    let ids;try{ids=JSON.parse(n.mutation?.argumentids);}catch{return false;}
                    if(typeof n.mutation?.proccode!=='string'||!n.mutation.proccode||!Array.isArray(ids)||
                        ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length||
                        Object.keys(n.inputs||{}).length!==ids.length||ids.some(id=>!Object.hasOwn(n.inputs||{},id))||Object.keys(n.fields||{}).length)return false;
                }
            }
        }
        if(Object.hasOwn(project,'monitors')){
            if(!Array.isArray(project.monitors)||project.monitors.some(n=>!ownerAllowed(n?.opcode)))return false;
        }
        if(project.extensions.some(id=>!inferred.has(id))||[...inferred].some(id=>!project.extensions.includes(id)))return false;
        const urls=project.extensionURLs;
        if(urls!=null&&(typeof urls!=='object'||Array.isArray(urls)||Object.entries(urls).some(([id,url])=>
            id!=='arrays'||url!=='https://crispstrobe.github.io/extensions/CrispStrobe/arrays.js')))return false;
        // These routes can carry an independently supplied owner/entry. They
        // are not in the first-order builtin frame boundary proved here.
        return !records.some(({node,scope})=>scope.invalid||invalid.has(node)||
            /^(arcade_(?:.*Callable|.*Captured|.*Object|.*Class|startParallel|pushScene|popScene)|procedures_callreturn)/.test(node.opcode));
    };
    // One operand-effect rule serves both local-reset and callee-summary
    // proofs. This grants no Image/Array/value or artwork-validity fact. The
    // callers retain their closedEffects/frame/alias/completion obligations.
    // Primitive literal codecs prevent hidden candidate reads or coercions.
    const closedFrameImageEffect=(target,node,scope)=>{
        if(!node||node.opcode!=='arcade_frameImage'||invalid.has(node)||owners.get(node)!==scope||
            node.mutation!=null||!exactKeys(node,['KEY','INDEX','TEMPLATE','START','COUNT']))return false;
        const primitive=(name,tags,field,opcode)=>{
            const value=input(node,name,target);
            if(value.raw&&value.raw.length===2&&tags.includes(value.raw[0]))return value.raw[1];
            const leaf=value.node;
            return leaf&&!invalid.has(leaf)&&owners.get(leaf)===scope&&leaf.shadow===true&&leaf.opcode===opcode&&
                !leaf.next&&leaf.mutation==null&&exactKeys(leaf,[],[field])&&Object.keys(leaf.fields||{}).length===1?
                (Array.isArray(leaf.fields[field])&&[1,2].includes(leaf.fields[field].length)&&
                    (leaf.fields[field].length===1||leaf.fields[field][1]===null)?leaf.fields[field][0]:null):null;
        };
        if(!['KEY','TEMPLATE'].every(name=>typeof primitive(name,[10],'TEXT','text')==='string'))return false;
        return ['INDEX','START','COUNT'].every(name=>{
            const value=primitive(name,[4,5,6,7,8],'NUM','math_number');
            return (typeof value==='number'||typeof value==='string')&&Number.isFinite(Number(value));
        });
    };
    let frameResetUsed=false,frameResetExpired=false;
    const overwrittenPrivateReset=(destination,writer)=>{
        if(!privatePrefixAmbientCurrent())return false;
        let traversedFrameEffect=false;
        const {target,node,scope}=writer,reset=writer.value?.node;
        const shape=(n,inputs,fields=[])=>!!n&&!invalid.has(n)&&owners.get(n)===scope&&n.mutation==null&&
            Object.keys(n.inputs||{}).length===inputs.length&&inputs.every(key=>Object.hasOwn(n.inputs||{},key))&&
            Object.keys(n.fields||{}).length===fields.length&&fields.every(key=>Object.hasOwn(n.fields||{},key));
        const special=n=>shape(n,[],['KIND'])&&Array.isArray(n.fields.KIND)&&n.fields.KIND.length===2&&
            n.fields.KIND[1]===null&&['null','undefined'].includes(n.fields.KIND[0]);
        const localWriteKey=key=>{
            if(typeof key!=='string'||key==='__proto__'||prefixGetPrototype(Object.prototype)!==null)return false;
            const inherited=watcherOwnDescriptor(Object.prototype,key);
            // A fresh ordinary params object's assignment shadows writable
            // inherited DATA. Accessors and nonwritable data establish no own
            // cell. The full prefix still rejects any frame-prototype write.
            return !inherited||prefixHasOwn(inherited,'value')&&inherited.writable===true;
        };
        // Native procedure-definition/parameter caches are plain objects and
        // consult inherited entries before scanning declarations. Those names
        // cannot establish this graph's actual invocation/frame identity.
        if(!scope.proc||Object.hasOwn(Object.prototype,scope.proc)||scope.invalid||scope.unknownEntry||scope.params.length||destination.formal||
            node.opcode!=='arcade_setLocal'||!special(reset)||!shape(node,['NAME','VALUE'])||
            !closedEffects()||!scope.callers.length)return false;
        // Native lookup scans every physical definition/prototype, including
        // orphans not represented by the connected top-level scope map.
        const all=Object.values(target.blocks||{});
        const ordinaryDefinition=entry=>{
            if(!entry||entry.target!==target||!entry.proc||Object.hasOwn(Object.prototype,entry.proc)||
                entry.invalid||entry.unknownEntry||entry.params.length||entry.ids.length)return false;
            const root=entry.root,prototype=child(root,'custom_block',target);
            if(root.opcode!=='procedures_definition'||owners.get(root)!==entry||invalid.has(root)||
                root.mutation!=null||Object.keys(root.inputs||{}).length!==1||!Object.hasOwn(root.inputs||{},'custom_block')||
                Object.keys(root.fields||{}).length||!prototype||Object.keys(prototype.inputs||{}).length||
                Object.keys(prototype.fields||{}).length)return false;
            const definitions=all.filter(n=>n.opcode==='procedures_definition'&&child(n,'custom_block',target)?.mutation?.proccode===entry.proc);
            const prototypes=all.filter(n=>n.opcode==='procedures_prototype'&&n.mutation?.proccode===entry.proc);
            return definitions.length===1&&definitions[0]===root&&prototypes.length===1&&prototypes[0]===prototype;
        };
        if(!ordinaryDefinition(scope))return false;
        const name=literal(node,'NAME',target),origin=captures.local(captures.scopeOf(node),name);
        // Native params are plain objects, not Maps: this inherited setter
        // changes the prototype instead of establishing an own lexical cell.
        if(!localWriteKey(name))return false;
        if(!origin||!captures.proof(origin)||localCell(scope,name)!==destination)return false;
        // Each ordinary call initializes its own fresh params object. Prove
        // every actual caller through an acyclic chain of direct zero-argument
        // ordinary calls ending at source-start; names and nesting depth carry
        // no authority. Earlier caller effects precede this frame allocation.
        const entryProof=new Map();
        const entryFromSource=entry=>{
            if(entryProof.has(entry))return entryProof.get(entry);
            if(!ordinaryDefinition(entry)||!entry.callers.length)return false;
            // Provisional false also refuses recursive caller cycles. Memoize
            // completed entries so a shared caller DAG is not expanded again.
            entryProof.set(entry,false);
            const proved=entry.callers.every(call=>{
                const caller=call.scope;
                if(call.target!==target||call.fn!==entry||!caller||caller.invalid||caller.unknownEntry||
                    call.node.opcode!=='procedures_call'||!call.args||call.args.length||
                    call.node.mutation?.proccode!==entry.proc||call.node.mutation?.warp!=='false')return false;
                let at=caller.root.next;const visited=new Set();
                while(at&&block(target,at)!==call.node){
                    if(visited.has(at))return false;visited.add(at);
                    const prior=block(target,at);
                    if(!prior||invalid.has(prior)||owners.get(prior)!==caller)return false;
                    at=prior.next;
                }
                if(!at)return false;
                if(caller.root.opcode==='arcade_whenSourceStarts')return owners.get(caller.root)===caller&&
                    caller.root.mutation==null&&!Object.keys(caller.root.inputs||{}).length&&!Object.keys(caller.root.fields||{}).length;
                return entryFromSource(caller);
            });
            entryProof.set(entry,proved);return proved;
        };
        if(!entryFromSource(scope))return false;
        // A literal ordinary identity callee gets its own frame and can only
        // return the supplied value. No statement, capture, registration,
        // alternate entry or prototype-selected definition can publish this
        // caller's private params. This is an effect rule, not a value proof.
        const identityArgument=call=>{
            const entry=calls.find(record=>record.node===call),fn=entry?.fn;
            if(!entry||entry.scope!==scope||entry.target!==target||!entry.args||entry.args.length!==1||
                !fn||fn.invalid||fn.unknownEntry||fn.target!==target||fn.params.length!==1||fn.ids.length!==1||
                prefixHasOwn(Object.prototype,fn.params[0])||Object.hasOwn(Object.prototype,fn.proc))return null;
            const root=fn.root,prototype=child(root,'custom_block',target);
            let returned=block(target,root.next);
            if(returned?.opcode==='arcade_declareParameterConstraint'){
                const expected={PROCEDURE:fn.proc,PARAMETER:fn.params[0],TYPE:'Any'};
                if(returned.mutation!=null||invalid.has(returned)||owners.get(returned)!==fn||
                    !exactKeys(returned,[],Object.keys(expected))||Object.keys(returned.fields||{}).length!==3||
                    !Object.entries(expected).every(([key,value])=>Array.isArray(returned.fields[key])&&
                        returned.fields[key].length===2&&returned.fields[key][0]===value&&returned.fields[key][1]===null))return null;
                // The actual fixed Any declaration only validates this callee's
                // existing formal; it neither converts the value nor captures
                // the caller frame. Other constraints/bodies remain unproved.
                returned=block(target,returned.next);
            }
            if(root.opcode!=='procedures_definition'||invalid.has(root)||owners.get(root)!==fn||root.mutation!=null||
                !exactKeys(root,['custom_block'])||!prototype||
                all.filter(n=>n.opcode==='procedures_definition'&&child(n,'custom_block',target)?.mutation?.proccode===fn.proc).length!==1||
                all.filter(n=>n.opcode==='procedures_prototype'&&n.mutation?.proccode===fn.proc).length!==1||
                !returned||returned.opcode!=='arcade_returnValue'||returned.next||returned.mutation!=null||
                invalid.has(returned)||owners.get(returned)!==fn||!exactKeys(returned,['VALUE']))return null;
            const value=child(returned,'VALUE',target);
            if(!value||value.opcode!=='arcade_getLocal'||value.next||value.mutation!=null||
                invalid.has(value)||owners.get(value)!==fn||!exactKeys(value,['NAME'])||
                literal(value,'NAME',target)!==fn.params[0]||binding(target,value)!==localCell(fn,fn.params[0]))return null;
            return entry.args[0];
        };
        const locals=new Map(),globals=new Map(),published=new Set(),unproved=Symbol('unknown');
        // Identity tokens denote this invocation's actual independent fresh
        // empty heap bodies. Global publication permanently removes mutation
        // credit even if the current name later points somewhere else.
        const scalar=(value,path=new Set())=>{
            if(!value)return unproved;
            if(value.raw){const r=value.raw;if(r.length!==2)return unproved;
                if(r[0]===10&&typeof r[1]==='string')return {kind:'scalar',value:r[1]};
                if([4,5,6,7,8].includes(r[0])&&typeof r[1]==='string'&&Number.isFinite(Number(r[1])))return {kind:'number',value:Number(r[1])};
                return unproved;}
            if(value.cell)return value.cell===destination?unproved:globals.get(value.cell)||{kind:'stored'};
            const n=value.node;if(!n||path.has(n)||invalid.has(n)||owners.get(n)!==scope)return unproved;
            const next=new Set([...path,n]),operand=k=>scalar(input(n,k,target),next);
            if(n.opcode==='arcade_getLocal'&&shape(n,['NAME'])){
                const key=literal(n,'NAME',target),c=localCell(scope,key);
                // Only an earlier actual own write enters locals. Never read
                // the inherited value merely because its descriptor is safe
                // to shadow on a later assignment.
                return !localWriteKey(key)||c===destination?unproved:locals.get(c)||unproved;
            }
            if(n.opcode==='data_variable'&&shape(n,[],['VARIABLE'])){
                const c=binding(target,n);return c===destination?unproved:globals.get(c)||{kind:'stored'};
            }
            if(special(n))return {kind:'scalar'};
            if(n.opcode==='arrays_createReference'&&shape(n,['VALUES'])&&literal(n,'VALUES',target)==='[]')return {kind:'array',site:n};
            if(n.opcode==='operator_add'&&shape(n,['NUM1','NUM2'])||n.opcode==='arrays_valueBinary'&&shape(n,['LEFT','RIGHT'],['OP'])&&['+','%'].includes(literal(n,'OP',target))){
                const a=operand(n.opcode==='operator_add'?'NUM1':'LEFT'),b=operand(n.opcode==='operator_add'?'NUM2':'RIGHT');
                if(a!==unproved&&b!==unproved&&a.kind==='number'&&b.kind==='number'){
                    const v=literal(n,'OP',target)==='%'?a.value%b.value:a.value+b.value;return Number.isFinite(v)?{kind:'number',value:v}:unproved;
                }
                if(n.opcode==='operator_add')return unproved;
            }
            if(n.opcode==='operator_round'&&shape(n,['NUM'])){const v=operand('NUM');return v!==unproved&&v.kind==='number'?{kind:'number',value:Math.round(v.value)}:unproved;}
            // No String/Number coercion of an arbitrary receiver or index. The
            // adopted heap lookup/read and private image clone do not invoke
            // managed callbacks; malformed receivers can fault but cannot
            // expose this private frame. No Array/Image fact escapes here.
            if(n.opcode==='arrays_referenceItem'&&shape(n,['ARRAY','INDEX'])){
                const a=operand('ARRAY'),i=operand('INDEX');return a!==unproved&&i!==unproved&&i.kind==='number'?{kind:'stored'}:unproved;
            }
            if(closedFrameImageEffect(target,n,scope)){traversedFrameEffect=true;return {kind:'stored'};}
            if(n.opcode==='arcade_cloneImage'&&shape(n,['IMAGE'])){
                const image=operand('IMAGE');return image===unproved?unproved:{kind:image.kind==='image'?'image':'stored'};
            }
            if(n.opcode==='arcade_createImage'&&shape(n,['WIDTH','HEIGHT'])){
                const dimensions=['WIDTH','HEIGHT'].map(operand);
                return dimensions.every(v=>v!==unproved&&v.kind==='number'&&Number.isInteger(v.value)&&v.value>=0&&v.value<=2000)?{kind:'image'}:unproved;
            }
            if(n.opcode==='arcade_callFunction'&&shape(n,['NAME','ARGS'])){
                const argument=identityArgument(n);return argument?scalar(argument,next):unproved;
            }
            // Only actual closed primitive/Image inputs may cross these
            // builtin coercions. Opaque stored values and Arrays receive no
            // coercion exemption. The result is deliberately NOT Number.
            const coercible=v=>v!==unproved&&['number','scalar','image'].includes(v.kind);
            const operation=sourceValueOperation(n);
            if(operation){
                if(!shape(n,operation.inputs,['OP']))return unproved;
                const values=operation.inputs.map(operand);
                return values.every(coercible)?{kind:'stored'}:unproved;
            }
            if(n.opcode==='arrays_valueBinary'&&shape(n,['LEFT','RIGHT'],['OP'])&&
                ['+','-','*','/','%','**','&','|','^','<<','>>','>>>'].includes(literal(n,'OP',target)))
                return ['LEFT','RIGHT'].map(operand).every(coercible)?{kind:'stored'}:unproved;
            if(n.opcode==='arrays_valueUnary'&&shape(n,['VALUE'],['OP'])&&['+','-','~','!'].includes(literal(n,'OP',target)))
                return coercible(operand('VALUE'))?{kind:'stored'}:unproved;
            if(n.opcode==='arrays_valueCompare'&&shape(n,['LEFT','RIGHT'],['OP'])){
                const op=literal(n,'OP',target),values=['LEFT','RIGHT'].map(operand);
                if(['===','!=='].includes(op)&&values.every(v=>coercible(v)||v!==unproved&&v.kind==='array'))return {kind:'stored'};
                return ['==','!=','<','<=','>','>='].includes(op)&&values.every(coercible)?{kind:'stored'}:unproved;
            }
            if(n.opcode==='arrays_referenceIndexOf'&&shape(n,['ARRAY','VALUE','INDEX'])){
                const array=operand('ARRAY'),value=operand('VALUE'),index=operand('INDEX');
                return array!==unproved&&array.kind==='array'&&coercible(value)&&index!==unproved&&index.kind==='number'&&
                    Number.isSafeInteger(index.value)?{kind:'stored'}:unproved;
            }
            return unproved;
        };
        let at=scope.root.next,seenReset=false;const seen=new Set();
        while(at&&!seen.has(at)){
            seen.add(at);const current=block(target,at);
            if(!current||invalid.has(current)||owners.get(current)!==scope)return false;
            if(current.opcode==='arcade_setLocal'&&shape(current,['NAME','VALUE'])){
                const key=literal(current,'NAME',target),c=localCell(scope,key);if(!localWriteKey(key)||!c||c.formal)return false;
                if(current===node){seenReset=true;locals.set(c,{kind:'scalar'});}
                else {const v=scalar(input(current,'VALUE',target));if(v===unproved)return false;
                    if(c===destination){
                        // Repeated canonical resets do not read the cell or
                        // publish its frame. Keep proving the whole prefix,
                        // including earlier resets before this writer; only a
                        // real later Array overwrite completes this proof.
                        if(!special(input(current,'VALUE',target)?.node)){
                            if(seenReset&&v.kind==='array'){extendedResetUsed=true;privatePrefixUsed=true;if(traversedFrameEffect)frameResetUsed=true;return true;}
                            return false;
                        }
                    }
                    locals.set(c,v);}
            }else if(current.opcode==='arcade_setPalette'&&shape(current,['DATA'])&&/^[0-9a-fA-F]{96}$/.test(literal(current,'DATA',target)||'')){
                // Qualified render/state event effects preserved; prefix has
                // not retained params in ANY callback owner (not just this key).
            }else if(current.opcode==='arcade_mutateImage'&&literal(current,'OP',target)==='fill'&&
                (shape(current,['IMAGE','OP','COLOR','TO'])||shape(current,['IMAGE','COLOR','TO'],['OP'])&&
                    Array.isArray(current.fields.OP)&&current.fields.OP.length===2&&current.fields.OP[1]===null)){
                const receiver=scalar(input(current,'IMAGE',target)),values=['COLOR','TO'].map(key=>scalar(input(current,key,target)));
                if(receiver===unproved||!values.every(v=>v!==unproved&&v.kind==='number'&&Number.isInteger(v.value)&&v.value>=-2147483648&&v.value<=2147483647))return false;
                // The builtin fill only changes pixels and requests redraw;
                // it cannot retain this still-private procedure params object.
            }else if(current.opcode==='data_setvariableto'&&shape(current,['VALUE'],['VARIABLE'])){
                const field=current.fields.VARIABLE,owner=targets.find(t=>Object.hasOwn(t.variables||{},field?.[1])),row=owner?.variables?.[field?.[1]];
                if(!Array.isArray(row)||row.length!==2||row[0]!==field?.[0]||!globalCell(target,field?.[1]))return false;
                const v=scalar(input(current,'VALUE',target));if(v===unproved)return false;if(v.kind==='array')published.add(v);
                globals.set(globalCell(target,field[1]),v);
            }else if(current.opcode==='arrays_mutateReference'&&shape(current,['ARRAY','OP','INDEX','VALUE'])&&literal(current,'OP',target)==='push'){
                const receiver=scalar(input(current,'ARRAY',target)),index=scalar(input(current,'INDEX',target)),value=scalar(input(current,'VALUE',target));
                if(receiver===unproved||receiver.kind!=='array'||published.has(receiver)||index===unproved||index.kind!=='number'||index.value!==0||value===unproved)return false;
                // A value may not publish another independent body whose later
                // mutation could be observed through this Array's aliases.
                if(value.kind==='array')published.add(value);
            }else return false;
            at=current.next;
        }
        return false;
    };
    const nativeFrameReset=createArrayNativeFrameReset({project,targets,scopes,records,calls,owners,invalid,block,child,input,
        literal,binding,globalCell,localCell,captures,closedEffects});
    const sourceStartReset=createArraySourceStartResetEffects({project,targets,scopes,records,calls,owners,invalid,block,child,input,
        literal,binding,globalCell,localCell,closedEffects,closedFrameImageEffect});
    for(const destination of cells.values())destination.writers=destination.writers.filter(writer=>
        !deadReset(destination,writer)&&!overwrittenPrivateReset(destination,writer)&&!nativeFrameReset.discount(destination,writer)&&!sourceStartReset.discount(destination,writer));
    // Orphan writes and dynamic local names cannot disappear from all-writer proof.
    for(const target of targets)for(const node of Object.values(target.blocks||{})){
        if(!owners.has(node)&&['data_setvariableto','data_changevariableby'].includes(node.opcode)){const c=globalCell(target,node.fields?.VARIABLE?.[1]);if(c)(c.directBad=true,c.types.add(bad));}
        if(['arcade_setLocal','arcade_setCaptured'].includes(node.opcode)&&literal(node,'NAME',target)===null){const owner=owners.get(node);for(const c of cells.values())if(localCell.maps.get(owner)&&[...localCell.maps.get(owner).values()].includes(c.key))(c.directBad=true,c.types.add(bad));}
    }
    const singleArray=types=>types.size>0&&[...types].every(type=>type&&typeof type==='object'&&type.array===true);
    const token=(node,target,items,minLength=items.length)=>{if(!tokens.has(node))tokens.set(node,{array:true,node,target,items,minLength,elements:new Set(),sources:new Set(items)});return tokens.get(node);};
    const jsonArray=(array,node,target,origin=null)=>{
        const allocation=token(node,target,array.map(value=>Array.isArray(value)?{jsonArray:value,identity:{}}:{raw:[typeof value==='string'?10:4,String(value)]}),array.length);
        if(origin)allocation.origin=origin;
        allocation.exactSlots=true;
        for(const value of allocation.items)if(value.jsonArray)value.origin=allocation;
        return allocation;
    };
    // A declaration reset (set to undefined/null) cannot reach an occurrence
    // when its overwrite of the same cell definitely executed between them:
    // - a global reset and overwrite on the top-level chain of the once-only
    //   source-start script, with the occurrence later in that script;
    // - a local reset immediately followed by its definite overwrite.
    // The overwrite value must not read the cell. Every other writer and every
    // other occurrence keeps the full writer set.
    const resetValue=n=>n?.opcode==='arrays_specialValue'&&exactKeys(n,[],['KIND'])&&Array.isArray(n.fields?.KIND)&&n.fields.KIND.length===2&&n.fields.KIND[1]===null&&['undefined','null'].includes(n.fields.KIND[0]);
    const readsCell=(target,node,c,seen=new Set())=>{
        if(!node||seen.has(node))return false;seen.add(node);if(binding(target,node)===c)return true;
        for(const [name,slot]of Object.entries(node.inputs||{})){if(name.startsWith('SUBSTACK'))continue;
            for(const raw of [slot?.[1],slot?.[2]]){if(Array.isArray(raw)&&raw[0]===12&&globalCell(target,raw[2])===c)return true;
                if(typeof raw==='string'&&readsCell(target,block(target,raw),c,seen))return true;}}
        return false;
    };
    // Any procedure, method, object or callable invocation (or a malformed
    // shadow) inside a reporter tree.
    const conditionCalls=(target,node,seen=new Set())=>{if(!node||seen.has(node))return false;seen.add(node);
        if(['arcade_callFunction','procedures_call','arcade_callObjectMethod','arcade_createObject','arcade_callCallable'].includes(node.opcode))return true;
        // A malformed shadow (non-primitive field value) is not a certified reporter.
        if(node.shadow&&Object.values(node.fields||{}).some(field=>!Array.isArray(field)||!['string','number'].includes(typeof field[0])))return true;
        return Object.entries(node.inputs||{}).some(([name,slot])=>!name.startsWith('SUBSTACK')&&typeof slot?.[1]==='string'&&conditionCalls(target,block(target,slot[1]),seen));};
    const topChain=(scope,node)=>{const seen=new Set();let id=scope.root?.next;while(id&&!seen.has(id)){seen.add(id);const n=block(scope.target,id);if(n===node)return true;id=n?.next;}return false;};
    let resetFlowReady=false,spriteDataReady=false,sourceDependency=null;
    const observeSourceDependency=c=>{
        const dependency=sourceDependency;if(!dependency||!c||dependency.seen.has(c))return;
        dependency.seen.add(c);
        if(c.global&&c.types.has(bad))for(const type of c.types)
            if(type&&typeof type==='object'&&type.array){dependency.mixed=true;dependency.globals.add(c);break;}
        // Cached unions and initialization short circuits must not conceal
        // the actual indexed direct-alias writer dependency behind a local.
        for(let i=0;i<c.writers.length;i++){
            const value=c.writers[i].value;
            if(value)observeSourceDependency(value.cell||(value.node&&binding(value.target,value.node)));
        }
    };
    // A side-effect-free primitive literal expression (no cell read, no call):
    // like a reset, its value is unobservable once definitely overwritten.
    const inertLiteral=(target,n,seen=new Set())=>{
        if(!n||seen.has(n)||invalid.has(n))return false;seen.add(n);
        if(['math_number','math_whole_number','math_positive_number','math_integer','text'].includes(n.opcode))return n.shadow===true&&!Object.keys(n.inputs||{}).length;
        if(!['operator_add','operator_subtract','operator_multiply'].includes(n.opcode)||!exactKeys(n,['NUM1','NUM2']))return false;
        return ['NUM1','NUM2'].every(name=>{const slot=n.inputs[name];if(!Array.isArray(slot))return false;if(Array.isArray(slot[1]))return [4,5,6,7,8,10].includes(slot[1][0]);return inertLiteral(target,block(target,slot[1]),seen);});
    };
    // Reading the fixed event slot and storing it in a different private local
    // neither reads this reset cell nor calls/yields to authored code. This is
    // an effect fact only: no Sprite, Array or initialization fact is issued.
    const inertEventCopy=(node,c,scope)=>{
        if(!isProjectJsonSnapshot(project)||!eventCopyPrefixCurrent()||!privatePrefixAmbientCurrent()||
            !node||invalid.has(node)||owners.get(node)!==scope||scope.invalid||scope.unknownEntry||
            node.opcode!=='arcade_setLocal'||node.shadow!==false||node.topLevel!==false||node.mutation!=null||
            !exactKeys(node,['NAME','VALUE'])||watcherOwnKeys(node.fields||{}).length)return false;
        const slot=node.inputs.NAME,name=literal(node,'NAME',scope.target);
        if(!watcherIsArray(slot)||slot.length!==2||slot[0]!==1||!watcherIsArray(slot[1])||
            slot[1].length!==2||slot[1][0]!==10||typeof name!=='string'||name==='__proto__'||
            localCell(scope,name)===c)return false;
        const inherited=watcherOwnDescriptor(Object.prototype,name);
        if(inherited&&(!prefixHasOwn(inherited,'value')||inherited.writable!==true))return false;
        const valueSlot=node.inputs.VALUE;
        // A primitive literal stored into the same private frame has no cell
        // reads, coercion or calls. It cannot expose the reset destination.
        if(watcherIsArray(valueSlot)&&valueSlot.length===2&&valueSlot[0]===1&&watcherIsArray(valueSlot[1])&&
            valueSlot[1].length===2&&([4,5,6,7,8].includes(valueSlot[1][0])&&
                ['string','number'].includes(typeof valueSlot[1][1])&&watcherFinite(watcherNumber(valueSlot[1][1]))||
                valueSlot[1][0]===10&&typeof valueSlot[1][1]==='string')){
            if(records.some(r=>(r.scope===scope&&r.node.opcode==='arcade_setLocal'||r.target===scope.target&&r.node.opcode==='arcade_setCaptured')&&
                (typeof literal(r.node,'NAME',r.target)!=='string'||literal(r.node,'NAME',r.target)==='__proto__')))return false;
            return true;
        }
        if(!watcherIsArray(valueSlot)||![1,2,3].includes(valueSlot[0])||valueSlot.length!==(valueSlot[0]===3?3:2)||
            typeof valueSlot[1]!=='string'||valueSlot[0]===3&&!watcherIsArray(valueSlot[2]))return false;
        if(records.some(r=>(r.scope===scope&&r.node.opcode==='arcade_setLocal'||r.target===scope.target&&r.node.opcode==='arcade_setCaptured')&&
            (typeof literal(r.node,'NAME',r.target)!=='string'||literal(r.node,'NAME',r.target)==='__proto__')))return false;
        const value=child(node,'VALUE',scope.target),which=value?.fields?.WHICH;
        // Blockly also encodes an inline literal as a physical shadow block.
        // Require the exact leaf shape and primitive payload, not its label.
        if(value&&!invalid.has(value)&&owners.get(value)===scope&&value.shadow===true&&
            value.topLevel===false&&value.next==null&&value.mutation==null){
            const field=value.opcode==='text'?'TEXT':value.opcode==='math_number'?'NUM':null;
            if(field&&exactKeys(value,[],[field])){
                const item=value.fields[field];
                if(watcherIsArray(item)&&item.length===2&&item[1]===null&&
                    (field==='TEXT'?typeof item[0]==='string':
                        ['string','number'].includes(typeof item[0])&&watcherFinite(watcherNumber(item[0]))))return true;
            }
        }
        return valueSlot[0]!==1&&!!value&&!invalid.has(value)&&owners.get(value)===scope&&value.opcode==='arcade_eventSprite'&&
            value.shadow===false&&value.topLevel===false&&value.next==null&&value.mutation==null&&exactKeys(value,[],['WHICH'])&&
            watcherIsArray(which)&&which.length===2&&which[1]===null&&['first','second'].includes(which[0]);
    };
    // A reimported callback can store unrelated globals (trace/flag scalars)
    // between a local reset and its definite overwrite. Locals live in the
    // running procedure frame and any accessor procedure runs in its own
    // frame, so an exact global store whose complete value tree uses only
    // these reporters cannot read, write or capture the reset local, and
    // cannot branch, exit or register a callback. Local stores remain owned by
    // the event-copy and numeric-literal prefix rules. Effect fact only: no
    // Sprite, Array, value or initialization fact is issued.
    const inertStoreReporters=Object.freeze({__proto__:null,arcade_eventSprite:[[],['WHICH']],arrays_specialValue:[[],['KIND']],
        arrays_valueBinary:[['LEFT','RIGHT'],['OP']],arrays_valueCompare:[['LEFT','RIGHT'],['OP']],arcade_objectField:[['OBJECT','FIELD'],[]],
        arcade_spriteKindValue:[['NAME'],[]],operator_add:[['NUM1','NUM2'],[]],operator_subtract:[['NUM1','NUM2'],[]],
        operator_multiply:[['NUM1','NUM2'],[]],operator_divide:[['NUM1','NUM2'],[]],operator_mod:[['NUM1','NUM2'],[]]});
    const sameNames=(object,names)=>{const keys=watcherOwnKeys(object||{});return keys.length===names.length&&keys.every(key=>typeof key==='string'&&names.includes(key));};
    const inertStoreSlot=(slot,c,scope,seen)=>{
        if(!watcherIsArray(slot)||![1,2,3].includes(slot[0])||slot.length!==(slot[0]===3?3:2))return false;
        for(const raw of slot[0]===3?[slot[1],slot[2]]:[slot[1]]){
            if(typeof raw==='string'){if(!inertStoreValue(block(scope.target,raw),c,scope,seen))return false;continue;}
            if(!watcherIsArray(raw))return false;
            if([4,5,6,7,8,10].includes(raw[0])){if(raw.length!==2||typeof raw[1]!=='string'&&typeof raw[1]!=='number')return false;continue;}
            if(raw[0]===12){const g=raw.length===3&&typeof raw[2]==='string'?globalCell(scope.target,raw[2]):null;
                if(!g||g===c||targets.find(t=>Object.hasOwn(t.variables||{},raw[2]))?.variables[raw[2]]?.[0]!==raw[1])return false;continue;}
            return false;
        }
        return true;
    };
    const inertStoreValue=(node,c,scope,seen)=>{
        const shape=node&&inertStoreReporters[node.opcode];
        if(!shape||seen.has(node)||invalid.has(node)||owners.get(node)!==scope||node.shadow!==false||node.topLevel!==false||
            node.next!=null||node.mutation!=null||!sameNames(node.inputs,shape[0])||!sameNames(node.fields,shape[1]))return false;
        seen.add(node);
        for(const name of shape[1]){const field=node.fields[name];
            if(!watcherIsArray(field)||field.length!==2||typeof field[0]!=='string'||field[1]!==null)return false;}
        if(node.opcode==='arcade_eventSprite'&&!['first','second'].includes(node.fields.WHICH[0]))return false;
        if(node.opcode==='arrays_specialValue'&&!resetValue(node))return false;
        if(node.opcode==='arcade_objectField'&&typeof literal(node,'FIELD',scope.target)!=='string')return false;
        if(node.opcode==='arcade_spriteKindValue'&&typeof literal(node,'NAME',scope.target)!=='string')return false;
        return shape[0].every(name=>inertStoreSlot(node.inputs[name],c,scope,seen));
    };
    const inertGlobalStore=(node,c,scope)=>{
        if(!isProjectJsonSnapshot(project)||!inertStorePrefixCurrent()||!privatePrefixAmbientCurrent()||
            !node||invalid.has(node)||owners.get(node)!==scope||scope.invalid||scope.unknownEntry||
            node.opcode!=='data_setvariableto'||node.shadow!==false||node.topLevel!==false||node.mutation!=null||
            !sameNames(node.inputs,['VALUE'])||!sameNames(node.fields,['VARIABLE']))return false;
        const variable=node.fields.VARIABLE;
        if(!watcherIsArray(variable)||variable.length!==2||typeof variable[0]!=='string'||typeof variable[1]!=='string')return false;
        const g=globalCell(scope.target,variable[1]);
        if(!g||g===c||targets.find(t=>Object.hasOwn(t.variables||{},variable[1]))?.variables[variable[1]]?.[0]!==variable[0])return false;
        return inertStoreSlot(node.inputs.VALUE,c,scope,new Set([node]));
    };
    // A closed primitive global write cannot call a coercion hook or publish
    // this invocation's params object. Prove a preservation invariant over
    // initial storage and EVERY physical writer, never the Array/type solver's
    // discounted writers. Cyclic global reads are safe only because every
    // initial value is primitive and every write preserves that invariant.
    // This private effect check supplies no value or initialization facts.
    const privatePrefixProject=scope=>{
        if(!isProjectJsonSnapshot(project)||!eventCopyPrefixCurrent()||!privatePrefixAmbientCurrent()||invalidGlobalBinding||
            !scope||scope.invalid||scope.unknownEntry)return false;
        if(!watcherIsArray(project.extensions)||project.extensions.some(id=>!['arcade','arrays'].includes(id))||
            new Set(project.extensions).size!==project.extensions.length)return false;
        if(prefixHasOwn(project,'extensionURLs')?project.extensionURLs!=null&&Object.entries(project.extensionURLs).some(([id,url])=>
            id!=='arrays'||url!=='https://crispstrobe.github.io/extensions/CrispStrobe/arrays.js'):'extensionURLs' in project)return false;
        if(prefixHasOwn(project,'monitors')?!flagsReadOnlyMonitors():'monitors' in project)return false;
        const core=new Set(['argument','colour','control','data','event','looks','math','motion','operator','procedures','sensing','sound']);
        for(const target of targets)for(const n of Object.values(target.blocks||{})){
            if(typeof n.opcode!=='string')return false;
            const at=n.opcode.indexOf('_');if(at<0){if(n.opcode!=='text')return false;continue;}
            const owner=n.opcode.substring(0,at).replace(/[^\w-]/g,'-');
            if(!core.has(owner)&&!['arcade','arrays'].includes(owner))return false;
        }
        if(records.some(r=>(r.scope===scope&&r.node.opcode==='arcade_setLocal'||r.target===scope.target&&r.node.opcode==='arcade_setCaptured')&&
            (typeof literal(r.node,'NAME',r.target)!=='string'||literal(r.node,'NAME',r.target)==='__proto__')))return false;
        return true;
    };
    const inertPrimitiveGlobalWrite=(node,c,scope)=>{
        if(!privatePrefixProject(scope)||!node||invalid.has(node)||owners.get(node)!==scope||
            node.opcode!=='data_setvariableto'||node.shadow!==false||node.topLevel!==false||node.mutation!=null||
            !exactKeys(node,['VALUE'],['VARIABLE'])||watcherOwnKeys(node.fields||{}).length!==1)return false;
        let budget=1024;const checking=new Set(),complete=new Set();
        const primitive=value=>value===null||['string','boolean'].includes(typeof value)||typeof value==='number'&&watcherFinite(value);
        const shape=(n,s,inputs,fields=[])=>!!n&&!invalid.has(n)&&owners.get(n)===s&&!s.invalid&&!s.unknownEntry&&
            n.next==null&&n.mutation==null&&exactKeys(n,inputs,fields)&&watcherOwnKeys(n.fields||{}).length===fields.length;
        const scalar=(value,s,path=new Set())=>{
            if(--budget<0||!value)return false;
            if(value.cell)return value.cell!==c&&primitiveGlobal(value.cell);
            if(value.raw){const r=value.raw;return watcherIsArray(r)&&r.length===2&&
                (r[0]===10&&typeof r[1]==='string'||[4,5,6,7,8].includes(r[0])&&
                    ['string','number'].includes(typeof r[1])&&watcherFinite(watcherNumber(r[1])));}
            const n=value.node;if(!n||path.has(n)||invalid.has(n)||owners.get(n)!==s)return false;
            const next=new Set([...path,n]);
            if(n.opcode==='data_variable'&&shape(n,s,[],['VARIABLE']))return primitiveGlobal(binding(s.target,n));
            if(['text','math_number','math_whole_number','math_integer','math_positive_number'].includes(n.opcode)){
                const field=n.opcode==='text'?'TEXT':'NUM',row=n.fields?.[field];
                return n.shadow===true&&shape(n,s,[],[field])&&watcherIsArray(row)&&row.length===2&&row[1]===null&&
                    (field==='TEXT'?typeof row[0]==='string':['string','number'].includes(typeof row[0])&&watcherFinite(watcherNumber(row[0])));
            }
            const source=sourceValueOperation(n),inputs=n.opcode==='operator_add'?['NUM1','NUM2']:
                (n.opcode==='arrays_valueBinary'&&literal(n,'OP',s.target)==='+'||source?.op==='+')?['LEFT','RIGHT']:null;
            return !!inputs&&shape(n,s,inputs,n.opcode==='operator_add'?[]:['OP'])&&
                inputs.every(name=>scalar(input(n,name,s.target),s,next));
        };
        const primitiveGlobal=cell=>{
            if(--budget<0||!cell||cell===c||!ordinarySummaryGlobal(cell)||cell.directBad)return false;
            if(complete.has(cell)||checking.has(cell))return true;
            let declaration=null;
            for(const [target,map]of globalCell.maps)for(const [id,key]of map)if(cells.get(key)===cell)declaration=target.variables[id];
            if(!declaration||!primitive(declaration[1]))return false;
            checking.add(cell);
            // Include orphan, unreachable and alternate-entry writers. A
            // missing indexed owner or a non-assignment writer refuses.
            for(const target of targets)for(const n of Object.values(target.blocks||{})){
                if(!['data_setvariableto','data_changevariableby'].includes(n.opcode)||globalCell(target,n.fields?.VARIABLE?.[1])!==cell)continue;
                const s=owners.get(n);
                if(--budget<0||n.opcode!=='data_setvariableto'||!s||s.invalid||s.unknownEntry||invalid.has(n)||
                    n.shadow!==false||n.topLevel!==false||n.mutation!=null||!exactKeys(n,['VALUE'],['VARIABLE'])||watcherOwnKeys(n.fields||{}).length!==1||
                    !scalar(input(n,'VALUE',target),s))return false;
            }
            checking.delete(cell);complete.add(cell);return true;
        };
        return primitiveGlobal(globalCell(scope.target,node.fields?.VARIABLE?.[1]));
    };
    // A fixed event receiver's plain declared data slot, compared strictly to
    // a literal, cannot invoke a getter/coercion or expose the private frame.
    // Inventory every physical class, including unrelated classes and bases:
    // metadata or a cast alone never identifies the event's concrete class.
    const inertEventFieldComparison=(node,c,scope,prefix)=>{
        if(!privatePrefixProject(scope)||!fieldSdkOriginal||!fieldSdkOriginal.current()||
            !node||invalid.has(node)||owners.get(node)!==scope||node.opcode!=='data_setvariableto'||
            node.shadow!==false||node.topLevel!==false||node.mutation!=null||!exactKeys(node,['VALUE'],['VARIABLE'])||
            watcherOwnKeys(node.fields||{}).length!==1||!ordinarySummaryGlobal(globalCell(scope.target,node.fields.VARIABLE?.[1])))return false;
        const shape=(n,inputs,fields=[])=>!!n&&!invalid.has(n)&&owners.get(n)===scope&&n.next==null&&
            n.mutation==null&&exactKeys(n,inputs,fields)&&watcherOwnKeys(n.fields||{}).length===fields.length;
        const fixed=(n,name)=>{
            const slot=n.inputs?.[name];return watcherIsArray(slot)&&slot.length===2&&slot[0]===1&&watcherIsArray(slot[1])&&
                slot[1].length===2&&slot[1][0]===10&&typeof slot[1][1]==='string'?slot[1][1]:null;
        };
        const root=scope.root;
        if(root.opcode!=='arcade_whenRegisteredCreated'||root.mutation!=null||!exactKeys(root,['TOKEN'])||
            watcherOwnKeys(root.fields||{}).length||fixed(root,'TOKEN')===null)return false;
        const comparison=child(node,'VALUE',scope.target),op=comparison?.fields?.OP;
        if(!shape(comparison,['LEFT','RIGHT'],['OP'])||comparison.opcode!=='arrays_valueCompare'||
            !watcherIsArray(op)||op.length!==2||op[1]!==null||!['===','!=='].includes(op[0]))return false;
        const field=child(comparison,'LEFT',scope.target),name=field&&fixed(field,'FIELD');
        if(!shape(field,['OBJECT','FIELD'])||field.opcode!=='arcade_objectField'||typeof name!=='string'||
            !/^[A-Za-z_]\w*$/.test(name)||prefixHasOwn(Object.prototype,name)||fieldSdkOriginal.members.has(name))return false;
        const event=n=>shape(n,[],['WHICH'])&&n.opcode==='arcade_eventSprite'&&n.shadow===false&&
            watcherIsArray(n.fields.WHICH)&&n.fields.WHICH.length===2&&n.fields.WHICH[1]===null&&n.fields.WHICH[0]==='first';
        const receiver=child(field,'OBJECT',scope.target);
        if(!event(receiver)){
            if(!shape(receiver,['NAME'])||receiver.opcode!=='arcade_getLocal')return false;
            const local=localCell(scope,fixed(receiver,'NAME'));if(!local||local===c)return false;
            let last=null;
            for(const prior of prefix)if(prior.opcode==='arcade_setLocal'&&localCell(scope,fixed(prior,'NAME'))===local)last=prior;
            if(!last||!inertEventCopy(last,c,scope)||!event(child(last,'VALUE',scope.target)))return false;
        }
        let budget=128;
        const primitive=(value,path=new Set())=>{
            if(--budget<0||!value)return false;
            if(value.raw){const raw=value.raw;return watcherIsArray(raw)&&raw.length===2&&
                (raw[0]===10&&typeof raw[1]==='string'||[4,5,6,7,8].includes(raw[0])&&
                    ['number','string'].includes(typeof raw[1])&&watcherFinite(watcherNumber(raw[1])));}
            const n=value.node;if(!n||path.has(n))return false;
            if(['text','math_number'].includes(n.opcode)){
                const key=n.opcode==='text'?'TEXT':'NUM',row=n.fields?.[key];
                return shape(n,[],[key])&&n.shadow===true&&watcherIsArray(row)&&row.length===2&&row[1]===null&&
                    (key==='TEXT'?typeof row[0]==='string':['string','number'].includes(typeof row[0])&&watcherFinite(watcherNumber(row[0])));
            }
            const next=new Set([...path,n]);return n.opcode==='operator_add'&&shape(n,['NUM1','NUM2'])&&
                ['NUM1','NUM2'].every(key=>primitive(input(n,key,scope.target),next));
        };
        if(!primitive(input(comparison,'RIGHT',scope.target)))return false;
        const classes=new Map();let found=false;
        const identifier=value=>typeof value==='string'&&/^[A-Za-z_]\w*$/.test(value)&&!prefixHasOwn(Object.prototype,value);
        const parse=(n,key)=>{const text=fixed(n,key);if(text===null)return null;try{const rows=privatePrefixParse(text);return watcherIsArray(rows)?rows:null;}catch{return null;}};
        for(const target of targets)for(const declaration of Object.values(target.blocks||{})){
            if(!['arcade_declareClass','arcade_declareSubclass'].includes(declaration.opcode))continue;
            const owner=owners.get(declaration),subclass=declaration.opcode==='arcade_declareSubclass';
            const inputs=['NAME','FIELDS','INITIALIZER','CONSTRUCTOR','PARAMETERS','METHODS',...(subclass?['BASE']:[])];
            if(--budget<0||!owner||owner.invalid||owner.unknownEntry||invalid.has(declaration)||
                owner.root.opcode!=='arcade_whenSourceStarts'||declaration.shadow!==false||declaration.topLevel!==false||
                declaration.mutation!=null||!exactKeys(declaration,inputs)||watcherOwnKeys(declaration.fields||{}).length||
                inputs.some(key=>fixed(declaration,key)===null))return false;
            const className=fixed(declaration,'NAME'),base=subclass?fixed(declaration,'BASE'):null;
            const fields=parse(declaration,'FIELDS'),methods=parse(declaration,'METHODS'),parameters=parse(declaration,'PARAMETERS');
            if(!identifier(className)||classes.has(className)||fieldSdkOriginal.names.has(className)||className==='__bwOwnedSDKSprite'||
                subclass&&!identifier(base)||!fields||!methods||!parameters)return false;
            const memberNames=new Set();
            for(const row of fields){
                if(--budget<0||!row||typeof row!=='object'||watcherIsArray(row)||!prefixHasOwn(row,'name')||!identifier(row.name)||
                    memberNames.has(row.name)||!prefixHasOwn(row,'type')||typeof row.type!=='string'||
                    !prefixHasOwn(row,'readonly')||typeof row.readonly!=='boolean'||
                    watcherOwnKeys(row).some(key=>!['name','type','readonly','visibility','initializer','parameterProperty','getter','setter','valueKind','callableSignature','sdkType'].includes(key)))return false;
                memberNames.add(row.name);
                if(row.name===name){
                    if(['getter','setter','valueKind','callableSignature','sdkType'].some(key=>prefixHasOwn(row,key))||
                        prefixHasOwn(row,'visibility')&&row.visibility!=='public')return false;
                    found=true;
                }
            }
            for(const row of methods){
                if(--budget<0||!row||typeof row!=='object'||watcherIsArray(row)||!prefixHasOwn(row,'name')||
                    !identifier(row.name)||memberNames.has(row.name)||row.name===name)return false;
                memberNames.add(row.name);
            }
            classes.set(className,{base,memberNames});
        }
        if(!found)return false;
        for(const [className,cls]of classes){
            const seen=new Set([className]);let base=cls.base;
            while(base&&!fieldSdkOriginal.names.has(base)){
                if(seen.has(base)||!classes.has(base))return false;seen.add(base);base=classes.get(base).base;
            }
        }
        return true;
    };
    const killedReset=(c,w,at)=>{
        if(!resetFlowReady||!(resetValue(w.value?.node)||!c.global&&w.value?.node&&inertLiteral(w.target,w.value.node))||invalid.has(w.node)||w.scope.invalid)return false;
        const scope=owners.get(at);if(!scope||w.scope!==scope||!scope.executedBefore)return false;
        const st=statementOf(at),before=st&&scope.executedBefore.get(st);if(!before)return false;
        const valid=o=>o!==w&&o.scope===scope&&o.value&&!resetValue(o.value.node)&&!invalid.has(o.node)&&before.has(o.node)&&
            !(o.value.cell===c)&&!(o.value.node&&readsCell(o.target,o.value.node,c));
        if(c.global){
            if(scope.root.opcode!=='arcade_whenSourceStarts'||!onceNode(w.node)||!topChain(scope,w.node))return false;
            return c.writers.some(o=>valid(o)&&topChain(scope,o.node)&&!!scope.executedBefore.get(o.node)?.has(w.node));
        }
        // A local reset must reach its definite overwrite without exposure:
        // a direct writer, or an if/else whose both branches write the cell
        // before any exit. Only a fixed event copy to another local, an inert
        // global store, a closed primitive global write or an inert event
        // field comparison may cross this frontier; procedure calls, captures,
        // control flow and reads of the reset cell retain the reset.
        let next=block(w.target,w.node.next),fieldUsed=false;const skipped=new Set();let copied=false,stored=false;
        while(next&&before.has(next)&&!skipped.has(next)){
            // The closed private rules are tried first so their admissions
            // carry their own permanent expiry facts; the general inert
            // global store remains the fallback for other exact stores.
            if(inertEventCopy(next,c,scope))copied=true;
            else if(inertPrimitiveGlobalWrite(next,c,scope))copied=true;
            else if(inertEventFieldComparison(next,c,scope,skipped))fieldUsed=true;
            else if(inertGlobalStore(next,c,scope))stored=true;else break;
            skipped.add(next);next=block(w.target,next.next);
        }
        if(!next||!before.has(next))return false;
        const consume=()=>{if(copied||fieldUsed)eventCopyPrefixUsed=true;if(stored)inertStorePrefixUsed=true;if(fieldUsed)fieldPrefixUsed=true;};
        if(c.writers.some(o=>valid(o)&&o.node===next)){consume();return true;}
        const branchAssigns=id=>{const seen=new Set();for(let n=block(w.target,id);n&&!seen.has(n);n=block(w.target,n.next)){seen.add(n);
            if(c.writers.some(o=>o.node===n&&o.scope===scope&&o.value&&!resetValue(o.value.node)&&!invalid.has(n)&&!(o.value.cell===c)&&!(o.value.node&&readsCell(o.target,o.value.node,c))))return true;
            return false;}return false;};
        const condition=next.inputs?.CONDITION?.[1],literalCondition=Array.isArray(condition)&&condition.length===2&&
            ([4,5,6,7,8].includes(condition[0])&&['string','number'].includes(typeof condition[1])&&watcherFinite(watcherNumber(condition[1]))||condition[0]===10&&typeof condition[1]==='string');
        // A non-literal condition qualifies when it is a reporter tree that
        // neither reads the reset cell nor calls anything: it cannot observe
        // or change the reset before exactly one branch writes it first.
        const conditionNode=typeof condition==='string'?block(w.target,condition):null;
        const inertCondition=!!conditionNode&&!invalid.has(conditionNode)&&!readsCell(w.target,conditionNode,c)&&!conditionCalls(w.target,conditionNode);
        const taken=next.opcode==='control_if_else'&&next.mutation==null&&exactKeys(next,['CONDITION','SUBSTACK','SUBSTACK2'])?staticCondition(w.target,next):null;
        const result=next.opcode==='control_if_else'&&!invalid.has(next)&&((literalCondition||inertCondition)&&branchAssigns(next.inputs?.SUBSTACK?.[1])&&branchAssigns(next.inputs?.SUBSTACK2?.[1])||
            // A constant comparison runs exactly one branch; that branch's first statement must write.
            taken===true&&branchAssigns(next.inputs?.SUBSTACK?.[1])||taken===false&&branchAssigns(next.inputs?.SUBSTACK2?.[1]));
        if(result)consume();
        return result;
    };
    // `x := v` immediately followed by `if not truthy(x) then x := e`, with the
    // occurrence after that if: a possibly absent (falsy) v cannot reach it.
    const falsyGuarded=(c,w,at)=>{
        if(!resetFlowReady||invalid.has(w.node)||w.scope.invalid||!w.value)return false;
        const scope=owners.get(at);if(!scope||w.scope!==scope||!scope.executedBefore)return false;
        const st=statementOf(at),before=st&&scope.executedBefore.get(st),next=block(w.target,w.node.next);
        if(!before||!next||next.opcode!=='control_if'||invalid.has(next)||!before.has(next)||!exactKeys(next,['CONDITION','SUBSTACK']))return false;
        const not=block(w.target,next.inputs.CONDITION?.[1]),truthy=not?.opcode==='operator_not'&&exactKeys(not,['OPERAND'])&&block(w.target,not.inputs.OPERAND?.[1]);
        const read=truthy?.opcode==='arrays_valueTruthy'&&exactKeys(truthy,['VALUE'])&&block(w.target,truthy.inputs.VALUE?.[1]);
        if(!read||binding(w.target,read)!==c)return false;
        const first=block(w.target,next.inputs.SUBSTACK?.[1]);
        return c.writers.some(o=>o!==w&&o.node===first&&o.scope===scope&&o.value&&!resetValue(o.value.node)&&!invalid.has(o.node)&&
            !(o.value.cell===c)&&!(o.value.node&&readsCell(o.target,o.value.node,c)));
    };
    // The occurrence is in the FIRST statement of the then-branch of
    // `if truthy(x) then ... [else ...]` on
    // this very cell, and that statement calls nothing: no code runs between
    // the test and the read, so an absent (falsy) value of x cannot reach it.
    // A null/undefined reset writer and the possibly-absent type drop out;
    // every other writer still needs its own proof.
    const truthyGuarded=(c,at)=>{
        if(!resetFlowReady||!c||!at||c.directBad)return false;
        const scope=owners.get(at);if(!scope||scope.invalid)return false;
        const st=statementOf(at);if(!st||invalid.has(st))return false;
        const target=scope.target,parent=block(target,st.parent);
        if(!parent||!['control_if','control_if_else'].includes(parent.opcode)||parent.mutation!=null||invalid.has(parent)||owners.get(parent)!==scope||
            !exactKeys(parent,parent.opcode==='control_if'?['CONDITION','SUBSTACK']:['CONDITION','SUBSTACK','SUBSTACK2']))return false;
        if(target.blocks[parent.inputs.SUBSTACK?.[1]]!==st)return false;
        const truthy=block(target,parent.inputs.CONDITION?.[1]);
        if(truthy?.opcode!=='arrays_valueTruthy'||truthy.mutation!=null||invalid.has(truthy)||!exactKeys(truthy,['VALUE']))return false;
        const read=input(truthy,'VALUE',target),cell=read?.cell||(read?.node&&binding(target,read.node));
        if(cell!==c||conditionCalls(target,st))return false;
        return true;
    };
    const computingCells=new Set();
    const cellTypesAt=(c,at)=>{
        observeSourceDependency(c);
        if(!c||c.directBad||!at||computingCells.has(c))return new Set(c?c.types:[bad]);
        const truthy=truthyGuarded(c,at);
        const live=c.writers.filter(w=>!killedReset(c,w,at)&&!(truthy&&resetValue(w.value?.node))),guarded=new Set(live.filter(w=>truthy||falsyGuarded(c,w,at)));
        if(live.length===c.writers.length&&!guarded.size)return new Set(c.types);
        computingCells.add(c);
        try{
            const out=new Set();if(!live.length)out.add(bad);
            for(const w of live)for(const type of w.value&&!invalid.has(w.node)&&!w.scope.invalid?readInput(w.value):[bad])if(!(guarded.has(w)&&type===missing))out.add(type);
            return out;
        }finally{computingCells.delete(c);}
    };
    // Only appends (push) and reads may touch a positional Array: no shrink,
    // set, insertion or unshift, and no named-array write route.
    // A later statement of the same once-only scope cannot have moved a slot yet.
    const afterAt=(node,at)=>{const scope=owners.get(at),later=statementOf(node),statement=statementOf(at);
        return !!scope&&owners.get(node)===scope&&!!later&&!!statement&&later!==statement&&onceNode(later)&&onceNode(statement)&&!!scope.executedBefore.get(later)?.has(statement);};
    // A named registry write after the occurrence in the same script cannot
    // precede it when that script re-created the named Array earlier in the
    // same activation: a restarted script re-creates it before reading again.
    const afterInActivation=(node,at,creation)=>{const scope=owners.get(at),later=statementOf(node),statement=statementOf(at);
        return !!scope&&!!creation&&owners.get(node)===scope&&owners.get(creation)===scope&&!!later&&!!statement&&later!==statement&&
            !!scope.executedBefore.get(later)?.has(statement)&&!!scope.executedBefore.get(statement)?.has(creation);};
    const copySlots=new Set();
    // Exact slots of ONE allocation at an occurrence: its exact base slots
    // (literal/JSON items, or a proved whole-copy) followed by the VALUE of
    // each literal-expansion push that definitely executed before the
    // occurrence, in order.
    // Every other mutation whose receiver may be this allocation (aliases
    // included, since receivers are typed by allocation) must come after it;
    // a push to a receiver that is not exactly this allocation refuses.
    const beforeAt=(node,at)=>afterAt(at,node);
    // Slot pushes are only a staged literal list, proved structurally (never
    // by its name): a non-global, non-formal local written once with a fresh
    // empty list; every read of it anywhere (captures included) is either the
    // receiver of a push of an inert constant or of another staged list, or
    // its single store; it escapes nowhere else. A user push keeps the
    // all-element-writer policy.
    const INERT=new Set(['operator_add','arrays_valueBinary','arrays_valueUnary','arrays_valueCompare','arrays_specialValue']);
    const stagedCells=new Map(),stagedPending=new Set();
    const inertValue=(target,slot,path=new Set())=>{
        if(!Array.isArray(slot))return false;const raw=slot[1];
        if(Array.isArray(raw))return [4,10].includes(raw[0]);
        const n=block(target,raw);if(!n||path.has(n)||invalid.has(n))return false;path.add(n);
        if(n.opcode==='arcade_getLocal'){const c=binding(target,n);return !!c&&stagedCell(c);}
        if(!INERT.has(n.opcode))return false;
        return Object.values(n.inputs||{}).every(s=>inertValue(target,s,path));
    };
    const readsOf=c=>{const out=[];for(const t of targets)for(const [id,n] of Object.entries(t.blocks||{}))if(['arcade_getLocal','arcade_getCaptured'].includes(n?.opcode)&&binding(t,n)===c)out.push({target:t,id,node:n});return out;};
    const stagedCell=c=>{
        if(stagedCells.has(c))return stagedCells.get(c);if(stagedPending.has(c))return false;stagedPending.add(c);
        let ok=false;
        try{
            const w=c.writers;
            if(c.global||c.formal||c.directBad||w.length!==1||w[0].argument||w[0].node?.opcode!=='arcade_setLocal')return false;
            const v=w[0].value?.node;
            if(!v||v.opcode!=='arrays_createReference'||!exactKeys(v,['VALUES'])||!Array.isArray(v.inputs.VALUES?.[1])||literal(v,'VALUES',w[0].target)!=='[]')return false;
            let stores=0;
            for(const {target,id,node} of readsOf(c)){
                if(node.opcode!=='arcade_getLocal')return false;
                const parent=block(target,node.parent);if(!parent)return false;
                const slotOf=name=>parent.inputs?.[name]?.[1]===id;
                if(parent.opcode==='arrays_mutateReference'&&exactKeys(parent,['ARRAY','OP','INDEX','VALUE'])&&literal(parent,'OP',target)==='push'&&slotOf('ARRAY')){
                    if(!inertValue(target,parent.inputs.VALUE))return false;continue;
                }
                const store=slotOf('VALUE')&&(['data_setvariableto','arcade_setLocal'].includes(parent.opcode)||
                    parent.opcode==='arrays_mutateReference'&&literal(parent,'OP',target)==='push'&&!slotOf('ARRAY'));
                if(!store||++stores>1)return false;
            }
            ok=stores===1;return ok;
        }finally{stagedPending.delete(c);stagedCells.set(c,ok);}
    };
    const literalPush=(target,node)=>{const r=input(node,'ARRAY',target)?.node;if(r?.opcode!=='arcade_getLocal')return false;const c=binding(target,r);return !!c&&stagedCell(c);};
    const slotsAt=(a,at)=>{
        if(!a||a.array!==true||!at)return null;
        const base=typeof a.copySlots==='function'?a.copySlots():a.exactSlots===true&&Array.isArray(a.items)&&a.items.length===a.minLength?a.items:null;
        // Element types alone (bad = a possible non-Array value) say nothing
        // about slots; unknown operations are census shrinks, and a named
        // Array needs its recorded named writes, all after the occurrence.
        if(!base||![...(a.shrinks||[])].every(node=>afterAt(node,at)))return null;
        // A named write that runs once before this allocation is created (same
        // once-only scope, e.g. the reset `delete` of the previous registry
        // entry) cannot touch it.
        if(['arrays_createEmpty','arrays_create1D','arrays_create2D'].includes(a.node?.opcode)&&!(Array.isArray(a.namedMutations)&&a.namedMutations.every(r=>afterAt(r.node,at)||afterAt(a.node,r.node))))return null;
        const pushes=[];
        for(const {target,node} of mutations){
            const receiver=readInput(input(node,'ARRAY',target));if(!receiver.has(a)||afterAt(node,at))continue;
            // literalPush implies a push: every read of a staged list is a push
            // receiver or its store, so no other operation can name it.
            if(!literalPush(target,node)||receiver.size!==1||!beforeAt(node,at)||!a.node||!afterAt(node,a.node))return null;
            pushes.push({target,node});
        }
        for(let i=0;i<pushes.length;i++)for(let j=i+1;j<pushes.length;j++)if(!beforeAt(pushes[i].node,pushes[j].node)&&!beforeAt(pushes[j].node,pushes[i].node))return null;
        pushes.sort((x,y)=>beforeAt(x.node,y.node)?-1:1);
        return [...base,...pushes.map(({target,node})=>input(node,'VALUE',target))];
    };
    const positionalStable=(a,at)=>[...(a.shrinks||[])].every(node=>afterAt(node,at))&&
        (!a.elements.has(bad)||Array.isArray(a.namedMutations)&&a.namedMutations.every(r=>afterAt(r.node,at)||afterInActivation(r.node,at,a.node)))&&
        mutations.every(({target,node})=>!readInput(input(node,'ARRAY',target)).has(a)||node.opcode==='arrays_mutateReference'&&literal(node,'OP',target)==='push'||afterAt(node,at));
    // A procedure whose every return is a read of one formal that only its
    // actual call arguments write returns, at each call, that call's argument.
    const passthroughIndex=fn=>{
        if(!fn||fn.invalid||!fn.returns?.length||!Array.isArray(fn.params))return -1;
        let index=-1;
        for(const value of fn.returns){
            const n=value?.node;if(!n||!['arcade_getLocal'].includes(n.opcode)&&!n.opcode?.startsWith('argument_reporter_'))return -1;
            const c=binding(value.target,n);if(!c||c.formal!==fn||c.writers.some(w=>!w.argument))return -1;
            const name=n.opcode==='arcade_getLocal'?literal(n,'NAME',value.target):n.fields?.VALUE?.[0],i=fn.params.indexOf(name);
            if(i<0||index>=0&&index!==i)return -1;index=i;
        }
        return index;
    };
    // An occurrence inside `if truthy(t)` whose statement is immediately
    // preceded by `t := compare(literal, literal)` that is false never runs
    // (the `false && e` lowering). Only literal Number operands qualify.
    const literalCompare=(target,n)=>{
        if(n?.opcode!=='arrays_valueCompare'||!exactKeys(n,['LEFT','RIGHT'],['OP']))return null;
        const l=literalNumber(target,n,'LEFT'),r=literalNumber(target,n,'RIGHT'),op=literal(n,'OP',target);
        if(l===null||r===null||Number.isNaN(l)||Number.isNaN(r))return null;
        return {'<':l<r,'>':l>r,'<=':l<=r,'>=':l>=r,'===':l===r,'!==':l!==r,'==':l==r,'!=':l!=r}[op]??null;
    };
    const deadOccurrence=(target,node)=>{
        const seen=new Set();let current=node;
        while(current&&!seen.has(current)){seen.add(current);
            const parent=block(target,current.parent);if(!parent)return false;
            const id=Object.keys(target.blocks).find(key=>target.blocks[key]===current);
            if(parent.opcode==='control_if'&&parent.inputs?.SUBSTACK?.[1]===id&&exactKeys(parent,['CONDITION','SUBSTACK'])){
                const truthy=block(target,parent.inputs.CONDITION?.[1]),read=truthy?.opcode==='arrays_valueTruthy'&&exactKeys(truthy,['VALUE'])&&block(target,truthy.inputs.VALUE?.[1]);
                const prevId=Object.keys(target.blocks).find(key=>target.blocks[key]?.next===Object.keys(target.blocks).find(k=>target.blocks[k]===parent));
                const prev=prevId&&block(target,prevId);
                if(read?.opcode==='arcade_getLocal'&&prev?.opcode==='arcade_setLocal'&&exactKeys(prev,['NAME','VALUE'])&&
                    literal(prev,'NAME',target)===literal(read,'NAME',target)&&owners.get(prev)===owners.get(parent)&&
                    literalCompare(target,block(target,prev.inputs.VALUE?.[1]))===false)return true;
            }
            current=parent;
        }
        return false;
    };
    // An occurrence inside a procedure that no block can enter never runs, in
    // PXT or in Lite: no static caller, no unknown/implicit (managed or
    // object-dispatch) entry, and no other block names the procedure in any
    // literal (which rules out dispatch by a constructed name), and every call
    // in the project resolves to a known procedure.
    const uncalledProcedureOccurrence=node=>{
        const scope=owners.get(node);
        if(!scope?.proc||scope.invalid||scope.unknownEntry||implicitEntries.has(scope)||scope.callers.length)return false;
        // Every call in the project must resolve; an unresolved callee means the
        // procedure graph is not closed, so no procedure is proved unenterable.
        if(calls.some(call=>!call.fn))return false;
        const name=scope.proc,head=name.split(' ')[0];
        for(const t of targets)for(const other of Object.values(t.blocks||{})){
            if(other===scope.root)continue;
            if(other.mutation&&typeof other.mutation.proccode==='string'&&other.opcode!=='procedures_prototype'&&other.mutation.proccode===name)return false;
            for(const field of Object.values(other.fields||{}))if(Array.isArray(field)&&typeof field[0]==='string'&&(field[0]===name||field[0]===head||field[0].includes(head)))return false;
            for(const slot of Object.values(other.inputs||{}))for(const raw of [slot?.[1],slot?.[2]])
                if(Array.isArray(raw)&&typeof raw[1]==='string'&&(raw[1]===name||raw[1].includes(head)))return false;
        }
        return true;
    };
    const concatLengths=new Set();
    const readInput=value=>{
        if(!value)return new Set([bad]);if(value.cell)return cellTypesAt(value.cell,value.at);if(value.jsonArray)return new Set([jsonArray(value.jsonArray,value.identity,null,value.origin)]);if(value.node)return readNode(value.target,value.node);return new Set([bad]);
    };
    const literalNumber=(target,node,name)=>{const v=input(node,name,target);if(v.raw&&[4,5,6,7,8].includes(v.raw[0]))return Number(v.raw[1]);if(v.node?.shadow&&v.node.opcode==='math_number')return Number(v.node.fields?.NUM?.[0]);return null;};
    // Slice presence accepts only closed integer shadows and the exact numeric
    // `0 + shadow` wrapper emitted for source constants. This does not broaden
    // literalNumber, positional slot proofs or any general numeric producer.
    const sliceBound=(target,node,name)=>{
        const number=value=>{
            let raw;
            if(Array.isArray(value.raw)&&value.raw.length===2&&[4,5,6,7,8].includes(value.raw[0]))raw=value.raw[1];
            else {const n=value.node,row=n?.fields?.NUM;
                if(!n||invalid.has(n)||n.shadow!==true||n.opcode!=='math_number'||!exactKeys(n,[],['NUM'])||
                    Object.keys(n.fields||{}).length!==1||!Array.isArray(row)||row.length!==2||row[1]!==null)return null;
                raw=row[0];}
            if(typeof raw!=='string'&&typeof raw!=='number')return null;
            const result=Number(raw);return Number.isFinite(result)&&Number.isInteger(result)?result:null;
        };
        const value=input(node,name,target),direct=number(value);if(direct!==null)return direct;
        const n=value.node;if(!n||invalid.has(n)||n.opcode!=='operator_add'||!exactKeys(n,['NUM1','NUM2'])||
            Object.keys(n.fields||{}).length)return null;
        return number(input(n,'NUM1',target))===0?number(input(n,'NUM2',target)):null;
    };
    // A reset can be ignored for KIND facts only when a synchronous source-start
    // segment overwrites it before any observer can read that particular cell.
    // The general Array cell writer set remains unchanged.
    const fixedUndefined=node=>node?.opcode==='arrays_specialValue'&&exactKeys(node,[],['KIND'])&&Object.keys(node.fields||{}).length===1&&Array.isArray(node.fields.KIND)&&node.fields.KIND.length===2&&node.fields.KIND[0]==='undefined'&&node.fields.KIND[1]===null;
    const deadKindReset=(destination,writer)=>{
        const {target,node,scope}=writer;
        if(scope.root.opcode!=='arcade_whenSourceStarts'||node.opcode!=='data_setvariableto'||!exactKeys(node,['VALUE'],['VARIABLE'])||invalid.has(node)||
            !fixedUndefined(writer.value?.node))return false;
        const knownNumbers=new Set(),seen=new Set();
        const scalar=value=>{
            if(value?.raw)return [4,5,6,7,8].includes(value.raw[0])&&!Number.isNaN(Number(value.raw[1]))?'number':null;
            const n=value?.node;if(!n||invalid.has(n))return null;
            if(n.shadow&&n.opcode==='math_number'&&!Object.keys(n.inputs||{}).length)return !Number.isNaN(Number(n.fields?.NUM?.[0]))?'number':null;
            if(n.opcode==='arcade_createSpriteKind'&&exactKeys(n,[]))return 'number';
            // A registered kind name reads the registry's kind Number (or throws).
            if(n.opcode==='arcade_spriteKindValue'&&exactKeys(n,['NAME'])&&typeof literal(n,'NAME',target)==='string')return 'number';
            if(fixedUndefined(n))return 'undefined';
            return null;
        };
        let id=node.next;
        while(id&&!seen.has(id)){
            seen.add(id);const next=block(target,id);if(!next||invalid.has(next)||owners.get(next)!==scope)return false;
            if(next.opcode==='data_setvariableto'&&exactKeys(next,['VALUE'],['VARIABLE'])){
                const name=next.fields?.VARIABLE,id=name?.[1],declaration=targets.find(owner=>Object.hasOwn(owner.variables||{},id))?.variables[id],c=globalCell(target,id),kind=scalar(input(next,'VALUE',target));
                if(!c||declaration?.[0]!==name?.[0]||!kind)return false;
                if(c===destination)return kind==='number';
                if(kind==='number')knownNumbers.add(c);else knownNumbers.delete(c);
            }else if(next.opcode==='arcade_initializeSpriteKindLibrary'&&exactKeys(next,['LIBRARY','VERSION'])&&next.mutation==null&&
                typeof literal(next,'LIBRARY',target)==='string'&&typeof literal(next,'VERSION',target)==='string'){
                // Registers the library's kinds only; it writes no Scratch variable.
            }else if(next.opcode==='arcade_bindSpriteKind'&&exactKeys(next,['NAME','KIND'])&&typeof literal(next,'NAME',target)==='string'){
                const value=input(next,'KIND',target),c=value.cell||(value.node&&binding(target,value.node));
                if(!c||c===destination||!knownNumbers.has(c))return false;
            }else return false;
            id=next.next;
        }
        return false;
    };
    // Existing allOfKind completes with a fresh Array; its elements are not
    // issued SDK Sprite facts here. KIND still needs actual numeric producers.
    const numericKind=(value,path=new Set())=>{
        if(!value)return false;if(value.raw)return [4,5,6,7,8].includes(value.raw[0])&&!Number.isNaN(Number(value.raw[1]));
        const node=value.node,c=value.cell||(node&&binding(value.target,node));if(c){if(path.has(c)||!c.writers.length)return false;const next=new Set([...path,c]);return c.writers.every(w=>!invalid.has(w.node)&&!w.scope.invalid&&(deadKindReset(c,w)||w.value&&numericKind(w.value,next)));}
        if(!node||invalid.has(node)||path.has(node))return false;const next=new Set([...path,node]);
        if(node.shadow&&node.opcode==='math_number')return !Number.isNaN(Number(node.fields?.NUM?.[0]));
        if(node.opcode==='arcade_createSpriteKind')return exactKeys(node,[]);
        if(node.opcode==='arcade_spriteKindValue')return exactKeys(node,['NAME'])&&typeof literal(node,'NAME',value.target)==='string';
        if(sourceValueOperation(node)?.result==='Number')return true;
        if(node.opcode==='arrays_valueBinary')return ['+','-','*','/','%','**','&','|','^','<<','>>','>>>'].includes(literal(node,'OP',value.target))&&numericKind(input(node,'LEFT',value.target),next)&&numericKind(input(node,'RIGHT',value.target),next);
        // Scratch arithmetic reporters always cast their operands and return a Number.
        if(['operator_add','operator_subtract','operator_multiply','operator_divide','operator_mod'].includes(node.opcode))return exactKeys(node,['NUM1','NUM2']);
        if(node.opcode==='operator_round')return exactKeys(node,['NUM']);
        if(node.opcode==='operator_mathop')return exactKeys(node,['NUM'],['OPERATOR']);
        return false;
    };
    const namedBinding=(target,node)=>{
        if(node.opcode!=='arrays_namedReference'||!exactKeys(node,['NAME']))return null;
        const name=literal(node,'NAME',target),scope=owners.get(node),before=scope?.executedBefore.get(node);
        if(typeof name!=='string'||Object.hasOwn(Object.prototype,name)||!before)return new Set([bad]);
        const writes=records.filter(r=>['arrays_createEmpty','arrays_create1D','arrays_create2D','arrays_createZeros','arrays_range','arrays_delete'].includes(r.node.opcode));
        // A dynamic or independently executing registry writer cannot lend a
        // stable binding to this read. Copies already issued remain body aliases.
        if(writes.some(r=>literal(r.node,'NAME',r.target)===null||literal(r.node,'NAME',r.target)===name&&r.scope!==scope))return new Set([bad]);
        const ordered=[...before].filter(n=>writes.some(w=>w.node===n&&literal(n,'NAME',target)===name));const writer=ordered.at(-1);
        if(!writer||invalid.has(writer))return new Set([bad]);
        let value=[];
        if(writer.opcode!=='arrays_createEmpty'){
            if(!['arrays_create1D','arrays_create2D'].includes(writer.opcode)||!exactKeys(writer,['NAME','JSON']))return new Set([bad]);
            const json=literal(writer,'JSON',target);if(typeof json!=='string')return new Set([bad]);try{value=JSON.parse(json);}catch{value=writer.opcode==='arrays_create2D'?[[]]:[];}if(!Array.isArray(value))return new Set([bad]);
        }else if(!exactKeys(writer,['NAME']))return new Set([bad]);
        const allocation=jsonArray(value,writer,target);
        const namedMutations=records.filter(r=>r.node.opcode.startsWith('arrays_')&&r.node.inputs?.NAME&&literal(r.node,'NAME',r.target)===name&&!['arrays_namedReference','arrays_createEmpty','arrays_create1D','arrays_create2D','arrays_length','arrays_get'].includes(r.node.opcode));
        if(!Object.hasOwn(allocation,'namedMutations')&&!allocation.elements.has(bad))allocation.namedMutations=namedMutations;
        if(records.some(r=>r.node.opcode.startsWith('arrays_')&&r.node.inputs?.NAME&&literal(r.node,'NAME',r.target)===name&&!['arrays_namedReference','arrays_createEmpty','arrays_create1D','arrays_create2D','arrays_length','arrays_get'].includes(r.node.opcode)))allocation.elements.add(bad);
        return new Set([allocation]);
    };
    const factories=(target,node)=>{
        if(node.opcode!=='arrays_createReference')return null;if(!exactKeys(node,['VALUES']))return new Set([bad]);
        const items=[],seen=new Set();let edge=node.inputs.VALUES?.[1];
        while(typeof edge==='string'){
            const item=block(target,edge);if(!item||invalid.has(item)||seen.has(item))return new Set([bad]);seen.add(item);
            if(item.opcode==='text'&&item.shadow){edge=[10,item.fields?.TEXT?.[0]];break;}
            if(item.opcode!=='arrays_referenceValues'||!exactKeys(item,['VALUE','REST']))return new Set([bad]);items.push(input(item,'VALUE',target));edge=item.inputs.REST?.[1];
        }
        if(!Array.isArray(edge)||edge[0]!==10)return new Set([bad]);let tail;try{tail=JSON.parse(edge[1]);}catch{return new Set([bad]);}if(!Array.isArray(tail)||items.length&&tail.length)return new Set([bad]);
        if(items.length){const t=token(node,target,items);t.exactSlots=true;return new Set([t]);}
        return new Set([jsonArray(tail,node,target)]);
    };
    const returnsAlways=(target,id,path=new Set())=>{
        if(!id||path.has(id))return false;const n=block(target,id);if(!n)return false;const next=new Set([...path,id]);if(n.opcode==='arcade_returnValue')return true;
        if(n.opcode==='control_if_else'&&returnsAlways(target,n.inputs?.SUBSTACK?.[1],next)&&returnsAlways(target,n.inputs?.SUBSTACK2?.[1],next))return true;
        return returnsAlways(target,n.next,next);
    };
    const reading=new Set();
    function readNode(target,node){
        if(reading.has(node))return new Set([bad]);
        reading.add(node);try{return computeNode(target,node);}finally{reading.delete(node);}
    }
    // Call-site pruning of a generated lookup: when the argument for P is a
    // constant string literal and the body is exactly (parameter declarations,
    // then) `IF P ==/=== <same literal> THEN return X` and a fallback, with no
    // writer of P but call arguments, the IF is taken and the call yields X.
    // Any other shape (else branch, THEN statement other than a local store or push, other writer,
    // non-literal argument or comparison operand) returns null: no pruning.
    const constantText=value=>{
        if(!value)return null;if(Array.isArray(value.raw))return value.raw[0]===10&&typeof value.raw[1]==='string'?value.raw[1]:null;
        const n=value.node;return n?.opcode==='text'&&n.shadow&&exactKeys(n,[],['TEXT'])&&typeof n.fields?.TEXT?.[0]==='string'?n.fields.TEXT[0]:null;
    };
    // A global read at a lookup call is the constant S only when the whole
    // project has exactly one write of that variable: one top-level-reachable
    // `set G to "S"` (a literal) that definitely ran earlier in the same
    // once-only script as the call. No other block may name the variable
    // except plain reads, and no slider may control it.
    const globalConstantText=(value,at)=>{
        const c=value?.cell||(value?.node?.opcode==='data_variable'?binding(value.target,value.node):null);
        // Every global writer (set/change) names the variable in its VARIABLE
        // field, so the block scan below admits exactly one: this w.
        if(!c?.global||c.directBad||!c.writers.length)return null;
        const w=c.writers[0];
        if(w.argument||!w.node||!exactKeys(w.node,['VALUE'],['VARIABLE'])||invalid.has(w.node)||w.scope?.invalid)return null;
        // A change-by writer carries no value (null), so only a literal set passes.
        const id=w.node.fields?.VARIABLE?.[1],text=constantText(w.value);
        if(typeof id!=='string'||text===null||globalCell(w.target,id)!==c)return null;
        // Read-only watchers (default/large) cannot write; any slider or other
        // monitor mode for this variable, visible or not, refuses.
        const name=w.node.fields.VARIABLE[0];
        if(!Array.isArray(project.monitors??[])||(project.monitors||[]).some(m=>(m?.id===id||m?.params?.VARIABLE===name||String(m?.id||'').includes(id))&&!['default','large'].includes(m?.mode)))return null;
        for(const t of targets)for(const b of Object.values(t.blocks||{})){
            if(!b||b===w.node)continue;
            if(b.fields?.VARIABLE?.[1]===id&&b.opcode!=='data_variable')return null;
        }
        return afterAt(at,w.node)?text:null;
    };
    const prunedLookupReturn=callNode=>{
        const call=calls.find(c=>c.node===callNode),fn=call?.fn;
        if(!fn||fn.invalid||fn.unknownEntry||implicitEntries.has(fn)||!call.args||call.args.length!==fn.params.length)return null;
        let first=block(fn.target,fn.root.next);const skipped=new Set();
        while(first?.opcode==='arcade_declareParameterConstraint'&&!skipped.has(first)){skipped.add(first);first=block(fn.target,first.next);}
        if(first?.opcode!=='control_if'||invalid.has(first)||!exactKeys(first,['CONDITION','SUBSTACK']))return null;
        const condition=input(first,'CONDITION',fn.target).node;
        if(condition?.opcode!=='arrays_valueCompare'||!exactKeys(condition,['LEFT','RIGHT'],['OP'])||!['==','==='].includes(literal(condition,'OP',fn.target)))return null;
        const left=input(condition,'LEFT',fn.target).node,expected=constantText(input(condition,'RIGHT',fn.target));
        if(left?.opcode!=='arcade_getLocal')return null;
        const index=fn.params.indexOf(literal(left,'NAME',fn.target)),c=index>=0?binding(fn.target,left):null;
        if(!c||c!==localCell(fn,fn.params[index])||c.directBad||!c.writers.every(w=>w.argument))return null;
        // A non-literal comparison operand (null) never equals a literal argument.
        const argument=constantText(call.args[index])??globalConstantText(call.args[index],callNode);if(argument===null||argument!==expected)return null;
        // The THEN may first build a fresh local list, exactly as the re-imported
        // fresh-frames lookup does: `set local L to []`, then pushes onto such an
        // L of an inert value, a staged list, or a copy of a constant frame image.
        // No global store, call, other target or nested control may precede the
        // single return.
        const literalSlot=slot=>Array.isArray(slot?.[1])&&[4,10].includes(slot[1][0]);
        const builderValue=slot=>{
            if(inertValue(fn.target,slot))return true;
            const clone=typeof slot?.[1]==='string'?block(fn.target,slot[1]):null;
            if(clone?.opcode!=='arcade_cloneImage'||!exactKeys(clone,['IMAGE']))return false;
            const frame=input(clone,'IMAGE',fn.target).node;
            return frame?.opcode==='arcade_frameImage'&&exactKeys(frame,['KEY','INDEX','TEMPLATE','START','COUNT'])&&Object.values(frame.inputs).every(literalSlot);
        };
        let only=block(fn.target,first.inputs.SUBSTACK?.[1]);const built=new Set(),fresh=new Set();
        while(only&&!invalid.has(only)&&!built.has(only)){
            if(only.opcode==='arcade_setLocal'&&exactKeys(only,['NAME','VALUE'])){
                const name=literal(only,'NAME',fn.target),v=input(only,'VALUE',fn.target).node;
                if(typeof name!=='string'||fn.params.includes(name)||v?.opcode!=='arrays_createReference'||!exactKeys(v,['VALUES'])||!Array.isArray(v.inputs.VALUES?.[1])||literal(v,'VALUES',fn.target)!=='[]')return null;
                fresh.add(name);
            }else if(only.opcode==='arrays_mutateReference'&&exactKeys(only,['ARRAY','OP','INDEX','VALUE'])&&literal(only,'OP',fn.target)==='push'){
                const receiver=input(only,'ARRAY',fn.target).node;
                if(receiver?.opcode!=='arcade_getLocal'||!fresh.has(literal(receiver,'NAME',fn.target))||!builderValue(only.inputs.VALUE))return null;
            }else break;
            built.add(only);only=block(fn.target,only.next);
        }
        if(only?.opcode!=='arcade_returnValue'||only.next!=null||only.mutation!=null||invalid.has(only)||!exactKeys(only,['VALUE']))return null;
        return input(only,'VALUE',fn.target);
    };
    function computeNode(target,node){
        if(!node||invalid.has(node)||owners.get(node)?.invalid)return new Set([bad]);
        const c=binding(target,node);if(c)return cellTypesAt(c,node);
        const allocated=factories(target,node);if(allocated)return allocated;const named=namedBinding(target,node);if(named)return named;
        if(node.opcode==='arcade_spritesOfKind')return exactKeys(node,['KIND'])&&numericKind(input(node,'KIND',target))?new Set([token(node,target,[{raw:[10,'SDK Sprite element not an Array']}],0)]):new Set([bad]);
        if(Object.hasOwn(FRESH_SDK_ARRAYS,node.opcode))return exactKeys(node,FRESH_SDK_ARRAYS[node.opcode])?new Set([token(node,target,[{raw:[10,'SDK element not an Array']}],0)]):new Set([bad]);
        if(['arcade_animationAssetFrames','arcade_animationAssetFreshFrames'].includes(node.opcode)){
            const producer=animationProducers.resolve(target,node,{targets,monitors:project.monitors});
            return producer?new Set([token(producer.allocation,producer.shared?null:target,
                Array.from({length:producer.length},()=>({raw:[10,'SDK Image element not an Array']})),producer.length)]):new Set([bad]);
        }
        if(['arrays_referenceSlice','arrays_referenceConcat'].includes(node.opcode)){
            const left=readInput(input(node,'ARRAY',target)),right=node.opcode==='arrays_referenceConcat'?readInput(input(node,'OTHER',target)):new Set();
            if(!operationShape(node))return new Set([bad]);if(!left.size||node.opcode==='arrays_referenceConcat'&&!right.size)return new Set();
            if(!singleArray(left)||node.opcode==='arrays_referenceConcat'&&!singleArray(right))return new Set([bad]);
            const t=token(node,target,[],0);for(const a of [...left,...right]){for(const v of a.elements)t.elements.add(v);for(const source of a.sources)t.sources.add(source);}
            // A concatenation holds at least both operands' proven lengths at the
            // concat occurrence; its own result then shrinks only by its own ops.
            if(node.opcode==='arrays_referenceConcat'&&!Object.getOwnPropertyDescriptor(t,'minLength').get){
                const operand=name=>[...readInput(input(node,name,target))];
                Object.defineProperty(t,'minLength',{configurable:true,enumerable:true,get(){
                    if(concatLengths.has(t))return 0;concatLengths.add(t);
                    try{const l=operand('ARRAY'),r=operand('OTHER');if(!singleArray(new Set(l))||!singleArray(new Set(r)))return 0;
                        return Math.min(...l.map(a=>a===t?0:minimumAt(a,node)))+Math.min(...r.map(a=>a===t?0:minimumAt(a,node)));}
                    finally{concatLengths.delete(t);}}});
            }
            // Per-slot facts through a whole-copy: slice() with both bounds
            // omitted copies every slot; a.concat(b) holds a's slots then b's.
            // Each operand must be ONE allocation with exact literal slots
            // (factory/JSON literal, or such a copy) that no mutation, named
            // write or shrink can have touched before this copy executes; a
            // push is not exempt because concat needs the exact left length.
            if(!Object.getOwnPropertyDescriptor(t,'items').get){
                t.copySlots=()=>{
                    if(copySlots.has(t))return null;copySlots.add(t);
                    try{
                        if(node.opcode==='arrays_referenceSlice'){const omitted=name=>{const v=input(node,name,target);return !!v?.node&&fixedUndefined(v.node);};if(!omitted('START')||!omitted('END'))return null;}
                        const out=[];
                        for(const name of node.opcode==='arrays_referenceConcat'?['ARRAY','OTHER']:['ARRAY']){
                            const source=[...readInput(input(node,name,target))];
                            const slots=source.length===1?slotsAt(source[0],node):null;
                            if(!slots)return null;out.push(...slots);
                        }
                        return out;
                    }finally{copySlots.delete(t);}};
                Object.defineProperty(t,'items',{configurable:true,enumerable:true,get(){return t.copySlots()||[];}});
            }
            if(node.opcode==='arrays_referenceSlice'&&!Object.getOwnPropertyDescriptor(t,'minLength').get){
                Object.defineProperty(t,'minLength',{configurable:true,enumerable:true,get(){
                    if(concatLengths.has(t))return 0;concatLengths.add(t);
                    try{
                        // An exact undefined bound is the default in PXT and in
                        // the Arrays extension: START 0, END the current length.
                        const omitted=name=>{const v=input(node,name,target);return !!v?.node&&fixedUndefined(v.node);};
                        const startOmitted=omitted('START'),endOmitted=omitted('END');
                        const start=startOmitted?0:sliceBound(target,node,'START'),end=endOmitted?Infinity:sliceBound(target,node,'END');
                        // With nonnegative START, slice length is monotone in
                        // source length for either sign of END. A lower length
                        // alone cannot prove negative-START/nonnegative-END.
                        if(start===null||start<0||end===null)return 0;
                        const source=[...readInput(input(node,'ARRAY',target))];
                        if(!singleArray(new Set(source)))return 0;
                        const length=Math.max(0,Math.min(...source.map(a=>a===t?0:minimumAt(a,node))));
                        const first=Math.min(start,length),last=end<0?Math.max(length+end,0):Math.min(end,length);
                        return Math.max(last-first,0);
                    }finally{concatLengths.delete(t);}}});
            }
            return new Set([t]);
        }
        if(['arrays_referenceItem','arrays_referenceTake','arrays_referenceRandom'].includes(node.opcode)||node.opcode==='arrays_mutateReference'&&['pop','shift','removeAt'].includes(literal(node,'OP',target))){
            const receiver=readInput(input(node,'ARRAY',target));if(!operationShape(node))return new Set([bad]);if(!receiver.size)return new Set();if(!singleArray(receiver))return new Set([bad]);const result=new Set();
            for(const a of receiver){
                if(!presentAt(a,target,node)){
                    // Empty MAY facts are pending, not a proved absent body.
                    // Do not poison a cell irreversibly before formal/alias
                    // argument facts reach a dominating mutation receiver.
                    if(pendingPresence(a,node))return new Set();
                    result.add(missing);
                }
                // A fixed literal slot of a positional (JSON/literal) Array whose
                // earlier slots never move holds exactly its own item.
                const index=node.opcode==='arrays_referenceItem'?literalNumber(target,node,'INDEX'):null;
                if(index!==null&&Number.isInteger(index)&&index>=0&&Array.isArray(a.items)&&index<a.items.length&&positionalStable(a,node)){
                    for(const item of readInput(a.items[index]))result.add(item);continue;
                }
                const slots=index!==null&&Number.isInteger(index)&&index>=0?slotsAt(a,node):null;
                if(slots&&index<slots.length){for(const item of readInput(slots[index]))result.add(item);continue;}
                for(const item of a.elements)result.add(item);
            }return result;
        }
        // settings.list() always returns a fresh Array of key strings.
        if(node.opcode==='arcade_settingsRead'&&exactKeys(node,['KEY'],['TYPE'])&&literal(node,'TYPE',target)==='List')return new Set([token(node,target,[{raw:[10,'settings key not an Array']}],0)]);
        if(node.opcode==='arcade_settingsRead'){
            const w=spriteDataReady?settingsArrayWriter(target,node):null;if(!w)return new Set([bad]);
            const source=readInput(w.value);if(!source.size)return new Set();if(!singleArray(source))return new Set([bad]);
            // Each read returns a fresh detached copy of the value written by w.
            const t=token(node,target,[],0);for(const a of source)for(const e of a.elements)t.elements.add(e);
            if(!Object.getOwnPropertyDescriptor(t,'minLength').get)Object.defineProperty(t,'minLength',{configurable:true,enumerable:true,get(){
                if(concatLengths.has(t))return 0;concatLengths.add(t);try{return Math.min(...[...readInput(w.value)].map(a=>a===t?0:minimumAt(a,w.node)));}finally{concatLengths.delete(t);}}});
            return new Set([t]);
        }
        if(node.opcode==='arcade_spriteProperty'){const w=spriteDataReady?spriteDataWriter(target,node):null;return w?readInput(w.value):new Set([bad]);}
        if(node.opcode==='arcade_objectField'){const f=literal(node,'FIELD',target);return !dynamicFields&&typeof f==='string'&&exactKeys(node,['OBJECT','FIELD'])&&cells.has('field:'+f)?new Set(fieldCell(f).types):new Set([bad]);}
        if(node.opcode==='arcade_callFunction'){
            const pruned=prunedLookupReturn(node);if(pruned)return readInput(pruned);
            const call=calls.find(call=>call.node===node);if(!call?.fn||call.fn.invalid||!call.args||!returnsAlways(target,call.fn.root.next))return new Set([bad]);
            const through=passthroughIndex(call.fn);if(through>=0)return readInput(call.args[through]);
            const out=new Set();for(const value of call.fn.returns)for(const type of readInput(value))out.add(type);return out;
        }
        return new Set([bad]);
    }
    // Type tokens describe allocation sites and MAY writers, not body identity.
    // Mutation-derived presence needs an independent proof that this actual
    // allocation occurrence executes at most once in the current startup.
    // In particular neither a factory return site nor a loop callsite is a body.
    // Managed heap/label entry is not a static calls[] edge. This catalogue
    // only removes once authority: metadata can never create a producer fact.
    // Object dispatch uses the invocation target, so names poison matching
    // procedures across targets, not merely the declaration's target.
    const implicitEntries=new WeakSet();
    const managedName=name=>{
        if(typeof name!=='string'){for(const scope of scopes)if(scope.proc)implicitEntries.add(scope);return;}
        if(name)for(const scope of scopes)if(scope.proc===name)implicitEntries.add(scope);
    };
    for(const target of targets)for(const node of Object.values(target.blocks||{})){
        if(['arcade_declareClass','arcade_declareSubclass'].includes(node.opcode)){
            try{
                managedName(literal(node,'INITIALIZER',target));managedName(literal(node,'CONSTRUCTOR',target));
                const fields=JSON.parse(literal(node,'FIELDS',target)),methods=JSON.parse(literal(node,'METHODS',target));
                if(!Array.isArray(fields)||!Array.isArray(methods))throw Error('opaque managed entry');
                for(const field of fields){if(!field||typeof field!=='object')throw Error('opaque accessor');
                    if(Object.hasOwn(field,'getter')){if(typeof field.getter!=='string')throw Error('opaque getter');managedName(field.getter);}
                    if(Object.hasOwn(field,'setter')){if(!field.setter||typeof field.setter.procedure!=='string')throw Error('opaque setter');managedName(field.setter.procedure);}}
                for(const method of methods){if(!method||typeof method.procedure!=='string')throw Error('opaque method');managedName(method.procedure);}
            }catch{managedName(null);}
        }
        if(['arcade_declareCallable','arcade_createCallable','arcade_whenCallableDispatched'].includes(node.opcode))managedName(literal(node,'NAME',target));
    }
    const onceScopes=new WeakMap();
    // Closed evaluation contexts only. Repeat header reporters are reevaluated
    // by execute._ops on later entries; even TIMES/list inputs are not once.
    // Unknown headers and extra effect sockets cannot lend execution bounds.
    const onceParent=(parent,name)=>{
        if(['control_if','control_if_else'].includes(parent.opcode))return exactKeys(parent,parent.opcode==='control_if'?['CONDITION','SUBSTACK']:['CONDITION','SUBSTACK','SUBSTACK2']);
        if(parent.opcode==='data_setvariableto')return name==='VALUE'&&exactKeys(parent,['VALUE'],['VARIABLE']);
        if(['arcade_setLocal','arcade_setCaptured'].includes(parent.opcode))return name==='VALUE'&&exactKeys(parent,['NAME','VALUE']);
        if(parent.opcode==='arcade_returnValue')return name==='VALUE'&&exactKeys(parent,['VALUE']);
        if(parent.opcode==='arrays_createReference')return name==='VALUES'&&exactKeys(parent,['VALUES']);
        if(['arrays_referenceValues','arcade_functionArgument'].includes(parent.opcode))return exactKeys(parent,['VALUE','REST']);
        if(parent.opcode==='arcade_callFunction')return name==='ARGS'&&exactKeys(parent,['NAME','ARGS'])&&typeof literal(parent,'NAME',owners.get(parent).target)==='string';
        if(parent.opcode==='procedures_call'){const call=calls.find(call=>call.node===parent);return !!call?.fn&&!call.fn.invalid&&!!call.args&&Object.keys(parent.fields||{}).length===0;}
        if(schemas[parent.opcode])return operationShape(parent);
        const sourceOperation=sourceValueOperation(parent);
        if(sourceOperation)return sourceOperation.inputs.includes(name);
        const scalarInputs={arrays_valueBinary:['LEFT','RIGHT'],arrays_valueUnary:['VALUE'],operator_add:['NUM1','NUM2'],operator_subtract:['NUM1','NUM2'],operator_multiply:['NUM1','NUM2'],operator_divide:['NUM1','NUM2'],operator_mod:['NUM1','NUM2'],operator_lt:['OPERAND1','OPERAND2'],operator_gt:['OPERAND1','OPERAND2'],operator_equals:['OPERAND1','OPERAND2'],operator_and:['OPERAND1','OPERAND2'],operator_or:['OPERAND1','OPERAND2'],operator_not:['OPERAND'],operator_join:['STRING1','STRING2'],operator_length:['STRING'],operator_letter_of:['LETTER','STRING'],operator_contains:['STRING1','STRING2'],operator_round:['NUM']};
        const inputs=scalarInputs[parent.opcode];if(!inputs)return false;
        if(parent.opcode.startsWith('arrays_value'))return exactKeys(parent,Object.hasOwn(parent.fields||{},'OP')?inputs:[...inputs,'OP'],['OP'])&&inputs.includes(name);
        return exactKeys(parent,inputs);
    };
    const onceNode=(node,path=new Set())=>{
        const scope=owners.get(node);if(!scope||scope.invalid||invalid.has(node))return false;
        let current=node;const seen=new Set();
        while(current!==scope.root){
            if(seen.has(current))return false;seen.add(current);
            const parent=block(scope.target,current.parent);if(!parent||invalid.has(parent)||owners.get(parent)!==scope)return false;
            const id=Object.keys(scope.target.blocks).find(id=>scope.target.blocks[id]===current);
            if(parent.next!==id){
                const inputs=Object.entries(parent.inputs||{}).filter(([,slot])=>slot[1]===id);
                if(inputs.length!==1||!onceParent(parent,inputs[0][0]))return false;
            }
            current=parent;
        }
        return onceScope(scope,path);
    };
    const onceScope=(scope,path)=>{
        if(onceScopes.has(scope))return onceScopes.get(scope);
        if(scope.invalid||scope.unknownEntry||implicitEntries.has(scope)||path.has(scope))return false;
        const next=new Set([...path,scope]);
        const result=scope.proc?scope.callers.length===1&&!!scope.callers[0].args&&onceNode(scope.callers[0].node,next):scope.root.opcode==='arcade_whenSourceStarts';
        onceScopes.set(scope,result);return result;
    };
    // Mandatory callee writes are occurrence certificates, never producer facts.
    // Collect every managed/escaped/unknown entry above before deriving these.
    let summaryExpired=false,summaryIssued=false;
    const summaryCache=new Map(),summaryBusy=new Set(),summaryEpoch={};
    // Cloud destinations can synchronously call an external provider; cloud
    // reads can receive writers outside this closed current-project inventory.
    const ordinarySummaryGlobal=c=>{
        for(const [target,map]of globalCell.maps)for(const [id,key]of map)if(cells.get(key)===c){
            const row=target.variables?.[id];return Array.isArray(row)&&row.length===2;
        }
        return false;
    };
    const ordinarySummaryScope=scope=>{
        if(!scope?.proc||scope.invalid||scope.unknownEntry||implicitEntries.has(scope)||
            scope.params.length||scope.ids.length||Object.hasOwn(Object.prototype,scope.proc))return false;
        const all=Object.values(scope.target.blocks||{}),prototype=child(scope.root,'custom_block',scope.target);
        return scope.root.opcode==='procedures_definition'&&scope.root.mutation==null&&
            exactKeys(scope.root,['custom_block'])&&prototype&&prototype.parent===scope.id&&
            prototype.opcode==='procedures_prototype'&&!invalid.has(prototype)&&
            !prototype.next&&exactKeys(prototype,[])&&
            all.filter(n=>n.opcode==='procedures_definition'&&child(n,'custom_block',scope.target)?.mutation?.proccode===scope.proc).length===1&&
            all.filter(n=>n.opcode==='procedures_prototype'&&n.mutation?.proccode===scope.proc).length===1;
    };
    const summaryCall=call=>!!call?.fn&&!call.fn.invalid&&call.args?.length===0&&
        call.node.opcode==='procedures_call'&&exactKeys(call.node,[])&&
        call.node.mutation?.proccode===call.fn.proc&&call.node.mutation?.argumentids==='[]'&&
        Object.keys(call.node.mutation).every(key=>['tagName','children','proccode','argumentids','warp'].includes(key));
    const summaryFor=scope=>{
        if(summaryCache.has(scope))return summaryCache.get(scope);
        if(summaryBusy.has(scope)||!ordinarySummaryScope(scope)||!closedEffects())return null;
        summaryBusy.add(scope);
        const locals=new Map(),writes=new Map(),seen=new Set();
        const shape=(node,names)=>!!node&&!invalid.has(node)&&owners.get(node)===scope&&node.mutation==null&&exactKeys(node,names);
        // These closed synchronous operands preserve their real native effects.
        // No Image value/resource fact is issued; unknown calls or effects refuse.
        const operand=(value,path=new Set())=>{
            if(!value)return null;
            if(value.raw)return Array.isArray(value.raw)&&value.raw.length===2&&[4,5,6,7,8,9,10,11].includes(value.raw[0])?'scalar':null;
            if(value.cell)return ordinarySummaryGlobal(value.cell)?'reference':null;
            const n=value.node;if(!n||path.has(n)||invalid.has(n)||owners.get(n)!==scope)return null;
            const next=new Set([...path,n]),at=name=>input(n,name,scope.target);
            if(n.opcode==='arcade_getLocal'&&shape(n,['NAME'])){
                const name=literal(n,'NAME',scope.target);
                return typeof name==='string'&&!Object.hasOwn(Object.prototype,name)?locals.get(localCell(scope,name))||null:null;
            }
            if(n.opcode==='data_variable'&&n.mutation==null&&exactKeys(n,[],['VARIABLE'])&&ordinarySummaryGlobal(binding(scope.target,n)))return 'reference';
            const scalarInputs={operator_add:['NUM1','NUM2'],operator_subtract:['NUM1','NUM2'],operator_multiply:['NUM1','NUM2'],operator_divide:['NUM1','NUM2'],operator_mod:['NUM1','NUM2']};
            if(scalarInputs[n.opcode]&&shape(n,scalarInputs[n.opcode])&&scalarInputs[n.opcode].every(name=>operand(at(name),next)==='scalar'))return 'scalar';
            if(n.opcode==='arrays_createReference'&&shape(n,['VALUES'])&&literal(n,'VALUES',scope.target)==='[]')return 'array';
            if(n.opcode==='arrays_specialValue'&&n.mutation==null&&exactKeys(n,[],['KIND'])&&
                ['null','undefined'].includes(literal(n,'KIND',scope.target)))return 'scalar';
            if(closedFrameImageEffect(scope.target,n,scope))return 'image-effect';
            if(n.opcode==='arcade_cloneImage'&&shape(n,['IMAGE'])&&operand(at('IMAGE'),next)==='image-effect')return 'image-effect';
            return null;
        };
        let id=scope.root.next,ok=true;
        while(id){
            if(seen.has(id)){ok=false;break;}seen.add(id);
            const n=block(scope.target,id);if(!n||invalid.has(n)||owners.get(n)!==scope){ok=false;break;}
            if(n.opcode==='arcade_setLocal'&&shape(n,['NAME','VALUE'])){
                const name=literal(n,'NAME',scope.target),kind=operand(input(n,'VALUE',scope.target));
                if(typeof name!=='string'||Object.hasOwn(Object.prototype,name)||!kind){ok=false;break;}
                const c=localCell(scope,name),origin=captures.local(captures.scopeOf(n),name),captureProof=origin&&captures.proof(origin);
                if(origin&&(!captureProof||captureProof.escaped)){ok=false;break;}locals.set(c,kind);
            }else if(n.opcode==='arrays_mutateReference'&&shape(n,['ARRAY','OP','INDEX','VALUE'])&&
                literal(n,'OP',scope.target)==='push'&&literalNumber(scope.target,n,'INDEX')===0&&
                operand(input(n,'ARRAY',scope.target))==='array'&&operand(input(n,'VALUE',scope.target))){
                // Actual local Array mutation stays at its original command.
            }else if(n.opcode==='data_setvariableto'&&n.mutation==null&&exactKeys(n,['VALUE'],['VARIABLE'])){
                const c=globalCell(scope.target,n.fields?.VARIABLE?.[1]);
                const rhs=input(n,'VALUE',scope.target),kind=operand(rhs),source=rhs.cell||(rhs.node&&binding(scope.target,rhs.node));
                if(!ordinarySummaryGlobal(c)||!['array','reference'].includes(kind)||source===c){ok=false;break;}
                writes.set(c,{epoch:summaryEpoch,scope,writer:n,dependencies:[],required:[rhs]});
            }else if(n.opcode==='procedures_call'){
                const call=calls.find(c=>c.node===n),nested=summaryCall(call)&&call.scope===scope&&summaryFor(call.fn);
                if(!nested){ok=false;break;}
                for(const [c,proof]of nested)writes.set(c,{epoch:summaryEpoch,scope,writer:proof.writer,call:n,dependencies:[proof],required:[]});
            }else {ok=false;break;}
            id=n.next;
        }
        summaryBusy.delete(scope);const result=ok?writes:null;summaryCache.set(scope,result);return result;
    };
    const checkingSummary=new Set();
    // Only queried after construction/type propagation. No forward initializer
    // is called while building summaries; RHS availability stays occurrence-local.
    const summaryCurrent=proof=>{
        if(summaryExpired||proof?.epoch!==summaryEpoch||checkingSummary.has(proof))return false;
        checkingSummary.add(proof);
        try{return proof.dependencies.every(summaryCurrent)&&proof.required.every(value=>initialized(value));}
        finally{checkingSummary.delete(proof);}
    };
    // Keep the original direct-write availability Sets untouched. A separate
    // occurrence map preserves the certificate dependency through caller entries.
    for(const scope of scopes){
        scope.executedBefore=new WeakMap();scope.summaryBefore=new WeakMap();
        const walk=(id,known,path=new Set(),executed=new Set(),summaries=new Map(),top=true)=>{
            if(!id||path.has(id))return known;const node=block(scope.target,id);if(!node)return known;const next=new Set([...path,id]);
            const expressionPath=new Set();const expressions=value=>{if(!value||expressionPath.has(value))return;expressionPath.add(value);scope.before.set(value,new Set(known));scope.summaryBefore.set(value,new Map(summaries));scope.executedBefore.set(value,new Set(executed));for(const [name,slot]of Object.entries(value.inputs||{}))if(!name.startsWith('SUBSTACK'))expressions(block(scope.target,slot[1]));};expressions(node);
            if(node.opcode==='data_setvariableto'){const c=globalCell(scope.target,node.fields?.VARIABLE?.[1]);if(c)known.add(c);}
            if(node.opcode==='arcade_setLocal'){const c=localCell(scope,literal(node,'NAME',scope.target));if(c)known.add(c);}
            if(top&&node.opcode==='procedures_call'&&(ordinarySummaryScope(scope)||
                scope.root.opcode==='arcade_whenSourceStarts'&&scope.root.mutation==null&&exactKeys(scope.root,[]))){
                const call=calls.find(c=>c.node===node),proofs=summaryCall(call)&&call.scope===scope&&summaryFor(call.fn);
                if(proofs)for(const [c,proof]of proofs){summaryIssued=true;summaries.set(c,{epoch:summaryEpoch,scope,call:node,writer:proof.writer,dependencies:[proof],required:[]});}
            }
            for(const name of ['SUBSTACK','SUBSTACK2'])if(node.inputs?.[name])walk(node.inputs[name][1],new Set(known),next,new Set(executed),new Map(summaries),false);
            executed.add(node);return walk(node.next,known,next,executed,summaries,top);
        };walk(scope.root.next,new Set((scope.params||[]).map(name=>localCell(scope,name)).filter(Boolean)));
    }
    const uniqueAllocation=(allocation,path=new Set())=>{
        if(!allocation||path.has(allocation))return false;
        const next=new Set([...path,allocation]);
        return allocation.origin?uniqueAllocation(allocation.origin,next):!!allocation.target&&onceNode(allocation.node);
    };
    // A callee statement on the unconditional straight prefix of its body runs
    // on every completed call. Credit it only for a direct call operand of a
    // caller statement that already executed before the queried occurrence.
    const straightPrefix=(fn,node)=>{
        const seen=new Set();let id=fn.root?.next;
        while(id&&!seen.has(id)){seen.add(id);const n=block(fn.target,id);if(!n)return false;if(n===node)return true;
            if(Object.keys(n.inputs||{}).some(name=>name.startsWith('SUBSTACK'))||/return|stop|break|continue|throw/i.test(n.opcode))return false;id=n.next;}
        return false;
    };
    const calleeExecutedBefore=(node,scope,before)=>{
        const fn=owners.get(node);if(!fn||!scope||fn===scope||fn.invalid||fn.unknownEntry||!straightPrefix(fn,node))return false;
        return calls.some(call=>call.fn===fn&&call.scope===scope&&owners.get(call.node)===scope&&[...before].some(statement=>statement&&owners.get(statement)===scope&&
            Object.entries(statement.inputs||{}).some(([name,slot])=>!name.startsWith('SUBSTACK')&&block(scope.target,slot?.[1])===call.node)));
    };
    // The statement that evaluates an expression occurrence.
    const statementOf=node=>{
        const scope=owners.get(node);if(!scope)return null;let current=node;const seen=new Set();
        while(current&&current!==scope.root&&!seen.has(current)){seen.add(current);
            const parent=block(scope.target,current.parent);if(!parent||owners.get(parent)!==scope)return null;
            const id=Object.keys(scope.target.blocks).find(id=>scope.target.blocks[id]===current);
            if(parent.next===id||Object.entries(parent.inputs||{}).some(([name,slot])=>name.startsWith('SUBSTACK')&&slot?.[1]===id))return current;
            current=parent;}
        return null;
    };
    // A shrink whose once-only statement runs strictly after the queried
    // occurrence's once-only statement in the same scope cannot remove an
    // element first; every evaluation stays inside its own statement.
    const shrinkAfter=(shrink,at)=>{
        const scope=owners.get(at),statement=statementOf(at),later=statementOf(shrink);
        if(!scope||owners.get(shrink)!==scope||!statement||!later||statement===later||!onceNode(statement)||!onceNode(later))return false;
        return !!scope.executedBefore.get(shrink)?.has(statement);
    };
    // Sprite.data of a sprite variable: exactly one actual data write targets
    // that variable, once and earlier in the reading scope, and the variable
    // holds exactly one fresh sprite creation. Every other data write must
    // target a distinct variable that also holds only its own fresh creation.
    const SPRITE_CREATIONS=new Set(['arcade_createSprite','arcade_createImageSprite']);
    // The one fresh sprite creation a cell holds, following plain aliases.
    const liveCreation=(c,at,path=new Set())=>{
        if(!c||c.directBad||path.has(c))return null;
        const direct=liveCreationAt(c,at,new Set(path));if(direct)return direct;
        // A global read inside a procedure runs at each of its actual calls.
        // Every caller must resolve the same single creation there.
        const scope=owners.get(at);
        if(!c.global||!scope?.proc||scope.invalid||scope.unknownEntry||implicitEntries.has(scope)||!scope.callers.length||path.has(scope))return null;
        const next=new Set(path);next.add(scope);
        const made=scope.callers.map(call=>liveCreation(c,call.node,next));
        return made[0]&&made.every(value=>value===made[0])?made[0]:null;
    };
    const liveCreationAt=(c,at,path)=>{
        if(!c||c.directBad||path.has(c))return null;path.add(c);
        const live=c.writers.filter(w=>!killedReset(c,w,at));if(live.length!==1||invalid.has(live[0].node))return null;
        const value=live[0].value,source=value?.cell||(value?.node&&binding(live[0].target,value.node));
        if(source)return liveCreation(source,live[0].node,path);
        // A literal call of a closed parameterless procedure whose straight-line
        // body ends in its only return of one alias of the creation: the call
        // evaluates its body once and yields that same Sprite.
        if(value?.node?.opcode==='arcade_callFunction'){
            const fn=aliasReturningProcedure(value.node);if(!fn||path.has(fn))return null;path.add(fn);
            const ret=fn.returns[0],returned=ret?.cell||(ret?.node&&binding(fn.target,ret.node));
            // The body runs at the call: resolve the returned cell there.
            return returned?liveCreation(returned,value.node,path):null;
        }
        return SPRITE_CREATIONS.has(value?.node?.opcode)?value.node:null;
    };
    // The procedure qualifies only when every actual caller stores its result
    // into a plain local/global (an alias the writer index already follows),
    // and its one return is the final top-level statement.
    const aliasReturningProcedure=callNode=>{
        const call=calls.find(c=>c.node===callNode),fn=call?.fn;
        if(!fn||fn.invalid||fn.unknownEntry||implicitEntries.has(fn)||fn.params.length||fn.returns.length!==1||!fn.callers.length)return null;
        let last=fn.root,count=0;const seen=new Set();
        while(last?.next&&count++<4096){if(seen.has(last))return null;seen.add(last);last=block(fn.target,last.next);}
        if(last?.opcode!=='arcade_returnValue'||!exactKeys(last,['VALUE'])||last.mutation!=null)return null;
        if(records.some(r=>r.scope===fn&&r.node.opcode==='arcade_returnValue'&&r.node!==last))return null;
        for(const caller of fn.callers){
            const parent=caller.node.opcode==='arcade_callFunction'?block(caller.target,caller.node.parent):null;
            if(!parent||!['arcade_setLocal','data_setvariableto'].includes(parent.opcode)||parent.inputs?.VALUE?.[1]!==Object.keys(caller.target.blocks).find(id=>caller.target.blocks[id]===caller.node))return null;
        }
        fn.returnNode=last;return fn;
    };
    const idCell=(target,node)=>{const v=input(node,'ID',target);return v?.cell||(v?.node&&binding(target,v.node))||null;};
    const spriteDataWriter=(target,node)=>{
        if(!exactKeys(node,['ID'],['PROPERTY'])||literal(node,'PROPERTY',target)!=='data')return null;
        const c=idCell(target,node),creation=liveCreation(c,node);if(!creation)return null;
        const writes=records.filter(r=>r.node.opcode==='arcade_setSpriteProperty'&&literal(r.node,'PROPERTY',r.target)==='data');
        if(records.some(r=>r.node.opcode==='arcade_setSpriteProperty'&&literal(r.node,'PROPERTY',r.target)===null))return null;
        const own=[];
        for(const r of writes){if(!exactKeys(r.node,['ID','VALUE'],['PROPERTY'])||invalid.has(r.node))return null;const other=idCell(r.target,r.node);
            const made=other===c?creation:liveCreation(other,r.node);if(!made)return null;if(made===creation)own.push(r);}
        if(own.length!==1)return null;const w=own[0],scope=owners.get(node);
        if(w.scope!==scope||!onceNode(w.node)||!scope.executedBefore?.get(statementOf(node))?.has(w.node))return null;
        return {value:input(w.node,'VALUE',w.target),node:w.node};
    };
    // This query supplies actual public writer nodes, never a Number, Array or
    // runtime certificate. A caller must independently prove every returned
    // input primitive. It is intentionally narrower than general Sprite typing.
    let spriteFlagsExpired=false;
    const flagsReadOnlyMonitors=()=>{
        // Preserve the old arbitrary-AST empty-monitor path without ever
        // iterating unowned watcher records, even if a Proxy lies about length.
        if(!isProjectJsonSnapshot(project))return !(project.monitors||[]).length;
        const own=(value,key)=>value&&typeof value==='object'?watcherOwnDescriptor(value,key)?.value:undefined;
        const monitors=own(project,'monitors');
        if(!watcherIsArray(monitors)||own(project,'targets')!==targets||!watcherIsArray(targets))return false;
        const seen=watcherCreate(null),allowed=['id','mode','opcode','params','spriteName','value','width','height','x','y','visible','sliderMin','sliderMax','isDiscrete'];
        // Every traversed edge is an OWN edge of the native parsed frozen
        // tree. Neither a prototype property nor an Array iterator can supply
        // an unowned record after construction.
        for(let i=0;i<own(monitors,'length');i++){
            const monitor=own(monitors,i+'');
            if(!monitor||typeof monitor!=='object')return false;
            const keys=watcherOwnKeys(monitor);if(keys.length!==allowed.length)return false;
            for(let k=0;k<keys.length;k++){
                let known=false;for(let a=0;a<allowed.length;a++)if(allowed[a]===keys[k])known=true;
                if(!known)return false;
            }
            const id=own(monitor,'id'),params=own(monitor,'params'),name=own(params,'VARIABLE');
            if(typeof id!=='string'||seen[id]||own(monitor,'opcode')!=='data_variable'||own(monitor,'mode')!=='default'||
                own(monitor,'spriteName')!==null||typeof own(monitor,'visible')!=='boolean'||typeof own(monitor,'isDiscrete')!=='boolean'||
                !params||typeof params!=='object'||watcherOwnKeys(params).length!==1||typeof name!=='string')return false;
            const numeric=['x','y','width','height','sliderMin','sliderMax'];
            for(let k=0;k<numeric.length;k++){const value=own(monitor,numeric[k]);if(typeof value!=='number'||!watcherFinite(value))return false;}
            let owner=null,count=0;
            for(let t=0;t<own(targets,'length');t++){
                const target=own(targets,t+''),variables=own(target,'variables'),declaration=own(variables,id);
                if(declaration!==undefined){
                    if(owner||own(target,'isStage')!==true||!watcherIsArray(declaration)||own(declaration,'length')!==2||own(declaration,'0')!==name)return false;
                    owner=target;const variableKeys=watcherOwnKeys(variables);
                    for(let v=0;v<variableKeys.length;v++)if(own(own(variables,variableKeys[v]),'0')===name)count++;
                }
            }
            if(!owner||count!==1)return false;
            seen[id]=true;
        }
        return true;
    };
    // live() may observe metadata itself when an existing reset proof was
    // used. Every such callback precedes this final source/identity-only check.
    const spriteFlagsPhysicalCurrent=()=>project.targets===targets&&snapshot()===original&&snapshots.every(s=>s.target.blocks?.[s.id]===s.node&&s.node.inputs===s.inputs&&s.node.fields===s.fields&&s.node.mutation===s.mutation&&s.inputRows.every(([name,row,a,b])=>s.node.inputs?.[name]===row&&row?.[1]===a&&row?.[2]===b));
    const spriteFlagsCurrent=()=>{if(spriteFlagsExpired)return false;try{if(summaryExpired||effectMetadata()!==originalEffects||!live()||!spriteFlagsPhysicalCurrent())spriteFlagsExpired=true;}catch(error){spriteFlagsExpired=true;throw error;}return !spriteFlagsExpired;};
    const spriteFlagWriters=(target,node)=>{try{
        if(!spriteFlagsCurrent()||invalidGlobalBinding||!nodes.has(target)||invalid.has(node)||!owners.has(node)||
            !exactKeys(node,['ID'],['PROPERTY'])||node.mutation!=null||literal(node,'PROPERTY',target)!=='flags')return null;
        // These external sources can replace a binding outside this writer
        // inventory. Only owned read-only watchers are inert; cloud and external writers refuse.
        if(targets.some(t=>Object.values(t.variables||{}).some(v=>v.length!==2))||!flagsReadOnlyMonitors())return null;
        if(!Array.isArray(project.extensions)||project.extensions.some(id=>!['arcade','arrays'].includes(id))||
            project.extensionURLs&&Object.entries(project.extensionURLs).some(([id,url])=>id!=='arrays'||url!=='https://crispstrobe.github.io/extensions/CrispStrobe/arrays.js'))return null;
        const receiver=idCell(target,node),creation=liveCreation(receiver,node);
        if(!creation||!onceNode(creation)||!exactKeys(creation,creation.opcode==='arcade_createSprite'?['TEMPLATE','KIND','WIDTH','HEIGHT']:['IMAGE','TEMPLATE','KIND'])||creation.mutation!=null)return null;
        const writerInputs=[];
        const properties=new Set(['x','y','left','right','top','bottom','vx','vy','ax','ay','fx','fy','sx','sy','scale','width','height','z','lifespan','rotation','rotationDegrees','data','flags']);
        const flags=new Set(['AutoDestroy','StayInScreen','BounceOnWall','DestroyOnWall','Invisible','Ghost','GhostThroughSprites','GhostThroughWalls','GhostThroughTiles','RelativeToCamera','ShowPhysics']);
        const flagBooleanWriters=new Set(['arcade_setSpriteFlag','arcade_setSpriteStayInScreen','arcade_setSpriteAutoDestroy','arcade_setSpriteBounceOnWall','arcade_setSpriteGhostThroughSprites']);
        for(const r of records){
            const n=r.node;
            if(flagBooleanWriters.has(n.opcode)){
                const fixed=n.opcode==='arcade_setSpriteFlag';
                if(!exactKeys(n,['ID','ON'],fixed?['FLAG']:[])||n.mutation!=null||fixed&&!flags.has(literal(n,'FLAG',r.target)))return null;
                const made=liveCreation(idCell(r.target,n),n);if(!made)return null;
                if(made===creation)writerInputs.push({target:r.target,node:n,input:'ON'});
            }
            if(n.opcode==='arcade_setSpriteProperty'){
                const property=literal(n,'PROPERTY',r.target);
                if(!properties.has(property)||!exactKeys(n,['ID','VALUE'],['PROPERTY'])||n.mutation!=null)return null;
                if(property==='flags'){
                    const made=liveCreation(idCell(r.target,n),n);if(!made)return null;
                    if(made===creation)writerInputs.push({target:r.target,node:n,input:'VALUE'});
                }
            }
            for(const name of Object.keys(n.inputs||{})){
                const value=input(n,name,r.target),c=value.cell||(value.node&&binding(r.target,value.node));
                if(!c||liveCreation(c,n)!==creation)continue;
                if(invalid.has(n)||r.scope.invalid)return null;
                // Plain aliases stay in the same complete cell/writer index.
                if(name==='VALUE'&&['data_setvariableto','arcade_setLocal','arcade_setCaptured'].includes(n.opcode))continue;
                // The return of an alias-returning procedure feeds only alias stores.
                if(name==='VALUE'&&n.opcode==='arcade_returnValue'&&r.scope.callers.length&&r.scope.callers.every(caller=>aliasReturningProcedure(caller.node)===r.scope)&&r.scope.returnNode===n)continue;
                if(name==='ID'&&n.opcode==='arcade_spriteProperty'&&exactKeys(n,['ID'],['PROPERTY'])&&properties.has(literal(n,'PROPERTY',r.target))&&n.mutation==null)continue;
                if(name==='ID'&&n.opcode==='arcade_setSpriteProperty')continue;
                if(name==='ID'&&flagBooleanWriters.has(n.opcode))continue;
                // Object/Array publication, unknown calls, unproved formal
                // forwarding and other receiver operations are not this slice.
                return null;
            }
        }
        if(!spriteFlagsCurrent())return null;
        return Object.freeze(writerInputs.map(row=>Object.freeze(row)));
    }catch(error){spriteFlagsExpired=true;throw error;}};
    // An Array settings read is the value of the one same-type write of that
    // literal key that ran once, earlier in the reading scope. Every other
    // write/remove of that key and every clear must be in the same once-only
    // scope and run either before that write or after the read. A dynamic
    // key, or a key mutation elsewhere, refuses (an absent key reads undefined).
    const settingsArrayWriter=(target,node)=>{
        const type=literal(node,'TYPE',target),key=literal(node,'KEY',target);
        if(!exactKeys(node,['KEY'],['TYPE'])||!['NumberArray','StringArray'].includes(type)||typeof key!=='string')return null;
        const scope=owners.get(node),statement=statementOf(node),before=statement&&scope?.executedBefore?.get(statement);if(!before)return null;
        const touches=records.filter(r=>['arcade_settingsWrite','arcade_settingsRemove','arcade_settingsClear'].includes(r.node.opcode));
        let writer=null;
        for(const r of touches){
            const k=r.node.opcode==='arcade_settingsClear'?null:literal(r.node,'KEY',r.target);
            if(r.node.opcode!=='arcade_settingsClear'&&typeof k!=='string')return null;
            if(k!==null&&k!==key)continue;
            if(r.scope!==scope||!onceNode(r.node)||invalid.has(r.node))return null;
            if(r.node.opcode==='arcade_settingsWrite'&&literal(r.node,'TYPE',r.target)===type&&before.has(r.node)&&(!writer||scope.executedBefore.get(r.node)?.has(writer.node)))writer=r;
        }
        if(!writer)return null;
        for(const r of touches){
            const k=r.node.opcode==='arcade_settingsClear'?null:literal(r.node,'KEY',r.target);if(k!==null&&k!==key||r===writer)continue;
            const earlier=!!scope.executedBefore.get(writer.node)?.has(r.node),later=!!scope.executedBefore.get(r.node)?.has(statement);
            if(!earlier&&!later)return null;
        }
        return {node:writer.node,value:input(writer.node,'VALUE',writer.target)};
    };
    spriteDataReady=true;
    resetFlowReady=true;
    const definiteOverwrite=createArrayDefiniteOverwrite({project,targets,scopes,records,calls,owners,invalid,implicitEntries,
        block,child,input,literal,binding,globalCell,localCell,exactKeys,resetValue,
        ordinarySummaryGlobal,statementOf,closedEffects,isArrayMenuSelector,isKnownArrayMenuOperation});
    for(const c of cells.values())c.writers=c.writers.filter(writer=>{
        if(!definiteOverwrite(c,writer))return true;
        // Only a reaching reset of an owned immutable JSON tree is removed.
        // Every actual overwrite and other writer retains its producer checks.
        extendedResetUsed=true;return false;
    });
    let prefixResetExpired=false;
    const prefixResetCurrent=()=>{
        // This function is the exact helper instance constructed above, never
        // a caller certificate. Legacy/unused prefix paths acquire no watcher.
        if(!definiteOverwrite.used?.())return true;
        if(!prefixResetExpired)try{if(!definiteOverwrite.current())prefixResetExpired=true;}
        catch(error){prefixResetExpired=true;throw error;}
        return !prefixResetExpired;
    };
    // A push precedes an occurrence in every activation when it executed
    // earlier in the occurrence's own scope (directly or on a called
    // procedure's straight prefix), or when the occurrence is in an ordinary
    // procedure whose every actual direct caller is itself preceded by it.
    const pushedBefore=(push,at,depth=0)=>{
        const scope=owners.get(at);if(!scope||scope.invalid)return false;
        const before=scope.executedBefore?.get(at)||new Set();
        if(before.has(push)||calleeExecutedBefore(push,scope,before))return true;
        if(depth>6||!scope.proc||scope.unknownEntry||implicitEntries.has(scope)||!scope.callers.length)return false;
        return scope.callers.every(call=>call.node&&owners.get(call.node)===call.scope&&pushedBefore(push,call.node,depth+1));
    };
    const singleShrink=(target,node)=>node.opcode==='arrays_referenceTake'&&['pop','shift'].includes(literal(node,'OP',target))||
        node.opcode==='arrays_mutateReference'&&['pop','shift','removeAt'].includes(literal(node,'OP',target))||node.opcode==='arrays_referenceRemove';
    const shrinkBefore=(shrink,at)=>{
        const scope=owners.get(at),statement=statementOf(at),earlier=statementOf(shrink);
        if(!scope||owners.get(shrink)!==scope||!statement||!earlier||statement===earlier||!singleShrink(scope.target,shrink)||!onceNode(statement)||!onceNode(earlier))return false;
        return !!scope.executedBefore.get(statement)?.has(earlier);
    };
    const minimumAt=(allocation,at,qualifies=()=>true)=>{
        // A single-element shrink in a once-only statement that definitely ran
        // earlier in the same scope removes at most one element; any other
        // possibly earlier shrink forfeits all presence credit.
        let removed=0;
        for(const node of allocation.shrinks||[]){
            if(node===at||shrinkAfter(node,at))continue;
            if(shrinkBefore(node,at)){removed++;continue;}
            return 0;
        }
        const scope=owners.get(at),before=scope?.executedBefore.get(at)||new Set();let length=allocation.minLength-removed;
        // A possible target receives element-type obligations below, but only
        // a unique actual target receives guaranteed-presence credit.
        for(const {target,node}of mutations){const receiver=readInput(input(node,'ARRAY',target));if(pushedBefore(node,at)&&['push','unshift'].includes(literal(node,'OP',target))&&receiver.size===1&&receiver.has(allocation)&&uniqueAllocation(allocation)&&qualifies(target,node))length++;}
        return length;
    };
    const pendingPresence=(allocation,at)=>{
        if(!uniqueAllocation(allocation))return false;
        const before=owners.get(at)?.executedBefore.get(at)||new Set();
        return mutations.some(({target,node})=>before.has(node)&&['push','unshift'].includes(literal(node,'OP',target))&&readInput(input(node,'ARRAY',target)).size===0);
    };
    // The for-of lowering reads `item i of a` as the FIRST statement of
    // `repeat while i < length(a)`, where i is a local written only by a literal
    // zero before the loop and by `i := +i + 1` inside it, and a is a local
    // written once before the loop. The just-checked bound
    // makes that read present.
    const forOfPresent=(allocation,target,node)=>{
        // No shrink matters: nothing can run between the bound check and the
        // first body statement in one thread step, and every iteration re-checks.
        if(node.opcode!=='arrays_referenceItem')return false;
        const indexRead=input(node,'INDEX',target).node,arrayRead=input(node,'ARRAY',target).node;
        if(indexRead?.opcode!=='arcade_getLocal'||arrayRead?.opcode!=='arcade_getLocal')return false;
        const scope=owners.get(node),i=binding(target,indexRead),a=binding(target,arrayRead),statement=statementOf(node);
        if(!scope||!i||!a||i===a||!statement)return false;
        const loop=block(target,statement.parent);
        if(loop?.opcode!=='arcade_sourceWhile'||!exactKeys(loop,['CONDITION','SUBSTACK'])||loop.inputs.SUBSTACK?.[1]!==Object.keys(target.blocks).find(k=>target.blocks[k]===statement))return false;
        const condition=block(target,loop.inputs.CONDITION?.[1]);
        if(condition?.opcode!=='arrays_valueCompare'||!exactKeys(condition,['LEFT','RIGHT'],['OP'])||literal(condition,'OP',target)!=='<')return false;
        const left=input(condition,'LEFT',target).node,right=input(condition,'RIGHT',target).node;
        if(left?.opcode!=='arcade_getLocal'||binding(target,left)!==i||right?.opcode!=='arrays_referenceLength'||!exactKeys(right,['ARRAY']))return false;
        const lengthRead=input(right,'ARRAY',target).node;if(lengthRead?.opcode!=='arcade_getLocal'||binding(target,lengthRead)!==a)return false;
        const inLoop=n=>{for(let p=n,seen=new Set();p&&!seen.has(p);seen.add(p),p=block(target,p.parent))if(p===loop)return true;return false;};
        if(a.writers.length!==1||a.writers[0].scope!==scope||inLoop(a.writers[0].node))return false;
        const zero=v=>{const n=v?.node;if(v?.raw)return Number(v.raw[1])===0;if(n?.opcode==='operator_add'&&exactKeys(n,['NUM1','NUM2']))return literalNumber(target,n,'NUM1')===0&&literalNumber(target,n,'NUM2')===0;return n?.shadow&&n.opcode==='math_number'&&Number(n.fields?.NUM?.[0])===0;};
        const step=v=>{const n=v?.node;if(n?.opcode!=='arrays_valueBinary'||literal(n,'OP',target)!=='+'||!exactKeys(n,['LEFT','RIGHT'],['OP']))return false;
            const l=input(n,'LEFT',target).node,plus=l?.opcode==='arrays_valueUnary'&&literal(l,'OP',target)==='+'?input(l,'VALUE',target).node:l,r=input(n,'RIGHT',target);
            const one=r.raw?Number(r.raw[1])===1:r.node?.opcode==='operator_add'&&literalNumber(target,r.node,'NUM1')===0&&literalNumber(target,r.node,'NUM2')===1;
            return plus?.opcode==='arcade_getLocal'&&binding(target,plus)===i&&one;};
        const inits=i.writers.filter(w=>!inLoop(w.node)),steps=i.writers.filter(w=>inLoop(w.node));
        return inits.length===1&&inits[0].scope===scope&&zero(inits[0].value)&&steps.length>=1&&steps.every(w=>step(w.value))&&
            !!scope.executedBefore.get(loop)?.has(inits[0].node)&&!!scope.executedBefore.get(loop)?.has(a.writers[0].node);
    };
    // A constant integer index: literals, + - * of constants (Scratch operators
    // or the value binary block), and a call of a closed procedure whose only
    // statement returns such an expression of its parameters, given constant
    // arguments. PXT and Lite compute the same small integer.
    const constIndex=(value,env=null,depth=0)=>{
        if(!value||depth>16)return null;
        if(value.raw)return [4,5,6,7,8].includes(value.raw[0])&&String(value.raw[1]).trim()!==''&&Number.isFinite(Number(value.raw[1]))?Number(value.raw[1]):null;
        const {target,node}=value;if(!node||invalid.has(node))return null;
        const num=n=>Number.isSafeInteger(n)&&Math.abs(n)<2**31?n:null;
        if(node.shadow&&node.opcode==='math_number')return num(Number(node.fields?.NUM?.[0]));
        if(['operator_add','operator_subtract','operator_multiply'].includes(node.opcode)&&exactKeys(node,['NUM1','NUM2'])){
            const l=constIndex(input(node,'NUM1',target),env,depth+1),r=constIndex(input(node,'NUM2',target),env,depth+1);if(l===null||r===null)return null;
            return num(node.opcode==='operator_add'?l+r:node.opcode==='operator_subtract'?l-r:l*r);}
        if(node.opcode==='arrays_valueBinary'&&exactKeys(node,['LEFT','RIGHT'],['OP'])&&['+','-','*'].includes(literal(node,'OP',target))){
            const l=constIndex(input(node,'LEFT',target),env,depth+1),r=constIndex(input(node,'RIGHT',target),env,depth+1),op=literal(node,'OP',target);if(l===null||r===null)return null;
            return num(op==='+'?l+r:op==='-'?l-r:l*r);}
        if(node.opcode==='arcade_getLocal'&&env&&owners.get(node)===env.fn){const name=literal(node,'NAME',target);return env.values.has(name)?env.values.get(name):null;}
        if(node.opcode==='arcade_callFunction'){
            const call=calls.find(c=>c.node===node),fn=call?.fn;
            if(!fn||fn.invalid||fn.unknownEntry||implicitEntries.has(fn)||!call.args||call.args.length!==fn.params.length)return null;
            // Parameter-constraint declarations only check arguments at entry
            // (a mismatch faults, so no value is returned); then one return.
            let only=block(fn.target,fn.root.next);const skipped=new Set();
            while(only?.opcode==='arcade_declareParameterConstraint'&&!skipped.has(only)){skipped.add(only);only=block(fn.target,only.next);}
            if(only?.opcode!=='arcade_returnValue'||only.next!=null||only.mutation!=null||!exactKeys(only,['VALUE']))return null;
            const values=new Map();
            for(let i=0;i<fn.params.length;i++){const v=constIndex(call.args[i],env,depth+1);if(v===null)return null;values.set(fn.params[i],v);}
            return constIndex(input(only,'VALUE',fn.target),{fn,values},depth+1);
        }
        return null;
    };
    const presentAt=(allocation,target,node,qualifies)=>{
        if(forOfPresent(allocation,target,node))return true;
        const literalIndex=literalNumber(target,node,'INDEX');
        const length=minimumAt(allocation,node,qualifies),index=literalIndex!==null?literalIndex:node.opcode==='arrays_referenceItem'?constIndex(input(node,'INDEX',target)):null;
        return node.opcode==='arrays_referenceRandom'||node.opcode==='arrays_referenceTake'&&['pop','shift'].includes(literal(node,'OP',target))?length>0:index!==null&&Number.isInteger(index)&&index>=0&&index<length;
    };
    // Monotone producer flow handles genuine alias SCCs with an allocation;
    // cycles in the physical block graph were independently refused above.
    let changed;
    const arrayAllocations=new Set();
    const populate=(t,seen=new Set())=>{if(!t||typeof t!=='object'||!t.array||seen.has(t))return;arrayAllocations.add(t);seen.add(t);for(const item of t.items)for(const type of readInput(item))if(!t.elements.has(type)){t.elements.add(type);changed=true;}for(const type of t.elements)populate(type,seen);};
    do{
        changed=false;
        for(const c of cells.values())for(const w of c.writers){const types=w.value&&!invalid.has(w.node)&&!w.scope.invalid?readInput(w.value):new Set([bad]);for(const type of types)if(!c.types.has(type)){c.types.add(type);changed=true;}}
        for(const {target,node}of records){if(ordinaryEntry.isUnreachable(target,node))continue;const types=readNode(target,node);values.set(node,types);for(const t of types)populate(t);}
        for(const {target,node,value}of mutations){
            const receiver=readInput(input(node,'ARRAY',target)),op=isArrayMenuSelector(node,'OP')?literal(node,'OP',target):literal(node,'OP',target)||literal(node,'MODE',target);
            const unknownOperation=isArrayMenuSelector(node,'OP')&&!isKnownArrayMenuOperation(node,op);
            // An unresolved receiver may alias any discovered Array. Unknown
            // selectors cannot silently disappear from its element/shrink census.
            const affected=unknownOperation&&(!receiver.size||receiver.has(bad))?new Set([...receiver,...arrayAllocations]):receiver;
            for(const t of affected)if(t&&typeof t==='object'&&t.array){
                t.shrinks ||= new Set();
                if((unknownOperation||['pop','shift','removeAt','length','removeElement'].includes(op)||node.opcode==='arrays_referenceRemove')&&!t.shrinks.has(node)){t.shrinks.add(node);changed=true;}
                if(unknownOperation&&!t.elements.has(bad)){t.elements.add(bad);changed=true;}
                if(['push','unshift','insertAt','set'].includes(op)){t.sources.add(value);for(const type of readInput(value))if(!t.elements.has(type)){t.elements.add(type);changed=true;}}
            }
        }
    }while(changed);
    for(const c of cells.values())if(!c.types.size)c.types.add(bad);
    const initializingCells=new Set();
    const availability=(c,scope,node,path=new Set())=>{
        if(!c||!scope||scope.invalid||scope.unknownEntry)return 0;
        if(path.has(scope))return c.global&&singleArray(c.types)?1:0;if(c.formal===scope){if(initializingCells.has(c))return 0;initializingCells.add(c);try{return scope.callers.length>0&&c.writers.every(writer=>!writer.argument||initialized(writer.value))?2:0;}finally{initializingCells.delete(c);}}
        if(scope.before.get(node)?.has(c))return 2;
        if(summaryCurrent(scope.summaryBefore?.get(node)?.get(c)))return 2;
        const next=new Set([...path,scope]);let entries=scope.callers;
        if(!entries.length){
            const registrationPairs={arcade_whenRegisteredMultiplayerConnection:'arcade_registerMultiplayerConnection',arcade_whenRegisteredControlEvent:'arcade_registerControlEvent',arcade_whenParallelHandler:'arcade_startParallelHandler',arcade_whenRegisteredLegacyWall:'arcade_registerLegacyWallHandler',arcade_whenRegisteredMultiplayerButton:'arcade_registerMultiplayerButtonHandler',arcade_whenRegisteredCreated:'arcade_registerSpriteCreated',arcade_whenRegisteredWall:'arcade_registerWallHandler',arcade_whenRegisteredTile:'arcade_registerTileHandler',arcade_whenRegisteredUpdate:'arcade_registerUpdateHandler',arcade_whenRegisteredInterval:'arcade_registerIntervalHandler',arcade_whenRegisteredButton:'arcade_registerButtonHandler',arcade_whenRegisteredPaint:'arcade_registerPaintHandler',arcade_whenRegisteredShade:'arcade_registerShadeHandler',arcade_whenRegisteredInstanceDestroyed:'arcade_registerInstanceDestroyedHandler',arcade_whenRegisteredKindDestroyed:'arcade_registerDestroyedHandler',arcade_whenRegisteredOverlap:'arcade_registerOverlapHandler',arcade_whenRegisteredScenePush:'arcade_registerScenePushHandler',arcade_whenRegisteredScenePop:'arcade_registerScenePopHandler',arcade_whenRegisteredForever:'arcade_registerForeverHandler',arcade_whenRegisteredLifeZero:'arcade_registerLifeZeroHandler',arcade_whenRegisteredCountdown:'arcade_registerCountdownHandler',arcade_whenRegisteredExternal:'arcade_registerExternalHandler'};
            const expected=registrationPairs[scope.root.opcode],token=literal(scope.root,'TOKEN',scope.target);
            if(expected&&typeof token==='string'&&scope.root.inputs?.TOKEN){
                const hats=scopes.filter(s=>s.root.opcode===scope.root.opcode&&literal(s.root,'TOKEN',s.target)===token);
                const found=records.filter(r=>(r.node.opcode===expected||expected==='arcade_registerButtonHandler'&&r.node.opcode==='arcade_registerPlayerButtonHandler')&&(literal(r.node,'TOKEN',r.target)===token||literal(r.node,'TOKEN',r.target)===null));
                if(hats.length===1&&found.length===1&&found[0].target===scope.target&&found[0].node.inputs?.TOKEN&&!invalid.has(found[0].node))entries=found;
            }
        }
        const proofs=entries.map(entry=>availability(c,entry.scope,entry.node,next));
        return proofs.length&&proofs.every(Boolean)?proofs.some(proof=>proof===2)?2:1:0;
    };
    // 1 is a provisional global recursion edge; only an independently
    // initialized external entry or dominating write can finalize it as 2.
    // This separate issuer supplies only a current occurrence frontier. The
    // existing producer fixed point and initialized/all-writer checks remain
    // authoritative for the actual receiver and each published RHS.
    let conditionalEntry=null,conditionalEntryUsed=false,publicationFrontier=null,publicationFrontierUsed=false;
    const conditionalCurrent=()=>(!conditionalEntryUsed||conditionalEntry.current())&&(!publicationFrontierUsed||publicationFrontier.current());
    const available=(c,scope,node)=>{
        if(availability(c,scope,node)===2)return true;
        if(!c?.global||c.directBad||!singleArray(c.types)||!isProjectJsonSnapshot(project))return false;
        if(!conditionalEntry)conditionalEntry=createProjectConditionalArrayEntry({project,targets,scopes,records,calls,owners,invalid,block,child,input,
            literal,binding,globalCell,localCell,closedEffects,closedFrameImageEffect,implicitEntries});
        const admitted=writer=>!!writer&&c.writers.includes(writer)&&!invalid.has(writer.node)&&owners.get(writer.node)===writer.scope;
        if(admitted(conditionalEntry.writerBefore(c,scope,node))){conditionalEntryUsed=true;return true;}
        // Separate inductive route: every writer publishes a fresh Array and the
        // first one precedes every possible occurrence in the current run.
        if(!publicationFrontier)publicationFrontier=createProjectArrayPublicationFrontier({project,targets,scopes,records,calls,owners,invalid,
            globalCell,closedEffects,implicitEntries});
        if(!admitted(publicationFrontier.writerBefore(c,scope,node)))return false;
        publicationFrontierUsed=true;return true;
    };
    const numericKindInitialized=(value,path=new Set())=>{
        if(!numericKind(value))return false;
        const node=value?.node,c=value?.cell||(node&&binding(value.target,node));
        if(!c)return true;
        const at=value.at||node;if(path.has(c)||!available(c,owners.get(at),at))return false;
        const next=new Set([...path,c]);
        return c.writers.length>0&&c.writers.every(writer=>deadKindReset(c,writer)||numericKindInitialized(writer.value,next));
    };
    // A field read is initialized when every writer of that field name is a
    // straight-prefix statement of an actual class constructor/field
    // initializer that no call can precede, and its value is initialized;
    // a read inside that same procedure must follow the write.
    const callOpcodes=new Set(['arcade_callFunction','procedures_call','arcade_callObjectMethod','arcade_createObject']);
    const callsIn=(target,node,seen=new Set())=>{if(!node||seen.has(node))return false;seen.add(node);if(callOpcodes.has(node.opcode))return true;return Object.values(node.inputs||{}).some(slot=>typeof slot?.[1]==='string'&&callsIn(target,block(target,slot[1]),seen));};
    const constructorPrefix=w=>{
        const scope=w.scope;if(!scope?.proc||!/^__bwClass_.+_(constructor|fields)( |$)/.test(scope.proc))return false;
        const seen=new Set();for(let n=block(scope.target,scope.root.next);n&&!seen.has(n);n=block(scope.target,n.next)){seen.add(n);if(n===w.node)return true;
            if(Object.keys(n.inputs||{}).some(name=>name.startsWith('SUBSTACK'))||callsIn(scope.target,n))return false;}
        return false;
    };
    const fieldInitialized=(target,node,path)=>{
        const f=literal(node,'FIELD',target);if(dynamicFields||typeof f!=='string'||!cells.has('field:'+f))return false;
        const c=fieldCell(f),scope=owners.get(node);
        return c.writers.length>0&&c.writers.every(w=>w.value&&constructorPrefix(w)&&initialized(w.value,path)&&
            (w.scope!==scope||!!scope.executedBefore?.get(statementOf(node))?.has(w.node)));
    };
    const checkingWriterInitialization=new Set();
    const globalGetterCell=callNode=>{
        const call=calls.find(c=>c.node===callNode),fn=call?.fn;
        if(!fn||fn.invalid||fn.unknownEntry||implicitEntries.has(fn)||fn.params.length||fn.returns.length!==1||!call.args||call.args.length)return null;
        const only=block(fn.target,fn.root.next);
        if(only?.opcode!=='arcade_returnValue'||only.next!=null||only.mutation!=null||!exactKeys(only,['VALUE']))return null;
        const c=fn.returns[0]?.cell;
        return c?.global&&!c.directBad?c:null;
    };
    const initialized=(value,path=new Set())=>{
        // A literal value (JSON item or literal input) is initialized; it is an
        // Array only through jsonArray, which singleArray still checks.
        if(!value)return false;if(value.jsonArray||value.raw)return true;
        const initializedCell=(c,scope,at)=>{observeSourceDependency(c);if(!available(c,scope,at))return false;if(checkingWriterInitialization.has(c))return true;checkingWriterInitialization.add(c);try{const truthy=truthyGuarded(c,at),live=c.directBad?c.writers:c.writers.filter(w=>!killedReset(c,w,at)&&!(truthy&&resetValue(w.value?.node)));return live.length>0&&live.every(w=>w.value&&(initialized(w.value)||!c.directBad&&falsyGuarded(c,w,at)&&w.value.node?.opcode==='arrays_referenceItem'&&initialized(input(w.value.node,'ARRAY',w.target))));}finally{checkingWriterInitialization.delete(c);}};
        if(value.cell)return initializedCell(value.cell,owners.get(value.at),value.at);
        if(!value.node)return false;const {target,node}=value;if(path.has(node))return false;const next=new Set([...path,node]),c=binding(target,node);
        if(c)return initializedCell(c,owners.get(node),node);
        if(node.opcode==='arrays_createReference')return true;
        if(['arcade_animationAssetFrames','arcade_animationAssetFreshFrames'].includes(node.opcode))return !!animationProducers.resolve(target,node,{targets,monitors:project.monitors});
        if(node.opcode==='arrays_namedReference')return singleArray(namedBinding(target,node)||new Set());
        if(node.opcode==='arcade_callFunction'){
            // A closed parameterless getter whose only statement returns a
            // global evaluates nothing else: its result IS that global at this
            // call. Judge the global's initialization at the call site, so an
            // earlier call (before the global's writer) does not taint a later one.
            const getter=globalGetterCell(node);
            if(getter)return initializedCell(getter,owners.get(node),node);
            const passing=calls.find(c=>c.node===node);if(passing?.fn&&!passing.fn.invalid&&passing.args&&passthroughIndex(passing.fn)>=0)return initialized(passing.args[passthroughIndex(passing.fn)],next);
            const pruned=prunedLookupReturn(node);if(pruned)return initialized(pruned,next);
            const call=calls.find(c=>c.node===node);return !!call?.fn&&!call.fn.invalid&&!!call.args&&call.args.every(arg=>singleArray(readInput(arg))?initialized(arg,next):true)&&call.fn.returns.every(result=>initialized(result,next));
        }
        if(['arrays_referenceSlice','arrays_referenceConcat','arrays_referenceItem','arrays_referenceTake','arrays_referenceRandom','arrays_mutateReference'].includes(node.opcode)){
            if(!initialized(input(node,'ARRAY',target),next)||node.opcode==='arrays_referenceConcat'&&!initialized(input(node,'OTHER',target),next))return false;
            if(['arrays_referenceItem','arrays_referenceTake','arrays_referenceRandom','arrays_mutateReference'].includes(node.opcode)){
                const receiver=readInput(input(node,'ARRAY',target));if(!singleArray(receiver))return false;
                for(const allocation of receiver){
                    if(!presentAt(allocation,target,node,(t,mutation)=>initialized(input(mutation,'ARRAY',t),next)))return false;
                    // A proved exact slot read needs only that slot's own value.
                    const index=node.opcode==='arrays_referenceItem'?literalNumber(target,node,'INDEX'):null;
                    const slots=index!==null&&Number.isInteger(index)&&index>=0?slotsAt(allocation,node):null;
                    if(slots&&index<slots.length){if(!initialized(slots[index],next))return false;continue;}
                    for(const source of allocation.sources||[])if(!initialized(source,next))return false;

                }
            }
            return true;
        }
        if(node.opcode==='arcade_objectField')return fieldInitialized(target,node,next);
        if(node.opcode==='arcade_spriteProperty'){const w=spriteDataWriter(target,node);return !!w&&initialized(w.value,next);}
        if(node.opcode==='arcade_settingsRead'&&exactKeys(node,['KEY'],['TYPE'])&&literal(node,'TYPE',target)==='List')return true;
        if(node.opcode==='arcade_settingsRead'){const w=settingsArrayWriter(target,node);return !!w&&initialized(w.value,next);}
        if(node.opcode==='arcade_spritesOfKind'&&exactKeys(node,['KIND']))return numericKindInitialized(input(node,'KIND',target));
        if(Object.hasOwn(FRESH_SDK_ARRAYS,node.opcode))return exactKeys(node,FRESH_SDK_ARRAYS[node.opcode]);
        return false;
    };
    // Retained physical/realm/context obligations apply to mixed-global
    // dependencies without forcing valid primary proofs into a narrower
    // straight-line profile. Inventory only already-indexed receiver inputs.
    const mixedArrayCell=[...cells.values()].some(c=>c.types.has(bad)&&[...c.types].some(t=>t&&typeof t==='object'&&t.array));
    const mixedGlobalCell=[...cells.values()].some(c=>c.global&&c.types.has(bad)&&[...c.types].some(t=>t&&typeof t==='object'&&t.array));
    const protectedInputs=[];
    if(mixedGlobalCell)for(let i=0;i<snapshots.length;i++){
        const {target,node,inputRows}=snapshots[i];if(!Object.hasOwn(schemas,node.opcode))continue;
        for(let j=0;j<inputRows.length;j++){
            const name=inputRows[j][0];if(name!=='ARRAY'&&(name!=='OTHER'||node.opcode!=='arrays_referenceConcat'))continue;
            const previousReset=resetFlowReady,previousDependency=sourceDependency,dependency={mixed:false,seen:new Set(),globals:new Set()};
            try{resetFlowReady=false;sourceDependency=dependency;
                const value=input(node,name,target);readInput(value);initialized(value);
            }finally{resetFlowReady=previousReset;sourceDependency=previousDependency;}
            if(dependency.mixed){
                const globals=[];
                for(const [owner,map]of globalCell.maps)for(const [id,key]of map)
                    if(dependency.globals.has(cells.get(key)))globals.push({owner,id});
                protectedInputs.push({target,node,name,globals});
            }
        }
    }
    const protectedInput=(target,node,name)=>{
        for(let i=0;i<protectedInputs.length;i++){const r=protectedInputs[i];if(r.target===target&&r.node===node&&r.name===name)return r;}
        return null;
    };
    // Visible slider/list controls write the addressed variable through the
    // actual GUI variable-utils path. Read-only UI metadata is not a producer
    // restriction. The full physical snapshot freezes either configuration.
    const monitorWrites=receiver=>Array.isArray(project.monitors)&&project.monitors.some(monitor=>{
        if(!monitor?.visible||!['slider','list'].includes(monitor.mode))return false;
        let owner;
        if(monitor.spriteName)owner=targets.find(t=>t.name===monitor.spriteName);
        if(!owner)owner=monitor.targetId?targets.find(t=>t.id===monitor.targetId):targets.find(t=>t.isStage);
        return receiver.globals.some(binding=>binding.id===monitor.id&&(!owner||binding.owner===owner));
    });
    const occurrence=mixedArrayCell?createArrayOccurrenceExportAuthority(project,(target,node,name)=>{
        const value=input(node,name,target);return singleArray(readInput(value))&&initialized(value);
    }):null;
    const live=()=>{
        if(!literalPrefixCurrent())return false;
        if(!privatePrefixCurrent())return false;
        const valid=ordinaryEntry.current()&&sourceStartReset.current()&&prefixResetCurrent()&&project.targets===targets&&snapshot()===original&&animationProducers.isCurrent()&&(!extendedResetUsed||effectMetadata()===originalEffects)&&snapshots.every(s=>s.target.blocks?.[s.id]===s.node&&s.node.inputs===s.inputs&&s.node.fields===s.fields&&s.node.mutation===s.mutation&&s.inputRows.every(([name,row,a,b])=>s.node.inputs?.[name]===row&&row?.[1]===a&&row?.[2]===b));
        if(privatePrefixUsed&&!valid)privatePrefixExpired=true;
        if(literalPrefixUsed&&!valid)literalPrefixExpired=true;
        return privatePrefixCurrent()&&valid&&conditionalCurrent()&&literalPrefixCurrent();
    };
    // Observe a newly used dependency before publishing the cached authority.
    // A later validation still observes it before any diagnostic early exit.
    sourceStartReset.current();prefixResetCurrent();literalPrefixCurrent();eventCopyPrefixCurrent();inertStorePrefixCurrent();
    return Object.freeze({spriteFlagWriters,validateInput(target,node,name='ARRAY'){
        try{
        if(!eventCopyPrefixCurrent())return {ok:false,reason:'requires the current inert event-copy prefix for a discounted Array reset'};
        if(!inertStorePrefixCurrent())return {ok:false,reason:'requires the current inert global-store prefix for a discounted Array reset'};
        if(!literalPrefixCurrent())return {ok:false,reason:'requires the current numeric-literal local prefix for a discounted Array reset'};
        if(!conditionalCurrent())return {ok:false,reason:'requires the current conditional source-entry Array frontier'};
        // Observe the used frame theorem before every diagnostic exit. A
        // prototype/reflection failure permanently expires this dependency.
        if(!sourceStartReset.current())return {ok:false,reason:'requires the current closed source-start effect proof for a discounted Array reset'};
        if(!nativeFrameReset.current())return {ok:false,reason:'requires the current native frame and activation frontier for a discounted Array reset'};
        if(!prefixResetCurrent())return {ok:false,reason:'requires the current owned parameter declaration prefix for a discounted Array reset'};
        // Observe retained occurrence facts before *any* diagnostic early exit.
        // A false/throw observation cannot revive after physical restoration.
        const protectedReceiver=protectedInput(target,node,name);
        const occurrenceCurrent=occurrence?(protectedReceiver?occurrence.observeSource():occurrence.observe()):false;
        if(protectedReceiver&&!occurrenceCurrent)return {ok:false,reason:'requires the current physical source context for a mixed global Array proof'};
        if(protectedReceiver){
            let writes;
            try{writes=monitorWrites(protectedReceiver);}
            catch(error){occurrence.expireSource();throw error;}
            // A monitor property/reflection trap may have edited source while
            // being observed. Recheck this new callback boundary before proof.
            if(!occurrence.observeSource())return {ok:false,reason:'requires the current physical source context for a mixed global Array proof'};
            if(writes)return {ok:false,reason:'an active monitor can write the actual mixed global Array binding'};
        }
        if(occurrence?.candidate(target,node,name)&&!occurrenceCurrent)return {ok:false,reason:'requires the current closed occurrence Array producer and complete writer proof'};
        // An unrelated-input query may also observe a source failure. Revoke
        // only after that real false/throw; do not add another observation.
        let current;try{current=live();if(summaryIssued&&effectMetadata()!==originalEffects){summaryExpired=true;if(protectedInputs.length)occurrence.expireSource();}}catch(error){summaryExpired=true;if(privatePrefixUsed)privatePrefixExpired=true;if(literalPrefixUsed)literalPrefixExpired=true;if(frameResetUsed)frameResetExpired=true;if(protectedInputs.length)occurrence.expireSource();throw error;}
        if(!current){summaryExpired=true;if(literalPrefixUsed)literalPrefixExpired=true;if(frameResetUsed)frameResetExpired=true;if(protectedInputs.length)occurrence.expireSource();}
        // Only a successfully discounted reset may retain this dependency.
        // False or thrown currentness expires it before any diagnostic exit.
        if(frameResetUsed&&frameResetExpired)current=false;
        // Existing metadata observers can run while live() is checked. Bind
        // the prefix again after them before consuming any cached reset fact.
        if(!prefixResetCurrent())return {ok:false,reason:'requires the current owned parameter declaration prefix for a discounted Array reset'};
        if(!literalPrefixCurrent())return {ok:false,reason:'requires the current numeric-literal local prefix for a discounted Array reset'};
        if(invalidGlobalBinding)return {ok:false,reason:'current variable name, ID, owner or writer schema does not agree'};
        if(!current||!nodes.get(target)||!owners.has(node)||invalid.has(node)||nodes.get(target).get(Object.keys(target.blocks||{}).find(id=>target.blocks[id]===node))!==node)return {ok:false,reason:'current target, input or connected graph changed'};
        if(!operationShape(node))return {ok:false,reason:'requires the exact supported current operation input schema'};
        // Compute the original result once. A genuine producer observer below
        // can change ambient ownership after the earlier metadata fence.
        // Recheck every retained reset dependency, including the private
        // identity-call prefix used by another receiver on this authority.
        // Its used flag keeps unrelated publications free of a new proof;
        // checking it last also covers observers in the other current checks.
        const publish=result=>result.ok&&!ordinaryEntry.current()?
            {ok:false,reason:'requires the current closed ordinary execution roots'}:result.ok&&!sourceStartReset.current()?
            {ok:false,reason:'requires the current closed source-start effect proof for a discounted Array reset'}:result.ok&&!nativeFrameReset.current()?
            {ok:false,reason:'requires the current native frame and activation frontier for a discounted Array reset'}:result.ok&&!prefixResetCurrent()?
            {ok:false,reason:'requires the current owned parameter declaration prefix for a discounted Array reset'}:result.ok&&!privatePrefixCurrent()?
            {ok:false,reason:'requires the current private identity-call prefix for a discounted Array reset'}:result.ok&&!conditionalCurrent()?
            {ok:false,reason:'requires the current conditional source-entry Array frontier'}:result.ok&&!literalPrefixCurrent()?
            {ok:false,reason:'requires the current numeric-literal local prefix for a discounted Array reset'}:result.ok&&!eventCopyPrefixCurrent()?
            {ok:false,reason:'requires the current inert event-copy prefix for a discounted Array reset'}:result.ok&&!inertStorePrefixCurrent()?
            {ok:false,reason:'requires the current inert global-store prefix for a discounted Array reset'}:result;
        if(deadOccurrence(target,node))return publish({ok:true});
        if(uncalledProcedureOccurrence(node))return publish({ok:true});
        if(ordinaryEntry.isUnreachable(target,node))return publish({ok:true});
        if(occurrence?.candidate(target,node,name))return publish(occurrence.validateInput(target,node,name)?{ok:true}:{ok:false,reason:'requires the current closed occurrence Array producer and complete writer proof'});
        const value=input(node,name,target),types=readInput(value);return publish(singleArray(types)&&initialized(value)?{ok:true}:{ok:false,reason:'requires an actual initialized Array producer and compatible all writers'});
        }catch(error){if(literalPrefixUsed)literalPrefixExpired=true;if(eventCopyPrefixUsed)eventCopyPrefixExpired=true;if(inertStorePrefixUsed)inertStorePrefixExpired=true;throw error;}
        finally{literalPrefixCurrent();eventCopyPrefixCurrent();inertStorePrefixCurrent();}
    }});
}
