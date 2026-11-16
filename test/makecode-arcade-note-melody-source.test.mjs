import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {legacyNoteMelodySourceSafe,literalLegacyNoteMelody,markLegacyNoteMelodies} from '../overlay/scratch-gui/src/lib/bw-makecode/legacy-note-melody-source.js';
import {MUSIC_MELODIES} from '../overlay/scratch-gui/src/lib/bw-makecode/music-melodies.js';
import {parseMakeCodeTs} from '../overlay/scratch-gui/src/lib/bw-makecode/ts-import.js';

test('direct literal melody-editor notes preserve their tempo and remain independent of global volume',()=>{
    for(const tempo of ['120','+240','0','-120']) {
        const source=`music.setVolume(12);music.playMelody("C5 - D E F G A B ",${tempo})`;
        const imported=arcadeToPseudocode(source);
        assert.deepEqual(imported.unsupported,[]);
        assert.match(imported.code,/arcade set music volume to \(12\)/);
        assert.match(imported.code,/arcade play note melody \("C5 - D E F G A B "\) at/);
        assert.doesNotMatch(imported.code,/arcade string playable/);
    }
});

test('nonliteral, faulting, overlong or unsupported call shapes retain a named refusal',()=>{
    for(const source of [
        'music.playMelody("C",120,1)',
        'music.playMelody("C")',
        'music.playMelody(null,120)',
        'music.playMelody("Q",120)',
        'music.playMelody("C D E F G A B C5 D",120)',
        'music.playMelody("C",Infinity)',
        'let tempo=120;music.playMelody("C",tempo)',
        'let notes="C";music.playMelody(notes,120)',
        'function tempo(){return 120}music.playMelody("C",tempo())'
    ]) {
        const imported=arcadeToPseudocode(source);
        assert.ok(imported.unsupported.some(reason=>reason.includes('music.playMelody')),source);
        assert.doesNotMatch(imported.code,/arcade play note melody/);
    }
});

test('SDK and intrinsic aliases or mutations cannot obtain the literal-note command',()=>{
    const call='music.playMelody("C5 - D C",120)';
    for(const before of [
        'let music=1;',
        'let alias=music;',
        'let alias=music.playMelody;',
        'music.playMelody=function(){};',
        'music["playMelody"]=function(){};',
        'Math.max=function(){return 1};',
        'String.prototype.split=function(){return []};',
        'Array.prototype.filter=function(){return []};',
        'let acquire=(function(){})["con"+"structor"];',
        'class Opaque{callback:any;constructor(){this.callback=function(){music.playMelody=function(){}}}}let opaque=new Opaque();'
    ]) {
        const imported=arcadeToPseudocode(before+call);
        assert.ok(imported.unsupported.length,before);
        assert.doesNotMatch(imported.code,/arcade play note melody/);
    }
});

test('original configured generated code and unresolved languages retain the source veto',()=>{
    const call='music.playMelody("C",120)';
    for(const [name,text] of [['generated.g.ts','music.playMelody=function(){};'],['native.asm','nop'],['main.py',''],['ambient.d.ts','declare const hidden:number;']]) {
        const files={'main.ts':call,[name]:text,'pxt.json':JSON.stringify({files:['main.ts',name]})};
        assert.equal(legacyNoteMelodySourceSafe(files),false,name);
        assert.doesNotMatch(arcadeToPseudocode(files).code,/arcade play note melody/);
    }
    for(const editor of ['tsprj','blocksprj']) {
        const files={'main.ts':call,'main.py':'','pxt.json':JSON.stringify({files:['main.ts','main.py'],preferredEditor:editor})};
        assert.equal(legacyNoteMelodySourceSafe(files),true);
        assert.deepEqual(arcadeToPseudocode(files).unsupported,[]);
    }
    for(const prefix of ['mu\\u0073ic.playMelody=function(){};','let invalid="broken\n";'])
        assert.equal(legacyNoteMelodySourceSafe({'main.ts':prefix+call}),false);
});

test('only original unbound literal calls are marked, without changing source argument evaluation',()=>{
    const source='music.playMelody("C5 - D C",-120)',ast=parseMakeCodeTs(source),call=ast.body[0].expr;
    const args=call.args,callee=call.callee;
    assert.equal(literalLegacyNoteMelody(call),true);markLegacyNoteMelodies(ast,true);
    assert.equal(call.bwPxtLegacyNoteMelody,true);assert.strictEqual(call.args,args);assert.strictEqual(call.callee,callee);
    const rejected=parseMakeCodeTs('let music=1;music.playMelody("C",120)');markLegacyNoteMelodies(rejected,true);
    assert.equal(rejected.body[1].expr.bwPxtLegacyNoteMelody,undefined);
});


test('literal note melodies coexist with exact known singleton zero-argument play calls',()=>{
    for(const name of MUSIC_MELODIES) {
        const source=`music.${name}.play();music.playMelody("C5 - D C",120);music.${name}.play(/* no arguments */)`;
        assert.equal(legacyNoteMelodySourceSafe({'main.ts':source}),true,name);
        const imported=arcadeToPseudocode(source);
        assert.deepEqual(imported.unsupported,[],name);
        assert.match(imported.code,/arcade play note melody/);
        assert.equal(imported.code.split(`arcade play melody (arcade melody ${name}) mode play`).length-1,2,name);
        assert.ok(imported.code.indexOf('mode play')<imported.code.indexOf('arcade play note melody'));
        assert.ok(imported.code.lastIndexOf('mode play')>imported.code.indexOf('arcade play note melody'));
    }
});

test('singleton coexistence preserves root, member, alias, optional and reflection vetoes',()=>{
    const call='music.playMelody("C5 - D C",120);music.baDing.play()';
    for(const before of [
        'let music=1;',
        'function scoped(music:any){music.baDing.play()} ',
        'music.baDing=function(){};',
        'music.baDing.play=function(){};',
        'music.baDing.play.foo=1;',
        'music.baDing.play++;',
        'delete music.baDing.play;',
        'let alias=music.baDing;',
        'let alias=music.baDing.play;',
        'music["baDing"].play();',
        'music.baDing["play"]();',
        'music?.baDing.play();',
        'music.baDing?.play();',
        'music.baDing.play?.();',
        'Object.defineProperty(music.baDing,"play",{});',
        'music.baDing.play(12);',
        'music.baDing.playUntilDone();',
        'music.baDing.loop();',
        'music.unknownMelody.play();',
        'class Opaque{constructor(){music.baDing.play=function(){}}}',
        'mu\\u0073ic.baDing.play=function(){};'
    ]) {
        const source=before+call;
        assert.equal(legacyNoteMelodySourceSafe({'main.ts':source}),false,before);
        // Optional/escaped syntax can be outside the parser grammar. Its
        // original bytes must veto regardless of subsequent parse behavior.
        if(!before.includes('?.')&&!before.includes('\\u'))assert.doesNotMatch(arcadeToPseudocode(source).code,/arcade play note melody/,before);
    }
    const files={'main.ts':call,'hidden.g.ts':'music.baDing.play=function(){}',
        'pxt.json':JSON.stringify({files:['main.ts','hidden.g.ts']})};
    assert.equal(legacyNoteMelodySourceSafe(files),false);
    assert.doesNotMatch(arcadeToPseudocode(files).code,/arcade play note melody/);
});
