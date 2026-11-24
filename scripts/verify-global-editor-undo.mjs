#!/usr/bin/env node
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {extname, join, normalize, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = join(root, 'packages', 'scratch-gui', 'build');
const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.json': 'application/json', '.wasm': 'application/wasm'};
let server = null;
let url = process.env.PROOF_URL || null;
if (!url) {
    if (!existsSync(join(build, 'index.html'))) throw new Error('Build first: scratch-gui/build is missing');
    server = createServer(async (req, res) => {
        try {
            let requestPath = decodeURIComponent(req.url.split('?')[0]);
            if (requestPath.endsWith('/')) requestPath += 'index.html';
            const file = join(build, normalize(requestPath));
            if (!file.startsWith(build)) throw new Error('path escape');
            res.writeHead(200, {'content-type': types[extname(file)] || 'application/octet-stream'});
            res.end(await readFile(file));
        } catch {
            if (!res.headersSent) res.writeHead(404);
            res.end('not found');
        }
    });
    await new Promise((done, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', done);
    });
    url = `http://127.0.0.1:${server.address().port}/`;
}

const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 1024, height: 768}, locale: 'de-DE'});
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => {
    localStorage.setItem('bw-starter-v1-complete', '1');
    localStorage.setItem('bw-right-pane-hidden', '0');
    localStorage.setItem('bw-debug-dock', 'controller');
});

try {
    await page.goto(`${url}?locale=de`, {waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => window.__brickwrightStore?.getState()?.scratchGui?.vm, null, {timeout: 60000});
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('bw-settings-change', {
        detail: {key: 'bw-debug-dock', value: 'controller'}
    })));

    const edit = page.getByTestId('bw-ctl-mode-edit');
    const play = page.getByTestId('bw-ctl-mode-play');
    await edit.waitFor({state: 'visible', timeout: 30000});
    if (await edit.textContent() !== '✎' || await play.textContent() !== '▶') {
        throw new Error('Edit/Play mode controls are not icon-only');
    }
    if (await edit.getAttribute('aria-label') !== 'Bearbeiten' || await play.getAttribute('aria-label') !== 'Spielen') {
        throw new Error('icon controls lost their German accessible names');
    }
    const [editBox, playBox] = await Promise.all([edit.boundingBox(), play.boundingBox()]);
    if (!editBox || !playBox || editBox.width > 36 || playBox.width > 36 || playBox.x + playBox.width > 1024) {
        throw new Error(`mode controls do not fit the iPad viewport: ${JSON.stringify({editBox, playBox})}`);
    }

    // The controller is a stage dock. At tablet widths the stage's resize veil
    // can overlap it in headless Chromium even though the control is visible;
    // force targets the actual button while still exercising its React handler.
    await edit.click({force: true});
    const before = await page.locator('[data-testid^="bw-ctl-remove-"]').count();
    await page.getByText('+ Widget hinzufügen', {exact: true}).click({force: true});
    await page.getByRole('button', {name: 'Taste', exact: true}).click({force: true});
    const after = await page.locator('[data-testid^="bw-ctl-remove-"]').count();
    if (after !== before + 1) throw new Error(`widget was not added (${before} -> ${after})`);

    const undo = page.getByTestId('bw-global-undo');
    if (await undo.isDisabled()) throw new Error('global undo stayed disabled after a widget edit');
    await undo.click();
    await page.waitForFunction(expected =>
        document.querySelectorAll('[data-testid^="bw-ctl-remove-"]').length === expected, before);
    if (!(await undo.isDisabled())) throw new Error('global undo did not disable after exhausting widget history');

    // The same menu control must hand off to CodeMirror's native history when
    // the Code tab becomes active; it must not consume Widget history again.
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('bw-activate-tab', {detail: {index: 3}})));
    const code = page.locator('[data-testid="bw-codemirror"] .cm-content');
    await code.waitFor({state: 'visible', timeout: 30000});
    const originalCode = await code.textContent();
    await code.click();
    await page.keyboard.type('undo_probe');
    await page.waitForFunction(() => {
        const button = document.querySelector('[data-testid="bw-global-undo"]');
        return button && !button.disabled && /\(Code\)$/.test(button.title);
    });
    await undo.click();
    await page.waitForFunction(expected =>
        document.querySelector('[data-testid="bw-codemirror"] .cm-content')?.textContent === expected,
    originalCode);

    // Structural project edits: deleting a costume is one step on the shared
    // project history, undone and redone from the menu bar like any edit.
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('bw-activate-tab', {detail: {index: 1}})));
    await page.waitForFunction(() => window.__bwGlobalUndo && document.querySelector('[data-testid="bw-global-redo"]'));
    const costumeNames = () => page.evaluate(() =>
        window.__brickwrightStore.getState().scratchGui.vm.editingTarget.sprite.costumes.map(costume => costume.name));
    // The project history is installed after the first paint (lazy chunk).
    await page.waitForFunction(() => window.__brickwrightStore.getState().scratchGui.vm.bwProjectHistory === true,
        null, {timeout: 30000});
    const costumes = await costumeNames();
    if (costumes.length < 2) throw new Error(`the default sprite needs two costumes, has ${costumes.length}`);
    await page.evaluate(() => window.__brickwrightStore.getState().scratchGui.vm.deleteCostume(0));
    await page.waitForFunction(count => window.__brickwrightStore.getState().scratchGui.vm.editingTarget
        .sprite.costumes.length === count, costumes.length - 1);
    await undo.click();
    await page.waitForFunction(expected => JSON.stringify(window.__brickwrightStore.getState().scratchGui.vm
        .editingTarget.sprite.costumes.map(costume => costume.name)) === expected, JSON.stringify(costumes));
    const redo = page.getByTestId('bw-global-redo');
    await redo.click();
    await page.waitForFunction(count => window.__brickwrightStore.getState().scratchGui.vm.editingTarget
        .sprite.costumes.length === count, costumes.length - 1);

    // History panel: the project step is listed and one click goes back to it.
    await page.getByTestId('bw-global-history').click();
    const panel = page.getByTestId('bw-history-panel');
    await panel.waitFor({state: 'visible', timeout: 30000});
    await page.getByTestId('bw-history-step--1').click();
    await page.waitForFunction(expected => JSON.stringify(window.__brickwrightStore.getState().scratchGui.vm
        .editingTarget.sprite.costumes.map(costume => costume.name)) === expected, JSON.stringify(costumes));
    // The keyboard walks the list too: End/Home, then Enter redoes the step.
    const focused = () => page.evaluate(() => document.activeElement.getAttribute('data-testid'));
    await page.getByTestId('bw-history-step-1').focus();
    await page.keyboard.press('End');
    const last = await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid="bw-history-list"] button'))
        .pop().getAttribute('data-testid'));
    if (await focused() !== last) throw new Error(`End focused ${await focused()}, not ${last}`);
    // Since d9aa15eef the list is the whole workspace's (moveHistory 'workspace'), so the
    // Code tab's undone edits from above are redo entries too, listed farthest first:
    // Home goes to the top entry, and ArrowDown walks to the costume step (step-1).
    const first = await page.evaluate(() => document.querySelector('[data-testid="bw-history-list"] button')
        .getAttribute('data-testid'));
    await page.keyboard.press('Home');
    if (await focused() !== first) throw new Error(`Home focused ${await focused()}, not ${first}`);
    for (let i = 0; i < 20 && await focused() !== 'bw-history-step-1'; i++) await page.keyboard.press('ArrowDown');
    if (await focused() !== 'bw-history-step-1') throw new Error(`ArrowDown stopped at ${await focused()}`);
    await page.keyboard.press('Enter');
    await page.waitForFunction(count => window.__brickwrightStore.getState().scratchGui.vm.editingTarget
        .sprite.costumes.length === count, costumes.length - 1);

    // Several real project steps: arrows move one entry and Enter on the
    // second entry undoes exactly two, rather than the old single-row probe.
    await page.getByTestId('bw-history-close').click();
    await page.evaluate(() => {
        const vm = window.__brickwrightStore.getState().scratchGui.vm;
        for (let i = 1; i <= 3; i++) vm.renameSprite(vm.editingTarget.id, `Keyboard-${i}`);
    });
    await page.getByTestId('bw-global-history').click();
    await page.getByTestId('bw-history-step--1').focus();
    await page.keyboard.press('ArrowDown');
    if (await focused() !== 'bw-history-step--2') throw new Error('ArrowDown did not move one History step');
    await page.keyboard.press('ArrowUp');
    if (await focused() !== 'bw-history-step--1') throw new Error('ArrowUp did not move one History step');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__brickwrightStore.getState().scratchGui.vm.editingTarget.getName() === 'Keyboard-1');
    await page.getByTestId('bw-history-close').click();
    await page.evaluate(() => {
        const vm = window.__brickwrightStore.getState().scratchGui.vm;
        for (let i = 1; i <= 35; i++) vm.renameSprite(vm.editingTarget.id, `Scroll-${i}`);
    });
    await page.getByTestId('bw-global-history').click();
    await page.getByTestId('bw-history-step--32').click();
    await page.waitForFunction(() => window.__brickwrightStore.getState().scratchGui.vm.editingTarget.getName() === 'Scroll-3');
    await page.getByTestId('bw-history-close').click();
    await page.getByTestId('bw-global-history').click();
    await page.waitForFunction(() => {
        const list = document.querySelector('[data-testid="bw-history-list"]');
        const now = list?.querySelector('[aria-selected="true"]');
        if (!now) return false;
        const a = list.getBoundingClientRect(), b = now.getBoundingClientRect();
        return b.top >= a.top - 1 && b.bottom <= a.bottom + 1;
    });

    // User title edits and scripts shared to another sprite use the same
    // public menu controls; Undo must not delete the earlier duplicate instead.
    await page.getByTestId('bw-history-close').click();
    const originalTitle = await page.evaluate(() => window.__brickwrightStore.getState().scratchGui.projectTitle);
    const title = page.locator('input[class*="project-title-input"]');
    await title.fill('History title probe');
    await title.press('Enter');
    await page.waitForFunction(() => window.__brickwrightStore.getState().scratchGui.projectTitle === 'History title probe');
    await undo.click();
    await page.waitForFunction(expected => window.__brickwrightStore.getState().scratchGui.projectTitle === expected, originalTitle);
    await redo.click();
    await page.waitForFunction(() => window.__brickwrightStore.getState().scratchGui.projectTitle === 'History title probe');
    const shared = await page.evaluate(async () => {
        const vm = window.__brickwrightStore.getState().scratchGui.vm;
        const source = vm.editingTarget, before = new Set(vm.runtime.targets);
        await vm.duplicateSprite(source.id);
        const target = vm.runtime.targets.find(t => t.isOriginal && !before.has(t));
        const count = Object.keys(target.blocks._blocks).length;
        await vm.shareBlocksToTarget([{id: 'history-share-probe', opcode: 'event_whenflagclicked',
            next: null, parent: null, inputs: {}, fields: {}, topLevel: true, shadow: false, x: 0, y: 0}],
        target.id, source.id);
        return {id: target.id, before: count};
    });
    await undo.click();
    await page.waitForFunction(({id, before}) => {
        const target = window.__brickwrightStore.getState().scratchGui.vm.runtime.getTargetById(id);
        return target && Object.keys(target.blocks._blocks).length === before;
    }, shared);
    await redo.click();
    await page.waitForFunction(({id, before}) => Object.keys(window.__brickwrightStore.getState().scratchGui.vm.runtime
        .getTargetById(id).blocks._blocks).length === before + 1, shared);
    // Sound History through the real VM, codec and editor controls. The WAVs
    // use the VM audio context's own sample rate and asymmetric 16-bit values,
    // so the expected reverse comes from decoded samples, not codec assumptions.
    await page.evaluate(async () => {
        const vm = window.__brickwrightStore.getState().scratchGui.vm;
        const target = vm.editingTarget;
        const rate = vm.runtime.audioEngine.audioContext.sampleRate;
        const frames = 4096;
        const names = ['History sound A', 'History sound B'];
        const levels = [[8192, -16384, 24576, -4096], [-8192, 4096, -24576, 16384]];
        for (let sound = 0; sound < names.length; sound++) {
            const wav = new Uint8Array(44 + frames * 2);
            const view = new DataView(wav.buffer);
            const text = (offset, value) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
            text(0, 'RIFF'); view.setUint32(4, wav.length - 8, true); text(8, 'WAVE');
            text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
            view.setUint16(22, 1, true); view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true);
            view.setUint16(32, 2, true); view.setUint16(34, 16, true);
            text(36, 'data'); view.setUint32(40, frames * 2, true);
            for (let i = 0; i < frames; i++) view.setInt16(44 + 2 * i, levels[sound][Math.floor(i * 4 / frames)], true);
            const storage = vm.runtime.storage;
            const asset = storage.createAsset(storage.AssetType.Sound, 'wav', wav, null, true);
            await vm.addSound({name: names[sound], asset, md5: `${asset.assetId}.wav`,
                dataFormat: 'wav', rate, sampleCount: frames}, target.id);
        }
        const originals = {};
        for (const name of names) {
            const index = target.sprite.sounds.findIndex(sound => sound.name === name);
            if (index < 0) throw new Error(`missing sound fixture ${name}`);
            const buffer = vm.getSoundBuffer(index);
            if (!buffer || buffer.sampleRate !== rate || buffer.length !== frames) {
                throw new Error(`sound fixture ${name} was resampled or has an unexpected length`);
            }
            originals[name] = Array.from(buffer.getChannelData(0));
        }
        const a = originals[names[0]], b = originals[names[1]];
        if (a.every((value, i) => value === a[a.length - 1 - i]) || a.every((value, i) => value === b[i])) {
            throw new Error('sound fixture must be asymmetric and distinguish the two sounds');
        }
        window.__bwSoundProof = {target, originals};
    });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('bw-activate-tab', {detail: {index: 2}})));
    const soundA = page.getByText('History sound A', {exact: true});
    const soundB = page.getByText('History sound B', {exact: true});
    await soundA.waitFor({state: 'visible', timeout: 30000});
    const soundInput = page.locator('[class*="sound-editor_editor-container"] input');
    const selectSound = async (item, name) => {
        await item.click();
        await page.waitForFunction(expected => {
            const input = document.querySelector('[class*="sound-editor_editor-container"] input');
            return input && input.value === expected;
        }, name);
    };
    const waitSound = (name, reversed) => page.waitForFunction(({name, reversed}) => {
        const proof = window.__bwSoundProof;
        const sound = proof.target.sprite.sounds.find(item => item.name === name);
        if (!sound) return false;
        const buffer = proof.target.sprite.soundBank.getSoundPlayer(sound.soundId).buffer;
        const actual = buffer.getChannelData(0), before = proof.originals[name];
        if (actual.length !== before.length) return false;
        // At most one 16-bit PCM quantization step; the source rate matches the audio context.
        return actual.every((value, i) => Math.abs(value - before[reversed ? before.length - i - 1 : i]) <= 1 / 32768);
    }, {name, reversed});
    const busy = page.getByRole('status').filter({hasText: /Klang wird bearbeitet|Bitte warte/});
    const reverse = page.getByRole('button', {name: 'Umkehren', exact: true});
    await selectSound(soundA, 'History sound A');
    // A focused sound-name input deliberately ignores these shortcuts. Move
    // focus back to the real sound tile so the editor's keyboard handler runs.
    // With no selected range, cropping must leave every decoded sample intact.
    await soundA.click();
    await page.keyboard.press('Shift+Delete');
    await busy.waitFor({state: 'hidden'});
    await waitSound('History sound A', false);
    await reverse.click();
    await waitSound('History sound A', true);
    await busy.waitFor({state: 'hidden'});
    await undo.click();
    await waitSound('History sound A', false);
    await busy.waitFor({state: 'hidden'});
    await redo.click();
    await waitSound('History sound A', true);
    await busy.waitFor({state: 'hidden'});

    // Hold the real offline renderer before it starts; no fake render result is
    // supplied. Selection switches while that genuine operation is pending.
    await page.evaluate(() => {
        const proto = window.OfflineAudioContext.prototype;
        const start = proto.startRendering;
        const vm = window.__brickwrightStore.getState().scratchGui.vm;
        const update = vm.updateSoundBuffer;
        let release;
        const hold = new Promise(resolve => { release = resolve; });
        const gate = {started: 0, completed: 0, settled: 0, rejected: 0, writes: 0, mode: 'hold', release,
            restore: () => { proto.startRendering = start; vm.updateSoundBuffer = update; }};
        vm.updateSoundBuffer = function (...args) {
            gate.writes++;
            return update.apply(this, args);
        };
        window.__bwSoundRenderGate = gate;
        proto.startRendering = function (...args) {
            if (gate.mode === 'reject') {
                gate.rejected++;
                return Promise.reject(new Error('controlled offline rendering failure'));
            }
            gate.started++;
            const complete = this.oncomplete;
            if (typeof complete !== 'function') throw new Error('offline completion handler was not installed');
            this.oncomplete = event => {
                try { complete.call(this, event); } finally { gate.completed++; }
            };
            const rendering = hold.then(() => start.apply(this, args));
            rendering.then(() => { gate.settled++; }, () => { gate.settled++; });
            return rendering;
        };
    });
    try {
        await reverse.click();
        await page.waitForFunction(() => window.__bwSoundRenderGate.started === 1);
        await busy.waitFor({state: 'visible'});
        const reverseClass = await reverse.getAttribute('class');
        if (!/icon-button_disabled/.test(reverseClass || '')) throw new Error('sound effect remains enabled while busy');
        const trimBlocked = page.locator('[class*="sound-editor_waveform-container"] [aria-disabled="true"]');
        if (await trimBlocked.count() !== 1) throw new Error('sound trim is not disabled while busy');
        if (await page.getByRole('button', {name: /^(Abspielen|Stopp)$/}).isDisabled()) {
            throw new Error('read-only sound playback was disabled while busy');
        }
        // A second menu undo is refused visibly, not queued behind the effect.
        await undo.click();
        await page.getByText('Bitte warte, bis die Klangbearbeitung abgeschlossen ist.', {exact: true}).waitFor();
        await selectSound(soundB, 'History sound B');
        await busy.waitFor({state: 'hidden'});
        await page.evaluate(() => window.__bwSoundRenderGate.release());
        await page.waitForFunction(() => window.__bwSoundRenderGate.completed === 1 &&
            window.__bwSoundRenderGate.settled === 1);
        await waitSound('History sound A', true);
        await waitSound('History sound B', false);
        if (await page.evaluate(() => window.__bwSoundRenderGate.writes) !== 0) {
            throw new Error('a blocked or stale sound operation reached the VM');
        }
        if (await soundInput.inputValue() !== 'History sound B') throw new Error('stale rendering changed selection');
        await page.getByTestId('bw-global-history').click();
        const historyText = await page.getByTestId('bw-history-list').innerText();
        if (/Sounds:\s*Effect reverse/.test(historyText)) {
            throw new Error(`stale sound History entry after selection: ${historyText}`);
        }
        await page.getByTestId('bw-history-close').click();

        // A real renderer rejection must release the lock and leave samples intact.
        await page.evaluate(() => { window.__bwSoundRenderGate.mode = 'reject'; });
        await reverse.click();
        await page.waitForFunction(() => window.__bwSoundRenderGate.rejected === 1);
        await page.getByText('Der Klang konnte nicht bearbeitet werden. Bitte versuche es erneut.',
            {exact: true}).waitFor();
        await busy.waitFor({state: 'hidden'});
        await waitSound('History sound B', false);
        if (await page.evaluate(() => window.__bwSoundRenderGate.writes) !== 0) {
            throw new Error('a failed render unexpectedly changed sound samples');
        }
        if (/icon-button_disabled/.test(await reverse.getAttribute('class') || '')) {
            throw new Error('sound editing stayed disabled after render rejection');
        }
        await page.getByTestId('bw-global-history').click();
        const rejectedHistory = await page.getByTestId('bw-history-list').innerText();
        if (/Sounds:\s*Effect reverse/.test(rejectedHistory)) {
            throw new Error(`failed render added a History entry: ${rejectedHistory}`);
        }
        await page.getByTestId('bw-history-close').click();
    } finally {
        await page.evaluate(() => {
            window.__bwSoundRenderGate.release();
            window.__bwSoundRenderGate.restore();
        });
    }

    await page.getByTestId('bw-global-history').click();

    // Autosave: a version of the whole project is stored and listed.
    await page.getByTestId('bw-history-tab-autosave').click();
    await page.getByTestId('bw-autosave-save-now').click();
    await page.getByTestId('bw-autosave-versions').waitFor({state: 'visible', timeout: 60000});
    await page.getByTestId('bw-history-close').click();

    // Crash recovery: a session that ends with unsaved changes offers its last
    // autosave at the next start, and Reopen restores it.
    await page.evaluate(() => {
        const vm = window.__brickwrightStore.getState().scratchGui.vm;
        vm.renameSprite(vm.editingTarget.id, 'Recovered');
    });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('bw-open-history-panel', {detail: {view: 'autosave'}})));
    await page.getByTestId('bw-autosave-save-now').click();
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="bw-autosave-versions"] > div').length >= 2);
    await page.reload({waitUntil: 'domcontentloaded'});
    await page.getByTestId('bw-autosave-recovery-open').click({timeout: 90000});
    await page.waitForFunction(() => window.__brickwrightStore.getState().scratchGui.vm.runtime.targets
        .some(target => !target.isStage && target.getName() === 'Recovered'), null, {timeout: 60000});
    if (errors.length) throw new Error(`page errors: ${errors.join(' | ')}`);
} finally {
    await browser.close();
    if (server) server.close();
}

console.log('ok iPad-width Widget icons fit; global undo/redo restores Widget, Code, costume and sound edits; History, autosave and crash recovery work');
