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

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const guiRequire = createRequire(resolve(root, 'packages/scratch-gui/package.json'));
const args = process.argv.slice(2);
const help = `Brickwright Lite CLI

  bwlite check PROGRAM.bw
  bwlite devices [PROGRAM.bw]
  bwlite retarget PROGRAM.bw DEVICE [--out FILE]
  bwlite convert FILE.bw|.c|.py|.js|.bas|.sb3 --to pseudocode|sb3|c|host-c|python|javascript|micropython|basic [--device DEVICE] [--out FILE]
  bwlite transpile PROGRAM.bw --to c|micropython|python|sb3 [--device DEVICE] [--out FILE]
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

The SPIKE USB commands require LEGO MINDSTORMS MicroPython firmware and
Python with pyserial (pip install pyserial). Set BWLITE_PYTHON to select a venv.
`;

const die = message => { console.error(message); process.exitCode = 2; };
const value = name => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
};
const output = async (data, destination) => {
    if (destination) await writeFile(destination, data);
    else if (Buffer.isBuffer(data)) throw new Error('Binary output needs --out FILE');
    else process.stdout.write(data);
};
const creatorClass = async () => (await import('../packages/scratch-gui/src/lib/sb3-creator.js')).default;
const retarget = (source, device, SB3Creator) => {
    if (!device) return source;
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
const loadPseudocode = async file => {
    const input = await readFile(file);
    if (/\.sb3$/i.test(file)) {
        const zip = await guiRequire('jszip').loadAsync(input);
        const entry = zip.file('project.json');
        if (!entry) throw new Error(`${file}: missing project.json`);
        const SB3Creator = await creatorClass();
        return new SB3Creator().decompile(JSON.parse(await entry.async('string')));
    }
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
    else if (/\.bw$/i.test(file)) return source;
    else throw new Error('Input must be .bw, .c, .py, .js, .bas, or .sb3');
    const result = reader(source);
    if (result.ok === false) throw new Error((result.reasons || []).join('\n') || `${file}: conversion refused`);
    for (const warning of result.warnings || []) console.error(`warning: ${warning}`);
    return result.pseudocode ?? result;
};
const runScript = (script, rest) => {
    const result = spawnSync(process.execPath, [resolve(root, script), ...rest], {stdio: 'inherit'});
    if (result.error) die(result.error.message);
    else process.exitCode = result.status ?? 1;
};

if (!args.length || (args.includes('--help') && args[0] !== 'circuit') || args[0] === 'help') {
    console.log(help);
} else if (['toolchain', 'machine', 'fpga', 'makecode', 'circuit'].includes(args[0])) {
    const scripts = {toolchain: 'scripts/bw-toolchain.mjs', machine: 'scripts/machine-manager.mjs',
        fpga: 'scripts/bw-fpga.mjs', makecode: 'scripts/makecode.mjs', circuit: 'scripts/circuit-examples.mjs'};
    runScript(scripts[args[0]], args.slice(1));
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
            let source = await loadPseudocode(file);
            source = retarget(source, value('--device'), SB3Creator);
            const creator = new SB3Creator();
            creator.parse(source);
            for (const warning of creator.warnings || []) console.error(`warning: ${warning}`);
            if (command === 'check') {
                const verdict = creator.validate();
                for (const error of verdict.errors) console.error(`error: ${error}`);
                console.log(verdict.isValid ? 'ok' : 'INVALID');
                if (!verdict.isValid) process.exitCode = 1;
            } else {
                const to = command === 'read' ? 'pseudocode' : value('--to');
                if (!['pseudocode', 'sb3', 'c', 'host-c', 'python', 'javascript', 'micropython', 'basic'].includes(to)) {
                    throw new Error('Use --to pseudocode|sb3|c|host-c|python|javascript|micropython|basic');
                }
                let result;
                if (to === 'pseudocode') result = source;
                else if (to === 'sb3') result = Buffer.from(await (await creator.generateSB3()).arrayBuffer());
                else if (to === 'c') result = creator.generateC(undefined, {debug: true});
                else if (to === 'host-c') result = creator.generateHostC();
                else if (to === 'python') result = creator.generatePython();
                else if (to === 'javascript') result = creator.generateJavaScript();
                else if (to === 'micropython') {
                    const generated = creator.generateMicroPython();
                    if (!generated.ok) throw new Error(`MicroPython refused: ${generated.reasons.join('; ')}`);
                    result = generated.py;
                } else {
                    const generated = creator.generateBASIC();
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
        const command = mode === 'probe' ? ['--probe', ...pass] : pass;
        const result = spawnSync(python, [script, ...command], {stdio: 'inherit'});
        if (result.error) die(`${python}: ${result.error.message}`);
        else process.exitCode = result.status ?? 1;
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
