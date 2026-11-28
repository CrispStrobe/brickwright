import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp, mkdir, readFile, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Script} from 'node:vm';
import {bundleSDLWeb} from '../src/bundle-sdl-web.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function setup(t) {
    const dir = await mkdtemp(join(tmpdir(), 'crisp-sdl-web-test-'));
    t.after(() => rm(dir, {recursive: true, force: true}));
    const pack = join(dir, 'runtime');
    await mkdir(pack);
    const contents = new Map([
        ['runtime.js', Buffer.from('function createCrispBasicSDL(){};var mainScriptUrlOrBlob;')],
        ['runtime.wasm', Buffer.from([0, 97, 115, 109, 1, 0, 0, 0])],
        ['notice.txt', Buffer.from('BBCSDL test notice: <original> ©', 'latin1')]
    ]);
    for (const [path, bytes] of contents) await writeFile(join(pack, path), bytes);
    const receipt = {
        schemaVersion: 1, hostABI: 1, format: 'crispbasic-sdl-web-runtime', backend: 'bbcsdl-sdl-wasm',
        upstreamCommit: 'test-pin', module: 'runtime.js', wasm: 'runtime.wasm',
        files: [...contents].map(([path, bytes]) => ({path, bytes: bytes.length, sha256: sha(bytes)})),
        notices: [{name: 'BBCSDL', path: 'notice.txt'}], assets: [],
        capabilities: {graphics: true, sound: true}, limitations: ['Test runtime only']
    };
    const save = () => writeFile(join(pack, 'build.json'), JSON.stringify(receipt));
    await save();
    const filename = join(dir, 'program.bas'), output = join(dir, 'program.html');
    await writeFile(filename, 'PRINT "hello"\nEND\n');
    return {dir, pack, filename, output, contents, receipt, save};
}

test('full SDL page embeds bytes, escapes source and title, and preserves notices', async t => {
    const {dir, pack, filename, output} = await setup(t);
    const asset = join(dir, 'input.bin');
    await writeFile(asset, Buffer.from([0, 13, 10, 255]));
    const source = 'PRINT "</script><script>bad()</script>é"\nEND';
    const result = await bundleSDLWeb(source, {filename, output, runtimePack: pack,
        title: '<unsafe & "title">', assets: [{source: asset, path: 'data/input.bin'}]});
    assert.equal(result.profile, 'sdl');
    const html = await readFile(output, 'utf8');
    assert.match(html, /&lt;unsafe &amp; &quot;title&quot;&gt;/);
    assert.ok(!html.includes('<script>bad()'));
    const payload = JSON.parse(html.match(/id="crispbasic-sdl-payload">([\s\S]*?)<\/script>/)[1]);
    assert.equal(Buffer.from(payload.program, 'base64').toString('latin1'), '1 PRINT "</script><script>bad()</script>é"\n2 END\n');
    assert.deepEqual(Buffer.from(payload.resources[0].data, 'base64'), Buffer.from([0, 13, 10, 255]));
    assert.match(payload.metadata.notices[0].text, /©/);
    assert.equal(payload.metadata.execution.networkAssets, false);
    assert.equal(payload.metadata.execution.captureDefault, false);
    const script = html.match(/<script>\n([\s\S]*?)<\/script>/)[1];
    assert.doesNotThrow(() => new Script(script));
});

test('runtime integrity and required BBCSDL notice are enforced', async t => {
    const {pack, filename, output, contents, receipt, save} = await setup(t);
    await writeFile(join(pack, 'runtime.wasm'), Buffer.from('corrupt'));
    await assert.rejects(bundleSDLWeb('END', {filename, output, runtimePack: pack}), /SHA-256|size mismatch/);
    await writeFile(join(pack, 'runtime.wasm'), contents.get('runtime.wasm'));
    receipt.notices = [];
    await save();
    await assert.rejects(bundleSDLWeb('END', {filename, output, runtimePack: pack}), /BBCSDL notice/);
});

test('virtual resource paths reject traversal, reserved roots and collisions', async t => {
    const {dir, pack, filename, output} = await setup(t);
    const asset = join(dir, 'data.bin');
    await writeFile(asset, 'data');
    for (const path of ['../escape', '/absolute', 'a//b', 'a/./b', 'a\\b', 'program.bas', 'usr/hidden']) {
        await assert.rejects(bundleSDLWeb('END', {filename, output, runtimePack: pack,
            assets: [{source: asset, path}]}), undefined, path);
    }
    for (const paths of [['data', 'data'], ['data', 'data/nested'], ['data/nested', 'data']]) {
        await assert.rejects(bundleSDLWeb('END', {filename, output, runtimePack: pack,
            assets: paths.map(path => ({source: asset, path}))}), /Duplicate|conflicting/);
    }
});

test('atomic output never replaces an existing file or any aliased input accidentally', async t => {
    const {dir, pack, filename, output} = await setup(t);
    await writeFile(output, 'keep');
    await assert.rejects(bundleSDLWeb('END', {filename, output, runtimePack: pack}), /already exists/);
    assert.equal(await readFile(output, 'utf8'), 'keep');
    const alias = join(dir, 'alias.html');
    await symlink(filename, alias);
    await assert.rejects(bundleSDLWeb('END', {filename, output: alias, runtimePack: pack, overwrite: true}), /must not overwrite/);
    await assert.rejects(bundleSDLWeb('END', {filename, output: join(pack, 'runtime.js'), runtimePack: pack, overwrite: true}), /must not overwrite/);
    assert.equal(await readFile(filename, 'utf8'), 'PRINT "hello"\nEND\n');
});

test('runtime receipt paths cannot escape their pack through traversal or symlinks', async t => {
    const {dir, pack, filename, output, receipt, save} = await setup(t);
    const external = join(dir, 'outside.js');
    await writeFile(external, 'function createCrispBasicSDL(){};var mainScriptUrlOrBlob;');
    await rm(join(pack, 'runtime.js'));
    await symlink(external, join(pack, 'runtime.js'));
    await assert.rejects(bundleSDLWeb('END', {filename, output, runtimePack: pack}), /escapes/);
    receipt.files[0].path = '../outside.js';
    await save();
    await assert.rejects(bundleSDLWeb('END', {filename, output, runtimePack: pack}), /path/);
});
