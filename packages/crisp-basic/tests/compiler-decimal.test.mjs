// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {compileSource} from '../src/compiler/index.mjs';

test('AVR binary64 packing and decimal formatting agree with independent host rounding', async t => {
    const directory = await mkdtemp(path.join(tmpdir(), 'crispbasic-decimal-'));
    t.after(() => rm(directory, {recursive: true, force: true}));
    const generated = compileSource('END', {numericProfile: 'binary64'}).c;
    const harness = `
#undef main
#include <inttypes.h>
static void normalize_exponent(char *text) {
    char *e = strchr(text, 'e'), *from, *to;
    if (!e) return;
    *e = 'E'; from = to = e + 1;
    if (*from == '-') *to++ = *from++; else if (*from == '+') ++from;
    while (*from == '0' && from[1]) ++from;
    do { *to++ = *from; } while (*from++);
}
int main(void) {
    char line[4096], actual[96], expected[96]; unsigned int checked = 0;
    while (fgets(line, sizeof line, stdin)) {
        if (line[0] == 'P') {
            uint64_t mantissa, got, want; int exponent; unsigned int negative;
            unsigned char packed[10] = {0}; double result;
            if (sscanf(line + 2, "%" SCNx64 " %d %u", &mantissa, &exponent, &negative) != 3) return 2;
            packed[0] = (unsigned char)negative;
            memcpy(packed + 1, &mantissa, 7);
            packed[8] = (unsigned char)exponent; packed[9] = (unsigned char)(exponent >> 8);
            got = __f7_get_double(packed);
            result = (double)ldexpl((long double)mantissa, exponent - 55);
            if (negative) result = -result;
            memcpy(&want, &result, 8);
            if (got != want) { fprintf(stderr, "pack %s: %016" PRIx64 " != %016" PRIx64 "\\n", line + 2, got, want); return 1; }
        } else {
            uint64_t bits = strtoull(line + 2, NULL, 16); double value;
            memcpy(&value, &bits, 8);
            cb_decimal_format(actual, sizeof actual, value);
            snprintf(expected, sizeof expected, "%.9g", value); normalize_exponent(expected);
            if (strcmp(actual, expected)) { fprintf(stderr, "format %016" PRIx64 ": %s != %s\\n", bits, actual, expected); return 1; }
        }
        ++checked;
    }
    printf("%u\\n", checked); return 0;
}
`;
    const source = path.join(directory, 'decimal.c'), executable = path.join(directory, 'decimal');
    await writeFile(source, '#define main cb_example_main\n' + generated + harness);
    const build = spawnSync(process.env.CC || 'gcc', ['-std=c99', '-O2', '-DCB_TEST_AVR_DECIMAL=1', source, '-lm', '-o', executable],
        {encoding: 'utf8', timeout: 30000});
    assert.ifError(build.error); assert.equal(build.status, 0, build.stderr);
    const bits = ['0000000000000000', '8000000000000000', '0000000000000001',
        '000fffffffffffff', '0010000000000000', '3ff0000000000000',
        '3ff3c0ca4283de1b', '7fefffffffffffff', 'ffefffffffffffff'];
    let random = 0x73bc6421;
    const next = () => {random ^= random << 13; random ^= random >>> 17; random ^= random << 5; return random >>> 0;};
    for (let i = 0; i < 256; i++) {
        let high = next();
        if ((high & 0x7ff00000) === 0x7ff00000) high = (high & 0x800fffff) | 0x7fe00000;
        bits.push((high >>> 0).toString(16).padStart(8, '0') + next().toString(16).padStart(8, '0'));
    }
    const rows = bits.map(value => 'F ' + value);
    const exponents = [-1077, -1076, -1075, -1074, -1073, -1024, -1023, -1022, -1021, -1, 0, 1, 1022, 1023, 1024];
    const mantissas = [0n, 0x80000000000000n, 0x80000000000003n, 0x80000000000004n,
        0x80000000000005n, 0x8000000000000bn, 0x8000000000000cn, 0x8000000000000dn,
        0xfffffffffffffcn, 0xffffffffffffffn];
    for (const exponent of exponents) for (const mantissa of mantissas) for (const sign of [0, 1])
        rows.push(`P ${mantissa.toString(16)} ${exponent} ${sign}`);
    for (let i = 0; i < 512; i++) {
        const mantissa = ((BigInt(next() & 0xffffff) << 32n) | BigInt(next())) | (1n << 55n);
        rows.push(`P ${mantissa.toString(16)} ${next() % 2201 - 1100} ${next() & 1}`);
    }
    const run = spawnSync(executable, [], {input: rows.join('\n') + '\n', encoding: 'utf8', timeout: 30000});
    assert.ifError(run.error); assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stdout.trim(), String(rows.length));
});
