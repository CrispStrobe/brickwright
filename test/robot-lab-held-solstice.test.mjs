// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, chmodSync, symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {EventEmitter} from 'node:events';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {quietConsole} from './helpers/quiet-console.mjs';
import {Q5_HELD, heldBuildInventory, heldRuntimeSnapshot, assertHeldPrivateDirectory, assertHeldSourceBytes, heldModelSource, heldCLIRequest, finishHeldDriver, requestedHeldQ5Models, heldQ5Contract, heldUsesR4Control, heldBrowserOptions, runHeldQ5Checks, selectedHeldQ5Models, assertHeldManualCoverage, withHeldPageErrors, finishHeldCleanup} from '../scripts/lib/sim-lab-q5-held.mjs';
const browserGate = () => import('../scripts/lib/sim-lab-q5-browser-gate.mjs');
import {intakeIdentity, writeIntakeReceipt} from '../scripts/lib/sim-lab-intake-receipt.mjs';
import {EXPERIMENTAL_MODELS} from '../overlay/scratch-gui/src/lib/bw-sim/model/experimental-models.js';

const id = 'solstice-pumpjack';
test('a held case is explicitly selected without joining promoted or default cases', async () => {
    const {Q5_BROWSER_MODELS, R4_BROWSER_MODELS} = await browserGate();
    assert.deepEqual(selectedHeldQ5Models([]), []);
    assert.deepEqual(selectedHeldQ5Models(['tempest-pendulum']), []);
    assert.deepEqual(selectedHeldQ5Models([id]), [id]);
    assert.deepEqual(selectedHeldQ5Models(['__proto__', 'unknown']), []);
    assert.ok(!Q5_BROWSER_MODELS.includes(id));
    assert.deepEqual(R4_BROWSER_MODELS, ['tempest-pendulum']);
    const verify = readFileSync(new URL('../scripts/verify-sim-lab-browser.mjs', import.meta.url), 'utf8');
    assert.match(verify, /\.\.\.HELD_MODELS/, 'browser loop must consume the held selection');
    assert.match(verify, /\.\.\.heldBrowserOptions\(id\)/, 'held lesson options must reach the browser loop');
});

test('held contract retains the reviewed law, control and timing without promotion', async () => {
    const {judgeQ5Browser} = await browserGate();
    assert.deepEqual(heldQ5Contract(id), {id, judge: 'walking-beam-v1', parts: 93, ports: ['A'],
        coldMs: 500, timeLimitMs: 90000, afterMs: 500, frameMs: 25, frozenOutput: 'walking_beam',
        disconnect: ['pin_P'], disconnectInputDeg: 350, disconnectLoss: 'r4'});
    assert.ok(Object.isFrozen(Q5_HELD) && Object.isFrozen(Q5_HELD[id]) && Object.isFrozen(Q5_HELD[id].disconnect));
    assert.throws(() => heldQ5Contract('__proto__'), /No reviewed held Q5 contract/);
    assert.equal(heldUsesR4Control(id), true);
    assert.equal(heldUsesR4Control('tempest-pendulum'), false);
    assert.throws(() => judgeQ5Browser(id, {}, heldQ5Contract(id)), 'the real law must reject an empty track');
    const registry = JSON.parse(readFileSync(new URL('../docs/data/robot-lab-qualification.json', import.meta.url)));
    assert.ok(!registry.models.some(x => x.id === id));
    const gate = readFileSync(new URL('../scripts/lib/sim-lab-q5-browser-gate.mjs', import.meta.url), 'utf8');
    assert.match(gate, /held \? heldQ5Contract\(id\) : contractOf\(id\)/);
    assert.match(gate, /judge: \(_, r\) => judgeQ5Browser\(id, r, c\)/, 'main run must invoke the real law');
    assert.match(gate, /runHeldQ5Checks\(mainCheck, \(\) => controlCheck\(\), c\)/, 'held run must execute both checks');
    assert.match(gate, /held \? \{includeExperimental: true\} : \{\}/);
    assert.match(gate, /R4_BROWSER_MODELS\.includes\(id\) \|\| heldUsesR4Control\(id\)/);
    assert.match(gate, /heldUsesR4Control\(id\) \|\| \[\.\.\.R2_BROWSER_MODELS/);
});

test('held control runs after base failure and the original failure stays fatal', async () => {
    const original = new Error('base-law failure');
    const seen = [];
    await assert.rejects(runHeldQ5Checks(async () => { seen.push('base'); throw original; },
        async () => { seen.push('pin_P control'); return {inputTravelDeg: 360, loss: {lost: true}}; }, heldQ5Contract(id)), error => {
        assert.ok(error instanceof AggregateError);
        assert.deepEqual(error.errors, [original]);
        assert.deepEqual(error.observations.control, {inputTravelDeg: 360, loss: {lost: true}});
        return true;
    });
    assert.deepEqual(seen, ['base', 'pin_P control']);
});

test('both failures survive and missing results fail closed', async () => {
    const base = new Error('base'), control = new Error('control');
    await assert.rejects(runHeldQ5Checks(async () => { throw base; }, async () => { throw control; }, heldQ5Contract(id)),
        e => e instanceof AggregateError && e.errors[0] === base && e.errors[1] === control);
    await assert.rejects(runHeldQ5Checks(async () => undefined, async () => undefined, heldQ5Contract(id)),
        e => e instanceof AggregateError && e.errors.length === 2);
    const main = async () => ({beamErrorDeg: .01, pistonErrorMm: .02, frames: 200});
    await assert.rejects(runHeldQ5Checks(main,
        async () => ({inputTravelDeg: 360, loss: {lost: false}}), heldQ5Contract(id)), AggregateError);
    await assert.rejects(runHeldQ5Checks(main,
        async () => ({inputTravelDeg: 350, loss: {lost: true}}), heldQ5Contract(id)), AggregateError);
    assert.deepEqual(await runHeldQ5Checks(async () => ({beamErrorDeg: .01, pistonErrorMm: .02, frames: 200}),
        async () => ({inputTravelDeg: 360, loss: {lost: true}}), heldQ5Contract(id)),
        {main: {beamErrorDeg: .01, pistonErrorMm: .02, frames: 200}, control: {inputTravelDeg: 360, loss: {lost: true}}});
});


test('held lessons select the experimental gallery in both languages', async () => {
    const {newModelLesson} = await import('../scripts/lib/sim-lab-new-models-gate.mjs');
    for (const language of ['en', 'de']) {
        let checked = false;
        const stop = new Error('lesson selection reached');
        const card = {count: async () => checked ? 1 : 0, getByRole: () => ({click: async () => {}})};
        const gallery = {
            getByRole: (role, opts = {}) => role === 'checkbox' ? {check: async () => {
                assert.ok(opts.name.test(language === 'de' ? 'Experimentelle Modelle anzeigen' : 'Include experimental'));
                checked = true;
            }} : {fill: async value => assert.equal(value, id)},
            locator: selector => { assert.equal(selector, `[data-model="${id}.ldr"]`); return card; },
            waitFor: async () => {}
        };
        const page = {
            evaluate: async () => null,
            getByTestId: name => name === 'bw-sim-examples' ? gallery : {click: async () => {
                if (name === 'bw-sim-lab-lesson') throw stop;
                assert.equal(name, 'bw-sim-lab-examples');
            }},
            waitForFunction: async () => {}
        };
        const opts = {openSimLab: async () => {}, ...heldBrowserOptions(id)};
        await assert.rejects(newModelLesson(page, opts, id, language), error => error === stop);
        assert.equal(checked, true, `${language}: experimental checkbox selected`);
        checked = false;
        await assert.rejects(newModelLesson(page, {openSimLab: async () => {}}, id, language), /gallery card/);
    }
    assert.deepEqual(heldBrowserOptions('tempest-pendulum'), {});
});

test('manual held coverage requires observed motion on exactly A', () => {
    const c = heldQ5Contract(id);
    assert.doesNotThrow(() => assertHeldManualCoverage(id, {[id]: {A: 2}}, c));
    for (const sample of [{}, {[id]: {}}, {[id]: {B: 2}}, {[id]: {A: 0}}, {[id]: {A: 2, B: 1}}]) {
        assert.throws(() => assertHeldManualCoverage(id, sample, c));
    }
});

test('held page errors are retained even when an action fails', async () => {
    const page = new EventEmitter(), original = new Error('base failure');
    let stored;
    await assert.rejects(withHeldPageErrors(page, errors => { stored = [...errors]; }, async () => {
        page.emit('pageerror', new Error('page exploded'));
        throw original;
    }), error => error === original);
    assert.equal(stored.length, 1);
    assert.match(stored[0], /page exploded/);
    assert.equal(page.listenerCount('pageerror'), 0);
    await assert.rejects(withHeldPageErrors(page, errors => { stored = [...errors]; }, async () => {
        page.emit('pageerror', new Error('otherwise hidden'));
    }), /held page errors/);
    assert.match(stored[0], /otherwise hidden/);
    assert.equal(page.listenerCount('pageerror'), 0);
});


test('actual held controller retains both failures and page errors', async () => {
    const {q5BrowserInteractions} = await browserGate();
    const dir = mkdtempSync(join(tmpdir(), 'held-solstice-source-'));
    class FakePage extends EventEmitter {
        constructor(kind) { super(); this.kind = kind; this.closed = false; }
        context() { return {browser: () => ({newPage: async () => control})}; }
        async evaluate() { return {sourceControl: this.kind}; }
        async close() { this.closed = true; }
    }
    const main = new FakePage('main'), control = new FakePage('control'), shots = join(dir, 'held');
    try {
        await assert.rejects(q5BrowserInteractions(main, {shotsDir: shots, openSimLab: async page => {
            page.emit('pageerror', new Error(`${page.kind} page error`));
            throw new Error(`${page.kind} setup failed`);
        }}, id), error => error instanceof AggregateError && error.errors.length === 2 &&
            error.errors[0].message === 'main setup failed' && error.errors[1].message === 'control setup failed');
        const read = suffix => JSON.parse(readFileSync(join(shots, `${id}-${suffix}.json`)));
        assert.deepEqual(read('held-failure').failures.map(x => x.message), ['main setup failed', 'control setup failed']);
        assert.match(read('main-page-errors')[0], /main page error/);
        assert.match(read('disconnected-page-errors')[0], /control page error/);
        assert.equal(control.closed, true);
        assert.equal(main.listenerCount('pageerror'), 0);
    } finally { rmSync(dir, {recursive: true, force: true}); }
});


test('manual model selection includes the unblocked held model', () => {
    const entry = EXPERIMENTAL_MODELS.find(x => x.file === `${id}.ldr`);
    assert.ok(entry && entry.experimental && !entry.blocked);
    assert.equal(entry.id || entry.file, `${id}.ldr`);
    const lib = readFileSync(new URL('../overlay/scratch-gui/src/lib/bw-sim/sim-lab.js', import.meta.url), 'utf8');
    const pane = readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/sim-lab-pane.jsx', import.meta.url), 'utf8');
    assert.match(lib, /\.\.\.QUALIFIED_MODELS, \.\.\.EXPERIMENTAL_MODELS/);
    assert.match(pane, /this\.lib\.MODELS\.map\(m => <option key=\{modelKey\(m\)\} value=\{modelKey\(m\)\} disabled=\{m\.blocked\}/);
});

test('completed raw tracks are written before their law assertions', () => {
    const mechanics = readFileSync(new URL('../scripts/lib/sim-lab-mechanics-gate.mjs', import.meta.url), 'utf8');
    const gate = readFileSync(new URL('../scripts/lib/sim-lab-q5-browser-gate.mjs', import.meta.url), 'utf8');
    const roundtrip = readFileSync(new URL('../scripts/lib/sim-lab-intake-roundtrip.mjs', import.meta.url), 'utf8');
    const before = (source, first, second) => {
        const a = source.indexOf(first), b = source.indexOf(second);
        assert.ok(a >= 0 && b > a, `${first} must precede ${second}`);
    };
    before(mechanics, "id+'-actual-track.json'", 'results[id] = await judge(id, r)');
    const cut = gate.slice(gate.indexOf('async function r2Disconnected'), gate.indexOf('export async function q5SeparateControl'));
    before(cut, "id + '-disconnected-track.json'", 'const loss = familyLoss(id, r)');
    before(roundtrip, "id+'-reopened-track.json'", 'await judge(id,r)');
    assert.match(roundtrip, /if\(opts\.retainPageErrors\)await finishHeldCleanup/);
});


test('held controller refuses any existing evidence directory', async () => {
    const {q5BrowserInteractions} = await browserGate();
    const dir = mkdtempSync(join(tmpdir(), 'held-solstice-preserve-'));
    try {
        for (const [index, file] of ['measurements.json', `${id}-actual-track.json`, `${id}-manual.png`, `${id}-lesson-en.png`].entries()) {
            const shots = join(dir, String(index)), target = join(shots, file), original = 'retained evidence';
            mkdirSync(shots); writeFileSync(target, original);
            const page = new EventEmitter(); let called = false;
            await assert.rejects(q5BrowserInteractions(page, {shotsDir: shots, openSimLab: async () => { called = true; }}, id), error => error.code === 'EEXIST');
            assert.equal(called, false);
            assert.equal(readFileSync(target, 'utf8'), original);
        }
    } finally { rmSync(dir, {recursive: true, force: true}); }
});

test('held action, persistence, and cleanup failures remain in order', async () => {
    const page = new EventEmitter(), primary = new Error('main action'), persist = new Error('persist failed'), off = new Error('off failed');
    let offCalled = false; page.off = () => { offCalled = true; throw off; };
    await assert.rejects(withHeldPageErrors(page, () => { throw persist; }, async () => { throw primary; }), error =>
        error instanceof AggregateError && error.errors[0] === primary && error.errors[1] === persist && error.errors[2] === off);
    assert.equal(offCalled, true);
    let secondCalled = false;
    await assert.rejects(finishHeldCleanup(primary, [() => { throw persist; }, () => { secondCalled = true; throw off; }]), error =>
        error instanceof AggregateError && error.errors[0] === primary && error.errors[1] === persist && error.errors[2] === off);
    assert.equal(secondCalled, true);
    await assert.rejects(withHeldPageErrors(new EventEmitter(), () => { throw persist; }, async () => { throw undefined; }), error =>
        error instanceof AggregateError && error.errors.length === 2 && error.errors[0] === undefined && error.errors[1] === persist);
});

test('actual held controller records nested control and close failures', async () => {
    const {q5BrowserInteractions} = await browserGate();
    const dir = mkdtempSync(join(tmpdir(), 'held-solstice-nested-')), shots = join(dir, 'held');
    class FakePage extends EventEmitter {
        constructor(kind) { super(); this.kind = kind; }
        context() { return {browser: () => ({newPage: async () => control})}; }
        async evaluate() { return {sourceControl: this.kind}; }
        async close() { throw new Error('control close failed'); }
    }
    const main = new FakePage('main'), control = new FakePage('control');
    try {
        await assert.rejects(q5BrowserInteractions(main, {shotsDir: shots, openSimLab: async page => {
            throw new Error(`${page.kind} setup failed`);
        }}, id), error => error instanceof AggregateError && error.errors[0].message === 'main setup failed' &&
            error.errors[1] instanceof AggregateError && error.errors[1].errors.map(e => e.message).join('|') === 'control setup failed|control close failed');
        const receipt = JSON.parse(readFileSync(join(shots, `${id}-held-failure.json`)));
        assert.equal(receipt.failures[0].message, 'main setup failed');
        assert.deepEqual(receipt.failures[1].errors.map(e => e.message), ['control setup failed', 'control close failed']);
    } finally { rmSync(dir, {recursive: true, force: true}); }
});

test('held roundtrip keeps action and close failures with its page errors', async () => {
    const {replayIntakeProject} = await import('../scripts/lib/sim-lab-intake-roundtrip.mjs');
    const dir = mkdtempSync(join(tmpdir(), 'held-solstice-roundtrip-'));
    const project = join(dir, `${id}.sb3`), receipt = join(dir, `${id}-intake.json`);
    class FakePage extends EventEmitter { async close() { throw new Error('reopen close failed'); } }
    const page = new FakePage();
    try {
        writeFileSync(join(dir, 'brickwright-build.json'), '{}');
        writeFileSync(project, 'fake source-control project');
        const identity = intakeIdentity(id, dir);
        writeIntakeReceipt(receipt, {id, identity, project, record: {ldraw: 'fake'}, expected: ['part'],
            program: [{name: 'sprite', operations: [['move', 1]]}]});
        await assert.rejects(replayIntakeProject({newPage: async () => page}, {
            shotsDir: dir, buildDir: dir, retainPageErrors: true, openSimLab: async () => {
                page.emit('pageerror', new Error('reopen page error'));
                throw new Error('reopen action failed');
            }
        }, id, () => {}, receipt), error => error instanceof AggregateError &&
            error.errors.map(e => e.message).join('|') === 'reopen action failed|reopen close failed');
        assert.deepEqual(JSON.parse(readFileSync(join(dir, `${id}-reopened-page-errors.json`))), ['reopen page error']);
    } finally { rmSync(dir, {recursive: true, force: true}); }
});


test('dedicated held namespace refuses unknown requests while ordinary filters stay unchanged', () => {
    assert.deepEqual(requestedHeldQ5Models(['ordinary-unknown']), []);
    assert.deepEqual(requestedHeldQ5Models([], [id]), [id]);
    assert.deepEqual(requestedHeldQ5Models([id], [id]), [id]);
    assert.throws(() => requestedHeldQ5Models([], ['solstice-typo']), /No reviewed held Q5 diagnostic/);
    const source = readFileSync(new URL('../scripts/verify-sim-lab-browser.mjs', import.meta.url), 'utf8');
    assert.ok(source.indexOf('const heldRequest = heldCLIRequest(process.argv)') < source.indexOf('await chromium.launch'));
    assert.ok(source.indexOf('heldDiagnosticIdentity(build)') < source.indexOf('await chromium.launch'));
});

test('held build inventory refuses wrong source and binds every built runtime byte', () => {
    const dir = mkdtempSync(join(tmpdir(), 'held-build-identity-')), commit = 'a'.repeat(40);
    try {
        writeFileSync(join(dir, 'brickwright-build.json'), JSON.stringify({schema: 2, product: 'Brickwright', commit: commit.slice(0, 7)}));
        writeFileSync(join(dir, 'worker.js'), 'actual built worker bytes');
        writeFileSync(join(dir, 'physics.wasm'), 'actual built engine bytes');
        const original = heldBuildInventory(dir, commit);
        assert.deepEqual(Object.keys(original.files).sort(), ['brickwright-build.json', 'physics.wasm', 'worker.js']);
        assert.throws(() => heldBuildInventory(dir, 'b'.repeat(40)), /built from this source/);
        writeFileSync(join(dir, 'physics.wasm'), 'different engine');
        assert.notEqual(heldBuildInventory(dir, commit).files['physics.wasm'], original.files['physics.wasm']);
    } finally { rmSync(dir, {recursive: true, force: true}); }
});


test('a spoofed matching build stamp remains explicitly unqualified', () => {
    const dir = mkdtempSync(join(tmpdir(), 'held-spoofed-stamp-')), commit = 'a'.repeat(40);
    try {
        writeFileSync(join(dir, 'brickwright-build.json'), JSON.stringify({schema: 2, product: 'Brickwright', commit: commit.slice(0, 7), producer: 'invented', admitted: true}));
        writeFileSync(join(dir, 'worker.js'), 'arbitrary unrelated bytes');
        const observation = heldBuildInventory(dir, commit);
        assert.equal(observation.qualification, 'not-admitted-observation-only');
        assert.equal(observation.producerSourceBinding, false);
        assert.equal(observation.stamp.admitted, undefined);
    } finally { rmSync(dir, {recursive: true, force: true}); }
});

test('held runtime summary excludes sensitive URL, blocks, track data and paths', () => {
    const oldWindow = globalThis.window, oldPerformance = Object.getOwnPropertyDescriptor(globalThis, 'performance');
    const secret = 'https://private.example/path?token=secret#/sensitive/operator';
    try {
        globalThis.window = {__bwSimLab: {status: secret, _pane: {state: {modelFile: secret, shipped: secret}, props: {vm: {runtime: {targets: [{getName: () => secret, blocks: {_blocks: {x: {text: secret}}}}]}}}, session: {worker: {}}}}, __bwMechanics: {track: [{variables: {secret}}]}};
        Object.defineProperty(globalThis, 'performance', {configurable: true, value: {getEntriesByType: () => [{name: secret, initiatorType: 'script'}, {name: secret, initiatorType: secret}]}});
        const result = heldRuntimeSnapshot(), text = JSON.stringify(result);
        assert.equal(result.program.blocks, 1); assert.equal(result.resources.script, 1);
        for (const sensitive of ['private.example', 'token', 'secret', '/sensitive/', 'variables', 'getName', 'url']) assert.ok(!text.includes(sensitive));
    } finally { globalThis.window = oldWindow; Object.defineProperty(globalThis, 'performance', oldPerformance); }
});

test('held raw errors and tracks require a private directory outside the checkout', () => {
    const dir = mkdtempSync(join(tmpdir(), 'held-private-output-'));
    const beforeCI = process.env.CI, beforeActions = process.env.GITHUB_ACTIONS;
    try {
        delete process.env.GITHUB_ACTIONS;
        process.env.CI = 'true'; // Kaggle/private runners may set this generic flag.
        assert.equal(assertHeldPrivateDirectory(dir), dir);
        chmodSync(dir, 0o755);
        assert.throws(() => assertHeldPrivateDirectory(dir), /mode 0700/);
        chmodSync(dir, 0o700);
        const link = dir + '-link'; symlinkSync(dir, link);
        try { assert.throws(() => assertHeldPrivateDirectory(link), /symlink routing/); } finally { rmSync(link); }
        assert.throws(() => assertHeldPrivateDirectory('relative-output'));
        assert.throws(() => assertHeldPrivateDirectory(new URL('..', import.meta.url).pathname));
        process.env.GITHUB_ACTIONS = 'true';
        assert.throws(() => heldCLIRequest([`--held-examples=${id}`, '--part=examples']), /public Actions/);
    } finally {
        if (beforeCI === undefined) delete process.env.CI; else process.env.CI = beforeCI;
        if (beforeActions === undefined) delete process.env.GITHUB_ACTIONS; else process.env.GITHUB_ACTIONS = beforeActions;
        rmSync(dir, {recursive: true, force: true});
    }
});

test('held model input ignores another working directory and checks exact git bytes', () => {
    const cwd = process.cwd(), dir = mkdtempSync(join(tmpdir(), 'held-other-checkout-'));
    try {
        mkdirSync(join(dir, 'overlay/scratch-gui/static/sim-lab/models'), {recursive: true});
        writeFileSync(join(dir, 'overlay/scratch-gui/static/sim-lab/models/solstice-pumpjack.ldr'), 'wrong checkout model');
        process.chdir(dir);
        assert.equal(createHash('sha256').update(heldModelSource(id)).digest('hex'), '27727397256050ebba3ae7093490335344e1a1e4457b410f074d0c7ce8ccb0fe');
        assert.throws(() => assertHeldSourceBytes(Buffer.from('modified despite clean status'), Buffer.from('committed blob')), /exact git blob/);
    } finally { process.chdir(cwd); rmSync(dir, {recursive: true, force: true}); }
});

test('held CLI preflight refuses default and wrong partitions before launch', () => {
    const helper = new URL('../scripts/lib/sim-lab-q5-held.mjs', import.meta.url).href;
    const code = `import {heldCLIRequest} from ${JSON.stringify(helper)};console.log(JSON.stringify(heldCLIRequest(process.argv.slice(1))));console.log('launch-marker');`;
    for (const args of [[`--held-examples=${id}`], [`--held-examples=${id}`, '--part=ui'], ['--held-examples=typo', '--part=examples']]) {
        const r = spawnSync(process.execPath, ['--input-type=module', '-e', code, '--', ...args], {encoding: 'utf8', env: {...process.env, GITHUB_ACTIONS: ''}});
        assert.equal(r.status, 1); assert.ok(!r.stdout.includes('launch-marker'));
    }
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', code, '--', `--held-examples=${id}`, '--part=examples'], {encoding: 'utf8', env: {...process.env, GITHUB_ACTIONS: ''}});
    assert.equal(r.status, 0); assert.deepEqual(JSON.parse(r.stdout.split('\n')[0]).models, [id]);
    assert.deepEqual(heldCLIRequest(['--examples=ordinary-unknown']).models, []);
});

test('held driver preserves primary plus browser failure and always closes server', async () => {
    const primary = Error('original law failure'), close = Error('browser close failure'); let serverClosed = false;
    await assert.rejects(finishHeldDriver(primary, true, {close: async () => { throw close; }}, {close: done => { serverClosed = true; done(); }}), e => e.errors[0] === primary && e.errors[1] === close);
    assert.equal(serverClosed, true);
    const serverFailure = Error('server close failed');
    await assert.rejects(finishHeldDriver(primary, true, {close: async () => { throw close; }}, {close: done => done(serverFailure)}), e => e.errors[0] === primary && e.errors[1] === close && e.errors[2] === serverFailure);
});


test('held output containment rejects dot-prefixed checkout descendants and accepts a private sibling', () => {
    const root = new URL('..', import.meta.url).pathname;
    const inside = mkdtempSync(join(root, '..private-'));
    const sibling = mkdtempSync(join(root, '..', 'held-private-sibling-'));
    try {
        assert.throws(() => assertHeldPrivateDirectory(inside), /outside the source checkout/);
        assert.equal(assertHeldPrivateDirectory(sibling), sibling);
    } finally {
        rmSync(inside, {recursive: true, force: true});
        rmSync(sibling, {recursive: true, force: true});
    }
});
test('held actual capture imports module-root LDR and MPD despite counterfeit cwd; unheld reads stay local', async t => {
    const quiet = quietConsole();
    t.after(quiet.restore);
    const {captureIntakeProject} = await import('../scripts/lib/sim-lab-intake-roundtrip.mjs');
    const cwd = process.cwd(), dir = mkdtempSync(join(tmpdir(), 'held-intake-other-cwd-'));
    const expected = heldModelSource(id), imported = [], parts = ['actual-part'];
    const stop = Error('unheld buffer captured');
    let stopAtInput = false;
    const page = {
        getByTestId: () => ({click: async () => {}, setInputFiles: async file => { imported.push({name: file.name, text: file.buffer.toString('utf8')}); if (stopAtInput) throw stop; }}),
        getByText: () => ({click: async () => {}}), keyboard: {press: async () => {}},
        waitForEvent: async () => ({saveAs: async path => writeFileSync(path, 'source-control exported project')}),
        waitForFunction: async fn => {
            if (String(fn).includes('__bwProjectShareObservation')) return new Promise(() => {});
        },
        evaluate: async fn => {
            const source = String(fn);
            if (fn.name === 'projectProgramReady') return [{name: 'sprite', operations: [['move', 1]]}];
            if (source.includes('projectRecord')) return {ldraw: '0 Author: CrispStrobe\n0 source-control record'};
            if (source.includes('status:window.__bwSimLab.status')) return {status: 'ready', parts};
            if (source.includes('session.model.parts')) return parts;
        }
    };
    try {
        mkdirSync(join(dir, 'overlay/scratch-gui/static/sim-lab/models'), {recursive: true});
        writeFileSync(join(dir, `overlay/scratch-gui/static/sim-lab/models/${id}.ldr`), 'counterfeit alternate checkout bytes');
        writeFileSync(join(dir, 'overlay/scratch-gui/static/sim-lab/models/ordinary-fixture.ldr'), 'unchanged ordinary cwd input');
        writeFileSync(join(dir, 'brickwright-build.json'), '{}');
        process.chdir(dir);
        await captureIntakeProject(page, {shotsDir: dir, buildDir: dir, modelSourceFor: heldModelSource}, id);
        assert.deepEqual(imported, [{name: `${id}.ldr`, text: expected}, {name: `${id}.mpd`, text: `0 FILE ${id}.ldr\n${expected}\n0 NOFILE\n`}]);
        const gate = readFileSync(new URL('../scripts/lib/sim-lab-q5-browser-gate.mjs', import.meta.url), 'utf8');
        assert.match(gate, /held \? \{retainPageErrors: true, modelSourceFor: heldModelSource\} : \{\}/, 'actual held caller supplies the fixed reader after opts spread');
        imported.length = 0; stopAtInput = true;
        await assert.rejects(captureIntakeProject(page, {shotsDir: dir, buildDir: dir}, 'ordinary-fixture'), error => error === stop);
        assert.deepEqual(imported, [{name: 'ordinary-fixture.ldr', text: 'unchanged ordinary cwd input'}]);
        assert.deepEqual(quiet.lines, [
            ['log', 'PASS actual GUI project export: browser download'],
            ['log', 'PASS solstice-pumpjack: original post-run project exported and bound for fresh-context replay'],
            ['log', 'PASS actual GUI project export: browser download']
        ], 'retain the actual export diagnostics without writing to the test transport');
    } finally { process.chdir(cwd); rmSync(dir, {recursive: true, force: true}); }
});
