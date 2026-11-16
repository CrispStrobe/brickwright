// Private validation of proposed local numeric reads. This walks actual seeds,
// callers and every writer; it never queries a graph containing proposed loans.
// Only a Number seed can support a Number-preserving writer induction. An
// unseeded cycle, recursive call, open entry or opaque coercion is refused.
export function validateLocalNumericResultEffects(program,graph,proposed){
    const nodes=[],parents=new WeakMap(),owners=new WeakMap(),decls=new Map(),params=new Map(),writers=new Map(),callers=new Map();
    const collect=(node,parent=null,owner=null)=>{
        if(!node||typeof node!=='object')return;
        if(Array.isArray(node)){for(const value of node)collect(value,parent,owner);return;}
        nodes.push(node);parents.set(node,parent);owners.set(node,owner);
        const inner=node.type==='FunctionDeclaration'?node:owner;
        for(const [key,value]of Object.entries(node))if(!['originalBody','paramTypes','parameterDefaults','returnType','typeParameters','assertedType'].includes(key)&&value&&typeof value==='object')collect(value,node,inner);
    };collect(program);
    const append=(map,key,value)=>{if(!key)return;if(!map.has(key))map.set(key,[]);map.get(key).push(value);};
    for(const node of nodes){
        if(node.type==='Declaration')for(const decl of node.decls||[])append(decls,graph.bindingOf(node,decl.name),decl);
        if(node.type==='FunctionDeclaration')for(const [i,name]of node.params.entries()){
            const key=graph.bindingOf(node.body[0],name);if(!key||params.has(key))return false;params.set(key,{fn:node,index:i});
        }
        if(node.type==='Assignment'&&node.left?.type==='Identifier')append(writers,graph.bindingOf(node.left),node);
        if(node.type==='Update'&&node.argument?.type==='Identifier')append(writers,graph.bindingOf(node.argument),node);
        if(node.type==='Call'&&node.callee?.type==='Identifier'){
            const fn=graph.immutableFunctionAt(node);if(!fn||node.args.length!==fn.params.length)return false;append(callers,fn,node);
        }
    }
    // A named procedure may only be entered by the inventoried direct calls.
    for(const node of nodes)if(node.type==='Identifier'&&graph.bindingKindsAt(node).has('function')){
        const p=parents.get(node);if(p?.type!=='Call'||p.callee!==node||!graph.immutableFunctionAt(p))return false;
    }
    const primitive=new Set(['Number','String','Boolean','Null','Undefined']);
    const one=type=>new Set([type]),is=(types,type)=>types?.size===1&&types.has(type);
    const scalar=types=>types?.size>0&&[...types].every(type=>primitive.has(type));
    const union=values=>values.every(Boolean)?new Set(values.flatMap(value=>[...value])):null;
    const activeBindings=new Set(),activeFunctions=new Set(),hypotheses=new Map(),memo=new Map();
    const ready=(node,key,path=new Set())=>{
        if(graph.isInitializedAt(node)||graph.isBindingInitializedAt(node,key))return true;
        const owner=owners.get(node);if(!owner||path.has(owner))return false;
        const calls=callers.get(owner)||[],next=new Set([...path,owner]);
        return calls.length>0&&calls.every(call=>ready(call,key,next));
    };
    const bindingValue=key=>{
        if(hypotheses.has(key))return hypotheses.get(key);
        if(memo.has(key))return memo.get(key);
        if(activeBindings.has(key))return null;
        activeBindings.add(key);
        const declarations=decls.get(key)||[],formal=params.get(key);
        let seed=null;
        if(declarations.length===1&&!formal&&declarations[0].init)seed=expr(declarations[0].init);
        else if(!declarations.length&&formal){
            const calls=callers.get(formal.fn)||[];
            if(calls.length)seed=union(calls.map(call=>expr(call.args[formal.index])));
        }
        let result=seed;
        const mutations=writers.get(key)||[];
        if(mutations.length){
            // Finite induction from an independently proved actual Number
            // initializer/entry. No hypothesis exists while proving that seed.
            if(!is(seed,'Number'))result=null;
            else{
                hypotheses.set(key,one('Number'));
                for(const writer of mutations){
                    if(writer.type==='Update'){if(!['++','--'].includes(writer.op))result=null;continue;}
                    const rhs=expr(writer.right);
                    if(writer.op==='='){if(!is(rhs,'Number'))result=null;}
                    else if(!['+=','-=','*=','/=','%=','&=','|=','^=','<<=','>>=','>>>='].includes(writer.op)||!scalar(rhs)||writer.op==='+='&&rhs.has('String'))result=null;
                }
                hypotheses.delete(key);
            }
        }
        activeBindings.delete(key);memo.set(key,result);return result;
    };
    const returnValues=fn=>{
        const values=[];const visit=node=>{if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(visit);return;}if(node.type==='FunctionDeclaration')return;if(node.type==='Return')values.push(node.value);else Object.values(node).forEach(visit);};visit(fn.body);return values;
    };
    const returns=body=>(body||[]).some(n=>n.type==='Return'||n.type==='Block'&&returns(n.body)||n.type==='If'&&returns(n.consequent)&&returns(n.alternate));
    const expr=node=>{
        if(!node)return one('Undefined');
        if(['Number','String','Boolean','Null'].includes(node.type))return one(node.type);
        if(node.type==='Parenthesized')return expr(node.expression);
        if(node.type==='Identifier'){
            const key=graph.bindingOf(node);return key&&graph.declarationCountAt(node)===1&&ready(node,key)?bindingValue(key):null;
        }
        if(node.type==='Array')return node.items.every(item=>scalar(expr(item)))?one('Array'):null;
        if(node.type==='Index'){
            if(!is(expr(node.index),'Number')||!is(expr(node.object),'Array'))return null;
            if(proposed.has(node)){
                // Reprove actual pushed values, rather than trusting proposed
                // consumer types. This edge ends at a real allocation/writer.
                return proposed.get(node).every(value=>is(expr(value),'Number'))?new Set(['Number','Undefined']):null;
            }
            const found=graph.typesAt(node);return scalar(found)?found:null;
        }
        if(node.type==='Member'&&node.name==='length'){
            const receiver=expr(node.object);return is(receiver,'Array')||is(receiver,'String')?one('Number'):null;
        }
        if(node.type==='Unary'){
            const arg=expr(node.argument);if(!scalar(arg))return null;
            if(['+','-','~'].includes(node.op))return one('Number');
            if(node.op==='!')return one('Boolean');return null;
        }
        if(node.type==='Binary'){
            const left=expr(node.left),right=expr(node.right);if(!scalar(left)||!scalar(right))return null;
            if(node.op==='+')return is(left,'String')||is(right,'String')?one('String'):
                left.has('String')||right.has('String')?new Set(['Number','String']):one('Number');
            if(['-','*','/','%','**','&','|','^','<<','>>','>>>'].includes(node.op))return one('Number');
            if(['==','!=','===','!==','<','<=','>','>='].includes(node.op))return one('Boolean');
            if(['&&','||'].includes(node.op))return union([left,right]);return null;
        }
        if(node.type==='Conditional')return scalar(expr(node.test))?union([expr(node.consequent),expr(node.alternate)]):null;
        if(node.type==='Assignment'||node.type==='Update'){
            const target=node.left||node.argument,key=target?.type==='Identifier'&&graph.bindingOf(target);
            return key?bindingValue(key):null;
        }
        if(node.type==='Call'){
            if(node.isNew||node.optional||node.typeArguments?.length)return null;
            const callee=node.callee;
            if(callee?.type==='Identifier'){
                const fn=graph.immutableFunctionAt(node);if(!fn||activeFunctions.has(fn)||node.args.length!==fn.params.length||!node.args.every(arg=>!!expr(arg)))return null;
                activeFunctions.add(fn);const values=returnValues(fn).map(expr);if(!returns(fn.body))values.push(one('Undefined'));
                const result=union(values);activeFunctions.delete(fn);return result;
            }
            if(callee?.type!=='Member')return null;
            const receiver=callee.object,name=callee.name,args=node.args.map(expr);
            if(receiver?.type==='Identifier'&&graph.isSdkNamespace(receiver)){
                if(!args.every(scalar))return null;
                if(receiver.name==='Math'&&name==='idiv'&&args.length===2&&args.every(a=>is(a,'Number')))return one('Number');
                if(receiver.name==='game'&&['splash','askForNumber','askForString'].includes(name))return one(name==='askForNumber'?'Number':name==='askForString'?'String':'Undefined');
                return null;
            }
            const actual=expr(receiver);
            if(name==='charAt')return is(actual,'String')&&args.length===1&&is(args[0],'Number')?one('String'):null;
            if(name==='push')return is(actual,'Array')&&args.length===1&&is(args[0],'Number')?one('Number'):null;
            if(name==='reverse')return is(actual,'Array')&&!args.length?one('Array'):null;
        }
        return null;
    };
    // Validate every executable coercion/call and every binding's writers,
    // including effects unrelated to the proposed index read.
    for(const node of nodes){
        if(node.type==='Declaration')for(const decl of node.decls||[])if(!bindingValue(graph.bindingOf(node,decl.name)))return false;
        if(['Call','Binary','Unary','Conditional','Assignment','Update','Index'].includes(node.type)&&!expr(node))return false;
    }
    return true;
}
