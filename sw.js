/* Service worker d'EchoLearn — l'application s'ouvre même sans réseau.
   VERSION et FILES sont régénérés par tools/build.js : ne pas modifier à la main. */
const VERSION = '7db067f35b';
const FILES = ["./","assets/apple-touch-icon.png","assets/icon-192.png","assets/icon-512.png","assets/icon-maskable-512.png","assets/logo.png","css/app.css","index.html","js/app.js","js/auth.js","js/charts.js","js/config.js","js/data.js","js/formateur.js","js/home.js","js/mask.js","js/media.js","js/modalities.js","js/module.js","js/portfolio.js","js/settings.js","js/store.js","js/tutorial.js","js/ui.js","js/unlock.js","js/util.js","js/vendor/qrcode.js","manifest.webmanifest"];

const CACHE = 'echolearn-' + VERSION;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(FILES.map(f => c.add(f).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('echolearn-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}
async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  const net = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; });
  net.catch(() => {});
  try {
    return await Promise.race([net, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3500))]);
  } catch (e) {
    const hit = (await cache.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' && (await cache.match('index.html') || await cache.match('./')));
    if (hit) return hit;
    return net;
  }
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // le serveur Apps Script n'est jamais mis en cache
  e.respondWith(/\/assets\//.test(url.pathname) ? cacheFirst(req) : networkFirst(req));
});
