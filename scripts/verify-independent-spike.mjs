import {privateSpikeEvidenceDirectory} from './lib/private-spike-evidence.mjs';
const evidenceDirectory = privateSpikeEvidenceDirectory();
// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
// Verify standalone execution of virtual SPIKE programs.
import {mkdirSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const tests=['spike-arena-contact','spike-arena-project-editing','spike-virtual-connection','virtual-hub-shim','spike3-python-import','spike-long-sequences','spike-sandbox','independent-spike-controller','independent-spike-backend','independent-spike-speed-envelope','spike-simulator-pane','spike-arena-sim','spike-arena-challenges',
 'spike3-python-arena','spike3-python-arena-d1','virtual-spike-extension-e2e','virtual-spike-classic-extension-e2e',
 'virtual-spike-prime','virtual-spike-classic','virtual-spike-panel','virtual-spike-shared-state',
 'spike-firmware-program','spike-renode-arena-session','spike-renode-arena','native-renode-capability'];
let result;
 result=spawnSync(process.execPath,['--test','--test-reporter=tap','--import','./scripts/lib/register-gui-scope.mjs',...tests.map(name=>`test/${name}.test.mjs`)],
  {cwd:root,encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024});
const out=evidenceDirectory;mkdirSync(out,{recursive:true});
writeFileSync(resolve(out,'virtual-spike-suite.tap'),`${result.stdout||''}${result.stderr||''}`);
writeFileSync(resolve(out,'virtual-spike-suite.json'),JSON.stringify({node:process.version,standaloneBackend:true,
 tests,status:result.status,error:result.error?.message,dependencyRoot:process.env.BW_INTEGRATED_ROOT||'packages/scratch-gui'},null,2)+'\n');
process.stdout.write((result.stdout||'').split('\n').filter(line=>/^(not ok|# (tests|pass|fail|cancelled|skipped))/.test(line)).join('\n')+'\n');
if(result.error)console.error(result.error.message);
process.exitCode=result.status===0?0:1;
