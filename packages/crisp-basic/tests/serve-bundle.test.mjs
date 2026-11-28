// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {serveBundle} from '../src/serve-bundle.mjs';

test('serve CLI dispatch prints a live loopback URL and exits cleanly on SIGTERM', {timeout: 10000}, async t => {
    const directory = await mkdtemp(join(tmpdir(), 'crisp-serve-cli-'));
    const file = join(directory, 'page.html'); await writeFile(file, '<!doctype html><title>CLI</title>');
    const child = spawn(process.execPath, [fileURLToPath(new URL('../bin/crispbasic.mjs', import.meta.url)),
        'serve', file, '--port', '0', '--json'], {stdio: ['ignore', 'pipe', 'pipe']});
    let stderr = ''; child.stderr.on('data', bytes => { stderr += bytes; });
    const closed = new Promise(resolve => child.once('close', (code, signal) => resolve({code, signal})));
    t.after(async () => {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
        await closed;
        // Cleanup only the directory allocated by this test, never child output.
        await rm(directory, {recursive: true, force: true});
    });
    const info = await new Promise((resolve, reject) => {
        let stdout = '';
        const timer = setTimeout(() => reject(new Error('serve CLI did not report its address: ' + stderr)), 5000);
        child.once('error', error => { clearTimeout(timer); reject(error); });
        child.stdout.on('data', bytes => {
            stdout += bytes;
            if (!stdout.includes('\n')) return;
            clearTimeout(timer);
            try { resolve(JSON.parse(stdout.split('\n')[0])); } catch (error) { reject(error); }
        });
    });
    assert.equal(new URL(info.url).hostname, '127.0.0.1');
    const response = await fetch(info.url);
    assert.equal(response.headers.get('cross-origin-opener-policy'), 'same-origin');
    assert.equal(response.headers.get('cross-origin-embedder-policy'), 'require-corp');
    assert.match(await response.text(), /<title>CLI<\/title>/);
    child.kill('SIGTERM');
    assert.deepEqual(await closed, {code: 0, signal: null}, stderr);
});

test('offline SDL server binds loopback and serves one file with isolation headers', async t => {
    const directory = await mkdtemp(join(tmpdir(), 'crispbasic-serve-'));
    t.after(() => rm(directory, {recursive: true, force: true}));
    const filename = join(directory, 'program.html');
    await writeFile(filename, '<!doctype html><p>offline</p>');
    await writeFile(join(directory, 'private.txt'), 'not an asset');
    const server = await serveBundle(filename, {port: 0});
    t.after(() => server.close());
    assert.match(server.url, /^http:\/\/127\.0\.0\.1:\d+\/$/);
    const response = await fetch(server.url);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cross-origin-opener-policy'), 'same-origin');
    assert.equal(response.headers.get('cross-origin-embedder-policy'), 'require-corp');
    assert.equal(response.headers.get('cross-origin-resource-policy'), 'same-origin');
    assert.match(response.headers.get('content-type'), /^text\/html/);
    assert.equal(await response.text(), '<!doctype html><p>offline</p>');
    const head = await fetch(server.url, {method: 'HEAD'});
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    assert.equal((await fetch(new URL('private.txt', server.url))).status, 404);
    assert.equal((await fetch(server.url, {method: 'POST'})).status, 405);
    await Promise.all([server.close(), server.close()]);
    await assert.rejects(fetch(server.url));
});

test('offline server refuses invalid ports and directories', async t => {
    const directory = await mkdtemp(join(tmpdir(), 'crispbasic-serve-options-'));
    t.after(() => rm(directory, {recursive: true, force: true}));
    for (const port of [-1, 65536, 1.5, NaN]) await assert.rejects(serveBundle(directory, {port}), /port/);
    await assert.rejects(serveBundle(directory, {port: 0}), /must be a file/);
});
