// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraPointerIntent as intent} from '../overlay/scratch-gui/src/lib/editor-interaction/camera-pointer.js';
test('all editor profiles agree on Space-left-drag pan and preserve unmodified selection',()=>{
    for(const preset of ['brickwright','studio','tinkercad','fusion']){
        assert.equal(intent({button:0},preset),undefined);
        assert.equal(intent({button:0},preset,true),'pan');
        assert.equal(intent({button:0,altKey:true,ctrlKey:true},preset,true),'pan');
        assert.equal(intent({button:3},preset,true),undefined);
    }
});
test('Robot profiles reserve modifiers for part actions and retain middle/right navigation',()=>{
    for(const preset of ['brickwright','studio'])for(const modifier of ['altKey','ctrlKey','shiftKey'])assert.equal(intent({button:0,[modifier]:true},preset),undefined);
    assert.equal(intent({button:1},'brickwright'),'orbit');assert.equal(intent({button:2},'brickwright'),'pan');
    assert.equal(intent({button:1},'studio'),'pan');assert.equal(intent({button:2,shiftKey:true},'studio'),'orbit');
});
test('CAD profiles retain modifier orbit, right orbit/Shift-pan, and Fusion Shift-middle orbit',()=>{
    for(const preset of ['tinkercad','fusion']){
        assert.equal(intent({button:0,ctrlKey:true},preset),'orbit');assert.equal(intent({button:0,altKey:true},preset),'orbit');
        assert.equal(intent({button:2},preset),'orbit');assert.equal(intent({button:2,shiftKey:true},preset),'pan');
    }
    assert.equal(intent({button:1,shiftKey:true},'tinkercad'),'pan');assert.equal(intent({button:1,shiftKey:true},'fusion'),'orbit');
});
