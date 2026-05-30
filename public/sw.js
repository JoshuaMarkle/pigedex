// Pigedex Service Worker
// Strategy:
//   - App shell (HTML navigation) → Network First, fall back to cache
//   - Static assets (JS, CSS, fonts, images) → Cache First
//   - Supabase / external API calls → Network Only (don't cache live data)

const CACHE_NAME = "pigedex-v2";
const STATIC_CACHE = "pigedex-static-v1";
const IMAGE_CACHE = "pigedex-images-v1";

// Assets to pre-cache on install (app shell)
const PRECACHE_URLS = ["/", "/catalog", "/flights", "/manifest.json"];

// ── Install ───────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

// ── Activate ──────────────────────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (k) =>
                k !== CACHE_NAME && k !== STATIC_CACHE && k !== IMAGE_CACHE,
            )
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Cache pigeon images from Supabase Storage so they work offline
  if (
    url.hostname.includes("supabase.co") &&
    url.pathname.includes("/storage/v1/object/public/pigeon-images/")
  ) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok) cache.put(request, response.clone());
          return response;
        } catch {
          return new Response("Image unavailable offline", { status: 503 });
        }
      }),
    );
    return;
  }

  // Skip all other Supabase API requests (dynamic data — served from IndexedDB via app)
  if (url.hostname.includes("supabase.co")) return;
  if (!url.protocol.startsWith("http")) return;

  // Static assets → Cache First
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|woff2?|ttf|otf)$/)
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  // HTML navigation → Network First, fall back to cache
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("/"))),
    );
    return;
  }
});
