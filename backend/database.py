"""資料庫連線與初始化"""
import json
import os
import sqlite3
from pathlib import Path

# 資料庫預設放在 backend/portfolio.db（已列入 .gitignore，不會被 commit）；
# 可用環境變數 PORTFOLIO_DB_PATH 改放到專案資料夾以外
DB_PATH = Path(os.getenv("PORTFOLIO_DB_PATH") or Path(__file__).resolve().parent / "portfolio.db")

# 個人資料的預設內容（第一次啟動時寫入，之後在後台修改）
DEFAULT_PROFILE = {
    "display_name": "你的名字",
    "job_title": "前端工程師",
    "location": "台灣",
    "bio": "用兩三句話介紹你自己：你做什麼、擅長什麼、想做出什麼樣的作品。",
    "skills": ["HTML / CSS", "JavaScript", "Tailwind CSS", "GSAP", "Python", "FastAPI"],
}

# 既有資料庫的欄位遷移：(資料表, 欄位, 新增欄位的 SQL)
# CREATE TABLE IF NOT EXISTS 不會修改已存在的資料表，所以新欄位要在這裡補上
COLUMN_MIGRATIONS = [
    ("profile", "avatar", "ALTER TABLE profile ADD COLUMN avatar TEXT NOT NULL DEFAULT ''"),
    ("projects", "link_url", "ALTER TABLE projects ADD COLUMN link_url TEXT NOT NULL DEFAULT ''"),
    ("projects", "file_name", "ALTER TABLE projects ADD COLUMN file_name TEXT NOT NULL DEFAULT ''"),
    ("projects", "file_stored", "ALTER TABLE projects ADD COLUMN file_stored TEXT NOT NULL DEFAULT ''"),
    ("projects", "file_size", "ALTER TABLE projects ADD COLUMN file_size INTEGER NOT NULL DEFAULT 0"),
]


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


def migrate_columns(conn: sqlite3.Connection) -> None:
    """補上舊資料庫缺少的欄位（已存在的欄位會略過，重複執行是安全的）"""
    for table, column, alter_sql in COLUMN_MIGRATIONS:
        existing = {row[0] for row in conn.execute("SELECT name FROM pragma_table_info(?)", (table,))}
        if column not in existing:
            conn.execute(alter_sql)


def init_db():
    """啟動時自動建立資料表（已存在則略過）、補上新欄位，並寫入預設個人資料"""
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

            -- 作品可以有一個連結（link_url）與一個上傳的檔案
            -- file_name 是顯示用的原始檔名，file_stored 是磁碟上的隨機檔名（不對外公開）
            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                link_url TEXT NOT NULL DEFAULT '',
                file_name TEXT NOT NULL DEFAULT '',
                file_stored TEXT NOT NULL DEFAULT '',
                file_size INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            -- 個人資料是單筆資料：id 固定為 1，skills 以 JSON 陣列文字儲存
            -- avatar 是大頭貼在磁碟上的隨機檔名（空字串代表沒有大頭貼）
            CREATE TABLE IF NOT EXISTS profile (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                display_name TEXT NOT NULL,
                job_title TEXT NOT NULL,
                location TEXT NOT NULL DEFAULT '',
                bio TEXT NOT NULL DEFAULT '',
                skills TEXT NOT NULL DEFAULT '[]',
                avatar TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        migrate_columns(conn)
        # 第一次啟動才寫入預設資料；已存在就不覆蓋後台修改過的內容
        conn.execute(
            "INSERT OR IGNORE INTO profile (id, display_name, job_title, location, bio, skills) "
            "VALUES (1, ?, ?, ?, ?, ?)",
            (
                DEFAULT_PROFILE["display_name"],
                DEFAULT_PROFILE["job_title"],
                DEFAULT_PROFILE["location"],
                DEFAULT_PROFILE["bio"],
                json.dumps(DEFAULT_PROFILE["skills"], ensure_ascii=False),
            ),
        )
        conn.commit()
    finally:
        conn.close()
