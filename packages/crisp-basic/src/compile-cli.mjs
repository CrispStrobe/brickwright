import {readFile, writeFile, mkdir, rename, rm} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {basename, dirname, extname, resolve, join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {compileSource} from './compiler/index.mjs';
import {buildCompiledC, resolveCompilerTarget} from './compiler-targets.mjs';

const HELP = `Usage: crispbasic compile program.bas [options]

Compile BBC BASIC's supported structured subset to independent C99.
By default write program.c and build a native executable with GCC.

  --target NAME       native (default), pico, or arduino-uno
  -o, --output PATH    Executable/firmware path; with --emit-c, the C file path
  --emit-c            Write self-contained C99 without invoking a toolchain
  --numeric-profile NAME  native-bbcsdl (native default), binary64, or extended
  --cc PATH           Native GCC or avr-gcc executable (passed without a shell)
  --pico-sdk PATH     Pico SDK checkout; also accepts PICO_SDK_PATH
  --build-dir PATH    Board toolchain build directory
  --timeout MS        Toolchain time limit (default 120000)
  --json              Machine-readable result and source diagnostics
  --help              Show this help

EVAL, inline assembler, indirection, dynamic variables and OS calls are refused
at their source line. Generated code does not embed the BBCSDL interpreter.
Firmware results are build-only until an actual simulator or hardware run.
`;

async function atomicWrite(path, text) {
    await mkdir(dirname(path), {recursive: true});
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
        await writeFile(temporary, text, {flag: 'wx'});
        await rename(temporary, path);
    } finally {
        await rm(temporary, {force: true});
    }
}

export async function runCompileCli(
    args,
    {writeOut = (text) => process.stdout.write(text), writeError = (text) => process.stderr.write(text)} = {}
) {
    let json = args.includes('--json');
    try {
        const {values, positionals} = parseArgs({
            args,
            strict: true,
            allowPositionals: true,
            options: {
                target: {type: 'string'},
                output: {type: 'string', short: 'o'},
                'emit-c': {type: 'boolean'},
                cc: {type: 'string'},
                'numeric-profile': {type: 'string'},
                'pico-sdk': {type: 'string'},
                'build-dir': {type: 'string'},
                timeout: {type: 'string'},
                json: {type: 'boolean'},
                help: {type: 'boolean'}
            }
        });
        json = !!values.json;
        if (values.help) {
            writeOut(HELP);
            return;
        }
        if (positionals.length !== 1) throw new Error('Expected one .bas source file. Use compile --help.');
        const filename = resolve(positionals[0]);
        const targetRecord = resolveCompilerTarget(values.target || 'native');
        const target =
            typeof targetRecord === 'string'
                ? targetRecord
                : targetRecord.id || targetRecord.name || targetRecord.target;
        const timeoutMs = values.timeout === undefined ? 120000 : Number(values.timeout);
        if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 3600000) {
            throw new Error('--timeout must be an integer from 1 to 3600000');
        }
        const stem = join(dirname(filename), basename(filename, extname(filename)));
        const suffix = target === 'pico' ? '.uf2' : target === 'arduino-uno' ? '.hex' : '';
        const output = resolve(values.output || `${stem}${values['emit-c'] ? '.c' : suffix}`);
        const cPath = values['emit-c'] ? output : `${output.replace(/\.(?:hex|uf2)$/, '')}.c`;
        if (filename === output || filename === cPath)
            throw new Error('Output would overwrite the BASIC source file.');
        if (!values['emit-c'] && output === cPath)
            throw new Error('Executable and C output paths must differ; use --emit-c for a .c output.');
        const source = await readFile(filename, 'utf8');
        const compiled = compileSource(source, {
            filename,
            target,
            ...(values['numeric-profile'] ? {numericProfile: values['numeric-profile']} : {})
        });
        await atomicWrite(cPath, compiled.c);
        let result = {
            schemaVersion: 1,
            status: 'emitted',
            target,
            source: filename,
            c: cPath,
            metadata: compiled.metadata,
            validation: {status: 'not-run', simulator: 'not-run', hardware: 'not-run'}
        };
        if (!values['emit-c']) {
            const build = await buildCompiledC({
                sourcePath: cPath,
                target,
                output,
                cc: values.cc,
                picoSdkPath: values['pico-sdk'],
                buildDirectory: values['build-dir'],
                timeoutMs
            });
            result = {...result, ...build, status: 'built', c: cPath};
        }
        if (json) writeOut(`${JSON.stringify(result)}\n`);
        else {
            writeOut(`Wrote C99: ${cPath}\n`);
            if (result.status === 'built') writeOut(`Built ${target}: ${output}\n`);
        }
        return result;
    } catch (error) {
        process.exitCode = 1;
        if (json)
            writeOut(
                `${JSON.stringify({
                    schemaVersion: 1,
                    status: 'error',
                    error: {
                        message: error.message,
                        code: error.code || 'compile-error',
                        filename: error.filename,
                        line: error.line,
                        column: error.column,
                        basicLine: error.basicLine,
                        diagnostics: error.diagnostics
                    }
                })}\n`
            );
        else writeError(`CrispBASIC: ${error.message}\n`);
        return null;
    }
}
