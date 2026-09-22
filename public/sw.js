// Minimal service worker: enables PWA installability. Network-first —
// this is a live tool; stale board data would be worse than no cache.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // pass through — no offline caching by design (FR: availability §11)
});
