
'use strict';
const fs = require('node:fs'), vm = require('node:vm'), crypto = require('node:crypto'), path = require('node:path');
const packet = JSON.parse(fs.readFileSync(0, 'utf8'));
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const blob = data => crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob '+data.length+'\0'), data])).digest('hex');
const check = (data, spec, label) => {
 if(data.length!==spec.bytes || hash(data)!==spec.sha256 || (spec.gitBlob && blob(data)!==spec.gitBlob))
  throw new Error('Integrity refusal: '+label);
};
const virtualRoot = '/memory-sdcc';
const sourcePath = virtualRoot+'/generated-multimeter-idle.c';
const outputPath = virtualRoot+'/output/canary.ihx';
const dist = virtualRoot+'/dist';
const installed = virtualRoot+'/installed';
const files = new Map(), outputs = new Map(), stages = [], diagnostics = [], modules = {}, operations = [];
const report = {schema:'bw.lp1.sdcc-link-member-experiment.v1',startedAtUtc:new Date().toISOString(),
 result:'not-run',driverUnchanged:true,hostPayloadWrites:0,externalProcesses:0,networkDuringCompilerExecution:false,
 archive:packet.archive,integrity:{},input:packet.inputSpec,host:{node:process.versions.node,platform:process.platform,architecture:process.arch},adapter:{exit:'Call the historical driver quit logger, then throw the exact supplied exception to restore generated Emscripten quit unwinding; any nonzero status or unexpected exit exception fails.',headerObservation:'FS.open hook is installed immediately after the original preRun seeding callback; seeding writes are excluded.',historicalEnvironmentIdentical:false}};
const bytes = x => Buffer.isBuffer(x)?Buffer.from(x):Buffer.from(x,'utf8');
const source = bytes(packet.input), driver = bytes(packet.driver), runtimeBytes = bytes(packet.runtimeJson);
check(source,packet.inputSpec,'canary');check(driver,packet.driverSpec,'historical driver');check(runtimeBytes,packet.runtimeSpec,'runtime.json');
const runtime = JSON.parse(packet.runtimeJson);
if(runtime.format!==1 || Object.keys(runtime.files).length!==92)throw new Error('Runtime shape refusal');
const runtimeByPath = new Map(packet.runtimeMemberSpecs.map(x=>[x.path,x]));
for(const [file,encoded] of Object.entries(runtime.files)){
 if(!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)||encoded.length%4)throw new Error('Runtime base64 refusal');
 const value=Buffer.from(encoded,'base64'),spec=runtimeByPath.get(file);
 if(!spec)throw new Error('Unexpected runtime member: '+file);
 check(value,spec,file);
 const target=file.startsWith('/include/')?installed+'/share/sdcc'+file:installed+'/share/sdcc'+file;
 files.set(target,value);
}
const inputs = {};
for(const item of packet.moduleSpecs){
 const name=item.path.split('.')[0],entry=packet.modules[name];
 if(!entry)throw new Error('Missing module '+name);
 if(item.path.endsWith('.wasm')){
   const value=Buffer.from(entry.wasm,'base64');check(value,item.supplier,item.path);inputs[name]={...(inputs[name]||{}),wasm:value};
 } else {
   const original=bytes(entry.js),suffix=Buffer.from(packet.exportAppendHex,'hex'),published=Buffer.concat([original,suffix]);
   check(original,item.historical,'historical '+item.path);check(published,item.supplier,'supplier '+item.path);
   files.set(dist+'/'+item.path,original);inputs[name]={...(inputs[name]||{}),js:original};
 }
}
files.set(sourcePath,source);
report.integrity={verifiedBeforeExecution:true,compilerFiles:8,runtimeMembers:92,runtimeJson:{bytes:runtimeBytes.length,sha256:hash(runtimeBytes),gitBlob:blob(runtimeBytes)},
 driver:{bytes:driver.length,sha256:hash(driver),gitBlob:blob(driver)},input:{bytes:source.length,sha256:hash(source),gitBlob:blob(source)},
 javascriptBranch:'Verified historical CommonJS body; appending the exact 27-byte export reproduces each supplier JavaScript file.'};
const canon = p => path.posix.normalize(String(p));
const get = p => files.get(canon(p))||outputs.get(canon(p));
const exists = p => !!get(p)||[...files.keys(),...outputs.keys()].some(k=>k.startsWith(canon(p).replace(/\/$/,'')+'/'));
const memoryFs = {
 existsSync:exists,
 readFileSync(p,options){const v=get(p);if(!v)throw new Error('Unseeded host read refused: '+p);const enc=typeof options==='string'?options:options?.encoding;return enc?v.toString(enc):Buffer.from(v);},
 writeFileSync(p,value,options){p=canon(p);if(!/^\/memory-sdcc\/output\/canary\.(?:i|asm|rel|ihx)$/.test(p))throw new Error('Host write refused: '+p);outputs.set(p,typeof value==='string'?Buffer.from(value,typeof options==='string'?options:options?.encoding||'utf8'):Buffer.from(value));},
 readdirSync(p){const prefix=canon(p).replace(/\/$/,'')+'/';if(!exists(p))throw new Error('Missing memory directory');return [...new Set([...files.keys(),...outputs.keys()].filter(k=>k.startsWith(prefix)).map(k=>k.slice(prefix.length).split('/')[0]))].sort();},
 statSync(p){if(!exists(p))throw new Error('Missing memory entry');const file=!!get(p);return {isFile:()=>file,isDirectory:()=>!file,size:file?get(p).length:0};}
};
const captureConsole={log:(...a)=>diagnostics.push({kind:'log',text:a.map(String).join(' ')}),error:(...a)=>diagnostics.push({kind:'error',text:a.map(String).join(' ')}),warn:(...a)=>diagnostics.push({kind:'warn',text:a.map(String).join(' ')})};
const processStub = () => ({argv:['node','/memory-sdcc/wasm-compile-driver.cjs',dist,installed,sourcePath,outputPath],versions:{node:process.versions.node},platform:process.platform,env:{},cwd:()=>virtualRoot,exit(code){throw new Error('Compiler process exit requested: '+code);},on(){return this;},once(){return this;},removeListener(){return this;},stdout:{write:t=>diagnostics.push({kind:'stdout',text:String(t)})},stderr:{write:t=>diagnostics.push({kind:'stderr',text:String(t)})},exitCode:0});
const noChild = new Proxy({}, {get(){return ()=>{report.externalProcesses++;throw new Error('External process refused');};}});
const toolRequire = name => {if(name==='fs'||name==='node:fs')return memoryFs;if(name==='path'||name==='node:path')return path;if(name==='crypto'||name==='node:crypto')return crypto;if(name==='child_process'||name==='node:child_process')return noChild;throw new Error('Unapproved module require: '+name);};
const factories={};
for(const name of ['sdcc','cc1','sdas8051','sdld']){
 const cjs={exports:{}};
 const context=vm.createContext({module:cjs,exports:cjs.exports,require:toolRequire,__filename:dist+'/'+name+'.js',__dirname:dist,
  Buffer,process:processStub(),console:captureConsole,WebAssembly,TextDecoder,TextEncoder,setTimeout,clearTimeout,setImmediate,clearImmediate,performance,URL});
 context.global=context;
 new vm.Script(inputs[name].js.toString('utf8'),{filename:dist+'/'+name+'.js'}).runInContext(context,{timeout:2000});
 if(typeof cjs.exports!=='function')throw new Error('Factory refusal: '+name);
 factories[name]=async config=>{
  const stage={tool:name,arguments:[...config.arguments],thisProgram:config.thisProgram,quitStatuses:[],quitErrors:[],openedRuntimePaths:[]};
  stages.push(stage);
  const originalQuit=config.quit;
  const observe=Module=>{
   const open=Module.FS.open;
   Module.FS.open=function(...args){const stream=open.apply(this,args);if(stream?.path&&(/^\/include\//.test(stream.path)||/^\/lib\//.test(stream.path)))stage.openedRuntimePaths.push(stream.path);return stream;};
  };
  const module=await cjs.exports({...config,wasmBinary:inputs[name].wasm,locateFile:file=>dist+'/'+file,
   preRun:config.preRun.map(fn=>function(M){fn(M);observe(M);}),
   quit(status,error){stage.quitStatuses.push(status);stage.quitErrors.push(error?{name:error.name,message:error.message,status:error.status}:null);if(originalQuit)originalQuit(status,error);if(error)throw error;throw new Error('Compiler quit without supplied exception: '+status);}
  });
  modules[name]=module;
  stage.openedRuntimePaths=[...new Set(stage.openedRuntimePaths)].sort();
  if(stage.quitStatuses.some(x=>x!==0))throw new Error('Nonzero compiler stage: '+name);
  if(!stage.quitStatuses.length||stage.quitErrors.some(e=>!e||e.name!=='ExitStatus'||e.status!==0))throw new Error('Unexpected compiler exit exception: '+name);
  return module;
 };
}
const driverRequire=name=>{if(name.startsWith(dist+'/')&&name.endsWith('.js')){const tool=path.basename(name,'.js');if(!factories[tool])throw new Error('Unknown tool');return factories[tool];}return toolRequire(name);};
const driverContext=vm.createContext({require:driverRequire,process:processStub(),console:captureConsole,Buffer,__dirname:virtualRoot,__filename:virtualRoot+'/wasm-compile-driver.cjs',setTimeout,clearTimeout});
(async()=>{
 try{
  await new vm.Script(driver.toString('utf8'),{filename:virtualRoot+'/wasm-compile-driver.cjs'}).runInContext(driverContext,{timeout:2000});
  if(stages.length!==4||stages.map(x=>x.tool).join(',')!=='cc1,sdcc,sdas8051,sdld')throw new Error('Incomplete pipeline');
  const map=Buffer.from(modules.sdld.FS.readFile('/work/out.map')),ihx=Buffer.from(modules.sdld.FS.readFile('/work/out.ihx'));
  const mapLines=map.toString('utf8').split(/\r?\n/),start=mapLines.findIndex(l=>/^Libraries Linked\b/.test(l.trim()));
  if(start<0)throw new Error('Actual map has no Libraries Linked table');
  const tail=mapLines.slice(start);
  if(tail.length>200)throw new Error('Library map table unexpectedly large');
  report.result='pipeline-completed-map-captured';
  report.stages=stages;
  report.memoryOutputs=[...outputs].map(([p,b])=>({path:p,bytes:b.length,sha256:hash(b)}));
  report.linkerScript={bytes:modules.sdld.FS.readFile('/work/test.lk').length,sha256:hash(Buffer.from(modules.sdld.FS.readFile('/work/test.lk'))),lines:Buffer.from(modules.sdld.FS.readFile('/work/test.lk')).toString('utf8').trimEnd().split('\n')};
  report.map={path:'/work/out.map',bytes:map.length,sha256:hash(map),libraryTableStartLine:start+1,libraryTableTailLines:tail};
  report.ihx={bytes:ihx.length,sha256:hash(ihx)};
  report.diagnosticCount=diagnostics.length;
  report.errorDiagnostics=diagnostics.filter(d=>d.kind==='error').map(d=>d.text).slice(0,12);
 }catch(error){report.result='failed';report.error={name:error.name,message:error.message,stack:String(error.stack).split('\n').slice(0,7)};report.stages=stages;report.diagnosticCount=diagnostics.length;report.errorDiagnostics=diagnostics.filter(d=>/Pipeline failed|FATAL|error|Error|abort|failed/i.test(d.text)).map(d=>d.text.slice(0,500)).slice(-12);}
 report.memoryOutputs=[...outputs].map(([p,b])=>({path:p,bytes:b.length,sha256:hash(b)}));report.errorDiagnostics=diagnostics.filter(d=>d.kind==='error').map(d=>d.text.slice(0,500)).slice(-20);report.finishedAtUtc=new Date().toISOString();
 console.log(JSON.stringify(report));
})().catch(error=>{console.log(JSON.stringify({result:'harness-failed',message:error.message}));process.exitCode=1;});
