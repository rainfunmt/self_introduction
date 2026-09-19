---
name: api-crud
description: 當使用者需要為某個資源建立完整 CRUD API 時使用此 Skill，觸發詞：建立API、CRUD、新增路由、串接後端，例如「幫我為留言建立 CRUD API」「新增 messages 路由」「幫前端串接後端」。依固定 SOP 在 backend/ 依序產生 Pydantic 模型（Create / Response）、資料表（init_db）、APIRouter 五個標準端點（列表、單筆、新增、更新、刪除）、參數化 SQL 與 try-except 錯誤處理，並在 main.py 註冊路由後驗證。技術棧 FastAPI + sqlite3 + Pydantic。
---

# API CRUD 產生器

依下列步驟，為使用者指定的資源在 `backend/` 產生完整的 CRUD API。**每個步驟都要完成，最後一定要跑驗證。**

本 Skill 的所有寫法都遵守 `.claude/rules/fastapi.md`，範例程式碼已實際執行驗證過。

## 步驟 0：準備

1. **釐清資源與欄位**：資源名稱與欄位（名稱、型別、是否必填、長度限制）。使用者沒說明欄位時，依資源性質提出合理欄位，並在最後回報中說明你的假設。
2. **先讀規範與現況**（路徑限定規則只在「讀到符合的檔案」時才載入，所以要主動讀）：
   - `.claude/rules/fastapi.md`、`CLAUDE.md`
   - `backend/models.py`、`backend/database.py`、`backend/main.py`，以及 `backend/routers/` 內已有的路由（沿用它們的風格）
3. **確認沒有重複**：資源的資料表、model、router 檔案是否已存在；已存在就改為補齊缺少的部分，不要覆蓋。
4. **決定命名**（以「留言」為例，多字資源如 `work_experience` 同理）：

| 名稱 | 規則 | 範例 |
| --- | --- | --- |
| `<Resource>` | PascalCase 單數 | `Message`、`WorkExperience` |
| `<resource>` | snake_case 單數 | `message`、`work_experience` |
| `<resources>` | snake_case 複數（資料表名、router 檔名） | `messages`、`work_experiences` |
| URL 前綴 | `/api/` + kebab-case 複數 | `/api/messages`、`/api/work-experiences` |
| Model 類別 | `<Resource>Create`、`<Resource>Response` | `MessageCreate`、`MessageResponse` |
| Router 檔案 | `backend/routers/<resources>.py`（Python 模組名不能有連字號） | `routers/messages.py` |

以下範例都用「作品 Project」示範，實作時換成使用者的資源。

## 步驟 1：定義 Pydantic Model

在 `backend/models.py` **新增**兩個 schema（不要動既有的）：

- `<Resource>Create`：新增與更新的 request body。**不含** `id`、`created_at` 這類由資料庫產生的欄位。
- `<Resource>Response`：回傳給前端的資料。包含 `id`、`created_at` 與所有對外欄位。**不含**密碼雜湊等敏感欄位。

```python
class ProjectCreate(BaseModel):
    """新增／更新作品的 request body"""
    title: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=2000)


class ProjectResponse(BaseModel):
    """作品的 response（包含資料庫產生的欄位）"""
    id: int
    title: str
    description: str
    created_at: str
```

規則：

- 必填欄位用 `Field(min_length=1, max_length=N)`，選填欄位給預設值（`default=""`）或用 `str | None = None`。**所有字串都要有 `max_length`**。
- 型別對照：`str` ↔ `TEXT`、`int` ↔ `INTEGER`、`float` ↔ `REAL`、`bool` ↔ `INTEGER`（0／1）。
- 需要驗證格式時用 Pydantic 內建型別，例如 Email 用 `EmailStr`（需另裝 `email-validator`），其他用 `Field(pattern=...)`。
- 更新（PUT）預設是「整筆取代」，直接重用 `<Resource>Create`。只有要支援局部更新時，才另外定義 `<Resource>Update`（所有欄位皆選填）。

## 步驟 2：建立資料表

在 `backend/database.py` 的 `init_db()` 內、`executescript` 的 SQL 字串中**追加**一段 `CREATE TABLE IF NOT EXISTS`：

```sql
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

規則：

- **必須有** `id INTEGER PRIMARY KEY AUTOINCREMENT` 與 `created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`（自動時間戳，格式 `YYYY-MM-DD HH:MM:SS`，UTC）。
- 資料表名稱用 snake_case 複數（`projects`）。
- 必填欄位加 `NOT NULL`；有預設值的加 `DEFAULT`。
- 外鍵範例：`user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE`（`get_db()` 已啟用 `PRAGMA foreign_keys = ON`）。
- **`IF NOT EXISTS` 不會修改已存在的資料表。** 若是調整既有資料表的欄位，要用 `ALTER TABLE`，或告知使用者刪除開發用的 `portfolio.db` 讓它重新建立。**不要在使用者不知情下刪除資料庫。**

## 步驟 3：建立 Router 檔案

建立 `backend/routers/<resources>.py`，並確認 `backend/routers/__init__.py` 存在。檔案結構：

1. 模組 docstring（繁體中文）與 import
2. `logger = logging.getLogger(__name__)`
3. `router = APIRouter(prefix="/api/<kebab-resources>", tags=["<resources>"])`
4. 一個 `get_<resource>_or_404()` 輔助函式
5. 五個標準端點

### 五個標準端點與權限

| 端點 | Method 與路徑 | 權限 | 成功狀態碼 |
| --- | --- | --- | --- |
| 列表 | `GET /api/<resources>` | **公開** | 200 |
| 單筆 | `GET /api/<resources>/{id}` | **公開** | 200 |
| 新增 | `POST /api/<resources>` | **需認證** | 201 |
| 更新 | `PUT /api/<resources>/{id}` | **需認證** | 200 |
| 刪除 | `DELETE /api/<resources>/{id}` | **需認證** | 200（`data` 為 `null`） |

- 查詢預設公開，因為前台要顯示內容；新增／更新／刪除必須登入。
- 需認證的端點在裝飾器加 `dependencies=[Depends(get_current_user)]`；需要使用者資料時才改成參數 `current_user: dict = Depends(get_current_user)`。
- **例外：訪客也要寫入的資源（例如聯絡表單留言）。** 使用者若說明這種情況，權限對調：`POST` 公開，`GET` 列表／單筆改為需認證。公開的 `POST` 一定要有嚴格的欄位長度限制（防止灌入大量資料），並在最後回報中說明這個權限決定。

## 步驟 4：實作資料庫操作

每個端點內的 sqlite3 邏輯都遵守：

- **SQL 一律參數化（`?` 佔位符）**，值放在第二個參數的 tuple。**禁止**用 f-string、`%`、`.format()`、字串相加把使用者輸入放進 SQL。
- **每個端點的資料庫操作都要 `try / except sqlite3.Error`**：`logger.exception(...)` 記錄細節，再 `raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "<動作>失敗")`。錯誤細節不回傳給前端。
- 預期內的錯誤用 `HTTPException`：資料不存在 `404`、未登入 `401`、資料重複 `409`。狀態碼一律用 `status.HTTP_xxx` 常數。
- 寫入操作用 `with db:` 包起來（成功自動 commit、例外自動 rollback）。
- 更新與刪除前先呼叫 `get_<resource>_or_404()`，確保不存在時回 404。
- 端點用同步 `def`（`sqlite3` 是阻塞式）。
- 回傳一律 `{"success": ..., "data": ..., "message": "..."}`，`message` 用繁體中文。
- 欄位有 `UNIQUE` 時，捕捉 `sqlite3.IntegrityError`（要寫在 `sqlite3.Error` 前面）並回 409。

完整範例 `backend/routers/projects.py`（換資源時，替換名稱、欄位、SQL 與訊息文字）：

```python
"""作品集路由：CRUD"""
import logging
import sqlite3

from fastapi import APIRouter, Depends, HTTPException, status

from auth_utils import get_current_user
from database import get_db
from models import ApiResponse, ProjectCreate, ProjectResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/projects", tags=["projects"])


def get_project_or_404(db: sqlite3.Connection, project_id: int) -> dict:
    """查詢單一專案，不存在就丟 404"""
    try:
        row = db.execute(
            "SELECT id, title, description, created_at FROM projects WHERE id = ?",
            (project_id,),
        ).fetchone()
    except sqlite3.Error:
        logger.exception("查詢專案失敗")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "查詢專案失敗")
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "找不到指定的專案")
    return dict(row)


@router.get("", response_model=ApiResponse[list[ProjectResponse]])
def list_projects(db: sqlite3.Connection = Depends(get_db)):
    """查詢所有專案（公開）"""
    try:
        rows = db.execute(
            "SELECT id, title, description, created_at FROM projects ORDER BY id DESC"
        ).fetchall()
    except sqlite3.Error:
        logger.exception("查詢專案列表失敗")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "查詢專案列表失敗")
    return {"success": True, "data": [dict(r) for r in rows], "message": "查詢成功"}


@router.get("/{project_id}", response_model=ApiResponse[ProjectResponse])
def get_project(project_id: int, db: sqlite3.Connection = Depends(get_db)):
    """查詢單一專案（公開）"""
    return {"success": True, "data": get_project_or_404(db, project_id), "message": "查詢成功"}


@router.post(
    "",
    response_model=ApiResponse[ProjectResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_user)],
)
def create_project(payload: ProjectCreate, db: sqlite3.Connection = Depends(get_db)):
    """新增專案（需登入）"""
    try:
        with db:  # 成功自動 commit，發生例外自動 rollback
            cursor = db.execute(
                "INSERT INTO projects (title, description) VALUES (?, ?)",
                (payload.title, payload.description),
            )
    except sqlite3.Error:
        logger.exception("新增專案失敗")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "新增專案失敗")
    return {"success": True, "data": get_project_or_404(db, cursor.lastrowid), "message": "新增成功"}


@router.put(
    "/{project_id}",
    response_model=ApiResponse[ProjectResponse],
    dependencies=[Depends(get_current_user)],
)
def update_project(project_id: int, payload: ProjectCreate, db: sqlite3.Connection = Depends(get_db)):
    """更新專案（需登入）"""
    get_project_or_404(db, project_id)  # 先確認存在，不存在會回 404
    try:
        with db:
            db.execute(
                "UPDATE projects SET title = ?, description = ? WHERE id = ?",
                (payload.title, payload.description, project_id),
            )
    except sqlite3.Error:
        logger.exception("更新專案失敗")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "更新專案失敗")
    return {"success": True, "data": get_project_or_404(db, project_id), "message": "更新成功"}


@router.delete(
    "/{project_id}",
    response_model=ApiResponse[None],
    dependencies=[Depends(get_current_user)],
)
def delete_project(project_id: int, db: sqlite3.Connection = Depends(get_db)):
    """刪除專案（需登入）"""
    get_project_or_404(db, project_id)
    try:
        with db:
            db.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    except sqlite3.Error:
        logger.exception("刪除專案失敗")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "刪除專案失敗")
    return {"success": True, "data": None, "message": "刪除成功"}
```

改寫時的注意事項：

- 欄位有增減時，`SELECT`、`INSERT`（欄位數要與 `?` 數量一致）、`UPDATE SET` 三處都要同步。
- 要支援排序或篩選時，欄位名稱用**白名單**對照，只有值才能放 `?`；`LIKE` 的 `%` 放在參數值裡（`(f"%{keyword}%",)`），不是放進 SQL 字串。
- 刪除有關聯資料的資源前，先確認外鍵設定（`ON DELETE CASCADE` 或先檢查子資料）。

## 步驟 5：註冊路由

在 `backend/main.py`：

1. 把新 router 加進既有的 import：

```python
from routers import auth, projects, messages
```

2. 在檔案最後、既有 `include_router` 之後加一行：

```python
app.include_router(messages.router)
```

全域的 CORS 與錯誤處理 handler **不要動**，新路由自動適用。

## 步驟 6：驗證

**逐項執行，全部通過才能回報完成。** 發現問題就修正後重新驗證。

### 6.1 靜態檢查

在專案根目錄執行（把 `<resources>` 換成實際檔名）：

```bash
# 1. 匯入檢查，預期沒有錯誤輸出
cd backend && python -c "import main" && cd ..

# 2. 沒有字串拼接 SQL，預期沒有輸出
grep -nE "execute\(f|\.format\(|execute\(.*%" backend/routers/<resources>.py

# 3. 沒有魔術數字狀態碼，預期沒有輸出
grep -nE "status_code=[0-9]|HTTPException\([0-9]" backend/routers/<resources>.py

# 4. 沒有 async 端點，預期沒有輸出
grep -n "async def" backend/routers/<resources>.py

# 5. 端點數量，預期 5（列表、單筆、新增、更新、刪除）
grep -cE "^@router\.(get|post|put|delete)" backend/routers/<resources>.py

# 6. 已註冊到 main.py，預期看到 include_router 那一行
grep -n "<resources>" backend/main.py
```

### 6.2 實際呼叫每個端點

1. 啟動後端：

```bash
cd backend && uvicorn main:app --port 8000
```

2. **測試帳號**：使用者沒有提供帳號時，臨時建立一個，**驗證完必須刪除**：

```bash
cd backend && python -c "import sqlite3; from auth_utils import hash_password; from database import DB_PATH, init_db; init_db(); c = sqlite3.connect(DB_PATH); c.execute('INSERT OR IGNORE INTO users (username, password_hash) VALUES (?, ?)', ('test-admin', hash_password('test-pass-123'))); c.commit()"
```

3. 依序呼叫。`run` 會印出回應內容與狀態碼；`<resources>` 換成 URL 前綴的資源名（例如 `messages`、`work-experiences`），JSON 欄位換成該資源實際的必填欄位。這段腳本**只會操作自己新增的那一筆資料**，不會動到既有資料：

```bash
BASE=http://localhost:8000/api

# 登入取得 token
TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"username":"test-admin","password":"test-pass-123"}' | python -c "import sys, json; print(json.load(sys.stdin)['data']['access_token'])")

# 印出說明、回應內容與狀態碼
run() { echo "--- $1"; shift; curl -s -w "\n[%{http_code}]\n" "$@"; }

run "列表（預期 200）" $BASE/<resources>
run "新增，沒帶 token（預期 401）" -X POST $BASE/<resources> -H "Content-Type: application/json" -d '{"title":"x"}'
run "新增，驗證失敗（預期 422）" -X POST $BASE/<resources> -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"title":""}'

# 新增成功（預期最後一行 201），並取出新資料的 id 給後面使用
RESP=$(curl -s -w "\n%{http_code}" -X POST $BASE/<resources> -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"title":"curl test"}')
echo "$RESP"
ID=$(echo "$RESP" | head -n 1 | python -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")

run "單筆（預期 200）" $BASE/<resources>/$ID
run "不存在（預期 404）" $BASE/<resources>/99999
run "更新（預期 200）" -X PUT $BASE/<resources>/$ID -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"title":"updated"}'
run "刪除，沒帶 token（預期 401）" -X DELETE $BASE/<resources>/$ID
run "刪除（預期 200，data 為 null）" -X DELETE $BASE/<resources>/$ID -H "Authorization: Bearer $TOKEN"
run "刪除後再查（預期 404）" $BASE/<resources>/$ID
```

**curl 的 JSON 內容請用英文／ASCII。** Windows 的 Git Bash 用 `-d` 送出中文時不是 UTF-8 編碼，後端會回 400（`There was an error parsing the body`），這是 curl 的問題，不是 API 的問題。要測中文內容，把 JSON 存成 UTF-8 檔案再用 `-d @payload.json` 送出。

### 6.3 驗證檢查表

| 項目 | 預期 |
| --- | --- |
| 五個端點都正常 | 上面每個呼叫的狀態碼都符合註解 |
| 認證正確 | 公開端點不帶 token 可用；新增／更新／刪除不帶 token 回 401；token 錯誤或過期也回 401 |
| **回傳格式統一** | **每一個**回應（含 401、404、422、500）都有且只有 `success`、`data`、`message` 三個欄位 |
| 狀態碼正確 | 新增 201、其他成功 200、不存在 404、驗證失敗 422、未登入 401 |
| 中文訊息 | `message` 為繁體中文 |
| 沒有洩漏內部資訊 | 500 錯誤只有簡短中文訊息，沒有 SQL 或 traceback |
| Swagger | 開啟 `http://localhost:8000/docs`，新資源的五個端點都出現，且 tags 正確 |
| 前端可用 | 前端 `authFetch('/<resources>')` 能取得 `data`（CORS 已由 `main.py` 全域設定） |

### 6.4 收尾

1. **刪除測試帳號**與驗證時建立的測試資料：

```bash
cd backend && python -c "import sqlite3; from database import DB_PATH; c = sqlite3.connect(DB_PATH); c.execute('DELETE FROM users WHERE username = ?', ('test-admin',)); c.commit()"
```

2. 停止後端伺服器。
3. 回報：修改與新增的檔案、欄位與權限的假設、驗證結果（哪些通過、哪些無法驗證及原因）。若資源需要前端頁面，提醒可以接著使用 `admin-page`（後台管理）或 `create-page`（前台展示）Skill。
