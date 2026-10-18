import { layout, esc } from './layout';
import { Translations, ru, renderLangSwitcherHtml } from '../languages';

const LOGO = `<svg viewBox="0 0 24 24" fill="white"><path d="M9.4 4L7.6 6H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-3.6L14.6 4H9.4zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/><circle cx="12" cy="12" r="3"/></svg>`;

export function loginPage(t: Translations = ru): string {
  const body = `
<div class="auth-page">
  <div class="auth-card">
    <div class="auth-logo">
      <div class="auth-logo-icon">${LOGO}</div>
      <h1>Photogram</h1>
    </div>
    <div class="auth-error" id="err"></div>
    <form class="auth-form" id="form">
      <div class="input-field">
        <input type="text" id="login" name="login" placeholder=" " required autocomplete="username" autocapitalize="none" spellcheck="false">
        <label for="login">${esc(t.auth.username)}</label>
      </div>
      <div class="input-field">
        <input type="password" id="password" name="password" placeholder=" " required autocomplete="current-password">
        <label for="password">${esc(t.auth.password)}</label>
      </div>
      <button type="submit" class="btn btn-primary" id="btn">${esc(t.auth.loginBtn)}</button>
    </form>
    <div class="auth-footer">
      ${esc(t.auth.noAccount)} <a href="/register">${esc(t.auth.registerBtn)}</a>
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

document.getElementById('form').addEventListener('submit', async function(e) {
  e.preventDefault();
  var btn = document.getElementById('btn');
  var err = document.getElementById('err');
  err.classList.remove('visible');
  btn.disabled = true;
  btn.textContent = ${JSON.stringify(t.common.loading)};
  try {
    var res = await fetch('/api/auth/login', { method: 'POST', body: new FormData(this) });
    var data = await res.json();
    if (res.ok) {
      window.location.href = '/';
    } else {
      err.textContent = data.error;
      err.classList.add('visible');
    }
  } catch (x) {
    err.textContent = ${JSON.stringify(t.common.networkError)};
    err.classList.add('visible');
  }
  btn.disabled = false;
  btn.textContent = ${JSON.stringify(t.auth.loginBtn)};
});`;

  return layout(t.auth.loginTitle, body, script, t);
}
