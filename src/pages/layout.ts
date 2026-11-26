import { getStyles } from '../styles';
import { Translations, ru, renderLangScript } from '../languages';

export function esc(str: any): string {
  if (str === null || str === undefined) return '';
  if (str instanceof Date) return str.toISOString();
  const s = typeof str === 'string' ? str : String(str);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const escapeHtml = esc;

export function safeJsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export const EYE_OPEN_ICON = `<svg class="eye-icon eye-open" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;

export const EYE_CLOSED_ICON = `<svg class="eye-icon eye-closed" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

export const MORE_DOTS_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>`;
export const TRASH_POST_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;

const DOWNLOAD_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;

const CLOSE_MODAL_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const APP_STYLE_VERSION = '20261126-v20';

export function renderVerifiedBadge(size: number = 13.5): string {
  return `<svg class="verified-badge" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" style="margin-left: 2px; vertical-align: middle; flex-shrink: 0; display: inline-flex;" aria-label="Verified"><circle cx="12" cy="12" r="9.8" fill="#29B6F6"/><path fill="#FFFFFF" d="M10.43 14.8L7.49 11.86l1.16-1.16 1.78 1.78 5.26-5.26L16.85 8.38z"/></svg>`;
}

export function layout(title: string, body: string, script: string = '', t: Translations = ru, theme?: string): string {
  const langCode = t.code;
  const bgHex = theme === 'dark' ? '#000000' : '#FFFFFF';
  const themeAttr = theme === 'dark' || theme === 'light' ? ` data-theme="${theme}" style="color-scheme: ${theme}; background-color: ${bgHex};"` : '';
  const metaThemeColor = theme === 'dark' ? '#000000' : '#FFFFFF';
  const statusBarStyle = theme === 'dark' ? 'black-translucent' : 'default';

  return `<!DOCTYPE html>
<html lang="${langCode}" translate="no" class="notranslate"${themeAttr}>
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Language" content="${langCode}">
<meta name="google" content="notranslate">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no,viewport-fit=cover,interactive-widget=resizes-content">
<meta name="theme-color" content="${metaThemeColor}">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="${statusBarStyle}">
<meta name="apple-mobile-web-app-title" content="Photogram">
<meta name="application-name" content="Photogram">
<meta name="description" content="Photogram">
<link rel="icon" type="image/svg+xml" href="/icon.svg">
<link rel="alternate icon" href="/icon.jpg">
<link rel="apple-touch-icon" href="/icon.jpg">
<link rel="manifest" href="/manifest.webmanifest">
<title>${esc(title)}</title>
<script>
(function() {
  var t;
  try {
    var rawTheme = localStorage.getItem('theme');
    if (rawTheme === 'dark' || rawTheme === 'light') {
      t = rawTheme;
    }
  } catch(e) {}
  if (!t) {
    var m = (document.cookie || '').match(/(?:^|;\\s*)theme=(dark|light)/);
    if (m && m[1]) {
      t = m[1];
    }
  }
  if (!t) {
    try {
      t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
      localStorage.setItem('theme', t);
    } catch(e) {
      t = 'light';
    }
    var s = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = 'theme=' + t + '; Path=/; Max-Age=31536000; SameSite=Lax' + s;
  }
  var bg = t === 'dark' ? '#000000' : '#FFFFFF';
  document.documentElement.setAttribute('data-theme', t);
  document.documentElement.style.colorScheme = t;
  document.documentElement.style.backgroundColor = bg;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', bg);
  }
  var appleMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (appleMeta) {
    appleMeta.setAttribute('content', t === 'dark' ? 'black-translucent' : 'default');
  }
})();
</script>
<style id="appMainStyles" data-app-v="${APP_STYLE_VERSION}">${getStyles()}</style>
</head>
<body>
<div id="appPageRoot">
${body}
</div>

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

<div class="modal-backdrop post-menu-backdrop notranslate" id="appPostMenuModal" translate="no">
  <div class="modal-content post-menu-content">
    <div class="modal-header">
      <h3 class="modal-title">${esc(t.post.moreOptions)}</h3>
      <button class="modal-close" id="closeAppPostMenuBtn" type="button" aria-label="${esc(t.common.close)}">${CLOSE_MODAL_ICON}</button>
    </div>
    <button type="button" class="menu-action-btn" id="appPostDownloadBtn">
      ${DOWNLOAD_ICON}
      <span>${esc(t.post.downloadPhoto)}</span>
    </button>
  </div>
</div>

<div class="app-bottom-toast notranslate" id="appBottomToast" role="status" aria-live="polite" translate="no"></div>

<script>
window.renderVerifiedBadge = function(size) {
  var s = size || 13.5;
  return '<svg class="verified-badge" viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" style="margin-left: 2px; vertical-align: middle; flex-shrink: 0; display: inline-flex;" aria-label="Verified"><circle cx="12" cy="12" r="9.8" fill="#29B6F6"/><path fill="#FFFFFF" d="M10.43 14.8L7.49 11.86l1.16-1.16 1.78 1.78 5.26-5.26L16.85 8.38z"/></svg>';
};
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
    titleEl.textContent = opts.title || ${safeJsonForScript(t.common.authRequired)};
    msgEl.textContent = opts.message || ${safeJsonForScript(t.common.authRequiredMsg)};
    okBtn.className = 'btn btn-sm ' + (opts.danger ? 'btn-danger' : (opts.okClass || 'btn-primary'));
    okBtn.textContent = opts.okText || ${safeJsonForScript(t.auth.loginBtn)};
  } else {
    iconBox.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    titleEl.textContent = opts.title || ${safeJsonForScript(t.common.attention)};
    msgEl.textContent = opts.message || ${safeJsonForScript(t.common.networkError)};
    okBtn.textContent = opts.okText || ${safeJsonForScript(t.common.understood)};
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
  iconBox.className = 'app-alert-icon-box ' + (opts.type || 'error');
  if (opts.type === 'unfollow') {
    iconBox.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/></svg>';
  } else {
    iconBox.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
  }

  titleEl.textContent = opts.title || ${safeJsonForScript(t.common.attention)};
  msgEl.textContent = opts.message || '';
  okBtn.textContent = opts.okText || ${safeJsonForScript(t.common.delete)};
  okBtn.className = 'btn ' + (opts.danger !== false ? 'btn-danger' : 'btn-primary') + ' btn-sm';
  cancelBtn.textContent = opts.cancelText || ${safeJsonForScript(t.common.cancel)};
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

  var toastTimer = null;
  window.showAppToast = function(message) {
    var toast = document.getElementById('appBottomToast');
    if (!toast || !message) return;
    toast.textContent = String(message);
    toast.classList.add('visible');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function() {
      toast.classList.remove('visible');
    }, 2600);
  };

  window.updateUnreadMessagesBadge = function(count) {
    var n = Number(count) || 0;
    document.querySelectorAll('#navMessagesBadge').forEach(function(el) {
      if (n > 0) {
        el.textContent = n > 99 ? '99+' : String(n);
        el.style.display = 'inline-flex';
      } else {
        el.textContent = '';
        el.style.display = 'none';
      }
    });
  };

  window.refreshUnreadMessagesBadge = function() {
    if (!document.getElementById('navMessagesBadge')) return;
    if (document.visibilityState === 'hidden') return;
    fetch('/api/messages/unread', { credentials: 'same-origin', cache: 'no-store' })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(d) {
        if (d && typeof d.unread_total === 'number') {
          window.updateUnreadMessagesBadge(d.unread_total);
        }
      })
      .catch(function() {});
  };

  window.updateNotificationsBadge = function(count) {
    var n = Number(count) || 0;
    document.querySelectorAll('#topNotificationsBadge').forEach(function(el) {
      if (n > 0) {
        el.textContent = n > 99 ? '99+' : String(n);
        el.style.display = 'inline-flex';
      } else {
        el.textContent = '';
        el.style.display = 'none';
      }
    });
  };

  var notifToastLabels = ${safeJsonForScript({
    like: t.notifications.likedYourPost,
    comment: t.notifications.commentedYourPost,
    follow: t.notifications.startedFollowingYou
  })};

  window.refreshNotificationsBadge = function() {
    if (!document.getElementById('navMessagesBadge') && !document.getElementById('topNotificationsBadge')) return;
    if (document.visibilityState === 'hidden') return;
    fetch('/api/notifications/unread', { credentials: 'same-origin', cache: 'no-store' })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(d) {
        if (!d) return;
        if (!d.enabled) {
          window.updateNotificationsBadge(0);
          return;
        }
        window.updateNotificationsBadge(d.unread_count || 0);
        if (d.latest && d.latest.id && window.location.pathname !== '/notifications') {
          var prevId = 0;
          try { prevId = parseInt(sessionStorage.getItem('pg_last_notif_id') || '0', 10) || 0; } catch (e) {}
          var nextId = Number(d.latest.id);
          if (prevId > 0 && nextId > prevId && window.showAppToast) {
            var label = notifToastLabels[d.latest.type] || '';
            var msg = '@' + d.latest.actor_username + ' ' + label;
            if (d.latest.type === 'comment' && d.latest.comment_preview) {
              msg += ' «' + d.latest.comment_preview.slice(0, 48) + '»';
            }
            window.showAppToast(msg);
          }
          if (nextId > prevId) {
            try { sessionStorage.setItem('pg_last_notif_id', String(nextId)); } catch (e) {}
          }
        }
      })
      .catch(function() {});
  };

  function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var rawData = window.atob(base64);
    var outputArray = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; i++) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  window.ensurePushSubscription = async function(askPermission) {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        return false;
      }
      var perm = Notification.permission;
      if (perm === 'denied') return false;
      if (perm === 'default') {
        if (!askPermission) return false;
        perm = await Notification.requestPermission();
        if (perm !== 'granted') return false;
      }
      var keyRes = await fetch('/api/push/vapid-key', { credentials: 'same-origin', cache: 'no-store' });
      if (!keyRes.ok) return false;
      var keyData = await keyRes.json();
      if (!keyData || !keyData.public_key) return false;

      var reg = await navigator.serviceWorker.ready;
      if (!reg || !reg.pushManager) return false;
      var sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyData.public_key)
        });
      }
      var subJson = sub && typeof sub.toJSON === 'function' ? sub.toJSON() : null;
      if (!subJson || !subJson.endpoint || !subJson.keys) return false;
      var saveRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subJson)
      });
      return saveRes.ok;
    } catch (e) {
      return false;
    }
  };

  window.unsubscribePushNotifications = async function() {
    try {
      var endpoint = '';
      if ('serviceWorker' in navigator) {
        var reg = await navigator.serviceWorker.ready;
        if (reg && reg.pushManager) {
          var sub = await reg.pushManager.getSubscription();
          if (sub) {
            endpoint = sub.endpoint || '';
            await sub.unsubscribe();
          }
        }
      }
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: endpoint })
      });
    } catch (e) {}
  };

  if (!window.__pgTzSynced) {
    window.__pgTzSynced = true;
    try {
      var deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (deviceTz && /^[A-Za-z0-9_+-]+(?:\\/[A-Za-z0-9_+-]+){0,2}$/.test(deviceTz)) {
        var curTzMatch = (document.cookie || '').match(/(?:^|;\\s*)tz=([^;]+)/);
        var curTz = curTzMatch ? decodeURIComponent(curTzMatch[1]) : '';
        if (curTz !== deviceTz) {
          var tzSec = window.location.protocol === 'https:' ? '; Secure' : '';
          document.cookie = 'tz=' + encodeURIComponent(deviceTz) + '; Path=/; Max-Age=31536000; SameSite=Lax' + tzSec;
        }
      }
    } catch (e) {}
  }

  window.wipeLocalAccountData = async function(userId) {
    try {
      sessionStorage.removeItem('pg_last_notif_id');
    } catch (e) {}
    var uid = Number(userId || 0);
    if (!uid || uid <= 0) return;
    try {
      if (window.PhotogramE2EE && typeof window.PhotogramE2EE.wipeLocalData === 'function') {
        await window.PhotogramE2EE.wipeLocalData(uid);
        return;
      }
    } catch (e) {}
    try {
      if (typeof indexedDB !== 'undefined' && typeof indexedDB.deleteDatabase === 'function') {
        await new Promise(function(resolve) {
          var req = indexedDB.deleteDatabase('pg_signal_e2ee_u_' + uid);
          req.onsuccess = function() { resolve(); };
          req.onerror = function() { resolve(); };
          req.onblocked = function() { resolve(); };
          setTimeout(resolve, 1500);
        });
      }
    } catch (e) {}
  };

  window.loadPhotogramE2ee = function() {
    if (window.PhotogramE2EE) return Promise.resolve(window.PhotogramE2EE);
    if (window.__pgE2eeLoadPromise) return window.__pgE2eeLoadPromise;
    window.__pgE2eeLoadPromise = new Promise(function(resolve, reject) {
      var s = document.createElement('script');
      s.src = '/e2ee.js?v=${APP_STYLE_VERSION}';
      s.async = true;
      s.onload = function() {
        if (window.PhotogramE2EE) resolve(window.PhotogramE2EE);
        else reject(new Error('E2EE module unavailable'));
      };
      s.onerror = function() {
        window.__pgE2eeLoadPromise = null;
        reject(new Error('Failed to load E2EE module'));
      };
      document.head.appendChild(s);
    });
    return window.__pgE2eeLoadPromise;
  };

  if (!window.__pgE2eeBgInit) {
    window.__pgE2eeBgInit = true;
    setTimeout(function() {
      if (!document.getElementById('navMessagesBadge')) return;
      fetch('/api/e2ee/keys/count', { credentials: 'same-origin', cache: 'no-store' })
        .then(function(r) { return r.ok ? r.json() : null; })
        .then(function(d) {
          if (!d || !d.user_id) return;
          return window.loadPhotogramE2ee().then(function(mod) {
            return mod.getClient(Number(d.user_id)).ensureInitialized();
          });
        })
        .catch(function() {});
    }, 1200);
  }

  if (!window.__pgPushInitBound) {
    window.__pgPushInitBound = true;
    setTimeout(function() {
      if (!document.getElementById('navMessagesBadge')) return;
      if ('Notification' in window && Notification.permission === 'granted') {
        window.ensurePushSubscription(false);
      }
    }, 600);
    document.addEventListener('click', function onFirstPushGesture() {
      if (!document.getElementById('navMessagesBadge')) return;
      document.removeEventListener('click', onFirstPushGesture);
      try {
        if (localStorage.getItem('pg_push_prompted') === '1') return;
        localStorage.setItem('pg_push_prompted', '1');
      } catch (e) {}
      if ('Notification' in window && Notification.permission === 'default') {
        window.ensurePushSubscription(true);
      }
    });
  }

  if (!window.__pgUnreadInterval) {
    window.__pgUnreadInterval = setInterval(function() {
      if (document.visibilityState === 'visible' && document.getElementById('navMessagesBadge')) {
        window.refreshUnreadMessagesBadge();
        window.refreshNotificationsBadge();
      }
    }, 12000);
  }
  setTimeout(function() {
    if (window.refreshUnreadMessagesBadge) window.refreshUnreadMessagesBadge();
    if (window.refreshNotificationsBadge) window.refreshNotificationsBadge();
  }, 150);

  var activePostMenuTarget = null;
  var postMenuModal = document.getElementById('appPostMenuModal');
  var closePostMenuBtn = document.getElementById('closeAppPostMenuBtn');
  var postDownloadBtn = document.getElementById('appPostDownloadBtn');
  var isDownloadingPostPhoto = false;

  function closePostOptionsMenu() {
    if (postMenuModal) postMenuModal.classList.remove('visible');
  }

  window.openPostOptionsMenu = function(opts) {
    if (!postMenuModal || !opts || !opts.img) return;
    activePostMenuTarget = {
      img: String(opts.img),
      postId: opts.postId ? String(opts.postId) : '',
      username: opts.username ? String(opts.username) : ''
    };
    postMenuModal.classList.add('visible');
  };

  window.downloadPostPhoto = async function(imgUrl, postId, username) {
    if (!imgUrl || isDownloadingPostPhoto) return;
    var cleanUrl = String(imgUrl).trim();
    if (cleanUrl.indexOf('/media/posts/') !== 0 && cleanUrl.indexOf('/media/posts%2F') !== 0) {
      window.showAppToast(${safeJsonForScript(t.post.downloadError)});
      return;
    }
    isDownloadingPostPhoto = true;
    try {
      var res = await fetch(cleanUrl, { credentials: 'same-origin' });
      if (!res.ok) {
        window.showAppToast(${safeJsonForScript(t.post.downloadError)});
        return;
      }
      var blob = await res.blob();
      var mime = (blob.type || '').toLowerCase();
      var ext = mime.indexOf('png') !== -1 ? 'png' : mime.indexOf('webp') !== -1 ? 'webp' : mime.indexOf('gif') !== -1 ? 'gif' : 'jpg';
      var safeUser = String(username || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 24);
      var safeId = String(postId || '').replace(/[^0-9]/g, '').slice(0, 16);
      var filename = 'photogram-' + (safeUser || 'photo') + (safeId ? '-' + safeId : '') + '.' + ext;

      if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        var blobUrl = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        a.rel = 'noopener';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function() {
          try { URL.revokeObjectURL(blobUrl); } catch (err) {}
        }, 5000);
      } else {
        window.location.href = cleanUrl + (cleanUrl.indexOf('?') === -1 ? '?download=1' : '&download=1');
      }
      window.showAppToast(${safeJsonForScript(t.post.downloadSuccess)});
    } catch (err) {
      window.showAppToast(${safeJsonForScript(t.post.downloadError)});
    } finally {
      isDownloadingPostPhoto = false;
    }
  };

  if (closePostMenuBtn) {
    closePostMenuBtn.addEventListener('click', closePostOptionsMenu);
  }
  if (postMenuModal) {
    postMenuModal.addEventListener('click', function(e) {
      if (e.target === postMenuModal) closePostOptionsMenu();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && postMenuModal.classList.contains('visible')) {
        closePostOptionsMenu();
      }
    });
  }
  if (postDownloadBtn) {
    postDownloadBtn.addEventListener('click', function() {
      var target = activePostMenuTarget;
      closePostOptionsMenu();
      if (target && target.img) {
        window.downloadPostPhoto(target.img, target.postId, target.username);
      }
    });
  }

  document.addEventListener('click', function(e) {
    var moreBtn = e.target && e.target.closest ? e.target.closest('[data-post-more-img]') : null;
    if (!moreBtn) return;
    var imgUrl = moreBtn.getAttribute('data-post-more-img');
    if (!imgUrl) return;
    e.preventDefault();
    e.stopPropagation();
    window.openPostOptionsMenu({
      img: imgUrl,
      postId: moreBtn.getAttribute('data-post-more-id') || '',
      username: moreBtn.getAttribute('data-post-more-user') || ''
    });
  });

  document.addEventListener('contextmenu', function(e) {
    if (e.target && e.target.closest && e.target.closest('input, textarea')) return;
    e.preventDefault();
    return false;
  }, { passive: false });

  document.addEventListener('dragstart', function(e) {
    e.preventDefault();
    return false;
  }, false);

  document.addEventListener('gesturestart', function(e) {
    if (e.target && e.target.closest && e.target.closest('#cropperContainer, .cropper-area, .crop-container, .post-crop-wrap, .publishpost-crop-wrap, .crop-viewport, .publishpost-crop-viewport, #cropViewport')) return;
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('gesturechange', function(e) {
    if (e.target && e.target.closest && e.target.closest('#cropperContainer, .cropper-area, .crop-container, .post-crop-wrap, .publishpost-crop-wrap, .crop-viewport, .publishpost-crop-viewport, #cropViewport')) return;
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('touchmove', function(e) {
    if (e.touches && e.touches.length > 1) {
      if (e.target && e.target.closest && e.target.closest('#cropperContainer, .cropper-area, .crop-container, .post-crop-wrap, .publishpost-crop-wrap, .crop-viewport, .publishpost-crop-viewport, #cropViewport')) return;
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
(function() {
  function applyTheme(t) {
    if (t !== 'dark' && t !== 'light') return;
    var bg = t === 'dark' ? '#000000' : '#FFFFFF';
    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.style.colorScheme = t;
    document.documentElement.style.backgroundColor = bg;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', bg);
    }
    var appleMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (appleMeta) {
      appleMeta.setAttribute('content', t === 'dark' ? 'black-translucent' : 'default');
    }
    try {
      localStorage.setItem('theme', t);
    } catch(e) {}
    var s = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = 'theme=' + t + '; Path=/; Max-Age=31536000; SameSite=Lax' + s;
    syncThemeButtons(t);
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'REFRESH_OFFLINE' });
      }
    } catch(e) {}
  }

  window.syncThemeButtons = syncThemeButtons;

  function syncThemeButtons(current) {
    var theme = current || document.documentElement.getAttribute('data-theme') || 'light';
    document.querySelectorAll('.theme-switch-btn').forEach(function(btn) {
      var target = btn.getAttribute('data-set-theme');
      if (target === theme) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  window.switchTheme = applyTheme;

  document.addEventListener('click', function(e) {
    var btn = e.target && e.target.closest ? e.target.closest('[data-set-theme]') : null;
    if (btn) {
      var t = btn.getAttribute('data-set-theme');
      if (t) {
        e.preventDefault();
        applyTheme(t);
      }
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      syncThemeButtons();
    });
  } else {
    syncThemeButtons();
  }
})();
</script>

<script>
(function() {
  if (typeof window === 'undefined') return;

  var isDown = false;
  var isDragging = false;
  var hasDragged = false;
  var startX = 0;
  var startY = 0;
  var lastX = 0;
  var lastY = 0;
  var scrollTarget = null;
  var points = [];
  var momentumRaf = null;
  var dragThreshold = 6;
  var savedSnap = '';

  function stopMomentum() {
    if (momentumRaf) {
      cancelAnimationFrame(momentumRaf);
      momentumRaf = null;
    }
  }

  function findScrollable(target, axis) {
    var el = target;
    while (el && el !== document.body && el !== document.documentElement) {
      if (el.nodeType === 1) {
        var style = window.getComputedStyle(el);
        if (axis === 'x') {
          var ox = style.overflowX;
          if ((ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 4) {
            return el;
          }
        } else {
          var oy = style.overflowY;
          if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 4) {
            return el;
          }
        }
      }
      el = el.parentElement;
    }
    return null;
  }

  function isInteractive(el) {
    if (!el || !el.closest) return false;
    return !!el.closest('input, textarea, select, option, label[for], .crop-viewport, .post-crop-wrap, .publishpost-crop-wrap, .publishpost-crop-viewport, #cropViewport, #postCropWrap, .crop-controls, .publishpost-dropzone, .comments-sheet-header, [contenteditable="true"], .pics-feed');
  }

  window.addEventListener('mousedown', function(e) {
    if (e.button !== 0) return;
    if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
    if (isInteractive(e.target)) return;

    stopMomentum();
    isDown = true;
    isDragging = false;
    hasDragged = false;
    startX = e.clientX;
    startY = e.clientY;
    lastX = e.clientX;
    lastY = e.clientY;
    points = [{ x: e.clientX, y: e.clientY, time: performance.now() }];

    var h = findScrollable(e.target, 'x');
    var v = findScrollable(e.target, 'y');
    scrollTarget = { h: h, v: v };
  }, { passive: true });

  window.addEventListener('mousemove', function(e) {
    if (!isDown) return;

    var dx = e.clientX - lastX;
    var dy = e.clientY - lastY;
    var totalDist = Math.hypot(e.clientX - startX, e.clientY - startY);

    if (!isDragging) {
      if (totalDist > dragThreshold) {
        isDragging = true;
        hasDragged = true;
        document.body.classList.add('is-mouse-dragging');
        if (scrollTarget && scrollTarget.h) {
          savedSnap = scrollTarget.h.style.scrollSnapType || '';
          scrollTarget.h.style.scrollSnapType = 'none';
        }
      } else {
        return;
      }
    }

    if (e.cancelable) {
      e.preventDefault();
    }

    lastX = e.clientX;
    lastY = e.clientY;

    var now = performance.now();
    points.push({ x: e.clientX, y: e.clientY, time: now });
    while (points.length > 0 && now - points[0].time > 100) {
      points.shift();
    }

    var hEl = scrollTarget ? scrollTarget.h : null;
    var vEl = scrollTarget ? scrollTarget.v : null;

    if (hEl && (Math.abs(e.clientX - startX) >= Math.abs(e.clientY - startY) || !vEl)) {
      hEl.scrollLeft -= dx;
      if (dy && !vEl) {
        window.scrollBy(0, -dy);
      } else if (dy && vEl) {
        vEl.scrollTop -= dy;
      }
    } else if (vEl) {
      vEl.scrollTop -= dy;
      if (dx && vEl.scrollWidth > vEl.clientWidth) {
        vEl.scrollLeft -= dx;
      }
    } else {
      window.scrollBy(-dx, -dy);
    }
  }, { passive: false });

  function endDrag() {
    if (!isDown) return;
    isDown = false;

    if (isDragging) {
      document.body.classList.remove('is-mouse-dragging');

      var now = performance.now();
      var recent = points.filter(function(p) { return now - p.time <= 100; });
      var vx = 0;
      var vy = 0;
      if (recent.length >= 2) {
        var first = recent[0];
        var last = recent[recent.length - 1];
        var dt = last.time - first.time;
        if (dt > 10) {
          vx = (last.x - first.x) / dt;
          vy = (last.y - first.y) / dt;
        }
      }

      var hEl = scrollTarget ? scrollTarget.h : null;
      var vEl = scrollTarget ? scrollTarget.v : null;
      var useH = hEl && (Math.abs(vx) >= Math.abs(vy) || !vEl);

      var curVx = vx * 16;
      var curVy = vy * 16;

      if (Math.abs(curVx) > 2 || Math.abs(curVy) > 2) {
        var friction = 0.94;
        function momentumStep() {
          var keepGoing = false;
          if (useH && hEl) {
            hEl.scrollLeft -= curVx;
            curVx *= friction;
            if (Math.abs(curVx) > 0.5) keepGoing = true;
          } else if (vEl) {
            vEl.scrollTop -= curVy;
            curVy *= friction;
            if (Math.abs(curVy) > 0.5) keepGoing = true;
          } else {
            window.scrollBy(0, -curVy);
            curVy *= friction;
            if (Math.abs(curVy) > 0.5) keepGoing = true;
          }

          if (keepGoing) {
            momentumRaf = requestAnimationFrame(momentumStep);
          } else {
            if (hEl) hEl.style.scrollSnapType = savedSnap;
            momentumRaf = null;
          }
        }
        momentumRaf = requestAnimationFrame(momentumStep);
      } else {
        if (hEl) hEl.style.scrollSnapType = savedSnap;
      }

      setTimeout(function() {
        hasDragged = false;
      }, 50);
    }
  }

  window.addEventListener('mouseup', endDrag);

  window.addEventListener('click', function(e) {
    if (hasDragged) {
      e.preventDefault();
      e.stopPropagation();
      hasDragged = false;
    }
  }, true);

  window.addEventListener('blur', function() {
    if (isDown) endDrag();
  });
})();
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
  var skippedInSession = new Set();
  var engagedPosts = new Set();
  var telemetryQueue = [];
  var flushTimer = null;
  var observer = null;
  var timerMap = new WeakMap();
  var activeVisibleMap = new Map();
  var activeModalDwell = null;

  function flushTelemetry() {
    if (telemetryQueue.length === 0) return;
    while (telemetryQueue.length > 0) {
      var batch = telemetryQueue.splice(0, 30);
      var payload = JSON.stringify({ events: batch });
      try {
        if (navigator.sendBeacon) {
          var blob = new Blob([payload], { type: 'application/json' });
          var sent = navigator.sendBeacon('/api/telemetry', blob);
          if (!sent) {
            fetch('/api/telemetry', {
              method: 'POST',
              keepalive: true,
              headers: { 'Content-Type': 'application/json' },
              body: payload
            }).catch(function() {});
          }
        } else {
          fetch('/api/telemetry', {
            method: 'POST',
            keepalive: true,
            headers: { 'Content-Type': 'application/json' },
            body: payload
          }).catch(function() {});
        }
      } catch (e) {}
    }
  }

  function queueEvent(ev) {
    if (!ev || !ev.type) return;
    telemetryQueue.push(ev);
    if (telemetryQueue.length >= 20) {
      flushTelemetry();
    }
  }

  function finishPostExposure(el, info) {
    var timer = timerMap.get(el);
    if (timer) {
      clearTimeout(timer);
      timerMap.delete(el);
    }
    if (!info || !info.startTime) return;
    var dwell = Math.min(120000, Math.max(0, Date.now() - info.startTime));
    var pid = info.postId;
    var authorId = info.authorId;

    if (dwell >= 1500) {
      if (!seenInSession.has(pid)) {
        seenInSession.add(pid);
        queueEvent({ type: 'impression', post_id: pid, author_id: authorId });
      }
      queueEvent({ type: 'dwell', post_id: pid, author_id: authorId, dwell_ms: dwell });
    } else if (dwell >= 250 && !engagedPosts.has(pid) && !skippedInSession.has(pid)) {
      skippedInSession.add(pid);
      queueEvent({ type: 'skip', post_id: pid, author_id: authorId });
    }
  }

  window.trackTelemetryEvent = queueEvent;

  window.markPostEngaged = function(postId) {
    var pid = parseInt(postId, 10);
    if (pid > 0) engagedPosts.add(pid);
  };

  window.flushActivePostDwell = function() {
    activeVisibleMap.forEach(function(info, el) {
      finishPostExposure(el, info);
    });
    activeVisibleMap.clear();
  };

  window.startModalDwell = function(postId, authorId) {
    window.endModalDwell();
    var pid = parseInt(postId, 10);
    if (!pid) return;
    activeModalDwell = {
      postId: pid,
      authorId: parseInt(authorId, 10) || undefined,
      startTime: Date.now()
    };
  };

  window.endModalDwell = function() {
    if (!activeModalDwell) return;
    var info = activeModalDwell;
    activeModalDwell = null;
    var dwell = Math.min(120000, Math.max(0, Date.now() - info.startTime));
    if (dwell >= 1500) {
      if (!seenInSession.has(info.postId)) {
        seenInSession.add(info.postId);
        queueEvent({ type: 'impression', post_id: info.postId, author_id: info.authorId });
      }
      queueEvent({ type: 'dwell', post_id: info.postId, author_id: info.authorId, dwell_ms: dwell });
    }
  };

  window.initTelemetryObserver = function() {
    window.flushActivePostDwell();
    if (observer) {
      observer.disconnect();
    }
    if (!('IntersectionObserver' in window)) return;

    observer = new IntersectionObserver(function(entries) {
      var picsModal = document.getElementById('picsModal');
      var picsVisible = Boolean(picsModal && picsModal.classList.contains('visible'));

      entries.forEach(function(entry) {
        var el = entry.target;
        var isPicsSlide = el.classList && el.classList.contains('pics-slide');
        if (isPicsSlide && !picsVisible) {
          if (activeVisibleMap.has(el)) {
            finishPostExposure(el, activeVisibleMap.get(el));
            activeVisibleMap.delete(el);
          }
          return;
        }

        var pid = parseInt(el.dataset.postId, 10);
        if (!pid) return;
        var authorId = parseInt(el.dataset.authorId, 10) || undefined;

        if (entry.isIntersecting) {
          if (!activeVisibleMap.has(el)) {
            activeVisibleMap.set(el, { postId: pid, authorId: authorId, startTime: Date.now() });
            var t = setTimeout(function() {
              if (!seenInSession.has(pid) && activeVisibleMap.has(el)) {
                seenInSession.add(pid);
                queueEvent({ type: 'impression', post_id: pid, author_id: authorId });
              }
            }, 1500);
            timerMap.set(el, t);
          }
        } else {
          if (activeVisibleMap.has(el)) {
            finishPostExposure(el, activeVisibleMap.get(el));
            activeVisibleMap.delete(el);
          }
        }
      });
    }, { threshold: 0.65 });

    document.querySelectorAll('.feed-card[data-post-id], .pics-slide[data-post-id]').forEach(function(el) {
      observer.observe(el);
    });
  };

  flushTimer = setInterval(flushTelemetry, 4000);
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') {
      window.endModalDwell();
      window.flushActivePostDwell();
      flushTelemetry();
    }
  });
  window.addEventListener('pagehide', function() {
    window.endModalDwell();
    window.flushActivePostDwell();
    flushTelemetry();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initTelemetryObserver);
  } else {
    window.initTelemetryObserver();
  }
})();
</script>

<script type="text/plain" id="appPageScript" data-initial-page-script="true" data-page-script="true">(function(){var s=document.getElementById('appMainStyles');if(!s||s.getAttribute('data-app-v')!=='${APP_STYLE_VERSION}'){var k='pg_css_reload_${APP_STYLE_VERSION}';try{if(sessionStorage.getItem(k)!=='1'){sessionStorage.setItem(k,'1');window.location.reload();return;}}catch(e){window.location.reload();return;}}})();
${script || ''}</script>

<script>
(function() {
  var origDocAdd = document.addEventListener.bind(document);
  var origWinAdd = window.addEventListener.bind(window);
  var pageAbort = null;
  var navAbort = null;

  function makeSignalOpts(opts, signal) {
    if (!signal) return opts;
    if (typeof opts === 'boolean') return { capture: opts, signal: signal };
    if (opts && typeof opts === 'object') return Object.assign({}, opts, { signal: signal });
    return { signal: signal };
  }

  function runScopedPageScript(code) {
    if (pageAbort) {
      try { pageAbort.abort(); } catch (e) {}
    }
    pageAbort = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var sig = pageAbort ? pageAbort.signal : null;
    if (!code || !code.trim()) return;

    document.addEventListener = function(type, fn, opts) {
      return origDocAdd(type, fn, makeSignalOpts(opts, sig));
    };
    window.addEventListener = function(type, fn, opts) {
      return origWinAdd(type, fn, makeSignalOpts(opts, sig));
    };

    try {
      var s = document.createElement('script');
      s.setAttribute('data-page-script', 'true');
      s.textContent = code;
      var root = document.getElementById('appPageRoot');
      if (root) root.appendChild(s);
      else document.body.appendChild(s);
    } finally {
      document.addEventListener = origDocAdd;
      window.addEventListener = origWinAdd;
    }
  }

  function isSoftNavigable(url) {
    if (!url || url.origin !== window.location.origin) return false;
    var p = url.pathname;
    if (p.startsWith('/api/') || p.startsWith('/media/')) return false;
    if (p === '/login' || p === '/register' || p === '/offline') return false;
    return true;
  }

  async function spaNavigate(targetHref, pushHistory) {
    var targetUrl;
    try {
      targetUrl = new URL(targetHref, window.location.href);
    } catch (e) {
      return;
    }
    if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
      return;
    }

    if (!isSoftNavigable(targetUrl)) {
      window.location.href = targetUrl.href;
      return;
    }

    if (navAbort) {
      try { navAbort.abort(); } catch (e) {}
    }
    navAbort = typeof AbortController !== 'undefined' ? new AbortController() : null;

    if (window.endModalDwell) window.endModalDwell();
    if (window.flushActivePostDwell) window.flushActivePostDwell();
    if (window.__dmPollTimer) {
      clearInterval(window.__dmPollTimer);
      window.__dmPollTimer = null;
    }
    if (window.__dmConvPollTimer) {
      clearInterval(window.__dmConvPollTimer);
      window.__dmConvPollTimer = null;
    }
    if (window.__dmViewportCleanup) {
      try { window.__dmViewportCleanup(); } catch (e) {}
      window.__dmViewportCleanup = null;
    }
    document.documentElement.classList.remove('dm-lock-scroll');
    document.body.classList.remove('dm-lock-scroll');

    var root = document.getElementById('appPageRoot');
    if (root) root.style.opacity = '0.35';

    try {
      var res = await fetch(targetUrl.href, {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'X-Requested-With': 'photogram-spa' },
        signal: navAbort ? navAbort.signal : undefined
      });

      var finalUrl = new URL(res.url || targetUrl.href, window.location.href);
      var contentType = res.headers.get('Content-Type') || '';
      if (!res.ok || contentType.indexOf('text/html') === -1 || !isSoftNavigable(finalUrl)) {
        window.location.href = finalUrl.href;
        return;
      }

      var htmlText = await res.text();
      var doc = new DOMParser().parseFromString(htmlText, 'text/html');
      var curStyle = document.getElementById('appMainStyles');
      var nextStyle = doc.getElementById('appMainStyles');
      if (!curStyle || !nextStyle || curStyle.getAttribute('data-app-v') !== nextStyle.getAttribute('data-app-v')) {
        window.location.href = finalUrl.href;
        return;
      }
      var nextRoot = doc.getElementById('appPageRoot');
      if (!nextRoot || !root) {
        window.location.href = finalUrl.href;
        return;
      }

      nextRoot.querySelectorAll('script').forEach(function(sc) { sc.remove(); });
      var nextScripts = doc.querySelectorAll('body > script#appPageScript[data-page-script="true"]');
      var nextScriptCode = '';
      nextScripts.forEach(function(sc) {
        if (!nextRoot.contains(sc)) {
          nextScriptCode += (sc.textContent || '') + '\\n';
        }
        sc.remove();
      });

      document.body.style.overflow = '';
      document.title = doc.title || document.title;

      if (pushHistory) {
        history.pushState({ spa: true }, '', finalUrl.pathname + finalUrl.search + finalUrl.hash);
      }

      root.innerHTML = nextRoot.innerHTML;
      window.scrollTo(0, 0);
      runScopedPageScript(nextScriptCode);

      if (window.syncThemeButtons) window.syncThemeButtons();
      if (window.initTelemetryObserver) window.initTelemetryObserver();
      if (window.refreshUnreadMessagesBadge) window.refreshUnreadMessagesBadge();
      if (window.refreshNotificationsBadge) window.refreshNotificationsBadge();

      requestAnimationFrame(function() {
        if (root) root.style.opacity = '1';
      });
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      window.location.href = targetUrl.href;
    }
  }

  window.spaNavigate = function(url) {
    spaNavigate(url, true);
  };

  window.softReloadAuthLanguage = async function(langCode) {
    var root = document.getElementById('appPageRoot');
    if (!root) return false;
    var savedFields = {};
    root.querySelectorAll('input[id], textarea[id]').forEach(function(el) {
      if (el.type === 'checkbox' || el.type === 'radio') {
        savedFields[el.id] = { kind: 'check', checked: el.checked };
      } else {
        var isRevealedPw = el.classList.contains('pw-masked')
          ? el.classList.contains('pw-revealed')
          : el.type === 'text';
        savedFields[el.id] = { kind: 'text', value: el.value, revealed: isRevealedPw };
      }
    });
    var oldTermsModal = document.getElementById('termsModal');
    var wasTermsOpen = Boolean(oldTermsModal && oldTermsModal.classList.contains('visible'));

    try {
      var res = await fetch(window.location.href, {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'X-Requested-With': 'photogram-spa' }
      });
      var contentType = res.headers.get('Content-Type') || '';
      if (!res.ok || contentType.indexOf('text/html') === -1) {
        savedFields = null;
        return false;
      }

      var htmlText = await res.text();
      var doc = new DOMParser().parseFromString(htmlText, 'text/html');
      var curStyle = document.getElementById('appMainStyles');
      var nextStyle = doc.getElementById('appMainStyles');
      if (!curStyle || !nextStyle || curStyle.getAttribute('data-app-v') !== nextStyle.getAttribute('data-app-v')) {
        savedFields = null;
        return false;
      }
      var nextRoot = doc.getElementById('appPageRoot');
      if (!nextRoot) {
        savedFields = null;
        return false;
      }

      nextRoot.querySelectorAll('script').forEach(function(sc) { sc.remove(); });
      var nextScripts = doc.querySelectorAll('body > script#appPageScript[data-page-script="true"]');
      var nextScriptCode = '';
      nextScripts.forEach(function(sc) {
        if (!nextRoot.contains(sc)) {
          nextScriptCode += (sc.textContent || '') + '\\n';
        }
        sc.remove();
      });

      document.documentElement.setAttribute('lang', langCode);
      document.title = doc.title || document.title;
      root.innerHTML = nextRoot.innerHTML;

      Object.keys(savedFields).forEach(function(id) {
        var el = document.getElementById(id);
        if (!el) return;
        var st = savedFields[id];
        if (st.kind === 'check') {
          el.checked = st.checked;
        } else {
          el.value = st.value;
        }
      });

      runScopedPageScript(nextScriptCode);

      Object.keys(savedFields).forEach(function(id) {
        var el = document.getElementById(id);
        if (!el) return;
        var st = savedFields[id];
        if (st.kind === 'check') {
          el.dispatchEvent(new Event('change'));
        } else {
          if (id === 'password' && st.revealed) {
            var toggleBtn = document.getElementById('togglePasswordBtn');
            if (toggleBtn) {
              toggleBtn.click();
              el.blur();
            }
          }
          el.dispatchEvent(new Event('input'));
        }
      });

      if (wasTermsOpen) {
        var newTermsModal = document.getElementById('termsModal');
        if (newTermsModal) newTermsModal.classList.add('visible');
      }

      savedFields = null;
      return true;
    } catch (e) {
      savedFields = null;
      return false;
    }
  };

  origDocAdd('click', function(e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var link = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!link) return;
    if (link.hasAttribute('download')) return;
    var target = link.getAttribute('target');
    if (target && target !== '_self') return;
    var href = link.getAttribute('href') || '';
    if (!href || href.charAt(0) === '#' || href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0 || href.indexOf('javascript:') === 0) return;

    var url;
    try {
      url = new URL(link.href, window.location.href);
    } catch (err) {
      return;
    }
    if (!isSoftNavigable(url)) return;

    e.preventDefault();
    if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash === window.location.hash) {
      return;
    }
    spaNavigate(url.href, true);
  });

  origWinAdd('popstate', function() {
    spaNavigate(window.location.href, false);
  });

  var initialScript = document.querySelector('script[data-initial-page-script="true"]');
  if (initialScript) {
    var initialCode = initialScript.textContent || '';
    initialScript.remove();
    runScopedPageScript(initialCode);
  }
})();
</script>
</body>
</html>`;
}
