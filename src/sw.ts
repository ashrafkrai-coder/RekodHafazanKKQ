import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, PrecacheEntry } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: PrecacheEntry[];
};

self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  ({ request }) => request.destination === 'document',
  new NetworkFirst({
    cacheName: 'hafazan-pages',
    networkTimeoutSeconds: 5,
  }),
);

registerRoute(
  ({ request }) => ['style', 'script', 'worker', 'image'].includes(request.destination),
  new StaleWhileRevalidate({
    cacheName: 'hafazan-assets',
  }),
);

registerRoute(
  ({ url }) => url.hostname.endsWith('google.com') && url.pathname.includes('/macros/s/'),
  new NetworkFirst({
    cacheName: 'hafazan-data',
    networkTimeoutSeconds: 4,
  }),
);
