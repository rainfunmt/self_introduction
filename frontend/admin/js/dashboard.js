import { authFetch, requireAuth } from '/js/auth.js';
import { formatDateTime, initAdminLayout, showToast } from './admin-common.js';

// 最近留言最多顯示幾筆
const RECENT_LIMIT = 5;

const recentList = document.getElementById('recent-messages');

// 把文字放進指定元素
function setText(id, text) {
  document.getElementById(id).textContent = text;
}

// 在最近留言區顯示單行訊息（無資料、載入失敗）
function renderRecentMessage(text) {
  const item = document.createElement('li');
  item.className = 'py-4 text-sm text-mist-rose';
  item.textContent = text;
  recentList.replaceChildren(item);
}

// 渲染最近留言；一律用 textContent，避免留言內容造成 XSS
function renderRecentMessages(messages) {
  if (messages.length === 0) {
    renderRecentMessage('目前還沒有留言');
    return;
  }

  const items = messages.slice(0, RECENT_LIMIT).map((message) => {
    const item = document.createElement('li');
    item.className = 'py-3';

    const meta = document.createElement('p');
    meta.className = 'text-sm text-mist-rose';
    meta.textContent = `${message.name}・${formatDateTime(message.created_at)}`;

    const content = document.createElement('p');
    content.className = 'mt-1 line-clamp-2 break-words';
    content.textContent = message.content;

    item.append(meta, content);
    return item;
  });
  recentList.replaceChildren(...items);
}

// 並行載入三個來源；單一來源失敗不影響其他卡片
async function loadDashboard() {
  const [projects, messages, profile] = await Promise.allSettled([
    authFetch('/projects'),
    authFetch('/messages'),
    authFetch('/profile'),
  ]);

  setText('stat-projects', projects.status === 'fulfilled' ? String(projects.value.length) : '—');
  setText('stat-messages', messages.status === 'fulfilled' ? String(messages.value.length) : '—');

  if (profile.status === 'fulfilled') {
    setText('stat-profile-name', profile.value.display_name);
    setText('stat-profile-title', profile.value.job_title);
  }

  if (messages.status === 'fulfilled') {
    renderRecentMessages(messages.value);
  } else {
    renderRecentMessage(`載入失敗：${messages.reason.message}`);
  }

  const failed = [projects, messages, profile].find((result) => result.status === 'rejected');
  if (failed) showToast(`部分資料載入失敗：${failed.reason.message}`, 'error');
}

// 頁面初始化
function initDashboardPage() {
  initAdminLayout();
  loadDashboard();
}

// 未登入就導向登入頁，不執行頁面程式
if (requireAuth()) {
  initDashboardPage();
}
