// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium, webkit} from 'playwright';
import {openCodeActions} from './lib-code-actions.mjs';
import {typeIntoEditor} from './lib/type-into-editor.mjs';

const url = process.argv[2];
assert.ok(url, 'Pass the URL of the assembled Brickwright frontend');
const engine = process.env.BW_BROWSER_ENGINE === 'webkit' ? webkit : chromium;
const browser = await engine.launch(engine === chromium ?
    {executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {});
try {
    const page = await browser.newPage({viewport: {width: 1600, height: 1000}, locale: 'en-US', serviceWorkers: 'block'});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
        localStorage.setItem('bw-starter-v1-complete', '1');
        localStorage.setItem('bw-right-pane-hidden', '0');
    });
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    await page.getByRole('tab', {name: 'Code', exact: true}).click();

    const output = page.getByTestId('bw-code-output');
    const input = page.getByTestId('bw-code-input');
    const run = async () => {
        const inline = page.getByTestId('bw-code-run');
        if (await inline.isVisible()) await inline.click();
        else {
            await openCodeActions(page);
            await page.getByTestId('bw-code-run-menu').click();
        }
    };
    const enter = async (prompt, value) => {
        const answer = input.getByRole('textbox', {name: prompt, exact: true});
        await answer.fill(value);
        await answer.press('Enter');
    };

    await page.getByRole('button', {name: '🐍 Py', exact: true}).click();
    await typeIntoEditor(page, 'name = input("Name?")\nprint("Python: " + name)');
    await run();
    await enter('Name?', 'Ada');
    await output.getByText('Python: Ada', {exact: true}).waitFor();
    await input.waitFor({state: 'hidden'});
    console.log('Python inline input resumes the rendered console worker.');

    await typeIntoEditor(page, 'input("Cancel this question?")\nprint("cancelled output leaked")');
    await run();
    await input.getByRole('textbox', {name: 'Cancel this question?', exact: true}).waitFor();
    await page.locator('img[title="Stop"]:visible').click();
    await output.getByText('Stopped.', {exact: true}).waitFor();
    await input.waitFor({state: 'hidden'});
    console.log('Stage Stop cancels Python input and removes the pending form.');

    await typeIntoEditor(page, 'print("Switching language")');
    await page.getByRole('button', {name: '🟨 JS', exact: true}).click();
    await typeIntoEditor(page, 'const item = await input("Item?");\nconst count = await input("Count?");\nconsole.log(item + ": " + count);');
    await run();
    await enter('Item?', 'Gear');
    await enter('Count?', '7');
    await output.getByText('Gear: 7', {exact: true}).waitFor();
    console.log('JavaScript awaits two separate input requests and completes.');

    await typeIntoEditor(page, [
        'codeRun.spawn(async task => {',
        '    const name = await task.input("Name for the child task?");',
        '    await task.sleep(20);',
        '    console.log("Child: " + name);',
        '});',
        'console.log("Parent finished");'
    ].join('\n'));
    await run();
    await output.filter({hasText: 'Parent finished'}).waitFor();
    await enter('Name for the child task?', 'Ada');
    await output.filter({hasText: 'Child: Ada'}).waitFor();
    console.log('An owned JavaScript child remains live after its parent finishes and receives Code input.');

    await typeIntoEditor(page, 'console.log("Worker entered");\nawait new Promise(resolve => setTimeout(resolve, 50));\nwhile (true) {}');
    await run();
    await output.getByText('Worker entered', {exact: true}).waitFor();
    await openCodeActions(page);
    await page.getByTestId('bw-code-stop-menu').click();
    await output.getByText(/Stopped\./).waitFor();
    await typeIntoEditor(page, 'await Promise.resolve();\nconsole.log("Clean restart");');
    await run();
    await output.getByText('Clean restart', {exact: true}).waitFor();
    await input.waitFor({state: 'hidden'});
    assert.deepEqual(errors, []);
    console.log('Stop in Code overflow terminates a busy worker and rerun starts cleanly.');
} finally {
    await browser.close();
}
