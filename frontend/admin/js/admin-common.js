import { logout } from '/js/auth.js';

/**
 * 初始化後台版面：側邊欄開關、目前頁面高亮、登出，最後顯示頁面
 * 必須在登入檢查通過後呼叫
 */
export function initAdminLayout() {
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebar-toggle');

  // 手機版側邊欄開關（桌面版由 md:flex 固定顯示，不受影響）
  function setSidebarOpen(isOpen) {
    sidebar.classList.toggle('hidden', !isOpen);
    sidebar.classList.toggle('flex', isOpen);
    sidebarToggle.setAttribute('aria-expanded', String(isOpen));
  }
  sidebarToggle.addEventListener('click', () => {
    setSidebarOpen(sidebarToggle.getAttribute('aria-expanded') !== 'true');
  });
  // 點擊主內容區或按下 Esc 時收合
  document.getElementById('admin-main').addEventListener('click', () => setSidebarOpen(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setSidebarOpen(false);
  });

  // 目前頁面高亮：比對檔名並標記 aria-current="page"
  const currentFile = window.location.pathname.split('/').pop();
  document.querySelectorAll('.sidebar-link[href]').forEach((link) => {
    if (new URL(link.href).pathname.split('/').pop() === currentFile) {
      link.setAttribute('aria-current', 'page');
    }
  });

  // 登出：清除 token 並回到登入頁
  document.getElementById('logout-button').addEventListener('click', logout);

  // 登入檢查已通過，顯示頁面
  document.body.classList.remove('invisible');
}

/**
 * 顯示 Toast 通知，3.5 秒後自動消失
 * @param {string} message - 通知文字
 * @param {'success'|'error'} type - 成功（綠）或失敗（紅）
 */
export function showToast(message, type = 'success') {
  // 第一次呼叫時建立容器
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed right-4 top-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const colorClass = type === 'error'
    ? 'border-red-300/50 text-red-300'
    : 'border-emerald-300/50 text-emerald-300';
  toast.className = `toast-message rounded-lg border bg-roast px-4 py-3 text-sm shadow-lg shadow-black/40 ${colorClass}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

/**
 * 開啟確認對話框，回傳使用者是否按下「確定」
 * @param {string} message - 要顯示的確認訊息
 * @returns {Promise<boolean>}
 */
export function confirmAction(message) {
  const dialog = document.getElementById('confirm-dialog');
  dialog.querySelector('[data-confirm-message]').textContent = message;
  // 先清空上次的結果，避免按 Esc 關閉時沿用舊值
  dialog.returnValue = '';
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true });
    dialog.showModal();
  });
}

// 清除表單內所有欄位錯誤
export function clearFieldErrors(form) {
  form.querySelectorAll('[data-error-for]').forEach((element) => {
    element.textContent = '';
    element.classList.add('hidden');
  });
  form.querySelectorAll('[aria-invalid]').forEach((input) => input.removeAttribute('aria-invalid'));
}

// 在指定欄位下方顯示錯誤訊息
export function setFieldError(form, fieldName, message) {
  const errorElement = form.querySelector(`[data-error-for="${fieldName}"]`);
  errorElement.textContent = message;
  errorElement.classList.remove('hidden');
  form.querySelector(`[name="${fieldName}"]`).setAttribute('aria-invalid', 'true');
}

// 把後端的 UTC 時間字串（例如 2026-09-19 12:24:32）轉成本地時間顯示
export function formatDateTime(utcText) {
  const date = new Date(`${utcText.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? utcText : date.toLocaleString('zh-TW', { hour12: false });
}

// 檔案大小格式化與前台共用同一份實作，後台頁面仍可從這裡匯入
export { formatFileSize } from '/js/format.js';

/**
 * 上傳前先在前端檢查檔案（規則需與後端 backend/upload_utils.py 一致；後端仍會再驗證一次）
 * @param {File} file - 使用者選的檔案
 * @param {string[]} extensions - 允許的副檔名（小寫，含點），例如 ['.png', '.jpg']
 * @param {number} maxBytes - 大小上限（位元組）
 * @returns {string} 錯誤訊息；通過檢查回傳空字串
 */
export function validateUploadFile(file, extensions, maxBytes) {
  const dotIndex = file.name.lastIndexOf('.');
  const extension = dotIndex >= 0 ? file.name.slice(dotIndex).toLowerCase() : '';
  if (!extensions.includes(extension)) return `不支援的檔案類型，只接受：${extensions.join('、')}`;
  if (file.size === 0) return '檔案是空的';
  if (file.size > maxBytes) return `檔案太大，上限為 ${Math.floor(maxBytes / (1024 * 1024))} MB`;
  return '';
}
