// SPDX-License-Identifier: BSD-3-Clause
// Actual pane frame method at a controlled callback boundary; these are not guest physics fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/sim-lab-pane.jsx', import.meta.url), 'utf8');
const start = source.indexOf('    frame (now) {');
const end = source.indexOf('    // ---- Simulate:', start);
assert.ok(start >= 0 && end > start);
const frame = new Function('MAX_FRAME_MS', 'requestAnimationFrame', `return (${source.slice(start, end).trim().replace(/^frame\s*/, 'function ')});`)(100, () => 1);
const paneAt = (status, time) => {
    const pane = {last: null, clock: null, editView: null, view: null, challengeRun: null,
        session: {time, failed: null, tick () {throw new Error('observation advanced physics');}},
        measurementSampleTime: 0, measurementRowsTime: 0, measurements: [], measurementRows: [{value: 'old'}], reads: 0,
        state: {status, simMs: 0, readings: false, measurementsOpen: true, replayAt: null, measurementTick: 0},
        record () {}, setState (update) {Object.assign(this.state, typeof update === 'function' ? update(this.state) : update);}};
    pane.measurementReader = {read: () => {pane.reads++; return [{value: pane.session.time}];}};
    return pane;
};

test('a final short reply after Pause refreshes once without advancing physics or flooding idle frames', () => {
    const pane = paneAt('paused', 50);
    frame.call(pane, 10);
    assert.equal(pane.reads, 1); assert.equal(pane.measurementRows[0].value, 50);
    assert.equal(pane.measurementSampleTime, 50); assert.equal(pane.measurementRowsTime, 50); assert.equal(pane.session.time, 50);
    frame.call(pane, 20);
    assert.equal(pane.reads, 1, 'unchanged paused time is not sampled repeatedly');
    pane.session.time = 60; frame.call(pane, 30);
    assert.equal(pane.reads, 2); assert.equal(pane.measurementRows[0].value, 60);
});

test('running and stopping retain the existing simulated-time sampling interval', () => {
    for (const status of ['running', 'stopping']) {
        const early = paneAt(status, 50); frame.call(early, 10); assert.equal(early.reads, 0); assert.equal(early.measurementRowsTime, 0);
        const due = paneAt(status, 100); frame.call(due, 10); assert.equal(due.reads, 1); assert.equal(due.measurementRowsTime, 100);
    }
});

test('visible overlays keep committed samples updating when the measurement panel is closed', () => {
    const pane=paneAt('paused',100);pane.state.measurementsOpen=false;pane.state.showMeasurements=true;
    frame.call(pane,10);assert.equal(pane.reads,1);assert.equal(pane.measurementRowsTime,100);
    frame.call(pane,20);assert.equal(pane.reads,1);
});

test('overlay and draft render reads cannot advance the committed sampling stream', () => {
    const start=source.indexOf('            this.view.setMeasurements(() => {');
    const end=source.indexOf('\n            this.view.render(session.viewSnapshot());',start);
    assert.ok(start>=0&&end>start);
    let display;
    const install=new Function('measurementWords',source.slice(start,end));
    const committed=[{kind:'speed',label:'speed',value:4}], pane={locale:'en',
        state:{replayAt:null,showMeasurements:true,measurementsOpen:true},measurements:[{kind:'acceleration'}],
        measurementRows:committed,measurementPreview:{kind:'distance'},
        measurementReader:{read(){throw Error('render advanced committed sample stream');}},
        measurementPreviewReader:{read:()=>[{label:'preview',value:8}]},
        view:{setMeasurements:callback=>{display=callback;}}};
    install.call(pane,()=>({kinds:{speed:'Speed'}}));
    for(let i=0;i<20;i++)assert.deepEqual(display().map(r=>r.value),[4,8]);
    assert.equal(pane.measurementRows,committed);
    pane.state.replayAt=0;assert.deepEqual(display(),[]);
});
