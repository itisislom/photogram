import { SavedAccountItem } from '../types';
import { MAX_SAVED_ACCOUNTS } from '../auth';
import { layout, escapeHtml, renderVerifiedBadge } from './layout';
import { renderBottomNav } from './nav';
import { Translations } from '../languages/types';
import { ru } from '../languages/ru';

const BACK_ARROW_ICON = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>`;
const PLUS_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
const CHECK_ICON = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
const REMOVE_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;

export function accountListPage(
  accounts: SavedAccountItem[],
  t: Translations = ru,
  theme?: string,
): string {
  const count = accounts.length;
  const limitReached = count >= MAX_SAVED_ACCOUNTS;

  const itemsHtml = accounts
    .map((acc) => {
      const unameSafe = escapeHtml(acc.username);
      const dispSafe = escapeHtml(acc.display_name || acc.username);
      const initial = (acc.display_name || acc.username || '?').charAt(0).toUpperCase();
      const avatarHtml = acc.avatar_key
        ? `<img src="/media/${encodeURIComponent(acc.avatar_key)}" alt="${unameSafe}">`
        : `<span>${escapeHtml(initial)}</span>`;

      const mainTagOpen = acc.is_current
        ? `<div class="accountlist-main is-active">`
        : `<button type="button" class="accountlist-main" data-switch-user-id="${acc.id}">`;
      const mainTagClose = acc.is_current ? `</div>` : `</button>`;

      return `
      <div class="accountlist-item ${acc.is_current ? 'is-current' : ''}" data-account-row-id="${acc.id}">
        ${mainTagOpen}
          <div class="settings-account-avatar">
            ${avatarHtml}
          </div>
          <div class="settings-account-info">
            <div class="settings-account-username">
              ${unameSafe}${acc.is_verified ? renderVerifiedBadge(14) : ''}
            </div>
            <div class="settings-account-display">${dispSafe}</div>
          </div>
          ${acc.is_current ? `
          <span class="accountlist-active-badge">
            ${CHECK_ICON}
            <span>${escapeHtml(t.auth.activeAccount)}</span>
          </span>` : ''}
        ${mainTagClose}
        <button type="button" class="accountlist-remove-btn" data-remove-user-id="${acc.id}" data-remove-username="${unameSafe}" aria-label="${escapeHtml(t.auth.removeAccountBtn)}" title="${escapeHtml(t.auth.removeAccountBtn)}">
          ${REMOVE_ICON}
        </button>
      </div>`;
    })
    .join('');

  const addBtnHtml = limitReached
    ? `
    <button type="button" class="accountlist-add-btn is-disabled" id="addAccountBtn" disabled>
      <span class="accountlist-add-icon">${PLUS_ICON}</span>
      <span id="addAccountBtnText">${escapeHtml(t.auth.errAccountsLimitReached)}</span>
    </button>`
    : `
    <a href="/login?add=1" class="accountlist-add-btn" id="addAccountBtn">
      <span class="accountlist-add-icon">${PLUS_ICON}</span>
      <span id="addAccountBtnText">${escapeHtml(t.auth.addAccount)}</span>
    </a>`;

  const hintTemplates = [0, 1, 2, 3, 4, 5].map((n) => t.auth.accountsLimitHint(n, MAX_SAVED_ACCOUNTS));

  const body = `
<div class="app-layout">
  <header class="settings-top-bar">
    <a href="/settings" class="settings-back-btn" aria-label="${escapeHtml(t.common.close)}">
      ${BACK_ARROW_ICON}
    </a>
    <h1 class="settings-title">${escapeHtml(t.auth.accountsTitle)}</h1>
    <div class="settings-top-spacer"></div>
  </header>

  <main class="settings-container">
    <div class="settings-content">
      <section class="settings-group">
        <div class="settings-group-header" id="accountsCountHeader">${escapeHtml(t.auth.accountsLimitHint(count, MAX_SAVED_ACCOUNTS))}</div>
        <div class="accountlist-rows" id="accountListRows">
          ${itemsHtml}
        </div>
      </section>

      <div id="addAccountWrap">
        ${addBtnHtml}
      </div>
    </div>
  </main>

  ${renderBottomNav('profile', t)}
</div>`;

  const clientI18n = JSON.stringify({
    networkError: t.common.networkError,
    addAccount: t.auth.addAccount,
    removeTitle: t.auth.removeAccountTitle,
    removeConfirmTpl: t.auth.removeAccountConfirm('{username}'),
    removeBtn: t.auth.removeAccountBtn,
    hintByCount: hintTemplates,
    plusIcon: PLUS_ICON,
  });

  const script = `
(function() {
  var i18n = ${clientI18n};
  var isBusy = false;

  document.querySelectorAll('[data-switch-user-id]').forEach(function(btn) {
    btn.addEventListener('click', async function() {
      if (isBusy) return;
      var targetId = parseInt(this.getAttribute('data-switch-user-id'), 10);
      if (!targetId) return;
      isBusy = true;
      this.classList.add('is-switching');
      try {
        var res = await fetch('/api/auth/switch-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: targetId })
        });
        var data = await res.json();
        if (res.ok && data && data.success) {
          window.location.href = '/profile';
          return;
        }
        if (window.showAppAlert) {
          window.showAppAlert({ message: (data && data.error) || i18n.networkError });
        }
      } catch (err) {
        if (window.showAppAlert) {
          window.showAppAlert({ message: i18n.networkError });
        }
      }
      this.classList.remove('is-switching');
      isBusy = false;
    });
  });

  document.querySelectorAll('[data-remove-user-id]').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (isBusy) return;
      var targetId = parseInt(this.getAttribute('data-remove-user-id'), 10);
      var uname = this.getAttribute('data-remove-username') || '';
      if (!targetId) return;

      function doRemove() {
        isBusy = true;
        fetch('/api/auth/remove-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: targetId })
        }).then(function(res) {
          return res.json().then(function(data) {
            if (res.ok && data && data.success) {
              if (data.redirect) {
                window.location.href = data.redirect;
                return;
              }
              var row = document.querySelector('.accountlist-item[data-account-row-id="' + targetId + '"]');
              if (row) row.remove();
              var leftCount = document.querySelectorAll('.accountlist-item').length;
              var headerEl = document.getElementById('accountsCountHeader');
              if (headerEl && i18n.hintByCount[leftCount]) {
                headerEl.textContent = i18n.hintByCount[leftCount];
              }
              if (leftCount < ${MAX_SAVED_ACCOUNTS}) {
                var wrap = document.getElementById('addAccountWrap');
                if (wrap) {
                  wrap.innerHTML = '<a href="/login?add=1" class="accountlist-add-btn" id="addAccountBtn">' +
                    '<span class="accountlist-add-icon">' + i18n.plusIcon + '</span>' +
                    '<span>' + i18n.addAccount + '</span>' +
                  '</a>';
                }
              }
            } else if (window.showAppAlert) {
              window.showAppAlert({ message: (data && data.error) || i18n.networkError });
            }
          });
        }).catch(function() {
          if (window.showAppAlert) window.showAppAlert({ message: i18n.networkError });
        }).finally(function() {
          isBusy = false;
        });
      }

      if (window.showAppConfirm) {
        window.showAppConfirm({
          type: 'unfollow',
          title: i18n.removeTitle,
          message: i18n.removeConfirmTpl.replace('{username}', uname),
          okText: i18n.removeBtn,
          danger: true,
          onOk: doRemove
        });
      } else {
        doRemove();
      }
    });
  });
})();
`;

  return layout(t.auth.accountsTitle, body, script, t, theme);
}
