/// <reference lib="webworker" />
/**
 * RPad service worker (built with vite-plugin-pwa in injectManifest mode).
 *
 * - Precaches the app shell (manifest injected at build time).
 * - Caches the self-hosted WebR runtime (<base>/webr/*) and R binary packages
 *   from repo.r-wasm.org on first use (CacheFirst).
 * - Answers HEAD requests for cached runtime files from the cache: WebR's lazy
 *   virtual filesystem probes files with HEAD before reading them, and those
 *   probes would otherwise fail offline and stall startup.
 * - Turns an offline cache miss under /webr/ into a 404 so R sees "no such
 *   file" (its online behaviour for optional files) instead of a hung request.
 * - Adds Cross-Origin-Opener-Policy / Cross-Origin-Embedder-Policy to every
 *   response it serves. Hosts that cannot send custom headers (GitHub Pages)
 *   still get a cross-origin isolated page after one reload, which enables
 *   WebR's SharedArrayBuffer channel and interrupting R. The app triggers that
 *   reload once the worker controls the page (see PwaUpdate.tsx).
 */
import { clientsClaim } from 'workbox-core';
import { PrecacheController, PrecacheRoute } from 'workbox-precaching';
import { Router, NavigationRoute, Route } from 'workbox-routing';
import { CacheFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare let self: ServiceWorkerGlobalScope;

const RUNTIME_CACHE = 'rpad-webr-runtime';
const PACKAGE_CACHE = 'rpad-r-packages';
/** Base path of the site, e.g. "/" or "/RPad/" (the worker is registered at <base>sw.js). */
const BASE = new URL(self.registration.scope).pathname;

clientsClaim();

const precache = new PrecacheController();
precache.precache(self.__WB_MANIFEST);
self.addEventListener('activate', (event) => event.waitUntil(precache.activate(event)));

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') void self.skipWaiting();
});

const router = new Router();
router.registerRoute(new PrecacheRoute(precache));
router.registerRoute(new NavigationRoute(precache.createHandlerBoundToURL('index.html'), { denylist: [new RegExp(`^${BASE}webr/`)] }));

const isRuntime = ({ url }: { url: URL }) => url.origin === self.location.origin && url.pathname.startsWith(`${BASE}webr/`);
const isPackage = ({ url }: { url: URL }) => url.hostname === 'repo.r-wasm.org';

const offlineMissAs404 = {
  handlerDidError: async () => new Response('', { status: 404, statusText: 'Not cached (offline)' }),
};

router.registerRoute(
  new Route(
    isRuntime,
    new CacheFirst({
      cacheName: RUNTIME_CACHE,
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({ maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 180 }),
        offlineMissAs404,
      ],
    }),
  ),
);

router.registerRoute(
  new Route(
    isPackage,
    new CacheFirst({
      cacheName: PACKAGE_CACHE,
      plugins: [new CacheableResponsePlugin({ statuses: [0, 200] }), new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 90 })],
    }),
  ),
);

/** HEAD for runtime files: answer from the cache when the file is cached, otherwise go to the network. */
router.registerRoute(
  new Route(
    isRuntime,
    async ({ request }) => {
      const cache = await caches.open(RUNTIME_CACHE);
      const cached = await cache.match(request.url);
      if (cached) {
        const headers = new Headers();
        for (const name of ['content-type', 'content-length', 'last-modified', 'etag']) {
          const v = cached.headers.get(name);
          if (v) headers.set(name, v);
        }
        if (!headers.has('content-length')) headers.set('content-length', String((await cached.clone().arrayBuffer()).byteLength));
        return new Response(null, { status: 200, headers });
      }
      try {
        return await fetch(request);
      } catch {
        return new Response(null, { status: 404, statusText: 'Not cached (offline)' });
      }
    },
    'HEAD',
  ),
);

// Everything else (same-origin files not precached, cross-origin resources) goes to the network.
router.setDefaultHandler(new NetworkOnly());

/** Add the cross-origin isolation headers. Opaque or unmodifiable responses are returned as-is. */
function withIsolationHeaders(response: Response): Response {
  if (response.status === 0 || response.type === 'opaque' || response.type === 'opaqueredirect') return response;
  try {
    const headers = new Headers(response.headers);
    headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  } catch {
    return response;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' && request.method !== 'HEAD') return;
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return;
  const responsePromise = router.handleRequest({ request, event });
  if (!responsePromise) return;
  event.respondWith(responsePromise.then(withIsolationHeaders));
});
