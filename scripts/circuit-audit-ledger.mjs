// Merge incremental runs from `bwlite circuit test --json` into the full ledger.
import {readFile} from 'node:fs/promises';
import {basename} from 'node:path';

const [baseline, ...receipts] = process.argv.slice(2);
if (!baseline || !receipts.length) {
    throw new Error('Usage: node scripts/circuit-audit-ledger.mjs BASELINE.json RECEIPT.json [...]');
}
const read = async path => JSON.parse(await readFile(path, 'utf8'));
const keyOf = row => JSON.stringify([row.id, row.device ?? null, row.file]);
const original = await read(baseline);
const ledger = new Map(original.rows.map(row => [keyOf(row), row]));
if (ledger.size !== original.rows.length) throw new Error('Duplicate circuit variant in baseline');
const followUp = new Map();

for (const path of receipts) {
    const receipt = await read(path);
    for (const row of receipt.rows) {
        const key = keyOf(row);
        const previous = ledger.get(key);
        if (!previous) throw new Error(`Unknown variant ${key} in ${path}`);
        const status = row.behavior?.status;
        if (!['pass', 'fail', 'unverified', 'incomplete'].includes(status)) {
            throw new Error(`Invalid functional verdict for ${key} in ${path}`);
        }
        const source = basename(path);
        followUp.set(key, {row, source});
        // A run that could not execute its functional check leaves any prior
        // functional finding intact. A real pass or failure supersedes it.
        const behavior = ['pass', 'fail'].includes(status) ? row.behavior : previous.behavior;
        const smoke = row.smoke === 'incomplete' ? previous.smoke : row.smoke;
        ledger.set(key, {...previous, smoke, behavior, followUp: {source, smoke: row.smoke, behavior: row.behavior}});
    }
}

const tally = list => Object.fromEntries(Object.entries(Object.groupBy(list, value => value))
    .map(([value, entries]) => [value, entries.length]));
const rows = [...ledger.values()];
const pending = original.rows.filter(row => row.behavior.status !== 'pass');
const reviewed = pending.map(row => followUp.get(keyOf(row)));
const summary = {
    examples: new Set(rows.map(row => row.id)).size,
    benches: rows.length,
    startup: tally(rows.map(row => row.smoke)),
    behavior: tally(rows.map(row => row.behavior.status)),
    functionalCoverage: tally(rows.filter(row => row.behavior.status === 'pass').map(row => row.behavior.scope ?? 'lesson')),
    followUp: {baselineWithoutPass: pending.length, reviewed: reviewed.filter(Boolean).length,
        results: tally(reviewed.map(result => result?.row.behavior.status ?? 'pending'))}
};
console.log(JSON.stringify({summary, rows}, null, 2));
