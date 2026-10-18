import { Translations, ru } from '../languages';
import { esc } from './layout';

const HOME_ICON = `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>`;
const SEARCH_ICON = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
const PLUS_ICON = `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
const USER_ICON = `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
const UPLOAD_ICON = `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;
export const CLOSE_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="5" y2="19"/><line x1="5" y1="5" x2="19" y2="19"/></svg>`;
const ZOOM_OUT_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`;
const ZOOM_IN_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`;

export function renderBottomNav(activeTab: 'feed' | 'explore' | 'profile' | 'create', t: Translations = ru): string {
  return `
  <nav class="bottom-nav">
    <a href="/feed" class="bottom-nav-item ${activeTab === 'feed' ? 'active' : ''}" title="${esc(t.nav.feed)}">${HOME_ICON}</a>
    <a href="/explore" class="bottom-nav-item ${activeTab === 'explore' ? 'active' : ''}" title="${esc(t.nav.explore)}">${SEARCH_ICON}</a>
    <button class="bottom-nav-item ${activeTab === 'create' ? 'active' : ''}" id="openCreatePostBtn" type="button" aria-label="${esc(t.nav.create)}" title="${esc(t.nav.create)}">${PLUS_ICON}</button>
    <a href="/profile" class="bottom-nav-item ${activeTab === 'profile' ? 'active' : ''}" title="${esc(t.nav.profile)}">${USER_ICON}</a>
  </nav>`;
}

export function renderCreatePostModal(t: Translations = ru): string {
  return `
  <div class="modal-backdrop" id="createPostModal">
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">${esc(t.post.newPostTitle)}</h3>
        <button class="modal-close" id="closeCreatePostBtn" type="button" aria-label="${esc(t.common.close)}">${CLOSE_ICON}</button>
      </div>
      <div class="auth-error" id="createPostError"></div>
      <form id="createPostForm" style="display:flex; flex-direction:column; gap:12px;">
        <label for="postFileInput" class="post-upload-dropzone" id="postDropzone">
          ${UPLOAD_ICON}
          <span>${esc(t.post.selectPhotoDropzone)}</span>
        </label>
        <input type="file" id="postFileInput" accept="image/jpeg,image/png,image/webp" style="display:none">

        <div class="post-crop-wrap" id="postCropWrap" style="display:none;">
          <div class="crop-viewport" id="cropViewport">
            <img id="cropImage" src="" alt="Crop" draggable="false">
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
            <button type="button" class="btn btn-secondary btn-sm" id="postChangePhotoBtn" style="margin-left:auto;">${esc(t.post.changePhoto)}</button>
          </div>
        </div>

        <div class="post-caption-block">
          <div class="post-caption-header">
            <label for="postCaptionInput" class="post-caption-label">${esc(t.post.captionLabel || 'Подпись к публикации')}</label>
            <span class="post-caption-counter" id="postCaptionCounter">0 / 1000</span>
          </div>
          <textarea id="postCaptionInput" name="caption" maxlength="1000" class="post-caption-textarea" placeholder="${esc(t.post.captionPlaceholder)}"></textarea>
        </div>
        <button type="submit" class="btn btn-primary" id="submitPostBtn" disabled>${esc(t.post.publishBtn)}</button>
      </form>
    </div>
  </div>`;
}

export function renderCreatePostScript(t: Translations = ru): string {
  return `
(function() {
  var openBtn = document.getElementById('openCreatePostBtn');
  var closeBtn = document.getElementById('closeCreatePostBtn');
  var modal = document.getElementById('createPostModal');
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
  var errorEl = document.getElementById('createPostError');
  var form = document.getElementById('createPostForm');

  var loadedImg = null;
  var zoom = 1.0;
  var baseScale = 1.0;
  var currentX = 0;
  var currentY = 0;
  var viewportSize = 0;

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
    if (zoomSlider) zoomSlider.value = '1';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = ${JSON.stringify(t.post.publishBtn)};
    }
  }

  function resetForm() {
    clearUploadState();
    if (captionInput) captionInput.value = '';
    if (captionCounter) captionCounter.textContent = '0 / 1000';
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.remove('visible');
    }
  }

  function closeModal() {
    if (modal) modal.classList.remove('visible');
    document.body.style.overflow = '';
  }

  if (openBtn && modal) {
    openBtn.addEventListener('click', function() {
      resetForm();
      document.body.style.overflow = 'hidden';
      modal.classList.add('visible');
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', closeModal);
  }

  if (modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === modal) closeModal();
    });
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && modal && modal.classList.contains('visible')) {
      closeModal();
    }
  });

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
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.remove('visible');
    }

    var reader = new FileReader();
    reader.onload = function(evt) {
      var img = new Image();
      img.onload = function() {
        loadedImg = img;
        if (cropImg) cropImg.src = evt.target.result;
        if (dropzone) dropzone.style.display = 'none';
        if (cropWrap) cropWrap.style.display = 'flex';
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = ${JSON.stringify(t.post.publishBtn)};
        }

        viewportSize = cropViewport ? (cropViewport.clientWidth || 340) : 340;
        var natW = loadedImg.naturalWidth;
        var natH = loadedImg.naturalHeight;

        baseScale = Math.max(viewportSize / natW, viewportSize / natH);
        zoom = 1.0;
        if (zoomSlider) zoomSlider.value = '1';

        var dispW = natW * baseScale;
        var dispH = natH * baseScale;
        currentX = (viewportSize - dispW) / 2;
        currentY = (viewportSize - dispH) / 2;

        clampOffsets();
        applyTransform();
      };
      img.onerror = function() {
        clearUploadState();
        if (errorEl) {
          errorEl.textContent = ${JSON.stringify(t.common.networkError)};
          errorEl.classList.add('visible');
        }
      };
      img.src = evt.target.result;
    };
    reader.onerror = function() {
      clearUploadState();
      if (errorEl) {
        errorEl.textContent = ${JSON.stringify(t.common.networkError)};
        errorEl.classList.add('visible');
      }
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

  function getCroppedBlob() {
    return new Promise(function(resolve, reject) {
      if (!loadedImg || !viewportSize) return reject(new Error('No image'));
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

      var cropSize = Math.round(Math.min(sw, sh));
      var outSize = Math.min(1080, cropSize);
      if (outSize < 1) outSize = cropSize;

      var canvas = document.createElement('canvas');
      canvas.width = outSize;
      canvas.height = outSize;
      var ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(loadedImg, sx, sy, cropSize, cropSize, 0, 0, outSize, outSize);

      canvas.toBlob(function(blob) {
        if (!blob) return reject(new Error('Canvas error'));
        resolve(blob);
      }, 'image/jpeg', 0.9);
    });
  }

  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      if (!loadedImg) return;

      submitBtn.disabled = true;
      submitBtn.textContent = ${JSON.stringify(t.post.publishing)};
      if (errorEl) errorEl.classList.remove('visible');

      var blob;
      try {
        blob = await getCroppedBlob();
      } catch (cropErr) {
        submitBtn.disabled = false;
        submitBtn.textContent = ${JSON.stringify(t.post.publishBtn)};
        if (errorEl) {
          errorEl.textContent = ${JSON.stringify(t.common.networkError)};
          errorEl.classList.add('visible');
        }
        return;
      }

      var fd = new FormData();
      fd.append('image', blob, 'post.jpg');
      fd.append('caption', captionInput ? captionInput.value : '');

      try {
        var res = await fetch('/api/posts/create', {
          method: 'POST',
          body: fd
        });
        var data = await res.json();
        if (res.ok) {
          closeModal();
          resetForm();
          window.location.reload();
        } else {
          if (res.status === 401 || (data && data.error && (data.error.includes('авториз') || data.error.includes('войти')))) {
            if (window.showAppAlert) window.showAppAlert({ isAuth: true, message: data.error });
            submitBtn.disabled = false;
            submitBtn.textContent = ${JSON.stringify(t.post.publishBtn)};
            return;
          }
          if (errorEl) {
            errorEl.textContent = data.error || ${JSON.stringify(t.common.networkError)};
            errorEl.classList.add('visible');
          }
          submitBtn.disabled = false;
          submitBtn.textContent = ${JSON.stringify(t.post.publishBtn)};
        }
      } catch (err) {
        if (errorEl) {
          errorEl.textContent = ${JSON.stringify(t.common.networkError)};
          errorEl.classList.add('visible');
        }
        submitBtn.disabled = false;
        submitBtn.textContent = ${JSON.stringify(t.post.publishBtn)};
      }
    });
  }
})();
`;
}
