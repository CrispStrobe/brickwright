// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import test from 'node:test';
import {fromMediaManifest} from '../overlay/scratch-gui/src/lib/bw-machines/importers.js';
import {runMachineConfig} from '../overlay/scratch-gui/src/lib/bw-machines/run-machine.js';
import {localAtBiosMachine} from '../overlay/scratch-gui/src/lib/bw-machines/local-freedos-vga.js';

test('partcl launch sends its 80186 variant and mounted script to the live runner', async () => {
    const baseUrl = 'https://example.test/projects/tcl-dos/';
    const executable = Uint8Array.of(0x4d, 0x5a);
    const script = new TextEncoder().encode('puts [* 6 7]\n');
    const config = fromMediaManifest({
        machine: 'i8086', program: {kind: 'dos', variant: '80186'},
        slots: {exe: 'TCL.EXE'}, mount: {'prog.tcl': 'samples/demo.tcl'}
    }, {baseUrl});
    let seen;
    const opts = {dispatch: detail => {
        seen = detail;
        detail.bootCompletion.resolve();
    }, awaitBoot: true, fetcher: async ref => {
        assert.ok(ref.url.startsWith(baseUrl));
        return {bytes: ref.url.endsWith('TCL.EXE') ? executable : script};
    }};
    await runMachineConfig(config, opts);
    assert.equal(seen.slotId, 'exe');
    assert.equal(seen.dosVariant, '80186');
    assert.equal(seen.bytes, executable);
    assert.equal(seen.dosFiles.get('PROG.TCL'), script);
    await assert.rejects(runMachineConfig(config, {...opts, dispatch: detail =>
        detail.bootCompletion.reject(new Error('boot failed'))}), /boot failed/);
});

test('Start 386 runs the bundled BIOS as the boot slot without requiring any disk', async () => {
    const config = localAtBiosMachine();
    assert.deepEqual(config.bootOrder, ['bios']);
    const bytes = new Uint8Array(0x10000);
    await runMachineConfig(config, {
        fetcher: async ref => {
            assert.match(ref.url, /free-386-bochs-bios\.rom$/);
            return {bytes};
        },
        awaitBoot: true,
        dispatch: detail => {
            assert.equal(detail.slotId, 'bios');
            assert.equal(detail.kind, 'i80386');
            assert.equal(detail.widgets[0].name, 'AT VGA');
            assert.equal(detail.bytes, bytes);
            detail.bootCompletion.resolve();
        }
    });
});
