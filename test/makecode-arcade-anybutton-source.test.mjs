import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {parseMakeCodeTs} from '../overlay/scratch-gui/src/lib/bw-makecode/ts-import.js';
import {anyButtonRegistrationSource,anyButtonConfiguredSourceSafe,lowerAnyButtonRegistrations} from '../overlay/scratch-gui/src/lib/bw-makecode/any-button-registration-source.js';
import {GENERATED_HELPER_PROFILES} from '../overlay/scratch-gui/src/lib/bw-makecode/generated-helper-recognition.js';

for (const [event,code] of [['Pressed',2049],['Released',2048],['Repeated',2054]]) {
    test(`direct any-button ${event} uses the existing zero-value control-event wildcard`, () => {
        for (const operand of [`ControllerButtonEvent.${event}`,String(code)]) {
            const imported = arcadeToPseudocode(`let count=0;controller.anyButton.onEvent(${operand},function(){count+=1});`);
            assert.deepEqual(imported.unsupported, []);
            assert.match(imported.code,new RegExp(`arcade register control event source \\(${code}\\) value \\(0\\) flags \\(16\\)`));
            assert.match(imported.code,/WHEN arcade control event handler "__bwControlEvent1" runs:/);
            assert.doesNotMatch(imported.code,/arcade register button/);
        }
    });
}

test('direct registration preserves captured cells and scene registration sites', () => {
    const source='let observed=0;function install(value:number){let captured=value;controller.anyButton.onEvent(ControllerButtonEvent.Pressed,function(){observed+=captured});captured+=1}install(2);game.pushScene();install(5);game.popScene();';
    const imported=arcadeToPseudocode(source);
    assert.deepEqual(imported.unsupported,[]);
    assert.match(imported.code,/__bwControlEvent1.*capturing "captured value"|__bwControlEvent1.*capturing "value captured"/);
    assert.match(imported.code,/arcade push scene/);
    assert.match(imported.code,/arcade pop scene/);
});

test('unsupported callback shapes and nonfixed event arguments remain diagnosed', () => {
    for (const source of [
        'controller.anyButton.onEvent(2049,1)',
        'controller.anyButton.onEvent(2049,function(value){})',
        'controller.anyButton.onEvent(2049,function(){},1)',
        'controller.anyButton.onEvent(function(){})',
        'controller.anyButton.onEvent(0,function(){})',
        'let event=2049;controller.anyButton.onEvent(event,function(){})',
        'function handler(){}controller.anyButton.onEvent(2049,handler)',
        'controller.anyButton.onEvent(ControllerButtonEvent.Unknown,function(){})'
    ]) {
        const imported=arcadeToPseudocode(source);
        assert.ok(imported.unsupported.length,source);
        assert.doesNotMatch(imported.code,/WHEN arcade control event handler "__bwControlEvent/);
    }
});

test('shadowed, escaped, computed and mutated builtin receivers never acquire a wildcard', () => {
    const call='controller.anyButton.onEvent(ControllerButtonEvent.Pressed,function(){})';
    for (const source of [
        'let controller=1;'+call,
        'function install(controller:any){'+call+'}install(null)',
        'let ControllerButtonEvent=1;'+call,
        'let alias=controller;'+call,
        'let alias=controller.anyButton;'+call,
        'controller.anyButton=1;'+call,
        'controller.anyButton.onEvent=1;'+call,
        'ControllerButtonEvent.Pressed=2048;'+call,
        'let alias=ControllerButtonEvent;'+call,
        'controller["anyButton"].onEvent(2049,function(){})',
        'globalThis.controller.anyButton=1;'+call
    ]) {
        const imported=arcadeToPseudocode(source);
        assert.ok(imported.unsupported.length,source);
        assert.doesNotMatch(imported.code,/WHEN arcade control event handler "__bwControlEvent/);
    }
});

test('raw control registration and namespace aliases preserve the wrapper-collision refusal', () => {
    const call='controller.anyButton.onEvent(2049,function(){})';
    for (const source of [
        'control.onEvent(2049,0,function(){});'+call,
        'control.internalOnEvent(2049,0,function(){});'+call,
        'control.eventContext().registerHandler(2049,0,function(){});'+call,
        call+';control.onEvent(2049,0,function(){})',
        'let register=control.onEvent;'+call,
        'let bus=control;'+call
    ]) {
        const imported=arcadeToPseudocode(source);
        assert.ok(imported.unsupported.length,source);
        const expected=source.includes('control.onEvent(2049,0,')?1:0;
        assert.equal((imported.code.match(/arcade register control event source/g)||[]).length,expected,source);
    }
});

test('Button identity writers and controller-object escapes decline the wildcard mapping', () => {
    const call='controller.anyButton.onEvent(2049,function(){})';
    for(const before of [
        'controller.A.id=0;',
        'controller.A.id++;',
        'let button=controller.A;button.id=0;',
        'let player=controller.player1;player.buttons[0].id=0;',
        'controller.player1.buttons[0].id=0;',
        'controller.A["id"]=0;'
    ]) {
        const imported=arcadeToPseudocode(before+call);
        assert.ok(imported.unsupported.length,before);
        assert.doesNotMatch(imported.code,/WHEN arcade control event handler "__bwControlEvent/);
    }
});

test('the original configured census retains mutations hidden by opaque classes and generated source', () => {
    const call='controller.anyButton.onEvent(2049,function(){})';
    const opaque='class Opaque{callback:()=>void;constructor(){this.callback=function(){control.internalOnEvent(2049,0,function(){})}}}let opaque=new Opaque();';
    assert.equal(anyButtonConfiguredSourceSafe({'main.ts':opaque+call}),false);
    const imported=arcadeToPseudocode(opaque+call);
    assert.ok(imported.unsupported.length);
    assert.doesNotMatch(imported.code,/WHEN arcade control event handler "__bwControlEvent/);
    const files={'main.ts':call,'generated.g.ts':'controller.A.id=0;', 'pxt.json':JSON.stringify({files:['generated.g.ts','main.ts']})};
    const configured=arcadeToPseudocode(files);
    assert.ok(configured.unsupported.length);
    assert.doesNotMatch(configured.code,/WHEN arcade control event handler "__bwControlEvent/);
    files['pxt.json']=JSON.stringify({files:['main.ts']});
    assert.deepEqual(arcadeToPseudocode(files).unsupported,[],'unlisted source is outside the original configured census');
});

test('source admission expires when a retained registration is changed', () => {
    const ast=parseMakeCodeTs('controller.anyButton.onEvent(2049,function(){})',GENERATED_HELPER_PROFILES.ordinary);
    const call=ast.body[0].expr,proof=anyButtonRegistrationSource(ast);
    assert.equal(proof.has(call),true);
    call.args[0].value='2048';
    assert.equal(proof.has(call),false);
});

test('computed Function acquisition is refused before opaque bodies can disappear', () => {
    const call='controller.anyButton.onEvent(2049,function(){})';
    for(const before of [
        'let acquire=(function(){})["con"+"structor"];',
        'class Opaque{value:any;constructor(){this.value=(function(){})["con"+"structor"]}}let value=new Opaque();',
        'let acquire=Object.getPrototypeOf(function(){});'
    ]) {
        const files={'main.ts':before+call};
        assert.equal(anyButtonConfiguredSourceSafe(files),false);
        const imported=arcadeToPseudocode(files);
        assert.ok(imported.unsupported.length);
        assert.doesNotMatch(imported.code,/WHEN arcade control event handler "__bwControlEvent/);
    }
});

test('refused original source and unsupported callbacks preserve the original parse and fast-path input', () => {
    for(const source of [
        'let controller=1;controller.anyButton.onEvent(2049,function(){})',
        'control.internalOnEvent(2049,0,function(){});controller.anyButton.onEvent(2049,function(){})',
        'function handler(){}controller.anyButton.onEvent(2049,handler)',
        'controller.anyButton.onEvent(2049,function(value){})'
    ]) {
        const ast=parseMakeCodeTs(source,GENERATED_HELPER_PROFILES.ordinary),before=JSON.stringify(ast);
        const result=lowerAnyButtonRegistrations(ast,anyButtonConfiguredSourceSafe({'main.ts':source}));
        assert.strictEqual(result,ast);
        assert.equal(JSON.stringify(result),before);
    }
});

test('lexical uncertainty and active or unresolved non-TypeScript inputs veto source normalization', () => {
    const call='controller.anyButton.onEvent(2049,function(){})';
    for(const prefix of ['contr\\u006fller.A.id=0;','let value=0xZ;','let value="broken\n";'])
        assert.equal(anyButtonConfiguredSourceSafe({'main.ts':prefix+call}),false,prefix);
    for(const editor of [undefined,'pyprj','unknown','tsprj','blocksprj']) {
        const files={'main.ts':call,'main.py':'','pxt.json':JSON.stringify({files:['main.ts','main.py'],preferredEditor:editor})};
        assert.equal(anyButtonConfiguredSourceSafe(files),editor==='tsprj'||editor==='blocksprj');
        if(editor!=='tsprj'&&editor!=='blocksprj') {
            const ast=parseMakeCodeTs(call,GENERATED_HELPER_PROFILES.ordinary),before=JSON.stringify(ast);
            lowerAnyButtonRegistrations(ast,anyButtonConfiguredSourceSafe(files));assert.equal(JSON.stringify(ast),before);
        }
        delete files['main.py'];assert.equal(anyButtonConfiguredSourceSafe(files),false);
    }
    for(const name of ['native.asm','ambient.d.ts','native.cpp']) {
        const files={'main.ts':call,[name]:'','pxt.json':JSON.stringify({files:['main.ts',name],preferredEditor:'tsprj'})};
        assert.equal(anyButtonConfiguredSourceSafe(files),false,name);
    }
    const conditional={'main.ts':call,'extra.ts':'','pxt.json':JSON.stringify({files:['main.ts','extra.ts'],fileDependencies:{'extra.ts':'radio'}})};
    assert.equal(anyButtonConfiguredSourceSafe(conditional),false);
});
