import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {renderInventoryModule, syncInventoryModules} from '../scripts/generate-runtime-package-inventory.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const CANONICAL = 'overlay/scratch-gui/src/lib/runtime-package-inventory.json';
const GENERATOR = 'scripts/generate-runtime-package-inventory.mjs';
const OUTPUTS = [
    'overlay/scratch-gui/src/lib/runtime-package-inventory.mjs',
    'packages/scratch-gui/src/lib/runtime-package-inventory.mjs',
    'packages/scratch-gui/src/lib/runtime-package-inventory.json'
];
const MEMBERS = ['cc1.js', 'cc1.wasm', 'sdcc.js', 'sdcc.wasm', 'sdas8051.js',
    'sdas8051.wasm', 'sdld.js', 'sdld.wasm', 'runtime.json'];

// Exact removed bridge, Git blob 6b3269176810d58241a8ab50c511e7fff8f5f7f4.
// Node's native CJS interop accepted it; the browser's ESM linker did not.
const LEGACY_CJS = '/* JSON interop for webpack and direct Node consumers of the toolchain loader. */\n' +
    "module.exports = require('./runtime-package-inventory.json');\n";

const VM_GRAPH = String.raw`
    import assert from 'node:assert/strict';
    import {readFileSync} from 'node:fs';
    import {pathToFileURL, fileURLToPath} from 'node:url';
    import path from 'node:path';
    import {SourceTextModule, createContext, runInContext} from 'node:vm';
    const input = JSON.parse(readFileSync(0, 'utf8'));
    const base = pathToFileURL(path.join(input.root, 'overlay/scratch-gui/src/lib/') ).href;
    const entry = new URL('sdcc-wasm/toolchain-source.js', base).href;
    const inventory = new URL('runtime-package-inventory.mjs', base).href;
    const policy = new URL('distribution-policy.js', base).href;
    const context = createContext({URL, URLSearchParams});
    const modules = new Map();
    const load = identifier => {
        assert.ok(identifier.startsWith(base), 'browser graph stays inside its source tree');
        if (modules.has(identifier)) return modules.get(identifier);
        let source = identifier === inventory && input.legacy
            ? input.legacy : readFileSync(fileURLToPath(identifier), 'utf8');
        if (identifier === policy) {
            // These are the documented bundler defines, not a process shim.
            // All other source bytes, including the loader's Node detection, run unchanged.
            source = source.replace(/process\.env\.(BW_REMOTE_(?:EXTENSIONS|TOOLCHAINS|MACHINE_IMAGES|CODE)_POLICY)\b/g,
                () => JSON.stringify(input.policy));
        }
        const module = new SourceTextModule(source, {context, identifier,
            importModuleDynamically: () => { throw new Error('unexpected dynamic browser import'); }});
        modules.set(identifier, module);
        return module;
    };
    const loader = load(entry);
    try {
        await loader.link((specifier, referencing) => {
            assert.match(specifier, /^\.{1,2}\//, 'only actual relative browser modules may link');
            return load(new URL(specifier, referencing.identifier).href);
        });
    } catch (error) {
        if (!input.legacy) throw error;
        assert.equal(error.name, 'SyntaxError');
        assert.match(error.message, /does not provide an export named 'default'/);
        console.log(JSON.stringify({stage: 'link', message: error.message}));
        process.exit(0);
    }
    assert.ok(!input.legacy, 'the original CommonJS bridge must fail static default-export linking');
    await loader.evaluate();
    context.loader = loader.namespace;
    context.inventory = modules.get(inventory).namespace.default;
    const report = runInContext('(() => {' +
        'const empty = {getItem: () => null};' +
        'const stored = mode => ({getItem: key => key === loader.TOOLCHAIN_MODE_KEY ? mode : null});' +
        'const win = (mode, search = "") => ({location: {search, hash: ""}, localStorage: stored(mode)});' +
        'return {' +
        'absentGlobals: ["process", "require", "module", "exports", "Buffer", "fetch", "caches"].map(key => typeof globalThis[key]),' +
        'inventory, files: loader.TOOLCHAIN_FILES, origin: loader.GPL_TOOLCHAIN_ORIGIN, cache: loader.TOOLCHAIN_CACHE,' +
        'frozenFiles: Object.isFrozen(loader.TOOLCHAIN_FILES),' +
        'withoutStorage: loader.getToolchainMode(), emptyStorage: loader.getToolchainMode(empty),' +
        'refusedStorage: loader.getToolchainMode({getItem: () => {throw new Error("refused");}}),' +
        'storedModes: ["online", "local", "dev", "invalid"].map(mode => loader.getToolchainMode(stored(mode))),' +
        'defaultEnabled: loader.localToolchainEnabled(win(null)),' +
        'localEnabled: loader.localToolchainEnabled(win("local")),' +
        'explicitOn: loader.localToolchainEnabled(win(null, "?localCompiler=on")),' +
        'explicitOff: loader.localToolchainEnabled(win("local", "?localCompiler=off"))' +
        '};})()', context);
    report.modules = [...modules.keys()].map(url => url.slice(base.length)).sort();
    console.log(JSON.stringify(report));
`;

function vmProbe(script, input) {
    const result = spawnSync(process.execPath,
        ['--experimental-vm-modules', '--input-type=module', '-e', script], {
            input: JSON.stringify(input), encoding: 'utf8', timeout: 10000
        });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout);
}

test('checked-in inventory entries and JSON mirror match deterministic generation', async () => {
    await syncInventoryModules({root: ROOT, check: true});
});

test('the actual browser graph links inventory ESM without CommonJS or Node globals', () => {
    const expected = JSON.parse(readFileSync(path.join(ROOT, CANONICAL), 'utf8'));
    const record = expected.packages.find(item => item.id === 'sdcc-wasm');
    assert.deepEqual(record.files, MEMBERS);
    for (const policy of ['allow', 'deny']) {
        const report = vmProbe(VM_GRAPH, {root: ROOT, policy});
        assert.deepEqual(report.modules, ['distribution-policy.js', 'runtime-package-inventory.mjs',
            'sdcc-wasm/toolchain-source.js', 'sdcc-wasm/toolchain-store.js']);
        assert.deepEqual(report.absentGlobals, Array(7).fill('undefined'));
        assert.deepEqual(report.inventory, expected);
        assert.deepEqual(report.files, MEMBERS);
        assert.equal(report.origin, record.origin);
        assert.equal(report.cache, record.cacheName);
        assert.equal(report.frozenFiles, true);
        assert.equal(report.withoutStorage, 'online', 'a browser must not inherit the Node-local default');
        assert.equal(report.emptyStorage, 'online');
        assert.equal(report.refusedStorage, 'online');
        assert.deepEqual(report.storedModes, ['online', 'local', 'dev', 'online']);
        assert.equal(report.defaultEnabled, false);
        assert.equal(report.localEnabled, policy === 'allow');
        assert.equal(report.explicitOn, policy === 'allow');
        assert.equal(report.explicitOff, false);
    }
});

test('the same browser graph rejects the original CommonJS bridge at default-export linking', () => {
    const report = vmProbe(VM_GRAPH, {root: ROOT, policy: 'allow', legacy: LEGACY_CJS});
    assert.equal(report.stage, 'link');
    assert.match(report.message, /runtime-package-inventory\.mjs/);
});

function fixture(t) {
    const root = mkdtempSync(path.join(tmpdir(), 'bw-inventory-interop-'));
    t.after(() => rmSync(root, {recursive: true, force: true}));
    for (const name of [CANONICAL, GENERATOR]) {
        mkdirSync(path.dirname(path.join(root, name)), {recursive: true});
        writeFileSync(path.join(root, name), readFileSync(path.join(ROOT, name)));
    }
    const run = (...args) => {
        const result = spawnSync(process.execPath, [path.join(root, GENERATOR), ...args], {
            cwd: root, encoding: 'utf8', timeout: 10000
        });
        assert.ifError(result.error);
        return result;
    };
    const snapshot = () => OUTPUTS.map(name => readFileSync(path.join(root, name)));
    assert.equal(run().status, 0, 'generate the minimal fixture before checking it');
    return {root, run, snapshot};
}

test('real generator --check rejects each stale output without repairing it', t => {
    const f = fixture(t);
    const canonical = readFileSync(path.join(f.root, CANONICAL));
    assert.equal(f.run('--check').status, 0);
    for (const name of OUTPUTS) {
        appendFileSync(path.join(f.root, name), '\n');
        const before = f.snapshot();
        const result = f.run('--check');
        assert.notEqual(result.status, 0, name);
        assert.match(result.stderr, /outputs are stale/);
        assert.ok(result.stderr.includes(name), result.stderr);
        assert.deepEqual(f.snapshot(), before, '--check must not rewrite any output');
        assert.deepEqual(readFileSync(path.join(f.root, CANONICAL)), canonical);
        assert.equal(f.run().status, 0);
        assert.equal(f.run('--check').status, 0);
    }
});

test('canonical JSON changes require regenerated browser entries and an exact JSON mirror', async t => {
    const f = fixture(t);
    const changed = JSON.parse(readFileSync(path.join(f.root, CANONICAL), 'utf8'));
    changed.packages.find(item => item.id === 'sdcc-wasm').cacheName += '-interop-fixture';
    const canonical = JSON.stringify(changed, null, 2) + '\n';
    writeFileSync(path.join(f.root, CANONICAL), canonical);
    const before = f.snapshot();
    const stale = f.run('--check');
    assert.notEqual(stale.status, 0);
    for (const name of OUTPUTS) assert.ok(stale.stderr.includes(name), name);
    assert.deepEqual(f.snapshot(), before);
    assert.equal(f.run().status, 0);
    assert.equal(f.run('--check').status, 0);
    assert.equal(readFileSync(path.join(f.root, CANONICAL), 'utf8'), canonical);
    assert.equal(readFileSync(path.join(f.root, OUTPUTS[2]), 'utf8'), canonical);
    assert.deepEqual(readFileSync(path.join(f.root, OUTPUTS[0])), readFileSync(path.join(f.root, OUTPUTS[1])));
    for (const name of OUTPUTS.slice(0, 2)) {
        const module = await import(pathToFileURL(path.join(f.root, name)).href);
        assert.deepEqual(module.default, changed, 'regeneration must change evaluated inventory data');
    }
});

test('malformed canonical JSON or UTF-8 cannot overwrite previously generated outputs', t => {
    const f = fixture(t);
    const before = f.snapshot();
    // Replacement UTF-8 decoding would leave valid JSON, so the second case
    // specifically requires the generator's fatal decoding boundary.
    const invalidUtf8 = Buffer.concat([Buffer.from('{"name":"'), Buffer.from([0x80]), Buffer.from('"}')]);
    for (const bad of [Buffer.from('{'), invalidUtf8]) {
        writeFileSync(path.join(f.root, CANONICAL), bad);
        const result = f.run();
        assert.notEqual(result.status, 0);
        assert.deepEqual(f.snapshot(), before);
        assert.deepEqual(readFileSync(path.join(f.root, CANONICAL)), bad);
    }
});

test('rendered ESM preserves JSON special keys, duplicate keys and string separators', () => {
    const json = '{"__proto__":{"polluted":true},"constructor":"data","duplicate":1,"duplicate":2,' +
        '"nested":{"__proto__":null},"values":[null,true,false,-0,1e30],"text":"a\u2028b\u2029c"}';
    const moduleText = renderInventoryModule(json);
    const report = vmProbe(String.raw`
        import {readFileSync} from 'node:fs';
        import {SourceTextModule, createContext, runInContext} from 'node:vm';
        const {source} = JSON.parse(readFileSync(0, 'utf8'));
        const context = createContext({});
        const module = new SourceTextModule(source, {context});
        await module.link(() => { throw new Error('inventory must have no imports'); });
        await module.evaluate();
        context.value = module.namespace.default;
        console.log(runInContext('JSON.stringify({' +
            'value, ownProto: Object.hasOwn(value, "__proto__"),' +
            'nestedOwnProto: Object.hasOwn(value.nested, "__proto__"),' +
            'ordinaryPrototype: Object.getPrototypeOf(value) === Object.prototype,' +
            'unpollutedPrototype: Object.prototype.polluted === undefined,' +
            'negativeZero: Object.is(value.values[3], -0)' +
            '})', context));
    `, {source: moduleText});
    assert.deepEqual(report.value, JSON.parse(JSON.stringify(JSON.parse(json))));
    assert.equal(report.ownProto, true);
    assert.equal(report.nestedOwnProto, true);
    assert.equal(report.ordinaryPrototype, true);
    assert.equal(report.unpollutedPrototype, true);
    assert.equal(report.negativeZero, true);
    assert.throws(() => renderInventoryModule('{'), SyntaxError);
});
