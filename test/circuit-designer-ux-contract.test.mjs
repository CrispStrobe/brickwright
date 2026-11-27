import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';

const root = resolve(new URL('..', import.meta.url).pathname);
const read = file => readFileSync(resolve(root, file), 'utf8');
const requireGui = createRequire(new URL('../packages/scratch-gui/package.json', import.meta.url));
const requireBabel = createRequire(requireGui.resolve('@babel/core'));
const {parse} = requireBabel('@babel/parser');
const parseSource = source => parse(source, {sourceType: 'module', plugins: ['jsx']});
function* nodes (node) {
    if (!node || typeof node !== 'object') return;
    if (node.type) yield node;
    for (const child of Object.values(node)) yield* nodes(child);
}
const {t: designerText} = await import(new URL('../node_modules/bw-circuit-ui/src/i18n/strings.js', import.meta.url));

test('Circuit Designer has a view toggle (realistic / schematic) and a mode attribute', () => {
    const source = read('node_modules/bw-circuit-ui/src/components/CircuitDesigner.jsx');
    assert.match(source, /data-circuit-view-toggle/);
    assert.match(source, /data-sim-mode/);
    assert.match(source, /Realistic view/);
    assert.match(source, /Schematic view/);
});

test('the production circuit host injects the device model accessor the designer consumes', () => {
    const host = read('overlay/scratch-gui/src/components/tw-pseudocode/circuit-tab.jsx');
    const contract = read('node_modules/bw-circuit-ui/src/engine.js');
    assert.match(contract, /_engine\.getDevice/,
        'the vendored designer no longer consumes getDevice; update this host-contract gate');
    assert.match(host, /const getCircuitDevice = kind => kind === 'stc_mcu' \? null : engine\.getDevice\(kind\)/,
        'the legacy STC surface must retain its larger sidecar terminal set');
    assert.match(host, /getDevice:\s*getCircuitDevice/,
        'without getDevice, registered PS\/2 and VGA parts collapse to generic MCU state in the built app');
});

test('part editor uses focused, native numeric controls', () => {
    const editor = read('node_modules/bw-circuit-ui/src/components/InlineEditor.jsx');
    assert.match(editor, /data-inline-editor/);
    assert.match(editor, /firstInput\.current\?\.focus/);
    assert.match(editor, /type=\{typeof v === 'number' \? 'number' : 'text'\}/);
    assert.match(editor, /background: '#ffffff'/);
});

test('light circuit theme does not override toggle paint', () => {
    const theme = read('node_modules/bw-circuit-ui/src/components/circuit-theme.css');
    assert.doesNotMatch(theme, /data-bw-circuit-theme="light"\]\s*button\)[\s\S]*background:\s*#ffffff\s*!important/);
    assert.match(theme, /Buttons own their active\/inactive colors inline/);
});

test('Circuit Designer side selectors expose toggle and divider', () => {
    const designer = read('node_modules/bw-circuit-ui/src/components/CircuitDesigner.jsx');
    assert.match(designer, /data-selectors-toggle/);
    assert.match(designer, /data-selectors-panel/);
    assert.match(designer, /data-selector-divider/);
    assert.match(designer, /data-parts-selector/);
    const ast = parseSource(designer);
    const examplesImport = ast.program.body.find(node => node.type === 'ImportDeclaration' &&
        node.specifiers.some(specifier => specifier.imported?.name === 'ExamplesBrowser'));
    assert.equal(examplesImport?.source.value, './ExamplesBrowser.jsx');
    const examplesName = examplesImport.specifiers.find(specifier => specifier.imported?.name === 'ExamplesBrowser').local.name;
    assert.ok([...nodes(ast)].some(node => node.type === 'JSXOpeningElement' && node.name.name === examplesName),
        'the designer must mount its imported examples selector');
    assert.match(read('node_modules/bw-circuit-ui/src/components/ExamplesBrowser.jsx'), /data-examples-selector/);
});

test('Circuit Designer keeps simulation and debugger controls in the instruments column', () => {
    const source = read('node_modules/bw-circuit-ui/src/components/CircuitDesigner.jsx');
    assert.match(source, /data-instruments-column/);
    assert.match(source, /data-instruments-scroll/);
    assert.match(source, /data-instruments-scroll[^\n]*overflowY: 'auto'/);
    assert.match(source, /data-debugger-panel/);
    assert.match(source, /data-simulation-controls/);
    assert.match(source, /data-scope-module/);
    assert.match(source, /data-no-code-indicator/);
    // The two dock buttons' tooltips follow the designer's language. verify-circuit-ux.mjs
    // finds them by their ENGLISH title, so the English must stay exactly this.
    const dockTitles = {
        debuggerToInstrumentsTitle: {en: 'Move debugger back to instruments', de: 'Debugger zurück zu den Messgeräten verschieben'},
        debuggerToRightTitle: {en: 'Move debugger to full-size right pane', de: 'Debugger in den großen rechten Bereich verschieben'}
    };
    for (const [key, byLang] of Object.entries(dockTitles)) {
        for (const [lang, text] of Object.entries(byLang)) assert.equal(designerText(key, lang), text, `${key} in ${lang}`);
        assert.ok(source.includes(`title={t('${key}', lang)}`), `${key} is looked up per language`);
    }
    assert.match(source, /onDebugDockChange\('top'\)/);
    assert.match(source, /onDebugDockChange\('right'\)/);
    assert.match(source, /useState\(!!debuggerOn \|\| !!benchOpen\)/,
        'fresh workspaces preserve bench space; debugger and lesson demand open instruments');
    // SAME BLOCK, not the same LINE. The old assertion pinned the exact
    // one-line spelling, so inserting any statement into the block -- which the
    // React update-source work does routinely -- split the line and turned this
    // red while the behaviour was untouched. Species 1 running BACKWARDS: a
    // source-text match tracking spelling rather than behaviour, producing a
    // false failure instead of a false pass. `\{?[^}]*?` accepts the braced and
    // unbraced forms and allows inserted statements, while forbidding a closing
    // brace between condition and effect -- so the effect must still be INSIDE
    // the condition, which is the actual claim.
    assert.match(source, /if \(debuggerOn \|\| benchOpen\)\s*\{?[^}]*?setRightOpen\(true\)/,
        'debugger and lesson demand must reveal instruments automatically');
});

test('oscilloscope exposes real scale, edge trigger, and time-cursor controls', () => {
    const scope = read('node_modules/bw-circuit-ui/src/components/ScopePanel.jsx');
    const tools = read('node_modules/bw-circuit-ui/src/model/scope-tools.js');
    assert.match(scope, /voltsPerDiv/);
    assert.match(scope, /triggerMode/);
    assert.match(scope, /triggerLevel/);
    assert.match(scope, /Cursor A/);
    assert.match(scope, /cursorDeltaSeconds/);
    assert.match(tools, /findTriggerIndex/);
    assert.match(tools, /triggeredWindowStart/);
});

test('debugger selection is not disabled merely because the Circuit tab is active', () => {
    const source = read('overlay/scratch-gui/src/components/tw-pseudocode/circuit-tab.jsx');
    // Execute the declarations inside the actual render method. The controller
    // dock shares CP1's debugger; other device docks retain their own column.
    const host = parseSource(source).program.body.find(node => node.type === 'ClassDeclaration' && node.id.name === 'CircuitTab');
    const render = host?.body.body.find(node => node.key?.name === 'render');
    assert.ok(render, 'actual Circuit tab render method');
    const declarations = ['cp1ControllerDock', 'dock'].map(name => {
        const declaration = render.body.body.find(node => node.type === 'VariableDeclaration' &&
            node.declarations.some(binding => binding.id.name === name));
        assert.ok(declaration, `actual render declaration ${name}`);
        return source.slice(declaration.start, declaration.end);
    }).join('\n');
    const makeChooseDock = new Function('CIRCUIT_DOCKS', 'window', `return function () { ${declarations}\nreturn dock; };`);
    for (const machine of [undefined, {kind: 'cp1'}, {kind: 'other'}]) {
        const chooseDock = makeChooseDock(new Set(['top', 'right', 'off', 'solo']), {__bwMachineExtracted: machine});
        for (const [input, expected] of [['solo', 'top'], ['top', 'top'], ['right', 'right'],
            ['off', 'off'], ['controller', machine?.kind === 'cp1' ? 'top' : 'off'], ['microbit', 'off']]) {
            assert.equal(chooseDock.call({state: {debugDock: input}}), expected, `${input}, machine=${machine?.kind}`);
        }
    }
    assert.match(source, /debuggerOn=\{dock === 'top'\}/);
    // The panel now renders through ONE portal into a persistent host node;
    // the instruments slot ADOPTS that node when dock is 'top' (HostMount).
    assert.match(source, /debuggerPanel=\{dock === 'top' \? <HostMount host=\{this\._ensureDebugHost\(\)\} \/> : null\}/);
});

test("debugger-only pane: dock 'solo' portals just the DebugPanel while coding", () => {
    const source = read('overlay/scratch-gui/src/components/tw-pseudocode/circuit-tab.jsx');
    const header = read('overlay/scratch-gui/src/components/stage-header/stage-header.jsx');
    const settings = read('overlay/scratch-gui/src/components/menu-bar/settings-menu.jsx');
    // The solo branch renders before the Designer-chunk gate (the panel has
    // its own Suspense) and only while portalled into the stage column.
    assert.match(source, /\(this\.state\.debugDock === 'solo' \|\| this\.state\.debugDock === 'right' \|\|\s*this\._controllerSplitLive\(\)\) && this\._stagePortalOn\(\)/);
    // Fresh declarations reach the pane: "To blocks" announces via
    // PROJECT_CHANGED and the tab re-reads runtime.stc.
    assert.match(source, /runtime\.on\('PROJECT_CHANGED', this\.handleProjectChanged\)/);
    assert.match(source, /runtime\.removeListener\('PROJECT_CHANGED', this\.handleProjectChanged\)/);
    // The stage header offers the fourth view; Settings offers the dock value.
    // The button docks RIGHT (full panel in the right pane on both tabs);
    // 'solo' on the Circuit tab fell back to the tiny instruments dock.
    assert.match(header, /dock: 'right'/);
    assert.match(header, /debuggerFull/);
    assert.match(settings, /\{value: 'solo', label: t\('gui\.workspace\.fullPane', 'Full pane'\)\}/);
});

test('Green Flag and Red Flag reach Circuit Designer even without MCU code', () => {
    const source = read('overlay/scratch-gui/src/components/tw-pseudocode/circuit-tab.jsx');
    const controls = read('overlay/scratch-gui/src/containers/controls.jsx');
    assert.match(source, /addEventListener\('bw-green-flag', this\._greenFlagHandler\)/);
    assert.match(source, /addEventListener\('bw-stop-all', this\._stopAllHandler\)/);
    assert.match(source, /runToken/);
    assert.match(source, /stopToken/);
    // The start event goes out BEFORE the VM starts, synchronously: the designer
    // clears its board on it, and the program's first write must follow the clear
    // (task B7; scripts/verify-green-flag-first-write.mjs is the browser gate).
    assert.match(controls, /window\.dispatchEvent\(new CustomEvent\('bw-green-flag'\)\);\s*this\.props\.vm\.greenFlag\(\);/);
    assert.doesNotMatch(controls, /setTimeout\(\(\) => window\.dispatchEvent\(new CustomEvent\('bw-green-flag'\)\)/);
    assert.match(controls, /setTimeout\(\(\) => window\.dispatchEvent\(new CustomEvent\('bw-stop-all'\)\), 0\)/);
    // vm.greenFlag() emits PROJECT_STOP_ALL then PROJECT_START: the VM's own stop
    // is held and dropped when a start follows, or the designer ends in build mode.
    assert.match(source, /runtime\.on\('PROJECT_STOP_ALL', this\.handleVmStopAll\)/);
    assert.match(source, /runtime\.on\('PROJECT_START', this\.handleVmProjectStart\)/);
    assert.match(source, /handleVmProjectStart \(\) \{\s*this\._vmStopPending = false;/);
});

test('SIM starts the same MCU program path as Green Flag', () => {
    const tab = read('overlay/scratch-gui/src/components/tw-pseudocode/circuit-tab.jsx');
    const designer = read('node_modules/bw-circuit-ui/src/components/CircuitDesigner.jsx');
    assert.match(tab, /onSimulationStart=\{this\.handleProjectStart\}/);
    // SAME BLOCK, not the same LINE. The old assertion pinned the exact
    // one-line spelling, so inserting any statement into the block -- which the
    // React update-source work does routinely -- split the line and turned this
    // red while the behaviour was untouched. Species 1 running BACKWARDS: a
    // source-text match tracking spelling rather than behaviour, producing a
    // false failure instead of a false pass. `\{?[^}]*?` accepts the braced and
    // unbraced forms and allows inserted statements, while forbidding a closing
    // brace between condition and effect -- so the effect must still be INSIDE
    // the condition, which is the actual claim.
    assert.match(designer, /if \(onSimulationStart\)\s*\{?[^}]*?onSimulationStart\(\)/);
});

test('example loading publishes its localized name as the project title', () => {
    const source = read('overlay/scratch-gui/src/components/tw-pseudocode/circuit-tab.jsx');
    assert.match(source, /setProjectTitle/);
    assert.match(source, /onSetProjectTitle\(title\)/);
});

test('lesson drawer leaves right-pane controls unobstructed', () => {
    const source = read('overlay/scratch-gui/src/components/gui/guided-lessons.css');
    assert.match(source, /\.drawer \{[^}]*left: 10px/);
    assert.doesNotMatch(source, /\.drawer \{[^}]*right: 10px/);
});

test('main tab row retains the right-pane toggle', () => {
    const gui = read('overlay/scratch-gui/src/components/gui/gui.jsx');
    assert.match(gui, /data-right-pane-toggle/);
    assert.match(gui, /Show right panel|Hide right panel/);
    assert.match(gui, /stagePaneVisible \? '›' : '‹'/);
    assert.match(gui, /localStorage\.getItem\('bw-right-pane-hidden'\) === '0'/,
        'a fresh workspace keeps the optional right pane minimized');
    assert.match(gui, /detail\.value === 'right'[\s\S]*setStagePaneVisible\(true\)/,
        'an explicitly right-docked debugger opens the pane that contains it');
});

test('Settings exposes an app-internal hard reload without clearing project storage', () => {
    const menu = read('overlay/scratch-gui/src/components/menu-bar/settings-menu.jsx');
    const reload = read('overlay/scratch-gui/src/lib/hard-reload.js');
    assert.match(menu, /Reload BrickWright/);
    assert.match(menu, /hardReload\(\)/);
    assert.match(reload, /caches\.keys\(\)/);
    assert.match(reload, /getRegistrations\(\)/);
    assert.match(reload, /bw-hard-reload/);
    assert.doesNotMatch(reload, /localStorage\.clear/);
});

test('the full-screen exit control clears the menu bar band instead of hiding inside it', () => {
    const header = read('overlay/scratch-gui/src/components/stage-header/stage-header.jsx');
    // Measured on the built app in WebKit at an iPad viewport: with top:8 this row
    // occupied y 13..47 while the menu bar occupied y 0..48 — a total overlap. It
    // still WON the stacking (z 5100 vs 491, and elementFromPoint at its centre
    // returned the button), so the bug was never paint order and raising z-index
    // would have fixed nothing. After the offset the row measures y 61..95 and no
    // longer intersects the menu bar. Pin the offset, not the z-index.
    assert.match(header, /top: 'calc\(env\(safe-area-inset-top, 0px\) \+ 56px\)'/,
        'the full-screen control row must clear the 48px menu bar (3rem) plus a gap, ' +
        'or it lands inside the top bar where the iOS status bar can also cover it');
    assert.match(header, /right: 'calc\(env\(safe-area-inset-right, 0px\) \+ 8px\)'/,
        'the row must respect the right safe-area inset');
    // The stacking it already had must not be traded away for the offset.
    assert.match(header, /zIndex: 5100/);
});
