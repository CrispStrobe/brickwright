import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';

const root = path.join(import.meta.dirname, '..');
const proof = readFileSync(path.join(root, 'scripts/verify-i8086-browser.mjs'), 'utf8');
const workflow = readFileSync(path.join(root, '.github/workflows/build.yml'), 'utf8');

test('the 8086 browser proof closes the local assembly, display, key and port journey', () => {
    for (const evidence of [
        "selectOption('i8086')", "selectOption('keys')", "selectOption('pins')",
        'bw-asm-assemble', 'codeOperationStatus', 'in this browser', 'bw-machine-canvas', 'bw-serial-console',
        '/Z\\s+5A/', 'bw-ctl-bargraph-PC GPIO', 'bw-ctl-button-PC switch',
        'hostedCompilerRequests.length === 0'
    ]) assert.ok(proof.includes(evidence), `missing browser evidence: ${evidence}`);
    assert.match(proof, /isHostedCompilerRequest/);
    assert.match(proof, /bw-i8086-proof-control=1/,
        'zero hosted requests needs a positive interception control');
    assert.doesNotMatch(proof, /waitForTimeout|setTimeout/,
        'the production journey must wait on conditions, never elapsed guesses');
    const importer = readFileSync(path.join(root,
        'overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx'), 'utf8');
    assert.match(importer, /data-code-operation-status=/,
        'the asynchronous assembly verdict needs a stable production selector');
    assert.match(importer, /__bwPendingMedia = \{type: 'asm', detail\}/,
        'assembling before the lazy Circuit tab mounts must not lose the image');
    assert.match(importer, /key: 'bw-right-pane-hidden', value: '0'/,
        'launching an assembled program must expose the default right-docked debugger');
    const circuit = readFileSync(path.join(root,
        'overlay/scratch-gui/src/components/tw-pseudocode/circuit-tab.jsx'), 'utf8');
    // MATCHED AS A BLOCK, NOT AS ONE LINE, and the reason is a false RED this
    // gate produced on 2026-09-04. The assertion required the exact spelling
    //
    //     if (window.__bwPendingMedia) this.setState({machineBooted: true})
    //
    // and `perf(react): attribute circuit update sources` (20a7832da) inserted
    // a `_markReactUpdate` call into that block, splitting the one-liner. The
    // replay still works; only the formatting moved, and lite's suite went red
    // for it.
    //
    // That is species 1 of GATES-THAT-CANNOT-FAIL -- a source-text match that
    // tracks SPELLING rather than behaviour -- running in the other direction.
    // The documented failure is a gate that passes while checking nothing;
    // this is the same defect producing a failure while nothing is wrong, and
    // it costs more than it looks: a red that everyone learns to explain away
    // is how a real one hides.
    //
    // Still source-text, because that is what this gate is for. But it now
    // requires the CONDITION and the SETSTATE with anything between them,
    // which is the claim -- a program assembled before the tab mounted is
    // replayed -- rather than a claim about line breaks.
    // SAME BLOCK, enforced by allowing no closing brace between them. A
    // window of "some characters" is not enough: this file has FOUR
    // `machineBooted: true` sites and several `__bwPendingMedia` ones, so a
    // 200-character window matched a different pair and the assertion
    // survived deleting the very line it exists to protect. Caught by
    // red-proving the fix rather than by trusting that it went green.
    assert.match(circuit,
        // OPTIONAL BRACE — brickwright-lite-ea's form, and it fixes a weakness
        // in mine. Requiring `{` meant the gate went RED again if anyone
        // un-braced the block back to a one-liner: I had not removed the
        // brittleness, only moved it to the opposite refactor. Proved by
        // doing exactly that and watching it fail.
        //
        // `\{?[^}]*?` matches both forms while still forbidding a closing
        // brace between the condition and the effect — which is what keeps it
        // asserting CONTAINMENT rather than mere proximity. A character window
        // passes when the effect is hoisted OUT of the condition; this does
        // not, and that is the case my 200-character version failed.
        /if \(window\.__bwPendingMedia\) \{?[^}]*?machineBooted: true/,
        'the lazy Circuit tab must replay a program assembled before it mounted');
    assert.match(circuit, /!prevState\.machineBooted && this\.state\.machineBooted/,
        'the retained image must be replayed after the lazy debugger commit');
    assert.match(circuit, /this\.props\.isVisible && !prevProps\.isVisible[\s\S]*bw-asm-rom-ready/,
        'entering Circuit must synchronize media delivered while Code was visible');
    const debugPanel = readFileSync(path.join(root,
        'overlay/scratch-gui/src/components/tw-pseudocode/debug-panel.jsx'), 'utf8');
    assert.match(debugPanel, /return this\._onMediaLoad/,
        'the ASM handoff must preserve the asynchronous media-load promise');
    assert.match(debugPanel, /Promise\.resolve\(pendingReplay\)\.then/,
        'mount-time auto-run must wait for retained media to finish loading');
    const runner = readFileSync(path.join(root,
        'overlay/scratch-gui/src/lib/bw-debug/debug-runner.js'), 'utf8');
    assert.match(runner, /const built = runnerCompilesProjectBlocks\(\{selectedKind, bootMedia}\)/,
        'an 8086 media image must bypass unrelated Scratch pin compilation');
});

test('CI runs the 8086 proof against the served build and preserves its evidence', () => {
    assert.match(workflow, /PROOF_URL=http:\/\/localhost:8617\/ node scripts\/verify-i8086-browser\.mjs/);
    assert.match(workflow, /name: i8086-production-browser-proof/);
    assert.match(workflow, /path: artifacts\/i8086-browser\//);
    assert.match(workflow, /if-no-files-found: error/);
});

test('browser gate exercises execution preference through real controls and reconstruction', () => {
    for (const evidence of [
        "getByTestId('i8086-execution-mode').selectOption('wired')",
        'await executionStatus.textContent() === activeBeforePreference',
        'No active 8086\\/80186', 'Refused: no-matching-implementation',
        'await page.reload(', "inputValue() === 'wired'",
        "getByTestId('i8086-execution-mode').selectOption('auto')",
        'Auto successfully reconstructs the DOS-services target after explicit refusal'
    ]) assert.ok(proof.includes(evidence), `missing execution browser step: ${evidence}`);
    assert.doesNotMatch(proof, /i8086Execution\.(?:construct|setPreference)\(/,
        'browser proof must drive actual application controls, not construct a synthetic target');
});


test('cancelling while the diagnostics chunk loads reports a cancelled benchmark', () => {
    const lab = readFileSync(path.join(root, 'overlay/scratch-gui/src/components/menu-bar/i8086-lab.jsx'), 'utf8');
    assert.match(lab, /const \{compareSandbox\} = await import\([^;]+\);\s*if \(controller\.signal\.aborted\) throw new Error\('Benchmark cancelled'\)/);
    assert.match(lab, /catch \(error\) \{\s*if \(active\.current === controller\) setStatus/);
});
