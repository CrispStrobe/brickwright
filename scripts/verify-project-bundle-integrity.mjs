#!/usr/bin/env node
/** Live four-surface save/reopen and vanilla replacement acceptance. */
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {openCodeInfo} from './lib-code-actions.mjs';

const requireFromGui = createRequire(new URL('../packages/scratch-gui/package.json', import.meta.url));
const JSZip = requireFromGui('jszip');
const url = process.env.PROOF_URL || 'http://localhost:8617/';
const artifacts = resolve('artifacts/project-bundle-integrity');
await mkdir(artifacts, {recursive: true});
const savedPath = resolve(artifacts, 'four-surface.sb3');
const vanillaPath = resolve(artifacts, 'vanilla-replacement.sb3');
const futurePath = resolve(artifacts, 'future-sidecar.sb3');
const invalidPath = resolve(artifacts, 'invalid-sidecar.sb3');
const source = 'SPRITE Cat:\n  WHEN flag clicked:\n    say "bundle integrity" for 2 seconds';
const errors = [];

const browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const newContext = async ({starterComplete = true} = {}) => {
    const context = await browser.newContext({viewport: {width: 1600, height: 1000},
        acceptDownloads: true});
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.addInitScript(complete => {
        localStorage.clear();
        sessionStorage.clear();
        if (complete) localStorage.setItem('bw-starter-v1-complete', '1');
    }, starterComplete);
    return {context, page};
};
const waitForVM = page => page.waitForFunction(() => {
    const vm = window.__brickwrightStore?.getState?.()?.scratchGui?.vm;
    if (!vm?.runtime) return false;
    window.__vm = vm;
    return true;
}, null, {timeout: 60000});
const openProject = async (page, file) => {
    await page.getByText('File', {exact: true}).click();
    await page.getByText('Load from your computer', {exact: true}).click();
    await page.locator('body > input[type="file"][accept*=".sb3"]').setInputFiles(file);
};
const projectKeys = page => page.evaluate(() => ({
    code: localStorage.getItem('bw-code-autosave'),
    circuit: localStorage.getItem('bw-circuit-autosave'),
    controller: localStorage.getItem('bw-ctl-widgets')
}));

try {
    let {context, page} = await newContext({starterComplete: false});
    await page.goto(`${url}${url.includes('?') ? '&' : '?'}journey=board`,
        {waitUntil: 'domcontentloaded', timeout: 60000});
    await waitForVM(page);
    await page.getByTestId('bw-starter-dialog').waitFor({timeout: 30000});
    await page.locator('[data-starter-id="board"]').click();
    await page.getByTestId('bw-starter-dialog').waitFor({state: 'detached', timeout: 45000});
    await page.waitForFunction(() => (window.__vm?.runtime?.circuitModel?.parts?.length || 0) > 0,
        null, {timeout: 30000});
    const lesson = page.getByTestId('bw-guided-lesson');
    if (await lesson.count()) await lesson.getByRole('button', {name: 'Close'}).click();

    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    const editor = page.locator('.cm-content').first();
    await editor.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Backspace');
    await page.keyboard.insertText(source);
    await page.getByRole('button', {name: /To blocks/}).first().click();
    await page.waitForFunction(() => (window.__vm?.runtime?.targets || []).some(target =>
        Object.values(target.blocks?._blocks || {}).some(block => block.opcode === 'looks_sayforsecs')),
    null, {timeout: 30000});

    const showRight = page.getByRole('button', {name: 'Show right panel'});
    if (await showRight.count()) await showRight.click();
    await page.locator('button[title="Controller"]:visible').click();
    await page.getByTestId('bw-controller-canvas').waitFor({state: 'visible', timeout: 15000});
    await page.getByTestId('bw-ctl-mode-edit').click();
    await page.getByRole('button', {name: '+ Add Widget', exact: true}).click();
    await page.getByRole('button', {name: 'Slider', exact: true}).click();
    await page.getByTestId('bw-ctl-widget-slider1').waitFor({state: 'visible'});

    await page.getByText('File', {exact: true}).click();
    const downloadPromise = page.waitForEvent('download', {timeout: 30000});
    await page.getByText('Save to your computer', {exact: true}).click();
    await (await downloadPromise).saveAs(savedPath);
    const savedZip = await JSZip.loadAsync(await readFile(savedPath));
    const sidecarText = await savedZip.file('brickwright/state.json').async('text');
    const sidecar = JSON.parse(sidecarText);
    const sections = ['code', 'circuit', 'controller'].filter(name => sidecar.state?.[name]);
    if (sidecar.version !== 2 || sections.length !== 3) {
        throw new Error(`saved sidecar is not v2 with 3/3 sections: ${JSON.stringify(sections)}`);
    }
    savedZip.remove('brickwright/state.json');
    await writeFile(vanillaPath, await savedZip.generateAsync({type: 'nodebuffer'}));
    savedZip.file('brickwright/state.json', JSON.stringify({
        format: 'brickwright-state', version: 7, state: {futureOnly: {value: 99}}
    }));
    await writeFile(futurePath, await savedZip.generateAsync({type: 'nodebuffer'}));
    savedZip.file('brickwright/state.json', '{invalid');
    await writeFile(invalidPath, await savedZip.generateAsync({type: 'nodebuffer'}));
    await context.close();

    ({context, page} = await newContext());
    await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 60000});
    await waitForVM(page);
    await openProject(page, savedPath);
    await page.waitForFunction(() => ['bw-code-autosave', 'bw-circuit-autosave', 'bw-ctl-widgets']
        .every(key => localStorage.getItem(key)), null, {timeout: 45000});
    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    await page.waitForFunction(needle => (document.querySelector('.cm-content')?.textContent || '')
        .includes(needle), 'bundle integrity', {timeout: 15000});
    await page.getByRole('tab', {name: /Circuit/}).click();
    await page.waitForFunction(() => (window.__vm?.runtime?.circuitModel?.parts?.length || 0) > 0,
        null, {timeout: 15000});
    const reopenRight = page.getByRole('button', {name: 'Show right panel'});
    if (await reopenRight.count()) await reopenRight.click();
    await page.locator('button[title="Controller"]:visible').click();
    await page.getByTestId('bw-ctl-widget-slider1').waitFor({state: 'visible', timeout: 15000});
    await page.screenshot({path: resolve(artifacts, 'four-surface-restored.png'), fullPage: true});

    // The circuit editor re-saves a just-loaded circuit in its own fuller form
    // about a second after it mounts (2755 -> 5793 bytes for this bench). That
    // write belongs to the successful open above; a snapshot taken before it
    // lands blames the refusals below for it. Wait until the saved state stops
    // changing, then require the refusals to leave it byte-identical.
    // Condition wait, not a sleep: sample once a second in the page and pass
    // once two consecutive samples match the one before them (bounded 16 s).
    await page.waitForFunction(() => {
        const now = JSON.stringify(['bw-code-autosave', 'bw-circuit-autosave', 'bw-ctl-widgets']
            .map(key => localStorage.getItem(key)));
        const seen = window.__bwSettleProbe || (window.__bwSettleProbe = {last: null, stable: 0});
        seen.stable = now === seen.last ? seen.stable + 1 : 0;
        seen.last = now;
        return seen.stable >= 2;
    }, null, {polling: 1000, timeout: 16000}).catch(error => {
        throw new Error(`project state kept changing after the successful open: ${error.message}`);
    });
    const beforeRefusal = await projectKeys(page);
    await openProject(page, futurePath);
    // BEFORE any tab click. Opening a project changes the active tab, so a
    // refusal written only into the Code tab's status strip lands where the
    // learner has just stopped looking — the text was present and HIDDEN, which
    // is a silent refusal wearing a notice. The app-level alert has to carry it.
    await page.getByText(/saved by a newer version of Brickwright/)
        .waitFor({state: 'visible', timeout: 15000});
    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    const futureInfo = await openCodeInfo(page);
    await futureInfo.getByText(/Brickwright state v7 was not applied: preserved-not-applied/).waitFor({timeout: 15000});
    await page.keyboard.press('Escape');
    const afterFuture = await projectKeys(page);
    if (JSON.stringify(afterFuture) !== JSON.stringify(beforeRefusal)) {
        const changed = Object.keys(beforeRefusal).filter(key => beforeRefusal[key] !== afterFuture[key]);
        const evidence = Object.fromEntries(changed.map(key => [key, ['before', 'after'].map(which => {
            const value = (which === 'before' ? beforeRefusal : afterFuture)[key];
            return value === null ? null : {bytes: Buffer.byteLength(value),
                sha256: createHash('sha256').update(value).digest('hex')};
        })]));
        throw new Error(`future sidecar partially replaced known project state: ${JSON.stringify(evidence)}`);
    }
    await openProject(page, invalidPath);
    await page.getByText(/Brickwright data could not be read/)
        .waitFor({state: 'visible', timeout: 15000});
    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    const invalidInfo = await openCodeInfo(page);
    await invalidInfo.getByText(/Brickwright state was not applied: invalid JSON/).waitFor({timeout: 15000});
    await page.keyboard.press('Escape');
    const afterInvalid = await projectKeys(page);
    if (JSON.stringify(afterInvalid) !== JSON.stringify(beforeRefusal)) {
        const changed = Object.keys(beforeRefusal).filter(key => beforeRefusal[key] !== afterInvalid[key]);
        const evidence = Object.fromEntries(changed.map(key => [key, ['before', 'after'].map(which => {
            const value = (which === 'before' ? beforeRefusal : afterInvalid)[key];
            return value === null ? null : {bytes: Buffer.byteLength(value),
                sha256: createHash('sha256').update(value).digest('hex')};
        })]));
        throw new Error(`invalid sidecar partially replaced known project state: ${JSON.stringify(evidence)}`);
    }

    await openProject(page, vanillaPath);
    await page.waitForFunction(() => {
        const read = key => JSON.parse(localStorage.getItem(key));
        return !read('bw-code-autosave')?.code?.trim() && !read('bw-circuit-autosave')?.parts?.length &&
            !read('bw-ctl-widgets')?.widgets?.length;
    }, null, {timeout: 15000});
    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    await page.waitForFunction(() => !(document.querySelector('.cm-content')?.textContent || '').trim(),
        null, {timeout: 15000});
    const cleared = await page.evaluate(() => ({
        circuitParts: window.__vm?.runtime?.circuitModel?.parts?.length || 0,
        widgets: window.__vm?.runtime?.controllerPanel?.getWidgetNames?.().length || 0
    }));
    // Read WITHOUT activating the Circuit tab, on purpose. vm.runtime.circuitModel
    // is what bw-debug's debug-runner and the circuit VM extension resolve the
    // board through, so this is the state a green flag runs against. Activating
    // the tab first would remount the Designer and hide a stale live model.
    if (cleared.circuitParts !== 0 || cleared.widgets !== 0) {
        throw new Error(`vanilla replacement retained auxiliary state: ${JSON.stringify(cleared)}`);
    }
    // A refusal notice must not outlive the refusal. The invalid sidecar above legitimately
    // raises one; this load succeeded and cleared all three surfaces, so a banner still reading
    // "what you had is still here" would be describing the opposite of what just happened. The
    // source gate cannot see this — the text was correct, the LIFETIME was wrong — so it is
    // asserted here, on the rendered page, immediately before the screenshot that first showed it.
    const staleRefusal = await page
        .getByText(/Brickwright data could not be read|saved by a newer version of Brickwright|Browser storage refused/)
        .count();
    if (staleRefusal !== 0) {
        throw new Error(`a refusal notice survived a successful load: ${staleRefusal} still shown`);
    }
    const keys = await projectKeys(page);
    await page.screenshot({path: resolve(artifacts, 'vanilla-cleared.png'), fullPage: true});
    await writeFile(resolve(artifacts, 'result.json'), JSON.stringify({
        url, sidecarVersion: sidecar.version, restoredSections: sections,
        legacyCleared: cleared, keys, pageErrors: errors
    }, null, 2));
    if (errors.length) throw new Error(`page errors: ${errors.join(' | ')}`);
    console.log('Project bundle integrity: restored 4/4 surfaces; vanilla cleared 3/3 auxiliaries.');
    await context.close();
} catch (error) {
    const failurePage = browser.contexts().at(-1)?.pages()?.[0];
    if (failurePage) {
        await failurePage.screenshot({path: resolve(artifacts, 'failure.png'), fullPage: true})
            .catch(() => {});
    }
    await writeFile(resolve(artifacts, 'failure.txt'), `${error.stack || error}\n`);
    throw error;
} finally {
    await browser.close();
}
