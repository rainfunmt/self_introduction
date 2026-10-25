# self_introduction
個人檔案

個人履歷網站：FastAPI 後端 + 靜態前端，含後台管理（個人資料、作品、訪客留言）。

## 本機啟動
1. 安裝 Python 3.11 以上。
2. 雙擊 `start-dev.bat`：會自動安裝套件、啟動後端（port 8000）與前端（port 5500），並打開後台登入頁。
3. **第一次使用**要先建立管理者帳號（在 `backend/` 資料夾執行，密碼會隱藏輸入）：
   ```
   python create_admin.py 你的帳號
   ```

資料庫 `backend/portfolio.db` 會在第一次啟動時自動建立。它存有管理者密碼雜湊與訪客留言，已列入 `.gitignore`，**不會也不應該上傳到 GitHub**。

## 環境變數
| 名稱 | 用途 | 沒設定時 |
|---|---|---|
| `JWT_SECRET_KEY` | 登入憑證的簽章密鑰，至少 32 bytes | 每次啟動隨機產生（只適合本機開發，重新啟動後要重新登入） |
| `PORTFOLIO_DB_PATH` | 資料庫檔案位置 | `backend/portfolio.db` |

正式上線前務必設定 `JWT_SECRET_KEY`，可用以下指令產生一組：
```
python -c "import secrets; print(secrets.token_urlsafe(48))"
```
