// API 基底網址（後端 FastAPI 服務）
export const API_BASE_URL = 'http://localhost:8000/api';

// 後端網站根網址：大頭貼等上傳檔案是由後端提供，路徑（例如 /uploads/avatars/x.png）要接在這後面
export const API_ORIGIN = new URL(API_BASE_URL).origin;

// localStorage 中儲存登入 token 的 key
export const TOKEN_KEY = 'portfolio_token';

// 後台登入頁（以 frontend/ 為網站根目錄）
export const LOGIN_PAGE = '/admin/login.html';
