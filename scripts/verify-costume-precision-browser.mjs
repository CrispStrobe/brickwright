// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    headless: true
});
const appUrl = process.argv[2] || 'http://127.0.0.1:8230/';
const newWorkspace = async () => {
    const workspace = await browser.newPage({viewport:{width:1520,height:960},locale:'en-US',serviceWorkers:'block'});
    workspace.setDefaultTimeout(90000);
    await workspace.addInitScript(() => {
        localStorage.setItem('bw-starter-v1-complete', '1');
        localStorage.setItem('bw-cad-enabled', '1');
    });
    return workspace;
};
const page = await newWorkspace();
let activePage = page;
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
try {
    await page.goto(appUrl, {waitUntil:'commit'});
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
    await page.getByText('File',{exact:true}).click();
    const download = page.waitForEvent('download');
    await page.getByText('Save to your computer',{exact:true}).click();
    const file = await readFile(await (await download).path());

    const reopened = await newWorkspace();
    activePage = reopened;
    await reopened.goto(appUrl,{waitUntil:'commit'});
    await reopened.getByText('File',{exact:true}).click();
    await reopened.getByText('Load from your computer',{exact:true}).click();
    await reopened.locator('body > input[type="file"][accept*=".sb3"]').setInputFiles({
        name:'costume-cad.sb3',mimeType:'application/x.scratch.sb3',buffer:file
    });
    await reopened.waitForFunction(assetId => {
        const vm = window.__brickwrightStore?.getState().scratchGui.vm;
        return vm?.runtime.targets.some(target => target.sprite.costumes.some(costume => costume.assetId === assetId));
    },original);
    await reopened.getByRole('tab',{name:'CAD',exact:true}).click();
    await reopened.waitForFunction(sketchId => {
        const document = window.__bwCad?.editor.session.state.document;
        return document?.roots.length === 1 && document.sketches?.[sketchId]?.profile.kind === 'region';
    },draft.id);
    const savedVolume = await reopened.evaluate(async () => (await window.__bwCad.editor.whenIdle()).bodies[0]?.volume);
    assert.ok(Math.abs(savedVolume - 16920) < .1, `Reopened extrusion volume ${savedVolume} mm³`);
    const fillRules = await reopened.evaluate(() => {
        const {sdk} = window.__bwCad;
        const outer = 'M0 0H40V40H0Z', middle = 'M8 8H32V32H8Z';
        const inner = 'M14 14V26H26V14Z';
        const parse = rule => sdk.readCostumeProfiles('<svg xmlns="http://www.w3.org/2000/svg">' +
            `<path fill-rule="${rule}" d="${outer} ${middle} ${inner}"/></svg>`).profiles.map(profile => profile.loops.length);
        return [parse('nonzero'),parse('evenodd')];
    });
    assert.deepEqual(fillRules,[[1],[2,1]],'Nonzero ignores boundaries inside a still-filled region; even-odd retains an island');
    const repairedHole = await reopened.evaluate(() => {
        const {sdk} = window.__bwCad;
        const source = '<svg xmlns="http://www.w3.org/2000/svg">' +
            '<path fill-rule="evenodd" d="M0 0H40V40H0Z M10 11V20H20V10H10"/></svg>';
        return sdk.readCostumeProfiles(source,{widthMm:40,maxGapMm:1}).profiles.map(profile => ({
            loops: profile.loops.length, repairs: profile.gapRepair?.edges.length
        }));
    });
    assert.deepEqual(repairedHole,[{loops:2,repairs:1}],'A hole uses the scale of its enclosing sketch');
    await reopened.getByRole('tab',{name:'Costumes',exact:true}).click();
    await reopened.evaluate(() => {
        const vm = window.__brickwrightStore.getState().scratchGui.vm;
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="70">' +
            '<path fill-rule="evenodd" transform="translate(10 15) scale(1.1 .8)" ' +
            'd="M0 20Q0 0 25 0C45 0 50 10 50 20Q50 40 25 40Q0 40 0 20Z ' +
            'M15 20A10 5 0 1 1 35 20A10 5 0 1 1 15 20Z"/></svg>';
        vm.updateSvg(0,svg,0,0);
    });
    await reopened.getByTestId('bw-settings-menu-trigger').click();
    await reopened.getByRole('menuitem',{name:'Workspace',exact:true}).getByText('Workspace',{exact:true}).click();
    await reopened.getByRole('combobox',{name:'Costumes precision design',exact:true}).selectOption('1');
    await reopened.getByTestId('bw-costume-precision').click();
    const curves = reopened.getByRole('dialog',{name:'Send to CAD',exact:true});
    await curves.getByText('Enable curve approximation to preview filled curves.',{exact:true}).waitFor();
    const apply = curves.getByRole('button',{name:'Add editable sketch',exact:true});
    assert.equal(await apply.count(),0);
    await curves.getByRole('checkbox',{name:'Approximate curves',exact:true}).check();
    const tolerance = curves.getByLabel('Curve tolerance (mm)',{exact:true});
    await tolerance.fill('0');
    await curves.getByText('Enter a curve tolerance from 0.01 to 10 mm.',{exact:true}).waitFor();
    assert.equal(await apply.count(),0);
    const outline = curves.getByRole('img',{name:'Closed profile preview'}).locator('path');
    await tolerance.fill('1');
    const coarse = await outline.getAttribute('d');
    await tolerance.fill('0.05');
    const fine = await outline.getAttribute('d');
    assert.ok(fine.split(' L ').length > coarse.split(' L ').length);
    assert.match(fine,/Z M /,'Preview has outer contour and hole');
    await apply.click();
    await curves.getByText(/Sketch added to CAD/).waitFor();
    const added = await reopened.evaluate(id => Object.values(window.__bwCad.editor.session.state.document.sketches)
        .find(value => value.id !== id),draft.id);
    assert.equal(added.profile.kind,'region');
    assert.equal(added.profile.loops.length,2);
    assert.ok(added.profile.loops.every(loop => loop.kind === 'outline'));
    assert.equal(added.profile.loops.reduce((count,loop) => count + loop.points.length,0),
        fine.split(' L ').length + 1,'Saved sketch uses the preview vertices');
    await curves.getByRole('button',{name:'Close',exact:true}).click();
    const openArtwork = await reopened.evaluate(() => {
        const vm = window.__brickwrightStore.getState().scratchGui.vm;
        vm.updateSvg(0,'<svg xmlns="http://www.w3.org/2000/svg" width="60" height="24">' +
            '<path d="M0 1V20H20V0H0"/><path d="M30 1L50 20L30 20L50 0L30 0"/></svg>',0,0);
        return vm.editingTarget.getCostumes()[0].assetId;
    });
    await reopened.getByTestId('bw-costume-precision').click();
    await curves.getByText('Close the path in Costumes before importing it.',{exact:true}).waitFor();
    assert.equal(await apply.count(),0);
    const gaps = curves.getByRole('checkbox',{name:'Close small gaps',exact:true});
    assert.equal(await gaps.isChecked(),false);
    await gaps.check();
    const gapLimit = curves.getByLabel('Maximum gap (mm)',{exact:true});
    const gapWidth = curves.getByLabel('Width (mm)',{exact:true});
    const gapWarning = curves.getByText('This outline gap exceeds the maximum at the selected width.',{exact:true});
    await gapWarning.waitFor();
    assert.equal(await apply.count(),0);
    await gapLimit.fill('1');
    await gapWidth.fill('20');
    await curves.getByText('Outline edges must form one closed loop without crossings or overlaps.',{exact:true}).waitFor();
    const closingEdge = curves.getByTestId('bw-costume-closing-edge');
    await closingEdge.waitFor({state:'attached'});
    assert.equal(await closingEdge.count(),1);
    assert.equal(await closingEdge.evaluate(edge => getComputedStyle(edge).stroke),'rgb(155, 47, 0)');
    assert.deepEqual(await closingEdge.evaluate(edge => ['x1','y1','x2','y2'].map(key => Number(edge.getAttribute(key)))),[0,0,0,1]);
    await gapWidth.fill('40');
    await gapWarning.waitFor();
    assert.equal(await closingEdge.count(),0);
    await gapWidth.fill('20');
    await gaps.uncheck();
    assert.equal(await apply.count(),0);
    await gaps.check();
    await apply.click();
    await curves.getByText(/Sketch added to CAD/).waitFor();
    const repaired = await reopened.evaluate(ids => {
        const vm = window.__brickwrightStore.getState().scratchGui.vm;
        const sketch = Object.values(window.__bwCad.editor.session.state.document.sketches).find(value => !ids.includes(value.id));
        return {profile: sketch.profile, assetId: vm.editingTarget.getCostumes()[0].assetId};
    },[draft.id,added.id]);
    assert.equal(repaired.assetId,openArtwork);
    assert.equal(repaired.profile.kind,'outline');
    assert.deepEqual(repaired.profile.points.map(([x,y]) => [x,y]).sort(),[[0,0],[0,19],[0,20],[20,0],[20,20]].sort());
    console.log('PASS exact and approximated profiles, highlighted gap repair at model scale, crossing rejection, extrusion, and SB3 round-trip');
} catch (error) {
    await activePage.screenshot({path:'/tmp/bw-costume-precision-failure.png'}).catch(() => {});
    throw error;
} finally {
    await browser.close();
}
