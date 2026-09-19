"""認證工具：密碼雜湊、JWT 簽發與驗證"""
import os
import sqlite3
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.context import CryptContext

from database import get_db

# 密鑰從環境變數讀取；預設值只供開發，且需 ≥ 32 bytes
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-only-secret-key-change-in-production-0123456789")
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
