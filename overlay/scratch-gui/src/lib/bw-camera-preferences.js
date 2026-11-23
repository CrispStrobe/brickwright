// SPDX-License-Identifier: BSD-3-Clause
export const CAMERA_PREFERENCES_EVENT = 'bw-camera-preferences-change';
const key = 'bw-3d-camera-preferences';
const options = {trackpadSlide: ['pan', 'orbit', 'zoom'], secondaryDrag: ['orbit', 'pan']};
let local;

export const getCameraPreferences = () => {
    if (local) return {...local};
    let stored, legacyWheel, legacyDrag;
    try {
        stored = JSON.parse(localStorage.getItem(key));
        legacyWheel = localStorage.getItem('bw-sim-lab-wheel-mode');
        legacyDrag = localStorage.getItem('bw-sim-lab-mouse-preset');
    } catch { /* use defaults when storage is unavailable */ }
    return {
        trackpadSlide: options.trackpadSlide.includes(stored?.trackpadSlide) ? stored.trackpadSlide :
            (legacyWheel === 'mouse' ? 'zoom' : legacyWheel === 'trackpad' ? 'orbit' : 'pan'),
        secondaryDrag: options.secondaryDrag.includes(stored?.secondaryDrag) ? stored.secondaryDrag :
            (legacyDrag === 'brickwright' ? 'pan' : 'orbit')
    };
};

export const setCameraPreference = (name, value) => {
    if (!Object.hasOwn(options, name) || !options[name].includes(value)) return;
    local = {...getCameraPreferences(), [name]: value};
    try { localStorage.setItem(key, JSON.stringify(local)); } catch { /* keep the preference for this session */ }
    window.dispatchEvent(new CustomEvent(CAMERA_PREFERENCES_EVENT, {detail: {...local}}));
};
