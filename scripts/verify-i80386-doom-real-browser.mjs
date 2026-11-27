/**
 * Optional, source-bound Widgets replay of the owned 24-tic Doom shareware
 * short demo. Media paths are local inputs; no media bytes belong in Lite.
 *
 * DOOM_FREEDOS_IMAGE=/path/to/x86BOOT-1200.img
 * DOOM_SHORT_HDD=/path/to/short-demo.img
 * DOOM_GUI_BUILD=/path/to/scratch-gui/build
 *   node scripts/verify-i80386-doom-real-browser.mjs
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {existsSync} from 'node:fs';
import {mkdir, mkdtemp, readFile, writeFile} from 'node:fs/promises';
import {dirname, extname, join, normalize, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {buildFont} from '../node_modules/bw-board/src/i8086-cga.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const probePath = fileURLToPath(import.meta.url);
const build = resolve(process.env.DOOM_GUI_BUILD || join(root, 'packages/scratch-gui/build'));
const floppyPath = process.env.DOOM_FREEDOS_IMAGE;
const hddPath = process.env.DOOM_SHORT_HDD;
if (!floppyPath || !hddPath) throw new Error('Set DOOM_FREEDOS_IMAGE and DOOM_SHORT_HDD');
if (!existsSync(join(build, 'index.html'))) throw new Error('Build packages/scratch-gui first');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const [floppy, hdd, bios, vgaRom] = await Promise.all([
    readFile(floppyPath),readFile(hddPath),
    readFile(join(build,'static/roms/free-386-bochs-bios.rom')),
    readFile(join(build,'static/roms/free-386-vgabios-lgpl.bin'))]);
const mediaSha256 = {floppy:sha256(floppy),hdd:sha256(hdd),bios:sha256(bios),vgaRom:sha256(vgaRom)};
assert.deepEqual(mediaSha256, {
    floppy:'03df6088be016e57a6c44275f5bb9ab0244db71de1360957fd76ba83243b6a77',
    hdd:'5ffd1e792e80f5412b713413cd760f4114b6f1d9c527292369c806b716102a8d',
    bios:'6481181809b58a9f805346a7ecf9bebdaf5b322c32825fb49ee89da51552c4ac',
    vgaRom:'76af53f14955df3edd6365daa64393e91fafe55241c2c00384ff05b740431da1'
});
assert.equal(floppy.length, 1200 * 1024);
assert.equal(hdd.length, 306 * 4 * 17 * 512);
const maxMs = Number(process.env.DOOM_MAX_MS || 1500000);
assert.ok(Number.isInteger(maxMs) && maxMs >= 30000 && maxMs <= 3600000);
const output = process.env.DOOM_PROBE_OUTPUT || await mkdtemp(join(tmpdir(), 'lite-386-doom-browser-'));
await mkdir(output, {recursive:true});
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
    } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch();
const context = await browser.newContext({viewport:{width:1600,height:1000},serviceWorkers:'block'});
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('crash', () => errors.push('page crashed'));
const started = Date.now();
const milestones = [];
const keyScans = [];
const report = {schema:'brickwright-lite.i80386-doom-real-browser.v1',passed:false,
    buildCommit:null,buildIndexSha256:sha256(await readFile(join(build,'index.html'))),
    probeSha256:sha256(await readFile(probePath)),
    boardPin:JSON.parse(await readFile(join(root,'vendor-pins.json'),'utf8'))['bw-board'],
    mediaSha256,maxMs,output,errors,milestones,keyScans,inputs:[],graphics:[],
    textCaptures:[],commandEchoVerified:false,completion:null};
const capture = async label => {
    const file = join(output, label + '.png');
    const bytes = await page.getByTestId('bw-machine-canvas').screenshot({path:file});
    return {file,sha256:sha256(bytes)};
};
const captureGuestRgb = async label => {
    const snapshot = await page.evaluate(() => {
        const v = window.__benchTarget?.video?.();
        if (v?.width !== 320 || v?.height !== 200 || !v.rgba) return null;
        const rgb = new Uint8Array(320 * 200 * 3);
        const colors = new Set();
        let lit = 0;
        for (let i = 0, j = 0; i < v.rgba.length; i += 4) {
            const r = v.rgba[i],g = v.rgba[i+1],b = v.rgba[i+2];
            rgb[j++] = r; rgb[j++] = g; rgb[j++] = b;
            if (r || g || b) lit++;
            colors.add((r << 16) | (g << 8) | b);
        }
        return {rgb:Array.from(rgb),frame:v.frame,unique:colors.size,lit};
    });
    if (!snapshot) return null;
    const rgb = Buffer.from(snapshot.rgb);
    const file = join(output,label + '.ppm');
    const ppm = Buffer.concat([Buffer.from('P6\n320 200\n255\n'),rgb]);
    await writeFile(file,ppm);
    return {file,width:320,height:200,frame:snapshot.frame,
        rgbSha256:sha256(rgb),ppmSha256:sha256(ppm),unique:snapshot.unique,lit:snapshot.lit};
};
const captureWidgetGraphics = async () => {
    try {
        await page.waitForFunction(() => {
            const canvas = document.querySelector('[data-testid="bw-machine-canvas"]');
            if (canvas?.width !== 320 || canvas?.height !== 200) return false;
            const rgba = canvas.getContext('2d')?.getImageData(0,0,320,200).data;
            if (!rgba) return false;
            const colors = new Set();
            let lit = 0;
            for (let i = 0; i < rgba.length; i += 4) {
                const r = rgba[i],g = rgba[i+1],b = rgba[i+2];
                colors.add((r << 16) | (g << 8) | b);
                if (r || g || b) lit++;
            }
            return colors.size >= 100 && lit >= 20000;
        },null,{timeout:7000,polling:250});
    } catch { return null; }
    return page.getByTestId('bw-machine-canvas').evaluate(async canvas => {
        const rgba = canvas.getContext('2d').getImageData(0,0,320,200).data;
        const rgb = new Uint8Array(320 * 200 * 3);
        const colors = new Set();
        let lit = 0;
        for (let i = 0, j = 0; i < rgba.length; i += 4) {
            const r = rgba[i],g = rgba[i+1],b = rgba[i+2];
            rgb[j++] = r; rgb[j++] = g; rgb[j++] = b;
            colors.add((r << 16) | (g << 8) | b);
            if (r || g || b) lit++;
        }
        const digest = await crypto.subtle.digest('SHA-256',rgb);
        const rgbSha256 = Array.from(new Uint8Array(digest),
            n => n.toString(16).padStart(2,'0')).join('');
        return {width:canvas.width,height:canvas.height,unique:colors.size,lit,rgbSha256};
    });
};
const press = async key => page.keyboard.press(key, {delay:85});
const sendText = async text => {
    const priorScans = keyScans.length;
    for (const char of text) {
        if (char === ' ') await press('Space');
        else if (char === ':') {
            await page.keyboard.down('Shift');
            await press('Semicolon');
            await page.keyboard.up('Shift');
        } else if (char === '-') await press('Minus');
        else await press(char);
    }
    await press('Enter');
    const scans = await page.evaluate(() => window.__doomProbe.keyScans);
    assert.ok(scans.length >= priorScans + (text.length + 1) * 2,
        'Widgets physical keyboard must deliver make/break bytes');
    keyScans.splice(0, keyScans.length, ...scans);
    report.inputs.push({text,elapsedSec:(Date.now()-started)/1000,
        scancodesThisInput:scans.length-priorScans,totalScancodes:scans.length});
    console.log('INPUT', JSON.stringify(report.inputs.at(-1)));
};
const guestState = async () => page.evaluate(async () => {
    const t = window.__benchTarget;
    if (!t) return null;
    const v = t.video?.();
    const r = t.regs?.();
    let lit = 0, unique = 0, rgbSha256 = null;
    if (v?.rgba) {
        const rgb = new Uint8Array(v.width * v.height * 3);
        const seen = new Set();
        for (let i = 0, j = 0; i < v.rgba.length; i += 4) {
            const red = v.rgba[i], green = v.rgba[i + 1], blue = v.rgba[i + 2];
            if (red || green || blue) lit++;
            if (v.width === 320 && v.height === 200) {
                rgb[j++] = red; rgb[j++] = green; rgb[j++] = blue;
                seen.add((red << 16) | (green << 8) | blue);
            }
        }
        if (seen.size) {
            unique = seen.size;
            const digest = await crypto.subtle.digest('SHA-256', rgb);
            rgbSha256 = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2,'0')).join('');
        }
    }
    const rows = [];
    if (v?.width === 720 && v?.height === 400 && v.rgba && window.__doomProbe.font) {
        // Decode the exact public-domain glyphs used by bw-board's 9x16 text
        // renderer from the guest video frame. The 9th column is always blank
        // for ASCII and supplies a per-cell background-color sample.
        const font = window.__doomProbe.font;
        const popcount = window.__doomProbe.popcount;
        for (let row = 0; row < 25; row++) {
            let line = '';
            for (let col = 0; col < 80; col++) {
                const bgOffset = ((row * 16) * 720 + col * 9 + 8) * 4;
                const bg = (v.rgba[bgOffset] << 16) |
                    (v.rgba[bgOffset + 1] << 8) | v.rgba[bgOffset + 2];
                const observed = new Uint8Array(16);
                for (let y = 0; y < 16; y++) {
                    let mask = 0;
                    let p = ((row * 16 + y) * 720 + col * 9) * 4;
                    for (let x = 0; x < 8; x++, p += 4) {
                        const color = (v.rgba[p] << 16) |
                            (v.rgba[p + 1] << 8) | v.rgba[p + 2];
                        if (color !== bg) mask |= 1 << x;
                    }
                    observed[y] = mask;
                }
                let best = 32, errors = Infinity;
                for (let code = 32; code <= 126; code++) {
                    let score = 0;
                    const offset = code * 16;
                    for (let y = 0; y < 16; y++) score += popcount[observed[y] ^ font[offset + y]];
                    if (score < errors) { errors = score; best = code; }
                    if (score === 0) break;
                }
                line += errors <= 4 ? String.fromCharCode(best) : '?';
            }
            if (line.trim()) rows.push(line.trimEnd());
        }
    }
    return {timeNs:String(t.timeNs?.()),targetState:t.state?.(),pc:r?.pc,cs:r?.cs,ip:r?.ip,
        halted:r?.halted,cycles:r?.cycles,video:{frame:v?.frame,width:v?.width,
            height:v?.height,mode:v?.mode,why:v?.why,unsupported:v?.unsupported,
            keys:Object.keys(v || {}),lit,unique,rgbSha256},rows};
});
try {
    await page.addInitScript(() => {
        localStorage.clear(); localStorage.setItem('bw-starter-v1-complete', '1');
        indexedDB.deleteDatabase('bw-machines');
        window.__doomProbe = {media:[],mirror:null,keyScans:[]};
        window.addEventListener('bw-machine-media-load', e => {
            const d = e.detail;
            if (d?.machinePreset === 'freedos-vga') window.__doomProbe.media.push({
                slot:d.slotId,primaryBytes:d.bytes?.length,hddBytes:d.i80386Media?.hdd?.length});
        });
    });
    await page.goto('http://127.0.0.1:' + server.address().port + '/',
        {waitUntil:'domcontentloaded',timeout:90000});
    await page.getByRole('tab',{name:'Code',exact:true}).click();
    const device = page.getByTestId('bw-device-select');
    await device.waitFor({state:'visible',timeout:60000});
    await device.selectOption('__manage__');
    await page.getByTestId('bw-machine-manager').waitFor({state:'visible'});
    await page.getByRole('combobox', {name: 'Machine type'}).selectOption('i80386');
    await page.getByTestId('bw-mm-free386-floppy').setInputFiles({
        name:'x86BOOT-1200.img',mimeType:'application/octet-stream',buffer:floppy});
    await page.getByTestId('bw-mm-free386-hdd').setInputFiles({
        name:'doom-short-demo.img',mimeType:'application/octet-stream',buffer:hdd});
    await page.waitForFunction(() => typeof window.bwMirrorMachineVideo === 'function');
    await page.evaluate(() => {
        const original = window.bwMirrorMachineVideo;
        window.bwMirrorMachineVideo = p => {
            window.__doomProbe.mirror = {widget:p.widget,hasVideo:typeof p.videoFn === 'function',
                hasKeyboard:typeof p.keyInFn === 'function'};
            return original({...p,keyInFn:sc => {
                window.__doomProbe.keyScans.push(sc);
                return p.keyInFn(sc);
            }});
        };
    });
    await page.getByTestId('bw-mm-free386-run').click();
    await page.getByTestId('bw-machine-manager').waitFor({state:'detached',timeout:90000});
    await page.getByTestId('bw-machine-canvas').waitFor({state:'visible',timeout:30000});
    await page.evaluate(font => {
        window.__doomProbe.font = font;
        window.__doomProbe.popcount = Array.from({length:256}, (_, value) => {
            let count = 0;
            while (value) { count += value & 1; value >>>= 1; }
            return count;
        });
    }, Array.from(buildFont(9,16)));
    const attached = await page.evaluate(() => window.__doomProbe);
    assert.ok(attached.media.some(e => e.slot === 'floppy' &&
        e.primaryBytes === floppy.length && e.hddBytes === hdd.length));
    assert.equal(attached.mirror?.hasVideo,true);
    assert.equal(attached.mirror?.hasKeyboard,true);
    report.media = attached.media;
    report.mirror = attached.mirror;
    report.buildCommit = JSON.parse(await readFile(join(build,'brickwright-build.json'),'utf8')).commit;
    console.log('ATTACHED', JSON.stringify({elapsedSec:(Date.now()-started)/1000,
        media:attached.media,mirror:attached.mirror,buildCommit:report.buildCommit}));
    let phase = 'installer';
    let previousCycles = 0;
    let cSentAtNs = 0;
    let commandCycles = 0;
    let lastTextCaptureCycles = 0;
    for (let tick = 0; Date.now() - started < maxMs; tick++) {
        try {
            await page.waitForFunction(old => (window.__benchTarget?.regs?.().cycles || 0) >= old + 4_000_000,
                previousCycles,{timeout:15000,polling:250});
        } catch { /* a halted guest or stalled runner is still sampled below */ }
        const state = await guestState();
        if (!state) continue;
        previousCycles = state.cycles;
        if (tick % 8 === 0 || state.video.width === 320 && state.video.height === 200 && tick % 4 === 0) {
            const milestone = {tick,elapsedSec:(Date.now()-started)/1000,phase,...state};
            milestones.push(milestone);
            console.log('MILESTONE',JSON.stringify(milestone));
        }
        if (phase === 'doom' && state.rows.some(row =>
            row.trim() === 'C:\\>doom -timedemo astra -nosound')) {
            report.commandEchoVerified = true;
        }
        if (phase === 'installer' && state.pc === 156847 && state.halted &&
            state.video.frame > 90000 &&
            state.rows.some(row => /Do you want to proceed \[Y,N\]\?/i.test(row))) {
            report.installer = await capture('installer');
            await page.getByTestId('bw-machine-canvas').click();
            await sendText('n');
            phase = 'a-prompt';
        } else if (phase === 'a-prompt' && state.video.width === 720 &&
            Number(state.timeNs) > 60_000_000_000 &&
            state.rows.some(row => row.trim() === 'A:\\>')) {
            report.aPrompt = await capture('a-prompt');
            await page.getByTestId('bw-machine-canvas').click();
            await sendText('c:');
            cSentAtNs = Number(state.timeNs);
            phase = 'c-prompt';
        } else if (phase === 'c-prompt' && state.video.width === 720 &&
            Number(state.timeNs) > cSentAtNs + 1_000_000_000 &&
            state.rows.some(row => row.trim() === 'C:\\>')) {
            report.cPrompt = await capture('c-prompt');
            await page.getByTestId('bw-machine-canvas').click();
            await sendText('doom -timedemo astra -nosound');
            commandCycles = state.cycles;
            phase = 'doom';
        } else if (phase === 'doom' && state.video.width === 720 &&
            state.cycles > commandCycles + 10_000_000 &&
            state.cycles > lastTextCaptureCycles + 100_000_000) {
            const textCapture = {tick,elapsedSec:(Date.now()-started)/1000,
                cycles:state.cycles,rows:state.rows,
                canvas:await capture('text-' + String(tick).padStart(4,'0'))};
            report.textCaptures.push(textCapture);
            lastTextCaptureCycles = state.cycles;
            console.log('TEXT',JSON.stringify(textCapture));
        } else if (phase === 'doom' && state.video.width === 320 &&
            state.video.height === 200 && state.video.unique >= 100 &&
            state.video.lit >= 20000) {
            const graphic = {tick,elapsedSec:(Date.now()-started)/1000,
                cycles:state.cycles,frame:state.video.frame,
                rgbSha256:state.video.rgbSha256,unique:state.video.unique,
                lit:state.video.lit};
            if (report.graphics.length === 0 || tick % 20 === 0) {
                if (report.graphics.length === 0) {
                    graphic.widgetPixels = await captureWidgetGraphics();
                    if (!graphic.widgetPixels || graphic.widgetPixels.unique < 100 ||
                        graphic.widgetPixels.lit < 20000) continue;
                    graphic.raw = await captureGuestRgb('doom-first-guest-frame');
                    if (!graphic.raw || graphic.raw.unique < 100 || graphic.raw.lit < 20000) continue;
                }
                graphic.canvas = await capture('doom-' + String(tick).padStart(4,'0'));
                report.graphics.push(graphic);
                console.log('GRAPHICS',JSON.stringify(graphic));
            }
        } else if (phase === 'doom' && report.graphics.length &&
            state.video.width === 720 && state.video.height === 400) {
            if (state.rows.some(row => /timed 24 gametics in \d+ realtics/i.test(row)) &&
                state.rows.some(row => /C:\\>/.test(row))) {
                report.completion = {tick,elapsedSec:(Date.now()-started)/1000,
                    state,canvas:await capture('completion')};
                console.log('COMPLETION',JSON.stringify(report.completion));
                break;
            }
            if (tick % 8 === 0) console.log('TEXT_RETURN_CANDIDATE',JSON.stringify({tick,
                elapsedSec:(Date.now()-started)/1000,cycles:state.cycles,rows:state.rows}));
        }
        report.phase = phase;
    }
    report.elapsedSec = (Date.now()-started)/1000;
    report.finalState = await guestState();
    report.keyScans = await page.evaluate(() => window.__doomProbe.keyScans);
    report.passed = Boolean(report.commandEchoVerified && report.graphics.length &&
        report.graphics[0].raw?.unique >= 100 && report.graphics[0].raw?.lit >= 20000 &&
        report.graphics[0].widgetPixels?.unique >= 100 &&
        report.graphics[0].widgetPixels?.lit >= 20000 &&
        report.completion &&
        report.completion.state.rows.some(row => /timed 24 gametics in \d+ realtics/i.test(row)) &&
        report.completion.state.rows.some(row => /C:\\>/.test(row)) && errors.length === 0);
    await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
    console.log('DONE',JSON.stringify({passed:report.passed,phase:report.phase,
        elapsedSec:report.elapsedSec,graphics:report.graphics.length,
        completion:report.completion?.canvas,errors,output}));
    assert.equal(report.passed,true,
        'Doom must render graphics, report 24 gametics, and return to C: prompt');
} catch (error) {
    report.error = String(error?.stack || error);
    report.elapsedSec = (Date.now()-started)/1000;
    try { report.finalState = await guestState(); } catch { /* page may have crashed */ }
    await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
    throw error;
} finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
}
