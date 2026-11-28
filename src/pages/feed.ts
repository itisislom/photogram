import { FeedPost, User } from '../types';
import { layout, escapeHtml, safeJsonForScript, renderVerifiedBadge, MORE_DOTS_ICON, TRASH_POST_ICON, postMediaUrl } from './layout';
import { renderBottomNav } from './nav';
import { COMMENT_ICON, renderCommentsSheetHtml, renderCommentsSheetScript } from './commentsModal';
import { SHARE_ICON, renderShareSheetHtml, renderShareSheetScript } from './share';
import { Translations } from '../languages/types';
import { ru } from '../languages/ru';
import { formatLocalizedFullDate, formatLocalizedShortDate, getClientDateFormat, formatCompactCount } from '../languages';
import { PersonalizedFeedResult } from '../recommendations';

const HEART_ICON = `<svg class="heart-icon-svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
const HEART_BURST_ICON = `<svg viewBox="0 0 24 24" width="80" height="80" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 4px 14px rgba(0,0,0,0.45));"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
const CAMERA_ICON = `<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#B0B0B0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;

function parseDateSafe(dateStr: string): Date {
  if (!dateStr) return new Date();
  const s = String(dateStr).trim();
  if (s.includes('T')) {
    return new Date(s.endsWith('Z') ? s : s + 'Z');
  }
  return new Date(s.replace(' ', 'T') + 'Z');
}

function formatFeedTime(dateStr: string, t: Translations): string {
  try {
    const d = parseDateSafe(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const now = Date.now();
    const diff = Math.floor((now - d.getTime()) / 1000);
    if (diff < 60) return t.common.justNow;
    if (diff < 3600) return `${Math.floor(diff / 60)} ${t.common.minutesShort}`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ${t.common.hoursShort}`;
    if (diff < 7 * 86400) return `${Math.floor(diff / 86400)} ${t.common.daysShort}`;
    return formatLocalizedShortDate(d, t.code);
  } catch {
    return dateStr;
  }
}

function formatFullDate(dateStr: string, t: Translations): string {
  try {
    const d = parseDateSafe(dateStr);
    return isNaN(d.getTime()) ? dateStr : formatLocalizedFullDate(d, t.code);
  } catch {
    return dateStr;
  }
}

function formatCaptionWithHashtags(caption: string): string {
  if (!caption) return '';
  const escaped = escapeHtml(caption);
  return escaped.replace(/(^|[^&])#([a-zA-Zа-яА-ЯёЁ0-9_]{2,30})/g, (_match, pre, tag) => {
    return `${pre}<a href="/explore?tag=${encodeURIComponent(tag.toLowerCase())}" class="caption-hashtag">#${tag}</a>`;
  });
}

function renderFeedPostCard(p: FeedPost, t: Translations, isSuggested: boolean = false, canAdminDelete: boolean = false): string {
  const initial = (p.display_name || p.username || '?').charAt(0).toUpperCase();
  const avatarHtml = p.avatar_key
    ? `<img src="/media/${encodeURIComponent(p.avatar_key)}" alt="${escapeHtml(p.username)}">`
    : `<span>${escapeHtml(initial)}</span>`;

  return `
  <article class="feed-card" data-post-id="${p.id}" data-author-id="${p.user_id}">
    <header class="feed-card-header">
      <a href="/u/${encodeURIComponent(p.username)}" class="feed-card-author">
        <div class="feed-card-avatar">${avatarHtml}</div>
        <div class="feed-card-author-meta">
          <span class="feed-card-username">${escapeHtml(p.username)}${p.is_verified ? renderVerifiedBadge(13) : ''}</span>
          <span class="feed-card-dot">•</span>
          <span class="feed-card-time" data-ts="${escapeHtml(p.created_at || '')}">${formatFeedTime(p.created_at, t)}</span>
        </div>
      </a>
      <div class="feed-card-header-right">
        ${isSuggested ? `
        <button type="button" class="feed-card-follow-btn" data-author-id="${p.user_id}" data-username="${escapeHtml(p.username)}" data-following="false">
          ${escapeHtml(t.recommendations.follow)}
        </button>` : ''}
        ${canAdminDelete ? `<button type="button" class="modal-icon-btn modal-icon-danger feed-delete-post-btn" data-delete-post-id="${p.id}" aria-label="${escapeHtml(t.post.deletePost)}" title="${escapeHtml(t.post.deletePost)}">${TRASH_POST_ICON}</button>` : ''}
        <button type="button" class="post-more-btn" data-post-more-img="${postMediaUrl(p.image_key, 'full')}" data-post-more-id="${p.id}" data-post-more-user="${escapeHtml(p.username)}" aria-label="${escapeHtml(t.post.moreOptions)}" title="${escapeHtml(t.post.moreOptions)}">${MORE_DOTS_ICON}</button>
      </div>
    </header>

    <div class="feed-card-image-wrap" data-post-id="${p.id}">
      <img src="/media/${encodeURIComponent(p.image_key)}" class="feed-card-img" alt="${escapeHtml(t.nav.feed)}" loading="lazy">
      <div class="post-like-burst">
        ${HEART_BURST_ICON}
      </div>
    </div>

    <div class="feed-card-actions">
      <button type="button" class="feed-like-btn ${p.is_liked ? 'liked' : ''}" data-post-id="${p.id}" aria-label="${escapeHtml(t.common.likesCount(1))}">
        ${HEART_ICON}
      </button>
      <button type="button" class="feed-comment-btn" data-post-id="${p.id}" data-comments-count="${p.comments_count ?? 0}" aria-label="${escapeHtml(t.feed.addComment)}">
        ${COMMENT_ICON}
      </button>
      <button type="button" class="feed-share-btn" data-post-id="${p.id}" data-author-username="${escapeHtml(p.username)}" data-author-avatar="${escapeHtml(p.avatar_key || '')}" data-author-verified="${p.is_verified ? '1' : '0'}" data-image-key="${escapeHtml(p.image_key)}" data-caption="${escapeHtml((p.caption || '').slice(0, 200))}" aria-label="${escapeHtml(t.share.ariaShare)}" title="${escapeHtml(t.share.title)}">
        ${SHARE_ICON}
        <span class="feed-share-count" data-post-id="${p.id}">${(p.shares_count ?? 0) > 0 ? escapeHtml(formatCompactCount(p.shares_count ?? 0, t.code)) : ''}</span>
      </button>
    </div>

    <div class="feed-card-likes-count" data-post-id="${p.id}">
      ${t.common.likesCount(p.likes_count ?? 0)}
    </div>

    ${p.caption ? `
    <div class="feed-card-caption">
      <a href="/u/${encodeURIComponent(p.username)}" class="feed-caption-user">${escapeHtml(p.username)}${p.is_verified ? renderVerifiedBadge(12) : ''}</a>
      ${formatCaptionWithHashtags(p.caption)}
    </div>` : ''}

    <div class="feed-card-comments-link" data-post-id="${p.id}" data-comments-count="${p.comments_count ?? 0}">
      ${p.comments_count && p.comments_count > 0 ? t.feed.viewAllComments(p.comments_count) : t.feed.addComment}
    </div>

    <div class="feed-card-date" data-ts="${escapeHtml(p.created_at || '')}">${formatFullDate(p.created_at, t)}</div>
  </article>`;
}

export function feedPage(feedInput: PersonalizedFeedResult | FeedPost[], currentUser: User, t: Translations = ru, theme?: string, isAdmin: boolean = false): string {
  let followedPosts: FeedPost[] = [];
  let suggestedPosts: FeedPost[] = [];
  let allCaughtUp = false;
  let recommendedUsers: any[] = [];
  let initialNextCursor: string | null = null;
  let initialHasMore = false;

  if (Array.isArray(feedInput)) {
    followedPosts = feedInput;
  } else if (feedInput) {
    followedPosts = feedInput.followedPosts || [];
    suggestedPosts = feedInput.suggestedPosts || [];
    allCaughtUp = Boolean(feedInput.allCaughtUp);
    recommendedUsers = feedInput.recommendedUsers || [];
    initialNextCursor = feedInput.nextCursor || null;
    initialHasMore = Boolean(feedInput.hasMore && initialNextCursor);
  }

  const hasAnyPosts = followedPosts.length > 0 || suggestedPosts.length > 0;

  const caughtUpBannerHtml = (allCaughtUp && hasAnyPosts)
    ? `
    <div class="feed-caught-up-banner">
      <div class="feed-caught-up-icon">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#4CAF50" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" stroke="#4CAF50" stroke-width="2"/>
          <polyline points="8 12 11 15 16 9"/>
        </svg>
      </div>
      <div class="feed-caught-up-title">${escapeHtml(t.recommendations.allCaughtUp)}</div>
      <div class="feed-caught-up-sub">${escapeHtml(t.recommendations.suggestedForYou)}</div>
    </div>`
    : '';

  const whoToFollowHtml = recommendedUsers.length > 0
    ? `
    <div class="feed-recommended-section">
      <div class="feed-section-header">
        <span>${escapeHtml(t.recommendations.whoToFollow)}</span>
      </div>
      <div class="feed-recommended-carousel">
        ${recommendedUsers.map(u => {
          const init = (u.display_name || u.username || '?').charAt(0).toUpperCase();
          const av = u.avatar_key
            ? `<img src="/media/${encodeURIComponent(u.avatar_key)}" alt="${escapeHtml(u.username)}">`
            : `<span>${escapeHtml(init)}</span>`;
          return `
          <div class="feed-rec-user-card" data-user-id="${u.id}">
            <a href="/u/${encodeURIComponent(u.username)}" class="feed-rec-avatar-link">
              <div class="feed-rec-avatar">${av}</div>
              <div class="feed-rec-name">${escapeHtml(u.display_name || u.username)}${u.is_verified ? renderVerifiedBadge(13) : ''}</div>
              <div class="feed-rec-username">@${escapeHtml(u.username)}</div>
            </a>
            <button type="button" class="feed-follow-btn" data-user-id="${u.id}" data-username="${escapeHtml(u.username)}" data-following="false">${escapeHtml(t.recommendations.follow)}</button>
          </div>`;
        }).join('')}
      </div>
    </div>`
    : '';

  const feedContentHtml = hasAnyPosts
    ? `
    <div class="feed-container" id="feedContainer">
      ${followedPosts.map(p => renderFeedPostCard(p, t, false, isAdmin)).join('')}
      ${caughtUpBannerHtml}
      ${whoToFollowHtml}
      ${suggestedPosts.map(p => renderFeedPostCard(p, t, true, isAdmin)).join('')}
      <div id="feedLoadSentinel" style="height: 1px;"></div>
    </div>`
    : `
    <div class="feed-container" id="feedContainer">
      <div class="feed-empty-card">
        ${CAMERA_ICON}
        <h3>${escapeHtml(t.feed.noPosts)}</h3>
        <p>${escapeHtml(t.feed.noPostsDesc)}</p>
        <a href="/explore" class="btn btn-primary" style="margin-top: 8px;">${escapeHtml(t.explore.title)}</a>
      </div>
      ${whoToFollowHtml}
    </div>`;

  const body = `
<div class="app-layout">
  <header class="top-bar">
    <div class="top-bar-title">Photogram</div>
    <a href="/notifications" class="top-bar-notif-btn" id="topNotificationsBtn" aria-label="${escapeHtml(t.notifications.title)}" title="${escapeHtml(t.notifications.title)}">
      ${HEART_ICON}
      <span class="top-notif-badge" id="topNotificationsBadge" style="display:none;"></span>
    </a>
  </header>

  <main class="feed-main">
    ${feedContentHtml}
  </main>

  ${renderBottomNav('feed', t)}
  ${renderCommentsSheetHtml(t)}
  ${renderShareSheetHtml(t)}
</div>`;

  const clientI18n = safeJsonForScript({
    lang: t.code,
    addComment: t.feed.addComment,
    shareAria: t.share.ariaShare,
    shareTitle: t.share.title,
    networkError: t.common.networkError,
    follow: t.recommendations.follow,
    following: t.recommendations.following,
    unfollowTitle: t.profile.unfollowTitle,
    unfollowConfirmTpl: t.profile.unfollowConfirm('{username}'),
    unfollowBtn: t.profile.unfollowBtn,
    deletePostTitle: t.profile.deletePostConfirmTitle,
    deletePostDesc: t.profile.deletePostConfirmDesc,
    deleteBtn: t.common.delete,
    cancelBtn: t.common.cancel,
    feedAlt: t.nav.feed,
    moreOptions: t.post.moreOptions,
    deletePostLabel: t.post.deletePost,
    likeAria: t.common.likesCount(1),
    justNow: t.common.justNow,
    minShort: t.common.minutesShort,
    hoursShort: t.common.hoursShort,
    daysShort: t.common.daysShort,
    dateFmt: getClientDateFormat(t.code),
    currentUserId: Number(currentUser.id) || 0,
    isAdmin: Boolean(isAdmin),
    nextCursor: initialNextCursor,
    hasMore: initialHasMore
  });

  const script = `
${renderCommentsSheetScript(t)}
${renderShareSheetScript(currentUser.id, t)}

(function() {
  var i18n = ${clientI18n};
  var HEART_ICON_HTML = ${safeJsonForScript(HEART_ICON)};
  var HEART_BURST_HTML = ${safeJsonForScript(HEART_BURST_ICON)};
  var COMMENT_ICON_HTML = ${safeJsonForScript(COMMENT_ICON)};
  var SHARE_ICON_HTML = ${safeJsonForScript(SHARE_ICON)};
  var MORE_DOTS_HTML = ${safeJsonForScript(MORE_DOTS_ICON)};
  ${isAdmin ? `var TRASH_POST_HTML = ${safeJsonForScript(TRASH_POST_ICON)};` : ''}

  function escapeHtmlClient(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function parseDateClient(dateStr) {
    if (!dateStr) return new Date();
    var s = String(dateStr).trim();
    if (s.indexOf('T') !== -1) {
      return new Date(s.indexOf('Z') !== -1 ? s : s + 'Z');
    }
    return new Date(s.replace(' ', 'T') + 'Z');
  }

  function formatFeedTimeClient(dateStr) {
    try {
      var d = parseDateClient(dateStr);
      if (isNaN(d.getTime())) return dateStr || '';
      var diff = Math.floor((Date.now() - d.getTime()) / 1000);
      if (diff < 60) return i18n.justNow;
      if (diff < 3600) return Math.floor(diff / 60) + ' ' + i18n.minShort;
      if (diff < 86400) return Math.floor(diff / 3600) + ' ' + i18n.hoursShort;
      if (diff < 7 * 86400) return Math.floor(diff / 86400) + ' ' + i18n.daysShort;
      var fmt = i18n.dateFmt;
      var month = (fmt && fmt.monthsShort && fmt.monthsShort[d.getMonth()]) || '';
      return (fmt && fmt.fullPattern === 'mdy') ? (month + ' ' + d.getDate()) : (d.getDate() + ' ' + month);
    } catch (e) {
      return dateStr || '';
    }
  }

  function formatFullDateClient(dateStr) {
    try {
      var d = parseDateClient(dateStr);
      if (isNaN(d.getTime())) return dateStr || '';
      var fmt = i18n.dateFmt;
      var day = d.getDate();
      var month = (fmt && fmt.monthsLong && fmt.monthsLong[d.getMonth()]) || '';
      var year = d.getFullYear();
      return (fmt && fmt.fullPattern === 'mdy')
        ? (month + ' ' + day + ', ' + year)
        : (day + ' ' + month + ' ' + year + ((fmt && fmt.yearSuffix) || ''));
    } catch (e) {
      return dateStr || '';
    }
  }

  function formatCaptionClient(caption) {
    if (!caption) return '';
    var escaped = escapeHtmlClient(caption);
    return escaped.replace(/(^|[^&])#([a-zA-Zа-яА-ЯёЁ0-9_]{2,30})/g, function(_m, pre, tag) {
      return pre + '<a href="/explore?tag=' + encodeURIComponent(tag.toLowerCase()) + '" class="caption-hashtag">#' + tag + '</a>';
    });
  }

  function formatLikes(count) {
    if (i18n.lang === 'en') {
      return count === 1 ? '1 like' : count + ' likes';
    }
    if (i18n.lang === 'uz') {
      return count + ' ta yoqdi';
    }
    if (i18n.lang === 'kz') {
      return count + ' ұнату';
    }
    if (count <= 0) return '0 отметок «Нравится»';
    var n = Math.abs(count) % 100;
    var n1 = n % 10;
    if (n > 10 && n < 20) return count + ' отметок «Нравится»';
    if (n1 > 1 && n1 < 5) return count + ' отметки «Нравится»';
    if (n1 === 1) return count + ' отметка «Нравится»';
    return count + ' отметок «Нравится»';
  }

  function formatCommentsLink(count) {
    if (!count || count <= 0) return i18n.addComment;
    if (i18n.lang === 'en') return 'View all ' + count + ' comments';
    if (i18n.lang === 'uz') return 'Barcha ' + count + ' ta sharhni ko‘rish';
    if (i18n.lang === 'kz') return 'Барлық ' + count + ' пікірді көру';
    return 'Посмотреть все комментарии (' + count + ')';
  }

  function buildFeedCardHtml(p) {
    var username = p.username || '';
    var initial = (p.display_name || username || '?').charAt(0).toUpperCase();
    var avatarKey = p.avatar_key || p.author_avatar_key || '';
    var avatarHtml = avatarKey
      ? '<img src="/media/' + encodeURIComponent(avatarKey) + '" alt="' + escapeHtmlClient(username) + '">'
      : '<span>' + escapeHtmlClient(initial) + '</span>';
    var verified13 = (Number(p.is_verified) === 1 && window.renderVerifiedBadge) ? window.renderVerifiedBadge(13) : '';
    var verified12 = (Number(p.is_verified) === 1 && window.renderVerifiedBadge) ? window.renderVerifiedBadge(12) : '';
    var isSuggested = !p.is_followed_author && Number(p.user_id) !== i18n.currentUserId;
    var likesCount = Number(p.likes_count) || 0;
    var commentsCount = Number(p.comments_count) || 0;
    var sharesCount = Number(p.shares_count) || 0;
    var sharesLabel = sharesCount > 0 ? (window.formatPhotogramCompactCount ? window.formatPhotogramCompactCount(sharesCount) : String(sharesCount)) : '';

    return '<article class="feed-card" data-post-id="' + Number(p.id) + '" data-author-id="' + Number(p.user_id) + '">' +
      '<header class="feed-card-header">' +
        '<a href="/u/' + encodeURIComponent(username) + '" class="feed-card-author">' +
          '<div class="feed-card-avatar">' + avatarHtml + '</div>' +
          '<div class="feed-card-author-meta">' +
            '<span class="feed-card-username">' + escapeHtmlClient(username) + verified13 + '</span>' +
            '<span class="feed-card-dot">•</span>' +
            '<span class="feed-card-time">' + escapeHtmlClient(formatFeedTimeClient(p.created_at)) + '</span>' +
          '</div>' +
        '</a>' +
        '<div class="feed-card-header-right">' +
          (isSuggested ? '<button type="button" class="feed-card-follow-btn" data-author-id="' + Number(p.user_id) + '" data-username="' + escapeHtmlClient(username) + '" data-following="false">' + escapeHtmlClient(i18n.follow) + '</button>' : '') +
          ${isAdmin ? `'<button type="button" class="modal-icon-btn modal-icon-danger feed-delete-post-btn" data-delete-post-id="' + Number(p.id) + '" aria-label="' + escapeHtmlClient(i18n.deletePostLabel) + '" title="' + escapeHtmlClient(i18n.deletePostLabel) + '">' + TRASH_POST_HTML + '</button>' +` : ''}
          '<button type="button" class="post-more-btn" data-post-more-img="/media/' + encodeURIComponent(p.image_key || '') + (typeof p.image_key === 'string' && p.image_key.slice(-5) === '.webp' ? '?v=full' : '') + '" data-post-more-id="' + Number(p.id) + '" data-post-more-user="' + escapeHtmlClient(username) + '" aria-label="' + escapeHtmlClient(i18n.moreOptions) + '" title="' + escapeHtmlClient(i18n.moreOptions) + '">' + MORE_DOTS_HTML + '</button>' +
        '</div>' +
      '</header>' +
      '<div class="feed-card-image-wrap" data-post-id="' + Number(p.id) + '">' +
        '<img src="/media/' + encodeURIComponent(p.image_key || '') + '" class="feed-card-img" alt="' + escapeHtmlClient(i18n.feedAlt) + '" loading="lazy">' +
        '<div class="post-like-burst">' + HEART_BURST_HTML + '</div>' +
      '</div>' +
      '<div class="feed-card-actions">' +
        '<button type="button" class="feed-like-btn ' + (p.is_liked ? 'liked' : '') + '" data-post-id="' + Number(p.id) + '" aria-label="' + escapeHtmlClient(i18n.likeAria) + '">' + HEART_ICON_HTML + '</button>' +
        '<button type="button" class="feed-comment-btn" data-post-id="' + Number(p.id) + '" data-comments-count="' + commentsCount + '" aria-label="' + escapeHtmlClient(i18n.addComment) + '">' + COMMENT_ICON_HTML + '</button>' +
        '<button type="button" class="feed-share-btn" data-post-id="' + Number(p.id) + '" data-author-username="' + escapeHtmlClient(username) + '" data-author-avatar="' + escapeHtmlClient(avatarKey) + '" data-author-verified="' + (Number(p.is_verified) === 1 ? '1' : '0') + '" data-image-key="' + escapeHtmlClient(p.image_key || '') + '" data-caption="' + escapeHtmlClient((p.caption || '').slice(0, 200)) + '" aria-label="' + escapeHtmlClient(i18n.shareAria) + '" title="' + escapeHtmlClient(i18n.shareTitle) + '">' + SHARE_ICON_HTML + '<span class="feed-share-count" data-post-id="' + Number(p.id) + '">' + escapeHtmlClient(sharesLabel) + '</span></button>' +
      '</div>' +
      '<div class="feed-card-likes-count" data-post-id="' + Number(p.id) + '">' + escapeHtmlClient(formatLikes(likesCount)) + '</div>' +
      (p.caption ? '<div class="feed-card-caption"><a href="/u/' + encodeURIComponent(username) + '" class="feed-caption-user">' + escapeHtmlClient(username) + verified12 + '</a> ' + formatCaptionClient(p.caption) + '</div>' : '') +
      '<div class="feed-card-comments-link" data-post-id="' + Number(p.id) + '" data-comments-count="' + commentsCount + '">' + escapeHtmlClient(formatCommentsLink(commentsCount)) + '</div>' +
      '<div class="feed-card-date">' + escapeHtmlClient(formatFullDateClient(p.created_at)) + '</div>' +
    '</article>';
  }

  function getEventCoords(e, container) {
    var touch = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
    var clientX = touch ? touch.clientX : e.clientX;
    var clientY = touch ? touch.clientY : e.clientY;
    var rect = container.getBoundingClientRect();
    var rawX = (clientX != null ? clientX : (rect.left + rect.width / 2)) - rect.left;
    var rawY = (clientY != null ? clientY : (rect.top + rect.height / 2)) - rect.top;
    var x = Math.max(20, Math.min(rect.width - 20, rawX));
    var y = Math.max(20, Math.min(rect.height - 20, rawY));
    return { x: x, y: y };
  }

  function showBurst(wrap, x, y) {
    if (!wrap) return;
    var burst = wrap.querySelector('.post-like-burst');
    if (!burst) return;
    if (typeof x === 'number' && typeof y === 'number') {
      burst.style.left = x + 'px';
      burst.style.top = y + 'px';
    } else {
      burst.style.left = '50%';
      burst.style.top = '50%';
    }
    burst.classList.remove('active');
    void burst.offsetWidth;
    burst.classList.add('active');
    setTimeout(function() {
      burst.classList.remove('active');
    }, 600);
  }

  function animateBtn(btn) {
    if (!btn) return;
    btn.classList.remove('animating');
    void btn.offsetWidth;
    btn.classList.add('animating');
    setTimeout(function() {
      btn.classList.remove('animating');
    }, 200);
  }

  var isLiking = false;

  async function toggleLike(postId, forceLikeOnly, x, y) {
    if (!postId || isLiking) return;

    var card = document.querySelector('.feed-card[data-post-id="' + postId + '"]');
    if (!card) return;

    var likeBtn = card.querySelector('.feed-like-btn');
    var likesCountEl = card.querySelector('.feed-card-likes-count');
    var imageWrap = card.querySelector('.feed-card-image-wrap');

    var wasLiked = likeBtn ? likeBtn.classList.contains('liked') : false;

    if (forceLikeOnly && wasLiked) {
      showBurst(imageWrap, x, y);
      return;
    }

    var newLiked = forceLikeOnly ? true : !wasLiked;

    var currentText = likesCountEl ? likesCountEl.textContent : '0';
    var prevCount = parseInt(currentText, 10) || 0;
    var newCount = newLiked ? (prevCount + (wasLiked ? 0 : 1)) : Math.max(0, prevCount - 1);

    isLiking = true;
    if (likeBtn) {
      if (newLiked) likeBtn.classList.add('liked');
      else likeBtn.classList.remove('liked');
      animateBtn(likeBtn);
    }
    if (likesCountEl) {
      likesCountEl.textContent = formatLikes(newCount);
    }
    if (newLiked) {
      if (window.markPostEngaged) window.markPostEngaged(postId);
      showBurst(imageWrap, x, y);
    }

    try {
      var res = await fetch('/api/posts/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: parseInt(postId, 10) })
      });
      var data = await res.json();
      if (res.ok && data.success) {
        var serverLiked = Boolean(data.liked);
        var serverCount = typeof data.likes_count === 'number' ? data.likes_count : newCount;
        if (likeBtn) {
          if (serverLiked) likeBtn.classList.add('liked');
          else likeBtn.classList.remove('liked');
        }
        if (likesCountEl) {
          likesCountEl.textContent = formatLikes(serverCount);
        }
      } else {
        if (likeBtn) {
          if (wasLiked) likeBtn.classList.add('liked');
          else likeBtn.classList.remove('liked');
        }
        if (likesCountEl) likesCountEl.textContent = formatLikes(prevCount);
        if (res.status === 401 || (data && data.error && (data.error.includes('авториз') || data.error.includes('войти')))) {
          if (window.showAppAlert) window.showAppAlert({ isAuth: true, message: data ? data.error : '' });
        }
      }
    } catch (err) {
      if (likeBtn) {
        if (wasLiked) likeBtn.classList.add('liked');
        else likeBtn.classList.remove('liked');
      }
      if (likesCountEl) likesCountEl.textContent = formatLikes(prevCount);
      if (window.showAppAlert) window.showAppAlert({ message: i18n.networkError });
    } finally {
      isLiking = false;
    }
  }

  function bindFeedEvents(root) {
    var scope = root || document;
    scope.querySelectorAll('.feed-like-btn').forEach(function(btn) {
      if (btn.dataset.feedBound) return;
      btn.dataset.feedBound = '1';
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var pid = this.dataset.postId;
        toggleLike(pid, false);
      });
    });

    scope.querySelectorAll('.feed-card-likes-count').forEach(function(el) {
      if (el.dataset.likeListBound) return;
      el.dataset.likeListBound = '1';
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      var openLikes = function(e) {
        e.stopPropagation();
        var pid = parseInt(el.dataset.postId || '0', 10);
        if (!pid || !window.openLikeList) return;
        window.openLikeList({ postId: pid, initialCount: parseInt(el.textContent || '0', 10) || 0 });
      };
      el.addEventListener('click', openLikes);
      el.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openLikes(e);
        }
      });
    });

    scope.querySelectorAll('.feed-share-btn').forEach(function(btn) {
      if (btn.dataset.feedBound) return;
      btn.dataset.feedBound = '1';
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (window.openShareSheet) {
          window.openShareSheet({
            postId: parseInt(this.dataset.postId || '0', 10),
            authorUsername: this.dataset.authorUsername || '',
            authorAvatar: this.dataset.authorAvatar || '',
            authorVerified: this.dataset.authorVerified === '1',
            imageKey: this.dataset.imageKey || '',
            caption: this.dataset.caption || ''
          });
        }
      });
    });

    scope.querySelectorAll('.feed-comment-btn, .feed-card-comments-link').forEach(function(el) {
      if (el.dataset.feedBound) return;
      el.dataset.feedBound = '1';
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        var pid = this.dataset.postId;
        var card = document.querySelector('.feed-card[data-post-id="' + pid + '"]');
        var aid = card ? (parseInt(card.dataset.authorId, 10) || undefined) : undefined;
        if (window.markPostEngaged) window.markPostEngaged(pid);
        if (window.trackTelemetryEvent && pid) {
          window.trackTelemetryEvent({ type: 'comment_open', post_id: parseInt(pid, 10), author_id: aid });
        }
        var linkEl = card ? card.querySelector('.feed-card-comments-link') : null;
        var btnEl = card ? card.querySelector('.feed-comment-btn') : null;

        var currentCount = parseInt(this.dataset.commentsCount, 10) || 0;

        if (window.openCommentsSheet) {
          window.openCommentsSheet(pid, {
            initialCount: currentCount,
            onCountUpdate: function(newCount) {
              if (linkEl) {
                linkEl.dataset.commentsCount = newCount;
                linkEl.textContent = formatCommentsLink(newCount);
              }
              if (btnEl) {
                btnEl.dataset.commentsCount = newCount;
              }
            }
          });
        }
      });
    });

    scope.querySelectorAll('.feed-card-image-wrap').forEach(function(wrap) {
      if (wrap.dataset.feedBound) return;
      wrap.dataset.feedBound = '1';
      if (window.pgBindPostPhotoGestures) {
        window.pgBindPostPhotoGestures(wrap, {
          imgSelector: '.feed-card-img',
          coordTarget: wrap,
          onDoubleTap: function(x, y) {
            toggleLike(wrap.dataset.postId, true, x, y);
          }
        });
      }
    });

    scope.querySelectorAll('.feed-card-author, .feed-caption-user').forEach(function(link) {
      if (link.dataset.feedBound) return;
      link.dataset.feedBound = '1';
      link.addEventListener('click', function() {
        var card = this.closest('.feed-card[data-post-id]');
        if (!card) return;
        var pid = parseInt(card.dataset.postId, 10);
        var aid = parseInt(card.dataset.authorId, 10) || undefined;
        if (window.markPostEngaged) window.markPostEngaged(pid);
        if (window.trackTelemetryEvent && pid) {
          window.trackTelemetryEvent({ type: 'profile_visit', post_id: pid, author_id: aid });
        }
      });
    });

    scope.querySelectorAll('.feed-follow-btn, .feed-card-follow-btn').forEach(function(btn) {
      if (btn.dataset.feedBound) return;
      btn.dataset.feedBound = '1';
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var btnRef = this;
        var targetId = parseInt(btnRef.dataset.userId || btnRef.dataset.authorId, 10);
        if (!targetId || btnRef.disabled) return;
        var isFollowing = btnRef.dataset.following === 'true';
        var targetUsername = btnRef.dataset.username || '';

        function executeFeedFollow() {
          btnRef.disabled = true;
          fetch('/api/users/follow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ following_id: targetId })
          }).then(function(res) {
            return res.json().then(function(data) {
              if (data && data.success) {
                var nowFollowing = Boolean(data.is_following);
                document.querySelectorAll('[data-user-id="' + targetId + '"].feed-follow-btn, [data-author-id="' + targetId + '"].feed-card-follow-btn').forEach(function(b) {
                  b.dataset.following = nowFollowing ? 'true' : 'false';
                  b.textContent = nowFollowing ? i18n.following : i18n.follow;
                  if (nowFollowing) b.classList.add('following');
                  else b.classList.remove('following');
                });
              }
            });
          }).catch(function() {}).finally(function() {
            btnRef.disabled = false;
          });
        }

        if (isFollowing) {
          if (window.showAppConfirm) {
            var confirmMsg = (i18n.unfollowConfirmTpl || 'Вы действительно хотите отписаться от @{username}?').replace('{username}', targetUsername);
            window.showAppConfirm({
              type: 'unfollow',
              title: i18n.unfollowTitle || 'Отписаться?',
              message: confirmMsg,
              okText: i18n.unfollowBtn || 'Отписаться',
              onOk: executeFeedFollow
            });
          } else {
            executeFeedFollow();
          }
        } else {
          executeFeedFollow();
        }
      });
    });

    scope.querySelectorAll('.feed-delete-post-btn').forEach(function(btn) {
      if (btn.dataset.feedBound) return;
      btn.dataset.feedBound = '1';
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var delBtn = this;
        var pid = parseInt(delBtn.dataset.deletePostId, 10);
        if (!pid || delBtn.disabled) return;

        function doDeleteFeedPost() {
          delBtn.disabled = true;
          fetch('/api/posts/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ post_id: pid })
          }).then(function(r) {
            return r.json().then(function(d) { return { ok: r.ok, d: d }; });
          }).then(function(res) {
            if (res.ok && res.d && res.d.success) {
              var card = document.querySelector('.feed-card[data-post-id="' + pid + '"]');
              if (card) card.remove();
            } else {
              delBtn.disabled = false;
              if (window.showAppAlert) {
                window.showAppAlert({ message: (res.d && res.d.error) || i18n.networkError });
              }
            }
          }).catch(function() {
            delBtn.disabled = false;
            if (window.showAppAlert) {
              window.showAppAlert({ message: i18n.networkError });
            }
          });
        }

        if (window.showAppConfirm) {
          window.showAppConfirm({
            title: i18n.deletePostTitle,
            message: i18n.deletePostDesc,
            okText: i18n.deleteBtn,
            cancelText: i18n.cancelBtn,
            danger: true,
            onOk: doDeleteFeedPost
          });
        } else if (window.confirm(i18n.deletePostDesc)) {
          doDeleteFeedPost();
        }
      });
    });
  }

  bindFeedEvents(document);

  var feedContainer = document.getElementById('feedContainer');
  var feedSentinel = document.getElementById('feedLoadSentinel');
  var feedNextCursor = i18n.nextCursor || null;
  var feedHasMore = Boolean(i18n.hasMore && feedNextCursor);
  var feedLoading = false;
  var prefetchedFeed = null;
  var prefetchFeedPromise = null;

  function fetchFeedPage(cursor) {
    return fetch('/api/recommendations/feed?limit=20&cursor=' + encodeURIComponent(cursor))
      .then(function(res) {
        if (!res.ok) return null;
        return res.json();
      })
      .catch(function() { return null; });
  }

  function prefetchNextFeedPage() {
    if (!feedHasMore || !feedNextCursor || prefetchedFeed || prefetchFeedPromise) return;
    var cursorAtStart = feedNextCursor;
    prefetchFeedPromise = fetchFeedPage(cursorAtStart).then(function(data) {
      if (data && Array.isArray(data.posts) && cursorAtStart === feedNextCursor) {
        prefetchedFeed = data;
      }
      return data;
    }).finally(function() {
      prefetchFeedPromise = null;
    });
  }

  function appendFeedPosts(posts) {
    if (!feedContainer || !Array.isArray(posts) || posts.length === 0) return;
    var temp = document.createElement('div');
    var html = '';
    for (var i = 0; i < posts.length; i++) {
      var p = posts[i];
      if (!p || !p.id) continue;
      if (feedContainer.querySelector('.feed-card[data-post-id="' + Number(p.id) + '"]')) continue;
      html += buildFeedCardHtml(p);
    }
    if (!html) return;
    temp.innerHTML = html;
    var frag = document.createDocumentFragment();
    var added = [];
    while (temp.firstChild) {
      var node = temp.firstChild;
      added.push(node);
      frag.appendChild(node);
    }
    if (feedSentinel && feedSentinel.parentNode === feedContainer) {
      feedContainer.insertBefore(frag, feedSentinel);
    } else {
      feedContainer.appendChild(frag);
    }
    for (var j = 0; j < added.length; j++) {
      if (added[j].nodeType === 1) bindFeedEvents(added[j]);
    }
    if (window.initTelemetryObserver) window.initTelemetryObserver();
  }

  async function loadNextFeedPage() {
    if (feedLoading || !feedHasMore || !feedNextCursor) return;
    feedLoading = true;
    try {
      var data = prefetchedFeed;
      prefetchedFeed = null;
      if (!data && prefetchFeedPromise) {
        data = await prefetchFeedPromise;
        prefetchedFeed = null;
      }
      if (!data) {
        data = await fetchFeedPage(feedNextCursor);
      }
      if (!data || !Array.isArray(data.posts)) {
        feedHasMore = false;
        feedNextCursor = null;
        return;
      }
      appendFeedPosts(data.posts);
      feedNextCursor = data.next_cursor || null;
      feedHasMore = Boolean(data.has_more && feedNextCursor);
      if (feedHasMore) {
        prefetchNextFeedPage();
      }
    } finally {
      feedLoading = false;
    }
  }

  function checkFeedScroll() {
    if (!feedHasMore || !feedContainer) return;
    var scrollBottom = (window.scrollY || document.documentElement.scrollTop || 0) + window.innerHeight;
    var docHeight = document.documentElement.scrollHeight || 0;
    var remaining = docHeight - scrollBottom;
    if (remaining < 1600) {
      prefetchNextFeedPage();
    }
    if (remaining < 700) {
      loadNextFeedPage();
    }
  }

  function syncRenderedFeedDates() {
    document.querySelectorAll('.feed-card-time[data-ts]').forEach(function(el) {
      var ts = el.getAttribute('data-ts');
      if (ts) el.textContent = formatFeedTimeClient(ts);
    });
    document.querySelectorAll('.feed-card-date[data-ts]').forEach(function(el) {
      var ts = el.getAttribute('data-ts');
      if (ts) el.textContent = formatFullDateClient(ts);
    });
  }

  syncRenderedFeedDates();

  if (feedHasMore && feedContainer) {
    setTimeout(prefetchNextFeedPage, 150);
    window.addEventListener('scroll', checkFeedScroll, { passive: true });
    if (feedSentinel && typeof IntersectionObserver !== 'undefined') {
      var feedObs = new IntersectionObserver(function(entries) {
        if (!document.body.contains(feedSentinel)) {
          feedObs.disconnect();
          return;
        }
        for (var k = 0; k < entries.length; k++) {
          if (entries[k].isIntersecting) {
            loadNextFeedPage();
            break;
          }
        }
      }, { rootMargin: '600px 0px' });
      feedObs.observe(feedSentinel);
    }
  }
})();
`;

  return layout(`${t.common.appName} — ${t.nav.feed}`, body, script, t, theme);
}
