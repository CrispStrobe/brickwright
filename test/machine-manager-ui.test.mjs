// The Machine Manager UI wiring (design §4.6): the code-tab device dropdown's
// "Manage machines…" entry opens a library modal that runs a saved machine
// through the shared runMachineConfig bridge (so its screen/keyboard land in the
// Widgets pane). The modal + store logic are covered behaviourally in
// bw-machines.test.mjs; this locks the JSX wiring, which node:test cannot import
// (source-text assertions, the same idiom as device-choice-contract.test.mjs).

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const O = p => readFileSync(join(HERE, '../overlay/scratch-gui/src', p), 'utf8');

test('the device dropdown offers "Manage machines…" and routes it to the modal', () => {
    const src = O('components/tw-pseudocode/pseudocode-importer.jsx');
    assert.match(src, /value="__manage__"/, 'a Manage-machines option is offered');
    // Selecting it opens the modal and does NOT change the device.
    assert.match(src, /deviceId === '__manage__'/, 'setDevice special-cases the manage entry');
    assert.match(src, /bw-open-machine-manager/, 'it dispatches the open event');
});

test('gui.jsx renders the manager, wired to the store and the run bridge', () => {
    const src = O('components/gui/gui.jsx');
    assert.match(src, /addEventListener\('bw-open-machine-manager'/, 'gui listens for the open event');
    assert.match(src, /<MachineManager\b/, 'gui renders the MachineManager');
    assert.match(src, /getMachineStore\(\)/, 'it passes the shared store');
    assert.match(src, /onRun=\{async \(cfg, opts\) => \{[\s\S]*?runMachineConfig\(cfg,/,
        'Run boots via runMachineConfig with imported media options');
});

test('the modal uses the store + importers and runs a machine', () => {
    const src = O('components/tw-pseudocode/machine-manager.jsx');
    assert.match(src, /fromMediaManifest|fromDosboxConf/, 'import routes are available');
    assert.match(src, /store\.list\(\)/, 'it lists the library from the store');
    assert.match(src, /store\.put\(/, 'import saves to the store');
    assert.match(src, /onRun\(/, 'Run hands the config to the boot bridge');
});
