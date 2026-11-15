import {staticSdkNamespaceReceivers} from './static-sdk-namespaces.js';
import {analyseSourceValueProducers} from './source-value-producers.js';
import {lowerPxtStagedValues} from './lower-pxt-staged-values.js';

const plain=node=>node?.type==='Call'&&!node.isNew&&!node.constructorCall&&!node.typeArguments?.length;
const member=node=>node?.type==='Member'&&node.name==='idiv'&&node.object?.type==='Identifier'&&node.object.name==='Math';

// An SDK-looking spelling is not a producer. Escapes and any actual Math
// namespace write invalidate identity for the complete program, including late
// and conditional writes. Local/formal/namespace shadows never acquire it.
function identity(program){
    const sdk=staticSdkNamespaceReceivers(program),calls=[];let unsafe=false,idivSeen=false;
    const root=node=>node?.type==='Identifier'?node:node?.type==='Member'||node?.type==='Index'?root(node.object):null;
    const builtin=node=>{const r=root(node);return r?.name==='Math'&&sdk.has(r);};
    const visit=(node,parent=null)=>{
        if(!node||typeof node!=='object')return;
        if(Array.isArray(node)){node.forEach(value=>visit(value,parent));return;}
        if(node.type==='Namespace'&&String(node.name).split('.')[0]==='Math')unsafe=true;
        const written=node.type==='Assignment'?node.left:node.type==='Update'?node.argument:null;
        if(written&&builtin(written))unsafe=true;
        if(node.type==='Identifier'&&node.name==='Math'&&sdk.has(node)&&!(parent?.type==='Member'&&parent.object===node))unsafe=true;
        if(member(node)){idivSeen=true;if(builtin(node)&&!(parent?.type==='Call'&&parent.callee===node))unsafe=true;}
        for(const value of Object.values(node))if(value&&typeof value==='object')visit(value,node);
        if(node.type==='Call'&&member(node.callee))calls.push(node); // innermost first
    };
    visit(program);
    return {calls,unsafe:unsafe&&idivSeen,isIntrinsic:node=>!unsafe&&plain(node)&&node.args.length===2&&sdk.has(node.callee.object)};
}

function proveOperands(program,call){
    const facts=analyseSourceValueProducers(program,{parenthesized:true,unboundIsOpaque:true,opaqueDeclarationValues:true,ordinaryPrimitiveSdkNumbers:true,sceneClockNumbers:true,initializationEntries:true});
    const owners=new WeakMap(),parents=new WeakMap(),functions=new Set(),allCalls=[],callers=new Map(),escaped=new Set();
    const scan=(node,owner=null,parent=null)=>{
        if(!node||typeof node!=='object')return;
        if(Array.isArray(node)){node.forEach(value=>scan(value,owner,parent));return;}
        owners.set(node,owner);parents.set(node,parent);
        if(node.type==='FunctionDeclaration')functions.add(node);
        if(node.type==='Call')allCalls.push(node);
        for(const [key,value]of Object.entries(node))if(value&&typeof value==='object')scan(value,['FunctionDeclaration','FunctionExpression'].includes(node.type)&&key==='body'?node:owner,node);
    };scan(program);
    // Include recursive declaration bindings in the escape/caller inventory.
    // immutableFunctionAt deliberately rejects recursive result producers, so
    // it alone would miss an escaped recursive function's additional entries.
    const declared=new Map();for(const fn of functions){const binding=facts.bindingOf(fn,fn.name);if(binding)declared.set(binding,fn);}
    const declaration=node=>node?.type==='Identifier'?declared.get(facts.bindingOf(node)):null;
    for(const invocation of allCalls){const fn=declaration(invocation.callee);if(fn&&plain(invocation)){if(!callers.has(fn))callers.set(fn,[]);callers.get(fn).push(invocation);}}
    const escapes=node=>{
        if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(escapes);return;}
        if(node.type==='Identifier'){const fn=declaration(node),parent=parents.get(node);if(fn&&!(plain(parent)&&parent.callee===node&&declaration(parent.callee)===fn))escaped.add(fn);}
        Object.values(node).forEach(value=>{if(value&&typeof value==='object')escapes(value);});
    };escapes(program);
    const entry=(at,binding,path=new Set())=>{
        const owner=owners.get(at);if(escaped.has(owner))return false;
        if(facts.isBindingInitializedAt(at,binding))return true;
        // A closure cannot execute before its creation. Reprove readiness at
        // that actual expression (and its enclosing callers), not from a type
        // annotation or the callback API's name. Writer/type checks stay below.
        if(owner?.type==='FunctionExpression'&&!path.has(owner))return entry(owner,binding,new Set([...path,owner]));
        if(!owner||!functions.has(owner)||path.has(owner))return false;
        const next=new Set([...path,owner]),entries=callers.get(owner)||[];
        return entries.length>0&&entries.every(invocation=>entry(invocation,binding,next));
    };
    const checking=new Set();
    const references=node=>{
        if(!node||typeof node!=='object')return true;if(Array.isArray(node))return node.every(references);
        if(node.type==='FunctionDeclaration'||node.type==='FunctionExpression')return true;
        if(node.type==='Identifier'){
            if(facts.isSdkNamespace(node))return true;
            if(escaped.has(owners.get(node)))return false;
            const parent=parents.get(node);if(parent?.type==='Assignment'&&parent.op==='='&&parent.left===node)return true;
            if(parent?.type==='Call'&&parent.callee===node)return !!facts.immutableFunctionAt(parent);
            const binding=facts.bindingOf(node);
            return !!binding&&facts.declarationCountAt(node)===1&&(facts.isInitializedAt(node)||entry(node,binding));
        }
        if(node.type==='Call'){
            const fn=facts.immutableFunctionAt(node);
            if(fn){
                if(!plain(node)||escaped.has(fn)||checking.has(fn)||node.args.length!==fn.params.length)return false;
                checking.add(fn);const result=node.args.every(references)&&fn.body.every(references);checking.delete(fn);return result;
            }
            // Namespace calls are still selected/validated by their existing
            // emitter. They cannot make an opaque result into a Number here.
            if(!(plain(node)&&node.callee?.type==='Member'&&facts.isSdkNamespace(node.callee.object)))return false;
        }
        return Object.entries(node).every(([key,value])=>key==='originalBody'||!value||typeof value!=='object'||references(value));
    };
    const alwaysReturns=body=>(body||[]).some(node=>node.type==='Return'||node.type==='Block'&&alwaysReturns(node.body)||node.type==='If'&&alwaysReturns(node.consequent)&&alwaysReturns(node.alternate));
    const results=body=>{const out=[];const walk=node=>{if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(walk);return;}if(['FunctionDeclaration','FunctionExpression','Class'].includes(node.type))return;if(node.type==='Return')out.push(node.value);else Object.values(node).forEach(walk);};walk(body);return out;};
    const proving=new Set();
    const number=node=>{
        if(!node||proving.has(node)||!references(node))return false;
        const types=node.type==='Identifier'?facts.bindingTypesAt(node):facts.typesAt(node);
        if(types.size===1&&types.has('Number'))return true;
        // A captured read's lexical graph conservatively includes Undefined.
        // Reprove every actual return and every caller entry; never drop an
        // explicit Undefined return or an optional/mixed writer constraint.
        if(!types.size||[...types].some(type=>!['Number','Undefined'].includes(type)))return false;
        proving.add(node);let result=false;
        if(plain(node)){const fn=facts.immutableFunctionAt(node),returns=fn&&results(fn.body);result=!!fn&&alwaysReturns(fn.body)&&returns.length>0&&returns.every(number);}
        if(node.type==='Conditional')result=number(node.consequent)&&number(node.alternate);
        proving.delete(node);return result;
    };
    return call.args.every(number);
}

// Lower actual proved calls before primitive/Font consumers see their results.
// Each round exposes ordinary arithmetic producers for outer calls/results;
// no API-name result seed or public source flag is used. A failed call remains
// opaque and the whole source receives a named diagnostic.
export function lowerMathIdivValues(program){
    let current=program;const unsupported=[];
    for(;;){
        const proof=identity(current),call=proof.calls[0];if(!call){if(proof.unsafe)unsupported.push('Math.idiv requires its unchanged unaliased SDK binding');break;}
        if(!proof.isIntrinsic(call)||!proveOperands(current,call)){
            unsupported.push('Math.idiv requires the unchanged unshadowed SDK call, exactly two initialized actual Number operands and compatible all writers');break;
        }
        const next=lowerPxtStagedValues(current,{
            onlySelected:node=>node===call,
            lowerIntegerDivision(node,{expression,save}){
                if(node!==call)return null;
                const prefix=[],left=expression(node.args[0]);prefix.push(...left.prefix);const a=save(left.value,prefix);
                const right=expression(node.args[1]);prefix.push(...right.prefix);const b=save(right.value,prefix);
                for(const statement of prefix)statement.bwOrderedValuePrefix=true;
                const zero=()=>({type:'Number',value:'0'}),int=value=>({type:'Binary',op:'|',left:value,right:zero()});
                return {prefix,value:int({type:'Binary',op:'/',left:int(a),right:int(b)})};
            }
        });
        if(identity(next).calls.length>=proof.calls.length){unsupported.push('Math.idiv requires an expression context with qualified once-only ordered staging');break;}
        current=next;
    }
    return {program:current,unsupported};
}
