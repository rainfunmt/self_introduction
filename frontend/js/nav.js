import { isLoggedIn } from './auth.js';

/**
 * 初始化導覽列：漢堡選單、目前頁面高亮、登入／管理後台連結、Footer 年份
 */
export function initNav() {
  const menuToggle = document.getElementById('menu-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  const iconOpen = document.getElementById('menu-icon-open');
  const iconClose = document.getElementById('menu-icon-close');

  // 開關手機版選單，並同步無障礙屬性與圖示
  function setMenuOpen(isOpen) {
    menuToggle.setAttribute('aria-expanded', String(isOpen));
    menuToggle.setAttribute('aria-label', isOpen ? '關閉選單' : '開啟選單');
    mobileMenu.classList.toggle('hidden', !isOpen);
    iconOpen.classList.toggle('hidden', isOpen);
    iconClose.classList.toggle('hidden', !isOpen);
  }

  menuToggle.addEventListener('click', () => {
    setMenuOpen(menuToggle.getAttribute('aria-expanded') !== 'true');
  });

  // 點擊選單內的連結，或按下 Esc 時收合
  mobileMenu.addEventListener('click', (event) => {
    if (event.target.closest('a')) setMenuOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setMenuOpen(false);
  });

  // 視窗放大到平板／桌面尺寸時，確保手機選單已收合
  window.matchMedia('(min-width: 768px)').addEventListener('change', (event) => {
    if (event.matches) setMenuOpen(false);
  });

  // 目前頁面高亮：標記 aria-current="page"，樣式由 .nav-link 處理
  const currentFile = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach((link) => {
    const linkFile = new URL(link.href).pathname.split('/').pop();
    if (linkFile === currentFile) link.setAttribute('aria-current', 'page');
  });

  // 已登入時，「登入」改成「管理後台」
  if (isLoggedIn()) {
    document.querySelectorAll('.auth-link').forEach((link) => {
      link.textContent = '管理後台';
      link.href = './admin/dashboard.html';
    });
  }

  // Footer 年份
  document.querySelectorAll('.current-year').forEach((element) => {
    element.textContent = new Date().getFullYear();
  });
}
