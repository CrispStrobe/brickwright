import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {
    optionalPackageBuildExclusions,
    readRuntimePackageInventory,
    validateRuntimePackageInventory
} from '../scripts/lib/runtime-package-inventory.mjs';

const guard = fileURLToPath(new URL('../scripts/verify-no-gpl-in-build.mjs', import.meta.url));
const fixture = t => {
    const dir = mkdtempSync(join(tmpdir(), 'bw-package-boundary-'));
    t.after(() => rmSync(dir, {recursive: true, force: true}));
    return dir;
};
const write = (dir, name, contents) => {
    const file = join(dir, name);
    mkdirSync(dirname(file), {recursive: true});
    writeFileSync(file, contents);
};
const scan = dir => spawnSync(process.execPath, [guard, dir], {encoding: 'utf8'});

test('the selected package inventory supplies distinctive SDCC output exclusions', () => {
    const inventory = readRuntimePackageInventory();
    const exclusions = optionalPackageBuildExclusions(inventory);
    assert.equal(validateRuntimePackageInventory(inventory), inventory);
    assert.ok(exclusions.directories.has('sdcc-wasm'));
    for (const name of ['cc1.js', 'cc1.wasm', 'sdcc.js', 'sdcc.wasm',
        'sdas8051.js', 'sdas8051.wasm', 'sdld.js', 'sdld.wasm']) {
        assert.match(exclusions.filenames.get(name), /optional user download, never bundled/, name);
    }
    assert.equal(exclusions.filenames.has('runtime.json'), false,
        'a generic metadata basename is not evidence of an optional payload');
});

test('inventory validation rejects unsupported categories and inconsistent download boundaries', () => {
    const baseline = readRuntimePackageInventory();
    const cases = [
        ['new schema', record => { record.schema = 2; }],
        ['unqualified scope', record => { record.scope = 'all-dependencies'; }],
        ['unknown kind', record => { record.packages[0].kind = 'unknown'; }],
        ['unknown delivery', record => { record.packages[0].delivery = 'automatic-download'; }],
        ['optional marked bundled', record => { record.packages[0].bundled = true; }],
        ['bundled reclassification', record => {
            record.packages[0].delivery = 'bundled';
            record.packages[0].bundled = true;
            delete record.packages[0].buildExclusions;
        }],
        ['external reclassification', record => {
            record.packages[0].delivery = 'external-service';
            delete record.packages[0].buildExclusions;
        }],
        ['missing cache name', record => { delete record.packages[0].cacheName; }],
        ['empty cache name', record => { record.packages[0].cacheName = ' '; }],
        ['insecure origin', record => { record.packages[0].origin = 'http://example.invalid/'; }],
        ['origin without trailing slash', record => { record.packages[0].origin = 'https://example.invalid/tools'; }],
        ['origin query', record => { record.packages[0].origin = 'https://example.invalid/?v=1'; }],
        ['origin fragment', record => { record.packages[0].origin = 'https://example.invalid/#tools'; }],
        ['origin credentials', record => { record.packages[0].origin = 'https://user:pass@example.invalid/'; }],
        ['no packages', record => { record.packages = []; }],
        ['duplicate id', record => { record.packages.push(structuredClone(record.packages[0])); }],
        ['duplicate member', record => { record.packages[0].files.push('cc1.js'); }],
        ['member traversal', record => { record.packages[0].files.push('../payload.wasm'); }],
        ['missing exclusions', record => { delete record.packages[0].buildExclusions; }],
        ['no filename markers', record => { record.packages[0].buildExclusions.filenames = []; }],
        ['marker traversal', record => { record.packages[0].buildExclusions.directories = ['../sdcc-wasm']; }],
        ['undeclared member marker', record => { record.packages[0].buildExclusions.filenames.push('unknown.wasm'); }],
        ['missing licence declaration', record => { record.packages[0].compilerLicense.declaredSpdx = ''; }],
        ['unsupported integrity claim', record => { record.packages[0].integrity.status = 'verified'; }]
    ];
    for (const [label, mutate] of cases) {
        const record = structuredClone(baseline);
        mutate(record);
        assert.throws(() => validateRuntimePackageInventory(record), /Runtime package inventory:/, label);
    }
});

test('the output gate preserves empty-tree success and missing-root failure', t => {
    const dir = fixture(t);
    const empty = scan(dir);
    assert.equal(empty.status, 0, empty.stderr);
    assert.match(empty.stdout, /0 files checked/);
    const missing = scan(join(dir, 'missing'));
    assert.equal(missing.status, 2);
    assert.match(missing.stderr, /no build at/);
});

test('the output gate allows download metadata, licence disclosures and unrelated generic files', t => {
    const dir = fixture(t);
    write(dir, 'index.html', '<!doctype html>');
    write(dir, 'static/app.js', 'const metadata = ' + JSON.stringify(readRuntimePackageInventory()) + ';');
    write(dir, 'static/runtime.json', '{"application":"unrelated"}');
    write(dir, 'static/runtime.wasm', Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]));
    write(dir, 'static/ok.json.gz', gzipSync('{"fine":true}'));
    const result = scan(dir);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /5 files checked/);
    assert.match(result.stdout, /not a complete dependency or licence audit/);
});

test('the output gate rejects SDCC JavaScript glue and WASM outside the package directory', t => {
    const dir = fixture(t);
    const files = ['cc1.js', 'cc1.wasm', 'sdcc.js', 'sdcc.wasm',
        'sdas8051.js', 'sdas8051.wasm', 'sdld.js', 'sdld.wasm'];
    for (const name of files) write(dir, 'assets/nested/' + name, 'fixture payload');
    const result = scan(dir);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    for (const name of files) {
        assert.ok(result.stderr.includes('assets/nested/' + name + ' —'), result.stderr);
    }
    assert.match(result.stderr, /sdcc-wasm.*optional user download, never bundled/);
});

test('the output gate rejects the optional package directory including generic runtime metadata', t => {
    const dir = fixture(t);
    write(dir, 'static/sdcc-wasm/runtime.json', '{}');
    const result = scan(dir);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /static\/sdcc-wasm\/ — 1 file\(s\)/);
});

test('the inventory-driven output gate retains known boot-media, firmware and sparse-code controls', t => {
    const dir = fixture(t);
    const image = Buffer.alloc(128);
    image.set([0x52, 0x53, 0x43, 0x05], 0x38);
    write(dir, 'static/renamed-kernel.bin', image);
    write(dir, 'static/renamed-initramfs', '070701000000000000');
    const snapshot = Buffer.from('BWRV32S1' + '\0'.repeat(200));
    write(dir, 'static/renamed-snapshot', snapshot);
    write(dir, 'static/compressed-cache.dat', gzipSync(snapshot));
    write(dir, 'static/blinkenrocket-firmware.hex', 'fixture');
    write(dir, 'static/sparse.cjs', 'const factory = "csSpsolve";');
    const result = scan(dir);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /renamed-kernel\.bin — a RISC-V Linux kernel Image/);
    assert.match(result.stderr, /renamed-initramfs — a cpio archive/);
    assert.match(result.stderr, /renamed-snapshot — a RISC-V Linux machine snapshot/);
    assert.match(result.stderr, /compressed-cache\.dat — a RISC-V Linux machine snapshot/);
    assert.match(result.stderr, /blinkenrocket-firmware\.hex — Blinkenrocket firmware images/);
    assert.match(result.stderr, /sparse\.cjs — mathjs's CSparse-derived sparse factories/);
});
