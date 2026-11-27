import { ConversationItem, DirectMessage, MessageReaction, User } from '../types';
import { ALLOWED_DM_REACTIONS } from '../messages';
import { layout, escapeHtml, safeJsonForScript, renderVerifiedBadge } from './layout';
import { renderBottomNav, CLOSE_ICON } from './nav';
import { SEND_COMMENT_ICON, REPLY_ARROW_ICON } from './commentsModal';
import { Translations, LangCode, ru, formatLocalizedShortDate, formatLocalizedTime, getClientDateFormat, formatCompactCount, getCompactCountUnits } from '../languages';

const BACK_ICON = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`;
const SEARCH_ICON = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
const PHOTO_ICON = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" ry="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
const CHAT_BIG_ICON = `<svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;
const TRASH_SM_ICON = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
const EDIT_SM_ICON = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const COPY_SM_ICON = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
const LOCK_XS_ICON = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
const CHECK_SINGLE_ICON = `<svg class="dm-check-svg dm-check-single" viewBox="0 0 16 12" width="13" height="10" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="2 6.5 6 10.2 14 1.8"/></svg>`;
const CHECK_DOUBLE_ICON = `<svg class="dm-check-svg dm-check-double" viewBox="0 0 20 12" width="16" height="10" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="1.5 6.5 5.2 10.2 12.2 1.8"/><polyline points="7.5 6.5 11.2 10.2 18.2 1.8"/></svg>`;
const MIC_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><line x1="12" y1="17" x2="12" y2="21"/><line x1="8.5" y1="21" x2="15.5" y2="21"/></svg>`;
const PLAY_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><polygon points="6.5 4 20 12 6.5 20 6.5 4"/></svg>`;
const PAUSE_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><rect x="5.5" y="4" width="4.5" height="16" rx="1.2"/><rect x="14" y="4" width="4.5" height="16" rx="1.2"/></svg>`;

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

function getDatePartsInTz(d: Date, timeZone: string): { year: number; month: number; day: number; key: string } {
  let year = d.getUTCFullYear();
  let month = d.getUTCMonth() + 1;
  let day = d.getUTCDate();
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      }).formatToParts(d);
      const yPart = parts.find((p) => p.type === 'year')?.value;
      const mPart = parts.find((p) => p.type === 'month')?.value;
      const dPart = parts.find((p) => p.type === 'day')?.value;
      if (yPart && mPart && dPart) {
        year = parseInt(yPart, 10);
        month = parseInt(mPart, 10);
        day = parseInt(dPart, 10);
      }
    } catch {}
  }
  const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { year, month, day, key };
}

function formatChatDateSep(dateStr: string, t: Translations, timeZone: string, nowDate: Date): { key: string; label: string } {
  try {
    const d = parseDateSafe(dateStr);
    if (isNaN(d.getTime())) return { key: '', label: '' };
    const p = getDatePartsInTz(d, timeZone);
    const todayP = getDatePartsInTz(nowDate, timeZone);
    if (p.key === todayP.key) return { key: p.key, label: t.messages.today };
    const yestDate = new Date(nowDate.getTime() - 86400000);
    const yestP = getDatePartsInTz(yestDate, timeZone);
    if (p.key === yestP.key) return { key: p.key, label: t.messages.yesterday };
    const cfg = getClientDateFormat(t.code);
    const mon = cfg.monthsLong[Math.max(0, Math.min(11, p.month - 1))] || '';
    if (p.year === todayP.year) {
      return { key: p.key, label: cfg.fullPattern === 'mdy' ? `${mon} ${p.day}` : `${p.day} ${mon}` };
    }
    return {
      key: p.key,
      label: cfg.fullPattern === 'mdy' ? `${mon} ${p.day}, ${p.year}` : `${p.day} ${mon} ${p.year}`,
    };
  } catch {
    return { key: '', label: '' };
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

          const isMineLast = c.last_message_sender_id === currentUser.id && Boolean(c.last_message_id);
          const lastRead = Boolean(c.last_message_read);
          const convCheckHtml = isMineLast
            ? `<span class="dm-conv-check ${lastRead ? 'is-read' : ''}" data-read="${lastRead ? '1' : '0'}">${lastRead ? CHECK_DOUBLE_ICON : CHECK_SINGLE_ICON}</span>`
            : '';

          return `
          <a href="/messages/${encodeURIComponent(c.other_username)}" class="dm-conv-item ${isCurrent ? 'active' : ''} ${c.unread_count > 0 && !isCurrent ? 'unread' : ''}" data-conv-id="${c.id}" data-partner-id="${c.other_user_id}" data-partner-username="${escapeHtml(c.other_username)}" data-partner-display="${escapeHtml(c.other_display_name || c.other_username)}" data-partner-avatar="${escapeHtml(c.other_avatar_key || '')}" data-partner-verified="${c.other_is_verified ? '1' : '0'}" data-last-msg-id="${c.last_message_id || 0}" data-last-encrypted="${c.last_message_encrypted ? '1' : '0'}" data-last-mine="${c.last_message_sender_id === currentUser.id ? '1' : '0'}" data-last-read="${lastRead ? '1' : '0'}" data-last-edit-version="${c.last_message_edit_version || 0}">
            <div class="dm-avatar">${avatarHtml}</div>
            <div class="dm-conv-meta">
              <div class="dm-conv-top">
                <span class="dm-conv-name">${escapeHtml(c.other_username)}${c.other_is_verified ? renderVerifiedBadge(13) : ''}</span>
                <span class="dm-conv-top-right">${convCheckHtml}<span class="dm-conv-time">${escapeHtml(formatDmShortTime(c.last_message_at, t, timeZone))}</span></span>
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
      listened_at: m.listened_at || null,
      edit_version: Number(m.edit_version || 0),
      created_at: m.created_at,
    }));

  let threadHtml = '';
  if (activePartner) {
    const pInit = (activePartner.display_name || activePartner.username || '?').charAt(0).toUpperCase();
    const pAvatar = activePartner.avatar_key
      ? `<img src="/media/${encodeURIComponent(activePartner.avatar_key)}" alt="${escapeHtml(activePartner.username)}">`
      : `<span>${escapeHtml(pInit)}</span>`;

    const nowDate = new Date();
    let prevDayKey = '';
    const msgsHtml = messages.length > 0
      ? messages
          .map((m) => {
            const isMine = Number(m.sender_id) === Number(currentUser.id);
            const isEnc = Boolean(m.is_encrypted);
            const isEdited = Boolean(m.edited_at);
            const editVer = Number(m.edit_version || 0);
            const isRead = isMine && ((lastReadOwnId > 0 && Number(m.id) <= lastReadOwnId) || Boolean(m.read_at));
            const statusHtml = isMine
              ? `<span class="dm-msg-status ${isRead ? 'is-read' : ''}" data-read="${isRead ? '1' : '0'}">${isRead ? CHECK_DOUBLE_ICON : CHECK_SINGLE_ICON}</span>`
              : '';
            const timeInner = `${isEdited ? `<span class="dm-msg-edited">${escapeHtml(t.messages.editedLabel)}</span> ` : ''}<span class="dm-msg-clock">${escapeHtml(formatMsgClock(m.created_at, timeZone))}</span>${statusHtml}`;
            const sepInfo = formatChatDateSep(m.created_at, t, timeZone, nowDate);
            let dateSepHtml = '';
            if (sepInfo.key && sepInfo.key !== prevDayKey) {
              prevDayKey = sepInfo.key;
              dateSepHtml = `<div class="dm-date-sep" data-day-key="${escapeHtml(sepInfo.key)}"><span>${escapeHtml(sepInfo.label)}</span></div>`;
            }
            if (isEnc) {
              return `${dateSepHtml}
            <div class="dm-msg-row ${isMine ? 'mine' : 'theirs'}" data-msg-id="${m.id}" data-encrypted="1" data-edit-version="${editVer}" data-image-key="${escapeHtml(m.image_key || '')}" data-listened="${m.listened_at ? '1' : '0'}">
              <div class="dm-msg-stack">
                <div class="dm-msg-bubble">
                  <div class="dm-msg-text dm-msg-decrypt-err" data-enc-slot="1">${escapeHtml(t.messages.e2eeInitializing)}</div>
                  <div class="dm-msg-time" data-ts="${escapeHtml(m.created_at)}" data-edited="${isEdited ? '1' : '0'}" data-mine="${isMine ? '1' : '0'}" data-read="${isRead ? '1' : '0'}">${timeInner}</div>
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
            return `${dateSepHtml}
            <div class="dm-msg-row ${isMine ? 'mine' : 'theirs'}" data-msg-id="${m.id}" data-edit-version="${editVer}" data-image-key="${escapeHtml(m.image_key || '')}">
              <div class="dm-msg-stack">
                <div class="dm-msg-bubble ${m.image_key && !m.body ? 'img-only' : ''}">
                  ${imgHtml}
                  ${textHtml}
                  <div class="dm-msg-time" data-ts="${escapeHtml(m.created_at)}" data-edited="${isEdited ? '1' : '0'}" data-mine="${isMine ? '1' : '0'}" data-read="${isRead ? '1' : '0'}">${timeInner}</div>
                </div>
                ${renderMsgReactionsHtml(m.id, m.reactions, t.code)}
              </div>
            </div>`;
          })
          .join('')
      : `<div class="dm-no-msgs" id="dmNoMsgs">${escapeHtml(t.messages.noMessagesYet)}</div>`;

    const seenVisible = lastReadOwnId > 0 && messages.length > 0 && Number(messages[messages.length - 1].sender_id) === Number(currentUser.id) && Number(messages[messages.length - 1].id) <= lastReadOwnId;

    threadHtml = `
    <div class="dm-thread-active-wrap" id="dmActiveThreadWrap">
    <header class="dm-thread-header">
      <a href="/messages" class="dm-back-btn" id="dmThreadBackBtn" aria-label="${escapeHtml(t.post.back)}">${BACK_ICON}</a>
      <a href="/u/${encodeURIComponent(activePartner.username)}" class="dm-thread-partner" id="dmThreadPartnerLink">
        <div class="dm-avatar dm-avatar-sm" id="dmThreadAvatar">${pAvatar}</div>
        <div class="dm-thread-partner-info">
          <div class="dm-thread-username" id="dmThreadUsername">${escapeHtml(activePartner.username)}${activePartner.is_verified ? renderVerifiedBadge(13.5) : ''}</div>
          <div class="dm-thread-display" id="dmThreadSubtitle" data-default-text="${escapeHtml(activePartner.display_name || activePartner.username)}">${escapeHtml(activePartner.display_name || activePartner.username)}</div>
        </div>
      </a>
    </header>

    <div class="dm-e2ee-banner" id="dmE2eeBanner">
      <span id="dmE2eeBannerText"></span>
      <button type="button" class="dm-e2ee-banner-btn" id="dmE2eeBannerBtn" style="display:none;"></button>
    </div>

    <div class="dm-messages-scroll" id="dmMessagesScroll">
      <div class="dm-e2ee-pill">${LOCK_XS_ICON}<span>${escapeHtml(t.messages.e2eeBadge)}</span></div>
      <button type="button" class="dm-load-older-btn" id="dmLoadOlderBtn"${hasMore ? '' : ' style="display:none;"'}>${escapeHtml(t.messages.loadOlder)}</button>
      <div class="dm-messages-list" id="dmMessagesList">
        ${msgsHtml}
      </div>
      <div class="dm-seen-indicator ${seenVisible ? 'visible' : ''}" id="dmSeenIndicator">${escapeHtml(t.messages.seen)}</div>
    </div>

    <div class="dm-edit-bar" id="dmReplyBar" style="display:none;">
      <div class="dm-edit-bar-icon">${REPLY_ARROW_ICON}</div>
      <div class="dm-edit-bar-meta">
        <div class="dm-edit-bar-title" id="dmReplyBarTitle"></div>
        <div class="dm-edit-bar-preview" id="dmReplyBarPreview"></div>
      </div>
      <button type="button" class="dm-edit-bar-close" id="dmReplyCancelBtn" aria-label="${escapeHtml(t.common.close)}">${CLOSE_ICON}</button>
    </div>

    <div class="dm-edit-bar" id="dmEditBar" style="display:none;">
      <button type="button" class="dm-edit-bar-icon dm-edit-replace-btn" id="dmEditReplaceBtn" disabled aria-label="${escapeHtml(t.messages.photoLabel)}">${EDIT_SM_ICON}</button>
      <div class="dm-edit-bar-meta">
        <div class="dm-edit-bar-title">${escapeHtml(t.messages.editingMessage)}</div>
        <div class="dm-edit-bar-preview-row">
          <img id="dmEditBarThumb" class="dm-edit-bar-thumb" src="" alt="" style="display:none;">
          <div class="dm-edit-bar-preview" id="dmEditBarPreview"></div>
        </div>
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
      <div class="dm-input pg-ce-input" id="dmMessageInput" contenteditable="plaintext-only" role="textbox" aria-multiline="true" inputmode="text" enterkeyhint="send" data-placeholder="${escapeHtml(t.messages.inputPlaceholder)}" data-maxlength="2000" aria-label="${escapeHtml(t.messages.inputPlaceholder)}"></div>
      <div class="dm-voice-rec-bar" id="dmVoiceRecBar" aria-live="polite">
        <button type="button" class="dm-voice-cancel-btn" id="dmVoiceCancelBtn" aria-label="${escapeHtml(t.common.cancel)}" title="${escapeHtml(t.common.cancel)}">${TRASH_SM_ICON}</button>
        <span class="dm-voice-rec-dot"></span>
        <span class="dm-voice-rec-timer" id="dmVoiceRecTimer">0:00</span>
        <div class="dm-voice-live-bars" id="dmVoiceLiveBars" aria-hidden="true"></div>
        <span class="dm-voice-rec-hint" id="dmVoiceRecHint">${escapeHtml(t.messages.voiceSlideCancel)}</span>
      </div>
      <button type="button" class="dm-send-btn" id="dmSendBtn" aria-label="${escapeHtml(t.messages.send)}" title="${escapeHtml(t.messages.send)}" style="display:none;" disabled>${SEND_COMMENT_ICON}</button>
      <button type="button" class="dm-voice-btn" id="dmVoiceBtn" aria-label="${escapeHtml(t.messages.voiceLabel)}" title="${escapeHtml(t.messages.voiceHoldHint)}">${MIC_ICON}</button>
    </div>
    </div>
    <div class="dm-thread-empty" id="dmThreadEmptyWrap" style="display:none;">
      <div class="dm-empty-icon">${CHAT_BIG_ICON}</div>
      <div class="dm-empty-title">${escapeHtml(t.messages.selectChatTitle)}</div>
      <div class="dm-empty-desc">${escapeHtml(t.messages.selectChatDesc)}</div>
    </div>`;
  } else {
    threadHtml = `
    <div class="dm-thread-active-wrap" id="dmActiveThreadWrap" style="display:none;">
    <header class="dm-thread-header">
      <a href="/messages" class="dm-back-btn" id="dmThreadBackBtn" aria-label="${escapeHtml(t.post.back)}">${BACK_ICON}</a>
      <a href="/messages" class="dm-thread-partner" id="dmThreadPartnerLink">
        <div class="dm-avatar dm-avatar-sm" id="dmThreadAvatar"></div>
        <div class="dm-thread-partner-info">
          <div class="dm-thread-username" id="dmThreadUsername"></div>
          <div class="dm-thread-display" id="dmThreadSubtitle" data-default-text=""></div>
        </div>
      </a>
    </header>

    <div class="dm-e2ee-banner" id="dmE2eeBanner">
      <span id="dmE2eeBannerText"></span>
      <button type="button" class="dm-e2ee-banner-btn" id="dmE2eeBannerBtn" style="display:none;"></button>
    </div>

    <div class="dm-messages-scroll" id="dmMessagesScroll">
      <div class="dm-e2ee-pill">${LOCK_XS_ICON}<span>${escapeHtml(t.messages.e2eeBadge)}</span></div>
      <button type="button" class="dm-load-older-btn" id="dmLoadOlderBtn" style="display:none;">${escapeHtml(t.messages.loadOlder)}</button>
      <div class="dm-messages-list" id="dmMessagesList"></div>
      <div class="dm-seen-indicator" id="dmSeenIndicator">${escapeHtml(t.messages.seen)}</div>
    </div>

    <div class="dm-edit-bar" id="dmReplyBar" style="display:none;">
      <div class="dm-edit-bar-icon">${REPLY_ARROW_ICON}</div>
      <div class="dm-edit-bar-meta">
        <div class="dm-edit-bar-title" id="dmReplyBarTitle"></div>
        <div class="dm-edit-bar-preview" id="dmReplyBarPreview"></div>
      </div>
      <button type="button" class="dm-edit-bar-close" id="dmReplyCancelBtn" aria-label="${escapeHtml(t.common.close)}">${CLOSE_ICON}</button>
    </div>

    <div class="dm-edit-bar" id="dmEditBar" style="display:none;">
      <button type="button" class="dm-edit-bar-icon dm-edit-replace-btn" id="dmEditReplaceBtn" disabled aria-label="${escapeHtml(t.messages.photoLabel)}">${EDIT_SM_ICON}</button>
      <div class="dm-edit-bar-meta">
        <div class="dm-edit-bar-title">${escapeHtml(t.messages.editingMessage)}</div>
        <div class="dm-edit-bar-preview-row">
          <img id="dmEditBarThumb" class="dm-edit-bar-thumb" src="" alt="" style="display:none;">
          <div class="dm-edit-bar-preview" id="dmEditBarPreview"></div>
        </div>
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
      <div class="dm-input pg-ce-input" id="dmMessageInput" contenteditable="plaintext-only" role="textbox" aria-multiline="true" inputmode="text" enterkeyhint="send" data-placeholder="${escapeHtml(t.messages.inputPlaceholder)}" data-maxlength="2000" aria-label="${escapeHtml(t.messages.inputPlaceholder)}"></div>
      <div class="dm-voice-rec-bar" id="dmVoiceRecBar" aria-live="polite">
        <button type="button" class="dm-voice-cancel-btn" id="dmVoiceCancelBtn" aria-label="${escapeHtml(t.common.cancel)}" title="${escapeHtml(t.common.cancel)}">${TRASH_SM_ICON}</button>
        <span class="dm-voice-rec-dot"></span>
        <span class="dm-voice-rec-timer" id="dmVoiceRecTimer">0:00</span>
        <div class="dm-voice-live-bars" id="dmVoiceLiveBars" aria-hidden="true"></div>
        <span class="dm-voice-rec-hint" id="dmVoiceRecHint">${escapeHtml(t.messages.voiceSlideCancel)}</span>
      </div>
      <button type="button" class="dm-send-btn" id="dmSendBtn" aria-label="${escapeHtml(t.messages.send)}" title="${escapeHtml(t.messages.send)}" style="display:none;" disabled>${SEND_COMMENT_ICON}</button>
      <button type="button" class="dm-voice-btn" id="dmVoiceBtn" aria-label="${escapeHtml(t.messages.voiceLabel)}" title="${escapeHtml(t.messages.voiceHoldHint)}">${MIC_ICON}</button>
    </div>
    </div>
    <div class="dm-thread-empty" id="dmThreadEmptyWrap">
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

  <div class="modal-backdrop dm-video-backdrop" id="dmVideoPlayerModal" aria-hidden="true">
    <div class="dm-video-dialog" role="dialog" aria-modal="true" aria-labelledby="dmVideoTitle">
      <div class="dm-video-header">
        <div class="dm-video-title-wrap">
          <span class="dm-video-title" id="dmVideoTitle">YouTube</span>
          <span class="dm-video-time-pill" id="dmVideoTimePill" style="display:none;"></span>
        </div>
        <div class="dm-video-actions">
          <a class="dm-video-ext-btn" id="dmVideoExtLink" href="https://www.youtube.com" target="_blank" rel="noopener noreferrer">${escapeHtml(t.messages.openOnYoutube)}</a>
          <button type="button" class="dm-video-close-btn" id="dmVideoCloseBtn" aria-label="${escapeHtml(t.common.close)}">${CLOSE_ICON}</button>
        </div>
      </div>
      <div class="dm-video-frame-wrap">
        <iframe id="dmVideoIframe" class="dm-video-iframe" src="about:blank" title="YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
      </div>
    </div>
  </div>

  <div class="modal-backdrop" id="dmMicBlockedModal">
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">${escapeHtml(t.messages.micBlockedTitle)}</h3>
        <button class="modal-close" id="closeDmMicBlockedBtn" type="button" aria-label="${escapeHtml(t.common.close)}">${CLOSE_ICON}</button>
      </div>
      <p style="font-size: 14px; color: var(--text-secondary);">${escapeHtml(t.messages.micBlockedDesc)}</p>
      <p id="dmMicBlockedSteps" style="font-size: 14px; color: var(--text-primary); white-space: pre-line; line-height: 1.6; margin-top: 8px;"></p>
      <div style="display: flex; gap: 8px; margin-top: 12px;">
        <button type="button" class="btn btn-primary btn-sm" id="okDmMicBlockedBtn" style="flex:1;">${escapeHtml(t.common.understood)}</button>
      </div>
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
      <button type="button" class="dm-msg-action-btn" id="dmMsgReplyBtn" role="menuitem">
        ${REPLY_ARROW_ICON}
        <span>${escapeHtml(t.messages.replyMessage)}</span>
      </button>
      <button type="button" class="dm-msg-action-btn" id="dmMsgCopyBtn" role="menuitem" style="display:none;">
        ${COPY_SM_ICON}
        <span>${escapeHtml(t.messages.copyMessage)}</span>
      </button>
      <button type="button" class="dm-msg-action-btn" id="dmMsgDownloadBtn" role="menuitem" style="display:none;">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span>${escapeHtml(t.post.downloadPhoto)}</span>
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
    currentUsername: currentUser.username,
    replyingToLabel: t.messages.replyingToLabel,
    replyArrowIcon: REPLY_ARROW_ICON,
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
    voiceLabel: t.messages.voiceLabel,
    sharedPostPreview: t.share.sharedPostPreview,
    sharedPostLabel: t.share.sharedPostLabel,
    playVideoLabel: t.messages.playVideo,
    openOnYoutubeLabel: t.messages.openOnYoutube,
    verifiedBadgeSm: renderVerifiedBadge(12),
    voiceHoldHint: t.messages.voiceHoldHint,
    voiceSlideCancel: t.messages.voiceSlideCancel,
    voiceReleaseCancel: t.messages.voiceReleaseCancel,
    voiceMicDenied: t.messages.voiceMicDenied,
    micBlockedSteps: {
      chrome: t.messages.micBlockedStepsChrome,
      desktopPwa: t.messages.micBlockedStepsDesktopPwa,
      android: t.messages.micBlockedStepsAndroid,
      firefox: t.messages.micBlockedStepsFirefox,
      safari: t.messages.micBlockedStepsSafari,
      ios: t.messages.micBlockedStepsIos,
    },
    voiceUnsupported: t.messages.voiceUnsupported,
    voiceTooShort: t.messages.voiceTooShort,
    voiceTooLarge: t.messages.voiceTooLarge,
    playIcon: PLAY_ICON,
    pauseIcon: PAUSE_ICON,
    youPrefix: t.messages.youPrefix,
    seen: t.messages.seen,
    todayLabel: t.messages.today,
    yesterdayLabel: t.messages.yesterday,
    typingLabel: t.messages.typing,
    checkSingleIcon: CHECK_SINGLE_ICON,
    checkDoubleIcon: CHECK_DOUBLE_ICON,
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
    micIcon: MIC_ICON,
    sendIcon: SEND_COMMENT_ICON,
    sendLabel: t.messages.send,
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
  var threadSubtitleEl = document.getElementById('dmThreadSubtitle');
  var seenEl = document.getElementById('dmSeenIndicator');
  var formEl = document.getElementById('dmComposeForm');
  var inputEl = document.getElementById('dmMessageInput');
  var sendBtn = document.getElementById('dmSendBtn');
  var voiceBtn = document.getElementById('dmVoiceBtn');
  var voiceRecBar = document.getElementById('dmVoiceRecBar');
  var voiceCancelBtn = document.getElementById('dmVoiceCancelBtn');
  var voiceRecTimer = document.getElementById('dmVoiceRecTimer');
  var voiceLiveBars = document.getElementById('dmVoiceLiveBars');
  var voiceRecHint = document.getElementById('dmVoiceRecHint');
  var micBlockedModal = document.getElementById('dmMicBlockedModal');
  var micBlockedStepsEl = document.getElementById('dmMicBlockedSteps');
  var closeMicBlockedBtn = document.getElementById('closeDmMicBlockedBtn');
  var okMicBlockedBtn = document.getElementById('okDmMicBlockedBtn');
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
  var msgReplyBtn = document.getElementById('dmMsgReplyBtn');
  var msgCopyBtn = document.getElementById('dmMsgCopyBtn');
  var msgDownloadBtn = document.getElementById('dmMsgDownloadBtn');
  var msgEditBtn = document.getElementById('dmMsgEditBtn');
  var msgDeleteBtn = document.getElementById('dmMsgDeleteBtn');
  var replyBar = document.getElementById('dmReplyBar');
  var replyBarTitle = document.getElementById('dmReplyBarTitle');
  var replyBarPreview = document.getElementById('dmReplyBarPreview');
  var replyCancelBtn = document.getElementById('dmReplyCancelBtn');
  var editBar = document.getElementById('dmEditBar');
  var editReplaceBtn = document.getElementById('dmEditReplaceBtn');
  var editBarThumb = document.getElementById('dmEditBarThumb');
  var editBarPreview = document.getElementById('dmEditBarPreview');
  var editCancelBtn = document.getElementById('dmEditCancelBtn');

  var pendingFile = null;
  var pendingPreviewUrl = '';
  var editingMsg = null;
  var replyingMsg = null;
  var jumpHighlightTimer = null;
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

  function getLocalDayInfoClient(ts) {
    var d = parseDateClient(ts);
    if (!d || isNaN(d.getTime())) return { key: '', label: '' };
    var y = d.getFullYear();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    var key = y + '-' + String(m).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    var now = new Date();
    var todayKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    if (key === todayKey) return { key: key, label: state.todayLabel || 'Today' };
    var yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    var yestKey = yest.getFullYear() + '-' + String(yest.getMonth() + 1).padStart(2, '0') + '-' + String(yest.getDate()).padStart(2, '0');
    if (key === yestKey) return { key: key, label: state.yesterdayLabel || 'Yesterday' };
    var cfg = state.dateFmt || {};
    var mon = (cfg.monthsLong && cfg.monthsLong[m - 1]) || '';
    if (y === now.getFullYear()) {
      return { key: key, label: cfg.fullPattern === 'mdy' ? (mon + ' ' + day) : (day + ' ' + mon) };
    }
    return { key: key, label: cfg.fullPattern === 'mdy' ? (mon + ' ' + day + ', ' + y) : (day + ' ' + mon + ' ' + y) };
  }

  function syncDateSeparators() {
    if (!listEl) return;
    listEl.querySelectorAll('.dm-date-sep').forEach(function(sep) {
      sep.remove();
    });
    var rows = listEl.querySelectorAll('.dm-msg-row[data-msg-id]');
    var lastKey = '';
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var timeEl = row.querySelector('.dm-msg-time[data-ts]');
      var ts = timeEl ? timeEl.getAttribute('data-ts') : '';
      if (!ts) continue;
      var info = getLocalDayInfoClient(ts);
      if (!info.key || info.key === lastKey) continue;
      lastKey = info.key;
      var sepEl = document.createElement('div');
      sepEl.className = 'dm-date-sep';
      sepEl.setAttribute('data-day-key', info.key);
      var span = document.createElement('span');
      span.textContent = info.label;
      sepEl.appendChild(span);
      listEl.insertBefore(sepEl, row);
    }
  }

  function setStatusCheckIcon(el, isRead) {
    if (!el) return;
    var nextFlag = isRead ? '1' : '0';
    if (el.getAttribute('data-read') === nextFlag && el.firstChild) return;
    el.setAttribute('data-read', nextFlag);
    if (isRead) el.classList.add('is-read');
    else el.classList.remove('is-read');
    el.innerHTML = isRead ? state.checkDoubleIcon : state.checkSingleIcon;
  }

  function setConvItemCheck(item, isMine, isRead) {
    if (!item) return;
    item.setAttribute('data-last-read', isRead ? '1' : '0');
    var topRight = item.querySelector('.dm-conv-top-right');
    var checkEl = item.querySelector('.dm-conv-check');
    var lastId = parseInt(item.getAttribute('data-last-msg-id') || '0', 10);
    if (isMine && lastId > 0) {
      if (!checkEl && topRight) {
        checkEl = document.createElement('span');
        checkEl.className = 'dm-conv-check';
        topRight.insertBefore(checkEl, topRight.firstChild);
      }
      if (checkEl) setStatusCheckIcon(checkEl, isRead);
    } else if (checkEl) {
      checkEl.remove();
    }
  }

  function renderMsgTimeEl(timeEl, ts, isEdited, isMineOpt, isReadOpt) {
    if (!timeEl) return;
    var isMine = typeof isMineOpt === 'boolean' ? isMineOpt : (timeEl.getAttribute('data-mine') === '1');
    var isRead = typeof isReadOpt === 'boolean' ? isReadOpt : (timeEl.getAttribute('data-read') === '1');
    var clockText = formatClockClient(ts);
    timeEl.setAttribute('data-ts', ts || '');
    timeEl.setAttribute('data-edited', isEdited ? '1' : '0');
    timeEl.setAttribute('data-mine', isMine ? '1' : '0');
    timeEl.setAttribute('data-read', isRead ? '1' : '0');
    while (timeEl.firstChild) timeEl.removeChild(timeEl.firstChild);
    if (isEdited) {
      var edSpan = document.createElement('span');
      edSpan.className = 'dm-msg-edited';
      edSpan.textContent = state.editedLabel;
      timeEl.appendChild(edSpan);
    }
    var clkSpan = document.createElement('span');
    clkSpan.className = 'dm-msg-clock';
    clkSpan.textContent = clockText;
    timeEl.appendChild(clkSpan);
    if (isMine) {
      var stSpan = document.createElement('span');
      stSpan.className = 'dm-msg-status' + (isRead ? ' is-read' : '');
      setStatusCheckIcon(stSpan, isRead);
      timeEl.appendChild(stSpan);
    }
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
    syncDateSeparators();
  }

  function scrollToBottom() {
    if (scrollEl) {
      isPinnedToBottom = true;
      pinScrollBottomNow();
    }
  }

  function syncSendState() {
    var hasText = Boolean(inputEl && inputEl.value.trim().length > 0);
    var showSendMode = Boolean(hasText || pendingFile || editingMsg);
    var canSubmit = editingMsg
      ? Boolean((hasText || editingMsg.existingMedia || editingMsg.imageKey || editingMsg.replacementFile) && !isSending)
      : Boolean((hasText || pendingFile) && !isSending);
    if (sendBtn) {
      sendBtn.style.display = showSendMode ? 'inline-flex' : 'none';
      sendBtn.disabled = !canSubmit;
      if (canSubmit) sendBtn.classList.add('active');
      else sendBtn.classList.remove('active');
    }
    if (voiceBtn) {
      voiceBtn.style.display = showSendMode ? 'none' : 'inline-flex';
      voiceBtn.disabled = Boolean(isSending);
    }
  }

  var mentionLookupCache = {};
  if (state.currentUsername) mentionLookupCache[String(state.currentUsername).toLowerCase()] = true;
  if (state.activePartnerUsername) mentionLookupCache[String(state.activePartnerUsername).toLowerCase()] = true;
  var pendingMentionNames = {};
  var mentionWaiters = {};
  var mentionFlushTimer = null;

  var linkPreviewCache = {};
  var linkPreviewInflight = {};
  var YT_ID_CLIENT_RE = /^[A-Za-z0-9_-]{11}$/;
  var URL_TOKEN_RE = /https?:\\/\\/[^\\s<>"'\`]+/gi;

  function sanitizeClientHttpUrl(raw) {
    if (!raw || typeof raw !== 'string') return '';
    var s = raw.trim().replace(/[.,!?;:)\\]]+$/, '');
    if (!s || s.length > 2048) return '';
    try {
      var u = new URL(s);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
      if (u.username || u.password) return '';
      if (!u.hostname || u.hostname.indexOf('.') === -1) return '';
      return u.toString();
    } catch (e) {
      return '';
    }
  }

  function extractFirstUrl(text) {
    if (!text || typeof text !== 'string') return '';
    URL_TOKEN_RE.lastIndex = 0;
    var m = URL_TOKEN_RE.exec(text);
    return m ? sanitizeClientHttpUrl(m[0]) : '';
  }

  function parseClientYtStart(raw) {
    if (!raw) return 0;
    var s = String(raw).trim().toLowerCase();
    if (!s) return 0;
    if (/^\\d{1,6}s?$/.test(s)) {
      var n = parseInt(s, 10);
      return isFinite(n) && n > 0 && n <= 86400 ? n : 0;
    }
    var m = /^(?:(\\d{1,2})h)?(?:(\\d{1,3})m)?(?:(\\d{1,3})s?)?$/.exec(s);
    if (!m) return 0;
    var tot = (m[1] ? parseInt(m[1], 10) * 3600 : 0) + (m[2] ? parseInt(m[2], 10) * 60 : 0) + (m[3] ? parseInt(m[3], 10) : 0);
    return tot > 0 && tot <= 86400 ? tot : 0;
  }

  function extractYoutubeInfoClient(rawUrl) {
    var clean = sanitizeClientHttpUrl(rawUrl);
    if (!clean) return null;
    try {
      var u = new URL(clean);
      var host = u.hostname.toLowerCase().replace(/\\.$/, '');
      var id = '';
      var parts = u.pathname.split('/').filter(Boolean);
      if (host === 'youtu.be' || host === 'www.youtu.be') {
        id = parts[0] || '';
      } else if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com' || host === 'www.youtube-nocookie.com') {
        if (parts[0] === 'watch') id = u.searchParams.get('v') || '';
        else if (parts[0] === 'shorts' || parts[0] === 'live' || parts[0] === 'embed') id = parts[1] || '';
      }
      if (!YT_ID_CLIENT_RE.test(id)) return null;
      var startSec = parseClientYtStart(u.searchParams.get('t')) || parseClientYtStart(u.searchParams.get('start'));
      return { videoId: id, startSec: startSec };
    } catch (e) {
      return null;
    }
  }

  function formatTimecodeSeconds(sec) {
    var s = Math.max(0, Math.floor(Number(sec) || 0));
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var rem = s % 60;
    var pad = function(v) { return v < 10 ? ('0' + v) : String(v); };
    return h > 0 ? (h + ':' + pad(m) + ':' + pad(rem)) : (m + ':' + pad(rem));
  }

  async function fetchLinkPreviewClient(rawUrl) {
    var clean = sanitizeClientHttpUrl(rawUrl);
    if (!clean) return null;
    if (Object.prototype.hasOwnProperty.call(linkPreviewCache, clean)) {
      return linkPreviewCache[clean];
    }
    if (linkPreviewInflight[clean]) {
      return linkPreviewInflight[clean];
    }
    var p = fetch('/api/messages/link-preview?url=' + encodeURIComponent(clean), {
      credentials: 'same-origin'
    }).then(function(res) {
      if (!res.ok) return null;
      return res.json();
    }).then(function(data) {
      var prev = (data && data.ok && data.preview) ? data.preview : null;
      linkPreviewCache[clean] = prev;
      return prev;
    }).catch(function() {
      return null;
    }).finally(function() {
      delete linkPreviewInflight[clean];
    });
    linkPreviewInflight[clean] = p;
    return p;
  }

  function appendMentionsAndTimecodes(txtEl, segment, videoId, needsResolve) {
    if (!segment) return;
    if (videoId && YT_ID_CLIENT_RE.test(videoId)) {
      var tcRe = /(^|[^0-9:])(?:(\\d{1,2}):)?([0-5]?\\d):([0-5]\\d)(?![0-9:])/g;
      var tcLast = 0;
      var tm;
      while ((tm = tcRe.exec(segment)) !== null) {
        var tcPre = tm[1] || '';
        var tcStart = tm.index + tcPre.length;
        if (tcStart > tcLast) {
          appendMentionOnlySegment(txtEl, segment.slice(tcLast, tcStart), needsResolve);
        }
        var hrs = tm[2] ? parseInt(tm[2], 10) : 0;
        var mins = parseInt(tm[3], 10);
        var secs = parseInt(tm[4], 10);
        var totalSec = hrs * 3600 + mins * 60 + secs;
        var label = (tm[2] ? (tm[2] + ':') : '') + tm[3] + ':' + tm[4];
        if (totalSec <= 86400) {
          var tcBtn = document.createElement('button');
          tcBtn.type = 'button';
          tcBtn.className = 'dm-timecode-btn';
          tcBtn.setAttribute('data-yt-id', videoId);
          tcBtn.setAttribute('data-yt-start', String(totalSec));
          tcBtn.textContent = label;
          txtEl.appendChild(tcBtn);
        } else {
          txtEl.appendChild(document.createTextNode(label));
        }
        tcLast = tcStart + label.length;
      }
      if (tcLast < segment.length) {
        appendMentionOnlySegment(txtEl, segment.slice(tcLast), needsResolve);
      }
      return;
    }
    appendMentionOnlySegment(txtEl, segment, needsResolve);
  }

  function appendMentionOnlySegment(txtEl, segment, needsResolve) {
    if (!segment) return;
    var re = /(^|[^a-zA-Z0-9_])@([a-zA-Z0-9_]{3,24})(?![a-zA-Z0-9_])/g;
    var lastIdx = 0;
    var match;
    while ((match = re.exec(segment)) !== null) {
      var prefix = match[1] || '';
      var uname = match[2];
      var lower = uname.toLowerCase();
      var atIdx = match.index + prefix.length;
      if (atIdx > lastIdx) {
        txtEl.appendChild(document.createTextNode(segment.slice(lastIdx, atIdx)));
      }
      if (mentionLookupCache[lower] === true) {
        var link = document.createElement('a');
        link.className = 'dm-mention-link';
        link.setAttribute('href', '/u/' + encodeURIComponent(lower));
        link.textContent = '@' + uname;
        txtEl.appendChild(link);
      } else {
        txtEl.appendChild(document.createTextNode('@' + uname));
        if (mentionLookupCache[lower] === undefined) {
          needsResolve.push(lower);
        }
      }
      lastIdx = atIdx + 1 + uname.length;
    }
    if (lastIdx < segment.length) {
      txtEl.appendChild(document.createTextNode(segment.slice(lastIdx)));
    }
  }

  function renderMentionNodes(txtEl, rawText, videoCtx) {
    if (!txtEl) return;
    var text = String(rawText || '');
    txtEl.setAttribute('data-raw-text', text);
    var videoId = (videoCtx && videoCtx.videoId && YT_ID_CLIENT_RE.test(videoCtx.videoId))
      ? videoCtx.videoId
      : (txtEl.getAttribute('data-yt-context') || '');
    if (videoId && YT_ID_CLIENT_RE.test(videoId)) {
      txtEl.setAttribute('data-yt-context', videoId);
    } else {
      videoId = '';
    }
    while (txtEl.firstChild) txtEl.removeChild(txtEl.firstChild);
    if (!text) return;

    var needsResolve = [];
    URL_TOKEN_RE.lastIndex = 0;
    var lastIdx = 0;
    var um;
    while ((um = URL_TOKEN_RE.exec(text)) !== null) {
      var rawToken = um[0];
      var cleanHref = sanitizeClientHttpUrl(rawToken);
      var displayToken = rawToken.replace(/[.,!?;:)\\]]+$/, '');
      var trailing = rawToken.slice(displayToken.length);
      if (um.index > lastIdx) {
        appendMentionsAndTimecodes(txtEl, text.slice(lastIdx, um.index), videoId, needsResolve);
      }
      if (cleanHref) {
        var a = document.createElement('a');
        a.className = 'dm-msg-link';
        a.setAttribute('href', cleanHref);
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
        a.textContent = displayToken;
        txtEl.appendChild(a);
        if (trailing) {
          appendMentionsAndTimecodes(txtEl, trailing, videoId, needsResolve);
        }
      } else {
        appendMentionsAndTimecodes(txtEl, rawToken, videoId, needsResolve);
      }
      lastIdx = um.index + rawToken.length;
    }
    if (lastIdx < text.length) {
      appendMentionsAndTimecodes(txtEl, text.slice(lastIdx), videoId, needsResolve);
    }
    if (needsResolve.length > 0) {
      for (var i = 0; i < needsResolve.length; i++) {
        var nameKey = needsResolve[i];
        pendingMentionNames[nameKey] = true;
        if (!mentionWaiters[nameKey]) mentionWaiters[nameKey] = [];
        if (mentionWaiters[nameKey].indexOf(txtEl) === -1) {
          mentionWaiters[nameKey].push(txtEl);
        }
      }
      scheduleMentionResolve();
    }
  }

  function scheduleMentionResolve() {
    if (mentionFlushTimer) return;
    mentionFlushTimer = setTimeout(flushMentionResolve, 40);
  }

  async function flushMentionResolve() {
    mentionFlushTimer = null;
    var names = Object.keys(pendingMentionNames);
    if (names.length === 0) return;
    var batch = names.slice(0, 25);
    for (var i = 0; i < batch.length; i++) {
      delete pendingMentionNames[batch[i]];
    }
    if (Object.keys(pendingMentionNames).length > 0) {
      scheduleMentionResolve();
    }
    try {
      var res = await fetch('/api/users/resolve-mentions', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: batch })
      });
      if (!res.ok) return;
      var data = await res.json();
      var foundMap = {};
      var existingList = (data && Array.isArray(data.existing)) ? data.existing : [];
      for (var j = 0; j < existingList.length; j++) {
        foundMap[String(existingList[j]).toLowerCase()] = true;
      }
      var toRerender = [];
      for (var k = 0; k < batch.length; k++) {
        var uKey = batch[k];
        var exists = Boolean(foundMap[uKey]);
        mentionLookupCache[uKey] = exists;
        var waiters = mentionWaiters[uKey];
        delete mentionWaiters[uKey];
        if (exists && Array.isArray(waiters)) {
          for (var w = 0; w < waiters.length; w++) {
            if (toRerender.indexOf(waiters[w]) === -1) toRerender.push(waiters[w]);
          }
        }
      }
      for (var r = 0; r < toRerender.length; r++) {
        var el = toRerender[r];
        if (el && el.isConnected) {
          renderMentionNodes(el, el.getAttribute('data-raw-text') || el.textContent || '');
        }
      }
    } catch (e) {}
  }

  function hydratePlainTextMentions() {
    if (!listEl) return;
    listEl.querySelectorAll('.dm-msg-text:not(.dm-msg-decrypt-err)').forEach(function(el) {
      var raw = el.getAttribute('data-raw-text') || el.textContent || '';
      if (raw.indexOf('@') !== -1 || raw.indexOf('http://') !== -1 || raw.indexOf('https://') !== -1) {
        renderMentionNodes(el, raw);
      }
    });
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
      renderMentionNodes(txtEl, newText);
      bubble.classList.remove('img-only');
    } else if (txtEl) {
      txtEl.remove();
      if (hasImg) bubble.classList.add('img-only');
    }
  }

  function cancelReplyMode() {
    replyingMsg = null;
    if (replyBar) replyBar.style.display = 'none';
    if (replyBarTitle) replyBarTitle.textContent = '';
    if (replyBarPreview) replyBarPreview.textContent = '';
  }

  function startReplyMode(msgId, row) {
    if (!msgId || !row) return;
    if (editingMsg) cancelEditMode();
    var isMine = row.classList.contains('mine');
    var senderName = isMine ? (state.currentUsername || '') : (state.activePartnerUsername || '');
    var senderId = isMine ? Number(state.currentUserId || 0) : Number(state.activePartnerId || 0);
    var kind = 'text';
    var preview = '';
    if (row.getAttribute('data-msg-kind') === 'voice') {
      kind = 'voice';
      preview = state.voiceLabel;
    } else if (row.getAttribute('data-msg-kind') === 'post') {
      kind = 'post';
      var spAuthor = row.getAttribute('data-shared-author') || '';
      preview = spAuthor
        ? String(state.sharedPostLabel || state.sharedPostPreview).replace('{username}', spAuthor)
        : state.sharedPostPreview;
    } else {
      var txtEl = row.querySelector('.dm-msg-text:not(.dm-msg-decrypt-err)');
      var rawTxt = txtEl ? (txtEl.getAttribute('data-raw-text') || txtEl.textContent || '').trim() : '';
      if (rawTxt) {
        kind = 'text';
        preview = rawTxt.replace(/\\s+/g, ' ').slice(0, 120);
      } else if (row.querySelector('.dm-msg-img-btn') || row.getAttribute('data-image-key')) {
        kind = 'image';
        preview = state.photoLabel;
      } else {
        preview = state.encryptedPreview;
      }
    }
    var ytVid = row.getAttribute('data-yt-video-id') || '';
    if (!ytVid && kind === 'text') {
      var rawForYt = txtEl ? (txtEl.getAttribute('data-raw-text') || txtEl.textContent || '') : '';
      var ytFromTxt = extractYoutubeInfoClient(extractFirstUrl(rawForYt));
      if (ytFromTxt && ytFromTxt.videoId) ytVid = ytFromTxt.videoId;
    }
    replyingMsg = {
      id: Number(msgId),
      senderId: senderId,
      senderName: senderName,
      preview: preview,
      kind: kind,
      videoId: (ytVid && YT_ID_CLIENT_RE.test(ytVid)) ? ytVid : undefined
    };
    if (replyBarTitle) {
      replyBarTitle.textContent = String(state.replyingToLabel || '{username}').replace('{username}', '@' + senderName);
    }
    if (replyBarPreview) {
      replyBarPreview.textContent = preview;
    }
    if (replyBar) replyBar.style.display = 'flex';
    if (inputEl) inputEl.focus();
  }

  function jumpToRepliedMessage(targetMsgId) {
    if (!targetMsgId || !listEl) return;
    var targetRow = listEl.querySelector('.dm-msg-row[data-msg-id="' + String(targetMsgId) + '"]');
    if (!targetRow) return;
    var targetBubble = targetRow.querySelector('.dm-msg-bubble');
    try {
      targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {
      targetRow.scrollIntoView(true);
    }
    if (targetBubble) {
      listEl.querySelectorAll('.dm-msg-bubble.is-jump-highlight').forEach(function(b) {
        b.classList.remove('is-jump-highlight');
      });
      targetBubble.classList.add('is-jump-highlight');
      if (jumpHighlightTimer) clearTimeout(jumpHighlightTimer);
      jumpHighlightTimer = setTimeout(function() {
        targetBubble.classList.remove('is-jump-highlight');
        jumpHighlightTimer = null;
      }, 1300);
    }
  }

  function buildReplyQuoteEl(replyMeta) {
    if (!replyMeta || !replyMeta.id) return null;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dm-reply-quote';
    btn.setAttribute('data-jump-msg-id', String(replyMeta.id));
    var authorEl = document.createElement('span');
    authorEl.className = 'dm-reply-quote-author';
    var authorLabel = replyMeta.senderName ? ('@' + replyMeta.senderName) : '';
    authorEl.textContent = authorLabel;
    var previewEl = document.createElement('span');
    previewEl.className = 'dm-reply-quote-text';
    var fallbackLabel = replyMeta.kind === 'voice'
      ? state.voiceLabel
      : (replyMeta.kind === 'post'
        ? state.sharedPostPreview
        : (replyMeta.kind === 'image' ? state.photoLabel : ''));
    previewEl.textContent = replyMeta.preview || fallbackLabel;
    if (authorLabel) btn.appendChild(authorEl);
    btn.appendChild(previewEl);
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      jumpToRepliedMessage(replyMeta.id);
    });
    return btn;
  }

  function cancelEditMode(keepReplacementUrl) {
    if (editingMsg && editingMsg.replacementPreviewUrl && !keepReplacementUrl) {
      try { URL.revokeObjectURL(editingMsg.replacementPreviewUrl); } catch (e) {}
    }
    editingMsg = null;
    if (editBar) editBar.style.display = 'none';
    if (editBarPreview) editBarPreview.textContent = '';
    if (editBarThumb) {
      editBarThumb.style.display = 'none';
      editBarThumb.src = '';
    }
    if (editReplaceBtn) editReplaceBtn.disabled = true;
    if (fileInput) fileInput.value = '';
    if (attachBtn) attachBtn.style.display = '';
    if (inputEl) inputEl.value = '';
    syncSendState();
  }

  async function startEditMode(msgId, row) {
    if (!msgId || !row || !inputEl) return;
    cancelReplyMode();
    var currentText = '';
    var existingMedia = null;
    var existingReply = null;
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
            existingReply = cached.reply || null;
          }
        }
      } catch (e) {}
    }
    if (!currentText) {
      var txtEl = row.querySelector('.dm-msg-text:not(.dm-msg-decrypt-err)');
      if (txtEl) currentText = txtEl.textContent || '';
    }
    var rowImgBtn = row.querySelector('.dm-msg-img-btn');
    var rowImgEl = row.querySelector('.dm-msg-img');
    var thumbUrl = (rowImgBtn && rowImgBtn.getAttribute('data-dm-lightbox')) || (rowImgEl && rowImgEl.getAttribute('src')) || '';
    var hasPhoto = Boolean(imageKey || existingMedia || rowImgBtn);
    clearPendingFile();
    editingMsg = {
      id: msgId,
      isEncrypted: isEncrypted,
      imageKey: imageKey,
      existingMedia: existingMedia,
      existingReply: existingReply,
      originalText: currentText,
      hasPhoto: hasPhoto,
      replacementFile: null,
      replacementPreviewUrl: ''
    };
    if (attachBtn) attachBtn.style.display = 'none';
    if (editReplaceBtn) editReplaceBtn.disabled = !hasPhoto;
    if (editBarThumb) {
      if (hasPhoto && thumbUrl) {
        editBarThumb.src = thumbUrl;
        editBarThumb.style.display = 'block';
      } else {
        editBarThumb.src = '';
        editBarThumb.style.display = 'none';
      }
    }
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
    if (!listEl) return;
    var rows = listEl.querySelectorAll('.dm-msg-row');
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r.classList.contains('mine')) continue;
      var rid = parseInt(r.getAttribute('data-msg-id') || '0', 10);
      var isRead = state.lastReadOwnId > 0 && rid > 0 && rid <= state.lastReadOwnId;
      var tEl = r.querySelector('.dm-msg-time');
      if (tEl) tEl.setAttribute('data-read', isRead ? '1' : '0');
      var stEl = r.querySelector('.dm-msg-status');
      if (stEl) setStatusCheckIcon(stEl, isRead);
    }
    if (convListEl && state.activeConversationId > 0 && state.lastReadOwnId > 0) {
      var activeConvItem = convListEl.querySelector('.dm-conv-item[data-conv-id="' + state.activeConversationId + '"]');
      if (activeConvItem && activeConvItem.getAttribute('data-last-mine') === '1') {
        var activeLastId = parseInt(activeConvItem.getAttribute('data-last-msg-id') || '0', 10);
        if (activeLastId > 0) {
          setConvItemCheck(activeConvItem, true, state.lastReadOwnId >= activeLastId);
        }
      }
    }
    if (seenEl) {
      if (!rows.length) {
        seenEl.classList.remove('visible');
      } else {
        var lastRow = rows[rows.length - 1];
        var lastId = parseInt(lastRow.getAttribute('data-msg-id'), 10) || 0;
        var isLastMine = lastRow.classList.contains('mine');
        if (isLastMine && state.lastReadOwnId > 0 && lastId <= state.lastReadOwnId) {
          seenEl.classList.add('visible');
        } else {
          seenEl.classList.remove('visible');
        }
      }
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

  var activeVoiceAudio = null;
  var activeVoiceUi = null;

  function formatVoiceDuration(ms) {
    var totalSec = Math.max(0, Math.round((Number(ms) || 0) / 1000));
    var mins = Math.floor(totalSec / 60);
    var secs = totalSec % 60;
    return mins + ':' + (secs < 10 ? '0' : '') + secs;
  }

  function stopActiveVoicePlayback() {
    if (activeVoiceAudio) {
      try { activeVoiceAudio.pause(); } catch (e) {}
      activeVoiceAudio = null;
    }
    if (activeVoiceUi) {
      activeVoiceUi.setPlaying(false);
      activeVoiceUi.setProgress(0, activeVoiceUi.totalMs);
      activeVoiceUi = null;
    }
  }

  function buildVoicePlayerEl(mediaMeta, imageKey, localMediaUrl, voiceOpts) {
    var vOpts = voiceOpts || {};
    var vMsgId = Number(vOpts.msgId || 0);
    var vIsMine = Boolean(vOpts.isMine);
    var vIsListened = Boolean(vOpts.isListened);
    var wrap = document.createElement('div');
    wrap.className = 'dm-voice-msg';

    var playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.className = 'dm-voice-play-btn';
    playBtn.setAttribute('aria-label', state.voiceLabel);
    playBtn.innerHTML = state.playIcon;

    var body = document.createElement('div');
    body.className = 'dm-voice-body';

    var wave = document.createElement('div');
    wave.className = 'dm-voice-wave';

    var rawWf = Array.isArray(mediaMeta && mediaMeta.waveform) && mediaMeta.waveform.length > 0
      ? mediaMeta.waveform
      : [18, 34, 52, 28, 66, 80, 44, 24, 58, 72, 40, 30, 62, 48, 36, 76, 54, 28, 46, 68, 38, 22, 50, 32, 42, 60, 34, 26];
    var barEls = [];
    for (var i = 0; i < rawWf.length; i++) {
      var bar = document.createElement('span');
      bar.className = 'dm-voice-bar';
      var val = Math.max(12, Math.min(100, Number(rawWf[i]) || 18));
      bar.style.height = Math.max(4, Math.round((val / 100) * 24)) + 'px';
      wave.appendChild(bar);
      barEls.push(bar);
    }

    var totalMs = Math.max(0, Number(mediaMeta && mediaMeta.durationMs) || 0);
    var metaRow = document.createElement('div');
    metaRow.className = 'dm-voice-meta';
    var durEl = document.createElement('div');
    durEl.className = 'dm-voice-dur';
    durEl.textContent = formatVoiceDuration(totalMs);
    metaRow.appendChild(durEl);

    var unheardDot = null;
    if (!vIsListened) {
      unheardDot = document.createElement('span');
      unheardDot.className = 'dm-voice-unheard-dot';
      unheardDot.setAttribute('aria-hidden', 'true');
      metaRow.appendChild(unheardDot);
    }

    body.appendChild(wave);
    body.appendChild(metaRow);
    wrap.appendChild(playBtn);
    wrap.appendChild(body);

    var resolvedUrl = localMediaUrl || '';
    var audioEl = null;
    var isLoading = false;
    var listenedReported = vIsListened;

    function markListenedOnce() {
      if (vIsMine || listenedReported || !vMsgId) return;
      listenedReported = true;
      if (unheardDot && unheardDot.parentNode) {
        unheardDot.parentNode.removeChild(unheardDot);
        unheardDot = null;
      }
      var rowEl = wrap.closest ? wrap.closest('.dm-msg-row') : null;
      if (rowEl) rowEl.setAttribute('data-listened', '1');
      fetch('/api/messages/listened', {
        method: 'POST',
        credentials: 'same-origin',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: vMsgId })
      }).catch(function() {});
    }

    var uiHandle = {
      totalMs: totalMs,
      setPlaying: function(playing) {
        playBtn.innerHTML = playing ? state.pauseIcon : state.playIcon;
        if (playing) wrap.classList.add('is-playing');
        else wrap.classList.remove('is-playing');
      },
      setProgress: function(ratio, displayMs) {
        var r = Math.max(0, Math.min(1, Number(ratio) || 0));
        var litCount = Math.round(r * barEls.length);
        for (var j = 0; j < barEls.length; j++) {
          if (j < litCount) barEls[j].classList.add('played');
          else barEls[j].classList.remove('played');
        }
        durEl.textContent = formatVoiceDuration(displayMs);
      }
    };

    async function ensureAudioReady() {
      if (audioEl) return audioEl;
      if (!resolvedUrl) {
        if (!e2eeClient || !mediaMeta || !imageKey) return null;
        isLoading = true;
        wrap.classList.add('is-loading');
        try {
          resolvedUrl = await e2eeClient.decryptMediaToObjectUrl(imageKey, mediaMeta);
        } finally {
          isLoading = false;
          wrap.classList.remove('is-loading');
        }
      }
      if (!resolvedUrl) return null;
      audioEl = new Audio(resolvedUrl);
      audioEl.preload = 'metadata';
      audioEl.addEventListener('loadedmetadata', function() {
        if (isFinite(audioEl.duration) && audioEl.duration > 0) {
          totalMs = Math.round(audioEl.duration * 1000);
          uiHandle.totalMs = totalMs;
          if (audioEl.paused) durEl.textContent = formatVoiceDuration(totalMs);
        }
      });
      audioEl.addEventListener('timeupdate', function() {
        var dur = (isFinite(audioEl.duration) && audioEl.duration > 0) ? audioEl.duration : (totalMs / 1000);
        var ratio = dur > 0 ? (audioEl.currentTime / dur) : 0;
        uiHandle.setProgress(ratio, audioEl.currentTime * 1000);
      });
      audioEl.addEventListener('ended', function() {
        uiHandle.setPlaying(false);
        uiHandle.setProgress(0, totalMs);
        if (activeVoiceAudio === audioEl) {
          activeVoiceAudio = null;
          activeVoiceUi = null;
        }
      });
      audioEl.addEventListener('pause', function() {
        uiHandle.setPlaying(false);
      });
      return audioEl;
    }

    async function togglePlay(seekRatio) {
      if (isLoading) return;
      try {
        var a = await ensureAudioReady();
        if (!a) {
          if (window.showAppToast) window.showAppToast(state.e2eeDecryptFailed);
          return;
        }
        if (typeof seekRatio === 'number') {
          var dur = (isFinite(a.duration) && a.duration > 0) ? a.duration : (totalMs / 1000);
          if (dur > 0) {
            a.currentTime = Math.max(0, Math.min(dur, dur * seekRatio));
            uiHandle.setProgress(seekRatio, a.currentTime * 1000);
          }
          if (a.paused) {
            if (activeVoiceAudio && activeVoiceAudio !== a) stopActiveVoicePlayback();
            activeVoiceAudio = a;
            activeVoiceUi = uiHandle;
            uiHandle.setPlaying(true);
            await a.play();
            markListenedOnce();
          }
          return;
        }
        if (!a.paused) {
          a.pause();
          return;
        }
        if (activeVoiceAudio && activeVoiceAudio !== a) {
          stopActiveVoicePlayback();
        }
        activeVoiceAudio = a;
        activeVoiceUi = uiHandle;
        uiHandle.setPlaying(true);
        await a.play();
        markListenedOnce();
      } catch (err) {
        uiHandle.setPlaying(false);
        if (window.showAppToast) window.showAppToast(state.networkError);
      }
    }

    playBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      togglePlay();
    });

    wave.addEventListener('click', function(e) {
      e.stopPropagation();
      var rect = wave.getBoundingClientRect();
      if (!rect.width) return;
      var ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      togglePlay(ratio);
    });

    return wrap;
  }

  function buildSharedPostCardEl(sp) {
    if (!sp || !sp.postId || !sp.authorUsername || !sp.imageKey) return null;
    var imgKey = String(sp.imageKey).trim();
    if (imgKey.indexOf('posts/') !== 0 || imgKey.indexOf('..') !== -1 || imgKey.indexOf('\\\\') !== -1) return null;
    var author = String(sp.authorUsername).trim();
    if (!author) return null;

    var card = document.createElement('a');
    card.className = 'dm-shared-post';
    card.href = '/u/' + encodeURIComponent(author) + '?post=' + encodeURIComponent(String(sp.postId));

    var head = document.createElement('div');
    head.className = 'dm-shared-post-head';

    var av = document.createElement('span');
    av.className = 'dm-shared-post-avatar';
    var avKey = sp.authorAvatar ? String(sp.authorAvatar).trim() : '';
    if (avKey && avKey.indexOf('avatars/') === 0 && avKey.indexOf('..') === -1 && avKey.indexOf('\\\\') === -1) {
      var avImg = document.createElement('img');
      avImg.src = '/media/' + encodeURIComponent(avKey);
      avImg.alt = author;
      avImg.loading = 'lazy';
      av.appendChild(avImg);
    } else {
      var avSp = document.createElement('span');
      avSp.textContent = author.charAt(0).toUpperCase();
      av.appendChild(avSp);
    }

    var nameWrap = document.createElement('span');
    nameWrap.className = 'dm-shared-post-author';
    var nameText = document.createElement('span');
    nameText.textContent = author;
    nameWrap.appendChild(nameText);
    if (sp.authorVerified && state.verifiedBadgeSm) {
      var badge = document.createElement('span');
      badge.innerHTML = state.verifiedBadgeSm;
      nameWrap.appendChild(badge);
    }

    head.appendChild(av);
    head.appendChild(nameWrap);
    card.appendChild(head);

    var mediaWrap = document.createElement('div');
    mediaWrap.className = 'dm-shared-post-media';
    var img = document.createElement('img');
    var baseMedia = '/media/' + encodeURIComponent(imgKey);
    img.src = imgKey.slice(-5) === '.webp' ? (baseMedia + '?v=thumb') : baseMedia;
    img.alt = author;
    img.loading = 'lazy';
    img.addEventListener('load', function() {
      if (isPinnedToBottom || Date.now() < kbOpeningUntil) {
        pinScrollBottomNow();
      }
    });
    mediaWrap.appendChild(img);
    card.appendChild(mediaWrap);

    if (sp.caption) {
      var cap = document.createElement('div');
      cap.className = 'dm-shared-post-caption';
      var capUser = document.createElement('strong');
      capUser.textContent = author + ' ';
      cap.appendChild(capUser);
      cap.appendChild(document.createTextNode(String(sp.caption)));
      card.appendChild(cap);
    }

    return card;
  }

  function buildLinkPreviewCardEl(preview) {
    if (!preview || typeof preview !== 'object') return null;
    var cleanUrl = sanitizeClientHttpUrl(preview.url);
    if (!cleanUrl) return null;
    var title = String(preview.title || '').trim();
    var desc = String(preview.description || '').trim();
    var site = String(preview.siteName || '').trim();
    var vid = (preview.videoId && YT_ID_CLIENT_RE.test(String(preview.videoId))) ? String(preview.videoId) : '';
    var startSec = Math.max(0, Math.floor(Number(preview.startSec || 0)));
    var imgUrl = sanitizeClientHttpUrl(preview.image || '');
    if (!title && !desc && !vid) return null;

    var card = document.createElement('div');
    card.className = 'dm-link-preview' + (vid ? ' is-youtube' : '');
    if (vid) card.setAttribute('data-yt-id', vid);

    var bar = document.createElement('div');
    bar.className = 'dm-lp-bar';
    card.appendChild(bar);

    var body = document.createElement('div');
    body.className = 'dm-lp-body';

    if (site) {
      var siteEl = document.createElement('div');
      siteEl.className = 'dm-lp-site';
      siteEl.textContent = site;
      body.appendChild(siteEl);
    }

    if (title) {
      var titleLink = document.createElement('a');
      titleLink.className = 'dm-lp-title';
      titleLink.setAttribute('href', cleanUrl);
      titleLink.setAttribute('target', '_blank');
      titleLink.setAttribute('rel', 'noopener noreferrer');
      titleLink.textContent = title;
      body.appendChild(titleLink);
    }

    if (desc && desc !== title) {
      var descEl = document.createElement('div');
      descEl.className = 'dm-lp-desc';
      descEl.textContent = desc;
      body.appendChild(descEl);
    }

    var thumbSrc = imgUrl
      ? ('/api/messages/link-preview-img?url=' + encodeURIComponent(imgUrl))
      : (vid ? ('/api/messages/link-preview-img?url=' + encodeURIComponent('https://i.ytimg.com/vi/' + vid + '/hqdefault.jpg')) : '');

    if (vid || thumbSrc) {
      var mediaWrap = document.createElement('div');
      mediaWrap.className = 'dm-lp-media-wrap';
      var imgEl = document.createElement('img');
      imgEl.className = 'dm-lp-media-img';
      imgEl.src = thumbSrc;
      imgEl.alt = title || site || 'Preview';
      imgEl.loading = 'lazy';
      imgEl.addEventListener('error', function() {
        if (vid) {
          imgEl.style.opacity = '0.2';
        } else {
          mediaWrap.remove();
        }
      });
      imgEl.addEventListener('load', function() {
        if (isPinnedToBottom || Date.now() < kbOpeningUntil) {
          pinScrollBottomNow();
        }
      });

      if (vid) {
        var trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'dm-lp-video-trigger';
        trigger.setAttribute('data-yt-id', vid);
        trigger.setAttribute('data-yt-start', String(startSec));
        trigger.setAttribute('data-yt-title', title || 'YouTube');
        trigger.setAttribute('data-yt-url', cleanUrl);
        trigger.setAttribute('aria-label', state.playVideoLabel || 'Play video');
        trigger.appendChild(imgEl);
        var playSpan = document.createElement('span');
        playSpan.className = 'dm-lp-play-btn';
        playSpan.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"/></svg>';
        trigger.appendChild(playSpan);
        mediaWrap.appendChild(trigger);
      } else {
        var imgLink = document.createElement('a');
        imgLink.className = 'dm-lp-img-link';
        imgLink.setAttribute('href', cleanUrl);
        imgLink.setAttribute('target', '_blank');
        imgLink.setAttribute('rel', 'noopener noreferrer');
        imgLink.appendChild(imgEl);
        mediaWrap.appendChild(imgLink);
      }
      body.appendChild(mediaWrap);
    }

    card.appendChild(body);
    return card;
  }

  function hydrateBubbleContent(bubble, timeEl, payload, imageKey, localMediaUrl, voiceOpts) {
    while (bubble.firstChild) bubble.removeChild(bubble.firstChild);
    var isVoice = Boolean(payload && payload.media && payload.media.kind === 'voice' && (imageKey || localMediaUrl));
    var hasSharedPost = !isVoice && Boolean(payload && payload.sharedPost && payload.sharedPost.postId && payload.sharedPost.imageKey);
    var hasImg = !isVoice && !hasSharedPost && Boolean((payload && payload.media && imageKey) || localMediaUrl);
    var hasText = Boolean(payload && payload.text);
    var replyQuoteEl = (payload && payload.reply) ? buildReplyQuoteEl(payload.reply) : null;
    var parentRow = bubble.closest ? bubble.closest('.dm-msg-row') : null;
    var firstUrl = hasText ? extractFirstUrl(payload.text) : '';
    var ownYtInfo = (payload && payload.linkPreview && payload.linkPreview.videoId && YT_ID_CLIENT_RE.test(payload.linkPreview.videoId))
      ? { videoId: payload.linkPreview.videoId, startSec: Number(payload.linkPreview.startSec || 0) }
      : (firstUrl ? extractYoutubeInfoClient(firstUrl) : null);
    var replyVideoId = '';
    if (payload && payload.reply) {
      if (payload.reply.videoId && YT_ID_CLIENT_RE.test(payload.reply.videoId)) {
        replyVideoId = payload.reply.videoId;
      } else if (payload.reply.id && listEl) {
        var qRow = listEl.querySelector('.dm-msg-row[data-msg-id="' + String(payload.reply.id) + '"]');
        if (qRow) {
          var qVid = qRow.getAttribute('data-yt-video-id') || '';
          if (YT_ID_CLIENT_RE.test(qVid)) replyVideoId = qVid;
        }
      }
    }
    var activeVideoId = (ownYtInfo && ownYtInfo.videoId) ? ownYtInfo.videoId : replyVideoId;
    if (parentRow) {
      if (ownYtInfo && ownYtInfo.videoId) {
        parentRow.setAttribute('data-yt-video-id', ownYtInfo.videoId);
        if (payload && payload.linkPreview && payload.linkPreview.title) {
          parentRow.setAttribute('data-yt-title', String(payload.linkPreview.title));
        }
      } else {
        parentRow.removeAttribute('data-yt-video-id');
        parentRow.removeAttribute('data-yt-title');
      }
      if (isVoice) {
        parentRow.setAttribute('data-msg-kind', 'voice');
        parentRow.removeAttribute('data-shared-author');
      } else if (hasSharedPost) {
        parentRow.setAttribute('data-msg-kind', 'post');
        parentRow.setAttribute('data-shared-author', String(payload.sharedPost.authorUsername || ''));
      } else {
        parentRow.removeAttribute('data-msg-kind');
        parentRow.removeAttribute('data-shared-author');
      }
    }
    if (isVoice) {
      var resolvedVoiceOpts = voiceOpts || {
        msgId: parentRow ? parseInt(parentRow.getAttribute('data-msg-id') || '0', 10) : 0,
        isMine: parentRow ? parentRow.classList.contains('mine') : false,
        isListened: parentRow ? parentRow.getAttribute('data-listened') === '1' : false
      };
      bubble.classList.remove('img-only');
      bubble.classList.remove('shared-post-bubble');
      bubble.classList.add('voice-bubble');
      if (replyQuoteEl) bubble.appendChild(replyQuoteEl);
      bubble.appendChild(buildVoicePlayerEl(payload.media, imageKey, localMediaUrl, resolvedVoiceOpts));
      bubble.appendChild(timeEl);
      return;
    }
    bubble.classList.remove('voice-bubble');
    if (hasSharedPost) {
      bubble.classList.remove('img-only');
      bubble.classList.add('shared-post-bubble');
      if (replyQuoteEl) bubble.appendChild(replyQuoteEl);
      var spCard = buildSharedPostCardEl(payload.sharedPost);
      if (spCard) bubble.appendChild(spCard);
      if (hasText) {
        var spTxt = document.createElement('div');
        spTxt.className = 'dm-msg-text dm-shared-post-note';
        renderMentionNodes(spTxt, payload.text, { videoId: activeVideoId });
        bubble.appendChild(spTxt);
      }
      bubble.appendChild(timeEl);
      return;
    }
    bubble.classList.remove('shared-post-bubble');
    if (hasImg && !hasText && !replyQuoteEl) bubble.classList.add('img-only');
    else bubble.classList.remove('img-only');
    if (replyQuoteEl) bubble.appendChild(replyQuoteEl);

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
      renderMentionNodes(txt, payload.text, { videoId: activeVideoId });
      bubble.appendChild(txt);
    }

    if (!hasImg && firstUrl) {
      var directPreview = (payload && payload.linkPreview && payload.linkPreview.url) ? payload.linkPreview : null;
      if (directPreview) {
        var lpCard = buildLinkPreviewCardEl(directPreview);
        if (lpCard) bubble.appendChild(lpCard);
      } else {
        var capturedUrl = firstUrl;
        var capturedBubble = bubble;
        var capturedTime = timeEl;
        var capturedRow = parentRow;
        fetchLinkPreviewClient(capturedUrl).then(function(resolved) {
          if (!resolved || !capturedBubble || !capturedBubble.isConnected) return;
          if (capturedBubble.querySelector('.dm-link-preview')) return;
          var asyncCard = buildLinkPreviewCardEl(resolved);
          if (!asyncCard) return;
          if (capturedRow && resolved.videoId && YT_ID_CLIENT_RE.test(resolved.videoId)) {
            capturedRow.setAttribute('data-yt-video-id', resolved.videoId);
            if (resolved.title) capturedRow.setAttribute('data-yt-title', String(resolved.title));
          }
          if (capturedTime && capturedTime.parentNode === capturedBubble) {
            capturedBubble.insertBefore(asyncCard, capturedTime);
          } else {
            capturedBubble.appendChild(asyncCard);
          }
          if (isPinnedToBottom || Date.now() < kbOpeningUntil) {
            pinScrollBottomNow();
          }
        });
      }
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
    row.setAttribute('data-listened', m.listened_at ? '1' : '0');

    var bubble = document.createElement('div');
    bubble.className = 'dm-msg-bubble';
    var timeEl = document.createElement('div');
    timeEl.className = 'dm-msg-time';
    var isReadInit = isMine && ((state.lastReadOwnId > 0 && Number(m.id) <= state.lastReadOwnId) || Boolean(m.read_at));
    renderMsgTimeEl(timeEl, m.created_at || '', Boolean(m.edited_at), isMine, isReadInit);

    if (m.is_encrypted) {
      if (decryptedPayload) {
        hydrateBubbleContent(bubble, timeEl, decryptedPayload, m.image_key || '', localMediaUrl || '', {
          msgId: Number(m.id || 0),
          isMine: isMine,
          isListened: Boolean(m.listened_at)
        });
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
        renderMentionNodes(txt, m.body);
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
    syncDateSeparators();
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
            var isVoiceRow = lastRow.getAttribute('data-msg-kind') === 'voice';
            var isPostRow = lastRow.getAttribute('data-msg-kind') === 'post';
            var hasImg = !isVoiceRow && !isPostRow && Boolean(lastRow.querySelector('.dm-msg-img') || lastRow.getAttribute('data-image-key'));
            var isEnc = lastRow.getAttribute('data-encrypted') === '1';
            previewEl.textContent = txt ? (prefix + txt) : (isVoiceRow ? (prefix + state.voiceLabel) : (isPostRow ? (prefix + state.sharedPostPreview) : (hasImg ? (prefix + state.photoLabel) : (isEnc ? (prefix + state.encryptedPreview) : ''))));
          }
          var lastRowId = parseInt(lastRow.getAttribute('data-msg-id') || '0', 10);
          var lastRowMine = lastRow.classList.contains('mine');
          item.setAttribute('data-last-msg-id', String(lastRowId));
          item.setAttribute('data-last-mine', lastRowMine ? '1' : '0');
          setConvItemCheck(item, lastRowMine, lastRowMine && state.lastReadOwnId > 0 && lastRowId <= state.lastReadOwnId);
        }
      }
    } else {
      state.oldestMsgId = 0;
      if (convListEl && state.activeConversationId) {
        var emptyItem = convListEl.querySelector('.dm-conv-item[data-conv-id="' + state.activeConversationId + '"]');
        if (emptyItem) {
          var emptyPrev = emptyItem.querySelector('.dm-conv-preview');
          if (emptyPrev) emptyPrev.textContent = '';
          emptyItem.setAttribute('data-last-msg-id', '0');
          setConvItemCheck(emptyItem, false, false);
        }
      }
    }
    syncDateSeparators();
    updateSeenUI();
  }

  function updateSidebarPreview(convId, senderId, plainText, hasImg, mediaKind) {
    if (!convListEl) return;
    var item = convListEl.querySelector('.dm-conv-item[data-conv-id="' + convId + '"]');
    if (!item) return;
    var previewEl = item.querySelector('.dm-conv-preview');
    var timeEl = item.querySelector('.dm-conv-time');
    var isMine = Number(senderId) === Number(state.currentUserId);
    var prefix = isMine ? state.youPrefix : '';
    if (previewEl) {
      var mediaLabel = mediaKind === 'voice'
        ? state.voiceLabel
        : (mediaKind === 'post' ? state.sharedPostPreview : state.photoLabel);
      previewEl.textContent = plainText ? (prefix + plainText) : (hasImg ? (prefix + mediaLabel) : (prefix + state.encryptedPreview));
    }
    if (timeEl) timeEl.textContent = state.justNow;
    item.setAttribute('data-last-mine', isMine ? '1' : '0');
    if (Number(state.lastMsgId) > 0 && Number(convId) === Number(state.activeConversationId)) {
      item.setAttribute('data-last-msg-id', String(state.lastMsgId));
    }
    setConvItemCheck(item, isMine, false);
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
        var batchIds = [];
        for (var bi = 0; bi < items.length; bi++) {
          var bItem = items[bi];
          var bLastId = parseInt(bItem.getAttribute('data-last-msg-id') || '0', 10);
          var bVer = parseInt(bItem.getAttribute('data-last-edit-version') || '0', 10);
          if (bLastId && bItem.getAttribute('data-preview-hydrated') !== (bLastId + ':' + bVer)) {
            batchIds.push(bLastId);
          }
        }
        var batchMap = (batchIds.length > 0 && typeof c.getCachedMessagesBatch === 'function')
          ? await c.getCachedMessagesBatch(batchIds)
          : new Map();
        for (var i = 0; i < items.length; i++) {
          var item = items[i];
          var convId = item.getAttribute('data-conv-id') || '';
          var lastId = parseInt(item.getAttribute('data-last-msg-id') || '0', 10);
          var editVer = parseInt(item.getAttribute('data-last-edit-version') || '0', 10);
          if (!lastId) continue;
          var verKey = lastId + ':' + editVer;
          if (item.getAttribute('data-preview-hydrated') === verKey) continue;
          var payload = null;
          var cached = batchMap.get(lastId);
          if (!cached && typeof c.getCachedMessage === 'function' && typeof c.getCachedMessagesBatch !== 'function') {
            cached = await c.getCachedMessage(lastId);
          }
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
          var mediaLabel = (payload.media && payload.media.kind === 'voice')
            ? state.voiceLabel
            : (payload.sharedPost ? state.sharedPostPreview : state.photoLabel);
          previewEl.textContent = cleanTxt
            ? (prefix + cleanTxt)
            : ((payload.media || payload.sharedPost) ? (prefix + mediaLabel) : (prefix + state.encryptedPreview));
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
      var initIds = [];
      for (var ii = 0; ii < list.length; ii++) {
        var mid = Number(list[ii].id || 0);
        if (mid > 0) initIds.push(mid);
      }
      var initCachedMap = (initIds.length > 0 && typeof c.getCachedMessagesBatch === 'function')
        ? await c.getCachedMessagesBatch(initIds)
        : new Map();
      for (var i = 0; i < list.length; i++) {
        var m = list[i];
        var row = listEl ? listEl.querySelector('.dm-msg-row[data-msg-id="' + m.id + '"]') : null;
        if (!row) continue;
        var bubble = row.querySelector('.dm-msg-bubble');
        var timeEl = row.querySelector('.dm-msg-time');
        if (!bubble || !timeEl) continue;
        var mVer = Math.max(0, Number(m.edit_version || 0));
        var preCached = initCachedMap.get(Number(m.id || 0));
        var res = (preCached && Number(preCached.editVersion || 0) >= mVer)
          ? { ok: true, payload: preCached }
          : await c.decryptMessage(m);
        if (res.ok && res.payload) {
          hydrateBubbleContent(bubble, timeEl, res.payload, m.image_key || '', '', {
            msgId: Number(m.id || 0),
            isMine: Number(m.sender_id) === Number(state.currentUserId),
            isListened: Boolean(m.listened_at)
          });
          if (Number(m.id) === Number(state.lastMsgId) && Number(m.edit_version || 0) > 0) {
            updateSidebarPreview(state.activeConversationId, m.sender_id, res.payload.text, Boolean(res.payload.media));
          }
        } else {
          if (res && res.reason === 'KEY_CHANGED' && res.userId && res.deviceId) {
            pendingKeyChange = {
              userId: res.userId,
              deviceId: res.deviceId,
              identityKey: res.identityKey || '',
              retryAction: 'decrypt'
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
  hydratePlainTextMentions();
  if (scrollEl) {
    scrollToBottom();
    setTimeout(scrollToBottom, 80);
  }
  hydrateInitialMessages();

  if (e2eeBannerBtn) {
    e2eeBannerBtn.addEventListener('click', async function() {
      if (!pendingKeyChange || e2eeBannerBtn.disabled) return;
      var kc = pendingKeyChange;
      e2eeBannerBtn.disabled = true;
      try {
        var c = e2eeClient || await ensureE2eeReady();
        if (!c) {
          if (window.showAppToast) window.showAppToast(state.networkError);
          return;
        }
        var items = Array.isArray(kc.devices) && kc.devices.length > 0
          ? kc.devices
          : [{ userId: kc.userId, deviceId: kc.deviceId, identityKey: kc.identityKey || '' }];
        if (typeof c.acceptKeyChanges === 'function') {
          await c.acceptKeyChanges(items);
        } else {
          for (var ki = 0; ki < items.length; ki++) {
            await c.acceptKeyChange(items[ki].userId, items[ki].deviceId, items[ki].identityKey || '');
          }
        }
        var retryAction = kc.retryAction || '';
        hideBanner();
        if (retryAction === 'send' && typeof submitDmMessage === 'function') {
          submitDmMessage();
        } else if (retryAction === 'decrypt') {
          if (state.activeConversationId > 0) pollActiveChat();
          hydrateInitialMessages();
        }
      } catch (e) {
        if (window.showAppToast) window.showAppToast(state.networkError);
      } finally {
        e2eeBannerBtn.disabled = false;
      }
    });
  }

  if (inputEl && window.pgBindPlainEditable) {
    window.pgBindPlainEditable(inputEl, {
      multiline: true,
      onEnter: function() {
        if (typeof submitDmMessage === 'function') submitDmMessage();
      }
    });
  }
  if (searchInput && window.pgBindPlainEditable) {
    window.pgBindPlainEditable(searchInput, {});
  }

  var partnerTypingTimer = null;
  var myTypingActive = false;
  var myTypingLastSentAt = 0;
  var myTypingStopTimer = null;

  function clearPartnerTyping() {
    if (partnerTypingTimer) {
      clearTimeout(partnerTypingTimer);
      partnerTypingTimer = null;
    }
    if (threadSubtitleEl) {
      threadSubtitleEl.textContent = threadSubtitleEl.getAttribute('data-default-text') || '';
      threadSubtitleEl.classList.remove('is-typing');
    }
  }

  function showPartnerTyping() {
    if (!threadSubtitleEl) return;
    threadSubtitleEl.textContent = state.typingLabel || '';
    threadSubtitleEl.classList.add('is-typing');
    if (partnerTypingTimer) clearTimeout(partnerTypingTimer);
    partnerTypingTimer = setTimeout(clearPartnerTyping, 4500);
  }

  function sendStopTypingNow() {
    if (myTypingStopTimer) {
      clearTimeout(myTypingStopTimer);
      myTypingStopTimer = null;
    }
    if (!myTypingActive) return;
    myTypingActive = false;
    if (state.activeConversationId > 0 && window.PhotogramRealtime) {
      window.PhotogramRealtime.sendTyping(state.activeConversationId, false);
    }
  }

  function notifyTypingInput() {
    if (!state.activeConversationId || editingMsg || !window.PhotogramRealtime) return;
    var hasText = Boolean(inputEl && inputEl.value.trim().length > 0);
    if (!hasText) {
      sendStopTypingNow();
      return;
    }
    var now = Date.now();
    if (!myTypingActive || now - myTypingLastSentAt >= 2000) {
      if (window.PhotogramRealtime.sendTyping(state.activeConversationId, true)) {
        myTypingActive = true;
        myTypingLastSentAt = now;
      }
    }
    if (myTypingStopTimer) clearTimeout(myTypingStopTimer);
    myTypingStopTimer = setTimeout(sendStopTypingNow, 3500);
  }

  if (inputEl) {
    inputEl.addEventListener('input', function() {
      syncSendState();
      notifyTypingInput();
    });
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
      sendStopTypingNow();
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

  if (editReplaceBtn && fileInput) {
    editReplaceBtn.addEventListener('click', function() {
      if (!editingMsg || !editingMsg.hasPhoto) return;
      fileInput.click();
    });
  }
  if (editBarThumb && fileInput) {
    editBarThumb.addEventListener('click', function() {
      if (!editingMsg || !editingMsg.hasPhoto) return;
      fileInput.click();
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
      if (editingMsg && editingMsg.hasPhoto) {
        if (editingMsg.replacementPreviewUrl) {
          try { URL.revokeObjectURL(editingMsg.replacementPreviewUrl); } catch (re) {}
        }
        editingMsg.replacementFile = f;
        editingMsg.replacementPreviewUrl = (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function')
          ? URL.createObjectURL(f)
          : '';
        if (editBarThumb && editingMsg.replacementPreviewUrl) {
          editBarThumb.src = editingMsg.replacementPreviewUrl;
          editBarThumb.style.display = 'block';
        }
        syncSendState();
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
    editCancelBtn.addEventListener('click', function() {
      cancelEditMode(false);
    });
  }

  if (replyCancelBtn) {
    replyCancelBtn.addEventListener('click', cancelReplyMode);
  }

  async function submitDmMessage(e) {
      if (e && e.preventDefault) e.preventDefault();
      if (isSending) return;
      var text = inputEl ? inputEl.value.trim() : '';

      if (editingMsg) {
        if (!text && !editingMsg.existingMedia && !editingMsg.imageKey && !editingMsg.replacementFile) return;
        var editTarget = editingMsg;
        isSending = true;
        syncSendState();
        try {
          if (!editTarget.isEncrypted && !editTarget.replacementFile) {
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
              cancelEditMode(false);
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
          var repFileBytes = null;
          var repFileMime = '';
          if (editTarget.replacementFile) {
            repFileBytes = await editTarget.replacementFile.arrayBuffer();
            repFileMime = editTarget.replacementFile.type || 'image/jpeg';
          }
          var encEdit;
          try {
            encEdit = await ec.encryptMessage({
              partnerUserId: state.activePartnerId,
              text: text,
              fileBytes: repFileBytes,
              fileMime: repFileMime,
              mediaKind: repFileBytes ? 'image' : undefined,
              existingMedia: repFileBytes ? null : editTarget.existingMedia,
              reply: editTarget.existingReply || null,
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
                identityKey: encEditErr.identityKey,
                devices: encEditErr.devices,
                retryAction: 'send'
              };
              showBanner(state.e2eeKeyChanged, true, state.e2eeAcceptNewKey);
              return;
            }
            if (encEditErr && encEditErr.code === 'INVALID_IMAGE') {
              if (window.showAppToast) window.showAppToast(state.errInvalidImage);
              return;
            }
            if (encEditErr && encEditErr.code === 'IMAGE_TOO_LARGE') {
              if (window.showAppToast) window.showAppToast(state.errImageTooLarge);
              return;
            }
            if (window.showAppToast) window.showAppToast(state.networkError);
            return;
          }
          var editRes;
          if (encEdit.encryptedBlob) {
            var efd = new FormData();
            efd.append('message_id', String(editTarget.id));
            efd.append('sender_device_id', String(encEdit.senderDeviceId));
            efd.append('envelopes', JSON.stringify(encEdit.envelopes));
            efd.append('encrypted_media', encEdit.encryptedBlob, 'media.enc');
            editRes = await fetch('/api/messages/edit', {
              method: 'POST',
              credentials: 'same-origin',
              body: efd
            });
          } else {
            editRes = await fetch('/api/messages/edit', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message_id: editTarget.id,
                sender_device_id: encEdit.senderDeviceId,
                envelopes: encEdit.envelopes
              })
            });
          }
          var editData = await editRes.json();
          if (editRes.ok && editData && editData.success) {
            hideBanner();
            var nextVer = Number(editData.edit_version || 1);
            var nextImgKey = typeof editData.image_key === 'string' ? editData.image_key : (editTarget.imageKey || '');
            var repPreviewUrl = editTarget.replacementPreviewUrl || '';
            await ec.cacheSentMessage(editTarget.id, encEdit.payload, nextVer);
            if (listEl) {
              var editedRow = listEl.querySelector('.dm-msg-row[data-msg-id="' + editTarget.id + '"]');
              if (editedRow) {
                editedRow.setAttribute('data-edit-version', String(nextVer));
                editedRow.setAttribute('data-image-key', nextImgKey);
                editedRow.setAttribute('data-encrypted', '1');
                var eBubble = editedRow.querySelector('.dm-msg-bubble');
                var eTime = editedRow.querySelector('.dm-msg-time');
                if (eBubble && eTime) {
                  renderMsgTimeEl(eTime, eTime.getAttribute('data-ts') || '', true);
                  hydrateBubbleContent(eBubble, eTime, encEdit.payload, nextImgKey, repPreviewUrl);
                }
              }
            }
            if (Number(editTarget.id) === Number(state.lastMsgId)) {
              updateSidebarPreview(state.activeConversationId, state.currentUserId, encEdit.payload.text, Boolean(encEdit.payload.media));
            }
            cancelEditMode(Boolean(repPreviewUrl));
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

      sendStopTypingNow();
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

        var replySnap = replyingMsg ? Object.assign({}, replyingMsg) : null;
        var linkPreviewSnap = null;
        if (!fileBytes && text) {
          var firstSendUrl = extractFirstUrl(text);
          if (firstSendUrl) {
            try {
              linkPreviewSnap = await Promise.race([
                fetchLinkPreviewClient(firstSendUrl),
                new Promise(function(resolve) { setTimeout(function() { resolve(null); }, 900); })
              ]);
            } catch (lpErr) {
              linkPreviewSnap = null;
            }
          }
        }
        var enc;
        try {
          enc = await c.encryptMessage({
            partnerUserId: state.activePartnerId,
            text: text,
            fileBytes: fileBytes,
            fileMime: fileMime,
            reply: replySnap,
            linkPreview: linkPreviewSnap
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
              identityKey: encErr.identityKey,
              devices: encErr.devices,
              retryAction: 'send'
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
          cancelReplyMode();
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

  var VOICE_MAX_MS = 120000;
  var VOICE_MIN_MS = 500;
  var VOICE_TAP_LOCK_MS = 320;
  var VOICE_LIVE_BAR_COUNT = 24;
  var VOICE_WAVEFORM_BARS = 32;
  var VOICE_CANCEL_PX = 70;
  var voiceRecording = false;
  var voiceStarting = false;
  var voicePointerHeld = false;
  var voiceLocked = false;
  var voiceTapLockWanted = false;
  var voicePressDownAt = 0;
  var voiceCancelActive = false;
  var voicePointerId = null;
  var voiceStartX = 0;
  var voiceStartedAt = 0;
  var voiceMediaStream = null;
  var voiceRecorder = null;
  var voiceAudioCtx = null;
  var voiceAnalyser = null;
  var voiceRafId = 0;
  var voiceTimerId = null;
  var voiceChunks = [];
  var voiceLiveLevels = [];
  var voiceLiveBarEls = [];
  var voicePeakSamples = [];
  var voiceLastSampleAt = 0;
  var voiceFramePeak = 0;
  var voiceSilentGain = null;

  if (voiceLiveBars) {
    for (var vbIdx = 0; vbIdx < VOICE_LIVE_BAR_COUNT; vbIdx++) {
      var vBar = document.createElement('span');
      vBar.className = 'dm-voice-live-bar';
      vBar.style.height = '4px';
      voiceLiveBars.appendChild(vBar);
      voiceLiveBarEls.push(vBar);
      voiceLiveLevels.push(4);
    }
  }

  function pickVoiceMimeType() {
    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return '';
    var candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
    for (var i = 0; i < candidates.length; i++) {
      try {
        if (MediaRecorder.isTypeSupported(candidates[i])) return candidates[i];
      } catch (e) {}
    }
    return '';
  }

  function downsampleVoiceWaveform(samples, count) {
    var out = [];
    if (!samples || samples.length === 0) {
      for (var i = 0; i < count; i++) out.push(18);
      return out;
    }
    var raw = [];
    var minV = 100;
    var maxV = 0;
    var step = samples.length / count;
    for (var j = 0; j < count; j++) {
      var start = Math.floor(j * step);
      var end = Math.max(start + 1, Math.floor((j + 1) * step));
      var sum = 0;
      var cnt = 0;
      var localMax = 0;
      for (var k = start; k < end && k < samples.length; k++) {
        var sv = Number(samples[k]) || 0;
        sum += sv;
        if (sv > localMax) localMax = sv;
        cnt++;
      }
      var blended = cnt > 0 ? Math.round((sum / cnt) * 0.45 + localMax * 0.55) : 14;
      if (blended < minV) minV = blended;
      if (blended > maxV) maxV = blended;
      raw.push(blended);
    }
    var spread = maxV - minV;
    for (var n = 0; n < raw.length; n++) {
      var v = raw[n];
      if (maxV > 12 && spread >= 4 && maxV < 75) {
        v = Math.round(14 + ((v - minV) / Math.max(1, spread)) * 78);
      }
      out.push(Math.max(12, Math.min(100, v)));
    }
    return out;
  }

  async function extractWaveformFromBlob(audioBlob, count) {
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx || !audioBlob) return null;
    var decodeCtx = null;
    try {
      var ab = await audioBlob.arrayBuffer();
      if (!ab || ab.byteLength === 0) return null;
      decodeCtx = new AudioCtx();
      var audioBuf = await decodeCtx.decodeAudioData(ab.slice(0));
      if (!audioBuf || !audioBuf.length) return null;
      var ch = audioBuf.getChannelData(0);
      if (!ch || !ch.length) return null;
      var blockSize = Math.max(1, Math.floor(ch.length / count));
      var rawPeaks = [];
      var maxPeak = 0;
      for (var i = 0; i < count; i++) {
        var bStart = i * blockSize;
        var bEnd = Math.min(ch.length, bStart + blockSize);
        var stride = Math.max(1, Math.floor((bEnd - bStart) / 256));
        var sumSq = 0;
        var pMax = 0;
        var n = 0;
        for (var k = bStart; k < bEnd; k += stride) {
          var s = Math.abs(ch[k]);
          sumSq += s * s;
          if (s > pMax) pMax = s;
          n++;
        }
        var rms = n > 0 ? Math.sqrt(sumSq / n) : 0;
        var val = rms * 0.65 + pMax * 0.35;
        if (val > maxPeak) maxPeak = val;
        rawPeaks.push(val);
      }
      if (maxPeak < 0.002) return null;
      var normOut = [];
      for (var j = 0; j < rawPeaks.length; j++) {
        var ratio = Math.min(1, rawPeaks[j] / maxPeak);
        var bar = Math.round(14 + Math.pow(ratio, 0.72) * 84);
        normOut.push(Math.max(12, Math.min(100, bar)));
      }
      return normOut;
    } catch (e) {
      return null;
    } finally {
      if (decodeCtx) {
        try { decodeCtx.close(); } catch (ce) {}
      }
    }
  }

  function hasDynamicWaveform(samples) {
    if (!samples || samples.length < 4) return false;
    var lo = 100;
    var hi = 0;
    for (var i = 0; i < samples.length; i++) {
      var v = Number(samples[i]) || 0;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    return hi >= 18 && (hi - lo) >= 6;
  }

  function cleanupVoiceHardware() {
    if (voiceRafId) {
      cancelAnimationFrame(voiceRafId);
      voiceRafId = 0;
    }
    if (voiceTimerId) {
      clearInterval(voiceTimerId);
      voiceTimerId = null;
    }
    if (voiceMediaStream) {
      try {
        voiceMediaStream.getTracks().forEach(function(tr) { tr.stop(); });
      } catch (e) {}
      voiceMediaStream = null;
    }
    if (voiceSilentGain) {
      try { voiceSilentGain.disconnect(); } catch (ge) {}
      voiceSilentGain = null;
    }
    if (voiceAudioCtx) {
      try { voiceAudioCtx.close(); } catch (e2) {}
      voiceAudioCtx = null;
    }
    voiceAnalyser = null;
  }

  function enterVoiceLockedMode() {
    voiceLocked = true;
    voiceTapLockWanted = false;
    voicePointerHeld = false;
    voicePointerId = null;
    voiceCancelActive = false;
    if (formEl) {
      formEl.classList.remove('is-voice-cancelling');
      formEl.classList.add('is-voice-locked');
    }
    if (voiceBtn) {
      voiceBtn.innerHTML = state.sendIcon;
      voiceBtn.setAttribute('aria-label', state.sendLabel || state.voiceLabel);
    }
  }

  function resetVoiceUi() {
    voiceRecording = false;
    voiceStarting = false;
    voicePointerHeld = false;
    voiceLocked = false;
    voiceTapLockWanted = false;
    voicePressDownAt = 0;
    voiceCancelActive = false;
    voicePointerId = null;
    if (formEl) formEl.classList.remove('is-recording', 'is-voice-cancelling', 'is-voice-locked');
    if (voiceBtn) {
      voiceBtn.classList.remove('recording');
      if (state.micIcon) voiceBtn.innerHTML = state.micIcon;
      voiceBtn.setAttribute('aria-label', state.voiceLabel);
    }
    if (voiceRecTimer) voiceRecTimer.textContent = '0:00';
    if (voiceRecHint) voiceRecHint.textContent = state.voiceSlideCancel;
    for (var i = 0; i < voiceLiveBarEls.length; i++) {
      voiceLiveLevels[i] = 4;
      voiceLiveBarEls[i].style.height = '4px';
    }
  }

  function abortVoiceRecording() {
    voicePointerHeld = false;
    voiceCancelActive = true;
    var rec = voiceRecorder;
    voiceRecorder = null;
    if (rec && rec.state !== 'inactive') {
      try {
        rec.onstop = null;
        rec.stop();
      } catch (e) {}
    }
    cleanupVoiceHardware();
    resetVoiceUi();
  }

  function pumpVoiceMeter() {
    if (!voiceRecording || !voiceAnalyser) return;
    if (voiceAudioCtx && voiceAudioCtx.state === 'suspended' && typeof voiceAudioCtx.resume === 'function') {
      try { voiceAudioCtx.resume().catch(function() {}); } catch (re) {}
    }
    var buf = new Uint8Array(voiceAnalyser.fftSize);
    voiceAnalyser.getByteTimeDomainData(buf);
    var sumSq = 0;
    var maxAbs = 0;
    for (var i = 0; i < buf.length; i++) {
      var norm = (buf[i] - 128) / 128;
      var absV = Math.abs(norm);
      if (absV > maxAbs) maxAbs = absV;
      sumSq += norm * norm;
    }
    var rms = Math.sqrt(sumSq / buf.length);
    var energy = Math.max(rms * 5.2, maxAbs * 1.45);
    var level = Math.max(8, Math.min(100, Math.round(Math.pow(Math.min(1, energy), 0.7) * 100)));
    if (level > voiceFramePeak) voiceFramePeak = level;
    var now = Date.now();
    if (now - voiceLastSampleAt >= 48) {
      voiceLastSampleAt = now;
      var sampleLevel = voiceFramePeak || level;
      voiceFramePeak = 0;
      voicePeakSamples.push(sampleLevel);
      voiceLiveLevels.shift();
      voiceLiveLevels.push(sampleLevel);
      for (var j = 0; j < voiceLiveBarEls.length; j++) {
        var px = Math.max(4, Math.round((voiceLiveLevels[j] / 100) * 24));
        voiceLiveBarEls[j].style.height = px + 'px';
      }
    }
    voiceRafId = requestAnimationFrame(pumpVoiceMeter);
  }

  async function sendVoiceMessage(audioBlob, durationMs, waveform) {
    if (!audioBlob || audioBlob.size <= 0 || isSending) return;
    if (audioBlob.size > 1536 * 1024) {
      if (window.showAppToast) window.showAppToast(state.voiceTooLarge);
      return;
    }
    isSending = true;
    syncSendState();
    var sentLocalUrl = '';
    try {
      var c = await ensureE2eeReady();
      if (!c) {
        if (window.showAppToast) window.showAppToast(state.networkError);
        return;
      }
      var fileBytes = await audioBlob.arrayBuffer();
      var fileMime = audioBlob.type || 'audio/webm';
      if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        sentLocalUrl = URL.createObjectURL(audioBlob);
      }
      var voiceReplySnap = replyingMsg ? Object.assign({}, replyingMsg) : null;
      var enc;
      try {
        enc = await c.encryptMessage({
          partnerUserId: state.activePartnerId,
          text: '',
          fileBytes: fileBytes,
          fileMime: fileMime,
          mediaKind: 'voice',
          voiceDurationMs: durationMs,
          voiceWaveform: waveform,
          reply: voiceReplySnap
        });
      } catch (encErr) {
        if (sentLocalUrl) { try { URL.revokeObjectURL(sentLocalUrl); } catch (e2) {} }
        if (encErr && encErr.code === 'PARTNER_NOT_READY') {
          if (window.showAppToast) window.showAppToast(state.e2eePartnerNotReady);
          return;
        }
        if (encErr && encErr.code === 'KEY_CHANGED') {
          pendingKeyChange = {
            userId: encErr.userId,
            deviceId: encErr.deviceId,
            identityKey: encErr.identityKey,
            devices: encErr.devices
          };
          showBanner(state.e2eeKeyChanged, true, state.e2eeAcceptNewKey);
          return;
        }
        if (encErr && encErr.code === 'VOICE_TOO_LARGE') {
          if (window.showAppToast) window.showAppToast(state.voiceTooLarge);
          return;
        }
        if (window.showAppToast) window.showAppToast(state.networkError);
        return;
      }
      var fd = new FormData();
      if (state.activeConversationId > 0) fd.append('conversation_id', String(state.activeConversationId));
      else if (state.activePartnerId > 0) fd.append('target_user_id', String(state.activePartnerId));
      fd.append('sender_device_id', String(enc.senderDeviceId));
      fd.append('envelopes', JSON.stringify(enc.envelopes));
      fd.append('encrypted_media', enc.encryptedBlob, 'voice.enc');
      var res = await fetch('/api/messages/send', { method: 'POST', credentials: 'same-origin', body: fd });
      var data = await res.json();
      if (res.ok && data && data.success && data.message) {
        hideBanner();
        if (data.conversation_id) state.activeConversationId = Number(data.conversation_id);
        await c.cacheSentMessage(Number(data.message.id), enc.payload);
        cancelReplyMode();
        appendMessageIfNew(data.message, true, enc.payload, sentLocalUrl);
        updateSidebarPreview(state.activeConversationId, state.currentUserId, '', true, 'voice');
      } else {
        if (sentLocalUrl) { try { URL.revokeObjectURL(sentLocalUrl); } catch (e3) {} }
        if (window.showAppToast) window.showAppToast((data && data.error) || state.networkError);
      }
    } catch (err) {
      if (sentLocalUrl) { try { URL.revokeObjectURL(sentLocalUrl); } catch (e4) {} }
      if (window.showAppToast) window.showAppToast(state.networkError);
    } finally {
      isSending = false;
      syncSendState();
    }
  }

  function finishVoiceRecording(cancelled) {
    if (!voiceRecording) {
      voicePointerHeld = false;
      return;
    }
    var rec = voiceRecorder;
    var elapsedMs = Math.min(VOICE_MAX_MS, Math.max(0, Date.now() - voiceStartedAt));
    var samplesCopy = voicePeakSamples.slice();
    var wasCancelled = Boolean(cancelled || voiceCancelActive);
    voiceRecorder = null;
    cleanupVoiceHardware();
    resetVoiceUi();

    if (!rec) return;
    if (wasCancelled) {
      try {
        rec.onstop = null;
        if (rec.state !== 'inactive') rec.stop();
      } catch (e) {}
      voiceChunks = [];
      return;
    }
    if (elapsedMs < VOICE_MIN_MS) {
      try {
        rec.onstop = null;
        if (rec.state !== 'inactive') rec.stop();
      } catch (e2) {}
      voiceChunks = [];
      if (window.showAppToast) window.showAppToast(state.voiceHoldHint);
      return;
    }
    rec.onstop = async function() {
      var chunks = voiceChunks.slice();
      voiceChunks = [];
      var finalMime = (rec.mimeType || (chunks[0] && chunks[0].type) || 'audio/webm');
      var blob = new Blob(chunks, { type: finalMime });
      var waveform = null;
      if (!hasDynamicWaveform(samplesCopy)) {
        waveform = await extractWaveformFromBlob(blob, VOICE_WAVEFORM_BARS);
      }
      if (!waveform) {
        waveform = downsampleVoiceWaveform(samplesCopy, VOICE_WAVEFORM_BARS);
      }
      sendVoiceMessage(blob, elapsedMs, waveform);
    };
    try {
      if (rec.state !== 'inactive') rec.stop();
    } catch (e3) {
      voiceChunks = [];
    }
  }

  function detectMicPlatform() {
    var ua = navigator.userAgent || '';
    var isIos = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    if (isIos) return 'ios';
    if (/Android/.test(ua)) return 'android';
    var isStandalone = false;
    try {
      isStandalone = Boolean(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    } catch (e) {}
    if (/Firefox\\//.test(ua)) return 'firefox';
    if (/Safari\\//.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|YaBrowser/.test(ua)) return 'safari';
    if (isStandalone) return 'desktopPwa';
    return 'chrome';
  }

  function openMicBlockedModal() {
    if (!micBlockedModal) {
      if (window.showAppToast) window.showAppToast(state.voiceMicDenied);
      return;
    }
    var stepsMap = state.micBlockedSteps || {};
    if (micBlockedStepsEl) {
      micBlockedStepsEl.textContent = stepsMap[detectMicPlatform()] || stepsMap.chrome || state.voiceMicDenied;
    }
    micBlockedModal.classList.add('visible');
  }

  function closeMicBlockedModal() {
    if (micBlockedModal) micBlockedModal.classList.remove('visible');
  }

  if (closeMicBlockedBtn) closeMicBlockedBtn.addEventListener('click', closeMicBlockedModal);
  if (okMicBlockedBtn) okMicBlockedBtn.addEventListener('click', closeMicBlockedModal);
  if (micBlockedModal) {
    micBlockedModal.addEventListener('click', function(e) {
      if (e.target === micBlockedModal) closeMicBlockedModal();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && micBlockedModal.classList.contains('visible')) {
        closeMicBlockedModal();
      }
    });
  }

  async function startVoiceRecording(clientX, pointerId) {
    if (voiceRecording || voiceStarting || isSending) return;
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function' || typeof MediaRecorder === 'undefined') {
      if (window.showAppToast) window.showAppToast(state.voiceUnsupported);
      return;
    }
    stopActiveVoicePlayback();
    voiceStarting = true;
    voicePointerHeld = true;
    voiceLocked = false;
    voiceCancelActive = false;
    voicePointerId = pointerId;
    voiceStartX = clientX;
    if (!voicePressDownAt) voicePressDownAt = Date.now();
    voiceChunks = [];
    voicePeakSamples = [];
    voiceLastSampleAt = 0;
    voiceFramePeak = 0;

    var preAudioCtx = null;
    try {
      var PreAudioCtx = window.AudioContext || window.webkitAudioContext;
      if (PreAudioCtx) {
        preAudioCtx = new PreAudioCtx();
        if (preAudioCtx.state === 'suspended' && typeof preAudioCtx.resume === 'function') {
          preAudioCtx.resume().catch(function() {});
        }
      }
    } catch (pe) {}

    var stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000
        }
      });
    } catch (err) {
      if (preAudioCtx) { try { preAudioCtx.close(); } catch (ce) {} }
      voiceStarting = false;
      voicePointerHeld = false;
      voiceTapLockWanted = false;
      var errName = err && err.name ? String(err.name) : '';
      if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        if (window.showAppToast) window.showAppToast(state.voiceMicDenied);
      } else {
        openMicBlockedModal();
      }
      return;
    }

    if (!voicePointerHeld && !voiceTapLockWanted) {
      if (preAudioCtx) { try { preAudioCtx.close(); } catch (ce2) {} }
      try { stream.getTracks().forEach(function(tr) { tr.stop(); }); } catch (e) {}
      voiceStarting = false;
      if (window.showAppToast) window.showAppToast(state.voiceHoldHint);
      return;
    }

    voiceMediaStream = stream;
    var chosenMime = pickVoiceMimeType();
    var recOpts = { audioBitsPerSecond: 64000 };
    if (chosenMime) recOpts.mimeType = chosenMime;
    try {
      voiceRecorder = new MediaRecorder(stream, recOpts);
    } catch (e2) {
      try {
        voiceRecorder = new MediaRecorder(stream);
      } catch (e3) {
        if (preAudioCtx) { try { preAudioCtx.close(); } catch (ce3) {} }
        cleanupVoiceHardware();
        resetVoiceUi();
        if (window.showAppToast) window.showAppToast(state.voiceUnsupported);
        return;
      }
    }

    voiceRecorder.ondataavailable = function(ev) {
      if (ev && ev.data && ev.data.size > 0) voiceChunks.push(ev.data);
    };

    try {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      voiceAudioCtx = preAudioCtx || (AudioCtx ? new AudioCtx() : null);
      if (voiceAudioCtx) {
        if (voiceAudioCtx.state === 'suspended' && typeof voiceAudioCtx.resume === 'function') {
          voiceAudioCtx.resume().catch(function() {});
        }
        var src = voiceAudioCtx.createMediaStreamSource(stream);
        voiceAnalyser = voiceAudioCtx.createAnalyser();
        voiceAnalyser.fftSize = 256;
        voiceAnalyser.smoothingTimeConstant = 0.45;
        src.connect(voiceAnalyser);
        if (typeof voiceAudioCtx.createGain === 'function' && voiceAudioCtx.destination) {
          voiceSilentGain = voiceAudioCtx.createGain();
          voiceSilentGain.gain.value = 0;
          voiceAnalyser.connect(voiceSilentGain);
          voiceSilentGain.connect(voiceAudioCtx.destination);
        }
      }
    } catch (e4) {}

    voiceStarting = false;
    voiceRecording = true;
    voiceStartedAt = Date.now();
    if (formEl) formEl.classList.add('is-recording');
    if (voiceBtn) voiceBtn.classList.add('recording');
    if (voiceRecTimer) voiceRecTimer.textContent = '0:00';
    if (voiceRecHint) voiceRecHint.textContent = state.voiceSlideCancel;

    try {
      voiceRecorder.start(200);
    } catch (e5) {
      cleanupVoiceHardware();
      resetVoiceUi();
      return;
    }

    voiceTimerId = setInterval(function() {
      if (!voiceRecording) return;
      var elapsed = Date.now() - voiceStartedAt;
      if (voiceRecTimer) voiceRecTimer.textContent = formatVoiceDuration(elapsed);
      if (elapsed >= VOICE_MAX_MS) {
        finishVoiceRecording(false);
      }
    }, 100);
    pumpVoiceMeter();
    if (voiceTapLockWanted) {
      enterVoiceLockedMode();
    }
  }

  if (voiceCancelBtn) {
    voiceCancelBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (voiceRecording || voiceStarting) {
        abortVoiceRecording();
      }
    });
  }

  if (voiceBtn) {
    voiceBtn.addEventListener('contextmenu', function(e) {
      e.preventDefault();
    });
    voiceBtn.addEventListener('pointerdown', function(e) {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      if (voiceRecording && voiceLocked) {
        finishVoiceRecording(false);
        return;
      }
      if (voiceRecording || voiceStarting || isSending) return;
      voicePressDownAt = Date.now();
      voiceTapLockWanted = false;
      try { voiceBtn.setPointerCapture(e.pointerId); } catch (ce) {}
      startVoiceRecording(e.clientX, e.pointerId);
    });
    voiceBtn.addEventListener('pointermove', function(e) {
      if (!voiceRecording || voiceLocked || (voicePointerId !== null && e.pointerId !== voicePointerId)) return;
      var dx = voiceStartX - e.clientX;
      var nextCancel = dx >= VOICE_CANCEL_PX;
      if (nextCancel !== voiceCancelActive) {
        voiceCancelActive = nextCancel;
        if (formEl) {
          if (voiceCancelActive) formEl.classList.add('is-voice-cancelling');
          else formEl.classList.remove('is-voice-cancelling');
        }
        if (voiceRecHint) {
          voiceRecHint.textContent = voiceCancelActive ? state.voiceReleaseCancel : state.voiceSlideCancel;
        }
      }
    });
    function onVoicePointerEnd(e) {
      if (voiceLocked) return;
      if (voicePointerId !== null && e && e.pointerId !== undefined && e.pointerId !== voicePointerId) return;
      var holdMs = voicePressDownAt > 0 ? (Date.now() - voicePressDownAt) : 0;
      if (voiceStarting) {
        voicePointerHeld = false;
        if (holdMs < VOICE_TAP_LOCK_MS) {
          voiceTapLockWanted = true;
        }
        return;
      }
      if (voiceRecording) {
        if (!voiceCancelActive && holdMs < VOICE_TAP_LOCK_MS) {
          enterVoiceLockedMode();
        } else {
          finishVoiceRecording(voiceCancelActive);
        }
      }
    }
    voiceBtn.addEventListener('pointerup', onVoicePointerEnd);
    voiceBtn.addEventListener('pointercancel', function() {
      if (voiceLocked) return;
      if (voiceStarting) {
        voicePointerHeld = false;
        voiceTapLockWanted = false;
        return;
      }
      if (voiceRecording) finishVoiceRecording(true);
    });
  }

  var prevCleanupFn = window.__dmViewportCleanup;
  window.__dmViewportCleanup = function() {
    abortVoiceRecording();
    stopActiveVoicePlayback();
    if (typeof prevCleanupFn === 'function') prevCleanupFn();
  };
  syncSendState();

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
          syncDateSeparators();
          updateSeenUI();
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
    if (msgReplyBtn) {
      var canReplyMsg = !row.querySelector('.dm-msg-decrypt-err');
      msgReplyBtn.style.display = canReplyMsg ? 'flex' : 'none';
    }
    if (msgCopyBtn) {
      var copyTxtEl = row.querySelector('.dm-msg-text:not(.dm-msg-decrypt-err)');
      var canCopyMsg = Boolean(copyTxtEl && copyTxtEl.textContent && copyTxtEl.textContent.trim());
      msgCopyBtn.style.display = canCopyMsg ? 'flex' : 'none';
    }
    if (msgDownloadBtn) {
      var dlImgBtn = row.querySelector('.dm-msg-img-btn[data-dm-lightbox]');
      var canDlImg = Boolean(dlImgBtn && dlImgBtn.getAttribute('data-dm-lightbox'));
      msgDownloadBtn.style.display = canDlImg ? 'flex' : 'none';
    }
    if (msgEditBtn) {
      var rowKindCtx = row.getAttribute('data-msg-kind') || '';
      var canEditMsg = row.classList.contains('mine') && rowKindCtx !== 'voice' && rowKindCtx !== 'post' && !row.querySelector('.dm-msg-decrypt-err');
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

  if (msgReplyBtn) {
    msgReplyBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      var targetId = reactTargetMsgId;
      var targetRow = reactActiveRow;
      closeReactionPicker();
      if (targetId && targetRow) {
        startReplyMode(targetId, targetRow);
      }
    });
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

  if (msgDownloadBtn) {
    msgDownloadBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      var targetId = reactTargetMsgId;
      var targetRow = reactActiveRow;
      closeReactionPicker();
      if (!targetRow) return;
      var dlBtn = targetRow.querySelector('.dm-msg-img-btn[data-dm-lightbox]');
      var imgUrl = dlBtn ? (dlBtn.getAttribute('data-dm-lightbox') || '') : '';
      if (imgUrl && typeof window.downloadPostPhoto === 'function') {
        window.downloadPostPhoto(imgUrl, targetId ? String(targetId) : '', state.activePartnerUsername || 'dm');
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
      var row = e.target && e.target.closest ? e.target.closest('.dm-msg-row[data-msg-id]') : null;
      if (!row || !reactionPicker) return;
      e.preventDefault();
      e.stopPropagation();
      openReactionPicker(row, e.clientX, e.clientY);
    });

    var swipeRow = null;
    var swipeStack = null;
    var swipeHintEl = null;
    var swipeStartX = 0;
    var swipeStartY = 0;
    var swipeLocked = false;
    var swipeCancelled = false;
    var swipeTriggered = false;
    var SWIPE_REPLY_THRESHOLD = 46;
    var SWIPE_REPLY_MAX = 68;

    function findSwipeRowAtTouch(target, clientY) {
      var direct = target && target.closest ? target.closest('.dm-msg-row[data-msg-id]') : null;
      if (direct) return direct;
      if (!listEl || typeof listEl.querySelectorAll !== 'function') return null;
      var rows = listEl.querySelectorAll('.dm-msg-row[data-msg-id]');
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        if (!r || typeof r.getBoundingClientRect !== 'function') continue;
        var rect = r.getBoundingClientRect();
        if (clientY >= rect.top - 3 && clientY <= rect.bottom + 3) {
          return r;
        }
      }
      return null;
    }

    function resetSwipeReply(fireReply) {
      var targetRow = swipeRow;
      var shouldReply = Boolean(fireReply && swipeTriggered && targetRow);
      if (swipeStack) {
        swipeStack.style.transform = '';
      }
      if (swipeHintEl && swipeHintEl.parentNode) {
        swipeHintEl.parentNode.removeChild(swipeHintEl);
      }
      swipeHintEl = null;
      swipeRow = null;
      swipeStack = null;
      swipeLocked = false;
      swipeCancelled = false;
      swipeTriggered = false;
      if (shouldReply) {
        suppressNextMsgClickUntil = Date.now() + 350;
        var rid = parseInt(targetRow.getAttribute('data-msg-id') || '0', 10);
        if (rid) startReplyMode(rid, targetRow);
      }
    }

    var QUICK_HEART_EMOJI = '${ALLOWED_DM_REACTIONS[0]}';
    var lastTapMsgId = 0;
    var lastTapAt = 0;
    var lastTapX = 0;
    var lastTapY = 0;
    var activeTapMsgId = 0;
    var activeTapRow = null;
    var activeTapMoved = false;
    var lastDoubleTapReactAt = 0;

    function isInteractiveMsgTarget(target) {
      if (!target || typeof target.closest !== 'function') return false;
      return Boolean(target.closest('a, button, .dm-reaction-pill, .dm-mention-link, .dm-timecode-btn, .dm-lp-video-trigger, .dm-reply-quote, .dm-voice-play-btn, .dm-voice-wave, .dm-shared-post-card, .dm-msg-img-btn, .dm-load-older-btn'));
    }

    function triggerQuickHeartReaction(row) {
      if (!row) return;
      var msgId = parseInt(row.getAttribute('data-msg-id') || '0', 10);
      if (!msgId) return;
      closeReactionPicker();
      if (navigator.vibrate) {
        try { navigator.vibrate(12); } catch (ve) {}
      }
      toggleMessageReaction(msgId, QUICK_HEART_EMOJI);
    }

    function handleMsgTouchStart(e) {
      if (e.__dmSwipeHandled) return;
      e.__dmSwipeHandled = true;
      if (!e.touches || e.touches.length !== 1) {
        clearMsgLongPressTimer();
        activeTapMsgId = 0;
        activeTapRow = null;
        activeTapMoved = false;
        return;
      }
      if (e.target && e.target.closest && e.target.closest('.dm-reaction-pill, .dm-mention-link, .dm-reply-quote, .dm-load-older-btn')) return;
      var t0 = e.touches[0];
      var bubble = e.target && e.target.closest ? e.target.closest('.dm-msg-bubble') : null;
      var row = findSwipeRowAtTouch(e.target, t0.clientY);
      if (!row) return;
      clearMsgLongPressTimer();
      msgLongPressDidFire = false;
      msgLongPressStartX = t0.clientX;
      msgLongPressStartY = t0.clientY;
      var pickerWasOpen = Boolean(reactionPicker && reactionPicker.classList.contains('visible'));
      if (!pickerWasOpen && !isInteractiveMsgTarget(e.target)) {
        activeTapMsgId = parseInt(row.getAttribute('data-msg-id') || '0', 10) || 0;
        activeTapRow = activeTapMsgId ? row : null;
        activeTapMoved = false;
      } else {
        activeTapMsgId = 0;
        activeTapRow = null;
        activeTapMoved = false;
      }
      resetSwipeReply(false);
      var isCoarseMobile = (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches) || (window.innerWidth || 0) <= 900;
      var onVoiceWave = Boolean(e.target && e.target.closest && e.target.closest('.dm-voice-wave'));
      if (isCoarseMobile && !onVoiceWave && !row.querySelector('.dm-msg-decrypt-err')) {
        swipeRow = row;
        swipeStack = row.querySelector('.dm-msg-stack');
        swipeStartX = t0.clientX;
        swipeStartY = t0.clientY;
        swipeLocked = false;
        swipeCancelled = false;
        swipeTriggered = false;
      }
      if (bubble && reactionPicker) {
        msgLongPressTimer = setTimeout(function() {
          msgLongPressTimer = null;
          if (swipeLocked) return;
          resetSwipeReply(false);
          msgLongPressDidFire = true;
          suppressNextMsgClickUntil = Date.now() + 1000;
          if (navigator.vibrate) {
            try { navigator.vibrate(15); } catch (ve) {}
          }
          openReactionPicker(row, msgLongPressStartX, msgLongPressStartY);
        }, 450);
      }
    }

    function handleMsgTouchMove(e) {
      if (e.__dmSwipeHandled) return;
      e.__dmSwipeHandled = true;
      if (!e.touches || !e.touches.length) return;
      var t0 = e.touches[0];
      if (Math.abs(t0.clientX - msgLongPressStartX) > 12 || Math.abs(t0.clientY - msgLongPressStartY) > 12) {
        activeTapMoved = true;
      }
      if (msgLongPressTimer && (Math.abs(t0.clientX - msgLongPressStartX) > 10 || Math.abs(t0.clientY - msgLongPressStartY) > 10)) {
        clearMsgLongPressTimer();
      }
      if (!swipeRow || !swipeStack || swipeCancelled) return;
      var dx = t0.clientX - swipeStartX;
      var dy = t0.clientY - swipeStartY;
      if (!swipeLocked) {
        if (dx > 8 || (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx) * 0.85)) {
          swipeCancelled = true;
          return;
        }
        if (dx < -14 && Math.abs(dx) > Math.abs(dy) * 1.15) {
          swipeLocked = true;
          clearMsgLongPressTimer();
          swipeHintEl = document.createElement('span');
          swipeHintEl.className = 'dm-swipe-reply-hint';
          swipeHintEl.setAttribute('aria-hidden', 'true');
          swipeHintEl.innerHTML = state.replyArrowIcon || '';
          swipeRow.appendChild(swipeHintEl);
        } else {
          return;
        }
      }
      if (e.cancelable) e.preventDefault();
      var rawDist = Math.max(0, -dx);
      var dist = rawDist <= 54 ? rawDist : 54 + (rawDist - 54) * 0.35;
      if (dist > SWIPE_REPLY_MAX) dist = SWIPE_REPLY_MAX;
      swipeStack.style.transform = 'translate3d(' + (-Math.round(dist)) + 'px, 0, 0)';
      if (swipeHintEl) {
        swipeHintEl.style.opacity = String(Math.min(1, dist / SWIPE_REPLY_THRESHOLD));
        if (dist >= SWIPE_REPLY_THRESHOLD) swipeHintEl.classList.add('is-ready');
        else swipeHintEl.classList.remove('is-ready');
      }
      if (!swipeTriggered && dist >= SWIPE_REPLY_THRESHOLD) {
        swipeTriggered = true;
        if (navigator.vibrate) {
          try { navigator.vibrate(14); } catch (ve2) {}
        }
      } else if (swipeTriggered && dist < SWIPE_REPLY_THRESHOLD - 10) {
        swipeTriggered = false;
      }
    }

    function handleMsgTouchEnd(e) {
      if (e.__dmSwipeHandled) return;
      e.__dmSwipeHandled = true;
      var wasSwipe = Boolean(swipeLocked || swipeTriggered);
      var wasLongPress = Boolean(msgLongPressDidFire);
      var tapId = activeTapMsgId;
      var tapRow = activeTapRow;
      var tapMoved = activeTapMoved;
      activeTapMsgId = 0;
      activeTapRow = null;
      activeTapMoved = false;
      clearMsgLongPressTimer();
      resetSwipeReply(true);
      if (wasLongPress) {
        suppressNextMsgClickUntil = Date.now() + 500;
        msgLongPressDidFire = false;
        lastTapMsgId = 0;
        lastTapAt = 0;
        return;
      }
      if (!wasSwipe && !tapMoved && tapId > 0 && tapRow) {
        var nowTap = Date.now();
        if (lastTapMsgId === tapId && (nowTap - lastTapAt) <= 320 && Math.abs(msgLongPressStartX - lastTapX) <= 36 && Math.abs(msgLongPressStartY - lastTapY) <= 36) {
          lastTapMsgId = 0;
          lastTapAt = 0;
          lastDoubleTapReactAt = nowTap;
          suppressNextMsgClickUntil = nowTap + 400;
          triggerQuickHeartReaction(tapRow);
        } else {
          lastTapMsgId = tapId;
          lastTapAt = nowTap;
          lastTapX = msgLongPressStartX;
          lastTapY = msgLongPressStartY;
        }
      } else {
        lastTapMsgId = 0;
        lastTapAt = 0;
      }
    }

    function handleMsgTouchCancel(e) {
      if (e.__dmSwipeHandled) return;
      e.__dmSwipeHandled = true;
      activeTapMsgId = 0;
      activeTapRow = null;
      activeTapMoved = false;
      lastTapMsgId = 0;
      lastTapAt = 0;
      clearMsgLongPressTimer();
      resetSwipeReply(false);
      msgLongPressDidFire = false;
    }

    listEl.addEventListener('dblclick', function(e) {
      if (Date.now() < suppressNextMsgClickUntil || (Date.now() - lastDoubleTapReactAt) < 600) return;
      if (isInteractiveMsgTarget(e.target)) return;
      var row = e.target && e.target.closest ? e.target.closest('.dm-msg-row[data-msg-id]') : null;
      if (!row) return;
      e.preventDefault();
      if (window.getSelection) {
        try {
          var sel = window.getSelection();
          if (sel && typeof sel.removeAllRanges === 'function') sel.removeAllRanges();
        } catch (se) {}
      }
      triggerQuickHeartReaction(row);
    });

    listEl.addEventListener('touchstart', handleMsgTouchStart, { passive: true });
    listEl.addEventListener('touchmove', handleMsgTouchMove, { passive: false });
    listEl.addEventListener('touchend', handleMsgTouchEnd, { passive: true });
    listEl.addEventListener('touchcancel', handleMsgTouchCancel, { passive: true });
    if (scrollEl && scrollEl !== listEl) {
      scrollEl.addEventListener('touchstart', handleMsgTouchStart, { passive: true });
      scrollEl.addEventListener('touchmove', handleMsgTouchMove, { passive: false });
      scrollEl.addEventListener('touchend', handleMsgTouchEnd, { passive: true });
      scrollEl.addEventListener('touchcancel', handleMsgTouchCancel, { passive: true });
    }

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
      var tcBtn = e.target && e.target.closest ? e.target.closest('.dm-timecode-btn[data-yt-id]') : null;
      if (tcBtn) {
        e.preventDefault();
        e.stopPropagation();
        var tcVid = tcBtn.getAttribute('data-yt-id') || '';
        var tcSec = parseInt(tcBtn.getAttribute('data-yt-start') || '0', 10) || 0;
        var tcTitle = '';
        if (tcVid && listEl) {
          var srcRow = listEl.querySelector('.dm-msg-row[data-yt-video-id="' + tcVid + '"]');
          if (srcRow) tcTitle = srcRow.getAttribute('data-yt-title') || '';
        }
        openDmVideoPlayer(tcVid, tcSec, tcTitle, '');
        return;
      }
      var ytTrigger = e.target && e.target.closest ? e.target.closest('.dm-lp-video-trigger[data-yt-id]') : null;
      if (ytTrigger) {
        e.preventDefault();
        e.stopPropagation();
        openDmVideoPlayer(
          ytTrigger.getAttribute('data-yt-id') || '',
          parseInt(ytTrigger.getAttribute('data-yt-start') || '0', 10) || 0,
          ytTrigger.getAttribute('data-yt-title') || '',
          ytTrigger.getAttribute('data-yt-url') || ''
        );
        return;
      }
      var imgBtn = e.target && e.target.closest ? e.target.closest('[data-dm-lightbox]') : null;
      if (imgBtn && lightbox && lightboxImg) {
        var imgRow = imgBtn.closest ? imgBtn.closest('.dm-msg-row[data-msg-id]') : null;
        activeLightboxMsgId = imgRow ? (imgRow.getAttribute('data-msg-id') || '') : '';
        lightboxImg.src = imgBtn.getAttribute('data-dm-lightbox') || '';
        lightbox.classList.add('visible');
        if (window.__pgPushOverlay) {
          window.__pgPushOverlay('dm-lightbox', function(fromPop) {
            closeDmLightbox(fromPop);
          });
        }
        return;
      }
    });
  }

  var activeLightboxMsgId = '';
  var dmLightboxHoldTimer = null;
  var dmLightboxHoldStartX = 0;
  var dmLightboxHoldStartY = 0;
  var suppressLightboxClickUntil = 0;

  var videoModal = document.getElementById('dmVideoPlayerModal');
  var videoIframe = document.getElementById('dmVideoIframe');
  var videoTitleEl = document.getElementById('dmVideoTitle');
  var videoTimePill = document.getElementById('dmVideoTimePill');
  var videoExtLink = document.getElementById('dmVideoExtLink');
  var videoCloseBtn = document.getElementById('dmVideoCloseBtn');

  function openDmVideoPlayer(videoId, startSec, title, fallbackUrl) {
    if (!videoModal || !videoIframe) return;
    if (!videoId || !YT_ID_CLIENT_RE.test(videoId)) return;
    var sec = Math.max(0, Math.min(86400, Math.floor(Number(startSec) || 0)));
    var embedUrl = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(videoId) + '?autoplay=1&rel=0&modestbranding=1' + (sec > 0 ? ('&start=' + sec) : '');
    var watchUrl = 'https://www.youtube.com/watch?v=' + encodeURIComponent(videoId) + (sec > 0 ? ('&t=' + sec + 's') : '');
    if (videoTitleEl) videoTitleEl.textContent = title || 'YouTube';
    if (videoTimePill) {
      if (sec > 0) {
        videoTimePill.textContent = formatTimecodeSeconds(sec);
        videoTimePill.style.display = 'inline-flex';
      } else {
        videoTimePill.textContent = '';
        videoTimePill.style.display = 'none';
      }
    }
    if (videoExtLink) {
      videoExtLink.setAttribute('href', sanitizeClientHttpUrl(fallbackUrl) && sec === 0 ? sanitizeClientHttpUrl(fallbackUrl) : watchUrl);
    }
    videoIframe.setAttribute('src', embedUrl);
    videoModal.classList.add('visible');
    videoModal.setAttribute('aria-hidden', 'false');
    if (window.__pgPushOverlay) {
      window.__pgPushOverlay('dm-video-player', function(fromPop) {
        closeDmVideoPlayer(fromPop);
      });
    }
  }

  function closeDmVideoPlayer(fromPop) {
    if (!videoModal) return;
    if (videoIframe) videoIframe.setAttribute('src', 'about:blank');
    if (fromPop) {
      videoModal.classList.add('pg-no-transition');
      videoModal.classList.remove('visible');
      void videoModal.offsetWidth;
      videoModal.classList.remove('pg-no-transition');
    } else {
      videoModal.classList.remove('visible');
      if (window.__pgPopOverlay) window.__pgPopOverlay('dm-video-player');
    }
    videoModal.setAttribute('aria-hidden', 'true');
  }

  if (videoModal) {
    if (videoCloseBtn) {
      videoCloseBtn.addEventListener('click', function() {
        closeDmVideoPlayer(false);
      });
    }
    videoModal.addEventListener('click', function(e) {
      if (e.target === videoModal) closeDmVideoPlayer(false);
    });
    function onVideoKeydown(e) {
      if (e.key === 'Escape' && videoModal.classList.contains('visible')) {
        closeDmVideoPlayer(false);
      }
    }
    document.addEventListener('keydown', onVideoKeydown);
    extraCleanups.push(function() {
      document.removeEventListener('keydown', onVideoKeydown);
      if (videoIframe) videoIframe.setAttribute('src', 'about:blank');
    });
  }

  function clearDmLightboxHold() {
    if (dmLightboxHoldTimer) {
      clearTimeout(dmLightboxHoldTimer);
      dmLightboxHoldTimer = null;
    }
  }

  function openDmLightboxDownloadMenu() {
    if (!lightbox || !lightbox.classList.contains('visible') || !lightboxImg) return;
    var curSrc = lightboxImg.getAttribute('src') || lightboxImg.src || '';
    if (!curSrc || typeof window.openPostOptionsMenu !== 'function') return;
    window.openPostOptionsMenu({
      img: curSrc,
      postId: activeLightboxMsgId || '',
      username: state.activePartnerUsername || 'dm'
    });
  }

  function closeDmLightbox(fromPop) {
    clearDmLightboxHold();
    if (!lightbox) return;
    if (fromPop) {
      lightbox.classList.add('pg-no-transition');
      lightbox.classList.remove('visible');
      void lightbox.offsetWidth;
      lightbox.classList.remove('pg-no-transition');
    } else {
      lightbox.classList.remove('visible');
      if (window.__pgPopOverlay) window.__pgPopOverlay('dm-lightbox');
    }
  }

  if (lightbox) {
    if (lightboxCloseBtn) {
      lightboxCloseBtn.addEventListener('click', function() {
        closeDmLightbox(false);
      });
    }
    if (lightboxImg) {
      lightbox.addEventListener('contextmenu', function(e) {
        if (e.target && e.target.closest && e.target.closest('.dm-lightbox-close')) return;
        e.preventDefault();
        e.stopPropagation();
        openDmLightboxDownloadMenu();
      });
      lightboxImg.addEventListener('mousedown', function(e) {
        if (e.button !== 0) return;
        clearDmLightboxHold();
        dmLightboxHoldStartX = e.clientX;
        dmLightboxHoldStartY = e.clientY;
        dmLightboxHoldTimer = setTimeout(function() {
          dmLightboxHoldTimer = null;
          suppressLightboxClickUntil = Date.now() + 450;
          openDmLightboxDownloadMenu();
        }, 450);
      });
      lightboxImg.addEventListener('mousemove', function(e) {
        if (!dmLightboxHoldTimer) return;
        if (Math.abs(e.clientX - dmLightboxHoldStartX) > 10 || Math.abs(e.clientY - dmLightboxHoldStartY) > 10) {
          clearDmLightboxHold();
        }
      });
      lightboxImg.addEventListener('mouseup', clearDmLightboxHold);
      lightboxImg.addEventListener('mouseleave', clearDmLightboxHold);
      lightboxImg.addEventListener('touchstart', function(e) {
        if (!e.touches || e.touches.length !== 1) return;
        clearDmLightboxHold();
        dmLightboxHoldStartX = e.touches[0].clientX;
        dmLightboxHoldStartY = e.touches[0].clientY;
        dmLightboxHoldTimer = setTimeout(function() {
          dmLightboxHoldTimer = null;
          suppressLightboxClickUntil = Date.now() + 450;
          try { if (navigator.vibrate) navigator.vibrate(15); } catch (ve) {}
          openDmLightboxDownloadMenu();
        }, 400);
      }, { passive: true });
      lightboxImg.addEventListener('touchmove', function(e) {
        if (!dmLightboxHoldTimer || !e.touches || e.touches.length !== 1) return;
        var dx = Math.abs(e.touches[0].clientX - dmLightboxHoldStartX);
        var dy = Math.abs(e.touches[0].clientY - dmLightboxHoldStartY);
        if (dx > 12 || dy > 12) clearDmLightboxHold();
      }, { passive: true });
      lightboxImg.addEventListener('touchend', clearDmLightboxHold, { passive: true });
      lightboxImg.addEventListener('touchcancel', clearDmLightboxHold, { passive: true });
    }
    lightbox.addEventListener('click', function(e) {
      if (Date.now() < suppressLightboxClickUntil) return;
      if (e.target === lightbox) closeDmLightbox(false);
    });
    function onLightboxKeydown(e) {
      if (e.key === 'Escape' && lightbox.classList.contains('visible')) {
        var postMenu = document.getElementById('appPostMenuModal');
        if (postMenu && postMenu.classList.contains('visible')) return;
        closeDmLightbox(false);
      }
    }
    document.addEventListener('keydown', onLightboxKeydown);
    extraCleanups.push(function() {
      clearDmLightboxHold();
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
              dec ? Boolean(dec.media || dec.sharedPost) : Boolean(m.image_key),
              dec && dec.sharedPost ? 'post' : (dec && dec.media && dec.media.kind ? dec.media.kind : '')
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
            eRow.setAttribute('data-image-key', em.image_key || '');
            eRow.setAttribute('data-encrypted', em.is_encrypted ? '1' : '0');
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
        if (Array.isArray(d.listened_message_ids) && d.listened_message_ids.length > 0 && listEl) {
          for (var li = 0; li < d.listened_message_ids.length; li++) {
            var lId = Number(d.listened_message_ids[li]);
            if (!lId) continue;
            var lRow = listEl.querySelector('.dm-msg-row[data-msg-id="' + String(lId) + '"]');
            if (lRow && lRow.getAttribute('data-listened') !== '1') {
              lRow.setAttribute('data-listened', '1');
              var lDot = lRow.querySelector('.dm-voice-unheard-dot');
              if (lDot && lDot.parentNode) lDot.parentNode.removeChild(lDot);
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
    var isLastRead = Boolean(c.last_message_read);
    var prefix = isMine ? state.youPrefix : '';
    var a = document.createElement('a');
    a.setAttribute('href', '/messages/' + encodeURIComponent(c.other_username || ''));
    a.className = 'dm-conv-item' + (isCurrent ? ' active' : '') + (isUnread ? ' unread' : '');
    a.setAttribute('data-conv-id', String(c.id));
    a.setAttribute('data-partner-id', String(c.other_user_id || 0));
    a.setAttribute('data-partner-username', String(c.other_username || ''));
    a.setAttribute('data-partner-display', String(c.other_display_name || c.other_username || ''));
    a.setAttribute('data-partner-avatar', String(c.other_avatar_key || ''));
    a.setAttribute('data-partner-verified', c.other_is_verified ? '1' : '0');
    a.setAttribute('data-last-msg-id', String(c.last_message_id || 0));
    a.setAttribute('data-last-encrypted', c.last_message_encrypted ? '1' : '0');
    a.setAttribute('data-last-mine', isMine ? '1' : '0');
    a.setAttribute('data-last-read', isLastRead ? '1' : '0');
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
    var topRight = document.createElement('span');
    topRight.className = 'dm-conv-top-right';
    if (isMine && Number(c.last_message_id || 0) > 0) {
      var chkSpan = document.createElement('span');
      chkSpan.className = 'dm-conv-check';
      setStatusCheckIcon(chkSpan, isLastRead);
      topRight.appendChild(chkSpan);
    }
    var timeSpan = document.createElement('span');
    timeSpan.className = 'dm-conv-time';
    timeSpan.textContent = formatDmShortTimeClient(c.last_message_at || '');
    topRight.appendChild(timeSpan);
    topDiv.appendChild(nameSpan);
    topDiv.appendChild(topRight);
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
        setConvItemCheck(item, isMine, Boolean(c.last_message_read));

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

  function stopDmFallbackPolling() {
    if (window.__dmPollTimer) {
      clearInterval(window.__dmPollTimer);
      window.__dmPollTimer = null;
    }
    if (window.__dmConvPollTimer) {
      clearInterval(window.__dmConvPollTimer);
      window.__dmConvPollTimer = null;
    }
  }

  function startDmFallbackPolling() {
    if (state.activeConversationId > 0 && !window.__dmPollTimer) {
      window.__dmPollTimer = setInterval(pollActiveChat, 10000);
    }
    if (convListEl && !window.__dmConvPollTimer) {
      window.__dmConvPollTimer = setInterval(pollConversationList, 12000);
    }
  }

  function markActiveChatReadAsync(convId) {
    if (!convId || document.visibilityState !== 'visible') return;
    fetch('/api/messages/read', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: convId })
    })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(d) {
        if (d && typeof d.unread_total === 'number' && window.updateUnreadMessagesBadge) {
          window.updateUnreadMessagesBadge(d.unread_total);
        }
        if (d && typeof d.last_read_own_id === 'number' && convId === Number(state.activeConversationId) && d.last_read_own_id > state.lastReadOwnId) {
          state.lastReadOwnId = d.last_read_own_id;
          updateSeenUI();
        }
      })
      .catch(function() {});
  }

  async function handleRealtimeDmEvent(ev) {
    if (!ev || typeof ev.type !== 'string') return;

    if (ev.type === '__connected') {
      stopDmFallbackPolling();
      return;
    }
    if (ev.type === '__reconnected') {
      stopDmFallbackPolling();
      if (state.activeConversationId > 0) pollActiveChat();
      pollConversationList();
      return;
    }
    if (ev.type === '__disconnected_fallback') {
      startDmFallbackPolling();
      return;
    }

    if (ev.type === 'typing.start') {
      if (Number(ev.conversation_id) === Number(state.activeConversationId) && Number(ev.user_id) !== Number(state.currentUserId)) {
        showPartnerTyping();
      }
      return;
    }
    if (ev.type === 'typing.stop') {
      if (Number(ev.conversation_id) === Number(state.activeConversationId) && Number(ev.user_id) !== Number(state.currentUserId)) {
        clearPartnerTyping();
      }
      return;
    }

    if (ev.type === 'message.read') {
      var readConvId = Number(ev.conversation_id || 0);
      var nextRead = Number(ev.last_read_id || 0);
      if (Number(ev.reader_id) !== Number(state.currentUserId)) {
        if (readConvId === Number(state.activeConversationId) && nextRead > state.lastReadOwnId) {
          state.lastReadOwnId = nextRead;
          updateSeenUI();
        } else if (readConvId > 0 && threadFragCache[readConvId] && nextRead > Number(threadFragCache[readConvId].lastReadOwnId || 0)) {
          threadFragCache[readConvId].lastReadOwnId = nextRead;
        }
        if (convListEl && readConvId > 0 && nextRead > 0) {
          var rConvItem = convListEl.querySelector('.dm-conv-item[data-conv-id="' + readConvId + '"]');
          if (rConvItem && rConvItem.getAttribute('data-last-mine') === '1') {
            var rLastId = parseInt(rConvItem.getAttribute('data-last-msg-id') || '0', 10);
            if (rLastId > 0 && nextRead >= rLastId) {
              setConvItemCheck(rConvItem, true, true);
            }
          }
        }
      }
      return;
    }

    if (ev.type === 'message.listened') {
      if (Number(ev.conversation_id) === Number(state.activeConversationId) && listEl && ev.message_id) {
        var lRow = listEl.querySelector('.dm-msg-row[data-msg-id="' + String(ev.message_id) + '"]');
        if (lRow) {
          lRow.setAttribute('data-listened', '1');
          var lDot = lRow.querySelector('.dm-voice-unheard-dot');
          if (lDot && lDot.parentNode) lDot.parentNode.removeChild(lDot);
        }
      }
      return;
    }

    if (ev.type === 'message.reaction') {
      if (Number(ev.conversation_id) === Number(state.activeConversationId) && listEl && ev.message_id) {
        var rMid = String(ev.message_id);
        if (!reactingMsgIds[rMid]) {
          var rRow = listEl.querySelector('.dm-msg-row[data-msg-id="' + rMid + '"]');
          if (rRow) renderMessageReactions(rRow, Array.isArray(ev.reactions) ? ev.reactions : []);
        }
      }
      return;
    }

    if (ev.type === 'conversation.deleted') {
      var delConvId = Number(ev.conversation_id || 0);
      if (!delConvId) return;
      if (convListEl) {
        var removedConvEl = convListEl.querySelector('.dm-conv-item[data-conv-id="' + delConvId + '"]');
        if (removedConvEl) removedConvEl.remove();
        renderEmptyConvListIfNeeded();
      }
      if (delConvId === Number(state.activeConversationId)) {
        clearPartnerTyping();
        sendStopTypingNow();
        state.activeConversationId = 0;
        if (e2eeClient && typeof e2eeClient.revokeAllMediaUrls === 'function') {
          try { e2eeClient.revokeAllMediaUrls(); } catch (re) {}
        }
        if (window.spaNavigate) window.spaNavigate('/messages');
        else window.location.href = '/messages';
      }
      return;
    }

    if (ev.type === 'message.deleted') {
      var dConvId = Number(ev.conversation_id || 0);
      var dMsgId = Number(ev.message_id || 0);
      if (!dMsgId) return;
      if (dConvId === Number(state.activeConversationId) && listEl) {
        var delRow = listEl.querySelector('.dm-msg-row[data-msg-id="' + dMsgId + '"]');
        if (delRow) {
          if (editingMsg && Number(editingMsg.id) === dMsgId) cancelEditMode();
          delRow.remove();
          syncAfterMsgRemoval();
          if (e2eeClient && typeof e2eeClient.clearCachedMessages === 'function') {
            try { await e2eeClient.clearCachedMessages([dMsgId]); } catch (dce) {}
          }
        }
      }
      if (convListEl && dConvId > 0) {
        var dItem = convListEl.querySelector('.dm-conv-item[data-conv-id="' + dConvId + '"]');
        if (dItem && parseInt(dItem.getAttribute('data-last-msg-id') || '0', 10) === dMsgId) {
          pollConversationList();
        }
      }
      return;
    }

    if (ev.type === 'message.edited' && ev.message) {
      var em = ev.message;
      var eConvId = Number(ev.conversation_id || em.conversation_id || 0);
      var srvVer = Number(em.edit_version || 0);
      var decEdit = null;
      if (em.is_encrypted) {
        var cEdit = await ensureE2eeReady();
        if (cEdit) {
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
          }
        }
      }
      if (eConvId === Number(state.activeConversationId) && listEl) {
        var eRow = listEl.querySelector('.dm-msg-row[data-msg-id="' + em.id + '"]');
        if (eRow) {
          var curVer = parseInt(eRow.getAttribute('data-edit-version') || '0', 10);
          if (srvVer > curVer) {
            eRow.setAttribute('data-edit-version', String(srvVer));
            eRow.setAttribute('data-image-key', em.image_key || '');
            eRow.setAttribute('data-encrypted', em.is_encrypted ? '1' : '0');
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
          }
        }
      }
      if (convListEl && eConvId > 0) {
        var eItem = convListEl.querySelector('.dm-conv-item[data-conv-id="' + eConvId + '"]');
        if (eItem && parseInt(eItem.getAttribute('data-last-msg-id') || '0', 10) === Number(em.id)) {
          eItem.setAttribute('data-last-edit-version', String(srvVer));
          if (em.is_encrypted && em.ciphertext_envelope) {
            convEncryptedMeta[String(eConvId)] = {
              id: Number(em.id),
              sender_id: Number(em.sender_id || 0),
              sender_device_id: Number(em.sender_device_id || 0),
              is_encrypted: 1,
              ciphertext_envelope: em.ciphertext_envelope,
              edit_version: srvVer
            };
          }
          if (decEdit || !em.is_encrypted) {
            var ePrevEl = eItem.querySelector('.dm-conv-preview');
            if (ePrevEl) {
              var ePrefix = Number(em.sender_id) === Number(state.currentUserId) ? state.youPrefix : '';
              var eTxt = cleanPreviewText(decEdit ? decEdit.text : (em.body || ''));
              var eHasImg = decEdit ? Boolean(decEdit.media) : Boolean(em.image_key);
              ePrevEl.textContent = eTxt ? (ePrefix + eTxt) : (eHasImg ? (ePrefix + state.photoLabel) : (ePrefix + state.encryptedPreview));
              eItem.setAttribute('data-preview-hydrated', Number(em.id) + ':' + srvVer);
            }
          } else {
            eItem.removeAttribute('data-preview-hydrated');
            hydrateSidebarEncryptedPreviews();
          }
        }
      }
      return;
    }

    if (ev.type === 'message.new' && ev.message) {
      var m = ev.message;
      var mConvId = Number(ev.conversation_id || m.conversation_id || 0);
      var isFromPartnerForBlankActive =
        state.activeConversationId === 0 &&
        state.activePartnerId > 0 &&
        ev.sender &&
        Number(ev.sender.id) === Number(state.activePartnerId);
      if (isFromPartnerForBlankActive && mConvId > 0) {
        state.activeConversationId = mConvId;
      }

      var isForActive = mConvId > 0 && mConvId === Number(state.activeConversationId);
      var isMine = Number(m.sender_id) === Number(state.currentUserId);
      var dec = null;
      if (m.is_encrypted) {
        var cNew = await ensureE2eeReady();
        if (cNew) {
          var rDec = await cNew.decryptMessage(m);
          if (rDec.ok && rDec.payload) {
            dec = rDec.payload;
          } else if (rDec && rDec.reason === 'KEY_CHANGED' && rDec.userId && rDec.deviceId) {
            pendingKeyChange = {
              userId: rDec.userId,
              deviceId: rDec.deviceId,
              identityKey: rDec.identityKey || '',
              retryAction: 'decrypt'
            };
            showBanner(state.e2eeKeyChanged, true, state.e2eeAcceptNewKey);
          }
        }
      }

      if (isForActive) {
        if (!isMine) clearPartnerTyping();
        var nearBottom = !scrollEl || (scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 140);
        appendMessageIfNew(m, nearBottom, dec, '');
        if (!isMine && document.visibilityState === 'visible') {
          markActiveChatReadAsync(mConvId);
        }
      }

      if (convListEl && mConvId > 0) {
        var item = convListEl.querySelector('.dm-conv-item[data-conv-id="' + mConvId + '"]');
        if (item) {
          item.setAttribute('data-last-msg-id', String(m.id));
          item.setAttribute('data-last-encrypted', m.is_encrypted ? '1' : '0');
          item.setAttribute('data-last-mine', isMine ? '1' : '0');
          item.setAttribute('data-last-edit-version', String(Number(m.edit_version || 0)));
          if (m.is_encrypted && m.ciphertext_envelope) {
            convEncryptedMeta[String(mConvId)] = {
              id: Number(m.id),
              sender_id: Number(m.sender_id || 0),
              sender_device_id: Number(m.sender_device_id || 0),
              is_encrypted: 1,
              ciphertext_envelope: m.ciphertext_envelope,
              edit_version: Number(m.edit_version || 0)
            };
          }
          var cleanTxt = cleanPreviewText(dec ? dec.text : (m.is_encrypted ? '' : (m.body || '')));
          var hasImg = dec ? Boolean(dec.media || dec.sharedPost) : Boolean(m.image_key);
          var mKind = (dec && dec.sharedPost) ? 'post' : ((dec && dec.media && dec.media.kind) ? dec.media.kind : '');
          updateSidebarPreview(mConvId, m.sender_id, cleanTxt, hasImg, mKind);
          if (dec || !m.is_encrypted) {
            item.setAttribute('data-preview-hydrated', Number(m.id) + ':' + Number(m.edit_version || 0));
          }
          if (!isForActive && !isMine) {
            item.classList.add('unread');
            var botEl = item.querySelector('.dm-conv-bottom');
            var dotEl = item.querySelector('.dm-conv-unread');
            var curCnt = dotEl ? (parseInt(dotEl.textContent || '0', 10) || 0) : 0;
            var nextCnt = curCnt + 1;
            var badgeTxt = nextCnt > 99 ? '99+' : String(nextCnt);
            if (dotEl) {
              dotEl.textContent = badgeTxt;
            } else if (botEl) {
              dotEl = document.createElement('span');
              dotEl.className = 'dm-conv-unread';
              dotEl.textContent = badgeTxt;
              botEl.appendChild(dotEl);
            }
          }
        } else {
          pollConversationList();
        }
      }
      if (typeof ev.unread_total === 'number' && window.updateUnreadMessagesBadge && !isForActive) {
        window.updateUnreadMessagesBadge(ev.unread_total);
      }
    }
  }

  function onDmVisibilityChange() {
    if (document.visibilityState === 'visible') {
      if (micBlockedModal && micBlockedModal.classList.contains('visible') && navigator.permissions && typeof navigator.permissions.query === 'function') {
        navigator.permissions.query({ name: 'microphone' }).then(function(st) {
          if (st && st.state === 'granted') closeMicBlockedModal();
        }).catch(function() {});
      }
      var wsConnected = Boolean(window.PhotogramRealtime && window.PhotogramRealtime.isConnected());
      if (!wsConnected) {
        if (window.PhotogramRealtime) window.PhotogramRealtime.ensureConnected();
        if (state.activeConversationId > 0) pollActiveChat();
        pollConversationList();
      } else if (state.activeConversationId > 0) {
        markActiveChatReadAsync(state.activeConversationId);
      }
    }
  }
  document.addEventListener('visibilitychange', onDmVisibilityChange);

  var unsubRealtime = window.PhotogramRealtime
    ? window.PhotogramRealtime.on(handleRealtimeDmEvent)
    : null;

  var dmPageLayoutEl = document.querySelector('.dm-page-layout');
  var dmShellEl = document.querySelector('.dm-shell');
  var dmActiveWrapEl = document.getElementById('dmActiveThreadWrap');
  var dmEmptyWrapEl = document.getElementById('dmThreadEmptyWrap');
  var dmThreadBackBtn = document.getElementById('dmThreadBackBtn');
  var dmThreadPartnerLink = document.getElementById('dmThreadPartnerLink');
  var dmThreadAvatarEl = document.getElementById('dmThreadAvatar');
  var dmThreadUsernameEl = document.getElementById('dmThreadUsername');
  var dmThreadSubtitleEl = document.getElementById('dmThreadSubtitle');
  var threadFragCache = {};
  var dmSwitchSeq = 0;
  var dmSwitchAbort = null;

  function saveCurrentThreadToCache() {
    var curCid = Number(state.activeConversationId || 0);
    if (!curCid || !listEl) return;
    if (listEl.querySelector('.dm-thread-loading')) return;
    var frag = document.createDocumentFragment();
    while (listEl.firstChild) {
      frag.appendChild(listEl.firstChild);
    }
    threadFragCache[curCid] = {
      frag: frag,
      lastMsgId: Number(state.lastMsgId || 0),
      oldestMsgId: Number(state.oldestMsgId || 0),
      lastReadOwnId: Number(state.lastReadOwnId || 0),
      hasMore: Boolean(loadOlderBtn && loadOlderBtn.style.display !== 'none'),
      savedAt: Date.now()
    };
  }

  function renderPartnerHeader(partner) {
    if (dmThreadPartnerLink) {
      dmThreadPartnerLink.setAttribute('href', '/u/' + encodeURIComponent(partner.username || ''));
    }
    if (dmThreadAvatarEl) {
      while (dmThreadAvatarEl.firstChild) dmThreadAvatarEl.removeChild(dmThreadAvatarEl.firstChild);
      var avKey = String(partner.avatarKey || '').trim();
      if (avKey && avKey.indexOf('..') === -1 && avKey.indexOf('\\\\') === -1) {
        var avImg = document.createElement('img');
        avImg.src = '/media/' + encodeURIComponent(avKey);
        avImg.alt = partner.username || '';
        dmThreadAvatarEl.appendChild(avImg);
      } else {
        var avSpan = document.createElement('span');
        avSpan.textContent = String(partner.displayName || partner.username || '?').charAt(0).toUpperCase();
        dmThreadAvatarEl.appendChild(avSpan);
      }
    }
    if (dmThreadUsernameEl) {
      while (dmThreadUsernameEl.firstChild) dmThreadUsernameEl.removeChild(dmThreadUsernameEl.firstChild);
      dmThreadUsernameEl.appendChild(document.createTextNode(partner.username || ''));
      if (partner.isVerified && typeof window.renderVerifiedBadge === 'function') {
        var vWrap = document.createElement('span');
        vWrap.innerHTML = window.renderVerifiedBadge(13.5);
        if (vWrap.firstChild) dmThreadUsernameEl.appendChild(vWrap.firstChild);
      }
    }
    if (dmThreadSubtitleEl) {
      var defText = partner.displayName || partner.username || '';
      dmThreadSubtitleEl.setAttribute('data-default-text', defText);
      dmThreadSubtitleEl.textContent = defText;
      dmThreadSubtitleEl.classList.remove('is-typing');
    }
  }

  function closeConversationToList(pushHist) {
    dmSwitchSeq++;
    if (dmSwitchAbort) {
      try { dmSwitchAbort.abort(); } catch (e) {}
      dmSwitchAbort = null;
    }
    if (voiceRecording || voiceStarting) abortVoiceRecording();
    if (typeof stopActiveVoicePlayback === 'function') stopActiveVoicePlayback();
    clearPartnerTyping();
    sendStopTypingNow();
    cancelReplyMode();
    cancelEditMode();
    clearPendingFile();
    hideBanner();
    saveCurrentThreadToCache();
    state.activeConversationId = 0;
    state.activePartnerId = 0;
    state.activePartnerUsername = '';
    state.lastMsgId = 0;
    state.oldestMsgId = 0;
    state.lastReadOwnId = 0;
    if (dmActiveWrapEl) dmActiveWrapEl.style.display = 'none';
    if (dmEmptyWrapEl) dmEmptyWrapEl.style.display = '';
    if (dmPageLayoutEl) dmPageLayoutEl.classList.remove('dm-mobile-in-chat');
    if (dmShellEl) dmShellEl.classList.remove('has-active-chat');
    document.documentElement.classList.remove('dm-lock-scroll');
    document.body.classList.remove('dm-lock-scroll');
    if (convListEl) {
      convListEl.querySelectorAll('.dm-conv-item.active').forEach(function(el) {
        el.classList.remove('active');
      });
    }
    if (pushHist) {
      try {
        history.pushState({ spa: true, dmInPlace: true }, '', '/messages');
      } catch (e) {}
    }
  }

  async function openConversationInPlace(partner, pushHist) {
    if (!partner || !partner.convId || !partner.username) return false;
    var targetConvId = Number(partner.convId);
    if (targetConvId === Number(state.activeConversationId || 0) && dmActiveWrapEl && dmActiveWrapEl.style.display !== 'none') {
      if (dmPageLayoutEl) dmPageLayoutEl.classList.add('dm-mobile-in-chat');
      if (dmShellEl) dmShellEl.classList.add('has-active-chat');
      return true;
    }

    var mySeq = ++dmSwitchSeq;
    if (dmSwitchAbort) {
      try { dmSwitchAbort.abort(); } catch (e) {}
    }
    dmSwitchAbort = typeof AbortController !== 'undefined' ? new AbortController() : null;

    if (voiceRecording || voiceStarting) abortVoiceRecording();
    if (typeof stopActiveVoicePlayback === 'function') stopActiveVoicePlayback();
    clearPartnerTyping();
    sendStopTypingNow();
    cancelReplyMode();
    cancelEditMode();
    clearPendingFile();
    hideBanner();
    if (inputEl) inputEl.value = '';
    syncSendState();

    saveCurrentThreadToCache();

    state.activeConversationId = targetConvId;
    state.activePartnerId = Number(partner.partnerId || 0);
    state.activePartnerUsername = String(partner.username || '');
    if (state.activePartnerUsername) {
      mentionLookupCache[state.activePartnerUsername.toLowerCase()] = true;
    }

    renderPartnerHeader(partner);
    if (dmEmptyWrapEl) dmEmptyWrapEl.style.display = 'none';
    if (dmActiveWrapEl) dmActiveWrapEl.style.display = '';
    if (dmPageLayoutEl) dmPageLayoutEl.classList.add('dm-mobile-in-chat');
    if (dmShellEl) dmShellEl.classList.add('has-active-chat');
    if (window.innerWidth <= 768) {
      document.documentElement.classList.add('dm-lock-scroll');
      document.body.classList.add('dm-lock-scroll');
    }

    if (convListEl) {
      convListEl.querySelectorAll('.dm-conv-item').forEach(function(el) {
        var cid = parseInt(el.getAttribute('data-conv-id') || '0', 10);
        if (cid === targetConvId) {
          el.classList.add('active');
          el.classList.remove('unread');
          var dot = el.querySelector('.dm-conv-unread');
          if (dot) dot.remove();
        } else {
          el.classList.remove('active');
        }
      });
    }

    var nextPath = '/messages/' + encodeURIComponent(partner.username);
    if (pushHist) {
      try {
        history.pushState({ spa: true, dmInPlace: true }, '', nextPath);
      } catch (e) {}
    }

    var cached = threadFragCache[targetConvId];
    if (cached && listEl) {
      delete threadFragCache[targetConvId];
      while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
      listEl.appendChild(cached.frag);
      state.lastMsgId = cached.lastMsgId;
      state.oldestMsgId = cached.oldestMsgId;
      state.lastReadOwnId = cached.lastReadOwnId;
      if (loadOlderBtn) loadOlderBtn.style.display = cached.hasMore ? '' : 'none';
      updateSeenUI();
      if (scrollEl) scrollToBottom();
      markActiveChatReadAsync(targetConvId);
      pollActiveChat();
      return true;
    }

    state.lastMsgId = 0;
    state.oldestMsgId = 0;
    state.lastReadOwnId = 0;
    if (loadOlderBtn) loadOlderBtn.style.display = 'none';
    if (listEl) {
      while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
      var ld = document.createElement('div');
      ld.className = 'dm-no-msgs dm-thread-loading';
      ld.textContent = state.e2eeInitializing || '';
      listEl.appendChild(ld);
    }

    try {
      var listRes = await fetch(
        '/api/messages/list?conversation_id=' + encodeURIComponent(String(targetConvId)) + '&mark_read=1',
        {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: dmSwitchAbort ? dmSwitchAbort.signal : undefined
        }
      );
      if (mySeq !== dmSwitchSeq) return false;
      var data = await listRes.json();
      if (mySeq !== dmSwitchSeq) return false;
      if (!listRes.ok || !data || !Array.isArray(data.messages)) {
        if (listEl) while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
        return false;
      }

      var msgs = data.messages;
      var c = await ensureE2eeReady();
      if (mySeq !== dmSwitchSeq) return false;

      var encIds = [];
      for (var ei = 0; ei < msgs.length; ei++) {
        if (msgs[ei].is_encrypted && Number(msgs[ei].id || 0) > 0) {
          encIds.push(Number(msgs[ei].id));
        }
      }
      var cachedMap = (c && encIds.length > 0 && typeof c.getCachedMessagesBatch === 'function')
        ? await c.getCachedMessagesBatch(encIds)
        : new Map();
      if (mySeq !== dmSwitchSeq) return false;

      var frag = document.createDocumentFragment();
      var maxId = 0;
      var minId = 0;
      for (var mi = 0; mi < msgs.length; mi++) {
        var m = msgs[mi];
        var mId = Number(m.id || 0);
        if (mId > maxId) maxId = mId;
        if (mId > 0 && (minId === 0 || mId < minId)) minId = mId;
        var decPayload = null;
        if (m.is_encrypted && c) {
          var mVer = Math.max(0, Number(m.edit_version || 0));
          var hit = cachedMap.get(mId);
          if (hit && Number(hit.editVersion || 0) >= mVer) {
            decPayload = hit;
          } else {
            var decRes = await c.decryptMessage(m);
            if (mySeq !== dmSwitchSeq) return false;
            if (decRes && decRes.ok && decRes.payload) {
              decPayload = decRes.payload;
            }
          }
        }
        frag.appendChild(buildMessageRowEl(m, decPayload, ''));
      }

      if (mySeq !== dmSwitchSeq) return false;
      if (listEl) {
        while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
        if (msgs.length === 0) {
          var emptyDiv = document.createElement('div');
          emptyDiv.className = 'dm-no-msgs';
          emptyDiv.id = 'dmNoMsgs';
          emptyDiv.textContent = state.noMessagesYet;
          listEl.appendChild(emptyDiv);
        } else {
          listEl.appendChild(frag);
          syncDateSeparators();
        }
      }
      state.lastMsgId = maxId;
      state.oldestMsgId = minId;
      state.lastReadOwnId = Number(data.last_read_own_id || 0);
      if (loadOlderBtn) loadOlderBtn.style.display = data.has_more ? '' : 'none';
      updateSeenUI();
      if (scrollEl) {
        scrollToBottom();
        setTimeout(scrollToBottom, 50);
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function extractPartnerFromConvEl(el) {
    if (!el) return null;
    var cid = parseInt(el.getAttribute('data-conv-id') || '0', 10);
    var pid = parseInt(el.getAttribute('data-partner-id') || '0', 10);
    var uname = el.getAttribute('data-partner-username') || '';
    if (!cid || !uname) return null;
    return {
      convId: cid,
      partnerId: pid,
      username: uname,
      displayName: el.getAttribute('data-partner-display') || uname,
      avatarKey: el.getAttribute('data-partner-avatar') || '',
      isVerified: el.getAttribute('data-partner-verified') === '1'
    };
  }

  if (convListEl) {
    convListEl.addEventListener('click', function(e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      var item = e.target && e.target.closest ? e.target.closest('.dm-conv-item[data-conv-id]') : null;
      if (!item) return;
      var partner = extractPartnerFromConvEl(item);
      if (!partner) return;
      e.preventDefault();
      e.stopPropagation();
      openConversationInPlace(partner, true);
    });
  }

  if (dmThreadBackBtn) {
    dmThreadBackBtn.addEventListener('click', function(e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      closeConversationToList(true);
    });
  }

  window.__pgHandleDmPopstate = function() {
    var p = window.location.pathname;
    if (p === '/messages' || p === '/messages/') {
      if (state.activeConversationId > 0 || (dmActiveWrapEl && dmActiveWrapEl.style.display !== 'none')) {
        closeConversationToList(false);
        return true;
      }
      return true;
    }
    if (p.indexOf('/messages/') === 0) {
      var uname = decodeURIComponent(p.slice('/messages/'.length).replace(/\\/+$/, ''));
      if (uname && convListEl) {
        var found = null;
        convListEl.querySelectorAll('.dm-conv-item[data-conv-id]').forEach(function(el) {
          if ((el.getAttribute('data-partner-username') || '').toLowerCase() === uname.toLowerCase()) {
            found = el;
          }
        });
        if (found) {
          var partner = extractPartnerFromConvEl(found);
          if (partner) {
            openConversationInPlace(partner, false);
            return true;
          }
        }
      }
    }
    return false;
  };

  extraCleanups.push(function() {
    threadFragCache = {};
    window.__pgHandleDmPopstate = null;
    if (dmSwitchAbort) {
      try { dmSwitchAbort.abort(); } catch (e) {}
      dmSwitchAbort = null;
    }
    clearPartnerTyping();
    sendStopTypingNow();
    if (unsubRealtime) {
      try { unsubRealtime(); } catch (e) {}
      unsubRealtime = null;
    }
    document.removeEventListener('visibilitychange', onDmVisibilityChange);
    stopDmFallbackPolling();
  });

  if (window.PhotogramRealtime) {
    window.PhotogramRealtime.ensureConnected();
    if (window.PhotogramRealtime.isFallback()) {
      startDmFallbackPolling();
    }
  } else {
    startDmFallbackPolling();
  }
})();
`;

  return layout(`${t.common.appName} — ${t.messages.title}`, body, script, t, theme);
}
