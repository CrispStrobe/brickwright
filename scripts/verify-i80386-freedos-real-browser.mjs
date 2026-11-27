/**
 * Optional real FreeDOS 1.4 browser acceptance. Supply local media paths:
 * FREEDOS_IMAGE=/path/to/x86BOOT-1200.img FREEDOS_HDD=/path/to/type1-hdd.img
 *   npm run verify:i80386-freedos-real-browser
 *
 * The expected media and Widgets canvas hashes bind this probe to the
 * qualified FreeDOS image, generated type-1 HDD, and fixed Chromium viewport.
 * It writes only a JSON report and screenshots to FREEDOS_PROBE_OUTPUT (or a
 * new temporary directory). The images themselves stay outside this repo.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
import {readFile, mkdir, mkdtemp, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {extname, join, normalize, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {interactionHdd} from './lib/i80386-freedos-interaction.mjs';
import {fixedTextGlyphs,decodeTextPixels} from './lib/i80386-vga-text.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = resolve(process.env.FREEDOS_GUI_BUILD || join(root, 'packages/scratch-gui/build'));
const floppyPath = process.env.FREEDOS_IMAGE;
const hddPath = process.env.FREEDOS_HDD;
if (!floppyPath || !hddPath) throw new Error('Set FREEDOS_IMAGE and FREEDOS_HDD to local image paths');
if (!existsSync(join(build, 'index.html'))) throw new Error('Build packages/scratch-gui first');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const portableCanvas = process.env.FREEDOS_PORTABLE_CANVAS === '1';
const interaction = process.env.FREEDOS_INTERACTION === '1';
const [floppy, baseHdd] = await Promise.all([readFile(floppyPath), readFile(hddPath)]);
const hdd = interaction ? interactionHdd(baseHdd) : baseHdd;
const mediaHashes = {floppy:sha256(floppy), hdd:sha256(hdd)};
const expectedMedia = {floppy:'03df6088be016e57a6c44275f5bb9ab0244db71de1360957fd76ba83243b6a77',
    hdd:'2fa9c252f22cec4f8c5bdc82d1587293ffcaed791e0982384628d19a7316a851'};
assert.deepEqual({floppy:sha256(floppy),hdd:sha256(baseHdd)}, expectedMedia, 'expected FreeDOS 1.4 floppy and generated type-1 HDD');
const expectedScreen = {installer:'3212c5e4cf31db57579736e199c01b919979b475a94cfc9f351713314e884883',
    prompt:'b8bbdd592c3759a06d42b6159ed31326e95e73c4c2b77743e6e7d310cf1a5752',
    cMounted:'2954dec2a2cdd0eb75bea45d3f7c00316ac7d6ff864b78d24f07efe68f169f1c'};
assert.equal(floppy.length, 1200 * 1024);
assert.equal(hdd.length, 306 * 4 * 17 * 512);
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json',
    '.wasm':'application/wasm','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server = createServer(async (req, res) => {
    try {
        let route = decodeURIComponent((req.url || '/').split('?')[0]);
        if (route === '/' || route.endsWith('/')) route += 'index.html';
        const file = join(build, normalize(route));
        if (!file.startsWith(build + '/')) throw new Error('path escaped build');
        const body = await readFile(file);
        res.writeHead(200, {'content-type':mime[extname(file)] || 'application/octet-stream'});
        res.end(body);
    } catch {res.writeHead(404); res.end('not found');}
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch();
const context = await browser.newContext({viewport:{width:1600,height:1000},serviceWorkers:'block'});
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('crash', () => errors.push('page crashed'));
const started = Date.now();
// Decode inside Chromium: transferring a million pixel numbers each poll can
// dominate the guest run. The serialized function and font are trusted source.
const textObserver = `(${decodeTextPixels.toString()})(window.__benchTarget.video(),${JSON.stringify(fixedTextGlyphs())})`;
const guestText = () => page.evaluate(textObserver);
const output = process.env.FREEDOS_PROBE_OUTPUT || await mkdtemp(join(tmpdir(), 'lite-free386-real-browser-'));
await mkdir(output, {recursive:true});
const capture = async label => {
    const file = join(output, `${label}.png`);
    const bytes = await page.getByTestId('bw-machine-canvas').screenshot({path:file});
    return {file,sha256:sha256(bytes)};
};
const waitForGuestTime = async (advanceNs, timeout = 30000) => {
    const startNs = await page.evaluate(() => Number(window.__benchTarget?.timeNs?.()));
    assert.ok(Number.isFinite(startNs), '386 target has a readable simulated clock');
    await page.waitForFunction(({startNs,advanceNs}) =>
        Number(window.__benchTarget?.timeNs?.()) >= startNs + advanceNs,
    {startNs,advanceNs}, {timeout});
};
const captureExpected = async (label, expected, text) => {
    let shot;
    for (let attempt = 0; attempt < 20; attempt++) {
        shot = await capture(label);
        if (shot.sha256 === expected || (portableCanvas && text.test(await guestText()))) return shot;
        const frame = await page.evaluate(() => window.__benchTarget?.video?.()?.frame);
        await page.waitForFunction(frame =>
            (window.__benchTarget?.video?.()?.frame ?? 0) > frame + 100,
        frame, {timeout:5000});
    }
    throw new Error(`${label} canvas did not match expected guest screen: ${shot.sha256}`);
};
try {
    await page.addInitScript(() => {
        localStorage.clear(); localStorage.setItem('bw-starter-v1-complete', '1');
        indexedDB.deleteDatabase('bw-machines');
        window.__realFree386 = {media:[], mirror:null, keyScans:[], mouse:[]};
        window.addEventListener('bw-machine-media-load', e => {
            const d = e.detail;
            if (d?.machinePreset === 'freedos-vga') window.__realFree386.media.push({
                slot:d.slotId, primaryBytes:d.bytes?.length,
                hddBytes:d.i80386Media?.hdd?.length});
        });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`,
        {waitUntil:'domcontentloaded',timeout:90000});
    await page.getByRole('tab',{name:'Code',exact:true}).click();
    const device = page.getByTestId('bw-device-select');
    await device.waitFor({state:'visible',timeout:60000});
    await device.selectOption('__manage__');
    await page.getByTestId('bw-machine-manager').waitFor({state:'visible'});
    await page.getByRole('combobox', {name: 'Machine type'}).selectOption('i80386');
    await page.getByTestId('bw-mm-free386-floppy').setInputFiles({name:'x86BOOT-1200.img',mimeType:'application/octet-stream',buffer:floppy});
    await page.getByTestId('bw-mm-free386-hdd').setInputFiles({name:'freedos-fat16-hdd.img',mimeType:'application/octet-stream',buffer:hdd});
    await page.waitForFunction(() => typeof window.bwMirrorMachineVideo === 'function');
    await page.evaluate(() => {
        const original = window.bwMirrorMachineVideo;
        window.bwMirrorMachineVideo = p => {
            window.__realFree386.mirror = {widget:p.widget,hasVideo:typeof p.videoFn === 'function',
                hasKeyboard:typeof p.keyInFn === 'function'};
            return original({...p, mouseInFn:event => {
                const result = p.mouseInFn?.(event);
                window.__realFree386.mouse.push({...event,result});
                return result;
            }, keyInFn:sc => {
                window.__realFree386.keyScans.push(sc);
                return p.keyInFn(sc);
            }});
        };
    });
    await page.getByTestId('bw-mm-free386-run').click();
    await page.getByTestId('bw-machine-manager').waitFor({state:'detached',timeout:90000});
    await page.getByTestId('bw-machine-canvas').waitFor({state:'visible',timeout:30000});
    const media = await page.evaluate(() => ({media:window.__realFree386.media,
        mirror:window.__realFree386.mirror}));
    assert.ok(media.media.some(e => e.slot === 'floppy' &&
        e.primaryBytes === floppy.length && e.hddBytes === hdd.length));
    assert.equal(media.mirror?.hasVideo, true);
    assert.equal(media.mirror?.hasKeyboard, true);
    console.log('ATTACHED', JSON.stringify({elapsedSec:(Date.now()-started)/1000,
        media:media.media,mirror:media.mirror}));
    let declined = false;
    let dirSent = false;
    let passed = false;
    let installerCapture = null;
    let promptCapture = null;
    let cMountCapture = null;
    const milestones = [];
    const maxMs = Number(process.env.FREEDOS_MAX_MS || 300000);
    assert.ok(Number.isInteger(maxMs) && maxMs >= 30000 && maxMs <= 600000);
    let finalTarget = null;
    for (let tick = 0; Date.now()-started < maxMs; tick++) {
        await waitForGuestTime(2_000_000_000);
        const state = await page.evaluate(() => {
            const t = window.__benchTarget;
            const v = t?.video?.();
            const r = t?.regs?.();
            let lit = 0;
            for (let i = 0; i < (v?.rgba?.length || 0); i += 4) {
                if (v.rgba[i] || v.rgba[i + 1] || v.rgba[i + 2]) lit++;
            }
            return {timeNs:String(t?.timeNs?.()), state:t?.state?.(),
                pc:r?.pc, cs:r?.cs, ip:r?.ip, halted:r?.halted, cycles:r?.cycles,
                video:{frame:v?.frame, width:v?.width, height:v?.height,
                    mode:v?.mode, why:v?.why, lit}};
        });
        if (interaction && dirSent) state.text = await guestText();
        finalTarget = state;
        if (tick % 3 === 0 || (!declined && state.pc === 156847 && state.halted)) {
            const label = String(tick).padStart(3, '0');
            const canvas = await capture(`canvas-${label}`);
            const milestone = {elapsedSec:(Date.now()-started)/1000, tick,
                ...state, canvas};
            milestones.push(milestone);
            console.log('MILESTONE', JSON.stringify(milestone));
        }
        // The headless comparator reaches the installer question at this
        // stable HLT/IRQ wait. The preceding canvas is retained for review.
        if (!declined && state.pc === 156847 && state.halted &&
            state.video.frame > 90000) {
            installerCapture = await captureExpected('installer-question', expectedScreen.installer, /Do you want to proceed \[Y,N\]\?/);
            await page.getByTestId('bw-machine-canvas').click();
            await page.keyboard.press('n');
            await waitForGuestTime(100_000_000);
            await page.keyboard.press('Enter');
            console.log('INPUT', JSON.stringify({source:'Widgets keyboard',
                keys:'n,Enter',elapsedSec:(Date.now()-started)/1000}));
            declined = true;
        }
        if (declined && !dirSent && state.video.lit >= 109490 &&
            Number(state.timeNs) > 60_000_000_000) {
            promptCapture = await captureExpected('dos-prompt', expectedScreen.prompt, /^\s*[A-Z]:\\?>\s*$/m);
            await page.getByTestId('bw-machine-canvas').click();
            for (const key of ['d','i','r',' ','c']) {
                await page.keyboard.press(key);
                await waitForGuestTime(100_000_000);
            }
            await page.keyboard.down('Shift');
            await waitForGuestTime(100_000_000);
            await page.keyboard.press('Semicolon');
            await waitForGuestTime(100_000_000);
            await page.keyboard.up('Shift');
            await waitForGuestTime(100_000_000);
            await page.keyboard.press('Enter');
            const scans = await page.evaluate(() => window.__realFree386.keyScans);
            console.log('INPUT', JSON.stringify({source:'Widgets physical keyboard',
                keys:'dir c:,Enter',scans,elapsedSec:(Date.now()-started)/1000}));
            dirSent = true;
        }
        if (dirSent && (interaction ? /CMOUNTOK\s+TXT/.test(state.text) && /MOUSE\s+COM/.test(state.text) : state.video.lit === 75246)) {
            cMountCapture = await capture('c-mounted');
            if (interaction || cMountCapture.sha256 === expectedScreen.cMounted ||
                (portableCanvas && /CMOUNTOK\s+TXT/.test(await guestText()))) {
                passed = true;
                break;
            }
        }
    }
    let interactions = null;
    if (interaction && passed) {
        const canvas = page.getByTestId('bw-machine-canvas');
        await page.evaluate(() => {window.__interactionTarget = window.__benchTarget;});
        const before = await canvas.boundingBox();
        await page.getByTestId('bw-machine-fullscreen').click();
        await page.getByTestId('bw-machine-fullscreen').getByText('Exit full screen', {exact: true}).waitFor();
        const fullscreen = await canvas.boundingBox();
        assert.ok(fullscreen.width > 1400 && fullscreen.height > 850,'real guest screen fills fullscreen');
        await page.getByTestId('bw-machine-fullscreen').click();
        await page.getByTestId('bw-machine-fullscreen').getByText('Full screen', {exact: true}).waitFor();
        const divider = page.getByRole('separator', {name:'Resize the stage column'});
        let resized = null;
        await divider.waitFor({state:'visible'});
        {
            const box = await divider.boundingBox();
            await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
            await page.mouse.down(); await page.mouse.move(450,box.y+box.height/2); await page.mouse.up();
            resized = await canvas.boundingBox();
            assert.ok(resized.width > before.width+100,'drag expands the real guest pane');
        }
        await canvas.click();
        for (const key of ['c',':','\\','m','o','u','s','e','.','c','o','m']) {
            if (key === ':') {await page.keyboard.down('Shift');await page.keyboard.press('Semicolon');await page.keyboard.up('Shift');}
            else await page.keyboard.press(key === '\\' ? 'Backslash' : key);
            await waitForGuestTime(100_000_000);
        }
        await page.keyboard.press('Enter');
        const hasText = async expected => {
            const deadline=Date.now()+30000;
            while(Date.now()<deadline) {
                if((await guestText()).includes(expected))return;
                await waitForGuestTime(100_000_000);
            }
            await capture('interaction-failure');
            const diagnostics={expected,text:await guestText(),input:await page.evaluate(()=>window.__realFree386),target:await page.evaluate(()=>({state:window.__benchTarget.state?.(),timeNs:String(window.__benchTarget.timeNs?.()),regs:window.__benchTarget.regs?.()}))};
            await writeFile(join(output,'interaction-failure.json'),JSON.stringify(diagnostics,null,2)+'\n');
            console.error('INTERACTION FAILURE',JSON.stringify(diagnostics));
            throw new Error(`guest pixels did not show ${expected}`);
        };
        await hasText('PS2 READY');
        await page.mouse.down({button:'left'});await page.mouse.up({button:'left'});
        await hasText('PS2 PACKET 09 00 00');
        await hasText('PS2 DONE');
        const text = await guestText();
        const mouse = await page.evaluate(() => window.__realFree386.mouse);
        await writeFile(join(output,'mouse-before-tabs.json'),JSON.stringify({text,mouse,screen:await capture('mouse-before-tabs')},null,2)+'\n');
        assert.ok(mouse.some(e=>e.result===true && e.buttons===1),'real guest enabled and accepted PS/2 button');
        const beforeTabs = await page.evaluate(()=>({timeNs:Number(window.__benchTarget.timeNs()),media:window.__realFree386.media.length}));
        await page.getByRole('tab',{name:/Circuit/}).click();
        assert.equal(await page.evaluate(() => window.__interactionTarget === window.__benchTarget),true,'same machine survives Circuit tab');
        await page.getByRole('tab',{name:'Code',exact:true}).click();
        await canvas.waitFor({state:'visible'});
        await canvas.click();
        for(const key of ['e','c','h','o','Space','t','a','b','o','k']) {
            await page.keyboard.press(key);
            await waitForGuestTime(100_000_000);
        }
        await page.keyboard.press('Enter');
        await waitForGuestTime(500_000_000);
        const tabText=await guestText();
        const afterTabs = await page.evaluate(()=>({timeNs:Number(window.__benchTarget.timeNs()),media:window.__realFree386.media.length}));
        await writeFile(join(output,'tab-continuity.json'),JSON.stringify({beforeTabs,afterTabs,tabText},null,2)+'\n');
        assert.match(tabText,/PS2 DONE/,'guest mouse-program output survives tab roundtrip');
        assert.match(tabText,/^tabok\s*$/m,'guest shell responds after tab roundtrip');
        assert.ok(afterTabs.timeNs>=beforeTabs.timeNs,'tab roundtrip does not reset guest time');
        interactions = {before,fullscreen,resized,circuitTargetPreserved:true,beforeTabs,afterTabs,tabText,guestMousePacket:'09 00 00',guestText:text,mouse,screen:await capture('guest-mouse')};
    }
    const buildManifest = JSON.parse(await readFile(join(build,'brickwright-build.json'),'utf8'));
    const report = {schema:'brickwright-lite.i80386-freedos-real-browser.v1', passed,
        elapsedSec:(Date.now()-started)/1000, maxMs, buildCommit:buildManifest.commit,
        buildIndexSha256:sha256(await readFile(join(build,'index.html'))),
        portableCanvas, mediaSha256:mediaHashes, media:media.media,mirror:media.mirror,
        input:'Widgets physical keyboard: n, Enter, d i r Space c Shift+Semicolon Enter',
        keyScans:await page.evaluate(() => window.__realFree386.keyScans),
        installerCapture,promptCapture,cMountCapture,declined,dirSent,interactions,
        finalTarget,errors,milestones};
    await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
    console.log('DONE',JSON.stringify({passed,elapsedSec:report.elapsedSec,
        installerCapture,promptCapture,cMountCapture,errors,output}));
    assert.equal(errors.length,0,'uncaught page errors');
    assert.equal(passed,true,'FreeDOS C: marker must appear on the Widgets canvas');
} catch(error) {
    const failure={schema:'brickwright-lite.i80386-freedos-real-browser-failure.v1',error:String(error),elapsedSec:(Date.now()-started)/1000,errors};
    try {failure.text=await guestText();failure.input=await page.evaluate(()=>window.__realFree386);failure.target=await page.evaluate(()=>({regs:window.__benchTarget?.regs?.(),timeNs:String(window.__benchTarget?.timeNs?.())}));failure.screen=await capture('failure');} catch(observationError) {failure.observationError=String(observationError);}
    await writeFile(join(output,'failure.json'),JSON.stringify(failure,null,2)+'\n');
    throw error;
} finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
}
