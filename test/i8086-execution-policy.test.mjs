import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createI8086ExecutionController, I8086_EXECUTION_KEY}
    from '../overlay/scratch-gui/src/lib/bw-i8086-execution.js';

// Explicit local source mapping before the independently owned npm migration.
// No node_modules substitute or implicit sibling checkout is installed here.
let policyModule;
try {
    policyModule = await import(process.env.BW_EXECUTION_POLICY_SOURCE
        ? pathToFileURL(process.env.BW_EXECUTION_POLICY_SOURCE).href : 'bw-board/execution-policy');
} catch (error) {
    if (process.env.BW_EXECUTION_POLICY_SOURCE || error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}
const needsPolicy = {skip: !policyModule && 'Install migrated bw-board package or explicitly set BW_EXECUTION_POLICY_SOURCE'};
const controller = options => createI8086ExecutionController({storage: () => null,
    loadPolicy: async () => policyModule, ...options});

test('preference persists, rejects bad values, and has storage-free tab fallback', () => {
    const values = new Map();
    const storage = () => ({getItem: key => values.get(key), setItem: (key, value) => values.set(key, value)});
    const first = controller({storage});
    assert.equal(first.getPreference(), 'auto');
    assert.equal(first.setPreference('wired'), true);
    assert.equal(values.get(I8086_EXECUTION_KEY), 'wired');
    assert.equal(controller({storage}).getPreference(), 'wired');
    assert.throws(() => first.setPreference('wasm'), /Unknown/);
    const blocked = controller({storage: () => { throw new Error('blocked'); }});
    assert.equal(blocked.getPreference(), 'auto');
    assert.equal(blocked.setPreference('functional'), false);
    assert.equal(blocked.getPreference(), 'functional');
});

test('Auto preserves DOS/hardware semantics and exact 8086/80186 family', needsPolicy, async () => {
    for (const context of ['dos', 'hardware']) for (const family of ['8086', '80186']) {
        const app = controller();
        const result = await app.construct({context, family}, async () => ({}));
        const status = app.statusFor(result);
        assert.equal(status.actual.semantics, context === 'dos' ? 'dos-services' : 'functional-hardware');
        assert.equal(status.actual.family, family);
        assert.equal(status.actual.implementation, 'javascript');
        assert.ok(Object.isFrozen(status));
        assert.ok(Object.isFrozen(status.actual));
        app.setPreference('wired');
        assert.equal(app.snapshot().active, status, 'preference must not change the live status');
        app.release(result);
        assert.equal(app.snapshot().active, null);
    }
});

test('Functional keeps DOS services; Wired refuses before either factory runs', needsPolicy, async () => {
    const app = controller();
    app.setPreference('functional');
    await app.construct({context: 'dos'}, async () => ({}));
    assert.equal(app.snapshot().active.actual.semantics, 'dos-services');
    app.setPreference('wired');
    let calls = 0;
    for (const context of ['dos', 'hardware']) {
        await assert.rejects(app.construct({context}, async () => { calls++; return {}; }), /no-matching-implementation/);
        assert.equal(app.snapshot().active, null);
        assert.match(app.snapshot().refusal.reason, /no functional substitute/);
    }
    assert.equal(calls, 0);
});

test('status waits for actual construction and errors never claim an active backend', needsPolicy, async () => {
    const app = controller();
    let finish;
    const pending = app.construct({context: 'hardware'}, () => new Promise(resolve => { finish = resolve; }));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(app.snapshot().active, null);
    finish({});
    await pending;
    assert.ok(app.snapshot().active);
    await assert.rejects(app.construct({context: 'hardware'}, async () => { throw new Error('device creation failed'); }), /construction-failed/);
    assert.equal(app.snapshot().active, null);
    assert.match(app.snapshot().refusal.reason, /device creation failed/);
});

test('nullish package-loader rejections retain named construction refusal', async () => {
    for (const rejection of [null, undefined]) {
        const app = controller({loadPolicy: async () => { throw rejection; }});
        let calls = 0;
        await assert.rejects(app.construct({context: 'hardware'}, async () => { calls++; return {}; }),
            error => error.executionRefusal?.code === 'construction-failed' &&
                error.executionRefusal.reason === String(rejection));
        assert.equal(calls, 0);
        assert.equal(app.snapshot().active, null);
        assert.equal(app.snapshot().refusal.reason, String(rejection));
    }
});

test('nullish factory rejections retain named construction refusal', needsPolicy, async () => {
    for (const rejection of [null, undefined]) {
        const app = controller();
        await assert.rejects(app.construct({context: 'dos'}, async () => { throw rejection; }),
            error => error.executionRefusal?.code === 'construction-failed' &&
                error.executionRefusal.reason === String(rejection));
        assert.equal(app.snapshot().active, null);
        assert.equal(app.snapshot().refusal.reason, String(rejection));
    }
});

test('abort before delivery destroys the inner DOS-style target or a direct target exactly once', needsPolicy, async () => {
    for (const composite of [false, true]) {
        const app = controller();
        const lifetime = new AbortController();
        let destroyed = 0;
        let outerDestroyed = 0;
        const target = {destroy() { destroyed++; }};
        const result = composite ? {target, destroy() { outerDestroyed++; }} : target;
        await assert.rejects(app.construct({context: composite ? 'dos' : 'hardware', signal: lifetime.signal}, async () => {
            lifetime.abort();
            return result;
        }), /construction-cancelled/);
        assert.equal(destroyed, 1);
        assert.equal(outerDestroyed, 0, 'composite cleanup belongs to the target, not an unrelated outer hook');
        assert.equal(app.snapshot().active, null);
        assert.equal(app.statusFor(result), null, 'cancelled construction was never published');
    }
});

test('disposal and supersession suppress stale status; old release cannot clear a newer target', needsPolicy, async () => {
    const app = controller();
    const aborted = new AbortController();
    let finish;
    const pending = app.construct({context: 'dos', signal: aborted.signal}, () => new Promise(resolve => { finish = resolve; }));
    await new Promise(resolve => setImmediate(resolve));
    aborted.abort();
    finish({});
    await assert.rejects(pending, /construction-cancelled/);
    assert.equal(app.snapshot().active, null);
    let staleFinish;
    const stale = app.construct({context: 'dos'}, () => new Promise(resolve => { staleFinish = resolve; }));
    await new Promise(resolve => setImmediate(resolve));
    const current = await app.construct({context: 'hardware'}, async () => ({}));
    staleFinish({});
    const old = await stale;
    const status = app.snapshot().active;
    app.release(old);
    assert.equal(app.snapshot().active, status);
    app.release(current);
    assert.equal(app.snapshot().active, null);
    const lifetime = new AbortController();
    await app.construct({context: 'hardware', signal: lifetime.signal}, async () => ({}));
    assert.ok(app.snapshot().active);
    lifetime.abort();
    assert.equal(app.snapshot().active, null, 'disposal after publication clears before caller receives the result');
});

test('target boundaries, lifecycle and GUI hold actual admission/status and mirrored content', () => {
    const root = new URL('../', import.meta.url);
    const files = ['src/lib/bw-i8086-execution.js', 'src/lib/bw-debug/i8086-dos-bench.js',
        'src/lib/bw-debug/debug-runner.js', 'src/components/menu-bar/i8086-lab.jsx'];
    const texts = files.map(file => {
        const overlay = readFileSync(new URL(`overlay/scratch-gui/${file}`, root), 'utf8');
        assert.equal(readFileSync(new URL(`packages/scratch-gui/${file}`, root), 'utf8'), overlay);
        return overlay;
    });
    assert.match(texts[0], /import\('bw-board\/execution-policy'\)/);
    assert.match(texts[1], /i8086Execution\.construct\(\{context: 'dos'/);
    assert.match(texts[2], /i8086Execution\.construct\(\{context: 'hardware'/);
    assert.match(texts[2], /destroy\(\{preserveRuntime = false\} = \{\}\) \{\s*i8086ExecutionLifetime\.abort\(\);\s*i8086Execution\.release/);
    assert.match(texts[2], /catch \(e\) \{\s*unschedule\(\);\s*i8086Execution\.release/);
    assert.match(texts[3], /i8086Execution\.subscribe\(setExecutionState\)/);
    assert.match(texts[3], /Wired digital \(unavailable/);
    assert.match(texts[3], /8086 execution preference \(this browser\)/);
    assert.match(texts[3], /not saved in the project/);
    assert.match(texts[3], /Decoded blocks and Wasm are not supported project backends/);
});
