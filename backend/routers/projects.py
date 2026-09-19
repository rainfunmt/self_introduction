"""作品集路由：CRUD、連結、檔案上傳與下載"""
import logging
import mimetypes
import sqlite3
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from auth_utils import get_current_user
from database import get_db
from models import ApiResponse, ProjectCreate, ProjectResponse
from upload_utils import (
    IMAGE_EXTENSIONS,
    MAX_PROJECT_FILE_BYTES,
    PROJECT_FILE_DIR,
    PROJECT_FILE_EXTENSIONS,
    delete_stored_file,
    save_upload,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/projects", tags=["projects"])


def to_project(row: sqlite3.Row) -> dict:
    """資料列轉成 API 回傳格式：不外洩磁碟上的隨機檔名，改給下載路徑"""
    project = dict(row)
    stored_name = project.pop("file_stored")
    project["file_url"] = f"/api/projects/{project['id']}/file" if stored_name else ""
    return project


def get_project_row_or_404(db: sqlite3.Connection, project_id: int) -> sqlite3.Row:
    """查詢單一專案的原始資料列（含 file_stored），不存在就丟 404"""
    try:
        row = db.execute(
            "SELECT id, title, description, link_url, file_name, file_stored, file_size, created_at "
            "FROM projects WHERE id = ?",
            (project_id,),
        ).fetchone()
    except sqlite3.Error:
        logger.exception("查詢專案失敗")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "查詢專案失敗")
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "找不到指定的專案")
    return row


def get_project_or_404(db: sqlite3.Connection, project_id: int) -> dict:
    """查詢單一專案，不存在就丟 404"""
    return to_project(get_project_row_or_404(db, project_id))


@router.get("", response_model=ApiResponse[list[ProjectResponse]])
def list_projects(db: sqlite3.Connection = Depends(get_db)):
    """查詢所有專案（公開）"""
    try:
        rows = db.execute(
            "SELECT id, title, description, link_url, file_name, file_stored, file_size, created_at "
            "FROM projects ORDER BY id DESC"
        ).fetchall()
    except sqlite3.Error:
        logger.exception("查詢專案列表失敗")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "查詢專案列表失敗")
    return {"success": True, "data": [to_project(r) for r in rows], "message": "查詢成功"}


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
    """新增專案（需登入）；檔案另外用 POST /{id}/file 上傳"""
    try:
        with db:  # 成功自動 commit，發生例外自動 rollback
            cursor = db.execute(
                "INSERT INTO projects (title, description, link_url) VALUES (?, ?, ?)",
                (payload.title, payload.description, payload.link_url),
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
    """更新專案的文字與連結（需登入）；不會動到已上傳的檔案"""
    get_project_row_or_404(db, project_id)  # 先確認存在，不存在會回 404
    try:
        with db:
            db.execute(
                "UPDATE projects SET title = ?, description = ?, link_url = ? WHERE id = ?",
                (payload.title, payload.description, payload.link_url, project_id),
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
    """刪除專案，連同已上傳的檔案一起刪除（需登入）"""
    row = get_project_row_or_404(db, project_id)
    try:
        with db:
            db.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    except sqlite3.Error:
        logger.exception("刪除專案失敗")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "刪除專案失敗")
    # 資料庫刪除成功後才刪檔案，避免資料還在但檔案不見
    delete_stored_file(PROJECT_FILE_DIR, row["file_stored"])
    return {"success": True, "data": None, "message": "刪除成功"}


@router.post(
    "/{project_id}/file",
    response_model=ApiResponse[ProjectResponse],
    dependencies=[Depends(get_current_user)],
)
def upload_project_file(
    project_id: int,
    file: UploadFile = File(...),
    db: sqlite3.Connection = Depends(get_db),
):
    """上傳（或取代）作品檔案（需登入）；一個作品只保留一個檔案"""
    row = get_project_row_or_404(db, project_id)
    saved = save_upload(file, PROJECT_FILE_DIR, PROJECT_FILE_EXTENSIONS, MAX_PROJECT_FILE_BYTES)
    try:
        with db:
            db.execute(
                "UPDATE projects SET file_name = ?, file_stored = ?, file_size = ? WHERE id = ?",
                (saved.original_name, saved.stored_name, saved.size, project_id),
            )
    except sqlite3.Error:
        # 資料庫寫入失敗：把剛存好的檔案刪掉，避免留下沒人管的檔案
        delete_stored_file(PROJECT_FILE_DIR, saved.stored_name)
        logger.exception("儲存作品檔案資訊失敗")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "上傳檔案失敗")
    delete_stored_file(PROJECT_FILE_DIR, row["file_stored"])  # 取代時刪掉舊檔
    return {"success": True, "data": get_project_or_404(db, project_id), "message": "檔案上傳成功"}


@router.delete(
    "/{project_id}/file",
    response_model=ApiResponse[ProjectResponse],
    dependencies=[Depends(get_current_user)],
)
def delete_project_file(project_id: int, db: sqlite3.Connection = Depends(get_db)):
    """移除作品的檔案，保留作品本身（需登入）"""
    row = get_project_row_or_404(db, project_id)
    if not row["file_stored"]:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "這個作品沒有上傳檔案")
    try:
        with db:
            db.execute(
                "UPDATE projects SET file_name = '', file_stored = '', file_size = 0 WHERE id = ?",
                (project_id,),
            )
    except sqlite3.Error:
        logger.exception("移除作品檔案失敗")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "移除檔案失敗")
    delete_stored_file(PROJECT_FILE_DIR, row["file_stored"])
    return {"success": True, "data": get_project_or_404(db, project_id), "message": "檔案已移除"}


@router.get("/{project_id}/file")
def download_project_file(project_id: int, db: sqlite3.Connection = Depends(get_db)):
    """下載作品檔案（公開）；圖片直接在瀏覽器顯示，其他類型一律當成附件下載"""
    row = get_project_row_or_404(db, project_id)
    if not row["file_stored"]:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "這個作品沒有上傳檔案")

    path = PROJECT_FILE_DIR / row["file_stored"]
    if not path.is_file():
        logger.error("資料庫有記錄但檔案不存在：%s", path)
        raise HTTPException(status.HTTP_404_NOT_FOUND, "找不到檔案，可能已被移除")

    is_image = Path(row["file_stored"]).suffix.lower() in IMAGE_EXTENSIONS
    return FileResponse(
        path,
        filename=row["file_name"],
        media_type=mimetypes.guess_type(row["file_stored"])[0] or "application/octet-stream",
        content_disposition_type="inline" if is_image else "attachment",
    )
