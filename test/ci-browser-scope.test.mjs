/**
 * The PR browser-shard scope (scripts/ci-browser-scope.mjs): sample changed-file
 * lists in, the shards that run out — against the real build.yml and the real
 * gate import closure, so a renamed shard or a moved gate shows up here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {decide, loadContext, needlesOf, mentions, entriesOf, outputLines, closureOf} from '../scripts/ci-browser-scope.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const ctx = loadContext(ROOT);
const ROBOT = ['robotlab', 'robotdraw', 'robotlink', 'robotmotion', 'robotbench', 'robotlink2', 'robotbench2', 'robotdraw2', 'robotdraw3', 'robotmotion2', 'robotaddon1', 'robotaddon2', 'robotaddon3', 'robotaddon4', 'robotaddon5', 'robotaddon6', 'robotaddon7', 'robotaddon8', 'robotaddon9', 'robotaddon10', 'robotaddon11', 'robotaddon12', 'robotaddon13', 'robotaddon14', 'robotaddon15', 'robotaddon16', 'robotaddon18', 'robotaddon19', 'robotaddon22', 'robotaddon24'];
const ALL = ['heavy', 'light', ...ROBOT, 'fpga'];
const run = files => decide(files, ctx).needed;

test('the shards are the browser matrix plus fpga', () => {
    assert.deepEqual(ctx.shards, ALL);
    assert.deepEqual(ctx.browserShards, ['heavy', 'light', ...ROBOT]);
});

test('no browser shard: docs, tests, Tauri/Rust', () => {
    assert.deepEqual(run(['LANES.md', 'docs/SOME-UNREAD-NOTE.md', 'README.md']), [], 'docs-only');
    assert.deepEqual(run(['lanes/2026-10-21-some-claim.md', 'CI-POINTERS.md']), [], 'lane claims and CI pointers are docs');
    assert.deepEqual(run(['test/ci-docs-only.test.mjs', 'test/bw-sim-hinge.test.mjs']), [], 'tests-only');
    assert.deepEqual(run(['apps/tauri/src-tauri/src/main.rs', 'apps/tauri/src-tauri/Cargo.toml', 'apps/tauri/src-tauri/Cargo.lock']), [], 'tauri-only');
    assert.deepEqual(run(['bin/bwlite.mjs', 'scripts/gen-ci-steps.mjs']), [], 'CLI and a script no gate reaches');
});

test('one shard: a path only Robot Lab exercises', () => {
    assert.deepEqual(run(['overlay/scratch-gui/src/lib/bw-sim/physics/world.js']), ROBOT);
    assert.deepEqual(run(['overlay/scratch-gui/static/sim-lab/models/a.json', 'test/bw-sim-hinge.test.mjs']), ROBOT);
});

test('every shard: shared inputs, the workflow, and anything unknown', () => {
    assert.deepEqual(run(['overlay/scratch-gui/src/components/gui/gui.jsx']), ALL, 'gui.jsx');
    assert.deepEqual(run(['package.json']), ALL, 'package.json');
    assert.deepEqual(run(['package-lock.json']), ALL);
    assert.deepEqual(run(['vendor-pins.json']), ALL);
    assert.deepEqual(run(['overlay/scratch-vm/src/virtual-machine.js']), ALL);
    assert.deepEqual(run(['.github/workflows/build.yml']), ALL, 'a workflow path');
    assert.deepEqual(run(['something/brand-new.txt']), ALL, 'an unknown path');
    assert.deepEqual(run(['test/x.test.mjs', 'something/brand-new.txt']), ALL, 'unknown wins over tests');
    assert.deepEqual(run([]), ALL, 'an empty list is not evidence: fail closed');
    assert.deepEqual(run(['scripts/integrate.mjs']), ALL, 'a prerequisite every shard runs');
});

test('a gate script maps to the shard whose step runs it', () => {
    const fpga = run(['scripts/verify-fpga-pinch.mjs']);
    assert.ok(fpga.includes('fpga') && !fpga.includes('robotlab'), fpga.join());
    const robot = run(['scripts/verify-sim-lab-browser.mjs']);
    assert.deepEqual(robot, ROBOT);
});

test('documentation back-edges do not expand the executable closure; code and fixture mentions do', () => {
    // Keep scratch within the owned checkout; no external packages or JS parser.
    const root = mkdtempSync(path.join(ROOT, '.ci-browser-scope-'));
    const sources = {
        'scripts/light.mjs': "import './shared.mjs'; import './literal-start.mjs';",
        'scripts/shared.mjs': `#!/usr/bin/env node
// https://example.invalid/scripts/robot.mjs
/* Browser counterpart: scripts/robot.mjs and '../scripts/robot.mjs'.
 * Fixture documentation: test/fixtures/shared/reading.json
 */ import './actual.mjs';
spawnSync(process.execPath, ['scripts/spawned.mjs']);
readFileSync('test/fixtures/shared/live.json');
// scripts/in-body.mjs is deliberately still a conservative edge.
const dynamic = \`./dynamic/\${name}.mjs\`;
const url = 'https://example.invalid/documentation';
const urlReader = 'scripts/url-reader.mjs';
const commentLike = '/* scripts/literal-reader.mjs */';
const template = \`// scripts/template-reader.mjs\`;
`,
        'scripts/robot.mjs': "import './robot-helper.mjs';",
        'scripts/robot-helper.mjs': "/* See scripts/shared.mjs. */ export const robot = true;",
        'scripts/actual.mjs': "export const actual = true;",
        'scripts/literal-start.mjs': "'// scripts/first-literal.mjs';",
        'scripts/first-literal.mjs': "export const first = true;",
        'scripts/in-body.mjs': "export const body = true;",
        'scripts/spawned.mjs': "export const spawned = true;",
        'scripts/url-reader.mjs': "export const url = true;",
        'scripts/literal-reader.mjs': "export const literal = true;",
        'scripts/template-reader.mjs': "export const template = true;",
    };
    try {
        for (const [file, text] of Object.entries(sources)) {
            mkdirSync(path.dirname(path.join(root, file)), {recursive: true});
            writeFileSync(path.join(root, file), text);
        }
        const closure = closureOf(root, [
            {labels: ['light'], files: new Set(['scripts/light.mjs'])},
            {labels: ['robotlab'], files: new Set(['scripts/robot.mjs'])},
        ]);
        const synthetic = {shards: ALL, browserShards: ctx.browserShards, ...closure};
        assert.deepEqual(decide(['scripts/robot.mjs'], synthetic).needed, ['robotlab'], 'a multi-hop header mention cannot make light execute the robot gate');
        assert.deepEqual([...closure.reach.get('scripts/robot-helper.mjs')], ['robotlab']);
        for (const file of ['actual', 'spawned', 'url-reader', 'literal-reader', 'template-reader', 'first-literal', 'in-body']) {
            assert.deepEqual([...closure.reach.get(`scripts/${file}.mjs`)], ['light'], `${file}: preserve relative imports, spawns and conservative literal paths`);
        }
        assert.ok(closure.texts.get('scripts/shared.mjs').includes('./dynamic/${name}.mjs'), 'dynamic module text stays available');
        assert.ok(closure.texts.get('scripts/shared.mjs').includes('https://example.invalid/documentation'), 'URLs are preserved');
        assert.deepEqual(decide(['test/fixtures/shared/live.json'], synthetic).needed, ['light'], 'a real read dependency selects the fixture consumer');
        assert.deepEqual(decide(['test/fixtures/shared/reading.json'], synthetic).needed, ['light'], 'header fixture mentions still select their gate');
    } finally { rmSync(root, {recursive: true, force: true}); }
});

test('the pure decision, over a synthetic closure', () => {
    const synthetic = {
        shards: ALL, browserShards: ALL.filter(s => s !== 'fpga'),
        reach: new Map([['scripts/verify-a.mjs', new Set(['light'])], ['scripts/lib/h.mjs', new Set(['light'])], ['scripts/pre.mjs', new Set(['(prerequisite)'])]]),
        texts: new Map([['scripts/verify-a.mjs', "read(path.join(ROOT, 'test/fixtures/thing/x.bin'))"], ['scripts/pre.mjs', '']]),
    };
    assert.deepEqual(decide(['scripts/verify-a.mjs'], synthetic).needed, ['light']);
    assert.deepEqual(decide(['scripts/lib/h.mjs'], synthetic).needed, ALL, 'scripts/lib a gate imports is shared');
    assert.deepEqual(decide(['scripts/pre.mjs'], synthetic).needed, ALL);
    assert.deepEqual(decide(['test/fixtures/thing/x.bin'], synthetic).needed, ['light'], 'a fixture a gate names');
    assert.deepEqual(decide(['test/fixtures/other/y.bin'], synthetic).needed, []);
    assert.ok(needlesOf('test/fixtures/thing/x.bin').dirs.includes('fixtures/thing'));
    assert.ok(mentions("join(ROOT, 'test/fixtures/thing', name)", needlesOf('test/fixtures/thing/y.bin')), 'a directory a gate joins onto');
    assert.ok(mentions('`${ROOT}/test/fixtures/thing/${n}`', needlesOf('test/fixtures/thing/y.bin')));
    assert.ok(!mentions("'test/fixtures/thing/x.bin'", needlesOf('test/fixtures/y.bin')), 'naming a file is not naming its parent');
    assert.ok(!mentions("node --test test/data.test.mjs", needlesOf('test/a.test.mjs')), 'a.test.mjs is not named by data.test.mjs');
    assert.ok(mentions("node --test test/a.test.mjs", needlesOf('test/a.test.mjs')));
    assert.ok(mentions("import x from '../test/helpers/h.mjs'", needlesOf('test/helpers/h.mjs')));
    assert.deepEqual([...entriesOf('npm run v -- --x && node scripts/b.mjs', {v: 'node scripts/a.mjs'})].sort(), ['scripts/a.mjs', 'scripts/b.mjs']);
    const out = outputLines(decide(['test/z.test.mjs'], synthetic), synthetic);
    assert.deepEqual(out.slice(0, ALL.length+2), [...ALL.map(s=>s+'=false'), 'browser=false', 'any=false']);
    assert.match(out[ALL.length+2], /^summary=1 file\(s\): test 1$/);
});

// A test file no gate names. (test/a.test.mjs is not one: test/gate-coverage.test.mjs,
// which a gate runs, uses 'a.test.mjs' as fixture text, and the scope rightly counts it.)
const UNNAMED = 'test/zz-ci-browser-scope-unnamed-sample.test.mjs';
test('the CLI prints GITHUB_OUTPUT lines, and build.yml wires them', () => {
    assert.ok(![...ctx.texts.values()].some(t => mentions(t, needlesOf(UNNAMED))), 'the sample must be named by no gate');
    const r = spawnSync(process.execPath, ['scripts/ci-browser-scope.mjs'], {cwd: ROOT, input: `${UNNAMED}\nLANES.md\n`, encoding: 'utf8'});
    assert.equal(r.status, 0, r.stderr);
    assert.ok(r.stdout.startsWith(ALL.map(s => s+'=false\n').join('')+'browser=false\nany=false\nsummary='));
    const yml = readFileSync(path.join(ROOT, '.github/workflows/build.yml'), 'utf8');
    assert.match(yml, /node scripts\/ci-browser-scope\.mjs < \/tmp\/changed\.txt/);
    const calls = yml.split('\n').filter(line => /^\s*node scripts\/ci-browser-scope\.mjs < \/tmp\/changed\.txt/.test(line));
    assert.equal(calls.length, 1, 'one real classifier output forwarding command');
    const forwarding = / \| sed '([^']+)' >> "\$GITHUB_OUTPUT"$/.exec(calls[0]);
    assert.ok(forwarding, 'classifier output must append to the actual step outputs');
    const forwarded = spawnSync('/usr/bin/sed', [forwarding[1]], {input: r.stdout, encoding: 'utf8'});
    assert.equal(forwarded.status, 0, forwarded.stderr);
    const mapped = Object.fromEntries(forwarded.stdout.trim().split('\n').map(line => {
        const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1)];
    }));
    for (const shard of ALL) assert.equal(mapped[`scope_${shard}`], 'false', shard);
    assert.equal(mapped.browser, 'false'); assert.equal(mapped.any, 'false');
    assert.match(mapped.summary, /^\d+ file\(s\):/);
    const scope = /^  scope:\n([\s\S]*?)(?=^  [a-z][\w-]*:\n)/m.exec(yml)?.[1];
    assert.ok(scope, 'actual scope job required');
    for (const shard of ['heavy', 'light', 'robotlab', 'fpga']) {
        assert.ok(scope.includes(`          NEED_${shard.toUpperCase()}: \${{ steps.files.outputs.scope_${shard} }}\n`),
            `${shard}: classifier value must reach the actual tier selector`);
        assert.ok(scope.includes(`      ${shard}: \${{ steps.tier.outputs.${shard} }}\n`),
            `${shard}: selected tier value must reach downstream jobs`);
    }
    assert.ok(scope.includes('      browser: ${{ steps.tier.outputs.browser }}\n'));
    for (const s of ['heavy', 'light', 'robotlab'])
        assert.match(yml, new RegExp(`- shard: \\$\\{\\{ needs\\.scope\\.outputs\\.${s} != 'true' && '${s}' \\|\\| 'none' \\}\\}`), s);
    assert.match(yml, /needs\.scope\.outputs\.thorough == 'true' && needs\.scope\.outputs\.fpga == 'true'/);
    assert.match(yml, /needs\.scope\.outputs\.thorough == 'true' && needs\.scope\.outputs\.browser == 'true'/);
});
