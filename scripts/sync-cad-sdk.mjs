// SPDX-License-Identifier: BSD-3-Clause
export const NOTICE = {"name":"Brickwright CAD SDK","licence":"BSD-3-Clause","holder":"CrispStrobe"};
// Build in the CAD repo with npm run build:brickwright-sdk, then pin its output here.
import {readFile,writeFile,cp,rm,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),source=args.find(arg=>!arg.startsWith('--'));
if(!source)throw new Error('Usage: node scripts/sync-cad-sdk.mjs <cad-checkout> [--check]');
const cad=resolve(source),input=resolve(cad,'dist/brickwright-sdk');
const manifest=JSON.parse(await readFile(resolve(input,'manifest.json'),'utf8'));
if(manifest.format!=='brickwright-cad-sdk'||manifest.dirty)throw new Error('Build the SDK from a clean, committed CAD checkout');
if(manifest.commit!==execFileSync('git',['-C',cad,'rev-parse','HEAD'],{encoding:'utf8'}).trim())throw new Error('Rebuild the SDK for the current CAD commit');
const target=resolve(root,'overlay/scratch-gui/static/cad-sdk');
for(const [file,hash] of Object.entries(manifest.files)){
 if(file.includes('..')||file.startsWith('/'))throw new Error('Invalid SDK path');
 const digest=path=>readFile(path).then(bytes=>createHash('sha256').update(bytes).digest('hex'));
 if(await digest(resolve(input,file))!==hash)throw new Error(`SDK source hash mismatch: ${file}`);
 if(args.includes('--check')&&await digest(resolve(target,file))!==hash)throw new Error(`Vendored SDK differs: ${file}`);
}
if(args.includes('--check')){
 if((await readFile(resolve(target,'manifest.json'),'utf8'))!==JSON.stringify(manifest,null,2)+'\n')throw new Error('SDK manifest differs');
 console.log(`PASS pinned CAD SDK ${manifest.commit}`);
}else{
 await rm(target,{recursive:true,force:true});await mkdir(target,{recursive:true});await cp(input,target,{recursive:true});
 console.log(`Pinned CAD SDK ${manifest.commit}`);
}
