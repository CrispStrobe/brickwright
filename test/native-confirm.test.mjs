// Task E6 of docs/OPEN-TASKS-2026-09-29.md: in the desktop/iOS app every "are you sure?"
// answered yes by itself.
//
// THE MECHANISM (tauri-plugin-dialog 2.7.1, the crates.io package Cargo.lock pins by checksum
// 65981abb…): src/lib.rs injects `init-iife.js` (source guest-js/init.ts) on every platform but
// Android, and that script does
//     window.alert   = function (message) { void invoke('plugin:dialog|message', {message}) }
//     window.confirm = async function (message) { return await invoke('plugin:dialog|confirm', …) }
// An async function returns a Promise, and a Promise is truthy, so `if (confirm(q))` always
// went ahead, and `if (!confirm(q)) return;` never returned. 2.7.1 does not even register a
// `confirm` command (generate_handler![open, save, message]), so the Promise rejects without
// showing a dialog. `window.prompt` is not replaced.
//
// THE FIX: lib/native-dialog.js `confirmAsync` — a native OK/Cancel box through
// `plugin:dialog|message` in the app, the browser's confirm elsewhere — awaited at every site.
//
// This file holds three things:
//   1. the helper answers a strict boolean, and only OK is yes;
//   2. every converted call site, driven from its REAL source with the app simulated (the
//      plugin's confirm installed, `__TAURI__.core.invoke` answering the message box), does not
//      proceed on Cancel and does on OK — and the same driver with the site reverted to
//      `confirm(...)` goes red;
//   3. a census of every confirm() call in the sources the app ships: a new direct use of
//      `confirm(...)` anywhere turns this red, naming file and line.
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync, statSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
import {registeredArraysSource, renderRegisteredArraysCarrier} from '../scripts/lib/arrays-carrier.mjs';
import {codeDocumentEditorClass} from './helpers/code-document-editor.mjs';

import {blinkFamily} from '../overlay/scratch-gui/src/lib/bw-asm/blink-machines.js';

const root = path.resolve(import.meta.dirname, '..');
const read = file => readFileSync(path.join(root, file), 'utf8');
const guiRequire = createRequire(path.join(root, 'packages/scratch-gui/package.json'));
const babel = guiRequire('@babel/core');
const presetReact = guiRequire.resolve('@babel/preset-react');

const HELPER = 'overlay/scratch-gui/src/lib/native-dialog.js';
const loadHelper = async (source = read(HELPER)) =>
    import(`data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`);

// ---------------------------------------------------------------------------------------------
// The simulated app. `answer` is what the native message box returns ('Ok' / 'Cancel').
// ---------------------------------------------------------------------------------------------
const installApp = answer => {
    const calls = [];
    const invoke = (command, args) => {
        calls.push({command, args});
        if (command === 'plugin:dialog|message') return Promise.resolve(answer);
        // tauri-plugin-dialog 2.7.1 registers no `confirm` command.
        return Promise.reject(new Error(`command ${command} not found`));
    };
    globalThis.window = globalThis;
    globalThis.__TAURI__ = {core: {invoke}};
    // The plugin's init script, verbatim in behaviour (guest-js/init.ts).
    globalThis.alert = function (message) { void invoke('plugin:dialog|message', {message: String(message)}); };
    globalThis.confirm = function (message) {
        const answer = (async () => await invoke('plugin:dialog|confirm', {message: String(message)}))();
        // Same truthy, rejecting Promise; marked handled so a reverted site that drops it does
        // not end the test run with an unhandled rejection.
        answer.catch(() => {});
        return answer;
    };
    return calls;
};
const installBrowser = answer => {
    const calls = [];
    globalThis.window = globalThis;
    delete globalThis.__TAURI__;
    globalThis.confirm = message => { calls.push(message); return answer; };
    return calls;
};
const uninstall = () => {
    for (const key of ['__TAURI__', 'confirm', 'alert', 'window']) delete globalThis[key];
};

// ---------------------------------------------------------------------------------------------
// Real-source extraction: a class method, a function, or a property value, by name, evaluated
// with its module-scope names supplied (everything else resolves to the global, i.e. the app).
// ---------------------------------------------------------------------------------------------
const parse = (source, filename) => babel.parseSync(source, {
    filename, babelrc: false, configFile: false, sourceType: 'module',
    parserOpts: {plugins: ['jsx'], errorRecovery: true}
});
const find = (file, predicate, label, source = read(file)) => {
    const found = [];
    babel.traverse(parse(source, file), {
        enter (nodePath) { if (predicate(nodePath.node, nodePath)) found.push(nodePath.node); }
    });
    assert.equal(found.length, 1, `${file}: expected exactly one ${label}, found ${found.length}`);
    return source.slice(found[0].start, found[0].end);
};
const methodSource = (file, name, source) => find(file,
    node => node.type === 'ClassMethod' && node.key.name === name, `method ${name}`, source);
const functionSource = (file, name, source) => find(file,
    node => (node.type === 'FunctionDeclaration' && node.id && node.id.name === name),
    `function ${name}`, source);
const constSource = (file, name, source) => {
    const decl = find(file, node => node.type === 'VariableDeclarator' && node.id.name === name,
        `const ${name}`, source);
    return decl.slice(decl.indexOf('=') + 1).trim();
};
// A property of the object assigned to `<Class>.defaultProps`.
const defaultPropSource = (file, name, source) => {
    const prop = find(file, (node, nodePath) => node.type === 'ObjectProperty' && node.key.name === name &&
        nodePath.parentPath.parentPath.isAssignmentExpression() &&
        nodePath.parentPath.parentPath.node.left.property &&
        nodePath.parentPath.parentPath.node.left.property.name === 'defaultProps',
    `defaultProps.${name}`, source);
    return prop.slice(prop.indexOf(':') + 1).trim();
};
const evaluate = (expression, scope) => {
    const js = babel.transformSync(`(${expression});`, {
        babelrc: false, configFile: false, presets: [[presetReact, {runtime: 'classic'}]]
    }).code.trim().replace(/;$/, '');
    // eslint-disable-next-line no-new-func
    return new Function('__scope', `with (__scope) { return ${js}; }`)(scope);
};
const asMethod = (text, scope) => {
    const name = text.replace(/^async\s+/, '').match(/^([A-Za-z_$][\w$]*)/)[1];
    return evaluate(`{${text}}`, scope)[name];
};
const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(r => setTimeout(r, 0)); };

// ---------------------------------------------------------------------------------------------
// The call sites. Each driver runs the site's real code and returns whether it went ahead.
// `reverts`: rewrites that put a site back to using the value of confirm() (mutations below).
// ---------------------------------------------------------------------------------------------
const MENU_BAR = 'overlay/scratch-gui/src/components/menu-bar/menu-bar.jsx';
const MENU_HOC = 'overlay/scratch-gui/src/containers/menu-bar-hoc.jsx';
const UPLOADER = 'overlay/scratch-gui/src/lib/sb-file-uploader-hoc.jsx';
const CIRCUIT = 'overlay/scratch-gui/src/components/tw-pseudocode/circuit-tab.jsx';
const IMPORTER = 'overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx';
const EXT_LIBRARY = 'overlay/scratch-gui/src/containers/extension-library.jsx';
const URL_EXT = 'overlay/scratch-gui/src/lib/url-extensions.js';
const BT_SHIM = 'overlay/scratch-gui/src/lib/virtual-hub/web-bluetooth-shim.js';
const BLOCKS = 'overlay/scratch-gui/src/containers/blocks.jsx';
const TERMINAL = 'overlay/scratch-gui/src/components/tw-pseudocode/linux-terminal.jsx';

const SITES = [
    {
        name: 'File > New (menu-bar handleClickNew + menu-bar-hoc confirmReadyToReplaceProject)',
        files: [MENU_BAR, MENU_HOC],
        reverts: [
            {[MENU_HOC]: s => s.replace('message => confirmAsync(message)', 'message => confirm(message)')},
            // the original, synchronous pair
            {[MENU_HOC]: s => s.replace('message => confirmAsync(message)', 'message => confirm(message)')
                .replace('async confirmReadyToReplaceProject', 'confirmReadyToReplaceProject')
                .replace('return (await this.props.confirmWithMessage(message)) === true;',
                    'return this.props.confirmWithMessage(message);'),
            [MENU_BAR]: s => s.replace('const readyToReplaceProject = await this.props.confirmReadyToReplaceProject(',
                'const readyToReplaceProject = this.props.confirmReadyToReplaceProject(')
                .replace('if (readyToReplaceProject === true) {', 'if (readyToReplaceProject) {')}
        ],
        async drive (helper, src) {
            let replaced = false;
            const hocScope = {confirmAsync: helper.confirmAsync};
            const hoc = {props: {projectChanged: true, canCreateNew: false,
                confirmWithMessage: evaluate(defaultPropSource(MENU_HOC, 'confirmWithMessage', src[MENU_HOC]), hocScope)}};
            hoc.confirmReadyToReplaceProject = asMethod(
                methodSource(MENU_HOC, 'confirmReadyToReplaceProject', src[MENU_HOC]), hocScope).bind(hoc);
            const bar = {props: {
                intl: {formatMessage: () => 'Replace the current project?'},
                confirmReadyToReplaceProject: hoc.confirmReadyToReplaceProject,
                onRequestCloseFile () {},
                onClickNew () { replaced = true; },
                canSave: false, canCreateNew: false
            }};
            const handleClickNew = asMethod(methodSource(MENU_BAR, 'handleClickNew', src[MENU_BAR]), {
                sharedMessages: {replaceProjectWarning: {}}, clearActiveLms () {}
            });
            await handleClickNew.call(bar);
            await settle();
            return replaced;
        }
    },
    {
        name: 'File > Load from your computer (sb-file-uploader-hoc handleChange)',
        files: [UPLOADER],
        reverts: [{[UPLOADER]: s => s.replace('await confirmAsync(', 'confirm(')
            .replace('if (uploadAllowed === true) {', 'if (uploadAllowed) {')}],
        async drive (helper, src) {
            let uploaded = false;
            const self = {
                props: {intl: {formatMessage: () => 'Replace?'}, isShowingWithoutId: true,
                    projectChanged: true, userOwnsProject: false, loadingState: 'SHOWING_WITHOUT_ID',
                    requestProjectUpload () { uploaded = true; }, closeFileMenu () {}},
                removeFileObjects () {}
            };
            const handleChange = asMethod(methodSource(UPLOADER, 'handleChange', src[UPLOADER]), {
                confirmAsync: helper.confirmAsync, sharedMessages: {replaceProjectWarning: {}}
            });
            await handleChange.call(self, {target: {files: [{name: 'other.sb3'}]}});
            await settle();
            return uploaded;
        }
    },
    {
        name: 'Circuit tab program-only starter (circuit-tab loadProgramOnlyStarter)',
        files: [CIRCUIT],
        reverts: [{[CIRCUIT]: s => s.replace('if (!(await confirmAsync(message, {unavailable: true}))) return',
            'if (!confirm(message)) return')}],
        async drive (helper, src) {
            let loaded = false;
            const self = {
                setState () {}, readStc () {}, publishExampleTitle () {},
                async loadExampleProgram () { loaded = true; throw new Error('stop here'); }
            };
            const load = asMethod(methodSource(CIRCUIT, 'loadProgramOnlyStarter', src[CIRCUIT]), {
                confirmAsync: helper.confirmAsync
            });
            const result = await load.call(self, {id: 'lego-starter', files: {}}).catch(error => ({error}));
            if (!loaded) assert.deepEqual(result, {ok: false, cancelled: true});
            return loaded;
        }
    },
    {
        name: 'Circuit tab example with a program (circuit-tab loadExample)',
        files: [CIRCUIT],
        reverts: [{[CIRCUIT]: s => s.replace('const ok = await confirmAsync(msg, {unavailable: true});',
            'const ok = confirm(msg);')}],
        async drive (helper, src) {
            let loading = false;
            const self = {setState (state) { if (state && state.loadingExample) loading = true; }};
            const load = asMethod(methodSource(CIRCUIT, 'loadExample', src[CIRCUIT]), {
                confirmAsync: helper.confirmAsync, normalizeDeviceId: () => null,
                noCircuitMessage: () => ({}),
                fetch: () => Promise.reject(new Error('stop here'))
            });
            const result = await load.call(self, {id: 'blink', files: {circuit: 'c.json', program: 'p.txt'}})
                .catch(error => ({error}));
            if (!loading) assert.deepEqual(result, {ok: false, cancelled: true});
            return loading;
        }
    },
    ...[
        ['ASM example over typed assembly (pseudocode-importer loadAsmExample)', 'loadAsmExample', 'asm'],
        ['RISC-V C example over typed C (pseudocode-importer loadRiscvCExample)', 'loadRiscvCExample', 'c'],
        ['Arduino sketch over typed C (pseudocode-importer loadArduinoSketchExample)', 'loadArduinoSketchExample', 'c']
    ].map(([name, method, buffer]) => ({
        name,
        files: [IMPORTER],
        reverts: [{[IMPORTER]: s => s.replace(
            new RegExp(`(async ${method} \\(id\\) \\{[\\s\\S]*?)!\\(await confirmAsync\\(this\\.L\\.asmExampleReplace\\)\\)`),
            '$1!window.confirm(this.L.asmExampleReplace)')}],
        async drive (helper, src) {
            const current = 'twenty minutes of typing';
            const examples = () => [{id: 'ex', source: 'NEW', label: 'Example'}];
            // The loaders now author a Code document. Exercise their real
            // document adapters, including functional setState, rather than
            // counting any update as a successful source replacement.
            const Editor = codeDocumentEditorClass(src[IMPORTER],
                methodSource(IMPORTER, method, src[IMPORTER]), {
                    confirmAsync: helper.confirmAsync, pickLocale: () => 'en',
                    riscvCExamplesFor: examples, arduinoSketchExamplesFor: examples, blinkFamily
                });
            const self = new Editor();
            self.props = {locale: 'en'};
            self.L = {asmExampleReplace: 'Replace?', asmExampleLoaded: () => 'loaded'};
            self._asmExamples = examples;
            const device = method === 'loadRiscvCExample' ? 'riscv32' : buffer === 'asm' ? 'i8086' : 'arduino-uno';
            self.currentDevice = () => device;
            self.state = {lang: buffer, buffers: {[buffer]: current}};
            self.state = {...self.state, ...self.authoredCodeState(buffer, current, device)};
            self.setState = update => {
                const patch = typeof update === 'function' ? update(self.state) : update;
                self.state = {...self.state, ...patch};
            };
            await self[method]('ex');
            await settle();
            const replaced = self.state.buffers[buffer] === 'NEW';
            assert.equal(self.state.buffers[buffer], replaced ? 'NEW' : current);
            assert.equal(self.state.codeDocument.lang, buffer);
            assert.equal(self.state.codeDocument.code, replaced ? 'NEW' : current);
            assert.equal(self.state.codeDocument.target, device);
            return replaced;
        }
    })),
    {
        name: 'Extension from an untrusted URL (extension-library handleItemSelect)',
        files: [EXT_LIBRARY],
        reverts: [{[EXT_LIBRARY]: s => s.replace('if (!(await confirmAsync(this.msg(', 'if (!(confirm(this.msg(')}],
        async drive (helper, src) {
            let loaded = false;
            const self = {
                props: {vm: {extensionManager: {
                    isTrustedExtensionURL: () => false, pinStatusFor: () => 'foreign',
                    isExtensionLoaded: () => false,
                    loadExtensionURL () { loaded = true; return Promise.resolve(); }
                }}, onCategorySelected () {}, onRequestClose () {}},
                msg: () => 'Run code from this address?'
            };
            const select = asMethod(methodSource(EXT_LIBRARY, 'handleItemSelect', src[EXT_LIBRARY]), {
                confirmAsync: helper.confirmAsync, getLegacySpikeVisible: () => true,
                messages: {unpinned: {}, untrusted: {}, loadFailed: {}}
            });
            await select.call(self, {extensionId: 'foreign', extensionURL: 'https://example.invalid/x.js'});
            await settle();
            return loaded;
        }
    },
    {
        name: '?extension=<untrusted url> deep link (url-extensions initUrlExtensions)',
        files: [URL_EXT],
        reverts: [{[URL_EXT]: s => s.replace('const ok = await confirmAsync(', 'const ok = window.confirm(')}],
        async drive (helper, src) {
            let loaded = false;
            const vm = {extensionManager: {isTrustedExtensionURL: () => false,
                loadExtensionURL () { loaded = true; return Promise.resolve(); }}};
            const init = evaluate(functionSource(URL_EXT, 'initUrlExtensions', src[URL_EXT]), {
                confirmAsync: helper.confirmAsync, remoteExtensionsAllowed: () => true,
                collectUrls: () => ['https://example.invalid/x.js'], waitForVm: () => Promise.resolve(vm)
            });
            init();
            await settle();
            return loaded;
        }
    },
    {
        name: 'Virtual vs real Bluetooth device (web-bluetooth-shim chooseVirtual)',
        files: [BT_SHIM],
        reverts: [{[BT_SHIM]: s => s.replace('if (await confirmAsync(`Connect', 'if (globalThis.confirm(`Connect')}],
        async drive (helper, src) {
            const choose = evaluate(constSource(BT_SHIM, 'chooseVirtual', src[BT_SHIM]), {
                confirmAsync: helper.confirmAsync
            });
            const virtual = {name: 'Virtual hub'};
            return (await choose([virtual], true)) === virtual;
        }
    },
    {
        name: 'Clicking a link the guest printed in the Linux terminal (linux-terminal openTerminalLink)',
        files: [TERMINAL],
        reverts: [{[TERMINAL]: s => s.replace('const go = await confirmAsync(', 'const go = confirm(')}],
        async drive (helper, src) {
            const opened = [];
            globalThis.open = () => {
                const target = {location: {}};
                opened.push(target);
                return target;
            };
            try {
                const open = evaluate(constSource(TERMINAL, 'openTerminalLink', src[TERMINAL]), {
                    confirmAsync: helper.confirmAsync
                });
                await open({}, 'https://example.invalid/');
            } finally {
                delete globalThis.open;
            }
            if (opened.length) assert.equal(opened[0].location.href, 'https://example.invalid/');
            return opened.length === 1;
        }
    }
];

// `revert`: the index of one of the site's reverts (each maps file -> source rewrite), or null.
const sourcesFor = (site, revert = null) => {
    const src = {};
    for (const file of site.files) {
        src[file] = read(file);
        const rewrite = revert === null ? null : site.reverts[revert][file];
        if (rewrite) {
            const before = src[file];
            src[file] = rewrite(before);
            assert.notEqual(src[file], before, `${site.name}: the revert mutation did not apply to ${file}`);
        }
    }
    return src;
};
// The claim for one site: Cancel never proceeds, OK always does, in the app and in the browser.
// A driver that throws reports `threw: ...`, which is neither answer, so the claim fails by name.
const holds = async (site, helper, src) => {
    const run = async () => {
        try { return await site.drive(helper, src); } catch (error) { return `threw: ${error.message}`; }
    };
    const said = value => (value === true ? 'went ahead' : value === false ? 'did not go ahead' : value);
    const expect = async (expected, when) => {
        const value = await run();
        assert.equal(value, expected, `${site.name}: ${when}, it ${said(value)}`);
    };
    try {
        installApp('Cancel');
        await expect(false, 'on Cancel in the app');
        installApp('Ok');
        await expect(true, 'on OK in the app');
        installBrowser(false);
        await expect(false, 'on Cancel in the browser');
        installBrowser(true);
        await expect(true, 'on OK in the browser');
    } finally {
        uninstall();
    }
};
const redFor = async (promise, label, reasons) => {
    await assert.rejects(promise, error => {
        assert.ok(error instanceof assert.AssertionError, `${label}: crashed instead of failing the claim: ${error}`);
        reasons.push(`${label} -> ${error.message.split('\n')[0]}`);
        return true;
    }, `${label}: did not turn the driver red`);
};

test('confirmAsync: a strict boolean, only OK is yes, in the app and in the browser', async () => {
    const {confirmAsync, nativeMessage, blocklyConfirm} = await loadHelper();
    try {
        let calls = installApp('Cancel');
        assert.equal(await confirmAsync('Replace?'), false);
        assert.deepEqual(calls, [{command: 'plugin:dialog|message',
            args: {message: 'Replace?', kind: 'warning', buttons: 'OkCancel'}}],
        'the app asks through the granted message command with OK and Cancel, never plugin confirm');
        installApp('Ok');
        assert.equal(await confirmAsync('Replace?'), true);
        for (const odd of [undefined, null, 'Yes', 'Cancel', true, 'ok']) {
            installApp(odd);
            assert.equal(await confirmAsync('Replace?'), false, `the answer ${JSON.stringify(odd)} is not OK`);
        }
        calls = installApp('Ok');
        globalThis.__TAURI__.core.invoke = () => Promise.reject(new Error('denied by the ACL'));
        const errors = [];
        const consoleError = console.error;
        console.error = (...args) => errors.push(args);
        try {
            assert.equal(await confirmAsync('Replace?'), false, 'a failed dialog is a No');
        } finally { console.error = consoleError; }
        assert.equal(errors.length, 1, 'a failed dialog is reported');
        installApp('Ok');
        assert.equal(await nativeMessage('Saved elsewhere.'), true, 'an OK-only message resolves after OK');

        calls = installBrowser(false);
        assert.equal(await confirmAsync('Replace?'), false);
        assert.deepEqual(calls, ['Replace?']);
        installBrowser(true);
        assert.equal(await confirmAsync('Replace?'), true);
        // A replaced confirm with no __TAURI__ (any shim that returns a Promise): awaited, strict.
        globalThis.confirm = async () => true;
        assert.equal(await confirmAsync('Replace?'), true);
        globalThis.confirm = async () => 'yes';
        assert.equal(await confirmAsync('Replace?'), false);
        globalThis.confirm = () => Promise.reject(new Error('command confirm not found'));
        assert.equal(await confirmAsync('Replace?'), false, 'the 2.7.1 plugin confirm (rejects) is a No');
        delete globalThis.confirm;
        assert.equal(await confirmAsync('Replace?'), false, 'no way to ask: no consent by default');
        assert.equal(await confirmAsync('Replace?', {unavailable: true}), true);

        const answers = [];
        installApp('Cancel');
        await blocklyConfirm('Delete 12 blocks?', ok => answers.push(ok));
        installApp('Ok');
        await blocklyConfirm('Delete 12 blocks?', ok => answers.push(ok));
        assert.deepEqual(answers, [false, true], 'scratch-blocks callbacks receive a real boolean');
    } finally {
        uninstall();
    }
});

test('the 2.7.1 plugin confirm is what made every site say yes', async () => {
    // The precondition the site drivers rely on: with the plugin installed, the raw value of
    // `confirm(...)` is truthy even when the user would have said No.
    try {
        installApp('Cancel');
        const raw = globalThis.confirm('Replace?');
        assert.ok(raw, 'the plugin confirm returns a truthy value');
        assert.equal(typeof raw.then, 'function', 'and that value is a Promise');
        await assert.rejects(raw, /command plugin:dialog\|confirm not found/);
    } finally {
        uninstall();
    }
});

for (const site of SITES) {
    test(`does not proceed on Cancel, does on OK: ${site.name}`, async () => {
        await holds(site, await loadHelper(), sourcesFor(site));
    });
}

test('each site driver turns red when its site is reverted to confirm(...)', async t => {
    const helper = await loadHelper();
    const reasons = [];
    for (const site of SITES) {
        for (let index = 0; index < site.reverts.length; index++) {
            await redFor(holds(site, helper, sourcesFor(site, index)), `${site.name} revert #${index}`, reasons);
        }
    }
    // The defect itself: a site reverted to the raw value goes ahead on Cancel in the app.
    assert.ok(reasons.filter(reason => /on Cancel in the app, it went ahead/.test(reason)).length >= SITES.length,
        reasons.join('\n'));
    for (const reason of reasons) t.diagnostic(reason);
});

test('a helper that hands back the raw confirm value turns the drivers red', async t => {
    const source = read(HELPER);
    const raw = source.replace(
        'nativeInvoke() ? nativeMessage(message, true) : browserConfirm(message, unavailable)',
        'window.confirm(message)');
    assert.notEqual(raw, source, 'the helper mutation did not apply');
    const helper = await loadHelper(raw);
    const reasons = [];
    for (const site of SITES) await redFor(holds(site, helper, sourcesFor(site)), `${site.name} (raw helper)`, reasons);
    for (const reason of reasons) t.diagnostic(reason);
});

test("the Linux terminal replaces xterm's confirm-based default link handler", () => {
    const source = read(TERMINAL);
    const options = find(TERMINAL, node => node.type === 'NewExpression' && node.callee.name === 'Terminal',
        'new Terminal(...)', source);
    assert.match(options, /linkHandler: \{activate: openTerminalLink\}/,
        "without a linkHandler xterm's OSC 8 links go through its own `if (confirm(...)) window.open()`");
    // ...and that default is what the ledger's @xterm/xterm entry stands for.
    const xterm = readFileSync(guiRequire.resolve('@xterm/xterm'), 'utf8');
    assert.match(xterm, /activate:\(\w+,\w+\)=>\w+\?\w+\.activate\(\w+,\w+,\w+\):\w+\(\w+,\w+\)/,
        'xterm uses the default handler only when no linkHandler is set');
});

test('scratch-blocks asks through the awaited helper (blocks.jsx installs it in both places)', () => {
    const source = read(BLOCKS);
    const installs = [];
    babel.traverse(parse(source, BLOCKS), {
        AssignmentExpression (nodePath) {
            const {left, right} = nodePath.node;
            if (left.type === 'MemberExpression' && left.property.name === 'confirm' &&
                source.slice(left.object.start, left.object.end) === 'this.ScratchBlocks') {
                const method = nodePath.findParent(p => p.isClassMethod());
                installs.push(`${method && method.node.key.name}:${source.slice(right.start, right.end)}`);
            }
        }
    });
    // The constructor sets it on the placeholder, componentDidMount on the loaded ScratchBlocks
    // (the same two places as ScratchBlocks.prompt).
    assert.deepEqual(installs.sort(), ['componentDidMount:blocklyConfirm', 'constructor:blocklyConfirm']);
    assert.match(source, /import \{blocklyConfirm\} from '\.\.\/lib\/native-dialog\.js';/);
});

// ---------------------------------------------------------------------------------------------
// The census: every confirm() CALL in the sources the app ships.
// ---------------------------------------------------------------------------------------------

// Lite's shipped trees: integrate.mjs copies overlay/scratch-gui over packages/scratch-gui, and
// apply-{vm,paint}-overlay.mjs copy overlay/scratch-{vm,paint} over the installed packages, so a
// path present in both ships the overlay copy.
const GUI_MODULES = 'packages/scratch-gui/node_modules';
const LITE_TREES = [
    ['overlay/scratch-gui/src', 'packages/scratch-gui/src'],
    ['overlay/scratch-vm/src', `${GUI_MODULES}/scratch-vm/src`],
    ['overlay/scratch-paint/src', `${GUI_MODULES}/scratch-paint/src`]
];
const SOURCE_FILE = /\.(?:js|jsx|mjs|cjs)$/;
const NOT_SHIPPED_DIR = /\/(?:test|tests|__tests__|spec|specs|docs?|examples?|demo|playground|benchmarks?|node_modules)\//;
const walk = (dir, filter = () => true) => {
    const abs = path.join(root, dir);
    if (!existsSync(abs)) return [];
    return readdirSync(abs, {recursive: true})
        .map(file => path.join(dir, String(file)).split(path.sep).join('/'))
        .filter(file => SOURCE_FILE.test(file) && filter(file) && statSync(path.join(root, file)).isFile());
};
const shippedFiles = () => {
    const files = new Map();
    LITE_TREES.forEach(([overlay, base], tree) => {
        for (const file of walk(base)) files.set(`${tree}${file.slice(base.length)}`, file);
        for (const file of walk(overlay)) files.set(`${tree}${file.slice(overlay.length)}`, file);
    });
    return [...files.values()].sort();
};
// Third-party code the GUI bundles: the production-dependency closure of scratch-gui's
// package.json (an over-approximation: a build-time dependency's files are counted too, and
// the ledger says which). scratch-vm and scratch-paint are walked above, with their overlays.
const dependencyPackages = () => {
    const manifest = file => JSON.parse(readFileSync(path.join(root, file), 'utf8'));
    // cat-blocks: webpack.config.js aliases it to scratch-blocks (held below), so it never ships.
    const seen = new Set(['scratch-vm', 'scratch-paint', 'cat-blocks']);
    const queue = Object.keys(manifest('packages/scratch-gui/package.json').dependencies || {});
    const found = [];
    while (queue.length) {
        const name = queue.pop();
        if (seen.has(name)) continue;
        seen.add(name);
        const pkg = `${GUI_MODULES}/${name}/package.json`;
        if (!existsSync(path.join(root, pkg))) continue;
        found.push(name);
        queue.push(...Object.keys(manifest(pkg).dependencies || {}));
    }
    return found.sort();
};
const dependencyFiles = () => dependencyPackages().flatMap(name => walk(`${GUI_MODULES}/${name}`,
    file => !NOT_SHIPPED_DIR.test(file.slice(`${GUI_MODULES}/${name}`.length))));
const QUICK_CONFIRM = /\bconfirm\s*\(/;
// CrispStrobe carriers contain source strings, including the registered Arrays
// form. Decode both exact forms so calls inside them cannot evade the census.
const extensionSource = source => {
    const registered = registeredArraysSource(source);
    if (registered !== null) return registered;
    const match = source.match(/^const makeExt = require\('\.\.\/adapter'\);\nmodule\.exports = makeExt\(("(?:[^"\\]|\\.)*")\);\s*$/s);
    return match ? JSON.parse(match[1]) : null;
};
// A confirm() call is the token `confirm` followed by `(`, either bare or after `<name>.`.
// Tokens, not text: comments and strings (other than the decoded extension bundles) cannot
// match, and a 1 MB minified file costs one tokenisation rather than a full AST traversal.
const babelParser = guiRequire('@babel/parser');
const confirmCalls = (file, source) => {
    const calls = [];
    const visit = (code, where) => {
        if (!QUICK_CONFIRM.test(code)) return;
        let tokens;
        try {
            ({tokens} = babelParser.parse(code, {
                sourceType: 'unambiguous', plugins: ['jsx'], errorRecovery: true, tokens: true
            }));
        } catch (error) {
            calls.push({file, where, line: 0, callee: `UNPARSED: ${error.message.split('\n')[0]}`});
            return;
        }
        const label = token => token && (token.type.label || token.type);
        tokens.forEach((token, index) => {
            if (label(token) !== 'name' || token.value !== 'confirm' || label(tokens[index + 1]) !== '(') return;
            const dotted = label(tokens[index - 1]) === '.';
            if (dotted && label(tokens[index - 2]) !== 'name' && label(tokens[index - 2]) !== 'this') {
                calls.push({file, where, line: token.loc.start.line, callee: '<expression>.confirm'});
                return;
            }
            const owner = dotted ? `${tokens[index - 2].value || 'this'}.` : '';
            // `function confirm(` / `confirm (message) {` (a method definition) declare, not call.
            const before = label(tokens[index - 1]);
            if (!dotted && (before === 'function' || (tokens[index - 1] && tokens[index - 1].value === 'function'))) return;
            calls.push({file, where, line: token.loc.start.line, callee: `${owner}confirm`,
                text: (code.split('\n')[token.loc.start.line - 1] || '').trim()});
        });
    };
    const bundled = extensionSource(source);
    if (bundled !== null) visit(bundled, 'bundled extension source');
    else visit(source, 'file');
    return calls;
};
// The ledger's unit: a Lite file by its path, a third-party package by its name.
const unitOf = file => {
    if (!file.startsWith(`${GUI_MODULES}/`)) return file;
    const rest = file.slice(GUI_MODULES.length + 1).split('/');
    return rest[0].startsWith('@') ? `${rest[0]}/${rest[1]}` : rest[0];
};

// Every confirm() call allowed to remain, each with the reason it is not a defect. Counted
// exactly: one more anywhere is a new site to convert, one fewer a ledger to shrink.
const LEDGER = [
    {unit: HELPER, callee: 'scope.confirm', count: 1,
        why: 'the helper itself: the browser branch, awaited and read as === true'},
    {unit: 'scratch-blocks', callee: 'window.confirm', count: 3,
        why: "Blockly.confirm's default (core/blockly.js and the two compiled builds); " +
            'blocks.jsx replaces it with blocklyConfirm (held above)'},
    {unit: 'scratch-blocks', callee: 'Blockly.confirm', count: 6,
        why: 'callback form ("Delete N blocks?", "Delete the variable used N times?") in core/ and ' +
            'the two compiled builds: reaches blocklyConfirm'},
    {unit: '@xterm/xterm', callee: 'confirm', count: 2,
        why: "xterm's default OSC 8 link handler (lib/xterm.js, lib/xterm.mjs); linux-terminal.jsx " +
            'passes its own linkHandler, so the default is never reached (held below)'},
    // The CrispStrobe extensions Lite bundles (vendored from CrispStrobe/extensions at
    // UPSTREAM_COMMIT by scripts/spike/vendor-bundles.mjs). Since #33 (task E7) their questions go
    // through askYesNo(): Scratch.BWConfirm when the host offers it — Lite's adapter does, from
    // runtime.confirmAsync (lib/extension-confirm-hook.js) — else this one browser confirm, awaited
    // and read as === true. That fallback is the only confirm() each may hold: `at` pins the call to
    // its line in askYesNo, so a direct `if (confirm(...))` anywhere in a bundle is a new site.
    // test/extension-confirm-seam.test.mjs drives each question through the adapter.
    {unit: 'overlay/scratch-vm/src/extensions/crispstrobe/ev3dev/index.js', callee: 'confirm', count: 1,
        at: /^else if \(typeof confirm === "function"\) answer = confirm\(text\);$/,
        why: "askYesNo's no-host fallback, awaited, only === true is a yes (E7)"},
    {unit: 'overlay/scratch-vm/src/extensions/crispstrobe/spikeprime/index.js', callee: 'confirm', count: 1,
        at: /^else if \(typeof confirm === "function"\) answer = confirm\(text\);$/,
        why: "askYesNo's no-host fallback, awaited, only === true is a yes (E7)"}
];

const censusVerdict = calls => {
    const counted = new Map();
    for (const call of calls) {
        const key = `${unitOf(call.file)}\t${call.callee}`;
        counted.set(key, [...(counted.get(key) || []), call]);
    }
    const problems = [];
    for (const [key, found] of counted) {
        const entry = LEDGER.find(item => `${item.unit}\t${item.callee}` === key);
        if (!entry) {
            for (const call of found) {
                problems.push(`${call.file}:${call.line} (${call.where}) uses the value of ${call.callee}(...) — ` +
                    'in the desktop/iOS app that is an always-truthy Promise. Use ' +
                    "`await confirmAsync(...)` from lib/native-dialog.js (task E6).");
            }
        } else if (entry.at && found.some(call => !entry.at.test(call.text || ''))) {
            for (const call of found.filter(item => !entry.at.test(item.text || ''))) {
                problems.push(`${call.file}:${call.line} (${call.where}) uses the value of ${call.callee}(...) ` +
                    `outside the reviewed line (${call.text}) — ask through askYesNo / Scratch.BWConfirm (task E7).`);
            }
        } else if (found.length !== entry.count) {
            problems.push(`${key.replace('\t', ' ')}: ${found.length} calls, the ledger says ${entry.count} ` +
                `(${found.map(call => `${call.file}:${call.line}`).join(', ')})`);
        }
    }
    for (const entry of LEDGER) {
        if (!counted.has(`${entry.unit}\t${entry.callee}`)) {
            problems.push(`ledger entry ${entry.unit} ${entry.callee} matches nothing: remove it`);
        }
    }
    return problems;
};

let censusMemo = null;
const census = () => {
    censusMemo = censusMemo || [...shippedFiles(), ...dependencyFiles()].flatMap(file => {
        const source = read(file);
        return QUICK_CONFIRM.test(source) ? confirmCalls(file, source) : [];
    });
    return censusMemo;
};

test('census: no shipped source uses the value of confirm() except the reviewed ledger', () => {
    const files = shippedFiles();
    const deps = dependencyPackages();
    // Anti-vacuity: the walk reaches the trees it claims to, and the parser sees the bundled
    // extension strings (whose calls a plain parse of the file cannot see).
    assert.ok(files.length > 900, `only ${files.length} Lite shipped files found`);
    assert.ok(deps.length > 300, `only ${deps.length} dependency packages found`);
    for (const must of [MENU_BAR, MENU_HOC, UPLOADER, HELPER,
        'overlay/scratch-vm/src/extensions/crispstrobe/ev3dev/index.js',
        `${GUI_MODULES}/scratch-vm/src/virtual-machine.js`]) {
        assert.ok(files.includes(must), `the census does not reach ${must}`);
    }
    for (const must of ['scratch-blocks', '@xterm/xterm', 'bw-circuit-ui', 'react']) {
        assert.ok(deps.includes(must), `the census does not reach the dependency ${must}`);
    }
    assert.ok(!files.includes('packages/scratch-gui/src/containers/menu-bar-hoc.jsx'),
        'a path present in overlay/ ships the overlay copy, not the packages mirror');
    assert.deepEqual(censusVerdict(census()), []);
});

test('the confirm census reports calls inside the registered Arrays carrier', () => {
    const file = 'overlay/scratch-vm/src/extensions/crispstrobe/arrays/index.js';
    const code = 'const answer = confirm("Unreviewed dialog?"); use(answer);';
    const carrier = renderRegisteredArraysCarrier(code);
    assert.equal(extensionSource(carrier), code);
    assert.equal(extensionSource(renderRegisteredArraysCarrier('')), '', 'empty registered source is not absence');
    const calls = confirmCalls(file, carrier);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].where, 'bundled extension source');
    assert.equal(calls[0].callee, 'confirm');
    assert.match(censusVerdict(calls).join('\n'),
        /arrays\/index\.js:1 \(bundled extension source\) uses the value of confirm/);
});

test('census turns red on a new direct confirm() use, a stale count and a dead entry', () => {
    const calls = census();
    assert.deepEqual(censusVerdict(calls), []);
    const reverted = read(UPLOADER).replace('await confirmAsync(', 'confirm(');
    const withSite = calls.concat(confirmCalls(UPLOADER, reverted));
    assert.match(censusVerdict(withSite).join('\n'), /sb-file-uploader-hoc\.jsx:\d+ \(file\) uses the value of confirm/);
    const windowForm = 'export const f = () => { if (window.confirm("x")) go(); };';
    assert.match(censusVerdict(calls.concat(confirmCalls('overlay/scratch-gui/src/lib/new.js', windowForm))).join('\n'),
        /new\.js:1 \(file\) uses the value of window\.confirm/);
    const notCalls = '// if (confirm("x")) go();\nconst text = "confirm(x)"; function confirm (m) { return m; }';
    assert.deepEqual(confirmCalls('overlay/scratch-gui/src/lib/new.js', notCalls), [],
        'comments, strings and a declaration are not calls');
    const extension = `const makeExt = require('../adapter');\nmodule.exports = makeExt(${JSON.stringify('(function(){ if (confirm("Erase hub?")) erase(); })();')});\n`;
    assert.match(censusVerdict(calls.concat(confirmCalls('overlay/scratch-vm/src/extensions/crispstrobe/x/index.js', extension))).join('\n'),
        /x\/index\.js:1 \(bundled extension source\) uses the value of confirm/);
    const dependency = calls.concat(confirmCalls(`${GUI_MODULES}/some-lib/index.js`, 'if (confirm("Reset?")) reset();'));
    assert.match(censusVerdict(dependency).join('\n'), /some-lib\/index\.js:1 \(file\) uses the value of confirm/);
    const fewer = calls.filter(call => !call.file.endsWith('spikeprime/index.js'));
    assert.match(censusVerdict(fewer).join('\n'), /spikeprime\/index\.js confirm matches nothing/);
    const more = calls.concat(calls.filter(call => call.file.endsWith('ev3dev/index.js')).slice(0, 1));
    assert.match(censusVerdict(more).join('\n'), /ev3dev\/index\.js confirm: 2 calls, the ledger says 1/);
    // E7: a bundle that goes back to `if (confirm(...))` reds even with its count unchanged.
    const ev3dev = 'overlay/scratch-vm/src/extensions/crispstrobe/ev3dev/index.js';
    const ev3devSource = extensionSource(read(ev3dev));
    const ev3devReverted = ev3devSource.replace('if (await askYesNo("Delete " + script + "?"))', 'if (confirm("Delete " + script + "?"))');
    assert.notEqual(ev3devReverted, ev3devSource, 'the ev3dev delete question is where E7 put it');
    const revertedBundle = `const makeExt = require('../adapter');\nmodule.exports = makeExt(${JSON.stringify(ev3devReverted)});\n`;
    const withReverted = calls.filter(call => call.file !== ev3dev).concat(confirmCalls(ev3dev, revertedBundle));
    assert.match(censusVerdict(withReverted).join('\n'), /ev3dev\/index\.js:\d+ \(bundled extension source\) uses the value of confirm\(\.\.\.\) outside the reviewed line/);
});

test('every confirmAsync / confirmReadyToReplaceProject answer is awaited or returned', () => {
    const offenders = [];
    let seen = 0;
    for (const file of shippedFiles()) {
        const source = read(file);
        if (!/\b(?:confirmAsync|confirmReadyToReplaceProject|confirmWithMessage)\s*\(/.test(source)) continue;
        babel.traverse(parse(source, file.replace(/\.js$/, '.jsx')), {
            CallExpression (nodePath) {
                const callee = nodePath.node.callee;
                const name = callee.type === 'Identifier' ? callee.name :
                    callee.type === 'MemberExpression' && !callee.computed ? callee.property.name : null;
                if (!['confirmAsync', 'confirmReadyToReplaceProject', 'confirmWithMessage'].includes(name)) return;
                seen++;
                const parent = nodePath.parentPath;
                const awaited = parent.isAwaitExpression() || parent.isReturnStatement() ||
                    (parent.isArrowFunctionExpression() && parent.node.body === nodePath.node) ||
                    (parent.isMemberExpression() && parent.node.property.name === 'then');
                if (!awaited) offenders.push(`${file}:${nodePath.node.loc.start.line} ${name}(...) is not awaited`);
            }
        });
    }
    assert.ok(seen >= 13, `only ${seen} awaited-question calls found`);
    assert.deepEqual(offenders, []);
});

test('the bundled scratch-blocks reaches Blockly.confirm only in callback form', () => {
    // node_modules/scratch-blocks is what webpack bundles (lazy-scratch-blocks.js imports it, and
    // webpack.config.js aliases the cat-blocks Easter egg to it, so cat-blocks never ships).
    assert.match(read('overlay/scratch-gui/webpack.config.js'),
        /c\.resolve\.alias\['cat-blocks'\] = path\.resolve\(__dirname, 'node_modules\/scratch-blocks'\);/);
    const compiled = guiRequire.resolve('scratch-blocks/blockly_compressed_vertical.js');
    const source = readFileSync(compiled, 'utf8');
    const uses = [...source.matchAll(/Blockly\.confirm\b(.{0,40})/g)].map(match => match[1]);
    assert.equal(uses.length, 3, `Blockly.confirm appears ${uses.length} times in ${pathToFileURL(compiled)}`);
    assert.equal(uses.filter(rest => rest.startsWith('=function(a,b){b(window.confirm(a))}')).length, 1,
        'the one definition is the default blocks.jsx replaces');
    assert.equal(uses.filter(rest => rest.startsWith('(')).length, 2, 'the other two are calls');
    // Both calls pass a callback that acts only on a truthy answer (variable_map.js,
    // workspace_svg.js in packages/scratch-blocks/core): the answer must be a real boolean.
    for (const file of ['core/variable_map.js', 'core/workspace_svg.js']) {
        assert.match(readFileSync(guiRequire.resolve(`scratch-blocks/${file}`), 'utf8'),
            /Blockly\.confirm\([\s\S]{0,200}?function\(ok\) \{\s*if \(ok\) \{/, `${file}: callback form`);
    }
});
