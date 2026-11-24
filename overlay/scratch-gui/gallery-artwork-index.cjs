// SPDX-License-Identifier: BSD-3-Clause
const {createHash} = require('node:crypto');

const artworkDirectory = 'static/thumbnails/gallery-artwork';

function buildGalleryArtworkIndexes(manifest) {
    if (manifest.schema !== 1 || !manifest.robots || !manifest.circuits) {
        throw new Error('Unsupported gallery artwork manifest');
    }
    const entries = {
        robots: Object.entries(manifest.robots).map(([key, record]) => [key, record.artwork]),
        circuits: Object.entries(manifest.circuits).map(([key, record]) => [key, [record.source, record.artwork]])
    };
    return Object.fromEntries(Object.entries(entries).map(([editor, records]) => {
        const bytes = JSON.stringify(Object.fromEntries(records));
        const hash = createHash('sha256').update(bytes).digest('hex');
        return [editor, {path: `${artworkDirectory}/${editor}.${hash}.json`, bytes}];
    }));
}

module.exports = {artworkDirectory, buildGalleryArtworkIndexes};
