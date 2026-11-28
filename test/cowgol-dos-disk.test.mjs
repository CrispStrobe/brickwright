import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {COWGOL_DOS_DISK_VARIANTS, COWGOL_DOS_BASE_IMAGE, COWGOL_DOS_PROGRAM,
    COWGOL_DOS_MAX_EXE_BYTES, prepareCowgolDosDisk, cowgolDosDiskConfig}
    from '../overlay/scratch-gui/src/lib/bw-lang/cowgol-dos-disk.js';
import {runMachineConfig} from '../overlay/scratch-gui/src/lib/bw-machines/run-machine.js';
import {validateMachineConfig} from '../overlay/scratch-gui/src/lib/bw-machines/machine-config.js';

const base = new Uint8Array(readFileSync(new URL('../overlay/scratch-gui/static/dos/msdos200-base.img', import.meta.url)));
const provenance = JSON.parse(readFileSync(new URL('../overlay/scratch-gui/static/dos/msdos200-base.provenance.json', import.meta.url), 'utf8'));
const exe = size => { const bytes = new Uint8Array(size || 32); bytes.set([0x4d, 0x5a]); return bytes; };
const response = bytes => ({ok: true, status: 200, arrayBuffer: async () => bytes.slice().buffer});
const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return {promise, resolve};
};

test('the MS-DOS base contract matches its shipped asset and provenance', () => {
    assert.equal(base.length, COWGOL_DOS_BASE_IMAGE.bytes);
    assert.equal(COWGOL_DOS_BASE_IMAGE.bytes, provenance.bytes);
    assert.equal(createHash('sha256').update(base).digest('hex'), COWGOL_DOS_BASE_IMAGE.sha256);
    assert.equal(COWGOL_DOS_BASE_IMAGE.sha256, provenance.sha256);
    assert.ok(Object.isFrozen(COWGOL_DOS_BASE_IMAGE));
    // Check the claimed program ceiling against the image's actual free FAT
    // clusters, independently of the injector implementation.
    const word = at => base[at] | base[at + 1] << 8;
    const sector = word(11), clusterBytes = base[13] * sector;
    const fat = base.subarray(word(14) * sector, (word(14) + word(22)) * sector);
    const dataSector = word(14) + base[16] * word(22) + Math.ceil(word(17) * 32 / sector);
    const clusters = Math.floor((word(19) - dataSector) / base[13]) + 2;
    let free = 0;
    for (let cluster = 2; cluster < clusters; cluster++) {
        const offset = cluster + (cluster >> 1), packed = fat[offset] | fat[offset + 1] << 8;
        if (((cluster & 1) ? packed >> 4 : packed & 0xfff) === 0) free++;
    }
    assert.equal(COWGOL_DOS_MAX_EXE_BYTES, (free - 1) * clusterBytes,
        'one cluster must remain available for AUTOEXEC.BAT');
});

test('MS-DOS disk activation preserves CPU, disk and Controller choices through each actual CPU', async () => {
    for (const variant of COWGOL_DOS_DISK_VARIANTS) for (const display of [false, true]) {
        const config = cowgolDosDiskConfig({variant, display});
        assert.deepEqual(validateMachineConfig(config), {ok: true, errors: []});
        const {detail} = await runMachineConfig(config, {fetcher: async ref => {
            assert.equal(ref.url, 'local-media:cowgol-dos.img');
            return {bytes: base};
        }, dispatch () {}});
        assert.equal(detail.kind, variant === '80386' ? 'i80386' : 'i8086');
        if (variant === '80386') {
            assert.equal(config.machineConfig, 'dos-boot');
            assert.equal(detail.machinePreset, 'dos-boot');
        }
        assert.equal(detail.profile, 'dos');
        assert.equal(detail.slotId, 'disk');
        assert.equal(detail.x86Variant, variant);
        assert.equal(detail.dosVariant, variant);
        assert.deepEqual(detail.bytes, base);
        assert.equal(detail.widgets.length, display ? 1 : 0);
        if (display) assert.deepEqual(detail.widgets[0].config, {width: 720, height: 400});
    }
    for (const variant of ['80486', 'i8086', '8088', null, 8086]) {
        assert.throws(() => cowgolDosDiskConfig({variant}), /explicit 8086, 80186, 80286 or 80386/);
    }
    for (const display of [1, null, 'yes']) assert.throws(() => cowgolDosDiskConfig({display}), /Boolean/);
});

test('disk preparation refuses bad executables and capacity overflow before fetching or importing', async () => {
    const unreachable = {fetcher: () => assert.fail('invalid program fetched a disk'),
        loadInjector: () => assert.fail('invalid program loaded the injector')};
    for (const bytes of [null, new Uint8Array(28), Uint8Array.of(0x4d, 0x5a), [0x4d, 0x5a]]) {
        await assert.rejects(prepareCowgolDosDisk(bytes, unreachable), /compiled DOS MZ/);
    }
    await assert.rejects(prepareCowgolDosDisk(exe(COWGOL_DOS_MAX_EXE_BYTES + 1), unreachable), /program capacity/);
});

test('a missing, truncated or changed system disk cannot reach FAT injection', async () => {
    const loadInjector = () => assert.fail('unqualified OS bytes reached injection');
    await assert.rejects(prepareCowgolDosDisk(exe(), {
        fetcher: async () => ({ok: false, status: 503}), loadInjector
    }), /HTTP 503/);
    await assert.rejects(prepareCowgolDosDisk(exe(), {
        fetcher: async () => response(base.subarray(0, -1)), loadInjector
    }), /unexpected size/);
    const changed = base.slice(); changed[3000] ^= 1;
    await assert.rejects(prepareCowgolDosDisk(exe(), {
        fetcher: async () => response(changed), loadInjector
    }), /checksum/);
});

test('preparation snapshots executable bytes before asynchronous loading and checks injected readback', async () => {
    const program = exe(), original = program.slice();
    const controller = new AbortController();
    const gate = deferred(), entered = deferred();
    const files = new Map();
    let fetchOptions;
    const pending = prepareCowgolDosDisk(program, {signal: controller.signal,
        fetcher: async (url, options) => {
            assert.equal(url, COWGOL_DOS_BASE_IMAGE.url);
            fetchOptions = options; entered.resolve(); await gate.promise;
            return response(base);
        }, loadInjector: async () => ({
            injectFile: (image, name, bytes) => { files.set(name, bytes.slice()); return image.slice(); },
            readFile: (_image, name) => files.get(name)
        })});
    await entered.promise;
    program.fill(0xff);
    gate.resolve();
    const disk = await pending;
    assert.equal(fetchOptions.signal, controller.signal);
    assert.equal(disk.length, base.length);
    assert.deepEqual(files.get(COWGOL_DOS_PROGRAM), original);
    assert.equal(new TextDecoder().decode(files.get('AUTOEXEC.BAT')), 'COWGOL\r\n');
    assert.deepEqual(base, new Uint8Array(readFileSync(new URL('../overlay/scratch-gui/static/dos/msdos200-base.img', import.meta.url))));
    await assert.rejects(prepareCowgolDosDisk(exe(), {
        fetcher: async () => response(base), loadInjector: async () => ({
            injectFile: image => image.slice(), readFile: () => null
        })
    }), /did not preserve/);
});

for (const phase of ['fetch', 'body', 'injector']) {
    test(`cancelled DOS preparation cannot inject after pending ${phase}`, async () => {
        const controller = new AbortController(), entered = deferred(), release = deferred();
        const hold = async name => { if (phase === name) { entered.resolve(); await release.promise; } };
        const pending = prepareCowgolDosDisk(exe(), {signal: controller.signal,
            fetcher: async (_url, options) => {
                assert.equal(options.signal, controller.signal);
                await hold('fetch');
                return {ok: true, arrayBuffer: async () => { await hold('body'); return base.slice().buffer; }};
            }, loadInjector: async () => {
                await hold('injector');
                return {injectFile: () => assert.fail('a cancelled request injected a program')};
            }});
        await entered.promise;
        controller.abort(new Error('source ownership revoked'));
        release.resolve();
        await assert.rejects(pending, /source ownership revoked/);
    });
}

test('already cancelled preparation does not fetch a system image', async () => {
    const controller = new AbortController(); controller.abort(new Error('stopped'));
    await assert.rejects(prepareCowgolDosDisk(exe(), {signal: controller.signal,
        fetcher: () => assert.fail('stopped request fetched an image')}), /stopped/);
});
