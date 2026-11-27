import { User } from '../types';
import { layout, escapeHtml, safeJsonForScript, renderVerifiedBadge, EYE_OPEN_ICON, EYE_CLOSED_ICON } from './layout';
import { renderBottomNav, CLOSE_ICON } from './nav';
import { renderLangSwitcherHtml } from '../languages';
import { Translations } from '../languages/types';
import { ru } from '../languages/ru';
import { getLegalCardsHtml } from './useraccept';

const BACK_ARROW_ICON = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>`;
const CHEVRON_RIGHT_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
const LOCK_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
const BELL_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`;
const TERMS_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`;
const LOGOUT_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;
const PALETTE_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>`;
const GLOBE_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
const ACTIVITY_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>`;
const LINK_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;
const DEVICES_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="14" height="10" rx="2"/><line x1="6" y1="18" x2="12" y2="18"/><line x1="9" y1="14" x2="9" y2="18"/><rect x="15" y="9" width="7" height="12" rx="1.5"/></svg>`;

export function settingsPage(currentUser: User, t: Translations = ru, theme?: string): string {
  const usernameSafe = escapeHtml(currentUser.username);
  const displayNameSafe = escapeHtml(currentUser.display_name || currentUser.username);
  const initial = (currentUser.display_name || currentUser.username).charAt(0).toUpperCase();

  const avatarHtml = currentUser.avatar_key
    ? `<img src="/media/${encodeURIComponent(currentUser.avatar_key)}" alt="${usernameSafe}">`
    : `<span>${escapeHtml(initial)}</span>`;

  const body = `
<div class="app-layout">
  <header class="settings-top-bar">
    <a href="/profile" class="settings-back-btn" aria-label="${escapeHtml(t.common.close)}">
      ${BACK_ARROW_ICON}
    </a>
    <h1 class="settings-title">${escapeHtml(t.nav.settings)}</h1>
    <div class="settings-top-spacer"></div>
  </header>

  <main class="settings-container">
    <div class="settings-content">
    <a href="/accountlist" class="settings-account-card">
      <div class="settings-account-avatar">
        ${avatarHtml}
      </div>
      <div class="settings-account-info">
        <div class="settings-account-username">
          ${usernameSafe}${currentUser.is_verified ? renderVerifiedBadge(15) : ''}
        </div>
        <div class="settings-account-display">${displayNameSafe}</div>
      </div>
      <div class="settings-account-arrow">
        ${CHEVRON_RIGHT_ICON}
      </div>
    </a>

    <section class="settings-group">
      <div class="settings-group-header">${escapeHtml(t.activity.title)}</div>
      <a href="/activity" class="settings-row settings-row-interactive" id="settingsYourActivityLink">
        <div class="settings-row-left">
          <div class="settings-row-icon">${ACTIVITY_ICON}</div>
          <div class="settings-row-text">
            <span class="settings-row-title">${escapeHtml(t.activity.title)}</span>
            <span class="settings-row-sub">${escapeHtml(t.activity.settingsRowDesc)}</span>
          </div>
        </div>
        <div class="settings-account-arrow">${CHEVRON_RIGHT_ICON}</div>
      </a>
    </section>

    <section class="settings-group">
      <div class="settings-group-header">${escapeHtml(t.common.theme)}</div>
      <div class="settings-row" style="flex-direction: column; align-items: stretch; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div class="settings-row-icon">${PALETTE_ICON}</div>
          <div class="settings-row-text">
            <span class="settings-row-title">${escapeHtml(t.common.theme)}</span>
          </div>
        </div>
        <div class="theme-switcher" id="themeSwitcher" style="width: 100%;">
          <button type="button" class="theme-switch-btn${theme === 'dark' ? '' : ' active'}" data-set-theme="light" aria-label="${escapeHtml(t.common.themeLight)}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
            <span>${escapeHtml(t.common.themeLight)}</span>
          </button>
          <button type="button" class="theme-switch-btn${theme === 'dark' ? ' active' : ''}" data-set-theme="dark" aria-label="${escapeHtml(t.common.themeDark)}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
            <span>${escapeHtml(t.common.themeDark)}</span>
          </button>
        </div>
      </div>
    </section>

    <section class="settings-group">
      <div class="settings-group-header">${escapeHtml(t.common.selectLanguage)}</div>
      <div class="settings-row" style="flex-direction: column; align-items: stretch; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div class="settings-row-icon">${GLOBE_ICON}</div>
          <div class="settings-row-text">
            <span class="settings-row-title">${escapeHtml(t.common.selectLanguage)}</span>
          </div>
        </div>
        ${renderLangSwitcherHtml(t.code)}
      </div>
    </section>

    <section class="settings-group">
      <div class="settings-group-header">${escapeHtml(t.notifications.settingTitle)}</div>
      <div class="settings-row settings-toggle-row">
        <div class="settings-row-left">
          <div class="settings-row-icon">${BELL_ICON}</div>
          <div class="settings-row-text">
            <span class="settings-row-title">${escapeHtml(t.notifications.settingTitle)}</span>
            <span class="settings-row-sub">${escapeHtml(t.notifications.settingDesc)}</span>
          </div>
        </div>
        <label class="settings-switch" for="notificationsToggleInput">
          <input type="checkbox" id="notificationsToggleInput" ${currentUser.notifications_enabled === 0 || currentUser.notifications_enabled === false ? '' : 'checked'}>
          <span class="settings-switch-slider"></span>
        </label>
      </div>
    </section>

    <section class="settings-group">
      <div class="settings-group-header">${escapeHtml(t.security.sectionTitle)}</div>
      <div class="settings-row settings-toggle-row">
        <div class="settings-row-left">
          <div class="settings-row-icon">${LINK_ICON}</div>
          <div class="settings-row-text">
            <span class="settings-row-title">${escapeHtml(t.security.linkPreviewsTitle)}</span>
            <span class="settings-row-sub">${escapeHtml(t.security.linkPreviewsDesc)}</span>
          </div>
        </div>
        <label class="settings-switch" for="linkPreviewsToggleInput">
          <input type="checkbox" id="linkPreviewsToggleInput" ${Number(currentUser.link_previews_enabled) === 1 ? 'checked' : ''}>
          <span class="settings-switch-slider"></span>
        </label>
      </div>
      <div class="settings-privacy-note">${escapeHtml(t.security.linkPreviewsNotice)}</div>
      <button type="button" class="settings-row settings-row-interactive" id="settingsDevicesBtn">
        <div class="settings-row-left">
          <div class="settings-row-icon">${DEVICES_ICON}</div>
          <div class="settings-row-text">
            <span class="settings-row-title">${escapeHtml(t.security.devicesTitle)}</span>
            <span class="settings-row-sub">${escapeHtml(t.security.devicesDesc)}</span>
          </div>
        </div>
        <div class="settings-account-arrow">${CHEVRON_RIGHT_ICON}</div>
      </button>
    </section>

    <section class="settings-group">
      <div class="settings-group-header">${escapeHtml(t.nav.menu)}</div>
      <button type="button" class="settings-row settings-row-interactive" id="settingsChangePasswordBtn">
        <div class="settings-row-left">
          <div class="settings-row-icon">${LOCK_ICON}</div>
          <div class="settings-row-text">
            <span class="settings-row-title">${escapeHtml(t.auth.changePasswordTitle)}</span>
          </div>
        </div>
        <div class="settings-account-arrow">${CHEVRON_RIGHT_ICON}</div>
      </button>

      <button type="button" class="settings-row settings-row-interactive" id="settingsTermsBtn">
        <div class="settings-row-left">
          <div class="settings-row-icon">${TERMS_ICON}</div>
          <div class="settings-row-text">
            <span class="settings-row-title">${escapeHtml(t.auth.termsModalTitle)}</span>
          </div>
        </div>
        <div class="settings-account-arrow">${CHEVRON_RIGHT_ICON}</div>
      </button>

      <button type="button" class="settings-row settings-row-interactive settings-row-danger" id="settingsLogoutBtn">
        <div class="settings-row-left">
          <div class="settings-row-icon">${LOGOUT_ICON}</div>
          <div class="settings-row-text">
            <span class="settings-row-title">${escapeHtml(t.nav.logout)}</span>
          </div>
        </div>
        <div class="settings-account-arrow">${CHEVRON_RIGHT_ICON}</div>
      </button>
    </section>
    </div>
  </main>

  ${renderBottomNav('profile', t)}

  <div class="modal-backdrop" id="termsModal">
    <div class="modal-content" style="max-width: 680px; max-height: 88vh; display: flex; flex-direction: column; padding: 20px;">
      <div class="modal-header notranslate" translate="no" style="padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
        <h3 class="modal-title">${escapeHtml(t.auth.termsModalTitle)}</h3>
        <button class="modal-close" id="closeTermsBtn" type="button" aria-label="${escapeHtml(t.common.close)}">${CLOSE_ICON}</button>
      </div>
      <div class="terms-modal-body" style="overflow-y: auto; padding: 4px 4px 16px 4px; flex: 1;">
        ${getLegalCardsHtml(t)}
      </div>
      <div class="notranslate" translate="no" style="display: flex; gap: 8px; justify-content: flex-end; padding-top: 14px; border-top: 1px solid var(--border-color);">
        <button type="button" class="btn btn-secondary btn-sm" id="closeTermsSecondaryBtn">${escapeHtml(t.common.close)}</button>
      </div>
    </div>
  </div>

  <div class="modal-backdrop" id="changePasswordModal">
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">${escapeHtml(t.auth.changePasswordTitle)}</h3>
        <button class="modal-close" id="closeChangePasswordBtn" type="button" aria-label="${escapeHtml(t.common.close)}">${CLOSE_ICON}</button>
      </div>
      <div class="auth-error" id="changePasswordError"></div>
      <form class="auth-form" id="changePasswordForm" autocomplete="off">
        <div class="input-field">
          <input type="text" id="currentPasswordInput" class="pw-masked" placeholder=" " required autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" data-form-type="other">
          <label for="currentPasswordInput">${escapeHtml(t.auth.currentPassword)}</label>
          <button type="button" class="password-toggle-btn" data-toggle-pw="currentPasswordInput" aria-label="${escapeHtml(t.auth.showPassword)}" title="${escapeHtml(t.auth.showPassword)}">
            ${EYE_OPEN_ICON}
            ${EYE_CLOSED_ICON}
          </button>
        </div>
        <div class="input-field">
          <input type="text" id="newPasswordInput" class="pw-masked" placeholder=" " required autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" minlength="8" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" data-form-type="other">
          <label for="newPasswordInput">${escapeHtml(t.auth.newPassword)}</label>
          <button type="button" class="password-toggle-btn" data-toggle-pw="newPasswordInput" aria-label="${escapeHtml(t.auth.showPassword)}" title="${escapeHtml(t.auth.showPassword)}">
            ${EYE_OPEN_ICON}
            ${EYE_CLOSED_ICON}
          </button>
        </div>
        <div class="input-field">
          <input type="text" id="confirmPasswordInput" class="pw-masked" placeholder=" " required autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" minlength="8" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" data-form-type="other">
          <label for="confirmPasswordInput">${escapeHtml(t.auth.confirmNewPassword)}</label>
          <button type="button" class="password-toggle-btn" data-toggle-pw="confirmPasswordInput" aria-label="${escapeHtml(t.auth.showPassword)}" title="${escapeHtml(t.auth.showPassword)}">
            ${EYE_OPEN_ICON}
            ${EYE_CLOSED_ICON}
          </button>
        </div>
        <div style="display: flex; gap: 8px; margin-top: 4px;">
          <button type="button" class="btn btn-secondary btn-sm" id="cancelChangePasswordBtn" style="flex:1;">${escapeHtml(t.common.cancel)}</button>
          <button type="submit" class="btn btn-primary btn-sm" id="submitChangePasswordBtn" style="flex:1;">${escapeHtml(t.common.save)}</button>
        </div>
      </form>
    </div>
  </div>

  <div class="modal-backdrop" id="logoutModal">
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">${escapeHtml(t.profile.logoutConfirmTitle)}</h3>
        <button class="modal-close" id="closeLogoutModalBtn" type="button" aria-label="${escapeHtml(t.common.close)}">${CLOSE_ICON}</button>
      </div>
      <p style="font-size: 14px; color: var(--text-secondary);">${escapeHtml(t.profile.logoutConfirmDesc)}</p>
      <div style="display: flex; gap: 8px; margin-top: 8px;">
        <button class="btn btn-secondary btn-sm" id="cancelLogoutBtn" style="flex:1;">${escapeHtml(t.common.cancel)}</button>
        <button class="btn btn-danger btn-sm" id="confirmLogoutBtn" style="flex:1;">${escapeHtml(t.nav.logout)}</button>
      </div>
    </div>
  </div>

  <div class="modal-backdrop" id="notifBlockedModal">
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">${escapeHtml(t.notifications.blockedTitle)}</h3>
        <button class="modal-close" id="closeNotifBlockedBtn" type="button" aria-label="${escapeHtml(t.common.close)}">${CLOSE_ICON}</button>
      </div>
      <p style="font-size: 14px; color: var(--text-secondary);">${escapeHtml(t.notifications.blockedDesc)}</p>
      <p id="notifBlockedSteps" style="font-size: 14px; color: var(--text-primary); white-space: pre-line; line-height: 1.6; margin-top: 8px;"></p>
      <div style="display: flex; gap: 8px; margin-top: 12px;">
        <button type="button" class="btn btn-primary btn-sm" id="okNotifBlockedBtn" style="flex:1;">${escapeHtml(t.common.understood)}</button>
      </div>
    </div>
  </div>

  <div class="modal-backdrop" id="devicesModal">
    <div class="modal-content" style="max-width: 520px; max-height: 86dvh; display: flex; flex-direction: column;">
      <div class="modal-header">
        <h3 class="modal-title">${escapeHtml(t.security.devicesTitle)}</h3>
        <button class="modal-close" id="closeDevicesModalBtn" type="button" aria-label="${escapeHtml(t.common.close)}">${CLOSE_ICON}</button>
      </div>
      <div id="devicesModalBody" class="pg-devices-modal-body"></div>
      <div id="devicesRecoverWrap" class="pg-recover-wrap" style="display:none;">
        <div class="pg-recover-title">${escapeHtml(t.security.deviceRecoverTitle)}</div>
        <p class="pg-recover-desc">${escapeHtml(t.security.deviceRecoverDesc)}</p>
        <div class="pg-recover-warn">${escapeHtml(t.security.deviceRecoverWarning)}</div>
        <div class="auth-error" id="devicesRecoverError"></div>
        <form id="devicesRecoverForm" class="auth-form" autocomplete="off">
          <div class="input-field">
            <input type="password" id="devicesRecoverPwInput" placeholder=" " required autocomplete="current-password">
            <label for="devicesRecoverPwInput">${escapeHtml(t.security.deviceRecoverPasswordLabel)}</label>
          </div>
          <div style="display:flex; gap:8px;">
            <button type="button" class="btn btn-secondary btn-sm" id="devicesRecoverCancelBtn" style="flex:1;">${escapeHtml(t.common.cancel)}</button>
            <button type="submit" class="btn btn-danger btn-sm" id="devicesRecoverSubmitBtn" style="flex:1;">${escapeHtml(t.security.deviceRecoverConfirmBtn)}</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</div>`;

  const script = `
(function() {
  function syncBodyOverflow() {
    var hasOpen = document.querySelector('.modal-backdrop.visible');
    document.body.style.overflow = hasOpen ? 'hidden' : '';
  }

  var termsModal = document.getElementById('termsModal');
  var openTermsBtn = document.getElementById('settingsTermsBtn');
  var closeTermsBtn = document.getElementById('closeTermsBtn');
  var closeTermsSecondaryBtn = document.getElementById('closeTermsSecondaryBtn');

  if (openTermsBtn && termsModal) {
    openTermsBtn.addEventListener('click', function() {
      termsModal.classList.add('visible');
      syncBodyOverflow();
    });
  }

  if (closeTermsBtn && termsModal) {
    closeTermsBtn.addEventListener('click', function() {
      termsModal.classList.remove('visible');
      syncBodyOverflow();
    });
  }

  if (closeTermsSecondaryBtn && termsModal) {
    closeTermsSecondaryBtn.addEventListener('click', function() {
      termsModal.classList.remove('visible');
      syncBodyOverflow();
    });
  }

  if (termsModal) {
    termsModal.addEventListener('click', function(e) {
      if (e.target === termsModal) {
        termsModal.classList.remove('visible');
        syncBodyOverflow();
      }
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && termsModal.classList.contains('visible')) {
        termsModal.classList.remove('visible');
        syncBodyOverflow();
      }
    });
  }

  var notifToggle = document.getElementById('notificationsToggleInput');
  var notifBlockedModal = document.getElementById('notifBlockedModal');
  var notifBlockedSteps = document.getElementById('notifBlockedSteps');
  var closeNotifBlockedBtn = document.getElementById('closeNotifBlockedBtn');
  var okNotifBlockedBtn = document.getElementById('okNotifBlockedBtn');
  var pendingNotifEnable = false;
  var notifI18n = ${safeJsonForScript({
    enabled: t.notifications.enabledToast,
    disabled: t.notifications.disabledToast,
    networkError: t.common.networkError,
    steps: {
      chrome: t.notifications.blockedStepsChrome,
      desktopPwa: t.notifications.blockedStepsDesktopPwa,
      android: t.notifications.blockedStepsAndroid,
      firefox: t.notifications.blockedStepsFirefox,
      safari: t.notifications.blockedStepsSafari,
      ios: t.notifications.blockedStepsIos
    }
  })};

  function getNotifPermission() {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
    return Notification.permission;
  }

  function detectNotifPlatform() {
    var ua = navigator.userAgent || '';
    var isIos = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    if (isIos) return 'ios';
    if (/Android/.test(ua)) return 'android';
    var isStandalone = false;
    try {
      isStandalone = Boolean(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    } catch (e) {}
    if (/Firefox\\//.test(ua)) return 'firefox';
    if (/Safari\\//.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|YaBrowser/.test(ua)) return 'safari';
    if (isStandalone) return 'desktopPwa';
    return 'chrome';
  }

  function openNotifBlockedModal() {
    if (!notifBlockedModal) return;
    if (notifBlockedSteps) notifBlockedSteps.textContent = notifI18n.steps[detectNotifPlatform()] || notifI18n.steps.chrome;
    notifBlockedModal.classList.add('visible');
    syncBodyOverflow();
  }

  function closeNotifBlockedModal() {
    if (!notifBlockedModal) return;
    notifBlockedModal.classList.remove('visible');
    syncBodyOverflow();
  }

  if (closeNotifBlockedBtn) closeNotifBlockedBtn.addEventListener('click', closeNotifBlockedModal);
  if (okNotifBlockedBtn) okNotifBlockedBtn.addEventListener('click', closeNotifBlockedModal);
  if (notifBlockedModal) {
    notifBlockedModal.addEventListener('click', function(e) {
      if (e.target === notifBlockedModal) closeNotifBlockedModal();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && notifBlockedModal.classList.contains('visible')) {
        closeNotifBlockedModal();
      }
    });
  }

  function askNotifPermission() {
    return new Promise(function(resolve) {
      try {
        var p = Notification.requestPermission(function(res) { resolve(res); });
        if (p && typeof p.then === 'function') {
          p.then(resolve, function() { resolve(Notification.permission); });
        }
      } catch (e) {
        resolve(Notification.permission);
      }
    });
  }

  async function saveNotifSetting(val) {
    try {
      var r = await fetch('/api/settings/notifications', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: val })
      });
      var d = null;
      try { d = await r.json(); } catch (e) {}
      if (r.ok && d && d.success) return { ok: true };
      return { ok: false, error: (d && d.error) || notifI18n.networkError };
    } catch (e) {
      return { ok: false, error: notifI18n.networkError };
    }
  }

  function afterNotifSaved(val) {
    if (val) {
      if (window.ensurePushSubscription) window.ensurePushSubscription(false);
      if (window.refreshNotificationsBadge) window.refreshNotificationsBadge();
    } else {
      if (window.unsubscribePushNotifications) window.unsubscribePushNotifications();
      if (window.updateNotificationsBadge) window.updateNotificationsBadge(0);
    }
    if (window.showAppToast) window.showAppToast(val ? notifI18n.enabled : notifI18n.disabled);
  }

  async function recheckNotifPermission() {
    if (!pendingNotifEnable || !notifToggle || !document.body.contains(notifToggle)) return;
    var perm = getNotifPermission();
    if (perm === 'denied') return;
    pendingNotifEnable = false;
    closeNotifBlockedModal();
    if (perm !== 'granted') return;
    notifToggle.checked = true;
    notifToggle.disabled = true;
    var result = await saveNotifSetting(true);
    notifToggle.disabled = false;
    if (result.ok) {
      afterNotifSaved(true);
    } else {
      notifToggle.checked = false;
      if (window.showAppToast) window.showAppToast(result.error);
    }
  }

  if (notifToggle) {
    if (notifToggle.checked && getNotifPermission() === 'denied') {
      notifToggle.checked = false;
    }

    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'visible') recheckNotifPermission();
    });
    window.addEventListener('focus', recheckNotifPermission);
    try {
      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'notifications' }).then(function(status) {
          if (status && status.addEventListener) {
            status.addEventListener('change', recheckNotifPermission);
          }
        }).catch(function() {});
      }
    } catch (e) {}

    notifToggle.addEventListener('change', async function() {
      var self = this;
      var nextVal = Boolean(self.checked);

      if (nextVal) {
        var perm = getNotifPermission();
        if (perm === 'default') {
          self.disabled = true;
          perm = await askNotifPermission();
          self.disabled = false;
        }
        if (perm === 'denied') {
          self.checked = false;
          pendingNotifEnable = true;
          openNotifBlockedModal();
          return;
        }
        if (perm !== 'granted' && perm !== 'unsupported') {
          self.checked = false;
          return;
        }
      } else {
        pendingNotifEnable = false;
      }

      self.disabled = true;
      var result = await saveNotifSetting(nextVal);
      self.disabled = false;
      if (result.ok) {
        afterNotifSaved(nextVal);
      } else {
        self.checked = !nextVal;
        if (window.showAppToast) window.showAppToast(result.error);
      }
    });
  }

  var changePwModal = document.getElementById('changePasswordModal');
  var openChangePwBtn = document.getElementById('settingsChangePasswordBtn');
  var closeChangePwBtn = document.getElementById('closeChangePasswordBtn');
  var cancelChangePwBtn = document.getElementById('cancelChangePasswordBtn');
  var changePwForm = document.getElementById('changePasswordForm');
  var changePwError = document.getElementById('changePasswordError');
  var submitChangePwBtn = document.getElementById('submitChangePasswordBtn');
  var curPwInput = document.getElementById('currentPasswordInput');
  var newPwInput = document.getElementById('newPasswordInput');
  var confPwInput = document.getElementById('confirmPasswordInput');
  var pwI18n = ${safeJsonForScript({
    showPassword: t.auth.showPassword,
    hidePassword: t.auth.hidePassword,
    save: t.common.save,
    saving: t.common.saving,
    networkError: t.common.networkError,
    success: t.auth.changePasswordSuccess,
    errCurrentRequired: t.auth.errCurrentPasswordRequired,
    errMin: t.auth.errPasswordMin,
    errMismatch: t.auth.errPasswordsMismatch,
    errSame: t.auth.errPasswordSame
  })};

  function syncChangePwLabels() {
    if (!changePwForm) return;
    changePwForm.querySelectorAll('.input-field input').forEach(function(el) {
      var parent = el.closest('.input-field');
      if (!parent) return;
      if (el.value) parent.classList.add('has-value');
      else parent.classList.remove('has-value');
    });
  }

  var supportsTextSecurity = Boolean(window.CSS && typeof window.CSS.supports === 'function' && window.CSS.supports('-webkit-text-security', 'disc'));
  if (changePwForm && !supportsTextSecurity) {
    changePwForm.querySelectorAll('.pw-masked').forEach(function(el) {
      el.classList.remove('pw-masked');
      el.type = 'password';
    });
  }

  function resetChangePwForm() {
    if (changePwForm) changePwForm.reset();
    if (changePwError) {
      changePwError.textContent = '';
      changePwError.classList.remove('visible');
    }
    if (changePwForm) {
      changePwForm.querySelectorAll('.input-field input').forEach(function(el) {
        if (supportsTextSecurity) {
          el.classList.remove('pw-revealed');
          el.type = 'text';
        } else {
          el.type = 'password';
        }
      });
      changePwForm.querySelectorAll('.password-toggle-btn').forEach(function(b) {
        b.classList.remove('is-revealed');
        b.setAttribute('aria-label', pwI18n.showPassword);
        b.setAttribute('title', pwI18n.showPassword);
      });
    }
    syncChangePwLabels();
  }

  function closeChangePwModal() {
    if (!changePwModal) return;
    changePwModal.classList.remove('visible');
    resetChangePwForm();
    syncBodyOverflow();
  }

  if (changePwForm) {
    changePwForm.querySelectorAll('.input-field input').forEach(function(el) {
      el.addEventListener('input', syncChangePwLabels);
      el.addEventListener('change', syncChangePwLabels);
      el.addEventListener('focus', syncChangePwLabels);
      el.addEventListener('blur', syncChangePwLabels);
    });
    changePwForm.querySelectorAll('[data-toggle-pw]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var targetId = this.getAttribute('data-toggle-pw');
        var input = targetId ? document.getElementById(targetId) : null;
        if (!input) return;
        var shouldReveal = supportsTextSecurity
          ? !input.classList.contains('pw-revealed')
          : input.type === 'password';
        if (supportsTextSecurity) {
          if (shouldReveal) input.classList.add('pw-revealed');
          else input.classList.remove('pw-revealed');
        } else {
          input.type = shouldReveal ? 'text' : 'password';
        }
        if (shouldReveal) {
          this.classList.add('is-revealed');
          this.setAttribute('aria-label', pwI18n.hidePassword);
          this.setAttribute('title', pwI18n.hidePassword);
        } else {
          this.classList.remove('is-revealed');
          this.setAttribute('aria-label', pwI18n.showPassword);
          this.setAttribute('title', pwI18n.showPassword);
        }
        input.focus();
      });
    });
  }

  if (openChangePwBtn && changePwModal) {
    openChangePwBtn.addEventListener('click', function() {
      resetChangePwForm();
      changePwModal.classList.add('visible');
      syncBodyOverflow();
    });
  }

  if (closeChangePwBtn) closeChangePwBtn.addEventListener('click', closeChangePwModal);
  if (cancelChangePwBtn) cancelChangePwBtn.addEventListener('click', closeChangePwModal);

  if (changePwModal) {
    changePwModal.addEventListener('click', function(e) {
      if (e.target === changePwModal) closeChangePwModal();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && changePwModal.classList.contains('visible')) {
        closeChangePwModal();
      }
    });
  }

  if (changePwForm) {
    changePwForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      if (!changePwError || !submitChangePwBtn) return;
      changePwError.classList.remove('visible');
      changePwError.textContent = '';

      var cur = curPwInput ? curPwInput.value : '';
      var next = newPwInput ? newPwInput.value : '';
      var conf = confPwInput ? confPwInput.value : '';

      if (!cur) {
        changePwError.textContent = pwI18n.errCurrentRequired;
        changePwError.classList.add('visible');
        return;
      }
      if (next.length < 8) {
        changePwError.textContent = pwI18n.errMin;
        changePwError.classList.add('visible');
        return;
      }
      if (next !== conf) {
        changePwError.textContent = pwI18n.errMismatch;
        changePwError.classList.add('visible');
        return;
      }
      if (next === cur) {
        changePwError.textContent = pwI18n.errSame;
        changePwError.classList.add('visible');
        return;
      }

      submitChangePwBtn.disabled = true;
      submitChangePwBtn.textContent = pwI18n.saving;
      try {
        var res = await fetch('/api/auth/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            current_password: cur,
            new_password: next,
            confirm_password: conf
          })
        });
        var data = await res.json();
        if (res.ok && data && data.success) {
          closeChangePwModal();
          if (window.showAppToast) window.showAppToast(pwI18n.success);
        } else {
          changePwError.textContent = (data && data.error) || pwI18n.networkError;
          changePwError.classList.add('visible');
        }
      } catch (err) {
        changePwError.textContent = pwI18n.networkError;
        changePwError.classList.add('visible');
      } finally {
        submitChangePwBtn.disabled = false;
        submitChangePwBtn.textContent = pwI18n.save;
      }
    });
  }

  var logoutModal = document.getElementById('logoutModal');
  var openLogoutBtn = document.getElementById('settingsLogoutBtn');
  var closeLogoutBtn = document.getElementById('closeLogoutModalBtn');
  var cancelLogoutBtn = document.getElementById('cancelLogoutBtn');
  var confirmLogoutBtn = document.getElementById('confirmLogoutBtn');

  if (openLogoutBtn && logoutModal) {
    openLogoutBtn.addEventListener('click', function() {
      logoutModal.classList.add('visible');
      syncBodyOverflow();
    });
  }

  if (closeLogoutBtn && logoutModal) {
    closeLogoutBtn.addEventListener('click', function() {
      logoutModal.classList.remove('visible');
      syncBodyOverflow();
    });
  }

  if (cancelLogoutBtn && logoutModal) {
    cancelLogoutBtn.addEventListener('click', function() {
      logoutModal.classList.remove('visible');
      syncBodyOverflow();
    });
  }

  if (logoutModal) {
    logoutModal.addEventListener('click', function(e) {
      if (e.target === logoutModal) {
        logoutModal.classList.remove('visible');
        syncBodyOverflow();
      }
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && logoutModal.classList.contains('visible')) {
        logoutModal.classList.remove('visible');
        syncBodyOverflow();
      }
    });
  }

  if (confirmLogoutBtn) {
    confirmLogoutBtn.addEventListener('click', async function() {
      confirmLogoutBtn.disabled = true;
      confirmLogoutBtn.textContent = '...';
      var nextUrl = '/login';
      var currentUserId = ${Number(currentUser.id)};
      try {
        if (window.unsubscribePushNotifications) {
          await window.unsubscribePushNotifications();
        }
      } catch(e) {}
      try {
        if (window.wipeLocalAccountData) {
          await window.wipeLocalAccountData(currentUserId);
        }
      } catch(e) {}
      try {
        var r = await fetch('/api/auth/logout', { method: 'POST' });
        var d = await r.json();
        if (d && typeof d.redirect === 'string' && d.redirect.startsWith('/') && !d.redirect.startsWith('//')) {
          nextUrl = d.redirect;
        }
      } catch(e) {}
      window.location.href = nextUrl;
    });
  }

  var linkPrevToggle = document.getElementById('linkPreviewsToggleInput');
  var secI18n = ${safeJsonForScript({
    ...t.security,
    loading: t.common.loading,
    networkError: t.common.networkError,
    cancel: t.common.cancel,
  })};
  var settingsCurrentUserId = ${Number(currentUser.id)};

  if (linkPrevToggle) {
    linkPrevToggle.addEventListener('change', async function() {
      var self = this;
      var nextVal = Boolean(self.checked);
      self.disabled = true;
      try {
        var r = await fetch('/api/settings/link-previews', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: nextVal })
        });
        var d = null;
        try { d = await r.json(); } catch (e) {}
        if (r.ok && d && d.ok) {
          if (window.showAppToast) {
            window.showAppToast(nextVal ? secI18n.linkPreviewsEnabledToast : secI18n.linkPreviewsDisabledToast);
          }
        } else {
          self.checked = !nextVal;
          if (window.showAppToast) window.showAppToast((d && d.error) || secI18n.networkError);
        }
      } catch (e) {
        self.checked = !nextVal;
        if (window.showAppToast) window.showAppToast(secI18n.networkError);
      } finally {
        self.disabled = false;
      }
    });
  }

  var devicesModal = document.getElementById('devicesModal');
  var openDevicesBtn = document.getElementById('settingsDevicesBtn');
  var closeDevicesBtn = document.getElementById('closeDevicesModalBtn');
  var devicesModalBody = document.getElementById('devicesModalBody');
  var devicesRecoverWrap = document.getElementById('devicesRecoverWrap');
  var devicesRecoverForm = document.getElementById('devicesRecoverForm');
  var devicesRecoverPwInput = document.getElementById('devicesRecoverPwInput');
  var devicesRecoverError = document.getElementById('devicesRecoverError');
  var devicesRecoverCancelBtn = document.getElementById('devicesRecoverCancelBtn');
  var devicesRecoverSubmitBtn = document.getElementById('devicesRecoverSubmitBtn');
  var settingsE2eeClient = null;

  async function getSettingsE2eeClient() {
    if (settingsE2eeClient) return settingsE2eeClient;
    if (!window.loadPhotogramE2ee) return null;
    var mod = await window.loadPhotogramE2ee();
    var c = mod.getClient(settingsCurrentUserId);
    await c.ensureInitialized();
    settingsE2eeClient = c;
    return c;
  }

  function closeDevicesModal() {
    if (!devicesModal) return;
    devicesModal.classList.remove('visible');
    if (devicesRecoverWrap) devicesRecoverWrap.style.display = 'none';
    if (devicesRecoverForm) devicesRecoverForm.reset();
    if (devicesRecoverError) {
      devicesRecoverError.textContent = '';
      devicesRecoverError.classList.remove('visible');
    }
    syncBodyOverflow();
  }

  async function renderDevicesList() {
    if (!devicesModalBody) return;
    while (devicesModalBody.firstChild) devicesModalBody.removeChild(devicesModalBody.firstChild);
    var loadingP = document.createElement('div');
    loadingP.className = 'pg-device-note';
    loadingP.textContent = secI18n.loading;
    devicesModalBody.appendChild(loadingP);
    if (devicesRecoverWrap) devicesRecoverWrap.style.display = 'none';

    try {
      var c = await getSettingsE2eeClient();
      if (!c) {
        loadingP.textContent = secI18n.networkError;
        return;
      }
      var status = await c.refreshDeviceStatus();
      var res = await c.listOwnDevices();
      var list = Array.isArray(res.devices) ? res.devices : [];
      while (devicesModalBody.firstChild) devicesModalBody.removeChild(devicesModalBody.firstChild);

      if (list.length === 0) {
        var emp = document.createElement('div');
        emp.className = 'pg-device-note';
        emp.textContent = secI18n.devicesEmpty;
        devicesModalBody.appendChild(emp);
        return;
      }

      var currentIsApproved = status.approvalStatus === 'approved';

      if (!currentIsApproved) {
        var warnBox = document.createElement('div');
        warnBox.className = 'pg-recover-warn';
        warnBox.textContent = secI18n.devicePendingBanner + ' (' + secI18n.devicePendingCodePrefix + ': ' + status.verificationCode + ')';
        devicesModalBody.appendChild(warnBox);

        var lostBtn = document.createElement('button');
        lostBtn.type = 'button';
        lostBtn.className = 'btn btn-secondary btn-sm';
        lostBtn.textContent = secI18n.deviceLostOldBtn;
        lostBtn.addEventListener('click', function() {
          if (devicesRecoverWrap) devicesRecoverWrap.style.display = 'flex';
          if (devicesRecoverPwInput) devicesRecoverPwInput.focus();
        });
        devicesModalBody.appendChild(lostBtn);
      }

      var approvedCount = list.filter(function(x) { return x.approval_status === 'approved'; }).length;

      for (var i = 0; i < list.length; i++) {
        (function(dev) {
          var card = document.createElement('div');
          card.className = 'pg-device-card';

          var top = document.createElement('div');
          top.className = 'pg-device-top';
          var nameEl = document.createElement('div');
          nameEl.className = 'pg-device-name';
          nameEl.textContent = dev.device_label || ('Device #' + dev.device_id);
          top.appendChild(nameEl);

          var badges = document.createElement('div');
          badges.className = 'pg-device-badges';
          if (dev.is_current) {
            var bCur = document.createElement('span');
            bCur.className = 'pg-device-badge is-current';
            bCur.textContent = secI18n.deviceCurrentBadge;
            badges.appendChild(bCur);
          }
          if (dev.is_primary) {
            var bPri = document.createElement('span');
            bPri.className = 'pg-device-badge';
            bPri.textContent = secI18n.devicePrimaryBadge;
            badges.appendChild(bPri);
          }
          var bSt = document.createElement('span');
          bSt.className = 'pg-device-badge ' + (dev.approval_status === 'approved' ? 'is-approved' : 'is-pending');
          bSt.textContent = dev.approval_status === 'approved' ? secI18n.deviceApprovedBadge : secI18n.devicePendingBadge;
          badges.appendChild(bSt);
          top.appendChild(badges);
          card.appendChild(top);

          var codeEl = document.createElement('div');
          codeEl.className = 'pg-device-code';
          codeEl.textContent = secI18n.deviceCodeLabel + ': ' + dev.verification_code;
          card.appendChild(codeEl);

          if (dev.trust_origin === 'legacy') {
            var legEl = document.createElement('div');
            legEl.className = 'pg-device-note';
            legEl.textContent = secI18n.deviceLegacyNote;
            card.appendChild(legEl);
          }

          var actions = document.createElement('div');
          actions.className = 'pg-device-actions';

          if (currentIsApproved && dev.approval_status === 'pending') {
            var apprBtn = document.createElement('button');
            apprBtn.type = 'button';
            apprBtn.className = 'btn btn-primary btn-sm';
            apprBtn.textContent = secI18n.deviceApproveBtn;
            apprBtn.addEventListener('click', async function() {
              apprBtn.disabled = true;
              apprBtn.textContent = secI18n.deviceApprovingBtn;
              try {
                await c.approvePendingDevice(dev.device_id);
                if (window.showAppToast) window.showAppToast(secI18n.deviceApproveSuccess);
                await renderDevicesList();
              } catch (err) {
                if (window.showAppToast) window.showAppToast((err && err.message) || secI18n.networkError);
                apprBtn.disabled = false;
                apprBtn.textContent = secI18n.deviceApproveBtn;
              }
            });
            actions.appendChild(apprBtn);
          }

          var canRevoke =
            (!dev.is_current && dev.approval_status === 'pending') ||
            (currentIsApproved && !dev.is_current && dev.approval_status === 'approved' && approvedCount > 1);
          if (canRevoke) {
            var revBtn = document.createElement('button');
            revBtn.type = 'button';
            revBtn.className = 'btn btn-danger btn-sm';
            revBtn.textContent = secI18n.deviceRevokeBtn;
            revBtn.addEventListener('click', async function() {
              if (!window.confirm(secI18n.deviceRevokeConfirm)) return;
              revBtn.disabled = true;
              try {
                await c.revokeDevice(dev.device_id);
                if (window.showAppToast) window.showAppToast(secI18n.deviceRevokeSuccess);
                await renderDevicesList();
              } catch (err) {
                if (window.showAppToast) window.showAppToast((err && err.message) || secI18n.networkError);
                revBtn.disabled = false;
              }
            });
            actions.appendChild(revBtn);
          }

          if (actions.childNodes.length > 0) {
            card.appendChild(actions);
          }
          devicesModalBody.appendChild(card);
        })(list[i]);
      }
    } catch (e) {
      while (devicesModalBody.firstChild) devicesModalBody.removeChild(devicesModalBody.firstChild);
      var errEl = document.createElement('div');
      errEl.className = 'pg-device-note';
      errEl.textContent = secI18n.networkError;
      devicesModalBody.appendChild(errEl);
    }
  }

  if (openDevicesBtn && devicesModal) {
    openDevicesBtn.addEventListener('click', function() {
      devicesModal.classList.add('visible');
      syncBodyOverflow();
      renderDevicesList();
    });
  }
  if (closeDevicesBtn) closeDevicesBtn.addEventListener('click', closeDevicesModal);
  if (devicesModal) {
    devicesModal.addEventListener('click', function(e) {
      if (e.target === devicesModal) closeDevicesModal();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && devicesModal.classList.contains('visible')) closeDevicesModal();
    });
  }
  if (devicesRecoverCancelBtn && devicesRecoverWrap) {
    devicesRecoverCancelBtn.addEventListener('click', function() {
      devicesRecoverWrap.style.display = 'none';
      if (devicesRecoverForm) devicesRecoverForm.reset();
    });
  }
  if (devicesRecoverForm) {
    devicesRecoverForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      if (!devicesRecoverPwInput || !devicesRecoverSubmitBtn) return;
      var pw = devicesRecoverPwInput.value || '';
      if (!pw) return;
      if (devicesRecoverError) {
        devicesRecoverError.textContent = '';
        devicesRecoverError.classList.remove('visible');
      }
      devicesRecoverSubmitBtn.disabled = true;
      try {
        var c = await getSettingsE2eeClient();
        if (!c) throw new Error(secI18n.networkError);
        await c.recoverLostDevice(pw);
        if (window.showAppToast) window.showAppToast(secI18n.deviceRecoverSuccess);
        devicesRecoverForm.reset();
        await renderDevicesList();
      } catch (err) {
        if (devicesRecoverError) {
          devicesRecoverError.textContent = (err && err.message) || secI18n.networkError;
          devicesRecoverError.classList.add('visible');
        }
      } finally {
        devicesRecoverSubmitBtn.disabled = false;
      }
    });
  }
})();
`;

  return layout(t.nav.settings, body, script, t, theme);
}
