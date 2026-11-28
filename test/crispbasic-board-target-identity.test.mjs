// The standalone runtime carries only derived pad data, checked against the
// installed exact upstream pin whenever the full workbench suite runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {PORTABLE_GPIO_PROFILES} from 'bw-board/portable-gpio.js';
import catalog from '../packages/crisp-basic/src/board-target-catalog.mjs';
import {listBoardTargets} from '../packages/crisp-basic/src/board-targets.mjs';
import {renderBoardTargetCatalog} from '../packages/crisp-basic/scripts/sync-board-targets.mjs';

const require = createRequire(import.meta.url);
const pin = JSON.parse(readFileSync(new URL('../vendor-pins.json', import.meta.url), 'utf8'))['bw-board'];
const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
const source = readFileSync(require.resolve('bw-board/portable-gpio.js'));

test('named targets derive from the exact pinned upstream GPIO inventory', () => {
    assert.equal(catalog.schemaVersion, 1);
    assert.equal(catalog.provenance.repository, 'CrispStrobe/bw-board');
    assert.equal(catalog.provenance.commit, pin);
    assert.equal(catalog.provenance.path, 'src/portable-gpio.js');
    assert.ok(lock.packages['node_modules/bw-board'].resolved.endsWith('#' + pin));
    assert.deepEqual(catalog.profiles, PORTABLE_GPIO_PROFILES);
    assert.equal(readFileSync(new URL('../packages/crisp-basic/src/board-target-catalog.mjs', import.meta.url), 'utf8'),
        renderBoardTargetCatalog({profiles: PORTABLE_GPIO_PROFILES, pin, source}));
});

test('standalone targets preserve canonical terminals and source model metadata', () => {
    const targets = listBoardTargets();
    assert.equal(targets.length, PORTABLE_GPIO_PROFILES.length);
    for (const profile of PORTABLE_GPIO_PROFILES) {
        const target = targets.find(entry => entry.id === profile.kind);
        assert.ok(target, profile.kind);
        assert.deepEqual(target.pins, profile.pins);
        for (const key of ['label', 'numbering', 'help', 'nominalVoltage']) assert.equal(target[key], profile[key]);
        assert.equal(target.execution, 'host-driven-logical-simulation');
        assert.equal(target.nativeInterpreter, false);
        assert.equal(target.circuitPhysics, false);
        assert.equal(target.hardware, false);
    }
});
