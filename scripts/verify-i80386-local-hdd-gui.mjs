#!/usr/bin/env node
// Served-GUI proof: the real Machine Manager file inputs boot an owned 386 HDD.
// No DOS, Windows, or other third-party media is included in this fixture.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {chromium} from 'playwright';

// Optional finite installed-consumer acceptance. The manifest supplies reviewed
// identities, not a producer-issued qualification flag. No external media acquisition.
const PERSISTENCE_INPUTS = Object.freeze({
    floppy: {byteLength: 1228800, sha256: '03df6088be016e57a6c44275f5bb9ab0244db71de1360957fd76ba83243b6a77'},
    hdd: {byteLength: 10653696, sha256: '2fa9c252f22cec4f8c5bdc82d1587293ffcaed791e0982384628d19a7316a851'},
    bios: {byteLength: 65536, sha256: '6481181809b58a9f805346a7ecf9bebdaf5b322c32825fb49ee89da51552c4ac'},
    vgaRom: {byteLength: 38400, sha256: '76af53f14955df3edd6365daa64393e91fafe55241c2c00384ff05b740431da1'}
});
const PERSISTENCE_CRITICAL = Object.freeze([
    'vendor-pins.json', 'package.json', 'packages/scratch-gui/package.json',
    'node_modules/bw-board/package.json', 'node_modules/bw-board/src/i80386-debug.js',
    'node_modules/bw-board/src/i80386-adapter.js',
    'node_modules/bw-board/src/i8086-cga.js', 'scripts/lib/i80386-vga-text.mjs',
    'scripts/package-provenance.mjs', 'scripts/verify-i80386-local-hdd-gui.mjs',
    ...['overlay', 'packages'].flatMap(base => [
        `${base}/scratch-gui/src/lib/bw-debug/debug-runner.js`,
        `${base}/scratch-gui/src/components/tw-pseudocode/debug-panel.jsx`
    ]),
    'overlay/scratch-gui/src/lib/bw-machines/raw-hdd-download.js',
    'overlay/scratch-gui/src/components/tw-pseudocode/debug-drawer.jsx',
    'overlay/scratch-gui/src/lib/bw-debug/debug-capabilities.js',
    'overlay/scratch-gui/src/lib/bw-debug/memory-view.js'
]);
const persistenceSha = bytes => createHash('sha256').update(bytes).digest('hex');
function persistenceClosed (value, keys) {
    assert.ok(value && typeof value === 'object' && !Array.isArray(value));
    assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), 'closed admission shape');
}
function persistenceRelative (name) {
    assert.ok(typeof name === 'string' && name.length <= 512 &&
        name.split('/').every(part => /^[A-Za-z0-9_.@+-]+$/.test(part) && part !== '.' && part !== '..'),
    'plain relative inventory path required');
    return name;
}
function persistenceManifest (value) {
    persistenceClosed(value, ['schema', 'boardPin', 'sourceHead', 'criticalFiles', 'buildRoot', 'buildFiles', 'inputPaths']);
    assert.equal(value.schema, 'bw.gui-hdd-persistence-admission.v1');
    for (const key of ['boardPin', 'sourceHead']) assert.match(value[key], /^[0-9a-f]{40}$/);
    persistenceClosed(value.criticalFiles, PERSISTENCE_CRITICAL);
    persistenceClosed(value.inputPaths, Object.keys(PERSISTENCE_INPUTS));
    assert.equal(typeof value.buildRoot, 'string'); assert.ok(value.buildRoot.length > 0);
    for (const path of Object.values(value.inputPaths)) assert.ok(typeof path === 'string' && path.length > 0);
    const buildNames = Object.keys(value.buildFiles);
    assert.ok(buildNames.length > 0 && buildNames.length <= 8192 && buildNames.includes('index.html'));
    let total = 0;
    for (const [name, row] of [...Object.entries(value.criticalFiles), ...Object.entries(value.buildFiles)]) {
        persistenceRelative(name); persistenceClosed(row, ['byteLength', 'sha256']);
        assert.ok(Number.isSafeInteger(row.byteLength) && row.byteLength > 0 && row.byteLength <= 32 * 1024 * 1024);
        assert.match(row.sha256, /^[0-9a-f]{64}$/); total += row.byteLength;
    }
    assert.ok(total <= 512 * 1024 * 1024, 'bounded admitted source/build bytes');
    return value;
}
function persistenceGitAdmission (admission, critical, git) {
    assert.equal(git(['rev-parse', '--verify', 'HEAD']).toString().trim(), admission.sourceHead, 'checkout HEAD differs from reviewed source');
    for (const [name, bytes] of Object.entries(critical)) {
        if (name.startsWith('node_modules/')) continue; // selected installed supplier profile, externally admitted
        assert.ok(git(['cat-file', 'blob', `${admission.sourceHead}:${name}`]).equals(bytes), 'tracked consumer/probe differs from exact Git blob');
    }
}
function persistenceSupplierResolution (expectedManifest, fromGui, realpath) {
    assert.equal(realpath(fromGui.resolve('bw-board/package.json')), realpath(expectedManifest),
        'GUI resolves a shadow supplier instead of the admitted installed board');
}
function persistencePackagePins (admission, critical, githubIdentityMatches) {
    const canonicalFields = {'package.json': 'devDependencies', 'packages/scratch-gui/package.json': 'dependencies'};
    for (const [name, field] of Object.entries(canonicalFields)) {
        const pkg = JSON.parse(critical[name]);
        assert.ok(githubIdentityMatches(pkg[field]?.['bw-board'], 'CrispStrobe', 'bw-board', admission.boardPin),
            'declared supplier pin mismatch');
        for (const other of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
            if (other === field) continue;
            assert.ok(!Object.hasOwn(pkg[other] || {}, 'bw-board'), 'ambiguous supplier declaration');
        }
    }
}
function persistenceSnapshotSources (critical) {
    // Presence checks only; exact selected bytes are admitted separately above.
    assert.match(critical['node_modules/bw-board/src/i80386-debug.js'].toString('utf8'),
        /target\.snapshotAtaMaster\s*=\s*async\s*\(/, 'required supplier snapshot assignment unavailable');
    for (const name of ['overlay/scratch-gui/src/lib/bw-debug/debug-runner.js',
        'packages/scratch-gui/src/lib/bw-debug/debug-runner.js']) {
        assert.match(critical[name].toString('utf8'), /async\s+snapshotAtaMaster\s*\(/,
            'required runner snapshot method unavailable');
    }
}
function persistenceReady () {
    const target = window.__benchTarget;
    if (typeof target?.regs !== 'function' || typeof target?.timeNs !== 'function' ||
        typeof target?.state !== 'function') return false;
    try {
        const regs = target.regs(), timeNs = Number(target.timeNs());
        return Number.isSafeInteger(regs?.cpuCycles) && regs.cpuCycles >= 0 &&
            Number.isFinite(timeNs) && timeNs >= 0;
    } catch {return false;} // transient attachment still has a bounded readiness wait
}
function persistenceCounter (state, previous) {
    assert.ok(Number.isSafeInteger(state.cpuCycles) && state.cpuCycles >= 0 && state.cpuCycles <= 240000000,
        'bounded explicit CPU completion counter required');
    assert.ok(Number.isFinite(state.timeNs) && state.timeNs >= 0 && state.timeNs <= 240000000000,
        'bounded simulated time required');
    if (previous) assert.ok(state.cpuCycles >= previous.cpuCycles && state.timeNs >= previous.timeNs,
        'guest counters regressed within page');
}
function persistenceBootAction (text, state) {
    if (!state.declined && /Do you want to proceed/i.test(text)) {state.declined = true; return 'n';}
    if (!state.entered && !state.declined && /press \[ENTER\]|Select from Menu/i.test(text)) {state.entered = true; return '';}
    return null;
}
async function persistenceCloseServer (server, bounded) {
    let primary, finish;
    const closed = new Promise(resolve => {finish = resolve;});
    try {server.close(error => {primary ||= error; finish();});}
    catch (error) {primary = error; finish();}
    // Only this harness's local server and its own connections. Attempt drain
    // even if close itself failed; preserve the first cleanup error.
    try {server.closeAllConnections();} catch (error) {primary ||= error;}
    try {await bounded(closed);} catch (error) {primary ||= error;}
    if (primary) throw primary;
}
function persistenceOutput (root, fs, path) {
    const directory = path.resolve(root);
    let component = path.parse(directory).root;
    for (const part of path.dirname(directory).slice(component.length).split('/').filter(Boolean)) {
        component = path.join(component, part);
        const stat = fs.lstatSync(component); assert.ok(stat.isDirectory() && !stat.isSymbolicLink());
    }
    fs.mkdirSync(directory, {mode:0o700}); // existing file/directory, including symlink, refuses
    const identity = fs.lstatSync(directory);
    return (name, bytes) => {
        assert.ok(/^[a-z0-9][a-z0-9.-]*$/.test(name) && name !== '.' && name !== '..');
        const current = fs.lstatSync(directory);
        assert.ok(current.isDirectory() && !current.isSymbolicLink() && current.dev === identity.dev && current.ino === identity.ino);
        assert.ok(Buffer.isBuffer(bytes) && bytes.length <= 16 * 1024 * 1024);
        const fd = fs.openSync(path.join(directory,name), fs.constants.O_WRONLY | fs.constants.O_CREAT |
            fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
        let primary;
        try {let offset = 0; while (offset < bytes.length) {
            const count = fs.writeSync(fd,bytes,offset,bytes.length-offset); assert.ok(count > 0); offset += count;
        }} catch (error) {primary = error;}
        try {fs.closeSync(fd);} catch (error) {primary ||= error;}
        if (primary) throw primary;
    };
}
function persistenceProgress (before) {
    const target = window.__benchTarget;
    const timeNs = Number(target?.timeNs?.());
    const state = target?.state?.();
    const phase = document.querySelector('[data-debug-panel]')?.getAttribute('data-debug-phase');
    return Number.isFinite(timeNs) && timeNs >= before.timeNs + 100000000 ||
        state !== before.state || phase !== before.phase;
}
async function persistenceDownloads (page, action, bounded) {
    const downloads = [], names = new Set();
    let resolve, reject, primary;
    const ready = new Promise((yes, no) => {resolve = yes; reject = no;});
    // A click may fail before the event promise is awaited.
    ready.catch(() => {});
    const fail = error => {if (!primary) primary = error; reject(primary);};
    const download = value => {
        try {
            const name = value.suggestedFilename();
            assert.ok(['386-master-hdd.img', '386-master-hdd.json'].includes(name), 'unexpected download');
            assert.ok(!names.has(name), 'duplicate download');
            names.add(name); downloads.push(value);
            if (downloads.length === 2) resolve();
        } catch (error) {fail(error);}
    };
    const crash = () => fail(new Error('browser page crashed during download'));
    const listeners = [['download', download], ['pageerror', fail], ['crash', crash]];
    try {
        for (const [name, listener] of listeners) page.on(name, listener);
        await action();
        await bounded(ready);
        if (primary) throw primary;
    } catch (error) {if (!primary) primary = error;}
    finally {
        for (const [name, listener] of listeners) {
            try {page.off(name, listener);} catch (error) {if (!primary) primary = error;}
        }
    }
    if (primary) throw primary;
    return downloads;
}
async function persistencePreflight (manifestPath) {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const {githubIdentityMatches} = await import('./package-provenance.mjs');
    const root = new URL('../', import.meta.url);
    // No symlink components, FIFO opens or caller-declared extents before allocation.
    const regular = (filename, max) => {
        const absolute = path.resolve(filename);
        let component = path.parse(absolute).root;
        for (const part of absolute.slice(component.length).split('/').filter(Boolean)) {
            component = path.join(component, part);
            assert.equal(fs.lstatSync(component).isSymbolicLink(), false, 'symlink input/build route refused');
        }
        const fd = fs.openSync(absolute, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
        let primary, bytes;
        try {
            const stat = fs.fstatSync(fd);
            assert.ok(stat.isFile() && stat.size > 0 && stat.size <= max, 'bounded regular file required');
            bytes = Buffer.alloc(stat.size); let offset = 0;
            while (offset < bytes.length) {const n = fs.readSync(fd, bytes, offset, bytes.length - offset, offset); assert.ok(n > 0, 'short file'); offset += n;}
            const extra = Buffer.alloc(1); assert.equal(fs.readSync(fd, extra, 0, 1, offset), 0, 'file grew');
            const after = fs.fstatSync(fd), named = fs.lstatSync(absolute);
            assert.ok(after.dev === stat.dev && after.ino === stat.ino && after.size === stat.size &&
                named.dev === stat.dev && named.ino === stat.ino && !named.isSymbolicLink(), 'file identity changed');
        } catch (error) {primary = error;}
        try {fs.closeSync(fd);} catch (error) {primary ||= error;}
        if (primary) throw primary; return bytes;
    };
    const admissionBytes = regular(manifestPath, 4 * 1024 * 1024);
    const admission = persistenceManifest(JSON.parse(admissionBytes.toString('utf8')));
    const critical = {};
    for (const [name, row] of Object.entries(admission.criticalFiles)) {
        const bytes = regular(new URL(name, root).pathname, 32 * 1024 * 1024);
        assert.equal(bytes.length, row.byteLength); assert.equal(persistenceSha(bytes), row.sha256); critical[name] = bytes;
    }
    for (const name of ['src/lib/bw-debug/debug-runner.js', 'src/components/tw-pseudocode/debug-panel.jsx']) {
        assert.ok(critical[`overlay/scratch-gui/${name}`].equals(critical[`packages/scratch-gui/${name}`]), 'tracked consumer mirrors differ');
    }
    const {execFileSync} = await import('node:child_process');
    persistenceGitAdmission(admission, critical, args => execFileSync('/usr/bin/git',
        ['--no-replace-objects','-c','core.fsmonitor=false','-c','core.hooksPath=/dev/null','-C',root.pathname,...args],
        {timeout:10000,maxBuffer:32*1024*1024,env:{PATH:'/usr/bin:/bin',LANG:'C',GIT_CONFIG_NOSYSTEM:'1',
            GIT_CONFIG_GLOBAL:'/dev/null',GIT_NO_LAZY_FETCH:'1',GIT_TERMINAL_PROMPT:'0'}}));
    assert.equal(JSON.parse(critical['vendor-pins.json'])['bw-board'], admission.boardPin);
    persistencePackagePins(admission, critical, githubIdentityMatches);
    assert.equal(JSON.parse(critical['node_modules/bw-board/package.json']).name, 'bw-board');
    const {createRequire} = await import('node:module');
    persistenceSupplierResolution(new URL('node_modules/bw-board/package.json',root).pathname,
        createRequire(new URL('packages/scratch-gui/package.json',root)), fs.realpathSync);
    persistenceSnapshotSources(critical);
    assert.match(critical['overlay/scratch-gui/src/components/tw-pseudocode/debug-panel.jsx'].toString('utf8'), /data-debug-hdd-download/);
    const buildRoot = path.resolve(admission.buildRoot), names = [];
    let entries = 0;
    const walk = (dir, prefix = '', depth = 0) => {
        assert.ok(depth <= 32); const stat = fs.lstatSync(dir);
        assert.ok(stat.isDirectory() && !stat.isSymbolicLink());
        for (const name of fs.readdirSync(dir).sort()) {
            assert.ok(++entries <= 16384, 'bounded build tree entries');
            const relative = prefix ? `${prefix}/${name}` : name; persistenceRelative(relative);
            const file = path.join(dir, name), entry = fs.lstatSync(file);
            assert.equal(entry.isSymbolicLink(), false);
            if (entry.isDirectory()) walk(file, relative, depth + 1);
            else {assert.ok(entry.isFile()); names.push(relative); assert.ok(names.length <= 8192);}
        }
    };
    walk(buildRoot); assert.deepEqual(names.sort(), Object.keys(admission.buildFiles).sort(), 'closed build inventory');
    const buildFile = name => {
        assert.ok(Object.hasOwn(admission.buildFiles, name), 'unadmitted build route');
        const row = admission.buildFiles[name], bytes = regular(path.join(buildRoot, name), 32 * 1024 * 1024);
        assert.equal(bytes.length, row.byteLength); assert.equal(persistenceSha(bytes), row.sha256); return bytes;
    };
    for (const name of names) buildFile(name);
    const inputs = {};
    for (const [role, expected] of Object.entries(PERSISTENCE_INPUTS)) {
        const bytes = regular(admission.inputPaths[role], expected.byteLength);
        assert.equal(bytes.length, expected.byteLength); assert.equal(persistenceSha(bytes), expected.sha256); inputs[role] = bytes;
    }
    assert.equal(inputs.hdd.includes(Buffer.from('BWKEEP  TXT', 'ascii')), false, 'preseeded marker refused');
    return {admission, admissionBytes, admissionSha256: persistenceSha(admissionBytes), inputs, buildFile, regular};
}
async function admittedBrowser (regular, save) {
    const executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
    assert.ok(executablePath && executablePath.startsWith('/'),'independently admitted Chromium executable required');
    const bytes=regular(executablePath,256*1024*1024);
    assert.equal(persistenceSha(bytes),process.env.PROOF_BROWSER_SHA256,'selected browser executable digest');
    save('browser-launch.json',Buffer.from(JSON.stringify({executablePath,byteLength:bytes.length,
        sha256:persistenceSha(bytes),headless:true})));
    return chromium.launch({headless:true,executablePath});
}
async function runPersistenceGui () {
    assert.ok(process.env.PROOF_ADMISSION, 'PROOF_ADMISSION reviewed local manifest required');
    assert.ok(process.env.PROOF_OUTPUT, 'PROOF_OUTPUT new owned directory required');
    const fs = await import('node:fs'), path = await import('node:path');
    const save = persistenceOutput(process.env.PROOF_OUTPUT, fs, path);
    let preflight;
    try {preflight = await persistencePreflight(process.env.PROOF_ADMISSION);}
    catch (error) {
        try {save('failure.json',Buffer.from(JSON.stringify({phase:'preflight',firstFailure:String(error)})));}
        catch { /* Preserve the original admission refusal. */ }
        throw error;
    }
    const {admission, inputs, buildFile, regular} = preflight;
    save('admission.json', preflight.admissionBytes);
    const {createServer} = await import('node:http');
    const {decodeTextPixels, fixedTextGlyphs} = await import('./lib/i80386-vga-text.mjs');
    const originalHashes = Object.fromEntries(Object.entries(inputs).map(([name, bytes]) => [name, persistenceSha(bytes)]));
    const textProgram = `(${decodeTextPixels.toString()})(window.__benchTarget.video(),${JSON.stringify(fixedTextGlyphs())})`;
    const server = createServer((req, res) => {
        try {
            assert.equal(req.method, 'GET');
            const route = decodeURIComponent((req.url || '/').split('?')[0]);
            const name = route === '/' ? 'index.html' : persistenceRelative(route.slice(1));
            const bytes = buildFile(name);
            const extension = name.split('.').pop();
            const mime = {html:'text/html', js:'text/javascript', css:'text/css', json:'application/json',
                wasm:'application/wasm', png:'image/png', svg:'image/svg+xml', woff2:'font/woff2'};
            res.writeHead(200, {'content-type':mime[extension] || 'application/octet-stream'}); res.end(bytes);
        } catch {res.writeHead(404); res.end('unadmitted build route');}
    });
    await new Promise((resolve, reject) => {server.once('error', reject); server.listen(0, '127.0.0.1', resolve);});
    let browser, primary, proof;
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const contexts = [], pages = [], observations = [], actions = [];
    const previous = new WeakMap();
    const deadline = Date.now() + 1250000;
    const marker = 'bw-hdd-persist-ok';
    const bounded = async operation => {
        let timer;
        try {return await Promise.race([operation, new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('bounded browser operation expired')), 30000);
        })]);} finally {clearTimeout(timer);}
    };
    const observe = async page => {
        if (primary) throw primary;
        assert.ok(Date.now() < deadline, 'total wall limit');
        const state = await page.evaluate(program => {
            const target = window.__benchTarget, regs = target?.regs?.(), frame = target?.video?.();
            const completeText = frame?.mode === 3 && frame.width === 720 && frame.height === 400 && frame.rgba?.length === 720 * 400 * 4;
            return {text: completeText ? (0,eval)(program) : '', timeNs: Number(target?.timeNs?.()), cpuCycles: regs?.cpuCycles, machineCycles: regs?.cycles,
                state: target?.state?.(), phase: document.querySelector('[data-debug-panel]')?.getAttribute('data-debug-phase')};
        }, textProgram);
        persistenceCounter(state, previous.get(page)); previous.set(page, state);
        observations.push({page:pages.indexOf(page)+1,...state}); assert.ok(observations.length <= 4096); return state;
    };
    const until = async (page, predicate, timeout = 600000) => {
        const end = Math.min(deadline, Date.now() + timeout);
        while (Date.now() < end) {
            const state = await observe(page); if (predicate(state)) return state;
            await page.waitForFunction(persistenceProgress, state, {timeout:Math.max(1, end - Date.now())});
        }
        throw new Error('bounded guest observation expired');
    };
    const response = (text, command, needMarker = false) => {
        const lines = text.split('\n').map(line => line.trim());
        const echo = lines.findLastIndex(line => line.toLowerCase().endsWith(`>${command}`));
        if (echo < 0) return false;
        const later = lines.slice(echo + 1);
        const markerAt = later.indexOf(marker);
        return later.some((line, index) => /^[A-Z]:\\[^>]*>\s*$/i.test(line) &&
            (!needMarker || (markerAt >= 0 && index > markerAt)));
    };
    const prompt = text => /(?:^|\n)[A-Z]:\\[^\n]*>\s*(?:\n|$)/i.test(text);
    const stable = async (page, predicate) => {
        const first = await until(page, predicate); let start = first.timeNs;
        return until(page, state => {if (!predicate(state)) {start = state.timeNs; return false;}
            return state.timeNs >= start + 2000000000;});
    };
    const send = async (page, command) => {
        await page.getByTestId('bw-machine-canvas').click();
        for (const char of `${command}\r`) {
            const key = char === '\r' ? 'Enter' : char === ' ' ? 'Space' : char === '\\' ? 'Backslash' :
                char === ':' ? 'Shift+Semicolon' : char === '>' ? 'Shift+Period' : char;
            await page.keyboard.press(key);
            const at = (await observe(page)).timeNs;
            await until(page, state => state.timeNs >= at + 100000000, 30000);
        }
    };
    const boot = async hdd => {
        const context = await browser.newContext({viewport:{width:1600,height:1000}, serviceWorkers:'block', acceptDownloads:true});
        contexts.push(context);
        await context.route('**/*', route => {
            const url = route.request().url();
            return url.startsWith(`${baseUrl}/`) || url.startsWith('blob:') || url.startsWith('data:') ? route.continue() : route.abort();
        });
        const page = await context.newPage(); pages.push(page);
        page.on('pageerror', error => {primary ||= error;}); page.on('crash', () => {primary ||= new Error('browser page crashed');});
        await page.addInitScript(() => {localStorage.clear(); localStorage.setItem('bw-starter-v1-complete','1');});
        await page.goto(baseUrl, {waitUntil:'domcontentloaded', timeout:90000});
        const dismiss = page.getByTestId('bw-starter-backdrop').getByRole('button',{name:'Not now'});
        if (await dismiss.count()) await dismiss.click();
        await page.getByRole('tab',{name:'Code',exact:true}).click();
        const toggle = page.locator('[data-right-pane-toggle]');
        if (await toggle.count() && await toggle.getAttribute('aria-pressed') === 'false') await toggle.click();
        await page.getByTestId('bw-device-select').selectOption('__manage__');
        await page.getByTestId('bw-machine-manager').waitFor();
        await page.getByRole('combobox', {name: 'Machine type'}).selectOption('i80386');
        for (const [slot, bytes] of Object.entries({...inputs, hdd})) {
            await page.getByTestId(`bw-mm-free386-${slot}`).setInputFiles({name:`${slot}.img`,mimeType:'application/octet-stream',buffer:bytes});
        }
        assert.equal(await page.getByTestId('bw-mm-free386-native-blocks').isChecked(), false);
        await page.getByTestId('bw-mm-free386-run').click();
        await page.getByTestId('bw-machine-manager').waitFor({state:'detached',timeout:90000});
        // Modal removal precedes async runner import/attach; no absent-counter fallback.
        await page.waitForFunction(persistenceReady, undefined, {timeout:30000});
        const menu = {entered:false,declined:false};
        const bootDeadline = Math.min(deadline,Date.now()+600000);
        for (;;) {
            assert.ok(Date.now() < bootDeadline, 'boot menu wall limit');
            const state = await observe(page);
            if (menu.declined && /installation of FreeDOS .* has been aborted/i.test(state.text) && prompt(state.text)) break;
            const command = persistenceBootAction(state.text,menu);
            if (command !== null) await send(page,command);
            else await page.waitForFunction(persistenceProgress, state, {timeout:Math.max(1, bootDeadline - Date.now())});
        }
        assert.ok(await page.locator('[data-debug-hdd-download]').count(), 'loaded runtime exposes both bridge and target snapshot support');
        return page;
    };
    try {
        browser = await admittedBrowser(regular,save);
        const first = await boot(inputs.hdd);
        actions.push({action:'write-marker',page:1});
        await send(first, 'echo bw-hdd-persist-ok>c:\\bwkeep.txt');
        await stable(first, state => response(state.text, 'echo bw-hdd-persist-ok>c:\\bwkeep.txt'));
        actions.push({action:'read-original',page:1});
        await send(first, 'type c:\\bwkeep.txt');
        await stable(first, state => response(state.text, 'type c:\\bwkeep.txt', true));
        actions.push({action:'pause',page:1});
        await first.locator('[data-debug-panel]').getByRole('button',{name:/Pause|⏸/}).click();
        await first.locator('[data-debug-panel][data-debug-phase="paused"]').waitFor();
        const pausedBoundary = await observe(first);
        assert.ok(Number.isSafeInteger(pausedBoundary.machineCycles) && pausedBoundary.machineCycles >= 0);
        await first.evaluate(() => {window.__hddProofOriginalTarget = window.__benchTarget;});
        const witness = async () => ({...await observe(first),sameTarget:await first.evaluate(() =>
            window.__benchTarget === window.__hddProofOriginalTarget)});
        const paused = await witness();
        actions.push({action:'download',page:1});
        const downloads = await persistenceDownloads(first,
            () => first.locator('[data-debug-hdd-download]').click(), bounded);
        const bodies = {};
        for (const download of downloads) {
            assert.equal(await bounded(download.failure()), null);
            const name = download.suggestedFilename(); assert.ok(['386-master-hdd.img','386-master-hdd.json'].includes(name));
            assert.equal(Object.hasOwn(bodies,name), false);
            const path = await bounded(download.path()); assert.ok(path); bodies[name] = regular(path, name.endsWith('.json') ? 65536 : 10653696);
            save(name,bodies[name]); // exact original download bytes before JSON decoding
        }
        const exported = bodies['386-master-hdd.img'], metadata = JSON.parse(bodies['386-master-hdd.json']);
        assert.equal(exported.length, 10653696); assert.notEqual(persistenceSha(exported), originalHashes.hdd);
        persistenceClosed(metadata, ['schema','snapshotSchema','drive','byteLength','sha256','geometry','boundary','boundaryMeaning','guestCompletionQualified','crashDurabilityQualified']);
        persistenceClosed(metadata.boundary, ['cpuCycles','machineCycles']);
        for (const value of Object.values(metadata.boundary)) assert.ok(Number.isSafeInteger(value) && value >= 0);
        assert.equal(metadata.boundary.cpuCycles,pausedBoundary.cpuCycles);
        assert.equal(metadata.boundary.machineCycles,pausedBoundary.machineCycles);
        assert.equal(metadata.snapshotSchema,'bw.i80386-master-hdd-copy.v1');
        assert.equal(metadata.schema,'bw.i80386-master-hdd-download.v1');
        assert.equal(metadata.drive,'master'); assert.equal(metadata.byteLength,exported.length);
        assert.equal(metadata.sha256,persistenceSha(exported));
        assert.deepEqual(metadata.geometry,{cylinders:306,heads:4,sectors:17});
        assert.equal(metadata.boundaryMeaning,'settled-detached-copy');
        assert.equal(metadata.guestCompletionQualified,false); assert.equal(metadata.crashDurabilityQualified,false);
        const downloaded = await witness();
        actions.push({action:'reload-export',page:2});
        const second = await boot(exported);
        actions.push({action:'read-reloaded',page:2});
        await send(second, 'type c:\\bwkeep.txt');
        await stable(second, state => response(state.text, 'type c:\\bwkeep.txt', true));
        assert.equal(await first.evaluate(() => window.__benchTarget === window.__hddProofOriginalTarget), true, 'original session retained');
        assert.equal(await first.locator('[data-debug-panel]').getAttribute('data-debug-phase'), 'paused');
        const retainedBoundary = await observe(first);
        assert.equal(retainedBoundary.cpuCycles,pausedBoundary.cpuCycles);
        assert.equal(retainedBoundary.machineCycles,pausedBoundary.machineCycles);
        actions.push({action:'retain-original',page:1});
        save('session-witnesses.json',Buffer.from(JSON.stringify({paused,downloaded,retained:await witness(),
            reloaded:{page:2,sameAsOriginal:await second.evaluate(() =>
                window.__benchTarget === window.__hddProofOriginalTarget)},actions})));
        for (const [role, expected] of Object.entries(PERSISTENCE_INPUTS)) {
            assert.equal(persistenceSha(regular(admission.inputPaths[role], expected.byteLength)), originalHashes[role]);
            assert.equal(persistenceSha(inputs[role]), originalHashes[role]);
        }
        if (primary) throw primary;
        for (let i=0;i<pages.length;i++) save(`session-${i+1}.png`, await bounded(pages[i].getByTestId('bw-machine-canvas').screenshot()));
        proof = {ok:true,scenario:'freedos-hdd-persistence',boardPin:admission.boardPin,sourceHead:admission.sourceHead,
            admissionSha256:preflight.admissionSha256,inputs:originalHashes,exportSha256:persistenceSha(exported),
            geometry:metadata.geometry,marker,downloadsSaved:2,freshSessionReadback:true,originalSessionRetained:true,
            fullOsQualified:false,crashDurabilityQualified:false,sourceBuildAuthenticityQualified:false};
    } catch (error) {
        primary ||= error;
        // Keep bounded text observations, not media or mutable guest memory.
        for (let i=0;i<pages.length;i++) {
            try {save(`failure-session-${i+1}.png`, await bounded(pages[i].getByTestId('bw-machine-canvas').screenshot({timeout:5000})));}
            catch { /* Best-effort witness cannot replace the original refusal. */ }
        }
    } finally {
        for (const context of contexts) {try {await bounded(context.close());} catch(error) {primary ||= error;}}
        if (browser) {try {await bounded(browser.close());} catch(error) {primary ||= error;}}
        try {await persistenceCloseServer(server,bounded);} catch(error) {primary ||= error;}
        try {save('observations.json',Buffer.from(JSON.stringify(observations)));} catch(error) {primary ||= error;}
        try {save(primary ? 'failure.json' : 'proof.json',Buffer.from(JSON.stringify(primary ?
            {scenario:'freedos-hdd-persistence',firstFailure:String(primary)} : proof,null,2)));} catch(error) {primary ||= error;}
    }
    if (primary) throw primary;
    console.log(JSON.stringify(proof));
}


// Authored ordinary real-mode loop. EDI's upper half is deliberate: a 16-bit
// alias or truncated UI cannot pass. This is not a mode-aware disassembler test.
function forwardBootDisk () {
    const bytes = Buffer.alloc(512 * 4 * 17);
    Buffer.from('fa31c08ed866b87856341266bfefcdab896640ebfc','hex').copy(bytes);
    bytes[510] = 0x55; bytes[511] = 0xaa;
    return bytes;
}
function forwardStepTransition (before, after) {
    assert.ok([0x7c11,0x7c13].includes(before.regs.pc));
    assert.equal(after.regs.pc,before.regs.pc === 0x7c11 ? 0x7c13 : 0x7c11);
    assert.equal(after.regs.eax,(before.regs.eax + (before.regs.pc === 0x7c11 ? 1 : 0)) >>> 0);
    assert.equal(after.regs.edi,0x89abcdef);
    assert.equal(after.phase,'paused'); assert.ok(after.cpuCycles > before.cpuCycles);
}
function forwardReadOnlyState () {
    const target = window.__benchTarget, regs = target.regs();
    return {regs, cpuCycles:regs.cpuCycles, machineCycles:regs.cycles, timeNs:Number(target.timeNs()),
        state:target.state(), phase:document.querySelector('[data-debug-panel]')?.getAttribute('data-debug-phase'),
        sameTarget:target === window.__forwardOriginalTarget};
}
async function forwardLocalMedia (page, disk) {
    const configuration='[cpu]\ncputype=auto\n[autoexec]\nimgmount c "forward-owned.img" -t hdd -size 512,17,4,1\n';
    await page.getByTestId('bw-mm-local-disk').setInputFiles({name:'forward-owned.img',mimeType:'application/octet-stream',buffer:disk});
    await page.getByTestId('bw-mm-local-conf').setInputFiles({name:'forward-owned.conf',mimeType:'text/plain',buffer:Buffer.from(configuration)});
    // Input change dispatch does not await File.text(). The import textarea
    // renders the same React text state consumed by MachineManager.runLocal.
    await page.waitForFunction(expected => document.querySelector('[data-testid="bw-mm-import-text"]')?.value===expected,
        configuration,{timeout:10000});
    await page.getByTestId('bw-mm-local-run').click();
    await page.getByTestId('bw-machine-manager').waitFor({state:'detached'});
}
async function forwardMemoryPage (page, panel) {
    // Browser promptAsync awaits the native prompt; accepting it still precedes
    // React's memory-page commit. The read-only label exists on the old page.
    const answered=page.waitForEvent('dialog',{timeout:10000}).then(async dialog => {
        assert.equal(dialog.type(),'prompt');assert.equal(dialog.message(),'Memory address (hex)');
        await dialog.accept('7C00');
    });
    await Promise.all([answered,panel.getByRole('button',{name:'Go to address',exact:true}).click()]);
    await panel.locator('[title="00007C00 — read-only"]').waitFor({state:'visible',timeout:10000});
}
async function forwardOpenDrawer (panel) {
    await panel.getByRole('button',{name:/Under the hood/}).click();
    // The toggle's React setState does not return its render completion.
    await panel.getByRole('button',{name:'Step instruction',exact:true}).waitFor({state:'visible',timeout:10000});
}
async function forwardRegistersReady (page, eax) {
    await page.waitForFunction(expected => {
        const rendered=document.querySelector('[data-debug-panel]')?.innerText || '';
        return new RegExp('EAX\\s+'+expected.toString(16).toUpperCase().padStart(8,'0')).test(rendered) &&
            /EDI\s+89ABCDEF/.test(rendered);
    },eax,{timeout:10000});
}
async function runForwardGui () {
    assert.ok(process.env.PROOF_ADMISSION && process.env.PROOF_OUTPUT,'reviewed manifest and fresh output required');
    const fs = await import('node:fs'), path = await import('node:path');
    const save = persistenceOutput(process.env.PROOF_OUTPUT,fs,path), trace = [];
    let server, browser, context, page, primary;
    const deadline = Date.now()+180000;
    const bounded = async operation => {
        let timer;
        try {return await Promise.race([operation,new Promise((_,reject) => {
            timer=setTimeout(() => reject(new Error('bounded forward-debug operation expired')),
                Math.max(1,Math.min(30000,deadline-Date.now())));
        })]);} finally {clearTimeout(timer);}
    };
    try {
        const preflight = await persistencePreflight(process.env.PROOF_ADMISSION);
        save('admission.json',preflight.admissionBytes);
        const {createServer} = await import('node:http');
        server=createServer((req,res) => {
            try {
                assert.equal(req.method,'GET');
                const name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\//,'') || 'index.html';
                persistenceRelative(name);const bytes=preflight.buildFile(name);
                const extension=name.split('.').pop();
                res.writeHead(200,{'content-type':({html:'text/html',js:'text/javascript',css:'text/css',
                    json:'application/json',wasm:'application/wasm',png:'image/png',svg:'image/svg+xml'})[extension] || 'application/octet-stream'});
                res.end(bytes);
            } catch {res.writeHead(404);res.end('unadmitted build route');}
        });
        await bounded(new Promise((resolve,reject) => {server.once('error',reject);server.listen(0,'127.0.0.1',resolve);}));
        const base=`http://127.0.0.1:${server.address().port}`;
        browser=await admittedBrowser(preflight.regular,save);
        context=await browser.newContext({viewport:{width:1600,height:1200},serviceWorkers:'block',locale:'en-US'});
        await context.route('**/*',route => route.request().url().startsWith(base+'/') ||
            /^(blob:|data:)/.test(route.request().url()) ? route.continue() : route.abort());
        page=await context.newPage();page.on('pageerror',error => {primary ||= error;});page.on('crash',() => {primary ||= new Error('forward browser crashed');});
        await page.addInitScript(() => {localStorage.clear();localStorage.setItem('bw-starter-v1-complete','1');});
        await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
        const dismiss=page.getByTestId('bw-starter-backdrop').getByRole('button',{name:'Not now'});
        if (await dismiss.count()) await dismiss.click();
        await page.getByRole('tab',{name:'Code',exact:true}).click();
        const toggle=page.locator('[data-right-pane-toggle]');
        if (await toggle.count() && await toggle.getAttribute('aria-pressed')==='false') await toggle.click();
        await page.getByTestId('bw-device-select').selectOption('__manage__');
        await page.getByTestId('bw-machine-manager').waitFor();
        const disk=forwardBootDisk();save('authored-boot.sha256',Buffer.from(persistenceSha(disk)+'\n'));
        await forwardLocalMedia(page,disk);
        await page.waitForFunction(() => {
            const r=window.__benchTarget?.regs?.();return r?.edi===0x89abcdef && [0x7c11,0x7c13].includes(r.pc);
        },undefined,{timeout:30000});
        await page.evaluate(() => {window.__forwardOriginalTarget=window.__benchTarget;});
        const panel=page.locator('[data-debug-panel]');
        const snap=async (action,extra={}) => {
            assert.ok(Date.now()<deadline,'total forward-debug wall bound');if(primary)throw primary;
            const state=await page.evaluate(forwardReadOnlyState);persistenceCounter(state);
            assert.ok(state.sameTarget);assert.equal(state.regs.edi,0x89abcdef);
            for(const name of ['eax','edi','eip','eflags'])assert.ok(Number.isSafeInteger(state.regs[name]) && state.regs[name]>=0 && state.regs[name]<=0xffffffff);
            const item={action,...state,...extra};trace.push(item);return item;
        };
        await panel.getByRole('button',{name:/Pause|⏸/}).click();
        await page.locator('[data-debug-panel][data-debug-phase="paused"]').waitFor();
        const paused=await snap('pause');
        await forwardOpenDrawer(panel);
        // Normalize only through the real single-instruction button so the
        // future breakpoint is visible in the existing forward-only listing.
        const alignStep=paused.regs.pc===0x7c13;
        if(alignStep)await panel.getByRole('button',{name:'Step instruction',exact:true}).click();
        const aligned=await snap('align',{stepPerformed:alignStep});
        if(alignStep)forwardStepTransition(paused,aligned);else assert.equal(aligned.cpuCycles,paused.cpuCycles);
        assert.equal(aligned.regs.pc,0x7c11);
        const codeRows=panel.locator('[title="Click to pause here"]');
        let selected;
        for(const row of await codeRows.all()) {
            const address=await row.locator('span').nth(1).innerText();
            if(parseInt(address,16)===0x7c13){selected=row;break;}
        }
        assert.ok(selected,'actual code row for authored loop breakpoint is available');
        await selected.click();await snap('breakpoint-add',{breakpointAddress:0x7c13});
        await panel.locator('[data-debug-run]').click();
        await page.waitForFunction(before => {
            const r=window.__benchTarget?.regs?.();return r?.pc===0x7c13 && r.cpuCycles>before &&
                document.querySelector('[data-debug-panel]')?.getAttribute('data-debug-phase')==='paused';
        },aligned.cpuCycles,{timeout:30000});
        const hit=await snap('breakpoint-hit',{breakpointAddress:0x7c13});
        await panel.getByRole('button',{name:'Step instruction',exact:true}).click();const one=await snap('step-1');forwardStepTransition(hit,one);
        await panel.getByRole('button',{name:'Step instruction',exact:true}).click();const two=await snap('step-2');forwardStepTransition(one,two);
        await forwardRegistersReady(page,two.regs.eax);
        const rendered=await panel.innerText();
        assert.match(rendered,new RegExp(`EAX\\s+${two.regs.eax.toString(16).toUpperCase().padStart(8,'0')}`));
        assert.match(rendered,/EDI\s+89ABCDEF/);
        const memorySelect=panel.locator('select').filter({has:page.locator('option[value="mem"]')});
        assert.equal(await memorySelect.count(),1);await memorySelect.selectOption('mem');
        await forwardMemoryPage(page,panel);
        await panel.getByText('Read-only memory',{exact:true}).waitFor();
        const cells=[];
        for(let i=0;i<21;i++) {
            const address=(0x7c00+i).toString(16).toUpperCase().padStart(8,'0');
            const cell=panel.locator(`[title="${address} — read-only"]`);assert.equal(await cell.count(),1);
            const text=await cell.innerText(),role=await cell.getAttribute('role');assert.notEqual(role,'button');
            cells.push({address:0x7c00+i,text,role});
        }
        const bytes=cells.map(cell => parseInt(cell.text,16));
        assert.deepEqual(bytes,[...Buffer.from('fa31c08ed866b87856341266bfefcdab896640ebfc','hex')]);
        const unsupported={stepOver:await panel.getByRole('button',{name:'Step over',exact:true}).isDisabled(),
            stepOut:await panel.getByRole('button',{name:'Step out',exact:true}).isDisabled(),
            reverseStep:await panel.locator('[data-debug-reverse-step]').isDisabled(),
            reverseCycle:await panel.locator('[data-debug-reverse-cycle]').isDisabled(),
            reverseContinue:await panel.locator('[data-debug-reverse-continue]').isDisabled()};
        assert.ok(Object.values(unsupported).every(Boolean));
        const memory=await snap('physical-memory',{space:'mem',address:0x7c00,bytes,cells,readOnly:true,unsupported,renderedRegisters:rendered});
        assert.equal(memory.cpuCycles,two.cpuCycles);
        const removeRows=panel.locator('[title="Click to pause here"]');
        assert.equal(parseInt(await removeRows.first().locator('span').nth(1).innerText(),16),0x7c13);
        await removeRows.first().click();await snap('breakpoint-remove',{breakpointAddress:0x7c13});
        await panel.locator('[data-debug-run]').click();
        await page.waitForFunction(before => window.__benchTarget.regs().cpuCycles>before &&
            document.querySelector('[data-debug-panel]')?.getAttribute('data-debug-phase')==='running',two.cpuCycles,{timeout:30000});
        await snap('resume');await panel.getByRole('button',{name:/Pause|⏸/}).click();
        await page.locator('[data-debug-panel][data-debug-phase="paused"]').waitFor();const finalPause=await snap('pause-after-resume');
        await page.getByRole('tab',{name:'Circuit',exact:true}).click();await snap('circuits');
        await page.getByRole('tab',{name:'Code',exact:true}).click();const retained=await snap('code-retained');
        assert.deepEqual(retained.regs,finalPause.regs);assert.equal(retained.cpuCycles,finalPause.cpuCycles);
        save('forward-debug.png',await bounded(panel.screenshot()));
        save('proof.json',Buffer.from(JSON.stringify({ok:true,scenario:'forward-debug',sourceHead:preflight.admission.sourceHead,
            admissionSha256:preflight.admissionSha256,boardPin:preflight.admission.boardPin,
            reverseExecutionQualified:false,modeAwareDisassemblyQualified:false,fullOsQualified:false})));
    } catch(error) {
        primary ||= error;
        try{save('failure.json',Buffer.from(JSON.stringify({scenario:'forward-debug',firstFailure:String(primary)})));}catch{}
    } finally {
        if(context)try{await bounded(context.close());}catch(error){primary ||= error;}
        if(browser)try{await bounded(browser.close());}catch(error){primary ||= error;}
        if(server)try{await persistenceCloseServer(server,bounded);}catch(error){primary ||= error;}
        try{save('forward-trace.json',Buffer.from(JSON.stringify(trace)));}catch(error){primary ||= error;}
    }
    if(primary)throw primary;
}

if (process.env.PROOF_SCENARIO === 'freedos-hdd-persistence') {
    await runPersistenceGui();
} else if (process.env.PROOF_SCENARIO === 'forward-debug') {
    await runForwardGui();
} else {
    assert.ok(!process.env.PROOF_SCENARIO, 'unknown proof scenario');
const url = process.env.PROOF_URL || 'http://127.0.0.1:8777/';
const screenshot = process.env.PROOF_SCREENSHOT || null;
const marker = 'GUI LOCAL HDD BOOT OK';
// Hand-assembled 16-bit boot sector: set DS=0/ES=B800, STOSW the marker in
// text VRAM, then HLT. The string starts at physical 7C1Ch.
const prefix = Buffer.from('fa31c08ed8b800b88ec031ffbe1c7cac84c07405b41fabebf6f4ebfd', 'hex');
const disk = Buffer.alloc(512 * 4 * 17);
prefix.copy(disk);
disk.write(marker + '\0', prefix.length, 'ascii');
disk[510] = 0x55; disk[511] = 0xaa;
const conf = Buffer.from('[cpu]\ncputype=auto\n[autoexec]\n'
    + 'imgmount c "owned-boot.img" -t hdd -size 512,17,4,1\n');
const browser = await chromium.launch({headless: true});
try {
    const page = await browser.newPage({viewport: {width: 1400, height: 900}});
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 30000});
    const dismiss = page.getByTestId('bw-starter-backdrop').getByRole('button', {name: 'Not now'});
    if (await dismiss.count()) await dismiss.click();
    await page.getByRole('tab', {name: 'Code'}).click();
    const toggle = page.locator('[data-right-pane-toggle]');
    if (await toggle.count() && await toggle.getAttribute('aria-pressed') === 'false') await toggle.click();
    await page.evaluate(() => {
        window.__guiMediaProof = [];
        window.addEventListener('bw-machine-media-load', event =>
            window.__guiMediaProof.push({kind: event.detail?.kind,
                slot: event.detail?.slotId, length: event.detail?.bytes?.length}));
        window.dispatchEvent(new Event('bw-open-machine-manager'));
    });
    await page.getByTestId('bw-machine-manager').waitFor();
    await page.getByRole('combobox', {name: 'Machine type'}).selectOption('i80386');
    await page.getByTestId('bw-mm-local-disk').setInputFiles({name: 'owned-boot.img',
        mimeType: 'application/octet-stream', buffer: disk});
    await page.getByTestId('bw-mm-local-conf').setInputFiles({name: 'owned.conf',
        mimeType: 'text/plain', buffer: conf});
    await page.waitForFunction(() => document.querySelector('[data-testid="bw-mm-import-text"]')
        ?.value.includes('cputype=auto'));
    await page.getByTestId('bw-mm-local-run').click();
    await page.getByTestId('bw-machine-manager').waitFor({state: 'hidden'});
    await page.waitForFunction(() => {
        const regs = window.__benchTarget?.regs?.();
        const canvas = document.querySelector('[data-testid="bw-machine-canvas"]');
        // bw-board's 386 target reports 32-bit registers (edi); the 8086 one di.
        return regs?.halted && regs.pc === 0x7c1a && regs.edi === 2 * 21 &&
            canvas?.width === 720 && canvas?.height === 400;
    }, undefined, {timeout: 45000});
    const proof = await page.evaluate(() => {
        const target = window.__benchTarget;
        const frame = target.video();
        const canvas = document.querySelector('[data-testid="bw-machine-canvas"]');
        const pixels = canvas.getContext('2d').getImageData(0, 0, 720, 400).data;
        return {regs: target.regs(), mode: frame.mode, why: frame.why,
            width: frame.width, height: frame.height,
            media: window.__guiMediaProof,
            painted: Array.from(pixels.slice(0, 720 * 16 * 4)).every((v, i) => v === frame.rgba[i]),
            nonBlack: Array.from(pixels.slice(0, 720 * 16 * 4)).some((v, i) => (i % 4) !== 3 && v !== 0)};
    });
    assert.ok(proof.media.some(e => e.kind === 'i80386' && e.slot === 'hdd' &&
        e.length === disk.length), 'Machine Manager dispatched the selected local HDD');
    assert.equal(proof.mode, 3);
    assert.equal(proof.why, '386 VGA text planes');
    assert.equal(proof.painted, true, 'Widgets canvas contains the guest VGA frame');
    assert.equal(proof.nonBlack, true, 'the guest wrote visible text pixels');
    assert.deepEqual(errors, [], 'no browser script error');
    if (screenshot) writeFileSync(screenshot,
        await page.getByTestId('bw-machine-canvas').screenshot());
    const boardPin = JSON.parse(readFileSync(new URL('../vendor-pins.json', import.meta.url)))['bw-board'];
    console.log(JSON.stringify({ok: true, boardPin, diskSha256:
        createHash('sha256').update(disk).digest('hex'), confSha256:
        createHash('sha256').update(conf).digest('hex'), pc: proof.regs.pc,
        cycles: proof.regs.cycles, mode: proof.mode, canvas: [proof.width, proof.height],
        marker, screenshot: screenshot || null}));
} finally {
    await browser.close();
}

}
