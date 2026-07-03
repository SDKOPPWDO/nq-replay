// ============================================================
// NQ 複盤 App - Service Worker
// 負責把 data.bin（K棒歷史資料）快取在裝置本機，避免每次打開App都要重新下載一次
// ============================================================

const DATA_CACHE_NAME = 'nq-data-cache-v1';
const DATA_URL = 'https://raw.githubusercontent.com/sdkoppwdo/nq-replay/main/data.bin';

self.addEventListener('install', (e) => {
  self.skipWaiting(); // 安裝後立刻生效，不用等使用者關掉所有分頁
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  if (e.request.url === DATA_URL && e.request.method === 'GET') {
    e.respondWith(handleDataFetch(e.request));
  }
  // 其他請求（version.json、頁面本身等）一律不攔截，走瀏覽器預設行為
});

async function handleDataFetch(request) {
  const cache = await caches.open(DATA_CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    // 快取優先：有本機快取直接回傳，不打網路，這是平板能瞬間開啟的關鍵
    return cached;
  }
  try {
    const resp = await fetch(request);
    if (resp && resp.ok) {
      cache.put(request, resp.clone());
    }
    return resp;
  } catch (err) {
    // 網路失敗又沒有快取，只能回傳錯誤讓頁面自己處理（顯示「請檢查網路連線」）
    throw err;
  }
}

// 主頁面可以送訊息過來，要求「強制重新抓一次最新資料、更新快取」
self.addEventListener('message', (e) => {
  if (e.data === 'REFRESH_DATA') {
    e.waitUntil(doRefresh());
  }
});

async function doRefresh() {
  try {
    const resp = await fetch(DATA_URL, { cache: 'no-store' });
    if (resp && resp.ok) {
      const cache = await caches.open(DATA_CACHE_NAME);
      await cache.put(DATA_URL, resp.clone());
    }
  } catch (err) {
    console.error('[SW] 重新抓取資料失敗', err);
  } finally {
    const clientsList = await self.clients.matchAll();
    clientsList.forEach((c) => c.postMessage('DATA_REFRESHED'));
  }
}
