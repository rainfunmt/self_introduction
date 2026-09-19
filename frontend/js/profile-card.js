import { initNav } from './nav.js';
import { initPageAnimations } from './animations.js';
import { createSkillTags, fetchProfile, renderAvatar } from './profile-view.js';

const profileCard = document.querySelector('.profile-card');

// 用資料庫的個人資料更新名片；文字一律用 textContent，避免 XSS
function renderProfile(profile) {
  document.title = `${profile.display_name} | 我的履歷`;
  document.getElementById('profile-name').textContent = profile.display_name;
  document.getElementById('profile-job-title').textContent = profile.job_title;

  // 所在地沒填就隱藏該行
  const locationText = document.getElementById('profile-location');
  locationText.textContent = profile.location ? `所在地：${profile.location}` : '';
  locationText.classList.toggle('hidden', !profile.location);

  // 自我介紹沒填就隱藏該段
  const bioText = document.querySelector('.profile-bio');
  bioText.textContent = profile.bio;
  bioText.classList.toggle('hidden', !profile.bio);

  renderAvatar(document.querySelector('.profile-avatar'), profile);

  // 技能標籤：清掉舊的，依資料重新建立
  const skillList = document.querySelector('.skill-tag-list');
  const tags = createSkillTags(profile.skills);
  skillList.replaceChildren(...tags);
  skillList.classList.toggle('hidden', tags.length === 0);
}

// 名片頁進入點：先載入資料並渲染，再啟動動畫（動畫要包含動態產生的技能標籤）
async function initProfileCardPage() {
  initNav();

  // 載入期間先隱藏名片，避免預設文字閃一下再被換掉
  profileCard.classList.add('invisible');
  const profile = await fetchProfile();
  if (profile) renderProfile(profile);
  profileCard.classList.remove('invisible');

  initPageAnimations();
  ScrollTrigger.refresh();
}

initProfileCardPage();
