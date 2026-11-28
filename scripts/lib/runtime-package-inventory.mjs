/**
 * Validate the selected runtime-package inventory and expose its build exclusions.
 * This records reviewed delivery decisions; it does not discover dependencies,
 * resolve SPDX expressions, verify downloads, or certify an artifact's licence.
 */
import {readFileSync} from 'node:fs';

const INVENTORY = new URL('../../overlay/scratch-gui/src/lib/runtime-package-inventory.json', import.meta.url);
const KINDS = new Set(['compiler-toolchain', 'language-runtime', 'firmware']);
const fail = message => { throw new Error('Runtime package inventory: ' + message); };
const object = (value, label) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(label + ' must be an object');
};
const text = (value, label) => {
    if (typeof value !== 'string' || !value.trim() || value !== value.trim()) {
        fail(label + ' must be a nonempty trimmed string');
    }
};
const strings = (value, label) => {
    if (!Array.isArray(value) || !value.length) fail(label + ' must be a nonempty array');
    for (const entry of value) text(entry, label + ' entry');
    if (new Set(value).size !== value.length) fail(label + ' contains duplicates');
};
const marker = (value, label) => {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) fail(label + ' must be a single path segment');
};
const httpsUrl = (value, label) => {
    text(value, label);
    let url;
    try { url = new URL(value); } catch { fail(label + ' must be an HTTPS URL'); }
    if (url.protocol !== 'https:' || url.username || url.password) fail(label + ' must be an HTTPS URL');
    return url;
};

export function validateRuntimePackageInventory (inventory) {
    object(inventory, 'inventory');
    if (inventory.schema !== 1) fail('unsupported schema ' + JSON.stringify(inventory.schema));
    if (inventory.scope !== 'selected-runtime-packages') fail('scope must be selected-runtime-packages');
    if (!Array.isArray(inventory.packages) || !inventory.packages.length) {
        fail('packages must be a nonempty array');
    }
    const ids = new Set();
    for (const [index, pkg] of inventory.packages.entries()) {
        const label = 'packages[' + index + ']';
        object(pkg, label);
        text(pkg.id, label + '.id');
        marker(pkg.id, label + '.id');
        if (ids.has(pkg.id)) fail('duplicate package id ' + pkg.id);
        ids.add(pkg.id);
        text(pkg.name, label + '.name');
        text(pkg.version, label + '.version');
        if (!KINDS.has(pkg.kind)) fail(label + '.kind is unsupported');
        // Schema v1 qualifies only optional downloads. Adding another delivery
        // category needs its own policy checks; changing a record to bundled
        // must not silently remove that package from the output gate.
        if (pkg.delivery !== 'optional-user-download') fail(label + '.delivery is unsupported in schema v1');
        if (pkg.bundled !== false) fail(label + '.bundled must be false for optional-user-download');
        strings(pkg.files, label + '.files');
        for (const name of pkg.files) {
            if (name.includes('\\') || name.split('/').some(part => !part || part === '.' || part === '..')) {
                fail(label + '.files must contain relative member paths');
            }
        }
        if (pkg.kind === 'compiler-toolchain') {
            object(pkg.compilerLicense, label + '.compilerLicense');
            text(pkg.compilerLicense.declaredSpdx, label + '.compilerLicense.declaredSpdx');
            text(pkg.compilerLicense.status, label + '.compilerLicense.status');
            httpsUrl(pkg.compilerLicense.licenseUrl, label + '.compilerLicense.licenseUrl');
            httpsUrl(pkg.compilerLicense.sourceUrl, label + '.compilerLicense.sourceUrl');
        }
        if (pkg.delivery === 'optional-user-download') {
            const origin = httpsUrl(pkg.origin, label + '.origin');
            if (!origin.pathname.endsWith('/') || origin.search || origin.hash) {
                fail(label + '.origin must be a base URL ending in / without query or fragment');
            }
            text(pkg.cacheName, label + '.cacheName');
            object(pkg.integrity, label + '.integrity');
            // A published digest is not a verified installation. This schema's
            // first implementation records the existing unverified download.
            if (pkg.integrity.status !== 'unverified') fail(label + '.integrity.status must be unverified');
            object(pkg.buildExclusions, label + '.buildExclusions');
            for (const key of ['directories', 'filenames']) {
                strings(pkg.buildExclusions[key], label + '.buildExclusions.' + key);
                for (const name of pkg.buildExclusions[key]) marker(name, label + '.buildExclusions.' + key);
            }
            for (const name of pkg.buildExclusions.filenames) {
                if (!pkg.files.includes(name)) fail(label + '.buildExclusions names an undeclared member: ' + name);
            }
        }
    }
    return inventory;
}

export function readRuntimePackageInventory (file = INVENTORY) {
    return validateRuntimePackageInventory(JSON.parse(readFileSync(file, 'utf8')));
}

export function optionalPackageBuildExclusions (inventory) {
    validateRuntimePackageInventory(inventory);
    const directories = new Map();
    const filenames = new Map();
    for (const pkg of inventory.packages) {
        if (pkg.delivery !== 'optional-user-download') continue;
        const reason = pkg.name + ' (' + pkg.id + ') is registered for optional user download, never bundled';
        for (const [key, entries] of [['directories', directories], ['filenames', filenames]]) {
            for (const name of pkg.buildExclusions[key]) {
                entries.set(name, entries.has(name) ? entries.get(name) + '; ' + reason : reason);
            }
        }
    }
    return {directories, filenames};
}
