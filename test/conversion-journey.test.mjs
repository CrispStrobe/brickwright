import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {auditConversionSubject, compactConversionObservationGraph, expandConversionObservationGraph, conversionObservationGraph} from '../scripts/lib/conversion-audit-core.mjs';
import {auditConversionJourney, JOURNEY_PHASES} from '../scripts/lib/conversion-journey.mjs';
import {encodeAnimationJres} from '../overlay/scratch-gui/src/lib/bw-makecode/animation-jres.js';

const subject = files => ({id: 'authored-journey', name: 'Authored journey', target: 'arcade', kind: 'RAW_BASELINE', files});
const input = (main, extra = {}) => ({'main.ts': main, ...extra,
    'pxt.json': JSON.stringify({name: 'authored-journey', dependencies: {device: '*', ...(extra['images.g.jres'] ? {animation: '*'} : {})}, files: ['main.ts', ...Object.keys(extra)]})});
const digest = bytes => createHash('sha256').update(Uint8Array.from(bytes)).digest('hex');
const phase = (result, name) => result.phases.find(row => row.phase === name);
const values = row => Object.fromEntries(row.value.variables.map(variable => [variable.name.replace(/^Game_/, ''), variable.value]));
const run = async files => {
    const before = structuredClone(files), events = [];
    let creator;
    const initial = await auditConversionSubject(subject(files), {animationResources: true, onCreator: value => {creator = value;}});
    assert.equal(initial.creator.status, 'return', JSON.stringify(initial.unsupported));
    const result = await auditConversionJourney(initial, {creator, frames: 4, onObservation: event => events.push(event)});
    assert.equal(result.status, 'completed', JSON.stringify(compactConversionObservationGraph(result)));
    assert.equal(result.operationStatus, 'completed');
    assert.equal(result.compatibilityStatus, 'no-reported-diagnostics', JSON.stringify(compactConversionObservationGraph(result.diagnosticChannels)));
    assert.equal(result.cleanCompatibility, 'not-established');
    assert.ok(result.diagnosticChannels.some(row => row.channels?.errors?.provided === false));
    assert.deepEqual(files, before);
    assert.deepEqual(result.phases.map(row => row.phase), JOURNEY_PHASES);
    assert.ok(result.phases.every(row => row.status === 'return'));
    assert.deepEqual(events.map(row => row.phase), [...JOURNEY_PHASES, 'journey-complete']);
    assert.equal(result.cleanup.filter(row => Object.hasOwn(row, 'stopAll')).length, 3);
    for (const row of result.cleanup) {
        if (row.stopAll) {assert.equal(row.stopAll.status, 'return'); assert.equal(row.quit.status, 'return');}
        else assert.equal(row.status, 'return');
    }
    assert.deepEqual(result.runtime.map(row => row.errors), [[], [], []]);
    const imported = phase(result, 'reimport').value;
    assert.deepEqual(imported.files, result.exportedFiles, 'fresh reimport consumes every exact exported string');
    assert.equal(imported.route, 'PUBLIC_SYNC_EXPORTED_FILES');
    assert.equal(imported.returned.source, result.exportedFiles['main.ts']);
    assert.ok(Object.keys(result.exportedFiles).includes('pxt.json'));
    return {initial, result};
};

test('ordered genuine scalar import VM Code export and exact-file reimport reaches three fresh VMs', async () => {
    const {result} = await run(input('let count=2\ncount=count+3\n'));
    for (const name of ['original-runtime', 'code-runtime', 'reimport-runtime']) {
        const row = phase(result, name);
        assert.equal(values(row).count, 5, name);
        assert.equal(row.value.extensionCalls.observed, false);
        assert.equal(row.value.actorPixels.observed, false);
    }
    const observed = expandConversionObservationGraph(compactConversionObservationGraph(result));
    assert.deepEqual(observed, conversionObservationGraph(result), 'whole return survives the actual lossless observer codec');
    // Mechanical completion is distinct from actual reported warnings. The
    // public importer/Creator's warning for an untranslated body is not fabricated.
    let warnedCreator;
    const warned = await auditConversionSubject(subject(input('if (0) {\n    unknownCall()\n}\nlet x = 1\n')), {
        animationResources: true, onCreator: value => { warnedCreator = value; }
    });
    assert.ok(warned.creator.channels.warnings.value.some(value => value.includes('Empty body')));
    const warnedJourney = await auditConversionJourney(warned, {creator: warnedCreator, frames: 4});
    assert.equal(warnedJourney.operationStatus, 'completed');
    assert.equal(warnedJourney.compatibilityStatus, 'reported-diagnostics');
    assert.ok(warnedJourney.diagnosticChannels.some(row => row.source === 'initial-creator' &&
        row.channels.warnings.value.some(value => value.includes('Empty body'))));

    // Actual owned VM event -> later load rejection: this is a scoped operation
    // fault, not a replacement VM/loader implementation or guest success.
    const {runCreatedProgram, SB3Creator, clearStrayTimers} = await import('./helpers/bw-vm.mjs');
    const parsed = new SB3Creator(); parsed.parse(phase(result, 'code-return').value.source);
    const rawEvent = Object.freeze(new Error('partial runtime event'));
    const loadFailure = Object.freeze(new Error('later load failure'));
    let partial, ownLoad;
    try {
        await assert.rejects(runCreatedProgram(parsed, {frames: 0, observeRun: value => {
            partial = value;
            ownLoad = Object.getOwnPropertyDescriptor(value.vm, 'loadProject');
            value.vm.runtime.emit('BLOCKS_ERROR', rawEvent);
            Object.defineProperty(value.vm, 'loadProject', {configurable: true, writable: true,
                value: async function () { throw loadFailure; }});
        }}), error => error === loadFailure);
        assert.equal(partial.state, 'load-begin');
        assert.ok(partial.errorEvents.length > 0);
        assert.ok(partial.errorEvents.every(event => event.message === rawEvent));
        assert.ok(partial.errors.every(error => error === String(rawEvent)));
    } finally {
        if (partial) {
            if (ownLoad) Object.defineProperty(partial.vm, 'loadProject', ownLoad);
            else delete partial.vm.loadProject;
            try { partial.vm.stopAll(); } finally { partial.vm.quit(); }
        }
        clearStrayTimers();
    }
});

test('four-frame gallery resource survives original Code and exported-file reimport with real artwork installation', async t => {
    const pixels = [[2,3], [4,5], [6,7], [8,9]];
    const native = encodeAnimationJres({id: 'walk', name: 'Walk', width: 2, height: 1, intervalMs: 100,
        frames: pixels.map(value => ({pixels: value}))});
    const files = input('let frames=assets.animation`Walk`\nlet alias=frames\nlet count=alias.length\nlet first=alias[0].getPixel(0,0)\n',
        {'images.g.jres': JSON.stringify({'myAnimations.walk': native})});
    const {initial, result} = await run(files);
    // Save the complete actual phase return before identity/count assertions;
    // the lossless graph retains maps, raw bytes and provided/absent channels.
    t.diagnostic(`JOURNEY_GALLERY_WITNESS ${JSON.stringify(compactConversionObservationGraph({initial, result}))}`);
    const original = phase(result, 'original-runtime').value;
    const ordinarySlots = original.creator.project.targets.flatMap(target =>
        (target.costumes || []).map((costume, costumeIndex) => ({targetName: target.name, costumeIndex,
            md5ext: original.project.targets.find(live => live.name === target.name).costumes[costumeIndex].md5ext})));
    assert.equal(initial.import.value.animationResources.length, 1, 'explicit additive core option returns the real native resource');
    const resourceId = initial.import.value.animationResources[0].document.animation.resource.id;
    const expectedHashes = pixels.map(digest);
    for (const name of ['original-runtime', 'code-runtime', 'reimport-runtime']) {
        const row = phase(result, name), resources = row.value.animationResources;
        assert.ok(resources instanceof Map, name);
        assert.equal(resources.size, 1, name);
        const resource = resources.get(resourceId);
        assert.ok(resource, `${name} preserves actual stable resource identity`);
        assert.equal(resource.name, 'Walk');
        assert.deepEqual([resource.width, resource.height], [2,1]);
        assert.deepEqual(resource.frames.map(frame => frame.durationMs), [100,100,100,100]);
        assert.deepEqual(resource.frames.map(frame => digest(frame.pixels)), expectedHashes);
        assert.equal(values(row).count, 4); assert.equal(values(row).first, 2);
        const records = row.value.artwork.records;
        assert.equal(row.value.appliedArtwork.count, records.length, 'every inspected source document binds to its live costume');
        const animationRecords = records.filter(record => record.document.animation?.resource);
        assert.equal(animationRecords.length, 1, 'one resource is independent of the ordinary costume document count');
        assert.equal(animationRecords[0].document.animation.resource.id, resourceId);
        assert.deepEqual(animationRecords[0].document.palette, initial.import.value.animationResources[0].palette);
        assert.deepEqual(animationRecords[0].document.animation.frames.map(frame =>
            digest(frame.layers[0].content.value.pixels)), expectedHashes);
        const ordinary = [];
        for (const record of records) {
            const target = row.value.project.targets[record.targetIndex];
            const costume = target.costumes[record.costumeIndex];
            assert.equal(costume.md5ext, record.renderedMd5ext, 'actual applied slot retains exact render identity');
            if (record.document.animation?.resource) continue;
            // captureCodeArtwork/retainCodeArtwork intentionally carry the
            // current Stage/Game base SVGs as ordinary version1 documents.
            assert.equal(record.document.version, 1);
            assert.equal(record.document.layers.length, 1);
            assert.equal(record.document.layers[0].type, 'vector');
            assert.deepEqual(record.document.layers[0].content, {kind: 'asset', value: record.renderedMd5ext});
            ordinary.push({targetName: target.name, costumeIndex: record.costumeIndex, md5ext: costume.md5ext});
        }
        assert.deepEqual(ordinary, name === 'code-runtime' ? ordinarySlots : [],
            'only the Code retention transaction adds every original ordinary costume document');
        const library = row.value.project.targets.find(target => target.name === resource.source.targetName);
        assert.ok(library); assert.equal(library.visible, false); assert.deepEqual(library.blocks, {});
    }
    assert.ok(Object.hasOwn(result.exportedFiles, 'images.g.jres'));
    assert.ok(Object.hasOwn(result.exportedFiles, 'images.g.ts'));
    assert.equal(phase(result, 'reimport').value.returned.animationResources.length, 1);
});
