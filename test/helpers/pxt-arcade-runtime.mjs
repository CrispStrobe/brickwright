// Execute authored synchronous-top-level fixtures in the complete pinned
// Arcade simulator, including its own class dispatch and fiber scheduler.
import fs from 'node:fs';
import path from 'node:path';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
import {compile,STATIC} from '../../scripts/lib/pxt-node.mjs';
import {withExclusiveBoot} from './exclusive-boot-lock.mjs';
import {preparePxtInitialClock,assertPxtInitialClock,bootstrapPxtProfilerClock} from './pxt-initial-clock.mjs';

// Self-contained for browser serialization. Observe actual presentation, not
// requested pixels or main/global completion, which can precede the first frame.
export function observePxtDisplay(sim = globalThis.pxsim) {
    const api = sim?.pxtcore, original = api?.updateScreen;
    if (typeof original !== 'function' || typeof sim.getScreenState !== 'function') {
        throw new Error('Original PXT screen-update boundary is unavailable');
    }
    const observer = {updates: 0, restore() {
        if (api.updateScreen !== observed) throw new Error('Original PXT display observer was replaced');
        api.updateScreen = original;
    }};
    function observed(...args) {
        const result = Reflect.apply(original, this, args);
        const state = sim.getScreenState(), image = args[0];
        if (image && state?.lastImage === image && state.width > 0 && state.height > 0
            && state.screen?.length === state.width * state.height) observer.updates++;
        return result;
    }
    api.updateScreen = observed;
    globalThis.__bwPxtDisplayObserver = observer;
    return observer;
}

// Serialized into the original simulator page; only read actual named globals.
// An absent or ambiguous binding must not satisfy an undefined expectation.
export function pxtActionGlobalsReady(expected, globals = globalThis.__bwPxtRuntime?.globals || {}) {
    return Object.entries(expected).every(([name, value]) => {
        const matches = Object.entries(globals).filter(([key]) => key.replace(/___\d+$/, '') === name);
        return matches.length === 1 && matches[0][1] === value;
    });
}

export function validatePxtActionGlobals(expected) {
    if (!expected || typeof expected !== 'object' || Array.isArray(expected) || !Object.keys(expected).length ||
        Object.entries(expected).some(([name, value]) => !name ||
            !(value === null || ['number', 'string', 'boolean', 'undefined'].includes(typeof value)) ||
            typeof value === 'number' && Number.isNaN(value))) {
        throw new Error('Original PXT action wait requires nonempty named primitive globals');
    }
}

export async function runPxtArcade(source, {waitForGlobals = null, dependencies = {device: '*'}, inspectDisplay = false, waitForDisplay = false, buttonActions = null, recordSound = false, recordSongSound = false, waitForMain = true, fakeClock = false, inspectImageGlobals = [], observeEntropy = false, fixedEntropy = null, onCompilation = null, observeControlReset = false, inspectArrayReads = [], inspectStats = false, inspectArrayValues = [], browser: sharedBrowser = null} = {}) {
    if(fixedEntropy!==null && !(typeof fixedEntropy==='number' && fixedEntropy>=0 && fixedEntropy<1))throw new Error('Fixed entropy must be a number in [0, 1)');
    if(fixedEntropy!==null && observeEntropy)throw new Error('Fixed entropy replaces the platform draws that observation records');
    if (waitForDisplay && !inspectDisplay) throw new Error('Display readiness requires display inspection');
    if(onCompilation!==null && typeof onCompilation!=='function')throw new Error('Compilation observer must be a function');
    for (const action of buttonActions?.steps || []) {
        if (action.waitForGlobals !== undefined) validatePxtActionGlobals(action.waitForGlobals);
    }
    const files=typeof source === 'string' ? {'main.ts':source,'pxt.json':JSON.stringify({name:'bw-arcade-oracle',dependencies,files:['main.ts']})} : {...source};
    const built=await compile('arcade',files);
    // Retain authority from the exact compilation used by this guest, including
    // rejected inputs. The observer receives copies and cannot alter the guest.
    if(onCompilation!==null) {
        await onCompilation(structuredClone({files,built}));
    }
    if(!built.success)throw new Error(JSON.stringify(built.diagnostics));
    // One original browser session at a time across test processes.
    return withExclusiveBoot(async () => {
    const root=path.join(STATIC,'arcade/sim');
    const server=createServer(async(req,res)=>{
        try {
            const name=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
            if(!name.startsWith(root+path.sep))throw new Error('outside simulator root');
            const bytes=await fs.promises.readFile(name);
            res.writeHead(200,{'content-type':path.extname(name)==='.js'?'text/javascript':path.extname(name)==='.html'?'text/html':'application/octet-stream'});res.end(bytes);
        } catch {res.writeHead(404);res.end();}
    });
    await new Promise(done=>server.listen(0,'127.0.0.1',done));
    let browser, clockContext, page;
    try {
        // An explicitly retained browser can qualify the reference helper without
        // installing another executable. An unset path keeps Playwright's default.
        browser = sharedBrowser || await chromium.launch(process.env.BW_PXT_CLOCK_BROWSER_EXECUTABLE ?
            {executablePath:process.env.BW_PXT_CLOCK_BROWSER_EXECUTABLE} : {});
        clockContext = fakeClock ? await browser.newContext() : null;
        if(clockContext)await preparePxtInitialClock(clockContext);
        page = clockContext ? await clockContext.newPage() : await browser.newPage();
        const errors=[],messages=[];page.on('pageerror',error=>errors.push(error.message));
        page.on('console',message=>{if(['error','warning'].includes(message.type()))messages.push(message.text().slice(0,1000));});
        // Configure the paused context before creating a page. Installing a
        // flowing clock and later pausing at zero races elapsed host time.
        await page.goto(`http://127.0.0.1:${server.address().port}/simulator.html`);
        if(fakeClock){
            await assertPxtInitialClock(page);
            await bootstrapPxtProfilerClock(page);
        }
        if (waitForDisplay) await page.evaluate(observePxtDisplay);
        await page.evaluate(async ({code,recordSound,recordSongSound,initialButtons,observeEntropy,fixedEntropy,observeControlReset,inspectArrayReads,inspectStats})=>{
            const msg={type:'run',id:'bw-oracle',code,options:{},mute:true};
            pxsim.AudioContextManager.mute(true);
            if(recordSound || recordSongSound){
                // Record every queued play-instruction buffer with the simulator clock.
                window.__bwSound=[];
                if (recordSongSound) {
                    // Songs bypass queuePlayInstructions in the real simulator.
                    // Observe the final instruction sink without replacing playback.
                    const play=pxsim.AudioContextManager.playInstructionsAsync;
                    pxsim.AudioContextManager.playInstructionsAsync=(bytes,...args)=>{
                        window.__bwSound.push({time:pxsim.runtime?.runningTime?.() ?? null,delay:0,bytes:Array.from(bytes)});
                        return play.call(pxsim.AudioContextManager,bytes,...args);
                    };
                }
                const queue=pxsim.AudioContextManager.queuePlayInstructions;
                pxsim.AudioContextManager.queuePlayInstructions=(when,buffer)=>{
                    window.__bwSound.push({time:pxsim.runtime?.runningTime?.() ?? null,delay:when,bytes:Array.from(buffer.data)});
                    return queue(when,buffer);
                };
            }
            if(fixedEntropy!==null){
                // Pin external platform entropy (pxsim Math_.randomRange draws
                // Math.random) so seeded PXT generators start from a known seed.
                window.__bwOriginalRandom=Math.random;Math.random=()=>fixedEntropy;
            }
            if(observeEntropy){
                // Observe external platform entropy without changing any draw.
                // Authored probes delimit relevant operations with entropyPhase.
                window.__bwEntropy=[];window.__bwOriginalRandom=Math.random;
                Math.random=function(){const value=window.__bwOriginalRandom.call(Math);
                    const globals=window.__bwPxtRuntime?.globals || {};
                    const entry=Object.entries(globals).find(([key])=>key.replace(/___\d+$/,'')==='entropyPhase');
                    if(typeof entry?.[1]==='number' && entry[1]>0)window.__bwEntropy.push({phase:entry[1],value});
                    return value;
                };
            }
            if(observeControlReset){
                window.__bwControlResets=0;
                const post=pxsim.Runtime.postMessage;
                pxsim.Runtime.postMessage=function(message,...rest){
                    if(message?.type==='simulator'&&message.command==='restart'&&message.controlReset===true)window.__bwControlResets++;
                    return post.call(this,message,...rest);
                };
            }
            if(inspectArrayReads.length){
                window.__bwArrayReads=Object.fromEntries(inspectArrayReads.map(name=>[name,[]]));
                const get=pxsim.Array_.getAt;
                pxsim.Array_.getAt=function(array,index,...rest){
                    if(array&&typeof array==='object')for(const [key,value]of Object.entries(window.__bwPxtRuntime?.globals||{})){
                        const name=key.replace(/___\d+$/,'');if(value===array&&Object.hasOwn(window.__bwArrayReads,name))window.__bwArrayReads[name].push(index);
                    }
                    return get.call(this,array,index,...rest);
                };
            }
            const runtime=new pxsim.Runtime(msg);window.__bwPxtRuntime=runtime;
            await runtime.board.initAsync(msg);
            if(inspectStats){
                const state=runtime.board.screenState,original=state.updateStats;
                if(typeof original!=='function')throw new Error('Original PXT board stats boundary unavailable');
                const publications=[];
                function observed(text){const result=Reflect.apply(original,this,[text]);publications.push({time:runtime.runningTime(),text:state.stats});return result;}
                state.updateStats=observed;
                window.__bwPxtStats={state,original,observed,publications};
            }
            for(const {button,held} of initialButtons || []){
                if(typeof runtime.board.setButton!=="function")throw new Error("Original PXT initial button input unavailable");
                runtime.board.setButton(button,held);
            }
            runtime.run(()=>{window.__bwPxtDone=true;});
        },{code:built.outfiles['binary.js'],recordSound,recordSongSound,initialButtons:buttonActions?.initial,observeEntropy,fixedEntropy,observeControlReset,inspectArrayReads,inspectStats});
        if(buttonActions){
            const inputReady=expected=>{
                const values=Object.fromEntries(Object.entries(window.__bwPxtRuntime.globals).map(([key,value])=>[key.replace(/___\d+$/,''),value]));
                return Object.entries(expected).every(([key,value])=>values[key]===value);
            };
            if(buttonActions.afterGlobals){
                if(fakeClock){
                    let elapsed=0;
                    while(!await page.evaluate(inputReady,buttonActions.afterGlobals)){
                        if(elapsed>=20000)throw new Error("Original PXT input readiness marker unavailable");
                        await page.clock.runFor(20);elapsed+=20;
                    }
                } else await page.waitForFunction(inputReady,buttonActions.afterGlobals,{timeout:20000});
            }
            for(const [index, action] of buttonActions.steps.entries()){
                if(action.delay){if(fakeClock)await page.clock.runFor(action.delay);else await page.waitForTimeout(action.delay);}
                // Genuine simulator system-keyboard DOM, not a replaced answer API.
                if (action.text !== undefined) {
                    const input = page.locator('input');
                    if (await input.count() !== 1) throw new Error('Original simulator text prompt is missing or ambiguous');
                    await input.fill(String(action.text));
                }
                if (action.key !== undefined) await page.keyboard.press(action.key);
                if (action.keyDown !== undefined) await page.keyboard.down(action.keyDown);
                if (action.keyUp !== undefined) await page.keyboard.up(action.keyUp);
                if (action.displayClick) {
                    const position = await page.locator('#game-screen').evaluate((canvas, point) => {
                        const rect = canvas.getBoundingClientRect();
                        const scale = Math.min(rect.width / canvas.width, rect.height / canvas.height);
                        return {x: rect.left + (rect.width - canvas.width * scale) / 2 + point.x * scale,
                            y: rect.top + (rect.height - canvas.height * scale) / 2 + point.y * scale};
                    }, action.displayClick);
                    await page.mouse.click(position.x, position.y, {delay: action.displayClick.hold || 0});
                }
                if(action.button!==undefined)await page.evaluate(({button,held})=>{
                    const board=window.__bwPxtRuntime.board;
                    if(typeof board.setButton!=='function')throw new Error('Original PXT board button input unavailable');
                    board.setButton(button,held);
                },action);
                // Observe after the genuine input edge. Existing delays remain
                // before each action, and actions without this option are unchanged.
                if (action.waitForGlobals !== undefined) {
                    try {
                        if (fakeClock) {
                            let elapsed = 0;
                            while (!await page.evaluate(pxtActionGlobalsReady, action.waitForGlobals)) {
                                if (elapsed >= 20000 || errors.length) throw new Error('Original PXT action readiness unavailable');
                                await page.clock.runFor(20); elapsed += 20;
                            }
                        } else await page.waitForFunction(pxtActionGlobalsReady, action.waitForGlobals, {timeout: 20000});
                    } catch (error) {
                        const state = await page.evaluate(expected => {
                            const runtime = window.__bwPxtRuntime;
                            return {dead: runtime?.dead, running: runtime?.running,
                                globals: Object.fromEntries(Object.entries(runtime?.globals || {})
                                    .filter(([key]) => Object.prototype.hasOwnProperty.call(expected, key.replace(/___\d+$/, '')))
                                    .map(([key, value]) => [key, value === null ||
                                        ['number', 'string', 'boolean', 'undefined'].includes(typeof value) ? value : {type: typeof value}]))};
                        }, action.waitForGlobals);
                        throw new Error('Original PXT input action did not reach observed globals: ' +
                            JSON.stringify({index, button: action.button, held: action.held, key: action.key,
                                expected: action.waitForGlobals, errors, messages, state}), {cause: error});
                    }
                }
            }
        }
        if(fakeClock){
            // Faked timers also stop waitForFunction polling: advance and check.
            const ready=()=>page.evaluate(({waitForMain,expected})=>{
                const values=Object.fromEntries(Object.entries(window.__bwPxtRuntime.globals).map(([key,value])=>[key.replace(/___\d+$/,''),value]));
                return (!waitForMain || window.__bwPxtDone) && Object.entries(expected || {}).every(([key,value])=>values[key]===value);
            },{waitForMain,expected:waitForGlobals});
            let elapsed=0;
            while(!await ready()){
                if(elapsed>=120000||errors.length)throw new Error('Original Arcade simulator did not complete under the fake clock: '+JSON.stringify({errors,messages,elapsed}));
                await page.clock.runFor(100);elapsed+=100;
            }
        } else try {
            // Main may never return (game over waits for a button); then only the globals mark completion.
            if (waitForMain) await page.waitForFunction(()=>window.__bwPxtDone,null,{timeout:20000});
            // Exported Scratch hats can continue in real PXT fibers after main
            // returns. Authored fixtures may name an explicit completion marker;
            // do not read unfinished state or change the scheduler to force it.
            if (waitForGlobals) await page.waitForFunction(expected => {
                const values=Object.fromEntries(Object.entries(window.__bwPxtRuntime.globals)
                    .map(([key,value])=>[key.replace(/___\d+$/,''),value]));
                return Object.entries(expected).every(([key,value])=>values[key]===value);
            }, waitForGlobals, {timeout:20000});
        }
        catch(error) {
            const state=await page.evaluate(()=>{const r=window.__bwPxtRuntime;return {dead:r?.dead,running:r?.running,globals:Object.fromEntries(Object.entries(r?.globals || {}).filter(([,v])=>v===null || ['number','string','boolean','undefined'].includes(typeof v))) };});
            throw new Error('Original Arcade simulator did not complete: '+JSON.stringify({errors,messages,state}),{cause:error});
        }
        let displayBaseline;
        if (waitForDisplay) {
            displayBaseline = await page.evaluate(() => window.__bwPxtDisplayObserver.updates);
            if (fakeClock) {
                let elapsed = 0;
                while (await page.evaluate(() => window.__bwPxtDisplayObserver.updates) <= displayBaseline) {
                    if (elapsed >= 20000 || errors.length) throw new Error('Original PXT did not present a frame after completion');
                    await page.clock.runFor(20); elapsed += 20;
                }
            } else await page.waitForFunction(baseline => window.__bwPxtDisplayObserver.updates > baseline,
                displayBaseline, {timeout: 20000});
        }
        const values=await page.evaluate(({inspectDisplay,recordSound,recordSongSound,waitForDisplay,displayBaseline,inspectImageGlobals,observeEntropy,fixedEntropy,observeControlReset,inspectArrayReads,inspectStats,inspectArrayValues})=>{
            const runtime=window.__bwPxtRuntime;
            const result=Object.fromEntries(Object.entries(runtime.globals).filter(([,v])=>v===null || ['number','string','boolean','undefined'].includes(typeof v)).map(([k,v])=>[k.replace(/___\d+$/,''),v]));
            if (inspectArrayValues.length) {
                result.$arrays = {};
                for (const name of inspectArrayValues) {
                    const matches = Object.entries(runtime.globals).filter(([key]) => key.replace(/___\d+$/, '') === name);
                    const value = matches[0]?.[1];
                    const entries = Array.isArray(value) ? value : value?.data;
                    if (matches.length !== 1 || !Array.isArray(entries) || entries.some(entry =>
                        entry !== null && !['number', 'string', 'boolean', 'undefined'].includes(typeof entry))) {
                        throw new Error('Original PXT primitive Array global is unavailable: ' + name);
                    }
                    result.$arrays[name] = entries.slice();
                }
            }
            if(inspectImageGlobals.length){
                result.$images={};
                for(const name of inspectImageGlobals){
                    const matches=Object.entries(runtime.globals).filter(([key])=>key.replace(/___\d+$/,'')===name);
                    if(matches.length!==1)throw new Error('Original image global is missing or ambiguous: '+name);
                    const value=matches[0][1];
                    if(typeof value?._width!=='number' || typeof value?._height!=='number' || !value?.data)throw new Error('Original image global unavailable: '+name);
                    const pixels=Array.from(value.data);
                    if(pixels.length!==value._width*value._height)throw new Error('Original image global has incomplete pixels: '+name);
                    result.$images[name]={width:value._width,height:value._height,pixels};
                }
            }
            if(inspectDisplay)result.$display={palette:Array.from(runtime.board.screenState.palette),
                screen:Array.from(runtime.board.screenState.screen)};
            if(waitForDisplay){
                result.$display.updatesAfterReady=window.__bwPxtDisplayObserver.updates-displayBaseline;
                window.__bwPxtDisplayObserver.restore();delete window.__bwPxtDisplayObserver;
            }
            if(recordSound || recordSongSound)result.$sound=window.__bwSound;
            if(observeEntropy){result.$entropy=window.__bwEntropy;Math.random=window.__bwOriginalRandom;delete window.__bwOriginalRandom;delete window.__bwEntropy;}
            if(fixedEntropy!==null){Math.random=window.__bwOriginalRandom;delete window.__bwOriginalRandom;}
            if(inspectArrayReads.length)result.$arrayReads=window.__bwArrayReads;
            if(observeControlReset)result.$controlResets=window.__bwControlResets;
            if(inspectStats){
                const owner=window.__bwPxtStats;
                if(owner.state!==runtime.board.screenState||owner.state.updateStats!==owner.observed)throw new Error('Original PXT board stats observer changed');
                result.$stats={runtimeTime:runtime.runningTime(),text:owner.state.stats,displayed:document.getElementById('debug-stats')?.textContent??null,publications:owner.publications};
                owner.state.updateStats=owner.original;delete window.__bwPxtStats;
            }
            runtime.kill();runtime.board.kill();return result;
        },{inspectDisplay,recordSound,recordSongSound,waitForDisplay,displayBaseline,inspectImageGlobals,observeEntropy,fixedEntropy,observeControlReset,inspectArrayReads,inspectStats,inspectArrayValues});
        if(errors.length)throw new Error(JSON.stringify(errors));
        return values;
    } finally {
        try {
            if (sharedBrowser) {
                if (clockContext) await clockContext.close();
                else await page?.close();
            } else await browser?.close();
        } finally {
            await new Promise(done => server.close(done));
        }
    }
    });
}
