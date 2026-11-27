#!/usr/bin/env node
/** Browser regressions for physical Circuit Designer rendering and placement. */
import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import {bindReadyRenderingCircuitHost} from './lib/rendering-circuit-host.mjs';

const lm324Fixture = JSON.parse(readFileSync(
    new URL('../test/fixtures/lm324-quad-follower.json', import.meta.url), 'utf8'));
const lm741Fixture = JSON.parse(readFileSync(
    new URL('../test/fixtures/lm741-voltage-follower.json', import.meta.url), 'utf8'));
const adp7118Fixture = JSON.parse(readFileSync(
    new URL('../test/fixtures/adp7118-fixed-regulator.json', import.meta.url), 'utf8'));
const lt1763Fixture = JSON.parse(readFileSync(
    new URL('../test/fixtures/lt1763-fixed-regulator.json', import.meta.url), 'utf8'));
const lt1001Fixture = JSON.parse(readFileSync(
    new URL('../test/fixtures/lt1001-precision-follower.json', import.meta.url), 'utf8'));

const url = process.env.PROOF_URL || 'https://crispstrobe.github.io/brickwright-lite/';
const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page = await browser.newPage({viewport: {width: 1440, height: 900}});
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
    await page.goto(url, {waitUntil: 'networkidle', timeout: 60000});
    await page.waitForSelector('[role="tab"]', {timeout: 60000});

    const paneToggle = page.locator('[data-right-pane-toggle]');
    check('fresh workspace starts with the optional right pane minimized',
        await paneToggle.getAttribute('aria-pressed') === 'false');

    await page.getByRole('tab', {name: /Circuit/}).click();
    const designer = page.locator('.bw-circuit-designer:visible').last();
    // A visible shell can precede its async canvas. Injecting a fixture before
    // readiness can race initial scene loading on the public production site.
    // Walk only this visible designer's owners, never a global BFS sibling.
    const found = await bindReadyRenderingCircuitHost(designer);
    check('fresh Circuit Designer starts with Instruments minimized',
        await designer.locator('[data-instruments-column]').count() === 0 &&
        await designer.getByRole('button', {name: 'Expand instruments panel'}).count() === 1);

    check('visible ready Circuit host is available to the rendering gate', found);
    if (!found) throw new Error('No Circuit host owns the visible ready designer');

    const load = async parts => {
        await page.evaluate(value => new Promise(resolve => {
            window.__bwRenderingCircuitTab.setState({
                circuitData: {vcc: 5, parts: value, wires: [], holeWires: [], fileOnly: true}
            }, resolve);
        }), parts);
        await page.waitForFunction(expected => {
            const live = window.__circuit?.parts;
            return live?.length === expected.length && expected.every(({id, kind}) =>
                live.some(part => part.id === id && part.kind === kind));
        }, parts.map(({id, kind}) => ({id, kind})));
    };

    const checkDip = async (face, label, pinCount, pins) => {
        await face.waitFor({state: 'visible', timeout: 10000});
        let markings;
        let packageMatches;
        if (await face.getAttribute('data-dip-art')) {
            const image = face.and(page.locator('[data-art-loaded="true"]')).locator('image');
            await image.waitFor({state: 'visible'});
            markings = await image.evaluate(async element => {
                const response = await fetch(element.getAttribute('href'));
                if (!response.ok) throw new Error(`DIP artwork HTTP ${response.status}`);
                const svg = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
                return [...svg.querySelectorAll('text')].map(node => node.textContent.trim());
            });
            packageMatches = pins.every(pin => markings.includes(pin));
        } else {
            markings = await face.textContent();
            packageMatches = markings.includes(`DIP-${pinCount}`) && pins.every(pin => markings.includes(pin));
        }
        check(`${label} renders its labelled ${pinCount}-pin DIP`,
            await face.count() === 1 && markings.includes(label) && packageMatches);
    };

    await load([{id: 'uno', kind: 'arduino_uno', params: {}, x: 520, y: 260, rotation: 0}]);
    await designer.locator('foreignObject[data-board-face="arduino_uno"] wokwi-arduino-uno').waitFor({timeout: 10000});
    const alignment = await designer.evaluate(root => {
        const face = root.querySelector('foreignObject[data-board-face="arduino_uno"]');
        const outline = root.querySelector('g[data-board-face="arduino_uno"] > rect');
        const art = face?.querySelector('wokwi-arduino-uno')?.shadowRoot?.querySelector('svg');
        const box = element => {
            const r = element.getBoundingClientRect();
            return {x: r.x, y: r.y, w: r.width, h: r.height};
        };
        return {face: box(face), outline: box(outline), art: box(art)};
    });
    check('Arduino artwork and its selection outline stay aligned',
        ['x', 'y', 'w', 'h'].every(key => Math.abs(alignment.face[key] - alignment.outline[key]) <= 1.5) &&
        alignment.art.w >= alignment.face.w * 0.9 && alignment.art.h >= alignment.face.h * 0.9,
        JSON.stringify(alignment));

    await load([{id: 'bb', kind: 'breadboard', params: {}, x: 520, y: 330, rotation: 0}]);
    const holes = await designer.evaluate(root => {
        const xs = [...root.querySelectorAll('[data-breadboard="bb"] [data-hole^="a"]')]
            .map(hole => Number(hole.getAttribute('cx')));
        return {xs, rail: root.querySelectorAll('[data-breadboard="bb"] [data-hole^="t+"]').length};
    });
    check('full breadboard has 63 consecutive terminal and rail holes',
        holes.xs.length === 63 && holes.rail === 63 &&
        holes.xs.every((x, index) => index === 0 || Math.abs(x - holes.xs[index - 1] - 14) < 0.01),
        `${holes.xs.length}/${holes.rail}`);

    await load([]);
    const canvas = await designer.locator('[data-canvas]').boundingBox();
    for (const [label, width] of [['Breadboard ½', 460], ['Breadboard mini', 278]]) {
        await designer.getByText(label, {exact: true}).click();
        await page.mouse.move(canvas.x + canvas.width * 0.55, canvas.y + canvas.height * 0.55);
        const ghost = designer.locator('[data-placement-ghost="breadboard"] rect').first();
        await ghost.waitFor({timeout: 3000});
        check(`${label} placement preview keeps its physical size`, Number(await ghost.getAttribute('width')) === width,
            await ghost.getAttribute('width'));
        // Commit the synthetic placement so the interaction machine returns
        // to idle before arming the next palette item. Sending Escape to the
        // page did not reach BoardCanvas unless its focusable wrapper happened
        // to own focus, leaving the half-board ghost armed in CI.
        await page.mouse.click(canvas.x + canvas.width * 0.55, canvas.y + canvas.height * 0.55);
        await ghost.waitFor({state: 'hidden', timeout: 3000});
        await load([]);
    }

    await load([
        {id: 'bb', kind: 'breadboard', params: {}, x: 520, y: 330, rotation: 0},
        {id: 'tiny', kind: 'attiny13', params: {}, x: 520, y: 330, rotation: 0}
    ]);
    const tiny = designer.locator('[data-dip-body="attiny13"]');
    const tinyBox = await tiny.boundingBox();
    await page.mouse.click(tinyBox.x + tinyBox.width / 2, tinyBox.y + tinyBox.height / 2);
    check('ATtiny13 remains selectable above a breadboard',
        await designer.locator('[data-selection-actions]').count() === 1);

    await load([{id: 'bb', kind: 'breadboard', params: {}, x: 520, y: 330, rotation: 0}]);
    for (const [kind, paletteKind] of [['Arduino Nano', 'arduino_nano'], ['Raspberry Pi Pico', 'pi_pico']]) {
        await designer.locator(`[data-palette-kind="${paletteKind}"]`).click();
        await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
        const ghost = designer.locator('[data-placement-ghost]');
        await ghost.waitFor({timeout: 3000});
        const zOrder = await ghost.evaluate(node => {
            const board = node.ownerSVGElement.querySelector('[data-breadboard]');
            return !!(board.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING);
        });
        const width = Number(await ghost.locator('rect').first().getAttribute('width'));
        check(`${kind} placement stays above the breadboard at physical scale`, zOrder && width > 100,
            `z=${zOrder} width=${width}`);
        // Finish the placement through the same canvas interaction a user
        // performs. Escape is canvas-scoped, so sending it while the palette
        // card owns focus leaves the old placement armed and races the next
        // palette selection.
        await page.mouse.click(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
        await ghost.waitFor({state: 'hidden', timeout: 3000});
        await load([{id: 'bb', kind: 'breadboard', params: {}, x: 520, y: 330, rotation: 0}]);
    }

    // Exercise the exact owner-reported regression as shipped, not merely a
    // synthetic board. Its Pico bench used to contain a forest of redundant
    // supply drops, overlapping generated bodies, and no flyback diode.
    const motorBench = await page.evaluate(async () => {
        const response = await fetch('examples/10-motor-speed/circuit.pico.json');
        if (!response.ok) throw new Error(`motor bench HTTP ${response.status}`);
        return response.json();
    });
    const generatedPower = motorBench.wires.filter(wire => wire.genPower);
    check('Motor speed Pico bench has one supply and one ground feed',
        generatedPower.length === 2,
        `${generatedPower.length} generated power wires`);
    check('Motor speed Pico bench ships with flyback protection',
        motorBench.parts.some(part => part.kind === 'diode'));
    await page.evaluate(value => new Promise(resolve => {
        window.__bwRenderingCircuitTab.setState({circuitData: value}, resolve);
    }), motorBench);
    await designer.locator('[data-board-face="pi_pico"]').waitFor({state: 'visible', timeout: 10000});
    check('Motor speed Pico bench renders its controller face',
        await designer.locator('[data-board-face="pi_pico"]:visible').count() === 1);

    // The LM324 crosses both package boundaries this gate is meant to exercise:
    // CUI must bundle the truthful 14-pin face, and its injected Board must solve
    // four independent channels. Node tests can read an unbundled parts-data
    // directory, so this exact browser assertion is what catches a stale static
    // index or a GUI install resolving a different engine.
    await page.evaluate(value => new Promise(resolve => {
        window.__bwRenderingCircuitTab.setState({circuitData: value}, resolve);
    }), lm324Fixture);
    await checkDip(designer.locator('[data-dip-body="lm324"]'), 'LM324', 14,
        ['1_out', '1_neg', '1_pos', 'vcc', '2_pos', '2_neg', '2_out',
            '3_out', '3_neg', '3_pos', 'gnd', '4_pos', '4_neg', '4_out']);
    const lm324 = await page.evaluate(() => {
        const circuit = window.__circuit;
        const board = circuit?.board;
        if (!board) return {error: 'CircuitTab did not publish the LM324 board'};
        board.advanceTo(board.timeNs + 1n);
        const values = [];
        for (let channel = 1; channel <= 4; channel++) {
            const terminal = `${channel}_out`;
            const net = board.nets.find(item => item.terminals.some(endpoint =>
                endpoint.part === 'u1' && endpoint.terminal === terminal));
            values.push(net ? board.nodeVoltage(net.id) : null);
        }
        return {values, terminals: circuit.getPart('u1')?.terminals?.length || 0};
    });
    check('browser bundle solves all four physical LM324 channels independently',
        lm324.terminals === 14 && Array.isArray(lm324.values) &&
        lm324.values.every((value, index) =>
            typeof value === 'number' && Math.abs(value - [0.5, 1, 2, 3][index]) < 0.02),
        JSON.stringify(lm324));

    // The LM741 proof is deliberately a dual-supply follower, not merely a
    // palette lookup: it crosses the pinned CUI face and Board behavior through
    // the same production bundle a user loads.
    await page.evaluate(value => new Promise(resolve => {
        window.__bwRenderingCircuitTab.setState({circuitData: value}, resolve);
    }), lm741Fixture);
    await checkDip(designer.locator('[data-dip-body="lm741"]'), 'LM741', 8,
        ['offset_1', 'inn', 'inp', 'vneg', 'offset_5', 'out', 'vpos', 'nc']);
    const lm741 = await page.evaluate(() => {
        const circuit = window.__circuit;
        const board = circuit?.board;
        if (!board) return {error: 'CircuitTab did not publish the LM741 board'};
        board.advanceTo(board.timeNs + 10_000n);
        const net = board.nets.find(item => item.terminals.some(endpoint =>
            endpoint.part === 'u1' && endpoint.terminal === 'out'));
        return {
            output: net ? board.nodeVoltage(net.id) : null,
            terminals: circuit.getPart('u1')?.terminals?.length || 0
        };
    });
    check('browser bundle solves the physical dual-supply LM741 follower',
        lm741.terminals === 8 && typeof lm741.output === 'number' &&
        Math.abs(lm741.output - 1.001) < 0.02,
        JSON.stringify(lm741));

    // This is the complete package chain: the Lite production bundle loads
    // CUI's physical SOIC-8 face and Board's named regulator model from the
    // same fixture, then reads the settled output rather than a static label.
    await page.evaluate(value => new Promise(resolve => {
        window.__bwRenderingCircuitTab.setState({circuitData: value}, resolve);
    }), adp7118Fixture);
    const adpFace = designer.locator('[data-part-face="adp7118"][data-soic-body="adp7118"]');
    await adpFace.waitFor({state: 'visible', timeout: 10000});
    const adpFaceText = await adpFace.textContent();
    check('ADP7118 renders as the truthful labelled SOIC-8 face',
        await adpFace.count() === 1 && /200mA LDO/.test(adpFaceText) &&
        ['vout_1', 'vout_2', 'sense_adj', 'gnd', 'en', 'ss', 'vin_7', 'vin_8']
            .every(name => adpFaceText.includes(name)),
        adpFaceText.replace(/\s+/g, ' ').trim());
    const adp7118 = await page.evaluate(() => {
        const circuit = window.__circuit;
        const board = circuit?.board;
        if (!board) return {error: 'CircuitTab did not publish the ADP7118 board'};
        board.advanceTo(board.timeNs + 10_000n);
        const net = board.nets.find(item => item.terminals.some(endpoint =>
            endpoint.part === 'u1' && endpoint.terminal === 'vout_1'));
        return {
            output: net ? board.nodeVoltage(net.id) : null,
            terminals: circuit.getPart('u1')?.terminals?.length || 0
        };
    });
    check('browser bundle solves the physical fixed-output ADP7118 regulator',
        adp7118.terminals === 8 && typeof adp7118.output === 'number' &&
        Math.abs(adp7118.output - 5) < 0.002,
        JSON.stringify(adp7118));

    const startupFixture = structuredClone(adp7118Fixture);
    startupFixture.parts.find(part => part.id === 'u1').params.startupModel = 'datasheet-envelope';
    startupFixture.parts.find(part => part.id === 'load').params.ohms = 500;
    startupFixture.parts.push({id: 'cout', kind: 'capacitor', params: {farads: 2.2e-6}, x: 800, y: 400});
    startupFixture.wires.push(
        {from: 'cout', fromTerminal: 'a', to: 'u1', toTerminal: 'vout_1'},
        {from: 'cout', fromTerminal: 'b', to: 'gnd', toTerminal: 'gnd'});
    await page.evaluate(value => new Promise(resolve => {
        window.__bwRenderingCircuitTab.setState({circuitData: value}, resolve);
    }), startupFixture);
    await adpFace.waitFor({state: 'visible', timeout: 10000});
    const startup = await page.evaluate(() => {
        const circuit = window.__circuit, previous = circuit?.board;
        if (!previous) return {error: 'startup Circuit board missing'};
        // Explicit harness setup: a display tick may already have advanced
        // this engine. Give the displayed Circuit a genuinely fresh instance
        // of its bundled Board, retaining its real inferred netlist. Do not
        // rewind clocks or reuse an old scope/meter acquisition.
        const board = new previous.constructor(8);
        board.setNetlist(previous.parts, previous.nets);
        circuit.board = board;
        const net = (part, terminal) => board.nets.find(item => item.terminals.some(
            endpoint => endpoint.part === part && endpoint.terminal === terminal)).id;
        const out = net('u1', 'vout_1'), ground = net('gnd', 'gnd');
        const handle = board.addScopeChannel({type: 'voltage', netId: out, referenceNetId: ground,
            capture: 'sample', sampleRateHz: 100000, depth: 256});
        board.meterVoltage(out, ground);
        board.advanceTo(1200000n);
        const capture = board.getScopeData(handle);
        const tau = 300e-6 / Math.log(9);
        const delay = Math.round((80e-6 + tau * Math.log(.9)) * 1e9) / 1e9;
        const gain = 500 / 500.05, rc = (.05 * 500 / 500.05) * 2.2e-6;
        let maxError = 0;
        for (let i = 0; i < capture.count; i++) {
            const x = (Number(capture.startTNs) + i * Number(capture.sampleIntervalNs)) / 1e9 - delay;
            const expected = x <= 0 ? 0 : 5 * gain * (1 -
                (tau * Math.exp(-x / tau) - rc * Math.exp(-x / rc)) / (tau - rc));
            maxError = Math.max(maxError, Math.abs(capture.samples[2 * i] - expected));
        }
        const x = .0012 - delay;
        const expectedMean = 5 * gain * (x - (tau * tau * (1 - Math.exp(-x / tau)) -
            rc * rc * (1 - Math.exp(-x / rc))) / (tau - rc)) / .0012;
        const mean = board.meterVoltage(out, ground);
        return {count: capture.count, origin: String(capture.startTNs), maxError,
            meanError: Math.abs(mean - expectedMean), mean, final: board.nodeVoltage(out),
            accuracyMet: board.transientAnalysisStatus().accuracyMet};
    });
    check('production browser ADP7118 startup captures 120 real samples and the window mean',
        startup.count === 120 && startup.origin === '10000' && startup.maxError < .001 &&
        startup.meanError < .0001 && Math.abs(startup.mean - startup.final) > .5 &&
        startup.accuracyMet === true, JSON.stringify(startup));

    // ROUND 3 (bw-board #740, pin a685b220): the interactive step control's
    // step-doubling estimate is Richardson-scaled by 1/(2^p - 1), so steps spend
    // the stated tolerance instead of a third of it; bw-board 50d8cf37 widened its
    // own RLC oracle for the same reason. Measured in CI run 45318622606: overload
    // worst sample 1.45e-4 V (was 6.8e-5), partitioned 1.40e-4 (was 1.0e-4); inrush
    // worst sample 1.38e-5 V (was 1.7e-6). The profile's local scale is
    // 1e-6 + 1e-4*|v| per step (3.6e-4 V at 3.6 V), so the sample bounds become 2e-4 / 3e-5;
    // the mean bounds, the inrush partition bound and the analytic transitions are unchanged.
    for (const [label, resistance, capacitance, sampleTolerance, meanTolerance] of [
        ['overload', 10, 2.2e-6, 2e-4, 3e-5],
        ['inrush', 500, 22e-6, 3e-5, 1e-5]
    ]) {
        const limitedFixture = structuredClone(adp7118Fixture);
        limitedFixture.parts.find(part => part.id === 'u1').params = {
            vOut: 5, startupModel: 'current-limited-envelope', rOut: .05, currentLimit: .36
        };
        limitedFixture.parts.find(part => part.id === 'load').params.ohms = resistance;
        // Match the qualified installed CLI fixture, including finite VIN
        // delivery resistance; this is not the earlier ideal-source fixture.
        limitedFixture.parts.push(
            {id: 'cout', kind: 'capacitor', params: {farads: capacitance}, x: 800, y: 430},
            {id: 'rin', kind: 'resistor', params: {ohms: 4}, x: 330, y: 180});
        for (const wire of limitedFixture.wires) {
            if (wire.from === 'vin' && wire.fromTerminal === 'pos' && wire.to === 'u1') {
                wire.from = 'rin'; wire.fromTerminal = 'b';
            }
        }
        limitedFixture.wires.push(
            {from: 'vin', fromTerminal: 'pos', to: 'rin', toTerminal: 'a'},
            {from: 'cout', fromTerminal: 'a', to: 'u1', toTerminal: 'vout_1'},
            {from: 'cout', fromTerminal: 'b', to: 'gnd', toTerminal: 'gnd'});
        await page.evaluate(value => new Promise(resolve => {
            window.__bwRenderingCircuitTab.setState({circuitData: value}, resolve);
        }), limitedFixture);
        await adpFace.waitFor({state: 'visible', timeout: 10000});
        await page.waitForFunction(({resistance, capacitance}) => {
            const parts = window.__circuit?.board?.parts;
            return parts?.find(part => part.id === 'u1')?.params.startupModel === 'current-limited-envelope'
                && parts.find(part => part.id === 'load')?.params.ohms === resistance
                && parts.find(part => part.id === 'cout')?.params.farads === capacitance
                && parts.find(part => part.id === 'rin')?.params.ohms === 4;
        }, {resistance, capacitance}, {timeout: 10000});
        const limited = await page.evaluate(({resistance: R, capacitance: C}) => {
            const circuit = window.__circuit, previous = circuit?.board;
            if (!previous || previous.parts.find(part => part.id === 'u1')?.params.startupModel !== 'current-limited-envelope'
                || previous.parts.find(part => part.id === 'load')?.params.ohms !== R
                || previous.parts.find(part => part.id === 'cout')?.params.farads !== C
                || previous.parts.find(part => part.id === 'rin')?.params.ohms !== 4) {
                return {error: 'displayed Circuit did not load the selected current-limited fixture'};
            }
            // Match the old startup harness: the displayed Circuit gets a cold
            // instance of its own bundled Board and actual inferred netlist.
            const board = new previous.constructor(8);
            board.setNetlist(previous.parts, previous.nets);
            circuit.board = board;
            const net = (part, terminal) => board.nets.find(item => item.terminals.some(
                endpoint => endpoint.part === part && endpoint.terminal === terminal)).id;
            const out = net('u1', 'vout_1'), ground = net('gnd', 'gnd');
            const fullyBonded = net('u1', 'vout_2') === out && net('u1', 'sense_adj') === out
                && net('u1', 'vin_7') === net('u1', 'vin_8');
            const finiteInput = net('vin', 'pos') === net('rin', 'a')
                && net('rin', 'b') === net('u1', 'vin_7') && net('rin', 'a') !== net('rin', 'b');
            const duration = .0012, amplitude = 5, r = .05, limit = .36;
            const tau = 300e-6 / Math.log(9);
            const delay = Math.round((80e-6 + tau * Math.log(.9)) * 1e9) / 1e9;
            const gain = R / (R + r), rho = C * R * r / (R + r);
            // Independent continuous RC solution. Roots come from the analytic
            // load line, never the captured waveform or device's region state.
            const target = x => amplitude * (1 - Math.exp(-x / tau));
            const linear = x => amplitude * gain * (1 -
                (tau * Math.exp(-x / tau) - rho * Math.exp(-x / rho)) / (tau - rho));
            const bisect = (f, a, b) => {
                for (let i = 0; i < 70; i++) {
                    const middle = (a + b) / 2;
                    if (f(middle) > 0) b = middle; else a = middle;
                }
                return (a + b) / 2;
            };
            const firstCrossing = (f, start) => {
                for (let x = start + 1e-6; x <= duration; x += 1e-6) {
                    if (f(x) > 0) return bisect(f, x - 1e-6, x);
                }
                return null;
            };
            const entry = firstCrossing(x => target(x) - linear(x) - r * limit, 0);
            const clamped = x => limit * R + (linear(entry) - limit * R) * Math.exp(-(x - entry) / (R * C));
            const release = entry === null ? null
                : firstCrossing(x => -(target(x) - clamped(x) - r * limit), entry);
            const particular = x => amplitude * gain * (1 - tau * Math.exp(-x / tau) / (tau - rho));
            const expectedVoltage = t => {
                const x = t - delay;
                if (x <= 0) return 0;
                if (entry === null || x <= entry) return linear(x);
                if (release === null || x <= release) return clamped(x);
                return particular(x) + (clamped(release) - particular(release)) * Math.exp(-(x - release) / rho);
            };
            const linearIntegral = x => amplitude * gain * (x +
                (tau * tau * Math.exp(-x / tau) - rho * rho * Math.exp(-x / rho)) / (tau - rho));
            const clampedIntegral = x => limit * R * x
                - (linear(entry) - limit * R) * R * C * Math.exp(-(x - entry) / (R * C));
            const releasedIntegral = x => amplitude * gain * (x + tau * tau * Math.exp(-x / tau) / (tau - rho))
                - (clamped(release) - particular(release)) * rho * Math.exp(-(x - release) / rho);
            const x = duration - delay, firstEnd = entry === null ? x : Math.min(x, entry);
            let integral = linearIntegral(firstEnd) - linearIntegral(0);
            if (entry !== null && x > entry) {
                integral += clampedIntegral(release === null ? x : Math.min(x, release)) - clampedIntegral(entry);
            }
            if (release !== null && x > release) integral += releasedIntegral(x) - releasedIntegral(release);
            const expectedMean = integral / duration;
            const handle = board.addScopeChannel({type: 'voltage', netId: out, referenceNetId: ground,
                capture: 'sample', sampleRateHz: 100000, depth: 256});
            const cold = board.meterVoltage(out, ground);
            board.meterCurrent('u1', 'vin_7');
            // CLI acquisition is one bulk advance. A separate cold bundled
            // Board exercises the upstream partitioned current/KCL protocol;
            // its waveform accuracy is reported and checked independently.
            board.advanceTo(1200000n);
            const bulkAccuracyMet = board.transientAnalysisStatus().accuracyMet === true;
            const partitioned = new previous.constructor(8);
            partitioned.setNetlist(previous.parts, previous.nets);
            const terminals = ['vout_1', 'vout_2', 'sense_adj', 'gnd', 'en', 'ss', 'vin_7', 'vin_8'];
            let maxCeilingError = 0, maxKclError = 0, maxSupplyError = 0, maxVinDropError = 0;
            let partitionMaxError = 0;
            let accuracyMet = true;
            for (let i = 1; i <= 120; i++) {
                partitioned.advanceTo(BigInt(i) * 10000n);
                partitionMaxError = Math.max(partitionMaxError, Math.abs(
                    partitioned.nodeVoltage(out) - partitioned.nodeVoltage(ground) - expectedVoltage(i * 10e-6)));
                const current = terminal => partitioned.branchCurrent('u1', terminal);
                const outputAmps = current('vout_1') + current('vout_2');
                const iq = 50e-6 + 130e-6 * Math.min(outputAmps, .2) / .2;
                maxCeilingError = Math.max(maxCeilingError, -outputAmps, outputAmps - limit);
                maxSupplyError = Math.max(maxSupplyError,
                    Math.abs(-current('vin_7') - current('vin_8') - outputAmps - iq),
                    Math.abs(current('gnd') - iq),
                    Math.abs(partitioned.branchCurrent('vin', 'pos') - outputAmps - iq));
                maxVinDropError = Math.max(maxVinDropError, Math.abs(
                    (partitioned.nodeVoltage(net('vin', 'pos')) - partitioned.nodeVoltage(net('u1', 'vin_7'))) / 4
                    - outputAmps - iq));
                maxKclError = Math.max(maxKclError,
                    Math.abs(terminals.reduce((sum, terminal) => sum + current(terminal), 0)),
                    Math.abs(outputAmps + partitioned.branchCurrent('load', 'a') + partitioned.branchCurrent('cout', 'a')));
                accuracyMet &&= partitioned.transientAnalysisStatus().accuracyMet === true;
            }
            const capture = board.getScopeData(handle);
            let maxError = 0, paired = true;
            for (let i = 0; i < capture.count; i++) {
                const t = (Number(capture.startTNs) + i * Number(capture.sampleIntervalNs)) / 1e9;
                const sample = capture.samples[2 * i];
                paired &&= Number.isFinite(sample) && sample === capture.samples[2 * i + 1];
                maxError = Math.max(maxError, Math.abs(sample - expectedVoltage(t)));
            }
            const mean = board.meterVoltage(out, ground), final = board.nodeVoltage(out) - board.nodeVoltage(ground);
            const endpointAgreement = Math.abs(final - partitioned.nodeVoltage(out) + partitioned.nodeVoltage(ground));
            let controlRefusal = '';
            try { board.setControl('vin', 8); } catch (error) { controlRefusal = error.message; }
            const refused = read => {
                try { read(); return false; }
                catch (error) { return /measurement unavailable|scope capture refused|circuit solve failed/.test(error.message); }
            };
            return {fullyBonded, finiteInput, cold, scopeHandle: handle, count: capture.count, origin: String(capture.startTNs),
                interval: String(capture.sampleIntervalNs), paired, maxError,
                entry: entry === null ? null : entry + delay, release: release === null ? null : release + delay,
                mean, meanError: Math.abs(mean - expectedMean), final,
                endpointError: Math.abs(final - expectedVoltage(duration)),
                maxCeilingError, maxKclError, maxSupplyError, maxVinDropError, partitionMaxError,
                endpointAgreement, accuracyMet, bulkAccuracyMet, controlRefusal,
                oldVoltageRefused: refused(() => board.meterVoltage(out, ground)),
                oldCurrentRefused: refused(() => board.meterCurrent('u1', 'vin_7')),
                oldScopeRefused: refused(() => board.getScopeData(handle))};
        }, {resistance, capacitance});
        const transitionsMatch = limited.entry !== null &&
            (label === 'overload' ? Math.abs(limited.entry - 217.30757602325912e-6) < 1e-12 && limited.release === null
                : Math.abs(limited.entry - 66.26866414968961e-6) < 1e-12 &&
                    limited.release !== null && Math.abs(limited.release - 329.1432340371157e-6) < 1e-12);
        check(`production browser ADP7118 selected ${label} captures 120 samples, analytic transitions and mean`,
            limited.fullyBonded && limited.finiteInput && limited.cold === 0 && limited.count === 120 && limited.origin === '10000' &&
            limited.interval === '10000' && limited.paired && transitionsMatch && limited.maxError < sampleTolerance &&
            limited.meanError < meanTolerance && limited.endpointError < sampleTolerance &&
            Math.abs(limited.mean - limited.final) > .05 && limited.bulkAccuracyMet === true,
            JSON.stringify(limited));
        check(`production browser ADP7118 ${label} separate partitioned probe preserves waveform, KCL and finite VIN delivery`,
            limited.accuracyMet === true && limited.endpointAgreement <= 1e-7 &&
            limited.partitionMaxError < (label === 'overload' ? 2e-4 : 5e-6) &&
            limited.maxCeilingError < 1e-8 && limited.maxKclError < 1e-9 && limited.maxSupplyError < 1e-9 &&
            limited.maxVinDropError < 1e-9,
            JSON.stringify(limited));
        check(`production browser ADP7118 ${label} source refusal invalidates acquired meter and scope observations`,
            /ADP7118.*(control|constant|source)/i.test(limited.controlRefusal) && limited.oldVoltageRefused &&
            limited.oldCurrentRefused && limited.oldScopeRefused, JSON.stringify(limited));
        await page.evaluate(handle => {
            const circuit = window.__circuit, failed = circuit.board;
            // Explicit harness cleanup after checking the refusal: a clean
            // bundled Board prevents Circuit's next snapshot/restore from
            // carrying the refused VIN control into the following fixture.
            // The failed Board and its observations are never repaired/reused.
            const clean = new failed.constructor(8);
            clean.setNetlist(failed.parts, failed.nets);
            circuit.board = clean;
            let stillRefused = false;
            try { failed.getScopeData(handle); }
            catch (error) { stillRefused = /scope capture refused/.test(error.message); }
            if (!stillRefused) throw new Error('cleanup lost the old Board scope refusal');
        }, limited.scopeHandle);
    }

    // The final vertical slice: Lite's bundled CUI face and Board model must
    // meet in one real browser circuit, not merely coexist as package files.
    await page.evaluate(value => new Promise(resolve => {
        window.__bwRenderingCircuitTab.setState({circuitData: value}, resolve);
    }), lt1763Fixture);
    const ltFace = designer.locator('[data-part-face="lt1763"][data-soic-body="lt1763"]');
    await ltFace.waitFor({state: 'visible', timeout: 10000});
    const ltFaceText = await ltFace.textContent();
    check('LT1763 renders as the truthful labelled SO-8 face',
        await ltFace.count() === 1 && /500mA LDO/.test(ltFaceText) &&
        ['out', 'sense_adj', 'gnd_3', 'byp', 'shdn', 'gnd_6', 'gnd_7', 'in']
            .every(name => ltFaceText.includes(name)),
        ltFaceText.replace(/\s+/g, ' ').trim());
    const lt1763 = await page.evaluate(() => {
        const circuit = window.__circuit;
        const board = circuit?.board;
        if (!board) return {error: 'CircuitTab did not publish the LT1763 board'};
        board.advanceTo(board.timeNs + 10_000n);
        const net = board.nets.find(item => item.terminals.some(endpoint =>
            endpoint.part === 'u1' && endpoint.terminal === 'out'));
        return {
            output: net ? board.nodeVoltage(net.id) : null,
            terminals: circuit.getPart('u1')?.terminals?.length || 0
        };
    });
    check('browser bundle solves the physical fixed-output LT1763 regulator',
        lt1763.terminals === 8 && typeof lt1763.output === 'number' &&
        Math.abs(lt1763.output - 5) < 0.003,
        JSON.stringify(lt1763));

    // The precision-amplifier vertical slice must also meet in the production
    // browser bundle: physical face, all package pins and the real Board model.
    await page.evaluate(value => new Promise(resolve => {
        window.__bwRenderingCircuitTab.setState({circuitData: value}, resolve);
    }), lt1001Fixture);
    await checkDip(designer.locator('[data-dip-body="lt1001"]'), 'LT1001', 8,
        ['offset_1', 'inn', 'inp', 'vneg', 'offset_5', 'out', 'vpos', 'nc']);
    const lt1001 = await page.evaluate(() => {
        const circuit = window.__circuit;
        const board = circuit?.board;
        if (!board) return {error: 'CircuitTab did not publish the LT1001 board'};
        board.advanceTo(board.timeNs + 40_000n);
        const net = board.nets.find(item => item.terminals.some(endpoint =>
            endpoint.part === 'u1' && endpoint.terminal === 'out'));
        return {
            output: net ? board.nodeVoltage(net.id) : null,
            terminals: circuit.getPart('u1')?.terminals?.length || 0
        };
    });
    check('browser bundle solves the physical LT1001 precision follower',
        lt1001.terminals === 8 && typeof lt1001.output === 'number' &&
        Math.abs(lt1001.output - 1.00001) < 0.00001,
        JSON.stringify(lt1001));
} finally {
    await browser.close();
}

if (failures.length) {
    console.error(`\n${failures.length} circuit rendering regression(s): ${failures.join(', ')}`);
    process.exit(1);
}
console.log('\nCircuit rendering browser gate passed.');
