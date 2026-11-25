import { Translations, ru } from '../languages';
import { esc } from './layout';

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

export function errorPage(t: Translations = ru, theme?: string): string {
  const themeAttr = theme === 'dark' || theme === 'light' ? ` data-theme="${theme}" style="color-scheme: ${theme};"` : '';
  const metaThemeColor = theme === 'dark' ? '#000000' : '#FFFFFF';

  return `<!DOCTYPE html>
<html lang="${t.code}"${themeAttr}>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="${metaThemeColor}">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<title>${esc(t.error.offlineTitle)} — Photogram</title>
<link rel="icon" type="image/svg+xml" href="/icon.svg">
<link rel="apple-touch-icon" href="/icon.jpg">
<link rel="manifest" href="/manifest.webmanifest">
<script>
(function() {
  var t;
  try {
    t = localStorage.getItem('theme');
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
  document.documentElement.setAttribute('data-theme', t);
  document.documentElement.style.colorScheme = t;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', t === 'dark' ? '#000000' : '#FFFFFF');
  }
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

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background: var(--bg-secondary);
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
    <button type="button" class="offline-reload-btn" id="offlineReloadBtn" onclick="window.location.href='/feed'">
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
    var I18N = {
      ru: {
        title: 'Нет подключения к интернету',
        desc: 'Проверьте сетевое соединение и повторите попытку',
        reload: 'Перезагрузить'
      },
      en: {
        title: 'No internet connection',
        desc: 'Please check your connection and try again',
        reload: 'Reload'
      },
      uz: {
        title: 'Internet aloqasi yo‘q',
        desc: 'Iltimos, internet ulanishini tekshiring va qaytadan urinib ko‘ring',
        reload: 'Qayta yuklash'
      },
      kz: {
        title: 'Интернет байланысы жоқ',
        desc: 'Интернет байланысын тексеріп, қайталап көріңіз',
        reload: 'Қайта жүктеу'
      }
    };

    function getSavedLang() {
      try {
        var stored = localStorage.getItem('photogram_lang');
        if (stored && I18N[stored]) return stored;
      } catch (e) {}

      var m = document.cookie.match(/(?:^|;\\s*)lang=([a-zA-Z-]+)/);
      if (m && m[1]) {
        var c = m[1].toLowerCase().slice(0, 2);
        if (I18N[c]) return c;
      }

      var nav = (navigator.language || '').toLowerCase().slice(0, 2);
      if (I18N[nav]) return nav;
      return 'ru';
    }

    function applyLang(code) {
      var data = I18N[code] || I18N.ru;
      var titleEl = document.getElementById('offlineTitle');
      var descEl = document.getElementById('offlineDesc');
      var reloadEl = document.getElementById('offlineReloadText');

      if (titleEl) titleEl.textContent = data.title;
      if (descEl) descEl.textContent = data.desc;
      if (reloadEl) reloadEl.textContent = data.reload;
      document.documentElement.lang = code;

      document.querySelectorAll('.offline-lang-btn').forEach(function(btn) {
        if (btn.dataset.lang === code) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    var currentLang = getSavedLang();
    applyLang(currentLang);

    document.querySelectorAll('.offline-lang-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var lang = this.dataset.lang;
        if (!lang || !I18N[lang]) return;
        try {
          localStorage.setItem('photogram_lang', lang);
        } catch (e) {}
        document.cookie = 'lang=' + lang + ';path=/;max-age=31536000';
        applyLang(lang);
      });
    });

    window.addEventListener('online', function() {
      window.location.href = '/feed';
    });
  })();
  </script>
</body>
</html>`;
}
