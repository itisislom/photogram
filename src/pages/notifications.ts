import { NotificationItem, User } from '../types';
import { layout, escapeHtml, safeJsonForScript, renderVerifiedBadge } from './layout';
import { renderBottomNav } from './nav';
import { Translations, ru, formatLocalizedShortDate } from '../languages';

const BACK_ICON = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`;
const BELL_BIG_ICON = `<svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`;

function parseDateSafe(dateStr: string): Date {
  if (!dateStr) return new Date();
  const s = String(dateStr).trim();
  if (s.includes('T')) return new Date(s.endsWith('Z') ? s : s + 'Z');
  return new Date(s.replace(' ', 'T') + 'Z');
}

function formatNotifTime(dateStr: string, t: Translations): string {
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

export function notificationsPage(
  items: NotificationItem[],
  currentUser: User,
  t: Translations = ru,
  theme?: string,
): string {
  const notificationsEnabled = currentUser.notifications_enabled !== 0 && currentUser.notifications_enabled !== false;

  const disabledBannerHtml = !notificationsEnabled
    ? `<div class="notif-disabled-banner">
         <span>${escapeHtml(t.notifications.disabledBanner)}</span>
         <a href="/settings" class="notif-settings-link">${escapeHtml(t.nav.settings)}</a>
       </div>`
    : '';

  const listHtml = items.length > 0
    ? items
        .map((n) => {
          const unameSafe = escapeHtml(n.actor_username);
          const init = (n.actor_display_name || n.actor_username || '?').charAt(0).toUpperCase();
          const avatarHtml = n.actor_avatar_key
            ? `<img src="/media/${encodeURIComponent(n.actor_avatar_key)}" alt="${unameSafe}">`
            : `<span>${escapeHtml(init)}</span>`;

          let actionText = '';
          if (n.type === 'like') {
            actionText = escapeHtml(t.notifications.likedYourPost);
          } else if (n.type === 'follow') {
            actionText = escapeHtml(t.notifications.startedFollowingYou);
          } else {
            const preview = n.comment_preview ? ` «${escapeHtml(n.comment_preview)}»` : '';
            actionText = `${escapeHtml(t.notifications.commentedYourPost)}${preview}`;
          }

          let rightHtml = '';
          if (n.type === 'follow') {
            const btnClass = n.is_following_actor ? 'btn-secondary' : 'btn-primary';
            const btnLabel = n.is_following_actor ? t.profile.following : t.profile.followBack;
            rightHtml = `
              <button type="button" class="btn ${btnClass} btn-sm notif-follow-btn" data-actor-id="${n.actor_id}" data-actor-username="${unameSafe}" data-following="${n.is_following_actor ? '1' : '0'}">
                ${escapeHtml(btnLabel)}
              </button>`;
          } else if (n.post_image_key) {
            rightHtml = `
              <a href="/u/${encodeURIComponent(currentUser.username)}" class="notif-thumb">
                <img src="/media/${encodeURIComponent(n.post_image_key)}" alt="${escapeHtml(t.profile.postsTab)}" loading="lazy">
              </a>`;
          }

          return `
          <div class="notif-row ${n.is_read ? '' : 'is-unread'}">
            <a href="/u/${encodeURIComponent(n.actor_username)}" class="notif-avatar">${avatarHtml}</a>
            <div class="notif-text">
              <a href="/u/${encodeURIComponent(n.actor_username)}" class="notif-username">${unameSafe}${n.actor_is_verified ? renderVerifiedBadge(13) : ''}</a>
              <span class="notif-action">${actionText}</span>
              <span class="notif-time">${escapeHtml(formatNotifTime(n.created_at, t))}</span>
            </div>
            <div class="notif-right">${rightHtml}</div>
          </div>`;
        })
        .join('')
    : `
      <div class="notif-empty">
        <div class="dm-empty-icon">${BELL_BIG_ICON}</div>
        <div class="dm-empty-title">${escapeHtml(t.notifications.emptyTitle)}</div>
        <div class="dm-empty-desc">${escapeHtml(t.notifications.emptyDesc)}</div>
      </div>`;

  const body = `
<div class="app-layout">
  <header class="settings-top-bar">
    <a href="/feed" class="settings-back-btn" aria-label="${escapeHtml(t.post.back)}">
      ${BACK_ICON}
    </a>
    <h1 class="settings-title">${escapeHtml(t.notifications.title)}</h1>
    <div class="settings-top-spacer"></div>
  </header>

  <main class="settings-container">
    <div class="settings-content">
      ${disabledBannerHtml}
      <div class="notif-list">
        ${listHtml}
      </div>
    </div>
  </main>

  ${renderBottomNav('feed', t)}
</div>`;

  const clientI18n = safeJsonForScript({
    following: t.profile.following,
    followBack: t.profile.followBack,
    unfollowTitle: t.profile.unfollowTitle,
    unfollowConfirmTpl: t.profile.unfollowConfirm('{username}'),
    unfollowBtn: t.profile.unfollowBtn,
  });

  const script = `
(function() {
  var i18n = ${clientI18n};
  if (window.updateNotificationsBadge) window.updateNotificationsBadge(0);

  document.querySelectorAll('.notif-follow-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var ref = this;
      var targetId = parseInt(ref.getAttribute('data-actor-id'), 10);
      var uname = ref.getAttribute('data-actor-username') || '';
      if (!targetId || ref.disabled) return;
      var isFollowing = ref.getAttribute('data-following') === '1';

      function runFollow() {
        ref.disabled = true;
        fetch('/api/users/follow', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ following_id: targetId })
        }).then(function(r) { return r.json(); }).then(function(d) {
          if (d && d.success) {
            var nowF = Boolean(d.is_following);
            ref.setAttribute('data-following', nowF ? '1' : '0');
            ref.textContent = nowF ? i18n.following : i18n.followBack;
            ref.classList.remove('btn-primary', 'btn-secondary');
            ref.classList.add(nowF ? 'btn-secondary' : 'btn-primary');
          }
        }).catch(function() {}).finally(function() {
          ref.disabled = false;
        });
      }

      if (isFollowing) {
        var msg = i18n.unfollowConfirmTpl.replace('{username}', uname);
        if (window.showAppConfirm) {
          window.showAppConfirm({
            type: 'unfollow',
            title: i18n.unfollowTitle,
            message: msg,
            okText: i18n.unfollowBtn,
            onOk: runFollow
          });
        } else if (window.confirm(msg)) {
          runFollow();
        }
      } else {
        runFollow();
      }
    });
  });
})();
`;

  return layout(`${t.common.appName} — ${t.notifications.title}`, body, script, t, theme);
}
