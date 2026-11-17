import test from 'node:test';
import assert from 'node:assert/strict';
import {directlyExecutesPromisifiedGate as executes} from '../scripts/lib/gate-promisified-exec.mjs';
const gate = 'verify-cad-rover-project.mjs';
const imports = "import {execFile} from 'node:child_process'; import {promisify} from 'node:util';";
const call = `promisify(execFile)(process.execPath, ['--import', './scripts/lib/register-gui-scope.mjs', 'scripts/${gate}', output])`;
test('counts only the actual imported child executable and program argument', () => {
    assert.equal(executes(`${imports} const run = () => ${call};`, gate), true);
    for (const source of [
        `const run = () => ${call};`,
        `${imports} function run(execFile) { return ${call}; }`,
        `${imports} function run(promisify) { return ${call}; }`,
        `${imports} function run(process) { return ${call}; }`,
        `${imports} process.execPath = '/other'; ${call};`,
        `${imports} unrelated(execFile)(process.execPath, ['scripts/${gate}']);`,
        `${imports} promisify(execFile)(process.execPath, ['--import', 'scripts/${gate}']);`,
        `${imports} const run = promisify(execFile); const text = 'scripts/${gate}';`,
        `${imports} promisify(execFile)(process.execPath, ['scripts/other.mjs', 'scripts/${gate}']);`,
        `import {execFile} from 'unrelated'; import {promisify} from 'node:util'; ${call};`
    ]) assert.equal(executes(source, gate), false, source);
});
