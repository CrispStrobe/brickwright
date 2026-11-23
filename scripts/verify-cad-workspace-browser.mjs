// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {CAD_ROBOT_EXAMPLES} from '../overlay/scratch-gui/src/lib/bw-cad-robot-catalog.js';

const browser=await chromium.launch({
    executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    headless:true
});
const page=await browser.newPage({viewport:{width:1560,height:900},locale:'en-US',serviceWorkers:'block'});
page.setDefaultTimeout(90000);
await page.addInitScript(()=>{
    localStorage.setItem('bw-starter-v1-complete','1');
    localStorage.setItem('bw-cad-enabled','1');
    localStorage.setItem('bw-right-pane-hidden','1');
});
try {
    await page.goto(process.argv[2] || 'http://127.0.0.1:8227/',{waitUntil:'commit'});
    await page.getByRole('tab',{name:'CAD',exact:true}).click();
    await page.waitForFunction(()=>window.__bwCad?.editor);
    const models=page.getByRole('button',{name:'Model library',exact:true});
    const ribbon=page.locator('[data-bw-project-ribbon]');
    const program=page.getByTestId('bw-cad-program-settings');
    await page.setViewportSize({width:760,height:850});
    await page.waitForFunction(()=>document.querySelector('[data-bw-project-ribbon][data-cad-ribbon-compact]'));
    assert.equal(await program.getByText('Program',{exact:true}).isVisible(),false);
    assert.equal(await program.getAttribute('aria-label'),'Program & connections');
    await page.setViewportSize({width:1560,height:900});
    await page.waitForFunction(()=>!document.querySelector('[data-bw-project-ribbon][data-cad-ribbon-compact]'));
    await program.getByText('Program',{exact:true}).waitFor();
    assert.equal(await ribbon.isVisible(),true);
    console.log('PASS CAD ribbon uses labelled controls at full width and accessible icons when space is limited');

    const controls=page.getByRole('button',{name:'Robot controls',exact:true});
    await controls.click();
    const drawer=page.getByRole('dialog',{name:'Robot controls'});
    await drawer.waitFor();
    await page.getByTestId('bw-editor-help').click();
    const help=page.getByTestId('bw-editor-help-dialog');
    await help.waitFor();
    await page.keyboard.press('Escape');
    await help.waitFor({state:'hidden'});
    assert.equal(await drawer.isVisible(),true);
    await drawer.getByRole('button',{name:'Close program settings'}).click();

    await page.evaluate(()=>__bwCad.editor.executeCommand('front'));
    const canvas=page.getByTestId('cad-canvas');
    const bounds=await canvas.boundingBox();
    const {x,y}={x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2};
    await page.mouse.move(x,y);
    await page.mouse.down({button:'right'});
    await page.mouse.move(x+7,y+7);
    await page.mouse.up({button:'right'});
    const cube=page.getByRole('group',{name:'View cube'});
    const sides=await cube.locator('g[role="button"]').evaluateAll(groups=>groups.filter(group=>
        getComputedStyle(group).display!=='none').map(group=>getComputedStyle(group.querySelector('text')).display));
    assert.ok(sides.includes('none')&&sides.some(display=>display!=='none'),JSON.stringify(sides));
    console.log('PASS near-edge view cube faces keep their hit targets and hide labels that do not fit');

    await models.click();
    const library=page.getByRole('dialog',{name:'Model library'});
    const filter=library.getByLabel('Model type',{exact:true});
    const robots=library.getByRole('button',{name:/Robot project · Includes code$/});
    await filter.selectOption('projects');
    await library.getByText(CAD_ROBOT_EXAMPLES[0].name,{exact:true}).waitFor();
    assert.equal(await robots.count(),CAD_ROBOT_EXAMPLES.length);
    const scout=robots.filter({hasText:'Scout TT rover'});
    await scout.locator('img').waitFor({state:'attached'});
    await page.waitForFunction(()=>{
        const root=document.querySelector('[data-testid="bw-cad-tab"]');
        return Array.from(root?.querySelectorAll('*')||[]).some(host=>
            host.shadowRoot?.querySelector('button.model-library-card img[src^="data:image"]')?.naturalWidth>0);
    });
    await scout.click();
    await library.getByRole('button',{name:'Open Scout TT rover project',exact:true}).waitFor();
    await filter.selectOption('models');
    assert.equal(await robots.count(),0);
    await filter.selectOption('projects');
    await scout.click();
    const launch=library.getByRole('button',{name:'Open Scout TT rover project',exact:true});
    const before=await page.evaluate(()=>__bwCad.editor.session.serialize());
    page.once('dialog',dialog=>dialog.dismiss());
    await launch.click();
    await launch.click({trial:true});
    assert.equal(await page.evaluate(()=>__bwCad.editor.session.serialize()),before);
    page.once('dialog',dialog=>dialog.accept());
    await launch.click();
    await page.waitForFunction(()=>__bwCad.editor.session.state.document.id==='robot-tt-rover');
    await page.getByTestId('bw-cad-robot-controls').waitFor();
    assert.ok(await page.evaluate(()=>{
        const runtime=window.__brickwrightStore.getState().scratchGui.vm.runtime;
        return runtime.controllerPanel.getWidgets().length>=2&&runtime.targets.some(target=>
            Object.values(target.blocks?._blocks||{}).some(block=>block.opcode==='event_whenflagclicked'))&&
            JSON.parse(localStorage.getItem('bw-circuit-autosave')||'null')?.parts.some(part=>part.id==='uno');
    }));
    console.log('PASS one library filters CAD-only models, previews all robot projects, and loads the Scout bundle after confirmation');
} finally {
    await browser.close();
}
