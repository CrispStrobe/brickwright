// SPDX-License-Identifier: BSD-3-Clause
// Exercise the real Robots viewport without building the full Scratch shell.
// node scripts/verify-robot-box-selection.mjs
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname, resolve, extname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const guiRequire = createRequire(resolve(root, 'packages/scratch-gui/package.json'));
const threeRoot = resolve(dirname(guiRequire.resolve('three')), '..');
const html = `<!doctype html><style>body{margin:0}#view{position:relative;width:1000px;height:700px}</style>
<div id="view"></div><script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module">
import {createEditor} from '/overlay/scratch-gui/src/lib/bw-sim/editor/editor-state.js';
import {createEditorView3D} from '/overlay/scratch-gui/src/lib/bw-sim/editor/editor-view3d.js';
const {parts} = await fetch('/overlay/scratch-gui/src/lib/bw-sim/part-meta/parts.json').then(r=>r.json());
const catalog = new Map(parts.map(p=>[p.part,p]));
const rotation=[1,0,0,0,1,0,0,0,1];
const model={version:1,parts:[-220,0,220].map((x,i)=>({id:'abc'[i],part:'32524.dat',position:[x,0,0],rotation:rotation.slice(),color:71}))};
window.editor=createEditor({model,catalog});
// Original rectangular fixture faces; catalog colliders still drive picking.
const vertices=[[-50,-10,-10],[-50,-10,10],[-50,10,-10],[-50,10,10],[50,-10,-10],[50,-10,10],[50,10,-10],[50,10,10]];
const faces=[[0,4,6,2],[1,3,7,5],[0,1,5,4],[2,6,7,3],[0,2,3,1],[4,5,7,6]];
const geometry='0 Selection fixture\\n'+faces.map(f=>'4 16 '+f.flatMap(i=>vertices[i]).join(' ')).join('\\n');
window.v=createEditorView3D({container:document.querySelector('#view'),read:()=>geometry,colors:new Map([[16,{value:'#888888',edge:'#333333'}],[71,{value:'#888888',edge:'#333333'}]]),catalog,editor});
v.canvas.addEventListener('pointerdown',e=>window.pointerId=e.pointerId,true);
v.view('top');const draw=()=>{v.render();requestAnimationFrame(draw)};draw();
window.ready=true;
</script>`;
const server = createServer(async (req, res) => {
    try {
        if (req.url === '/') {res.setHeader('Content-Type','text/html');res.end(html);return;}
        const url = new URL(req.url, 'http://localhost');
        const base = url.pathname.startsWith('/three/') ? threeRoot : root;
        const relative = decodeURIComponent(url.pathname.replace(/^\/three\//, '/')).slice(1);
        const path = resolve(base, relative);
        if (!path.startsWith(base + sep)) {res.writeHead(403).end();return;}
        res.setHeader('Content-Type', extname(path)==='.json'?'application/json':'text/javascript');
        res.end(await readFile(path));
    } catch (error) {res.writeHead(404).end(String(error));}
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const browser = await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
    const page = await browser.newPage({viewport:{width:1100,height:800}}), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(()=>window.ready);
    await page.waitForTimeout(300);
    const selected=()=>page.evaluate(()=>v.selection.slice().sort());
    const center=id=>page.evaluate(id=>v.toScreen(v.debugPoint(id)),id);
    const drag=async(a,b,{shift=false,cancel=false}={})=>{
        await page.mouse.move(...a);if(shift)await page.keyboard.down('Shift');
        await page.mouse.down();await page.mouse.move(...b,{steps:8});
        assert.equal(await page.getByTestId('bw-sim-lab-box-select').isVisible(),true);
        if(cancel==='pointer')await page.evaluate(()=>v.canvas.dispatchEvent(new PointerEvent('pointercancel',{pointerId:window.pointerId,pointerType:'mouse'})));
        else if(cancel==='blur')await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
        else if(cancel)await page.keyboard.press('Escape');
        await page.mouse.up();if(shift)await page.keyboard.up('Shift');
    };
    const a=await center('a'), b=await center('b');
    const around=p=>[[p[0]-70,p[1]-50],[p[0]+70,p[1]+50]];
    const camera=await page.evaluate(()=>v.camera);
    await page.evaluate(()=>v.select(['c']));
    await drag(...around(a));assert.deepEqual(await selected(),['a']);
    await drag(...around(b),{shift:true});assert.deepEqual(await selected(),['a','b']);
    await drag(...around(a).reverse());assert.deepEqual(await selected(),['a']);
    await drag(...around(b),{cancel:true});assert.deepEqual(await selected(),['a']);
    assert.equal(await page.getByTestId('bw-sim-lab-box-select').isVisible(),false);
    for(const cancel of ['pointer','blur']){await drag(...around(b),{cancel});assert.deepEqual(await selected(),['a']);}
    // The left edge overlaps the part, but the rectangle excludes its center.
    await page.evaluate(()=>v.select([]));
    await drag([a[0]-70,a[1]-40],[a[0]-20,a[1]+40]);assert.deepEqual(await selected(),['a']);
    assert.deepEqual(await page.evaluate(()=>v.camera),camera);
    assert.equal(await page.evaluate(()=>editor.canUndo),false);
    await page.mouse.click(30,30);assert.deepEqual(await selected(),[]);
    await page.mouse.move(30,30);await page.mouse.down({button:'middle'});await page.mouse.move(90,70,{steps:8});await page.mouse.up({button:'middle'});
    assert.notDeepEqual(await page.evaluate(()=>v.camera),camera);
    await page.evaluate(()=>v.view('top'));await page.waitForTimeout(300);
    await page.evaluate(()=>{v.select(['b']);v.hideSelection();});
    await drag([20,20],[850,660]);assert.deepEqual(await selected(),['a','c']);
    await page.evaluate(()=>{v.showAll();v.select(['a','b']);v.groupSelection();v.select([]);});
    await drag(...around(a));assert.deepEqual(await selected(),['a','b']);
    assert.equal(await page.evaluate(()=>editor.canUndo),true); // grouping only
    assert.deepEqual(errors,[]);
    console.log('PASS Robots: visible rectangle, replace/add, reverse/edge selection, Escape/cancel/blur, camera/history, hidden parts and groups');
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
