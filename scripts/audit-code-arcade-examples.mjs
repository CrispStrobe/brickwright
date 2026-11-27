// SPDX-License-Identifier: BSD-3-Clause
import {readFile, writeFile} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {chromium} from 'playwright';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator.js';
import vectorArt from '../overlay/scratch-gui/src/lib/sb3-creator-vector-art.js';
import examples from '../overlay/scratch-gui/src/lib/sb3-creator-examples.js';
import games from '../overlay/scratch-gui/src/lib/sb3-creator-game-examples.js';
import {svgToPixels} from '../overlay/scratch-gui/src/lib/bw-makecode/pixel-image.js';
import {projectJsonToArcade} from '../overlay/scratch-gui/src/lib/bw-makecode/export-arcade.js';
import {compile} from './lib/pxt-node.mjs';
import {runPxtArcade} from '../test/helpers/pxt-arcade-runtime.mjs';

const {values: options} = parseArgs({options: {
    only: {type: 'string', multiple: true},
    inventory: {type: 'boolean'},
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
const results = [];
if (!options.report) {
    console.error('Pass --report PATH to retain compiler, simulator and inventory details.');
}
SB3Creator.registerVectorArt(vectorArt);
const browser = options.inventory ? null : await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
try {
    const canvas = await browser?.newPage();
    for (const entry of entries.values()) {
        const {id, source, scope} = entry;
        if (options.only && !options.only.includes(id)) continue;
        const row = {id, scope, ...classify(entry)};
        results.push(row);
        if (row.outcome) continue;
        if (options.inventory) {
            row.outcome = 'Arcade candidate';
            continue;
        }
        try {
            const creator = new SB3Creator();
            creator.parse(source);
            row.sourceWarnings = creator.warnings;
            const assets = creator.assets;
            const rasters = new Map(await canvas.evaluate(async entries => Promise.all(entries.map(async ([key, svg]) => {
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
            })), [...assets].filter(([, asset]) => asset.type === 'svg' && !svgToPixels(asset.data)).map(([key, asset]) => [key, asset.data])));
            for (const raster of rasters.values()) {
                raster.rgba = Buffer.from(raster.base64, 'base64');
                delete raster.base64;
            }
            const output = projectJsonToArcade(JSON.stringify(creator.project), {
                name: id.replace(/[^a-z0-9_-]/gi, '-'),
                costumeSvg: (target, costume) => assets.get(costume.assetId)?.data || null,
                costumeRgba: (target, costume) => rasters.get(costume.assetId) || null,
                soundData: (target, sound) => assets.get(sound.assetId)?.data || null
            });
            row.unsupported = output.unsupported;
            row.warnings = output.warnings;
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
                const sample = await runPxtArcade(output.files, {
                    onCompilation: ({built}) => recordCompilation(built),
                    inspectDisplay: true, waitForDisplay: true, waitForMain: false,
                    buttonActions: id === 'twinwall' ? {afterGlobals: {started: 1}, steps: [
                        {keyDown: 'w', waitForGlobals: {ly: 135, ry: 0}},
                        {keyUp: 'w'},
                        {keyDown: 'ArrowDown', waitForGlobals: {ly: 135, ry: -135}},
                        {keyUp: 'ArrowDown'}
                    ]} : {steps: [{button: 5, held: true, delay: 1000}, {button: 5, held: false, delay: 80},
                        {button: 4, held: true, delay: 80}, {button: 4, held: false, delay: 80}]}
                });
                if (sample.$display.screen.length !== 160 * 120 || sample.$display.updatesAfterReady < 1) {
                    throw new Error('Arcade simulator did not present a complete native screen frame.');
                }
                row.simulator = {check: id === 'twinwall' ? 'independent paddle controls' : 'boot and input smoke test',
                    screenPixels: sample.$display.screen.length,
                    colours: new Set(sample.$display.screen).size, displayUpdates: sample.$display.updatesAfterReady,
                    ...(id === 'twinwall' ? {paddles: {left: sample.ly, right: sample.ry},
                        monitors: Object.entries(sample).filter(([key]) => /^__bwMonitorVisible_*$/.test(key))} : {}),
                    ...(Object.hasOwn(sample, 'started') ? {started: sample.started} : {})};
            }
        } catch (error) {
            row.error = error.message;
            row.outcome = row.compiled ? 'simulator failure' : row.outcome || 'export failure';
        }
        if (row.error) console.error(id, row.error);
        console.log(`${id}: ${row.outcome}${row.unsupported?.length ? ` (${row.unsupported.length} unsupported)` : ''}`);
    }
} finally {
    await browser?.close();
}
const report = {results, counts: {}, scopes: {}};
for (const {scope, outcome, simulator} of results) {
    report.counts[outcome] = (report.counts[outcome] || 0) + 1;
    const section = report.scopes[scope] ||= {total: 0, simulatorRuns: 0, outcomes: {}};
    section.total++;
    section.simulatorRuns += simulator ? 1 : 0;
    section.outcomes[outcome] = (section.outcomes[outcome] || 0) + 1;
}
if (options.report) await writeFile(options.report, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.scopes));
