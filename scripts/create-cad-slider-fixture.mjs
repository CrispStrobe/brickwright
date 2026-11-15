// SPDX-License-Identifier: BSD-3-Clause
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator-register-art.js';
const cad=process.argv[2];if(!cad)throw new Error('Usage: node scripts/create-cad-slider-fixture.mjs <built CAD checkout>');
const {createSimulationExample}=await import(pathToFileURL(resolve(cad,'packages/editor/dist/simulation-examples.js')));
await mkdir('artifacts',{recursive:true});
await writeFile('artifacts/cad-slider-fixture.bcad',JSON.stringify(createSimulationExample('simlab-slider')));
const c=new SB3Creator();c.parse('WHEN green flag clicked:\n  cad run slider A for 10 mm at 50 mm per second\n  say (cad slider A position)\n  cad stop slider A brake\n  cad stop\n');
await writeFile('artifacts/cad-slider-program.sb3',new Uint8Array(await(await c.generateSB3()).arrayBuffer()));
console.log('Wrote CAD slider document and executable block fixture');
