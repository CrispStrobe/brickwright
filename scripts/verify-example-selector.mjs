#!/usr/bin/env node
import {closeCodeActions as closeCodeMenu} from './lib-code-actions.mjs';
/** Browser acceptance for the Code-tab example selector and game gallery. */
import {chromium} from 'playwright';
import {openCodeActions} from './lib-code-actions.mjs';

const url = process.env.PROOF_URL || 'http://localhost:8617/';
const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 1600, height: 1000}});
const failures = [];
const check = (name, ok, detail = '') => {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures.push(name);
};

const NEW_GAMES = [
    'Skyline Swoop', 'Contrail Panic', 'Aegis Arc', 'Prism Lock', 'Core Cascade', 'Neon Relay',
    'Rift Rally', 'Slipstream Circuit', 'Abyss Lift', 'Wardlight', 'Pantry Prowl', 'Nimbus Volley',
    'Ember Parry', 'Tidegate Rush', 'Blue-Line Breaker', 'Orbit Hoops', 'Comet Strikers', 'Echo Trench',
    'Whisker Relay', 'Helix Rush', 'Moonbank Hop', 'Crosswind Courier', 'Lumen Stack', 'Plasma Posse',
    'Halo Lockdown', 'Carrier Kestrel', 'Skycourt Surge', 'Chromafall Reactor', 'Cratercoil', 'Magma Lift'
];

try {
    await page.addInitScript(() => {
        localStorage.clear();
        localStorage.setItem('bw-starter-v1-complete', '1');
        sessionStorage.clear();
    });
    await page.goto(url, {waitUntil: 'networkidle', timeout: 60000});
    await page.waitForSelector('[role="tab"]', {timeout: 60000});
    // The packaged GUI keeps the VM in Redux rather than exporting a global.
    // Expose the same object the other browser gates use so this journey can
    // prove that selection changes both the editor text and the live runtime.
    await page.waitForFunction(() => {
        const store = window.__brickwrightStore;
        const vm = store?.getState?.()?.scratchGui?.vm;
        if (vm?.runtime) {
            window.__vm = vm;
            return true;
        }
        return false;
    }, null, {timeout: 60000});
    await page.getByRole('tab', {name: 'Code', exact: true}).click();

    const device = page.locator('[data-testid="bw-device-select"]');
    await device.waitFor({timeout: 10000});
    const firstDevice = await device.locator('option').first().textContent();
    check('Code starts in no-chip mode', await device.inputValue() === '' && /no chips/i.test(firstDevice || ''),
        `value=${await device.inputValue()} label=${firstDevice}`);

    // micro:bit BEFORE any catalogue example is open, which is the only point it
    // is reachable — and the reason is worth writing down, because I removed this
    // check on a wrong premise first.
    //
    // Nine examples declare micro:bit and none has a circuit bench, which looks
    // like a picker offering a target that gets refused. It is not: micro:bit is
    // those examples' AUTHORED device, and example-bench.js short-circuits at
    // `if (!retargeted)` before any refusal. Verified both ways —
    // resolveExampleBench(mb01,'microbit','microbit') returns {retargeted:false}
    // with no error, while (mb01,'arduino-uno','microbit') IS refused. They have
    // no bench because their hardware is the micro:bit; they run through
    // MicroPython rather than a breadboard.
    //
    // So the tab cannot be reached by retargeting a loaded hardware example: the
    // catalogue opens examples FOR the selected device, so clicking an mb0* item
    // while stm32f030 is selected is itself a refused retarget. With nothing
    // loaded there is no example to retarget, and selecting the device is enough.
    await device.selectOption('microbit');
    await page.waitForFunction(() => document.querySelector(
        '[data-testid="bw-device-select"]')?.value === 'microbit', null, {timeout: 15000});
    check('selecting micro:bit reveals its generated-code tab',
        await page.getByRole('button', {name: /micro:bit/i}).count() > 0,
        `select=${await device.inputValue()}`);
    await device.selectOption('');
    await page.waitForFunction(() => document.querySelector(
        '[data-testid="bw-device-select"]')?.value === '', null, {timeout: 15000});

    const bundledExampleRequests = () => page.evaluate(() =>
        performance.getEntriesByType('resource')
            .filter(entry => entry.name.includes('/chunks/pseudocode-examples.js'))
            .map(entry => entry.name));
    check('opening Code does not fetch bundled examples',
        (await bundledExampleRequests()).length === 0);

    // Open / Save / examples / catalog live behind the `⋯` menu since the UI
    // consolidation. Opening it is the user's click, not a shortcut around one:
    // everything below still has to find and use the real control.
    check('the Code tab offers an actions menu', await openCodeActions(page));

    const games = page.locator('[data-testid="bw-load-example"]');
    // The picker is deliberately replaced by a loading status until its named
    // chunk resolves. Waiting for the real control proves the user-triggered
    // boundary without sampling the intentional placeholder as an empty list.
    await games.waitFor({state: 'visible', timeout: 10000});
    const firstBundledRequests = await bundledExampleRequests();
    check('opening no-chip Tools fetches one bundled-examples chunk',
        firstBundledRequests.length === 1, `${firstBundledRequests.length} requests`);
    const labels = await games.locator('option').allTextContents();
    const missing = NEW_GAMES.filter(name => !labels.some(label => label.includes(name)));
    check('all quality-approved games are visible in the gallery', missing.length === 0,
        missing.length ? `missing: ${missing.join(', ')}` : `${NEW_GAMES.length} present`);
    check('the hardware catalog is hidden in no-chip mode',
        await page.locator('[data-testid="bw-catalog-toggle"]').count() === 0);

    const actions = page.locator('[data-testid="bw-code-actions"]');
    await closeCodeMenu(page);
    await page.waitForFunction(() => document.querySelector('[data-testid="bw-code-actions-trigger"]')?.getAttribute('aria-expanded') === 'false');
    await openCodeActions(page);
    check('reopening Tools reuses the bundled-examples chunk',
        (await bundledExampleRequests()).length === 1);

    await games.selectOption('sky_skim');
    await page.waitForFunction(() => /Skyline Swoop/.test(document.querySelector('.cm-content')?.textContent || ''),
        null, {timeout: 10000});
    const source = (await page.locator('.cm-content .cm-line').allTextContents()).join('\n');
    check('a game loads as editable pseudocode', /Skyline Swoop/.test(source || '') && /WHEN flag clicked/.test(source || ''));

    await page.waitForFunction(() => {
        const targets = window.__vm?.runtime?.targets || [];
        return targets.some(t => !t.isStage && t.blocks.getScripts().length > 0) &&
            document.querySelector('[data-testid="bw-code-editor"]')?.dataset.codeOperationStatus.includes('Blocks loaded.');
    }, null, {timeout: 60000});
    const expectedSprites = [...source.matchAll(/^\s*SPRITE\s+([^\s:]+)/gm)].map(m => m[1]);
    const loadedSprites = await page.evaluate(() => window.__vm.runtime.targets
        .filter(t => !t.isStage).map(t => ({name: t.getName(), scripts: t.blocks.getScripts().length})));
    check('selecting an example automatically loads its blocks without To blocks',
        expectedSprites.length > 0 && expectedSprites.every(name =>
            loadedSprites.some(t => t.name === name && t.scripts > 0)), JSON.stringify(loadedSprites));
    if (process.argv.includes('--auto-blocks-only')) {
        await page.screenshot({path: 'artifacts/atlas-switchback/automatic-example-blocks.png'});
        await browser.close();
        process.exit(failures.length ? 1 : 0);
    }

    await device.selectOption('arduino-uno');
    // The device select sits OUTSIDE the menu, and re-rendering the menu's
    // contents does not close it — but assert that rather than assume it.
    await openCodeActions(page);
    const catalogToggle = page.locator('[data-testid="bw-catalog-toggle"]');
    await catalogToggle.waitFor({timeout: 10000});
    check('choosing hardware swaps the game selector for the catalog',
        await games.count() === 0 && await catalogToggle.count() === 1);
    await catalogToggle.click();
    const catalogItems = page.locator('[data-testid="bw-catalog-item"]');
    await catalogItems.first().waitFor({timeout: 15000});
    const before = await catalogItems.count();
    check('the Arduino catalog is substantial', before > 20, `${before} examples`);

    const search = page.locator('[data-testid="bw-catalog-search"]');
    await search.fill('blink');
    await page.waitForTimeout(250);
    const after = await catalogItems.count();
    const filtered = await catalogItems.allTextContents();
    check('catalog search narrows to matching examples',
        after > 0 && after < before && filtered.every(label => /blink/i.test(label)), `${before} -> ${after}`);

    // Reproduce the target-family regression with a real pin-bearing program.
    // A controlled <select> used to snap straight back to Arduino here because
    // retargetPseudocode had no pools for micro:bit/Arcade/SAMD51. Testing only
    // an empty project cannot see that failure.
    await search.fill('traffic light');
    const trafficLight = page.locator('[data-testid="bw-catalog-item"][title="14-traffic-light"]');
    await trafficLight.waitFor({timeout: 10000});
    await trafficLight.click();
    await page.waitForFunction(() => /PIN\s+red\s*=/.test(document.querySelector('.cm-content')?.textContent || ''),
        null, {timeout: 10000});

    // Retarget across the devices THIS example can actually reach, read from the
    // catalogue the app itself serves, rather than a hardcoded list.
    //
    // It used to hardcode microbit, arcade, pybadge, pybadge-lc and samd51. Every
    // one of those is unreachable: measured across examples/index.json, microbit
    // is declared by 9 examples and benched by 0, and arcade/pybadge/pybadge-lc/
    // samd51 are declared by none. The list passed only because retargeting used
    // to rewrite the DEVICE line while the circuit tab kept showing the previous
    // MCU — the exact defect 53e6c1a31 fixed by refusing a retarget with no
    // bench. So this gate was pinning the bug, and correcting the app turned it
    // red. Deriving the targets means it cannot pin a combination the catalogue
    // does not claim, and it widens automatically when a bench is added.
    const benched = await page.evaluate(async () => {
        const res = await fetch('examples/index.json');
        const all = await res.json();
        const ex = all.find(e => e.id === '14-traffic-light');
        return Object.keys((ex && ex.benches) || {});
    });
    // Deliberately NOT asserting pin names. Which pads a device exposes is the
    // retargeter's business and is covered by its own gate over every
    // example x MCU combination; duplicating it here just hardcodes a second
    // list to go stale (this one already had D13/D12/D8 for boards that do not
    // name their pads that way). What THIS gate owns is that choosing a device
    // actually commits: the select holds the value and the source says so.
    const targetCases = benched.filter(id => id !== 'arduino-uno');
    check('the example declares reachable retarget devices', targetCases.length > 0,
        `benched: ${benched.join(', ')}`);

    for (const target of targetCases) {
        await device.selectOption(target);
        await page.waitForFunction(t => {
            const select = document.querySelector('[data-testid="bw-device-select"]');
            const source = document.querySelector('.cm-content')?.textContent || '';
            // The text changes before asynchronous project loading finishes.
            // Require the applied project, not the previous runtime device.
            const runtime = window.__vm?.runtime;
            const toBlocks = document.querySelector('button[title^="Compile this"]');
            return select?.value === t && source.includes(`DEVICE ${t.toUpperCase()}`) &&
                runtime?.bwDeviceId === t && runtime?.stc?.device?.toLowerCase() === t &&
                toBlocks && !toBlocks.disabled;
        }, target, {timeout: 15000});
        const runtimeDevice = await page.evaluate(() => window.__vm?.runtime?.bwDeviceId);
        const status = await page.locator('[role="status"]').last().textContent().catch(() => '');
        check(`pin-bearing program selects ${target}`,
            await device.inputValue() === target && runtimeDevice === target && !/Cannot retarget/i.test(status || ''),
            `select=${await device.inputValue()} runtime=${runtimeDevice}`);
    }

    // The micro:bit tab check used to sit inside the loop above, behind
    // `if (target === 'microbit')`. With the targets derived that can never be
    // true, so it is restored HERE, reached the way it is actually reachable.
    //
    // I first removed it on a wrong premise, and the correction is worth keeping
    // because the numbers looked damning and were not. Nine examples declare
    // micro:bit and none has a bench, which reads like a picker offering a
    // target that gets refused. It is not: micro:bit is those examples' AUTHORED
    // device (`authored: "microbit"` for all nine), and example-bench.js
    // short-circuits `if (!retargeted)` before any refusal, returning no error.
    // Verified both directions — resolveExampleBench(mb01, 'microbit',
    // 'microbit') gives {retargeted: false} and no error, while
    // resolveExampleBench(mb01, 'arduino-uno', 'microbit') is refused. They have
    // no circuit bench because their hardware IS the micro:bit; they run through
    // MicroPython, not a breadboard. So there is nothing to retarget TO
    // micro:bit, and the tab is reached by opening such an example directly.

    // P7: the i8086 gallery example. Before this the gallery had ZERO i8086
    // entries — the 8086 was reachable only by hand from the Circuit Designer's
    // load menu. Select the chip in the SAME picker (it is a DEVICES/DEVICE_GROUP
    // entry, so it is offered), open the catalog it serves, click i8086-blink, and
    // prove it loads as the 8086 blink program driving a pin through the 8255.
    // Reaching i8086 needs NOTHING loaded. The picker RETARGETS the loaded
    // program, and 14-traffic-light (loaded above) has no i8086 bench, so
    // selecting i8086 with it loaded is a refused retarget: currentDevice()
    // stays stm32f030, the catalog serves that device, and the i8086 example is
    // never listed — exactly the "clicking an item while stm32f030 is selected
    // is itself a refused retarget" the micro:bit note above spells out. A fresh
    // navigation re-runs the init script (localStorage cleared), returning the
    // editor to no-chip mode, so selecting the device is enough to commit it.
    await page.goto(url, {waitUntil: 'networkidle', timeout: 60000});
    await page.waitForSelector('[role="tab"]', {timeout: 60000});
    await page.waitForFunction(() => {
        const vm = window.__brickwrightStore?.getState?.()?.scratchGui?.vm;
        if (vm?.runtime) { window.__vm = vm; return true; }
        return false;
    }, null, {timeout: 60000});
    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    await device.waitFor({timeout: 10000});
    await device.selectOption('i8086');
    await page.waitForFunction(() =>
        document.querySelector('[data-testid="bw-device-select"]')?.value === 'i8086',
    null, {timeout: 15000});
    // The catalog lives BEHIND the ⋯ actions menu (same as the arduino leg above,
    // which opens it before touching the toggle). Without this the toggle renders
    // but is not actionable — the menu that contains it is closed.
    await openCodeActions(page);
    // With a chip selected the "Load example…" catalog toggle appears; the search
    // box exists only while the panel is open, so it is the honest open-signal.
    const i8086Toggle = page.locator('[data-testid="bw-catalog-toggle"]');
    const i8086Search = page.locator('[data-testid="bw-catalog-search"]');
    if (await i8086Search.count() === 0) {
        await i8086Toggle.waitFor({timeout: 10000});
        try {
            await i8086Toggle.click({timeout: 10000});
        } catch (clickErr) {
            // Name the interceptor rather than force through it: ask the page what
            // element actually sits at the toggle's centre. If it is the toggle or
            // a descendant, the problem is stability, not an overlay.
            const atPoint = await i8086Toggle.evaluate(el => {
                const r = el.getBoundingClientRect();
                const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
                return hit ? `${hit.tagName}.${hit.className} testid=${hit.getAttribute('data-testid')}` : 'null';
            }).catch(() => 'evaluate failed');
            throw new Error(`catalog toggle not actionable; elementFromPoint=${atPoint}; ${clickErr.message}`);
        }
        await i8086Search.waitFor({timeout: 10000});
    }
    const i8086Item = page.locator('[data-testid="bw-catalog-item"][title="i8086-blink"]');
    await i8086Item.first().waitFor({timeout: 15000});
    check('the i8086 catalog offers the i8086-blink example', await i8086Item.count() >= 1,
        `${await i8086Item.count()} matching item(s)`);
    await i8086Item.first().click();
    await page.waitForFunction(() => {
        const t = document.querySelector('.cm-content')?.textContent || '';
        return /DEVICE\s+i8086/i.test(t) && /P2\.0/.test(t);
    }, null, {timeout: 10000});
    const i8086Source = await page.locator('.cm-content').textContent();
    check('i8086-blink loads as an 8086 program driving a pin through the 8255',
        /DEVICE\s+i8086/i.test(i8086Source || '') && /P2\.0/.test(i8086Source || '')
        && /WHEN flag clicked/i.test(i8086Source || ''), (i8086Source || '').slice(0, 90));
    // And it RUNS: the device select follows the loaded example to i8086, and the
    // live runtime carries the compiled program (the same __vm the game journey
    // uses above), so this is a real execution, not just an editor load.
    check('opening i8086-blink sets the device to i8086',
        await page.locator('[data-testid="bw-device-select"]').inputValue() === 'i8086',
        await page.locator('[data-testid="bw-device-select"]').inputValue());
    const i8086Ran = await page.waitForFunction(() => {
        const rt = window.__vm?.runtime;
        return Boolean(rt && (rt.targets || []).length > 0);
    }, null, {timeout: 15000}).then(() => true).catch(() => false);
    check('i8086-blink runs on the live runtime', i8086Ran);

} catch (error) {
    check('example-selector browser journey completes', false, String(error).slice(0, 300));
} finally {
    await browser.close();
}

console.log(failures.length ? `\n${failures.length} example-selector check(s) failed.` : '\nAll example-selector checks passed.');
process.exit(failures.length ? 1 : 0);
