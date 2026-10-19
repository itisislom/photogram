import { ProfileData } from '../types';
import { layout, escapeHtml } from './layout';
import { renderBottomNav, renderCreatePostModal, renderCreatePostScript, CLOSE_ICON } from './nav';
import { renderLangSwitcherHtml } from '../languages';
import { Translations } from '../languages/types';
import { ru } from '../languages/ru';
import { getLegalCardsHtml } from './useraccept';

const CAMERA_ICON = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z"/><path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg>`;
const MENU_ICON = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`;
const TRASH_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;
const HEART_ICON = `<svg class="heart-icon-svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
const HEART_BURST_ICON = `<svg viewBox="0 0 24 24" width="80" height="80" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 4px 14px rgba(0,0,0,0.35));"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
const COMMENT_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;
const SETTINGS_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
const EDIT_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const TERMS_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`;
const LOGOUT_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;

function getDateLocale(code: string): string {
  if (code === 'kz') return 'kk-KZ';
  if (code === 'uz') return 'uz-UZ';
  if (code === 'en') return 'en-US';
  return 'ru-RU';
}

export function profilePage(data: ProfileData, t: Translations = ru): string {
  const { user, posts_count, followers_count, following_count, is_owner, is_following, follows_you, posts } = data;
  const usernameSafe = escapeHtml(user.username);
  const displayNameSafe = escapeHtml(user.display_name || user.username);
  const bioSafe = escapeHtml(user.bio);
  const initial = (user.display_name || user.username).charAt(0).toUpperCase();

  const avatarHtml = user.avatar_key
    ? `<img id="avatarImg" src="/media/${encodeURIComponent(user.avatar_key)}" alt="${usernameSafe}">`
    : `<span id="avatarPlaceholder">${escapeHtml(initial)}</span>`;

  const editBadgeHtml = is_owner
    ? `<label class="profile-avatar-edit-badge" for="avatarFileInput" title="${escapeHtml(t.profile.changePhoto)}">${CAMERA_ICON}</label>
       <input type="file" id="avatarFileInput" accept="image/jpeg,image/png,image/webp" style="display:none">`
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
    ? `<button class="btn btn-secondary btn-sm" id="editProfileBtn">${escapeHtml(t.profile.editProfile)}</button>`
    : `<button class="btn ${is_following ? 'btn-secondary' : 'btn-primary'} btn-sm" id="followBtn" data-target-id="${user.id}" data-is-following="${is_following ? '1' : '0'}" data-follows-you="${follows_you ? '1' : '0'}">
         ${escapeHtml(followText)}
       </button>`;

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
        <button class="profile-grid-item post-item-btn" type="button" data-post-id="${p.id}" data-author-id="${user.id}" data-author-username="${usernameSafe}" data-author-avatar="${escapeHtml(user.avatar_key || '')}" data-img="/media/${encodeURIComponent(p.image_key)}" data-caption="${escapeHtml(p.caption)}" data-date="${escapeHtml(p.created_at)}" data-likes-count="${p.likes_count ?? 0}" data-comments-count="${p.comments_count ?? 0}" data-is-liked="${p.is_liked ? '1' : '0'}">
          <img src="/media/${encodeURIComponent(p.image_key)}" alt="${escapeHtml(t.profile.postsTab)}" loading="lazy">
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
    ${is_owner ? `<button class="top-bar-action" id="openMenuBtn" aria-label="${escapeHtml(t.nav.menu)}" title="${escapeHtml(t.nav.menu)}">${MENU_ICON}</button>` : ''}
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
          ${usernameSafe}
          ${!is_owner && follows_you ? `<span class="follows-you-tag">${escapeHtml(t.profile.followsYou)}</span>` : ''}
        </div>
        <div class="profile-stats">
          <div class="stat-item">
            <span class="stat-number">${posts_count}</span>
            <span class="stat-label">${escapeHtml(statLabels.posts)}</span>
          </div>
          <div class="stat-item">
            <span class="stat-number" id="followersCount">${followers_count}</span>
            <span class="stat-label">${escapeHtml(statLabels.followers)}</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">${following_count}</span>
            <span class="stat-label">${escapeHtml(statLabels.following)}</span>
          </div>
        </div>
      </div>
    </section>

    <section class="profile-info">
      <div class="profile-display-name" id="viewDisplayName">${displayNameSafe}</div>
      <div class="profile-bio" id="viewBio">${bioSafe}</div>
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
  ${renderCreatePostModal(t)}

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
      <form class="comment-input-form" id="viewPostCommentForm">
        <input type="text" class="comment-input" id="viewPostCommentInput" placeholder="${escapeHtml(t.comments.inputPlaceholder)}" maxlength="500" autocomplete="off">
        <button type="submit" class="comment-submit-btn" id="viewPostCommentSubmitBtn">${escapeHtml(t.comments.send)}</button>
      </form>
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
  <div class="modal-backdrop" id="editModal">
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">${escapeHtml(t.profile.editProfile)}</h3>
        <button class="modal-close" id="closeModalBtn" type="button" aria-label="${escapeHtml(t.common.close)}">${CLOSE_ICON}</button>
      </div>
      <div class="auth-error" id="modalError"></div>
      <form class="auth-form" id="editProfileForm">
        <div class="input-field">
          <input type="text" id="editUsername" name="username" maxlength="24" value="${usernameSafe}" required autocomplete="username" autocapitalize="none" spellcheck="false" placeholder=" ">
          <label for="editUsername">${escapeHtml(t.auth.username)}</label>
        </div>
        <div class="field-hint ${hintIsWarning ? 'warning' : ''}" id="usernameHint">${escapeHtml(hintText)}</div>
        <div class="input-field">
          <input type="text" id="editDisplayName" name="display_name" maxlength="50" value="${displayNameSafe}" placeholder=" ">
          <label for="editDisplayName">${escapeHtml(t.auth.displayName)}</label>
        </div>
        <div class="input-field">
          <input type="text" id="editBio" name="bio" maxlength="150" value="${bioSafe}" placeholder=" ">
          <label for="editBio">${escapeHtml(t.profile.bio)}</label>
        </div>
        <button type="submit" class="btn btn-primary" id="saveProfileBtn" disabled>${escapeHtml(t.common.save)}</button>
      </form>
    </div>
  </div>

  <div class="modal-backdrop" id="menuModal">
    <div class="modal-content" style="gap: 12px;">
      <div class="modal-header">
        <h3 class="modal-title">${escapeHtml(t.profile.menuTitle)}</h3>
        <button class="modal-close" id="closeMenuBtn" type="button" aria-label="${escapeHtml(t.common.close)}">${CLOSE_ICON}</button>
      </div>
      <button class="menu-action-btn" id="openSettingsBtn" type="button">
        ${SETTINGS_ICON}
        <span>${escapeHtml(t.nav.settings)}</span>
      </button>
      <button class="menu-action-btn menu-action-danger" id="menuLogoutBtn" type="button">
        ${LOGOUT_ICON}
        <span>${escapeHtml(t.nav.logout)}</span>
      </button>
    </div>
  </div>

  <div class="modal-backdrop" id="settingsModal">
    <div class="modal-content" style="gap: 16px;">
      <div class="modal-header">
        <h3 class="modal-title">${escapeHtml(t.nav.settings)}</h3>
        <button class="modal-close" id="closeSettingsBtn" type="button" aria-label="${escapeHtml(t.common.close)}">${CLOSE_ICON}</button>
      </div>
      <div style="padding: 4px 0 12px 0; border-bottom: 1px solid var(--border-color, #dbdbdb);">
        <div style="font-size: 13px; font-weight: 600; color: #737373; margin-bottom: 8px;">${escapeHtml(t.common.selectLanguage)}</div>
        ${renderLangSwitcherHtml(t.code)}
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <button class="menu-action-btn" id="settingsEditProfileBtn" type="button">
          ${EDIT_ICON}
          <span>${escapeHtml(t.profile.editProfile)}</span>
        </button>
        <button class="menu-action-btn" id="settingsTermsBtn" type="button">
          ${TERMS_ICON}
          <span>${escapeHtml(t.auth.termsModalTitle)}</span>
        </button>
        <button class="menu-action-btn menu-action-danger" id="settingsLogoutBtn" type="button">
          ${LOGOUT_ICON}
          <span>${escapeHtml(t.nav.logout)}</span>
        </button>
      </div>
    </div>
  </div>

  <div class="modal-backdrop" id="termsModal">
    <div class="modal-content" style="max-width: 680px; max-height: 88vh; display: flex; flex-direction: column; padding: 20px;">
      <div class="modal-header notranslate" translate="no" style="padding-bottom: 12px; border-bottom: 1px solid #EBEBEB;">
        <h3 class="modal-title">${escapeHtml(t.auth.termsModalTitle)}</h3>
        <button class="modal-close" id="closeTermsBtn" type="button" aria-label="${escapeHtml(t.common.close)}">${CLOSE_ICON}</button>
      </div>
      <div class="terms-modal-body" style="overflow-y: auto; padding: 4px 4px 16px 4px; flex: 1;">
        ${getLegalCardsHtml(t)}
      </div>
      <div class="notranslate" translate="no" style="display: flex; gap: 8px; justify-content: flex-end; padding-top: 14px; border-top: 1px solid #EBEBEB;">
        <button type="button" class="btn btn-secondary btn-sm" id="closeTermsSecondaryBtn">${escapeHtml(t.common.close)}</button>
      </div>
    </div>
  </div>

  <div class="modal-backdrop" id="logoutModal">
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">${escapeHtml(t.profile.logoutConfirmTitle)}</h3>
        <button class="modal-close" id="closeLogoutModalBtn" type="button" aria-label="${escapeHtml(t.common.close)}">${CLOSE_ICON}</button>
      </div>
      <p style="font-size: 14px; color: #757575;">${escapeHtml(t.profile.logoutConfirmDesc)}</p>
      <div style="display: flex; gap: 8px; margin-top: 8px;">
        <button class="btn btn-secondary btn-sm" id="cancelLogoutBtn" style="flex:1;">${escapeHtml(t.common.cancel)}</button>
        <button class="btn btn-danger btn-sm" id="confirmLogoutBtn" style="flex:1;">${escapeHtml(t.nav.logout)}</button>
      </div>
    </div>
  </div>`
      : ''
  }
</div>`;

  const clientI18n = JSON.stringify({
    lang: t.code,
    dateLocale: getDateLocale(t.code),
    justNow: t.common.justNow,
    minShort: t.common.minutesShort,
    hoursShort: t.common.hoursShort,
    daysShort: t.common.daysShort,
    emptyComments: t.comments.firstCommentPrompt,
    deleteBtn: t.common.delete,
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
    following: t.recommendations.following
  });

  const script = `
${renderCreatePostScript(t)}

(function() {
  var i18n = ${clientI18n};
  var isOwner = ${is_owner ? 'true' : 'false'};
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
  var viewAuthorLink = document.getElementById('viewPostAuthorLink');
  var viewAuthorAvatar = document.getElementById('viewPostAuthorAvatar');
  var viewAuthorName = document.getElementById('viewPostAuthorName');
  var openDeleteBtn = document.getElementById('openDeletePostModalBtn');
  var activePostId = null;
  var isLiking = false;
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

  function updateAuthorHeader(username, avatarKey) {
    if (viewAuthorLink) viewAuthorLink.href = '/u/' + encodeURIComponent(username);
    if (viewAuthorName) viewAuthorName.textContent = username;
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

  function formatCommentTime(dateStr) {
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

  function renderCommentsList(comments) {
    if (!viewCommentsList) return;
    if (!comments || comments.length === 0) {
      viewCommentsList.innerHTML = '<div class="comment-empty-text">' + escapeHtmlClient(i18n.emptyComments) + '</div>';
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

      html += '<div class="comment-item" id="commentItem_' + c.id + '">' +
        '<a href="/u/' + encodeURIComponent(c.username) + '" class="comment-avatar">' + avatarHtml + '</a>' +
        '<div class="comment-content-wrap">' +
          '<div>' +
            '<a href="/u/' + encodeURIComponent(c.username) + '" class="comment-author-name">' + escapeHtmlClient(c.username) + '</a>' +
            '<span class="comment-text">' + renderMentions(c.content) + '</span>' +
          '</div>' +
          '<div class="comment-meta">' +
            '<span class="comment-time">' + formatCommentTime(c.created_at) + '</span>' +
            deleteBtn +
          '</div>' +
        '</div>' +
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
    safe = safe.replace(/#([a-zA-Zа-яА-ЯёЁ0-9_]{2,30})/g, function(match, tag) {
      return '<a href="/explore?tag=' + encodeURIComponent(tag.toLowerCase()) + '" class="caption-hashtag">#' + tag + '</a>';
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
            html += '<div class="feed-rec-user-card" data-user-id="' + u.id + '">' +
              '<a href="/u/' + encodeURIComponent(u.username) + '" class="feed-rec-avatar-link">' +
                '<div class="feed-rec-avatar">' + av + '</div>' +
                '<div class="feed-rec-name">' + escapeHtmlClient(u.display_name || u.username) + '</div>' +
                '<div class="feed-rec-username">@' + escapeHtmlClient(u.username) + '</div>' +
              '</a>' +
              '<button type="button" class="feed-follow-btn" data-user-id="' + u.id + '" data-following="false">' + escapeHtmlClient(i18n.follow) + '</button>' +
            '</div>';
          });
          car.innerHTML = html;
          sec.style.display = 'block';

          car.querySelectorAll('.feed-follow-btn').forEach(function(b) {
            b.onclick = async function(e) {
              e.stopPropagation();
              var uid = parseInt(this.dataset.userId, 10);
              if (!uid) return;
              this.disabled = true;
              try {
                var r = await fetch('/api/users/follow', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ following_id: uid })
                });
                var d = await r.json();
                if (r.ok && d.success) {
                  var nowF = Boolean(d.is_following);
                  this.dataset.following = nowF ? 'true' : 'false';
                  this.textContent = nowF ? i18n.following : i18n.follow;
                  if (nowF) this.classList.add('following');
                  else this.classList.remove('following');
                }
              } catch (err) {} finally {
                this.disabled = false;
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
    var postAuthorUsername = btn.dataset.authorUsername || '${usernameSafe}';
    var postAuthorAvatar = btn.dataset.authorAvatar || '';

    updateAuthorHeader(postAuthorUsername, postAuthorAvatar);

    if (openDeleteBtn) {
      if (Number(postAuthorId) === Number(currentUserId) && Number(currentUserId) > 0) {
        openDeleteBtn.style.display = 'flex';
      } else {
        openDeleteBtn.style.display = 'none';
      }
    }

    if (btn.dataset.date) {
      try {
        var d = new Date(btn.dataset.date.replace(' ', 'T') + 'Z');
        viewDate.textContent = isNaN(d.getTime()) ? btn.dataset.date : d.toLocaleDateString(i18n.dateLocale, { day: 'numeric', month: 'long', year: 'numeric' });
      } catch(e) {
        viewDate.textContent = btn.dataset.date;
      }
    } else {
      viewDate.textContent = '';
    }

    var commentsCount = parseInt(btn.dataset.commentsCount, 10) || 0;
    updateCommentsCountUI(commentsCount);
    if (viewCommentInput) viewCommentInput.value = '';
    if (viewCommentSubmitBtn) viewCommentSubmitBtn.classList.remove('active');
    loadComments(activePostId);
    loadRelatedPosts(activePostId);

    if (window.trackTelemetryEvent) {
      window.trackTelemetryEvent({ type: 'open_modal', post_id: parseInt(activePostId, 10), author_id: postAuthorId });
    }

    viewModal.classList.add('visible');
    syncBodyOverflow();
  }

  function closePostView() {
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
      closePostView();
    }
  });

  if (viewCommentInput) {
    viewCommentInput.addEventListener('input', function() {
      if (this.value.trim().length > 0) {
        viewCommentSubmitBtn.classList.add('active');
      } else {
        viewCommentSubmitBtn.classList.remove('active');
      }
    });
  }

  if (viewCommentForm) {
    viewCommentForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      if (!activePostId) return;
      var text = (viewCommentInput.value || '').trim();
      if (!text) return;

      viewCommentSubmitBtn.disabled = true;
      viewCommentSubmitBtn.textContent = '...';

      try {
        var res = await fetch('/api/posts/comment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ post_id: parseInt(activePostId, 10), content: text })
        });
        var data = await res.json();
        if (res.ok && data.success) {
          viewCommentInput.value = '';
          viewCommentSubmitBtn.classList.remove('active');

          var emptyEl = viewCommentsList.querySelector('.comment-empty-text');
          if (emptyEl) viewCommentsList.innerHTML = '';

          var c = data.comment;
          var initial = escapeHtmlClient((c.display_name || c.username || '?').charAt(0).toUpperCase());
          var avatarHtml = c.avatar_key
            ? '<img src="/media/' + encodeURIComponent(c.avatar_key) + '" alt="' + escapeHtmlClient(c.username) + '">'
            : '<span>' + initial + '</span>';

          var itemDiv = document.createElement('div');
          itemDiv.className = 'comment-item';
          itemDiv.id = 'commentItem_' + c.id;
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

          viewCommentsList.appendChild(itemDiv);
          viewCommentsList.scrollTop = viewCommentsList.scrollHeight;
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
        viewCommentSubmitBtn.disabled = false;
        viewCommentSubmitBtn.textContent = i18n.sendBtn;
        if ((viewCommentInput.value || '').trim()) {
          viewCommentSubmitBtn.classList.add('active');
        }
      }
    });
  }

  if (viewCommentsList) {
    viewCommentsList.addEventListener('click', async function(e) {
      var delBtn = e.target.closest('.comment-delete-btn');
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
            if (item) item.remove();
            updateCommentsCountUI(data.comments_count);
            if (viewCommentsList.children.length === 0) {
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

      confirmDeleteBtn.disabled = true;
      confirmDeleteBtn.textContent = '...';
      if (deleteError) deleteError.classList.remove('visible');

      try {
        var res = await fetch('/api/posts/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ post_id: parseInt(activePostId, 10) })
        });
        var data = await res.json();
        if (res.ok) {
          hideDeleteModal();
          closePostView();
          var item = document.querySelector('[data-post-id="' + activePostId + '"]');
          if (item) item.remove();
          var countEl = document.querySelector('.profile-stats .stat-item:first-child .stat-number');
          if (countEl) {
            var cur = parseInt(countEl.textContent, 10) || 1;
            countEl.textContent = Math.max(0, cur - 1);
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
    var editModal = document.getElementById('editModal');
    var editBtn = document.getElementById('editProfileBtn');
    var closeBtn = document.getElementById('closeModalBtn');
    var editForm = document.getElementById('editProfileForm');
    var modalError = document.getElementById('modalError');
    var saveBtn = document.getElementById('saveProfileBtn');
    var avatarInput = document.getElementById('avatarFileInput');

    var editUsernameInput = document.getElementById('editUsername');
    var editDisplayNameInput = document.getElementById('editDisplayName');
    var editBioInput = document.getElementById('editBio');

    var initialUsername = editUsernameInput ? editUsernameInput.value.trim() : '';
    var initialDisplayName = editDisplayNameInput ? editDisplayNameInput.value.trim() : '';
    var initialBio = editBioInput ? editBioInput.value.trim() : '';

    function checkFormChanges() {
      if (!saveBtn || !editUsernameInput || !editDisplayNameInput || !editBioInput) return;
      var curUser = editUsernameInput.value.trim().toLowerCase();
      var curName = editDisplayNameInput.value.trim();
      var curBio = editBioInput.value.trim();
      var isChanged = (curUser !== initialUsername.toLowerCase()) || (curName !== initialDisplayName) || (curBio !== initialBio);
      var isValid = curUser.length >= 3;
      saveBtn.disabled = !isChanged || !isValid;
    }


    if (editBtn) {
      editBtn.addEventListener('click', function() {
        if (modalError) modalError.classList.remove('visible');
        if (editUsernameInput) editUsernameInput.value = initialUsername;
        if (editDisplayNameInput) editDisplayNameInput.value = initialDisplayName;
        if (editBioInput) editBioInput.value = initialBio;
        if (saveBtn) saveBtn.disabled = true;
        editModal.classList.add('visible');
        syncBodyOverflow();
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        editModal.classList.remove('visible');
        syncBodyOverflow();
      });
    }

    if (editModal) {
      editModal.addEventListener('click', function(e) {
        if (e.target === editModal) {
          editModal.classList.remove('visible');
          syncBodyOverflow();
        }
      });
    }

    if (editForm) {
      editForm.addEventListener('input', checkFormChanges);
    }

    var menuModal = document.getElementById('menuModal');
    var openMenuBtn = document.getElementById('openMenuBtn');
    var closeMenuBtn = document.getElementById('closeMenuBtn');
    var menuLogoutBtn = document.getElementById('menuLogoutBtn');

    var settingsModal = document.getElementById('settingsModal');
    var openSettingsBtn = document.getElementById('openSettingsBtn');
    var closeSettingsBtn = document.getElementById('closeSettingsBtn');
    var settingsEditProfileBtn = document.getElementById('settingsEditProfileBtn');
    var settingsTermsBtn = document.getElementById('settingsTermsBtn');
    var settingsLogoutBtn = document.getElementById('settingsLogoutBtn');

    var termsModal = document.getElementById('termsModal');
    var closeTermsBtn = document.getElementById('closeTermsBtn');
    var closeTermsSecondaryBtn = document.getElementById('closeTermsSecondaryBtn');

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
    }

    if (openSettingsBtn && settingsModal) {
      openSettingsBtn.addEventListener('click', function() {
        if (menuModal) menuModal.classList.remove('visible');
        settingsModal.classList.add('visible');
        syncBodyOverflow();
      });
    }

    if (closeSettingsBtn && settingsModal) {
      closeSettingsBtn.addEventListener('click', function() {
        settingsModal.classList.remove('visible');
        syncBodyOverflow();
      });
    }

    if (settingsModal) {
      settingsModal.addEventListener('click', function(e) {
        if (e.target === settingsModal) {
          settingsModal.classList.remove('visible');
          syncBodyOverflow();
        }
      });
    }

    if (settingsEditProfileBtn && editModal) {
      settingsEditProfileBtn.addEventListener('click', function() {
        if (settingsModal) settingsModal.classList.remove('visible');
        if (modalError) modalError.classList.remove('visible');
        if (editUsernameInput) editUsernameInput.value = initialUsername;
        if (editDisplayNameInput) editDisplayNameInput.value = initialDisplayName;
        if (editBioInput) editBioInput.value = initialBio;
        if (saveBtn) saveBtn.disabled = true;
        editModal.classList.add('visible');
        syncBodyOverflow();
      });
    }

    if (settingsTermsBtn && termsModal) {
      settingsTermsBtn.addEventListener('click', function() {
        if (settingsModal) settingsModal.classList.remove('visible');
        termsModal.classList.add('visible');
        syncBodyOverflow();
      });
    }

    if (closeTermsBtn && termsModal) {
      closeTermsBtn.addEventListener('click', function() {
        termsModal.classList.remove('visible');
        syncBodyOverflow();
      });
    }

    if (closeTermsSecondaryBtn && termsModal) {
      closeTermsSecondaryBtn.addEventListener('click', function() {
        termsModal.classList.remove('visible');
        syncBodyOverflow();
      });
    }

    if (termsModal) {
      termsModal.addEventListener('click', function(e) {
        if (e.target === termsModal) {
          termsModal.classList.remove('visible');
          syncBodyOverflow();
        }
      });
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && termsModal.classList.contains('visible')) {
          termsModal.classList.remove('visible');
          syncBodyOverflow();
        }
      });
    }

    var logoutModal = document.getElementById('logoutModal');
    var closeLogoutBtn = document.getElementById('closeLogoutModalBtn');
    var cancelLogoutBtn = document.getElementById('cancelLogoutBtn');
    var confirmLogoutBtn = document.getElementById('confirmLogoutBtn');

    if (menuLogoutBtn && logoutModal) {
      menuLogoutBtn.addEventListener('click', function() {
        if (menuModal) menuModal.classList.remove('visible');
        logoutModal.classList.add('visible');
        syncBodyOverflow();
      });
    }

    if (settingsLogoutBtn && logoutModal) {
      settingsLogoutBtn.addEventListener('click', function() {
        if (settingsModal) settingsModal.classList.remove('visible');
        logoutModal.classList.add('visible');
        syncBodyOverflow();
      });
    }

    if (closeLogoutBtn) {
      closeLogoutBtn.addEventListener('click', function() {
        logoutModal.classList.remove('visible');
        syncBodyOverflow();
      });
    }

    if (cancelLogoutBtn) {
      cancelLogoutBtn.addEventListener('click', function() {
        logoutModal.classList.remove('visible');
        syncBodyOverflow();
      });
    }

    if (logoutModal) {
      logoutModal.addEventListener('click', function(e) {
        if (e.target === logoutModal) {
          logoutModal.classList.remove('visible');
          syncBodyOverflow();
        }
      });
    }

    if (confirmLogoutBtn) {
      confirmLogoutBtn.addEventListener('click', async function() {
        confirmLogoutBtn.disabled = true;
        confirmLogoutBtn.textContent = '...';
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login';
      });
    }

    if (editForm) {
      editForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        saveBtn.disabled = true;
        modalError.classList.remove('visible');
        try {
          var res = await fetch('/api/profile/update', {
            method: 'POST',
            body: new FormData(this)
          });
          var data = await res.json();
          if (res.ok) {
            var newUsername = data.username || document.getElementById('editUsername').value.trim().toLowerCase();
            var usernameEl = document.querySelector('.profile-header-username');
            if (usernameEl) usernameEl.textContent = newUsername;
            document.getElementById('viewDisplayName').textContent = document.getElementById('editDisplayName').value || newUsername;
            document.getElementById('viewBio').textContent = document.getElementById('editBio').value;
            history.replaceState(null, '', '/u/' + encodeURIComponent(newUsername));

            var hintEl = document.getElementById('usernameHint');
            if (hintEl && typeof data.changes_left === 'number') {
              if (data.changes_left <= 0) {
                hintEl.textContent = i18n.limitWarningTpl;
                hintEl.classList.add('warning');
              } else if (data.changes_left < 3) {
                hintEl.textContent = '3 / ' + data.changes_left;
                hintEl.classList.remove('warning');
              } else {
                hintEl.textContent = i18n.limitNormal;
                hintEl.classList.remove('warning');
              }
            }

            initialUsername = newUsername;
            initialDisplayName = (document.getElementById('editDisplayName').value || '').trim();
            initialBio = (document.getElementById('editBio').value || '').trim();
            saveBtn.disabled = true;

            editModal.classList.remove('visible');
            syncBodyOverflow();
          } else {
            modalError.textContent = data.error || i18n.networkError;
            modalError.classList.add('visible');
            saveBtn.disabled = false;
          }
        } catch (err) {
          modalError.textContent = i18n.networkError;
          modalError.classList.add('visible');
          saveBtn.disabled = false;
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
    followBtn.addEventListener('click', async function() {
      if (isFollowingRequest) return;
      var targetId = parseInt(followBtn.dataset.targetId, 10);
      var wasFollowing = followBtn.dataset.isFollowing === '1';
      var followsYou = followBtn.dataset.followsYou === '1';
      var notFollowingText = followsYou ? i18n.followBackText : i18n.followText;
      var newFollowing = !wasFollowing;

      isFollowingRequest = true;
      followBtn.dataset.isFollowing = newFollowing ? '1' : '0';
      followBtn.className = 'btn ' + (newFollowing ? 'btn-secondary' : 'btn-primary') + ' btn-sm';
      followBtn.textContent = newFollowing ? i18n.followingText : notFollowingText;

      if (followersCountEl) {
        var curCount = parseInt(followersCountEl.textContent, 10) || 0;
        var nextCount = newFollowing ? (curCount + 1) : Math.max(0, curCount - 1);
        followersCountEl.textContent = nextCount;
      }

      try {
        var res = await fetch('/api/profile/follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ following_id: targetId })
        });
        var data = await res.json();
        if (res.ok && data.success) {
          var serverFollowing = Boolean(data.is_following);
          followBtn.dataset.isFollowing = serverFollowing ? '1' : '0';
          followBtn.className = 'btn ' + (serverFollowing ? 'btn-secondary' : 'btn-primary') + ' btn-sm';
          followBtn.textContent = serverFollowing ? i18n.followingText : notFollowingText;
          if (followersCountEl && typeof data.followers_count === 'number') {
            followersCountEl.textContent = data.followers_count;
          }
        } else {
          followBtn.dataset.isFollowing = wasFollowing ? '1' : '0';
          followBtn.className = 'btn ' + (wasFollowing ? 'btn-secondary' : 'btn-primary') + ' btn-sm';
          followBtn.textContent = wasFollowing ? i18n.followingText : notFollowingText;
          if (followersCountEl) {
            var rollCount = parseInt(followersCountEl.textContent, 10) || 0;
            followersCountEl.textContent = wasFollowing ? (rollCount + 1) : Math.max(0, rollCount - 1);
          }
          if (res.status === 401 || (data && data.error && data.error.includes('авториз'))) {
            if (window.showAppAlert) window.showAppAlert({ isAuth: true, message: data ? data.error : '' });
          } else if (data && data.error) {
            if (window.showAppAlert) window.showAppAlert({ message: data.error });
          }
        }
      } catch (err) {
        followBtn.dataset.isFollowing = wasFollowing ? '1' : '0';
        followBtn.className = 'btn ' + (wasFollowing ? 'btn-secondary' : 'btn-primary') + ' btn-sm';
        followBtn.textContent = wasFollowing ? i18n.followingText : notFollowingText;
        if (window.showAppAlert) window.showAppAlert({ message: i18n.networkError });
      } finally {
        isFollowingRequest = false;
      }
    });
  }
})();
`;

  return layout(`${t.common.appName} — ${usernameSafe}`, body, script, t);
}
