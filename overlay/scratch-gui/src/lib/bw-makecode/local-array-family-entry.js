import {validateLocalNumericResultEffects} from './local-numeric-result-effects.js';

// Optional ordinary-constraint entry proof for function-local push-only
// Arrays. A family is the locals of one function rooted at a single empty
// allocation and otherwise only aliased, pushed to, measured or index-read
// (no capture, escape or other write). Its elements are exactly the pushed
// values and it never shrinks. An index read that is provably in bounds
// therefore yields one of them:
// - a constant index below the straight-line pushes before the read;
// - the exporter's lowered map loop `while (I < LEN)` (directly or through an
//   immutable `left < right` helper), LEN set once before the loop to the
//   family's length, I set to 0 before it and advanced by exactly 1 as the
//   body's last statement;
// - a constant index of such a loop's single unconditional push target, below
//   the loop receiver's straight-line pushes before the loop.
// The result maps each proven read to its family's pushed value nodes.
export function proveLocalArrayFamilyReads(program,graph){return localArrayFamilyReads(program,graph,false);}

// Normal-result domain only: this does not prove bounds or an Array receiver.
// An absent slot stays Undefined; values must come from actual Number pushes.
// Cheap syntax filter only. All authority still comes from the full proof.
export function hasLocalNumericArrayResultCandidate(program){
    let empty=false,index=false,reverse=false;
    const visit=node=>{if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(visit);return;}
        if(node.type==='Array'&&node.items?.length===0)empty=true;
        if(node.type==='Index')index=true;
        if(node.type==='Call'&&node.callee?.type==='Member'&&node.callee.name==='reverse'&&node.args?.length===0)reverse=true;
        for(const value of Object.values(node))if(value&&typeof value==='object')visit(value);};
    visit(program);return empty&&index&&reverse;
}

export function proveLocalNumericArrayResults(program,graph){return localArrayFamilyReads(program,graph,true);}

function localArrayFamilyReads(program,graph,primitiveResults){
    const parents=new WeakMap(),nodes=[],owners=new WeakMap();
    const FN=new Set(['FunctionDeclaration','FunctionExpression']);
    const visit=(node,parent,owner)=>{
        if(!node||typeof node!=='object')return;
        if(Array.isArray(node)){for(const child of node)visit(child,parent,owner);return;}
        parents.set(node,parent);owners.set(node,owner);nodes.push(node);
        const inner=FN.has(node.type)?node:owner;
        for(const value of Object.values(node))if(value&&typeof value==='object')visit(value,node,inner);
    };
    visit(program,null,program);
    if(primitiveResults){
        const ambient=new Set(['this','arguments','globalThis','global','window','self','eval','Function','Reflect','Object','Proxy','Array']);
        if(nodes.some(n=>['Unknown','Class','Object','Namespace','FunctionExpression'].includes(n.type)||n.opaque||
            n.type==='Identifier'&&ambient.has(n.name)||n.type==='Member'&&['constructor','prototype','__proto__'].includes(n.name)||
            n.type==='Call'&&(n.isNew||n.constructorCall||n.optional||n.typeArguments?.length||n.args?.some(a=>a?.type==='Spread'))))return null;
        for(const n of nodes){
            if(n.type==='Index'){const types=graph.typesAt(n.index);if(types.size!==1||!types.has('Number'))return null;}
            if(n.type==='Call'&&n.callee?.type==='Identifier'&&!graph.immutableFunctionAt(n))return null;
            if(n.type==='Call'&&n.callee?.type==='Member'){
                const name=n.callee.name,root=n.callee.object;
                const sdk=root?.type==='Identifier'&&graph.isSdkNamespace(root)&&
                    (root.name==='game'&&['splash','askForNumber','askForString'].includes(name)||root.name==='Math'&&name==='idiv');
                if(!sdk&&!['push','reverse','charAt'].includes(name))return null;
            }
            const target=n.type==='Assignment'?n.left:n.type==='Update'?n.argument:null;
            if(target?.type==='Member'||target?.type==='Index')return null;
            if(n.type==='Identifier'&&['game','Math'].includes(n.name)&&graph.isSdkNamespace(n)){
                const m=parents.get(n),c=parents.get(m);if(m?.type!=='Member'||m.object!==n||c?.type!=='Call'||c.callee!==m)return null;
            }
        }
    }
    const binding=(node,name=node?.name)=>graph.bindingOf(node,name);
    const ready=node=>!node||typeof node!=='object'||(Array.isArray(node)?node.every(ready):
        node.type==='Identifier'?(graph.isSdkNamespace(node)||graph.isInitializedAt(node)):Object.values(node).every(ready));
    const closed=node=>{
        if(node?.type==='Parenthesized')return closed(node.expression);
        if(node?.type==='Number'&&Number.isFinite(Number(node.value)))return Number(node.value);
        if(node?.type==='Binary'&&node.op==='+'){const a=closed(node.left),b=closed(node.right);return a===null||b===null?null:a+b;}
        return null;
    };
    const unwrap=node=>node?.type==='Parenthesized'?unwrap(node.expression):node;
    // `fn(a, b)` where fn is an immutable one-statement `return p0 OP p1`.
    const helperBinary=(node,op)=>{
        node=unwrap(node);
        if(node?.type==='Binary'&&node.op===op)return [node.left,node.right];
        if(node?.type!=='Call'||node.isNew||node.args?.length!==2||node.callee?.type!=='Identifier')return null;
        const fn=graph.immutableFunctionAt(node),ret=fn?.body?.length===1&&fn.body[0].type==='Return'?unwrap(fn.body[0].value):null;
        if(!fn||fn.params?.length!==2||ret?.type!=='Binary'||ret.op!==op||unwrap(ret.left)?.type!=='Identifier'||unwrap(ret.right)?.type!=='Identifier'||
            unwrap(ret.left).name!==fn.params[0]||unwrap(ret.right).name!==fn.params[1])return null;
        return node.args;
    };
    // `+value` directly or through an immutable `return +p0` helper.
    const helperPlus=node=>{
        node=unwrap(node);
        if(node?.type==='Unary'&&node.op==='+')return node.argument;
        if(node?.type!=='Call'||node.isNew||node.args?.length!==1||node.callee?.type!=='Identifier')return null;
        const fn=graph.immutableFunctionAt(node),ret=fn?.body?.length===1&&fn.body[0].type==='Return'?unwrap(fn.body[0].value):null;
        if(!fn||fn.params?.length!==1||ret?.type!=='Unary'||ret.op!=='+'||unwrap(ret.argument)?.type!=='Identifier'||unwrap(ret.argument).name!==fn.params[0])return null;
        return node.args[0];
    };
    const sameBinding=(node,key)=>unwrap(node)?.type==='Identifier'&&binding(unwrap(node))===key;
    const statementOf=node=>{let at=node;while(at&&parents.get(at)&&!Array.isArray(listOf(at)))at=parents.get(at);return at;};
    const listOf=statement=>{const parent=parents.get(statement);if(!parent)return null;
        for(const key of ['body','consequent','alternate']){const value=parent[key];if(Array.isArray(value)&&value.includes(statement))return value;}return null;};
    const mentions=new Map();
    for(const node of nodes)if(node.type==='Identifier'){const key=binding(node);if(key){if(!mentions.has(key))mentions.set(key,[]);mentions.get(key).push(node);}}
    const declarations=new Map();
    for(const node of nodes)if(node.type==='Declaration')for(const decl of node.decls||[]){const key=binding(node,decl.name);if(key){if(!declarations.has(key))declarations.set(key,[]);declarations.get(key).push({node,decl});}}
    const families=new Map();
    const familyOf=start=>{
        if(families.has(start))return families.get(start);
        const members=new Set(),pushes=[],allocations=[],owner={value:null};let valid=true;
        const add=key=>{
            if(!valid||members.has(key))return;members.add(key);
            for(const {node,decl} of declarations.get(key)||[]){
                if(node.kind==='const'){valid=false;return;}
                if(owner.value!==null&&owners.get(node)!==owner.value){valid=false;return;}owner.value=owners.get(node);
                if(primitiveResults&&!FN.has(owner.value?.type)){valid=false;return;}
                const init=unwrap(decl.init);
                if(!init||init.type==='Null'){if(primitiveResults)valid=false;continue;}
                if(init.type==='Array'&&Array.isArray(init.items)&&!init.items.length){allocations.push(node);continue;}
                valid=false;return;
            }
            if(!(declarations.get(key)||[]).length){valid=false;return;}
            for(const use of mentions.get(key)||[]){
                if(owners.get(use)!==owner.value){valid=false;return;}
                let child=use,parent=parents.get(use);
                while(parent?.type==='Parenthesized'){child=parent;parent=parents.get(parent);}
                if(parent?.type==='Assignment'&&parent.left===child){
                    if(parent.op!=='=' ){valid=false;return;}
                    const value=unwrap(parent.right);
                    if(value?.type==='Null'){if(primitiveResults)valid=false;continue;}
                    if(value?.type==='Array'&&Array.isArray(value.items)&&!value.items.length){allocations.push(parent);continue;}
                    if(value?.type==='Identifier'&&binding(value)){add(binding(value));continue;}
                    valid=false;return;
                }
                if(parent?.type==='Assignment'&&parent.right===child&&parent.op==='='&&parent.left?.type==='Identifier'&&binding(parent.left)){add(binding(parent.left));continue;}
                if(parent?.type==='Member'&&parent.object===child&&parent.name==='length'){
                    const outer=parents.get(parent);
                    if(outer?.type==='Call'&&outer.callee===parent||outer?.type==='Assignment'&&outer.left===parent||outer?.type==='Update'||outer?.type==='Unary'&&outer.op==='delete'){valid=false;return;}continue;}
                if(parent?.type==='Member'&&parent.object===child&&parent.name==='push'){
                    const call=parents.get(parent);if(call?.type!=='Call'||call.callee!==parent||call.args?.length!==1||call.isNew||call.optional||parent.optional){valid=false;return;}
                    if(primitiveResults&&(!graph.isInitializedAt(use)||!call.args.every(ready))){valid=false;return;}
                    pushes.push(call);continue;}
                if(primitiveResults&&parent?.type==='Member'&&parent.object===child&&parent.name==='reverse'){
                    const call=parents.get(parent);if(call?.type!=='Call'||call.callee!==parent||call.args?.length||call.isNew||call.optional||parent.optional||!graph.isInitializedAt(use)){valid=false;return;}continue;}
                if(parent?.type==='Index'&&parent.object===child){
                    const outer=parents.get(parent);if(outer?.type==='Assignment'&&outer.left===parent||outer?.type==='Update'||outer?.type==='Unary'&&outer.op==='delete'){valid=false;return;}continue;}
                valid=false;return;
            }
        };
        add(start);
        const family=valid&&allocations.length===1?{members,pushes,allocation:allocations[0]}:null;
        for(const key of members)families.set(key,family);
        return family;
    };
    if(primitiveResults)for(const node of nodes){
        if(node.type!=='Call'||node.callee?.type!=='Member')continue;
        const receiver=unwrap(node.callee.object),name=node.callee.name;
        if(['push','reverse'].includes(name)){
            const family=receiver?.type==='Identifier'&&familyOf(binding(receiver));
            if(!family||family.members.size!==1)return null;
        }
    }
    const straightPushesBefore=(family,list,before,after)=>family.pushes.filter(call=>{
        const statement=statementOf(call);const at=list.indexOf(statement);
        return at>=0&&at<list.indexOf(before)&&at>list.indexOf(after);
    }).length;
    const writersOf=key=>(mentions.get(key)||[]).map(use=>{let child=use,parent=parents.get(use);while(parent?.type==='Parenthesized'){child=parent;parent=parents.get(parent);}
        return parent?.type==='Assignment'&&parent.left===child||parent?.type==='Update'?parent:null;}).filter(Boolean);
    const loopFacts=loop=>{
        if(loop?.type!=='While'||!Array.isArray(loop.body)||loop.body.length<2)return null;
        const operands=helperBinary(loop.test,'<');if(!operands||unwrap(operands[0])?.type!=='Identifier'||unwrap(operands[1])?.type!=='Identifier')return null;
        const counter=binding(unwrap(operands[0])),limit=binding(unwrap(operands[1])),list=listOf(loop);if(!counter||!limit||!list)return null;
        const limitWriters=writersOf(limit),counterWriters=writersOf(counter);
        if(limitWriters.length!==1||limitWriters[0].type!=='Assignment'||list.indexOf(statementOf(limitWriters[0]))<0||list.indexOf(statementOf(limitWriters[0]))>list.indexOf(loop))return null;
        const length=unwrap(limitWriters[0].right);if(length?.type!=='Member'||length.name!=='length'||unwrap(length.object)?.type!=='Identifier')return null;
        const receiver=familyOf(binding(unwrap(length.object)));if(!receiver)return null;
        for(const {decl} of declarations.get(limit)||[])if(decl.init&&closed(decl.init)===null)return null;
        for(const {decl} of declarations.get(counter)||[])if(decl.init&&closed(decl.init)===null)return null;
        if(counterWriters.length!==2||counterWriters.some(writer=>writer.type!=='Assignment'||writer.op!=='='))return null;
        const init=counterWriters.find(writer=>list.includes(statementOf(writer))),step=counterWriters.find(writer=>writer!==init);
        if(!init||list.indexOf(statementOf(init))>list.indexOf(loop)||closed(init.right)!==0)return null;
        if(loop.body.at(-1)?.type!=='ExpressionStatement'||loop.body.at(-1).expr!==step)return null;
        const sum=helperBinary(step.right,'+');if(!sum||closed(sum[1])!==1)return null;
        const left=helperPlus(sum[0])??sum[0];if(!sameBinding(left,counter))return null;
        return {list,counter,receiver};
    };
    const nearestLoop=node=>{for(let at=parents.get(node);at;at=parents.get(at)){if(at.type==='While')return at;if(FN.has(at.type))return null;}return null;};
    const entries=new Map();
    for(const node of nodes){
        if(node.type!=='Index'||unwrap(node.object)?.type!=='Identifier')continue;
        const key=binding(unwrap(node.object)),family=key&&familyOf(key);if(!family||!family.pushes.length)continue;
        const values=family.pushes.map(call=>call.args[0]);
        if(primitiveResults){
            if(family.members.size!==1||!graph.isInitializedAt(node.object)||!ready(node.index))continue;
            if(!values.every(value=>{const types=graph.typesAt(value);return types.size===1&&types.has('Number');}))continue;
            entries.set(node,values);continue;
        }
        const k=closed(node.index);
        if(k!==null){
            if(!Number.isInteger(k)||k<0)continue;
            const statement=statementOf(node),list=listOf(statement),allocation=statementOf(family.allocation);
            if(!list||!list.includes(allocation)||list.indexOf(allocation)>list.indexOf(statement))continue;
            if(k<straightPushesBefore(family,list,statement,allocation)){entries.set(node,values);continue;}
            if(family.pushes.length!==1)continue;
            const pushStatement=statementOf(family.pushes[0]),loop=parents.get(pushStatement),facts=loopFacts(loop);
            if(!facts||!loop.body.includes(pushStatement)||facts.list!==list||list.indexOf(loop)>=list.indexOf(statement)||list.indexOf(allocation)>list.indexOf(loop))continue;
            const receiverAllocation=statementOf(facts.receiver.allocation);
            if(!list.includes(receiverAllocation)||list.indexOf(receiverAllocation)>list.indexOf(loop))continue;
            if(k<straightPushesBefore(facts.receiver,list,loop,receiverAllocation))entries.set(node,values);
            continue;
        }
        const index=unwrap(node.index);if(index?.type!=='Identifier')continue;
        const loop=nearestLoop(node),facts=loopFacts(loop);
        if(!facts||binding(index)!==facts.counter||!facts.receiver.members.has(key)||!loop.body.includes(statementOf(node)))continue;
        entries.set(node,values);
    }
    if(primitiveResults&&entries.size&&!validateLocalNumericResultEffects(program,graph,entries))return null;
    return entries.size?entries:null;
}
