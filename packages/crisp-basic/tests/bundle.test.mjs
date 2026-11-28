import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import vm from 'node:vm';
import {bundle as createBundle, inspectNativeBundle} from '../src/bundle.mjs';
import {NATIVE_CAPABILITIES} from '../src/capabilities.mjs';
import {WASM_CAPABILITIES} from '../src/wasm-capabilities.mjs';
const bundle = (source, options) => createBundle(source, {...options, profile: 'headless'});

test('the public bundle API defaults to the SDL pack for each target family', async t => {
    const directory = await temporary(t), runtimePack = join(directory, 'missing-pack');
    await assert.rejects(createBundle('END', {target: 'linux-x64', runtimePack}), /Full SDL runtime pack not found/);
    await assert.rejects(createBundle('END', {target: 'web', runtimePack}), /SDL web runtime/);
    await assert.rejects(createBundle('PRINT "ok"\nPRINT "😃"', {filename: 'unicode.bas', runtimePack}),
        error => error.line === 2 && error.filename === 'unicode.bas' && /Latin-1/.test(error.message));
});

test('bundle dispatch rejects mismatched profile options before opening runtime files', async () => {
    await assert.rejects(createBundle('END', {profile: 'unknown'}), /Unsupported bundle profile/);
    for (const name of ['runtime', 'modulePath', 'wasmPath']) {
        await assert.rejects(createBundle('END', {[name]: 'not-opened'}), /profile headless/);
    }
    await assert.rejects(createBundle('END', {profile: 'headless', runtimePack: 'not-opened'}), /require the sdl profile/);
    await assert.rejects(createBundle('END', {profile: 'headless', assets: [{source: 'not-opened', path: 'data'}]}), /require the sdl profile/);
});

async function temporary(t) {
    const path = await mkdtemp(join(tmpdir(), 'crisp-bundle-unit-'));
    t.after(() => rm(path, {recursive: true, force: true}));
    return path;
}

function fakeELF(machine = 62, elfClass = 2) {
    const header = Buffer.alloc(128);
    header.set([0x7f, 0x45, 0x4c, 0x46, elfClass, 1]);
    header.writeUInt16LE(machine, 18);
    header.writeUInt32LE(0x400, 36);
    header.write('CRISPBASIC-BUNDLE-HOST-V1', 64);
    return header;
}

test('bundle retains Latin-1 source, line mapping, runtime bytes and notices', async t => {
    const directory = await temporary(t);
    const runtime = join(directory, 'runtime');
    const bytes = fakeELF();
    await writeFile(runtime, bytes);
    const result = await bundle('PRINT "Grüße"\nEND\n', {filename: 'greeting.bas',
        runtime, target: 'linux-x64', output: join(directory, 'greeting')});
    const packed = inspectNativeBundle(await readFile(result.path));
    assert.deepEqual(packed.runtime, bytes);
    assert.equal(packed.source.toString('latin1'), '1 PRINT "Grüße"\n2 END\n');
    assert.deepEqual(packed.metadata.sourceMap, {'1': 1, '2': 2});
    assert.match(packed.metadata.notices.find(item => item.path.includes('BBCSDL')).text, /Richard T\. Russell/);
    assert.equal(result.capabilities.profile, 'native-console');
    assert.equal(packed.metadata.execution.nodeRequired, false);
    assert.deepEqual(result.capabilities.platforms, ['linux-x64']);
    assert.deepEqual(result.capabilities.execution,
        {run: true, input: true, cancellation: false, timeout: false, outputLimit: false});
    assert.equal(NATIVE_CAPABILITIES.execution.timeout, true, 'session capability metadata must remain unchanged');
});

test('bundler verifies ELF target and rejects old hosts and already bundled inputs', async t => {
    const directory = await temporary(t);
    const runtime = join(directory, 'runtime');
    const options = {runtime, target: 'linux-arm64', output: join(directory, 'program')};
    await writeFile(runtime, fakeELF());
    await assert.rejects(bundle('END', options), /incompatible ELF/);
    await writeFile(runtime, fakeELF(183));
    const packed = await bundle('END', options);
    await assert.rejects(bundle('END', {...options, runtime: packed.path, output: join(directory, 'twice')}), /already a bundled/);
    const old = fakeELF(183); old.fill(0, 64);
    await writeFile(runtime, old);
    await assert.rejects(bundle('END', options), /lacks bundle ABI/);
});

test('bundle checks build receipts, never overwrites sources, and preserves existing outputs', async t => {
    const directory = await temporary(t);
    const runtime = join(directory, 'runtime');
    const output = join(directory, 'program');
    await writeFile(runtime, fakeELF());
    await writeFile(output, 'keep');
    const options = {runtime, target: 'linux-x64', output};
    await assert.rejects(bundle('END', options), /already exists/);
    assert.equal(await readFile(output, 'utf8'), 'keep');
    await assert.rejects(bundle('END', {...options, filename: output, overwrite: true}), /differ from the source/);
    await writeFile(join(directory, 'native-build.json'), JSON.stringify({target: 'linux-x64', binarySha256: 'wrong'}));
    await assert.rejects(bundle('END', {...options, overwrite: true}), /build receipt/);
});

test('source diagnostics retain physical line positions and malformed overlays fail closed', async () => {
    await assert.rejects(bundle('PRINT "ok"\nPRINT "😃"', {filename: 'unicode.bas'}),
        error => error.line === 2 && error.filename === 'unicode.bas' && /Latin-1/.test(error.message));
    assert.throws(() => inspectNativeBundle(Buffer.alloc(10)), /Not a CrispBASIC/);
    const bad = Buffer.alloc(24); bad.writeUInt32LE(0xffffffff, 0);
    bad.write('CRISPBASICBNDL1\0', 8);
    assert.throws(() => inspectNativeBundle(bad), /Invalid native bundle lengths/);
});

test('offline page embeds assets safely without external script or stylesheet references', async t => {
    const directory = await temporary(t);
    const modulePath = join(directory, 'runtime.mjs');
    const wasmPath = join(directory, 'runtime.wasm');
    await writeFile(modulePath, 'export default function(){throw new Error("packaging fixture only")}');
    await writeFile(wasmPath, Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]));
    const result = await bundle('PRINT "</script><script>alert(1)</script>"\nEND', {
        target: 'web', filename: 'demo.bas', title: '</title><script>bad()</script>',
        output: join(directory, 'demo.html'), modulePath, wasmPath
    });
    const html = await readFile(result.path, 'utf8');
    assert.match(html, /&lt;\/title&gt;/);
    assert.equal((html.match(/<script>/g) || []).length, 1);
    assert.equal((html.match(/<\/script>/g) || []).length, 1);
    assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=/);
    const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
    assert.doesNotThrow(() => new vm.Script(script));
    assert.equal(result.capabilities.profile, 'restricted-headless');
    assert.deepEqual(result.capabilities.platforms, ['browser-worker']);
    assert.deepEqual(result.capabilities.execution,
        {run: true, input: true, cancellation: true, timeout: false, outputLimit: true});
    assert.equal(result.capabilities.simulation.available, false);
    assert.equal(WASM_CAPABILITIES.execution.timeout, true, 'session deadline metadata remains available');
    assert.equal(WASM_CAPABILITIES.simulation.available, true, 'session simulation bridge remains available');
    assert.match(script, /window\.crispbasicBundle/);
});
