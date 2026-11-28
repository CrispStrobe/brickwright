// Playwright serializes this function into the page. Keep it closure-free and
// synchronous: waitForFunction polls the returned value without awaiting it.
export function optionalToolchainActivationReady () {
    const previous = window.__toolchainPreviousWorker;
    const active = window.__toolchainRegistration?.active;
    return Boolean(previous && active && active !== previous &&
        active.state === 'activated' && navigator.serviceWorker?.controller === active);
}
