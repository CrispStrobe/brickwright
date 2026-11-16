// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
/**
 * The headless Robot Lab runner (test/helpers/robot-lab-direct-vm.mjs) must run a
 * program on the SAME schedule as the pane, or a model gate judges a run the browser
 * never makes. The pane puts the VM on bw-sim/sim-clock.js's SimLabClock: the
 * program's time is an integer epoch plus the simulated ms the world has applied
 * (SimLabClock.now()). The runner used FakeClock's Date.now(), which accumulates
 * `now += 33.333…` on a 1.7e12 base and so rounds every frame down by ~8e-5 ms:
 * a `wait` of a whole number of frames ended one frame later headlessly. That one
 * frame flipped Bloom (stage 2 trim, NaN at 17.0 s, encoder 3492.7° at 26.6 s,
 * exactly as in system Chrome) and Rack Decoder (stage 5 comparison-window guard
 * at 73.5 s) from "complete" headlessly to failing in the browser.
 *
 * The expected frame counts are not literals: they come from SimLabClock itself,
 * stepped the way the pane steps it.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runRobotLabProgram} from './helpers/robot-lab-direct-vm.mjs';
import {SimLabClock} from '../overlay/scratch-gui/src/lib/bw-sim/sim-clock.js';

const FRAME_MS = 1000 / 30;
const WAITS_MS = [300, 500, 1000, 50];
const read = rel => readFileSync(new URL('../overlay/scratch-gui/static/sim-lab/' + rel, import.meta.url), 'latin1');

/** Frames a Scratch `wait` of each length lasts on the pane's program clock (SimLabClock, 30 fps steps). */
const paneWaitFrames = async () => {
    const queued = [];
    const clock = new SimLabClock({defer: fn => queued.push(fn), wallNow: () => 0});
    const session = {time: 0, failed: null, tick (ms) { this.time += ms; }, idle: () => Promise.resolve()};
    const runtime = {currentStepTime: FRAME_MS, currentMSecs: 0, _step () {}};
    assert.ok(clock.install(runtime, session));
    // currentMSecs as each VM step sees it (the VM refreshes it at the start of _step).
    const seen = [];
    for (let k = 0; k < 200; k++) {
        runtime.updateCurrentMSecs();
        seen.push(runtime.currentMSecs);
        runtime._step();
        while (queued.length) { queued.shift()(); await Promise.resolve(); await Promise.resolve(); }
    }
    clock.uninstall();
    // A wait started at step s finishes at the first step whose time is >= start + duration.
    return WAITS_MS.map(ms => {
        const s = 3;
        let k = 1;
        while (seen[s + k] - seen[s] < ms) k++;
        return k;
    });
};

test('a wait lasts as many frames headlessly as on the pane\'s program clock', async () => {
    const expected = await paneWaitFrames();
    // The pane's clock is exact at whole frames: 0.3 s, 0.5 s, 1 s are 9, 15, 30 frames.
    assert.deepEqual(expected, [9, 15, 30, 2]);
    const program = [
        'GLOBAL phase',
        '',
        'WHEN flag clicked:',
        '  set phase to 1',
        ...WAITS_MS.flatMap((ms, i) => [`  wait ${ms / 1000} seconds`, `  set phase to ${i + 2}`])
    ].join('\n') + '\n';
    const firstSeen = new Map();
    await runRobotLabProgram(program, {
        modelText: read('models/motor-bench.ldr'), timeLimitMs: 4000, frameMs: FRAME_MS,
        observeFrame: ({session, vm}) => {
            const phase = Number(vm.runtime.targets.flatMap(t => Object.values(t.variables || {})).find(v => v.name === 'phase')?.value);
            if (!firstSeen.has(phase)) firstSeen.set(phase, session.time);
        }
    });
    const frames = WAITS_MS.map((_, i) => Math.round((firstSeen.get(i + 2) - firstSeen.get(i + 1)) / FRAME_MS));
    assert.deepEqual(frames, expected, 'each wait must end on the frame the pane ends it on');
});

test('last-frame mode preserves real VM finish, timeout and observer failure cleanup', async()=>{
    const source='WHEN flag clicked:\n  wait 0.3 seconds\n';
    const options={modelText:read('models/motor-bench.ldr'),timeLimitMs:1000};
    const full=await runRobotLabProgram(source,options),bounded=await runRobotLabProgram(source,{...options,retainTrack:false});
    assert.ok(full.track.length>1);assert.equal(bounded.track.length,1);assert.equal(bounded.finishedAt,full.finishedAt);assert.deepEqual(bounded.track[0],full.track.at(-1));
    const timed=await runRobotLabProgram('WHEN flag clicked:\n  wait 10 seconds\n',{...options,retainTrack:false});assert.equal(timed.finishedAt,null);assert.equal(timed.track.length,1);assert.ok(timed.track[0].t>=1000-1e-6);
    const originalNow=Date.now;
    await assert.rejects(runRobotLabProgram(source,{...options,retainTrack:false,observeFrame:()=>{throw Error('observer failed');}}),/observer failed/);assert.equal(Date.now,originalNow);
});
