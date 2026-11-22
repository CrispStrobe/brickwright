// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const [url]=process.argv.slice(2);
if(!url)throw Error('Usage: node scripts/verify-cad-command-palette-browser.mjs <app-url>');
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});

async function open(){
 const page=await browser.newPage({viewport:{width:1024,height:768},hasTouch:true,serviceWorkers:'block',acceptDownloads:true});
 page.setDefaultTimeout(60000);
 await page.addInitScript(()=>{
  localStorage.setItem('bw-starter-v1-complete','1');
  localStorage.setItem('bw-cad-enabled','1');
  Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false});
 });
 await page.goto(url);
 await page.getByRole('tab',{name:'CAD',exact:true}).tap();
 await page.waitForFunction(()=>window.__bwCad?.editor);
 return page;
}
try{
 const page=await open();
 const button=page.getByRole('button',{name:'Command palette',exact:true});
 const dialog=page.getByRole('dialog',{name:'Command palette'});
 const search=dialog.getByRole('combobox',{name:'Search CAD commands'});
 await button.tap();
 await search.fill('bolt circle');
 assert.equal(await dialog.getByRole('status').textContent(),'No available commands match');
 await search.fill('shaft');
 await dialog.getByRole('option',{name:'Revolve',exact:true}).tap();
 const revolution=page.getByRole('dialog',{name:'Sketch and revolution'});
 await revolution.getByRole('button',{name:'Create revolution'}).tap();
 await revolution.waitFor({state:'hidden'});
 await page.evaluate(()=>window.__bwCad.editor.whenIdle());

 await button.tap();
 await search.fill('bolt circle');
 await dialog.getByRole('option',{name:'Pattern body',exact:true}).tap();
 const pattern=page.getByRole('dialog',{name:'Pattern body'});
 await pattern.waitFor({state:'visible'});
 await pattern.getByRole('button',{name:'Close pattern'}).tap();

 await button.focus();
 await page.keyboard.press('Control+Shift+P');
 await dialog.waitFor({state:'visible'});
 await search.fill('view');
 await page.keyboard.press('ArrowDown');
 assert.equal(await dialog.getByRole('option').nth(1).getAttribute('aria-selected'),'true');
 await page.keyboard.press('Enter');
 await dialog.waitFor({state:'hidden'});
 console.log('PASS Brickwright command palette touch and keyboard dispatch with selection-aware results');
}finally{
 await browser.close();
}
