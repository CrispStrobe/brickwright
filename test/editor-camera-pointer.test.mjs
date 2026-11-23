// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraPointerIntent as intent, cameraTrackpadWheel} from '../overlay/scratch-gui/src/lib/editor-interaction/camera-pointer.js';
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

test('embedded editors share middle and secondary button mappings', () => {
    for (const preset of ['studio', 'tinkercad']) {
        assert.equal(intent({button: 1}, preset, false, 'orbit'), 'pan');
        assert.equal(intent({button: 1, shiftKey: true}, preset, false, 'orbit'), 'orbit');
        assert.equal(intent({button: 2}, preset, false, 'orbit'), 'orbit');
        assert.equal(intent({button: 2, shiftKey: true}, preset, false, 'orbit'), 'pan');
        assert.equal(intent({button: 2}, preset, false, 'pan'), 'pan');
        assert.equal(intent({button: 2, shiftKey: true}, preset, false, 'pan'), 'orbit');
    }
});

test('precise scroll uses the shared mapping and pinch or detents zoom', () => {
    const slide = {deltaX: 2, deltaY: 12, deltaMode: 0};
    assert.deepEqual(cameraTrackpadWheel(slide, 'pan', 800), {kind: 'pan', dx: 2, dy: 12});
    assert.equal(cameraTrackpadWheel({...slide, shiftKey: true}, 'pan', 800).kind, 'orbit');
    assert.equal(cameraTrackpadWheel({...slide, shiftKey: true}, 'orbit', 800).kind, 'pan');
    assert.equal(cameraTrackpadWheel({...slide, deltaX: 0, deltaY: 100, precise: true}, 'orbit', 800).kind, 'orbit');
    assert.equal(cameraTrackpadWheel(slide, 'zoom', 800).kind, 'zoom');
    assert.equal(cameraTrackpadWheel({...slide, ctrlKey: true}, 'orbit', 800).kind, 'zoom');
    assert.deepEqual(cameraTrackpadWheel({...slide, precise: false, deltaMode: 1}, 'pan', 800),
        {kind: 'zoom', dx: 32, dy: 192});
    assert.equal(cameraTrackpadWheel({...slide, deltaY: NaN}, 'pan', 800), undefined);
});
