import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parse} from 'acorn';

import {createReverseContinueCoordinator} from
    '../overlay/scratch-gui/src/lib/bw-debug/reverse-continue.js';

const hit = {boundaryCursor: 12, occurrenceCursor: 4,
    matchingIds: ['address:16'], generation: 2};

test('unsupported targets fail closed before history lookup or replay', () => {
    const calls = [];
    const coordinator = createReverseContinueCoordinator({
        canReverse: () => ({accepted: false, code: 'unsupported-restore',
            reason: 'target has no complete checkpoint'}),
        haltOccurrences: {
            previousBeforeBoundary: () => { calls.push('boundary lookup'); return hit; },
            previousByOccurrenceCursor: () => { calls.push('occurrence lookup'); return hit; }
        },
        reverseToEvent: () => { calls.push('replay'); return {accepted: true}; }
    });

    const refusal = {accepted: false, code: 'unsupported-restore',
        reason: 'target has no complete checkpoint'};
    assert.deepEqual(coordinator.status(30), refusal);
    assert.deepEqual(coordinator.reverse(30), refusal);
    assert.deepEqual(calls, [], 'a capability refusal must not touch plausible-looking history');
});

test('reset returns a chained reverse continue to boundary lookup at live end', () => {
    const lookups = [];
    const coordinator = createReverseContinueCoordinator({
        canReverse: () => ({accepted: true}),
        haltOccurrences: {
            previousBeforeBoundary: before => { lookups.push(['boundary', before]); return hit; },
            previousByOccurrenceCursor: before => { lookups.push(['occurrence', before]); return null; }
        },
        reverseToEvent: () => ({accepted: true, verified: true})
    });

    assert.equal(coordinator.reverse(30).accepted, true);
    assert.equal(coordinator.status(12).code, 'no-previous-breakpoint');
    coordinator.reset();
    assert.equal(coordinator.status(40).accepted, true);
    assert.deepEqual(lookups, [['boundary', 30], ['occurrence', 4], ['boundary', 40]]);
});

test('failed replay does not advance the occurrence chain', () => {
    const lookups = [];
    let accepted = false;
    const coordinator = createReverseContinueCoordinator({
        canReverse: () => ({accepted: true}),
        haltOccurrences: {
            previousBeforeBoundary: before => { lookups.push(['boundary', before]); return hit; },
            previousByOccurrenceCursor: before => { lookups.push(['occurrence', before]); return null; }
        },
        reverseToEvent: () => accepted ? {accepted: true} :
            {accepted: false, code: 'replay-diverged'}
    });

    assert.equal(coordinator.reverse(30).code, 'replay-diverged');
    accepted = true;
    assert.equal(coordinator.reverse(30).accepted, true);
    assert.equal(coordinator.status(12).code, 'no-previous-breakpoint');
    assert.deepEqual(lookups, [['boundary', 30], ['boundary', 30], ['occurrence', 4]]);
});

test('runner resets reverse chaining for every new forward lifecycle', () => {
    const source = readFileSync(new URL(
        '../overlay/scratch-gui/src/lib/bw-debug/debug-runner.js', import.meta.url), 'utf8');
    // Use the real method body: start accepts a destructured optional argument,
    // and neither parameter braces nor a neighboring method belong to its body.
    const ast = parse(source, {ecmaVersion: 'latest', sourceType: 'module'});
    const factory = ast.body.find(node => node.type === 'ExportNamedDeclaration' &&
        node.declaration?.type === 'FunctionDeclaration' &&
        node.declaration.id.name === 'createDebugRunner')?.declaration;
    assert.ok(factory, 'runner factory must exist');
    const methods = factory.body.body.filter(node => node.type === 'VariableDeclaration')
        .flatMap(node => node.declarations)
        .find(node => node.id.type === 'Identifier' && node.id.name === 'runner')?.init;
    assert.equal(methods?.type, 'ObjectExpression', 'runner must expose its methods');
    const body = name => {
        const method = methods.properties.find(node => node.type === 'Property' &&
            node.method && !node.computed && node.key.name === name);
        assert.equal(method?.value.body.type, 'BlockStatement', `${name} must have a method body`);
        if (name === 'start') assert.equal(method.value.async, true, 'start remains asynchronous');
        return source.slice(method.value.body.start, method.value.body.end);
    };

    for (const [name, section] of [
        ['new run', body('start')],
        ['resume', body('resume')],
        ['forward block step', body('step')],
        ['new recording', body('startDebugRecording')],
        ['forward instruction step', body('stepInstruction')],
        ['step over', body('stepOver')],
        ['step out', body('stepOut')]
    ]) {
        assert.match(section, /reverseCursor = null;[\s\S]*reverseContinue\.reset\(\)/, name);
    }
});
