/** Shared physical-key ownership for the CP1 front panel; no emulation lives here. */
export const CP1_FUNCTION_KEYS = Object.freeze(['CAS', 'CLR', 'PC', 'ACC', 'CAL', 'STEP', 'STP', 'RUN', 'OUT', 'INP']);
export const CP1_LOGICAL_KEYS = Object.freeze([...Array.from({length: 10}, (_, i) => String(i)), ...CP1_FUNCTION_KEYS]);
export const CP1_PHYSICAL_KEYS = Object.freeze([
    ...Array.from({length: 10}, (_, i) => ({id: `upper-${i}`, key: String(i), group: 'upper'})),
    ...CP1_FUNCTION_KEYS.map(key => ({id: `function-${key}`, key, group: 'function'})),
    ...Array.from({length: 10}, (_, i) => ({id: `lower-${i}`, key: String(i), group: 'lower'}))
].map(Object.freeze));
const validKeys = new Set(CP1_LOGICAL_KEYS);
const normalize = key => String(key).toUpperCase();

/**
 * Two printed digit buttons close the same contact. A pointer and keyboard may
 * also own that contact simultaneously; releasing either must not release both.
 */
export function createCp1KeyInput (onChange) {
    if (typeof onChange !== 'function') throw new TypeError('A CP1 key callback is required.');
    const owners = new Map();
    const contacts = new Map();
    const release = owner => {
        const key = owners.get(owner);
        if (key === undefined) return false;
        owners.delete(owner);
        const sources = contacts.get(key);
        sources.delete(owner);
        if (!sources.size) {
            contacts.delete(key);
            onChange(key, false);
        }
        return true;
    };
    return {
        press (keyValue, owner) {
            const key = normalize(keyValue);
            if (!validKeys.has(key)) throw new RangeError(`Unknown CP1 key ${keyValue}.`);
            if (owner === undefined || owner === null) throw new TypeError('A physical input owner is required.');
            if (owners.get(owner) === key) return false;
            release(owner);
            let sources = contacts.get(key);
            if (!sources) {
                sources = new Set();
                contacts.set(key, sources);
            }
            sources.add(owner);
            owners.set(owner, key);
            if (sources.size === 1) onChange(key, true);
            return true;
        },
        release,
        releaseAll () {
            // Clear ownership before callbacks so a consumer sees a released
            // panel even if it synchronously reads state during the callback.
            const keys = [...contacts.keys()];
            owners.clear();
            contacts.clear();
            for (const key of keys) onChange(key, false);
        },
        isHeld: key => contacts.has(normalize(key)),
        heldKeys: () => [...contacts.keys()]
    };
}

export function cp1KeyForKeyboard (event) {
    if (event.ctrlKey || event.altKey || event.metaKey) return null;
    if (/^\d$/.test(event.key)) return event.key;
    if (event.key === 'Escape') return 'STP';
    if (event.key === 'Enter') return 'RUN';
    if (event.key === 'Backspace' || event.key === 'Delete') return 'CLR';
    const match = /^F(\d{1,2})$/.exec(event.key || '');
    if (match && Number(match[1]) >= 1 && Number(match[1]) <= 10) return CP1_FUNCTION_KEYS[Number(match[1]) - 1];
    return null;
}

export const cp1IsTypingTarget = target => Boolean(target && target.closest && target.closest(
    'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], .cm-editor, .CodeMirror'
));

/** Preserve segment evidence, including nonnumeric error/monitor patterns. */
export function cp1DisplayDigits (display) {
    return Array.from({length: 6}, (_, index) => {
        const value = display && display.digits && display.digits[index];
        return Number.isInteger(value) && value >= 0 && value <= 255 ? value : 0;
    });
}

export function cp1SegmentDescription (mask) {
    return ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp'].filter((_, bit) => (mask & (1 << bit)) !== 0).join(', ') || '—';
}

/** Snapshot retrieval reads the machine; it never steps a CPU or writes RAM. */
export function readCp1PanelSnapshot (machine) {
    if (!machine) return null;
    if (typeof machine.snapshot === 'function') return machine.snapshot();
    return {
        display: typeof machine.getDisplay === 'function' ? machine.getDisplay() : null,
        expansion: Boolean(machine.expansion),
        cells: typeof machine.readCell === 'function' ? Array.from(
            {length: machine.expansion ? 256 : 128}, (_, address) => machine.readCell(address)
        ) : []
    };
}
