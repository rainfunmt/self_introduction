import { apiRequest, buildAssetUrl } from './api.js';
import { formatFileSize } from './format.js';
import { initNav } from './nav.js';
import { initPageAnimations } from './animations.js';

// 這些副檔名的檔案直接在卡片上顯示成圖片
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

const grid = document.getElementById('portfolio-grid');
const statusBox = document.getElementById('portfolio-status');

// 只允許 http / https 網址，避免 javascript: 之類的危險連結
function isHttpUrl(text) {
  try {
    const url = new URL(text);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// 檔名是否為圖片
function isImageFile(fileName) {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex >= 0 && IMAGE_EXTENSIONS.includes(fileName.slice(dotIndex).toLowerCase());
}

// 建立在新分頁開啟的按鈕連結
function createActionLink(text, href, className) {
  const link = document.createElement('a');
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.className = className;
  link.textContent = text;
  return link;
}

// 建立一張作品卡片；文字一律用 textContent，避免 XSS
function createProjectCard(project) {
  const card = document.createElement('article');
  card.className = 'info-card glass-card flex flex-col overflow-hidden';

  // 上傳的是圖片就當作封面
  const hasImage = Boolean(project.file_url) && isImageFile(project.file_name);
  if (hasImage) {
    const image = document.createElement('img');
    image.src = buildAssetUrl(project.file_url);
    image.alt = `${project.title}的作品圖片`;
    image.loading = 'lazy';
    image.className = 'aspect-video w-full object-cover';
    card.appendChild(image);
  }

  const body = document.createElement('div');
  body.className = 'flex flex-1 flex-col p-6';

  const title = document.createElement('h3');
  title.className = 'text-lg font-semibold text-rose-smoke';
  title.textContent = project.title;
  body.appendChild(title);

  if (project.description) {
    const description = document.createElement('p');
    description.className = 'mt-2 whitespace-pre-line text-sm text-mist-rose';
    description.textContent = project.description;
    body.appendChild(description);
  }

  // 按鈕區：有連結顯示「查看連結」，有檔案顯示「下載檔案」（圖片已顯示在封面，不再重複）
  const actions = document.createElement('div');
  actions.className = 'mt-auto flex flex-wrap gap-3 pt-5';
  if (project.link_url && isHttpUrl(project.link_url)) {
    actions.appendChild(createActionLink('查看連結', project.link_url, 'btn-secondary'));
  }
  if (project.file_url && !hasImage) {
    const fileLink = createActionLink('下載檔案', buildAssetUrl(project.file_url), 'btn-primary');
    fileLink.title = `${project.file_name}（${formatFileSize(project.file_size)}）`;
    actions.appendChild(fileLink);
  }
  if (actions.children.length > 0) body.appendChild(actions);

  // 顯示檔名與大小，讓訪客下載前知道是什麼檔案
  if (project.file_url && !hasImage) {
    const fileInfo = document.createElement('p');
    fileInfo.className = 'mt-3 truncate text-xs text-mist-rose';
    fileInfo.textContent = `檔案：${project.file_name}（${formatFileSize(project.file_size)}）`;
    body.appendChild(fileInfo);
  }

  card.appendChild(body);
  return card;
}

// 顯示提示訊息（載入中、沒有作品、載入失敗）；可選擇附上「重新載入」按鈕
function showStatus(message, { retry = false } = {}) {
  grid.classList.add('hidden');
  statusBox.classList.remove('hidden');
  statusBox.textContent = message;

  if (retry) {
    const retryButton = document.createElement('button');
    retryButton.type = 'button';
    retryButton.className = 'btn-secondary mt-4 block mx-auto';
    retryButton.textContent = '重新載入';
    retryButton.addEventListener('click', async () => {
      await loadProjects();
      ScrollTrigger.refresh();
    });
    statusBox.appendChild(retryButton);
  }
}

// 從後端載入作品並渲染；失敗時顯示錯誤與重試按鈕，頁面不會整片空白
async function loadProjects() {
  showStatus('載入中…');
  try {
    const projects = await apiRequest('/projects');
    if (projects.length === 0) {
      showStatus('目前還沒有作品，敬請期待。');
      return;
    }
    grid.replaceChildren(...projects.map(createProjectCard));
    statusBox.classList.add('hidden');
    grid.classList.remove('hidden');
  } catch (error) {
    showStatus(`作品載入失敗：${error.message}`, { retry: true });
  }
}

// 作品集頁進入點：先載入並渲染作品，再啟動動畫（動畫要包含動態產生的卡片）
async function initPortfolioPage() {
  initNav();
  await loadProjects();
  initPageAnimations();
  ScrollTrigger.refresh();
}

initPortfolioPage();
