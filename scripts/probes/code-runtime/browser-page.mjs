// Runs inside a real browser page. This is a probe host, not Brickwright UI.
const fixtureBudgetMs=5000;
const startupBudgetMs=30000;
const median=xs=>[...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)];
function validate(fixture,result){
  if(result.adapterError||result.timeout)return {pass:false,reason:result.adapterError||'fixture deadline exceeded'};
  if(fixture.errorIncludes){const text=(result.error?.message||'')+'\n'+(result.stderr||'');return {pass:fixture.errorIncludes.every(s=>text.includes(s)),reason:result.error?'expected guest error':'missing expected guest error'};}
  if(result.error)return {pass:false,reason:result.error.message};
  const stdout=result.stdout.replace(/\r\n/g,'\n');
  const pass=(fixture.stdout===undefined||stdout===fixture.stdout)&&(!fixture.stdoutIncludes||fixture.stdoutIncludes.every(s=>stdout.includes(s)))&&(fixture.hostCalls===undefined||result.hostCalls===fixture.hostCalls);
  return {pass,reason:pass?'output matched':'output/host-call count mismatch'};
}
class Session{
  constructor(engine){
    this.inputBuffer=globalThis.crossOriginIsolated&&typeof SharedArrayBuffer==='function'?new SharedArrayBuffer(4104):null;
    this.interruptBuffer=this.inputBuffer?new SharedArrayBuffer(1):null;
    this.startedAt=performance.now();
    this.worker=new Worker(new URL('./engine-worker.mjs',import.meta.url),{type:'module'});
    this.worker.onmessage=event=>this.receive(event.data);
    this.worker.onerror=event=>{event.preventDefault();this.fail(event.message||'worker error');};
    this.ready=new Promise(resolve=>this.readyResolve=resolve);
    this.readyTimer=setTimeout(()=>{this.fail('startup deadline exceeded');this.close();},startupBudgetMs);
    this.worker.postMessage({type:'init',engine,inputBuffer:this.inputBuffer,interruptBuffer:this.interruptBuffer});
  }
  fail(message){
    if(this.readyResolve){clearTimeout(this.readyTimer);this.readyResolve({error:message});this.readyResolve=null;}
    if(this.pending){clearTimeout(this.pending.timer);this.pending.resolve({adapterError:message});this.pending=null;}
  }
  receive(message){
    if(message.type==='ready'){clearTimeout(this.readyTimer);this.readyResolve?.({...message,workerStartToReadyMs:performance.now()-this.startedAt});this.readyResolve=null;return;}
    if(message.type==='init-error'){this.fail(message.message);return;}
    const pending=this.pending;
    if(!pending||message.id!==pending.id){if(this.closed)this.afterCloseMessages=(this.afterCloseMessages||0)+1;return;}
    if(message.type==='started'){pending.onStarted?.();return;}
    if(message.type==='output'){pending.events.push({stream:message.stream,chars:message.text.length,atMs:performance.now()-pending.sentAt});return;}
    if(message.type==='input'){
      pending.inputEvents.push({mode:message.mode,prompt:message.prompt,atMs:performance.now()-pending.sentAt});
      setTimeout(()=>{
        if(this.closed)return;
        const answer='Ada';
        if(message.mode==='shared'){
          const data=new TextEncoder().encode(answer);new Uint8Array(this.inputBuffer,8,data.length).set(data);
          const state=new Int32Array(this.inputBuffer,0,2);Atomics.store(state,1,data.length);Atomics.store(state,0,1);Atomics.notify(state,0);
        }else this.worker.postMessage({type:'input-reply',key:message.key,value:answer});
      },40);return;
    }
    if(message.type==='complete'||message.type==='adapter-error'){
      clearTimeout(pending.timer);this.pending=null;
      pending.resolve({...message,adapterError:message.type==='adapter-error'?message.message:null,wallMs:performance.now()-pending.sentAt,outputEvents:pending.events,inputEvents:pending.inputEvents});
    }
  }
  run(fixture,{inputMode='buffered',budgetMs=fixtureBudgetMs,onStarted=null}={}){
    if(this.pending||this.closed)throw new Error('session unavailable');
    const id=`${fixture.id}:${Math.random().toString(36).slice(2)}`;
    return new Promise(resolve=>{
      const pending={id,resolve,sentAt:performance.now(),events:[],inputEvents:[],onStarted};this.pending=pending;
      pending.timer=setTimeout(()=>{this.pending=null;resolve({timeout:true,wallMs:performance.now()-pending.sentAt,outputEvents:pending.events,inputEvents:pending.inputEvents});this.close();},budgetMs);
      this.worker.postMessage({type:'run',id,code:fixture.code,inputs:fixture.inputs||[],inputMode});
    });
  }
  close(){
    if(this.closed)return this.terminateCallMs;
    this.closed=true;clearTimeout(this.readyTimer);
    if(this.pending){clearTimeout(this.pending.timer);this.pending.resolve({terminated:true,outputEvents:this.pending.events,inputEvents:this.pending.inputEvents});this.pending=null;}
    const start=performance.now();this.worker.terminate();this.terminateCallMs=performance.now()-start;
    return this.terminateCallMs;
  }
}
export async function runProbe({engines,fixtures,mode}){
  const report={capabilities:{isSecureContext,crossOriginIsolated,sharedArrayBuffer:typeof SharedArrayBuffer==='function',wasm:typeof WebAssembly==='object',jspi:typeof WebAssembly.Suspending==='function',userAgent:navigator.userAgent},mode,engines:{}};
  const hello={id:'hello',code:'print(42)\n',stdout:'42\n'};
  const input={id:'live_input',code:"print('before')\nname=input('Name? ')\nprint('hello '+name)\n",stdoutIncludes:['before\n','hello Ada\n']};
  for(const engine of engines){
    const result={startup:[],fixtures:[],performance:[],interaction:{}};report.engines[engine]=result;
    let session;
    const fresh=async()=>{const s=new Session(engine);const ready=await s.ready;return {s,ready};};
    for(let n=0;n<(mode==='isolated-input'?1:3);n++){
      const {s,ready}=await fresh();
      if(ready.error){result.startup.push(ready);s.close();break;}
      const observed=await s.run(hello);result.startup.push({...ready,firstRun:observed,validation:validate(hello,observed)});
      if(n===(mode==='isolated-input'?0:2))session=s;else s.close();
    }
    if(!session)continue;
    if(mode==='isolated-input'){
      const observed=await session.run(input,{inputMode:'shared'});result.interaction.sharedInput={...observed,validation:validate(input,observed)};
      session.close();continue;
    }
    for(const fixture of fixtures.filter(f=>f.category!=='performance')){
      const observed=await session.run(fixture);result.fixtures.push({...observed,runId:observed.id,id:fixture.id,category:fixture.category,validation:validate(fixture,observed)});
      if(observed.timeout||observed.adapterError){session.close();const next=await fresh();session=next.s;if(next.ready.error){result.restartError=next.ready;break;}}
    }
    if(!result.restartError){
      for(const fixture of fixtures.filter(f=>f.category==='performance')){
        const samples=[];
        for(let n=0;n<5;n++){const observed=await session.run(fixture);samples.push({...observed,validation:validate(fixture,observed)});if(observed.timeout||observed.adapterError)break;}
        result.performance.push({id:fixture.id,samples,medianEngineMs:samples.every(s=>s.validation.pass)?median(samples.map(s=>s.engineMs)):null});
      }
      if(engine==='skulpt'){
        const observed=await session.run(input,{inputMode:'message'});result.interaction.messageInput={...observed,validation:validate(input,observed)};
      }else{
        const fixture={id:'async_ask',code:"import probehost\nprint('before')\nname=await probehost.ask('Name? ')\nprint('hello '+name)\n",stdoutIncludes:['before\n','hello Ada\n'],hostCalls:1};
        const observed=await session.run(fixture,{inputMode:'message'});result.interaction.explicitAsyncAsk={...observed,validation:validate(fixture,observed),scope:'explicit top-level await API, not transparent input() compatibility'};
      }
      if(engine==='micropython'){
        const fixture={id:'stdin_stream',code:"import sys\nprint('before')\nname=sys.stdin.readline()\nprint('hello '+name.strip())\n",inputs:['Ada'],stdoutIncludes:['before\n','hello Ada\n']};
        const observed=await session.run(fixture);result.interaction.stdinStream={...observed,validation:validate(fixture,observed),scope:'filesystem stdin path, distinct from built-in input()'};
      }
    }
    session.close();
    const stopper=await fresh();
    if(!stopper.ready.error){
      let stopPromise;let heartbeats=0;const heartbeat=setInterval(()=>heartbeats++,10);
      const observed=await stopper.s.run({id:'infinite_loop',code:'while True:\n    pass\n'},{budgetMs:3000,onStarted:()=>{stopPromise=new Promise(resolve=>setTimeout(()=>{const terminateCallMs=stopper.s.close();setTimeout(()=>resolve({terminateCallMs,afterCloseMessages:stopper.s.afterCloseMessages||0}),200);},200));}});
      const stopped=stopPromise?await stopPromise:{};clearInterval(heartbeat);
      result.interaction.hardStop={...observed,...stopped,parentHeartbeats:heartbeats,method:'browser Worker.terminate() returns void; measured API call time is NOT confirmed termination latency; observed 200 ms quiet window'};
    }else result.interaction.hardStop=stopper.ready;
    stopper.s.close();
    const recovery=await fresh();
    if(!recovery.ready.error){const observed=await recovery.s.run(hello);result.interaction.restartAfterStop={...observed,validation:validate(hello,observed)};}else result.interaction.restartAfterStop=recovery.ready;
    recovery.s.close();
    const startups=result.startup.filter(s=>!s.error);
    result.summary={medianLoadMs:median(startups.map(s=>s.engineLoadMs)),medianWorkerReadyMs:median(startups.map(s=>s.workerStartToReadyMs)),fixtureCategories:Object.fromEntries([...new Set(result.fixtures.map(f=>f.category))].map(category=>[category,{passed:result.fixtures.filter(f=>f.category===category&&f.validation.pass).length,total:result.fixtures.filter(f=>f.category===category).length}]))};
  }
  return report;
}
