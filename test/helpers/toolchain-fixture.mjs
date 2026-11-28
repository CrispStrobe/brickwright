// Test-only package bytes. Change the inventory before importing the real
// downloader; production has no bypass for verification or alternate digests.
import {createHash} from 'node:crypto';
import inventory from '../../overlay/scratch-gui/src/lib/runtime-package-inventory.cjs';

const record = inventory.packages.find(pkg => pkg.id === 'sdcc-wasm');
export const fixtureBytes = name => Buffer.from(`payload:${record.origin}static/sdcc-wasm/${name}`);
record.integrity = {
    ...record.integrity,
    artifacts: Object.fromEntries(record.files.map(name => {
        const bytes = fixtureBytes(name);
        return [name, {
            sha256: createHash('sha256').update(bytes).digest('hex'),
            bytes: bytes.length,
            gitBlobSha: createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
        }];
    }))
};

export const {
    primeToolchainCache, inspectToolchain, removeToolchain, measureToolchain,
    cachedResolver, TOOLCHAIN_FILES, GPL_TOOLCHAIN_ORIGIN, TOOLCHAIN_CACHE,
    getToolchainMode, setToolchainMode, localToolchainEnabled, localCompilerRequest
} = await import('../../overlay/scratch-gui/src/lib/sdcc-wasm/toolchain-source.js');
