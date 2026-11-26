export function formatBioHtml(bio?: string | null): string {
  if (!bio) return '';
  const safe = escapeHtml(bio);
  return safe.replace(/@([a-zA-Z0-9._]{1,30})/g, '<a href="/u/$1" class="mention-link bio-mention">@$1</a>');
}

import { ProfileData } from '../types';
import { layout, escapeHtml, safeJsonForScript, renderVerifiedBadge, MORE_DOTS_ICON, postMediaUrl } from './layout';
import { renderBottomNav, CLOSE_ICON } from './nav';
import { SEND_COMMENT_ICON, COMMENT_HEART_ICON, REPLY_CHEVRON_ICON, REPLY_ARROW_ICON } from './commentsModal';
import { Translations } from '../languages/types';
import { ru } from '../languages/ru';
import { getClientDateFormat, getCompactCountUnits } from '../languages';

const CAMERA_ICON = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z"/><path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg>`;
const MENU_ICON = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`;
const TRASH_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;
const HEART_ICON = `<svg class="heart-icon-svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
const HEART_BURST_ICON = `<svg viewBox="0 0 24 24" width="80" height="80" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 4px 14px rgba(0,0,0,0.35));"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
const COMMENT_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;
const SETTINGS_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;

export function profilePage(data: ProfileData, t: Translations = ru, theme?: string): string {
  const { user, posts_count, followers_count, following_count, is_owner, is_following, follows_you, posts } = data;
  const usernameSafe = escapeHtml(user.username);
  const displayNameSafe = escapeHtml(user.display_name || user.username);
  const bioSafe = escapeHtml(user.bio || '');
  const initial = (user.display_name || user.username).charAt(0).toUpperCase();

  const avatarHtml = user.avatar_key
    ? `<img id="avatarImg" src="/media/${encodeURIComponent(user.avatar_key)}" alt="${usernameSafe}">`
    : `<span id="avatarPlaceholder">${escapeHtml(initial)}</span>`;

  const editBadgeHtml = is_owner
    ? `<label class="profile-avatar-edit-badge" for="avatarFileInput" title="${escapeHtml(t.profile.changePhoto)}">${CAMERA_ICON}</label>
       <input type="file" id="avatarFileInput" style="display:none">`
    : '';

  let hintText = '';
  let hintIsWarning = false;
  if (is_owner) {
    const left = typeof data.username_changes_left === 'number' ? data.username_changes_left : 3;
    const unlockDays = data.username_unlock_days || 0;
    if (left <= 0) {
      hintText = t.profile.usernameLimitWarning(3, unlockDays);
      hintIsWarning = true;
    } else if (left < 3) {
      hintText = t.profile.usernameLimitLeft(left);
    } else {
      hintText = t.profile.usernameLimitNormal;
    }
  }

  const followText = is_following
    ? t.profile.following
    : (follows_you ? t.profile.followBack : t.profile.follow);

  const actionsHtml = is_owner
    ? `<a href="/u/${encodeURIComponent(user.username)}/editprofile" class="btn btn-secondary btn-sm" id="editProfileBtn">${escapeHtml(t.profile.editProfile)}</a>`
    : `<button class="btn ${is_following ? 'btn-secondary' : 'btn-primary'} btn-sm" id="followBtn" data-target-id="${user.id}" data-username="${usernameSafe}" data-is-following="${is_following ? '1' : '0'}" data-follows-you="${follows_you ? '1' : '0'}">
         ${escapeHtml(followText)}
       </button>
       <a href="/messages/${encodeURIComponent(user.username)}" class="btn btn-secondary btn-sm profile-message-btn" id="messageUserBtn">${escapeHtml(t.messages.messageBtn)}</a>`;

  const statLabels = {
    ru: { posts: 'Публикации', followers: 'Подписчики', following: 'Подписки' },
    en: { posts: 'Posts', followers: 'Followers', following: 'Following' },
    uz: { posts: 'Postlar', followers: 'Obunachilar', following: 'Obunalar' },
    kz: { posts: 'Жазбалар', followers: 'Жазылушылар', following: 'Жазылымдар' },
  }[t.code] || { posts: 'Публикации', followers: 'Подписчики', following: 'Подписки' };

  const postList = posts || [];
  const gridHtml = postList.length > 0
    ? `
    <div class="profile-grid" id="profileGrid">
      ${postList.map(p => `
        <button class="profile-grid-item post-item-btn" type="button" data-post-id="${p.id}" data-author-id="${user.id}" data-author-username="${usernameSafe}" data-author-avatar="${escapeHtml(user.avatar_key || '')}" data-author-verified="${(p.is_verified ?? user.is_verified) ? '1' : '0'}" data-img="${postMediaUrl(p.image_key, 'full')}" data-caption="${escapeHtml(p.caption)}" data-date="${escapeHtml(p.created_at)}" data-likes-count="${p.likes_count ?? 0}" data-comments-count="${p.comments_count ?? 0}" data-is-liked="${p.is_liked ? '1' : '0'}">
          <img src="${postMediaUrl(p.image_key, 'thumb')}" alt="${escapeHtml(t.profile.postsTab)}" loading="lazy">
          <div class="profile-grid-overlay">
            <div class="profile-grid-stat">${HEART_ICON} <span class="grid-likes-val">${p.likes_count ?? 0}</span></div>
            <div class="profile-grid-stat">${COMMENT_ICON} <span class="grid-comments-val">${p.comments_count ?? 0}</span></div>
          </div>
        </button>
      `).join('')}
    </div>`
    : `
    <div class="profile-empty" id="profileEmpty">
      ${escapeHtml(t.profile.noPosts)}
    </div>`;

  const body = `
<div class="app-layout">
  <header class="top-bar">
    <div class="top-bar-title">Photogram</div>
    ${is_owner ? `<button class="top-bar-action" id="openMenuBtn" type="button" aria-label="${escapeHtml(t.profile.menuTitle)}">${MENU_ICON}</button>` : ''}
  </header>

  <main class="profile-container">
    <section class="profile-header">
      <div class="profile-avatar-wrap">
        <div class="profile-avatar" id="avatarBox">
          ${avatarHtml}
        </div>
        ${editBadgeHtml}
      </div>

      <div class="profile-header-main">
        <div class="profile-header-username">
          ${usernameSafe}${user.is_verified ? renderVerifiedBadge(15) : ''}
          ${!is_owner && follows_you ? `<span class="follows-you-tag">${escapeHtml(t.profile.followsYou)}</span>` : ''}
        </div>
        <div class="profile-stats">
          <div class="stat-item">
            <span class="stat-number">${posts_count}</span>
            <span class="stat-label">${escapeHtml(statLabels.posts)}</span>
          </div>
          <a href="/u/${encodeURIComponent(user.username)}/sublist" class="stat-item stat-item-link" id="followersStatLink" aria-label="${escapeHtml(statLabels.followers)}">
            <span class="stat-number" id="followersCount">${followers_count}</span>
            <span class="stat-label">${escapeHtml(statLabels.followers)}</span>
          </a>
          <a href="/u/${encodeURIComponent(user.username)}/subslist" class="stat-item stat-item-link" id="followingStatLink" aria-label="${escapeHtml(statLabels.following)}">
            <span class="stat-number">${following_count}</span>
            <span class="stat-label">${escapeHtml(statLabels.following)}</span>
          </a>
        </div>
      </div>
    </section>

    <section class="profile-info">
      <div class="profile-display-name" id="viewDisplayName">${displayNameSafe}</div>
      <div class="profile-bio" id="viewBio">${formatBioHtml(user.bio)}</div>
    </section>

    <div class="profile-actions">
      ${actionsHtml}
    </div>

    ${!is_owner ? `
    <div class="profile-similar-section" id="profileSimilarSection" style="display:none;">
      <div class="profile-similar-header">
        <span>${escapeHtml(t.recommendations.similarAccounts)}</span>
      </div>
      <div class="profile-similar-carousel" id="profileSimilarCarousel"></div>
    </div>` : ''}

    ${gridHtml}

  </main>

  ${renderBottomNav(is_owner ? 'profile' : 'feed', t)}

  <div class="modal-backdrop" id="viewPostModal">
    <div class="modal-content post-view-modal-content">
      <div class="post-view-header">
        <button class="post-view-back-btn" id="closeViewPostBtn" type="button" aria-label="${escapeHtml(t.common.close)}">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <a id="viewPostAuthorLink" href="/u/${usernameSafe}" class="post-view-author-link">
          <div class="post-view-header-avatar" id="viewPostAuthorAvatar">${avatarHtml}</div>
          <span class="post-view-header-author" id="viewPostAuthorName">${usernameSafe}</span>
        </a>
        <div class="post-view-header-actions">
          <button class="modal-icon-btn modal-icon-danger" id="openDeletePostModalBtn" type="button" style="display:none;" aria-label="${escapeHtml(t.post.deletePost)}" title="${escapeHtml(t.post.deletePost)}">${TRASH_ICON}</button>
          <button class="post-more-btn" id="viewPostMoreBtn" type="button" data-post-more-img="" data-post-more-id="" data-post-more-user="" aria-label="${escapeHtml(t.post.moreOptions)}" title="${escapeHtml(t.post.moreOptions)}">${MORE_DOTS_ICON}</button>
        </div>
      </div>
      <div class="post-view-scroll-body">
        <div class="post-view-image-wrap" id="viewPostImageWrap">
          <img id="viewPostImg" class="post-view-image" src="" alt="${escapeHtml(t.profile.postsTab)}">
          <div class="post-like-burst" id="likeBurstIcon">
            ${HEART_BURST_ICON}
          </div>
        </div>
        <div class="post-view-actions">
          <button class="post-like-btn" id="viewPostLikeBtn" type="button" aria-label="${escapeHtml(t.common.likesCount(1))}">
            ${HEART_ICON}
          </button>
          <div class="post-likes-count" id="viewPostLikesCount">${t.common.likesCount(0)}</div>
        </div>
        <div class="post-view-meta">
          <div class="post-view-caption" id="viewPostCaption"></div>
          <div class="post-view-date" id="viewPostDate"></div>
        </div>

        <div class="post-view-comments-section">
          <div class="post-comments-header">
            <span>${escapeHtml(t.comments.title)} (<span id="viewPostCommentsCount">0</span>)</span>
          </div>
          <div class="post-comments-list" id="viewPostCommentsList">
            <div class="comment-loading" id="viewPostCommentsLoading">${escapeHtml(t.comments.loading)}</div>
          </div>
        </div>

        <div class="post-view-related-section" id="viewPostRelatedSection" style="display:none;">
          <div class="post-related-header">
            <span>${escapeHtml(t.recommendations.relatedPosts)}</span>
          </div>
          <div class="post-related-grid" id="viewPostRelatedGrid"></div>
        </div>
      </div>
      <div class="comments-reply-bar" id="viewPostReplyBar" style="display:none;">
        <span class="comments-reply-bar-icon">${REPLY_ARROW_ICON}</span>
        <span class="comments-reply-bar-text" id="viewPostReplyBarText"></span>
        <button type="button" class="comments-reply-bar-close" id="viewPostReplyCancelBtn" aria-label="${escapeHtml(t.common.cancel)}">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="comment-input-form" id="viewPostCommentForm">
        <div class="comment-input pg-ce-input" id="viewPostCommentInput" contenteditable="plaintext-only" role="textbox" aria-multiline="false" inputmode="text" enterkeyhint="send" data-placeholder="${escapeHtml(t.comments.inputPlaceholder)}" data-maxlength="500" aria-label="${escapeHtml(t.comments.inputPlaceholder)}"></div>
        <button type="button" class="comment-submit-btn" id="viewPostCommentSubmitBtn" aria-label="${escapeHtml(t.comments.send)}" title="${escapeHtml(t.comments.send)}" disabled>${SEND_COMMENT_ICON}</button>
      </div>
    </div>
  </div>

  <div class="modal-backdrop" id="deletePostModal">
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">${escapeHtml(t.profile.deletePostConfirmTitle)}</h3>
        <button class="modal-close" id="closeDeletePostModalBtn" type="button" aria-label="${escapeHtml(t.common.close)}">${CLOSE_ICON}</button>
      </div>
      <p style="font-size: 14px; color: #757575;">${escapeHtml(t.profile.deletePostConfirmDesc)}</p>
      <div id="deletePostError" class="auth-error"></div>
      <div style="display: flex; gap: 8px; margin-top: 8px;">
        <button class="btn btn-secondary btn-sm" id="cancelDeletePostBtn" style="flex:1;">${escapeHtml(t.common.cancel)}</button>
        <button class="btn btn-danger btn-sm" id="confirmDeletePostBtn" style="flex:1;">${escapeHtml(t.common.delete)}</button>
      </div>
    </div>
  </div>

  ${
    is_owner
      ? `
  <div class="modal-backdrop" id="menuModal">
    <div class="modal-content" style="gap: 12px;">
      <div class="modal-header">
        <h3 class="modal-title">${escapeHtml(t.profile.menuTitle)}</h3>
        <button class="modal-close" id="closeMenuBtn" type="button" aria-label="${escapeHtml(t.common.close)}">${CLOSE_ICON}</button>
      </div>
      <a href="/settings" class="menu-action-btn" id="openSettingsBtn">
        ${SETTINGS_ICON}
        <span>${escapeHtml(t.nav.settings)}</span>
      </a>
    </div>
  </div>`
      : ''
  }
</div>`;

  const clientI18n = safeJsonForScript({
    lang: t.code,
    compactUnits: getCompactCountUnits(t.code),
    dateFmt: getClientDateFormat(t.code),
    heartIcon: COMMENT_HEART_ICON,
    chevronIcon: REPLY_CHEVRON_ICON,
    justNow: t.common.justNow,
    minShort: t.common.minutesShort,
    hoursShort: t.common.hoursShort,
    daysShort: t.common.daysShort,
    emptyComments: t.comments.firstCommentPrompt,
    deleteBtn: t.common.delete,
    replyBtn: t.comments.reply,
    replyingTo: t.comments.replyingTo,
    showReplies: t.comments.showReplies,
    hideReplies: t.comments.hideReplies,
    loading: t.comments.loading,
    networkError: t.common.networkError,
    sendBtn: t.comments.send,
    deleteCommentTitle: t.comments.deleteTitle,
    deleteCommentConfirm: t.comments.deleteConfirm,
    cancelBtn: t.common.cancel,
    noPostsText: t.profile.noPosts,
    followText: t.profile.follow,
    followingText: t.profile.following,
    followBackText: t.profile.followBack,
    limitWarningTpl: t.profile.usernameLimitWarning(3, 14),
    limitNormal: t.profile.usernameLimitNormal,
    notInterested: t.recommendations.notInterested,
    postHidden: t.recommendations.postHidden,
    attention: t.common.attention,
    follow: t.recommendations.follow,
    following: t.recommendations.following,
    unfollowTitle: t.profile.unfollowTitle,
    unfollowConfirmTpl: t.profile.unfollowConfirm('{username}'),
    unfollowBtn: t.profile.unfollowBtn
  });

  const script = `
(function() {
  var i18n = ${clientI18n};
  var isOwner = ${is_owner ? 'true' : 'false'};
  var isAdmin = ${data.is_admin ? 'true' : 'false'};
  var currentUserId = ${Number(data.current_user_id || (is_owner ? user.id : 0))};

  function syncBodyOverflow() {
    if (document.querySelector('.modal-backdrop.visible, .comments-sheet-backdrop.visible')) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  var viewModal = document.getElementById('viewPostModal');
  var closeViewBtn = document.getElementById('closeViewPostBtn');
  var viewImg = document.getElementById('viewPostImg');
  var viewImageWrap = document.getElementById('viewPostImageWrap');
  var viewLikeBtn = document.getElementById('viewPostLikeBtn');
  var viewLikesCount = document.getElementById('viewPostLikesCount');
  var likeBurst = document.getElementById('likeBurstIcon');
  var viewCaption = document.getElementById('viewPostCaption');
  var viewDate = document.getElementById('viewPostDate');
  var viewCommentsCount = document.getElementById('viewPostCommentsCount');
  var viewCommentsList = document.getElementById('viewPostCommentsList');
  var viewCommentForm = document.getElementById('viewPostCommentForm');
  var viewCommentInput = document.getElementById('viewPostCommentInput');
  var viewCommentSubmitBtn = document.getElementById('viewPostCommentSubmitBtn');
  var viewReplyBar = document.getElementById('viewPostReplyBar');
  var viewReplyBarText = document.getElementById('viewPostReplyBarText');
  var viewReplyCancelBtn = document.getElementById('viewPostReplyCancelBtn');
  var viewAuthorLink = document.getElementById('viewPostAuthorLink');
  var viewAuthorAvatar = document.getElementById('viewPostAuthorAvatar');
  var viewAuthorName = document.getElementById('viewPostAuthorName');
  var openDeleteBtn = document.getElementById('openDeletePostModalBtn');
  var viewPostMoreBtn = document.getElementById('viewPostMoreBtn');
  var activePostId = null;
  var isLiking = false;
  var isSubmittingComment = false;
  var likingCommentIds = {};
  var replyingTo = null;
  var likeBurstTimer = null;

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

  function updateAuthorHeader(username, avatarKey, isVerified) {
    if (viewAuthorLink) viewAuthorLink.href = '/u/' + encodeURIComponent(username);
    if (viewAuthorName) {
      var badge = (Number(isVerified) === 1 && window.renderVerifiedBadge) ? window.renderVerifiedBadge(13.5) : '';
      viewAuthorName.innerHTML = escapeHtmlClient(username) + badge;
    }
    if (viewAuthorAvatar) {
      if (avatarKey) {
        viewAuthorAvatar.innerHTML = '<img src="/media/' + encodeURIComponent(avatarKey) + '" alt="' + escapeHtmlClient(username) + '">';
      } else {
        var init = (username || '?').charAt(0).toUpperCase();
        viewAuthorAvatar.innerHTML = '<span>' + escapeHtmlClient(init) + '</span>';
      }
    }
  }

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

  function formatShortDateClient(d) {
    var fmt = i18n.dateFmt;
    var day = d.getDate();
    var month = (fmt && fmt.monthsShort && fmt.monthsShort[d.getMonth()]) || '';
    if (fmt && fmt.fullPattern === 'mdy') return month + ' ' + day;
    return day + ' ' + month;
  }

  function formatFullDateClient(d) {
    var fmt = i18n.dateFmt;
    var day = d.getDate();
    var month = (fmt && fmt.monthsLong && fmt.monthsLong[d.getMonth()]) || '';
    var year = d.getFullYear();
    if (fmt && fmt.fullPattern === 'mdy') return month + ' ' + day + ', ' + year;
    return day + ' ' + month + ' ' + year + ((fmt && fmt.yearSuffix) || '');
  }

  function formatCommentTime(dateStr) {
    try {
      var d = parseDateClient(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      var now = Date.now();
      var diff = Math.floor((now - d.getTime()) / 1000);
      if (diff < 60) return i18n.justNow;
      if (diff < 3600) return Math.floor(diff / 60) + ' ' + i18n.minShort;
      if (diff < 86400) return Math.floor(diff / 3600) + ' ' + i18n.hoursShort;
      if (diff < 7 * 86400) return Math.floor(diff / 86400) + ' ' + i18n.daysShort;
      return formatShortDateClient(d);
    } catch (e) {
      return dateStr;
    }
  }

  function updateCommentsCountUI(count) {
    if (viewCommentsCount) viewCommentsCount.textContent = count;
    if (activePostId) {
      var gridBtn = document.querySelector('.post-item-btn[data-post-id="' + activePostId + '"]');
      if (gridBtn) {
        gridBtn.dataset.commentsCount = count;
        var gridCountSpan = gridBtn.querySelector('.grid-comments-val');
        if (gridCountSpan) gridCountSpan.textContent = count;
      }
    }
  }

  function formatCompactCountClient(count) {
    var raw = Number(count);
    if (!isFinite(raw) || raw <= 0) return '0';
    var n = Math.floor(raw);
    if (n < 1000) return String(n);
    var u = i18n.compactUnits || { k: 'K', m: 'M', b: 'B' };
    var sep = i18n.lang === 'en' ? '' : ' ';
    function fmt(val, unit) {
      var rounded = val >= 100 ? Math.floor(val) : Math.floor(val * 10) / 10;
      var s = (rounded % 1 === 0) ? String(rounded) : rounded.toFixed(1).replace(/\\.0$/, '');
      return s + sep + unit;
    }
    if (n >= 1000000000) return fmt(n / 1000000000, u.b);
    if (n >= 1000000) return fmt(n / 1000000, u.m);
    return fmt(n / 1000, u.k);
  }

  function renderCommentLikeBtn(commentId, isLiked, likesCount) {
    var cnt = Number(likesCount) || 0;
    var cntTxt = cnt > 0 ? escapeHtmlClient(formatCompactCountClient(cnt)) : '';
    return '<button type="button" class="comment-like-btn' + (isLiked ? ' liked' : '') + '" data-like-comment-id="' + commentId + '" aria-pressed="' + (isLiked ? 'true' : 'false') + '">' +
      i18n.heartIcon +
      '<span class="comment-like-count">' + cntTxt + '</span>' +
    '</button>';
  }

  function cancelReplyMode() {
    replyingTo = null;
    if (viewReplyBar) viewReplyBar.style.display = 'none';
    if (viewReplyBarText) viewReplyBarText.textContent = '';
  }

  function startReplyMode(rootId, targetUsername, isNestedReply) {
    if (!rootId || !targetUsername) return;
    replyingTo = { rootId: Number(rootId), username: String(targetUsername) };
    if (viewReplyBarText) {
      viewReplyBarText.textContent = String(i18n.replyingTo || '@{username}').replace('{username}', targetUsername);
    }
    if (viewReplyBar) viewReplyBar.style.display = 'flex';
    if (viewCommentInput) {
      if (isNestedReply) {
        var prefix = '@' + targetUsername + ' ';
        var curVal = viewCommentInput.value || '';
        if (curVal.toLowerCase().indexOf(prefix.toLowerCase()) !== 0) {
          viewCommentInput.value = prefix + curVal.replace(/^@[a-z0-9._]{3,24}\\s+/i, '');
        }
        if (viewCommentSubmitBtn) {
          var v = viewCommentInput.value.trim();
          viewCommentSubmitBtn.disabled = !(v.length > 0 && v.length <= 500);
          if (!viewCommentSubmitBtn.disabled) viewCommentSubmitBtn.classList.add('active');
        }
      }
      viewCommentInput.focus();
      try {
        viewCommentInput.setSelectionRange(viewCommentInput.value.length, viewCommentInput.value.length);
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
    var timeTxt = c._justNow ? escapeHtmlClient(i18n.justNow) : formatCommentTime(c.created_at);
    return '<div class="comment-item' + (isReply ? ' is-reply' : '') + '" id="commentItem_' + c.id + '" data-comment-parent-id="' + (isReply ? rootId : 0) + '">' +
      '<a href="/u/' + encodeURIComponent(c.username) + '" class="comment-avatar' + (isReply ? ' is-reply-avatar' : '') + '">' + avatarHtml + '</a>' +
      '<div class="comment-content-wrap">' +
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
      renderCommentLikeBtn(c.id, Boolean(c.is_liked), c.likes_count || 0) +
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

  function renderCommentsList(comments) {
    if (!viewCommentsList) return;
    if (!comments || comments.length === 0) {
      viewCommentsList.innerHTML = '<div class="comment-empty-text">' + escapeHtmlClient(i18n.emptyComments) + '</div>';
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

    viewCommentsList.innerHTML = html;
  }

  async function loadComments(postId) {
    if (!viewCommentsList) return;
    viewCommentsList.innerHTML = '<div class="comment-loading">' + escapeHtmlClient(i18n.loading) + '</div>';

    try {
      var res = await fetch('/api/posts/comments?post_id=' + encodeURIComponent(postId));
      var data = await res.json();
      if (res.ok && data.success) {
        renderCommentsList(data.comments || []);
        updateCommentsCountUI(data.comments_count || 0);
      } else {
        viewCommentsList.innerHTML = '<div class="comment-empty-text">' + escapeHtmlClient(i18n.networkError) + '</div>';
      }
    } catch (err) {
      viewCommentsList.innerHTML = '<div class="comment-empty-text">' + escapeHtmlClient(i18n.networkError) + '</div>';
    }
  }

  var deleteModal = document.getElementById('deletePostModal');
  var openDeleteBtn = document.getElementById('openDeletePostModalBtn');
  var closeDeleteModalBtn = document.getElementById('closeDeletePostModalBtn');
  var cancelDeleteBtn = document.getElementById('cancelDeletePostBtn');
  var confirmDeleteBtn = document.getElementById('confirmDeletePostBtn');
  var deleteError = document.getElementById('deletePostError');

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

  function updateLikeUI(isLiked, count) {
    if (viewLikeBtn) {
      if (isLiked) {
        viewLikeBtn.classList.add('liked');
      } else {
        viewLikeBtn.classList.remove('liked');
      }
    }
    if (viewLikesCount) {
      viewLikesCount.textContent = formatLikes(count);
    }
  }

  function showLikeBurst(x, y) {
    if (!likeBurst) return;
    if (typeof x === 'number' && typeof y === 'number') {
      likeBurst.style.left = x + 'px';
      likeBurst.style.top = y + 'px';
    } else {
      likeBurst.style.left = '50%';
      likeBurst.style.top = '50%';
    }
    likeBurst.classList.remove('active');
    void likeBurst.offsetWidth;
    likeBurst.classList.add('active');
    clearTimeout(likeBurstTimer);
    likeBurstTimer = setTimeout(function() {
      if (likeBurst) likeBurst.classList.remove('active');
    }, 600);
  }

  function animateLikeButton() {
    if (!viewLikeBtn) return;
    viewLikeBtn.classList.remove('animating');
    void viewLikeBtn.offsetWidth;
    viewLikeBtn.classList.add('animating');
    setTimeout(function() {
      if (viewLikeBtn) viewLikeBtn.classList.remove('animating');
    }, 200);
  }

  async function toggleLike(forceLikeOnly, x, y) {
    if (!activePostId || isLiking) return;

    var gridBtn = document.querySelector('.post-item-btn[data-post-id="' + activePostId + '"]');
    if (!gridBtn) return;

    var wasLiked = gridBtn.dataset.isLiked === '1';
    var prevCount = parseInt(gridBtn.dataset.likesCount, 10) || 0;

    if (forceLikeOnly && wasLiked) {
      showLikeBurst(x, y);
      return;
    }

    var newLiked = forceLikeOnly ? true : !wasLiked;
    var newCount = newLiked ? (prevCount + (wasLiked ? 0 : 1)) : Math.max(0, prevCount - 1);

    isLiking = true;
    gridBtn.dataset.isLiked = newLiked ? '1' : '0';
    gridBtn.dataset.likesCount = newCount;
    updateLikeUI(newLiked, newCount);
    animateLikeButton();
    if (newLiked) {
      showLikeBurst(x, y);
    }

    try {
      var res = await fetch('/api/posts/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: parseInt(activePostId, 10) })
      });
      var data = await res.json();
      if (res.ok && data.success) {
        var serverLiked = Boolean(data.liked);
        var serverCount = typeof data.likes_count === 'number' ? data.likes_count : newCount;
        gridBtn.dataset.isLiked = serverLiked ? '1' : '0';
        gridBtn.dataset.likesCount = serverCount;
        updateLikeUI(serverLiked, serverCount);
      } else {
        gridBtn.dataset.isLiked = wasLiked ? '1' : '0';
        gridBtn.dataset.likesCount = prevCount;
        updateLikeUI(wasLiked, prevCount);
        if (res.status === 401 || (data && data.error && data.error.includes('авториз'))) {
          if (window.showAppAlert) window.showAppAlert({ isAuth: true, message: data ? data.error : '' });
        }
      }
    } catch (err) {
      gridBtn.dataset.isLiked = wasLiked ? '1' : '0';
      gridBtn.dataset.likesCount = prevCount;
      updateLikeUI(wasLiked, prevCount);
    } finally {
      isLiking = false;
    }
  }

  function formatCaptionHtml(caption) {
    if (!caption) return '';
    var safe = escapeHtmlClient(caption);
    safe = safe.replace(/(^|[^&])#([a-zA-Zа-яА-ЯёЁ0-9_]{2,30})/g, function(match, pre, tag) {
      return pre + '<a href="/explore?tag=' + encodeURIComponent(tag.toLowerCase()) + '" class="caption-hashtag">#' + tag + '</a>';
    });
    return safe.replace(/@([a-z0-9._]{3,24})/gi, '<a href="/u/$1" class="mention-link">@$1</a>');
  }

  async function loadRelatedPosts(postId) {
    var sec = document.getElementById('viewPostRelatedSection');
    var grid = document.getElementById('viewPostRelatedGrid');
    if (!sec || !grid) return;
    grid.innerHTML = '';
    sec.style.display = 'none';
    try {
      var res = await fetch('/api/posts/related?post_id=' + encodeURIComponent(postId));
      var data = await res.json();
      if (res.ok && data.posts && data.posts.length > 0) {
        var html = '';
        data.posts.forEach(function(p) {
          var avKey = p.author_avatar_key || p.avatar_key || '';
          html += '<button type="button" class="post-related-item post-item-btn" ' +
            'data-post-id="' + p.id + '" ' +
            'data-author-id="' + p.user_id + '" ' +
            'data-author-username="' + escapeHtmlClient(p.username || '') + '" ' +
            'data-author-avatar="' + escapeHtmlClient(avKey) + '" ' +
            'data-author-verified="' + (Number(p.is_verified) === 1 ? '1' : '0') + '" ' +
            'data-img="/media/' + encodeURIComponent(p.image_key) + '" ' +
            'data-caption="' + escapeHtmlClient(p.caption || '') + '" ' +
            'data-likes-count="' + (p.likes_count || 0) + '" ' +
            'data-comments-count="' + (p.comments_count || 0) + '" ' +
            'data-is-liked="' + (p.is_liked ? '1' : '0') + '" ' +
            'data-date="' + escapeHtmlClient(p.created_at || '') + '">';
          html += '<img src="/media/' + encodeURIComponent(p.image_key) + '" loading="lazy" alt="Related">';
          html += '</button>';
        });
        grid.innerHTML = html;
        sec.style.display = 'block';
        if (window.initTelemetryObserver) window.initTelemetryObserver();
        grid.querySelectorAll('.post-related-item').forEach(function(item) {
          item.onclick = function() {
            openPost(this);
            var scrollBody = viewModal.querySelector('.post-view-scroll-body');
            if (scrollBody) scrollBody.scrollTop = 0;
          };
        });
      }
    } catch (err) {}
  }

  if (!isOwner) {
    if (window.trackTelemetryEvent) {
      window.trackTelemetryEvent({ type: 'profile_visit', author_id: ${user.id} });
    }
    (async function loadSimilarAccounts() {
      var sec = document.getElementById('profileSimilarSection');
      var car = document.getElementById('profileSimilarCarousel');
      if (!sec || !car) return;
      try {
        var res = await fetch('/api/authors/similar?author_id=${user.id}');
        var data = await res.json();
        if (res.ok && data.users && data.users.length > 0) {
          var html = '';
          data.users.forEach(function(u) {
            var init = (u.display_name || u.username || '?').charAt(0).toUpperCase();
            var av = u.avatar_key
              ? '<img src="/media/' + encodeURIComponent(u.avatar_key) + '" alt="' + escapeHtmlClient(u.username) + '">'
              : '<span>' + escapeHtmlClient(init) + '</span>';
            var badge = (Number(u.is_verified) === 1 && window.renderVerifiedBadge) ? window.renderVerifiedBadge(13) : '';
            html += '<div class="feed-rec-user-card" data-user-id="' + u.id + '">' +
              '<a href="/u/' + encodeURIComponent(u.username) + '" class="feed-rec-avatar-link">' +
                '<div class="feed-rec-avatar">' + av + '</div>' +
                '<div class="feed-rec-name">' + escapeHtmlClient(u.display_name || u.username) + badge + '</div>' +
                '<div class="feed-rec-username">@' + escapeHtmlClient(u.username) + '</div>' +
              '</a>' +
              '<button type="button" class="feed-follow-btn" data-user-id="' + u.id + '" data-username="' + escapeHtmlClient(u.username) + '" data-following="false">' + escapeHtmlClient(i18n.follow) + '</button>' +
            '</div>';
          });
          car.innerHTML = html;
          sec.style.display = 'block';

          car.querySelectorAll('.feed-follow-btn').forEach(function(b) {
            b.onclick = function(e) {
              e.stopPropagation();
              var btnRef = this;
              var uid = parseInt(btnRef.dataset.userId, 10);
              if (!uid || btnRef.disabled) return;
              var isF = btnRef.dataset.following === 'true';
              var targetUname = btnRef.dataset.username || '';

              function doFollowCall() {
                btnRef.disabled = true;
                fetch('/api/users/follow', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ following_id: uid })
                }).then(function(r) { return r.json(); }).then(function(d) {
                  if (d && d.success) {
                    var nowF = Boolean(d.is_following);
                    btnRef.dataset.following = nowF ? 'true' : 'false';
                    btnRef.textContent = nowF ? i18n.following : i18n.follow;
                    if (nowF) btnRef.classList.add('following');
                    else btnRef.classList.remove('following');
                  }
                }).catch(function() {}).finally(function() {
                  btnRef.disabled = false;
                });
              }

              if (isF) {
                if (window.showAppConfirm) {
                  var confirmMsg = (i18n.unfollowConfirmTpl || 'Вы действительно хотите отписаться от @{username}?').replace('{username}', targetUname);
                  window.showAppConfirm({
                    type: 'unfollow',
                    title: i18n.unfollowTitle || 'Отписаться?',
                    message: confirmMsg,
                    okText: i18n.unfollowBtn || 'Отписаться',
                    onOk: doFollowCall
                  });
                } else {
                  doFollowCall();
                }
              } else {
                doFollowCall();
              }
            };
          });
        }
      } catch (err) {}
    })();
  }

  function openPost(btn) {
    if (!btn || !viewModal) return;
    var scrollBody = viewModal.querySelector('.post-view-scroll-body');
    if (scrollBody) scrollBody.scrollTop = 0;
    activePostId = btn.dataset.postId;
    viewImg.src = btn.dataset.img || '';
    viewCaption.innerHTML = formatCaptionHtml(btn.dataset.caption || '');
    var likesCount = parseInt(btn.dataset.likesCount, 10) || 0;
    var isLiked = btn.dataset.isLiked === '1';
    updateLikeUI(isLiked, likesCount);

    var postAuthorId = Number(btn.dataset.authorId || '${user.id}');
    var postAuthorUsername = btn.dataset.authorUsername || ${safeJsonForScript(user.username)};
    var postAuthorAvatar = btn.dataset.authorAvatar || '';
    var postAuthorVerified = btn.dataset.authorVerified !== undefined ? btn.dataset.authorVerified : '${user.is_verified ? '1' : '0'}';

    updateAuthorHeader(postAuthorUsername, postAuthorAvatar, postAuthorVerified);

    if (openDeleteBtn) {
      if (isAdmin || (Number(postAuthorId) === Number(currentUserId) && Number(currentUserId) > 0)) {
        openDeleteBtn.style.display = 'flex';
      } else {
        openDeleteBtn.style.display = 'none';
      }
    }
    if (viewPostMoreBtn) {
      viewPostMoreBtn.setAttribute('data-post-more-img', btn.dataset.img || '');
      viewPostMoreBtn.setAttribute('data-post-more-id', activePostId || '');
      viewPostMoreBtn.setAttribute('data-post-more-user', postAuthorUsername || '');
    }

    if (btn.dataset.date) {
      try {
        var d = parseDateClient(btn.dataset.date);
        viewDate.textContent = isNaN(d.getTime()) ? btn.dataset.date : formatFullDateClient(d);
      } catch(e) {
        viewDate.textContent = btn.dataset.date;
      }
    } else {
      viewDate.textContent = '';
    }

    var commentsCount = parseInt(btn.dataset.commentsCount, 10) || 0;
    updateCommentsCountUI(commentsCount);
    cancelReplyMode();
    if (viewCommentInput) viewCommentInput.value = '';
    if (viewCommentSubmitBtn) {
      viewCommentSubmitBtn.disabled = true;
      viewCommentSubmitBtn.classList.remove('active');
    }
    loadComments(activePostId);
    loadRelatedPosts(activePostId);

    if (window.markPostEngaged) {
      window.markPostEngaged(activePostId);
    }
    if (window.trackTelemetryEvent) {
      window.trackTelemetryEvent({ type: 'post_open', post_id: parseInt(activePostId, 10), author_id: postAuthorId });
    }
    if (window.startModalDwell) {
      window.startModalDwell(activePostId, postAuthorId);
    }
    if (viewCommentInput) {
      viewCommentInput.dataset.commentOpenTracked = '';
      viewCommentInput.dataset.activeAuthorId = String(postAuthorId);
    }

    viewModal.classList.add('visible');
    syncBodyOverflow();
  }

  function closePostView() {
    if (window.endModalDwell) window.endModalDwell();
    cancelReplyMode();
    if (viewModal) viewModal.classList.remove('visible');
    var scrollBody = viewModal ? viewModal.querySelector('.post-view-scroll-body') : null;
    if (scrollBody) scrollBody.scrollTop = 0;
    activePostId = null;
    syncBodyOverflow();
  }

  document.querySelectorAll('.post-item-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      openPost(this);
    });
  });

  if (viewLikeBtn) {
    viewLikeBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleLike(false);
    });
  }

  if (viewImageWrap) {
    viewImageWrap.addEventListener('dblclick', function(e) {
      e.preventDefault();
      var coords = getEventCoords(e, this);
      toggleLike(true, coords.x, coords.y);
    });

    var lastTap = 0;
    viewImageWrap.addEventListener('touchend', function(e) {
      var now = new Date().getTime();
      var diff = now - lastTap;
      if (diff > 0 && diff < 350) {
        e.preventDefault();
        var coords = getEventCoords(e, this);
        toggleLike(true, coords.x, coords.y);
      }
      lastTap = now;
    });
  }

  if (closeViewBtn && viewModal) {
    closeViewBtn.addEventListener('click', closePostView);
  }

  if (viewModal) {
    viewModal.addEventListener('click', function(e) {
      if (e.target === viewModal) {
        closePostView();
      }
    });
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && viewModal && viewModal.classList.contains('visible')) {
      var postMenu = document.getElementById('appPostMenuModal');
      if (postMenu && postMenu.classList.contains('visible')) return;
      closePostView();
    }
  });

  if (viewReplyCancelBtn) {
    viewReplyCancelBtn.addEventListener('click', cancelReplyMode);
  }

  if (viewCommentInput && window.pgBindPlainEditable) {
    window.pgBindPlainEditable(viewCommentInput, {
      onEnter: function() {
        submitProfileComment();
      }
    });
  }

  if (viewCommentInput) {
    viewCommentInput.addEventListener('focus', function() {
      if (activePostId && this.dataset.commentOpenTracked !== String(activePostId)) {
        this.dataset.commentOpenTracked = String(activePostId);
        var aid = parseInt(this.dataset.activeAuthorId, 10) || undefined;
        if (window.markPostEngaged) window.markPostEngaged(activePostId);
        if (window.trackTelemetryEvent) {
          window.trackTelemetryEvent({ type: 'comment_open', post_id: parseInt(activePostId, 10), author_id: aid });
        }
      }
    });
    viewCommentInput.addEventListener('input', function() {
      var val = (this.value || '').trim();
      if (viewCommentSubmitBtn) {
        if (val.length > 0 && val.length <= 500) {
          viewCommentSubmitBtn.disabled = false;
          viewCommentSubmitBtn.classList.add('active');
        } else {
          viewCommentSubmitBtn.disabled = true;
          viewCommentSubmitBtn.classList.remove('active');
        }
      }
    });
  }

  async function submitProfileComment(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!activePostId || isSubmittingComment) return;
    var text = viewCommentInput ? (viewCommentInput.value || '').trim() : '';
    if (!text || text.length > 500) return;

    isSubmittingComment = true;
    if (viewCommentSubmitBtn) {
      viewCommentSubmitBtn.disabled = true;
      viewCommentSubmitBtn.classList.add('sending');
    }

    try {
      var reqPayload = { post_id: parseInt(activePostId, 10), content: text };
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
        if (viewCommentInput) viewCommentInput.value = '';
        cancelReplyMode();
        if (viewCommentSubmitBtn) viewCommentSubmitBtn.classList.remove('active');

        var emptyEl = viewCommentsList.querySelector('.comment-empty-text');
        if (emptyEl) emptyEl.remove();

        var c = data.comment;
        c._justNow = true;
        var pid = c.parent_id ? Number(c.parent_id) : 0;
        if (pid > 0) {
          var parentThread = viewCommentsList.querySelector('.comment-thread[data-thread-id="' + pid + '"]');
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
            var insertedEl = document.getElementById('commentItem_' + c.id);
            if (insertedEl && insertedEl.scrollIntoView) {
              try { insertedEl.scrollIntoView({ block: 'nearest' }); } catch (se) {}
            }
          } else {
            var tmpFallback = document.createElement('div');
            tmpFallback.innerHTML = '<div class="comment-thread" data-thread-id="' + c.id + '">' + renderSingleCommentHtml(c, false, c.id) + '</div>';
            if (tmpFallback.firstChild) viewCommentsList.appendChild(tmpFallback.firstChild);
          }
        } else {
          var tmpThread = document.createElement('div');
          tmpThread.innerHTML = '<div class="comment-thread" data-thread-id="' + c.id + '">' + renderSingleCommentHtml(c, false, c.id) + '</div>';
          if (tmpThread.firstChild) viewCommentsList.appendChild(tmpThread.firstChild);
          viewCommentsList.scrollTop = viewCommentsList.scrollHeight;
        }
        updateCommentsCountUI(data.comments_count);
      } else {
        if (res.status === 401 || (data && data.error && data.error.includes('авториз'))) {
          if (window.showAppAlert) window.showAppAlert({ isAuth: true, message: data ? data.error : '' });
        } else {
          if (window.showAppAlert) window.showAppAlert({ message: data ? data.error : escapeHtmlClient(i18n.networkError) });
        }
      }
    } catch (err) {
      if (window.showAppAlert) window.showAppAlert({ message: escapeHtmlClient(i18n.networkError) });
    } finally {
      isSubmittingComment = false;
      if (viewCommentSubmitBtn) {
        viewCommentSubmitBtn.classList.remove('sending');
        if ((viewCommentInput.value || '').trim()) {
          viewCommentSubmitBtn.disabled = false;
          viewCommentSubmitBtn.classList.add('active');
        } else {
          viewCommentSubmitBtn.disabled = true;
          viewCommentSubmitBtn.classList.remove('active');
        }
      }
    }
  }

  if (viewCommentSubmitBtn) {
    viewCommentSubmitBtn.addEventListener('click', submitProfileComment);
  }

  if (viewCommentsList) {
    viewCommentsList.addEventListener('click', async function(e) {
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

      async function doDeleteComment() {
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
            var item = document.getElementById('commentItem_' + commentId);
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
            updateCommentsCountUI(data.comments_count);
            if (!viewCommentsList.querySelector('.comment-thread')) {
              viewCommentsList.innerHTML = '<div class="comment-empty-text">' + escapeHtmlClient(i18n.emptyComments) + '</div>';
            }
          } else {
            if (res.status === 401 || (data && data.error && data.error.includes('авториз'))) {
              if (window.showAppAlert) window.showAppAlert({ isAuth: true, message: data ? data.error : '' });
            } else {
              if (window.showAppAlert) window.showAppAlert({ message: data ? data.error : escapeHtmlClient(i18n.networkError) });
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
          title: i18n.deleteCommentTitle,
          message: i18n.deleteCommentConfirm,
          okText: i18n.deleteBtn,
          cancelText: i18n.cancelBtn,
          onOk: doDeleteComment
        });
      } else {
        doDeleteComment();
      }
    });
  }

  function hideDeleteModal() {
    if (deleteModal) deleteModal.classList.remove('visible');
    syncBodyOverflow();
  }

  if (openDeleteBtn && deleteModal) {
    openDeleteBtn.addEventListener('click', function() {
      if (deleteError) {
        deleteError.textContent = '';
        deleteError.classList.remove('visible');
      }
      if (confirmDeleteBtn) {
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.textContent = i18n.deleteBtn;
      }
      deleteModal.classList.add('visible');
      syncBodyOverflow();
    });
  }

  if (closeDeleteModalBtn) closeDeleteModalBtn.addEventListener('click', hideDeleteModal);
  if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', hideDeleteModal);

  if (deleteModal) {
    deleteModal.addEventListener('click', function(e) {
      if (e.target === deleteModal) hideDeleteModal();
    });
  }

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async function() {
      if (!activePostId) return;
      var deletedPostId = String(activePostId);

      confirmDeleteBtn.disabled = true;
      confirmDeleteBtn.textContent = '...';
      if (deleteError) deleteError.classList.remove('visible');

      try {
        var res = await fetch('/api/posts/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ post_id: parseInt(deletedPostId, 10) })
        });
        var data = await res.json();
        if (res.ok) {
          var wasInProfileGrid = Boolean(document.querySelector('#profileGrid .post-item-btn[data-post-id="' + deletedPostId + '"]'));
          hideDeleteModal();
          closePostView();
          document.querySelectorAll('.post-item-btn[data-post-id="' + deletedPostId + '"]').forEach(function(item) {
            item.remove();
          });
          if (wasInProfileGrid) {
            var countEl = document.querySelector('.profile-stats .stat-item:first-child .stat-number');
            if (countEl) {
              var cur = parseInt(countEl.textContent, 10) || 1;
              countEl.textContent = Math.max(0, cur - 1);
            }
          }
          var grid = document.getElementById('profileGrid');
          if (grid && grid.children.length === 0) {
            grid.outerHTML = '<div class="profile-empty" id="profileEmpty">' + escapeHtmlClient(i18n.noPostsText) + '</div>';
          }
        } else {
          if (deleteError) {
            deleteError.textContent = data.error || i18n.networkError;
            deleteError.classList.add('visible');
          }
          confirmDeleteBtn.disabled = false;
          confirmDeleteBtn.textContent = i18n.deleteBtn;
        }
      } catch (err) {
        if (deleteError) {
          deleteError.textContent = i18n.networkError;
          deleteError.classList.add('visible');
        }
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.textContent = i18n.deleteBtn;
      }
    });
  }

  if (isOwner) {
    var avatarInput = document.getElementById('avatarFileInput');

    var menuModal = document.getElementById('menuModal');
    var openMenuBtn = document.getElementById('openMenuBtn');
    var closeMenuBtn = document.getElementById('closeMenuBtn');

    if (openMenuBtn && menuModal) {
      openMenuBtn.addEventListener('click', function() {
        menuModal.classList.add('visible');
        syncBodyOverflow();
      });
    }

    if (closeMenuBtn && menuModal) {
      closeMenuBtn.addEventListener('click', function() {
        menuModal.classList.remove('visible');
        syncBodyOverflow();
      });
    }

    if (menuModal) {
      menuModal.addEventListener('click', function(e) {
        if (e.target === menuModal) {
          menuModal.classList.remove('visible');
          syncBodyOverflow();
        }
      });
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && menuModal.classList.contains('visible')) {
          menuModal.classList.remove('visible');
          syncBodyOverflow();
        }
      });
    }





    if (avatarInput) {
      avatarInput.addEventListener('change', function(e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;

        var img = new Image();
        var reader = new FileReader();

        reader.onload = function(evt) {
          img.src = evt.target.result;
        };

        img.onload = function() {
          var canvas = document.createElement('canvas');
          var size = 400;
          canvas.width = size;
          canvas.height = size;
          var ctx = canvas.getContext('2d');

          var srcWidth = img.naturalWidth;
          var srcHeight = img.naturalHeight;
          var cropSize = Math.min(srcWidth, srcHeight);
          var sx = (srcWidth - cropSize) / 2;
          var sy = (srcHeight - cropSize) / 2;

          ctx.drawImage(img, sx, sy, cropSize, cropSize, 0, 0, size, size);

          canvas.toBlob(async function(blob) {
            if (!blob) return;
            var fd = new FormData();
            fd.append('avatar', blob, 'avatar.webp');

            try {
              var res = await fetch('/api/profile/avatar', {
                method: 'POST',
                body: fd
              });
              var data = {};
              try {
                data = await res.json();
              } catch(e) {}
              if (res.ok && data.avatar_url) {
                var avatarBox = document.getElementById('avatarBox');
                if (avatarBox) avatarBox.innerHTML = '<img id="avatarImg" src="' + data.avatar_url + '" alt="Avatar">';
              } else {
                if (res.status === 401 || (data && data.error && data.error.includes('авториз'))) {
                  if (window.showAppAlert) window.showAppAlert({ isAuth: true, message: data ? data.error : '' });
                } else {
                  if (window.showAppAlert) window.showAppAlert({ message: data ? data.error : i18n.networkError });
                }
              }
            } catch (err) {
              if (window.showAppAlert) window.showAppAlert({ message: i18n.networkError });
            }
          }, 'image/webp', 0.85);
        };

        reader.readAsDataURL(file);
      });
    }
  }

  var followBtn = document.getElementById('followBtn');
  var followersCountEl = document.getElementById('followersCount');
  var isFollowingRequest = false;

  if (followBtn) {
    followBtn.addEventListener('click', function() {
      if (isFollowingRequest) return;
      var wasFollowing = followBtn.dataset.isFollowing === '1';
      var targetUsername = followBtn.dataset.username || ${safeJsonForScript(user.username)};

      function executeFollowChange() {
        if (isFollowingRequest) return;
        var targetId = parseInt(followBtn.dataset.targetId, 10);
        var curWasFollowing = followBtn.dataset.isFollowing === '1';
        var followsYou = followBtn.dataset.followsYou === '1';
        var notFollowingText = followsYou ? i18n.followBackText : i18n.followText;
        var newFollowing = !curWasFollowing;

        isFollowingRequest = true;
        followBtn.dataset.isFollowing = newFollowing ? '1' : '0';
        followBtn.className = 'btn ' + (newFollowing ? 'btn-secondary' : 'btn-primary') + ' btn-sm';
        followBtn.textContent = newFollowing ? i18n.followingText : notFollowingText;

        if (followersCountEl) {
          var curCount = parseInt(followersCountEl.textContent, 10) || 0;
          var nextCount = newFollowing ? (curCount + 1) : Math.max(0, curCount - 1);
          followersCountEl.textContent = nextCount;
        }

        fetch('/api/profile/follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ following_id: targetId })
        }).then(function(res) {
          return res.json().then(function(data) {
            if (res.ok && data.success) {
              var serverFollowing = Boolean(data.is_following);
              followBtn.dataset.isFollowing = serverFollowing ? '1' : '0';
              followBtn.className = 'btn ' + (serverFollowing ? 'btn-secondary' : 'btn-primary') + ' btn-sm';
              followBtn.textContent = serverFollowing ? i18n.followingText : notFollowingText;
              if (followersCountEl && typeof data.followers_count === 'number') {
                followersCountEl.textContent = data.followers_count;
              }
            } else {
              followBtn.dataset.isFollowing = curWasFollowing ? '1' : '0';
              followBtn.className = 'btn ' + (curWasFollowing ? 'btn-secondary' : 'btn-primary') + ' btn-sm';
              followBtn.textContent = curWasFollowing ? i18n.followingText : notFollowingText;
              if (followersCountEl) {
                var rollCount = parseInt(followersCountEl.textContent, 10) || 0;
                followersCountEl.textContent = curWasFollowing ? (rollCount + 1) : Math.max(0, rollCount - 1);
              }
              if (res.status === 401 || (data && data.error && data.error.includes('авториз'))) {
                if (window.showAppAlert) window.showAppAlert({ isAuth: true, message: data ? data.error : '' });
              } else if (data && data.error) {
                if (window.showAppAlert) window.showAppAlert({ message: data.error });
              }
            }
          });
        }).catch(function() {
          followBtn.dataset.isFollowing = curWasFollowing ? '1' : '0';
          followBtn.className = 'btn ' + (curWasFollowing ? 'btn-secondary' : 'btn-primary') + ' btn-sm';
          followBtn.textContent = curWasFollowing ? i18n.followingText : notFollowingText;
          if (window.showAppAlert) window.showAppAlert({ message: i18n.networkError });
        }).finally(function() {
          isFollowingRequest = false;
        });
      }

      if (wasFollowing) {
        if (window.showAppConfirm) {
          var confirmMsg = (i18n.unfollowConfirmTpl || 'Вы действительно хотите отписаться от @{username}?').replace('{username}', targetUsername);
          window.showAppConfirm({
            type: 'unfollow',
            title: i18n.unfollowTitle || 'Отписаться?',
            message: confirmMsg,
            okText: i18n.unfollowBtn || 'Отписаться',
            onOk: executeFollowChange
          });
        } else {
          executeFollowChange();
        }
      } else {
        executeFollowChange();
      }
    });
  }

})();
`;

  return layout(`${t.common.appName} — ${usernameSafe}`, body, script, t, theme);
}

export function userNotFoundPage(t: Translations = ru, theme?: string): string {
  const body = `
<div class="not-found-page">
  <div class="not-found-text">${escapeHtml(t.explore.noResults)}</div>
</div>`;

  return layout(t.explore.noResults, body, '', t, theme);
}

