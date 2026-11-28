// SPDX-License-Identifier: BSD-3-Clause
// Locale behavior at the media-validation and terminal-construction boundary.
// CPU execution is qualified by the existing KIM-1 suites.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {kim1T} from '../overlay/scratch-gui/src/lib/bw-machines/kim1-l10n.js';

const source = name => readFileSync(new URL(
    '../overlay/scratch-gui/src/lib/bw-machines/' + name, import.meta.url), 'utf8');
const loadFactory = (name, bindings, exported) => {
    // Keep actual function bodies; replace only imported service boundaries.
    const body = source(name).replace(/^import\s[\s\S]*?;\r?\n/gm, '').replace(/^export\s/gm, '');
    return new Function(...Object.keys(bindings), body + '\nreturn {' + exported.join(',') + '};')(
        ...Object.values(bindings));
};

test('KIM labels use regional German tags and preserve technical names and English fallback', () => {
    assert.equal(kim1T('de-DE', 'cpmDrive'), 'CP/M-65-Laufwerk');
    assert.equal(kim1T('de-CH', 'xkimInput'), 'xKIM-Befehl');
    assert.equal(kim1T('de', 'aceTitle'), 'ACE KIM · 65C02');
    assert.equal(kim1T('de', 'xkimTitle'), 'Corsham xKIM');
    assert.equal(kim1T('fr', 'cpmDrive'), 'CP/M-65 drive');
    assert.equal(kim1T('de', 'ttyRejected', {verb: 'mountSD'}), 'KIM-1 hat mountSD abgelehnt.');
});

test('CP/M validation and real terminal options receive the selected locale', async () => {
    const api = loadFactory('kim1-cpm65.js', {kim1T, createKim1Tty: options => options},
        ['readKim1CpmArchive', 'createKim1CpmTerminal']);
    await assert.rejects(api.readKim1CpmArchive('unknown', null), /pinned upstream ZIP/);
    await assert.rejects(api.readKim1CpmArchive('unknown', null, 'de'), /festgelegte Upstream-ZIP/);
    await assert.rejects(api.readKim1CpmArchive('sdshield',
        {size: 514318, arrayBuffer: async () => new ArrayBuffer(1)}, 'de'), /Prüfsumme/);
    const media = {profile: {label: 'Corsham DSK', mount: 'mountCorshamDisk'}, program: 'boot', disk: new Uint8Array()};
    const german = api.createKim1CpmTerminal(media, 'de-DE');
    assert.equal(german.locale, 'de-DE');
    assert.equal(german.title, 'CP/M-65 · Corsham DSK');
    assert.equal(german.inputLabel, 'CP/M-65-Befehl');
    assert.match(german.help, /Warte auf A>/);
    const english = api.createKim1CpmTerminal(media);
    assert.equal(english.inputLabel, 'CP/M-65 command');
    assert.match(english.help, /Wait for A>/);
});

test('xKIM validates selected media and constructs localized terminal controls without changing routing', async () => {
    const api = loadFactory('kim1-xkim.js', {
        kim1T, createKim1Tty: options => options,
        XKIM_FAT_IMAGE_LIMIT: 128 * 1024 * 1024, XKIM_FILE_COUNT: 64,
        XKIM_TOTAL_LIMIT: 2 * 1024 * 1024, XKIM_FILE_LIMIT: 65536,
        XKIM_SHORT_NAME: /^[A-Za-z0-9_]{1,8}(?:\.[A-Za-z0-9_]{1,3})?$/
    }, ['readXkimMedia', 'createXkimMemoryMap', 'createXkimTerminal']);
    await assert.rejects(api.readXkimMedia({size: 0}, [], null, 'de'), /8-KiB-xKIM-ROM/);
    await assert.rejects(api.readXkimMedia({size: 8192}, [{size: 0}], {size: 1}, 'de'), /entweder/);
    assert.throws(() => api.createXkimMemoryMap(new Uint8Array(1), 'de'), /benötigt ein 8-KiB-ROM/);
    const session = api.createXkimTerminal({rom: new Uint8Array(8192), files: [], timerLine: 'irq',
        diskImage: {source: new Uint8Array(), name: 'disk.img'}, locale: 'de'});
    assert.equal(session.locale, 'de');
    assert.equal(session.title, 'xKIM · Corsham-Dateien');
    assert.equal(session.inputLabel, 'xKIM-Befehl');
    assert.match(session.help, /Uhrzeit in UTC/);
    assert.match(session.help, /Abbild speichern/);
    const controls = [];
    session.setup((verb, value) => controls.push([verb, value]));
    assert.deepEqual(controls.map(([verb]) => verb), ['setMemoryCard', 'mountCorshamFiles', 'setCorshamTimerLine']);
    assert.equal(controls.at(-1)[1], 'irq');
    assert.equal(session.boot, 'E000 G');
    assert.equal(session.encodeInput('D', '>'), 'D');
    assert.equal(session.encodeInput('TEST.TXT', 'filename:'), 'TEST.TXT\r');
});

test('ACE ROM size failures use the caller locale while license names stay intact', async () => {
    const api = loadFactory('ace-kim-library.js', {kim1T,
        defaultImageFetcher: async () => ({bytes: new Uint8Array(1)})},
    ['aceKimMedia', 'aceKimLicenses', 'readAceKimFirmware']);
    assert.equal(api.aceKimMedia.title, 'ACE KIM · 65C02');
    assert.deepEqual(api.aceKimLicenses.map(entry => entry.label), ['BIOS 1.8', 'KC Monitor 1.1']);
    await assert.rejects(api.readAceKimFirmware(), /unexpected ROM size/);
    await assert.rejects(api.readAceKimFirmware('de'), /unerwartete Größe/);
});
