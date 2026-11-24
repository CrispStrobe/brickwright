// SPDX-License-Identifier: BSD-3-Clause
import {readFileSync} from 'node:fs';
import {resolve, sep} from 'node:path';
import {deflateSync} from 'node:zlib';
import {apply, flattenPart, parseLDraw, refKey, SEARCH_DIRS} from '../../overlay/scratch-gui/src/lib/bw-sim/ldraw/ldraw-geometry.js';
import {phasedMotorRead} from '../../overlay/scratch-gui/src/lib/bw-sim/ldraw/motor-phase.js';
import {visualAssembly} from '../../overlay/scratch-gui/src/lib/bw-sim/ldraw/visual-assemblies.js';
import {parseModel} from '../../overlay/scratch-gui/src/lib/bw-sim/model/ldraw-model.js';
import {parseLDConfig} from '../../overlay/scratch-gui/src/lib/bw-sim/view/ldraw-colors.js';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = v => {
    const length = Math.hypot(...v);
    return length ? v.map(x => x / length) : [0, 0, 0];
};
const subtract = (a, b) => a.map((v, i) => v - b[i]);
const eye = normalize([1, 0.75, 1.3]);
const right = normalize(cross([0, 1, 0], eye));
const up = cross(eye, right);
const light = normalize([-0.4, 0.9, 0.8]);
const project = ([x, y, z]) => {
    const world = [x, -y, -z];
    return [dot(world, right), -dot(world, up), dot(world, eye)];
};
const size = {width: 384, height: 240};
const eyeLdu = [eye[0], -eye[1], -eye[2]];
const lightLdu = [light[0], -light[1], -light[2]];

const crcTable = Uint32Array.from({length: 256}, (_, index) => {
    let v = index;
    for (let bit = 0; bit < 8; bit++) v = (v >>> 1) ^ (v & 1 ? 0xedb88320 : 0);
    return v;
});
const chunk = (type, data) => {
    const out = Buffer.alloc(data.length + 12);
    out.writeUInt32BE(data.length);
    out.write(type, 4, 'ascii');
    data.copy(out, 8);
    let crc = 0xffffffff;
    for (let i = 4; i < data.length + 8; i++) crc = crcTable[(crc ^ out[i]) & 255] ^ (crc >>> 8);
    out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, out.length - 4);
    return out;
};
function png(pixels, width, height) {
    const header = Buffer.alloc(13);
    header.writeUInt32BE(width);
    header.writeUInt32BE(height, 4);
    header[8] = 8;
    header[9] = 2; // RGB
    const stride = width * 3;
    const rows = Buffer.alloc((stride + 1) * height);
    for (let y = 0; y < height; y++) {
        rows[y * (stride + 1)] = 1; // PNG Sub filter
        for (let x = 0; x < stride; x++) {
            const i = y * stride + x;
            rows[y * (stride + 1) + x + 1] = pixels[i] - (x < 3 ? 0 : pixels[i - 3]);
        }
    }
    return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header),
        chunk('IDAT', deflateSync(rows, {level: 9})), chunk('IEND', Buffer.alloc(0))]);
}

function drawTriangle(a, b, c, color, rgb, depths, width, height) {
    const loX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
    const hiX = Math.min(width - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
    const loY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
    const hiY = Math.min(height - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (Math.abs(area) < 1e-5) return;
    const inv = 1 / area;
    for (let y = loY; y <= hiY; y++) {
        for (let x = loX; x <= hiX; x++) {
            const dx = x + 0.5 - a[0];
            const dy = y + 0.5 - a[1];
            const u = (dx * (c[1] - a[1]) - dy * (c[0] - a[0])) * inv;
            const v = ((b[0] - a[0]) * dy - (b[1] - a[1]) * dx) * inv;
            if (u < -1e-7 || v < -1e-7 || u + v > 1.0000001) continue;
            const depth = a[2] + u * (b[2] - a[2]) + v * (c[2] - a[2]);
            const index = y * width + x;
            if (depth <= depths[index]) continue;
            depths[index] = depth;
            rgb[index * 3] = color[0];
            rgb[index * 3 + 1] = color[1];
            rgb[index * 3 + 2] = color[2];
        }
    }
}

function artwork(polygons, colors) {
    const width = size.width * 2, height = size.height * 2;
    let loX = Infinity, hiX = -Infinity, loY = Infinity, hiY = -Infinity;
    for (const {screen} of polygons()) for (const [x, y] of screen) {
        loX = Math.min(loX, x);
        hiX = Math.max(hiX, x);
        loY = Math.min(loY, y);
        hiY = Math.max(hiY, y);
    }
    const scale = Math.min((width - 44) / (hiX - loX), (height - 40) / (hiY - loY));
    if (!Number.isFinite(scale) || scale <= 0) throw new Error('Model has no renderable projected area');
    const offX = (width - (hiX + loX) * scale) * 0.5;
    const offY = (height - (hiY + loY) * scale) * 0.5;
    const rgb = new Uint8Array(width * height * 3);
    const depths = new Float32Array(width * height).fill(-Infinity);
    for (let y = 0; y < height; y++) {
        const tone = Math.round(249 - 15 * y / height);
        for (let x = 0; x < width; x++) {
            const index = (y * width + x) * 3;
            rgb[index] = tone - 5;
            rgb[index + 1] = tone;
            rgb[index + 2] = tone + 5;
        }
    }
    for (const {screen, points, code} of polygons()) {
        const base = colors.get(code) ?? [151, 163, 174];
        const normal = normalize(cross(subtract(points[1], points[0]), subtract(points[2], points[0])));
        const facing = dot(normal, eyeLdu) >= 0 ? 1 : -1;
        const intensity = 0.53 + 0.47 * Math.max(0, dot(normal, lightLdu) * facing);
        const color = base.map(value => Math.min(255, (value + 14) * intensity));
        const vertices = screen.map(([x, y, z]) => [x * scale + offX, y * scale + offY, z]);
        drawTriangle(vertices[0], vertices[1], vertices[2], color, rgb, depths, width, height);
        if (vertices.length === 4) drawTriangle(vertices[0], vertices[2], vertices[3], color, rgb, depths, width, height);
    }
    const downsampled = new Uint8Array(size.width * size.height * 3);
    for (let y = 0; y < size.height; y++) for (let x = 0; x < size.width; x++) {
        const top = (y * 2 * width + x * 2) * 3;
        const bottom = top + width * 3;
        for (let channel = 0; channel < 3; channel++) {
            downsampled[(y * size.width + x) * 3 + channel] = Math.round((
                rgb[top + channel] + rgb[top + channel + 3] + rgb[bottom + channel] + rgb[bottom + channel + 3]) / 4);
        }
    }
    return png(downsampled, size.width, size.height);
}

export function createRobotArtwork(ldrawRoot, partCatalog) {
    const library = new Map();
    const catalog = new Map(partCatalog.parts.map(part => [part.part, part]));
    const readLibrary = name => {
        if (!library.has(name)) {
            const target = resolve(ldrawRoot, name);
            if (!target.startsWith(ldrawRoot + sep)) throw new Error(`Invalid LDraw path: ${name}`);
            try {
                library.set(name, readFileSync(target, 'utf8'));
            } catch (error) {
                if (error.code !== 'ENOENT') throw error;
                library.set(name, undefined);
            }
        }
        return library.get(name);
    };
    const config = readLibrary('LDConfig.ldr');
    const colors = new Map([...parseLDConfig(config)].map(([id, color]) => [id,
        [1, 3, 5].map(offset => parseInt(color.value.slice(offset, offset + 2), 16))]));
    const flattened = new Map();
    const libraryRefs = new Map();

    return source => {
        const {model, refusals} = parseModel(source);
        if (refusals.length) throw new Error(`Invalid LDraw model: ${refusals.map(issue => issue.message).join('; ')}`);
        const own = new Map(Object.entries(model.files ?? {}).map(([name, content]) => [refKey(name), content]));
        const read = path => own.get(refKey(path).replace(/^(?:parts\/|p\/)/, '')) ?? readLibrary(path);
        const dependencies = new Map([['LDConfig.ldr', config]]);
        const uniqueParts = new Set([...model.parts, ...(model.decor ?? [])].map(part => visualAssembly(part.part)));
        const visited = new Set();
        const visit = name => {
            const key = refKey(name);
            if (visited.has(key)) return;
            visited.add(key);
            for (const dir of SEARCH_DIRS) {
                const path = dir + key;
                const content = read(path);
                if (content === undefined) continue;
                dependencies.set(path, content);
                let refs = own.size ? null : libraryRefs.get(path);
                if (!refs) {
                    refs = parseLDraw(content).refs;
                    if (!own.size) libraryRefs.set(path, refs);
                }
                for (const ref of refs) visit(ref.file);
                return;
            }
            throw new Error(`Missing LDraw part: ${name}`);
        };
        for (const part of uniqueParts) visit(part);

        const modelParts = [...model.parts, ...(model.decor ?? [])];
        return {
            dependencies,
            render() {
                const partGeometry = new Map();
                return artwork(function* polygons() {
                    for (const part of modelParts) {
                        const name = visualAssembly(part.part);
                        const angle = part.rotorAngle || 0;
                        const meta = catalog.get(part.part);
                        const key = `${name}@${angle}`;
                        let flat = partGeometry.get(key) ?? (!own.size ? flattened.get(key) : null);
                        if (!flat) {
                            flat = flattenPart(name, angle && meta ? phasedMotorRead(name, read, meta, angle) : read);
                            if (flat.missing.length) throw new Error(`Could not draw ${name}: ${flat.missing.join(', ')}`);
                            if (!own.size) {
                                if (flattened.size >= 160) flattened.delete(flattened.keys().next().value);
                                flattened.set(key, flat);
                            }
                        }
                        partGeometry.set(key, flat);
                        const transform = {m: part.rotation ?? part.matrix, t: part.position};
                        for (let i = 0; i < flat.polys.length; i++) {
                            const points = flat.polys[i].map(point => apply(transform, point));
                            const code = flat.polyColours[i] === 16 ? part.color : flat.polyColours[i];
                            yield {points, screen: points.map(project), code};
                        }
                    }
                }, colors);
            }
        };
    };
}
