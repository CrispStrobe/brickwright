// Resource-scheduler controls only: synthetic subprocesses, no npm/network or native engine.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync, writeFileSync, readFileSync, rmSync} from 'node:fs';
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
