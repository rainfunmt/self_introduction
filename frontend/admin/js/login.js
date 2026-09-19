import { apiRequest } from '/js/api.js';
import { isLoggedIn, setToken } from '/js/auth.js';

// 告訴 login.html 的保護機制：頁面程式已成功載入（import 失敗時這行不會執行）
window.loginPageReady = true;

// 登入成功後的預設頁面
const DASHBOARD_PAGE = '/admin/dashboard.html';

const form = document.getElementById('login-form');
const errorText = document.getElementById('login-error');
const submitButton = document.getElementById('login-submit');

// 顯示登入錯誤訊息
function showError(message) {
  errorText.textContent = message;
  errorText.classList.remove('hidden');
}

// 已登入的人直接進後台
if (isLoggedIn()) {
  window.location.replace(DASHBOARD_PAGE);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorText.classList.add('hidden');

  const { username, password } = Object.fromEntries(new FormData(form));
  if (!username.trim() || !password) {
    showError('請輸入帳號與密碼');
    return;
  }

  submitButton.disabled = true;
  try {
    // redirectOn401: false → 帳號或密碼錯誤時顯示訊息，而不是被導回登入頁
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: { username: username.trim(), password },
      redirectOn401: false,
    });
    setToken(data.access_token);
    window.location.replace(DASHBOARD_PAGE);
  } catch (error) {
    showError(error.message);
  } finally {
    submitButton.disabled = false;
  }
});
