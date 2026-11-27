// The CP/M 2.2 lesson: DRI's real CCP+BDOS + BBC BASIC (Z80), offered as a
// one-click machine in the Machine Manager. Its media is SELF-CONTAINED — the
// ROMs ship in this app (static/roms), nothing is fetched from media-lab — but
// like every lesson it is still gated by the machine-image policy axis
// (test/native-store-code-policy.test.mjs). Checks the config, its real-CP/M
// boot activation, and its bilingual strings. The live boot is covered by
// scripts/verify-cpm-system.mjs (the Machine Manager gate).
import {test} from 'node:test';
import assert from 'node:assert/strict';

import {
    lessonMachines, lessonT, LESSON_STRINGS
} from '../overlay/scratch-gui/src/lib/bw-machines/lessons.js';
import {validateMachineConfig, MACHINE_KINDS} from '../overlay/scratch-gui/src/lib/bw-machines/machine-config.js';
import {activateConfig} from '../overlay/scratch-gui/src/lib/bw-machines/activate.js';
import {runMachineConfig} from '../overlay/scratch-gui/src/lib/bw-machines/run-machine.js';

const cpmRow = (loc = 'en') => lessonMachines(loc).find(r => r.config.id === 'lesson-cpm-z80');

test('CP/M lesson: a valid, self-contained z80 cpm-system config', () => {
    const row = cpmRow();
    assert.ok(row, 'the CP/M lesson is offered');
    const {config} = row;
    assert.ok(MACHINE_KINDS.includes('z80'));
    assert.deepEqual(validateMachineConfig(config), {ok: true, errors: []});
    assert.equal(config.machine, 'z80');
    assert.equal(config.bootOrder[0], 'cpmsys', 'the cpmsys slot selects the real CP/M boot');
    assert.deepEqual(Object.keys(config.slots), ['cpmsys']);
    assert.ok(!row.coldConfig, 'no "boot from scratch" variant');
});

test('CP/M lesson: SELF-CONTAINED — every slot is a same-origin static asset', () => {
    const {config} = cpmRow();
    for (const [slot, ref] of Object.entries(config.slots)) {
        assert.ok(/^static\//.test(ref.url), `${slot} is a same-origin static asset (${ref.url}), not remote media`);
        assert.ok(!/^https?:/.test(ref.url), `${slot} is not fetched over the network`);
    }
});

test('CP/M lesson: activates into the z80 real-CP/M boot', async () => {
    const {config} = cpmRow();
    const asked = [];
    const fetcher = async ref => { asked.push(ref.url); return {bytes: new Uint8Array([0xc9]), sha256: ref.sha256}; };
    const activated = await activateConfig(config, {fetcher});
    assert.equal(activated.targetKind, 'z80', 'folds onto the z80 debug target');
    assert.equal(activated.bootMedia.slot, 'cpmsys');
    assert.equal(activated.bootMedia.name, 'BBCBASIC.COM');
    assert.equal(activated.bootMedia.profile, 'cpm-system', 'the cpmsys slot selects the real CP/M 2.2 boot path');
    assert.ok(asked.some(u => /static\/roms\/bbcbasic\.com$/.test(u)), 'BBC BASIC is the drive-A: program');
});

test('CP/M lesson waits for a successful attach and surfaces a failed one', async () => {
    const base = {
        awaitBoot: true,
        fetcher: async () => ({bytes: new Uint8Array([0xc9])})
    };
    const result = await runMachineConfig(cpmRow().config, {
        ...base,
        dispatch(detail) {
            assert.equal(detail.profile, 'cpm-system');
            detail.bootCompletion.resolve();
        }
    });
    assert.equal(result.mode, 'functional');
    await assert.rejects(runMachineConfig(cpmRow().config, {
        ...base,
        dispatch: detail => detail.bootCompletion.reject(new Error('CP/M BIOS failed'))
    }), /CP\/M BIOS failed/);
});

test('CP/M lesson: strings resolve in EN and DE with matching keys', () => {
    for (const loc of ['en', 'de']) {
        const row = cpmRow(loc);
        assert.ok(row.summary && row.summary !== 'cpm.summary', `${loc} summary resolves`);
        assert.match(row.licence, /CP\/M 2\.2/);
        assert.match(row.licence, /zlib/);
        assert.ok(row.source && /bbc-basic-z80/.test(row.source), 'source links the media-lab project');
    }
    const en = Object.keys(LESSON_STRINGS.en).filter(k => k.startsWith('cpm.')).sort();
    const de = Object.keys(LESSON_STRINGS.de).filter(k => k.startsWith('cpm.')).sort();
    assert.deepEqual(en, de, 'cpm.* keys match across locales');
    assert.ok(en.length >= 3);
    for (const k of en) {
        assert.notEqual(lessonT('en', k), k, `${k} resolves in EN`);
        assert.notEqual(lessonT('de', k), k, `${k} resolves in DE`);
    }
});

test('the CP/M VDP lesson has its own BIOS preset and routes the real boot to Controller', async () => {
    const row = lessonMachines('en').find(entry => entry.config.id === 'lesson-cpm-z80-vdp');
    assert.deepEqual(validateMachineConfig(row.config), {ok: true, errors: []});
    assert.deepEqual(row.config.slots, cpmRow().config.slots);
    await runMachineConfig(row.config, {
        awaitBoot: true,
        fetcher: async () => ({bytes: new Uint8Array([0xc9])}),
        dispatch(detail) {
            assert.equal(detail.profile, 'cpm-system');
            assert.equal(detail.machinePreset, 'CPM64K_TMS9918');
            assert.equal(detail.machineView, 'controller');
            assert.equal(detail.widgets[0].source, 'video');
            detail.bootCompletion.resolve();
        }
    });
});
