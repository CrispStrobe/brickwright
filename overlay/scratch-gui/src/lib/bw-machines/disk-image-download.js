// SPDX-License-Identifier: BSD-3-Clause
import downloadBlob from '../download-blob.js';

const chunkSize = 192 * 1024;

export async function saveDiskImage (filename, bytes, isOpen) {
    const invoke = window.__TAURI__?.core?.invoke;
    if (!invoke) return downloadBlob(filename, new Blob([bytes], {type: 'application/octet-stream'}));

    const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
    const image = new Blob([bytes], {type: 'application/octet-stream'});
    let finished = false;
    try {
        // Keep WebView IPC messages bounded, including platforms that use JSON IPC.
        for (let offset = 0; offset < image.size; offset += chunkSize) {
            const data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(image.slice(offset, offset + chunkSize));
            });
            if (!isOpen()) return;
            await invoke('stage_fat_image_chunk', {id, offset, data});
        }
        if (!isOpen()) return;
        const path = await invoke('finish_fat_image_export', {id, filename, size: image.size});
        if (path) await invoke('plugin:share|share_file', {path, mime: 'application/octet-stream'});
        finished = true;
    } finally {
        if (!finished) await invoke('discard_fat_image_export', {id}).catch(() => {});
    }
}
