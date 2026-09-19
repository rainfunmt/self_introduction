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
