// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, lstatSync, realpathSync} from 'node:fs';
import path from 'node:path';

export const CAD_SDK_ROOT = 'overlay/scratch-gui/static/cad-sdk';
export const CAD_SDK_PRODUCER = 'scripts/sync-cad-sdk.mjs';
export const APPROVED_CAD_MANIFEST_SHA256 = 'a2c9cc0999cd24b593466d2b02c987c9621baa21d07443322067fe0764240fd8';
export const APPROVED_CAD_PRODUCER_SHA256 = '5d1f4ef4cef65b68306cd147237409bd6a77b485137be05b8f66b05dafdf0e7c';
const SHA = /^[0-9a-f]{40}$/;
const HASH = /^[0-9a-f]{64}$/;
const CARRIER = /^model-library-(?:local|panel)-[A-Za-z0-9_-]+\.js$/;
export const APPROVED_CAD_COMMIT = '68666cefe89235eaff9b1ccd3eeb9543ce299b81';
export const APPROVED_CAD_CARRIER = 'model-library-local-CdkGvCIb.js';
export const APPROVED_CAD_CARRIER_SHA256 = '91a840926405cd0944731304d36e769e1d1d03fbc92e7ccbbf17c0128726ba4e';

export const APPROVED_CAD_CARRIERS = Object.freeze({
    [APPROVED_CAD_CARRIER]: APPROVED_CAD_CARRIER_SHA256,
    'sdk-BKBPej72.js': 'e7e8d750e88567dfd04819332fdf556ebfee97bddbff76009a7be0970c61aa82',
    'model-library-panel-DyBVUonc.js': '92e2f821d2690605dea766fb05d2e727c51cfffd29a71d5bdeff9bacf1c8881c'
});

// Structural validation is not approval. Only the exact frozen carrier below
// authorizes this existing URL set, including its four literal %20 filenames.
export function validateCadProvenanceUrl(value) {
    const host = 'raw.' + 'githubusercontent.com';
    assert.equal(typeof value, 'string');
    assert.ok(value.startsWith(host + '/'), 'Unexpected CAD provenance host');
    assert.ok(!/[\\@?:#]/.test(value), 'CAD provenance forbids authentication, query, fragment and escapes');
    const [authority, owner, repository, commit, ...parts] = value.split('/');
    // Existing frozen SDK metadata includes a source-directory URL.
    const pathParts = parts.at(-1) === '' ? parts.slice(0, -1) : parts;
    assert.equal(authority, host);
    assert.ok(owner?.length <= 39 && /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(owner), 'Invalid static CAD provenance owner');
    assert.ok(repository?.length <= 100 && /^[A-Za-z0-9_.-]+$/.test(repository) && !['.','..'].includes(repository), 'Invalid static CAD provenance repository');
    assert.match(commit || '', SHA, 'CAD provenance must name a complete immutable commit');
    assert.ok(pathParts.length > 0 && pathParts.every(part => {
        if (!/^(?:[A-Za-z0-9._~-]|%20)+$/.test(part)) return false;
        const decoded = part.replaceAll('%20', ' ');
        return decoded === decoded.trim() && !['.','..'].includes(decoded);
    }), 'Unsafe CAD provenance path or encoding');
    const url = new URL(`https://${value}`);
    assert.equal(url.host, host);
    assert.equal(url.username + url.password + url.search + url.hash, '');
    assert.equal(url.pathname, '/' + [owner, repository, commit, ...parts].join('/'), 'CAD provenance path was normalized');
}

// A generated data carrier is not a new exemption from the fetch census.
// Only its exact tracked, manifest-hashed immutable source links become
// rows. Other files and other URL shapes remain subject to the ordinary gate.
export function cadSdkFetchPins(root, tracked, detectors) {
    const manifestName = `${CAD_SDK_ROOT}/manifest.json`;
    assert.ok(tracked.has(manifestName), 'CAD SDK manifest must be tracked');
    assert.ok(tracked.has(CAD_SDK_PRODUCER), 'CAD SDK producer must be tracked');
    const producer = path.join(root, CAD_SDK_PRODUCER);
    assert.ok(lstatSync(producer).isFile() && !lstatSync(producer).isSymbolicLink(), 'CAD SDK producer must be a regular file');
    assert.ok(realpathSync(producer).startsWith(realpathSync(root) + path.sep), 'CAD SDK producer escaped checkout');
    assert.equal(createHash('sha256').update(readFileSync(producer)).digest('hex'), APPROVED_CAD_PRODUCER_SHA256, 'CAD SDK producer needs exact approved source bytes');
    const directory = path.join(root, CAD_SDK_ROOT);
    assert.ok(lstatSync(directory).isDirectory() && !lstatSync(directory).isSymbolicLink(), 'CAD SDK root must be a regular directory');
    const inside = file => {
        assert.ok(file && !file.includes('\\') && !file.includes(':') && !path.posix.isAbsolute(file) &&
            path.posix.normalize(file) === file && !file.split('/').some(part => part === '..' || part === '.' || part === ''), 'Unsafe CAD SDK manifest path');
        const absolute = path.join(directory, file);
        assert.ok(lstatSync(absolute).isFile() && !lstatSync(absolute).isSymbolicLink(), 'CAD SDK payload must be a regular file');
        assert.ok(realpathSync(absolute).startsWith(realpathSync(directory) + path.sep), 'CAD SDK payload escaped its directory');
        return absolute;
    };
    const manifestBytes = readFileSync(inside('manifest.json'));
    // Freeze the entire map, including all carriers: no adjusted payload hash
    // or additional manifest entry can borrow this admission.
    assert.equal(createHash('sha256').update(manifestBytes).digest('hex'), APPROVED_CAD_MANIFEST_SHA256, 'CAD SDK manifest needs exact approved bytes');
    const manifest = JSON.parse(manifestBytes);
    assert.equal(manifest.format, 'brickwright-cad-sdk');
    assert.equal(manifest.version, 1);
    assert.equal(manifest.repository, 'https://github.com/CrispStrobe/brickwright-cad');
    assert.equal(manifest.dirty, false);
    assert.match(manifest.commit, SHA, 'CAD SDK source must name a complete immutable commit');
    assert.equal(manifest.commit, APPROVED_CAD_COMMIT, 'CAD SDK provenance needs an explicitly approved source commit');
    for (const [file, hash] of Object.entries(APPROVED_CAD_CARRIERS)) {
        assert.equal(manifest.files?.[file], hash, 'CAD SDK provenance needs the exact approved carrier hash');
    }
    assert.ok(manifest.files && typeof manifest.files === 'object' && !Array.isArray(manifest.files));
    const carriers = [], rows = new Map();
    for (const [file, hash] of Object.entries(manifest.files)) {
        assert.match(hash, HASH, 'CAD SDK payload hash must be SHA-256');
        const name = `${CAD_SDK_ROOT}/${file}`;
        assert.ok(tracked.has(name), `Untracked CAD SDK payload: ${file}`);
        const bytes = readFileSync(inside(file));
        assert.equal(createHash('sha256').update(bytes).digest('hex'), hash, `CAD SDK payload hash mismatch: ${file}`);
        if (CARRIER.test(file) || Object.hasOwn(APPROVED_CAD_CARRIERS, file)) {
            assert.ok(Object.hasOwn(APPROVED_CAD_CARRIERS, file), 'Unapproved CAD provenance carrier');
            assert.equal(hash, APPROVED_CAD_CARRIERS[file], 'Unapproved CAD provenance carrier hash');
            carriers.push({name, text: bytes.toString('utf8')});
        }
    }
    assert.equal(carriers.length, Object.keys(APPROVED_CAD_CARRIERS).length, 'Exactly the approved CAD provenance carriers are required');
    for (const {name, text} of carriers) for (const [kind, detector, only] of detectors) {
        if (only && !only.test(name)) continue;
        for (const match of text.matchAll(detector)) {
            const value = (match[1] ?? match[0]).trim().replace(/\s+/g, ' ');
            assert.equal(kind, 'raw', 'A new CAD carrier fetch shape requires explicit review');
            validateCadProvenanceUrl(value);
            const row = {file: name, kind, text: value, class: 'sha-const',
                why: 'Immutable full-commit provenance in the exact tracked CAD data carriers, frozen to its explicitly approved source commit and carrier SHA-256. The exact source-frozen tracked CAD producer installs the exact approved manifest; this gate independently verifies every tracked distribution payload SHA-256 before deriving these exact source-link rows.'};
            rows.set(`${name} ${kind} ${value}`, row);
        }
    }
    assert.ok(rows.size > 0, 'CAD model provenance admission must not silently become empty');
    return [...rows.values()];
}
