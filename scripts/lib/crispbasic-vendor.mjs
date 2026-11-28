// What Brickwright takes from CrispStrobe/crispbasic, and how a file's identity
// is judged. Shared by scripts/sync-crispbasic.mjs (which writes the copy) and
// test/crispbasic-vendor-identity.test.mjs (which judges it), so the two can
// never disagree about which files are vendored.
//
// THE VENDORED SET is the upstream tree at the pin minus the repository-only
// paths below. Nothing is renamed or rewritten: packages/crisp-basic/<path> is
// upstream <path>, byte for byte and mode for mode. Identity is therefore Git
// blob identity, which needs only TREES from the upstream side, so a bare
// blobless clone (what build.yml's vendor-history step makes) can judge it.
import {execFileSync} from 'node:child_process';

export const CRISPBASIC_REPO = 'CrispStrobe/crispbasic';
export const CRISPBASIC_PIN_NAME = 'crispbasic';
export const CRISPBASIC_DEST = 'packages/crisp-basic';
// Repository-only paths upstream: its own CI and its own maintenance tools.
// GitHub reads workflows only at a repository root, so copying .github/ would
// ship inert files; tools/ re-extracts from Brickwright during the transition.
export const CRISPBASIC_UPSTREAM_ONLY = Object.freeze(['.github/', 'tools/']);

export const isVendored = rel => !CRISPBASIC_UPSTREAM_ONLY.some(p => rel.startsWith(p));

const git = (dir, args, opts = {}) => execFileSync('git', ['-C', dir, ...args],
    {encoding: opts.encoding ?? 'utf8', maxBuffer: 256 << 20, input: opts.input, stdio: ['pipe', 'pipe', 'pipe']});

/** Parse `git ls-tree -r -z` output into Map<path, {mode, oid}>. */
const parseTree = text => new Map(text.split('\0').filter(Boolean).map(row => {
    const tab = row.indexOf('\t');
    const [mode, type, oid] = row.slice(0, tab).split(' ');
    return [row.slice(tab + 1), {mode, type, oid}];
}));

/** The vendored files of upstream at `sha`, from any clone holding its trees. */
export function upstreamFiles (dir, sha) {
    const all = parseTree(git(dir, ['ls-tree', '-r', '-z', `${sha}^{tree}`]));
    for (const [rel, e] of all) if (e.type !== 'blob') throw new Error(`upstream ${rel} is a ${e.type}; only files are vendored`);
    return new Map([...all].filter(([rel]) => isVendored(rel)));
}

/** Brickwright's copy as it is on disk: tracked files, hashed from the work tree. */
export function localFiles (root) {
    const tracked = git(root, ['ls-files', '-z', '-s', '--', CRISPBASIC_DEST]).split('\0').filter(Boolean);
    const rels = tracked.map(row => row.slice(row.indexOf('\t') + 1).slice(CRISPBASIC_DEST.length + 1));
    const modes = new Map(tracked.map((row, i) => [rels[i], row.split(' ')[0]]));
    // --stdin-paths resolves paths against the repository top level, not -C.
    const oids = rels.length ? git(root, ['hash-object', '--no-filters', '--stdin-paths'],
        {input: rels.map(rel => `${CRISPBASIC_DEST}/${rel}`).join('\n') + '\n'})
        .trim().split('\n') : [];
    return new Map(rels.map((rel, i) => [rel, {mode: modes.get(rel), oid: oids[i]}]));
}

/** Every difference between the two maps, named. Empty means identical. */
export function diffFiles (upstream, local) {
    const out = [];
    for (const [rel, u] of upstream) {
        const l = local.get(rel);
        if (!l) out.push(`missing in Brickwright: ${rel}`);
        else if (l.oid !== u.oid) out.push(`content differs: ${rel} (upstream ${u.oid.slice(0, 12)}, Brickwright ${l.oid.slice(0, 12)})`);
        else if (l.mode !== u.mode) out.push(`mode differs: ${rel} (upstream ${u.mode}, Brickwright ${l.mode})`);
    }
    for (const rel of local.keys()) if (!upstream.has(rel)) out.push(`not upstream: ${rel}`);
    return out;
}

/** Whether `dir` holds commit `sha` (a blobless clone holds its trees). */
export const holdsCommit = (dir, sha) => {
    try { git(dir, ['cat-file', '-e', `${sha}^{commit}`]); return true; } catch { return false; }
};

export const readBlob = (dir, oid) => git(dir, ['cat-file', 'blob', oid], {encoding: 'buffer'});
