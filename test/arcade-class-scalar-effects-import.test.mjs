import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';

import {scalarAccessorSource} from './fixtures/arcade-class-scalar-effects.mjs';
const accepted=source=>assert.deepEqual(arcadeToPseudocode(source).unsupported,[],source);
const refused=source=>assert.ok(arcadeToPseudocode(source).unsupported.some(message=>message.includes('requires Number from actual producers')),source);

test('closed Number accessors retain bounded scalar effects before the field operation',()=>{
 accepted(scalarAccessorSource);
 accepted(scalarAccessorSource.replace('trace=trace*10+1;','trace=trace*10+1;trace=trace+0;'));
 accepted(scalarAccessorSource.replace('trace=trace*10+1;','trace=-trace+1;'));
 const imported=arcadeToPseudocode(scalarAccessorSource);
 assert.match(imported.code,/DEFINE __bwAccessor_Box_get_value[\s\S]*set trace to[\s\S]*arcade return value/);
 assert.match(imported.code,/DEFINE __bwAccessor_Box_set_value[\s\S]*set trace to[\s\S]*arcade set object/);
});

test('scalar effect proof checks actual initialization, every writer and binding identity',()=>{
 for(const source of [
  scalarAccessorSource.replace('let trace=0;','let trace:number;'),
  scalarAccessorSource.replace('let trace=0;','let trace=<any>"";'),
  scalarAccessorSource.replace('let trace=0;','let trace=1e999;'),
  scalarAccessorSource.replace('let trace=0;','')+'let trace=0;',
  scalarAccessorSource+'trace=<any>"bad";',
  scalarAccessorSource+'function change(){trace=<any>true}',
  scalarAccessorSource+'trace++;',
  scalarAccessorSource.replace('trace=trace*10+1;','trace=other+1;'),
  scalarAccessorSource.replace('trace=trace*10+1;','trace=trace+<any>"x";'),
  scalarAccessorSource.replace('trace=trace*10+1;','trace=trace/0;'),
  scalarAccessorSource.replace('trace=trace*10+1;','trace=trace%2;'),
  scalarAccessorSource.replace('trace=trace*10+1;','trace=tap();')+'function tap(){return 1}',
  scalarAccessorSource.replace('trace=trace*10+2;','v=3;'),
  scalarAccessorSource.replace('trace=trace*10+2;','this.n=3;'),
  scalarAccessorSource.replace('trace=trace*10+1;','let trace=0;trace=trace+1;'),
  scalarAccessorSource.replace('trace=trace*10+1;','if(true){trace=1;}')
 ])refused(source);
});

test('effect prefixes preserve closed receiver and mixed field writer refusals',()=>{
 for(const extra of ['box.n=<any>"x";','box.value=<any>true;','let alias=box;',
  'function capture(){box.n=4}','box=<any>{n:2};','box["n"]=<any>"x";'])refused(scalarAccessorSource+extra);
 refused(scalarAccessorSource.replace('new Box(2)','new Box(<any>"x")'));
 refused(scalarAccessorSource.replace('return this.n','return <any>true'));
 refused(scalarAccessorSource.replace('return this.n','return this.value'));
 refused(scalarAccessorSource.replace('this.n=v','this.value=v'));
});


test('var hoisting cannot hide a Text writer behind lexical Number facts',()=>{
 const effect=scalarAccessorSource.replace('let trace=0;','var trace:any=0;').replace('let box=new Box(2);',`if(true){var trace:any="x"}let box=new Box(trace);`);
 refused(effect);
 refused(effect.replace('trace=trace*10+1;','').replace('trace=trace*10+2;',''));
 refused(scalarAccessorSource.replace('let trace=0;','var trace=0;'));
 refused(scalarAccessorSource.replace('let box=new Box(2);','var box=new Box(2);'));
 refused(scalarAccessorSource.replace('let box=new Box(2);','let value:any=2;if(true){var value:any="x"}let box=new Box(value);'));
});


test('compound getters recursively require initialized own Number field producers',()=>{
 for(const expression of ['this.n+1','-(this.n*2)+this.n','(this.n+1)*(this.n-2)','1e308*1e308+this.n'])
  accepted(scalarAccessorSource.replace('return this.n','return '+expression));
 const compound=scalarAccessorSource.replace('return this.n','return (this.n+1)*this.n');
 for(const source of [
  compound+'box.n=<any>"x";',compound+'function captured(){box.n=<any>true}',
  compound+'let alias=box;alias.n=<any>"x";',
  compound.replace('new Box(2)','new Box(<any>"x")'),
  compound.replace('let box=new Box(2);','var box=new Box(2);'),
  compound.replace('return (this.n+1)*this.n','return this.n+<any>"x"'),
  compound.replace('return (this.n+1)*this.n','return this.n+trace'),
  compound.replace('return (this.n+1)*this.n','return this.value+1'),
  compound.replace('return (this.n+1)*this.n','return take(this.n)+1'),
  compound.replace('return (this.n+1)*this.n','return this.n/0'),
  compound.replace('return (this.n+1)*this.n','return this.n%2'),
  compound.replace('return (this.n+1)*this.n','return this.n+1e999'),
  compound.replace('constructor(public n:number){}','n:number;constructor(n:number){}')
 ])refused(source);
});

test('compound setters retain every actual formal producer and initialized field proof',()=>{
 for(const expression of ['v+1','-(v*2)+this.n','(v+1)*(this.n-2)','1e308*1e308-v'])
  accepted(scalarAccessorSource.replace('this.n=v','this.n='+expression));
 const compound=scalarAccessorSource.replace('this.n=v','this.n=(v+1)*this.n');
 for(const extra of ['box.value=<any>"x";','box.value=<any>true;','box.value=<any>undefined;',
  'box.n=<any>"x";','let alias=box;alias.n=<any>"x";',
  'function captured(){box.n=<any>true}','box["n"]=<any>"x";',
  'function captured(){box.value=<any>"x";}','let absent:number;box.value=absent;',
  'box.value=take(4);'])refused(compound+extra);
 for(const rhs of ['v+<any>"x"','v+<any>true','v+<any>undefined','v+this.value','take(v)',
  'v/0','v%2','v+1e999'])refused(compound.replace('(v+1)*this.n',rhs));
 refused(compound.replace('new Box(2)','new Box(<any>"x")'));
 refused(compound.replace('let box=new Box(2);','let before=take(box.value);let box=new Box(2);'));
 refused(compound.replace('constructor(public n:number){}','n:number;constructor(n:number){this.n=this.n+1;}'));
 refused(compound.replace('constructor(public n:number){}','n:number;constructor(n:number){}'));
 refused(compound.replace('this.n=(v+1)*this.n','this.value=v+1'));
 refused(compound.replace('let box=new Box(2);','var box=new Box(2);'));
 refused(compound.replace('this.n=(v+1)*this.n','v=<any>"x";this.n=v+1'));
 refused(compound.replace('this.n=(v+1)*this.n','this.n=this.n+trace'));
});

test('compound constructor writes require every allocation formal Number producer',()=>{
 const source=`class Box{n:number;constructor(a:number,b:number){this.n=-(a*2)+b+1}
 get value():number{return this.n}}
 function take(n:number){return n}
 let box=new Box(2,8);let first=take(box.value);`;
 accepted(source);
 accepted(source+'let other=new Box(4,9);let second=take(other.value);');
 accepted(source.replace('-(a*2)+b+1','a*1e308-b*1e308'));
 for(const extra of ['let other=new Box(<any>"x",8);','let other=new Box(2,<any>true);',
  'let other=new Box(2,<any>undefined);','let alias=box;',
  'box.n=<any>"x";','function captured(){box.n=<any>true}',
  'let absent:number;let other=new Box(absent,8);'])refused(source+extra);
 for(const expression of ['this.n+a','this.value+a','take(a)','a+<any>"x"','a+<any>true',
  'a/0','a%2','a+1e999'])refused(source.replace('-(a*2)+b+1',expression));
 refused(source.replace('constructor(a:number,b:number)','constructor(a:number,b:number=8)'));
 refused(source.replace('constructor(a:number,b:number)','constructor(a:number,b?:number)'));
 refused(source.replace('new Box(2,8)','new Box(2)'));
 refused(source.replace('this.n=-(a*2)+b+1','a=<any>"x";this.n=-(a*2)+b+1'));
 refused(source.replace('let box=new Box(2,8);','let before=take(box.value);let box=new Box(2,8);'));
 refused(source.replace('let box=new Box(2,8);','var box=new Box(2,8);'));
 refused(source.replace('let box=new Box(2,8);','let a:any=2;if(true){var a:any="x"}let box=new Box(a,8);'));
});


test('closed Number getter bitwise NOT retains operand producers and field initialization',()=>{
 for(const expression of ['~this.n','~(this.n+1)','-(~(this.n*2))+this.n','~~this.n'])
  accepted(scalarAccessorSource.replace('return this.n','return '+expression));
 const source=scalarAccessorSource.replace('return this.n','return ~(this.n+1)');
 for(const extra of ['box.n=<any>"x";','box.n=<any>true;','box.n=<any>undefined;',
  'box.value=<any>"x";','let alias=box;','function capture(){box.n=<any>true}'])refused(source+extra);
 for(const expression of ['~this.value','~trace','~take(this.n)','~(this.n+<any>"x")'])
  refused(source.replace('~(this.n+1)',expression));
 refused(source.replace('new Box(2)','new Box(<any>"x")'));
 refused(source.replace('constructor(public n:number){}','n:number;constructor(n:number){}'));
 refused(source.replace('constructor(public n:number){}','n:number;constructor(n:number){this.n=this.n+1}'));
});


test('constructor bitwise NOT requires every actual Number argument and a closed operand',()=>{
 const source=`class Box{n:number;constructor(a:number,b:number){this.n=~(a*2)+b}
 get value():number{return this.n}}
 function take(n:number){return n}
 let box=new Box(2,8);let first=take(box.value);`;
 for(const expression of ['~a','~~a','-(~(a*2))+b','~(a*1e308-b*1e308)'])
  accepted(source.replace('~(a*2)+b',expression));
 accepted(source+'let other=new Box(4,9);let second=take(other.value);');
 for(const extra of ['let other=new Box(<any>"x",8);','let other=new Box(2,<any>true);',
  'let other=new Box(2,<any>undefined);','let absent:number;let other=new Box(absent,8);',
  'let alias=box;','box.n=<any>"x";','function capture(){box.n=<any>true}'])refused(source+extra);
 for(const expression of ['~this.n','~this.value','~take(a)','~external',
  '~(a+<any>"x")','~(a+<any>true)','~(a+1e999)'])
  refused(source.replace('~(a*2)+b',expression));
 refused(source.replace('constructor(a:number,b:number)','constructor(a:number,b:number=8)'));
 refused(source.replace('constructor(a:number,b:number)','constructor(a:number,b?:number)'));
 refused(source.replace('new Box(2,8)','new Box(2)'));
 refused(source.replace('this.n=~(a*2)+b','a=<any>"x";this.n=~(a*2)+b'));
 refused(source.replace('let box=new Box(2,8);','let before=take(box.value);let box=new Box(2,8);'));
});


test('setter bitwise NOT recursively checks actual formals and initialized own fields',()=>{
 const base=scalarAccessorSource.replace('this.n=v','this.n=~(v+this.n)');
 for(const expression of ['~this.n','~(v+this.n)','~~(v*2+this.n)','~(v*1e308-this.n*1e308)'])
  accepted(base.replace('~(v+this.n)',expression));
 for(const extra of ['box.value=<any>"x";','box.value=<any>true;','box.value=<any>undefined;',
  'let absent:number;box.value=absent;','box.n=<any>"x";',
  'let alias=box;','function captured(){box.n=<any>true}','box.value=take(4);'])refused(base+extra);
 for(const expression of ['~this.value','~take(v)','~external','~(v+<any>"x")',
  '~(v+<any>true)','~(v+1e999)'])refused(base.replace('~(v+this.n)',expression));
 refused(base.replace('new Box(2)','new Box(<any>"x")'));
 refused(base.replace('constructor(public n:number){}','n:number;constructor(n:number){}'));
 refused(base.replace('this.n=~(v+this.n)','v=2;this.n=~(v+this.n)'));
});


test('binary bitwise getters require both closed Number operands without coercing mixed producers',()=>{
 const expressions=['this.n|1','this.n&3','this.n^7','this.n<<2','this.n>>2','this.n>>>2',
  '(this.n+1)|(~this.n)','(this.n*1e308-this.n*1e308)^this.n'];
 for(const expression of expressions)accepted(scalarAccessorSource.replace('return this.n','return '+expression));
 for(const op of ['|','&','^','<<','>>','>>>']){
  const source=scalarAccessorSource.replace('return this.n',`return this.n${op}1`);
  for(const extra of ['box.n=<any>"x";','box.n=<any>true;','box.n=<any>undefined;',
   'box.value=<any>"x";','let alias=box;','function capture(){box.n=<any>true}',
   'box["n"]=<any>"x";'])refused(source+extra);
  for(const operand of ['<any>"x"','<any>true','<any>undefined','this.value','trace','take(this.n)','external']){
   refused(source.replace(`this.n${op}1`,`this.n${op}(${operand})`));
   refused(source.replace(`this.n${op}1`,`(${operand})${op}this.n`));
  }
  refused(source.replace('new Box(2)','new Box(<any>"x")'));
  refused(source.replace('constructor(public n:number){}','n:number;constructor(n:number){}'));
 }
});


test('binary bitwise setters require both closed Number operands and every actual writer',()=>{
 for(const op of ['|','&','^','<<','>>','>>>']){
  const source=scalarAccessorSource.replace('this.n=v',`this.n=v${op}this.n`);
  accepted(source);
  accepted(source.replace(`v${op}this.n`,`v${op}trace`));
  refused(source.replace(`v${op}this.n`,`v${op}trace`)+'trace=<any>"bad";');
  accepted(source.replace(`v${op}this.n`,`(v+1)${op}(~this.n)`));
  accepted(source.replace(`v${op}this.n`,`(v*1e308-v*1e308)${op}(this.n*1e308)`));
  for(const extra of ['box.value=<any>"x";','box.value=<any>true;','box.value=<any>undefined;',
   'let absent:number;box.value=absent;','box.value=take(4);',
   'box.n=<any>"x";','box.n=<any>true;','box.n=<any>undefined;',
   'let alias=box;','function captured(){box.value=2}',
   'function captured(){box.n=<any>true}','box["n"]=<any>"x";'])refused(source+extra);
  for(const operand of ['<any>"x"','<any>true','<any>undefined','this.value','take(v)','external','1e999']){
   refused(source.replace(`v${op}this.n`,`v${op}(${operand})`));
   refused(source.replace(`v${op}this.n`,`(${operand})${op}this.n`));
  }
  refused(source.replace('new Box(2)','new Box(<any>"x")'));
  refused(source.replace('constructor(public n:number){}','n:number;constructor(n:number){}'));
  refused(source.replace('constructor(public n:number){}','n:number;constructor(n:number){this.n=this.n+1}'));
  refused(source.replace(`this.n=v${op}this.n`,`v=2;this.n=v${op}this.n`));
  refused(source.replace('let box=new Box(2);','var box=new Box(2);'));
  refused(source.replace('let box=new Box(2);','let before=take(box.value);let box=new Box(2);'));
 }
});

test('conditional accessors prove pure Number guards and both Number branches',()=>{
 const getter=scalarAccessorSource.replace('return this.n','return this.n<0?-this.n:this.n');
 const setter=scalarAccessorSource.replace('this.n=v','this.n=v<0?0:(v>this.n?this.n:v)');
 for(const source of [getter,setter,getter.replace('this.n<0','this.n*1e308<this.n'),
  getter.replace('-this.n:this.n','this.n<1?1:2:this.n'),
  setter.replace('v<0','true')])accepted(source);
 for(const base of [getter,setter]){
  for(const extra of ['box.n=<any>"x";','box.n=<any>true;','box.value=<any>"x";',
   'box.value=<any>true;','let alias=box;','function capture(){box.n=2}',
   'let missing:number;box.value=missing;'])refused(base+extra);
  refused(base.replace('new Box(2)','new Box(<any>"x")'));
  refused(base.replace('constructor(public n:number){}','n:number;constructor(n:number){}'));
 }
 for(const expression of ['this.n<0?<any>"x":this.n','this.n<0?this.n:<any>true',
  'this.n<0?<any>undefined:this.n','this.n<0?this.n:this.value',
  'this.n<0?take(this.n):this.n','this.n<0?this.n:take(this.n)',
  'take(this.n)<0?-this.n:this.n','this.value<0?-this.n:this.n',
  'trace<0?-this.n:this.n','external?-this.n:this.n',
  '(<any>"x")<this.n?-this.n:this.n',
  'this.n<(<any>"x")?-this.n:this.n','this.n<0?-this.n:external',
  '(this.n=1)<0?-this.n:this.n','this.n++<0?-this.n:this.n'])
  refused(getter.replace('this.n<0?-this.n:this.n',expression));
 for(const expression of ['v<0?<any>"x":v','v<0?v:<any>true','v<0?<any>undefined:v',
  'v<0?take(v):this.n','v<0?this.n:take(v)','take(v)<0?0:v',
  'this.value<0?0:v','external?0:v','v<(<any>true)?0:v','v<0?external:v',
  '(v=1)<0?0:v','v++<0?0:v'])
  refused(setter.replace('v<0?0:(v>this.n?this.n:v)',expression));
});
