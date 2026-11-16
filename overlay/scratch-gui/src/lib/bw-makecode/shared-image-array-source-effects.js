import {physicalUpdateSourceSnapshot} from './physical-update-source-snapshot.js';
import {analyseCallableBindings} from './callable-bindings.js';
import {staticSdkNamespaceReceivers} from './static-sdk-namespaces.js';
import {BUTTON_EVENTS} from './controller-button-event-number-source.js';
import {parseMakeCodeTs} from './ts-import.js';
import {STRING_ARRAY_SETTINGS_PATH,STRING_ARRAY_SETTINGS_SOURCE} from './string-array-settings.generated.js';
import {currentPreparedNativeSourceProvenance} from './dependency-project.js';
import {TEXT_SPRITE_SOURCE_TEXT,TEXT_SPRITE_INITIALIZER,TEXT_SPRITE_NATIVE_IDENTITY} from './text-source-admission.generated.js';

// Source provenance only. A scalar survives owned compiler copies, while every
// final effect/resource consumer must inspect its actual current occurrence.
export const sharedImageSourceOrigin = 'bwSharedImageArraySourceOrigin';
const preparations=new WeakMap(),contexts=new WeakMap(),combinedReturns=new WeakMap();let nextSourceOrigin=0;
const metadata=new Set(['originalBody','parameterDefaults','paramTypes','typeParameters','returnType','assertedType','bwProcedureConstraintSource','optionalParams','parameterProperties','sourceReferenceDeclarations','sourceCallableDeclarations','sourceScalarDeclarations']);
const descriptor=(node,key)=>Object.getOwnPropertyDescriptor(node,key);
function snapshot(root){
    const rows=[],seen=new Set(),active=new Set();let valid=true;
    const visit=value=>{
        if(!value||typeof value!=='object'){if(typeof value==='function')valid=false;return;}
        if(seen.has(value)){if(active.has(value))valid=false;return;}seen.add(value);active.add(value);
        const prototype=Object.getPrototypeOf(value);if(![Object.prototype,Array.prototype,null].includes(prototype)){valid=false;return;}
        const keys=Reflect.ownKeys(value),descriptors=[];
        for(const key of keys){const d=descriptor(value,key);if(!d||!Object.hasOwn(d,'value')){valid=false;continue;}descriptors.push(d);visit(d.value);}
        rows.push({value,prototype,keys,descriptors});active.delete(value);
    };
    try{visit(root);}catch{return null;}if(!valid)return null;
    let live=true;
    return ()=>{if(!live)return false;try{live=rows.every(row=>{const keys=Reflect.ownKeys(row.value);return Object.getPrototypeOf(row.value)===row.prototype&&keys.length===row.keys.length&&keys.every((key,index)=>{const d=descriptor(row.value,key),old=row.descriptors[index];return key===row.keys[index]&&d&&Object.hasOwn(d,'value')&&Object.is(d.value,old.value)&&d.enumerable===old.enumerable&&d.writable===old.writable&&d.configurable===old.configurable;});});}catch{live=false;}return live;};
}
function shapeEqual(a,b,seen=new Map(),reverse=new Map()){
    if(!a||typeof a!=='object'||!b||typeof b!=='object')return Object.is(a,b);
    if(seen.has(a))return seen.get(a)===b;if(reverse.has(b))return false;seen.set(a,b);reverse.set(b,a);
    if(Object.getPrototypeOf(a)!==Object.getPrototypeOf(b))return false;
    const keys=Reflect.ownKeys(a),other=Reflect.ownKeys(b);if(keys.length!==other.length)return false;
    return keys.every((key,index)=>{const x=descriptor(a,key),y=descriptor(b,key);return key===other[index]&&x&&y&&Object.hasOwn(x,'value')&&Object.hasOwn(y,'value')&&x.enumerable===y.enumerable&&x.writable===y.writable&&x.configurable===y.configurable&&shapeEqual(x.value,y.value,seen,reverse);});
}
function initializer(namespace){
    if(namespace?.type!=='Namespace'||namespace.name!=='SpriteKind'||!Array.isArray(namespace.body)||namespace.body.length!==1)return null;
    const statement=namespace.body[0];if(statement?.type!=='Declaration'||statement.kind!=='const'||statement.decls?.length!==1)return null;
    const decl=statement.decls[0],call=decl.init;if(decl.name!=='Text'||call?.type!=='Call'||call.isNew||call.constructorCall||Object.hasOwn(call,'typeArguments')||(!Array.isArray(call.args)||call.args.length!==0))return null;
    return call.callee?.type==='Member'&&call.callee.object?.type==='Identifier'&&call.callee.object.name==='SpriteKind'&&call.callee.name==='create'?call:null;
}
// Independently join the handed-off entries to this exact admitted file object.
// This reads data/JSON only; it does not call the source selector or parser again.
function orderedEntries(files){
    try{
        const config=JSON.parse(files['pxt.json']);if(!Array.isArray(config.files)||config.files.some(name=>typeof name!=='string')||config.testFiles!==undefined&&(!Array.isArray(config.testFiles)||config.testFiles.some(name=>typeof name!=='string')))return null;
        const names=[...new Set([...config.files,...(config.testFiles||[])])],order=names.filter(name=>name!=='main.ts'&&name!=='_onCodeStop.ts');
        if(names.includes('main.ts'))order.push('main.ts');if(names.includes('_onCodeStop.ts'))order.push('_onCodeStop.ts');
        const rows=[];for(const name of order){
            if(!/\.(ts|asm|py)$/.test(name))continue;
            if(config.fileDependencies&&Object.hasOwn(config.fileDependencies,name)||typeof files[name]!=='string')return null;
            if(name===STRING_ARRAY_SETTINGS_PATH&&files[name]===STRING_ARRAY_SETTINGS_SOURCE||/\.g\.ts$/.test(name))continue;
            if(/\.d\.ts$/.test(name)||!/\.ts$/.test(name))return null;
            rows.push({name,source:files[name].startsWith(STRING_ARRAY_SETTINGS_SOURCE+'\n')?files[name].slice(STRING_ARRAY_SETTINGS_SOURCE.length+1):files[name]});
        }return rows;
    }catch{return null;}
}
/** Only an existing private actual preparation can begin a source handoff. */
export function capturePreparedSharedImageSources(files,selectedSource){
    const receipt=currentPreparedNativeSourceProvenance(files),current=snapshot(selectedSource);if(!receipt||!current||selectedSource.diagnostics?.length||!Array.isArray(selectedSource.entries))return null;
    const ordered=orderedEntries(files);if(!ordered||ordered.length!==selectedSource.entries.length||ordered.some((entry,index)=>entry.name!==selectedSource.entries[index].name||entry.source!==selectedSource.entries[index].source)||selectedSource.source!==ordered.map(entry=>entry.source).join('\n;\n'))return null;
    const entries=receipt.entries.filter(row=>row.admission?.source===TEXT_SPRITE_NATIVE_IDENTITY&&row.originalSource===TEXT_SPRITE_SOURCE_TEXT&&row.replacementSource===TEXT_SPRITE_INITIALIZER&&typeof row.preparedPath==='string');
    if(entries.length!==1)return null;const admitted=entries[0],matches=selectedSource.entries.filter(entry=>entry.name===admitted.preparedPath&&entry.source===admitted.replacementSource);if(matches.length!==1)return null;
    const token=Object.freeze({});preparations.set(token,{files,receipt,selectedSource,admitted,entry:matches[0],current,observed:[]});return token;
}
/** The existing boundary parse executes here; callers cannot register an AST. */
export function parseSharedImageSourceBoundary(preparation,entry,namedFunctionExpressions=false){
    const p=preparations.get(preparation);
    const program=parseMakeCodeTs(entry.source,{parameterDefaults:true,namedFunctionExpressions});
    if(p&&p.current()&&p.selectedSource.entries.includes(entry)){
        p.observed.push({entry,program,current:snapshot(program)});
    }
    return program;
}
/** Same ordinary parse/options at its original call position, not another parse. */
export function parseSharedImageSourceProgram(preparation,source,retainCallableMetadata=false,retainPrimitiveProcedureDefaults=true,namedFunctionExpressions=false,retainAuthoredEmptyBranches=false){
    const program=parseMakeCodeTs(source,{parameterDefaults:true,retainParentheses:true,retainWhenUsed:true,
        retainClassHeritage:true,retainOrdinaryDefaultProvenance:true,
        retainCallableMetadata,retainPrimitiveProcedureDefaults,namedFunctionExpressions,retainAuthoredEmptyBranches});
    const p=preparations.get(preparation);
    if(p&&p.current()&&source===p.selectedSource.source&&typeof retainCallableMetadata==='boolean'&&retainPrimitiveProcedureDefaults===!retainCallableMetadata){
        combinedReturns.set(program,{preparation,current:snapshot(program)});
    }
    return program;
}
/** Run only after other source protocols declined, before owned clone passes. */
export function bindPreparedSharedImageSource(preparation,program){
    const p=preparations.get(preparation),parsed=combinedReturns.get(program);
    if(!p||parsed?.preparation!==preparation||!parsed.current||!parsed.current()||!p.current()||currentPreparedNativeSourceProvenance(p.files)!==p.receipt)return null;
    const entries=p.selectedSource.entries;if(p.observed.length!==entries.length||p.observed.some((row,index)=>row.entry!==entries[index]||!row.current||!row.current()||row.program?.type!=='Program'||!Array.isArray(row.program.body)))return null;
    let offset=0,selected=null,total=0;
    for(const row of p.observed){if(row.entry===p.entry)selected={row,offset};offset+=row.program.body.length;}total=offset;
    if(!selected||selected.offset!==0||program?.type!=='Program'||!Array.isArray(program.body)||program.body.length!==total||selected.row.program.body.length!==1)return null;
    const expected=selected.row.program.body[0],actual=program.body[selected.offset];if(!shapeEqual(expected,actual)||!initializer(expected))return null;
    const call=initializer(actual);if(!call||!Object.isExtensible(call))return null;
    // A caller's existing carrier is never overwritten or adopted.
    const pending=[program],seen=new Set();let initializerCount=0;while(pending.length){const node=pending.pop();if(!node||typeof node!=='object'||seen.has(node))continue;seen.add(node);if(initializer(node))initializerCount++;if(Object.hasOwn(node,sharedImageSourceOrigin))return null;for(const key of Reflect.ownKeys(node)){const d=descriptor(node,key);if(d&&Object.hasOwn(d,'value'))pending.push(d.value);}}
    if(initializerCount!==1||nextSourceOrigin>=Number.MAX_SAFE_INTEGER)return null;
    const origin=++nextSourceOrigin;Object.defineProperty(call,sharedImageSourceOrigin,{value:origin,enumerable:true,writable:true,configurable:true});
    const inputCurrent=snapshot(program);if(!inputCurrent){delete call[sharedImageSourceOrigin];return null;}
    const context=Object.freeze({});contexts.set(context,{p,origin,inputCurrent,expired:false});return context;
}
/** Fresh physical final-node lookup, never a transferred old node fact. */
export function currentSharedImageSourceEffects(program,context){
    const c=contexts.get(context);if(!c||!sharedImageSourceContextCurrent(context))return null;
    const nodes=[],parents=new WeakMap(),seen=new Set();let valid=true;
    const visit=(node,parent=null)=>{
        if(!node||typeof node!=='object'){if(typeof node==='function')valid=false;return;}if(seen.has(node)){valid=false;return;}seen.add(node);
        const prototype=Object.getPrototypeOf(node);if(prototype!==Object.prototype&&prototype!==Array.prototype){valid=false;return;}
        parents.set(node,parent);if(!Array.isArray(node))nodes.push(node);
        for(const key of Reflect.ownKeys(node)){const d=descriptor(node,key);if(!d||!Object.hasOwn(d,'value')){valid=false;continue;}if(!metadata.has(key))visit(d.value,node);}
    };
    try{visit(program);}catch{return null;}if(!valid)return null;
    const carriers=nodes.filter(node=>Object.hasOwn(node,sharedImageSourceOrigin));if(carriers.length!==1||carriers[0][sharedImageSourceOrigin]!==c.origin)return null;
    const call=carriers[0],decl=parents.get(call),decls=parents.get(decl),statement=parents.get(decls);
    if(call.type!=='Call'||call.isNew||call.constructorCall||Object.hasOwn(call,'typeArguments')||(!Array.isArray(call.args)||call.args.length!==0)||call.callee?.type!=='Member'||call.callee.object?.type!=='Identifier'||call.callee.object.name!=='SpriteKind'||call.callee.name!=='create')return null;
    if(decl?.init!==call||decl.spriteKindName!=='Text'||decl.assetPath!=='SpriteKind.Text'||statement?.type!=='Declaration'||statement.kind!=='const'||!Array.isArray(program.body)||!program.body.some(row=>row===statement))return null;
    if(program.body.filter(row=>row.type!=='FunctionDeclaration'&&row.type!=='SpriteKindReset')[0]!==statement)return null;
    return Object.freeze({initializer:call});
}

/** Original data/currentness obligations, without calling a guest or reminting. */
export function sharedImageSourceContextCurrent(context){
    const c=contexts.get(context);if(!c||c.expired)return false;
    if(!c.inputCurrent()||!c.p.current()||currentPreparedNativeSourceProvenance(c.p.files)!==c.p.receipt||!c.p.observed.every(row=>row.current()))c.expired=true;
    return !c.expired;
}

// Entry-only non-interference profiles. They do not add an API to F's global
// effect domain and expose no Buffer, callback, Image or Number value facts.
// Every facade is derived here from actual current syntax/private provenance;
// there is no registration of caller-made nodes, predicates or allow tables.
// Existing graph helpers use ordinary Array iteration/methods. Constrain only
// this optional slice before invoking them; preserve the parser's three hidden
// params channels and reject holes/null prototypes or caller method shadows.
export function sharedImageEntryArrayDomain(root) {
    const seen=new Set();let valid=true;
    const visit=value=>{
        if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);
        const keys=Reflect.ownKeys(value);
        if(Array.isArray(value)) {
            if(Object.getPrototypeOf(value)!==Array.prototype){valid=false;return;}
            const length=descriptor(value,'length');if(!length||!Object.hasOwn(length,'value')){valid=false;return;}
            let count=0;
            for(const key of keys) {
                if(typeof key==='string'&&/^(0|[1-9][0-9]*)$/.test(key)&&Number(key)<length.value){count++;continue;}
                if(key!=='length'&&!['optionalParams','parameterDefaults','parameterProperties'].includes(key)){valid=false;return;}
            }
            if(count!==length.value){valid=false;return;}
        }
        for(const key of keys){const d=descriptor(value,key);if(!d||!Object.hasOwn(d,'value')){valid=false;continue;}visit(d.value);}
    };
    try{visit(root);}catch{return false;}return valid;
}
// These parser metadata roles are read by entry/lexical/value helpers even
// though they are not executable edges. Their consumed data cannot be opaque.
const entryMetadataArrays=new Set(['optionalParams','parameterDefaults','typeParameters','originalBody','parameterProperties']);
const entryMetadataData=new Set([...entryMetadataArrays,'paramTypes','returnType','assertedType']);
function entryMetadataValue(key,value) {
    if(value===null||value===undefined)return true;
    if(entryMetadataArrays.has(key)&&!Array.isArray(value))return false;
    if(key==='paramTypes'&&(typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))))return false;
    const seen=new Set();
    const data=node=>{
        if(typeof node==='function'||typeof node==='bigint')return false;
        if(!node||typeof node!=='object'||seen.has(node))return true;seen.add(node);
        return Reflect.ownKeys(node).every(name=>{const d=descriptor(node,name);return d&&Object.hasOwn(d,'value')&&data(d.value);});
    };
    return data(value);
}
const entryProfiles=new WeakMap();
export function prepareSharedImageEntryEffects(program,sourceContext=null) {
    // This optional observer retains opaque identities but derives no facts from
    // their behavior. The stricter source-origin snapshot above is unchanged.
    let observed;try{observed=physicalUpdateSourceSnapshot(program);}catch{return null;}
    if(!observed||!sharedImageEntryArrayDomain(program))return null;
    // Helpers may serialize default callback bodies. Nothing under the actual
    // executable body, including its metadata, may hide a live host function.
    const body=program&&typeof program==='object'?descriptor(program,'body'):null;
    if(!body||!Object.hasOwn(body,'value')||!Array.isArray(body.value)||!entryMetadataValue('originalBody',body.value))return null;
    // The graph's throw path serializes the whole Program for completion
    // currentness, including otherwise ignored metadata. Match its all-object
    // tag census and refuse opaque functions there before invoking the graph.
    if(observed.objects.some(node=>descriptor(node,'type')?.value==='ThrowStatement')&&!entryMetadataValue('program',program))return null;
    const current=observed.current;
    const nodes=[],parents=new WeakMap(),seen=new Set();let valid=true;
    const visit=(value,parent=null)=>{
        if(typeof value==='function'){valid=false;return;}
        if(!value||typeof value!=='object')return;
        if(seen.has(value)){valid=false;return;}seen.add(value);
        if(!Array.isArray(value)){nodes.push(value);parents.set(value,parent);}
        for(const key of Reflect.ownKeys(value)) {
            const field=descriptor(value,key).value;
            if(metadata.has(key)){if(entryMetadataData.has(key)&&!entryMetadataValue(key,field))valid=false;continue;}
            visit(field,value);
        }
    };
    visit(program);if(!valid||program?.type!=='Program')return null;
    const text=sourceContext?currentSharedImageSourceEffects(program,sourceContext):null;
    if(sourceContext&&!text)return null;
    const sdk=staticSdkNamespaceReceivers(program,{builtinIdentifiers:text?['Math','textsprite']:['Math']});
    const lexical=analyseCallableBindings(program),writers=new Map();
    const add=(binding,value)=>{if(binding){if(!writers.has(binding))writers.set(binding,[]);writers.get(binding).push(value);}};
    const path=node=>node?.type==='Identifier'?node.name:node?.type==='Member'?`${path(node.object)}.${node.name}`:null;
    for(const node of nodes) {
        if(node.type==='Declaration')for(const d of node.decls) {
            if(node.kind==='let'&&Object.hasOwn(d,'init')&&d.init===null)continue;
            add(lexical.scopes.get(node)?.names.get(d.name),d.init);
        }
        if(node.type==='Assignment'&&node.left?.type==='Identifier')add(lexical.references.get(node.left),node.op==='='?node.right:null);
        if(node.type==='Update'&&node.argument?.type==='Identifier')add(lexical.references.get(node.argument),null);
        let target=node.type==='Assignment'?node.left:node.type==='Update'?node.argument:node.type==='Unary'&&node.op==='delete'?node.argument:null;
        while(target?.type==='Member'||target?.type==='Index')target=target.object;
        if(target&&sdk.has(target))return null;
        if(node.type==='Identifier'&&sdk.has(node)) {
            const parent=parents.get(node);if(parent?.type!=='Member'||parent.object!==node)return null;
        }
    }
    const textReceiver=(node,active=new Set())=>{
        if(node?.type==='Null'||node?.type==='Undefined')return 'absent';
        if(node?.type==='Call'&&text&&sdk.has(node.callee)&&path(node.callee)==='textsprite.create')return 'text';
        if(node?.type!=='Identifier')return null;
        const binding=lexical.references.get(node),values=writers.get(binding);if(!values?.length||active.has(binding))return null;
        const next=new Set(active);next.add(binding);const kinds=new Set(values.map(value=>textReceiver(value,next)));kinds.delete('absent');
        return kinds.size===1&&kinds.has('text')?'text':null;
    };
    const calls=new WeakMap(),lifecycleCalls=new WeakMap(),leaves=new WeakSet(),writes=new WeakSet();
    const gameOverCall=node=>node?.type==='Call'&&!node.isNew&&!node.constructorCall&&!Object.hasOwn(node,'typeArguments')&&
        Array.isArray(node.args)&&node.args.length===1&&node.args[0]?.type==='Boolean'&&
        typeof descriptor(node.args[0],'value')?.value==='boolean';
    const simple=new Map([['image.setPalette',1],['scene.setBackgroundImage',1],['scene.setBackgroundColor',1],
        ['info.setScore',1],['info.changeScoreBy',1],['info.score',0]]);
    const textMethods=new Set(['setFlag','setText','setIcon','setBorder','setMaxFontHeight','update','setPosition']);
    const registrations=new Map([['info.onCountdownEnd',[1,0]],['sprites.onOverlap',[3,2]],
        ['controller.A.onEvent',[2,1]]]);
    const fieldPaths=new Set(['SpriteFlag.RelativeToCamera','SpriteKind.Player','SpriteKind.Projectile',
        'music.PlaybackMode.UntilDone','music.PlaybackMode.InBackground','music.PlaybackMode.LoopingInBackground']);
    const readonlyMethods=new Set([...simple.keys(),...registrations.keys(),'info.showScore','Buffer.fromHex','textsprite.create','SpriteKind.create','Math.round','music.play','game.gameOver']);
    for(const node of nodes) {
        if(node.type==='Member'&&sdk.has(node)&&fieldPaths.has(path(node)))leaves.add(node);
        if(node.type==='Member'&&sdk.has(node)) {
            const parent=parents.get(node);
            if(!(parent?.type==='Member'&&parent.object===node)&&!(parent?.type==='Call'&&parent.callee===node)&&!fieldPaths.has(path(node)))return null;
        }
        if(node.type==='Member'&&textMethods.has(node.name)&&textReceiver(node.object)==='text') {
            const parent=parents.get(node);if(parent?.type!=='Call'||parent.callee!==node)return null;
        }
        if(node.type==='Assignment'&&node.op==='='&&node.left?.type==='Member'&&
            ['left','right','top','bottom'].includes(node.left.name)&&textReceiver(node.left.object)==='text')writes.add(node);
        if(node.type==='Member'&&sdk.has(node)&&readonlyMethods.has(path(node))) {
            const parent=parents.get(node);if(parent?.type!=='Call'||parent.callee!==node)return null;
            if(path(node)==='game.gameOver'&&!gameOverCall(parent))return null;
        }
        if(node.type!=='Call'||node.isNew||node.constructorCall||Object.hasOwn(node,'typeArguments')||!Array.isArray(node.args)||node.callee?.type!=='Member')continue;
        const api=path(node.callee);let effect=null;
        if(sdk.has(node.callee)) {
            // This lifecycle command may return, yield, enter scene callbacks
            // and restart. Only F can consume its local canonical codec fact.
            // Never put it in calls: ordinary Image-entry traversal must stop.
            if(api==='game.gameOver'&&gameOverCall(node))
                lifecycleCalls.set(node,Object.freeze({sharedSdkCallEffect:'game-over-lifecycle'}));
            if(simple.get(api)===node.args.length)effect={kind:'disjoint'};
            if(api==='SpriteKind.create'&&!node.args.length)effect={kind:'kind-allocation'};
            if(api==='Math.round'&&node.args.length===1)effect={kind:'round'};
            // Current native bufferFromHex -> fromHex accepts a primitive text,
            // constructs owned byte storage and registers it; it cannot call
            // project code or acquire an ordinary Image Array from this literal.
            // No validity/Buffer producer or global F permission follows.
            if(api==='Buffer.fromHex'&&node.args.length===1&&node.args[0]?.type==='String') {
                const value=descriptor(node.args[0],'value');
                if(value&&Object.hasOwn(value,'value')&&typeof value.value==='string'&&value.value.length<=2097153&&/^[0-9a-f]*$/i.test(value.value))
                    effect={kind:'disjoint-literal-buffer',sharedSdkCallEffect:'literal-buffer'};
            }
            if(api==='info.showScore'&&node.args.length===1&&node.args[0]?.type==='Boolean') {
                const value=descriptor(node.args[0],'value');
                if(value&&Object.hasOwn(value,'value')&&typeof value.value==='boolean')
                    effect={kind:'disjoint',scoreHudVisibility:true,sharedSdkCallEffect:'score-hud'};
            }
            if(api==='textsprite.create'&&text&&node.args.length>=1&&node.args.length<=3)effect={kind:'private-text'};
            // music.play may yield and enter a stored callback. Its existing F
            // command permission does not make a captured entry state stable.
            const registration=registrations.get(api);
            if(registration&&node.args.length===registration[0]&&node.args[registration[1]]?.type==='FunctionExpression') {
                const other=node.args.filter((_arg,index)=>index!==registration[1]);
                if(api!=='controller.A.onEvent'||other[0]?.type==='Number'&&['string','number'].includes(typeof other[0].value)&&!(typeof other[0].value==='string'&&!other[0].value.trim())&&Number.isInteger(Number(other[0].value)))
                    effect={kind:'registration',callbackIndex:registration[1]};
                // An internal entry boundary only: never an incoming Sprite or
                // handler value fact. The consumer still proves every writer,
                // alias and all possible entries of its exact clone call.
                const fn=node.args[registration[1]];
                if(effect&&api==='controller.A.onEvent') {
                    const event=descriptor(node.args[0],'value');
                    const emptyArray=(owner,key)=>{const d=descriptor(owner,key);return !d||Object.hasOwn(d,'value')&&Array.isArray(d.value)&&d.value.length===0;};
                    const emptyObject=(owner,key)=>{const d=descriptor(owner,key);return !d||Object.hasOwn(d,'value')&&d.value&&typeof d.value==='object'&&!Array.isArray(d.value)&&Reflect.ownKeys(d.value).length===0;};
                    const primitive=event&&Object.hasOwn(event,'value')&&['number','string'].includes(typeof event.value)&&!(typeof event.value==='string'&&!event.value.trim());
                    const code=primitive?Number(event.value):NaN;
                    if(Number.isInteger(code)&&Object.values(BUTTON_EVENTS).includes(code)&&Array.isArray(fn.params)&&fn.params.length===0&&Array.isArray(fn.body)&&
                        ['optionalParams','parameterDefaults','parameterProperties','typeParameters','genericParams'].every(key=>emptyArray(fn,key))&&
                        ['optionalParams','parameterDefaults','parameterProperties'].every(key=>emptyArray(fn.params,key))&&
                        emptyObject(fn,'paramTypes')&&emptyObject(fn,'paramDefaults')&&!Object.hasOwn(fn,'restParam'))
                        effect={...effect,sharedSdkCallEffect:'button-A-registration'};
                }
                if(effect&&api==='sprites.onOverlap'&&Array.isArray(fn.params)&&fn.params.length===2&&new Set(fn.params).size===2&&
                    fn.params.every(name=>typeof name==='string')&&!fn.optionalParams?.length&&!fn.parameterDefaults?.length&&!fn.parameterProperties?.length&&
                    !fn.typeParameters?.length&&!fn.genericParams?.length&&!fn.restParam&&
                    !fn.params.optionalParams?.length&&!fn.params.parameterDefaults?.length&&!fn.params.parameterProperties?.length&&
                    !Object.keys(fn.paramDefaults||{}).length)effect={...effect,imageInvariantBoundary:true};
            }
        } else if(textMethods.has(node.callee.name)&&textReceiver(node.callee.object)==='text')effect={kind:'disjoint-text'};
        if(effect)calls.set(node,Object.freeze(effect));
    }
    const facade=Object.freeze({});entryProfiles.set(facade,{program,sourceContext,current,calls,lifecycleCalls,leaves,writes,expired:false});return facade;
}
export function currentSharedImageEntryEffect(program,facade,node,kind='call') {
    const p=entryProfiles.get(facade);if(!p||p.program!==program||p.expired)return null;
    if(!p.current()||p.sourceContext&&!sharedImageSourceContextCurrent(p.sourceContext)){p.expired=true;return null;}
    return kind==='current'?true:kind==='leaf'?p.leaves.has(node):kind==='write'?p.writes.has(node):p.calls.get(node)||null;
}

// A lookup is valid only while the synchronous internal derivation is running.
// No callback supplies facts; before/after checks discard an interrupted or
// mutated derivation. Retained lookups cannot bypass the public sticky fence.
export function consumeSharedImageEntryEffects(program,sourceContext,consume) {
    const facade=prepareSharedImageEntryEffects(program,sourceContext);
    if(!facade||!currentSharedImageEntryEffect(program,facade,program,'current'))return null;
    const p=entryProfiles.get(facade);let active=true;
    const lookup=(node,kind='call')=>!active?null:kind==='leaf'?p.leaves.has(node):kind==='write'?p.writes.has(node):kind==='f-lifecycle'?p.lifecycleCalls.get(node)||null:p.calls.get(node)||null;
    const current=()=>!!currentSharedImageEntryEffect(program,facade,program,'current');
    let result;try{result=consume(lookup,current);}finally{active=false;}
    return current()?result:null;
}


// Local canonical-callee/codec/registration profiles, not standalone callback
// body or backing-Array nonexposure proofs. Only the complete F body/reference/
// writer/entry census can authorize a resource. Requests identify physical calls,
// never supplied facts; one private consume window serves the whole SDK batch.
function sharedSdkCallEffect(program,sourceContext,requests,scoreOnly=false) {
    try {return consumeSharedImageEntryEffects(program,sourceContext,(lookup,observedCurrent)=>{
        let expired=false;
        const current=()=>{
            if(expired)return false;
            try {if(!observedCurrent())expired=true;}catch(error){expired=true;throw error;}
            return !expired;
        };
        if(!current())return null;
        const calls=new WeakSet();
        if(scoreOnly) {
            // Legacy HUD query retains its narrow surface and physical identity.
            const visit=value=>{
                if(!value||typeof value!=='object')return;
                if(lookup(value)?.sharedSdkCallEffect==='score-hud')calls.add(value);
                for(const key of Reflect.ownKeys(value))if(!metadata.has(key))visit(descriptor(value,key).value);
            };
            visit(program);
        } else {
            if(!Array.isArray(requests))return null;
            const length=descriptor(requests,'length');if(!length||!Object.hasOwn(length,'value'))return null;
            for(let i=0;i<length.value;i++) {
                const request=descriptor(requests,String(i));if(!request||!Object.hasOwn(request,'value'))return null;
                const node=request.value,tag=(lookup(node)||lookup(node,'f-lifecycle'))?.sharedSdkCallEffect;
                if(!['score-hud','literal-buffer','button-A-registration','game-over-lifecycle'].includes(tag))return null;
                calls.add(node);
            }
        }
        if(!current())return null;
        return Object.freeze({current,has:call=>current()&&calls.has(call)});
    });}catch{return null;} // No certificate escapes an unsupported derivation.
}
// HUD/state/timers/redraw, Buffer allocation/errors, and deferred button
// registration/dispatch and game-over scene/yield/restart remain ordered.
// The lifecycle-only map grants no entry traversal. The local profile
// cannot waive unknown callback bodies, capture/escape checks or entry barriers,
// and grants neither callback/value domains nor Array/resource authority.
export function sourceSharedImageSdkCallEffects(program,sourceContext,requests) {
    return sharedSdkCallEffect(program,sourceContext,requests);
}
export function sourceScoreHudVisibilityNonExposure(program,sourceContext=null) {
    return sharedSdkCallEffect(program,sourceContext,null,true);
}


// F-only exact-call non-exposure. This issues no Sprite value/kind or callback
// signature. The incoming event identity is usable only inside its actual
// registration activation, after a physically dominating alias assignment.
export function sourceOverlapDestroyNonExposure(program,sourceContext=null) {
    const profile=prepareSharedImageEntryEffects(program,sourceContext);
    if(!profile||!currentSharedImageEntryEffect(program,profile,program,'current'))return null;
    const nodes=[],parents=new WeakMap(),owners=new WeakMap();
    const visit=(value,parent=null,owner=program)=>{
        if(!value||typeof value!=='object')return;
        parents.set(value,parent);owners.set(value,owner);if(!Array.isArray(value))nodes.push(value);
        for(const key of Reflect.ownKeys(value))if(!metadata.has(key))
            visit(descriptor(value,key).value,value,['FunctionDeclaration','FunctionExpression'].includes(value.type)&&key==='body'?value:owner);
    };
    visit(program);
    const lexical=analyseCallableBindings(program),sdk=staticSdkNamespaceReceivers(program);
    const path=node=>node?.type==='Identifier'?node.name:node?.type==='Member'?`${path(node.object)}.${node.name}`:null;
    const plainCall=node=>node?.type==='Call'&&!node.isNew&&!node.constructorCall&&!Object.hasOwn(node,'typeArguments')&&Array.isArray(node.args);
    // No destroyed callback graph is interpreted as harmless. Destroy remains
    // a reentry barrier for the separate Image entry walk, even in this slice.
    if(nodes.some(node=>node.type==='Class'||node.type==='Member'&&node.name==='onDestroyed'))return null;
    const callbacks=new Set(),registrations=new Map(),parameters=new Map(),writers=new Map(),callers=new Map(),escaped=new Set(),mutated=new Set(),declarations=new Map(),functionBindings=new WeakMap();
    const add=(binding,row)=>{if(binding){if(!writers.has(binding))writers.set(binding,[]);writers.get(binding).push(row);}};
    const declare=(binding,node)=>{if(binding){if(!declarations.has(binding))declarations.set(binding,new Set());declarations.get(binding).add(node);}};
    for(const node of nodes) {
        if(node.type==='Call'&&sdk.has(node.callee)&&path(node.callee)==='sprites.onOverlap'&&plainCall(node)&&node.args.length===3) {
            const fn=node.args[2];
            if(fn?.type!=='FunctionExpression'||!Array.isArray(fn.params)||fn.params.length!==2||new Set(fn.params).size!==2||fn.params.some(name=>typeof name!=='string')||fn.optionalParams?.length||fn.parameterDefaults?.length||fn.typeParameters?.length||fn.genericParams?.length||fn.restParam||fn.params.optionalParams?.length||fn.params.parameterDefaults?.length||fn.params.parameterProperties?.length||Object.keys(fn.paramDefaults||{}).length)continue;
            const scope=lexical.scopes.get(fn);if(!scope)continue;
            callbacks.add(fn);registrations.set(fn,node);for(const name of fn.params){const binding=scope.names.get(name);if(binding&&!binding.written)parameters.set(binding,fn);}
        }
        if(node.type==='Declaration')for(const decl of node.decls) {
            const binding=lexical.scopes.get(node)?.names.get(decl.name);declare(binding,decl);
            // Preserve absence as absence; neither this nor Null creates an event.
            if(node.kind==='let'&&Object.hasOwn(decl,'init')&&decl.init===null)continue;
            add(binding,{node,value:decl.init,owner:owners.get(node)});
        }
        if(node.type==='FunctionDeclaration') {
            const binding=lexical.scopes.get(node)?.parent?.names.get(node.name);declare(binding,node);functionBindings.set(node,binding);
        }
        if(node.type==='ForOf')declare(lexical.scopes.get(node)?.names.get(node.name),node);
        if(node.type==='SpriteKindReset') {
            let scope=lexical.scopes.get(node);while(scope&&!scope.names.has(node.name))scope=scope.parent;
            // A reset is a real write, never an event-origin producer.
            add(scope?.names.get(node.name),{node,value:null,owner:owners.get(node)});
        }
        if(node.type==='Assignment'&&node.left?.type==='Identifier')add(lexical.references.get(node.left),{node,value:node.op==='='?node.right:null,owner:owners.get(node)});
        if(node.type==='Update'&&node.argument?.type==='Identifier')add(lexical.references.get(node.argument),{node,value:null,owner:owners.get(node)});
        if(node.type==='Assignment'||node.type==='Update'||node.type==='Unary'&&node.op==='delete') {
            let target=node.type==='Assignment'?node.left:node.argument;
            if(target?.type==='Member'||target?.type==='Index') {
                while(target?.type==='Member'||target?.type==='Index')target=target.object;
                if(target?.type==='Identifier')mutated.add(lexical.references.get(target));
            }
        }
        if(node.type==='Identifier') {
            const binding=lexical.references.get(node);
            if(binding?.kind==='function') {
                const call=parents.get(node);
                if(!plainCall(call)||call.callee!==node||binding.written)escaped.add(binding.node);
                else {if(!callers.has(binding.node))callers.set(binding.node,[]);callers.get(binding.node).push(call);}
            }
        }
    }
    // The same exact SDK registration must not be extracted as a value.
    for(const node of nodes)if(node.type==='Member'&&sdk.has(node)&&path(node)==='sprites.onOverlap') {
        const call=parents.get(node);if(!plainCall(call)||call.callee!==node||call.args.length!==3||!callbacks.has(call.args[2]))return null;
    }
    const position=(node,fn)=>{
        const body=fn===program?program.body:fn.body;let child=node;
        while(child&&parents.get(child)!==body)child=parents.get(child);
        return child&&Array.isArray(body)?body.indexOf(child):-1;
    };
    const directPosition=(node,fn)=>{
        let statement=node;
        if(node.type!=='Declaration'){statement=parents.get(node);if(statement?.type!=='ExpressionStatement'||statement.expr!==node)return -1;}
        const body=fn===program?program.body:fn.body;
        return parents.get(statement)===body?body.indexOf(statement):-1;
    };
    // Enumerate every immutable direct call entry; cycles, ordinary root uses,
    // escaped procedures and unknown callback roots cannot borrow an event.
    const uniqueFunction=fn=>{const binding=functionBindings.get(fn);return binding?.kind==='function'&&binding.node===fn&&declarations.get(binding)?.size===1;};
    const closedProcedure=fn=>fn?.type==='FunctionDeclaration'&&Array.isArray(fn.params)&&fn.params.length===0&&
        !fn.optionalParams?.length&&!fn.parameterDefaults?.length&&!fn.typeParameters?.length&&!fn.genericParams?.length&&!fn.restParam&&
        !fn.params.optionalParams?.length&&!fn.params.parameterDefaults?.length&&!fn.params.parameterProperties?.length&&
        !Object.keys(fn.paramDefaults||{}).length;

    const entries=(fn,active=new Set())=>{
        if(fn===program)return [{root:program,first:null}];
        if(callbacks.has(fn))return [{root:fn,first:null}];
        if(!closedProcedure(fn)||!uniqueFunction(fn)||escaped.has(fn)||active.has(fn)||!callers.get(fn)?.length)return null;
        const next=new Set(active);next.add(fn);const out=[];
        for(const call of callers.get(fn)) {
            if(call.args.length!==0)return null;
            const parent=owners.get(call),roots=entries(parent,next);if(!roots)return null;
            for(const root of roots)out.push({root:root.root,first:root.first||call});
        }
        return out.length<=10000?out:null;
    };
    const singleStartup=(fn,active=new Set())=>{
        if(fn===program)return true;
        if(!closedProcedure(fn)||!uniqueFunction(fn)||escaped.has(fn)||active.has(fn)||callers.get(fn)?.length!==1)return false;
        const call=callers.get(fn)[0],owner=owners.get(call),next=new Set(active);next.add(fn);
        return call.args.length===0&&directPosition(call,owner)>=0&&singleStartup(owner,next);
    };
    const beforeRegistration=(write,callback)=>{
        if(!singleStartup(write.owner)||directPosition(write.node,write.owner)<0)return false;
        const seen=new Set();let node=registrations.get(callback),owner=owners.get(node);
        while(owner!==write.owner){
            if(!owner||owner===program||!closedProcedure(owner)||!uniqueFunction(owner)||escaped.has(owner)||seen.has(owner)||callers.get(owner)?.length!==1)return false;
            seen.add(owner);node=callers.get(owner)[0];owner=owners.get(node);
            if(node.args.length!==0||directPosition(node,owner)<0)return false;
        }
        return directPosition(write.node,owner)<position(node,owner);
    };
    const origin=(node,use=node,active=new Set())=>{
        if(node?.type!=='Identifier')return null;
        const binding=lexical.references.get(node);if(!binding||mutated.has(binding)||active.has(binding))return null;
        if(parameters.has(binding))return !declarations.get(binding)?.size&&!writers.get(binding)?.length?[{callback:parameters.get(binding),write:null}]:null;
        if(declarations.get(binding)?.size!==1)return null;
        const values=writers.get(binding);if(!values?.length)return null;
        const next=new Set(active);next.add(binding);const live=values.filter(row=>!['Null','Undefined'].includes(row.value?.type));
        if(!live.length)return null;
        const result=[];
        for(const row of live) {
            if(!row.value||row.value.type!=='Identifier')return null;
            const prior=origin(row.value,row.node,next);if(!prior)return null;
            for(const token of prior) {
                const callback=token.callback,index=directPosition(row.node,callback);
                if(index<0)return null;
                if(binding.functionOwner===lexical.scopes.get(callback)) {
                    const read=position(use,callback);if(read<0||index>=read)return null;
                    if(values.some(other=>other!==row&&directPosition(other.node,callback)>=index))return null;
                    result.push(token);
                }else if(binding.scope.kind==='global') {
                    if(values.some(other=>other!==row&&['Null','Undefined'].includes(other.value?.type)&&!beforeRegistration(other,callback)))return null;
                    result.push({callback,write:row.node});
                }else return null;
            }
        }
        return result;
    };
    for(const member of nodes)if(member.type==='Member'&&member.name==='destroy'&&origin(member.object)) {
        const call=parents.get(member);if(!plainCall(call)||call.callee!==member)return null;
    }
    const accepted=new WeakSet();
    for(const call of nodes) {
        if(!plainCall(call)||call.args.length||call.callee?.type!=='Member'||call.callee.name!=='destroy')continue;
        const tokens=origin(call.callee.object);if(!tokens?.length)continue;
        const roots=entries(owners.get(call));if(!roots?.length||roots.some(row=>!callbacks.has(row.root)))continue;
        if(roots.every(row=>tokens.some(token=>token.callback===row.root&&(!token.write||directPosition(token.write,row.root)>=0&&directPosition(token.write,row.root)<position(row.first||call,row.root)))))accepted.add(call);
    }
    if(!currentSharedImageEntryEffect(program,profile,program,'current'))return null;
    return Object.freeze({has(node){return !!currentSharedImageEntryEffect(program,profile,program,'current')&&accepted.has(node);}});
}
