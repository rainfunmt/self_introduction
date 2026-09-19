import { apiRequest, buildAssetUrl } from './api.js';

// 等待後端回應的上限（毫秒），逾時就改用頁面上的預設內容
const LOAD_TIMEOUT_MS = 4000;

// 取姓名第一個字當作頭像文字（用 Array.from 避免切壞特殊字元）
function getInitial(displayName) {
  return Array.from(displayName)[0] ?? '';
}

// 設定頭像容器為「姓名首字」樣式（沒有大頭貼，或圖片載入失敗時使用）
function showInitial(avatar, displayName) {
  avatar.textContent = getInitial(displayName);
  avatar.setAttribute('role', 'img');
  avatar.setAttribute('aria-label', `${displayName}的頭像`);
}

/**
 * 渲染頭像：有上傳大頭貼就顯示圖片，沒有就顯示姓名首字
 * @param {HTMLElement} avatar - 頭像容器（圓形、overflow-hidden）
 * @param {object} profile - 後端的個人資料（需含 display_name、avatar_url）
 */
export function renderAvatar(avatar, profile) {
  const avatarUrl = buildAssetUrl(profile.avatar_url);
  if (!avatarUrl) {
    showInitial(avatar, profile.display_name);
    return;
  }

  const image = document.createElement('img');
  image.src = avatarUrl;
  image.alt = `${profile.display_name}的大頭照`;
  image.className = 'h-full w-full object-cover';
  // 圖片載入失敗（檔案被刪、後端沒開）就退回姓名首字
  image.addEventListener('error', () => showInitial(avatar, profile.display_name));
  avatar.replaceChildren(image);
  // 圖片本身已有 alt，容器不再重複朗讀
  avatar.removeAttribute('role');
  avatar.removeAttribute('aria-label');
}

/**
 * 依技能陣列建立標籤元素；文字用 textContent，避免 XSS
 * @param {string[]} skills - 技能名稱陣列
 * @returns {HTMLLIElement[]}
 */
export function createSkillTags(skills) {
  return skills.map((skill) => {
    const tag = document.createElement('li');
    tag.className = 'skill-tag';
    tag.textContent = skill;
    return tag;
  });
}

/**
 * 從後端載入個人資料（公開 API）；失敗或逾時回傳 null，呼叫端就保留頁面上的預設內容
 * @returns {Promise<object|null>}
 */
export async function fetchProfile() {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('載入逾時')), LOAD_TIMEOUT_MS);
  });

  try {
    return await Promise.race([apiRequest('/profile'), timeout]);
  } catch (error) {
    console.error('載入個人資料失敗，改用預設內容：', error);
    return null;
  }
}
