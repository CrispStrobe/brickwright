#!/usr/bin/env node
import {openCodeActions as openCodeMenu, closeCodeActions as closeCodeMenu} from './lib-code-actions.mjs';
/**
 * CI-only production-browser proof for the example journey (Lane U).
 *
 * Three owner-reported defects, one session, each journey asserted separately.
 *
 *   J1  Picking a device AFTER loading an example must not leave the authored
 *       board under a retargeted program. `03-night-light` has benches for
 *       stc12, stc15, the Arduino boards, pico and stm32 — and NONE for stc89,
 *       so choosing STC89 must produce a NAMED refusal. That refusal already
 *       existed in setDevice; it was unreachable from this path because only
 *       the importer's own catalogue recorded which example was loaded.
 *   J2  The catalogue is browsed BEFORE the chip is chosen, so changing the
 *       device must not change how many examples are offered.
 *   J3  Loading an example overwrites the PROJECT NAME. The (i) beside that
 *       field says which example, and opens its intro.
 *
 * The example is loaded through the gallery's own loadExample, reached by the
 * React-fiber walk verify-aurora65-workstation.mjs already uses — a green gate's
 * drive rather than an invented selector.
 */
import {createServer} from 'node:http';
import {existsSync} from 'node:fs';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, extname, join, normalize, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

if (!process.env.CI && process.env.BW_ALLOW_LOCAL_BROWSER_PROOF !== '1') {
    throw new Error('This resource-intensive browser proof is CI-only; set BW_ALLOW_LOCAL_BROWSER_PROOF=1 explicitly');
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = join(root, 'packages', 'scratch-gui', 'build');
const artifacts = resolve(process.env.EXAMPLE_JOURNEY_ARTIFACTS || 'artifacts/example-journey');
const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.woff': 'font/woff', '.woff2': 'font/woff2'};

const serveBuild = async () => {
    if (!existsSync(join(build, 'index.html'))) throw new Error(`Build first: ${build}/index.html is missing`);
    const server = createServer(async (req, res) => {
        try {
            let requestPath = decodeURIComponent(req.url.split('?')[0]);
            if (requestPath.endsWith('/')) requestPath += 'index.html';
            const file = join(build, normalize(requestPath));
            if (!file.startsWith(build)) throw new Error('path escaped build');
            const body = await readFile(file);
            res.writeHead(200, {'content-type': types[extname(file)] || 'application/octet-stream'});
            res.end(body);
        } catch {
            if (!res.headersSent) res.writeHead(404);
            res.end('not found');
        }
    });
    const first = Number(process.env.BW_PORT || 8261);
    for (let port = first; port < first + 20; port++) {
        const listening = await new Promise((done, fail) => {
            const onError = error => error.code === 'EADDRINUSE' ? done(false) : fail(error);
            server.once('error', onError);
            server.listen(port, () => { server.removeListener('error', onError); done(true); });
        });
        if (listening) return {server, url: `http://localhost:${port}/`};
    }
    throw new Error('no free browser-proof port');
};

await mkdir(artifacts, {recursive: true});
let server;
let browser;
let page;
let url = process.env.PROOF_URL || process.env.BW_URL || null;
const checks = [];
const diagnostics = [];
const check = (name, ok, detail = '') => {
    checks.push({name, ok, detail});
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) throw new Error(`${name}${detail ? `: ${detail}` : ''}`);
};
const snap = async name => {
    const path = join(artifacts, `${name}.png`);
    await page.screenshot({path, fullPage: true});
    check(`artifact ${name}`, existsSync(path));
};
const recordRequestFailure = request => {
    const reason = request.failure()?.errorText || '';
    // The app deliberately aborts its optional labwired WASM HEAD probe once
    // capability detection has its answer. It is not a failed app resource.
    if (request.method() === 'HEAD' && /labwired_wasm_bg\.wasm/.test(request.url()) &&
        reason === 'net::ERR_ABORTED') return;
    diagnostics.push(`requestfailed: ${request.method()} ${request.url()} ${reason}`);
};

try {
    if (!url) ({server, url} = await serveBuild());
    browser = await chromium.launch({headless: true});
    page = await browser.newPage({viewport: {width: 1600, height: 1050}});
    page.on('dialog', dialog => dialog.accept());
    page.on('pageerror', error => diagnostics.push(`pageerror: ${error.stack || error.message}`));
    page.on('console', message => {
        if (message.type() === 'error') diagnostics.push(`console.error: ${message.text()}`);
    });
    page.on('requestfailed', recordRequestFailure);
    await page.addInitScript(() => {
        localStorage.clear();
        localStorage.setItem('bw-starter-v1-complete', '1');
        localStorage.setItem('bw-right-pane-hidden', '0');
        localStorage.setItem('bw-debug-dock', 'right');
        sessionStorage.clear();
    });
    await page.goto(url, {waitUntil: 'networkidle', timeout: 90000});
    await page.waitForSelector('[role="tab"]', {timeout: 60000});
    // THE CIRCUIT TAB MUST BE MOUNTED BEFORE THE WALK FINDS IT. The first
    // version of this gate copied verify-aurora65-workstation's fiber walk and
    // not the three lines above it, so the walk searched a tree the gallery was
    // not in and timed out after 40 s with no hint that the component simply
    // was not there. Mirroring a green gate's drive means the navigation too,
    // not only the clever part.
    await page.getByRole('tab', {name: /circuit/i}).click();

    // The circuit tab's own gallery loader, found the way a green gate finds it.
    const found = await page.waitForFunction(() => {
        const gui = document.querySelector('[class*="gui_body"]') || document.querySelector('[class*="gui"]');
        if (!gui) return false;
        const key = Object.keys(gui).find(k =>
            k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
        if (!key) return false;
        const queue = [gui[key]];
        for (let i = 0; i < 8000 && queue.length; i++) {
            const fiber = queue.shift();
            const node = fiber && fiber.stateNode;
            if (node && typeof node.loadExample === 'function' &&
                Array.isArray(node.state && node.state.examples)) {
                window.__bwUiCircuitTab = node;
                return node.state.examples.some(e => e.id === '03-night-light');
            }
            if (fiber && fiber.child) queue.push(fiber.child);
            if (fiber && fiber.sibling) queue.push(fiber.sibling);
        }
        return false;
    }, null, {timeout: 40000});
    check('the night-light example is published in the gallery', !!found);

    const titleNow = () => page.evaluate(() =>
        window.__brickwrightStore?.getState?.()?.scratchGui?.projectTitle ?? null);
    const titleBeforeLoad = await titleNow();
    const loaded = await page.evaluate(async () => {
        const tab = window.__bwUiCircuitTab;
        const ex = tab.state.examples.find(e => e.id === '03-night-light');
        return tab.loadExample(ex);
    });
    check('the gallery loader opens it', loaded && loaded.ok !== false,
        (loaded && loaded.error) || '');

    // ---- J3: the (i) beside the project name --------------------------------
    // U1-3's claim is NOT that the project name survives an example load. The
    // measurement note records the opposite: loading an example DELIBERATELY
    // overwrites it (circuit-tab.jsx publishes pendingExampleTitle through
    // onSetProjectTitle), and the (i) exists BECAUSE that same field is
    // user-editable — so the title alone can no longer say WHICH example is
    // loaded. "Capture the title before and assert it after" would therefore
    // prove the inverse of the documented behaviour; what has to be proved is
    // that the overwrite happens AND that the (i) outlives a rename.
    const titleAfterLoad = await titleNow();
    check('loading the example overwrites the user-editable project name',
        typeof titleAfterLoad === 'string' && titleAfterLoad.trim().length > 0 &&
        titleAfterLoad !== titleBeforeLoad,
        `${JSON.stringify(titleBeforeLoad)} -> ${JSON.stringify(titleAfterLoad)}`);

    const intro = page.getByTestId('bw-example-intro');
    await intro.waitFor({timeout: 30000});
    const introFor = await intro.getAttribute('data-example-id');
    check('an (i) appears beside the project name, naming the loaded example',
        introFor === '03-night-light', String(introFor));
    await intro.click();
    await page.getByTestId('bw-example-intro-panel').waitFor({timeout: 20000});
    const panel = (await page.getByTestId('bw-example-intro-panel').textContent() || '').trim();
    check('it opens a panel carrying the example', panel.length > 10, panel.slice(0, 120));
    await snap('example-intro-open');

    // Close it deterministically rather than leaving a panel up for the next
    // journey. NOTE: an earlier version of this comment claimed this was the
    // cause of J2's timeout. It was not — see openCatalog below. Kept because
    // waiting for a thing you just dismissed is right regardless.
    await intro.click();
    await page.getByTestId('bw-example-intro-panel')
        .waitFor({state: 'hidden', timeout: 20000});

    // The reason the affordance exists: the learner renames the project, and the
    // (i) must still say which example this is. This is the ONLY check that
    // distinguishes the (i) from the title it sits beside.
    const titleField = page.locator('input[class*="title-field"]').first();
    await titleField.waitFor({state: 'visible', timeout: 20000});
    await titleField.fill('My own project name');
    await titleField.press('Enter');
    await page.waitForFunction(() => window.__brickwrightStore?.getState?.()
        ?.scratchGui?.projectTitle === 'My own project name', null, {timeout: 20000});
    const introAfterRename = await page.getByTestId('bw-example-intro')
        .getAttribute('data-example-id');
    check('the (i) still names the example after the learner renames the project',
        introAfterRename === '03-night-light', String(introAfterRename));

    // ---- J2: Code filters examples by the selected device -------------------
    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    const device = page.getByTestId('bw-device-select');
    await device.waitFor({state: 'visible', timeout: 20000});
    const toggle = page.getByTestId('bw-catalog-toggle');
    const catalogPanel = page.locator('[data-testid="bw-catalog-panel"]');
    const catalogIds = () => page.getByTestId('bw-catalog-item').evaluateAll(rows => rows.map(row => row.title));

    // OPEN STATE IS READ FROM THE CONTROL, NOT INFERRED FROM ITS CONTENTS.
    // Returning early on "an item is showing" broke in both directions. An
    // EMPTY-but-open catalogue — exactly the U1-2 regression this gate exists to
    // catch — looked shut, so the helper clicked the toggle, CLOSED the
    // catalogue, and waited 30 s for an item that could never arrive: the
    // regression reported as a Playwright stall. And a stale list satisfied the
    // early return, so a count taken before the re-render passed by comparing a
    // list against itself. aria-expanded is the control's own state.
    // THE TOGGLE LIVES INSIDE THE OVERFLOW MENU, and three commits' worth of
    // theories missed it because none of them looked at the page. The failure
    // screenshot from 34149657712 shows the toolbar ending in "⋯ ⊞" with no
    // "Load example…" button at all: renderCatalogControl is called from inside
    // renderActionMenu (pseudocode-importer.jsx:3563), a <details> that is shut
    // until clicked. So the button is in the DOM, resolves by test id, and is
    // honestly NOT VISIBLE — which is what Playwright said all along, while I
    // read it first as a bad selector and then as a panel covering it.
    const actions = page.locator('[data-testid="bw-code-actions"]');
    const openActions = async () => openCodeMenu(page, {timeout: 15000});
    const openCatalog = async () => {
        await openActions();
        if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
        await catalogPanel.waitFor({state: 'visible', timeout: 30000});
        // THE CATALOGUE FETCHES WHEN IT OPENS. Waiting only for the panel
        // counted zero examples in CI while the identical code saw 163 against
        // the same build locally — a local disk read finishes before the count
        // and a hosted one does not. This waits for the panel's own loaded
        // state, and deliberately NOT for items > 0: that would mask the
        // empty-catalogue regression this gate exists to catch, turning the
        // U1-2 defect into a green run.
        await page.locator('[data-testid="bw-catalog-panel"][data-catalog="ready"]')
            .waitFor({state: 'visible', timeout: 30000});
    };
    await openCatalog();
    const before = await catalogIds();
    // Named here, so an empty catalogue fails as an empty catalogue.
    check('the catalogue lists examples at all', before.length > 0, `saw ${before.length}`);
    const noNeeds = await page.evaluate(() =>
        !/Ben\u00f6tigt:|Needs:/.test(document.body.textContent || ''));
    check('no example is labelled with a device requirement', noNeeds);

    // AN ACCEPTED DEVICE, DELIBERATELY. The first version changed to stc89c52rc
    // here — the very device J1 needs REFUSED. A refused change never happens,
    // so the panel never re-stamped and the wait below timed out; worse, had it
    // used the old event-as-state wait it would have gone GREEN, "proving" the
    // catalogue does not narrow when the device had not changed at all. J2's
    // claim needs a device that really takes; J1 owns the refusal.
    await device.selectOption('arduino-uno');
    await openCatalog();
    // Wait on the LIST's own re-render, not on the <select>'s value. The value is
    // the EVENT that should cause the change; the panel's data-device is the
    // CHANGED STATE. Waiting on the former is event-as-state and let a stale list
    // be counted.
    await page.locator('[data-testid="bw-catalog-panel"][data-device="arduino-uno"]')
        .waitFor({state: 'visible', timeout: 20000});
    const after = await catalogIds();
    check('changing the device refreshes the matching examples',
        after.length > 0 && JSON.stringify(before) !== JSON.stringify(after),
        `${before.length} before, ${after.length} after`);
    await snap('catalogue-filtered');

    // ---- J1: the device pick must refuse, not leave a stale board -----------
    // stc89 has no bench for this example, so setDevice must say so BY NAME.
    // This is the journey that proves the U1-1 fix: the refusal already existed
    // in setDevice and was unreachable from a gallery load, because only the
    // importer's own catalogue recorded which example was open.
    await device.selectOption('stc89c52rc');
    const status = await page.waitForFunction(() => {
        const el = document.querySelector('[data-testid="bw-code-status"]');
        const text = (el && el.textContent) || '';
        return /cannot retarget|not available|Cannot/i.test(text) ? text : false;
    }, null, {timeout: 20000}).then(handle => handle.jsonValue()).catch(() => '');
    check('choosing a device the example has no circuit for is REFUSED by name',
        /cannot retarget|not available|Cannot/i.test(status), JSON.stringify(status.slice(0, 200)));
    await snap('device-refusal');

    // ---- J4: the OTHER half of the U1-1 fix ---------------------------------
    // The fix publishes `bw-example-loaded` and ALSO reads window.__bwActiveExample
    // on mount, because the importer may not exist yet when the event fires.
    // Everything above exercises only the second path: LazyPseudocodeImporter
    // renders null until `activated`, and on the Circuit tab it is not activated,
    // so its componentDidMount runs strictly AFTER the gallery load — the
    // listener is registered too late to hear it. With the Code tab now visited
    // the importer IS mounted, so loading a second example here is the only
    // thing in this gate that can exercise the LISTENER. Without J4 half the fix
    // ships unproven and would keep passing if the listener were deleted.
    const second = await page.evaluate(async () => {
        const tab = window.__bwUiCircuitTab;
        const ex = (tab.state.examples || []).find(e => e.id !== '03-night-light');
        if (!ex) return null;
        await tab.loadExample(ex);
        return ex.id;
    });
    if (second) {
        const seen = await page.waitForFunction(want => {
            const gui = document.querySelector('[class*="gui_body"]') || document.querySelector('[class*="gui"]');
            const key = gui && Object.keys(gui).find(k =>
                k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
            if (!key) return false;
            const queue = [gui[key]];
            for (let i = 0; i < 8000 && queue.length; i++) {
                const fiber = queue.shift();
                const node = fiber && fiber.stateNode;
                if (node && typeof node.setDevice === 'function' && node.state && node.state.buffers) {
                    return (node._lastCatalogExample && node._lastCatalogExample.id) === want;
                }
                if (fiber && fiber.child) queue.push(fiber.child);
                if (fiber && fiber.sibling) queue.push(fiber.sibling);
            }
            return false;
        }, second, {timeout: 30000}).then(() => true).catch(() => false);
        check('a gallery load reaches an ALREADY-MOUNTED importer through the event',
            seen, `expected ${second}`);
    } else {
        check('a second example exists to prove the event path', false,
            'the gallery published only one example');
    }

    check('no page errors or failed requests', diagnostics.length === 0,
        diagnostics.slice(0, 4).join(' | '));
    await writeFile(join(artifacts, 'result.json'),
        JSON.stringify({url, introFor, before, after, status, checks, diagnostics}, null, 2));
    console.log(`\nExample journey: ${checks.filter(c => c.ok).length}/${checks.length} checks passed.`);
} catch (error) {
    if (page) await page.screenshot({path: join(artifacts, 'failure.png'), fullPage: true}).catch(() => {});
    await writeFile(join(artifacts, 'failure.txt'),
        `${error.stack || error}\n\ndiagnostics:\n${diagnostics.join('\n')}\n`).catch(() => {});
    throw error;
} finally {
    if (browser) await browser.close();
    if (server) await new Promise(done => server.close(done));
}
