import { layout, esc, safeJsonForScript, EYE_OPEN_ICON, EYE_CLOSED_ICON } from './layout';
import { getLegalCardsHtml, renderTranslateBarHtml, getTranslateScript } from './useraccept';
import { CLOSE_ICON } from './nav';
import { Translations, ru, renderLangSwitcherHtml } from '../languages';

const LOGO = `<svg viewBox="0 0 24 24" fill="white"><path d="M9.4 4L7.6 6H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-3.6L14.6 4H9.4zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/><circle cx="12" cy="12" r="3"/></svg>`;

export function registerPage(t: Translations = ru, theme?: string, addMode = false): string {
  const loginHref = addMode ? '/login?add=1' : '/login';
  const backLinkHtml = addMode
    ? `<a href="/accountlist" class="auth-back-link"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg><span>${esc(t.auth.backToAccounts)}</span></a>`
    : '';
  const body = `
<div class="auth-page notranslate" translate="no">
  <div class="auth-card">
    ${backLinkHtml}
    <div class="auth-logo">
      <div class="auth-logo-icon">${LOGO}</div>
      <h1>Photogram</h1>
    </div>
    <div class="auth-error" id="err"></div>
    <form class="auth-form" id="form" autocomplete="off">
      <div class="input-field">
        <input type="text" id="username" placeholder=" " required autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" data-form-type="other">
        <label for="username">${esc(t.auth.username)}</label>
      </div>
      <div class="input-field">
        <input type="text" id="display_name" placeholder=" " required autocomplete="off" autocorrect="off" spellcheck="false" maxlength="50" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" data-form-type="other">
        <label for="display_name">${esc(t.auth.displayName)}</label>
      </div>
      <div class="input-field">
        <input type="text" id="password" class="pw-masked" placeholder=" " required autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" minlength="8" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" data-form-type="other">
        <label for="password">${esc(t.auth.password)}</label>
        <button type="button" class="password-toggle-btn" id="togglePasswordBtn" aria-label="${esc(t.auth.showPassword)}" title="${esc(t.auth.showPassword)}">
          ${EYE_OPEN_ICON}
          ${EYE_CLOSED_ICON}
        </button>
      </div>
      <label class="terms-checkbox-wrap" for="terms">
        <input type="checkbox" id="terms" name="terms" value="1">
        <span class="terms-checkbox-text">
          ${esc(t.auth.termsNotice)} <a href="/useraccept" id="openTermsLink">${esc(t.auth.termsLinkText)}</a>
        </span>
      </label>
      <button type="submit" class="btn btn-primary" id="btn" disabled>${esc(t.auth.registerBtn)}</button>
    </form>
    <div class="auth-footer">
      ${esc(t.auth.haveAccount)} <a href="${loginHref}">${esc(t.auth.loginBtn)}</a>
    </div>
    <div style="display: flex; justify-content: center; margin-top: 18px;">
      ${renderLangSwitcherHtml(t.code)}
    </div>
  </div>
</div>

<div class="modal-backdrop" id="termsModal">
  <div class="modal-content" style="max-width: 680px; max-height: 88vh; display: flex; flex-direction: column; padding: 20px;">
    <div class="modal-header notranslate" translate="no" style="padding-bottom: 12px; border-bottom: 1px solid #EBEBEB;">
      <h3 class="modal-title">${esc(t.auth.termsModalTitle)}</h3>
      <button class="modal-close" id="closeTermsBtn" type="button" aria-label="${esc(t.common.close)}">${CLOSE_ICON}</button>
    </div>
    ${renderTranslateBarHtml(t)}
    <div class="terms-modal-body" style="overflow-y: auto; padding: 4px 4px 16px 4px; flex: 1;">
      ${getLegalCardsHtml(t)}
    </div>
    <div class="notranslate" translate="no" style="display: flex; gap: 8px; justify-content: flex-end; padding-top: 14px; border-top: 1px solid #EBEBEB;">
      <button type="button" class="btn btn-secondary btn-sm" id="closeTermsSecondaryBtn">${esc(t.common.close)}</button>
      <button type="button" class="btn btn-primary btn-sm" id="acceptTermsModalBtn">${esc(t.auth.accept18Plus)}</button>
    </div>
  </div>
</div>`;

  const script = `
  document.cookie = 'googtrans=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
  var host = window.location.hostname;
  if (host && host !== 'localhost') {
    document.cookie = 'googtrans=; path=/; domain=' + host + '; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
  }

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

  var termsCheckbox = document.getElementById('terms');
  var btn = document.getElementById('btn');
  if (termsCheckbox && btn) {
    termsCheckbox.addEventListener('change', function() {
      btn.disabled = !this.checked;
    });
  }

  var openTermsLink = document.getElementById('openTermsLink');
  var termsModal = document.getElementById('termsModal');
  var closeTermsBtn = document.getElementById('closeTermsBtn');
  var closeTermsSecondaryBtn = document.getElementById('closeTermsSecondaryBtn');
  var acceptTermsModalBtn = document.getElementById('acceptTermsModalBtn');

  function hideTerms() {
    if (termsModal) termsModal.classList.remove('visible');
  }

  if (openTermsLink && termsModal) {
    openTermsLink.addEventListener('click', function(e) {
      e.preventDefault();
      termsModal.classList.add('visible');
      if (typeof window.initGoogleTranslate === 'function') {
        window.initGoogleTranslate();
      }
    });
  }
  if (closeTermsBtn) closeTermsBtn.addEventListener('click', hideTerms);
  if (closeTermsSecondaryBtn) closeTermsSecondaryBtn.addEventListener('click', hideTerms);
  if (termsModal) {
    termsModal.addEventListener('click', function(e) {
      if (e.target === termsModal) hideTerms();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && termsModal.classList.contains('visible')) hideTerms();
    });
  }
  if (acceptTermsModalBtn && termsCheckbox) {
    acceptTermsModalBtn.addEventListener('click', function() {
      termsCheckbox.checked = true;
      if (btn) btn.disabled = false;
      hideTerms();
    });
  }

  var usernameInput = document.getElementById('username');
  usernameInput.addEventListener('input', function() {
    this.value = this.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
  });

  document.getElementById('form').addEventListener('submit', async function(e) {
    e.preventDefault();
    var err = document.getElementById('err');
    err.classList.remove('visible');

    if (!termsCheckbox || !termsCheckbox.checked) {
      err.textContent = ${safeJsonForScript(t.auth.errTermsRequired)};
      err.classList.add('visible');
      if (btn) btn.disabled = true;
      return;
    }

    var username = usernameInput.value.toLowerCase().trim();
    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      err.textContent = ${safeJsonForScript(t.auth.errUsernameFormat)};
      err.classList.add('visible');
      return;
    }
    var displayName = (document.getElementById('display_name').value || '').trim();
    if (!displayName) {
      err.textContent = ${safeJsonForScript(t.auth.errDisplayNameRequired)};
      err.classList.add('visible');
      return;
    }
    if (document.getElementById('password').value.length < 8) {
      err.textContent = ${safeJsonForScript(t.auth.errPasswordMin)};
      err.classList.add('visible');
      return;
    }
    btn.disabled = true;
    btn.textContent = ${safeJsonForScript(t.common.creating)};
    try {
      var fd = new FormData();
      fd.append('username', username);
      fd.append('display_name', displayName);
      fd.append('password', passwordInput ? passwordInput.value : '');
      fd.append('terms', '1');
      var res = await fetch('/api/auth/register', { method: 'POST', body: fd });
      var data = await res.json();
      if (res.ok) {
        usernameInput.value = '';
        document.getElementById('display_name').value = '';
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
    btn.disabled = !termsCheckbox.checked;
    btn.textContent = ${safeJsonForScript(t.auth.registerBtn)};
  });

  ${getTranslateScript(true)}
  `;

  return layout(t.auth.registerTitle, body, script, t, theme);
}
