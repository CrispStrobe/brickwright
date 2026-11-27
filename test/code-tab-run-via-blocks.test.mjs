import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx',
    import.meta.url), 'utf8');

test('fe, Tcl and Forth offer a board run through their blocks, not only DOS', () => {
    assert.match(source, /\['fe', 'tcl', 'forth'\]\.includes\(this\.state\.lang\) && this\.currentDevice\(\)/);
    assert.match(source, /data-testid=\{menu \? "bw-run-via-blocks-menu" : "bw-run-via-blocks"\}/);
    // The run opens the debugger only after a conversion that preserved the program.
    assert.match(source, /async runViaBlocksOnDevice \(\) \{\s*await this\.compile\(\);\s*if \(this\.state\.conversionReport\?\.preserved\) showCircuitDebugger\(\);/);
    assert.doesNotMatch(source, /'(?:Lisp \(fe|Tcl \(partcl|Forth \(zForth) on DOS\)'/);
    assert.match(source, /'Tcl \(Jim: DOS, or any board via blocks\)'/);
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
