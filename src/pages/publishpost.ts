import { User } from '../types';
import { layout, esc, safeJsonForScript } from './layout';
import { SEND_COMMENT_ICON } from './commentsModal';
import { Translations } from '../languages/types';
import { ru } from '../languages/ru';

const BACK_ARROW_ICON = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>`;
const UPLOAD_ICON = `<svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" ry="3"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
const ZOOM_OUT_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`;
const ZOOM_IN_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`;

export function publishPostPage(
  currentUser: User,
  t: Translations = ru,
  theme?: string
): string {
  const clientI18n = safeJsonForScript({
    publishBtn: t.post.publishBtn,
    publishing: t.post.publishing,
    networkError: t.common.networkError,
    targetProfileUrl: `/u/${encodeURIComponent(currentUser.username)}`,
  });

  const body = `
<div class="app-layout publishpost-layout">
  <header class="publishpost-top-bar">
    <a href="/feed" class="publishpost-back-btn" id="publishBackBtn" aria-label="${esc(t.post.back)}">
      ${BACK_ARROW_ICON}
    </a>
    <h1 class="publishpost-title">${esc(t.post.newPostTitle)}</h1>
    <button type="submit" form="publishPostForm" class="publishpost-submit-btn" id="submitPostBtn" aria-label="${esc(t.post.publishBtn)}" title="${esc(t.post.publishBtn)}" disabled>
      ${SEND_COMMENT_ICON}
    </button>
  </header>

  <main class="publishpost-container">
    <form id="publishPostForm" class="publishpost-form" autocomplete="off">
      <div class="publishpost-media-section">
        <label for="postFileInput" class="publishpost-dropzone" id="postDropzone">
          <span class="publishpost-dropzone-icon">${UPLOAD_ICON}</span>
          <span class="publishpost-dropzone-text">${esc(t.post.selectPhotoDropzone)}</span>
          <span class="publishpost-select-btn">${esc(t.post.selectPhotoBtn)}</span>
        </label>
        <input type="file" id="postFileInput" style="display:none">

        <div class="post-crop-wrap publishpost-crop-wrap" id="postCropWrap" style="display:none;">
          <div class="crop-viewport publishpost-crop-viewport" id="cropViewport">
            <img id="cropImage" src="" alt="${esc(t.post.newPostTitle)}" draggable="false">
            <svg class="crop-grid" id="cropGrid" viewBox="0 0 100 100" preserveAspectRatio="none">
              <line x1="33.333" y1="0" x2="33.333" y2="100" />
              <line x1="66.667" y1="0" x2="66.667" y2="100" />
              <line x1="0" y1="33.333" x2="100" y2="33.333" />
              <line x1="0" y1="66.667" x2="100" y2="66.667" />
              <rect x="0" y="0" width="100" height="100" />
            </svg>
          </div>
          <div class="crop-controls">
            <span class="crop-zoom-icon">${ZOOM_OUT_ICON}</span>
            <input type="range" id="cropZoomSlider" class="crop-zoom-slider" min="1" max="3" step="0.01" value="1" aria-label="Zoom">
            <span class="crop-zoom-icon">${ZOOM_IN_ICON}</span>
            <button type="button" class="publishpost-replace-btn" id="postChangePhotoBtn">${esc(t.post.replacePhoto)}</button>
          </div>
        </div>
      </div>

      <div class="publishpost-body">
        <div class="publishpost-error" id="publishPostError" role="alert"></div>

        <div class="post-caption-block">
          <div class="post-caption-header">
            <label for="postCaptionInput" class="post-caption-label">${esc(t.post.captionLabel)}</label>
            <span class="post-caption-counter" id="postCaptionCounter">0 / 1000</span>
          </div>
          <textarea id="postCaptionInput" name="caption" maxlength="1000" rows="4" class="post-caption-textarea" autocomplete="off" data-lpignore="true" data-1p-ignore="true" data-form-type="other" placeholder="${esc(t.post.captionPlaceholder)}"></textarea>
        </div>
      </div>
    </form>
  </main>
</div>`;

  const script = `
(function() {
  var i18n = ${clientI18n};
  var backBtn = document.getElementById('publishBackBtn');
  var fileInput = document.getElementById('postFileInput');
  var dropzone = document.getElementById('postDropzone');
  var cropWrap = document.getElementById('postCropWrap');
  var cropViewport = document.getElementById('cropViewport');
  var cropImg = document.getElementById('cropImage');
  var cropGrid = document.getElementById('cropGrid');
  var zoomSlider = document.getElementById('cropZoomSlider');
  var changePhotoBtn = document.getElementById('postChangePhotoBtn');
  var captionInput = document.getElementById('postCaptionInput');
  var captionCounter = document.getElementById('postCaptionCounter');
  var submitBtn = document.getElementById('submitPostBtn');
  var errorEl = document.getElementById('publishPostError');
  var form = document.getElementById('publishPostForm');

  var loadedImg = null;
  var zoom = 1.0;
  var baseScale = 1.0;
  var currentX = 0;
  var currentY = 0;
  var viewportSize = 0;
  var isSubmitting = false;

  var isDragging = false;
  var dragStartX = 0;
  var dragStartY = 0;
  var dragInitialX = 0;
  var dragInitialY = 0;

  var initialPinchDistance = 0;
  var initialPinchZoom = 1;
  var pinchFocalX = 0;
  var pinchFocalY = 0;

  var gridActiveTimeout = null;

  if (backBtn) {
    backBtn.addEventListener('click', function(e) {
      if (window.history.length > 1 && (!document.referrer || document.referrer.indexOf(window.location.origin) === 0)) {
        e.preventDefault();
        window.history.back();
      }
    });
  }

  function showError(msg) {
    if (!errorEl) return;
    errorEl.textContent = msg || i18n.networkError;
    errorEl.classList.add('visible');
  }

  function hideError() {
    if (!errorEl) return;
    errorEl.textContent = '';
    errorEl.classList.remove('visible');
  }

  function setGridActive(active) {
    if (!cropGrid) return;
    if (active) {
      cropGrid.classList.add('active');
      if (gridActiveTimeout) clearTimeout(gridActiveTimeout);
      gridActiveTimeout = setTimeout(function() {
        if (cropGrid) cropGrid.classList.remove('active');
      }, 500);
    } else {
      if (gridActiveTimeout) clearTimeout(gridActiveTimeout);
      cropGrid.classList.remove('active');
    }
  }

  function clampOffsets() {
    if (!loadedImg || !viewportSize) return;
    var dispW = loadedImg.naturalWidth * baseScale * zoom;
    var dispH = loadedImg.naturalHeight * baseScale * zoom;

    var minX = viewportSize - dispW;
    var maxX = 0;
    if (currentX < minX) currentX = minX;
    if (currentX > maxX) currentX = maxX;

    var minY = viewportSize - dispH;
    var maxY = 0;
    if (currentY < minY) currentY = minY;
    if (currentY > maxY) currentY = maxY;
  }

  function applyTransform() {
    if (!cropImg || !loadedImg) return;
    var dispW = loadedImg.naturalWidth * baseScale * zoom;
    var dispH = loadedImg.naturalHeight * baseScale * zoom;
    cropImg.style.width = dispW + 'px';
    cropImg.style.height = dispH + 'px';
    cropImg.style.transform = 'translate3d(' + currentX + 'px, ' + currentY + 'px, 0)';
  }

  function updateSliderProgress(val) {
    if (!zoomSlider) return;
    var pct = Math.max(0, Math.min(100, ((val - 1) / 2) * 100));
    zoomSlider.style.setProperty('--zoom-progress', pct + '%');
  }

  function setZoom(newZoom, focalX, focalY) {
    if (!loadedImg || !viewportSize) return;
    newZoom = Math.max(1.0, Math.min(3.0, newZoom));
    if (typeof focalX !== 'number') focalX = viewportSize / 2;
    if (typeof focalY !== 'number') focalY = viewportSize / 2;

    var prevW = loadedImg.naturalWidth * baseScale * zoom;
    var prevH = loadedImg.naturalHeight * baseScale * zoom;

    var u = (focalX - currentX) / prevW;
    var v = (focalY - currentY) / prevH;

    zoom = newZoom;
    if (zoomSlider) zoomSlider.value = String(zoom);
    updateSliderProgress(zoom);

    var newW = loadedImg.naturalWidth * baseScale * zoom;
    var newH = loadedImg.naturalHeight * baseScale * zoom;

    currentX = focalX - u * newW;
    currentY = focalY - v * newH;

    clampOffsets();
    applyTransform();
    setGridActive(true);
  }

  function clearUploadState() {
    loadedImg = null;
    zoom = 1.0;
    baseScale = 1.0;
    currentX = 0;
    currentY = 0;
    viewportSize = 0;
    if (fileInput) fileInput.value = '';
    if (cropImg) {
      cropImg.src = '';
      cropImg.style.transform = '';
      cropImg.style.width = '';
      cropImg.style.height = '';
    }
    if (cropWrap) cropWrap.style.display = 'none';
    if (dropzone) dropzone.style.display = 'flex';
    if (zoomSlider) {
      zoomSlider.value = '1';
      updateSliderProgress(1);
    }
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.remove('sending');
      submitBtn.setAttribute('aria-label', i18n.publishBtn);
      submitBtn.title = i18n.publishBtn;
    }
  }

  function resetForm() {
    clearUploadState();
    if (captionInput) captionInput.value = '';
    if (captionCounter) captionCounter.textContent = '0 / 1000';
    hideError();
  }

  if (changePhotoBtn && fileInput) {
    changePhotoBtn.addEventListener('click', function() {
      fileInput.click();
    });
  }

  if (captionInput) {
    captionInput.addEventListener('input', function() {
      if (captionCounter) {
        captionCounter.textContent = captionInput.value.length + ' / 1000';
      }
    });
  }

  function handleFile(file) {
    if (!file) return;
    hideError();

    var reader = new FileReader();
    reader.onload = function(evt) {
      var img = new Image();
      img.onload = function() {
        loadedImg = img;
        if (cropImg) cropImg.src = evt.target.result;
        if (dropzone) dropzone.style.display = 'none';
        if (cropWrap) cropWrap.style.display = 'flex';
        if (submitBtn && !isSubmitting) {
          submitBtn.disabled = false;
          submitBtn.classList.remove('sending');
          submitBtn.setAttribute('aria-label', i18n.publishBtn);
          submitBtn.title = i18n.publishBtn;
        }

        viewportSize = cropViewport ? (cropViewport.clientWidth || 340) : 340;
        var natW = loadedImg.naturalWidth;
        var natH = loadedImg.naturalHeight;

        baseScale = Math.max(viewportSize / natW, viewportSize / natH);
        zoom = 1.0;
        if (zoomSlider) {
      zoomSlider.value = '1';
      updateSliderProgress(1);
    }

        var dispW = natW * baseScale;
        var dispH = natH * baseScale;
        currentX = (viewportSize - dispW) / 2;
        currentY = (viewportSize - dispH) / 2;

        clampOffsets();
        applyTransform();
      };
      img.onerror = function() {
        clearUploadState();
        showError(i18n.networkError);
      };
      img.src = evt.target.result;
    };
    reader.onerror = function() {
      clearUploadState();
      showError(i18n.networkError);
    };
    reader.readAsDataURL(file);
  }

  if (fileInput) {
    fileInput.addEventListener('change', function(e) {
      var file = e.target.files && e.target.files[0];
      handleFile(file);
    });
  }

  if (dropzone) {
    dropzone.addEventListener('dragover', function(e) {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', function() {
      dropzone.classList.remove('dragover');
    });
    dropzone.addEventListener('drop', function(e) {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      var files = e.dataTransfer && e.dataTransfer.files;
      if (files && files[0]) handleFile(files[0]);
    });
  }

  if (zoomSlider) {
    zoomSlider.addEventListener('input', function() {
      setZoom(parseFloat(this.value));
    });
  }

  window.addEventListener('resize', function() {
    if (!loadedImg || !cropViewport || cropWrap.style.display === 'none') return;
    var nextSize = cropViewport.clientWidth;
    if (!nextSize || nextSize === viewportSize) return;
    var ratio = viewportSize ? (nextSize / viewportSize) : 1;
    viewportSize = nextSize;
    baseScale = Math.max(viewportSize / loadedImg.naturalWidth, viewportSize / loadedImg.naturalHeight);
    currentX = currentX * ratio;
    currentY = currentY * ratio;
    clampOffsets();
    applyTransform();
  });

  if (cropViewport) {
    cropViewport.addEventListener('wheel', function(e) {
      e.preventDefault();
      var delta = e.deltaY < 0 ? 0.08 : -0.08;
      var rect = cropViewport.getBoundingClientRect();
      setZoom(zoom + delta, e.clientX - rect.left, e.clientY - rect.top);
    }, { passive: false });

    cropViewport.addEventListener('mousedown', function(e) {
      e.preventDefault();
      if (!loadedImg) return;
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragInitialX = currentX;
      dragInitialY = currentY;
      setGridActive(true);
    });

    window.addEventListener('mousemove', function(e) {
      if (!isDragging) return;
      var dx = e.clientX - dragStartX;
      var dy = e.clientY - dragStartY;
      currentX = dragInitialX + dx;
      currentY = dragInitialY + dy;
      clampOffsets();
      applyTransform();
      setGridActive(true);
    });

    window.addEventListener('mouseup', function() {
      if (isDragging) {
        isDragging = false;
        setGridActive(false);
      }
    });

    cropViewport.addEventListener('touchstart', function(e) {
      if (!loadedImg) return;
      if (e.touches.length === 1) {
        isDragging = true;
        dragStartX = e.touches[0].clientX;
        dragStartY = e.touches[0].clientY;
        dragInitialX = currentX;
        dragInitialY = currentY;
        setGridActive(true);
      } else if (e.touches.length === 2) {
        isDragging = false;
        var t1 = e.touches[0];
        var t2 = e.touches[1];
        initialPinchDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        initialPinchZoom = zoom;
        var rect = cropViewport.getBoundingClientRect();
        pinchFocalX = (t1.clientX + t2.clientX) / 2 - rect.left;
        pinchFocalY = (t1.clientY + t2.clientY) / 2 - rect.top;
        setGridActive(true);
      }
    }, { passive: false });

    cropViewport.addEventListener('touchmove', function(e) {
      e.preventDefault();
      if (!loadedImg) return;
      if (e.touches.length === 2 && initialPinchDistance > 0) {
        var t1 = e.touches[0];
        var t2 = e.touches[1];
        var dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        var factor = dist / initialPinchDistance;
        setZoom(initialPinchZoom * factor, pinchFocalX, pinchFocalY);
      } else if (e.touches.length === 1 && isDragging) {
        var dx = e.touches[0].clientX - dragStartX;
        var dy = e.touches[0].clientY - dragStartY;
        currentX = dragInitialX + dx;
        currentY = dragInitialY + dy;
        clampOffsets();
        applyTransform();
        setGridActive(true);
      }
    }, { passive: false });

    function handleTouchEnd(e) {
      if (e.touches.length === 1) {
        isDragging = true;
        dragStartX = e.touches[0].clientX;
        dragStartY = e.touches[0].clientY;
        dragInitialX = currentX;
        dragInitialY = currentY;
      } else if (e.touches.length === 0) {
        isDragging = false;
        initialPinchDistance = 0;
        setGridActive(false);
      }
    }

    cropViewport.addEventListener('touchend', handleTouchEnd);
    cropViewport.addEventListener('touchcancel', handleTouchEnd);
  }

  function renderCroppedBlob(sx, sy, cropSize, targetMax, mime, quality) {
    return new Promise(function(resolve, reject) {
      var outSize = Math.max(1, Math.min(targetMax, cropSize));
      var canvas = document.createElement('canvas');
      canvas.width = outSize;
      canvas.height = outSize;
      var ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas error'));
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(loadedImg, sx, sy, cropSize, cropSize, 0, 0, outSize, outSize);

      canvas.toBlob(function(blob) {
        if (!blob) return reject(new Error('Canvas error'));
        resolve(blob);
      }, mime, quality);
    });
  }

  async function getCroppedVariants() {
    if (!loadedImg || !viewportSize) throw new Error('No image');
    var natW = loadedImg.naturalWidth;
    var natH = loadedImg.naturalHeight;
    var dispW = natW * baseScale * zoom;
    var scale = natW / dispW;

    var sx = (-currentX) * scale;
    var sy = (-currentY) * scale;
    var sw = viewportSize * scale;
    var sh = viewportSize * scale;

    if (sx < 0) sx = 0;
    if (sy < 0) sy = 0;
    if (sx + sw > natW) sw = natW - sx;
    if (sy + sh > natH) sh = natH - sy;

    var cropSize = Math.max(1, Math.round(Math.min(sw, sh)));
    var feedBlob = await renderCroppedBlob(sx, sy, cropSize, 1080, 'image/webp', 0.82);

    if (feedBlob && feedBlob.type === 'image/webp') {
      var thumbBlob = await renderCroppedBlob(sx, sy, cropSize, 320, 'image/webp', 0.78);
      var fullBlob = await renderCroppedBlob(sx, sy, cropSize, 1920, 'image/webp', 0.86);
      return {
        feed: feedBlob,
        feedName: 'post.webp',
        thumb: thumbBlob && thumbBlob.type === 'image/webp' ? thumbBlob : null,
        full: fullBlob && fullBlob.type === 'image/webp' ? fullBlob : null
      };
    }

    var fallbackBlob = await renderCroppedBlob(sx, sy, cropSize, 1080, 'image/jpeg', 0.88);
    return {
      feed: fallbackBlob,
      feedName: 'post.jpg',
      thumb: null,
      full: null
    };
  }

  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      if (!loadedImg || isSubmitting) return;

      isSubmitting = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('sending');
        submitBtn.setAttribute('aria-label', i18n.publishing);
        submitBtn.title = i18n.publishing;
      }
      hideError();

      var variants;
      try {
        variants = await getCroppedVariants();
      } catch (cropErr) {
        isSubmitting = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.classList.remove('sending');
          submitBtn.setAttribute('aria-label', i18n.publishBtn);
          submitBtn.title = i18n.publishBtn;
        }
        showError(i18n.networkError);
        return;
      }

      var fd = new FormData();
      fd.append('image', variants.feed, variants.feedName);
      if (variants.thumb) fd.append('image_thumb', variants.thumb, 'post_thumb.webp');
      if (variants.full) fd.append('image_full', variants.full, 'post_full.webp');
      fd.append('caption', captionInput ? captionInput.value : '');

      try {
        var res = await fetch('/api/posts/create', {
          method: 'POST',
          body: fd
        });
        if (res.status === 401) {
          window.location.href = '/login';
          return;
        }
        var data = {};
        try {
          data = await res.json();
        } catch (parseErr) {}

        if (res.ok) {
          if (window.spaNavigate) window.spaNavigate(i18n.targetProfileUrl);
          else window.location.href = i18n.targetProfileUrl;
        } else {
          showError((data && data.error) ? data.error : i18n.networkError);
          isSubmitting = false;
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('sending');
            submitBtn.setAttribute('aria-label', i18n.publishBtn);
            submitBtn.title = i18n.publishBtn;
          }
        }
      } catch (err) {
        showError(i18n.networkError);
        isSubmitting = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.classList.remove('sending');
          submitBtn.setAttribute('aria-label', i18n.publishBtn);
          submitBtn.title = i18n.publishBtn;
        }
      }
    });
  }
})();
`;

  return layout(`${t.common.appName} — ${t.post.newPostTitle}`, body, script, t, theme);
}
