// SPDX-License-Identifier: BSD-3-Clause
import {DynamicDrawUsage, Group, Mesh, MeshStandardMaterial, Vector3} from 'three';

// Sub-micron movement from subtracting Float32 body translations is invisible.
const SHAPE_EPSILON_SQUARED = 1e-14;

const dynamicGeometry = geometry => {
    geometry.getAttribute('position').setUsage(DynamicDrawUsage);
    geometry.getAttribute('normal').setUsage(DynamicDrawUsage);
    return geometry;
};

const updateGeometry = (mesh, generated) => {
    const geometry = mesh.geometry;
    if (geometry.getAttribute('position').count !== generated.getAttribute('position').count) {
        geometry.dispose();
        mesh.geometry = dynamicGeometry(generated);
        return;
    }
    // Topology is unchanged. Keep index and UV buffers and upload only deformed vertices.
    for (const name of ['position', 'normal']) {
        const attribute = geometry.getAttribute(name);
        attribute.array.set(generated.getAttribute(name).array);
        attribute.needsUpdate = true;
    }
    geometry.parameters = generated.parameters;
    geometry.tangents = generated.tangents;
    geometry.normals = generated.normals;
    geometry.binormals = generated.binormals;
    geometry.boundingBox = null;
    geometry.boundingSphere = null;
};

/** Ropes and hoses share the same material per layer and keep their mesh and GPU buffers as they move. */
export const createTubeLayer = ({name, prefix, color, roughness, geometryOf, toWorld}) => {
    const group = new Group();
    group.name = name;
    const material = new MeshStandardMaterial({color, roughness, metalness: 0});
    const entries = [];
    const origin = new Vector3();
    const relative = new Vector3();
    const removeLast = () => {
        const {mesh} = entries.pop();
        group.remove(mesh);
        mesh.geometry.dispose();
    };

    return {
        group,
        draw (tubes) {
            let index = 0;
            for (const {id, points} of tubes) {
                if (!points || points.length < 2) continue;
                let entry = entries[index++];
                origin.set(...toWorld(points[0]));
                const sameShape = entry?.points.length === points.length && points.every((p, i) =>
                    relative.set(...toWorld(p)).sub(origin).distanceToSquared(entry.points[i]) <= SHAPE_EPSILON_SQUARED);
                if (!sameShape) {
                    const local = points.map(p => new Vector3(...toWorld(p)).sub(origin));
                    const generated = geometryOf(local);
                    if (!entry) {
                        const mesh = new Mesh(dynamicGeometry(generated), material);
                        group.add(mesh);
                        entry = {mesh, points: local};
                        entries.push(entry);
                    } else {
                        updateGeometry(entry.mesh, generated);
                        entry.points = local;
                    }
                }
                entry.mesh.name = `${prefix}:${id}`;
                entry.mesh.position.copy(origin);
            }
            while (entries.length > index) removeLast();
        },
        get count () { return entries.length; },
        dispose () {
            while (entries.length) removeLast();
            material.dispose();
            group.removeFromParent();
        }
    };
};
