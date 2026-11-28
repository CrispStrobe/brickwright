import {readFile} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {bundle} from './bundle.mjs';

export const BUNDLE_HELP = `Usage: crispbasic bundle program.bas [options]

  --target NAME       linux-x64, linux-arm64, linux-armv7, or web (default: host)
  --profile NAME      sdl (default, full graphical host) or headless
  --output PATH, -o   Output executable or HTML file (default: program / program.html)
  --runtime-pack DIR  Select a verified full SDL runtime pack
  --asset FILE=PATH   Embed a program resource at PATH (SDL; may be repeated)
  --runtime PATH      Select a built headless native interpreter
  --module PATH       Select the headless WASM JavaScript factory (web only)
  --wasm PATH         Select the headless WASM binary (web only)
  --title TEXT        Offline page title (default: source filename)
  --force             Replace an existing output file
  --json              Print the artifact receipt as JSON
  --help              Show this help

Build SDL first with npm run build:sdl:native or npm run build:sdl:web.
Native SDL bundles need no Node.js; their embedded runtime extracts privately.
SDL web pages contain all assets; use crispbasic serve for offline loopback HTTP.
Explicit --profile headless uses build:native / build:wasm; its web page supports file:.
Each profile retains its interpreter's documented platform boundaries.
`;

export async function runBundleCli(args, {writeOut = value => process.stdout.write(value)} = {}) {
    const {values, positionals, tokens} = parseArgs({args, strict: true, allowPositionals: true, tokens: true,
        options: {target: {type: 'string'}, profile: {type: 'string'}, output: {type: 'string', short: 'o'}, runtime: {type: 'string'},
            'runtime-pack': {type: 'string'}, asset: {type: 'string', multiple: true},
            module: {type: 'string'}, wasm: {type: 'string'}, title: {type: 'string'},
            force: {type: 'boolean'}, json: {type: 'boolean'}, help: {type: 'boolean'}}});
    if (values.help) { writeOut(BUNDLE_HELP); return; }
    const seen = new Set();
    for (const token of tokens) {
        if (token.kind !== 'option') continue;
        if (token.name === 'asset') continue;
        if (seen.has(token.name)) throw new Error(`--${token.name} may be specified only once`);
        seen.add(token.name);
    }
    if (positionals.length !== 1) throw new Error('bundle expects one .bas source file; use bundle --help');
    const filename = positionals[0];
    const assets = (values.asset ?? []).map(value => {
        const separator = value.indexOf('=');
        if (separator < 1 || separator === value.length - 1) throw new Error('--asset expects FILE=PATH');
        return {source: value.slice(0, separator), path: value.slice(separator + 1)};
    });
    const result = await bundle(await readFile(filename, 'utf8'), {filename, output: values.output,
        profile: values.profile, runtimePack: values['runtime-pack'], assets,
        target: values.target, runtime: values.runtime, modulePath: values.module, wasmPath: values.wasm,
        title: values.title, overwrite: values.force ?? false});
    writeOut(values.json ? `${JSON.stringify(result)}\n` : `Bundled ${result.path} (${result.target}, ${result.bytes} bytes)\n`);
    return result;
}
