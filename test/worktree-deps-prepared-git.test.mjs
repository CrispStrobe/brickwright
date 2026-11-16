// Real npm Arborist identity/diff controls with synthetic files. No npm CLI,
// installation, Git command, registry access, or guest execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,statSync,readlinkSync,existsSync,chmodSync,symlinkSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {createRequire} from 'node:module';
import {seedPreparedGit} from '../scripts/worktree-deps.mjs';
const npmRoot=dirname(dirname(realpathSync(join(dirname(process.execPath),'npm'))));
const npmRequire=createRequire(join(npmRoot,'package.json'));
const Arborist=npmRequire('@npmcli/arborist');
const Diff=npmRequire('./node_modules/@npmcli/arborist/lib/diff.js');
const resolved='git+ssh://git@github.com/CrispStrobe/seed-control.git#'+'1'.repeat(40);
const make = t => {
 const base=mkdtempSync(join(tmpdir(),'bw-prepared-git-')),root=join(base,'root'),gui=join(base,'gui');
 t.after(()=>{chmodSync(join(root,'node_modules','fixture','index.js'),0o644);rmSync(base,{recursive:true,force:true});});
 mkdirSync(join(root,'node_modules','fixture'),{recursive:true});mkdirSync(join(root,'node_modules','.bin'));mkdirSync(gui);
 const packageData={name:'fixture',version:'1.0.0',main:'index.js',bin:{fixture:'index.js'}};
 writeFileSync(join(root,'node_modules','fixture','package.json'),JSON.stringify(packageData));
 writeFileSync(join(root,'node_modules','fixture','index.js'),'owned prepared payload');chmodSync(join(root,'node_modules','fixture','index.js'),0o444);
 symlinkSync('../fixture/index.js',join(root,'node_modules','.bin','fixture'));
 const entry={version:'1.0.0',resolved,bin:{fixture:'index.js'}};
 const hidden={name:'root',version:'1.0.0',lockfileVersion:3,requires:true,packages:{'node_modules/fixture':entry}};
 writeFileSync(join(root,'node_modules','.package-lock.json'),JSON.stringify(hidden));
 writeFileSync(join(root,'package-lock.installed.json'),JSON.stringify(hidden));
 const guiPackage={name:'gui',version:'1.0.0',dependencies:{fixture:resolved}};
 writeFileSync(join(gui,'package.json'),JSON.stringify(guiPackage));
 writeFileSync(join(gui,'package-lock.json'),JSON.stringify({...hidden,name:'gui',packages:{'':guiPackage,'node_modules/fixture':entry}}));
 return {root,gui};
};
test('matching completed Git payloads are private copies and stock Arborist regards them as unchanged',async t=>{
 const {root,gui}=make(t);const result=seedPreparedGit(root,gui);assert.equal(result.length,1);
 const source=join(root,'node_modules','fixture','index.js'),copy=join(gui,'node_modules','fixture','index.js');
 assert.equal(readlinkSync(join(gui,'node_modules','.bin','fixture')),'../fixture/index.js');
 assert.notEqual(statSync(source).ino,statSync(copy).ino);assert.equal(readFileSync(copy,'utf8'),'owned prepared payload');
 const actual=await new Arborist({path:gui,offline:true}).loadActual();
 const node=actual.inventory.get('node_modules/fixture');assert.equal(node.resolved,resolved);
 const ideal=await new Arborist({path:gui,offline:true}).loadVirtual();
 const diff=Diff.calculate({actual,ideal});
 assert.ok(!diff.children.some(row=>row.actual?.location==='node_modules/fixture'&&row.action),'no extraction/re-preparation should be required');
 writeFileSync(copy,'private GUI reification');assert.equal(readFileSync(source,'utf8'),'owned prepared payload');
 assert.throws(()=>seedPreparedGit(root,gui),/fresh GUI tree/);
});
test('a differing requested Git pin refuses reuse before creating a GUI dependency tree',t=>{
 const {root,gui}=make(t);const file=join(gui,'package-lock.json'),lock=JSON.parse(readFileSync(file));
 lock.packages['node_modules/fixture'].resolved=resolved.replace(/1{40}$/,'2'.repeat(40));writeFileSync(file,JSON.stringify(lock));
 assert.throws(()=>seedPreparedGit(root,gui),/identity differs/);
 assert.equal(existsSync(join(gui,'node_modules')),false);
});
