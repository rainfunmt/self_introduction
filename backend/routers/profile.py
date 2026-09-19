"""個人資料路由：單筆資料，前台公開讀取、後台更新，含大頭貼上傳"""
import json
import logging
import sqlite3

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from auth_utils import get_current_user
from database import get_db
from models import ApiResponse, ProfileResponse, ProfileUpdate
from upload_utils import AVATAR_DIR, IMAGE_EXTENSIONS, MAX_AVATAR_BYTES, delete_stored_file, save_upload

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/profile", tags=["profile"])

# 大頭貼以靜態檔案公開的網址前綴（在 main.py 掛載，需與這裡一致）
AVATAR_URL_PREFIX = "/uploads/avatars"


def get_profile_row_or_404(db: sqlite3.Connection) -> sqlite3.Row:
    """查詢個人資料的原始資料列，不存在就丟 404"""
    try:
        row = db.execute(
            "SELECT display_name, job_title, location, bio, skills, avatar, updated_at "
            "FROM profile WHERE id = 1"
        ).fetchone()
    except sqlite3.Error:
        logger.exception("查詢個人資料失敗")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "查詢個人資料失敗")
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "尚未建立個人資料")
    return row


def to_profile(row: sqlite3.Row) -> dict:
    """資料列轉成 API 回傳格式：skills 從 JSON 文字轉回陣列，avatar 轉成可用的網址"""
    profile = dict(row)
    try:
        profile["skills"] = json.loads(profile["skills"])
    except ValueError:
        # 資料損毀時不讓整個 API 壞掉，技能標籤回傳空陣列
        logger.warning("個人資料的 skills 不是有效的 JSON")
        profile["skills"] = []
    avatar = profile.pop("avatar")
    profile["avatar_url"] = f"{AVATAR_URL_PREFIX}/{avatar}" if avatar else ""
    return profile


def get_profile_or_404(db: sqlite3.Connection) -> dict:
    """查詢個人資料（API 格式）"""
    return to_profile(get_profile_row_or_404(db))


@router.get("", response_model=ApiResponse[ProfileResponse])
def read_profile(db: sqlite3.Connection = Depends(get_db)):
    """查詢個人資料（公開，前台名片頁使用）"""
    return {"success": True, "data": get_profile_or_404(db), "message": "查詢成功"}


@router.put(
    "",
    response_model=ApiResponse[ProfileResponse],
    dependencies=[Depends(get_current_user)],
)
def update_profile(payload: ProfileUpdate, db: sqlite3.Connection = Depends(get_db)):
    """更新個人資料的文字欄位（需登入）；不會動到大頭貼"""
    get_profile_row_or_404(db)  # 先確認資料存在
    try:
        with db:
            db.execute(
                "UPDATE profile SET display_name = ?, job_title = ?, location = ?, bio = ?, "
                "skills = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
                (
                    payload.display_name,
                    payload.job_title,
                    payload.location,
                    payload.bio,
                    json.dumps(payload.skills, ensure_ascii=False),
                ),
            )
    except sqlite3.Error:
        logger.exception("更新個人資料失敗")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "更新個人資料失敗")
    return {"success": True, "data": get_profile_or_404(db), "message": "更新成功"}


@router.post(
    "/avatar",
    response_model=ApiResponse[ProfileResponse],
    dependencies=[Depends(get_current_user)],
)
def upload_avatar(file: UploadFile = File(...), db: sqlite3.Connection = Depends(get_db)):
    """上傳（或更換）大頭貼（需登入）：只接受圖片，上限 2 MB"""
    old_avatar = get_profile_row_or_404(db)["avatar"]
    saved = save_upload(file, AVATAR_DIR, IMAGE_EXTENSIONS, MAX_AVATAR_BYTES)
    try:
        with db:
            db.execute(
                "UPDATE profile SET avatar = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
                (saved.stored_name,),
            )
    except sqlite3.Error:
        # 資料庫寫入失敗：把剛存好的檔案刪掉，避免留下沒人管的檔案
        delete_stored_file(AVATAR_DIR, saved.stored_name)
        logger.exception("儲存大頭貼失敗")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "上傳大頭貼失敗")
    delete_stored_file(AVATAR_DIR, old_avatar)  # 更換時刪掉舊檔
    return {"success": True, "data": get_profile_or_404(db), "message": "大頭貼已更新"}


@router.delete(
    "/avatar",
    response_model=ApiResponse[ProfileResponse],
    dependencies=[Depends(get_current_user)],
)
def delete_avatar(db: sqlite3.Connection = Depends(get_db)):
    """移除大頭貼（需登入），前台名片會改回顯示姓名首字"""
    old_avatar = get_profile_row_or_404(db)["avatar"]
    try:
        with db:
            db.execute("UPDATE profile SET avatar = '', updated_at = CURRENT_TIMESTAMP WHERE id = 1")
    except sqlite3.Error:
        logger.exception("移除大頭貼失敗")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "移除大頭貼失敗")
    delete_stored_file(AVATAR_DIR, old_avatar)
    return {"success": True, "data": get_profile_or_404(db), "message": "大頭貼已移除"}
