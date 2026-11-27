// SPDX-License-Identifier: BSD-3-Clause
import {readConnections, CONNECTIONS_EVENT} from './connections.js';
import {STATUS_EVENT} from './bridge.js';
import {CAD_READY_EVENT} from '../bw-cad-program.js';
import {createCircuitCadCatalogReader} from './panel-model.js';

// The simulation owns its clock even when this view is hidden. Observing it is
// optional: returning to the tab reads the current status and saved bindings.
export function observeCircuitCadPanel ({
    runtime, isVisible, expanded, onCatalog, onStatus, onConnections, onError,
    events = window, readEditor = () => globalThis.__bwCad?.editor,
    readSavedConnections = readConnections, now = () => performance.now(),
    schedule = setInterval, cancel = clearInterval
}) {
    if (!isVisible) return () => {};
    const readCatalog = createCircuitCadCatalogReader();
    let collapsedDocumentId;
    let lastStatusAt = -Infinity, lastPhase, publishedCatalog, observedSession, unsubscribe, stopped = false;
    const publishStatus = (next, force = false) => {
        if (!next || stopped) return;
        const time = now();
        if (!force && !expanded && next.phase === 'running' && lastPhase === next.phase && time - lastStatusAt < 1000) return;
        lastStatusAt = time;
        lastPhase = next.phase;
        onStatus(next);
    };
    const updateCatalog = () => {
        if (stopped) return;
        const editor = readEditor();
        if (!expanded) {
            const documentId = editor?.session?.state.document.id || '';
            if (documentId !== collapsedDocumentId) {
                collapsedDocumentId = documentId;
                onCatalog({documentId, bodies: [], joints: [], motors: [], servos: [], sensors: []});
            }
            return;
        }
        if (observedSession !== editor?.session) {
            unsubscribe?.();
            observedSession = editor?.session;
            unsubscribe = observedSession?.subscribe(updateCatalog);
        }
        const next = readCatalog(runtime.circuitBoard, editor);
        if (next !== publishedCatalog) {publishedCatalog = next; onCatalog(next);}
    };
    const loaded = event => {
        if (stopped) return;
        try {onConnections(readSavedConnections()); if (event) onError('');} catch (error) {onError(error.message);}
        updateCatalog();
        publishStatus(runtime.cadCircuitSimulation?.state(), true);
    };
    const progress = event => publishStatus(event.detail);
    const readyEvents = [CAD_READY_EVENT, 'bw-board-ready', CONNECTIONS_EVENT, 'bw-project-bundle-loaded'];
    events.addEventListener(STATUS_EVENT, progress);
    for (const name of readyEvents) events.addEventListener(name, loaded);
    const refresh = expanded ? schedule(updateCatalog, 1000) : null;
    loaded();
    return () => {
        stopped = true;
        if (refresh !== null) cancel(refresh);
        unsubscribe?.();
        events.removeEventListener(STATUS_EVENT, progress);
        for (const name of readyEvents) events.removeEventListener(name, loaded);
    };
}
