import { escapeHtml, safeJsonForScript } from './layout';
import { Translations } from '../languages/types';
import { ru } from '../languages/ru';
import { getCompactCountUnits } from '../languages';

export const SHARE_ICON = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;

const CLOSE_SHARE_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const SEARCH_SHARE_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
const VERIFIED_SHARE_BADGE = `<svg class="verified-badge" width="13" height="13" viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M19.998 3.094 14.638 0l-2.972 5.15H5.432v6.354L0 14.64 3.094 20 0 25.359l5.432 3.137v5.905h5.975L14.638 40l5.36-3.094L25.358 40l3.232-5.6h6.162v-6.01L40 25.359 36.905 20 40 14.641l-5.248-3.03v-6.46h-6.419L25.358 0l-5.36 3.094Z" fill="#0095F6"/><path d="M17.204 27.204 11.2 21.2l2.404-2.404 3.6 3.6 8.8-8.8 2.404 2.404-11.204 11.204Z" fill="#FFFFFF"/></svg>`;

export function renderShareSheetHtml(t: Translations = ru): string {
  return `
  <div class="share-sheet-backdrop" id="appShareSheet" aria-hidden="true">
    <div class="share-sheet-panel" id="appSharePanel" role="dialog" aria-modal="true" aria-labelledby="shareSheetTitle">
      <div class="share-sheet-drag-zone" id="shareSheetDragZone">
        <div class="share-sheet-handle" id="shareSheetHandle"></div>
        <div class="share-sheet-header">
          <div class="share-sheet-preview" id="sharePostPreview">
            <img class="share-sheet-thumb" id="sharePostThumb" src="" alt="">
            <div class="share-sheet-head-meta">
              <h3 class="share-sheet-title" id="shareSheetTitle">${escapeHtml(t.share.title)}</h3>
              <span class="share-sheet-author" id="sharePostAuthor"></span>
            </div>
          </div>
          <button type="button" class="share-sheet-close" id="shareSheetCloseBtn" aria-label="${escapeHtml(t.common.close)}">${CLOSE_SHARE_ICON}</button>
        </div>
      </div>

      <div class="share-sheet-search-wrap">
        <div class="share-sheet-search-box">
          <span class="share-sheet-search-icon">${SEARCH_SHARE_ICON}</span>
          <input type="search" id="shareSearchInput" class="share-sheet-search-input" placeholder="${escapeHtml(t.share.searchPlaceholder)}" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" data-lpignore="true" data-1p-ignore="true" data-form-type="other">
        </div>
      </div>

      <div class="share-sheet-list" id="shareContactsList"></div>

      <div class="share-sheet-note-wrap">
        <input type="text" id="shareNoteInput" class="share-sheet-note-input" maxlength="500" placeholder="${escapeHtml(t.share.notePlaceholder)}" autocomplete="off">
      </div>
    </div>
  </div>`;
}

export function renderShareSheetScript(currentUserId: number, t: Translations = ru): string {
  const cfg = safeJsonForScript({
    currentUserId: Number(currentUserId) || 0,
    lang: t.code,
    compactUnits: getCompactCountUnits(t.code),
    verifiedSvg: VERIFIED_SHARE_BADGE,
    i18n: {
      send: t.share.send,
      sending: t.share.sending,
      sent: t.share.sent,
      sentToast: t.share.sentToast,
      emptyTitle: t.share.emptyTitle,
      emptyDesc: t.share.emptyDesc,
      noResults: t.share.noResults,
      goToMessages: t.share.goToMessages,
      partnerNotReady: t.share.partnerNotReady,
      loading: t.common.loading,
      networkError: t.common.networkError,
      rateLimit: t.messages.errRateLimit,
    },
  });

  return `
(function() {
  var cfg = ${cfg};
  var i18n = cfg.i18n;
  var sheet = document.getElementById('appShareSheet');
  var panel = document.getElementById('appSharePanel');
  var dragZone = document.getElementById('shareSheetDragZone');
  var closeBtn = document.getElementById('shareSheetCloseBtn');
  var thumbEl = document.getElementById('sharePostThumb');
  var authorEl = document.getElementById('sharePostAuthor');
  var searchInput = document.getElementById('shareSearchInput');
  var noteInput = document.getElementById('shareNoteInput');
  var listEl = document.getElementById('shareContactsList');

  var activePost = null;
  var conversations = [];
  var sentMap = {};
  var sendingMap = {};
  var isLoadingList = false;
  var isDraggingSheet = false;
  var sheetDragStartY = 0;
  var sheetCurrentY = 0;
  var sheetLastY = 0;
  var sheetLastTime = 0;
  var sheetVelocityY = 0;
  var sheetResetTimer = null;

  function formatCompactClient(n) {
    var raw = Number(n);
    if (!Number.isFinite(raw) || raw <= 0) return '0';
    var val = Math.floor(raw);
    if (val < 1000) return String(val);
    var u = cfg.compactUnits || { k: 'K', m: 'M', b: 'B' };
    var sep = cfg.lang === 'en' ? '' : ' ';
    var fmt = function(v, unit) {
      var rounded = v >= 100 ? Math.floor(v) : Math.floor(v * 10) / 10;
      var s = rounded % 1 === 0 ? String(Math.floor(rounded)) : rounded.toFixed(1).replace(/\\.0$/, '');
      return s + sep + unit;
    };
    if (val >= 1000000000) return fmt(val / 1000000000, u.b);
    if (val >= 1000000) return fmt(val / 1000000, u.m);
    return fmt(val / 1000, u.k);
  }

  window.formatPhotogramCompactCount = formatCompactClient;

  function syncShareCountDom(postId, count) {
    var safeCount = Math.max(0, Math.floor(Number(count) || 0));
    var compact = formatCompactClient(safeCount);
    var pidStr = String(postId);
    document.querySelectorAll('.feed-share-count[data-post-id="' + pidStr + '"]').forEach(function(el) {
      el.textContent = safeCount > 0 ? compact : '';
    });
    document.querySelectorAll('.pics-share-count[data-post-id="' + pidStr + '"]').forEach(function(el) {
      el.textContent = compact;
    });
    document.querySelectorAll('.post-item-btn[data-post-id="' + pidStr + '"]').forEach(function(el) {
      el.setAttribute('data-shares-count', String(safeCount));
    });
    var viewShareBtn = document.getElementById('viewPostShareBtn');
    var viewShareCnt = document.getElementById('viewPostSharesCount');
    if (viewShareBtn && viewShareCnt && String(viewShareBtn.dataset.postId || '') === pidStr) {
      viewShareCnt.textContent = safeCount > 0 ? compact : '';
    }
  }

  function safeMediaKey(key, prefix) {
    if (!key || typeof key !== 'string') return '';
    var s = key.trim();
    if (!s || s.length > 200 || s.indexOf(prefix) !== 0) return '';
    if (s.indexOf('..') !== -1 || s.indexOf('\\\\') !== -1 || s.indexOf('?') !== -1 || s.indexOf('#') !== -1) return '';
    return s;
  }

  function mediaThumbUrl(key) {
    var safe = safeMediaKey(key, 'posts/');
    if (!safe) return '';
    var base = '/media/' + encodeURIComponent(safe);
    return safe.slice(-5) === '.webp' ? (base + '?v=thumb') : base;
  }

  function renderList() {
    if (!listEl) return;
    listEl.textContent = '';
    if (isLoadingList) {
      var ld = document.createElement('div');
      ld.className = 'share-sheet-empty';
      ld.textContent = i18n.loading;
      listEl.appendChild(ld);
      return;
    }
    if (!conversations.length) {
      var empty = document.createElement('div');
      empty.className = 'share-sheet-empty';
      var et = document.createElement('div');
      et.className = 'share-sheet-empty-title';
      et.textContent = i18n.emptyTitle;
      var ed = document.createElement('div');
      ed.className = 'share-sheet-empty-desc';
      ed.textContent = i18n.emptyDesc;
      var link = document.createElement('a');
      link.href = '/messages';
      link.className = 'btn btn-primary btn-sm share-sheet-empty-btn';
      link.textContent = i18n.goToMessages;
      empty.appendChild(et);
      empty.appendChild(ed);
      empty.appendChild(link);
      listEl.appendChild(empty);
      return;
    }

    var q = (searchInput ? searchInput.value : '').trim().toLowerCase();
    var filtered = conversations.filter(function(c) {
      if (!q) return true;
      var u = String(c.other_username || c.partner_username || '').toLowerCase();
      var d = String(c.other_display_name || c.partner_display_name || '').toLowerCase();
      return u.indexOf(q) !== -1 || d.indexOf(q) !== -1;
    });

    if (!filtered.length) {
      var nr = document.createElement('div');
      nr.className = 'share-sheet-empty';
      nr.textContent = i18n.noResults;
      listEl.appendChild(nr);
      return;
    }

    filtered.forEach(function(c) {
      var pid = Number(c.other_user_id || c.partner_id || 0);
      var cid = Number(c.id || 0);
      if (!pid) return;
      var uname = String(c.other_username || c.partner_username || '');
      var dname = String(c.other_display_name || c.partner_display_name || '');
      var avRaw = c.other_avatar_key || c.partner_avatar_key || '';
      var isVer = Boolean(c.other_is_verified || c.partner_is_verified);

      var row = document.createElement('div');
      row.className = 'share-contact-row';

      var av = document.createElement('div');
      av.className = 'share-contact-avatar';
      var avKey = safeMediaKey(avRaw, 'avatars/');
      if (avKey) {
        var img = document.createElement('img');
        img.src = '/media/' + encodeURIComponent(avKey);
        img.alt = uname;
        img.loading = 'lazy';
        av.appendChild(img);
      } else {
        var sp = document.createElement('span');
        sp.textContent = String(dname || uname || '?').charAt(0).toUpperCase();
        av.appendChild(sp);
      }

      var meta = document.createElement('div');
      meta.className = 'share-contact-meta';

      var nameEl = document.createElement('div');
      nameEl.className = 'share-contact-username';
      var uSpan = document.createElement('span');
      uSpan.textContent = uname;
      nameEl.appendChild(uSpan);
      if (isVer) {
        var vSpan = document.createElement('span');
        vSpan.innerHTML = cfg.verifiedSvg;
        nameEl.appendChild(vSpan);
      }
      meta.appendChild(nameEl);

      if (dname && dname !== uname) {
        var sub = document.createElement('div');
        sub.className = 'share-contact-display';
        sub.textContent = dname;
        meta.appendChild(sub);
      }

      var btn = document.createElement('button');
      btn.type = 'button';
      var isSent = Boolean(sentMap[pid]);
      var isSending = Boolean(sendingMap[pid]);
      btn.className = 'btn btn-sm share-send-btn ' + (isSent ? 'btn-secondary is-sent' : 'btn-primary');
      btn.textContent = isSent ? i18n.sent : (isSending ? i18n.sending : i18n.send);
      btn.disabled = isSent || isSending;
      btn.addEventListener('click', function() {
        sendPostToConversation(cid, pid, btn);
      });

      row.appendChild(av);
      row.appendChild(meta);
      row.appendChild(btn);
      listEl.appendChild(row);
    });
  }

  async function sendPostToConversation(convId, partnerId, btnEl) {
    if (!activePost || !partnerId || sentMap[partnerId] || sendingMap[partnerId]) return;
    if (!cfg.currentUserId) return;
    sendingMap[partnerId] = true;
    if (btnEl) {
      btnEl.disabled = true;
      btnEl.textContent = i18n.sending;
    }

    try {
      if (typeof window.loadPhotogramE2ee !== 'function') {
        throw Object.assign(new Error('E2EE unavailable'), { code: 'NETWORK' });
      }
      var mod = await window.loadPhotogramE2ee();
      var client = mod.getClient(cfg.currentUserId);
      await client.ensureInitialized();

      var noteText = noteInput ? noteInput.value.trim().slice(0, 500) : '';
      var enc = await client.encryptMessage({
        partnerUserId: partnerId,
        text: noteText,
        sharedPost: activePost
      });

      var res = await fetch('/api/messages/send', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: convId > 0 ? convId : undefined,
          target_user_id: partnerId,
          sender_device_id: enc.senderDeviceId,
          envelopes: enc.envelopes,
          shared_post_id: activePost.postId
        })
      });
      var data = null;
      try { data = await res.json(); } catch (e) {}
      if (!res.ok || !data || !data.success) {
        var msg = res.status === 429 ? i18n.rateLimit : ((data && data.error) || i18n.networkError);
        if (window.showAppToast) window.showAppToast(msg);
        return;
      }
      if (data.message && data.message.id && typeof client.cacheSentMessage === 'function') {
        try { await client.cacheSentMessage(Number(data.message.id), enc.payload); } catch (ce) {}
      }
      if (typeof data.shares_count === 'number') {
        syncShareCountDom(activePost.postId, data.shares_count);
      }
      sentMap[partnerId] = true;
      if (window.showAppToast) window.showAppToast(i18n.sentToast);
    } catch (err) {
      var code = err && err.code ? err.code : '';
      var errMsg = code === 'PARTNER_NOT_READY' ? i18n.partnerNotReady : i18n.networkError;
      if (window.showAppToast) window.showAppToast(errMsg);
    } finally {
      delete sendingMap[partnerId];
      if (btnEl) {
        var done = Boolean(sentMap[partnerId]);
        btnEl.disabled = done;
        btnEl.textContent = done ? i18n.sent : i18n.send;
        btnEl.className = 'btn btn-sm share-send-btn ' + (done ? 'btn-secondary is-sent' : 'btn-primary');
      }
    }
  }

  async function loadConversations() {
    if (!conversations.length) {
      isLoadingList = true;
    }
    renderList();
    try {
      var res = await fetch('/api/messages/conversations', { credentials: 'same-origin', cache: 'no-store' });
      var data = null;
      try { data = await res.json(); } catch (e) {}
      if (res.ok && data && Array.isArray(data.conversations)) {
        conversations = data.conversations;
      } else if (!conversations.length) {
        conversations = [];
      }
    } catch (e) {
      if (!conversations.length) conversations = [];
    } finally {
      isLoadingList = false;
      renderList();
    }
  }

  window.closeShareSheet = function(fromPop, fromSwipe) {
    if (!sheet) return;
    isDraggingSheet = false;
    sheetCurrentY = 0;
    if (sheetResetTimer) {
      clearTimeout(sheetResetTimer);
      sheetResetTimer = null;
    }
    if (fromPop) {
      sheet.classList.add('pg-no-transition');
      sheet.classList.remove('visible');
      sheet.style.transition = '';
      sheet.style.opacity = '';
      if (panel) {
        panel.style.transition = '';
        panel.style.transform = '';
      }
      void sheet.offsetWidth;
      sheet.classList.remove('pg-no-transition');
    } else {
      sheet.style.transition = '';
      sheet.style.opacity = '';
      if (fromSwipe !== true && panel) {
        panel.style.transition = '';
        panel.style.transform = '';
      }
      sheet.classList.remove('visible');
      if (window.__pgPopOverlay) window.__pgPopOverlay('share-sheet');
      sheetResetTimer = setTimeout(function() {
        if (sheet && !sheet.classList.contains('visible')) {
          sheet.style.transition = '';
          sheet.style.opacity = '';
          if (panel) {
            panel.style.transition = '';
            panel.style.transform = '';
          }
        }
        sheetResetTimer = null;
      }, 320);
    }
    sheet.setAttribute('aria-hidden', 'true');
    if (!document.querySelector('.modal-backdrop.visible, .pics-modal.visible, .comments-sheet-backdrop.visible')) {
      document.body.style.overflow = '';
    }
    activePost = null;
  };

  function canDragSheet() {
    return Boolean(panel && sheet && sheet.classList.contains('visible'));
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
      window.closeShareSheet(false, true);
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

  window.openShareSheet = function(meta) {
    if (!sheet || !meta) return;
    var postId = parseInt(String(meta.postId || 0), 10);
    var authorUsername = String(meta.authorUsername || '').trim();
    var imageKey = safeMediaKey(meta.imageKey, 'posts/');
    if (!postId || !authorUsername || !imageKey) return;

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

    activePost = {
      postId: postId,
      authorUsername: authorUsername,
      authorAvatar: safeMediaKey(meta.authorAvatar, 'avatars/'),
      authorVerified: Boolean(meta.authorVerified),
      imageKey: imageKey,
      caption: String(meta.caption || '').replace(/\\s+/g, ' ').trim().slice(0, 200)
    };
    sentMap = {};
    sendingMap = {};
    if (searchInput) searchInput.value = '';
    if (noteInput) noteInput.value = '';
    if (thumbEl) thumbEl.src = mediaThumbUrl(imageKey);
    if (authorEl) authorEl.textContent = '@' + authorUsername;

    sheet.classList.add('visible');
    sheet.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (window.__pgPushOverlay) {
      window.__pgPushOverlay('share-sheet', function(fromPop) {
        window.closeShareSheet(fromPop);
      });
    }
    loadConversations();
  };

  if (dragZone) {
    dragZone.addEventListener('touchstart', function(e) {
      if (!e.touches || e.touches.length !== 1) return;
      if (e.target && e.target.closest && e.target.closest('.share-sheet-close')) return;
      startSheetDrag(e.touches[0].clientY);
    }, { passive: true });

    dragZone.addEventListener('touchmove', function(e) {
      if (!isDraggingSheet || !e.touches || e.touches.length !== 1) return;
      if (e.cancelable) e.preventDefault();
      moveSheetDrag(e.touches[0].clientY);
    }, { passive: false });

    dragZone.addEventListener('touchend', endSheetDrag);
    dragZone.addEventListener('touchcancel', endSheetDrag);

    dragZone.addEventListener('mousedown', function(e) {
      if (e.button !== 0) return;
      if (e.target && e.target.closest && e.target.closest('.share-sheet-close')) return;
      if (!canDragSheet()) return;
      e.preventDefault();
      startSheetDrag(e.clientY);
    });

    if (window.__pgShareDragMove) {
      window.removeEventListener('mousemove', window.__pgShareDragMove);
    }
    if (window.__pgShareDragEnd) {
      window.removeEventListener('mouseup', window.__pgShareDragEnd);
    }
    window.__pgShareDragMove = function(e) {
      if (!isDraggingSheet) return;
      moveSheetDrag(e.clientY);
    };
    window.__pgShareDragEnd = endSheetDrag;
    window.addEventListener('mousemove', window.__pgShareDragMove);
    window.addEventListener('mouseup', window.__pgShareDragEnd);
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      window.closeShareSheet(false);
    });
  }
  if (sheet) {
    sheet.addEventListener('click', function(e) {
      if (e.target === sheet) window.closeShareSheet(false);
    });
  }
  if (searchInput) {
    searchInput.addEventListener('input', renderList);
  }
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && sheet && sheet.classList.contains('visible')) {
      window.closeShareSheet(false);
    }
  });
})();
`;
}
