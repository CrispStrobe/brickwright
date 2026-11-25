/**
 * The focused lanes are useful only when every copy of their governed inputs
 * can summon them. In particular, packages/ is committed and reviewable even
 * though integrate.mjs later overwrites it from overlay/: a packages-only
 * change must not evade the same native/security/debugger verdicts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

const eventPaths = (workflow, event) => {
    const text = readFileSync(path.join(ROOT, '.github', 'workflows', workflow), 'utf8');
    const lines = text.split('\n');
    const eventLine = lines.findIndex(line => new RegExp(`^  ${event}:`).test(line));
    assert.notEqual(eventLine, -1, `${workflow} has no ${event} trigger`);
    const pathsLine = lines.findIndex((line, i) => i > eventLine && /^    paths:$/.test(line));
    assert.notEqual(pathsLine, -1, `${workflow} ${event} has no paths list`);
    const entries = [];
    for (let i = pathsLine + 1; i < lines.length; i++) {
        const match = /^      - ['"](.+)['"]$/.exec(lines[i]);
        if (match) entries.push(match[1]);
        else if (/^  \S/.test(lines[i]) || /^    \S/.test(lines[i])) break;
    }
    return entries;
};

const assertLane = (workflow, required) => {
    const push = eventPaths(workflow, 'push');
    const pullRequest = eventPaths(workflow, 'pull_request');
    assert.deepEqual(push, pullRequest,
        `${workflow}: push and pull_request govern different inputs`);
    for (const input of required) {
        assert.ok(push.includes(input), `${workflow}: ${input} can change without running this lane`);
    }
};

test('native packaging, policy, security, and both committed source copies trigger Tauri', () => {
    assertLane('tauri.yml', [
        'apps/tauri/**',
        'overlay/scratch-vm/src/extension-support/native-broker-*.js',
        'packages/scratch-vm/src/extension-support/native-broker-*.js',
        'overlay/scratch-gui/static/native-broker/**',
        'packages/scratch-gui/static/native-broker/**',
        'overlay/scratch-gui/src/lib/distribution-policy.js',
        'packages/scratch-gui/src/lib/distribution-policy.js',
        'scripts/package-native-broker-*.mjs',
        'scripts/prepare-spike-micropython-pins.mjs',
        'scripts/verify-native-downloads-e2e.mjs',
        'scripts/verify-native-confirm-e2e.mjs',
        'overlay/scratch-gui/src/lib/native-dialog.js',
        'packages/scratch-gui/src/lib/native-dialog.js',
        'overlay/scratch-gui/src/containers/menu-bar-hoc.jsx',
        'packages/scratch-gui/src/containers/menu-bar-hoc.jsx',
        'scripts/verify-native-prompt-e2e.mjs',
        'overlay/scratch-gui/src/lib/prompt-modal.jsx',
        'packages/scratch-gui/src/lib/prompt-modal.jsx',
        'overlay/scratch-gui/src/containers/extension-library.jsx',
        'packages/scratch-gui/src/containers/extension-library.jsx',
        'scripts/verify-build-policy.mjs',
        'test/native-*.test.mjs',
        'test/*build-policy*.test.mjs',
        'test/gpl-toolchain-not-bundled.test.mjs',
        'test/ble-startup.test.mjs',
        'test/workflow-trigger-coverage.test.mjs'
    ]);
});

test('either committed debugger UI copy triggers the focused debugger lane', () => {
    assertLane('debugger.yml', [
        'overlay/scratch-gui/src/components/tw-pseudocode/debug-panel.jsx',
        'packages/scratch-gui/src/components/tw-pseudocode/debug-panel.jsx',
        'overlay/scratch-gui/src/components/tw-pseudocode/debug-*.jsx',
        'packages/scratch-gui/src/components/tw-pseudocode/debug-*.jsx',
        'overlay/scratch-gui/src/lib/bw-debug/**',
        'packages/scratch-gui/src/lib/bw-debug/**',
        'test/workflow-trigger-coverage.test.mjs'
    ]);
});

test('CP1 qualification runs for both committed UI copies, runner, persistence, fixtures and supplier pins', () => {
    assertLane('cp1-qualification.yml', [
        '.github/workflows/cp1-qualification.yml',
        'vendor-pins.json', 'package.json', 'package-lock.json',
        'overlay/scratch-gui/src/components/tw-pseudocode/cp1-*',
        'packages/scratch-gui/src/components/tw-pseudocode/cp1-*',
        'overlay/scratch-gui/src/lib/cp1-*',
        'packages/scratch-gui/src/lib/cp1-*',
        'overlay/scratch-gui/src/lib/bw-debug/**',
        'packages/scratch-gui/src/lib/bw-debug/**',
        'overlay/scratch-gui/src/lib/bw-project-bundle.js',
        'packages/scratch-gui/src/lib/bw-project-bundle.js',
        'scripts/verify-cp1-*.mjs', 'test/fixtures/cp1-panel/**',
        'test/cp1-*.test.mjs', 'test/workflow-trigger-coverage.test.mjs'
    ]);
    const workflow = readFileSync(path.join(ROOT, '.github/workflows/cp1-qualification.yml'), 'utf8');
    assert.match(workflow, /branches: \[main, 'feat\/kosmos-cp1-20261124'\]/);
    assert.match(workflow, /permissions:\n  contents: read/);
    assert.match(workflow, /npm run verify:cp1:browser/);
    assert.match(workflow, /node scripts\/verify-cp1-panel-browser\.mjs/);
    assert.match(workflow, /if: always\(\)/);
    assert.doesNotMatch(workflow, /continue-on-error|pull_request_target|\$\{\{\s*secrets\./);
});
