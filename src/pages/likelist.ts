import { Translations } from '../languages/types';
import { ru } from '../languages/ru';
import { esc, safeJsonForScript } from './layout';

const CLOSE_LIKE_LIST_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

export function renderLikeListHtml(t: Translations = ru): string {
  return `
<div class="likelist-sheet-backdrop notranslate" id="appLikeListSheet" style="display:none;" aria-hidden="true" translate="no">
  <div class="likelist-sheet-panel" id="appLikeListPanel" role="dialog" aria-modal="true" aria-labelledby="appLikeListTitle">
    <div class="likelist-sheet-header" id="appLikeListHeader">
      <button type="button" class="likelist-sheet-grabber-hit" id="appLikeListGrabberBtn" aria-label="${esc(t.common.close)}">
        <span class="likelist-sheet-grabber" aria-hidden="true"></span>
      </button>
      <div class="likelist-sheet-title" id="appLikeListTitle">${esc(t.likeList.title)} (<span id="appLikeListCount">0</span>)</div>
      <button type="button" class="likelist-sheet-close-btn" id="appLikeListCloseBtn" aria-label="${esc(t.common.close)}">${CLOSE_LIKE_LIST_ICON}</button>
    </div>
    <div class="likelist-sheet-body" id="appLikeListBody"></div>
  </div>
</div>`;
}

export function renderLikeListScript(t: Translations = ru): string {
  const cfg = safeJsonForScript({
    title: t.likeList.title,
    empty: t.likeList.empty,
    loadMore: t.likeList.loadMore,
    loading: t.common.loading,
    networkError: t.common.networkError,
    follow: t.profile.follow,
    following: t.profile.following,
    unfollowTitle: t.profile.unfollowTitle,
    unfollowConfirmTpl: t.profile.unfollowConfirm('{username}'),
    unfollowBtn: t.profile.unfollowBtn,
    cancelBtn: t.common.cancel,
  });

  return `
(function() {
  var cfg = ${cfg};
  var sheet = document.getElementById('appLikeListSheet');
  var panel = document.getElementById('appLikeListPanel');
  var header = document.getElementById('appLikeListHeader');
  var grabberBtn = document.getElementById('appLikeListGrabberBtn');
  var bodyEl = document.getElementById('appLikeListBody');
  var countEl = document.getElementById('appLikeListCount');
  var closeBtn = document.getElementById('appLikeListCloseBtn');

  var activeTarget = null;
  var activeOffset = 0;
  var activeHasMore = false;
  var activeViewerId = 0;
  var activeReqSeq = 0;
  var isLoadingMore = false;
  var isDragging = false;
  var dragStartY = 0;
  var dragCurrentY = 0;
  var dragMaxMoved = 0;
  var dragLastY = 0;
  var dragLastTime = 0;
  var dragVelocityY = 0;
  var dragStartedOnGrabber = false;
  var resetTimer = null;
  var touchGuardStartY = 0;

  function syncBodyScroll() {
    var selfOpen = Boolean(sheet && sheet.classList.contains('visible'));
    var hasOpen = selfOpen || Boolean(document.querySelector('.modal-backdrop.visible, .comments-sheet-backdrop.visible, .share-sheet-backdrop.visible'));
    document.body.style.overflow = hasOpen ? 'hidden' : '';
    document.documentElement.style.overflow = selfOpen ? 'hidden' : '';
    document.documentElement.style.overscrollBehavior = selfOpen ? 'none' : '';
  }

  function safeAvatarUrl(rawKey) {
    if (!rawKey || typeof rawKey !== 'string') return '';
    var k = rawKey.trim();
    if (!k || k.indexOf('avatars/') !== 0 || k.indexOf('..') !== -1 || k.indexOf('\\\\') !== -1) return '';
    return '/media/' + encodeURIComponent(k);
  }

  function formatCount(n) {
    var num = Math.max(0, Math.floor(Number(n) || 0));
    if (typeof window.formatPhotogramCompactCount === 'function') {
      return window.formatPhotogramCompactCount(num);
    }
    return String(num);
  }

  function buildUserRow(u) {
    var row = document.createElement('div');
    row.className = 'likelist-user-row';
    row.setAttribute('data-user-id', String(u.id));

    var link = document.createElement('a');
    link.className = 'likelist-user-link';
    link.href = '/u/' + encodeURIComponent(u.username);
    link.addEventListener('click', function() {
      if (sheet) {
        sheet.classList.remove('visible');
        sheet.style.display = 'none';
        sheet.setAttribute('aria-hidden', 'true');
      }
      syncBodyScroll();
    });

    var av = document.createElement('div');
    av.className = 'likelist-avatar';
    var avUrl = safeAvatarUrl(u.avatar_key);
    if (avUrl) {
      var img = document.createElement('img');
      img.src = avUrl;
      img.alt = u.username || '';
      img.loading = 'lazy';
      av.appendChild(img);
    } else {
      var sp = document.createElement('span');
      sp.textContent = (u.display_name || u.username || '?').charAt(0).toUpperCase();
      av.appendChild(sp);
    }

    var meta = document.createElement('div');
    meta.className = 'likelist-user-meta';

    var unameLine = document.createElement('div');
    unameLine.className = 'likelist-username';
    var unameSpan = document.createElement('span');
    unameSpan.textContent = u.username || '';
    unameLine.appendChild(unameSpan);
    if (u.is_verified && typeof window.renderVerifiedBadge === 'function') {
      var badgeWrap = document.createElement('span');
      badgeWrap.innerHTML = window.renderVerifiedBadge(13);
      unameLine.appendChild(badgeWrap);
    }
    meta.appendChild(unameLine);

    if (u.display_name && u.display_name !== u.username) {
      var dname = document.createElement('div');
      dname.className = 'likelist-display-name';
      dname.textContent = u.display_name;
      meta.appendChild(dname);
    }

    link.appendChild(av);
    link.appendChild(meta);
    row.appendChild(link);

    if (activeViewerId > 0 && Number(u.id) !== Number(activeViewerId)) {
      var fBtn = document.createElement('button');
      fBtn.type = 'button';
      var isF = Boolean(u.is_following);
      fBtn.className = 'likelist-follow-btn' + (isF ? ' following' : '');
      fBtn.textContent = isF ? cfg.following : cfg.follow;
      fBtn.setAttribute('data-following', isF ? '1' : '0');
      fBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (fBtn.disabled) return;
        var curF = fBtn.getAttribute('data-following') === '1';
        function runFollow() {
          fBtn.disabled = true;
          fetch('/api/users/follow', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ following_id: Number(u.id) })
          })
            .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, status: r.status, data: d }; }); })
            .then(function(res) {
              if (res.ok && res.data && res.data.success) {
                var nextF = Boolean(res.data.is_following);
                fBtn.setAttribute('data-following', nextF ? '1' : '0');
                fBtn.textContent = nextF ? cfg.following : cfg.follow;
                if (nextF) fBtn.classList.add('following');
                else fBtn.classList.remove('following');
              } else if (res.status === 401 && window.showAppAlert) {
                window.showAppAlert({ isAuth: true, message: res.data ? res.data.error : '' });
              } else if (window.showAppToast) {
                window.showAppToast((res.data && res.data.error) || cfg.networkError);
              }
            })
            .catch(function() {
              if (window.showAppToast) window.showAppToast(cfg.networkError);
            })
            .finally(function() {
              fBtn.disabled = false;
            });
        }
        if (curF && window.showAppConfirm) {
          window.showAppConfirm({
            type: 'unfollow',
            title: cfg.unfollowTitle,
            message: cfg.unfollowConfirmTpl.replace('{username}', u.username || ''),
            okText: cfg.unfollowBtn,
            cancelText: cfg.cancelBtn,
            onOk: runFollow
          });
        } else {
          runFollow();
        }
      });
      row.appendChild(fBtn);
    }

    return row;
  }

  function renderLoadMoreButton() {
    if (!bodyEl) return;
    var oldBtn = bodyEl.querySelector('.likelist-load-more-btn');
    if (oldBtn) oldBtn.remove();
    if (!activeHasMore) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-secondary btn-sm likelist-load-more-btn';
    btn.textContent = cfg.loadMore;
    btn.addEventListener('click', function() {
      if (isLoadingMore || !activeTarget) return;
      btn.disabled = true;
      btn.textContent = cfg.loading;
      fetchLikesPage(activeTarget, activeOffset, true);
    });
    bodyEl.appendChild(btn);
  }

  async function fetchLikesPage(target, offset, append) {
    if (!bodyEl || !target) return;
    var mySeq = append ? activeReqSeq : ++activeReqSeq;
    isLoadingMore = true;
    if (!append) {
      while (bodyEl.firstChild) bodyEl.removeChild(bodyEl.firstChild);
      var ld = document.createElement('div');
      ld.className = 'likelist-state-msg';
      ld.textContent = cfg.loading;
      bodyEl.appendChild(ld);
    }
    try {
      var endpoint = target.commentId
        ? ('/api/posts/comment/likes?comment_id=' + encodeURIComponent(String(target.commentId)) + '&offset=' + offset)
        : ('/api/posts/likes?post_id=' + encodeURIComponent(String(target.postId)) + '&offset=' + offset);
      var res = await fetch(endpoint, { credentials: 'same-origin', cache: 'no-store' });
      var data = await res.json();
      if (mySeq !== activeReqSeq) return;
      if (!res.ok || !data || !data.success) {
        if (!append) {
          while (bodyEl.firstChild) bodyEl.removeChild(bodyEl.firstChild);
          var errEl = document.createElement('div');
          errEl.className = 'likelist-state-msg';
          errEl.textContent = (data && data.error) || cfg.networkError;
          bodyEl.appendChild(errEl);
        }
        return;
      }
      activeViewerId = Number(data.current_user_id || 0);
      var total = typeof data.total_count === 'number' ? data.total_count : 0;
      if (countEl) countEl.textContent = formatCount(total);
      var users = Array.isArray(data.users) ? data.users : [];
      activeHasMore = Boolean(data.has_more);
      activeOffset = offset + users.length;

      if (!append) {
        while (bodyEl.firstChild) bodyEl.removeChild(bodyEl.firstChild);
      } else {
        var oldMore = bodyEl.querySelector('.likelist-load-more-btn');
        if (oldMore) oldMore.remove();
      }

      if (!append && users.length === 0) {
        var emp = document.createElement('div');
        emp.className = 'likelist-state-msg';
        emp.textContent = cfg.empty;
        bodyEl.appendChild(emp);
        return;
      }

      var frag = document.createDocumentFragment();
      for (var i = 0; i < users.length; i++) {
        frag.appendChild(buildUserRow(users[i]));
      }
      bodyEl.appendChild(frag);
      renderLoadMoreButton();
    } catch (e) {
      if (mySeq !== activeReqSeq) return;
      if (!append) {
        while (bodyEl.firstChild) bodyEl.removeChild(bodyEl.firstChild);
        var netErr = document.createElement('div');
        netErr.className = 'likelist-state-msg';
        netErr.textContent = cfg.networkError;
        bodyEl.appendChild(netErr);
      }
    } finally {
      if (mySeq === activeReqSeq) isLoadingMore = false;
    }
  }

  window.openLikeList = function(opts) {
    if (!sheet || !panel || !opts) return;
    var postId = parseInt(opts.postId || '0', 10) || 0;
    var commentId = parseInt(opts.commentId || '0', 10) || 0;
    if (!postId && !commentId) return;

    if (resetTimer) {
      clearTimeout(resetTimer);
      resetTimer = null;
    }
    isDragging = false;
    dragCurrentY = 0;
    dragMaxMoved = 0;
    activeTarget = commentId ? { commentId: commentId } : { postId: postId };
    activeOffset = 0;
    activeHasMore = false;

    if (countEl && opts.initialCount !== undefined) {
      countEl.textContent = formatCount(opts.initialCount);
    }

    sheet.style.transition = '';
    sheet.style.opacity = '';
    sheet.style.backgroundColor = '';
    panel.style.transition = '';
    panel.style.transform = '';
    sheet.style.display = 'flex';
    sheet.setAttribute('aria-hidden', 'false');
    void sheet.offsetWidth;
    sheet.classList.add('visible');
    syncBodyScroll();

    if (window.__pgPushOverlay) {
      window.__pgPushOverlay('like-list', function(fromPop) {
        window.closeLikeList(false, fromPop);
      });
    }

    fetchLikesPage(activeTarget, 0, false);
  };

  window.closeLikeList = function(fromSwipe, fromPop) {
    if (!sheet) return;
    isDragging = false;
    dragCurrentY = 0;
    dragMaxMoved = 0;
    activeReqSeq++;
    if (resetTimer) {
      clearTimeout(resetTimer);
      resetTimer = null;
    }
    if (fromPop) {
      sheet.classList.add('pg-no-transition');
      sheet.classList.remove('visible');
      sheet.style.display = 'none';
      sheet.setAttribute('aria-hidden', 'true');
      sheet.style.transition = '';
      sheet.style.opacity = '';
      sheet.style.backgroundColor = '';
      if (panel) {
        panel.style.transition = '';
        panel.style.transform = '';
      }
      void sheet.offsetWidth;
      sheet.classList.remove('pg-no-transition');
      activeTarget = null;
      syncBodyScroll();
      return;
    }
    sheet.style.transition = '';
    sheet.style.opacity = '';
    sheet.style.backgroundColor = '';
    if (fromSwipe !== true && panel) {
      panel.style.transition = '';
      panel.style.transform = '';
    }
    sheet.classList.remove('visible');
    sheet.setAttribute('aria-hidden', 'true');
    if (window.__pgPopOverlay) {
      window.__pgPopOverlay('like-list');
    }
    resetTimer = setTimeout(function() {
      sheet.style.display = 'none';
      sheet.style.transition = '';
      sheet.style.opacity = '';
      sheet.style.backgroundColor = '';
      if (panel) {
        panel.style.transition = '';
        panel.style.transform = '';
      }
      activeTarget = null;
      resetTimer = null;
      syncBodyScroll();
    }, 320);
  };

  function isMobileSheetMode() {
    if (!panel || !sheet || !sheet.classList.contains('visible')) return false;
    if (!grabberBtn) return false;
    return window.getComputedStyle(grabberBtn).display !== 'none';
  }

  function startDrag(clientY, onGrabber) {
    if (!isMobileSheetMode()) return;
    if (resetTimer) {
      clearTimeout(resetTimer);
      resetTimer = null;
    }
    isDragging = true;
    dragStartedOnGrabber = Boolean(onGrabber);
    dragStartY = clientY - dragCurrentY;
    dragLastY = clientY;
    dragMaxMoved = 0;
    dragLastTime = performance.now();
    dragVelocityY = 0;
    panel.style.transition = 'none';
    sheet.style.transition = 'none';
  }

  function moveDrag(clientY) {
    if (!isDragging || !panel) return;
    var dy = clientY - dragStartY;
    if (dy < 0) dy = 0;
    if (dy > dragMaxMoved) dragMaxMoved = dy;
    var now = performance.now();
    var dt = now - dragLastTime;
    if (dt > 0) {
      dragVelocityY = (clientY - dragLastY) / dt;
    }
    dragLastY = clientY;
    dragLastTime = now;
    dragCurrentY = dy;
    panel.style.transform = 'translate3d(0, ' + dy + 'px, 0)';
    var panelHeight = panel.offsetHeight || 400;
    var progress = Math.min(1, dy / panelHeight);
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    var baseAlpha = isDark ? 0.75 : 0.6;
    sheet.style.backgroundColor = 'rgba(0, 0, 0, ' + Math.max(0.05, baseAlpha * (1 - progress * 0.75)).toFixed(3) + ')';
  }

  function endDrag() {
    if (!isDragging || !panel) return;
    isDragging = false;
    var panelHeight = panel.offsetHeight || 400;
    var closeThreshold = Math.min(panelHeight * 0.25, 120);
    sheet.style.transition = '';
    var wasGrabberTap = dragStartedOnGrabber && dragMaxMoved < 8;
    if (wasGrabberTap || dragCurrentY > closeThreshold || (dragCurrentY > 36 && dragVelocityY > 0.45)) {
      panel.style.transition = 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)';
      void panel.offsetHeight;
      panel.style.transform = 'translate3d(0, 100%, 0)';
      window.closeLikeList(true, false);
    } else {
      sheet.style.backgroundColor = '';
      panel.style.transition = 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)';
      void panel.offsetHeight;
      panel.style.transform = 'translate3d(0, 0, 0)';
      dragCurrentY = 0;
      if (resetTimer) clearTimeout(resetTimer);
      resetTimer = setTimeout(function() {
        if (panel && !isDragging) {
          panel.style.transition = '';
          panel.style.transform = '';
        }
        resetTimer = null;
      }, 310);
    }
  }

  if (header) {
    header.addEventListener('touchstart', function(e) {
      if (!e.touches || e.touches.length !== 1) return;
      if (e.target && e.target.closest && e.target.closest('.likelist-sheet-close-btn')) return;
      var onGrab = Boolean(e.target && e.target.closest && e.target.closest('#appLikeListGrabberBtn'));
      startDrag(e.touches[0].clientY, onGrab);
    }, { passive: true });

    header.addEventListener('touchmove', function(e) {
      if (!isDragging || !e.touches || e.touches.length !== 1) return;
      if (e.cancelable) e.preventDefault();
      moveDrag(e.touches[0].clientY);
    }, { passive: false });

    header.addEventListener('touchend', endDrag);
    header.addEventListener('touchcancel', endDrag);

    header.addEventListener('mousedown', function(e) {
      if (e.button !== 0) return;
      if (e.target && e.target.closest && e.target.closest('.likelist-sheet-close-btn')) return;
      if (!isMobileSheetMode()) return;
      e.preventDefault();
      var onGrab = Boolean(e.target && e.target.closest && e.target.closest('#appLikeListGrabberBtn'));
      startDrag(e.clientY, onGrab);
    });

    window.addEventListener('mousemove', function(e) {
      if (!isDragging) return;
      moveDrag(e.clientY);
    });

    window.addEventListener('mouseup', endDrag);
  }

  if (grabberBtn) {
    grabberBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (sheet && sheet.classList.contains('visible')) {
        panel.style.transition = 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.24s ease';
        void panel.offsetHeight;
        panel.style.transform = 'translate3d(0, 100%, 0)';
        window.closeLikeList(true, false);
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      window.closeLikeList(false, false);
    });
  }

  if (sheet) {
    sheet.addEventListener('click', function(e) {
      if (e.target === sheet) {
        window.closeLikeList(false, false);
      }
    });

    sheet.addEventListener('wheel', function(e) {
      if (!sheet.classList.contains('visible')) return;
      var inBody = Boolean(bodyEl && e.target && bodyEl.contains(e.target));
      if (!inBody) {
        if (e.cancelable) e.preventDefault();
        return;
      }
      var canScroll = bodyEl.scrollHeight > bodyEl.clientHeight + 1;
      if (!canScroll) {
        if (e.cancelable) e.preventDefault();
        return;
      }
      var atTop = bodyEl.scrollTop <= 0 && e.deltaY < 0;
      var atBottom = bodyEl.scrollTop + bodyEl.clientHeight >= bodyEl.scrollHeight - 1 && e.deltaY > 0;
      if (atTop || atBottom) {
        if (e.cancelable) e.preventDefault();
      }
    }, { passive: false });

    sheet.addEventListener('touchstart', function(e) {
      if (e.touches && e.touches.length === 1) {
        touchGuardStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    sheet.addEventListener('touchmove', function(e) {
      if (!sheet.classList.contains('visible') || !e.touches || e.touches.length !== 1) return;
      var inBody = Boolean(bodyEl && e.target && bodyEl.contains(e.target));
      if (!inBody) {
        if (e.cancelable) e.preventDefault();
        return;
      }
      var canScroll = bodyEl.scrollHeight > bodyEl.clientHeight + 1;
      if (!canScroll) {
        if (e.cancelable) e.preventDefault();
        return;
      }
      var dy = e.touches[0].clientY - touchGuardStartY;
      var pullingDownAtTop = bodyEl.scrollTop <= 0 && dy > 0;
      var pullingUpAtBottom = bodyEl.scrollTop + bodyEl.clientHeight >= bodyEl.scrollHeight - 1 && dy < 0;
      if (pullingDownAtTop || pullingUpAtBottom) {
        if (e.cancelable) e.preventDefault();
      }
    }, { passive: false });
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && sheet && sheet.classList.contains('visible')) {
      window.closeLikeList(false, false);
    }
  });
})();
`;
}
