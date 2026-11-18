/* global self, caches, fetch, Response, Request, URL */
/*
 * Memory Dungeon's service worker: the game keeps playing without a connection
 * (docs/MARKET_FLOW_REVIEW_WIDER.md, P0; registered by src/renderer/serviceWorker.ts).
 *
 * - A page load goes to the network first, so a new deploy reaches players at once; with no
 *   network it is answered from the last copy of the page, never with the browser's error page.
 * - The build's hashed files (/assets/...) never change under their name: cache first.
 * - Everything else the game itself loads (fonts, card art, sounds, music) is served from the
 *   cache and refreshed behind it. The run's loading screen preloads every asset a run uses, so
 *   one session online leaves the whole game here.
 * - A media byte range is cut from the whole file in the cache.
 * - Not cached: other sites (the scores service), and the store trailers and artwork, which the
 *   game itself never loads.
 * - Each visit drops the hashed files no longer in the live build (`/asset-manifest.json`): a
 *   deploy renames them, and the cache otherwise kept every build it had ever seen.
 */
const CACHE = 'memory-dungeon-v1';
// Hashed same-origin files: the copy is the same whatever Origin header asked (fonts and module
// scripts send one, the worker's own fetches do not), so a Vary: Origin must not hide it.
const MATCH = { ignoreVary: true };
const SHELL = ['/', '/index.html', '/site.webmanifest', '/favicon.svg'];
const NEVER = /^\/(?:trailers|artwork|wip-assets|privacy|asset-manifest\.json)(?:\/|\.|$)/;

/* The live build's file list; a cached /assets/ file not on it belongs to an earlier deploy. */
const pruneOldBuilds = async (cache) => {
    let assets;
    try {
        const response = await fetch('/asset-manifest.json', { cache: 'no-store' });
        if (!response.ok) return;
        assets = (await response.json()).assets;
    } catch {
        return; // Offline: keep everything, the game may need it.
    }
    if (!Array.isArray(assets) || assets.length === 0) return;
    const live = new Set(assets);
    for (const request of await cache.keys()) {
        const { pathname } = new URL(request.url);
        if (pathname.startsWith('/assets/') && !live.has(pathname)) {
            await cache.delete(request, MATCH);
        }
    }
};

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(CACHE)
            .then((cache) => cache.addAll(SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((names) => Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name))))
            .then(() => self.clients.claim())
    );
});

const put = async (request, response) => {
    if (response && response.ok && response.type === 'basic') {
        const cache = await caches.open(CACHE);
        await cache.put(request, response.clone());
    }
    return response;
};

const pageFromNetwork = async (request) => {
    try {
        const response = await fetch(request);
        // Every route is the same single page; keep the latest copy under one name.
        if (response.ok) {
            const cache = await caches.open(CACHE);
            await cache.put('/index.html', response.clone());
        }
        return response;
    } catch {
        const cached = (await caches.match('/index.html', MATCH)) || (await caches.match('/', MATCH));
        return cached || new Response('Memory Dungeon needs one visit online before it can play offline.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    }
};

const cacheFirst = async (request) => {
    const cached = await caches.match(request, MATCH);
    if (cached) {
        return cached;
    }
    return put(request, await fetch(request));
};

const staleWhileRevalidate = async (request) => {
    const cached = await caches.match(request, MATCH);
    const refresh = fetch(request)
        .then((response) => put(request, response))
        .catch(() => undefined);
    if (cached) {
        return cached;
    }
    const fresh = await refresh;
    return fresh || new Response('', { status: 504 });
};

/*
 * Music and some sounds play through a media element, which asks for byte ranges. Answer those
 * from the whole file in the cache (fetching it whole once if needed) so a song still plays offline.
 */
const rangeFromCache = async (request) => {
    const url = new URL(request.url);
    const whole = new Request(url.pathname + url.search);
    let response = await caches.match(whole, MATCH);
    if (!response) {
        response = await put(whole, await fetch(whole));
    }
    const body = await response.clone().arrayBuffer();
    const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') || '');
    if (!match) {
        return response;
    }
    const size = body.byteLength;
    const start = match[1] === '' ? Math.max(0, size - Number(match[2])) : Number(match[1]);
    const end = match[1] !== '' && match[2] !== '' ? Math.min(Number(match[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
        return new Response('', { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    }
    return new Response(body.slice(start, end + 1), {
        status: 206,
        headers: {
            'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
            'Content-Range': `bytes ${start}-${end}/${size}`,
            'Content-Length': String(end - start + 1),
            'Accept-Ranges': 'bytes'
        }
    });
};

/*
 * The page sends the files it has used (its resource timing list): some were loaded before this
 * worker controlled the page (the whole first visit), and some the browser served from its memory
 * cache without asking. Cache whichever of them are missing, so offline has everything a session saw.
 */
self.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || data.type !== 'cache-used' || !Array.isArray(data.urls)) {
        return;
    }
    event.waitUntil(
        caches.open(CACHE).then(async (cache) => {
            for (const raw of data.urls) {
                let url;
                try {
                    url = new URL(raw);
                } catch {
                    continue;
                }
                if (url.origin !== self.location.origin || NEVER.test(url.pathname) || url.pathname === '/sw.js') {
                    continue;
                }
                const key = url.pathname + url.search;
                if (await cache.match(key, MATCH)) {
                    continue;
                }
                try {
                    await put(new Request(key), await fetch(key));
                } catch {
                    // Offline or gone: the next session will try again.
                }
            }
            await pruneOldBuilds(cache);
        })
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') {
        return;
    }
    const url = new URL(request.url);
    if (url.origin !== self.location.origin || NEVER.test(url.pathname) || url.pathname === '/sw.js') {
        return;
    }
    if (request.headers.has('range')) {
        event.respondWith(rangeFromCache(request));
        return;
    }
    if (request.mode === 'navigate') {
        event.respondWith(pageFromNetwork(request));
        return;
    }
    if (url.pathname.startsWith('/assets/')) {
        event.respondWith(cacheFirst(request));
        return;
    }
    event.respondWith(staleWhileRevalidate(request));
});
