// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// Small pictures of parts for the Build palette (Tinkercad's shape panel): each
// part drawn from its real LDraw geometry, in the colour it is placed in, with
// its LDraw edge lines, from the front-right above (editor/palette.js
// `thumbnailCamera` frames it). ONE offscreen WebGL renderer draws them all, a
// part at a time, when the pane asks for it (an item scrolled into view or a
// category opened); a picture is kept per part, colour and size. Build also keeps
// useful pictures across reloads of the same release.
// Without WebGL `createPartThumbnails` returns null and the palette shows names.
// The building instructions' "parts needed" callouts use the same pictures, each
// in the colour the part has in the model (`render(part, color)`).

import {Mesh, MeshStandardMaterial, PerspectiveCamera, Scene, TorusGeometry, WebGLRenderer} from 'three';
import {partGeometry, partVisual} from './part-geometry.js';
import {PART_SURFACE, addEdgeLines, addPartLights, edgeMaterials} from './part-style.js';
import {webglAvailable} from './sim-view3d.js';
import {thumbnailCamera} from '../editor/palette.js';
import {BANDS, BAND_RADIUS_LDU} from '../editor/belt-path.js';
import {LDU_M} from '../contracts.js';
import {readPartThumbnail, writePartThumbnail} from './part-thumbnail-cache.js';

/** Marks the thumbnail renderer's canvas (and, for scripts/verify-boot-payload.mjs, this module's chunk). */
export const THUMBNAIL_TESTID = 'bw-sim-part-thumbnails';
/** Pixels per side of a thumbnail (shown at about half that, so it stays sharp on a 2x screen). */
export const THUMBNAIL_PX = 128;

/** Pictures already drawn, by part and colour: survive the renderer (a Build session) for the page's life. */
const drawn = new Map();
const remember = (key, image) => {
    drawn.set(key, image);
    if (drawn.size > 512) drawn.delete(drawn.keys().next().value);
};

/** Unstretched band thumbnail, drawn from the native diameter and section rather than external part geometry. */
export const bandThumbnailGeometry = part => {
    const band = BANDS.find(b => b.part === part);
    if (!band) return null;
    const geometry = new TorusGeometry(band.mm / 2000, BAND_RADIUS_LDU * LDU_M, 8, 64);
    // The shared thumbnail mesh has an array of materials. Three draws that
    // form only through geometry groups; a native torus starts without any.
    geometry.addGroup(0, geometry.index.count, 0);
    return geometry;
};

/**
 * @param {object} options
 * @param {Function} options.read LDraw file reader
 * @param {Map} options.colors LDraw colours (parseLDConfig)
 * @param {number} options.color LDraw colour code the parts are drawn in unless a call names another
 * @param {number} [options.size] pixels per side
 * @param {boolean} [options.persistent] store standard library thumbnails across reloads
 * @returns {{get: (part: string, color?: number) => string|null, has: (part: string, color?: number) => boolean,
 *            render: (part: string, color?: number) => string|null, restore: (part: string, color?: number) => Promise<string|null>, dispose: () => void}|null}
 *          null when this browser has no WebGL 2
 */
export const createPartThumbnails = ({read, colors, color, size = THUMBNAIL_PX, persistent = false}) => {
    if (!webglAvailable()) return null;
    let renderer;
    try {
        renderer = new WebGLRenderer({antialias: true, alpha: true, preserveDrawingBuffer: true});
    } catch {
        return null;
    }
    renderer.setPixelRatio(1);
    renderer.setSize(size, size, false);
    renderer.setClearColor(0x000000, 0); // transparent: the tile's own background shows
    renderer.domElement.dataset.testid = THUMBNAIL_TESTID;
    const scene = new Scene();
    addPartLights(scene);
    const camera = new PerspectiveCamera(30, 1, 0.001, 10);
    const faces = [
        new MeshStandardMaterial({color: '#cccccc', ...PART_SURFACE}),
        new MeshStandardMaterial({color: '#ffffff', ...PART_SURFACE, vertexColors: true})
    ];
    /** Edge-line materials per colour drawn so far. */
    const lineSets = new Map();
    const linesFor = code => {
        if (!lineSets.has(code)) lineSets.set(code, edgeMaterials(code, colors));
        return lineSets.get(code);
    };
    const key = (part, code) => `${persistent ? 'library' : 'page'}:${size}:${part}@${code}`;
    const storedKey = id => `${process.env.BW_VERSION}:${id}`;
    const restore = async (part, code = color) => {
        const id = key(part, code);
        if (drawn.has(id)) return drawn.get(id);
        const image = persistent ? await readPartThumbnail(storedKey(id)) : null;
        if (image) remember(id, image);
        return image;
    };

    const render = (part, code = color) => {
        if (drawn.has(key(part, code))) return drawn.get(key(part, code));
        let url = null;
        try {
            const info = colors.get(code) || colors.get(16);
            faces[0].color.set(info ? info.value : '#cccccc');
            const lines = linesFor(code);
            const ring = bandThumbnailGeometry(part);
            const geometry = ring || partGeometry(part, read, colors);
            // No faces yet (a part from the LDraw catalogue whose files are still coming): no
            // picture, and nothing remembered, so it is drawn when asked again.
            if (!geometry.attributes.position) return null;
            if (!geometry.boundingBox) geometry.computeBoundingBox();
            const box = geometry.boundingBox;
            const mesh = new Mesh(geometry, faces);
            if (!ring) addEdgeLines(mesh, partVisual(part, read, colors), lines);
            scene.add(mesh);
            const view = thumbnailCamera({min: box.min.toArray(), max: box.max.toArray()}, {fov: camera.fov, aspect: 1});
            camera.position.fromArray(view.position);
            camera.up.fromArray(view.up);
            camera.lookAt(...view.target);
            camera.near = view.near;
            camera.far = view.far;
            camera.updateProjectionMatrix();
            renderer.render(scene, camera);
            url = renderer.domElement.toDataURL('image/png');
            scene.remove(mesh); // the geometry is part-geometry.js's cache: not disposed here
            if (ring) ring.dispose();
        } catch {
            remember(key(part, code), null);
            url = null; // a part whose files are missing keeps its name only
        }
        if (url) {
            const id = key(part, code);
            remember(id, url);
            if (persistent) writePartThumbnail(storedKey(id), url);
        }
        return url;
    };

    return {
        get: (part, code = color) => drawn.get(key(part, code)) ?? null,
        has: (part, code = color) => drawn.has(key(part, code)),
        render,
        restore,
        dispose () {
            for (const m of faces) m.dispose();
            for (const lines of lineSets.values()) for (const m of [...lines.edges, ...lines.conditional]) m.dispose();
            renderer.dispose();
            renderer.forceContextLoss();
        }
    };
};
