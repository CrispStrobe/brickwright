import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {runPxtArcade} from './helpers/pxt-arcade-runtime.mjs';
import {runProgram,stepFrames,quitStrandedVMs} from './helpers/bw-vm.mjs';
const values=run=>Object.fromEntries(run.vm.runtime.targets.flatMap(t=>Object.values(t.variables)).map(v=>[v.name.replace(/^(?:Game_)+/,''),v.value]));
test('imported Image library executes real caller Images, Number shifts, ordered arguments and pixels through PXT, Code and SB3',async()=>{
 // Import the library without callers, as a real extension package is imported.
 // The external guest driver supplies actual Images after import. Adding those
 // source calls before import would hide the missing-producer regression.
 const library=`let markers=[0]
let trace=0
function width():number{trace=trace*10+1;return 7}
function height():number{trace=trace*10+2;return 5}
function build(input:Image):Image{
 let canvas=image.create(input.width,input.height)
 const x=canvas.width>>1
 const y=canvas.height>>1
 canvas.fill(2)
 canvas.setPixel(x,y,12)
 return canvas
}`;
 const client=`let first=build(image.create(width(),height()))
let firstWidth=first.width
let firstHeight=first.height
let center=first.getPixel(3,2)
let corner=first.getPixel(0,0)
let other=build(image.create(9,3))
let otherCenter=other.getPixel(4,1)
let otherCorner=other.getPixel(0,0)
let done=1
done+=0`;
 const expected=await runPxtArcade(library+'\n'+client,{fakeClock:true});assert.equal(expected.trace,12);assert.equal(expected.firstWidth,7);assert.equal(expected.firstHeight,5);assert.equal(expected.center,12);assert.equal(expected.otherCenter,12);assert.equal(expected.corner,2);
 const out=arcadeToPseudocode(library);assert.deepEqual(out.unsupported,[]);assert.match(out.code,/calculate value .* op ">>"/);assert.doesNotMatch(out.code,/bitops/);
 const call=(name,args)=>`arcade call function "${name}" arguments (${args})`;
 const argument=value=>`arcade function argument (${value}) rest ("[]")`;
 const code=out.code.replace('\nDEFINE ',[
  '',`  set inputImage to (arcade new image width (${call('width','"[]"')}) height (${call('height','"[]"')}))`,
  `  set first to (${call('build %s',argument('inputImage'))})`,
  '  set firstWidth to (arcade image width of (first))','  set firstHeight to (arcade image height of (first))',
  '  set center to (arcade image pixel (first) x 3 y 2)','  set corner to (arcade image pixel (first) x 0 y 0)',
  '  set inputOther to (arcade new image width (9) height (3))',`  set other to (${call('build %s',argument('inputOther'))})`,
  '  set otherCenter to (arcade image pixel (other) x 4 y 1)','  set otherCorner to (arcade image pixel (other) x 0 y 0)',
  '  set done to (0 + (1))','\nDEFINE '
 ].join('\n'));
 const keys=['trace','firstWidth','firstHeight','center','corner','otherCenter','otherCorner','done'];
 const check=async run=>{await stepFrames(run.vm,40);for(const key of keys)assert.equal(values(run)[key],expected[key],key);assert.deepEqual(run.errors,[]);assert.deepEqual(run.creator.warnings,[])};
 try{
  const run=await runProgram(code,{frames:0,storage:true,countExtensionCalls:false});await check(run);
  await check(await runProgram(run.creator.decompile(),{frames:0,storage:true,countExtensionCalls:false}));
  const saved=Buffer.from(await(await run.vm.saveProjectSb3()).arrayBuffer());const fresh=await runProgram('SPRITE Placeholder:\nWHEN flag clicked:\n  hide',{frames:0,storage:true,countExtensionCalls:false});fresh.vm.stopAll();await fresh.vm.loadProject(saved);fresh.vm.greenFlag();await check(fresh);
 }finally{quitStrandedVMs()}
});
