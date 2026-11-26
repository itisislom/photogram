import { Translations } from '../languages/types';
import { ru } from '../languages/ru';
import { getClientDateFormat, getCompactCountUnits } from '../languages';
import { esc, safeJsonForScript } from './layout';

export const COMMENT_ICON = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;

export const MINI_COMMENT_ICON = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;

export const SEND_COMMENT_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M21.426 11.095l-17-8A1 1 0 0 0 3.03 4.242l1.212 4.849L12 12l-7.758 2.909-1.212 4.849a.998.998 0 0 0 1.396 1.147l17-8a1 1 0 0 0 0-1.81z"/></svg>`;
export const COMMENT_HEART_ICON = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
export const REPLY_CHEVRON_ICON = `<svg class="comment-replies-chevron" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>`;
export const REPLY_ARROW_ICON = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 10 20 15 15 20"/><path d="M4 4v7a4 4 0 0 0 4 4h12"/></svg>`;
export const PIN_COMMENT_ICON = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>`;
export const AUTHOR_HEART_MINI_ICON = `<svg viewBox="0 0 24 24" width="8" height="8" fill="currentColor" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;

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
    <div class="comments-reply-bar" id="appCommentsReplyBar" style="display:none;">
      <span class="comments-reply-bar-icon">${REPLY_ARROW_ICON}</span>
      <span class="comments-reply-bar-text" id="appCommentsReplyBarText"></span>
      <button type="button" class="comments-reply-bar-close" id="appCommentsReplyCancelBtn" aria-label="${esc(t.common.cancel)}">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
    <div class="comments-sheet-form" id="appCommentsSheetForm">
      <div class="comment-input pg-ce-input" id="appCommentsSheetInput" contenteditable="plaintext-only" role="textbox" aria-multiline="false" inputmode="text" enterkeyhint="send" data-placeholder="${esc(t.comments.inputPlaceholder)}" data-maxlength="500" aria-label="${esc(t.comments.inputPlaceholder)}"></div>
      <button type="button" class="comment-submit-btn" id="appCommentsSheetSubmitBtn" aria-label="${esc(t.comments.send)}" title="${esc(t.comments.send)}" disabled>${SEND_COMMENT_ICON}</button>
    </div>
  </div>
</div>`;
}

export function renderCommentsSheetScript(t: Translations = ru): string {
  const i18n = safeJsonForScript({
    langCode: t.code,
    compactUnits: getCompactCountUnits(t.code),
    dateFmt: getClientDateFormat(t.code),
    heartIcon: COMMENT_HEART_ICON,
    chevronIcon: REPLY_CHEVRON_ICON,
    pinIcon: PIN_COMMENT_ICON,
    authorHeartIcon: AUTHOR_HEART_MINI_ICON,
    justNow: t.common.justNow,
    minShort: t.common.minutesShort,
    hoursShort: t.common.hoursShort,
    daysShort: t.common.daysShort,
    empty: t.comments.firstCommentPrompt,
    deleteBtn: t.common.delete,
    replyBtn: t.comments.reply,
    replyingTo: t.comments.replyingTo,
    showReplies: t.comments.showReplies,
    hideReplies: t.comments.hideReplies,
    pinBtn: t.comments.pin,
    unpinBtn: t.comments.unpin,
    pinnedLabel: t.comments.pinned,
    likedByAuthor: t.comments.likedByAuthor,
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
  var replyBar = document.getElementById('appCommentsReplyBar');
  var replyBarText = document.getElementById('appCommentsReplyBarText');
  var replyCancelBtn = document.getElementById('appCommentsReplyCancelBtn');

  var currentPostId = null;
  var currentPostAuthor = null;
  var currentOptions = null;
  var isSubmitting = false;
  var likingCommentIds = {};
  var pinningCommentIds = {};
  var replyingTo = null;
  var activeCommentCtx = null;
  var commentHoldTimer = null;
  var commentHoldStartX = 0;
  var commentHoldStartY = 0;
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

  function formatCompactCountClient(count) {
    var raw = Number(count);
    if (!isFinite(raw) || raw <= 0) return '0';
    var n = Math.floor(raw);
    if (n < 1000) return String(n);
    var u = i18n.compactUnits || { k: 'K', m: 'M', b: 'B' };
    var sep = i18n.langCode === 'en' ? '' : ' ';
    function fmt(val, unit) {
      var rounded = val >= 100 ? Math.floor(val) : Math.floor(val * 10) / 10;
      var s = (rounded % 1 === 0) ? String(rounded) : rounded.toFixed(1).replace(/\\.0$/, '');
      return s + sep + unit;
    }
    if (n >= 1000000000) return fmt(n / 1000000000, u.b);
    if (n >= 1000000) return fmt(n / 1000000, u.m);
    return fmt(n / 1000, u.k);
  }

  function renderAuthorLikedBadgeHtml(likedByAuthor) {
    if (!likedByAuthor || !currentPostAuthor) return '';
    var init = escapeHtmlClient((currentPostAuthor.display_name || currentPostAuthor.username || '?').charAt(0).toUpperCase());
    var av = currentPostAuthor.avatar_key
      ? '<img src="/media/' + encodeURIComponent(currentPostAuthor.avatar_key) + '" alt="' + escapeHtmlClient(currentPostAuthor.username || '') + '">'
      : '<span>' + init + '</span>';
    return '<span class="comment-author-liked-badge" title="' + escapeHtmlClient(i18n.likedByAuthor) + '" aria-label="' + escapeHtmlClient(i18n.likedByAuthor) + '">' +
      '<span class="comment-author-liked-avatar">' + av + '</span>' +
      '<span class="comment-author-liked-heart">' + i18n.authorHeartIcon + '</span>' +
    '</span>';
  }

  function renderCommentLikeBtn(commentId, isLiked, likesCount, likedByAuthor) {
    var cnt = Number(likesCount) || 0;
    var cntTxt = cnt > 0 ? escapeHtmlClient(formatCompactCountClient(cnt)) : '';
    return '<div class="comment-like-cluster">' +
      renderAuthorLikedBadgeHtml(Boolean(likedByAuthor)) +
      '<button type="button" class="comment-like-btn' + (isLiked ? ' liked' : '') + '" data-like-comment-id="' + commentId + '" aria-pressed="' + (isLiked ? 'true' : 'false') + '">' +
        i18n.heartIcon +
        '<span class="comment-like-count">' + cntTxt + '</span>' +
      '</button>' +
    '</div>';
  }

  function renderPinnedBadgeHtml() {
    return '<div class="comment-pinned-badge">' + i18n.pinIcon + '<span>' + escapeHtmlClient(i18n.pinnedLabel) + '</span></div>';
  }

  function closeCommentCtxMenu() {
    if (activeCommentCtx && activeCommentCtx.backdrop && activeCommentCtx.backdrop.parentNode) {
      activeCommentCtx.backdrop.parentNode.removeChild(activeCommentCtx.backdrop);
    }
    if (activeCommentCtx && activeCommentCtx.menu && activeCommentCtx.menu.parentNode) {
      activeCommentCtx.menu.parentNode.removeChild(activeCommentCtx.menu);
    }
    activeCommentCtx = null;
  }

  function applyPinnedCommentUI(commentId, isPinned) {
    if (!list) return;
    list.querySelectorAll('.comment-item[data-is-pinned="1"]').forEach(function(el) {
      el.setAttribute('data-is-pinned', '0');
      var b = el.querySelector('.comment-pinned-badge');
      if (b) b.remove();
    });
    if (!isPinned || !commentId) return;
    var item = document.getElementById('sheetCommentItem_' + commentId);
    if (!item) return;
    item.setAttribute('data-is-pinned', '1');
    var wrap = item.querySelector('.comment-content-wrap');
    if (wrap && !wrap.querySelector('.comment-pinned-badge')) {
      var tmp = document.createElement('div');
      tmp.innerHTML = renderPinnedBadgeHtml();
      if (tmp.firstChild) wrap.insertBefore(tmp.firstChild, wrap.firstChild);
    }
    var thread = item.closest('.comment-thread');
    if (thread && thread.parentNode === list && list.firstChild !== thread) {
      list.insertBefore(thread, list.firstChild);
      list.scrollTop = 0;
    }
  }

  async function togglePinComment(commentId) {
    if (!commentId || pinningCommentIds[commentId]) return;
    pinningCommentIds[commentId] = true;
    try {
      var res = await fetch('/api/posts/comment/pin', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_id: commentId })
      });
      var data = await res.json();
      if (res.ok && data && data.success) {
        applyPinnedCommentUI(commentId, Boolean(data.is_pinned));
      } else if (res.status === 401 || (data && data.error && data.error.includes('авториз'))) {
        if (window.showAppAlert) window.showAppAlert({ isAuth: true, message: data ? data.error : '' });
      } else if (window.showAppAlert) {
        window.showAppAlert({ message: (data && data.error) || i18n.networkError });
      }
    } catch (e) {
      if (window.showAppAlert) window.showAppAlert({ message: i18n.networkError });
    } finally {
      delete pinningCommentIds[commentId];
    }
  }

  function openCommentCtxMenu(itemEl, clientX, clientY) {
    closeCommentCtxMenu();
    if (!itemEl || itemEl.getAttribute('data-can-pin') !== '1') return;
    var cid = parseInt(itemEl.getAttribute('data-comment-id') || '0', 10);
    if (!cid) return;
    var isPinned = itemEl.getAttribute('data-is-pinned') === '1';

    var backdrop = document.createElement('div');
    backdrop.className = 'comment-ctx-backdrop';
    backdrop.addEventListener('click', closeCommentCtxMenu);
    backdrop.addEventListener('contextmenu', function(ev) {
      ev.preventDefault();
      closeCommentCtxMenu();
    });

    var menu = document.createElement('div');
    menu.className = 'comment-ctx-menu';
    menu.setAttribute('role', 'menu');

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'comment-ctx-btn';
    btn.setAttribute('role', 'menuitem');
    btn.innerHTML = i18n.pinIcon + '<span>' + escapeHtmlClient(isPinned ? i18n.unpinBtn : i18n.pinBtn) + '</span>';
    btn.addEventListener('click', function() {
      closeCommentCtxMenu();
      togglePinComment(cid);
    });
    menu.appendChild(btn);

    document.body.appendChild(backdrop);
    document.body.appendChild(menu);

    var mw = menu.offsetWidth || 180;
    var mh = menu.offsetHeight || 56;
    var left = Math.max(12, Math.min(window.innerWidth - mw - 12, (clientX || window.innerWidth / 2) - mw / 2));
    var top = Math.max(12, Math.min(window.innerHeight - mh - 12, (clientY || window.innerHeight / 2) - mh - 8));
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    activeCommentCtx = { backdrop: backdrop, menu: menu };
  }

  function cancelReplyMode() {
    replyingTo = null;
    if (replyBar) replyBar.style.display = 'none';
    if (replyBarText) replyBarText.textContent = '';
  }

  function startReplyMode(rootId, targetUsername, isNestedReply) {
    if (!rootId || !targetUsername) return;
    replyingTo = { rootId: Number(rootId), username: String(targetUsername) };
    if (replyBarText) {
      replyBarText.textContent = String(i18n.replyingTo || '@{username}').replace('{username}', targetUsername);
    }
    if (replyBar) replyBar.style.display = 'flex';
    if (input) {
      if (isNestedReply) {
        var prefix = '@' + targetUsername + ' ';
        var curVal = input.value || '';
        if (curVal.toLowerCase().indexOf(prefix.toLowerCase()) !== 0) {
          input.value = prefix + curVal.replace(/^@[a-z0-9._]{3,24}\\s+/i, '');
        }
        if (submitBtn) {
          var v = input.value.trim();
          submitBtn.disabled = !(v.length > 0 && v.length <= 500);
          if (!submitBtn.disabled) submitBtn.classList.add('active');
        }
      }
      input.focus();
      try {
        input.setSelectionRange(input.value.length, input.value.length);
      } catch (e) {}
    }
  }

  function renderSingleCommentHtml(c, isReply, rootId) {
    var initial = escapeHtmlClient((c.display_name || c.username || '?').charAt(0).toUpperCase());
    var avatarHtml = c.avatar_key
      ? '<img src="/media/' + encodeURIComponent(c.avatar_key) + '" alt="' + escapeHtmlClient(c.username) + '">'
      : '<span>' + initial + '</span>';

    var deleteBtn = c.can_delete
      ? '<button type="button" class="comment-delete-btn" data-comment-id="' + c.id + '">' + escapeHtmlClient(i18n.deleteBtn) + '</button>'
      : '';

    var replyBtn = '<button type="button" class="comment-reply-btn" data-reply-root-id="' + rootId + '" data-reply-username="' + escapeHtmlClient(c.username) + '" data-reply-nested="' + (isReply ? '1' : '0') + '">' + escapeHtmlClient(i18n.replyBtn) + '</button>';

    var badge = (Number(c.is_verified) === 1 && window.renderVerifiedBadge) ? window.renderVerifiedBadge(13) : '';
    var timeTxt = c._justNow ? escapeHtmlClient(i18n.justNow) : formatTime(c.created_at);
    var isPinned = !isReply && Boolean(c.is_pinned);
    var canPin = !isReply && Boolean(c.can_pin);
    return '<div class="comment-item' + (isReply ? ' is-reply' : '') + '" id="sheetCommentItem_' + c.id + '" data-comment-id="' + c.id + '" data-comment-parent-id="' + (isReply ? rootId : 0) + '" data-can-pin="' + (canPin ? '1' : '0') + '" data-is-pinned="' + (isPinned ? '1' : '0') + '">' +
      '<a href="/u/' + encodeURIComponent(c.username) + '" class="comment-avatar' + (isReply ? ' is-reply-avatar' : '') + '">' + avatarHtml + '</a>' +
      '<div class="comment-content-wrap">' +
        (isPinned ? renderPinnedBadgeHtml() : '') +
        '<div>' +
          '<a href="/u/' + encodeURIComponent(c.username) + '" class="comment-author-name">' + escapeHtmlClient(c.username) + badge + '</a>' +
          '<span class="comment-text">' + renderMentions(c.content) + '</span>' +
        '</div>' +
        '<div class="comment-meta">' +
          '<span class="comment-time">' + timeTxt + '</span>' +
          replyBtn +
          deleteBtn +
        '</div>' +
      '</div>' +
      renderCommentLikeBtn(c.id, Boolean(c.is_liked), c.likes_count || 0, Boolean(c.liked_by_author)) +
    '</div>';
  }

  function formatShowRepliesLabel(count) {
    return String(i18n.showReplies || '({n})').replace('{n}', formatCompactCountClient(count));
  }

  function renderRepliesBlockHtml(rootId, replies, expanded) {
    var cnt = replies.length;
    var label = expanded ? i18n.hideReplies : formatShowRepliesLabel(cnt);
    var repliesHtml = '';
    for (var j = 0; j < cnt; j++) {
      repliesHtml += renderSingleCommentHtml(replies[j], true, rootId);
    }
    return '<div class="comment-replies-block' + (expanded ? ' is-expanded' : '') + '" data-replies-for="' + rootId + '">' +
      '<button type="button" class="comment-replies-toggle" data-toggle-replies="' + rootId + '" aria-expanded="' + (expanded ? 'true' : 'false') + '">' +
        i18n.chevronIcon +
        '<span class="comment-replies-toggle-label">' + escapeHtmlClient(label) + '</span>' +
      '</button>' +
      '<div class="comment-replies-list" data-replies-list="' + rootId + '"' + (expanded ? '' : ' style="display:none;"') + '>' +
        repliesHtml +
      '</div>' +
    '</div>';
  }

  function updateThreadToggleLabel(threadEl) {
    if (!threadEl) return;
    var rootId = parseInt(threadEl.getAttribute('data-thread-id') || '0', 10);
    var block = threadEl.querySelector('.comment-replies-block');
    if (!block) return;
    var listBox = block.querySelector('.comment-replies-list');
    var count = listBox ? listBox.querySelectorAll('.comment-item.is-reply').length : 0;
    if (count === 0) {
      block.remove();
      return;
    }
    var expanded = block.classList.contains('is-expanded');
    var btn = block.querySelector('.comment-replies-toggle');
    var lbl = block.querySelector('.comment-replies-toggle-label');
    if (btn) btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    if (lbl) lbl.textContent = expanded ? i18n.hideReplies : formatShowRepliesLabel(count);
    if (listBox) listBox.style.display = expanded ? 'flex' : 'none';
  }

  function renderComments(comments) {
    if (!list) return;
    if (!comments || comments.length === 0) {
      list.innerHTML = '<div class="comment-empty-text">' + escapeHtmlClient(i18n.empty) + '</div>';
      return;
    }

    var roots = [];
    var repliesMap = {};
    var knownIds = {};
    for (var k = 0; k < comments.length; k++) {
      knownIds[String(comments[k].id)] = true;
    }
    for (var i = 0; i < comments.length; i++) {
      var c = comments[i];
      var pid = c.parent_id ? Number(c.parent_id) : 0;
      if (pid > 0 && knownIds[String(pid)]) {
        if (!repliesMap[String(pid)]) repliesMap[String(pid)] = [];
        repliesMap[String(pid)].push(c);
      } else {
        roots.push(c);
      }
    }

    var html = '';
    for (var r = 0; r < roots.length; r++) {
      var root = roots[r];
      var reps = repliesMap[String(root.id)] || [];
      html += '<div class="comment-thread" data-thread-id="' + root.id + '">' +
        renderSingleCommentHtml(root, false, root.id) +
        (reps.length > 0 ? renderRepliesBlockHtml(root.id, reps, false) : '') +
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
        currentPostAuthor = data.post_author || null;
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
    cancelReplyMode();
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
    closeCommentCtxMenu();
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

  if (replyCancelBtn) {
    replyCancelBtn.addEventListener('click', cancelReplyMode);
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
    if (e.key === 'Escape') {
      if (activeCommentCtx) {
        closeCommentCtxMenu();
        return;
      }
      if (sheet && sheet.classList.contains('visible')) {
        window.closeCommentsSheet();
      }
    }
  });

  if (input && window.pgBindPlainEditable) {
    window.pgBindPlainEditable(input, {
      onEnter: function() {
        submitComment();
      }
    });
  }

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

  async function submitComment(e) {
      if (e && e.preventDefault) e.preventDefault();
      if (!currentPostId || isSubmitting) return;
      var text = input ? (input.value || '').trim() : '';
      if (!text || text.length > 500) return;

      isSubmitting = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('sending');
      }

      try {
        var reqPayload = { post_id: parseInt(currentPostId, 10), content: text };
        if (replyingTo && replyingTo.rootId) {
          reqPayload.parent_id = replyingTo.rootId;
        }
        var res = await fetch('/api/posts/comment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reqPayload)
        });
        var data = await res.json();
        if (res.ok && data.success) {
          if (input) input.value = '';
          cancelReplyMode();
          var emptyEl = list.querySelector('.comment-empty-text');
          if (emptyEl) emptyEl.remove();

          var c = data.comment;
          c._justNow = true;
          var pid = c.parent_id ? Number(c.parent_id) : 0;
          if (pid > 0) {
            var parentThread = list.querySelector('.comment-thread[data-thread-id="' + pid + '"]');
            if (parentThread) {
              var block = parentThread.querySelector('.comment-replies-block');
              if (!block) {
                var tmpBlock = document.createElement('div');
                tmpBlock.innerHTML = renderRepliesBlockHtml(pid, [c], true);
                if (tmpBlock.firstChild) parentThread.appendChild(tmpBlock.firstChild);
              } else {
                var listBox = block.querySelector('.comment-replies-list');
                if (listBox) {
                  var tmpRep = document.createElement('div');
                  tmpRep.innerHTML = renderSingleCommentHtml(c, true, pid);
                  if (tmpRep.firstChild) listBox.appendChild(tmpRep.firstChild);
                }
                block.classList.add('is-expanded');
                updateThreadToggleLabel(parentThread);
              }
              var insertedEl = document.getElementById('sheetCommentItem_' + c.id);
              if (insertedEl && insertedEl.scrollIntoView) {
                try { insertedEl.scrollIntoView({ block: 'nearest' }); } catch (se) {}
              }
            } else {
              var tmpFallback = document.createElement('div');
              tmpFallback.innerHTML = '<div class="comment-thread" data-thread-id="' + c.id + '">' + renderSingleCommentHtml(c, false, c.id) + '</div>';
              if (tmpFallback.firstChild) list.appendChild(tmpFallback.firstChild);
              list.scrollTop = list.scrollHeight;
            }
          } else {
            var tmpThread = document.createElement('div');
            tmpThread.innerHTML = '<div class="comment-thread" data-thread-id="' + c.id + '">' + renderSingleCommentHtml(c, false, c.id) + '</div>';
            if (tmpThread.firstChild) list.appendChild(tmpThread.firstChild);
            list.scrollTop = list.scrollHeight;
          }

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
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', submitComment);
  }

  if (list) {
    list.addEventListener('click', async function(e) {
      var likeBtn = e.target && e.target.closest ? e.target.closest('.comment-like-btn') : null;
      if (likeBtn) {
        var likeCommentId = parseInt(likeBtn.getAttribute('data-like-comment-id') || '0', 10);
        if (!likeCommentId || isNaN(likeCommentId) || likingCommentIds[likeCommentId]) return;
        likingCommentIds[likeCommentId] = true;
        likeBtn.disabled = true;
        try {
          var lRes = await fetch('/api/posts/comment/like', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ comment_id: likeCommentId })
          });
          var lData = await lRes.json();
          if (lRes.ok && lData && lData.success) {
            var isLikedNow = Boolean(lData.liked);
            var cntNow = Number(lData.likes_count || 0);
            if (isLikedNow) likeBtn.classList.add('liked');
            else likeBtn.classList.remove('liked');
            likeBtn.setAttribute('aria-pressed', isLikedNow ? 'true' : 'false');
            var cntSpan = likeBtn.querySelector('.comment-like-count');
            if (cntSpan) {
              cntSpan.textContent = cntNow > 0 ? formatCompactCountClient(cntNow) : '';
            }
            var cluster = likeBtn.closest('.comment-like-cluster');
            if (cluster) {
              var oldBadge = cluster.querySelector('.comment-author-liked-badge');
              if (oldBadge) oldBadge.remove();
              if (lData.liked_by_author && currentPostAuthor) {
                var tmpB = document.createElement('div');
                tmpB.innerHTML = renderAuthorLikedBadgeHtml(true);
                if (tmpB.firstChild) cluster.insertBefore(tmpB.firstChild, likeBtn);
              }
            }
          } else if (lRes.status === 401 || (lData && lData.error && lData.error.includes('авториз'))) {
            if (window.showAppAlert) window.showAppAlert({ isAuth: true, message: lData ? lData.error : '' });
          } else if (window.showAppAlert) {
            window.showAppAlert({ message: (lData && lData.error) || i18n.networkError });
          }
        } catch (lErr) {
          if (window.showAppAlert) window.showAppAlert({ message: i18n.networkError });
        } finally {
          delete likingCommentIds[likeCommentId];
          likeBtn.disabled = false;
        }
        return;
      }

      var replyBtn = e.target && e.target.closest ? e.target.closest('.comment-reply-btn') : null;
      if (replyBtn) {
        var rRootId = parseInt(replyBtn.getAttribute('data-reply-root-id') || '0', 10);
        var rUname = replyBtn.getAttribute('data-reply-username') || '';
        var rNested = replyBtn.getAttribute('data-reply-nested') === '1';
        if (rRootId && rUname) {
          startReplyMode(rRootId, rUname, rNested);
        }
        return;
      }

      var toggleBtn = e.target && e.target.closest ? e.target.closest('.comment-replies-toggle') : null;
      if (toggleBtn) {
        var threadEl = toggleBtn.closest('.comment-thread');
        var blockEl = toggleBtn.closest('.comment-replies-block');
        if (threadEl && blockEl) {
          blockEl.classList.toggle('is-expanded');
          updateThreadToggleLabel(threadEl);
        }
        return;
      }

      var delBtn = e.target && e.target.closest ? e.target.closest('.comment-delete-btn') : null;
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
            if (item) {
              var parentIdAttr = parseInt(item.getAttribute('data-comment-parent-id') || '0', 10);
              var parentThread = item.closest('.comment-thread');
              if (parentIdAttr > 0) {
                item.remove();
                if (parentThread) updateThreadToggleLabel(parentThread);
              } else if (parentThread) {
                parentThread.remove();
              } else {
                item.remove();
              }
            }
            if (replyingTo && Number(replyingTo.rootId) === Number(commentId)) {
              cancelReplyMode();
            }

            var newCount = typeof data.comments_count === 'number' ? data.comments_count : 0;
            if (countEl) countEl.textContent = newCount;
            if (currentOptions && typeof currentOptions.onCountUpdate === 'function') {
              currentOptions.onCountUpdate(newCount);
            }

            if (!list.querySelector('.comment-thread')) {
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

    list.addEventListener('contextmenu', function(e) {
      var item = e.target && e.target.closest ? e.target.closest('.comment-item[data-can-pin="1"]') : null;
      if (!item) return;
      e.preventDefault();
      openCommentCtxMenu(item, e.clientX, e.clientY);
    });

    list.addEventListener('touchstart', function(e) {
      if (!e.touches || e.touches.length !== 1) return;
      if (e.target && e.target.closest && e.target.closest('a, button')) return;
      var item = e.target && e.target.closest ? e.target.closest('.comment-item[data-can-pin="1"]') : null;
      if (!item) return;
      var touch = e.touches[0];
      commentHoldStartX = touch.clientX;
      commentHoldStartY = touch.clientY;
      if (commentHoldTimer) clearTimeout(commentHoldTimer);
      commentHoldTimer = setTimeout(function() {
        commentHoldTimer = null;
        if (navigator.vibrate) {
          try { navigator.vibrate(15); } catch (ve) {}
        }
        openCommentCtxMenu(item, commentHoldStartX, commentHoldStartY);
      }, 420);
    }, { passive: true });

    list.addEventListener('touchmove', function(e) {
      if (!commentHoldTimer || !e.touches || !e.touches[0]) return;
      var dx = Math.abs(e.touches[0].clientX - commentHoldStartX);
      var dy = Math.abs(e.touches[0].clientY - commentHoldStartY);
      if (dx > 10 || dy > 10) {
        clearTimeout(commentHoldTimer);
        commentHoldTimer = null;
      }
    }, { passive: true });

    var clearHold = function() {
      if (commentHoldTimer) {
        clearTimeout(commentHoldTimer);
        commentHoldTimer = null;
      }
    };
    list.addEventListener('touchend', clearHold, { passive: true });
    list.addEventListener('touchcancel', clearHold, { passive: true });
  }
})();
`;
}

