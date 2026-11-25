/** Synthetic protocol controls only. No engine, CLI, SPICE or protected study is run. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync,existsSync,copyFileSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createManifest,createCases,canonical,sha256,topologySignature,SOURCES,RUNTIME_FINGERPRINTS,validateCaptureClock} from '../scripts/lib/reference-qualified-circuits.mjs';
import {referenceDeck,referenceVectors,parseReference,parseCsv,compareDc,compareCapture,close,summarize,referenceMean} from '../scripts/lib/reference-qualified-compare.mjs';
import {cliArgs,recordCommand,inventory,checkCohortBudget,remainingCohortWall,validateStudyAdmission} from '../scripts/reference-qualified-instrument-study.mjs';

const ROOT=resolve(import.meta.dirname,'..');
const HEAD='a'.repeat(40),RUN='123456789';
// Metadata of the consumed study, not the live installed UI package.
const frozenUiManifestBytes=readFileSync(join(ROOT,'docs/receipts/reference-qualified-v2-ui-package.json'));
assert.equal(sha256(frozenUiManifestBytes),'aa2e7cdd01c31f9622339ebccf16fcd5c3728d497903b4230fbd1842fd1ddc16');
const uiManifestBytes=process.env.REFERENCE_UI_PACKAGE_JSON
    ? readFileSync(process.env.REFERENCE_UI_PACKAGE_JSON) : frozenUiManifestBytes;
assert.deepEqual(uiManifestBytes,frozenUiManifestBytes,'external admitted metadata must equal the sealed historical fixture');
assert.equal(sha256(uiManifestBytes),'aa2e7cdd01c31f9622339ebccf16fcd5c3728d497903b4230fbd1842fd1ddc16','exact pinned UI manifest required for source controls');
const declaredBoardSpec=JSON.parse(uiManifestBytes).devDependencies['bw-board'];
const json=value=>JSON.stringify(value,null,2)+'\n';
const put=(root,name,value)=>writeFileSync(join(root,name),typeof value==='string'?value:json(value));
const get=(root,name)=>JSON.parse(readFileSync(join(root,name),'utf8'));
const hashFile=name=>sha256(readFileSync(join(ROOT,name)));
const manifest=createManifest();
const numerical=manifest.cases.filter(c=>c.eligibility==='comparable');
const value=vector=>vector.startsWith('i(')?-.002:1.25;
// The completed study's collector still admits only its historical suppliers.
// Exercise its unchanged source in an isolated synthetic consumer; never borrow
// this checkout's later production pins or weaken the real preflight.
async function historicalCollector(t) {
    const root=mkdtempSync(join(tmpdir(),'reference-historical-source-'));
    t.after(()=>rmSync(root,{recursive:true,force:true}));
    for(const file of ['package.json','package-lock.json',
        'scripts/reference-qualified-instrument-study.mjs',
        'scripts/lib/reference-qualified-circuits.mjs','scripts/lib/reference-qualified-compare.mjs',
        'scripts/package-provenance.mjs','scripts/read-reference-qualified-instruments.py',
        '.github/workflows/reference-qualified-instruments.yml']) {
        const target=join(root,file);mkdirSync(dirname(target),{recursive:true});
        copyFileSync(join(ROOT,file),target);
    }
    put(root,'vendor-pins.json',SOURCES);
    const loaded=await import(pathToFileURL(join(root,'scripts/reference-qualified-instrument-study.mjs')).href);
    return {root,runStudy:loaded.runStudy};
}

function syncInventory(root){put(root,'inventory.json',inventory(root));}
function processRecord(root,prefix,role,args,status=0,stdout='',stderr='') {
    put(root,prefix+'.stdout',stdout);put(root,prefix+'.stderr',stderr);
    put(root,prefix+'.process.json',{role,executable:role==='reference'?'/usr/bin/ngspice':'/usr/bin/node',args,
        wrapper:'/usr/bin/prlimit',limits:['--cpu=90','--fsize=16777216',...(role==='reference'?['--as=536870912']:[])],
        status,signal:null,error:null,cwd:prefix.includes('/')?join(root,prefix.split('/')[0]):root,durationMs:1,timeoutMs:90000,stdout:{bytes:Buffer.byteLength(stdout),sha256:sha256(stdout)},
        stderr:{bytes:Buffer.byteLength(stderr),sha256:sha256(stderr)}});
}
function changeOutput(root,prefix,stdout) {
    const p=get(root,prefix+'.process.json');put(root,prefix+'.stdout',stdout);
    p.stdout={bytes:Buffer.byteLength(stdout),sha256:sha256(stdout)};put(root,prefix+'.process.json',p);
}
function replaceCsv(root,name,text) {
    put(root,name,text);const receiptPath=name.replace('capture.csv','receipt.json');
    const receipt=get(root,receiptPath);receipt.csv={name:'capture.csv',bytes:Buffer.byteLength(text),sha256:sha256(text)};put(root,receiptPath,receipt);
}
function changeCaptureReport(root,change) {
    const prefix='loaded-rc-lowpass/cli',report=JSON.parse(readFileSync(join(root,prefix+'.stdout')));
    change(report);changeOutput(root,prefix,json(report));
    const receipt=get(root,'loaded-rc-lowpass/receipt.json');receipt.report=report;put(root,'loaded-rc-lowpass/receipt.json',receipt);
}
function changeReceipt(root,change) {
    const path='loaded-rc-lowpass/receipt.json',receipt=get(root,path);change(receipt);put(root,path,receipt);
}
function oracleText(c,sampled=false) {
    const names=referenceVectors(c),rows=[];
    if(c.route==='dc-sweep') {
        for(let i=0;i<c.sweep.points;i++)rows.push(c.sweep.from+(c.sweep.to-c.sweep.from)*i/(c.sweep.points-1));
    } else {
        const step=sampled?c.clock.intervalNs:c.maxStepNs;
        for(let ns=0;ns<=c.clock.durationNs;ns+=step)rows.push(ns/1e9);
    }
    return [(c.route==='dc-sweep'?'v-sweep':'time')+' '+names.join(' '),
        ...rows.map(t=>[t,...names.map(value)].join(' '))].join('\n')+'\n';
}
function captureReport(c) {
    const k=c.clock,active=c.family==='lm741'||c.id==='adp7118-loaded-startup';
    const report={source:'loaded.json',format:'json',requestedTransientProfile:'precision-v1',plannedSamples:k.count,
        durationSeconds:k.durationNs/1e9,rateHz:k.rateHz,effectiveRateHz:k.rateHz,
        simulatedDurationSeconds:k.durationNs/1e9,claims:{engineBacked:true,independentOracle:false},
        transient:{profile:{id:'precision-v1'},accuracyMet:true,failure:null,work:{attempts:1,solves:4,advances:1}},
        precisionCapture:{maxAttempts:20000,maxSolves:60001,maxAdvances:active?200:1},
        scope:c.scopes.map(s=>({tip:s.tip,reference:s.reference,capture:'sample',probe:'ideal',
            startTimeSeconds:k.firstSampleNs/1e9,sampleIntervalSeconds:k.intervalNs/1e9,summary:{samples:k.count}})),
        meters:c.meters.map(m=>({mode:m.mode,probes:m.probes,quantity:'observed-dc-mean',timeSeconds:k.durationNs/1e9,
            reading:{siUnit:m.unit,siValue:m.coefficient*value(m.vector)}})),
        poweredMeterAcquisition:{startTimeSeconds:0,maximumWindowSeconds:.1,quantity:'observed-dc-mean',independentIntegralCertificate:false}};
    if(active)report.transient.boundedAdvance={completed:true,failure:null,requestedTimeNs:String(k.durationNs),
        work:{attempts:1,solves:4,advances:1}};
    return report;
}
function csvText(c) {
    return c.scopes.map(s=>[
        '# net='+s.tip+' - '+s.reference+' capture=sample startTimeNs='+c.clock.firstSampleNs+
        ' sampleIntervalNs='+c.clock.intervalNs+' points='+c.clock.count,
        'elapsed_seconds,volts',...Array.from({length:c.clock.count},(_,i)=>(i*c.clock.intervalNs/1e9)+','+(s.coefficient*value(s.vector)))
    ].join('\n')).join('\n\n')+'\n';
}
function fixture(t) {
    const root=mkdtempSync(join(tmpdir(),'reference-protocol-'));
    t.after(()=>rmSync(root,{recursive:true,force:true}));
    put(root,'intent.json',canonical(manifest)+'\n');
    writeFileSync(join(root,'ui-package.json'),uiManifestBytes);
    const fp=(key,extras)=>({...RUNTIME_FINGERPRINTS[key],extraFiles:extras,
        scope:'package.json, recursive src JS/JSON, and listed extra files'});
    const packages={sources:SOURCES,proof:['bw-board','bw-circuit-ui'].map(name=>({name,sha:SOURCES[name],files:10,
        verified:'pinned-git-npm-pack-bytes',dependenciesVerified:false})),board:fp('board',[]),ui:fp('ui',['bin/bwc.mjs']),
        node:'v22.23.0',limits:{arbitraryDependenciesVerified:false,hermeticExecution:false,physicalCalibration:false}};
    put(root,'package-proof.json',packages);
    const admission={schemaVersion:1,repositoryName:'CrispStrobe/brickwright-lite',reviewAuthority:'repository-variable:REFERENCE_QUALIFIED_STUDY_HEAD',
        reviewedHead:HEAD,headSha:HEAD,runId:Number(RUN),runAttempt:1,intentSha256:sha256(canonical(manifest))};
    put(root,'event-admission.json',admission);
    put(root,'run-context.json',{runId:RUN,runAttempt:'1',headSha:HEAD,ref:'refs/heads/study/reference-qualified-v2',
        intentSha256:sha256(canonical(manifest)),admissionSha256:sha256(readFileSync(join(root,'event-admission.json'))),
        nodeExecutable:'/usr/bin/node',outputRoot:root,collectorSha256:hashFile('scripts/reference-qualified-instrument-study.mjs'),
        comparatorsSha256:hashFile('scripts/lib/reference-qualified-compare.mjs'),fixturesSha256:hashFile('scripts/lib/reference-qualified-circuits.mjs'),
        readerSha256:hashFile('scripts/read-reference-qualified-instruments.py'),
        packageProvenanceSha256:hashFile('scripts/package-provenance.mjs'),workflowSha256:hashFile('.github/workflows/reference-qualified-instruments.yml'),
        lockSha256:hashFile('package-lock.json'),pinsSha256:hashFile('vendor-pins.json')});
    processRecord(root,'oracle-version','reference',['--version'],0,'ngspice-42\n');
    const results=[];
    for(const c of manifest.cases) {
        const dir=join(root,c.id),prefix=c.id+'/';mkdirSync(dir);
        const input=join(dir,'input.'+(c.input.format==='json'?'json':'cir'));
        writeFileSync(input,c.input.text);
        const loadedPath=join(dir,'loaded.json');
        put(root,c.id+'/loaded.json',JSON.stringify(JSON.parse(c.input.text),null,1)+'\n');
        processRecord(root,prefix+'load','cli',['--max-old-space-size=384','/synthetic/bw-circuit-ui/bin/bwc.mjs','convert',input,'--to','json','-o',loadedPath]);
        const argv=cliArgs(c,loadedPath,dir);
        if(c.eligibility==='expected-refusal') {
            processRecord(root,prefix+'cli','cli',['--max-old-space-size=384','/synthetic/bw-circuit-ui/bin/bwc.mjs',...argv],c.refusal.exitCode,'',c.refusal.stderrIncludes+'\n');
            const r={id:c.id,status:'expected-refusal',cliAttemptRecorded:true,checks:[]};results.push(r);put(root,prefix+'result.json',r);continue;
        }
        put(root,prefix+'reference.cir',referenceDeck(c));
        put(root,prefix+'reference-raw.txt',oracleText(c));
        processRecord(root,prefix+'oracle','reference',['-n','-b','reference.cir']);
        const raw=parseReference(oracleText(c),c);
        let report,checks;
        if(c.route==='dc-sweep') {
            report={schemaVersion:1,source:'loaded.json',format:'json',sourceId:c.sweep.source,
                observations:c.observations.map(({kind,selector,reference,unit})=>({kind,selector,reference,unit})),
                samples:raw.map(r=>({sourceVolts:r.scale,values:c.observations.map(o=>o.coefficient*r.values[o.vector])})),
                claims:{transient:false,independentOracle:false}};
            checks=compareDc(report,c,raw);
        } else {
            report=captureReport(c);
            put(root,prefix+'reference-grid.txt',oracleText(c,true));
            const csv=csvText(c);put(root,prefix+'capture.csv',csv);
            const grid=parseReference(oracleText(c,true),c,{sampled:true});
            checks=compareCapture(report,parseCsv(csv,c),c,raw,grid);
            put(root,prefix+'receipt.json',{schemaVersion:1,kind:'bwc-measurement-receipt',acquisition:'batch',exitCode:0,report,
                input:{name:'loaded.json',bytes:readFileSync(loadedPath).length,sha256:sha256(readFileSync(loadedPath))},
                importedCircuitSha256:c.importedCircuitSha256,watchSamples:null,
                limits:{independentOracle:false,hermeticExecution:false,importedDependencyClosure:false,runtimeFingerprintCaptured:'before simulation',embeddedSourceOrWaveforms:false},
                csv:{name:'capture.csv',bytes:Buffer.byteLength(csv),sha256:sha256(csv)},clock:{startNs:'0',durationNs:String(c.clock.durationNs),intervalNs:String(c.clock.intervalNs)},
                engine:{selection:'installed package',declaredPackageSpec:declaredBoardSpec,observed:{...packages.board,root:'/synthetic/bw-board'}},cli:{...packages.ui,root:'/synthetic/bw-circuit-ui'},
                invocation:{BW_BOARD:null,argv,executable:'/usr/bin/node',cwd:dir,nodeVersion:packages.node},references:{waveform:null,meters:null}});
        }
        processRecord(root,prefix+'cli','cli',['--max-old-space-size=384','/synthetic/bw-circuit-ui/bin/bwc.mjs',...argv],0,json(report));
        const r={id:c.id,status:'pass',cliAttemptRecorded:true,checks};results.push(r);put(root,prefix+'result.json',r);
    }
    put(root,'results.json',results);put(root,'summary.json',{...summarize(manifest,results),preflightError:null});
    syncInventory(root);return root;
}
function reader(root,head=HEAD,run=RUN,sourceRoot=ROOT) {
    const p=spawnSync('/usr/bin/python3',['-I','-B','scripts/read-reference-qualified-instruments.py',root,'--head',head,'--run',run],
        {cwd:sourceRoot,encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
    if(p.error)throw p.error;
    return p;
}
function assertRejected(root,pattern) {
    syncInventory(root);const result=reader(root);
    assert.equal(result.status,3,result.stdout+result.stderr);
    if(pattern)assert.match(result.stderr,pattern);
}

test('authored intent distinguishes candidates, precision capture designs and a named refusal',()=>{
    assert.deepEqual(manifest.counts,{inputs:32,referenceEligibleDesigns:31,refusalControls:1,executed:0,qualified:0});
    assert.equal(numerical.length,31);assert.equal(new Set(numerical.map(c=>c.topologySha256)).size,31);
    assert.equal(numerical.filter(c=>c.route==='measure').length,15);
    assert.equal(numerical.filter(c=>c.route==='dc-sweep').length,16);
    assert.equal(manifest.cases.at(-1).eligibility,'expected-refusal');
    assert.throws(()=>{manifest.cases[0].tolerances.V.absolute=100;},TypeError);
    assert.ok(manifest.cases.every(c=>c.rights.includes('Independently authored')&&!c.qualifiesPhysicalCalibration));
});
test('DC references explicitly match the three-terminal NPN and junction conductance law',()=>{
    const dc=manifest.cases.filter(c=>c.route==='dc-sweep');
    assert.equal(dc.length,16);
    for(const c of dc)assert.equal(c.reference.cards.filter(card=>card===
        '.options gmin=1e-12 gshunt=0 gminsteps=0 srcsteps=0').length,1,'one explicit regularization method');
    const npn=dc.filter(c=>c.graph.some(p=>p.kind==='npn'));assert.equal(npn.length,5);
    const check=c=>{
        for(const part of c.graph.filter(p=>p.kind==='npn')) {
            const params=c.modelParameters.find(p=>p.id===part.id).params;
            assert.equal(params.rb,0);assert.equal(params.rc,0,'collector is collector-prime only in this zero-RC domain');
            const card=c.reference.cards.find(x=>x.startsWith(part.id+' '));
            assert.equal(card,[part.id,...part.nodes,part.nodes[0],'QCORE'].join(' '),
                'explicit collector substrate required; omitted fourth pin silently grounds it');
        }
    };
    npn.forEach(check);
    const old=structuredClone(npn[0]),q=old.graph.find(p=>p.kind==='npn');
    old.reference.cards=old.reference.cards.map(x=>x.startsWith(q.id+' ')
        ?[q.id,...q.nodes,'QCORE'].join(' '):x);
    assert.throws(()=>check(old),/explicit collector substrate required/);
});
test('reference cards actually match the declared thermal voltage in admitted ngspice42',()=>{
    const thermalCases=manifest.cases.filter(c=>c.reference?.thermalVolts!==undefined);
    assert.equal(thermalCases.length,16,'all DC reference cases have an explicit thermal law');
    const check=c=>{
        const card=c.reference.cards.find(x=>/^\.options TEMP=/.test(x));
        assert.ok(card,'reference temperature card is present');
        const m=/^\.options TEMP=([-+0-9.e]+) TNOM=([-+0-9.e]+)$/.exec(card);
        assert.ok(m,'both temperatures are explicit');
        const temp=Number(m[1]);assert.equal(temp,Number(m[2]),'no IS temperature rescaling');
        // Independent version42 constants; do not import the producer's conversion.
        const actualVt=(temp+273.15)*1.38064852e-23/1.6021766208e-19;
        assert.ok(Math.abs(actualVt-c.reference.thermalVolts)<=1e-17,'admitted ngspice42 thermal voltage differs');
    };
    thermalCases.forEach(check);
    const old=structuredClone(thermalCases[0]);
    old.reference.cards=old.reference.cards.map(x=>/^\.options TEMP=/.test(x)
        ?'.options TEMP=26.826793442075882 TNOM=26.826793442075882':x);
    assert.throws(()=>check(old),/thermal voltage differs/,'modern-SI conversion must not pass the version42 contract');
});
test('topology invariant ignores names, values, placement and passive lead reversal',()=>{
    const c=createCases()[0];const parts=c.graph;
    const rename=parts.map((p,i)=>({...p,id:'OTHER'+i,nodes:p.nodes.map(n=>n==='0'?'0':'renamed-'+n),params:{ignored:i}}));
    assert.equal(topologySignature(parts),topologySignature(rename));
    const reversed=structuredClone(parts);reversed.find(p=>p.kind==='resistor').nodes.reverse();
    assert.equal(topologySignature(parts),topologySignature(reversed));
    reversed.pop();assert.notEqual(topologySignature(parts),topologySignature(reversed));
});
test('pure numerical comparator rejects nonfinite, overflow and negative bounds',()=>{
    assert.deepEqual(close(1,1,{absolute:0,relative:0}),{actual:1,expected:1,error:0,allowed:0,pass:true});
    assert.equal(close(-.002,.002,{absolute:1e-9,relative:.002}).pass,false);
    for(const bad of [NaN,Infinity,'1',true])assert.throws(()=>close(bad,1,{absolute:0,relative:0}));
    assert.throws(()=>close(1e308,-1e308,{absolute:0,relative:0}));
    assert.throws(()=>close(1,1,{absolute:-1,relative:0}));
});
test('command wrapper captures output and limits without executing a model',t=>{
    const dir=mkdtempSync(join(tmpdir(),'reference-wrapper-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
    let seen;
    const r=recordCommand({role:'reference',executable:'/usr/bin/ngspice',args:['--version'],cwd:dir,prefix:join(dir,'version'),
        execute:(exe,args,opts)=>{seen={exe,args,opts};return {status:0,stdout:'mock version',stderr:''};}});
    assert.equal(seen.exe,'/usr/bin/prlimit');assert.ok(seen.args.includes('--as=536870912'));
    assert.equal(seen.opts.timeout,90000);assert.equal(seen.opts.env.BW_BOARD,'');
    assert.equal(r.stdout,'mock version');assert.equal(get(dir,'version.process.json').stdout.sha256,sha256('mock version'));
});
test('synthetic full protocol originals independently reconcile, without physical or runtime claims',t=>{
    const root=fixture(t),p=reader(root);assert.equal(p.status,0,p.stderr+p.stdout);
    const report=JSON.parse(p.stdout);assert.equal(report.counts.inputs,32);assert.equal(report.counts.passed,31);
    assert.equal(report.counts.refused,1);assert.equal(report.evidenceComplete,true);assert.equal(report.numericalConformance,true);
    assert.equal(report.physicalCalibration,false);assert.equal(report.modelOrOracleReplayed,false);
    assert.equal(report.caseReadback.length,32);assert.equal(report.requestedSelectorLocations,84);
    assert.equal(report.referenceEligibleSelectorLocations,83);assert.equal(report.numericallyPassingSelectorLocations,83);
});
const negatives=[
    ['wrong CLI refusal exit with the right named message',root=>{const path='lt1763-precision-refusal/cli.process.json',p=get(root,path);p.status=1;put(root,path,p);},/outcome mismatch/],
    ['wrong official head',root=>{const r=get(root,'run-context.json');r.headSha='b'.repeat(40);put(root,'run-context.json',r);},/event\/head/],
    ['wrong source body hash',root=>{const r=get(root,'run-context.json');r.collectorSha256='0'.repeat(64);put(root,'run-context.json',r);},/source-file hash/],
    ['wrong installed engine fingerprint',root=>{const r=get(root,'package-proof.json');r.board.jsJsonTreeSha256='0'.repeat(64);put(root,'package-proof.json',r);},/pinned runtime/],
    ['altered input even with refreshed inventory',root=>{const c=manifest.cases[0];const changed=c.input.text.replace('"ohms": 1000','"ohms": 2000');assert.notEqual(changed,c.input.text);put(root,c.id+'/input.json',changed);},/outcome mismatch/],
    ['wrong actual route',root=>{const p=manifest.cases[0].id+'/cli.process.json';const r=get(root,p);r.args[2]='op';put(root,p,r);},/outcome mismatch/],
    ['extra reference circuit part',root=>{const c=manifest.cases[0],p=c.id+'/reference.cir';put(root,p,readFileSync(join(root,p),'utf8').replace('.control','RFAKE OUT 0 1\n.control'));},/outcome mismatch/],
    ['wrong oracle analysis scale',root=>{const p=manifest.cases[0].id+'/reference-raw.txt';put(root,p,readFileSync(join(root,p),'utf8').replace('v-sweep','time'));},/outcome mismatch/],
    ['reversed nonzero terminal current',root=>{const c=manifest.cases[0],p=c.id+'/cli';const r=JSON.parse(readFileSync(join(root,p+'.stdout')));r.samples[0].values[c.observations.length-1]*=-1;changeOutput(root,p,json(r));},/outcome mismatch/],
    ['shifted scope source clock',root=>{const p='loaded-rc-lowpass/capture.csv';replaceCsv(root,p,readFileSync(join(root,p),'utf8').replace('startTimeNs=500','startTimeNs=501'));},/outcome mismatch/],
    ['changed raw scope volts with coherent byte receipts',root=>{const p='loaded-rc-lowpass/capture.csv';replaceCsv(root,p,readFileSync(join(root,p),'utf8').replace(',1.25',',1.5'));},/outcome mismatch/],
    ['wrong DMM SI unit',root=>changeCaptureReport(root,r=>{r.meters[0].reading.siUnit='mV';}),/outcome mismatch/],
    ['endpoint relabelled as a DMM mean',root=>changeCaptureReport(root,r=>{r.meters[0].quantity='instantaneous';}),/outcome mismatch/],
    ['wrong DMM integration endpoint',root=>changeCaptureReport(root,r=>{r.meters[0].timeSeconds/=2;}),/outcome mismatch/],
    ['missing interior reference row',root=>{const p='loaded-rc-lowpass/reference-raw.txt';const rows=readFileSync(join(root,p),'utf8').split('\n');rows.splice(5,1);put(root,p,rows.join('\n'));},/outcome mismatch/],
    ['wrong imported graph digest',root=>changeReceipt(root,r=>{r.importedCircuitSha256='0'.repeat(64);}),/outcome mismatch/],
    ['missing imported graph digest',root=>changeReceipt(root,r=>{delete r.importedCircuitSha256;}),/outcome mismatch/],
    ['wrong input artifact name',root=>changeReceipt(root,r=>{r.input.name='other.json';}),/outcome mismatch/],
    ['wrong CSV artifact name',root=>changeReceipt(root,r=>{r.csv.name='other.csv';}),/outcome mismatch/],
    ['wrong receipt executable',root=>changeReceipt(root,r=>{r.invocation.executable='/wrong/node';}),/outcome mismatch/],
    ['wrong receipt cwd',root=>changeReceipt(root,r=>{r.invocation.cwd='/wrong';}),/outcome mismatch/],
    ['wrong declared UI artifact metadata',root=>changeReceipt(root,r=>{r.engine.declaredPackageSpec='wrong';}),/outcome mismatch/],
    ['invented watch samples in batch receipt',root=>changeReceipt(root,r=>{r.watchSamples=[];}),/outcome mismatch/],
    ['numeric false substituted for receipt limit',root=>changeReceipt(root,r=>{r.limits.hermeticExecution=0;}),/outcome mismatch/],
    ['changed complete loaded graph',root=>{const p='multitap-divider/loaded.json',r=get(root,p);r.parts.find(p=>p.id==='R1').params.ohms=2000;put(root,p,r);},/outcome mismatch/],
    ['changed prior reviewed head with coherent admission hash',root=>{const a=get(root,'event-admission.json');a.reviewedHead='b'.repeat(40);put(root,'event-admission.json',a);const c=get(root,'run-context.json');c.admissionSha256=sha256(readFileSync(join(root,'event-admission.json')));put(root,'run-context.json',c);},/prior reviewed/],
    ['unrecognized extra original',root=>put(root,'unselected.json','{}\n'),/unrecognized/],
    ['post-observation tolerance change',root=>{const m=get(root,'intent.json');m.cases[0].tolerances.V.absolute=100;put(root,'intent.json',canonical(m)+'\n');},/intent hash/],
    ['duplicate summary case',root=>{const r=get(root,'results.json');r.push(r[0]);put(root,'results.json',r);},/denominator/],
    ['boolean substituted for numerical count',root=>{const r=get(root,'summary.json');r.counts.missing=false;put(root,'summary.json',r);},/summary/],
    ['named refusal without actual marker',root=>{const p='lt1763-precision-refusal/cli';put(root,p+'.stderr','unrelated error\n');const r=get(root,p+'.process.json');r.stderr={bytes:16,sha256:sha256('unrelated error\n')};put(root,p+'.process.json',r);},/outcome mismatch/]
];
for(const [name,change,pattern]of negatives)test('independent reader mutation: '+name,t=>{const root=fixture(t);change(root);assertRejected(root,pattern);});
test('numerical disagreement remains a complete failing report, rather than being dropped',t=>{
    const root=fixture(t),c=manifest.cases[0],prefix=c.id+'/cli';
    const report=JSON.parse(readFileSync(join(root,prefix+'.stdout')));report.samples[0].values[0]+=.1;changeOutput(root,prefix,json(report));
    const checks=compareDc(report,c,parseReference(readFileSync(join(root,c.id+'/reference-raw.txt'),'utf8'),c));
    const result={id:c.id,status:'disagree',cliAttemptRecorded:true,checks};put(root,c.id+'/result.json',result);
    const results=get(root,'results.json');results[0]=result;put(root,'results.json',results);
    put(root,'summary.json',{...summarize(manifest,results),preflightError:null});syncInventory(root);
    const p=reader(root);assert.equal(p.status,2,p.stderr+p.stdout);
    const independent=JSON.parse(p.stdout);assert.equal(independent.evidenceComplete,true);assert.equal(independent.numericalConformance,false);
    assert.equal(independent.counts.inputs,32);assert.equal(independent.counts.disagreed,1);
});


test('actual workflow selector cannot turn unrelated labels, dispatches or refs into a numerical study',()=>{
    const text=readFileSync(join(ROOT,'.github/workflows/reference-qualified-instruments.yml'),'utf8');
    const match=/  study:\n    needs: controls\n    if: >-\n([\s\S]*?)    runs-on:/.exec(text);
    assert.ok(match,'actual study job condition exists');
    const condition=match[1].trim().replace(/\s+/g,' ');
    const selected=new Function('github','return ('+condition+');');
    const base={repository:'CrispStrobe/brickwright-lite',event_name:'push',ref:'refs/heads/study/reference-qualified-v2'};
    assert.equal(selected(base),true);
    for(const event_name of ['pull_request','workflow_dispatch','workflow_run'])assert.equal(selected({...base,event_name}),false);
    assert.equal(selected({...base,ref:'refs/heads/main'}),false);
    assert.equal(selected({...base,ref:'refs/heads/study/reference-qualified-v1'}),false,'the consumed v1 selection is not reusable');
    assert.equal(selected({...base,repository:'other/repo'}),false);
    assert.doesNotMatch(text,/x86-hdd|x86-native|workflow_dispatch:/,'no unrelated actual selection');
});
test('actual workflow event-admission body refuses duplicate/prior study, changed head/ref and second attempts before work',()=>{
    const text=readFileSync(join(ROOT,'.github/workflows/reference-qualified-instruments.yml'),'utf8');
    const start=text.indexOf('      - name: Admit one frozen owned push');
    const end=text.indexOf('      - uses: actions/checkout@',start+1);
    const step=text.slice(start,end),block=/node --input-type=module - <<'JS'\n([\s\S]*?)          JS/.exec(step);
    assert.ok(block,'actual pure admission body found');
    const body=block[1].replace(/^          /gm,'');
    const imports=body.match(/^import .*?;$/gm);assert.equal(imports?.length,2);
    const fn=new Function('readFileSync','writeFileSync','createManifest','canonical','sha256','SOURCES','process',body.replace(/^import .*?;\n/gm,''));
    const run={id:Number(RUN),run_attempt:1,head_sha:HEAD,head_branch:'study/reference-qualified-v2',event:'push',
        repository:{full_name:'CrispStrobe/brickwright-lite'},path:'.github/workflows/reference-qualified-instruments.yml'};
    const original={run,selections:{total_count:1,workflow_runs:[run]},ref:{object:{sha:HEAD}}};
    const env={REVIEWED_STUDY_HEAD:HEAD,GITHUB_RUN_ID:RUN,GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:HEAD,ADMITTED_INTENT:sha256(canonical(manifest))};
    const call=(data,environment)=>{
        let writes=0;
        const files={'vendor-pins.json':SOURCES,'reference-study-event/run.json':data.run,
            'reference-study-event/selections.json':data.selections,'reference-study-event/ref.json':data.ref};
        const read=name=>{if(!Object.hasOwn(files,name))throw new Error('Unadmitted metadata path');return JSON.stringify(files[name]);};
        assert.throws(()=>read('other/run.json'),/Unadmitted metadata path/);
        fn(read,()=>writes++,createManifest,canonical,sha256,SOURCES,{env:environment});return writes;
    };
    assert.equal(call(original,env),1);
    const mutants=[
        data=>{data.run.head_sha='b'.repeat(40);},data=>{data.ref.object.sha='b'.repeat(40);},
        data=>{data.run.event='workflow_dispatch';},data=>{data.run.run_attempt=2;},
        data=>{data.selections.workflow_runs.push({...run,id:Number(RUN)+1});data.selections.total_count++;},
        data=>{data.selections.workflow_runs.push(run);data.selections.total_count++;},
        data=>{data.selections={total_count:0,workflow_runs:[]};}
    ];
    for(const change of mutants){const data=structuredClone(original);change(data);assert.throws(()=>call(data,env),/refused/);}
    assert.throws(()=>call(original,{...env,GITHUB_RUN_ATTEMPT:'2'}),/refused/);
    assert.throws(()=>call(original,{...env,REVIEWED_STUDY_HEAD:undefined}),/refused/);
    assert.throws(()=>call(original,{...env,REVIEWED_STUDY_HEAD:'b'.repeat(40)}),/refused/);
    assert.throws(()=>call(original,{...env,ADMITTED_INTENT:'0'.repeat(64)}),/refused/);
});

test('whole-cohort deadline refuses elapsed work and invalid/backward clocks',()=>{
    assert.doesNotThrow(()=>checkCohortBudget(10,()=>3600010));
    assert.throws(()=>checkCohortBudget(10,()=>3600011),/budget/);
    assert.throws(()=>checkCohortBudget(10,()=>9),/budget/);
    assert.throws(()=>checkCohortBudget(10,()=>NaN),/budget/);
});

test('remaining wall time shortens the final command before the cohort deadline',()=>{
    assert.equal(remainingCohortWall(0,()=>0),90000);
    assert.equal(remainingCohortWall(0,()=>3599999),1);
    assert.throws(()=>remainingCohortWall(0,()=>3600000),/budget/);
    assert.throws(()=>remainingCohortWall(10,()=>9),/budget/);
});


test('reference quadrature accepts declared clock rounding and rejects a missing endpoint',()=>{
    const end=.0001,spec={vector:'v(out)',coefficient:1};
    const rows=[{scale:0,values:{'v(out)':1}},{scale:end+2e-20,values:{'v(out)':1}}];
    assert.ok(Math.abs(referenceMean(rows,spec,end)-1)<1e-12);
    assert.throws(()=>referenceMean([{scale:0,values:{'v(out)':1}},{scale:end-1e-9,values:{'v(out)':1}}],spec,end),/endpoint/);
});

test('actual collector with process/source doubles roundtrips through the independent reader',
    {skip:process.versions.node.split('.')[0]!=='22'?'collector runtime admission requires Node22; executed by the source-controls workflow':false},async t=>{
        const template=fixture(t),parent=mkdtempSync(join(realpathSync(tmpdir()),'reference-collector-'));
        const historical=await historicalCollector(t);
        const historicalRead=output=>reader(output,HEAD,RUN,historical.root);
        t.after(()=>rmSync(parent,{recursive:true,force:true}));
        const installedRoot=join(parent,'installed'),uiRoot=join(installedRoot,'bw-circuit-ui');
        mkdirSync(join(uiRoot,'bin'),{recursive:true});writeFileSync(join(uiRoot,'package.json'),uiManifestBytes);
        writeFileSync(join(uiRoot,'bin/bwc.mjs'),'throw new Error("process doubles never execute this marker");\n');
        const admissionFile=join(parent,'admission.json');copyFileSync(join(template,'event-admission.json'),admissionFile);
        const envNames=['GITHUB_RUN_ID','GITHUB_RUN_ATTEMPT','GITHUB_SHA','GITHUB_REF','BW_BOARD','NODE_PATH','NODE_OPTIONS'];
        const previous=Object.fromEntries(envNames.map(k=>[k,process.env[k]]));
        Object.assign(process.env,{GITHUB_RUN_ID:RUN,GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:HEAD,
            GITHUB_REF:'refs/heads/study/reference-qualified-v2',BW_BOARD:'',NODE_PATH:'',NODE_OPTIONS:''});
        let calls=0;
        const execute=(executable,args,options)=>{
            assert.equal(executable,'/usr/bin/prlimit');calls++;
            const split=args.indexOf('--'),program=args[split+1],argv=args.slice(split+2),dir=options.cwd;
            if(program==='/usr/bin/ngspice'&&argv[0]==='--version')return {status:0,stdout:'ngspice-42\n',stderr:''};
            const c=manifest.cases.find(c=>dir.endsWith('/'+c.id));assert.ok(c,'command names an admitted case');
            if(program==='/usr/bin/ngspice') {
                for(const file of ['reference-raw.txt',...(c.route==='measure'?['reference-grid.txt']:[])])copyFileSync(join(template,c.id,file),join(dir,file));
                return {status:0,stdout:'',stderr:''};
            }
            assert.equal(program,process.execPath);
            if(argv[2]==='convert') {
                assert.equal(argv[4],'--to');assert.equal(argv[5],'json');assert.equal(argv[6],'-o');
                writeFileSync(argv[7],JSON.stringify(JSON.parse(readFileSync(argv[3],'utf8')),null,1)+'\n');
                return {status:0,stdout:'synthetic conversion\n',stderr:''};
            }
            if(c.eligibility==='expected-refusal')return {status:c.refusal.exitCode,stdout:'',stderr:c.refusal.stderrIncludes+'\n'};
            const stdout=readFileSync(join(template,c.id,'cli.stdout'),'utf8');
            if(c.route==='measure') {
                copyFileSync(join(template,c.id,'capture.csv'),join(dir,'capture.csv'));
                const receipt=get(template,c.id+'/receipt.json');
                receipt.engine.observed.root=join(installedRoot,'bw-board');receipt.cli.root=uiRoot;
                receipt.invocation={executable:process.execPath,nodeVersion:process.version,cwd:dir,argv:argv.slice(2),BW_BOARD:null};
                put(dir,'receipt.json',receipt);
            }
            return {status:0,stdout,stderr:''};
        };
        let summary;
        const packages=get(template,'package-proof.json');
        try {
            summary=await historical.runStudy({output:join(parent,'output'),installedRoot,boardSource:parent,cuiSource:parent,
                admittedIntent:sha256(canonical(manifest)),admissionFile,execute,verifyPackages:()=>packages.proof,
                fingerprintRuntime:root=>root.endsWith('bw-board')?packages.board:packages.ui});
            assert.equal(calls,96,'historical-source control reaches every admitted process double');
            put(historical.root,'vendor-pins.json',{...SOURCES,'bw-board':'0'.repeat(40)});
            const refused=await historical.runStudy({output:join(parent,'changed-pins-output'),
                installedRoot,boardSource:parent,cuiSource:parent,
                admittedIntent:sha256(canonical(manifest)),admissionFile,
                execute:()=>assert.fail('changed pins must refuse before any command'),
                verifyPackages:()=>assert.fail('changed pins must refuse before package admission')});
            assert.match(refused.preflightError,/Consumer source pins changed/);
            assert.equal(refused.evidenceComplete,false);
            assert.equal(refused.counts.missing,32);
            put(historical.root,'vendor-pins.json',SOURCES);
        } finally {
            for(const [key,value]of Object.entries(previous)) {if(value===undefined)delete process.env[key];else process.env[key]=value;}
        }
        assert.equal(calls,96,'32 loads +32 requested measurements +31 references +1 version; all process doubles');
        assert.equal(summary.evidenceComplete,true);assert.equal(summary.numericalConformance,true);
        assert.equal(summary.counts.passed,31);assert.equal(summary.counts.refused,1);
        const independent=historicalRead(join(parent,'output'));assert.equal(independent.status,0,independent.stderr+independent.stdout);
        assert.equal(JSON.parse(independent.stdout).physicalCalibration,false);
    });


test('native current-source injection is explicitly reversed from the SPICE tail-sink card',()=>{
    const pair=manifest.cases.find(c=>c.id==='long-tailed-differential-pair');
    const native=pair.modelParameters.find(p=>p.id==='IT');
    const card=pair.reference.cards.find(line=>line.startsWith('IT ')).split(/\s+/);
    assert.equal(card[1],'TAIL');assert.equal(card[2],'0');
    const spice=Number(card[3]);assert.ok(spice>0,'reference takes current out of tail');
    assert.equal(native.params.amps,-spice,'native injection must take current out of the shared emitter');
});
test('capture design counts distinguish requests from actual numerical passes',()=>{
    const results=manifest.cases.map(c=>({id:c.id,status:c.eligibility==='expected-refusal'?'expected-refusal':'pass',cliAttemptRecorded:true,checks:[]}));
    const index=manifest.cases.findIndex(c=>c.id==='loaded-rc-lowpass');results[index].status='disagree';
    const summary=summarize(manifest,results);
    assert.equal(summary.requestedScopeDmmDesigns,15);assert.equal(summary.passedScopeDmmDesigns,14);
    assert.equal(summary.counts.recordedCliAttempts,32);assert.equal(summary.counts.inputs,32);
    assert.equal(summary.evidenceComplete,true);assert.equal(summary.numericalConformance,false);
});


test('actual collector preserves a preflight failure as independently readable incomplete evidence',
    {skip:process.versions.node.split('.')[0]!=='22'?'collector runtime admission requires Node22; executed by the source-controls workflow':false},async t=>{
        const template=fixture(t),parent=mkdtempSync(join(tmpdir(),'reference-preflight-'));
        const historical=await historicalCollector(t);
        const historicalRead=output=>reader(output,HEAD,RUN,historical.root);
        t.after(()=>rmSync(parent,{recursive:true,force:true}));
        const admissionFile=join(parent,'admission.json');copyFileSync(join(template,'event-admission.json'),admissionFile);
        const values={GITHUB_RUN_ID:RUN,GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:HEAD,
            GITHUB_REF:'refs/heads/study/reference-qualified-v2',BW_BOARD:'',NODE_PATH:'',NODE_OPTIONS:''};
        const previous=Object.fromEntries(Object.keys(values).map(k=>[k,process.env[k]]));
        Object.assign(process.env,values);let calls=0;
        const output=join(parent,'output');let summary;
        try {
            summary=await historical.runStudy({output,installedRoot:parent,boardSource:parent,cuiSource:parent,
                admittedIntent:sha256(canonical(manifest)),admissionFile,
                verifyPackages:()=>{throw 'synthetic package admission refusal: '+ '🧪'.repeat(5000);},
                execute:()=>{calls++;throw new Error('no process may run before package admission');}});
        } finally {for(const [k,v] of Object.entries(previous)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
        assert.equal(calls,0);assert.equal(summary.counts.missing,32);
        assert.equal(Array.from(summary.preflightError).length,4096);
        assert.ok(readFileSync(join(output,'preflight-error.txt'),'utf8').length>5000);
        assert.equal(summary.evidenceComplete,false);assert.equal(summary.numericalConformance,false);
        const report=historicalRead(output);assert.equal(report.status,2,report.stderr+report.stdout);
        const decoded=JSON.parse(report.stdout);assert.equal(decoded.preflightFailureRecorded,true);
        assert.equal(decoded.failureCauseIndependentlyEstablished,false);
        const saved=get(output,'summary.json'),rows=get(output,'results.json');
        for(const [name,invalid,pattern] of [['summary.json',[],/summary must/],['results.json',{},/results must/],['results.json',[1],/results must/]]) {
            put(output,name,invalid);syncInventory(output);const bad=historicalRead(output);
            assert.equal(bad.status,3);assert.match(bad.stderr,pattern);
            put(output,'summary.json',saved);put(output,'results.json',rows);
        }
        saved.numericalConformance=true;put(output,'summary.json',saved);syncInventory(output);
        const forged=historicalRead(output);assert.equal(forged.status,3);assert.match(forged.stderr,/preflight incomplete summary/);
        saved.numericalConformance=false;put(output,'summary.json',saved);
        mkdirSync(join(output,manifest.cases[0].id));put(output,manifest.cases[0].id+'/cli.stdout','hidden attempt');syncInventory(output);
        const hidden=historicalRead(output);assert.equal(hidden.status,3);assert.match(hidden.stderr,/conceal case execution/);
    });


test('frozen capture requests respect the actual CLI rate before event selection',()=>{
    for(const c of manifest.cases.filter(c=>c.route==='measure'))assert.equal(validateCaptureClock(c.clock),c.clock);
    const opamps=manifest.cases.filter(c=>c.family==='lm741');assert.equal(opamps.length,6);
    for(const c of opamps){assert.equal(c.clock.durationNs,20000);assert.equal(c.clock.rateHz,2e6);assert.equal(c.clock.count,40);assert.equal(c.maxStepNs,20);}
    assert.throws(()=>validateCaptureClock({durationNs:20000,intervalNs:100,count:200,firstSampleNs:100,rateHz:1e7}),/CLI.*2 MHz/);
    assert.throws(()=>validateCaptureClock({durationNs:20000,intervalNs:100,count:200,firstSampleNs:100,rateHz:2e6}),/rate\/interval mismatch/);
    assert.equal(manifest.cases.at(-1).refusal.exitCode,2);
});
