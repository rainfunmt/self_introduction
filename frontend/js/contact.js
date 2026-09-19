import { apiRequest } from './api.js';
import { initNav } from './nav.js';
import { initPageAnimations } from './animations.js';

// 欄位限制，需與後端 Pydantic（backend/models.py 的 MessageCreate）一致
const LIMITS = { name: 50, email: 100, content: 2000 };
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const form = document.getElementById('contact-form');
const submitButton = document.getElementById('contact-submit');
const formMessage = document.getElementById('form-message');
const contentInput = form.querySelector('[name="content"]');
const contentCount = document.getElementById('content-count');

// 更新留言字數統計
function updateContentCount() {
  contentCount.textContent = String(contentInput.value.length);
}

// 清除所有欄位錯誤與送出結果訊息
function clearMessages() {
  form.querySelectorAll('[data-error-for]').forEach((element) => {
    element.textContent = '';
    element.classList.add('hidden');
  });
  form.querySelectorAll('[aria-invalid]').forEach((input) => input.removeAttribute('aria-invalid'));
  formMessage.classList.add('hidden');
}

// 在指定欄位下方顯示錯誤訊息
function setFieldError(fieldName, message) {
  const errorElement = form.querySelector(`[data-error-for="${fieldName}"]`);
  errorElement.textContent = message;
  errorElement.classList.remove('hidden');
  form.querySelector(`[name="${fieldName}"]`).setAttribute('aria-invalid', 'true');
}

// 顯示送出結果：成功用綠色、失敗用紅色
function showFormMessage(message, type) {
  formMessage.textContent = message;
  formMessage.className = `mb-5 text-sm ${type === 'success' ? 'text-emerald-300' : 'text-red-300'}`;
}

// 前端驗證，規則與後端一致；回傳 { 欄位名: 錯誤訊息 }
function validate({ name, email, content }) {
  const errors = {};
  if (!name) errors.name = '請輸入姓名';
  else if (name.length > LIMITS.name) errors.name = `姓名最多 ${LIMITS.name} 字`;

  if (!email) errors.email = '請輸入 Email';
  else if (email.length > LIMITS.email || !EMAIL_PATTERN.test(email)) errors.email = '請輸入有效的 Email';

  if (!content) errors.content = '請輸入留言內容';
  else if (content.length > LIMITS.content) errors.content = `留言最多 ${LIMITS.content} 字`;
  return errors;
}

// 送出留言：驗證通過後 POST 到公開的 /messages，成功後清空表單
async function handleSubmit(event) {
  event.preventDefault();
  clearMessages();

  const formData = Object.fromEntries(new FormData(form));
  const payload = {
    name: formData.name.trim(),
    email: formData.email.trim(),
    content: formData.content.trim(),
  };

  const errors = validate(payload);
  const errorFields = Object.keys(errors);
  if (errorFields.length > 0) {
    errorFields.forEach((fieldName) => setFieldError(fieldName, errors[fieldName]));
    form.querySelector(`[name="${errorFields[0]}"]`).focus();
    return;
  }

  submitButton.disabled = true; // 避免重複送出
  try {
    await apiRequest('/messages', { method: 'POST', body: payload, redirectOn401: false });
    form.reset();
    updateContentCount();
    showFormMessage('留言已送出，謝謝你！我會盡快回覆。', 'success');
  } catch (error) {
    showFormMessage(`送出失敗：${error.message}`, 'error');
  } finally {
    submitButton.disabled = false;
  }
}

form.addEventListener('submit', handleSubmit);
contentInput.addEventListener('input', updateContentCount);

// 聯絡頁進入點：初始化導覽列與動畫
initNav();
initPageAnimations();
