import { FeedPost, User } from '../types';
import { layout, escapeHtml } from './layout';
import { renderBottomNav, renderCreatePostModal, renderCreatePostScript } from './nav';
import { COMMENT_ICON, renderCommentsSheetHtml, renderCommentsSheetScript } from './commentsModal';
import { Translations } from '../languages/types';
import { ru } from '../languages/ru';
import { PersonalizedFeedResult } from '../recommendations';

const HEART_ICON = `<svg class="heart-icon-svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
const HEART_BURST_ICON = `<svg viewBox="0 0 24 24" width="80" height="80" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 4px 14px rgba(0,0,0,0.45));"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
const CAMERA_ICON = `<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#B0B0B0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;

function getDateLocale(code: string): string {
  if (code === 'kz') return 'kk-KZ';
  if (code === 'uz') return 'uz-UZ';
  if (code === 'en') return 'en-US';
  return 'ru-RU';
}

function formatFeedTime(dateStr: string, t: Translations): string {
  try {
    const d = new Date(dateStr.replace(' ', 'T') + 'Z');
    if (isNaN(d.getTime())) return dateStr;
    const now = Date.now();
    const diff = Math.floor((now - d.getTime()) / 1000);
    if (diff < 60) return t.common.justNow;
    if (diff < 3600) return `${Math.floor(diff / 60)} ${t.common.minutesShort}`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ${t.common.hoursShort}`;
    if (diff < 7 * 86400) return `${Math.floor(diff / 86400)} ${t.common.daysShort}`;
    return d.toLocaleDateString(getDateLocale(t.code), { day: 'numeric', month: 'short' });
  } catch {
    return dateStr;
  }
}

function formatFullDate(dateStr: string, t: Translations): string {
  try {
    const d = new Date(dateStr.replace(' ', 'T') + 'Z');
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString(getDateLocale(t.code), { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatCaptionWithHashtags(caption: string): string {
  if (!caption) return '';
  const escaped = escapeHtml(caption);
  return escaped.replace(/#([a-zA-Zа-яА-ЯёЁ0-9_]{2,30})/g, (_match, tag) => {
    return `<a href="/explore?tag=${encodeURIComponent(tag.toLowerCase())}" class="caption-hashtag" onclick="event.stopPropagation();">#${tag}</a>`;
  });
}

function renderFeedPostCard(p: FeedPost, t: Translations, isSuggested: boolean = false): string {
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
          <span class="feed-card-username">${escapeHtml(p.username)}</span>
          <span class="feed-card-dot">•</span>
          <span class="feed-card-time">${formatFeedTime(p.created_at, t)}</span>
        </div>
      </a>
      ${isSuggested ? `
      <button type="button" class="feed-card-follow-btn" data-author-id="${p.user_id}" data-following="false">
        ${escapeHtml(t.recommendations.follow)}
      </button>` : ''}
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
    </div>

    <div class="feed-card-likes-count" data-post-id="${p.id}">
      ${t.common.likesCount(p.likes_count ?? 0)}
    </div>

    ${p.caption ? `
    <div class="feed-card-caption">
      <a href="/u/${encodeURIComponent(p.username)}" class="feed-caption-user">${escapeHtml(p.username)}</a>
      ${formatCaptionWithHashtags(p.caption)}
    </div>` : ''}

    <div class="feed-card-comments-link" data-post-id="${p.id}" data-comments-count="${p.comments_count ?? 0}">
      ${p.comments_count && p.comments_count > 0 ? t.feed.viewAllComments(p.comments_count) : t.feed.addComment}
    </div>

    <div class="feed-card-date">${formatFullDate(p.created_at, t)}</div>
  </article>`;
}

export function feedPage(feedInput: PersonalizedFeedResult | FeedPost[], currentUser: User, t: Translations = ru): string {
  let followedPosts: FeedPost[] = [];
  let suggestedPosts: FeedPost[] = [];
  let allCaughtUp = false;
  let recommendedUsers: any[] = [];

  if (Array.isArray(feedInput)) {
    followedPosts = feedInput;
  } else if (feedInput) {
    followedPosts = feedInput.followedPosts || [];
    suggestedPosts = feedInput.suggestedPosts || [];
    allCaughtUp = Boolean(feedInput.allCaughtUp);
    recommendedUsers = feedInput.recommendedUsers || [];
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
              <div class="feed-rec-name">${escapeHtml(u.display_name || u.username)}</div>
              <div class="feed-rec-username">@${escapeHtml(u.username)}</div>
            </a>
            <button type="button" class="feed-follow-btn" data-user-id="${u.id}" data-following="false">${escapeHtml(t.recommendations.follow)}</button>
          </div>`;
        }).join('')}
      </div>
    </div>`
    : '';

  const feedContentHtml = hasAnyPosts
    ? `
    <div class="feed-container">
      ${followedPosts.map(p => renderFeedPostCard(p, t, false)).join('')}
      ${caughtUpBannerHtml}
      ${whoToFollowHtml}
      ${suggestedPosts.map(p => renderFeedPostCard(p, t, true)).join('')}
    </div>`
    : `
    <div class="feed-container">
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
  </header>

  <main class="feed-main">
    ${feedContentHtml}
  </main>

  ${renderBottomNav('feed', t)}
  ${renderCreatePostModal(t)}
  ${renderCommentsSheetHtml(t)}
</div>`;

  const clientI18n = JSON.stringify({
    lang: t.code,
    addComment: t.feed.addComment,
    networkError: t.common.networkError,
    follow: t.recommendations.follow,
    following: t.recommendations.following
  });

  const script = `
${renderCreatePostScript(t)}
${renderCommentsSheetScript(t)}

(function() {
  var i18n = ${clientI18n};

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

  document.querySelectorAll('.feed-like-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var pid = this.dataset.postId;
      toggleLike(pid, false);
    });
  });

  document.querySelectorAll('.feed-comment-btn, .feed-card-comments-link').forEach(function(el) {
    el.addEventListener('click', function(e) {
      e.stopPropagation();
      var pid = this.dataset.postId;
      var card = document.querySelector('.feed-card[data-post-id="' + pid + '"]');
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

  document.querySelectorAll('.feed-card-image-wrap').forEach(function(wrap) {
    wrap.addEventListener('dblclick', function(e) {
      e.preventDefault();
      var pid = this.dataset.postId;
      var coords = getEventCoords(e, this);
      toggleLike(pid, true, coords.x, coords.y);
    });

    var lastTap = 0;
    wrap.addEventListener('touchend', function(e) {
      var now = new Date().getTime();
      var diff = now - lastTap;
      if (diff > 0 && diff < 350) {
        e.preventDefault();
        var pid = this.dataset.postId;
        var coords = getEventCoords(e, this);
        toggleLike(pid, true, coords.x, coords.y);
      }
      lastTap = now;
    });
  });

  document.querySelectorAll('.feed-follow-btn, .feed-card-follow-btn').forEach(function(btn) {
    btn.addEventListener('click', async function(e) {
      e.stopPropagation();
      var targetId = parseInt(this.dataset.userId || this.dataset.authorId, 10);
      if (!targetId) return;
      var isFollowing = this.dataset.following === 'true';
      this.disabled = true;
      try {
        var res = await fetch('/api/users/follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ following_id: targetId })
        });
        var data = await res.json();
        if (res.ok && data.success) {
          var nowFollowing = Boolean(data.is_following);
          document.querySelectorAll('[data-user-id="' + targetId + '"].feed-follow-btn, [data-author-id="' + targetId + '"].feed-card-follow-btn').forEach(function(b) {
            b.dataset.following = nowFollowing ? 'true' : 'false';
            b.textContent = nowFollowing ? i18n.following : i18n.follow;
            if (nowFollowing) b.classList.add('following');
            else b.classList.remove('following');
          });
        }
      } catch(err) {} finally {
        this.disabled = false;
      }
    });
  });
})();
`;

  return layout(`${t.common.appName} — ${t.nav.feed}`, body, script, t);
}
