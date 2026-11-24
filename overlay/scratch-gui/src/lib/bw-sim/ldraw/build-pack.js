// SPDX-License-Identifier: BSD-3-Clause
import {fetchLDrawClosure} from './ldraw-fetch.js';

/** Build needs the vendored palette ready for synchronous drag-to-place. Load its files together. */
export const fetchBuildLDraw = async (parts, {fetchImpl = globalThis.fetch, Decompress = globalThis.DecompressionStream} = {}) => {
    let files;
    if (typeof Decompress === 'function') {
        try {
            const response = await fetchImpl(`static/sim-lab/robot-build-ldraw.pack?v=${encodeURIComponent(process.env.BW_VERSION || 'local')}`);
            if (response.ok && response.body) {
                const data = await new Response(response.body.pipeThrough(new Decompress('gzip'))).json();
                files = new Map(data);
            }
        } catch {
            // Older hosts and partial distributions still have the original individual files.
        }
    }
    const read = files ? url => {
        const text = files.get(url.slice('static/'.length));
        return url.startsWith('static/') && typeof text === 'string' ? new Response(text) : fetchImpl(url);
    } : fetchImpl;
    return fetchLDrawClosure(parts, {fetchImpl: read, withConfig: true});
};
