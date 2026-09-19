import { initNav } from './nav.js';
import { initPageAnimations } from './animations.js';
import { createSkillTags, fetchProfile, renderAvatar } from './profile-view.js';

const heroContent = document.querySelector('.hero-content');

// 用資料庫的個人資料更新首頁；文字一律用 textContent，避免 XSS
function renderHome(profile) {
  document.title = `${profile.display_name} | 我的履歷`;
  document.getElementById('hero-name').textContent = profile.display_name;
  document.getElementById('hero-job-title').textContent = profile.job_title;

  // 自我介紹沒填就隱藏該段
  const bioText = document.getElementById('hero-bio');
  bioText.textContent = profile.bio;
  bioText.classList.toggle('hidden', !profile.bio);

  renderAvatar(document.getElementById('hero-avatar'), profile);

  // 技能標籤：沒有任何技能時整個區塊隱藏
  const tags = createSkillTags(profile.skills);
  document.getElementById('skill-list').replaceChildren(...tags);
  document.getElementById('skills-section').classList.toggle('hidden', tags.length === 0);
}

// 首頁進入點：先載入資料並渲染，再啟動動畫（動畫要包含動態產生的內容）
async function initHomePage() {
  initNav();

  // 載入期間先隱藏 Hero 內容，避免預設文字閃一下再被換掉
  heroContent.classList.add('invisible');
  const profile = await fetchProfile();
  if (profile) renderHome(profile);
  heroContent.classList.remove('invisible');

  initPageAnimations();
  ScrollTrigger.refresh();
}

initHomePage();
