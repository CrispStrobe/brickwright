/**
 * Presentation-only workspace transactions for the shared circuit debugger.
 *
 * This module does not create a panel or a runner. CircuitTab owns the one
 * persistent DebugPanel host; these settings only ask that owner to show it.
 */

export const CIRCUIT_DEBUGGER_VIEW = Object.freeze({
    'bw-hide-stage': '1',
    'bw-right-pane-hidden': '0',
    'bw-debug-dock': 'right',
    'bw-stage-circuit': '1',
    'bw-circuit-theme': 'light'
});

export const setCircuitView = ({fullWidth, dock, rightPaneVisible = true}, {storage, eventTarget, EventClass} = {}) => {
    const store = storage === undefined ? globalThis.localStorage : storage;
    const target = eventTarget === undefined ? globalThis.window : eventTarget;
    const CustomEventClass = EventClass === undefined ? globalThis.CustomEvent : EventClass;
    const values = {
        'bw-hide-stage': fullWidth ? '1' : '0',
        'bw-right-pane-hidden': rightPaneVisible ? '0' : '1',
        'bw-debug-dock': dock,
        'bw-stage-circuit': fullWidth ? '1' : '0',
        'bw-circuit-theme': 'light'
    };
    try {
        Object.entries(values).forEach(([key, value]) => store.setItem(key, value));
    } catch { /* private browsing: the live events still work */ }
    Object.entries(values).forEach(([key, value]) => {
        target.dispatchEvent(new CustomEventClass('bw-settings-change', {detail: {key, value}}));
    });
};

export const showCircuitDebugger = options =>
    setCircuitView({fullWidth: true, dock: 'right'}, options);
