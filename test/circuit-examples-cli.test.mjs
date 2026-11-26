import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const cli = join(import.meta.dirname, '../bin/bwlite.mjs');
const invoke = (...args) => spawnSync(process.execPath, [cli, 'circuit', 'test', ...args],
    {encoding: 'utf8', timeout: 60_000});

test('circuit CLI drives the loaded button and measures one and two blinks', () => {
    const result = invoke('05-counter', '--device', 'stc12c5a60s2', '--json');
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const {rows} = JSON.parse(result.stdout);
    assert.equal(rows.length, 1);
    const [{smoke, behavior}] = rows;
    assert.equal(smoke, 'pass');
    assert.equal(behavior.status, 'pass');
    assert.deepEqual(behavior.checks.map(check => check.observed), [
        {rises: 0, falls: 0}, {rises: 1, falls: 1}, {rises: 2, falls: 2}
    ]);
});

test('circuit CLI distinguishes smoke from functional coverage', () => {
    const result = invoke('05-counter', '--device', 'stm32f030', '--smoke-only', '--json');
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const {rows} = JSON.parse(result.stdout);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].device, 'stm32f030');
    assert.equal(rows[0].smoke, 'pass');
    assert.equal(rows[0].behavior.status, 'unverified');
});

test('circuit CLI rejects an unknown gallery ID', () => {
    const result = invoke('missing-example', '--json');
    assert.equal(result.status, 2);
    assert.match(result.stderr, /No matching gallery circuit benches/);
});
