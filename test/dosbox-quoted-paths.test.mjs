import test from 'node:test';
import assert from 'node:assert/strict';
import {fromDosboxConf} from '../overlay/scratch-gui/src/lib/bw-machines/importers.js';
import {localDosboxMachine} from '../overlay/scratch-gui/src/lib/bw-machines/local-dosbox.js';

for (const quote of ['"', "'"]) {
    for (const marker of ['#', ';']) {
        test(`quoted ${marker} in an imgmount path survives ${quote} quoting`, () => {
            const path = `images/owned${marker}disk.img`;
            const confText = `[autoexec]\nimgmount c ${quote}${path}${quote} -size 512,9,2,1 # trailing comment`;
            const imported = fromDosboxConf(confText);
            assert.equal(imported.slots.hdd.url, path);
            assert.deepEqual(imported.slots.hdd.geometry, {sectors: 9, heads: 2, cylinders: 1});
            const local = localDosboxMachine({confText, fileName: `owned${marker}disk.img`, byteLength: 9216});
            assert.deepEqual(local.slots.hdd.geometry, {sectors: 9, heads: 2, cylinders: 1});
        });
    }
}

test('comments outside quotes still hide commands and trailing options', () => {
    const imported = fromDosboxConf(`[cpu]\ncputype=386 ; use the AT\n[autoexec]\n# imgmount c ignored.img\n; imgmount c ignored-again.img\nimgmount c disk.img -size 512,9,2,1 ; -size broken`);
    assert.equal(imported.machine, 'i80386');
    assert.equal(imported.slots.hdd.url, 'disk.img');
    assert.deepEqual(imported.slots.hdd.geometry, {sectors: 9, heads: 2, cylinders: 1});
});

test('opposite quotes inside quoted paths do not expose comment markers', () => {
    const imported = fromDosboxConf(`[autoexec]\nimgmount c "images/owner's#disk.img" -size 512,9,2,1`);
    assert.equal(imported.slots.hdd.url, "images/owner's#disk.img");
    assert.deepEqual(imported.slots.hdd.geometry, {sectors: 9, heads: 2, cylinders: 1});
});

test('apostrophes within bare paths do not swallow trailing comments', () => {
    const imported = fromDosboxConf(`[autoexec]\nimgmount c owner's.img -size 512,9,2,1 # -size broken`);
    assert.equal(imported.slots.hdd.url, "owner's.img");
    assert.deepEqual(imported.slots.hdd.geometry, {sectors: 9, heads: 2, cylinders: 1});
});
