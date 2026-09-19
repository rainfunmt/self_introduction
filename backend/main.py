"""FastAPI 入口：組裝應用程式、CORS、全域錯誤處理"""
import logging
import sqlite3
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from database import init_db
from routers import auth, messages, profile, projects
from routers.profile import AVATAR_URL_PREFIX
from upload_utils import AVATAR_DIR, MAX_AVATAR_BYTES, MAX_PROJECT_FILE_BYTES, PROJECT_FILE_DIR

logger = logging.getLogger(__name__)

# multipart 表單本身的額外開銷（邊界字串、欄位標頭），計算請求大小上限時要加上
MULTIPART_OVERHEAD_BYTES = 64 * 1024


@asynccontextmanager
async def lifespan(app: FastAPI):
    """啟動時自動建立資料表"""
    init_db()
    yield


app = FastAPI(title="個人履歷網站 API", lifespan=lifespan)


@app.middleware("http")
async def limit_upload_size(request: Request, call_next):
    """上傳請求的 Content-Length 超過上限就直接拒絕，不用等整個檔案傳完

    必須在 CORS middleware 之前註冊（CORS 才會在最外層），這樣 413 回應才帶有 CORS 標頭，
    瀏覽器才讀得到錯誤訊息，而不是誤報成 CORS 錯誤。
    """
    path = request.url.path
    if request.method == "POST" and path.endswith(("/avatar", "/file")):
        limit = MAX_AVATAR_BYTES if path.endswith("/avatar") else MAX_PROJECT_FILE_BYTES
        length = request.headers.get("content-length", "")
        if length.isdigit() and int(length) > limit + MULTIPART_OVERHEAD_BYTES:
            return error_response(
                status.HTTP_413_CONTENT_TOO_LARGE, f"檔案太大，上限為 {limit // (1024 * 1024)} MB"
            )
    return await call_next(request)


# 開發環境：允許所有來源。token 走 Authorization header，不需要 allow_credentials
# 上線前若要收緊，把 allow_origins 改成實際的前端網址
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
app.include_router(profile.router)
app.include_router(projects.router)
app.include_router(messages.router)

# 大頭貼以靜態檔案公開（檔名是隨機的，前台 <img> 直接引用）
# 作品檔案不掛載，只能透過 GET /api/projects/{id}/file 下載
AVATAR_DIR.mkdir(parents=True, exist_ok=True)
PROJECT_FILE_DIR.mkdir(parents=True, exist_ok=True)
app.mount(AVATAR_URL_PREFIX, StaticFiles(directory=AVATAR_DIR), name="avatars")
