/* Brickwright PWA service worker.
 *
 * ## The bug this was rewritten to fix (2026-08-09)
 *
 * The first version was stale-while-revalidate for EVERY same-origin GET —
 * `return cached || network` — including `index.html` and the hashed entry
 * bundle. That breaks the app on the second deploy, and it broke it in
 * production:
 *
 *   1. A visit caches index.html and gui.<oldhash>.js.
 *   2. A new build deploys. Chunk hashes change; the old chunk files are gone,
 *      because a deploy replaces the whole tree.
 *   3. The next visit is served the CACHED index.html, which names the CACHED
 *      old entry. The app runs a build that no longer exists on the server.
 *   4. The moment that old entry lazily imports a chunk the user had not
 *      visited before — the C tab, the debugger — it requests a hash that is
 *      404 and fails with "Loading chunk NNN failed".
 *
 * Reported as: `Can't show as c: Loading chunk 596 failed
 * (.../chunks/sb3-creator.fa965b005eea503da2a1.js)`. Confirmed by fetching the
 * deployed entry: it names `sb3-creator.8972d337850ada585ee3.js`, which is 200,
 * and contains the failing hash zero times. The browser was running a stale
 * entry against a fresh tree.
 *
 * Bumping CACHE would not have helped on its own, because nobody bumps a
 * constant on every deploy — and a scheme that needs a human step on every
 * release is a scheme that fails on the release someone forgets.
 *
 * ## The rule
 *
 * **The document is the one thing that must never be stale**, because it names
 * every hashed asset. Everything it names is content-addressed and therefore
 * safe to cache forever.
 *
 *   navigation / index.html  -> network first, cache only as an offline fallback
 *   hashed assets            -> cache first (immutable: the hash IS the version)
 *   everything else          -> stale-while-revalidate
 */
/* v3: bumped after the 2026-08-10 stale-client incident — a browser that was
 * last served by the v1 worker (stale-first documents) kept running a build
 * whose chunks had been deleted from the server, indefinitely. Activating v3
 * deletes every older cache outright, so the first visit after this deploy
 * starts clean even for those clients. */
// v4: a deploy served a mismatched tree, so v3 caches can hold entries for assets that 404'd.
// Hashed assets are cache-first and are never revalidated, so those entries would be permanent.
// The activate handler deletes obsolete application caches, which means renaming is
// the only thing that actually recovers a browser that is already broken.
// v4 stands. The 2026-08-30 changes below (a bound on the document fetch, and
// never serving a non-ok cache entry) recover a poisoned browser WITHOUT a
// rename, because both of them route around the bad entry instead of trusting
// it. A rename is still the only recovery for a bug that makes the worker trust
// something it should not — which is why the activate purge exists and why
// `scripts/verify-service-worker.mjs` asserts it.
const CACHE = 'brickwright-v5';
const PREVIEW_CACHE = 'brickwright-library-previews-v1';
const RENDERED_PREVIEW_CACHE = 'brickwright-rendered-thumbnails-v1';
// Optional installations outlive application deployments. These exact names
// match runtime-package-inventory.json; the activation behavior test checks the
// inventory against the worker. Do not fetch metadata or create these caches
// during activation: installation and removal belong to the user's request.
const OPTIONAL_TOOLCHAIN_CACHES = new Set(['bw-sdcc-wasm-v1']);
const PREVIEW_LIMIT = 512;
const PREVIEW_MAX_BYTES = 256 * 1024;
const PREVIEW_IMAGE = /\.(png|webp|avif|gif|jpe?g|svg)$/i;
const VERSIONED_PREVIEW = /(?:\.|\/)[a-f0-9]{8,64}\.(png|webp|avif|gif|jpe?g|svg)$/i;
const VERSIONED_GALLERY_INDEX = /\/static\/thumbnails\/gallery-artwork\/(robots|circuits)\.[a-f0-9]{64}\.json$/;
let previewWrites = Promise.resolve();

const rememberPreview = (cache, request, response) => {
    previewWrites = previewWrites.catch(() => {}).then(async () => {
        if (!response.ok || response.status !== 200 || !response.headers.get('content-type')?.startsWith('image/')) return;
        const length = Number(response.headers.get('content-length'));
        if (length > PREVIEW_MAX_BYTES || (!length && (await response.clone().blob()).size > PREVIEW_MAX_BYTES)) return;
        await cache.put(request, response);
        const keys = await cache.keys();
        for (const old of keys.slice(0, Math.max(0, keys.length - PREVIEW_LIMIT))) await cache.delete(old);
    });
    return previewWrites.catch(() => {});
};

/** `gui.aeeed7e4.js`, `chunks/sb3-creator.8972d337850ada585ee3.js`, `static/…` */
const HASHED = /\.[a-f0-9]{8,32}\.(js|css)$/;

/** How long a document waits for the network before the cached copy is offered.
 *
 * Network-first has an unstated assumption: that the network either answers or
 * fails. A captive portal, a dropped route or a half-open socket does neither,
 * and `catch` has nothing to catch. The document request then hangs — on a page
 * the browser is holding a perfectly good copy of, in an app whose entire reason
 * for shipping a worker is the case where the network is not there.
 *
 * 3 s: long enough that a normal document (a few KB, no-cache) is never
 * pre-empted on a slow connection, short enough to be under the time a user
 * takes to decide the app is broken. Nothing is lost when it fires — the network
 * request is left running and still refreshes the cache for the next load, so
 * the cost of a false trip is one stale first paint, not a missed deploy.
 */
const DOCUMENT_NETWORK_MS = 3000;

/**
 * Wait for `network`, but not forever.
 *
 * Returns the fresh response if it arrives in time, the cached copy if it does
 * not, and — when nothing is cached — keeps waiting on the network, because a
 * timeout with nothing to fall back to has nothing better to offer than the
 * request that is still in flight. Rejects if the network rejects, which is the
 * caller's signal to try the cache: a network that FAILS is the offline case and
 * was already handled.
 */
async function raceWithCache (network, cache, req) {
    const EXPIRED = Symbol('expired');
    let timer;
    const deadline = new Promise(resolve => {
        timer = setTimeout(() => resolve(EXPIRED), DOCUMENT_NETWORK_MS);
    });
    const first = await Promise.race([network, deadline]);
    clearTimeout(timer);
    if (first !== EXPIRED) return first;
    return (await cache.match(req)) || network;
}

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => k !== CACHE && k !== PREVIEW_CACHE && k !== RENDERED_PREVIEW_CACHE && !OPTIONAL_TOOLCHAIN_CACHES.has(k)).map(k => caches.delete(k)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return; // the extension gallery goes to the network

    const isDocument = req.mode === 'navigate' || req.destination === 'document' ||
        url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');

    // Gallery images are requested by visible cards. Content-addressed URLs
    // can be reused directly, while mutable example art refreshes in the background.
    const versionedPreview = VERSIONED_PREVIEW.test(url.pathname);
    if (req.destination === 'image' && PREVIEW_IMAGE.test(url.pathname) &&
        (versionedPreview || /\/(examples|previews|thumbnails)\//.test(url.pathname))) {
        const cache = caches.open(PREVIEW_CACHE).catch(() => null);
        const cached = cache.then(store => store?.match(req)).catch(() => null);
        const network = cached.then(async hit => {
            if (hit?.ok && versionedPreview) return {response: hit, store: null};
            try {
                return {response: await fetch(req), store: await cache};
            } catch {
                return {response: null, store: null};
            }
        });
        event.waitUntil(network.then(({response, store}) => store && response ?
            rememberPreview(store, req, response.clone()) : undefined));
        event.respondWith(cached.then(async hit => hit?.ok ? hit : (await network).response || Response.error()));
        return;
    }

    // Example data is unhashed and edited often; a stale-first policy here
    // means a user keeps seeing last week's gallery until a background
    // revalidation they never observe. Small files — treat like the document.
    const isLiveData = url.pathname.includes('/examples/');

    event.respondWith((async () => {
        const cache = await caches.open(CACHE);

        // The document names the build. Always ask the network first; fall back
        // to cache only when there is no network at all, which is the case the
        // PWA exists for.
        if (isDocument || isLiveData) {
            const network = (async () => {
                const fresh = await fetch(req, {cache: 'no-cache'});
                if (fresh && fresh.status === 200) cache.put(req, fresh.clone());
                return fresh;
            })();
            // The race can leave this promise unobserved. An unhandled rejection
            // in a worker is not harmless: it is reported against the worker and
            // can take it down mid-flight.
            network.catch(() => {});
            try {
                const fresh = await raceWithCache(network, cache, req);
                if (fresh) return fresh;
            } catch { /* the network failed outright — the cache is the next answer */ }
            return (await cache.match(req)) || Response.error();
        }

        const cached = await cache.match(req);

        // A hashed asset can never change under its own name, so a hit is always correct — but
        // only if the hit is a USABLE response. A cached failure would otherwise be permanent,
        // because cache-first never revalidates it.
        if (cached && cached.ok && (HASHED.test(url.pathname) || VERSIONED_GALLERY_INDEX.test(url.pathname))) return cached;

        // Must always settle to a Response. `respondWith` REJECTS the request if its promise
        // resolves to undefined, and the browser reports that as "a ServiceWorker intercepted
        // the request and an unexpected error occurred" — the script then never loads at all.
        // The previous version ended in `.catch(() => cached)` and `return cached || network`,
        // so a fetch rejection with nothing cached resolved to undefined and took the whole app
        // down with a white screen. A network failure must degrade to a network failure, not to
        // a service worker exception.
        const fromNetwork = (async () => {
            try {
                const resp = await fetch(req);
                if (resp && resp.status === 200 && resp.type === 'basic') {
                    cache.put(req, resp.clone());
                }
                return resp;
            } catch {
                return null;
            }
        })();

        // Lazy chunks without a content hash (webpack `chunks/[name].js`) keep their
        // URL across builds, so a cached copy may belong to an older build than the
        // entry that asks for it: its module ids do not match and React.lazy gets an
        // undefined default (the Code tab's minified React error #306, 2026-10-16),
        // and stale-while-revalidate serves that copy again on every reload. Fetch
        // them network-first; the cache is only the offline fallback. v5 purges the
        // stale entries v4 browsers already hold.
        if (url.pathname.includes('/chunks/') && !HASHED.test(url.pathname)) {
            const fresh = await fromNetwork;
            if (fresh && fresh.ok) return fresh;
            if (cached && cached.ok) return cached;
            return fresh || Response.error();
        }

        // `cached.ok`, not `cached`. The guard above refuses to serve a cached failure
        // cache-first — and then this branch handed back the very same entry, because a
        // non-ok hit is still a hit. The `.ok` test has to be on BOTH paths out of the
        // cache or it is decoration: measured 2026-08-30, a 404 seeded into the current
        // cache for a hashed chunk was served while the server answered that URL 200.
        if (cached && cached.ok) {
            // Stale-while-revalidate: serve the hit, refresh behind it. waitUntil keeps the
            // worker alive for the refresh after the response has already gone out.
            event.waitUntil(fromNetwork);
            return cached;
        }
        return (await fromNetwork) || Response.error();
    })());
});
