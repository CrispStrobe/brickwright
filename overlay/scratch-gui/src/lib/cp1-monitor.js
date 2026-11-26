// SPDX-License-Identifier: BSD-3-Clause
import {cp1RomReference} from './cp1-project.js';

export async function loadCp1Monitor () {
    const path = 'static/roms/cp1-independent-monitor.bin';
    const name = path.split('/').pop();
    const sha256 = 'ce3e7a33af990e3e5bd69780c6ab046502e1be57ead43655a95eb3f42d789a0f';
    const response = await fetch(path);
    if (!response.ok) throw new Error('The bundled Brickwright CP1 monitor could not be loaded.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length !== 2048) throw new Error('The bundled Brickwright CP1 monitor has an invalid size.');
    const reference = await cp1RomReference(bytes, name);
    if (reference.sha256 !== sha256) throw new Error('The bundled Brickwright CP1 monitor failed verification.');
    return {bytes, name, reference};
}
