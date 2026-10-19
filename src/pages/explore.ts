import { ExploreData, User } from '../types';
import { layout, escapeHtml, renderVerifiedBadge } from './layout';
import { renderBottomNav, renderCreatePostModal, renderCreatePostScript, CLOSE_ICON } from './nav';
import { COMMENT_ICON, MINI_COMMENT_ICON, renderCommentsSheetHtml, renderCommentsSheetScript } from './commentsModal';
import { Translations } from '../languages/types';
import { ru } from '../languages/ru';

const SEARCH_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
const HEART_ICON = `<svg class="heart-icon-svg" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
const MINI_HEART_ICON = `<svg viewBox="0 0 24 24" width="12" height="12" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="1"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
const HEART_BURST_ICON = `<svg viewBox="0 0 24 24" width="88" height="88" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 4px 16px rgba(0,0,0,0.5));"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;

function getDateLocale(code: string): string {
  if (code === 'kz') return 'kk-KZ';
  if (code === 'uz') return 'uz-UZ';
  if (code === 'en') return 'en-US';
  return 'ru-RU';
}

function formatPostDateTime(dateStr: string, t: Translations): string {
  try {
    const d = new Date(dateStr.replace(' ', 'T') + 'Z');
    if (isNaN(d.getTime())) return dateStr;
    const dateFormatted = d.toLocaleDateString(getDateLocale(t.code), { day: 'numeric', month: 'long', year: 'numeric' });
    const timeFormatted = d.toLocaleTimeString(getDateLocale(t.code), { hour: '2-digit', minute: '2-digit' });

    const now = Date.now();
    const diff = Math.floor((now - d.getTime()) / 1000);
    let relative = '';
    if (diff < 60) {
      relative = t.common.justNow;
    } else if (diff < 3600) {
      relative = `${Math.floor(diff / 60)} ${t.common.minutesShort}`;
    } else if (diff < 86400) {
      relative = `${Math.floor(diff / 3600)} ${t.common.hoursShort}`;
    } else if (diff < 7 * 86400) {
      relative = `${Math.floor(diff / 86400)} ${t.common.daysShort}`;
    }

    if (relative) {
      return `${dateFormatted}, ${timeFormatted} • ${relative}`;
    }
    return `${dateFormatted}, ${timeFormatted}`;
  } catch {
    return dateStr;
  }
}

export function explorePage(
  data: { posts: any[]; tags?: string[]; activeTag?: string } | ExploreData,
  currentUser: User,
  t: Translations = ru
): string {
  const postList = data.posts || [];
  const tagsList = (data as any).tags || [];
  const activeTag = ((data as any).activeTag || 'all').toLowerCase().trim();

  const tagsPillsHtml = `
  <div class="explore-tags-bar" id="exploreTagsBar">
    <button type="button" class="explore-tag-pill ${activeTag === 'all' ? 'active' : ''}" data-tag="all">
      ${escapeHtml(t.recommendations.tagForYou)}
    </button>
    <button type="button" class="explore-tag-pill ${activeTag === 'popular' ? 'active' : ''}" data-tag="popular">
      ${escapeHtml(t.recommendations.tagPopular)}
    </button>
    <button type="button" class="explore-tag-pill ${activeTag === 'recent' ? 'active' : ''}" data-tag="recent">
      ${escapeHtml(t.recommendations.tagRecent)}
    </button>
    ${tagsList.map((tag: string) => `
      <button type="button" class="explore-tag-pill ${activeTag === tag.toLowerCase() ? 'active' : ''}" data-tag="${escapeHtml(tag.toLowerCase())}">
        #${escapeHtml(tag)}
      </button>
    `).join('')}
  </div>`;

  const postsGridHtml = postList.length > 0
    ? `
    <div class="explore-section">
      <div class="explore-mosaic-grid" id="exploreGrid">
        ${postList.map((p, idx) => `
          <button class="explore-grid-item post-item-btn" type="button"
            data-post-id="${p.id}"
            data-author-id="${p.user_id}"
            data-author-verified="${p.is_verified ? '1' : '0'}"
            data-index="${idx}"
            data-likes-count="${p.likes_count ?? 0}"
            data-comments-count="${p.comments_count ?? 0}"
            data-is-liked="${p.is_liked ? '1' : '0'}">
            <img src="/media/${encodeURIComponent(p.image_key)}" alt="${escapeHtml(t.nav.explore)}" loading="${idx < 6 ? 'eager' : 'lazy'}">
            <div class="explore-item-likes-badge">
              <span class="explore-badge-part">${MINI_HEART_ICON} <span class="badge-count">${p.likes_count ?? 0}</span></span>
              <span class="explore-badge-part">${MINI_COMMENT_ICON} <span class="badge-comments-count">${p.comments_count ?? 0}</span></span>
            </div>
          </button>
        `).join('')}
      </div>
    </div>`
    : `
    <div class="explore-section">
      <div class="profile-empty" style="padding: 40px 16px;">
        ${escapeHtml(t.profile.noPosts)}
      </div>
    </div>`;

  const picsSlidesHtml = postList.map((p, idx) => {
    const authorInit = (p.display_name || p.username || '?').charAt(0).toUpperCase();
    const avatarHtml = p.author_avatar_key
      ? `<img src="/media/${encodeURIComponent(p.author_avatar_key)}" alt="${escapeHtml(p.username)}">`
      : `<span>${escapeHtml(authorInit)}</span>`;

    return `
    <div class="pics-slide" data-post-id="${p.id}" data-author-id="${p.user_id}" data-index="${idx}">
      <div class="pics-image-wrap">
        <img class="pics-image" src="/media/${encodeURIComponent(p.image_key)}" alt="${escapeHtml(t.nav.explore)}" loading="${idx < 3 ? 'eager' : 'lazy'}">
        <div class="post-like-burst">
          ${HEART_BURST_ICON}
        </div>
      </div>
      <div class="pics-gradient-overlay"></div>
      <div class="pics-bottom-info">
        <a href="/u/${encodeURIComponent(p.username)}" class="pics-author-row">
          <div class="pics-author-avatar">${avatarHtml}</div>
          <span class="pics-author-name">${escapeHtml(p.username)}${p.is_verified ? renderVerifiedBadge(13) : ''}</span>
        </a>
        ${p.caption ? `<div class="pics-caption">${escapeHtml(p.caption)}</div>` : ''}
        <div class="pics-date">${escapeHtml(p.created_at ? formatPostDateTime(p.created_at, t) : '')}</div>
      </div>
      <div class="pics-side-bar">
        <button class="pics-action-btn pics-like-btn ${p.is_liked ? 'liked' : ''}" type="button" aria-label="${escapeHtml(t.common.likesCount(1))}">
          ${HEART_ICON}
          <span class="pics-action-count">${p.likes_count ?? 0}</span>
        </button>
        <button class="pics-action-btn pics-comment-btn" type="button" data-post-id="${p.id}" data-comments-count="${p.comments_count ?? 0}" aria-label="${escapeHtml(t.comments.title)}">
          ${COMMENT_ICON}
          <span class="pics-action-count pics-comment-count">${p.comments_count ?? 0}</span>
        </button>
      </div>
    </div>`;
  }).join('');

  const body = `
<div class="app-layout">
  <div class="explore-search-wrap">
    <div class="search-input-box">
      <span class="search-icon">${SEARCH_ICON}</span>
      <input type="text" id="searchInput" class="search-input" placeholder="${escapeHtml(t.explore.searchPlaceholder)}" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" maxlength="50">
      <button type="button" id="clearSearchBtn" class="search-clear-btn" style="display:none;" aria-label="${escapeHtml(t.common.close)}">${CLOSE_ICON}</button>
    </div>
  </div>

  ${tagsPillsHtml}

  <div id="searchResults" class="search-results" style="display:none;"></div>

  <main id="exploreDefaultContent" class="explore-content">
    ${postsGridHtml}
  </main>

  ${renderBottomNav('explore', t)}
  ${renderCreatePostModal(t)}
  ${renderCommentsSheetHtml(t)}

  <div class="pics-modal" id="picsModal">
    <div class="pics-top-bar">
      <button type="button" class="pics-close-btn" id="closePicsBtn" aria-label="${escapeHtml(t.common.close)}">${CLOSE_ICON}</button>
      <div class="pics-title">Pics</div>
    </div>
    <div class="pics-feed" id="picsFeed">
      ${picsSlidesHtml}
    </div>
  </div>
</div>`;

  const clientI18n = JSON.stringify({
    noResults: t.explore.noResults,
    networkError: t.common.networkError,
    noPosts: t.profile.noPosts
  });

  const script = `
${renderCreatePostScript(t)}
${renderCommentsSheetScript(t)}

(function() {
  var i18n = ${clientI18n};
  var searchInput = document.getElementById('searchInput');
  var clearBtn = document.getElementById('clearSearchBtn');
  var searchResults = document.getElementById('searchResults');
  var defaultContent = document.getElementById('exploreDefaultContent');
  var tagsBar = document.getElementById('exploreTagsBar');

  var debounceTimer = null;
  var currentAbort = null;

  function escapeHtmlClient(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderUsers(users) {
    searchResults.innerHTML = '';
    if (!users || users.length === 0) {
      var emptyEl = document.createElement('div');
      emptyEl.className = 'search-empty';
      emptyEl.textContent = i18n.noResults;
      searchResults.appendChild(emptyEl);
      return;
    }

    users.forEach(function(u) {
      var a = document.createElement('a');
      a.className = 'search-user-item';
      a.href = '/u/' + encodeURIComponent(u.username);

      var avatarDiv = document.createElement('div');
      avatarDiv.className = 'search-user-avatar';
      if (u.avatar_key) {
        var img = document.createElement('img');
        img.src = '/media/' + encodeURIComponent(u.avatar_key);
        img.alt = u.username;
        avatarDiv.appendChild(img);
      } else {
        var span = document.createElement('span');
        var initial = (u.display_name || u.username || '?').charAt(0).toUpperCase();
        span.textContent = initial;
        avatarDiv.appendChild(span);
      }

      var infoDiv = document.createElement('div');
      infoDiv.className = 'search-user-info';

      var nameDiv = document.createElement('div');
      nameDiv.className = 'search-user-name';
      nameDiv.textContent = u.display_name || u.username;
      if (Number(u.is_verified) === 1 && window.renderVerifiedBadge) {
        nameDiv.insertAdjacentHTML('beforeend', window.renderVerifiedBadge(14));
      }

      var userDiv = document.createElement('div');
      userDiv.className = 'search-user-username';
      userDiv.textContent = u.username;

      infoDiv.appendChild(nameDiv);
      infoDiv.appendChild(userDiv);

      a.appendChild(avatarDiv);
      a.appendChild(infoDiv);

      searchResults.appendChild(a);
    });
  }

  async function performSearch(query) {
    if (currentAbort) {
      currentAbort.abort();
    }
    currentAbort = new AbortController();

    try {
      var res = await fetch('/api/users/search?q=' + encodeURIComponent(query), {
        signal: currentAbort.signal
      });
      if (!res.ok) return;
      var data = await res.json();
      renderUsers(data.users || []);
    } catch (err) {
      if (err.name === 'AbortError') return;
      searchResults.innerHTML = '<div class="search-empty">' + i18n.networkError + '</div>';
    }
  }

  function onSearchInput() {
    var q = searchInput.value.trim();
    if (q.length > 0) {
      clearBtn.style.display = 'flex';
      defaultContent.style.display = 'none';
      if (tagsBar) tagsBar.style.display = 'none';
      searchResults.style.display = 'flex';

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function() {
        performSearch(q);
      }, 250);
    } else {
      clearSearch();
    }
  }

  function clearSearch() {
    searchInput.value = '';
    clearBtn.style.display = 'none';
    searchResults.style.display = 'none';
    searchResults.innerHTML = '';
    defaultContent.style.display = 'block';
    if (tagsBar) tagsBar.style.display = 'flex';
    if (currentAbort) currentAbort.abort();
    clearTimeout(debounceTimer);
  }

  if (searchInput) {
    searchInput.addEventListener('input', onSearchInput);
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', function() {
      clearSearch();
      searchInput.focus();
    });
  }

  var picsModal = document.getElementById('picsModal');
  var closePicsBtn = document.getElementById('closePicsBtn');
  var picsFeed = document.getElementById('picsFeed');

  function openPics(postId) {
    if (!picsModal || !picsFeed) return;
    var targetSlide = picsFeed.querySelector('.pics-slide[data-post-id="' + postId + '"]');
    picsModal.classList.add('visible');
    document.body.style.overflow = 'hidden';

    if (targetSlide) {
      targetSlide.scrollIntoView({ behavior: 'instant', block: 'start' });
      var authorId = parseInt(targetSlide.dataset.authorId, 10) || undefined;
      if (window.trackTelemetryEvent) {
        window.trackTelemetryEvent({ type: 'open_modal', post_id: parseInt(postId, 10), author_id: authorId });
      }
    }
  }

  function closePics() {
    if (!picsModal) return;
    picsModal.classList.remove('visible');
    document.body.style.overflow = '';
  }

  if (closePicsBtn) {
    closePicsBtn.addEventListener('click', closePics);
  }

  document.addEventListener('keydown', function(e) {
    if (picsModal && picsModal.classList.contains('visible')) {
      if (e.key === 'Escape') {
        closePics();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        picsFeed.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        picsFeed.scrollBy({ top: -window.innerHeight, behavior: 'smooth' });
      }
    }
  });

  var isLiking = false;

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

  function showBurst(slide, x, y) {
    if (!slide) return;
    var burst = slide.querySelector('.post-like-burst');
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

  async function toggleSlideLike(slide, forceLikeOnly, x, y) {
    if (!slide || isLiking) return;
    var pid = slide.dataset.postId;
    var likeBtn = slide.querySelector('.pics-like-btn');
    var countEl = slide.querySelector('.pics-action-count');
    var gridBtn = document.querySelector('#exploreGrid .post-item-btn[data-post-id="' + pid + '"]');

    var wasLiked = likeBtn ? likeBtn.classList.contains('liked') : false;
    var prevCount = parseInt(countEl ? countEl.textContent : '0', 10) || 0;

    if (forceLikeOnly && wasLiked) {
      showBurst(slide, x, y);
      return;
    }

    var newLiked = forceLikeOnly ? true : !wasLiked;
    var newCount = newLiked ? (prevCount + (wasLiked ? 0 : 1)) : Math.max(0, prevCount - 1);

    isLiking = true;
    if (likeBtn) {
      if (newLiked) likeBtn.classList.add('liked');
      else likeBtn.classList.remove('liked');
      animateBtn(likeBtn);
    }
    if (countEl) countEl.textContent = newCount;
    if (newLiked) showBurst(slide, x, y);

    if (gridBtn) {
      gridBtn.dataset.isLiked = newLiked ? '1' : '0';
      gridBtn.dataset.likesCount = newCount;
      var badgeEl = gridBtn.querySelector('.badge-count');
      if (badgeEl) badgeEl.textContent = newCount;
    }

    try {
      var res = await fetch('/api/posts/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: parseInt(pid, 10) })
      });
      var data = await res.json();
      if (res.ok && data.success) {
        var serverLiked = Boolean(data.liked);
        var serverCount = typeof data.likes_count === 'number' ? data.likes_count : newCount;
        if (likeBtn) {
          if (serverLiked) likeBtn.classList.add('liked');
          else likeBtn.classList.remove('liked');
        }
        if (countEl) countEl.textContent = serverCount;
        if (gridBtn) {
          gridBtn.dataset.isLiked = serverLiked ? '1' : '0';
          gridBtn.dataset.likesCount = serverCount;
          var bEl = gridBtn.querySelector('.badge-count');
          if (bEl) bEl.textContent = serverCount;
        }
      } else {
        if (likeBtn) {
          if (wasLiked) likeBtn.classList.add('liked');
          else likeBtn.classList.remove('liked');
        }
        if (countEl) countEl.textContent = prevCount;
        if (gridBtn) {
          gridBtn.dataset.isLiked = wasLiked ? '1' : '0';
          gridBtn.dataset.likesCount = prevCount;
          var bEl2 = gridBtn.querySelector('.badge-count');
          if (bEl2) bEl2.textContent = prevCount;
        }
        if (res.status === 401 || (data && data.error && (data.error.includes('авториз') || data.error.includes('войти')))) {
          if (window.showAppAlert) window.showAppAlert({ isAuth: true, message: data ? data.error : '' });
        }
      }
    } catch (err) {
      if (likeBtn) {
        if (wasLiked) likeBtn.classList.add('liked');
        else likeBtn.classList.remove('liked');
      }
      if (countEl) countEl.textContent = prevCount;
      if (gridBtn) {
        gridBtn.dataset.isLiked = wasLiked ? '1' : '0';
        gridBtn.dataset.likesCount = prevCount;
        var bEl3 = gridBtn.querySelector('.badge-count');
        if (bEl3) bEl3.textContent = prevCount;
      }
      if (window.showAppAlert) window.showAppAlert({ message: i18n.networkError });
    } finally {
      isLiking = false;
    }
  }

  function bindExploreInteractions() {
    document.querySelectorAll('#exploreGrid .post-item-btn').forEach(function(btn) {
      btn.onclick = function() {
        var pid = this.dataset.postId;
        openPics(pid);
      };
    });

    document.querySelectorAll('.pics-slide').forEach(function(slide) {
      var likeBtn = slide.querySelector('.pics-like-btn');
      var imageWrap = slide.querySelector('.pics-image-wrap');

      if (likeBtn) {
        likeBtn.onclick = function(e) {
          e.stopPropagation();
          toggleSlideLike(slide, false);
        };
      }

      var commentBtn = slide.querySelector('.pics-comment-btn');
      if (commentBtn) {
        commentBtn.onclick = function(e) {
          e.stopPropagation();
          var pid = slide.dataset.postId;
          var countEl = commentBtn.querySelector('.pics-comment-count');
          var currentCount = parseInt(commentBtn.dataset.commentsCount, 10) || 0;
          var gridBtn = document.querySelector('#exploreGrid .post-item-btn[data-post-id="' + pid + '"]');

          if (window.openCommentsSheet) {
            window.openCommentsSheet(pid, {
              initialCount: currentCount,
              onCountUpdate: function(newCount) {
                commentBtn.dataset.commentsCount = newCount;
                if (countEl) countEl.textContent = newCount;
                if (gridBtn) {
                  gridBtn.dataset.commentsCount = newCount;
                  var bCount = gridBtn.querySelector('.badge-comments-count');
                  if (bCount) bCount.textContent = newCount;
                }
              }
            });
          }
        };
      }

      if (imageWrap) {
        imageWrap.ondblclick = function(e) {
          e.preventDefault();
          var coords = getEventCoords(e, this);
          toggleSlideLike(slide, true, coords.x, coords.y);
        };

        var lastTap = 0;
        imageWrap.ontouchend = function(e) {
          var now = new Date().getTime();
          var diff = now - lastTap;
          if (diff > 0 && diff < 350) {
            e.preventDefault();
            var coords = getEventCoords(e, this);
            toggleSlideLike(slide, true, coords.x, coords.y);
          }
          lastTap = now;
        };
      }
    });

    if (window.initTelemetryObserver) {
      window.initTelemetryObserver();
    }
  }

  window.initExploreGridInteractions = bindExploreInteractions;

  function renderExplorePosts(posts) {
    var gridEl = document.getElementById('exploreGrid');
    var feedEl = document.getElementById('picsFeed');
    if (!gridEl || !feedEl) return;

    if (!posts || posts.length === 0) {
      gridEl.innerHTML = '<div class="profile-empty" style="padding: 40px 16px; grid-column: 1 / -1;">' + escapeHtmlClient(i18n.noPosts) + '</div>';
      feedEl.innerHTML = '';
      return;
    }

    var gridHtml = '';
    var slidesHtml = '';
    for (var idx = 0; idx < posts.length; idx++) {
      var p = posts[idx];
      var likes = p.likes_count || 0;
      var comments = p.comments_count || 0;
      var liked = p.is_liked ? '1' : '0';
      var authorInit = (p.display_name || p.username || '?').charAt(0).toUpperCase();
      var avHtml = p.author_avatar_key
        ? '<img src="/media/' + encodeURIComponent(p.author_avatar_key) + '" alt="' + escapeHtmlClient(p.username) + '">'
        : '<span>' + escapeHtmlClient(authorInit) + '</span>';

      gridHtml += '<button class="explore-grid-item post-item-btn" type="button" data-post-id="' + p.id + '" data-author-id="' + p.user_id + '" data-index="' + idx + '" data-likes-count="' + likes + '" data-comments-count="' + comments + '" data-is-liked="' + liked + '">' +
        '<img src="/media/' + encodeURIComponent(p.image_key) + '" alt="Explore" loading="' + (idx < 6 ? 'eager' : 'lazy') + '">' +
        '<div class="explore-item-likes-badge">' +
          '<span class="explore-badge-part">' + ${JSON.stringify(MINI_HEART_ICON)} + ' <span class="badge-count">' + likes + '</span></span>' +
          '<span class="explore-badge-part">' + ${JSON.stringify(MINI_COMMENT_ICON)} + ' <span class="badge-comments-count">' + comments + '</span></span>' +
        '</div>' +
      '</button>';

      slidesHtml += '<div class="pics-slide" data-post-id="' + p.id + '" data-author-id="' + p.user_id + '" data-index="' + idx + '">' +
        '<div class="pics-image-wrap">' +
          '<img class="pics-image" src="/media/' + encodeURIComponent(p.image_key) + '" alt="Explore" loading="' + (idx < 3 ? 'eager' : 'lazy') + '">' +
          '<div class="post-like-burst">' + ${JSON.stringify(HEART_BURST_ICON)} + '</div>' +
        '</div>' +
        '<div class="pics-gradient-overlay"></div>' +
        '<div class="pics-bottom-info">' +
          '<a href="/u/' + encodeURIComponent(p.username) + '" class="pics-author-row">' +
            '<div class="pics-author-avatar">' + avHtml + '</div>' +
            '<span class="pics-author-name">' + escapeHtmlClient(p.username) + '</span>' +
          '</a>' +
          (p.caption ? '<div class="pics-caption">' + escapeHtmlClient(p.caption) + '</div>' : '') +
          '<div class="pics-date">' + escapeHtmlClient(p.created_at || '') + '</div>' +
        '</div>' +
        '<div class="pics-side-bar">' +
          '<button class="pics-action-btn pics-like-btn ' + (p.is_liked ? 'liked' : '') + '" type="button">' +
            ${JSON.stringify(HEART_ICON)} +
            '<span class="pics-action-count">' + likes + '</span>' +
          '</button>' +
          '<button class="pics-action-btn pics-comment-btn" type="button" data-post-id="' + p.id + '" data-comments-count="' + comments + '">' +
            ${JSON.stringify(COMMENT_ICON)} +
            '<span class="pics-action-count pics-comment-count">' + comments + '</span>' +
          '</button>' +
        '</div>' +
      '</div>';
    }

    gridEl.innerHTML = gridHtml;
    feedEl.innerHTML = slidesHtml;

    bindExploreInteractions();
  }

  async function selectExploreTag(tag) {
    var pills = document.querySelectorAll('.explore-tag-pill');
    pills.forEach(function(p) {
      if (p.dataset.tag === tag) p.classList.add('active');
      else p.classList.remove('active');
    });

    var newUrl = '/explore' + (tag === 'all' ? '' : '?tag=' + encodeURIComponent(tag));
    history.pushState(null, '', newUrl);

    try {
      var res = await fetch('/api/recommendations/explore?tag=' + encodeURIComponent(tag));
      var data = await res.json();
      if (res.ok && data.posts) {
        renderExplorePosts(data.posts);
      }
    } catch(err) {}
  }

  document.querySelectorAll('.explore-tag-pill').forEach(function(pill) {
    pill.addEventListener('click', function() {
      var tag = this.dataset.tag || 'all';
      selectExploreTag(tag);
    });
  });

  var urlParams = new URLSearchParams(window.location.search);
  var qTag = (urlParams.get('tag') || '').toLowerCase().trim();
  if (qTag && qTag !== 'all') {
    var pill = document.querySelector('.explore-tag-pill[data-tag="' + qTag + '"]');
    if (pill) {
      document.querySelectorAll('.explore-tag-pill').forEach(function(p) { p.classList.remove('active'); });
      pill.classList.add('active');
      pill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  bindExploreInteractions();
})();
`;

  return layout(`${t.common.appName} — ${t.nav.explore}`, body, script, t);
}
