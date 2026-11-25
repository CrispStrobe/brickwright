import assert from 'node:assert/strict';
import {mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';
import {stageCompatibility} from '../scripts/stage-brickwright-pages-compatibility.mjs';
import {assertBrickwrightRepository, BRICKWRIGHT_REPOSITORY_ID} from '../scripts/lib/brickwright-repository.mjs';

const primary = 'CrispStrobe/brickwright';
const prior = `${primary}-lite`;
const legacyId = 881088189;

async function withBuild(t, callback) {
    const site = await mkdtemp(join(tmpdir(), 'brickwright-pages-'));
    t.after(() => rm(site, {recursive: true, force: true}));
    await writeFile(join(site, 'index.html'), 'existing application');
    return callback(site);
}

test('the renamed slug accepts only the primary repository identity', () => {
    assert.doesNotThrow(() => assertBrickwrightRepository(prior));
    assert.doesNotThrow(() => assertBrickwrightRepository(primary, BRICKWRIGHT_REPOSITORY_ID));
    assert.throws(() => assertBrickwrightRepository(primary, legacyId), /repository ID/);
    assert.throws(() => assertBrickwrightRepository(primary), /repository ID/);
});

test('the Pages artifact preserves legacy URLs, query, fragment and same-origin storage', async t => withBuild(t, async site => {
    await stageCompatibility(site, {repository: primary, repositoryId: BRICKWRIGHT_REPOSITORY_ID});
    const owner = JSON.parse(await readFile(join(site, 'brickwright-pages.json'), 'utf8'));
    assert.deepEqual(owner, {schema: 1, repositoryId: BRICKWRIGHT_REPOSITORY_ID, repository: primary});
    assert.equal(await readFile(join(site, 'index.html'), 'utf8'), 'existing application');
    for (const entry of ['editor.html', 'player.html', 'embed.html', 'fullscreen.html']) {
        const html = await readFile(join(site, entry), 'utf8');
        const href = id => html.match(new RegExp(`id="${id}" href="([^"]+)"`))[1];
        const origin = 'https://crispstrobe.github.io';
        const anchors = Object.fromEntries(['editor','fallback'].map(id => [id, {href: new URL(href(id), origin).href}]));
        const destinations = [];
        runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], {
            document: {querySelector: selector => anchors[selector.slice(1)]},
            location: {search: '?sample=test', hash: '#project', replace: url => destinations.push(url)}
        });
        assert.deepEqual(destinations, [`${origin}/brickwright-legacy/${entry}?sample=test#project`]);
        assert.equal(anchors.fallback.href, `https://brickwright-legacy.vercel.app/${entry}?sample=test#project`);
    }
}));

test('a legacy repository or an existing editor file cannot be overwritten', async t => withBuild(t, async site => {
    await assert.rejects(stageCompatibility(site, {repository: primary, repositoryId: legacyId}), /repository ID/);
    assert.deepEqual(await readdir(site), ['index.html']);
    await writeFile(join(site, 'editor.html'), 'existing editor');
    await assert.rejects(stageCompatibility(site, {repository: prior, repositoryId: BRICKWRIGHT_REPOSITORY_ID}), /EEXIST/);
    assert.equal(await readFile(join(site, 'editor.html'), 'utf8'), 'existing editor');
}));
