#!/usr/bin/env node
// Native Cowgol artifacts use the same compiler client and image validation as
// the Code tab. Source conversion stays in bwlite convert/compile.
import {createRequire} from 'node:module';
import {readFile, writeFile, mkdtemp, rename, rm, realpath} from 'node:fs/promises';
import {basename, dirname, extname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {compileCowgol, COWGOL_COMPILE_ENDPOINT, COWGOL_COMPILE_TARGETS} from
    '../overlay/scratch-gui/src/lib/bw-lang/cowgol-compile.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const guiRequire = createRequire(join(root, 'packages/scratch-gui/package.json'));
const help = `Native Cowgol builds

  bwlite cowgol targets
  bwlite cowgol build PROGRAM.cow|.cowgol|.bw|.sb3 --target TARGET --out FILE
      [--endpoint URL] [--timeout-ms MILLISECONDS]

Full .cow/.cowgol source is compiled directly, including language features
outside the Blocks reader. .bw and .sb3 inputs use the checked native generator.
The cowgol-cgen target exports C and requires .cow/.cowgol input.

--endpoint overrides BWLITE_COWGOL_ENDPOINT, then the Code tab's hosted service.
Use a local companion service URL to build without sending source remotely.
--timeout-ms defaults to 120000 (1..300000). -o is an alias for --out.
An output path is required. Refused or invalid builds preserve an existing file.
This command builds an artifact; it does not flash a board or launch a machine.
`;

async function sourceForBuild (file, target) {
    const extension = extname(file).toLowerCase();
    const input = await readFile(file);
    if (['.cow', '.cowgol'].includes(extension)) return input.toString('utf8');
    if (!['.bw', '.sb3'].includes(extension)) {
        throw new Error('Cowgol build input must be .cow, .cowgol, .bw or .sb3');
    }
    if (target === 'cowgol-cgen') {
        throw new Error('C export requires .cow or .cowgol source; choose a native target for checked Blocks builds');
    }
    const {default: SB3Creator} = await import('../packages/scratch-gui/src/lib/sb3-creator.js');
    const creator = new SB3Creator();
    let project;
    if (extension === '.sb3') {
        const zip = await guiRequire('jszip').loadAsync(input);
        const entry = zip.file('project.json');
        if (!entry) throw new Error(`${file}: missing project.json`);
        // Feed the actual graph to the generator. A decompile/reparse pass could
        // discard an unsupported block before the native profile can refuse it.
        project = JSON.parse(await entry.async('string'));
    } else {
        creator.parse(input.toString('utf8'));
        if (creator.warnings.length) throw new Error(`Cowgol generation refused: ${creator.warnings.join('; ')}`);
        project = creator.project;
    }
    const generated = creator.generateCowgol(project, {target});
    if (!generated.ok) {
        throw new Error(`Cowgol generation refused: ${(generated.reasons || []).join('; ') || 'unsupported program'}`);
    }
    for (const warning of generated.warnings || []) console.error(`warning: ${warning}`);
    return generated.cowgol;
}

async function saveArtifact (destination, bytes) {
    // The temporary file shares the output filesystem: an atomic rename is the
    // only step that replaces a previous successful artifact.
    const work = await mkdtemp(join(dirname(destination), '.bwlite-cowgol-'));
    try {
        const staged = join(work, basename(destination));
        await writeFile(staged, bytes);
        await rename(staged, destination);
    } finally {
        await rm(work, {recursive: true, force: true});
    }
}

try {
    const {values, positionals} = parseArgs({allowPositionals: true, options: {
        target: {type: 'string'}, out: {type: 'string', short: 'o'},
        endpoint: {type: 'string'}, 'timeout-ms': {type: 'string'},
        help: {type: 'boolean', short: 'h'}
    }});
    const [command, file] = positionals;
    if (values.help || !command) {
        console.log(help);
    } else if (command === 'targets') {
        if (positionals.length !== 1 || Object.keys(values).length) throw new Error('Use bwlite cowgol targets without build options');
        for (const [target, spec] of Object.entries(COWGOL_COMPILE_TARGETS)) {
            console.log(`${target.padEnd(16)} ${spec.format.padEnd(4)} ${spec.filename}`);
        }
    } else if (command !== 'build' || positionals.length !== 2) {
        throw new Error('Use bwlite cowgol targets or bwlite cowgol build FILE --target TARGET --out FILE');
    } else {
        if (!values.target || !Object.hasOwn(COWGOL_COMPILE_TARGETS, values.target)) {
            throw new Error('Choose a supported --target; see bwlite cowgol targets');
        }
        if (!values.out) throw new Error('Cowgol build requires --out FILE');
        const input = resolve(file), destination = resolve(values.out);
        if (input === destination) throw new Error('The artifact output must differ from the input source');
        const physicalInput = await realpath(input);
        const physicalDestination = await realpath(destination).catch(async error => {
            if (error.code !== 'ENOENT') throw error;
            return join(await realpath(dirname(destination)), basename(destination));
        });
        if (physicalInput === physicalDestination) throw new Error('The artifact output must differ from the input source');
        const timeout = values['timeout-ms'] === undefined ? 120000 : Number(values['timeout-ms']);
        if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 300000) {
            throw new Error('--timeout-ms must be an integer from 1 to 300000');
        }
        const endpoint = new URL(values.endpoint ?? process.env.BWLITE_COWGOL_ENDPOINT ?? COWGOL_COMPILE_ENDPOINT);
        if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) {
            throw new Error('Cowgol endpoint must be an HTTP(S) URL without embedded credentials');
        }
        const code = await sourceForBuild(input, values.target);
        const artifact = await compileCowgol(code, values.target, {
            endpoint: endpoint.href, signal: AbortSignal.timeout(timeout),
            // Keep source at the selected service even if it returns a redirect.
            fetcher: (url, options) => fetch(url, {...options, redirect: 'error'})
        });
        await saveArtifact(destination, artifact.bytes);
        console.log(`Wrote ${values.out} (${artifact.bytes.length} bytes; ${artifact.toolchain})`);
    }
} catch (error) {
    console.error(`Cowgol build failed: ${error.message}`);
    if (error.log) console.error(error.log);
    process.exitCode = 2;
}
