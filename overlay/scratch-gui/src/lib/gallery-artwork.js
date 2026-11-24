// SPDX-License-Identifier: BSD-3-Clause
const ROOT = 'static/thumbnails/gallery-artwork/';
const empty = Object.freeze({});
let manifestRequest;

export function loadGalleryArtwork() {
    if (!manifestRequest) {
        manifestRequest = fetch(`${ROOT}manifest.json?build=${process.env.BW_VERSION}`)
            .then(response => {
                if (!response.ok) throw new Error('Gallery artwork unavailable');
                return response.json();
            })
            .then(manifest => manifest.schema === 1 ? manifest : empty)
            .catch(() => {
                manifestRequest = undefined;
                return empty;
            });
    }
    return manifestRequest;
}

export function galleryArtworkUrl(record) {
    const name = record?.artwork;
    return typeof name === 'string' && /^[0-9a-f]{64}\.(?:png|svg)$/.test(name) ? ROOT + name : undefined;
}

export function circuitExamplesWithArtwork(examples, records) {
    if (!records) return examples;
    let any = false;
    const decorated = examples.map(example => {
        const record = records[example.id];
        const artworkUrl = record?.source === example.files?.circuit && galleryArtworkUrl(record);
        if (!artworkUrl) return example;
        any = true;
        return {...example, artworkUrl};
    });
    return any ? decorated : examples;
}
