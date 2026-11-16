import test from 'node:test';import assert from 'node:assert/strict';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
const source='let digits=3;let letters=2;let count=game.askForNumber("Count",digits);let text=game.askForString("Name",letters);';
test('owned initialized literal option bindings normalize without changing files',()=>{
 const files={'main.ts':source,'test.ts':'','pxt.json':JSON.stringify({dependencies:{device:'*'},files:['main.ts'],testFiles:['test.ts']})},before=JSON.stringify(files),out=arcadeToPseudocode(files);assert.deepEqual(out.unsupported,[]);assert.equal(JSON.stringify(files),before);assert.match(out.code,/arcade ask number "Count" length 3/);assert.match(out.code,/arcade ask text "Name" length 2/);
 for(const n of [1,2,3])assert.deepEqual(arcadeToPseudocode(`let answer=game.askForString("Text",${n})`).unsupported,[]);
});
test('uninitialized, annotated, aliased, changed, computed and hidden options stay refused',()=>{
 for(const changed of [source.replace('let digits=3','let digits=2'),source.replace('let letters=2','let letters=1'),source.replace('let letters=2','let letters=3'),source.replace('let digits=3','let digits:number'),source.replace('let digits=3','let digits=unknown'),source.replace('let digits=3','let digits=1+2'),source.replace('let digits=3','let digits=4'),source.replace('let letters=2','let letters=4'),source.replace('let digits=3;','let digits=3;digits=2;'),source.replace('let letters=2;','let letters=2;letters+=0;'),source+'digits=1;',source+'let copy=letters;',source.replace('let count=','digits++;let count='),source.replace('let digits=3;','')+'let digits=3;',source.replace(',letters)',',letters,false)'),source+'game.askForString=unknown;',source+'let g=game;',source+'Object.assign(game,{});'])assert.ok(arcadeToPseudocode(changed).unsupported.some(x=>/digit limit|length limit/.test(x)),changed);
 for(const hidden of ['digits=1;','game.askForString=unknown;','String.prototype.substr=unknown;']){const f={'main.ts':source,'hidden.ts':hidden,'pxt.json':JSON.stringify({files:['main.ts'],testFiles:['hidden.ts'],dependencies:{device:'*'}})};assert.ok(arcadeToPseudocode(f).unsupported.some(x=>/limit/.test(x)),hidden);}
});
test('SDK receiver shadows and non-SDK dependencies cannot authorize options',()=>{
 for(const f of [{'main.ts':'let game=unknown;'+source},{'main.ts':source,'pxt.json':JSON.stringify({files:['main.ts'],dependencies:{device:'*',extra:'*'}})},{'main.ts':source,'native.asm':'nop','pxt.json':JSON.stringify({files:['main.ts','native.asm'],dependencies:{device:'*'}})}])assert.ok(arcadeToPseudocode(f).unsupported.some(x=>/limit/.test(x)));
});

test('SDK helper bindings cannot be replaced even by unused primitive declarations',()=>{for(const name of ['parseFloat','String','Number','Promise','console','Math','game'])assert.ok(arcadeToPseudocode('let '+name+'=1;'+source).unsupported.some(x=>/limit/.test(x)),name);});
