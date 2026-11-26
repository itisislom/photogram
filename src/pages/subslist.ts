import { layout, esc, safeJsonForScript, renderVerifiedBadge } from './layout';
import { renderBottomNav } from './nav';
import { Translations } from '../languages/types';
import { ru } from '../languages/ru';
import { User, FollowerUser } from '../types';

const BACK_ARROW_ICON = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>`;

export function subslistPage(
  targetUser: User,
  followingUsers: FollowerUser[],
  currentUser: User | null,
  t: Translations = ru,
  theme?: string
): string {
  const targetUsernameSafe = esc(targetUser.username);
  const targetProfileUrl = `/u/${encodeURIComponent(targetUser.username)}`;

  const body = `
<div class="app-layout">
  <header class="sublist-top-bar">
    <a href="${targetProfileUrl}" class="sublist-back-btn" aria-label="${esc(t.common.close)}">
      ${BACK_ARROW_ICON}
    </a>
    <div class="sublist-title-wrap">
      <div class="sublist-username">
        <span>${targetUsernameSafe}</span>
        ${targetUser.is_verified ? renderVerifiedBadge(13) : ''}
      </div>
      <div class="sublist-subtitle">${esc(t.sublist.followingTitle)}</div>
    </div>
    <div class="sublist-top-spacer"></div>
  </header>

  <main class="sublist-container">

    <div class="sublist-search-wrap">
      <div class="sublist-search-box">
        <span class="sublist-search-icon">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </span>
        <input type="search" id="sublistSearchInput" class="sublist-search-input" placeholder="${esc(t.sublist.searchPlaceholder)}" inputmode="search" enterkeyhint="search" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" data-lpignore="true" data-1p-ignore="true" data-form-type="other">
        <button type="button" id="sublistSearchClearBtn" class="sublist-search-clear" style="display:none;" aria-label="${esc(t.common.close)}">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>

    <div class="sublist-items" id="sublistItems">
      ${followingUsers.map(u => `
        <div class="sublist-user-row" data-username="${esc(u.username)}" data-name="${esc(u.display_name)}">
          <a href="/u/${encodeURIComponent(u.username)}" class="sublist-user-avatar">
            ${u.avatar_key
      ? `<img src="/media/${esc(u.avatar_key)}" alt="${esc(u.username)}">`
      : `<span>${esc((u.display_name || u.username).charAt(0).toUpperCase())}</span>`
    }
          </a>
          <a href="/u/${encodeURIComponent(u.username)}" class="sublist-user-meta">
            <div class="sublist-user-username">
              <span>${esc(u.username)}</span>
              ${u.is_verified ? renderVerifiedBadge(13) : ''}
            </div>
            <div class="sublist-user-display">${esc(u.display_name)}</div>
          </a>
          ${!u.is_self && currentUser ? `
            <div class="sublist-user-action">
              <button type="button" class="btn btn-sm ${u.is_following ? 'btn-secondary' : 'btn-primary'} sublist-follow-btn" data-user-id="${u.id}" data-following="${u.is_following ? '1' : '0'}">
                ${u.is_following ? esc(t.profile.following) : esc(t.profile.follow)}
              </button>
            </div>
          ` : ''}
        </div>
      `).join('')}

      <div class="sublist-empty" id="sublistEmpty" ${followingUsers.length === 0 ? '' : 'style="display:none;"'}>
        ${esc(t.sublist.noFollowing)}
      </div>
      <div class="sublist-empty" id="sublistNoResults" style="display:none;">
        ${esc(t.sublist.noResults)}
      </div>
    </div>
  </main>

  ${currentUser ? renderBottomNav('profile', t) : ''}
</div>`;

  const script = `
(function() {
  var searchInput = document.getElementById('sublistSearchInput');
  var clearBtn = document.getElementById('sublistSearchClearBtn');
  var rows = document.querySelectorAll('.sublist-user-row');
  var noResultsEl = document.getElementById('sublistNoResults');

  function filterList() {
    var q = (searchInput ? searchInput.value : '').trim().toLowerCase();
    if (clearBtn) {
      clearBtn.style.display = q ? 'inline-flex' : 'none';
    }
    var visibleCount = 0;
    rows.forEach(function(row) {
      var u = (row.dataset.username || '').toLowerCase();
      var n = (row.dataset.name || '').toLowerCase();
      if (!q || u.indexOf(q) !== -1 || n.indexOf(q) !== -1) {
        row.style.display = 'flex';
        visibleCount++;
      } else {
        row.style.display = 'none';
      }
    });
    if (noResultsEl) {
      noResultsEl.style.display = (rows.length > 0 && visibleCount === 0) ? 'block' : 'none';
    }
  }

  if (searchInput) {
    searchInput.addEventListener('input', filterList);
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', function() {
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      filterList();
    });
  }

  document.querySelectorAll('.sublist-follow-btn').forEach(function(btn) {
    btn.addEventListener('click', async function(e) {
      e.preventDefault();
      e.stopPropagation();
      var targetId = this.dataset.userId;
      if (!targetId || this.disabled) return;
      this.disabled = true;
      try {
        var res = await fetch('/api/profile/follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_id: Number(targetId) })
        });
        var data = await res.json();
        if (res.ok && data.success) {
          var isNowFollowing = Boolean(data.is_following);
          this.dataset.following = isNowFollowing ? '1' : '0';
          this.className = 'btn btn-sm ' + (isNowFollowing ? 'btn-secondary' : 'btn-primary') + ' sublist-follow-btn';
          this.textContent = isNowFollowing ? ${safeJsonForScript(t.profile.following)} : ${safeJsonForScript(t.profile.follow)};
        }
      } catch(err) {}
      this.disabled = false;
    });
  });

  var backBtn = document.querySelector('.sublist-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', function(e) {
      if (window.history.length > 1) {
        e.preventDefault();
        window.history.back();
      }
    });
  }
})();`;

  return layout(
    `${targetUser.username} - ${t.sublist.followingTitle}`,
    body,
    script,
    t,
    theme
  );
}
