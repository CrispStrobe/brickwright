import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

const overlay = new URL('../overlay/scratch-gui/src/lib/', import.meta.url);
const mirror = new URL('../packages/scratch-gui/src/lib/', import.meta.url);

test('the package record, Node adapter and loader have byte-identical tracked mirrors', () => {
    for (const name of ['runtime-package-inventory.json', 'runtime-package-inventory.cjs',
        'sdcc-wasm/toolchain-source.js']) {
        assert.equal(readFileSync(new URL(name, overlay), 'utf8'),
            readFileSync(new URL(name, mirror), 'utf8'), name);
    }
});

test('the actual downloader takes its origin, cache and members from the inventory', () => {
    // A fresh process lets the record change before the loader imports it.
    // If any old hard-coded identity survives, the observed download is wrong.
    // No files or network are touched by this fixture.
    const script = `
        import {createHash} from 'node:crypto';
        import inventory from ${JSON.stringify(new URL('runtime-package-inventory.cjs', overlay).href)};
        const record = inventory.packages.find(item => item.id === 'sdcc-wasm');
        record.origin = 'https://inventory.example.invalid/';
        record.cacheName = 'inventory-fixture-cache';
        record.files = ['fixture.js', 'fixture.wasm'];
        record.integrity.artifacts = Object.fromEntries(record.files.map(name => [name, {
            sha256: createHash('sha256').update('fixture').digest('hex'), bytes: 7
        }]));
        const loader = await import(${JSON.stringify(new URL('sdcc-wasm/toolchain-source.js', overlay).href)});
        const bodies = new Map();
        const opened = [];
        const requested = [];
        const caches = {open: async name => {
            opened.push(name);
            return {
                match: async url => bodies.get(url),
                put: async (url, response) => bodies.set(url, response)
            };
        }};
        const members = await loader.primeToolchainCache(undefined, {
            caches,
            fetch: async url => {
                requested.push(url);
                return new Response('fixture', {status: 200});
            }
        });
        console.log(JSON.stringify({members, requested, opened,
            frozen: Object.isFrozen(loader.TOOLCHAIN_FILES)}));
    `;
    const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
        encoding: 'utf8',
        env: {...process.env, BW_REMOTE_CODE_POLICY: 'allow', BW_REMOTE_TOOLCHAINS_POLICY: 'allow'}
    });
    const report = JSON.parse(output);
    assert.deepEqual(report.members, ['fixture.js', 'fixture.wasm']);
    assert.deepEqual(report.requested, [
        'https://inventory.example.invalid/static/sdcc-wasm/fixture.js',
        'https://inventory.example.invalid/static/sdcc-wasm/fixture.wasm'
    ]);
    assert.deepEqual(report.opened, ['inventory-fixture-cache']);
    assert.equal(report.frozen, true, 'callers must not be able to alter the exported member list');
});
