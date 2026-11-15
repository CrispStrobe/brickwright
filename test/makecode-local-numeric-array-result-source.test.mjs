import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMakeCodeTs} from '../overlay/scratch-gui/src/lib/bw-makecode/ts-import.js';
import {analyseSourceValueProducers} from '../overlay/scratch-gui/src/lib/bw-makecode/source-value-producers.js';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
const source=(body='let a=[];for(let i=0;i<4;i++)a.push(i);a.reverse();',index='k')=>`function sample(k:number){${body}return a[${index}]}let observed=Math.idiv(sample(1)+0,1)`;
function domain(s){const p=parseMakeCodeTs(s),g=analyseSourceValueProducers(p,{parenthesized:true,unboundIsOpaque:true,initializationEntries:true,closedNumericArrayResults:true});let result;const walk=n=>{if(!n||typeof n!=='object')return;if(n.type==='Index'&&n.object.name==='a')result=[...g.typesAt(n)].sort();for(const v of Object.values(n))if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v)};walk(p);return result;}
test('closed numeric push/reverse read retains Undefined independently of index bounds',()=>{
 for(const k of ['k','-1','99','0','1/0','0/0'])assert.deepEqual(domain(source(undefined,k)),['Number','Undefined'],k);
 assert.deepEqual(arcadeToPseudocode(source()).unsupported,[]);
 assert.deepEqual(domain(source('let a=[];for(let i=0;i<0;i++)a.push(i);a.reverse();')),['Number','Undefined']);
 for(const value of ['1/0','0/0','-3.5'])assert.deepEqual(domain(source(`let a=[];a.push(${value});a.reverse();`)),['Number','Undefined']);
});
test('normal-result proof refuses aliases, captures, holes, mixed writers and opaque producers',()=>{
 for(const body of [
  'let a=[];let b=a;a.push(1);a.reverse();',
  'let a=[];a.push("1");a.reverse();',
  'let a=[];a.push(1);a.push(unknown);a.reverse();',
  'let a=[];a.push(1);a[0]=2;a.reverse();',
  'let a=[];a.push(1);a.length=8;a.reverse();',
  'let a=[];a.push(1);a=null;a.reverse();',
  'a.push(1);let a=[];a.reverse();',
  'let a=[];a.push(1);function hidden(){a.push(2)}a.reverse();',
  'let a=[];a.push(1);a.reverse(1);',
  'let a=[];a.push(1);let reverse=a.reverse;reverse();',
  'let a=[];a.push(1);unknown.reverse();a.reverse();',
  'let a=[];a.push(1);Array.prototype.reverse=unknown;a.reverse();',
  'let a=[];a.push(1);Object.setPrototypeOf(a,unknown);a.reverse();',
  'let a=[];a.push(1);game.splash=a.reverse;a.reverse();'
 ])assert.notDeepEqual(domain(source(body)),['Number','Undefined'],body);
 assert.notDeepEqual(domain(source('let a=[];a.push(1);a.reverse();','unknown')),['Number','Undefined']);
});
test('annotations, open formal writers and SDK shadows do not acquire numeric authority',()=>{
 for(const s of [
  'function sample(k:number,v:number){let a=[];a.push(v);a.reverse();return a[k]}let observed=Math.idiv(sample(0,unknown)+0,1)',
  'function sample(k:number){let a=[];a.push(1);a.reverse();return a[k]}let alias=sample;let observed=Math.idiv(sample(0)+0,1)',
  'function sample(k:number){let a=[];a.push(1);a.reverse();return a[k]}let Math=unknown;let observed=Math.idiv(sample(0)+0,1)'
 ])assert.ok(arcadeToPseudocode(s).unsupported.length,s);
});
test('staged effect witness refuses unseeded cycles, unknown receivers and every late writer',()=>{
 const cases=[
  'let x=y;let y=x;let a=[];a.push(x);a.reverse();',
  'let a=[];a.push(1);a.reverse();let x=y;let y=x;let text=""+x;text.charAt(0);',
  'let x:number;let a=[];a.push(x);a.reverse();',
  'let a=[];a.push(1);a.reverse();let s=unknown;s.charAt(0);',
  'let a=[];a.push(1);a.reverse();let s=""+unknown;s.charAt(0);',
  'let a=[];a.push(1);a.reverse();let s="ok";s=unknown;s.charAt(0);',
  'let a=[];a.push(1);a.reverse();function opaque(x:string){return x.charAt(0)}opaque(unknown);',
  'let a=[];a.push(1);a.reverse();function cycle(x:number){return cycle(x)}let s=""+cycle(1);s.charAt(0);',
  'let a=[];a.push(1);a.reverse();let s="ok";s.charAt=unknown;s.charAt(0);'
 ];
 for(const body of cases)assert.notDeepEqual(domain(source(body)),['Number','Undefined'],body);
});
test('String receiver is proved from actual numeric seed and every writer, never from a provisional consumer type',()=>{
 const s='let sum=0;function collect(){let a=[];for(let i=0;i<4;i++)a.push(i);a.reverse();sum+=a[1]}function format(v:number){v=v*2;let text=""+v;return text.charAt(0)}collect();let output=format(sum);';
 assert.deepEqual(arcadeToPseudocode(s).unsupported,[]);
 for(const changed of [s.replace('let sum=0','let sum=unknown'),s.replace('sum+=a[1]','sum+=a[1];sum=unknown'),s.replace('let text=""+v','let text=v as string')])assert.ok(arcadeToPseudocode(changed).unsupported.length,changed);
});
test('closed effect witness is bound to actual current calls and never licenses a copied call',()=>{
 const p=parseMakeCodeTs(source()),g=analyseSourceValueProducers(p,{parenthesized:true,unboundIsOpaque:true,initializationEntries:true,closedNumericArrayResults:true});let reverse;
 const visit=n=>{if(!n||typeof n!=='object')return;if(n.type==='Call'&&n.callee.name==='reverse')reverse=n;for(const v of Object.values(n))if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v)};visit(p);
 assert.equal(g.closedNumericArrayEffectAt(reverse),true);assert.equal(g.closedNumericArrayEffectAt(structuredClone(reverse)),false);
 reverse.args.push({type:'Number',value:'1'});assert.equal(g.closedNumericArrayEffectAt(reverse),false);
});
