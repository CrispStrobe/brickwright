// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium, webkit} from 'playwright';
import {openCodeActions, openCodeInfo} from './lib-code-actions.mjs';
import {typeIntoEditor} from './lib/type-into-editor.mjs';

const url = process.argv[2];
assert.ok(url, 'Pass the URL of the assembled Brickwright frontend');
const browser = process.env.BW_BROWSER_ENGINE === 'webkit' ?
    await webkit.launch() : await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const app = async () => {
    const page = await browser.newPage({viewport: {width: 1600, height: 1000}, locale: 'en-US', serviceWorkers: 'block'});
    await page.addInitScript(() => {
        localStorage.setItem('bw-starter-v1-complete', '1');
        localStorage.setItem('bw-right-pane-hidden', '1');
    });
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    await page.getByTestId('bw-lang-row').waitFor();
    return page;
};
const toBlocks = async page => {
    await openCodeActions(page);
    await page.getByTestId('bw-code-actions-menu').getByRole('button', {name: /To blocks$/i}).click();
};
const stageSignature = page => page.evaluate(() =>
    window.__brickwrightStore.getState().scratchGui.vm.runtime.getTargetForStage().id);

try {
    for (const [name, source, opcode, optional] of [
        ['🧩 Pseudo', 'WHEN flag clicked:\n  say "hello"\n', 'looks_say'],
        ['🐍 Py', 'print ("hello")', 'looks_say'],
        ['🟨 JS', 'console.log("hello");', 'looks_say'],
        ['🔧 C', '#include <8052.h>\n#define LED1 P1_0\nvoid main(void) { LED1 = 1; }', 'stc12_setpin'],
        ['📺 BAS', '10 PRINT "hello"\n20 END', 'stc12_print'],
        ['λ fe', '(print "hello")', 'looks_say', true],
        ['○ Tcl', 'puts "hello"', 'looks_say', true],
        ['🔺 Forth', '." hello" cr', 'looks_say', true]
    ]) {
        const page = await app();
        const before = await stageSignature(page);
        const tab = page.getByRole('button', {name, exact: true});
        if (optional && !(await tab.count())) {
            await page.getByTestId('bw-lang-more').click();
            await page.getByTestId('bw-lang-more-menu').getByRole('menuitem', {name: new RegExp(name)}).click();
        } else if (await tab.getAttribute('aria-pressed') !== 'true') await tab.click();
        await typeIntoEditor(page, source);
        await toBlocks(page);

        await page.waitForFunction(({opcode, before}) => {
            const runtime = window.__brickwrightStore.getState().scratchGui.vm.runtime;
            const stage = runtime.getTargetForStage();
            return stage && stage.id !== before && runtime.targets.some(target =>
                Object.values(target.blocks._blocks).some(block => block.opcode === opcode));
        }, {opcode, before});
        await page.waitForFunction(() =>
            document.querySelector('[data-testid="bw-code-action-row"] button[aria-label$="To blocks"]')?.disabled === false);
        const editor = page.locator('.cm-content').first();
        assert.equal(await editor.evaluate(el => el.cmTile.root.view.state.doc.toString()), source,
            `${name} source changed during conversion`);
        console.log(`${name} → Blocks loaded ${opcode} and retained its source`);
        await page.close();
    }

    const python = await app();
    await python.getByRole('button', {name: '🐍 Py', exact: true}).click();
    await typeIntoEditor(python, 'print ("hello")');
    await python.getByRole('button', {name: '🧩 Pseudo', exact: true}).click();
    await python.waitForFunction(() => document.querySelector('.cm-content')?.textContent.includes('say "hello"'));
    await toBlocks(python);
    await python.waitForFunction(() =>
        window.__brickwrightStore.getState().scratchGui.vm.runtime.targets.some(target =>
            Object.values(target.blocks._blocks).some(block => block.opcode === 'looks_say')));
    console.log('Python → Pseudocode → Blocks works when switching through the Pseudo tab.');

    await python.getByRole('button', {name: '🐍 Py', exact: true}).click();
    await typeIntoEditor(python, 'sys.getsizeof(4)');
    const before = await stageSignature(python);
    await toBlocks(python);
    const report = (await openCodeInfo(python)).getByTestId('bw-conversion-report');
    await report.getByText(/Python → Blocks/).waitFor();
    const issue = python.getByTestId('bw-conversion-unsupported');
    if (!(await issue.count())) await report.getByText(/Conversion report/).click();
    assert.match(await issue.innerText(), /dropped expression statement/);
    assert.equal(await stageSignature(python), before);
    console.log('Unsupported Python leaves the loaded project in place and reports the reader issue.');
} finally {
    await browser.close();
}
