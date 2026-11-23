import {test} from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {ARCADE_PALETTE} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-assets.js';

const artwork = await import('../overlay/scratch-gui/src/lib/bw-artwork-bundle.js');
const projectBundle = await import('../overlay/scratch-gui/src/lib/bw-project-bundle.js');

const fixture = async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2"/></svg>';
    const id = 'f0000000000000000000000000000000.svg';
    const costume = {name: 'costume1', md5ext: id, dataFormat: 'svg'};
    const target = {isOriginal: true, sprite: {costumes: [costume]}};
    const vm = {runtime: {targets: [target]}};
    const project = {targets: [{isStage: true, name: 'Stage', blocks: {},
        costumes: [{...costume, rotationCenterX: 1, rotationCenterY: 1}], sounds: []}],
    monitors: [], extensions: [], meta: {semver: '3.0.0'}};
    const zip = new JSZip();
    zip.file('project.json', JSON.stringify(project));
    zip.file(id, svg);
    return {vm, costume, project, svg, id, blob: await zip.generateAsync({type: 'blob'})};
};

test('SB3 retains Scratch rendering and opens its editable pixel source', async () => {
    const {vm, costume, project, svg, id, blob} = await fixture();
    const pixelDoc = {version: 1, pixelScale: 4, layers: [{id: 'pixels', type: 'pixel',
        name: 'Pixels', visible: true, locked: false, opacity: 1,
        content: {kind: 'pixels', value: {width: 2, height: 2, pixels: [1, 2, 3, 4]}}}]};
    artwork.setCostumeDocument(costume, pixelDoc);
    const saved = await artwork.attachArtwork(blob, vm);
    const zip = await JSZip.loadAsync(await saved.arrayBuffer());
    assert.deepEqual(JSON.parse(await zip.file('project.json').async('text')), project);
    assert.equal(await zip.file(id).async('text'), svg);
    const payload = JSON.parse(await zip.file(artwork.ARTWORK_PATH).async('text'));
    assert.equal(payload.version, 1, 'default artwork keeps the original bundle version');
    assert.deepEqual(payload.costumes[0].document, pixelDoc);

    const inspected = await artwork.inspectArtwork(await saved.arrayBuffer());
    assert.equal(inspected.outcome, 'loaded');
    const reopened = await fixture();
    assert.equal(artwork.applyArtwork(inspected, reopened.vm).count, 1);
    assert.deepEqual(artwork.getCostumeDocument(reopened.costume), pixelDoc);
    artwork.resetCostumeDocument(reopened.costume);
    assert.equal(artwork.getCostumeDocument(reopened.costume).layers[0].content.kind, 'asset');
});

test('SB3 keeps ordered, hidden pixel layers while Scratch keeps its flattened asset', async () => {
    const {vm, costume, blob, id} = await fixture();
    const source = {version: 1, pixelScale: 4, activeLayerId: 'top', layers: [
        {id: 'bottom', type: 'pixel', name: 'Background', visible: true, locked: false,
            opacity: 1, content: {kind: 'pixels', value: {width: 2, height: 1, pixels: [2, 3]}}},
        {id: 'top', type: 'pixel', name: 'Hidden', visible: false, locked: false,
            opacity: 1, content: {kind: 'pixels', value: {width: 2, height: 1, pixels: [10, 0]}}}
    ]};
    artwork.setCostumeDocument(costume, source);
    const saved = await artwork.attachArtwork(blob, vm);
    const zip = await JSZip.loadAsync(await saved.arrayBuffer());
    assert.ok(zip.file(id), 'the original Scratch costume asset remains present');
    assert.deepEqual(JSON.parse(await zip.file(artwork.ARTWORK_PATH).async('text')).costumes[0].document,
        source);
    const inspected = await artwork.inspectArtwork(await saved.arrayBuffer());
    const reopened = await fixture();
    assert.equal(artwork.applyArtwork(inspected, reopened.vm).count, 1);
    assert.deepEqual(artwork.getCostumeDocument(reopened.costume), source);
});

test('a version 2 palette survives SB3 save/reopen alongside the unchanged Scratch asset', async () => {
    const {vm, costume, blob, id, svg} = await fixture();
    const palette = [...ARCADE_PALETTE];
    palette[2] = '#123456';
    const source = {version: 2, palette, pixelScale: 4, layers: [{id: 'pixels', type: 'pixel',
        name: 'Pixels', visible: true, locked: false, opacity: 1,
        content: {kind: 'pixels', value: {width: 2, height: 2, pixels: [2, 2, 0, 2]}}}]};
    artwork.setCostumeDocument(costume, source);
    const saved = await artwork.attachArtwork(blob, vm);
    const zip = await JSZip.loadAsync(await saved.arrayBuffer());
    assert.equal(await zip.file(id).async('text'), svg);
    assert.equal(JSON.parse(await zip.file(artwork.ARTWORK_PATH).async('text')).version, 2);
    const reopened = await fixture();
    const inspected = await artwork.inspectArtwork(await saved.arrayBuffer());
    assert.equal(artwork.applyArtwork(inspected, reopened.vm).count, 1);
    assert.deepEqual(artwork.getCostumeDocument(reopened.costume), source);
    assert.throws(() => artwork.setCostumeDocument(reopened.costume, {...source, palette: [null, '#fff']}),
        /invalid artwork palette/);
});

test('a version 3 animation preserves editable frames beside one Scratch render', async () => {
    const {vm, costume, blob, id, svg} = await fixture();
    const layer = pixels => ({id: 'pixels', type: 'pixel', name: 'Pixels', visible: true,
        locked: false, opacity: 1, content: {kind: 'pixels',
            value: {width: 2, height: 1, pixels}}});
    const first = [layer([2, 0])];
    const second = [layer([0, 3])];
    const source = {version: 3, pixelScale: 4, activeLayerId: 'pixels', layers: second,
        animation: {activeFrameId: 'two', frames: [
            {id: 'one', durationMs: 80, activeLayerId: 'pixels', layers: first},
            {id: 'two', durationMs: 120, activeLayerId: 'pixels', layers: second}]}};
    artwork.setCostumeDocument(costume, source);
    const saved = await artwork.attachArtwork(blob, vm);
    const zip = await JSZip.loadAsync(await saved.arrayBuffer());
    assert.equal(await zip.file(id).async('text'), svg);
    assert.equal(JSON.parse(await zip.file(artwork.ARTWORK_PATH).async('text')).version, 3);
    const reopened = await fixture();
    const inspected = await artwork.inspectArtwork(await saved.arrayBuffer());
    assert.equal(artwork.applyArtwork(inspected, reopened.vm).count, 1);
    assert.deepEqual(artwork.getCostumeDocument(reopened.costume), source);
    assert.throws(() => artwork.setCostumeDocument(reopened.costume,
        {...source, animation: {...source.animation, frames: [source.animation.frames[0]]}}),
    /invalid artwork animation/);
    assert.throws(() => artwork.setCostumeDocument(reopened.costume,
        {...source, animation: {...source.animation, frames: [source.animation.frames[0],
            {...source.animation.frames[1], layers: first}]}}), /active frame differs/);
});

test('stale source is ignored if another editor changed the Scratch asset', async () => {
    const {vm, costume, blob} = await fixture();
    const saved = await artwork.attachArtwork(blob, vm);
    const zip = await JSZip.loadAsync(await saved.arrayBuffer());
    const project = JSON.parse(await zip.file('project.json').async('text'));
    project.targets[0].costumes[0].md5ext = 'changed.svg';
    zip.file('project.json', JSON.stringify(project));
    zip.file('changed.svg', '<svg/>');
    const changed = await zip.generateAsync({type: 'blob'});
    const inspected = await artwork.inspectArtwork(await changed.arrayBuffer());
    assert.equal(inspected.outcome, 'loaded');
    assert.equal(inspected.records.length, 0);
    costume.md5ext = 'changed.svg';
    assert.equal(artwork.applyArtwork(inspected, vm).count, 0);
    assert.equal(artwork.getCostumeDocument(costume).layers[0].content.value, 'changed.svg');
});

test('an edited costume uses the new asset ID even when VM leaves md5ext stale', async () => {
    const {vm, costume, blob} = await fixture();
    const newId = 'a0000000000000000000000000000000.svg';
    costume.asset = {assetId: newId.slice(0, -4)};
    const source = {version: 1, layers: [{id: 'base', type: 'vector', name: 'New',
        visible: true, locked: false, opacity: 1,
        content: {kind: 'svg', value: '<svg><circle r="1"/></svg>'}}]};
    artwork.setCostumeDocument(costume, source);
    const rendered = await JSZip.loadAsync(await blob.arrayBuffer());
    const project = JSON.parse(await rendered.file('project.json').async('text'));
    project.targets[0].costumes[0].md5ext = newId;
    rendered.file('project.json', JSON.stringify(project));
    rendered.file(newId, '<svg><circle r="1"/></svg>');
    const saved = await artwork.attachArtwork(await rendered.generateAsync({type: 'blob'}), vm);
    const zip = await JSZip.loadAsync(await saved.arrayBuffer());
    const record = JSON.parse(await zip.file(artwork.ARTWORK_PATH).async('text')).costumes[0];
    assert.equal(record.renderedMd5ext, newId);
    assert.deepEqual(record.document, source);
});

test('a future artwork source survives an unchanged Scratch rendering', async () => {
    const {vm, blob} = await fixture();
    const future = JSON.stringify({format: artwork.ARTWORK_FORMAT, version: artwork.ARTWORK_VERSION + 1,
        costumes: [], futureField: {keep: true}});
    const inputZip = await JSZip.loadAsync(await blob.arrayBuffer());
    inputZip.file(artwork.ARTWORK_PATH, future);
    const input = await inputZip.generateAsync({type: 'blob'});
    const inspected = await artwork.inspectArtwork(await input.arrayBuffer());
    assert.equal(inspected.outcome, 'future');
    artwork.applyArtwork(inspected, vm);
    const saved = await artwork.attachArtwork(blob, vm);
    const savedZip = await JSZip.loadAsync(await saved.arrayBuffer());
    assert.equal(await savedZip.file(artwork.ARTWORK_PATH).async('text'), future);
    artwork.applyArtwork({outcome: 'legacy'}, vm);
});

test('a malformed artwork source does not replace the usable Scratch rendering', async () => {
    const {vm, costume, blob} = await fixture();
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    zip.file(artwork.ARTWORK_PATH, '{broken json');
    const damaged = await zip.generateAsync({type: 'blob'});
    const inspected = await artwork.inspectArtwork(await damaged.arrayBuffer());
    assert.equal(inspected.outcome, 'invalid');
    artwork.applyArtwork(inspected, vm);
    assert.equal(artwork.getCostumeDocument(costume).layers[0].content.kind, 'asset');
    const output = await artwork.attachArtwork(damaged, vm);
    const saved = await JSZip.loadAsync(await output.arrayBuffer());
    assert.equal(await saved.file(costume.md5ext).async('text'),
        await zip.file(costume.md5ext).async('text'));
});

test('one ZIP pass carries both Brickwright state and artwork source', async () => {
    const {vm, blob, svg, id} = await fixture();
    const code = JSON.stringify({lang: 'pseudocode', code: 'say hello'});
    global.localStorage = {length: 1, key: () => 'bw-code-autosave', getItem: key => key === 'bw-code-autosave' ? code : null};
    try {
        const saved = await projectBundle.attachBrickwrightState(blob, {
            mutateZip: zip => artwork.writeArtworkToZip(zip, vm)
        });
        const zip = await JSZip.loadAsync(await saved.arrayBuffer());
        assert.ok(zip.file(projectBundle.BUNDLE_PATH));
        assert.ok(zip.file(artwork.ARTWORK_PATH));
        assert.equal(await zip.file(id).async('text'), svg);
    } finally {
        delete global.localStorage;
    }
});

test('duplicating a costume retains an independent editable source', async () => {
    const {costume} = await fixture();
    const document = {version: 1, pixelScale: 4, layers: [{id: 'pixels', type: 'pixel',
        name: 'Pixels', visible: true, locked: false, opacity: 1,
        content: {kind: 'pixels', value: {width: 1, height: 1, pixels: [10]}}}]};
    artwork.setCostumeDocument(costume, document);
    const duplicate = {...costume};
    artwork.copyCostumeDocument(costume, duplicate);
    assert.deepEqual(artwork.getCostumeDocument(duplicate), document);
    assert.notStrictEqual(artwork.getCostumeDocument(duplicate), document);
    artwork.resetCostumeDocument(costume);
    assert.deepEqual(artwork.getCostumeDocument(duplicate), document);
});

test('artwork links follow the costume through edits and save/reopen without transferring to a duplicate', async () => {
    const {vm, costume, project, svg, id} = await fixture();
    vm.runtime.targets[0].sprite.name = 'Stage';
    const sourceId = artwork.newAnimationResourceId();
    artwork.setCostumeSourceId(costume, sourceId);
    costume.name = 'Renamed';
    const other = {...costume, name: 'Duplicate'};
    artwork.copyCostumeDocument(costume, other, vm);
    artwork.resetCostumeDocument(costume, vm);
    vm.runtime.targets[0].sprite.costumes = [other,costume];
    project.targets[0].costumes = [{...other},{...costume}];
    const zip = new JSZip();
    zip.file(id,svg);
    zip.file('project.json',JSON.stringify(project));
    await artwork.writeArtworkToZip(zip,vm);
    const payload = JSON.parse(await zip.file(artwork.ARTWORK_PATH).async('text'));
    assert.equal(payload.version,9);
    assert.deepEqual(payload.costumes.map(record => record.sourceId),[undefined,sourceId]);
    const saved = await zip.generateAsync({type:'uint8array'});
    const inspection = await artwork.inspectArtwork(saved);
    const reopened = {runtime:{targets:[{isOriginal:true,sprite:{name:'Stage',costumes:[{...other},{...costume}]}}]}};
    artwork.applyArtwork(inspection,reopened);
    const [copy, original] = reopened.runtime.targets[0].sprite.costumes;
    assert.equal(artwork.getCostumeSourceId(copy),undefined);
    assert.equal(artwork.getCostumeSourceId(original),sourceId);

    payload.costumes[0].sourceId = sourceId;
    zip.file(artwork.ARTWORK_PATH,JSON.stringify(payload));
    const ambiguous = await artwork.inspectArtwork(await zip.generateAsync({type:'uint8array'}));
    assert.equal(ambiguous.outcome,'loaded');
    assert.ok(ambiguous.records.every(record => record.sourceId === undefined));
});
