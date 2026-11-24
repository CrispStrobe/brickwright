// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium, firefox, webkit} from 'playwright';

const type = {chromium, firefox, webkit}[process.env.PROOF_BROWSER || 'chromium'];
const browser = await type.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
try {
    const page = await browser.newPage({viewport: {width: 1520, height: 960}, locale: 'en-US', serviceWorkers: 'block'});
    page.setDefaultTimeout(90000);
    await page.addInitScript(() => {
        localStorage.setItem('bw-starter-v1-complete', '1');
        localStorage.setItem('bw-cad-enabled', '1');
    });
    await page.goto(process.argv[2] || 'http://127.0.0.1:8242/', {waitUntil: 'commit'});
    await page.getByRole('tab', {name: 'Costumes', exact: true}).click();
    const workspace = page.getByTestId('bw-paint-workspace');
    const properties = workspace.getByRole('button', {name: 'Show properties', exact: true});
    if (await properties.isVisible()) await properties.click();
    const chooser = page.waitForEvent('filechooser');
    await page.getByTestId('bw-costume-import').click();
    await (await chooser).setFiles({name: 'precision-plate.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 360" width="480" height="360"/>')});
    await page.waitForFunction(() => {
        const vm = window.__brickwrightStore?.getState().scratchGui.vm;
        return vm?.editingTarget.getCostumes()[vm.editingTarget.currentCostume]?.name === 'precision-plate';
    });
    await page.getByTestId('bw-settings-menu-trigger').click();
    const precision = page.getByRole('combobox', {name: 'Costumes precision design', exact: true});
    if (!await precision.isVisible()) await page.getByRole('menuitem', {name: 'Workspace', exact: true}).click();
    await precision.selectOption('1');
    if (await properties.isVisible()) await properties.click();
    await page.getByText('Precision drawing', {exact: true}).click();
    await page.getByLabel('Width', {exact: true}).fill('60');
    await page.getByLabel('Height', {exact: true}).fill('30');
    await page.getByRole('button', {name: 'Add shape', exact: true}).click();
    await page.getByTestId('bw-costume-precision').click();
    const handoff = page.getByRole('dialog', {name: 'Send to CAD', exact: true});
    await handoff.getByLabel('Width (mm)', {exact: true}).fill('60');
    await handoff.getByText(/60 × 30 mm/).waitFor();
    await handoff.getByRole('button', {name: 'Add editable sketch', exact: true}).click();
    await handoff.getByText(/Sketch added to CAD/).waitFor();
    const draft = await page.evaluate(() => Object.values(window.__bwCad.editor.session.state.document.sketches)[0]);
    assert.equal(draft.profile.kind, 'outline');
    const {points} = draft.profile;
    const horizontal = points.findIndex(([x, y], i) => x !== points[(i + 1) % points.length][0] && y === points[(i + 1) % points.length][1]);
    assert.ok(horizontal >= 0);
    const vertical = (horizontal + 1) % points.length, moved = (vertical + 1) % points.length;
    const yDrag = Math.sign(points[moved][1] - points[vertical][1]) * 6;
    assert.ok(yDrag);
    await handoff.getByRole('button', {name: 'Preview extrusion', exact: true}).click();
    const sketch = page.getByRole('dialog', {name: 'Sketch and extrusion', exact: true});
    await sketch.getByText('Outline constraints', {exact: true}).click();
    const kind = sketch.getByLabel('Constraint', {exact: true});
    const edge = sketch.getByLabel('Constrained segment', {exact: true});
    const add = sketch.getByRole('button', {name: 'Add constraint', exact: true});
    for (const [constraint, segment] of [['horizontal', horizontal], ['length', horizontal], ['vertical', vertical]]) {
        await kind.selectOption(constraint);
        await edge.selectOption(String(segment));
        if (constraint === 'length') await sketch.getByLabel('Segment length (mm)', {exact: true}).fill('60');
        await add.click();
    }
    await sketch.getByText('Outline constraints', {exact: true}).click();
    const coordinates = sketch.getByLabel('Outline points X, Y (mm)', {exact: true});
    const vertex = sketch.locator(`[data-resize="vertex"][data-vertex="${moved}"]`);
    const [start, end] = await vertex.evaluate((circle, dy) => {
        const matrix = circle.getScreenCTM(), x = circle.cx.baseVal.value, y = circle.cy.baseVal.value;
        return [new DOMPoint(x, y), new DOMPoint(x, y - dy)].map(point => {
            const {x, y} = point.matrixTransform(matrix);
            return {x, y};
        });
    }, yDrag);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, {steps: 5});
    await page.mouse.up();
    await sketch.getByRole('status', {name: 'Sketch status'}).getByText(/Outline solved/).waitFor();
    const solved = (await coordinates.inputValue()).split('\n').map(row => row.split(',').map(Number));
    assert.ok(Math.abs(solved[moved][1] - points[moved][1]) > 1, 'the drag moved the dimensioned outline');
    assert.ok(Math.abs(Math.abs(solved[horizontal][0] - solved[vertical][0]) - 60) < 1e-4);
    assert.ok(Math.abs(solved[vertical][0] - solved[moved][0]) < 1e-4);
    await sketch.getByLabel('Extrusion distance (mm)', {exact: true}).fill('10');
    await sketch.getByRole('button', {name: 'Create extrusion', exact: true}).click();
    await sketch.waitFor({state: 'hidden'});
    const body = await page.evaluate(async () => {
        const {editor} = window.__bwCad;
        const geometry = await editor.whenIdle();
        return {body: geometry.bodies[0]?.bounds, sketches: Object.values(editor.session.state.document.sketches)};
    });
    assert.ok(Math.abs(body.body.max[2] - body.body.min[2] - 10) < 1e-4);
    assert.equal(body.sketches[0].profile.relations.length, 3);
    await page.getByText('File', {exact: true}).filter({visible: true}).click();
    await page.getByText('Export CAD model…', {exact: true}).filter({visible: true}).click();
    const exported = page.getByRole('dialog', {name: 'Export model', exact: true});
    const download = page.waitForEvent('download');
    await exported.getByRole('button', {name: 'Export', exact: true}).click();
    const file = await download;
    assert.match(file.suggestedFilename(), /\.stl$/i);
    const bytes = await readFile(await file.path());
    const triangles = bytes.readUInt32LE(80);
    assert.ok(triangles > 0);
    assert.equal(bytes.length, 84 + triangles * 50);
    console.log('PASS Costumes precision rectangle → editable dimensioned CAD outline → constrained drag → extrusion → binary STL');
} finally {
    await browser.close();
}
