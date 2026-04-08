const CACHE_NAME = "replus-leads-cache-v3";
const APP_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/img/VMS_Energy_logo_azul.webp",
  "./assets/img/RE_Events_orange.webp",
  "./assets/ocr/lib/tesseract.min.js",
  "./assets/ocr/lib/worker.min.js",
  "./assets/ocr/core/tesseract-core.wasm.js",
  "./assets/ocr/core/tesseract-core-simd.wasm.js",
  "./assets/ocr/core/tesseract-core-lstm.wasm.js",
  "./assets/ocr/core/tesseract-core-simd-lstm.wasm.js",
  "./assets/ocr/core/tesseract-core.wasm",
  "./assets/ocr/core/tesseract-core-simd.wasm",
  "./assets/ocr/core/tesseract-core-lstm.wasm",
  "./assets/ocr/core/tesseract-core-simd-lstm.wasm",
  "./assets/ocr/lang-data/eng.traineddata.gz",
  "./assets/ocr/lang-data/spa.traineddata.gz",
  "./icons/icon-192.svg",
  "./icons/icon-512.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
