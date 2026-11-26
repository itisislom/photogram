import { layout, esc, safeJsonForScript, renderVerifiedBadge } from './layout';
import { renderBottomNav } from './nav';
import { Translations } from '../languages/types';
import { ru } from '../languages/ru';
import { User, FollowerUser } from '../types';

const BACK_ARROW_ICON = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>`;

export type FollowListTab = 'followers' | 'following';

function renderUserRows(list: FollowerUser[], currentUser: User | null, t: Translations): string {
  return list.map(u => `
        <div class="sublist-user-row" data-username="${esc(u.username)}" data-name="${esc(u.display_name)}">
          <a href="/u/${encodeURIComponent(u.username)}" class="sublist-user-avatar">
            ${u.avatar_key
      ? `<img src="/media/${encodeURIComponent(u.avatar_key)}" alt="${esc(u.username)}" loading="lazy">`
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
      `).join('');
}

export function followListPage(
  targetUser: User,
  followers: FollowerUser[],
  following: FollowerUser[],
  currentUser: User | null,
  initialTab: FollowListTab,
  t: Translations = ru,
  theme?: string
): string {
  const targetUsernameSafe = esc(targetUser.username);
  const targetProfileUrl = `/u/${encodeURIComponent(targetUser.username)}`;
  const isFollowing = initialTab === 'following';
  const baseUrl = `/u/${encodeURIComponent(targetUser.username)}`;

  const body = `
<div class="app-layout">
  <header class="sublist-top-bar follow-top-bar">
    <a href="${targetProfileUrl}" class="sublist-back-btn" aria-label="${esc(t.common.close)}">
      ${BACK_ARROW_ICON}
    </a>
    <div class="sublist-title-wrap">
      <div class="sublist-username">
        <span>${targetUsernameSafe}</span>
        ${targetUser.is_verified ? renderVerifiedBadge(13) : ''}
      </div>
    </div>
    <div class="sublist-top-spacer"></div>
  </header>

  <nav class="follow-tabs" role="tablist" id="followTabs">
    <button type="button" role="tab" class="follow-tab${isFollowing ? '' : ' is-active'}" id="followTabFollowers" data-tab="followers" aria-selected="${isFollowing ? 'false' : 'true'}" aria-controls="followPanelFollowers">
      <span class="follow-tab-count">${followers.length}</span>
      <span class="follow-tab-label">${esc(t.sublist.title)}</span>
    </button>
    <button type="button" role="tab" class="follow-tab${isFollowing ? ' is-active' : ''}" id="followTabFollowing" data-tab="following" aria-selected="${isFollowing ? 'true' : 'false'}" aria-controls="followPanelFollowing">
      <span class="follow-tab-count">${following.length}</span>
      <span class="follow-tab-label">${esc(t.sublist.followingTitle)}</span>
    </button>
  </nav>

  <main class="sublist-container follow-container">

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

    <div class="follow-pager" id="followPager">
      <div class="follow-track${isFollowing ? ' is-second' : ''}" id="followTrack">
        <section class="follow-panel${isFollowing ? ' is-collapsed' : ''}" id="followPanelFollowers" role="tabpanel" aria-labelledby="followTabFollowers" data-panel="followers">
          <div class="sublist-items">
            ${renderUserRows(followers, currentUser, t)}
            <div class="sublist-empty" ${followers.length === 0 ? '' : 'style="display:none;"'}>${esc(t.sublist.noFollowers)}</div>
            <div class="sublist-empty follow-no-results" style="display:none;">${esc(t.sublist.noResults)}</div>
          </div>
        </section>
        <section class="follow-panel${isFollowing ? '' : ' is-collapsed'}" id="followPanelFollowing" role="tabpanel" aria-labelledby="followTabFollowing" data-panel="following">
          <div class="sublist-items">
            ${renderUserRows(following, currentUser, t)}
            <div class="sublist-empty" ${following.length === 0 ? '' : 'style="display:none;"'}>${esc(t.sublist.noFollowing)}</div>
            <div class="sublist-empty follow-no-results" style="display:none;">${esc(t.sublist.noResults)}</div>
          </div>
        </section>
      </div>
    </div>
  </main>

  ${currentUser ? renderBottomNav('profile', t) : ''}
</div>`;

  const script = `
(function() {
  var cfg = ${safeJsonForScript({
    baseUrl,
    initialTab,
    followingLabel: t.profile.following,
    followLabel: t.profile.follow,
    titleFollowers: `${targetUser.username} - ${t.sublist.title}`,
    titleFollowing: `${targetUser.username} - ${t.sublist.followingTitle}`,
  })};

  var searchInput = document.getElementById('sublistSearchInput');
  var clearBtn = document.getElementById('sublistSearchClearBtn');
  var pager = document.getElementById('followPager');
  var track = document.getElementById('followTrack');
  var panels = [document.getElementById('followPanelFollowers'), document.getElementById('followPanelFollowing')];
  var tabs = [document.getElementById('followTabFollowers'), document.getElementById('followTabFollowing')];
  var activeIndex = cfg.initialTab === 'following' ? 1 : 0;
  var settleTimer = null;

  function isTouchLayout() {
    return (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches) || (window.innerWidth || 0) <= 900;
  }

  function filterPanel(panel) {
    if (!panel) return;
    var q = (searchInput ? searchInput.value : '').trim().toLowerCase();
    var rows = panel.querySelectorAll('.sublist-user-row');
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
    var noRes = panel.querySelector('.follow-no-results');
    if (noRes) noRes.style.display = (rows.length > 0 && visibleCount === 0) ? 'block' : 'none';
  }

  function filterAll() {
    var q = (searchInput ? searchInput.value : '').trim();
    if (clearBtn) clearBtn.style.display = q ? 'inline-flex' : 'none';
    panels.forEach(filterPanel);
  }

  function applyTrackPosition(animate) {
    if (!track) return;
    if (settleTimer) {
      clearTimeout(settleTimer);
      settleTimer = null;
    }
    track.classList.toggle('is-animating', Boolean(animate));
    track.style.transform = '';
    track.classList.toggle('is-second', activeIndex === 1);
    var finish = function() {
      track.classList.remove('is-animating');
      panels.forEach(function(p, i) {
        if (p) p.classList.toggle('is-collapsed', i !== activeIndex);
      });
    };
    if (animate) settleTimer = setTimeout(finish, 260);
    else finish();
  }

  function setActiveTab(index, animate, updateUrl) {
    var next = index === 1 ? 1 : 0;
    var changed = next !== activeIndex;
    activeIndex = next;
    tabs.forEach(function(tab, i) {
      if (!tab) return;
      tab.classList.toggle('is-active', i === activeIndex);
      tab.setAttribute('aria-selected', i === activeIndex ? 'true' : 'false');
    });
    panels.forEach(function(p) { if (p) p.classList.remove('is-collapsed'); });
    applyTrackPosition(animate);
    if (changed && updateUrl && window.history && typeof window.history.replaceState === 'function') {
      var path = cfg.baseUrl + (activeIndex === 1 ? '/subslist' : '/sublist');
      try { window.history.replaceState(window.history.state, '', path); } catch (e) {}
      document.title = activeIndex === 1 ? cfg.titleFollowing : cfg.titleFollowers;
    }
  }

  tabs.forEach(function(tab, i) {
    if (!tab) return;
    tab.addEventListener('click', function() {
      setActiveTab(i, isTouchLayout(), true);
    });
  });

  if (searchInput) searchInput.addEventListener('input', filterAll);
  if (clearBtn) {
    clearBtn.addEventListener('click', function() {
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      filterAll();
    });
  }

  var swipeZone = document.querySelector('.app-layout') || pager;
  if (swipeZone && pager && track) {
    var startX = 0;
    var startY = 0;
    var startTime = 0;
    var dragging = false;
    var locked = false;
    var cancelled = false;
    var lastDx = 0;

    swipeZone.addEventListener('touchstart', function(e) {
      if (!e.touches || e.touches.length !== 1 || !isTouchLayout()) {
        dragging = false;
        return;
      }
      if (e.target && e.target.closest && e.target.closest('.sublist-top-bar, .follow-tabs, .sublist-search-wrap, .bottom-nav, input, textarea')) {
        dragging = false;
        return;
      }
      var t0 = e.touches[0];
      startX = t0.clientX;
      startY = t0.clientY;
      startTime = Date.now();
      dragging = true;
      locked = false;
      cancelled = false;
      lastDx = 0;
    }, { passive: true });

    swipeZone.addEventListener('touchmove', function(e) {
      if (!dragging || cancelled || !e.touches || !e.touches.length) return;
      var t0 = e.touches[0];
      var dx = t0.clientX - startX;
      var dy = t0.clientY - startY;
      if (!locked) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
          cancelled = true;
          return;
        }
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          locked = true;
          if (settleTimer) {
            clearTimeout(settleTimer);
            settleTimer = null;
          }
          track.classList.remove('is-animating');
          panels.forEach(function(p) { if (p) p.classList.remove('is-collapsed'); });
        } else {
          return;
        }
      }
      if (e.cancelable) e.preventDefault();
      var width = pager.clientWidth || 1;
      var offset = dx;
      if ((activeIndex === 0 && dx > 0) || (activeIndex === 1 && dx < 0)) {
        offset = dx * 0.25;
      }
      lastDx = dx;
      var base = -activeIndex * width;
      track.style.transform = 'translate3d(' + Math.round(base + offset) + 'px, 0, 0)';
    }, { passive: false });

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      if (!locked) return;
      var width = pager.clientWidth || 1;
      var elapsed = Math.max(1, Date.now() - startTime);
      var velocity = Math.abs(lastDx) / elapsed;
      var passed = Math.abs(lastDx) > width * 0.22 || (velocity > 0.45 && Math.abs(lastDx) > 30);
      var target = activeIndex;
      if (passed && lastDx < 0 && activeIndex === 0) target = 1;
      else if (passed && lastDx > 0 && activeIndex === 1) target = 0;
      setActiveTab(target, true, true);
    }

    swipeZone.addEventListener('touchend', endDrag, { passive: true });
    swipeZone.addEventListener('touchcancel', function() {
      if (!dragging) return;
      dragging = false;
      if (locked) setActiveTab(activeIndex, true, false);
    }, { passive: true });
  }

  document.querySelectorAll('.sublist-follow-btn').forEach(function(btn) {
    btn.addEventListener('click', async function(e) {
      e.preventDefault();
      e.stopPropagation();
      var targetId = this.dataset.userId;
      if (!targetId || this.disabled) return;
      var sameButtons = document.querySelectorAll('.sublist-follow-btn[data-user-id="' + targetId + '"]');
      sameButtons.forEach(function(b) { b.disabled = true; });
      try {
        var res = await fetch('/api/profile/follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_id: Number(targetId) })
        });
        var data = await res.json();
        if (res.ok && data.success) {
          var isNowFollowing = Boolean(data.is_following);
          sameButtons.forEach(function(b) {
            b.dataset.following = isNowFollowing ? '1' : '0';
            b.className = 'btn btn-sm ' + (isNowFollowing ? 'btn-secondary' : 'btn-primary') + ' sublist-follow-btn';
            b.textContent = isNowFollowing ? cfg.followingLabel : cfg.followLabel;
          });
        }
      } catch(err) {}
      sameButtons.forEach(function(b) { b.disabled = false; });
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
    isFollowing ? `${targetUser.username} - ${t.sublist.followingTitle}` : `${targetUser.username} - ${t.sublist.title}`,
    body,
    script,
    t,
    theme
  );
}

export function sublistPage(
  targetUser: User,
  followers: FollowerUser[],
  following: FollowerUser[],
  currentUser: User | null,
  t: Translations = ru,
  theme?: string
): string {
  return followListPage(targetUser, followers, following, currentUser, 'followers', t, theme);
}
