// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {installCadProgramAPI, CAD_READY_EVENT, CAD_OPEN_EVENT} from '../overlay/scratch-gui/src/lib/bw-cad-program.js';
import {setCadEnabled} from '../overlay/scratch-gui/src/lib/bw-cad-preferences.js';
import {loadExtensionClass} from './helpers/bw-extensions.mjs';
test('CAD block bridge keeps opt-in, cancels lazy starts on stop, and shares actual motor calls and encoder reporters', async () => {
    const previousWindow = globalThis.window, previousFlag = process.env.BW_ENABLE_CAD;
    globalThis.window = new EventTarget(); process.env.BW_ENABLE_CAD = '1';
    const runtime = new EventEmitter(); const calls = [];
    const cleanup = installCadProgramAPI(runtime);
    try {
        let opened = 0; window.addEventListener(CAD_OPEN_EVENT,()=>opened++);
        setCadEnabled(false);
        await assert.rejects(runtime.cadSimulation.start(), /Enable CAD/);
        assert.equal(opened,0); assert.equal(runtime.cadSimulation.status(),'disabled');
        setCadEnabled(true);
        const waiting = runtime.cadSimulation.start();
        assert.equal(opened,1);
        runtime.emit('PROJECT_STOP_ALL');
        await assert.rejects(waiting,/stopped/);
        globalThis.__bwCad = {editor:{simulation:{
            state:{state:'running'},motors:()=>[{id:'joint-7',port:'A',name:'Yellow motor'}],
            start: async (...args)=>calls.push(['start',...args]), stop:()=>calls.push(['stop']),
            reset:()=>calls.push(['reset']),setMotor:async (...args)=>calls.push(['motor',...args]),
            runDegrees:async (...args)=>calls.push(['degrees',...args]),stopMotor:async (...args)=>calls.push(['stopMotor',...args]),
            angle:()=>721.5,speed:()=>179.5
        }}};
        window.dispatchEvent(new CustomEvent(CAD_READY_EVENT));
        assert.equal(calls.length,0,'canceled lazy command never starts later');
        const Ext=loadExtensionClass('cadlab');
        const ext = new Ext(runtime);
        assert.deepEqual(ext.motorMenu(),[{text:'A · Yellow motor',value:'A'}]);
        await ext.setMotorPower({MOTOR:'A',POWER:50});
        await ext.runMotorDegrees({MOTOR:'A',DEGREES:720,SPEED:180});
        assert.deepEqual(calls,[['motor','A',360],['degrees','A',720,180]]);
        assert.equal(ext.motorAngle({MOTOR:'A'}),721.5); assert.equal(ext.motorSpeed({MOTOR:'A'}),179.5);
        runtime.emit('PROJECT_STOP_ALL'); assert.deepEqual(calls.at(-1),['stop']);
        setCadEnabled(false); assert.equal(ext.labStatus(),'disabled');
        assert.equal(ext.getInfo().id,'cadlab');
        assert.ok(!ext.getInfo().menus.stopActions.items.some(i=>i.value==='hold'));
    } finally {cleanup(); delete globalThis.__bwCad; globalThis.window=previousWindow;
        if(previousFlag===undefined)delete process.env.BW_ENABLE_CAD;else process.env.BW_ENABLE_CAD=previousFlag;}
});
