import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const native = path.join(root, 'apps/tauri/src-tauri');
const BROKER_PREFIX = 'native_broker_';
const BROKER_WEBVIEW = 'capability-broker';
const ACK_COMMAND = 'native_broker_ready';
// Peer sessions (task E11): registered and permitted ONLY in a `peers` Cargo-feature build.
const PEER_CFG = 'feature = "peers"';
const PEER_COMMANDS = ['peer_status', 'peer_enable', 'peer_disable', 'peer_send', 'peer_reply'];

const balanced = (source, marker, open, close) => {
    const markerAt = source.indexOf(marker);
    assert.notEqual(markerAt, -1, `missing ${marker}`);
    const start = source.indexOf(open, markerAt + marker.length);
    assert.notEqual(start, -1, `missing ${open} after ${marker}`);
    let depth = 0;
    for (let i = start; i < source.length; i++) {
        if (source[i] === open) depth++;
        if (source[i] === close && --depth === 0) return source.slice(start + 1, i);
    }
    assert.fail(`unbalanced ${marker}`);
};

const stringArray = body => [...body.matchAll(/"([a-z0-9_-]+)"/g)].map(match => match[1]);
const uniqueSorted = values => [...new Set(values)].sort();

// Entries may carry a `#[cfg(...)]` attribute, which is how the broker transport stays off
// mobile. The attribute holds no comma, so splitting the list on commas keeps it attached to
// the command it guards — and the guard is part of what this gate checks, not noise to strip.
// Comments are stripped from the WHOLE body before splitting, not from each fragment after:
// a prose comma inside a `//` line otherwise becomes a list separator and invents an entry.
const handlerEntries = source => balanced(source, 'tauri::generate_handler!', '[', ']')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => {
        const cfg = /^#\[\s*cfg\(([^)]*)\)\s*\]/.exec(entry);
        return {
            cfg: cfg ? cfg[1].trim() : null,
            name: entry.replace(/^#\[\s*cfg\([^)]*\)\s*\]/, '').trim().split('::').at(-1)
        };
    });

const manifestCommands = source => {
    assert.match(source, /tauri_build::try_build\s*\(/, 'fallible ACL generation must not be discarded');
    assert.match(source, /AppManifest::new\(\)\.commands\(commands\)/,
        'the generated app manifest must use the reviewed command selection');
    // The default manifest is APP_COMMANDS alone; the peer commands join it only when Cargo
    // builds the `peers` feature (CARGO_FEATURE_PEERS), and in no other way.
    assert.match(source,
        /let commands: &'static \[&'static str\] = if std::env::var_os\("CARGO_FEATURE_PEERS"\)\.is_some\(\) \{\s*Box::leak\(\[APP_COMMANDS, PEER_COMMANDS\]\.concat\(\)\.into_boxed_slice\(\)\)\s*\} else \{\s*APP_COMMANDS\s*\};/,
        'peer commands may enter the manifest only under the peers feature');
    return {
        app: stringArray(balanced(source, 'const APP_COMMANDS: &[&str] = &', '[', ']')),
        peers: stringArray(balanced(source, 'const PEER_COMMANDS: &[&str] = &', '[', ']'))
    };
};

const allowName = command => `allow-${command.replaceAll('_', '-')}`;
const allowsOf = capability => capability.permissions.filter(value => value.startsWith('allow-'));

// The dialog plugin's commands the editor may call. The plugin's own init script replaces
// window.alert (and window.confirm) with `plugin:dialog|message`, and lib/tauri-bridge.js asks
// questions through it; every file dialog is opened by the Rust side (src/fileio.rs,
// src/spike_image_chooser.rs), which the ACL does not gate, so `open` and `save` stay ungranted.
// `dialog:default` would grant all three.
const EDITOR_DIALOG_COMMANDS = ['message'];
const dialogCommandsInvoked = source =>
    uniqueSorted([...source.matchAll(/plugin:dialog\|([a-z_]+)/g)].map(match => match[1]));

const audit = ({handler, build, main, mobile, ack, runtime, peers, editor}) => {
    const all = handlerEntries(handler);
    // Peer sessions first: exactly the five reviewed commands, each behind the feature, each
    // in PEER_COMMANDS, none in any default grant, and granted only by peers.json.
    const peerEntries = all.filter(entry => entry.cfg === PEER_CFG);
    const {app: manifested, peers: manifestedPeers} = manifestCommands(build);
    assert.deepEqual(uniqueSorted(peerEntries.map(entry => entry.name)), uniqueSorted(PEER_COMMANDS),
        'exactly the reviewed peer commands are registered behind the peers feature');
    assert.deepEqual(all.filter(entry => entry.name.startsWith('peer_') && entry.cfg !== PEER_CFG), [],
        'no peer command may be registered outside the peers feature');
    assert.deepEqual(uniqueSorted(manifestedPeers), uniqueSorted(PEER_COMMANDS),
        'PEER_COMMANDS must name exactly the gated peer commands');
    assert.deepEqual(manifested.filter(name => PEER_COMMANDS.includes(name)), [],
        'the default manifest must not permit a peer command');
    const peerAllows = PEER_COMMANDS.map(allowName);
    for (const capability of [main, mobile, ack, ...runtime]) {
        assert.deepEqual(capability.permissions.filter(value => peerAllows.includes(value)), [],
            `${capability.identifier} must not grant a peer command`);
    }
    assert.deepEqual(uniqueSorted(peers.permissions), uniqueSorted(peerAllows),
        'peers.json grants exactly the peer commands');
    assert.deepEqual(peers.webviews, ['main'], 'peers.json targets the main webview only');
    assert.deepEqual(peers.windows || [], [], 'peers.json must not use window scope');
    assert.ok(/#\[cfg\(feature = "peers"\)\]\s*\{\s*use tauri::Manager;\s*app\.add_capability\(include_str!\("\.\.\/runtime-capabilities\/peers\.json"\)\)\?;/.test(handler),
        'peers.json may be added only by the feature-gated setup block');
    assert.equal((handler.match(/peers\.json/g) || []).length, 1, 'peers.json is added in one place');

    const entries = all.filter(entry => entry.cfg !== PEER_CFG);
    const registered = entries.map(entry => entry.name);
    assert.equal(registered.length, 44, 'review a deliberate command-count change');
    assert.equal(new Set(registered).size, registered.length, 'handler commands must be unique');
    assert.equal(new Set(manifested).size, manifested.length, 'manifest commands must be unique');
    assert.deepEqual(uniqueSorted(manifested), uniqueSorted(registered),
        'the app manifest must cover exactly every registered application command');

    const broker = entries.filter(entry => entry.name.startsWith(BROKER_PREFIX));
    const ordinary = entries.filter(entry => !entry.name.startsWith(BROKER_PREFIX));
    assert.ok(broker.length > 0, 'the broker transport must be registered by this checkpoint');
    // Mobile stays unregistered at COMPILE time, not merely ungranted: an ACL that forgot a
    // platform would still leave a callable command behind on a phone.
    for (const entry of broker) {
        assert.equal(entry.cfg, 'desktop', `${entry.name} must be registered only on desktop`);
    }
    for (const entry of ordinary) {
        assert.equal(entry.cfg, entry.name === 'update_editor_menu' ? 'desktop' : null, `${entry.name} registration platform`);
    }

    const brokerAllows = broker.map(entry => allowName(entry.name));
    const ordinaryAllows = ordinary.map(entry => allowName(entry.name));
    const mainAllows = allowsOf(main);
    assert.deepEqual(uniqueSorted(mainAllows), uniqueSorted(ordinaryAllows),
        'main must receive exactly the non-broker application-command permissions');
    assert.equal(mainAllows.length, ordinaryAllows.length, 'main grants must not be duplicated');
    // The whole point of the checkpoint: the editor window holds no transport permission, so a
    // compromised editor realm cannot reply on the broker's behalf or open a session at all.
    assert.deepEqual(mainAllows.filter(value => brokerAllows.includes(value)), [],
        'main must hold no broker transport permission');
    assert.deepEqual(mobile.permissions.filter(value =>
        ordinaryAllows.includes(value) || brokerAllows.includes(value)), [],
    'the additive mobile capability must duplicate no application-command grant');

    // Plugin grants, least privilege: the editor holds exactly the dialog commands it calls,
    // and no filesystem-plugin permission at all (project files are read and written by
    // fileio.rs, behind the application commands above).
    const editorDialog = dialogCommandsInvoked(editor);
    assert.deepEqual(editorDialog, EDITOR_DIALOG_COMMANDS,
        'the editor must call exactly the reviewed dialog commands');
    assert.deepEqual(main.permissions.filter(value => value.startsWith('dialog:')),
        editorDialog.map(command => `dialog:allow-${command.replaceAll('_', '-')}`),
        'main must grant exactly the dialog commands the editor calls, not a dialog:* set');
    assert.deepEqual(main.permissions.filter(value => value.startsWith('fs:')), [],
        'main must not grant the filesystem plugin');
    for (const capability of [mobile, ack, ...runtime]) {
        assert.deepEqual(capability.permissions.filter(value => /^(?:fs|dialog):/.test(value)), [],
            `${capability.identifier} must not grant the dialog or filesystem plugin`);
    }

    // Startup grants only the acknowledgement, and only to the broker webview.
    assert.deepEqual(ack.webviews, [BROKER_WEBVIEW], 'the ack capability must target the broker webview');
    assert.deepEqual(ack.windows || [], [], 'window scope would reach every child webview');
    assert.deepEqual(ack.permissions, [allowName(ACK_COMMAND)],
        'the only startup broker grant is the acknowledgement itself');

    // The transport halves are runtime-only and disjoint.
    const runtimeAllows = runtime.flatMap(allowsOf);
    assert.deepEqual(uniqueSorted(runtimeAllows),
        uniqueSorted(brokerAllows.filter(value => value !== allowName(ACK_COMMAND))),
        'the runtime capabilities must cover exactly the transport commands, ack excluded');
    assert.equal(new Set(runtimeAllows).size, runtimeAllows.length,
        'no transport permission may be granted twice');
    for (const capability of runtime) {
        assert.equal((capability.webviews || []).length, 1,
            `${capability.identifier} must target exactly one webview`);
        assert.deepEqual(capability.windows || [], [],
            `${capability.identifier} must not use window scope`);
        assert.deepEqual(capability.platforms, ['linux', 'macOS', 'windows'],
            `${capability.identifier} must stay desktop-only`);
    }
    const byWebview = new Map(runtime.map(capability => [capability.webviews[0], allowsOf(capability)]));
    assert.deepEqual(uniqueSorted([...byWebview.keys()]), uniqueSorted(['main', BROKER_WEBVIEW]),
        'exactly two disjoint halves must exist: the editor and the broker');
    const mainHalf = byWebview.get('main');
    const brokerHalf = byWebview.get(BROKER_WEBVIEW);
    assert.deepEqual(mainHalf.filter(value => brokerHalf.includes(value)), [],
        'the two transport halves must be disjoint');
    assert.ok(!mainHalf.includes('allow-native-broker-reply'),
        'the editor must never be able to reply on the broker path');
    assert.ok(!brokerHalf.includes('allow-native-broker-open') &&
        !brokerHalf.includes('allow-native-broker-request'),
    'the broker must never be able to open or drive a session');
    // D1: the semantic pair is broker-scoped like everything else that can reach native work.
    // The editor holding either would make the lease meaningless, because it could mint its own.
    for (const semantic of ['allow-native-broker-lease', 'allow-native-broker-invoke']) {
        assert.ok(brokerHalf.includes(semantic), `${semantic} must be granted to the broker`);
        assert.ok(!mainHalf.includes(semantic), `${semantic} must never reach the editor`);
    }
    // D2: diagnostics are a READ and belong to the editor, which is where they render. The
    // broker must NOT hold them — it has no surface to render on, so a grant there would be
    // authority with no purpose, which is how a read becomes a channel.
    assert.ok(mainHalf.includes('allow-native-broker-audit'),
        'the editor must be able to read its own diagnostics');
    assert.ok(!brokerHalf.includes('allow-native-broker-audit'),
        'the broker must not hold the diagnostics read');
};

const readJson = file => JSON.parse(readFileSync(file, 'utf8'));
// Every editor source the main webview runs (overlay is the source of truth).
const editorSources = () => ['overlay/scratch-gui/src', 'overlay/scratch-vm/src']
    .flatMap(dir => readdirSync(path.join(root, dir), {recursive: true})
        .filter(file => /\.(?:js|jsx|mjs|ts)$/.test(file))
        .map(file => readFileSync(path.join(root, dir, file), 'utf8')))
    .join('\n');
const live = () => ({
    handler: readFileSync(path.join(native, 'src/lib.rs'), 'utf8'),
    build: readFileSync(path.join(native, 'build.rs'), 'utf8'),
    main: readJson(path.join(native, 'capabilities/default.json')),
    mobile: readJson(path.join(native, 'capabilities/mobile.json')),
    ack: readJson(path.join(native, 'capabilities/native-broker-ack.json')),
    runtime: ['native-broker-main', 'native-capability-broker']
        .map(name => readJson(path.join(native, `runtime-capabilities/${name}.json`))),
    peers: readJson(path.join(native, 'runtime-capabilities/peers.json')),
    editor: editorSources()
});

test('Tauri application-command manifest and main grants exactly match generate_handler', () => {
    audit(live());
});

test('Tauri application-command ACL rejects omissions, extras, and mobile duplication', () => {
    const mutations = [
        input => { input.main.permissions = input.main.permissions.filter(value => value !== 'allow-update-editor-menu'); },
        input => { input.build = input.build.replace('        "update_editor_menu",\n', ''); },
        input => { input.handler = input.handler.replace('#[cfg(desktop)]\n            editor_menu::update_editor_menu', 'editor_menu::update_editor_menu'); },
        input => { input.build = input.build.replace('        "save_project",\n', ''); },
        input => { input.build = input.build.replace('        "save_project",', '        "invented_command",'); },
        input => { input.main.permissions = input.main.permissions.filter(value => value !== 'allow-save-project'); },
        input => { input.main.permissions.push('allow-invented-command'); },
        input => { input.mobile.permissions.push('allow-save-project'); },
        // Native project documents (E4).
        input => { input.main.permissions = input.main.permissions.filter(value => value !== 'allow-save-project-document'); },
        input => { input.build = input.build.replace('        "open_recent_project",\n', ''); },
        // Dialog / filesystem plugin least privilege.
        input => { input.main.permissions = input.main.permissions.map(value =>
            (value === 'dialog:allow-message' ? 'dialog:default' : value)); },
        input => { input.main.permissions.push('dialog:allow-open'); },
        input => { input.main.permissions.push('dialog:allow-save'); },
        input => { input.main.permissions = input.main.permissions.filter(value => value !== 'dialog:allow-message'); },
        input => { input.main.permissions.push('fs:default'); },
        input => { input.mobile.permissions.push('dialog:allow-open'); },
        input => { input.runtime[0].permissions.push('fs:allow-read-file'); },
        input => { input.editor += "\ninvoke('plugin:dialog|open', {});"; },
        input => { input.editor = input.editor.replaceAll('plugin:dialog|message', 'plugin:opener|open_url'); },
        // The broker-specific half of the contract.
        input => { input.main.permissions.push('allow-native-broker-request'); },
        input => { input.main.permissions.push('allow-native-broker-reply'); },
        input => { input.mobile.permissions.push('allow-native-broker-request'); },
        input => { input.handler = input.handler.replace(
            '#[cfg(desktop)]\n            native_broker_adapter::native_broker_request', 
            'native_broker_adapter::native_broker_request'); },
        input => { input.ack.permissions.push('allow-native-broker-request'); },
        input => { input.ack.webviews = ['main']; },
        input => { input.ack.windows = ['main']; },
        input => { input.runtime[0].webviews = ['capability-broker']; },
        input => { input.runtime[0].permissions.push('allow-native-broker-reply'); },
        input => { input.runtime[1].permissions.push('allow-native-broker-open'); },
        input => { input.runtime[0].windows = ['main']; },
        input => { input.runtime[0].platforms = ['linux', 'macOS', 'windows', 'android']; },
        input => { input.runtime[1].permissions = []; },
        input => { input.runtime[0].permissions.push('allow-native-broker-invoke'); },
        input => { input.runtime[0].permissions.push('allow-native-broker-lease'); },
        input => { input.runtime[1].permissions =
            input.runtime[1].permissions.filter(p => p !== 'allow-native-broker-invoke'); },
        input => { input.runtime[1].permissions.push('allow-native-broker-audit'); },
        input => { input.runtime[0].permissions =
            input.runtime[0].permissions.filter(p => p !== 'allow-native-broker-audit'); },
        // Peer sessions (E11): off unless the feature is built.
        input => { input.main.permissions.push('allow-peer-send'); },
        input => { input.mobile.permissions.push('allow-peer-enable'); },
        input => { input.build = input.build.replace('        "scratchlink_bridge_close",',
            '        "scratchlink_bridge_close",\n        "peer_send",'); },
        input => { input.build = input.build.replace('if std::env::var_os("CARGO_FEATURE_PEERS").is_some()',
            'if true'); },
        input => { input.handler = input.handler.replace(
            '#[cfg(feature = "peers")]\n            peer::peer_send', 'peer::peer_send'); },
        input => { input.handler = input.handler.replace(
            '#[cfg(feature = "peers")]\n            {\n                use tauri::Manager;',
            '{\n                use tauri::Manager;'); },
        input => { input.peers.permissions.push('allow-save-project'); },
        input => { input.peers.webviews = ['main', 'capability-broker']; },
        input => { input.build = input.build.replace('        "peer_reply",\n', ''); }
    ];
    const base = live();
    for (const mutate of mutations) {
        const input = structuredClone(base);
        mutate(input);
        assert.throws(() => audit(input), `mutation did not turn the gate red`);
    }
});
