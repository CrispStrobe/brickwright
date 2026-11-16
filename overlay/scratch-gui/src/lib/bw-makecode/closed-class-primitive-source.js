// Compiler-private fallback for ordinary primitive obligations. This deliberately
// selects closed, root-constructed instances: annotations never supply domains.
export function closedClassPrimitiveSource(program,graph) {
 const nodes=[],parents=new Map(),roots=new Map(),contexts=new Map();
 const walk=(node,parent=null,root=null,context=null)=>{
  if(!node||typeof node!=='object')return;
  if(Array.isArray(node)){node.forEach(value=>walk(value,parent,root,context));return;}
  nodes.push(node);parents.set(node,parent);roots.set(node,root);contexts.set(node,context);
  if(node.type==='Class'){
   for(const field of node.fields||[])walk(field.init,field,root,node);
   for(const method of [node.ctor,...node.methods||[]].filter(Boolean))walk(method.body,method,root,method);
   return;
  }
  const next=['FunctionDeclaration','FunctionExpression'].includes(node.type)?node:context;
  for(const value of Object.values(node))if(value&&typeof value==='object')walk(value,node,root,next);
 };
 for(const root of program.body||[])walk(root,null,root,null);
 // This fallback does not model function-scoped var hoisting/redeclaration.
 // A lexical graph binding alone cannot close a same-spelling var writer.
 const varNames=new Set(nodes.filter(node=>node.type==='Declaration'&&node.kind==='var').flatMap(node=>(node.decls||[]).map(declaration=>declaration.name)));
 const pureNumber=node=>node?.type==='Number'&&Number.isFinite(Number(node.value))||node?.type==='Identifier'&&!varNames.has(node.name)&&graph.isInitializedAt(node)||
  node?.type==='Unary'&&['+','-','~'].includes(node.op)&&pureNumber(node.argument)||
  node?.type==='Binary'&&['+','-','*','/','%','|','&','^','<<','>>','>>>'].includes(node.op)&&pureNumber(node.left)&&pureNumber(node.right);
 const proved=new WeakSet(),number=node=>{const types=graph.typesAt(node);return pureNumber(node)&&types.size===1&&types.has('Number');};
 for(const cls of (program.body||[]).filter(node=>node.type==='Class')) {
  const ctor=cls.ctor,fields=new Set((cls.fields||[]).map(field=>field.name));
  if(cls.base||cls.typeParameters?.length||cls.unsupported?.length||!ctor||!fields.size||
   cls.fields.some(field=>field.isStatic||field.accessor)||
   cls.methods.some(method=>method.isStatic||!['get','set'].includes(method.kind))||
   [ctor,...cls.methods].some(method=>method.optionalParams?.length||method.parameterDefaults?.length||method.restParam||method.typeParameters?.length))continue;
  const classBinding=graph.bindingOf(cls,cls.name),allocations=[],instances=new Map(),getters=new Map(),setters=new Map();
  let valid=!varNames.has(cls.name)&&graph.declarationCountAt(cls,cls.name)===1;
  for(const method of cls.methods){const map=method.kind==='get'?getters:setters;if(map.has(method.name)||fields.has(method.name))valid=false;map.set(method.name,method);}
  for(const node of nodes)if(node.type==='Identifier'&&graph.bindingOf(node)===classBinding){
   const call=parents.get(node),parent=parents.get(call),root=roots.get(call);
   if(call?.type!=='Call'||call.callee!==node||!call.isNew||call.typeArguments?.length||call.args.length!==ctor.params.length||
    contexts.get(call)!==null||program.body.indexOf(root)<=program.body.indexOf(cls)) {valid=false;continue;}
   // A lexical instance is never rebound, aliased, captured or passed elsewhere.
   if(parent?.init===call&&root?.type==='Declaration'&&root.decls.includes(parent)){
    const key=graph.bindingOf(call,parent.name);if(varNames.has(parent.name)||!key||instances.has(key)||graph.declarationCountAt(call,parent.name)!==1)valid=false;
    instances.set(key,{decl:parent,root});
   }else if(parent?.type!=='Member'||parent.object!==call)valid=false;
   allocations.push(call);
  }
  if(!valid||!allocations.length||allocations.some(call=>call.args.some(argument=>!number(argument))))continue;
  const receiver=node=>node?.type==='Call'&&allocations.includes(node)||node?.type==='Identifier'&&
   (node.name==='this'&&[ctor,...cls.methods].includes(contexts.get(node))||instances.has(graph.bindingOf(node)));
  const ownMember=node=>node?.type==='Member'&&receiver(node.object);
  const writes=[];
  for(const node of nodes){
   const parent=parents.get(node),context=contexts.get(node);
   if(node.type==='Unknown'||node.type==='Identifier'&&['eval','Function','Reflect','Object','globalThis','window','self'].includes(node.name))valid=false;
   if(node.type==='Unary'&&node.op==='delete'&&ownMember(node.argument))valid=false;
   if(node.type==='Identifier'&&instances.has(graph.bindingOf(node))){
    const instance=instances.get(graph.bindingOf(node));
    if(parent?.type!=='Member'||parent.object!==node||context!==null||program.body.indexOf(roots.get(node))<=program.body.indexOf(instance.root))valid=false;
   }
   if(node.type==='Identifier'&&node.name==='this'&&[ctor,...cls.methods].includes(context)&&
    (parent?.type!=='Member'||parent.object!==node))valid=false;
   if(node.type==='Assignment'||node.type==='Update'){
    const lhs=node.type==='Assignment'?node.left:node.argument;
    if(lhs?.type==='Identifier'&&instances.has(graph.bindingOf(lhs)))valid=false;
    if(lhs?.type==='Member'&&(fields.has(lhs.name)||getters.has(lhs.name)||setters.has(lhs.name))){
     if(!ownMember(lhs))valid=false;else writes.push(node);
    }
   }
   if(ownMember(node)&&!fields.has(node.name)&&!getters.has(node.name)&&!setters.has(node.name))valid=false;
  }
  if(!valid)continue;
  const ctorParameters=new Map(ctor.params.map((name,index)=>[name,index]));
  // Constructor arithmetic uses every allocation's actual formal producers.
  // Preserve the expression and its nonfinite intermediates; own-field reads
  // cannot establish initialization and remain outside this constructor proof.
  const ctorNumber=node=>number(node)||node?.type==='Identifier'&&ctorParameters.has(node.name)&&
   allocations.every(call=>number(call.args[ctorParameters.get(node.name)]))||
   node?.type==='Unary'&&['+','-'].includes(node.op)&&ctorNumber(node.argument)||
   node?.type==='Binary'&&['+','-','*'].includes(node.op)&&ctorNumber(node.left)&&ctorNumber(node.right);
  const initialized=new Set();
  for(const field of cls.fields)if(field.init){if(!number(field.init))valid=false;else initialized.add(field.name);}
  // Only direct constructor writes establish a field. Branches, calls and reads
  // before initialization cannot provide a definite initialization proof.
  for(const statement of ctor.body||[]){
   const assignment=statement?.type==='ExpressionStatement'&&statement.expr;
   if(assignment?.type!=='Assignment'||assignment.op!=='='||!ownMember(assignment.left)||
    assignment.left.object?.name!=='this'||!fields.has(assignment.left.name)||!ctorNumber(assignment.right))valid=false;
   else initialized.add(assignment.left.name);
  }
  if(initialized.size!==fields.size)valid=false;
  const formalNumber=(node,method)=>node?.type==='Identifier'&&method?.kind==='set'&&method.params.length===1&&node.name===method.params[0]&&
   writes.filter(write=>write.left?.name===method.name).every(write=>write.type==='Assignment'&&write.op==='='&&number(write.right));
  // Scalar effects execute in their original method body. Only an existing
  // Number cell may be updated; calls, member writes and formal rewrites do
  // not acquire authority from this prefix check.
  const scalarCells=new Map();
  for(const root of program.body.slice(0,program.body.indexOf(cls)))if(root.type==='Declaration')
   for(const declaration of root.decls||[])if(!varNames.has(declaration.name)&&declaration.init?.type==='Number'&&Number.isFinite(Number(declaration.init.value))&&
    graph.declarationCountAt(declaration.init,declaration.name)===1){
    const key=graph.bindingOf(declaration.init,declaration.name);if(key)scalarCells.set(key,declaration);
   }
  const scalarExpression=(node,key)=>node?.type==='Number'&&Number.isFinite(Number(node.value))||
   node?.type==='Identifier'&&graph.bindingOf(node)===key||
   node?.type==='Unary'&&['+','-','~'].includes(node.op)&&scalarExpression(node.argument,key)||
   node?.type==='Binary'&&['+','-','*'].includes(node.op)&&scalarExpression(node.left,key)&&scalarExpression(node.right,key);
  const scalarEffect=(statement,method)=>{
   const write=statement?.type==='ExpressionStatement'&&statement.expr,key=graph.bindingOf(write?.left);
   return write?.type==='Assignment'&&write.op==='='&&write.left?.type==='Identifier'&&
    !method.params.includes(write.left.name)&&scalarCells.has(key)&&scalarExpression(write.right,key)&&
    nodes.filter(node=>(node.type==='Assignment'||node.type==='Update')&&
     graph.bindingOf(node.type==='Assignment'?node.left:node.argument)===key).every(node=>
      node.type==='Assignment'&&node.op==='='&&scalarExpression(node.right,key));
  };
  // A compound getter reads only initialized own fields and finite literals.
  // Binary bitwise operations retain both Number operand obligations; their
  // ToInt32/ToUint32 conversions and masked shift counts execute at runtime.
  // Bitwise NOT keeps the original JS ToInt32 operation, including nonfinite
  // intermediates; its operand still needs this closed Number producer proof.
  // Retain the original expression; no intermediate value is folded or assumed
  // finite. Calls, nested accessors and external names cannot borrow this proof.
  // Conditional accessors retain their original lazy branches. The guard must
  // be a pure Boolean literal or a comparison of independently closed Numbers;
  // neither calls nor nested accessors acquire authority from branch typing.
  const conditionalGuard=(node,isNumber)=>node?.type==='Boolean'||
   node?.type==='Binary'&&['<','<=','>','>=','===','!==','==','!='].includes(node.op)&&
   isNumber(node.left)&&isNumber(node.right);
  const getterNumber=node=>node?.type==='Number'&&Number.isFinite(Number(node.value))||
   ownMember(node)&&node.object?.name==='this'&&fields.has(node.name)||
   node?.type==='Unary'&&['+','-','~'].includes(node.op)&&getterNumber(node.argument)||
   node?.type==='Binary'&&['+','-','*','|','&','^','<<','>>','>>>'].includes(node.op)&&getterNumber(node.left)&&getterNumber(node.right)||
   node?.type==='Conditional'&&conditionalGuard(node.test,getterNumber)&&getterNumber(node.consequent)&&getterNumber(node.alternate);
  // Setter arithmetic retains the formal's actual producer obligation at every
  // dispatch. Own field reads have the same closed initialization proof as a
  // getter; external cells, calls and nested accessors remain outside it.
  const setterNumber=(node,method)=>node?.type==='Number'&&Number.isFinite(Number(node.value))||formalNumber(node,method)||
   ownMember(node)&&node.object?.name==='this'&&fields.has(node.name)||
   node?.type==='Unary'&&['+','-','~'].includes(node.op)&&setterNumber(node.argument,method)||
   node?.type==='Binary'&&['+','-','*','|','&','^','<<','>>','>>>'].includes(node.op)&&setterNumber(node.left,method)&&setterNumber(node.right,method)||
   node?.type==='Conditional'&&conditionalGuard(node.test,value=>setterNumber(value,method))&&
   setterNumber(node.consequent,method)&&setterNumber(node.alternate,method);
  for(const method of cls.methods){
   const statements=method.body||[],body=statements.slice(-1);
   if(!statements.slice(0,-1).every(statement=>scalarEffect(statement,method)))valid=false;
   if(method.kind==='get'){
    if(method.params.length||body.length!==1||body[0].type!=='Return'||!getterNumber(body[0].value))valid=false;
   }else{
    if(method.params.length!==1||body.length!==1)valid=false;
    const write=body[0]?.type==='ExpressionStatement'&&body[0].expr;
    if(write?.type!=='Assignment'||write.op!=='='||!ownMember(write.left)||write.left.object?.name!=='this'||
     !fields.has(write.left.name)||!(number(write.right)||setterNumber(write.right,method)))valid=false;
   }
  }
  for(const write of writes){
   if(contexts.get(write)===ctor)continue;
   const lhs=write.left;
   if(write.type!=='Assignment'||write.op!=='='||!lhs||getters.has(lhs.name)&&!setters.has(lhs.name))valid=false;
   else if(setters.has(lhs.name)){if(!number(write.right))valid=false;}
   else if(!fields.has(lhs.name)||!(number(write.right)||contexts.get(write)?.kind==='set'&&setterNumber(write.right,contexts.get(write))))valid=false;
  }
  if(!valid)continue;
  for(const node of nodes)if(ownMember(node)&&(fields.has(node.name)||getters.has(node.name))&&contexts.get(node)===null)proved.add(node);
 }
 return node=>proved.has(node);
}
