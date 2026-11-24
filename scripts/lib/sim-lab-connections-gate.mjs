// SPDX-License-Identifier: BSD-3-Clause
// Actual built UI, production connections, direct-bytecode input guest and the
// shipped EV3 VM program. The delayed-connect control awaits the real connect
// and delays only its return; original greenFlag is observed and still called.
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {tool} from './sim-lab-toolbar-gate.mjs';

const connected = page => page.waitForFunction(() => /Connected to the model|Mit dem Modell verbunden/.test(
    document.querySelector('[data-testid="bw-sim-lab-connections"] [role="status"]')?.textContent || ''), null, {timeout: 30000});
const ready = page => page.waitForFunction(() => window.__bwSimLab?.status === 'ready', null, {timeout: 60000});
const loadExample = async page => {
    await tool(page, 'examples');
    const gallery = page.getByTestId('bw-sim-examples');
    await gallery.getByRole('searchbox').fill('ev3-wall-stopper');
    const exact = gallery.locator('[data-model="ev3-wall-stopper.ldr"]');
    await exact.waitFor();
    await exact.getByRole('button').last().click();
    await ready(page);
    await page.waitForFunction(() => {
        const pane = window.__bwSimLab?._pane;
        if (!pane || pane.state.status !== 'ready' || pane.state.programLoading || pane.state.modelFile !== 'ev3-wall-stopper.ldr' ||
            !pane.session?.hubs.some(record => record.profile === 'ev3') ||
            !pane.props.vm.extensionManager.isExtensionLoaded('ev3comprehensive')) return false;
        return pane.props.vm.runtime.targets.some(target => Object.values(target.blocks?._blocks || {})
            .some(block => block.opcode.startsWith('ev3comprehensive_')));
    }, null, {timeout: 60000});
};

// Brick buttons always live in the folded Brick controls section of Manual controls.
const brickPanel = async page => {
    const panel = page.getByTestId('bw-sim-lab-brick-buttons');
    if (await panel.count()) return panel;
    const controls = page.getByTestId('bw-sim-lab-controls-toggle');
    if (await controls.getAttribute('aria-expanded') !== 'true') await controls.click();
    const brick = page.getByTestId('bw-sim-lab-brick-controls-toggle');
    await brick.waitFor();
    if (await brick.getAttribute('aria-expanded') !== 'true') await brick.click();
    await panel.waitFor();
    return panel;
};

// The program connection is a folded Connection section of Manual controls.
const connectionPanel = async page => {
    const panel = page.getByTestId('bw-sim-lab-connections');
    if (await panel.count()) return panel;
    const controls = page.getByTestId('bw-sim-lab-controls-toggle');
    if (await controls.getAttribute('aria-expanded') !== 'true') await controls.click();
    const toggle = page.getByTestId('bw-sim-lab-connection-toggle');
    await toggle.waitFor();
    if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
    await panel.waitFor();
    return panel;
};

export const connectionInteractions = async ({browser, errors, openSimLab, shotsDir}) => {
    const page = await browser.newPage({viewport: {width: 1600, height: 1050}, serviceWorkers: 'block'});
    page.on('pageerror', error => errors.push(error.stack || error.message));
    page.on('dialog', dialog => dialog.accept());
    const out = {};
    try {
        await openSimLab(page, {program: null, via: 'arena'});
        await loadExample(page);
        await page.evaluate(() => {
            window.__bwConnectionHostBefore = {fetch: window.fetch, socket: window.WebSocket,
                serial: Object.getOwnPropertyDescriptor(navigator, 'serial')};
        });
        assert.equal(await page.evaluate(() => window.__bwSimLab.worker), true, 'actual physics worker');
        const controls = await connectionPanel(page);
        await controls.getByTestId('bw-sim-lab-connection-route').selectOption('bridge');
        await page.evaluate(() => {
            const vm = window.__bwSimLab._pane.props.vm;
            const original = vm.greenFlag;
            const state = window.__bwConnectionControl = {vm, original, flags: 0, pane: window.__bwSimLab._pane};
            state.observer = function (...args) { state.flags++; return original.apply(this, args); };
            vm.greenFlag = state.observer;
        });
        await controls.getByRole('button', {name: /^(Connect|Verbinden)$/}).click();
        await connected(page);
        assert.equal(await page.evaluate(() => window.__bwConnectionControl.flags), 0, 'Connect does not start the program');

        // Run the world through the public API, without a green flag.
        await page.evaluate(() => window.__bwSimLab.api.start());
        assert.equal(await page.evaluate(() => window.__bwConnectionControl.flags), 0);

        // An independently encoded WAIT_FOR_PRESS followed by a finite motor
        // command. No input, reply or motor implementation is replaced.
        const initial = await page.evaluate(async () => {
            const pane = window.__bwSimLab._pane;
            const record = pane.session.hubs.find(hub => hub.profile === 'ev3');
            const socket = new WebSocket('ws://localhost:8080');
            socket.binaryType = 'arraybuffer';
            const guest = window.__bwButtonWireGuest = {socket, hub: record.hub, replies: [], completedAt: null};
            socket.onmessage = event => {
                guest.replies.push(Array.from(new Uint8Array(event.data)));
                if (guest.replies.length === 2) guest.completedAt = pane.session.time;
            };
            await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
            const initial = {hubId: record.id, B: record.hub.s.outputs[1].angleDeg, C: record.hub.s.outputs[2].angleDeg};
            socket.send(Uint8Array.from([7, 0, 1, 0, 0, 0, 0, 0x83, 3]));
            const code = [0xae, 0, 6, 0x81, 40, 0, 0x82, 180, 0, 0x81, 90, 1, 0xaa, 0, 6];
            socket.send(Uint8Array.from([code.length + 5, 0, 2, 0, 0, 0, 0, ...code]));
            return initial;
        });
        assert.deepEqual(await page.evaluate(() => window.__bwButtonWireGuest.replies), []);
        assert.equal(await page.evaluate(() => window.__bwButtonWireGuest.hub.s.outputs.slice(1, 3).every(port => !port.job)), true);
        const enter = (await brickPanel(page)).locator('button[data-button="enter"]').first();
        const box = await enter.boundingBox();
        assert.ok(box);
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.waitForFunction(() => window.__bwButtonWireGuest.hub.button(2));
        await page.waitForFunction(() => window.__bwButtonWireGuest.replies.length >= 1);
        assert.equal(await enter.getAttribute('aria-pressed'), 'true');
        await page.mouse.up();
        await page.waitForFunction(() => window.__bwButtonWireGuest.replies.length === 2 &&
            window.__bwSimLab._pane.session.time >= window.__bwButtonWireGuest.completedAt + 600, null, {timeout: 30000});
        const moved = await page.evaluate(() => {
            const {hub, replies} = window.__bwButtonWireGuest;
            return {replies, B: hub.s.outputs[1].angleDeg, C: hub.s.outputs[2].angleDeg, held: hub.button(2)};
        });
        assert.deepEqual(moved.replies, [[3, 0, 1, 0, 2], [3, 0, 2, 0, 2]]);
        for (const port of ['B', 'C']) assert.ok(moved[port] - initial[port] >= 270 && moved[port] - initial[port] < 280,
            `${port}: finite STEP_SPEED retains its existing target-to-target-plus-ten contract`);
        assert.equal(moved.held, false);
        out.buttonGuest = moved;
        await page.evaluate(hubId => window.__bwSimLab.api.pressButton(hubId, 'up', true), initial.hubId);
        await tool(page, 'pause');
        await page.waitForFunction(() => window.__bwSimLab.status === 'paused');
        await page.waitForFunction(() => document.querySelector('[data-testid="bw-sim-lab-brick-buttons"] button[data-button="up"]')
            ?.getAttribute('aria-pressed') === 'true');
        await page.evaluate(hubId => window.__bwSimLab.api.pressButton(hubId, 'up', false), initial.hubId);
        await page.waitForFunction(() => document.querySelector('[data-testid="bw-sim-lab-brick-buttons"] button[data-button="up"]')
            ?.getAttribute('aria-pressed') === 'false');
        assert.equal(await page.evaluate(() => window.__bwSimLab.status), 'paused');
        assert.equal(await page.evaluate(() => Boolean(window.__bwSimLab._pane.clock?.installed)), false);

        // Model replacement while a real UI pointer owns a hold releases the
        // old input and closes its actual socket, without touching the NXT.
        const again = await enter.boundingBox();
        assert.ok(again);
        await page.mouse.move(again.x + again.width / 2, again.y + again.height / 2);
        await page.mouse.down();
        await page.waitForFunction(() => window.__bwButtonWireGuest.hub.button(2));
        await page.evaluate(() => window.__bwSimLab.api.loadModel('nxt-bumper-bot'));
        await ready(page);
        await page.mouse.up();
        const replaced = await page.evaluate(() => ({
            oldHeld: window.__bwButtonWireGuest.hub.button(2), oldSocket: window.__bwButtonWireGuest.socket.readyState,
            current: window.__bwSimLab.api.brickButtons(), flags: window.__bwConnectionControl.flags
        }));
        assert.equal(replaced.oldHeld, false);
        assert.equal(replaced.oldSocket, 3);
        assert.equal(replaced.flags, 0);
        assert.ok(replaced.current.every(brick => brick.buttons.every(button => !button.pressed)));

        await loadExample(page);
        await controls.getByTestId('bw-sim-lab-connection-route').selectOption('bridge');
        await page.evaluate(() => {
            const pane = window.__bwSimLab._pane;
            const runtime = pane.props.vm.runtime;
            const opcode = 'ev3comprehensive_connect';
            const original = runtime._primitives[opcode];
            const control = window.__bwDelayedLabConnect = {runtime, opcode, original, completedRealConnect: false, returned: false};
            const gate = new Promise(resolve => { control.release = resolve; });
            control.wrapper = async (...args) => {
                const value = await original(...args);
                control.completedRealConnect = true;
                await gate;
                control.returned = true;
                return value;
            };
            runtime._primitives[opcode] = control.wrapper;
        });
        await controls.getByRole('button', {name: /^(Connect|Verbinden)$/}).click();
        await page.waitForFunction(() => window.__bwDelayedLabConnect.completedRealConnect);
        assert.equal(await page.evaluate(async () => {
            const runtime = window.__bwSimLab._pane.props.vm.runtime;
            return await runtime._primitives.ev3comprehensive_isConnected({}, {runtime});
        }), true, 'controlled delay follows a real completed connection');
        await page.evaluate(() => window.__bwSimLab.api.loadModel('nxt-bumper-bot'));
        await ready(page);
        await page.evaluate(() => window.__bwDelayedLabConnect.release());
        await page.waitForFunction(() => window.__bwDelayedLabConnect.returned);
        const stale = await page.evaluate(() => ({status: window.__bwSimLab.status, clock: Boolean(window.__bwSimLab._pane.clock?.installed),
            flags: window.__bwConnectionControl.flags, profile: window.__bwSimLab._pane.session.hubs[0].profile}));
        assert.equal(stale.status, 'ready');
        assert.equal(stale.clock, false);
        assert.equal(stale.flags, 0);
        assert.equal(stale.profile, 'nxt');
        out.staleConnect = stale;
        await page.evaluate(() => {
            const c = window.__bwDelayedLabConnect;
            if (c.runtime._primitives[c.opcode] === c.wrapper) c.runtime._primitives[c.opcode] = c.original;
        });

        // Finally use Connect + Run for the unchanged shipped extension
        // program, measuring the actual world on each worker publication.
        await loadExample(page);
        await controls.getByTestId('bw-sim-lab-connection-route').selectOption('bluetooth');
        await page.evaluate(() => {
            const pane = window.__bwSimLab._pane;
            const original = pane.connectLegacy;
            let release;
            const gate = new Promise(resolve => {release = resolve;});
            const control = window.__bwLegacyBridgeGate = {pane, original, release, scene: pane.session, completedRealConnect: false};
            control.wrapper = function (vm, connect, isCurrent) {
                return original.call(this, vm, async () => {
                    const result = await connect();
                    control.completedRealConnect = true;
                    await gate;
                    return result;
                }, isCurrent);
            };
            pane.connectLegacy = control.wrapper;
        });
        await tool(page, 'run');
        await page.waitForFunction(() => window.__bwLegacyBridgeGate.completedRealConnect);
        assert.equal(await page.evaluate(async () => {
            const runtime = window.__bwSimLab._pane.props.vm.runtime;
            return await runtime._primitives.ev3comprehensive_isConnected({}, {runtime});
        }), true, 'the held Bluetooth helper completed its actual producer connection');
        await page.evaluate(() => window.__bwSimLab.api.loadModel('ev3-wall-stopper'));
        await ready(page);
        await page.waitForFunction(async () => {
            const runtime = window.__bwSimLab._pane.props.vm.runtime;
            return await runtime._primitives.ev3comprehensive_isConnected({}, {runtime}) === false;
        });
        const replacedLegacy = await page.evaluate(() => ({
            replaced: window.__bwSimLab._pane.session !== window.__bwLegacyBridgeGate.scene,
            disposed: window.__bwLegacyBridgeGate.scene._disposed,
            flags: window.__bwConnectionControl.flags
        }));
        assert.deepEqual(replacedLegacy, {replaced: true, disposed: true, flags: 0});
        out.legacyScene = replacedLegacy;
        await controls.getByTestId('bw-sim-lab-connection-route').selectOption('bridge');
        await controls.getByRole('button', {name: /^(Connect|Verbinden)$/}).click();
        await page.waitForFunction(() => window.__bwSimLab._pane.state.connection.status === 'connecting');
        const pendingLegacy = await page.evaluate(() => ({status: window.__bwSimLab._pane.state.connection.status,
            flags: window.__bwConnectionControl.flags, clock: Boolean(window.__bwSimLab._pane.clock?.installed)}));
        assert.deepEqual(pendingLegacy, {status: 'connecting', flags: 0, clock: false});
        out.legacyBridge = pendingLegacy;
        await page.evaluate(() => window.__bwLegacyBridgeGate.release());
        await connected(page);
        await page.evaluate(() => {
            const control = window.__bwLegacyBridgeGate;
            if (control.pane.connectLegacy === control.wrapper) control.pane.connectLegacy = control.original;
        });
        // Execute the real clock install, then fail only its return. A Run
        // that reached this boundary must roll back its actual VM/clock/routes
        // before a normal retry can run the unchanged shipped program.
        await page.evaluate(() => {
            const pane = window.__bwSimLab._pane;
            const original = pane.startClock;
            const control = window.__bwFailedClockInstall = {pane, original, installed: false};
            control.wrapper = function (...args) {
                original.apply(this, args);
                control.installed = Boolean(this.clock?.installed);
                throw new Error('controlled failure after actual clock installation');
            };
            pane.startClock = control.wrapper;
        });
        await tool(page, 'run');
        await page.waitForFunction(() => window.__bwSimLab.status === 'paused' &&
            window.__bwSimLab._pane.state.connection.status === 'failed' &&
            window.__bwSimLab._pane.lastConnectionError?.message.includes('controlled failure after actual clock installation'));
        const failedRun = await page.evaluate(async () => ({
            installed: window.__bwFailedClockInstall.installed,
            clock: Boolean(window.__bwSimLab._pane.clock?.installed),
            flags: window.__bwConnectionControl.flags,
            route: (await fetch('http://localhost:8080/')).status
        }));
        assert.deepEqual(failedRun, {installed: true, clock: false, flags: 0, route: 503});
        out.failedRun = failedRun;
        await page.evaluate(() => {
            const control = window.__bwFailedClockInstall;
            if (control.pane.startClock === control.wrapper) control.pane.startClock = control.original;
        });
        await controls.getByRole('button', {name: /^(Connect|Verbinden)$/}).click();
        await connected(page);
        await page.evaluate(() => {
            const session = window.__bwSimLab._pane.session;
            const record = session.hubs.find(hub => hub.profile === 'ev3');
            const track = window.__bwLabConnectionTrack = [];
            window.__bwLabConnectionTrackStop = session.onAdvance(() => track.push({time: session.time,
                x: session.core.bodyPose(record.body).position[0], cm: record.hub.readInput(0, 3, 0, 0, 'READY_SI').values[0]}));
        });
        await tool(page, 'run');
        await page.waitForFunction(() => window.__bwLabConnectionTrack.at(-1)?.time >= 6000, null, {timeout: 90000});
        const program = await page.evaluate(() => {
            const track = window.__bwLabConnectionTrack;
            const last = track.at(-1);
            const before = track.find(point => point.time >= last.time - 1000);
            return {travel: last.x - track[0].x, cm: last.cm, drift: Math.abs(last.x - before.x), flags: window.__bwConnectionControl.flags};
        });
        assert.ok(program.travel > 0.2);
        assert.ok(program.cm > 2 && program.cm < 15, `shipped program: ${JSON.stringify(program)}`);
        assert.ok(program.drift < 0.005);
        assert.equal(program.flags, 1, 'only the final explicit Run invoked the original green flag');
        out.program = program;
        if (shotsDir) await page.screenshot({path: resolve(shotsDir, 'sim-lab-connections.png')});
        await controls.getByRole('button', {name: /^(Disconnect|Trennen)$/}).click();
        await page.waitForFunction(() => window.__bwSimLab.status === 'paused' &&
            window.__bwSimLab._pane.state.connection.status === 'idle');
        await controls.getByTestId('bw-sim-lab-connection-route').selectOption('serial');
        await controls.getByRole('button', {name: /^(Connect|Verbinden)$/}).click();
        await connected(page);
        const serial = await page.evaluate(async () => {
            const ports = (await navigator.serial.getPorts()).filter(port => port.session);
            window.__bwDisconnectedSerialPort = ports.length === 1 ? ports[0] : null;
            return ports.map(port => ({baudRate: port.openOptions.baudRate}));
        });
        assert.deepEqual(serial, [{baudRate: 115200}], 'actual EV3 backend opened the selected virtual serial port');
        await controls.getByRole('button', {name: /^(Disconnect|Trennen)$/}).click();
        await page.waitForFunction(() => window.__bwSimLab.status === 'paused' &&
            window.__bwSimLab._pane.state.connection.status === 'idle');
        await page.waitForFunction(() => {
            const port = window.__bwDisconnectedSerialPort;
            return port && port.session === null && port.readable === null && port.writable === null;
        });
        assert.equal(await page.evaluate(async () => (await navigator.serial.getPorts()).every(port => !port.session)), true);
        assert.equal(await page.evaluate(() => window.__bwConnectionControl.flags), 1);
        // Close the pane with an active serial session as well as held input.
        await controls.getByRole('button', {name: /^(Connect|Verbinden)$/}).click();
        await connected(page);
        const closingSerial = await page.evaluate(async () => {
            const ports = (await navigator.serial.getPorts()).filter(port => port.session);
            window.__bwCloseSerialPort = ports.length === 1 ? ports[0] : null;
            return ports.map(port => ({baudRate: port.openOptions.baudRate}));
        });
        assert.deepEqual(closingSerial, [{baudRate: 115200}]);
        assert.equal(await page.evaluate(() => window.__bwConnectionControl.flags), 1);
        const release = page.getByTestId('bw-spike-simulator-use-arena');
        await release.waitFor({state: 'visible'});
        assert.equal(await release.isEnabled(), true);
        const held = (await brickPanel(page)).locator('button[data-button="enter"]').first();
        await held.focus();
        await page.keyboard.down('Enter');
        await page.waitForFunction(() => window.__bwSimLab._pane.session.hubs.find(record => record.profile === 'ev3').hub.button(2));
        await page.evaluate(() => {
            window.__bwUnmountedInputHub = window.__bwSimLab._pane.session.hubs.find(record => record.profile === 'ev3').hub;
        });
        // The arena handover releases the persistent Lab tab. A Stage/right-pane
        // presentation change deliberately leaves that tab mounted. Invoke the
        // real handover without pointer blur releasing Enter before unmount.
        const closing = await release.evaluate(element => {
            const before = {
                focused: Boolean(document.activeElement?.matches('[data-testid="bw-sim-lab-brick-buttons"] button[data-button="enter"]')),
                held: window.__bwUnmountedInputHub.button(2),
                serialOpen: Boolean(window.__bwCloseSerialPort?.session)
            };
            element.click();
            return before;
        });
        assert.deepEqual(closing, {focused: true, held: true, serialOpen: true});
        await page.waitForFunction(() => !window.__bwSimLab);
        assert.equal(await page.getByTestId('bw-robot-lab-tab').getAttribute('data-state'), 'released');
        await release.waitFor({state: 'hidden'});
        await page.keyboard.up('Enter');
        // Pane closure is synchronous; its real provider drain may finish
        // later. Observe wrapper restoration rather than assuming it is done.
        await page.waitForFunction(() => {
            const before = window.__bwConnectionHostBefore;
            const after = Object.getOwnPropertyDescriptor(navigator, 'serial');
            const sameSerial = !before.serial && !after || Boolean(before.serial && after &&
                ['value', 'get', 'set', 'writable', 'enumerable', 'configurable'].every(key => before.serial[key] === after[key]));
            return window.fetch === before.fetch && window.WebSocket === before.socket && sameSerial;
        });
        const closed = await page.evaluate(() => {
            const before = window.__bwConnectionHostBefore;
            const after = Object.getOwnPropertyDescriptor(navigator, 'serial');
            const sameSerial = !before.serial && !after || Boolean(before.serial && after &&
                ['value', 'get', 'set', 'writable', 'enumerable', 'configurable'].every(key => before.serial[key] === after[key]));
            const port = window.__bwCloseSerialPort;
            return {fetch: window.fetch === before.fetch, socket: window.WebSocket === before.socket, serial: sameSerial,
                serialClosed: Boolean(port && port.session === null && port.readable === null && port.writable === null),
                held: window.__bwUnmountedInputHub.button(2), disposed: window.__bwConnectionControl.pane.disposed,
                clock: Boolean(window.__bwConnectionControl.pane.clock?.installed), api: Boolean(window.__bwConnectionControl.vm.runtime.robotLab)};
        });
        assert.deepEqual(closed, {fetch: true, socket: true, serial: true, serialClosed: true,
            held: false, disposed: true, clock: false, api: false});
        out.closed = closed;
        return out;
    } catch (error) {
        if (shotsDir) await page.screenshot({path: resolve(shotsDir, 'sim-lab-connections-failure.png'), fullPage: true}).catch(() => {});
        throw error;
    } finally {
        await page.evaluate(() => {
            const legacy = window.__bwLegacyBridgeGate;
            legacy?.release();
            if (legacy && legacy.pane.connectLegacy === legacy.wrapper) legacy.pane.connectLegacy = legacy.original;
            const clock = window.__bwFailedClockInstall;
            if (clock && clock.pane.startClock === clock.wrapper) clock.pane.startClock = clock.original;
            window.__bwLabConnectionTrackStop?.();
            window.__bwButtonWireGuest?.socket.close();
            const connect = window.__bwDelayedLabConnect;
            connect?.release();
            if (connect && connect.runtime._primitives[connect.opcode] === connect.wrapper) connect.runtime._primitives[connect.opcode] = connect.original;
            const flags = window.__bwConnectionControl;
            if (flags && flags.vm.greenFlag === flags.observer) flags.vm.greenFlag = flags.original;
        }).catch(() => {});
        await page.close();
    }
};
