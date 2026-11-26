import { Translations } from '../languages/types';
import { ru } from '../languages/ru';
import { getClientDateFormat } from '../languages';
import { esc, safeJsonForScript } from './layout';

export const COMMENT_ICON = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;

export const MINI_COMMENT_ICON = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;

export const SEND_COMMENT_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M21.426 11.095l-17-8A1 1 0 0 0 3.03 4.242l1.212 4.849L12 12l-7.758 2.909-1.212 4.849a.998.998 0 0 0 1.396 1.147l17-8a1 1 0 0 0 0-1.81z"/></svg>`;

export function renderCommentsSheetHtml(t: Translations = ru): string {
  return `
<div class="comments-sheet-backdrop" id="appCommentsSheet" style="display:none;">
  <div class="comments-sheet-panel" id="appCommentsSheetPanel">
    <div class="comments-sheet-header">
      <div class="comments-sheet-grabber"></div>
      <div class="comments-sheet-title">${t.comments.title} (<span id="appCommentsSheetCount">0</span>)</div>
      <button type="button" class="comments-sheet-close-btn" id="appCommentsSheetCloseBtn" aria-label="${t.common.close}">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
    <div class="comments-sheet-body" id="appCommentsSheetList">
      <div class="comment-loading">${t.comments.loading}</div>
    </div>
    <form class="comments-sheet-form" id="appCommentsSheetForm" autocomplete="off">
      <input type="text" class="comment-input" id="appCommentsSheetInput" placeholder="${t.comments.inputPlaceholder}" maxlength="500" autocomplete="off" data-lpignore="true" data-1p-ignore="true" data-form-type="other">
      <button type="submit" class="comment-submit-btn" id="appCommentsSheetSubmitBtn" aria-label="${esc(t.comments.send)}" title="${esc(t.comments.send)}" disabled>${SEND_COMMENT_ICON}</button>
    </form>
  </div>
</div>`;
}

export function renderCommentsSheetScript(t: Translations = ru): string {
  const i18n = safeJsonForScript({
    dateFmt: getClientDateFormat(t.code),
    justNow: t.common.justNow,
    minShort: t.common.minutesShort,
    hoursShort: t.common.hoursShort,
    daysShort: t.common.daysShort,
    empty: t.comments.firstCommentPrompt,
    deleteBtn: t.common.delete,
    loading: t.comments.loading,
    loadFailed: t.common.networkError,
    networkError: t.common.networkError,
    sendFailed: t.common.networkError,
    sendBtn: t.comments.send,
    deleteTitle: t.comments.deleteTitle,
    deleteConfirm: t.comments.deleteConfirm,
    cancel: t.common.cancel
  });

  return `
(function() {
  var i18n = ${i18n};
  var sheet = document.getElementById('appCommentsSheet');
  var panel = document.getElementById('appCommentsSheetPanel');
  var header = panel ? panel.querySelector('.comments-sheet-header') : null;
  var grabber = panel ? panel.querySelector('.comments-sheet-grabber') : null;
  var list = document.getElementById('appCommentsSheetList');
  var countEl = document.getElementById('appCommentsSheetCount');
  var form = document.getElementById('appCommentsSheetForm');
  var input = document.getElementById('appCommentsSheetInput');
  var submitBtn = document.getElementById('appCommentsSheetSubmitBtn');
  var closeBtn = document.getElementById('appCommentsSheetCloseBtn');

  var currentPostId = null;
  var currentOptions = null;
  var isSubmitting = false;
  var isDraggingSheet = false;
  var sheetDragStartY = 0;
  var sheetCurrentY = 0;
  var sheetLastY = 0;
  var sheetLastTime = 0;
  var sheetVelocityY = 0;
  var sheetResetTimer = null;

  function escapeHtmlClient(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderMentions(text) {
    var safe = escapeHtmlClient(text);
    return safe.replace(/@([a-z0-9._]{3,24})/gi, '<a href="/u/$1" class="mention-link">@$1</a>');
  }

  function parseDateClient(dateStr) {
    if (!dateStr) return new Date();
    var s = String(dateStr).trim();
    if (s.indexOf('T') !== -1) {
      return new Date(s.indexOf('Z') !== -1 ? s : s + 'Z');
    }
    return new Date(s.replace(' ', 'T') + 'Z');
  }

  function formatTime(dateStr) {
    try {
      var d = parseDateClient(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      var now = Date.now();
      var diff = Math.floor((now - d.getTime()) / 1000);
      if (diff < 60) return i18n.justNow;
      if (diff < 3600) return Math.floor(diff / 60) + ' ' + i18n.minShort;
      if (diff < 86400) return Math.floor(diff / 3600) + ' ' + i18n.hoursShort;
      if (diff < 7 * 86400) return Math.floor(diff / 86400) + ' ' + i18n.daysShort;
      var fmt = i18n.dateFmt;
      var day = d.getDate();
      var month = (fmt && fmt.monthsShort && fmt.monthsShort[d.getMonth()]) || '';
      return (fmt && fmt.fullPattern === 'mdy') ? (month + ' ' + day) : (day + ' ' + month);
    } catch (e) {
      return dateStr;
    }
  }

  function renderComments(comments) {
    if (!list) return;
    if (!comments || comments.length === 0) {
      list.innerHTML = '<div class="comment-empty-text">' + escapeHtmlClient(i18n.empty) + '</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < comments.length; i++) {
      var c = comments[i];
      var initial = escapeHtmlClient((c.display_name || c.username || '?').charAt(0).toUpperCase());
      var avatarHtml = c.avatar_key
        ? '<img src="/media/' + encodeURIComponent(c.avatar_key) + '" alt="' + escapeHtmlClient(c.username) + '">'
        : '<span>' + initial + '</span>';

      var deleteBtn = c.can_delete
        ? '<button type="button" class="comment-delete-btn" data-comment-id="' + c.id + '">' + escapeHtmlClient(i18n.deleteBtn) + '</button>'
        : '';

      var badge = (Number(c.is_verified) === 1 && window.renderVerifiedBadge) ? window.renderVerifiedBadge(13) : '';
      html += '<div class="comment-item" id="sheetCommentItem_' + c.id + '">' +
        '<a href="/u/' + encodeURIComponent(c.username) + '" class="comment-avatar">' + avatarHtml + '</a>' +
        '<div class="comment-content-wrap">' +
          '<div>' +
            '<a href="/u/' + encodeURIComponent(c.username) + '" class="comment-author-name">' + escapeHtmlClient(c.username) + badge + '</a>' +
            '<span class="comment-text">' + renderMentions(c.content) + '</span>' +
          '</div>' +
          '<div class="comment-meta">' +
            '<span class="comment-time">' + formatTime(c.created_at) + '</span>' +
            deleteBtn +
          '</div>' +
        '</div>' +
      '</div>';
    }

    list.innerHTML = html;
  }

  async function loadComments(postId) {
    if (!list) return;
    list.innerHTML = '<div class="comment-loading">' + escapeHtmlClient(i18n.loading) + '</div>';

    try {
      var res = await fetch('/api/posts/comments?post_id=' + encodeURIComponent(postId));
      var data = await res.json();
      if (res.ok && data.success) {
        renderComments(data.comments || []);
        var count = typeof data.comments_count === 'number' ? data.comments_count : 0;
        if (countEl) countEl.textContent = count;
        if (currentOptions && typeof currentOptions.onCountUpdate === 'function') {
          currentOptions.onCountUpdate(count);
        }
      } else {
        list.innerHTML = '<div class="comment-empty-text">' + escapeHtmlClient(i18n.loadFailed) + '</div>';
      }
    } catch (err) {
      list.innerHTML = '<div class="comment-empty-text">' + escapeHtmlClient(i18n.networkError) + '</div>';
    }
  }

  window.openCommentsSheet = function(postId, options) {
    if (!sheet) return;
    currentPostId = postId;
    currentOptions = options || {};

    var initialCount = parseInt(currentOptions.initialCount, 10) || 0;
    if (countEl) countEl.textContent = initialCount;

    if (input) {
      input.value = '';
    }
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.remove('active');
      submitBtn.classList.remove('sending');
    }
    if (sheetResetTimer) {
      clearTimeout(sheetResetTimer);
      sheetResetTimer = null;
    }
    isDraggingSheet = false;
    sheetCurrentY = 0;
    sheet.style.transition = '';
    sheet.style.opacity = '';
    if (panel) {
      panel.style.transition = '';
      panel.style.transform = '';
    }

    sheet.style.display = 'flex';
    void sheet.offsetWidth;
    requestAnimationFrame(function() {
      if (sheet) sheet.classList.add('visible');
    });
    document.body.style.overflow = 'hidden';

    loadComments(postId);
  };

  window.closeCommentsSheet = function(fromSwipe) {
    if (!sheet) return;
    isDraggingSheet = false;
    sheetCurrentY = 0;
    sheet.style.transition = '';
    sheet.style.opacity = '';
    if (fromSwipe !== true && panel) {
      panel.style.transition = '';
      panel.style.transform = '';
    }
    sheet.classList.remove('visible');
    if (sheetResetTimer) clearTimeout(sheetResetTimer);
    sheetResetTimer = setTimeout(function() {
      sheet.style.display = 'none';
      sheet.style.transition = '';
      sheet.style.opacity = '';
      if (panel) {
        panel.style.transition = '';
        panel.style.transform = '';
      }
      document.body.style.overflow = '';
      currentPostId = null;
      currentOptions = null;
      sheetResetTimer = null;
    }, 320);
  };

  function canDragSheet() {
    if (!panel || !sheet || !sheet.classList.contains('visible')) return false;
    if (!grabber) return false;
    return window.getComputedStyle(grabber).display !== 'none';
  }

  function startSheetDrag(clientY) {
    if (!canDragSheet()) return;
    if (sheetResetTimer) {
      clearTimeout(sheetResetTimer);
      sheetResetTimer = null;
    }
    isDraggingSheet = true;
    sheetDragStartY = clientY - sheetCurrentY;
    sheetLastY = clientY;
    sheetLastTime = performance.now();
    sheetVelocityY = 0;
    panel.style.transition = 'none';
    sheet.style.transition = 'none';
  }

  function moveSheetDrag(clientY) {
    if (!isDraggingSheet || !panel) return;
    var dy = clientY - sheetDragStartY;
    if (dy < 0) dy = 0;
    var now = performance.now();
    var dt = now - sheetLastTime;
    if (dt > 0) {
      sheetVelocityY = (clientY - sheetLastY) / dt;
    }
    sheetLastY = clientY;
    sheetLastTime = now;
    sheetCurrentY = dy;
    panel.style.transform = 'translate3d(0, ' + dy + 'px, 0)';
    var panelHeight = panel.offsetHeight || 400;
    var progress = Math.min(1, dy / panelHeight);
    sheet.style.opacity = String(1 - progress * 0.65);
  }

  function endSheetDrag() {
    if (!isDraggingSheet || !panel) return;
    isDraggingSheet = false;
    var panelHeight = panel.offsetHeight || 400;
    var closeThreshold = Math.min(panelHeight * 0.28, 140);
    sheet.style.transition = '';
    if (sheetCurrentY > closeThreshold || (sheetCurrentY > 40 && sheetVelocityY > 0.55)) {
      panel.style.transition = 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.24s ease';
      void panel.offsetHeight;
      panel.style.transform = 'translate3d(0, 100%, 0)';
      window.closeCommentsSheet(true);
    } else {
      sheet.style.opacity = '';
      panel.style.transition = 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)';
      void panel.offsetHeight;
      panel.style.transform = 'translate3d(0, 0, 0)';
      sheetCurrentY = 0;
      if (sheetResetTimer) clearTimeout(sheetResetTimer);
      sheetResetTimer = setTimeout(function() {
        if (panel && !isDraggingSheet) {
          panel.style.transition = '';
          panel.style.transform = '';
        }
        sheetResetTimer = null;
      }, 310);
    }
  }

  if (header) {
    header.addEventListener('touchstart', function(e) {
      if (!e.touches || e.touches.length !== 1) return;
      if (e.target && e.target.closest && e.target.closest('.comments-sheet-close-btn')) return;
      startSheetDrag(e.touches[0].clientY);
    }, { passive: true });

    header.addEventListener('touchmove', function(e) {
      if (!isDraggingSheet || !e.touches || e.touches.length !== 1) return;
      if (e.cancelable) e.preventDefault();
      moveSheetDrag(e.touches[0].clientY);
    }, { passive: false });

    header.addEventListener('touchend', endSheetDrag);
    header.addEventListener('touchcancel', endSheetDrag);

    header.addEventListener('mousedown', function(e) {
      if (e.button !== 0) return;
      if (e.target && e.target.closest && e.target.closest('.comments-sheet-close-btn')) return;
      if (!canDragSheet()) return;
      e.preventDefault();
      startSheetDrag(e.clientY);
    });

    window.addEventListener('mousemove', function(e) {
      if (!isDraggingSheet) return;
      moveSheetDrag(e.clientY);
    });

    window.addEventListener('mouseup', endSheetDrag);
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', window.closeCommentsSheet);
  }

  if (sheet) {
    sheet.addEventListener('click', function(e) {
      if (e.target === sheet) {
        window.closeCommentsSheet();
      }
    });
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && sheet && sheet.classList.contains('visible')) {
      window.closeCommentsSheet();
    }
  });

  if (input) {
    input.addEventListener('input', function() {
      var val = (this.value || '').trim();
      if (submitBtn) {
        if (val.length > 0 && val.length <= 500) {
          submitBtn.disabled = false;
          submitBtn.classList.add('active');
        } else {
          submitBtn.disabled = true;
          submitBtn.classList.remove('active');
        }
      }
    });
  }

  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      if (!currentPostId || isSubmitting) return;
      var text = input ? (input.value || '').trim() : '';
      if (!text || text.length > 500) return;

      isSubmitting = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('sending');
      }

      try {
        var res = await fetch('/api/posts/comment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ post_id: parseInt(currentPostId, 10), content: text })
        });
        var data = await res.json();
        if (res.ok && data.success) {
          if (input) input.value = '';
          var emptyEl = list.querySelector('.comment-empty-text');
          if (emptyEl) emptyEl.remove();

          var c = data.comment;
          var initial = escapeHtmlClient((c.display_name || c.username || '?').charAt(0).toUpperCase());
          var avatarHtml = c.avatar_key
            ? '<img src="/media/' + encodeURIComponent(c.avatar_key) + '" alt="' + escapeHtmlClient(c.username) + '">'
            : '<span>' + initial + '</span>';

          var badge = (Number(c.is_verified) === 1 && window.renderVerifiedBadge) ? window.renderVerifiedBadge(13) : '';
          var itemDiv = document.createElement('div');
          itemDiv.className = 'comment-item';
          itemDiv.id = 'sheetCommentItem_' + c.id;
          itemDiv.innerHTML =
            '<a href="/u/' + encodeURIComponent(c.username) + '" class="comment-avatar">' + avatarHtml + '</a>' +
            '<div class="comment-content-wrap">' +
              '<div>' +
                '<a href="/u/' + encodeURIComponent(c.username) + '" class="comment-author-name">' + escapeHtmlClient(c.username) + badge + '</a>' +
                '<span class="comment-text">' + renderMentions(c.content) + '</span>' +
              '</div>' +
              '<div class="comment-meta">' +
                '<span class="comment-time">' + escapeHtmlClient(i18n.justNow) + '</span>' +
                '<button type="button" class="comment-delete-btn" data-comment-id="' + c.id + '">' + escapeHtmlClient(i18n.deleteBtn) + '</button>' +
              '</div>' +
            '</div>';

          list.appendChild(itemDiv);
          list.scrollTop = list.scrollHeight;

          var newCount = data.comments_count || 1;
          if (countEl) countEl.textContent = newCount;
          if (currentOptions && typeof currentOptions.onCountUpdate === 'function') {
            currentOptions.onCountUpdate(newCount);
          }
        } else {
          if (res.status === 401 || (data && data.error && data.error.includes('авториз'))) {
            if (window.showAppAlert) window.showAppAlert({ isAuth: true, message: data ? data.error : '' });
          } else {
            if (window.showAppAlert) window.showAppAlert({ message: data ? data.error : escapeHtmlClient(i18n.sendFailed) });
          }
        }
      } catch (err) {
        if (window.showAppAlert) window.showAppAlert({ message: escapeHtmlClient(i18n.sendFailed) });
      } finally {
        isSubmitting = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.classList.remove('sending');
          if ((input.value || '').trim()) {
            submitBtn.classList.add('active');
          } else {
            submitBtn.classList.remove('active');
            submitBtn.disabled = true;
          }
        }
      }
    });
  }

  if (list) {
    list.addEventListener('click', async function(e) {
      var delBtn = e.target.closest('.comment-delete-btn');
      if (!delBtn) return;
      var commentId = parseInt(delBtn.dataset.commentId, 10);
      if (!commentId || isNaN(commentId)) return;

      async function doDelete() {
        delBtn.disabled = true;
        delBtn.textContent = '...';

        try {
          var res = await fetch('/api/posts/comment/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ comment_id: commentId })
          });
          var data = await res.json();
          if (res.ok && data.success) {
            var item = document.getElementById('sheetCommentItem_' + commentId);
            if (item) item.remove();

            var newCount = typeof data.comments_count === 'number' ? data.comments_count : 0;
            if (countEl) countEl.textContent = newCount;
            if (currentOptions && typeof currentOptions.onCountUpdate === 'function') {
              currentOptions.onCountUpdate(newCount);
            }

            if (list.children.length === 0) {
              list.innerHTML = '<div class="comment-empty-text">' + escapeHtmlClient(i18n.empty) + '</div>';
            }
          } else {
            if (res.status === 401 || (data && data.error && data.error.includes('авториз'))) {
              if (window.showAppAlert) window.showAppAlert({ isAuth: true, message: data ? data.error : '' });
            } else {
              if (window.showAppAlert) window.showAppAlert({ message: data ? data.error : escapeHtmlClient(i18n.loadFailed) });
            }
            delBtn.disabled = false;
            delBtn.textContent = i18n.deleteBtn;
          }
        } catch (err) {
          if (window.showAppAlert) window.showAppAlert({ message: escapeHtmlClient(i18n.networkError) });
          delBtn.disabled = false;
          delBtn.textContent = i18n.deleteBtn;
        }
      }

      if (window.showAppConfirm) {
        window.showAppConfirm({
          title: i18n.deleteTitle,
          message: i18n.deleteConfirm,
          okText: i18n.deleteBtn,
          cancelText: i18n.cancel,
          onOk: doDelete
        });
      } else {
        doDelete();
      }
    });
  }
})();
`;
}

