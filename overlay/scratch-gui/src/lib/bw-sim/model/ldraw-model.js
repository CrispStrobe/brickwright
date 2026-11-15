// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// LDraw model reader/writer for the PlacedModel contract.
// Pure text <-> PlacedModel, no DOM. Handles .ldr and .mpd (first FILE is
// main, type-1 lines referencing other FILE sections are flattened with
// composed transforms). Generates refusals for lossy or malformed lines.
// `0 STEP` lines in the main model become `model.steps` (part ids per building
// step, for instructions/steps.js); a model without them has no `steps` key and
// is written back exactly as before.
//
// Limits, so a hostile or broken file is refused by name rather than hanging the
// page: sub-models nest at most MAX_DEPTH deep (`too-deep`), a model flattens to at
// most MAX_PARTS parts (`too-many-parts`: nothing is opened), and a coordinate
// beyond MAX_COORDINATE LDU is `out-of-range`. A part matrix must be a rotation
// (orthonormal, determinant +1). A scaled or sheared one is a flexible element's segment (a cable,
// a hose, a string, a rubber band as LDCad and Studio lay them: one short part stretched along its
// way, many times) or a mirrored part: it is DECORATION, `model.decor` [{part, color, position,
// matrix}], drawn as the file has it, never simulated or edited, and written back as it was read.
// Only a matrix that flattens (determinant ~0) or is not finite is `bad-matrix`.

import {validateInternalEdgeRemovalPairs, det3} from '../contracts.js';

/** Port ids a `0 !BW PORT` line may name: hub output letters, and the numbered inputs of the RCX (1–3) and NXT/EV3 (1–4). */
const HUB_PORTS = new Set(['A', 'B', 'C', 'D', 'E', 'F', '1', '2', '3', '4']);

/** Deepest sub-model nesting opened (main model = 0). */
export const MAX_DEPTH = 32;
/** Most parts a model may flatten to: ten times the 2,054-part stress model, already far beyond what Build and the physics handle. */
export const MAX_PARTS = 20000;
/** Largest coordinate accepted, in LDU (400 m). */
export const MAX_COORDINATE = 1e6;

/** LDraw's "main colour": a part in it takes the colour its sub-model is placed in. */
const MAIN_COLOUR = 16;
/** First LDraw direct colour (0x2RRGGBB), written in hex as LDraw requires. */
const DIRECT_COLOUR = 0x2000000;
/** An LDraw number: decimal, optional sign, fraction and exponent (no hex, no NaN/Infinity). */
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

/** Normalize LDraw filename: lower case, forward slashes. */
const normalizeFile = s => s.trim().replace(/\\/g, '/').toLowerCase();

/** Format a number for LDraw: integers without decimal, others at the selected precision, never -0. */
const formatNumber = (n, precision = 6) => {
    if (Object.is(n, -0)) n = 0;
    const rounded = Math.round(n);
    if (Number.isInteger(n) || (precision === 6 && Math.abs(n - rounded) < 1e-9)) return String(rounded);
    let s = n.toFixed(precision);
    s = s.replace(/\.?0+$/, '');
    if (s === '-0') s = '0';
    return s;
};

/** Largest |R·Rᵀ − I| entry a matrix may have and still be read as a rotation. */
const ROTATION_TOLERANCE = 0.02;
/** Below this, a rotation is kept exactly as written (it is one to the precision files carry). */
const ROTATION_EXACT = 1e-5;

/** The largest entry of |R·Rᵀ − I|. */
const orthoError = m => {
    let worst = 0;
    for (let r = 0; r < 3; r++) {
        for (let c = r; c < 3; c++) {
            const dot = m[r * 3] * m[c * 3] + m[r * 3 + 1] * m[c * 3 + 1] + m[r * 3 + 2] * m[c * 3 + 2];
            worst = Math.max(worst, Math.abs(dot - (r === c ? 1 : 0)));
        }
    }
    return worst;
};

/**
 * Whether a matrix is a proper rotation: positive determinant and orthonormal rows within
 * ROTATION_TOLERANCE. Files written with three decimals (MLCad: 0.674 -0.738 …) are off by
 * about 1e-3; a mirror (det −1), a scale or a shear (which can have determinant 1) is not.
 */
const isProperRotation = m => m.every(Number.isFinite) && det3(m) > 0 && orthoError(m) <= ROTATION_TOLERANCE;
/** A placement drawn but not simulated: finite, not flat (a stretched segment, a mirrored part). */
const isDecorMatrix = m => m.every(Number.isFinite) && Math.abs(det3(m)) > 1e-6;

/**
 * The rotation a file meant: as written when it is one to ROTATION_EXACT (so our own files read
 * back unchanged), else the nearest rotation (polar decomposition, R ← (R + R⁻ᵀ)/2).
 */
const asRotation = m => {
    if (orthoError(m) <= ROTATION_EXACT) return m;
    let r = m;
    for (let k = 0; k < 8 && orthoError(r) > 1e-12; k++) {
        const d = det3(r);
        // R⁻ᵀ = cofactor matrix / det.
        const cof = [
            r[4] * r[8] - r[5] * r[7], r[5] * r[6] - r[3] * r[8], r[3] * r[7] - r[4] * r[6],
            r[2] * r[7] - r[1] * r[8], r[0] * r[8] - r[2] * r[6], r[1] * r[6] - r[0] * r[7],
            r[1] * r[5] - r[2] * r[4], r[2] * r[3] - r[0] * r[5], r[0] * r[4] - r[1] * r[3]
        ];
        r = r.map((v, i) => (v + cof[i] / d) / 2);
    }
    return r;
};

/** Whether every coordinate is within MAX_COORDINATE. */
const inRange = v => v.every(x => Math.abs(x) <= MAX_COORDINATE);

/** A colour as LDraw writes it: a direct colour as 0x2RRGGBB, any other as its decimal code. */
const formatColour = c => (Number.isInteger(c) && c >= DIRECT_COLOUR ? `0x${c.toString(16).toUpperCase()}` : String(c));

/** Matrix multiply 3x3 row-major: a * b */
const matMul = (a, b) => [
    a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
    a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
    a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
    a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
    a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
    a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
    a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
    a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
    a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
];

/** Mat3 * Vec3 */
const matVec = (m, v) => [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];

/**
 * Parse a type-1 line into {color, position, rotation, file} or null if not type-1.
 * Returns {color, position:[x,y,z], rotation:[a..i], file} or {error}
 */
const parseType1 = line => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('1')) return null;
    const tokens = trimmed.split(/\s+/);
    if (tokens[0] !== '1') return null;
    if (tokens.length < 15) return {error: 'too few tokens'};
    const colorStr = tokens[1].trim();
    let color;
    if (/^0x[0-9a-f]{1,8}$/i.test(colorStr)) {
        color = Number.parseInt(colorStr, 16);
    } else if (/^\d{1,9}$/.test(colorStr)) {
        color = Number.parseInt(colorStr, 10);
    } else {
        return {error: 'bad color'};
    }
    if (!tokens.slice(2, 14).every(s => NUMBER.test(s))) return {error: 'bad numbers'};
    const nums = tokens.slice(2, 14).map(Number);
    if (nums.some(n => !Number.isFinite(n))) return {error: 'bad numbers'};
    const fileRaw = tokens.slice(14).join(' ').trim();
    if (!fileRaw) return {error: 'missing file'};
    return {
        color,
        position: nums.slice(0, 3),
        rotation: nums.slice(3, 12),
        fileRaw,
        file: normalizeFile(fileRaw),
    };
};

/**
 * Every file name a model's type-1 lines refer to (normalised as parseModel looks them up in
 * the catalog: trimmed, forward slashes, lower case) — parts and an MPD's own sub-models alike.
 * The pane asks this before parsing, to load the rest of the part catalogue when a name is not
 * in the part of it already loaded (sim-lab.js catalogFor).
 * @param {string} text LDraw
 * @returns {Set<string>}
 */
export const referencedFiles = text => {
    const out = new Set();
    for (const line of text.split(/\r?\n/)) {
        const parsed = parseType1(line);
        if (parsed && !parsed.error) out.add(parsed.file);
    }
    return out;
};

/**
 * LDraw assemblies that are a catalogue part with its cable: the file places the part unmoved and
 * then the cable's segments (a coiled cable sticking out of the motor's back). Such a line is the
 * part itself, drawn and simulated without the cable (a stiff coil would only collide with the
 * model it hangs through).
 */
export const WITH_CABLE = Object.freeze({'99498c01.dat': '99498.dat', '22169c01.dat': '22169.dat', '22172c01.dat': '22172.dat'});

/**
 * Parse LDraw text into PlacedModel and refusals.
 * @param {string} text
 * @param {{catalog?: Map|object}} opts
 * @returns {{model: {version:number, parts:Array}, refusals:Array}}
 */
export const parseModel = (text, {catalog} = {}) => {
    const catalogMap = catalog instanceof Map ? catalog : (catalog && typeof catalog === 'object' ? new Map(Object.entries(catalog)) : null);
    const refusals = [];
    const parts = [];
    const decor = []; // flexible elements' segments and mirrored parts (isDecorMatrix): drawn, not simulated

    // Split lines preserving line numbers, handle CRLF/LF
    const rawLines = text.split(/\r?\n/);
    // We need to handle that text may end with CRLF, split will produce trailing empty string — keep it but ignore empty lines later
    // Detect MPD: any line matching /^0\s+FILE\s+/i
    const hasMpd = rawLines.some(l => /^\s*0\s+FILE\s+/i.test(l));

    const fileSections = new Map();
    /** A FILE section; the first of two with one name wins (as in LDraw editors). */
    const addSection = (name, lines) => {
        const key = normalizeFile(name);
        if (fileSections.has(key)) return;
        const org = lines.map(l => /^\s*0\s+!LDRAW_ORG\s+(\S+)/i.exec(l.text)).find(Boolean);
        const isPart = org ? /^(?:Unofficial_)?(?:Part|Subpart|Primitive|8_Primitive|48_Primitive|Shortcut)\b/i.test(org[1]) :
            /\.dat$/.test(key);
        fileSections.set(key, {name, lines, isPart});
    };
    let mainLines = [];
    let firstFileName = null;

    if (hasMpd) {
        // Parse MPD sections
        let currentFile = null;
        let currentLines = [];
        for (let i = 0; i < rawLines.length; i++) {
            const line = rawLines[i];
            const lineNo = i + 1;
            const trimmed = line.trim();
            const fileMatch = trimmed.match(/^0\s+FILE\s+(.+?)\s*$/i);
            if (fileMatch) {
                if (currentFile !== null) {
                    addSection(currentFile, currentLines);
                }
                currentFile = fileMatch[1].trim();
                if (!firstFileName) firstFileName = currentFile;
                currentLines = [];
                continue;
            }
            const noFileMatch = /^0\s+NOFILE\s*$/i.test(trimmed);
            if (noFileMatch) {
                if (currentFile !== null) {
                    addSection(currentFile, currentLines);
                    currentFile = null;
                    currentLines = [];
                }
                continue;
            }
            if (currentFile !== null) {
                currentLines.push({text: line, lineNo});
            } else {
                // Lines before first FILE are ignored (MPD header)
            }
        }
        if (currentFile !== null) {
            addSection(currentFile, currentLines);
        }
        if (firstFileName) {
            const mainSec = fileSections.get(normalizeFile(firstFileName));
            mainLines = mainSec ? mainSec.lines : [];
        }
    } else {
        // Single model: all lines are main
        mainLines = rawLines.map((text, idx) => ({text, lineNo: idx + 1}));
    }

    // Helper to check if file is sub-model (exists in fileSections)
    // An embedded part (a `.dat` section, or one whose `!LDRAW_ORG` says Part, Subpart,
    // Primitive or Shortcut: the MPD way to ship an unofficial part) is a part, not a sub-model:
    // placed as the catalog's part of that name, or refused once as unknown — never opened up
    // into the primitives it is drawn from.
    const isSubModel = file => fileSections.has(file) && !fileSections.get(file).isPart;
    /**
     * The catalogue part a name the catalogue lacks stands for: an MPD's own copy of a library part, renamed as
     * mirrors and LDCad do it ('42099 - 22169.dat' is 22169.dat, the Technic L motor), and another print of a
     * part ('54696p02.dat', the motor with another face print: 54696p01.dat, the catalogue's). null if none.
     */
    const knownAs = file => {
        if (!catalogMap) return null;
        const bare = /^.+? - (.+\.dat)$/.exec(file)?.[1] || file;
        if (catalogMap.has(bare)) return bare;
        if (WITH_CABLE[bare] && catalogMap.has(WITH_CABLE[bare])) return WITH_CABLE[bare];
        const printed = /^(.+?)p[0-9a-z]{2}\.dat$/.exec(bare);
        if (printed) for (const alt of [`${printed[1]}p01.dat`, `${printed[1]}.dat`]) if (catalogMap.has(alt)) return alt;
        return null;
    };

    // State for main model
    let pendingPort = null; // string or null
    let pendingRotor = null;
    let pendingSlides = [];
    let pendingLoad = false; // intentional free payload, placed by contact rather than a connector
    let pendingPen = false; // a `0 !BW PEN` line: the next part draws on the floor
    let pendingId = null;
    let pendingGroup = null; // groupId or null
    const seenIds = new Set();
    const drawings = [];
    // Ids the main model gives explicitly: a generated id (p<n>) never takes one of them.
    const reservedIds = new Set();
    for (const {text: line} of mainLines) {
        const m = /^\s*0\s+!BW\s+ID\s+(.+?)\s*$/i.exec(line);
        if (m) reservedIds.add(m[1]);
    }
    let nextId = 1;
    const generatedId = () => {
        let id;
        do id = `p${nextId++}`; while (seenIds.has(id) || reservedIds.has(id));
        return id;
    };
    const groupsById = new Map(); // id -> {id, name, parts: []}
    const groupOrder = []; // to preserve order
    const belts = []; // `0 !BW BELT id band part…` lines, checked against the parts at the end
    const ropes = []; // `0 !BW ROPE id lengthLdu drum sheave… hook` lines, likewise
    const hoses = []; // `0 !BW HOSE id part port part port` lines, likewise
    const partToGroup = new Map(); // partId -> groupId (for checking duplicate part in two groups)
    // Building steps: `0 STEP` (or `0 ROTSTEP …`) in the main model ends a step (instructions/steps.js).
    const steps = [];
    let stepParts = [];
    let sawStep = false;
    // Work done flattening sub-models (lines visited), bounded so a sub-model placing another
    // twice, 30 levels deep, is refused rather than expanded to a billion parts.
    let work = 0;
    let overflow = false;
    const WORK_LIMIT = 4 * MAX_PARTS;

    /** The placement of a type-1 line inside a parent placed at (parentPos, parentRot). */
    const compose = (parentPos, parentRot, parsed) => {
        const offset = matVec(parentRot, parsed.position);
        return {
            position: [parentPos[0] + offset[0], parentPos[1] + offset[1], parentPos[2] + offset[2]],
            rotation: matMul(parentRot, parsed.rotation),
        };
    };

    /**
     * The leaf parts of sub-model `subFileName` placed at (parentPos, parentRot) in colour
     * `parentColor` (a part in colour 16 inside it takes that colour). `path` is the line
     * numbers (1-based within each section) of the instances leading here, for the ids;
     * `visited` the sub-models on the way down (a sub-model inside itself is a cycle). The
     * parts are appended to `result`.
     */
    const flattenSubModel = (subFileName, parentPos, parentRot, parentColor, path, visited, depth, result) => {
        const norm = normalizeFile(subFileName);
        const sec = fileSections.get(norm);
        if (!sec) return result;
        let localPendingRotor = null;
        let localPendingSlides = [];
        let localPendingLoad = false;
        let localPendingPen = false;
        let localPendingPort = null;
        let localPendingId = null;
        for (let i = 0; i < sec.lines.length; i++) {
            if (overflow) return result;
            if (++work > WORK_LIMIT) {
                overflow = true;
                return result;
            }
            const {text: line, lineNo} = sec.lines[i];
            const trimmed = line.trim();
            if (!trimmed) continue;
            if (/^0\s+!BW\s+ROTOR(?:\s|$)/i.test(trimmed)) {
                const raw = trimmed.replace(/^0\s+!BW\s+ROTOR\s*/i, '').trim();
                const v = raw ? Number(raw) : NaN;
                localPendingRotor = Number.isFinite(v) ? v % 360 : null;
                if (localPendingRotor === null) refusals.push({line: lineNo, code: 'bad-rotor', message: 'ROTOR needs a finite angle in degrees'});
                continue;
            }
            if (/^0\s+!BW\s+SLIDE(?:\s|$)/i.test(trimmed)) {
                localPendingSlides = trimmed.replace(/^0\s+!BW\s+SLIDE\s*/i, '').trim().split(/\s+/).filter(Boolean);
                if (!localPendingSlides.length) refusals.push({line: lineNo, code: 'bad-slide', message: 'SLIDE needs round-bore connector IDs'});
                continue;
            }
            if (/^0\s+!BW\s+LOAD\s*$/i.test(trimmed)) { localPendingLoad = true; continue; }
            if (/^0\s+!BW\s+PEN\s*$/i.test(trimmed)) { localPendingPen = true; continue; }
            if (/^0\s+!BW\s+PORT\s+/i.test(trimmed)) {
                const m = trimmed.match(/^0\s+!BW\s+PORT\s+(.+?)\s*$/i);
                const val = m ? m[1].trim() : '';
                if (!HUB_PORTS.has(val)) {
                    refusals.push({line: lineNo, code: 'bad-port', message: `Bad port '${val}' at line ${lineNo}`});
                    localPendingPort = null;
                } else {
                    localPendingPort = val;
                }
                continue;
            }
            if (/^0\s+!BW\s+ID\s+/i.test(trimmed)) {
                const m = trimmed.match(/^0\s+!BW\s+ID\s+(.+?)\s*$/i);
                const val = m ? m[1].trim() : '';
                if (!val) {
                    refusals.push({line: lineNo, code: 'unparsable', message: `Bad ID at line ${lineNo}`});
                    localPendingId = null;
                } else {
                    localPendingId = val;
                }
                continue;
            }
            const parsed = parseType1(line);
            if (parsed && !parsed.error) {
                const pendingSlidesHere = localPendingSlides;
                localPendingSlides = [];
                const pendingRotorHere = localPendingRotor;
                localPendingRotor = null;
                const pendingPenHere = localPendingPen;
                localPendingPen = false;
                const pendingLoadHere = localPendingLoad;
                localPendingLoad = false;
                const pendingPortHere = localPendingPort;
                const pendingIdHere = localPendingId;
                localPendingPort = null;
                localPendingId = null;
                if (!isProperRotation(parsed.rotation)) {
                    if (isDecorMatrix(parsed.rotation)) {
                        const placedDecor = compose(parentPos, parentRot, parsed);
                        const colorDecor = parsed.color === MAIN_COLOUR ? parentColor : parsed.color;
                        if (isSubModel(parsed.file)) {
                            // A stretched sub-model (LDCad's cable segment): its parts, stretched with it, are decoration.
                            if (!visited.has(parsed.file) && depth + 1 <= MAX_DEPTH) {
                                path.push(i + 1);
                                visited.add(parsed.file);
                                flattenSubModel(parsed.file, placedDecor.position, placedDecor.rotation, colorDecor, path, visited, depth + 1, result);
                                visited.delete(parsed.file);
                                path.pop();
                            }
                        } else if (inRange(placedDecor.position)) {
                            decor.push({part: parsed.file, color: colorDecor, position: placedDecor.position, matrix: placedDecor.rotation});
                        }
                        continue;
                    }
                    refusals.push({line: lineNo, code: 'bad-matrix', message: `Bad matrix at line ${lineNo} det=${det3(parsed.rotation).toFixed(4)}`});
                    continue;
                }
                parsed.rotation = asRotation(parsed.rotation);
                const placed = compose(parentPos, parentRot, parsed);
                if (!inRange(parsed.position) || !inRange(placed.position)) {
                    refusals.push({line: lineNo, code: 'out-of-range', message: `Line ${lineNo} places something more than ${MAX_COORDINATE} LDU away`});
                    continue;
                }
                const color = parsed.color === MAIN_COLOUR ? parentColor : parsed.color;
                if (isSubModel(parsed.file)) {
                    // A nested sub-model: its own port/id lines do not apply to its parts.
                    if (visited.has(parsed.file)) {
                        refusals.push({line: lineNo, code: 'cycle', message: `Cycle detected at '${parsed.fileRaw}'`});
                        continue;
                    }
                    if (depth + 1 > MAX_DEPTH) {
                        refusals.push({line: lineNo, code: 'too-deep', message: `Line ${lineNo} nests sub-models more than ${MAX_DEPTH} deep`});
                        continue;
                    }
                    // `path` and `visited` are the way down: extended for the call, restored after.
                    path.push(i + 1);
                    visited.add(parsed.file);
                    flattenSubModel(parsed.file, placed.position, placed.rotation, color, path, visited, depth + 1, result);
                    visited.delete(parsed.file);
                    path.pop();
                    continue;
                }
                if (catalogMap && !catalogMap.has(parsed.file) && knownAs(parsed.file)) parsed.file = knownAs(parsed.file);
                if (catalogMap && !catalogMap.has(parsed.file)) {
                    // Drawn where it is, not simulated: the note says so (a part LDraw has that we do not know yet).
                    refusals.push({line: lineNo, code: 'unknown-part', message: `Unknown part '${parsed.fileRaw}' at line ${lineNo}`});
                    decor.push({part: parsed.file, color, position: placed.position, matrix: placed.rotation});
                    continue;
                }
                // Id: an explicit !BW ID (once), else one from the path of instances.
                let id = `${norm}#${path.join('_')}_${i + 1}`;
                if (pendingIdHere && !seenIds.has(pendingIdHere)) {
                    id = pendingIdHere;
                } else if (pendingIdHere) {
                    refusals.push({line: lineNo, code: 'duplicate-id', message: `Duplicate id '${pendingIdHere}' at line ${lineNo}`, parts: [id]});
                }
                while (seenIds.has(id) || reservedIds.has(id)) id = `${id}'`;
                seenIds.add(id);
                const part = {id, part: parsed.file, color, position: placed.position, rotation: placed.rotation};
                if (pendingPortHere) part.port = pendingPortHere;
                if (pendingSlidesHere.length) part.slides = pendingSlidesHere;
                if (pendingLoadHere) part.load = true;
                if (pendingPenHere) part.pen = true;
                if (pendingRotorHere !== null) part.rotorAngle = pendingRotorHere;
                result.push(part);
                if (parts.length + result.length > MAX_PARTS) {
                    overflow = true;
                    return result;
                }
            } else if (/^[2-5]\s/.test(trimmed)) {
                // Loose geometry inside a sub-model: drawn by the sub-model, not a part (ignored).
                continue;
            } else if (trimmed.startsWith('0')) {
                // Other meta or comment (0 FILE/NOFILE do not reach here).
                continue;
            } else {
                refusals.push({line: lineNo, code: 'unparsable', message: `Unparsable line ${lineNo}: ${trimmed}`});
                localPendingPort = null;
                localPendingId = null;
            }
        }
        return result;
    };

    const mainName = firstFileName ? normalizeFile(firstFileName) : null;
    /** A main-model line was not placed: what was pending for it does not pass to the next part. */
    const dropPending = () => {
        pendingPort = null;
        pendingPen = false;
        pendingLoad = false;
        pendingRotor = null;
        pendingSlides = [];
        pendingId = null;
        pendingGroup = null;
    };

    // Process main model lines
    for (let idx = 0; idx < mainLines.length && !overflow; idx++) {
        const {text: line, lineNo} = mainLines[idx];
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (/^0\s+(?:STEP|ROTSTEP)(?:\s|$)/i.test(trimmed)) {
            if (stepParts.length) steps.push(stepParts);
            stepParts = [];
            sawStep = true;
            continue;
        }
        if (/^0\s+!BW\s+SLIDE(?:\s|$)/i.test(trimmed)) {
            pendingSlides = trimmed.replace(/^0\s+!BW\s+SLIDE\s*/i, '').trim().split(/\s+/).filter(Boolean);
            if (!pendingSlides.length) refusals.push({line: lineNo, code: 'bad-slide', message: 'SLIDE needs round-bore connector IDs'});
            continue;
        }
        if (/^0\s+!BW\s+LOAD\s*$/i.test(trimmed)) { pendingLoad = true; continue; }
        if (/^0\s+!BW\s+PEN\s*$/i.test(trimmed)) {
            pendingPen = true;
            continue;
        }
        if (/^0\s+!BW\s+ROTOR(?:\s|$)/i.test(trimmed)) {
            const raw = trimmed.replace(/^0\s+!BW\s+ROTOR\s*/i, '').trim();
            const v = raw ? Number(raw) : NaN;
            pendingRotor = Number.isFinite(v) ? v % 360 : null;
            if (pendingRotor === null) refusals.push({line: lineNo, code: 'bad-rotor', message: 'ROTOR needs a finite angle in degrees'});
            continue;
        }
        // Check for !BW PORT
        if (/^0\s+!BW\s+PORT\s+/i.test(trimmed)) {
            const m = trimmed.match(/^0\s+!BW\s+PORT\s+(.+?)\s*$/i);
            const val = m ? m[1].trim() : '';
            if (!HUB_PORTS.has(val)) {
                refusals.push({line: lineNo, code: 'bad-port', message: `Bad port '${val}' at line ${lineNo}`});
                pendingPort = null;
            } else {
                pendingPort = val;
            }
            continue;
        }
        if (/^0\s+!BW\s+ID\s+/i.test(trimmed)) {
            const m = trimmed.match(/^0\s+!BW\s+ID\s+(.+?)\s*$/i);
            const val = m ? m[1].trim() : '';
            if (!val) {
                refusals.push({line: lineNo, code: 'unparsable', message: `Bad ID at line ${lineNo}`});
                pendingId = null;
            } else {
                pendingId = val;
            }
            continue;
        }
        if (/^0\s+!BW\s+DRAW(\s|$)/i.test(trimmed)) {
            // Flat-model binding: paper part, pen carrier, carrier-local tip, paper-local centre, radius (LDU).
            const words = trimmed.split(/\s+/).slice(3);
            const values = words.slice(2).map(Number);
            if (words.length !== 9 || !words.slice(2).every(w => NUMBER.test(w)) ||
                !values.every(n => Number.isFinite(n) && Math.abs(n) <= MAX_COORDINATE) || values[6] <= 0) {
                refusals.push({line: lineNo, code: 'bad-drawing', message: `Bad DRAW at line ${lineNo}`});
            } else drawings.push({line: lineNo, surface: words[0], pen: words[1], tip: values.slice(0, 3),
                center: values.slice(3, 6), radiusLdu: values[6]});
            continue;
        }
        if (/^0\s+!BW\s+HOSE(\s|$)/i.test(trimmed)) {
            const w = trimmed.split(/\s+/).slice(3);
            if (w.length !== 5) refusals.push({line: lineNo, code: 'bad-hose', message: `Bad HOSE at line ${lineNo}`});
            else hoses.push({line: lineNo, id: w[0], a: {part: w[1], port: w[2]}, b: {part: w[3], port: w[4]}});
            continue;
        }
        if (/^0\s+!BW\s+ROPE(\s|$)/i.test(trimmed)) {
            const words = trimmed.split(/\s+/).slice(3);
            const len = Number(words[1]);
            if (words.length < 4 || !(len > 0)) refusals.push({line: lineNo, code: 'bad-rope', message: `Bad ROPE at line ${lineNo}`});
            else ropes.push({line: lineNo, id: words[0], lengthLdu: len, around: words.slice(2)});
            continue;
        }
        if (/^0\s+!BW\s+BELT(\s|$)/i.test(trimmed)) {
            const words = trimmed.split(/\s+/).slice(3);
            if (words.length < 4) refusals.push({line: lineNo, code: 'bad-belt', message: `Bad BELT at line ${lineNo}`});
            else belts.push({line: lineNo, id: words[0], band: words[1], around: words.slice(2)});
            continue;
        }
        if (/^0\s+!BW\s+GROUP(\s|$)/i.test(trimmed)) {
            const m = trimmed.match(/^0\s+!BW\s+GROUP\s+(\S+)\s+(.+?)\s*$/i);
            if (!m) {
                refusals.push({line: lineNo, code: 'bad-group', message: `Bad GROUP at line ${lineNo}`});
            } else {
                const gid = m[1].trim();
                const gname = m[2].trim();
                if (!gid || !gname) {
                    refusals.push({line: lineNo, code: 'bad-group', message: `Bad GROUP at line ${lineNo}`});
                } else if (groupsById.has(gid)) {
                    refusals.push({line: lineNo, code: 'duplicate-group', message: `Duplicate group '${gid}' at line ${lineNo}`});
                } else {
                    const g = {id: gid, name: gname, parts: []};
                    groupsById.set(gid, g);
                    groupOrder.push(gid);
                }
            }
            continue;
        }
        if (/^0\s+!BW\s+IN(\s|$)/i.test(trimmed)) {
            const m = trimmed.match(/^0\s+!BW\s+IN\s+(\S+)\s*$/i);
            if (!m) {
                refusals.push({line: lineNo, code: 'bad-group', message: `Bad IN at line ${lineNo}`});
                pendingGroup = null;
            } else {
                const gid = m[1].trim();
                if (!groupsById.has(gid)) {
                    refusals.push({line: lineNo, code: 'unknown-group', message: `Unknown group '${gid}' at line ${lineNo}`});
                    pendingGroup = null;
                } else {
                    pendingGroup = gid;
                }
            }
            continue;
        }
        const parsed = parseType1(line);
        if (parsed && !parsed.error) {
            if (!isProperRotation(parsed.rotation)) {
                if (isDecorMatrix(parsed.rotation) && isSubModel(parsed.file)) {
                    // A stretched sub-model (LDCad's cable segment): its parts, stretched with it, are decoration.
                    flattenSubModel(parsed.file, parsed.position, parsed.rotation, parsed.color, [idx + 1], new Set([mainName, parsed.file]), 1, []);
                } else if (isDecorMatrix(parsed.rotation) && inRange(parsed.position)) {
                    decor.push({part: parsed.file, color: parsed.color, position: parsed.position, matrix: parsed.rotation});
                } else {
                    refusals.push({line: lineNo, code: 'bad-matrix', message: `Bad matrix at line ${lineNo} det=${det3(parsed.rotation).toFixed(4)}`});
                }
                dropPending();
                continue;
            }
            parsed.rotation = asRotation(parsed.rotation);
            if (!inRange(parsed.position)) {
                refusals.push({line: lineNo, code: 'out-of-range', message: `Line ${lineNo} places something more than ${MAX_COORDINATE} LDU away`});
                dropPending();
                continue;
            }
            if (isSubModel(parsed.file)) {
                // A sub-model instance is not a part: the port, id and group meant for it do not
                // pass to its parts (they get ids from their path) nor to the next part.
                dropPending();
                if (parsed.file === mainName) {
                    refusals.push({line: lineNo, code: 'cycle', message: `Cycle detected at '${parsed.fileRaw}'`});
                    continue;
                }
                const subParts = flattenSubModel(parsed.file, parsed.position, parsed.rotation, parsed.color, [idx + 1],
                    new Set([mainName, parsed.file]), 1, []);
                for (const p of subParts) {
                    parts.push(p);
                    stepParts.push(p.id);
                }
                continue;
            }
            if (catalogMap && !catalogMap.has(parsed.file) && knownAs(parsed.file)) parsed.file = knownAs(parsed.file);
            if (catalogMap && !catalogMap.has(parsed.file)) {
                // Drawn where it is, not simulated: the note says so.
                refusals.push({line: lineNo, code: 'unknown-part', message: `Unknown part '${parsed.fileRaw}' at line ${lineNo}`});
                decor.push({part: parsed.file, color: parsed.color, position: parsed.position, matrix: parsed.rotation});
                dropPending();
                continue;
            }
            if (++work > WORK_LIMIT) {
                overflow = true;
                break;
            }
            // Determine id
            let id;
            if (pendingId && !seenIds.has(pendingId)) {
                id = pendingId;
            } else {
                id = generatedId();
                if (pendingId) refusals.push({line: lineNo, code: 'duplicate-id', message: `Duplicate id '${pendingId}' at line ${lineNo}`, parts: [id]});
            }
            seenIds.add(id);
            const part = {id, part: parsed.file, color: parsed.color, position: parsed.position, rotation: parsed.rotation};
            if (pendingPort) part.port = pendingPort;
            if (pendingPen) part.pen = true;
            if (pendingSlides.length) part.slides = [...pendingSlides];
            if (pendingLoad) part.load = true;
            if (pendingRotor !== null) part.rotorAngle = pendingRotor;
            if (pendingGroup) {
                const g = groupsById.get(pendingGroup);
                if (partToGroup.has(id)) {
                    refusals.push({line: lineNo, code: 'bad-group', message: `Part '${id}' is in two groups at line ${lineNo}`, parts: [id]});
                } else {
                    g.parts.push(id);
                    partToGroup.set(id, pendingGroup);
                }
            }
            pendingPort = null;
            pendingPen = false;
            pendingLoad = false;
            pendingRotor = null;
            pendingSlides = [];
            pendingId = null;
            pendingGroup = null;
            parts.push(part);
            stepParts.push(id);
            continue;
        }
        if (/^[2-5]\s/.test(trimmed)) {
            refusals.push({line: lineNo, code: 'loose-geometry', message: `Loose geometry at line ${lineNo}`});
            dropPending();
            continue;
        }
        // Any other meta or comment (0 Name, 0 Author, …) is ignored and leaves what is pending
        // for the next part: `0 !BW PORT` applies to the next type-1 line.
        if (trimmed.startsWith('0')) continue;
        refusals.push({line: lineNo, code: 'unparsable', message: `Unparsable line ${lineNo}: ${trimmed}`});
        dropPending();
    }

    if (overflow || parts.length > MAX_PARTS) {
        // Not half a model: nothing is opened, and the one note says why.
        return {
            model: {version: 1, parts: []},
            refusals: [{line: 0, code: 'too-many-parts', message: `The model has more than ${MAX_PARTS} parts (sub-models included)`}]
        };
    }

    const model = {version: 1, parts};
    // One model-wide setting in the main section. Embedded parts/submodels do
    // not override the receiving model's compatibility choice.
    const directionLines = mainLines.filter(l => /^\s*0\s+!BW\s+MOTOR_DIRECTION(?:\s|$)/i.test(l.text));
    if (directionLines.length) {
        const value = directionLines[0].text.trim().replace(/^0\s+!BW\s+MOTOR_DIRECTION\s*/i, '').trim();
        if (directionLines.length !== 1 || !['legacy', 'motor-frame'].includes(value)) {
            model.motorDirection = 'invalid';
            refusals.push({line: directionLines[0].lineNo, severity: 'error', code: 'bad-motor-direction',
                message: 'MOTOR_DIRECTION needs exactly one legacy or motor-frame setting in the main model'});
        } else model.motorDirection = value;
    }
    // The motor rotor treatment, likewise once in the main section (#1494): 'legacy' (the
    // default) puts the reflected rotor inertia on both hinge bodies; 'native' uses the
    // engine's relative hinge rotor and leaves bare body inertia unchanged.
    const rotorLines = mainLines.filter(l => /^\s*0\s+!BW\s+ROTOR_INERTIA(?:\s|$)/i.test(l.text));
    if (rotorLines.length) {
        const value = rotorLines[0].text.trim().replace(/^0\s+!BW\s+ROTOR_INERTIA\s*/i, '').trim();
        if (rotorLines.length !== 1 || !['legacy', 'native'].includes(value)) {
            model.rotor = 'invalid';
            refusals.push({line: rotorLines[0].lineNo, severity: 'error', code: 'bad-rotor-model',
                message: 'ROTOR_INERTIA needs exactly one legacy or native setting in the main model'});
        } else model.rotor = value;
    }
    // Only the main model opts in; submodel comments never change collision policy.
    const edgeLines = mainLines.filter(l => /^\s*0\s+!BW\s+INTERNAL_EDGE_PAIR(?:\s|$)/i.test(l.text));
    if (edgeLines.length) {
        model.internalEdgeRemovalPairs = edgeLines.map(l => l.text.trim().replace(/^0\s+!BW\s+INTERNAL_EDGE_PAIR\s*/i, '').trim().split(/\s+/));
        const issues = validateInternalEdgeRemovalPairs(model.internalEdgeRemovalPairs, new Set(parts.map(p => p.id)), 'model.internalEdgeRemovalPairs');
        if (issues.length) refusals.push({line: edgeLines[0].lineNo, severity: 'error', code: 'bad-internal-edge-pair', message: issues.join('; ')});
    }
    // An authored linkage can explicitly request stronger light-link convergence.
    // A named preset survives export without exposing arbitrary solver counts.
    const solverLines = mainLines.filter(l => /^\s*0\s+!BW\s+SOLVER(?:\s|$)/i.test(l.text));
    if (solverLines.length) {
        const value = solverLines[0].text.trim().replace(/^0\s+!BW\s+SOLVER\s*/i, '').trim();
        if (solverLines.length !== 1 || value !== 'light-links') {
            model.solver = 'invalid';
            refusals.push({line: solverLines[0].lineNo, severity: 'error', code: 'bad-solver-preset',
                message: 'SOLVER needs exactly one light-links setting in the main model'});
        } else model.solver = value;
    }
    // Keep a supplied model's attribution when Build edits or exports a derivative.
    const header = mainLines.map(l => l.text);
    const author = header.map(l => /^0\s+Author:\s*(.+)$/i.exec(l)?.[1]?.trim()).find(Boolean);
    const license = header.map(l => /^0\s+!LICENSE\s+(.+)$/i.exec(l)?.[1]?.trim()).find(Boolean);
    if ((author && author !== 'Brickwright') || license) model.attribution = {author: author || '', license: license || ''};
    if (drawings.length) {
        const ids = new Set(parts.map(p => p.id));
        model.drawings = [];
        for (const {line, ...drawing} of drawings) {
            if (!ids.has(drawing.surface) || !ids.has(drawing.pen) || drawing.surface === drawing.pen) {
                refusals.push({line, code: 'bad-drawing', message: `DRAW needs distinct existing surface and pen parts at line ${line}`});
            } else model.drawings.push(drawing);
        }
        if (!model.drawings.length) delete model.drawings;
    }
    if (decor.length) model.decor = decor;
    // The parts the file ships itself (an MPD's embedded part sections: unofficial parts, LDCad's
    // cable segments), by name: the views draw them from here, and serializeModel writes them back.
    const files = {};
    for (const [key, sec] of fileSections) if (sec.isPart) files[key] = sec.lines.map(l => l.text).join('\n');
    if (Object.keys(files).length) model.files = files;
    if (groupOrder.length > 0) {
        model.groups = groupOrder.map(gid => groupsById.get(gid));
        // Remove empty groups (should not happen, but for safety, filter out groups with 0 parts? But spec says groups with <2 dissolve, but parser should keep whatever was defined, even if empty, and let validator catch it)
        // We keep all groups as defined, even if empty, so that malformed ones are visible
    }
    if (belts.length) {
        // A rubber band round a part the file does not have, or a second band with one id, is not opened.
        const ids = new Set(parts.map(p => p.id));
        const kept = [];
        for (const b of belts) {
            const missing = b.around.filter(id => !ids.has(id));
            if (missing.length) refusals.push({line: b.line, code: 'bad-belt', message: `Rubber band '${b.id}' goes round unknown parts ${missing.join(', ')}`, parts: missing});
            else if (kept.some(k => k.id === b.id)) refusals.push({line: b.line, code: 'bad-belt', message: `Duplicate rubber band '${b.id}' at line ${b.line}`});
            else kept.push({id: b.id, band: b.band, around: b.around});
        }
        if (kept.length) model.belts = kept;
    }
    if (ropes.length) {
        const ids = new Set(parts.map(p => p.id));
        const kept = [];
        for (const r of ropes) {
            const missing = r.around.filter(id => !ids.has(id));
            if (missing.length) refusals.push({line: r.line, code: 'bad-rope', message: `Rope '${r.id}' runs round unknown parts ${missing.join(', ')}`, parts: missing});
            else if (kept.some(k => k.id === r.id)) refusals.push({line: r.line, code: 'bad-rope', message: `Duplicate rope '${r.id}' at line ${r.line}`});
            else kept.push({id: r.id, lengthLdu: r.lengthLdu, around: r.around});
        }
        if (kept.length) model.ropes = kept;
    }
    if (hoses.length) {
        const ids = new Set(parts.map(p => p.id));
        const kept = [];
        for (const h of hoses) {
            const missing = [h.a.part, h.b.part].filter(id => !ids.has(id));
            if (missing.length) refusals.push({line: h.line, code: 'bad-hose', message: `Hose '${h.id}' joins unknown parts ${missing.join(', ')}`, parts: missing});
            else if (kept.some(k => k.id === h.id)) refusals.push({line: h.line, code: 'bad-hose', message: `Duplicate hose '${h.id}' at line ${h.line}`});
            else kept.push({id: h.id, a: h.a, b: h.b});
        }
        if (kept.length) model.hoses = kept;
    }
    if (sawStep) {
        // Parts after the last STEP line are the last step; steps with no parts are dropped.
        if (stepParts.length) steps.push(stepParts);
        if (steps.length) model.steps = steps;
    }
    return {model, refusals};
};

/**
 * Serialize a PlacedModel to LDraw text.
 * @param {{version:number, parts:Array}} model
 * @param {{name?:string, title?:string, precision?:6|12}} opts
 * @returns {string} LDraw text with CRLF
 */
export const serializeModel = (model, {name = 'model.ldr', title = 'Brickwright model', author = model.attribution?.author || 'Brickwright', precision = 6} = {}) => {
    if (model.motorDirection !== undefined && !['legacy', 'motor-frame'].includes(model.motorDirection)) {
        throw new RangeError('motorDirection must be legacy or motor-frame');
    }
    if (model.rotor !== undefined && !['legacy', 'native'].includes(model.rotor)) {
        throw new RangeError('rotor must be legacy or native');
    }
    const edgeProblems = validateInternalEdgeRemovalPairs(model.internalEdgeRemovalPairs, new Set(model.parts.map(p => p.id)), 'model.internalEdgeRemovalPairs');
    if (edgeProblems.length) throw new RangeError(edgeProblems.join('; '));
    if (model.solver !== undefined && model.solver !== 'light-links') throw new RangeError('solver must be light-links');
    if (![6, 12].includes(precision)) throw new RangeError('LDraw precision must be 6 or 12');
    const number = n => formatNumber(n, precision);
    const lines = [];
    // A model that ships parts of its own (model.files) is an MPD: the model, then each part's FILE section.
    const files = Object.entries(model.files || {});
    if (files.length) lines.push(`0 FILE ${name}`);
    lines.push(`0 ${title}`);
    lines.push(`0 Name: ${name}`);
    lines.push(`0 Author: ${author}`);
    if (model.motorDirection !== undefined) lines.push(`0 !BW MOTOR_DIRECTION ${model.motorDirection}`);
    if (model.rotor !== undefined) lines.push(`0 !BW ROTOR_INERTIA ${model.rotor}`);
    for (const [source, surface] of model.internalEdgeRemovalPairs || []) lines.push(`0 !BW INTERNAL_EDGE_PAIR ${source} ${surface}`);
    if (model.solver !== undefined) lines.push(`0 !BW SOLVER ${model.solver}`);
    if (model.attribution?.license) lines.push(`0 !LICENSE ${model.attribution.license}`);
    for (const d of model.drawings || []) {
        lines.push(`0 !BW DRAW ${d.surface} ${d.pen} ${[...d.tip, ...d.center, d.radiusLdu].map(number).join(' ')}`);
    }
    lines.push(`0 !LDRAW_ORG Unofficial_Model`);
    // Groups: output 0 !BW GROUP lines first
    if (model.groups) {
        for (const g of model.groups) {
            // Escape name? For now, just output as is, but need to handle that name may contain spaces, we output as is
            lines.push(`0 !BW GROUP ${g.id} ${g.name}`);
        }
    }
    // Rubber bands (no LDraw part draws a stretched one): one line each, round parts written below.
    for (const b of model.belts || []) lines.push(`0 !BW BELT ${b.id} ${b.band} ${b.around.join(' ')}`);
    for (const r of model.ropes || []) lines.push(`0 !BW ROPE ${r.id} ${number(r.lengthLdu)} ${r.around.join(' ')}`);
    for (const h of model.hoses || []) lines.push(`0 !BW HOSE ${h.id} ${h.a.part} ${h.a.port} ${h.b.part} ${h.b.port}`);
    // Build a map from part id to group id for quick lookup
    const partGroupMap = new Map();
    if (model.groups) {
        for (const g of model.groups) {
            for (const pid of g.parts) partGroupMap.set(pid, g.id);
        }
    }
    // Building steps: a `0 STEP` line after each step's last part (only for a model that has steps,
    // so a model without them is written exactly as before).
    const stepOf = new Map();
    if (Array.isArray(model.steps) && model.steps.length) {
        model.steps.forEach((ids, n) => { for (const id of ids) if (!stepOf.has(id)) stepOf.set(id, n); });
    }
    let previousStep;
    for (const p of model.parts) {
        if (stepOf.size) {
            const step = stepOf.has(p.id) ? stepOf.get(p.id) : -1;
            if (previousStep !== undefined && step !== previousStep) lines.push('0 STEP');
            previousStep = step;
        }
        lines.push(`0 !BW ID ${p.id}`);
        const gid = partGroupMap.get(p.id);
        if (gid) lines.push(`0 !BW IN ${gid}`);
        if (p.port) lines.push(`0 !BW PORT ${p.port}`);
        if (p.pen) lines.push('0 !BW PEN');
        if (p.slides?.length) lines.push(`0 !BW SLIDE ${p.slides.join(' ')}`);
        if (p.load) lines.push('0 !BW LOAD');
        if (p.rotorAngle !== undefined) lines.push(`0 !BW ROTOR ${number(p.rotorAngle)}`);
        const x = number(p.position[0]);
        const y = number(p.position[1]);
        const z = number(p.position[2]);
        const a = number(p.rotation[0]);
        const b = number(p.rotation[1]);
        const c = number(p.rotation[2]);
        const d = number(p.rotation[3]);
        const e = number(p.rotation[4]);
        const f = number(p.rotation[5]);
        const g = number(p.rotation[6]);
        const h = number(p.rotation[7]);
        const i = number(p.rotation[8]);
        const color = formatColour(p.color ?? MAIN_COLOUR);
        lines.push(`1 ${color} ${x} ${y} ${z} ${a} ${b} ${c} ${d} ${e} ${f} ${g} ${h} ${i} ${p.part}`);
    }
    if (stepOf.size && previousStep !== undefined) lines.push('0 STEP');
    // Decoration (a cable's segments, a mirrored part) as it was read: read back, it is decoration again.
    for (const d of model.decor || []) {
        lines.push(`1 ${formatColour(d.color ?? MAIN_COLOUR)} ${[...d.position, ...d.matrix].map(number).join(' ')} ${d.part}`);
    }
    if (files.length) {
        lines.push('0 NOFILE');
        for (const [file, text] of files) {
            lines.push(`0 FILE ${file}`, ...text.split(/\r?\n/).filter(l => !/^\s*0\s+(?:NO)?FILE\b/i.test(l)), '0 NOFILE');
        }
    }
    return lines.join('\r\n') + '\r\n';
};
