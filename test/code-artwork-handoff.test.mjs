import test from 'node:test';
import assert from 'node:assert/strict';
import {captureCodeArtwork, codeArtworkMatches, retainCodeArtwork,
    captureCodeArtworkRevision, codeArtworkRevisionMatches} from '../overlay/scratch-gui/src/lib/bw-code-artwork.js';
import {ARTWORK_PATH, setCostumeDocument, applyArtwork, getCostumeDocument} from '../overlay/scratch-gui/src/lib/bw-artwork-bundle.js';

const clone = value => JSON.parse(JSON.stringify(value));
const costume = (id, name, format = 'svg') => ({assetId: id, md5ext: `${id}.${format}`, dataFormat: format,
    name, bitmapResolution: format === 'png' ? 2 : 1, rotationCenterX: 3.25, rotationCenterY: -2,
    asset: {assetId: id, dataFormat: format, data: new Uint8Array([3, 9, 1, 4])}});
const setup = () => {
    const stage = {isStage: true, isOriginal: true, currentCostume: 1,
        sprite: {costumes: [costume('background', 'Backdrop'), costume('night', 'Night', 'png')]}};
    const actor = {isStage: false, isOriginal: true, name: 'Actor', currentCostume: 1,
        sprite: {costumes: [costume('actor', 'painted'), costume('walk', 'Walk', 'png')]}};
    const vm = {runtime: {targets: [stage, actor]}};
    const declarations = {targets: [{isStage: true, name: 'Stage', currentCostume: 0,
        costumes: [{name: 'backdrop1'}, {name: 'Night'}]}, {isStage: false, name: 'Actor', currentCostume: 0,
        costumes: [{name: 'costume1'}, {name: 'Walk'}]}]};
    const files = new Map(); const zip = {file: (key, value) => {files.set(key, value);}};
    return {stage, actor, vm, declarations, zip, files, context: captureCodeArtwork(vm, declarations)};
};
const animatedDocument = () => {
    const layers = [{id: 'pixels', type: 'pixel', name: 'Pixels', visible: true, locked: false,
        opacity: 1, content: {kind: 'pixels', value: {width: 1, height: 1, pixels: [2]}}}];
    return {version: 3, pixelScale: 8,
        palette: [null, ...Array.from({length: 15}, (_, i) => `#${(i + 1).toString(16).padStart(6, '0')}`)],
        activeLayerId: 'pixels', layers, animation: {activeFrameId: 'one', frames: [
            {id: 'one', name: 'Start', durationMs: 123, activeLayerId: 'pixels', layers: clone(layers)},
            {id: 'two', name: 'End', durationMs: 456, activeLayerId: 'pixels', layers: clone(layers)}]}};
};

test('Code handoff reads fresh exact PNG/SVG assets, centers, names, current costume and animation source', () => {
    const s = setup();
    // Edit after From blocks. The handoff must read this current asset, not its old SVG upload.
    s.actor.sprite.costumes[0].asset.data = new Uint8Array([8, 6, 7, 5, 3, 0, 9]);
    const document = animatedDocument();
    setCostumeDocument(s.actor.sprite.costumes[0], document);
    const project = clone(s.declarations);
    assert.equal(retainCodeArtwork(s.zip, project, s.vm, s.context), true);
    assert.deepEqual(s.files.get('actor.svg'), new Uint8Array([8, 6, 7, 5, 3, 0, 9]));
    assert.deepEqual(s.files.get('night.png'), s.stage.sprite.costumes[1].asset.data);
    assert.equal(project.targets[1].costumes[0].name, 'painted');
    assert.equal(project.targets[1].costumes[0].rotationCenterX, 3.25);
    assert.equal(project.targets[1].costumes[0].rotationCenterY, -2);
    assert.equal(project.targets[0].costumes[1].bitmapResolution, 2);
    assert.equal(project.targets[1].currentCostume, 1);
    assert.equal(project.targets[0].currentCostume, 1);
    const saved = JSON.parse(s.files.get(ARTWORK_PATH));
    const record = saved.costumes.find(row => row.targetIndex === 1 && row.costumeIndex === 0);
    assert.deepEqual(record.document, document);
    // Existing artwork load boundary restores the full source onto new VM costumes.
    const next = {runtime: {targets: project.targets.map(target => ({...target,
        sprite: {costumes: target.costumes.map(c => ({...c}))}}))}};
    assert.equal(applyArtwork({outcome: 'loaded', records: saved.costumes}, next).count, 4);
    assert.deepEqual(getCostumeDocument(next.runtime.targets[1].sprite.costumes[0]), document);
});

test('changed SHAPE/COSTUME and deleted BACKDROP declarations use generated artwork', () => {
    const s = setup(); const project = clone(s.declarations);
    project.targets[1].costumes[0]._shapeSpec = 'square 20 #ff0000';
    project.targets[1].costumes[1] = {name: 'Jump', _spec: 'Jump circle 10'};
    project.targets[0].costumes = project.targets[0].costumes.slice(0, 1);
    retainCodeArtwork(s.zip, project, s.vm, s.context);
    assert.deepEqual(project.targets[1].costumes, [{name: 'costume1', _shapeSpec: 'square 20 #ff0000'},
        {name: 'Jump', _spec: 'Jump circle 10'}]);
    assert.equal(project.targets[0].costumes.length, 1);
    assert.equal(s.files.has('walk.png'), false);
    assert.equal(s.files.has('night.png'), false);
});

test('costume reordering preserves declaration identity rather than taking the old array slot', () => {
    const s = setup(); const base = s.actor.sprite.costumes[0];
    s.actor.sprite.costumes.reverse();
    const project = clone(s.declarations);
    retainCodeArtwork(s.zip, project, s.vm, s.context);
    assert.equal(project.targets[1].costumes[0].assetId, base.assetId);
    assert.equal(project.targets[1].costumes[1].assetId, 'walk');
});

test('external project replacement never inherits the previous project artwork', () => {
    const s = setup(); s.vm.runtime.targets = s.vm.runtime.targets.map(target => ({...target}));
    assert.equal(codeArtworkMatches(s.vm, s.context), false);
    assert.equal(retainCodeArtwork(s.zip, clone(s.declarations), s.vm, s.context), false);
    assert.equal(s.files.size, 0);
});

test('missing live assets fail before a generated project can replace the loaded project', () => {
    const s = setup(); delete s.actor.sprite.costumes[0].asset;
    assert.throws(() => retainCodeArtwork(s.zip, clone(s.declarations), s.vm, s.context), /asset unavailable/);
});

test('explicit new SVG upload overrides the retained first costume', () => {
    const s = setup(); const project = clone(s.declarations);
    retainCodeArtwork(s.zip, project, s.vm, s.context, [{sprite: 'Actor', mode: 'replace'}]);
    assert.deepEqual(project.targets[1].costumes[0], {name: 'costume1'});
    assert.equal(project.targets[1].costumes[1].assetId, 'walk');
});

// Execute the real source-file method: rejected/unreadable inputs must keep
// the old Code-to-graphics handoff, because they have not replaced its source.
import {readFileSync} from 'node:fs';
import {scopeAfter} from './helpers/js-scope.mjs';
import {codeDocumentEditorClass} from './helpers/code-document-editor.mjs';
const importer = readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx', import.meta.url), 'utf8');
const openBody = scopeAfter(importer, 'openCodeFile (e) {');
const openSetup = () => {
    let reader;
    class Reader {constructor () {reader = this;} readAsText () {}}
    const retained = {original: true};
    const Editor = codeDocumentEditorClass(importer, `openCodeFile (e) ${openBody}`,
        {FileReader: Reader, isImportableArtefact: name => name.endsWith('.hex')});
    const component = Object.assign(new Editor(), {_codeArtwork: retained, state: {lang: 'pseudocode', uploads: [{svg: 'pending'}],
        buffers: {pseudocode: 'old program'}}, publishGameControls () {}, openArtefactFile () {},
        langForFile: name => name.endsWith('.bw') ? 'pseudocode' : null,
        L: {openBad: name => `Bad ${name}`, openDone: name => `Opened ${name}`, stError: message => message},
        setState (patch) {Object.assign(this.state, typeof patch === 'function' ? patch(this.state) : patch);}});
    const open = name => component.openCodeFile({target: {files: [{name}], value: name}});
    return {component, retained, open, reader: () => reader};
};
for (const name of ['unsupported.foo', 'corrupt.hex']) {
    test(`rejected ${name} retains the prior artwork handoff and pending uploads`, () => {
        const s = openSetup(); s.open(name);
        assert.equal(s.component._codeArtwork, s.retained);
        assert.deepEqual(s.component.state.uploads, [{svg: 'pending'}]);
        assert.equal(s.component.state.buffers.pseudocode, 'old program');
    });
}
test('a failed source read retains artwork; a completed source read clears it atomically', () => {
    const s = openSetup(); s.open('new.bw');
    assert.equal(s.component._codeArtwork, s.retained, 'opening the picker is not a successful read');
    s.reader().onerror();
    assert.equal(s.component._codeArtwork, s.retained);
    assert.deepEqual(s.component.state.uploads, [{svg: 'pending'}]);
    s.reader().result = 'new program'; s.reader().onload();
    assert.equal(s.component._codeArtwork, null);
    assert.deepEqual(s.component.state.uploads, []);
    assert.equal(s.component.state.buffers.pseudocode, 'new program');
});


test('a freshly edited Asset is authoritative even while VM descriptor hashes are stale', () => {
    const s = setup(); const current = s.actor.sprite.costumes[0];
    current.asset = {assetId: 'new-render', dataFormat: 'svg', data: new Uint8Array([8, 8, 9])};
    setCostumeDocument(current, animatedDocument());
    const project = clone(s.declarations);
    retainCodeArtwork(s.zip, project, s.vm, s.context);
    assert.equal(current.md5ext, 'actor.svg', 'fixture reproduces stale descriptor');
    assert.equal(project.targets[1].costumes[0].md5ext, 'new-render.svg');
    assert.equal(project.targets[1].costumes[0].assetId, 'new-render');
    assert.deepEqual(s.files.get('new-render.svg'), new Uint8Array([8, 8, 9]));
    const records = JSON.parse(s.files.get(ARTWORK_PATH)).costumes;
    assert.equal(records.find(row => row.targetIndex === 1 && row.costumeIndex === 0).renderedMd5ext, 'new-render.svg');
});


for (const edit of ['asset', 'bytes', 'document', 'center']) {
    test(`a concurrent ${edit} edit invalidates the pre-load artwork revision`, () => {
        const s = setup(); const revision = captureCodeArtworkRevision(s.vm, s.context);
        assert.equal(codeArtworkRevisionMatches(s.vm, revision), true);
        const costume = s.actor.sprite.costumes[0];
        if (edit === 'asset') costume.asset = {...costume.asset, assetId: 'edited'};
        if (edit === 'bytes') costume.asset.data[0] = 99;
        if (edit === 'document') setCostumeDocument(costume, animatedDocument());
        if (edit === 'center') costume.rotationCenterX = 22;
        assert.equal(codeArtworkMatches(s.vm, s.context), true, 'target identity alone misses this edit');
        assert.equal(codeArtworkRevisionMatches(s.vm, revision), false);
    });
}


test('a live GUI sprite rename keeps the captured source slot bound to its actual target', () => {
    const s = setup(); s.actor.name = 'Renamed in GUI';
    const project = clone(s.declarations);
    retainCodeArtwork(s.zip, project, s.vm, s.context);
    assert.equal(project.targets[1].costumes[0].assetId, 'actor');
    assert.equal(project.targets[1].costumes[1].assetId, 'walk');
});


const bundleBody = scopeAfter(importer, 'this._onBundleLoaded = event => {');
for (const outcome of ['legacy', 'loaded', 'future', 'invalid', 'storage-failed']) {
    test(`external bundle outcome ${outcome} resets artwork only when the project was accepted`, () => {
        const context = {};
        const Editor = codeDocumentEditorClass(importer, `handleBundle (event) ${bundleBody}`);
        const component = Object.assign(new Editor(), {_codeArtwork: context, props: {}, state: {uploads: [{svg: 'pending'}]},
            readAutosave: () => null, publishGameControls () {},
            setState (patch) {Object.assign(this.state, patch);}});
        component.handleBundle({detail: {outcome}});
        const accepted = outcome === 'legacy' || outcome === 'loaded';
        assert.equal(component._codeArtwork, accepted ? null : context);
        assert.deepEqual(component.state.uploads, accepted ? [] : [{svg: 'pending'}]);
    });
}

test('Code handoff marks full-screen editable artwork as future-safe bundle4', () => {
    const s = setup(), document = animatedDocument();
    for (const layers of [document.layers, ...document.animation.frames.map(frame => frame.layers)]) {
        layers[0].content.value = {width:160,height:120,pixels:Array(19200).fill(2)};
    }
    setCostumeDocument(s.stage.sprite.costumes[1], document);
    assert.equal(retainCodeArtwork(s.zip, clone(s.declarations), s.vm, s.context), true);
    const saved = JSON.parse(s.files.get(ARTWORK_PATH));
    assert.equal(saved.version, 4);
    assert.equal(saved.costumes.find(record => record.targetIndex === 0 && record.costumeIndex === 1).document.version, 3);
});


test('applied append uploads become live attachments without replaying SVGs or duplicating costumes', () => {
    const s = setup();
    const source = clone(s.declarations);
    s.actor.sprite.costumes.push(costume('imported', 'Imported'));
    s.declarations.targets[1].costumes.push({name: 'Imported'});
    const context = captureCodeArtwork(s.vm, s.declarations, source);
    const fresh = costume('edited', 'Imported');
    Object.assign(s.actor.sprite.costumes[2], fresh);
    const project = clone(source);
    retainCodeArtwork(s.zip, project, s.vm, context);
    assert.equal(project.targets[1].costumes.length, 3);
    assert.equal(project.targets[1].costumes[2].assetId, 'edited');
    const nextContext = captureCodeArtwork(s.vm, project, source);
    const again = clone(source);
    retainCodeArtwork(s.zip, again, s.vm, nextContext);
    assert.equal(again.targets[1].costumes.length, 3);
    assert.equal(again.targets[1].costumes[2].assetId, 'edited');
    const withNewUpload = clone(source);
    withNewUpload.targets[1].costumes.push({name: 'New upload'});
    retainCodeArtwork(s.zip, withNewUpload, s.vm, context, [{sprite: 'Actor', mode: 'add'}]);
    assert.deepEqual(withNewUpload.targets[1].costumes.map(c => c.name), ['painted', 'Walk', 'Imported', 'New upload']);
    const replaced = clone(source);
    replaced.targets[1].name = 'Other';
    retainCodeArtwork(s.zip, replaced, s.vm, context);
    assert.equal(replaced.targets[1].costumes.length, 2, 'fresh target does not inherit imported attachments');
});
