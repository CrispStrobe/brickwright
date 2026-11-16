import {parseMakeCodeTs,tokenize} from './ts-import.js';
import {analyseSourceValueProducers} from './source-value-producers.js';
import {proveLocalNumericArrayResults} from './local-array-family-entry.js';
import {validateLocalNumericResultEffects} from './local-numeric-result-effects.js';
const within=value=>Number.isInteger(value)&&value>=1&&value<=3;
const api=node=>node?.type==='Call'&&node.callee?.type==='Member'&&!node.callee.optional&&node.callee.object?.type==='Identifier'&&node.callee.object.name==='game'&&
    ['askForNumber','askForString'].includes(node.callee.name)?node.callee.name:null;
const inventory=program=>{
    const nodes=[],parents=new WeakMap(),seen=new WeakSet();
    const walk=(node,parent=null)=>{if(!node||typeof node!=='object'||seen.has(node))return;seen.add(node);if(Array.isArray(node)){node.forEach(child=>walk(child,parent));return;}
        nodes.push(node);parents.set(node,parent);for(const [key,value]of Object.entries(node))if(!['originalBody','paramTypes','parameterDefaults','returnType','typeParameters','assertedType'].includes(key)&&value&&typeof value==='object')walk(value,node);};
    walk(program);return {nodes,parents};
};
const graph=program=>analyseSourceValueProducers(program,{parenthesized:true,unboundIsOpaque:true,initializationEntries:true,
    provenArrayLength:true,ordinaryPrimitiveSdkNumbers:true,arrayValues:true,arrayLoopEntries:true,closureEntries:true,closedOrdinaryEntries:true,primitiveComparisons:true});
function closedProgram(program,facts){
    const {nodes,parents}=inventory(program),ambient=new Set(['this','arguments','globalThis','global','window','self','eval','Function','Reflect','Object','Proxy','Array','String','Number','parseFloat','parseInt','console','Promise']);
    const protectedBindings=new Set([...ambient,'game','Math']);
    for(const n of nodes){
        if(n.type==='Declaration'&&n.decls?.some(d=>protectedBindings.has(d.name))||n.type==='FunctionDeclaration'&&(protectedBindings.has(n.name)||n.params?.some(name=>protectedBindings.has(name))))return false;
        if(['Unknown','Class','Object','Namespace','FunctionExpression','Spread'].includes(n.type)||n.opaque||
            n.type==='Identifier'&&ambient.has(n.name)||n.type==='Member'&&['constructor','prototype','__proto__'].includes(n.name))return false;
        if(n.type==='Call'){
            if(n.isNew||n.constructorCall||n.optional||n.callee?.optional||n.typeArguments?.length||n.args?.some(a=>a?.type==='Spread'))return false;
            if(n.callee?.type==='Identifier'&&!facts.immutableFunctionAt(n))return false;
            if(n.callee?.type==='Member'){
                const name=n.callee.name,root=n.callee.object;
                const sdk=root?.type==='Identifier'&&facts.isSdkNamespace(root)&&
                    (root.name==='game'&&['splash','askForNumber','askForString'].includes(name)||root.name==='Math'&&name==='idiv');
                if(!sdk&&!['push','reverse','charAt'].includes(name))return false;
            }
        }
        const target=n.type==='Assignment'?n.left:n.type==='Update'?n.argument:null;
        if(target?.type==='Member'||target?.type==='Index')return false;
        if(n.type==='Identifier'&&['game','Math'].includes(n.name)&&facts.isSdkNamespace(n)){
            const member=parents.get(n),call=parents.get(member);if(member?.type!=='Member'||member.object!==n||call?.type!=='Call'||call.callee!==member)return false;
        }
    }
    // The independent seed/writer/effect walk consumes actual producers, not
    // a graph containing the proposed numeric result loan.
    const proposed=proveLocalNumericArrayResults(program,facts)||new Map();
    return validateLocalNumericResultEffects(program,facts,proposed);
}
function constants(program,facts){
    const {nodes,parents}=inventory(program),out=new Map();
    for(const statement of program.body||[])if(statement.type==='Declaration')for(const decl of statement.decls||[]){
        if(decl.init?.type!=='Number'||!within(Number(decl.init.value))||facts.declarationCountAt(statement,decl.name)!==1)continue;
        const key=facts.bindingOf(statement,decl.name);let valid=true,used=false;
        for(const n of nodes){
            if(n.type==='Assignment'&&n.left?.type==='Identifier'&&facts.bindingOf(n.left)===key||n.type==='Update'&&n.argument?.type==='Identifier'&&facts.bindingOf(n.argument)===key){valid=false;break;}
            if(n.type!=='Identifier'||facts.bindingOf(n)!==key)continue;
            const call=parents.get(n);
            if(call?.type==='Assignment'&&call.left===n||call?.type==='Update'&&call.argument===n)continue; // writers checked above
            if(!api(call)||call.args?.length!==2||call.args[1]!==n||call.args[0]?.type!=='String'||!facts.isSdkNamespace(call.callee.object)||!facts.isInitializedAt(n)){valid=false;break;}
            used=true;
        }
        if(valid&&used)out.set(decl.name,{key,value:Number(decl.init.value)});
    }
    return out;
}
function configuredProgram(files){
    try{
        const get=name=>{const d=Object.getOwnPropertyDescriptor(files,name);return d&&Object.hasOwn(d,'value')&&typeof d.value==='string'?d.value:null;};
        const configText=get('pxt.json'),config=configText===null?null:JSON.parse(configText),names=config?.files??['main.ts'],tests=config?.testFiles??[];
        if('pxt.json' in files&&configText===null||!Array.isArray(names)||!Array.isArray(tests)||![...names,...tests].every(n=>typeof n==='string'))return null;
        if(config?.dependencies&&Object.entries(config.dependencies).some(([name,version])=>name!=='device'||version!=='*'))return null;
        const sources=[];
        for(const name of new Set([...names,...tests])){
            if(/\.(?:py|asm|c|cpp|h|js|d\.ts)$/.test(name))return null;
            if(!/\.ts$/.test(name))continue;
            const source=get(name);if(source===null||config?.fileDependencies&&Object.hasOwn(config.fileDependencies,name))return null;
            if(tokenize(source).some(t=>t.unknownBefore||t.invalidLiteral))return null;
            const boundary=parseMakeCodeTs(source,{retainCallableMetadata:true});if(inventory(boundary).nodes.some(n=>n.type==='Unknown'||n.opaque))return null;
            sources.push(source);
        }
        return sources.length?parseMakeCodeTs(sources.join('\n'),{retainCallableMetadata:true}):null;
    }catch{return null;}
}
// Fold only a literal initializer whose actual root binding is initialized,
// unwritten and used exclusively as these two SDK option arguments. This does
// not evaluate an expression, alias, getter or callback and never changes files.
export function normalizeOwnedPromptOptions(program,files){
    if(!inventory(program).nodes.some(n=>api(n)&&n.args?.length===2&&n.args[0]?.type==='String'&&(n.args[1]?.type==='Identifier'||within(Number(n.args[1]?.value))&&(api(n)==='askForString'||n.bwPxtNumberPromptLength!==true))))return program;
    const raw=configuredProgram(files);if(!raw)return program;
    const rawFacts=graph(raw);if(!closedProgram(raw,rawFacts))return program;
    const rawConstants=constants(raw,rawFacts),facts=graph(program);if(!closedProgram(program,facts))return program;
    const owned=constants(program,facts);
    for(const node of inventory(program).nodes){
        const name=api(node);if(!name||node.args?.length!==2||node.args[0]?.type!=='String'||!facts.isSdkNamespace(node.callee.object))continue;
        const arg=node.args[1];let value;
        if(arg?.type==='Number')value=Number(arg.value);
        else if(arg?.type==='Identifier'){
            const record=owned.get(arg.name),rawRecord=rawConstants.get(arg.name);
            if(!record||!rawRecord||record.value!==rawRecord.value||facts.bindingOf(arg)!==record.key||!facts.isInitializedAt(arg))continue;
            // Identifier-valued options are qualified only for this bounded
            // three-digit / two-character slice; other bindings stay refused.
            if(record.value!==(name==='askForNumber'?3:2))continue;
            value=record.value;
        }
        if(!within(value))continue;
        node.args[1]={type:'Number',value:String(value)};
        if(name==='askForNumber')node.bwPxtNumberPromptLength=true;
        else node.bwPxtLimitedTextPrompt=true;
    }
    return program;
}
export function literalLimitedTextPrompt(node){return api(node)==='askForString'&&!node.isNew&&!node.optional&&!node.constructorCall&&!node.typeArguments?.length&&node.args?.length===2&&node.args[0]?.type==='String'&&node.args[1]?.type==='Number'&&within(Number(node.args[1].value));}
