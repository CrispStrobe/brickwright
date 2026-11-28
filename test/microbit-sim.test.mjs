import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {codeDocumentEditorClass} from './helpers/code-document-editor.mjs';
import {scopeAfter} from './helpers/js-scope.mjs';
import {createCodeDocument, addCodeProjection} from '../overlay/scratch-gui/src/lib/code-source-document.js';

const here = dirname(fileURLToPath(import.meta.url));
const overlay = resolve(here, '../overlay/scratch-gui');

test('microbit-sim-pane.jsx exists in overlay', () => {
    assert.ok(existsSync(resolve(overlay, 'src/components/tw-pseudocode/microbit-sim-pane.jsx')),
        'microbit-sim-pane.jsx missing');
});

test('simulator assets exist in static/microbit-sim/', () => {
    const base = resolve(overlay, 'static/microbit-sim');
    assert.ok(existsSync(resolve(base, 'simulator.html')), 'simulator.html missing');
    assert.ok(existsSync(resolve(base, 'build/firmware.js')), 'firmware.js missing');
    assert.ok(existsSync(resolve(base, 'build/firmware.wasm')), 'firmware.wasm missing');
    assert.ok(existsSync(resolve(base, 'build/simulator.js')), 'simulator.js missing');
});

test('pseudocode-importer has micropython buffer and tab', () => {
    const src = readFileSync(
        resolve(overlay, 'src/components/tw-pseudocode/pseudocode-importer.jsx'), 'utf8'
    );
    assert.ok(src.includes("micropython: ''"), 'micropython buffer not in state');
    assert.ok(src.includes("'micropython'"), 'micropython tab entry not found');
    assert.ok(src.includes('generateMicroPython'), 'generateMicroPython call not found');
    assert.ok(src.includes('flashMicrobitSim'), 'flashMicrobitSim method not found');
    assert.ok(src.includes('bw-microbit-flash'), 'bw-microbit-flash event not found');
    assert.match(src, /\['microbit', 'calliopemini'\]\.includes\(this\.currentDevice\(\)\)/,
        'Calliope retarget hides the generated MicroPython tab');
    assert.match(src, /this\.currentDevice\(\) === 'calliopemini' \? '🤖 Calliope'/,
        'Calliope generated-code tab keeps the micro:bit identity');
    const setDevice = scopeAfter(src, 'async setDevice (deviceId)');
    assert.match(setDevice, /\.\.\.this\.retargetCodeState\(result\.pseudocode\)/,
        'retargeting must atomically replace the source and its generated views');
    const Editor = codeDocumentEditorClass(src, '');
    const editor = new Editor();
    const source = 'DEVICE microbit\nWHEN flag clicked:\n  say 1\n';
    const document = createCodeDocument({code: source});
    editor.state = editor.codeDocumentState(addCodeProjection(document, {
        lang: 'micropython', code: '# generated for the previous device', sourceRevision: document.revision
    }));
    const rewritten = source.replace('DEVICE microbit', 'DEVICE calliopemini');
    const retargeted = editor.retargetCodeState(rewritten);
    assert.equal(retargeted.codeDocument.lang, 'pseudocode');
    assert.equal(retargeted.codeDocument.code, rewritten);
    assert.equal(retargeted.codeDocument.target, 'calliopemini');
    assert.equal(retargeted.codeDocument.revision, document.revision + 1);
    assert.equal(retargeted.buffers.micropython, '',
        'retargeting must clear MicroPython generated for the previous device/source');
    assert.deepEqual(retargeted.codeDocument.projections, {});
    const pinlessCommit = setDevice.indexOf('await new Promise(resolve => this.setState');
    const pinlessCompile = setDevice.indexOf('await this.compile({pseudocode: nextSource})');
    assert.ok(pinlessCommit >= 0 && pinlessCompile >= 0,
        'pinless retarget must await both its source commit and compilation');
    assert.ok(pinlessCommit < pinlessCompile,
        'pinless micro:bit examples must commit rewritten source before rebuilding for Calliope');
    assert.match(setDevice, /deriveBuffer\(nextSource, 'pseudocode', 'micropython'\)/,
        'pinless Calliope retarget does not derive generated code from the rewritten source');
});

test('global Run and simulator Play both request the current MicroPython program', () => {
    const importer = readFileSync(
        resolve(overlay, 'src/components/tw-pseudocode/pseudocode-importer.jsx'), 'utf8');
    const pane = readFileSync(
        resolve(overlay, 'src/components/tw-pseudocode/microbit-sim-pane.jsx'), 'utf8');
    const controls = readFileSync(resolve(overlay, 'src/containers/controls.jsx'), 'utf8');
    assert.match(controls, /bw-microbit-run-request[\s\S]{0,100}autostart: true/);
    assert.match(importer, /addEventListener\('bw-microbit-run-request'/);
    assert.match(pane, /case 'request_flash':[\s\S]{0,500}bw-microbit-run-request/);
    const readyCase = pane.slice(pane.indexOf("case 'ready':"), pane.indexOf("case 'request_flash':"));
    assert.match(readyCase, /this\._autostart[\s\S]*this\._flash/);
});

test('host Run can start muted before the simulator audio gesture', () => {
    const sim = readFileSync(resolve(overlay, 'static/microbit-sim/build/simulator.js'), 'utf8');
    assert.match(sim, /case "flash":[\s\S]{0,700}if \(!board2\.audio\.context\)[\s\S]{0,300}board2\.flash/);
});

test('shared simulator presents the selected board identity', () => {
    const pane = readFileSync(
        resolve(overlay, 'src/components/tw-pseudocode/microbit-sim-pane.jsx'), 'utf8');
    assert.match(pane, /this\.state\.device === 'calliopemini' \? t\.calliopeTitle : t\.simTitle/);
    assert.match(pane, /detail\.key === 'bw-device-id'/);
    assert.match(pane, /Calliope mini simulator/);
});

test('gui.jsx lazy-loads MicrobitSimPane', () => {
    const src = readFileSync(
        resolve(overlay, 'src/components/gui/gui.jsx'), 'utf8'
    );
    assert.ok(src.includes('microbit-sim-pane.jsx'), 'microbit-sim-pane import not found');
    assert.ok(src.includes('MicrobitSimPane'), 'MicrobitSimPane component not found');
    assert.ok(src.includes("dockMode === 'microbit'"), 'microbit dock mode check not found');
});

test('stage-header has conditional microbit view button', () => {
    const src = readFileSync(
        resolve(overlay, 'src/components/stage-header/stage-header.jsx'), 'utf8'
    );
    assert.ok(src.includes('microbitSim'), 'microbitSim message not found');
    assert.ok(src.includes("dock: 'microbit'"), "dock: 'microbit' not found");
    assert.ok(src.includes('icon--microbit'), 'microbit icon import not found');
    assert.ok(src.includes('deviceIsMicrobit'), 'deviceIsMicrobit guard not found');
    assert.ok(src.includes('bw-device-id'), 'bw-device-id listener not found');
});

test('codemirror-editor handles micropython language', () => {
    const src = readFileSync(
        resolve(overlay, 'src/lib/codemirror-languages.js'), 'utf8'
    );
    assert.match(src, /case 'python':\s*\n\s*case 'micropython':/,
        'micropython must share the deferred Python grammar');
});

test('about-data.js includes micropython-microbit-v2-simulator', () => {
    const src = readFileSync(
        resolve(overlay, 'src/components/menu-bar/about-data.js'), 'utf8'
    );
    assert.ok(src.includes('micropython-microbit-v2-simulator'),
        'micropython-microbit-v2-simulator not in about-data.js');
});

test('THIRD-PARTY-NOTICES.md includes micropython-microbit-v2-simulator', () => {
    const src = readFileSync(resolve(here, '../THIRD-PARTY-NOTICES.md'), 'utf8');
    assert.ok(src.includes('micropython-microbit-v2-simulator'),
        'micropython-microbit-v2-simulator not in THIRD-PARTY-NOTICES.md');
    assert.ok(src.includes('Micro:bit Educational Foundation'),
        'Foundation attribution missing');
});
