import test from 'node:test';import assert from 'node:assert/strict';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {parseMakeCodeTs} from '../overlay/scratch-gui/src/lib/bw-makecode/ts-import.js';
import {withLiteralRenderableSource,bindLiteralRenderableConsumer,literalRenderablePacket} from '../overlay/scratch-gui/src/lib/bw-makecode/literal-renderable-source.js';
const source='scene.createRenderable(0,function(target,camera){target.fillRect(2,3,4,5,6);target.drawRect(8,9,10,11,12);target.drawLine(0,0,159,119,15)})';
const refused=files=>{const o=arcadeToPseudocode(files);assert.ok(o.unsupported.length,typeof files==='string'?files:JSON.stringify(files));assert.ok(!o.code.includes('arcade add drawing commands'))};
test('pure literal screen drawing keeps z0 as one synchronous operation and emits no callback hat',()=>{const o=arcadeToPseudocode(source);assert.deepEqual(o.unsupported,[]);assert.equal((o.code.match(/arcade add drawing commands/g)||[]).length,1);assert.ok(!o.code.includes('register paint'));assert.ok(!o.code.includes('WHEN arcade paint'));});
test('dynamic depth, callback effects/captures/aliases, camera use and discarded producer identity stay refused',()=>{
 for(const s of [source.replace('(0,','(1,'),source.replace('(0,','(depth,'),source.replace('2,3,4,5,6','x,3,4,5,6'),source.replace('target.fillRect','other.fillRect'),source.replace('target.fillRect','camera.fillRect'),source.replace('target.fillRect','target["fillRect"]'),source.replace('target.fillRect(2,3,4,5,6);','let alias=target;alias.fillRect(2,3,4,5,6);'),source.replace('target.fillRect(2,3,4,5,6);','count++;target.fillRect(2,3,4,5,6);'),source.replace('target,camera','target,camera=unknown()'),source.replace('2,3,4,5,6','2,3,999,5,6'),'let retained='+source])refused(s);
});
test('complete source rejects SDK writers, reflections and unprocessed hidden inputs',()=>{
 for(const s of ['scene.createRenderable=function(){};','let alias=scene;','let scene:any=0;','Object.assign(scene,{});','screen.fillRect=function(){};','let alias=screen;','someImage.drawLine=function(){};'])refused(s+source);
 for(const [name,body]of [['hidden.ts','scene.createRenderable=function(){}'],['hidden.d.ts','declare let scene:any'],['native.asm','']])refused({'main.ts':source,[name]:body,'pxt.json':JSON.stringify({dependencies:{device:'*'},files:['main.ts',name]})});
});
test('actual final callback binding, signature, program descriptors and input scope cannot lend a packet',()=>{
 const files={'main.ts':source};withLiteralRenderableSource(files,()=>{const program=parseMakeCodeTs(source),node=program.body[0].expr,consumer={};bindLiteralRenderableConsumer(consumer,program);assert.ok(literalRenderablePacket(consumer,node));assert.equal(Object.isFrozen(literalRenderablePacket(consumer,node)),true);assert.equal(literalRenderablePacket(consumer,{...node}),null);const different=parseMakeCodeTs(source.replace('2,3,4,5,6','3,3,4,5,6')),alien={};bindLiteralRenderableConsumer(alien,different);assert.equal(literalRenderablePacket(alien,different.body[0].expr),null);node.args[1].body[0].expr.args[0].value='99';assert.equal(literalRenderablePacket(consumer,node),null);});
});
