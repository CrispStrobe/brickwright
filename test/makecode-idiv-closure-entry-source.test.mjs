import test from 'node:test';import assert from 'node:assert/strict';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {parseMakeCodeTs} from '../overlay/scratch-gui/src/lib/bw-makecode/ts-import.js';
import {lowerMathIdivValues} from '../overlay/scratch-gui/src/lib/bw-makecode/math-idiv-source.js';
const declaration='const WIDTH=160;const STEP=8;function grid(){return Math.idiv(WIDTH,STEP)};';
const clear=s=>{assert.deepEqual(lowerMathIdivValues(parseMakeCodeTs(s)).unsupported,[],s);assert.deepEqual(arcadeToPseudocode(s).unsupported,[],s)};
test('idiv closure creation proves actual captured initialization through every enclosing entry',()=>{
 clear(declaration+'let result=0;game.onUpdateInterval(10,function(){result=grid()})');
 clear(declaration+'let result=0;function start(){game.onUpdateInterval(10,()=>{result=grid()})};start()');
 clear('let WIDTH=160;const STEP=8;function grid(){return Math.idiv(WIDTH,STEP)};let result=0;game.onUpdate(function(){result=grid()});WIDTH=168');
});
test('idiv closure entry does not borrow later initialization, opaque/annotated values or mixed writers',()=>{
 for(const s of [
  'function grid(){return Math.idiv(WIDTH,8)};game.onUpdate(function(){grid()});const WIDTH=160',
  'const f=function(){return Math.idiv(WIDTH,8)};const WIDTH=160;f()',
  'const f=function(){return Math.idiv(WIDTH,8)};let result=f();const WIDTH=160',
  'function start(){game.onUpdate(function(){let q=Math.idiv(WIDTH,8)})};start();const WIDTH=160;start()',
  'function start(){let f=function(){return Math.idiv(WIDTH,8)};return f()};let early=start();const WIDTH=160;let later=start()',
  declaration+'grid();let alias=grid;game.onUpdate(function(){grid()})',
  'function grid(){return Math.idiv(WIDTH,8)};grid();const WIDTH=160;game.onUpdate(function(){grid()})',
  'let WIDTH:number;game.onUpdate(function(){let q=Math.idiv(WIDTH,8)})',
  'let WIDTH=160;game.onUpdate(function(){let q=Math.idiv(WIDTH,8)});WIDTH="160" as any',
  'let data:any={};game.onUpdate(function(){let q=Math.idiv(data.width,8)})',
  'game.onUpdate(function(){let WIDTH:number;let q=Math.idiv(WIDTH,8)})',
  'function open(WIDTH:number){game.onUpdate(function(){let q=Math.idiv(WIDTH,8)})}',
  declaration+'let result=0;game.onUpdate(function(){result=grid()});Math.idiv=unknown'
 ])assert.ok(lowerMathIdivValues(parseMakeCodeTs(s)).unsupported.length,s);
});
