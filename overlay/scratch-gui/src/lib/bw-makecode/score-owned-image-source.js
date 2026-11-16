import {parseMakeCodeTs,tokenize} from './ts-import.js';
import {parseImageAssetEntries,parseImageLiteral} from './arcade-assets.js';
import {GENERATED_HELPER_PROFILES} from './generated-helper-recognition.js';
import {arcadeProjectSource} from './project-source.js';

// This exception belongs only to the score-registration census. Its input is
// the original configured files, before generated files/classes can disappear.
const sources=new WeakMap();
const path=n=>n?.type==='Identifier'?n.name:n?.type==='Member'?path(n.object)+'.'+n.name:null;
const empty=n=>!n||n.length===0;
const plainCall=(n,name,count)=>n?.type==='Call'&&path(n.callee)===name&&!n.isNew&&!n.constructorCall&&!n.optional&&empty(n.typeArguments)&&n.args?.length===count;
const nullReturn=n=>n?.type==='Return'&&n.value?.type==='Null';
const imageText=image=>Array.from({length:image.height},(_,y)=>Array.from(image.pixels.slice(y*image.width,(y+1)*image.width),n=>n?n.toString(16):'.').join(' ')).join('\n');
const sameImage=(a,b)=>a&&b&&a.width===b.width&&a.height===b.height&&a.pixels.length===b.pixels.length&&a.pixels.every((n,i)=>n===b.pixels[i]);
const infoCalls=new Set(['info','info.player1','info.player2','info.player3','info.player4'].flatMap(root=>
    ['score','hasScore','setScore','changeScoreBy','life','hasLife','setLife','changeLifeBy','onLifeZero','onScore'].map(method=>root+'.'+method)));
for(const method of ['startCountdown','stopCountdown','onCountdownEnd','showScore','showLife','showCountdown'])infoCalls.add('info.'+method);
infoCalls.add('info.player1.impl.onScore');
const ambient=new Set(['globalThis','global','window','self','eval','Function','Reflect','Object','Proxy','arguments','constructor','prototype','__proto__']);

function generatedImages(text,jres) {
    // Compiler pragmas are not ordinary comments: a matching parsed body alone
    // cannot establish that the compiler will execute that body.
    if(/\/\/\s*%|\/\*\s*%/.test(text))return null;
    const raw=JSON.parse(jres),entries=parseImageAssetEntries(jres);
    if(!raw||Array.isArray(raw)||!entries.length||Object.keys(raw).filter(k=>k!=='*').length!==entries.length||entries.some(e=>!e.factoryRegistered))return null;
    const ast=parseMakeCodeTs(text),ns=ast.body[0];
    if(ast.body.length!==1||ns?.type!=='Namespace'||ns.name!=='myImages'||![3,4].includes(ns.body?.length))return null;
    const names=new Map();
    for(const [index,st]of ns.body.entries()){
        const call=st.type==='ExpressionStatement'&&st.expr,kind=['image','animation','song','json'][index];
        if(!plainCall(call,'helpers._registerFactory',2)||call.args[0]?.type!=='String'||call.args[0].value!==kind)return null;
        const fn=call.args[1],sw=fn?.body?.[0];
        if(fn?.type!=='FunctionExpression'||fn.name||fn.params?.length!==1||fn.params[0]!=='name'||
            fn.paramTypes?.name?.text!=='string'||!empty(fn.typeParameters)||!empty(fn.optionalParams)||!empty(fn.parameterDefaults)||
            fn.returnType||fn.body?.length!==2||!nullReturn(fn.body[1])||sw?.type!=='Switch'||
            !plainCall(sw.discriminant,'helpers.stringTrim',1)||sw.discriminant.args[0]?.type!=='Identifier'||sw.discriminant.args[0].name!=='name')return null;
        if(index){if(sw.cases.length)return null;continue;}
        let offset=0;
        for(const entry of entries){
            const item=raw[entry.key],id=entry.key.startsWith('myImages.')&&!entry.key.slice(9).includes('.')?entry.key.slice(9):entry.key;
            const aliases=typeof item==='string'?[id]:[id,item.displayName];
            if(aliases.some(name=>typeof name!=='string'||!name))return null;
            for(const [aliasIndex,name]of aliases.entries()){
                const row=sw.cases[offset++];
                if(row?.test?.type!=='String'||row.test.value!==name)return null;
                if(aliasIndex<aliases.length-1){if(row.body.length)return null;continue;}
                const value=row.body[0]?.value;
                if(row.body.length!==1||row.body[0].type!=='Return'||value?.type!=='Template'||value.tag!=='img'||value.value.includes('${')||!sameImage(parseImageLiteral(value.value),entry.image))return null;
            }
            for(const name of aliases){if(names.has(name))return null;names.set(name,imageText(entry.image));}
        }
        if(offset!==sw.cases.length)return null;
    }
    return names;
}

function originalSource(files) {
    const keys=Reflect.ownKeys(files),rows=[];
    for(const key of keys){const d=Object.getOwnPropertyDescriptor(files,key);if(typeof key!=='string'||!d||!Object.hasOwn(d,'value')||typeof d.value!=='string')return null;rows.push([key,d]);}
    const current=()=>Reflect.ownKeys(files).length===keys.length&&rows.every(([key,d])=>{const a=Object.getOwnPropertyDescriptor(files,key);return a&&Object.hasOwn(a,'value')&&a.value===d.value&&a.enumerable===d.enumerable&&a.writable===d.writable&&a.configurable===d.configurable;});
    const config=JSON.parse(files['pxt.json']);
    if(!Array.isArray(config?.files)||!config.files.every(n=>typeof n==='string')||config.testFiles&&!Array.isArray(config.testFiles)||
        Object.keys(config.dependencies||{}).some(n=>n!=='device')||config.dependencies?.device!=='*')return null;
    const declared=[...new Set([...config.files,...(config.testFiles||[])])];
    if(!declared.every(n=>typeof n==='string'&&Object.hasOwn(files,n)))return null;
    const generated=declared.filter(n=>/\.g\.ts$/.test(n));if(generated.length!==1)return null;
    const filename=generated[0],resource=filename.replace(/\.ts$/,'.jres');
    if(!declared.includes(resource))return null;
    const names=generatedImages(files[filename],files[resource]);if(!names)return null;
    for(const name of declared){
        if(config.fileDependencies&&Object.hasOwn(config.fileDependencies,name))return null;
        if(/\.py$/.test(name)&&['tsprj','blocksprj'].includes(config.preferredEditor))continue;
        if(/\.(?:py|asm|c|cpp|h)$/.test(name)||/\.d\.ts$/.test(name))return null;
        if(!/\.ts$/.test(name))continue;
        const text=files[name],tokens=tokenize(text);
        if(/\/\/\s*%|\/\*\s*%/.test(text)||tokens.some(t=>t.unknownBefore||t.invalidLiteral||t.type==='template'&&t.value.includes('${')))return null;
        if(name===filename)continue;
        for(let i=0;i<tokens.length;i++){
            const token=tokens[i],before=tokens[i-1];
            if(['ident','string'].includes(token.type)&&ambient.has(token.value))return null;
            if(token.value==='['&&(['ident','number','string','template'].includes(before?.type)||[')',']','}','.'].includes(before?.value)))return null;
            if(token.type!=='ident')continue;
            if(['helpers','myImages'].includes(token.value))return null;
            if(token.value==='assets'){
                if(before?.value==='.'||tokens[i+1]?.value!=='.'||tokens[i+2]?.value!=='image'||tokens[i+3]?.type!=='template'||!names.has(tokens[i+3].value.trim()))return null;
            }
            if(token.value==='img'&&(before?.value==='.'||tokens[i+1]?.type!=='template'))return null;
            if(token.value==='info'){
                let end=i,p='info';while(tokens[end+1]?.value==='.'&&tokens[end+2]?.type==='ident'){p+='.'+tokens[end+2].value;end+=2;}
                if(before?.value==='.'||tokens[end+1]?.value!=='('||!infoCalls.has(p))return null;
            }
        }
    }
    return {names,current};
}

function programState(program) {
    const rows=[],seen=new WeakSet();let valid=true;
    const visit=value=>{
        if(!value||typeof value!=='object'||seen.has(value))return;
        seen.add(value);const proto=Object.getPrototypeOf(value),keys=Reflect.ownKeys(value),descriptors=keys.map(k=>Object.getOwnPropertyDescriptor(value,k));
        if(![Object.prototype,Array.prototype,null].includes(proto)||keys.some((k,i)=>typeof k!=='string'||!Object.hasOwn(descriptors[i],'value'))){valid=false;return;}
        rows.push({value,proto,keys,descriptors});for(const d of descriptors)visit(d.value);
    };visit(program);
    return ()=>valid&&rows.every(r=>{const keys=Reflect.ownKeys(r.value);return Object.getPrototypeOf(r.value)===r.proto&&keys.length===r.keys.length&&keys.every((k,i)=>k===r.keys[i]&&(()=>{const a=Object.getOwnPropertyDescriptor(r.value,k),b=r.descriptors[i];return a&&Object.hasOwn(a,'value')&&Object.is(a.value,b.value)&&a.enumerable===b.enumerable&&a.writable===b.writable&&a.configurable===b.configurable;})());});
}

const pristineEmptyParserArray=value=>{
    if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)return false;
    const keys=Reflect.ownKeys(value),d=Object.getOwnPropertyDescriptor(value,'length');
    return keys.length===1&&keys[0]==='length'&&d&&Object.hasOwn(d,'value')&&d.value===0&&d.writable===true&&d.enumerable===false&&d.configurable===false;
};

function sameParsedData(a,b) {
    if(!a||!b||typeof a!=='object'||typeof b!=='object')return Object.is(a,b);
    if(Array.isArray(a)!==Array.isArray(b))return false;
    // Existing owned clone passes omit only these empty, non-executable
    // parser parameter-array records. Nonempty defaults/properties stay exact.
    const keys=value=>Reflect.ownKeys(value).filter(k=>{const d=Object.getOwnPropertyDescriptor(value,k);return !(Array.isArray(value)&&['optionalParams','parameterDefaults','parameterProperties'].includes(k)&&!d.enumerable&&!d.writable&&!d.configurable&&pristineEmptyParserArray(d.value));});
    const ak=keys(a),bk=keys(b);if(ak.length!==bk.length||ak.some((k,i)=>k!==bk[i]))return false;
    return ak.every(k=>{const x=Object.getOwnPropertyDescriptor(a,k),y=Object.getOwnPropertyDescriptor(b,k);return x&&y&&Object.hasOwn(x,'value')&&Object.hasOwn(y,'value')&&
        x.enumerable===y.enumerable&&x.configurable===y.configurable&&x.writable===y.writable&&sameParsedData(x.value,y.value);});
}

export function bindScoreImageSource(program,files) {
    sources.delete(program);
    try{
        const source=originalSource(files),astCurrent=programState(program);
        if(!source||!astCurrent())return;
        // This deliberately bounded exception does not authorize transformed
        // bodies. The exact selected executable body must still equal an
        // original configured-source parse; metadata outside body is not code.
        const selected=arcadeProjectSource(files);if(selected.diagnostics.length)return;
        if(![GENERATED_HELPER_PROFILES.ordinary,GENERATED_HELPER_PROFILES.metadata].some(profile=>
            sameParsedData(program.body,parseMakeCodeTs(selected.source,profile).body)))return;
        const current=source.current;sources.set(program,{names:source.names,current:()=>current()&&astCurrent()});
    }catch{/* no admission */}
}

export function scoreImageBindingView(program) {
    const source=sources.get(program);if(!source?.current())return null;
    const rows=[],seen=new Map(),originals=new WeakMap();let valid=true,changed=false;
    const copy=value=>{
        if(!value||typeof value!=='object')return value;
        if(seen.has(value))return seen.get(value);
        const proto=Object.getPrototypeOf(value);if(![Object.prototype,Array.prototype,null].includes(proto)){valid=false;return null;}
        const keys=Reflect.ownKeys(value),descriptors=keys.map(k=>Object.getOwnPropertyDescriptor(value,k));
        if(keys.some((k,i)=>typeof k!=='string'||!Object.hasOwn(descriptors[i],'value'))){valid=false;return null;}
        rows.push({value,proto,keys,descriptors});const result=Array.isArray(value)?[]:Object.create(proto);seen.set(value,result);originals.set(result,value);
        let text=null;if(value.type==='Template'&&value.tag==='assets.image'){
            if(typeof value.value!=='string'||value.value.includes('${')||!source.names.has(value.value.trim()))valid=false;
            else {text=source.names.get(value.value.trim());changed=true;}
        }
        for(let i=0;i<keys.length;i++){
            const key=keys[i],d=descriptors[i],next=text!==null&&key==='tag'?'img':text!==null&&key==='value'?text:copy(d.value);
            Object.defineProperty(result,key,{...d,value:next});
        }
        return result;
    };
    const projected=copy(program);
    const current=()=>valid&&sources.get(program)===source&&source.current()&&rows.every(r=>{const keys=Reflect.ownKeys(r.value);return Object.getPrototypeOf(r.value)===r.proto&&keys.length===r.keys.length&&keys.every((k,i)=>k===r.keys[i]&&(()=>{const a=Object.getOwnPropertyDescriptor(r.value,k),b=r.descriptors[i];return a&&Object.hasOwn(a,'value')&&Object.is(a.value,b.value)&&a.enumerable===b.enumerable&&a.writable===b.writable&&a.configurable===b.configurable;})());});
    return valid&&changed?{program:projected,current,originalOf:node=>originals.get(node)}:null;
}
