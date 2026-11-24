// SPDX-License-Identifier: BSD-3-Clause
// validateConnections is here, not in session.js (which re-exports it): bw-project-bundle.js
// checks saved connections during the first load, and the coupled session is lazy (bw-cad-host).
const finite = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
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
export function validateConnections(value) {
    if (!value || value.version !== 1 || typeof value.cadDocumentId !== 'string' || !value.cadDocumentId || value.cadDocumentId.length > 96 || !Array.isArray(value.drives) || value.drives.length > 64) throw new Error('Invalid circuit–CAD connections');
    const parts = new Set(), joints = new Set();
    const drives = value.drives.map(raw => {
        if (!raw || typeof raw.partId !== 'string' || !raw.partId || raw.partId.length > 96 || typeof raw.jointId !== 'string' || !raw.jointId || raw.jointId.length > 96 || parts.has(raw.partId) || joints.has(raw.jointId)) throw new Error('Each circuit motor and CAD joint can have only one connection');
        const drive = {partId: raw.partId, jointId: raw.jointId, direction: raw.direction ?? 1, ratio: raw.ratio ?? 1, efficiency: raw.efficiency ?? 1, kind: raw.kind ?? 'hinge', leadMm: raw.leadMm ?? 8};
        if (![1,-1].includes(drive.direction) || !finite(drive.ratio,.001,1000) || !finite(drive.efficiency,.001,1) || !['hinge','slider'].includes(drive.kind) || !finite(drive.leadMm,.01,1000)) throw new Error('Invalid motor transmission');
        parts.add(drive.partId); joints.add(drive.jointId); return drive;
    });
    const claim = raw => {
        if (!raw || typeof raw.partId !== 'string' || !raw.partId || raw.partId.length > 96 || typeof raw.jointId !== 'string' || !raw.jointId || raw.jointId.length > 96 || parts.has(raw.partId) || joints.has(raw.jointId)) throw new Error('Each actuator can have only one connection');
        parts.add(raw.partId);joints.add(raw.jointId);
    };
    if ((value.servos && !Array.isArray(value.servos)) || (value.sensors && !Array.isArray(value.sensors)) || (value.servos?.length || 0)>32 || (value.sensors?.length || 0)>32) throw new Error('Invalid servo or sensor connections');
    const servos=(value.servos || []).map(raw=>{claim(raw);const servo={partId:raw.partId,jointId:raw.jointId,direction:raw.direction??1,centerDeg:raw.centerDeg??90,torqueNm:raw.torqueNm??.02};
        if(![1,-1].includes(servo.direction)||!finite(servo.centerDeg,0,180)||!finite(servo.torqueNm,.000001,100))throw new Error('Invalid ideal servo transmission');return servo;});
    const sensors=(value.sensors || []).map(raw=>{
        if(!raw || typeof raw.partId!=='string' || !raw.partId || raw.partId.length>96 || parts.has(raw.partId) || typeof raw.bodyId!=='string' || !raw.bodyId || raw.bodyId.length>96)throw new Error('Invalid sensor connection');parts.add(raw.partId);
        const sensor={partId:raw.partId,bodyId:raw.bodyId,originMm:raw.originMm??[0,0,0],direction:raw.direction??[1,0,0],rangeMm:raw.rangeMm??4000};
        if(!Array.isArray(sensor.originMm)||sensor.originMm.length!==3||sensor.originMm.some(v=>!finite(v,-100000,100000))||!Array.isArray(sensor.direction)||sensor.direction.length!==3||sensor.direction.some(v=>!finite(v,-1,1))||Math.hypot(...sensor.direction)<1e-9||!finite(sensor.rangeMm,1,100000))throw new Error('Invalid body sensor ray');return sensor;
    });
    return {version: 1, cadDocumentId: value.cadDocumentId, enabled: value.enabled === true, drives,servos,sensors};
}
