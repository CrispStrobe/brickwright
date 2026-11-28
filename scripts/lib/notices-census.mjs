/**
 * THE SHIPPING SET, DERIVED — what THIRD-PARTY-NOTICES.md has to name.
 *
 * Measured 2026-09-07 (plan T10): five shipped third-party things had no
 * notice — jszip, skulpt, lit + @lit/react, emu8051, and the MicroPython
 * RP2040 firmware the build fetches into static/ — and no test could have
 * said so, because the one notices test keeps a hand-typed list of vendored
 * things, which is exactly the list a forgotten dependency is not on.
 *
 * Four sources, each read from the thing that does the shipping:
 *   1. NPM DEPENDENCIES LITE ADDS: every `pkg.dependencies[...] =` in
 *      scripts/integrate.mjs — the code that adds them to the vendored GUI.
 *      Upstream scratch-gui's own dependencies are not re-listed (the
 *      notices state that rule themselves); the frozen Scratch stack is
 *      checked as bullets in the JavaScript section. The licence and holder
 *      come from the installed package.json when node_modules is present.
 *   2. VENDORED TREES: vendor-pins.json keys, LICENSE files under overlay's
 *      lib/, and `VENDORED from <owner>/<repo>` headers.
 *   3. ROMS: every file under static/roms that is not source or a manifest.
 *      Covered by a provenance manifest naming its source repo, or named in
 *      the notices by filename.
 *   4. TOOLCHAINS AND FETCHED ARTIFACTS: every directory under overlay's lib/
 *      holding a .wasm, and every scripts/sync-*.mjs that writes under
 *      static/ — such a script must `export const NOTICE = {...}` (strict
 *      JSON) saying what it ships; a static-writing sync without one is red.
 *
 * Exempt BY ROLE, each stated: OWN CODE — a vendored tree or header whose
 * copyright holder / upstream owner is this repository's owner needs no
 * third-party notice (the notices' "Our own code" section may still list it);
 * UPSTREAM-TRANSITIVE — scratch-gui's own dependency graph, by the notices'
 * stated rule; TEST FIXTURES under static/test-fixtures; DEV-ONLY packages.
 *
 * The limit, stated: this sees what the shipping SCRIPTS and MANIFESTS say.
 * A binary dropped into static/ by hand with no manifest and no sync script
 * is seen only if it is a ROM; fonts ship through an upstream package and are
 * the owner's open question, not this gate's.
 */
import {registeredArraysSource} from './arrays-carrier.mjs';
import {readFileSync, readdirSync, existsSync, statSync} from 'node:fs';
import path from 'node:path';

const LIB = 'overlay/scratch-gui/src/lib';
const ROMS = 'overlay/scratch-gui/static/roms';
// Scoped artifact pins name shipped bundles rather than whole vendored trees.
const SCOPED_BUNDLES = {
    devices: 'overlay/scratch-vm/src/extensions/crispstrobe/devices/index.js',
    stc12: 'overlay/scratch-vm/src/extensions/crispstrobe/stc12/index.js',
    spikeprime: 'overlay/scratch-vm/src/extensions/crispstrobe/spikeprime/index.js',
    'arrays-values': 'overlay/scratch-vm/src/extensions/crispstrobe/arrays/index.js',
    circuitplayground: 'overlay/scratch-vm/src/extensions/crispstrobe/circuitplayground/index.js',
    wedo2unified: 'overlay/scratch-vm/src/extensions/crispstrobe/wedo2unified/index.js',
    ev3comprehensive: 'overlay/scratch-vm/src/extensions/crispstrobe/ev3comprehensive/index.js',
    legoboostunified: 'overlay/scratch-vm/src/extensions/crispstrobe/legoboostunified/index.js',
    legonxt: 'overlay/scratch-vm/src/extensions/crispstrobe/legonxt/index.js',
    legopoweredup: 'overlay/scratch-vm/src/extensions/crispstrobe/legopoweredup/index.js'
};

/** Licence id from a LICENSE text or package.json `license` string. */
export const licenceId = text => {
    const t = String(text || '');
    if (/Mozilla Public License,? v\. ?2\.0|MPL-2\.0/i.test(t)) return 'MPL-2.0';
    if (/Apache License,? Version 2\.0|Apache-2\.0/i.test(t)) return 'Apache-2.0';
    if (/GNU GENERAL PUBLIC LICENSE|GPL-?[23]/i.test(t)) return (t.match(/GPL-[23]\.0(?:-or-later)?/) || ['GPL'])[0];
    if (/BSD-3-Clause|Neither the name of/i.test(t)) return 'BSD-3-Clause';
    if (/BSD-2-Clause/i.test(t)) return 'BSD-2-Clause';
    if (/\bMIT\b/.test(t)) return 'MIT';
    if (/zlib/i.test(t)) return 'zlib';
    if (/public domain/i.test(t)) return 'Public Domain';
    return null;
};
// A COPYRIGHT LINE, NOT THE WORD ANYWHERE IN THE TEXT.
//
// This matched `/Copyright.../i` unanchored, which is fine for a short MIT or
// BSD notice and wrong for a full licence body. MPL-2.0 section 2.6 reads
// "copyright doctrines of fair use, fair dealing, or other equivalents" and
// section 3.4 "including copyright notices" -- so the first match in the MPL
// text is prose, and the holder came back as
// "doctrines of fair use, fair dealing, or other".
//
// Found 2026-09-11, the day bw-circuit-ui's vendored LICENSE stopped being a
// five-line pointer and became the licence upstream actually ships. The bug was
// always there; nothing had ever handed this function a real licence body.
//
// `^` with the m flag: a copyright NOTICE starts its line. MPL carries none of
// its own, and `null` is the right answer for it rather than a sentence from
// section 2.6.
export const holderOf = text => (String(text || '').match(/^[ \t]*Copyright\s*(?:\(c\)|©)?\s*(?:[\d,\s–-]+)?\s*([^\n]+)/im) || [])[1]?.replace(/^\d[\d,\s–-]*/, '').trim() || null;

/** 1. npm dependencies integrate.mjs adds — from the adder itself. */
export const liteAddedDeps = (root, integrateText = readFileSync(path.join(root, 'scripts/integrate.mjs'), 'utf8')) => {
    const names = [...new Set([...integrateText.matchAll(/pkg\.dependencies(?:\.([\w-]+)|\['([^']+)'\])\s*=/g)].map(m => m[1] || m[2]))];
    return names.map(name => {
        const pj = path.join(root, 'packages/scratch-gui/node_modules', name, 'package.json');
        let licence = null, holder = null, version = null;
        if (existsSync(pj)) {
            try { const j = JSON.parse(readFileSync(pj, 'utf8')); version = j.version; licence = typeof j.license === 'string' ? j.license : (j.license && j.license.type) || null; holder = (j.author && (j.author.name || j.author)) || null; } catch { /* unreadable: name-only */ }
            if (typeof holder === 'string') holder = holder.replace(/<[^>]*>/, '').trim();
        }
        const frozen = /^scratch-/.test(name);
        return {kind: frozen ? 'frozen-stack' : 'npm', name, version, licence, holder};
    });
};

/** Pins whose upstream is vendored whole as a workspace package directory. */
export const PACKAGE_TREES = Object.freeze({crispbasic: 'packages/crisp-basic'});

/** 2. vendored trees: pins, LICENSE files, VENDORED headers. */
export const vendoredTrees = (root, owner) => {
    const out = [];
    const pins = existsSync(path.join(root, 'vendor-pins.json')) ? JSON.parse(readFileSync(path.join(root, 'vendor-pins.json'), 'utf8')) : {};
    const libDir = path.join(root, LIB);
    const entries = existsSync(libDir) ? readdirSync(libDir, {withFileTypes: true}) : [];
    for (const e of entries) {
        if (e.isDirectory() && existsSync(path.join(libDir, e.name, 'LICENSE'))) {
            const text = readFileSync(path.join(libDir, e.name, 'LICENSE'), 'utf8');
            out.push({kind: 'vendored-tree', name: e.name, licence: licenceId(text), holder: holderOf(text), evidence: `${LIB}/${e.name}/LICENSE`, pinned: e.name in pins});
        }
        const m = e.isFile() && e.name.match(/^(.+)-LICENSE$/);
        if (m) {
            const text = readFileSync(path.join(libDir, e.name), 'utf8');
            out.push({kind: 'vendored-tree', name: m[1], licence: licenceId(text), holder: holderOf(text), evidence: `${LIB}/${e.name}`, pinned: m[1] in pins});
        }
    }
    // VENDORED from <owner>/<repo> headers (first 3 lines of any lib file)
    const walk = dir => readdirSync(dir, {withFileTypes: true}).flatMap(d => { const p = path.join(dir, d.name); return d.isDirectory() ? (d.name === 'node_modules' ? [] : walk(p)) : (/\.(m?js|jsx)$/.test(d.name) ? [p] : []); });
    for (const f of (existsSync(libDir) ? walk(libDir) : [])) {
        const head = readFileSync(f, 'utf8').split('\n').slice(0, 3).join('\n');
        const v = head.match(/VENDORED from ([\w.-]+)\/([\w.-]+)/i);
        if (v) out.push({kind: 'vendored-file', name: v[2], upstreamOwner: v[1], evidence: path.relative(root, f).replace(/\\/g, '/'), licence: null, holder: null});
    }
    for (const [name] of Object.entries(pins)) {
        if (out.some(o => o.name === name || o.name === name.replace(/-flasher$/, ''))) continue;
        if (SCOPED_BUNDLES[name]) {
            const evidence = SCOPED_BUNDLES[name];
            const file = path.join(root, evidence);
            if (!existsSync(file)) throw new Error(`Scoped pin ${name} has no shipped bundle: ${evidence}`);
            const encoded = readFileSync(file, 'utf8').match(/module\.exports\s*=\s*makeExt\(("(?:\\.|[^"\\])*")\);?/);
            if (!encoded && name !== 'arrays-values') throw new Error(`Scoped pin ${name} has an unreadable bundle: ${evidence}`);
            const header = (name === 'arrays-values' ? registeredArraysSource(readFileSync(file, 'utf8')) : JSON.parse(encoded[1]))?.split('\n').slice(0, 8).join('\n');
            if (typeof header !== 'string') throw new Error(`Scoped pin ${name} has an unreadable registered bundle: ${evidence}`);
            const licence = licenceId(header);
            if (!licence) throw new Error(`Scoped pin ${name} has no readable source licence: ${evidence}`);
            // These sources declare their authors in By headers, not copyright
            // notice. Retain that attribution without changing holderOf or
            // turning it into an own-code exemption.
            const needsAuthor = ['devices', 'stc12', 'wedo2unified', 'spikeprime', 'ev3comprehensive', 'legoboostunified', 'legonxt', 'legopoweredup'].includes(name);
            const author = needsAuthor ?
                header.match(/^[ \t]*\/\/[ \t]*By:[ \t]*([^<\n]+)/m)?.[1].trim() : null;
            if (needsAuthor && !author) throw new Error(`Scoped pin ${name} has no readable source author: ${evidence}`);
            out.push({kind:'vendored-tree', name, licence, holder:holderOf(header), author, evidence, pinned:true});
            continue;
        }
        // A pinned upstream vendored as a whole workspace PACKAGE tree
        // (crispbasic since 2026-11-28: packages/crisp-basic, byte-identical to
        // CrispStrobe/crispbasic at the pin) ships its LICENSE at that root.
        if (PACKAGE_TREES[name]) {
            const evidence = `${PACKAGE_TREES[name]}/LICENSE`;
            const file = path.join(root, evidence);
            if (!existsSync(file)) throw new Error(`Pinned package tree ${name} has no LICENSE: ${evidence}`);
            const text = readFileSync(file, 'utf8');
            out.push({kind: 'vendored-tree', name, licence: licenceId(text), holder: holderOf(text), evidence, pinned: true});
            continue;
        }
        // A pinned upstream taken as an npm PACKAGE (bw-board, bw-circuit-ui since
        // 2026-09-12) ships its LICENSE inside node_modules, not under lib/.
        const pkgLicence = path.join(root, 'node_modules', name, 'LICENSE');
        if (existsSync(pkgLicence)) {
            const text = readFileSync(pkgLicence, 'utf8');
            out.push({kind: 'vendored-tree', name, licence: licenceId(text), holder: holderOf(text), evidence: `node_modules/${name}/LICENSE`, pinned: true});
            continue;
        }
        out.push({kind: 'vendored-tree', name, licence: null, holder: null, evidence: 'vendor-pins.json', pinned: true});
    }
    for (const o of out) o.own = Boolean(owner) && (String(o.holder || '').includes(owner) || o.upstreamOwner === owner);
    return out;
};

/** 3. ROMs and what covers each. */
export const roms = root => {
    const dir = path.join(root, ROMS);
    if (!existsSync(dir)) return [];
    const files = readdirSync(dir);
    const manifests = files.filter(f => f.endsWith('.provenance.json')).map(f => { try { return {file: f, ...JSON.parse(readFileSync(path.join(dir, f), 'utf8'))}; } catch { return {file: f}; } });
    const covered = new Map();
    for (const m of manifests) {
        const repo = (m.source && m.source.repo) || (m.note && (m.note.match(/vendored from ([\w-]+)/i) || [])[1]) || null;
        if (m.rom) covered.set(m.rom, {manifest: m.file, repo});
        for (const r of m.roms || []) if (r.rom) covered.set(r.rom, {manifest: m.file, repo});
    }
    return files.filter(f => !/\.(asm|provenance\.json)$/.test(f)).map(f => ({kind: 'rom', name: f, evidence: `${ROMS}/${f}`, ...(covered.get(f) || {manifest: null, repo: null})}));
};

/** 4a. every lib/ directory holding a .wasm. */
export const wasmToolchains = root => {
    const libDir = path.join(root, LIB);
    if (!existsSync(libDir)) return [];
    const out = new Map();
    const walk = dir => { for (const d of readdirSync(dir, {withFileTypes: true})) { const p = path.join(dir, d.name); if (d.isDirectory()) { if (d.name !== 'node_modules') walk(p); } else if (d.name.endsWith('.wasm')) { const top = path.relative(libDir, p).split(path.sep)[0]; if (!out.has(top)) out.set(top, {kind: 'wasm', name: top.replace(/-wasm$/, ''), dir: `${LIB}/${top}`, files: []}); out.get(top).files.push(d.name); } } };
    walk(libDir);
    return [...out.values()];
};

/** The `export const NOTICE = {...}` literal, by brace matching (a JSON string may hold a brace; a lazy regex would stop at it). */
export const noticeLiteral = text => {
    const at = text.indexOf('export const NOTICE = {');
    if (at < 0) return null;
    let depth = 0, inStr = false, esc = false;
    for (let k = text.indexOf('{', at); k < text.length; k++) {
        const ch = text[k];
        if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
        if (ch === '"') inStr = true;
        else if (ch === '{') depth++;
        else if (ch === '}') { depth--; if (depth === 0) return text.slice(text.indexOf('{', at), k + 1); }
    }
    return null;
};

/** 4b. sync scripts that write a fetched artifact under static/ — each must declare NOTICE. */
export const fetchedArtifacts = root => {
    const dir = path.join(root, 'scripts');
    return readdirSync(dir).filter(f => /^sync-.*\.mjs$/.test(f)).map(f => {
        const text = readFileSync(path.join(dir, f), 'utf8');
        const code = text.replace(/^\s*(\/\/|\*|\/\*).*$/gm, '');
        // a sync that names a static/ destination places something the app serves; whether
        // the bytes arrive by fetch here or through a module it imports does not matter
        const writesStatic = /(packages\/scratch-gui\/static|overlay\/scratch-gui\/static|['"`]static['"`]|static\/[a-z-]+)/.test(code);
        const lit = noticeLiteral(text);
        let notice = null, noticeError = null;
        if (lit) { try { notice = JSON.parse(lit); } catch (e) { noticeError = e.message; } }
        return {kind: 'fetched', script: `scripts/${f}`, writesStatic, notice, noticeError};
    }).filter(a => a.writesStatic || a.notice);
};

// ---- the notices, read -----------------------------------------------------

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Section (heading + body) of the notices whose heading names `name` (word, case-insensitive; scope and -wasm stripped). */
export const sectionFor = (notices, name) => {
    // "@wokwi/elements" is named "wokwi-elements"; "@codemirror/lang-cpp" by its
    // family "CodeMirror"; "@lit/react" under "lit". Try the full name, then
    // scope-name, then the scope, then the bare name; "-wasm" is a packaging suffix.
    const m = name.match(/^@([^/]+)\/(.+)$/);
    const candidates = [...new Set((m ? [name, `${m[1]}-${m[2]}`, m[1], m[2]] : [name, name.replace(/-wasm$/, '')]))];
    const lines = notices.split('\n');
    const heads = lines.map((l, i) => [l, i]).filter(([l]) => /^#{2,3} /.test(l));
    let hit = null;
    // a hyphen may FOLLOW the name ("labwired-core"), never precede it ("bw-board" is not "board")
    // exact word first ("MicroPython for RP2040" must not land on "micropython-microbit-…"), then hyphen-suffixed
    for (const strict of [true, false]) {
        for (const c of candidates) { const re = new RegExp(`(^|[^\\w@/.-])${escapeRe(c)}(${strict ? '[^\\w-]' : '[^\\w]'}|$)`, 'i'); hit = heads.find(([l]) => re.test(l)); if (hit) break; }
        if (hit) break;
    }
    if (!hit) return null;
    const next = heads.find(([, i]) => i > hit[1]);
    return lines.slice(hit[1], next ? next[1] : lines.length).join('\n');
};
const licenceRe = id => id === 'Public Domain' ? /public domain/i : new RegExp(escapeRe(id).replace(/\\-/g, '[- ]?').replace(/Clause/i, 'Clause'), 'i');

/**
 * Judge the derived set against the notices. Pure; returns findings by name.
 * @param {{notices: string, owner: string, items: object[]}} input
 */
export const judge = ({notices, owner, items}) => {
    const findings = [];
    const flat = s => String(s).replace(/\s+/g, ' ');
    const names = (sec, holder) => flat(sec).includes(flat(holder));
    for (const it of items) {
        if (it.kind === 'frozen-stack') {
            if (!new RegExp(`^- ${escapeRe(it.name)} `, 'm').test(notices)) findings.push(`${it.name}: frozen Scratch stack package not in the JavaScript section's list`);
            continue;
        }
        if (it.kind === 'rom') {
            const ownRepo = it.repo && (owner ? new RegExp(escapeRe(owner), 'i').test(it.repo) || ['bw-board', 'sb3-creator', 'bw-circuit-ui'].includes(it.repo) : false);
            if (ownRepo) continue; // own code: a manifest naming the owner's repo
            if (!notices.includes(it.name)) findings.push(`${it.evidence}: shipped ROM with ${it.manifest ? `a manifest naming ${it.repo}` : 'no provenance manifest'} and no notice naming the file`);
            continue;
        }
        if (it.kind === 'fetched') {
            if (!it.notice) { findings.push(`${it.script}: writes a fetched artifact under static/ and declares no \`export const NOTICE = {...}\` (${it.noticeError || 'absent'})`); continue; }
            const {name, licence, holder} = it.notice;
            if (holder && owner && holder.includes(owner)) continue; // own artifact
            const sec = sectionFor(notices, name);
            if (!sec) { findings.push(`${it.script} ships ${name} (${licence}, ${holder}) and no notices heading names it`); continue; }
            if (licence && !licenceRe(licence).test(sec)) findings.push(`${name}: the notices section does not state ${licence}`);
            if (holder && !names(sec, holder)) findings.push(`${name}: the notices section does not name the holder ${holder}`);
            continue;
        }
        if (it.own) continue; // vendored from the owner's own repo, or holder is the owner
        const sec = sectionFor(notices, it.name);
        if (!sec) { findings.push(`${it.name} (${it.kind}${it.evidence ? `, ${it.evidence}` : ''}${it.version ? `, ${it.version}` : ''}): shipped, ${it.licence || 'licence unread'}, and no notices heading names it`); continue; }
        if (it.licence) {
            const ids = it.licence.split(/\s+OR\s+/i).map(s => s.replace(/^\(|\)$/g, ''));
            if (!ids.some(id => licenceRe(id).test(sec))) findings.push(`${it.name}: the notices section does not state its licence (${it.licence})`);
        }
        if (it.holder && !names(sec, it.holder) && !names(sec, it.holder.split(' ')[0])) findings.push(`${it.name}: the notices section does not name the holder ${it.holder}`);
        if (it.author && !names(sec, it.author)) findings.push(`${it.name}: the notices section does not name the declared author ${it.author}`);
    }
    return findings;
};

export const censusAll = (root, owner) => [
    ...liteAddedDeps(root), ...vendoredTrees(root, owner), ...roms(root), ...wasmToolchains(root), ...fetchedArtifacts(root)
];
