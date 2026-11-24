// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {circuitExamplesWithArtwork, galleryArtworkUrl} from '../overlay/scratch-gui/src/lib/gallery-artwork.js';

const root = fileURLToPath(new URL('..', import.meta.url));

test('gallery artwork keeps unchanged versions, refreshes a changed model, and repairs a missing image', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bw-gallery-artwork-'));
    const source = join(dir, 'source');
    const out = join(dir, 'covers');
    const file = 'driving-base.ldr';
    const relativeModel = join('static/sim-lab/models', file);
    mkdirSync(join(source, 'static/sim-lab/models'), {recursive: true});
    symlinkSync(join(root, 'overlay/scratch-gui/static/ldraw'), join(source, 'static/ldraw'), 'dir');
    const original = readFileSync(join(root, 'overlay/scratch-gui', relativeModel), 'utf8');
    writeFileSync(join(source, relativeModel), original);
    const run = () => execFileSync(process.execPath,
        ['scripts/generate-gallery-artwork.mjs', '--only', file, '--source-root', source, '--out', out],
        {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
    const record = () => JSON.parse(readFileSync(join(out, 'manifest.json'))).robots[file];
    try {
        assert.match(run(), /1 generated, 0 current, 0 failed/);
        const before = record();
        assert.match(before.artwork, /^[0-9a-f]{64}\.png$/);
        assert.match(run(), /0 generated, 1 current, 0 failed/);
        assert.deepEqual(record(), before);

        const modified = original.replace(/^1 71 /m, '1 4 ');
        assert.notEqual(modified, original);
        writeFileSync(join(source, relativeModel), modified);
        assert.match(run(), /1 generated, 0 current, 0 failed/);
        const changed = record();
        assert.notEqual(changed.input, before.input);
        assert.notEqual(changed.artwork, before.artwork);
        assert.equal(changed.renderer, before.renderer);
        assert.throws(() => readFileSync(join(out, before.artwork)), {code: 'ENOENT'});

        rmSync(join(out, changed.artwork));
        assert.match(run(), /1 generated, 0 current, 0 failed/);
        assert.deepEqual(record(), changed);
    } finally {
        rmSync(dir, {recursive: true, force: true});
    }
});

test('circuit card artwork is optional, file-bound and uses content-addressed app assets', () => {
    const source = 'blink/circuit.json';
    const examples = [{id: 'blink', files: {circuit: source}}, {id: 'demo', files: {circuit: 'demo/circuit.json'}}];
    const artwork = `${'a'.repeat(64)}.svg`;
    assert.equal(circuitExamplesWithArtwork(examples, {blink: {source: 'wrong', artwork}}), examples);
    const decorated = circuitExamplesWithArtwork(examples, {blink: {source, artwork}});
    assert.equal(decorated[0].artworkUrl, `static/thumbnails/gallery-artwork/${artwork}`);
    assert.equal(decorated[1], examples[1]);
    assert.equal(galleryArtworkUrl({artwork: '../thumbnail.png'}), undefined);
});
