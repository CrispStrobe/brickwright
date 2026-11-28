import {runDosProgram} from './dos-compile.js';

export async function buildSmallC(compiler, support, source, signal) {
    signal?.throwIfAborted();
    if (typeof source !== 'string' || !source.trim()) throw new Error('Enter Small-C source first.');
    const files = new Map(support);
    for (const name of ['ASM.EXE', 'YLINK.EXE', 'STDIO.H', 'CLIB.LIB']) {
        if (!files.get(name)?.length) throw new Error(`Small-C is missing ${name}.`);
    }
    const dosSource = source.replace(/\r\n?/g, '\n').replace(/\n/g, '\r\n');
    files.set('PROG.C', new TextEncoder().encode(dosSource.endsWith('\r\n') ? dosSource : dosSource + '\r\n'));
    const steps = [
        ['Compiler', compiler, 'PROG -w', 'PROG.ASM', 20_000_000],
        ['Assembler', files.get('ASM.EXE'), 'PROG', 'PROG.OBJ', 20_000_000],
        ['Linker', files.get('YLINK.EXE'), 'PROG.OBJ CLIB.LIB -e=PROG.EXE', 'PROG.EXE', 60_000_000]
    ];
    for (const [stage, bytes, args, output, maxSteps] of steps) {
        files.delete(output);
        const result = await runDosProgram({
            bytes, args, files, maxSteps, yieldEvery: 100_000, signal, variant: '8086', format: 'exe'
        });
        const diagnostics = result.screen.split(/[\r\n]+/).filter(line => /\berror:/i.test(line));
        if (diagnostics.length || !result.terminated || result.exitCode !== 0 || !files.get(output)?.length) {
            const reason = diagnostics.join(' ').trim() || (result.exhausted ? 'instruction limit reached'
                : result.exitCode ? `DOS exit code ${result.exitCode}` : `${output} was not written`);
            throw new Error(`Small-C ${stage.toLowerCase()} failed. ${reason}`);
        }
    }
    const bytes = files.get('PROG.EXE');
    if (bytes[0] !== 0x4d || bytes[1] !== 0x5a) throw new Error('Small-C did not produce a DOS executable.');
    return bytes;
}
