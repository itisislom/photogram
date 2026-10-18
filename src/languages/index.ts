import { LangCode, Translations } from './types';
import { ru } from './ru';
import { en } from './en';
import { uz } from './uz';
import { kz } from './kz';

export * from './types';
export { ru, en, uz, kz };

export const SUPPORTED_LANGUAGES: readonly LangCode[] = ['ru', 'en', 'uz', 'kz'] as const;

export const LANGUAGE_NAMES: Record<LangCode, string> = {
  ru: 'Русский',
  en: 'English',
  uz: "O'zbekcha",
  kz: 'Қазақша',
};

const DICTIONARIES: Record<LangCode, Translations> = {
  ru,
  en,
  uz,
  kz,
};

export function normalizeLang(raw?: string | null): LangCode | null {
  if (!raw) return null;
  const clean = raw.trim().toLowerCase().split(/[-_]/)[0];
  if (clean === 'ru') return 'ru';
  if (clean === 'en') return 'en';
  if (clean === 'uz') return 'uz';
  if (clean === 'kz' || clean === 'kk') return 'kz';
  return null;
}

export function detectLanguage(request: Request): LangCode {
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(/(?:^|;\s*)lang=([a-zA-Z-]+)/);
  if (match) {
    const fromCookie = normalizeLang(match[1]);
    if (fromCookie) return fromCookie;
  }

  const accept = request.headers.get('Accept-Language');
  if (accept) {
    const parts = accept.split(',');
    for (const part of parts) {
      const code = part.split(';')[0];
      const detected = normalizeLang(code);
      if (detected) return detected;
    }
  }

  return 'ru';
}

export function getTranslations(lang: string | LangCode): Translations {
  const normalized = normalizeLang(lang) || 'ru';
  return DICTIONARIES[normalized] || ru;
}

export function renderLangSwitcherHtml(currentLang: LangCode, extraClass: string = ''): string {
  return `
<div class="lang-switcher-wrap notranslate ${extraClass}" translate="no">
  ${SUPPORTED_LANGUAGES.map(code => `
    <button type="button" class="lang-switch-btn ${code === currentLang ? 'active' : ''}" data-lang-code="${code}">
      ${code.toUpperCase()}
    </button>
  `).join('')}
</div>`;
}

export function renderLangScript(): string {
  return `
(function() {
  function getCookie(name) {
    var pairs = (document.cookie || '').split(';');
    for (var i = 0; i < pairs.length; i++) {
      var item = pairs[i].trim();
      if (item.indexOf(name + '=') === 0) {
        return decodeURIComponent(item.substring(name.length + 1));
      }
    }
    return null;
  }

  function setCookie(name, val) {
    document.cookie = name + '=' + encodeURIComponent(val) + '; path=/; max-age=31536000; SameSite=Lax';
  }

  async function setLanguage(code) {
    if (!code) return;
    try {
      localStorage.setItem('photogram_lang', code);
    } catch(e) {}
    setCookie('lang', code);

    try {
      await fetch('/api/lang', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang: code })
      });
    } catch(e) {}

    window.location.reload();
  }

  document.addEventListener('click', function(e) {
    var btn = e.target && e.target.closest ? e.target.closest('[data-lang-code]') : null;
    if (btn) {
      var code = btn.getAttribute('data-lang-code');
      if (code) {
        e.preventDefault();
        setLanguage(code);
      }
    }
  });

  var savedLang = null;
  try {
    savedLang = localStorage.getItem('photogram_lang');
  } catch(e) {}

  var cookieLang = getCookie('lang');

  if (savedLang) {
    if (cookieLang !== savedLang) {
      setCookie('lang', savedLang);
    }
    var currentHtmlLang = document.documentElement.getAttribute('lang') || 'ru';
    if (currentHtmlLang !== savedLang) {
      window.location.reload();
    }
    return;
  }

  if (cookieLang) {
    try {
      localStorage.setItem('photogram_lang', cookieLang);
    } catch(e) {}
    return;
  }

  var rawList = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || navigator.userLanguage || 'ru'];
  var matched = null;
  for (var i = 0; i < rawList.length; i++) {
    var tag = String(rawList[i] || '').toLowerCase().split(/[-_]/)[0];
    if (tag === 'ru') { matched = 'ru'; break; }
    if (tag === 'en') { matched = 'en'; break; }
    if (tag === 'uz') { matched = 'uz'; break; }
    if (tag === 'kz' || tag === 'kk') { matched = 'kz'; break; }
  }

  if (matched) {
    try {
      localStorage.setItem('photogram_lang', matched);
    } catch(e) {}
    setCookie('lang', matched);
    var currentHtmlLang = document.documentElement.getAttribute('lang') || 'ru';
    if (currentHtmlLang !== matched) {
      window.location.reload();
    }
  }
})();
`;
}
