// Source-only resource controls; no npm/network, package installation or guest.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,symlinkSync,chmodSync,utimesSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {walk,walkEntries,treeDigest} from '../scripts/worktree-deps.mjs';
const fixture = t => {const dir=mkdtempSync(join(tmpdir(),'bw-stream-census-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));return dir;};
test('iterator yields directory ownership before reading descendants; legacy array and postorder remain available', t => {
    const root=fixture(t);mkdirSync(join(root,'a'));writeFileSync(join(root,'a','existing'),'x');symlinkSync('a/existing',join(root,'z'));
    const entries=walkEntries(root);assert.equal(entries.next().value.rel,'a');
    // A whole-census implementation would have read a/ before this insertion.
    writeFileSync(join(root,'a','later'),'y');
    assert.deepEqual(Array.from(entries,row=>row.rel),['a/existing','a/later','z']);
    const materialized=walk(root);assert.ok(Array.isArray(materialized));
    assert.deepEqual(materialized.map(row=>row.rel),['a','a/existing','a/later','z']);
    assert.deepEqual(Array.from(walkEntries(root,{postOrder:true}),row=>row.rel),['a/existing','a/later','a','z']);
});
test('streaming retains the exact documented mode/size/mtime/symlink digest format and order', t => {
    const root=fixture(t);mkdirSync(join(root,'a'));chmodSync(join(root,'a'),0o755);
    const file=join(root,'a','f');writeFileSync(file,'owned');chmodSync(file,0o444);utimesSync(file,new Date(1000),new Date(1000));
    symlinkSync('a/f',join(root,'z'));
    const expected=createHash('sha256');
    for(const row of [['d','a','755',''],['f','a/f','444','5:1000'],['l','z','777','a/f']])expected.update(row.join('\0')+'\n');
    const result=treeDigest(root);assert.equal(result.digest,expected.digest('hex'));assert.equal(result.files,1);assert.equal(result.bytes,5);
});
