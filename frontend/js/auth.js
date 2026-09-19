import { LOGIN_PAGE, TOKEN_KEY } from './config.js';
import { apiRequest } from './api.js';

// 取得目前儲存的 token（沒有則回傳 null）
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

// 登入成功後儲存 token
export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

// 是否已登入（僅檢查 token 存在；是否有效由後端驗證）
export function isLoggedIn() {
  return Boolean(getToken());
}

// 登出：清除 token 並導向登入頁
export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  window.location.replace(LOGIN_PAGE);
}

// 頁面載入時呼叫：未登入就導向登入頁，回傳是否已登入
export function requireAuth() {
  if (isLoggedIn()) return true;
  window.location.replace(LOGIN_PAGE);
  return false;
}

/**
 * 需要登入的 API 呼叫（後台專用），行為與 apiRequest 相同並回傳 data
 * 沒有 token 時直接導向登入頁，不會送出請求
 */
export async function authFetch(path, options = {}) {
  if (!requireAuth()) throw new Error('請先登入');
  return apiRequest(path, options);
}
