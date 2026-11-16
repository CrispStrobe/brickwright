import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {parseMakeCodeTs} from '../overlay/scratch-gui/src/lib/bw-makecode/ts-import.js';
import {gameStatsAssignmentProof,gameStatsConfiguredSourceSafe} from '../overlay/scratch-gui/src/lib/bw-makecode/game-stats-source.js';

const configured=(source,hidden='')=>({'main.ts':source,'hidden.ts':hidden,
    'pxt.json':JSON.stringify({files:['main.ts'],testFiles:['hidden.ts'],dependencies:{device:'*'}})});
test('SDK constant stats assignments lower without replacing the source',()=>{
    for(const value of [true,false]) {
        const files=configured('game.stats = '+value),before=JSON.stringify(files),out=arcadeToPseudocode(files);
        assert.equal(gameStatsConfiguredSourceSafe(files),true);
        assert.deepEqual(out.unsupported,[]);assert.equal(JSON.stringify(files),before);
        assert.match(out.code,new RegExp('arcade game stats '+(value?'enabled':'disabled')));
    }
    const source='namespace motion { export function move(s:Sprite,n:number){s.x=80+40*Math.cos(n);s.y=60+40*Math.sin(n);} }\n'+
        'let actor=sprites.create(img`1`,SpriteKind.Player);let angle=0;game.onUpdate(()=>{angle+=0.1;motion.move(actor,angle);});game.stats=true;';
    assert.deepEqual(arcadeToPseudocode(configured(source)).unsupported,[]);
});
test('opaque, effectful, computed, shadowed and altered SDK receivers remain refused',()=>{
    const bad=['game.stats=1','game.stats="true"','let flag:boolean;game.stats=flag','game.stats=unknown()',
        'game.stats+=true','game["stats"]=true','let game=unknown;game.stats=true','game.stats=true;let alias=game;',
        'function later(game){game.stats=true;}','game.stats=true;game.onUpdate=unknown;',
        'game.stats=true;Object.assign(game,{});','game.stats=true;Number.prototype.toString=unknown;',
        'game.stats=true;let callback=game.onUpdate;','game.stats=true;unknown();',
        'let {game}=unknown;game.stats=true;','let [game]=unknown;game.stats=true;'];
    for(const source of bad) {
        assert.equal(gameStatsConfiguredSourceSafe(configured(source)),false,source);
        assert.ok(arcadeToPseudocode(configured(source)).unsupported.length,source);
    }
});
test('hidden configured writers and unresolved dependencies cannot authorize the flag',()=>{
    for(const hidden of ['let alias=game;','game=unknown;','game.stats=unknown;','Math.prototype=unknown;'])
        assert.equal(gameStatsConfiguredSourceSafe(configured('game.stats=true',hidden)),false,hidden);
    const files=configured('game.stats=true');files['pxt.json']=JSON.stringify({files:['main.ts'],dependencies:{device:'*',external:'*'}});
    assert.equal(gameStatsConfiguredSourceSafe(files),false);
});
test('a proof cannot survive a changed writer, node or AST snapshot',()=>{
    const p=parseMakeCodeTs('game.stats=true',{retainCallableMetadata:true}),node=p.body[0].expr;
    const proof=gameStatsAssignmentProof(p);assert.equal(proof.has(node),true);
    node.right.value=false;assert.equal(proof.has(node),false);
    node.right.value=true;p.body.push(parseMakeCodeTs('game.stats=unknown').body[0]);assert.equal(proof.has(node),false);
    const malformed=parseMakeCodeTs('game.stats=true',{retainCallableMetadata:true});malformed.body[0].expr.right.value='true';
    assert.equal(gameStatsAssignmentProof(malformed).has(malformed.body[0].expr),false);
});

test('SDK destroy-all staging keeps a closed snapshot producer and exact element consumer',()=>{
    const source='let actor=sprites.create(img`1`,SpriteKind.Food);game.stats=true;game.onUpdate(()=>{sprites.destroyAllSpritesOfKind(SpriteKind.Food);});';
    assert.equal(gameStatsConfiguredSourceSafe(configured(source)),true);
    assert.deepEqual(arcadeToPseudocode(configured(source)).unsupported,[]);
    for(const bad of [source+'let alias=sprites;',source+'sprites.allOfKind=unknown;',
        source+'SpriteKind.Food=unknown;',source+'Object.prototype.destroy=unknown;',
        source.replace('sprites.destroyAllSpritesOfKind(SpriteKind.Food)','actor.destroy()'),
        source.replace('sprites.destroyAllSpritesOfKind(SpriteKind.Food)','unknown()')])
        assert.equal(gameStatsConfiguredSourceSafe(configured(bad)),false,bad);
    const block=parseMakeCodeTs("{let items=sprites.allOfKind(SpriteKind.Food);for(let index=0;index<items.length;index++){let actor=items[index];actor.destroy();}}").body[0];
    block.body[0].decls[0].isArray=true;block.body[0].decls[0].init.args[0]={type:'Member',object:{type:'Identifier',name:'SpriteKind'},name:'Food'};
    delete block.body[0].decls[0].typeName;const loop=block.body[1];delete loop.init.decls[0].isArray;delete loop.init.decls[0].typeName;loop.init.decls[0].init.value=0;
    delete loop.body[0].decls[0].isArray;delete loop.body[0].decls[0].typeName;
    const base=parseMakeCodeTs('game.stats=true');base.body.push(block);
    const assignment=base.body[0].expr;assert.equal(gameStatsAssignmentProof(base).has(assignment),true);
    for(const decl of [block.body[0].decls[0],loop.init.decls[0],loop.body[0].decls[0]])decl.typeName=undefined;
    assert.equal(gameStatsAssignmentProof(base).has(assignment),true);
    const proof=gameStatsAssignmentProof(base);loop.test.op='<=';assert.equal(proof.has(assignment),false);assert.equal(gameStatsAssignmentProof(base).has(assignment),false);loop.test.op='<';
    for(const edit of [p=>p.body[1].body[1].body.push(parseMakeCodeTs('actor.x=2').body[0]),
        p=>p.body.push(parseMakeCodeTs('let escape=items').body[0]),
        p=>p.body[1].body[0].decls[0].init.callee.object.name='unknown',
        p=>p.body[1].body[1].body[0].decls[0].init.index.name='outside',
        p=>p.body[1].body[1].body[1].expr.args.push({type:'Number',value:'1'}),
        p=>p.body[1].body[1].body[0].decls[0].typeName='Sprite']){
        const changed=structuredClone(base);edit(changed);assert.equal(gameStatsAssignmentProof(changed).has(changed.body[0].expr),false);
    }
});
