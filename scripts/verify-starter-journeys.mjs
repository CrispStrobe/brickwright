/** Browser gate for the first-run chooser and its three real project paths. */
import {mkdir, readFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {chromium} from 'playwright';

const url = process.env.PROOF_URL || 'http://127.0.0.1:8765/';
const artifacts = resolve('artifacts/starter-journeys');
await mkdir(artifacts, {recursive: true});
const browser = await chromium.launch({headless: true});
const pageErrors = [];

const check = (value, message) => {
    if (!value) throw new Error(message);
    console.log(`  ok: ${message}`);
};

try {
    let context = await browser.newContext();
    let page = await context.newPage();
    page.on('pageerror', error => pageErrors.push(`chooser: ${error.message}`));
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    const dialog = page.getByTestId('bw-starter-dialog');
    await dialog.waitFor({timeout: 30000});
    check(await dialog.getAttribute('role') === 'dialog', 'first run opens an accessible dialog');
    // The cards are starter-journeys.json's, less those whose surface the build lacks
    // (availableJourneys: the CAD card needs a CAD build). 68ec0be7c added game, technic
    // and cad-robot to the original three; a CAD build (BW_ENABLE_CAD=1) shows all six.
    const journeys = JSON.parse(await readFile(
        resolve('overlay/scratch-gui/src/components/gui/starter-journeys.json'), 'utf8'));
    const shown = await page.locator('[data-starter-id]').evaluateAll(cards =>
        cards.map(card => card.getAttribute('data-starter-id')));
    const offered = journeys.filter(journey => journey.requires !== 'cad').map(journey => journey.id);
    const offeredWithCad = journeys.map(journey => journey.id);
    check(JSON.stringify(shown) === JSON.stringify(offered) || JSON.stringify(shown) === JSON.stringify(offeredWithCad),
        `the journeys this build offers are shown (${shown.join(', ')})`);

    await page.getByRole('button', {name: 'Not now'}).click();
    await page.reload({waitUntil: 'domcontentloaded'});
    await dialog.waitFor({state: 'detached'});
    check(await dialog.count() === 0, 'dismissal survives reload');
    await page.getByText('Settings', {exact: true}).click();
    await page.getByText('Getting started…', {exact: true}).click();
    await dialog.waitFor();
    check(true, 'Settings reopens the chooser');
    await page.getByRole('button', {name: 'Not now'}).click();
    await page.getByText('Settings', {exact: true}).click();
    await page.getByText('Lessons…', {exact: true}).click();
    await page.getByTestId('bw-lessons-library').waitFor();
    check(await page.locator('[data-lesson-id]').count() >= 29,
        'Settings opens the broad lessons catalog');
    const lessonSearch = page.getByRole('searchbox', {name: 'Search lessons'});
    await lessonSearch.fill('motor flyback');
    const motorLesson = page.locator('[data-lesson-id="electricity-motor-flyback"]');
    await motorLesson.waitFor();
    check(await motorLesson.isVisible(),
        'lesson search finds a Wave 1 topic');
    check(await page.locator('[data-lesson-id]').count() === 1,
        'lesson search filters the larger catalog');
    await page.screenshot({path: join(artifacts, 'catalog-motor-flyback.png')});
    await lessonSearch.fill('');
    await page.getByRole('combobox', {name: 'All levels'}).selectOption('discover');
    check(await page.locator('[data-lesson-id="electricity-polarity"]').isVisible(),
        'level filtering keeps discover lessons visible');
    await page.getByRole('combobox', {name: 'All levels'}).selectOption('');
    page.on('dialog', prompt => prompt.accept());
    await page.locator('[data-lesson-id="instrument-voltage-divider"]').click();
    await page.getByRole('button', {name: 'Open lesson project'}).click();
    await page.getByText('Project opened', {exact: true}).waitFor({timeout: 45000});
    check(true, 'a catalog lesson opens its matching live example');
    await context.close();

    for (const id of ['circuit', 'board', 'lego']) {
        context = await browser.newContext();
        page = await context.newPage();
        page.on('pageerror', error => pageErrors.push(`${id}: ${error.message}`));
        page.on('dialog', prompt => prompt.accept());
        await page.goto(`${url}${url.includes('?') ? '&' : '?'}journey=${id}`, {
            waitUntil: 'domcontentloaded'
        });
        await page.getByTestId('bw-starter-dialog').waitFor({timeout: 30000});
        await page.locator(`[data-starter-id="${id}"]`).click();
        await page.getByTestId('bw-starter-dialog').waitFor({
            state: 'detached',
            timeout: 45000
        });
        await page.getByTestId('bw-guided-lesson').waitFor({timeout: 10000});
        check(true, `${id} continues into a guided lesson`);
        if (id === 'circuit') {
            check((await page.getByTestId('bw-lesson-complete').innerText()).includes('Observed'),
                'starter-loaded checkpoint completes automatically');
            await page.getByTestId('bw-lesson-next').click();
            await page.getByTestId('bw-lesson-complete').click();
            const saved = await page.evaluate(() => JSON.parse(
                localStorage.getItem('bw-lesson-progress:starter-circuit-path:v1')));
            check(saved.completed.inspect.method === 'manual', 'manual fallback persists by lesson version');
        }
        if (id === 'board') {
            await page.getByRole('button', {name: 'python', exact: true}).click();
            check(await page.getByText(/Python syntax alone/).isVisible(),
                'a learner can switch to language-specific guidance');
        }
        // The editor tab switch is its own React commit, after the dialog has
        // closed and the lesson has mounted: reading the selected tab once
        // raced it (lego read red on Lite #554, run 36594815958 attempt 2).
        // Wait for exactly the predicate asserted below, then assert it.
        const expected = id === 'lego' ? 'code' : 'circuit';
        const reached = await page.waitForFunction(want => [
            ...document.querySelectorAll('[role="tab"][aria-selected="true"]')
        ].map(tab => tab.textContent).join(' ').toLowerCase().includes(want), expected, {timeout: 10000})
            .then(() => true, error => {
                if (error.name !== 'TimeoutError') throw error;
                return false;
            });
        const selected = (await page.locator('[role="tab"][aria-selected="true"]')
            .allTextContents()).join(' ').toLowerCase();
        check(reached && selected.includes(expected),
            `${id} opens the ${expected} editor${reached ? '' : ` (selected after 10 s: "${selected}")`}`);
        await page.screenshot({path: join(artifacts, `${id}-guided-lesson.png`)});
        await context.close();
    }
    check(pageErrors.length === 0, `all journeys have zero page errors${pageErrors.length ? `: ${pageErrors.join(' | ')}` : ''}`);
} finally {
    await browser.close();
}
