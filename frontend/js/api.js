import { API_BASE_URL, API_ORIGIN, LOGIN_PAGE, TOKEN_KEY } from './config.js';

// 呼叫到後端不存在的功能時顯示的訊息（最常見原因：舊的後端視窗還開著，跑的是舊版程式）
const OUTDATED_BACKEND_MESSAGE = '伺服器沒有這個功能，後端很可能還是舊版：請關閉所有舊的「Backend API」視窗，再重新執行 start-dev.bat。';

/**
 * 把後端回傳的相對路徑（例如 /uploads/avatars/x.png、/api/projects/1/file）轉成完整網址
 * 沒有路徑（空字串）時回傳空字串
 */
export function buildAssetUrl(path) {
  return path ? `${API_ORIGIN}${path}` : '';
}

/**
 * 呼叫後端 API 並回傳 data 欄位
 * 後端統一格式：{ success, data, message }
 * @param {string} path - 相對於 API_BASE_URL 的路徑，例如 '/projects'
 * @param {object} options
 * @param {object|FormData} options.body - 一般物件會轉成 JSON；FormData（檔案上傳）直接送出
 * @param {boolean} options.redirectOn401 - 收到 401 時是否清除 token 並導回登入頁（登入請求要設為 false）
 * @throws {Error} 請求失敗時，message 為可直接顯示給使用者的訊息
 */
export async function apiRequest(path, { method = 'GET', body, redirectOn401 = true } = {}) {
  // FormData 由瀏覽器自己帶 multipart 的 Content-Type（含邊界字串），不能手動指定
  const isFormData = body instanceof FormData;
  const headers = isFormData ? {} : { 'Content-Type': 'application/json' };

  // 有 token 就帶上 Authorization header
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
    });
  } catch {
    // 網路中斷、後端未啟動
    throw new Error('無法連線到伺服器，請稍後再試');
  }

  // 204 無回傳內容
  if (response.status === 204) return null;

  const result = await response.json().catch(() => null);

  // 401：token 失效，清除並導回登入頁
  // 登入請求本身回 401 代表「帳號或密碼錯誤」，要顯示訊息而不是導頁，所以呼叫時傳 redirectOn401: false
  if (response.status === 401 && redirectOn401) {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = LOGIN_PAGE;
    throw new Error('登入已失效，請重新登入');
  }

  if (!response.ok || !result?.success) {
    // 路由不存在（FastAPI 預設訊息為 Not Found / Method Not Allowed，我們自己的 404 都是中文訊息）：
    // 通常是後端還在跑舊版程式，沒有這個功能
    const isMissingRoute = (response.status === 404 && result?.message === 'Not Found')
      || (response.status === 405 && result?.message === 'Method Not Allowed');
    if (isMissingRoute) throw new Error(OUTDATED_BACKEND_MESSAGE);
    throw new Error(result?.message ?? '發生未知錯誤');
  }
  return result.data;
}
