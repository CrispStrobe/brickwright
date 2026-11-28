import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const cuiPin = '659431ce46a7b6d4ae472182b069ec301aee0df3';
const boardPin = '818e0263fecd320d39737a580b7a73d562603c2e';
const cli = path.join(root, 'node_modules/bw-circuit-ui/bin/bwc.mjs');
const env = {...process.env}; delete env.BW_BOARD;
const run = (file, prefix = []) => spawnSync(process.execPath,
    [...prefix, cli, 'op', file, '--kcl', '--json'],
    {cwd: root, env, encoding: 'utf8', timeout: 30000});

test('static KCL adoption binds exact CUI pin and keeps the reviewed Board unchanged', () => {
    const pins = JSON.parse(readFileSync(path.join(root, 'vendor-pins.json')));
    assert.equal(pins['bw-circuit-ui'], cuiPin);
    assert.equal(pins['bw-board'], boardPin);
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json')));
    const lock = JSON.parse(readFileSync(path.join(root, 'package-lock.json')));
    for (const [name, sha] of [['bw-board', boardPin], ['bw-circuit-ui', cuiPin]]) {
        assert.equal(pkg.devDependencies[name], `github:CrispStrobe/${name}#${sha}`);
        assert.ok(lock.packages[`node_modules/${name}`].resolved.endsWith(`#${sha}`));
    }
    assert.equal(JSON.parse(readFileSync(path.join(root, 'node_modules/bw-circuit-ui/package.json'))).name,
        'bw-circuit-ui');
});

test('installed KCL CLI exposes complete signed observations for positive, negative and zero controls', t => {
    const dir = mkdtempSync(path.join(tmpdir(), 'lite-installed-kcl-'));
    t.after(() => rmSync(dir, {recursive: true, force: true}));
    const file = path.join(dir, 'divider.cir');
    for (const volts of [6, -6, 0]) {
        writeFileSync(file, `authored consumer divider\nV1 in 0 ${volts}\nR1 in out 1k\nR2 out 0 2k\n.op\n.end\n`);
        const child = run(file);
        assert.equal(child.status, 0, child.stderr);
        const {kcl} = JSON.parse(child.stdout);
        assert.equal(kcl.status, 'pass');
        assert.deepEqual(kcl.counts, {nets: 3, parts: 3, terminals: 6,
            checked: 6, passed: 6, failed: 0, unavailable: 0});
        const expected = volts === 0 ? 0 : -volts / 3000;
        assert.equal(kcl.observations.find(row => row.part === 'V1' && row.terminal === 'pos').currentAmps,
            expected, 'source sign is independently authored, not derived from the native current');
        assert.equal(kcl.observations.find(row => row.part === 'R1' && row.terminal === 'a').currentAmps,
            volts / 3000);
        assert.equal(kcl.observations.length, 6);
        assert.equal(kcl.claims.independentOracle, false);
        assert.equal(kcl.claims.transientConservation, false);
        assert.equal(kcl.claims.physicalDeviceCertification, false);
    }
});

test('installed KCL CLI rejects three native-current mutants without touching package bytes', t => {
    const dir = mkdtempSync(path.join(tmpdir(), 'lite-installed-kcl-mutants-'));
    t.after(() => rmSync(dir, {recursive: true, force: true}));
    const file = path.join(dir, 'divider.cir');
    writeFileSync(file, 'authored consumer mutation control\nV1 in 0 6\nR1 in out 1k\nR2 out 0 2k\n.op\n.end\n');
    const engine = import.meta.resolve('bw-board/board.js');
    for (const [name, mutation, exit, status] of [
        ['reversed-source', "for(const [t,i] of p.branchCurrents.get('V1')) p.branchCurrents.get('V1').set(t,-i);", 1, 'fail'],
        ['missing-source-terminal', "p.branchCurrents.get('V1').delete('pos');", 2, 'refused'],
        ['indeterminate-source', "p.indeterminateBranchCurrents.add('V1');", 2, 'refused'],
    ]) {
        const preload = `import {BoardImpl} from ${JSON.stringify(engine)};
            const original=BoardImpl.prototype.operatingPoint;
            BoardImpl.prototype.operatingPoint=function(...args){const p=original.apply(this,args);${mutation}return p;};`;
        const child = run(file, ['--import', `data:text/javascript,${encodeURIComponent(preload)}`]);
        assert.equal(child.status, exit, `${name}: ${child.stderr}`);
        const {kcl} = JSON.parse(child.stdout);
        assert.equal(kcl.status, status, name);
        if (status === 'fail') assert.equal(kcl.counts.failed, 2);
        else assert.equal(kcl.counts.passed, 0);
    }
    const restored = run(file);
    assert.equal(restored.status, 0, restored.stderr);
    assert.equal(JSON.parse(restored.stdout).kcl.status, 'pass');
});

const observation = (kcl, part, terminal) => {
    const matches = kcl.observations.filter(row => row.part === part && row.terminal === terminal);
    assert.equal(matches.length, 1, `${part}.${terminal} has one actual observation`);
    return matches[0];
};
const close = (actual, expected, tolerance, label) => {
    assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
        `${label}: ${actual} versus ${expected}`);
};

test('installed loaded PMOS source and grounded bulk retain physical fourth pins and signed load-line results', t => {
    const dir = mkdtempSync(path.join(tmpdir(), 'lite-loaded-pmos-'));
    t.after(() => rmSync(dir, {recursive: true, force: true}));
    const file = path.join(dir, 'pmos.cir');
    for (const grounded of [false, true]) {
        const source = grounded ? -2 : 10;
        const rail = grounded ? -5 : 0;
        writeFileSync(file, [
            'Authored installed loaded PMOS control',
            `VS source 0 ${source}`,
            `VG gate 0 ${source - 2}`,
            ...(grounded ? ['VR rail 0 -5'] : []),
            `R1 out ${grounded ? 'rail' : '0'} 4k`,
            `M1 out gate source ${grounded ? '0' : 'source'} PM W=5u L=2u`,
            '.model PM PMOS(LEVEL=1 VTO=-1 KP=100u LAMBDA=.02)',
            '.op', '.end', ''
        ].join('\n'));
        const child = run(file);
        assert.equal(child.status, 0, child.stderr);
        const {kcl} = JSON.parse(child.stdout);
        assert.equal(kcl.status, 'pass');
        assert.equal(kcl.currentConvention, 'positive-into-part-terminal');
        const terminals = kcl.observations.filter(row => row.part === 'M1');
        assert.deepEqual(terminals.map(row => row.terminal).sort(), ['bulk', 'drain', 'gate', 'source']);
        assert.ok(terminals.every(row => row.origin === 'physical-terminal'),
            'PMOS bulk is a real connected fourth terminal, not an implicit-ground exception');
        const bulk = observation(kcl, 'M1', 'bulk');
        const sourcePin = observation(kcl, 'M1', 'source');
        assert.equal(bulk.net, grounded ? observation(kcl, 'VS', 'neg').net : sourcePin.net,
            'bulk wiring comes from the actual imported terminal partition');
        // VSG=2 V, |VTO|=1 V and W/L=2.5. Solve the saturation load line:
        // I=.5*KP*(W/L)*(VSG-|VTO|)^2*(1+lambda*(VS-VD)).
        const expectedDrain = rail + .5 * (1 + .02 * (source - rail)) / 1.01;
        assert.ok(source - expectedDrain > 1, 'independent solution is in saturation');
        const expectedCurrent = (expectedDrain - rail) / 4000;
        close(observation(kcl, 'R1', 'a').currentAmps, expectedCurrent, 1e-10, 'signed resistor current');
        close(observation(kcl, 'VS', 'pos').currentAmps, -expectedCurrent, 1e-10, 'signed supply current');
        close(sourcePin.currentAmps, expectedCurrent, 1e-10, 'signed PMOS source current');
        const text = spawnSync(process.execPath, [cli, 'op', file],
            {cwd: root, env, encoding: 'utf8', timeout: 30000});
        assert.equal(text.status, 0, text.stderr);
        const nodes = new Map(text.stdout.split('\n').map(line =>
            /^ {4}(\S+)\s+(\S+) V$/.exec(line)).filter(Boolean)
            .map(match => [match[1], Number(match[2])]));
        close(nodes.get(observation(kcl, 'M1', 'drain').net), expectedDrain, 1e-7,
            'actual CLI node voltage against independently solved load line');
    }
});

const groundedNmos = source => [
    'Authored installed grounded NMOS body control',
    'VD drain 0 0', 'VG gate 0 -1', `VS source 0 ${source}`,
    'M1 drain gate source 0 NM W=5u L=2u',
    '.model NM NMOS(LEVEL=1 VTO=1 KP=100u LAMBDA=.02)', '.op', '.end', ''
].join('\n');

const pointPreload = mutation => {
    const engine = import.meta.resolve('bw-board/board.js');
    return ['--import', `data:text/javascript,${encodeURIComponent(`
        import {BoardImpl} from ${JSON.stringify(engine)};
        const original=BoardImpl.prototype.operatingPoint;
        BoardImpl.prototype.operatingPoint=function(...args){
            const p=original.apply(this,args);${mutation}return p;
        };`)}`];
};

test('installed grounded NMOS accounts for a real nonzero body current in both conservation sums', t => {
    const dir = mkdtempSync(path.join(tmpdir(), 'lite-nmos-body-'));
    t.after(() => rmSync(dir, {recursive: true, force: true}));
    const file = path.join(dir, 'nmos.cir');
    writeFileSync(file, groundedNmos(-.5));
    const child = run(file);
    assert.equal(child.status, 0, child.stderr);
    const {kcl} = JSON.parse(child.stdout);
    assert.equal(kcl.status, 'pass');
    const body = observation(kcl, 'M1', 'bulk');
    assert.ok(Math.abs(body.currentAmps) > 1e-6, 'nonzero witness cannot hide beneath the KCL allowance');
    assert.equal(body.origin, 'implicit-grounded-bulk');
    assert.equal(body.net, observation(kcl, 'VD', 'neg').net, 'actual physical reference net');
    assert.equal(kcl.counts.terminals, 10);
    assert.equal(kcl.observations.filter(row => row.origin === 'physical-terminal').length, 9);
    assert.ok(kcl.nets.some(row => row.id === body.net && row.status === 'pass'));
    assert.ok(kcl.parts.some(row => row.id === 'M1' && row.terminals === 4 && row.status === 'pass'));
    const wrong = run(file, pointPreload("p.branchCurrents.get('M1').set('bulk',0);"));
    assert.equal(wrong.status, 1, wrong.stderr);
    const broken = JSON.parse(wrong.stdout).kcl;
    assert.equal(broken.status, 'fail');
    assert.ok(broken.nets.some(row => row.id === body.net && row.status === 'fail'));
    assert.ok(broken.parts.some(row => row.id === 'M1' && row.status === 'fail'));
});

test('installed KCL refuses a missing NMOS body observation even at zero body current', t => {
    const dir = mkdtempSync(path.join(tmpdir(), 'lite-nmos-missing-body-'));
    t.after(() => rmSync(dir, {recursive: true, force: true}));
    const file = path.join(dir, 'nmos.cir');
    writeFileSync(file, groundedNmos(0));
    const positive = run(file);
    assert.equal(positive.status, 0, positive.stderr);
    const kcl = JSON.parse(positive.stdout).kcl;
    assert.equal(kcl.status, 'pass');
    assert.ok(Math.abs(observation(kcl, 'M1', 'bulk').currentAmps) < 1e-12,
        'a numerically zero body current is still an observed quantity');
    const missing = run(file, pointPreload("p.branchCurrents.get('M1').delete('bulk');"));
    assert.equal(missing.status, 2, missing.stderr);
    const refused = JSON.parse(missing.stdout).kcl;
    assert.equal(refused.status, 'refused');
    assert.equal(refused.counts.checked, 0);
    assert.equal(refused.counts.passed, 0);
    assert.ok(refused.unavailable.some(row => row.code === 'missing-implicit-bulk-current'));
});
