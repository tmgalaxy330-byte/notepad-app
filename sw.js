/* 下書きメモ帳 Service Worker(オフライン動作と更新通知)
 * 新しい版を公開するときは、必ず CACHE_VERSION を変更すること。
 * 変更しないと、利用者の端末に更新が届かない。
 */
const CACHE_VERSION = 'draft-2026-11-19-2';
const CACHE = 'notepad-' + CACHE_VERSION;
const ASSETS = [
  './',
  './index.html',
  './manual.html',
  './spec.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', event => {
  // 自動では切り替えない(画面側の「今すぐ更新」で切り替える)
  // ブラウザの通常キャッシュ(GitHub Pages は最大10分)を通さず、必ず最新のファイルを取りに行く。
  // 通すと、更新直後に古い index.html が新しい版としてキャッシュされることがある。
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('notepad-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // 画面の読み込み:キャッシュにあればそれを返す。なければネットから取得し、
    // オフラインで取得できないときだけアプリ本体(index.html)を返す
    if (req.mode === 'navigate') {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      try { return await fetch(req); }
      catch (e) {
        const app = await cache.match('./index.html');
        if (app) return app;
        throw e;
      }
    }
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      return res;
    } catch (e) {
      return new Response('', { status: 504, statusText: 'Offline' });
    }
  })());
});
