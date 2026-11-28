// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

const provenanceUrl = new URL('../../test/fixtures/cad/browser/provenance.json', import.meta.url);

/** Validate before launching a browser, then import the very bytes validated. */
export async function loadCadBrowserFixture (kind, file) {
    const provenance = JSON.parse(await readFile(provenanceUrl, 'utf8'));
    assert.equal(provenance.schema, 'bw.cad-browser-fixtures.v1');
    assert.ok(Object.hasOwn(provenance.fixtures, kind), `unknown CAD browser fixture ${kind}`);
    const record = provenance.fixtures[kind];
    const buffer = await readFile(file);
    assert.equal(buffer.length, record.bytes, `${record.file}: reviewed CAD fixture byte count`);
    assert.equal(createHash('sha256').update(buffer).digest('hex'), record.sha256,
        `${record.file}: reviewed CAD fixture SHA256`);
    return {name: record.file, mimeType: record.mimeType, buffer};
}
