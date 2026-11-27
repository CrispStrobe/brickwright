#!/usr/bin/env node
// Static-asset provenance transaction for records vendored from bw-board.
//
// These records (DOS base image, CP/M ROMs, free 386 BIOS) have no producer of
// their own: their binaries are retained, and only `bwBoardPin` follows the
// package pin. When the pin moves, every record is re-admitted together, or
// the whole transaction refuses by name BEFORE anything is written:
//   - every overlay static record declaring `bwBoardPin` must be registered
//     here (omission), and every registered record must exist;
//   - every retained asset must match its recorded byte count and sha256;
//   - every supplier-vendored asset must be byte-identical to the supplier's
//     Git blob at the target pin (read from objects; no fetch, no rebuild);
//   - construction inputs of a retained image must be unchanged between the
//     recorded pin and the target pin;
//   - tracked package mirrors must equal their overlay record.
// Only the `bwBoardPin` value changes; licences, notes and hashes stay as-is.
//
//   node scripts/admit-static-provenance.mjs --dir <bw-board clone>   # admit to vendor-pins.json
//   node scripts/admit-static-provenance.mjs --check                  # offline: pin, bytes, mirrors
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OVERLAY = 'overlay/scratch-gui';
const PACKAGES = 'packages/scratch-gui';

export const STATIC_RECORDS = Object.freeze([
    {
        record: 'static/dos/msdos200-base.provenance.json', trackedMirror: true,
        assets: [{file: 'static/dos/msdos200-base.img', key: 'image'}],
        // The image is retained, not rebuilt: its bw-board construction inputs must not move.
        inputs: ['dos/iosys.asm', 'scripts/build-dos-image.mjs', 'scripts/fetch-free-dos.mjs']
    },
    {
        record: 'static/roms/cpm-roms.provenance.json', trackedMirror: true,
        assets: [
            {file: 'static/roms/cpm22-64k.bin', supplier: 'roms/cpm/cpm22-64k.bin'},
            {file: 'static/roms/cpm-bios.bin', supplier: 'roms/cpm/bios.bin'},
            {file: 'static/roms/cpm-bios-vdp.bin', supplier: 'roms/cpm/bios-vdp.bin'}
        ]
    },
    {
        // The package mirror is git-ignored; integrate refreshes it, it is never force-added.
        record: 'static/roms/free-386-bios.provenance.json', trackedMirror: false,
        assets: [
            {file: 'static/roms/free-386-bochs-bios.rom', supplier: 'roms/free-at-bios/BIOS-bochs-legacy'},
            {file: 'static/roms/free-386-vgabios-lgpl.bin', supplier: 'roms/free-at-bios/vgabios-lgpl.bin'}
        ]
    }
]);

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const PIN = /^[0-9a-f]{40}$/;

function pinnedBoard (root) {
    const pin = JSON.parse(readFileSync(path.join(root, 'vendor-pins.json'), 'utf8'))['bw-board'];
    if (!PIN.test(pin || '')) throw new Error('REFUSED: vendor-pins.json has no full bw-board sha');
    return pin;
}

function pinnedRecordsOnDisk (root) {
    const found = [];
    const walk = rel => {
        const dir = path.join(root, OVERLAY, rel);
        if (!existsSync(dir)) return;
        for (const entry of readdirSync(dir, {withFileTypes: true})) {
            const child = `${rel}/${entry.name}`;
            if (entry.isDirectory()) walk(child);
            else if (entry.name.endsWith('.provenance.json')) {
                let json;
                try { json = JSON.parse(readFileSync(path.join(dir, entry.name), 'utf8')); } catch { continue; }
                if (json && Object.hasOwn(json, 'bwBoardPin')) found.push(child);
            }
        }
    };
    walk('static');
    return found.sort();
}

/** Recorded {bytes, sha256} of one asset, from a record's single image or roms[]. */
function recordedAsset (json, asset) {
    const name = path.basename(asset.file);
    if (asset.key === 'image') return json.image === name ? json : null;
    return (json.roms || []).find(rom => rom.rom === name) || null;
}

/**
 * Offline checks shared by --check and admission. Returns {problems, records}.
 * @param {string} root Lite root
 * @param {string|null} pin expected bwBoardPin, or null to skip the pin check
 */
function inspect (root, pin) {
    const problems = [];
    const records = new Map();
    const registered = new Set(STATIC_RECORDS.map(rec => rec.record));
    for (const rel of pinnedRecordsOnDisk(root)) {
        if (!registered.has(rel)) problems.push(`${rel} declares bwBoardPin but is not in the static provenance registry (scripts/admit-static-provenance.mjs)`);
    }
    for (const rec of STATIC_RECORDS) {
        const file = path.join(root, OVERLAY, rec.record);
        if (!existsSync(file)) { problems.push(`${rec.record} is missing`); continue; }
        const text = readFileSync(file, 'utf8');
        let json;
        try { json = JSON.parse(text); } catch (error) { problems.push(`${rec.record} is not JSON: ${error.message}`); continue; }
        records.set(rec.record, {text, json});
        if (!PIN.test(json.bwBoardPin || '')) problems.push(`${rec.record}: bwBoardPin is not a full sha`);
        else if (pin && json.bwBoardPin !== pin) problems.push(`${rec.record}: stale bwBoardPin ${json.bwBoardPin.slice(0, 9)}, vendor-pins.json pins ${pin.slice(0, 9)}`);
        for (const asset of rec.assets) {
            const want = recordedAsset(json, asset);
            if (!want) { problems.push(`${rec.record}: no entry for ${asset.file}`); continue; }
            const assetFile = path.join(root, OVERLAY, asset.file);
            if (!existsSync(assetFile)) { problems.push(`${rec.record}: ${asset.file} is missing`); continue; }
            const bytes = readFileSync(assetFile);
            if (bytes.length !== want.bytes) problems.push(`${rec.record}: ${asset.file} bytes ${bytes.length} != recorded ${want.bytes}`);
            if (sha256(bytes) !== want.sha256) problems.push(`${rec.record}: ${asset.file} sha256 ${sha256(bytes).slice(0, 12)} != recorded ${String(want.sha256).slice(0, 12)}`);
        }
        if (rec.trackedMirror) {
            const mirror = path.join(root, PACKAGES, rec.record);
            if (!existsSync(mirror) || readFileSync(mirror, 'utf8') !== text) {
                problems.push(`${PACKAGES}/${rec.record} is not identical to ${OVERLAY}/${rec.record}`);
            }
        }
    }
    return {problems, records};
}

const refuse = problems => {
    throw new Error(`REFUSED: static provenance transaction:\n${problems.map(p => `  REFUSED: ${p}`).join('\n')}`);
};

/** Offline gate: records match the current pin, their asset bytes and their tracked mirrors. */
export function checkStaticProvenance ({root = ROOT} = {}) {
    const {problems} = inspect(root, pinnedBoard(root));
    if (problems.length) refuse(problems);
    return STATIC_RECORDS.map(rec => rec.record);
}

/** Read a supplier blob at an exact commit from local Git objects only. */
export const gitSupplier = dir => (pin, file) => {
    try {
        return execFileSync('git', ['-C', dir, 'cat-file', 'blob', `${pin}:${file}`],
            {stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20});
    } catch {
        return null;
    }
};

/**
 * Re-admit every registered record to the pinned bw-board, or refuse by name before writing.
 * @returns {string[]} files written (empty when already admitted)
 */
export function admitStaticProvenance ({root = ROOT, readSupplier}) {
    const target = pinnedBoard(root);
    const {problems, records} = inspect(root, null);
    for (const rec of STATIC_RECORDS) {
        const entry = records.get(rec.record);
        if (!entry) continue;
        for (const asset of rec.assets.filter(a => a.supplier)) {
            const blob = readSupplier(target, asset.supplier);
            const local = path.join(root, OVERLAY, asset.file);
            if (!blob) problems.push(`${rec.record}: supplier ${asset.supplier} is absent at bw-board ${target.slice(0, 9)}`);
            else if (existsSync(local) && !blob.equals(readFileSync(local))) {
                problems.push(`${rec.record}: ${asset.file} differs from bw-board ${target.slice(0, 9)}:${asset.supplier}`);
            }
        }
        const from = entry.json.bwBoardPin;
        for (const input of rec.inputs || []) {
            if (from === target) continue;
            const a = readSupplier(from, input), b = readSupplier(target, input);
            if (!a || !b) problems.push(`${rec.record}: construction input ${input} is absent at ${(a ? target : from).slice(0, 9)}`);
            else if (!a.equals(b)) problems.push(`${rec.record}: construction input ${input} changed between ${from.slice(0, 9)} and ${target.slice(0, 9)}; the retained image needs review`);
        }
    }
    if (problems.length) refuse(problems);
    const writes = [];
    for (const rec of STATIC_RECORDS) {
        const {text, json} = records.get(rec.record);
        if (json.bwBoardPin === target) continue;
        const field = `"bwBoardPin": "${json.bwBoardPin}"`;
        if (text.split(field).length !== 2) refuse([`${rec.record}: bwBoardPin is not a single canonical field`]);
        const next = text.replace(field, `"bwBoardPin": "${target}"`);
        writes.push([`${OVERLAY}/${rec.record}`, next]);
        if (rec.trackedMirror) writes.push([`${PACKAGES}/${rec.record}`, next]);
    }
    for (const [rel, next] of writes) writeFileSync(path.join(root, rel), next);
    return writes.map(([rel]) => rel);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === '--check') {
        console.log(`static provenance: ${checkStaticProvenance().length} records match the bw-board pin, bytes and mirrors`);
    } else if (args.length === 2 && args[0] === '--dir') {
        const written = admitStaticProvenance({readSupplier: gitSupplier(path.resolve(args[1]))});
        console.log(written.length ? `static provenance re-admitted:\n  ${written.join('\n  ')}` : 'static provenance already admitted at the pin');
    } else {
        console.error('usage: admit-static-provenance.mjs --dir <bw-board clone> | --check');
        process.exit(2);
    }
}
