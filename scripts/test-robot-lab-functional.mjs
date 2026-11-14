#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
// Actual source parser -> SB3 -> Scratch VM -> bundled extension -> virtual hub -> Jolt.
// Run with Node 22 and --import ./scripts/lib/register-gui-scope.mjs.
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {spawnSync, execFileSync} from 'node:child_process';
import {resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {nonFinitePaths, summarizeMotor, functionalFailures} from './lib/robot-lab-functional.mjs';
import {PROGRAM_OUTPUT_CONTRACTS, outputRules, createOutputMeasurement, observeOutput, observeTerminal, programCompletion} from './lib/robot-lab-program-completion.mjs';
import {createMotorSummary,observeMotorSummary,finishMotorSummary,createMeasurementWriter} from './lib/robot-lab-run-retention.mjs';
import {latchProgramFailures} from './lib/robot-lab-program-flags.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const runnerSha256=hashRunner();
function hashRunner(){return createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex');}
const sourceHead=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const args=Object.fromEntries(process.argv.slice(2).map(x=>{const i=x.indexOf('=');return i<0?[x.replace(/^--/,''),true]:[x.slice(0,i).replace(/^--/,''),x.slice(i+1)];}));
const hash=x=>createHash('sha256').update(x).digest('hex');
const inventory=JSON.parse(readFileSync(join(root,'docs/data/robot-lab-experimental-checkpoint.json'))).models;
const afterMs=Number(args['after-ms']||0);
if(!Number.isFinite(afterMs)||afterMs<0||afterMs>10000)throw Error('Settling observation must be between 0 and 10000 ms');
const simMs=Number(args['sim-ms']||120000), wallMs=Number(args['wall-ms']||180000);
const maxBound=args['bounded-memory']?1200000:600000;
if(!Number.isFinite(simMs)||simMs<=0||simMs>maxBound||!Number.isFinite(wallMs)||wallMs<=0||wallMs>maxBound)throw Error('Bounds must be positive and at most '+maxBound+' ms');
if(args.child){
    let stage='setup',measurementWriter=null;
    const mark=value=>{stage=value;writeFileSync(String(args.result)+'.progress.json',JSON.stringify({id:String(args.child),stage})+'\n');};
    try{
    const id=String(args.child), item=inventory.find(m=>m.id===id);if(!item)throw Error('Unknown inventory ID');
    mark('source-modules');
    const {MODELS}=await import('../overlay/scratch-gui/src/lib/bw-sim/sim-session.js');
    const {EXPERIMENTAL_MODELS}=await import('../overlay/scratch-gui/src/lib/bw-sim/model/experimental-models.js');
    const choices=[...MODELS,...EXPERIMENTAL_MODELS].filter(m=>(m.id||m.file.replace(/\.ldr$/,''))===id);
    // Entries may appear in both registries during promotion; equivalent mappings are one choice.
    const unique=[...new Map(choices.map(m=>[m.file+'\0'+m.example,m])).values()];if(unique.length!==1)throw Error(`Expected one product model/program mapping: ${id}`);
    const choice=unique[0], modelPath='overlay/scratch-gui/static/sim-lab/models/'+choice.file, programPath='overlay/scratch-gui/static/sim-lab/programs/'+choice.example;
    mark('model-source');
    const modelText=readFileSync(join(root,modelPath),'utf8'),suppliedProgram=readFileSync(join(root,programPath),'utf8');
    const probeMotors=args['probe-motors']?String(args['probe-motors']).split(','):[];
    if(probeMotors.some(p=>!/^[-a-zA-Z0-9_]+$/.test(p)))throw Error('Invalid probe motor ref');
    const program=probeMotors.length?'DEVICE SPIKE\nWHEN flag clicked:\n  lab start\n'+probeMotors.map(p=>[30,-30].map(speed=>`  lab run motor ${JSON.stringify(p)} at ${speed} degrees per second\n  wait 1 seconds\n  lab stop motor ${JSON.stringify(p)} coast\n`).join('')).join(''):suppliedProgram;
    const Creator=(await import('../overlay/scratch-gui/src/lib/sb3-creator-register-art.js')).default;
    const creator=new Creator();mark('program-parse');const parsed=creator.parse(program);
    const {runRobotLabProgram}=await import('../test/helpers/robot-lab-direct-vm.mjs');
    const guiDependencyRoot=process.env.BW_INTEGRATED_ROOT||join(root,'packages/scratch-gui');
    const guiRequire=createRequire(join(guiDependencyRoot,'package.json'));
    mark('sb3-generation');const JSZip=guiRequire('jszip'),sb3=await creator.generateSB3();
    const project=JSON.parse(await(await JSZip.loadAsync(await sb3.arrayBuffer())).file('project.json').async('string'));
    const withSpike=(project.extensions||[]).includes('spikeprime');
    const enginePackagePath=join(guiDependencyRoot,'node_modules/jolt-physics/package.json');
    const enginePackage=JSON.parse(readFileSync(enginePackagePath));
    const modelSourceCommit=execFileSync('git',['log','-1','--format=%H','--',modelPath],{cwd:root,encoding:'utf8'}).trim();
    const programSourceCommit=execFileSync('git',['log','-1','--format=%H','--',programPath],{cwd:root,encoding:'utf8'}).trim();
    const report={id,programKind:probeMotors.length?'DIAGNOSTIC_MOTOR_SMOKE':'SUPPLIED',probeMotors,suppliedProgramSha256:hash(suppliedProgram),sourceHead,runnerSha256,modelSourceCommit,programSourceCommit,engineVersion:enginePackage.version,enginePackageSha256:hash(readFileSync(enginePackagePath)),motionThresholdDeg:0.1,modelPath,programPath,modelSha256:hash(modelText),programSha256:hash(program),simLimitMs:simMs,
        withSpike,compileErrors:parsed?.errors||creator.errors||[],compileWarnings:parsed?.warnings||creator.warnings||[],
        partFailures:[],missingOpcodes:[],vmErrors:[],sessionFailures:[],nonfinite:[],steps:0,primitiveCalls:0,executedOpcodes:{},motors:{},
        programVariables:{},programFailedObserved:false,programFaultObserved:false,invalidPoses:[],bodySanity:{status:'UNASSESSED',assessed:false,initialBodyExtentM:null,travelBoundM:null,travelOverBound:[],factor:100,floorM:1},motorPartCount:0,unboundMotorCount:0,maxBodyDisplacementM:0,maxBodyRadiusM:0,bodyTravel:{},scope:'Finite functional smoke only; no precision, physical accuracy, full GUI, or full-program completion requirement.'};
    if(args['bounded-memory'])report.retention={track:'LAST_FRAME',motorSamples:'INCREMENTAL',measurements:args['require-completion']?'STREAMED_JSON':'NONE'};
    const contract=PROGRAM_OUTPUT_CONTRACTS[id];
    if(args['require-completion']){report.terminalObservation={sawZero:false,sawTransition:false};report.messages=[];report.outputMeasurements=outputRules(contract).map(createOutputMeasurement);report.outputMeasurement=report.outputMeasurements[0];report.scope='Actual headless program completion and reviewed product pose measurement; no rendered GUI, physical accuracy or device claim.';}
    let currentApi=null,placements=null;
    const outputTrace=[];
    const measurementMetadata={schema:1,kind:'product-robotLab.pose',part:contract?.part||null,relativeTo:contract?.relativeTo||null,outputRules:contract?outputRules(contract):[],sourceHead,modelSha256:report.modelSha256,programSha256:report.programSha256};
    if(args['require-completion']&&args['bounded-memory'])measurementWriter=createMeasurementWriter(String(args.result)+'.measurement.json',measurementMetadata);
    const retainMeasurement=value=>measurementWriter?measurementWriter.append(value):outputTrace.push(value);
    const motorSamples=new Map(),initialBodies=new Map(),finite=new Set(),failures=new Set(),probeKeys=new Set(),programFlags=new Set();
    const collect=({session,hub,prepared},count=true)=>{
        if(count)report.steps++;
        if(args['require-completion'])report.finalEncoders=Object.fromEntries(prepared.mechanism.actuators.map(a=>[a.id,currentApi?.encoder(a.id)]));
        if(args['require-completion'] && contract && Object.entries(contract.observeWhen||{}).every(([k,v])=>Number(report.programVariables[k])===v)){
            outputRules(contract).forEach((rule,index)=>{const reading=observeOutput(report.outputMeasurements[index],rule,{api:currentApi,core:session.core,placements});if(reading&&count)retainMeasurement({t:session.time,channel:index,variables:Object.fromEntries(['stage','phase','cycle','held','settled','observing','pulsing'].filter(k=>k in report.programVariables).map(k=>[k,report.programVariables[k]])),...reading});});
        }
        if(session.failed)failures.add(String(session.failed));
        for(const a of prepared.mechanism.actuators){
            const port=a.port,owner=(session.hubs.length===1?session.hubs[0]:session.hubs.find(h=>h.id===a.hub)||(!a.hub?session.hubs[0]:null))?.hub;
            const reading=owner?.readPort?.(port),index=typeof port==='number'?port:port.charCodeAt(0)-65;
            const c=owner?.motors?.get?.(port)||owner?.hubState?.backend?._controllers?.[index];
            const mode=reading?.mode||c?.mode,requested=mode==='power'?(c?.power??c?.requested):(c?.speedDps??c?.requested);
            const nonzeroDrive=['speed','power','position','time','servo'].includes(mode)&&Number.isFinite(requested)&&Math.abs(requested)>0;
            const position=session.core.jointState(a.joint).angle*180/Math.PI;
            const key=(a.hub?String(a.hub)+':':'')+port;
            const samples=motorSamples.get(key)||(args['bounded-memory']?createMotorSummary():[]);if(args['bounded-memory'])observeMotorSummary(samples,{position,mode,nonzeroDrive});else samples.push({position,mode,nonzeroDrive});motorSamples.set(key,samples);
        }
        const poses={};for(const b of prepared.mechanism.bodies.filter(b=>b.motion==='dynamic')){
            const p=session.core.bodyPose(b.id);poses[b.id]=p;
            if(!Array.isArray(p?.position)||p.position.length!==3||!Array.isArray(p?.rotation)||p.rotation.length!==4){if(!report.invalidPoses.includes(b.id))report.invalidPoses.push(b.id);continue;}
            const v=p.position||p.pos||p.p;if(Array.isArray(v)){
                if(!initialBodies.has(b.id))initialBodies.set(b.id,v.slice());
                const initial=initialBodies.get(b.id),travel=Math.hypot(...v.map((x,i)=>x-initial[i]));
                report.bodyTravel[b.id]=Math.max(report.bodyTravel[b.id]||0,travel);
                report.maxBodyDisplacementM=Math.max(report.maxBodyDisplacementM,travel);
                report.maxBodyRadiusM=Math.max(report.maxBodyRadiusM,Math.hypot(...v));
            }
        }
        const joints=Object.fromEntries(prepared.mechanism.joints.filter(j=>['hinge','slider'].includes(j.type)).map(j=>[j.id,session.core.jointState(j.id)]));
        for(const p of nonFinitePaths({poses,joints,motors:hub.data.motors}))if(finite.size<50)finite.add(p);
    };
    mark('vm-and-physics-runtime');
    const r=await runRobotLabProgram(program,{modelText,timeLimitMs:simMs,withSpike,afterMs,retainTrack:!args['bounded-memory'],
        observeSetup:ctx=>{
            const {vm,prepared}=ctx;
            if(args['require-completion']){currentApi=vm.runtime.robotLab;placements=new Map(prepared.runModel.parts.map(p=>[p.id,p]));vm.runtime.on('SAY',(_target,type,text)=>{if(type==='say'&&String(text).trim())report.messages.push(String(text));});}
            for(const ref of probeMotors){const a=prepared.mechanism.actuators.find(a=>a.id===ref||String(a.port)===ref);if(!a){const error=new Error('Unknown diagnostic motor '+ref);error.code='INVALID_DIAGNOSTIC_TARGET';throw error;}probeKeys.add((a.hub?String(a.hub)+':':'')+a.port);}
            report.dynamicBodyCount=prepared.mechanism.bodies.filter(b=>b.motion==='dynamic').length;
            for(const [opcode,original] of Object.entries(vm.runtime._primitives))if(typeof original==='function')vm.runtime._primitives[opcode]=function(...values){report.primitiveCalls++;report.executedOpcodes[opcode]=(report.executedOpcodes[opcode]||0)+1;return original.apply(this,values);};
            const parts=JSON.parse(readFileSync(join(root,'overlay/scratch-gui/src/lib/bw-sim/part-meta/parts.json'))).parts;
            const motorParts=new Set(parts.filter(p=>p.category==='motor').map(p=>p.part));
            report.motorPartCount=prepared.model.parts.filter(p=>motorParts.has(p.part)).length;
            report.unboundMotorCount=Math.max(0,report.motorPartCount-prepared.mechanism.actuators.length);
            report.placements=prepared.model.parts.length;report.bodies=prepared.mechanism.bodies.length;report.actuators=prepared.mechanism.actuators;
            report.issues=prepared.issues;report.partFailures=prepared.issues.filter(i=>/unknown.part|missing.part|unresolved/.test(i.code||'')).map(i=>i.code+':'+i.message);
            report.compileErrors.push(...prepared.issues.filter(i=>i.severity==='error').map(i=>i.code+':'+i.message));
            for(const emitter of [vm,vm.runtime])for(const event of ['ERROR','BLOCKS_ERROR'])emitter.on(event,e=>report.vmErrors.push(String(e)));
            report.missingOpcodes=[...new Set(vm.runtime.targets.flatMap(t=>Object.values(t.blocks._blocks)).filter(b=>!(b.opcode in vm.runtime._primitives)&&!(b.opcode in vm.runtime._hats)&&!(Object.keys(b.fields||{}).length===1&&Object.keys(b.inputs||{}).length===0)).map(b=>b.opcode))];
            collect(ctx,false);
        },observeFrame:ctx=>{report.programVariables=Object.fromEntries(ctx.vm.runtime.targets.flatMap(t=>Object.values(t.variables||{}).filter(v=>v.type!=='list').map(v=>[v.name,v.value])));collect(ctx);latchProgramFailures(programFlags,report.programVariables);if(args['require-completion'])observeTerminal(report.terminalObservation,report.programVariables,contract?.terminal);return null;}});
    report.finishedAt=r.finishedAt;report.simulatedMs=r.track.at(-1)?.t;report.sessionFailures=[...failures];report.nonfinite=[...finite];
    report.vmErrors=[...new Set([...report.vmErrors,...(r.vmErrors||[])])];
    const initialPositions=[...initialBodies.values()];
    if(initialPositions.length){
        const low=[0,1,2].map(i=>Math.min(...initialPositions.map(v=>v[i]))),high=[0,1,2].map(i=>Math.max(...initialPositions.map(v=>v[i])));
        report.bodySanity.initialBodyExtentM=Math.hypot(...high.map((v,i)=>v-low[i]));
        report.bodySanity.travelBoundM=Math.max(report.bodySanity.floorM,report.bodySanity.factor*report.bodySanity.initialBodyExtentM);
        report.bodySanity.assessed=report.invalidPoses.length===0&&Number.isFinite(report.bodySanity.travelBoundM);
        report.bodySanity.travelOverBound=Object.entries(report.bodyTravel).filter(([,travel])=>travel>report.bodySanity.travelBoundM).map(([body])=>body);
    }
    report.bodySanity.status=report.dynamicBodyCount===0?'NOT_APPLICABLE_STATIC_ONLY':report.bodySanity.assessed?'ASSESSED':'UNASSESSED';
    report.execution=r.finishedAt?'COMPLETED':'BOUNDED_PARTIAL';
    report.motors=Object.fromEntries([...motorSamples].map(([p,s])=>[p,args['bounded-memory']?finishMotorSummary(s):summarizeMotor(s)]));
    report.failures=functionalFailures(report);
    report.failures=report.failures.filter(f=>!f.includes('UNCOMMANDED_MOVED'));
    if(probeMotors.length)report.failures=report.failures.filter(f=>!f.startsWith('motor:')||probeKeys.has(f.split(':').slice(1,-1).join(':')));
    report.motorCoverage=probeMotors.length?probeMotors:'ALL_INSTALLED_ACTUATORS';
    if(!report.primitiveCalls)report.failures.push('no-executed-vm-primitive');
    if(report.bodySanity.status==='UNASSESSED')report.failures.push('body-stability-unassessed');
    if(report.unboundMotorCount)report.failures.push('unbound-motor:'+report.unboundMotorCount);
    report.programFailedObserved=programFlags.has('failed');report.programFaultObserved=programFlags.has('fault');
    if(report.programFailedObserved)report.failures.push('program-failed-flag');
    if(report.programFaultObserved)report.failures.push('program-fault-flag');
    report.failures.push(...report.invalidPoses.map(id=>'invalid-pose:'+id),...report.bodySanity.travelOverBound.map(id=>'body-travel-over-sanity-bound:'+id));
    report.needsLongerRun=!r.finishedAt&&report.failures.length>0&&report.failures.every(f=>f.startsWith('motor:'));report.status=report.failures.length?(report.needsLongerRun?'INCONCLUSIVE':'FAIL'):'PASS';
    if(args['require-completion']){
        report.failures.push(...nonFinitePaths(report.programVariables).map(p=>'nonfinite-program-variable:'+p));
        if(contract?.drive==='intentional-hold'){report.intentionalHoldMotorObservations=report.failures.filter(f=>f.startsWith('motor:'));report.failures=report.failures.filter(f=>!f.startsWith('motor:'));report.motorCoverage='INTENTIONAL_HOLD_NO_DRIVE';}
        report.completion=programCompletion(report,contract);report.status=report.completion.status;
        if(contract?.terminalMode)report.terminalOutcome={verified:report.completion.terminalVerified,kind:contract.terminalMode};
        report.outputContract=contract||null;
        if(measurementWriter){measurementWriter.finish();measurementWriter=null;}else writeFileSync(String(args.result)+'.measurement.json',JSON.stringify({...measurementMetadata,samples:outputTrace},null,2)+'\n');
    }
    writeFileSync(String(args.result),JSON.stringify(report,null,2)+'\n');
    process.exit(['PASS','COMPLETE'].includes(report.status)?0:1);
    }catch(error){
        measurementWriter?.abort();
        const missingDependency=['ERR_MODULE_NOT_FOUND','MODULE_NOT_FOUND','ERR_PACKAGE_PATH_NOT_EXPORTED'].includes(error.code);
        const externalIO=['ENOSPC','EIO','EACCES','EROFS','EDQUOT'].includes(error.code);
        const setup=externalIO||stage==='setup'||missingDependency||error.code==='INVALID_DIAGNOSTIC_TARGET';
        const report={id:String(args.child),sourceHead,runnerSha256,status:setup?'BLOCKED':'FAIL',stage,failures:[externalIO?'EXTERNAL_EVIDENCE_WRITE_ERROR':setup?'DEPENDENCY_OR_SETUP_ERROR':'PRODUCT_EXCEPTION'],error:{name:error.name,code:error.code||null,message:error.message}};
        writeFileSync(String(args.result),JSON.stringify(report,null,2)+'\n');console.error(error);process.exit(1);
    }
}else{
    if(!args.out)throw Error('Provide --out=<owned evidence directory>');
    const out=resolve(String(args.out));mkdirSync(out,{recursive:true});
    const wanted=args.models?String(args.models).split(','):inventory.map(m=>m.id);
    for(const id of wanted)if(!inventory.some(m=>m.id===id))throw Error('Unknown model '+id);
    const results=[];
    for(const id of wanted){
        const result=join(out,id+'.json'),log=join(out,id+'.log');
        if(existsSync(result)||existsSync(log))throw Error('Use fresh output files for '+id);
        const child=spawnSync(process.execPath,['--max-old-space-size=768','--import',join(root,'scripts/lib/register-gui-scope.mjs'),fileURLToPath(import.meta.url),'--child='+id,'--result='+result,'--sim-ms='+simMs,'--after-ms='+afterMs,...(args['require-completion']?['--require-completion']:[]),...(args['bounded-memory']?['--bounded-memory']:[]),...(args['probe-motors']?['--probe-motors='+args['probe-motors']]:[])],{cwd:root,timeout:wallMs,maxBuffer:4*1024*1024,encoding:'utf8'});
        writeFileSync(log,(child.stdout||'')+(child.stderr||''));
        let row;try{row=JSON.parse(readFileSync(result));}catch{let progress={};try{progress=JSON.parse(readFileSync(result+'.progress.json'));}catch{}
        const crashed=child.signal&&progress.stage==='vm-and-physics-runtime'&&!/heap out of memory|out of memory/i.test(child.stderr||'');row={id,stage:progress.stage,status:child.error?.code==='ETIMEDOUT'||crashed?'FAIL':'BLOCKED',failures:[child.error?.code==='ETIMEDOUT'?'PROCESS_TIMEOUT':crashed?'RUNTIME_PROCESS_CRASH':'PROCESS_ERROR_UNATTRIBUTED'],error:String(child.error||child.signal||child.status)};writeFileSync(result,JSON.stringify(row,null,2)+'\n');}
        if(['PASS','COMPLETE'].includes(row.status)&&(child.status!==0||child.error||child.signal)){row.status='BLOCKED';row.failures.push('NONZERO_CHILD_EXIT');writeFileSync(result,JSON.stringify(row,null,2)+'\n');}
        results.push(row);console.log(`${id}: ${row.status} ${[...(row.failures||[]),...(row.completion?.gaps||[])].join(';')}`);
        const summary={schema:1,sourceHead,simMs,wallMs,models:results};writeFileSync(join(out,'functional-summary.json'),JSON.stringify(summary,null,2)+'\n');
    }
    process.exitCode=results.every(r=>['PASS','COMPLETE'].includes(r.status))?0:1;
}
