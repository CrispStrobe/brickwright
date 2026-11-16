// SPDX-License-Identifier: BSD-3-Clause
import {validateConnections} from './session.js';
export const CONNECTIONS_KEY = 'bw-cad-circuit-bindings';
export const CONNECTIONS_EVENT = 'bw-cad-circuit-bindings-changed';
export function readConnections() {
    const text = localStorage.getItem(CONNECTIONS_KEY);
    return text ? validateConnections(JSON.parse(text)) : null;
}
export function saveConnections(value) {
    const validated = validateConnections(value);
    localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(validated));
    window.dispatchEvent(new CustomEvent(CONNECTIONS_EVENT));
    return validated;
}
