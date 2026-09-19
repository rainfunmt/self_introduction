// 全站動畫預設：時長 0.8 秒、柔和減速
gsap.registerPlugin(ScrollTrigger);
gsap.defaults({ duration: 0.8, ease: 'power3.out' });

// 捲動觸發預設：元素頂端進入視窗 85% 處時播放一次
ScrollTrigger.defaults({
  start: 'top 85%',
  toggleActions: 'play none none none',
});

/**
 * 啟動頁面所有動畫；使用者開啟「減少動態效果」時不播放
 */
export function initPageAnimations() {
  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
    initHeaderAnimation();
    // 頁面上有對應元素才執行，避免 GSAP 找不到目標而在 Console 警告
    if (document.querySelector('.hero-title')) initHeroAnimation();
    if (document.querySelector('.profile-card')) initProfileCardAnimation();
    initSectionAnimations();
  });
}

// 名片頁進場：卡片浮現 → 頭像縮放 → 姓名職稱 → 簡介 → 技能標籤 stagger → 按鈕
function initProfileCardAnimation() {
  const cardTimeline = gsap.timeline();
  cardTimeline
    .from('.profile-card', { y: 40, opacity: 0 })
    .from('.profile-avatar', { scale: 0.8, opacity: 0, duration: 0.6 }, '-=0.5')
    .from('.profile-heading > *', { y: 20, opacity: 0, duration: 0.5, stagger: 0.12 }, '-=0.4')
    .from('.profile-bio', { y: 20, opacity: 0, duration: 0.5 }, '-=0.3')
    .from('.skill-tag', { y: 20, opacity: 0, duration: 0.4, stagger: 0.08 }, '-=0.3')
    .from('.profile-actions > *', { y: 20, opacity: 0, duration: 0.4, stagger: 0.1 }, '-=0.2');
}

// 導覽列進場：由上往下淡入
function initHeaderAnimation() {
  gsap.from('.site-header', { y: -20, opacity: 0, duration: 0.6 });
}

// Hero 進場：標題、說明、按鈕依序淡入上移
function initHeroAnimation() {
  const heroTimeline = gsap.timeline();
  heroTimeline
    .from('.hero-eyebrow', { y: 20, opacity: 0, duration: 0.5 })
    .from('.hero-title', { y: 40, opacity: 0 }, '-=0.2')
    .from('.hero-description', { y: 30, opacity: 0 }, '-=0.5')
    .from('.hero-actions > *', { y: 20, opacity: 0, duration: 0.5, stagger: 0.12 }, '-=0.4');

  // 首頁有頭像時，與標題同時放大淡入
  if (document.querySelector('.hero-avatar')) {
    heroTimeline.from('.hero-avatar', { scale: 0.85, opacity: 0, duration: 0.8 }, 0.2);
  }
}

// 各內容區塊的捲動進場：標題先出現，卡片依序 stagger
function initSectionAnimations() {
  gsap.utils.toArray('.content-section').forEach((section) => {
    const heading = section.querySelector('.section-heading');
    if (heading) {
      gsap.from(heading, { y: 40, opacity: 0, scrollTrigger: { trigger: section } });
    }

    const cards = section.querySelectorAll('.info-card');
    if (cards.length > 0) {
      gsap.from(cards, {
        y: 40,
        opacity: 0,
        stagger: 0.12,
        scrollTrigger: { trigger: section.querySelector('.card-grid') || section },
      });
    }
  });
}
