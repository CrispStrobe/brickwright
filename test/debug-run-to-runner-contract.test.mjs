import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const runner = read('overlay/scratch-gui/src/lib/bw-debug/debug-runner.js');
const drawer = read('overlay/scratch-gui/src/components/tw-pseudocode/debug-drawer.jsx');
const circuit = read('overlay/scratch-gui/src/components/tw-pseudocode/circuit-tab.jsx');

test('runner pumps an active run-to once per animation frame', () => {
    assert.match(runner, /if \(activeRunTo\)[\s\S]{0,220}runToController\.pump\(\)/);
    assert.match(runner, /reason === 'running'[\s\S]{0,180}schedule\(\)/);
    assert.match(runner, /createRunToCoordinator\(\{target:/);
    assert.match(runner, /run: \(\) => session\.resume\(\)/,
        'coordinator execution must keep session intent coherent');
});

test('run-to follows reverse fork semantics and cancellation lifecycle', () => {
    const start = runner.indexOf('runToAddress(address)');
    const end = runner.indexOf('/**', start);
    const body = runner.slice(start, end);
    assert.ok(body.indexOf('beginForwardBranch()') < body.indexOf('startAddress(address)'));
    assert.match(body, /reverseCursor = null/);
    assert.match(runner, /pause\(\)[\s\S]{0,180}runToController\.cancel\(\)/);
    const destroyStart = runner.indexOf('        destroy({preserveRuntime = false} = {}) {');
    assert.ok(destroyStart >= 0, 'runner exposes destroy');
    const destroyEnd = runner.indexOf('\n        }', destroyStart);
    assert.ok(destroyEnd > destroyStart, 'destroy body has a closing method boundary');
    const destroyBody = runner.slice(destroyStart, destroyEnd);
    assert.match(destroyBody, /if \(activeRunTo\)\s*\{\s*runToController\.cancel\(\)/);
    assert.ok(destroyBody.indexOf('runToController.cancel()') < destroyBody.indexOf('runToTarget = runToController = null'),
        'destroy cancels before discarding the coordinator');
});

test('drawer exposes only explicitly capable bounded run-to targets', () => {
    assert.match(drawer, /debugCaps\.runTo/);
    assert.match(drawer, /data-run-to-address/);
    assert.match(drawer, /runToAddress\.addressMax/);
    assert.doesNotMatch(drawer, /n & 0xFFFF/,
        'the address prompt must not alias wider target addresses');
    assert.match(circuit, /runToAddress: address => runner\.runToAddress\(address\)/);
});
