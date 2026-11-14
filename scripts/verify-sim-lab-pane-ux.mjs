// SPDX-License-Identifier: BSD-3-Clause
// Build the actual notice and pane render methods into a small browser fixture; no VM/physics build.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import fixture from '../test/helpers/sim-lab-pane-ux.cjs';
const {gui, transform, paneClassSource, css, texts} = fixture;
const requireRoot = createRequire(new URL('../package.json', import.meta.url));
const {chromium} = requireRoot('playwright');
const webpack = gui('webpack');
const out = resolve(process.env.BW_UX_EVIDENCE || '.cache/robot-lab-ux-browser'); mkdirSync(out, {recursive: true});
const noticePath = resolve('overlay/scratch-gui/src/components/tw-pseudocode/sim-lab-notice.jsx');
const {readFileSync} = await import('node:fs');
const entry = `const React=require('react');const ReactDOM=require('react-dom');
const Notice=(()=>{const module={exports:{}};const exports=module.exports;${transform(readFileSync(noticePath,'utf8'))};return module.exports.default;})();
const SimLabNotice=Notice;
${transform(paneClassSource)}
const pane=Object.create(SimLabPane.prototype);pane.state={status:'ready',blockers:[],issues:[]};
let compact=false,locale='en';const texts=${JSON.stringify(texts)};pane.compact=()=>compact;
pane.renderIssue=(issue,key)=>React.createElement('li',{key},issue.message||issue.code);
window.update=(options={})=>{compact=options.compact??compact;locale=options.locale||locale;
pane.state.blockers=options.blockers||pane.state.blockers;pane.state.issues=options.issues||pane.state.issues;
pane.itext=texts[locale];pane.text={issues:locale==='de'?'Hinweise zu diesem Modell':'Notes about this model'};
ReactDOM.render(React.createElement('div',{className:'robot-ux-root','data-testid':'bw-sim-lab',style:{padding:12,width:compact?360:760}},
React.createElement('p',{id:'page-label'},'Robot editor text must never be selected by dragging across the pane.'),
React.createElement('canvas',{id:'editor',width:280,height:120,style:{border:'1px solid black'}}),
React.createElement('input',{id:'search',type:'search',defaultValue:'Search robot parts',style:{display:'block',width:280}}),
React.createElement('textarea',{id:'notes',defaultValue:'Editable robot notes',style:{display:'block',width:280}}),
React.createElement('div',{id:'editable',contentEditable:true,suppressContentEditableWarning:true},React.createElement('span',null,'Editable formatted text')),
pane.renderBlockers(),pane.renderIssues()),document.getElementById('fixture'));};window.update();`;
writeFileSync(resolve(out, 'entry.js'), entry);
const compiler = webpack({mode:'development',devtool:false,entry:resolve(out,'entry.js'),output:{path:out,filename:'fixture.js'},
    resolve:{modules:[resolve(gui.resolve('react/package.json'),'../..')]},parallelism:1});
await new Promise((ok,no)=>compiler.run((error,stats)=>{if(error||stats.hasErrors())no(error||new Error(stats.toString({all:false,errors:true})));else{console.log(stats.toString({all:false,timings:true,assets:true}));ok();}}));
await new Promise((ok,no)=>compiler.close(error=>error?no(error):ok()));
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
try {
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>${css.replace(/\.root/g,'.robot-ux-root')}</style><div id="fixture"></div>`);
    await page.addScriptTag({path:resolve(out,'fixture.js')});
    let checks=0;
    for(const compact of [false,true]) {
        await page.evaluate(compact=>window.update({compact}),compact);
        for(const id of ['editor','page-label']) {
            await page.evaluate(()=>window.getSelection().removeAllRanges());const b=await page.locator('#'+id).boundingBox();
            await page.mouse.move(b.x+3,b.y+8);await page.mouse.down();await page.mouse.move(b.x+Math.min(b.width-3,220),b.y+30,{steps:12});await page.mouse.up();
            assert.equal(await page.evaluate(()=>window.getSelection().toString()),'');checks++;
        }
        for(const id of ['search','notes']) {
            const b=await page.locator('#'+id).boundingBox();await page.mouse.move(b.x+5,b.y+8);await page.mouse.down();
            await page.mouse.move(b.x+130,b.y+8,{steps:12});await page.mouse.up();
            const value=await page.locator('#'+id).evaluate(el=>({start:el.selectionStart,end:el.selectionEnd,select:getComputedStyle(el).userSelect}));
            assert.equal(value.select,'text');assert.ok(value.end>value.start,JSON.stringify(value));checks++;
        }
        const editable=page.locator('#editable');await editable.click();await page.keyboard.press('Home');await page.keyboard.down('Shift');await page.keyboard.press('End');await page.keyboard.up('Shift');
        assert.ok((await page.evaluate(()=>window.getSelection().toString())).length>0);checks++;
        assert.deepEqual(await page.locator('[data-testid="bw-sim-lab"]').evaluate(el=>({plain:getComputedStyle(el).userSelect,vendor:getComputedStyle(el).webkitUserSelect})),{plain:'none',vendor:'none'});checks++;
        for(const locale of ['en','de']) for(const kind of ['blockers','issues']) {
            const first=[{code:'no-motor',message:`${locale}-${kind}-${compact}`}];
            await page.evaluate(args=>window.update(args),{locale,[kind]:first});
            const notice=page.locator(`[data-testid="bw-sim-lab-${kind}-notice"]`),close=page.locator(`[data-testid="bw-sim-lab-${kind}-close"]`);
            assert.equal(await notice.isVisible(),true);assert.match(await close.getAttribute('aria-label'),locale==='de'?/^Schließen:/:/^Close:/);
            assert.equal(await close.evaluate(el=>el.closest('summary')===null),true);
            await close.focus();await page.keyboard.press('Enter');assert.equal(await notice.isVisible(),false);
            assert.equal(await page.locator(`[data-testid="bw-sim-lab-${kind}"]`).count(),1,'warning DOM retained');
            await page.evaluate(args=>window.update(args),{[kind]:first});assert.equal(await notice.isVisible(),false);
            await page.evaluate(args=>window.update(args),{[kind]:[{...first[0],message:first[0].message+' changed'}]});assert.equal(await notice.isVisible(),true);
            await close.focus();await page.keyboard.press('Space');assert.equal(await notice.isVisible(),false);checks+=7;
        }
    }
    assert.deepEqual(errors,[]);await page.screenshot({path:resolve(out,'robot-lab-ux.png')});
    writeFileSync(resolve(out,'result.json'),JSON.stringify({passed:true,checks,pageErrors:errors,scope:'Actual notice component and actual pane renderBlockers/renderIssues methods; real Chromium mouse selection and keyboard. Synthetic editor canvas, not full VM/physics GUI.'},null,2));
    console.log(`PASS ${checks} browser checks; no page errors`);
} finally {await browser.close();}
