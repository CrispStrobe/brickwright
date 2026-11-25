#!/usr/bin/env node
import assert from 'node:assert/strict';
import {access, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {assertBrickwrightRepository, BRICKWRIGHT_REPOSITORY_ID} from './lib/brickwright-repository.mjs';

const legacyPages = ['editor.html', 'player.html', 'embed.html', 'fullscreen.html'];

function legacyRedirect(page) {
    const destination = `/brickwright-legacy/${page}`;
    return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Open Brickwright Legacy</title>
<p><a id="editor" href="${destination}">Open Brickwright Legacy</a></p>
<p><a id="fallback" href="https://brickwright-legacy.vercel.app/${page}">Open the Legacy Vercel editor</a></p>
<script>
const suffix = location.search + location.hash;
document.querySelector('#fallback').href += suffix;
location.replace(document.querySelector('#editor').href + suffix);
</script>
</html>
`;
}

export async function stageCompatibility(site, {repository, repositoryId}) {
    assertBrickwrightRepository(repository, Number(repositoryId));
    await access(resolve(site, 'index.html'));
    const outputs = new Map(legacyPages.map(page => [page, legacyRedirect(page)]));
    // Publish the marker after all legacy entry points were created.
    for (const [name, content] of outputs) await writeFile(resolve(site, name), content, {flag: 'wx'});
    const marker = {schema: 1, repositoryId: BRICKWRIGHT_REPOSITORY_ID, repository};
    await writeFile(resolve(site, 'brickwright-pages.json'), `${JSON.stringify(marker)}\n`, {flag: 'wx'});
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    assert.equal(process.argv.length, 3, 'Pass the built Pages directory');
    await stageCompatibility(process.argv[2], {repository: process.env.GITHUB_REPOSITORY,
        repositoryId: process.env.GITHUB_REPOSITORY_ID});
}
