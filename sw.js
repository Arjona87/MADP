/* MADP_Bot · Service worker: funciona sin conexión después de la primera visita.
   construir_base.py actualiza VERSION y DOCUMENTOS en cada reconstrucción para que los dispositivos descarguen la base nueva. */
const VERSION = '202611241723';
const DOCUMENTOS = ["documentos/001_CDJ_Control_preventivo_provisional.pdf"];
const CASCARA = 'madp-cascara-' + VERSION;
const DATOS = 'madp-datos-' + VERSION;
const ESENCIALES = ['./', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest',
  'assets/fuentes.css', 'assets/logo-cges.png', 'assets/violeta-96.webp', 'assets/icono-192.png', 'assets/favicon.png',
  'data/docs.json', 'data/faq.json', 'data/version.json', 'data/indice.json', 'data/textos.json'];
// visor PDF (PDF.js): se guarda completo para abrir documentos sin internet
const VISOR = ['visor/web/viewer.html', 'visor/web/viewer.mjs', 'visor/web/viewer.css', 'visor/build/pdf.mjs', 'visor/build/pdf.worker.mjs',
  'visor/web/locale/locale.json', 'visor/web/locale/es-MX/viewer.ftl', 'visor/web/locale/en-US/viewer.ftl'];

self.addEventListener('install', e => {
  // cache: 'reload' obliga a descargar del servidor (no de la memoria del navegador): así nunca se mezclan datos viejos con la app nueva
  const fresco = u => new Request(u, { cache: 'reload' });
  e.waitUntil(caches.open(CASCARA).then(c => c.addAll(ESENCIALES.map(fresco)))
    .then(() => caches.open(DATOS)).then(async c => { for (const u of [...VISOR, ...DOCUMENTOS]) { try { await c.add(fresco(u)); } catch (err) {} } })
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CASCARA && k !== DATOS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.includes('/visor/') || url.pathname.includes('/documentos/')) {
    // visor y documentos: primero caché (sin importar #página o ?file=); si no está, red y se guarda
    e.respondWith(caches.open(DATOS).then(async c => (await c.match(e.request, { ignoreSearch: true })) ||
      fetch(e.request).then(r => { if (r.ok && r.status === 200) c.put(e.request, r.clone()); return r; })));
    return;
  }
  if (url.pathname.includes('/data/')) {
    e.respondWith(caches.open(CASCARA).then(async c => (await c.match(e.request, { ignoreSearch: true })) ||
      fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; })));
    return;
  }
  // cáscara (html, css, js, imágenes): caché primero y actualización en segundo plano
  e.respondWith(caches.open(CASCARA).then(async c => {
    const enCache = await c.match(e.request, { ignoreSearch: true });
    const red = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => enCache);
    return enCache || red;
  }));
});
