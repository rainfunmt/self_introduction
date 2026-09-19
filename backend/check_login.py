"""檢查帳號密碼是否正確（不需要啟動伺服器），用來排查「無法登入」

用法（在 backend/ 目錄下執行）：
    python check_login.py 帳號

會顯示資料庫裡有哪些帳號、你輸入的密碼長度，以及密碼是否比對成功。
"""
import getpass
import sqlite3
import sys

from auth_utils import verify_password
from database import DB_PATH


def main() -> int:
    username = (sys.argv[1] if len(sys.argv) > 1 else input("帳號：")).strip()

    conn = sqlite3.connect(DB_PATH)
    try:
        usernames = [row[0] for row in conn.execute("SELECT username FROM users ORDER BY id")]
        row = conn.execute("SELECT password_hash FROM users WHERE username = ?", (username,)).fetchone()
    finally:
        conn.close()

    print(f"資料庫：{DB_PATH}")
    print(f"資料庫中的帳號：{usernames if usernames else '（沒有任何帳號）'}")
    if row is None:
        print(f"找不到帳號「{username}」，請確認大小寫與拼字，或用 create_admin.py 建立")
        return 1

    password = getpass.getpass("密碼：")
    print(f"你輸入了 {len(password)} 個字元", end="")
    if any(ord(char) > 127 for char in password):
        print("，其中含有非半形英數的字元（中文輸入法或全形字元？）")
    else:
        print("，全部是半形字元")

    if verify_password(password, row[0]):
        print("結果：密碼正確，可以登入")
        return 0
    print("結果：密碼不符，請用 create_admin.py 重設密碼")
    return 1


if __name__ == "__main__":
    sys.exit(main())
