/// <reference lib="webworker" />
// TillPoint service worker (built through vite-plugin-pwa `injectManifest`).
// Dependency-free on purpose: the till must keep working even if a workbox
// runtime chunk fails to download.
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision?: string | null }>;
};

const VERSION = "tillpoint-cache-v4";
const PRECACHE = VERSION;
const RUNTIME = "tillpoint-runtime-v4";
const OFFLINE_URL = "/offline.html";
const SYNC_TAG = "tillpoint-sales";

// Injected at build time: every hashed JS/CSS/asset of the app shell.
const PRECACHE_URLS = Array.from(
  new Set([
    ...(self.__WB_MANIFEST ?? []).map((entry) => entry.url),
    "/",
    OFFLINE_URL,
    "/manifest.webmanifest",
    "/favicon.ico",
    "/icons/icon-192.png",
    "/icons/icon-512.png",
    "/icons/apple-touch-icon.png",
  ]),
);

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      // Individually so one bad URL can never fail the whole install.
      await Promise.allSettled(
        PRECACHE_URLS.map((url) => cache.add(new Request(url, { cache: "reload" }))),
      );
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.allSettled(
        keys
          .filter((key) => key.startsWith("tillpoint-") && key !== PRECACHE && key !== RUNTIME)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

// The page decides when to swap versions so a cashier is never interrupted.
self.addEventListener("message", (event) => {
  if ((event.data as { type?: string } | undefined)?.type === "SKIP_WAITING") void self.skipWaiting();
});

async function cacheFirst(request: Request): Promise<Response> {
  const cached = await caches.match(request, { ignoreSearch: false });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === "opaque") {
    const copy = response.clone();
    void caches.open(RUNTIME).then((cache) => cache.put(request, copy));
  }
  return response;
}

async function navigationHandler(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    const copy = response.clone();
    void caches.open(RUNTIME).then((cache) => cache.put("/", copy));
    return response;
  } catch {
    // The SPA shell answers every in-app route while offline.
    return (
      (await caches.match(request)) ??
      (await caches.match("/")) ??
      (await caches.match(OFFLINE_URL)) ??
      new Response("Offline", { status: 503 })
    );
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const isSupabase = url.hostname.endsWith("supabase.co");
  if (!sameOrigin && !isSupabase && url.hostname !== "fonts.gstatic.com") return;

  // Backend: network-first, with an explicit offline signal for the app.
  if (isSupabase) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(JSON.stringify({ offline: true, error: "Offline" }), {
            status: 503,
            headers: { "content-type": "application/json" },
          }),
      ),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(navigationHandler(request));
    return;
  }

  event.respondWith(
    cacheFirst(request).catch(
      async () => (await caches.match(request)) ?? new Response("", { status: 504 }),
    ),
  );
});

// Background Sync: wake a client to flush the queue with its Supabase session.
// Reject when no client can run the upload so the browser retries later.
self.addEventListener("sync", (event) => {
  const syncEvent = event as ExtendableEvent & { tag?: string };
  if (syncEvent.tag !== SYNC_TAG) return;
  syncEvent.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (clients.length === 0) throw new Error("No client available to sync sales");
      for (const client of clients) client.postMessage({ type: "RUN_SALES_SYNC" });
    })(),
  );
});

self.addEventListener("push", () => {
  // Scaffold for future receipt/stock notifications.
});

export {};
