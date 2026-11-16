// Resource-scheduler controls only: synthetic subprocesses, no npm/network or native engine.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync, writeFileSync, readFileSync, rmSync, realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {npmEnv} from '../scripts/worktree-deps.mjs';
const linuxTest = (name, callback) => test(name, {skip: process.platform !== 'linux'}, callback);
const gate = fileURLToPath(new URL('../scripts/lib/npm-prepare-gate/npm', import.meta.url));
const fixture = t => {
    const root = mkdtempSync(join(tmpdir(), 'bw-prepare-gate-'));
    const fake = join(root, 'real-npm');
    writeFileSync(fake, `#!/usr/bin/env python3
import os,sys,json,time,subprocess
fd=os.open(os.environ['GATE_EVENTS'],os.O_CREAT|os.O_WRONLY|os.O_APPEND,0o600)
def event(kind):os.write(fd,(json.dumps({'event':kind,'pid':os.getpid(),'args':sys.argv[1:]})+'\\n').encode())
event('enter')
if os.environ.get('GATE_NESTED')=='1':
 env=dict(os.environ,GATE_NESTED='0')
 subprocess.run([os.environ['GATE_PATH'],'install','--force','--include=dev'],env=env,check=True,timeout=3)
time.sleep(.12)
event('exit')
`, {mode: 0o755});
    t.after(() => rmSync(root, {recursive: true, force: true}));
    const env = {...process.env, BW_LITE_REAL_NPM: fake, BW_LITE_NPM_PREPARE_LOCK: join(root, 'gate.lock'),
        BW_LITE_NPM_PREPARE_WAIT_SECONDS: '2', GATE_EVENTS: join(root, 'events'), GATE_PATH: gate};
    return {root, env, events: () => {try {return readFileSync(env.GATE_EVENTS, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);} catch {return [];}}};
};
const runNode = (env, code, cwd, args = []) => new Promise((done, fail) => {
    const child = spawn(process.execPath, ['-e', code, ...args], {env, cwd});let output = '', error = '';
    child.stdout.on('data', chunk => {output += chunk;});child.stderr.on('data', chunk => {error += chunk;});
    child.once('error', fail);child.once('close', status => done({status, output, error}));
});
const invoke = (env, args) => new Promise((done, fail) => {
    const child = spawn(gate, args, {env});let error = '';
    child.stderr.on('data', chunk => {error += chunk;});child.once('error', fail);
    child.once('close', code => done({code, error}));
});
const peak = rows => {let live = 0, max = 0;for (const row of rows) {live += row.event === 'enter' ? 1 : -1;max = Math.max(live, max);}assert.equal(live, 0);return max;};
linuxTest('opt-in canonical environment routes preparation through the gate without changing npm arguments', () => {
    const names = ['BW_LITE_SERIAL_GIT_PREPARE', 'BW_LITE_NPM_PREPARE_LOCK'];
    const saved = names.map(name => process.env[name]);
    try {
        process.env.BW_LITE_SERIAL_GIT_PREPARE = '1';delete process.env.BW_LITE_NPM_PREPARE_LOCK;
        assert.throws(npmEnv, /needs Linux and/);
        process.env.BW_LITE_NPM_PREPARE_LOCK = 'test.lock';const env = npmEnv();
        assert.equal(env.PATH.split(':')[0], dirname(gate));
        assert.equal(env.BW_LITE_REAL_NPM, join(dirname(process.execPath), 'npm'));
    } finally {names.forEach((name, i) => {if (saved[i] === undefined) delete process.env[name];else process.env[name] = saved[i];});}
});
linuxTest('parallel Git preparations serialize while preserving every argument', async t => {
    const f = fixture(t), args = ['install', '--force', '--include=dev', '--include=peer', '--include=optional', '--no-audit'];
    const results = await Promise.all([invoke(f.env, args), invoke(f.env, args), invoke(f.env, args)]);
    assert.ok(results.every(row => row.code === 0));assert.equal(peak(f.events()), 1);
    for (const row of f.events()) assert.deepEqual(row.args, args);
});
linuxTest('top-level non-preparation npm commands remain concurrent (negative scheduling control)', async t => {
    const f = fixture(t), args = ['install', '--ignore-scripts', '--legacy-peer-deps'];
    assert.ok((await Promise.all([invoke(f.env, args), invoke(f.env, args)])).every(row => row.code === 0));
    assert.equal(peak(f.events()), 2);
});
linuxTest('descendant preparation is reentrant and cannot deadlock on its live ancestor', async t => {
    const f = fixture(t), result = await invoke({...f.env, GATE_NESTED: '1'}, ['install', '--force', '--include=dev']);
    assert.equal(result.code, 0, result.error);assert.equal(f.events().length, 4);
});
linuxTest('a bounded preparation wait refuses without launching npm', async t => {
    const f = fixture(t);
    const holder = spawn('python3', ['-c', 'import fcntl,sys,time;f=open(sys.argv[1],"a");fcntl.flock(f,fcntl.LOCK_EX);print("ready",flush=True);time.sleep(3)', f.env.BW_LITE_NPM_PREPARE_LOCK]);
    try {
        await new Promise((done, fail) => {holder.stdout.once('data', done);holder.once('error', fail);});
        const result = await invoke({...f.env, BW_LITE_NPM_PREPARE_WAIT_SECONDS: '1'}, ['install', '--force', '--include=dev']);
        assert.equal(result.code, 124);assert.match(result.error, /Timed out/);assert.deepEqual(f.events(), []);
    } finally {holder.kill('SIGTERM');await new Promise(done => holder.once('close', done));}
});

linuxTest('actual npm flat configuration and pacote absolute-executable route serialize fake preparations', async t => {
    const f = fixture(t), saved = [process.env.BW_LITE_SERIAL_GIT_PREPARE, process.env.BW_LITE_NPM_PREPARE_LOCK];
    let routed;
    try {
        process.env.BW_LITE_SERIAL_GIT_PREPARE = '1';process.env.BW_LITE_NPM_PREPARE_LOCK = f.env.BW_LITE_NPM_PREPARE_LOCK;
        routed = {...f.env, ...npmEnv()};
        // Preserve the actual npm identity for its configuration preload;
        // only the eventual scheduler child executes the synthetic fixture.
        routed.BW_LITE_REAL_NPM = npmEnv().BW_LITE_REAL_NPM;
    } finally {
        ['BW_LITE_SERIAL_GIT_PREPARE', 'BW_LITE_NPM_PREPARE_LOCK'].forEach((key, i) => {
            if (saved[i] === undefined) delete process.env[key];else process.env[key] = saved[i];
        });
    }
    const cli = realpathSync(routed.BW_LITE_REAL_NPM);
    const setup = `const path=require('node:path'),fs=require('node:fs');
const npmRoot=path.dirname(path.dirname(fs.realpathSync(process.env.BW_LITE_REAL_NPM)));
const Config=require(require.resolve('@npmcli/config',{paths:[npmRoot]}));
const definitions=require(path.join(npmRoot,'node_modules/@npmcli/config/lib/definitions'));
const config=new Config({...definitions,npmPath:npmRoot,argv:[]});`;
    assert.equal(routed.PATH.split(':')[0], dirname(gate));
    const baseline = await runNode({...routed, NODE_OPTIONS: f.env.NODE_OPTIONS || ''}, setup + '\nconsole.log(config.flat.npmBin);', f.root, [cli]);
    assert.equal(baseline.status, 0, baseline.error);
    assert.notEqual(baseline.output.trim(), gate, 'negative control must reproduce the PATH-only bypass');
    const probe = await runNode(routed, setup + `
const assert=require('node:assert/strict');assert.equal(config.flat.npmBin,${JSON.stringify(gate)});
assert.equal(config.npmBin,path.join(npmRoot,'bin/npm-cli.js'),'lifecycle npm_execpath must remain the real CLI');
const npm=require(path.join(npmRoot,'node_modules/pacote/lib/util/npm'));
const env={...process.env,BW_LITE_REAL_NPM:${JSON.stringify(f.env.BW_LITE_REAL_NPM)}};
Promise.all([1,2].map(()=>npm(config.flat.npmBin,['install','--force','--include=dev'],process.cwd(),env,{})))
.then(()=>console.log('routed')).catch(error=>{console.error(error);process.exitCode=1;});`, f.root, [cli]);
    assert.equal(probe.status, 0, probe.error);assert.match(probe.output, /routed/);
    assert.equal(peak(f.events()), 1, 'actual Config/pacote route must serialize, not only direct gate invocation');
    const unrelated = await runNode(routed, setup + '\nconsole.log(config.flat.npmBin);', f.root);
    assert.equal(unrelated.status, 0, unrelated.error);
    assert.equal(unrelated.output.trim(), cli, 'non-npm scripts must retain unmodified configuration');
});
