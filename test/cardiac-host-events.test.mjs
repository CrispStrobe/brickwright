// SPDX-License-Identifier: BSD-3-Clause
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCardiacWorkspace, CARDIAC_WORKSPACE_KEY, validateCardiacWorkspace} from '../overlay/scratch-gui/src/lib/cardiac-project.js';

const hostSource = readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/cardiac-host.jsx', import.meta.url), 'utf8');
const controlsSource = readFileSync(new URL('../overlay/scratch-gui/src/containers/controls.jsx', import.meta.url), 'utf8');

// Run the mounted consumer's actual closure body with observable collaborators,
// avoiding a copied restoration algorithm and without claiming React rendering.
function restoreFixture (restored) {
    const match = /const restore = event => \{([\s\S]*?)\n        \};/.exec(hostSource);
    assert.ok(match, 'the production restore consumer exists');
    assert.match(hostSource, /addEventListener\('bw-project-bundle-loaded', restore\)/);
    const calls = [];
    const current = {current: {source: 'current draft'}};
    const generation = {current: 7};
    const callbacks = {current: {runner: {
        pause: () => calls.push(['pause']),
        cardiacSnapshot: () => ({pc: 8, acc: 42, steps: 15}),
        cardiacControl: (...args) => calls.push(args)
    }}};
    const fn = new Function('callbacks', 'generation', 'current', 'initialWorkspace', 'setWorkspace',
        'setPrediction', 'setBusy', 'CARDIAC_WORKSPACE_KEY', `return event => {${match[1]}};`)(
        callbacks, generation, current, () => restored, value => calls.push(['workspace', value]),
        value => calls.push(['prediction', value]), value => calls.push(['busy', value]), CARDIAC_WORKSPACE_KEY);
    return {restore: fn, calls, current, generation};
}

test('refused bundle announcements cannot pause or reset a live CARDIAC run', () => {
    const fixture = restoreFixture(createCardiacWorkspace('ORG 01\nHRS'));
    const before = fixture.current.current;
    for (const outcome of ['future', 'invalid', 'storage-failed']) {
        fixture.restore({type: 'bw-project-bundle-loaded', detail: {outcome}});
    }
    assert.deepEqual(fixture.calls, []);
    assert.equal(fixture.current.current, before);
    assert.equal(fixture.generation.current, 7);
});

test('an accepted bundle restores the authored image paused, independently of an unfinished draft', () => {
    const workspace = {...createCardiacWorkspace('CLA unfinished'), active: false,
        loadedProgram: {entry: 10, words: [{address: 10, value: 580}, {address: 11, value: 900}, {address: 80, value: 42}]}};
    const fixture = restoreFixture(workspace);
    fixture.restore({type: 'bw-project-bundle-loaded', detail: {outcome: 'loaded'}});
    assert.equal(fixture.generation.current, 8);
    assert.equal(fixture.current.current, workspace);
    assert.deepEqual(fixture.calls[0], ['pause']);
    assert.deepEqual(fixture.calls.find(call => call[0] === 'loadProgram'), ['loadProgram', workspace.loadedProgram]);
    assert.equal(fixture.calls.some(call => ['resume', 'start', 'enqueueInput'].includes(call[0])), false);
});

test('a user import in the selected CARDIAC host marks its saved draft active', () => {
    const match = /const save = next => \{([\s\S]*?)\n    \};/.exec(hostSource);
    assert.ok(match, 'the production host save operation exists');
    const current = {current: createCardiacWorkspace('old source')};
    const stored = new Map();
    const localStorage = {setItem: (key, value) => stored.set(key, value)};
    const save = new Function('current', 'validateCardiacWorkspace', 'setWorkspace', 'localStorage',
        'CARDIAC_WORKSPACE_KEY', 'setError', 'locale', `return next => {${match[1]}};`)(
        current, validateCardiacWorkspace, () => {}, localStorage, CARDIAC_WORKSPACE_KEY,
        message => assert.fail(message), 'en');
    const imported = {...createCardiacWorkspace('CLA unfinished', '042\n-'), active: false};
    const result = save(imported);
    assert.deepEqual(result, {...imported, active: true});
    assert.deepEqual(JSON.parse(stored.get(CARDIAC_WORKSPACE_KEY)), {...imported, active: true});
    assert.equal(imported.active, false, 'the imported value is not mutated');
});

test('storage refresh ignores another key and clears the old image when this workspace has none', () => {
    const fixture = restoreFixture(createCardiacWorkspace('unfinished source'));
    fixture.restore({type: 'storage', key: 'bw-theme'});
    assert.deepEqual(fixture.calls, []);
    fixture.restore({type: 'storage', key: CARDIAC_WORKSPACE_KEY});
    assert.deepEqual(fixture.calls.find(call => call[0] === 'loadProgram'), ['loadProgram', {words: [], entry: 0}]);
});

function globalControlFixture (kind) {
    const calls = [];
    const handlers = new Map();
    const window = {
        __bwMachineExtracted: kind ? {kind} : undefined,
        dispatchEvent: event => {calls.push(['event', event.type]); handlers.get(event.type)?.(event);},
        setTimeout: fn => fn()
    };
    const CustomEvent = class {constructor (type) {this.type = type;}};
    const names = ['handleGreenFlagClick', 'handleStopAllClick'];
    const methods = names.map(name => {
        const found = new RegExp(`^    ${name} \\([^\\n]*\\) \\{[\\s\\S]*?^    \\}`, 'm').exec(controlsSource);
        assert.ok(found, `production control ${name} exists`);
        return found[0];
    });
    const controls = new Function('window', 'CustomEvent', `return {${methods.join(',\n')}};`)(window, CustomEvent);
    controls.props = {isStarted: true, turbo: false, vm: {
        runtime: {bwDeviceId: 'arduino-uno'},
        greenFlag: () => calls.push(['scratch-green-flag']),
        stopAll: () => calls.push(['scratch-stop']),
        setTurboMode: value => calls.push(['turbo', value])
    }};
    const run = /const runRequest = ([^;]+);/.exec(hostSource);
    assert.ok(run, 'the real host run request exists');
    assert.match(hostSource, /addEventListener\('bw-cardiac-run-request', runRequest\)/);
    handlers.set('bw-cardiac-run-request', new Function('load', `return ${run[1]};`)(start => calls.push(['source-run', start])));
    const stop = /const stopRequest = \(\) => \{([\s\S]*?)\n        \};/.exec(hostSource);
    assert.ok(stop, 'the real host stop request exists');
    assert.match(hostSource, /addEventListener\('bw-cardiac-stop-request', stopRequest\)/);
    const generation = {current: 1};
    handlers.set('bw-cardiac-stop-request', new Function('generation', 'callbacks', 'setBusy', `return () => {${stop[1]}};`)(
        generation, {current: {runner: {pause: () => calls.push(['pause'])}}}, value => calls.push(['busy', value])));
    return {controls, calls, generation, click: {preventDefault () {}, shiftKey: false}};
}

test('the global green flag reaches the selected CARDIAC host without starting Scratch', () => {
    const fixture = globalControlFixture('cardiac');
    fixture.controls.handleGreenFlagClick(fixture.click);
    assert.deepEqual(fixture.calls, [['event', 'bw-cardiac-run-request'], ['source-run', true]]);
});

test('global Stop pauses CARDIAC and cancels pending actions without stopping an unrelated VM', () => {
    const fixture = globalControlFixture('cardiac');
    fixture.controls.handleStopAllClick(fixture.click);
    assert.deepEqual(fixture.calls, [['event', 'bw-cardiac-stop-request'], ['pause'], ['busy', false]]);
    assert.equal(fixture.generation.current, 2);
});

test('CARDIAC routing preserves the existing shift/turbo and CP1 control paths', () => {
    const cardiac = globalControlFixture('cardiac');
    cardiac.controls.handleGreenFlagClick({...cardiac.click, shiftKey: true});
    assert.deepEqual(cardiac.calls, [['turbo', true]]);
    const cp1 = globalControlFixture('cp1');
    cp1.controls.handleGreenFlagClick(cp1.click);
    cp1.controls.handleStopAllClick(cp1.click);
    assert.deepEqual(cp1.calls, [['event', 'bw-cp1-run-request'], ['event', 'bw-cp1-stop-request']]);
});
