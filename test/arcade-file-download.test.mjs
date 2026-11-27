import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const source = readFileSync(new URL('../overlay/scratch-gui/src/lib/download-blob.js', import.meta.url), 'utf8');

test('an explicit Arcade file export downloads directly in a browser that supports sharing', async () => {
    const calls = [];
    const link = {click () { calls.push(['download', this.download, this.href]); }};
    const document = {createElement: () => link, body: {appendChild () {}, removeChild () {}}};
    const navigator = {canShare: () => true, async share () { calls.push(['share']); }};
    const window = {URL: {createObjectURL: () => 'blob:example', revokeObjectURL () {}}, setTimeout (fn) { fn(); }};
    const Anchor = function () {};
    Anchor.prototype.download = '';
    const download = new Function('document', 'navigator', 'window', 'HTMLAnchorElement',
        source.replace('export default', 'return'))(document, navigator, window, Anchor);
    const file = new Blob(['Arcade source'], {type: 'application/octet-stream'});

    await download('rift-rally.mkcd', file, {allowBrowserShare: false});
    assert.deepEqual(calls, [['download', 'rift-rally.mkcd', 'blob:example']]);
    await download('project.sb3', file);
    assert.deepEqual(calls.at(-1), ['share']);
});
