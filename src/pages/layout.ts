import { getStyles } from '../styles';
import { Translations, ru, renderLangScript } from '../languages';

export function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const escapeHtml = esc;

export function layout(title: string, body: string, script: string = '', t: Translations = ru): string {
  const langCode = t.code;

  return `<!DOCTYPE html>
<html lang="${langCode}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#FFFFFF">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Photogram">
<meta name="application-name" content="Photogram">
<meta name="description" content="Photogram">
<link rel="icon" type="image/svg+xml" href="/icon.svg">
<link rel="alternate icon" href="/icon.jpg">
<link rel="apple-touch-icon" href="/icon.jpg">
<link rel="manifest" href="/manifest.webmanifest">
<title>${esc(title)}</title>
<style>${getStyles()}</style>
</head>
<body>
${body}

<div class="modal-backdrop app-alert-backdrop notranslate" id="appAlertModal" translate="no">
  <div class="modal-content app-alert-content">
    <div class="app-alert-icon-box" id="appAlertIconBox"></div>
    <div class="app-alert-text">
      <h3 class="modal-title" id="appAlertTitle"></h3>
      <p id="appAlertMessage"></p>
    </div>
    <div class="app-alert-actions">
      <button type="button" class="btn btn-secondary btn-sm" id="appAlertCancelBtn" style="display: none;">${esc(t.common.cancel)}</button>
      <button type="button" class="btn btn-primary btn-sm" id="appAlertOkBtn">${esc(t.common.understood)}</button>
    </div>
  </div>
</div>

<script>
window.showAppAlert = function(opts) {
  var modal = document.getElementById('appAlertModal');
  if (!modal) return;
  var titleEl = document.getElementById('appAlertTitle');
  var msgEl = document.getElementById('appAlertMessage');
  var okBtn = document.getElementById('appAlertOkBtn');
  var cancelBtn = document.getElementById('appAlertCancelBtn');
  var iconBox = document.getElementById('appAlertIconBox');

  if (typeof opts === 'string') {
    opts = { message: opts };
  }
  opts = opts || {};

  var isAuth = Boolean(opts.isAuth) || (opts.message && (
    opts.message.toLowerCase().includes('авториз') ||
    opts.message.toLowerCase().includes('войти') ||
    opts.message.toLowerCase().includes('authoriz') ||
    opts.message.toLowerCase().includes('log in') ||
    opts.message.toLowerCase().includes('kirish') ||
    opts.message.toLowerCase().includes('кіру')
  ));

  iconBox.className = 'app-alert-icon-box ' + (isAuth ? 'auth' : (opts.type || 'error'));
  if (isAuth) {
    iconBox.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
    titleEl.textContent = opts.title || ${JSON.stringify(t.common.authRequired)};
    msgEl.textContent = opts.message || ${JSON.stringify(t.common.authRequiredMsg)};
    okBtn.textContent = opts.okText || ${JSON.stringify(t.auth.loginBtn)};
  } else {
    iconBox.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    titleEl.textContent = opts.title || ${JSON.stringify(t.common.attention)};
    msgEl.textContent = opts.message || ${JSON.stringify(t.common.networkError)};
    okBtn.textContent = opts.okText || ${JSON.stringify(t.common.understood)};
  }

  cancelBtn.style.display = 'none';

  okBtn.onclick = function() {
    modal.classList.remove('visible');
    if (isAuth) {
      window.location.href = '/login';
    } else if (typeof opts.onOk === 'function') {
      opts.onOk();
    }
  };

  modal.classList.add('visible');
};

window.showAppConfirm = function(opts) {
  var modal = document.getElementById('appAlertModal');
  if (!modal) return;
  var titleEl = document.getElementById('appAlertTitle');
  var msgEl = document.getElementById('appAlertMessage');
  var okBtn = document.getElementById('appAlertOkBtn');
  var cancelBtn = document.getElementById('appAlertCancelBtn');
  var iconBox = document.getElementById('appAlertIconBox');

  opts = opts || {};
  iconBox.className = 'app-alert-icon-box error';
  iconBox.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';

  titleEl.textContent = opts.title || ${JSON.stringify(t.common.attention)};
  msgEl.textContent = opts.message || '';
  okBtn.textContent = opts.okText || ${JSON.stringify(t.common.delete)};
  cancelBtn.textContent = opts.cancelText || ${JSON.stringify(t.common.cancel)};
  cancelBtn.style.display = 'block';

  cancelBtn.onclick = function() {
    modal.classList.remove('visible');
    if (typeof opts.onCancel === 'function') opts.onCancel();
  };

  okBtn.onclick = function() {
    modal.classList.remove('visible');
    if (typeof opts.onOk === 'function') opts.onOk();
  };

  modal.classList.add('visible');
};

(function() {
  var alertModal = document.getElementById('appAlertModal');
  if (alertModal) {
    alertModal.addEventListener('click', function(e) {
      if (e.target === alertModal) {
        alertModal.classList.remove('visible');
      }
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && alertModal.classList.contains('visible')) {
        alertModal.classList.remove('visible');
      }
    });
  }

  document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    return false;
  }, { passive: false });

  document.addEventListener('dragstart', function(e) {
    e.preventDefault();
    return false;
  }, false);

  document.addEventListener('gesturestart', function(e) {
    if (e.target && e.target.closest && e.target.closest('#cropperContainer, .cropper-area, .crop-container, .post-crop-wrap, #cropViewport')) return;
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('gesturechange', function(e) {
    if (e.target && e.target.closest && e.target.closest('#cropperContainer, .cropper-area, .crop-container, .post-crop-wrap, #cropViewport')) return;
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('touchmove', function(e) {
    if (e.touches && e.touches.length > 1) {
      if (e.target && e.target.closest && e.target.closest('#cropperContainer, .cropper-area, .crop-container, .post-crop-wrap, #cropViewport')) return;
      e.preventDefault();
    }
  }, { passive: false });

  function disableImgDrag() {
    document.querySelectorAll('img').forEach(function(img) {
      if (img.id !== 'cropImage') {
        img.setAttribute('draggable', 'false');
      }
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', disableImgDrag);
  } else {
    disableImgDrag();
  }
  if (window.MutationObserver) {
    new MutationObserver(function() {
      disableImgDrag();
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
</script>

<script>
${renderLangScript()}
</script>

<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js').then(function(reg) {
      reg.update();
    }).catch(function() {});
  });
}
</script>

<script>
(function() {
  var seenInSession = new Set();
  var telemetryQueue = [];
  var flushTimer = null;
  var observer = null;
  var timerMap = new WeakMap();

  function flushTelemetry() {
    if (telemetryQueue.length === 0) return;
    var batch = telemetryQueue.splice(0, 50);
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([JSON.stringify({ events: batch })], { type: 'application/json' });
        var sent = navigator.sendBeacon('/api/telemetry', blob);
        if (!sent) {
          fetch('/api/telemetry', {
            method: 'POST',
            keepalive: true,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ events: batch })
          }).catch(function() {});
        }
      } else {
        fetch('/api/telemetry', {
          method: 'POST',
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events: batch })
        }).catch(function() {});
      }
    } catch (e) {}
  }

  function queueEvent(ev) {
    if (!ev) return;
    telemetryQueue.push(ev);
    if (telemetryQueue.length >= 20) {
      flushTelemetry();
    }
  }

  window.trackTelemetryEvent = queueEvent;

  window.initTelemetryObserver = function() {
    if (observer) {
      observer.disconnect();
    }
    if (!('IntersectionObserver' in window)) return;

    observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        var el = entry.target;
        var pid = parseInt(el.dataset.postId, 10);
        if (!pid) return;
        var authorId = parseInt(el.dataset.authorId, 10) || undefined;

        if (entry.isIntersecting) {
          el._intersectStart = Date.now();
          var t = setTimeout(function() {
            if (!seenInSession.has(pid)) {
              seenInSession.add(pid);
              queueEvent({ type: 'impression', post_id: pid, author_id: authorId });
            }
          }, 600);
          timerMap.set(el, t);
        } else {
          var timer = timerMap.get(el);
          if (timer) {
            clearTimeout(timer);
            timerMap.delete(el);
          }
          if (el._intersectStart) {
            var dwell = Date.now() - el._intersectStart;
            delete el._intersectStart;
            if (dwell >= 2500) {
              queueEvent({ type: 'dwell', post_id: pid, author_id: authorId, dwell_ms: dwell });
            }
          }
        }
      });
    }, { threshold: 0.65 });

    document.querySelectorAll('[data-post-id]').forEach(function(el) {
      observer.observe(el);
    });
  };

  flushTimer = setInterval(flushTelemetry, 4000);
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') {
      flushTelemetry();
    }
  });
  window.addEventListener('pagehide', flushTelemetry);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initTelemetryObserver);
  } else {
    window.initTelemetryObserver();
  }
})();
</script>

${script ? `<script>${script}</script>` : ''}
</body>
</html>`;
}
