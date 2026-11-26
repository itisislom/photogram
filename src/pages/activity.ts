import { User } from '../types';
import { ActivitySection, ActivitySummary } from '../activity';
import { layout, escapeHtml, safeJsonForScript } from './layout';
import { renderBottomNav, CLOSE_ICON } from './nav';
import { Translations } from '../languages/types';
import { ru } from '../languages/ru';

const BACK_ICON = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`;
const CHEVRON_RIGHT_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
const HEART_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
const COMMENT_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;
const FOLLOW_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>`;
const GRID_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`;
const HISTORY_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>`;
const SORT_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5h10"/><path d="M11 9h7"/><path d="M11 13h4"/><path d="m3 17 3 3 3-3"/><path d="M6 18V4"/></svg>`;
const REPLY_SM_ICON = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>`;
const USER_PLUS_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>`;
const EDIT_SM_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const HEART_SM_ICON = `<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
const COMMENT_SM_ICON = `<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;
const VERIFIED_BADGE_SM = `<svg class="verified-badge" width="13" height="13" viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M19.998 3.094 14.638 0l-2.972 5.15H5.432v6.354L0 14.64 3.094 20 0 25.359l5.432 3.137v5.905h5.975L14.638 40l5.36-3.094L25.358 40l3.232-5.6h6.162v-6.01L40 25.359 36.905 20 40 14.641l-5.248-3.03v-6.46h-6.419L25.358 0l-5.36 3.094Z" fill="#0095F6"/><path d="M17.204 27.204 11.2 21.2l2.404-2.404 3.6 3.6 8.8-8.8 2.404 2.404-11.204 11.204Z" fill="#FFFFFF"/></svg>`;

export function activityPage(
  currentUser: User,
  summary: ActivitySummary,
  initialSection: ActivitySection | null,
  t: Translations = ru,
  theme?: string,
): string {
  const totalLikes = summary.liked_posts_count + summary.liked_comments_count;

  const clientConfig = {
    lang: t.code,
    initialSection: initialSection || '',
    summary,
    currentUser: {
      username: currentUser.username,
      displayName: currentUser.display_name || currentUser.username,
      avatarKey: currentUser.avatar_key || '',
      isVerified: Boolean(currentUser.is_verified),
    },
    icons: {
      replySm: REPLY_SM_ICON,
      heartSm: HEART_SM_ICON,
      commentSm: COMMENT_SM_ICON,
      userPlus: USER_PLUS_ICON,
      editSm: EDIT_SM_ICON,
      verified: VERIFIED_BADGE_SM,
      heartBig: HEART_ICON,
      commentBig: COMMENT_ICON,
      followBig: FOLLOW_ICON,
      gridBig: GRID_ICON,
      historyBig: HISTORY_ICON,
    },
    i18n: {
      title: t.activity.title,
      likesTitle: t.activity.likesTitle,
      commentsTitle: t.activity.commentsTitle,
      followsTitle: t.activity.followsTitle,
      postsTitle: t.activity.postsTitle,
      historyTitle: t.activity.historyTitle,
      tabPosts: t.activity.tabPosts,
      tabComments: t.activity.tabComments,
      filterAll: t.activity.filterAll,
      filterComments: t.activity.filterComments,
      filterReplies: t.activity.filterReplies,
      sortNewest: t.activity.sortNewest,
      sortOldest: t.activity.sortOldest,
      selectBtn: t.activity.selectBtn,
      cancelSelect: t.activity.cancelSelect,
      unlikeSelected: t.activity.unlikeSelected,
      deleteSelected: t.activity.deleteSelected,
      unlikeConfirmTitle: t.activity.unlikeConfirmTitle,
      unlikeConfirmDesc: t.activity.unlikeConfirmDesc,
      deleteCommentsConfirmTitle: t.activity.deleteCommentsConfirmTitle,
      deleteCommentsConfirmDesc: t.activity.deleteCommentsConfirmDesc,
      repliedTo: t.activity.repliedTo,
      commentedOnPost: t.activity.commentedOnPost,
      likedCommentBy: t.activity.likedCommentBy,
      followedLabel: t.activity.followedLabel,
      historyCreatedTitle: t.activity.historyCreatedTitle,
      historyCreatedDesc: t.activity.historyCreatedDesc,
      historyUsernameTitle: t.activity.historyUsernameTitle,
      historyUsernameDesc: t.activity.historyUsernameDesc,
      emptyLikesTitle: t.activity.emptyLikesTitle,
      emptyLikesDesc: t.activity.emptyLikesDesc,
      emptyCommentsTitle: t.activity.emptyCommentsTitle,
      emptyCommentsDesc: t.activity.emptyCommentsDesc,
      emptyFollowsTitle: t.activity.emptyFollowsTitle,
      emptyFollowsDesc: t.activity.emptyFollowsDesc,
      emptyPostsTitle: t.activity.emptyPostsTitle,
      emptyPostsDesc: t.activity.emptyPostsDesc,
      emptyHistoryTitle: t.activity.emptyHistoryTitle,
      loadMore: t.activity.loadMore,
      unlikedToast: t.activity.unlikedToast,
      deletedCommentsToast: t.activity.deletedCommentsToast,
      loading: t.common.loading,
      networkError: t.common.networkError,
      justNow: t.common.justNow,
      minutesShort: t.common.minutesShort,
      hoursShort: t.common.hoursShort,
      daysShort: t.common.daysShort,
    },
  };

  const body = `
<div class="app-layout">
  <header class="settings-top-bar activity-top-bar">
    <button type="button" class="settings-back-btn" id="activityBackBtn" aria-label="${escapeHtml(t.common.close)}">
      ${BACK_ICON}
    </button>
    <h1 class="settings-title" id="activityHeaderTitle">${escapeHtml(t.activity.title)}</h1>
    <button type="button" class="activity-select-toggle" id="activitySelectToggleBtn" hidden>${escapeHtml(t.activity.selectBtn)}</button>
    <div class="settings-top-spacer" id="activityTopSpacer"></div>
  </header>

  <main class="settings-container activity-container">
    <div class="settings-content activity-content">
      <div id="activityHubView" class="activity-view">
        <p class="activity-hub-subtitle">${escapeHtml(t.activity.subtitle)}</p>

        <section class="settings-group">
          <div class="settings-group-header">${escapeHtml(t.activity.groupInteractions)}</div>

          <button type="button" class="settings-row settings-row-interactive activity-hub-row" data-open-section="likes">
            <div class="settings-row-left">
              <div class="settings-row-icon">${HEART_ICON}</div>
              <div class="settings-row-text">
                <span class="settings-row-title">${escapeHtml(t.activity.likesTitle)}</span>
                <span class="settings-row-sub">${escapeHtml(t.activity.likesDesc)}</span>
              </div>
            </div>
            <div class="activity-row-right">
              <span class="activity-count-badge" id="actCountLikes">${totalLikes}</span>
              <span class="settings-account-arrow">${CHEVRON_RIGHT_ICON}</span>
            </div>
          </button>

          <button type="button" class="settings-row settings-row-interactive activity-hub-row" data-open-section="comments">
            <div class="settings-row-left">
              <div class="settings-row-icon">${COMMENT_ICON}</div>
              <div class="settings-row-text">
                <span class="settings-row-title">${escapeHtml(t.activity.commentsTitle)}</span>
                <span class="settings-row-sub">${escapeHtml(t.activity.commentsDesc)}</span>
              </div>
            </div>
            <div class="activity-row-right">
              <span class="activity-count-badge" id="actCountComments">${summary.comments_count}</span>
              <span class="settings-account-arrow">${CHEVRON_RIGHT_ICON}</span>
            </div>
          </button>

          <button type="button" class="settings-row settings-row-interactive activity-hub-row" data-open-section="follows">
            <div class="settings-row-left">
              <div class="settings-row-icon">${FOLLOW_ICON}</div>
              <div class="settings-row-text">
                <span class="settings-row-title">${escapeHtml(t.activity.followsTitle)}</span>
                <span class="settings-row-sub">${escapeHtml(t.activity.followsDesc)}</span>
              </div>
            </div>
            <div class="activity-row-right">
              <span class="activity-count-badge" id="actCountFollows">${summary.follows_count}</span>
              <span class="settings-account-arrow">${CHEVRON_RIGHT_ICON}</span>
            </div>
          </button>
        </section>

        <section class="settings-group">
          <div class="settings-group-header">${escapeHtml(t.activity.groupContent)}</div>

          <button type="button" class="settings-row settings-row-interactive activity-hub-row" data-open-section="posts">
            <div class="settings-row-left">
              <div class="settings-row-icon">${GRID_ICON}</div>
              <div class="settings-row-text">
                <span class="settings-row-title">${escapeHtml(t.activity.postsTitle)}</span>
                <span class="settings-row-sub">${escapeHtml(t.activity.postsDesc)}</span>
              </div>
            </div>
            <div class="activity-row-right">
              <span class="activity-count-badge" id="actCountPosts">${summary.posts_count}</span>
              <span class="settings-account-arrow">${CHEVRON_RIGHT_ICON}</span>
            </div>
          </button>
        </section>

        <section class="settings-group">
          <div class="settings-group-header">${escapeHtml(t.activity.groupAccount)}</div>

          <button type="button" class="settings-row settings-row-interactive activity-hub-row" data-open-section="history">
            <div class="settings-row-left">
              <div class="settings-row-icon">${HISTORY_ICON}</div>
              <div class="settings-row-text">
                <span class="settings-row-title">${escapeHtml(t.activity.historyTitle)}</span>
                <span class="settings-row-sub">${escapeHtml(t.activity.historyDesc)}</span>
              </div>
            </div>
            <div class="activity-row-right">
              <span class="activity-count-badge" id="actCountHistory">${summary.history_count}</span>
              <span class="settings-account-arrow">${CHEVRON_RIGHT_ICON}</span>
            </div>
          </button>
        </section>
      </div>

      <div id="activityDetailView" class="activity-view" hidden>
        <div class="activity-toolbar" id="activityToolbar">
          <div class="activity-pills" id="activityPills"></div>
          <button type="button" class="activity-sort-btn" id="activitySortBtn">
            ${SORT_ICON}
            <span id="activitySortLabel">${escapeHtml(t.activity.sortNewest)}</span>
          </button>
        </div>

        <div id="activityListRoot" class="activity-list-root"></div>

        <div id="activityLoadMoreWrap" class="activity-load-more-wrap" hidden>
          <button type="button" class="btn btn-secondary btn-sm" id="activityLoadMoreBtn">${escapeHtml(t.activity.loadMore)}</button>
        </div>
      </div>
    </div>
  </main>

  <div class="activity-bulk-bar" id="activityBulkBar" hidden>
    <button type="button" class="activity-bulk-action-btn" id="activityBulkActionBtn" disabled></button>
  </div>

  ${renderBottomNav('profile', t)}

  <div class="modal-backdrop" id="activityConfirmModal">
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title" id="activityConfirmTitle"></h3>
        <button class="modal-close" id="activityConfirmCloseBtn" type="button" aria-label="${escapeHtml(t.common.close)}">${CLOSE_ICON}</button>
      </div>
      <p id="activityConfirmDesc" style="font-size: 14px; color: var(--text-secondary);"></p>
      <div style="display: flex; gap: 8px; margin-top: 12px;">
        <button type="button" class="btn btn-secondary btn-sm" id="activityConfirmCancelBtn" style="flex:1;">${escapeHtml(t.common.cancel)}</button>
        <button type="button" class="btn btn-danger btn-sm" id="activityConfirmOkBtn" style="flex:1;"></button>
      </div>
    </div>
  </div>
</div>`;

  const script = `
(function() {
  var cfg = ${safeJsonForScript(clientConfig)};
  var i18n = cfg.i18n;
  var icons = cfg.icons;

  var backBtn = document.getElementById('activityBackBtn');
  var headerTitle = document.getElementById('activityHeaderTitle');
  var selectToggleBtn = document.getElementById('activitySelectToggleBtn');
  var topSpacer = document.getElementById('activityTopSpacer');
  var hubView = document.getElementById('activityHubView');
  var detailView = document.getElementById('activityDetailView');
  var pillsEl = document.getElementById('activityPills');
  var sortBtn = document.getElementById('activitySortBtn');
  var sortLabel = document.getElementById('activitySortLabel');
  var listRoot = document.getElementById('activityListRoot');
  var loadMoreWrap = document.getElementById('activityLoadMoreWrap');
  var loadMoreBtn = document.getElementById('activityLoadMoreBtn');
  var bulkBar = document.getElementById('activityBulkBar');
  var bulkActionBtn = document.getElementById('activityBulkActionBtn');

  var confirmModal = document.getElementById('activityConfirmModal');
  var confirmTitle = document.getElementById('activityConfirmTitle');
  var confirmDesc = document.getElementById('activityConfirmDesc');
  var confirmCloseBtn = document.getElementById('activityConfirmCloseBtn');
  var confirmCancelBtn = document.getElementById('activityConfirmCancelBtn');
  var confirmOkBtn = document.getElementById('activityConfirmOkBtn');

  var activeSection = '';
  var likesSubTab = 'likes';
  var commentsFilter = 'all';
  var activeSort = 'newest';
  var currentItems = [];
  var currentOffset = 0;
  var hasMore = false;
  var isLoading = false;
  var selectMode = false;
  var selectedIds = {};
  var pendingBulkSubmit = false;
  var fetchSeq = 0;

  function safeMediaUrl(key, variant) {
    if (!key || typeof key !== 'string') return '';
    if (key.indexOf('..') !== -1 || key.indexOf('\\\\') !== -1) return '';
    var base = '/media/' + encodeURIComponent(key);
    if (variant && key.indexOf('posts/') === 0 && key.slice(-5) === '.webp') {
      return base + '?v=' + encodeURIComponent(variant);
    }
    return base;
  }

  function parseUtcDate(str) {
    if (!str) return null;
    var s = String(str).trim();
    if (!s) return null;
    var iso = s.indexOf('T') !== -1 ? (s.slice(-1) === 'Z' ? s : s + 'Z') : s.replace(' ', 'T') + 'Z';
    var d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }

  function formatActivityDate(str) {
    var d = parseUtcDate(str);
    if (!d) return '';
    try {
      var locale = cfg.lang === 'en' ? 'en-US' : cfg.lang === 'uz' ? 'uz-UZ' : cfg.lang === 'kz' ? 'kk-KZ' : 'ru-RU';
      return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
        hour: '2-digit',
        minute: '2-digit'
      }).format(d);
    } catch (e) {
      var pad = function(n) { return n < 10 ? '0' + n : String(n); };
      return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }
  }

  function updateSummaryBadges(summary) {
    if (!summary) return;
    cfg.summary = summary;
    var likesTotal = Number(summary.liked_posts_count || 0) + Number(summary.liked_comments_count || 0);
    var elLikes = document.getElementById('actCountLikes');
    var elComments = document.getElementById('actCountComments');
    var elFollows = document.getElementById('actCountFollows');
    var elPosts = document.getElementById('actCountPosts');
    var elHistory = document.getElementById('actCountHistory');
    if (elLikes) elLikes.textContent = String(likesTotal);
    if (elComments) elComments.textContent = String(Number(summary.comments_count || 0));
    if (elFollows) elFollows.textContent = String(Number(summary.follows_count || 0));
    if (elPosts) elPosts.textContent = String(Number(summary.posts_count || 0));
    if (elHistory) elHistory.textContent = String(Number(summary.history_count || 0));
  }

  function getSelectedCount() {
    var n = 0;
    for (var k in selectedIds) {
      if (Object.prototype.hasOwnProperty.call(selectedIds, k) && selectedIds[k]) n++;
    }
    return n;
  }

  function getSelectedList() {
    var out = [];
    for (var k in selectedIds) {
      if (Object.prototype.hasOwnProperty.call(selectedIds, k) && selectedIds[k]) {
        var num = parseInt(k, 10);
        if (num > 0) out.push(num);
      }
    }
    return out;
  }

  function canUseSelectMode() {
    return (activeSection === 'likes' || activeSection === 'comments') && currentItems.length > 0;
  }

  function syncSelectControls() {
    var allow = canUseSelectMode();
    if (!allow && selectMode) {
      selectMode = false;
      selectedIds = {};
    }
    if (selectToggleBtn) {
      selectToggleBtn.hidden = !allow;
      selectToggleBtn.textContent = selectMode ? i18n.cancelSelect : i18n.selectBtn;
    }
    if (topSpacer) {
      topSpacer.hidden = allow;
    }
    if (bulkBar && bulkActionBtn) {
      bulkBar.hidden = !selectMode;
      var count = getSelectedCount();
      var tpl = activeSection === 'likes' ? i18n.unlikeSelected : i18n.deleteSelected;
      bulkActionBtn.textContent = tpl.replace('{n}', String(count));
      bulkActionBtn.disabled = count === 0 || pendingBulkSubmit;
    }
  }

  function setSelectMode(enabled) {
    selectMode = Boolean(enabled);
    selectedIds = {};
    syncSelectControls();
    renderCurrentItems();
  }

  function getApiSection() {
    if (activeSection === 'likes') return likesSubTab;
    return activeSection;
  }

  function getSectionTitle(sec) {
    if (sec === 'likes') return i18n.likesTitle;
    if (sec === 'comments') return i18n.commentsTitle;
    if (sec === 'follows') return i18n.followsTitle;
    if (sec === 'posts') return i18n.postsTitle;
    if (sec === 'history') return i18n.historyTitle;
    return i18n.title;
  }

  function renderPills() {
    if (!pillsEl) return;
    pillsEl.textContent = '';
    if (activeSection === 'likes') {
      var tabs = [
        { key: 'likes', label: i18n.tabPosts },
        { key: 'comment_likes', label: i18n.tabComments }
      ];
      tabs.forEach(function(tab) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'activity-pill' + (likesSubTab === tab.key ? ' is-active' : '');
        b.textContent = tab.label;
        b.addEventListener('click', function() {
          if (likesSubTab === tab.key) return;
          likesSubTab = tab.key;
          selectMode = false;
          selectedIds = {};
          renderPills();
          loadSectionItems(true);
        });
        pillsEl.appendChild(b);
      });
    } else if (activeSection === 'comments') {
      var filters = [
        { key: 'all', label: i18n.filterAll },
        { key: 'comments', label: i18n.filterComments },
        { key: 'replies', label: i18n.filterReplies }
      ];
      filters.forEach(function(flt) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'activity-pill' + (commentsFilter === flt.key ? ' is-active' : '');
        b.textContent = flt.label;
        b.addEventListener('click', function() {
          if (commentsFilter === flt.key) return;
          commentsFilter = flt.key;
          selectMode = false;
          selectedIds = {};
          renderPills();
          loadSectionItems(true);
        });
        pillsEl.appendChild(b);
      });
    }
  }

  function renderEmptyState(title, desc, iconHtml) {
    var box = document.createElement('div');
    box.className = 'activity-empty';
    var ic = document.createElement('div');
    ic.className = 'activity-empty-icon';
    ic.innerHTML = iconHtml || '';
    var h = document.createElement('div');
    h.className = 'activity-empty-title';
    h.textContent = title;
    box.appendChild(ic);
    box.appendChild(h);
    if (desc) {
      var p = document.createElement('div');
      p.className = 'activity-empty-desc';
      p.textContent = desc;
      box.appendChild(p);
    }
    listRoot.appendChild(box);
  }

  function createAvatarEl(avatarKey, nameForInitial) {
    var wrap = document.createElement('span');
    wrap.className = 'activity-avatar';
    var url = safeMediaUrl(avatarKey);
    if (url) {
      var img = document.createElement('img');
      img.src = url;
      img.alt = nameForInitial || '';
      img.loading = 'lazy';
      wrap.appendChild(img);
    } else {
      var sp = document.createElement('span');
      sp.textContent = (nameForInitial || '?').charAt(0).toUpperCase();
      wrap.appendChild(sp);
    }
    return wrap;
  }

  function toggleSelection(id, el) {
    var key = String(id);
    if (selectedIds[key]) {
      delete selectedIds[key];
      if (el) el.classList.remove('is-selected');
    } else {
      selectedIds[key] = true;
      if (el) el.classList.add('is-selected');
    }
    syncSelectControls();
  }

  function createCheckCircle(id) {
    var box = document.createElement('span');
    box.className = 'activity-select-check';
    box.setAttribute('aria-hidden', 'true');
    return box;
  }

  function renderCurrentItems() {
    if (!listRoot) return;
    listRoot.textContent = '';

    var apiSec = getApiSection();
    if (!currentItems.length) {
      if (apiSec === 'likes' || apiSec === 'comment_likes') {
        renderEmptyState(i18n.emptyLikesTitle, i18n.emptyLikesDesc, icons.heartBig);
      } else if (apiSec === 'comments') {
        renderEmptyState(i18n.emptyCommentsTitle, i18n.emptyCommentsDesc, icons.commentBig);
      } else if (apiSec === 'follows') {
        renderEmptyState(i18n.emptyFollowsTitle, i18n.emptyFollowsDesc, icons.followBig);
      } else if (apiSec === 'posts') {
        renderEmptyState(i18n.emptyPostsTitle, i18n.emptyPostsDesc, icons.gridBig);
      } else {
        renderEmptyState(i18n.emptyHistoryTitle, '', icons.historyBig);
      }
      syncSelectControls();
      return;
    }

    if (apiSec === 'likes' || apiSec === 'posts') {
      var grid = document.createElement('div');
      grid.className = 'activity-photo-grid';
      currentItems.forEach(function(item) {
        var pid = apiSec === 'likes' ? item.post_id : item.id;
        var author = apiSec === 'likes' ? item.author_username : cfg.currentUser.username;
        var tile = document.createElement(selectMode ? 'button' : 'a');
        tile.className = 'activity-grid-tile' + (selectedIds[String(pid)] ? ' is-selected' : '');
        if (selectMode) {
          tile.type = 'button';
          tile.addEventListener('click', function() {
            toggleSelection(pid, tile);
          });
        } else {
          tile.href = '/u/' + encodeURIComponent(author) + '?post=' + encodeURIComponent(String(pid));
        }
        var img = document.createElement('img');
        img.src = safeMediaUrl(item.image_key, 'thumb');
        img.alt = item.caption || '';
        img.loading = 'lazy';
        tile.appendChild(img);

        if (apiSec === 'posts') {
          var meta = document.createElement('span');
          meta.className = 'activity-grid-stats';
          var st1 = document.createElement('span');
          st1.className = 'activity-grid-stat';
          st1.innerHTML = icons.heartSm;
          var st1Num = document.createElement('span');
          st1Num.textContent = String(item.likes_count || 0);
          st1.appendChild(st1Num);
          var st2 = document.createElement('span');
          st2.className = 'activity-grid-stat';
          st2.innerHTML = icons.commentSm;
          var st2Num = document.createElement('span');
          st2Num.textContent = String(item.comments_count || 0);
          st2.appendChild(st2Num);
          meta.appendChild(st1);
          meta.appendChild(st2);
          tile.appendChild(meta);
        }

        if (selectMode && apiSec === 'likes') {
          tile.appendChild(createCheckCircle(pid));
        }
        grid.appendChild(tile);
      });
      listRoot.appendChild(grid);
      syncSelectControls();
      return;
    }

    var list = document.createElement('div');
    list.className = 'activity-items-list';

    if (apiSec === 'comment_likes') {
      currentItems.forEach(function(item) {
        var row = document.createElement('div');
        row.className = 'activity-item-row' + (selectMode ? ' is-selectable' : '') + (selectedIds[String(item.comment_id)] ? ' is-selected' : '');
        if (selectMode) {
          row.addEventListener('click', function() {
            toggleSelection(item.comment_id, row);
          });
          row.appendChild(createCheckCircle(item.comment_id));
        }

        var avatarLink = document.createElement(selectMode ? 'span' : 'a');
        if (!selectMode) avatarLink.href = '/u/' + encodeURIComponent(item.comment_author_username);
        avatarLink.className = 'activity-item-avatar-link';
        avatarLink.appendChild(createAvatarEl(item.comment_author_avatar_key, item.comment_author_username));
        row.appendChild(avatarLink);

        var bodyCol = document.createElement('div');
        bodyCol.className = 'activity-item-body';

        var topLine = document.createElement('div');
        topLine.className = 'activity-item-context';
        topLine.textContent = i18n.likedCommentBy.replace('{username}', item.comment_author_username);
        bodyCol.appendChild(topLine);

        var textEl = document.createElement('div');
        textEl.className = 'activity-item-text';
        textEl.textContent = item.content || '';
        bodyCol.appendChild(textEl);

        var timeEl = document.createElement('div');
        timeEl.className = 'activity-item-time';
        timeEl.textContent = formatActivityDate(item.liked_at);
        bodyCol.appendChild(timeEl);

        row.appendChild(bodyCol);

        if (item.post_image_key) {
          var thumb = document.createElement(selectMode ? 'span' : 'a');
          thumb.className = 'activity-item-thumb';
          if (!selectMode) {
            thumb.href = '/u/' + encodeURIComponent(item.post_author_username) + '?post=' + encodeURIComponent(String(item.post_id));
          }
          var tImg = document.createElement('img');
          tImg.src = safeMediaUrl(item.post_image_key, 'thumb');
          tImg.alt = '';
          tImg.loading = 'lazy';
          thumb.appendChild(tImg);
          row.appendChild(thumb);
        }

        list.appendChild(row);
      });
    } else if (apiSec === 'comments') {
      currentItems.forEach(function(item) {
        var row = document.createElement('div');
        row.className = 'activity-item-row' + (selectMode ? ' is-selectable' : '') + (selectedIds[String(item.id)] ? ' is-selected' : '');
        if (selectMode) {
          row.addEventListener('click', function() {
            toggleSelection(item.id, row);
          });
          row.appendChild(createCheckCircle(item.id));
        }

        var avatarWrap = document.createElement('span');
        avatarWrap.className = 'activity-item-avatar-link';
        avatarWrap.appendChild(createAvatarEl(cfg.currentUser.avatarKey, cfg.currentUser.displayName));
        row.appendChild(avatarWrap);

        var bodyCol = document.createElement('div');
        bodyCol.className = 'activity-item-body';

        var ctxLine = document.createElement('div');
        ctxLine.className = 'activity-item-context';
        if (item.parent_id && item.parent_author_username) {
          var rIcon = document.createElement('span');
          rIcon.className = 'activity-reply-icon';
          rIcon.innerHTML = icons.replySm;
          ctxLine.appendChild(rIcon);
          var rText = document.createElement('span');
          rText.textContent = i18n.repliedTo.replace('{username}', item.parent_author_username);
          ctxLine.appendChild(rText);
        } else {
          ctxLine.textContent = i18n.commentedOnPost.replace('{username}', item.post_author_username);
        }
        bodyCol.appendChild(ctxLine);

        if (item.parent_id && item.parent_content) {
          var quote = document.createElement('div');
          quote.className = 'activity-parent-quote';
          quote.textContent = item.parent_content;
          bodyCol.appendChild(quote);
        }

        var textEl = document.createElement('div');
        textEl.className = 'activity-item-text';
        textEl.textContent = item.content || '';
        bodyCol.appendChild(textEl);

        var timeEl = document.createElement('div');
        timeEl.className = 'activity-item-time';
        timeEl.textContent = formatActivityDate(item.created_at);
        bodyCol.appendChild(timeEl);

        row.appendChild(bodyCol);

        if (item.post_image_key) {
          var thumb = document.createElement(selectMode ? 'span' : 'a');
          thumb.className = 'activity-item-thumb';
          if (!selectMode) {
            thumb.href = '/u/' + encodeURIComponent(item.post_author_username) + '?post=' + encodeURIComponent(String(item.post_id));
          }
          var tImg = document.createElement('img');
          tImg.src = safeMediaUrl(item.post_image_key, 'thumb');
          tImg.alt = '';
          tImg.loading = 'lazy';
          thumb.appendChild(tImg);
          row.appendChild(thumb);
        }

        list.appendChild(row);
      });
    } else if (apiSec === 'follows') {
      currentItems.forEach(function(item) {
        var row = document.createElement('a');
        row.className = 'activity-item-row activity-item-link';
        row.href = '/u/' + encodeURIComponent(item.username);

        var av = document.createElement('span');
        av.className = 'activity-item-avatar-link';
        av.appendChild(createAvatarEl(item.avatar_key, item.display_name || item.username));
        row.appendChild(av);

        var bodyCol = document.createElement('div');
        bodyCol.className = 'activity-item-body';

        var nameRow = document.createElement('div');
        nameRow.className = 'activity-item-username';
        var uSpan = document.createElement('span');
        uSpan.textContent = item.username;
        nameRow.appendChild(uSpan);
        if (item.is_verified) {
          var vSpan = document.createElement('span');
          vSpan.innerHTML = icons.verified;
          nameRow.appendChild(vSpan);
        }
        bodyCol.appendChild(nameRow);

        if (item.display_name && item.display_name !== item.username) {
          var dispEl = document.createElement('div');
          dispEl.className = 'activity-item-sub';
          dispEl.textContent = item.display_name;
          bodyCol.appendChild(dispEl);
        }

        var timeEl = document.createElement('div');
        timeEl.className = 'activity-item-time';
        timeEl.textContent = i18n.followedLabel + ' · ' + formatActivityDate(item.created_at);
        bodyCol.appendChild(timeEl);

        row.appendChild(bodyCol);
        list.appendChild(row);
      });
    } else if (apiSec === 'history') {
      currentItems.forEach(function(item) {
        var row = document.createElement('div');
        row.className = 'activity-item-row';

        var ic = document.createElement('span');
        ic.className = 'activity-history-icon';
        ic.innerHTML = item.kind === 'created' ? icons.userPlus : icons.editSm;
        row.appendChild(ic);

        var bodyCol = document.createElement('div');
        bodyCol.className = 'activity-item-body';

        var titleEl = document.createElement('div');
        titleEl.className = 'activity-item-username';
        titleEl.textContent = item.kind === 'created' ? i18n.historyCreatedTitle : i18n.historyUsernameTitle;
        bodyCol.appendChild(titleEl);

        var descEl = document.createElement('div');
        descEl.className = 'activity-item-sub';
        descEl.textContent = item.kind === 'created'
          ? i18n.historyCreatedDesc.replace('{username}', item.username || cfg.currentUser.username)
          : i18n.historyUsernameDesc;
        bodyCol.appendChild(descEl);

        var timeEl = document.createElement('div');
        timeEl.className = 'activity-item-time';
        timeEl.textContent = formatActivityDate(item.created_at);
        bodyCol.appendChild(timeEl);

        row.appendChild(bodyCol);
        list.appendChild(row);
      });
    }

    listRoot.appendChild(list);
    syncSelectControls();
  }

  async function loadSectionItems(reset) {
    if (!activeSection) return;
    if (reset) {
      currentItems = [];
      currentOffset = 0;
      hasMore = false;
      if (listRoot) {
        listRoot.textContent = '';
        var loader = document.createElement('div');
        loader.className = 'activity-loading';
        loader.textContent = i18n.loading;
        listRoot.appendChild(loader);
      }
      if (loadMoreWrap) loadMoreWrap.hidden = true;
    }

    var seq = ++fetchSeq;
    isLoading = true;
    if (loadMoreBtn) loadMoreBtn.disabled = true;

    try {
      var apiSec = getApiSection();
      var qs = '?section=' + encodeURIComponent(apiSec) + '&sort=' + encodeURIComponent(activeSort) + '&offset=' + encodeURIComponent(String(currentOffset));
      if (apiSec === 'comments') {
        qs += '&filter=' + encodeURIComponent(commentsFilter);
      }
      var res = await fetch('/api/activity' + qs, { credentials: 'same-origin' });
      var data = null;
      try { data = await res.json(); } catch (e) {}
      if (seq !== fetchSeq) return;
      if (!res.ok || !data || !Array.isArray(data.items)) {
        if (window.showAppToast) window.showAppToast((data && data.error) || i18n.networkError);
        if (reset) renderCurrentItems();
        return;
      }
      currentItems = reset ? data.items : currentItems.concat(data.items);
      currentOffset = currentItems.length;
      hasMore = Boolean(data.has_more);
      if (loadMoreWrap) loadMoreWrap.hidden = !hasMore;
      renderCurrentItems();
    } catch (e) {
      if (seq !== fetchSeq) return;
      if (window.showAppToast) window.showAppToast(i18n.networkError);
      if (reset) renderCurrentItems();
    } finally {
      if (seq === fetchSeq) {
        isLoading = false;
        if (loadMoreBtn) loadMoreBtn.disabled = false;
      }
    }
  }

  function showHub(pushUrl) {
    activeSection = '';
    selectMode = false;
    selectedIds = {};
    currentItems = [];
    hasMore = false;
    if (headerTitle) headerTitle.textContent = i18n.title;
    if (hubView) hubView.hidden = false;
    if (detailView) detailView.hidden = true;
    if (loadMoreWrap) loadMoreWrap.hidden = true;
    syncSelectControls();
    if (pushUrl && window.history && typeof window.history.pushState === 'function') {
      window.history.pushState({ section: '' }, '', '/activity');
    }
  }

  function openSection(sec, pushUrl) {
    if (sec === 'comment_likes') {
      likesSubTab = 'comment_likes';
      sec = 'likes';
    } else if (sec === 'likes') {
      likesSubTab = 'likes';
    }
    if (sec !== 'likes' && sec !== 'comments' && sec !== 'follows' && sec !== 'posts' && sec !== 'history') {
      showHub(false);
      return;
    }
    activeSection = sec;
    selectMode = false;
    selectedIds = {};
    activeSort = 'newest';
    if (sortLabel) sortLabel.textContent = i18n.sortNewest;
    if (headerTitle) headerTitle.textContent = getSectionTitle(sec);
    if (hubView) hubView.hidden = true;
    if (detailView) detailView.hidden = false;
    renderPills();
    syncSelectControls();
    if (pushUrl && window.history && typeof window.history.pushState === 'function') {
      window.history.pushState({ section: sec }, '', '/activity?section=' + encodeURIComponent(sec));
    }
    loadSectionItems(true);
  }

  function openConfirmModal() {
    var count = getSelectedCount();
    if (!count || !confirmModal) return;
    if (activeSection === 'likes') {
      if (confirmTitle) confirmTitle.textContent = i18n.unlikeConfirmTitle;
      if (confirmDesc) confirmDesc.textContent = i18n.unlikeConfirmDesc.replace('{n}', String(count));
      if (confirmOkBtn) confirmOkBtn.textContent = i18n.unlikeSelected.replace('{n}', String(count));
    } else {
      if (confirmTitle) confirmTitle.textContent = i18n.deleteCommentsConfirmTitle;
      if (confirmDesc) confirmDesc.textContent = i18n.deleteCommentsConfirmDesc.replace('{n}', String(count));
      if (confirmOkBtn) confirmOkBtn.textContent = i18n.deleteSelected.replace('{n}', String(count));
    }
    confirmModal.classList.add('visible');
    document.body.style.overflow = 'hidden';
  }

  function closeConfirmModal() {
    if (!confirmModal) return;
    confirmModal.classList.remove('visible');
    document.body.style.overflow = '';
  }

  async function executeBulkAction() {
    var ids = getSelectedList();
    if (!ids.length || pendingBulkSubmit) return;
    pendingBulkSubmit = true;
    if (confirmOkBtn) confirmOkBtn.disabled = true;
    syncSelectControls();

    try {
      var endpoint = activeSection === 'likes' ? '/api/activity/unlike' : '/api/activity/delete-comments';
      var payload = activeSection === 'likes'
        ? { kind: likesSubTab === 'comment_likes' ? 'comment' : 'post', ids: ids }
        : { ids: ids };
      var res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      var data = null;
      try { data = await res.json(); } catch (e) {}
      if (!res.ok || !data || !data.success) {
        if (window.showAppToast) window.showAppToast((data && data.error) || i18n.networkError);
        return;
      }
      var idMap = {};
      ids.forEach(function(id) { idMap[String(id)] = true; });
      currentItems = currentItems.filter(function(item) {
        var key = activeSection === 'likes'
          ? String(likesSubTab === 'comment_likes' ? item.comment_id : item.post_id)
          : String(item.id);
        return !idMap[key];
      });
      currentOffset = currentItems.length;
      if (data.summary) updateSummaryBadges(data.summary);
      closeConfirmModal();
      selectMode = false;
      selectedIds = {};
      renderCurrentItems();
      if (window.showAppToast) {
        window.showAppToast(activeSection === 'likes' ? i18n.unlikedToast : i18n.deletedCommentsToast);
      }
    } catch (e) {
      if (window.showAppToast) window.showAppToast(i18n.networkError);
    } finally {
      pendingBulkSubmit = false;
      if (confirmOkBtn) confirmOkBtn.disabled = false;
      syncSelectControls();
    }
  }

  document.querySelectorAll('.activity-hub-row[data-open-section]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var sec = btn.getAttribute('data-open-section') || '';
      if (sec) openSection(sec, true);
    });
  });

  if (backBtn) {
    backBtn.addEventListener('click', function() {
      if (activeSection) {
        showHub(true);
      } else if (window.spaNavigate) {
        window.spaNavigate('/settings');
      } else {
        window.location.href = '/settings';
      }
    });
  }

  if (selectToggleBtn) {
    selectToggleBtn.addEventListener('click', function() {
      setSelectMode(!selectMode);
    });
  }

  if (sortBtn) {
    sortBtn.addEventListener('click', function() {
      if (isLoading) return;
      activeSort = activeSort === 'newest' ? 'oldest' : 'newest';
      if (sortLabel) sortLabel.textContent = activeSort === 'newest' ? i18n.sortNewest : i18n.sortOldest;
      selectMode = false;
      selectedIds = {};
      loadSectionItems(true);
    });
  }

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', function() {
      if (isLoading || !hasMore) return;
      loadSectionItems(false);
    });
  }

  if (bulkActionBtn) {
    bulkActionBtn.addEventListener('click', openConfirmModal);
  }
  if (confirmCloseBtn) confirmCloseBtn.addEventListener('click', closeConfirmModal);
  if (confirmCancelBtn) confirmCancelBtn.addEventListener('click', closeConfirmModal);
  if (confirmOkBtn) confirmOkBtn.addEventListener('click', executeBulkAction);
  if (confirmModal) {
    confirmModal.addEventListener('click', function(e) {
      if (e.target === confirmModal) closeConfirmModal();
    });
  }

  function onPopState() {
    if (!document.getElementById('activityHubView')) return;
    var sec = '';
    try {
      sec = new URLSearchParams(window.location.search).get('section') || '';
    } catch (e) {}
    if (sec) openSection(sec, false);
    else showHub(false);
  }

  function onKeyDown(e) {
    if (e.key === 'Escape' && confirmModal && confirmModal.classList.contains('visible')) {
      closeConfirmModal();
    }
  }

  window.addEventListener('popstate', onPopState);
  document.addEventListener('keydown', onKeyDown);
  if (window.__pgRegisterCleanup) {
    window.__pgRegisterCleanup(function() {
      window.removeEventListener('popstate', onPopState);
      document.removeEventListener('keydown', onKeyDown);
    });
  }

  if (cfg.initialSection) {
    openSection(cfg.initialSection, false);
  }
})();
`;

  return layout(t.activity.title, body, script, t, theme);
}
