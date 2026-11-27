#!/usr/bin/env node
/** Headless browser acceptance checks for the Code/Circuit workspace UX. */
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {extname, join, normalize, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {openCircuitActions, circuitFileControl} from './lib/circuit-actions.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = join(root, 'packages', 'scratch-gui', 'build');
const port = 8098;
const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.wasm': 'application/wasm'};

// Serializable as one Playwright page function. It owns only passive event
// records/listeners and the actual identities captured before the second
// remove; it never writes DOM, React state, Board state, events or time.
function scopeRearmPublicationObserverFactory({target}) {
    // BEGIN SCOPE_REARM_PUBLICATION_PREDICATE
    function scopeRearmPublicationPredicate(state) {
        const boardIdentity = state.board === state.expectedBoard;
        const domIdentity = state.selector === state.expectedSelector
            && state.owner === state.expectedOwner && state.adcOwner === state.expectedOwner;
        const exactControls = state.selectorCount === 1 && state.ownerSelectorCount === 1
            && state.adcCount === 1 && state.ownerAdcCount === 1
            && state.selector?.isConnected === true && state.owner?.isConnected === true
            && state.adc?.isConnected === true && state.selector.disabled === false;
        const modePublication = (state.expectedMode === 'sample' || state.expectedMode === 'envelope')
            && state.selector?.value === state.expectedMode;
        const adcPublication = state.adc?.checked === false
            && state.adc.disabled === (state.expectedMode !== 'sample');
        const focusPublication = state.expectedMode !== 'sample'
            || state.activeElement === state.expectedSelector;
        const channelPublication = Array.isArray(state.channels) && state.channels.length === 0;
        return boardIdentity && domIdentity && exactControls && modePublication
            && adcPublication && focusPublication && channelPublication;
    }
    // END SCOPE_REARM_PUBLICATION_PREDICATE
    const selectorQuery = '[data-testid="bw-scope-time-capture"]';
    const adcQuery = '[data-testid="bw-scope-adc-enabled"]';
    const panelQuery = '[data-scope-panel]';
    const expectedBoard = window.__board;
    const expectedSelector = target;
    const expectedOwner = target?.closest(panelQuery);
    const events = [];
    let overflow = 0, observerError = null;
    const state = expectedMode => {
        const selector = document.querySelector(selectorQuery);
        const adc = document.querySelector(adcQuery);
        let channels = null;
        try { channels = expectedBoard?.getScopeChannels(); }
        catch (error) { observerError = String(error); }
        return {
            expectedMode, expectedBoard, expectedSelector, expectedOwner,
            board: window.__board, selector, adc, activeElement: document.activeElement,
            owner: selector?.closest(panelQuery), adcOwner: adc?.closest(panelQuery),
            selectorCount: document.querySelectorAll(selectorQuery).length,
            ownerSelectorCount: expectedOwner?.querySelectorAll(selectorQuery).length ?? 0,
            adcCount: document.querySelectorAll(adcQuery).length,
            ownerAdcCount: expectedOwner?.querySelectorAll(adcQuery).length ?? 0,
            channels,
        };
    };
    const describe = current => ({
        expectedMode: current.expectedMode,
        sameBoard: current.board === current.expectedBoard,
        sameSelector: current.selector === current.expectedSelector,
        expectedSelectorFocused: current.activeElement === current.expectedSelector,
        sameOwner: current.owner === current.expectedOwner,
        adcOwnerSame: current.adcOwner === current.expectedOwner,
        selectorCount: current.selectorCount, ownerSelectorCount: current.ownerSelectorCount,
        adcCount: current.adcCount, ownerAdcCount: current.ownerAdcCount,
        selector: current.selector ? {isConnected: current.selector.isConnected,
            value: current.selector.value, disabled: current.selector.disabled} : null,
        ownerConnected: current.owner?.isConnected ?? false,
        adc: current.adc ? {isConnected: current.adc.isConnected,
            checked: current.adc.checked, disabled: current.adc.disabled} : null,
        channels: Array.isArray(current.channels) ? [...current.channels] : null,
        publicationReady: scopeRearmPublicationPredicate(current),
    });
    const before = describe(state('envelope'));
    const observe = event => {
        try {
            if (!event.target?.matches(selectorQuery)) return;
            if (events.length >= 16) { overflow++; return; }
            const current = state('sample');
            events.push({type: event.type, isTrusted: event.isTrusted,
                targetIsExpected: event.target === expectedSelector, targetValue: event.target.value,
                state: describe(current)});
        } catch (error) { observerError = String(error); }
    };
    for (const type of ['focus', 'input', 'change']) {
        document.addEventListener(type, observe, {capture: true, passive: true});
    }
    return {
        published: expectedMode => scopeRearmPublicationPredicate(state(expectedMode)),
        readyForKeyboard: () => scopeRearmPublicationPredicate(state('envelope'))
            && document.activeElement === expectedSelector,
        snapshot: () => ({before, after: describe(state('sample')),
            events: [...events], overflow, observerError}),
        stop: () => {
            for (const type of ['focus', 'input', 'change']) document.removeEventListener(type, observe, true);
        },
    };
}


// BEGIN SCOPE_POINT_KEYBOARD_ACTION
async function selectScopePointWithKeyboard(selector, publicationObserver, keyboard) {
    const before = await selector.evaluate(target => ({mode: target.value, connected: target.isConnected}));
    if (before.mode !== 'envelope' || before.connected !== true)
        throw new Error('ADC_POINT_KEYBOARD_PRESTATE');
    await selector.focus();
    if (!await publicationObserver.evaluate(observer => observer.readyForKeyboard()))
        throw new Error('ADC_POINT_KEYBOARD_FOCUS_PUBLICATION');
    await keyboard.press('ArrowDown');
    const after = await selector.evaluate(target => ({mode: target.value, connected: target.isConnected,
        focused: target.ownerDocument.activeElement === target}));
    return {kind: 'native-keyboard', key: 'ArrowDown', before, after};
}
// END SCOPE_POINT_KEYBOARD_ACTION

if (!existsSync(join(build, 'index.html'))) throw new Error('Build first: packages/scratch-gui/build/index.html is missing');

const server = createServer(async (req, res) => {
    try {
        let path = decodeURIComponent(req.url.split('?')[0]);
        if (path.endsWith('/')) path += 'index.html';
        const file = join(build, normalize(path));
        if (!file.startsWith(build)) throw new Error('escape');
        // Read BEFORE the head goes out. Writing 200 first and then failing to read
        // leaves the catch unable to send a 404 — writeHead throws once headers are
        // sent, and that throw escapes the handler and takes the whole gate down.
        // A missing asset should be one 404 line, not an ERR_HTTP_HEADERS_SENT crash.
        const body = await readFile(file);
        res.writeHead(200, {'content-type': types[extname(file)] || 'application/octet-stream'});
        res.end(body);
    } catch {
        console.log(`404 ${req.url}`);
        if (!res.headersSent) res.writeHead(404);
        res.end('not found');
    }
});
await new Promise(done => server.listen(port, done));

const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 1024, height: 768}});
page.on('requestfailed', request => console.log(`request failed ${request.url()} — ${request.failure()?.errorText || 'unknown'}`));
page.on('console', message => { if (message.type() === 'error') console.log(`browser error ${message.text()}`); });
const failures = [];
const check = (name, ok, detail = '') => {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures.push(name);
};

try {
    await page.addInitScript(() => {
        localStorage.clear();
        localStorage.setItem('bw-starter-v1-complete', '1');
        sessionStorage.clear();
    });
    await page.goto(`http://localhost:${port}/`, {waitUntil: 'networkidle', timeout: 60000});
    await page.waitForSelector('[role="tab"]', {timeout: 60000});
    await page.waitForTimeout(1500);

    const tabs = await page.locator('[role="tab"]').allInnerTexts();
    check('Blocks tab is branded Blocks', tabs.includes('Blocks'), tabs.join(' | '));
    const title = page.locator('input[value="BrickWright Project"], #title-field');
    const titleCount = await title.count();
    const titleValue = titleCount ? await title.first().inputValue() : '';
    check('new project title is BrickWright Project', titleValue === 'BrickWright Project', titleValue || 'title input not rendered');

    const settingsMenu = page.getByText('Settings', {exact: true}).last();
    await settingsMenu.locator('xpath=../..').click({force: true});
    check('Settings exposes the app-internal hard reload action', await page.getByText('Reload BrickWright', {exact: true}).count() === 1);
    await page.keyboard.press('Escape');

    const paneToggle = page.locator('[data-right-pane-toggle]');
    const rightPane = page.locator('[data-right-pane]');
    check('right-pane toggle is present beside the editor and right pane', await paneToggle.count() === 1 && await paneToggle.evaluate(el => !el.closest('[role="tablist"]')));
    check('fresh workspace starts with the optional right pane minimized', await paneToggle.getAttribute('aria-pressed') === 'false');
    if (await paneToggle.count()) {
        const editorBox = await page.locator('[data-editor-pane]').boundingBox();
        const toggleBox = await paneToggle.boundingBox();
        check('right-pane toggle is at the far end of the editor row', !!editorBox && !!toggleBox && toggleBox.x + toggleBox.width >= editorBox.x + editorBox.width - 4,
            JSON.stringify({editor: editorBox, toggle: toggleBox}));
        const circuitTabBox = await page.getByRole('tab', {name: /Circuit/}).boundingBox();
        check('right-pane toggle is bottom-aligned with Circuit tab', !!circuitTabBox && !!toggleBox && Math.abs((toggleBox.y + toggleBox.height) - (circuitTabBox.y + circuitTabBox.height)) <= 2,
            JSON.stringify({circuitTab: circuitTabBox, toggle: toggleBox}));
    }
    if (await paneToggle.count()) {
        const beforeEditorWidth = await page.locator('[data-editor-pane]').evaluate(el => el.getBoundingClientRect().width);
        const beforeRightWidth = await rightPane.evaluate(el => el.getBoundingClientRect().width);
        // Await the STATE, not the clock: a fixed 120ms sampled stale
        // aria-pressed on loaded CI runners, and the follow-up restore
        // click then double-toggled the pane into hidden — killing every
        // later right-pane check (the red-CI streak of 2026-08-15).
        const settled = async (want) => {
            await page.waitForFunction(
                ([sel, v]) => document.querySelector(sel)?.getAttribute('aria-pressed') === v,
                ['[data-right-pane-toggle]', want], {timeout: 5000}).catch(() => {});
            return paneToggle.getAttribute('aria-pressed');
        };
        await paneToggle.click({force: true});
        check('right-pane toggle visibly changes state', await settled('true') === 'true');
        const shownEditorWidth = await page.locator('[data-editor-pane]').evaluate(el => el.getBoundingClientRect().width);
        const shownRightWidth = await rightPane.evaluate(el => el.getBoundingClientRect().width);
        check('showing right pane gives it layout width', shownEditorWidth < beforeEditorWidth && shownRightWidth > 0,
            JSON.stringify({beforeEditorWidth, shownEditorWidth, beforeRightWidth, shownRightWidth}));
        await paneToggle.click({force: true});
        await settled('false');
        check('hiding right pane restores editor width',
            await rightPane.evaluate(el => el.getBoundingClientRect().width) === 0 &&
            await page.locator('[data-editor-pane]').evaluate(el => el.getBoundingClientRect().width) >= beforeEditorWidth);
        // The remainder of this gate drives controls hosted in the optional
        // pane. Open it deliberately after proving the fresh/default hidden
        // state; otherwise the test waits for inaccessible hidden buttons.
        await paneToggle.click({force: true});
        await settled('true');
    }
    const editorPane = page.locator('[data-editor-pane]');
    check('right pane remains mounted for optional Circuit Designer selection', await page.locator('[data-right-pane]').count() === 1);

    // Since 68ec0be7c (CAD model and Robot Lab views beside the blocks) a right pane
    // narrower than its buttons need shows the views as ONE dropdown
    // (data-testid bw-right-pane-view, labelled with the current view) — this 1024 px
    // page's 355 px pane does. A view control is the button when buttons show, else
    // that dropdown's option: count / aria-pressed / click mean the same either way.
    const paneViews = page.getByTestId('bw-right-pane-view');
    const viewControl = (name, exact = false) => {
        const button = page.getByRole('button', {name, exact});
        const label = async () => {
            const labels = await paneViews.locator('option').allTextContents();
            return labels.find(text => (exact ? text === name : text.includes(name))) || null;
        };
        const compact = async () => await paneViews.count() === 1;
        return {
            count: async () => (await compact() ? (await label() ? 1 : 0) : button.count()),
            getAttribute: async attribute => {
                if (!(await compact())) return button.getAttribute(attribute);
                if (attribute !== 'aria-pressed') return null;
                const selected = await paneViews.evaluate(select => select.options[select.selectedIndex]?.textContent);
                return String(selected === await label());
            },
            click: async options => {
                if (!(await compact())) return button.click(options);
                return paneViews.selectOption({label: await label()});
            }
        };
    };
    const stageButton = viewControl('Scratch Stage');
    // The "(only)" was dropped from this button's label (it was misleading — the
    // Selectors and Instruments panels can still blend into the Circuit view).
    const circuitButton = viewControl('Circuit Designer');
    const debuggerButton = viewControl('Debugger', true);
    check('stage-view buttons are present', await stageButton.count() === 1 && await circuitButton.count() === 1 && await debuggerButton.count() === 1);
    check('Scratch Stage is selected on a fresh editor', await stageButton.getAttribute('aria-pressed') === 'true');
    await circuitButton.click();
    await page.waitForTimeout(900);
    check('Circuit Designer button changes persisted view', await page.evaluate(() => localStorage.getItem('bw-stage-circuit')) === '1');
    check('Circuit Designer button remains selected', await page.evaluate(() => localStorage.getItem('bw-stage-circuit')) === '1');
    check('Circuit view keeps the stage controls available in Code mode', await page.locator('button').filter({has: page.locator('img')}).count() >= 3, await page.locator('body').innerText().catch(() => ''));
    await debuggerButton.click({force: true});
    await page.waitForTimeout(900);
    // The redesigned Debugger mode (owner spec 2026-08-14): a STANDALONE
    // full-debugger pane (dock 'solo'), not the old designer-with-strip.
    // Owner spec 2026-08-17: the button docks RIGHT — the full panel in
    // the right pane on BOTH tabs ('solo' fell back to the tiny
    // instruments dock on the Circuit tab). The stage column still shows
    // the solo pane while coding (viewForDock maps 'right' → 'solo').
    check('debugger button changes dock', await page.evaluate(() => localStorage.getItem('bw-debug-dock')) === 'right');
    check('debugger button remains selected', await debuggerButton.getAttribute('aria-pressed') === 'true');
    check('debugger switch keeps the right pane present', await page.locator('div[class*="stage-and-target-wrapper"]').count() > 0);
    check('debugger view mounts the solo pane', await page.locator('[data-debugger-solo-pane]').count() === 1);
    check('debugger view exposes the production panel and firmware picker',
        (await page.locator('[data-debugger-solo-pane] [data-debug-panel]:visible').count()) === 1 &&
        (await page.locator('[data-debugger-solo-pane] input[type="file"][accept*=".bin"]').count()) === 1);
    check('fresh debugger honestly identifies that no image is loaded',
        await page.locator('[data-debugger-solo-pane] [data-debug-no-image]:visible').count() === 1);
    await stageButton.click({force: true});
    check('Scratch Stage becomes selected again', await stageButton.getAttribute('aria-pressed') === 'true');
    await stageButton.click({force: true});
    await page.waitForTimeout(200);
    await circuitButton.click({force: true});
    await page.waitForTimeout(700);
    const stageChildren = await page.locator('div[class*="stage-and-target-wrapper"] > *').evaluateAll(nodes => nodes.map(node => ({className: node.className, display: getComputedStyle(node).display, host: node.hasAttribute('data-bw-circuit-stage-host')})));
    check('full-width circuit view hides the Scratch target beside it', stageChildren.some(child => child.className.includes('target-wrapper') && child.display === 'none'), JSON.stringify(stageChildren));

    // Load the first circuit example through the mounted CircuitTab instance.
    await page.getByRole('tab', {name: /Circuit/}).click();
    await page.waitForTimeout(4000);
    await debuggerButton.click({force: true});
    await page.waitForTimeout(500);
    const dedicatedDesigner = page.locator('.bw-circuit-designer:visible').last();
    // Debugger uses the external pane selected above. The dedicated Circuit
    // designer therefore retains the owner's minimized Instruments default.
    check('dedicated Circuit tab keeps Instruments minimized while Debugger uses the external pane',
        await dedicatedDesigner.locator('[data-instruments-column]').count() === 0 &&
        await dedicatedDesigner.getByRole('button', {name: 'Expand instruments panel'}).count() === 1,
        `designers=${await page.locator('.bw-circuit-designer:visible').count()}`);
    const loaded = await page.evaluate(async () => {
        const root = document.querySelector('[class*="gui_body"]') || document.querySelector('[class*="gui"]');
        const key = Object.keys(root || {}).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
        const queue = key ? [root[key]] : [];
        for (let i = 0; i < 10000 && queue.length; i++) {
            const f = queue.shift();
            if (f?.stateNode?.loadExample && Object.hasOwn(f.stateNode.state || {}, 'circuitData')) {
                const response = await fetch('examples/01-blink/circuit.pico.json');
                if (!response.ok) return false;
                const circuitData = await response.json();
                await new Promise(resolve => f.stateNode.setState({circuitData}, resolve));
                return true;
            }
            if (f?.child) queue.push(f.child);
            if (f?.sibling) queue.push(f.sibling);
        }
        return false;
    });
    check('Circuit Designer MCU fixture loaded', loaded);
    await page.waitForTimeout(2200);

    // The debugger starts in the full-size right pane. Its << control lives in
    // Instruments, which may be collapsed in a fresh workspace: expand it,
    // then exercise both directions. This proves the owner-required
    // Blocks + Circuit + Debugger layout is actually reachable and that the
    // formerly missing << / >> controls persist the dock state.
    const expandDedicatedInstruments = dedicatedDesigner.getByRole('button', {name: 'Expand instruments panel'});
    if (await expandDedicatedInstruments.count()) await expandDedicatedInstruments.click({force: true});
    const moveDebuggerBack = dedicatedDesigner.locator('button[title="Move debugger back to instruments"]');
    check('debugger exposes << to move back into Instruments', await moveDebuggerBack.count() === 1);
    if (await moveDebuggerBack.count()) await moveDebuggerBack.click({force: true});
    await page.waitForFunction(() => localStorage.getItem('bw-debug-dock') === 'top', null, {timeout: 3000}).catch(() => {});
    check('Blocks + Circuit + Debugger layout docks the debugger in Instruments',
        await dedicatedDesigner.locator('[data-instruments-column] [data-debugger-panel]').count() === 1 &&
        await page.evaluate(() => localStorage.getItem('bw-debug-dock')) === 'top');
    const debugInstrumentMetrics = await dedicatedDesigner.locator('[data-instruments-scroll]').evaluate(el => ({
        overflowY: getComputedStyle(el).overflowY,
        columnBottom: el.parentElement.getBoundingClientRect().bottom,
        viewportBottom: window.innerHeight,
        panel: !!el.querySelector('[data-debugger-panel]'),
        noCode: !!el.querySelector('[data-no-code-indicator]')
    }));
    check('instrument-docked debugger stays in a bounded scroll viewport',
        debugInstrumentMetrics.panel && debugInstrumentMetrics.overflowY === 'auto' &&
        debugInstrumentMetrics.columnBottom <= debugInstrumentMetrics.viewportBottom + 1,
        JSON.stringify(debugInstrumentMetrics));
    const moveDebuggerRight = dedicatedDesigner.locator('button[title="Move debugger to full-size right pane"]');
    check('debugger exposes >> to move to the right pane', await moveDebuggerRight.count() === 1);
    if (await moveDebuggerRight.count()) await moveDebuggerRight.click({force: true});
    await page.waitForFunction(() => localStorage.getItem('bw-debug-dock') === 'right', null, {timeout: 3000}).catch(() => {});
    check('>> restores the full-size right-pane debugger',
        await page.evaluate(() => localStorage.getItem('bw-debug-dock')) === 'right' &&
        await page.locator('[data-debugger-solo-pane]').count() === 1);

    // The stage-host designer remains mounted while the dedicated Circuit tab
    // is open.  Its hidden view state is allowed to differ, so assertions for
    // the tab must stay scoped to the visible designer selected above.
    const designer = dedicatedDesigner;
    check('Circuit Designer rendered', await designer.count() >= 1);
    // Shrinking the editor moves secondary navigation into the existing overflow menu.
    // bw-circuit-ui portals that overflow menu to <body>, so the navigation is
    // looked up in the designer first and then in its own open overflow popup.
    const moreTrigger = designer.getByRole('button', {name: 'More circuit controls'});
    const overflowMenu = page.locator('[data-toolbar-more-menu]:visible');
    let navigation = designer;
    const ensureCircuitNavigation = async () => {
        if (await designer.locator('[data-circuit-view-toggle]').count()) { navigation = designer; return; }
        if (!await overflowMenu.count()) await moreTrigger.click({force: true});
        await overflowMenu.getByRole('menuitemradio', {name: 'Realistic view'}).waitFor({state: 'visible'});
        navigation = overflowMenu;
    };
    await ensureCircuitNavigation();
    const modeToggle = designer.locator('[data-build-sim-toggle]');
    const toolbar = modeToggle.locator('..');
    const viewButtons = () => navigation === designer ?
        navigation.locator('[data-circuit-view-toggle]').getByRole('radio') :
        navigation.getByRole('menuitemradio', {name: /^(Realistic|Schematic|Board) view$/});
    const viewState = await viewButtons().evaluateAll(buttons => buttons.map(button => ({
        label: button.getAttribute('aria-label') || button.textContent.trim(),
        checked: button.getAttribute('aria-checked')
    })));
    check('Realistic, Schematic and Board views are available with one active view',
        viewState.length === 3 && viewState.filter(button => button.checked === 'true').length === 1,
        JSON.stringify(viewState));
    if (navigation === designer) {
        check('view toggle matches toolbar control height',
            await designer.locator('[data-circuit-view-toggle]').evaluate(el => el.getBoundingClientRect().height >= 34));
    }
    check('Build/Sim is one segmented mode toggle', await modeToggle.count() === 1 && await modeToggle.getByRole('radio').count() === 2 && await modeToggle.getByRole('radio', {name: 'Build mode'}).getAttribute('aria-checked') === 'true');
    const modeMetrics = await modeToggle.getByRole('radio').evaluateAll(buttons => buttons.map(button => ({width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height})));
    check('Build/Sim toggle segments have equal dimensions', modeMetrics.length === 2 && modeMetrics[0].width === modeMetrics[1].width && modeMetrics[0].height === modeMetrics[1].height, JSON.stringify(modeMetrics));
    // The warnings chip is a count-badged CHIP ("⚠ 3"), so its width is
    // content-driven by design; it still shares the 34px control height.
    const toolbarButtonMetrics = await designer.locator('[data-circuit-toolbar] button:visible:not([data-warnings-chip])')
        .evaluateAll(buttons => buttons.filter(button => !button.closest('[data-circuit-history]')).map(button => ({
            width: Math.round(button.getBoundingClientRect().width), height: Math.round(button.getBoundingClientRect().height)
        })));
    check('toolbar buttons share one control size', toolbarButtonMetrics.length >= 5 &&
        toolbarButtonMetrics.every(metric => metric.width === 34 && metric.height === 34), JSON.stringify(toolbarButtonMetrics));
    const warningsChip = designer.locator('[data-circuit-toolbar] [data-warnings-chip]:visible');
    if (await warningsChip.count()) {
        const chipMetrics = await warningsChip.first().evaluate(el => ({height: Math.round(el.getBoundingClientRect().height)}));
        check('warnings chip shares the toolbar control height', chipMetrics.height === 34, JSON.stringify(chipMetrics));
    }
    const toolbarGroupMetrics = await designer.locator('[data-circuit-toolbar] [data-circuit-control-group]:visible')
        .evaluateAll(groups => groups.map(group => Math.round(group.getBoundingClientRect().height)));
    check('toolbar control groups stay touch-sized',
        toolbarGroupMetrics.length >= 2 && toolbarGroupMetrics.every(height => height >= 34 && height <= 36),
        JSON.stringify(toolbarGroupMetrics));
    const modePaint = await modeToggle.getByRole('radio').evaluateAll(buttons => buttons.map(button => ({checked: button.getAttribute('aria-checked'), background: getComputedStyle(button).backgroundColor, color: getComputedStyle(button).color})));
    check('selected Build/Sim state is visibly painted', modePaint[0]?.checked === 'true' && modePaint[0].background !== modePaint[1].background && modePaint[0].background !== 'rgb(255, 255, 255)', JSON.stringify(modePaint));
    const powerToggle = designer.locator('[data-power-toggle]');
    check('power is a visible two-state toggle', await powerToggle.getByRole('radio').count() === 2 && await powerToggle.getByRole('radio', {name: 'Power on'}).getAttribute('aria-checked') === 'true');
    const powerPaint = await powerToggle.getByRole('radio').evaluateAll(buttons => buttons.map(button => ({checked: button.getAttribute('aria-checked'), background: getComputedStyle(button).backgroundColor})));
    check('selected power state is visibly painted', powerPaint[0]?.checked === 'true' && powerPaint[0].background !== powerPaint[1].background && powerPaint[0].background !== 'rgb(255, 255, 255)', JSON.stringify(powerPaint));
    check('view buttons share the Build/Sim toolbar', navigation === designer ?
        await designer.locator('[data-circuit-view-switcher]').first().evaluate(el => !!el.closest('[data-circuit-toolbar]')?.querySelector('[data-build-sim-toggle]')) :
        await moreTrigger.evaluate(el => !!el.closest('[data-circuit-toolbar]')?.querySelector('[data-build-sim-toggle]')) &&
            await moreTrigger.getAttribute('aria-controls') === await overflowMenu.first().getAttribute('id'));
    const panelNavigation = navigation.locator('[data-panel-navigation]');
    check('shared toolbar has panel navigation', await panelNavigation.count() === 1 && await panelNavigation.locator('button').count() >= 4, `containers=${await panelNavigation.count()} buttons=${await panelNavigation.locator('button').count()}`);
    if (navigation === designer) {
        const panelButtonMetrics = await panelNavigation.getByRole('button', {name: 'Designer'})
            .evaluateAll(buttons => buttons.map(button => ({width: button.getBoundingClientRect().width,
                height: button.getBoundingClientRect().height})));
        check('panel navigation uses compact equal buttons', panelButtonMetrics.length === 1 &&
            panelButtonMetrics[0].width <= 42 && panelButtonMetrics[0].height >= 30, JSON.stringify(panelButtonMetrics));
    } else {
        check('overflow panel controls have visible text labels', await panelNavigation.getByRole('menuitemradio').count() === 4);
    }
    const toolbarBox = await toolbar.boundingBox();
    check('toolbar is touch-sized', !!toolbarBox && toolbarBox.height >= 40, toolbarBox ? `${toolbarBox.width}x${toolbarBox.height}` : 'missing');
    check('light presentation uses a light toolbar', await designer.locator('[data-circuit-toolbar]').evaluate(el => getComputedStyle(el).backgroundColor === 'rgb(248, 250, 252)'));
    const moreControls = designer.getByRole('button', {name: 'More circuit controls'});
    check('save/load/zoom controls have a single overflow slot', await moreControls.count() === 1 && await designer.locator('[data-toolbar-more]').count() === 1);
    // The open popup can cover its own trigger in a narrow designer.
    if (await moreControls.getAttribute('aria-expanded') === 'true') await moreControls.click({force: true});
    // Follow this designer's trigger to its actual menu, including a body portal.
    const moreMenu = await openCircuitActions(page, designer, {force: true, timeout: 2000});
    const menuN = await moreMenu.count();
    // The load control is labelled Open/Öffnen (File-menu convention), not "Load".
    const saveN = menuN ? await moreMenu.getByText(/Save|Speichern/).count() : 0;
    const openN = menuN ? await moreMenu.getByText(/Open|Öffnen/).count() : 0;
    const zoomN = await moreMenu.locator('[data-zoom-indicator]').count();
    check('overflow slot exposes Save, Open, and Zoom', menuN >= 1 && saveN >= 1 && openN >= 1 && zoomN >= 1, `menu=${menuN} save=${saveN} open=${openN} zoom=${zoomN}`);
    check('zoom indicator has readable contrast styling', await moreMenu.locator('[data-zoom-indicator]').evaluate(el => getComputedStyle(el).color !== getComputedStyle(el.parentElement).backgroundColor));
    await moreControls.click({force: true});
    // One row that scrolls sideways (owner decision 2026-11-02, the Robot Lab / Code-tab
    // pattern), not a toolbar that wraps onto more rows: the controls scroll inside
    // [data-circuit-toolbar-scroll] and the ⋯ trigger is pinned outside it.
    check('toolbar is one non-wrapping row whose controls scroll sideways', await designer.locator('[data-circuit-toolbar]').evaluate(el => {
        const scroller = el.querySelector('[data-circuit-toolbar-scroll]');
        const more = el.querySelector('[aria-label="More circuit controls"]');
        return getComputedStyle(el).flexWrap === 'nowrap' && !!scroller && getComputedStyle(scroller).flexWrap === 'nowrap' &&
            getComputedStyle(scroller).overflowX === 'auto' && !!more && !scroller.contains(more);
    }));

    // The dedicated Circuit tab is the full designer. The Blocks tab embeds a
    // compact circuit preview, where editor chrome starts collapsed.
    const fullPartsButton = designer.getByRole('button', {name: /^Collapse Parts/});
    check('full designer shows its parts panel', await fullPartsButton.count() === 1);
    if (await fullPartsButton.count()) {
        await fullPartsButton.click({force: true});
        await page.waitForTimeout(100);
        check('parts selector actually collapses without hiding selectors panel', await designer.getByRole('button', {name: /^Expand Parts/}).count() === 1 && await designer.locator('[data-selectors-panel]').count() === 1 && await designer.locator('[data-parts-selector]').count() === 1);
        await designer.getByRole('button', {name: /^Expand Parts/}).click({force: true});
        await page.waitForTimeout(100);
        check('parts selector actually reopens', await designer.getByRole('button', {name: /^Collapse Parts/}).count() === 1 && await designer.locator('[data-selectors-panel]').count() === 1);
        check('parts/examples divider is draggable', await designer.locator('[data-selector-divider]').count() === 1 && await designer.locator('[data-selector-divider]').getAttribute('role') === 'separator');
    }
    const selectorCollapse = designer.getByRole('button', {name: 'Collapse Selectors Panel'});
    check('selectors panel has an adjacent collapse handle', await selectorCollapse.count() === 1);
    if (await selectorCollapse.count()) {
        await selectorCollapse.click({force: true});
        await page.waitForTimeout(100);
        check('selectors collapse keeps its handle visible', await designer.getByRole('button', {name: 'Expand Selectors Panel'}).count() === 1 && await designer.locator('[data-selectors-panel]').count() === 0);
        await designer.getByRole('button', {name: 'Expand Selectors Panel'}).click({force: true});
        await page.waitForTimeout(100);
    check('selectors panel reopens from its persistent handle', await designer.locator('[data-selectors-panel]').count() === 1);
    }
    const examplesSelector = designer.locator('[data-examples-selector]').first();
    check('Examples selector starts collapsed with its own expand control', await examplesSelector.count() === 1 && await examplesSelector.getByRole('button', {name: /^Expand Examples/i}).count() === 1);
    if (await examplesSelector.count()) {
        await examplesSelector.getByRole('button', {name: /^Expand Examples/i}).click({force: true});
        await examplesSelector.locator('[data-examples-selector-content]').waitFor({state: 'visible'});
        await examplesSelector.getByRole('button', {name: /^Collapse Examples/i}).click({force: true});
        check('Examples selector actually collapses', await examplesSelector.getByRole('button', {name: /^Expand Examples/i}).count() === 1 && await examplesSelector.locator('[data-examples-selector-content]').count() === 0);
        await examplesSelector.getByRole('button', {name: /^Expand Examples/i}).click({force: true});
        check('Examples selector actually reopens', await examplesSelector.getByRole('button', {name: /^Collapse Examples/i}).count() === 1 && await examplesSelector.locator('[data-examples-selector-content]').count() === 1);
    }
    await ensureCircuitNavigation();
    const examplesModeButton = page.locator('[data-panel-navigation] button[aria-label="Examples"]:visible').first();
    if (await examplesModeButton.count()) {
        // A DOM click: the portalled overflow can scroll under a coordinate click.
        await examplesModeButton.evaluate(button => button.click());
        await page.waitForTimeout(250);
        const examplesMode = page.locator('[data-examples-selector]:visible').last();
        const examplesContent = examplesMode.locator('[data-examples-selector-content]');
        // Dedicated mode is examples-only: it has no collapse toggle (there
        // is nothing to yield space to). Expanded = content present and no
        // 'Expand' affordance claiming it is collapsed.
        check('dedicated Examples mode starts expanded', await examplesMode.getByRole('button', {name: /^Expand Examples/i}).count() === 0 && await examplesContent.count() === 1);
        if (await examplesContent.count()) {
            const metrics = await examplesContent.evaluate(el => ({scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, overflowY: getComputedStyle(el).overflowY}));
            check('dedicated Examples mode is scrollable', metrics.scrollHeight > metrics.clientHeight && metrics.overflowY === 'auto', JSON.stringify(metrics));
        }
        await page.locator('[data-panel-navigation] button[aria-label="Designer"]:visible').first().evaluate(button => button.click());
        await page.waitForTimeout(150);
    }
    await ensureCircuitNavigation();
    await navigation.getByRole(navigation === designer ? 'radio' : 'menuitemradio', {name: 'Schematic view'}).click();
    await page.waitForTimeout(150);
    const realisticEscape = page.locator('[data-schematic-escape] button[title="Realistic view"]');
    check('schematic view keeps an escape route', await realisticEscape.count() >= 1);
    if (await realisticEscape.count()) await realisticEscape.last().evaluate(el => el.click());
    await circuitButton.click();
    await page.waitForTimeout(250);
    await page.getByRole('tab', {name: 'Blocks', exact: true}).click();
    await page.waitForTimeout(700);
    const embedded = page.locator('[data-bw-circuit-stage-host] .bw-circuit-designer');
    const embeddedRealistic = embedded.getByRole('radio', {name: 'Realistic view'});
    if (await embeddedRealistic.count() && await embeddedRealistic.getAttribute('aria-checked') !== 'true') await embeddedRealistic.click({force: true});
    const selectorsButton = embedded.getByRole('button', {name: 'Expand Selectors Panel'});
    check('embedded preview starts with selectors panel collapsed', await selectorsButton.count() === 1);
    if (await selectorsButton.count()) {
        await selectorsButton.click({force: true});
        await page.waitForTimeout(150);
        if (await embedded.getAttribute('data-selectors-open') !== 'true') {
            await embedded.evaluate(root => root.querySelector('button[aria-label="Expand Selectors Panel"]')?.click());
            await page.waitForTimeout(150);
        }
    }
    const partsButton = embedded.getByRole('button', {name: /^Expand Parts/});
    check('embedded preview starts with parts collapsed', await partsButton.count() === 1,
        `collapse=${await embedded.getByRole('button', {name: /^Collapse Parts/}).count()} selectors=${await embedded.locator('[data-selectors-panel]').count()} open=${await embedded.getAttribute('data-selectors-open')} designers=${await page.locator('[data-bw-circuit-stage-host] .bw-circuit-designer').count()} schematic=${await embedded.getByRole('radio', {name: 'Schematic view'}).count()}`);
    const collapsedPartsBox = await partsButton.boundingBox();
    const collapsedPartsStyle = await partsButton.evaluate(el => ({position: getComputedStyle(el).position, width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height}));
    check('collapsed parts handle is a compact overlay', collapsedPartsStyle.position === 'absolute' && collapsedPartsStyle.width <= 40 && collapsedPartsStyle.height <= 40, JSON.stringify(collapsedPartsStyle));
    await partsButton.evaluate(el => el.click());
    await page.waitForTimeout(150);
    const palettes = embedded.locator('input[placeholder="search..."]');
    const palette = palettes.first();
    check('parts palette can reopen', await palettes.count() === 1, `embedded=${await embedded.count()} expand=${await partsButton.count()}`);
    const paletteBox = embedded.locator('[data-parts-palette]');
    const paletteMetrics = await paletteBox.evaluate(el => {
        const r = el.getBoundingClientRect();
        return {top: r.top, bottom: r.bottom, viewport: window.innerHeight,
            scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, overflowY: getComputedStyle(el).overflowY};
    });
    check('parts palette fits inside the viewport', paletteMetrics.top >= 0 && paletteMetrics.bottom <= 768 && paletteMetrics.clientHeight > 0, JSON.stringify(paletteMetrics));
    const scrollable = paletteMetrics.scrollHeight > paletteMetrics.clientHeight && paletteMetrics.overflowY === 'auto';
    check('parts palette is genuinely scrollable', scrollable, JSON.stringify(paletteMetrics));
    const beforeScroll = await paletteBox.evaluate(el => el.scrollTop);
    await paletteBox.evaluate(el => { el.scrollTop = el.scrollHeight; el.dispatchEvent(new Event('scroll', {bubbles: true})); });
    const afterScroll = await paletteBox.evaluate(el => el.scrollTop);
    check('parts palette reaches its bottom', afterScroll > beforeScroll && afterScroll + paletteMetrics.clientHeight >= paletteMetrics.scrollHeight - 1, `${beforeScroll} -> ${afterScroll}`);
    check('parts palette remains viewport bounded after scrolling', await paletteBox.evaluate(el => {
        const r = el.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= window.innerHeight && el.clientHeight > 0 && el.scrollHeight > el.clientHeight && getComputedStyle(el).overflowY === 'auto';
    }), JSON.stringify(paletteMetrics));
    check('example info is compact and on demand', await embedded.getByText('Why active-low?', {exact: true}).count() === 0 && await embedded.getByRole('button', {name: /Example info|Info for/}).count() === 1);
    const canvasMetrics = await embedded.locator('[data-canvas]').evaluate(el => {
        const r = el.getBoundingClientRect();
        const p = el.closest('[data-designer-main]');
        const pr = p.getBoundingClientRect();
        return {width: r.width, height: r.height, parentWidth: pr.width, parentHeight: pr.height,
            scrollWidth: p.scrollWidth, clientWidth: p.clientWidth, scrollHeight: p.scrollHeight, clientHeight: p.clientHeight};
    });
    check('circuit canvas fits or exceeds its available width without clipping', canvasMetrics.parentWidth > 0 && canvasMetrics.width >= canvasMetrics.parentWidth - 2 && canvasMetrics.scrollWidth >= canvasMetrics.clientWidth, JSON.stringify(canvasMetrics));
    // FIT-FIRST CONTRACT (owner, 2026-08-16: 'does not properly scale'):
    // the canvas FILLS whatever pane it gets and only overflows (scrolls)
    // when the pane is smaller than the 700x500 logical floor. The old
    // expectation — canvas always wider than its pane — fossilized the
    // 900px-floor era, which slid the canvas under the rail.
    check('circuit designer viewport fills the pane or scrolls below the floor',
        (canvasMetrics.clientWidth >= Math.min(700, canvasMetrics.parentWidth || canvasMetrics.clientWidth) - 2) &&
        (canvasMetrics.scrollWidth >= canvasMetrics.clientWidth) &&
        (canvasMetrics.scrollHeight >= canvasMetrics.clientHeight),
        JSON.stringify(canvasMetrics));
    const narrowLayout = await embedded.evaluate(root => {
        const toolbar = root.querySelector('[data-circuit-toolbar]');
        const main = root.querySelector('[data-designer-main]');
        const canvas = root.querySelector('[data-canvas]');
        const oldWidth = toolbar.style.width;
        toolbar.style.width = '320px';
        toolbar.style.maxWidth = '320px';
        // flex-basis is along the MAIN axis, and the toolbar's parent is a COLUMN: the old
        // `flex: 0 0 320px` made the toolbar 320px TALL, which is why the wrap-era check
        // (height > 44) passed whatever the row did. Keep the basis at the content height.
        toolbar.style.flex = '0 0 auto';
        const scroller = toolbar.querySelector('[data-circuit-toolbar-scroll]');
        const more = toolbar.querySelector('[aria-label="More circuit controls"]');
        const tr = toolbar.getBoundingClientRect(), mr = more?.getBoundingClientRect();
        const result = {toolbarHeight: toolbar?.getBoundingClientRect().height || 0, mainWidth: main?.clientWidth || 0,
            scrollerScrollWidth: scroller?.scrollWidth || 0, scrollerClientWidth: scroller?.clientWidth || 0,
            moreInside: !!mr && mr.width > 0 && mr.left >= tr.left - 1 && mr.right <= tr.right + 1,
            mainScrollWidth: main?.scrollWidth || 0, mainScrollHeight: main?.scrollHeight || 0,
            canvasWidth: canvas?.getBoundingClientRect().width || 0};
        toolbar.style.width = oldWidth;
        toolbar.style.maxWidth = '';
        toolbar.style.flex = '';
        return result;
    });
    check('narrow toolbar stays one row and scrolls instead of wrapping',
        narrowLayout.toolbarHeight >= 40 && narrowLayout.toolbarHeight <= 52 &&
        narrowLayout.scrollerScrollWidth > narrowLayout.scrollerClientWidth && narrowLayout.moreInside, JSON.stringify(narrowLayout));
    check('toolbar row is not vertically cropped', await embedded.evaluate(root => {
        const toolbar = root.querySelector('[data-circuit-toolbar]');
        const canvas = root.querySelector('[data-canvas]');
        const tr = toolbar?.getBoundingClientRect();
        const cr = canvas?.getBoundingClientRect();
        return !!tr && !!cr && tr.bottom <= cr.top && tr.height >= 44;
    }));
    check('narrow circuit pane remains scrollable instead of static crop',
        narrowLayout.mainWidth > 0 && narrowLayout.mainScrollHeight > 0 &&
        // Below the 700 floor the canvas must overflow (scroll); at or
        // above it, filling exactly is the design, not a defect.
        (narrowLayout.mainWidth >= 700 || narrowLayout.mainScrollWidth >= 700),
        JSON.stringify(narrowLayout));
    await page.setViewportSize({width: 760, height: 520});
    await page.waitForTimeout(150);
    const resizedLayout = await embedded.evaluate(root => {
        const main = root.querySelector('[data-designer-main]');
        const canvas = root.querySelector('[data-canvas]');
        const mr = main.getBoundingClientRect();
        const cr = canvas.getBoundingClientRect();
        return {mainWidth: mr.width, mainHeight: mr.height, canvasRight: cr.right, viewport: window.innerWidth,
            scrollWidth: main.scrollWidth, clientWidth: main.clientWidth, scrollHeight: main.scrollHeight, clientHeight: main.clientHeight};
    });
    check('designer resizes with a narrow window: floor holds, scroll appears below it',
        resizedLayout.mainWidth > 0 &&
        (resizedLayout.mainWidth >= 700 || resizedLayout.scrollWidth >= 700),
        JSON.stringify(resizedLayout));
    check('designer keeps vertical room after a narrow-window resize',
        resizedLayout.scrollHeight >= Math.min(500, resizedLayout.clientHeight || 500),
        JSON.stringify(resizedLayout));
    await page.setViewportSize({width: 1024, height: 768});
    const actions = embedded.locator('[data-element-actions]');
    check('selected-element actions stay on the grid surface', await embedded.locator('[data-selection-actions]').count() === 0 || await embedded.locator('[data-selection-actions]').evaluate(el => getComputedStyle(el).position === 'absolute' && el.getBoundingClientRect().width > 0));
    const undo = page.getByRole('button', {name: 'Undo'}).last();
    const undoBox = await undo.boundingBox();
    check('undo/redo controls are touch-sized', !!undoBox && undoBox.width >= 34 && undoBox.height >= 30);

    const instruments = embedded.locator('[data-instruments-column]');
    const expandInstruments = page.getByRole('button', {name: 'Expand instruments panel'});
    if (await expandInstruments.count()) {
        const collapsedInstrumentsStyle = await expandInstruments.last().evaluate(el => ({position: getComputedStyle(el).position, width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height}));
        check('collapsed instruments handle is a compact overlay', collapsedInstrumentsStyle.position === 'absolute' && collapsedInstrumentsStyle.width <= 40 && collapsedInstrumentsStyle.height <= 40, JSON.stringify(collapsedInstrumentsStyle));
        await expandInstruments.last().evaluate(el => el.click());
        await page.waitForTimeout(100);
    }
    check('instrument panel has a compact expand/collapse affordance', await instruments.count() === 1 || await expandInstruments.count() === 1);
    check('toolbar has no duplicate right-panel button', await embedded.getByRole('button', {name: /Show right panel|Hide right panel/}).count() === 0);
    const scopeButtons = page.getByRole('button', {name: /Scope$/});
    for (let i = 0; i < await scopeButtons.count(); i++) {
        await scopeButtons.nth(i).evaluate(el => el.click());
        await page.waitForTimeout(80);
        if (await page.locator('[data-scope-panel]').count()) break;
    }
    const meterButton = page.getByRole('button', {name: /Meter$/}).last();
    if (await meterButton.count()) await meterButton.evaluate(el => el.click());
    await page.waitForTimeout(250);
    const scopePanel = page.locator('[data-scope-panel]').first();
    const meterTitle = page.getByText('Multimeter', {exact: true}).first();
    check('oscilloscope toggle is available from the instrument panel', await scopeButtons.count() >= 1 || await scopePanel.count() === 1, `embedded=${await embedded.count()} instruments=${await instruments.count()}`);
    if (await scopePanel.count()) check('oscilloscope fits inside the instrument column', await scopePanel.evaluate(el => el.getBoundingClientRect().right <= el.parentElement.getBoundingClientRect().right + 1));
    check('multimeter is available from the instrument panel', await meterTitle.count() >= 1, `titles=${await meterTitle.count()}`);

    const instrumentScroll = embedded.locator('[data-instruments-scroll]');
    const instrumentMetrics = await instrumentScroll.evaluate(el => ({
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
        overflowY: getComputedStyle(el).overflowY,
        scrollTop: el.scrollTop,
        bottom: el.getBoundingClientRect().bottom,
        viewport: window.innerHeight,
        scope: !!el.querySelector('[data-scope-module]'),
        meter: !!el.querySelector('[data-meter-module]'),
    }));
    check('Scope and Meter share the scrollable Instruments viewport', instrumentMetrics.scope && instrumentMetrics.meter && instrumentMetrics.overflowY === 'auto' && instrumentMetrics.scrollHeight >= instrumentMetrics.clientHeight && instrumentMetrics.bottom <= instrumentMetrics.viewport + 1,
        JSON.stringify(instrumentMetrics));
    if (instrumentMetrics.scrollHeight > instrumentMetrics.clientHeight) {
        const scrolled = await instrumentScroll.evaluate(el => {
            el.scrollTop = el.scrollHeight;
            const scope = el.querySelector('[data-scope-module]');
            const meter = el.querySelector('[data-meter-module]');
            const viewport = el.getBoundingClientRect();
            return {scrollTop: el.scrollTop, scopeBottom: scope?.getBoundingClientRect().bottom, meterTop: meter?.getBoundingClientRect().top, viewportBottom: viewport.bottom};
        });
        check('Instruments can scroll to reveal content below Scope', scrolled.scrollTop > 0 && scrolled.meterTop <= scrolled.viewportBottom + 1, JSON.stringify(scrolled));
    }

    await embedded.locator('[data-build-sim-toggle]').getByRole('radio', {name: 'Sim mode'}).evaluate(el => el.click());
    await page.waitForTimeout(100);
    check('run/step controls are in the instrument column', await embedded.locator('[data-simulation-controls]').count() === 1, `sim=${await embedded.locator('[data-simulation-controls]').count()}`);
    const pauseButton = page.locator('button[title="Pause simulation"]');
    const pauseBox = await pauseButton.count() ? await pauseButton.boundingBox() : null;
    const designerBox = await embedded.boundingBox();
    check('run/step controls stay in the designer instrument area', !!pauseBox && !!designerBox && pauseBox.x >= designerBox.x);

    // The two orange disclosure-triangle notices ("Build a circuit on its own" /
    // "Run and step controls appear here") were removed at the owner's request —
    // the top-bar Warnings selector (with its count) is the single home for flags
    // now. The gate that asserted their presence is gone with them.

    // A program imported from the pseudocode/examples flow must leave a sprite
    // selected. The Stage has no Motion toolbox, so selecting it here would
    // recreate the regression even though the project loaded successfully.
    const blocksTab = page.getByRole('tab', {name: 'Blocks', exact: true});
    await blocksTab.click({force: true});
    await page.waitForTimeout(300);
    const targetText = await page.locator('body').innerText();
    check('Blocks workflow keeps Motion blocks available after example import', !targetText.includes('Stage selected: no motion blocks') && await page.getByText('Motion', {exact: true}).count() >= 1);
    await circuitButton.click({force: true});
    await page.waitForTimeout(250);
    check('Circuit Designer without debugger works from Blocks mode', await page.evaluate(() => localStorage.getItem('bw-debug-dock')) === 'off' && await page.locator('[data-bw-circuit-stage-host]').count() === 1);
    check('debugger panel is absent in debugger-free Blocks mode', await page.locator('[data-bw-circuit-stage-host] [data-debugger-panel]').count() === 0);

    const greenFlag = page.locator('img[title="Go"]:visible, [aria-label*="Green Flag" i]:visible, [title*="green flag" i]:visible');
    if (await greenFlag.count()) {
        await page.evaluate(() => { window.__bwGreenFlagSeen = 0; window.addEventListener('bw-green-flag', () => { window.__bwGreenFlagSeen++; }, {once: false}); });
        await greenFlag.last().click({force: true});
        await page.waitForTimeout(250);
        const greenFlagSeen = await page.evaluate(() => window.__bwGreenFlagSeen || 0);
        const controlsAfterGreen = await page.locator('[data-bw-circuit-stage-host] [data-simulation-controls]').count();
        check('green flag starts the embedded simulation lifecycle', controlsAfterGreen === 1,
            `events=${greenFlagSeen} simMode=${await page.locator('[data-bw-circuit-stage-host] [data-sim-mode="simulate"]').count()} controls=${controlsAfterGreen} direct=${await page.locator('[data-bw-circuit-stage-host] [data-simulation-controls]').count()}`);
        const stop = page.locator('img[title="Stop"]:visible, [aria-label="Stop"]:visible, [title="Stop"]:visible').last();
        if (await stop.count()) {
            await stop.click({force: true});
            await page.waitForTimeout(150);
            check('red flag stops the embedded simulation lifecycle', await page.locator('[data-bw-circuit-stage-host] [data-simulation-controls]').count() === 0);
        }
    } else {
        check('green flag control is discoverable for lifecycle testing', false, 'no green flag selector');
    }

    // Fresh installed-app journey; no injected circuit/clock implementation.
    // Lite's Sim button also issues a runToken, so observe reset synchronously
    // instead of racing a Pause click against the newly running clock.
    const scopePage = await browser.newPage({viewport: {width: 1440, height: 900}});
    try {
        await scopePage.addInitScript(() => {
            localStorage.clear(); sessionStorage.clear();
            localStorage.setItem('bw-starter-v1-complete', '1');
        });
        await scopePage.goto(`http://localhost:${port}/`, {waitUntil: 'networkidle', timeout: 60000});
        await scopePage.getByRole('tab', {name: /Circuit/}).click();
        const designer = scopePage.locator('.bw-circuit-designer:visible').last();
        await designer.locator('[data-canvas]').waitFor({timeout: 60000});
        const fixture = {parts: [
            {id: 'scope-v', kind: 'vsource', params: {volts: 1}, x: 100, y: 100},
            {id: 'scope-r', kind: 'resistor', params: {ohms: 1000}, x: 250, y: 100},
            {id: 'scope-g', kind: 'gnd', params: {}, x: 100, y: 230},
            {id: 'scope-c', kind: 'capacitor', params: {farads: 1e-6}, x: 250, y: 230}
        ], nets: [
            {id: 'signal', terminals: [{part: 'scope-v', terminal: 'pos'}, {part: 'scope-r', terminal: 'a'}, {part: 'scope-c', terminal: 'a'}]},
            {id: 'ground', terminals: [{part: 'scope-v', terminal: 'neg'}, {part: 'scope-r', terminal: 'b'}, {part: 'scope-g', terminal: 'gnd'}, {part: 'scope-c', terminal: 'b'}]}
        ]};
        const scopeMenu = await openCircuitActions(scopePage, designer);
        const choosing = scopePage.waitForEvent('filechooser');
        await (await circuitFileControl(scopeMenu, 'open')).click();
        await (await choosing).setFiles({name: 'scope-reset.json', mimeType: 'application/json',
            buffer: Buffer.from(JSON.stringify(fixture))});
        await scopePage.waitForFunction(() => window.__board === window.__circuit?.board
            && window.__board.parts.some(p => p.id === 'scope-v'));
        await designer.getByRole('radio', {name: 'Sim mode', exact: true}).click();
        await scopePage.waitForFunction(() => window.__board.getTime() > 0n);
        if (!await designer.locator('[data-instruments-column]').count()) {
            await designer.getByRole('button', {name: /Expand instruments panel/i}).click();
        }
        await designer.getByRole('button', {name: /Pause simulation/i}).press('Enter');
        await designer.getByRole('button', {name: /Resume simulation/i}).waitFor();
        const scope = designer.locator('[data-scope-panel]');
        // The instrument toggle by its own label: /Scope/ alone first matched the palette's
        // Oscilloscope part tile (a role=button), which armed a part instead of opening the scope.
        if (!await scope.count()) await designer.getByRole('button', {name: /^▣ (Scope|Oszilloskop)$/}).click();
        await scope.waitFor();
        await scope.getByTestId('bw-scope-record').selectOption('100000');
        const signal = await scopePage.evaluate(() => window.__board.nets.find(n =>
            n.terminals.some(t => t.part === 'scope-v' && t.terminal === 'pos')).id);
        await scope.locator('select').last().selectOption(signal);
        await scope.getByText('+ channel', {exact: false}).click();
        await designer.getByRole('button', {name: /Step one tick|Advance one 50/i}).press('Enter');
        await scopePage.waitForFunction(() => {
            const b = window.__board, hs = b.getScopeChannels();
            return hs.length === 1 && b.getScopeData(hs[0]).count === 5000;
        });
        await scopePage.evaluate(() => {
            const b = window.__board, handle = b.getScopeChannels()[0];
            const receipt = {resets: [], firstCapture: null, errors: [],
                partialReceipts: 0, maxSpanNs: '0', receiptMismatches: []};
            window.__bwScopeResetReceipt = receipt;
            // Observe the installed method; do not replace its scheduling or
            // numerical implementation. The time view records envelopes;
            // only the separately selected spectrum tap imposes a sample grid.
            const nativeAdvance = b.advanceToLive;
            b.advanceToLive = function (...args) {
                const before = this.getTime();
                const result = nativeAdvance.apply(this, args);
                const after = this.getTime(), span = after - before;
                if (span > BigInt(receipt.maxSpanNs)) receipt.maxSpanNs = String(span);
                if (!result.completed) receipt.partialReceipts++;
                if (result.processedTimeNs !== String(after)
                    || result.requestedTimeNs !== String(args[0])
                    || result.completed !== (after === args[0])) {
                    receipt.receiptMismatches.push({before: String(before), after: String(after)});
                }
                return result;
            };
            const observe = event => {
                try {
                    if (event.type === 'reset') {
                        const d = b.getScopeData(handle);
                        receipt.resets.push({zero: b.getTime() === 0n,
                            retained: b.getScopeChannels().length === 1 && b.getScopeChannels()[0] === handle,
                            empty: d.count === 0 && d.writeIndex === 0 && [...d.samples].every(Number.isNaN)});
                    } else if (event.type === 'time' && receipt.resets.length && b.getTime() >= 50000000n) {
                        const d = b.getScopeData(handle);
                        receipt.firstCapture = {time: String(b.getTime()), count: d.count, start: String(d.startTNs),
                            oneVolt: [...d.samples.slice(0, 10000)].every(v => v === 1)};
                        b.offChange(observe);
                    }
                } catch (e) {receipt.errors.push(String(e)); b.offChange(observe);}
            };
            b.onChange(observe);
        });
        await designer.getByRole('radio', {name: 'Build mode', exact: true}).click();
        await designer.getByRole('radio', {name: 'Sim mode', exact: true}).click();
        // Build/Sim preserves the learner's pause choice. Reset is synchronous;
        // advance the new epoch through the actual single-step control, rather
        // than assuming a mode change silently resumes a paused simulation.
        await designer.getByRole('button', {name: /Resume simulation/i}).waitFor();
        await scopePage.waitForFunction(() => window.__bwScopeResetReceipt?.resets.length > 0);
        await designer.getByRole('button', {name: /Step one tick|Advance one 50/i}).press('Enter');
        await scopePage.waitForFunction(() => window.__bwScopeResetReceipt?.firstCapture
            || window.__bwScopeResetReceipt?.errors.length);
        const receipt = await scopePage.evaluate(() => window.__bwScopeResetReceipt);
        check('installed Sim reset retains scope and captures all first 5000 one-volt envelopes',
            receipt.errors.length === 0 && receipt.resets.length > 0
            && receipt.resets.every(r => r.zero && r.retained && r.empty)
            && receipt.firstCapture?.time === '50000000' && receipt.firstCapture.count === 5000
            && receipt.firstCapture.start === '0' && receipt.firstCapture.oneVolt,
            JSON.stringify(receipt));
        check('installed reactive envelope clock yields within sixteen100us profile quanta',
            receipt.partialReceipts > 0 && BigInt(receipt.maxSpanNs) > 0n
            && BigInt(receipt.maxSpanNs) <= 1600000n && receipt.receiptMismatches.length === 0,
            JSON.stringify(receipt));
        check('time-view recording is an envelope, not a solver sample grid',
            await scopePage.evaluate(() => {
                const b = window.__board, d = b.getScopeData(b.getScopeChannels()[0]);
                return d.capture === 'envelope' && d.sampleIntervalNs === 10000n;
            }));

        // Open a REAL point-sample tap through the learner's spectrum controls.
        // Do not synthesize a channel, alter the profile, or reuse the envelope
        // rate as sample authority. The original reset/one-volt proof above stays.
        const acquisitionState = () => scopePage.evaluate(() => {
            const b = window.__board;
            return {clock: String(b.getTime()), circuitBoardMatches: b === window.__circuit?.board,
                fftRate: document.querySelector('[data-testid="bw-scope-fft-rate"]')?.value,
                uiChannelRows: document.querySelectorAll('[data-testid="bw-scope-scale-0"]').length,
                channels: b.getScopeChannels().map(handle => {
                    const d = b.getScopeData(handle);
                    return {handle, capture: d.capture, interval: String(d.sampleIntervalNs),
                        aperture: d.apertureNs === undefined ? null : String(d.apertureNs),
                        count: d.count, start: String(d.startTNs)};
                })};
        });
        console.log('scope acquisition before spectrum:', JSON.stringify(await acquisitionState()));
        await scope.getByTestId('bw-scope-view-spectrum').click();
        // Let the spectrum effect open its default tap before changing rate.
        // Drive the learner-facing picker and require the engine acquisition
        // to agree; do not create a replacement tap or change its clock here.
        await scopePage.waitForFunction(() => {
            const b = window.__board;
            return b.getScopeChannels().some(h => {
                const d = b.getScopeData(h);
                return d.capture === 'sample' && d.sampleIntervalNs === 100000n && d.count === 0;
            });
        });
        const fftRate = scope.getByTestId('bw-scope-fft-rate');
        await fftRate.selectOption('100000');
        try { await scopePage.waitForFunction(() => {
            const b = window.__board, hs = b.getScopeChannels();
            const data = hs.map(h => b.getScopeData(h));
            const point = data.find(d => d.capture === 'sample');
            const audio = data.find(d => d.capture === 'average');
            return document.querySelector('[data-testid="bw-scope-fft-rate"]')?.value === '100000'
                // Retain the original envelope and point FFT; the independent
                // audio mean is a third acquisition, with its own cadence.
                && data.map(d => d.capture).sort().join('|') === 'average|envelope|sample'
                && point.sampleIntervalNs === 10000n && point.count === 0
                && audio.sampleIntervalNs === 10000n && audio.apertureNs === 10000n && audio.count === 0;
        }); } catch (error) {
            console.log('scope acquisition refused spectrum readiness:',
                JSON.stringify(await acquisitionState()));
            throw error;
        }
        await scopePage.evaluate(() => {
            const r = window.__bwScopeResetReceipt;
            r.partialReceipts = 0; r.maxSpanNs = '0'; r.receiptMismatches = [];
        });
        await designer.getByRole('button', {name: /Step one tick|Advance one 50/i}).press('Enter');
        await scopePage.waitForFunction(() => window.__board.getTime() === 100000000n);
        const pointReceipt = await scopePage.evaluate(() => {
            const b = window.__board;
            const h = b.getScopeChannels().find(h => b.getScopeData(h).capture === 'sample');
            const d = b.getScopeData(h);
            const audioHandle = b.getScopeChannels().find(h => b.getScopeData(h).capture === 'average');
            const audio = b.getScopeData(audioHandle);
            const means = [...audio.samples.slice(0, 10000)];
            return {clock: String(b.getTime()), capture: d.capture, interval: String(d.sampleIntervalNs),
                start: String(d.startTNs), count: d.count,
                oneVolt: [...d.samples.slice(0, 10000)].every(v => v === 1),
                audio: {capture: audio.capture, interval: String(audio.sampleIntervalNs),
                    aperture: String(audio.apertureNs), count: audio.count,
                    finite: means.every(Number.isFinite), maxErrorV: Math.max(...means.map(v => Math.abs(v - 1))),
                    // Integrating subtracts floating-point endpoint times. Bound
                    // their roundoff relative to the aperture, at one volt;
                    // the original point readings above remain bit-exact.
                    roundoffBoundV: 4 * Number.EPSILON * Number(b.getTime()) / Number(audio.apertureNs)},
                ...window.__bwScopeResetReceipt};
        });
        check('installed spectrum point capture retains all5000 exact one-volt samples',
            pointReceipt.clock === '100000000' && pointReceipt.capture === 'sample'
            // Point samples are timestamped at the first sample instant, not
            // the envelope bucket's start: 50ms + one10us sample interval.
            && pointReceipt.interval === '10000' && pointReceipt.start === '50010000'
            && pointReceipt.count === 5000 && pointReceipt.oneVolt, JSON.stringify(pointReceipt));
        check('installed independent audio mean retains all5000 one-volt apertures within time-coordinate roundoff',
            pointReceipt.audio.capture === 'average' && pointReceipt.audio.interval === '10000'
            && pointReceipt.audio.aperture === '10000' && pointReceipt.audio.count === 5000
            && pointReceipt.audio.finite && pointReceipt.audio.maxErrorV <= pointReceipt.audio.roundoffBoundV,
            JSON.stringify(pointReceipt.audio));
        check('installed reactive point-sample clock yields within sixteen10us sample quanta',
            pointReceipt.partialReceipts > 0 && BigInt(pointReceipt.maxSpanNs) > 0n
            && BigInt(pointReceipt.maxSpanNs) <= 160000n
            && pointReceipt.receiptMismatches.length === 0 && pointReceipt.errors.length === 0,
            JSON.stringify(pointReceipt));
    } finally {await scopePage.close();}


    // The real meter must distinguish an unmodelled rail current from zero,
    // and recover when the learner moves the probe back to a represented lead.
    {
        const meterPage = await browser.newPage({viewport: {width: 1600, height: 1000}});
        const meterErrors = [];
        meterPage.on('pageerror', error => meterErrors.push(error.message));
        try {
            await meterPage.addInitScript(() => {
                localStorage.clear(); sessionStorage.clear();
                localStorage.setItem('bw-starter-v1-complete', '1');
            });
            await meterPage.goto(`http://localhost:${port}/`, {waitUntil: 'networkidle', timeout: 60000});
            await meterPage.getByRole('tab', {name: /Circuit/}).click();
            const designer = meterPage.locator('.bw-circuit-designer:visible').last();
            await designer.locator('[data-canvas]').waitFor({timeout: 60000});
            const meterMenu = await openCircuitActions(meterPage, designer);
            const choosing = meterPage.waitForEvent('filechooser');
            await (await circuitFileControl(meterMenu, 'open')).click();
            await (await choosing).setFiles({name: 'lm741-current-authority.json', mimeType: 'application/json',
                buffer: await readFile(join(root, 'test/fixtures/lm741-voltage-follower.json'))});
            await meterPage.waitForFunction(() => window.__board === window.__circuit?.board
                && window.__circuit.parts.some(part => part.id === 'u1' && part.kind === 'lm741'));
            await designer.getByRole('radio', {name: 'Sim mode', exact: true}).click();
            await meterPage.waitForFunction(() => window.__board?.getTime() > 0n);
            if (!await designer.locator('[data-instruments-column]').count()) {
                await designer.getByRole('button', {name: /Expand instruments panel/i}).click();
            }
            await designer.getByRole('button', {name: /Pause simulation/i}).press('Enter');
            await designer.getByRole('button', {name: /Resume simulation/i}).waitFor();
            const meter = designer.locator('[data-meter-module]');
            if (!await meter.count()) await designer.getByRole('button', {name: /Meter$/}).last().click();
            await meter.waitFor();
            await designer.getByRole('button', {name: 'Fit all parts', exact: true}).click();
            await meter.getByRole('button', {name: 'A', exact: true}).click();
            const place = async terminal => {
                await meter.getByRole('button', {name: /^Probe A:/}).click();
                const dot = designer.locator(`[data-terminal-dot="u1:${terminal}"] circle`).first();
                await dot.waitFor({state: 'visible'});
                const bounds = await dot.boundingBox();
                if (!bounds) throw new Error(`LM741 terminal ${terminal} has no real canvas position`);
                // Dots are pointer-transparent: use the real canvas hit test.
                await meterPage.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
            };
            const hasCurrent = () => meter.getByTestId('bw-meter-value').evaluate(el =>
                Number.isFinite(Number.parseFloat(el.textContent)) && Number.parseFloat(el.textContent) > 0);
            await place('out');
            await meterPage.waitForFunction(() => {
                const el = document.querySelector('[data-testid="bw-meter-value"]');
                return el && Number.parseFloat(el.textContent) > 0;
            });
            check('installed LM741 represented output current is readable before rail refusal', await hasCurrent());
            await place('vpos');
            await meter.getByTestId('bw-meter-note').filter({hasText: 'Cannot read current'}).waitFor();
            check('installed LM741 unmodelled supply current displays unavailable rather than zero',
                (await meter.getByTestId('bw-meter-value').textContent()).trim() === '---');
            await meterPage.evaluate(() => {
                const board = window.__board;
                board.advanceTo(board.getTime() + 1000000n);
            });
            await place('out');
            await meterPage.waitForFunction(() => {
                const el = document.querySelector('[data-testid="bw-meter-value"]');
                return el && Number.parseFloat(el.textContent) > 0;
            });
            check('installed LM741 meter recovers a represented current after rail refusal',
                await hasCurrent() && await meter.getByTestId('bw-meter-note').count() === 0);
        } catch (error) {
            check('installed LM741 current-authority consumer journey', false, String(error).split('\n')[0]);
        } finally {
            check('installed LM741 meter has no unexpected page errors', meterErrors.length === 0, JSON.stringify(meterErrors));
            await meterPage.close();
        }
    }

    // Qualified installed ADC view: actual built modules, real Board and file Open.
    {
        const ADC_IDS = ['scope-adc-primary-selection', 'scope-adc-render-and-raw', 'scope-adc-trigger',
          'scope-adc-csv-and-hold', 'scope-adc-reset-and-refusal'];
        async function exerciseInstalledADC(adcPage, report = () => {}) {
          const requireADC = (condition, message) => {if (!condition) throw new Error(message);};
          await adcPage.addInitScript(() => {
            localStorage.clear(); sessionStorage.clear();
            localStorage.setItem('bw-starter-v1-complete', '1');
          });
          await adcPage.goto(`http://localhost:${port}/`, {waitUntil: 'networkidle', timeout: 60000});
          await adcPage.getByRole('tab', {name: /Circuit/}).click();
          const designer = adcPage.locator('.bw-circuit-designer:visible').last();
          await designer.locator('[data-canvas]').waitFor({timeout: 60000});
          const fixture = {parts: [
            {id:'adc-v',kind:'vsource',x:100,y:100,params:{volts:.4}},
            {id:'adc-r',kind:'resistor',x:250,y:100,params:{ohms:1000}},
            {id:'adc-g',kind:'gnd',x:100,y:230,params:{}},
            {id:'adc-bad',kind:'vsource',x:320,y:230,params:{volts:0}},
          ], nets: [
            {id:'signal',terminals:[{part:'adc-v',terminal:'pos'},{part:'adc-r',terminal:'a'}]},
            {id:'ground',terminals:[{part:'adc-v',terminal:'neg'},{part:'adc-r',terminal:'b'},
              {part:'adc-g',terminal:'gnd'},{part:'adc-bad',terminal:'pos'},{part:'adc-bad',terminal:'neg'}]},
          ]};
          const adcMenu = await openCircuitActions(adcPage, designer);
          const choosing=adcPage.waitForEvent('filechooser');
          await (await circuitFileControl(adcMenu, 'open')).click();
          await (await choosing).setFiles({name:'ideal-adc-bench.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
          await adcPage.waitForFunction(()=>window.__board === window.__circuit?.board
            && window.__circuit.parts.some(p=>p.id==='adc-v'));
          await designer.getByRole('radio',{name:'Sim mode',exact:true}).click();
          await adcPage.waitForFunction(()=>window.__board?.getTime()>0n);
          if (!await adcPage.locator('[data-instruments-column]').count()) await designer.getByRole('button',{name:/Expand instruments panel/i}).click();
          await designer.getByRole('button',{name:/Pause simulation/i}).press('Enter');
          await designer.getByRole('button',{name:/Resume simulation/i}).waitFor();
          const scope=adcPage.locator('[data-scope-panel]');
          if (!await scope.count()) await designer.getByRole('button',{name:/^▣ (Scope|Oszilloskop)$/}).click(); // not the palette's Oscilloscope tile
          await scope.waitFor();
          // Start this finite imported bench at an actual fresh Board epoch. The
          // designer remains paused; the later reset/advance ABA stays below 5ms.
          await adcPage.evaluate(()=>window.__board.reset());
          requireADC(await scope.getByTestId('bw-scope-time-capture').inputValue()==='envelope'
            && await scope.getByTestId('bw-scope-adc-enabled').isDisabled(),'ADC_DEFAULT_CAPTURE_CHANGED');
          await scope.getByTestId('bw-scope-time-capture').selectOption('sample');
          await scope.getByTestId('bw-scope-record').selectOption('100000');
          const nets=await adcPage.evaluate(()=>window.__board.getNets().reduce((r,n)=>{
            if(n.terminals.some(t=>t.part==='adc-v'&&t.terminal==='pos'))r.signal=n.id;
            if(n.terminals.some(t=>t.part==='adc-g'))r.ground=n.id;return r;
          },{}));
          requireADC(nets.signal&&nets.ground,'ADC_REAL_NETS_MISSING');
          await scope.getByTestId('bw-scope-reference-net').selectOption(nets.ground);
          await scope.getByTestId('bw-scope-probe-preset').selectOption('10x');
          await scope.locator('select').last().selectOption(nets.signal);
          await scope.getByText('+ channel',{exact:false}).click();
          let handle=await adcPage.evaluate(()=>window.__board.getScopeChannels()[0]);
          await adcPage.evaluate(()=>window.__board.advanceTo(window.__board.getTime()+1000000n));
          await adcPage.waitForFunction(h=>window.__board.getScopeData(h).count>=90,handle);
          requireADC(await adcPage.evaluate(h=>window.__board.getScopeData(h).capture==='sample',handle)
            && await scope.getByTestId('bw-scope-time-capture').isDisabled(),'ADC_PRIMARY_SAMPLE_NOT_EXPLICIT');
          report(ADC_IDS[0],'explicit primary point acquisition with one loaded probe; envelope remains default');
          const rawCanvasBeforeScale=await scope.locator('canvas').first().evaluate(c=>c.toDataURL());
          const clockBeforeScale=await adcPage.evaluate(()=>String(window.__board.getTime()));
          await scope.getByTestId('bw-scope-vdiv-0').selectOption('0.5');
          await scope.getByTestId('bw-scope-center-0').fill('0');
          // Wait for the actual .4V trace at the selected +/-1.25V scale.
          // This observes publication without advancing the engine or sleeping
          // for an arbitrary frame budget; an absent/stale trace must time out.
          await adcPage.waitForFunction(previousCanvas => {
            const canvas=document.querySelector('[data-scope-panel] canvas');
            const readout=document.querySelector('[data-testid="bw-scope-acquisition-0"]');
            const span=document.querySelector('[data-testid="bw-scope-span-0"]');
            const retained=Number(readout?.getAttribute('data-retained'));
            if (!canvas || !readout || !span || readout.getAttribute('data-capture')!=='sample'
              || !Number.isInteger(retained) || retained<90 || readout.hasAttribute('data-adc-bits')
              || !span.textContent.startsWith('-1.250 … 1.250 V')
              || canvas.toDataURL()===previousCanvas) return false;
            const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
            const yExpected=canvas.height*(1-(.4+1.25)/2.5);
            for(let y=Math.floor(yExpected)-2;y<=Math.ceil(yExpected)+2;y++) {
              for(let x=0;x<canvas.width;x++) {
                const i=(y*canvas.width+x)*4;
                if(pixels[i+1]>70&&pixels[i+1]>pixels[i]*1.5&&pixels[i+1]>pixels[i+2]*1.2) return true;
              }
            }
            return false;
          }, rawCanvasBeforeScale);
          requireADC(await adcPage.evaluate(()=>String(window.__board.getTime()))===clockBeforeScale,
            'ADC_RAW_PUBLICATION_ADVANCED_ENGINE');
          const tracePixels=()=>scope.locator('canvas').first().evaluate(c=>{
            const image=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let found=0;
            for(let y=12;y<c.height-12;y++)for(let x=0;x<c.width;x++){
              const i=(y*c.width+x)*4;if(image[i+1]>70&&image[i+1]>image[i]*1.5&&image[i+1]>image[i+2]*1.2)found++;
            }return found;
          });
          requireADC(await tracePixels()>0,'ADC_RAW_CANVAS_CONTROL_MISSING');
          const rawCanvas=await scope.locator('canvas').first().evaluate(c=>c.toDataURL());
          const rawIdentity=()=>adcPage.evaluate(h=>{
            const b=window.__board,d=b.getScopeData(h);
            return JSON.stringify({clock:String(b.getTime()),handles:b.getScopeChannels(),count:d.count,
              writeIndex:d.writeIndex,start:String(d.startTNs),samples:Array.from(d.samples),
              loads:b._solveParts.filter(p=>String(p.id).startsWith('@scope:')).map(p=>({id:p.id,kind:p.kind,params:p.params})),
              caps:[...b.capVoltages].filter(([id])=>String(id).startsWith('@scope:'))});
          },handle);
          const before=await rawIdentity(), physical=JSON.parse(before);
          requireADC(physical.handles.length===1 && physical.loads.length===2
            && physical.loads.some(p=>p.kind==='resistor'&&p.params.ohms===10000000)
            && physical.loads.some(p=>p.kind==='capacitor'&&p.params.farads===15e-12),'ADC_LOADED_PROBE_CONTROL_MISSING');
          await scope.getByTestId('bw-scope-adc-enabled').check();
          await scope.getByTestId('bw-scope-adc-bits').fill('1');
          await scope.getByTestId('bw-scope-adc-high').fill('1');
          await adcPage.waitForFunction(()=>document.querySelector('[data-testid="bw-scope-acquisition-0"]')?.getAttribute('data-adc-bits')==='1');
          const readout=scope.getByTestId('bw-scope-acquisition-0');
          requireADC(await readout.getAttribute('data-adc-first-code')==='0'
            && Number(await readout.getAttribute('data-adc-first-volts'))===0
            && Math.abs(Number(await readout.getAttribute('data-adc-first-input'))-.4)<1e-9,'ADC_READOUT_CODE');
          requireADC(await rawIdentity()===before,'ADC_VIEW_ALTERED_RAW_CLOCK_OR_PROBE');
          requireADC(await tracePixels()>0,'ADC_MODELED_CANVAS_EMPTY');
          requireADC(await scope.locator('canvas').first().evaluate(c=>c.toDataURL())!==rawCanvas,'ADC_CANVAS_RAW_BYPASS');
          report(ADC_IDS[1],'raw .4V becomes displayed code0/0V without changing clock, ring, handle or 10MΩ/15pF load');
          const downloadCSV=async()=>{
            const [download]=await Promise.all([adcPage.waitForEvent('download'),scope.getByTestId('bw-scope-trace-csv-download').click()]);
            const stream=await download.createReadStream();const chunks=[];for await(const c of stream)chunks.push(c);
            return Buffer.concat(chunks).toString('utf8');
          };
          const csv=await downloadCSV(), lines=csv.split('\n');
          const header=lines.findIndex(line=>line==='elapsed_seconds,input_volts,adc_code,volts,clipping');
          requireADC(header>=0&&csv.includes('ideal-uniform-adc'),'ADC_CSV_FORMAT');
          const row=lines[header+1]?.split(',');
          requireADC(row&&Math.abs(Number(row[1])-.4)<1e-9&&row[2]==='0'&&Number(row[3])===0&&row[4]==='none','ADC_CSV_VALUES');
          await scope.getByTestId('bw-scope-adc-high').fill('0');
          await scope.getByTestId('bw-scope-adc-error').waitFor();
          const invalidRange={exportDisabled:await scope.getByTestId('bw-scope-trace-csv-download').isDisabled(),
            readouts:await scope.getByTestId('bw-scope-acquisition-0').count()};
          requireADC(invalidRange.exportDisabled&&invalidRange.readouts===0,
            `ADC_INVALID_RANGE_EXPORTED ${JSON.stringify(invalidRange)}`);
          await scope.getByTestId('bw-scope-adc-high').fill('1');
          await adcPage.waitForFunction(()=>document.querySelector('[data-testid="bw-scope-acquisition-0"]')?.getAttribute('data-adc-bits')==='1');
          requireADC(await rawIdentity()===before,'ADC_RANGE_REFUSAL_CHANGED_PHYSICS');
          // The raw waveform never crosses .75V, while the reconstructed .4→.6
          // transition is 0→1V. This is a digital-view trigger, not analog hardware.
          await scope.getByTestId('bw-scope-trigger-mode').selectOption('rising');
          await scope.getByTestId('bw-scope-trigger-level').fill('.75');
          await adcPage.evaluate(()=>{window.__board.setControl('adc-v',.6);window.__board.advanceTo(window.__board.getTime()+1000000n);});
          await adcPage.waitForFunction(()=>document.querySelector('[data-testid="bw-scope-trigger-status"]')?.getAttribute('data-triggered')==='true');
          requireADC(await adcPage.evaluate(h=>{
            const d=window.__board.getScopeData(h);return [...d.samples].filter(Number.isFinite).every(v=>v<.75);
          },handle),'ADC_RAW_TRIGGER_CONTROL');
          report(ADC_IDS[2],'trigger observes reconstructed 0→1V crossing while every raw point stays below .75V');
          await scope.getByTestId('bw-scope-hold').click();
          requireADC(await scope.getByTestId('bw-scope-adc-bits').isDisabled()
            && await scope.getByTestId('bw-scope-adc-enabled').isDisabled(),'ADC_HELD_CONFIG_EDITABLE');
          const held=await downloadCSV(), heldText=await readout.textContent();
          const heldCanvas=await scope.locator('canvas').first().evaluate(c=>c.toDataURL());
          await adcPage.evaluate(()=>{window.__board.setControl('adc-v',1.25);window.__board.advanceTo(window.__board.getTime()+1000000n);});
          requireADC(await downloadCSV()===held&&await readout.textContent()===heldText
            &&await scope.locator('canvas').first().evaluate(c=>c.toDataURL())===heldCanvas,'ADC_HOLD_RELABELLED_LIVE_CAPTURE');
          await scope.getByTestId('bw-scope-hold').click();
          await adcPage.waitForFunction(()=>{
            const el=document.querySelector('[data-testid="bw-scope-adc-readout-0"]');return el&&/0\/[1-9]/.test(el.textContent);
          });
          requireADC((await downloadCSV()).split('\n').some(line=>{
            const cells=line.split(',');return cells[4]==='above'&&Number(cells[1])>1&&cells[2]==='1'&&Number(cells[3])===1;
          }),'ADC_SATURATION_NOT_EXPORTED');
          report(ADC_IDS[3],'paired CSV carries raw/code/volts/clipping and HOLD remains byte-stable while real simulation advances');
          await scope.getByTestId('bw-scope-hold').click();
          await adcPage.evaluate(()=>{const b=window.__board,after=b.getTime()+1000000n;b.reset();b.advanceTo(after);});
          await scope.getByTestId('bw-scope-adc-error').waitFor();
          requireADC(await scope.getByTestId('bw-scope-trace-csv-download').isDisabled()
            &&await scope.getByTestId('bw-scope-acquisition-0').count()===0,'ADC_RESET_ABA_RETAINED_HELD_CAPTURE');
          await scope.getByTestId('bw-scope-hold').click();
          await adcPage.waitForFunction(()=>document.querySelector('[data-testid="bw-scope-acquisition-0"]')?.getAttribute('data-adc-bits')==='1');
          // Changing the actual acquisition mode is an explicit remove/rearm, unlike
          // any ADC view update. Each new handle starts a new record with one R/C load.
          const sampleHandle=handle;
          requireADC(await scope.getByTestId('bw-scope-time-capture').inputValue()==='sample'
            &&await scope.getByTestId('bw-scope-adc-enabled').isChecked()
            &&!await scope.getByTestId('bw-scope-adc-enabled').isDisabled()
            &&await adcPage.evaluate(h=>{const channels=window.__board.getScopeChannels();
              return channels.length===1&&channels[0]===h
                &&window.__board.getScopeData(h).capture==='sample';},sampleHandle),'ADC_REARM_PRESTATE');
          await scope.getByText('✕',{exact:true}).click();
          await adcPage.waitForFunction(()=>{
            const capture=document.querySelector('[data-testid="bw-scope-time-capture"]');
            return !!capture&&capture.disabled===false&&window.__board?.getScopeChannels().length===0;
          });
          let selectedModeValues=null, modeObserverSetupError=null, modeObserverHandle=null;
          try {
            const controls=await scope.getByTestId('bw-scope-time-capture').elementHandles();
            const panels=await scope.count();
            // Passive observer only: no event dispatch, handler wrapping, DOM
            // value write, state override, selection retry or engine advance.
            modeObserverHandle=await adcPage.evaluateHandle(({target,scopedControls,scopedPanels})=>{
              const selector='[data-testid="bw-scope-time-capture"]';
              const observed=selector+', [data-testid="bw-scope-adc-enabled"]';
              const owner=target?.closest('[data-scope-panel]');
              const tokens=new WeakMap();let nextToken=0,overflow=0,observerError=null;
              const events=[];
              const describe=node=>{
                if(!node) return null;
                if(!tokens.has(node)) tokens.set(node,++nextToken);
                return {token:tokens.get(node),isConnected:node.isConnected,
                  testId:node.getAttribute('data-testid'),value:node.value,
                  checked:typeof node.checked==='boolean'?node.checked:null,disabled:node.disabled};
              };
              const snapshot=()=>({original:describe(target),globalFirst:describe(document.querySelector(selector)),
                globalFirstIsOriginal:document.querySelector(selector)===target,
                pageControls:document.querySelectorAll(selector).length,
                pagePanels:document.querySelectorAll('[data-scope-panel]').length,
                scopedControls,scopedPanels,ownerConnected:owner?.isConnected,
                ownerControls:owner?.querySelectorAll(selector).length,
                clock:String(window.__board?.getTime())});
              const before=snapshot();
              const observe=phase=>event=>{
                try {
                  if(!event.target?.matches(observed)) return;
                  if(events.length>=64) {overflow++;return;}
                  events.push({phase,type:event.type,isTrusted:event.isTrusted,
                    target:describe(event.target),globalFirst:describe(document.querySelector(selector)),
                    original:describe(target),globalFirstIsTarget:document.querySelector(selector)===event.target});
                } catch(error) {observerError=String(error);}
              };
              const capture=observe('capture'),bubble=observe('bubble');
              for(const type of ['input','change']) {
                document.addEventListener(type,capture,{capture:true,passive:true});
                document.addEventListener(type,bubble,{capture:false,passive:true});
              }
              return {
                snapshot:()=>({before,after:snapshot(),events,overflow,observerError}),
                stop:()=>{for(const type of ['input','change']) {
                  document.removeEventListener(type,capture,true);
                  document.removeEventListener(type,bubble,false);
                }},
              };
            },{target:controls.length===1?controls[0]:null,scopedControls:controls.length,scopedPanels:panels});
          } catch(error) {modeObserverSetupError=String(error);}
          try {
            selectedModeValues=await scope.getByTestId('bw-scope-time-capture').selectOption('envelope');
            await adcPage.waitForFunction(()=>{
              const capture=document.querySelector('[data-testid="bw-scope-time-capture"]');
              const enabled=document.querySelector('[data-testid="bw-scope-adc-enabled"]');
              return !!capture&&capture.value==='envelope'&&capture.disabled===false
                &&!!enabled&&enabled.checked===false&&enabled.disabled===true
                &&window.__board?.getScopeChannels().length===0;
            });
          } catch (error) {
            let state=null, diagnosticError=null;
            try {
              state=await adcPage.evaluate(()=>({
                capture:document.querySelector('[data-testid="bw-scope-time-capture"]')?.value,
                captureDisabled:document.querySelector('[data-testid="bw-scope-time-capture"]')?.disabled,
                checked:document.querySelector('[data-testid="bw-scope-adc-enabled"]')?.checked,
                disabled:document.querySelector('[data-testid="bw-scope-adc-enabled"]')?.disabled,
                channels:window.__board?.getScopeChannels(),clock:String(window.__board?.getTime()),
              }));
            } catch (failure) {diagnosticError=String(failure);}
            throw new Error(`ADC_MODE_CHANGE_PUBLICATION ${JSON.stringify({state,diagnosticError})} ${String(error).split('\n')[0]}`,{cause:error});
          } finally {
            try {
              const trace=modeObserverHandle?await modeObserverHandle.evaluate(observer=>{
                try {return observer.snapshot();}
                finally {observer.stop();}
              }):null;
              console.log('ADC_MODE_SELECTION_TRACE '+JSON.stringify({selectedModeValues,modeObserverSetupError,trace}));
            } catch(error) {
              try {console.log('ADC_MODE_SELECTION_TRACE '+JSON.stringify({selectedModeValues,
                modeObserverSetupError,observerReadError:String(error)}));} catch {/* retain the primary failure */}
            } finally {
              try {await modeObserverHandle?.dispose();} catch {/* release only our handle; retain the primary failure */}
            }
          }
          requireADC(!await scope.getByTestId('bw-scope-adc-enabled').isChecked()
            &&await scope.getByTestId('bw-scope-adc-enabled').isDisabled(),'ADC_MODE_CHANGE_NOT_EXPLICIT');
          await scope.locator('select').last().selectOption(nets.signal);
          await scope.getByText('+ channel',{exact:false}).click();
          handle=await adcPage.evaluate(()=>window.__board.getScopeChannels()[0]);
          requireADC(handle!==sampleHandle&&await adcPage.evaluate(h=>window.__board.getScopeData(h).capture==='envelope'
            &&window.__board.getScopeData(h).count===0,handle),'ADC_ENVELOPE_REARM_REUSED_RECORD');
          await adcPage.evaluate(()=>window.__board.advanceTo(window.__board.getTime()+1000000n));
          const envelopeHandle=handle;
          let pointModeObserverHandle=null,pointModeAction=null,pointModeTrace=null,pointModeError=null;
          try {
            const controls=await scope.getByTestId('bw-scope-time-capture').elementHandles();
            pointModeObserverHandle=await adcPage.evaluateHandle(scopeRearmPublicationObserverFactory,
              {target:controls.length===1?controls[0]:null});
            await scope.getByText('✕',{exact:true}).click();
            await adcPage.waitForFunction(observer=>observer.published('envelope'),pointModeObserverHandle);
            pointModeAction=await selectScopePointWithKeyboard(
              scope.getByTestId('bw-scope-time-capture'),pointModeObserverHandle,adcPage.keyboard);
            await adcPage.waitForFunction(observer=>observer.published('sample'),pointModeObserverHandle);
            pointModeTrace=await pointModeObserverHandle.evaluate(observer=>observer.snapshot());
            const preReact=pointModeTrace.events.find(event=>event.type==='input'
              &&event.targetIsExpected===true&&event.targetValue==='sample'
              &&event.state.selector?.value==='sample'&&event.state.adc?.disabled===true
              &&event.state.publicationReady===false);
            requireADC(!!preReact&&pointModeTrace.after.publicationReady===true
              &&pointModeTrace.observerError===null&&pointModeTrace.overflow===0,
              'ADC_POINT_MODE_PRE_REACT_CONTROL '+JSON.stringify(pointModeTrace));
          } catch(error) {pointModeError=error;}
          finally {
            try {
              if(pointModeObserverHandle) pointModeTrace=await pointModeObserverHandle.evaluate(observer=>{
                try{return observer.snapshot();} finally{observer.stop();}
              });
              console.log('ADC_POINT_MODE_PUBLICATION_TRACE '+JSON.stringify({
                action:pointModeAction,trace:pointModeTrace}));
            } catch(error) {
              try {console.log('ADC_POINT_MODE_PUBLICATION_TRACE '+JSON.stringify({
                action:pointModeAction,trace:pointModeTrace,
                observerReadError:String(error)}));} catch {/* retain the primary failure */}
            } finally {
              try {await pointModeObserverHandle?.dispose();} catch {/* release only our handle */}
            }
          }
          if(pointModeError) throw new Error(`ADC_POINT_MODE_PUBLICATION ${JSON.stringify({
            action:pointModeAction,trace:pointModeTrace})} ${String(pointModeError).split('\n')[0]}`,
          {cause:pointModeError});
          await scope.locator('select').last().selectOption(nets.signal);
          await scope.getByText('+ channel',{exact:false}).click();
          handle=await adcPage.evaluate(()=>window.__board.getScopeChannels()[0]);
          const pointRearm=await adcPage.evaluate(({handle,previousHandle})=>{
            const board=window.__board;
            let result=false,primaryError=null,state=null,diagnosticError=null;
            const used={handleDifferent:handle!==previousHandle,captureAttempted:false,captureRead:false,
              capture:null,countAttempted:false,countRead:false,count:null};
            try {
              result=used.handleDifferent
                &&(used.captureAttempted=true,used.capture=board.getScopeData(handle).capture,
                  used.captureRead=true,used.capture==='sample')
                &&(used.countAttempted=true,used.count=board.getScopeData(handle).count,
                  used.countRead=true,used.count===0);
            } catch(error) {primaryError=error;}
            // Keep the handle captured by the original, separate evaluation.
            // These synchronous diagnostic reads follow the predicate; they
            // are not an atomic snapshot of all getters or a later-page read.
            try {
              const data=board.getScopeData(handle);
              const selector=document.querySelector('[data-testid="bw-scope-time-capture"]');
              const adc=document.querySelector('[data-testid="bw-scope-adc-enabled"]');
              if(!data||!selector||!adc) throw new Error('ADC_POINT_REARM_DIAGNOSTIC_MISSING');
              const channels=board.getScopeChannels();
              state={previousHandle,handle,channels,currentFirst:channels[0],capture:data.capture,count:data.count,
                clock:String(board.getTime()),selectorValue:selector.value,selectorDisabled:selector.disabled,
                adcChecked:adc.checked,adcDisabled:adc.disabled};
            } catch(error) {diagnosticError=String(error);}
            if(primaryError) {
              try {primaryError.message+=' ADC_POINT_REARM_STATE '+JSON.stringify({result,used,state,diagnosticError});}
              catch {/* retain the original predicate error */}
              throw primaryError;
            }
            return {handle,result,used,state,diagnosticError};
          },{handle,previousHandle:envelopeHandle});
          requireADC(pointRearm.result&&pointRearm.state!==null&&pointRearm.diagnosticError===null,
            'ADC_POINT_REARM_REUSED_RECORD '+JSON.stringify(pointRearm));
          await adcPage.evaluate(()=>window.__board.advanceTo(window.__board.getTime()+1000000n));
          await scope.getByTestId('bw-scope-adc-enabled').check();
          await adcPage.waitForFunction(()=>document.querySelector('[data-testid="bw-scope-acquisition-0"]')?.getAttribute('data-adc-bits')==='1');
          requireADC(await adcPage.evaluate(()=>window.__board.getScopeChannels().length===1
            &&window.__board._solveParts.filter(p=>String(p.id).startsWith('@scope:')).length===2),'ADC_REARM_DUPLICATED_PROBE');
          await adcPage.evaluate(()=>{try{window.__board.setControl('adc-bad',5);}catch{/* actual failed solve remains observable */}});
          await scope.getByTestId('bw-scope-capture-error').waitFor();
          requireADC(await scope.getByTestId('bw-scope-trace-csv-download').isDisabled(),'ADC_FAILED_SOURCE_EXPORTED');
          report(ADC_IDS[4],'reset/advance ABA, explicit remove/rearm and actual ideal-source conflict invalidate the derived display');
        }
        const adcPage = await browser.newPage({viewport: {width: 1600, height: 1000}});
        const adcErrors = [];
        adcPage.on('pageerror', error => adcErrors.push(error.message));
        try {
            await exerciseInstalledADC(adcPage, (id, detail) => check(`installed ${id}`, true, detail));
        } catch (error) {
            check('installed ideal ADC complete consumer journey', false, String(error).split('\n')[0]);
        } finally {
            check('installed ideal ADC has no unexpected page errors', adcErrors.length === 0, JSON.stringify(adcErrors));
            await adcPage.close();
        }
    }

    // Actual built Lite consumer journeys: imported SPICE, its real fourth
    // terminal partition, and the learner's displayed DC-OP result. Expected
    // values come from the authored saturation/load line, never a test solve.
    for (const grounded of [false, true]) {
        const name = grounded
            ? 'installed loaded PMOS ground-bulk SPICE import and displayed signed DC OP'
            : 'installed loaded PMOS source-bulk SPICE import and displayed signed DC OP';
        const pmosPage = await browser.newPage({viewport: {width: 1440, height: 1000}});
        const pageErrors = [];
        pmosPage.on('pageerror', error => pageErrors.push(error.message));
        let failure = null;
        let detail = '';
        try {
            await pmosPage.addInitScript(() => {
                localStorage.clear(); sessionStorage.clear();
                localStorage.setItem('bw-starter-v1-complete', '1');
            });
            await pmosPage.goto(`http://localhost:${port}/`, {waitUntil: 'networkidle', timeout: 60000});
            await pmosPage.getByRole('tab', {name: /Circuit/}).click();
            const designer = pmosPage.locator('.bw-circuit-designer:visible').last();
            await designer.locator('[data-canvas]').waitFor({timeout: 60000});
            const source = grounded ? -2 : 10;
            const rail = grounded ? -5 : 0;
            const text = [
                '* authored loaded PMOS installed GUI control',
                `VS source 0 ${source}`, `VG gate 0 ${source - 2}`,
                ...(grounded ? ['VR rail 0 -5'] : []),
                `R1 out ${grounded ? 'rail' : '0'} 4k`,
                `M1 out gate source ${grounded ? '0' : 'source'} PM W=5u L=2u`,
                '.model PM PMOS(LEVEL=1 VTO=-1 KP=100u LAMBDA=.02)', '.op', '.end', ''
            ].join('\n');
            const pmosMenu = await openCircuitActions(pmosPage, designer);
            await (await circuitFileControl(pmosMenu, 'import')).click();
            const choosing = pmosPage.waitForEvent('filechooser');
            await pmosMenu.locator('[data-import-format="spice"]').click();
            await (await choosing).setFiles({name: grounded ? 'pmos-ground-bulk.cir' : 'pmos-source-bulk.cir',
                mimeType: 'text/plain', buffer: Buffer.from(text)});
            await pmosPage.waitForFunction(expectedSource => {
                const circuit = window.__circuit;
                return circuit?.parts.some(part => part.id === 'M1' && part.kind === 'pmos')
                    && circuit.parts.some(part => part.id === 'VS' && part.params.volts === expectedSource)
                    && window.__board === circuit.board;
            }, source);
            // Read actual imported topology only; never call or replace the
            // Board's solver/operatingPoint method from page evaluation.
            const topology = await pmosPage.evaluate(() => {
                const circuit = window.__circuit, part = circuit.getPart('M1');
                const net = terminal => circuit.resolvedNets.find(n =>
                    n.terminals.some(t => t.part === 'M1' && t.terminal === terminal));
                return {kind: part.kind, terminals: part.terminals, model: part.params.model,
                    legacy: part.params.bulkAtGround || part.params.bulkOnSource,
                    drain: net('drain')?.id, bulk: net('bulk')?.terminals,
                    grounds: circuit.parts.filter(p => p.kind === 'gnd').map(p => p.id),
                    circuitBoardMatches: window.__board === circuit.board};
            });
            if (!topology.circuitBoardMatches || topology.kind !== 'pmos' || topology.model !== 'level1'
                || topology.legacy || topology.terminals?.length !== 4
                || !topology.terminals.includes('bulk') || !topology.drain
                || !topology.bulk?.some(t => grounded
                    ? topology.grounds.includes(t.part) && t.terminal === 'gnd'
                    : t.part === 'M1' && t.terminal === 'source')) {
                throw new Error(`actual PMOS fourth-terminal connection lost: ${JSON.stringify(topology)}`);
            }
            await designer.getByRole('radio', {name: 'Sim mode', exact: true}).click();
            if (!await designer.locator('[data-instruments-column]').count()) {
                await designer.getByRole('button', {name: /Expand instruments panel/i}).click();
            }
            await designer.getByText('Circuit analysis', {exact: true}).click();
            await designer.getByTestId('bw-operating-point-run').click();
            const result = designer.getByTestId('bw-operating-point-result');
            await result.waitFor({state: 'visible'});
            const shown = await result.innerText();
            const read = (label, unit) => {
                const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const match = shown.match(new RegExp(`${escaped}:\\s+([-+0-9.eE]+) ${unit}(?:\\s|$)`));
                if (!match || !Number.isFinite(Number(match[1]))) {
                    throw new Error(`missing actual ${label} ${unit}: ${JSON.stringify(shown)}`);
                }
                return Number(match[1]);
            };
            // VSG=2, |VTO|=1, W/L=2.5 and R=4k. The unique solution
            // lies in saturation; the UI formats its actual readings to6sig.
            const predicted = rail + .5 * (1 + .02 * (source - rail)) / 1.01;
            const predictedSupply = -(predicted - rail) / 4000;
            const drain = read(topology.drain, 'V'), supply = read('VS.pos', 'A');
            if (source - predicted <= 1 || !shown.includes('positive-into-part-terminal')
                || Math.abs(drain - predicted) > 5e-6 || Math.abs(supply - predictedSupply) > 5e-10) {
                throw new Error(`actual displayed PMOS OP differs from loaded law: ${JSON.stringify({
                    drain, predicted, supply, predictedSupply, shown})}`);
            }
            if (pageErrors.length) throw new Error(`actual app page errors: ${JSON.stringify(pageErrors)}`);
            detail = JSON.stringify({bulk: grounded ? 'ground' : 'source', drain, predicted,
                supply, predictedSupply, fourthTerminalConnected: true});
        } catch (error) {
            failure = String(error).split('\n')[0];
        } finally {
            try {await pmosPage.close();} catch (error) {failure ||= `page cleanup: ${String(error).split('\n')[0]}`;}
        }
        check(name, failure === null, failure || detail);
    }

} finally {
    await browser.close();
    server.close();
}

if (failures.length) {
    console.error(`\n${failures.length} browser acceptance check(s) failed.`);
    process.exit(1);
}
console.log('\nall circuit UX browser checks passed');
