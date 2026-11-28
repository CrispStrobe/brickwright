import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {promisify} from 'node:util';
import test from 'node:test';
import {compileSource} from '../src/compiler/index.mjs';
import {compilerCorpus} from './compiler-corpus.mjs';

const exec = promisify(execFile);
export function registerCompilerParity({name, createSession, numericProfile, fixtures = compilerCorpus}) {
    for (const fixture of fixtures) {
        test(`independent C99 / BBCSDL ${name}: ${fixture.name}`, async (t) => {
            const dir = await mkdtemp(join(tmpdir(), 'crisp-compiler-parity-'));
            t.after(() => rm(dir, {recursive: true, force: true}));
            const session = createSession();
            t.after(() => session.dispose());
            const sourcePath = join(dir, 'program.c');
            const binary = join(dir, 'program');
            const {c} = compileSource(fixture.source, {
                filename: `${fixture.name}.bas`,
                ...(numericProfile ? {numericProfile} : {})
            });
            await writeFile(sourcePath, c);
            await exec(
                process.env.CRISP_BASIC_C99_CC || 'gcc',
                ['-std=c99', '-O2', '-Wall', '-Wextra', sourcePath, '-lm', '-o', binary],
                {timeout: 30000, maxBuffer: 8 << 20}
            );
            const reference = await session.run(fixture.source, {
                filename: `${fixture.name}.bas`,
                input: fixture.input ?? ''
            });
            assert.equal(reference.status, 'completed', JSON.stringify(reference));
            const compiled = await new Promise((resolve, reject) => {
                const child = execFile(
                    binary,
                    [],
                    {encoding: 'buffer', timeout: 5000, maxBuffer: 1 << 20},
                    (error, stdout, stderr) => {
                        if (error) reject(Object.assign(error, {stdout, stderr}));
                        else resolve({stdout, stderr});
                    }
                );
                child.stdin.on('error', (error) => {
                    if (error.code !== 'EPIPE') reject(error);
                });
                child.stdin.end(Buffer.from(fixture.input ?? '', 'latin1'));
            });
            assert.deepEqual(
                compiled.stdout,
                Buffer.from(reference.output),
                `compiled=${JSON.stringify(compiled.stdout.toString('latin1'))}\nBBCSDL=${JSON.stringify(Buffer.from(reference.output).toString('latin1'))}`
            );
            assert.equal(compiled.stderr.length, 0);
        });
    }
}
