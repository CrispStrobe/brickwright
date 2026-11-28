// SPDX-License-Identifier: BSD-3-Clause
// The full physics assertions need the built BBCSDL WASM module. Their CI
// assignment is mandatory; missing artifacts remain an ordinary test failure.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {listTests} from '../scripts/list-tests.mjs';

const workflow = readFileSync(new URL('../.github/workflows/crispbasic.yml', import.meta.url), 'utf8');
const file = 'test/crispbasic-wasm/cad-physics.test.mjs';
const command = `        run: node --test ${file}\n`;
const stepName = '      - name: Verify real BASIC against the shipped CAD physics worker\n';
const pathFilter = "      - 'test/crispbasic-wasm/**'\n";

function block(text, name) {
    const start = text.indexOf(`  ${name}:\n`);
    assert.ok(start >= 0, `missing ${name} block`);
    const rest = text.slice(start + 3 + name.length);
    const end = rest.search(/^  [a-z][\w-]*:\n/m);
    return end < 0 ? rest : rest.slice(0, end);
}

function inspect(text) {
    const wasm = block(text, 'wasm');
    const starts = [...wasm.matchAll(/^      - /gm)].map(match => match.index);
    const steps = starts.map((start, index) => wasm.slice(start, starts[index + 1] ?? wasm.length));
    const build = steps.find(step => step.startsWith('      - name: Build both real interpreter backends\n'));
    const run = steps.filter(step => step.startsWith(stepName));
    assert.ok(build && /^          npm run build:wasm$/m.test(build), 'the owning job must build the real interpreter');
    assert.equal(run.length, 1, 'the physics gate must execute exactly once in the WASM job');
    assert.ok(run[0].includes(command), 'the physics gate must run the actual test file as a hard command');
    assert.match(run[0], /^        working-directory: \.$/m, 'the runtime test path is rooted in Brickwright');
    assert.ok(steps.indexOf(build) < steps.indexOf(run[0]), 'physics must run after the interpreter build');
    for (const step of [build, run[0]]) {
        assert.doesNotMatch(step, /^        (?:if|continue-on-error):/m, 'build and physics may not be skipped or softened');
    }
    assert.doesNotMatch(wasm, /^    (?:if|continue-on-error):/m, 'the owning WASM job must be unconditional and hard');
    assert.match(block(text, 'production'), /^    needs: wasm$/m, 'production qualification depends on the physics-owning job');
    for (const trigger of ['push', 'pull_request']) {
        assert.equal(block(text, trigger).split(pathFilter).length, 2, `${trigger} must select runtime-only changes`);
    }
    return {wasm, build, step: run[0]};
}

test('real CAD physics has a mandatory built-runtime CI owner while source clock checks remain in fast', () => {
    inspect(workflow);
    assert.ok(existsSync(new URL(`../${file}`, import.meta.url)));
    const fast = listTests('fast');
    assert.ok(fast.includes('test/crispbasic-cad-ci.test.mjs'));
    for (const sourceTest of ['crispbasic-cad-clock', 'circuit-cad-cancellation', 'crispbasic-circuit-session']) {
        assert.ok(fast.includes(`test/${sourceTest}.test.mjs`), `${sourceTest} remains a source-level gate`);
    }
    assert.equal(fast.includes(file), false, 'source shards must not assume a WASM build that they never prepare');
    assert.equal(fast.includes('test/crispbasic-cad-physics.test.mjs'), false);
});

test('the routing guard rejects missing, misplaced, conditional and softened physics execution', () => {
    const {build, step} = inspect(workflow);
    const mutations = [
        workflow.replace(step, ''),
        workflow.replace(step, step.replace(command, '        run: echo omitted physics\n')),
        workflow.replace(step, step.replace(command, command.trimEnd() + ' || true\n')),
        workflow.replace(step, step.replace(stepName, stepName + '        if: false\n')),
        workflow.replace(step, step.replace(stepName, stepName + '        continue-on-error: true\n')),
        workflow.replace(step, step.replace('working-directory: .', 'working-directory: packages/crisp-basic')),
        workflow.replace(step, '').replace(build, step + build),
        workflow.replace(build, build.replace('          npm run build:wasm\n', '')),
        workflow.replace(step, '').replace('  native:\n', '  native:\n' + step),
        workflow.replace('  wasm:\n', '  wasm:\n    continue-on-error: true\n'),
        workflow.replace('  wasm:\n', '  wasm:\n    if: false\n')
    ];
    for (const mutated of mutations) {
        assert.notEqual(mutated, workflow, 'mutation must change the actual workflow');
        assert.throws(() => inspect(mutated));
    }
});

test('the routing guard rejects losing either runtime path trigger or the downstream dependency', () => {
    for (const trigger of ['push', 'pull_request']) {
        const original = block(workflow, trigger);
        const replacement = original.replace(pathFilter, '');
        assert.notEqual(replacement, original);
        const start = workflow.indexOf(`  ${trigger}:\n`) + 3 + trigger.length;
        const changed = workflow.slice(0, start) + replacement + workflow.slice(start + original.length);
        assert.throws(() => inspect(changed), new RegExp(trigger));
    }
    const production = block(workflow, 'production');
    assert.throws(() => inspect(workflow.replace(production, production.replace('    needs: wasm\n', ''))),
        /production qualification/);
});
