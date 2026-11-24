// SPDX-License-Identifier: BSD-3-Clause
const CACHE = 'brickwright-rendered-thumbnails-v1';
const LIMIT = 384;
let pendingWrites = Promise.resolve();

const requestKey = key => new URL(`/__brickwright-rendered-thumbnails/${encodeURIComponent(key)}`, location.href).href;
const open = () => globalThis.caches?.open(CACHE);

export const readPartThumbnail = async key => {
    try {
        const cache = await open();
        const image = await (await cache?.match(requestKey(key)))?.text();
        return image?.startsWith('data:image/png;base64,') ? image : null;
    } catch {
        return null;
    }
};

export const writePartThumbnail = (key, image) => {
    if (!image?.startsWith('data:image/png;base64,') || image.length > 256 * 1024 || !globalThis.caches) return;
    pendingWrites = pendingWrites.then(async () => {
        const cache = await open();
        await cache.put(requestKey(key), new Response(image));
        const keys = await cache.keys();
        for (const old of keys.slice(0, Math.max(0, keys.length - LIMIT))) await cache.delete(old);
    }).catch(() => {});
    return pendingWrites;
};
