// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 CrispStrobe
import {assertReviewedConcurrency, modelWorkflowBeforeConcurrencyPolicy} from './helpers/reviewed-concurrency-projections.mjs';
import {assertHeldLegacyConcurrency, modelWorkflowBeforeHeldLegacyConcurrency, asHeldLegacyPredecessor} from './helpers/held-legacy-concurrency.mjs';
import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {validateSubmission,LIMITS} from '../tools/model-api/lib/protocol.mjs';import {authenticate,sha256,ownerTag,seal,open,signJob,readJob} from '../tools/model-api/lib/crypto.mjs';import {createGateway} from '../tools/model-api/lib/gateway.mjs';import {applyCors} from '../tools/model-api/lib/http.mjs';import {githubBackend} from '../tools/model-api/lib/github.mjs';
const master=Buffer.alloc(32,7),token='x'.repeat(43),other='y'.repeat(43),tokens=[{id:'a',sha256:sha256(token)},{id:'b',sha256:sha256(other)}],model={name:'model.ldr',text:'0 model\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat\n'},input={model},authorization='Bearer '+token;

import {createAdmission,initialAdmissionDocument} from '../tools/model-api/lib/admission.mjs';
import {gitBlobSha} from '../tools/model-api/lib/github-admission-store.mjs';
import {dispatchTag} from '../tools/model-api/lib/job-identity.mjs';
const workerMeta={repository:'owner/worker',workflow:'model-measurements.yml',workerRevision:'a'.repeat(40)};
const admission=()=>{const policy={epoch:'protocol-fixture-epoch',...workerMeta};delete policy.workerRevision;let bytes=initialAdmissionDocument({master,...policy});return createAdmission({master,...policy,store:{async read(){return{sha:gitBlobSha(bytes),bytes:Buffer.from(bytes)};},async write(sha,next){if(sha!==gitBlobSha(bytes))return false;bytes=Buffer.from(next);return true;}}});};
test('typed file, time and measurement limits reject executable or oversized submissions',()=>{
 assert.equal(validateSubmission(input).model.name,'model.ldr');for(const v of [{model:{...model,name:'../x.ldr'}},{model:{...model,name:'x.js'}},{model:{...model,text:'x'.repeat(LIMITS.modelBytes+1)}},{...input,ref:'attacker'},{...input,settings:{programMs:LIMITS.programMs+1}},{...input,measurements:[{id:'x',kind:'torque',targets:['a']}]},{...input,program:{name:'x.bw',text:'DEVICE SPIKE\nIMPORT "https://example.com/evil.js"'}},{...input,program:{name:'x.bw',text:'DEVICE SPIKE\nWHEN flag clicked:\n  lab reset'}}])assert.throws(()=>validateSubmission(v));
});
test('physics-step capture has explicit short-run, reading and pose budgets without changing VM cadence',()=>{
 const v=validateSubmission({...input,settings:{physicsSamples:true,programMs:12000,poseParts:['frame','gate','ball-a','ball-b']}});assert.equal(v.settings.sampleMs,5);assert.equal(v.settings.physicsSamples,true);
 for(const settings of [{physicsSamples:true,programMs:15000},{physicsSamples:true,sampleMs:25},{physicsSamples:'true'},{poseParts:['a','b','c','d','e']},{poseParts:['a','a']}])assert.throws(()=>validateSubmission({...input,settings}));
 assert.throws(()=>validateSubmission({...input,settings:{physicsSamples:true},measurements:Array.from({length:25},(_,i)=>({id:'r'+i,kind:'hingeGap'}))}));
});
test('tokens, authenticated encryption, ownership and expiry fail closed',()=>{
 assert.equal(authenticate(authorization,tokens),'a');assert.throws(()=>authenticate('Bearer '+other,[tokens[0]]));assert.throws(()=>authenticate(undefined,tokens));
 const e=seal(master,'request:id',{data:'hello'});assert.deepEqual(open(master,'request:id',e),{data:'hello'});assert.throws(()=>open(master,'request:other',e));const b=Buffer.from(e,'base64url');b[b.length-1]^=1;assert.throws(()=>open(master,'request:id',b.toString('base64url')));
 const tag=ownerTag(master,'a'),job={id:'11111111-1111-4111-8111-111111111111',owner:tag,createdAt:100000,runId:12},id=signJob(master,job);assert.deepEqual(readJob(master,id,tag,100001),job);assert.throws(()=>readJob(master,id,ownerTag(master,'b'),100001));assert.throws(()=>readJob(master,id,tag,100000+86400001));assert.throws(()=>readJob(master,id+'x',tag,100001));
});
test('a data-only submission yields an owned job; unauthorized, altered and foreign jobs cannot dispatch or read results',async()=>{
 let submitted,seen=0;const backend={...workerMeta,submit:async(j,e)=>{seen++;submitted={j,e};return 42;},status:async()=>({status:'completed'}),result:async j=>seal(master,'result:'+j.id,{requestId:j.id,owner:j.owner,nonce:j.nonce,createdAt:j.createdAt,inputSha256:j.inputSha256,repository:j.repository,workflow:j.workflow,workerRevision:j.workerRevision,correlation:j.correlation,report:{status:'completed',samples:[1]}})},api=createGateway({tokens,master,backend,admission:admission(),now:()=>100000});
 assert.equal((await api({method:'POST',path:'/v1/runs',body:input})).status,401);assert.equal(seen,0);
 assert.equal((await api({method:'POST',path:'/v1/runs',authorization,body:{...input,workflow:'arbitrary'}})).status,422);assert.equal(seen,0);
 const response=await api({method:'POST',path:'/v1/runs',authorization,body:input});assert.equal(response.status,202);assert.equal(seen,1);const payload=open(master,'request:'+submitted.j.id,submitted.e);assert.equal(payload.submission.model.text,model.text);assert.equal(payload.owner,ownerTag(master,'a'));
 const path='/v1/runs/'+response.body.id;assert.equal((await api({method:'GET',path,authorization:'Bearer '+other})).status,404);assert.equal((await api({method:'GET',path:path+'/result',authorization})).body.status,'completed');assert.equal((await api({method:'GET',path:path+'x',authorization})).status,404);
});
test('worker failures never become fabricated measurements or successful qualification',async()=>{
 let called=0;const backend={...workerMeta,status:async()=>({status:'queued'}),submit:async()=>{called++;throw Error('secret credential must not escape');}},api=createGateway({tokens,master,backend,admission:admission()});const r=await api({method:'POST',path:'/v1/runs',authorization,body:input});assert.equal(r.status,503);assert.ok(!JSON.stringify(r).includes('secret credential'));assert.equal(called,1,'the authenticated dispatch error path really ran');
});
test('GitHub backend accepts 200 and legacy 204 dispatch without caller-selected code or refs',async()=>{
 for(const status of [200,204]){
  const calls=[],j={id:'11111111-1111-4111-8111-111111111111',owner:ownerTag(master,'a'),nonce:'b'.repeat(32),createdAt:Date.now(),runId:null,...workerMeta};j.correlation=dispatchTag(master,j);
  const backend=githubBackend({...workerMeta,ref:'trusted',token:'private-server-token',master,fetchImpl:async(url,options)=>{calls.push({url,options});if(url.includes('/git/ref/tags/'))return Response.json({ref:'refs/tags/trusted',object:{type:'commit',sha:workerMeta.workerRevision}});if(url.includes('/git/ref/heads/'))return new Response(null,{status:404});return status===204?new Response(null,{status:204}):Response.json({workflow_run_id:123});}});
  const id=await backend.submit(j,'encrypted');assert.equal(id,status===200?123:null);const dispatch=calls.find(c=>c.options.method==='POST'),body=JSON.parse(dispatch.options.body);assert.equal(body.ref,'trusted');assert.deepEqual(Object.keys(body.inputs).sort(),['envelope','request_id','request_tag']);assert.equal(body.inputs.request_tag,j.correlation);assert.ok(dispatch.url.endsWith('/actions/workflows/model-measurements.yml/dispatches'));
 }
});
test('an initializing GitHub run stays queued until its exact request name is visible',async()=>{
 const job={id:'11111111-1111-4111-8111-111111111111',owner:ownerTag(master,'a'),nonce:'b'.repeat(32),createdAt:Date.now(),runId:123,...workerMeta};job.correlation=dispatchTag(master,job);
 const run={event:'workflow_dispatch',path:'.github/workflows/model-measurements.yml',display_title:'Submitted model measurements',status:'queued',id:123,head_sha:workerMeta.workerRevision,repository:{full_name:workerMeta.repository},head_repository:{full_name:workerMeta.repository}};
 const backend=githubBackend({...workerMeta,ref:'trusted',token:'server-only',master,fetchImpl:async()=>Response.json(run)});
 assert.deepEqual(await backend.status(job),{status:'queued'});
 run.display_title='model-measure:'+job.id+':'+job.correlation;assert.equal((await backend.status(job)).runId,123);
 run.display_title='another-request';await assert.rejects(()=>backend.status(job),e=>e.status===404);
 run.display_title='Submitted model measurements';run.status='completed';await assert.rejects(()=>backend.status(job),e=>e.status===404);
 run.status='queued';run.path='.github/workflows/other.yml';await assert.rejects(()=>backend.status(job),e=>e.status===404);
});
test('hosted worker has no credential/network channel and preserves failures as encrypted artifacts',()=>{
 const s=readFileSync(new URL('../.github/workflows/model-measurements.yml',import.meta.url),'utf8'),run=s.slice(s.indexOf('      - name: Run bounded'),s.indexOf('      - name: Encrypt'));
 assert.match(run,/--network=none/);assert.match(run,/--read-only/);assert.match(run,/--pids-limit=128/);assert.match(run,/--memory=2g/);assert.match(run,/timeout --signal=TERM/);assert.match(run,/node@sha256:[a-f0-9]{64}/);assert.ok(!/secrets\.|GITHUB_TOKEN|MODEL_API_MASTER_KEY/.test(run));assert.match(s,/persist-credentials: false/);assert.match(s,/retention-days: 1/);assertHeldLegacyConcurrency(asHeldLegacyPredecessor(s));assertReviewedConcurrency(asHeldLegacyPredecessor(s), {profile: 'workflow-ref'});assertReviewedConcurrency(asHeldLegacyPredecessor(s), {automaticOnly: true});assertReviewedConcurrency(s);assert.ok(!s.includes('${{ inputs.envelope }}'),'payload is read from event data, never expanded into shell code');
});

test('a Pages client receives only explicitly allowed CORS origins',()=>{
 const headers={},res={setHeader:(k,v)=>headers[k]=v,end:()=>{res.ended=true;}};
 assert.equal(applyCors({method:'OPTIONS',headers:{origin:'https://crispstrobe.github.io'}},res,['https://crispstrobe.github.io']),true);assert.equal(res.statusCode,204);assert.equal(headers['Access-Control-Allow-Origin'],'https://crispstrobe.github.io');assert.throws(()=>applyCors({method:'OPTIONS',headers:{origin:'https://other.invalid'}},res,['https://crispstrobe.github.io']));
});


test('duplicate token identity/hash configuration and oversized job tokens refuse',()=>{
 assert.throws(()=>authenticate(authorization,[tokens[0],{...tokens[0]}]),e=>e.status===503);
 assert.throws(()=>authenticate(authorization,[tokens[0],{id:'other',sha256:tokens[0].sha256}]),e=>e.status===503);
 assert.throws(()=>readJob(master,'x'.repeat(2049),ownerTag(master,'a')),e=>e.status===404);
});
test('production handler authenticates before body access or any private backend call',async()=>{
 const {default:handler}=await import('../tools/model-api/api/handler.mjs');const saved=process.env.MODEL_API_AGENT_TOKENS,fetchBefore=globalThis.fetch;let bodies=0,network=0;
 process.env.MODEL_API_AGENT_TOKENS=JSON.stringify(tokens);globalThis.fetch=async()=>{network++;throw Error('must not call');};
 try{const req={method:'POST',url:'/api/v1/runs',headers:{},get body(){bodies++;throw Error('must not consume');}},res={setHeader(){},end(value){this.value=JSON.parse(value);}};await handler(req,res);assert.equal(res.statusCode,401);assert.equal(bodies,0);assert.equal(network,0);}
 finally{globalThis.fetch=fetchBefore;if(saved===undefined)delete process.env.MODEL_API_AGENT_TOKENS;else process.env.MODEL_API_AGENT_TOKENS=saved;}
});

test('automatic fixed-model qualification is isolated from production dispatch and preserves exact source evidence',()=>{
 const s=readFileSync(new URL('../.github/workflows/model-measurements.yml',import.meta.url),'utf8'),q=s.slice(s.indexOf('  qualify:'));
 assert.equal(modelWorkflowBeforeHeldLegacyConcurrency(asHeldLegacyPredecessor(s)),readFileSync(new URL('../tools/model-api/worker-workflow.yml',import.meta.url),'utf8'));
 assert.equal(modelWorkflowBeforeConcurrencyPolicy(asHeldLegacyPredecessor(s)),readFileSync(new URL('../tools/model-api/worker-workflow.yml',import.meta.url),'utf8'));
 assert.match(s,/if: \$\{\{ github.event_name == 'workflow_dispatch' \}\}/);
 assert.match(q,/github.event.pull_request.head.repo.full_name == github.repository/);assert.match(q,/ref: \$\{\{ github.event.pull_request.head.sha \}\}/);
 assert.ok(!/secrets\.|pull_request_target|MODEL_API_MASTER_KEY/.test(q));
 assert.match(q,/name: model-api-encrypted-/);assert.match(q,/model-api-qualification\/result.enc/);
 assert.match(q,/qualification-prepare/);assert.match(q,/qualification-seal/);assert.match(q,/model-api-native.test.mjs/);assert.match(q,/qualification.mjs verify/);
 assert.match(q,/if: \$\{\{ always\(\) \}\}/);assert.match(q,/retention-days: 2/);
});


test('model policy projection rejects cancellation drift and preserves every worker-template byte', () => {
 const source = readFileSync(new URL('../.github/workflows/model-measurements.yml', import.meta.url), 'utf8');
 const template = readFileSync(new URL('../tools/model-api/worker-workflow.yml', import.meta.url), 'utf8');
 for (const changed of [source.replace("github.event_name == 'push'", "github.event_name == 'workflow_dispatch'"),
     source.replace("github.ref_type != 'tag'", "github.ref_type == 'tag'"), source + '\nconcurrency:\n']) {
  assert.throws(() => modelWorkflowBeforeHeldLegacyConcurrency(asHeldLegacyPredecessor(changed)));
  assert.throws(() => modelWorkflowBeforeConcurrencyPolicy(asHeldLegacyPredecessor(changed)));
 }
 assert.notEqual(modelWorkflowBeforeHeldLegacyConcurrency(asHeldLegacyPredecessor(source.replace('contents: read', 'contents: write'))), template);
 assert.notEqual(modelWorkflowBeforeConcurrencyPolicy(asHeldLegacyPredecessor(source.replace('contents: read', 'contents: write'))), template);
});
