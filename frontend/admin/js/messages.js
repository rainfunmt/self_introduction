import { authFetch, requireAuth } from '/js/auth.js';
import { confirmAction, formatDateTime, initAdminLayout, showToast } from './admin-common.js';

// 對應後端 /api/messages（API_BASE_URL 已含 /api）
const RESOURCE_PATH = '/messages';

const tableBody = document.getElementById('message-table-body');

// 目前載入的資料；刪除時用 id 找回整筆資料
let messages = [];

// 在表格顯示單列訊息（載入中、無資料、載入失敗）
function renderMessageRow(text) {
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = 5;
  cell.className = 'px-4 py-8 text-center text-mist-rose';
  cell.textContent = text;
  row.appendChild(cell);
  tableBody.replaceChildren(row);
}

// 建立文字儲存格；一律用 textContent，避免留言內容造成 XSS
function createTextCell(text, className = 'px-4 py-3') {
  const cell = document.createElement('td');
  cell.className = className;
  cell.textContent = text;
  return cell;
}

// 建立 Email 儲存格：mailto 連結，網址前綴固定，內容以 DOM 屬性設定
function createEmailCell(email) {
  const cell = document.createElement('td');
  cell.className = 'px-4 py-3';
  const link = document.createElement('a');
  link.href = `mailto:${email}`;
  link.className = 'text-rose-smoke transition-colors duration-150 hover:underline';
  link.textContent = email;
  cell.appendChild(link);
  return cell;
}

// 依 messages 陣列渲染表格
function renderMessages() {
  if (messages.length === 0) {
    renderMessageRow('目前沒有留言');
    return;
  }

  const rows = messages.map((message) => {
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'btn-danger';
    deleteButton.textContent = '刪除';
    deleteButton.dataset.action = 'delete';
    deleteButton.dataset.id = String(message.id);

    const actionCell = document.createElement('td');
    actionCell.className = 'px-4 py-3 text-right';
    actionCell.appendChild(deleteButton);

    const row = document.createElement('tr');
    row.className = 'transition-colors duration-150 hover:bg-roast-light/40';
    row.append(
      createTextCell(formatDateTime(message.created_at), 'whitespace-nowrap px-4 py-3'),
      createTextCell(message.name, 'px-4 py-3 font-medium'),
      createEmailCell(message.email),
      createTextCell(message.content, 'max-w-md whitespace-pre-wrap break-words px-4 py-3'),
      actionCell,
    );
    return row;
  });
  tableBody.replaceChildren(...rows);
}

// 從後端載入留言並渲染；刪除成功後也呼叫它來刷新列表
async function loadMessages() {
  renderMessageRow('載入中…');
  try {
    messages = await authFetch(RESOURCE_PATH);
    renderMessages();
  } catch (error) {
    renderMessageRow(`載入失敗：${error.message}`);
    showToast(error.message, 'error');
  }
}

// 確認後刪除，成功就刷新列表
async function deleteMessage(message) {
  const confirmed = await confirmAction(`確定要刪除 ${message.name} 的留言嗎？此操作無法復原。`);
  if (!confirmed) return;

  try {
    await authFetch(`${RESOURCE_PATH}/${message.id}`, { method: 'DELETE' });
    showToast('刪除成功');
    await loadMessages();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// 事件代理：處理表格內的刪除按鈕
tableBody.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action="delete"]');
  if (!button) return;

  const message = messages.find((item) => item.id === Number(button.dataset.id));
  if (message) deleteMessage(message);
});

// 頁面初始化：綁定按鈕並載入資料
function initMessagePage() {
  initAdminLayout();
  document.getElementById('refresh-button').addEventListener('click', loadMessages);
  loadMessages();
}

// 未登入就導向登入頁，不執行頁面程式
if (requireAuth()) {
  initMessagePage();
}
