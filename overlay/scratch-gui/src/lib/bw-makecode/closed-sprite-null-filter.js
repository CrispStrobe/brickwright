import {parseMakeCodeTs} from './ts-import.js';
import {inspectGeneratedHelperBindings,GENERATED_HELPER_PROFILES,mapGeneratedSourceArray} from './generated-helper-recognition.js';
import {executableBindings} from './closed-created-image-dimensions.js';
let active=null,next=0;
const consumers=new WeakMap();
const number=(node,value)=>node?.type==='Number'&&Number(node.value)===value;
const fn=node=>['FunctionDeclaration','FunctionExpression'].includes(node?.type);
const plainCall=node=>node?.type==='Call'&&!node.isNew&&!node.constructorCall&&!node.optional&&!node.typeArguments?.length&&Array.isArray(node.args)&&!node.args.some(n=>n?.type==='Spread');
const pure=callback=>{
    if(callback?.type!=='FunctionExpression'||callback.params?.length!==1||callback.body?.length!==1||
        ['async','isAsync','generator','isGenerator','restParam'].some(k=>callback[k])||
        ['optionalParams','parameterDefaults','parameterProperties','typeParameters'].some(k=>callback[k]?.length||callback.params[k]?.length)||Object.keys(callback.paramDefaults||{}).length)return false;
    const value=callback.body[0]?.type==='Return'&&callback.body[0].value;
    return value?.type==='Binary'&&value.op==='!='&&value.left?.type==='Identifier'&&value.left.name===callback.params[0]&&value.right?.type==='Null';
};
function prove(program) {
    const proof=inspectGeneratedHelperBindings(program,GENERATED_HELPER_PROFILES.ordinary);
    if(!proof.isCurrent())return null;
    const parent=proof.parentOf,ancestor=(n,predicate)=>{for(let p=parent(n);p;p=parent(p))if(predicate(p))return p;return null;};
    const binding=n=>n?.type==='Identifier'?proof.declarationAt(n):null;
    const roots=new Map();
    for(const s of program.body)if(s.type==='Declaration'&&s.kind==='let')for(const d of s.decls||[])if(d.init?.type==='Array'&&!d.init.items.length&&proof.unique(d.name))roots.set(d,d.name);
    const sites=proof.nodes.filter(n=>plainCall(n)&&n.callee?.type==='Member'&&n.callee.name==='filter');
    if(!sites.length)return null;
    const arrays=new Set();
    for(const site of sites){
        const decl=binding(site.callee.object),assignment=parent(site),statement=parent(assignment);
        if(!roots.has(decl)||site.args.length!==1||!pure(site.args[0])||assignment?.type!=='Assignment'||assignment.op!=='='||assignment.right!==site||binding(assignment.left)!==decl||statement?.type!=='ExpressionStatement'||statement.expr!==assignment||ancestor(site,n=>['For','ForOf','While','DoWhile'].includes(n.type)))return null;
        arrays.add(decl);
    }
    const member=(n,name,decl)=>n?.type==='Member'&&n.name===name&&binding(n.object)===decl&&!n.optional;
    const write=(n,target)=>n.type==='Assignment'&&n.left===target||n.type==='Update'&&n.argument===target||n.type==='Unary'&&n.op==='delete'&&n.argument===target;
    const ownedSprite=node=>{
        const decl=binding(node),init=decl?.init;
        return !!decl&&plainCall(init)&&init.args.length===2&&init.callee?.type==='Member'&&init.callee.name==='create'&&init.callee.object?.type==='Identifier'&&init.callee.object.name==='sprites'&&proof.unbound(init.callee.object)&&!proof.nodes.some(n=>(n.type==='Assignment'&&binding(n.left)===decl)||(n.type==='Update'&&binding(n.argument)===decl));
    };
    const bounded=(index,decl)=>{
        if(index?.type!=='Identifier')return false;
        const loop=ancestor(index,n=>n.type==='For'&&n.init?.type==='Declaration'&&n.init.kind==='let'&&n.init.decls?.length===1&&binding(index)===n.init.decls[0]);
        if(!loop)return false;
        const cell=loop.init.decls[0],same=n=>binding(n)===cell,update=loop.update;
        if(update?.type!=='Update'||!same(update.argument))return false;
        const ascending=number(cell.init,0)&&loop.test?.type==='Binary'&&loop.test.op==='<'&&same(loop.test.left)&&member(loop.test.right,'length',decl)&&update.op==='++';
        const descending=cell.init?.type==='Binary'&&cell.init.op==='-'&&member(cell.init.left,'length',decl)&&number(cell.init.right,1)&&loop.test?.type==='Binary'&&loop.test.op==='>='&&same(loop.test.left)&&number(loop.test.right,0)&&update.op==='--';
        return (ascending||descending)&&!proof.nodes.some(n=>n!==update&&(n.type==='Assignment'&&same(n.left)||n.type==='Update'&&same(n.argument)));
    };
    const path=n=>n?.type==='Identifier'?n.name:n?.type==='Member'?path(n.object)+'.'+n.name:null;
    const sdkRoots=new Set(['sprites','game','controller','screen','Math','SpriteKind','ControllerButtonEvent']);
    const sdkCalls=new Set(['sprites.create','game.onUpdate','game.runtime','screen.fillRect','screen.print','Math.percentChance','Math.randomRange','SpriteKind.create']);
    const indices=new Set();
    for(const n of proof.nodes){
        if(n.type==='Unknown'||n.type==='Member'&&['constructor','prototype','__proto__'].includes(n.name)||n.type==='Identifier'&&['Array','Object','Reflect','Proxy','eval','Function','globalThis','global','window','self','arguments'].includes(n.name))return null;
        if(n.type==='Identifier'&&sdkRoots.has(n.name)){
            if(!proof.unbound(n))return null;
            let top=n;while(parent(top)?.type==='Member'&&parent(top).object===top)top=parent(top);
            const invoke=parent(top),name=path(top);
            const enumRead=['SpriteKind','ControllerButtonEvent'].includes(n.name)&&top.type==='Member'&&top.object===n&&!write(invoke,top);
            if(!enumRead&&(!plainCall(invoke)||invoke.callee!==top||!sdkCalls.has(name)&&!/^controller\.(?:A|B|up|down|left|right)\.(?:onEvent|isPressed)$/.test(name||'')))return null;
        }
        if(n.type==='Identifier'&&n.name==='sprites'){
            const m=parent(n),call=parent(m);
            if(!proof.unbound(n)||m?.type!=='Member'||m.object!==n||m.name!=='create'||!plainCall(call)||call.callee!==m||call.args.length!==2)return null;
        }
        if(n.type==='Identifier'&&arrays.has(binding(n))){
            const decl=binding(n),use=parent(n),above=parent(use);
            if(use?.type==='Assignment'&&use.left===n&&sites.includes(use.right))continue;
            if(use?.type==='Member'&&use.object===n&&!use.optional){
                if(use.name==='length'&&!write(above,use))continue;
                if(use.name==='filter'&&sites.includes(above)&&above.callee===use)continue;
                if(use.name==='push'&&plainCall(above)&&above.callee===use&&above.args.length===1&&ownedSprite(above.args[0]))continue;
                return null;
            }
            if(use?.type==='Index'&&use.object===n&&bounded(use.index,decl)){
                indices.add(use);
                if(above?.type==='Assignment'&&above.left===use){if(above.op==='='&&above.right?.type==='Null')continue;return null;}
                if(plainCall(above)&&above.args.length===1&&above.args[0]===use&&above.callee?.type==='Member'&&above.callee.name==='overlapsWith'&&above.callee.object?.type==='Index'&&arrays.has(binding(above.callee.object.object))&&bounded(above.callee.object.index,binding(above.callee.object.object)))continue;
                if(above?.type==='Member'&&above.object===use&&!above.optional){
                    if(['x','y','vx','vy'].includes(above.name))continue;
                    const invoke=parent(above);
                    if(plainCall(invoke)&&invoke.callee===above&&(above.name==='destroy'&&invoke.args.length===0||above.name==='overlapsWith'&&invoke.args.length===1&&invoke.args[0]?.type==='Index'&&arrays.has(binding(invoke.args[0].object))&&bounded(invoke.args[0].index,binding(invoke.args[0].object))))continue;
                }
                return null;
            }
            return null;
        }
    }
    const spriteFactory=n=>plainCall(n)&&n.args.length===2&&path(n.callee)==='sprites.create'&&proof.unbound(n.callee.object);
    const stableSprite=n=>{
        const decl=binding(n);if(!decl)return false;
        const writes=proof.nodes.filter(v=>v.type==='Assignment'&&binding(v.left)===decl||v.type==='Update'&&binding(v.argument)===decl);
        return (!decl.init||spriteFactory(decl.init))&&(!!decl.init||writes.length>0)&&writes.every(v=>v.type==='Assignment'&&v.op==='='&&spriteFactory(v.right));
    };
    for(const n of proof.nodes){
        const target=n.type==='Assignment'?n.left:n.type==='Update'||n.type==='Unary'&&n.op==='delete'?n.argument:null;
        if(target?.type==='Member'&&['destroy','overlapsWith','setPosition','setVelocity','setStayInScreen'].includes(target.name))return null;
        if(!plainCall(n)||n.callee?.type!=='Member')continue;
        const c=n.callee,root=path(c)?.split('.')[0];
        if(sdkRoots.has(root)||arrays.has(binding(c.object)))continue;
        if(c.object?.type==='Index'&&indices.has(c.object)&&['destroy','overlapsWith'].includes(c.name))continue;
        if(stableSprite(c.object)&&(['setPosition','setVelocity'].includes(c.name)&&n.args.length===2||c.name==='setStayInScreen'&&n.args.length===1||c.name==='destroy'&&n.args.length===0))continue;
        return null;
    }
    if(proof.nodes.some(n=>n.type==='Index'&&!indices.has(n)))return null;
    // Filtering may not shrink an array reentrantly inside its index loops.
    const owners=new Set(sites.map(n=>ancestor(n,fn))),calls=new Map(),pauses=[];
    for(const n of proof.nodes)if(plainCall(n)&&n.callee?.type==='Identifier'){
        const target=binding(n.callee);
        if(proof.unbound(n.callee)&&n.callee.name==='pause'&&n.args.length===1&&n.args[0]?.type==='Number'){pauses.push(n);continue;}
        if(target?.type!=='FunctionDeclaration')return null;
        const owner=ancestor(n,fn);if(!calls.has(owner))calls.set(owner,new Set());calls.get(owner).add(target);
    }
    const shrinks=(owner,seen=new Set())=>owners.has(owner)||seen.has(owner)||[...(calls.get(owner)||[])].some(target=>shrinks(target,new Set([...seen,owner])));
    for(const n of proof.nodes)if(plainCall(n)&&n.callee?.type==='Identifier'&&ancestor(n,p=>['For','ForOf','While','DoWhile'].includes(p.type))&&shrinks(binding(n.callee)))return null;
    // A pause reachable inside an index loop needs a monotonic stop fence:
    // set it before yielding, and all reentrant filter entries test !fence.
    const pauseOwners=new Set(pauses.map(n=>ancestor(n,fn)));
    const mayPause=(owner,seen=new Set())=>pauseOwners.has(owner)||seen.has(owner)||[...(calls.get(owner)||[])].some(target=>mayPause(target,new Set([...seen,owner])));
    const guarded=(node,flag)=>{for(let p=parent(node),child=node;p&&!fn(p);child=p,p=parent(p))if(p.type==='If'&&p.consequent?.includes(child)&&p.test?.type==='Unary'&&p.test.op==='!'&&binding(p.test.argument)===flag)return true;return false;};
    const fenced=(target,flag,seen=new Set())=>{
        if(!target||seen.has(target)||target.exported)return false;
        const refs=proof.nodes.filter(n=>n.type==='Identifier'&&binding(n)===target);
        return refs.length>0&&refs.every(n=>{const use=parent(n);return plainCall(use)&&use.callee===n&&(guarded(use,flag)||fenced(ancestor(use,fn),flag,new Set([...seen,target])));});
    };
    for(const call of proof.nodes.filter(n=>plainCall(n)&&n.callee?.type==='Identifier'&&ancestor(n,p=>['For','ForOf','While','DoWhile'].includes(p.type)))){
        if(pauses.includes(call))return null;
        const target=binding(call.callee);if(!mayPause(target))continue;
        const first=target?.body?.[0]?.expr,flag=first?.type==='Assignment'&&first.op==='='&&first.right?.type==='Boolean'&&first.right.value===true?binding(first.left):null;
        if(!flag||!proof.unique(flag.name)||flag.init?.type!=='Boolean'||flag.init.value!==false||!program.body.some(n=>n.type==='Declaration'&&n.decls.includes(flag))||proof.nodes.some(n=>n.type==='Assignment'&&binding(n.left)===flag&&(n.op!=='='||n.right?.type!=='Boolean'||n.right.value!==true)||n.type==='Update'&&binding(n.argument)===flag)||!sites.every(n=>guarded(n,flag)||fenced(ancestor(n,fn),flag)))return null;
    }
    const last=Math.max(...[...arrays].map(d=>program.body.findIndex(s=>s.type==='Declaration'&&s.decls.includes(d))));
    for(const s of program.body.slice(0,last))if(!['Declaration','FunctionDeclaration','Enum','Namespace'].includes(s.type)||s.type==='Declaration'&&s.decls.some(d=>d.init&&!['Number','String','Boolean','Null','Array'].includes(d.init.type)))return null;
    return proof.isCurrent()?new Set([...arrays].map(d=>d.name)):null;
}
function prepare(files) {
    try {
        const keys=Reflect.ownKeys(files),rows=keys.map(key=>[key,Object.getOwnPropertyDescriptor(files,key)]),values=Object.create(null);
        for(const [key,d]of rows){if(typeof key!=='string'||!d||!Object.hasOwn(d,'value')||typeof d.value!=='string')return null;values[key]=d.value;}
        if(!Object.values(values).some(s=>/\.\s*filter\s*\(/.test(s)))return null;
        const config=JSON.parse(values['pxt.json']||'null');
        if(config&&(!Array.isArray(config.files)||!config.files.every(n=>typeof n==='string')||config.testFiles!==undefined&&(!Array.isArray(config.testFiles)||!config.testFiles.every(n=>typeof n==='string'))||config.dependencies?.device!=='*'||Object.keys(config.dependencies).some(n=>n!=='device')))return null;
        const selected=new Set([...(config?.files||['main.ts']),...(config?.testFiles||[]),...Object.keys(values).filter(n=>n.endsWith('.ts'))]),sources=[];
        for(const name of selected)if(/\.(?:ts|py|asm|c|cpp|h)$/.test(name)){
            if(!Object.hasOwn(values,name)||!/\.ts$/.test(name)||/\.(?:d|g)\.ts$/.test(name)||config?.fileDependencies&&Object.hasOwn(config.fileDependencies,name))return null;sources.push(values[name]);
        }
        const names=prove(parseMakeCodeTs(sources.join('\n'),GENERATED_HELPER_PROFILES.ordinary));if(!names)return null;
        const current=()=>{const now=Reflect.ownKeys(files);return now.length===keys.length&&now.every((key,i)=>key===keys[i])&&rows.every(([key,before])=>{const d=Object.getOwnPropertyDescriptor(files,key);return d&&Object.hasOwn(d,'value')&&d.value===before.value&&d.enumerable===before.enumerable&&d.configurable===before.configurable&&d.writable===before.writable;});};
        return {names,current,id:++next};
    } catch {return null;}
}
export function withClosedSpriteNullFilters(files,run) {
    const previous=active;active=prepare(files);
    try{return run();}finally{active=previous;}
}
export function lowerClosedSpriteNullFilters(program) {
    const scope=active;if(!scope?.current())return program;
    // Re-prove the actual lowering input; a same-named receiver is no authority.
    const actual=prove(program);if(!actual||actual.size!==scope.names.size||[...actual].some(name=>!scope.names.has(name)))return program;
    const visit=node=>{
        if(!node||typeof node!=='object')return node;
        if(Array.isArray(node))return mapGeneratedSourceArray(node,visit);
        if(plainCall(node)&&node.callee?.type==='Member'&&node.callee.name==='filter'&&scope.names.has(node.callee.object?.name)&&node.args.length===1&&pure(node.args[0]))return {type:'ClosedSpriteNullFilter',receiver:visit(node.callee.object),origin:scope.id};
        return Object.fromEntries(Object.entries(node).map(([k,v])=>[k,visit(v)]));
    };
    return visit(program);
}
export const currentClosedSpriteNullFilter=node=>node?.type==='ClosedSpriteNullFilter'&&active?.current()&&node.origin===active.id&&node.receiver?.type==='Identifier'&&active.names.has(node.receiver.name);
export function bindClosedSpriteNullFilterConsumer(translator,program) {
    if(active)consumers.set(translator,{scope:active,proof:executableBindings(program),program});
}
export function emitClosedSpriteNullFilter(translator,node) {
    const fact=consumers.get(translator),name=node.receiver?.name,decl=fact?.proof.declarationAt(node.receiver);
    if(!currentClosedSpriteNullFilter(node)||fact?.scope!==active||!fact.proof.isCurrent()||!fact.proof.unique(name)||fact.proof.ambiguousAt(node.receiver)||!fact.program.body.some(n=>n.type==='Declaration'&&n.decls.includes(decl))||!translator.provenArrayReferences?.has(node.receiver)){
        translator.note('Sprite null filter requires current complete source and actual dense receiver/writer/consumer identity');return 'undefined value';
    }
    return `arcade sprite array (${translator.expr(node.receiver)}) without null`;
}
