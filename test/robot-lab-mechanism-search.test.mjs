// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 CrispStrobe
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filterModelExamples} from '../overlay/scratch-gui/src/lib/bw-sim/model/example-browser.js';
import {MODELS} from '../overlay/scratch-gui/src/lib/bw-sim/sim-session.js';
import {MODEL_LESSONS} from '../overlay/scratch-gui/src/lib/bw-sim/model/example-catalog.js';
for(const [query,ids] of [
 ['connecting rod ratio',['rod-ratio']],['Verniergetriebe',['vernier-drive']],['Scott Russell',['line-turner']],['Jansen',['dune-strider']],['Stewart platform',['atlas-six']],['oblique trammel',['oblique']],
 ['cable-driven parallel robot',['cable-compass','cable-compass-control']],['Seilroboter',['cable-compass','cable-compass-control']],
 ['scissor lift',['rise-ratio','rise-ratio-control']],['Scherenhubtisch',['rise-ratio','rise-ratio-control']],
 ['Hoeken',['stride-lab']],['Höken linkage',['stride-lab']],['Peaucellier Lipkin',['straight-eight']],['Peaucellier–Lipkin cell',['straight-eight']],['Peaucellier–Lipkin',['straight-eight']],
 ['Sarrus',['sarrus-lift']],['pantograph',['amplify','pantograph-doubler','scale-studio','scale-echo']],['Pantographs',['amplify','pantograph-doubler','scale-studio','scale-echo']],['Storchschnabel',['amplify','pantograph-doubler','scale-studio','scale-echo']],
 ['Oldham',['offset-orbit','crossglide']],['Oldham couplings',['offset-orbit','crossglide']],['Kreuzschieberkupplung',['offset-orbit','crossglide']],['universal joint',['phase-bridge','phase-bridge-misphased','ripple-relay']],
 ['Kardangelenk',['phase-bridge','phase-bridge-misphased','ripple-relay']],['Cardan',['phase-bridge','phase-bridge-misphased','ripple-relay']],['Watt linkage',['watt-line']],['orrery',['obliquity-orrery']],['Sonnendeklination',['obliquity-orrery']],['Maltese cross',['cadence-geneva']],['Malteserkreuz',['cadence-geneva']],['Willis equation',['helios-transmission']],['Stufenplanet',['helios-transmission']],['double Cardan',['phasekeeper','orion-cardan']],['normal modes',['tempest-pendulum']],['Doppelpendel',['cascade','tempest-pendulum']],['3:1',['twin-tempo']],['Scotch yoke',['sine-shuttle']],['Kurbelschleife',['sine-shuttle']],['contact indexer',['quartermaster']],['Rastsperre',['quartermaster']]
])for(const locale of ['en','de'])test(`Examples ${locale}: ${query} finds its actual mechanisms`,()=>{
 const found=filterModelExamples(MODELS,MODEL_LESSONS,{query,locale}).map(m=>(m.id||m.file).replace(/\.ldr$/,''));
 for(const id of ids)assert.ok(found.includes(id),`${id} missing from ${found}`);
 assert.ok(!found.includes('line-follower'),'unrelated model is excluded');
});
test('mechanism search preserves topic and piece-count filters',()=>{
 assert.deepEqual(filterModelExamples(MODELS,MODEL_LESSONS,{query:'Oldham',topic:'sensing'}),[]);
 assert.deepEqual(filterModelExamples(MODELS,MODEL_LESSONS,{query:'pantograph',size:'small'}),[]);
 assert.equal(filterModelExamples(MODELS,MODEL_LESSONS,{query:'Oldham',size:'large'}).length,2);
});
