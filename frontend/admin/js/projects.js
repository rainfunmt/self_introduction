import { authFetch, requireAuth } from '/js/auth.js';
import { buildAssetUrl } from '/js/api.js';
import {
  clearFieldErrors,
  confirmAction,
  formatDateTime,
  formatFileSize,
  initAdminLayout,
  setFieldError,
  showToast,
  validateUploadFile,
} from './admin-common.js';

// 對應後端 /api/projects（API_BASE_URL 已含 /api）
const RESOURCE_PATH = '/projects';

// 欄位限制，需與後端（backend/models.py、backend/upload_utils.py）一致
const LIMITS = { title: 100, description: 2000, link: 500 };
const FILE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.zip', '.docx', '.pptx', '.xlsx'];
const FILE_MAX_BYTES = 10 * 1024 * 1024;

const tableBody = document.getElementById('project-table-body');
const dialog = document.getElementById('project-dialog');
const dialogTitle = document.getElementById('dialog-title');
const form = document.getElementById('project-form');
const formError = document.getElementById('form-error');
const submitButton = document.getElementById('submit-button');
const fileInput = form.querySelector('[name="file"]');
const currentFileBox = document.getElementById('current-file');
const currentFileLink = document.getElementById('current-file-link');
const removeFileCheckbox = document.getElementById('remove-file');

// 目前載入的資料；編輯與刪除時用 id 找回整筆資料
let projects = [];

// 只允許 http / https 網址，避免 javascript: 之類的危險連結
function isHttpUrl(text) {
  try {
    const url = new URL(text);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// 在表格顯示單列訊息（載入中、無資料、載入失敗）
function renderMessageRow(message) {
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = 5;
  cell.className = 'px-4 py-8 text-center text-mist-rose';
  cell.textContent = message;
  row.appendChild(cell);
  tableBody.replaceChildren(row);
}

// 建立文字儲存格；一律用 textContent，避免 API 資料造成 XSS
function createTextCell(text, className = 'px-4 py-3') {
  const cell = document.createElement('td');
  cell.className = className;
  cell.textContent = text;
  return cell;
}

// 建立在新分頁開啟的外部連結
function createExternalLink(text, href, title = '') {
  const link = document.createElement('a');
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.className = 'block max-w-[16rem] truncate text-rose-smoke hover:underline';
  link.textContent = text;
  if (title) link.title = title;
  return link;
}

// 建立「連結／檔案」儲存格：有連結、有檔案就各顯示一行，都沒有顯示 —
function createResourceCell(project) {
  const cell = document.createElement('td');
  cell.className = 'px-4 py-3';

  const items = [];
  if (project.link_url && isHttpUrl(project.link_url)) {
    items.push(createExternalLink('連結', project.link_url, project.link_url));
  }
  if (project.file_url) {
    const label = `${project.file_name}（${formatFileSize(project.file_size)}）`;
    items.push(createExternalLink(label, buildAssetUrl(project.file_url), project.file_name));
  }

  if (items.length === 0) {
    cell.textContent = '—';
    cell.classList.add('text-mist-rose');
  } else {
    cell.append(...items);
  }
  return cell;
}

// 建立列操作按鈕，用 data-action 與 data-id 交給事件代理處理
function createActionButton(label, action, id, className) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.dataset.action = action;
  button.dataset.id = String(id);
  return button;
}

// 依 projects 陣列渲染表格
function renderProjects() {
  if (projects.length === 0) {
    renderMessageRow('目前沒有作品，點擊右上角「新增作品」建立第一筆');
    return;
  }

  const rows = projects.map((project) => {
    const row = document.createElement('tr');
    row.className = 'align-top transition-colors duration-150 hover:bg-roast-light/40';

    const actionCell = document.createElement('td');
    actionCell.className = 'px-4 py-3';
    const actionGroup = document.createElement('div');
    actionGroup.className = 'flex justify-end gap-2';
    actionGroup.append(
      createActionButton('編輯', 'edit', project.id, 'btn-small'),
      createActionButton('刪除', 'delete', project.id, 'btn-danger'),
    );
    actionCell.appendChild(actionGroup);

    row.append(
      createTextCell(project.id),
      createTextCell(project.title, 'px-4 py-3 font-medium'),
      createResourceCell(project),
      createTextCell(formatDateTime(project.created_at), 'whitespace-nowrap px-4 py-3'),
      actionCell,
    );
    return row;
  });
  tableBody.replaceChildren(...rows);
}

// 從後端載入列表並渲染；新增、更新、刪除成功後都呼叫它來刷新列表
async function loadProjects() {
  renderMessageRow('載入中…');
  try {
    projects = await authFetch(RESOURCE_PATH);
    renderProjects();
  } catch (error) {
    renderMessageRow(`載入失敗：${error.message}`);
    showToast(error.message, 'error');
  }
}

// 顯示或隱藏表單層級的錯誤（伺服器回傳的訊息）
function showFormError(message) {
  formError.textContent = message;
  formError.classList.toggle('hidden', !message);
}

// 顯示「目前的檔案」區塊（編輯有檔案的作品時），並重置「移除」勾選
function showCurrentFile(project) {
  removeFileCheckbox.checked = false;
  const hasFile = Boolean(project?.file_url);
  currentFileBox.classList.toggle('hidden', !hasFile);
  if (hasFile) {
    currentFileLink.textContent = `${project.file_name}（${formatFileSize(project.file_size)}）`;
    currentFileLink.href = buildAssetUrl(project.file_url);
  }
}

// 開啟新增（不傳參數）或編輯（傳入資料）Modal
function openDialog(project = null) {
  form.reset();
  clearFieldErrors(form);
  showFormError('');
  form.querySelector('[name="id"]').value = project ? project.id : '';
  form.querySelector('[name="title"]').value = project ? project.title : '';
  form.querySelector('[name="description"]').value = project ? project.description : '';
  form.querySelector('[name="link_url"]').value = project ? project.link_url : '';
  showCurrentFile(project);
  dialogTitle.textContent = project ? '編輯作品' : '新增作品';
  dialog.showModal();
}

// 前端驗證，規則與後端一致；回傳 { 欄位名: 錯誤訊息 }
function validate({ title, description, link_url: linkUrl }, file) {
  const errors = {};
  if (!title) errors.title = '請輸入標題';
  else if (title.length > LIMITS.title) errors.title = `標題最多 ${LIMITS.title} 字`;

  if (description.length > LIMITS.description) errors.description = `描述最多 ${LIMITS.description} 字`;

  if (linkUrl) {
    if (linkUrl.length > LIMITS.link) errors.link_url = `連結最多 ${LIMITS.link} 字`;
    else if (/\s/.test(linkUrl) || !isHttpUrl(linkUrl)) errors.link_url = '連結必須是 http:// 或 https:// 開頭的有效網址';
  }

  if (file) {
    const problem = validateUploadFile(file, FILE_EXTENSIONS, FILE_MAX_BYTES);
    if (problem) errors.file = problem;
  }
  return errors;
}

// 處理檔案：有選新檔案就上傳（取代舊的）；沒選但勾了「移除」就刪除
async function syncProjectFile(saved, file, removeFile) {
  if (file) {
    const body = new FormData();
    body.append('file', file);
    await authFetch(`${RESOURCE_PATH}/${saved.id}/file`, { method: 'POST', body });
  } else if (removeFile && saved.file_url) {
    await authFetch(`${RESOURCE_PATH}/${saved.id}/file`, { method: 'DELETE' });
  }
}

// 送出表單：先存文字與連結（POST／PUT），再處理檔案（上傳或移除）
async function handleSubmit(event) {
  event.preventDefault();
  clearFieldErrors(form);
  showFormError('');

  const formData = Object.fromEntries(new FormData(form));
  const payload = {
    title: formData.title.trim(),
    description: formData.description.trim(),
    link_url: formData.link_url.trim(),
  };
  const file = fileInput.files[0] ?? null;

  const errors = validate(payload, file);
  const errorFields = Object.keys(errors);
  if (errorFields.length > 0) {
    errorFields.forEach((name) => setFieldError(form, name, errors[name]));
    form.querySelector(`[name="${errorFields[0]}"]`).focus();
    return;
  }

  const isEdit = Boolean(formData.id);
  submitButton.disabled = true;
  try {
    // 第一步：儲存文字與連結
    let saved;
    try {
      saved = await authFetch(isEdit ? `${RESOURCE_PATH}/${formData.id}` : RESOURCE_PATH, {
        method: isEdit ? 'PUT' : 'POST',
        body: payload,
      });
    } catch (error) {
      // Modal 開啟時 Toast 會被遮罩蓋住，所以同時在表單內顯示錯誤
      showFormError(error.message);
      showToast(error.message, 'error');
      return;
    }

    // 舊版後端不認識 link_url：請求會「成功」，但連結被悄悄丟掉。
    // 回應沒有 link_url 欄位（或內容與送出的不同）就代表連結沒存進去，要明確告訴使用者
    if (!('link_url' in saved) || saved.link_url !== payload.link_url) {
      form.querySelector('[name="id"]').value = saved.id;
      dialogTitle.textContent = '編輯作品';
      const message = '作品的文字已儲存，但伺服器沒有存下連結與檔案。後端很可能還是舊版：'
        + '請關閉所有舊的「Backend API」視窗，再重新執行 start-dev.bat。';
      showFormError(message);
      showToast(message, 'error');
      await loadProjects();
      return;
    }

    // 第二步：處理檔案。失敗時作品其實已經存好了，所以切成編輯模式讓使用者可以重試
    try {
      await syncProjectFile(saved, file, removeFileCheckbox.checked);
    } catch (error) {
      form.querySelector('[name="id"]').value = saved.id;
      dialogTitle.textContent = '編輯作品';
      showFormError(`作品已儲存，但檔案處理失敗：${error.message}`);
      showToast(error.message, 'error');
      await loadProjects();
      showCurrentFile(projects.find((item) => item.id === saved.id));
      return;
    }

    dialog.close();
    showToast(isEdit ? '更新成功' : '新增成功');
    await loadProjects();
  } finally {
    submitButton.disabled = false;
  }
}

// 確認後刪除，成功就刷新列表
async function deleteProject(project) {
  const fileNote = project.file_url ? '已上傳的檔案也會一併刪除，' : '';
  const confirmed = await confirmAction(`確定要刪除「${project.title}」嗎？${fileNote}此操作無法復原。`);
  if (!confirmed) return;

  try {
    await authFetch(`${RESOURCE_PATH}/${project.id}`, { method: 'DELETE' });
    showToast('刪除成功');
    await loadProjects();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// 事件代理：處理表格內的編輯與刪除按鈕
tableBody.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const project = projects.find((item) => item.id === Number(button.dataset.id));
  if (!project) return;

  if (button.dataset.action === 'edit') openDialog(project);
  if (button.dataset.action === 'delete') deleteProject(project);
});

form.addEventListener('submit', handleSubmit);

// 頁面初始化：綁定按鈕並載入資料
function initProjectPage() {
  initAdminLayout();
  document.getElementById('create-button').addEventListener('click', () => openDialog());
  document.getElementById('cancel-button').addEventListener('click', () => dialog.close());
  loadProjects();
}

// 未登入就導向登入頁，不執行頁面程式
if (requireAuth()) {
  initProjectPage();
}
