import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve, join} from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const verifiers = [
    {
        script: 'scripts/verify-cowgol-cpm-system.mjs', input: '--com', program: 'program.com',
        title: 'Verify native Cowgol under real CP/M 2.2 and its TMS9918 display.',
        boundary: 'compiler targets execute on the pinned Z80 machine; neither claims an 8080 CPU.'
    },
    {
        script: 'scripts/verify-cowgol-dos.mjs', input: '--exe', program: 'program.exe',
        title: 'Verify native Cowgol DOS on 8086, 80186, and real-mode 80286/80386 machines.',
        boundary: 'No BIOS, DOS disk, protected-mode program or DOS extender execution is claimed.'
    },
    {
        script: 'scripts/verify-cowgol-dos-disk.mjs', input: '--exe', program: 'program.exe',
        title: 'Verify a compiled Cowgol DOS program under booted MS-DOS 2.0.',
        boundary: 'shipped 360 KiB FAT12 disk on both console and Controller display surfaces.'
    }
];

// These CLI checks complement the complete native witnesses in cowgol.yml.
// An absent board and executable make premature machine or artifact loading
// fail differently from the argument diagnostic that each case requires.
test('Cowgol verifier CLIs handle help and reject invalid input before machine loading', async t => {
    const dir = mkdtempSync(join(tmpdir(), 'bw-cowgol-verifier-cli-'));
    t.after(() => rmSync(dir, {recursive: true, force: true}));
    const board = join(dir, 'absent-board');
    let casesRun = 0;
    const run = (script, args) => {
        const options = {
            cwd: dir, encoding: 'utf8', timeout: 10_000,
            env: {...process.env, COWGOL_BW_BOARD: board}
        };
        // Keep the real Node entry points explicit for the bounded gate census.
        let result;
        switch (script) {
        case 'scripts/verify-cowgol-cpm-system.mjs':
            result = spawnSync(process.execPath, [resolve(ROOT, 'scripts/verify-cowgol-cpm-system.mjs'), '--board', board, ...args], options);
            break;
        case 'scripts/verify-cowgol-dos.mjs':
            result = spawnSync(process.execPath, [resolve(ROOT, 'scripts/verify-cowgol-dos.mjs'), '--board', board, ...args], options);
            break;
        case 'scripts/verify-cowgol-dos-disk.mjs':
            result = spawnSync(process.execPath, [resolve(ROOT, 'scripts/verify-cowgol-dos-disk.mjs'), '--board', board, ...args], options);
            break;
        default:
            assert.fail('Unregistered Cowgol verifier: ' + script);
        }
        assert.equal(result.error, undefined, script + ': subprocess must complete');
        assert.equal(result.signal, null, script + ': subprocess must not be killed');
        casesRun++;
        return result;
    };
    const refuse = (script, args, diagnostic) => {
        const result = run(script, args);
        assert.equal(result.status, 1, result.stderr || script);
        assert.equal(result.stdout, '', 'invalid input must not emit a witness report');
        assert.ok(result.stderr.split(/\r?\n/).includes(diagnostic),
            'Expected exact CLI diagnostic: ' + diagnostic + '\n' + result.stderr);
    };

    for (const {script, input, program, title, boundary} of verifiers) {
        await t.test(script + ': help needs no machine or compiler output', () => {
            const result = run(script, ['--help']);
            assert.equal(result.status, 0, result.stderr);
            const lines = result.stdout.split(/\r?\n/);
            assert.equal(lines[0], title);
            assert.ok(lines.includes('  node ' + script + ' ' + input + ' ' + program + ' --expect "42"'));
            assert.ok(lines.includes(boundary), 'help must state the verifier scope');
        });
        const missing = join(dir, program);
        const diagnostic = 'AssertionError [ERR_ASSERTION]: ' + input +
            ' FILE and at least one nonempty --expect TEXT are required';
        const invalid = [
            ['missing all required arguments', []],
            ['missing program', ['--expect', '42']],
            ['missing expected output', [input, missing]],
            ['blank expected output', [input, missing, '--expect', ' \t ']],
            ['blank repeated expectation', [input, missing, '--expect', '42', '--expect', '']]
        ];
        for (const [name, args] of invalid) {
            await t.test(script + ': ' + name, () => refuse(script, args, diagnostic));
        }
        await t.test(script + ': unknown option is rejected', () => {
            refuse(script, ['--not-a-verifier-option'],
                "TypeError [ERR_PARSE_ARGS_UNKNOWN_OPTION]: Unknown option '--not-a-verifier-option'");
        });
    }
    await t.test('CP/M refuses an unsupported target before consulting the board', () => {
        refuse('scripts/verify-cowgol-cpm-system.mjs',
            ['--com', join(dir, 'program.com'), '--expect', '42', '--target', 'dos'],
            'AssertionError [ERR_ASSERTION]: target must be z80-cpm or i8080-cpm');
    });
    assert.equal(casesRun, 22, 'all three verifier CLIs must execute every boundary case');
});
