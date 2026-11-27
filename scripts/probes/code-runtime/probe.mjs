// Explicitly gated local probe. Run only after the plan commit has been pushed.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {gzipSync,brotliCompressSync} from 'node:zlib';
import {Worker} from 'node:worker_threads';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const args=Object.fromEntries(process.argv.slice(2).map(arg=>{const p=arg.replace(/^--/,'').indexOf('=');const s=arg.replace(/^--/,'');return p<0?[s,true]:[s.slice(0,p),s.slice(p+1)];}));
if(!/^[0-9a-f]{40}$/.test(args['plan-commit']||'')) {
  throw new Error('No runtime execution allowed until initial plan publication is confirmed. Pass --plan-commit=<pushed 40-character SHA>.');
}
const engines=(args.engines||'skulpt,micropython,pyodide').split(',');
if(engines.some(e=>!['skulpt','micropython','pyodide'].includes(e))) throw new Error('unknown engine');
const coldSamples=3;
const repeats=5;
const fixtureBudgetMs=5000;
const startupBudgetMs=30000;
const fixtures=JSON.parse(await fs.readFile(path.join(root,'fixtures.json'),'utf8'));
const pins={skulpt:'1.2.0',micropython:'1.29.0-6',pyodide:'314.0.8'};
const assetPaths={
  skulpt:['node_modules/skulpt/dist/skulpt.min.js','node_modules/skulpt/dist/skulpt-stdlib.js'],
  micropython:['node_modules/@micropython/micropython-webassembly-pyscript/micropython.mjs','node_modules/@micropython/micropython-webassembly-pyscript/micropython.wasm'],
  pyodide:['node_modules/pyodide/pyodide.mjs','node_modules/pyodide/pyodide.asm.mjs','node_modules/pyodide/pyodide.asm.wasm','node_modules/pyodide/python_stdlib.zip','node_modules/pyodide/pyodide-lock.json']
};
const median=xs=>{const a=[...xs].sort((a,b)=>a-b);return a[Math.floor(a.length/2)];};
const round=n=>Math.round(n*100)/100;
function validate(fixture,result) {
  if(result.adapterError||result.timeout) return {pass:false,reason:result.adapterError||'fixture deadline exceeded'};
  if(fixture.errorIncludes) {
    const text=(result.error?.message||'')+'\n'+(result.stderr||'');
    return {pass:fixture.errorIncludes.every(s=>text.includes(s)),reason:result.error?'expected guest error':'missing expected guest error'};
  }
  if(result.error) return {pass:false,reason:result.error.message};
  const stdout=result.stdout.replace(/\r\n/g,'\n');
  const pass=(fixture.stdout===undefined||stdout===fixture.stdout)&&
    (!fixture.stdoutIncludes||fixture.stdoutIncludes.every(s=>stdout.includes(s)))&&
    (fixture.hostCalls===undefined||result.hostCalls===fixture.hostCalls);
  return {pass,reason:pass?'output matched':'output/host-call count mismatch'};
}

class Session {
  constructor(engine) {
    this.engine=engine;
    this.inputBuffer=new SharedArrayBuffer(4104);
    this.interruptBuffer=new SharedArrayBuffer(1);
    this.startedAt=performance.now();
    this.worker=new Worker(new URL('./engine-worker.mjs',import.meta.url),{workerData:{engine,inputBuffer:this.inputBuffer,interruptBuffer:this.interruptBuffer},stdout:true,stderr:true});
    this.logs={stdout:'',stderr:''};
    for(const stream of ['stdout','stderr']) this.worker[stream].on('data',chunk=>{if(this.logs[stream].length<16000)this.logs[stream]+=String(chunk).slice(0,16000-this.logs[stream].length);});
    this.worker.on('error',error=>this.fail(String(error.stack||error)));
    this.worker.on('exit',code=>{this.exited=true;if(this.pending&&!this.stopping)this.fail(`worker exited ${code}`);});
    this.worker.on('message',message=>this.receive(message));
    this.ready=new Promise(resolve=>{this.readyResolve=resolve;});
    this.readyTimer=setTimeout(()=>{this.readyResolve({error:'startup deadline exceeded',logs:this.logs});this.close();},startupBudgetMs);
  }
  fail(message) {
    if(this.readyResolve){clearTimeout(this.readyTimer);this.readyResolve({error:message,logs:this.logs});this.readyResolve=null;}
    if(this.pending){clearTimeout(this.pending.timer);this.pending.resolve({adapterError:message,logs:this.logs});this.pending=null;}
  }
  receive(message) {
    if(message.type==='ready') {
      clearTimeout(this.readyTimer);
      this.readyResolve?.({...message,workerStartToReadyMs:performance.now()-this.startedAt,logs:this.logs});this.readyResolve=null;return;
    }
    if(message.type==='init-error') {this.fail(message.message);return;}
    const pending=this.pending;
    if(!pending||message.id!==pending.id)return;
    if(message.type==='started'){pending.startedAt=performance.now();pending.onStarted?.();return;}
    if(message.type==='output') {
      pending.events.push({stream:message.stream,chars:message.text.length,atMs:performance.now()-pending.sentAt});return;
    }
    if(message.type==='input') {
      pending.inputEvents.push({mode:message.mode,prompt:message.prompt,atMs:performance.now()-pending.sentAt});
      setTimeout(()=>{
        const answer=pending.liveAnswers.shift()??'Ada';
        if(message.mode==='shared'){
          const data=new TextEncoder().encode(answer);if(data.length>4096)throw new Error('input over budget');
          new Uint8Array(this.inputBuffer,8,data.length).set(data);
          const state=new Int32Array(this.inputBuffer,0,2);Atomics.store(state,1,data.length);Atomics.store(state,0,1);Atomics.notify(state,0);
        }else this.worker.postMessage({type:'input-reply',key:message.key,value:answer});
      },40);return;
    }
    if(message.type==='complete'||message.type==='adapter-error') {
      clearTimeout(pending.timer);this.pending=null;
      pending.resolve({...message,adapterError:message.type==='adapter-error'?message.message:null,
        wallMs:performance.now()-pending.sentAt,outputEvents:pending.events,inputEvents:pending.inputEvents});
    }
  }
  run(fixture,{budgetMs=fixtureBudgetMs,inputMode='buffered',onStarted=null}={}) {
    if(this.pending)throw new Error('only one run per session');
    const id=`${fixture.id}:${Math.random().toString(36).slice(2)}`;
    return new Promise(resolve=>{
      const pending={id,resolve,sentAt:performance.now(),events:[],inputEvents:[],liveAnswers:['Ada'],onStarted};
      this.pending=pending;
      pending.timer=setTimeout(()=>{this.pending=null;resolve({timeout:true,wallMs:performance.now()-pending.sentAt,outputEvents:pending.events,inputEvents:pending.inputEvents});this.close();},budgetMs);
      this.worker.postMessage({type:'run',id,code:fixture.code,inputs:fixture.inputs||[],inputMode});
    });
  }
  async close(){
    if(this.closePromise)return this.closePromise;
    this.stopping=true;clearTimeout(this.readyTimer);
    if(this.pending){clearTimeout(this.pending.timer);this.pending.resolve({terminated:true,outputEvents:this.pending.events,inputEvents:this.pending.inputEvents});this.pending=null;}
    this.closePromise=this.exited?Promise.resolve():this.worker.terminate();
    return this.closePromise;
  }
}

const report={schema:1,createdAt:new Date().toISOString(),planCommit:args['plan-commit'],brickwrightHead:args['brickwright-head']||'14de1c42bd2e2ea84086a2162d1eff1fdbbac20d',
  environment:{kind:'Node worker_threads; local installed assets',node:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch,cpus:os.cpus().length,cpuModel:os.cpus()[0]?.model,totalHostMemory:os.totalmem()},
  protocol:{coldSamples,warmRepeats:repeats,startupBudgetMs,fixtureBudgetMs,hardStopDelayMs:200,outputBudgetBytes:1024*1024,
    coldMeaning:'fresh worker/runtime with already-installed local assets; OS caches and process caches may be warm; no network/download timing',
    sizesMeaning:'sum of specified runtime asset bytes and independent gzip/brotli compression; excludes application integration, optional packages and network headers',
    memoryMeaning:'Node worker thread counters plus process-wide RSS; diagnostic only, not a browser peak-memory ranking',
    inputMeaning:'buffered input plus separate Node SharedArrayBuffer/Atomics.wait diagnostic; this is not proof of browser/WebView input portability',
    bridgeMeaning:'mock arithmetic/sensor, delay and explicit async ask callbacks only; no actual simulator/VM/hardware integration tested'},
  coverage:{node:'running',browser:'separate browser-probe.mjs report; do not infer from Node',windows:'pending',macos:'pending',linuxWebView:'pending',android:'pending',ios:'pending',offlineBrowser:'pending',stateIsolation:'pending',outputCapEnforcement:'pending',inputCancellation:'pending',generatedPrograms:'pending',realSimulatorBridge:'pending',gracefulInterrupt:'pending; hard termination only'},
  sourceHashes:{},engines:{}};
for(const file of ['package-lock.json','fixtures.json','engine-worker.mjs','probe.mjs'])report.sourceHashes[file]=crypto.createHash('sha256').update(await fs.readFile(path.join(root,file))).digest('hex');
for(const engine of engines) {
  const result={version:pins[engine],assets:[],startup:[],fixtures:[],performance:[],interaction:{}};
  report.engines[engine]=result;
  for(const relative of assetPaths[engine]) {
    const data=await fs.readFile(path.join(root,relative));
    result.assets.push({path:relative,bytes:data.length,gzipBytes:gzipSync(data,{level:9}).length,brotliBytes:brotliCompressSync(data).length,sha256:crypto.createHash('sha256').update(data).digest('hex')});
  }
  result.assetTotals=Object.fromEntries(['bytes','gzipBytes','brotliBytes'].map(k=>[k,result.assets.reduce((sum,a)=>sum+a[k],0)]));
  let session;
  for(let n=0;n<coldSamples;n++){
    const candidate=new Session(engine);const ready=await candidate.ready;
    if(ready.error){result.startup.push(ready);await candidate.close();break;}
    const hello={id:'hello',code:'print(42)\n',stdout:'42\n'};
    const first=await candidate.run(hello);result.startup.push({...ready,firstRun:first,validation:validate(hello,first)});
    if(n===coldSamples-1)session=candidate;else await candidate.close();
  }
  if(!session){console.log(`${engine}: initialization failed; see report`);continue;}
  for(const fixture of fixtures){
    if(fixture.category==='performance')continue;
    const observed=await session.run(fixture);result.fixtures.push({...observed,runId:observed.id,id:fixture.id,category:fixture.category,validation:validate(fixture,observed)});
    if(observed.timeout||observed.adapterError){await session.close();session=new Session(engine);const ready=await session.ready;if(ready.error){result.restartError=ready;break;}}
  }
  if(!result.restartError){
    for(const fixture of fixtures.filter(f=>f.category==='performance')){
      const samples=[];
      for(let n=0;n<repeats;n++) {const observed=await session.run(fixture);samples.push({...observed,validation:validate(fixture,observed)});if(observed.timeout||observed.adapterError)break;}
      result.performance.push({id:fixture.id,samples,medianEngineMs:samples.every(s=>s.validation.pass)?median(samples.map(s=>s.engineMs)):null});
    }
    const inputFixture={id:'live_input',code:"print('before')\nname = input('Name? ')\nprint('hello '+name)\n",stdoutIncludes:['before\n','hello Ada\n']};
    const live=await session.run(inputFixture,{inputMode:'shared'});result.interaction.sharedInput={...live,validation:validate(inputFixture,live)};
    if(engine==='skulpt') {const liveMessage=await session.run(inputFixture,{inputMode:'message'});result.interaction.messageInput={...liveMessage,validation:validate(inputFixture,liveMessage)};}
    else result.interaction.messageInput={status:'not implemented by this probe; synchronous stdin requires separate suspension strategy without SharedArrayBuffer'};
    if(live.timeout||live.adapterError){await session.close();session=new Session(engine);await session.ready;}
    if(engine==='micropython'){
      const fixture={id:'stdin_stream',code:"import sys\nprint('before')\nname = sys.stdin.readline()\nprint('hello '+name.strip())\n",inputs:['Ada'],stdoutIncludes:['before\n','hello Ada\n']};
      const observed=await session.run(fixture);result.interaction.stdinStream={...observed,validation:validate(fixture,observed),scope:'sys.stdin.readline filesystem path, distinct from built-in input()'};
      if(observed.timeout||observed.adapterError){await session.close();session=new Session(engine);await session.ready;}
    }
    if(engine!=='skulpt'){
      const fixture={id:'async_ask',code:"import probehost\nprint('before')\nname = await probehost.ask('Name? ')\nprint('hello '+name)\n",stdoutIncludes:['before\n','hello Ada\n'],hostCalls:1};
      const observed=await session.run(fixture,{inputMode:'message'});result.interaction.explicitAsyncAsk={...observed,validation:validate(fixture,observed),scope:'explicit top-level await host API, not transparent built-in input() compatibility'};
    }
  }
  await session.close();
  const stopper=new Session(engine);const stopperReady=await stopper.ready;
  if(!stopperReady.error){
    let stopPromise;let heartbeats=0;
    const heartbeat=setInterval(()=>heartbeats++,10);
    const run=stopper.run({id:'infinite_loop',code:'while True:\n    pass\n'},{budgetMs:3000,onStarted:()=>{stopPromise=new Promise(resolve=>setTimeout(async()=>{const requestedAt=performance.now();await stopper.close();resolve(performance.now()-requestedAt);},200));}});
    const observed=await run;
    const terminationLatencyMs=stopPromise?await stopPromise:null;
    clearInterval(heartbeat);
    result.interaction.hardStop={...observed,terminationLatencyMs,parentHeartbeats:heartbeats,method:'elapsed awaiting Node worker.terminate promise; runtime discarded'};
    await stopper.close();
  }else result.interaction.hardStop=stopperReady;
  const recovery=new Session(engine);const recoveryReady=await recovery.ready;
  if(!recoveryReady.error){const fixture={id:'restart_after_stop',code:'print(42)\n',stdout:'42\n'};const observed=await recovery.run(fixture);result.interaction.restartAfterStop={...observed,validation:validate(fixture,observed)};}
  else result.interaction.restartAfterStop=recoveryReady;
  await recovery.close();
  const startups=result.startup.filter(s=>!s.error);
  result.summary={medianLoadMs:median(startups.map(s=>s.engineLoadMs)),medianWorkerReadyMs:median(startups.map(s=>s.workerStartToReadyMs)),
    fixtureCategories:Object.fromEntries([...new Set(result.fixtures.map(f=>f.category))].map(category=>[category,{passed:result.fixtures.filter(f=>f.category===category&&f.validation.pass).length,total:result.fixtures.filter(f=>f.category===category).length}]))};
  console.log(`${engine}: local engine load median ${round(result.summary.medianLoadMs)} ms; diagnostic categories recorded separately`);
}
report.coverage.node='completed within stated probe scope';
const output=path.resolve(root,args.output||'results.json');
await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(`Saved ${output}`);
