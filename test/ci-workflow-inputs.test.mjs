import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {workflowSources, assertCheckoutPins} from '../scripts/ci-workflow-inputs.mjs';
import {vendorPinOutputs} from '../scripts/ci-vendor-pins.mjs';

const workflows = workflowSources(new URL('..', import.meta.url).pathname);
const names = ['bw-circuit-ui', 'bw-board', 'sb3-creator'];

test('the isolated corpus job installs pinned root packages before running solver walks', () => {
    const workflow = workflows.get('.github/workflows/build.yml');
    const start = workflow.indexOf('\n  corpus:\n');
    assert.ok(start >= 0, 'corpus job exists');
    const next = workflow.slice(start + 1).search(/\n  [\w-]+:\n/);
    const corpus = next < 0 ? workflow.slice(start) : workflow.slice(start, start + 1 + next);
    const install = corpus.indexOf('npm ci --ignore-scripts --no-audit --no-fund');
    assert.ok(install >= 0 && install < corpus.indexOf('npm run test:corpus'),
        'a fresh corpus runner needs root bw-board and bw-circuit-ui before any lesson simulation');
});
const copiedRepos = ['CrispStrobe/sb3-creator'];
const allowedGlobal = site => site.file === '.github/workflows/vendor-freshness.yml'
    && names.some(name => copiedRepos.includes(site.repository) && site.repository === `CrispStrobe/${name}`
        && site.ref === '${{ steps.vendor_pins.outputs.' + name + ' }}');
const allowedFlasher = site => site.file === '.github/workflows/build.yml'
    && site.repository === 'CrispStrobe/stc-compiler'
    && site.ref === '${{ steps.stc_flasher_pin.outputs.sha }}';
// The production probe's example census draws example parts with the pinned
// bw-circuit-ui, through the same validated vendor_pins output.
const allowedProbe = site => site.file === '.github/workflows/production-sw-probe.yml'
    && site.repository === 'CrispStrobe/bw-circuit-ui'
    && site.ref === '${{ steps.vendor_pins.outputs.bw-circuit-ui }}';
const cp1Suppliers = ['bw-board', 'bw-circuit-ui'];
const allowedCP1 = site => site.file === '.github/workflows/cp1-qualification.yml'
    && cp1Suppliers.some(name => site.repository === `CrispStrobe/${name}`
        && site.ref === `\${{ steps.vendor_pins.outputs.${name} }}`);
const kim1Suppliers = new Map([
    ['.github/workflows/kim1-app.yml', ['bw-board', 'bw-circuit-ui']],
    ['.github/workflows/kim1-prepare.yml', ['bw-board']]
]);
const allowedKIM1 = site => kim1Suppliers.get(site.file)?.some(name =>
    site.repository === `CrispStrobe/${name}` && site.ref === `\${{ steps.pins.outputs.${name} }}`);
const cardiacSuppliers = ['bw-board', 'bw-circuit-ui'];
const allowedCardiac = site => site.file === '.github/workflows/cardiac-lab.yml'
    && cardiacSuppliers.some(name => site.repository === `CrispStrobe/${name}`
        && site.ref === `\${{ steps.vendor_pins.outputs.${name} }}`);
const allowed = site => allowedCardiac(site) || allowedGlobal(site) || allowedFlasher(site) || allowedProbe(site) || allowedCP1(site) || allowedKIM1(site);

function assertFlasherValidation(body, name) {
    assert.match(body, /id: stc_flasher_pin\n\s+if:[^\n]+\n\s+run: \|\n\s+node -e .*stc-compiler-flasher.*\/\^\[0-9a-f\]\{40\}\$\//, name);
    assert.ok(body.indexOf('id: stc_flasher_pin') < body.indexOf('repository: CrispStrobe/stc-compiler'), name);
    assert.equal(assertCheckoutPins(new Map([['.github/workflows/build.yml',body]]),allowed).filter(allowedFlasher).length,1,name);
    assert.match(body,/ref: \$\{\{ steps\.stc_flasher_pin\.outputs\.sha \}\}/,name);
}

test('every external workflow checkout has a full pin or validated vendor-pin output', t => {
    const sites = assertCheckoutPins(workflows, allowed);
    const workflow = workflows.get('.github/workflows/vendor-freshness.yml');
    assert.match(workflow, /id: vendor_pins\n\s+run: node brickwright-lite\/scripts\/ci-vendor-pins.mjs >> "\$GITHUB_OUTPUT"/);
    assert.ok(workflow.indexOf('id: vendor_pins') < workflow.indexOf('repository: CrispStrobe/'));
    assert.deepEqual(sites.filter(allowedGlobal).map(site => site.repository).sort(), copiedRepos);
    assert.doesNotMatch(workflow, /staying on HEAD|comparing against HEAD/);
    const build = workflows.get('.github/workflows/build.yml');
    assert.match(build, /id: stc_flasher_pin\n\s+if:[^\n]+\n\s+run: \|\n\s+node -e .*stc-compiler-flasher.*\/\^\[0-9a-f\]\{40\}\$\//);
    assert.ok(build.indexOf('id: stc_flasher_pin') < build.indexOf('repository: CrispStrobe/stc-compiler'));
    assert.deepEqual(sites.filter(allowedFlasher).map(site => site.repository), ['CrispStrobe/stc-compiler','CrispStrobe/stc-compiler']);
    const jobs = new Map([...build.matchAll(/^  (unit|build):\n([\s\S]*?)(?=^  [a-z][\w-]*:|$(?![\s\S]))/gm)].map(m=>[m[1],m[2]]));
    assert.deepEqual([...jobs.keys()].sort(), ['build','unit']);
    for (const [name,body] of jobs) {
        assertFlasherValidation(body, name);
        assert.throws(()=>assertFlasherValidation(body.replace('id: stc_flasher_pin','id: unchecked'),name));
    }
    const probe = workflows.get('.github/workflows/production-sw-probe.yml');
    assert.match(probe, /id: vendor_pins\n\s+run: node scripts\/ci-vendor-pins\.mjs >> "\$GITHUB_OUTPUT"/);
    assert.ok(probe.indexOf('id: vendor_pins') < probe.indexOf('repository: CrispStrobe/bw-circuit-ui'));
    assert.deepEqual(sites.filter(allowedProbe).map(site => site.repository), ['CrispStrobe/bw-circuit-ui']);
    const cp1 = workflows.get('.github/workflows/cp1-qualification.yml');
    assert.match(cp1, /id: vendor_pins\n\s+run: \|\n\s+node scripts\/ci-vendor-pins\.mjs >> "\$GITHUB_OUTPUT"/);
    for (const name of cp1Suppliers) assert.ok(cp1.indexOf('id: vendor_pins') < cp1.indexOf(`repository: CrispStrobe/${name}`));
    assert.deepEqual(sites.filter(allowedCP1).map(site => site.repository).sort(), cp1Suppliers.map(name => `CrispStrobe/${name}`));
    const cardiac = workflows.get('.github/workflows/cardiac-lab.yml');
    assert.match(cardiac, /id: vendor_pins\n\s+run: node scripts\/ci-vendor-pins\.mjs >> "\$GITHUB_OUTPUT"/);
    for (const name of cardiacSuppliers) {
        assert.ok(cardiac.indexOf('id: vendor_pins') < cardiac.indexOf(`repository: CrispStrobe/${name}`));
    }
    assert.deepEqual(sites.filter(allowedCardiac).map(site => site.repository).sort(),
        cardiacSuppliers.map(name => `CrispStrobe/${name}`));
    for (const [file, suppliers] of kim1Suppliers) {
        const body = workflows.get(file);
        assert.match(body, /id: pins\n\s+run: node scripts\/ci-vendor-pins\.mjs >> "\$GITHUB_OUTPUT"/);
        for (const name of suppliers) assert.ok(body.indexOf('id: pins') < body.indexOf(`repository: CrispStrobe/${name}`));
        assert.deepEqual(sites.filter(site => site.file === file && allowedKIM1(site)).map(site => site.repository).sort(),
            suppliers.map(name => `CrispStrobe/${name}`));
    }
    t.diagnostic(`Audited ${sites.length} external checkout sites across ${workflows.size} workflows`);
});

test('vendor outputs reject a missing, abbreviated, moving or injected SHA before checkout', () => {
    const pins = JSON.parse(readFileSync(new URL('../vendor-pins.json', import.meta.url), 'utf8'));
    assert.equal(vendorPinOutputs(pins), names.map(name => `${name}=${pins[name]}\n`).join(''));
    for (const name of names) {
        for (const bad of [undefined, 'main', pins[name].slice(0, 7), pins[name] + '\ninjected=yes']) {
            assert.throws(() => vendorPinOutputs({...pins, [name]: bad}), new RegExp(name + ': missing or invalid'));
        }
    }
});

test('new checkout sites and unrecognized dynamic refs fail by repository', () => {
    const workflow = ref => 'steps:\n  - uses: actions/checkout@full\n    with:\n      repository: Acme/new\n' + (ref ? `      ref: ${ref}\n` : '');
    for (const ref of [null, 'main', 'abc1234', '${{ steps.unreviewed.outputs.sha }}']) {
        assert.throws(() => assertCheckoutPins(new Map([['new.yml', workflow(ref)]]), allowed), /Acme\/new: expected a full/);
    }
    assert.equal(assertCheckoutPins(new Map([['new.yml', workflow('a'.repeat(40))]])).length, 1);
});

test('duplicate-ref fixture: a checkout has exactly one ref field', () => {
    const base = 'steps:\n  - uses: actions/checkout@full\n    with:\n      repository: Acme/duplicate\n      ref: ' + 'a'.repeat(40) + '\n';
    assert.equal(assertCheckoutPins(new Map([['duplicate.yml', base]])).length, 1);
    assert.throws(() => assertCheckoutPins(new Map([['duplicate.yml', base + '      ref: ' + 'b'.repeat(40) + '\n']])), /duplicate checkout ref/);
});

function assertInstalledProvenanceBeforeBuild(source) {
    const jobs = new Map([...source.matchAll(/^  (build|browser):\n([\s\S]*?)(?=^  [a-z][\w-]*:|$(?![\s\S]))/gm)].map(m => [m[1], m[2]]));
    assert.deepEqual([...jobs.keys()].sort(), ['browser', 'build']);
    for (const [name, job] of jobs) {
        const id = name === 'build' ? 'package_provenance' : 'browser_package_provenance';
        const step = job.match(new RegExp(`        id: ${id}\\n([\\s\\S]*?)(?=      - name:|$)`))?.[1];
        assert.ok(step, `${name}: missing provenance step`);
        assert.match(step, /node scripts\/pin-packages\.mjs --verify-installed/);
        assert.match(step, /--source bw-board=\/tmp\/bw-board --source bw-circuit-ui=\/tmp\/bw-circuit-ui/);
        assert.match(step, /--installed-root node_modules --installed-root packages\/scratch-gui\/node_modules/);
        assert.match(step, /node scripts\/package-upstream-notices\.mjs --check/);
        const build = job.match(/        id: build_editor(?:_browser)?\n([\s\S]*?)(?=\n\n)/)?.[1];
        assert.ok(build?.includes(`steps.${id}.outcome == 'success'`), `${name}: build must require provenance success`);
        assert.ok(job.indexOf(`id: ${id}`) < job.indexOf('id: build_editor'), `${name}: provenance must precede build`);
        assert.ok(job.indexOf('npm ci --ignore-scripts') < job.indexOf('node scripts/pin-packages.mjs --verify-installed'), `${name}: root install must precede verification`);
        assert.ok(job.indexOf('npm ci --ignore-scripts') >= 0 && job.indexOf('npm ci --ignore-scripts') < job.indexOf('node scripts/integrate.mjs'), `${name}: root package bootstrap must precede integration`);
        assert.ok(job.indexOf('cd packages/scratch-gui && npm install') < job.indexOf('node scripts/pin-packages.mjs --verify-installed'), `${name}: GUI install must precede verification`);
        assert.ok(job.includes('/^[0-9a-f]{40}$/'), `${name}: source pins require full-SHA validation`);
        assert.ok(job.includes('rev-parse HEAD'), `${name}: fetched source HEAD must be checked`);
    }
    const main = jobs.get('build');
    assert.match(main, /https:\/\/github.com\/CrispStrobe\/bw-board.git/);
    assert.match(main, /https:\/\/github.com\/CrispStrobe\/bw-circuit-ui.git/);
    assert.match(jobs.get('browser'), /for PACKAGE in bw-board bw-circuit-ui; do/);
    assert.match(jobs.get('browser'), /https:\/\/github.com\/CrispStrobe\/\$PACKAGE.git/);
}

test('both build paths verify actual root and GUI bytes, pinned sources and shipped notices', () => {
    const source = workflows.get('.github/workflows/build.yml');
    assertInstalledProvenanceBeforeBuild(source);
    for (const mutated of [
        source.replaceAll('--installed-root packages/scratch-gui/node_modules', ''),
        source.replaceAll('node scripts/package-upstream-notices.mjs --check', 'echo notices skipped'),
        source.replace(" && steps.package_provenance.outcome == 'success'", ''),
        source.replace(" && steps.browser_package_provenance.outcome == 'success'", ''),
        source.replaceAll('/^[0-9a-f]{40}$/', '/^[0-9a-f]+$/'),
        source.replaceAll('https://github.com/CrispStrobe/bw-circuit-ui.git', 'https://evil.example/bw-circuit-ui.git')
    ]) assert.throws(() => assertInstalledProvenanceBeforeBuild(mutated));
});

test('both debugger jobs install the root packages their tests load', () => {
    const workflow = workflows.get('.github/workflows/debugger.yml');
    for (const section of [workflow.split('  contracts:')[1].split('  focused:')[0], workflow.split('  focused:')[1]]) {
        const install = section.indexOf('npm ci --ignore-scripts');
        assert.ok(install >= 0 && install < section.indexOf('node --test'));
    }
    assert.doesNotMatch(workflow, /Dependency-free debugger architecture/);
});

// The controls verifier uses pxt-node's strict integrated GUI admission. A
// runtime-only packages/ tree must not substitute for the declared installation.
function assertArcadeControlsPreparation(source) {
    assert.match(source, /timeout-minutes: 15(?:\n|$)/);
    const commands = [
        'npm ci --ignore-scripts --no-audit --no-fund',
        'npm run vendor',
        'node scripts/integrate.mjs',
        'cd packages/scratch-gui && npm install --ignore-scripts --legacy-peer-deps --no-audit --no-fund',
        'node scripts/apply-vm-overlay.mjs',
        'node scripts/sync-makecode-runtime.mjs',
        'node scripts/verify-arcade-controls.mjs'
    ];
    let previous = -1;
    for (const command of commands) {
        const line = `        run: ${command}\n`;
        const position = source.indexOf(line);
        assert.ok(position > previous, `controls prerequisite missing or out of order: ${command}`);
        assert.equal(source.indexOf(line, position + line.length), -1, `duplicate controls prerequisite: ${command}`);
        previous = position;
    }
    assert.doesNotMatch(source, /npm run build|--allow-stale|continue-on-error/);
}

test('Arcade controls prepare the real integrated GUI and installed model before runtime verification', () => {
    const source = workflows.get('.github/workflows/arcade-controls.yml');
    assertArcadeControlsPreparation(source);
    for (const command of [
        'npm ci --ignore-scripts --no-audit --no-fund',
        'npm run vendor', 'node scripts/integrate.mjs',
        'cd packages/scratch-gui && npm install --ignore-scripts --legacy-peer-deps --no-audit --no-fund',
        'node scripts/apply-vm-overlay.mjs'
    ]) assert.throws(() => assertArcadeControlsPreparation(source.replace(`        run: ${command}\n`, '')));
    const integrate = 'node scripts/integrate.mjs', apply = 'node scripts/apply-vm-overlay.mjs';
    assert.throws(() => assertArcadeControlsPreparation(source.replace(integrate, '__SWAP__').replace(apply, integrate).replace('__SWAP__', apply)));
    assert.throws(() => assertArcadeControlsPreparation(source.replace('timeout-minutes: 15', 'timeout-minutes: 30')));
});
