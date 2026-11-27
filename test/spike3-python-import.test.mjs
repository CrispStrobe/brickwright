// SPDX-License-Identifier: BSD-3-Clause
/**
 * LEGO SPIKE App 3 Python in lite: the vendored reader against the SHIPPING
 * spikeprime extension and the virtual hub.
 *
 * sb3-creator holds the reader's own behaviour (its test/spike3-python.test.mjs:
 * the API ledger, units, ordering, a corpus round trip). What only lite can
 * hold is whether the blocks it emits are blocks THIS app runs:
 *
 *  1. the Python entry point the Code tab calls routes SPIKE 3 programs to it,
 *     and the button's detection agrees with the reader's;
 *  2. every opcode an imported program uses is defined AND implemented by the
 *     bundled extension (bw-vm.mjs conformance);
 *  3. every menu field it writes holds a value from that extension's getInfo()
 *     menu — the motor UNIT fix (the dialect stored "degree"; motorRunFor
 *     matched it to nothing and turned by 0) is judged here, against the real
 *     menu, not a copy of it;
 *  4. the sensor blocks an import reads return what the test sets in the
 *     virtual hub, through the extension's own connection to it;
 *  5. the Code tab's run helper connects, starts, forwards print(), and stops.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {quietConsole} from './helpers/quiet-console.mjs';
import {SB3Creator, conformance} from './helpers/bw-vm.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const LIB = resolve(here, '../overlay/scratch-gui/src/lib');
const {default: pythonToPseudocode} = await import(resolve(LIB, 'sb3-creator-python.js'));
const {SPIKE3_API, isSpike3Python} = await import(resolve(LIB, 'sb3-creator-spike3.js'));
const {SPIKE3_IMPORT, isSpike3Program, runSpike3OnVirtualHub} = await import(resolve(LIB, 'spike3-python-run.js'));

const PRELUDE = 'import hub\nfrom hub import port, light_matrix, sound, motion_sensor, button, light\n' +
    'import motor, motor_pair, color_sensor, distance_sensor, force_sensor, color, runloop\n';
const inMain = (...lines) => `${PRELUDE}\nasync def main():\n${lines.map(l => `    ${l}`).join('\n')}\n\nrunloop.run(main())\n`;
const compile = pseudocode => {
    const c = new SB3Creator();
    const project = c.parse(pseudocode);
    return {c, project, blocks: project.targets.flatMap(t => Object.values(t.blocks || {}))};
};
/** Every documented call the reader maps, as one program each. */
const MAPPED = Object.entries(SPIKE3_API).filter(([, [status, sample]]) => status !== 'unsupported' && sample);

test('the Code tab\'s Python route reads SPIKE 3 programs with the vendored reader', () => {
    const r = pythonToPseudocode(inMain('await motor.run_for_degrees(port.A, 360, 555)'));
    assert.equal(r.dialect, 'spike3');
    assert.match(r.pseudocode, /^DEVICE SPIKE$/m);
    assert.match(r.pseudocode, /^\s+run motor A forward 360 degrees$/m);
    assert.deepEqual(r.unsupported, []);
});

test('the button\'s detection is the reader\'s own expression', () => {
    const vendored = readFileSync(resolve(LIB, 'sb3-creator-spike3.js'), 'utf8');
    const m = /const SPIKE3_IMPORT = (\/.*\/m);/.exec(vendored);
    assert.ok(m, 'the vendored reader declares SPIKE3_IMPORT');
    assert.equal(String(SPIKE3_IMPORT), m[1]);
    for (const src of [inMain('pass'), 'from hub import light_matrix\n', 'import motor_pair\n',
        'from unsupported_hub import PrimeHub\n', 'from spike import PrimeHub\n', 'from microbit import *\n', 'print(1)\n']) {
        assert.equal(isSpike3Program(src), isSpike3Python(src), src);
    }
});

test('every block an import emits is one the bundled spikeprime extension defines and implements', () => {
    let checked = 0;
    for (const [fn, [, sample]] of MAPPED) {
        const r = pythonToPseudocode(inMain('motor_pair.pair(motor_pair.PAIR_1, port.A, port.B)', sample));
        const {c, project} = compile(r.pseudocode);
        assert.deepEqual(c.warnings, [], fn);
        const report = conformance(project);
        assert.deepEqual(report.errors, [], fn);
        // A spikeprime_menu_<NAME> block is the shadow Scratch builds for a menu
        // argument that accepts reporters; it is judged against that menu below.
        const missing = report.missing.filter(m => !/^spikeprime_menu_/.test(m.opcode));
        assert.deepEqual(missing, [], `${fn}: ${JSON.stringify(missing)}`);
        checked++;
    }
    assert.ok(checked >= 38, `counted 38 mapped or approximate API samples on 2026-09-28; checked ${checked}`);
});

/** The bundled extension, evaluated as the VM does, against a stub runtime. */
const loadBundledExtension = async () => {
    const wrapper = readFileSync(resolve(here, '../overlay/scratch-vm/src/extensions/crispstrobe/spikeprime/index.js'), 'utf8');
    const source = JSON.parse(wrapper.slice(wrapper.indexOf('makeExt(') + 8, -3));
    let extension = null;
    const runtime = {
        getLocale: () => 'en', on: () => {}, emit: () => {}, registerPeripheralExtension: () => {},
        constructor: {PERIPHERAL_CONNECTED: 'connected', PERIPHERAL_DISCONNECTED: 'disconnected',
            PERIPHERAL_LIST_UPDATE: 'list', USER_PICKED_PERIPHERAL: 'picked',
            PERIPHERAL_SCAN_TIMEOUT: 'timeout', PERIPHERAL_REQUEST_ERROR: 'error'}
    };
    const Scratch = {
        extensions: {unsandboxed: true, register: value => { extension = value; }},
        BlockType: {COMMAND: 'command', REPORTER: 'reporter', BOOLEAN: 'Boolean'},
        ArgumentType: {STRING: 'string', NUMBER: 'number', ANGLE: 'angle', MATRIX: 'matrix'},
        Cast: {toString: String, toNumber: Number},
        vm: {runtime}
    };
    Function('Scratch', source)(Scratch); // eslint-disable-line no-new-func
    return extension;
};

Object.defineProperty(globalThis, 'navigator', {value: {}, configurable: true, writable: true});
globalThis.window = globalThis;
quietConsole();
globalThis.addEventListener = () => {};
globalThis.localStorage = {getItem: () => null};
globalThis.document = {documentElement: {lang: 'en'}};
globalThis.alert = () => {};

test('every menu field an import writes is a value of that block\'s menu in the shipping extension', async () => {
    const realSetInterval = globalThis.setInterval;
    globalThis.setInterval = () => 0;
    const info = (await loadBundledExtension()).getInfo();
    globalThis.setInterval = realSetInterval;
    const menuValues = name => {
        const menu = info.menus[name];
        const items = Array.isArray(menu) ? menu : menu && menu.items;
        if (!Array.isArray(items)) return null;                 // a dynamic menu: nothing fixed to judge
        return items.map(item => String(typeof item === 'object' ? item.value : item));
    };
    const blocks = new Map(info.blocks.filter(b => b && b.opcode).map(b => [b.opcode, b]));
    const programs = [...MAPPED.map(([, [, sample]]) => inMain('motor_pair.pair(motor_pair.PAIR_1, port.A, port.B)', sample)),
        inMain('await motor.run_for_degrees(port.A, -90, 300)', 'await motor.run_for_time(port.B, 500, 300)',
            'await motor.run_for_degrees(port.C, 2 * 360, 300)', 'motor.stop(port.D, stop=motor.COAST)',
            'v = distance_sensor.distance(port.F)', 'w = color_sensor.color(port.E) == color.GREEN')];
    let judged = 0;
    const units = new Set();
    for (const program of programs) {
        const {blocks: emitted} = compile(pythonToPseudocode(program).pseudocode);
        for (const b of emitted.filter(x => /^spikeprime_/.test(x.opcode))) {
            const shadowMenu = /^spikeprime_menu_(.+)$/.exec(b.opcode);
            if (shadowMenu) {
                const values = menuValues(shadowMenu[1]);
                assert.ok(values, `${b.opcode} names a menu of the shipping extension`);
                for (const [field, [value]] of Object.entries(b.fields || {})) {
                    assert.ok(values.includes(String(value)), `${b.opcode}.${field} = ${JSON.stringify(value)} is not in menu ${shadowMenu[1]}`);
                    judged++;
                }
                continue;
            }
            const def = blocks.get(b.opcode.slice('spikeprime_'.length));
            assert.ok(def, `${b.opcode} is a block of the shipping extension`);
            for (const [field, [value]] of Object.entries(b.fields || {})) {
                const arg = def.arguments && def.arguments[field];
                assert.ok(arg, `${b.opcode}.${field} is an argument of the block`);
                const values = arg.menu ? menuValues(arg.menu) : null;
                if (!values) continue;
                assert.ok(values.includes(String(value)), `${b.opcode}.${field} = ${JSON.stringify(value)} is not in menu ${arg.menu}: ${values}`);
                if (field === 'UNIT') units.add(value);
                judged++;
            }
        }
    }
    assert.ok(judged > 50, `judged ${judged} menu fields`);
    for (const unit of ['degrees', 'seconds', 'rotations', 'mm']) assert.ok(units.has(unit), `a ${unit} field was judged`);
});

test('the sensor blocks an import reads return what the virtual hub holds', async t => {
    const realSetInterval = globalThis.setInterval;
    globalThis.setInterval = () => 0;
    t.after(() => { globalThis.setInterval = realSetInterval; });
    const {default: install, clearVirtualPeripheralsForTest} = await import(resolve(LIB, 'virtual-hub/web-bluetooth-shim.js'));
    const {registerVirtualSpikePrime} = await import(resolve(LIB, 'virtual-hub/spike-prime-peripheral.js'));
    const {default: HubState} = await import(resolve(LIB, 'virtual-hub/spike-hub-state.js'));
    clearVirtualPeripheralsForTest();
    const hub = new HubState();
    hub.setSimulationEnabled(true);
    const registration = registerVirtualSpikePrime({hubState: hub});
    globalThis.__brickwrightChooseVirtualBluetooth = candidates => candidates[0];
    install();
    const extension = await loadBundledExtension();
    t.after(() => { extension.disconnectHub(); registration.unregister(); });
    await extension.connectHub();
    assert.equal(extension.isConnected(), true);
    // The extension asks for device notifications once the hub's info reply
    // arrives; until then a sensor the test sets would not be sent to it.
    for (let i = 0; i < 50 && hub.data.notificationIntervalMs === null; i++) await new Promise(r => setImmediate(r));
    assert.notEqual(hub.data.notificationIntervalMs, null, 'the extension subscribed to the hub\'s device notifications');

    hub.setPort('D', 'distance', {distance: 345});
    hub.setPort('C', 'color', {color: 9, red: 900, green: 40, blue: 40});
    hub.setPort('E', 'force', {force: 60, pressed: true});
    hub.setPort('A', 'motor', {speed: 0, position: 725});
    hub.setImu({yaw: 30});

    /** Call the extension the way the VM would call the ONE reporter block `expr` compiles to. */
    const read = expr => {
        const r = pythonToPseudocode(inMain(`v = ${expr}`));
        assert.deepEqual(r.unsupported, [], expr);
        const {blocks} = compile(r.pseudocode);
        const reporters = blocks.filter(b => /^spikeprime_(get|is)/.test(b.opcode));
        assert.equal(reporters.length, 1, `${expr} is one reporter block`);
        const [b] = reporters;
        const args = Object.fromEntries(Object.entries(b.fields || {}).map(([k, [v]]) => [k, v]));
        return {value: extension[b.opcode.slice('spikeprime_'.length)](args), pseudocode: r.pseudocode};
    };
    assert.equal(read('distance_sensor.distance(port.D)').value, 345, 'millimetres, as SPIKE 3 reports them');
    assert.equal(read('color_sensor.color(port.C) == color.RED').value, true);
    assert.equal(read('color_sensor.color(port.C) == color.BLUE').value, false);
    assert.equal(read('force_sensor.force(port.E)').value, 60);
    assert.equal(read('force_sensor.pressed(port.E)').value, true);
    assert.equal(read('motor.relative_position(port.A)').value, 725);
    const yaw = read('motion_sensor.tilt_angles()[0]');
    assert.equal(yaw.value, 30, 'the block reads the hub\'s yaw in degrees, clockwise positive');
    assert.match(yaw.pseudocode, /set v to \(0 - \(spike angle yaw\)\) \* 10/,
        'and the import turns it into SPIKE 3\'s decidegrees, counterclockwise positive: -300');
});

test('the run helper connects over Web Bluetooth, starts, forwards print(), and stops', async () => {
    const calls = [];
    let connected = false;
    const listeners = new Map();
    const vm = {
        runtime: {
            _primitives: {
                spikeprime_isConnected: () => connected,
                spikeprime_setConnectionMode: args => { calls.push(['mode', args.MODE]); },
                spikeprime_connectHub: async () => { calls.push(['connect', typeof globalThis.__brickwrightChooseVirtualBluetooth]); win.__brickwrightChooseVirtualBluetooth([{hubState: win.__brickwrightVirtualSpike.hubState}]); connected = true; }
            },
            getEditingTarget: () => null,
            on: (name, fn) => listeners.set(name, [...(listeners.get(name) || []), fn]),
            removeListener: (name, fn) => listeners.set(name, (listeners.get(name) || []).filter(f => f !== fn)),
            listeners: name => [...(listeners.get(name) || [])]
        },
        greenFlag: () => calls.push(['green']),
        stopAll: () => calls.push(['stop'])
    };
    const bubble = () => {};
    listeners.set('SAY', [bubble]);
    let enabled = null;
    const win = {__brickwrightVirtualSpike: {enable: v => { enabled = v; }, hubState: {stopAll () {}}}};
    const printed = [];
    const run = await runSpike3OnVirtualHub(vm, {window: win, onPrint: text => printed.push(text)});
    assert.equal(run.ok, true);
    assert.equal(enabled, true, 'the virtual hub is switched on');
    assert.deepEqual(calls, [['mode', 'web-ble'], ['connect', 'function'], ['green']]);
    assert.equal(win.__brickwrightChooseVirtualBluetooth, undefined, 'the chooser is put back');
    assert.deepEqual(listeners.get('SAY').length, 1, 'only the console hears print() during the run');
    listeners.get('SAY')[0]({}, 'say', 'yaw=12');
    assert.deepEqual(printed, ['yaw=12']);
    run.stop();
    assert.deepEqual(calls.at(-1), ['stop']);
    assert.deepEqual(listeners.get('SAY'), [bubble], 'print() stops being forwarded and the speech bubble is back');
    assert.deepEqual(await runSpike3OnVirtualHub(vm, {window: {}}), {ok: false, reason: 'no-hub'});
});

test('the Code tab offers the run, a stop and a console, in English and German', () => {
    const jsx = readFileSync(resolve(here, '../overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx'), 'utf8');
    for (const [id, action] of [['bw-spike3-run', 'runOnSpike3'], ['bw-spike3-stop', 'stopSpike3']]) {
        const button = jsx.split('</button>').find(block =>
            block.includes(`data-testid={menu ? "${id}-menu" : "${id}"}`));
        assert.ok(button, `missing inline or menu ${id} button`);
        assert.ok(button.slice(button.lastIndexOf('<button')).includes(`onClick={() => this.${action}()}`),
            `${id} calls the wrong action`);
    }
    assert.match(jsx, /data-testid="bw-spike3-console" role="log" aria-label=\{this\.L\.spike3Console\}/);
    const keys = ['runOnSpike3', 'runOnSpike3Title', 'spike3Console', 'spike3Stop', 'spike3Running', 'spike3Stopped',
        'spike3NoHub', 'spike3NoConnect', 'spike3Unsupported', 'spike3Note', 'spike3Error', 'spike3Clear'];
    const en = jsx.slice(jsx.indexOf('    en: {'), jsx.indexOf('    de: {'));
    const de = jsx.slice(jsx.indexOf('    de: {'));
    for (const key of keys) {
        assert.match(en, new RegExp(`\\b${key}:`), `en.${key}`);
        assert.match(de, new RegExp(`\\b${key}:`), `de.${key}`);
    }
    assert.match(de, /runOnSpike3: '▶ Auf SPIKE 3 ausführen \(Python\)'/);
});


test('Code-tab run advances the shared hub only when the VM steps and cancels on Stop', async () => {
    const {default: Hub} = await import(resolve(LIB, 'virtual-hub/spike-hub-state.js'));
    const hub = new Hub();
    let connected = true;
    const vm = {runtime: {_step () {}, currentStepTime: 100,
        _primitives: {spikeprime_isConnected: () => connected,
            spikeprime_disconnectHub: () => { connected = false; }, spikeprime_setConnectionMode () {},
            spikeprime_connectHub: () => {win.__brickwrightChooseVirtualBluetooth([{hubState: hub}]); connected = true;}},
        on () {}, removeListener () {}, listeners: () => []},
        greenFlag () {hub.backend.runAtSpeed('A', 300);}, stopAll () {}};
    const original = vm.runtime._step;
    const win = {__brickwrightVirtualSpike: {enable () {}, hubState: hub}};
    const run = await runSpike3OnVirtualHub(vm, {window: win});
    await new Promise(resolve => setTimeout(resolve, 40));
    assert.equal(hub.data.motors[0].position, 0, 'wall time alone buys no physics');
    vm.runtime._step(); vm.runtime._step();
    await new Promise(resolve => setTimeout(resolve, 40));
    assert.equal(hub.data.motors[0].degPerSec, 300);
    assert.ok(hub.data.motors[0].position > 0);
    win.__bwSpikeArena = {status: 'running'};
    const before = hub.data.motors[0].position;
    vm.runtime._step();
    await new Promise(resolve => setTimeout(resolve, 40));
    assert.equal(hub.data.motors[0].position, before, 'an active arena owns advancement');
    const wait = hub.backend.wait(10000);
    run.stop();
    assert.equal(await wait, 'interrupted');
    assert.equal(hub.data.motors[0].degPerSec, 0);
    assert.equal(vm.runtime._step, original);
});

test('Code-tab run never advances a hub a Robot Lab scene drives, and still advances any other', async t => {
    // docs/ROBOT-LAB-ARCHITECTURE.md §3.5: the Lab's physics measures the shafts, so a
    // Python run on the Lab's hub must leave its clock alone even while the Lab is paused.
    const {default: Hub} = await import(resolve(LIB, 'virtual-hub/spike-hub-state.js'));
    const hub = new Hub();
    let connected = true;
    const vm = {runtime: {_step () {}, currentStepTime: 100,
        _primitives: {spikeprime_isConnected: () => connected,
            spikeprime_disconnectHub: () => { connected = false; }, spikeprime_setConnectionMode () {},
            spikeprime_connectHub: () => {win.__brickwrightChooseVirtualBluetooth([{hubState: hub}]); connected = true;}},
        on () {}, removeListener () {}, listeners: () => []},
        greenFlag () {hub.backend.runAtSpeed('A', 300);}, stopAll () {}};
    const win = {__brickwrightVirtualSpike: {enable () {}, hubState: hub}, __bwSimLab: {hubState: hub}};
    const run = await runSpike3OnVirtualHub(vm, {window: win});
    t.after(() => run.stop());
    vm.runtime._step(); vm.runtime._step();
    await new Promise(resolve => setTimeout(resolve, 40));
    assert.equal(hub.data.motors[0].degPerSec, 0, 'the controller was not stepped');
    assert.equal(hub.data.motors[0].position, 0, 'the Lab owns this hub\'s clock');
    win.__bwSimLab = {hubState: new Hub()};
    vm.runtime._step();
    await new Promise(resolve => setTimeout(resolve, 40));
    assert.ok(hub.data.motors[0].position > 0, 'a Lab scene on another hub does not hold this one');
});
