/// <reference lib="webworker" />
/**
 * RPad service worker (built with vite-plugin-pwa in injectManifest mode).
 *
 * - Precaches the app shell (manifest injected at build time).
 * - Caches the self-hosted WebR runtime (/webr/*) and R binary packages from
 *   repo.r-wasm.org on first use (CacheFirst).
 * - Answers HEAD requests for cached runtime files from the cache: WebR's lazy
 *   virtual filesystem probes files with HEAD before reading them, and those
 *   probes would otherwise fail offline and stall startup.
 * - Turns an offline cache miss under /webr/ into a 404 so R sees "no such
 *   file" (its online behaviour for optional files) instead of a hung request.
 */
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare let self: ServiceWorkerGlobalScope;

const RUNTIME_CACHE = 'rpad-webr-runtime';
const PACKAGE_CACHE = 'rpad-r-packages';

clientsClaim();
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') void self.skipWaiting();
});

registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/webr\//] }));

const isRuntime = ({ url }: { url: URL }) => url.origin === self.location.origin && url.pathname.startsWith('/webr/');
const isPackage = ({ url }: { url: URL }) => url.hostname === 'repo.r-wasm.org';

const offlineMissAs404 = {
  handlerDidError: async () => new Response('', { status: 404, statusText: 'Not cached (offline)' }),
};

registerRoute(
  isRuntime,
  new CacheFirst({
    cacheName: RUNTIME_CACHE,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 180 }),
      offlineMissAs404,
    ],
  }),
);

registerRoute(
  isPackage,
  new CacheFirst({
    cacheName: PACKAGE_CACHE,
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] }), new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 90 })],
  }),
);

/** HEAD for runtime files: answer from the cache when the file is cached, otherwise go to the network. */
registerRoute(
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
);
