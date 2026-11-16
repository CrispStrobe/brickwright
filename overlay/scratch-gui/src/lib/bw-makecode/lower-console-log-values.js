import {tokenize} from './ts-import.js';
import {inspectGeneratedHelperBindings,GENERATED_HELPER_PROFILES} from './generated-helper-recognition.js';
import {analyseSourceValueProducers} from './source-value-producers.js';

// A deliberately small original-source boundary for this new spelling. Other
// source keeps its existing named refusal, rather than borrowing erased code.
export function consoleLogValueConfiguredSourceSafe(files) {
    try {
        const values=Object.create(null);
        for(const name of Reflect.ownKeys(files)){
            const d=Object.getOwnPropertyDescriptor(files,name);
            if(typeof name!=='string'||!d||!Object.hasOwn(d,'value')||typeof d.value!=='string')return false;
            values[name]=d.value;
        }
        const config=JSON.parse(values['pxt.json']||'null');
        if(config&&(!Array.isArray(config.files)||!config.files.every(n=>typeof n==='string')||
            config.testFiles!==undefined&&(!Array.isArray(config.testFiles)||!config.testFiles.every(n=>typeof n==='string'))||
            config.dependencies?.device!=='*'||Object.keys(config.dependencies).some(n=>n!=='device')))return false;
        const names=[...new Set([...(config?.files||['main.ts']),...(config?.testFiles||[])])];
        for(const name of names){
            if(!/\.(?:ts|py|asm|c|cpp|h)$/.test(name))continue;
            if(!Object.hasOwn(values,name)||config?.fileDependencies&&Object.hasOwn(config.fileDependencies,name))return false;
            if(/\.py$/.test(name)&&['tsprj','blocksprj'].includes(config?.preferredEditor))continue;
            if(!/\.ts$/.test(name)||/\.(?:g|d)\.ts$/.test(name))return false;
            const text=values[name],tokens=tokenize(text);
            if(/\/\/\s*%|\/\*\s*%/.test(text))return false;
            for(let i=0;i<tokens.length;i++){
                const t=tokens[i],before=tokens[i-1];
                if(t.unknownBefore||t.invalidLiteral||['class','namespace','interface','enum'].includes(t.type)||t.type==='template'&&t.value.includes('${'))return false;
                if(t.type==='ident'&&['globalThis','global','window','self','eval','Function','Reflect','Object','Proxy','arguments','constructor','prototype','__proto__'].includes(t.value))return false;
                if(t.value==='['&&(['ident','number','string','template'].includes(before?.type)||[')',']','}','.'].includes(before?.value)))return false;
                if(t.type==='ident'&&t.value==='console'&&(before?.value==='.'||tokens[i+1]?.value!=='.'||
                    !['log','logValue','inspect'].includes(tokens[i+2]?.value)||tokens[i+3]?.value!=='('))return false;
            }
        }
        return true;
    }catch{return false;}
}

export function lowerConsoleLogValues(program,sourceSafe) {
    if(!sourceSafe)return program;
    const proof=inspectGeneratedHelperBindings(program,GENERATED_HELPER_PROFILES.ordinary);
    if(!proof.isCurrent())return program;
    const calls=proof.nodes.filter(n=>n.type==='Call'&&n.callee?.type==='Member'&&n.callee.name==='logValue'&&n.callee.object?.type==='Identifier'&&n.callee.object.name==='console');
    if(!calls.length)return program;
    const facts=analyseSourceValueProducers(program,{ordinaryPrimitiveSdkNumbers:true,consoleInspection:true,
        opaqueDeclarationValues:true,unboundIsOpaque:true,uninitializedLocalsAreOpaque:true});
    const selected=new Set();
    for(const node of calls){
        const [label,value]=node.args,types=facts.typesAt(value);
        if(!node.isNew&&!node.constructorCall&&!node.optional&&!node.callee.optional&&!node.typeArguments?.length&&node.args.length===2&&
            label?.type==='String'&&typeof label.value==='string'&&value?.type==='Member'&&!value.optional&&['x','y'].includes(value.name)&&
            value.object?.type==='Identifier'&&proof.unbound(node.callee.object)&&types.size===1&&types.has('Number'))selected.add(node);
    }
    if(!proof.isCurrent())return program;
    const rewrite=node=>{
        if(!node||typeof node!=='object')return node;
        if(Array.isArray(node))return node.map(rewrite);
        if(selected.has(node)){
            // This is the already-supported primitive-inspection intrinsic,
            // issued only after actual Number authority. The value occurs once.
            const inspected={type:'Call',callee:{type:'Identifier',name:'__bwConsoleInspectValue'},
                args:[rewrite(node.args[1]),{type:'Number',value:20}],bwConsoleInspectIntrinsic:true};
            const text=node.args[0].value?{type:'Binary',op:'+',left:{type:'String',value:node.args[0].value+': '},right:inspected}:inspected;
            return {type:'Call',callee:{type:'Member',object:{type:'Identifier',name:'console'},name:'log'},args:[text]};
        }
        return Object.fromEntries(Object.entries(node).map(([key,value])=>[key,rewrite(value)]));
    };
    return rewrite(program);
}
