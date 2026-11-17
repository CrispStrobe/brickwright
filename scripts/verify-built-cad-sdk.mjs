// SPDX-License-Identifier: BSD-3-Clause
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const base=resolve(process.argv[2] || 'packages/scratch-gui/build','static/cad-sdk');
const manifest=JSON.parse(await readFile(resolve(base,'manifest.json'),'utf8'));
if(manifest.format!=='brickwright-cad-sdk'||manifest.dirty)throw new Error('Invalid built CAD SDK manifest');
for(const [file,hash]of Object.entries(manifest.files)){
 if(file.includes('..')||file.startsWith('/'))throw new Error('Invalid SDK path');
 const bytes=await readFile(resolve(base,file));
 if(createHash('sha256').update(bytes).digest('hex')!==hash)throw new Error(`Built CAD SDK was changed: ${file}`);
}
console.log(`PASS final app preserves all ${Object.keys(manifest.files).length} CAD SDK file digests (${manifest.commit})`);

// Robot bundles are part of the qualified app, not a separately trusted mirror.
await import('./verify-built-cad-robot-projects.mjs');
