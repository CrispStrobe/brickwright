import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadCircuitModel} from '../scripts/lib/polarity-oracle.mjs';

const root=path.resolve(import.meta.dirname,'..');
const boardPin='818e0263fecd320d39737a580b7a73d562603c2e';
const packageSpec=`github:CrispStrobe/bw-board#${boardPin}`;
const fixture=JSON.parse(readFileSync(path.join(root,'test/fixtures/adp7118-fixed-regulator.json'),'utf8'));
const terminals=['vout_1','vout_2','sense_adj','gnd','en','ss','vin_7','vin_8'];
const near=(a,b,tolerance,label)=>assert.ok(Math.abs(a-b)<=tolerance,`${label}: ${a} versus ${b}`);

function limiterFixture(R=500,C=22e-6,inputR=4){
    const data=structuredClone(fixture);
    Object.assign(data.parts.find(p=>p.id==='u1').params,
        {startupModel:'current-limited-envelope',rOut:.05,currentLimit:.36});
    data.parts.find(p=>p.id==='load').params.ohms=R;
    data.parts.push({id:'cout',kind:'capacitor',params:{farads:C},x:800,y:430});
    if(inputR>0){
        data.parts.push({id:'rin',kind:'resistor',params:{ohms:inputR},x:330,y:180});
        for(const wire of data.wires){
            if(wire.from==='vin'&&wire.fromTerminal==='pos'&&wire.to==='u1'){
                wire.from='rin';wire.fromTerminal='b';
            }
        }
        data.wires.push({from:'vin',fromTerminal:'pos',to:'rin',toTerminal:'a'});
    }
    data.wires.push({from:'cout',fromTerminal:'a',to:'u1',toTerminal:'vout_1'},
        {from:'cout',fromTerminal:'b',to:'gnd',toTerminal:'gnd'});
    return data;
}

// Authored continuous RC oracle; no installed model code or simulated
// waveform is used to choose transition roots or the capture-window integral.
function oracle(R,C){
    const r=.05,I=.36,tau=300e-6/Math.log(9),duration=.0012;
    const delay=Math.round((80e-6+tau*Math.log(.9))*1e9)/1e9;
    const k=R/(R+r),rho=C*R*r/(R+r);
    const target=x=>5*(1-Math.exp(-x/tau));
    const linear=x=>5*k*(1-(tau*Math.exp(-x/tau)-rho*Math.exp(-x/rho))/(tau-rho));
    const bisect=(f,a,b)=>{for(let n=0;n<70;n++){const m=(a+b)/2;if(f(m)>0)b=m;else a=m;}return(a+b)/2;};
    let entry=null,release=null;
    const f=x=>target(x)-linear(x)-r*I;
    for(let x=1e-6;x<=duration;x+=1e-6)if(f(x)>0){entry=bisect(f,x-1e-6,x);break;}
    const limited=x=>I*R+(linear(entry)-I*R)*Math.exp(-(x-entry)/(R*C));
    if(entry!==null){const g=x=>-(target(x)-limited(x)-r*I);
        for(let x=entry+1e-6;x<=duration;x+=1e-6)if(g(x)>0){release=bisect(g,x-1e-6,x);break;}}
    const P=x=>5*k*(1-tau*Math.exp(-x/tau)/(tau-rho));
    const voltage=t=>{const x=t-delay;if(x<=0)return 0;if(entry===null||x<=entry)return linear(x);
        if(release===null||x<=release)return limited(x);
        return P(x)+(limited(release)-P(release))*Math.exp(-(x-release)/rho);};
    const F0=x=>5*k*(x+(tau*tau*Math.exp(-x/tau)-rho*rho*Math.exp(-x/rho))/(tau-rho));
    const F1=x=>I*R*x-(linear(entry)-I*R)*R*C*Math.exp(-(x-entry)/(R*C));
    const F2=x=>5*k*(x+tau*tau*Math.exp(-x/tau)/(tau-rho))
        -(limited(release)-P(release))*rho*Math.exp(-(x-release)/rho);
    const integrate=(f,a,b)=>f(b)-f(a),x=duration-delay,
        e=entry===null?x:Math.min(x,entry),l=release===null?x:Math.min(x,release);
    const integral=integrate(F0,0,e)+(entry===null||x<=entry?0:integrate(F1,entry,l))
        +(release===null||x<=release?0:integrate(F2,release,x));
    return {voltage,mean:integral/duration,entry:entry===null?null:entry+delay,
        release:release===null?null:release+delay};
}

function endpointNet(board,part,terminal){
    const found=board.nets.find(n=>n.terminals.some(t=>t.part===part&&t.terminal===terminal));
    assert.ok(found,`${part}.${terminal} must have an actual installed net`);
    return found.id;
}

function observations(board,solution=null){
    const branch=(part,t)=>solution?solution.branchCurrents.get(part)?.get(t)??0:board.branchCurrent(part,t);
    const volts=(part,t)=>{const id=endpointNet(board,part,t);return solution?solution.nodeVoltages.get(id)??0:board.nodeVoltage(id);};
    const q=branch('u1','vout_1')+branch('u1','vout_2');
    const input=-branch('u1','vin_7')-branch('u1','vin_8');
    const iq=50e-6+130e-6*Math.min(q,.2)/.2;
    assert.ok(q>=-1e-9&&q<=.36+1e-8,`installed output ceiling: ${q}`);
    near(input,q+iq,1e-10,'installed within-solve VIN current');
    near(branch('u1','gnd'),iq,1e-10,'installed GND IQ');
    near(terminals.reduce((sum,t)=>sum+branch('u1',t),0),0,1e-10,'installed package KCL');
    near(q+branch('load','a')+branch('cout','a'),0,1e-10,'installed output/capacitor/load KCL');
    near(volts('u1','vin_7')-volts('u1','gnd'),8-4*input,1e-9,'installed finite source drop');
    near(volts('u1','vin_7'),volts('u1','vin_8'),1e-12,'coincident input leads');
    near(volts('u1','vout_1'),volts('u1','vout_2'),1e-12,'coincident output leads');
    return {q,output:volts('u1','vout_1')-volts('u1','gnd')};
}

async function installedCircuit(R,C){
    const {Circuit}=await loadCircuitModel(root);
    const c=Circuit.fromJSON(limiterFixture(R,C));
    assert.equal(c.netlistError,null);
    assert.equal(c.board.getDeviceState('u1').startupModel,'current-limited-envelope');
    return c;
}

test('limiter adoption selects the exact pinned installed package rather than a board override',()=>{
    const pins=JSON.parse(readFileSync(path.join(root,'vendor-pins.json'),'utf8'));
    assert.equal(pins['bw-board'],boardPin);
    assert.equal(pins['bw-circuit-ui'],'659431ce46a7b6d4ae472182b069ec301aee0df3');
    const pkg=JSON.parse(readFileSync(path.join(root,'package.json'),'utf8'));
    assert.equal(pkg.devDependencies['bw-board'],packageSpec);
    const lock=JSON.parse(readFileSync(path.join(root,'package-lock.json'),'utf8'));
    assert.ok(lock.packages['node_modules/bw-board'].resolved.endsWith(`#${boardPin}`));
});

// bw-board ROUND 3 (a685b22): the default profile (interactive-v2) scales its
// step-doubling estimate by the Richardson factor 1/(2^p - 1), so its steps
// spend the stated tolerance instead of a third of it. The interactive
// overload sample tolerance 1e-4 -> 2e-4 (measured 1.45e-4 near 3.4 V, where the
// profile's own local scale is 1e-6 + 1e-4*3.4 = 3.4e-4) and inrush 5e-6 -> 2e-5
// (measured 1.4e-5 at 4.27 V), as in bw-board's own adp7118 test. The
// precision-v1 rows keep their recorded tolerances.
for(const [R,C,sampleTolerance,meanTolerance,precision,inputR=4] of [
    [10,2.2e-6,2e-4,3e-5,false],[500,22e-6,2e-5,1e-5,false],
    [10,2.2e-6,5e-7,1e-6,true],[500,22e-6,5e-7,1e-6,true],
    // Ideal-supply linear startup exposed the old endpoint-only meter mean.
    [500,2.2e-6,5e-7,1e-6,true,0],
]){
    test(`installed CLI publishes qualified ${precision?'precision':'interactive'} ${R} ohm / ${C} F${inputR===0?' / ideal supply':''} limiter scope, meter, CSV and receipt`,async t=>{
        const dir=mkdtempSync(path.join(tmpdir(),'lite-limiter-cli-'));
        const env={...process.env};delete env.BW_BOARD;
        try{
            const input=path.join(dir,'input.json'),csv=path.join(dir,'scope.csv'),receiptPath=path.join(dir,'receipt.json');
            writeFileSync(input,JSON.stringify(limiterFixture(R,C,inputR)));
            const result=spawnSync(process.execPath,[path.join(root,'node_modules/bw-circuit-ui/bin/bwc.mjs'),
                'measure',input,'--scope','u1.vout_1,gnd.gnd','--meter','voltage:u1.vout_1,gnd.gnd',
                '--duration','1200us','--rate','100kHz','--csv',csv,'--receipt',receiptPath,'--json',
                ...(precision?['--profile','precision-v1','--initial','zero-state']:[])],
            {encoding:'utf8',env,timeout:30000});
            assert.equal(result.error,undefined);assert.equal(result.status,0,result.stderr);
            const report=JSON.parse(result.stdout),expected=oracle(R,C);
            assert.equal(report.transient.accuracyMet,true);assert.equal(report.transient.failure,null);
            assert.equal(report.transient.profile.maxAttempts,20000);
            if(precision){
                assert.equal(report.transient.profile.id,'precision-v1');
                assert.equal(report.precisionCapture.basis,'engine-whole-advance-adp7118-current-limited');
                const bounded=report.transient.boundedAdvance;
                assert.equal(bounded.completed,true);assert.equal(bounded.failure,null);
                assert.equal(bounded.requestedTimeNs,'1200000');
                assert.deepEqual(bounded.limits,{maxAttempts:20000,maxSolves:60001,maxAdvances:200});
                for(const [counter,limit] of [['attempts',20000],['solves',60001],['advances',200]]){
                    assert.ok(Number.isSafeInteger(bounded.work[counter])&&bounded.work[counter]>0);
                    assert.ok(bounded.work[counter]<=limit);
                }
                assert.ok(bounded.work.advances>100,'real timed-device subdivisions charged together');
            }
            assert.equal(report.scope[0].summary.samples,120);
            const rows=readFileSync(csv,'utf8').trim().split('\n');
            assert.equal(rows.length,122);assert.match(rows[0],/startTimeNs=10000/);
            let maxError=0;
            for(const [i,row] of rows.slice(2).entries()){
                const [elapsed,value]=row.split(',').map(Number);
                assert.equal(elapsed,i*10000/1e9);assert.ok(Number.isFinite(value));
                near(value,expected.voltage(10e-6+elapsed),sampleTolerance,`installed CSV sample ${i}`);
                maxError=Math.max(maxError,Math.abs(value-expected.voltage(10e-6+elapsed)));
            }
            assert.equal(report.meters[0].quantity,'observed-dc-mean');
            near(report.meters[0].reading.siValue,expected.mean,meanTolerance,'installed capture-window mean');
            assert.ok(Math.abs(report.meters[0].reading.siValue-report.scope[0].summary.lastVolts)>.3);
            if(R===10){near(expected.entry,217.30757602325912e-6,1e-12,'independent overload entry');assert.equal(expected.release,null);}
            else if(C===2.2e-6){assert.equal(expected.entry,null);assert.equal(expected.release,null);}
            else{near(expected.entry,66.26866414968961e-6,1e-12,'independent inrush entry');
                near(expected.release,329.1432340371157e-6,1e-12,'independent release');}
            const receipt=JSON.parse(readFileSync(receiptPath,'utf8'));
            assert.equal(receipt.engine.selection,'installed package');assert.equal(receipt.invocation.BW_BOARD,null);
            // CUI records its own development declaration separately from the
            // observed installed engine. Its unchanged peer permits the host's
            // newer pinned Board; a declaration is not installed-byte identity.
            const cuiPackage=JSON.parse(readFileSync(path.join(root,'node_modules/bw-circuit-ui/package.json'),'utf8'));
            assert.equal(receipt.engine.declaredPackageSpec,cuiPackage.devDependencies['bw-board']);
            const {runtimeReceipt}=await import(path.join(root,'node_modules/bw-circuit-ui/src/model/measurement-receipt.js'));
            assert.deepEqual(receipt.engine.observed,runtimeReceipt(path.join(root,'node_modules/bw-board')));
            assert.deepEqual(receipt.report,report);
            const verified=spawnSync(process.execPath,[path.join(root,'node_modules/bw-circuit-ui/bin/bwc.mjs'),
                'verify-receipt',receiptPath,'--input',input,'--csv',csv,'--json'],
            {encoding:'utf8',env,timeout:30000});
            assert.equal(verified.error,undefined);assert.equal(verified.status,0,verified.stderr);
            const identity=JSON.parse(verified.stdout);
            assert.equal(identity.status,'match');assert.ok(identity.checks.every(check=>check.match));
            assert.equal(identity.limits.identityOnly,true);assert.equal(identity.limits.numericalAgreement,false);
            t.diagnostic(JSON.stringify({R,C,inputR,samples:120,maxError,meanError:report.meters[0].reading.siValue-expected.mean}));
        }finally{rmSync(dir,{recursive:true,force:true});}
    });
}

for(const [R,C] of [[10,2.2e-6],[500,22e-6]]){
    test(`installed precision stream preserves provisional clocks and independent ${R} ohm / ${C} F waveform, mean and current`,()=>{
        const dir=mkdtempSync(path.join(tmpdir(),'lite-limiter-stream-'));
        const env={...process.env};delete env.BW_BOARD;
        try{
            const input=path.join(dir,'input.json');writeFileSync(input,JSON.stringify(limiterFixture(R,C)));
            const expected=oracle(R,C),cli=path.join(root,'node_modules/bw-circuit-ui/bin/bwc.mjs');
            for(const [rate,step] of [['100kHz',10000n],['45kHz',22222n]]){
                const receiptPath=path.join(dir,`${rate}.json`);
                const result=spawnSync(process.execPath,[cli,'measure',input,'--watch',
                    '--scope','u1.vout_1,gnd.gnd','--meter','voltage:u1.vout_1,gnd.gnd',
                    ...['vout_1','vout_2','vin_7','vin_8','gnd'].flatMap(pin=>['--meter',`current:u1.${pin}`]),
                    '--duration','1200us','--rate',rate,'--profile','precision-v1','--initial','zero-state',
                    '--receipt',receiptPath],{encoding:'utf8',env,timeout:30000});
                assert.equal(result.error,undefined);assert.equal(result.status,0,result.stderr);
                const rows=result.stdout.trim().split('\n').map(JSON.parse),summary=rows.pop();
                assert.equal(summary.recordType,'summary');assert.equal(summary.qualified,true);
                assert.equal(rows.length,Number((1200000n+step-1n)/step));
                for(const [index,row] of rows.entries()){
                    const time=(BigInt(index+1)*step)>1200000n?1200000n:BigInt(index+1)*step;
                    const scopeTime=Number(time/step*step)/1e9;
                    assert.equal(row.recordType,'sample');assert.equal(row.qualified,false);assert.equal(row.index,index);
                    assert.equal(row.timeSeconds,Number(time)/1e9);assert.equal(row.scope[0].timeSeconds,scopeTime);
                    near(row.scope[0].volts,expected.voltage(scopeTime),5e-7,`stream ${rate} point ${index}`);
                }
                const report=summary.report,bounded=report.transient.boundedAdvance;
                assert.equal(bounded.completed,true);assert.equal(bounded.failure,null);
                assert.equal(bounded.requestedTimeNs,'1200000');
                assert.deepEqual(bounded.limits,{maxAttempts:20000,maxSolves:60001,maxAdvances:200});
                assert.deepEqual(bounded.stream,{stepNs:String(step),observerCalls:rows.length});
                for(const [key,limit] of [['attempts',20000],['solves',60001],['advances',200]]){
                    assert.ok(Number.isSafeInteger(bounded.work[key])&&bounded.work[key]>0&&bounded.work[key]<=limit);
                }
                near(report.meters[0].reading.siValue,expected.mean,1e-6,'stream capture-window mean');
                const current=Object.fromEntries(report.meters.slice(1).map(row=>[row.probes[0].split('.')[1],row.reading.siValue]));
                near(current.vout_1+current.vout_2,expected.mean/R+C*expected.voltage(.0012)/.0012,2e-6,'stream output/load/storage delivery');
                near(Object.values(current).reduce((sum,value)=>sum+value,0),0,1e-9,'stream mean terminal KCL');
                const receipt=JSON.parse(readFileSync(receiptPath,'utf8'));
                assert.equal(receipt.engine.selection,'installed package');assert.equal(receipt.invocation.BW_BOARD,null);
                assert.equal(receipt.acquisition,'watch');assert.equal(receipt.exitCode,0);
                assert.deepEqual(receipt.report,report);
            }
        }finally{rmSync(dir,{recursive:true,force:true});}
    });
}

test('installed precision stream has real late aggregate refusal and rejects an ordinary-advance bypass without success artifacts',()=>{
    const dir=mkdtempSync(path.join(tmpdir(),'lite-limiter-stream-failure-'));
    const env={...process.env};delete env.BW_BOARD;
    try{
        const input=path.join(dir,'input.json');writeFileSync(input,JSON.stringify(limiterFixture()));
        const cli=path.join(root,'node_modules/bw-circuit-ui/bin/bwc.mjs');
        for(const [name,rate,preload,reason] of [
            ['actual-aggregate-cap','90kHz',null,/whole-advance work budget exceeded/],
            ['ordinary-bypass','100kHz',`import {BoardImpl} from ${JSON.stringify(pathToFileURL(path.join(root,'node_modules/bw-board/src/board.js')).href)};
                BoardImpl.prototype.advanceToBoundedStream=function(t,limits,options){
                    for(let time=options.stepNs;time<=t;time+=options.stepNs){this.advanceTo(time);options.onStep({timeNs:time});}};`,/whole-advance receipt/],
        ]){
            const csv=path.join(dir,`${name}.csv`),receipt=path.join(dir,`${name}.json`),module=path.join(dir,`${name}.mjs`);
            if(preload)writeFileSync(module,preload);
            const result=spawnSync(process.execPath,[...(preload?['--import',module]:[]),cli,'measure',input,
                '--watch','--scope','u1.vout_1,gnd.gnd','--duration','1200us','--rate',rate,
                '--profile','precision-v1','--initial','zero-state','--csv',csv,'--receipt',receipt],
            {encoding:'utf8',env,timeout:30000});
            assert.equal(result.error,undefined);assert.equal(result.status,2,result.stderr);
            const rows=result.stdout.trim().split('\n').map(JSON.parse),failure=rows.pop();
            assert.ok(rows.length>0,'actual provisional readings precede terminal refusal');
            assert.ok(rows.every(row=>row.recordType==='sample'&&row.qualified===false));
            assert.equal(failure.recordType,'failure');assert.equal(failure.qualified,false);
            assert.match(failure.error,reason);
            if(!preload){assert.equal(failure.transient.boundedAdvance.completed,false);
                assert.ok(failure.timeSeconds>0&&failure.timeSeconds<.0012);}
            for(const destination of [csv,receipt]){
                assert.throws(()=>readFileSync(destination),error=>error.code==='ENOENT');
            }
        }
    }finally{rmSync(dir,{recursive:true,force:true});}
});

test('installed Circuit uses coherent accepted-step currents and preserves partitioned limiter trajectories',async t=>{
    const {BoardImpl}=await import(path.join(root,'node_modules/bw-board/src/board.js'));
    const original=BoardImpl.prototype._updateDevices;
    try{
        for(const [R,C] of [[10,2.2e-6],[500,22e-6]]){
            const big=await installedCircuit(R,C),partitioned=await installedCircuit(R,C),expected=oracle(R,C);
            let accepted=0,seenLimit=false,seenRelease=false;
            BoardImpl.prototype._updateDevices=function(atNs,solution,measurementOnly,acceptedTransient){
                if(acceptedTransient){const {q}=observations(this,solution);accepted++;
                    if(q>=.36-1e-9)seenLimit=true;if(seenLimit&&q<.35)seenRelease=true;}
                return original.apply(this,arguments);
            };
            big.board.advanceTo(1200000n);
            assert.ok(accepted>10);assert.equal(seenLimit,true);assert.equal(seenRelease,R===500);
            BoardImpl.prototype._updateDevices=original;
            for(let i=1;i<=120;i++){
                partitioned.board.advanceTo(BigInt(i)*10000n);
                const {output}=observations(partitioned.board);
                near(output,expected.voltage(i*1e-5),R===10?2e-4:5e-6,'installed partitioned analytic output');
            }
            near(observations(big.board).output,observations(partitioned.board).output,1e-7,'installed large versus partitioned');
            assert.equal(big.board.transientAnalysisStatus().accuracyMet,true);
            assert.equal(partitioned.board.transientAnalysisStatus().accuracyMet,true);
            t.diagnostic(JSON.stringify({R,C,accepted,seenLimit,seenRelease}));
        }
    }finally{BoardImpl.prototype._updateDevices=original;}
});

test('installed consumer source-control refusal invalidates prior scope and meter readings',async()=>{
    const {createMeterState,readMeter}=await import(path.join(root,'node_modules/bw-circuit-ui/src/model/multimeter.js'));
    const {readScopeCapture}=await import(path.join(root,'node_modules/bw-circuit-ui/src/model/scope-tools.js'));
    for(const id of ['vin','ven']){
        const c=await installedCircuit(500,22e-6),board=c.board,
            out=endpointNet(board,'u1','vout_1'),gnd=endpointNet(board,'gnd','gnd');
        const meter=createMeterState();meter.probeA.netId=out;meter.probeB.netId=gnd;
        assert.equal(readMeter(meter,c).siValue,0);
        const h=board.addScopeChannel({type:'voltage',netId:out,referenceNetId:gnd,sampleRateHz:100000,capture:'sample'});
        board.advanceTo(100000n);assert.ok(board.getScopeData(h).count>0);
        assert.throws(()=>c.setControl(id,id==='vin'?8:3.3),/ADP7118.*(control|constant|source)/i);
        assert.equal(readMeter(meter,c).siValue,null);assert.equal(readMeter(meter,c).value,'---');
        const scope=readScopeCapture(board,h);assert.equal(scope.data,null);
        assert.match(scope.reason,/measurement unavailable|scope capture refused|circuit solve failed/);
    }
});

test('installed Circuit stored-state prebias refuses before becoming an available observation',async()=>{
    const c=await installedCircuit(500,22e-6),snap=c.board.snapshot();snap.capVoltages=[['cout',1]];
    assert.throws(()=>c.board.restore(snap),/ADP7118.*prebias/i);
    assert.throws(()=>c.board.meterVoltage(endpointNet(c.board,'u1','vout_1'),endpointNet(c.board,'gnd','gnd')),
        /measurement unavailable|circuit solve failed/);
});

test('a zero-sum stale VIN mutation fails accepted installed-consumer observations and restores the package',async()=>{
    const sourcePath=path.join(root,'node_modules/bw-board/src/devices/power.js');
    const originalSource=readFileSync(sourcePath,'utf8');
    const {registerPowerDevices}=await import(sourcePath);
    const {BoardImpl}=await import(path.join(root,'node_modules/bw-board/src/board.js'));
    const dispatcher=BoardImpl.prototype._updateDevices;
    const patches=[["['vin_7', -amps - iq]","['vin_7', -state._inputAmps]"],
        ["['gnd', iq]","['gnd', state._inputAmps - amps]"],
        ["['vin_7', row(-1 - iqSlope)]","['vin_7', new Map()]"],
        ["['gnd', row(iqSlope)]","['gnd', row(-1)]"]];
    let source=originalSource;
    for(const [anchor,replacement] of patches){assert.equal(source.split(anchor).length-1,1);source=source.replace(anchor,replacement);}
    source=source.replace(/from '(\.\.\/[^']+)'/g,(_,relative)=>`from ${JSON.stringify(new URL(relative,pathToFileURL(sourcePath)).href)}`);
    try{
        const mutant=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
        const c=await installedCircuit(500,22e-6);
        mutant.registerPowerDevices();
        let currentFailure=null;
        BoardImpl.prototype._updateDevices=function(atNs,solution,measurementOnly,acceptedTransient){
            if(acceptedTransient){
                near(terminals.reduce((sum,t)=>sum+(solution.branchCurrents.get('u1')?.get(t)??0),0),
                    0,1e-10,'mutant retains whole-device zero-sum bookkeeping');
                try{observations(this,solution);}catch(error){currentFailure=error;throw error;}
            }
            return dispatcher.apply(this,arguments);
        };
        assert.throws(()=>assert.doesNotThrow(()=>c.board.advanceTo(100000n)),{name:'AssertionError'},
            'a device with zero-sum but stale input bookkeeping must fail the actual installed consumer');
        assert.match(currentFailure?.message??'',/installed within-solve VIN current/,
            'the mutant must fail simultaneous VIN authority, not merely whole-device KCL');
    }finally{BoardImpl.prototype._updateDevices=dispatcher;registerPowerDevices();}
    assert.equal(readFileSync(sourcePath,'utf8'),originalSource);assert.equal(BoardImpl.prototype._updateDevices,dispatcher);
    const healthy=await installedCircuit(500,22e-6);healthy.board.advanceTo(100000n);observations(healthy.board);
});
