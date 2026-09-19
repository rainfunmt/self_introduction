---
paths:
  - "frontend/**/*.{html,css,js}"
---

# 前端規範（frontend/）

技術棧：Tailwind CSS v4（CDN）、GSAP + ScrollTrigger（CDN）、原生 JavaScript（fetch API）。**不使用任何前端框架**，也不使用打包工具。

## 1. HTML 結構

### 語義化標籤

| 標籤 | 用途 |
| --- | --- |
| `<header>` | 頁首／區塊標題 |
| `<nav>` | 導覽列 |
| `<main>` | 頁面主要內容，每頁只有一個 |
| `<section>` | 有標題的主題區塊 |
| `<article>` | 可獨立存在的內容（專案卡片、經歷條目） |
| `<aside>` | 側邊補充資訊 |
| `<footer>` | 頁尾 |

`<div>` 只作為純版面容器。

### CDN 引入（已驗證的最新穩定版）

Tailwind CSS 使用 **v4**（`@tailwindcss/browser`），**不要**使用 v3 的 `cdn.tailwindcss.com` 與 `tailwind.config = {...}` 寫法：

```html
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.3.3"></script>
```

GSAP 與 ScrollTrigger（**僅前台頁面**）：

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.15.0/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.15.0/ScrollTrigger.min.js"></script>
```

**後台頁面（`frontend/admin/`）不得引入 GSAP。**

### 頁面骨架

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>頁面標題</title>
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.3.3"></script>
  <!-- 主題色與共用元件樣式（每個頁面內容必須一致，見第 2 節） -->
  <style type="text/tailwindcss">...</style>
</head>
<body class="bg-espresso text-powder-white">
  ...
  <!-- 前台頁面才引入 GSAP -->
  <script type="module" src="./js/main.js"></script>
</body>
</html>
```

- JS 使用 ES Module（`type="module"`）。ES Module 無法以 `file://` 開啟，前端需用本機靜態伺服器（例如 `python -m http.server 5500`，於 `frontend/` 目錄執行）。

## 2. CSS 樣式

- **優先使用 Tailwind utility classes**，不建立獨立 `.css` 檔。
- 只有「同一組 utility 重複出現 3 次以上」才抽成自訂 class，寫在 `<style type="text/tailwindcss">` 的 `@layer components` 內，用 `@apply` 組合。
- 自訂 class 命名：**英文小寫 + 連字號（kebab-case）**，依用途命名（`glass-card`、`btn-primary`、`section-title`），不用 `box1`、`div2` 之類。

### 配色：咖啡煙燻粉主題

| 面向 | 設計 | 色票（token） |
| --- | --- | --- |
| 主背景 | 深沉濃郁的咖啡深棕（Espresso） | `espresso` `#1a110d` |
| 區塊底色 | 煙燻烘焙棕，搭配柔和微漸層 | `roast` `#2a1c17`、`roast-light` `#3a2820` |
| 主要強調 | 煙燻粉（Dusty Rose / Mauve）：主要按鈕、強調標籤、柔和光暈 | `rose-smoke` `#c48b9f` |
| 次要強調 | 暖米金（細節層次） | `champagne` `#d8b98e` |
| 次要強調（替代） | 柔灰粉 | `ash-rose` `#b9a3a6` |
| 主要文字 | 粉白（Powder White），溫暖柔和 | `powder-white` `#f8eeea` |
| 次要文字 | 霧粉灰 | `mist-rose` `#c9b5b3` |

**卡片與容器**：彩繪玻璃質感——半透明多層疊加 + `backdrop-blur`，煙燻粉微光半透明填充 + 纖細描邊。

**對比度**：煙燻粉背景上的文字（主要按鈕）用 `text-espresso`，不要用粉白（對比不足）。

每個頁面 `<head>` 內放入以下相同的主題區塊（沒有建置流程，因此各頁複製，修改時需同步所有頁面）。**共用區塊本身不可改動**；只有單一頁面用到的元件（例如名片頁的 `.skill-tag`）可以附加在同一個 `<style>` 的 `@layer components` 末尾，並用註解標明「頁面專用」：

```html
<style type="text/tailwindcss">
  @theme {
    --color-espresso: #1a110d;
    --color-roast: #2a1c17;
    --color-roast-light: #3a2820;
    --color-rose-smoke: #c48b9f;
    --color-champagne: #d8b98e;
    --color-ash-rose: #b9a3a6;
    --color-powder-white: #f8eeea;
    --color-mist-rose: #c9b5b3;
  }

  @layer components {
    /* 彩繪玻璃卡片：半透明疊層 + 模糊 + 煙燻粉描邊 */
    .glass-card {
      @apply rounded-2xl border border-rose-smoke/30 bg-linear-to-br from-rose-smoke/15 to-powder-white/5 shadow-xl shadow-black/30 backdrop-blur-xl;
    }
    /* 主要按鈕：煙燻粉底 + 深棕字 */
    .btn-primary {
      @apply rounded-lg bg-rose-smoke px-5 py-2 font-medium text-espresso transition-colors duration-200 hover:bg-rose-smoke/85 disabled:cursor-not-allowed disabled:opacity-50;
    }
    /* 次要按鈕：透明底 + 煙燻粉描邊 */
    .btn-secondary {
      @apply rounded-lg border border-rose-smoke/50 px-5 py-2 font-medium text-rose-smoke transition-colors duration-200 hover:bg-rose-smoke/10 disabled:cursor-not-allowed disabled:opacity-50;
    }
    /* 導覽連結：目前頁面（aria-current="page"）高亮 */
    .nav-link {
      @apply text-sm font-medium text-mist-rose transition-colors duration-200 hover:text-rose-smoke aria-[current=page]:text-rose-smoke;
    }
  }
</style>
```

**語意狀態色**（錯誤紅、成功綠）例外：僅用於提示訊息、錯誤欄位、刪除按鈕，使用 Tailwind 內建的 `red-300` / `emerald-300`，不作為主視覺色。

## 3. JavaScript

### API base URL 用變數管理

後端跑在 `localhost:8000`。base URL 只能定義在 `frontend/js/config.js` 一處，不可在其他檔案寫死：

```javascript
// API 基底網址（後端 FastAPI 服務）
export const API_BASE_URL = 'http://localhost:8000/api';

// 後端網站根網址：大頭貼等上傳檔案由後端提供，路徑（例如 /uploads/avatars/x.png）要接在這後面
export const API_ORIGIN = new URL(API_BASE_URL).origin;

// localStorage 中儲存登入 token 的 key
export const TOKEN_KEY = 'portfolio_token';

// 後台登入頁（以 frontend/ 為網站根目錄）
export const LOGIN_PAGE = '/admin/login.html';
```

### 統一用 fetch() 呼叫後端

所有請求透過 `frontend/js/api.js` 的共用函式發出，頁面程式不直接呼叫 `fetch`。後台頁面則一律使用 `frontend/js/auth.js` 的 `authFetch`（見「認證 token」）。

```javascript
import { API_BASE_URL, API_ORIGIN, LOGIN_PAGE, TOKEN_KEY } from './config.js';

// 呼叫到後端不存在的功能時顯示的訊息（最常見原因：舊的後端視窗還開著，跑的是舊版程式）
const OUTDATED_BACKEND_MESSAGE = '伺服器沒有這個功能，後端很可能還是舊版：請關閉所有舊的「Backend API」視窗，再重新執行 start-dev.bat。';

/**
 * 把後端回傳的相對路徑（例如 /uploads/avatars/x.png、/api/projects/1/file）轉成完整網址
 * 沒有路徑（空字串）時回傳空字串
 */
export function buildAssetUrl(path) {
  return path ? `${API_ORIGIN}${path}` : '';
}

/**
 * 呼叫後端 API 並回傳 data 欄位
 * 後端統一格式：{ success, data, message }
 * @param {string} path - 相對於 API_BASE_URL 的路徑，例如 '/projects'
 * @param {object} options
 * @param {boolean} options.redirectOn401 - 收到 401 時是否清除 token 並導回登入頁（登入請求要設為 false）
 * @throws {Error} 請求失敗時，message 為可直接顯示給使用者的訊息
 */
export async function apiRequest(path, { method = 'GET', body, redirectOn401 = true } = {}) {
  // FormData（檔案上傳）由瀏覽器自己帶 multipart 的 Content-Type（含邊界字串），不能手動指定
  const isFormData = body instanceof FormData;
  const headers = isFormData ? {} : { 'Content-Type': 'application/json' };

  // 有 token 就帶上 Authorization header
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
    });
  } catch {
    // 網路中斷、後端未啟動
    throw new Error('無法連線到伺服器，請稍後再試');
  }

  // 204 無回傳內容
  if (response.status === 204) return null;

  const result = await response.json().catch(() => null);

  // 401：token 失效，清除並導回登入頁
  // 登入請求本身回 401 代表「帳號或密碼錯誤」，要顯示訊息而不是導頁，所以呼叫時傳 redirectOn401: false
  if (response.status === 401 && redirectOn401) {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = LOGIN_PAGE;
    throw new Error('登入已失效，請重新登入');
  }

  if (!response.ok || !result?.success) {
    // 路由不存在（FastAPI 預設訊息為 Not Found / Method Not Allowed，我們自己的 404 都是中文訊息）：
    // 通常是後端還在跑舊版程式，沒有這個功能
    const isMissingRoute = (response.status === 404 && result?.message === 'Not Found')
      || (response.status === 405 && result?.message === 'Method Not Allowed');
    if (isMissingRoute) throw new Error(OUTDATED_BACKEND_MESSAGE);
    throw new Error(result?.message ?? '發生未知錯誤');
  }
  return result.data;
}
```

### 檔案上傳與外部連結

- 上傳一律用 `FormData` 搭配 `apiRequest` / `authFetch`：`const body = new FormData(); body.append('file', file);`，**不要**自己設定 `Content-Type`。
- 上傳前先在前端檢查副檔名與大小（規則需與 `backend/upload_utils.py` 一致），後端仍會再驗證一次。
- 後端回傳的檔案路徑（`avatar_url`、`file_url`）是相對路徑，用 `buildAssetUrl()` 轉成完整網址；空字串代表沒有檔案。
- 顯示使用者或 API 提供的連結前，必須確認是 `http:` / `https:`（`new URL(text).protocol`），避免 `javascript:` 網址；外部連結一律加 `target="_blank" rel="noopener noreferrer"`。
- 每個上傳的 `<img>` 要有有意義的 `alt`。

### 偵測舊版後端（避免資料悄悄遺失）

後端更新後，如果舊的程序還佔著連接埠，新功能會「消失」：舊版 Pydantic 會**忽略不認識的欄位**，請求回 200 但新欄位根本沒存。所以新增欄位／功能時：

- `apiRequest` 已把「路由不存在」（404 `Not Found`、405 `Method Not Allowed`）轉成明確的「後端可能是舊版」訊息。
- 儲存含新欄位的資料後，要比對回應中的新欄位（欄位不存在，或值與送出的不同），不符就提示使用者，不要顯示「儲存成功」。

### 錯誤處理

- 呼叫端一律用 `try / catch`，把 `error.message` 顯示在畫面上（頁面內的提示區塊），**不使用 `alert()`**。
- 載入失敗時畫面要有替代內容（空狀態／重試按鈕），不可整頁空白。
- 不要吞掉錯誤：`catch` 內至少要顯示訊息或 `console.error`。

### 認證 token

- 登入成功後：`setToken(data.access_token)`。登入請求要用 `apiRequest('/auth/login', { method: 'POST', body, redirectOn401: false })`。
- 每次請求：`Authorization: Bearer <token>`（已在 `apiRequest` 統一處理）。
- 登出：`logout()`（清除 token 並導向登入頁）。
- 前端檢查只是使用者體驗，**權限一律以後端驗證為準**。

token 讀寫、登入檢查、`authFetch` 統一放在 `frontend/js/auth.js`，頁面不直接操作 `localStorage`：

```javascript
import { LOGIN_PAGE, TOKEN_KEY } from './config.js';
import { apiRequest } from './api.js';

// 取得目前儲存的 token（沒有則回傳 null）
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

// 登入成功後儲存 token
export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

// 是否已登入（僅檢查 token 存在；是否有效由後端驗證）
export function isLoggedIn() {
  return Boolean(getToken());
}

// 登出：清除 token 並導向登入頁
export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  window.location.replace(LOGIN_PAGE);
}

// 頁面載入時呼叫：未登入就導向登入頁，回傳是否已登入
export function requireAuth() {
  if (isLoggedIn()) return true;
  window.location.replace(LOGIN_PAGE);
  return false;
}

/**
 * 需要登入的 API 呼叫（後台專用），行為與 apiRequest 相同並回傳 data
 * 沒有 token 時直接導向登入頁，不會送出請求
 */
export async function authFetch(path, options = {}) {
  if (!requireAuth()) throw new Error('請先登入');
  return apiRequest(path, options);
}
```

## 4. 前台 vs 後台

| | 前台（`frontend/` 根目錄與 `pages/`） | 後台（`frontend/admin/`） |
| --- | --- | --- |
| 目標 | 精美視覺、品牌質感 | 功能性、資料操作效率 |
| 動畫 | GSAP + ScrollTrigger，進場／捲動動畫 | **不使用花俏動畫**，不引入 GSAP |
| 版面 | **RWD 必備**，mobile-first（`sm:` `md:` `lg:`） | 桌面優先，基本可用即可 |
| 登入 | 不需要 | **每頁載入時檢查登入狀態** |

### 前台動畫

- 先 `gsap.registerPlugin(ScrollTrigger)`。
- 尊重使用者「減少動態效果」設定：

```javascript
gsap.registerPlugin(ScrollTrigger);

// 只有使用者未開啟「減少動態效果」時才播放動畫
gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
  // 區塊捲動進場：由下往上淡入
  gsap.from('.project-card', {
    y: 40,
    opacity: 0,
    duration: 0.8,
    stagger: 0.15,
    scrollTrigger: { trigger: '.project-section', start: 'top 80%' },
  });
});
```

### 後台登入檢查

除了 `login.html`，每個後台頁面在 JS 開頭先檢查登入狀態，沒有就導向登入頁：

```javascript
import { requireAuth } from '/js/auth.js';

// 未登入就導向登入頁，不執行頁面程式
if (requireAuth()) {
  initPage();
}
```

後台頁面的 import 一律用以 `frontend/` 為根的絕對路徑（`/js/auth.js`），避免相對路徑層數出錯。
