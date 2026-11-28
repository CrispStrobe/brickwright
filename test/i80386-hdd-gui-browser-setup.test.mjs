import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {hddWorkflowBeforeRepositoryIdentity} from './helpers/reviewed-repository-identity.mjs';

const workflow = readFileSync(new URL('../.github/workflows/i80386-hdd-gui-actual.yml', import.meta.url), 'utf8');

function job(source, id) {
    const marker = `  ${id}:\n`;
    const start = source.indexOf(marker);
    assert.ok(start >= 0 && source.indexOf(marker, start + marker.length) < 0, `one ${id} job`);
    const following = /^  [a-z][a-z0-9-]*:$/gm;
    following.lastIndex = start + marker.length;
    const next = following.exec(source);
    return source.slice(start, next?.index ?? source.length);
}

function step(source, name) {
    const marker = `      - name: ${name}\n`;
    const start = source.indexOf(marker);
    assert.ok(start >= 0 && source.indexOf(marker, start + marker.length) < 0, `one ${name} step`);
    const following = /^      - (?:name|uses): /gm;
    following.lastIndex = start + marker.length;
    const next = following.exec(source);
    return source.slice(start, next?.index ?? source.length);
}

function requireOrder(source, names) {
    const positions = names.map(name => {
        const found = source.indexOf(name);
        assert.ok(found >= 0, `missing ${name}`);
        return found;
    });
    assert.ok(positions.every((at, index) => !index || positions[index - 1] < at),
        `source order: ${names.join(' -> ')}`);
}

const helper = 'sudo env "PATH=$PATH" node scripts/prepare-playwright-apt.mjs';
function helperGroup(output) {
    return `          {\n            ${helper}\n          } > ${output}.stdout 2> ${output}.stderr\n`;
}
const checkout = 'actions/checkout@11d5960a326750d5838078e36cf38b85af677262';
const setupNode = 'actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020';
const upload = 'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02';
const heldJobs = Object.freeze({
    'finite-inventory-six': 'fce809e584666ed952632cfe5b3b19ed778cceeda06816a1a375feadd67f7ffb',
    controls: 'c75c324bf9ddba774427458171dee49d77adf825a0517eefeb182ba8a47a25c6',
    inventory: 'd2d72dbf71ecf6d74b1c735f84b2a0d6f343156ff229a886ad616855a9cbeebb',
    'finite-inventory-v4': '064aacd6bb3418e220092ed5d7260310830bfe82a48779d0452e2c4e792ff706',
    'finite-inventory-five': '3a18af978e46e04178ad52208273d8ebdd56ca3d722a8531233635a0c2035d83',
    actual: '990d769bede009e6b0e65e37fc00692253a0eb9be8f8e16bdc9e3eeff76c425b',
    'actual-v7': 'c528df92f9018633781c39516c62265fd6ee979df2c728bafdcb8291bc235b82',
    'font-bridge': '62748cdd405870b2490aa9ea712480e905e9a7dec51e15edf705a5806356c270',
    'font-discovery': 'ad3c83a431c722cbe0cfc7d84924bb43a4b790a8503820549c47e53ee218d048',
});
const reviewedJobs = Object.freeze([...Object.keys(heldJobs),
    'finite-inventory-seven', 'finite-inventory-eight', 'finite-inventory-nine', 'actual-v8', 'actual-v9']);

function jobNames(source) {
    const marker = '\njobs:\n';
    const start = source.indexOf(marker);
    assert.ok(start >= 0 && source.indexOf(marker, start + marker.length) < 0, 'one jobs section');
    return [...source.slice(start + marker.length).matchAll(/^  ([a-z][a-z0-9-]*):$/gm)]
        .map(match => match[1]);
}

function usesRefs(source) {
    return [...source.matchAll(/^      - uses: ([^\n]+)$/gm)].map(match => match[1]);
}

function setupNodeStep(source) {
    const marker = `      - uses: ${setupNode}\n`;
    const start = source.indexOf(marker);
    assert.ok(start >= 0 && source.indexOf(marker, start + marker.length) < 0,
        'one pinned setup-node step');
    const following = /^      - (?:name|uses): /gm;
    following.lastIndex = start + marker.length;
    const next = following.exec(source);
    return source.slice(start, next?.index ?? source.length);
}

function checkSource(source) {
    assert.deepEqual([...jobNames(source)].sort(), [...reviewedJobs].sort(), 'exact reviewed job roster');
    // Invert only the four reviewed repository-identity guards. The original
    // held-job hashes still reject any unrelated workflow byte change.
    const historical = hddWorkflowBeforeRepositoryIdentity(
        '.github/workflows/i80386-hdd-gui-actual.yml', source);
    for (const [id, expected] of Object.entries(heldJobs)) {
        assert.equal(createHash('sha256').update(job(historical, id)).digest('hex'), expected,
            `unrelated ${id} job remains byte-exact`);
    }
    const f7 = job(source, 'finite-inventory-seven');
    const f9 = job(source, 'finite-inventory-nine');
    assert.equal(createHash('sha256').update(job(source, 'finite-inventory-eight')).digest('hex'),
        'c7ba1313fd31482ee1feeaa9456b2ff90416fe45b0fff03670714f3931541057', 'historical F8 body held except retired guard');
    const v8 = job(source, 'actual-v8');
    assert.match(f7, /if:\s*>-\s*\n\s*\$\{\{\s*false\s*&&/, 'spent F7 execution retired');
    assert.match(f9, /if:\s*>-\s*\n\s*\$\{\{\s*false\s*&&/, 'consumed F9 remains retired');
    assert.match(job(source, 'finite-inventory-eight'), /if:\s*>-\s*\n\s*\$\{\{\s*false\s*&&/, 'spent F8 remains retired');
    assert.match(v8, /if:\s*>-\s*\n\s*\$\{\{\s*false\s*&&/, 'predecessor V8 remains retired');

    assert.match(f9, /timeout-minutes: 15\b/);
    assert.match(v8, /timeout-minutes: 35\b/);
    for (const [block, refs] of [[f9, [checkout, setupNode, upload]],
        [v8, [checkout, setupNode, upload, upload]]]) {
        assert.match(block, new RegExp(`uses: ${checkout}`));
        assert.match(block, new RegExp(`uses: ${setupNode}`));
        assert.match(block, new RegExp(`uses: ${upload}`));
        assert.deepEqual(usesRefs(block), refs,
            'exact ordered pinned action roster');
        assert.deepEqual([...setupNodeStep(block).matchAll(/^          node-version: ([^\n]+)$/gm)]
            .map(match => match[1]), ['22.23.3'],
        'one reviewed Node version in the setup-node step');
        assert.equal((block.match(/scripts\/prepare-playwright-apt\.mjs/g) ?? []).length, 1,
            'one reviewed Ubuntu helper invocation per new route');
    }

    const f9Admit = 'Admit finite v9 body, event and exact source before package acquisition';
    const f9Setup = 'Trusted finite v9 package and Chromium setup';
    const f9Record = 'Record finite v9 runtime and installed regular bytes without guest';
    requireOrder(f9, [f9Admit, setupNode, f9Setup, f9Record]);
    assert.match(step(f9, f9Admit), /finite-inventory-v9-guard/);
    const f9Install = step(f9, f9Setup);
    assert.match(f9Install, /timeout-minutes: 10\b/);
    assert.ok(f9Install.includes('run: |\n          set -euo pipefail\n' +
        helperGroup('gui-finite-inventory-v9/bootstrap')),
    'one balanced helper group is the first executable setup command');
    requireOrder(f9Install, [helper, 'npm ci --ignore-scripts --no-audit --no-fund',
        'node node_modules/playwright/cli.js install --with-deps chromium']);
    assert.match(step(f9, f9Record), /timeout-minutes: 4\b/);

    const bootstrap = 'Install externally admitted v8 request and bootstrap source before package setup';
    const setup = 'Repeat v8 inventory installation exactly, without frontend build';
    const preflight = 'Refuse v8 runtime/source drift using retained admitted request';
    requireOrder(v8, [bootstrap, setupNode, setup, preflight]);
    const beforeNode = step(v8, bootstrap);
    assert.match(beforeNode, /actual-v8-bootstrap/);
    assert.match(beforeNode, /install-input/);
    assert.match(beforeNode, /--blob "\$BW_REQUEST_BLOB"/);
    assert.match(beforeNode, /--expected-sha256 "\$BW_REQUEST_SHA256"/);
    const installAt = beforeNode.indexOf('scripts/run-i80386-hdd-gui-actual.py install-input');
    const admitAt = beforeNode.indexOf('scripts/run-i80386-hdd-gui-actual.py actual-v8-bootstrap');
    assert.ok(installAt >= 0 && installAt < admitAt, 'one request install precedes bootstrap admission');
    assert.match(beforeNode.slice(installAt, admitAt), /--output "\$GITHUB_WORKSPACE\/gui-inputs\/request\.json"/,
        'installer writes fixed request path');
    assert.match(beforeNode.slice(admitAt), /--request "\$GITHUB_WORKSPACE\/gui-inputs\/request\.json"/,
        'bootstrap reads that installed request path');
    assert.equal((v8.match(/\binstall-input\b/g) ?? []).length, 1,
        'one immutable request installation before trusted setup');
    assert.equal((v8.match(/\bmkdir gui-inputs\b/g) ?? []).length, 1,
        'fresh request directory created only at bootstrap');
    const v8Install = step(v8, setup);
    assert.match(v8Install, /timeout-minutes: 8\b/);
    assert.ok(v8Install.includes('run: |\n          set -euo pipefail\n' +
        helperGroup('gui-setup/bootstrap-helper')),
    'V8 uses one balanced helper group before its first dependency command');
    requireOrder(v8Install, [helper, 'npm ci --ignore-scripts --no-audit --no-fund',
        'node node_modules/playwright/cli.js install --with-deps chromium']);
    const afterNode = step(v8, preflight);
    assert.match(afterNode, /actual-v8-preflight/);
    assert.match(afterNode, /--request "\$GITHUB_WORKSPACE\/gui-inputs\/request\.json"/);
    assert.doesNotMatch(afterNode, /\binstall-input\b|\bmkdir gui-inputs\b/);
}

const actualV9Controller = readFileSync(new URL('../scripts/run-i80386-hdd-gui-actual.py', import.meta.url), 'utf8');
function checkActualV9Source(source, controller = actualV9Controller) {
    const enabled = controller.match(/^ACTUAL_V9_ENABLED = (True|False)$/m)?.[1];
    assert.ok(enabled);
    assert.match(controller, new RegExp('^FINITE_INVENTORY_V10_ENABLED = ' + enabled + '$', 'm'),
        'source prelude and actual execution activation are coupled');
    const block = job(source, 'actual-v9');
    const gate = "      ${{ " + enabled.toLowerCase() + " && github.event_name == 'workflow_dispatch' && github.actor == 'CrispStrobe' &&\n" +
        "          github.repository_id == '1291854269' && github.run_attempt == 1 &&\n" +
        "          github.event.inputs.protocol == 'actual-v9' && github.ref_type == 'branch' &&\n" +
        "          github.event.inputs.pull_request != '' && github.event.inputs.prelude_sha256 != '' &&\n" +
        "          github.event.inputs.request_sha256 == '' && github.event.inputs.tag_name == '' &&\n" +
        "          github.event.inputs.source_head == github.sha &&\n" +
        "          github.event.inputs.source_ref == github.ref && startsWith(github.ref, 'refs/heads/lane/') }}";
    assert.ok(block.includes(gate), 'one exact source/actor/ref-bound new execution gate');
    assert.match(block, /timeout-minutes: 35\b/);
    const names = [checkout,
        'Install empty Python cache prefix and refuse unreviewed v9 source',
        'Admit source-bound actual-v9 prelude before setup', setupNode,
        'Install reviewed v9 dependencies without building the frontend',
        'Collect same-job V10 runtime inventory',
        'Retain immutable V10 same-job phase originals',
        'Await uniquely admitted same-job ACK and install request once',
        'Refuse v9 runtime/source drift using retained admitted request',
        'Prepare unchanged authenticated free media once for v9',
        'One official frontend acquisition and two serial genuine v9 UI scenarios', upload, upload];
    const actual = [...block.matchAll(/^      - (?:name|uses): ([^\n]+)$/gm)].map(m => m[1]);
    assert.deepEqual(actual, names, 'exact action/phase roster, no late or shadow stage');
    const refs = [...block.matchAll(/^      - uses: ([^\n]+)$|^        uses: ([^\n]+)$/gm)].map(m => m[1] || m[2]);
    assert.deepEqual(refs, [checkout, setupNode, upload, upload, upload]);
    assert.match(block, /ref: \$\{\{ github.sha \}\}/);
    assert.match(setupNodeStep(block), /node-version: 22\.23\.3\b/);
    for (const name of ['BW_GUI_HDD_ACTUAL_V9_PRELUDE_B64','BW_GUI_HDD_ACTUAL_V9_PRELUDE_SHA256',
        'BW_FINITE_INVENTORY_V10_TEMPLATE_B64','BW_FINITE_INVENTORY_V10_SHA256']) {
        assert.ok(block.includes('      ' + name + ': ${{ vars.' + name + ' }}'));
    }
    const isolatedWrapper = "          python_actual() {\n            local prefix=/home/runner/work/_temp/bw-gui-hdd-python-cache\n            test \"$(realpath -e \"$prefix\")\" = \"$prefix\" && test ! -L \"$prefix\"\n            test \"$(LC_ALL=C stat -c '%d %i %f %u %g %h %s %Y' \"$prefix\")\" = \"$(tail -n 1 gui-setup/python-startup.original.txt)\"\n            local entry_marker\n            entry_marker=\"$(find \"$prefix\" -mindepth 1 -maxdepth 1 -printf x -quit)\"\n            test -z \"$entry_marker\"\n            /usr/bin/python3.12 -I -S -B -X pycache_prefix=/home/runner/work/_temp/bw-gui-hdd-python-cache \"$@\"\n          }\n";
    for (const index of [2,5,7,8,10]) {
        const body=step(block,names[index]);
        assert.equal(body.split(isolatedWrapper).length,2,`one complete isolated Python wrapper: ${names[index]}`);
        assert.equal((body.match(/python_actual\(\) \{/g) || []).length,1,
            'no shadow Python function');
    }
    const initial = step(block, names[1]), admit = step(block, names[2]);
    assert.match(initial, /-I -S -B -X pycache_prefix=.*actual-v9-guard/);
    assert.match(initial, /mkdir -m 0555 "\$prefix"/);
    assert.match(admit, /\.py actual-v9-prelude/);
    assert.equal((block.match(/\.py actual-v9-guard\b/g) || []).length, 1);
    assert.equal((block.match(/\.py actual-v9-ack\b/g) || []).length, 1);
    assert.doesNotMatch(block, /\.py install-input\b/, 'only bound ACK controller installs the request');
    const setup = step(block, names[4]);
    assert.match(setup, /timeout-minutes: 8\b/);
    assert.ok(setup.includes(helperGroup('gui-finite-inventory-v10/bootstrap')));
    requireOrder(setup, [helper, 'npm ci --ignore-scripts --no-audit --no-fund',
        'node node_modules/playwright/cli.js install --with-deps chromium']);
    const collect = step(block, names[5]);
    assert.match(collect, /timeout-minutes: 4\b/);
    assert.match(collect, /--output "\$GITHUB_WORKSPACE\/gui-finite-inventory-v10\/inventory.json"/);
    const early = step(block, names[6]);
    assert.doesNotMatch(early, /if: always\(\)/, 'failed collection cannot publish a positive phase');
    assert.ok(early.includes('name: i80386-hdd-gui-actual-v9-phase-${{ github.run_id }}-${{ github.run_attempt }}'));
    assert.ok(early.includes('            gui-finite-inventory-v10\n            gui-actual-v9\n'));
    assert.ok(early.includes('!gui-finite-inventory-v10/controller.stdout'));
    assert.ok(early.includes('!gui-finite-inventory-v10/controller.stderr'));
    assert.ok(!early.includes('            gui-setup\n'), 'early packet excludes unrelated setup diagnostics');
    assert.match(step(block, names[7]), /\.py actual-v9-ack/);
    assert.match(step(block, names[8]), /\.py actual-v9-preflight/);
    const execute = step(block, names[10]);
    assert.equal((execute.match(/\.py actual-v9 /g) || []).length, 1, 'one exact current execution command');
    assert.match(execute, /timeout-minutes: 31\b/);
    for (const name of [names[8], names[10]]) {
        const text = step(block, name);
        assert.ok(text.includes('request_sha="$(python_actual -c '), 'selected cache mechanics also protect digest reading');
        assert.ok(text.includes('--expected-sha256 "$request_sha"'));
    }
    assert.equal((block.match(/if: always\(\)/g) || []).length, 2,
        'both terminal diagnostic deliveries survive failures');
}

test('retired F9 and V8 preserve their reviewed helper and source order', () => {
    checkSource(workflow);
});

test('source policy detects omitted, displaced and substituted bootstrap/helper edges', () => {
    const mutateNamedStep = (jobName, name, before, after) => {
        const original = step(job(workflow, jobName), name);
        assert.ok(original.includes(before), `mutation anchor in ${jobName}/${name}: ${before}`);
        const changed = original.replace(before, after);
        const candidate = workflow.replace(original, changed);
        assert.notEqual(candidate, workflow);
        for (const id of Object.keys(heldJobs)) assert.equal(job(candidate, id), job(workflow, id),
            `mutation does not touch held ${id} job`);
        assert.throws(() => checkSource(candidate), undefined, `reject ${jobName}/${name}: ${before}`);
    };
    const f9Admit = 'Admit finite v9 body, event and exact source before package acquisition';
    const v8Bootstrap = 'Install externally admitted v8 request and bootstrap source before package setup';
    mutateNamedStep('finite-inventory-nine', f9Admit, 'finite-inventory-v9-guard', 'finite-inventory-v7-guard');
    mutateNamedStep('actual-v8', v8Bootstrap, 'actual-v8-bootstrap', 'actual-v8-preflight');
    mutateNamedStep('actual-v8', v8Bootstrap, '--blob "$BW_REQUEST_BLOB"', '--blob "$OTHER_BLOB"');
    mutateNamedStep('actual-v8', v8Bootstrap,
        '--output "$GITHUB_WORKSPACE/gui-inputs/request.json"',
        '--output "$GITHUB_WORKSPACE/gui-inputs/other.json"');
    mutateNamedStep('actual-v8', v8Bootstrap,
        '--request "$GITHUB_WORKSPACE/gui-inputs/request.json"',
        '--request "$GITHUB_WORKSPACE/gui-inputs/other.json"');
    for (const [id, expected, wrong] of [
        ['finite-inventory-seven', 'false', 'true'],
        ['finite-inventory-eight', 'false', 'true'],
        ['finite-inventory-nine', 'false', 'true']]) {
        const block = job(workflow, id);
        assert.match(block, new RegExp(`if:\\s*>-\\s*\\n\\s*\\$\\{\\{\\s*${expected}\\s*&&`));
        assert.throws(() => checkSource(workflow.replace(block, block.replace(
            new RegExp(`(if:\\s*>-\\s*\\n\\s*\\$\\{\\{\\s*)${expected}\\s*&&`), `$1${wrong} &&`))),
        undefined, `wrong ${id} execution guard rejected`);
    }
    const v8 = job(workflow, 'actual-v8');
    const bootstrap = step(v8, v8Bootstrap);
    const misplaced = workflow.replace(bootstrap, '').replace(
        '      - name: Repeat v8 inventory installation exactly, without frontend build\n',
        bootstrap + '      - name: Repeat v8 inventory installation exactly, without frontend build\n');
    assert.throws(() => checkSource(misplaced), undefined, 'late bootstrap rejected');
    const installStart = bootstrap.indexOf('          python_actual scripts/run-i80386-hdd-gui-actual.py install-input \\\n');
    const installEnd = bootstrap.indexOf('gui-setup/input-install.stderr\n', installStart) +
        'gui-setup/input-install.stderr\n'.length;
    assert.ok(installStart >= 0 && installEnd > installStart);
    const command = bootstrap.slice(installStart, installEnd);
    const duplicate = workflow.replace(bootstrap, bootstrap.slice(0, installEnd) + command + bootstrap.slice(installEnd));
    assert.equal((step(job(duplicate, 'actual-v8'), v8Bootstrap).match(/\binstall-input\b/g) ?? []).length, 2);
    assert.throws(() => checkSource(duplicate), undefined, 'second request installation rejected');
    for (const name of ['finite-inventory-nine', 'actual-v8']) {
        const setup = name === 'actual-v8' ? 'Repeat v8 inventory installation exactly, without frontend build' :
            'Trusted finite v9 package and Chromium setup';
        const block = step(job(workflow, name), setup);
        const group = helperGroup(name === 'actual-v8' ? 'gui-setup/bootstrap-helper' :
            'gui-finite-inventory-v9/bootstrap');
        assert.equal(block.split(group).length, 2, `${name} has exactly one complete helper group`);
        const withoutHelper = block.replace(group, '');
        assert.equal((withoutHelper.match(/scripts\/prepare-playwright-apt\.mjs/g) ?? []).length, 0);
        assert.equal((withoutHelper.match(/^          \{$/gm) ?? []).length, 0,
            `${name} removal leaves no partial helper group`);
        assert.throws(() => checkSource(workflow.replace(block, withoutHelper)), undefined,
            `${name} omitted helper rejected`);
        assert.throws(() => checkSource(workflow.replace(block, block.replace(helper,
            'sudo env "PATH=$PATH" node scripts/unreviewed-apt.mjs'))), undefined,
            `${name} wrong helper path rejected`);
        const playAt = withoutHelper.indexOf('          node node_modules/playwright/cli.js install --with-deps chromium');
        assert.ok(playAt > withoutHelper.indexOf('          npm ci --ignore-scripts'));
        const moved = withoutHelper.slice(0, playAt) + group + withoutHelper.slice(playAt);
        assert.equal((moved.match(/scripts\/prepare-playwright-apt\.mjs/g) ?? []).length, 1);
        assert.equal((moved.match(/^          \{$/gm) ?? []).length, 1,
            `${name} move keeps one balanced group`);
        assert.throws(() => checkSource(workflow.replace(block, moved)), undefined,
            `${name} single helper after npm rejected`);
    }
});

test('source policy rejects extra jobs, extra actions and changed Node versions', () => {
    const extraJob = workflow + '  unreviewed-job:\n    runs-on: ubuntu-24.04\n    steps:\n      - run: echo unreviewed\n';
    assert.equal(jobNames(extraJob).length, reviewedJobs.length + 1);
    assert.throws(() => checkSource(extraJob), undefined, 'a fourteenth unconditional job is rejected');

    for (const id of ['finite-inventory-nine', 'actual-v8']) {
        const original = job(workflow, id);
        const nodeStep = setupNodeStep(original);
        const extraActionStep = `      - uses: ${checkout}\n`;
        const withAction = original.replace(nodeStep, nodeStep + extraActionStep);
        assert.deepEqual(usesRefs(withAction).length, usesRefs(original).length + 1);
        const actionCandidate = workflow.replace(original, withAction);
        for (const held of Object.keys(heldJobs)) assert.equal(job(actionCandidate, held), job(workflow, held));
        assert.throws(() => checkSource(actionCandidate), undefined, `${id} extra action rejected`);

        const withVersion = original.replace(nodeStep,
            nodeStep.replace('node-version: 22.23.3', 'node-version: 22.23.2'));
        assert.notEqual(withVersion, original);
        assert.deepEqual(usesRefs(withVersion), usesRefs(original));
        const versionCandidate = workflow.replace(original, withVersion);
        for (const held of Object.keys(heldJobs)) assert.equal(job(versionCandidate, held), job(workflow, held));
        assert.throws(() => checkSource(versionCandidate), undefined, `${id} changed Node version rejected`);
    }
});


test('same-job V9 keeps admission, setup, phase, ACK, entry and terminal delivery ordered', () => {
    checkActualV9Source(workflow);
});

test('same-job V9 source policy detects lost boundaries and nonexclusive setup', () => {
    const block=job(workflow,'actual-v9');
    const cases=[
        ["github.repository_id == '1291854269'", "github.repository_id == '1291854270'"],
        ["github.repository_id == '1291854269'", "github.repository == 'CrispStrobe/brickwright-lite'"],
        ['github.run_attempt == 1','github.run_attempt == 2'],
        ["startsWith(github.ref, 'refs/heads/lane/')","startsWith(github.ref, 'refs/')"],
        ['timeout-minutes: 35','timeout-minutes: 36'],
        ['.py actual-v9-prelude','.py actual-v8-bootstrap'],
        ['.py actual-v9-ack','.py install-input'],
        ['--ignore-scripts','--foreground-scripts'],
        ['node-version: 22.23.3','node-version: 22'],
        ['!gui-finite-inventory-v10/controller.stdout','gui-setup'],
    ];
    for(const [before,after] of cases){
        assert.ok(block.includes(before));
        assert.throws(()=>checkActualV9Source(workflow.replace(block,block.replace(before,after))),undefined,before);
    }
    const ack=step(block,'Await uniquely admitted same-job ACK and install request once');
    const early=step(block,'Retain immutable V10 same-job phase originals');
    const moved=block.replace(ack,'').replace(early,ack+early);
    assert.throws(()=>checkActualV9Source(workflow.replace(block,moved)));
    assert.throws(()=>checkActualV9Source(workflow,actualV9Controller.replace(/^ACTUAL_V9_ENABLED = (True|False)$/m,(_,value)=>'ACTUAL_V9_ENABLED = '+(value==='True'?'False':'True'))));
});


test('every same-job Python entry keeps isolation and empty-cache readbacks', () => {
    const block=job(workflow,'actual-v9');
    for(const name of [
        'Admit source-bound actual-v9 prelude before setup',
        'Collect same-job V10 runtime inventory',
        'Await uniquely admitted same-job ACK and install request once',
        'Refuse v9 runtime/source drift using retained admitted request',
        'One official frontend acquisition and two serial genuine v9 UI scenarios']){
        const original=step(block,name);
        for(const [before,after] of [
            [' -I -S -B -X ',' -S -B -X '],
            [' -I -S -B -X ',' -I -B -X '],
            [' -I -S -B -X ',' -I -S -X '],
            [' -X pycache_prefix=/home/runner/work/_temp/bw-gui-hdd-python-cache',''],
            ['test ! -L "$prefix"','true'],
            ['test -z "$entry_marker"','true'],
            ["stat -c '%d %i %f %u %g %h %s %Y'","stat -c '%d'"]]){
            assert.ok(original.includes(before),before);
            const changed=original.replace(before,after);
            assert.throws(()=>checkActualV9Source(workflow.replace(original,changed)),undefined,`${name}: ${before}`);
        }
    }
});
