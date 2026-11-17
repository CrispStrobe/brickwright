// SPDX-License-Identifier: BSD-3-Clause
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const source=resolve('overlay/scratch-gui/static/cad-robots'),built=resolve(process.argv[2]||'packages/scratch-gui/build','static/cad-robots');
const raw=await readFile(source+'/manifest.json','utf8'),manifest=JSON.parse(raw);
if(await readFile(built+'/manifest.json','utf8')!==raw)throw Error('Built robot manifest is stale');
for(const item of manifest.examples){if(!/^[a-z]+\.sb3$/.test(item.file))throw Error('Invalid robot asset path');for(const dir of[source,built]){const bytes=await readFile(dir+'/'+item.file);if(bytes.length!==item.bytes||createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw Error(`Robot archive differs from canonical manifest: ${dir}/${item.file}`);}}
console.log(`PASS all ${manifest.examples.length} built robot projects match the source manifest and content hashes`);
