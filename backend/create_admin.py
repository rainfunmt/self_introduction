"""建立或重設管理者帳號

用法（在 backend/ 目錄下執行）：
    python create_admin.py 帳號

密碼會用隱藏輸入詢問，不會出現在指令列或 shell 歷史紀錄。
帳號已存在時，會把密碼重設為新輸入的密碼。
"""
import getpass
import sqlite3
import sys

from auth_utils import hash_password
from database import DB_PATH, init_db

MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_BYTES = 72  # bcrypt 只處理前 72 bytes


def validate_password(password: str) -> str | None:
    """檢查密碼是否符合規則，符合回傳 None，否則回傳錯誤訊息"""
    if len(password) < MIN_PASSWORD_LENGTH:
        return f"密碼至少 {MIN_PASSWORD_LENGTH} 個字元"
    if len(password.encode("utf-8")) > MAX_PASSWORD_BYTES:
        return f"密碼過長（上限 {MAX_PASSWORD_BYTES} bytes，中文一個字約 3 bytes）"
    return None


def create_or_update_admin(username: str, password: str) -> None:
    """寫入管理者帳號；帳號已存在就更新密碼"""
    init_db()
    conn = sqlite3.connect(DB_PATH)
    try:
        with conn:
            conn.execute(
                "INSERT INTO users (username, password_hash) VALUES (?, ?) "
                "ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash",
                (username, hash_password(password)),
            )
    finally:
        conn.close()


def main() -> int:
    username = (sys.argv[1] if len(sys.argv) > 1 else input("帳號：")).strip()
    if not username or len(username) > 50:
        print("帳號必須是 1–50 個字元")
        return 1

    password = getpass.getpass("密碼：")
    error = validate_password(password)
    if error:
        print(error)
        return 1
    if password != getpass.getpass("再輸入一次密碼："):
        print("兩次輸入的密碼不一致")
        return 1

    create_or_update_admin(username, password)
    print(f"管理者帳號「{username}」已儲存（資料庫：{DB_PATH}）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
