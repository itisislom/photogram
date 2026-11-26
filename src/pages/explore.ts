import { ExploreData, User } from '../types';
import { layout, escapeHtml, safeJsonForScript, renderVerifiedBadge, MORE_DOTS_ICON, TRASH_POST_ICON, postMediaUrl } from './layout';
import { renderBottomNav, CLOSE_ICON } from './nav';
import { COMMENT_ICON, MINI_COMMENT_ICON, renderCommentsSheetHtml, renderCommentsSheetScript } from './commentsModal';
import { Translations } from '../languages/types';
import { ru } from '../languages/ru';
import { formatLocalizedFullDate, formatLocalizedTime, getClientDateFormat } from '../languages';

const SEARCH_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
const HEART_ICON = `<svg class="heart-icon-svg" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
const MINI_HEART_ICON = `<svg viewBox="0 0 24 24" width="12" height="12" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="1"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
const HEART_BURST_ICON = `<svg viewBox="0 0 24 24" width="88" height="88" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 4px 16px rgba(0,0,0,0.5));"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;

function parseDateSafe(dateStr: string): Date {
  if (!dateStr) return new Date();
  const s = String(dateStr).trim();
  if (s.includes('T')) {
    return new Date(s.endsWith('Z') ? s : s + 'Z');
  }
  return new Date(s.replace(' ', 'T') + 'Z');
}

function formatPostDateTime(dateStr: string, t: Translations): string {
  try {
    const d = parseDateSafe(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const dateFormatted = formatLocalizedFullDate(d, t.code);
    const timeFormatted = formatLocalizedTime(d);

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
  data: { posts: any[]; tags?: string[]; activeTag?: string; next_cursor?: string | null; has_more?: boolean } | ExploreData,
  currentUser: User,
  t: Translations = ru,
  theme?: string,
  isAdmin: boolean = false
): string {
  const postList = data.posts || [];
  const tagsList = (data as any).tags || [];
  const activeTag = ((data as any).activeTag || 'all').toLowerCase().trim();
  const initialCursor = (data as any).next_cursor || null;
  const initialHasMore = Boolean((data as any).has_more && initialCursor);

  const tagsPillsHtml = `
  <div class="explore-tags-wrap" id="exploreTagsBar">
    <div class="explore-tags-bar">
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
    </div>
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
            <img src="${postMediaUrl(p.image_key, 'thumb')}" alt="${escapeHtml(t.nav.explore)}" loading="${idx < 6 ? 'eager' : 'lazy'}">
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
    <div class="pics-slide" data-post-id="${p.id}" data-author-id="${p.user_id}" data-post-img="${postMediaUrl(p.image_key, 'full')}" data-post-username="${escapeHtml(p.username)}" data-index="${idx}">
      <div class="pics-image-wrap">
        <img class="pics-image" src="${postMediaUrl(p.image_key, 'full')}" alt="${escapeHtml(t.nav.explore)}" loading="${idx < 3 ? 'eager' : 'lazy'}">
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
        <div class="pics-date" data-ts="${escapeHtml(p.created_at || '')}">${escapeHtml(p.created_at ? formatPostDateTime(p.created_at, t) : '')}</div>
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
      <div id="searchInput" class="search-input pg-ce-input" contenteditable="plaintext-only" role="searchbox" inputmode="search" enterkeyhint="search" spellcheck="false" data-placeholder="${escapeHtml(t.explore.searchPlaceholder)}" data-maxlength="50" aria-label="${escapeHtml(t.explore.searchPlaceholder)}"></div>
      <button type="button" id="clearSearchBtn" class="search-clear-btn" style="display:none;" aria-label="${escapeHtml(t.common.close)}">${CLOSE_ICON}</button>
    </div>
  </div>

  ${tagsPillsHtml}

  <div id="searchResults" class="search-results" style="display:none;"></div>

  <main id="exploreDefaultContent" class="explore-content">
    ${postsGridHtml}
  </main>

  ${renderBottomNav('explore', t)}
  ${renderCommentsSheetHtml(t)}

  <div class="pics-modal" id="picsModal">
    <div class="pics-top-bar">
      <button type="button" class="pics-close-btn" id="closePicsBtn" aria-label="${escapeHtml(t.common.close)}">${CLOSE_ICON}</button>
      <div class="pics-title">Pics</div>
      <div class="pics-top-actions">
        ${isAdmin ? `<button type="button" class="pics-more-btn pics-delete-btn" id="picsDeletePostBtn" aria-label="${escapeHtml(t.post.deletePost)}" title="${escapeHtml(t.post.deletePost)}">${TRASH_POST_ICON}</button>` : ''}
        <button type="button" class="pics-more-btn" id="picsMoreBtn" aria-label="${escapeHtml(t.post.moreOptions)}" title="${escapeHtml(t.post.moreOptions)}">${MORE_DOTS_ICON}</button>
      </div>
    </div>
    <div class="pics-feed" id="picsFeed">
      ${picsSlidesHtml}
    </div>
  </div>
</div>`;

  const clientI18n = safeJsonForScript({
    noResults: t.explore.noResults,
    networkError: t.common.networkError,
    noPosts: t.profile.noPosts,
    justNow: t.common.justNow,
    minShort: t.common.minutesShort,
    hoursShort: t.common.hoursShort,
    daysShort: t.common.daysShort,
    dateFmt: getClientDateFormat(t.code),
    deletePostTitle: t.profile.deletePostConfirmTitle,
    deletePostDesc: t.profile.deletePostConfirmDesc,
    deleteBtn: t.common.delete,
    cancelBtn: t.common.cancel,
    initialTag: activeTag,
    nextCursor: initialCursor,
    hasMore: initialHasMore
  });

  const script = `
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

  if (searchInput && window.pgBindPlainEditable) {
    window.pgBindPlainEditable(searchInput, {});
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
      var pidNum = parseInt(postId, 10);
      if (window.markPostEngaged) window.markPostEngaged(pidNum);
      if (window.trackTelemetryEvent) {
        window.trackTelemetryEvent({ type: 'post_open', post_id: pidNum, author_id: authorId });
      }
    }
    if (window.initTelemetryObserver) {
      window.initTelemetryObserver();
    }
  }

  function closePics() {
    if (!picsModal) return;
    if (window.flushActivePostDwell) window.flushActivePostDwell();
    picsModal.classList.remove('visible');
    document.body.style.overflow = '';
  }

  if (closePicsBtn) {
    closePicsBtn.addEventListener('click', closePics);
  }

  function getActivePicsSlide() {
    if (!picsFeed) return null;
    var slides = picsFeed.querySelectorAll('.pics-slide');
    if (!slides.length) return null;
    var feedRect = picsFeed.getBoundingClientRect();
    var activeSlide = slides[0];
    var bestDist = Infinity;
    slides.forEach(function(s) {
      var r = s.getBoundingClientRect();
      var dist = Math.abs(r.top - feedRect.top);
      if (dist < bestDist) {
        bestDist = dist;
        activeSlide = s;
      }
    });
    return activeSlide;
  }

  var picsMoreBtn = document.getElementById('picsMoreBtn');
  if (picsMoreBtn && picsFeed) {
    picsMoreBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      var activeSlide = getActivePicsSlide();
      if (!activeSlide) return;
      var imgEl = activeSlide.querySelector('.pics-image');
      var imgUrl = activeSlide.dataset.postImg || (imgEl ? imgEl.getAttribute('src') : '');
      if (window.openPostOptionsMenu && imgUrl) {
        window.openPostOptionsMenu({
          img: imgUrl,
          postId: activeSlide.dataset.postId || '',
          username: activeSlide.dataset.postUsername || ''
        });
      }
    });
  }

  var picsDeleteBtn = document.getElementById('picsDeletePostBtn');
  if (picsDeleteBtn && picsFeed) {
    picsDeleteBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (picsDeleteBtn.disabled) return;
      var activeSlide = getActivePicsSlide();
      if (!activeSlide) return;
      var pid = parseInt(activeSlide.dataset.postId, 10);
      if (!pid) return;

      function doDeletePicsPost() {
        picsDeleteBtn.disabled = true;
        fetch('/api/posts/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ post_id: pid })
        }).then(function(r) {
          return r.json().then(function(d) { return { ok: r.ok, d: d }; });
        }).then(function(res) {
          picsDeleteBtn.disabled = false;
          if (res.ok && res.d && res.d.success) {
            activeSlide.remove();
            var gridBtn = document.querySelector('#exploreGrid .post-item-btn[data-post-id="' + pid + '"]');
            if (gridBtn) gridBtn.remove();
            if (!picsFeed.querySelector('.pics-slide')) {
              closePics();
            }
          } else if (window.showAppAlert) {
            window.showAppAlert({ message: (res.d && res.d.error) || i18n.networkError });
          }
        }).catch(function() {
          picsDeleteBtn.disabled = false;
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
          onOk: doDeletePicsPost
        });
      } else if (window.confirm(i18n.deletePostDesc)) {
        doDeletePicsPost();
      }
    });
  }

  document.addEventListener('keydown', function(e) {
    if (picsModal && picsModal.classList.contains('visible')) {
      var postMenu = document.getElementById('appPostMenuModal');
      if (postMenu && postMenu.classList.contains('visible')) return;
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

  if (picsFeed) {
    var isFeedDown = false;
    var isFeedDragging = false;
    var feedStartY = 0;
    var feedLastY = 0;
    var feedStartTime = 0;
    var feedStartScrollTop = 0;
    var hasFeedDragged = false;
    var wheelCooldown = false;

    picsFeed.addEventListener('mousedown', function(e) {
      if (e.button !== 0) return;
      if (e.target && e.target.closest && e.target.closest('.pics-side-bar, .pics-bottom-info, .pics-top-bar, .comments-sheet-panel')) return;

      isFeedDown = true;
      isFeedDragging = false;
      hasFeedDragged = false;
      feedStartY = e.clientY;
      feedLastY = e.clientY;
      feedStartTime = performance.now();
      feedStartScrollTop = picsFeed.scrollTop;
    });

    window.addEventListener('mousemove', function(e) {
      if (!isFeedDown) return;

      var dy = e.clientY - feedStartY;
      if (!isFeedDragging) {
        if (Math.abs(dy) > 6) {
          isFeedDragging = true;
          hasFeedDragged = true;
          picsFeed.style.scrollSnapType = 'none';
          document.body.classList.add('is-mouse-dragging');
        } else {
          return;
        }
      }

      if (e.cancelable) e.preventDefault();
      feedLastY = e.clientY;
      picsFeed.scrollTop = feedStartScrollTop - dy;
    }, { passive: false });

    function endFeedDrag() {
      if (!isFeedDown) return;
      isFeedDown = false;

      if (isFeedDragging) {
        document.body.classList.remove('is-mouse-dragging');
        picsFeed.style.scrollSnapType = '';

        var dy = feedLastY - feedStartY;
        var dt = performance.now() - feedStartTime;
        var v = dt > 10 ? dy / dt : 0;
        var slideH = picsFeed.clientHeight || window.innerHeight;
        var currentSlide = Math.round(feedStartScrollTop / slideH);
        var totalSlides = picsFeed.querySelectorAll('.pics-slide').length;
        var targetIndex = currentSlide;

        if (dy < -60 || (dy < -20 && v < -0.35)) {
          targetIndex = Math.min(totalSlides - 1, currentSlide + 1);
        } else if (dy > 60 || (dy > 20 && v > 0.35)) {
          targetIndex = Math.max(0, currentSlide - 1);
        }

        picsFeed.scrollTo({
          top: targetIndex * slideH,
          behavior: 'smooth'
        });

        setTimeout(function() {
          hasFeedDragged = false;
        }, 50);
      }
    }

    window.addEventListener('mouseup', endFeedDrag);

    picsFeed.addEventListener('click', function(e) {
      if (hasFeedDragged) {
        e.preventDefault();
        e.stopPropagation();
        hasFeedDragged = false;
      }
    }, true);

    picsFeed.addEventListener('wheel', function(e) {
      if (wheelCooldown) {
        e.preventDefault();
        return;
      }

      var delta = e.deltaY;
      if (Math.abs(delta) < 15) return;

      e.preventDefault();
      wheelCooldown = true;

      var slideH = picsFeed.clientHeight || window.innerHeight;
      var currentSlide = Math.round(picsFeed.scrollTop / slideH);
      var totalSlides = picsFeed.querySelectorAll('.pics-slide').length;
      var targetIndex = currentSlide;

      if (delta > 0) {
        targetIndex = Math.min(totalSlides - 1, currentSlide + 1);
      } else {
        targetIndex = Math.max(0, currentSlide - 1);
      }

      picsFeed.scrollTo({
        top: targetIndex * slideH,
        behavior: 'smooth'
      });

      setTimeout(function() {
        wheelCooldown = false;
      }, 400);
    }, { passive: false });
  }

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
    var countEl = likeBtn ? likeBtn.querySelector('.pics-action-count') : null;
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
          if (window.markPostEngaged) window.markPostEngaged(slide.dataset.postId);
          toggleSlideLike(slide, false);
        };
      }

      var authorLink = slide.querySelector('.pics-author-row');
      if (authorLink) {
        authorLink.onclick = function() {
          var pid = parseInt(slide.dataset.postId, 10);
          var aid = parseInt(slide.dataset.authorId, 10) || undefined;
          if (window.markPostEngaged) window.markPostEngaged(pid);
          if (window.trackTelemetryEvent && pid) {
            window.trackTelemetryEvent({ type: 'profile_visit', post_id: pid, author_id: aid });
          }
        };
      }

      var commentBtn = slide.querySelector('.pics-comment-btn');
      if (commentBtn) {
        commentBtn.onclick = function(e) {
          e.stopPropagation();
          var pid = slide.dataset.postId;
          var aid = parseInt(slide.dataset.authorId, 10) || undefined;
          if (window.markPostEngaged) window.markPostEngaged(pid);
          if (window.trackTelemetryEvent && pid) {
            window.trackTelemetryEvent({ type: 'comment_open', post_id: parseInt(pid, 10), author_id: aid });
          }
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

      var touchMoved = false;
      var lastTap = 0;
      slide.ontouchstart = function(e) {
        if (e.target && e.target.closest && e.target.closest('.pics-side-bar, .pics-bottom-info, .pics-top-bar')) return;
        touchMoved = false;
      };
      slide.ontouchmove = function() {
        touchMoved = true;
      };
      slide.ontouchend = function(e) {
        if (touchMoved) return;
        if (e.target && e.target.closest && e.target.closest('.pics-side-bar, .pics-bottom-info, .pics-top-bar')) return;
        var now = new Date().getTime();
        var diff = now - lastTap;
        if (diff > 0 && diff < 350) {
          e.preventDefault();
          var coords = getEventCoords(e, imageWrap || this);
          if (window.markPostEngaged) window.markPostEngaged(slide.dataset.postId);
          toggleSlideLike(slide, true, coords.x, coords.y);
          lastTap = 0;
          return;
        }
        lastTap = now;
      };

      slide.ondblclick = function(e) {
        if (e.target && e.target.closest && e.target.closest('.pics-side-bar, .pics-bottom-info, .pics-top-bar')) return;
        e.preventDefault();
        var coords = getEventCoords(e, imageWrap || this);
        if (window.markPostEngaged) window.markPostEngaged(slide.dataset.postId);
        toggleSlideLike(slide, true, coords.x, coords.y);
      };
    });

    if (window.initTelemetryObserver) {
      window.initTelemetryObserver();
    }
  }

  window.initExploreGridInteractions = bindExploreInteractions;

  function formatExploreDateClient(dateStr) {
    if (!dateStr) return '';
    try {
      var s = String(dateStr).trim();
      var d = s.indexOf('T') !== -1 ? new Date(s.indexOf('Z') !== -1 ? s : s + 'Z') : new Date(s.replace(' ', 'T') + 'Z');
      if (isNaN(d.getTime())) return dateStr;
      var fmt = i18n.dateFmt;
      var day = d.getDate();
      var month = (fmt && fmt.monthsLong && fmt.monthsLong[d.getMonth()]) || '';
      var year = d.getFullYear();
      var dateFormatted = (fmt && fmt.fullPattern === 'mdy') ? (month + ' ' + day + ', ' + year) : (day + ' ' + month + ' ' + year + ((fmt && fmt.yearSuffix) || ''));
      var hh = String(d.getHours()).padStart(2, '0');
      var mm = String(d.getMinutes()).padStart(2, '0');
      var timeFormatted = hh + ':' + mm;
      var diff = Math.floor((Date.now() - d.getTime()) / 1000);
      var relative = '';
      if (diff < 60) relative = i18n.justNow;
      else if (diff < 3600) relative = Math.floor(diff / 60) + ' ' + i18n.minShort;
      else if (diff < 86400) relative = Math.floor(diff / 3600) + ' ' + i18n.hoursShort;
      else if (diff < 7 * 86400) relative = Math.floor(diff / 86400) + ' ' + i18n.daysShort;
      return relative ? (dateFormatted + ', ' + timeFormatted + ' • ' + relative) : (dateFormatted + ', ' + timeFormatted);
    } catch (e) {
      return dateStr;
    }
  }

  function ensureExploreGrid() {
    var gridEl = document.getElementById('exploreGrid');
    if (gridEl) return gridEl;
    if (!defaultContent) return null;
    defaultContent.innerHTML = '<div class="explore-section"><div class="explore-mosaic-grid" id="exploreGrid"></div></div>';
    return document.getElementById('exploreGrid');
  }

  function renderExplorePosts(posts, append) {
    var gridEl = ensureExploreGrid();
    var feedEl = document.getElementById('picsFeed');
    if (!gridEl || !feedEl) return;

    if (!append && (!posts || posts.length === 0)) {
      gridEl.innerHTML = '<div class="profile-empty" style="padding: 40px 16px; grid-column: 1 / -1;">' + escapeHtmlClient(i18n.noPosts) + '</div>';
      feedEl.innerHTML = '';
      return;
    }
    if (append && (!posts || posts.length === 0)) return;

    var baseIdx = append ? gridEl.querySelectorAll('.post-item-btn').length : 0;
    var gridHtml = '';
    var slidesHtml = '';
    var addedOffset = 0;
    for (var i = 0; i < posts.length; i++) {
      var p = posts[i];
      if (!p || !p.id) continue;
      if (append && gridEl.querySelector('.post-item-btn[data-post-id="' + Number(p.id) + '"]')) continue;
      var idx = baseIdx + addedOffset;
      addedOffset++;
      var likes = p.likes_count || 0;
      var comments = p.comments_count || 0;
      var liked = p.is_liked ? '1' : '0';
      var authorInit = (p.display_name || p.username || '?').charAt(0).toUpperCase();
      var avKey = p.author_avatar_key || p.avatar_key || '';
      var avHtml = avKey
        ? '<img src="/media/' + encodeURIComponent(avKey) + '" alt="' + escapeHtmlClient(p.username) + '">'
        : '<span>' + escapeHtmlClient(authorInit) + '</span>';
      var verifiedHtml = (Number(p.is_verified) === 1 && window.renderVerifiedBadge) ? window.renderVerifiedBadge(13) : '';

      var mediaBase = '/media/' + encodeURIComponent(p.image_key || '');
      var isWebpPost = typeof p.image_key === 'string' && p.image_key.slice(-5) === '.webp';
      var thumbUrl = isWebpPost ? (mediaBase + '?v=thumb') : mediaBase;
      var fullUrl = isWebpPost ? (mediaBase + '?v=full') : mediaBase;

      gridHtml += '<button class="explore-grid-item post-item-btn" type="button" data-post-id="' + Number(p.id) + '" data-author-id="' + Number(p.user_id) + '" data-author-verified="' + (Number(p.is_verified) === 1 ? '1' : '0') + '" data-index="' + idx + '" data-likes-count="' + likes + '" data-comments-count="' + comments + '" data-is-liked="' + liked + '">' +
        '<img src="' + thumbUrl + '" alt="Explore" loading="' + (idx < 6 ? 'eager' : 'lazy') + '">' +
        '<div class="explore-item-likes-badge">' +
          '<span class="explore-badge-part">' + ${safeJsonForScript(MINI_HEART_ICON)} + ' <span class="badge-count">' + likes + '</span></span>' +
          '<span class="explore-badge-part">' + ${safeJsonForScript(MINI_COMMENT_ICON)} + ' <span class="badge-comments-count">' + comments + '</span></span>' +
        '</div>' +
      '</button>';

      slidesHtml += '<div class="pics-slide" data-post-id="' + Number(p.id) + '" data-author-id="' + Number(p.user_id) + '" data-post-img="' + fullUrl + '" data-post-username="' + escapeHtmlClient(p.username) + '" data-index="' + idx + '">' +
        '<div class="pics-image-wrap">' +
          '<img class="pics-image" src="' + fullUrl + '" alt="Explore" loading="' + (idx < 3 ? 'eager' : 'lazy') + '">' +
          '<div class="post-like-burst">' + ${safeJsonForScript(HEART_BURST_ICON)} + '</div>' +
        '</div>' +
        '<div class="pics-gradient-overlay"></div>' +
        '<div class="pics-bottom-info">' +
          '<a href="/u/' + encodeURIComponent(p.username) + '" class="pics-author-row">' +
            '<div class="pics-author-avatar">' + avHtml + '</div>' +
            '<span class="pics-author-name">' + escapeHtmlClient(p.username) + verifiedHtml + '</span>' +
          '</a>' +
          (p.caption ? '<div class="pics-caption">' + escapeHtmlClient(p.caption) + '</div>' : '') +
          '<div class="pics-date">' + escapeHtmlClient(formatExploreDateClient(p.created_at || '')) + '</div>' +
        '</div>' +
        '<div class="pics-side-bar">' +
          '<button class="pics-action-btn pics-like-btn ' + (p.is_liked ? 'liked' : '') + '" type="button">' +
            ${safeJsonForScript(HEART_ICON)} +
            '<span class="pics-action-count">' + likes + '</span>' +
          '</button>' +
          '<button class="pics-action-btn pics-comment-btn" type="button" data-post-id="' + Number(p.id) + '" data-comments-count="' + comments + '">' +
            ${safeJsonForScript(COMMENT_ICON)} +
            '<span class="pics-action-count pics-comment-count">' + comments + '</span>' +
          '</button>' +
        '</div>' +
      '</div>';
    }

    if (append) {
      if (gridHtml) gridEl.insertAdjacentHTML('beforeend', gridHtml);
      if (slidesHtml) feedEl.insertAdjacentHTML('beforeend', slidesHtml);
    } else {
      gridEl.innerHTML = gridHtml;
      feedEl.innerHTML = slidesHtml;
    }

    bindExploreInteractions();
  }

  var currentExploreTag = i18n.initialTag || 'all';
  var exploreNextCursor = i18n.nextCursor || null;
  var exploreHasMore = Boolean(i18n.hasMore && exploreNextCursor);
  var exploreLoadingMore = false;
  var prefetchedExplore = null;
  var prefetchExplorePromise = null;
  var exploreEpoch = 0;

  function fetchExplorePage(tag, cursor) {
    var url = '/api/recommendations/explore?tag=' + encodeURIComponent(tag) + '&limit=20';
    if (cursor) url += '&cursor=' + encodeURIComponent(cursor);
    return fetch(url)
      .then(function(res) {
        if (!res.ok) return null;
        return res.json();
      })
      .catch(function() { return null; });
  }

  function prefetchNextExplorePage() {
    if (!exploreHasMore || !exploreNextCursor || prefetchedExplore || prefetchExplorePromise) return;
    var epochAtStart = exploreEpoch;
    var cursorAtStart = exploreNextCursor;
    var tagAtStart = currentExploreTag;
    prefetchExplorePromise = fetchExplorePage(tagAtStart, cursorAtStart).then(function(data) {
      if (data && Array.isArray(data.posts) && epochAtStart === exploreEpoch && cursorAtStart === exploreNextCursor) {
        prefetchedExplore = data;
      }
      return data;
    }).finally(function() {
      prefetchExplorePromise = null;
    });
  }

  async function loadNextExplorePage() {
    if (exploreLoadingMore || !exploreHasMore || !exploreNextCursor) return;
    exploreLoadingMore = true;
    var epochAtStart = exploreEpoch;
    try {
      var data = prefetchedExplore;
      prefetchedExplore = null;
      if (!data && prefetchExplorePromise) {
        data = await prefetchExplorePromise;
        prefetchedExplore = null;
      }
      if (!data) {
        data = await fetchExplorePage(currentExploreTag, exploreNextCursor);
      }
      if (epochAtStart !== exploreEpoch) return;
      if (!data || !Array.isArray(data.posts)) {
        exploreHasMore = false;
        exploreNextCursor = null;
        return;
      }
      renderExplorePosts(data.posts, true);
      exploreNextCursor = data.next_cursor || null;
      exploreHasMore = Boolean(data.has_more && exploreNextCursor);
      if (exploreHasMore) {
        prefetchNextExplorePage();
      }
    } finally {
      exploreLoadingMore = false;
    }
  }

  function checkExploreScroll() {
    if (!exploreHasMore) return;
    if (defaultContent && defaultContent.style.display === 'none') return;
    if (picsModal && picsModal.classList.contains('visible')) return;
    var scrollBottom = (window.scrollY || document.documentElement.scrollTop || 0) + window.innerHeight;
    var docHeight = document.documentElement.scrollHeight || 0;
    var remaining = docHeight - scrollBottom;
    if (remaining < 1600) {
      prefetchNextExplorePage();
    }
    if (remaining < 700) {
      loadNextExplorePage();
    }
  }

  function checkPicsScroll() {
    if (!exploreHasMore || !picsFeed) return;
    var slideH = picsFeed.clientHeight || window.innerHeight || 1;
    var currentSlide = Math.round(picsFeed.scrollTop / slideH);
    var totalSlides = picsFeed.querySelectorAll('.pics-slide').length;
    if (totalSlides > 0 && currentSlide >= totalSlides - 6) {
      prefetchNextExplorePage();
    }
    if (totalSlides > 0 && currentSlide >= totalSlides - 4) {
      loadNextExplorePage();
    }
  }

  window.addEventListener('scroll', checkExploreScroll, { passive: true });
  if (picsFeed) {
    picsFeed.addEventListener('scroll', checkPicsScroll, { passive: true });
  }
  if (exploreHasMore) {
    setTimeout(prefetchNextExplorePage, 150);
  }

  async function selectExploreTag(tag) {
    exploreEpoch++;
    currentExploreTag = tag || 'all';
    exploreNextCursor = null;
    exploreHasMore = false;
    prefetchedExplore = null;
    prefetchExplorePromise = null;
    var epochAtStart = exploreEpoch;

    var pills = document.querySelectorAll('.explore-tag-pill');
    pills.forEach(function(p) {
      if (p.dataset.tag === currentExploreTag) p.classList.add('active');
      else p.classList.remove('active');
    });

    var newUrl = '/explore' + (currentExploreTag === 'all' ? '' : '?tag=' + encodeURIComponent(currentExploreTag));
    history.pushState(null, '', newUrl);

    try {
      var data = await fetchExplorePage(currentExploreTag, null);
      if (epochAtStart !== exploreEpoch) return;
      if (data && data.posts) {
        renderExplorePosts(data.posts, false);
        exploreNextCursor = data.next_cursor || null;
        exploreHasMore = Boolean(data.has_more && exploreNextCursor);
        if (exploreHasMore) {
          prefetchNextExplorePage();
        }
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
    var pill = null;
    document.querySelectorAll('.explore-tag-pill').forEach(function(p) {
      if (!pill && p.dataset && p.dataset.tag === qTag) pill = p;
    });
    if (pill) {
      document.querySelectorAll('.explore-tag-pill').forEach(function(p) { p.classList.remove('active'); });
      pill.classList.add('active');
      pill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  function syncRenderedExploreDates() {
    document.querySelectorAll('.pics-date[data-ts]').forEach(function(el) {
      var ts = el.getAttribute('data-ts');
      if (ts) el.textContent = formatExploreDateClient(ts);
    });
  }

  syncRenderedExploreDates();
  bindExploreInteractions();
})();
`;

  return layout(`${t.common.appName} — ${t.nav.explore}`, body, script, t, theme);
}
