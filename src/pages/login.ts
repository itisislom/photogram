import { layout, esc, safeJsonForScript, EYE_OPEN_ICON, EYE_CLOSED_ICON } from './layout';
import { Translations, ru, renderLangSwitcherHtml } from '../languages';

const LOGO = `<svg viewBox="0 0 24 24" fill="white"><path d="M9.4 4L7.6 6H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-3.6L14.6 4H9.4zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/><circle cx="12" cy="12" r="3"/></svg>`;

export function loginPage(t: Translations = ru, theme?: string, addMode = false): string {
  const registerHref = addMode ? '/register?add=1' : '/register';
  const backLinkHtml = addMode
    ? `<a href="/accountlist" class="auth-back-link"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg><span>${esc(t.auth.backToAccounts)}</span></a>`
    : '';
  const body = `
<div class="auth-page">
  <div class="auth-card">
    ${backLinkHtml}
    <div class="auth-logo">
      <div class="auth-logo-icon">${LOGO}</div>
      <h1>Photogram</h1>
    </div>
    <div class="auth-error" id="err"></div>
    <form class="auth-form" id="form" autocomplete="off">
      <div class="input-field">
        <input type="text" id="login" placeholder=" " required autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" data-form-type="other">
        <label for="login">${esc(t.auth.username)}</label>
      </div>
      <div class="input-field">
        <input type="text" id="password" class="pw-masked" placeholder=" " required autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" data-form-type="other">
        <label for="password">${esc(t.auth.password)}</label>
        <button type="button" class="password-toggle-btn" id="togglePasswordBtn" aria-label="${esc(t.auth.showPassword)}" title="${esc(t.auth.showPassword)}">
          ${EYE_OPEN_ICON}
          ${EYE_CLOSED_ICON}
        </button>
      </div>
      <button type="submit" class="btn btn-primary" id="btn">${esc(t.auth.loginBtn)}</button>
    </form>
    <div class="auth-footer">
      ${esc(t.auth.noAccount)} <a href="${registerHref}">${esc(t.auth.registerBtn)}</a>
    </div>
    <div style="display: flex; justify-content: center; margin-top: 18px;">
      ${renderLangSwitcherHtml(t.code)}
    </div>
  </div>
</div>`;

  const script = `
function syncLabels() {
  document.querySelectorAll('.input-field input').forEach(function(el) {
    var parent = el.closest('.input-field');
    if (!parent) return;
    var autofilled = false;
    try {
      autofilled = el.matches(':-webkit-autofill') || el.matches(':autofill');
    } catch (e) {}
    if (el.value || autofilled) {
      parent.classList.add('has-value');
    } else {
      parent.classList.remove('has-value');
    }
  });
}

document.querySelectorAll('.input-field input').forEach(function(el) {
  el.addEventListener('input', syncLabels);
  el.addEventListener('change', syncLabels);
  el.addEventListener('focus', syncLabels);
  el.addEventListener('blur', syncLabels);
});

syncLabels();
setTimeout(syncLabels, 100);
setTimeout(syncLabels, 300);

var togglePasswordBtn = document.getElementById('togglePasswordBtn');
var passwordInput = document.getElementById('password');
var supportsTextSecurity = Boolean(window.CSS && typeof window.CSS.supports === 'function' && window.CSS.supports('-webkit-text-security', 'disc'));
if (passwordInput && !supportsTextSecurity) {
  passwordInput.classList.remove('pw-masked');
  passwordInput.type = 'password';
}
if (togglePasswordBtn && passwordInput) {
  togglePasswordBtn.addEventListener('click', function() {
    var shouldReveal = supportsTextSecurity
      ? !passwordInput.classList.contains('pw-revealed')
      : passwordInput.type === 'password';
    if (supportsTextSecurity) {
      if (shouldReveal) passwordInput.classList.add('pw-revealed');
      else passwordInput.classList.remove('pw-revealed');
    } else {
      passwordInput.type = shouldReveal ? 'text' : 'password';
    }
    if (shouldReveal) {
      togglePasswordBtn.classList.add('is-revealed');
      togglePasswordBtn.setAttribute('aria-label', ${safeJsonForScript(t.auth.hidePassword)});
      togglePasswordBtn.setAttribute('title', ${safeJsonForScript(t.auth.hidePassword)});
    } else {
      togglePasswordBtn.classList.remove('is-revealed');
      togglePasswordBtn.setAttribute('aria-label', ${safeJsonForScript(t.auth.showPassword)});
      togglePasswordBtn.setAttribute('title', ${safeJsonForScript(t.auth.showPassword)});
    }
    passwordInput.focus();
  });
}

document.getElementById('form').addEventListener('submit', async function(e) {
  e.preventDefault();
  var btn = document.getElementById('btn');
  var err = document.getElementById('err');
  err.classList.remove('visible');
  btn.disabled = true;
  btn.textContent = ${safeJsonForScript(t.common.loading)};
  try {
    var loginInput = document.getElementById('login');
    var fd = new FormData();
    fd.append('login', loginInput ? loginInput.value : '');
    fd.append('password', passwordInput ? passwordInput.value : '');
    var res = await fetch('/api/auth/login', { method: 'POST', body: fd });
    var data = await res.json();
    if (res.ok) {
      var loginEl = document.getElementById('login');
      if (loginEl) loginEl.value = '';
      if (passwordInput) passwordInput.value = '';
      window.location.href = '/';
      return;
    } else {
      err.textContent = data.error;
      err.classList.add('visible');
    }
  } catch (x) {
    err.textContent = ${safeJsonForScript(t.common.networkError)};
    err.classList.add('visible');
  }
  btn.disabled = false;
  btn.textContent = ${safeJsonForScript(t.auth.loginBtn)};
});`;

  return layout(t.auth.loginTitle, body, script, t, theme);
}
