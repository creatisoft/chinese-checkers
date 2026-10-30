// Service worker: makes the game installable and playable offline.
// - Pages: network first (so updates show up), cached copy when offline or slow.
// - Built assets (hashed file names, never change): cache first.
// - Google Fonts: cached after first use.
// Registered from script.js in production builds only (it would fight Vite's dev server).

const CACHE = 'chinese-checkers-v1';
const NAV_TIMEOUT_MS = 3000; // flaky tablet Wi-Fi: fall back to the cached page quickly

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE);
        // Cache the page plus every same-origin file it references (hashed JS/CSS,
        // logo, icons) so the very first visit is enough to play offline.
        const response = await fetch('./', { cache: 'reload' });
        const html = await response.clone().text();
        await cache.put('./', response);
        const urls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
            .map(m => new URL(m[1], self.registration.scope))
            .filter(u => u.origin === self.location.origin)
            .map(u => u.href);
        await cache.addAll([...new Set([...urls, new URL('chinesecheckers-logo.png', self.registration.scope).href])]);
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        for (const key of await caches.keys()) {
            if (key !== CACHE) await caches.delete(key);
        }
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);

    if (request.mode === 'navigate') {
        event.respondWith(networkFirst(request));
    } else if (url.origin === self.location.origin) {
        event.respondWith(cacheFirst(request));
    } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
        event.respondWith(cacheFirst(request));
    }
    // Anything else (analytics) goes straight to the network
});

async function networkFirst(request) {
    const cache = await caches.open(CACHE);
    try {
        const response = await Promise.race([
            fetch(request),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NAV_TIMEOUT_MS)),
        ]);
        if (response.ok) cache.put('./', response.clone());
        return response;
    } catch (e) {
        return (await cache.match('./')) || Response.error();
    }
}

async function cacheFirst(request) {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
    return response;
}
