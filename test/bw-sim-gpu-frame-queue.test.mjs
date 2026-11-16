import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGpuFrameQueue} from '../overlay/scratch-gui/src/lib/bw-sim/view/gpu-frame-queue.js';
function context() {
    let next=0;
    return {SYNC_STATUS:1,SIGNALED:2,SYNC_GPU_COMMANDS_COMPLETE:3,signaled:false,lost:false,deleted:[],
        fenceSync(){return ++next;},deleteSync(f){this.deleted.push(f);},
        getSyncParameter(){return this.signaled?2:0;},isContextLost(){return this.lost;}};
}
const source=readFileSync(new URL('../overlay/scratch-gui/src/lib/bw-sim/view/sim-view3d.js',import.meta.url),'utf8');
const renderMethod=source.slice(source.indexOf('    const render = (snapshot'),source.indexOf('    const dispose = () =>',source.indexOf('    const render = (snapshot')));
const resizeMethod=source.slice(source.indexOf('    const resize = ('),source.indexOf('    // Follow the chassis',source.indexOf('    const resize = (')));
function view(gl,{onDemand=false,changed=()=>true}={}) {
    const queue=createGpuFrameQueue(gl),drawn=[],overlays=[];let pose=null,shown=true;
    const noop=()=>{};
    const dimensions={clientWidth:100,clientHeight:100},sizes=[],browserWindow={devicePixelRatio:1};
    let width=100,height=100,ratio=1,presented=null;
    const renderer={getSize:()=>({x:width,y:height}),getPixelRatio:()=>ratio,
        setPixelRatio:r=>{ratio=r;presented=null;},
        setSize:(w,h)=>{width=w;height=h;presented=null;sizes.push([w,h]);},
        render:()=>{drawn.push(pose);presented=pose;}};
    const camera={updateMatrixWorld:noop,updateProjectionMatrix:noop};
    const scope={gpuFrames:queue,container:dimensions,window:browserWindow,onDemand,changed,renderer,
        Vector2:class{},Vector3:class{},applySnapshot:(_b,s)=>{pose=s.pose;},
        built:{scene:{updateMatrixWorld:noop}},chainMotion:null,simBelts:null,pens:null,
        drawingPreview:null,simRopes:null,simHoses:null,followPartId:null,partCentre:noop,
        followFrame:null,massCentre:()=>null,modelBox:()=>({getCenter:()=>null}),
        camera,controls:{},updateSensors:noop,pulse:{tick:noop},insight:{update:noop},
        measurementRows:()=>shown?[{pose}]:[],measurementOverlay:{update:rows=>overlays.push(rows.map(r=>r.pose))}};
    const {render,resize}=new Function(...Object.keys(scope),`let dirty=true,followed=null;${resizeMethod}${renderMethod}return {render,resize};`)(...Object.values(scope));
    return{render,resize,drawn,queue,overlays,dimensions,browserWindow,sizes,get presented(){return presented;},hideMeasurements:()=>{shown=false;}};
}
test('a pixel-ratio-only resize redraws an otherwise unchanged on-demand scene',()=>{
    const gl=context(),v=view(gl,{onDemand:true,changed:()=>false});
    v.render({pose:1});gl.signaled=true;
    v.browserWindow.devicePixelRatio=2;
    v.render({pose:1});
    assert.deepEqual(v.sizes,[],'logical dimensions did not change');
    assert.deepEqual(v.drawn,[1,1],'a cleared backing buffer gets a replacement frame');
    assert.equal(v.presented,1);
});
test('the public resize API defers a busy buffer and keeps the following frame dirty',()=>{
    const gl=context(),v=view(gl,{onDemand:true,changed:()=>false});
    v.render({pose:1});v.browserWindow.devicePixelRatio=2;
    assert.equal(v.resize(),null,'external resize respects the pending frame');
    assert.equal(v.presented,1);
    gl.signaled=true;
    assert.equal(v.resize(),true,'external resize reports a backing-buffer change');
    assert.equal(v.presented,null);
    v.render({pose:1});
    assert.deepEqual(v.drawn,[1,1],'external resize leaves the next ordinary frame dirty');
    assert.equal(v.resize(),false,'an unchanged resize leaves the buffer intact');
});
test('a layout resize retains the displayed paused frame until the GPU admits its replacement',()=>{
    const gl=context(),v=view(gl,{onDemand:true,changed:()=>false});
    v.render({pose:1});
    v.dimensions.clientHeight=80;
    v.render({pose:2});v.render({pose:3});
    assert.deepEqual(v.sizes,[],'a pending frame prevents destructive canvas resizing');
    assert.equal(v.presented,1,'the old frame remains visible while its fence is pending');
    gl.signaled=true;v.render({pose:4});
    assert.deepEqual(v.sizes,[[100,80]],'resize once when a new frame can be submitted');
    assert.deepEqual(v.drawn,[1,4],'render the latest pose even when the on-demand scene otherwise stayed unchanged');
    assert.equal(v.presented,4);
});
test('the actual Simulate render method coalesces a busy GPU to the latest physical pose',()=>{
    const gl=context(),v=view(gl);
    for(let pose=0;pose<40;pose++)v.render({pose});
    assert.deepEqual(v.drawn,[0],'one frame in flight, no stale-pose backlog');
    assert.deepEqual(v.overlays,[[0]],'measurement labels stay with the rendered pose while the GPU is busy');
    assert.equal(v.queue.pending,1);
    gl.signaled=true;v.render({pose:40});
    assert.deepEqual(v.drawn,[0,40],'draw the latest pose when the GPU finishes');
    assert.deepEqual(v.overlays,[[0],[40]],'measurement labels advance with the newly drawn pose');
});
test('an unchanged on-demand scene can hide measurement labels without another GPU submission',()=>{
    const gl=context(),v=view(gl,{onDemand:true,changed:()=>false});
    v.render({pose:1});v.hideMeasurements();v.render({pose:1});
    assert.deepEqual(v.drawn,[1]);assert.deepEqual(v.overlays,[[1],[]]);
    assert.equal(v.queue.pending,1,'visibility changes do not create an extra frame fence');
});
test('forced captures retain one covering fence and release it on disposal',()=>{
    const gl=context(),v=view(gl);v.render({pose:0});v.dimensions.clientHeight=80;v.render({pose:1},{force:true});
    assert.deepEqual(v.drawn,[0,1]);assert.equal(v.queue.pending,1);assert.deepEqual(gl.deleted,[1]);
    assert.deepEqual(v.sizes,[[100,80]],'forced rendering can resize and submit a replacement immediately');
    v.queue.dispose();assert.equal(v.queue.pending,0);assert.deepEqual(gl.deleted,[1,2]);
});
test('lost contexts discard handles without invalid deletion; WebGL without fences keeps rendering',()=>{
    const gl=context(),q=createGpuFrameQueue(gl);q.submitted();gl.lost=true;
    assert.equal(q.busy(),false);q.dispose();assert.deepEqual(gl.deleted,[]);
    const legacy=context();delete legacy.fenceSync;const v=view(legacy);
    v.render({pose:1});v.render({pose:2});assert.deepEqual(v.drawn,[1,2]);assert.equal(v.queue.pending,0);
});
