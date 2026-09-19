# 個人履歷網站 — 專案規範

前後端分離架構的個人履歷網站。本檔規範適用於專案內所有檔案。

## 專案結構

```
self_introduction/
├── frontend/              # 前端：HTML / CSS / JS
├── backend/               # 後端：Python FastAPI
│   └── portfolio.db       # SQLite 資料庫檔案
└── CLAUDE.md
```

- 前端程式一律放在 `frontend/`，後端程式一律放在 `backend/`。
- 資料庫固定為 SQLite，檔案路徑 `backend/portfolio.db`。
- 前後端只透過 HTTP API 溝通，後端不產生 HTML 畫面。

## 語言與命名規範

### 語言

- 程式註解一律使用**繁體中文**。
- commit message 一律使用**繁體中文**，格式為 `類型: 簡述`。

```
feat: 新增作品集列表 API
fix: 修正經歷時間排序錯誤
docs: 補上 API 回傳格式說明
```

### 命名

| 對象 | 規則 | 範例 |
| --- | --- | --- |
| JavaScript 變數／函式 | camelCase | `userName`、`fetchProjectList()` |
| JavaScript 類別 | PascalCase | `ProjectCard` |
| Python 變數／函式 | snake_case | `user_name`、`get_project_list()` |
| Python 類別 | PascalCase | `ProjectResponse` |
| Python 常數 | 全大寫 snake_case | `DATABASE_URL` |
| CSS class | kebab-case | `project-card`、`hero-title` |
| 檔案／資料夾名稱 | kebab-case | `project-list.js`、`work-experience.html` |

註：Python 檔案若需被 `import`，改用 snake_case（例如 `project_router.py`），因為模組名不允許連字號。

## HTML 規範

- **強制使用語義化標籤**：`<header>`、`<nav>`、`<main>`、`<section>`、`<article>`、`<footer>`。`<div>` 只作為純版面容器。
- 每個頁面必須是 `lang="zh-TW"` 且 `charset="UTF-8"`。
- **所有 `<img>` 必須有 `alt`**（無障礙要求）。純裝飾性圖片寫 `alt=""`。

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>個人履歷</title>
</head>
<body>
  <!-- 頁首：網站標題與主導覽 -->
  <header class="site-header">
    <nav class="main-nav">...</nav>
  </header>

  <main class="page-content">
    <!-- 作品集：專案卡片列表 -->
    <section class="project-section">
      <article class="project-card">
        <img src="./images/demo.png" alt="專案示意畫面">
      </article>
    </section>
  </main>

  <footer class="site-footer">...</footer>
</body>
</html>
```

## API 設計規範

### RESTful 風格

HTTP method 對應 CRUD，路徑用名詞複數，不要把動詞寫進路徑。

| 操作 | Method | 路徑範例 |
| --- | --- | --- |
| 查詢列表 | GET | `/api/projects` |
| 查詢單筆 | GET | `/api/projects/{project_id}` |
| 新增 | POST | `/api/projects` |
| 更新 | PUT | `/api/projects/{project_id}` |
| 刪除 | DELETE | `/api/projects/{project_id}` |

### 統一回傳格式

所有 API 回傳都必須包含 `success`、`data`、`message` 三個欄位，成功與失敗一致。

```json
{
  "success": true,
  "data": [{ "id": 1, "title": "個人履歷網站" }],
  "message": "查詢成功"
}
```

```json
{
  "success": false,
  "data": null,
  "message": "找不到指定的專案"
}
```

### 錯誤處理

- 每個 endpoint 都必須有錯誤處理，不可讓未捕捉的例外直接噴出。
- 資料不存在、參數錯誤、資料庫失敗都要回傳上述統一格式。
- 錯誤用 `HTTPException(status.HTTP_xxx, "繁體中文訊息")`，`detail` 放**字串**；`main.py` 的全域 handler 會把它轉成統一格式（`detail` 放 dict 會變成 `{"detail": {...}}`，破壞格式）。
- 實作細節（handler、`try/except sqlite3.Error`、狀態碼常數）見 `.claude/rules/fastapi.md`。

```python
from fastapi import HTTPException, status

# 查無資料時回傳 404，全域 handler 會轉成 {"success": false, "data": null, "message": "..."}
raise HTTPException(status.HTTP_404_NOT_FOUND, "找不到指定的專案")
```

### HTTP 狀態碼

| 狀態碼 | 使用時機 |
| --- | --- |
| 200 | 查詢／更新／刪除成功（刪除的 `data` 為 `null`，不用 204，因為 204 沒有內容，無法符合統一格式） |
| 201 | 新增成功 |
| 400 | 請求參數格式錯誤 |
| 401 | 未登入、token 無效或過期 |
| 404 | 資源不存在 |
| 422 | 驗證失敗（FastAPI 預設） |
| 500 | 伺服器內部錯誤 |

## 前端技術規範

Tailwind、GSAP、配色、前後台差異、fetch／token 等細節寫在 `.claude/rules/frontend.md`，僅在處理 `frontend/` 下 `.html`、`.css`、`.js` 檔案時載入。

## 註解規範

每個主要區塊、函式、動畫設定都要有繁體中文註解說明用途。

```html
<!-- 關於我：個人簡介與頭像 -->
<section class="about-section">
  ...
</section>
```

```javascript
/**
 * 向後端取得作品集列表
 * @returns {Promise<Array>} 專案資料陣列
 */
async function fetchProjectList() {
  // 失敗時回傳空陣列，避免畫面整個壞掉
  ...
}
```
