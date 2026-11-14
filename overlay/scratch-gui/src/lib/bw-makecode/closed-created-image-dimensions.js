import {inspectGeneratedHelperBindings,GENERATED_HELPER_PROFILES} from './generated-helper-recognition.js';
import {parseMakeCodeTs} from './ts-import.js';

// Lowered callable plans contain non-executable backreferences. Resolve only
// executable fields, retaining their ORIGINAL identities and descriptors.
function executableBindings(program) {
    const nodes=[],parents=new WeakMap(),seen=new WeakSet(),active=new WeakSet(),ambiguous=new WeakSet(),rows=[],counts=new Map(),declarations=new Map();
    let valid=true;
    const excluded=new Set(['originalBody','paramTypes','returnType','typeParameters','assertedType','sourceReferenceDeclarations','sourceCallableDeclarations']);
    const add=(name,decl)=>{if(typeof name!=='string')return;counts.set(name,(counts.get(name)||0)+1);if(decl)declarations.set(name,decl);};
    const visit=(node,parent=null)=>{
        if(!node||typeof node!=='object')return;
        if(active.has(node)){valid=false;return;}
        if(seen.has(node)){ambiguous.add(node);return;}seen.add(node);active.add(node);
        const keys=Reflect.ownKeys(node),fields=[];
        for(const key of keys){const d=Object.getOwnPropertyDescriptor(node,key);if(typeof key!=='string'||!d||!Object.hasOwn(d,'value')){valid=false;return;}fields.push([key,d]);}
        rows.push([node,keys,fields,Object.getPrototypeOf(node)]);
        if(Array.isArray(node)){for(const child of node)visit(child,parent);active.delete(node);return;}
        nodes.push(node);parents.set(node,parent);
        if(node.type==='Declaration')for(const decl of node.decls||[])add(decl.name,decl);
        if(['FunctionDeclaration','FunctionExpression','Class','Enum','Namespace','ForOf','ForIn'].includes(node.type))add(node.name);
        if(Array.isArray(node.params))node.params.forEach(name=>add(name));
        for(const [key,d]of fields)if(!key.startsWith('bw')&&!excluded.has(key))visit(d.value,node);
        active.delete(node);
    };
    visit({type:'Program',body:program.body});
    const current=()=>valid&&rows.every(([node,keys,fields,proto])=>{
        const now=Reflect.ownKeys(node);return Object.getPrototypeOf(node)===proto&&now.length===keys.length&&now.every((key,i)=>key===keys[i])&&fields.every(([key,before])=>{
            const after=Object.getOwnPropertyDescriptor(node,key);return after&&Object.hasOwn(after,'value')&&Object.is(after.value,before.value)&&after.enumerable===before.enumerable&&after.configurable===before.configurable&&after.writable===before.writable;
        });
    });
    const ambiguousAt=node=>{for(let n=node;n;n=parents.get(n))if(ambiguous.has(n))return true;return false;};
    return {nodes,parentOf:n=>parents.get(n),isCurrent:current,ambiguousAt,unique:name=>counts.get(name)===1,declarationAt:n=>declarations.get(n.name),unbound:name=>!counts.has(name)};
}

export function createdImageDimensionSourceSafe(files) {
    try {
        const values=Object.create(null);
        for(const name of Reflect.ownKeys(files)){
            const d=Object.getOwnPropertyDescriptor(files,name);
            if(typeof name!=='string'||!d||!Object.hasOwn(d,'value')||typeof d.value!=='string')return false;
            values[name]=d.value;
        }
        if(!Object.values(values).some(text=>/\bimage\s*\.\s*create\s*\(/.test(text))||!Object.values(values).some(text=>/\.\s*(?:width|height)\s*(?:>>>|>>|<<|&|\||\^)/.test(text)))return false;
        const config=JSON.parse(values['pxt.json']||'null');
        if(config&&(!Array.isArray(config.files)||!config.files.every(n=>typeof n==='string')||
            config.testFiles!==undefined&&(!Array.isArray(config.testFiles)||!config.testFiles.every(n=>typeof n==='string'))||
            config.dependencies?.device!=='*'||Object.keys(config.dependencies).some(n=>n!=='device')))return false;
        const selected=new Set([...(config?.files||['main.ts']),...(config?.testFiles||[]),...Object.keys(values).filter(n=>n.endsWith('.ts'))]);
        const sources=[];
        for(const name of selected){
            if(!/\.(?:ts|py|asm|c|cpp|h)$/.test(name))continue;
            if(!Object.hasOwn(values,name)||!/\.ts$/.test(name)||/\.(?:g|d)\.ts$/.test(name)||config?.fileDependencies&&Object.hasOwn(config.fileDependencies,name))return false;
            sources.push(values[name]);
        }
        const program=parseMakeCodeTs(sources.join('\n'),GENERATED_HELPER_PROFILES.ordinary);
        const proof=inspectGeneratedHelperBindings(program,GENERATED_HELPER_PROFILES.ordinary),reads=closedCreatedImageDimensions(program);
        if(!proof.isCurrent())return false;
        let producers=0;
        for(const node of proof.nodes)if(node.type==='Call'&&node.callee?.type==='Member'&&node.callee.name==='create'&&node.callee.object?.name==='image'){
            const decl=proof.parentOf(node);
            if(decl?.init!==node||!proof.nodes.some(read=>reads.has(read)&&proof.declarationAt(read.object)===decl))return false;
            producers++;
        }
        return producers>0&&proof.isCurrent();
    } catch {return false;}
}

export function markCreatedImageDimensions(program,sourceSafe) {
    if(sourceSafe!==true)return program;
    const reads=closedCreatedImageDimensions(program),selected=[];
    const visit=node=>{if(!node||typeof node!=='object')return;if(reads.has(node))selected.push(node);Object.values(node).forEach(v=>Array.isArray(v)?v.forEach(visit):visit(v));};
    visit(program);
    for(const node of selected)node.bwClosedCreatedImageDimension=true;
    return program;
}

// Only adjacent dimension reads of an actual local image.create result. No
// parameter annotation, arbitrary member name or escaped receiver is evidence.
export function closedCreatedImageDimensions(program) {
    const result=new WeakSet();
    if(program?.type!=='Program'||!Array.isArray(program.body))return result;
    const proof=executableBindings(program);
    if(!proof.isCurrent())return result;
    const parent=proof.parentOf;
    const owner=node=>{for(let n=node;n;n=parent(n))if(['FunctionDeclaration','FunctionExpression','Program'].includes(n.type))return n;return null;};
    const call=node=>node?.type==='Call'&&!node.isNew&&!node.constructorCall&&!node.optional&&!node.typeArguments?.length&&Array.isArray(node.args)&&!node.args.some(arg=>arg?.type==='Spread');
    // Extraction, mutation and computed/reflected namespace access invalidate
    // the producer, including occurrences in a different configured function.
    for(const n of proof.nodes){
        if(n.type==='Unknown'||n.type==='Index'||n.type==='Member'&&['constructor','prototype','__proto__'].includes(n.name)||n.type==='Identifier'&&['Object','Proxy','global','self'].includes(n.name))return result;
        if(n.type==='Identifier'&&n.name==='image'){
            const member=parent(n),invoke=parent(member);
            if(!proof.unbound('image')||member?.type!=='Member'||member.object!==n||member.optional||member.name!=='create'||
                !call(invoke)||invoke.callee!==member||invoke.args.length!==2)return result;
        }
    }
    for(const block of proof.nodes){
        if(!Array.isArray(block.body))continue;
        for(let i=0;i<block.body.length;i++){
            const statement=block.body[i],decl=statement.type==='Declaration'&&statement.decls?.length===1?statement.decls[0]:null;
            const init=decl?.init,callee=init?.callee;
            if(!decl||!proof.unique(decl.name)||!call(init)||callee?.type!=='Member'||callee.name!=='create'||
                callee.object?.type!=='Identifier'||callee.object.name!=='image'||!proof.unbound('image')||init.args.length!==2)continue;
            const same=n=>n?.type==='Identifier'&&proof.declarationAt(n)===decl;
            let safe=true;
            for(const n of proof.nodes){
                if(!same(n))continue;
                const use=parent(n),above=parent(use);
                if(proof.ambiguousAt(n)||owner(n)!==owner(statement)){safe=false;break;}
                if(use?.type==='Return'&&use.value===n)continue;
                if(use?.type!=='Member'||use.object!==n||use.optional){safe=false;break;}
                if(['width','height'].includes(use.name)){
                    if(above?.type==='Assignment'&&above.left===use||above?.type==='Update'||above?.type==='Unary'&&above.op==='delete'){safe=false;break;}
                }else if(!['getPixel','setPixel','fill'].includes(use.name)||!call(above)||above.callee!==use){safe=false;break;}
            }
            if(!safe)continue;
            // There is no intervening call, branch or write before these reads.
            for(let j=i+1;j<block.body.length;j++){
                const next=block.body[j],value=next.type==='Declaration'&&next.decls?.length===1?next.decls[0].init:null;
                if(value?.type!=='Binary'||!['&','|','^','<<','>>','>>>'].includes(value.op))break;
                let found=false;
                for(const operand of [value.left,value.right])if(operand?.type==='Member'&&['width','height'].includes(operand.name)&&same(operand.object)){
                    if(proof.isCurrent())result.add(operand);found=true;
                }
                if(!found)break;
            }
        }
    }
    return result;
}
