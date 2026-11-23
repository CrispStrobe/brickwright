// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, headless: true
});
const url = process.argv[2] || 'http://127.0.0.1:8238/';
const createPage = async () => {
    const page = await browser.newPage({viewport:{width:1520,height:960},locale:'en-US',serviceWorkers:'block'});
    page.setDefaultTimeout(30000);
    await page.addInitScript(() => {
        localStorage.setItem('bw-starter-v1-complete','1');
        localStorage.setItem('bw-cad-enabled','1');
        localStorage.setItem('bw-costume-precision','1');
    });
    return page;
};
const page = await createPage();
let activePage = page;
const changeArtwork = (height,index=0) => page.evaluate(({height,index}) => {
    const vm = window.__brickwrightStore.getState().scratchGui.vm;
    vm.updateSvg(index,`<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><path d="M0 0H40V${height}H0Z"/></svg>`,0,0);
    return vm.editingTarget.getCostumes()[index].assetId;
},{height,index});
const model = target => target.evaluate(async () => {
    const {editor} = window.__bwCad;
    const body = (await editor.whenIdle()).bodies[0];
    const {revision,document} = editor.session.state;
    return {revision,sketch:Object.values(document.sketches)[0],root:document.roots[0],volume:body?.volume,bounds:body?.bounds};
});
const open = () => page.getByTestId('bw-costume-precision').click();
const dialog = page.getByRole('dialog',{name:'Send to CAD',exact:true});
const close = () => dialog.getByRole('button',{name:'Close',exact:true}).click();
const bounds = value => [value.min,value.max].map(point => point.map(axis => Number(axis.toFixed(3)) || 0));
try {
    await page.goto(url,{waitUntil:'commit'});
    await page.getByRole('tab',{name:'Costumes',exact:true}).click();
    await page.getByTestId('bw-costume-export').waitFor();
    await changeArtwork(20);
    await open();
    await dialog.getByLabel('Sketch plane',{exact:true}).selectOption('YZ');
    await dialog.getByText('Placement',{exact:true}).click();
    await dialog.getByLabel('Y (mm)',{exact:true}).fill('10');
    await dialog.getByLabel('Z (mm)',{exact:true}).fill('-20');
    const link = dialog.getByRole('checkbox',{name:'Link to this costume or backdrop',exact:true});
    assert.equal(await link.isChecked(),false);
    await link.check();
    await dialog.getByRole('button',{name:'Add editable sketch',exact:true}).click();
    await dialog.getByText(/Sketch added to CAD/).waitFor();
    await close();
    await page.getByRole('tab',{name:'CAD',exact:true}).click();
    const seed = await model(page);
    await page.getByRole('button',{name:`Extrude sketch: ${seed.sketch.name}`,exact:true}).click();
    const extrusion = page.getByRole('dialog',{name:'Sketch and extrusion'});
    await extrusion.getByRole('button',{name:'Create extrusion',exact:true}).click();
    await extrusion.waitFor({state:'hidden'});
    const before = await model(page);
    assert.match(before.sketch.artworkSourceId,/^[0-9a-f-]{36}$/);
    assert.equal(Math.round(before.volume),8000);
    assert.deepEqual(bounds(before.bounds),[[0,10,-20],[10,50,0]]);

    await page.getByRole('tab',{name:'Costumes',exact:true}).click();
    await page.evaluate(() => {
        const vm = window.__brickwrightStore.getState().scratchGui.vm;
        vm.renameCostume(0,'Linked source');
        vm.reorderCostume(vm.editingTarget.id,0,1);
    });
    const updatedAsset = await changeArtwork(30,1);
    await page.getByText('Linked source',{exact:true}).filter({visible:true}).first().click();
    await page.waitForFunction(() => {
        const vm = window.__brickwrightStore.getState().scratchGui.vm;
        return vm.editingTarget.getCostumes()[vm.editingTarget.currentCostume]?.name === 'Linked source';
    });
    assert.deepEqual(await model(page),before);
    await open();
    await dialog.getByText(/40 × 30 mm/).waitFor();
    const review = async () => {
        await dialog.getByRole('button',{name:'Update an existing sketch…',exact:true}).click();
        const target = dialog.getByLabel('Target sketch',{exact:true});
        await target.locator('option:checked',{hasText:'linked'}).waitFor({state:'attached'});
        assert.equal(await target.inputValue(),before.sketch.id);
        assert.equal(await dialog.getByLabel('Sketch plane',{exact:true}).inputValue(),'YZ');
        assert.equal(await dialog.getByLabel('Sketch plane',{exact:true}).isDisabled(),true);
        await dialog.getByRole('button',{name:'Preview update',exact:true}).click();
        const overlay = dialog.getByRole('img',{name:'Current and proposed sketch',exact:true});
        await overlay.waitFor();
        const previews = await overlay.locator('path').evaluateAll(paths => paths.map(path => path.getAttribute('d')));
        assert.equal(previews.length,2);
        assert.notEqual(previews[0],previews[1]);
        await dialog.getByText('Affected solids (1)',{exact:true}).waitFor();
        assert.deepEqual(await model(page),before);
    };
    await review();
    await dialog.getByRole('button',{name:'Cancel update',exact:true}).click();
    assert.deepEqual(await model(page),before);
    await review();
    await dialog.getByRole('button',{name:'Apply sketch update',exact:true}).click();
    await dialog.getByText('CAD sketch updated.',{exact:true}).waitFor();
    const after = await model(page);
    assert.equal(Math.round(after.volume),12000);
    assert.deepEqual(bounds(after.bounds),[[0,10,-20],[10,50,10]]);
    assert.equal(after.sketch.id,before.sketch.id);
    assert.equal(after.sketch.profile.id,before.sketch.profile.id);
    assert.equal(after.root,before.root);
    assert.equal(after.revision,before.revision+1);
    await close();
    await page.evaluate(() => window.__bwCad.editor.session.undo());
    assert.equal(Math.round((await model(page)).volume),8000);
    await page.evaluate(() => window.__bwCad.editor.session.redo());
    assert.equal(Math.round((await model(page)).volume),12000);

    await page.getByText('File',{exact:true}).click();
    const download = page.waitForEvent('download');
    await page.getByText('Save to your computer',{exact:true}).click();
    const saved = await readFile(await (await download).path());
    const reopened = await createPage();
    activePage = reopened;
    await reopened.goto(url,{waitUntil:'commit'});
    await reopened.getByText('File',{exact:true}).click();
    await reopened.getByText('Load from your computer',{exact:true}).click();
    await reopened.locator('body > input[type="file"][accept*=".sb3"]').setInputFiles({
        name:'costume-sketch-refresh.sb3',mimeType:'application/x.scratch.sb3',buffer:saved
    });
    await reopened.waitForFunction(assetId => window.__brickwrightStore?.getState().scratchGui.vm.runtime.targets
        .some(target => target.sprite.costumes.some(costume => costume.assetId === assetId)),updatedAsset);
    await reopened.getByRole('tab',{name:'CAD',exact:true}).click();
    await reopened.waitForFunction(id => Boolean(window.__bwCad?.editor.session.state.document.sketches?.[id]),before.sketch.id);
    const restored = await model(reopened);
    assert.deepEqual(restored.sketch,after.sketch);
    assert.equal(restored.root,after.root);
    assert.deepEqual(bounds(restored.bounds),bounds(after.bounds));
    await reopened.getByRole('tab',{name:'Costumes',exact:true}).click();
    await reopened.getByText('Linked source',{exact:true}).filter({visible:true}).first().click();
    await reopened.waitForFunction(() => {
        const vm = window.__brickwrightStore.getState().scratchGui.vm;
        return vm.editingTarget.getCostumes()[vm.editingTarget.currentCostume]?.name === 'Linked source';
    });
    await reopened.getByTestId('bw-costume-precision').click();
    const reopenedDialog = reopened.getByRole('dialog',{name:'Send to CAD',exact:true});
    await reopenedDialog.getByRole('button',{name:'Update an existing sketch…',exact:true}).click();
    const reopenedTarget = reopenedDialog.getByLabel('Target sketch',{exact:true});
    await reopenedTarget.locator('option:checked',{hasText:'linked'}).waitFor({state:'attached'});
    assert.equal(await reopenedTarget.inputValue(),after.sketch.id);
    await reopenedDialog.getByRole('button',{name:'Cancel update',exact:true}).click();
    assert.equal(Math.round((await model(reopened)).volume),12000);
    console.log('PASS persistent costume link, rename/reorder, explicit refresh, Undo/Redo, and SB3 reopen');
} catch (error) {
    await activePage.screenshot({path:'/tmp/bw-costume-refresh-failure.png'}).catch(() => {});
    throw error;
} finally {
    await browser.close();
}
