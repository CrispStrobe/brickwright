// SPDX-License-Identifier: BSD-3-Clause
const motorKinds = new Set(['dc_motor', 'gearmotor', 'dc_motor_encoder']);
const partFields = ['id', 'name', 'kind'];
const jointFields = ['id', 'name', 'port', 'kind'];
const sameRows = (a, b, fields) => a.length === b.length && a.every((row, index) =>
    fields.every(field => row[field] === b[index][field]));

export const emptyConnections = cadDocumentId => ({
    version: 1, cadDocumentId, enabled: false, drives: [], servos: [], sensors: []
});

export const connectionDocumentMismatch = (connections, documentId) => Boolean(
    documentId && connections?.cadDocumentId && connections.cadDocumentId !== documentId
);

// Ordinary edits never retarget saved IDs to a replacement document. The caller
// must explicitly clear the old connections before authoring a new binding set.
export function connectionsForDocument (connections, documentId) {
    if (!documentId) throw new Error('Open a CAD design before connecting the circuit');
    if (connectionDocumentMismatch(connections, documentId)) {
        throw new Error('Clear the saved connections before connecting this CAD design');
    }
    return connections || emptyConnections(documentId);
}

const actuators = connections => [...(connections.drives || []), ...(connections.servos || [])];

export function availableCircuitParts (parts, connections, currentPartId = null) {
    const used = new Set([...actuators(connections), ...(connections.sensors || [])]
        .filter(connection => connection.partId !== currentPartId).map(connection => connection.partId));
    return parts.filter(part => !used.has(part.id));
}

export function availableActuatorJoints (joints, connections, currentPartId = null, kind = null) {
    const used = new Set(actuators(connections)
        .filter(connection => connection.partId !== currentPartId).map(connection => connection.jointId));
    return joints.filter(joint => (!kind || joint.kind === kind) && !used.has(joint.id));
}

export function nextActuatorConnection (catalog, connections, kind = 'motor') {
    const part = availableCircuitParts(kind === 'servo' ? catalog.servos : catalog.motors, connections)[0];
    const joint = availableActuatorJoints(catalog.joints, connections, null, kind === 'servo' ? 'hinge' : null)[0];
    return part && joint ? {part, joint} : null;
}

export const emptyCatalog = () => ({motors: [], servos: [], sensors: [], bodies: [], joints: [], documentId: ''});

// Board readings can mutate continuously. Only id/name/kind affect this menu;
// CAD's session revision covers document, joint, port and body-name changes.
// Cache detached metadata so in-place circuit edits remain observable too.
export function createCircuitCadCatalogReader () {
    let catalog = emptyCatalog(), parts = [], previousEditor, previousDocument, previousRevision;
    return (board, editor) => {
        const liveParts = board?.parts || [];
        const state = editor?.session.state;
        const document = state?.document;
        const partsChanged = !sameRows(parts, liveParts, partFields);
        const cadChanged = editor !== previousEditor || document !== previousDocument || state?.revision !== previousRevision;
        if (!partsChanged && !cadChanged) return catalog;
        const next = {...catalog};
        if (partsChanged) {
            parts = liveParts.map(({id, name, kind}) => ({id, name, kind}));
            const motors = [], servos = [], sensors = [];
            for (const part of parts) {
                if (motorKinds.has(part.kind)) motors.push(part);
                else if (part.kind === 'servo') servos.push(part);
                else if (part.kind === 'ultrasonic') sensors.push(part);
            }
            for (const [key, rows] of Object.entries({motors, servos, sensors})) {
                if (!sameRows(catalog[key], rows, partFields)) next[key] = rows;
            }
        }
        if (cadChanged) {
            previousEditor = editor;
            previousDocument = document;
            previousRevision = state?.revision;
            const bodies = (document?.roots || []).filter(id => {
                const node = document.nodes[id];
                return node && !node.reference && node.role !== 'hole';
            }).map(id => ({id, name: document.nodes[id].name}));
            const joints = [
                ...(editor?.simulation.motors() || []).map(({id, name, port}) => ({id, name, port, kind: 'hinge'})),
                ...(editor?.simulation.sliders() || []).map(({id, name, port}) => ({id, name, port, kind: 'slider'}))
            ];
            if (!sameRows(catalog.bodies, bodies, ['id', 'name'])) next.bodies = bodies;
            if (!sameRows(catalog.joints, joints, jointFields)) next.joints = joints;
            next.documentId = document?.id || '';
        }
        if (Object.keys(next).some(key => next[key] !== catalog[key])) catalog = next;
        return catalog;
    };
}
