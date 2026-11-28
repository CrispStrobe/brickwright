// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ControllerPanel} from 'bw-board';
import {aceKimLicenses, aceKimMedia, readAceKimFirmware} from '../overlay/scratch-gui/src/lib/bw-machines/ace-kim-library.js';
import {addAceKimFace, isAceKimFace} from '../overlay/scratch-gui/src/lib/controller-machine-faces.js';

test('ACE KIM exposes both MIT licenses and rejects an altered firmware download', async context => {
    assert.equal(aceKimMedia.machine, 'kim1');
    assert.deepEqual(aceKimLicenses.map(item => item.label), ['BIOS 1.8', 'KC Monitor 1.1']);
    const fetcher = context.mock.method(globalThis, 'fetch', async () => new Response(new Uint8Array(8192)));
    await assert.rejects(readAceKimFirmware(), /sha256 mismatch/);
    const urls = fetcher.mock.calls.map(call => call.arguments[0]);
    assert.deepEqual(urls, aceKimLicenses.map(({url}, index) => new URL(index ? 'kc-monitor.rom' : 'bios.rom', url).href));
});

test('ACE KIM uses the removable and serializable machine widget model', () => {
    const panel = new ControllerPanel();
    const widget = addAceKimFace(panel);
    assert.equal(isAceKimFace(widget), true);
    assert.equal(addAceKimFace(panel), undefined);
    assert.equal(isAceKimFace(ControllerPanel.fromJSON(panel.toJSON()).getWidget(widget.name)), true);
    panel.removeWidget(widget.name);
    assert.ok(addAceKimFace(panel));
});
