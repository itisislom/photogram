import { ConversationItem, DirectMessage, User } from '../types';
import { layout, escapeHtml, renderVerifiedBadge } from './layout';
import { renderBottomNav, CLOSE_ICON } from './nav';
import { SEND_COMMENT_ICON } from './commentsModal';
import { Translations, ru, formatLocalizedShortDate, formatLocalizedTime, getClientDateFormat } from '../languages';

const BACK_ICON = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`;
const SEARCH_ICON = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
const PHOTO_ICON = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" ry="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
const CHAT_BIG_ICON = `<svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;
const TRASH_SM_ICON = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
const LOCK_SM_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
const LOCK_XS_ICON = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;

function parseDateSafe(dateStr: string): Date {
  if (!dateStr) return new Date();
  const s = String(dateStr).trim();
  if (s.includes('T')) return new Date(s.endsWith('Z') ? s : s + 'Z');
  return new Date(s.replace(' ', 'T') + 'Z');
}

function formatDmShortTime(dateStr: string, t: Translations): string {
  try {
    const d = parseDateSafe(dateStr);
    if (isNaN(d.getTime())) return '';
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return t.common.justNow;
    if (diff < 3600) return `${Math.floor(diff / 60)} ${t.common.minutesShort}`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ${t.common.hoursShort}`;
    if (diff < 7 * 86400) return `${Math.floor(diff / 86400)} ${t.common.daysShort}`;
    return formatLocalizedShortDate(d, t.code);
  } catch {
    return '';
  }
}

function formatMsgClock(dateStr: string): string {
  try {
    const d = parseDateSafe(dateStr);
    return isNaN(d.getTime()) ? '' : formatLocalizedTime(d);
  } catch {
    return '';
  }
}

export interface MessagesPageData {
  conversations: ConversationItem[];
  activeConversationId: number | null;
  activePartner: {
    id: number;
    username: string;
    display_name: string;
    avatar_key: string;
    is_verified?: number | boolean;
  } | null;
  messages: DirectMessage[];
  hasMore: boolean;
  lastReadOwnId: number;
}

export function messagesPage(
  data: MessagesPageData,
  currentUser: User,
  t: Translations = ru,
  theme?: string,
): string {
  const { conversations, activeConversationId, activePartner, messages, hasMore, lastReadOwnId } = data;
  const hasActive = Boolean(activePartner);

  const convListHtml = conversations.length > 0
    ? conversations
        .map((c) => {
          const isCurrent = Boolean(activePartner && Number(activePartner.id) === Number(c.other_user_id));
          const initial = (c.other_display_name || c.other_username || '?').charAt(0).toUpperCase();
          const avatarHtml = c.other_avatar_key
            ? `<img src="/media/${encodeURIComponent(c.other_avatar_key)}" alt="${escapeHtml(c.other_username)}">`
            : `<span>${escapeHtml(initial)}</span>`;
          const prefix = c.last_message_sender_id === currentUser.id ? t.messages.youPrefix : '';
          const previewText = c.last_message_encrypted
            ? `${prefix}${t.messages.encryptedPreview}`
            : (c.last_message_body
              ? `${prefix}${c.last_message_body}`
              : (c.last_message_image ? `${prefix}${t.messages.photoLabel}` : ''));
          const unreadDot = c.unread_count > 0 && !isCurrent
            ? `<span class="dm-conv-unread">${c.unread_count > 99 ? '99+' : c.unread_count}</span>`
            : '';

          return `
          <a href="/messages/${encodeURIComponent(c.other_username)}" class="dm-conv-item ${isCurrent ? 'active' : ''} ${c.unread_count > 0 && !isCurrent ? 'unread' : ''}" data-conv-id="${c.id}" data-partner-id="${c.other_user_id}" data-last-msg-id="${c.last_message_id || 0}" data-last-encrypted="${c.last_message_encrypted ? '1' : '0'}" data-last-mine="${c.last_message_sender_id === currentUser.id ? '1' : '0'}">
            <div class="dm-avatar">${avatarHtml}</div>
            <div class="dm-conv-meta">
              <div class="dm-conv-top">
                <span class="dm-conv-name">${escapeHtml(c.other_username)}${c.other_is_verified ? renderVerifiedBadge(13) : ''}</span>
                <span class="dm-conv-time">${escapeHtml(formatDmShortTime(c.last_message_at, t))}</span>
              </div>
              <div class="dm-conv-bottom">
                <span class="dm-conv-preview">${escapeHtml(previewText)}</span>
                ${unreadDot}
              </div>
            </div>
          </a>`;
        })
        .join('')
    : `
      <div class="dm-empty-list" id="dmEmptyList">
        <div class="dm-empty-icon">${CHAT_BIG_ICON}</div>
        <div class="dm-empty-title">${escapeHtml(t.messages.emptyListTitle)}</div>
        <div class="dm-empty-desc">${escapeHtml(t.messages.emptyListDesc)}</div>
      </div>`;

  const initialEncryptedMessages = messages
    .filter((m) => Boolean(m.is_encrypted))
    .map((m) => ({
      id: Number(m.id),
      sender_id: Number(m.sender_id),
      sender_device_id: Number(m.sender_device_id || 0),
      is_encrypted: 1,
      image_key: m.image_key || '',
      ciphertext_envelope: m.ciphertext_envelope || '',
      created_at: m.created_at,
    }));

  let threadHtml = '';
  if (activePartner) {
    const pInit = (activePartner.display_name || activePartner.username || '?').charAt(0).toUpperCase();
    const pAvatar = activePartner.avatar_key
      ? `<img src="/media/${encodeURIComponent(activePartner.avatar_key)}" alt="${escapeHtml(activePartner.username)}">`
      : `<span>${escapeHtml(pInit)}</span>`;

    const msgsHtml = messages.length > 0
      ? messages
          .map((m) => {
            const isMine = Number(m.sender_id) === Number(currentUser.id);
            const isEnc = Boolean(m.is_encrypted);
            const unsendBtn = isMine
              ? `<button type="button" class="dm-unsend-btn" data-unsend-id="${m.id}" aria-label="${escapeHtml(t.messages.unsend)}" title="${escapeHtml(t.messages.unsend)}">${TRASH_SM_ICON}</button>`
              : '';
            if (isEnc) {
              return `
            <div class="dm-msg-row ${isMine ? 'mine' : 'theirs'}" data-msg-id="${m.id}" data-encrypted="1">
              ${isMine ? unsendBtn : ''}
              <div class="dm-msg-bubble">
                <div class="dm-msg-text dm-msg-decrypt-err" data-enc-slot="1">${escapeHtml(t.messages.e2eeInitializing)}</div>
                <div class="dm-msg-time">${escapeHtml(formatMsgClock(m.created_at))}</div>
              </div>
            </div>`;
            }
            const imgHtml = m.image_key
              ? `<button type="button" class="dm-msg-img-btn" data-dm-lightbox="/media/${encodeURIComponent(m.image_key)}"><img src="/media/${encodeURIComponent(m.image_key)}" class="dm-msg-img" alt="${escapeHtml(t.messages.photoLabel)}" loading="lazy"></button>`
              : '';
            const textHtml = m.body
              ? `<div class="dm-msg-text">${escapeHtml(m.body)}</div>`
              : '';
            return `
            <div class="dm-msg-row ${isMine ? 'mine' : 'theirs'}" data-msg-id="${m.id}">
              ${isMine ? unsendBtn : ''}
              <div class="dm-msg-bubble ${m.image_key && !m.body ? 'img-only' : ''}">
                ${imgHtml}
                ${textHtml}
                <div class="dm-msg-time">${escapeHtml(formatMsgClock(m.created_at))}</div>
              </div>
            </div>`;
          })
          .join('')
      : `<div class="dm-no-msgs" id="dmNoMsgs">${escapeHtml(t.messages.noMessagesYet)}</div>`;

    const seenVisible = lastReadOwnId > 0 && messages.length > 0 && Number(messages[messages.length - 1].sender_id) === Number(currentUser.id) && Number(messages[messages.length - 1].id) <= lastReadOwnId;

    threadHtml = `
    <header class="dm-thread-header">
      <a href="/messages" class="dm-back-btn" aria-label="${escapeHtml(t.post.back)}">${BACK_ICON}</a>
      <a href="/u/${encodeURIComponent(activePartner.username)}" class="dm-thread-partner">
        <div class="dm-avatar dm-avatar-sm">${pAvatar}</div>
        <div class="dm-thread-partner-info">
          <div class="dm-thread-username">${escapeHtml(activePartner.username)}${activePartner.is_verified ? renderVerifiedBadge(13.5) : ''}</div>
          <div class="dm-thread-display">${escapeHtml(activePartner.display_name || activePartner.username)}</div>
        </div>
      </a>
      <button type="button" class="dm-safety-btn" id="dmSafetyBtn" aria-label="${escapeHtml(t.messages.e2eeSafetyTitle)}" title="${escapeHtml(t.messages.e2eeSafetyTitle)}">${LOCK_SM_ICON}</button>
    </header>

    <div class="dm-e2ee-banner" id="dmE2eeBanner">
      <span id="dmE2eeBannerText"></span>
      <button type="button" class="dm-e2ee-banner-btn" id="dmE2eeBannerBtn" style="display:none;"></button>
    </div>

    <div class="dm-messages-scroll" id="dmMessagesScroll">
      <div class="dm-e2ee-pill">${LOCK_XS_ICON}<span>${escapeHtml(t.messages.e2eeBadge)}</span></div>
      ${hasMore ? `<button type="button" class="dm-load-older-btn" id="dmLoadOlderBtn">${escapeHtml(t.messages.loadOlder)}</button>` : ''}
      <div class="dm-messages-list" id="dmMessagesList">
        ${msgsHtml}
      </div>
      <div class="dm-seen-indicator ${seenVisible ? 'visible' : ''}" id="dmSeenIndicator">${escapeHtml(t.messages.seen)}</div>
    </div>

    <div class="dm-attach-preview" id="dmAttachPreview" style="display:none;">
      <img id="dmAttachThumb" src="" alt="${escapeHtml(t.messages.photoLabel)}">
      <button type="button" class="dm-attach-clear" id="dmAttachClearBtn" aria-label="${escapeHtml(t.common.close)}">${CLOSE_ICON}</button>
    </div>

    <form class="dm-composer" id="dmComposeForm" autocomplete="off">
      <input type="file" id="dmImageInput" accept="image/jpeg,image/png,image/webp" style="display:none;">
      <button type="button" class="dm-attach-btn" id="dmAttachBtn" aria-label="${escapeHtml(t.messages.photoLabel)}" title="${escapeHtml(t.messages.photoLabel)}">${PHOTO_ICON}</button>
      <input type="text" class="dm-input" id="dmMessageInput" placeholder="${escapeHtml(t.messages.inputPlaceholder)}" maxlength="2000" autocomplete="off" data-lpignore="true" data-1p-ignore="true" data-form-type="other">
      <button type="submit" class="dm-send-btn" id="dmSendBtn" aria-label="${escapeHtml(t.messages.send)}" title="${escapeHtml(t.messages.send)}" disabled>${SEND_COMMENT_ICON}</button>
    </form>`;
  } else {
    threadHtml = `
    <div class="dm-thread-empty">
      <div class="dm-empty-icon">${CHAT_BIG_ICON}</div>
      <div class="dm-empty-title">${escapeHtml(t.messages.selectChatTitle)}</div>
      <div class="dm-empty-desc">${escapeHtml(t.messages.selectChatDesc)}</div>
    </div>`;
  }

  const body = `
<div class="app-layout dm-page-layout ${hasActive ? 'dm-mobile-in-chat' : ''}">
  <div class="dm-shell ${hasActive ? 'has-active-chat' : ''}">
    <aside class="dm-sidebar">
      <header class="dm-sidebar-header">
        <div class="dm-sidebar-title">${escapeHtml(currentUser.username)}${currentUser.is_verified ? renderVerifiedBadge(14) : ''}</div>
        <span class="dm-sidebar-sub">${escapeHtml(t.messages.title)}</span>
      </header>
      <div class="dm-search-wrap">
        <div class="dm-search-box">
          <span class="dm-search-icon">${SEARCH_ICON}</span>
          <input type="search" id="dmSearchInput" class="dm-search-input" placeholder="${escapeHtml(t.messages.searchPlaceholder)}" inputmode="search" enterkeyhint="search" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" maxlength="50" data-lpignore="true" data-1p-ignore="true" data-form-type="other">
          <button type="button" id="dmSearchClearBtn" class="dm-search-clear" style="display:none;" aria-label="${escapeHtml(t.common.close)}">${CLOSE_ICON}</button>
        </div>
      </div>
      <div class="dm-search-results" id="dmSearchResults" style="display:none;"></div>
      <div class="dm-conv-list" id="dmConvList">
        ${convListHtml}
      </div>
    </aside>

    <section class="dm-thread">
      ${threadHtml}
    </section>
  </div>

  ${renderBottomNav('messages', t)}

  <div class="modal-backdrop dm-lightbox-backdrop" id="dmPhotoLightbox">
    <div class="dm-lightbox-inner">
      <button type="button" class="dm-lightbox-close" id="dmLightboxCloseBtn" aria-label="${escapeHtml(t.common.close)}">${CLOSE_ICON}</button>
      <img id="dmLightboxImg" src="" alt="${escapeHtml(t.messages.photoLabel)}">
    </div>
  </div>

  <div class="modal-backdrop" id="dmSafetyModal">
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">${escapeHtml(t.messages.e2eeSafetyTitle)}</h3>
        <button class="modal-close" id="closeDmSafetyBtn" type="button" aria-label="${escapeHtml(t.common.close)}">${CLOSE_ICON}</button>
      </div>
      <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.45;">${escapeHtml(t.messages.e2eeSafetyDesc)}</p>
      <div class="dm-safety-status" id="dmSafetyStatus" style="display:none;">${LOCK_XS_ICON}<span>${escapeHtml(t.messages.e2eeVerified)}</span></div>
      <div class="dm-safety-grid" id="dmSafetyGrid">...</div>
      <div style="display: flex; gap: 8px; margin-top: 8px;">
        <button type="button" class="btn btn-primary btn-sm" id="dmSafetyVerifyBtn" style="flex:1; display:none;">${escapeHtml(t.messages.e2eeVerifyBtn)}</button>
        <button type="button" class="btn btn-secondary btn-sm" id="okDmSafetyBtn" style="flex:1;">${escapeHtml(t.common.close)}</button>
      </div>
    </div>
  </div>
</div>`;

  const lastMsgId = messages.length > 0 ? messages[messages.length - 1].id : 0;
  const oldestMsgId = messages.length > 0 ? messages[0].id : 0;

  const clientState = JSON.stringify({
    currentUserId: currentUser.id,
    activeConversationId: activeConversationId || 0,
    activePartnerId: activePartner ? activePartner.id : 0,
    activePartnerUsername: activePartner ? activePartner.username : '',
    lastMsgId,
    oldestMsgId,
    lastReadOwnId,
    initialEncrypted: initialEncryptedMessages,
    dateFmt: getClientDateFormat(t.code),
    justNow: t.common.justNow,
    minShort: t.common.minutesShort,
    hoursShort: t.common.hoursShort,
    daysShort: t.common.daysShort,
    noResults: t.explore.noResults,
    networkError: t.common.networkError,
    photoLabel: t.messages.photoLabel,
    youPrefix: t.messages.youPrefix,
    seen: t.messages.seen,
    unsend: t.messages.unsend,
    unsendTitle: t.messages.unsendConfirmTitle,
    unsendDesc: t.messages.unsendConfirmDesc,
    deleteBtn: t.common.delete,
    noMessagesYet: t.messages.noMessagesYet,
    errImageTooLarge: t.messages.errImageTooLarge,
    errInvalidImage: t.messages.errInvalidImage,
    encryptedPreview: t.messages.encryptedPreview,
    e2eeKeyChanged: t.messages.e2eeKeyChanged,
    e2eeAcceptNewKey: t.messages.e2eeAcceptNewKey,
    e2eePartnerNotReady: t.messages.e2eePartnerNotReady,
    e2eeDecryptFailed: t.messages.e2eeDecryptFailed,
    e2eeVerifyBtn: t.messages.e2eeVerifyBtn,
    e2eeUnverifyBtn: t.messages.e2eeUnverifyBtn,
    trashIcon: TRASH_SM_ICON,
  });

  const script = `
(function() {
  if (window.__dmPollTimer) {
    clearInterval(window.__dmPollTimer);
    window.__dmPollTimer = null;
  }
  if (window.__dmViewportCleanup) {
    try { window.__dmViewportCleanup(); } catch (e) {}
    window.__dmViewportCleanup = null;
  }

  document.documentElement.classList.add('dm-lock-scroll');
  document.body.classList.add('dm-lock-scroll');

  var dmShellEl = document.querySelector('.dm-shell');
  function syncDmViewport() {
    if (!dmShellEl) return;
    var vv = window.visualViewport;
    if (vv && window.innerWidth <= 768) {
      dmShellEl.style.setProperty('--dm-vp-h', Math.round(vv.height) + 'px');
      dmShellEl.style.setProperty('--dm-vp-top', Math.max(0, Math.round(vv.offsetTop)) + 'px');
      if (window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
    } else {
      dmShellEl.style.removeProperty('--dm-vp-h');
      dmShellEl.style.removeProperty('--dm-vp-top');
    }
  }
  syncDmViewport();
  window.addEventListener('resize', syncDmViewport);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncDmViewport);
    window.visualViewport.addEventListener('scroll', syncDmViewport);
  }

  var e2eeClient = null;
  var pendingKeyChange = null;
  var currentSafetyInfo = null;

  window.__dmViewportCleanup = function() {
    document.documentElement.classList.remove('dm-lock-scroll');
    document.body.classList.remove('dm-lock-scroll');
    if (dmShellEl) {
      dmShellEl.style.removeProperty('--dm-vp-h');
      dmShellEl.style.removeProperty('--dm-vp-top');
    }
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', syncDmViewport);
      window.visualViewport.removeEventListener('scroll', syncDmViewport);
    }
  };

  var state = ${clientState};
  var scrollEl = document.getElementById('dmMessagesScroll');
  var listEl = document.getElementById('dmMessagesList');
  var seenEl = document.getElementById('dmSeenIndicator');
  var formEl = document.getElementById('dmComposeForm');
  var inputEl = document.getElementById('dmMessageInput');
  var sendBtn = document.getElementById('dmSendBtn');
  var attachBtn = document.getElementById('dmAttachBtn');
  var fileInput = document.getElementById('dmImageInput');
  var attachPreview = document.getElementById('dmAttachPreview');
  var attachThumb = document.getElementById('dmAttachThumb');
  var attachClearBtn = document.getElementById('dmAttachClearBtn');
  var loadOlderBtn = document.getElementById('dmLoadOlderBtn');
  var searchInput = document.getElementById('dmSearchInput');
  var searchClearBtn = document.getElementById('dmSearchClearBtn');
  var searchResults = document.getElementById('dmSearchResults');
  var convListEl = document.getElementById('dmConvList');
  var lightbox = document.getElementById('dmPhotoLightbox');
  var lightboxImg = document.getElementById('dmLightboxImg');
  var lightboxCloseBtn = document.getElementById('dmLightboxCloseBtn');
  var safetyBtn = document.getElementById('dmSafetyBtn');
  var safetyModal = document.getElementById('dmSafetyModal');
  var safetyGrid = document.getElementById('dmSafetyGrid');
  var safetyStatus = document.getElementById('dmSafetyStatus');
  var safetyVerifyBtn = document.getElementById('dmSafetyVerifyBtn');
  var closeSafetyBtn = document.getElementById('closeDmSafetyBtn');
  var okSafetyBtn = document.getElementById('okDmSafetyBtn');
  var e2eeBanner = document.getElementById('dmE2eeBanner');
  var e2eeBannerText = document.getElementById('dmE2eeBannerText');
  var e2eeBannerBtn = document.getElementById('dmE2eeBannerBtn');

  var pendingFile = null;
  var pendingPreviewUrl = '';
  var isSending = false;
  var isPolling = false;
  var searchTimer = null;
  var searchAbort = null;

  function parseDateClient(dateStr) {
    if (!dateStr) return new Date();
    var s = String(dateStr).trim();
    if (s.indexOf('T') !== -1) return new Date(s.indexOf('Z') !== -1 ? s : s + 'Z');
    return new Date(s.replace(' ', 'T') + 'Z');
  }

  function formatClockClient(dateStr) {
    try {
      var d = parseDateClient(dateStr);
      if (isNaN(d.getTime())) return '';
      return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    } catch (e) {
      return '';
    }
  }

  function scrollToBottom() {
    if (scrollEl) {
      scrollEl.scrollTop = scrollEl.scrollHeight;
    }
  }

  function syncSendState() {
    if (!sendBtn) return;
    var hasText = inputEl && inputEl.value.trim().length > 0;
    var ready = Boolean((hasText || pendingFile) && !isSending);
    sendBtn.disabled = !ready;
    if (ready) sendBtn.classList.add('active');
    else sendBtn.classList.remove('active');
  }

  function showBanner(msg, isWarn, btnLabel) {
    if (!e2eeBanner || !e2eeBannerText) return;
    e2eeBannerText.textContent = msg;
    if (isWarn) e2eeBanner.classList.add('is-warn');
    else e2eeBanner.classList.remove('is-warn');
    if (e2eeBannerBtn) {
      if (btnLabel) {
        e2eeBannerBtn.textContent = btnLabel;
        e2eeBannerBtn.style.display = 'inline-flex';
      } else {
        e2eeBannerBtn.style.display = 'none';
      }
    }
    e2eeBanner.classList.add('visible');
  }

  function hideBanner() {
    if (!e2eeBanner) return;
    e2eeBanner.classList.remove('visible');
    if (e2eeBannerBtn) e2eeBannerBtn.style.display = 'none';
    pendingKeyChange = null;
  }

  function clearPendingFile() {
    pendingFile = null;
    if (pendingPreviewUrl) {
      try { URL.revokeObjectURL(pendingPreviewUrl); } catch (e) {}
      pendingPreviewUrl = '';
    }
    if (fileInput) fileInput.value = '';
    if (attachThumb) attachThumb.src = '';
    if (attachPreview) attachPreview.style.display = 'none';
    syncSendState();
  }

  function updateSeenUI() {
    if (!seenEl || !listEl) return;
    var rows = listEl.querySelectorAll('.dm-msg-row');
    if (!rows.length) {
      seenEl.classList.remove('visible');
      return;
    }
    var lastRow = rows[rows.length - 1];
    var lastId = parseInt(lastRow.getAttribute('data-msg-id'), 10) || 0;
    var isLastMine = lastRow.classList.contains('mine');
    if (isLastMine && state.lastReadOwnId > 0 && lastId <= state.lastReadOwnId) {
      seenEl.classList.add('visible');
    } else {
      seenEl.classList.remove('visible');
    }
  }

  async function ensureE2eeReady() {
    if (e2eeClient) return e2eeClient;
    if (!window.loadPhotogramE2ee) return null;
    var mod = await window.loadPhotogramE2ee();
    var c = mod.getClient(Number(state.currentUserId));
    await c.ensureInitialized();
    e2eeClient = c;
    return c;
  }

  function hydrateBubbleContent(bubble, timeEl, payload, imageKey, localMediaUrl) {
    while (bubble.firstChild) bubble.removeChild(bubble.firstChild);
    var hasImg = Boolean((payload && payload.media && imageKey) || localMediaUrl);
    var hasText = Boolean(payload && payload.text);
    if (hasImg && !hasText) bubble.classList.add('img-only');
    else bubble.classList.remove('img-only');

    if (hasImg) {
      var imgBtn = document.createElement('button');
      imgBtn.type = 'button';
      imgBtn.className = 'dm-msg-img-btn';
      var img = document.createElement('img');
      img.className = 'dm-msg-img';
      img.alt = state.photoLabel;
      img.loading = 'lazy';
      imgBtn.appendChild(img);
      bubble.appendChild(imgBtn);

      if (localMediaUrl) {
        img.src = localMediaUrl;
        imgBtn.setAttribute('data-dm-lightbox', localMediaUrl);
      } else if (e2eeClient && payload && payload.media && imageKey) {
        e2eeClient.decryptMediaToObjectUrl(imageKey, payload.media).then(function(objUrl) {
          img.src = objUrl;
          imgBtn.setAttribute('data-dm-lightbox', objUrl);
        }).catch(function() {
          imgBtn.remove();
          var errEl = document.createElement('div');
          errEl.className = 'dm-msg-text dm-msg-decrypt-err';
          errEl.textContent = state.e2eeDecryptFailed;
          bubble.insertBefore(errEl, timeEl);
        });
      }
    }

    if (hasText) {
      var txt = document.createElement('div');
      txt.className = 'dm-msg-text';
      txt.textContent = payload.text;
      bubble.appendChild(txt);
    }

    bubble.appendChild(timeEl);
  }

  function buildMessageRowEl(m, decryptedPayload, localMediaUrl) {
    var isMine = Number(m.sender_id) === Number(state.currentUserId);
    var row = document.createElement('div');
    row.className = 'dm-msg-row ' + (isMine ? 'mine' : 'theirs');
    row.setAttribute('data-msg-id', String(m.id));

    if (isMine) {
      var unsendBtn = document.createElement('button');
      unsendBtn.type = 'button';
      unsendBtn.className = 'dm-unsend-btn';
      unsendBtn.setAttribute('data-unsend-id', String(m.id));
      unsendBtn.setAttribute('aria-label', state.unsend);
      unsendBtn.setAttribute('title', state.unsend);
      unsendBtn.innerHTML = state.trashIcon;
      row.appendChild(unsendBtn);
    }

    var bubble = document.createElement('div');
    bubble.className = 'dm-msg-bubble';
    var timeEl = document.createElement('div');
    timeEl.className = 'dm-msg-time';
    timeEl.textContent = formatClockClient(m.created_at);

    if (m.is_encrypted) {
      if (decryptedPayload) {
        hydrateBubbleContent(bubble, timeEl, decryptedPayload, m.image_key || '', localMediaUrl || '');
      } else {
        var err = document.createElement('div');
        err.className = 'dm-msg-text dm-msg-decrypt-err';
        err.textContent = state.e2eeDecryptFailed;
        bubble.appendChild(err);
        bubble.appendChild(timeEl);
      }
    } else {
      if (m.image_key && !m.body) bubble.classList.add('img-only');
      if (m.image_key) {
        var imgUrl = '/media/' + encodeURIComponent(m.image_key);
        var imgBtn = document.createElement('button');
        imgBtn.type = 'button';
        imgBtn.className = 'dm-msg-img-btn';
        imgBtn.setAttribute('data-dm-lightbox', imgUrl);
        var img = document.createElement('img');
        img.src = imgUrl;
        img.className = 'dm-msg-img';
        img.alt = state.photoLabel;
        img.loading = 'lazy';
        imgBtn.appendChild(img);
        bubble.appendChild(imgBtn);
      }
      if (m.body) {
        var txt = document.createElement('div');
        txt.className = 'dm-msg-text';
        txt.textContent = m.body;
        bubble.appendChild(txt);
      }
      bubble.appendChild(timeEl);
    }

    row.appendChild(bubble);
    return row;
  }

  function appendMessageIfNew(m, shouldScroll, decryptedPayload, localMediaUrl) {
    if (!listEl || !m || !m.id) return;
    if (listEl.querySelector('.dm-msg-row[data-msg-id="' + m.id + '"]')) return;
    var emptyPlaceholder = document.getElementById('dmNoMsgs');
    if (emptyPlaceholder) emptyPlaceholder.remove();
    listEl.appendChild(buildMessageRowEl(m, decryptedPayload, localMediaUrl));
    if (Number(m.id) > state.lastMsgId) state.lastMsgId = Number(m.id);
    if (!state.oldestMsgId || Number(m.id) < state.oldestMsgId) state.oldestMsgId = Number(m.id);
    updateSeenUI();
    if (shouldScroll) scrollToBottom();
  }

  function updateSidebarPreview(convId, senderId, plainText, hasImg) {
    if (!convListEl) return;
    var item = convListEl.querySelector('.dm-conv-item[data-conv-id="' + convId + '"]');
    if (!item) return;
    var previewEl = item.querySelector('.dm-conv-preview');
    var timeEl = item.querySelector('.dm-conv-time');
    var isMine = Number(senderId) === Number(state.currentUserId);
    var prefix = isMine ? state.youPrefix : '';
    if (previewEl) {
      previewEl.textContent = plainText ? (prefix + plainText) : (hasImg ? (prefix + state.photoLabel) : (prefix + state.encryptedPreview));
    }
    if (timeEl) timeEl.textContent = state.justNow;
    convListEl.prepend(item);
  }

  async function hydrateSidebarEncryptedPreviews() {
    if (!convListEl || !e2eeClient) return;
    var items = convListEl.querySelectorAll('.dm-conv-item[data-last-encrypted="1"]');
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var lastId = parseInt(item.getAttribute('data-last-msg-id') || '0', 10);
      if (!lastId) continue;
      var cached = await e2eeClient.getCachedMessage(lastId);
      if (!cached) continue;
      var previewEl = item.querySelector('.dm-conv-preview');
      if (!previewEl) continue;
      var prefix = item.getAttribute('data-last-mine') === '1' ? state.youPrefix : '';
      previewEl.textContent = cached.text ? (prefix + cached.text) : (cached.media ? (prefix + state.photoLabel) : (prefix + state.encryptedPreview));
    }
  }

  async function hydrateInitialMessages() {
    try {
      var c = await ensureE2eeReady();
      if (!c) return;
      await hydrateSidebarEncryptedPreviews();

      var list = Array.isArray(state.initialEncrypted) ? state.initialEncrypted : [];
      for (var i = 0; i < list.length; i++) {
        var m = list[i];
        var row = listEl ? listEl.querySelector('.dm-msg-row[data-msg-id="' + m.id + '"]') : null;
        if (!row) continue;
        var bubble = row.querySelector('.dm-msg-bubble');
        var timeEl = row.querySelector('.dm-msg-time');
        if (!bubble || !timeEl) continue;
        var res = await c.decryptMessage(m);
        if (res.ok && res.payload) {
          hydrateBubbleContent(bubble, timeEl, res.payload, m.image_key || '', '');
        } else {
          var slot = bubble.querySelector('[data-enc-slot="1"]');
          if (slot) slot.textContent = state.e2eeDecryptFailed;
        }
      }
      if (scrollEl) scrollToBottom();

      if (state.activePartnerId > 0) {
        var info = await c.getSafetyNumber(state.activePartnerId);
        currentSafetyInfo = info;
        if (safetyBtn) {
          if (info.verified) safetyBtn.classList.add('is-verified');
          else safetyBtn.classList.remove('is-verified');
        }
        if (!info.ready) {
          showBanner(state.e2eePartnerNotReady, false, '');
        }
      }
    } catch (e) {}
  }

  if (scrollEl) {
    scrollToBottom();
    setTimeout(scrollToBottom, 80);
  }
  hydrateInitialMessages();

  if (e2eeBannerBtn) {
    e2eeBannerBtn.addEventListener('click', async function() {
      if (!pendingKeyChange || !e2eeClient) return;
      try {
        await e2eeClient.acceptKeyChange(
          pendingKeyChange.userId,
          pendingKeyChange.deviceId,
          pendingKeyChange.identityKey
        );
        hideBanner();
        if (safetyBtn) safetyBtn.classList.remove('is-verified');
      } catch (e) {}
    });
  }

  function closeSafetyModal() {
    if (safetyModal) safetyModal.classList.remove('visible');
  }

  if (safetyBtn && safetyModal) {
    safetyBtn.addEventListener('click', async function() {
      if (!state.activePartnerId) return;
      safetyModal.classList.add('visible');
      if (safetyGrid) safetyGrid.textContent = '...';
      if (safetyStatus) safetyStatus.style.display = 'none';
      if (safetyVerifyBtn) safetyVerifyBtn.style.display = 'none';
      try {
        var c = await ensureE2eeReady();
        if (!c) return;
        var info = await c.getSafetyNumber(state.activePartnerId);
        currentSafetyInfo = info;
        if (!info.ready) {
          if (safetyGrid) safetyGrid.textContent = state.e2eePartnerNotReady;
          return;
        }
        if (safetyGrid) {
          safetyGrid.innerHTML = '';
          info.formatted.split(' ').forEach(function(chunk) {
            var span = document.createElement('span');
            span.textContent = chunk;
            safetyGrid.appendChild(span);
          });
        }
        if (safetyStatus) safetyStatus.style.display = info.verified ? 'inline-flex' : 'none';
        if (safetyVerifyBtn) {
          safetyVerifyBtn.style.display = 'inline-flex';
          safetyVerifyBtn.textContent = info.verified ? state.e2eeUnverifyBtn : state.e2eeVerifyBtn;
        }
      } catch (e) {
        if (safetyGrid) safetyGrid.textContent = state.networkError;
      }
    });
  }

  if (safetyVerifyBtn) {
    safetyVerifyBtn.addEventListener('click', async function() {
      if (!e2eeClient || !currentSafetyInfo || !currentSafetyInfo.ready) return;
      var nextVerified = !currentSafetyInfo.verified;
      await e2eeClient.setVerified(state.activePartnerId, nextVerified ? currentSafetyInfo.fingerprint : null);
      currentSafetyInfo.verified = nextVerified;
      if (safetyStatus) safetyStatus.style.display = nextVerified ? 'inline-flex' : 'none';
      safetyVerifyBtn.textContent = nextVerified ? state.e2eeUnverifyBtn : state.e2eeVerifyBtn;
      if (safetyBtn) {
        if (nextVerified) safetyBtn.classList.add('is-verified');
        else safetyBtn.classList.remove('is-verified');
      }
    });
  }

  if (closeSafetyBtn) closeSafetyBtn.addEventListener('click', closeSafetyModal);
  if (okSafetyBtn) okSafetyBtn.addEventListener('click', closeSafetyModal);
  if (safetyModal) {
    safetyModal.addEventListener('click', function(e) {
      if (e.target === safetyModal) closeSafetyModal();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && safetyModal.classList.contains('visible')) {
        closeSafetyModal();
      }
    });
  }

  if (inputEl) {
    inputEl.addEventListener('input', syncSendState);
    inputEl.addEventListener('focus', function() {
      setTimeout(function() {
        syncDmViewport();
        scrollToBottom();
      }, 120);
    });
    inputEl.addEventListener('blur', function() {
      setTimeout(syncDmViewport, 80);
    });
  }

  if (attachBtn && fileInput) {
    attachBtn.addEventListener('click', function() {
      fileInput.click();
    });
    fileInput.addEventListener('change', function() {
      var f = this.files && this.files[0];
      if (!f) return;
      if (f.size > 5 * 1024 * 1024) {
        if (window.showAppToast) window.showAppToast(state.errImageTooLarge);
        this.value = '';
        return;
      }
      clearPendingFile();
      pendingFile = f;
      if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        pendingPreviewUrl = URL.createObjectURL(f);
        if (attachThumb) attachThumb.src = pendingPreviewUrl;
      }
      if (attachPreview) attachPreview.style.display = 'flex';
      syncSendState();
    });
  }

  if (attachClearBtn) {
    attachClearBtn.addEventListener('click', clearPendingFile);
  }

  if (formEl) {
    formEl.addEventListener('submit', async function(e) {
      e.preventDefault();
      if (isSending) return;
      var text = inputEl ? inputEl.value.trim() : '';
      if (!text && !pendingFile) return;

      isSending = true;
      syncSendState();
      try {
        var c = await ensureE2eeReady();
        if (!c) {
          if (window.showAppToast) window.showAppToast(state.networkError);
          return;
        }

        var fileBytes = null;
        var fileMime = '';
        var sentLocalPreview = '';
        if (pendingFile) {
          fileBytes = await pendingFile.arrayBuffer();
          fileMime = pendingFile.type || 'image/jpeg';
          if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
            sentLocalPreview = URL.createObjectURL(pendingFile);
          }
        }

        var enc;
        try {
          enc = await c.encryptMessage({
            partnerUserId: state.activePartnerId,
            text: text,
            fileBytes: fileBytes,
            fileMime: fileMime
          });
        } catch (encErr) {
          if (sentLocalPreview) { try { URL.revokeObjectURL(sentLocalPreview); } catch (e2) {} }
          if (encErr && encErr.code === 'PARTNER_NOT_READY') {
            showBanner(state.e2eePartnerNotReady, false, '');
            if (window.showAppToast) window.showAppToast(state.e2eePartnerNotReady);
            return;
          }
          if (encErr && encErr.code === 'KEY_CHANGED') {
            pendingKeyChange = {
              userId: encErr.userId,
              deviceId: encErr.deviceId,
              identityKey: encErr.identityKey
            };
            showBanner(state.e2eeKeyChanged, true, state.e2eeAcceptNewKey);
            return;
          }
          if (encErr && encErr.code === 'INVALID_IMAGE') {
            if (window.showAppToast) window.showAppToast(state.errInvalidImage);
            return;
          }
          if (encErr && encErr.code === 'IMAGE_TOO_LARGE') {
            if (window.showAppToast) window.showAppToast(state.errImageTooLarge);
            return;
          }
          if (window.showAppToast) window.showAppToast(state.networkError);
          return;
        }

        var res;
        if (enc.encryptedBlob) {
          var fd = new FormData();
          if (state.activeConversationId > 0) fd.append('conversation_id', String(state.activeConversationId));
          else if (state.activePartnerId > 0) fd.append('target_user_id', String(state.activePartnerId));
          fd.append('sender_device_id', String(enc.senderDeviceId));
          fd.append('envelopes', JSON.stringify(enc.envelopes));
          fd.append('encrypted_media', enc.encryptedBlob, 'media.enc');
          res = await fetch('/api/messages/send', { method: 'POST', credentials: 'same-origin', body: fd });
        } else {
          var payloadBody = {
            sender_device_id: enc.senderDeviceId,
            envelopes: enc.envelopes
          };
          if (state.activeConversationId > 0) payloadBody.conversation_id = state.activeConversationId;
          else if (state.activePartnerId > 0) payloadBody.target_user_id = state.activePartnerId;
          res = await fetch('/api/messages/send', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadBody)
          });
        }
        var data = await res.json();
        if (res.ok && data && data.success && data.message) {
          hideBanner();
          if (data.conversation_id) state.activeConversationId = Number(data.conversation_id);
          await c.cacheSentMessage(Number(data.message.id), enc.payload);
          if (inputEl) inputEl.value = '';
          clearPendingFile();
          appendMessageIfNew(data.message, true, enc.payload, sentLocalPreview);
          updateSidebarPreview(state.activeConversationId, state.currentUserId, enc.payload.text, Boolean(enc.payload.media));
        } else {
          if (sentLocalPreview) { try { URL.revokeObjectURL(sentLocalPreview); } catch (e3) {} }
          if (window.showAppToast) window.showAppToast((data && data.error) || state.networkError);
        }
      } catch (err) {
        if (window.showAppToast) window.showAppToast(state.networkError);
      } finally {
        isSending = false;
        syncSendState();
      }
    });
  }

  if (loadOlderBtn && listEl && scrollEl) {
    loadOlderBtn.addEventListener('click', async function() {
      if (!state.activeConversationId || !state.oldestMsgId || loadOlderBtn.disabled) return;
      loadOlderBtn.disabled = true;
      var prevHeight = scrollEl.scrollHeight;
      try {
        var res = await fetch(
          '/api/messages/list?conversation_id=' + state.activeConversationId + '&before_id=' + state.oldestMsgId,
          { credentials: 'same-origin', cache: 'no-store' }
        );
        var data = await res.json();
        if (res.ok && data && Array.isArray(data.messages)) {
          var c = await ensureE2eeReady();
          var frag = document.createDocumentFragment();
          for (var i = 0; i < data.messages.length; i++) {
            var m = data.messages[i];
            if (listEl.querySelector('.dm-msg-row[data-msg-id="' + m.id + '"]')) continue;
            var dec = null;
            if (m.is_encrypted && c) {
              var rDec = await c.decryptMessage(m);
              if (rDec.ok && rDec.payload) dec = rDec.payload;
            }
            frag.appendChild(buildMessageRowEl(m, dec, ''));
          }
          listEl.insertBefore(frag, listEl.firstChild);
          if (data.messages.length > 0) {
            state.oldestMsgId = Number(data.messages[0].id);
          }
          scrollEl.scrollTop = scrollEl.scrollHeight - prevHeight;
          if (!data.has_more) {
            loadOlderBtn.remove();
          } else {
            loadOlderBtn.disabled = false;
          }
        } else {
          loadOlderBtn.disabled = false;
        }
      } catch (err) {
        loadOlderBtn.disabled = false;
      }
    });
  }

  if (listEl) {
    listEl.addEventListener('click', function(e) {
      var imgBtn = e.target && e.target.closest ? e.target.closest('[data-dm-lightbox]') : null;
      if (imgBtn && lightbox && lightboxImg) {
        lightboxImg.src = imgBtn.getAttribute('data-dm-lightbox') || '';
        lightbox.classList.add('visible');
        return;
      }
      var unsendBtn = e.target && e.target.closest ? e.target.closest('[data-unsend-id]') : null;
      if (!unsendBtn) return;
      var msgId = parseInt(unsendBtn.getAttribute('data-unsend-id'), 10);
      if (!msgId) return;

      function doUnsend() {
        fetch('/api/messages/delete', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message_id: msgId })
        }).then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
          .then(function(res) {
            if (res.ok && res.d && res.d.success) {
              var row = listEl.querySelector('.dm-msg-row[data-msg-id="' + msgId + '"]');
              if (row) row.remove();
              updateSeenUI();
            } else if (window.showAppToast) {
              window.showAppToast((res.d && res.d.error) || state.networkError);
            }
          })
          .catch(function() {
            if (window.showAppToast) window.showAppToast(state.networkError);
          });
      }

      if (window.showAppConfirm) {
        window.showAppConfirm({
          title: state.unsendTitle,
          message: state.unsendDesc,
          okText: state.deleteBtn,
          danger: true,
          onOk: doUnsend
        });
      } else if (window.confirm(state.unsendDesc)) {
        doUnsend();
      }
    });
  }

  if (lightbox) {
    if (lightboxCloseBtn) {
      lightboxCloseBtn.addEventListener('click', function() {
        lightbox.classList.remove('visible');
      });
    }
    lightbox.addEventListener('click', function(e) {
      if (e.target === lightbox) lightbox.classList.remove('visible');
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && lightbox.classList.contains('visible')) {
        lightbox.classList.remove('visible');
      }
    });
  }

  function renderDmSearchUsers(users) {
    if (!searchResults) return;
    searchResults.innerHTML = '';
    var filtered = (users || []).filter(function(u) {
      return Number(u.id) !== Number(state.currentUserId);
    });
    if (!filtered.length) {
      var empty = document.createElement('div');
      empty.className = 'search-empty';
      empty.textContent = state.noResults;
      searchResults.appendChild(empty);
      return;
    }
    filtered.forEach(function(u) {
      var a = document.createElement('a');
      a.className = 'dm-conv-item';
      a.href = '/messages/' + encodeURIComponent(u.username);

      var av = document.createElement('div');
      av.className = 'dm-avatar';
      if (u.avatar_key) {
        var im = document.createElement('img');
        im.src = '/media/' + encodeURIComponent(u.avatar_key);
        im.alt = u.username;
        av.appendChild(im);
      } else {
        var sp = document.createElement('span');
        sp.textContent = (u.display_name || u.username || '?').charAt(0).toUpperCase();
        av.appendChild(sp);
      }

      var meta = document.createElement('div');
      meta.className = 'dm-conv-meta';
      var top = document.createElement('div');
      top.className = 'dm-conv-top';
      var nameEl = document.createElement('span');
      nameEl.className = 'dm-conv-name';
      nameEl.textContent = u.username;
      if (Number(u.is_verified) === 1 && window.renderVerifiedBadge) {
        nameEl.insertAdjacentHTML('beforeend', window.renderVerifiedBadge(13));
      }
      top.appendChild(nameEl);
      var sub = document.createElement('div');
      sub.className = 'dm-conv-preview';
      sub.textContent = u.display_name || u.username;

      meta.appendChild(top);
      meta.appendChild(sub);
      a.appendChild(av);
      a.appendChild(meta);
      searchResults.appendChild(a);
    });
  }

  if (searchInput && searchResults && convListEl) {
    searchInput.addEventListener('input', function() {
      var q = this.value.trim();
      if (q.length > 0) {
        if (searchClearBtn) searchClearBtn.style.display = 'flex';
        convListEl.style.display = 'none';
        searchResults.style.display = 'flex';
        clearTimeout(searchTimer);
        searchTimer = setTimeout(async function() {
          if (searchAbort) searchAbort.abort();
          searchAbort = new AbortController();
          try {
            var r = await fetch('/api/users/search?q=' + encodeURIComponent(q), { signal: searchAbort.signal });
            if (!r.ok) return;
            var d = await r.json();
            renderDmSearchUsers(d.users || []);
          } catch (e) {}
        }, 220);
      } else {
        if (searchClearBtn) searchClearBtn.style.display = 'none';
        searchResults.style.display = 'none';
        searchResults.innerHTML = '';
        convListEl.style.display = 'flex';
      }
    });

    if (searchClearBtn) {
      searchClearBtn.addEventListener('click', function() {
        searchInput.value = '';
        searchClearBtn.style.display = 'none';
        searchResults.style.display = 'none';
        searchResults.innerHTML = '';
        convListEl.style.display = 'flex';
        searchInput.focus();
      });
    }
  }

  async function pollActiveChat() {
    if (isPolling || document.visibilityState === 'hidden' || !state.activeConversationId) return;
    isPolling = true;
    try {
      var r = await fetch(
        '/api/messages/poll?conversation_id=' + state.activeConversationId + '&after_id=' + state.lastMsgId,
        { credentials: 'same-origin', cache: 'no-store' }
      );
      if (!r.ok) return;
      var d = await r.json();
      if (d && d.success) {
        var nearBottom = !scrollEl || (scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 140);
        if (Array.isArray(d.messages) && d.messages.length > 0) {
          var c = await ensureE2eeReady();
          for (var i = 0; i < d.messages.length; i++) {
            var m = d.messages[i];
            var dec = null;
            if (m.is_encrypted && c) {
              var rDec = await c.decryptMessage(m);
              if (rDec.ok && rDec.payload) dec = rDec.payload;
            }
            appendMessageIfNew(m, nearBottom, dec, '');
            updateSidebarPreview(
              state.activeConversationId,
              m.sender_id,
              dec ? dec.text : (m.is_encrypted ? '' : m.body),
              dec ? Boolean(dec.media) : Boolean(m.image_key)
            );
          }
        }
        if (typeof d.last_read_own_id === 'number') {
          state.lastReadOwnId = d.last_read_own_id;
          updateSeenUI();
        }
        if (typeof d.unread_total === 'number' && window.updateUnreadMessagesBadge) {
          window.updateUnreadMessagesBadge(d.unread_total);
        }
      }
    } catch (e) {
    } finally {
      isPolling = false;
    }
  }

  if (state.activeConversationId > 0) {
    window.__dmPollTimer = setInterval(pollActiveChat, 2500);
  }
})();
`;

  return layout(`${t.common.appName} — ${t.messages.title}`, body, script, t, theme);
}
