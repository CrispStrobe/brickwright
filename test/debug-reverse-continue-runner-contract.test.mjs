import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parse} from 'acorn';

const runner = readFileSync(new URL(
    '../overlay/scratch-gui/src/lib/bw-debug/debug-runner.js', import.meta.url), 'utf8');
const panel = readFileSync(new URL(
    '../overlay/scratch-gui/src/components/tw-pseudocode/debug-panel.jsx', import.meta.url), 'utf8');
const coordinator = readFileSync(new URL(
    '../overlay/scratch-gui/src/lib/bw-debug/reverse-continue.js', import.meta.url), 'utf8');

const methodBody = (name, nextName) => {
    const start = runner.indexOf(`${name}()`);
    assert.notEqual(start, -1, `runner must expose ${name}()`);
    const end = runner.indexOf(nextName, start);
    assert.notEqual(end, -1, `could not find boundary after ${name}()`);
    return runner.slice(start, end);
};

test('reverse continue exposes a readiness query and command over recorded halt occurrences', () => {
    const status = methodBody('reverseContinueDebugStatus', 'reverseContinueDebug()');
    assert.match(runner,
        /canReverse: \(\) => reverseHistoryRefusal \|\| haltLedgerRefusal \|\|[\s\S]{0,140}cycleReplay\.canReverse/,
        'recorded history is not enough unless an eligible verified replay path is complete');
    assert.match(runner, /reverseToEvent: eventCursor => cycleReplay\.canReverse\(\)\.accepted \?/,
        'a recorded cycle provider must continue through cycle verification, not instruction replay');
    assert.match(coordinator, /haltOccurrences\.previousBeforeBoundary\(beforeCursor\)/,
        'status must use the bounded halt-occurrence index, not scan event payloads');
    assert.match(coordinator, /['"]no-previous-breakpoint['"]/,
        'absence of an earlier retained halt must be a structured refusal');
    assert.doesNotMatch(status, /eventsFrom\(|checkpoints\(/,
        'a status/UI query must not clone recorded events or snapshots');
});

test('only active 8086 forward breakpoint halts enter the occurrence ledger', () => {
    assert.match(runner, /targetKind !== 'i8086' \|\| !recordingSession\.status\(\)\.active/);
    assert.match(runner, /\['breakpoint', 'watchpoint', 'port', 'interrupt'\]\.includes\(why\.cause\)/);
    // The bench session reports through onChange (createDebugSession has no onHalt).
    assert.match(runner, /if \(st\.halted && !benchHalted\) \{\s*benchHalted = true;\s*recordNativeHaltOccurrence\(st\.why\)/);
    assert.match(runner, /boundaryCursor: eventStream\.nextSequence\(\)/);
    assert.doesNotMatch(runner, /\['breakpoint', 'watchpoint', 'port', 'interrupt', 'step'\]/,
        'steps, user pauses, stops and replay orchestration are not historical breakpoint decisions');
});

test('successful condition edits advance the breakpoint history generation', () => {
    const start = runner.indexOf('setCondition(blockId, source)');
    const end = runner.indexOf('conditionOf,', start);
    assert.ok(start >= 0 && end > start);
    const condition = runner.slice(start, end);
    assert.match(condition, /setCondition\(blockId, source\);\s*breakpointGeneration\+\+/);
});

test('reverse continue chains strictly from the last successful reverse cursor', () => {
    const status = methodBody('reverseContinueDebugStatus', 'reverseContinueDebug()');
    assert.match(status, /const before = reverseCursor \?\?/,
        'the first command searches from live end and later commands from restored history');
    assert.match(coordinator, /previousBeforeBoundary\(beforeCursor\)/,
        'the recorder query owns strict-before occurrence ordering');

    const command = methodBody('reverseContinueDebug', 'clearTrace');
    assert.match(command, /reverseContinue\.reverse\(before\)/);
    assert.match(runner, /reverseToEvent: eventCursor => runner\.reverseDebugToEvent\(eventCursor\)/,
        'successful selection must reuse verified replay and its cursor update');
});

test('reverse continue reuses the one quiesced verified replay lifecycle', () => {
    const replayStart = runner.indexOf('reverseDebugToEvent: eventCursor =>');
    const replayEnd = runner.indexOf('canReverseDebug:', replayStart);
    assert.ok(replayStart >= 0 && replayEnd > replayStart);
    const replay = runner.slice(replayStart, replayEnd);
    assert.match(replay,
        /recordingSession\.stop\(\);[\s\S]*?session\.pause\(\);[\s\S]*?unschedule\(\);[\s\S]*?instructionReplay\.reverseToEvent\(eventCursor\)/);
    assert.match(replay, /reverseCursor = eventCursor/,
        'only a successful verified replay advances the logical reverse cursor');
});

test('historical navigation never reevaluates breakpoints or repeats their actions', () => {
    const start = runner.indexOf('reverseContinueDebugStatus()');
    const end = runner.indexOf('clearTrace', start);
    assert.ok(start >= 0 && end > start);
    const reverseContinue = runner.slice(start, end);
    assert.doesNotMatch(reverseContinue,
        /evaluateEventBreakpoints|evaluateBreakpoints|executeBreakpointPlan/,
        'encounter counters, one-shot state, and conditions are forward-history facts');
    assert.doesNotMatch(reverseContinue,
        /\.checkpointDebugRecording\(|\blog\(|\bcapture\(|\bwrite\(/,
        'log/capture/checkpoint/write actions must not run again while navigating history');
});

test('UI exposes only runner-gated reverse continue and keeps refusals visible', () => {
    assert.match(panel, /runner\.reverseContinueDebugStatus\(\)/);
    assert.match(panel, /runner\.reverseContinueDebug\(\)/);
    assert.match(panel, /disabled=\{!canReverseContinue \|\| busy\}/);
    assert.ok(panel.includes('data-debug-reverse-continue'));
    assert.match(panel, /reverseStatus: result\.accepted \? null : result/);
});

test('forward execution after reverse forks retained history and honors refusal', () => {
    assert.match(runner, /function beginForwardBranch\(requestedBranchId = null\)[\s\S]*prepareFork/);
    assert.match(runner, /prepared\.reservation\.commit\(child\)[\s\S]*forkRecordingStore\.activate/);
    // Acorn bounds each actual method independently of its parameter signature.
    const ast = parse(runner, {ecmaVersion: 'latest', sourceType: 'module'});
    const factory = ast.body.find(node => node.type === 'ExportNamedDeclaration' &&
        node.declaration?.type === 'FunctionDeclaration' &&
        node.declaration.id.name === 'createDebugRunner')?.declaration;
    assert.ok(factory, 'runner factory must exist');
    const methods = factory.body.body.filter(node => node.type === 'VariableDeclaration')
        .flatMap(node => node.declarations)
        .find(node => node.id.type === 'Identifier' && node.id.name === 'runner')?.init;
    assert.equal(methods?.type, 'ObjectExpression', 'runner must expose its methods');
    for (const method of ['start', 'resume', 'step', 'stepInstruction', 'stepOver', 'stepOut']) {
        const node = methods.properties.find(property => property.type === 'Property' &&
            property.method && !property.computed && property.key.name === method);
        assert.equal(node?.value.body.type, 'BlockStatement', `method body for ${method}`);
        if (method === 'start') assert.equal(node.value.async, true, 'start remains asynchronous');
        const body = runner.slice(node.value.body.start, node.value.body.end);
        assert.match(body, /beginForwardBranch\(\)/, method);
        assert.match(body, /if \(!forked\.accepted\)/, method);
    }
    assert.match(runner, /startDebugRecording\(\)[\s\S]*reverseHistoryRefusal = null/,
        'a new deterministic recording establishes the next valid history epoch');
});
