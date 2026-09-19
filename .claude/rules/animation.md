---
paths:
  - "frontend/*.{html,css,js}"
  - "frontend/pages/**/*.{html,css,js}"
  - "frontend/js/**/*.js"
  - "frontend/css/**/*.css"
---

# 前台動畫規範（GSAP 3.x + ScrollTrigger + CSS transition）

## 適用範圍

- **僅適用前台頁面。`frontend/admin/`（後台）完全不適用**，見文末「後台不適用」。
- 本規則的 `paths` 是用「列舉前台路徑」的方式排除 admin。新增前台目錄時，要把它補進上方 `paths`；**不要**把 `frontend/admin/` 加進去。
- 前台動畫程式集中放在 `frontend/js/animations.js`，以 `initXxxAnimation()` 形式 export，頁面在**資料渲染完成後**再呼叫。

## 1. GSAP 基本規則

### `from()` 還是 `to()`？

| 情境 | 用法 |
| --- | --- |
| 進場動畫（元素從隱藏到原本的樣式） | **`gsap.from()`**：只寫「起點」，終點就是 CSS 原本的樣子，不用重複定義 |
| 互動狀態變化（開關選單、切換分頁、點擊回饋） | `gsap.to()` |
| 起點與終點都要明確指定、或會重複播放 | `gsap.fromTo()`（避免重播時從錯誤的起點開始） |
| 一連串有先後關係的動畫（Hero 區） | `gsap.timeline()` |

### 進場：位移 + 透明度搭配

進場動畫一律 **`y` 位移 + `opacity: 0`** 一起用，只動 transform 與 opacity。

```javascript
// 標準進場：由下往上淡入
gsap.from('.project-card', { y: 40, opacity: 0 });
```

| 元素類型 | `y` 位移 |
| --- | --- |
| 大區塊、卡片 | 40–60px（預設 40） |
| 小元素（標籤、按鈕、圖示） | 20–30px |
| 左右交錯的版面 | 改用 `x: ±40–60` |

位移不要超過 100px，會讓動作顯得拖沓。

### 時長（不要太慢也不要太快）

| 類型 | 時長 |
| --- | --- |
| 一般區塊進場 | **0.6–1.0 秒（預設 0.8）** |
| 小元素、微互動 | 0.3–0.5 秒 |
| Hero 大標題（僅首屏） | 最多 1.2 秒 |

任何單一動畫**不得超過 1.5 秒**；低於 0.2 秒則幾乎看不出來，不要用。

### easing

| 用途 | easing |
| --- | --- |
| **進場預設** | `power3.out`（快速出現、柔和停下） |
| 來回移動、需對稱的動作 | `power2.inOut` |
| 需要輕微彈性的小元素（標籤、徽章） | `back.out(1.4)`，**限量使用** |
| `scrub` 綁定捲動 | `none`（線性） |

避免 `elastic`、`bounce`：太花俏，與這個站的沉穩風格不符。

在 `animations.js` 頂端統一設定預設值，個別動畫只在需要時覆寫：

```javascript
// 全站動畫預設：時長 0.8 秒、柔和減速
gsap.defaults({ duration: 0.8, ease: 'power3.out' });
```

### 多元素依序出現（stagger）

| 情境 | 設定 |
| --- | --- |
| 一般列表／卡片 | `stagger: 0.12`（每個間隔 0.08–0.15 秒） |
| 項目很多（超過 8 個） | `stagger: { amount: 0.8 }`，用「總時長」控制，避免最後一個等太久 |
| 網格排列 | `stagger: { each: 0.1, grid: 'auto', from: 'start' }` |

整段 stagger 的總延遲控制在約 1 秒內。

## 2. ScrollTrigger

- **所有捲動觸發的動畫一律使用 ScrollTrigger。禁止**手動 `addEventListener('scroll', ...)`、`window.onscroll`。
- 只在 `animations.js` 註冊一次：`gsap.registerPlugin(ScrollTrigger)`。

### 預設值

```javascript
// 捲動觸發預設：元素頂端進入視窗 85% 處時播放一次
ScrollTrigger.defaults({
  start: 'top 85%',
  toggleActions: 'play none none none',
});
```

- `start: 'top 85%'`：元素頂端進到視窗高度 85% 的位置時觸發。
- `toggleActions: 'play none none none'`：進入時播放、離開與回捲都不動作（只播一次）。需要回捲時反向才用 `'play none none reverse'`。
- 有 stagger 的一組元素，**`trigger` 設在外層容器**，不要在每個子元素各設一個。

```javascript
// 專案區塊捲動進場：以整個區塊為觸發點，卡片依序出現
gsap.from('.project-card', {
  y: 40,
  opacity: 0,
  stagger: 0.12,
  scrollTrigger: { trigger: '.project-section' },
});
```

### 其他規則

- `scrub`（動畫跟著捲動進度）只用於視差、進度條等；用 `scrub: 1`（1 秒平滑）並搭配 `ease: 'none'`。進場動畫**不要**用 scrub。
- `pin` 慎用；手機版（`max-width: 767px`）不要 pin 也不要 scrub，用 `gsap.matchMedia()` 分開處理。
- `markers: true` 只在除錯時使用，**完成前必須移除**。
- **動態內容**（fetch 後才渲染的卡片）：先渲染 DOM，再建立動畫，最後呼叫 `ScrollTrigger.refresh()`，否則位置計算會錯。

```javascript
// 資料渲染完成後才初始化動畫
const projects = await fetchProjectList();
renderProjectCards(projects);
initProjectAnimation();
ScrollTrigger.refresh();
```

- 沿用 `frontend.md` 的規則：所有動畫包在 `gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', ...)` 內。

## 3. CSS transition 使用時機

### 用 CSS transition

單純的「使用者互動 → 狀態切換」：hover、focus、active、小型開關。

```html
<!-- 卡片 hover：顏色與陰影漸變 -->
<a class="transition-colors duration-200 ease-out hover:bg-roast-light focus-visible:ring-2 focus-visible:ring-rose-smoke">
```

### 用 GSAP

進場、捲動觸發、stagger、timeline、需要動態數值或需要在 JS 控制的動畫。

### 不要混用

**同一個元素的同一個屬性，不要同時被 CSS transition 和 GSAP 控制**（例如卡片被 GSAP 做 `y` 進場，又用 `hover:-translate-y-1`），兩者會互相覆蓋。解法：hover 效果改用顏色、陰影，或把 hover 放在內層子元素。

### hover / focus 建議值

| 互動 | 時長 | easing |
| --- | --- | --- |
| hover 進入與離開 | **150–250ms（預設 `duration-200`）** | `ease-out` |
| focus 環 | 150ms | `ease-out` |
| 按下（active） | 100ms | `ease-out` |

- 上限 300ms，再慢會有遲鈍感。
- 指定明確屬性（`transition-colors`、`transition-transform`、`transition-shadow`），**不要對大型元素用 `transition-all`**。
- 鍵盤使用者一定要有清楚的 `focus-visible` 樣式，不可只移除 outline。
- 加上 `motion-reduce:transition-none`。

## 4. 效能原則

### 優先順序：transform + opacity

| 分類 | 屬性 | 作法 |
| --- | --- | --- |
| **優先使用**（只走合成，最順） | `transform`（`x` `y` `scale` `rotation`）、`opacity` | GSAP 用 `x` / `y` / `scale`，不要用 `left` / `top` |
| 可少量使用 | `background-color`、`color`、`box-shadow` | 小元素的 hover 可以，避免大範圍同時動 |
| **避免**（觸發重排） | `width`、`height`、`top` / `left` / `right` / `bottom`、`margin`、`padding`、`font-size`、`border-width` | 改用 `transform` 達成 |

- **不要動畫 `backdrop-filter` / `filter: blur()` 的數值**：`glass-card` 的模糊半徑固定，只對外層做 `opacity` 與 `y`。
- 同一畫面同時進場的玻璃卡片不要太多（約 6 張以內），其餘用 stagger 錯開。
- 隱藏又要避免被 focus 的元素，用 `autoAlpha`（= `opacity` + `visibility`）取代 `opacity`。

### `will-change`

- GSAP 會自動啟用 GPU 加速，**一般動畫不需要手動加 `will-change`**。
- 只在「長時間持續動畫的元素」使用，例如 `scrub` 視差背景：`will-change: transform`（Tailwind：`will-change-transform`）。
- **不可**濫用在大量元素，**不可**寫 `will-change: all`，動畫結束後要移除。

## 5. 後台不適用

- `frontend/admin/` 下的頁面**不使用任何 GSAP／ScrollTrigger 動畫**，也不引入 GSAP 的 `<script>`。
- 後台只保留基本的 CSS hover / focus 效果，例如：`transition-colors duration-150 hover:bg-roast-light`。
- 後台不做進場動畫、捲動動畫、頁面轉場。
- `frontend/js/` 內的共用模組（`config.js`、`api.js`、`auth.js`）會被後台引用，**不可**加入 GSAP 相關程式碼，也不可依賴 `gsap` 全域變數；動畫一律只放在 `animations.js`，且後台頁面不得 import 它。
