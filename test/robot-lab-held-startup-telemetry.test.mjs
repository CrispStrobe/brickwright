// SPDX-License-Identifier: BSD-3-Clause
// Actual source-controller argument plumbing only: no browser/VM/engine/archive execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {EventEmitter} from 'node:events';
import {heldStartupDiagnostic,heldStartupFailureSnapshot} from '../scripts/lib/sim-lab-q5-held.mjs';

// These controls stop at recorder installation. Refuse any archive operation
// and omit rendering at the fake-page boundary. Neither supplies runtime qualification.
const archive = 'data:text/javascript,' + encodeURIComponent('export default class RefusedArchive { constructor(){throw Error("archive operation outside source control");} static loadAsync(){throw Error("archive operation outside source control");} }');
const rendering = 'data:text/javascript,' + encodeURIComponent('export const captureRenderedModel=async()=>{}; export const captureUiScreenshot=async()=>{};');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(specifier, context, next) { if (specifier === 'jszip') return {url:${JSON.stringify(archive)},shortCircuit:true}; if(specifier.endsWith('/sim-lab-rendered-model-gate.mjs'))return {url:${JSON.stringify(rendering)},shortCircuit:true}; return next(specifier, context); }`), import.meta.url);
const {q5BrowserInteractions}=await import('../scripts/lib/sim-lab-q5-browser-gate.mjs');
const {mechanicsInteractions}=await import('../scripts/lib/sim-lab-mechanics-gate.mjs');

const coldWindow=()=>{
    const mechanism={bodies:[{id:'fixed',motion:'static'},{id:'actual-output',motion:'dynamic'}],
        joints:[{id:'actual-hinge',type:'hinge'},{id:'actual-slider',type:'slider'},{id:'ball',type:'ball'}]};
    const vm={runtime:{targets:[{getName:()=> 'fixture',blocks:{_blocks:{start:{opcode:'robotlab_start',shadow:false}}}}]}};
    return {__bwSimLab:{status:'ready',_pane:{state:{modelFile:'solstice-pumpjack.ldr'},loadToken:0,
        session:{worker:true,time:0,core:{time:0},model:{parts:[]},mechanism},props:{vm}}}};
};
const withWindow=(window,run)=>{const before=globalThis.window;globalThis.window=window;try{return run();}finally{if(before===undefined)delete globalThis.window;else globalThis.window=before;}};

test('serialized held selector reads actual cold worker IDs and retains the fixed observation bound',()=>{
    const window=coldWindow(),serialized=(0,eval)('('+heldStartupDiagnostic.toString()+')');
    const selected=withWindow(window,()=>serialized('solstice-pumpjack'));
    assert.deepEqual(selected,{bodies:['actual-output'],joints:['actual-hinge','actual-slider'],stopSeconds:0.55});
    selected.bodies[0]='changed';assert.equal(window.__bwSimLab._pane.session.mechanism.bodies[1].id,'actual-output');
});

test('selector refuses ordinary IDs, wrong/late/absent workers and out-of-bound selections',()=>{
    assert.throws(()=>heldStartupDiagnostic('evenhand'),/explicit held Solstice/);
    for(const alter of [w=>{w.__bwSimLab.status='running';},w=>{w.__bwSimLab._pane.state.modelFile='other.ldr';},
        w=>{w.__bwSimLab._pane.session.worker=false;},w=>{w.__bwSimLab._pane.session.time=1;},
        w=>{w.__bwSimLab._pane.session.core.time=0.005;},w=>{w.__bwSimLab._pane.session._disposed=true;},
        w=>{w.__bwSimLab._pane.session.mechanism.bodies=Array.from({length:7},(_,i)=>({id:String(i),motion:'dynamic'}));},
        w=>{w.__bwSimLab._pane.session.mechanism.joints=Array.from({length:8},(_,i)=>({id:String(i),type:'hinge'}));},
        w=>{w.__bwSimLab._pane.session.mechanism.bodies=Array.from({length:17},(_,i)=>({id:String(i),motion:i?'static':'dynamic'}));},
        w=>{w.__bwSimLab._pane.session.mechanism.joints=Array.from({length:33},(_,i)=>({id:String(i),type:i?'ball':'hinge'}));},
        w=>{w.__bwSimLab._pane.session.mechanism.bodies=Array(1);},
        w=>{w.__bwSimLab._pane.session.mechanism.joints[1].id='actual-hinge';}]){
        const window=coldWindow();alter(window);assert.throws(()=>withWindow(window,()=>heldStartupDiagnostic('solstice-pumpjack')));
    }
});

class Page extends EventEmitter {
    constructor(kind,recorders){super();this.kind=kind;this.recorders=recorders;this.window=coldWindow();this.boundary=Error(kind+' recorder boundary');}
    context(){return{browser:()=>({newPage:async()=>this.control})};}
    getByTestId(){return this.locator();}
    locator(){const page=this;return{click:async()=>{},check:async()=>{},fill:async()=>{},selectOption:async()=>{},
        count:async()=>1,waitFor:async()=>{},getByRole:()=>page.locator(),locator:()=>page.locator(),
        setInputFiles:async({name})=>{page.window.__bwSimLab._pane.state.modelFile=name;}};}
    async waitForFunction(){}
    async screenshot(){}
    async evaluate(fn,arg){
        if(fn.name==='installBrowserMechanicsRecorder'){
            this.recorders.push({kind:this.kind,args:arg});
            if(this.failAfterRecorder){
                this.window.__bwMechanics={mechanism:this.window.__bwSimLab._pane.session.mechanism,start:0,startupDiagnostic:structuredClone(this.partial)};
                this.recorderInstalled=true;return;
            }
            throw this.boundary;
        }
        return withWindow(this.window,()=>fn(arg));
    }
    async close(){this.closed=true;}
}
const scratch=()=>mkdtempSync(join(fileURLToPath(new URL('../..',import.meta.url)),'.held-startup-source-'));

test('actual held base route forwards startup selection, while disconnected control retains its original recorder options',async()=>{
    const dir=scratch(),recorders=[],main=new Page('main',recorders),control=new Page('control',recorders);main.control=control;
    try{
        await assert.rejects(q5BrowserInteractions(main,{shotsDir:join(dir,'held'),openSimLab:async()=>{}},'solstice-pumpjack'),error=>
            error instanceof AggregateError && error.errors[0]===main.boundary && error.errors[1]===control.boundary);
        assert.deepEqual(recorders.map(r=>r.kind),['main','control']);
        assert.deepEqual(recorders[0].args.startupDiagnostic,{bodies:['actual-output'],joints:['actual-hinge','actual-slider'],stopSeconds:0.55});
        assert.equal(recorders[0].args.extended,true);assert.equal(recorders[0].args.observeProgram,true);
        assert.equal(Object.hasOwn(recorders[1].args,'startupDiagnostic'),false);
        assert.equal(control.closed,true);
    }finally{rmSync(dir,{recursive:true,force:true});}
});

test('actual ordinary gate ignores held callback injection and keeps recorder keys/order unchanged',async()=>{
    const dir=scratch(),recorders=[],page=new Page('ordinary',recorders);
    try{
        await assert.rejects(q5BrowserInteractions(page,{shotsDir:join(dir,'ordinary'),openSimLab:async()=>{},
            startupDiagnosticFor:()=>{throw Error('ordinary callback must not run');}},'evenhand'),error=>error===page.boundary);
        assert.deepEqual(Object.keys(recorders[0].args),['recordKey','captureKey','extended','observeProgram','observeDynamics','stepParts']);
    }finally{rmSync(dir,{recursive:true,force:true});}
});

test('generic mechanics helper default still forwards no startup option',async()=>{
    const dir=scratch(),recorders=[],page=new Page('default',recorders);
    try{
        await assert.rejects(mechanicsInteractions(page,{shotsDir:dir,openSimLab:async()=>{},models:['crank-rocker']}),error=>error===page.boundary);
        assert.equal(Object.hasOwn(recorders[0].args,'startupDiagnostic'),false);
    }finally{rmSync(dir,{recursive:true,force:true});}
});

test('held timeout after recorder installation preserves bounded partial startup packets and original failures',async()=>{
    const dir=scratch(),recorders=[],main=new Page('main-timeout',recorders),control=new Page('control',recorders);main.control=control;
    main.failAfterRecorder=true;
    const row=(t,stepSeconds)=>({t,stepSeconds,bodies:[{id:'actual-output',pose:{position:[0,0,0],rotation:[0,0,0,1]}}],
        joints:[{id:'actual-hinge',state:{angle:0}},{id:'actual-slider',state:{position:0}}]});
    main.partial={qualification:false,selection:{revision:1,bodies:['actual-output'],joints:['actual-hinge','actual-slider'],stopSeconds:0.55},
        packets:[{status:'observed',qualification:false,packet:{initial:row(0,null),samples:[row(0.005,0.005)]}}],stopped:false};
    main.waitForFunction=async()=>{if(main.recorderInstalled)throw main.boundary;};
    try{
        await assert.rejects(q5BrowserInteractions(main,{shotsDir:join(dir,'held'),openSimLab:async()=>{}},'solstice-pumpjack'),error=>
            error instanceof AggregateError && error.errors[0]===main.boundary && error.errors[1]===control.boundary);
        const saved=JSON.parse(readFileSync(join(dir,'held','solstice-pumpjack-base-startup-partial.json'),'utf8'));
        assert.equal(saved.status,'captured');assert.equal(saved.qualification,false);
        assert.equal(saved.sessionMatchesRecord,true);assert.deepEqual(saved.diagnostic,main.partial);
        assert.deepEqual(main.window.__bwMechanics.startupDiagnostic,main.partial,'failure persistence does not drain or reset captured observations');
        assert.equal(control.closed,true);
    }finally{rmSync(dir,{recursive:true,force:true});}
});

test('serialized failure snapshot copies captured packets, reports absence honestly and refuses unbounded state',()=>{
    const window=coldWindow(),serialized=(0,eval)('('+heldStartupFailureSnapshot.toString()+')');
    assert.equal(withWindow(window,()=>serialized()).status,'not-observed');
    const partial={qualification:false,selection:{bodies:['actual-output'],joints:['actual-hinge'],stopSeconds:0.55},
        packets:[{packet:{initial:{bodies:[],joints:[]},samples:[]}}],stopped:false};
    window.__bwMechanics={mechanism:window.__bwSimLab._pane.session.mechanism,startupDiagnostic:partial};
    const saved=withWindow(window,()=>serialized());
    assert.equal(saved.status,'captured');assert.equal(saved.qualification,false);
    saved.diagnostic.selection.bodies[0]='mutated';assert.equal(partial.selection.bodies[0],'actual-output');
    partial.packets=Array.from({length:112},()=>({packet:null}));
    assert.throws(()=>withWindow(window,()=>serialized()),/exceeds diagnostic bounds/);
    partial.packets=[{packet:{initial:{bodies:Array(7).fill({}),joints:[]},samples:[]}}];
    assert.throws(()=>withWindow(window,()=>serialized()),/exceeds diagnostic bounds/);
});
