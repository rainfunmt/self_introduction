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

## 隱私

聯絡表單會收集訪客的姓名、Email 與留言，只存放在本網站的資料庫、只用於回覆留言，頁面上已附隱私權說明（`frontend/contact.html`）。正式上線時，請確認說明內容與實際的保存期間、刪除方式一致。

## AI 協作說明

本專案在開發過程中使用 AI 工具（Anthropic 的 Claude Code）協助：
- `CLAUDE.md` 與 `.claude/`（rules、skills）是提供給 AI 的開發規範，保留在 repo 中，說明程式碼遵循的寫法。
- 2026-10-25 的安全性與隱私修正由 Claude Code 協助完成，經作者審閱後才推送，包括：
  - 移除曾被上傳的資料庫與暫存檔，並把 commit 改用 GitHub 匿名 Email。
  - 移除寫死的 JWT 預設密鑰。
  - 補上 `.gitignore`。
  - 補上聯絡表單的隱私權說明。
