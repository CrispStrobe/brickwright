#!/usr/bin/env node
/**
 * Shared, content-keyed node_modules for LOCAL Lite worktrees (task C1).
 *
 * Every Lite worktree needs two installs: the root one (~130 MB, `npm ci`) and
 * packages/scratch-gui's (~0.9 GB fresh, 1.4-1.9 GB once builds add caches).
 * On a box with many concurrent worktrees that refills the disk. Borrowing
 * another worktree's node_modules (symlink or `cp -al`) saved the space but
 * silently used whatever that worktree had installed: stale bw-board /
 * bw-circuit-ui pins produced false local reds.
 *
 * This helper replaces both with a store keyed on the install's INPUTS:
 *
 *   <store>/<key>/root/node_modules   `npm ci`       over the root lockfile
 *   <store>/<key>/gui/node_modules    `npm install`  over packages/scratch-gui's
 *   <store>/<key>/manifest.json       inputs, versions, git-dep shas, digest
 *
 * The key hashes every file that decides the tree (see KEY_INPUTS) plus the
 * Node/npm majors and platform. Of vendor-pins.json it hashes ONLY the npm
 * git-sha deps (GIT_DEPS, pin-packages.mjs's PACKAGES): the other pins
 * (sb3-creator, stc-compiler-flasher, ...) are synced as files, not installed,
 * so keying them minted a new 1-1.8 GB store entry per unrelated pin bump
 * (task C6; five keys on 2026-10-05). The store is populated with the SAME commands
 * CI runs (.github/workflows/build.yml), in a staging dir, so a worktree's own
 * files are never rewritten by the install.
 *
 * WHY HARDLINKS, NOT SYMLINKS. A hardlink farm gives every worktree a real
 * node_modules directory at its usual path: node's resolver, webpack's
 * `include` rules, integrate.mjs and the apply-*-overlay scripts all see the
 * same paths as after a fresh install. A symlinked node_modules resolves to
 * the store's realpath instead, which moves `packages/scratch-gui/node_modules/
 * scratch-vm/src` out from under webpack's path rules — and the overlays would
 * write straight into the shared tree. Hardlinks share inodes, so a write
 * INTO a linked file would still mutate the store. Two guards close that:
 *   1. Store files and dirs are made read-only: an in-place write fails with
 *      EACCES instead of silently editing every worktree.
 *   2. The paths the repo's own scripts legitimately write (OWNED below: the
 *      apply-*-overlay targets) are materialised as private COPIES.
 * `verify` then re-derives a digest of the store (mode/size/mtime of every
 * entry) so a chmod-and-write is caught too.
 *
 *   node scripts/worktree-deps.mjs key               print the key and its inputs
 *   node scripts/worktree-deps.mjs link [--replace]  integrate, populate if needed,
 *                                                    link, apply overlays, verify
 *   node scripts/worktree-deps.mjs verify            prove this worktree's deps
 *                                                    match its lockfiles and pins
 *   node scripts/worktree-deps.mjs list              store keys, sizes, link state
 *   node scripts/worktree-deps.mjs gc [--days N] [--dry-run]
 *
 * Store location: $BW_LITE_DEPS_STORE, else `.bw-lite-deps` beside the main
 * checkout. It must be on the worktree's filesystem (hardlinks cannot cross).
 *
 * CI is not affected: nothing in .github/ calls this. It is a local tool.
 */
import {
    chmodSync, closeSync, copyFileSync, existsSync, linkSync, lstatSync, mkdirSync, openSync,
    readFileSync, readdirSync, readlinkSync, renameSync, rmSync, statSync, symlinkSync, utimesSync,
    writeFileSync
} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {PACKAGES} from './pin-packages.mjs';

const SCHEMA = 'bw-lite-deps/1';
export const MARKER = '.bw-lite-deps.json';

/** Where each install lives in a worktree, and its install command (CI's, byte for byte). */
export const TREES = [
    {id: 'root', dir: '.', args: ['ci', '--ignore-scripts', '--no-audit', '--no-fund']},
    {id: 'gui', dir: 'packages/scratch-gui',
        args: ['install', '--ignore-scripts', '--legacy-peer-deps', '--no-audit', '--no-fund']}
];

/**
 * Files that decide the installed trees. Each is hashed through keyText():
 * the gui pair with its derived bw-* entries dropped, vendor-pins.json
 * reduced to its GIT_DEPS entries.
 */
export const KEY_INPUTS = [
    'package.json', 'package-lock.json', 'vendor-pins.json',
    'packages/scratch-gui/package.json', 'packages/scratch-gui/package-lock.json'
];

/**
 * The git-sha npm dependencies whose spec is derived from vendor-pins.json:
 * pin-packages.mjs writes them into the root package.json and integrate.mjs
 * into packages/scratch-gui's (test/worktree-deps.test.mjs checks integrate's
 * list against this one). These, and only these, pins are installed by npm.
 */
export const GIT_DEPS = PACKAGES;

/**
 * Paths (relative to a tree's node_modules) the repo's own scripts write after
 * install: apply-vm-overlay (scratch-vm, and scratch-blocks' msg file it trims
 * in place), apply-paint-overlay, apply-render-overlay. They are copied, never
 * linked. test/worktree-deps.test.mjs checks this list against the scripts.
 */
export const OWNED = {
    root: [],
    gui: ['scratch-vm', 'scratch-paint', 'scratch-render', 'scratch-blocks/msg/scratch_msgs.js']
};

const OVERLAYS = ['scripts/apply-vm-overlay.mjs', 'scripts/apply-paint-overlay.mjs', 'scripts/apply-render-overlay.mjs'];

const sha256 = data => createHash('sha256').update(data).digest('hex');
const readJson = p => JSON.parse(readFileSync(p, 'utf8'));

/**
 * The gui package.json/lock as tracked still name whatever bw-* sha they were
 * last committed with; integrate.mjs rewrites the spec from vendor-pins.json
 * and `npm install` then rewrites the lock entry. Those entries are therefore
 * derived data: drop them, and vendor-pins.json's GIT_DEPS entries (keyed) carry the pin.
 * The key is then the same before and after integrate/install.
 */
export const normaliseGui = (name, text) => {
    const j = JSON.parse(text);
    if (name.endsWith('package.json')) {
        for (const k of ['dependencies', 'devDependencies']) for (const d of GIT_DEPS) if (j[k]) delete j[k][d];
    } else {
        const root = j.packages?.[''];
        for (const k of ['dependencies', 'devDependencies']) for (const d of GIT_DEPS) if (root?.[k]) delete root[k][d];
        for (const d of GIT_DEPS) if (j.packages) delete j.packages[`node_modules/${d}`];
    }
    return JSON.stringify(j);
};

/**
 * vendor-pins.json as the installs see it: only the GIT_DEPS entries. A pin
 * that is not an npm dependency changes no installed byte, so it must not
 * change the key; an npm pin must (the gui lock's own entry is normalised out).
 */
export const npmPins = text => {
    const pins = JSON.parse(text);
    return JSON.stringify(Object.fromEntries([...GIT_DEPS].sort().map(d => [d, pins[d] ?? null])));
};

/** The text of one KEY_INPUTS file that is hashed into the key. */
export const keyText = (rel, text) =>
    rel === 'vendor-pins.json' ? npmPins(text)
        : rel.startsWith('packages/scratch-gui/') ? normaliseGui(rel, text) : text;

/**
 * @param {string} wt worktree root
 * @param {{nodeMajor?: number, npmMajor?: number, platform?: string, arch?: string}} env
 */
export function computeKey (wt, env = {}) {
    const inputs = {};
    const h = createHash('sha256');
    h.update(SCHEMA + '\n');
    for (const rel of KEY_INPUTS) {
        const p = path.join(wt, rel);
        if (!existsSync(p)) throw new Error(`key input missing: ${rel}`);
        inputs[rel] = sha256(keyText(rel, readFileSync(p, 'utf8')));
        h.update(`${rel}\0${inputs[rel]}\n`);
    }
    const e = {
        nodeMajor: env.nodeMajor ?? Number(process.versions.node.split('.')[0]),
        npmMajor: env.npmMajor ?? npmMajor(),
        platform: env.platform ?? process.platform,
        arch: env.arch ?? process.arch,
        commands: TREES.map(t => `${t.id}: npm ${t.args.join(' ')}`).join('; ')
    };
    for (const [k, v] of Object.entries(e)) h.update(`${k}\0${v}\n`);
    return {key: h.digest('hex').slice(0, 24), inputs, env: e};
}

/** npm, run under the SAME node as this script (so the key's node major is the install's). */
const npmEnv = () => ({...process.env, PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH}`});
let npmMajorCache;
function npmMajor () {
    if (npmMajorCache === undefined) {
        const r = spawnSync('npm', ['-v'], {env: npmEnv(), encoding: 'utf8'});
        if (r.status !== 0) throw new Error('npm -v failed; is npm on PATH?');
        npmMajorCache = Number(r.stdout.trim().split('.')[0]);
    }
    return npmMajorCache;
}

// ---------------------------------------------------------------- tree walks

/** Every entry under dir, depth-first, sorted: [{rel, st}] (lstat, symlinks not followed). */
export function walk (dir) {
    const out = [];
    const rec = rel => {
        const names = readdirSync(path.join(dir, rel)).sort();
        for (const n of names) {
            const r = rel ? `${rel}/${n}` : n;
            const st = lstatSync(path.join(dir, r));
            out.push({rel: r, st});
            if (st.isDirectory()) rec(r);
        }
    };
    rec('');
    return out;
}

/** mode/size/mtime of every entry: changes if anything in the store is written, chmod-ed, added or removed. */
export function treeDigest (dir) {
    const h = createHash('sha256');
    let files = 0, bytes = 0;
    for (const {rel, st} of walk(dir)) {
        const kind = st.isDirectory() ? 'd' : st.isSymbolicLink() ? 'l' : 'f';
        const extra = kind === 'l' ? readlinkSync(path.join(dir, rel)) : kind === 'f' ? `${st.size}:${st.mtimeMs}` : '';
        h.update(`${kind}\0${rel}\0${(st.mode & 0o7777).toString(8)}\0${extra}\n`);
        if (kind === 'f') { files++; bytes += st.size; }
    }
    return {digest: h.digest('hex'), files, bytes};
}

const isOwned = (rel, owned) => owned.some(o => rel === o || rel.startsWith(o + '/'));
const ownedAncestor = (rel, owned) => owned.some(o => o.startsWith(rel + '/'));

/** Remove write bits everywhere under dir (files and dirs), bottom-up so the walk can finish. */
export function makeReadOnly (dir) {
    const entries = walk(dir).reverse();
    for (const {rel, st} of entries) if (!st.isSymbolicLink()) chmodSync(path.join(dir, rel), st.mode & 0o7555);
    chmodSync(dir, statSync(dir).mode & 0o7555);
}

/** Give write bits back to dirs (and files) so a tree can be removed. */
function makeWritable (dir) {
    if (!existsSync(dir)) return;
    const top = lstatSync(dir);
    if (top.isSymbolicLink()) return;
    chmodSync(dir, top.mode | 0o200);
    if (!top.isDirectory()) return;
    for (const {rel, st} of walk(dir)) if (st.isDirectory()) chmodSync(path.join(dir, rel), st.mode | 0o200);
}

export function removeTree (dir) {
    if (!existsSync(dir) && !isSymlink(dir)) return;
    if (isSymlink(dir)) { rmSync(dir); return; }     // never follow a borrowed symlink
    makeWritable(dir);
    rmSync(dir, {recursive: true, force: true});
}
const isSymlink = p => { try { return lstatSync(p).isSymbolicLink(); } catch { return false; } };

/**
 * Build dst as a hardlink farm of src: fresh (writable) dirs, hardlinked files,
 * re-created symlinks; OWNED paths copied (writable) instead of linked.
 */
export function linkTree (src, dst, owned = []) {
    mkdirSync(dst, {recursive: true});
    for (const {rel, st} of walk(src)) {
        const s = path.join(src, rel), d = path.join(dst, rel);
        if (st.isDirectory()) { mkdirSync(d, {recursive: true}); continue; }
        if (st.isSymbolicLink()) { symlinkSync(readlinkSync(s), d); continue; }
        if (isOwned(rel, owned)) { copyFileSync(s, d); chmodSync(d, (st.mode | 0o200) & 0o7777); continue; }
        linkSync(s, d);
    }
}

// ---------------------------------------------------------------- store

export function defaultStore (wt) {
    if (process.env.BW_LITE_DEPS_STORE) return path.resolve(process.env.BW_LITE_DEPS_STORE);
    const r = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {cwd: wt, encoding: 'utf8'});
    if (r.status !== 0) throw new Error('not a git checkout; set BW_LITE_DEPS_STORE');
    // <main checkout>/.git -> sibling of the main checkout
    return path.join(path.dirname(path.dirname(r.stdout.trim())), '.bw-lite-deps');
}

function assertSameFs (store, wt) {
    mkdirSync(store, {recursive: true});
    if (statSync(store).dev !== statSync(wt).dev) {
        throw new Error(`store ${store} is on a different filesystem from ${wt}; hardlinks cannot cross. ` +
            'Set BW_LITE_DEPS_STORE to a directory on the worktree\'s filesystem.');
    }
}

/** Installed version/resolved per package, from npm's hidden lockfile. */
function hiddenLock (nm) {
    const p = path.join(nm, '.package-lock.json');
    return existsSync(p) ? readJson(p).packages || {} : null;
}
const shaOf = resolved => (/#([0-9a-f]{40})$/.exec(resolved || '') || [])[1] || null;

function gitDepShas (nm) {
    const pk = hiddenLock(nm) || {};
    const out = {};
    for (const d of GIT_DEPS) out[d] = shaOf(pk[`node_modules/${d}`]?.resolved);
    return out;
}

function withLock (lockPath, fn) {
    const deadline = Date.now() + 30 * 60e3;
    for (;;) {
        try {
            const fd = openSync(lockPath, 'wx');
            writeFileSync(fd, String(process.pid));
            closeSync(fd);
            break;
        } catch (e) {
            if (e.code !== 'EEXIST') throw e;
            const pid = Number(readFileSync(lockPath, 'utf8')) || 0;
            let alive = false;
            try { if (pid) { process.kill(pid, 0); alive = true; } } catch {}
            if (!alive) { rmSync(lockPath, {force: true}); continue; }
            if (Date.now() > deadline) throw new Error(`timed out waiting for ${lockPath} (pid ${pid})`);
            spawnSync('sleep', ['5']);
        }
    }
    try { return fn(); } finally { rmSync(lockPath, {force: true}); }
}

/**
 * Make <store>/<key> exist. `install(stagingTreeDir, tree)` performs the install
 * (npm by default; the test injects a fake so it needs no network).
 */
export function populate (wt, store, k, {install = npmInstall, log = console.log} = {}) {
    const final = path.join(store, k.key);
    if (existsSync(path.join(final, 'manifest.json'))) return {final, created: false};
    return withLock(path.join(store, `${k.key}.lock`), () => {
        if (existsSync(path.join(final, 'manifest.json'))) return {final, created: false};
        const staging = path.join(store, `.staging-${k.key}-${process.pid}`);
        removeTree(staging);
        try {
            const manifest = {schema: SCHEMA, key: k.key, inputs: k.inputs, env: k.env,
                createdAt: new Date().toISOString(), owned: OWNED, trees: {}};
            for (const t of TREES) {
                const dir = path.join(staging, t.id);
                mkdirSync(dir, {recursive: true});
                for (const f of ['package.json', 'package-lock.json']) copyFileSync(path.join(wt, t.dir, f), path.join(dir, f));
                log(`  installing ${t.id} (npm ${t.args.join(' ')}) into the store staging dir`);
                install(dir, t);
                const nm = path.join(dir, 'node_modules');
                if (!existsSync(nm)) throw new Error(`${t.id}: install produced no node_modules`);
                rmSync(path.join(nm, '.cache'), {recursive: true, force: true});
                // The lock the install actually resolved (npm install may update it).
                copyFileSync(path.join(dir, 'package-lock.json'), path.join(dir, 'package-lock.installed.json'));
                makeReadOnly(nm);
                manifest.trees[t.id] = {...treeDigest(nm), gitDeps: gitDepShas(nm)};
            }
            writeFileSync(path.join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
            renameSync(staging, final);
            log(`  stored ${k.key} (${Object.values(manifest.trees).reduce((a, t) => a + t.files, 0)} files)`);
            return {final, created: true};
        } catch (e) {
            removeTree(staging);
            throw e;
        }
    });
}

function npmInstall (dir, t) {
    const r = spawnSync('npm', t.args, {cwd: dir, stdio: 'inherit', env: npmEnv()});
    if (r.status !== 0) throw new Error(`npm ${t.args.join(' ')} failed in ${dir}`);
}

const touch = p => { const now = new Date(); try { utimesSync(p, now, now); } catch { writeFileSync(p, ''); } };

/**
 * Link a worktree to <store>/<key>. Refuses to discard an existing private or
 * borrowed node_modules unless `replace` is set.
 */
export function link (wt, store, k, {replace = false, log = console.log} = {}) {
    const final = path.join(store, k.key);
    const plan = [];
    for (const t of TREES) {
        const dst = path.join(wt, t.dir, 'node_modules');
        const markerOwner = path.join(wt, 'node_modules', MARKER);
        const ours = existsSync(markerOwner);
        if ((existsSync(dst) || isSymlink(dst)) && !ours && !replace) {
            throw new Error(`${path.relative(wt, dst) || dst} already exists (a private install or a borrowed tree). ` +
                'Re-run with --replace to discard it and link the shared store instead.');
        }
        plan.push({t, dst, src: path.join(final, t.id, 'node_modules')});
    }
    for (const {t, dst, src} of plan) {
        const tmp = `${dst}.bw-linking-${process.pid}`;
        removeTree(tmp);
        log(`  linking ${path.relative(wt, dst)}`);
        linkTree(src, tmp, OWNED[t.id]);
        removeTree(dst);
        renameSync(tmp, dst);
    }
    writeFileSync(path.join(wt, 'node_modules', MARKER),
        JSON.stringify({key: k.key, store, linkedAt: new Date().toISOString()}, null, 2) + '\n');
    touch(path.join(final, 'last-used'));
}

// ---------------------------------------------------------------- verify

/**
 * Prove a worktree's installed deps match its current inputs. Works on a
 * linked worktree (full proof) and on a private/borrowed one (lock + pin check).
 * @returns {{ok: boolean, linked: boolean, problems: string[], notes: string[]}}
 */
export function verify (wt, {store, k} = {}) {
    const problems = [], notes = [];
    const pins = readJson(path.join(wt, 'vendor-pins.json'));
    const markerPath = path.join(wt, 'node_modules', MARKER);
    const linked = existsSync(markerPath);
    const remedyLink = 'node scripts/worktree-deps.mjs link' + (linked ? '' : ' --replace');

    for (const t of TREES) {
        const nm = path.join(wt, t.dir, 'node_modules');
        if (!existsSync(nm)) { problems.push(`${t.id}: ${path.relative(wt, nm) || 'node_modules'} is missing`); continue; }
        if (isSymlink(nm)) problems.push(`${t.id}: ${path.relative(wt, nm)} is a SYMLINK (a borrowed tree): its versions follow another checkout`);
        const installed = hiddenLock(nm);
        if (!installed) { problems.push(`${t.id}: no node_modules/.package-lock.json; cannot tell what is installed`); continue; }
        // git-sha deps: vendor-pins.json is the authority (integrate.mjs derives the spec from it).
        for (const d of GIT_DEPS) {
            const e = installed[`node_modules/${d}`];
            if (!e) { if (t.id === 'gui' || readJson(path.join(wt, 'package.json')).devDependencies?.[d]) problems.push(`${t.id}: ${d} is not installed`); continue; }
            const got = shaOf(e.resolved);
            if (got !== pins[d]) problems.push(`${t.id}: ${d} installed at ${got || e.resolved} but vendor-pins.json pins ${pins[d]}`);
        }
        // Every other locked package: installed version equals the lockfile's.
        const lock = readJson(path.join(wt, t.dir, 'package-lock.json')).packages || {};
        let bad = 0;
        const sample = [];
        for (const [key, want] of Object.entries(lock)) {
            if (!key.startsWith('node_modules/') || want.link) continue;
            if (GIT_DEPS.some(d => key === `node_modules/${d}`)) continue;
            const got = installed[key];
            if (!got) {
                if (want.optional || want.devOptional || want.peer) continue;
                // gui: `npm install` may re-resolve after integrate moves a bw-* pin.
                if (t.id === 'gui') { notes.push(`gui: ${key} locked but not installed`); continue; }
                bad++; if (sample.length < 5) sample.push(`${key} missing`); continue;
            }
            if (want.version && got.version !== want.version) { bad++; if (sample.length < 5) sample.push(`${key} ${got.version} != locked ${want.version}`); }
        }
        if (bad) problems.push(`${t.id}: ${bad} package(s) differ from ${path.join(t.dir, 'package-lock.json')}: ${sample.join('; ')}`);
    }

    if (linked) {
        const marker = readJson(markerPath);
        const storeDir = store || marker.store;
        const cur = k || computeKey(wt);
        if (marker.key !== cur.key) {
            problems.push(`STALE: linked to store key ${marker.key} but this worktree's lockfiles/pins now key to ${cur.key}`);
        }
        const final = path.join(storeDir, marker.key);
        const mf = path.join(final, 'manifest.json');
        if (!existsSync(mf)) problems.push(`store entry ${final} is gone (garbage-collected or moved)`);
        else {
            const manifest = readJson(mf);
            for (const t of TREES) {
                const src = path.join(final, t.id, 'node_modules');
                const now = treeDigest(src);
                if (now.digest !== manifest.trees[t.id].digest) {
                    problems.push(`STORE MODIFIED: ${src} no longer matches its manifest (something wrote through a hardlink). ` +
                        `Remove it: node scripts/worktree-deps.mjs gc --evict ${marker.key}`);
                }
                // Each non-owned store file must be the SAME inode in the worktree.
                const dst = path.join(wt, t.dir, 'node_modules');
                let diverged = 0, missing = 0;
                const sample = [];
                for (const {rel, st} of walk(src)) {
                    if (!st.isFile() || isOwned(rel, OWNED[t.id])) continue;
                    let wst;
                    try { wst = lstatSync(path.join(dst, rel)); } catch { missing++; if (sample.length < 5) sample.push(`${rel} missing`); continue; }
                    if (wst.ino !== st.ino || wst.dev !== st.dev) { diverged++; if (sample.length < 5) sample.push(`${rel} not linked`); }
                }
                if (missing || diverged) problems.push(`${t.id}: ${missing} missing / ${diverged} unlinked file(s) vs the store: ${sample.join('; ')}`);
                for (const o of OWNED[t.id]) if (!existsSync(path.join(dst, o))) problems.push(`${t.id}: owned copy ${o} is missing`);
            }
            touch(path.join(final, 'last-used'));
        }
        notes.push(`linked to ${final}`);
    } else {
        notes.push('not linked to the shared store (private install): checked lockfiles and pins only');
    }
    if (problems.length) notes.push(`remedy: ${remedyLink}`);
    return {ok: problems.length === 0, linked, problems, notes};
}

// ---------------------------------------------------------------- gc

/** A store entry is in use while any of its files still has another hardlink. */
export function inUse (final) {
    for (const t of TREES) {
        const nm = path.join(final, t.id, 'node_modules');
        if (!existsSync(nm)) continue;
        for (const {st} of walk(nm)) if (st.isFile() && st.nlink > 1) return true;
    }
    return false;
}

export function gc (store, {days = 14, dryRun = false, evict = null, now = Date.now(), log = console.log} = {}) {
    const out = {evicted: [], kept: []};
    if (!existsSync(store)) return out;
    for (const name of readdirSync(store).sort()) {
        const final = path.join(store, name);
        if (name.startsWith('.staging-')) {
            const pid = Number(name.split('-').pop());
            let alive = false;
            try { process.kill(pid, 0); alive = true; } catch {}
            if (!alive) { if (!dryRun) removeTree(final); out.evicted.push(name); }
            continue;
        }
        if (!existsSync(path.join(final, 'manifest.json'))) {
            // A pid lock (<key>.lock) or something foreign: never removed, but reported.
            out.kept.push(`${name} (not a store entry: no manifest.json)`);
            continue;
        }
        const lu = path.join(final, 'last-used');
        const last = existsSync(lu) ? statSync(lu).mtimeMs : statSync(path.join(final, 'manifest.json')).mtimeMs;
        const idleDays = (now - last) / 86400e3;
        const forced = evict === name;
        if (!forced && idleDays < days) { out.kept.push(`${name} (used ${idleDays.toFixed(1)} d ago)`); continue; }
        if (inUse(final)) {
            // A MODIFIED store entry is evictable even while linked: its links are already wrong.
            if (!forced) { out.kept.push(`${name} (idle ${idleDays.toFixed(1)} d, still linked by a worktree)`); continue; }
            log(`  ${name} is still linked; evicting it anyway (--evict). Re-link those worktrees.`);
        }
        if (!dryRun) removeTree(final);
        out.evicted.push(name);
    }
    return out;
}

// ---------------------------------------------------------------- CLI

function runNode (wt, script) {
    const r = spawnSync(process.execPath, [script], {cwd: wt, stdio: 'inherit'});
    if (r.status !== 0) throw new Error(`${script} failed (exit ${r.status})`);
}

function main (argv) {
    const [cmd, ...rest] = argv;
    const flag = f => rest.includes(f);
    const opt = (f, d) => { const i = rest.indexOf(f); return i >= 0 ? rest[i + 1] : d; };
    const wt = path.resolve(opt('--worktree', process.cwd()));
    const store = opt('--store') ? path.resolve(opt('--store')) : defaultStore(wt);

    if (cmd === 'key') {
        const k = computeKey(wt);
        console.log(JSON.stringify({...k, store}, null, 2));
        return 0;
    }
    if (cmd === 'link') {
        if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('run with Node 22 (the store is keyed on the Node major, and CI is 22)');
        assertSameFs(store, wt);
        if (!flag('--no-integrate')) runNode(wt, 'scripts/integrate.mjs');
        const k = computeKey(wt);
        console.log(`deps key ${k.key} (store ${store})`);
        populate(wt, store, k);
        link(wt, store, k, {replace: flag('--replace')});
        if (!flag('--no-overlays')) for (const s of OVERLAYS) runNode(wt, s);
        const v = verify(wt, {store, k});
        report(v);
        return v.ok ? 0 : 1;
    }
    if (cmd === 'verify') {
        const v = verify(wt, {store: opt('--store') ? store : undefined});
        report(v);
        return v.ok ? 0 : 1;
    }
    if (cmd === 'list') {
        if (!existsSync(store)) { console.log(`(empty) ${store}`); return 0; }
        for (const name of readdirSync(store).sort()) {
            const mf = path.join(store, name, 'manifest.json');
            if (!existsSync(mf)) { console.log(`${name}  (not a store entry: no manifest.json)`); continue; }
            const m = readJson(mf);
            const mb = Object.values(m.trees).reduce((a, t) => a + t.bytes, 0) / 1e6;
            console.log(`${name}  ${mb.toFixed(0)} MB  created ${m.createdAt}  ${inUse(path.join(store, name)) ? 'LINKED' : 'unlinked'}  ` +
                `bw-board ${m.trees.gui.gitDeps['bw-board']?.slice(0, 9)} bw-circuit-ui ${m.trees.gui.gitDeps['bw-circuit-ui']?.slice(0, 9)}`);
        }
        return 0;
    }
    if (cmd === 'gc') {
        const r = gc(store, {days: Number(opt('--days', 14)), dryRun: flag('--dry-run'), evict: opt('--evict', null)});
        for (const e of r.evicted) console.log(`${flag('--dry-run') ? 'would evict' : 'evicted'} ${e}`);
        for (const e of r.kept) console.log(`kept ${e}`);
        return 0;
    }
    console.error('usage: node scripts/worktree-deps.mjs key|link [--replace] [--no-integrate] [--no-overlays]|verify|list|gc [--days N] [--dry-run] [--evict KEY]  [--store DIR] [--worktree DIR]');
    return 2;
}

function report (v) {
    for (const p of v.problems) console.error(`  ✗ ${p}`);
    for (const n of v.notes) console.log(`  · ${n}`);
    console.log(v.ok ? 'worktree-deps: OK — installed deps match this worktree\'s lockfiles and vendor-pins.json'
        : 'worktree-deps: FAILED — do not trust local test results from this tree until fixed');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
    try { process.exitCode = main(process.argv.slice(2)); } catch (e) { console.error(`worktree-deps: ${e.message}`); process.exitCode = 1; }
}
