import { Translations } from '../languages/types';
import { ru } from '../languages/ru';

export const COMMENT_ICON = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;

export const MINI_COMMENT_ICON = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;

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
    <form class="comments-sheet-form" id="appCommentsSheetForm">
      <input type="text" class="comment-input" id="appCommentsSheetInput" placeholder="${t.comments.inputPlaceholder}" maxlength="500" autocomplete="off">
      <button type="submit" class="comment-submit-btn" id="appCommentsSheetSubmitBtn" disabled>${t.comments.send}</button>
    </form>
  </div>
</div>`;
}

export function renderCommentsSheetScript(t: Translations = ru): string {
  const dateLocale = t.code === 'kz' ? 'kk-KZ' : t.code === 'uz' ? 'uz-UZ' : t.code === 'en' ? 'en-US' : 'ru-RU';
  const i18n = JSON.stringify({
    dateLocale,
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
  var list = document.getElementById('appCommentsSheetList');
  var countEl = document.getElementById('appCommentsSheetCount');
  var form = document.getElementById('appCommentsSheetForm');
  var input = document.getElementById('appCommentsSheetInput');
  var submitBtn = document.getElementById('appCommentsSheetSubmitBtn');
  var closeBtn = document.getElementById('appCommentsSheetCloseBtn');

  var currentPostId = null;
  var currentOptions = null;
  var isSubmitting = false;

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

  function formatTime(dateStr) {
    try {
      var d = new Date(dateStr.replace(' ', 'T') + 'Z');
      if (isNaN(d.getTime())) return dateStr;
      var now = Date.now();
      var diff = Math.floor((now - d.getTime()) / 1000);
      if (diff < 60) return i18n.justNow;
      if (diff < 3600) return Math.floor(diff / 60) + ' ' + i18n.minShort;
      if (diff < 86400) return Math.floor(diff / 3600) + ' ' + i18n.hoursShort;
      if (diff < 7 * 86400) return Math.floor(diff / 86400) + ' ' + i18n.daysShort;
      return d.toLocaleDateString(i18n.dateLocale, { day: 'numeric', month: 'short' });
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

      html += '<div class="comment-item" id="sheetCommentItem_' + c.id + '">' +
        '<a href="/u/' + encodeURIComponent(c.username) + '" class="comment-avatar">' + avatarHtml + '</a>' +
        '<div class="comment-content-wrap">' +
          '<div>' +
            '<a href="/u/' + encodeURIComponent(c.username) + '" class="comment-author-name">' + escapeHtmlClient(c.username) + '</a>' +
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
    }

    sheet.style.display = 'flex';
    void sheet.offsetWidth;
    sheet.classList.add('visible');
    document.body.style.overflow = 'hidden';

    loadComments(postId);
  };

  window.closeCommentsSheet = function() {
    if (!sheet) return;
    sheet.classList.remove('visible');
    setTimeout(function() {
      sheet.style.display = 'none';
      document.body.style.overflow = '';
      currentPostId = null;
      currentOptions = null;
    }, 280);
  };

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
        submitBtn.textContent = '...';
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

          var itemDiv = document.createElement('div');
          itemDiv.className = 'comment-item';
          itemDiv.id = 'sheetCommentItem_' + c.id;
          itemDiv.innerHTML =
            '<a href="/u/' + encodeURIComponent(c.username) + '" class="comment-avatar">' + avatarHtml + '</a>' +
            '<div class="comment-content-wrap">' +
              '<div>' +
                '<a href="/u/' + encodeURIComponent(c.username) + '" class="comment-author-name">' + escapeHtmlClient(c.username) + '</a>' +
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
          submitBtn.textContent = i18n.sendBtn;
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

