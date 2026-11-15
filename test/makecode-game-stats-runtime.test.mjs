import test from 'node:test';import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {loadExtensionClass} from './helpers/bw-extensions.mjs';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {runPxtArcade} from './helpers/pxt-arcade-runtime.mjs';
import {runProgram,quitStrandedVMs} from './helpers/bw-vm.mjs';
import {restartTimedArcadeRun} from './helpers/arcade-timed-native.mjs';
import {importGuiDependency} from './helpers/bw-integrated.mjs';

async function owner(run) {
    const dispatch=(await importGuiDependency('scratch-vm/src/dispatch/central-dispatch.js')).default;
    const instance=dispatch.services[run.vm.extensionManager._loadedExtensions.get('arcade')]._inst;
    assert.strictEqual(instance._runtime,run.vm.runtime);return instance;
}
async function exerciseRoutes(source,milliseconds,check) {
    const out=arcadeToPseudocode(source);assert.deepEqual(out.unsupported,[]);
    const start=code=>runProgram(code,{frames:0,frameAuthority:'timed',storage:true,uploads:out.costumes,countExtensionCalls:false});
    const sample=async(run,label)=>{
        const publications=[],listener=text=>publications.push(text);run.vm.runtime.on('ARCADE_DEVICE_STATS',listener);
        try {
            await restartTimedArcadeRun(run,milliseconds);
            const instance=await owner(run);await check(run,instance,publications,label);
            assert.deepEqual(run.errors,[]);assert.deepEqual(run.creator.warnings,[]);
        } finally {run.vm.runtime.removeListener('ARCADE_DEVICE_STATS',listener);}
    };
    try {
        const run=await start(out.code);await sample(run,'native');await sample(run,'native restart');
        await sample(await start(run.creator.decompile()),'Code');
        const saved=Buffer.from(await(await run.vm.saveProjectSb3()).arrayBuffer());
        const fresh=await start('SPRITE Placeholder:\nWHEN flag clicked:\n  hide');
        fresh.vm.stopAll();await fresh.vm.loadProject(saved);await sample(fresh,'fresh SB3');
    } finally {quitStrandedVMs();}
}
test('actual SDK and portable native paths retain text after direct false and reset the next run',async()=>{
    const source='let actor=sprites.create(img`1`,SpriteKind.Player);game.stats=true;pause(80);game.stats=false;pause(60);let done=1;';
    // Use the original simulator main-return callback; an unused declaration
    // need not be published as a global. Keep the authored fixture unchanged.
    const pxt=await runPxtArcade(source,{fakeClock:true,waitForMain:true,inspectStats:true});
    assert.ok(pxt.$stats.runtimeTime>=140,'both original pauses completed before observation');
    assert.equal(pxt.stats,false,'original SDK flag actually disabled');
    assert.equal(pxt.$stats.text,' sprites:1');assert.equal(pxt.$stats.displayed,pxt.$stats.text);
    assert.ok(pxt.$stats.publications.length>0);
    await exerciseRoutes(source,160,async(run,instance,published,label)=>{
        assert.equal(instance._gameStats.enabled,false,label);assert.equal(run.vm.runtime.bwArcadeStatsText,pxt.$stats.text,label);
        assert.equal(published[0],'','fresh-run reset '+label);assert.ok(published.includes(' sprites:1'),label);
        const before=published.length;instance._drawGameStats(instance._state());assert.equal(published.length,before,'false does not publish or clear '+label);
        let touched=0;const opaque={toString(){touched++;return 'enabled';},valueOf(){touched++;return 1;}};
        assert.throws(()=>instance._gameStats.setEnabled(opaque),TypeError);assert.equal(touched,0);
    });
});
test('actual SDK and portable native paths publish current scene membership across push and pop',async()=>{
    const source='let first=sprites.create(img`1`,SpriteKind.Player);game.stats=true;pause(40);game.pushScene();'+
        'let second=sprites.create(img`2`,SpriteKind.Player);let third=sprites.create(img`3`,SpriteKind.Player);'+
        'pause(40);game.popScene();pause(40);let done=1;';
    // Use the original simulator main-return callback; an unused declaration
    // need not be published as a global. Keep the authored fixture unchanged.
    const pxt=await runPxtArcade(source,{fakeClock:true,waitForMain:true,inspectStats:true});
    assert.ok(pxt.$stats.runtimeTime>=120,'all three original scene pauses completed');
    assert.equal(pxt.stats,true,'original SDK flag remains enabled');
    assert.ok(pxt.$stats.publications.some(p=>p.text===' sprites:2'));assert.equal(pxt.$stats.text,' sprites:1');
    assert.equal(pxt.$stats.displayed,pxt.$stats.text);
    await exerciseRoutes(source,140,async(run,instance,published,label)=>{
        assert.equal(instance._gameStats.enabled,true,label);assert.ok(published.includes(' sprites:2'),'child membership '+label);
        assert.equal(run.vm.runtime.bwArcadeStatsText,pxt.$stats.text,'restored membership '+label);
        assert.equal(instance._sceneSpriteObjects(instance._state()).length,1,label);
    });
});

// A direct native-command boundary control, separate from actual VM routes.
test('the actual native command rejects opaque and non-mode input without coercion',()=>{
    const runtime=new EventEmitter(),errors=[];runtime.getOpcodeFunction=()=>()=>'';
    runtime.on('BLOCKS_ERROR',error=>errors.push(error));
    const instance=new(loadExtensionClass('arcade'))(runtime)._inst;
    let touched=0;const opaque={toString(){touched++;return 'enabled';},valueOf(){touched++;return 1;}};
    for(const mode of [true,1,'true',null,[],opaque]){
        const before=errors.length;instance.setGameStats({MODE:mode});
        assert.equal(errors.length,before+1);assert.ok(errors.at(-1) instanceof TypeError);
        assert.equal(instance._gameStats.enabled,false);
    }
    assert.equal(touched,0);instance.setGameStats({MODE:'enabled'});assert.equal(instance._gameStats.enabled,true);
    instance.setGameStats({MODE:'disabled'});assert.equal(instance._gameStats.enabled,false);
});
