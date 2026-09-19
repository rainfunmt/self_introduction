import { authFetch, requireAuth } from '/js/auth.js';
import { buildAssetUrl } from '/js/api.js';
import {
  clearFieldErrors,
  confirmAction,
  formatDateTime,
  initAdminLayout,
  setFieldError,
  showToast,
  validateUploadFile,
} from './admin-common.js';

// 對應後端 /api/profile（API_BASE_URL 已含 /api）
const RESOURCE_PATH = '/profile';

// 欄位限制，需與後端 Pydantic（backend/models.py）一致
const LIMITS = { displayName: 50, jobTitle: 50, location: 50, bio: 500, skills: 12, skillLength: 20 };

// 大頭貼限制，需與後端 backend/upload_utils.py 一致
const AVATAR_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

const form = document.getElementById('profile-form');
const formError = document.getElementById('form-error');
const submitButton = document.getElementById('submit-button');
const bioInput = form.querySelector('[name="bio"]');
const bioCount = document.getElementById('bio-count');
const updatedAt = document.getElementById('updated-at');

const avatarPreview = document.getElementById('avatar-preview');
const avatarInput = document.getElementById('avatar-input');
const avatarRemoveButton = document.getElementById('avatar-remove-button');
const avatarError = document.getElementById('avatar-error');

// 目前資料庫中的資料；「還原」按鈕會用它回填表單
let currentProfile = null;

// 顯示或隱藏表單層級的錯誤（伺服器回傳的訊息）
function showFormError(message) {
  formError.textContent = message;
  formError.classList.toggle('hidden', !message);
}

// 顯示或隱藏大頭貼區塊的錯誤
function showAvatarError(message) {
  avatarError.textContent = message;
  avatarError.classList.toggle('hidden', !message);
}

// 把技能輸入文字（逗號、全形逗號、頓號分隔）轉成陣列
function parseSkills(text) {
  return text.split(/[,，、]/).map((skill) => skill.trim()).filter(Boolean);
}

// 更新自我介紹的字數統計
function updateBioCount() {
  bioCount.textContent = String(bioInput.value.length);
}

// 渲染大頭貼預覽：有圖片就顯示圖片，沒有就顯示姓名首字（與前台名片頁一致）
function renderAvatar(profile) {
  const avatarUrl = buildAssetUrl(profile.avatar_url);
  if (avatarUrl) {
    const image = document.createElement('img');
    image.src = avatarUrl;
    image.alt = `${profile.display_name}目前的大頭貼`;
    image.className = 'h-full w-full object-cover';
    avatarPreview.replaceChildren(image);
  } else {
    avatarPreview.textContent = Array.from(profile.display_name)[0] ?? '';
  }
  avatarRemoveButton.disabled = !avatarUrl;
}

// 用後端資料填入表單與大頭貼
function fillForm(profile) {
  form.querySelector('[name="display_name"]').value = profile.display_name;
  form.querySelector('[name="job_title"]').value = profile.job_title;
  form.querySelector('[name="location"]').value = profile.location;
  bioInput.value = profile.bio;
  form.querySelector('[name="skills"]').value = profile.skills.join(', ');
  updatedAt.textContent = `最後更新：${formatDateTime(profile.updated_at)}`;
  updateBioCount();
  renderAvatar(profile);
}

// 前端驗證，規則與後端一致；回傳 { 欄位名: 錯誤訊息 }
function validate({ display_name: displayName, job_title: jobTitle, location, bio, skills }) {
  const errors = {};
  if (!displayName) errors.display_name = '請輸入姓名';
  else if (displayName.length > LIMITS.displayName) errors.display_name = `姓名最多 ${LIMITS.displayName} 字`;

  if (!jobTitle) errors.job_title = '請輸入職稱';
  else if (jobTitle.length > LIMITS.jobTitle) errors.job_title = `職稱最多 ${LIMITS.jobTitle} 字`;

  if (location.length > LIMITS.location) errors.location = `所在地最多 ${LIMITS.location} 字`;
  if (bio.length > LIMITS.bio) errors.bio = `自我介紹最多 ${LIMITS.bio} 字`;

  if (skills.length > LIMITS.skills) errors.skills = `技能標籤最多 ${LIMITS.skills} 個`;
  else if (skills.some((skill) => skill.length > LIMITS.skillLength)) {
    errors.skills = `每個技能標籤最多 ${LIMITS.skillLength} 字`;
  }
  return errors;
}

// 從後端載入個人資料並填入表單
async function loadProfile() {
  try {
    currentProfile = await authFetch(RESOURCE_PATH);
    fillForm(currentProfile);
  } catch (error) {
    showFormError(`載入失敗：${error.message}`);
    showToast(error.message, 'error');
  }
}

// 送出表單：驗證通過後 PUT 更新資料庫，成功後用回傳資料重新填入
async function handleSubmit(event) {
  event.preventDefault();
  clearFieldErrors(form);
  showFormError('');

  const formData = Object.fromEntries(new FormData(form));
  const payload = {
    display_name: formData.display_name.trim(),
    job_title: formData.job_title.trim(),
    location: formData.location.trim(),
    bio: formData.bio.trim(),
    skills: parseSkills(formData.skills),
  };

  const errors = validate(payload);
  const errorFields = Object.keys(errors);
  if (errorFields.length > 0) {
    errorFields.forEach((name) => setFieldError(form, name, errors[name]));
    form.querySelector(`[name="${errorFields[0]}"]`).focus();
    return;
  }

  submitButton.disabled = true;
  try {
    currentProfile = await authFetch(RESOURCE_PATH, { method: 'PUT', body: payload });
    fillForm(currentProfile);
    showToast('儲存成功');
  } catch (error) {
    showFormError(error.message);
    showToast(error.message, 'error');
  } finally {
    submitButton.disabled = false;
  }
}

// 還原成資料庫中目前的內容
function handleReset() {
  if (!currentProfile) return;
  clearFieldErrors(form);
  showFormError('');
  fillForm(currentProfile);
}

// 選好圖片後立刻上傳：先在前端檢查，通過才送出 multipart 表單
async function handleAvatarChange() {
  const file = avatarInput.files[0];
  if (!file) return;
  showAvatarError('');

  const problem = validateUploadFile(file, AVATAR_EXTENSIONS, AVATAR_MAX_BYTES);
  if (problem) {
    showAvatarError(problem);
    avatarInput.value = '';
    return;
  }

  const body = new FormData();
  body.append('file', file);
  avatarInput.disabled = true;
  try {
    // 只更新大頭貼相關內容，不動表單中尚未儲存的文字欄位
    currentProfile = await authFetch(`${RESOURCE_PATH}/avatar`, { method: 'POST', body });
    renderAvatar(currentProfile);
    showToast('大頭貼已更新');
  } catch (error) {
    showAvatarError(error.message);
    showToast(error.message, 'error');
  } finally {
    avatarInput.disabled = false;
    avatarInput.value = ''; // 清空，才能連續選同一個檔案
  }
}

// 確認後移除大頭貼
async function handleAvatarRemove() {
  const confirmed = await confirmAction('確定要移除大頭貼嗎？前台名片會改回顯示姓名首字。');
  if (!confirmed) return;

  showAvatarError('');
  try {
    currentProfile = await authFetch(`${RESOURCE_PATH}/avatar`, { method: 'DELETE' });
    renderAvatar(currentProfile);
    showToast('大頭貼已移除');
  } catch (error) {
    showAvatarError(error.message);
    showToast(error.message, 'error');
  }
}

form.addEventListener('submit', handleSubmit);
bioInput.addEventListener('input', updateBioCount);
avatarInput.addEventListener('change', handleAvatarChange);
avatarRemoveButton.addEventListener('click', handleAvatarRemove);

// 頁面初始化：綁定按鈕並載入資料
function initProfilePage() {
  initAdminLayout();
  document.getElementById('reset-button').addEventListener('click', handleReset);
  loadProfile();
}

// 未登入就導向登入頁，不執行頁面程式
if (requireAuth()) {
  initProfilePage();
}
