import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {scopeAfter} from './helpers/js-scope.mjs';

const sources = [
    '../overlay/scratch-gui/src/lib/bw-debug/debug-runner.js',
    '../packages/scratch-gui/src/lib/bw-debug/debug-runner.js'
].map(path => readFileSync(new URL(path, import.meta.url), 'utf8'));
const benchSources = [
    '../overlay/scratch-gui/src/lib/bw-debug/i8086-dos-bench.js',
    '../packages/scratch-gui/src/lib/bw-debug/i8086-dos-bench.js'
].map(path => readFileSync(new URL(path, import.meta.url), 'utf8'));
const panelSources = [
    '../overlay/scratch-gui/src/components/tw-pseudocode/debug-panel.jsx',
    '../packages/scratch-gui/src/components/tw-pseudocode/debug-panel.jsx'
].map(path => readFileSync(new URL(path, import.meta.url), 'utf8'));

function assertDosStartup (source) {
    // attachI8086 accepts the selected CPU variant. Scope the function itself,
    // so another target's startup cannot satisfy the DOS path's checks.
    const attach = scopeAfter(source, 'async function attachI8086(');
    const dosBranch = attach.indexOf('if (isDosProgram)');
    const dosReturn = attach.indexOf('return session;', dosBranch);
    const barrelImport = attach.indexOf("'bw-board'");

    assert.ok(dosBranch >= 0 && dosReturn > dosBranch, 'DOS branch boundaries moved');
    assert.ok(barrelImport > dosReturn,
        'the board barrel must remain deferred until the hardware branch');

    const dosStartup = attach.slice(dosBranch, dosReturn);
    assert.match(dosStartup, /Promise\.all\(\[/,
        'the independent session and DOS-bench chunks should load in parallel');
    assert.match(dosStartup, /'bw-board\/debug-session\.js'/,
        'DOS startup needs the small session module directly');
    assert.match(dosStartup, /'\.\/i8086-dos-bench\.js'/,
        'DOS startup still needs its service-layer bench');
    const progress = dosStartup.indexOf("setStatus('attaching'");
    assert.ok(progress >= 0 && progress < dosStartup.indexOf('Promise.all(['),
        'publish progress before a cold chunk fetch begins');
}

test('the assembled DOS path does not eagerly load the bw-board barrel', () => {
    for (const source of sources) assertDosStartup(source);
});

test('the DOS startup gate rejects eager imports, serial fetches and absent progress', () => {
    const source = sources[0];
    const mutations = [
        ["'bw-board/debug-session.js'", "'bw-board'"],
        ['Promise.all([', 'loadSerially(['],
        ["setStatus('attaching'", "setStatus('idle'"]
    ];
    const attach = scopeAfter(source, 'async function attachI8086(');
    for (const [before, after] of mutations) {
        assert.ok(attach.includes(before), `mutation applies: ${before}`);
        assert.throws(() => assertDosStartup(source.replace(attach, attach.replace(before, after))));
    }
    const broken = attach.replace("'bw-board/debug-session.js'", "'missing-session'");
    assert.throws(() => assertDosStartup(source.replace(attach, broken) +
        "\nasync function otherTarget() { await import('bw-board/debug-session.js'); }"),
        undefined, 'a following target cannot supply the DOS session dependency');
});

test('the DOS bench keeps its direct dependencies in the dedicated chunk', () => {
    for (const source of benchSources) {
        assert.equal((source.match(/webpackChunkName: "bw-debug-i8086"/g) || []).length, 3);
        assert.doesNotMatch(source, /webpackChunkName: "bw-board"/,
            'a generic chunk label can pull the broad board registry back into DOS startup');
    }
});

test('the target picker loads metadata without the bw-board barrel', () => {
    for (const source of panelSources) {
        assert.match(source,
            /webpackChunkName: "bw-debug-target-kinds" \*\/ 'bw-board\/target-kinds\.js'/,
            'picker metadata should have its own dependency-free chunk');
        assert.doesNotMatch(source,
            /webpackChunkName: "bw-board" \*\/ 'bw-board'/,
            'opening the picker must not request the broad board barrel');
    }
});

function assertFaceChunks (source) {
    // Video now goes through bwMirrorMachineVideo's controller widget. Only
    // these two circuit faces are loaded directly by the debugger panel.
    const faces = [...source.matchAll(
        /import\(\/\* webpackChunkName: "([^"]+)" \*\/ 'bw-circuit-ui\/components\/([^']+)'\)/g
    )].map(([, chunk, module]) => ({chunk, module}));
    assert.deepEqual(faces, [
        {chunk: 'bw-debug-faces', module: 'PortLeds.jsx'},
        {chunk: 'bw-debug-faces', module: 'SwitchPanel.jsx'}
    ], 'each debugger face should keep its focused lazy chunk');
    assert.doesNotMatch(source, /webpackChunkName: "bw-circuit-ui"/,
        'a shared chunk label would pull the full designer into DOS startup');
}

test('debugger faces do not merge back into the full circuit designer chunk', () => {
    for (const source of panelSources) assertFaceChunks(source);
});

test('the face chunk gate rejects missing or broadly grouped imports', () => {
    const source = panelSources[0];
    for (const [before, after] of [
        ['webpackChunkName: "bw-debug-faces"', 'webpackChunkName: "bw-circuit-ui"'],
        ['bw-circuit-ui/components/PortLeds.jsx', 'bw-circuit-ui/components/Other.jsx']
    ]) {
        assert.ok(source.includes(before), `mutation applies: ${before}`);
        assert.throws(() => assertFaceChunks(source.replace(before, after)));
    }
});
