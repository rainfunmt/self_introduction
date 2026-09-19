"""留言路由：訪客可送出留言，後台查看與刪除"""
import logging
import sqlite3

from fastapi import APIRouter, Depends, HTTPException, status

from auth_utils import get_current_user
from database import get_db
from models import ApiResponse, MessageCreate, MessageResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/messages", tags=["messages"])


def get_message_or_404(db: sqlite3.Connection, message_id: int) -> dict:
    """查詢單一留言，不存在就丟 404"""
    try:
        row = db.execute(
            "SELECT id, name, email, content, created_at FROM messages WHERE id = ?",
            (message_id,),
        ).fetchone()
    except sqlite3.Error:
        logger.exception("查詢留言失敗")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "查詢留言失敗")
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "找不到指定的留言")
    return dict(row)


# 訪客要能留言，所以新增（POST）公開；查看與刪除只有管理者可以（欄位長度限制在 MessageCreate）
@router.post("", response_model=ApiResponse[None], status_code=status.HTTP_201_CREATED)
def create_message(payload: MessageCreate, db: sqlite3.Connection = Depends(get_db)):
    """訪客送出留言（公開）；不回傳留言內容，避免被拿來當作資料回顯"""
    try:
        with db:
            db.execute(
                "INSERT INTO messages (name, email, content) VALUES (?, ?, ?)",
                (payload.name, payload.email, payload.content),
            )
    except sqlite3.Error:
        logger.exception("新增留言失敗")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "送出留言失敗")
    return {"success": True, "data": None, "message": "留言已送出，謝謝你！"}


@router.get(
    "",
    response_model=ApiResponse[list[MessageResponse]],
    dependencies=[Depends(get_current_user)],
)
def list_messages(db: sqlite3.Connection = Depends(get_db)):
    """查詢所有留言（需登入）"""
    try:
        rows = db.execute(
            "SELECT id, name, email, content, created_at FROM messages ORDER BY id DESC"
        ).fetchall()
    except sqlite3.Error:
        logger.exception("查詢留言列表失敗")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "查詢留言列表失敗")
    return {"success": True, "data": [dict(r) for r in rows], "message": "查詢成功"}


@router.get(
    "/{message_id}",
    response_model=ApiResponse[MessageResponse],
    dependencies=[Depends(get_current_user)],
)
def get_message(message_id: int, db: sqlite3.Connection = Depends(get_db)):
    """查詢單一留言（需登入）"""
    return {"success": True, "data": get_message_or_404(db, message_id), "message": "查詢成功"}


@router.delete(
    "/{message_id}",
    response_model=ApiResponse[None],
    dependencies=[Depends(get_current_user)],
)
def delete_message(message_id: int, db: sqlite3.Connection = Depends(get_db)):
    """刪除留言（需登入）"""
    get_message_or_404(db, message_id)
    try:
        with db:
            db.execute("DELETE FROM messages WHERE id = ?", (message_id,))
    except sqlite3.Error:
        logger.exception("刪除留言失敗")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "刪除留言失敗")
    return {"success": True, "data": None, "message": "刪除成功"}
