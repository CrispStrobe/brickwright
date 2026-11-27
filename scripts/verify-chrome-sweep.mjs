#!/usr/bin/env node
/** Browser acceptance for the Code editor's compact chrome and scrolling. */
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';

const URL = process.env.PROOF_URL || 'https://crispstrobe.github.io/brickwright-lite/';
const INFO_TOKEN = process.env.CHROME_INFO_TOKEN || 'zlib';
const ARTIFACTS = path.resolve('artifacts/chrome-sweep');
const browser = await chromium.launch({headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 960}});
const failures = [];
const diagnostics = [];

page.on('dialog', dialog => dialog.accept());
page.on('pageerror', error => diagnostics.push(`pageerror: ${error.stack || error.message}`));
page.on('console', message => {
    if (message.type() === 'error' || message.type() === 'warning') {
        diagnostics.push(`console.${message.type()}: ${message.text()}`);
    }
});

const check = (condition, message, detail = '') => {
    console.log(`${condition ? 'ok  ' : 'FAIL'} ${message}${detail ? ` — ${detail}` : ''}`);
    if (!condition) failures.push(`${message}${detail ? ` — ${detail}` : ''}`);
};

const libraryRequests = [];
page.on('request', request => {
    if (/\/chunks\/bw-library(?:[.\/-])/.test(new globalThis.URL(request.url()).pathname)) {
        libraryRequests.push(request.url());
    }
});

try {
    await mkdir(ARTIFACTS, {recursive: true});
    await page.addInitScript(() => {
        localStorage.setItem('bw-starter-v1-complete', '1');
        sessionStorage.clear();
    });
    console.log(`Opening ${URL} ...`);
    await page.goto(URL, {waitUntil: 'domcontentloaded', timeout: 60000});

    const codeTab = page.getByRole('tab', {name: 'Code', exact: true});
    await codeTab.waitFor({timeout: 30000});
    check(await codeTab.innerText() === 'Code', 'main tab is exactly "Code"');
    await codeTab.click();

    // Actual keyboard entry and dismissal, including focus return to real buttons.
    for (const [id, key] of [['bw-file-menu-trigger', 'ArrowDown'],
        ['bw-edit-menu-trigger', ' '], ['bw-settings-menu-trigger', 'ArrowUp']]) {
        const trigger = page.getByTestId(id);
        await trigger.focus();
        await trigger.press(key);
        await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'menuitem');
        check(await page.evaluate(() => document.activeElement.getAttribute('aria-disabled') !== 'true'),
            `${id} focuses an enabled menu item`);
        await page.keyboard.press('Home');
        await page.keyboard.press('End');
        await page.keyboard.press('Escape');
        check(await trigger.evaluate(button => button === document.activeElement), `${id} regains focus after Escape`);
    }

    await page.getByTestId('bw-file-menu-trigger').focus();
    await page.getByTestId('bw-file-menu-trigger').press('ArrowDown');
    // Opening schedules focus after render. As in the vertical cases above,
    // establish that this menu owns focus before exercising its next key.
    await page.waitForFunction(() => {
        const trigger = document.querySelector('[data-testid="bw-file-menu-trigger"]');
        const menu = trigger?.closest('[data-bw-menu-root]')?.querySelector('[role="menu"]');
        return menu && document.activeElement?.closest('[role="menu"]') === menu &&
            document.activeElement.getAttribute('aria-disabled') !== 'true';
    });
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => {
        const trigger = document.querySelector('[data-testid="bw-edit-menu-trigger"]');
        const menu = trigger?.closest('[data-bw-menu-root]')?.querySelector('[role="menu"]');
        if (trigger?.getAttribute('aria-expanded') !== 'true' || !menu) return false;
        const enabled = [...menu.querySelectorAll('[role^="menuitem"]')].filter(item =>
            item.closest('[role="menu"]') === menu && item.getAttribute('aria-disabled') !== 'true');
        // A fresh project may have no enabled Edit action. Its menu still
        // receives Escape; never focus a disabled Undo/Restore item.
        return enabled.length ? enabled.includes(document.activeElement) : document.activeElement === menu;
    });
    await page.keyboard.press('Escape');
    check(await page.getByTestId('bw-edit-menu-trigger').getAttribute('aria-expanded') === 'false',
        'horizontal menu navigation dismisses the actual Edit menu on Escape');
    check(await page.getByTestId('bw-edit-menu-trigger').evaluate(button => button === document.activeElement),
        'horizontal arrows switch to the next real menu');

    const langRow = page.getByTestId('bw-lang-row');
    await langRow.waitFor({timeout: 15000});
    const languageButtons = langRow.getByRole('button', {pressed: false});
    check(await languageButtons.count() >= 5, 'merged row contains the language tabs',
        `${await languageButtons.count()} inactive language buttons`);
    check(await langRow.getByTestId('bw-device-select').count() === 1,
        'merged row contains the device selector');

    // fe and Tcl stay out of the row until chosen from its "+" menu.
    const tabNamed = name => langRow.locator('button[aria-pressed]').filter({hasText: name});
    check(await tabNamed('λ fe').count() === 0 && await tabNamed('○ Tcl').count() === 0,
        'fe and Tcl are not in the language row by default');
    const more = langRow.getByTestId('bw-lang-more');
    check(await more.count() === 1, 'the language row has a "+" control');
    await more.click();
    const menu = page.getByTestId('bw-lang-more-menu');
    check(await menu.getByRole('menuitem').count() === 5, '"+" offers fe, Tcl, Forth, CP1 and CARDIAC',
        (await menu.innerText().catch(() => '')).replace(/\s+/g, ' '));
    await menu.getByRole('menuitem', {name: /Tcl/}).click();
    check(await tabNamed('○ Tcl').getAttribute('aria-pressed') === 'true', 'choosing Tcl opens its tab');
    check(await tabNamed('λ fe').count() === 0, 'fe stays hidden after choosing Tcl');
    await langRow.getByRole('button', {name: /Pseudo/}).click();
    check(await tabNamed('○ Tcl').count() === 1, 'an added language stays in the row after leaving it');
    check(await page.evaluate(() => localStorage.getItem('bw-code-extra-languages')) === '["tcl"]',
        'the added language is remembered per browser');

    await langRow.getByRole('button', {name: /BAS/}).click();
    const profile = page.getByRole('combobox', {name: /Profile/i});
    await profile.waitFor({timeout: 10000});
    // A profile change deliberately clears the BASIC buffer. This makes the
    // absence of a run control attributable, not dependent on project state.
    await profile.selectOption((await profile.inputValue()) === 'ms' ? 'bbc' : 'ms');
    await page.waitForFunction(() =>
        (document.querySelector('.cm-content')?.textContent || '').trim() === '',
    null, {timeout: 10000});
    check(await page.getByTestId('bw-basic-run').count() === 0,
        'empty BASIC buffer has no Run control');
    check(await page.getByRole('button', {name: /Run (Python|JavaScript)/i}).count() === 0,
        'BASIC tab never exposes a wrong-language Run control');

    const infoToggle = page.getByTestId('bw-code-info');
    await infoToggle.click();
    const infoPanel = page.locator('[data-code-language-note="basic"]');
    await infoPanel.waitFor({state: 'visible', timeout: 10000});
    const infoText = await infoPanel.innerText();
    check(infoText.includes('BBC BASIC') && infoText.includes(INFO_TOKEN),
        `BASIC info names BBC BASIC and ${INFO_TOKEN}`, infoText);
    await infoToggle.click();
    await infoPanel.waitFor({state: 'detached', timeout: 10000});
    check(await infoPanel.count() === 0, 'BASIC info hides on its second click');

    await langRow.getByRole('button', {name: /Pseudo/}).click();
    const editor = page.locator('.cm-content:visible');
    await editor.click();
    await page.keyboard.press('Control+a');
    const lines = Array.from({length: 500}, (_, index) => `    say "line ${index + 1}"`).join('\n');
    const source = `SPRITE Cat:\n  WHEN flag clicked:\n${lines}`;
    await page.keyboard.insertText(source);
    await page.waitForFunction(expected =>
        (document.querySelector('.cm-content')?.textContent || '').includes(expected),
    'line 500', {timeout: 15000});

    const scrollInfo = await page.locator('.cm-scroller:visible').evaluate(scroller => ({
        scrollHeight: scroller.scrollHeight,
        clientHeight: scroller.clientHeight
    }));
    check(scrollInfo.scrollHeight > scrollInfo.clientHeight, '500-line editor buffer scrolls internally',
        `${scrollInfo.scrollHeight} > ${scrollInfo.clientHeight}`);
    check(await langRow.isVisible(), 'editor controls remain visible above a tall buffer');

    const maximize = page.getByTestId('bw-editor-maximize');
    await maximize.click();
    await page.getByTestId('bw-max-editor-tools').waitFor();
    check(await page.locator('body.bw-compact-chrome').count() === 1, 'maximize collapses the top menu');
    check(!await langRow.isVisible(), 'maximize folds the language bar into its overflow menu');
    await page.getByTestId('bw-max-editor-tools').click();
    await page.getByTitle('Restore panels').waitFor({state: 'visible', timeout: 10000});
    check(await page.getByTestId('bw-device-select').isVisible(),
        'maximize retains the compact target selector');
    const actions = page.getByTestId('bw-code-action-row');
    check(await actions.getByRole('button', {name: '⇦ To blocks', exact: true}).isVisible() &&
        await actions.getByRole('button', {name: 'From blocks ⇨', exact: true}).isVisible(),
    'maximize exposes both block-conversion controls');
    check(await page.getByRole('button', {name: /To blocks/}).count() === 1,
        'maximize shows exactly one To blocks control');
    await page.getByTitle('Restore panels').click();
    await page.getByTitle('Maximize editor').waitFor({state: 'visible', timeout: 10000});
    check(await page.getByTestId('bw-device-select').isVisible(), 'restoring returns the normal editor chrome');
    // Main menus must reach the same live editor as its toolbar/shortcuts.
    const openMenu = async name => page.getByText(name, {exact: true}).first().click();
    const menuItem = name => page.locator('li:visible').filter({has: page.getByText(name, {exact: true})});
    // Compare whole documents: .cm-content renders only the visible lines of this
    // 500-line buffer, and Control+Home scrolls on Linux but not on macOS.
    const docText = () => editor.evaluate(el => el.cmTile.root.view.state.doc.toString());
    const editorHandle = await editor.elementHandle();
    const waitForDoc = expected => page.waitForFunction(([el, text]) => el.cmTile.root.view.state.doc.toString() === text,
        [editorHandle, expected]);
    const beforeMenuEdit = await docText();
    await editor.click();
    await page.keyboard.press('Control+Home');
    await page.keyboard.insertText('menu_probe\n');
    const afterMenuEdit = await docText();
    check(afterMenuEdit !== beforeMenuEdit, 'menu undo control has a real edit');
    await openMenu('Edit');
    check(await menuItem('Undo').getAttribute('aria-disabled') !== 'true', 'Edit > Undo is enabled');
    await menuItem('Undo').click();
    await waitForDoc(beforeMenuEdit);
    await openMenu('Edit');
    await menuItem('Redo').click();
    await waitForDoc(afterMenuEdit);
    check(true, 'Edit Undo and Redo restore the actual Code buffer');
    await openMenu('Edit');
    await menuItem('Find and replace…').click();
    const search = page.locator('.cm-search input[name="search"]');
    await search.waitFor({state: 'visible'});
    check(await search.evaluate(input => input === document.activeElement), 'Find keeps search-field focus');
    await page.keyboard.press('Escape');
    await openMenu('Edit');
    await menuItem('Go to line…').click();
    await page.locator('.cm-editor input[name="line"]').waitFor({state: 'visible'});
    await page.keyboard.press('Escape');
    await openMenu('Edit');
    await menuItem('Select all').click();
    await page.keyboard.insertText('menu_selection_probe');
    await page.waitForFunction(() => document.querySelector('.cm-content')?.textContent === 'menu_selection_probe');
    check(true, 'Edit > Select all selects the actual buffer');

    await openMenu('File');
    check(await menuItem('Open circuit…').count() === 0, 'Code File menu excludes Circuit actions');
    check(await menuItem('Open code file…').getAttribute('aria-disabled') !== 'true', 'Code File > Open is ready');
    check(await menuItem('Save to your computer').isVisible(), 'project download remains available beside Code files');
    const chooseFile = page.waitForEvent('filechooser');
    await menuItem('Open code file…').click();
    const chooser = await chooseFile;
    const importedSource = '# menu file roundtrip — Grüße\nSPRITE Cat:\n  WHEN flag clicked:\n    say "menu_file_probe"\n';
    await chooser.setFiles({name: 'menu-file.bw', mimeType: 'text/plain', buffer: Buffer.from(importedSource)});
    await page.waitForFunction(() => document.querySelector('.cm-content')?.textContent.includes('menu_file_probe'));
    await openMenu('File');
    const downloaded = page.waitForEvent('download');
    await menuItem('Save code as…').click();
    const download = await downloaded;
    const stream = await download.createReadStream();
    if (!stream) throw new Error('Code menu download has no readable bytes');
    const chunks = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    check(download.suggestedFilename() === 'program.bw', 'Code File > Save uses the actual filename policy');
    check(Buffer.concat(chunks).equals(Buffer.from(importedSource)),
        'Code File open/save preserves the exact source bytes, comments and Unicode');
    const vmHasConversionProbe = () => {
        const vm = window.__brickwrightStore.getState().scratchGui.vm;
        return vm.runtime.targets.some(target => Object.values(target.blocks._blocks).some(block => {
            if (block.opcode !== 'looks_say') return false;
            const input = block.inputs.MESSAGE;
            const value = input && target.blocks.getBlock(input.block);
            return value?.opcode === 'text' && value.fields?.TEXT?.value === 'menu_conversion_probe';
        }));
    };
    check(!(await page.evaluate(vmHasConversionProbe)), 'VM starts without the conversion probe');
    await editor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.insertText('SPRITE Cat:\n  WHEN flag clicked:\n    say "menu_conversion_probe"\n');
    await openMenu('Edit');
    await menuItem('Convert code to blocks').click();
    await page.waitForFunction(vmHasConversionProbe);
    await page.waitForFunction(() => {
        const button = document.querySelector('[data-testid="bw-code-action-row"] button');
        return button && !button.disabled;
    });
    check(true, 'Edit > Convert code to blocks produces the actual VM say block');
    await editor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.insertText('SPRITE Cat:\n  WHEN flag clicked:\n    say "menu_stale_buffer"\n');
    check(await page.evaluate(vmHasConversionProbe), 'editing Code leaves the converted VM project intact');
    await openMenu('Edit');
    await menuItem('Generate code from blocks').click();
    await page.waitForFunction(() => {
        const text = document.querySelector('.cm-content')?.textContent || '';
        return text.includes('menu_conversion_probe') && !text.includes('menu_stale_buffer');
    });
    check(true, 'Edit > Generate code from blocks replaces stale text from the actual VM');
    await page.getByRole('tab', {name: 'Circuit', exact: true}).click();
    await openMenu('File');
    check(await menuItem('Open code file…').count() === 0, 'Circuit File menu excludes Code actions');
    for (const label of ['Open circuit…', 'Save circuit', 'Import circuit…', 'Export circuit…']) {
        check(await menuItem(label).isVisible(), `Circuit File menu exposes ${label}`);
    }
    await page.keyboard.press('Escape');
    await page.getByRole('tab', {name: 'Blocks', exact: true}).click();
    await openMenu('Edit');
    check(await menuItem('Find and replace…').count() === 0 && await menuItem('Select all').count() === 0,
        'Blocks Edit menu excludes Code commands');
    check(await menuItem('Convert code to blocks').count() === 0 &&
        await menuItem('Generate code from blocks').count() === 0, 'Blocks Edit menu excludes Code conversion commands');

    {
        // Exercise the real deferred dialog only after the earlier editor witnesses.
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => document.querySelector('[data-testid="bw-edit-menu-trigger"]')
            ?.getAttribute('aria-expanded') === 'false');
        check(libraryRequests.length === 0, 'library implementation is not requested before an actual chooser opens');
        const pane = page.locator('[data-right-pane-toggle]');
        if (await pane.getAttribute('aria-pressed') !== 'true') await pane.click();
        await page.waitForFunction(() => document.querySelector('[data-right-pane-toggle]')
            ?.getAttribute('aria-pressed') === 'true');
        const chooser = page.locator('[class*="action-menu_main-button"][aria-label="Choose a Sprite"]');
        await chooser.click();
        const library = page.getByRole('dialog', {name: 'Choose a Sprite', exact: true});
        const search = library.getByPlaceholder('Search', {exact: true});
        const abby = library.getByRole('button', {name: 'Abby', exact: true});
        await search.waitFor({state: 'visible'});
        await abby.waitFor({state: 'visible'});
        check(libraryRequests.length > 0, 'opening the chooser requests the real library implementation');
        await search.fill('brickwright-no-such-sprite');
        await abby.waitFor({state: 'hidden'});
        await search.fill('Abby');
        await abby.waitFor({state: 'visible'});
        check(await abby.count() === 1, 'the loaded library filters a known sprite rather than an empty catalogue');
        await library.getByRole('button', {name: 'Back', exact: true}).click();
        await library.waitFor({state: 'hidden'});
        await chooser.click();
        await search.waitFor({state: 'visible'});
        await abby.waitFor({state: 'visible'});
        check(await search.inputValue() === '', 'closing and reopening the library resets its search state');
        const beforeTargets = await page.evaluate(() => window.__brickwrightStore.getState().scratchGui.vm.runtime
            .targets.filter(target => !target.isStage).map(target => target.id));
        await search.fill('Abby');
        await abby.click();
        await library.waitFor({state: 'hidden'});
        await page.waitForFunction(before => {
            const added = window.__brickwrightStore.getState().scratchGui.vm.runtime.targets
                .filter(target => !target.isStage && !before.includes(target.id));
            return added.length === 1 && /^Abby/.test(added[0].getName()) && added[0].getCostumes().length > 0;
        }, beforeTargets);
        check(true, 'the deferred library adds one real sprite with costumes through the original callback');
    }
} catch (error) {
    check(false, 'chrome sweep journey completes', error.message);
} finally {
    try {
        await mkdir(ARTIFACTS, {recursive: true});
        await writeFile(path.join(ARTIFACTS, 'diagnostics.txt'),
            diagnostics.length ? `${diagnostics.join('\n')}\n` : 'No page errors or console warnings/errors.\n');
        if (failures.length || diagnostics.some(line => line.startsWith('pageerror:'))) {
            await page.screenshot({path: path.join(ARTIFACTS, 'failure.png'), fullPage: true}).catch(() => {});
        }
    } finally {
        await browser.close();
    }
}

check(!diagnostics.some(line => line.startsWith('pageerror:')), 'no page errors',
    diagnostics.filter(line => line.startsWith('pageerror:')).join(' | '));
console.log(failures.length ? `\n${failures.length} chrome-sweep check(s) failed.` : '\nAll chrome-sweep checks passed.');
process.exit(failures.length ? 1 : 0);
