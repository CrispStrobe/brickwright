// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// Palette for the Sim Lab editor (C4). Groups parts by category, provides
// German labels, and the set of solid colours for recolouring.

import {parseLDConfig} from '../view/ldraw-colors.js';

export const PALETTE_CATEGORIES = [
    {id: 'hub', en: 'Hub', de: 'Hub'},
    {id: 'battery', en: 'Batteries / power', de: 'Batterien / Stromversorgung'},
    {id: 'motor', en: 'Motor', de: 'Motor'},
    {id: 'sensor', en: 'Sensor', de: 'Sensor'},
    {id: 'beam', en: 'Beam', de: 'Lochbalken'},
    {id: 'axle', en: 'Axle', de: 'Achse'},
    {id: 'pin', en: 'Pin', de: 'Pin'},
    {id: 'connector', en: 'Connector', de: 'Verbinder'},
    {id: 'gear', en: 'Gear', de: 'Zahnrad'},
    {id: 'wheel', en: 'Wheel', de: 'Rad'},
    // System parts (scripts/derive-part-meta.mjs categoryOf maps the LDraw descriptions here).
    {id: 'brick', en: 'Brick', de: 'Stein'},
    {id: 'plate', en: 'Plate', de: 'Platte'},
    {id: 'tile', en: 'Tile', de: 'Fliese'},
    {id: 'slope', en: 'Slope', de: 'Schräge'},
    // Parts added from the LDraw catalogue with nothing to connect to (part-meta/catalog-parts.js).
    {id: 'decoration', en: 'Decoration', de: 'Deko'},
    {id: 'other', en: 'Other', de: 'Sonstiges'}
];

const CATEGORY_ORDER = PALETTE_CATEGORIES.map(c => c.id);

export const paletteFrom = (catalog, {locale = 'en'} = {}) => {
    const map = catalog instanceof Map ? catalog : new Map(Object.entries(catalog || {}));
    const groups = new Map();
    for (const cat of CATEGORY_ORDER) groups.set(cat, []);
    for (const [part, meta] of map.entries()) {
        const cat = CATEGORY_ORDER.includes(meta.category) ? meta.category : 'other';
        const label = locale === 'de' && meta.nameDe ? meta.nameDe : meta.name;
        groups.get(cat).push({part, name: label, nameEn: meta.name, nameDe: meta.nameDe});
    }
    return PALETTE_CATEGORIES.map(({id, en, de}) => ({
        category: id,
        label: locale === 'de' ? de : en,
        parts: groups.get(id).slice().sort((a, b) => a.part.localeCompare(b.part))
    })).filter(g => g.parts.length > 0);
};

/** How many parts the palette's "Recently used" row keeps. */
export const RECENT_CAP = 6;

/**
 * The palette's "Recently used" row after `part` was placed: newest first, each
 * part once, at most `cap` parts. Never mutates `list`.
 * @param {string[]} list
 * @param {string} part
 * @returns {string[]}
 */
export const pushRecent = (list, part, cap = RECENT_CAP) => [part, ...(list || []).filter(p => p !== part)].slice(0, cap);

/** The part number a learner reads on the box or on BrickLink: the LDraw file name without `.dat`. */
export const partNumber = part => String(part).replace(/\.dat$/i, '');

/**
 * Text folded for search: lower case, accents dropped, and the German umlaut
 * spellings made equal (ä = a = ae, ö = o = oe, ü = u = ue, ß = ss), so a child
 * typing "zahnrader", "zahnraeder" or "Zahnräder" finds the same parts.
 */
export const foldSearch = text => String(text || '').toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u');

const numbersIn = text => (String(text || '').match(/\d+/g) || []);

/**
 * Whether a part matches a search, and how well (higher is better, 0 = no).
 * Every word of the query must match:
 *   - a number matches a number in the EN or DE name exactly ("beam 7" is not
 *     "beam 17"), or, from three digits on, the start of the part number
 *     ("3647", "3252");
 *   - other words match anywhere in the EN or DE name, the part number or the
 *     category (EN/DE: "achse" also finds the bushes, which sit on axles).
 * A word found in a name counts more than one found only in the category.
 * @returns {number}
 */
export const searchScore = (part, meta, query) => {
    const words = foldSearch(query).split(/[\s,;]+/).filter(Boolean);
    if (!words.length) return 0;
    const names = [meta.name, meta.nameDe].filter(Boolean);
    const nameText = foldSearch(names.join(' '));
    const number = partNumber(part).toLowerCase();
    const cat = PALETTE_CATEGORIES.find(c => c.id === meta.category) || PALETTE_CATEGORIES.at(-1);
    const catText = foldSearch(`${cat.en} ${cat.de} ${cat.id}`);
    const nameNumbers = new Set(names.flatMap(numbersIn));
    let score = 0;
    for (const word of words) {
        if (/^\d+$/.test(word)) {
            if (nameNumbers.has(word)) score += 3;
            // A part number is typed whole or nearly: "5" alone is a size, not the start of 54696.
            else if (word.length >= 3 && number.startsWith(word)) score += 4;
            else return 0;
        } else if (number.startsWith(word)) score += 4;
        else if (nameText.includes(word)) score += nameText.split(/[\s-]+/).some(w => w.startsWith(word)) ? 3 : 2;
        else if (catText.includes(word)) score += 1;
        else return 0;
    }
    return score;
};

/** The LDraw catalogue's search (the palette's "+", sim-lab-palette.jsx). */
const CATALOGUE_LIMIT = 60;

/**
 * Catalogue parts matching a search, best first: every word must appear in the part
 * number, the title or the keywords (foldSearch: case, accents, umlaut spellings).
 * Subparts, aliases and obsolete files (titles starting ~ = _ |) are not offered.
 */
export const searchCatalogue = (list, query, limit = CATALOGUE_LIMIT) => {
    const words = foldSearch(query).split(/[\s,;]+/).filter(Boolean);
    if (!words.length) return {total: 0, results: []};
    const out = [];
    for (const p of list) {
        if (/^[~=_|]/.test(p.title)) continue;
        const number = foldSearch(p.part.replace(/\.dat$/i, ''));
        const text = foldSearch(`${p.title} ${p.keywords ?? ''}`);
        let score = 0;
        let ok = true;
        for (const w of words) {
            if (number === w) score += 1000;
            else if (number.startsWith(w)) score += 300;
            else {
                const i = text.indexOf(w);
                if (i < 0) { ok = false; break; }
                score += i === 0 ? 40 : /[\s(,-]/.test(text[i - 1]) ? 20 : 2;
            }
        }
        if (ok) out.push([score - p.title.length / 100, p]);
    }
    out.sort((a, b) => b[0] - a[0] || a[1].part.localeCompare(b[1].part, undefined, {numeric: true}));
    return {total: out.length, results: out.slice(0, limit).map(([, p]) => p)};
};

/**
 * The parts a search finds, best first (then the shorter name, then by name in the learner's
 * language), as palette items; an empty query finds nothing (the palette then
 * shows its categories).
 * @returns {{part: string, name: string, nameEn: string, nameDe: string, number: string}[]}
 */
export const searchPalette = (catalog, query, {locale = 'en'} = {}) => {
    const map = catalog instanceof Map ? catalog : new Map(Object.entries(catalog || {}));
    const found = [];
    for (const [part, meta] of map.entries()) {
        const score = searchScore(part, meta, query);
        if (score > 0) found.push({score, part, name: locale === 'de' && meta.nameDe ? meta.nameDe : meta.name, nameEn: meta.name, nameDe: meta.nameDe, number: partNumber(part)});
    }
    // Equal scores: the shorter name first (it is more nearly what was typed: "Lochbalken 7"
    // is the beam 7 before the liftarm 3 x 7 bent), then by name.
    return found.sort((a, b) => b.score - a.score || a.name.length - b.name.length || a.name.localeCompare(b.name, locale, {numeric: true}))
        .map(({score, ...item}) => item);
};

/**
 * A camera that shows a part whole in a square-ish thumbnail: looking at the
 * centre of the part's bounds from `direction` (world, y up: the editor's Home
 * view, from the front-right above), at the distance where every corner of the
 * bounds is inside the view (with `margin` to spare), not further. Pure
 * arithmetic on plain arrays, so it is tested headless.
 * @param {{min: number[], max: number[]}} bounds world metres
 * @param {{fov?: number, aspect?: number, direction?: number[], margin?: number}} [options] vertical fov in degrees
 * @returns {{position: number[], target: number[], up: number[], fov: number, aspect: number, near: number, far: number}}
 */
export const thumbnailCamera = (bounds, {fov = 30, aspect = 1, direction = [1, 0.8, 1.2], margin = 1.08} = {}) => {
    const sub = (a, b) => a.map((v, i) => v - b[i]);
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const unit = a => { const l = Math.hypot(...a); return a.map(v => v / l); };
    const target = bounds.min.map((v, i) => (v + bounds.max[i]) / 2);
    const back = unit(direction); // from the target toward the camera
    const right = unit(cross([0, 1, 0], back));
    const up = cross(back, right);
    const tanV = Math.tan(fov * Math.PI / 360);
    const tanH = tanV * aspect;
    let distance = 0;
    let reach = 0;
    for (let k = 0; k < 8; k++) {
        const corner = [0, 1, 2].map(i => ((k >> i) & 1 ? bounds.max[i] : bounds.min[i]));
        const c = sub(corner, target);
        const z = dot(c, back);
        // In front of the camera at distance D, the corner's depth is D - z: it is in view when
        // |x| <= (D - z)·tanH and |y| <= (D - z)·tanV.
        distance = Math.max(distance, z + Math.abs(dot(c, right)) * margin / tanH, z + Math.abs(dot(c, up)) * margin / tanV);
        reach = Math.max(reach, Math.hypot(...c));
    }
    distance = Math.max(distance, reach * 1.01, 1e-4);
    return {
        position: target.map((v, i) => v + back[i] * distance), target, up: [0, 1, 0], fov, aspect,
        near: Math.max(1e-5, (distance - reach) * 0.5), far: distance + reach * 2
    };
};

// Derived from LDConfig.ldr: opaque, non-metallic, non-rubber (no ALPHA, no MATERIAL)
export const getSolidColors = ldconfigText => {
    const colors = parseLDConfig(ldconfigText);
    const solids = [];
    for (const line of ldconfigText.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('0 !COLOUR')) continue;
        const codeMatch = trimmed.match(/\bCODE\s+(\d+)/i);
        const alphaMatch = trimmed.match(/\bALPHA\b/i);
        const matMatch = trimmed.match(/\bMATERIAL\b/i);
        if (!codeMatch) continue;
        const code = parseInt(codeMatch[1], 10);
        if (alphaMatch || matMatch) continue;
        if (colors.has(code)) solids.push(code);
    }
    return solids.sort((a, b) => a - b);
};

export let SOLID_COLORS = [];
try {
    const {readFileSync} = await import('node:fs');
    const {join, dirname} = await import('node:path');
    const {fileURLToPath} = await import('node:url');
    const p = join(dirname(fileURLToPath(import.meta.url)), '../../../../static/ldraw/LDConfig.ldr');
    const text = readFileSync(p, 'utf8');
    SOLID_COLORS = getSolidColors(text);
} catch {}
