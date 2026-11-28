import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {balancedFrom, scopeAfter} from './helpers/js-scope.mjs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const overlayPath = 'node_modules/bw-circuit-ui/src/components/CircuitDesigner.jsx';
const packagePath = 'packages/scratch-gui/node_modules/bw-circuit-ui/src/components/CircuitDesigner.jsx';

const assertBatchedLoad = source => {
    assert.match(source, /import ReactDOM from 'react-dom';/);
    // New callbacks may extend the dependency list. Inspect the actual effect
    // body, without depending on that list or spilling into the next effect.
    const effect = scopeAfter(source, 'const prevCircuitDataRef = useRef(null);');
    const batch = scopeAfter(effect, 'ReactDOM.unstable_batchedUpdates(() =>');
    assert.match(batch, /loaded = handleLoad\(circuitData\);[\s\S]*if \(loaded\) setAnnotations\(\[\]\);/);
    const remembered = effect.indexOf('prevCircuitDataRef.current = circuitData;');
    assert.ok(remembered >= 0 && remembered < effect.indexOf('ReactDOM.unstable_batchedUpdates'));
    // The shared loader now owns file authority so a host echo cannot replace
    // an opened file before the effect returns. Rejected data must not arm it.
    assert.doesNotMatch(effect, /fileLoadedRef\.current\s*=\s*true/);
    assert.match(effect, /if \(!loaded\) return;/);
    const loader = /const handleLoad = useCallback\(\(data, \{ fileAuthority = true \} = \{\}\) => \{/.exec(source);
    assert.ok(loader, 'shared file loader remains identifiable');
    // Start at the callback body, past both destructuring/default braces.
    const body = balancedFrom(source, loader.index + loader[0].length - 1, '{', '}');
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

test('the batching gate rejects broken transactions and cannot borrow a following effect', () => {
    const source = read(overlayPath);
    const mutations = [
        ['missing batch', 'ReactDOM.unstable_batchedUpdates(() =>', 'runWithoutBatch(() =>'],
        ['forgotten input identity', 'prevCircuitDataRef.current = circuitData;', ''],
        ['unconditional annotation clear', 'if (loaded) setAnnotations([]);', 'setAnnotations([]);'],
        ['rejected load falls through', 'if (!loaded) return;', ''],
        ['effect re-arms authority', 'if (!loaded) return;', 'if (!loaded) return; fileLoadedRef.current = true;'],
        ['publish before parsing', 'parsed = Circuit.fromJSON(data);', 'circuit.parts = parsed.parts; parsed = Circuit.fromJSON(data);'],
        ['load guard removed', 'if (fileAuthority) {', 'if (true) {']
    ];
    for (const [label, before, after] of mutations) {
        assert.ok(source.includes(before), `mutation applies: ${label}`);
        const broken = source.replace(before, after);
        assert.throws(() => assertBatchedLoad(broken), undefined, label);
    }
    const batch = scopeAfter(source, 'ReactDOM.unstable_batchedUpdates(() =>');
    const broken = source.replace('ReactDOM.unstable_batchedUpdates(() =>', 'runWithoutBatch(() =>');
    assert.throws(() => assertBatchedLoad(`${broken}\nuseEffect(() => {
        ReactDOM.unstable_batchedUpdates(() => ${batch});
    }, []);`), undefined, 'a different effect cannot satisfy the load transaction');
});
