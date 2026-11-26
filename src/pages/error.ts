import { Translations, ru, en, uz, kz } from '../languages';
import { esc, safeJsonForScript } from './layout';

const OFFLINE_WIFI_ICON = `<svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="#2196F3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <line x1="1" y1="1" x2="23" y2="23"/>
  <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
  <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
  <path d="M10.71 5.05A16 16 0 0 1 22.58 9"/>
  <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
  <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
  <line x1="12" y1="20" x2="12.01" y2="20"/>
</svg>`;

const REFRESH_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="23 4 23 10 17 10"/>
  <polyline points="1 20 1 14 7 14"/>
  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
</svg>`;

const OFFLINE_I18N_MAP = {
  ru: {
    title: ru.error.offlineTitle,
    desc: ru.error.offlineDesc,
    reload: ru.error.reloadBtn,
  },
  en: {
    title: en.error.offlineTitle,
    desc: en.error.offlineDesc,
    reload: en.error.reloadBtn,
  },
  uz: {
    title: uz.error.offlineTitle,
    desc: uz.error.offlineDesc,
    reload: uz.error.reloadBtn,
  },
  kz: {
    title: kz.error.offlineTitle,
    desc: kz.error.offlineDesc,
    reload: kz.error.reloadBtn,
  },
};

export function errorPage(t: Translations = ru, theme?: string): string {
  const safeTheme = theme === 'dark' || theme === 'light' ? theme : undefined;
  const bgHex = safeTheme === 'dark' ? '#000000' : '#FFFFFF';
  const themeAttr = safeTheme
    ? ` data-theme="${safeTheme}" style="color-scheme: ${safeTheme}; background-color: ${bgHex};"`
    : '';
  const metaThemeColor = bgHex;
  const statusBarStyle = safeTheme === 'dark' ? 'black-translucent' : 'default';

  return `<!DOCTYPE html>
<html lang="${t.code}" translate="no" class="notranslate"${themeAttr}>
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Language" content="${t.code}">
<meta name="google" content="notranslate">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="${metaThemeColor}">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="${statusBarStyle}">
<title>${esc(t.error.offlineTitle)} — Photogram</title>
<link rel="icon" type="image/svg+xml" href="/icon.svg">
<link rel="apple-touch-icon" href="/icon.jpg">
<link rel="manifest" href="/manifest.webmanifest">
<script>
(function() {
  function readSavedTheme() {
    var val = null;
    try {
      val = localStorage.getItem('theme');
    } catch(e) {}
    if (val === 'dark' || val === 'light') return val;
    var m = (document.cookie || '').match(/(?:^|;\\s*)theme=(dark|light)/);
    if (m && (m[1] === 'dark' || m[1] === 'light')) {
      try { localStorage.setItem('theme', m[1]); } catch(e) {}
      return m[1];
    }
    var prefersDark = false;
    try {
      prefersDark = Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    } catch(e) {}
    val = prefersDark ? 'dark' : 'light';
    try { localStorage.setItem('theme', val); } catch(e) {}
    var s = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = 'theme=' + val + '; Path=/; Max-Age=31536000; SameSite=Lax' + s;
    return val;
  }

  function applyOfflineTheme() {
    var t = readSavedTheme();
    var bg = t === 'dark' ? '#000000' : '#FFFFFF';
    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.style.colorScheme = t;
    document.documentElement.style.backgroundColor = bg;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', bg);
    var appleMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (appleMeta) appleMeta.setAttribute('content', t === 'dark' ? 'black-translucent' : 'default');
  }

  window.__applyOfflineTheme = applyOfflineTheme;
  applyOfflineTheme();
})();
</script>
<style>
:root,
html[data-theme="light"] {
  --bg-primary: #FFFFFF;
  --bg-secondary: #FAFAFA;
  --bg-elevated: #FFFFFF;
  --text-primary: #111111;
  --text-secondary: #737373;
  --border-color: #EFEFEF;
  --input-bg: #F5F5F5;
  --icon-box-bg: #E3F2FD;
}

html[data-theme="dark"] {
  --bg-primary: #000000;
  --bg-secondary: #121212;
  --bg-elevated: #1C1C1E;
  --text-primary: #F5F5F5;
  --text-secondary: #A8A8A8;
  --border-color: #262626;
  --input-bg: #262626;
  --icon-box-bg: #1E293B;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  background: var(--bg-primary);
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

@keyframes pageFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.offline-card {
  width: 100%;
  max-width: 440px;
  background: var(--bg-elevated);
  border-radius: 24px;
  border: 1px solid var(--border-color);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
  padding: 40px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  animation: pageFadeIn 0.2s ease forwards;
}

.offline-icon-box {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: var(--icon-box-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
}

.offline-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 10px;
  line-height: 1.3;
}

.offline-desc {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 28px;
  max-width: 320px;
}

.offline-reload-btn {
  background: #2196F3;
  color: #FFFFFF;
  border: none;
  border-radius: 12px;
  padding: 12px 24px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  transition: background 0.15s ease, transform 0.1s ease;
  user-select: none;
}

.offline-reload-btn:hover {
  background: #1E88E5;
}

.offline-reload-btn:active {
  transform: scale(0.98);
}

.offline-lang-bar {
  margin-top: 32px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px;
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  border-radius: 20px;
}

.offline-lang-btn {
  background: transparent;
  border: none;
  padding: 4px 12px;
  border-radius: 14px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.offline-lang-btn.active {
  background: var(--bg-elevated);
  color: var(--text-primary);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}
</style>
</head>
<body>
  <div class="offline-card">
    <div class="offline-icon-box">
      ${OFFLINE_WIFI_ICON}
    </div>
    <h1 class="offline-title" id="offlineTitle">${esc(t.error.offlineTitle)}</h1>
    <p class="offline-desc" id="offlineDesc">${esc(t.error.offlineDesc)}</p>
    <button type="button" class="offline-reload-btn" id="offlineReloadBtn">
      ${REFRESH_ICON}
      <span id="offlineReloadText">${esc(t.error.reloadBtn)}</span>
    </button>
    <div class="offline-lang-bar">
      <button type="button" class="offline-lang-btn" data-lang="ru">RU</button>
      <button type="button" class="offline-lang-btn" data-lang="en">EN</button>
      <button type="button" class="offline-lang-btn" data-lang="uz">UZ</button>
      <button type="button" class="offline-lang-btn" data-lang="kz">KZ</button>
    </div>
  </div>

  <script>
  (function() {
    var I18N = ${safeJsonForScript(OFFLINE_I18N_MAP)};

    function normalizeCode(raw) {
      if (!raw) return null;
      var clean = String(raw).trim().toLowerCase().split(/[-_]/)[0];
      if (clean === 'kk') clean = 'kz';
      return I18N[clean] ? clean : null;
    }

    function getSavedLang() {
      try {
        var stored = normalizeCode(localStorage.getItem('photogram_lang'));
        if (stored) return stored;
      } catch (e) {}

      var m = (document.cookie || '').match(/(?:^|;\\s*)lang=([a-zA-Z_-]+)/);
      if (m && m[1]) {
        var fromCookie = normalizeCode(m[1]);
        if (fromCookie) return fromCookie;
      }

      var list = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || 'ru'];
      for (var i = 0; i < list.length; i++) {
        var matched = normalizeCode(list[i]);
        if (matched) return matched;
      }
      return 'ru';
    }

    function applyLang(code) {
      var safeCode = normalizeCode(code) || 'ru';
      var data = I18N[safeCode] || I18N.ru;
      var titleEl = document.getElementById('offlineTitle');
      var descEl = document.getElementById('offlineDesc');
      var reloadEl = document.getElementById('offlineReloadText');

      if (titleEl) titleEl.textContent = data.title;
      if (descEl) descEl.textContent = data.desc;
      if (reloadEl) reloadEl.textContent = data.reload;
      document.title = data.title + ' — Photogram';
      document.documentElement.lang = safeCode;

      document.querySelectorAll('.offline-lang-btn').forEach(function(btn) {
        if (btn.dataset.lang === safeCode) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    function retryNavigation() {
      if (window.location.pathname === '/offline') {
        window.location.href = '/feed';
      } else {
        window.location.reload();
      }
    }

    applyLang(getSavedLang());

    var reloadBtn = document.getElementById('offlineReloadBtn');
    if (reloadBtn) {
      reloadBtn.addEventListener('click', retryNavigation);
    }

    document.querySelectorAll('.offline-lang-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var lang = normalizeCode(this.dataset.lang);
        if (!lang) return;
        try {
          localStorage.setItem('photogram_lang', lang);
        } catch (e) {}
        var s = window.location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = 'lang=' + lang + '; Path=/; Max-Age=31536000; SameSite=Lax' + s;
        applyLang(lang);
      });
    });

    window.addEventListener('pageshow', function() {
      if (window.__applyOfflineTheme) window.__applyOfflineTheme();
      applyLang(getSavedLang());
    });

    window.addEventListener('online', retryNavigation);
  })();
  </script>
</body>
</html>`;
}
