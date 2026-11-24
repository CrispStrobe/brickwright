// SPDX-License-Identifier: BSD-3-Clause
const ROOT = 'static/thumbnails/gallery-artwork/';
const empty = Object.freeze({});
const indexRequests = new Map();

export function loadGalleryArtwork(editor) {
    const url = process.env.BW_GALLERY_ARTWORK_INDEXES?.[editor];
    if (!url) return Promise.resolve(empty);
    if (!indexRequests.has(url)) {
        const request = fetch(url)
            .then(response => {
                if (!response.ok) throw new Error('Gallery artwork unavailable');
                return response.json();
            })
            .then(index => {
                if (!index || typeof index !== 'object' || Array.isArray(index)) throw new Error('Invalid gallery artwork index');
                return index;
            })
            .catch(() => {
                indexRequests.delete(url);
                return empty;
            });
        indexRequests.set(url, request);
    }
    return indexRequests.get(url);
}

export function galleryArtworkUrl(name) {
    return typeof name === 'string' && /^[0-9a-f]{64}\.(?:png|svg)$/.test(name) ? ROOT + name : undefined;
}

export function circuitExamplesWithArtwork(examples, records) {
    if (!records) return examples;
    let any = false;
    const decorated = examples.map(example => {
        const record = records[example.id];
        const artworkUrl = record?.[0] === example.files?.circuit && galleryArtworkUrl(record?.[1]);
        if (!artworkUrl) return example;
        any = true;
        return {...example, artworkUrl};
    });
    return any ? decorated : examples;
}
