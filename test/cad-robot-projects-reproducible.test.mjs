// SPDX-License-Identifier: BSD-3-Clause
// The 22 CAD robot projects are generated artifacts: repackaging the CAD
// documents they embed must reproduce every archive and the manifest byte for
// byte (seeded sb3-creator ids, fixed zip timestamps, sorted entries). The full
// regeneration check with a CrispCAD checkout is
// `node scripts/generate-cad-robot-projects.mjs <crispcad> --check`.
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRobotProjects,committedRobotDocuments,compareRobotProjects} from '../scripts/generate-cad-robot-projects.mjs';

test('CAD robot projects are byte-reproducible from their embedded CAD documents',async()=>{
 const docs=await committedRobotDocuments();
 const first=await buildRobotProjects(docs),second=await buildRobotProjects(docs);
 assert.equal(second.manifest,first.manifest,'two packagings produce the same manifest');
 for(const [file,bytes]of first.files)assert.ok(Buffer.from(bytes).equals(second.files.get(file)),`two packagings produce the same ${file}`);
 assert.deepEqual(await compareRobotProjects(first),[],'committed projects match a fresh packaging');
});
