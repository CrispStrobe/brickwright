// The index names loadable assets; it does not enumerate the whole gallery.
// Exercise the production CLI against identical local and HTTP source trees.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

const BEFORE = 'a'.repeat(40);
const AFTER = 'b'.repeat(40);
const REPO = 'CrispStrobe/sb3-creator';
const TREE = `https://api.github.com/repos/${REPO}/git/trees/${AFTER}?recursive=1`;
const RAW = `https://raw.githubusercontent.com/${REPO}/${AFTER}/`;

const put = (root, rel, bytes) => {
    const file = path.join(root, rel);
    mkdirSync(path.dirname(file), {recursive: true});
    writeFileSync(file, bytes);
};

function snapshot(root, prefix = '') {
    return readdirSync(root, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name))
        .flatMap(entry => {
            const rel = prefix + entry.name;
            return entry.isDirectory() ? snapshot(path.join(root, entry.name), `${rel}/`) :
                [[rel, readFileSync(path.join(root, entry.name)).toString('base64')]];
        });
}

function fixture(t) {
    const root = mkdtempSync(path.join(tmpdir(), 'bw-gallery-remote-'));
    t.after(() => rmSync(root, {recursive: true, force: true}));
    const source = path.join(root, 'supplier');
    const gallery = path.join(root, 'overlay/scratch-gui/examples');
    const expected = {
        'index.json': JSON.stringify([{id: 'lesson', files: {
            program: 'lesson/program.bw', circuit: 'lesson/circuit.json',
            cp1: 'lesson/program.cp1', intro: 'lesson/intro.md'
        }}]),
        'README.md': 'Gallery\n', 'README.de.md': 'Beispiele\n',
        'curriculum.json': '{"trails":[]}\n',
        'lesson/program.bw': 'DEVICE PICO\n',
        'lesson/circuit.json': '{"parts":[]}\n',
        'lesson/program.cp1': '001: 101\n',
        'lesson/intro.md': 'Read the original listing.\n',
        'lesson/circuit-flat.pico.json': '{"variant":"flat-pico"}\n',
        'lesson/circuit.arduino-uno.json': '{"variant":"uno"}\n',
        'lesson/preview.bin': Buffer.from([0, 255, 128, 10]),
        'unindexed/program.bw': 'DEVICE CP1\n',
        'unindexed/circuit-flat.json': '{"variant":"unindexed"}\n'
    };
    const files = Object.fromEntries(Object.entries(expected).map(([name, bytes]) => [`examples/${name}`, bytes]));
    for (const name of ['AUDIT.md', 'DISP-ENROLLMENT-TODO.md', 'DISP-SHOWCASE-TODO.md', 'FLAT-VARIANTS-TODO.md']) {
        files[`examples/${name}`] = 'Internal supplier notes.\n';
    }
    files['src/unrelated.js'] = 'export default 1;\n';
    for (const [name, bytes] of Object.entries(files)) put(source, name, bytes);
    for (const [name, bytes] of Object.entries(expected)) put(gallery, name, bytes);
    for (const script of ['sync-examples.mjs', 'lib-pin.mjs']) {
        put(root, `scripts/${script}`, readFileSync(new URL(`../scripts/${script}`, import.meta.url)));
    }
    put(root, 'vendor-pins.json', JSON.stringify({'sb3-creator': BEFORE}, null, 2) + '\n');
    put(root, 'mock-fetch.mjs', `
        import {readFileSync, appendFileSync} from 'node:fs';
        const config = JSON.parse(readFileSync(new URL('./remote.json', import.meta.url)));
        globalThis.fetch = async input => {
            const url = new URL(String(input)).href;
            appendFileSync(new URL('./requests.txt', import.meta.url), url + '\\n');
            if (url === config.treeUrl) return new Response(JSON.stringify({
                truncated: config.truncated, tree: Object.keys(config.files).map(path => ({path, type: 'blob'}))
            }));
            if (!url.startsWith(config.raw)) throw new Error('unexpected URL: ' + url);
            const name = new URL(url).pathname.slice(new URL(config.raw).pathname.length)
                .split('/').map(decodeURIComponent).join('/');
            if (name === config.failPath) return new Response('unavailable', {status: 503});
            if (!Object.hasOwn(config.files, name)) return new Response('missing', {status: 404});
            return new Response(Buffer.from(config.files[name], 'base64'));
        };
    `);
    const state = () => ({
        gallery: snapshot(gallery), pins: readFileSync(path.join(root, 'vendor-pins.json'), 'utf8')
    });
    const run = ({local = false, check = true, pin = false, truncated = false, failPath = null} = {}) => {
        put(root, 'remote.json', JSON.stringify({treeUrl: TREE, raw: RAW, truncated, failPath,
            files: Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, Buffer.from(bytes).toString('base64')]))}));
        put(root, 'requests.txt', '');
        const args = ['--import', path.join(root, 'mock-fetch.mjs'), 'scripts/sync-examples.mjs'];
        if (check) args.push('--check');
        if (pin) args.push('--pin');
        if (local) args.push('--dir', source);
        const result = spawnSync(process.execPath, args, {
            cwd: root, env: {...process.env, SB3CREATOR_REF: AFTER}, encoding: 'utf8', timeout: 15000
        });
        assert.ifError(result.error);
        return {...result, output: result.stdout + result.stderr,
            requests: readFileSync(path.join(root, 'requests.txt'), 'utf8').trim().split('\n').filter(Boolean)};
    };
    return {root, source, gallery, files, expected, state, run};
}

test('remote and local discovery include unindexed circuit variants and lesson directories with identical exclusions', t => {
    const f = fixture(t), before = f.state();
    const local = f.run({local: true});
    assert.equal(local.status, 0, local.output);
    const remote = f.run();
    assert.equal(remote.status, 0, remote.output);
    assert.match(remote.output, /source: 13 files across 2 directories/);
    assert.equal(remote.output, local.output);
    assert.deepEqual(remote.requests.sort(), [TREE, ...Object.keys(f.expected).map(name => `${RAW}examples/${name}`)].sort());
    assert.deepEqual(f.state(), before, '--check changes neither bytes nor the pin');
});

test('remote check still rejects changed bytes and genuine destination orphans without writing', t => {
    const f = fixture(t);
    put(f.gallery, 'lesson/program.bw', 'changed locally\n');
    put(f.gallery, 'old/removed.json', '{}\n');
    const before = f.state(), result = f.run();
    assert.notEqual(result.status, 0);
    assert.match(result.output, /STALE lesson\/program\.bw/);
    assert.match(result.output, /ORPHAN old\/removed\.json/);
    assert.doesNotMatch(result.output, /ORPHAN lesson\/circuit-flat\.pico\.json/);
    assert.deepEqual(f.state(), before);
});

test('remote mutation preserves every source circuit, copies binary bytes, and removes only a real orphan', t => {
    const f = fixture(t);
    put(f.gallery, 'lesson/program.bw', 'obsolete\n');
    put(f.gallery, 'old/removed.json', '{}\n');
    const result = f.run({check: false, pin: true});
    assert.equal(result.status, 0, result.output);
    const expected = Object.entries(f.expected).map(([name, bytes]) => [name, Buffer.from(bytes).toString('base64')])
        .sort(([a], [b]) => a.localeCompare(b));
    assert.deepEqual(snapshot(f.gallery), expected);
    assert.equal(JSON.parse(f.state().pins)['sb3-creator'], AFTER);
});

test('a truncated remote tree refuses before any source payload, deletion, or pin write', t => {
    const f = fixture(t), before = f.state();
    const result = f.run({check: false, pin: true, truncated: true});
    assert.notEqual(result.status, 0);
    assert.match(result.output, /TRUNCATED/);
    assert.deepEqual(result.requests, [TREE]);
    assert.deepEqual(f.state(), before);
});

test('failure to fetch an unindexed but listed circuit cannot turn it into an orphan', t => {
    const f = fixture(t), before = f.state();
    const result = f.run({check: false, pin: true, failPath: 'examples/lesson/circuit-flat.pico.json'});
    assert.notEqual(result.status, 0);
    assert.match(result.output, /fetch examples\/lesson\/circuit-flat\.pico\.json.*HTTP 503/);
    assert.deepEqual(f.state(), before);
});

test('an index reference absent from the complete source still refuses before mutation', t => {
    const f = fixture(t), before = f.state();
    f.files['examples/index.json'] = JSON.stringify([{id: 'broken', files: {cp1: 'lesson/missing.cp1'}}]);
    const result = f.run({check: false, pin: true});
    assert.notEqual(result.status, 0);
    assert.match(result.output, /MISSING broken: files\.cp1 = lesson\/missing\.cp1/);
    assert.deepEqual(f.state(), before);
});

test('unsafe declared paths remain rejected without touching the destination or pin', t => {
    const f = fixture(t), before = f.state();
    for (const bad of ['../outside', '/absolute', 42]) {
        f.files['examples/index.json'] = JSON.stringify([{files: {cp1: bad}}]);
        const result = f.run({check: false, pin: true});
        assert.notEqual(result.status, 0);
        assert.match(result.output, /invalid declared example path/);
        assert.deepEqual(f.state(), before);
    }
});

test('a nested directory is refused by both modes instead of silently disappearing remotely', t => {
    const f = fixture(t);
    f.files['examples/lesson/nested/file.json'] = '{}\n';
    put(f.source, 'examples/lesson/nested/file.json', '{}\n');
    const before = f.state(), remote = f.run({check: false, pin: true}), local = f.run({local: true});
    assert.notEqual(remote.status, 0);
    assert.match(remote.output, /nested example path is unsupported/);
    assert.notEqual(local.status, 0);
    assert.match(local.output, /EISDIR/);
    assert.deepEqual(f.state(), before);
});

test('remote pin movement still requires --pin before any source request or write', t => {
    const f = fixture(t), before = f.state();
    const result = f.run({check: false});
    assert.notEqual(result.status, 0);
    assert.match(result.output, /refusing to move the sb3-creator pin/);
    assert.deepEqual(result.requests, []);
    assert.deepEqual(f.state(), before);
});

test('backslashes in a source-tree path refuse after only the tree request', t => {
    const f = fixture(t), before = f.state();
    f.files[String.raw`examples/lesson/..\..\..\main\package.json`] = '{}\n';
    const result = f.run({check: false, pin: true});
    assert.notEqual(result.status, 0);
    assert.match(result.output, /invalid example tree path/);
    assert.deepEqual(result.requests, [TREE]);
    assert.deepEqual(f.state(), before);
});

test('backslashes in an index-declared path refuse before other payloads or writes', t => {
    const f = fixture(t), before = f.state();
    f.files['examples/index.json'] = JSON.stringify([{files: {
        circuit: String.raw`lesson/..\..\..\main\package.json`
    }}]);
    const result = f.run({check: false, pin: true});
    assert.notEqual(result.status, 0);
    assert.match(result.output, /invalid declared example path/);
    assert.deepEqual(result.requests, [TREE, `${RAW}examples/index.json`]);
    assert.deepEqual(f.state(), before);
});

test('literal percent-dot directories and query/fragment filenames keep their exact Git identity in requests', t => {
    const f = fixture(t);
    const names = ['%2e%2e/program.bw', 'lesson/circuit?revision.json', 'lesson/circuit#view.json'];
    for (const name of names) f.files[`examples/${name}`] = `literal Git path: ${name}\n`;
    // --check deliberately observes these new, missing destination files. It
    // need not create names unsupported by some operating systems to prove the
    // source request retains the literal Git identity.
    const before = f.state(), result = f.run();
    assert.notEqual(result.status, 0);
    for (const name of names) assert.ok(result.output.includes(`STALE ${name}`), result.output);
    assert.match(result.output, /3 stale, 0 orphan\(s\)/);
    assert.ok(result.requests.includes(`${RAW}examples/%252e%252e/program.bw`));
    assert.ok(result.requests.includes(`${RAW}examples/lesson/circuit%3Frevision.json`));
    assert.ok(result.requests.includes(`${RAW}examples/lesson/circuit%23view.json`));
    assert.deepEqual(f.state(), before);
});

test('index bytes remain identical even when decoding a non-path string is lossy', t => {
    const f = fixture(t);
    const bytes = Buffer.concat([
        Buffer.from('[{"id":"lesson","note":"'), Buffer.from([0x80]),
        Buffer.from('","files":{"program":"lesson/program.bw"}}]\r\n')
    ]);
    f.files['examples/index.json'] = bytes;
    put(f.source, 'examples/index.json', bytes);
    put(f.gallery, 'index.json', bytes);
    const before = f.state(), local = f.run({local: true}), remote = f.run();
    assert.equal(local.status, 0, local.output);
    assert.equal(remote.status, 0, remote.output);
    assert.deepEqual(f.state(), before);
    put(f.gallery, 'lesson/program.bw', 'obsolete\n');
    const result = f.run({check: false, pin: true});
    assert.equal(result.status, 0, result.output);
    assert.deepEqual(readFileSync(path.join(f.gallery, 'index.json')), bytes);
});
