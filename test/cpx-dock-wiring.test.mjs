/**
 * The Circuit Playground Express board reaches the screen (task A9 phase 1):
 * a DEVICE CPX program gets a stage-header button that opens a `cpx` dock,
 * the dock renders the CPX pane, the pane is restored only for a CPX
 * program, and the extension the pane drives is one Lite knows how to load.
 *
 * Source-level, like device-choice-contract.test.mjs for the Arduboy: each
 * assertion names the one wire it holds, so a removed wire fails by name.
 * What the board DOES is held by cpx-device-world.test.mjs against MakeCode's
 * own simulator.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const header = read('overlay/scratch-gui/src/components/stage-header/stage-header.jsx');
const gui = read('overlay/scratch-gui/src/components/gui/gui.jsx');
const pane = read('overlay/scratch-gui/src/components/tw-pseudocode/cpx-device-pane.jsx');
const manager = read('overlay/scratch-vm/src/extension-support/extension-manager.js');
const library = read('overlay/scratch-gui/src/lib/libraries/extensions/index.jsx');

test('a DEVICE CPX program gets a button that opens the cpx dock', () => {
    assert.match(header, /appliedProjectDevice\(vm\.runtime\) === 'cpx'/,
        'the button is not gated on the program being DEVICE CPX');
    assert.match(header, /\.\.\.\(deviceIsCpx \? \[\{\s*handleClick: \(\) => \{ setCircuitView\(\{fullWidth: true, dock: 'cpx'\}\)/,
        'the button opens no cpx dock');
    assert.match(header, /if \(dock === 'cpx'\) return 'cpx';/,
        'viewForDock does not know the cpx dock, so the button never looks selected');
    assert.match(header, /setDeviceIsCpx\(value === 'cpx'\)/, 'a device change does not update the button');
});

test('the cpx dock renders the CPX pane, and restores only for a CPX program', () => {
    assert.match(gui, /import\(\/\* webpackChunkName: "bw-cpx-device" \*\/ '\.\.\/tw-pseudocode\/cpx-device-pane\.jsx'\)/);
    assert.match(gui, /dockMode === 'cpx' \? \([\s\S]{0,300}<CpxDevicePane vm=\{vm\} \/>/, 'gui.jsx renders no pane for it');
    const initializer = gui.match(/const \[dockMode, setDockMode\] = React\.useState\(\(\) => \{([\s\S]*?)^    \}\);/m);
    assert.ok(initializer, 'the right-pane restore logic is missing');
    const restore = new Function('localStorage', 'props', initializer[1]);
    const storage = {getItem: key => key === 'bw-debug-dock' ? 'cpx' : null};
    const propsFor = runtime => ({vm: {runtime}});
    assert.equal(restore(storage, propsFor({bwDeviceId: 'cpx'})), 'cpx');
    assert.equal(restore(storage, propsFor({stc: {device: 'cpx'}})), 'cpx');
    assert.equal(restore(storage, propsFor({bwDeviceId: 'arduino-uno', stc: {device: 'cpx'}})), 'top');
    assert.equal(restore(storage, propsFor({})), 'top');
});

test('the pane draws the extension\'s state and drives the board only through its input API', () => {
    assert.match(pane, /runtime\.on\('CPX_STATE', changed\)/);
    assert.match(pane, /runtime\.removeListener\('CPX_STATE', changed\)/, 'the listener outlives the pane');
    for (const call of ['setButton', 'setSwitch', 'setLightLevel', 'setTemperature', 'setSoundLevel', 'setAcceleration', 'gesture']) {
        assert.match(pane, new RegExp(`board\\.${call}\\(`), `the pane never calls ${call}`);
    }
    assert.match(pane, /loadExtensionURL\('circuitplayground'\)/, 'a pane opened first never loads the board');
});

test('Lite knows the circuitplayground extension', () => {
    assert.match(manager, /circuitplayground: \(\) => import\(\/\* webpackChunkName: "ext-circuitplayground" \*\/ '\.\.\/extensions\/crispstrobe\/circuitplayground\/index\.js'\)/);
    assert.match(library, /extensionId: 'circuitplayground'/);
});
