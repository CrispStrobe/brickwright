import {parseMakeCodeTs} from './ts-import.js';
import {GENERATED_HELPER_PROFILES,inspectGeneratedHelperBindings} from './generated-helper-recognition.js';

// A constant Boolean write, never a Number/Boolean producer loan. Close the
// configured effect surface before allowing the SDK receiver's mutable flag.
const path = n => n?.type === 'Identifier' ? n.name : n?.type === 'Member' ? path(n.object) + '.' + n.name : null;
const literalBoolean = n => n?.type === 'Boolean' && typeof n.value === 'boolean';
const sdkRoots = new Set(['game','scene','sprites','Math','SpriteKind','img']);
const calls = new Set(['game.onUpdate','game.onUpdateInterval','game.pushScene','game.popScene',
    'scene.setBackgroundColor','scene.setBackgroundImage','sprites.create','sprites.destroy',
    'sprites.destroyAllSpritesOfKind','sprites.allOfKind','Math.sin','Math.cos']);
const forbidden = new Set(['this','arguments','globalThis','global','window','self','eval','Function','Reflect',
    'Object','Proxy','Array','Number','String','Boolean']);
// Only the complete SDK destroy-all snapshot loop emitted by the owned
// lowerDestroyAllSprites/desugarForOf pipeline may add these two effects.
// Match every statement and join every helper reference to its sole writer;
// an Index or a Sprite annotation alone never authorizes either operation.
function destroySnapshotEffects(proof) {
    const same=(a,b)=>{
        if(!a||!b||typeof a!=='object'||typeof b!=='object')return Object.is(a,b);
        if(Array.isArray(a)!==Array.isArray(b))return false;
        const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));
    };
    const allowed=new Set(), id=name=>({type:'Identifier',name});
    for(const block of proof.nodes) {
        if(block.type!=='Block'||block.body?.length!==2)continue;
        const [declaration,loop]=block.body,array=declaration?.decls?.[0],index=loop?.init?.decls?.[0],element=loop?.body?.[0]?.decls?.[0];
        if(!array||!index||!element||[array,index,element].some(d=>typeof d.name!=='string'||!proof.unique(d.name)||
            sdkRoots.has(d.name)||forbidden.has(d.name))||new Set([array.name,index.name,element.name]).size!==3)continue;
        const producer=array.init;
        if(path(producer?.callee)!=='sprites.allOfKind'||producer.args?.length!==1)continue;
        const access={type:'Index',object:id(array.name),index:id(index.name)};
        const destroy={type:'Call',callee:{type:'Member',object:id(element.name),name:'destroy'},args:[]};
        const expected={type:'Block',body:[
            {type:'Declaration',kind:'let',decls:[{name:array.name,init:producer,isArray:true}]},
            {type:'For',init:{type:'Declaration',kind:'let',decls:[{name:index.name,init:{type:'Number',value:0}}]},
                test:{type:'Binary',op:'<',left:id(index.name),right:{type:'Member',object:id(array.name),name:'length'}},
                update:{type:'Update',op:'++',argument:id(index.name),prefix:false},
                body:[{type:'Declaration',kind:'let',decls:[{name:element.name,init:access}]},
                    {type:'ExpressionStatement',expr:destroy}]}]};
        // Ordinary staging may retain explicitly empty declaration metadata.
        // Preserve each field in the comparison; populated type annotations
        // never establish the array, index or element receiver here.
        for(const [actual,wanted] of [[array,expected.body[0].decls[0]],
            [index,expected.body[1].init.decls[0]],[element,expected.body[1].body[0].decls[0]]])
            for(const key of ['typeName','isArray'])if(Object.hasOwn(actual,key)&&!Object.hasOwn(wanted,key))wanted[key]=undefined;
        // Parser/current-AST data and descriptors have already been inspected.
        if(!same(block,expected))continue;
        const owned=new Set();const visit=n=>{if(!n||typeof n!=='object')return;owned.add(n);
            for(const v of Object.values(n))if(v&&typeof v==='object')visit(v);};visit(block);
        const bindings=new Map([[array.name,array],[index.name,index],[element.name,element]]);
        if(proof.nodes.some(n=>n.type==='Identifier'&&bindings.has(n.name)&&
            (!owned.has(n)||proof.declarationAt(n)!==bindings.get(n.name))))continue;
        // The producer is still checked below as the unshadowed SDK call;
        // only this exact bounded read and its no-argument destruction are new.
        allowed.add(element.init);allowed.add(loop.body[1].expr);
    }
    return allowed;
}
export function gameStatsAssignmentProof(program) {
    const proof = inspectGeneratedHelperBindings(program,GENERATED_HELPER_PROFILES.metadata);
    const selected = new Set(), functions = new Set(), namespaces = new Set();
    const snapshotEffects=proof.isCurrent()?destroySnapshotEffects(proof):new Set();
    let safe = proof.isCurrent();
    const collect = (node, prefix = '') => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) {node.forEach(n=>collect(n,prefix));return;}
        if (node.type === 'Namespace') {namespaces.add(prefix + node.name);prefix += node.name + '.';}
        if (node.type === 'FunctionDeclaration') {
            const name = prefix + node.name;if (functions.has(name)) safe = false;functions.add(name);
        }
        if (['Declaration','FunctionDeclaration','FunctionExpression','Namespace','Class','Enum','ForOf'].includes(node.type)) {
            const bound = [...(node.params || []), ...(node.decls || []).map(d=>d.name), node.name].filter(Boolean);
            if (bound.some(name=>sdkRoots.has(name)||forbidden.has(name))) safe = false;
        }
        for (const [key,value] of Object.entries(node)) if (key !== 'originalBody' && value && typeof value === 'object') collect(value,prefix);
    };
    collect(program);
    for (const node of proof.nodes) {
        const parent = proof.parentOf(node);
        if (['Unknown','Class','Object','Spread','Try','ThrowStatement','DestructuringDeclaration',
            'ObjectPattern','ArrayPattern','BindingProperty','RestElement','ForIn','ForOf'].includes(node.type) ||
            node.type==='Index'&&!snapshotEffects.has(node) || node.opaque ||
            node.type === 'Identifier' && forbidden.has(node.name) ||
            node.type === 'Member' && ['prototype','constructor','__proto__'].includes(node.name)) safe = false;
        if (node.type === 'Template' && (node.tag !== 'img' || typeof node.value !== 'string' || node.value.includes('${'))) safe = false;
        if (node.type === 'Call') {
            const name = path(node.callee);
            if (node.isNew || node.constructorCall || node.optional || node.callee?.optional || node.typeArguments?.length ||
                node.args?.some(a=>a?.type === 'Spread') || !calls.has(name) && !functions.has(name) && name !== 'pause' && !snapshotEffects.has(node)) safe = false;
            for (const arg of node.args || []) if (arg.type === 'FunctionExpression' &&
                !['game.onUpdate','game.onUpdateInterval'].includes(name)) safe = false;
        }
        if (node.type === 'Identifier' && (sdkRoots.has(node.name) || namespaces.has(node.name) || functions.has(node.name))) {
            if(sdkRoots.has(node.name)&&!proof.unbound(node))safe=false;
            let top = node, above = parent;
            while (above?.type === 'Member' && above.object === top) {top = above;above = proof.parentOf(top);}
            const name = path(top), invocation = above?.type === 'Call' && above.callee === top;
            const constant = name === 'Math.PI' || /^SpriteKind\.(Player|Projectile|Food|Enemy)$/.test(name || '');
            const stats = name === 'game.stats' && above?.type === 'Assignment' && above.left === top &&
                above.op === '=' && literalBoolean(above.right);
            if (!invocation && !constant && !stats) safe = false;
        }
        if (node.type === 'Assignment' || node.type === 'Update') {
            const target = node.type === 'Assignment' ? node.left : node.argument;
            let root = target;while (root?.type === 'Member' || root?.type === 'Index') root = root.object;
            if (sdkRoots.has(root?.name) || namespaces.has(root?.name) || functions.has(root?.name)) {
                if (path(target) === 'game.stats' && node.op === '=' && literalBoolean(node.right)) selected.add(node);
                else safe = false;
            }
        }
    }
    return {has: node => safe && proof.isCurrent() && selected.has(node)};
}

export function gameStatsConfiguredSourceSafe(files) {
    try {
        const get = name => {const d=Object.getOwnPropertyDescriptor(files,name);return d&&Object.hasOwn(d,'value')&&typeof d.value==='string'?d.value:null;};
        const configText=get('pxt.json'),config=configText===null?null:JSON.parse(configText);
        if ('pxt.json' in files && configText===null) return false;
        const names=config?.files??['main.ts'],tests=config?.testFiles??[];
        if (!Array.isArray(names)||!Array.isArray(tests)||![...names,...tests].every(n=>typeof n==='string')||config?.fileDependencies||
            config?.dependencies&&Object.entries(config.dependencies).some(([k,v])=>k!=='device'||v!=='*')) return false;
        const sources=[];
        for (const name of new Set([...names,...tests])) {
            if (/\.(?:py|asm|c|cpp|h|js|d\.ts)$/.test(name)) return false;
            if (!/\.ts$/.test(name)) continue;
            const source=get(name);if(source===null)return false;sources.push(source);
        }
        const program=parseMakeCodeTs(sources.join('\n;\n'),{retainCallableMetadata:true});
        const proof=gameStatsAssignmentProof(program);let count=0,valid=true;
        const visit=n=>{if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(visit);return;}
            if(n.type==='Assignment'&&path(n.left)==='game.stats'){count++;if(!proof.has(n))valid=false;}
            for(const [k,v]of Object.entries(n))if(k!=='originalBody'&&v&&typeof v==='object')visit(v);};visit(program);
        return valid&&count>0;
    } catch {return false;}
}
