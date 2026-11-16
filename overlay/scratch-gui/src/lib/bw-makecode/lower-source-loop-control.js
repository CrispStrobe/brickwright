/** Arcade loop exits lowered to hygienic invocation cells before lazy values.
 * The for update is outside the continue guard but inside the break guard.
 * Every nested statement list guards its remainder, not just the outer body.
 * Switch fallthrough is deliberately not admitted by this bounded lowering.
 */
export function lowerSourceLoopControl(program) {
    const names=new Set();
    const scan=node=>{if(!node || typeof node!=='object')return;if(node.name)names.add(node.name);for(const name of node.params || [])names.add(name);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(scan);else scan(value);};
    scan(program);let next=0,changed=false;const warnings=new Set(program.sourceWarnings || []);
    const ownedContinue=node=>{
        if(!node || typeof node!=='object')return false;
        if(Array.isArray(node))return node.some(ownedContinue);
        if(node.type==='Continue')return true;
        if(['While','For','ForOf','FunctionDeclaration','FunctionExpression','Class'].includes(node.type))return false;
        return Object.values(node).some(ownedContinue);
    };
    const fresh=()=>{let name;do{name=`__bwLoopExit${++next}`;}while(names.has(name));names.add(name);return name;};
    const id=name=>({type:'Identifier',name,temporary:true});
    const num=value=>({type:'Number',value:String(value)});
    const decl=(name,value=0)=>({type:'Declaration',kind:'let',decls:[{name,init:num(value),temporary:true,valuePreserving:true}]});
    const assign=(name,value)=>({type:'ExpressionStatement',expr:{type:'Assignment',op:'=',left:id(name),right:num(value),valuePreserving:true}});
    const zero=name=>({type:'Binary',op:'===',left:id(name),right:num(0)});
    const guard=(flags,body)=>flags.length?{type:'If',test:flags.map(zero).reduce((left,right)=>({type:'Binary',op:'&&',left,right})),consequent:body,alternate:[]}: {type:'Block',body};
    const exits=(node,inSwitch=false)=>{
        if(!node || typeof node!=='object')return false;
        if(Array.isArray(node))return node.some(item=>exits(item,inSwitch));
        if(node.type==='Continue')return true;
        if(node.type==='Break')return !inSwitch;
        if(['While','For','ForOf','FunctionDeclaration','FunctionExpression'].includes(node.type))return false;
        return Object.values(node).some(value=>exits(value,inSwitch || node.type==='Switch'));
    };
    const containsControlledLoop=node=>{
        if(!node || typeof node!=='object')return false;
        if(Array.isArray(node))return node.some(containsControlledLoop);
        if(['While','For'].includes(node.type) && exits(node.body))return true;
        return Object.values(node).some(containsControlledLoop);
    };
    const mayExit=node=>{
        if(!node || typeof node!=='object')return false;
        if(Array.isArray(node))return node.some(mayExit);
        if(node.sourceExit)return true;
        // Nested loops/functions have their own exit cells.
        if(node.sourceLoop || ['FunctionDeclaration','FunctionExpression'].includes(node.type))return false;
        return Object.values(node).some(mayExit);
    };
    const list=(items,context)=>{
        const result=[];let previousExit=false;
        for(const item of items || []){
            const lowered=visit(item,context);
            result.push(previousExit?guard(context.flags,[lowered]):lowered);
            previousExit ||= mayExit(lowered);
        }
        return result;
    };
    const switchNode=(node,context)=>{
        const groups=[];let labels=[];
        for(let k=0;k<node.cases.length;k++){
            const item=node.cases[k];labels.push(item.test);
            if(!item.body.length && k<node.cases.length-1)continue;
            const last=item.body[item.body.length-1];
            if(k<node.cases.length-1 && !['Break','Continue','Return'].includes(last?.type))return {...node,cases:node.cases.map(c=>({...c,body:c.body.map(st=>visit(st,{...context,breakName:null}))}))};
            groups.push({labels,body:item.body});labels=[];
        }
        changed=true;
        const subject=fresh(),stop=fresh();
        const local={...context,breakName:stop,flags:[...context.flags,stop]};
        const bodies=groups.map(group=>({labels:group.labels,body:list(group.body,local)}));
        const fallback=bodies.find(group=>group.labels.includes(null));
        let remainder=fallback?.body || [];
        for(const group of bodies.slice().reverse()){
            const tests=group.labels.filter(label=>label!==null).map(label=>({type:'Binary',op:'===',left:id(subject),right:expression(label)}));
            if(!tests.length)continue;
            const test=tests.reduce((left,right)=>({type:'Binary',op:'||',left,right}));
            remainder=[{type:'If',test,consequent:group.body,alternate:remainder}];
        }
        return {type:'Block',body:[{type:'Declaration',kind:'let',decls:[{name:subject,init:expression(node.discriminant),temporary:true,valuePreserving:true}]},decl(stop),...remainder]};
    };
    function expression(node){
        if(!node || typeof node!=='object')return node;
        if(Array.isArray(node))return node.map(expression);
        if(node.type==='FunctionExpression')return {...node,body:list(node.body,{flags:[],breakName:null,continueName:null})};
        return Object.fromEntries(Object.entries(node).map(([key,value])=>[key,expression(value)]));
    }
    function visit(node,context){
        if(!node || typeof node!=='object')return node;
        if(node.type==='Break' && context.breakName)return {...assign(context.breakName,1),sourceExit:true};
        if(node.type==='Continue' && context.continueName)return {...assign(context.continueName,1),sourceExit:true};
        if(['While','For'].includes(node.type)){
            const headerSequence=node.type==='For' && node.update?.type==='ForHeaderSequence';
            if(!node.doWhile && !headerSequence && !exits(node.body))return {...node,init:node.init?visit(node.init,{flags:[]}):node.init,test:expression(node.test),update:expression(node.update),body:list(node.body,{flags:[],breakName:null,continueName:null})};
            changed=true;
            if(node.doWhile && ownedContinue(node.doWhileBody))warnings.add('Selected Arcade SDK do-while continue skips its posttest; native uses standard posttest semantics and normalized export (pxt-arcade 4.2.1 / pxt-core 13.2.1 boundary).');
            const stop=fresh(),skip=fresh(),inner={flags:[stop,skip],breakName:stop,continueName:skip};
            const test=node.doWhile?{type:'Boolean',value:true}:node.test || {type:'Boolean',value:true};
            const loopBody=list(node.doWhile?node.doWhileBody:node.body,inner);
            const body=[decl(skip),{type:'If',test:{type:'Unary',op:'!',argument:expression(test)},consequent:[assign(stop,1)],alternate:[]},...(loopBody.length?[guard([stop],loopBody)]:[])];
            if(node.doWhile)body.push(guard([stop],[{type:'If',test:{type:'Unary',op:'!',argument:expression(node.doWhileTest)},consequent:[assign(stop,1)],alternate:[]}]));
            if(node.type==='For' && node.update)body.push(guard([stop],
                (headerSequence?node.update.expressions:[node.update]).map(expr=>({type:'ExpressionStatement',expr:expression(expr)}))));
            return {type:'Block',sourceLoop:true,body:[...(node.init?[visit(node.init,{flags:[]})]:[]),decl(stop),{type:'While',test:zero(stop),body}]};
        }
        if(node.type==='Switch')return context.flags.length || containsControlledLoop(node)?switchNode(node,context):{...node,cases:node.cases.map(c=>({...c,test:expression(c.test),body:list(c.body,context)}))};
        if(node.type==='If')return {...node,test:expression(node.test),consequent:list(node.consequent,context),alternate:list(node.alternate,context)};
        if(node.type==='Block')return {...node,body:list(node.body,context)};
        if(node.type==='Namespace')return {...node,body:list(node.body,{flags:[],breakName:null,continueName:null})};
        if(node.type==='FunctionDeclaration')return {...node,body:list(node.body,{flags:[],breakName:null,continueName:null})};
        return expression(node);
    }
    const body=list(program.body,{flags:[],breakName:null,continueName:null});
    return changed?{...program,body,loweredSourceLoopControl:true,sourceWarnings:[...warnings]}:{...program,body};
}
