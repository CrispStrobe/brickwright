// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    headless: true
});
const page = await browser.newPage({viewport:{width:1520,height:960},locale:'en-US',serviceWorkers:'block'});
page.setDefaultTimeout(25000);
const sdkRequests = [];
page.on('request',request => {
    if (request.url().includes('/static/cad-sdk/')) sdkRequests.push(request.url());
});
await page.addInitScript(() => {
    localStorage.setItem('bw-starter-v1-complete','1');
    localStorage.setItem('bw-cad-enabled','1');
});
const summary = page.getByText('Precision drawing',{exact:true});
const workspace = page.getByTestId('bw-paint-workspace');
const selectedBounds = () => page.evaluate(() => {
    const items = window.__brickwrightStore.getState().scratchPaint.selectedItems;
    const bounds = items[0]?.bounds;
    return {count:items.length,kind:items[0]?.className,box:bounds && [bounds.x,bounds.y,bounds.width,bounds.height]};
});
const selectedStroke = () => page.evaluate(() => {
    const shape = window.__brickwrightStore.getState().scratchPaint.selectedItems[0];
    return {closed:shape.closed,stroke:shape.strokeWidth,cap:shape.strokeCap,
        points:shape.segments.map(segment => [segment.point.x,segment.point.y]),hasCurves:shape.hasHandles()};
});
const artwork = () => page.evaluate(() => {
    const vm = window.__brickwrightStore.getState().scratchGui.vm;
    const costume = vm.editingTarget.getCostumes()[vm.editingTarget.currentCostume];
    const svg = new DOMParser().parseFromString(costume.asset.decodeText(),'image/svg+xml');
    return {assetId:costume.assetId,circles:Array.from(svg.querySelectorAll('circle'),item => Number(item.getAttribute('r'))),
        paths:svg.querySelectorAll('path').length};
});
const waitForCircles = count => page.waitForFunction(expected => {
    const vm = window.__brickwrightStore.getState().scratchGui.vm;
    const costume = vm.editingTarget.getCostumes()[vm.editingTarget.currentCostume];
    return new DOMParser().parseFromString(costume.asset.decodeText(),'image/svg+xml')
        .querySelectorAll('circle').length === expected;
},count);
const togglePrecision = async value => {
    await page.getByTestId('bw-settings-menu-trigger').click();
    const preference = page.getByRole('combobox',{name:'Costumes precision design',exact:true});
    if (!await preference.isVisible()) {
        await page.getByRole('menuitem',{name:'Workspace',exact:true}).getByText('Workspace',{exact:true}).click();
    }
    await preference.selectOption(value);
};
try {
    await page.goto(process.argv[2] || 'http://127.0.0.1:8235/',{waitUntil:'commit'});
    await page.getByRole('tab',{name:'Costumes',exact:true}).click();
    await workspace.waitFor();
    const showProperties = workspace.getByRole('button',{name:'Show properties',exact:true});
    if (await showProperties.isVisible()) await showProperties.click();
    await workspace.getByRole('button',{name:'Hide properties',exact:true}).waitFor();
    assert.equal(await summary.count(),0);
    const chooser = page.waitForEvent('filechooser');
    await page.getByTestId('bw-costume-import').click();
    await (await chooser).setFiles({name:'precision-fixture.svg',mimeType:'image/svg+xml',buffer:Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 360" width="480" height="360"/>')});
    await page.waitForFunction(() => {
        const vm = window.__brickwrightStore?.getState().scratchGui.vm;
        return vm?.editingTarget.getCostumes()[vm.editingTarget.currentCostume]?.name === 'precision-fixture';
    });
    await togglePrecision('1');
    await summary.click();
    await page.getByLabel('Center X',{exact:true}).fill('12.5');
    await page.getByLabel('Center Y',{exact:true}).fill('-7.25');
    const add = page.getByRole('button',{name:'Add shape',exact:true});
    await page.getByLabel('Width',{exact:true}).fill('0');
    assert.equal(await add.isDisabled(),true);
    await page.getByLabel('Width',{exact:true}).fill('60');
    await page.getByLabel('Height',{exact:true}).fill('30');
    await add.click();
    assert.deepEqual(await selectedBounds(),{count:1,kind:'Path',box:[445,315.5,120,60]});
    assert.deepEqual((await artwork()).circles,[]);
    assert.equal((await artwork()).paths,1);

    await page.getByLabel('Shape',{exact:true}).selectOption('circle');
    await page.getByLabel('Center X',{exact:true}).fill('-80');
    await page.getByLabel('Center Y',{exact:true}).fill('50');
    await page.getByLabel('Diameter',{exact:true}).fill('25');
    await add.click();
    assert.deepEqual(await selectedBounds(),{count:1,kind:'Path',box:[295,435,50,50]});
    assert.deepEqual((await artwork()).circles,[12.5]);
    await workspace.getByRole('button',{name:'Undo',exact:true}).click();
    await waitForCircles(0);
    assert.deepEqual((await artwork()).circles,[]);
    assert.equal((await artwork()).paths,1);
    await workspace.getByRole('button',{name:'Redo',exact:true}).click();
    await waitForCircles(1);
    assert.deepEqual((await artwork()).circles,[12.5]);
    await page.getByLabel('Shape',{exact:true}).selectOption('line');
    await page.getByLabel('Start X',{exact:true}).fill('-20');
    await page.getByLabel('Start Y',{exact:true}).fill('-10');
    await page.getByLabel('End X',{exact:true}).fill('40');
    await page.getByLabel('End Y',{exact:true}).fill('10');
    await page.getByLabel('Stroke width',{exact:true}).fill('4');
    await add.click();
    assert.deepEqual(await selectedStroke(),{closed:false,stroke:8,cap:'round',points:[[440,340],[560,380]],hasCurves:false});

    await page.getByLabel('Shape',{exact:true}).selectOption('arc');
    await page.getByLabel('Center X',{exact:true}).fill('80');
    await page.getByLabel('Center Y',{exact:true}).fill('-30');
    await page.getByLabel('Radius',{exact:true}).fill('22');
    await page.getByLabel('Start angle (°)',{exact:true}).fill('30');
    await page.getByLabel('Sweep (°)',{exact:true}).fill('360');
    assert.equal(await add.isDisabled(),true);
    await page.getByLabel('Sweep (°)',{exact:true}).fill('-225');
    await page.getByLabel('Stroke width',{exact:true}).fill('2');
    await add.click();
    const arc = await selectedStroke();
    assert.equal(arc.closed,false);
    assert.equal(arc.stroke,4);
    assert.equal(arc.hasCurves,true);
    assert.deepEqual(arc.points.map(point => point.map(value => Number(value.toFixed(3)))),
        [[678.105,322],[684,300],[640,256],[596,300],[597.499,311.388]]);
    assert.equal(sdkRequests.length,0,'Drawing does not load the CAD SDK');

    const authored = await artwork();
    await page.getByTestId('bw-costume-precision').click();
    const handoff = page.getByRole('dialog',{name:'Send to CAD',exact:true});
    const region = handoff.getByLabel('Region',{exact:true});
    const alert = handoff.getByRole('alert');
    await region.or(alert).waitFor();
    assert.equal(await alert.count(),0,await alert.count() ? await alert.innerText() : 'The authored SVG imports');
    assert.equal(await region.locator('option').count(),2);
    await handoff.getByText(/40 × 20 mm/).waitFor();
    await region.selectOption('1');
    await handoff.getByText(/40 × 40 mm/).waitFor();
    await handoff.getByRole('button',{name:'Add editable sketch',exact:true}).click();
    await handoff.getByText(/Sketch added to CAD/).waitFor();
    const profile = await page.evaluate(() => Object.values(window.__bwCad.editor.session.state.document.sketches)[0].profile);
    assert.equal(profile.kind,'circle');
    assert.equal(profile.radius,20);
    assert.equal((await artwork()).assetId,authored.assetId);
    await handoff.getByRole('button',{name:'Close',exact:true}).click();
    await page.getByTestId('bw-costume-precision').click();
    await handoff.getByLabel('Profile source',{exact:true}).selectOption('stroke');
    await handoff.getByText('Enable curve approximation to preview curved strokes.',{exact:true}).waitFor();
    assert.equal(await region.locator('option').count(),1);
    await handoff.getByRole('checkbox',{name:'Approximate curves',exact:true}).check();
    assert.equal(await region.locator('option').count(),2);
    await region.selectOption('1');
    await handoff.getByRole('button',{name:'Add editable sketch',exact:true}).click();
    await handoff.getByText(/Sketch added to CAD/).waitFor();
    const arcSketch = await page.evaluate(() => Object.values(window.__bwCad.editor.session.state.document.sketches).at(-1).profile);
    assert.equal(arcSketch.kind,'outline');
    assert.ok(arcSketch.points.length > 12);
    assert.equal((await artwork()).assetId,authored.assetId);
    await handoff.getByRole('button',{name:'Close',exact:true}).click();
    await page.getByTestId('bw-costume-precision').click();
    await handoff.getByLabel('Profile source',{exact:true}).selectOption('centerline');
    const pathChoice = handoff.getByLabel('Path',{exact:true});
    assert.equal(await pathChoice.locator('option').count(),2);
    const pathPreview = handoff.getByRole('img',{name:'Open path preview',exact:true}).locator('path');
    assert.match(await pathPreview.getAttribute('d'),/^M .+ L .+$/);
    assert.equal(await pathPreview.evaluate(node => getComputedStyle(node).fill),'none');
    await pathChoice.selectOption({value:'1'});
    await handoff.locator('path[d*=" A "]').waitFor();
    assert.equal((await pathPreview.getAttribute('d')).split(' A ').length,5);
    await handoff.getByLabel('Span (mm)',{exact:true}).fill('88');
    await handoff.getByRole('checkbox',{name:'Link to this costume or backdrop',exact:true}).check();
    await handoff.getByRole('button',{name:'Add editable sketch',exact:true}).click();
    await handoff.getByText(/Sketch added to CAD/).waitFor();
    const centerline = await page.evaluate(() => Object.values(window.__bwCad.editor.session.state.document.sketches).at(-1));
    assert.equal(centerline.profile.kind,'path');
    assert.match(centerline.artworkProfile.sourceKey,/^paper:[0-9a-f-]{36}$/);
    assert.equal(centerline.profile.points.length,5);
    assert.equal(centerline.profile.bulges.at(-1),0);
    assert.ok(centerline.profile.bulges.slice(0,-1).every(value => value > 0));
    assert.equal((await artwork()).assetId,authored.assetId);
    await handoff.getByRole('button',{name:'Close',exact:true}).click();
    await page.getByTestId('bw-costume-precision').click();
    await handoff.getByRole('button',{name:'Update an existing sketch…',exact:true}).click();
    await handoff.getByLabel('Target sketch',{exact:true}).locator('option:checked',{hasText:'linked'}).waitFor({state:'attached'});
    assert.equal(await handoff.getByLabel('Profile source',{exact:true}).inputValue(),'centerline');
    assert.equal(await pathChoice.inputValue(),'1');
    assert.equal(await handoff.getByLabel('Span (mm)',{exact:true}).inputValue(),'88');
    await handoff.getByRole('button',{name:'Close',exact:true}).click();
    await togglePrecision('0');
    await summary.waitFor({state:'detached'});
    assert.equal((await artwork()).assetId,authored.assetId);

    await page.getByText('File',{exact:true}).click();
    const download = page.waitForEvent('download');
    await page.getByText('Save to your computer',{exact:true}).click();
    const file = await readFile(await (await download).path());
    const restored = await browser.newPage({viewport:{width:1520,height:960},locale:'en-US',serviceWorkers:'block'});
    await restored.addInitScript(() => {
        localStorage.setItem('bw-starter-v1-complete','1');
        localStorage.setItem('bw-cad-enabled','1');
    });
    await restored.goto(process.argv[2] || 'http://127.0.0.1:8235/',{waitUntil:'commit'});
    await restored.getByText('File',{exact:true}).click();
    await restored.getByText('Load from your computer',{exact:true}).click();
    await restored.locator('body > input[type="file"][accept*=".sb3"]').setInputFiles({
        name:'costume-precision-drawing.sb3',mimeType:'application/x.scratch.sb3',buffer:file
    });
    await restored.getByRole('tab',{name:'Costumes',exact:true}).click();
    await restored.getByTestId('bw-paint-workspace').waitFor();
    await restored.waitForFunction(assetId => {
        const vm = window.__brickwrightStore?.getState().scratchGui.vm;
        return vm?.editingTarget.getCostumes().some(costume => costume.assetId === assetId);
    },authored.assetId);
    await restored.getByRole('tab',{name:'CAD',exact:true}).click();
    await restored.getByRole('button',{name:`Sketch path: ${centerline.name}`,exact:true}).click();
    await restored.getByRole('dialog',{name:'Sketch path',exact:true}).waitFor();
    const savedSketch = await restored.evaluate(id => window.__bwCad.editor.session.state.document.sketches[id],centerline.id);
    assert.deepEqual(savedSketch,centerline);
    console.log('PASS precision drawing, undo/redo, native CAD centerlines and stroke outlines, and SB3 reopen');
} catch (error) {
    await page.screenshot({path:'/tmp/bw-costume-precision-drawing-failure.png'}).catch(() => {});
    throw error;
} finally {
    await browser.close();
}
