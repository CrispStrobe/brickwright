import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const {parse} = createRequire(import.meta.url)('acorn');

const readScript = name => {
    const source = readFileSync(new URL(`../scripts/${name}`, import.meta.url), 'utf8');
    return {source, ast: parse(source, {ecmaVersion: 'latest', sourceType: 'module'})};
};
const nodes = function* (value) {
    if (!value || typeof value !== 'object') return;
    if (value.type) yield value;
    for (const child of Object.values(value)) {
        if (Array.isArray(child)) for (const item of child) yield* nodes(item);
        else if (child && typeof child === 'object') yield* nodes(child);
    }
};

// Execute the production request observer, with only its collections supplied.
// This proves the inventory's URL handling without booting an editor or browser.
function observe (name, urls) {
    const {source, ast} = readScript(name);
    const observers = [...nodes(ast)].filter(node => node.type === 'CallExpression' &&
        node.callee?.object?.name === 'page' && node.callee?.property?.name === 'on' &&
        node.arguments[0]?.value === 'request');
    assert.equal(observers.length, 1, `${name} must expose one real request observer`);
    const callback = observers[0].arguments[1];
    const images = new Set(), indexes = [], circuitCatalogRequests = [], models = [];
    const receive = new Function('images', 'indexes', 'circuitCatalogRequests', 'models',
        `return (${source.slice(callback.start, callback.end)});`)(images, indexes, circuitCatalogRequests, models);
    for (const url of urls) receive({url: () => url});
    return {images, indexes, circuitCatalogRequests, models};
}

test('gallery request inventory preserves origin and full directory identity', () => {
    const base = 'https://editor.invalid/brickwright/';
    const hash = 'a'.repeat(64);
    const normal = new URL(`static/thumbnails/gallery-artwork/robots.${hash}.json`, base).href;
    const misplaced = normal.replace('/brickwright/', '/obsolete/');
    const foreign = normal.replace('editor.invalid', 'foreign.invalid');
    const catalog = new URL('examples/index.json', base).href;
    const wrongCatalog = catalog.replace('/brickwright/', '/obsolete/');
    const result = observe('verify-gallery-artwork-browser.mjs', [normal, misplaced, foreign, catalog, wrongCatalog]);
    assert.deepEqual(result.indexes, [normal, misplaced, foreign]);
    assert.deepEqual(result.circuitCatalogRequests, [catalog, wrongCatalog]);

    const {source, ast} = readScript('verify-gallery-artwork-browser.mjs');
    const declaration = ast.body.flatMap(node => node.declarations || []).find(node => node.id.name === 'expectIndex');
    assert.ok(declaration, 'the same inventory verdict used by the browser gate must exist');
    const verdict = new Function('assert', 'base', `return (${source.slice(declaration.init.start, declaration.init.end)});`)(assert, base);
    verdict(normal, 'robots');
    for (const wrong of [misplaced, foreign, normal.replace(hash, 'bad-hash')]) {
        assert.throws(() => verdict(wrong, 'robots'), assert.AssertionError,
            'a matching basename cannot substitute another origin, directory or content hash');
    }
});

test('Robot Lab model requests cannot substitute the same basename from another route', () => {
    const normal = 'https://editor.invalid/brickwright/static/sim-lab/models/driving-base.ldr';
    const wrongRoute = normal.replace('/brickwright/', '/obsolete/');
    const wrongOrigin = normal.replace('editor.invalid', 'foreign.invalid');
    const result = observe('verify-robot-lab-startup-downloads.mjs', [normal, wrongRoute, wrongOrigin]);
    assert.deepEqual(result.models, [normal, wrongRoute, wrongOrigin]);
    assert.notDeepEqual(result.models, [normal], 'extra requests must remain visible to the gate');
    assert.notEqual(result.models[1], normal);
    assert.notEqual(result.models[2], normal);
});
