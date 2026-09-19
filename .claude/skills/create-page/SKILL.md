---
name: create-page
description: 當使用者要求建立前台頁面時使用此 Skill，例如「幫我建立一個 XX 前台頁面」「新增關於我頁面」「做一個聯絡我頁面」。依固定 SOP 在 frontend/ 產生完整頁面：深色（咖啡煙燻粉）主題、固定頂部導覽列（首頁、作品集、聯絡我、登入/管理後台）、手機漢堡選單、Footer、GSAP 進場與捲動動畫、三個斷點 RWD。後台管理頁面（frontend/admin/）不適用，請改用 admin-page Skill。
---

# 前台頁面產生器

依下列步驟，為使用者指定的主題在 `frontend/` 產生一個完整的前台頁面。**每個步驟都要完成，最後一定要跑驗證。**

## 步驟 0：準備

1. **釐清需求**
   - 頁面中文標題，以及檔名（kebab-case，例如 `about-me.html`、`portfolio.html`、`contact.html`）。
   - 頁面要有哪些內容區塊。使用者沒說明時，依頁面性質自行安排 2–4 個合理區塊，並在最後回報中說明你的安排。
2. **先讀規範檔**（路徑限定規則只在「讀到符合的檔案」時才載入，新建檔案不保證觸發，所以要主動讀）：
   - `CLAUDE.md`
   - `.claude/rules/frontend.md`（技術棧、配色、`apiRequest` / `auth.js`）
   - `.claude/rules/animation.md`（GSAP 時長、easing、ScrollTrigger 預設值）
3. **盤點現況**：用 Glob 檢查 `frontend/*.html` 與 `frontend/js/*.js`。
   - **已有前台頁面**：直接複製它的 `<head>` 主題區塊、導覽列、Footer，維持所有頁面一致，不要重寫。
   - **還沒有任何頁面**：用下面步驟的模板。
4. **共用檔案不存在就建立**（存在就不要動）：
   - `frontend/js/config.js`、`frontend/js/api.js`、`frontend/js/auth.js`：內容照 `frontend.md`「JavaScript」一節。
   - `frontend/js/nav.js`、`frontend/js/animations.js`：照本 Skill 的步驟 2、5。
5. **檔案清單**（以 `<page>` 代表頁面檔名）：
   - `frontend/<page>.html`
   - `frontend/js/<page>.js`（頁面進入點，ES Module）
   - 圖片放 `frontend/images/`

**斷點定義**（整個 Skill 統一使用）：手機 `< 768px`（預設，不加前綴）、平板 `md:`（≥ 768px）、桌面 `lg:`（≥ 1024px）。

## 步驟 1：HTML 骨架

建立 `frontend/<page>.html`。骨架要包含：

- `<!DOCTYPE html>`、`<html lang="zh-TW">`、`<meta charset="UTF-8">`、`viewport`、`description`、`<title>頁面名 | 我的履歷</title>`
- Tailwind CSS v4 CDN（`@tailwindcss/browser@4.3.3`）
- 主題色與共用元件樣式 `<style type="text/tailwindcss">`（**共用區塊必須與 `frontend.md` 第 2 節完全一致**；只有本頁用到、且重複 3 次以上的元件，可附加在 `@layer components` 末尾並註明「頁面專用」）
- `<body>` 用 `flex min-h-screen flex-col`，讓短頁面的 Footer 也貼在底部
- GSAP + ScrollTrigger CDN 與頁面進入點放在 `</body>` 前
- 不建立任何獨立 `.css` 檔

以下模板以首頁 `index.html` 為例（含 Hero 與內容區塊）。導覽列（步驟 2）、Footer（步驟 4）已一併放入，先照抄，再依頁面主題修改內容。

`frontend/index.html`：

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="個人履歷網站首頁：自我介紹與專長">
  <title>首頁 | 我的履歷</title>

  <!-- Tailwind CSS v4（CDN） -->
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.3.3"></script>

  <!-- 主題色與共用元件樣式（與 frontend.md 第 2 節一致，所有頁面需相同） -->
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
</head>
<body class="flex min-h-screen flex-col bg-espresso text-powder-white antialiased">

  <!-- 頁首：固定於頂部的主導覽列（h-16 = 4rem，內容區要留出空間） -->
  <header class="site-header fixed inset-x-0 top-0 z-50 border-b border-rose-smoke/20 bg-espresso/70 backdrop-blur-xl">
    <nav class="main-nav mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6 lg:px-8" aria-label="主導覽">
      <a href="./index.html" class="brand-logo text-lg font-semibold text-rose-smoke">我的履歷</a>

      <!-- 桌面與平板選單：md 以上顯示 -->
      <ul class="nav-link-list hidden items-center gap-8 md:flex">
        <li><a href="./index.html" class="nav-link">首頁</a></li>
        <li><a href="./portfolio.html" class="nav-link">作品集</a></li>
        <li><a href="./contact.html" class="nav-link">聯絡我</a></li>
        <li><a href="./admin/login.html" class="auth-link btn-primary">登入</a></li>
      </ul>

      <!-- 漢堡按鈕：md 以下顯示 -->
      <button id="menu-toggle" type="button" class="menu-toggle rounded-lg p-2 text-powder-white transition-colors duration-200 hover:bg-roast-light md:hidden" aria-label="開啟選單" aria-expanded="false" aria-controls="mobile-menu">
        <svg id="menu-icon-open" class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
        <svg id="menu-icon-close" class="hidden h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
        </svg>
      </button>
    </nav>

    <!-- 手機版展開選單：預設隱藏 -->
    <div id="mobile-menu" class="mobile-menu hidden border-t border-rose-smoke/20 bg-espresso/95 md:hidden">
      <ul class="flex flex-col gap-1 px-4 py-4">
        <li><a href="./index.html" class="nav-link block rounded-lg px-3 py-3 text-base">首頁</a></li>
        <li><a href="./portfolio.html" class="nav-link block rounded-lg px-3 py-3 text-base">作品集</a></li>
        <li><a href="./contact.html" class="nav-link block rounded-lg px-3 py-3 text-base">聯絡我</a></li>
        <li><a href="./admin/login.html" class="auth-link btn-primary mt-2 block text-center">登入</a></li>
      </ul>
    </div>
  </header>

  <main id="main-content" class="page-content flex-1">

    <!-- Hero：首屏標題與行動按鈕 -->
    <section class="hero-section flex min-h-screen items-center bg-linear-to-b from-roast to-espresso px-4 pt-16 md:px-6 lg:px-8" aria-labelledby="hero-title">
      <div class="hero-content mx-auto w-full max-w-6xl">
        <p class="hero-eyebrow mb-4 text-sm font-medium tracking-widest text-champagne">HELLO, I'M</p>
        <h1 id="hero-title" class="hero-title text-4xl font-bold leading-tight md:text-5xl lg:text-6xl">你好，我是<span class="text-rose-smoke">你的名字</span></h1>
        <p class="hero-description mt-6 max-w-2xl text-base text-mist-rose md:text-lg">用一句話介紹你自己，例如：專注於使用者體驗的前端工程師。</p>
        <div class="hero-actions mt-8 flex flex-wrap gap-4">
          <a href="./portfolio.html" class="btn-primary">查看作品</a>
          <a href="./contact.html" class="btn-secondary">聯絡我</a>
        </div>
      </div>
    </section>

    <!-- 專長：三張卡片（手機 1 欄、平板 2 欄、桌面 3 欄） -->
    <section class="content-section px-4 py-16 md:px-6 md:py-20 lg:px-8 lg:py-24" aria-labelledby="skills-title">
      <div class="mx-auto max-w-6xl">
        <header class="section-heading mb-10 md:mb-12">
          <h2 id="skills-title" class="section-title text-2xl font-semibold md:text-3xl">我的專長</h2>
          <p class="section-description mt-3 text-mist-rose">我擅長的技術與工作方式。</p>
        </header>

        <div class="card-grid grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <article class="info-card glass-card p-6">
            <h3 class="text-lg font-semibold text-rose-smoke">前端開發</h3>
            <p class="mt-2 text-sm text-mist-rose">使用 HTML、Tailwind CSS 與原生 JavaScript 打造響應式介面。</p>
          </article>
          <article class="info-card glass-card p-6">
            <h3 class="text-lg font-semibold text-rose-smoke">後端 API</h3>
            <p class="mt-2 text-sm text-mist-rose">使用 FastAPI 與 SQLite 設計 RESTful API。</p>
          </article>
          <article class="info-card glass-card p-6">
            <h3 class="text-lg font-semibold text-rose-smoke">動畫互動</h3>
            <p class="mt-2 text-sm text-mist-rose">使用 GSAP 與 ScrollTrigger 設計流暢的進場與捲動動畫。</p>
          </article>
        </div>
      </div>
    </section>

  </main>

  <!-- 頁尾：版權與社群連結 -->
  <footer class="site-footer border-t border-rose-smoke/20 bg-roast/60">
    <div class="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 md:flex-row md:justify-between md:px-6 lg:px-8">
      <p class="copyright-text text-sm text-mist-rose">© <span class="current-year">2026</span> 你的名字. All rights reserved.</p>
      <ul class="social-link-list flex items-center gap-5">
        <li>
          <a href="https://github.com/" target="_blank" rel="noopener noreferrer" class="social-link text-mist-rose transition-colors duration-200 hover:text-rose-smoke" aria-label="GitHub">
            <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
          </a>
        </li>
        <li>
          <a href="https://www.linkedin.com/" target="_blank" rel="noopener noreferrer" class="social-link text-mist-rose transition-colors duration-200 hover:text-rose-smoke" aria-label="LinkedIn">
            <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
          </a>
        </li>
        <li>
          <a href="mailto:you@example.com" class="social-link text-mist-rose transition-colors duration-200 hover:text-rose-smoke" aria-label="Email">
            <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          </a>
        </li>
      </ul>
    </div>
  </footer>

  <!-- GSAP + ScrollTrigger（CDN，僅前台頁面） -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.15.0/gsap.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.15.0/ScrollTrigger.min.js"></script>
  <script type="module" src="./js/index.js"></script>
</body>
</html>
```

**建立其他頁面時**：只改 `<title>`、`description`、`<main>` 內的區塊，以及最後的 `<script type="module" src="./js/<page>.js">`。`<head>` 主題區塊、導覽列、Footer 從既有頁面原樣複製。

**圖片規則**：圖片放 `frontend/images/`，每個 `<img>` 必須有有意義的 `alt`（純裝飾用 `alt=""`）。不要引用不存在的圖片檔；使用者沒提供圖片就不放 `<img>`。

## 步驟 2：導覽列（含 RWD 漢堡選單）

導覽列的 HTML 已在步驟 1 的模板內。規格如下，複製既有頁面時也要維持：

| 項目 | 規格 |
| --- | --- |
| 位置 | `<header>` 固定於頂部（`fixed inset-x-0 top-0 z-50`），半透明底 + `backdrop-blur-xl`；高度固定 `h-16` |
| 連結 | 首頁 `index.html`、作品集 `portfolio.html`、聯絡我 `contact.html`、登入 / 管理後台 |
| 手機（< 768px） | 隱藏連結列，顯示漢堡按鈕；點擊展開 `#mobile-menu` |
| 平板與桌面（≥ 768px） | 顯示橫向連結列，隱藏漢堡按鈕 |
| 目前頁面高亮 | JS 設定 `aria-current="page"`，由 `.nav-link` 樣式負責變色 |
| 登入 / 管理後台 | 預設顯示「登入」→ `admin/login.html`；已登入（localStorage 有 token）改為「管理後台」→ `admin/dashboard.html` |
| 無障礙 | 漢堡按鈕有 `aria-label`、`aria-expanded`、`aria-controls`；Esc 可收合 |

因為固定導覽列不佔版面高度，**第一個區塊要有 `pt-16`（Hero 已含）**，其他頁面的第一個區塊用 `pt-24`，避免被蓋住。

建立 `frontend/js/nav.js`（若已存在就不要動）：

`frontend/js/nav.js`：

```javascript
import { isLoggedIn } from './auth.js';

/**
 * 初始化導覽列：漢堡選單、目前頁面高亮、登入／管理後台連結、Footer 年份
 */
export function initNav() {
  const menuToggle = document.getElementById('menu-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  const iconOpen = document.getElementById('menu-icon-open');
  const iconClose = document.getElementById('menu-icon-close');

  // 開關手機版選單，並同步無障礙屬性與圖示
  function setMenuOpen(isOpen) {
    menuToggle.setAttribute('aria-expanded', String(isOpen));
    menuToggle.setAttribute('aria-label', isOpen ? '關閉選單' : '開啟選單');
    mobileMenu.classList.toggle('hidden', !isOpen);
    iconOpen.classList.toggle('hidden', isOpen);
    iconClose.classList.toggle('hidden', !isOpen);
  }

  menuToggle.addEventListener('click', () => {
    setMenuOpen(menuToggle.getAttribute('aria-expanded') !== 'true');
  });

  // 點擊選單內的連結，或按下 Esc 時收合
  mobileMenu.addEventListener('click', (event) => {
    if (event.target.closest('a')) setMenuOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setMenuOpen(false);
  });

  // 視窗放大到平板／桌面尺寸時，確保手機選單已收合
  window.matchMedia('(min-width: 768px)').addEventListener('change', (event) => {
    if (event.matches) setMenuOpen(false);
  });

  // 目前頁面高亮：標記 aria-current="page"，樣式由 .nav-link 處理
  const currentFile = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach((link) => {
    const linkFile = new URL(link.href).pathname.split('/').pop();
    if (linkFile === currentFile) link.setAttribute('aria-current', 'page');
  });

  // 已登入時，「登入」改成「管理後台」
  if (isLoggedIn()) {
    document.querySelectorAll('.auth-link').forEach((link) => {
      link.textContent = '管理後台';
      link.href = './admin/dashboard.html';
    });
  }

  // Footer 年份
  document.querySelectorAll('.current-year').forEach((element) => {
    element.textContent = new Date().getFullYear();
  });
}
```

## 步驟 3：頁面主體結構

- 所有內容放在 `<main id="main-content">` 內，依序由多個 `<section>` 組成。
- 每個 `<section>` 用 `aria-labelledby` 指向自己的 `<h2>`；區塊標題包在 `<header class="section-heading">`。
- 每個區塊前加**繁體中文註解**說明用途（例如 `<!-- 專長：三張卡片 -->`）。
- 區塊外層固定寫法：`content-section px-4 py-16 md:px-6 md:py-20 lg:px-8 lg:py-24`，內層 `mx-auto max-w-6xl`。
- 頁面標題層級：每頁只有一個 `<h1>`，區塊用 `<h2>`，卡片用 `<h3>`。
- 卡片用 `<article class="info-card glass-card ...">`，列表用 `<ul>`／`<li>`。
- 交錯背景：相鄰區塊可交替使用透明底與 `bg-linear-to-b from-roast to-espresso`，營造層次。

**RWD 排版寫法**（mobile-first）：

| 用途 | 寫法 |
| --- | --- |
| 卡片網格 | `grid gap-6 md:grid-cols-2 lg:grid-cols-3` |
| 標題字級 | `text-4xl md:text-5xl lg:text-6xl`（Hero）、`text-2xl md:text-3xl`（區塊標題） |
| 左右並排 → 上下堆疊 | `flex flex-col gap-8 md:flex-row` |
| 內距 | `px-4 md:px-6 lg:px-8` |
| 圖片 | `w-full h-auto`，需要裁切用 `object-cover` 並固定比例（`aspect-video`） |

需要向後端取資料的頁面（例如作品集）：在 `js/<page>.js` 用 `apiRequest`（`frontend.md`）載入，`try / catch` 處理錯誤，載入失敗顯示替代內容與重試按鈕，**不用 `alert()`**。渲染卡片時用 `createElement` + `textContent`，**不要把 API 資料直接塞進 `innerHTML`**（XSS）。

## 步驟 4：Footer

Footer 已在步驟 1 模板內。規格：

- 使用 `<footer class="site-footer">`，每個前台頁面都必須有。
- 內容：版權文字（`© <年份> 名字. All rights reserved.`，年份由 `nav.js` 自動更新）與社群連結（GitHub、LinkedIn、Email）。
- 排版：手機置中上下堆疊，平板以上左右分列（`flex-col md:flex-row md:justify-between`）。
- 外部連結一律 `target="_blank" rel="noopener noreferrer"`；純圖示連結必須有 `aria-label`，SVG 加 `aria-hidden="true"`。
- 連結網址若使用者沒提供，保留模板中的通用網址，並在最後回報中提醒要替換。

## 步驟 5：GSAP 動畫

動畫程式集中在 `frontend/js/animations.js`（若已存在就在原檔追加，不要重建）。數值全部遵守 `animation.md`：預設時長 0.8s、easing `power3.out`、`y` 位移 40px、stagger 0.12s、ScrollTrigger `start: 'top 85%'`。

**動畫規劃**：

| 動畫 | 元素 | 作法 |
| --- | --- | --- |
| 導覽列進場 | `.site-header` | `gsap.from`，`y: -20` + `opacity: 0`，0.6s |
| Hero 進場（淡入 + 上移） | `.hero-eyebrow` → `.hero-title` → `.hero-description` → `.hero-actions > *` | `timeline` 依序出現，最後一組按鈕用 `stagger: 0.12` |
| 區塊標題捲動進場 | `.section-heading` | ScrollTrigger，`trigger` 為所屬區塊 |
| 卡片 stagger | `.info-card` | `stagger: 0.12`，`trigger` 設在外層 `.card-grid` |

`frontend/js/animations.js`：

```javascript
// 全站動畫預設：時長 0.8 秒、柔和減速
gsap.registerPlugin(ScrollTrigger);
gsap.defaults({ duration: 0.8, ease: 'power3.out' });

// 捲動觸發預設：元素頂端進入視窗 85% 處時播放一次
ScrollTrigger.defaults({
  start: 'top 85%',
  toggleActions: 'play none none none',
});

/**
 * 啟動頁面所有動畫；使用者開啟「減少動態效果」時不播放
 */
export function initPageAnimations() {
  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
    initHeaderAnimation();
    // 頁面上有對應元素才執行，避免 GSAP 找不到目標而在 Console 警告
    if (document.querySelector('.hero-title')) initHeroAnimation();
    initSectionAnimations();
  });
}

// 導覽列進場：由上往下淡入
function initHeaderAnimation() {
  gsap.from('.site-header', { y: -20, opacity: 0, duration: 0.6 });
}

// Hero 進場：標題、說明、按鈕依序淡入上移
function initHeroAnimation() {
  const heroTimeline = gsap.timeline();
  heroTimeline
    .from('.hero-eyebrow', { y: 20, opacity: 0, duration: 0.5 })
    .from('.hero-title', { y: 40, opacity: 0 }, '-=0.2')
    .from('.hero-description', { y: 30, opacity: 0 }, '-=0.5')
    .from('.hero-actions > *', { y: 20, opacity: 0, duration: 0.5, stagger: 0.12 }, '-=0.4');
}

// 各內容區塊的捲動進場：標題先出現，卡片依序 stagger
function initSectionAnimations() {
  gsap.utils.toArray('.content-section').forEach((section) => {
    const heading = section.querySelector('.section-heading');
    if (heading) {
      gsap.from(heading, { y: 40, opacity: 0, scrollTrigger: { trigger: section } });
    }

    const cards = section.querySelectorAll('.info-card');
    if (cards.length > 0) {
      gsap.from(cards, {
        y: 40,
        opacity: 0,
        stagger: 0.12,
        scrollTrigger: { trigger: section.querySelector('.card-grid') || section },
      });
    }
  });
}
```

頁面進入點：

`frontend/js/index.js`：

```javascript
import { initNav } from './nav.js';
import { initPageAnimations } from './animations.js';

// 首頁進入點：先初始化導覽列，再啟動動畫
initNav();
initPageAnimations();
```

**規則**：

- 動態渲染的內容（fetch 後才產生的卡片）：**先渲染 DOM → 再呼叫 `initPageAnimations()` → 最後 `ScrollTrigger.refresh()`**。
- 新頁面有自己的動畫元素時，在 `animations.js` 新增 `initXxxAnimation()` 函式，並在 `initPageAnimations` 內用「元素存在才執行」的寫法呼叫（例如 `if (document.querySelector('.profile-card')) initProfileCardAnimation();`）。
- 禁止 `addEventListener('scroll')`；只動 `transform` 與 `opacity`。
- 頁面不引入 `markers: true`。

## 步驟 6：最終驗證

**逐項執行，全部通過才能回報完成。** 發現問題就修正後重新驗證。

### 6.1 靜態檢查（用 Grep / Bash）

在專案根目錄執行，把 `<page>` 換成實際檔名。每個指令的預期結果寫在註解裡：

```bash
# 1. 所有 <img> 都有 alt，預期沒有輸出
grep -n "<img" frontend/<page>.html | grep -v "alt="

# 2. lang 與編碼各一行，預期 2
grep -c -e 'lang="zh-TW"' -e 'charset="UTF-8"' frontend/<page>.html

# 3. 語義化標籤：<main> 與 <footer> 各一個，預期 1 與 1
grep -c "<main" frontend/<page>.html
grep -c "<footer" frontend/<page>.html

# 4. 沒有獨立 CSS 檔，預期沒有輸出
find frontend -name "*.css"

# 5. 沒有手動 scroll 監聽，預期沒有輸出
grep -rn "addEventListener('scroll'" frontend/js

# 6. 沒有 alert(，預期沒有輸出
grep -rn "alert(" frontend --include="*.js" --include="*.html"

# 7. 色碼只出現在 @theme 區塊，預期沒有輸出（--color- 開頭的定義行已排除）
grep -n "#[0-9a-fA-F]\{6\}" frontend/<page>.html | grep -v -e "--color-"

# 8. 前台頁面要引入 GSAP 與 ScrollTrigger，預期 2
grep -c -e "gsap.min.js" -e "ScrollTrigger.min.js" frontend/<page>.html

# 9. 共用模組沒有 GSAP 程式碼，預期沒有輸出
grep -n "gsap" frontend/js/config.js frontend/js/api.js frontend/js/auth.js frontend/js/nav.js
```

另外目視確認：導覽列四個連結與 Footer 和其他前台頁面一致。

### 6.2 規範對照（`CLAUDE.md` 與 `frontend.md`）

- [ ] 樣式全部使用 Tailwind utility，自訂 class 為 kebab-case 且語意清楚（`info-card`、`section-heading`，沒有 `box1`）。
- [ ] 沒有使用規範外的主色系；文字色用 `powder-white` / `mist-rose`；煙燻粉底的按鈕文字是 `text-espresso`。
- [ ] 每個主要區塊、每個 JS 函式都有繁體中文註解。
- [ ] 沒有把 API base URL 寫死在頁面（只能在 `config.js`）。
- [ ] 動畫數值符合 `animation.md`（時長 0.3–1.0s、`power3.out`、stagger 0.08–0.15s）。
- [ ] 沒有在共用模組（`config.js`、`api.js`、`auth.js`）加入 GSAP 相關程式碼。

### 6.3 實際開啟頁面，驗證 RWD

1. 在 `frontend/` 目錄啟動靜態伺服器（ES Module 不能用 `file://`）：

```bash
cd frontend && python -m http.server 5500
```

2. 用瀏覽器（內建瀏覽器工具）開啟 `http://localhost:5500/<page>.html`，依序切換到三個寬度：**手機 375、平板 768、桌面 1280**，每個寬度確認：

| 寬度 | 導覽列 | 排版 | 其他 |
| --- | --- | --- | --- |
| 375 | 只顯示 logo 與漢堡按鈕，點擊可展開／收合 | 卡片單欄 | 沒有橫向捲軸 |
| 768 | 顯示橫向連結列，漢堡按鈕消失 | 卡片 2 欄 | 沒有橫向捲軸 |
| 1280 | 顯示橫向連結列 | 卡片 3 欄 | 內容置中、最大寬度 `max-w-6xl` |

3. 用 JavaScript 確認沒有橫向溢出：`document.documentElement.scrollWidth <= window.innerWidth`，三個寬度都要為 `true`。
4. 確認 Console 沒有錯誤；捲動時區塊有進場動畫；固定導覽列沒有蓋住第一個區塊的內容。
5. 完成後把瀏覽器視窗還原成桌面尺寸，並停止靜態伺服器。

**注意**：瀏覽器窗格在背景或隱藏時（`document.hidden` 為 `true`），`requestAnimationFrame` 不會執行，GSAP 動畫不會前進，看起來像「標題一直是透明」。先把視窗切到前景；若無法，用 `gsap.updateRoot(gsap.globalTimeline.time() + 秒數)` 手動推進時間，再檢查元素 `opacity` 的起點（0）與終點（1）。

### 6.4 回報

回報時簡短列出：建立／修改了哪些檔案、頁面區塊安排、驗證結果（哪些通過、哪些無法驗證及原因）、需要使用者補的資料（姓名、社群連結、圖片）。
