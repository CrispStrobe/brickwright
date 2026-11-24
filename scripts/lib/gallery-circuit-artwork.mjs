// SPDX-License-Identifier: BSD-3-Clause
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

export async function createCircuitArtwork(packageRoot, fingerprint) {
    const src = join(packageRoot, 'src');
    const dependencyFiles = readdirSync(src, {recursive: true, withFileTypes: true})
        .filter(file => file.isFile() && /\.(js|json|svg)$/.test(file.name))
        .map(file => join(file.parentPath, file.name))
        .sort();
    const digest = fingerprint(dependencyFiles.map(file => [file.slice(packageRoot.length), readFileSync(file)]));
    const local = name => import(pathToFileURL(join(src, name)).href);
    const {Circuit} = await local('model/circuit.js');
    const {renderSchematicSvg} = await local('model/schematic-svg.js');
    const {setEngine} = await local('engine.js');
    const {registerSidecar} = await local('model/parts-registry.js');
    // Identical normalization and endpoint resolution to the schematic CLI.
    class ArtworkBoard {
        setNetlist() {}
        snapshot() { return null; }
    }
    setEngine({BoardImpl: ArtworkBoard, inferNetlist: () => ({}), checkWiring: () => []});
    const sidecars = join(src, 'parts-data');
    for (const filename of readdirSync(sidecars).sort()) {
        if (filename.endsWith('.json')) registerSidecar(JSON.parse(readFileSync(join(sidecars, filename), 'utf8')));
    }
    return {
        digest,
        render(source) {
            const circuit = Circuit.fromJSON(JSON.parse(source));
            if (!circuit.parts.length) throw new Error('Circuit has no visible parts');
            return Buffer.from(renderSchematicSvg({parts: circuit.parts, nets: circuit.resolvedNets}, {dark: false}).svg);
        }
    };
}
