// Whether the user has switched on the CAD editor tab.
//
// The tab ships HIDDEN even in a build that carries its code (BW_ENABLE_CAD=1):
// it is an advanced surface most users never want, so it is opt-in per browser
// rather than present for everyone. This is the RUNTIME half. The BUILD half —
// whether the code is bundled at all — stays `process.env.BW_ENABLE_CAD`, a
// DefinePlugin substitution, so a build that does not want the surface drops it
// entirely and this preference has nothing to reveal. Visibility is
// `built && enabled`; see gui.jsx.
export const CAD_ENABLED_KEY = 'bw-cad-enabled';
export const CAD_TOGGLE_EVENT = 'bw-cad-toggle';

let sessionValue;

/** Has the user turned the CAD tab on? Defaults OFF. */
export function getCadEnabled () {
    if (typeof sessionValue === 'boolean') return sessionValue;
    try { return globalThis.localStorage?.getItem(CAD_ENABLED_KEY) === '1'; }
    catch { return false; }
}

/**
 * Turn the CAD tab on or off. Persists to localStorage where it can, mirrors to
 * a session value where it cannot (a private window), and NOTIFIES the app so the
 * tab appears or disappears without a reload — the settings menu and the tab list
 * are different components, so a window event is how they agree.
 * @returns {boolean} whether the choice was persisted to storage
 */
export function setCadEnabled (enabled) {
    const on = Boolean(enabled);
    sessionValue = on;
    let persisted = false;
    try {
        if (globalThis.localStorage) {
            globalThis.localStorage.setItem(CAD_ENABLED_KEY, on ? '1' : '0');
            persisted = true;
        }
    } catch { persisted = false; }
    try {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(CAD_TOGGLE_EVENT, {detail: {enabled: on}}));
        }
    } catch { /* no window (SSR/test) — the caller still gets the return */ }
    return persisted;
}
