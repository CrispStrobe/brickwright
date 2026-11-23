// SPDX-License-Identifier: BSD-3-Clause
export const COSTUME_PRECISION_KEY = 'bw-costume-precision';
export const COSTUME_PRECISION_EVENT = 'bw-costume-precision-change';

let sessionValue;
export function getCostumePrecision () {
    if (typeof sessionValue === 'boolean') return sessionValue;
    try { return globalThis.localStorage?.getItem(COSTUME_PRECISION_KEY) === '1'; }
    catch { return false; }
}

export function setCostumePrecision (value) {
    sessionValue = Boolean(value);
    try { localStorage.setItem(COSTUME_PRECISION_KEY, sessionValue ? '1' : '0'); }
    catch { /* keep the choice for this session */ }
    window.dispatchEvent(new Event(COSTUME_PRECISION_EVENT));
}
