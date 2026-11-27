// Machine Manager foundation (design §8 steps 1–2) — the headless spine, tested
// framework-free with node:test. No React, no DOM: the modules under
// lib/bw-machines/ are plain ES modules, so this drives the SAME functions the
// GUI and CLI will call (design §2: "one schema … reused by GUI + CLI + a Node
// test, so a bad config is rejected the same everywhere").
//
// The imports come from overlay/ (the source of truth); overlay-packages-pairs
// keeps the packages/ mirror byte-identical.

import {test} from 'node:test';
import assert from 'node:assert/strict';

import {
    validateMachineConfig, normalizeMachineConfig, newMachineConfig,
    EXECUTION_MODES, MACHINE_KINDS
} from '../overlay/scratch-gui/src/lib/bw-machines/machine-config.js';
import {
    createMemoryMachineStore, createIndexedDbMachineStore, indexedDbAvailable
} from '../overlay/scratch-gui/src/lib/bw-machines/machine-store.js';
import {
    fromDosboxConf, fromMediaManifest, fromManifestRepo
} from '../overlay/scratch-gui/src/lib/bw-machines/importers.js';
import {
    activateConfig
} from '../overlay/scratch-gui/src/lib/bw-machines/activate.js';
import {
    ensureVideoWidget, createMachineVideoMirror
} from '../overlay/scratch-gui/src/lib/bw-machines/video-mirror.js';
import {
    runMachineConfig
} from '../overlay/scratch-gui/src/lib/bw-machines/run-machine.js';
import {
    asciiToScancodes, createKeyboardSteer
} from '../overlay/scratch-gui/src/lib/bw-machines/keyboard-steer.js';
import {
    getMachineStore, _resetMachineStore
} from '../overlay/scratch-gui/src/lib/bw-machines/machine-store-instance.js';
// The REAL panel model + widget vocabulary from the pinned bw-board — so the
// video-mirror tests drive the same setVgaFrame the browser paints through, not
// a mock (design §4.2: a machine's screen is a simplevga widget).
import {ControllerPanel, createDebugTarget} from 'bw-board';

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** An i8086 floppy OS, shaped like the media-lab ELKS manifest once imported. */
const elksConfig = () => newMachineConfig({
    title: 'ELKS 0.9.2',
    executionMode: 'functional',
    machine: 'i8086',
    machineConfig: 'PCXT8086',
    slots: {
        floppy: {
            url: 'fd1440-fat.img', sha256: null,
            geometry: {cylinders: 80, heads: 2, sectors: 18, bytesPerSector: 512}
        }
    },
    quirks: ['at-floppy-drive-type']
});

/** A free-386 machine: FreeDOS HD + user-supplied AT/VGA BIOS ROMs. */
const freedos386Config = () => newMachineConfig({
    title: 'FreeDOS on the free 386',
    executionMode: 'functional',
    machine: 'i80386',
    bios: {kind: 'bochs-lgpl'},
    video: {kind: 'vga', optionRom: 'seavgabios-lgpl'},
    slots: {
        hdd: {url: 'https://ex/freedos-hd.img', sha256: null},
        bios: {url: 'https://ex/bochs-bios.bin', sha256: null},
        'vga-rom': {url: 'https://ex/seavgabios.bin', sha256: null}
    },
    bootOrder: ['hdd']
});

/** A stub fetcher: bytes derived from the url, so a test can tell which ref was
 *  fetched. Returns no sha256 (a stub is trusted; production computes+verifies). */
const stubFetcher = () => {
    const seen = [];
    const fetcher = async ref => {
        seen.push(ref.url);
        return {bytes: new TextEncoder().encode(`bytes:${ref.url}`)};
    };
    return {fetcher, seen};
};

const decode = bytes => new TextDecoder().decode(bytes);

// ── 1. validate / normalize ──────────────────────────────────────────────────

test('normalize fills defaults and is idempotent', () => {
    const once = normalizeMachineConfig({machine: 'i8086', slots: {floppy: 'a.img'}});
    // a bare-string slot becomes a {url,sha256,geometry} reference
    assert.deepEqual(once.slots.floppy, {url: 'a.img', sha256: null, geometry: null});
    // cpu.variant derived from the kind
    assert.equal(once.cpu.variant, '8086');
    // executionMode defaults to functional; bootOrder derived from the slots
    assert.equal(once.executionMode, 'functional');
    assert.deepEqual(once.bootOrder, ['floppy']);
    // idempotent: normalizing again changes nothing
    assert.deepEqual(normalizeMachineConfig(once), once);
});

test('newMachineConfig mints a stable id and round-trips through JSON', () => {
    const cfg = newMachineConfig({machine: 'i8086', slots: {floppy: 'a.img'}});
    assert.equal(typeof cfg.id, 'string');
    assert.ok(cfg.id.length > 0);
    // A minted config normalizes to itself (no lossy fields).
    assert.deepEqual(normalizeMachineConfig(cfg), cfg);
    // Survives a JSON round-trip unchanged (the store's export/import contract).
    assert.deepEqual(JSON.parse(JSON.stringify(cfg)), cfg);
});

test('validate accepts a functional OS config', () => {
    const {ok, errors} = validateMachineConfig(elksConfig());
    assert.deepEqual(errors, []);
    assert.ok(ok);
});

test('validate rejects an unknown executionMode', () => {
    const {ok, errors} = validateMachineConfig(
        normalizeMachineConfig({machine: 'i8086', slots: {floppy: 'a.img'}, executionMode: 'turbo'}));
    // normalize would coerce 'turbo' to functional, so assert on the raw object:
    const raw = {...elksConfig(), executionMode: 'turbo'};
    const res = validateMachineConfig(raw);
    assert.equal(res.ok, false);
    assert.ok(res.errors.some(e => /executionMode/.test(e)));
    // sanity: the normalized fallback is a valid mode
    assert.ok(EXECUTION_MODES.includes(normalizeMachineConfig(raw).executionMode));
    void ok; void errors;
});

test('executionMode gating: a wired config without a circuit ref is rejected', () => {
    const wiredNoCircuit = newMachineConfig({
        title: 'breadboard CPU', executionMode: 'wired', machine: 'eater6502'
    });
    const res = validateMachineConfig(wiredNoCircuit);
    assert.equal(res.ok, false);
    assert.ok(res.errors.some(e => /circuit\.ref/.test(e)), res.errors.join(';'));

    const wiredWithCircuit = newMachineConfig({
        title: 'Eater 6502 + LCD', executionMode: 'wired', machine: 'eater6502',
        circuit: {ref: 'circuits/eater-6502-lcd', cpuPart: 'w65c02'}
    });
    assert.deepEqual(validateMachineConfig(wiredWithCircuit).errors, []);
});

test('executionMode gating: an i80386 without a BIOS source is rejected', () => {
    const noBios = newMachineConfig({
        title: '386', executionMode: 'functional', machine: 'i80386',
        slots: {hdd: {url: 'hd.img'}}
    });
    const res = validateMachineConfig(noBios);
    assert.equal(res.ok, false);
    assert.ok(res.errors.some(e => /BIOS/.test(e)), res.errors.join(';'));
    // With a BIOS source it passes.
    assert.deepEqual(validateMachineConfig(freedos386Config()).errors, []);
});

test('nativeBlocks is a persisted i80386-only opt-in', async () => {
    const cfg = newMachineConfig({...freedos386Config(), nativeBlocks: true});
    assert.equal(cfg.nativeBlocks, true);
    assert.deepEqual(validateMachineConfig(cfg).errors, []);
    const store = createMemoryMachineStore();
    const saved = await store.put(cfg);
    assert.equal((await store.get(saved.id)).nativeBlocks, true);
    const imported = createMemoryMachineStore();
    await imported.import(await store.export());
    assert.equal((await imported.get(saved.id)).nativeBlocks, true);

    const wrongKind = newMachineConfig({...elksConfig(), nativeBlocks: true});
    assert.match(validateMachineConfig(wrongKind).errors.join('; '), /only for i80386/);
    const wrongType = newMachineConfig({...freedos386Config(), nativeBlocks: 'true'});
    assert.match(validateMachineConfig(wrongType).errors.join('; '), /must be a boolean/);
    await assert.rejects(() => store.put(wrongType), /nativeBlocks must be a boolean/);
    assert.equal(freedos386Config().nativeBlocks, false);
});

test('validate rejects a functional config with no bootable slot and a slot with no url', () => {
    const noSlots = newMachineConfig({machine: 'i8086', executionMode: 'functional'});
    assert.equal(validateMachineConfig(noSlots).ok, false);

    const badSlot = normalizeMachineConfig({machine: 'i8086', slots: {floppy: {sha256: 'x'}}});
    const res = validateMachineConfig(badSlot);
    assert.equal(res.ok, false);
    assert.ok(res.errors.some(e => /no url/.test(e)));
});

test('MACHINE_KINDS and EXECUTION_MODES are the shared vocabularies', () => {
    assert.ok(MACHINE_KINDS.includes('i8086') && MACHINE_KINDS.includes('i80386'));
    assert.deepEqual([...EXECUTION_MODES].sort(), ['auto', 'functional', 'wired']);
});

// ── 2. in-memory store CRUD + export/import ───────────────────────────────────

test('memory store: CRUD, duplicate, export/import round-trip', async () => {
    const store = createMemoryMachineStore();
    assert.deepEqual(await store.list(), []);

    const a = await store.put(elksConfig());
    const b = await store.put(freedos386Config());
    assert.equal((await store.list()).length, 2);

    // get returns a clone, not the stored object
    const gotA = await store.get(a.id);
    assert.deepEqual(gotA, a);
    gotA.title = 'mutated';
    assert.equal((await store.get(a.id)).title, 'ELKS 0.9.2');

    // put rejects an invalid config the same way validate does
    await assert.rejects(() => store.put({executionMode: 'wired', machine: 'eater6502'}),
        /invalid machine config/);

    // duplicate mints a new id and a "(copy)" title
    const copy = await store.duplicate(a.id);
    assert.notEqual(copy.id, a.id);
    assert.match(copy.title, /\(copy\)$/);
    assert.equal((await store.list()).length, 3);

    // remove
    assert.equal(await store.remove(b.id), true);
    assert.equal(await store.remove('nope'), false);
    assert.equal((await store.list()).length, 2);

    // export → import into a fresh store reproduces the library
    const dump = await store.export();
    assert.equal(dump.version, 1);
    const fresh = createMemoryMachineStore();
    const imported = await fresh.import(dump);
    assert.equal(imported.length, 2);
    const ids = new Set((await fresh.list()).map(m => m.id));
    assert.ok(ids.has(a.id) && ids.has(copy.id));

    // import also accepts a bare array
    const fresh2 = createMemoryMachineStore();
    await fresh2.import(dump.machines);
    assert.equal((await fresh2.list()).length, 2);
});

test('memory store: seed preloads configs', async () => {
    const store = createMemoryMachineStore([elksConfig()]);
    assert.equal((await store.list()).length, 1);
});

test('store interface: memory and indexeddb impls share the method surface', () => {
    const mem = createMemoryMachineStore();
    const surface = ['list', 'get', 'put', 'remove', 'duplicate', 'export', 'import', 'clear'];
    for (const m of surface) assert.equal(typeof mem[m], 'function', m);
    // In Node there is no IndexedDB; the browser store guards rather than throws
    // on import, and constructing it fails loudly (not a ReferenceError).
    assert.equal(indexedDbAvailable(undefined), false);
    assert.throws(() => createIndexedDbMachineStore(), /IndexedDB is unavailable/);
});

// ── 3. importers ──────────────────────────────────────────────────────────────

test('fromDosboxConf maps machine/cpu/autoexec onto a functional config', () => {
    const conf = [
        '[dosbox]',
        'machine = svga_s3',
        '[cpu]',
        'core = normal',
        'cputype = 386',
        'cycles = fixed 3000',
        '[autoexec]',
        'mount c ./game',
        'c:',
        'DOOM.EXE',
        ''
    ].join('\n');
    const cfg = fromDosboxConf(conf);
    assert.equal(cfg.executionMode, 'functional');
    assert.equal(cfg.machine, 'i80386');       // cputype 386 → the 386 tier
    assert.equal(cfg.cpu.variant, '80386');
    assert.ok(cfg.slots.exe, 'the launched .exe becomes the exe slot');
    assert.equal(cfg.slots.exe.url, 'DOOM.EXE');
    assert.equal(cfg.provenance.source, 'dosbox-conf');
    assert.equal(cfg.provenance.dosbox.cycles, 'fixed 3000');
    assert.equal(cfg.provenance.dosbox.mounts.c, './game');
    assert.equal(typeof cfg.id, 'string');

    // A CGA machine drops to the XT preset and the 8086 tier.
    const xt = fromDosboxConf('[dosbox]\nmachine=cga\n[autoexec]\nFOO.COM\n');
    assert.equal(xt.machine, 'i8086');
    assert.equal(xt.provenance.dosbox.preset, 'xt');
    assert.ok(xt.slots.com && xt.slots.com.url === 'FOO.COM');
});

test('fromMediaManifest turns a brickwright-media.json into a machine', () => {
    // The real ELKS manifest shape: {slot: filename} strings + a sibling floppy
    // block for geometry/quirks (NOT the doc's {url,sha256,geometry} slot).
    const manifest = {
        title: 'ELKS 0.9.2',
        machine: 'i8086',
        machineConfig: 'PCXT8086',
        slots: {floppy: 'fd1440-fat.img'},
        floppy: {
            geometry: {cylinders: 80, heads: 2, sectors: 18, bytesPerSector: 512},
            quirks: ['at-floppy-drive-type']
        },
        boot: true,
        notes: 'GPL-2 kernel; fetched, never re-hosted.'
    };
    const cfg = fromMediaManifest(manifest, {source: 'projects/elks', baseUrl: 'https://cdn/elks'});
    assert.equal(cfg.machine, 'i8086');
    assert.equal(cfg.executionMode, 'functional');
    assert.equal(cfg.machineConfig, 'PCXT8086');            // carried verbatim
    // filename → url under the project base; geometry folded from the floppy block
    assert.equal(cfg.slots.floppy.url, 'https://cdn/elks/fd1440-fat.img');
    assert.equal(cfg.slots.floppy.geometry.sectors, 18);
    assert.deepEqual(cfg.quirks, ['at-floppy-drive-type']);
    assert.equal(cfg.provenance.source, 'projects/elks');
    assert.equal(cfg.provenance.notes, manifest.notes);
    // the imported config is valid and activatable
    assert.deepEqual(validateMachineConfig(cfg).errors, []);
});

test('fromMediaManifest keeps an inline Eater 6502 machineConfig object', () => {
    const manifest = {
        title: 'Bad Apple (Ben Eater 6502)',
        machine: 'eater6502',
        machineConfig: {
            clockHz: 5000000,
            regions: [{kind: 'ram', start: 0, end: 16383}, {kind: 'rom', start: 32768, end: 65535}],
            chips: [{kind: 'via', name: 'via1', at: 24576}]
        },
        slots: {rom: 'player.hex', 'sd-image': 'sd-image.bin'},
        entry: 6144
    };
    const cfg = fromMediaManifest(manifest);
    assert.equal(typeof cfg.machineConfig, 'object');
    assert.equal(cfg.machineConfig.chips[0].kind, 'via');
    assert.ok(cfg.slots.rom && cfg.slots['sd-image']);
    assert.deepEqual(validateMachineConfig(cfg).errors, []);
});

test('fromMediaManifest carries a 386 manifest bios/video so it validates', () => {
    const manifest = {
        title: 'FreeDOS 386', machine: 'i80386', boot: true,
        slots: {floppy: 'boot.img'},
        bios: {kind: 'bochs-lgpl'},
        video: {kind: 'vga', optionRom: 'seavgabios-lgpl'},
        widgets: [
            {name: 'screen', type: 'simplevga', source: 'video'},
            {name: 'kbd', type: 'keyboard', source: 'keyIn'}
        ]
    };
    const cfg = fromMediaManifest(manifest);
    assert.deepEqual(cfg.bios, {kind: 'bochs-lgpl'});     // BIOS carried (was dropped before)
    assert.equal(cfg.video.optionRom, 'seavgabios-lgpl');
    assert.equal(cfg.widgets.filter(w => w.source === 'keyIn').length, 1);
    // A 386 config is valid ONLY with a BIOS source — the importer now supplies it.
    assert.deepEqual(validateMachineConfig(cfg).errors, []);
});

test('fromManifestRepo bulk-imports many manifests and reports bad entries', () => {
    const entries = [
        {path: 'projects/elks/brickwright-media.json', manifest: {
            title: 'ELKS', machine: 'i8086', machineConfig: 'PCXT8086',
            slots: {floppy: 'elks.img'}, floppy: {geometry: {cylinders: 80}, quirks: []}
        }},
        {path: 'projects/f83/brickwright-media.json', manifest: {
            title: 'F83', machine: 'i8086', slots: {com: 'f83.com'}
        }},
        {path: 'projects/broken/brickwright-media.json', manifest: null}
    ];
    const {configs, errors} = fromManifestRepo(entries, {baseUrl: 'https://cdn'});
    assert.equal(configs.length, 2);
    assert.equal(errors.length, 1);
    assert.match(errors[0].path, /broken/);
    // per-project base url: the file resolves under its own project dir
    const elks = configs.find(c => c.title === 'ELKS');
    assert.equal(elks.slots.floppy.url, 'https://cdn/projects/elks/elks.img');
    // every good config is valid
    for (const c of configs) assert.deepEqual(validateMachineConfig(c).errors, []);
});

// ── 4. activate ───────────────────────────────────────────────────────────────

test('activate: functional i8086 floppy → the floppy-OS bootMedia', async () => {
    const {fetcher, seen} = stubFetcher();
    const result = await activateConfig(elksConfig(), {fetcher});
    assert.equal(result.mode, 'functional');
    assert.equal(result.targetKind, 'i8086');
    assert.equal(result.bootMedia.slot, 'floppy');
    assert.equal(result.bootMedia.profile, 'floppy-os');      // selects debug-runner's floppy branch
    assert.equal(result.bootMedia.geometry.sectors, 18);
    assert.equal(decode(result.bootMedia.bytes), 'bytes:fd1440-fat.img');
    // 'PCXT8086' is a preset name, not a {regions,chips} object → not a machineConfig
    assert.equal(result.machineConfig, null);
    assert.equal(result.machinePreset, 'PCXT8086');
    assert.deepEqual(result.quirks, ['at-floppy-drive-type']);
    // the createDebugRunner-facing subset is exactly {targetKind, machineConfig, bootMedia}
    assert.deepEqual(Object.keys(result.debugRunnerOptions).sort(),
        ['bootMedia', 'machineConfig', 'targetKind']);
    // only the boot image was fetched (images fetched only on activation)
    assert.deepEqual(seen, ['fd1440-fat.img']);
});

test('activate: functional 386 → hdd bootMedia + resolved BIOS/VGA media', async () => {
    const {fetcher, seen} = stubFetcher();
    const result = await activateConfig(freedos386Config(), {fetcher});
    assert.equal(result.mode, 'functional');
    assert.equal(result.targetKind, 'i80386');
    assert.equal(result.bootMedia.slot, 'hdd');
    assert.equal(decode(result.bootMedia.bytes), 'bytes:https://ex/freedos-hd.img');
    // the 386's extra boot media are resolved too (bw-board marks bios required)
    assert.equal(decode(result.media.bios.bytes), 'bytes:https://ex/bochs-bios.bin');
    assert.equal(decode(result.media['vga-rom'].bytes), 'bytes:https://ex/seavgabios.bin');
    // The 386 boot path is wired into lite's debug-runner now (attachI80386),
    // so activate no longer emits a "not yet wired" warning for it.
    assert.ok(!result.warnings.some(w => /i80386 boot is not yet wired/.test(w)));
    assert.ok(!result.warnings.some(w => /386 video will/.test(w)));
    // all three images fetched
    assert.equal(seen.length, 3);
});

test('nativeBlocks reaches the GUI media-load event only when the 386 config opts in', async () => {
    const {fetcher} = stubFetcher();
    const cfg = newMachineConfig({...freedos386Config(), nativeBlocks: true});
    let dispatched;
    const {activated, detail} = await runMachineConfig(cfg, {
        fetcher, dispatch: event => { dispatched = event; }
    });
    assert.equal(activated.bootMedia.nativeBlocks, true);
    assert.equal(activated.debugRunnerOptions.bootMedia.nativeBlocks, true);
    assert.equal(detail.nativeBlocks, true);
    assert.equal(dispatched.nativeBlocks, true);

    const ordinary = await runMachineConfig(freedos386Config(), {fetcher, dispatch() {}});
    assert.equal(ordinary.detail.nativeBlocks, false);
});

test('the pinned bw-board target accepts the Machine Manager native option', async () => {
    const {adapter} = await createDebugTarget('i80386', {nativeBlocks: true});
    assert.ok(adapter.nativeDispatcher, 'the pinned board must include native dispatch');
});

test('DOSBox imgmount imports an AT disk with its explicit CHS and free BIOS', () => {
    const cfg = fromDosboxConf('[cpu]\ncputype=386\n[autoexec]\nimgmount c "win311.img" -t hdd -size 512,17,4,1000');
    assert.equal(cfg.machine, 'i80386');
    assert.equal(cfg.slots.hdd.url, 'win311.img');
    assert.deepEqual(cfg.slots.hdd.geometry, {sectors: 17, heads: 4, cylinders: 1000});
    assert.equal(cfg.bios.kind, 'bochs-lgpl');
    assert.equal(cfg.widgets[0].source, 'video');
    assert.equal(validateMachineConfig(cfg).ok, true);
});

test('activate: an inline machineConfig passes straight through to createDebugRunner', async () => {
    const {fetcher} = stubFetcher();
    const cfg = newMachineConfig({
        title: 'Bad Apple', machine: 'eater6502',
        machineConfig: {clockHz: 5000000, chips: [{kind: 'via', name: 'via1'}]},
        slots: {rom: {url: 'player.hex'}}
    });
    const result = await activateConfig(cfg, {fetcher});
    assert.equal(result.targetKind, 'eater6502');
    assert.equal(result.machineConfig.chips[0].kind, 'via');   // the {chips} object survives
    assert.equal(result.machinePreset, null);
});

test('activate: a wired config returns a circuit descriptor and fetches nothing', async () => {
    const {fetcher, seen} = stubFetcher();
    const cfg = newMachineConfig({
        title: 'Eater 6502 + HD44780', executionMode: 'wired', machine: 'eater6502',
        circuit: {ref: 'circuits/eater-lcd', cpuPart: 'w65c02'}
    });
    const result = await activateConfig(cfg, {fetcher});
    assert.equal(result.mode, 'wired');
    assert.equal(result.circuit.ref, 'circuits/eater-lcd');
    assert.equal(result.bootMedia, undefined);
    assert.deepEqual(seen, []);                                  // no image fetch for wired
});

test('activate: an invalid config is refused before any fetch', async () => {
    const {fetcher, seen} = stubFetcher();
    await assert.rejects(
        () => activateConfig({executionMode: 'wired', machine: 'eater6502'}, {fetcher}),
        /cannot activate an invalid config/);
    assert.deepEqual(seen, []);
});

test('activate: sha256 mismatch from a verifying fetcher is fatal', async () => {
    const cfg = newMachineConfig({
        title: 'pinned', machine: 'i8086',
        slots: {floppy: {url: 'a.img', sha256: 'deadbeef'}}
    });
    // a fetcher that returns a DIFFERENT sha than the ref declares
    const fetcher = async () => ({bytes: new Uint8Array([1, 2, 3]), sha256: 'feedface'});
    await assert.rejects(() => activateConfig(cfg, {fetcher}), /sha256 mismatch/);
});

// ── 5. widgets: a manifest declares its screen (design §4.2) ──────────────────

/** An i8086 OS whose manifest declares a VGA screen widget bound to video. */
const elksWithScreen = () => newMachineConfig({
    ...elksConfig(),
    widgets: [{
        name: 'screen', type: 'simplevga',
        config: {width: 640, height: 200}, layout: {x: 0, y: 0, w: 20, h: 12},
        source: 'video'
    }]
});

test('normalize carries a declared VGA widget and drops a malformed one', () => {
    const cfg = normalizeMachineConfig({
        machine: 'i8086', slots: {floppy: 'a.img'},
        widgets: [
            {name: 'screen', type: 'simplevga', source: 'video'},
            {type: 'simplevga'},          // no name → dropped
            {name: 'x'}                    // no type → dropped
        ]
    });
    assert.equal(cfg.widgets.length, 1);
    assert.deepEqual(cfg.widgets[0],
        {name: 'screen', type: 'simplevga', config: {}, layout: null, source: 'video'});
    // idempotent with widgets present
    assert.deepEqual(normalizeMachineConfig(cfg), cfg);
});

test('validate: a video-sourced widget must be a display face; names unique', () => {
    const ok = validateMachineConfig(elksWithScreen());
    assert.deepEqual(ok.errors, []);

    const notDisplay = normalizeMachineConfig({
        machine: 'i8086', slots: {floppy: 'a.img'},
        widgets: [{name: 'screen', type: 'joystick', source: 'video'}]
    });
    const r1 = validateMachineConfig(notDisplay);
    assert.equal(r1.ok, false);
    assert.ok(r1.errors.some(e => /not a display face/.test(e)), r1.errors.join(';'));

    const dup = normalizeMachineConfig({
        machine: 'i8086', slots: {floppy: 'a.img'},
        widgets: [{name: 'screen', type: 'simplevga'}, {name: 'screen', type: 'lcd'}]
    });
    assert.ok(validateMachineConfig(dup).errors.some(e => /duplicate widget name/.test(e)));
});

test('fromMediaManifest carries a manifest-declared screen widget', () => {
    const manifest = {
        title: 'ELKS 0.9.2', machine: 'i8086', machineConfig: 'PCXT8086',
        slots: {floppy: 'fd1440-fat.img'},
        floppy: {geometry: {cylinders: 80, heads: 2, sectors: 18}, quirks: ['at-floppy-drive-type']},
        boot: true,
        widgets: [{name: 'screen', type: 'simplevga', config: {width: 640, height: 200}, source: 'video'}]
    };
    const cfg = fromMediaManifest(manifest, {source: 'projects/elks'});
    assert.equal(cfg.widgets.length, 1);
    assert.equal(cfg.widgets[0].source, 'video');
    assert.equal(cfg.widgets[0].config.width, 640);
    assert.deepEqual(validateMachineConfig(cfg).errors, []);
});

test('activate surfaces widgets and names the video-sink widget', async () => {
    const {fetcher} = stubFetcher();
    const result = await activateConfig(elksWithScreen(), {fetcher});
    assert.equal(result.videoWidget, 'screen');
    assert.equal(result.widgets.length, 1);
    assert.equal(result.widgets[0].type, 'simplevga');
    // a config with no declared screen has no video sink (headless/serial-only)
    const headless = await activateConfig(elksConfig(), {fetcher});
    assert.equal(headless.videoWidget, null);
    assert.deepEqual(headless.widgets, []);
});

// ── 6. video mirror: video() → setVgaFrame → the real panel widget ────────────

/** A hand-driven scheduler so the mirror's rAF loop is stepped deterministically. */
function manualScheduler() {
    let pending = null;
    return {
        schedule: cb => { pending = cb; return 1; },
        cancel: () => { pending = null; },
        flush: () => { const cb = pending; pending = null; if (cb) cb(); }
    };
}

/** A fake video card: a solid 4×4 frame with a bumpable frame counter. */
function fakeVideo() {
    const rgba = new Uint8ClampedArray(4 * 4 * 4).fill(200);
    let frame = 0;
    return {
        fn: () => ({width: 4, height: 4, rgba, frame, signal: true}),
        advance: () => { frame += 1; }
    };
}

test('ensureVideoWidget creates the widget once and is idempotent', () => {
    const panel = new ControllerPanel();
    const decl = {name: 'screen', type: 'simplevga', config: {width: 4, height: 4}, layout: {x: 0, y: 0}};
    assert.equal(ensureVideoWidget(panel, decl), 'screen');
    assert.ok(panel.getWidget('screen'));
    // a second call does not throw on the name clash
    assert.equal(ensureVideoWidget(panel, decl), 'screen');
    assert.equal(panel.getWidgetNames().filter(n => n === 'screen').length, 1);
});

test('the mirror paints the real panel widget from video() frames', () => {
    const panel = new ControllerPanel();
    const video = fakeVideo();
    const sched = manualScheduler();
    const mirror = createMachineVideoMirror({
        panel, videoFn: video.fn,
        widget: {name: 'screen', type: 'simplevga', config: {width: 4, height: 4}},
        schedule: sched.schedule, cancel: sched.cancel
    });
    mirror.start();
    assert.ok(panel.getWidget('screen'), 'widget created on start');

    sched.flush();                       // one loop iteration → one paint
    const w = panel.getWidget('screen');
    assert.ok(w.state.rgba instanceof Uint8ClampedArray, 'framebuffer painted into the widget');
    assert.equal(w.state.rgba.length, 4 * 4 * 4);
    assert.equal(w.state.signal, true);
    assert.equal(mirror.frameCount, 1);

    // same frame number → no repaint (a still screen renumbers nothing)
    sched.flush();
    assert.equal(mirror.frameCount, 1);

    // a new frame → repaint
    video.advance();
    sched.flush();
    assert.equal(mirror.frameCount, 2);

    mirror.stop();
    assert.equal(mirror.running, false);
    sched.flush();                       // a flush after stop paints nothing
    assert.equal(mirror.frameCount, 2);
});

test('the mirror survives a video() that returns null or throws', () => {
    const panel = new ControllerPanel();
    const sched = manualScheduler();
    let mode = 'null';
    const mirror = createMachineVideoMirror({
        panel, name: 'screen',
        widget: {name: 'screen', type: 'simplevga', config: {width: 4, height: 4}},
        videoFn: () => {
            if (mode === 'throw') throw new Error('runner torn down');
            return null;                 // no display card yet
        },
        schedule: sched.schedule, cancel: sched.cancel
    });
    mirror.start();
    assert.doesNotThrow(() => sched.flush());   // null frame: nothing painted, no crash
    assert.equal(mirror.frameCount, 0);
    mode = 'throw';
    assert.doesNotThrow(() => sched.flush());   // a throwing video(): swallowed
    assert.equal(mirror.frameCount, 0);
    mirror.stop();
});

// ── 7. runMachineConfig: boot a config via the media-load event ───────────────

test('runMachineConfig boots a functional config and carries its screen widget', async () => {
    const {fetcher} = stubFetcher();
    const dispatched = [];
    const res = await runMachineConfig(elksWithScreen(), {
        fetcher, dispatch: d => dispatched.push(d)
    });
    assert.equal(res.mode, 'functional');
    assert.equal(dispatched.length, 1);
    const d = dispatched[0];
    assert.equal(d.slotId, 'floppy');
    assert.equal(d.kind, 'i8086');
    assert.equal(d.profile, 'floppy-os');       // selects debug-runner's floppy branch
    assert.equal(decode(d.bytes), 'bytes:fd1440-fat.img');
    // the declared screen rides the event so debug-panel mirrors it into Widgets
    const screen = d.widgets.find(w => w.source === 'video');
    assert.ok(screen && screen.type === 'simplevga', 'video widget carried on the event');
});

test('runMachineConfig on a config with no screen carries an empty widgets list', async () => {
    const {fetcher} = stubFetcher();
    const dispatched = [];
    await runMachineConfig(elksConfig(), {fetcher, dispatch: d => dispatched.push(d)});
    assert.deepEqual(dispatched[0].widgets, []);
});

test('386 hard-disk geometry survives activation and media dispatch', async () => {
    const {fetcher} = stubFetcher();
    const config = freedos386Config();
    config.slots.hdd.geometry = {cylinders: 1000, heads: 4, sectors: 17};
    const dispatched = [];
    await runMachineConfig(config, {fetcher, dispatch: detail => dispatched.push(detail)});
    assert.equal(dispatched.length, 1);
    assert.equal(dispatched[0].kind, 'i80386');
    assert.equal(dispatched[0].slotId, 'hdd');
    assert.deepEqual(dispatched[0].geometry, {cylinders: 1000, heads: 4, sectors: 17});
});

test('386 floppy launch keeps its geometry and reports an attach failure', async () => {
    const {fetcher} = stubFetcher();
    const geometry = {cylinders: 80, heads: 2, sectors: 18, bytesPerSector: 512};
    const config = fromMediaManifest({
        machine: 'i80386', bios: {kind: 'bochs-lgpl'}, slots: {floppy: 'minix204.img'}, floppy: {geometry}
    }, {baseUrl: 'https://cdn/projects/minix-2.0/'});
    await assert.rejects(runMachineConfig(config, {fetcher, awaitBoot: true, dispatch: detail => {
        assert.equal(detail.kind, 'i80386');
        assert.equal(detail.slotId, 'floppy');
        assert.equal(detail.profile, 'floppy-os');
        assert.deepEqual(detail.geometry, geometry);
        detail.bootCompletion.reject(new Error('floppy attach was refused'));
    }}), /floppy attach was refused/);
});

test('runMachineConfig returns a wired descriptor and dispatches nothing', async () => {
    const {fetcher} = stubFetcher();
    let dispatched = 0;
    const cfg = newMachineConfig({
        title: 'Eater 6502 + LCD', executionMode: 'wired', machine: 'eater6502',
        circuit: {ref: 'circuits/eater-lcd', cpuPart: 'w65c02'}
    });
    const res = await runMachineConfig(cfg, {fetcher, dispatch: () => { dispatched++; }});
    assert.equal(res.mode, 'wired');
    assert.equal(dispatched, 0);
});

test('getMachineStore is a shared singleton with a memory fallback', async () => {
    _resetMachineStore();
    const a = getMachineStore({forceMemory: true});
    const b = getMachineStore();                    // no opts → same instance
    assert.equal(a, b, 'one shared store for every surface');
    await a.put(newMachineConfig({machine: 'i8086', slots: {floppy: 'x.img'}}));
    assert.equal((await b.list()).length, 1, 'reads and writes hit the one store');
    _resetMachineStore();
});

// ── 8. keyboard steering: a widget's keys → runner.keyIn (design §4.5) ────────

test('validate: a keyIn-sourced widget must be an input face', () => {
    const ok = normalizeMachineConfig({
        machine: 'i8086', slots: {floppy: 'a.img'},
        widgets: [{name: 'kbd', type: 'keyboard', source: 'keyIn'}]
    });
    assert.deepEqual(validateMachineConfig(ok).errors, []);
    assert.equal(ok.widgets[0].source, 'keyIn');   // normalize keeps keyIn

    const notInput = normalizeMachineConfig({
        machine: 'i8086', slots: {floppy: 'a.img'},
        widgets: [{name: 'kbd', type: 'simplevga', source: 'keyIn'}]
    });
    const r = validateMachineConfig(notInput);
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => /not an input face/.test(e)), r.errors.join(';'));
});

test('asciiToScancodes maps ASCII to XT set-1 make/break sequences', () => {
    assert.deepEqual(asciiToScancodes('a'.charCodeAt(0)), [0x1e, 0x9e]);          // make, break
    assert.deepEqual(asciiToScancodes('A'.charCodeAt(0)), [0x2a, 0x1e, 0x9e, 0xaa]); // shift-wrapped
    assert.deepEqual(asciiToScancodes('1'.charCodeAt(0)), [0x02, 0x82]);
    assert.deepEqual(asciiToScancodes('!'.charCodeAt(0)), [0x2a, 0x02, 0x82, 0xaa]);
    assert.deepEqual(asciiToScancodes(13), [0x1c, 0x9c]);   // Enter
    assert.deepEqual(asciiToScancodes(8), [0x0e, 0x8e]);    // Backspace
    assert.deepEqual(asciiToScancodes(' '.charCodeAt(0)), [0x39, 0xb9]);
    assert.deepEqual(asciiToScancodes(300), []);            // unmapped → nothing typed
});

test('the steerer drains a real keyboard widget FIFO into keyIn', () => {
    const panel = new ControllerPanel();
    panel.addWidget('kbd', 'keyboard', {}, {x: 0, y: 0});
    const typed = 'root\r';
    for (const ch of typed) panel.pushKeyboardKey('kbd', ch.charCodeAt(0));

    const sent = [];
    const sched = manualScheduler();
    const steer = createKeyboardSteer({
        panel, widgetName: 'kbd', keyIn: sc => sent.push(sc),
        schedule: sched.schedule, cancel: sched.cancel
    });
    steer.start();
    sched.flush();   // one drain

    const expected = [...typed].flatMap(ch => asciiToScancodes(ch.charCodeAt(0)));
    assert.deepEqual(sent, expected, 'every queued key became its scancodes');
    assert.equal(steer.keysSent, expected.length);

    // FIFO now empty → a further drain sends nothing.
    sched.flush();
    assert.equal(steer.keysSent, expected.length);
    steer.stop();
    assert.equal(steer.running, false);
});

test('a declared 65C02 gray framebuffer reaches Controller through the machine handoff', async () => {
    const {fetcher} = stubFetcher();
    const framebuffer = {chip: 'screen', at: 0x3000, width: 64, height: 32, stride: 64, format: 'gray8'};
    const cfg = fromMediaManifest({machine: 'eater6502', slots: {rom: 'forth.rom'},
        machineConfig: {regions: [], chips: [{kind: 'framebuffer', name: 'screen', at: 0x3000, size: 2048},
            {kind: 'acia', name: 'acia1', at: 0x5000}]},
        program: {framebuffer, console: 'acia1'}});
    const {detail} = await runMachineConfig(cfg, {fetcher, dispatch () {}});
    assert.deepEqual(detail.machineConfig6502.grayFramebuffer, framebuffer);
    assert.equal(detail.machineConfig6502.pacedConsole, 'acia1');
    assert.equal(detail.machineView, 'controller');
    assert.deepEqual(detail.widgets[0].config, {width: 64, height: 32});
    cfg.provenance.program.framebuffer = {...framebuffer, stride: 128};
    await assert.rejects(runMachineConfig(cfg, {fetcher, dispatch () {}}), /Invalid 65C02 grayscale framebuffer/);
});

test('published 65C02 frames need a writable counter outside the framebuffer', async () => {
    const {fetcher} = stubFetcher();
    const framebuffer = {chip: 'screen', at: 0x2000, width: 100, height: 64, stride: 128,
        format: 'gray6', publishAt: 0x200};
    const cfg = fromMediaManifest({machine: 'eater6502', slots: {rom: 'animation.rom'},
        machineConfig: {regions: [{kind: 'ram', start: 0, end: 0x3fff}],
            chips: [{kind: 'framebuffer', name: 'screen', at: 0x2000, size: 8192}]},
        program: {framebuffer}});
    const {detail} = await runMachineConfig(cfg, {fetcher, dispatch () {}});
    assert.deepEqual(detail.machineConfig6502.grayFramebuffer, framebuffer);
    assert.equal(detail.machineConfig6502.pacedConsole, undefined);
    cfg.provenance.program.framebuffer = {...framebuffer, publishAt: 0x2000};
    await assert.rejects(runMachineConfig(cfg, {fetcher, dispatch () {}}), /Invalid 65C02 framebuffer publication address/);
    cfg.provenance.program.framebuffer = {...framebuffer, publishAt: 0x4000};
    await assert.rejects(runMachineConfig(cfg, {fetcher, dispatch () {}}), /publication address must be in RAM/);
});
