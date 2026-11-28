#!/usr/bin/env node
// Brickwright terminal entry point. The SPIKE commands use the same USB runner
// as the Code tab's Mac bridge; compile uses the app's SB3Creator engine.
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {copyFile, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {homedir, tmpdir} from 'node:os';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {validateCrispBasicPseudocode, crispBasicModeError}
    from '../packages/scratch-gui/src/lib/sb3-creator-crispbasic-mode.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const guiRequire = createRequire(resolve(root, 'packages/scratch-gui/package.json'));
const args = process.argv.slice(2);
const help = `Brickwright Lite CLI

  bwlite check PROGRAM.bw
  bwlite devices [PROGRAM.bw]
  bwlite retarget PROGRAM.bw DEVICE [--out FILE]
  bwlite read FILE.bw|.c|.py|.js|.bas|.cow|.cowgol|.sb3 [--device DEVICE] [--out FILE]
  bwlite read PROGRAM.bas --crispbasic [--out PORTABLE.bw]
  bwlite convert FILE.bw|.c|.py|.js|.bas|.cow|.cowgol|.sb3 --to pseudocode|sb3|c|host-c|python|javascript|micropython|basic|crispbasic|cowgol [--crispbasic] [--numbered] [--device DEVICE] [--out FILE]
  bwlite transpile PROGRAM.bw --to c|micropython|python|sb3|crispbasic|cowgol [--device DEVICE] [--out FILE]
  bwlite convert PROGRAM.bw|.sb3 --to cowgol --target TARGET [--out FILE]
  bwlite cowgol targets
  bwlite cowgol build PROGRAM.cow|.cowgol|.bw|.sb3 --target TARGET --out FILE [--endpoint URL]
  bwlite spike probe [--port USB_DEVICE]
  bwlite spike run PROGRAM.bw [--port USB_DEVICE]
  bwlite spike bridge --port USB_DEVICE [--listen IP] [--tcp-port N]
  bwlite toolchain status|install|remove|compile ...
  bwlite 8051 build PROGRAM.bw|PROGRAM.c --out FIRMWARE.ihx
  bwlite 8051 flash FIRMWARE.ihx --port SERIAL_DEVICE
  bwlite circuit test [EXAMPLE_ID] [--device DEVICE] [--smoke-only] [--jobs N] [--timeout-ms MS] [--json]
  bwlite machine validate|normalize|import-dosbox|import-manifest|import-repo|activate ...
  bwlite fpga ...
  bwlite makecode ...
  bwlite mindstorms import PROJECT.lms --out PROJECT.sb3
  bwlite mindstorms export PROJECT.sb3 --template ORIGINAL.lms --out NEW.lms

  npm run cli -- spike probe
  npm run cli -- spike run scripts/spike/example-usb-stream.bw

CrispBASIC conversion is explicit: --to crispbasic generates portable BBC source;
--crispbasic reads its qualified pin/time/canvas subset back into marked pseudocode.
Marked source requires the CrispBASIC runtime; generic Blocks/native exports refuse.

The SPIKE USB commands require LEGO MINDSTORMS MicroPython firmware and
Python with pyserial (pip install pyserial). Set BWLITE_PYTHON to select a venv.
`;

const die = message => { console.error(message); process.exitCode = 2; };
const hasOption = name => args.some(arg => arg === name || arg.startsWith(`${name}=`));
const value = name => {
    const index = args.findIndex(arg => arg === name || arg.startsWith(`${name}=`));
    if (index < 0) return undefined;
    return args[index] === name ? args[index + 1] : args[index].slice(name.length + 1);
};
const output = async (data, destination) => {
    if (destination) await writeFile(destination, data);
    else if (Buffer.isBuffer(data)) throw new Error('Binary output needs --out FILE');
    else process.stdout.write(data);
};
const creatorClass = async () => (await import('../packages/scratch-gui/src/lib/sb3-creator.js')).default;
const requireSourceTarget = (source, target, portable = false) => {
    const marked = validateCrispBasicPseudocode(source);
    if (marked && !portable) throw crispBasicModeError(target);
    return marked;
};
const retarget = (source, device, SB3Creator) => {
    if (!device) return source;
    requireSourceTarget(source, 'retargeting');
    if (/^spike(?:prime)?$/i.test(device)) {
        const declared = source.match(/^DEVICE\s+(\S+)/im);
        if (!declared) return `DEVICE SPIKE\n\n${source}`;
        if (/^spike$/i.test(declared[1])) return source;
    }
    const result = SB3Creator.retargetPseudocode(source, device);
    if (!result.ok) throw new Error(`Retarget to ${device} refused: ${result.reasons.join('; ')}`);
    for (const warning of result.warnings || []) console.error(`warning: ${warning}`);
    return result.pseudocode;
};
const loadProject = async file => {
    const zip = await guiRequire('jszip').loadAsync(await readFile(file));
    const entry = zip.file('project.json');
    if (!entry) throw new Error(`${file}: missing project.json`);
    return JSON.parse(await entry.async('string'));
};
const loadPseudocode = async (file, {portable = false} = {}) => {
    if (/\.sb3$/i.test(file)) {
        const SB3Creator = await creatorClass();
        return new SB3Creator().decompile(await loadProject(file));
    }
    const input = await readFile(file);
    const source = input.toString('utf8');
    const lib = '../packages/scratch-gui/src/lib/';
    let reader;
    if (/\.c$/i.test(file)) reader = (await import(`${lib}${/@bw-program/.test(source) ? 'sb3-creator-chost' : 'sb3-creator-c'}.js`)).default;
    else if (/\.py$/i.test(file)) reader = (await import(`${lib}${/^\s*from\s+(machine|microbit)\s+import/m.test(source) ? 'sb3-creator-micropython' : 'sb3-creator-python'}.js`)).default;
    else if (/\.js$/i.test(file)) reader = (await import(`${lib}sb3-creator-javascript.js`)).default;
    else if (/\.(bas|basic)$/i.test(file)) {
        if (/^[ \t]*(?:\d+[ \t]*)?REM[ \t]*===[ \t]*Cannot[ \t]*show[ \t]*as[ \t]*BASIC[ \t]*===/mi.test(source)) {
            throw new Error('BASIC generation was refused. Remove or replace the generation-error banner.');
        }
        reader = (await import(`${lib}sb3-creator-basic.js`)).default;
    }
    else if (/\.(cow|cowgol)$/i.test(file)) reader = (await import(`${lib}sb3-creator-cowgol-reader.js`)).default;
    else if (/\.bw$/i.test(file)) { validateCrispBasicPseudocode(source); return source; }
    else throw new Error('Input must be .bw, .c, .py, .js, .bas, .cow, .cowgol, or .sb3');
    const result = reader(source, portable && /\.(bas|basic)$/i.test(file) ? {mode: 'crispbasic'} : {});
    if (result?.ok === false) {
        if (/\.(cow|cowgol)$/i.test(file)) throw new Error(`Cowgol import refused: ${(result.reasons || []).join('; ') || 'unsupported source'}`);
        throw new Error((result.reasons || []).join('\n') || `${file}: conversion refused`);
    }
    for (const warning of result.warnings || []) console.error(`warning: ${warning}`);
    return result.pseudocode ?? result;
};
const rejectPortableInputFiles = async (rest, target) => {
    // Delegated hardware tools must not become an escape around the source
    // requirement. Output paths are destinations, not source files to inspect.
    for (let index = 0; index < rest.length; index++) {
        if (['--out', '-o', '--output', '--bw'].includes(rest[index])) { index++; continue; }
        const candidate = rest[index];
        if (!candidate.startsWith('-') && /\.(bw|txt)$/i.test(candidate) && existsSync(candidate)) {
            requireSourceTarget(await readFile(candidate, 'utf8'), target);
        }
    }
};
const runScript = (script, rest) => {
    const result = spawnSync(process.execPath, [resolve(root, script), ...rest], {stdio: 'inherit'});
    if (result.error) die(result.error.message);
    else process.exitCode = result.status ?? 1;
};

if (!args.length || (args.includes('--help') && !['circuit', 'cowgol'].includes(args[0])) || args[0] === 'help') {
    console.log(help);
} else if (['toolchain', 'machine', 'fpga', 'makecode', 'circuit', 'cowgol'].includes(args[0])) {
    const scripts = {toolchain: 'scripts/bw-toolchain.mjs', machine: 'scripts/machine-manager.mjs',
        fpga: 'scripts/bw-fpga.mjs', makecode: 'scripts/makecode.mjs', circuit: 'scripts/circuit-examples.mjs',
        cowgol: 'scripts/bw-cowgol.mjs'};
    try {
        await rejectPortableInputFiles(args.slice(1), `${args[0]} tool execution`);
        runScript(scripts[args[0]], args.slice(1));
    } catch (error) { die(error.message); }
} else if (args[0] === '8051' && ['build', 'flash'].includes(args[1])) {
    const mode = args[1];
    const file = args[2];
    if (!file || file.startsWith('--')) die(`8051 ${mode} needs a file`);
    else if (mode === 'flash') {
        if (!/\.(ihx|hex)$/i.test(file) || !value('--port')) die('8051 flash needs FIRMWARE.ihx --port SERIAL_DEVICE');
        else {
            const result = spawnSync('stcgal', ['--port', value('--port'), file], {stdio: 'inherit'});
            if (result.error) die(`stcgal is required for flashing: ${result.error.message}`);
            else process.exitCode = result.status ?? 1;
        }
    } else {
        const target = value('--out');
        if (!target || !/\.ihx$/i.test(target)) die('8051 build needs --out FIRMWARE.ihx');
        else {
            let work;
            try {
                const SB3Creator = await creatorClass();
                let source;
                let device = '';
                if (/\.bw$/i.test(file)) {
                    const pseudo = await loadPseudocode(file);
                    requireSourceTarget(pseudo, '8051 native build');
                    device = ((pseudo.match(/^DEVICE\s+([\w-]+)/im) || [])[1] || '').toLowerCase();
                    if (!/^stc(?:12|15|89)/.test(device)) throw new Error('8051 build needs an STC12, STC15, or STC89 DEVICE');
                    const creator = new SB3Creator();
                    creator.parse(pseudo);
                    source = creator.generateC(undefined, {debug: true, target: 'device'});
                } else if (/\.c$/i.test(file)) {
                    source = await readFile(file, 'utf8');
                    device = (value('--device') || 'stc12c5a60s2').toLowerCase();
                    if (!/^stc(?:12|15|89)/.test(device)) throw new Error('Unsupported 8051 device');
                } else throw new Error('8051 build needs a .bw or .c input');
                work = await mkdtemp(join(tmpdir(), 'bwlite-8051-'));
                const cFile = join(work, 'main.c');
                const hexFile = join(work, 'main.ihx');
                await writeFile(cFile, source);
                const xram = device.startsWith('stc15') ? '1792' : device.startsWith('stc89') ? '256' : '1024';
                const codeSize = device.startsWith('stc89') ? '8192' : '61440';
                const result = spawnSync('sdcc', ['-mmcs51', '--iram-size', '256', '--xram-size', xram,
                    '--code-size', codeSize, '-o', hexFile, cFile], {stdio: 'inherit'});
                if (result.error) throw new Error(`SDCC is required for 8051 build: ${result.error.message}`);
                if (result.status !== 0) process.exitCode = result.status ?? 1;
                else {
                    await copyFile(hexFile, target);
                    console.log(`Wrote ${target}`);
                }
            } catch (error) {
                die(error.message);
            } finally {
                if (work) await rm(work, {recursive: true, force: true});
            }
        }
    }
} else if (['check', 'devices', 'retarget', 'read', 'convert', 'transpile', 'compile'].includes(args[0])) {
    try {
        const command = args[0];
        const file = args[1];
        const SB3Creator = await creatorClass();
        if (command === 'devices') {
            const all = Object.keys(SB3Creator.RETARGET_POOLS);
            if (!file) console.log(all.join('\n'));
            else {
                const source = await loadPseudocode(file);
                requireSourceTarget(source, 'device retargeting');
                const authored = ((source.match(/^DEVICE\s+([\w-]+)/im) || [])[1] || '').toLowerCase();
                for (const device of all) {
                    const result = SB3Creator.retargetPseudocode(source, device);
                    console.log(`${device.padEnd(14)} ${device === authored ? 'authored' : result.ok ? 'ok' : `refused: ${result.reasons[0]}`}`);
                }
            }
        } else if (!file || file.startsWith('--')) {
            die(`${command} needs an input file`);
        } else if (command === 'retarget') {
            if (!args[2] || args[2].startsWith('--')) die('retarget needs PROGRAM.bw DEVICE');
            else await output(retarget(await loadPseudocode(file), args[2], SB3Creator), value('--out'));
        } else {
            const creator = new SB3Creator();
            const to = command === 'read' ? 'pseudocode' : command === 'check' ? null : value('--to');
            let source, originalProject;
            if (to === 'cowgol' && /\.sb3$/i.test(file)) {
                originalProject = await loadProject(file);
                if (value('--device')) {
                    // Check the original graph before an explicit retargeting
                    // decompile can turn an unsupported opcode into a comment.
                    const original = creator.generateCowgol(originalProject);
                    if (!original.ok) throw new Error(`Cowgol generation refused: ${(original.reasons || []).join('; ')}`);
                }
            }
            if (!originalProject || value('--device')) {
                source = await loadPseudocode(file, {portable: args.includes('--crispbasic')});
                requireSourceTarget(source, command === 'check' ? 'source checking' : `${to || command} conversion`,
                    command === 'check' || to === 'pseudocode' || to === 'crispbasic');
                if (to === 'cowgol' && value('--device')) {
                    // Retargeting reparses the source and can normalize away a
                    // warning. Refuse the original partial parse first.
                    creator.parse(source);
                    if (creator.warnings.length) throw new Error(`Cowgol generation refused: ${creator.warnings.join('; ')}`);
                }
                source = retarget(source, value('--device'), SB3Creator);
                creator.parse(source);
            }
            for (const warning of creator.warnings || []) console.error(`warning: ${warning}`);
            if (command === 'check') {
                const verdict = creator.validate();
                for (const error of verdict.errors) console.error(`error: ${error}`);
                console.log(verdict.isValid ? 'ok' : 'INVALID');
                if (!verdict.isValid) process.exitCode = 1;
            } else {
                if (!['pseudocode', 'sb3', 'c', 'host-c', 'python', 'javascript', 'micropython', 'basic', 'crispbasic', 'cowgol'].includes(to)) {
                    throw new Error('Use --to pseudocode|sb3|c|host-c|python|javascript|micropython|basic|crispbasic|cowgol');
                }
                if (hasOption('--target') && (to !== 'cowgol' || !value('--target') || value('--target').startsWith('-'))) {
                    throw new Error('--target requires a native Cowgol target with --to cowgol');
                }
                let result;
                if (to === 'pseudocode') result = source;
                else if (to === 'sb3') result = Buffer.from(await (await creator.generateSB3()).arrayBuffer());
                else if (to === 'c') result = creator.generateC(undefined, {debug: true});
                else if (to === 'host-c') result = creator.generateHostC();
                else if (to === 'python') result = creator.generatePython();
                else if (to === 'javascript') result = creator.generateJavaScript();
                else if (to === 'cowgol') {
                    // A partially parsed pseudocode program must not become a
                    // successful Cowgol artifact with the missing statements gone.
                    if (creator.warnings.length) throw new Error(`Cowgol generation refused: ${creator.warnings.join('; ')}`);
                    const generated = creator.generateCowgol(value('--device') ? undefined : originalProject,
                        hasOption('--target') ? {target: value('--target')} : {});
                    if (!generated.ok) throw new Error(`Cowgol generation refused: ${(generated.reasons || []).join('; ') || 'unsupported program'}`);
                    for (const warning of generated.warnings || []) console.error(`warning: ${warning}`);
                    result = generated.cowgol;
                }
                else if (to === 'micropython') {
                    const generated = creator.generateMicroPython();
                    if (!generated.ok) throw new Error(`MicroPython refused: ${generated.reasons.join('; ')}`);
                    result = generated.py;
                } else {
                    const generated = creator.generateBASIC(undefined, to === 'crispbasic' ?
                        {profile: 'bbc', mode: 'crispbasic', lineNumbers: args.includes('--numbered')} : {});
                    if (!generated.ok) throw new Error(`BASIC refused: ${generated.reasons.join('; ')}`);
                    result = generated.basic;
                }
                await output(result, value('--out') || value('-o'));
            }
        }
    } catch (error) {
        die(error.message);
    }
} else if (args[0] === 'spike' && ['probe', 'run', 'bridge'].includes(args[1])) {
    const mode = args[1];
    const script = resolve(root, 'scripts/spike', mode === 'bridge' ? 'usb_bridge.py' : 'usb-stream.py');
    const venvPython = join(homedir(), '.brickwright', 'venv',
        process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
    const python = process.env.BWLITE_PYTHON || (existsSync(venvPython) ? venvPython : 'python3');
    const pass = args.slice(2);
    if (mode === 'run' && (!pass[0] || pass[0].startsWith('--'))) {
        die('spike run needs a .bw program file');
    } else if (mode === 'bridge' && !value('--port')) {
        die('spike bridge needs --port USB_DEVICE');
    } else {
        try {
            if (mode === 'run') requireSourceTarget(await readFile(pass[0], 'utf8'), 'SPIKE hardware execution');
            const command = mode === 'probe' ? ['--probe', ...pass] : pass;
            const result = spawnSync(python, [script, ...command], {stdio: 'inherit'});
            if (result.error) die(`${python}: ${result.error.message}`);
            else process.exitCode = result.status ?? 1;
        } catch (error) { die(error.message); }
    }
} else if (args[0] === 'mindstorms' && ['import', 'export'].includes(args[1])) {
    const command = args[1];
    const input = args[2];
    const output = value('--out');
    if (!input || input.startsWith('--') || !output || (command === 'export' && !value('--template'))) {
        die('mindstorms import needs PROJECT.lms --out PROJECT.sb3; export needs PROJECT.sb3 --template ORIGINAL.lms --out NEW.lms');
    } else {
        try {
            const lms = await import('../packages/scratch-gui/src/lib/mindstorms-lms.js');
            if (command === 'import') {
                const project = await lms.unpackLms(await readFile(input));
                await writeFile(output, project.scratch);
                console.log(`Extracted ${output}; keep ${input} as the export template for manifest and icon.`);
            } else {
                lms.setActiveLms(await lms.unpackLms(await readFile(value('--template'))));
                const name = output.replace(/^.*[/\\]/, '').replace(/\.lms$/i, '');
                const blob = await lms.packActiveLms(await readFile(input), name);
                await writeFile(output, Buffer.from(await blob.arrayBuffer()));
                console.log(`Wrote ${output}`);
            }
        } catch (error) {
            die(error.message);
        }
    }
} else {
    die(`Unknown command. Run bwlite --help.\n${help}`);
}
