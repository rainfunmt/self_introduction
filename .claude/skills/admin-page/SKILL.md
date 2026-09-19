---
name: admin-page
description: 當使用者要求建立後台管理頁面時使用此 Skill，例如「幫我建立一個 XX 後台管理頁面」「新增作品管理頁」「做留言管理後台」。依固定 SOP 在 frontend/admin/ 產生完整頁面：左側固定邊欄（w-64）+ 右側主內容區、登入狀態檢查（localStorage JWT，未登入跳轉 login.html）、資料表格 + Modal 表單 + 驗證、經 authFetch 串接後端、Toast 通知。後台不使用 GSAP，只有基本 CSS hover。前台頁面請改用 create-page Skill。
---

# 後台頁面產生器

依下列步驟，為使用者指定的資源在 `frontend/admin/` 產生一個完整的後台管理頁面。**每個步驟都要完成，最後一定要跑驗證。**

**後台鐵則**：不引入 GSAP／ScrollTrigger、不做進場或捲動動畫，只保留基本 CSS `hover` / `focus` 效果（`transition-colors duration-150`）。

## 步驟 0：準備

1. **釐清需求**：頁面名稱與檔名（kebab-case，例如 `projects.html`、`messages.html`）、對應的資源與欄位、需要哪些操作（新增／編輯／刪除）。
2. **先讀規範檔**（路徑限定規則只在「讀到符合的檔案」時才載入，新建檔案不保證觸發，所以要主動讀）：
   - `CLAUDE.md`
   - `.claude/rules/frontend.md`（配色、`apiRequest`、`auth.js`、後台登入檢查）
3. **確認後端 API 已存在**：Glob `backend/routers/*.py`，並讀取對應 router，確認路徑、欄位、哪些端點需要登入。**API 不存在時不要自己編造**：告知使用者，並建議先用 `api-crud` Skill 建立後端。
4. **盤點現況**：Glob `frontend/admin/*.html`、`frontend/admin/js/*.js`、`frontend/js/*.js`。
   - **已有後台頁面**：直接複製它的 `<head>` 主題區塊、側邊欄、Modal 骨架，維持所有頁面一致。
   - **還沒有**：用下面步驟的模板。
5. **共用檔案不存在就建立**（存在就不要動）：
   - `frontend/js/config.js`、`frontend/js/api.js`、`frontend/js/auth.js`：內容照 `frontend.md`「JavaScript」一節（`authFetch` 在 `auth.js`）。
   - `frontend/admin/js/admin-common.js`：見步驟 3。
   - `frontend/admin/login.html`、`frontend/admin/js/login.js`：所有頁面未登入時都會跳轉到這裡，**不存在就一併建立**（見步驟 2）。
6. **檔案清單**（`<page>` 為頁面檔名，`<resource>` 為資源名）：
   - `frontend/admin/<page>.html`
   - `frontend/admin/js/<page>.js`（頁面進入點，ES Module）

**斷點定義**：手機 `< 768px`（預設，不加前綴）、桌面 `md:`（≥ 768px，側邊欄固定顯示）。

## 步驟 1：HTML 骨架（不引入 GSAP）

`frontend/admin/<page>.html` 的骨架要包含：

- `<!DOCTYPE html>`、`<html lang="zh-TW">`、`<meta charset="UTF-8">`、`viewport`、`<title>頁面名 | 管理後台</title>`
- Tailwind CSS v4 CDN（`@tailwindcss/browser@4.3.3`）
- 主題色 `<style type="text/tailwindcss">`：**共用主題區塊（`frontend.md` 第 2 節）+ 後台專用元件，寫在同一個 `<style>` 內**（分成兩個 `<style>` 時 `@apply` 可能讀不到主題色）
- `<body class="invisible ...">`：先隱藏，登入檢查通過後才由 `initAdminLayout()` 顯示，避免未登入者看到後台畫面一閃而過
- **不引入任何 GSAP / ScrollTrigger `<script>`**
- 頁面進入點 `<script type="module" src="./js/<page>.js">` 放 `</body>` 前
- 不建立獨立 `.css` 檔

以下模板以「作品管理」`projects.html` 為例，已包含步驟 3（版面）與步驟 4（表格、Modal、表單）。其他資源請改欄位、文字與 `id`。

`frontend/admin/projects.html`：

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>作品管理 | 管理後台</title>

  <!-- Tailwind CSS v4（CDN）；後台不引入動畫套件 -->
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.3.3"></script>

  <!-- 主題色與元件樣式：共用區塊（同 frontend.md 第 2 節）+ 後台專用元件，需放在同一個 style 內 -->
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
      /* ===== 共用區塊（與 frontend.md 第 2 節一致） ===== */
      .glass-card {
        @apply rounded-2xl border border-rose-smoke/30 bg-linear-to-br from-rose-smoke/15 to-powder-white/5 shadow-xl shadow-black/30 backdrop-blur-xl;
      }
      .btn-primary {
        @apply rounded-lg bg-rose-smoke px-5 py-2 font-medium text-espresso transition-colors duration-200 hover:bg-rose-smoke/85 disabled:cursor-not-allowed disabled:opacity-50;
      }
      .btn-secondary {
        @apply rounded-lg border border-rose-smoke/50 px-5 py-2 font-medium text-rose-smoke transition-colors duration-200 hover:bg-rose-smoke/10 disabled:cursor-not-allowed disabled:opacity-50;
      }
      .nav-link {
        @apply text-sm font-medium text-mist-rose transition-colors duration-200 hover:text-rose-smoke aria-[current=page]:text-rose-smoke;
      }

      /* ===== 後台專用元件 ===== */
      /* 側邊欄連結：hover 變亮；目前頁面（aria-current="page"）左側粉色細條 + 粉色淡底 + 粉色文字 */
      .sidebar-link {
        @apply flex w-full items-center rounded-lg border-l-2 border-transparent px-3 py-2 text-left text-sm text-mist-rose transition-colors duration-150 hover:bg-roast-light hover:text-powder-white aria-[current=page]:border-rose-smoke aria-[current=page]:bg-rose-smoke/15 aria-[current=page]:font-medium aria-[current=page]:text-rose-smoke;
      }
      /* 表單欄位 */
      .form-label {
        @apply mb-1 block text-sm font-medium text-mist-rose;
      }
      .form-input {
        @apply w-full rounded-lg border border-rose-smoke/30 bg-espresso/60 px-3 py-2 text-powder-white placeholder:text-mist-rose/50 focus:border-rose-smoke focus:outline-none focus:ring-1 focus:ring-rose-smoke aria-[invalid=true]:border-red-300;
      }
      .field-error {
        @apply mt-1 text-sm text-red-300;
      }
      /* 表格列操作按鈕 */
      .btn-small {
        @apply rounded-lg border border-rose-smoke/40 px-3 py-1.5 text-sm text-rose-smoke transition-colors duration-150 hover:bg-rose-smoke/10;
      }
      .btn-danger {
        @apply rounded-lg border border-red-300/40 px-3 py-1.5 text-sm text-red-300 transition-colors duration-150 hover:bg-red-300/10;
      }
    }
  </style>
</head>
<body class="invisible bg-espresso text-powder-white antialiased">

  <!-- 手機版頂部列：只在手機顯示，含開啟側邊欄的漢堡按鈕 -->
  <div class="mobile-topbar sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-rose-smoke/20 bg-roast px-4 md:hidden">
    <button id="sidebar-toggle" type="button" class="rounded-lg p-2 transition-colors duration-150 hover:bg-roast-light" aria-label="開啟選單" aria-expanded="false" aria-controls="sidebar">
      <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    </button>
    <span class="font-semibold text-rose-smoke">管理後台</span>
  </div>

  <!-- 左側固定邊欄：寬 w-64；手機預設隱藏，點漢堡按鈕以覆蓋方式顯示 -->
  <aside id="sidebar" class="admin-sidebar fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-rose-smoke/20 bg-roast md:flex" aria-label="後台側邊欄">
    <!-- 邊欄標題 -->
    <div class="sidebar-brand flex h-16 shrink-0 items-center border-b border-rose-smoke/20 px-6">
      <span class="text-lg font-semibold text-rose-smoke">管理後台</span>
    </div>

    <!-- 導覽項目：目前頁面由 JS 標記 aria-current="page" -->
    <nav class="sidebar-nav flex-1 space-y-1 overflow-y-auto p-4" aria-label="後台導覽">
      <a href="/admin/dashboard.html" class="sidebar-link">儀表板</a>
      <a href="/admin/projects.html" class="sidebar-link">作品管理</a>
      <a href="/admin/messages.html" class="sidebar-link">留言管理</a>
      <a href="/admin/profile.html" class="sidebar-link">個人資料</a>
    </nav>

    <!-- 邊欄底部：登出 -->
    <div class="sidebar-footer shrink-0 border-t border-rose-smoke/20 p-4">
      <button id="logout-button" type="button" class="sidebar-link">登出</button>
    </div>
  </aside>

  <!-- 右側主內容區：桌面版留出邊欄寬度 -->
  <main id="admin-main" class="admin-main min-h-screen md:ml-64">
    <div class="mx-auto max-w-6xl p-4 md:p-8">

      <!-- 頁面標題列：標題與新增按鈕 -->
      <header class="page-header mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-2xl font-semibold">作品管理</h1>
        <button id="create-button" type="button" class="btn-primary">新增作品</button>
      </header>

      <!-- 資料表格：外層可橫向捲動，避免手機版撐破頁面 -->
      <section class="table-panel glass-card overflow-hidden" aria-labelledby="table-title">
        <h2 id="table-title" class="sr-only">作品列表</h2>
        <div class="overflow-x-auto">
          <table class="data-table w-full min-w-[36rem] text-left text-sm">
            <thead class="bg-roast-light/60 text-mist-rose">
              <tr>
                <th scope="col" class="px-4 py-3 font-medium">ID</th>
                <th scope="col" class="px-4 py-3 font-medium">標題</th>
                <th scope="col" class="px-4 py-3 font-medium">建立時間</th>
                <th scope="col" class="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody id="project-table-body" class="divide-y divide-rose-smoke/10"></tbody>
          </table>
        </div>
      </section>
    </div>
  </main>

  <!-- 新增／編輯 Modal：使用原生 dialog，自帶焦點管理與 Esc 關閉 -->
  <dialog id="project-dialog" class="modal-dialog m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-rose-smoke/30 bg-roast p-0 text-powder-white shadow-2xl backdrop:bg-black/60" aria-labelledby="dialog-title">
    <form id="project-form" novalidate class="p-6">
      <h2 id="dialog-title" class="mb-4 text-lg font-semibold">新增作品</h2>
      <input type="hidden" name="id">

      <div class="mb-4">
        <label for="project-title" class="form-label">標題 <span class="text-rose-smoke">*</span></label>
        <input id="project-title" name="title" type="text" maxlength="100" class="form-input" placeholder="請輸入作品標題" autocomplete="off">
        <p class="field-error hidden" data-error-for="title"></p>
      </div>

      <div class="mb-4">
        <label for="project-description" class="form-label">描述</label>
        <textarea id="project-description" name="description" rows="4" maxlength="2000" class="form-input" placeholder="簡單介紹這個作品"></textarea>
        <p class="field-error hidden" data-error-for="description"></p>
      </div>

      <!-- 伺服器回傳的錯誤訊息 -->
      <p id="form-error" class="field-error mb-4 hidden" role="alert"></p>

      <div class="flex justify-end gap-3">
        <button id="cancel-button" type="button" class="btn-secondary">取消</button>
        <button id="submit-button" type="submit" class="btn-primary">儲存</button>
      </div>
    </form>
  </dialog>

  <!-- 刪除確認 Modal：取代瀏覽器內建確認視窗；按鈕的 value 會成為 returnValue -->
  <dialog id="confirm-dialog" class="modal-dialog m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-rose-smoke/30 bg-roast p-0 text-powder-white shadow-2xl backdrop:bg-black/60" aria-labelledby="confirm-title">
    <form method="dialog" class="p-6">
      <h2 id="confirm-title" class="mb-2 text-lg font-semibold">請確認</h2>
      <p class="mb-6 text-sm text-mist-rose" data-confirm-message></p>
      <div class="flex justify-end gap-3">
        <button type="submit" value="cancel" class="btn-secondary">取消</button>
        <button type="submit" value="confirm" class="btn-primary">確定刪除</button>
      </div>
    </form>
  </dialog>

  <script type="module" src="./js/projects.js"></script>
</body>
</html>
```

## 步驟 2：登入狀態檢查邏輯

**每個後台頁面（除 `login.html`）進來的第一件事就是檢查登入狀態**：讀取 localStorage 的 JWT token，沒有就跳轉到 `login.html`。

- 檢查函式是 `frontend/js/auth.js` 的 `requireAuth()`（內部讀取 `localStorage` 的 `TOKEN_KEY`，沒有 token 就 `location.replace('/admin/login.html')`）。**頁面不直接操作 `localStorage`。**
- 頁面進入點的固定寫法：

```javascript
import { requireAuth } from '/js/auth.js';

// 未登入就導向登入頁，不執行頁面程式
if (requireAuth()) {
  initPage();
}
```

- `<body>` 先 `invisible`，`initAdminLayout()` 在檢查通過後移除，未登入者不會看到後台畫面。
- token 過期或無效：後端回 401，`api.js` 會清除 token 並導向登入頁（登入請求除外）。
- 前端檢查只是使用者體驗，**權限一律以後端驗證為準**。

登入頁（不存在時建立）：

`frontend/admin/login.html`：

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>登入 | 管理後台</title>
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.3.3"></script>
  <!-- （此處貼上與 projects.html 完全相同的 <style type="text/tailwindcss"> 區塊） -->
</head>
<body class="flex min-h-screen items-center justify-center bg-linear-to-b from-roast to-espresso px-4 text-powder-white antialiased">

  <!-- 登入卡片 -->
  <main class="login-card glass-card w-full max-w-sm p-8">
    <h1 class="mb-1 text-2xl font-semibold text-rose-smoke">管理後台</h1>
    <p class="mb-6 text-sm text-mist-rose">請登入以繼續</p>

    <!-- method="post"：萬一頁面程式沒載入，帳號密碼也不會被放進網址列 -->
    <form id="login-form" method="post" novalidate>
      <div class="mb-4">
        <label for="login-username" class="form-label">帳號</label>
        <input id="login-username" name="username" type="text" maxlength="50" autocomplete="username" class="form-input">
      </div>
      <div class="mb-4">
        <label for="login-password" class="form-label">密碼</label>
        <input id="login-password" name="password" type="password" maxlength="72" autocomplete="current-password" class="form-input">
      </div>

      <!-- 登入失敗訊息 -->
      <p id="login-error" class="field-error mb-4 hidden" role="alert"></p>

      <!-- 頁面程式（login.js）沒載入成功時才會顯示的提示 -->
      <p id="load-warning" class="field-error mb-4 hidden" role="alert">頁面程式沒有載入，所以無法登入。請確認：(1) 網址是 http://localhost:5500/admin/login.html；(2) 前端伺服器是在 frontend 資料夾內執行；(3) 不是直接雙擊 html 檔開啟。</p>

      <button id="login-submit" type="submit" class="btn-primary w-full">登入</button>
    </form>
  </main>

  <script>
    // 保護機制（一般 script，不依賴 login.js 是否載入成功）：
    // login.js 載入成功後會設定 window.loginPageReady = true。
    // 沒設定就代表頁面程式壞了，此時不讓瀏覽器做原生表單送出，改為顯示提示。
    const loginForm = document.getElementById('login-form');
    const loadWarning = document.getElementById('load-warning');
    loginForm.addEventListener('submit', (event) => {
      if (window.loginPageReady) return;
      event.preventDefault();
      loadWarning.classList.remove('hidden');
    });
    // 頁面載入完成（含 module script 執行完）後檢查一次，程式沒載入就直接提示
    window.addEventListener('load', () => {
      if (!window.loginPageReady) loadWarning.classList.remove('hidden');
    });
  </script>
  <script type="module" src="./js/login.js"></script>
</body>
</html>
```

`frontend/admin/js/login.js`：

```javascript
import { apiRequest } from '/js/api.js';
import { isLoggedIn, setToken } from '/js/auth.js';

// 告訴 login.html 的保護機制：頁面程式已成功載入（import 失敗時這行不會執行）
window.loginPageReady = true;

// 登入成功後的預設頁面
const DASHBOARD_PAGE = '/admin/dashboard.html';

const form = document.getElementById('login-form');
const errorText = document.getElementById('login-error');
const submitButton = document.getElementById('login-submit');

// 顯示登入錯誤訊息
function showError(message) {
  errorText.textContent = message;
  errorText.classList.remove('hidden');
}

// 已登入的人直接進後台
if (isLoggedIn()) {
  window.location.replace(DASHBOARD_PAGE);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorText.classList.add('hidden');

  const { username, password } = Object.fromEntries(new FormData(form));
  if (!username.trim() || !password) {
    showError('請輸入帳號與密碼');
    return;
  }

  submitButton.disabled = true;
  try {
    // redirectOn401: false → 帳號或密碼錯誤時顯示訊息，而不是被導回登入頁
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: { username: username.trim(), password },
      redirectOn401: false,
    });
    setToken(data.access_token);
    window.location.replace(DASHBOARD_PAGE);
  } catch (error) {
    showError(error.message);
  } finally {
    submitButton.disabled = false;
  }
});
```

## 步驟 3：後台版面配置

版面已在步驟 1 模板內。規格：

### 整體結構

| 區域 | 標籤與 class | 說明 |
| --- | --- | --- |
| 左側邊欄 | `<aside class="fixed inset-y-0 left-0 z-40 w-64 ... hidden md:flex">` | 固定在左側，寬 `w-64`（16rem） |
| 右側主內容 | `<main class="md:ml-64 min-h-screen">` | 桌面版用 `md:ml-64` 讓出邊欄寬度 |
| 內容容器 | `<div class="mx-auto max-w-6xl p-4 md:p-8">` | 限制最大寬度與內距 |
| 手機頂部列 | `<div class="md:hidden sticky top-0 ...">` | 只在手機顯示，放漢堡按鈕 |

### Sidebar 結構（由上而下）

1. **邊欄標題** `sidebar-brand`：高度 `h-16`，顯示「管理後台」，下方細分隔線。
2. **導覽區** `sidebar-nav`（`flex-1`，項目多時 `overflow-y-auto`）：依序為
   - 儀表板 → `/admin/dashboard.html`
   - 作品管理 → `/admin/projects.html`
   - 留言管理 → `/admin/messages.html`
   - 個人資料 → `/admin/profile.html`
3. **邊欄底部** `sidebar-footer`：**登出**按鈕（`<button>`，不是連結），點擊呼叫 `auth.js` 的 `logout()`。

### 高亮與互動樣式（統一由 `.sidebar-link` 提供）

| 狀態 | 樣式 |
| --- | --- |
| 一般 | 霧粉灰文字 `text-mist-rose`，左側 2px 透明邊框 |
| hover | 背景 `bg-roast-light`、文字變 `text-powder-white`，`transition-colors duration-150` |
| **目前頁面**（`aria-current="page"`） | 左側 2px 煙燻粉邊條 `border-rose-smoke` + 淡粉底 `bg-rose-smoke/15` + 粉色文字 `text-rose-smoke` + `font-medium` |

目前頁面由 `initAdminLayout()` 依網址比對後設定 `aria-current="page"`，**不要在 HTML 寫死高亮**，這樣所有頁面的邊欄可以完全相同。

### RWD

- 桌面（≥ 768px）：邊欄固定顯示，主內容 `md:ml-64`。
- 手機（< 768px）：邊欄隱藏；點頂部列漢堡按鈕以覆蓋方式顯示，點擊主內容區或按 Esc 收合。**不做滑動動畫**（後台不用動畫）。

建立 `frontend/admin/js/admin-common.js`（若已存在就不要動）：

`frontend/admin/js/admin-common.js`：

```javascript
import { logout } from '/js/auth.js';

/**
 * 初始化後台版面：側邊欄開關、目前頁面高亮、登出，最後顯示頁面
 * 必須在登入檢查通過後呼叫
 */
export function initAdminLayout() {
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebar-toggle');

  // 手機版側邊欄開關（桌面版由 md:flex 固定顯示，不受影響）
  function setSidebarOpen(isOpen) {
    sidebar.classList.toggle('hidden', !isOpen);
    sidebar.classList.toggle('flex', isOpen);
    sidebarToggle.setAttribute('aria-expanded', String(isOpen));
  }
  sidebarToggle.addEventListener('click', () => {
    setSidebarOpen(sidebarToggle.getAttribute('aria-expanded') !== 'true');
  });
  // 點擊主內容區或按下 Esc 時收合
  document.getElementById('admin-main').addEventListener('click', () => setSidebarOpen(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setSidebarOpen(false);
  });

  // 目前頁面高亮：比對檔名並標記 aria-current="page"
  const currentFile = window.location.pathname.split('/').pop();
  document.querySelectorAll('.sidebar-link[href]').forEach((link) => {
    if (new URL(link.href).pathname.split('/').pop() === currentFile) {
      link.setAttribute('aria-current', 'page');
    }
  });

  // 登出：清除 token 並回到登入頁
  document.getElementById('logout-button').addEventListener('click', logout);

  // 登入檢查已通過，顯示頁面
  document.body.classList.remove('invisible');
}

/**
 * 顯示 Toast 通知，3.5 秒後自動消失
 * @param {string} message - 通知文字
 * @param {'success'|'error'} type - 成功（綠）或失敗（紅）
 */
export function showToast(message, type = 'success') {
  // 第一次呼叫時建立容器
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed right-4 top-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const colorClass = type === 'error'
    ? 'border-red-300/50 text-red-300'
    : 'border-emerald-300/50 text-emerald-300';
  toast.className = `toast-message rounded-lg border bg-roast px-4 py-3 text-sm shadow-lg shadow-black/40 ${colorClass}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

/**
 * 開啟確認對話框，回傳使用者是否按下「確定」
 * @param {string} message - 要顯示的確認訊息
 * @returns {Promise<boolean>}
 */
export function confirmAction(message) {
  const dialog = document.getElementById('confirm-dialog');
  dialog.querySelector('[data-confirm-message]').textContent = message;
  // 先清空上次的結果，避免按 Esc 關閉時沿用舊值
  dialog.returnValue = '';
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true });
    dialog.showModal();
  });
}

// 清除表單內所有欄位錯誤
export function clearFieldErrors(form) {
  form.querySelectorAll('[data-error-for]').forEach((element) => {
    element.textContent = '';
    element.classList.add('hidden');
  });
  form.querySelectorAll('[aria-invalid]').forEach((input) => input.removeAttribute('aria-invalid'));
}

// 在指定欄位下方顯示錯誤訊息
export function setFieldError(form, fieldName, message) {
  const errorElement = form.querySelector(`[data-error-for="${fieldName}"]`);
  errorElement.textContent = message;
  errorElement.classList.remove('hidden');
  form.querySelector(`[name="${fieldName}"]`).setAttribute('aria-invalid', 'true');
}

// 把後端的 UTC 時間字串（例如 2026-09-19 12:24:32）轉成本地時間顯示
export function formatDateTime(utcText) {
  const date = new Date(`${utcText.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? utcText : date.toLocaleString('zh-TW', { hour12: false });
}
```

## 步驟 4：資料表格與表單（CRUD、Modal、驗證）

表格、新增／編輯 Modal、刪除確認 Modal 已在步驟 1 模板內。規格：

### 表格

- 外層 `overflow-x-auto` + 表格 `min-w-[36rem]`：手機上表格自己橫向捲動，**不能讓整個頁面出現橫向捲軸**。
- `<thead>` 用 `<th scope="col">`，`<tbody>` 由 JS 依資料產生；操作欄靠右。
- 三種狀態都要處理：**載入中**、**無資料**（顯示引導文字）、**載入失敗**（顯示錯誤文字）。
- 列 hover：`hover:bg-roast-light/40` + `transition-colors duration-150`。

### CRUD 操作按鈕

| 操作 | 位置 | 行為 |
| --- | --- | --- |
| 新增 | 頁面標題列右側 `btn-primary` | 開啟空白 Modal |
| 編輯 | 每列 `btn-small` | 開啟已填入該筆資料的 Modal |
| 刪除 | 每列 `btn-danger` | 先開確認 Modal，確認後才呼叫 API |

資源沒有某個操作時（例如留言只能看與刪除），就不要放對應按鈕與 Modal。

### Modal 彈窗

- 使用原生 `<dialog>`：`showModal()` 開啟、`close()` 關閉，自帶焦點管理、Esc 關閉與 `::backdrop`。**不要用 `alert()` / `confirm()`。**
- 必須加 `m-auto`（Tailwind 預設樣式會清掉 dialog 的置中邊距）。
- 新增與編輯共用同一個 Modal，用隱藏欄位 `name="id"` 區分（有值 = 編輯）；標題文字隨之切換。

### 表單驗證

- 前端驗證要與後端 Pydantic 限制一致（例如 `title` 1–100 字、`description` ≤ 2000 字）。
- 表單加 `novalidate`，改用自己的驗證，錯誤顯示在欄位下方（`data-error-for`），並設定 `aria-invalid="true"`；驗證失敗時把焦點移到第一個錯誤欄位。
- 送出時把送出按鈕設為 `disabled`，避免重複送出，`finally` 中還原。

## 步驟 5：後端 API 串接

`frontend/admin/js/projects.js`：

```javascript
import { authFetch, requireAuth } from '/js/auth.js';
import {
  clearFieldErrors,
  confirmAction,
  formatDateTime,
  initAdminLayout,
  setFieldError,
  showToast,
} from './admin-common.js';

// 對應後端 /api/projects（API_BASE_URL 已含 /api）
const RESOURCE_PATH = '/projects';

const tableBody = document.getElementById('project-table-body');
const dialog = document.getElementById('project-dialog');
const dialogTitle = document.getElementById('dialog-title');
const form = document.getElementById('project-form');
const formError = document.getElementById('form-error');
const submitButton = document.getElementById('submit-button');

// 目前載入的資料；編輯與刪除時用 id 找回整筆資料
let projects = [];

// 在表格顯示單列訊息（載入中、無資料、載入失敗）
function renderMessageRow(message) {
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = 4;
  cell.className = 'px-4 py-8 text-center text-mist-rose';
  cell.textContent = message;
  row.appendChild(cell);
  tableBody.replaceChildren(row);
}

// 建立文字儲存格；一律用 textContent，避免 API 資料造成 XSS
function createTextCell(text, className = 'px-4 py-3') {
  const cell = document.createElement('td');
  cell.className = className;
  cell.textContent = text;
  return cell;
}

// 建立列操作按鈕，用 data-action 與 data-id 交給事件代理處理
function createActionButton(label, action, id, className) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.dataset.action = action;
  button.dataset.id = String(id);
  return button;
}

// 依 projects 陣列渲染表格
function renderProjects() {
  if (projects.length === 0) {
    renderMessageRow('目前沒有作品，點擊右上角「新增作品」建立第一筆');
    return;
  }

  const rows = projects.map((project) => {
    const row = document.createElement('tr');
    row.className = 'transition-colors duration-150 hover:bg-roast-light/40';

    const actionCell = document.createElement('td');
    actionCell.className = 'px-4 py-3';
    const actionGroup = document.createElement('div');
    actionGroup.className = 'flex justify-end gap-2';
    actionGroup.append(
      createActionButton('編輯', 'edit', project.id, 'btn-small'),
      createActionButton('刪除', 'delete', project.id, 'btn-danger'),
    );
    actionCell.appendChild(actionGroup);

    row.append(
      createTextCell(project.id),
      createTextCell(project.title, 'px-4 py-3 font-medium'),
      createTextCell(formatDateTime(project.created_at)),
      actionCell,
    );
    return row;
  });
  tableBody.replaceChildren(...rows);
}

// 從後端載入列表並渲染；新增、更新、刪除成功後都呼叫它來刷新列表
async function loadProjects() {
  renderMessageRow('載入中…');
  try {
    projects = await authFetch(RESOURCE_PATH);
    renderProjects();
  } catch (error) {
    renderMessageRow(`載入失敗：${error.message}`);
    showToast(error.message, 'error');
  }
}

// 顯示或隱藏表單層級的錯誤（伺服器回傳的訊息）
function showFormError(message) {
  formError.textContent = message;
  formError.classList.toggle('hidden', !message);
}

// 開啟新增（不傳參數）或編輯（傳入資料）Modal
function openDialog(project = null) {
  form.reset();
  clearFieldErrors(form);
  showFormError('');
  form.querySelector('[name="id"]').value = project ? project.id : '';
  form.querySelector('[name="title"]').value = project ? project.title : '';
  form.querySelector('[name="description"]').value = project ? project.description : '';
  dialogTitle.textContent = project ? '編輯作品' : '新增作品';
  dialog.showModal();
}

// 前端驗證，規則與後端 Pydantic 一致；回傳 { 欄位名: 錯誤訊息 }
function validate({ title, description }) {
  const errors = {};
  if (!title) errors.title = '請輸入標題';
  else if (title.length > 100) errors.title = '標題最多 100 字';
  if (description.length > 2000) errors.description = '描述最多 2000 字';
  return errors;
}

// 送出表單：有 id 走更新（PUT），沒有走新增（POST）
async function handleSubmit(event) {
  event.preventDefault();
  clearFieldErrors(form);
  showFormError('');

  const formData = Object.fromEntries(new FormData(form));
  const payload = {
    title: formData.title.trim(),
    description: formData.description.trim(),
  };

  const errors = validate(payload);
  const errorFields = Object.keys(errors);
  if (errorFields.length > 0) {
    errorFields.forEach((name) => setFieldError(form, name, errors[name]));
    form.querySelector(`[name="${errorFields[0]}"]`).focus();
    return;
  }

  const isEdit = Boolean(formData.id);
  submitButton.disabled = true;
  try {
    await authFetch(isEdit ? `${RESOURCE_PATH}/${formData.id}` : RESOURCE_PATH, {
      method: isEdit ? 'PUT' : 'POST',
      body: payload,
    });
    dialog.close();
    showToast(isEdit ? '更新成功' : '新增成功');
    await loadProjects();
  } catch (error) {
    // Modal 開啟時 Toast 會被遮罩蓋住，所以同時在表單內顯示錯誤
    showFormError(error.message);
    showToast(error.message, 'error');
  } finally {
    submitButton.disabled = false;
  }
}

// 確認後刪除，成功就刷新列表
async function deleteProject(project) {
  const confirmed = await confirmAction(`確定要刪除「${project.title}」嗎？此操作無法復原。`);
  if (!confirmed) return;

  try {
    await authFetch(`${RESOURCE_PATH}/${project.id}`, { method: 'DELETE' });
    showToast('刪除成功');
    await loadProjects();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// 事件代理：處理表格內的編輯與刪除按鈕
tableBody.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const project = projects.find((item) => item.id === Number(button.dataset.id));
  if (!project) return;

  if (button.dataset.action === 'edit') openDialog(project);
  if (button.dataset.action === 'delete') deleteProject(project);
});

form.addEventListener('submit', handleSubmit);

// 頁面初始化：綁定按鈕並載入資料
function initProjectPage() {
  initAdminLayout();
  document.getElementById('create-button').addEventListener('click', () => openDialog());
  document.getElementById('cancel-button').addEventListener('click', () => dialog.close());
  loadProjects();
}

// 未登入就導向登入頁，不執行頁面程式
if (requireAuth()) {
  initProjectPage();
}
```

### 串接規則

- **所有 API 呼叫一律用 `authFetch`**（`frontend/js/auth.js`），它會自動帶 `Authorization: Bearer <token>`，回傳後端 `data`，失敗時丟出帶有中文 `message` 的 `Error`。頁面裡**不直接呼叫 `fetch`**、不直接讀寫 `localStorage`。
- 路徑相對於 `API_BASE_URL`（已含 `/api`），寫成 `'/projects'`，不要寫死網址。
- 方法對應：列表 `GET /projects`、新增 `POST`、更新 `PUT /projects/{id}`、刪除 `DELETE /projects/{id}`；請求 body 直接傳物件（`authFetch` 會轉 JSON）。
- **每個操作都要有 `try / catch`**：成功 → 成功 Toast；失敗 → 失敗 Toast（內容用 `error.message`）。
- **操作成功後一律重新呼叫 `loadXxx()` 刷新列表**，不要只在前端手動改陣列。
- 顯示 API 資料時，只用 `textContent` / `createElement`，**不可把資料拼進 `innerHTML`**。

### 其他後台頁面

| 頁面 | 做法 |
| --- | --- |
| 儀表板 `dashboard.html` | 不需要 Modal。上方用 `glass-card` 顯示統計數字（作品數、留言數），下方列出最近幾筆資料；資料用 `Promise.allSettled` 並行載入，單一來源失敗不影響其他卡片 |
| 留言管理 `messages.html` | 與作品管理相同，但只有列表與刪除，沒有新增／編輯；欄位改成姓名、Email、內容（內容過長用 `max-w-xs truncate`） |
| 個人資料 `profile.html` | 沒有表格，只有一個表單：載入時 `GET` 填入欄位，送出時 `PUT`，成功顯示 Toast |

## 步驟 6：最終驗證

**逐項執行，全部通過才能回報完成。** 發現問題就修正後重新驗證。

### 6.1 靜態檢查（用 Grep / Bash）

在專案根目錄執行，把 `<page>` 換成實際檔名。每個指令的預期結果寫在註解裡：

```bash
# 1. 後台完全沒有 GSAP，預期沒有輸出
grep -rni -e gsap -e ScrollTrigger frontend/admin

# 2. 沒有直接呼叫 fetch（一律走 authFetch），預期沒有輸出
grep -rn "fetch(" frontend/admin

# 3. 沒有直接操作 localStorage（一律走 auth.js），預期沒有輸出
grep -rn "localStorage" frontend/admin

# 4. 列出「沒有」登入檢查的頁面 JS，預期只有 admin-common.js 與 login.js
grep -rL "requireAuth" frontend/admin/js

# 5. 沒有 alert( 與 confirm(，預期沒有輸出
grep -rnF -e "alert(" -e "confirm(" frontend/admin

# 6. 沒有用 innerHTML 拼接資料，預期沒有輸出
grep -rn "innerHTML" frontend/admin

# 7. 沒有獨立 CSS 檔，預期沒有輸出
find frontend/admin -name "*.css"

# 8. lang 與編碼各一行，預期 2
grep -c -e 'lang="zh-TW"' -e 'charset="UTF-8"' frontend/admin/<page>.html

# 9. 所有 <img> 都有 alt，預期沒有輸出
grep -n "<img" frontend/admin/<page>.html | grep -v "alt="
```

### 6.2 規範對照（`CLAUDE.md` 與 `frontend.md`）

- [ ] 使用 `<aside>`、`<nav>`、`<main>`、`<header>`、`<section>` 等語義化標籤；表格有 `<thead>` / `<th scope>`。
- [ ] 自訂 class 為 kebab-case 且語意清楚。
- [ ] 每個主要區塊、每個 JS 函式都有繁體中文註解。
- [ ] 沒有規範外的主色系；只有錯誤／成功／刪除使用 `red-300` / `emerald-300`。
- [ ] 前端驗證規則與後端 Pydantic 的欄位限制一致。

### 6.3 實際執行：登入檢查 + CRUD 完整性

1. 啟動後端與前端靜態伺服器（各開一個終端，或用背景執行）：

```bash
cd backend && uvicorn main:app --port 8000
```

```bash
cd frontend && python -m http.server 5500
```

2. **測試帳號**：若使用者沒有提供帳號，用下面指令臨時建立，**驗證完必須刪除**：

```bash
cd backend && python -c "import sqlite3; from auth_utils import hash_password; from database import DB_PATH, init_db; init_db(); c = sqlite3.connect(DB_PATH); c.execute('INSERT OR IGNORE INTO users (username, password_hash) VALUES (?, ?)', ('test-admin', hash_password('test-pass-123'))); c.commit()"
```

3. 用瀏覽器（內建瀏覽器工具）依序驗證：

| 項目 | 操作 | 預期 |
| --- | --- | --- |
| 未登入被擋 | 清空 localStorage 後開 `http://localhost:5500/admin/<page>.html` | 跳轉到 `login.html`，畫面沒有閃出後台內容 |
| 登入失敗 | 在登入頁輸入錯誤密碼 | 顯示「帳號或密碼錯誤」，**沒有**被重新導向 |
| 登入成功 | 輸入正確帳密 | 存入 token 並進入後台 |
| 列表 | 開啟頁面 | 顯示載入中，然後顯示資料（或無資料提示） |
| 新增 | 點新增 → 空白送出 | 欄位下方顯示驗證錯誤；填寫後送出 → 成功 Toast、Modal 關閉、列表出現新資料 |
| 編輯 | 點編輯 | Modal 帶入原資料；修改送出 → 成功 Toast、列表更新 |
| 刪除 | 點刪除 → 取消 | 沒有刪除；再點刪除 → 確定 → 成功 Toast、列表移除該筆 |
| 失敗提示 | 停掉後端後再操作 | 顯示「無法連線到伺服器」的失敗 Toast，頁面沒有壞掉 |
| token 失效 | 在 localStorage 把 token 改壞，再嘗試新增一筆（列表 GET 是公開端點不會 401，要用需認證的寫入操作測） | 401 → 清除 token → 跳轉登入頁 |
| 登出 | 點側邊欄「登出」 | 清除 token 並回到登入頁 |
| 側邊欄高亮 | 進入各頁 | 目前頁面的項目有粉色左邊條與淡粉底 |

4. 檢查 Console 沒有錯誤（登入頁的預期 401 除外）。

**注意**：瀏覽器窗格在背景或隱藏時（`document.hidden` 為 `true`），原生 `<dialog>` 的 `close` 事件不會觸發，刪除確認流程會卡住（列表沒有變化、後端收不到 DELETE）。這是環境限制，不是程式錯誤：先把視窗切到前景再驗證；若無法，手動 `dialog.dispatchEvent(new Event('close'))` 補發事件來驗證後續流程，並在回報中註明。

### 6.4 基本 RWD

在 **375 / 768 / 1280** 三個寬度確認：

| 寬度 | 側邊欄 | 主內容 |
| --- | --- | --- |
| 375 | 隱藏；點頂部列漢堡按鈕以覆蓋方式顯示，點主內容區或按 Esc 收合 | 表格在容器內橫向捲動 |
| 768 | 固定顯示，寬 256px，頂部列消失 | 主內容左邊留出 256px |
| 1280 | 固定顯示 | 內容置中，最大寬度 `max-w-6xl` |

三個寬度都要確認 `document.documentElement.scrollWidth <= window.innerWidth`（整頁沒有橫向捲軸）；Modal 在手機上左右各留 1rem。

### 6.5 收尾

1. **刪除測試帳號**（若有建立）：

```bash
cd backend && python -c "import sqlite3; from database import DB_PATH; c = sqlite3.connect(DB_PATH); c.execute('DELETE FROM users WHERE username = ?', ('test-admin',)); c.commit()"
```

2. 刪掉驗證時建立的測試資料，停止後端與前端伺服器，把瀏覽器視窗還原成桌面尺寸。
3. 回報：建立／修改的檔案、驗證結果（哪些通過、哪些無法驗證及原因）、側邊欄連到但尚未建立的頁面（例如 `messages.html`）。
