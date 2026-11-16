import {arcadeProjectSource} from './project-source.js';
import {parseMakeCodeTs} from './ts-import.js';
import {createFixedImageResourceMaterializer} from './fixed-jres-images.js';
const path=n=>n?.type==='Identifier'?n.name:n?.type==='Member'?path(n.object)+'.'+n.name:null;
const reject=message=>{throw new Error(message);};
const walk=(node,visit,parent=null)=>{if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(n=>walk(n,visit,parent));return;}visit(node,parent);for(const [key,value]of Object.entries(node))if(!['originalBody','calls'].includes(key))walk(value,visit,node);};

// This is a private translation view of allocating compiler JRES initializers,
// not runtime Buffer interpretation or permission to infer an Image from a name.
export function prepareRootFixedImages(original) {
    try {
        const files=Object.create(null);
        for(const key of Reflect.ownKeys(original)){
            const d=Object.getOwnPropertyDescriptor(original,key);
            if(typeof key!=='string'||!d||!Object.hasOwn(d,'value')||typeof d.value!=='string')reject('root inputs require own String data');
            files[key]=d.value;
        }
        const selected=arcadeProjectSource(files);
        if(!selected.entries.some(e=>e.source.includes('fixedInstance')&&e.source.includes('jres')&&/image\s*\.\s*ofBuffer\s*\(\s*hex``\s*\)/.test(e.source)))return {files:original,resources:[],diagnostics:[]};
        const cfg=JSON.parse(files['pxt.json']);
        if(selected.diagnostics.length||!Array.isArray(cfg.files)||cfg.dependencies?.device!=='*'||Object.keys(cfg.dependencies).some(k=>k!=='device')||Object.keys(cfg.fileDependencies||{}).length)reject('root factory requires complete device-only configured sources');
        const names=[...new Set([...cfg.files,...(cfg.testFiles||[])])],jres=Object.create(null);
        if(names.some(name=>/\.(?:py|asm|c|cpp|h|js)$/i.test(name)))reject('foreign executable root source requires separate authority');
        if(Object.keys(files).some(name=>name.endsWith('.jres')&&!names.includes(name)))reject('unconfigured root resources require separate authority');
        for(const name of names)if(name.endsWith('.jres')){
            if(typeof files[name]!=='string')reject('missing configured root JRES');
            const json=JSON.parse(files[name]),meta=json['*']||{};
            if(!json||typeof json!=='object'||Array.isArray(json))reject('root JRES must be a resource object');
            for(const [key,raw]of Object.entries(json))if(key!=='*'){
                const entry=typeof raw==='string'?{data:raw}:raw;
                if(!entry||typeof entry!=='object'||Array.isArray(entry))reject('invalid root resource');
                const namespace=String(entry.namespace??meta.namespace??'').replace(/\.$/,''),id=key.includes('.')?key:(namespace?namespace+'.':'')+key;
                if(id.split('.').some(part=>['constructor','prototype','__proto__'].includes(part)))reject('prototype resource identity');
                if(Object.hasOwn(jres,id)||entry.id!==undefined&&entry.id!==id)reject('ambiguous root resource identity: '+id);
                jres[id]={...entry,id,namespace,mimeType:entry.mimeType??meta.mimeType,dataEncoding:entry.dataEncoding??meta.dataEncoding??'base64'};
            }
        }
        // Include hidden TS writers in the proof, without adding them to the
        // executable source view. Active non-TS inputs already fail selection.
        const censusNames=[...new Set([...names,...Object.keys(files).filter(k=>k.endsWith('.ts'))])];
        const bodies=[];
        for(const name of censusNames)if(name.endsWith('.ts')){
            if(typeof files[name]!=='string')reject('missing root source');
            bodies.push(...parseMakeCodeTs(files[name],{parameterDefaults:true,retainCallableMetadata:true}).body);
        }
        const program={type:'Program',body:bodies},namespaces=new Set();
        const namespaceNames=(body,prefix='')=>{for(const n of body||[])if(n.type==='Namespace'){const qualified=prefix+n.name;namespaces.add(qualified.split('.')[0]);namespaceNames(n.body,qualified+'.');}};namespaceNames(program.body);
        const forbidden=new Set(['this','arguments','globalThis','global','window','self','eval','Function','Reflect','Object','Proxy']);
        walk(program,(node,parent)=>{
            if(['Unknown','Index','Object','Class'].includes(node.type)||node.opaque||node.type==='Identifier'&&forbidden.has(node.name)||node.type==='Member'&&['constructor','prototype','__proto__'].includes(node.name))reject('opaque, ambient or computed root source cannot bind a factory');
            if(node.type==='Identifier'&&namespaces.has(node.name)&&!(parent?.type==='Member'&&parent.object===node))reject('root namespace escapes');
            const target=node.type==='Assignment'?node.left:node.type==='Update'||node.type==='Unary'&&node.op==='delete'?node.argument:null,key=path(target);
            if(key&&Object.hasOwn(jres,key))reject('root resource binding writer: '+key);
        });
        const proofFiles={...files,'pxt.json':JSON.stringify({...cfg,files:censusNames,testFiles:[]})};
        const resolved={packages:{},sourceOrder:[],jres,rootResourceIds:Object.keys(jres),runtimeConfig:{palette:cfg.palette}};
        const materialize=createFixedImageResourceMaterializer(proofFiles,resolved),prepared={...files},resources=[];
        for(const entry of selected.entries){const result=materialize(null,entry.name,entry.source);prepared[entry.name]=result.source;resources.push(...result.resources);}
        return {files:prepared,resources,diagnostics:[]};
    }catch(error){return {files:original,resources:[],diagnostics:['Root fixed-instance JRES image: '+error.message]};}
}
