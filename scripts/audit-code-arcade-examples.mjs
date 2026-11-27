// SPDX-License-Identifier: BSD-3-Clause
import {createHash} from 'node:crypto';
import {mkdir, readFile, rename, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {parseArgs} from 'node:util';
import {chromium} from 'playwright';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator.js';
import vectorArt from '../overlay/scratch-gui/src/lib/sb3-creator-vector-art.js';
import examples from '../overlay/scratch-gui/src/lib/sb3-creator-examples.js';
import games from '../overlay/scratch-gui/src/lib/sb3-creator-game-examples.js';
import {svgToPixels} from '../overlay/scratch-gui/src/lib/bw-makecode/pixel-image.js';
import {makeCodeProjectFile} from '../overlay/scratch-gui/src/lib/bw-makecode/project-file.js';
import {projectJsonToArcade} from '../overlay/scratch-gui/src/lib/bw-makecode/export-arcade.js';
import {compile} from './lib/pxt-node.mjs';
import {arcadeExampleChecks} from './lib/arcade-example-checks.mjs';
import {runPxtArcade} from '../test/helpers/pxt-arcade-runtime.mjs';

const {values: options} = parseArgs({options: {
    only: {type: 'string', multiple: true},
    inventory: {type: 'boolean'},
    portable: {type: 'boolean'},
    output: {type: 'string'},
    report: {type: 'string'},
    simulate: {type: 'boolean'}
}});
const sources = {...examples, ...games};
const importer = await readFile(new URL(
    '../overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx', import.meta.url), 'utf8');
const menu = importer.match(/^const GROUPS = \[([\s\S]+?)^\];/m)?.[1];
if (!menu) throw new Error('The shipped Code example menu could not be located.');
const menuIds = [...menu.matchAll(/\['([\w-]+)',/g)].map(([, id]) => id);
if (!menuIds.length || menuIds.some(id => !sources[id])) throw new Error('A Code menu example is missing from the source inventory.');

const entries = new Map(Object.entries(sources).map(([id, source]) =>
    [id, {id, scope: menuIds.includes(id) ? 'Code menu' : 'legacy source', source}]));
const catalogue = new URL('../overlay/scratch-gui/examples/', import.meta.url);
for (const example of JSON.parse(await readFile(new URL('index.json', catalogue), 'utf8'))) {
    const source = example.files?.program ? await readFile(new URL(example.files.program, catalogue), 'utf8') : null;
    const id = `circuit:${example.id}`;
    entries.set(id, {id, scope: 'Circuit catalogue', source, catalogue: example});
}
for (const id of options.only || []) if (!entries.has(id)) throw new Error(`Unknown example ${id}.`);

const classify = ({source, catalogue: example}) => {
    if (source === null) return {outcome: 'no published program'};
    if (!source.split('\n').some(line => line.trim() && !/^\s*(#|;|\/\/)/.test(line))) {
        return {outcome: 'comment-only circuit description'};
    }
    const device = source.match(/^\s*DEVICE[ \t]+([\w-]+)/im)?.[1]?.toLowerCase() || example?.devices?.[0] || null;
    if (device && device !== 'arcade') return {device, outcome: 'dedicated hardware'};
    if (example?.files.circuit) return {device, outcome: 'circuit-dependent program'};
    if (example?.files.controller) return {device, outcome: 'Controller-dependent program'};
    return {device};
};
const results = [...entries.values()].filter(entry => !options.only || options.only.includes(entry.id))
    .map(entry => ({id: entry.id, scope: entry.scope, ...classify(entry)}));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const provenance = {portable: Boolean(options.portable), simulate: Boolean(options.simulate), files: {}};
for (const path of ['overlay/scratch-gui/src/lib/bw-makecode/export-arcade.js',
    'overlay/scratch-gui/src/lib/bw-makecode/scratch-arcade-keyboard.js', 'overlay/scratch-gui/examples/index.json']) {
    const bytes = await readFile(new URL(`../${path}`, import.meta.url));
    provenance.files[path] = sha256(bytes);
}
const publish = async () => {
    const report = {schema: 'bw-arcade-code-examples-v1', provenance, results, counts: {}, scopes: {}};
    for (const {scope, outcome = 'pending', simulator} of results) {
        report.counts[outcome] = (report.counts[outcome] || 0) + 1;
        const section = report.scopes[scope] ||= {total: 0, simulatorRuns: 0, outcomes: {}};
        section.total++;
        section.simulatorRuns += simulator ? 1 : 0;
        section.outcomes[outcome] = (section.outcomes[outcome] || 0) + 1;
    }
    if (options.report) {
        await writeFile(`${options.report}.partial`, JSON.stringify(report, null, 2) + '\n');
        await rename(`${options.report}.partial`, options.report);
    }
    return report.scopes;
};
if (!options.report) {
    console.error('Pass --report PATH to retain compiler, simulator and inventory details.');
}
SB3Creator.registerVectorArt(vectorArt);
let browser, canvas;
const browserErrors = /Target page, context or browser has been closed|Page crashed|Browser has been closed/i;
const useBrowser = async operation => {
    for (let attempt = 0; ; attempt++) {
        try {
            if (!browser?.isConnected()) {
                browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
                canvas = null;
            }
            if (!canvas || canvas.isClosed()) canvas = await browser.newPage();
            return await operation(browser, canvas);
        } catch (error) {
            if (attempt > 0 || !browserErrors.test(error.message)) throw error;
            console.error('Retrying after the local browser or raster page closed.');
            await browser?.close().catch(() => {});
            browser = null;
            canvas = null;
        }
    }
};
if (options.output && !options.inventory) await mkdir(options.output, {recursive: true});
await publish();
try {
    for (const row of results) {
        const {id} = row;
        if (row.outcome) continue;
        if (options.inventory) {
            row.outcome = 'Arcade candidate';
            continue;
        }
        const {source} = entries.get(id);
        try {
            const creator = new SB3Creator();
            creator.parse(source);
            row.sourceWarnings = creator.warnings;
            row.opcodes = [...new Set(creator.project.targets.flatMap(target =>
                Object.values(target.blocks || {}).map(block => block.opcode)))].sort();
            const assets = creator.assets;
            const rasters = new Map(await useBrowser((browser, canvas) => canvas.evaluate(async entries => Promise.all(entries.map(async ([key, svg]) => {
                const image = new Image();
                const url = URL.createObjectURL(new Blob([svg], {type: 'image/svg+xml'}));
                try {
                    image.src = url;
                    await image.decode();
                    const raster = document.createElement('canvas');
                    raster.width = image.naturalWidth;
                    raster.height = image.naturalHeight;
                    const context = raster.getContext('2d');
                    context.drawImage(image, 0, 0);
                    const {data, width, height} = context.getImageData(0, 0, raster.width, raster.height);
                    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
                    let binary = '';
                    for (let offset = 0; offset < bytes.length; offset += 16384) {
                        binary += String.fromCharCode(...bytes.subarray(offset, offset + 16384));
                    }
                    return [key, {base64: btoa(binary), width, height}];
                } finally {
                    URL.revokeObjectURL(url);
                }
            })), [...assets].filter(([, asset]) => asset.type === 'svg' && !svgToPixels(asset.data)).map(([key, asset]) => [key, asset.data]))));
            for (const raster of rasters.values()) {
                raster.rgba = Buffer.from(raster.base64, 'base64');
                delete raster.base64;
            }
            const name = id.replace(/[^a-z0-9_-]/gi, '-');
            const output = projectJsonToArcade(JSON.stringify(creator.project), {
                name,
                browserPointer: !options.portable,
                costumeSvg: (target, costume) => assets.get(costume.assetId)?.data || null,
                costumeRgba: (target, costume) => rasters.get(costume.assetId) || null,
                soundData: (target, sound) => assets.get(sound.assetId)?.data || null
            });
            row.unsupported = output.unsupported;
            row.warnings = output.warnings;
            row.pxtSourceSha256 = sha256(JSON.stringify(Object.keys(output.files).sort()
                .map(file => [file, output.files[file]])));
            if (options.output) {
                const bytes = makeCodeProjectFile(output.files, {name, target: 'arcade'});
                const filename = `arcade-${name}.mkcd`;
                await writeFile(join(options.output, filename), bytes);
                row.project = {filename, sha256: sha256(bytes)};
            }
            row.outcome = 'compiler failure';
            const recordCompilation = pxt => {
                row.compiled = pxt.success;
                row.diagnostics = pxt.diagnostics || [];
                row.outcome = !pxt.success ? 'compiler refusal' : output.unsupported.length || creator.warnings.length ?
                    'compiled with unsupported operations' : 'compiled';
            };
            if (!options.simulate) {
                recordCompilation(await compile('arcade', output.files));
            } else {
                const functional = options.portable && ['sigil_grid', 'vector_seven', 'canal_command'].includes(id) ?
                    null : arcadeExampleChecks[id];
                const sample = await useBrowser(browser => runPxtArcade(output.files, {
                    browser, onCompilation: ({built}) => recordCompilation(built),
                    inspectDisplay: true, waitForDisplay: true, waitForMain: false,
                    ...(functional?.options || {buttonActions: {steps: [
                        {button: 5, held: true, delay: 1000}, {button: 5, held: false, delay: 80},
                        {button: 4, held: true, delay: 80}, {button: 4, held: false, delay: 80}
                    ]}})
                }));
                if (sample.$display.screen.length !== 160 * 120 || sample.$display.updatesAfterReady < 1) {
                    throw new Error('Arcade simulator did not present a complete native screen frame.');
                }
                row.simulator = {check: functional?.name || 'boot and input smoke test',
                    screenPixels: sample.$display.screen.length,
                    colours: new Set(sample.$display.screen).size, displayUpdates: sample.$display.updatesAfterReady,
                    ...(functional ? functional.observe(sample) : {}),
                    ...(Object.hasOwn(sample, 'started') ? {started: sample.started} : {})};
            }
        } catch (error) {
            row.error = error.message.slice(0, 4000);
            row.outcome = row.compiled ? 'simulator failure' : row.outcome || 'export failure';
        }
        await publish();
        if (row.error) console.error(id, row.error);
        console.log(`${id}: ${row.outcome}${row.unsupported?.length ? ` (${row.unsupported.length} unsupported)` : ''}`);
    }
} finally {
    await browser?.close().catch(() => {});
}
console.log(JSON.stringify(await publish()));
