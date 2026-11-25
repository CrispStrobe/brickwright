#!/usr/bin/env node
import {BRICKWRIGHT_REPOSITORY_ID, BRICKWRIGHT_PREVIOUS_SLUG, BRICKWRIGHT_SLUG} from './lib/brickwright-repository.mjs';

const legacyRepositoryId = 881088189;
const pages = 'https://crispstrobe.github.io';
const after = process.argv[2] === '--after-cutover';
if (process.argv.length > (after ? 3 : 2)) throw new Error('Usage: check-brickwright-rename-readiness.mjs [--after-cutover]');
const primarySlug = after ? BRICKWRIGHT_SLUG : BRICKWRIGHT_PREVIOUS_SLUG;
const primaryBase = `${pages}/${primarySlug.split('/')[1]}`;
const expectedLegacySlug = after ? `${BRICKWRIGHT_SLUG}-legacy` : BRICKWRIGHT_SLUG;
const legacyBase = `${pages}/${expectedLegacySlug.split('/')[1]}`;

const checks = [];
function check(label, url, predicate, json = false) {
    checks.push((async () => {
        try {
            const response = await fetch(url, {signal: AbortSignal.timeout(12000)});
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const value = json ? await response.json() : await response.text();
            if (!predicate(value)) throw new Error('response did not identify the intended editor or repository');
            return {label, url, status: 'ok'};
        } catch (error) {
            return {label, url, status: 'blocked', error: error.message};
        }
    })());
}
check('Primary GitHub repository', `https://api.github.com/repositories/${BRICKWRIGHT_REPOSITORY_ID}`,
    value => value.id === BRICKWRIGHT_REPOSITORY_ID && value.full_name === primarySlug && value.default_branch === 'main', true);
check('Legacy GitHub repository', `https://api.github.com/repositories/${legacyRepositoryId}`,
    value => value.id === legacyRepositoryId && value.full_name === expectedLegacySlug && value.default_branch === 'develop', true);
check('Account Pages fallback', `${pages}/brickwright-migration-check/status.json`,
    value => value.activeRepositoryId === BRICKWRIGHT_REPOSITORY_ID && value.legacyRepositoryId === legacyRepositoryId, true);
check('Primary Pages identity marker', `${primaryBase}/brickwright-pages.json`,
    value => value.repositoryId === BRICKWRIGHT_REPOSITORY_ID && value.repository === primarySlug, true);
check('Primary Vercel editor version', 'https://brickwright.vercel.app/brickwright-version.json',
    value => /^[0-9a-f]{40}$/.test(value.commit), true);
check('Legacy Vercel editor', 'https://brickwright-legacy.vercel.app/editor.html', value => value.includes('js/pentapod/'));
for (const page of ['editor.html', 'player.html', 'embed.html', 'fullscreen.html']) {
    check(`Legacy bookmark bridge ${page}`, `${primaryBase}/${page}`, value => value.includes(`/brickwright-legacy/${page}`));
}
check('Legacy Pages editor', `${legacyBase}/editor.html`, value => value.includes('js/pentapod/'));
if (after) {
    check('Previous primary Pages entry', `${pages}/brickwright-lite/`, value => value.includes('/brickwright-migration-check/active.js'));
} else {
    check('Future Legacy Pages fallback', `${pages}/brickwright-legacy/editor.html`,
        value => value.includes('https://brickwright-legacy.vercel.app/editor.html'));
}

const results = await Promise.all(checks);
console.log(JSON.stringify({phase: after ? 'after-cutover' : 'before-cutover', results}, null, 2));
if (results.some(result => result.status !== 'ok')) process.exitCode = 1;
