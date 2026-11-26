import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile, writeFile, unlink} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {dirname, join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createMemoryMachineStore} from
    '../overlay/scratch-gui/src/lib/bw-machines/machine-store.js';
import {newMachineConfig} from
    '../overlay/scratch-gui/src/lib/bw-machines/machine-config.js';

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const guiRequire = createRequire(join(root, 'packages/scratch-gui/package.json'));
const React = guiRequire('react');
const {create, act} = guiRequire('react-test-renderer');
const babel = guiRequire('@babel/core');

async function loadManager() {
    const sourceUrl = new URL('../overlay/scratch-gui/src/components/tw-pseudocode/machine-manager.jsx', import.meta.url);
    const tempUrl = new URL(`./machine-manager-test-${randomUUID()}.mjs`, sourceUrl);
    const reactUrl = pathToFileURL(guiRequire.resolve('react')).href;
    const source = (await readFile(sourceUrl, 'utf8'))
        .replace("from 'react'", `from '${reactUrl}'`);
    const transformed = babel.transformSync(source, {
        filename: 'machine-manager.jsx', babelrc: false, configFile: false,
        presets: [[guiRequire.resolve('@babel/preset-react'), {runtime: 'classic'}]]
    }).code;
    await writeFile(tempUrl, transformed);
    try { return (await import(tempUrl.href)).default; }
    finally { await unlink(tempUrl); }
}

const config = (machine, title) => newMachineConfig({
    title, machine, executionMode: 'functional',
    ...(machine === 'i80386' ? {bios: {kind: 'bochs-lgpl'}} : {}),
    slots: {hdd: {url: 'disk.img'}}
});

test('Machine Manager checkbox persists and runs the 386 native opt-in', async () => {
    const MachineManager = await loadManager();
    const store = createMemoryMachineStore([
        config('i80386', 'FreeDOS 386'), config('i8086', 'DOS 8086')
    ]);
    let selected = null;
    let renderer;
    await act(async () => {
        renderer = create(React.createElement(MachineManager, {
            store, onRun: cfg => { selected = cfg; }, onClose() {}
        }));
    });

    const checkbox = renderer.root.findAllByProps({'data-testid': 'bw-mm-native-blocks'});
    assert.equal(checkbox.length, 1, 'only the i80386 row offers native blocks');
    assert.equal(checkbox[0].props.checked, false);
    await act(async () => { await checkbox[0].props.onChange({target: {checked: true}}); });
    assert.equal(renderer.root.findByProps({'data-testid': 'bw-mm-native-blocks'}).props.checked, true);

    const stored = (await store.list()).find(m => m.machine === 'i80386');
    assert.equal(stored.nativeBlocks, true);
    const row = renderer.root.findAllByProps({'data-testid': 'bw-mm-row'})
        .find(r => r.findAllByProps({'data-testid': 'bw-mm-native-blocks'}).length === 1);
    assert.ok(row, 'the 386 row remains visible after saving');
    row.findByProps({'data-testid': 'bw-mm-run'}).props.onClick();
    assert.equal(selected.nativeBlocks, true, 'Run receives the persisted setting');
    renderer.unmount();
});

test('local DOSBox disk boot passes its native opt-in to the 386 run', async () => {
    const MachineManager = await loadManager();
    const store = createMemoryMachineStore();
    const runs = [];
    let renderer;
    await act(async () => {
        renderer = create(React.createElement(MachineManager, {
            store, onRun: (cfg, opts) => { runs.push({cfg, opts}); }, onClose() {}
        }));
    });
    const disk = {name: 'disk.img', size: 306 * 4 * 17 * 512,
        arrayBuffer: async () => new ArrayBuffer(512)};
    await act(async () => {
        renderer.root.findByProps({'data-testid': 'bw-mm-local-disk'}).props
            .onChange({target: {files: [disk]}});
    });
    const toggle = renderer.root.findByProps({'data-testid': 'bw-mm-local-native-blocks'});
    assert.equal(toggle.props.checked, false);
    await act(async () => {
        await renderer.root.findByProps({'data-testid': 'bw-mm-local-run'}).props.onClick();
    });
    assert.equal(runs[0].cfg.nativeBlocks, false);
    await act(async () => { toggle.props.onChange({target: {checked: true}}); });
    await act(async () => {
        await renderer.root.findByProps({'data-testid': 'bw-mm-local-run'}).props.onClick();
    });
    assert.equal(runs[1].cfg.nativeBlocks, true);
    assert.equal(typeof runs[1].opts.fetcher, 'function');
    renderer.unmount();
});

test('FreeDOS VGA action selects the named profile and keeps four local files in the run fetcher', async () => {
    const MachineManager = await loadManager();
    const runs = [];
    let renderer;
    await act(async () => {
        renderer = create(React.createElement(MachineManager, {
            store: createMemoryMachineStore(),
            onRun: (cfg, opts) => { runs.push({cfg, opts}); }, onClose() {}
        }));
    });
    const files = {
        floppy: {name: 'boot.img', size: 80 * 2 * 15 * 512, arrayBuffer: async () => Uint8Array.of(1).buffer},
        hdd: {name: 'disk.img', size: 306 * 4 * 17 * 512, arrayBuffer: async () => Uint8Array.of(2).buffer},
        bios: {name: 'bios.rom', size: 65536, arrayBuffer: async () => Uint8Array.of(3).buffer},
        vgaRom: {name: 'vga.rom', size: 38400, arrayBuffer: async () => Uint8Array.of(4).buffer}
    };
    for (const [slot, media] of Object.entries(files)) {
        await act(async () => {
            renderer.root.findByProps({'data-testid': `bw-mm-free386-${slot}`}).props
                .onChange({target: {files: [media]}});
        });
    }
    await act(async () => {
        await renderer.root.findByProps({'data-testid': 'bw-mm-free386-run'}).props.onClick();
    });
    assert.equal(runs.length, 1);
    assert.equal(runs[0].cfg.nativeBlocks, false);
    assert.equal(runs[0].cfg.machineConfig, 'freedos-vga');
    assert.equal(runs[0].cfg.bootOrder[0], 'floppy');
    for (const [slot, value] of [['floppy', 1], ['hdd', 2], ['bios', 3], ['vga-rom', 4]]) {
        const fetched = await runs[0].opts.fetcher({url: `local-media:${slot}`});
        assert.equal(fetched.bytes[0], value);
    }
    const nativeToggle = renderer.root.findByProps({'data-testid': 'bw-mm-free386-native-blocks'});
    assert.equal(nativeToggle.props.checked, false);
    await act(async () => { nativeToggle.props.onChange({target: {checked: true}}); });
    await act(async () => {
        await renderer.root.findByProps({'data-testid': 'bw-mm-free386-run'}).props.onClick();
    });
    assert.equal(runs[1].cfg.nativeBlocks, true);
    assert.equal(runs[1].cfg.machineConfig, 'freedos-vga');
    renderer.unmount();
});

test('FreeDOS file selection survives React 16 clearing a pooled event before state flush', async () => {
    const MachineManager = await loadManager();
    const runs = [];
    let renderer;
    await act(async () => {
        renderer = create(React.createElement(MachineManager, {
            store: createMemoryMachineStore(), onRun: cfg => runs.push(cfg), onClose() {}
        }));
    });
    const floppy = {name: 'boot.img', size: 80 * 2 * 15 * 512,
        arrayBuffer: async () => Uint8Array.of(1).buffer};
    const event = {target: {files: [floppy]}};
    await act(async () => {
        renderer.root.findByProps({'data-testid': 'bw-mm-free386-floppy'}).props.onChange(event);
        event.target = null; // React 16 pooled SyntheticEvent after the handler returns.
    });
    await act(async () => {
        await renderer.root.findByProps({'data-testid': 'bw-mm-free386-run'}).props.onClick();
    });
    assert.equal(runs.length, 1);
    assert.equal(runs[0].slots.floppy.url, 'local-media:floppy');
    renderer.unmount();
});

test('the Build Machine library starts on the selected target and supports showing all targets', async () => {
    const MachineManager = await loadManager();
    const store = createMemoryMachineStore([
        newMachineConfig({title: 'LCD test ROM', machine: 'eater6502', slots: {rom: 'lcd.bin'}}),
        config('i8086', 'DOS 8086')
    ]);
    let renderer;
    await act(async () => {
        renderer = create(React.createElement(MachineManager, {store, preferredMachine: 'eater6502', locale: 'en'}));
    });
    try {
        const filter = renderer.root.findByProps({'aria-label': 'Machine type'});
        assert.equal(filter.props.value, 'eater6502');
        assert.equal(renderer.root.findAllByProps({'data-testid': 'bw-mm-row'}).length, 1);
        await act(async () => filter.props.onChange({target: {value: ''}}));
        assert.equal(renderer.root.findAllByProps({'data-testid': 'bw-mm-row'}).length, 2);
    } finally {
        renderer.unmount();
    }
});

test('an HTTPS media manifest resolves relative ROM paths in the supplied repository', async t => {
    const MachineManager = await loadManager();
    const store = createMemoryMachineStore();
    const manifest = 'https://raw.githubusercontent.com/example/media/0123456789/brickwright-media.json';
    const request = t.mock.method(globalThis, 'fetch', async (url, options) => {
        assert.equal(url.href, manifest);
        assert.equal(options.redirect, 'error');
        return {ok: true, json: async () => ({
            title: 'Open demonstration', machine: 'eater6502', license: 'MIT', slots: {rom: 'hello.rom'}
        })};
    });
    let renderer;
    await act(async () => {
        renderer = create(React.createElement(MachineManager, {store, preferredMachine: 'eater6502', locale: 'en'}));
    });
    try {
        await act(async () => renderer.root.findByProps({'data-testid': 'bw-mm-import-text'})
            .props.onChange({target: {value: manifest}}));
        await act(async () => renderer.root.findByProps({'data-testid': 'bw-mm-import'}).props.onClick());
        assert.equal(request.mock.callCount(), 1);
        const [imported] = await store.list();
        assert.equal(imported.slots.rom.url, new URL('hello.rom', manifest).href);
        assert.equal(imported.provenance.source, manifest);
    } finally {
        renderer.unmount();
    }
});
