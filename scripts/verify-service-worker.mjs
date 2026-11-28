#!/usr/bin/env node
/** The service worker's failure modes, in a real browser, against the file that ships.
 *
 *  ROADMAP §2.2. The white-screen incident (9886889) was found by hand and fixed
 *  by hand; nothing has ever re-run it. This gate runs the class:
 *
 *    chunk-404-after-deploy   a browser holding yesterday's document asks for a
 *                             chunk that the deploy deleted.
 *    document-timeout         the network neither answers nor fails. A PWA whose
 *                             whole reason for existing is the offline case must
 *                             not hang forever on a document it has cached.
 *    stale-caches             a browser carrying an older worker's caches, and a
 *                             poisoned CURRENT cache, meets fresh chunks.
 *    cached-failure           a non-ok response that got into the cache must
 *                             never be served while the network can answer.
 *
 *  ## Why a fixture app and not the real build
 *
 *  Nothing here is about scratch-gui. The worker's contract is "same-origin GET
 *  in, Response out", and every one of these failures is reproducible against a
 *  four-line page with one hashed script. Driving the real build would add a
 *  20-minute webpack run to a gate that answers in seconds, and would couple a
 *  worker test to whether the GUI happens to render. The FILE under test is the
 *  shipped one — `overlay/scratch-gui/sw.js`, read off disk, served verbatim.
 *
 *  ## Why it mutates itself
 *
 *  House rule: a gate that cannot fail is not a gate. Each scenario names a
 *  mutation of sw.js that must break it, and the default run proves both halves
 *  — shipped green, mutated red. A mutation that does not change the source is
 *  itself a failure (the rig-verification rule: an edit that silently misses is
 *  how a vacuous test looks green), so every mutation asserts its own bite.
 *
 *  ## No fixed sleeps
 *
 *  `test/wait-census.test.mjs` is a zero-headroom ratchet on `waitForTimeout`.
 *  This file contains none: every wait is a condition (`waitForFunction`) or a
 *  bound on a navigation.
 *
 *  Usage:
 *    node scripts/verify-service-worker.mjs            shipped + all mutations
 *    node scripts/verify-service-worker.mjs --shipped  shipped only (fast)
 *    node scripts/verify-service-worker.mjs --only chunk-404-after-deploy
 */
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SW_PATH = resolve(root, 'overlay/scratch-gui/sw.js');
const SHIPPED_SW = readFileSync(SW_PATH, 'utf8');
const TOOLCHAIN_PACKAGE = JSON.parse(readFileSync(resolve(root,
    'overlay/scratch-gui/src/lib/runtime-package-inventory.json'), 'utf8'))
    .packages.find(record => record.id === 'sdcc-wasm' && record.delivery === 'optional-user-download');
if (!TOOLCHAIN_PACKAGE) throw new Error('the optional SDCC package is missing from the inventory');
const PORT = Number(process.env.SW_GATE_PORT || 8127);

/** Long enough that a healthy step never reaches it, short enough that a hung
 *  one is diagnosed rather than waited out. Not a sleep: nothing waits for it
 *  unless the condition never arrives. */
const NAV_TIMEOUT_MS = 20_000;
const COND_TIMEOUT_MS = 20_000;

// ---------------------------------------------------------------------------
// The fixture origin.
//
// `deploy.hash` is the content hash index.html names. Changing it and adding the
// old hash to `deploy.gone` is exactly what a deploy does to a browser: the tree
// is replaced, so yesterday's chunk is a 404 rather than a stale 200.
// ---------------------------------------------------------------------------
const state = {
    sw: SHIPPED_SW,
    hash: 'aaaaaaaa11111111',
    gone: new Set(),
    hangDocument: false,
    log: []
};

const indexHtml = (hash) => `<!doctype html>
<meta charset="utf-8"><title>bw sw fixture</title>
<body><div id="app">loading</div>
<script>
window.__swReady = navigator.serviceWorker.register('./sw.js', {scope: './'});
</script>
<script src="./chunks/gui.${hash}.js"></script>
`;

const chunkBody = (hash) => `window.__boot = ${JSON.stringify(hash)};\n`;

const server = createServer((req, res) => {
    const path = decodeURIComponent(req.url.split('?')[0]);
    state.log.push(path);

    const isDoc = path === '/' || path === '/index.html';
    if (isDoc && state.hangDocument) {
        // Neither an answer nor a failure. This is the captive-portal / dead-TCP
        // case, and it is the one a `try/catch` around fetch does not cover:
        // there is nothing to catch, only silence. The socket is left open on
        // purpose — destroying it would reject the worker's fetch and test the
        // offline path instead, which is a different branch.
        return;
    }
    const send = (status, type, body) => {
        res.writeHead(status, {'content-type': type, 'cache-control': 'no-store'});
        res.end(body);
    };
    if (isDoc) return send(200, 'text/html; charset=utf-8', indexHtml(state.hash));
    if (path === '/sw.js') return send(200, 'text/javascript', state.sw);
    if (path === '/bare.html') {
        // A page on this origin that does NOT register the worker, so a scenario
        // can seed CacheStorage the way a previous worker generation left it.
        return send(200, 'text/html; charset=utf-8',
            '<!doctype html><meta charset="utf-8"><title>bare</title><body>bare');
    }
    const chunk = /^\/chunks\/gui\.([a-f0-9]+)\.js$/.exec(path);
    if (chunk) {
        if (state.gone.has(chunk[1])) return send(404, 'text/plain', 'not found');
        return send(200, 'text/javascript', chunkBody(chunk[1]));
    }
    if (path === '/chunks/importer.js') {
        // An unhashed lazy chunk: same URL in every build, body names the build.
        return send(200, 'text/javascript', `window.__importer = ${JSON.stringify(state.hash)};\n`);
    }
    if (/^\/chunks\/poison\.[a-f0-9]+\.js$/.test(path)) {
        return send(200, 'text/javascript', 'window.__poison = "fresh";\n');
    }
    if (/^\/previews\/[a-f0-9]{64}\.svg$/.test(path)) {
        return send(200, 'image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="12"><rect width="24" height="12"/></svg>');
    }
    if (path === '/examples/index.json') return send(200, 'application/json', '{"live":true}');
    if (/^\/static\/thumbnails\/gallery-artwork\/robots\.[a-f0-9]{64}\.json$/.test(path)) {
        return send(200, 'application/json', '{"sample":"cover.png"}');
    }
    send(404, 'text/plain', 'not found');
});

const ORIGIN = `http://localhost:${PORT}`;

/** Reset the origin to a first-deploy state and forget every registration. */
async function freshContext (browser, {hash = 'aaaaaaaa11111111'} = {}) {
    state.hash = hash;
    state.gone = new Set();
    state.hangDocument = false;
    state.log = [];
    // A new context is a new storage partition: no registration, no caches.
    return browser.newContext();
}

/** Load the fixture and come back only once the worker CONTROLS the page.
 *
 *  `navigator.serviceWorker.ready` resolves at activation, which is a different
 *  moment from control: the first navigation was fetched before any worker
 *  existed, so `controller` is null until `clients.claim()` lands (or until the
 *  next navigation). Asserting on an uncontrolled page is how a service-worker
 *  test passes without ever running the worker. */
async function openControlled (context) {
    const page = await context.newPage();
    page.setDefaultTimeout(COND_TIMEOUT_MS);
    await page.goto(`${ORIGIN}/`, {waitUntil: 'load', timeout: NAV_TIMEOUT_MS});
    await page.waitForFunction(
        () => navigator.serviceWorker.controller !== null, null, {timeout: COND_TIMEOUT_MS});
    return page;
}

const bootHash = (page) => page.evaluate(() => window.__boot ?? null);

const cacheKeys = (page) => page.evaluate(() => caches.keys());

/** The cache name sw.js currently uses. Read from the source rather than
 *  hard-coded, so a version bump does not quietly make these scenarios seed a
 *  cache nothing reads and pass for the wrong reason. */
function currentCacheName (src) {
    const m = /const CACHE = '([^']+)'/.exec(src);
    if (!m) throw new Error('cannot find CACHE in sw.js — the scenarios seed it by name');
    return m[1];
}

// ---------------------------------------------------------------------------
// Scenarios. Each throws on failure; the message is the finding.
// ---------------------------------------------------------------------------
const SCENARIOS = {
    /** (a) A deploy replaced the tree. The document names a new chunk and the old
     *  chunk is gone. The browser must end up running the NEW build.
     *
     *  This is the 2026-08-09 production failure in miniature: a cached document
     *  naming a deleted chunk is a build that no longer exists on the server, and
     *  the app dies the moment it lazily imports anything. */
    async 'chunk-404-after-deploy' (browser) {
        const context = await freshContext(browser, {hash: 'aaaaaaaa11111111'});
        try {
            const page = await openControlled(context);
            // Second visit: now fully worker-served, so index.html and the chunk
            // are both in the cache — the state a returning user is really in.
            await page.reload({waitUntil: 'load', timeout: NAV_TIMEOUT_MS});
            await page.waitForFunction(() => window.__boot === 'aaaaaaaa11111111');

            // Deploy.
            state.hash = 'bbbbbbbb22222222';
            state.gone.add('aaaaaaaa11111111');
            state.log = [];

            await page.reload({waitUntil: 'load', timeout: NAV_TIMEOUT_MS});
            const got = await bootHash(page);
            if (got !== 'bbbbbbbb22222222') {
                throw new Error(
                    `after a deploy the page booted ${JSON.stringify(got)}, expected the new ` +
                    'build "bbbbbbbb22222222". The worker served a cached document, which ' +
                    'names a chunk the deploy deleted — "Loading chunk NNN failed".');
            }
            const stale = state.log.filter((p) => p.includes('aaaaaaaa11111111'));
            if (stale.length) {
                throw new Error(`the page still requested the deleted build: ${stale.join(', ')}`);
            }
        } finally {
            await context.close();
        }
    },

    /** (b) The network hangs. Not "fails" — hangs.
     *
     *  Network-first documents have no answer for silence: `fetch` neither
     *  resolves nor rejects, so the catch that handles offline never runs and the
     *  navigation waits forever on a page the browser already has. A PWA that
     *  works offline but not on a bad network has the case backwards. */
    async 'document-timeout' (browser) {
        const context = await freshContext(browser, {hash: 'cccccccc33333333'});
        try {
            const page = await openControlled(context);
            await page.reload({waitUntil: 'load', timeout: NAV_TIMEOUT_MS});
            await page.waitForFunction(() => window.__boot === 'cccccccc33333333');

            state.hangDocument = true;
            await page.reload({waitUntil: 'load', timeout: NAV_TIMEOUT_MS});
            const got = await bootHash(page);
            if (got !== 'cccccccc33333333') {
                throw new Error(
                    `with the document request hanging the page booted ${JSON.stringify(got)}; ` +
                    'the cached document should have been served after the worker gave up ' +
                    'waiting.');
            }
        } finally {
            state.hangDocument = false;
            await context.close();
        }
    },

    /** (c) A browser arriving with an older worker's caches AND a poisoned copy
     *  of the current one.
     *
     *  Two claims, because they fail separately. `activate` must delete every
     *  cache that is not the current one — renaming is the only recovery a
     *  poisoned browser has, and it only works if the rename actually purges.
     *  And a document already sitting in the CURRENT cache must not be served in
     *  preference to the network, or the rename buys one deploy of safety. */
    async 'stale-caches-vs-fresh-chunks' (browser) {
        const context = await freshContext(browser, {hash: 'dddddddd44444444'});
        try {
            const current = currentCacheName(state.sw);
            const seed = await context.newPage();
            seed.setDefaultTimeout(COND_TIMEOUT_MS);
            await seed.goto(`${ORIGIN}/bare.html`, {waitUntil: 'load', timeout: NAV_TIMEOUT_MS});
            await seed.evaluate(async ({current, origin}) => {
                const staleDoc = '<!doctype html><meta charset="utf-8"><body>' +
                    '<script src="./chunks/gui.eeeeeeee55555555.js"><\/script>';
                const html = {status: 200, headers: {'content-type': 'text/html; charset=utf-8'}};
                // An older generation's cache, and a poisoned current one.
                const old = await caches.open('brickwright-v1');
                await old.put(`${origin}/index.html`, new Response(staleDoc, html));
                const now = await caches.open(current);
                await now.put(`${origin}/`, new Response(staleDoc, html));
            }, {current, origin: ORIGIN});
            await seed.close();

            const page = await openControlled(context);
            const keys = await cacheKeys(page);
            const survivors = keys.filter((k) => k !== current);
            if (survivors.length) {
                throw new Error(
                    `activate left ${survivors.length} non-current cache(s) alive: ` +
                    `${survivors.join(', ')}. Renaming CACHE is the only way to recover a ` +
                    'browser that is already poisoned, and it only works if activate purges.');
            }

            await page.reload({waitUntil: 'load', timeout: NAV_TIMEOUT_MS});
            const got = await bootHash(page);
            if (got !== 'dddddddd44444444') {
                throw new Error(
                    `a poisoned entry in the CURRENT cache was served: the page booted ` +
                    `${JSON.stringify(got)} instead of the deployed build. The document must ` +
                    'come from the network whenever there is a network.');
            }
        } finally {
            await context.close();
        }
    },

    /** (d) A failure that got into the cache.
     *
     *  Hashed assets are cache-first because the hash is the version — which also
     *  means a cached entry is never revalidated before it is served. If a non-ok
     *  response ever lands in there (a deploy that served a mismatched tree did
     *  exactly this, see the v4 note in sw.js), cache-first makes it the answer. */
    async 'cached-failure-is-not-served' (browser) {
        const context = await freshContext(browser, {hash: 'ffffffff66666666'});
        try {
            const current = currentCacheName(state.sw);
            const page = await openControlled(context);
            const url = `${ORIGIN}/chunks/poison.99999999aaaaaaaa.js`;
            const put = await page.evaluate(async ({current, url}) => {
                try {
                    const c = await caches.open(current);
                    await c.put(url, new Response('', {status: 404, statusText: 'Not Found'}));
                    const back = await c.match(url);
                    return back ? back.status : 0;
                } catch (e) {
                    return `threw: ${e && e.message}`;
                }
            }, {current, url});
            // Verify the instrument before the subject: if the seed did not land,
            // the assertion below passes for want of a poison rather than because
            // the worker refused one.
            if (put !== 404) {
                throw new Error(`could not seed a cached 404 (cache.match returned ${put}) — ` +
                    'the scenario would pass vacuously');
            }
            const status = await page.evaluate(async (u) => (await fetch(u)).status, url);
            if (status !== 200) {
                throw new Error(
                    `a cached 404 for a hashed asset was served (status ${status}). ` +
                    'Cache-first never revalidates, so a cached failure is the answer until ' +
                    'the cache is renamed.');
            }
        } finally {
            await context.close();
        }
    }
};

SCENARIOS['library-previews-on-demand'] = async browser => {
    const context = await freshContext(browser);
    try {
        const page = await openControlled(context);
        if (state.log.some(path => path.startsWith('/previews/') || path.includes('/gallery-artwork/'))) {
            throw new Error('Gallery assets downloaded before demand');
        }
        const index = `/static/thumbnails/gallery-artwork/robots.${'a'.repeat(64)}.json`;
        const first = `/previews/${'a'.repeat(64)}.svg`;
        const second = `/previews/${'b'.repeat(64)}.svg`;
        const readIndex = () => page.evaluate(async path => (await (await fetch(path)).json()).sample, index);
        const decode = path => page.evaluate(async src => {
            const image = new Image();
            image.src = src;
            await image.decode();
            return image.naturalWidth;
        }, path);
        if (await readIndex() !== 'cover.png') throw new Error('Gallery index was unavailable');
        if (await decode(first) !== 24) throw new Error('First visible thumbnail was unavailable');
        await page.waitForFunction(async path => (await (await caches.open('brickwright-library-previews-v1')).match(path))?.ok, first);
        await page.reload();
        if (await readIndex() !== 'cover.png' || state.log.filter(path => path === index).length !== 1) {
            throw new Error('Reopening the gallery downloaded its content-addressed index again');
        }
        if (await decode(first) !== 24 || state.log.filter(path => path === first).length !== 1) {
            throw new Error('Reopening the thumbnail downloaded it again');
        }
        if (await decode(second) !== 24 || state.log.filter(path => path === second).length !== 1) {
            throw new Error('Different content hash was not loaded separately');
        }
        await context.setOffline(true);
        if (await readIndex() !== 'cover.png') throw new Error('The previously visited gallery index was unavailable offline');
        if (await decode(first) !== 24) throw new Error('The previously visited thumbnail was unavailable offline');
    } finally {
        await context.close();
    }
};

// A compiler installation belongs to the user, not to the currently deployed
// app. Exercise a real worker UPDATE after the cache has been populated: merely
// opening an already active worker would never run its activation cleanup.
SCENARIOS['optional-toolchain-survives-update'] = async browser => {
    const context = await freshContext(browser);
    const requested = [];
    context.on('request', request => {
        if (new URL(request.url()).pathname.includes('/static/sdcc-wasm/')) requested.push(request.url());
    });
    try {
        const page = await openControlled(context);
        const cacheName = TOOLCHAIN_PACKAGE.cacheName;
        const url = new URL('static/sdcc-wasm/sdcc.wasm', TOOLCHAIN_PACKAGE.origin).href;
        const body = 'optional-installation-fixture';
        const obsolete = ['brickwright-v1', `${cacheName}-extra`, 'bw-sdcc-wasm-v0'];
        if ((await cacheKeys(page)).includes(cacheName)) {
            throw new Error('a fresh activation created an optional compiler cache before user installation');
        }
        if (requested.length) throw new Error(`compiler prefetch before installation: ${requested.join(', ')}`);

        const seeded = await page.evaluate(async ({cacheName, url, body, obsolete}) => {
            const cache = await caches.open(cacheName);
            await cache.put(url, new Response(body));
            for (const name of obsolete) {
                await (await caches.open(name)).put(url, new Response('obsolete'));
            }
            return (await cache.match(url))?.text();
        }, {cacheName, url, body, obsolete});
        if (seeded !== body) throw new Error('the optional-cache fixture did not land; retention would be vacuous');

        state.sw += '\n// optional-toolchain-update-fixture\n';
        await page.evaluate(async () => {
            const registration = await navigator.serviceWorker.getRegistration();
            if (!registration?.active || registration.active !== navigator.serviceWorker.controller) {
                throw new Error('the previous worker must control the page before its update');
            }
            window.__toolchainPreviousWorker = registration.active;
            await registration.update();
        });
        await page.waitForFunction(async () => {
            const registration = await navigator.serviceWorker.getRegistration();
            return registration?.active && registration.active !== window.__toolchainPreviousWorker &&
                registration.active.state === 'activated' &&
                navigator.serviceWorker.controller === registration.active;
        }, null, {timeout: COND_TIMEOUT_MS});

        const keys = await cacheKeys(page);
        if (!keys.includes(cacheName)) throw new Error('worker activation erased the optional compiler installation');
        const survivingObsolete = obsolete.filter(name => keys.includes(name));
        if (survivingObsolete.length) {
            throw new Error(`worker activation kept obsolete/lookalike caches: ${survivingObsolete.join(', ')}`);
        }
        await context.setOffline(true);
        const retained = await page.evaluate(async ({cacheName, url}) => {
            if (!(await caches.keys()).includes(cacheName)) return null;
            return (await (await caches.open(cacheName)).match(url))?.text();
        }, {cacheName, url});
        if (retained !== body) throw new Error('the installed compiler bytes did not survive the update offline');
        if (requested.length) throw new Error(`worker lifecycle requested compiler payloads: ${requested.join(', ')}`);
    } finally {
        await context.close();
    }
};

// (e) is added below SCENARIOS' literal so (a)-(d) read in their original order.
SCENARIOS['unhashed-chunk-after-deploy'] = async (browser) => {
    /** An unhashed lazy chunk (`chunks/[name].js`) keeps its URL across builds.
     *  After a deploy the page must get the NEW build's copy on the first request,
     *  not the cached old one: an old chunk under a new entry is how React.lazy
     *  resolved to an undefined default in the Code tab (#306, 2026-10-16). */
    const context = await freshContext(browser, {hash: '1111111aaaaaaaaa'});
    try {
        const page = await openControlled(context);
        const load = () => page.evaluate(async (u) => {
            const r = await fetch(u);
            return r.ok ? (await r.text()) : `status ${r.status}`;
        }, `${ORIGIN}/chunks/importer.js`);
        const before = await load();
        await load();
        if (!before.includes('1111111aaaaaaaaa')) {
            throw new Error(`could not load the unhashed chunk before the deploy (${before}); ` +
                'the scenario would pass vacuously');
        }
        state.hash = '2222222bbbbbbbbb';
        const after = await load();
        if (!after.includes('2222222bbbbbbbbb')) {
            throw new Error(`after a deploy the unhashed chunk came back as ${JSON.stringify(after.trim())}: ` +
                'the worker served the old build\'s copy, the stale-chunk #306 path.');
        }
    } finally {
        await context.close();
    }
};

// ---------------------------------------------------------------------------
// Mutations. Each names the scenario it must break.
// ---------------------------------------------------------------------------
const MUTATIONS = [
    {
        name: 'documents-served-cache-first',
        scenario: 'chunk-404-after-deploy',
        why: 'the original 2026-08-09 bug: `return cached || network` for the document, ' +
            'so a returning browser keeps running a build the server deleted.',
        apply: (src) => src.replace(
            'if (isDocument || isLiveData) {',
            'if (isDocument || isLiveData) {\n            const c0 = await cache.match(req);\n            if (c0) return c0;')
    },
    {
        name: 'documents-served-cache-first (stale current cache)',
        scenario: 'stale-caches-vs-fresh-chunks',
        why: 'the same mutation seen from the other side: a poisoned entry already in ' +
            'the CURRENT cache is served in preference to the network.',
        apply: (src) => src.replace(
            'if (isDocument || isLiveData) {',
            'if (isDocument || isLiveData) {\n            const c0 = await cache.match(req);\n            if (c0) return c0;')
    },
    {
        name: 'no-timeout-on-the-document-fetch',
        scenario: 'document-timeout',
        why: 'network-first with nothing bounding the wait. `catch` handles a network ' +
            'that FAILS; it has no answer for one that goes quiet.',
        apply: (src) => src.replace(
            'await raceWithCache(network, cache, req)', 'await network')
    },
    {
        name: 'activate-keeps-old-caches',
        scenario: 'stale-caches-vs-fresh-chunks',
        why: 'without the purge, renaming CACHE stops being a recovery: the poisoned ' +
            'caches simply accumulate beside the new one.',
        apply: (src) => src.replace(
            'await Promise.all(keys.filter(k => k !== CACHE && k !== PREVIEW_CACHE && k !== RENDERED_PREVIEW_CACHE && !OPTIONAL_TOOLCHAIN_CACHES.has(k)).map(k => caches.delete(k)));',
            'await Promise.all(keys.filter(() => false).map(k => caches.delete(k)));')
    },
    {
        name: 'activate-erases-optional-toolchain',
        scenario: 'optional-toolchain-survives-update',
        why: 'an application worker update must not remove a separately installed compiler.',
        apply: (src) => src.replace(' && !OPTIONAL_TOOLCHAIN_CACHES.has(k)', '')
    },
    {
        name: 'stale-while-revalidate-serves-cached-failures',
        scenario: 'cached-failure-is-not-served',
        why: 'the `.ok` guard on the cache-first branch is defeated if the ' +
            'revalidate branch below it will hand back the same non-ok entry.',
        apply: (src) => src.replace('if (cached && cached.ok) {', 'if (cached) {')
    },
    {
        name: 'unhashed-chunks-stale-while-revalidate',
        scenario: 'unhashed-chunk-after-deploy',
        why: 'without the network-first branch an unhashed chunk is served from the ' +
            'cache after a deploy, so the new entry runs an old build\'s module.',
        apply: (src) => src.replace(
            "if (url.pathname.includes('/chunks/') && !HASHED.test(url.pathname)) {",
            'if (false) {')
    }
];

// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
const shippedOnly = argv.includes('--shipped');

async function run () {
    await new Promise((done) => server.listen(PORT, done));
    const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
    const failures = [];
    let ran = 0;
    try {
        for (const [name, fn] of Object.entries(SCENARIOS)) {
            if (only && name !== only) continue;
            state.sw = SHIPPED_SW;
            ran++;
            try {
                await fn(browser);
                console.log(`  PASS  ${name}`);
            } catch (e) {
                console.log(`  FAIL  ${name}\n        ${e.message}`);
                failures.push(`shipped sw.js fails "${name}": ${e.message}`);
            }
        }
        if (!ran) failures.push(`--only ${only} matched no scenario`);

        if (!shippedOnly) {
            console.log('\nmutation proof — each of these must go RED:');
            for (const m of MUTATIONS) {
                if (only && m.scenario !== only) continue;
                const mutated = m.apply(SHIPPED_SW);
                if (mutated === SHIPPED_SW) {
                    console.log(`  DEAD  ${m.name} — the edit matched nothing`);
                    failures.push(
                        `mutation "${m.name}" did not change sw.js. A mutation that misses ` +
                        'proves nothing and makes the gate look verified when it is not — ' +
                        'update the pattern to the current source.');
                    continue;
                }
                state.sw = mutated;
                let broke = false;
                let detail = '';
                try {
                    await SCENARIOS[m.scenario](browser);
                } catch (e) {
                    broke = true;
                    detail = e.message.split('\n')[0];
                }
                state.sw = SHIPPED_SW;
                if (broke) {
                    console.log(`  RED   ${m.name} -> ${m.scenario}\n        ${detail}`);
                } else {
                    console.log(`  GREEN ${m.name} -> ${m.scenario}  (should have failed)`);
                    failures.push(
                        `"${m.scenario}" still passes with sw.js mutated to ${m.name}. ` +
                        `${m.why} The scenario is not testing what it claims.`);
                }
            }
        }
    } finally {
        await browser.close();
        await new Promise((done) => server.close(done));
    }

    if (failures.length) {
        console.error(`\nverify-service-worker: ${failures.length} problem(s)`);
        for (const f of failures) console.error(`  - ${f}`);
        process.exit(1);
    }
    console.log(shippedOnly
        ? `\nverify-service-worker: ${ran} scenario(s) pass against the shipped worker. ` +
          'The mutation half was SKIPPED (--shipped), so this run has not shown that any ' +
          'of them can fail.'
        : '\nverify-service-worker: every scenario passes against the shipped worker, ' +
          'and every mutation breaks the scenario that covers it.');
}

await run();
