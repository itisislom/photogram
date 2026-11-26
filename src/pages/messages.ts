import { ConversationItem, DirectMessage, MessageReaction, User } from '../types';
import { ALLOWED_DM_REACTIONS } from '../messages';
import { layout, escapeHtml, safeJsonForScript, renderVerifiedBadge } from './layout';
import { renderBottomNav, CLOSE_ICON } from './nav';
import { SEND_COMMENT_ICON } from './commentsModal';
import { Translations, LangCode, ru, formatLocalizedShortDate, formatLocalizedTime, getClientDateFormat, formatCompactCount, getCompactCountUnits } from '../languages';

const BACK_ICON = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`;
const SEARCH_ICON = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
const PHOTO_ICON = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" ry="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
const CHAT_BIG_ICON = `<svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;
const TRASH_SM_ICON = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
const EDIT_SM_ICON = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const COPY_SM_ICON = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
const LOCK_XS_ICON = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;

function parseDateSafe(dateStr: string): Date {
  if (!dateStr) return new Date();
  const s = String(dateStr).trim();
  if (s.includes('T')) return new Date(s.endsWith('Z') ? s : s + 'Z');
  return new Date(s.replace(' ', 'T') + 'Z');
}

function formatDmShortTime(dateStr: string, t: Translations, timeZone: string): string {
  try {
    const d = parseDateSafe(dateStr);
    if (isNaN(d.getTime())) return '';
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return t.common.justNow;
    if (diff < 3600) return `${Math.floor(diff / 60)} ${t.common.minutesShort}`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ${t.common.hoursShort}`;
    if (diff < 7 * 86400) return `${Math.floor(diff / 86400)} ${t.common.daysShort}`;
    return formatLocalizedShortDate(d, t.code, timeZone);
  } catch {
    return '';
  }
}

function formatMsgClock(dateStr: string, timeZone: string): string {
  try {
    const d = parseDateSafe(dateStr);
    return isNaN(d.getTime()) ? '' : formatLocalizedTime(d, timeZone);
  } catch {
    return '';
  }
}

function renderMsgReactionsHtml(msgId: number, reactions?: MessageReaction[], lang: LangCode = 'ru'): string {
  const list = Array.isArray(reactions) ? reactions : [];
  const pills = list
    .map(
      (r) =>
        `<button type="button" class="dm-reaction-pill${r.mine ? ' mine' : ''}" data-react-msg-id="${msgId}" data-react-emoji="${escapeHtml(r.emoji)}"><span class="dm-reaction-emoji">${escapeHtml(r.emoji)}</span>${r.count > 1 ? `<span class="dm-reaction-count">${escapeHtml(formatCompactCount(r.count, lang))}</span>` : ''}</button>`,
    )
    .join('');
  return `<div class="dm-msg-reactions" data-reactions-for="${msgId}">${pills}</div>`;
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
  timeZone: string = 'UTC',
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
          <a href="/messages/${encodeURIComponent(c.other_username)}" class="dm-conv-item ${isCurrent ? 'active' : ''} ${c.unread_count > 0 && !isCurrent ? 'unread' : ''}" data-conv-id="${c.id}" data-partner-id="${c.other_user_id}" data-partner-username="${escapeHtml(c.other_username)}" data-last-msg-id="${c.last_message_id || 0}" data-last-encrypted="${c.last_message_encrypted ? '1' : '0'}" data-last-mine="${c.last_message_sender_id === currentUser.id ? '1' : '0'}" data-last-edit-version="${c.last_message_edit_version || 0}">
            <div class="dm-avatar">${avatarHtml}</div>
            <div class="dm-conv-meta">
              <div class="dm-conv-top">
                <span class="dm-conv-name">${escapeHtml(c.other_username)}${c.other_is_verified ? renderVerifiedBadge(13) : ''}</span>
                <span class="dm-conv-time">${escapeHtml(formatDmShortTime(c.last_message_at, t, timeZone))}</span>
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

  const initialConvLastMessages: Record<string, {
    id: number;
    sender_id: number;
    sender_device_id: number;
    is_encrypted: number;
    ciphertext_envelope: string;
    edit_version: number;
  }> = {};
  for (const c of conversations) {
    if (c.last_message_encrypted && c.last_message_id && c.last_message_ciphertext_envelope) {
      initialConvLastMessages[String(c.id)] = {
        id: Number(c.last_message_id),
        sender_id: Number(c.last_message_sender_id || 0),
        sender_device_id: Number(c.last_message_sender_device_id || 0),
        is_encrypted: 1,
        ciphertext_envelope: c.last_message_ciphertext_envelope,
        edit_version: Number(c.last_message_edit_version || 0),
      };
    }
  }

  const initialEncryptedMessages = messages
    .filter((m) => Boolean(m.is_encrypted))
    .map((m) => ({
      id: Number(m.id),
      sender_id: Number(m.sender_id),
      sender_device_id: Number(m.sender_device_id || 0),
      is_encrypted: 1,
      image_key: m.image_key || '',
      ciphertext_envelope: m.ciphertext_envelope || '',
      edited_at: m.edited_at || null,
      edit_version: Number(m.edit_version || 0),
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
            const isEdited = Boolean(m.edited_at);
            const editVer = Number(m.edit_version || 0);
            const timeInner = `${isEdited ? `<span class="dm-msg-edited">${escapeHtml(t.messages.editedLabel)}</span> ` : ''}<span class="dm-msg-clock">${escapeHtml(formatMsgClock(m.created_at, timeZone))}</span>`;
            const unsendBtn = isMine
              ? `<button type="button" class="dm-unsend-btn" data-unsend-id="${m.id}" aria-label="${escapeHtml(t.messages.unsend)}" title="${escapeHtml(t.messages.unsend)}">${TRASH_SM_ICON}</button>`
              : '';
            if (isEnc) {
              return `
            <div class="dm-msg-row ${isMine ? 'mine' : 'theirs'}" data-msg-id="${m.id}" data-encrypted="1" data-edit-version="${editVer}" data-image-key="${escapeHtml(m.image_key || '')}">
              ${isMine ? unsendBtn : ''}
              <div class="dm-msg-stack">
                <div class="dm-msg-bubble">
                  <div class="dm-msg-text dm-msg-decrypt-err" data-enc-slot="1">${escapeHtml(t.messages.e2eeInitializing)}</div>
                  <div class="dm-msg-time" data-ts="${escapeHtml(m.created_at)}" data-edited="${isEdited ? '1' : '0'}">${timeInner}</div>
                </div>
                ${renderMsgReactionsHtml(m.id, m.reactions, t.code)}
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
            <div class="dm-msg-row ${isMine ? 'mine' : 'theirs'}" data-msg-id="${m.id}" data-edit-version="${editVer}" data-image-key="${escapeHtml(m.image_key || '')}">
              ${isMine ? unsendBtn : ''}
              <div class="dm-msg-stack">
                <div class="dm-msg-bubble ${m.image_key && !m.body ? 'img-only' : ''}">
                  ${imgHtml}
                  ${textHtml}
                  <div class="dm-msg-time" data-ts="${escapeHtml(m.created_at)}" data-edited="${isEdited ? '1' : '0'}">${timeInner}</div>
                </div>
                ${renderMsgReactionsHtml(m.id, m.reactions, t.code)}
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

    <div class="dm-edit-bar" id="dmEditBar" style="display:none;">
      <div class="dm-edit-bar-icon">${EDIT_SM_ICON}</div>
      <div class="dm-edit-bar-meta">
        <div class="dm-edit-bar-title">${escapeHtml(t.messages.editingMessage)}</div>
        <div class="dm-edit-bar-preview" id="dmEditBarPreview"></div>
      </div>
      <button type="button" class="dm-edit-bar-close" id="dmEditCancelBtn" aria-label="${escapeHtml(t.common.close)}">${CLOSE_ICON}</button>
    </div>

    <div class="dm-attach-preview" id="dmAttachPreview" style="display:none;">
      <img id="dmAttachThumb" src="" alt="${escapeHtml(t.messages.photoLabel)}">
      <button type="button" class="dm-attach-clear" id="dmAttachClearBtn" aria-label="${escapeHtml(t.common.close)}">${CLOSE_ICON}</button>
    </div>

    <div class="dm-composer" id="dmComposeForm">
      <input type="file" id="dmImageInput" style="display:none;">
      <button type="button" class="dm-attach-btn" id="dmAttachBtn" aria-label="${escapeHtml(t.messages.photoLabel)}" title="${escapeHtml(t.messages.photoLabel)}">${PHOTO_ICON}</button>
      <div class="dm-input pg-ce-input" id="dmMessageInput" contenteditable="plaintext-only" role="textbox" aria-multiline="false" inputmode="text" enterkeyhint="send" data-placeholder="${escapeHtml(t.messages.inputPlaceholder)}" data-maxlength="2000" aria-label="${escapeHtml(t.messages.inputPlaceholder)}"></div>
      <button type="button" class="dm-send-btn" id="dmSendBtn" aria-label="${escapeHtml(t.messages.send)}" title="${escapeHtml(t.messages.send)}" disabled>${SEND_COMMENT_ICON}</button>
    </div>`;
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
          <div id="dmSearchInput" class="dm-search-input pg-ce-input" contenteditable="plaintext-only" role="searchbox" inputmode="search" enterkeyhint="search" spellcheck="false" data-placeholder="${escapeHtml(t.messages.searchPlaceholder)}" data-maxlength="50" aria-label="${escapeHtml(t.messages.searchPlaceholder)}"></div>
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

  <div class="dm-ctx-menu" id="dmConvCtxMenu" role="menu" aria-hidden="true">
    <button type="button" class="dm-ctx-item dm-ctx-danger" id="dmCtxDeleteBtn" role="menuitem">
      ${TRASH_SM_ICON}
      <span>${escapeHtml(t.messages.deleteChat)}</span>
    </button>
  </div>

  <div class="dm-reaction-picker" id="dmReactionPicker" role="menu" aria-hidden="true">
    <div class="dm-reaction-row">
      ${ALLOWED_DM_REACTIONS.map((em) => `<button type="button" class="dm-reaction-pick-btn" data-pick-emoji="${escapeHtml(em)}" role="menuitem" aria-label="${escapeHtml(em)}">${escapeHtml(em)}</button>`).join('')}
    </div>
    <div class="dm-msg-action-list" id="dmMsgActionList">
      <button type="button" class="dm-msg-action-btn" id="dmMsgCopyBtn" role="menuitem" style="display:none;">
        ${COPY_SM_ICON}
        <span>${escapeHtml(t.messages.copyMessage)}</span>
      </button>
      <button type="button" class="dm-msg-action-btn" id="dmMsgEditBtn" role="menuitem" style="display:none;">
        ${EDIT_SM_ICON}
        <span>${escapeHtml(t.messages.editMessage)}</span>
      </button>
      <button type="button" class="dm-msg-action-btn dm-msg-action-danger" id="dmMsgDeleteBtn" role="menuitem">
        ${TRASH_SM_ICON}
        <span>${escapeHtml(t.messages.deleteMessage)}</span>
      </button>
    </div>
  </div>

  <div class="modal-backdrop" id="dmDeleteChatModal" aria-hidden="true">
    <div class="modal-card dm-delete-modal-card" role="dialog" aria-modal="true" aria-labelledby="dmDeleteChatTitle">
      <div class="dm-delete-modal-body">
        <h3 class="dm-delete-modal-title" id="dmDeleteChatTitle">${escapeHtml(t.messages.deleteChatConfirmTitle)}</h3>
        <p class="dm-delete-modal-desc" id="dmDeleteChatDesc"></p>
        <label class="dm-delete-check-row" for="dmDeleteForBothCheck">
          <input type="checkbox" id="dmDeleteForBothCheck" class="dm-delete-checkbox">
          <span class="dm-delete-check-box" aria-hidden="true"></span>
          <span class="dm-delete-check-label" id="dmDeleteForBothLabel"></span>
        </label>
      </div>
      <div class="dm-delete-modal-actions">
        <button type="button" class="dm-delete-action-btn" id="dmDeleteChatCancelBtn">${escapeHtml(t.common.cancel)}</button>
        <button type="button" class="dm-delete-action-btn dm-delete-action-danger" id="dmDeleteChatConfirmBtn">${escapeHtml(t.common.delete)}</button>
      </div>
    </div>
  </div>
</div>`;

  const lastMsgId = messages.length > 0 ? messages[messages.length - 1].id : 0;
  const oldestMsgId = messages.length > 0 ? messages[0].id : 0;

  const clientState = safeJsonForScript({
    currentUserId: currentUser.id,
    activeConversationId: activeConversationId || 0,
    activePartnerId: activePartner ? activePartner.id : 0,
    activePartnerUsername: activePartner ? activePartner.username : '',
    lastMsgId,
    oldestMsgId,
    lastReadOwnId,
    timeZone,
    initialEncrypted: initialEncryptedMessages,
    initialConvLastMessages,
    langCode: t.code,
    compactUnits: getCompactCountUnits(t.code),
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
    deleteChatConfirmTitle: t.messages.deleteChatConfirmTitle,
    deleteChatConfirmDesc: t.messages.deleteChatConfirmDesc,
    deleteChatAlsoFor: t.messages.deleteChatAlsoFor,
    deleteChatSuccess: t.messages.deleteChatSuccess,
    deleteMessageConfirmTitle: t.messages.deleteMessageConfirmTitle,
    deleteMessageConfirmDesc: t.messages.deleteMessageConfirmDesc,
    copiedToast: t.messages.copiedToast,
    editedLabel: t.messages.editedLabel,
    emptyListTitle: t.messages.emptyListTitle,
    emptyListDesc: t.messages.emptyListDesc,
    chatBigIcon: CHAT_BIG_ICON,
    deleteBtn: t.common.delete,
    noMessagesYet: t.messages.noMessagesYet,
    errImageTooLarge: t.messages.errImageTooLarge,
    errInvalidImage: t.messages.errInvalidImage,
    encryptedPreview: t.messages.encryptedPreview,
    e2eeKeyChanged: t.messages.e2eeKeyChanged,
    e2eeAcceptNewKey: t.messages.e2eeAcceptNewKey,
    e2eePartnerNotReady: t.messages.e2eePartnerNotReady,
    e2eeDecryptFailed: t.messages.e2eeDecryptFailed,
    trashIcon: TRASH_SM_ICON,
  });

  const script = `
(function() {
  if (window.__dmPollTimer) {
    clearInterval(window.__dmPollTimer);
    window.__dmPollTimer = null;
  }
  if (window.__dmConvPollTimer) {
    clearInterval(window.__dmConvPollTimer);
    window.__dmConvPollTimer = null;
  }
  if (window.__dmViewportCleanup) {
    try { window.__dmViewportCleanup(); } catch (e) {}
    window.__dmViewportCleanup = null;
  }

  document.documentElement.classList.add('dm-lock-scroll');
  document.body.classList.add('dm-lock-scroll');

  var dmShellEl = document.querySelector('.dm-shell');
  var scrollEl = document.getElementById('dmMessagesScroll');
  var listEl = document.getElementById('dmMessagesList');
  var isPinnedToBottom = true;
  var kbOpeningUntil = 0;
  var isAdjustingViewport = false;
  var lastScrollClientH = scrollEl ? scrollEl.clientHeight : 0;
  var kbTimers = [];
  var dmResizeObserver = null;

  function clearKbTimers() {
    for (var ti = 0; ti < kbTimers.length; ti++) {
      clearTimeout(kbTimers[ti]);
    }
    kbTimers = [];
  }

  function pinScrollBottomNow() {
    if (!scrollEl) return;
    isAdjustingViewport = true;
    scrollEl.scrollTop = scrollEl.scrollHeight;
    requestAnimationFrame(function() {
      if (scrollEl && (isPinnedToBottom || Date.now() < kbOpeningUntil)) {
        scrollEl.scrollTop = scrollEl.scrollHeight;
      }
      isAdjustingViewport = false;
    });
  }

  function syncDmViewport(forceBottom) {
    if (!dmShellEl) return;
    var prevClientH = scrollEl ? scrollEl.clientHeight : 0;
    var distFromBottom = scrollEl ? (scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight) : 0;
    var shouldPin = Boolean(forceBottom || isPinnedToBottom || Date.now() < kbOpeningUntil || distFromBottom < 80);

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

    if (scrollEl) {
      var nextClientH = scrollEl.clientHeight;
      if (shouldPin) {
        isPinnedToBottom = true;
        pinScrollBottomNow();
      } else if (prevClientH > 0 && nextClientH < prevClientH) {
        isAdjustingViewport = true;
        scrollEl.scrollTop += (prevClientH - nextClientH);
        requestAnimationFrame(function() {
          isAdjustingViewport = false;
        });
      }
      lastScrollClientH = nextClientH;
    }
  }
  function onViewportChange() {
    syncDmViewport(false);
  }
  syncDmViewport(true);
  window.addEventListener('resize', onViewportChange);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onViewportChange);
    window.visualViewport.addEventListener('scroll', onViewportChange);
  }
  if (scrollEl) {
    scrollEl.addEventListener('scroll', function() {
      if (isAdjustingViewport || Date.now() < kbOpeningUntil) return;
      isPinnedToBottom = (scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight) < 80;
    }, { passive: true });
    if (typeof ResizeObserver !== 'undefined') {
      dmResizeObserver = new ResizeObserver(function() {
        if (!scrollEl) return;
        var nextH = scrollEl.clientHeight;
        if (isPinnedToBottom || Date.now() < kbOpeningUntil) {
          pinScrollBottomNow();
        } else if (lastScrollClientH > 0 && nextH < lastScrollClientH) {
          isAdjustingViewport = true;
          scrollEl.scrollTop += (lastScrollClientH - nextH);
          requestAnimationFrame(function() {
            isAdjustingViewport = false;
          });
        }
        lastScrollClientH = nextH;
      });
      dmResizeObserver.observe(scrollEl);
      if (listEl) dmResizeObserver.observe(listEl);
    }
  }

  var e2eeClient = null;
  var pendingKeyChange = null;
  var extraCleanups = [];

  window.__dmViewportCleanup = function() {
    clearKbTimers();
    for (var ci = 0; ci < extraCleanups.length; ci++) {
      try { extraCleanups[ci](); } catch (e) {}
    }
    extraCleanups = [];
    if (dmResizeObserver) {
      try { dmResizeObserver.disconnect(); } catch (e) {}
      dmResizeObserver = null;
    }
    if (e2eeClient && typeof e2eeClient.revokeAllMediaUrls === 'function') {
      try { e2eeClient.revokeAllMediaUrls(); } catch (e) {}
    }
    document.documentElement.classList.remove('dm-lock-scroll');
    document.body.classList.remove('dm-lock-scroll');
    if (dmShellEl) {
      dmShellEl.style.removeProperty('--dm-vp-h');
      dmShellEl.style.removeProperty('--dm-vp-top');
    }
    window.removeEventListener('resize', onViewportChange);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', onViewportChange);
      window.visualViewport.removeEventListener('scroll', onViewportChange);
    }
  };

  var state = ${clientState};
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
  var e2eeBanner = document.getElementById('dmE2eeBanner');
  var e2eeBannerText = document.getElementById('dmE2eeBannerText');
  var e2eeBannerBtn = document.getElementById('dmE2eeBannerBtn');
  var convCtxMenu = document.getElementById('dmConvCtxMenu');
  var ctxDeleteBtn = document.getElementById('dmCtxDeleteBtn');
  var deleteChatModal = document.getElementById('dmDeleteChatModal');
  var deleteChatTitle = document.getElementById('dmDeleteChatTitle');
  var deleteChatDesc = document.getElementById('dmDeleteChatDesc');
  var deleteForBothCheck = document.getElementById('dmDeleteForBothCheck');
  var deleteForBothLabel = document.getElementById('dmDeleteForBothLabel');
  var deleteChatCancelBtn = document.getElementById('dmDeleteChatCancelBtn');
  var deleteChatConfirmBtn = document.getElementById('dmDeleteChatConfirmBtn');
  var reactionPicker = document.getElementById('dmReactionPicker');
  var msgActionList = document.getElementById('dmMsgActionList');
  var msgCopyBtn = document.getElementById('dmMsgCopyBtn');
  var msgEditBtn = document.getElementById('dmMsgEditBtn');
  var msgDeleteBtn = document.getElementById('dmMsgDeleteBtn');
  var editBar = document.getElementById('dmEditBar');
  var editBarPreview = document.getElementById('dmEditBarPreview');
  var editCancelBtn = document.getElementById('dmEditCancelBtn');

  var pendingFile = null;
  var pendingPreviewUrl = '';
  var editingMsg = null;
  var isSending = false;
  var isPolling = false;
  var isDeletingChat = false;
  var ctxTarget = null;
  var ctxActiveItem = null;
  var deleteTarget = null;
  var longPressTimer = null;
  var longPressDidFire = false;
  var longPressStartX = 0;
  var longPressStartY = 0;
  var suppressNextConvClickUntil = 0;
  var reactTargetMsgId = 0;
  var reactActiveRow = null;
  var msgLongPressTimer = null;
  var msgLongPressDidFire = false;
  var msgLongPressStartX = 0;
  var msgLongPressStartY = 0;
  var suppressNextMsgClickUntil = 0;
  var reactingMsgIds = {};
  var searchTimer = null;
  var searchAbort = null;

  function parseDateClient(dateStr) {
    if (!dateStr) return new Date();
    var s = String(dateStr).trim();
    if (s.indexOf('T') !== -1) return new Date(s.indexOf('Z') !== -1 ? s : s + 'Z');
    return new Date(s.replace(' ', 'T') + 'Z');
  }

  var activeTimeZone = (function() {
    try {
      var devTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (devTz) return devTz;
    } catch (e) {}
    return state.timeZone || 'UTC';
  })();

  function formatClockClient(dateStr) {
    try {
      var d = parseDateClient(dateStr);
      if (isNaN(d.getTime())) return '';
      try {
        var parts = new Intl.DateTimeFormat('en-GB', {
          timeZone: activeTimeZone,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).formatToParts(d);
        var hh = '00';
        var mm = '00';
        for (var i = 0; i < parts.length; i++) {
          if (parts[i].type === 'hour') hh = parts[i].value;
          if (parts[i].type === 'minute') mm = parts[i].value;
        }
        if (hh === '24') hh = '00';
        return hh.padStart(2, '0') + ':' + mm.padStart(2, '0');
      } catch (e2) {
        return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
      }
    } catch (e) {
      return '';
    }
  }

  function formatDmShortTimeClient(dateStr) {
    try {
      var d = parseDateClient(dateStr);
      if (isNaN(d.getTime())) return '';
      var diff = Math.floor((Date.now() - d.getTime()) / 1000);
      if (diff < 60) return state.justNow;
      if (diff < 3600) return Math.floor(diff / 60) + ' ' + state.minShort;
      if (diff < 86400) return Math.floor(diff / 3600) + ' ' + state.hoursShort;
      if (diff < 7 * 86400) return Math.floor(diff / 86400) + ' ' + state.daysShort;
      var cfg = state.dateFmt || { monthsShort: [], fullPattern: 'dmy' };
      var day = d.getDate();
      var monthIdx = d.getMonth();
      try {
        var parts = new Intl.DateTimeFormat('en-US', {
          timeZone: activeTimeZone,
          month: 'numeric',
          day: 'numeric'
        }).formatToParts(d);
        for (var i = 0; i < parts.length; i++) {
          if (parts[i].type === 'month') monthIdx = Math.max(0, Math.min(11, parseInt(parts[i].value, 10) - 1));
          if (parts[i].type === 'day') day = parseInt(parts[i].value, 10);
        }
      } catch (e2) {}
      var mon = (cfg.monthsShort && cfg.monthsShort[monthIdx]) || '';
      if (cfg.fullPattern === 'mdy') return mon + ' ' + day;
      return day + ' ' + mon;
    } catch (e) {
      return '';
    }
  }

  function cleanPreviewText(txt) {
    return String(txt || '').replace(/\\s+/g, ' ').trim();
  }

  function renderMsgTimeEl(timeEl, ts, isEdited) {
    if (!timeEl) return;
    var clockText = formatClockClient(ts);
    timeEl.setAttribute('data-ts', ts || '');
    timeEl.setAttribute('data-edited', isEdited ? '1' : '0');
    while (timeEl.firstChild) timeEl.removeChild(timeEl.firstChild);
    if (isEdited) {
      var edSpan = document.createElement('span');
      edSpan.className = 'dm-msg-edited';
      edSpan.textContent = state.editedLabel;
      timeEl.appendChild(edSpan);
      timeEl.appendChild(document.createTextNode(' '));
    }
    var clkSpan = document.createElement('span');
    clkSpan.className = 'dm-msg-clock';
    clkSpan.textContent = clockText;
    timeEl.appendChild(clkSpan);
  }

  function syncRenderedMsgClocks() {
    if (!listEl) return;
    listEl.querySelectorAll('.dm-msg-time[data-ts]').forEach(function(el) {
      var ts = el.getAttribute('data-ts');
      if (ts) {
        var formatted = formatClockClient(ts);
        var clk = el.querySelector('.dm-msg-clock');
        if (clk && formatted) clk.textContent = formatted;
        else if (formatted) renderMsgTimeEl(el, ts, el.getAttribute('data-edited') === '1');
      }
    });
  }

  function scrollToBottom() {
    if (scrollEl) {
      isPinnedToBottom = true;
      pinScrollBottomNow();
    }
  }

  function syncSendState() {
    if (!sendBtn) return;
    var hasText = inputEl && inputEl.value.trim().length > 0;
    var canSubmit = editingMsg
      ? Boolean((hasText || editingMsg.existingMedia || editingMsg.imageKey) && !isSending)
      : Boolean((hasText || pendingFile) && !isSending);
    sendBtn.disabled = !canSubmit;
    if (canSubmit) sendBtn.classList.add('active');
    else sendBtn.classList.remove('active');
  }

  function applyPlainBubbleEdit(bubble, timeEl, newText, hasImg) {
    if (!bubble || !timeEl) return;
    var txtEl = bubble.querySelector('.dm-msg-text');
    if (newText) {
      if (!txtEl) {
        txtEl = document.createElement('div');
        txtEl.className = 'dm-msg-text';
        bubble.insertBefore(txtEl, timeEl);
      }
      txtEl.textContent = newText;
      bubble.classList.remove('img-only');
    } else if (txtEl) {
      txtEl.remove();
      if (hasImg) bubble.classList.add('img-only');
    }
  }

  function cancelEditMode() {
    editingMsg = null;
    if (editBar) editBar.style.display = 'none';
    if (editBarPreview) editBarPreview.textContent = '';
    if (attachBtn) attachBtn.style.display = '';
    if (inputEl) inputEl.value = '';
    syncSendState();
  }

  async function startEditMode(msgId, row) {
    if (!msgId || !row || !inputEl) return;
    var currentText = '';
    var existingMedia = null;
    var isEncrypted = row.getAttribute('data-encrypted') === '1';
    var imageKey = row.getAttribute('data-image-key') || '';
    if (isEncrypted) {
      try {
        var c = e2eeClient || await ensureE2eeReady();
        if (c && typeof c.getCachedMessage === 'function') {
          var cached = await c.getCachedMessage(msgId);
          if (cached) {
            currentText = cached.text || '';
            existingMedia = cached.media || null;
          }
        }
      } catch (e) {}
    }
    if (!currentText) {
      var txtEl = row.querySelector('.dm-msg-text:not(.dm-msg-decrypt-err)');
      if (txtEl) currentText = txtEl.textContent || '';
    }
    clearPendingFile();
    editingMsg = {
      id: msgId,
      isEncrypted: isEncrypted,
      imageKey: imageKey,
      existingMedia: existingMedia,
      originalText: currentText
    };
    if (attachBtn) attachBtn.style.display = 'none';
    if (editBarPreview) editBarPreview.textContent = currentText || state.photoLabel;
    if (editBar) editBar.style.display = 'flex';
    inputEl.value = currentText;
    syncSendState();
    inputEl.focus();
    try {
      inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
    } catch (e2) {}
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
      img.addEventListener('load', function() {
        if (isPinnedToBottom || Date.now() < kbOpeningUntil) {
          pinScrollBottomNow();
        }
      });
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
    if (m.is_encrypted) row.setAttribute('data-encrypted', '1');
    row.setAttribute('data-edit-version', String(Number(m.edit_version || 0)));
    row.setAttribute('data-image-key', m.image_key || '');

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
    renderMsgTimeEl(timeEl, m.created_at || '', Boolean(m.edited_at));

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

    var stack = document.createElement('div');
    stack.className = 'dm-msg-stack';
    stack.appendChild(bubble);
    var reactWrap = document.createElement('div');
    reactWrap.className = 'dm-msg-reactions';
    reactWrap.setAttribute('data-reactions-for', String(m.id));
    stack.appendChild(reactWrap);
    row.appendChild(stack);
    renderMessageReactions(row, Array.isArray(m.reactions) ? m.reactions : []);
    return row;
  }

  function formatCompactCountClient(count) {
    var raw = Number(count);
    if (!isFinite(raw) || raw <= 0) return '0';
    var n = Math.floor(raw);
    if (n < 1000) return String(n);
    var u = state.compactUnits || { k: 'K', m: 'M', b: 'B' };
    var sep = state.langCode === 'en' ? '' : ' ';
    function fmt(val, unit) {
      var rounded = val >= 100 ? Math.floor(val) : Math.floor(val * 10) / 10;
      var s = (rounded % 1 === 0) ? String(rounded) : rounded.toFixed(1).replace(/\.0$/, '');
      return s + sep + unit;
    }
    if (n >= 1000000000) return fmt(n / 1000000000, u.b);
    if (n >= 1000000) return fmt(n / 1000000, u.m);
    return fmt(n / 1000, u.k);
  }

  function renderMessageReactions(row, reactions) {
    if (!row) return;
    var msgId = parseInt(row.getAttribute('data-msg-id') || '0', 10);
    if (!msgId) return;
    var wrap = row.querySelector('.dm-msg-reactions');
    if (!wrap) return;
    while (wrap.firstChild) wrap.removeChild(wrap.firstChild);
    if (!Array.isArray(reactions) || reactions.length === 0) return;
    for (var i = 0; i < reactions.length; i++) {
      var r = reactions[i];
      if (!r || !r.emoji) continue;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dm-reaction-pill' + (r.mine ? ' mine' : '');
      btn.setAttribute('data-react-msg-id', String(msgId));
      btn.setAttribute('data-react-emoji', r.emoji);
      var emSpan = document.createElement('span');
      emSpan.className = 'dm-reaction-emoji';
      emSpan.textContent = r.emoji;
      btn.appendChild(emSpan);
      if (Number(r.count) > 1) {
        var cntSpan = document.createElement('span');
        cntSpan.className = 'dm-reaction-count';
        cntSpan.textContent = formatCompactCountClient(r.count);
        btn.appendChild(cntSpan);
      }
      wrap.appendChild(btn);
    }
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

  function syncAfterMsgRemoval() {
    if (!listEl) return;
    var rows = listEl.querySelectorAll('.dm-msg-row[data-msg-id]');
    if (rows.length > 0) {
      var firstId = parseInt(rows[0].getAttribute('data-msg-id') || '0', 10);
      if (firstId > 0) state.oldestMsgId = firstId;
      var lastRow = rows[rows.length - 1];
      if (convListEl && state.activeConversationId) {
        var item = convListEl.querySelector('.dm-conv-item[data-conv-id="' + state.activeConversationId + '"]');
        if (item) {
          var previewEl = item.querySelector('.dm-conv-preview');
          if (previewEl) {
            var isMine = lastRow.classList.contains('mine');
            var prefix = isMine ? state.youPrefix : '';
            var txtEl = lastRow.querySelector('.dm-msg-text');
            var txt = txtEl ? (txtEl.textContent || '') : '';
            var hasImg = Boolean(lastRow.querySelector('.dm-msg-img') || lastRow.getAttribute('data-image-key'));
            var isEnc = lastRow.getAttribute('data-encrypted') === '1';
            previewEl.textContent = txt ? (prefix + txt) : (hasImg ? (prefix + state.photoLabel) : (isEnc ? (prefix + state.encryptedPreview) : ''));
          }
        }
      }
    } else {
      state.oldestMsgId = 0;
      if (convListEl && state.activeConversationId) {
        var emptyItem = convListEl.querySelector('.dm-conv-item[data-conv-id="' + state.activeConversationId + '"]');
        if (emptyItem) {
          var emptyPrev = emptyItem.querySelector('.dm-conv-preview');
          if (emptyPrev) emptyPrev.textContent = '';
        }
      }
    }
    updateSeenUI();
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

  var convEncryptedMeta = {};
  if (state.initialConvLastMessages && typeof state.initialConvLastMessages === 'object') {
    Object.keys(state.initialConvLastMessages).forEach(function(k) {
      convEncryptedMeta[k] = state.initialConvLastMessages[k];
    });
  }
  var sidebarDecryptFailed = {};
  var isHydratingSidebar = false;
  var needSidebarRehydrate = false;

  async function hydrateSidebarEncryptedPreviews() {
    if (!convListEl) return;
    if (isHydratingSidebar) {
      needSidebarRehydrate = true;
      return;
    }
    var c = e2eeClient || await ensureE2eeReady();
    if (!c) return;
    isHydratingSidebar = true;
    try {
      do {
        needSidebarRehydrate = false;
        var items = convListEl.querySelectorAll('.dm-conv-item[data-last-encrypted="1"]');
        for (var i = 0; i < items.length; i++) {
          var item = items[i];
          var convId = item.getAttribute('data-conv-id') || '';
          var lastId = parseInt(item.getAttribute('data-last-msg-id') || '0', 10);
          var editVer = parseInt(item.getAttribute('data-last-edit-version') || '0', 10);
          if (!lastId) continue;
          var verKey = lastId + ':' + editVer;
          if (item.getAttribute('data-preview-hydrated') === verKey) continue;
          var payload = null;
          var cached = await c.getCachedMessage(lastId);
          if (cached && Number(cached.editVersion || 0) >= editVer) {
            payload = cached;
          } else {
            var meta = convEncryptedMeta[convId];
            if (meta && Number(meta.id) === lastId && meta.ciphertext_envelope && !sidebarDecryptFailed[verKey]) {
              try {
                var decRes = await c.decryptMessage(meta);
                if (decRes && decRes.ok && decRes.payload) {
                  payload = decRes.payload;
                } else {
                  sidebarDecryptFailed[verKey] = true;
                }
              } catch (de) {
                sidebarDecryptFailed[verKey] = true;
              }
            }
          }
          var previewEl = item.querySelector('.dm-conv-preview');
          if (!previewEl) continue;
          var prefix = item.getAttribute('data-last-mine') === '1' ? state.youPrefix : '';
          if (!payload) {
            if (sidebarDecryptFailed[verKey]) {
              previewEl.textContent = prefix + state.encryptedPreview;
            }
            continue;
          }
          var cleanTxt = cleanPreviewText(payload.text);
          previewEl.textContent = cleanTxt
            ? (prefix + cleanTxt)
            : (payload.media ? (prefix + state.photoLabel) : (prefix + state.encryptedPreview));
          item.setAttribute('data-preview-hydrated', verKey);
        }
      } while (needSidebarRehydrate);
    } finally {
      isHydratingSidebar = false;
    }
  }

  async function hydrateInitialMessages() {
    try {
      var c = await ensureE2eeReady();
      if (!c) return;

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
          if (Number(m.id) === Number(state.lastMsgId) && Number(m.edit_version || 0) > 0) {
            updateSidebarPreview(state.activeConversationId, m.sender_id, res.payload.text, Boolean(res.payload.media));
          }
        } else {
          if (res && res.reason === 'KEY_CHANGED' && res.userId && res.deviceId) {
            pendingKeyChange = {
              userId: res.userId,
              deviceId: res.deviceId,
              identityKey: res.identityKey || ''
            };
            showBanner(state.e2eeKeyChanged, true, state.e2eeAcceptNewKey);
          }
          var slot = bubble.querySelector('[data-enc-slot="1"]');
          if (slot) slot.textContent = state.e2eeDecryptFailed;
        }
      }
      await hydrateSidebarEncryptedPreviews();
      if (scrollEl) scrollToBottom();
    } catch (e) {}
  }

  syncRenderedMsgClocks();
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
      } catch (e) {}
    });
  }

  if (inputEl && window.pgBindPlainEditable) {
    window.pgBindPlainEditable(inputEl, {
      onEnter: function() {
        if (typeof submitDmMessage === 'function') submitDmMessage();
      }
    });
  }
  if (searchInput && window.pgBindPlainEditable) {
    window.pgBindPlainEditable(searchInput, {});
  }

  if (inputEl) {
    inputEl.addEventListener('input', syncSendState);
    inputEl.addEventListener('focus', function() {
      var snap = isPinnedToBottom || !scrollEl || (scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight) < 140;
      if (snap) {
        isPinnedToBottom = true;
        kbOpeningUntil = Date.now() + 750;
      }
      clearKbTimers();
      syncDmViewport(snap);
      [60, 180, 350, 550].forEach(function(ms) {
        kbTimers.push(setTimeout(function() {
          syncDmViewport(snap);
        }, ms));
      });
    });
    inputEl.addEventListener('blur', function() {
      clearKbTimers();
      kbOpeningUntil = 0;
      kbTimers.push(setTimeout(function() {
        syncDmViewport(false);
      }, 100));
      kbTimers.push(setTimeout(function() {
        syncDmViewport(false);
      }, 300));
    });
  }

  if (attachBtn && fileInput) {
    attachBtn.addEventListener('click', function() {
      fileInput.click();
    });
    fileInput.addEventListener('change', function() {
      var f = this.files && this.files[0];
      if (!f) return;
      var allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
      if (f.type && allowedMime.indexOf(f.type) === -1) {
        if (window.showAppToast) window.showAppToast(state.errInvalidImage);
        this.value = '';
        return;
      }
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

  if (editCancelBtn) {
    editCancelBtn.addEventListener('click', cancelEditMode);
  }

  async function submitDmMessage(e) {
      if (e && e.preventDefault) e.preventDefault();
      if (isSending) return;
      var text = inputEl ? inputEl.value.trim() : '';

      if (editingMsg) {
        if (!text && !editingMsg.existingMedia && !editingMsg.imageKey) return;
        var editTarget = editingMsg;
        isSending = true;
        syncSendState();
        try {
          if (!editTarget.isEncrypted) {
            var plainRes = await fetch('/api/messages/edit', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message_id: editTarget.id,
                body: text
              })
            });
            var plainData = await plainRes.json();
            if (plainRes.ok && plainData && plainData.success) {
              var plainVer = Number(plainData.edit_version || 1);
              if (listEl) {
                var pRow = listEl.querySelector('.dm-msg-row[data-msg-id="' + editTarget.id + '"]');
                if (pRow) {
                  pRow.setAttribute('data-edit-version', String(plainVer));
                  var pBubble = pRow.querySelector('.dm-msg-bubble');
                  var pTime = pRow.querySelector('.dm-msg-time');
                  if (pBubble && pTime) {
                    renderMsgTimeEl(pTime, pTime.getAttribute('data-ts') || '', true);
                    applyPlainBubbleEdit(pBubble, pTime, text, Boolean(editTarget.imageKey));
                  }
                }
              }
              if (Number(editTarget.id) === Number(state.lastMsgId)) {
                updateSidebarPreview(state.activeConversationId, state.currentUserId, text, Boolean(editTarget.imageKey));
              }
              cancelEditMode();
            } else if (window.showAppToast) {
              window.showAppToast((plainData && plainData.error) || state.networkError);
            }
            return;
          }

          var ec = await ensureE2eeReady();
          if (!ec) {
            if (window.showAppToast) window.showAppToast(state.networkError);
            return;
          }
          var encEdit;
          try {
            encEdit = await ec.encryptMessage({
              partnerUserId: state.activePartnerId,
              text: text,
              existingMedia: editTarget.existingMedia,
              editOf: editTarget.id
            });
          } catch (encEditErr) {
            if (encEditErr && encEditErr.code === 'PARTNER_NOT_READY') {
              if (window.showAppToast) window.showAppToast(state.e2eePartnerNotReady);
              return;
            }
            if (encEditErr && encEditErr.code === 'KEY_CHANGED') {
              pendingKeyChange = {
                userId: encEditErr.userId,
                deviceId: encEditErr.deviceId,
                identityKey: encEditErr.identityKey
              };
              showBanner(state.e2eeKeyChanged, true, state.e2eeAcceptNewKey);
              return;
            }
            if (window.showAppToast) window.showAppToast(state.networkError);
            return;
          }
          var editRes = await fetch('/api/messages/edit', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message_id: editTarget.id,
              sender_device_id: encEdit.senderDeviceId,
              envelopes: encEdit.envelopes
            })
          });
          var editData = await editRes.json();
          if (editRes.ok && editData && editData.success) {
            hideBanner();
            var nextVer = Number(editData.edit_version || 1);
            await ec.cacheSentMessage(editTarget.id, encEdit.payload, nextVer);
            if (listEl) {
              var editedRow = listEl.querySelector('.dm-msg-row[data-msg-id="' + editTarget.id + '"]');
              if (editedRow) {
                editedRow.setAttribute('data-edit-version', String(nextVer));
                var eBubble = editedRow.querySelector('.dm-msg-bubble');
                var eTime = editedRow.querySelector('.dm-msg-time');
                if (eBubble && eTime) {
                  renderMsgTimeEl(eTime, eTime.getAttribute('data-ts') || '', true);
                  hydrateBubbleContent(eBubble, eTime, encEdit.payload, editTarget.imageKey || '', '');
                }
              }
            }
            if (Number(editTarget.id) === Number(state.lastMsgId)) {
              updateSidebarPreview(state.activeConversationId, state.currentUserId, encEdit.payload.text, Boolean(encEdit.payload.media));
            }
            cancelEditMode();
          } else if (window.showAppToast) {
            window.showAppToast((editData && editData.error) || state.networkError);
          }
        } catch (errEdit) {
          if (window.showAppToast) window.showAppToast(state.networkError);
        } finally {
          isSending = false;
          syncSendState();
        }
        return;
      }

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
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', submitDmMessage);
  }

  if (loadOlderBtn && listEl && scrollEl) {
    loadOlderBtn.addEventListener('click', async function() {
      if (!state.activeConversationId || !state.oldestMsgId || loadOlderBtn.disabled) return;
      isPinnedToBottom = false;
      kbOpeningUntil = 0;
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
              if (rDec.ok && rDec.payload) {
                dec = rDec.payload;
              } else if (rDec && rDec.reason === 'KEY_CHANGED' && rDec.userId && rDec.deviceId) {
                pendingKeyChange = {
                  userId: rDec.userId,
                  deviceId: rDec.deviceId,
                  identityKey: rDec.identityKey || ''
                };
                showBanner(state.e2eeKeyChanged, true, state.e2eeAcceptNewKey);
              }
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

  function closeReactionPicker() {
    if (reactionPicker) {
      reactionPicker.classList.remove('visible');
      reactionPicker.setAttribute('aria-hidden', 'true');
    }
    if (reactActiveRow) {
      reactActiveRow.classList.remove('is-react-open');
      reactActiveRow = null;
    }
    reactTargetMsgId = 0;
  }

  function clearMsgLongPressTimer() {
    if (msgLongPressTimer) {
      clearTimeout(msgLongPressTimer);
      msgLongPressTimer = null;
    }
  }

  function openReactionPicker(row, anchorX, anchorY) {
    if (!reactionPicker || !row) return;
    var msgId = parseInt(row.getAttribute('data-msg-id') || '0', 10);
    if (!msgId) return;
    closeConvCtxMenu();
    closeReactionPicker();
    reactTargetMsgId = msgId;
    reactActiveRow = row;
    reactActiveRow.classList.add('is-react-open');

    var myPill = row.querySelector('.dm-reaction-pill.mine');
    var myEmoji = myPill ? (myPill.getAttribute('data-react-emoji') || '') : '';
    reactionPicker.querySelectorAll('.dm-reaction-pick-btn').forEach(function(b) {
      if (myEmoji && b.getAttribute('data-pick-emoji') === myEmoji) {
        b.classList.add('is-selected');
      } else {
        b.classList.remove('is-selected');
      }
    });
    if (msgCopyBtn) {
      var copyTxtEl = row.querySelector('.dm-msg-text:not(.dm-msg-decrypt-err)');
      var canCopyMsg = Boolean(copyTxtEl && copyTxtEl.textContent && copyTxtEl.textContent.trim());
      msgCopyBtn.style.display = canCopyMsg ? 'flex' : 'none';
    }
    if (msgEditBtn) {
      var canEditMsg = row.classList.contains('mine') && !row.querySelector('.dm-msg-decrypt-err');
      msgEditBtn.style.display = canEditMsg ? 'flex' : 'none';
    }
    if (msgActionList) {
      msgActionList.style.display = 'flex';
    }

    reactionPicker.style.left = '0px';
    reactionPicker.style.top = '0px';
    reactionPicker.classList.add('visible');
    reactionPicker.setAttribute('aria-hidden', 'false');

    var pickerRect = reactionPicker.getBoundingClientRect();
    var bubbleEl = row.querySelector('.dm-msg-bubble') || row;
    var bRect = bubbleEl.getBoundingClientRect ? bubbleEl.getBoundingClientRect() : { left: anchorX, top: anchorY, width: 0, height: 0 };
    var pad = 10;
    var vw = window.innerWidth || 360;
    var vh = window.innerHeight || 640;
    var pw = pickerRect.width || 310;
    var ph = pickerRect.height || 54;
    var cx = (typeof anchorX === 'number' && anchorX > 0) ? anchorX : (bRect.left + bRect.width / 2);
    var x = cx - pw / 2;
    var y = (bRect.top > ph + pad + 8) ? (bRect.top - ph - 8) : ((typeof anchorY === 'number' && anchorY > 0) ? (anchorY + 12) : (bRect.top + bRect.height + 8));
    if (x + pw + pad > vw) x = vw - pw - pad;
    if (x < pad) x = pad;
    if (y + ph + pad > vh) y = vh - ph - pad;
    if (y < pad) y = pad;

    reactionPicker.style.left = Math.round(x) + 'px';
    reactionPicker.style.top = Math.round(y) + 'px';
  }

  async function toggleMessageReaction(msgId, emoji) {
    if (!msgId || !emoji || reactingMsgIds[msgId]) return;
    reactingMsgIds[msgId] = true;
    try {
      var res = await fetch('/api/messages/react', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: msgId, emoji: emoji })
      });
      var data = await res.json();
      if (res.ok && data && data.success && listEl) {
        var row = listEl.querySelector('.dm-msg-row[data-msg-id="' + msgId + '"]');
        if (row) renderMessageReactions(row, data.reactions || []);
      } else if (window.showAppToast) {
        window.showAppToast((data && data.error) || state.networkError);
      }
    } catch (e) {
      if (window.showAppToast) window.showAppToast(state.networkError);
    } finally {
      delete reactingMsgIds[msgId];
    }
  }

  async function copyTextToClipboard(text) {
    if (!text) return false;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {}
    var ta = null;
    try {
      ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      ta.style.left = '-9999px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      if (typeof ta.setSelectionRange === 'function') {
        ta.setSelectionRange(0, text.length);
      }
      var ok = Boolean(document.execCommand && document.execCommand('copy'));
      return ok;
    } catch (e2) {
      return false;
    } finally {
      if (ta && ta.parentNode) ta.parentNode.removeChild(ta);
    }
  }

  if (msgCopyBtn) {
    msgCopyBtn.addEventListener('click', async function(e) {
      e.preventDefault();
      e.stopPropagation();
      var targetRow = reactActiveRow;
      closeReactionPicker();
      if (!targetRow) return;
      var txtEl = targetRow.querySelector('.dm-msg-text:not(.dm-msg-decrypt-err)');
      var txt = txtEl ? (txtEl.textContent || '') : '';
      if (!txt) return;
      var copied = await copyTextToClipboard(txt);
      if (copied && window.showAppToast) {
        window.showAppToast(state.copiedToast);
      }
    });
  }

  if (msgEditBtn) {
    msgEditBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      var targetId = reactTargetMsgId;
      var targetRow = reactActiveRow;
      closeReactionPicker();
      if (targetId && targetRow && targetRow.classList.contains('mine')) {
        startEditMode(targetId, targetRow);
      }
    });
  }

  if (msgDeleteBtn) {
    msgDeleteBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      var targetId = reactTargetMsgId;
      closeReactionPicker();
      if (targetId) {
        openDeleteMessageModal(targetId);
      }
    });
  }

  if (reactionPicker) {
    reactionPicker.addEventListener('click', function(e) {
      var btn = e.target && e.target.closest ? e.target.closest('[data-pick-emoji]') : null;
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      var emoji = btn.getAttribute('data-pick-emoji') || '';
      var targetId = reactTargetMsgId;
      closeReactionPicker();
      if (targetId && emoji) {
        toggleMessageReaction(targetId, emoji);
      }
    });

    function onGlobalReactPointerDown(e) {
      if (!reactionPicker.classList.contains('visible')) return;
      if (e.target && reactionPicker.contains(e.target)) return;
      closeReactionPicker();
    }

    function onGlobalReactKeydown(e) {
      if (e.key === 'Escape') {
        if (reactionPicker.classList.contains('visible')) {
          closeReactionPicker();
        } else if (editingMsg) {
          cancelEditMode();
        }
      }
    }

    document.addEventListener('pointerdown', onGlobalReactPointerDown, true);
    document.addEventListener('keydown', onGlobalReactKeydown);
    window.addEventListener('resize', closeReactionPicker);
    if (scrollEl) scrollEl.addEventListener('scroll', closeReactionPicker, { passive: true });
    extraCleanups.push(function() {
      clearMsgLongPressTimer();
      document.removeEventListener('pointerdown', onGlobalReactPointerDown, true);
      document.removeEventListener('keydown', onGlobalReactKeydown);
      window.removeEventListener('resize', closeReactionPicker);
      if (scrollEl) scrollEl.removeEventListener('scroll', closeReactionPicker);
    });
  }

  if (listEl) {
    listEl.addEventListener('contextmenu', function(e) {
      if (e.target && e.target.closest && e.target.closest('.dm-unsend-btn')) return;
      var row = e.target && e.target.closest ? e.target.closest('.dm-msg-row[data-msg-id]') : null;
      if (!row || !reactionPicker) return;
      e.preventDefault();
      e.stopPropagation();
      openReactionPicker(row, e.clientX, e.clientY);
    });

    listEl.addEventListener('touchstart', function(e) {
      if (!e.touches || e.touches.length !== 1) {
        clearMsgLongPressTimer();
        return;
      }
      if (e.target && e.target.closest && e.target.closest('.dm-unsend-btn, .dm-reaction-pill')) return;
      var bubble = e.target && e.target.closest ? e.target.closest('.dm-msg-bubble') : null;
      var row = bubble && bubble.closest ? bubble.closest('.dm-msg-row[data-msg-id]') : null;
      if (!row || !reactionPicker) return;
      clearMsgLongPressTimer();
      msgLongPressDidFire = false;
      var t0 = e.touches[0];
      msgLongPressStartX = t0.clientX;
      msgLongPressStartY = t0.clientY;
      msgLongPressTimer = setTimeout(function() {
        msgLongPressTimer = null;
        msgLongPressDidFire = true;
        suppressNextMsgClickUntil = Date.now() + 1000;
        if (navigator.vibrate) {
          try { navigator.vibrate(15); } catch (ve) {}
        }
        openReactionPicker(row, msgLongPressStartX, msgLongPressStartY);
      }, 450);
    }, { passive: true });

    listEl.addEventListener('touchmove', function(e) {
      if (!msgLongPressTimer || !e.touches || !e.touches.length) return;
      var t0 = e.touches[0];
      if (Math.abs(t0.clientX - msgLongPressStartX) > 10 || Math.abs(t0.clientY - msgLongPressStartY) > 10) {
        clearMsgLongPressTimer();
      }
    }, { passive: true });

    listEl.addEventListener('touchend', function() {
      clearMsgLongPressTimer();
      if (msgLongPressDidFire) {
        suppressNextMsgClickUntil = Date.now() + 500;
        msgLongPressDidFire = false;
      }
    }, { passive: true });

    listEl.addEventListener('touchcancel', function() {
      clearMsgLongPressTimer();
      msgLongPressDidFire = false;
    }, { passive: true });

    listEl.addEventListener('click', function(e) {
      if (Date.now() < suppressNextMsgClickUntil) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      var reactPill = e.target && e.target.closest ? e.target.closest('.dm-reaction-pill[data-react-msg-id]') : null;
      if (reactPill) {
        e.preventDefault();
        e.stopPropagation();
        var rMsgId = parseInt(reactPill.getAttribute('data-react-msg-id') || '0', 10);
        var rEmoji = reactPill.getAttribute('data-react-emoji') || '';
        if (rMsgId && rEmoji) toggleMessageReaction(rMsgId, rEmoji);
        return;
      }
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
      openDeleteMessageModal(msgId);
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
    function onLightboxKeydown(e) {
      if (e.key === 'Escape' && lightbox.classList.contains('visible')) {
        lightbox.classList.remove('visible');
      }
    }
    document.addEventListener('keydown', onLightboxKeydown);
    extraCleanups.push(function() {
      document.removeEventListener('keydown', onLightboxKeydown);
    });
  }

  function closeConvCtxMenu() {
    if (convCtxMenu) {
      convCtxMenu.classList.remove('visible');
      convCtxMenu.setAttribute('aria-hidden', 'true');
    }
    if (ctxActiveItem) {
      ctxActiveItem.classList.remove('is-ctx-open');
      ctxActiveItem = null;
    }
    ctxTarget = null;
  }

  function openConvCtxMenu(item, clientX, clientY) {
    if (!convCtxMenu || !item) return;
    var convId = parseInt(item.getAttribute('data-conv-id') || '0', 10);
    var partnerUsername = item.getAttribute('data-partner-username') || '';
    var lastMsgIdAttr = parseInt(item.getAttribute('data-last-msg-id') || '0', 10);
    if (!convId || !partnerUsername) return;

    closeConvCtxMenu();
    ctxTarget = { convId: convId, username: partnerUsername, lastMsgId: lastMsgIdAttr };
    ctxActiveItem = item;
    ctxActiveItem.classList.add('is-ctx-open');

    convCtxMenu.style.left = '0px';
    convCtxMenu.style.top = '0px';
    convCtxMenu.classList.add('visible');
    convCtxMenu.setAttribute('aria-hidden', 'false');

    var rect = convCtxMenu.getBoundingClientRect();
    var pad = 10;
    var vw = window.innerWidth || 360;
    var vh = window.innerHeight || 640;
    var menuW = rect.width || 196;
    var menuH = rect.height || 56;
    var x = Number(clientX || 0);
    var y = Number(clientY || 0);
    if (x + menuW + pad > vw) x = vw - menuW - pad;
    if (y + menuH + pad > vh) y = vh - menuH - pad;
    if (x < pad) x = pad;
    if (y < pad) y = pad;

    convCtxMenu.style.left = Math.round(x) + 'px';
    convCtxMenu.style.top = Math.round(y) + 'px';
  }

  function closeDeleteChatModal() {
    if (!deleteChatModal) return;
    deleteChatModal.classList.remove('visible');
    deleteChatModal.setAttribute('aria-hidden', 'true');
    deleteTarget = null;
    if (deleteForBothCheck) deleteForBothCheck.checked = false;
    if (deleteChatConfirmBtn) deleteChatConfirmBtn.disabled = false;
  }

  function openDeleteChatModal(target) {
    if (!deleteChatModal || !target) return;
    deleteTarget = {
      kind: 'chat',
      convId: target.convId,
      username: target.username,
      lastMsgId: target.lastMsgId || 0
    };
    if (deleteChatTitle) {
      deleteChatTitle.textContent = state.deleteChatConfirmTitle;
    }
    if (deleteChatDesc) {
      deleteChatDesc.textContent = state.deleteChatConfirmDesc.replace('{username}', target.username);
    }
    if (deleteForBothLabel) {
      deleteForBothLabel.textContent = state.deleteChatAlsoFor.replace('{username}', target.username);
    }
    if (deleteForBothCheck) deleteForBothCheck.checked = false;
    if (deleteChatConfirmBtn) deleteChatConfirmBtn.disabled = false;
    deleteChatModal.classList.add('visible');
    deleteChatModal.setAttribute('aria-hidden', 'false');
  }

  function openDeleteMessageModal(msgId) {
    if (!deleteChatModal || !msgId) return;
    var partnerUname = state.activePartnerUsername || '';
    deleteTarget = {
      kind: 'message',
      msgId: Number(msgId),
      username: partnerUname
    };
    if (deleteChatTitle) {
      deleteChatTitle.textContent = state.deleteMessageConfirmTitle;
    }
    if (deleteChatDesc) {
      deleteChatDesc.textContent = state.deleteMessageConfirmDesc;
    }
    if (deleteForBothLabel) {
      deleteForBothLabel.textContent = state.deleteChatAlsoFor.replace('{username}', partnerUname);
    }
    if (deleteForBothCheck) deleteForBothCheck.checked = false;
    if (deleteChatConfirmBtn) deleteChatConfirmBtn.disabled = false;
    deleteChatModal.classList.add('visible');
    deleteChatModal.setAttribute('aria-hidden', 'false');
  }

  function renderEmptyConvListIfNeeded() {
    if (!convListEl) return;
    if (convListEl.querySelector('.dm-conv-item')) return;
    if (document.getElementById('dmEmptyList')) return;
    var wrap = document.createElement('div');
    wrap.className = 'dm-empty-list';
    wrap.id = 'dmEmptyList';
    var icon = document.createElement('div');
    icon.className = 'dm-empty-icon';
    icon.innerHTML = state.chatBigIcon;
    var title = document.createElement('div');
    title.className = 'dm-empty-title';
    title.textContent = state.emptyListTitle;
    var desc = document.createElement('div');
    desc.className = 'dm-empty-desc';
    desc.textContent = state.emptyListDesc;
    wrap.appendChild(icon);
    wrap.appendChild(title);
    wrap.appendChild(desc);
    convListEl.appendChild(wrap);
  }

  function clearLongPressTimer() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  if (convListEl && convCtxMenu) {
    convListEl.addEventListener('contextmenu', function(e) {
      var item = e.target && e.target.closest ? e.target.closest('.dm-conv-item[data-conv-id]') : null;
      if (!item) return;
      e.preventDefault();
      e.stopPropagation();
      openConvCtxMenu(item, e.clientX, e.clientY);
    });

    convListEl.addEventListener('touchstart', function(e) {
      if (!e.touches || e.touches.length !== 1) {
        clearLongPressTimer();
        return;
      }
      var item = e.target && e.target.closest ? e.target.closest('.dm-conv-item[data-conv-id]') : null;
      if (!item) return;
      clearLongPressTimer();
      longPressDidFire = false;
      var touch = e.touches[0];
      longPressStartX = touch.clientX;
      longPressStartY = touch.clientY;
      longPressTimer = setTimeout(function() {
        longPressTimer = null;
        longPressDidFire = true;
        suppressNextConvClickUntil = Date.now() + 1000;
        if (navigator.vibrate) {
          try { navigator.vibrate(15); } catch (ve) {}
        }
        openConvCtxMenu(item, longPressStartX, longPressStartY);
      }, 450);
    }, { passive: true });

    convListEl.addEventListener('touchmove', function(e) {
      if (!longPressTimer || !e.touches || !e.touches.length) return;
      var t0 = e.touches[0];
      if (Math.abs(t0.clientX - longPressStartX) > 10 || Math.abs(t0.clientY - longPressStartY) > 10) {
        clearLongPressTimer();
      }
    }, { passive: true });

    convListEl.addEventListener('touchend', function() {
      clearLongPressTimer();
      if (longPressDidFire) {
        suppressNextConvClickUntil = Date.now() + 500;
        longPressDidFire = false;
      }
    }, { passive: true });
    convListEl.addEventListener('touchcancel', function() {
      clearLongPressTimer();
      longPressDidFire = false;
    }, { passive: true });

    convListEl.addEventListener('click', function(e) {
      if (Date.now() < suppressNextConvClickUntil) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (convCtxMenu.classList.contains('visible')) {
        e.preventDefault();
        e.stopPropagation();
        closeConvCtxMenu();
      }
    }, true);

    convListEl.addEventListener('scroll', closeConvCtxMenu, { passive: true });

    function onGlobalPointerDown(e) {
      if (!convCtxMenu.classList.contains('visible')) return;
      if (e.target && convCtxMenu.contains(e.target)) return;
      closeConvCtxMenu();
    }

    function onGlobalCtxKeydown(e) {
      if (e.key === 'Escape') {
        if (convCtxMenu.classList.contains('visible')) closeConvCtxMenu();
        if (deleteChatModal && deleteChatModal.classList.contains('visible') && !isDeletingChat) {
          closeDeleteChatModal();
        }
      }
    }

    document.addEventListener('pointerdown', onGlobalPointerDown, true);
    document.addEventListener('keydown', onGlobalCtxKeydown);
    window.addEventListener('resize', closeConvCtxMenu);
    extraCleanups.push(function() {
      clearLongPressTimer();
      document.removeEventListener('pointerdown', onGlobalPointerDown, true);
      document.removeEventListener('keydown', onGlobalCtxKeydown);
      window.removeEventListener('resize', closeConvCtxMenu);
    });
  }

  if (ctxDeleteBtn) {
    ctxDeleteBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      var chosen = ctxTarget;
      closeConvCtxMenu();
      if (chosen) openDeleteChatModal(chosen);
    });
  }

  if (deleteChatModal) {
    deleteChatModal.addEventListener('click', function(e) {
      if (e.target === deleteChatModal && !isDeletingChat) {
        closeDeleteChatModal();
      }
    });
  }

  if (deleteChatCancelBtn) {
    deleteChatCancelBtn.addEventListener('click', function() {
      if (!isDeletingChat) closeDeleteChatModal();
    });
  }

  if (deleteChatConfirmBtn) {
    deleteChatConfirmBtn.addEventListener('click', async function() {
      if (isDeletingChat || !deleteTarget) return;
      var target = deleteTarget;
      var forBoth = Boolean(deleteForBothCheck && deleteForBothCheck.checked);
      isDeletingChat = true;
      deleteChatConfirmBtn.disabled = true;
      try {
        if (target.kind === 'message') {
          var mRes = await fetch('/api/messages/delete', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message_id: target.msgId,
              for_both: forBoth
            })
          });
          var mData = await mRes.json();
          if (mRes.ok && mData && mData.success) {
            closeDeleteChatModal();
            if (editingMsg && Number(editingMsg.id) === Number(target.msgId)) {
              cancelEditMode();
            }
            if (listEl) {
              var mRow = listEl.querySelector('.dm-msg-row[data-msg-id="' + target.msgId + '"]');
              if (mRow) mRow.remove();
              syncAfterMsgRemoval();
            }
            try {
              var mc = e2eeClient || await ensureE2eeReady();
              if (mc && typeof mc.clearCachedMessages === 'function') {
                await mc.clearCachedMessages([target.msgId]);
              }
            } catch (mce) {}
            if (typeof mData.unread_total === 'number' && window.updateUnreadMessagesBadge) {
              window.updateUnreadMessagesBadge(mData.unread_total);
            }
          } else {
            deleteChatConfirmBtn.disabled = false;
            if (window.showAppToast) {
              window.showAppToast((mData && mData.error) || state.networkError);
            }
          }
          return;
        }

        var res = await fetch('/api/messages/conversation/delete', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversation_id: target.convId,
            for_both: forBoth
          })
        });
        var data = await res.json();
        if (res.ok && data && data.success) {
          closeDeleteChatModal();
          var idsToClear = Array.isArray(data.cleared_message_ids) ? data.cleared_message_ids.slice() : [];
          if (target.lastMsgId > 0 && idsToClear.indexOf(target.lastMsgId) === -1) {
            idsToClear.push(target.lastMsgId);
          }
          if (idsToClear.length > 0) {
            try {
              var c = e2eeClient || await ensureE2eeReady();
              if (c && typeof c.clearCachedMessages === 'function') {
                await c.clearCachedMessages(idsToClear);
              }
            } catch (ce) {}
          }
          if (convListEl) {
            var removedEl = convListEl.querySelector('.dm-conv-item[data-conv-id="' + target.convId + '"]');
            if (removedEl) removedEl.remove();
            renderEmptyConvListIfNeeded();
          }
          if (typeof data.unread_total === 'number' && window.updateUnreadMessagesBadge) {
            window.updateUnreadMessagesBadge(data.unread_total);
          }
          if (window.showAppToast) {
            window.showAppToast(state.deleteChatSuccess);
          }
          if (Number(state.activeConversationId) === Number(target.convId)) {
            if (window.__dmPollTimer) {
              clearInterval(window.__dmPollTimer);
              window.__dmPollTimer = null;
            }
            state.activeConversationId = 0;
            if (e2eeClient && typeof e2eeClient.revokeAllMediaUrls === 'function') {
              try { e2eeClient.revokeAllMediaUrls(); } catch (re) {}
            }
            if (window.spaNavigate) {
              window.spaNavigate('/messages');
            } else {
              window.location.href = '/messages';
            }
          }
        } else {
          deleteChatConfirmBtn.disabled = false;
          if (window.showAppToast) {
            window.showAppToast((data && data.error) || state.networkError);
          }
        }
      } catch (err) {
        deleteChatConfirmBtn.disabled = false;
        if (window.showAppToast) {
          window.showAppToast(state.networkError);
        }
      } finally {
        isDeletingChat = false;
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
      var pollUrl = '/api/messages/poll?conversation_id=' + state.activeConversationId + '&after_id=' + state.lastMsgId;
      if (state.oldestMsgId > 0) pollUrl += '&min_msg_id=' + state.oldestMsgId;
      var r = await fetch(pollUrl, { credentials: 'same-origin', cache: 'no-store' });
      if (r.status === 403 && state.activeConversationId > 0) {
        try {
          var cr = await fetch('/api/messages/conversations', { credentials: 'same-origin', cache: 'no-store' });
          if (cr.ok) {
            var cd = await cr.json();
            var stillExists = Array.isArray(cd.conversations) && cd.conversations.some(function(item) {
              return Number(item.id) === Number(state.activeConversationId);
            });
            if (!stillExists) {
              if (window.__dmPollTimer) {
                clearInterval(window.__dmPollTimer);
                window.__dmPollTimer = null;
              }
              if (convListEl) {
                var staleEl = convListEl.querySelector('.dm-conv-item[data-conv-id="' + state.activeConversationId + '"]');
                if (staleEl) staleEl.remove();
                renderEmptyConvListIfNeeded();
              }
              state.activeConversationId = 0;
              if (window.spaNavigate) window.spaNavigate('/messages');
              else window.location.href = '/messages';
            }
          }
        } catch (ce2) {}
        return;
      }
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
              if (rDec.ok && rDec.payload) {
                dec = rDec.payload;
              } else if (rDec && rDec.reason === 'KEY_CHANGED' && rDec.userId && rDec.deviceId) {
                pendingKeyChange = {
                  userId: rDec.userId,
                  deviceId: rDec.deviceId,
                  identityKey: rDec.identityKey || ''
                };
                showBanner(state.e2eeKeyChanged, true, state.e2eeAcceptNewKey);
              }
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
        if (Array.isArray(d.edited_messages) && d.edited_messages.length > 0 && listEl) {
          var cEdit = await ensureE2eeReady();
          for (var ei = 0; ei < d.edited_messages.length; ei++) {
            var em = d.edited_messages[ei];
            var eRow = listEl.querySelector('.dm-msg-row[data-msg-id="' + em.id + '"]');
            if (!eRow) continue;
            var curVer = parseInt(eRow.getAttribute('data-edit-version') || '0', 10);
            var srvVer = Number(em.edit_version || 0);
            if (srvVer <= curVer) continue;
            var decEdit = null;
            if (em.is_encrypted && cEdit) {
              var rDecEdit = await cEdit.decryptMessage(em);
              if (rDecEdit.ok && rDecEdit.payload) {
                decEdit = rDecEdit.payload;
              } else if (rDecEdit && rDecEdit.reason === 'KEY_CHANGED' && rDecEdit.userId && rDecEdit.deviceId) {
                pendingKeyChange = {
                  userId: rDecEdit.userId,
                  deviceId: rDecEdit.deviceId,
                  identityKey: rDecEdit.identityKey || ''
                };
                showBanner(state.e2eeKeyChanged, true, state.e2eeAcceptNewKey);
                continue;
              } else {
                continue;
              }
            }
            eRow.setAttribute('data-edit-version', String(srvVer));
            var eb = eRow.querySelector('.dm-msg-bubble');
            var et = eRow.querySelector('.dm-msg-time');
            if (eb && et) {
              renderMsgTimeEl(et, et.getAttribute('data-ts') || em.created_at || '', true);
              if (em.is_encrypted && decEdit) {
                hydrateBubbleContent(eb, et, decEdit, em.image_key || '', '');
              } else if (!em.is_encrypted) {
                applyPlainBubbleEdit(eb, et, em.body || '', Boolean(em.image_key));
              }
            }
            if (Number(em.id) === Number(state.lastMsgId)) {
              updateSidebarPreview(
                state.activeConversationId,
                em.sender_id,
                decEdit ? decEdit.text : (em.body || ''),
                decEdit ? Boolean(decEdit.media) : Boolean(em.image_key)
              );
            }
          }
        }
        if (Array.isArray(d.deleted_message_ids) && d.deleted_message_ids.length > 0 && listEl) {
          var removedIds = [];
          for (var di = 0; di < d.deleted_message_ids.length; di++) {
            var delId = Number(d.deleted_message_ids[di]);
            if (!delId) continue;
            var dRow = listEl.querySelector('.dm-msg-row[data-msg-id="' + delId + '"]');
            if (dRow) {
              if (editingMsg && Number(editingMsg.id) === delId) {
                cancelEditMode();
              }
              dRow.remove();
              removedIds.push(delId);
            }
          }
          if (removedIds.length > 0) {
            syncAfterMsgRemoval();
            if (e2eeClient && typeof e2eeClient.clearCachedMessages === 'function') {
              try { await e2eeClient.clearCachedMessages(removedIds); } catch (dce) {}
            }
          }
        }
        if (d.reactions_map && typeof d.reactions_map === 'object' && listEl) {
          listEl.querySelectorAll('.dm-msg-row[data-msg-id]').forEach(function(row) {
            var mid = row.getAttribute('data-msg-id');
            if (!mid || reactingMsgIds[mid]) return;
            renderMessageReactions(row, d.reactions_map[mid] || []);
          });
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

  var isPollingConvs = false;

  function buildConvItemEl(c) {
    var isCurrent = Number(state.activeConversationId) > 0 && Number(state.activeConversationId) === Number(c.id);
    var isUnread = Number(c.unread_count || 0) > 0 && !isCurrent;
    var isMine = Number(c.last_message_sender_id || 0) === Number(state.currentUserId);
    var prefix = isMine ? state.youPrefix : '';
    var a = document.createElement('a');
    a.setAttribute('href', '/messages/' + encodeURIComponent(c.other_username || ''));
    a.className = 'dm-conv-item' + (isCurrent ? ' active' : '') + (isUnread ? ' unread' : '');
    a.setAttribute('data-conv-id', String(c.id));
    a.setAttribute('data-partner-id', String(c.other_user_id || 0));
    a.setAttribute('data-partner-username', String(c.other_username || ''));
    a.setAttribute('data-last-msg-id', String(c.last_message_id || 0));
    a.setAttribute('data-last-encrypted', c.last_message_encrypted ? '1' : '0');
    a.setAttribute('data-last-mine', isMine ? '1' : '0');
    a.setAttribute('data-last-edit-version', String(c.last_message_edit_version || 0));

    var avatarDiv = document.createElement('div');
    avatarDiv.className = 'dm-avatar';
    var avKey = typeof c.other_avatar_key === 'string' ? c.other_avatar_key : '';
    if (avKey && avKey.indexOf('..') === -1 && avKey.indexOf('\\\\') === -1) {
      var img = document.createElement('img');
      img.src = '/media/' + encodeURIComponent(avKey);
      img.alt = String(c.other_username || '');
      avatarDiv.appendChild(img);
    } else {
      var initSpan = document.createElement('span');
      var baseName = String(c.other_display_name || c.other_username || '?');
      initSpan.textContent = baseName.charAt(0).toUpperCase();
      avatarDiv.appendChild(initSpan);
    }
    a.appendChild(avatarDiv);

    var metaDiv = document.createElement('div');
    metaDiv.className = 'dm-conv-meta';

    var topDiv = document.createElement('div');
    topDiv.className = 'dm-conv-top';
    var nameSpan = document.createElement('span');
    nameSpan.className = 'dm-conv-name';
    nameSpan.appendChild(document.createTextNode(String(c.other_username || '')));
    if (c.other_is_verified && typeof window.renderVerifiedBadge === 'function') {
      var vbWrap = document.createElement('span');
      vbWrap.innerHTML = window.renderVerifiedBadge(13);
      if (vbWrap.firstChild) nameSpan.appendChild(vbWrap.firstChild);
    }
    var timeSpan = document.createElement('span');
    timeSpan.className = 'dm-conv-time';
    timeSpan.textContent = formatDmShortTimeClient(c.last_message_at || '');
    topDiv.appendChild(nameSpan);
    topDiv.appendChild(timeSpan);
    metaDiv.appendChild(topDiv);

    var botDiv = document.createElement('div');
    botDiv.className = 'dm-conv-bottom';
    var prevSpan = document.createElement('span');
    prevSpan.className = 'dm-conv-preview';
    if (c.last_message_encrypted) {
      prevSpan.textContent = prefix + state.encryptedPreview;
    } else if (c.last_message_body) {
      prevSpan.textContent = prefix + cleanPreviewText(c.last_message_body);
    } else if (c.last_message_image) {
      prevSpan.textContent = prefix + state.photoLabel;
    } else {
      prevSpan.textContent = '';
    }
    botDiv.appendChild(prevSpan);

    if (isUnread) {
      var dot = document.createElement('span');
      dot.className = 'dm-conv-unread';
      dot.textContent = c.unread_count > 99 ? '99+' : String(c.unread_count);
      botDiv.appendChild(dot);
    }
    metaDiv.appendChild(botDiv);
    a.appendChild(metaDiv);
    return a;
  }

  async function syncConversationListDom(convs) {
    if (!convListEl || !Array.isArray(convs)) return;
    if (convs.length === 0) {
      convListEl.querySelectorAll('.dm-conv-item').forEach(function(el) { el.remove(); });
      renderEmptyConvListIfNeeded();
      return;
    }
    var emptyEl = document.getElementById('dmEmptyList');
    if (emptyEl) emptyEl.remove();

    var aliveIds = {};
    var needHydrate = false;
    for (var i = 0; i < convs.length; i++) {
      var c = convs[i];
      if (!c || !c.id) continue;
      var cidStr = String(c.id);
      aliveIds[cidStr] = true;
      var lastId = Number(c.last_message_id || 0);
      var editVer = Number(c.last_message_edit_version || 0);
      var isEnc = Boolean(c.last_message_encrypted);
      var isMine = Number(c.last_message_sender_id || 0) === Number(state.currentUserId);
      var prefix = isMine ? state.youPrefix : '';

      if (isEnc && lastId > 0 && c.last_message_ciphertext_envelope) {
        convEncryptedMeta[cidStr] = {
          id: lastId,
          sender_id: Number(c.last_message_sender_id || 0),
          sender_device_id: Number(c.last_message_sender_device_id || 0),
          is_encrypted: 1,
          ciphertext_envelope: c.last_message_ciphertext_envelope,
          edit_version: editVer
        };
      } else {
        delete convEncryptedMeta[cidStr];
      }

      var item = convListEl.querySelector('.dm-conv-item[data-conv-id="' + cidStr + '"]');
      if (!item) {
        item = buildConvItemEl(c);
        var refNode = convListEl.children[i] || null;
        convListEl.insertBefore(item, refNode);
        if (isEnc && lastId > 0) needHydrate = true;
      } else {
        var prevLastId = parseInt(item.getAttribute('data-last-msg-id') || '0', 10);
        var prevEditVer = parseInt(item.getAttribute('data-last-edit-version') || '0', 10);
        var prevEnc = item.getAttribute('data-last-encrypted') === '1';
        var changedMsg = (prevLastId !== lastId) || (prevEditVer !== editVer) || (prevEnc !== isEnc);

        item.setAttribute('data-last-msg-id', String(lastId));
        item.setAttribute('data-last-encrypted', isEnc ? '1' : '0');
        item.setAttribute('data-last-mine', isMine ? '1' : '0');
        item.setAttribute('data-last-edit-version', String(editVer));

        var isCurrent = Number(state.activeConversationId) > 0 && Number(state.activeConversationId) === Number(c.id);
        var isUnread = Number(c.unread_count || 0) > 0 && !isCurrent;
        if (isUnread) item.classList.add('unread');
        else item.classList.remove('unread');

        var timeEl = item.querySelector('.dm-conv-time');
        if (timeEl) timeEl.textContent = formatDmShortTimeClient(c.last_message_at || '');

        var botEl = item.querySelector('.dm-conv-bottom');
        var dotEl = item.querySelector('.dm-conv-unread');
        if (isUnread) {
          var badgeTxt = c.unread_count > 99 ? '99+' : String(c.unread_count);
          if (dotEl) {
            dotEl.textContent = badgeTxt;
          } else if (botEl) {
            dotEl = document.createElement('span');
            dotEl.className = 'dm-conv-unread';
            dotEl.textContent = badgeTxt;
            botEl.appendChild(dotEl);
          }
        } else if (dotEl) {
          dotEl.remove();
        }

        var prevEl = item.querySelector('.dm-conv-preview');
        if (prevEl) {
          if (!isEnc) {
            item.removeAttribute('data-preview-hydrated');
            if (c.last_message_body) prevEl.textContent = prefix + cleanPreviewText(c.last_message_body);
            else if (c.last_message_image) prevEl.textContent = prefix + state.photoLabel;
            else prevEl.textContent = '';
          } else if (changedMsg) {
            item.removeAttribute('data-preview-hydrated');
            needHydrate = true;
          } else if (item.getAttribute('data-preview-hydrated') !== (lastId + ':' + editVer)) {
            needHydrate = true;
          }
        }

        if (convListEl.children[i] !== item) {
          convListEl.insertBefore(item, convListEl.children[i] || null);
        }
      }
    }

    convListEl.querySelectorAll('.dm-conv-item[data-conv-id]').forEach(function(el) {
      var id = el.getAttribute('data-conv-id') || '';
      if (id && !aliveIds[id]) el.remove();
    });

    if (needHydrate) {
      await hydrateSidebarEncryptedPreviews();
    }
  }

  async function pollConversationList() {
    if (isPollingConvs || document.visibilityState === 'hidden' || isDeletingChat || !convListEl) return;
    isPollingConvs = true;
    try {
      var r = await fetch('/api/messages/conversations', { credentials: 'same-origin', cache: 'no-store' });
      if (r.status === 401) {
        if (window.__dmConvPollTimer) {
          clearInterval(window.__dmConvPollTimer);
          window.__dmConvPollTimer = null;
        }
        return;
      }
      if (!r.ok) return;
      var d = await r.json();
      if (d && d.success && Array.isArray(d.conversations)) {
        await syncConversationListDom(d.conversations);
        if (typeof d.unread_total === 'number' && window.updateUnreadMessagesBadge) {
          window.updateUnreadMessagesBadge(d.unread_total);
        }
      }
    } catch (e) {
    } finally {
      isPollingConvs = false;
    }
  }

  function onDmVisibilityChange() {
    if (document.visibilityState === 'visible') {
      if (state.activeConversationId > 0) pollActiveChat();
      pollConversationList();
    }
  }
  document.addEventListener('visibilitychange', onDmVisibilityChange);
  extraCleanups.push(function() {
    document.removeEventListener('visibilitychange', onDmVisibilityChange);
    if (window.__dmConvPollTimer) {
      clearInterval(window.__dmConvPollTimer);
      window.__dmConvPollTimer = null;
    }
  });

  if (state.activeConversationId > 0) {
    window.__dmPollTimer = setInterval(pollActiveChat, 2500);
  }
  if (convListEl) {
    window.__dmConvPollTimer = setInterval(pollConversationList, state.activeConversationId > 0 ? 5000 : 2500);
  }
})();
`;

  return layout(`${t.common.appName} — ${t.messages.title}`, body, script, t, theme);
}
