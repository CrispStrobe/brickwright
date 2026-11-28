import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const overlayPath = 'node_modules/bw-circuit-ui/src/components/CircuitDesigner.jsx';
const packagePath = 'packages/scratch-gui/node_modules/bw-circuit-ui/src/components/CircuitDesigner.jsx';

const assertBatchedLoad = source => {
    assert.match(source, /import ReactDOM from 'react-dom';/);
    const effect = /const prevCircuitDataRef = useRef\(null\);[\s\S]*?useEffect\(\(\) => \{([\s\S]*?)\n  \}, \[circuitData, handleLoad, projectData, circuit, handleBuildMachine, onWiredBootReady\]\);/.exec(source);
    assert.ok(effect, 'the circuitData load effect remains identifiable');
    const batch = /ReactDOM\.unstable_batchedUpdates\(\(\) => \{([\s\S]*?)\n    \}\);/.exec(effect[1]);
    assert.ok(batch, 'the common file-load path must batch React 16 state updates');
    assert.match(batch[1], /loaded = handleLoad\(circuitData\);[\s\S]*if \(loaded\) setAnnotations\(\[\]\);/);
    assert.ok(effect[1].indexOf('prevCircuitDataRef.current = circuitData;') <
        effect[1].indexOf('ReactDOM.unstable_batchedUpdates'));
    // The shared loader now owns file authority so a host echo cannot replace
    // an opened file before the effect returns. Rejected data must not arm it.
    assert.doesNotMatch(effect[1], /fileLoadedRef\.current\s*=\s*true/);
    assert.match(effect[1], /if \(!loaded\) return;/);
    const loader = /const handleLoad = useCallback\(\(data, \{ fileAuthority = true \} = \{\}\) => \{([\s\S]*?)\n  \}, \[circuit\]\);/.exec(source);
    assert.ok(loader, 'shared file loader remains identifiable');
    const body = loader[1];
    const parse = body.indexOf('parsed = Circuit.fromJSON(data);');
    const authority = body.indexOf('fileLoadedRef.current = true;');
    const publish = body.indexOf('circuit.parts = parsed.parts;');
    assert.ok(parse >= 0 && parse < authority && authority < publish,
        'successful parsing establishes authority before publishing the circuit');
    assert.match(body, /catch \(e\) \{[\s\S]*?return false;/);
    assert.match(body, /if \(fileAuthority\) \{[\s\S]*?fileLoadedRef\.current = true;/);
};

test('the vendored circuitData path batches its atomic load transaction', () => {
    assertBatchedLoad(read(overlayPath));
});

test('the generated package mirror retains the same batching and load behavior', () => {
    const overlay = read(overlayPath);
    const packaged = read(packagePath);
    assert.equal(packaged, overlay, 'integration must not drop the React 16 batching boundary');
    assertBatchedLoad(packaged);
});
