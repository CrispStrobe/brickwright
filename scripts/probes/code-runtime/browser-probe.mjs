// Real browser qualification on localhost; no application or remote network metric.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {chromium as launcher} from 'playwright-core';
const root=path.dirname(fileURLToPath(import.meta.url));
const args=Object.fromEntries(process.argv.slice(2).map(arg=>{const s=arg.replace(/^--/,'');const p=s.indexOf('=');return p<0?[s,true]:[s.slice(0,p),s.slice(p+1)];}));
if(!/^[0-9a-f]{40}$/.test(args['plan-commit']||''))throw new Error('Pass the pushed initial plan SHA with --plan-commit=<40-character SHA>.');
const engines=(args.engines||'skulpt,micropython,pyodide').split(',');
if(args.mode&&!['standard','isolated-input','all'].includes(args.mode))throw new Error('mode must be standard, isolated-input or all');
const fixtures=JSON.parse(await fs.readFile(path.join(root,'fixtures.json'),'utf8'));
let executablePath=args.browser;
let browserArgs=['--no-sandbox'];
let browserDistribution='caller-provided executable';
if(!executablePath){
  const {default:chromium}=await import('@sparticuz/chromium');
  executablePath=await chromium.executablePath();
  // The distribution defaults disable web security and force-enable SAB. Remove
  // those flags so the non-isolated fixture actually exercises normal web limits.
  browserArgs=chromium.args.filter(arg=>!/^--(?:enable-features|disable-features|allow-running-insecure-content|disable-site-isolation-trials|disable-web-security)(?:=|$)/.test(arg));
  browserDistribution='@sparticuz/chromium 158.0.0 (serverless Linux Chromium); security-disabling and SAB-enable flags removed';
}
const browser=await launcher.launch({executablePath,args:browserArgs,headless:true});
const report={schema:1,createdAt:new Date().toISOString(),planCommit:args['plan-commit'],brickwrightHead:args['brickwright-head']||'14de1c42bd2e2ea84086a2162d1eff1fdbbac20d',environment:{kind:'headless real browser; localhost HTTP',browserVersion:browser.version(),browserDistribution,browserArgs,node:process.version,platform:process.platform,arch:process.arch,cpuModel:os.cpus()[0]?.model,cpus:os.cpus().length},protocol:{startupSamples:3,warmRepeats:5,startupBudgetMs:30000,fixtureBudgetMs:5000,hardStopDelayMs:200,hardStopQuietWindowMs:200,outputBudgetBytes:1024*1024,startupMeaning:'fresh worker/runtime, already-installed runtime files served from localhost; browser/OS caches may be warm; not cold network, device launch or app-ready latency',sharedInputMeaning:'only separately tested with COOP same-origin and COEP require-corp; standard run intentionally has no SharedArrayBuffer',memoryMeaning:'browser memory/peak RSS not measured',stopMeaning:'parent event-loop heartbeat and hard Worker.terminate with fresh restart; browser terminate returns void, so no physical termination-completion latency measured',bridgeMeaning:'mock arithmetic/sensor and explicit async ask only; no actual app/simulator bridge'},coverage:{desktopServerChromium:'measured',windows:'pending',macos:'pending',linuxWebView:'pending',android:'pending',ios:'pending',safari:'pending',firefox:'pending',offlineBrowser:'pending',realNetwork:'pending',stateIsolation:'pending',outputCapEnforcement:'pending',inputCancellation:'pending',generatedPrograms:'pending',realSimulatorBridge:'pending',gracefulInterrupt:'pending; hard termination only'},sourceHashes:{},runs:[]};
for(const file of ['package-lock.json','fixtures.json','engine-worker.mjs','browser-page.mjs','browser-probe.mjs'])report.sourceHashes[file]=crypto.createHash('sha256').update(await fs.readFile(path.join(root,file))).digest('hex');
const mime={'.mjs':'text/javascript','.js':'text/javascript','.wasm':'application/wasm','.json':'application/json','.zip':'application/zip'};
try{
  for(const isolated of args.mode==='standard'?[false]:args.mode==='isolated-input'?[true]:[false,true]){
    const requests=[];
    const server=http.createServer(async(req,res)=>{
      if(isolated){res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');}
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta charset="utf-8"><title>Brickwright runtime probe</title><p>Bounded worker runtime probe</p>');return;}
      const target=path.resolve(root,'.'+pathname);
      if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
      try{const data=await fs.readFile(target);res.setHeader('Content-Type',mime[path.extname(target)]||'application/octet-stream');res.setHeader('Cache-Control','public, max-age=3600');requests.push({path:pathname,bytes:data.length});res.end(data);}catch{res.writeHead(404);res.end();}
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const context=await browser.newContext();const page=await context.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(String(error)));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    try{
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      const observed=await page.evaluate(async(config)=>{const {runProbe}=await import('/browser-page.mjs');return runProbe(config);},{engines,fixtures,mode:isolated?'isolated-input':'standard'});
      report.runs.push({...observed,servedRequests:requests,pageErrors:errors});
      console.log(`${isolated?'isolated stdin':'standard'} browser run complete`);
    }finally{await context.close();await new Promise(resolve=>server.close(resolve));}
  }
}finally{await browser.close();}
await fs.writeFile(path.resolve(root,args.output||'results-browser.json'),JSON.stringify(report,null,2)+'\n');
console.log(`Saved ${args.output||'results-browser.json'}`);
