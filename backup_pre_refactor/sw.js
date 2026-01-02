// 每次修改程式碼或圖示後，請務必修改這裡的版本號 (例如 v4 -> v5)
// 這樣手機才會重新下載新的檔案，否則會一直使用舊的快取
const CACHE_NAME = 'speed-camera-v4'; 

// 這裡列出的檔案，都會被存到手機裡，沒網路也能開
const ASSETS_TO_CACHE = [
  './',                 // 根目錄
  './index.html',       // 主頁面
  './cameras.json',     // 資料庫
  './manifest.json',    // 安裝設定
  './penguin.png',      // ★ 您的新圖示
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', // 地圖樣式
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',  // 地圖程式
  'https://cdn.tailwindcss.com'                         // 排版工具
];

// 1. 安裝事件：把檔案快取起來
self.addEventListener('install', (event) => {
  console.log('[Service Worker] 安裝中...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] 正在快取檔案');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
  // 強制立即接管頁面，不用等下次重新整理
  self.skipWaiting();
});

// 2. 啟用事件：清除舊版本的快取 (例如刪除 v3，只留 v4)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] 清除舊快取:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // 讓新的 Service Worker 立即控制所有頁面
  return self.clients.claim();
});

// 3. 讀取事件：優先用快取，沒有才去網路抓
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // 如果快取有，就直接回傳快取 (速度快、離線可用)
        if (response) {
            return response;
        }
        // 如果快取沒有，就去網路抓
        return fetch(event.request);
      })
  );
});