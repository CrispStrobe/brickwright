/**
 * MakeCode Arcade artwork → costumes we can actually put on a sprite.
 *
 * An Arcade game is mostly pictures. They arrive two ways and this
 * module reads both:
 *
 *   `img\`. . 5 5 .\n. 5 5 5 5\`` — an inline literal in main.ts, one
 *       character per pixel, the character set fixed by the target's
 *       `img` shim (see IMAGE_CHARS).
 *   *.g.jres — the asset gallery, base64 of MakeCode's own image buffer:
 *       `87 04 <w:u16> <h:u16> 00 00`, then the pixels COLUMN by column,
 *       4 bits each, low nibble first, each column padded to a 32-bit boundary.
 *       Column-major, which is the detail that decides whether you get a
 *       sprite or a diagonal smear.
 *
 * Output is SVG rather than a bitmap, because that is what the Code
 * tab's costume path already takes (`addCustomSVGCostume` /
 * `applyCustomSVG`, the same route the SVG-upload table uses). Pixels
 * become rects, runs of one colour merge into one rect, and colour 0 is
 * left out — so transparency is transparency and a 16x16 sprite is a
 * few dozen rects rather than 256.
 *
 * @module
 */


/**
 * The default Arcade palette, from pxt-arcade's own documentation.
 * Index 0 is transparent; index 15 is black, as is the (unused) 0 entry.
 */
export const ARCADE_PALETTE = [
    null,        // 0 — transparent
    '#ffffff', '#ff2121', '#ff93c4', '#ff8135',
    '#fff609', '#249ca3', '#78dc52', '#003fad',
    '#87f2ff', '#8e2ec4', '#a4839f', '#5c406c',
    '#e5cdc4', '#91463d', '#000000'
];

/**
 * Which characters mean which palette index, from the `img` shim's
 * `groups` annotation in pxt-arcade: ["0.", "1#", "2T", ... "fFW"].
 * Both the hex digit and the mnemonic letters are legal in one literal.
 */
const IMAGE_CHARS = ['0.', '1#', '2T', '3t', '4N', '5n', '6G', '7g', '8', '9', 'aAR', 'bBP', 'cCp', 'dDO', 'eEY', 'fFW'];

const CHAR_TO_INDEX = (() => {
    const map = new Map();
    IMAGE_CHARS.forEach((chars, index) => {
        for (const c of chars) map.set(c, index);
    });
    return map;
})();

/**
 * Parse an `img` template literal's text.
 *
 * @param {string} text the characters between the backticks
 * @returns {{width: number, height: number, pixels: Uint8Array}|null}
 *   null when empty. Ragged rows follow the PXT compiler: the image is as
 *   wide as its longest row and shorter rows end in transparent pixels
 *   (observed in the original runtime, makecode-arcade.test.mjs).
 */
export function parseImageLiteral (text) {
    // Spaces separate the pixel characters and carry nothing; every
    // other character in the literal is a palette index.
    const rows = String(text || '').split('\n')
        .map(row => [...row].filter(c => CHAR_TO_INDEX.has(c)))
        .filter(row => row.length);
    if (!rows.length) return null;
    const width = Math.max(...rows.map(row => row.length));
    const height = rows.length;
    const pixels = new Uint8Array(width * height);
    rows.forEach((row, y) => row.forEach((c, x) => {
        pixels[(y * width) + x] = CHAR_TO_INDEX.get(c);
    }));
    return {width, height, pixels};
}

/** Read a pasted `img` literal without silently dropping unknown characters. */
export function parseExactImgLiteral (text) {
    const match = /^\s*img\s*`([\s\S]*?)`\s*;?\s*$/.exec(String(text || ''));
    if (!match) return null;
    const rows = match[1].split(/\r?\n/).map(row => [...row].filter(c => !/[ \t]/.test(c)))
        .filter(row => row.length);
    if (!rows.length || rows.some(row => row.length !== rows[0].length ||
        row.some(cell => !CHAR_TO_INDEX.has(cell)))) return null;
    return parseImageLiteral(match[1]);
}

/**
 * base64 → bytes, in whichever runtime this is.
 *
 * `atob` first and `Buffer` only as a named fallback: a bare `Buffer`
 * reference in a browser bundle is the kind of thing that survives the
 * build and fails on someone's machine.
 */
const decodeBase64 = text => {
    if (typeof atob === 'function') {
        const binary = atob(text);
        const out = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
        return out;
    }
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(text, 'base64'));
    throw new Error('No base64 decoder in this runtime');
};

/**
 * Decode one `image/x-mkcd-f4` buffer.
 *
 * @param {string} base64
 * @returns {{width: number, height: number, pixels: Uint8Array}|null}
 */
export function decodeMkcdImage (base64) {
    const bytes = decodeBase64(base64);
    // The SDK also accepts legacy f4 artwork: E4, u8 width, u8 height,
    // reserved byte, then the same padded column-major nibble body.
    const legacy = bytes.length >= 5 && bytes[0] === 0xe4;
    if (!legacy && (bytes.length < 8 || bytes[0] !== 0x87 || bytes[1] !== 0x04)) return null;
    const header = legacy ? 4 : 8;
    const width = legacy ? bytes[1] : bytes[2] | (bytes[3] << 8);
    const height = legacy ? bytes[2] : bytes[4] | (bytes[5] << 8);
    const stride = Math.ceil(height / 8) * 4;
    if (!width || !height || bytes.length !== header + (width * stride)) return null;
    const pixels = new Uint8Array(width * height);
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            const byte = bytes[header + (x * stride) + (y >> 1)];
            pixels[(y * width) + x] = (y % 2 === 0) ? (byte & 0x0F) : (byte >> 4);
        }
    }
    return {width, height, pixels};
}

/**
 * Read a project's `*.g.jres` gallery.
 *
 * @param {string} text the file contents
 * @returns {Object<string, {width: number, height: number, pixels: Uint8Array}>}
 *   keyed by the display name when there is one, else the jres id
 */
export function parseJres (text) {
    let jres;
    try {
        jres = JSON.parse(text);
    } catch (e) {
        return {};
    }
    const out = {};
    for (const [id, entry] of Object.entries(jres)) {
        if (!entry || typeof entry !== 'object' || typeof entry.data !== 'string') continue;
        if (entry.mimeType && !/x-mkcd-f4/.test(entry.mimeType)) continue;
        const image = decodeMkcdImage(entry.data);
        if (image) out[entry.displayName || id] = image;
    }
    return out;
}

/** Image resources only. Tile images have the same binary format but a different
 * PXT factory kind, so they must not resolve an assets.image tagged template.
 * The older parseJres decoder remains unscoped for tilemap rasterization callers.
 */
export function parseImageAssetEntries (text) {
    let jres;
    try {jres = JSON.parse(text);} catch (error) {return [];}
    const images = [];
    if (!jres || typeof jres !== 'object' || Array.isArray(jres)) return images;
    for (const [key, raw] of Object.entries(jres)) {
        if (key === '*') continue;
        const entry = typeof raw === 'string' ? {data:raw} : raw;
        if (!entry || typeof entry !== 'object' || entry.tilemapTile || typeof entry.data !== 'string') continue;
        const mime = entry.mimeType || jres['*']?.mimeType;
        if (mime && mime !== 'image/x-mkcd-f4') continue;
        const decoded = decodeMkcdImage(entry.data);
        if (!decoded) continue;
        const namespace = entry.namespace || jres['*']?.namespace || 'myImages';
        const imageId = entry.id || (key.includes('.') ? key : `${String(namespace).replace(/\.$/, '')}.${key}`);
        const displayName = typeof entry.displayName === 'string' && entry.displayName ? entry.displayName : key;
        images.push({key,image:{...decoded,imageId,displayName},
            aliases:[...new Set([key,imageId,key.split('.').pop(),displayName])],factoryDisplayName:entry.displayName,
            // emitProjectImages accepts shorthand strings, but object entries
            // require their own image MIME; inherited JRES decoding is broader.
            factoryRegistered:typeof raw==='string' || entry.mimeType==='image/x-mkcd-f4'});
    }
    return images;
}

export function parseImageAssets (text) {
    const images = Object.create(null);
    for (const {image,aliases} of parseImageAssetEntries(text)) for (const name of aliases) {
        if (!Object.prototype.hasOwnProperty.call(images,name)) images[name] = image;
        else if (images[name]?.imageId !== image.imageId) images[name] = null;
    }
    return images;
}

/**
 * Render a decoded image as SVG.
 *
 * Runs of one colour along a row become a single rect: a 160x120
 * background is 19 200 pixels and perhaps a few hundred rects, which is
 * the difference between a costume the paint editor can open and one it
 * cannot.
 *
 * @param {{width: number, height: number, pixels: Uint8Array}} image
 * @param {object} [opts]
 * @param {number} [opts.scale] SVG units per pixel (default 4, so a
 *   16x16 sprite lands at a Scratch-ish 64x64)
 * @param {Array<string|null>} [opts.palette]
 * @returns {string}
 */
export function imageToSvg (image, opts = {}) {
    const scale = opts.scale || 4;
    const palette = opts.palette || image.palette || ARCADE_PALETTE;
    if (!Array.isArray(palette) || palette.length !== 16 || palette[0] !== null ||
        !palette.slice(1).every(color => /^#[0-9a-f]{6}$/i.test(color))) {
        throw new Error('Invalid Arcade image palette');
    }
    // RGB alone cannot distinguish duplicate palette entries. Custom art carries
    // both its palette and each opaque run's index; readers check index/fill
    // agreement before trusting them. Preserve the historical default SVG bytes.
    const customPalette = palette.some((color, index) =>
        color && color.toLowerCase() !== ARCADE_PALETTE[index]);
    const {width, height, pixels} = image;
    const rects = [];
    for (let y = 0; y < height; y++) {
        let x = 0;
        while (x < width) {
            const colour = pixels[(y * width) + x];
            let run = 1;
            while (x + run < width && pixels[(y * width) + x + run] === colour) run++;
            const fill = palette[colour];
            if (fill) {
                rects.push(`<rect x="${x * scale}" y="${y * scale}" width="${run * scale}" ` +
                    `height="${scale}" fill="${fill}"${customPalette ? ` data-bw-color-index="${colour}"` : ''}/>`);
            }
            x += run;
        }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width * scale}" height="${height * scale}" ` +
        `viewBox="0 0 ${width * scale} ${height * scale}" shape-rendering="crispEdges" ` +
        `data-bw-pixel-scale="${scale}"${customPalette ?
            ` data-bw-palette="${palette.slice(1).map(color => color.toLowerCase()).join(',')}"` : ''}>${rects.join('')}</svg>`;
}


/**
 * Read the tilemaps out of a project's generated `tilemap.g.ts`.
 *
 * A tilemap is not in the .g.jres with the images — only its TILES are.
 * The map itself lives in a generated factory function:
 *
 *   case "level": return tiles.createTilemap(
 *       hex`2000 0800 00000000…`,   // u16 width, u16 height, one byte per cell
 *       img`…`,                     // the wall layer, one pixel per cell
 *       [myTiles.tile0, myTiles.tile1, …],
 *       TileScale.Sixteen)
 *
 * Each cell byte indexes that array directly, and index 0 is the empty
 * tile. Regexes rather than the TS parser on purpose: this file is
 * machine-generated, its shape is fixed, and it is one long `switch`,
 * which is the statement the parser next door deliberately does not
 * model.
 *
 * @param {string} generatedTs the contents of tilemap.g.ts
 * @returns {Object<string, {width: number, height: number, cells: Uint8Array, tiles: Array<string>}>}
 */
export function parseTilemaps (generatedTs) {
    const out = {};
    const pattern = /case\s+"([^"]+)"\s*:\s*return\s+tiles\.createTilemap\(\s*hex`([0-9a-fA-F\s]*)`\s*,\s*img`[\s\S]*?`\s*,\s*\[([^\]]*)\]/g;
    let match;
    while ((match = pattern.exec(generatedTs)) !== null) {
        const [, name, hexText, tileList] = match;
        const bytes = (hexText.replace(/\s+/g, '').match(/../g) || []).map(b => parseInt(b, 16));
        if (bytes.length < 4) continue;
        const width = bytes[0] | (bytes[1] << 8);
        const height = bytes[2] | (bytes[3] << 8);
        if (!width || !height || bytes.length < 4 + (width * height)) continue;
        out[name] = {
            width,
            height,
            cells: new Uint8Array(bytes.slice(4, 4 + (width * height))),
            tiles: tileList.split(',').map(t => t.trim().replace(/^.*\./, '')).filter(Boolean)
        };
    }
    return out;
}

/**
 * Paint a tilemap into one image: the whole level, tile by tile.
 *
 * Scratch has no scrolling backdrop, so a level arrives as a single wide
 * picture rather than as terrain. That is a real difference and the
 * caller says so — but a level you can SEE is worth much more than a
 * level that silently did not import.
 *
 * @param {{width: number, height: number, cells: Uint8Array, tiles: Array<string>}} tilemap
 * @param {Object<string, {width: number, height: number, pixels: Uint8Array}>} tileImages by jres id
 * @returns {{width: number, height: number, pixels: Uint8Array}|null}
 */
export function renderTilemap (tilemap, tileImages) {
    const first = tilemap.tiles.map(name => tileImages[name]).find(Boolean);
    if (!first) return null;
    const size = first.width;                            // tiles are square, 8 or 16
    const width = tilemap.width * size;
    const height = tilemap.height * size;
    if (width * height > 4 * 1024 * 1024) return null;   // a level nobody wants as one costume
    const pixels = new Uint8Array(width * height);
    for (let ty = 0; ty < tilemap.height; ty++) {
        for (let tx = 0; tx < tilemap.width; tx++) {
            const tile = tileImages[tilemap.tiles[tilemap.cells[(ty * tilemap.width) + tx]]];
            if (!tile || tile.width !== size || tile.height !== size) continue;
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    pixels[(((ty * size) + y) * width) + (tx * size) + x] =
                        tile.pixels[(y * size) + x];
                }
            }
        }
    }
    return {width, height, pixels};
}

/** A 1x1 transparent stand-in, for a sprite whose art we could not read. */
export const EMPTY_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"></svg>';
