/* Service worker — appka musí fungovat v koupelně i bez signálu.
   Zvyš CACHE při každé změně souborů, jinak se stará verze drží. */
const CACHE = "skincare-v5";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icon.svg",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  /* Supabase nikdy necachovat — data musí být živá. */
  if (url.hostname.endsWith("supabase.co")) return;

  /* Vlastní soubory: síť napřed, cache jako záloha. Tak se
     nová verze projeví hned po nasazení, ale offline to jede. */
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then(r => r || caches.match("./index.html")))
    );
    return;
  }

  /* Fonty a CDN: cache napřed, ať se to nedrhne. */
  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(request, copy));
      return res;
    }).catch(() => cached))
  );
});
