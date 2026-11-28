#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {createNativeSession, SourceError, VERSION} from '../index.mjs';

let activeSession;
let outputFailure;
const closedStreams = new Set();
for (const stream of [process.stdout, process.stderr]) {
    stream.on('error', error => {
        closedStreams.add(stream);
        outputFailure ||= error;
        // A detached interpreter must not outlive a CLI whose output pipe has
        // closed. Keep these handlers installed until Node has flushed output.
        activeSession?.cancel();
        process.exitCode = outputFailure.code === 'EPIPE' ? 141 : 1;
    });
}
const writeOut = bytes => { if (!closedStreams.has(process.stdout)) process.stdout.write(bytes); };
const writeError = text => { if (!closedStreams.has(process.stderr)) process.stderr.write(text); };

const HELP = `CrispBASIC ${VERSION} — native BBC BASIC-compatible runtime

Usage: crispbasic [options] program.bas

  --input FILE        Supply runtime input bytes from a file (otherwise stdin)
  --timeout MS        Wall-clock limit, including input waits (default: 5000)
  --max-output BYTES  Raw output limit (default: 1048576)
  --json              Print one result object, including outputBase64
  --version           Print the CrispBASIC version
  --help              Show this help

Build the native core first: npm run build:native
Source files are UTF-8 text restricted to Latin-1 characters for this backend.
Output is the raw VDU byte stream; --json includes a Latin-1 text view.
This native developer backend executes trusted local programs with host access.
`;

function numberOption(value, name) {
    if (value === undefined) return undefined;
    if (!/^[0-9]+$/.test(value) || !Number.isSafeInteger(Number(value)) ||
        Number(value) < 1 || Number(value) > 0x7fffffff) {
        throw new Error(`${name} must be an integer from 1 to 2147483647`);
    }
    return Number(value);
}

const EXIT = {completed: 0, error: 1, 'host-error': 1, timeout: 124, 'output-limit': 125, cancelled: 130};

async function main() {
    const {values, positionals} = parseArgs({
        options: {
            input: {type: 'string'}, timeout: {type: 'string'},
            'max-output': {type: 'string'}, json: {type: 'boolean'},
            version: {type: 'boolean'}, help: {type: 'boolean'}
        },
        allowPositionals: true,
        strict: true
    });
    if (values.help) { writeOut(HELP); return; }
    if (values.version) { writeOut(`CrispBASIC ${VERSION}\n`); return; }
    if (positionals.length !== 1) throw new Error('Expected one .bas source file. Use --help for usage.');
    const timeoutMs = numberOption(values.timeout, '--timeout');
    const maxOutputBytes = numberOption(values['max-output'], '--max-output');
    const filename = positionals[0];
    const source = await readFile(filename, 'utf8');
    const input = values.input === undefined ? '' : await readFile(values.input);
    const session = createNativeSession({
        ...(timeoutMs === undefined ? {} : {timeoutMs}),
        ...(maxOutputBytes === undefined ? {} : {maxOutputBytes}),
        onEvent(event) {
            if (event.type === 'output' && !values.json) writeOut(Buffer.from(event.bytes));
        }
    });
    activeSession = session;
    const interrupt = () => session.cancel();
    const sendInput = bytes => {
        try { session.writeInput(bytes); } catch (error) {
            writeError(`CrispBASIC: ${error.message}\n`);
            session.cancel();
        }
    };
    const endInput = () => session.endInput();
    const inputError = error => {
        writeError(`CrispBASIC input: ${error.message}\n`);
        session.cancel();
    };
    process.on('SIGINT', interrupt);
    process.on('SIGTERM', interrupt);
    try {
        const pending = session.run(source, {filename, input, interactive: values.input === undefined});
        if (values.input === undefined) {
            process.stdin.on('data', sendInput);
            process.stdin.once('end', endInput);
            process.stdin.once('error', inputError);
            if (process.stdin.readableEnded) endInput();
        }
        const result = await pending;
        if (outputFailure) {
            process.exitCode = outputFailure.code === 'EPIPE' ? 141 : 1;
            return;
        } else if (values.json) {
            const {output, ...rest} = result;
            writeOut(`${JSON.stringify({...rest, outputBase64: Buffer.from(output).toString('base64')})}\n`);
        } else if (result.status !== 'completed') {
            const where = result.error?.filename ?
                `${result.error.filename}${result.error.line ? `:${result.error.line}` : ''}: ` : '';
            writeError(`CrispBASIC: ${where}${result.error?.message || result.status}\n`);
            if (result.diagnostics) writeError(result.diagnostics);
        }
        process.exitCode = result.status === 'completed' ? result.exitCode : (EXIT[result.status] ?? 1);
    } catch (error) {
        if (values.json && error instanceof SourceError) {
            writeOut(`${JSON.stringify({status: 'source-error', error: {
                kind: 'source', code: error.code, message: error.message,
                filename: error.filename, line: error.line, column: error.column
            }})}\n`);
            process.exitCode = 1;
        } else throw error;
    } finally {
        process.removeListener('SIGINT', interrupt);
        process.removeListener('SIGTERM', interrupt);
        process.stdin.removeListener('data', sendInput);
        process.stdin.removeListener('end', endInput);
        process.stdin.removeListener('error', inputError);
        process.stdin.pause();
        await session.dispose();
        activeSession = null;
    }
}

main().catch(error => {
    writeError(`CrispBASIC: ${error.message || error}\n`);
    process.exitCode = outputFailure?.code === 'EPIPE' ? 141 : 1;
});
