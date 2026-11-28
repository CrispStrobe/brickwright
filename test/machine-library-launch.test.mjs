// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import {sha256Hex} from '../overlay/scratch-gui/src/lib/bw-machines/activate.js';
import {readLibraryFloppy} from '../overlay/scratch-gui/src/lib/bw-machines/local-floppy.js';
import {readFreedosGuestPackage} from '../overlay/scratch-gui/src/lib/bw-machines/freedos-guest.js';
import {fromMediaManifest} from '../overlay/scratch-gui/src/lib/bw-machines/importers.js';
import {runMachineConfig} from '../overlay/scratch-gui/src/lib/bw-machines/run-machine.js';
import {createAlicePascalMachine} from '../overlay/scratch-gui/src/lib/bw-machines/alice-pascal.js';
import {libraryLicenseUrl, libraryMedia} from '../overlay/scratch-gui/src/lib/bw-machines/library-media.js';
import {localAtBiosMachine} from '../overlay/scratch-gui/src/lib/bw-machines/local-freedos-vga.js';

test('partcl launch sends its 80186 variant and mounted script to the live runner', async () => {
    const baseUrl = 'https://example.test/projects/tcl-dos/';
    const executable = Uint8Array.of(0x4d, 0x5a);
    const script = new TextEncoder().encode('puts [* 6 7]\n');
    const config = fromMediaManifest({
        machine: 'i8086', program: {kind: 'dos', variant: '80186', args: '-i'},
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
    assert.equal(seen.dosArgs, '-i');
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

test('ALICE requires the exact FreeDOS 1.4 boot media before fetching guest files', async () => {
    await assert.rejects(createAlicePascalMachine(new Blob()), /Choose 120m\/x86BOOT.img/);
    await assert.rejects(createAlicePascalMachine(new Blob([new Uint8Array(1228800)])), /floppy checksum differs/);
    await assert.rejects(createAlicePascalMachine(new Blob([new Uint8Array(23624258)])), /ZIP checksum differs/);
});

test('OpenGEM is an on-demand 80386 guest with linked desktop and mouse sources', async () => {
    const item = libraryMedia.find(item => item.id === 'opengem');
    assert.equal(item.machine, 'i80386');
    assert.equal(item.license, 'GPL-2.0-or-later');
    assert.match(libraryLicenseUrl(item), /OPENGEM7-RC3[/]LICENSE[.]TXT$/);
    assert.equal(item.supportSource.title, 'CuteMouse');
    await assert.rejects(item.freedosGuest(new Blob([new Uint8Array(1228800)])), /floppy checksum differs/);
});

test('8086 floppy launch reports attachment failures and retains its declared controller display', async () => {
    const geometry = {cylinders: 80, heads: 2, sectors: 9, bytesPerSector: 512};
    const config = fromMediaManifest({
        machine: 'i8086', machineConfig: 'PCXT8086',
        slots: {floppy: {url: 'local-media:floppy', geometry}},
        widgets: [{name: 'PC CGA', type: 'simplevga', source: 'video'}]
    });
    const bytes = new Uint8Array(720 * 1024);
    const opts = {fetcher: async () => ({bytes}), awaitBoot: true};
    await runMachineConfig(config, {...opts, dispatch: detail => {
        assert.equal(detail.kind, 'i8086');
        assert.equal(detail.slotId, 'floppy');
        assert.equal(detail.bytes, bytes);
        assert.deepEqual(detail.geometry, geometry);
        assert.equal(detail.widgets[0].name, 'PC CGA');
        detail.bootCompletion.resolve();
    }});
    await assert.rejects(runMachineConfig(config, {...opts, dispatch: detail =>
        detail.bootCompletion.reject(new Error('floppy controller unavailable'))}), /floppy controller unavailable/);
});

test('Zmiy requires the XT FreeDOS boot image and the local game archive', async () => {
    const item = libraryMedia.find(item => item.id === 'zmiy');
    assert.equal(item.machine, 'i8086');
    assert.equal(item.license, 'BSD-2-Clause');
    assert.match(item.guestPackage.url, /v0[.]85[.]2/);
    await assert.rejects(item.freedosGuest(new Blob([new Uint8Array(1228800)])), /720k/);
});

test('Sudoku86 uses the AT floppy and links to the original game and PS/2 driver source', async () => {
    const item = libraryMedia.find(item => item.id === 'sudoku86');
    assert.equal(item.machine, 'i80386');
    assert.equal(item.license, 'BSD-2-Clause');
    assert.match(item.guestPackage.url, /v1[.]0[.]3/);
    assert.equal(item.supportSource.title, 'CuteMouse');
    assert.ok(!item.guestPackage.localOnly);
    await assert.rejects(item.freedosGuest(new Blob([new Uint8Array(720 * 1024)])), /120m/);
});

test('FreeDOS guest packages verify the archive and extract only the declared members', async () => {
    const archive = new JSZip();
    archive.file('game/start.exe', Uint8Array.of(1, 2, 3));
    archive.file('game/readme.txt', 'not requested');
    const bytes = await archive.generateAsync({type: 'uint8array'});
    const file = new Blob([bytes]);
    const release = {
        title: 'Test guest 1.0', name: 'Test guest', size: file.size, sha256: await sha256Hex(bytes),
        directory: 'game', files: ['start.exe']
    };
    assert.deepEqual(await readFreedosGuestPackage(file, release), [
        {name: 'START.EXE', bytes: Uint8Array.of(1, 2, 3)}
    ]);
    await assert.rejects(readFreedosGuestPackage(new Blob([new Uint8Array(file.size)]), release), /checksum differs/);
    await assert.rejects(readFreedosGuestPackage(file, {...release, files: ['missing.exe']}), /missing missing[.]exe/);
});

test('PDOS/86 only passes its verified local 360 KiB image to the XT and Controller', async () => {
    const item = libraryMedia.find(item => item.id === 'pdos86');
    assert.equal(item.machine, 'i8086');
    assert.equal(item.license, 'CC0-1.0');
    assert.match(libraryLicenseUrl(item), /readme[.]txt$/);
    const descriptor = item.localFloppy;
    assert.equal(descriptor.url, 'https://www.pdos.org/flop360.img');
    await assert.rejects(readLibraryFloppy(new Blob(), item), /360 KiB/);
    const bytes = new Uint8Array(360 * 1024);
    const file = new Blob([bytes]);
    await assert.rejects(readLibraryFloppy(file, item), /checksum differs/);

    const synthetic = {...descriptor, sha256: await sha256Hex(bytes)};
    const {config, fetcher} = await readLibraryFloppy(file, {...item, localFloppy: synthetic});
    assert.equal(config.machineConfig, 'PCXT8086');
    await runMachineConfig(config, {fetcher, awaitBoot: true, dispatch: detail => {
        assert.equal(detail.kind, 'i8086');
        assert.equal(detail.slotId, 'floppy');
        assert.deepEqual(detail.geometry, {cylinders: 40, heads: 2, sectors: 9, bytesPerSector: 512});
        assert.deepEqual(detail.bytes, bytes);
        assert.equal(detail.widgets[0].source, 'video');
        detail.bootCompletion.resolve();
    }});
});

test('PDOS/86 AT mounts the same verified floppy through the clock-equipped profile', async () => {
    const xt = libraryMedia.find(item => item.id === 'pdos86');
    const at = libraryMedia.find(item => item.id === 'pdos86-at');
    assert.equal(at.machine, 'i80386');
    assert.deepEqual(at.localFloppy, xt.localFloppy);
    const bytes = new Uint8Array(360 * 1024);
    const sample = {...at, localFloppy: {...at.localFloppy, sha256: await sha256Hex(bytes)}};
    const {config, fetcher} = await readLibraryFloppy(new Blob([bytes]), sample);
    assert.equal(config.machineConfig, 'freedos-vga');
    assert.equal(config.bios.kind, 'bochs-lgpl');
    await runMachineConfig(config, {fetcher, awaitBoot: true, dispatch: detail => {
        assert.equal(detail.kind, 'i80386');
        assert.equal(detail.slotId, 'floppy');
        assert.deepEqual(detail.geometry, {cylinders: 40, heads: 2, sectors: 9, bytesPerSector: 512});
        assert.deepEqual(detail.bytes, bytes);
        assert.equal(detail.widgets[0].source, 'video');
        detail.bootCompletion.resolve();
    }});
});
