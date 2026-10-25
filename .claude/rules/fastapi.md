---
paths:
  - "backend/**/*.py"
---

# FastAPI 後端規範（backend/）

技術棧：Python FastAPI + `sqlite3`（內建）+ PyJWT（認證）+ passlib[bcrypt]（密碼雜湊）。本檔的範例程式碼已實際執行驗證過。

## 1. 專案架構

```
backend/
├── main.py           # 入口：建立 app、CORS、全域錯誤處理、掛載 router
├── models.py         # Pydantic 模型（request / response）
├── database.py       # 資料庫連線、建表、既有資料庫的欄位遷移
├── upload_utils.py   # 檔案上傳：驗證類型與大小、隨機檔名儲存、安全刪除
├── uploads/          # 上傳檔案（自動建立）：avatars/ 公開靜態；project-files/ 只能經 API 下載
├── auth_utils.py     # 密碼雜湊、JWT、驗證依賴
├── routers/          # 路由（APIRouter，類似 Flask Blueprint）
│   ├── __init__.py
│   ├── auth.py       # /api/auth/*
│   ├── profile.py    # /api/profile（單筆資料：GET 公開、PUT 需登入）
│   ├── projects.py   # /api/projects/*
│   └── messages.py   # /api/messages/*（POST 公開，其餘需登入）
├── create_admin.py   # 建立／重設管理者帳號的腳本（python create_admin.py 帳號）
├── portfolio.db      # SQLite 檔案（執行後自動產生）
└── requirements.txt
```

| 檔案 | 職責 | 可以 import |
| --- | --- | --- |
| `main.py` | 組裝應用程式 | `database`、`routers` |
| `routers/*.py` | 各資源的端點，每個檔案一個 `APIRouter` | `models`、`database`、`auth_utils` |
| `auth_utils.py` | 認證工具 | `database` |
| `models.py` | 只放 Pydantic 模型 | 不 import 專案內其他模組 |
| `database.py` | 連線與建表 | 不 import 專案內其他模組 |

- 依賴方向單向（上表由上往下），**不可循環 import**。
- 在 `backend/` 目錄下啟動：`uvicorn main:app --reload --port 8000`，因此專案內 import 用 `from database import get_db`，不加 `backend.` 前綴。
- 新資源 = 在 `routers/` 新增一個檔案，並在 `main.py` 用 `app.include_router()` 掛載。
- 路由檔案的 `APIRouter` 統一設定 `prefix="/api/<資源複數>"` 與 `tags=[...]`。

### 套件版本

```
fastapi
uvicorn[standard]
PyJWT
passlib[bcrypt]
bcrypt>=4.0.1,<5
python-multipart
```

**必須把 `bcrypt` 限制在 5 以下。** `passlib` 1.7.4（已停止維護）搭配 bcrypt 5.x 時，任何雜湊都會拋 `ValueError: password cannot be longer than 72 bytes`。bcrypt 4.x 下會多一行無害的 `(trapped) error reading bcrypt version` 日誌，可忽略。

## 2. API 設計

### 統一 JSON 回傳格式

成功與失敗**都**回傳 `success`、`data`、`message` 三個欄位（前端 `api.js` 依賴這個格式）。

```json
{ "success": true,  "data": { "id": 1 }, "message": "查詢成功" }
{ "success": false, "data": null,        "message": "找不到指定的專案" }
```

用泛型模型描述回傳，放在 `models.py`：

```python
from typing import Generic, TypeVar
from pydantic import BaseModel, Field

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """統一回傳格式"""
    success: bool
    data: T | None = None
    message: str
```

### Pydantic 驗證

- 所有 request body 與 response 都要有 Pydantic `BaseModel`；端點加上 `response_model=ApiResponse[...]`。
- 用 `Field(min_length=..., max_length=...)` 明確限制欄位，不要接受無限制的字串。
- 命名：新增／更新用 `XxxCreate`，回傳用 `XxxResponse`，登入等用 `XxxRequest`。
- **回傳模型不可包含 `password_hash` 等敏感欄位。**

```python
class ProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=2000)


class ProjectResponse(BaseModel):
    id: int
    title: str
    description: str
    created_at: str


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    # bcrypt 只處理前 72 bytes，超過的密碼直接拒絕
    password: str = Field(min_length=1, max_length=72)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
```

### 錯誤處理：HTTPException + 狀態碼常數

- 預期內的錯誤一律 `raise HTTPException(status.HTTP_xxx, "繁體中文訊息")`；`detail` 用**字串**。
- 一律 `from fastapi import status`，用常數，**不要寫魔術數字**（`404`）。
- 在 `main.py` 註冊全域 handler，把所有錯誤轉成統一格式（否則 FastAPI 預設會回 `{"detail": ...}`，前端讀不到 `message`）。
- 全域 handler 對應：`HTTPException`（含路由不存在的 404／405）、`RequestValidationError`（422）、`sqlite3.Error`（500，最後防線）。
- **每個端點的資料庫操作都要用 `try/except sqlite3.Error` 包起來**：`logger.exception(...)` 記錄細節，再 `raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "<動作>失敗")`。
  細節只寫進 log，不回傳給前端。`HTTPException`（404 等）不是 `sqlite3.Error`，不會被誤攔。
- `main.py` 的全域 `sqlite3.Error` handler 是最後防線，接住沒被端點包住的資料庫錯誤（例如 `get_current_user` 內的查詢）。
- 不要註冊 `Exception` 的 handler 來處理 500：它在 CORS middleware 外層，回應會缺少 CORS header，瀏覽器會誤報成 CORS 錯誤。

| 情境 | 狀態碼常數 |
| --- | --- |
| 查詢／更新／刪除成功 | `HTTP_200_OK` |
| 新增成功 | `HTTP_201_CREATED`（在裝飾器加 `status_code=`） |
| 未登入／token 無效或過期 | `HTTP_401_UNAUTHORIZED` |
| 資源不存在 | `HTTP_404_NOT_FOUND` |
| 資料重複（如帳號已存在，捕捉 `sqlite3.IntegrityError`） | `HTTP_409_CONFLICT` |
| 驗證失敗 | `HTTP_422_UNPROCESSABLE_CONTENT`（`..._ENTITY` 已被標為棄用） |
| 伺服器／資料庫錯誤 | `HTTP_500_INTERNAL_SERVER_ERROR` |

**刪除成功回 200**，`data` 為 `null`（不用 204：204 沒有回應內容，會違反統一格式）。

### 端點寫成同步函式（`def`）

`sqlite3` 是阻塞式的，端點一律用 `def`，不要用 `async def`（FastAPI 會把 `def` 端點丟到執行緒池，不會卡住事件迴圈）。

### 權限預設

- 查詢（`GET`）預設公開，因為前台要顯示履歷內容。
- 新增／更新／刪除（`POST` / `PUT` / `DELETE`）必須驗證登入。
- 不提供公開的註冊 API；管理者帳號用 `backend/create_admin.py` 建立（密碼以 `getpass` 隱藏輸入，不放在指令列）。
- 訪客要寫入的資源（例如留言 `POST /api/messages`）例外：新增公開，查看與刪除需登入，並嚴格限制欄位長度。

## 3. 資料庫（sqlite3）

- 使用 Python 內建 `sqlite3`，不引入 ORM。
- 資料庫路徑固定為 `backend/portfolio.db`，用 `Path(__file__)` 推導，不依賴啟動時的工作目錄。
- **所有 SQL 一律參數化查詢（`?` 佔位符）。禁止**用 f-string、`%`、`.format()`、字串相加把使用者輸入放進 SQL。
- 要動態決定欄位名或排序（`ORDER BY`）時，用白名單對照，不可直接放入使用者輸入。
- 啟動時在 `lifespan` 呼叫 `init_db()`，用 `CREATE TABLE IF NOT EXISTS` 自動建表。
- 寫入操作用 `with db:` 包起來（成功自動 commit、例外自動 rollback）。
- 取出資料用 `sqlite3.Row`，回傳前轉 `dict(row)`。

`database.py`：

```python
"""資料庫連線與初始化"""
import sqlite3
from pathlib import Path

# 資料庫檔案固定放在 backend/portfolio.db
DB_PATH = Path(__file__).resolve().parent / "portfolio.db"


def get_db():
    """FastAPI 依賴：每個請求開一條連線，請求結束後關閉"""
    # check_same_thread=False：依 FastAPI 官方文件，一個請求的依賴與端點可能跨執行緒執行
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    """啟動時自動建立資料表（已存在則略過）"""
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        conn.commit()
    finally:
        conn.close()
```

## 4. 認證（JWT + bcrypt）

- JWT 使用 **PyJWT**（`import jwt`），演算法 `HS256`，**有效期 24 小時**。
- 密碼用 **passlib 的 bcrypt** 雜湊，資料庫只存 `password_hash`，**絕不儲存或記錄明碼**。
- 密鑰從環境變數 `JWT_SECRET_KEY` 讀取，長度要 **≥ 32 bytes**（否則 PyJWT 會發出 `InsecureKeyLengthWarning`）。**絕不在程式碼裡寫死預設密鑰**（原始碼公開後任何人都能用它偽造登入憑證）；沒設定時用 `secrets.token_urlsafe()` 每次啟動隨機產生，只供本機開發。正式環境必須設定。
- JWT 的 `sub` 必須是**字串**（`str(user_id)`），傳整數會在解碼時拋 `InvalidSubjectError`。
- `jwt.decode()` 一定要明確傳 `algorithms=[...]`。
- 受保護的路由用 `Depends(get_current_user)`；不需要使用者物件時，寫在裝飾器的 `dependencies=[...]`。
- 登入失敗一律回同一則訊息（「帳號或密碼錯誤」），不透露帳號是否存在。
- 401 回應要帶 `WWW-Authenticate: Bearer` header。

`auth_utils.py`：

```python
"""認證工具：密碼雜湊、JWT 簽發與驗證"""
import os
import secrets
import sqlite3
import warnings
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.context import CryptContext

from database import get_db

# 密鑰從環境變數讀取（需 ≥ 32 bytes）。
# 沒設定時每次啟動隨機產生一組，只適合本機開發：重新啟動後要重新登入。
# 不再使用寫死在程式碼裡的預設值，因為原始碼公開後任何人都能用它偽造登入憑證。
SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not SECRET_KEY:
    SECRET_KEY = secrets.token_urlsafe(48)
    warnings.warn("未設定 JWT_SECRET_KEY，已改用隨機密鑰（僅限本機開發；正式上線前務必設定）")
elif len(SECRET_KEY.encode()) < 32:
    raise RuntimeError("JWT_SECRET_KEY 至少要 32 bytes")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
# auto_error=False：沒帶 token 時由我們自己回 401
bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """將明碼密碼雜湊（bcrypt）"""
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """比對明碼與雜湊值"""
    return pwd_context.verify(password, password_hash)


def create_access_token(user_id: int, username: str) -> str:
    """簽發 JWT，有效期 24 小時"""
    payload = {
        "sub": str(user_id),  # PyJWT 要求 sub 必須是字串
        "username": username,
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: sqlite3.Connection = Depends(get_db),
) -> dict:
    """依賴：驗證 Authorization: Bearer <token>，回傳目前使用者"""

    def unauthorized(message: str) -> HTTPException:
        return HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=message,
            headers={"WWW-Authenticate": "Bearer"},
        )

    if credentials is None:
        raise unauthorized("請先登入")

    try:
        # 一定要明確指定 algorithms，避免演算法被竄改
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise unauthorized("登入已過期，請重新登入")
    except jwt.InvalidTokenError:
        raise unauthorized("無效的登入憑證")

    user = db.execute(
        "SELECT id, username FROM users WHERE id = ?", (int(payload["sub"]),)
    ).fetchone()
    if user is None:
        raise unauthorized("無效的登入憑證")
    return dict(user)
```

登入端點 `routers/auth.py`（前端取 `data.access_token` 存進 localStorage）：

```python
"""認證路由：登入"""
from fastapi import APIRouter, Depends, HTTPException, status

from auth_utils import create_access_token, verify_password
from database import get_db
from models import ApiResponse, LoginRequest, TokenResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=ApiResponse[TokenResponse])
def login(payload: LoginRequest, db=Depends(get_db)):
    """管理者登入，成功回傳 JWT"""
    user = db.execute(
        "SELECT id, username, password_hash FROM users WHERE username = ?",
        (payload.username,),
    ).fetchone()
    # 帳號不存在與密碼錯誤用同一則訊息，避免洩漏帳號是否存在
    if user is None or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "帳號或密碼錯誤")

    token = create_access_token(user["id"], user["username"])
    return {"success": True, "data": {"access_token": token}, "message": "登入成功"}
```

## 5. CORS

- 使用 FastAPI 內建的 `CORSMiddleware`，**開發環境允許所有來源（`*`），不做限制**。
- token 走 `Authorization` header，**不需要** `allow_credentials`（且 `*` 搭配 credentials 不符合 CORS 規範）。

```python
from fastapi.middleware.cors import CORSMiddleware

# 開發環境：允許所有來源。上線前若要收緊，把 allow_origins 改成實際的前端網址
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## 6. 路由範例與 `main.py`

`routers/projects.py`（基本版五個端點；查詢公開，新增／更新／刪除需登入。專案內的實際檔案在此之上加了連結與檔案上傳／下載端點，見 6.5）：

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

`main.py`：

```python
"""FastAPI 入口：組裝應用程式、CORS、全域錯誤處理"""
import logging
import sqlite3
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from database import init_db
from routers import auth, projects

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """啟動時自動建立資料表"""
    init_db()
    yield


app = FastAPI(title="個人履歷網站 API", lifespan=lifespan)

# 開發環境：允許所有來源。token 走 Authorization header，不需要 allow_credentials
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def error_response(status_code: int, message: str, headers: dict | None = None) -> JSONResponse:
    """建立統一格式的錯誤回應"""
    return JSONResponse(
        status_code=status_code,
        content={"success": False, "data": None, "message": message},
        headers=headers,
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """HTTPException（含路由 404／405）轉成統一格式"""
    return error_response(exc.status_code, str(exc.detail), exc.headers)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Pydantic 驗證失敗轉成統一格式，回報第一個錯誤欄位"""
    first = exc.errors()[0]
    field = ".".join(str(part) for part in first["loc"] if part not in ("body", "query", "path"))
    return error_response(
        status.HTTP_422_UNPROCESSABLE_CONTENT, f"欄位「{field}」格式錯誤：{first['msg']}"
    )


@app.exception_handler(sqlite3.Error)
async def database_exception_handler(request: Request, exc: sqlite3.Error):
    """資料庫錯誤統一回 500，細節只寫進 log，不回傳給前端"""
    logger.exception("資料庫錯誤")
    return error_response(status.HTTP_500_INTERNAL_SERVER_ERROR, "資料庫發生錯誤")


app.include_router(auth.router)
app.include_router(projects.router)
```

## 6.5 檔案上傳與資料庫遷移

依賴：`python-multipart`（沒裝的話，只要有 `UploadFile` 端點，後端啟動就會失敗）。

- **一律使用 `upload_utils.save_upload()`**，不要在路由裡自己寫檔案。它會：只接受白名單副檔名、比對檔案開頭簽章（真實內容要與副檔名相符）、限制大小、用隨機檔名（`uuid4().hex` + 副檔名）儲存，失敗時刪除殘檔。
- **不信任使用者給的檔名**：磁碟檔名一律隨機；原始檔名只存資料庫當顯示用途，且先用 `sanitize_filename()` 去掉路徑。API 回應**不要**洩漏磁碟上的隨機檔名，改給下載路徑（例如 `/api/projects/{id}/file`）。
- **不接受 SVG、HTML、可執行檔**（可夾帶腳本）。目前大頭貼只收圖片（上限 2 MB），作品檔案收圖片、PDF、ZIP、Office（上限 10 MB）。
- 上傳端點用同步 `def`，參數 `file: UploadFile = File(...)`，需登入的加 `dependencies=[Depends(get_current_user)]`。
- 順序：先驗證並存檔 → 再寫資料庫（失敗要刪掉剛存的檔）→ 最後才刪舊檔。刪除資料時，資料庫刪除成功後才刪對應檔案。
- 只有需要在 `<img>` 直接引用的檔案（大頭貼）才用 `StaticFiles` 公開；其他檔案走 API 下載端點（圖片 `inline`，其餘 `attachment`）。
- `main.py` 的上傳大小 middleware **必須在 CORS middleware 之前註冊**，413 回應才會帶 CORS 標頭。
- 使用者提供的連結（`link_url`）要用 Pydantic 驗證只允許 `http` / `https`。

**資料庫欄位遷移**：`CREATE TABLE IF NOT EXISTS` 不會修改既有資料表。新增欄位時，除了改 `CREATE TABLE`，還要在 `database.py` 的 `COLUMN_MIGRATIONS` 加一筆 `ALTER TABLE ... ADD COLUMN`（欄位要有 `DEFAULT`）。`migrate_columns()` 用 `pragma_table_info` 判斷欄位是否已存在，重複執行是安全的。**不要刪除使用者的資料庫來套用新欄位。**

## 7. 新增資源

要為新資源（例如留言）建立完整 CRUD，使用 `api-crud` Skill，它會依本規範產生 model、資料表、router 並註冊。

## 8. 撰寫風格

- 每個函式、端點寫繁體中文 docstring（會顯示在 `/docs` 的 Swagger 頁面）。
- 函式參數與回傳值加型別註記。
- 變數／函式 `snake_case`、類別 `PascalCase`、常數全大寫（沿用 `CLAUDE.md` 的命名規範）。
