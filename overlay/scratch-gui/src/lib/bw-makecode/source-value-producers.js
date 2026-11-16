import {highScoreIntrinsic} from './high-score-source.js';
import {proveLocalArrayFamilyReads,proveLocalNumericArrayResults,hasLocalNumericArrayResultCandidate} from './local-array-family-entry.js';
import {inspectNativeArrayAddHelpers} from './native-array-binary-helper-source.js';
import {createOrdinaryFrameDeltaNumberSource} from './ordinary-frame-delta-number-source.js';
import {createOrdinaryParseIntegerNumberSource} from './ordinary-parse-integer-number-source.js';
import {createSourceControlCellEntry} from './source-control-cell-entry.js';
import {createClosedOrdinarySourceEntry} from './closed-ordinary-source-entry.js';
import {nullableArrayLengthSource} from './nullable-array-length-source.js';
import {lexicalDeclarationReadiness} from './lexical-declaration-readiness.js';
import {constraints} from './ordinary-procedure-constraint-metadata.js';
import {CAMERA_PROPERTIES} from './camera-property-constants.js';
import {declarationIdentityInput} from './declaration-identity-input.js';
import {consumeSharedImageEntryEffects,sharedImageEntryArrayDomain} from './shared-image-array-source-effects.js';
import {parseExactImgLiteral} from './arcade-assets.js';
import {proveDenseArrayLoopEntries} from './dense-array-loop-entry.js';
import {prepareObjectClassStructure} from './object-class-source-structure.js';
import {physicalUpdateSourceSnapshot} from './physical-update-source-snapshot.js';
import {analyseSourceNormalCompletion,sourceNormalCompletionFor} from './source-normal-completion.js';
import {multiplayerPlayerSourceCalls} from './multiplayer-player-source.js';
import {staticSdkNamespaceReceivers} from './static-sdk-namespaces.js';
import {consoleInspectSourceCalls} from './console-inspect-source.js';
import {SDK_FONT_FIELDS} from './sdk-font-value-descriptors.js';
import {ordinaryPlayerScoreNumberCalls,ordinaryCameraPropertyNumberLeaves,ordinaryNumberFormatNumberLeaves,ordinaryMathNumberCalls,ordinarySceneBackgroundNumberCalls} from './ordinary-primitive-sdk-number-source.js';
import {ordinarySceneClockNumberCalls} from './ordinary-scene-clock-number-source.js';
import {createOrdinaryMusicNumberSource} from './ordinary-music-number-source.js';
import {createDestroyedSpriteCallbackNumberSource} from './destroyed-sprite-callback-number-source.js';
import {localArrayDeclarationResetSource} from './local-array-declaration-reset-source.js';
import {isRuntimeDispatchAddDeclaration} from './native-array-binary-helper-source.js';
import {createStringCharCodeNumberSource} from './string-char-code-number-source.js';
import {BUTTON_EVENTS,controllerButtonEventNumberLeaves} from './controller-button-event-number-source.js';
import {closedClassPrimitiveSource} from './closed-class-primitive-source.js';

const spriteEventNumber=Number;
const spriteAyArrayPrototype=Array.prototype,spriteAyDescriptor=Object.getOwnPropertyDescriptor;
const spriteAyKeys=Reflect.ownKeys,spriteAyPrototype=Object.getPrototypeOf,spriteAySame=Object.is,spriteAyHasOwn=Object.hasOwn;
const spriteAyArrayKeys=spriteAyKeys(spriteAyArrayPrototype),spriteAyArrayFields=[];
const spriteAyArrayParent=spriteAyPrototype(spriteAyArrayPrototype);
for(let i=0;i<spriteAyArrayKeys.length;i++)spriteAyArrayFields[i]=spriteAyDescriptor(spriteAyArrayPrototype,spriteAyArrayKeys[i]);
const spriteAyArrayCurrent=()=>{
    const keys=spriteAyKeys(spriteAyArrayPrototype);
    if(keys.length!==spriteAyArrayKeys.length||spriteAyPrototype(spriteAyArrayPrototype)!==spriteAyArrayParent)return false;
    for(let i=0;i<keys.length;i++){
        if(keys[i]!==spriteAyArrayKeys[i])return false;
        const before=spriteAyArrayFields[i],now=spriteAyDescriptor(spriteAyArrayPrototype,keys[i]);
        if(!now||now.enumerable!==before.enumerable||now.configurable!==before.configurable||
            spriteAyHasOwn(now,'value')!==spriteAyHasOwn(before,'value')||
            (spriteAyHasOwn(before,'value')?now.writable!==before.writable||!spriteAySame(now.value,before.value):now.get!==before.get||now.set!==before.set))return false;
    }
    return true;
};
// New private views use the initial intrinsic; the existing eager graph keeps
// its original dynamic freeze observations, including exceptional fallback.
const declarationIdentityFreeze=Object.freeze;

export function analyseSourceValueProducers(program,options={}) {
    return analyseSourceValues(program,options,null);
}

function analyseSourceValues(program,options,identityInput,cameraNumberInput=null,primitiveControlEntries=false) {
    const controlEntry=primitiveControlEntries?createSourceControlCellEntry(program):null;
    if(options.normalCompletion&&!sourceNormalCompletionFor(program,options.normalCompletion))throw new Error('Source completion proof must belong to the actual Program');
    const containsThrow=node=>node&&typeof node==='object'&&(node.type==='ThrowStatement'||Object.values(node).some(value=>Array.isArray(value)?value.some(containsThrow):containsThrow(value)));
    if(!containsThrow(program))return analyseGraph(program,options,null,identityInput,cameraNumberInput,controlEntry);
    // Bootstrap is private. No public option can bypass exceptional reachability
    // or supply a caller-made callee table after a consumer clones the AST.
    const initial=analyseGraph(program,{...options,normalCompletion:null},null,null,null,controlEntry);
    const completion=analyseSourceNormalCompletion(program,initial.immutableFunctionAt);
    return Object.freeze({...analyseGraph(program,{...options,normalCompletion:completion},null,null,null,controlEntry),normalCompletion:completion,constraintTypesAt:node=>new Set(initial.typesAt(node))});
}


// Internal preparation demand only. No public option or supplied syntax token
// can select it, and the view cannot discharge a value/completion obligation.
// Throw and uncertain inputs run the complete original eager analyser.
export function analyseSourceDeclarationIdentityForPreparation(program) {
    const options={unboundIsOpaque:true,opaqueDeclarationValues:true};
    const input=declarationIdentityInput(program);
    const graph=analyseSourceValues(program,options,input);
    return declarationIdentityFreeze({unchangedFunctionAt:graph.unchangedFunctionAt});
}

// A local reset `x = undefined|null` that is immediately followed by its
// definite overwrite (a direct `x = e`, or an if/else assigning x in both
// branches before any exit), where e does not read x and no nested function
// mentions x, can never be observed. It is not a producer of x.
function deadLocalResets(program) {
    const dead=new WeakSet(),FN=new Set(['FunctionDeclaration','FunctionExpression','Class']);
    const mentions=(node,name)=>{if(!node||typeof node!=='object')return false;if(Array.isArray(node))return node.some(child=>mentions(child,name));if(node.type==='Identifier'&&node.name===name)return true;return Object.values(node).some(child=>child&&typeof child==='object'&&mentions(child,name));};
    const assignment=(statement,name)=>statement?.type==='ExpressionStatement'&&statement.expr?.type==='Assignment'&&statement.expr.op==='='&&statement.expr.left?.type==='Identifier'&&statement.expr.left.name===name?statement.expr:null;
    const reset=statement=>{const a=statement?.type==='ExpressionStatement'&&statement.expr?.type==='Assignment'&&statement.expr.op==='='&&statement.expr.left?.type==='Identifier'?statement.expr:null;return a&&['Undefined','Null'].includes(a.right?.type)?a:null;};
    const exits=statement=>['Return','Break','Continue','ThrowStatement'].includes(statement?.type);
    const definite=(statement,name)=>{const a=assignment(statement,name);if(a)return !['Undefined','Null'].includes(a.right?.type)&&!mentions(a.right,name);
        if(statement?.type!=='If'||!Array.isArray(statement.consequent)||!Array.isArray(statement.alternate)||mentions(statement.test,name))return false;
        const branch=list=>{for(const item of list){if(definite(item,name))return true;if(exits(item)||mentions(item,name))return false;}return false;};
        return branch(statement.consequent)&&branch(statement.alternate);};
    const fn=node=>{
        const locals=new Set(),captured=new Set();
        const scan=(value,nested)=>{if(!value||typeof value!=='object')return;if(Array.isArray(value)){value.forEach(child=>scan(child,nested));return;}
            if(FN.has(value.type)){const inner=new Set();const names=v=>{if(!v||typeof v!=='object')return;if(Array.isArray(v)){v.forEach(names);return;}if(v.type==='Identifier')inner.add(v.name);Object.values(v).forEach(names);};names(value);inner.forEach(n=>captured.add(n));return;}
            if(!nested&&value.type==='Declaration'&&['let','const'].includes(value.kind))for(const decl of value.decls||[])locals.add(decl.name);
            for(const child of Object.values(value))if(child&&typeof child==='object')scan(child,nested);};
        scan(node.body,false);
        const lists=value=>{if(!value||typeof value!=='object')return;if(Array.isArray(value)){
                for(let i=0;i+1<value.length;i++){const a=reset(value[i]);if(a&&locals.has(a.left.name)&&!captured.has(a.left.name)&&definite(value[i+1],a.left.name))dead.add(a);}
                value.forEach(lists);return;}
            if(FN.has(value.type))return;for(const child of Object.values(value))if(child&&typeof child==='object')lists(child);};
        lists(node.body);
    };
    const visit=value=>{if(!value||typeof value!=='object')return;if(Array.isArray(value)){value.forEach(visit);return;}
        if(['FunctionDeclaration','FunctionExpression'].includes(value.type)&&Array.isArray(value.body))fn(value);
        for(const child of Object.values(value))if(child&&typeof child==='object')visit(child);};
    visit(program);return dead;
}

// Analyze actual lexical producers and all writers without rewriting the AST.
// Source annotations constrain consumers; they never seed producer authority.
// The exporter's push-built Array: in one statement list `L = []`, then n
// single-argument `L.push(e)` statements, then `G = L`. L has no other
// reference except its own declaration; G has no other writer, and every other
// use of G is a literal-index read or `.length`. A read `G[k]` (k < n) then
// holds e_k on normal completion (before the write, PXT faults on the read).
function builderPositionalReads(program,reads){
    const out=new Map(),refs=new Map();
    const walk=(node,parent)=>{if(!node||typeof node!=='object')return;if(Array.isArray(node)){for(const v of node)walk(v,parent);return;}
        if(node.type==='Identifier'){if(!refs.has(node.name))refs.set(node.name,[]);refs.get(node.name).push({node,parent});}
        for(const v of Object.values(node))if(v&&typeof v==='object')walk(v,node);};
    walk(program,null);
    const decls=new Map();const scanDecls=node=>{if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(scanDecls);return;}
        if(node.type==='Declaration')for(const d of node.decls||[]){if(!decls.has(d.name))decls.set(d.name,[]);decls.get(d.name).push(d);}
        if(node.type==='FunctionDeclaration'&&Array.isArray(node.params))for(const name of node.params){if(!decls.has(name))decls.set(name,[]);decls.get(name).push(null);}
        for(const v of Object.values(node))if(v&&typeof v==='object')scanDecls(v);};
    scanDecls(program);
    const lists=[];const scanLists=node=>{if(!node||typeof node!=='object')return;if(Array.isArray(node)){lists.push(node);node.forEach(scanLists);return;}for(const v of Object.values(node))if(v&&typeof v==='object')scanLists(v);};
    scanLists(program);
    const assign=(st,name)=>st?.type==='ExpressionStatement'&&st.expr?.type==='Assignment'&&st.expr.op==='='&&st.expr.left?.type==='Identifier'&&st.expr.left.name===name?st.expr:null;
    const pushOf=(st,name)=>{const c=st?.type==='ExpressionStatement'&&st.expr;return c?.type==='Call'&&!c.isNew&&c.callee?.type==='Member'&&c.callee.name==='push'&&
        c.callee.object?.type==='Identifier'&&c.callee.object.name===name&&c.args?.length===1&&c.args[0]?.type!=='Spread'?c.args[0]:null;};
    const uniqueDecl=name=>(decls.get(name)||[]).length===1&&(decls.get(name)[0]?.init==null||['Null','Undefined'].includes(decls.get(name)[0].init.type));
    for(const list of lists)for(let i=0;i<list.length;i++){
        const st=list[i],first=st?.type==='ExpressionStatement'&&st.expr?.type==='Assignment'&&st.expr.op==='='&&st.expr.left?.type==='Identifier'&&st.expr.right?.type==='Array'&&!st.expr.right.items?.length?st.expr:null;
        if(!first)continue;const L=first.left.name;if(!uniqueDecl(L))continue;
        const items=[];let j=i+1;for(;j<list.length;j++){const e=pushOf(list[j],L);if(!e)break;items.push(e);}
        const publish=list[j]?.type==='ExpressionStatement'&&list[j].expr?.type==='Assignment'&&list[j].expr.op==='='&&list[j].expr.left?.type==='Identifier'&&
            list[j].expr.right?.type==='Identifier'&&list[j].expr.right.name===L?list[j].expr:null;
        if(!publish||!items.length)continue;const G=publish.left.name;if(G===L||!uniqueDecl(G))continue;
        // L: only the declaration, the empty allocation, the pushes and the publication.
        const lRefs=refs.get(L)||[];const allowedL=new Set([first.left,publish.right,...items.map((_,k)=>pushOf(list[i+1+k],L)&&list[i+1+k].expr.callee.object)]);
        if(lRefs.some(r=>!allowedL.has(r.node)))continue;
        // G: the single publication; every other use a literal-index read or .length read.
        let ok=true;const gReads=[];
        for(const r of refs.get(G)||[]){if(r.node===publish.left)continue;
            const p=r.parent;
            if(p?.type==='Index'&&p.object===r.node&&p.index?.type==='Number'){gReads.push(p);continue;}
            if(p?.type==='Member'&&p.object===r.node&&p.name==='length'){continue;}
            ok=false;break;}
        if(!ok)continue;
        // No assignment through G[k] (an Index used as an assignment or update target).
        let written=false;const scanW=node=>{if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(scanW);return;}
            const t=node.type==='Assignment'?node.left:node.type==='Update'?node.argument:null;if(t&&gReads.includes(t))written=true;
            for(const v of Object.values(node))if(v&&typeof v==='object')scanW(v);};scanW(program);
        if(written)continue;
        for(const read of gReads){const k=Number(read.index.value);if(Number.isInteger(k)&&k>=0&&k<items.length&&reads.includes(read))out.set(read,items[k]);}
    }
    return out;
}

function analyseGraph(program,{numericArrows:provedArrows=new Set(),numericHelpers:provedHelpers=new Set(),parenthesized=false,unboundIsOpaque=false,opaqueDeclarationValues=false,uninitializedLocalsAreOpaque=false,declaredLocalUndefined=false,multiplayerPlayerProperties=false,consoleInspection=false,arrayValues=false,arrayEffectSites=false,arrayCallbackParameters=false,arrayLoopEntries=false,closedNumericArrayResults=false,provenArrayLength=false,ordinaryPrimitiveSdkNumbers=false,ordinaryMusicNumbers=true,ordinaryDestroyedNumbers=true,ordinaryParseIntegerNumbers=true,ordinaryParseIntegerEffects=true,sceneClockNumbers=false,initializationEntries=false,primitiveComparisons=false,closureEntries=false,normalCompletion=null,closedOrdinaryEntries=false,physicalUpdateSource=null}={},privateSpriteAyProof=null,identityInput=null,cameraNumberInput=null,controlEntry=null,arrayCallbackBootstrap=false) {
    const ordinaryEntry=closedOrdinaryEntries?createClosedOrdinarySourceEntry(program):null;
    const nullableLengthSource=arrayValues?nullableArrayLengthSource(program):null;
    const nullableLengthIssued=new Set();let nullableLengthUsed=false;
    const lexicalSource=initializationEntries?lexicalDeclarationReadiness(program):null;
    const physicalEntry=physicalUpdateSource?physicalUpdateSourceRecord(program,physicalUpdateSource):null;
    if(physicalUpdateSource&&!physicalEntry)throw new Error('Physical update source proof must belong to the actual current Program');
    const loopEntry=arrayLoopEntries?proveDenseArrayLoopEntries(program,()=>analyseGraph(program,{parenthesized:true,unboundIsOpaque:true})):null;
    // Literal in-bounds index reads of never-mutated Array literals: the
    // Array-aware graph types them positionally (see positionalSlot); only a
    // purely primitive result without Undefined is carried into this graph.
    // A fully inline `[literal].map(callback)[k]`: neither Array has another
    // reference (the callback takes at most value and index, never the
    // Array), the literal has no spread, and a constant k below its length
    // selects exactly one callback result. That read is the callback's result.
    const mappedEntry=arrayLoopEntries&&!arrayValues?(()=>{
        const entries=new Map();const find=node=>{if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(find);return;}
            if(node.type==='Index'&&node.index?.type==='Number'){
                const call=node.object,receiver=call?.callee?.object,fn=call?.args?.[0],k=Number(node.index.value);
                if(call?.type==='Call'&&!call.isNew&&!call.optional&&!call.callee.optional&&!call.typeArguments?.length&&call.callee.type==='Member'&&call.callee.name==='map'&&
                    call.args.length===1&&receiver?.type==='Array'&&Array.isArray(receiver.items)&&receiver.items.every(item=>item&&item.type!=='Spread')&&
                    fn?.type==='FunctionExpression'&&Array.isArray(fn.params)&&fn.params.length<=2&&!Object.hasOwn(fn,'restParam')&&
                    Number.isInteger(k)&&k>=0&&k<receiver.items.length)entries.set(node,fn);
            }
            for(const v of Object.values(node))if(v&&typeof v==='object')find(v);};
        find(program);return entries.size?entries:null;
    })():null;
    const familyEntry=arrayLoopEntries&&!arrayValues?proveLocalArrayFamilyReads(program,analyseGraph(program,{parenthesized:true,unboundIsOpaque:true})):null;
    const numericArraySnapshot=closedNumericArrayResults&&!arrayValues&&hasLocalNumericArrayResultCandidate(program)?physicalUpdateSourceSnapshot(program):null;
    const numericArrayResults=numericArraySnapshot?proveLocalNumericArrayResults(program,analyseGraph(program,{parenthesized:true,unboundIsOpaque:true,initializationEntries:true,provenArrayLength:true,ordinaryPrimitiveSdkNumbers:true,arrayValues:true,arrayLoopEntries:true,closureEntries:true,closedOrdinaryEntries:true,primitiveComparisons:true})):null;
    const positionalEntry=arrayLoopEntries&&!arrayValues?(()=>{
        const reads=[];const find=node=>{if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(find);return;}
            if(node.type==='Index'&&node.index?.type==='Number')reads.push(node);for(const v of Object.values(node))if(v&&typeof v==='object')find(v);};
        find(program);if(!reads.length)return null;
        const graph=analyseGraph(program,{parenthesized:true,unboundIsOpaque:true,arrayValues:true});
        const entries=new Map();
        for(const node of reads){const slot=graph.positionalSlotAt(node);if(slot)entries.set(node,slot);}
        for(const [node,slot] of builderPositionalReads(program,reads))if(!entries.has(node))entries.set(node,slot);
        return entries.size?entries:null;
    })():null;
    // Loan only a length result from the existing lexical/all-writer Array
    // graph. Enabling general Array values here would also authorize index
    // reads in primitive consumers. An unrelated same-named binding, an
    // annotation, an escaped allocation or a read before initialization cannot
    // supply this fact. The independent graph keeps this option disabled.
    let arrayLengthFacts;
    const provenArrayLengthAt=node=>{
        if(!provenArrayLength||node.type!=='Member'||node.name!=='length'||node.object?.type!=='Identifier')return false;
        const graph=arrayLengthFacts ||= analyseGraph(program,{arrayValues:true,parenthesized:true,
            unboundIsOpaque:true,uninitializedLocalsAreOpaque:true,declaredLocalUndefined:true,initializationEntries:true});
        const types=graph.typesAt(node);
        return types.size===1&&types.has('Number')&&graph.isInitializedAt(node.object)&&
            graph.arrayAllocationsAt(node.object).length>0&&graph.arrayMapReceiverSafeAt(node.object)&&
            graph.arrayConstraintErrorsAt(node.object).length===0;
    };
    const callbackEntry=arrayCallbackParameters?proveArrayCallbackPrimitiveEntries(program,normalCompletion):null;
    const completion=normalCompletion?sourceNormalCompletionFor(program,normalCompletion):null;
    if(normalCompletion&&!completion)throw new Error('Source completion proof must belong to the actual Program');
    const unreachableCells=new Set();
    const numericArrows=new Set(provedArrows),numericHelpers=new Set(provedHelpers);
    // Optional actual Array allocations retain per-allocation element cells.
    // Default consumers receive exactly their prior domain and traversal.
    const arraySites=new WeakMap(),arrayOperations=[],arrayMaps=[],arrayCallbacks=[],arrayConstraints=[],unsafeArrayMethods=new Set();
    const arrayToken=node=>{if(!arraySites.has(node))arraySites.set(node,Object.freeze({kind:'Array',site:node,element:Symbol('array element')}));return arraySites.get(node);};

    const inspection=consoleInspection?consoleInspectSourceCalls(program):null;
    const multiplayer=multiplayerPlayerProperties?multiplayerPlayerSourceCalls(program):null,functionScopes=new WeakMap(),playerConstraints=new Set();
    let internalInspection=false,unsafePlayerWrite=false;
    // Only a consumer with an independently validated zero-argument Number body
    // may supply these actual AST allocation sites. Ordinary analysis is unchanged.
    const sdk=staticSdkNamespaceReceivers(program,{builtinIdentifiers:['screen']}),fields=new Map(SDK_FONT_FIELDS.map(field=>[field.name,field.type]));
    const buttonEventNumbers=ordinaryPrimitiveSdkNumbers?controllerButtonEventNumberLeaves(program):null;
    let clockIndexFacts,clockReadFacts,clockWriteTargets;
    // A numeric read of a value that can only be an Array, undefined or null
    // runs no user code: own index data, or a TypeError on a nullish receiver.
    // It cannot fold to a string key such as 'constructor'. Write targets keep
    // the stronger allocation/all-writer proof below.
    const safeClockRead=node=>{
        if(!clockWriteTargets){
            clockWriteTargets=new WeakSet();
            const scan=value=>{if(!value||typeof value!=='object')return;if(Array.isArray(value)){value.forEach(scan);return;}
                const target=value.type==='Assignment'?value.left:value.type==='Update'||value.type==='Unary'&&value.op==='delete'?value.argument:null;
                if(target)clockWriteTargets.add(target);Object.values(value).forEach(scan);};
            scan(program);
        }
        if(clockWriteTargets.has(node))return false;
        const graph=clockReadFacts ||= analyseGraph(program,{arrayValues:true,parenthesized:true,unboundIsOpaque:true,
            uninitializedLocalsAreOpaque:true,declaredLocalUndefined:true,initializationEntries:true});
        const receiver=graph.typesAt(node.object),index=graph.typesAt(node.index);
        if(!receiver.size||![...receiver].every(type=>type==='Undefined'||type==='Null'||type?.kind==='Array'||type==='Array'))return false;
        if(index.size!==1||!index.has('Number'))return false;
        const initialized=value=>!value||typeof value!=='object'||(Array.isArray(value)?value.every(initialized):
            !(value.type==='Identifier'&&!graph.isInitializedAt(value))&&Object.values(value).every(initialized));
        return initialized(node.index);
    };
    const safeClockArrayCall=call=>{
        const graph=clockReadFacts ||= analyseGraph(program,{arrayValues:true,parenthesized:true,unboundIsOpaque:true,
            uninitializedLocalsAreOpaque:true,declaredLocalUndefined:true,initializationEntries:true});
        const receiver=graph.typesAt(call.callee.object);
        if(!receiver.size||![...receiver].every(type=>type==='Undefined'||type==='Null'||type?.kind==='Array'||type==='Array'))return false;
        // indexOf coerces its fromIndex; only primitive arguments are admitted.
        return call.callee.name!=='indexOf'||call.args.every(arg=>{const found=graph.typesAt(arg);
            return found.size>0&&[...found].every(type=>['Number','String','Boolean','Undefined','Null'].includes(type));});
    };
    const safeClockIndex=node=>{
        const graph=clockIndexFacts ||= analyseGraph(program,{arrayValues:true,parenthesized:true,unboundIsOpaque:true,
            opaqueDeclarationValues:true,uninitializedLocalsAreOpaque:true,declaredLocalUndefined:true,initializationEntries:true});
        if(!graph.arrayAllocationsAt(node.object).length||!graph.arrayMapReceiverSafeAt(node.object)||
            graph.arrayConstraintErrorsAt(node.object).length||node.object?.type==='Identifier'&&!graph.isInitializedAt(node.object))return false;
        const types=graph.typesAt(node.index);if(types.size!==1||!types.has('Number'))return false;
        const initialized=value=>!value||typeof value!=='object'||(Array.isArray(value)?value.every(initialized):
            !(value.type==='Identifier'&&!graph.isInitializedAt(value))&&Object.values(value).every(initialized));
        return initialized(node.index);
    };
    const ordinaryNumbers=ordinaryPrimitiveSdkNumbers?ordinaryPlayerScoreNumberCalls(program,safeClockIndex):null;
    const sceneBackgroundNumbers=ordinaryPrimitiveSdkNumbers?ordinarySceneBackgroundNumberCalls(program):null;
    const parseIntegerNumbers=ordinaryPrimitiveSdkNumbers&&ordinaryParseIntegerNumbers?createOrdinaryParseIntegerNumberSource(program):null;
    let parseIntegerNumberUsed=false;
    let stringCharCodeNumbers=null,stringCharCodeNumberUsed=false;
    const cameraPropertyNumbers=ordinaryPrimitiveSdkNumbers?ordinaryCameraPropertyNumberLeaves(program):null;
    const numberFormatNumbers=ordinaryPrimitiveSdkNumbers?ordinaryNumberFormatNumberLeaves(program):null;
    const mathNumbers=ordinaryPrimitiveSdkNumbers?ordinaryMathNumberCalls(program):null;
    const musicNumbers=ordinaryPrimitiveSdkNumbers&&ordinaryMusicNumbers?createOrdinaryMusicNumberSource(program,safeClockIndex):null;
    let musicNumberUsed=false;
    const destroyedNumbers=ordinaryPrimitiveSdkNumbers&&ordinaryDestroyedNumbers?createDestroyedSpriteCallbackNumberSource(program):null;
    let destroyedNumberUsed=false;
    const spriteAyNumbers=privateSpriteAyProof||(ordinaryPrimitiveSdkNumbers?ordinarySpriteAyNumberReads(program):null);
    const sceneNumbers=sceneClockNumbers?ordinarySceneClockNumberCalls(program,safeClockIndex):null;
    const frameDeltaNumbers=sceneClockNumbers?createOrdinaryFrameDeltaNumberSource(program,node=>safeClockIndex(node)||safeClockRead(node),safeClockArrayCall,ordinaryParseIntegerEffects):null;
    let frameDeltaNumberUsed=false;
    let screenWritten=false;
    const scanScreenWrites=node=>{if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(scanScreenWrites);return;}const target=node.type==='Assignment'?node.left:node.type==='Update'?node.argument:null;if(target?.type==='Identifier'&&target.name==='screen'&&sdk.has(target))screenWritten=true;Object.values(node).forEach(scanScreenWrites);};scanScreenWrites(program);
    // Recheck this private dependency only if it strengthened this graph.
    // An unused occurrence proof contributes no type facts to invalidate.
    let controlEntryUsed=false;
    const initializedReads=new WeakSet(),initializationAt=new WeakMap(),localUndefinedDeclarations=new Set();
    const declarationArrayResets=arrayValues?localArrayDeclarationResetSource(program):null;
    let declarationArrayResetUsed=false;
    const declarationArrayResetCurrent=()=>!declarationArrayResetUsed||declarationArrayResets.current();
    const deadResets=deadLocalResets(program),writing=new WeakSet(),owners=new WeakMap(),cells=new WeakMap(),types=new Map(),edges=[],scales=[],texts=[],derived=[],prints=[],classes=new Map(),classCalls=[],classWrites=new Set(),declarations=new Map(),functions=new Map(),calls=[],numericCalls=[],unsupported=[];
    const fail=message=>{if(!unsupported.includes(message))unsupported.push(message);};
    const scope=parent=>({parent,bindings:new Map()});
    const global=scope(null),key=()=>Symbol(),add=(cell,type)=>{if(!types.has(cell))types.set(cell,new Set());const set=types.get(cell),before=set.size;set.add(unreachableCells.has(cell)?'Opaque':type);return before!==set.size;};
    const binding=(owner,name)=>{for(let current=owner;current;current=current.parent)if(current.bindings.has(name))return current.bindings.get(name);if(!global.bindings.has(name))global.bindings.set(name,key());return global.bindings.get(name);};
    const declare=(owner,name)=>{if(!owner.bindings.has(name))owner.bindings.set(name,key());return owner.bindings.get(name);};
    const declaration=(owner,name,node)=>{const id=declare(owner,name);if(!declarations.has(id))declarations.set(id,new Set());declarations.get(id).add(node);};
    const path=node=>node?.type==='Identifier'?node.name:node?.type==='Member'?path(node.object)+'.'+node.name:null;
    const returns=node=>node?.type==='Return'||node?.type==='Block'&&complete(node.body)||node?.type==='If'&&complete(node.consequent)&&complete(node.alternate);
    const complete=body=>(body||[]).some(returns);
    const predeclare=(body,owner)=>{for(const node of body||[]){if(node.type==='Declaration')for(const decl of node.decls)declaration(owner,decl.name,decl);if(['FunctionDeclaration','Class','Enum'].includes(node.type))declaration(owner,node.name,node);}};
    const vars=(node,owner)=>{if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(value=>vars(value,owner));return;}if(['FunctionDeclaration','FunctionExpression','Class'].includes(node.type))return;if(node.type==='Declaration'&&node.kind==='var')node.decls.forEach(decl=>declare(owner,decl.name));Object.values(node).forEach(value=>{if(value&&typeof value==='object')vars(value,owner);});};
    const cell=node=>node?.type==='Identifier'&&writing.has(node)?binding(owners.get(node)||global,node.name):cells.get(node);
    const edge=(from,to)=>{if(from&&to)edges.push([from,to]);};
    const body=(nodes,outer,fn=null)=>{const owner=scope(outer);predeclare(nodes,owner);if(fn){for(const param of fn.params||[]){declaration(owner,param,Symbol(param));const annotation=fn.paramTypes?.[param];if(arrayValues&&annotation?.isArray)arrayConstraints.push({cell:binding(owner,param),type:(annotation.text||'any[]').replace(/\[\]$/,'')});if(multiplayer&&annotation&&(annotation.isArray||annotation.text&&!['any','mp.Player'].includes(annotation.text)))playerConstraints.add(binding(owner,param));}vars(nodes,owner);owner.result=fn.result;}for(const node of nodes||[])visit(node,owner);return owner;};
    const visit=(node,owner)=>{
        if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(value=>visit(value,owner));return;}
        owners.set(node,owner);if(['FunctionDeclaration','Class'].includes(node.type) && (node.name?.startsWith('__bwSdkFont_') || node.name==='__bwSDK_Font'))fail('Internal Font descriptor and intrinsic names are not source bindings');
        if(node.type==='Declaration' && node.decls.some(decl=>decl.name.startsWith('__bwSdkFont_') || decl.name==='__bwSDK_Font'))fail('Internal Font descriptor and intrinsic names are not source bindings');
        if(node.type==='Identifier'){if(node.name.startsWith('__bwSdkFont_'))fail('Internal Font intrinsic names are not source bindings');if(!writing.has(node)){cells.set(node,key());if(node.name==='screen'&&sdk.has(node))add(cell(node),screenWritten?'Opaque':'Image');else {const id=binding(owner,node.name);edge(id,cell(node));if(mathNumbers?.has(node))add(cell(node),'Number');else if(unboundIsOpaque&&!declarations.has(id)||opaqueDeclarationValues&&[...(declarations.get(id)||[])].some(value=>(['FunctionDeclaration','Class','Enum'].includes(value?.type)||value?.isArray||value?.typeName&&!['number','boolean','string','any'].includes(value.typeName)&&!(multiplayer&&value.typeName==='mp.Player'))))add(cell(node),'Opaque');else if(opaqueDeclarationValues&&multiplayer&&[...(declarations.get(id)||[])].some(value=>value?.typeName==='mp.Player'))add(cell(node),'OpaquePlayerConstraint');}}return;}
        cells.set(node,key());const current=cell(node);if(completion&&!completion.isReachable(node))unreachableCells.add(current);
        if(node.bwConsoleInspectIntrinsic===true&&node.callee?.name==='__bwConsoleInspectValue')internalInspection=true;
        if(node.type==='Program'){predeclare(node.body,owner);vars(node.body,owner);node.body.forEach(value=>visit(value,owner));return;}
        if(node.type==='Block'){body(node.body,owner);return;}
        if(node.type==='FunctionDeclaration'){
            const result=key(),entry={node,result,owner:null},functionBinding=binding(owner,node.name);
            if(functions.has(functionBinding)){functions.set(functionBinding,null);fail('SDK Font procedure flow requires a unique lexical declaration');}else functions.set(functionBinding,entry);
            entry.owner=body(node.body,owner,{params:node.params,paramTypes:node.paramTypes,result});if(arrayValues&&new Set(node.params).size!==node.params.length)for(const param of node.params)add(entry.owner.bindings.get(param),'Opaque');if(completion?completion.functionFallsThrough(node):!complete(node.body))add(result,'Undefined');return;
        }
        if(node.type==='FunctionExpression'){add(current,numericArrows.has(node)&&node.functionKind==='arrow'&&!node.params.length?'NumericCallable':'Opaque');functionScopes.set(node,body(node.body,owner,{params:node.params,paramTypes:node.paramTypes,result:key()}));const entry=callbackEntry?.entries.get(node);if(entry)for(let index=0;index<Math.min(2,node.params.length);index++)for(const type of entry[index])add(functionScopes.get(node).bindings.get(node.params[index]),type);if((arrayValues||completion)&&(completion?completion.functionFallsThrough(node):!complete(node.body)))add(functionScopes.get(node).result,'Undefined');return;}
        if(node.type==='Class'){
            const name=binding(owner,node.name);classes.set(name,(classes.get(name)||0)+1);add(current,'Opaque');for(const field of node.fields||[])visit(field.init,owner);
            for(const method of [node.ctor,...(node.methods||[])].filter(Boolean))body(method.body,owner,{params:method.params,paramTypes:method.paramTypes,result:key()});return;
        }
        if(node.type==='If'){visit(node.test,owner);body(node.consequent,owner);body(node.alternate,owner);return;}
        if(['For','ForOf','While'].includes(node.type)){
            const loop=scope(owner);if(node.init?.type==='Declaration')predeclare([node.init],loop);if(node.type==='ForOf')declare(loop,node.name);
            for(const value of [node.init,node.test,node.update,node.iterable])visit(value,loop);body(node.body,loop);return;
        }
        if(node.type==='Declaration'){
            let functionOwner=owner;while(functionOwner&&!functionOwner.result)functionOwner=functionOwner.parent;
            for(const decl of node.decls){const target=binding(owner,decl.name);if(arrayValues&&decl.isArray&&decl.typeName)arrayConstraints.push({cell:target,type:decl.typeName.replace(/\[\]$/,'')});if(multiplayer&&(decl.isArray||decl.typeName&&!['any','mp.Player'].includes(decl.typeName)))playerConstraints.add(target);if(decl.init){visit(decl.init,owner);if(declarationArrayResets?.discount(decl))declarationArrayResetUsed=true;else edge(cell(decl.init),target);}
                else if(declaredLocalUndefined&&functionOwner&&node.kind==='let'&&declarations.get(target)?.size===1&&!decl.isArray&&(!decl.typeName||['number','string','boolean','any'].includes(decl.typeName))){add(target,'Undefined');localUndefinedDeclarations.add(decl);}
                if(decl.typeName==='image.Font')owner.fontAnnotations=(owner.fontAnnotations||new Set()).add(target);}return;
        }
        if(node.type==='Return'){visit(node.value,owner);if(completion&&!completion.isReachable(node))return;let fn=owner;while(fn&&!fn.result)fn=fn.parent;if(fn){if(node.value)edge(cell(node.value),fn.result);else add(fn.result,'Undefined');}return;}
        if(node.type==='ThrowStatement'){visit(node.argument,owner);return;}
        if(node.type==='Assignment'&&node.op==='='&&node.left?.type==='Identifier')writing.add(node.left);
        for(const value of Object.values(node))if(value&&typeof value==='object')visit(value,owner);
        if(node.type==='Assignment'){if(arrayValues&&node.left?.type==='Member'&&node.left.name!=='length')arrayOperations.push({kind:'methodWrite',receiver:cell(node.left.object)});if(arrayValues&&node.left?.type==='Index')arrayOperations.push({kind:'write',receiver:cell(node.left.object),index:cell(node.left.index),value:cell(node.right)});if(node.left?.type==='Identifier')classWrites.add(binding(owners.get(node.left),node.left.name));if(node.op==='='){if(!deadResets.has(node))edge(cell(node.right),cell(node.left));}else if(node.left?.type==='Identifier')derived.push({result:binding(owners.get(node.left),node.left.name),type:'Number',operands:[cell(node.left),cell(node.right)],signature:['+=','-=','*=','/=','%=','&=','|=','^=','<<=','>>=','>>>='].includes(node.op),domain:'Number'});else add(cell(node.left),'Opaque');edge(cell(node.right),current);return;}
        if(arrayValues&&node.type==='Update'&&node.argument?.type==='Member'&&node.argument.name!=='length')arrayOperations.push({kind:'methodWrite',receiver:cell(node.argument.object)});
        if(arrayValues&&node.type==='Update'&&node.argument?.type==='Index')arrayOperations.push({kind:'update',receiver:cell(node.argument.object),index:cell(node.argument.index)});
        if(node.type==='Update'&&node.argument?.type==='Identifier'){classWrites.add(binding(owners.get(node.argument),node.argument.name));derived.push({result:binding(owners.get(node.argument),node.argument.name),type:'Number',operands:[cell(node.argument)],signature:['++','--'].includes(node.op),domain:'Number'});edge(cell(node.argument),current);return;}
        if(node.type==='Call'&&node.isNew&&node.callee?.type==='Identifier'){classCalls.push({value:current,name:binding(owner,node.callee.name)});return;}
        if(arrayValues&&node.type==='Array'){const token=arrayToken(node);add(current,token);for(const item of node.items)edge(cell(item),token.element);return;}
        if(node.type==='Index'&&loopEntry?.entries.has(node)){for(const type of loopEntry.entries.get(node))add(current,type);return;}
        if(node.type==='Index'&&positionalEntry?.has(node)){edge(cell(positionalEntry.get(node)),current);return;}
        if(node.type==='Index'&&familyEntry?.has(node)){for(const value of familyEntry.get(node))edge(cell(value),current);return;}
        if(node.type==='Index'&&numericArrayResults?.has(node)){for(const value of numericArrayResults.get(node))edge(cell(value),current);add(current,'Undefined');return;}
        if(node.type==='Index'&&mappedEntry?.has(node)){cell(node.object);const scope=functionScopes.get(mappedEntry.get(node));if(scope){edge(scope.result,current);return;}}
        if(arrayValues&&node.type==='Index'){arrayOperations.push({kind:'read',receiver:cell(node.object),result:current,index:node.index,node});return;}
        if(provenArrayLengthAt(node)){add(current,'Number');return;}
        if(arrayValues&&node.type==='Member'&&node.name==='length'){arrayOperations.push({kind:'length',node,receiver:cell(node.object),result:current});return;}
        // Math.map is the SDK range-mapping function on the unshadowed Math
        // namespace, never an Array method; it keeps ordinary call handling.
        if(arrayValues&&node.type==='Call'&&!node.isNew&&node.callee?.type==='Member'&&!(node.callee.object?.type==='Identifier'&&node.callee.object.name==='Math'&&sdk.has(node.callee.object))&&(['map','push','pop','shift','unshift'].includes(node.callee.name)||['forEach','filter'].includes(node.callee.name)&&(arrayCallbackBootstrap||callbackEntry?.calls.has(node)))){
            const operation={kind:node.callee.name,node,receiver:cell(node.callee.object),result:current};arrayOperations.push(operation);
            if(['map','filter'].includes(operation.kind)){operation.token=arrayToken(node);add(current,operation.token);}
            if(operation.kind==='map')arrayMaps.push(operation);
            if(['map','forEach','filter'].includes(operation.kind))arrayCallbacks.push(operation);return;
        }

        if(multiplayer?.isRegistration(node)){const handler=node.args[1],scope=functionScopes.get(handler);if(scope)add(binding(scope,handler.params[0]),'Player');}
        if(multiplayer?.isProperty(node))derived.push({result:current,type:'Number',operands:[cell(node.args[0])],signature:true,domain:'Player'});
        else if(node.type==='Call'&&(inspection?.isIntrinsicCall(node)||node.bwConsoleInspectIntrinsic===true&&node.callee?.type==='Identifier'&&node.callee.name==='__bwConsoleInspectValue'&&!node.isNew&&node.args.length===2))derived.push({result:current,type:'String',operands:node.args.map(cell),signature:[1,2].includes(node.args.length),inspection:true});
        else if(node.type==='Member'&&sdk.has(node)&&['image.font5','image.font8','image.font12'].includes(path(node)))add(current,'Font');
        else if(node.type==='Call'&&!node.isNew&&sdk.has(node.callee)&&path(node.callee)==='image.getFontForText'&&node.args.length===1)texts.push({node,argument:cell(node.args[0]),result:current});
        else if(node.type==='Call'&&!node.isNew&&sdk.has(node.callee)&&path(node.callee)==='image.scaledFont'&&node.args.length===2)scales.push({node,receiver:cell(node.args[0]),result:current});
        else if(node.type==='Call'&&!node.isNew&&sdk.has(node.callee)&&path(node.callee)==='image.create')derived.push({result:current,type:'Image',operands:node.args.map(cell),signature:node.args.length===2,domain:'Number'});
        else if(node.type==='Template'&&node.tag==='img')add(current,'Image');
        else if(node.type==='Call'&&!node.isNew&&node.callee?.type==='Member'&&node.callee.name==='clone')derived.push({result:current,type:'Image',operands:[cell(node.callee.object)],signature:node.args.length===0,domain:'Image'});
        else if(node.type==='Call'&&!node.isNew&&node.callee?.type==='Member'&&node.callee.name==='toString')derived.push({result:current,type:'String',operands:[cell(node.callee.object)],signature:node.args.length===0,domain:'Number'});
        else if(node.type==='Call'&&node.callee?.type==='Member'&&node.callee.name==='charCodeAt'){
            stringCharCodeNumbers ||= createStringCharCodeNumberSource(program);
            if(stringCharCodeNumbers.isCall(node))derived.push({result:current,type:'Number',operands:[cell(node.callee.object),...node.args.map(cell)],signature:true,stringCharCode:node});
            else add(current,'Opaque');
            // Preserve the original unknown-call mutation effects even when
            // this separate normal-result signature cannot admit its inputs.
            if(arrayValues)for(const value of [node.callee.object,...node.args])arrayOperations.push({kind:'escape',receiver:cell(value)});
        }
        else if(node.type==='Binary'&&['===','!==','==','!=','<','>','<=','>='].includes(node.op)||node.type==='Unary'&&node.op==='!')derived.push({result:current,type:'Boolean',operands:(node.type==='Unary'?[node.argument]:[node.left,node.right]).map(cell),signature:true,inspectionPrimitive:true});
        else if(arrayValues&&node.type==='Unary'&&node.op==='typeof')derived.push({result:current,type:'String',operands:[cell(node.argument)],signature:true,inspectionPrimitive:true});
        else if(node.type==='Unary'&&['+','-','~'].includes(node.op))derived.push({result:current,type:'Number',operands:[cell(node.argument)],signature:true,domain:node.op==='~'?'SourceBitwise':'Number'});
        // An imported native value `+` (proven join or runtime-dispatch helper
        // call): String/Number for primitive operands; any Array or unknown
        // operand leaves the result Opaque through the same derived rule.
        else if(node.type==='NativeArrayValueBinary'&&node.op==='+')derived.push({result:current,type:'Number',operands:[cell(node.left),cell(node.right)],signature:true,domain:'Number',stringConcat:true});
        else if(node.type==='Binary'&&['+','-','*','/','%','**','&','|','^','<<','>>','>>>'].includes(node.op))derived.push({result:current,type:'Number',operands:[cell(node.left),cell(node.right)],signature:true,domain:['&','|','^','<<','>>','>>>'].includes(node.op)?'SourceBitwise':'Number',stringConcat:node.op==='+',primitiveNumeric:node.op!=='+'});
        else if(parseIntegerNumbers?.isNumberCall(node)){parseIntegerNumberUsed=true;add(current,'Number');}
        else if(node.type==='Call'&&!node.isNew&&(node.callee?.type==='Identifier'||numericArrows.size&&node.callee?.type==='Parenthesized'))calls.push({node,callee:node.callee.type==='Identifier'?binding(owner,node.callee.name):null,result:current});
        else if(node.type==='Parenthesized'&&parenthesized)edge(cell(node.expression),current);
        // The parser spells && / || / ?? as Binary; each yields one actual operand.
        else if(['Conditional','Logical'].includes(node.type)||node.type==='Binary'&&['&&','||','??'].includes(node.op)){edge(cell(node.consequent||node.left),current);edge(cell(node.alternate||node.right),current);}
        else if(node.type==='Member'&&['width','height'].includes(node.name))edges.push([cell(node.object),current,'imageDimension',node.name]);
        else if(node.type==='Member'&&fields.has(node.name))edges.push([cell(node.object),current,'field',node.name]);
        else if(['Undefined','Null','String','Number','Boolean'].includes(node.type))add(current,node.type);
        else if(node.type==='Member'&&frameDeltaNumbers?.isNumberRead(node)){frameDeltaNumberUsed=true;add(current,'Number');}
        else if(musicNumbers?.has(node)){musicNumberUsed=true;add(current,'Number');}
        else if(highScoreIntrinsic(node))add(current,'Number');
        else if(ordinaryNumbers?.has(node)||sceneBackgroundNumbers?.has(node)||cameraPropertyNumbers?.has(node)||numberFormatNumbers?.has(node)||mathNumbers?.has(node)||sceneNumbers?.has(node)||buttonEventNumbers?.has(node)||spriteAyNumbers?.has(node)||cameraNumberInput?.has(node))add(current,'Number');
        else if(destroyedNumbers?.has(node)){destroyedNumberUsed=true;add(current,'Number');}
        else if(spriteAyNumbers?.primitiveHas?.(node)){for(const type of ['Number','String','Boolean','Null','Undefined'])add(current,type);}
        else if(node.type==='Call'&&sdk.has(node.callee)&&path(node.callee)==='game.askForString')add(current,'String');
        else {add(current,'Opaque');if(arrayValues&&node.type==='Call'&&node.callee?.type==='Member')for(const value of [node.callee.object,...node.args])arrayOperations.push({kind:'escape',receiver:cell(value)});}
    };
    const collectPrints=node=>{if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(collectPrints);return;}if(node.type==='Call'&&node.callee?.type==='Member'&&['print','printCenter'].includes(node.callee.name)){const center=node.callee.name==='printCenter',fontIndex=center?3:4;if(node.args.length>fontIndex)prints.push({node,center,fontIndex});}Object.values(node).forEach(value=>{if(value&&typeof value==='object')collectPrints(value);});};
    visit(program,global);collectPrints(program);
    if(arrayValues)for(const [binding,nodes]of declarations)if(nodes.size!==1)add(binding,'Opaque');
    function entry(node,known=new Set()){
        if(!node||typeof node!=='object')return known;
        if(Array.isArray(node)){for(const value of node)known=entry(value,known);return known;}
        const owner=owners.get(node)||global;if(initializationEntries)initializationAt.set(node,new Set(known));
        if(node.type==='Identifier'){
            if(known.has(binding(owner,node.name)))initializedReads.add(node);
            if(!writing.has(node)&&!(node.name==='screen'&&sdk.has(node))&&!mathNumbers?.has(node)&&!known.has(binding(owner,node.name))){
                const id=binding(owner,node.name);
                if(uninitializedLocalsAreOpaque&&global.bindings.get(node.name)!==id&&[...(declarations.get(id)||[])].some(declaration=>typeof declaration==='object'&&!['FunctionDeclaration','Class','Enum'].includes(declaration.type)))add(cell(node),'Opaque');
                if(!controlEntry?.isInitializedRead(node))add(cell(node),'Undefined');
                else controlEntryUsed=true;
            }return known;
        }
        // A closure expression is allocated here, after the currently proved
        // initializations. Hoisted declarations retain their entry boundary.
        if(node.type==='FunctionDeclaration'||node.type==='FunctionExpression'){const entryOwner=node.type==='FunctionDeclaration'?functions.get(binding(owner,node.name))?.owner:null;const first=node.body?.[0],methodOwner=entryOwner||owners.get(first);entry(node.body,new Set([...((consoleInspection||arrayValues||closureEntries)&&node.type==='FunctionExpression'?known:[]),...(node.params||[]).map(name=>binding(methodOwner||owner,name))]));return known;}
        if(node.type==='Class'){for(const field of node.fields||[])entry(field.init,new Set());for(const method of [node.ctor,...(node.methods||[])].filter(Boolean)){const methodOwner=owners.get(method.body?.[0])||owner,globals=physicalEntry?.methods.get(method)?.globals||[];entry(method.body,new Set([...globals.map(decl=>binding(global,decl.name)),...(method.params||[]).map(name=>binding(methodOwner,name))]));}return known;}
        if(node.type==='Declaration'){for(const decl of node.decls){known=entry(decl.init,known);if(decl.init||localUndefinedDeclarations.has(decl))known=new Set([...known,binding(owner,decl.name)]);}return known;}
        if(node.type==='Assignment'){known=entry(node.right,known);if(node.left?.type==='Identifier'&&node.op==='=')known=new Set([...known,binding(owners.get(node.left),node.left.name)]);else known=entry(node.left,known);return known;}
        if(node.type==='Conditional'){known=entry(node.test,known);const left=entry(node.consequent,new Set(known)),right=entry(node.alternate,new Set(known));return new Set([...left].filter(value=>right.has(value)));}
        if(node.type==='Logical'||node.type==='Binary'&&['&&','||','??'].includes(node.op)){known=entry(node.left,known);entry(node.right,new Set(known));return known;}
        if(node.type==='If'){known=entry(node.test,known);const left=entry(node.consequent,new Set(known)),right=entry(node.alternate,new Set(known));return new Set([...left].filter(value=>right.has(value)));}
        if(['For','ForOf','While'].includes(node.type)){known=entry(node.init,known);entry(node.test,known);entry(node.iterable,known);const inside=entry(node.body,new Set(known));entry(node.update,inside);return known;}
        for(const value of Object.values(node))if(value&&typeof value==='object')known=entry(value,known);return known;
    }
    entry(program);
    for(const call of classCalls)add(call.value,classes.get(call.name)===1&&declarations.get(call.name)?.size===1&&!classWrites.has(call.name)?'ClassInstance':'Opaque');
    const resultFunctions=new Map([...functions].filter(([,fn])=>fn).map(([name,fn])=>[fn.result,name])),callGraph=new Map();
    for(const call of calls){let owner=owners.get(call.node);while(owner&&!owner.result)owner=owner.parent;const origin=resultFunctions.get(owner?.result);if(origin){if(!callGraph.has(origin))callGraph.set(origin,new Set());callGraph.get(origin).add(call.callee);}}
    const cyclic=(origin,current=origin,seen=new Set())=>{if(seen.has(current))return false;seen.add(current);for(const next of callGraph.get(current)||[])if(next===origin||cyclic(origin,next,seen))return true;return false;};
    for(const call of calls){if(ordinaryEntry?.isUnreachable(call.node)){add(call.result,'Opaque');continue;}if(completion&&!completion.isReachable(call.node)){add(call.result,'Opaque');continue;}const fn=functions.get(call.callee);if(!fn&&mathNumbers?.has(call.node)){add(call.result,'Number');continue;}if(!fn||declarations.get(call.callee)?.size!==1||classWrites.has(call.callee)){
            if(numericArrows.size)numericCalls.push({node:call.node,result:call.result,receiver:cell(call.node.callee)});
            else add(call.result,'Opaque');if(arrayValues)for(const argument of call.node.args)arrayOperations.push({kind:'escape',receiver:cell(argument)});continue;
        }if(numericHelpers.has(fn.node)) {
            // Structural numeric helpers are proved by the caller using actual
            // declaration/parameter identities; specialize each call's operands.
            derived.push({result:call.result,type:'Number',operands:call.node.args.map(cell),signature:call.node.args.length===fn.node.params.length,domain:'Number'});
            continue;
        }
        if(cyclic(call.callee))add(call.result,'Opaque');
        fn.node.params.forEach((name,index)=>{const arg=call.node.args[index],param=fn.owner.bindings.get(name);if(arg)edge(cell(arg),param);else add(param,'Undefined');});edge(fn.result,call.result);
    }
    const knownBinding=(node,name=node?.name)=>{
        if(typeof name!=='string')return null;
        for(let owner=owners.get(node);owner;owner=owner.parent)if(owner.bindings.has(name))return owner.bindings.get(name);
        return null;
    };
    // Declaration identity is separate from result production. Recursive calls
    // may keep a unique unchanged declaration without acquiring a result fact.
    const unchangedFunction=node=>{
        const identifier=node?.type==='Call'?node.callee:node;
        if(node?.type==='Call'&&node.isNew)return null;
        if(!['Identifier','FunctionDeclaration'].includes(identifier?.type))return null;
        const id=knownBinding(identifier),fn=functions.get(id);
        return fn&&declarations.get(id)?.size===1&&!classWrites.has(id)?fn.node:null;
    };
    // Keep collectPrints, occurrence entry, actual class calls, recursive-call
    // classification and actual formal propagation setup before this boundary.
    // Only the private own-data demand can omit unconsumed value fixedpoints.
    // If syntax/intrinsics changed during those phases, continue the old tail.
    if(identityInput&&identityInput.current()){
        identityInput=null;
        return declarationIdentityFreeze({unchangedFunctionAt:unchangedFunction});
    }
    identityInput=null;
    const isFont=current=>{const set=types.get(current);return !!set?.has('Font')&&set.size===1;};
    const exactType=(value,type)=>types.get(value)?.size===1&&types.get(value).has(type);
    const primitiveTypes=new Set(['String','Number','Boolean','Null','Undefined']);
    // A shared ordinary + body can receive both String and Number callers.
    // Primitive unions still return Number/String on normal completion; no
    // object coercion or unknown alternative may borrow that result domain.
    const primitiveAddition=item=>item.stringConcat&&item.operands.every(value=>types.get(value)?.size&&[...types.get(value)].every(type=>primitiveTypes.has(type)));
    const playerOperand=value=>!unsafePlayerWrite&&types.get(value)?.has('Player')&&[...types.get(value)].every(type=>['Player','Null','Undefined','OpaquePlayerConstraint'].includes(type));
    // A binary - * / % ** on primitive operands invokes no ToPrimitive hook
    // and returns Number on normal completion. Only these exact operator
    // nodes carry primitiveNumeric; += and other compound stores keep the
    // strict Number|Undefined domain because += may concatenate.
    const numericOperand=value=>types.get(value)?.size&&[...types.get(value)].every(type=>type==='Number'||type==='Undefined');
    const inspectionDomain=(operand,allowed)=>types.get(operand)?.size&&[...types.get(operand)].every(type=>allowed.has(type));
    // Fixed bitwise operations return Number on normal completion. This result
    // signature neither proves their operands nor skips their execution; the
    // importer separately requires actual Array-or-primitive operand writers.
    const stringCharCodeValid=item=>{
        const receiver=types.get(item.operands[0]),index=types.get(item.operands[1]);
        const valid=item.operands.length===2&&receiver?.has('String')&&
            [...receiver].every(type=>['String','Null','Undefined'].includes(type))&&index?.size&&
            [...index].every(type=>['Number','Undefined'].includes(type))&&stringCharCodeNumbers.isCall(item.stringCharCode);
        if(valid)stringCharCodeNumberUsed=true;
        return valid;
    };
    const derivedValid=item=>item.stringCharCode?stringCharCodeValid(item):item.inspectionPrimitive?(consoleInspection||internalInspection||arrayValues||primitiveComparisons)&&item.operands.every(operand=>inspectionDomain(operand,primitiveTypes)):item.inspection?item.signature&&inspectionDomain(item.operands[0],primitiveTypes)&&(item.operands.length===1||inspectionDomain(item.operands[1],new Set(['Number','Undefined']))):item.signature&&(item.domain==='SourceBitwise'||primitiveAddition(item)||item.operands.every(operand=>item.domain==='Player'?playerOperand(operand):item.domain==='Number'&&item.type==='Number'?numericOperand(operand)||item.primitiveNumeric===true&&inspectionDomain(operand,primitiveTypes):exactType(operand,item.domain)));
    const arrayTypes=value=>{const set=types.get(value);return set?.size&&[...set].every(type=>type?.kind==='Array')?[...set]:null;};
    // Effects on actual allocation alternatives remain real when an indexed
    // lookup or nullable binding can also be absent. On the absent branch the
    // operation faults; on the Array branch its writers still reach that heap.
    // This separate view never issues a receiver, result or readiness fact.
    const arrayMutationTypes=value=>{
        const set=types.get(value);if(!set?.size)return null;
        const tokens=[];
        for(const type of set){
            if(type==='Null'||type==='Undefined')continue;
            if(type?.kind!=='Array'||arraySites.get(type.site)!==type)return null;
            tokens.push(type);
        }
        return tokens.length?tokens:null;
    };
    // Result-only alternative. The original strict Array receiver API above
    // remains unchanged; no nullish value becomes an Array or initialized read.
    const nativeLengthDomain=value=>{
        const set=types.get(value);if(!set?.size)return false;
        let allocation=false;
        for(const type of set){
            if(type==='Null'||type==='Undefined')continue;
            if(type?.kind!=='Array'||arraySites.get(type.site)!==type||unsafeArrayMethods.has(type))return false;
            allocation=true;
        }
        return allocation;
    };
    const nullableLengthDomain=value=>nativeLengthDomain(value)&&[...types.get(value)].some(type=>type==='Null'||type==='Undefined');
    const nullableLengthClosed=()=>nullableLengthSource?.closed({
        nativeLength:node=>nativeLengthDomain(cell(node.object)),
        bound:node=>!!declarations.get(knownBinding(node))?.size,
        functionAt:node=>{const fn=unchangedFunction(node);return fn&&!cyclic(knownBinding(fn))?fn:null;},
        primitive:node=>{
            const found=types.get(cell(node));
            return !!found?.size&&[...found].every(type=>primitiveTypes.has(type))||
                node?.type==='Member'&&node.name==='length'&&nullableLengthDomain(cell(node.object));
        },
        imageLiteral:node=>typeof node.value==='string'&&!declarations.get(knownBinding(node,'img'))?.size&&
            !!parseExactImgLiteral('img`'+node.value+'`')
    })===true;
    const nullableLengthEligible=op=>op.kind==='length'&&nullableLengthDomain(op.receiver)&&nullableLengthClosed();
    // A nullish receiver faults before any element operation completes, so
    // a NORMAL element read through a receiver whose domain is only
    // Null/Undefined plus actual Array tokens observes those allocations.
    // This is a separate, additive channel: the strict Array receiver API and
    // every existing element domain are unchanged. Such reads see the
    // allocation elements plus every element value written through a
    // nullable receiver; any escape, property write or non-Number index write
    // through a nullable receiver makes them Opaque. Length keeps its
    // separate closed nullable proof below.
    const nullableArrayTypes=value=>{const set=types.get(value);if(!set?.size)return null;let array=false;
        for(const type of set){if(type==='Null'||type==='Undefined')continue;if(type?.kind!=='Array')return null;array=true;}
        return array?[...set].filter(type=>type?.kind==='Array'):null;};
    const nullableKinds=new Set(['read','pop','shift','write','push','unshift','update','escape','methodWrite']);
    const nullableWritten=new Map(),nullablePoisoned=new Set();
    const nullableWrite=(token,type)=>{let set=nullableWritten.get(token);if(!set)nullableWritten.set(token,set=new Set());if(set.has(type))return false;set.add(type);return true;};
    const nullablePoison=token=>{if(nullablePoisoned.has(token))return false;nullablePoisoned.add(token);return true;};
    const nullableOperation=(op,tokens)=>{let changed=false;
        if(['escape','methodWrite'].includes(op.kind)||['write','update'].includes(op.kind)&&types.get(op.index)?.size&&!exactType(op.index,'Number'))
            for(const token of tokens)changed=nullablePoison(token)||changed;
        if(op.kind==='update')for(const token of tokens)changed=nullableWrite(token,'Number')||changed;
        if(['push','unshift'].includes(op.kind))changed=add(op.result,'Number')||changed;
        if(op.kind==='write'||['push','unshift'].includes(op.kind))for(const token of tokens)for(const value of op.kind==='write'?[op.value]:op.node.args.map(cell))
            for(const type of types.get(value)||[])changed=nullableWrite(token,type)||changed;
        if(['read','pop','shift'].includes(op.kind)){changed=add(op.result,'Undefined')||changed;
            for(const token of tokens){
                if(nullablePoisoned.has(token)){changed=add(op.result,'Opaque')||changed;continue;}
                for(const type of [...(types.get(token.element)||[]),...(nullableWritten.get(token)||[])])changed=add(op.result,type)||changed;
            }}
        return changed;};
    // A read with a literal in-bounds integer index of an Array literal that is
    // never mutated, escaped or written anywhere holds exactly that literal's
    // element (original PXT and Lite agree; the element is present). Reads are
    // re-checked after the fixpoint: a later mutation widens them back.
    const mutatingKinds=new Set(['write','update','push','unshift','pop','shift','methodWrite','escape']);
    const positionalReads=new Set();
    const pristine=token=>!unsafeArrayMethods.has(token)&&!arrayOperations.some(op=>mutatingKinds.has(op.kind)&&
        (types.get(op.receiver)||new Set()).has(token));
    const positionalSlot=(op,tokens)=>{
        if(tokens.length!==1||op.index?.type!=='Number')return null;
        const k=Number(op.index.value),site=tokens[0].site;
        if(!Number.isInteger(k)||k<0||site?.type!=='Array'||!Array.isArray(site.items)||k>=site.items.length||
            site.items.some(item=>item?.type==='Spread')||!pristine(tokens[0]))return null;
        // Only a syntactically primitive element (literal, member constant or
        // arithmetic) is read positionally; reference-valued elements keep the
        // general element domain and its alternative-aware effect rules.
        const primitiveSyntax=n=>['Number','String','Boolean','Member'].includes(n?.type)||n?.type==='Parenthesized'&&primitiveSyntax(n.expression)||
            n?.type==='Unary'&&['-','+','!'].includes(n.op)&&primitiveSyntax(n.argument)||
            n?.type==='Binary'&&['+','-','*','/','%'].includes(n.op)&&primitiveSyntax(n.left)&&primitiveSyntax(n.right);
        const selected=site.items[k];
        if(primitiveSyntax(selected))return selected;
        const unwrapped=node=>node?.type==='Parenthesized'?unwrapped(node.expression):node;
        const plainNumber=n=>n?.type==='Number'||n?.type==='Parenthesized'&&plainNumber(n.expression)||
            n?.type==='Unary'&&['-','+'].includes(n.op)&&plainNumber(n.argument)||
            n?.type==='Binary'&&['+','-','*','/','%'].includes(n.op)&&plainNumber(n.left)&&plainNumber(n.right);
        const ordinaryCall=n=>{const call=unwrapped(n);return call?.type==='Call'&&!call.isNew&&!call.optional&&!call.typeArguments?.length&&
            call.callee?.type==='Identifier'&&!!unchangedFunction(call)&&call.args.every(plainNumber);};
        // The Array is fresh and used directly by this index expression, so no
        // callee can receive or mutate that unpublished allocation. This does
        // not make calls pure: all item effects/results remain in the graph.
        // Restrict the new channel to a final homogeneous Number family, which
        // is also what the existing native local-Array family proof admits.
        if(unwrapped(op.node.object)!==site||!ordinaryCall(selected)||!site.items.every(item=>plainNumber(item)||ordinaryCall(item)))return null;
        op.numberCallArray=site;return selected;
    };
    const propagateArrays=()=>{let changed=false;
        for(const op of arrayOperations){const strictTokens=arrayTypes(op.receiver),tokens=strictTokens||arrayMutationTypes(op.receiver);if(!strictTokens){
                // Separate nullable read channel (result domains only).
                const nullable=nullableKinds.has(op.kind)?nullableArrayTypes(op.receiver):null;
                if(nullable)changed=nullableOperation(op,nullable)||changed;
                if(nullableLengthEligible(op)){
                    nullableLengthUsed=true;nullableLengthIssued.add(op);changed=add(op.result,'Number')||changed;
                }
            }
            if(!tokens){
                // A non-nullish unknown alternative cannot establish a normal
                // writer summary. It must not hide the possible mutation of
                // genuine allocations already present in the receiver union.
                if(['write','update','push','unshift','pop','shift','methodWrite','escape'].includes(op.kind))
                    for(const token of types.get(op.receiver)||[])if(token?.kind==='Array'&&arraySites.get(token.site)===token){
                        if(!unsafeArrayMethods.has(token)){unsafeArrayMethods.add(token);changed=true;}
                        changed=add(token.element,'Opaque')||changed;
                    }
                continue;
            }
            // Mutation effects reach every actual allocation alternative,
            // including those behind a Null/Undefined alias.
            if(['escape','methodWrite'].includes(op.kind)||['write','update'].includes(op.kind)&&types.get(op.index)?.size&&!exactType(op.index,'Number'))for(const token of tokens){if(!unsafeArrayMethods.has(token)){unsafeArrayMethods.add(token);changed=true;}if(op.kind==='escape')changed=add(token.element,'Opaque')||changed;}
            if(op.kind==='update')for(const token of tokens){const prior=types.get(token.element);if(prior&&[...prior].some(type=>!primitiveTypes.has(type))){if(!unsafeArrayMethods.has(token)){unsafeArrayMethods.add(token);changed=true;}}else changed=add(token.element,'Number')||changed;}
            if(op.kind==='write'||['push','unshift'].includes(op.kind))for(const token of tokens)for(const value of op.kind==='write'?[op.value]:op.node.args.map(cell))for(const type of types.get(value)||[])changed=add(token.element,type)||changed;
            if(!strictTokens)continue;
            if(op.kind==='length'||['push','unshift'].includes(op.kind))changed=add(op.result,'Number')||changed;
            if(op.kind==='read'&&!op.widened){const slot=positionalSlot(op,tokens);if(slot){op.slot=slot;positionalReads.add(op);for(const type of types.get(cell(slot))||[])if(!op.numberCallArray||type==='Number')changed=add(op.result,type)||changed;continue;}}
            if(['read','pop','shift'].includes(op.kind)){changed=add(op.result,'Undefined')||changed;for(const token of tokens)for(const type of types.get(token.element)||[])changed=add(op.result,type)||changed;}
            if(['map','forEach','filter'].includes(op.kind)){const fn=op.node.args[0],owner=functionScopes.get(fn);if(!owner)continue;
                if(fn.params[0]&&(op.kind==='map'||callbackEntry?.entries.has(fn))){const target=owner.bindings.get(fn.params[0]);changed=add(target,'Undefined')||changed;for(const token of tokens)for(const type of types.get(token.element)||[])changed=add(target,type)||changed;}
                if(fn.params[1]&&(op.kind==='map'||callbackEntry?.entries.has(fn)))changed=add(owner.bindings.get(fn.params[1]),'Number')||changed;
                if(op.kind==='map')for(const type of types.get(owner.result)||[])changed=add(op.token.element,type)||changed;
                if(op.kind==='filter')for(const token of tokens)for(const type of types.get(token.element)||[])changed=add(op.token.element,type)||changed;
                if(op.kind==='forEach')changed=add(op.result,'Undefined')||changed;
            }
        }return changed;
    };
    const propagate=()=>{let changed;do{changed=propagateArrays();
        for(const[from,to,mode,name]of edges){if(mode==='imageDimension'){if(exactType(from,'Image'))changed=add(to,'Number')||changed;else if(types.get(from)?.size)changed=add(to,'Opaque')||changed;}else if(mode==='field'){if(isFont(from)){changed=add(to,name==='data'?'GlyphBuffer':'Number')||changed;if(name==='multiplier')changed=add(to,'Undefined')||changed;}else if(types.get(from)?.size)changed=add(to,'Opaque')||changed;}else for(const type of types.get(from)||[])changed=add(to,type)||changed;}
        for(const cell of playerConstraints)if(types.get(cell)?.has('Player'))changed=add(cell,'Opaque')||changed;
        for(const item of derived)if(derivedValid(item)){
            if(primitiveAddition(item)){
                const certainString=item.operands.some(value=>exactType(value,'String'));
                const possibleString=item.operands.some(value=>types.get(value).has('String'));
                if(possibleString)changed=add(item.result,'String')||changed;
                if(!certainString)changed=add(item.result,'Number')||changed;
            }else changed=add(item.result,item.type)||changed;
        }
        for(const item of numericCalls)if(!item.node.args.length&&exactType(item.receiver,'NumericCallable'))changed=add(item.result,'Number')||changed;
        for(const item of scales)if(isFont(item.receiver))changed=add(item.result,'Font')||changed;
        for(const item of texts)if(types.get(item.argument)?.size===1 && types.get(item.argument).has('String'))changed=add(item.result,'Font')||changed;
    }while(changed);};propagate();
    for(let again=true;again;){again=false;
        for(const op of positionalReads){if(op.widened)continue;const tokens=arrayTypes(op.receiver)||[];
            const numberCallCurrent=!op.numberCallArray||op.numberCallArray.items.every(item=>{const domain=types.get(cell(item));return domain?.size===1&&domain.has('Number');});
            if(tokens.length===1&&pristine(tokens[0])&&numberCallCurrent)continue;
            op.widened=true;again=true;add(op.result,'Undefined');for(const token of tokens)for(const type of types.get(token.element)||[])add(op.result,type);}
        if(again)propagate();}
    if(arrayValues)for(const operation of arrayOperations)if(['write','update'].includes(operation.kind)&&!types.get(operation.index)?.size){for(const token of arrayTypes(operation.receiver)||[])unsafeArrayMethods.add(token);for(const token of nullableArrayTypes(operation.receiver)||[])nullablePoison(token);for(const token of arrayMutationTypes(operation.receiver)||[])unsafeArrayMethods.add(token);}
    const playerWriteUnsafe=()=>!!multiplayer?.computedWrites.some(node=>{const keys=types.get(cell(node));return !keys?.size||[...keys].some(type=>!['Number','Boolean','Null','Undefined'].includes(type));});
    let invalidated;do{invalidated=false;for(const op of nullableLengthIssued)if(!nullableLengthEligible(op))invalidated=add(op.result,'Opaque')||invalidated;if(!unsafePlayerWrite&&playerWriteUnsafe()){unsafePlayerWrite=true;invalidated=true;}for(const item of derived)if(!derivedValid(item))invalidated=add(item.result,'Opaque')||invalidated;for(const item of numericCalls)if(item.node.args.length||!exactType(item.receiver,'NumericCallable'))invalidated=add(item.result,'Opaque')||invalidated;propagate();}while(invalidated);
    const fontAnnotations=new Set();const collectScope=node=>{if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(collectScope);return;}const owner=owners.get(node);for(let s=owner;s;s=s.parent)for(const value of s.fontAnnotations||[])fontAnnotations.add(value);Object.values(node).forEach(value=>{if(value&&typeof value==='object')collectScope(value);});};collectScope(program);
    const immutableFunction=node=>{const fn=unchangedFunction(node);return fn&&!cyclic(knownBinding(fn))?fn:null;};
    const factsCurrent=()=> (!numericArrayResults||numericArraySnapshot.current())&&declarationArrayResetCurrent()&&(!stringCharCodeNumberUsed||stringCharCodeNumbers.current())&&(!parseIntegerNumberUsed||parseIntegerNumbers.current())&&(!controlEntryUsed||controlEntry.current())&&(!frameDeltaNumberUsed||frameDeltaNumbers.current())&&(!ordinaryEntry||ordinaryEntry.current())&&(!nullableLengthUsed||nullableLengthSource.current())&&(!callbackEntry||callbackEntry.current())&&(!loopEntry||loopEntry.current())&&(!spriteAyNumbers||spriteAyNumbers.current())&&(!musicNumberUsed||musicNumbers.current())&&(!destroyedNumberUsed||destroyedNumbers.current())&&(!cameraNumberInput||cameraNumberInput.current());
    const currentTypes=value=>new Set(factsCurrent()?types.get(value)||[]:[]);
    const currentArrayTypes=value=>factsCurrent()?arrayTypes(value):null;
    // Construct this independent execution frontier only on demand. It cannot
    // add initialization/type facts or be selected by public source options.
    let lexicalReadiness;
    const lexical=()=>lexicalReadiness ||= lexicalSource?lexicalSource.analyse({bindingOf:knownBinding,
        declarationCountAt:(node,name=node?.name)=>declarations.get(knownBinding(node,name))?.size||0,immutableFunctionAt:immutableFunction,
        isClosedArrayIndex:node=>{
            if(!owners.has(node)||!owners.has(node.object)||!owners.has(node.index))return false;
            const receiver=currentTypes(cell(node.object)),index=currentTypes(cell(node.index));
            return receiver.size>0&&[...receiver].every(value=>value?.kind==='Array')&&
                index.size===1&&index.has('Number')&&[...receiver].every(value=>!unsafeArrayMethods.has(value));
        }}):
        Object.freeze({current:()=>true,isDeclarationExecutedAt:()=>false,isCapturedReadyAt:()=>false});
    // Copies prevent a consumer from changing another consumer's proof facts.
    // Binding facts do not discharge initialization at an expression occurrence.
    return Object.freeze({
        ...(arrayEffectSites?{possibleArrayAllocationsAt:node=>Object.freeze([...currentTypes(cell(node))].filter(type=>type?.kind==='Array').map(type=>type.site))}:{}),
        typesAt:node=>owners.has(node)?currentTypes(cell(node)):new Set(),
        // The literal element a positional read holds (null when not positional).
        positionalSlotAt:node=>{for(const op of positionalReads)if(op.node===node&&!op.widened)return op.slot;return null;},
        bindingTypesAt:(node,name=node?.name)=>currentTypes(knownBinding(node,name)),
        destroyedNumberResultsUsed:()=>destroyedNumberUsed,
        destroyedNumbersCurrent:()=>!destroyedNumberUsed||destroyedNumbers.current(),
        musicNumberResultsUsed:()=>musicNumberUsed,
        musicNumbersCurrent:()=>!musicNumberUsed||musicNumbers.current(),
        bindingOf:knownBinding,
        bindingKindsAt:(node,name=node?.name)=>new Set([...(declarations.get(knownBinding(node,name))||[])].map(declaration=>
            typeof declaration==='symbol'?'parameter':({FunctionDeclaration:'function',Class:'class',Enum:'enum'}[declaration.type]||'variable'))),
        isLexicalDeclarationExecutedAt:(node,binding)=>factsCurrent()&&lexical().isDeclarationExecutedAt(node,binding),
        isCapturedLexicalDeclarationReadyAt:node=>factsCurrent()&&lexical().isCapturedReadyAt(node),
        lexicalDeclarationReadinessCurrent:()=> factsCurrent()&&(!ordinaryEntry||ordinaryEntry.current())&&(!lexicalSource||lexicalSource.current()),
        closedOrdinaryEntryCurrent:()=>!ordinaryEntry||ordinaryEntry.current(),
        ordinaryEntryUnreachableAt:node=>ordinaryEntry?.isUnreachable(node)===true,
        nullableArrayLengthCurrent:()=>!nullableLengthSource||nullableLengthSource.current(),
        isInitializedAt:node=>factsCurrent()&&(!ordinaryEntry||ordinaryEntry.current())&&initializedReads.has(node),
        isBindingInitializedAt:(node,binding)=>factsCurrent()&&(!ordinaryEntry||ordinaryEntry.current())&&initializationAt.get(node)?.has(binding)===true,
        localUndefinedDeclarations:Object.freeze([...localUndefinedDeclarations]),
        declarationCountAt:(node,name=node?.name)=>declarations.get(knownBinding(node,name))?.size||0,
        immutableFunctionAt:immutableFunction,
        unchangedFunctionAt:unchangedFunction,
        // This is an effect witness for actual calls in this private graph,
        // not an Array receiver or index/bounds permission. The staged source
        // validator checked all producers/writers before issuing the loan.
        closedNumericArrayEffectAt:node=>factsCurrent()&&!!numericArrayResults&&owners.has(node)&&node?.type==='Call'&&
            node.callee?.type==='Member'&&['push','reverse','charAt'].includes(node.callee.name),
        isSdkNamespace:node=>sdk.has(node),
        fontAnnotatedAt:node=>fontAnnotations.has(cell(node)),
        fontScales:Object.freeze(scales.map(item=>item.node)),
        fontSelections:Object.freeze(texts.map(item=>item.node)),
        fontPrints:Object.freeze(prints.map(item=>Object.freeze({...item}))),
        arrayConstraintErrorsAt:node=>{if(!factsCurrent())return ['Array producer source expired'];const tokens=new Set(arrayTypes(cell(node))||[]),domains={number:'Number',string:'String',boolean:'Boolean'};return arrayConstraints.filter(record=>record.type!=='any'&&(arrayTypes(record.cell)||[]).some(token=>tokens.has(token)&&(!domains[record.type]||[...(types.get(token.element)||[])].some(type=>type!==domains[record.type]&&!['Null','Undefined'].includes(type))))).map(record=>`actual Array elements contradict declared ${record.type}[] constraint`);},
        arrayMapReceiverSafeAt:node=>!!currentArrayTypes(cell(node))&&currentArrayTypes(cell(node)).every(token=>!unsafeArrayMethods.has(token)),
        // The exact game.eventContext().deltaTime read admitted by the closed
        // frame census: a Number on normal return, never an initialization fact.
        frameDeltaNumberAt:node=>!!frameDeltaNumbers?.isNumberRead(node),
        frameDeltaNumbersCurrent:()=>!frameDeltaNumbers||frameDeltaNumbers.current(),
        arrayAllocationsAt:node=>Object.freeze([...(currentArrayTypes(cell(node))||[])].map(token=>token.site)),
        arrayElementTypesAt:node=>new Set((currentArrayTypes(cell(node))||[]).flatMap(token=>[...(types.get(token.element)||[])])),
        arrayMapCalls:Object.freeze(arrayMaps.map(operation=>operation.node)),
        arrayCallbackCalls:Object.freeze(arrayCallbacks.map(operation=>operation.node)),
        functionParameterBinding:(node,index)=>functionScopes.get(node)?.bindings.get(node.params[index])||null,
        functionParameterTypes:(node,index)=>currentTypes(functionScopes.get(node)?.bindings.get(node.params[index])),
        functionResultTypes:node=>currentTypes(functionScopes.get(node)?.result),
        diagnostics:Object.freeze([...unsupported])
    });
}

// Optional entry facts for ordinary constrained calls inside actual closed Array callbacks.
// This private proof uses the SAME Program and literal/all-writer graph. It does
// not expose general Array index/length/mutation producers to default consumers.
function proveArrayCallbackPrimitiveEntries(program,normalCompletion){
    let snapshot;try{snapshot=physicalUpdateSourceSnapshot(program);}catch{return null;}
    if(!spriteAyArrayCurrent()||!snapshot||snapshot.opaque.some(value=>typeof value==='function'))return null;
    const metadata=new Set(['originalBody','parameterDefaults','paramTypes','typeParameters','returnType','assertedType','bwProcedureConstraintSource','optionalParams','parameterProperties','sourceReferenceDeclarations','sourceCallableDeclarations','sourceScalarDeclarations']);
    const nodes=[],parents=new WeakMap(),seen=new Set();let closed=true;
    const visit=(value,parent=null)=>{
        if(!value||typeof value!=='object')return;
        if(seen.has(value)){closed=false;return;}seen.add(value);parents.set(value,parent);
        if(!Array.isArray(value))nodes.push(value);
        for(const key of Reflect.ownKeys(value))if(!metadata.has(key))visit(Object.getOwnPropertyDescriptor(value,key).value,value);
    };
    visit(program);if(!closed||!nodes.some(node=>node.type==='Call'&&node.callee?.type==='Member'&&['map','forEach','filter'].includes(node.callee.name)))return null;
    // Bootstrap may not erase unrecognized effects or default-entry code.
    // Reject sparse/malformed literal origins before the value graph visits
    // their elements; an explicit Undefined AST value remains a real element.
    const syntax=new Set(['Program','Declaration','FunctionDeclaration','FunctionExpression','Block',
        'ExpressionStatement','Return','ThrowStatement','If','While','For','ForOf','Break','Continue','Switch',
        'Number','String','Boolean','Null','Undefined','Identifier','Array','Binary','Logical','Unary',
        'Assignment','Update','Conditional','Call','Member','Index','Template','Parenthesized']);
    for(const node of nodes){
        if(node.type&&!syntax.has(node.type))return null;
        if(node.type==='Identifier'&&['eval','Function','globalThis','global','window','self','arguments','Reflect'].includes(node.name))return null;
        if(node.type==='Array'){
            if(!Array.isArray(node.items))return null;
            for(let i=0;i<node.items.length;i++){
                const slot=Object.getOwnPropertyDescriptor(node.items,String(i));
                if(!slot||!Object.hasOwn(slot,'value')||!slot.value||typeof slot.value!=='object')return null;
            }
        }
        if(['FunctionDeclaration','FunctionExpression'].includes(node.type)){
            if(!Array.isArray(node.params))return null;
            for(const owner of [node,node.params]){
                if(Object.hasOwn(owner,'restParam')||['async','isAsync','generator','isGenerator'].some(key=>owner[key]))return null;
                for(const key of ['optionalParams','parameterDefaults','genericParams','typeParameters'])
                    if(owner[key]!==undefined&&(!Array.isArray(owner[key])||owner[key].length))return null;
                if(owner.paramDefaults!==undefined&&(!owner.paramDefaults||typeof owner.paramDefaults!=='object'||Object.keys(owner.paramDefaults).length))return null;
            }
        }
    }
    // Private bootstrap: tentative filter allocations are visible only to this
    // issuer's closed-lineage census. No new callback parameter facts issue.
    // Exported options cannot enroll this mode or supply an accepted call set.
    const graph=analyseGraph(program,{arrayValues:true,parenthesized:true,unboundIsOpaque:true,
        uninitializedLocalsAreOpaque:true,declaredLocalUndefined:true,initializationEntries:true,normalCompletion},null,null,null,null,true);
    const primitive=new Set(['Number','String','Boolean','Null','Undefined']),maps=new Set(graph.arrayCallbackCalls),safeMaps=new Set();
    const initialized=value=>{
        if(!value||typeof value!=='object')return true;
        if(value.type==='Identifier'&&!graph.isInitializedAt(value)&&!graph.immutableFunctionAt(value))return false;
        return Reflect.ownKeys(value).filter(key=>!metadata.has(key)).every(key=>initialized(Object.getOwnPropertyDescriptor(value,key).value));
    };
    for(const call of maps){
        const fn=call.args[0],receiver=call.callee.object;
        if(call.isNew||call.constructorCall||call.optional||call.callee.optional||call.typeArguments?.length||call.args.length!==1||fn?.type!=='FunctionExpression'||
            !Array.isArray(fn.params)||fn.params.length>2||[fn,fn.params].some(value=>Object.hasOwn(value,'restParam')||
                ['async','isAsync','generator','isGenerator'].some(key=>value[key])||
                ['optionalParams','parameterDefaults','genericParams','typeParameters'].some(key=>value[key]!==undefined&&(!Array.isArray(value[key])||value[key].length))||Object.keys(value.paramDefaults||{}).length)||new Set(fn.params).size!==fn.params.length||
            !graph.arrayAllocationsAt(receiver).length||!graph.arrayMapReceiverSafeAt(receiver)||graph.arrayConstraintErrorsAt(receiver).length||!initialized(receiver))return null;
        safeMaps.add(call);
    }
    if(!safeMaps.size)return null;
    // Creator builds reference Arrays with an empty allocation followed by
    // contiguous one-argument pushes. Admit the construction frontier, never
    // a general push method. Each argument is independently primitive and
    // contains no call/member/index that could publish the receiver mid-build.
    const constructionCalls=new Set(),constructed=new WeakSet();
    const independentPrimitive=(value,binding)=>{
        if(!value||typeof value!=='object')return true;
        if(Array.isArray(value))return value.every(child=>independentPrimitive(child,binding));
        if(value.type==='Identifier'&&graph.bindingOf(value)===binding)return false;
        if(['Call','Member','Index','FunctionExpression','Assignment','Update','Object','Spread','Unknown'].includes(value.type))return false;
        return Object.entries(value).filter(([key])=>!metadata.has(key)).every(([,child])=>independentPrimitive(child,binding));
    };
    for(const site of nodes.filter(node=>node.type==='Array'&&Array.isArray(node.items)&&node.items.length===0)){
        let callbackOwner=false;for(let owner=parents.get(site);owner;owner=parents.get(owner))if(owner.type==='FunctionExpression'){callbackOwner=true;break;}
        if(callbackOwner)continue;
        let statement=parents.get(site),key=null;
        if(statement?.type==='Assignment'&&statement.op==='='&&statement.right===site&&statement.left?.type==='Identifier'){
            key=graph.bindingOf(statement.left);statement=parents.get(statement);
            if(statement?.type!=='ExpressionStatement')continue;
        }else{
            const decl=statement,decls=parents.get(decl),owner=parents.get(decls);
            if(owner?.type!=='Declaration'||owner.decls.length!==1||decl.init!==site)continue;
            key=graph.bindingOf(owner,decl.name);statement=owner;
        }
        const list=parents.get(statement);if(!key||!Array.isArray(list))continue;
        const at=list.indexOf(statement);if(at<0)continue;
        const pushes=[];
        for(let i=at+1;i<list.length;i++){
            const call=list[i]?.type==='ExpressionStatement'?list[i].expr:null;
            if(call?.type!=='Call'||call.callee?.type!=='Member'||call.callee.name!=='push'||call.callee.object?.type!=='Identifier'||graph.bindingOf(call.callee.object)!==key)break;
            const arg=call.args?.[0],origins=graph.arrayAllocationsAt(call.callee.object),types=arg&&graph.typesAt(arg);
            if(call.isNew||call.constructorCall||call.optional||call.callee.optional||call.typeArguments?.length||call.args.length!==1||
                graph.declarationCountAt(call.callee.object)!==1||origins.length!==1||origins[0]!==site||!types?.size||[...types].some(type=>!primitive.has(type))||!initialized(arg)||!independentPrimitive(arg,key))return null;
            pushes.push(call);
        }
        if(!pushes.length)continue;
        // No other push through any alias may mutate this allocation after its
        // construction group. The complete call census below rejects the rest.
        constructed.add(site);for(const call of pushes)constructionCalls.add(call);
    }
    // The initial slice preserves dense original indices: no property/index
    // writes, mutable Array methods, foreign getters, reflection or unknown
    // callees can alter a visited element/presence behind this entry fact.
    // Actual whole bodies remain visible; failure issues no callback facts.
    const tagsUsed=new Set(nodes.filter(node=>node.type==='Template').map(node=>node.tag));
    // A builtin Array mutation through a receiver whose allocations are all
    // known touches only those allocations. It withholds entry facts from
    // callbacks over them instead of from every callback in the program.
    const mutatingMethods=new Set(['push','pop','shift','unshift','insertAt','removeAt','splice','reverse','sort','fill']),tainted=new Set();
    const localMutation=node=>node?.type==='Call'&&!node.isNew&&!node.constructorCall&&!node.optional&&node.callee?.type==='Member'&&!node.callee.optional&&
        mutatingMethods.has(node.callee.name)&&!node.typeArguments?.length&&graph.arrayMapReceiverSafeAt(node.callee.object)&&graph.arrayAllocationsAt(node.callee.object).length>0;
    for(const node of nodes){
        if(['Unknown','Object','Spread','Await','Yield','Class','Namespace'].includes(node.type)||node.optional||node.callee?.optional)return null;
        if(node.type==='Template'&&(!['img','hex'].includes(node.tag)||typeof node.value!=='string'||node.value.includes('${')))return null;
        if(node.params?.some(name=>tagsUsed.has(name))||node.decls?.some(decl=>tagsUsed.has(decl.name)))return null;
        if(node.type==='Identifier'&&!graph.bindingKindsAt(node).size&&!graph.isSdkNamespace(node))return null;
        if(node.type==='Call'&&localMutation(node)&&!safeMaps.has(node)&&!constructionCalls.has(node)){for(const site of graph.arrayAllocationsAt(node.callee.object))tainted.add(site);continue;}
        if(node.type==='Call'&&!safeMaps.has(node)&&!constructionCalls.has(node)&&!graph.immutableFunctionAt(node))return null;
        const target=node.type==='Assignment'?node.left:node.type==='Update'?node.argument:node.type==='Unary'&&node.op==='delete'?node.argument:null;
        if(target?.type==='Index'&&node.type!=='Unary'&&graph.arrayMapReceiverSafeAt(target.object)&&graph.arrayAllocationsAt(target.object).length>0){
            for(const site of graph.arrayAllocationsAt(target.object))tainted.add(site);continue;}
        if(target&&target.type!=='Identifier')return null;
        if(node.type==='Member'){
            const parent=parents.get(node);
            if(parent?.type==='Call'&&parent.callee===node&&(safeMaps.has(parent)||constructionCalls.has(parent)||localMutation(parent)))continue;
            if(node.name==='length'&&graph.arrayMapReceiverSafeAt(node.object)&&graph.arrayAllocationsAt(node.object).length)continue;
            return null;
        }
        if(node.type==='Index'&&(!graph.arrayMapReceiverSafeAt(node.object)||!graph.arrayAllocationsAt(node.object).length||
            graph.typesAt(node.index).size!==1||!graph.typesAt(node.index).has('Number')))return null;
    }
    const entries=new Map(),issuedCalls=new Set();
    for(const call of safeMaps){
        const receiver=call.callee.object,allocations=graph.arrayAllocationsAt(receiver),types=graph.arrayElementTypesAt(receiver);
        if(!types.size||[...types].some(type=>!primitive.has(type)))continue;
        // A filter allocation is fresh and dense, but may be empty. Trace its
        // complete receiver lineage to real literal entries; predicate results
        // never become elements and cannot authorize their own receiver.
        const literalLineage=(site,active=new Set())=>{
            if(active.has(site)||tainted.has(site))return false;const next=new Set(active);next.add(site);
            if(site.type==='Call'&&site.callee?.type==='Member'&&site.callee.name==='filter'&&safeMaps.has(site)){
                const origins=graph.arrayAllocationsAt(site.callee.object);
                return origins.length>0&&origins.every(origin=>literalLineage(origin,next));
            }
            if(site.type==='Array'&&constructed.has(site))return true;
            return site.type==='Array'&&Array.isArray(site.items)&&site.items.length>0&&
                Array.from({length:site.items.length},(_,i)=>Object.getOwnPropertyDescriptor(site.items,String(i))).every(d=>d&&Object.hasOwn(d,'value')&&d.value&&
                    graph.typesAt(d.value).size>0&&[...graph.typesAt(d.value)].every(type=>primitive.has(type))&&initialized(d.value));
        };
        if(!allocations.every(site=>literalLineage(site)))continue;
        entries.set(call.args[0],[new Set(types),new Set(['Number'])]);issuedCalls.add(call);
    }
    if(!entries.size||!snapshot.current()||!spriteAyArrayCurrent())return null;
    let expired=false;
    return {entries,calls:issuedCalls,current(){if(!snapshot.current()||!spriteAyArrayCurrent())expired=true;return !expired;}};
}

// Only this module issues initialized-entry receipts. Public options, names,
// copied facades and lowerer structural rows do not issue one.
const physicalUpdateSources=new WeakMap();
function physicalUpdateSourceRecord(program,receipt){
    const r=physicalUpdateSources.get(receipt);return r?.program===program&&r.snapshot.current()?r:null;
}
export function physicalUpdateSourceFor(program,receipt){
    const r=physicalUpdateSourceRecord(program,receipt);if(!r)return null;
    return Object.freeze({hasMethod:method=>r.methods.has(method),
        methods:()=>[...r.methods].map(([method,row])=>Object.freeze({method,classNode:row.classNode,globals:Object.freeze([...row.globals]),sites:Object.freeze([...row.sites])})),
        current:()=>!!physicalUpdateSourceRecord(program,receipt)});
}
export function preparePhysicalUpdateThrowSource(program){
    const unsupported=[],fail=message=>{const text='Throw physical update source: '+message;if(!unsupported.includes(text))unsupported.push(text);};
    const snapshot=physicalUpdateSourceSnapshot(program),receipt=Object.freeze({unsupported});
    if(!snapshot){fail('actual source requires plain own data without accessors');Object.freeze(unsupported);return receipt;}
    const nodes=[],parents=new WeakMap(),contexts=new WeakMap(),seen=new WeakSet();
    const metadata=new Set(['originalBody','parameterDefaults','paramTypes','typeParameters','returnType','assertedType','bwProcedureConstraintSource']);
    const collect=(node,parent=null,context=null)=>{
        if(!node||typeof node!=='object')return;
        if(seen.has(node)){fail('executable node is shared or cyclic');return;}seen.add(node);
        if(Array.isArray(node)){for(const child of node)collect(child,parent,context);return;}
        nodes.push(node);parents.set(node,parent);contexts.set(node,context);
        if(node.type==='Class'){
            for(const field of node.fields||[])collect(field.init,field,field);
            for(const method of [node.ctor,...(node.methods||[])].filter(Boolean))collect(method.body,method,method);
            return;
        }
        const next=['FunctionDeclaration','FunctionExpression'].includes(node.type)?node:context;
        for(const [key,value]of Object.entries(node))if(!metadata.has(key))collect(value,node,next);
    };collect(program);
    if(unsupported.length){Object.freeze(unsupported);return receipt;}
    const structure=prepareObjectClassStructure(program);
    if(structure.unsupported.length){structure.unsupported.forEach(fail);Object.freeze(unsupported);return receipt;}
    if(structure.skip){fail('actual owned ExtendableSprite update declaration is missing');Object.freeze(unsupported);return receipt;}
    const {admitted,lineage,classOrigins,methodOrigins}=structure;
    const originalClasses=new Map((program.body||[]).filter(node=>node.type==='Class').map(node=>[node.name,node]));
    const candidates=[...admitted.values()].filter(cls=>!cls.sdkIntrinsic&&lineage(cls.name)?.some(name=>admitted.get(name).sdkIntrinsic==='ExtendableSprite'));
    if(!candidates.length){fail('actual selected SDK ancestry is missing');Object.freeze(unsupported);return receipt;}
    const graph=analyseGraph(program,{unboundIsOpaque:true,opaqueDeclarationValues:true,uninitializedLocalsAreOpaque:true,initializationEntries:true});
    const classes=new Map(),methods=new Map(),sites=new Map();
    for(const cls of candidates){
        const original=classOrigins.get(cls);
        if(!original||originalClasses.get(cls.name)!==original||graph.declarationCountAt(original,cls.name)!==1){fail('class requires its unique current lexical declaration');continue;}
        const chain=lineage(cls.name),sdkEdge=chain.map(name=>admitted.get(name)).find(row=>row.base==='__bwSDK_ExtendableSprite'),sourceEdge=classOrigins.get(sdkEdge);
        if(!sourceEdge||sourceEdge.base!=='sprites.ExtendableSprite'||graph.declarationCountAt(sourceEdge,'sprites')!==0){fail('SDK ancestry is shadowed or not the actual selected base');continue;}
        const own=cls.methods.filter(method=>method.kind==='method'&&method.name==='update');
        if(own.length>1){fail('duplicate current update declaration');continue;}
        const selected=chain.flatMap(name=>admitted.get(name).methods).find(method=>method.kind==='method'&&method.name==='update'),method=methodOrigins.get(selected);
        if(!method)continue; // A class with only the SDK no-op has no source Throw owner.
        if(selected.isStatic||selected.params.length!==1||selected.optionalParams?.length||selected.parameterDefaults?.length||selected.restParam||selected.typeParameters?.length||selected.modifiers?.some(mode=>['private','protected'].includes(mode))||
            (typeof selected.paramTypes?.[selected.params[0]]==='string'?selected.paramTypes[selected.params[0]]:selected.paramTypes?.[selected.params[0]]?.text)!=='number'||selected.returnType!=='void'){
            fail('update requires the actual public required Number-to-void signature');continue;
        }
        classes.set(cls.name,{original,method});sites.set(cls.name,[]);
    }
    const rootStatements=new Set(program.body||[]),classBindings=new Map([...classes].map(([name,row])=>[graph.bindingOf(row.original,name),name]));
    for(const node of nodes){
        if(node.type==='Unknown'||node.type==='Index'||node.type==='Identifier'&&['globalThis','window','self','eval','Function','Reflect','Object'].includes(node.name)||node.type==='Member'&&['constructor','prototype','__proto__','update'].includes(node.name))fail('ambient, computed, reflected or explicit update access is not proved');
        if(node.type==='Identifier'&&node.name==='this'){
            const parent=parents.get(node);if(!contexts.get(node)||parent?.type!=='Member'||parent.object!==node)fail('class receiver escapes its actual field access');
        }
        if(node.type==='Template'&&(node.tag!=='img'||node.value.includes('${')||graph.declarationCountAt(node,'img')!==0))fail('tagged effects or shadowed image tag are not proved');
        if(node.type==='Identifier'&&classBindings.has(graph.bindingOf(node))){
            const call=parents.get(node),name=classBindings.get(graph.bindingOf(node));
            if(call?.type!=='Call'||call.callee!==node||call.isNew!==true||call.typeArguments?.length){fail('class constructor is extracted, replaced or not a direct actual allocation');continue;}
            const decl=parents.get(call),statement=parents.get(decl);
            if(contexts.get(call)!==null||decl?.init!==call||statement?.type!=='Declaration'||!rootStatements.has(statement)||!['let','const'].includes(statement.kind)){
                fail('construction requires its direct root lexical declaration before earliest physical entry');continue;
            }
            sites.get(name).push({call,decl});
        }
        if(node.type==='Identifier'&&node.name==='sprites'&&graph.declarationCountAt(node)===0)fail('selected SDK namespace is used as a value or member outside ancestry');
        if(node.type==='Identifier'&&node.name==='img'&&graph.declarationCountAt(node)===0)fail('selected image tag binding is accessed outside its literal');
    }
    // Private instances may be assigned through the lowerer's lexical transport
    // cells, but cannot escape through a receiver/callback/call or heap object.
    const instanceBindings=new Set([...sites.values()].flatMap(rows=>rows.map(row=>graph.bindingOf(row.call,row.decl.name))));
    if(instanceBindings.has(null)||instanceBindings.has(undefined))fail('constructed receiver requires its actual lexical cell');
    let added;do{added=false;for(const node of nodes)if(node.type==='Identifier'&&instanceBindings.has(graph.bindingOf(node))){
        const parent=parents.get(node);let destination=null;
        if(parent?.init===node)destination=graph.bindingOf(node,parent.name);
        else if(parent?.type==='Assignment'&&parent.op==='='&&parent.right===node&&parent.left?.type==='Identifier')destination=graph.bindingOf(parent.left);
        if(destination&&!instanceBindings.has(destination)){instanceBindings.add(destination);added=true;}
    }}while(added);
    for(const node of nodes)if(node.type==='Identifier'&&instanceBindings.has(graph.bindingOf(node))){
        const parent=parents.get(node),alias=parent?.init===node||parent?.type==='Assignment'&&parent.op==='='&&(parent.right===node&&parent.left?.type==='Identifier'||parent.left===node);
        if(!alias)fail('constructed receiver escapes its closed lexical cells');
    }
    const globals=(program.body||[]).filter(node=>node.type==='Declaration').flatMap(node=>node.decls).filter(decl=>graph.declarationCountAt(program,decl.name)===1);
    for(const [name,row]of classes){
        const actualSites=sites.get(name);if(!actualSites.length){fail('source update has no proved actual construction site');continue;}
        const known=globals.filter(decl=>actualSites.every(site=>graph.isBindingInitializedAt(site.call,graph.bindingOf(program,decl.name))));
        const prior=methods.get(row.method);methods.set(row.method,{classNode:row.original,globals:prior?prior.globals.filter(decl=>known.includes(decl)):known,sites:[...(prior?.sites||[]),...actualSites.map(site=>site.call)]});
    }
    if(!methods.size)fail('actual owned source update entry is missing');
    if(!snapshot.current())fail('actual source changed while preparing its entry');
    Object.freeze(unsupported);
    if(!unsupported.length)physicalUpdateSources.set(receipt,{program,snapshot,methods});
    return receipt;
}

// Optional non-exposure query only. The generic graph and its missing-element
// Undefined domain are unchanged; the private entry profile exposes no types.
export function sourceImageArrayCloneEffects(program,sourceContext=null) {
    return proveImageArrayCloneEffectEntries(program,()=>analyseSourceValueProducers(program,{
        arrayValues:true,arrayEffectSites:true,parenthesized:true,unboundIsOpaque:true,declaredLocalUndefined:true,initializationEntries:true,ordinaryPrimitiveSdkNumbers:true
    }),sourceContext);
}

// This private primitive producer does not publish Sprite or Array types. Its
// allocation tokens describe only the receivers of exact physical numeric reads.
// In particular, the translator's annotation-seeded reference sets are not used.
function ordinarySpriteAyNumberReads(program) {
    if(!spriteAyArrayCurrent())return null;
    // Numeric SDK Sprite accessors return Numbers on normal completion; flags
    // have a separate primitive-domain invariant below. Dimensions keep their
    // independent Image/receiver proof; property spelling
    // alone never establishes a Sprite allocation or a compatible writer.
    const properties=['x','y','vx','vy','ax','ay','fx','fy','left','right','top','bottom','flags'];
    // Necessary syntax only: a negative result skips this optional analysis,
    // never supplies a type or an eligibility fact. Do not invoke getters.
    const syntaxSeen=new Set();
    const possible=value=>{
        if(!value||typeof value!=='object'||syntaxSeen.has(value))return false;syntaxSeen.add(value);
        const type=Object.getOwnPropertyDescriptor(value,'type'),name=Object.getOwnPropertyDescriptor(value,'name');
        if(type&&Object.hasOwn(type,'value')&&type.value==='Member'&&name&&Object.hasOwn(name,'value')&&properties.includes(name.value))return true;
        for(const key of Reflect.ownKeys(value)) {
            if(metadata.has(key))continue;const row=Object.getOwnPropertyDescriptor(value,key);
            if(row?.enumerable&&Object.hasOwn(row,'value')&&possible(row.value))return true;
        }
        return false;
    };
    try {if(!possible(program))return null;}catch {return null;}
    let initial;
    try {initial=physicalUpdateSourceSnapshot(program);} catch {return null;}
    const nodes=[],parents=new WeakMap(),owners=new WeakMap(),seen=new Set();let valid=true;
    const visit=(value,parent=null,owner=program)=>{
        if(!value||typeof value!=='object')return;
        if(seen.has(value)){valid=false;return;}seen.add(value);
        parents.set(value,parent);owners.set(value,owner);if(!Array.isArray(value))nodes.push(value);
        for(const key of Reflect.ownKeys(value)) {
            if(metadata.has(key))continue;
            const row=Object.getOwnPropertyDescriptor(value,key);
            if(typeof key!=='string'||!row||!Object.hasOwn(row,'value')||typeof row.value==='function'){valid=false;continue;}
            visit(row.value,value,['FunctionDeclaration','FunctionExpression'].includes(value.type)&&key==='body'?value:owner);
        }
    };
    visit(program);
    if(!initial||!valid||program?.type!=='Program'||!Array.isArray(program.body))return null;
    const graph=analyseGraph(program,{parenthesized:true,unboundIsOpaque:true,initializationEntries:true});
    const binding=(node,name=node?.name)=>graph.bindingOf(node,name);
    const root=node=>{let current=node;while(current&&parents.get(current)!==program.body)current=parents.get(current);return current;};
    const rank=node=>program.body.indexOf(root(node));
    const all=(items,predicate)=>{for(let i=0;i<items.length;i++)if(!predicate(items[i],i))return false;return true;};
    const any=(items,predicate)=>{for(let i=0;i<items.length;i++)if(predicate(items[i],i))return true;return false;};
    const schema=fn=>fn.exported!==true&&Array.isArray(fn.params)&&all(fn.params,name=>typeof name==='string')&&new Set(fn.params).size===fn.params.length&&
        !fn.restParam&&!fn.typeParameters?.length&&all(['optionalParams','parameterDefaults','parameterProperties'],name=>
            (!fn[name]||Array.isArray(fn[name])&&!fn[name].length)&&(!fn.params[name]||Array.isArray(fn.params[name])&&!fn.params[name].length));
    for(const node of nodes) {
        if(['Unknown','Class','Object'].includes(node.type)||node.type==='Unary'&&node.op==='delete'||
            node.type==='Identifier'&&['this','globalThis','global','window','self','eval','Function','Reflect','Object','arguments'].includes(node.name)||
            node.type==='Member'&&['constructor','prototype','__proto__'].includes(node.name))return null;
        if(['FunctionDeclaration','FunctionExpression'].includes(node.type)&&!schema(node))return null;
        if(node.name==='img'||node.type!=='Member'&&node.name==='undefined'||
            node.decls&&any(node.decls,row=>row.name==='img'||row.name==='undefined')||
            node.params?.includes('img')||node.params?.includes('undefined'))return null;
        if(node.type==='Assignment'&&graph.isSdkNamespace(node.left)||node.type==='Update'&&graph.isSdkNamespace(node.argument))return null;
    }
    // Existing PXT image decoding pads shorter rows with transparency. Validate
    // each authored row with the exact palette codec; do not replace the source
    // or reject legitimate ragged images as though they were rectangular-only.
    const imageLiteral=node=>{
        if(node?.type!=='Template'||node.tag!=='img'||typeof node.value!=='string')return false;
        const rows=node.value.split(/\r?\n/);let pixels=false;
        for(let i=0;i<rows.length;i++){
            if(!rows[i].trim())continue;
            if(!parseExactImgLiteral('img`'+rows[i]+'`'))return false;pixels=true;
        }
        return pixels;
    };
    const factories=new Set(),spriteSources=new Map(),arrays=new Set(),writes=new Map(),values=new Map(),loops=[],pushes=[];
    const ready=node=>{
        if(!node||typeof node!=='object')return true;
        if(Array.isArray(node))return all(node,ready);
        if(node.type==='Identifier'&&!graph.isInitializedAt(node))return false;
        return all(Reflect.ownKeys(node).filter(key=>!metadata.has(key)),key=>ready(node[key]));
    };
    const number=node=>{
        const types=graph.typesAt(node);
        return types.size===1&&types.has('Number')&&ready(node);
    };
    const kind=node=>number(node)||node?.type==='Member'&&node.object?.type==='Identifier'&&
        node.object.name==='SpriteKind'&&['Player','Projectile','Food','Enemy'].includes(node.name)&&graph.isSdkNamespace(node);
    const write=(key,value,site)=>{if(!writes.has(key))writes.set(key,[]);writes.get(key).push({value,site});};
    for(const node of nodes) {
        if(node.type==='Array'&&Array.isArray(node.items)&&node.items.length===0)arrays.add(node);
        if(node.type==='Call'&&!node.isNew&&!node.constructorCall&&!node.optional&&!node.typeArguments?.length&&node.callee?.type==='Member'&&!node.callee.optional&&
            graph.isSdkNamespace(node.callee)&&Array.isArray(node.args)&&imageLiteral(node.args[0])){
            const api=path(node.callee);
            // Retained SDK create forwards kind to setKind; both an omitted
            // kind and genuine undefined leave the constructor kind unchanged.
            // This identifies a factory call, never a Number/Kind certificate.
            if(api==='sprites.create'&&(node.args.length===1||node.args.length===2&&
                (node.args[1]?.type==='Undefined'||kind(node.args[1]))))factories.add(node);
            if(api==='sprites.createProjectileFromSide'&&node.args.length===3&&number(node.args[1])&&number(node.args[2]))factories.add(node);
            if(api==='sprites.createProjectileFromSprite'&&node.args.length===4&&number(node.args[2])&&number(node.args[3])){
                factories.add(node);spriteSources.set(node,node.args[1]);
            }
        }
        if(node.type==='Declaration')for(const row of node.decls||[])if(row.init)write(binding(node,row.name),row.init,row);
        if(node.type==='Assignment'&&node.left?.type==='Identifier')write(binding(node.left),node.op==='='?node.right:null,node);
        if(node.type==='Update'&&node.argument?.type==='Identifier')write(binding(node.argument),null,node);
        if(node.type==='ForOf'&&Array.isArray(node.body)&&node.body.length)loops.push(node);
        if(node.type==='Call'&&node.callee?.type==='Member'&&node.callee.name==='push')pushes.push(node);
    }
    for(const node of nodes)if(node.type==='Identifier'&&node.name==='sprites'&&graph.isSdkNamespace(node)) {
        const member=parents.get(node),call=parents.get(member);
        if(member?.type!=='Member'||member.object!==node||call?.callee!==member||!factories.has(call))return null;
    }
    // The ordinary public route lowers for-of before constraint analysis.
    // Reprove the actual dense loop, without trusting generated names or an
    // earlier source receipt. Only its physical prefix Index gets element
    // provenance; no generic Index value or type domain is published.
    const denseElements=new Map(),denseLengths=new Set();
    for(const loop of nodes)if(loop.type==='For'){
        const declaration=loop.init,row=declaration?.decls?.[0],test=loop.test,update=loop.update;
        const prefix=loop.body?.[0],element=prefix?.decls?.[0],read=element?.init;
        if(declaration?.type!=='Declaration'||declaration.kind!=='let'||declaration.decls.length!==1||row.init?.type!=='Number'||
            !['string','number'].includes(typeof row.init.value)||Number(row.init.value)!==0||
            test?.type!=='Binary'||test.op!=='<'||test.left?.type!=='Identifier'||
            test.right?.type!=='Member'||test.right.name!=='length'||test.right.object?.type!=='Identifier'||
            update?.type!=='Update'||update.op!=='++'||update.argument?.type!=='Identifier'||
            prefix?.type!=='Declaration'||!['let','const'].includes(prefix.kind)||prefix.decls.length!==1||read?.type!=='Index'||
            read.object?.type!=='Identifier'||read.index?.type!=='Identifier')continue;
        const index=binding(declaration,row.name),array=binding(test.right.object);
        if(!index||!array||graph.declarationCountAt(declaration,row.name)!==1||
            binding(test.left)!==index||binding(update.argument)!==index||binding(read.index)!==index||
            binding(read.object)!==array)continue;
        const allowed=new Set([test.left,update.argument,read.index]);let closed=true;
        for(const node of nodes)if(node.type==='Identifier'&&binding(node)===index&&!allowed.has(node)){closed=false;break;}
        // Plain `=` destinations and declaration rows have no read node in
        // the allowed set, so every extra write, alias or capture is refused.
        if(!closed)continue;
        denseElements.set(read,loop);denseLengths.add(test.right);
    }
    // A parameterless immutable function can return one existing alias without
    // replacing its evaluation. Full function-use and allocation-before-call
    // checks below still apply; annotations and escaping function values grant
    // nothing. A scalar-only prefix is independently validated below; the
    // single final return excludes hidden early paths.
    const aliasReturns=new Map();
    for(const node of nodes)if(node.type==='Call'&&!node.isNew&&!node.constructorCall&&!node.optional&&
        !node.typeArguments?.length&&node.args?.length===0&&node.callee?.type==='Identifier'){
        const fn=graph.immutableFunctionAt(node.callee),ret=fn?.body?.at(-1),returned=ret?.value??ret?.argument;
        if(fn?.type==='FunctionDeclaration'&&program.body.includes(fn)&&schema(fn)&&fn.params.length===0&&
            fn.body.length>=1&&ret.type==='Return'&&returned?.type==='Identifier'&&
            fn.body.slice(0,-1).every(statement=>statement.type==='ExpressionStatement'&&statement.expr?.type==='Assignment'&&
                statement.expr.op==='='&&statement.expr.left?.type==='Identifier'))aliasReturns.set(node,{fn,returned});
    }
    const aliasReturnValues=new Set([...aliasReturns.values()].map(row=>row.returned));
    const value=node=>{
        if(node?.type==='Parenthesized')return value(node.expression);
        if(aliasReturns.has(node))return values.get(binding(aliasReturns.get(node).returned));
        if(factories.has(node)||arrays.has(node))return new Set([node]);
        if(node?.type==='Identifier')return values.get(binding(node));
        if(denseElements.has(node)){
            const tokens=new Set();for(const receiver of value(node.object)||[])for(const item of elements.get(receiver)||[])tokens.add(item);
            return tokens.size?tokens:null;
        }
        return null;
    };
    const add=(key,tokens)=>{
        if(!tokens?.size)return false;
        if(!values.has(key))values.set(key,new Set());let changed=false;
        for(const token of tokens)if(!values.get(key).has(token)){values.get(key).add(token);changed=true;}return changed;
    };
    const elements=new Map([...arrays].map(site=>[site,new Set()]));
    let changed=true,steps=0;
    while(changed) {
        if(++steps>nodes.length+1)return null;changed=false;
        for(const [key,rows]of writes)for(const row of rows)changed=add(key,value(row.value))||changed;
        for(const call of pushes) {
            const receivers=value(call.callee.object),items=call.args?.length===1?value(call.args[0]):null;
            if(!receivers?.size||!items?.size)continue;
            for(const receiver of receivers)if(elements.has(receiver))for(const token of items)if(!elements.get(receiver).has(token)){elements.get(receiver).add(token);changed=true;}
        }
        for(const loop of loops)for(const receiver of value(loop.iterable)||[])changed=add(binding(loop.body[0],loop.name),elements.get(receiver))||changed;
    }
    // This slice proves Sprite reads, not every Array in the program. Retain
    // all collections that may actually store a Sprite. Primitive-only arrays
    // have their independent producer/initialization analysis and cannot grant
    // a receiver token here. A Sprite escaping into an untracked collection is
    // still rejected by the complete use census below.
    for(const site of arrays)if(!any([...(elements.get(site)||[])],token=>factories.has(token)))arrays.delete(site);
    for(const [key,tokens]of values){
        for(const token of tokens)if(!factories.has(token)&&!arrays.has(token))tokens.delete(token);
        if(!tokens.size)values.delete(key);
    }
    const sprites=tokens=>tokens?.size&&all([...tokens],token=>factories.has(token));
    const collections=tokens=>tokens?.size&&all([...tokens],token=>arrays.has(token));
    for(const source of spriteSources.values()){
        let unwrapped=source;while(unwrapped?.type==='Parenthesized')unwrapped=unwrapped.expression;
        if(unwrapped?.type!=='Null'&&!sprites(value(source)))return null;
    }
    const loopBindings=new Map();
    for(const loop of loops) {
        const key=binding(loop.body[0],loop.name);
        if(graph.declarationCountAt(loop.body[0],loop.name)!==0||loopBindings.has(key))return null;
        loopBindings.set(key,loop);
    }
    const usedArrays=new Set(),candidates=new Set();
    for(const node of nodes)if(node.type==='Member'&&properties.includes(node.name)&&sprites(value(node.object)))candidates.add(node);
    if(!candidates.size)return null;
    // Exported blocks explicitly reset Sprite slots to null before constructing
    // them. Permit only a direct, preceding reset with a direct constructor that
    // dominates every use; a later or conditional null writer remains unknown.
    // This is an occurrence proof, never a nullable binding-wide Sprite type.
    const resets=new Map();
    const statementAt=(node,owner)=>{
        const body=owner===program?program.body:owner?.body;
        if(!Array.isArray(body))return null;
        for(let at=node;at;at=parents.get(at))if(parents.get(at)===body)return at;
        return null;
    };
    const writeStatement=(row,owner)=>{
        const statement=statementAt(row.site,owner);
        if(statement?.type==='ExpressionStatement'&&statement.expr===row.site&&row.site.type==='Assignment')return statement;
        if(statement?.type==='Declaration'&&statement.decls?.includes(row.site))return statement;
        return null;
    };
    // No unknown writer may be hidden behind a compatible later assignment.
    for(const [key,tokens]of values) {
        const rows=writes.get(key)||[];
        const missing=rows.filter(row=>!value(row.value)?.size||any([...value(row.value)],token=>!tokens.has(token)));
        if(missing.length){
            if(!sprites(tokens)||missing.some(row=>row.value?.type!=='Null'))return null;
            const construction=rows.find(row=>sprites(value(row.value))),owner=construction&&owners.get(construction.site);
            const statement=construction&&writeStatement(construction,owner),body=owner===program?program.body:owner?.body;
            const position=statement&&body.indexOf(statement);
            if(!statement||position<0||missing.some(row=>{
                if(owners.get(row.site)!==owner)return true;
                const before=writeStatement(row,owner),index=before?body.indexOf(before):-1;
                return index<0||index>=position;
            }))return null;
            resets.set(key,{owner,position,body});
        }
        for(const node of nodes)if(node.type==='Identifier'&&binding(node)===key&&graph.declarationCountAt(node)>1)return null;
    }
    const aliasUse=(node,parent)=>parent?.type==='Assignment'&&parent.op==='='&&parent.right===node&&parent.left?.type==='Identifier'||
        parent&&parent.init===node&&Array.isArray(parents.get(parent))&&parents.get(parents.get(parent))?.type==='Declaration';
    const argumentCall=node=>{const args=parents.get(node),call=parents.get(args);return Array.isArray(args)&&call?.type==='Call'&&call.args===args?call:null;};
    for(const node of nodes) {
        const tokens=value(node);if(!tokens?.size)continue;
        const parent=parents.get(node);
        if(collections(tokens)) {
            for(const token of tokens)usedArrays.add(token);
            if(arrays.has(node)&&parent?.init===node)continue;
            if(aliasUse(node,parent)||parent?.type==='Assignment'&&parent.left===node&&parent.op==='=')continue;
            if(parent?.type==='ForOf'&&parent.iterable===node)continue;
            if(parent?.type==='Index'&&parent.object===node&&denseElements.has(parent)||parent?.type==='Member'&&parent.object===node&&denseLengths.has(parent))continue;
            if(parent?.type==='Member'&&parent.object===node&&parent.name==='push') {
                const call=parents.get(parent);
                if(call?.type==='Call'&&call.callee===parent&&!call.isNew&&!call.optional&&!call.typeArguments?.length&&call.args?.length===1&&sprites(value(call.args[0])))continue;
            }
            return null;
        }
        if(sprites(tokens)) {
            if(parent?.type==='Return'&&aliasReturnValues.has(node))continue;
            if((factories.has(node)||denseElements.has(node)||aliasReturns.has(node))&&parent?.init===node)continue;
            if(aliasUse(node,parent)||parent?.type==='Assignment'&&parent.left===node&&parent.op==='=')continue;
            const call=argumentCall(node);
            if(call?.callee?.type==='Member'&&call.callee.name==='push'&&call.args.length===1&&call.args[0]===node&&collections(value(call.callee.object)))continue;
            if(spriteSources.get(call)===node)continue;
            if(parent?.type==='Member'&&parent.object===node&&['setPosition','setVelocity'].includes(parent.name)){
                const method=parents.get(parent);
                if(method?.type==='Call'&&method.callee===parent&&!method.isNew&&!method.constructorCall&&!method.optional&&
                    !method.typeArguments?.length&&method.args?.length===2&&all(method.args,number))continue;
            }
            if(parent?.type==='Member'&&parent.object===node&&[...properties,'width','height','image','overlapsWith'].includes(parent.name))continue;
            // Known controller retention: the canonical SDK controller.moveSprite
            // call keeps the Sprite and writes only numeric velocities each
            // frame. Admit only the actual namespace call with this Sprite as
            // its first argument and 1-3 arguments whose speeds are omitted or
            // independently proved Numbers. Other controller members/arities refuse.
            if(call&&call.args[0]===node&&!call.isNew&&!call.constructorCall&&!call.optional&&!call.typeArguments?.length&&
                call.callee?.type==='Member'&&!call.callee.optional&&call.callee.name==='moveSprite'&&
                call.callee.object?.type==='Identifier'&&call.callee.object.name==='controller'&&graph.isSdkNamespace(call.callee)&&
                call.args.length>=1&&call.args.length<=3&&all(call.args.slice(1),number))continue;

            if(call?.callee?.type==='Member'&&call.callee.name==='overlapsWith'&&call.args.length===1&&call.args[0]===node&&sprites(value(call.callee.object)))continue;
            return null;
        }
        return null;
    }
    // Each relevant global allocation must precede every actual root call and
    // registration that can reach its users. Callback execution counts are not
    // simulated: the complete writer/use invariant holds at every repetition.
    const callers=new Map();
    for(const node of nodes)if(node.type==='Identifier'&&graph.bindingKindsAt(node).has('function')) {
        const parent=parents.get(node),fn=graph.immutableFunctionAt(node);
        if(!fn||parent?.type!=='Call'||parent.callee!==node)return null;
        if(!callers.has(fn))callers.set(fn,[]);callers.get(fn).push(parent);
    }
    // Reuse one closed registration shape for both top-level allocations and
    // actual source-entry resets. A normalized event literal denotes only the
    // same existing SDK event; it grants no receiver or initialization fact.
    const registrationFor=fn=>{
        if(fn?.type!=='FunctionExpression'||fn.params.length||
            ['async','isAsync','generator','isGenerator'].some(key=>fn[key]===true))return null;
        const call=argumentCall(fn),owner=call&&owners.get(call),statement=owner&&statementAt(call,owner);
        if(call?.type!=='Call'||call.isNew||call.constructorCall||call.optional||call.typeArguments?.length||
            call.callee?.type!=='Member'||call.callee.optional||!graph.isSdkNamespace(call.callee)||
            statement?.type!=='ExpressionStatement'||statement.expr!==call||!Array.isArray(call.args))return null;
        if(path(call.callee)==='game.onUpdate')return call.args.length===1&&call.args[0]===fn?call:null;
        if(!/^controller\.(?:A|B|up|down|left|right)\.onEvent$/.test(path(call.callee)||'')||call.args.length!==2||call.args[1]!==fn)return null;
        const event=call.args[0];
        if(event?.type==='Member'&&event.object?.type==='Identifier'&&event.object.name==='ControllerButtonEvent'&&
            (event.name==='Pressed'||event.name==='Released'||event.name==='Repeated')&&graph.isSdkNamespace(event))return call;
        if(event?.type!=='Number'||!['string','number'].includes(typeof event.value))return null;
        const code=spriteEventNumber(event.value);
        return code===BUTTON_EVENTS.Pressed||code===BUTTON_EVENTS.Released||code===BUTTON_EVENTS.Repeated?call:null;
    };
    const dominates=(owner,position,active=new Set())=>{
        if(owner===program)return true;
        if(active.has(owner))return false;const next=new Set(active);next.add(owner);
        if(owner.type==='FunctionDeclaration') {
            const sites=callers.get(owner)||[];
            return sites.length>0&&all(sites,call=>owners.get(call)===program?rank(call)>position:dominates(owners.get(call),position,next));
        }
        const call=registrationFor(owner);if(!call)return false;
        const caller=owners.get(call);
        return caller===program?rank(call)>position:dominates(caller,position,next);
    };
    // A captured alias may be read by a closed getter called after its
    // producer in the same startup. Every actual call must cross that precise
    // statement frontier; an earlier, recursive or escaping entry denies it.
    const enteredAfter=(owner,reset,active=new Set())=>{
        if(!owner||owner===program||active.has(owner))return false;
        const next=new Set(active);next.add(owner);
        const registration=owner.type==='FunctionExpression'?registrationFor(owner):null;
        const sites=owner.type==='FunctionDeclaration'?callers.get(owner)||[]:registration?[registration]:[];
        return sites.length>0&&all(sites,call=>{
            const caller=owners.get(call);
            if(caller===reset.owner){
                const statement=statementAt(call,caller),index=statement?reset.body.indexOf(statement):-1;
                return index>reset.position;
            }
            return enteredAfter(caller,reset,next);
        });
    };
    const globalInitializers=new Map();
    for(const statement of program.body)if(statement.type==='Declaration')for(const row of statement.decls||[]) {
        const key=binding(statement,row.name);
        if(row.init&&value(row.init)?.size&&graph.declarationCountAt(statement,row.name)===1)globalInitializers.set(key,statement);
    }
    const inside=(node,container)=>{for(let at=node;at;at=parents.get(at))if(at===container)return true;return false;};
    const resetReads=new Set();
    for(const node of nodes)if(node.type==='Identifier'&&resets.has(binding(node))){
        const parent=parents.get(node);
        if(parent?.type==='Assignment'&&parent.left===node&&parent.op==='=')continue;
        const reset=resets.get(binding(node)),owner=owners.get(node);
        if(owner===reset.owner){
            const statement=statementAt(node,owner),index=statement?reset.body.indexOf(statement):-1;
            if(index<=reset.position)return null;
        }else if(reset.owner===program?!dominates(owner,reset.position):!enteredAfter(owner,reset))return null;
        resetReads.add(node);
    }
    for(const node of nodes)if(node.type==='Identifier'&&value(node)?.size) {
        const parent=parents.get(node);
        if(parent?.type==='Assignment'&&parent.left===node&&parent.op==='=')continue;
        if(graph.isInitializedAt(node)||resetReads.has(node))continue;
        const key=binding(node),loop=loopBindings.get(key);
        if(loop&&inside(node,loop.body))continue;
        const declaration=globalInitializers.get(key),owner=owners.get(node),position=declaration?rank(declaration):-1;
        if(!declaration||owner===program&&rank(node)<=position||!dominates(owner,position))return null;
    }
    for(const site of usedArrays) {
        const row=parents.get(site),decl=parents.get(parents.get(row));
        if(row?.init!==site||decl?.type!=='Declaration'||owners.get(site)!==program||rank(site)<0)return null;
        const position=rank(site);
        for(const node of nodes)if(collections(value(node))&&value(node).has(site)) {
            const owner=owners.get(node);
            if(owner===program&&node!==site&&rank(node)<position||!dominates(owner,position))return null;
        }
    }
    // A native numeric read has a Number result independently of the declared
    // formal's type. Use that already established result only inside this
    // private validation graph, then require every actual property writer to agree.
    // No caller-supplied option or annotation can seed this graph.
    // Supply this operation's private candidate set to prevent recursive Sprite
    // analysis. Independent Math/score Number producers may validate a writer;
    // an opaque call or annotation still contributes no Number fact.
    const numericCandidates=new Set([...candidates].filter(node=>node.name!=='flags'));
    const flagsCandidates=new Set([...candidates].filter(node=>node.name==='flags'));
    const writerGraph=analyseGraph(program,{parenthesized:true,unboundIsOpaque:true,ordinaryPrimitiveSdkNumbers:true},
        {has:node=>numericCandidates.has(node),primitiveHas:node=>flagsCandidates.has(node),current:()=>true});
    // Primitive flags form a separate invariant: the fresh Sprite starts with
    // primitive flags and every actual store must preserve the whole primitive
    // domain. It never supplies a Number-only result or a receiver/Array fact.
    const primitiveTypes=new Set(['Number','String','Boolean','Null','Undefined']);
    let helperSyntax=null,helperUsed=false;
    const activeScalars=new Set(),scalarDeclarations=new Set(),implicitScalarWriters=new Set();
    for(const node of nodes){
        if(node.type==='Declaration')for(const row of node.decls||[])scalarDeclarations.add(binding(node,row.name));
        if(node.type==='ForOf'&&node.body?.length)implicitScalarWriters.add(binding(node.body[0],node.name));
    }
    let primitiveWork=0;
    const primitiveValue=(node,depth=0)=>{
        if(!node||depth>128||++primitiveWork>10000)return false;
        if(primitiveTypes.has(node.type))return true;
        if(node.type==='Parenthesized')return primitiveValue(node.expression,depth+1);
        if(flagsCandidates.has(node)||numericCandidates.has(node))return true;
        if(node.type==='Binary'&&['+','-','*','/','%','**','&','|','^','<<','>>','>>>','==','!=','===','!==','<','>','<=','>='].includes(node.op))
            return primitiveValue(node.left,depth+1)&&primitiveValue(node.right,depth+1);
        if(node.type==='Unary'&&['+','-','~','!','typeof'].includes(node.op))return primitiveValue(node.argument,depth+1);
        if(node.type==='Identifier'){
            const kinds=graph.bindingKindsAt(node),key=binding(node),rows=writes.get(key);
            if(kinds.size===1&&kinds.has('variable')){
                // Explicit assignments do not inventory implicit loop element
                // stores. A later compatible assignment cannot hide one.
                if(!scalarDeclarations.has(key)||implicitScalarWriters.has(key))return false;
                if(!rows?.length)return true; // only lexical Undefined, never Number
                if(activeScalars.has(key))return true;
                activeScalars.add(key);const ok=all(rows,row=>primitiveValue(row.value,depth+1));activeScalars.delete(key);return ok;
            }
        }
        if(node.type==='Call'&&!node.isNew&&!node.constructorCall&&!node.optional&&!node.typeArguments?.length&&node.callee?.type==='Identifier'){
            const fn=graph.immutableFunctionAt(node.callee);
            if(fn&&schema(fn)&&fn.params.length===2&&node.args?.length===2){
                const ret=fn.body?.length===1&&fn.body[0],expr=ret?.type==='Return'&&ret.value;
                const plain=expr?.type==='Binary'&&['+','-','*','/','%','**','&','|','^','<<','>>','>>>'].includes(expr.op)&&
                    expr.left?.type==='Identifier'&&expr.left.name===fn.params[0]&&expr.right?.type==='Identifier'&&expr.right.name===fn.params[1];
                if(!plain&&!helperSyntax)helperSyntax=inspectNativeArrayAddHelpers(program);
                const joined=!plain&&[...helperSyntax.helpers.values()].some(row=>row.declaration===fn);
                if((plain||joined)&&all(node.args,arg=>primitiveValue(arg,depth+1))){helperUsed=helperUsed||joined;return true;}
            }
        }
        const found=writerGraph.typesAt(node);
        return found.size>0&&all([...found],type=>primitiveTypes.has(type));
    };
    // A getter prefix may update only independently primitive scalar storage.
    // Receiver aliases, function bindings, calls with unknown results and
    // control/abrupt paths remain outside this straight-line slice.
    for(const {fn}of aliasReturns.values())for(const statement of fn.body.slice(0,-1)){
        const assignment=statement.expr,key=binding(assignment.left),kinds=graph.bindingKindsAt(assignment.left);
        if(kinds.size!==1||!kinds.has('variable')||values.get(key)?.size||!primitiveValue(assignment.right))return null;
    }
    for(const node of nodes) {
        const lhs=node.type==='Assignment'?node.left:node.type==='Update'?node.argument:null;
        if(!candidates.has(lhs))continue;
        if(lhs.name==='flags'){
            if(node.type==='Update'){if(!['++','--'].includes(node.op))return null;continue;}
            if(!['=','+=','-=','*=','/=','%=','&=','|=','^=','<<=','>>=','>>>='].includes(node.op)||!primitiveValue(node.right))return null;
            continue;
        }
        if(node.type==='Update') {if(!['++','--'].includes(node.op))return null;continue;}
        if(!['=','+=','-=','*=','/=','%='].includes(node.op))return null;
        const types=writerGraph.typesAt(node.right);
        if(types.size!==1||!types.has('Number'))return null;
    }
    let expired=false;
    const current=()=>{
        if(expired)return false;
        try {
            if(!spriteAyArrayCurrent()||helperUsed&&!helperSyntax.current())expired=true;
            else {
                const now=physicalUpdateSourceSnapshot(program);
                if(!now||now.shape!==initial.shape||now.objects.length!==initial.objects.length||now.opaque.length!==initial.opaque.length)expired=true;
                if(!expired)for(let i=0;i<now.objects.length;i++)if(now.objects[i]!==initial.objects[i]){expired=true;break;}
                if(!expired)for(let i=0;i<now.opaque.length;i++)if(now.opaque[i]!==initial.opaque[i]){expired=true;break;}
            }
        }catch(error){expired=true;throw error;}
        return !expired;
    };
    return Object.freeze({has:node=>numericCandidates.has(node)&&current(),primitiveHas:node=>flagsCandidates.has(node)&&current(),current});
}

const metadata=new Set(['originalBody','parameterDefaults','paramTypes','typeParameters','returnType','assertedType','bwProcedureConstraintSource','optionalParams','parameterProperties','sourceReferenceDeclarations','sourceCallableDeclarations','sourceScalarDeclarations']);
const unknown=Symbol('unknown entry value'),absent=Symbol('absent entry value');
const path=node=>node?.type==='Identifier'?node.name:node?.type==='Member'?`${path(node.object)}.${node.name}`:null;

// Optional, exact-call non-exposure facts. This is deliberately a straight-line
// ordinary entry slice, not a replacement for generic Array/value analysis.
// Every state below belongs to this walk; no public type/annotation seeds it.
function proveImageArrayCloneEffectEntries(program,createGraph,sourceContext) {
    let snapshot;
    try {snapshot=physicalUpdateSourceSnapshot(program);} catch {return null;}
    if(!snapshot||!sharedImageEntryArrayDomain(program))return null;
    const nodes=[],parents=new WeakMap(),owners=new WeakMap(),seen=new Set();let valid=true;
    const visit=(value,parent=null,owner=program)=>{
        if(!value||typeof value!=='object')return;
        if(seen.has(value)){valid=false;return;}seen.add(value);
        parents.set(value,parent);owners.set(value,owner);if(!Array.isArray(value))nodes.push(value);
        for(const key of Reflect.ownKeys(value)) {
            if(metadata.has(key))continue;
            const d=Object.getOwnPropertyDescriptor(value,key);
            if(typeof key!=='string'||!d||!Object.hasOwn(d,'value')||typeof d.value==='function'){valid=false;continue;}
            visit(d.value,value,['FunctionDeclaration','FunctionExpression'].includes(value.type)&&key==='body'?value:owner);
        }
    };
    visit(program);
    if(!valid||program?.type!=='Program'||!Array.isArray(program.body))return null;
    // No unknown heap writer or callable value can alter a dense entry behind
    // this slice. Uncalled bodies remain in the census and are never pruned.
    for(const node of nodes) {
        if(node.name==='img'||node.params?.includes('img')||node.decls?.some(d=>d.name==='img')||
            node.type==='Identifier'&&['this','globalThis','window','self','eval','Function','Reflect','arguments','img'].includes(node.name))return null;
        if(node.type==='Class'||node.type==='Object'||node.type==='Update'||
            node.type==='Unary'&&node.op==='delete'||node.type==='Assignment'&&node.op!=='=')return null;
        if(node.type==='If'&&(!Array.isArray(node.consequent)||!Object.hasOwn(node,'alternate')||node.alternate!==null&&!Array.isArray(node.alternate)))return null;
        if(node.type==='ExpressionStatement'&&(!Object.hasOwn(node,'expr')||!node.expr||typeof node.expr!=='object'||Object.hasOwn(node,'expression')))return null;
    }
    return consumeSharedImageEntryEffects(program,sourceContext,(effect,effectsCurrent)=>{
    const graph=createGraph();
    for(const node of nodes) {
        if(node.type==='Assignment'&&graph.isSdkNamespace(node.left))return null;
        if(node.type==='Member'&&graph.isSdkNamespace(node)&&['image.create','SpriteKind.create','Math.round'].includes(path(node))) {
            const parent=parents.get(node);if(parent?.type!=='Call'||parent.callee!==node)return null;
        }
    }
    const invariantBoundaries=new Map();
    const env=new Map(),votes=new Map(),visits=new Map(),executed=new Map(),active=new Set();let failed=false,steps=0,registered=false;
    const fail=()=>{failed=true;return unknown;};
    const tick=()=>{if(++steps>100000)failed=true;return !failed;};
    const returned=Symbol('entry-return');
    const image=site=>({kind:'Image',site});
    const scalar=value=>({kind:'scalar',value});
    const number=value=>value?.kind==='scalar'&&typeof value.value==='number'&&Number.isFinite(value.value)?value.value:null;
    const binding=(node,name=node.name)=>graph.bindingOf(node,name);
    const declared=node=>graph.declarationCountAt(node)===1;
    // Function declarations may only be reached through their immutable actual
    // direct callers. Extraction, callbacks and unknown invocation refuse.
    for(const node of nodes)if(node.type==='Identifier'&&graph.bindingKindsAt(node).has('function')) {
        const parent=parents.get(node);
        if(parent?.type!=='Call'||parent.callee!==node||!graph.immutableFunctionAt(node))return null;
    }
    const allWriters=new Map(),arrayUses=new Map();
    const writer=(key,node)=>{if(!allWriters.has(key))allWriters.set(key,[]);allWriters.get(key).push(node);};
    for(const node of nodes) {
        if(node.type==='Assignment'&&node.left?.type==='Identifier')writer(binding(node.left),node);
        if(node.type==='SpriteKindReset')writer(binding(node,node.name),node);
        if(node.type==='Declaration')for(const d of node.decls)if(d.init)writer(binding(node,d.name),d);
        if(node.type==='Identifier')for(const site of graph.possibleArrayAllocationsAt(node)) {
            if(!arrayUses.has(site))arrayUses.set(site,[]);arrayUses.get(site).push(node);
        }
    }
    const callers=new Map(),totals=new Map(),counting=new Set();
    for(const node of nodes)if(node.type==='Call'&&node.callee?.type==='Identifier') {
        const fn=graph.immutableFunctionAt(node.callee);if(fn){if(!callers.has(fn))callers.set(fn,[]);callers.get(fn).push(node);}
    }
    const entryCount=owner=>{
        if(owner===program)return 1;
        if(owner?.type!=='FunctionDeclaration')return Infinity;
        if(totals.has(owner))return totals.get(owner);
        if(counting.has(owner))return Infinity;counting.add(owner);let count=0;
        for(const call of callers.get(owner)||[]) {
            let parent=parents.get(call),conditional=false;
            while(parent&&parent!==owners.get(call)){if(['If','While','For','ForOf','Switch','Conditional','Logical'].includes(parent.type))conditional=true;parent=parents.get(parent);}
            count+=conditional?Infinity:entryCount(owners.get(call));if(count>100000){count=Infinity;break;}
        }
        counting.delete(owner);totals.set(owner,count);return count;
    };
    const done=node=>(executed.get(node)||0)===entryCount(owners.get(node))&&Number.isFinite(entryCount(owners.get(node)));
    const mark=node=>executed.set(node,(executed.get(node)||0)+1);
    // A stored handler is not executed here. Any subsequent read of a binding
    // writable by a callback/reentrant entry has no captured scalar value.
    const stableBinding=key=>(allWriters.get(key)||[]).every(done);
    const stableArray=array=>{
        for(const node of arrayUses.get(array.site)||[]) {
            const parent=parents.get(node),grand=parents.get(parent),statement=parents.get(grand);
            if(parent?.type==='Index'&&parent.object===node) {
                const use=parents.get(parent);if(use?.type==='Assignment'&&use.left===parent||use?.type==='Update'||use?.type==='Unary'&&use.op==='delete')return false;
                continue;
            }
            if(parent?.type==='Member'&&parent.object===node) {
                const call=parents.get(parent);if(parent.name!=='push'||call?.type!=='Call'||call.callee!==parent||!done(call))return false;
                continue;
            }
            if(parent?.type==='Assignment'&&parent.op==='='&&parent.right===node&&parent.left?.type==='Identifier')continue;
            if(parent&&parent.init===node&&statement?.type==='Declaration')continue;
            if(parent?.type==='Assignment'&&parent.left===node&&parent.op==='=')continue;
            return false;
        }
        for(const [key,value]of env)if(value===array&&!stableBinding(key))return false;
        return true;
    };
    const expr=node=>{
        if(!tick())return unknown;
        if(!node)return absent;
        if(node.type==='Number'){if(!['string','number'].includes(typeof node.value)||typeof node.value==='string'&&!node.value.trim())return fail();const n=Number(node.value);return Number.isFinite(n)?scalar(n):fail();}
        if(node.type==='String'||node.type==='Boolean')return scalar(node.value);
        if(node.type==='FunctionExpression')return {kind:'closure',node};
        if(node.type==='Member'&&effect(node,'leaf'))return {kind:'opaque-enum',site:node};
        if(node.type==='Null'||node.type==='Undefined')return absent;
        if(node.type==='Identifier'){if(!declared(node))return fail();const key=binding(node);return registered&&!stableBinding(key)?fail():env.get(key)??absent;}
        if(node.type==='Template')return node.tag==='img'&&typeof node.value==='string'&&parseExactImgLiteral('img`'+node.value+'`')&&graph.typesAt(node).size===1&&graph.typesAt(node).has('Image')?image(node):fail();
        if(node.type==='Array') {
            if(!Array.isArray(node.items)||!graph.arrayAllocationsAt(node).includes(node))return fail();
            const items=[];for(const item of node.items){const value=expr(item);if(value?.kind!=='Image')return fail();items.push(value);}
            return {kind:'Array',site:node,items};
        }
        if(node.type==='Binary') {
            const left=expr(node.left),right=expr(node.right),a=number(left),b=number(right);
            if(a!==null&&b!==null&&['<','<=','>','>=','===','!=='].includes(node.op)) {
                return scalar(node.op==='<'?a<b:node.op==='<='?a<=b:node.op==='>'?a>b:node.op==='>='?a>=b:node.op==='==='?a===b:a!==b);
            }
            if(a===null||b===null||!['+','-','%'].includes(node.op)) {
                const types=graph.typesAt(node);return types.size&&[...types].every(type=>['Number','String','Boolean','Null','Undefined'].includes(type))?{kind:'opaque-scalar',site:node}:fail();
            }
            const value=node.op==='+'?a+b:node.op==='-'?a-b:a%b;return Number.isFinite(value)?scalar(value):fail();
        }
        if(node.type==='Unary'&&node.op==='!'){const value=expr(node.argument);return value?.kind==='scalar'&&typeof value.value==='boolean'?scalar(!value.value):fail();}
        if(node.type==='Unary'&&['+','-'].includes(node.op)){const a=number(expr(node.argument));return a===null?fail():scalar(node.op==='-'?-a:a);}
        if(node.type==='Index') {
            const array=expr(node.object),index=number(expr(node.index));
            return array?.kind==='Array'&&index!==null&&Number.isInteger(index)&&index>=0&&index<array.items.length?array.items[index]:fail();
        }
        if(node.type==='Assignment'&&node.op==='='&&node.left?.type==='Identifier') {
            if(!declared(node.left))return fail();const value=expr(node.right);env.set(binding(node.left),value);mark(node);return value;
        }
        if(node.type==='Assignment'&&node.op==='='&&node.left?.type==='Member'&&effect(node,'write')) {
            const receiver=expr(node.left.object),value=expr(node.right);return receiver?.kind==='private-text'&&value?.kind!=='Array'&&value?.kind!=='closure'?value:fail();
        }
        if(node.type==='Call') {
            if(node.isNew||node.constructorCall||Object.hasOwn(node,'typeArguments')||!Array.isArray(node.args))return fail();
            if(node.callee?.type==='Identifier') {
                const fn=graph.immutableFunctionAt(node.callee);
                if(!fn||node.args.length>fn.params.length||active.has(fn)||fn.parameterDefaults?.length||fn.optionalParams?.length)return fail();
                const argumentsAtEntry=node.args.map(expr);if(argumentsAtEntry.some(value=>value?.kind==='Array'||value?.kind==='closure'))return fail();
                active.add(fn);const locals=[];
                for(const statement of fn.body||[])if(statement.type==='Declaration')for(const d of statement.decls)locals.push(binding(statement,d.name));
                if(fn.params.length&&!fn.body?.length)return fail();
                const parameters=fn.params.map(name=>binding(fn.body[0],name));locals.push(...parameters);
                const saved=locals.map(key=>[key,env.has(key),env.get(key)]);for(const key of locals)env.delete(key);
                parameters.forEach((key,index)=>env.set(key,argumentsAtEntry[index]??absent));
                const result=body(fn.body);
                for(const [key,had,value]of saved)if(had)env.set(key,value);else env.delete(key);
                active.delete(fn);return result?.[returned]?result.value:result;
            }
            if(node.callee?.type!=='Member')return fail();
            const api=path(node.callee);
            const allowed=effect(node);
            if(allowed) {
                const receiver=allowed.kind==='disjoint-text'?expr(node.callee.object):null,args=node.args.map(expr);
                if(args.some(value=>value?.kind==='Array'))return fail();
                if(allowed.kind==='registration') {
                    if(args.some((value,index)=>index!==allowed.callbackIndex&&value?.kind==='closure')||args[allowed.callbackIndex]?.kind!=='closure'||
                        [...env.values()].some(value=>value?.kind==='Array'&&!stableArray(value)))return fail();
                    if(allowed.imageInvariantBoundary) {
                        const fn=args[allowed.callbackIndex].node;
                        // Copy only already complete cells. Later traversal
                        // never renews or backfills this registration boundary.
                        const captured=new Map();
                        for(const [key,value]of env)if(stableBinding(key))captured.set(key,value?.kind==='Array'?
                            {kind:'Array',site:value.site,items:value.items.slice()}:value);
                        if(!invariantBoundaries.has(fn))invariantBoundaries.set(fn,[]);
                        invariantBoundaries.get(fn).push({registration:node,env:captured});
                    }
                    registered=true;return {kind:'opaque-result',site:node};
                }
                if(args.some(value=>value?.kind==='closure'))return fail();
                if(allowed.kind==='kind-allocation')return {kind:'opaque-kind',site:node};
                if(allowed.kind==='round'){const n=number(args[0]);return n===null?fail():scalar(Math.round(n));}
                if(allowed.kind==='private-text')return {kind:'private-text',site:node};
                if(allowed.kind==='disjoint-text'&&receiver?.kind!=='private-text')return fail();
                return {kind:'opaque-result',site:node};
            }
            const receiver=expr(node.callee.object),args=node.args.map(expr);
            if(node.callee.name==='push'&&receiver?.kind==='Array'&&args.length&&args.every(value=>value?.kind==='Image')) {
                receiver.items.push(...args);mark(node);return scalar(receiver.items.length);
            }
            if(node.callee.name==='clone'&&!args.length) {
                const okay=receiver?.kind==='Image';votes.set(node,(votes.get(node)??true)&&okay);visits.set(node,(visits.get(node)||0)+1);
                return okay?image(node):fail();
            }
            return fail();
        }
        return fail();
    };
    const body=statements=>{
        if(!Array.isArray(statements))return fail();
        for(const node of statements) {
            if(!tick())return unknown;
            if(node.type==='FunctionDeclaration')continue;
            if(node.type==='SpriteKindReset') {
                if(typeof node.name!=='string'||graph.declarationCountAt(node,node.name)!==1)return fail();
                env.set(binding(node,node.name),absent);mark(node);continue;
            }
            if(node.type==='Declaration') {
                if(node.kind!=='let'&&node.kind!=='const')return fail();
                for(const d of node.decls){if(graph.declarationCountAt(node,d.name)!==1)return fail();env.set(binding(node,d.name),expr(d.init));if(d.init)mark(d);}
            } else if(node.type==='ExpressionStatement') {
                if(!Object.hasOwn(node,'expr')||!node.expr||typeof node.expr!=='object'||Object.hasOwn(node,'expression'))return fail();
                expr(node.expr);
            }
            else if(node.type==='If') {
                const test=expr(node.test);if(test?.kind!=='scalar'||typeof test.value!=='boolean')return fail();
                const result=!test.value&&node.alternate===null?absent:body(test.value?node.consequent:node.alternate);if(result?.[returned])return result;
            }
            else if(node.type==='Return'){const value=expr(node.value);return value?.kind==='Array'?fail():{[returned]:true,value};}
            else return fail();
            if(failed)return unknown;
        }
        return absent;
    };
    body(program.body);
    // A separate arbitrary-repeat invariant. Nothing here executes a callback,
    // makes its entry count finite or restores the ordinary walk across a
    // destroy/yield barrier. Complete allocation/use closure was checked at
    // each actual boundary, across the whole retained Program.
    const invariantVotes=new WeakSet(),rootCache=new Map(),rootActive=new Set();
    const closedSignature=fn=>Array.isArray(fn.params)&&new Set(fn.params).size===fn.params.length&&
        fn.params.every(name=>typeof name==='string')&&!fn.optionalParams?.length&&!fn.parameterDefaults?.length&&!fn.parameterProperties?.length&&
        !fn.typeParameters?.length&&!fn.genericParams?.length&&!fn.restParam&&!Object.keys(fn.paramDefaults||{}).length&&
        !fn.params.optionalParams?.length&&!fn.params.parameterDefaults?.length&&!fn.params.parameterProperties?.length;
    const roots=owner=>{
        if(owner===program)return {ordinary:1,callbacks:new Set()};
        if(owner?.type==='FunctionExpression')return invariantBoundaries.get(owner)?.length===1?
            {ordinary:0,callbacks:new Set([owner])}:null;
        if(owner?.type!=='FunctionDeclaration'||!closedSignature(owner)||rootActive.has(owner))return null;
        if(rootCache.has(owner))return rootCache.get(owner);
        rootActive.add(owner);let result={ordinary:0,callbacks:new Set()};
        const incoming=callers.get(owner)||[];
        if(!incoming.length)result=null;
        for(const call of incoming) {
            if(!result)break;
            if(call.isNew||call.constructorCall||Object.hasOwn(call,'typeArguments')||call.args.length!==owner.params.length){result=null;break;}
            const from=roots(owners.get(call));if(!from){result=null;break;}
            let parent=parents.get(call),conditional=false;
            while(parent&&parent!==owners.get(call)){if(['If','While','For','ForOf','Switch','Conditional','Logical'].includes(parent.type))conditional=true;parent=parents.get(parent);}
            // Ordinary paths retain the original exact finite-count rule.
            if(from.ordinary&&conditional){result=null;break;}
            result.ordinary+=from.ordinary;if(result.ordinary>100000){result=null;break;}
            for(const callback of from.callbacks)result.callbacks.add(callback);
        }
        rootActive.delete(owner);rootCache.set(owner,result);return result;
    };
    const invariantValue=(node,state)=>{
        if(!node)return unknown;
        if(node.type==='Identifier')return declared(node)?state.get(binding(node))??unknown:unknown;
        if(node.type==='Number'){
            if(!['string','number'].includes(typeof node.value)||typeof node.value==='string'&&!node.value.trim())return unknown;
            const n=Number(node.value);return Number.isFinite(n)?scalar(n):unknown;
        }
        if(node.type==='Binary'&&['+','-','%'].includes(node.op)){
            const a=number(invariantValue(node.left,state)),b=number(invariantValue(node.right,state));if(a===null||b===null)return unknown;
            const n=node.op==='+'?a+b:node.op==='-'?a-b:a%b;return Number.isFinite(n)?scalar(n):unknown;
        }
        if(node.type==='Unary'&&['+','-'].includes(node.op)){
            const n=number(invariantValue(node.argument,state));return n===null?unknown:scalar(node.op==='-'?-n:n);
        }
        if(node.type==='Call'&&!node.isNew&&!node.constructorCall&&!Object.hasOwn(node,'typeArguments')&&
            node.args?.length===1&&effect(node)?.kind==='round'){
            const n=number(invariantValue(node.args[0],state));return n===null?unknown:scalar(Math.round(n));
        }
        return unknown;
    };
    for(const call of nodes) {
        if(call.type!=='Call'||call.isNew||call.constructorCall||Object.hasOwn(call,'typeArguments')||call.args?.length!==0||
            call.callee?.type!=='Member'||call.callee.name!=='clone'||call.callee.object?.type!=='Index')continue;
        const entries=roots(owners.get(call));
        if(!entries?.callbacks.size||visits.get(call)!==entries.ordinary&&!(entries.ordinary===0&&!visits.has(call))||votes.get(call)===false)continue;
        let okay=true;
        for(const callback of entries.callbacks) {
            const boundary=invariantBoundaries.get(callback)[0];
            if(entryCount(owners.get(boundary.registration))!==1){okay=false;break;}
            const index=call.callee.object,array=invariantValue(index.object,boundary.env),n=number(invariantValue(index.index,boundary.env));
            if(array?.kind!=='Array'||n===null||!Number.isInteger(n)||n<0||n>=array.items.length||array.items[n]?.kind!=='Image'){okay=false;break;}
        }
        if(okay)invariantVotes.add(call);
    }
    let expired=false;
    return Object.freeze({has:call=>{
        if(expired)return false;
        if(!snapshot.current()||!effectsCurrent()){expired=true;return false;}
        const expected=entryCount(owners.get(call));
        return Number.isFinite(expected)&&expected>0&&votes.get(call)===true&&visits.get(call)===expected||invariantVotes.has(call);
    }});
    });
}


// Shared complete validator: public entry retains its original eager graph and
// option observations. No caller can supply a graph/factory to this engine.
function primitiveConstraintGraphOptions(program,ordinaryPrimitiveSdkNumbers,sceneClockNumbers,closedOrdinaryEntries=false) {
 // A comparison, `!` or typeof of proved primitive operands is a primitive
 // producer for this consumer (exported Code booleans are `0 < 1` helpers).
 // A callback closure is allocated after the bindings already initialized
 // at that point; they stay initialized inside its body.
 // Structural binary helpers (`function h(a,b){return a OP b}` at the top
 // level, declared once and never written) are specialized per call site, as
 // the callable source gate does: each call is Number only from Number operands.
 // Fixed bitwise helpers use their actual body normal-return Number fact instead;
 // specializing them by numeric operands would incorrectly reject Array input.
 const helperNames=new Map();
 for(const fn of program.body||[]){
  const value=fn?.type==='FunctionDeclaration'&&fn.params?.length===2&&new Set(fn.params).size===2&&fn.body?.length===1&&fn.body[0].type==='Return'&&fn.body[0].value;
  if(value?.type==='Binary'&&['+','-','*','/','%'].includes(value.op)&&value.left?.type==='Identifier'&&value.right?.type==='Identifier'&&value.left.name===fn.params[0]&&value.right.name===fn.params[1])
   helperNames.set(fn.name,helperNames.has(fn.name)?null:fn);
  // The exported runtime-dispatch addition helper is `+` for non-Array
  // operands; Number operands are never Arrays, so the same rule holds.
  else if(isRuntimeDispatchAddDeclaration(fn))helperNames.set(fn.name,helperNames.has(fn.name)?null:fn);
  // The exported unary-plus helper (`function h(a){return +a}`) is the same
  // structural case with one operand: each call is Number only from its own
  // Number operand, so another call site's operand cannot void this one.
  else {
   const unary=fn?.type==='FunctionDeclaration'&&fn.params?.length===1&&fn.body?.length===1&&fn.body[0].type==='Return'&&fn.body[0].value;
   if(unary?.type==='Unary'&&unary.op==='+'&&unary.argument?.type==='Identifier'&&unary.argument.name===fn.params[0])
    helperNames.set(fn.name,helperNames.has(fn.name)?null:fn);
  }
 }
 const written=new Set();const scanWrites=node=>{if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(scanWrites);return;}
  if(node.type==='Assignment'||node.type==='Update'){let target=node.type==='Assignment'?node.left:node.argument;while(['Member','Index'].includes(target?.type))target=target.object;if(target?.type==='Identifier')written.add(target.name);}
  if(node.type==='Declaration')for(const decl of node.decls||[])written.add(decl.name);
  if(Array.isArray(node.params))for(const name of node.params)written.add(name);
  for(const child of Object.values(node))if(child&&typeof child==='object')scanWrites(child);};
 scanWrites(program);
 const numericHelpers=new Set([...helperNames].filter(([name,fn])=>fn&&!written.has(name)).map(([,fn])=>fn));
 return {unboundIsOpaque:true,opaqueDeclarationValues:true,ordinaryPrimitiveSdkNumbers,sceneClockNumbers,closedNumericArrayResults:ordinaryPrimitiveSdkNumbers,arrayCallbackParameters:true,arrayLoopEntries:true,provenArrayLength:true,primitiveComparisons:true,closureEntries:true,numericHelpers,closedOrdinaryEntries};
}
export function validateProcedureConstraintSource(program,{onlyFunctions=null,ordinaryPrimitiveSdkNumbers=false,sceneClockNumbers=false,closedOrdinaryEntries=false}={}) {
 const graph=analyseSourceValues(program,primitiveConstraintGraphOptions(program,ordinaryPrimitiveSdkNumbers,sceneClockNumbers,closedOrdinaryEntries),null,null,true);
 return validatePrimitiveConstraintGraph(program,graph,onlyFunctions);
}
function validatePrimitiveConstraintGraph(program,graph,onlyFunctions) {
 const originalConstraintTypes=graph.constraintTypesAt||graph.typesAt;
 const classNumber=closedClassPrimitiveSource(program,graph);
 const constraintTypes=node=>classNumber(node)?new Set(['Number']):originalConstraintTypes(node);
 const functions=new Map(),uses=[],calls=[],writes=[];
 const ordinary=new Set((program.body||[]).filter(node=>node.type==='FunctionDeclaration'&&(!onlyFunctions||onlyFunctions.has(node.name))));
 const walk=(node,parent=null,key=null)=>{
  if(!node||typeof node!=='object')return;
  if(Array.isArray(node)){node.forEach(child=>walk(child,parent,key));return;}
  if(ordinary.has(node)) {const selected=constraints(node);if(selected.length)functions.set(node,{selected,escaped:false});}
  if(node.type==='Identifier')uses.push({node,parent,key});
  if(node.type==='Call')calls.push(node);
  if(node.type==='Assignment'||node.type==='Update')writes.push(node);
  for(const [name,value] of Object.entries(node))if(value&&typeof value==='object')walk(value,node,name);
 };
 walk(program);
 // The callable/named/registered-callback lanes retain escaped function values.
 // This ordinary declaration protocol only handles truly unescaped declarations.
 for(const {node,parent,key} of uses) {
  const declaration=graph.unchangedFunctionAt(node),entry=functions.get(declaration);
  if(entry&&!(parent?.type==='Call'&&key==='callee'))entry.escaped=true;
 }
 const diagnostics=[];
 for(const [fn,entry] of functions) {
  if(entry.escaped)continue;
  const requireTypes=(types,type,label)=>{if(type==='Any')return;if(!types.size||[...types].some(actual=>actual!==type))diagnostics.push(`Procedure parameter constraint: ${label} requires ${type} from actual producers`);};
  // Default metadata is not a producer. Check the actual conditional RHS on
  // the same source AST; only this bounded primitive default slice is selected.
  for(let index=0;index<(fn.parameterDefaults||[]).length;index++){
   const value=fn.body[index].consequent[0].expr.right,types=constraintTypes(value),parameterIndex=fn.params.indexOf(fn.parameterDefaults[index].name);
   const formalBindings=new Map(fn.params.map((name,index)=>[graph.bindingOf(fn.body[0],name),index]).filter(([binding])=>binding));
   const inspect=node=>{if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(inspect);return;}if(node.type==='Identifier'&&formalBindings.has(graph.bindingOf(node))&&formalBindings.get(graph.bindingOf(node))>=parameterIndex)diagnostics.push(`Procedure parameter constraint: ${fn.name} default cannot reference its own or a later formal`);for(const child of Object.values(node))if(child&&typeof child==='object')inspect(child);};inspect(value);
   if(!types.size||[...types].some(type=>!['Number','String','Boolean','Null','Undefined'].includes(type)))diagnostics.push(`Procedure parameter constraint: ${fn.name} default requires actual primitive producers`);
  }
  const incoming=calls.filter(call=>graph.unchangedFunctionAt(call)===fn);
  for(const call of incoming) {
   if(call.isNew||call.typeArguments?.length||call.args.length>fn.params.length||fn.params.slice(call.args.length).some(name=>!fn.optionalParams?.includes(name)||fn.paramTypes?.[name]?.text!=='any')){diagnostics.push('Procedure parameter constraint: actual call argument count/shape differs');continue;}
   if(graph.ordinaryEntryUnreachableAt?.(call))continue;
   for(const constraint of entry.selected)requireTypes(constraintTypes(call.args[fn.params.indexOf(constraint.name)]),constraint.type,`${fn.name}.${constraint.name}`);
  }
  // All assignments into an actual formal must discharge its contract. Its
  // declared type is deliberately absent from the actual RHS producer proof.
  const formalBindings=new Map(),anchor=fn.body?.[0];
  for(const name of fn.params)if(anchor&&graph.bindingKindsAt(anchor,name).has('parameter'))formalBindings.set(graph.bindingOf(anchor,name),name);
  for(const writer of writes) {
   const lhs=writer.type==='Update'?writer.argument:writer.left;
   if(lhs?.type!=='Identifier')continue;const name=formalBindings.get(graph.bindingOf(lhs)),constraint=entry.selected.find(c=>c.name===name);if(!constraint)continue;
   if(writer.type==='Update'||writer.op!=='='){
    if(constraint.type==='Any')continue;
    const numeric=constraint.type==='Number'&&(writer.type==='Update'?['++','--'].includes(writer.op):['+=','-=','*=','/=','%=','|=','&=','^=','<<=','>>=','>>>='].includes(writer.op));
    if(!numeric)diagnostics.push(`Procedure parameter constraint: ${fn.name}.${name} compound writer differs`);
    else if(writer.type!=='Update')requireTypes(constraintTypes(writer.right),'Number',`${fn.name}.${name} compound writer`);
   }else requireTypes(constraintTypes(writer.right),constraint.type,`${fn.name}.${name} writer`);
  }
 }
 return Object.freeze([...new Set(diagnostics)]);
}

// Compiler-only CameraProperty derivation. These records and graphs never leave
// this module. The complete entry below is called only by the synchronous owned
// parser/normalizer preparation path; own-data rows are not a Proxy-origin token.
const cameraRealm=globalThis,cameraKeys=Reflect.ownKeys,cameraDescriptor=Object.getOwnPropertyDescriptor;
const cameraPrototype=Object.getPrototypeOf,cameraOwn=Object.hasOwn,cameraSame=Object.is,cameraApply=Reflect.apply;
const CameraSet=Set,CameraWeakSet=WeakSet,cameraFreeze=Object.freeze,cameraDefine=Object.defineProperty;
const cameraWeakHas=WeakSet.prototype.has,cameraWeakAdd=WeakSet.prototype.add;
const cameraSetHas=Set.prototype.has,cameraSetAdd=Set.prototype.add,cameraSetDelete=Set.prototype.delete;
const cameraSetValues=Set.prototype.values,cameraSetNext=cameraPrototype(new Set().values()).next;
const cameraObjectPrototype=Object.prototype,cameraArrayPrototype=Array.prototype;
const cameraRow=object=>{
    const names=cameraKeys(object),fields=[];
    for(let i=0;i<names.length;i++)fields[i]=cameraDescriptor(object,names[i]);
    return {object,parent:cameraPrototype(object),names,fields};
};
const cameraRowCurrent=row=>{
    const names=cameraKeys(row.object);
    if(cameraPrototype(row.object)!==row.parent||names.length!==row.names.length)return false;
    for(let i=0;i<names.length;i++){
        if(names[i]!==row.names[i])return false;
        const before=row.fields[i],now=cameraDescriptor(row.object,names[i]);
        if(!now||now.enumerable!==before.enumerable||now.configurable!==before.configurable||
            cameraOwn(now,'value')!==cameraOwn(before,'value'))return false;
        if(cameraOwn(before,'value')){
            if(now.writable!==before.writable||!cameraSame(now.value,before.value))return false;
        }else if(now.get!==before.get||now.set!==before.set)return false;
    }
    return true;
};
const cameraIntrinsicObjects=[Object,Array,Map,Set,WeakMap,WeakSet,Reflect,Function,String,Number,RegExp,JSON,
    Object.prototype,Array.prototype,Map.prototype,Set.prototype,WeakMap.prototype,WeakSet.prototype,
    Function.prototype,String.prototype,Number.prototype,RegExp.prototype];
// Include actual native iterator prototypes and every shared ancestor.
for(const iterator of [[][Symbol.iterator](),new Map().entries(),new Set().values()]){
    let proto=cameraPrototype(iterator);
    while(proto){if(!cameraIntrinsicObjects.includes(proto))cameraIntrinsicObjects.push(proto);proto=cameraPrototype(proto);}
}
const cameraIntrinsicRows=[];
for(let i=0;i<cameraIntrinsicObjects.length;i++)cameraIntrinsicRows[i]=cameraRow(cameraIntrinsicObjects[i]);
const cameraGlobalNames=['globalThis','Object','Array','Map','Set','WeakMap','WeakSet','Reflect','Function','String','Number','RegExp','JSON'];
const cameraGlobalFields=[];
for(let i=0;i<cameraGlobalNames.length;i++)cameraGlobalFields[i]=cameraDescriptor(cameraRealm,cameraGlobalNames[i]);
const cameraIntrinsicsCurrent=()=>{
    for(let i=0;i<cameraIntrinsicRows.length;i++)if(!cameraRowCurrent(cameraIntrinsicRows[i]))return false;
    for(let i=0;i<cameraGlobalNames.length;i++){
        const before=cameraGlobalFields[i],now=cameraDescriptor(cameraRealm,cameraGlobalNames[i]);
        if(!now||!cameraOwn(now,'value')||!cameraOwn(before,'value')||now.value!==before.value||
            now.enumerable!==before.enumerable||now.configurable!==before.configurable||now.writable!==before.writable)return false;
    }
    return true;
};
// Necessary-candidate filter only, at the same private owned-data boundary.
// Absence selects the complete original validator; presence proves nothing.
// Captured operations avoid mutable iteration helpers and inherited index setters.
function compilerMayHaveCameraMember(program){
    try{
        const pending=[program],seen=new CameraWeakSet();
        while(pending.length){
            const value=pending[pending.length-1];pending.length--;
            if(!value||typeof value!=='object')continue;
            if(cameraApply(cameraWeakHas,seen,[value]))continue;
            cameraApply(cameraWeakAdd,seen,[value]);
            const proto=cameraPrototype(value);
            if(proto!==cameraObjectPrototype&&proto!==cameraArrayPrototype&&proto!==null)return true;
            const type=cameraDescriptor(value,'type'),object=cameraDescriptor(value,'object');
            if(type&&cameraOwn(type,'value')&&type.value==='Member'&&object&&cameraOwn(object,'value')&&object.value&&typeof object.value==='object'){
                const kind=cameraDescriptor(object.value,'type'),name=cameraDescriptor(object.value,'name');
                if(kind&&cameraOwn(kind,'value')&&kind.value==='Identifier'&&name&&cameraOwn(name,'value')&&name.value==='CameraProperty')return true;
            }
            const keys=cameraKeys(value);
            for(let i=0;i<keys.length;i++){
                const field=cameraDescriptor(value,keys[i]);
                if(typeof keys[i]!=='string'||!field||!cameraOwn(field,'value'))return true;
                if(field.value&&typeof field.value==='object')cameraDefine(pending,pending.length+'',{value:field.value,writable:true,enumerable:true,configurable:true});
            }
        }
        return false;
    }catch{return true;}
}
function compilerCameraNumberInput(program){
    let expired=false;const rows=[];
    const current=()=>{
        if(expired)return false;
        try{
            if(!cameraIntrinsicsCurrent()){expired=true;return false;}
            for(let i=0;i<rows.length;i++)if(!cameraRowCurrent(rows[i])){expired=true;return false;}
            if(!cameraIntrinsicsCurrent()){expired=true;return false;}
            return true;
        }catch{expired=true;return false;}
    };
    try{
        if(!cameraIntrinsicsCurrent())return null;
        const seen=new CameraSet(),active=new CameraSet(),pending=[{value:program,depth:0,leave:false}];let slots=0;
        while(pending.length){
            const item=pending[pending.length-1];pending.length--;const value=item.value;
            if(value===null||typeof value!=='object'){
                if(['function','symbol','bigint'].includes(typeof value))return null;
                continue;
            }
            if(item.leave){cameraApply(cameraSetDelete,active,[value]);continue;}
            if(cameraApply(cameraSetHas,active,[value]))return null;
            if(cameraApply(cameraSetHas,seen,[value]))continue;
            if(item.depth>128||rows.length>=50000)return null;
            const parent=cameraPrototype(value);
            if(parent!==cameraObjectPrototype&&parent!==cameraArrayPrototype&&parent!==null)return null;
            const row=cameraRow(value);if((slots+=row.names.length)>500000)return null;
            cameraApply(cameraSetAdd,seen,[value]);cameraApply(cameraSetAdd,active,[value]);rows[rows.length]=row;
            pending[pending.length]={value,depth:item.depth,leave:true};
            for(let i=row.names.length-1;i>=0;i--){
                const key=row.names[i],field=row.fields[i];
                if(typeof key!=='string'||!field||!cameraOwn(field,'value'))return null;
                pending[pending.length]={value:field.value,depth:item.depth+1,leave:false};
            }
        }
        if(!current()||program?.type!=='Program'||!Array.isArray(program.body))return null;
        const metadata=new CameraSet(['originalBody','parameterDefaults','paramTypes','typeParameters','returnType','assertedType',
            'bwProcedureConstraintSource','optionalParams','parameterProperties','sourceReferenceDeclarations','sourceCallableDeclarations','sourceScalarDeclarations']);
        const nodes=[],parents=new WeakMap(),executables=new CameraWeakSet();let unsafe=false;
        const collect=(node,parent=null)=>{
            if(!node||typeof node!=='object')return;
            if(executables.has(node)){unsafe=true;return;}executables.add(node);
            if(Array.isArray(node)){for(const child of node)collect(child,parent);return;}
            nodes.push(node);parents.set(node,parent);
            for(const[key,value]of Object.entries(node))if(!metadata.has(key))collect(value,node);
        };
        collect(program);if(unsafe)return null;
        // Reuse the existing lexical SDK resolver, after proving that every
        // binding-bearing executable form is covered at this owned normalizer
        // seam. Residual destructuring/namespace/enum/ForOf and unknown forms
        // decline this optional derivation rather than inventing a binding.
        const knownForms=new CameraSet(['Program','Block','Declaration','FunctionDeclaration','FunctionExpression',
            'Class','For','While','If','Switch','ExpressionStatement','Return','Break','Continue',
            'Identifier','Member','Index','Call','Assignment','Update','Binary','Unary','Conditional',
            'Array','Object','Number','String','Boolean','Null','Undefined','Template','Interface']);
        for(const node of nodes){
            if(node.type!==undefined&&!knownForms.has(node.type))unsafe=true;
            if(node.type==='Declaration'&&(!['let','const','var'].includes(node.kind)||!Array.isArray(node.decls)||
                node.decls.some(decl=>typeof decl.name!=='string')))unsafe=true;
            if(node.type==='FunctionDeclaration'||node.type==='FunctionExpression'){
                if(!Array.isArray(node.params)||node.params.some(name=>typeof name!=='string')||!Array.isArray(node.body)||
                    node.type==='FunctionDeclaration'&&typeof node.name!=='string')unsafe=true;
            }
            if(node.type==='Object'&&!Array.isArray(node.props))unsafe=true;
            if(node.type==='Template'&&typeof node.tag==='string'&&
                (node.tag==='CameraProperty'||node.tag.startsWith('CameraProperty.')))unsafe=true;
            if(node.type==='Class'){
                if(node.unsupported?.length)unsafe=true;
                if(typeof node.name!=='string'||!Array.isArray(node.fields)||!Array.isArray(node.methods))unsafe=true;
                for(const method of [...(node.methods||[]),...(node.ctor?[node.ctor]:[])]){
                    if(!Array.isArray(method.params)||method.params.some(name=>typeof name!=='string')||!Array.isArray(method.body))unsafe=true;
                }
            }
        }
        if(unsafe||!current())return null;
        const sdk=staticSdkNamespaceReceivers(program);
        const candidates=new CameraWeakSet();let candidateCount=0;
        for(const node of nodes){
            const parent=parents.get(node);
            // These dynamic lexical/reflective constructs remain uncertain.
            // Unrelated ordinary calls, callbacks, arrays, classes and local
            // writes do not execute during compilation and cannot alter the
            // canonical EnumMember's compile-time constant value.
            if(node.type==='Identifier'&&['eval','Function'].includes(node.name))unsafe=true;
            if(node.type!=='Identifier'||node.name!=='CameraProperty'||!sdk.has(node))continue;
            const member=parent;
            if(member?.type!=='Member'||member.object!==node||!sdk.has(member)||
                !cameraOwn(CAMERA_PROPERTIES,member.name)||member.optional||member.computed||node.assertedType||member.assertedType){unsafe=true;continue;}
            const owner=parents.get(member);
            if(owner?.type==='Assignment'&&owner.left===member||owner?.type==='Update'&&owner.argument===member||
                owner?.type==='Unary'&&owner.op==='delete'||owner?.type==='Call'&&owner.callee===member){unsafe=true;continue;}
            let ancestor=owner;
            while(ancestor){
                if(ancestor.assertedType||ancestor.type==='As'||ancestor.type==='TypeAssertion'){unsafe=true;break;}
                ancestor=parents.get(ancestor);
            }
            candidates.add(member);candidateCount++;
        }
        if(unsafe||!candidateCount||!current())return null;
        return cameraFreeze({current,has:node=>cameraApply(cameraWeakHas,candidates,[node])&&current()});
    }catch{return null;}
}

/** Internal COMPLETE compiler-owned derivation, not a public AST proof API.
 * The only production client is prepareConstraints' existing compiler-owned
 * branch after actual parsing/owned normalizers. No graph or cheap getter escapes.
 * External low-level analysis and public validation keep the original path.
 */
export function validateCompilerOwnedProcedureConstraintSource(program,{onlyFunctions=null,ordinaryPrimitiveSdkNumbers=false,sceneClockNumbers=false,closedOrdinaryEntries=false}={}){
    const original=()=>validateProcedureConstraintSource(program,{onlyFunctions,ordinaryPrimitiveSdkNumbers,sceneClockNumbers,closedOrdinaryEntries});
    if(!ordinaryPrimitiveSdkNumbers||!compilerMayHaveCameraMember(program))return original();
    let selected=onlyFunctions,eligible=true;
    try{
        if(!cameraIntrinsicsCurrent())eligible=false;
        // No foreign caller Set method runs on the internal path. The actual
        // prepare client makes this native Set locally; uncertain inputs fallback.
        if(eligible&&selected!==null){
            if(cameraPrototype(selected)!==CameraSet.prototype||cameraKeys(selected).length)eligible=false;
            else{
                const copied=new CameraSet(),iterator=cameraApply(cameraSetValues,selected,[]);
                for(;;){const item=cameraApply(cameraSetNext,iterator,[]);if(item.done)break;cameraApply(cameraSetAdd,copied,[item.value]);}
                if(!cameraIntrinsicsCurrent())eligible=false;selected=copied;
            }
        }
    }catch{eligible=false;}
    // Invoke fallback outside the observer catch. Original semantic errors and
    // getter/callback side effects are observed exactly once, never retried.
    if(!eligible)return original();
    const proof=compilerCameraNumberInput(program);if(!proof)return original();
    const options=primitiveConstraintGraphOptions(program,ordinaryPrimitiveSdkNumbers,sceneClockNumbers,closedOrdinaryEntries);
    const graph=analyseSourceValues(program,options,null,proof,true);
    const diagnostics=validatePrimitiveConstraintGraph(program,graph,selected);
    return proof.current()?diagnostics:original();
}
