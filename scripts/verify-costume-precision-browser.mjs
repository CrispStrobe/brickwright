// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    headless: true
});
const page = await browser.newPage({viewport:{width:1520,height:960},locale:'en-US',serviceWorkers:'block'});
page.setDefaultTimeout(90000);
const sdkRequests = [];
page.on('request', request => {
    if (request.url().includes('/static/cad-sdk/')) sdkRequests.push(request.url());
});
const sketch = () => page.evaluate(() => {
    const editor = window.__bwCad?.editor;
    if (!editor) return null;
    const document = editor.session.state.document;
    return {sketches:Object.values(document.sketches || {}),roots:document.roots};
});
await page.addInitScript(() => {
    localStorage.setItem('bw-starter-v1-complete', '1');
    localStorage.setItem('bw-cad-enabled', '1');
});
try {
    await page.goto(process.argv[2] || 'http://127.0.0.1:8230/', {waitUntil:'commit'});
    await page.getByRole('tab', {name:'Costumes',exact:true}).click();
    await page.getByTestId('bw-costume-export').waitFor();
    const trigger = page.getByTestId('bw-costume-precision');
    assert.equal(await trigger.count(),0);
    assert.equal(sdkRequests.length,0);
    const original = await page.evaluate(() => {
        const vm = window.__brickwrightStore.getState().scratchGui.vm;
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="70">' +
            '<g transform="translate(10 12)"><path fill="#8040a0" fill-rule="evenodd" d="M0 0H40V20H0Z M10 4H16V12H10Z"/>' +
            '<circle cx="65" cy="22" r="7"/><path d="M40 40L47 40L48 55"/></g></svg>';
        vm.updateSvg(0,svg,0,0);
        return vm.editingTarget.getCostumes()[0].assetId;
    });

    const settings = page.getByTestId('bw-settings-menu-trigger');
    await settings.click();
    const preference = page.getByRole('combobox',{name:'Costumes precision design',exact:true});
    if (!await preference.isVisible()) {
        await page.getByRole('menuitem',{name:'Workspace',exact:true}).getByText('Workspace',{exact:true}).click();
    }
    await preference.selectOption('1');
    await trigger.waitFor();
    assert.equal(sdkRequests.length,0);
    await trigger.click();

    const dialog = page.getByRole('dialog',{name:'Send to CAD',exact:true});
    const regions = dialog.getByLabel('Region',{exact:true});
    await regions.waitFor();
    assert.equal(await regions.locator('option').count(),2);
    await dialog.getByText('Close the path in Costumes before importing it.',{exact:true}).waitFor();
    await dialog.getByRole('img',{name:'Closed profile preview'}).waitFor();
    assert.equal(await sketch(),null);
    await regions.selectOption('1');
    await dialog.getByText(/40 × 40 mm/).waitFor();
    await regions.selectOption('0');
    await dialog.getByLabel('Width (mm)',{exact:true}).fill('60');
    await dialog.getByLabel('Sketch plane',{exact:true}).selectOption('YZ');
    await dialog.getByText(/60 × 30 mm/).waitFor();
    await dialog.getByRole('button',{name:'Add editable sketch',exact:true}).click();
    await dialog.getByText(/Sketch added to CAD/).waitFor();
    assert.equal(await page.evaluate(() =>
        window.__brickwrightStore.getState().scratchGui.vm.editingTarget.getCostumes()[0].assetId),original);

    const result = await sketch();
    assert.equal(result.roots.length,0);
    assert.equal(result.sketches.length,1);
    const [draft] = result.sketches;
    assert.equal(draft.plane,'YZ');
    assert.equal(draft.profile.kind,'region');
    assert.equal(draft.profile.loops.length,2);
    assert.deepEqual(draft.profile.loops[0].points.map(([x,y]) => [Math.round(x),Math.round(y)]).sort(),
        [[0,0],[0,30],[60,0],[60,30]].sort());
    await dialog.getByRole('button',{name:'Close',exact:true}).click();
    await page.getByRole('tab',{name:'CAD',exact:true}).click();
    await page.getByRole('button',{name:`Extrude sketch: ${draft.name}`,exact:true}).click();
    const extrusion = page.getByRole('dialog',{name:'Sketch and extrusion'});
    await extrusion.getByLabel('Extrusion distance (mm)',{exact:true}).fill('10');
    await extrusion.getByRole('button',{name:'Create extrusion',exact:true}).click();
    await extrusion.waitFor({state:'hidden'});
    const body = await page.evaluate(async () => {
        const {editor} = window.__bwCad;
        const result = await editor.whenIdle();
        return result.bodies[0]?.volume;
    });
    // A 60 × 30 mm profile with a 9 × 12 mm hole, extruded 10 mm.
    assert.ok(Math.abs(body - 16920) < .1, `Extrusion volume ${body} mm³`);
    await page.getByRole('tab', {name:'Costumes',exact:true}).click();
    await settings.click();
    if (!await preference.isVisible()) {
        await page.getByRole('menuitem',{name:'Workspace',exact:true}).getByText('Workspace',{exact:true}).click();
    }
    await preference.selectOption('0');
    await trigger.waitFor({state:'detached'});
    console.log('PASS default-off Costumes, lazy SDK, region preview and selection, scaled editable CAD sketch, preserved artwork, and extrusion');
} catch (error) {
    await page.screenshot({path:'/tmp/bw-costume-precision-failure.png'}).catch(() => {});
    throw error;
} finally {
    await browser.close();
}
