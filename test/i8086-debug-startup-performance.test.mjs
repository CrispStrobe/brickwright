import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

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

test('the assembled DOS path does not eagerly load the bw-board barrel', () => {
    for (const source of sources) {
        const start = source.indexOf('    async function attachI8086(');
        const end = source.indexOf('\n    async function ', start + 1);
        const attach = start >= 0 && end > start ? source.slice(start, end) : '';
        assert.ok(attach.length > 3000, 'attachI8086 capture is empty or truncated');
        const dosBranch = attach.indexOf('if (isDosProgram)');
        const dosReturn = attach.indexOf('return session;', dosBranch);
        const barrelImport = attach.indexOf("'bw-board'", dosBranch);

        assert.ok(dosBranch >= 0 && dosReturn > dosBranch, 'DOS branch boundaries moved');
        assert.ok(barrelImport > dosReturn,
            'the 55-module board barrel must remain deferred until the hardware branch');

        const dosStartup = attach.slice(dosBranch, dosReturn);
        assert.match(dosStartup, /Promise\.all\(\[/,
            'the independent session and DOS-bench chunks should load in parallel');
        assert.match(dosStartup, /'bw-board\/debug-session\.js'/,
            'DOS startup needs the small session module directly');
        assert.match(dosStartup, /'\.\/i8086-dos-bench\.js'/,
            'DOS startup still needs its service-layer bench');
        assert.ok(dosStartup.indexOf("setStatus('attaching'") < dosStartup.indexOf('Promise.all(['),
            'publish progress before a cold chunk fetch begins');
    }
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

test('debugger faces stay in their focused chunk and video uses the existing mirror', () => {
    for (const source of panelSources) {
        const faces = [...source.matchAll(/import\(\/\* webpackChunkName: "bw-debug-faces" \*\/ '([^']+)'\)/g)]
            .map(match => match[1]);
        assert.deepEqual(faces, ['bw-circuit-ui/components/PortLeds.jsx', 'bw-circuit-ui/components/SwitchPanel.jsx'],
            'port LEDs and switches should use their focused face chunk');
        assert.match(source, /window\.bwMirrorMachineVideo\(\{videoFn: \(\) => runner\.video\(\), widget: screen,/,
            'machine video should reuse the GUI mirror instead of loading another circuit face');
        assert.doesNotMatch(source, /webpackChunkName: "bw-circuit-ui"/,
            'a shared chunk label would pull the full designer into DOS startup');
    }
});
