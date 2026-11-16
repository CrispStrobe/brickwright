import {parseMakeCodeTs,tokenize} from './ts-import.js';
const authorities=new WeakMap(),getProof=WeakMap.prototype.get,setProof=WeakMap.prototype.set;
const apply=Reflect.apply,ownKeys=Reflect.ownKeys,getDescriptor=Object.getOwnPropertyDescriptor,getPrototype=Object.getPrototypeOf,mapGet=Map.prototype.get,setHas=Set.prototype.has;
const snapshot=files=>ownKeys(files).map(key=>{const d=getDescriptor(files,key);if(typeof key!=='string'||!d||!Object.hasOwn(d,'value')||typeof d.value!=='string')throw Error('String source files required');return [key,d]});
const issue=(files,indices,rows,prototype)=>{
 if(!indices.size)return null;
 const token=Object.freeze({});apply(setProof,authorities,[token,{files,indices,prototype,rows}]);return token;
};
export function resetArraySyntaxAdmits(token,files,name,source,index){
 const authority=token&&apply(getProof,authorities,[token]);if(!authority||authority.files!==files||getPrototype(files)!==authority.prototype)return false;
 const keys=ownKeys(files);if(keys.length!==authority.rows.length)return false;
 for(let at=0;at<keys.length;at++){
  const [key,saved]=authority.rows[at],current=getDescriptor(files,key);
  if(keys[at]!==key||!current||!Object.hasOwn(current,'value')||current.value!==saved.value||current.writable!==saved.writable||current.enumerable!==saved.enumerable||current.configurable!==saved.configurable)return false;
 }
 const row=apply(mapGet,authority.indices,[name]);return row?.source===source&&apply(setHas,row.indices,[index])===true;
}
const ident=(node,name)=>node?.type==='Identifier'&&node.name===name;
const number=(node,value)=>node?.type==='Number'&&Number(node.value)===value;
const walk=(node,visit,parent=null,root=null)=>{
 if(!node||typeof node!=='object')return;
 if(Array.isArray(node)){for(const item of node)walk(item,visit,parent,root);return;}
 visit(node,parent,root);
 for(const value of Object.values(node))if(value&&typeof value==='object')walk(value,visit,node,root);
};
// Only an ordinary, pure linear String-array search is admitted. Types are
// checked as erased syntax; the actual array and String producers are below.
function searchShape(fn){
 if(fn.type!=='FunctionDeclaration'||fn.params?.length!==2||fn.typeParameters?.length||fn.optionalParams?.length||fn.parameterDefaults?.length||!['','number'].includes(fn.returnType||'')||fn.body?.length!==2)return null;
 const array=fn.params.find(name=>fn.paramTypes?.[name]?.text==='any[]'),needle=fn.params.find(name=>fn.paramTypes?.[name]?.text==='string');
 if(!array||!needle||array===needle)return null;
 const [loop,miss]=fn.body;
 if(loop.type!=='For'||miss.type!=='Return'||miss.value?.type!=='Unary'||miss.value.op!=='-'||!number(miss.value.argument,1)||loop.init?.type!=='Declaration'||loop.init.kind!=='let'||loop.init.decls?.length!==1)return null;
 const key=loop.init.decls[0].name;
 if(key===array||key===needle||!number(loop.init.decls[0].init,0)||loop.update?.type!=='Update'||loop.update.op!=='++'||!ident(loop.update.argument,key)||loop.body?.length!==1)return null;
 const length=node=>node?.type==='Member'&&!node.optional&&node.name==='length'&&ident(node.object,array);
 const test=loop.test,limit=test?.right;
 if(!ident(test?.left,key)||!(test.op==='<'&&length(limit)||test.op==='<='&&limit?.type==='Binary'&&limit.op==='-'&&length(limit.left)&&number(limit.right,1)))return null;
 const check=loop.body[0];if(check.type!=='If'||check.alternate||check.consequent?.length!==1||check.consequent[0].type!=='Return'||!ident(check.consequent[0].value,key))return null;
 const comparison=check.test;if(comparison?.type!=='Binary'||!['==','==='].includes(comparison.op))return null;
 const index=comparison.left?.type==='Index'?comparison.left:comparison.right,other=index===comparison.left?comparison.right:comparison.left;
 if(!ident(other,needle)||index?.type!=='Index'||!ident(index.object,array)||!ident(index.index,key))return null;
 return {array,needle,key};
}
export function closedResetStringArraySyntax(files){
 const result=new Map();
 try{
  const rows=snapshot(files),prototype=getPrototype(files);
  const units=[],bindings=new Map(),references=new Map(),parents=new WeakMap(),roots=new WeakMap();let uncertain=false;
  const bind=name=>{if(typeof name==='string')bindings.set(name,(bindings.get(name)||0)+1)};
  for(const [name,descriptor] of rows.filter(([name])=>/\.ts$/.test(name))){
   const source=descriptor.value,program=parseMakeCodeTs(source,{namedFunctionExpressions:true,parameterDefaults:true,retainClassHeritage:true});
   const unit={name,source,program,tokens:tokenize(source)};units.push(unit);
   for(const root of program.body)walk(root,(node,parent)=>{
    parents.set(node,parent);roots.set(node,{unit,root});
    if(node.type==='Unknown'||node.opaque||['Class','Namespace','Try','Catch','ForOf','ForIn','ForEach'].includes(node.type))uncertain=true;
    if(node.type==='Declaration')for(const declaration of node.decls||[])bind(declaration.name);
    if(node.type==='FunctionDeclaration'){bind(node.name);for(const param of node.params||[])bind(param)}
    if(node.type==='FunctionExpression'){if(node.selfName)bind(node.selfName);for(const param of node.params||[])bind(param)}
    if(node.type==='Identifier'){if(!references.has(node.name))references.set(node.name,[]);references.get(node.name).push(node)}
   });
  }
  if(uncertain)return issue(files,result,rows,prototype);
  const stringValue=node=>node?.type==='String'||node?.type==='Call'&&!node.optional&&!node.isNew&&!node.constructorCall&&!node.typeArguments?.length&&node.callee?.type==='Member'&&!node.callee.optional&&node.callee.name==='askForString'&&ident(node.callee.object,'game');
  for(const unit of units)for(const fn of unit.program.body){
   const shape=searchShape(fn);if(!shape||bindings.get(fn.name)!==1||bindings.get(shape.array)!==1||bindings.get(shape.needle)!==1)continue;
   const refs=references.get(fn.name)||[];if(refs.length!==1)continue;
   const call=parents.get(refs[0]);if(call?.type!=='Call'||call.callee!==refs[0]||call.optional||call.isNew||call.constructorCall||call.typeArguments?.length||call.args?.length!==2)continue;
   // The sole call site executes in the top-level source, after allocation;
   // deferred/nested callers cannot borrow another scope's producer.
   let ancestor=call,nested=false;while(ancestor){if(['FunctionDeclaration','FunctionExpression'].includes(ancestor.type))nested=true;ancestor=parents.get(ancestor)}if(nested)continue;
   const arrayArg=call.args[fn.params.indexOf(shape.array)],needleArg=call.args[fn.params.indexOf(shape.needle)];
   if(arrayArg?.type!=='Identifier'||bindings.get(arrayArg.name)!==1)continue;
   const arrayRefs=references.get(arrayArg.name)||[];if(arrayRefs.length!==1||arrayRefs[0]!==arrayArg)continue;
   const declarations=units.flatMap(row=>row.program.body.flatMap(root=>root.type==='Declaration'?(root.decls||[]).map(declaration=>({row,root,declaration})):[]));
   const allocation=declarations.find(row=>row.declaration.name===arrayArg.name);
   if(!allocation||allocation.row!==unit||roots.get(call)?.unit!==unit||allocation.declaration.init?.type!=='Array'||!allocation.declaration.init.items.every(item=>item?.type==='String')||unit.program.body.indexOf(allocation.root)>=unit.program.body.indexOf(roots.get(call).root))continue;
   if(!stringValue(needleArg)){
    if(needleArg?.type!=='Identifier'||bindings.get(needleArg.name)!==1)continue;
    const initial=declarations.find(row=>row.declaration.name===needleArg.name);if(!initial||initial.row!==unit||!stringValue(initial.declaration.init)||unit.program.body.indexOf(initial.root)>=unit.program.body.indexOf(roots.get(call).root))continue;
    let bad=false;for(const row of units)walk(row.program,node=>{
     if(node.type==='Assignment'){
      const targets=[];walk(node.left,value=>{if(ident(value,needleArg.name))targets.push(value)});
      if(targets.length&&(!ident(node.left,needleArg.name)||node.op!=='='||!stringValue(node.right)))bad=true;
     }
     if(node.type==='Update'&&ident(node.argument,needleArg.name))bad=true;
    });if(bad)continue;
   }
   const reads=[],suffixes=[];
   unit.tokens.forEach((token,index)=>{
    if(token.value!=='[')return;
    if(unit.tokens[index-1]?.value===shape.array&&unit.tokens[index+1]?.value===shape.key&&unit.tokens[index+2]?.value===']')reads.push(index);
    if(unit.tokens[index-3]?.value===shape.array&&unit.tokens[index-2]?.value===':'&&unit.tokens[index-1]?.value==='any'&&unit.tokens[index+1]?.value===']')suffixes.push(index);
   });
   if(reads.length!==1||suffixes.length!==1)continue;
   const saved=result.get(unit.name)||{source:unit.source,indices:new Set()};for(const index of [...reads,...suffixes])saved.indices.add(index);result.set(unit.name,saved);
  }
  return issue(files,result,rows,prototype);
 }catch{return null}
}
