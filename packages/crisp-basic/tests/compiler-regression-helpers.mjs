// SPDX-License-Identifier: BSD-3-Clause
import {execFile} from 'node:child_process';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {promisify} from 'node:util';
import {compileSource} from '../src/compiler/index.mjs';

const exec = promisify(execFile);
export async function workspace(t) {
    const directory = await mkdtemp(join(tmpdir(), 'crisp-compiler-regression-'));
    t.after(() => rm(directory, {recursive: true, force: true}));
    return directory;
}
export async function build(directory, source, extra = [], numericProfile) {
    const program = join(directory, 'program.c'),
        binary = join(directory, 'program');
    await writeFile(program, compileSource(source, {filename: 'regression.bas', numericProfile}).c);
    await exec(
        process.env.CRISP_BASIC_C99_CC || 'gcc',
        ['-std=c99', '-O2', program, ...extra, '-lm', '-o', binary],
        {timeout: 30000, maxBuffer: 8 << 20}
    );
    return binary;
}
export async function execute(binary) {
    try {
        return {
            status: 0,
            ...(await exec(binary, [], {encoding: 'buffer', timeout: 5000, maxBuffer: 1 << 20}))
        };
    } catch (error) {
        if (!Number.isInteger(error.code)) throw error;
        return {status: error.code, stdout: error.stdout, stderr: error.stderr};
    }
}

