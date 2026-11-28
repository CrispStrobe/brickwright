import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx',
    import.meta.url), 'utf8');

test('fe, Tcl, Forth and Cowgol offer a board run through their blocks', () => {
    assert.match(source, /\['fe', 'tcl', 'forth', 'cowgol'\]\.includes\(this\.state\.lang\) && this\.currentDevice\(\)/);
    assert.match(source, /data-testid=\{menu \? "bw-run-via-blocks-menu" : "bw-run-via-blocks"\}/);
    // The run opens the debugger only after a conversion that preserved the program.
    assert.match(source, /const applied = device === 'riscv32' \? await this\.compile\(\{targetDevice: device\}\) : await this\.compile\(\);/);
    assert.doesNotMatch(source, /'(?:Lisp \(fe|Tcl \(partcl|Forth \(zForth) on DOS\)'/);
    assert.match(source, /'Tcl \(Jim: DOS, or any board via blocks\)'/);
});

test('board run requires a successful current conversion even if the prior report succeeded', async () => {
    const start = source.indexOf('    async runViaBlocksOnDevice ()');
    const end = source.indexOf('    async runCowgolAsBlocks ()', start);
    let opened = 0;
    const Editor = new Function('showCircuitDebugger', `return class {${source.slice(start, end)}}`)(() => opened++);
    const editor = new Editor();
    Object.assign(editor, {state: {lang: 'cowgol', conversionReport: {preserved: true}},
        activeCode: () => 'source', codeDevice: () => 'pico', compile: async () => undefined});
    await editor.runViaBlocksOnDevice();
    assert.equal(opened, 0, 'a prior successful report cannot authorize this refused import');
    editor.compile = async () => true;
    await editor.runViaBlocksOnDevice();
    assert.equal(opened, 1);
    editor.compile = async () => { editor.state.lang = 'python'; return true; };
    await editor.runViaBlocksOnDevice();
    assert.equal(opened, 1, 'a language change revokes the debugger action');
});

test('the fe tab runs fe\'s own interpreter on RISC-V through the hosted C route', () => {
    assert.match(source, /data-testid=\{menu \? "bw-fe-run-riscv-menu" : "bw-fe-run-riscv"\}/);
    assert.match(source, /return this\.runCOnRiscv\('server', feProgramToC\(this\.activeCode\(\)\)\);/);
    assert.match(source, /async runCOnRiscv \(forceRoute, sourceOverride\)/);
});

test('the Forth tab runs zForth on RISC-V through the hosted C route', () => {
    assert.match(source, /data-testid=\{menu \? "bw-forth-run-riscv-menu" : "bw-forth-run-riscv"\}/);
    assert.match(source, /return this\.runCOnRiscv\('server', forthProgramToC\(this\.activeCode\(\)\)\);/);
});

test('the Tcl tab runs Jim Tcl on RISC-V with the pinned source fetched on demand', () => {
    assert.match(source, /data-testid=\{menu \? "bw-tcl-run-riscv-menu" : "bw-tcl-run-riscv"\}/);
    assert.match(source, /source = await fetchTclProgramC\(this\.activeCode\(\)\);/);
    assert.match(source, /return this\.runCOnRiscv\('server', source\);/);
});
