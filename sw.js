/* 오프라인 캐시: 앱 파일을 저장해 지하철 등 오프라인에서도 실행.
 * 파일 수정 후 배포할 때 VERSION 숫자를 올리면 새 버전으로 교체됨. */
const VERSION = 'biztalk-v9';
const AUDIO_CACHE = 'biztalk-audio-v1'; // 음성 파일은 이름이 내용 해시라 버전과 무관하게 유지
const FILES = ['./', 'index.html', 'css/style.css', 'js/data.js', 'js/fr-data.js', 'js/daily-data.js', 'js/audio-manifest.js', 'audio/silence.mp3', 'js/core.js', 'js/app.js',
  'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION && k !== AUDIO_CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// 네트워크 우선(수정사항 즉시 반영) → 오프라인이면 캐시 사용
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  if (new URL(e.request.url).pathname.includes('/audio/')) { // 음성: 캐시 우선
    e.respondWith(caches.open(AUDIO_CACHE).then(async (c) => {
      const hit = await c.match(e.request.url);
      if (hit) return hit;
      const r = await fetch(e.request.url);
      if (r.ok && r.status === 200) c.put(e.request.url, r.clone());
      return r;
    }));
    return;
  }
  e.respondWith(caches.open(VERSION).then(async (c) => {
    try {
      const r = await fetch(e.request, { cache: 'no-cache' });
      if (r.ok) c.put(e.request, r.clone());
      return r;
    } catch (err) {
      return (await c.match(e.request, { ignoreSearch: true })) || Response.error();
    }
  }));
});
