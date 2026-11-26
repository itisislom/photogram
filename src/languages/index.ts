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

const DATE_FORMATS: Record<LangCode, { monthsLong: string[]; monthsShort: string[]; fullPattern: 'dmy_suffix' | 'mdy'; yearSuffix: string }> = {
  ru: {
    monthsLong: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
    monthsShort: ['янв.', 'февр.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'],
    fullPattern: 'dmy_suffix',
    yearSuffix: ' г.',
  },
  en: {
    monthsLong: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    fullPattern: 'mdy',
    yearSuffix: '',
  },
  uz: {
    monthsLong: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
    monthsShort: ['yan.', 'fev.', 'mar.', 'apr.', 'may', 'iyun', 'iyul', 'avg.', 'sen.', 'okt.', 'noy.', 'dek.'],
    fullPattern: 'dmy_suffix',
    yearSuffix: ' y.',
  },
  kz: {
    monthsLong: ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан'],
    monthsShort: ['қаң.', 'ақп.', 'нау.', 'сәу.', 'мам.', 'мау.', 'шіл.', 'там.', 'қыр.', 'қаз.', 'қар.', 'жел.'],
    fullPattern: 'dmy_suffix',
    yearSuffix: ' ж.',
  },
};

export function formatLocalizedFullDate(d: Date, lang: LangCode): string {
  const cfg = DATE_FORMATS[lang] || DATE_FORMATS.ru;
  const day = d.getDate();
  const month = cfg.monthsLong[d.getMonth()] || '';
  const year = d.getFullYear();
  if (cfg.fullPattern === 'mdy') {
    return `${month} ${day}, ${year}`;
  }
  return `${day} ${month} ${year}${cfg.yearSuffix}`;
}

export function formatLocalizedShortDate(d: Date, lang: LangCode, timeZone?: string): string {
  const cfg = DATE_FORMATS[lang] || DATE_FORMATS.ru;
  let day = d.getDate();
  let monthIdx = d.getMonth();
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        month: 'numeric',
        day: 'numeric',
      }).formatToParts(d);
      const mPart = parts.find((p) => p.type === 'month')?.value;
      const dPart = parts.find((p) => p.type === 'day')?.value;
      if (mPart && dPart) {
        monthIdx = Math.max(0, Math.min(11, parseInt(mPart, 10) - 1));
        day = parseInt(dPart, 10);
      }
    } catch {}
  }
  const month = cfg.monthsShort[monthIdx] || '';
  if (cfg.fullPattern === 'mdy') {
    return `${month} ${day}`;
  }
  return `${day} ${month}`;
}

export function formatLocalizedTime(d: Date, timeZone?: string): string {
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(d);
      let hh = parts.find((p) => p.type === 'hour')?.value || '00';
      const mm = parts.find((p) => p.type === 'minute')?.value || '00';
      if (hh === '24') hh = '00';
      return `${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`;
    } catch {}
  }
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function getClientDateFormat(lang: LangCode): { monthsLong: string[]; monthsShort: string[]; fullPattern: string; yearSuffix: string } {
  return DATE_FORMATS[lang] || DATE_FORMATS.ru;
}

const COMPACT_COUNT_UNITS: Record<LangCode, { k: string; m: string; b: string }> = {
  ru: { k: 'тыс.', m: 'млн', b: 'млрд' },
  en: { k: 'K', m: 'M', b: 'B' },
  uz: { k: 'ming', m: 'mln', b: 'mlrd' },
  kz: { k: 'мың', m: 'млн', b: 'млрд' },
};

export function getCompactCountUnits(lang: LangCode): { k: string; m: string; b: string } {
  return COMPACT_COUNT_UNITS[lang] || COMPACT_COUNT_UNITS.ru;
}

export function formatCompactCount(count: number, lang: LangCode): string {
  const raw = Number(count);
  if (!Number.isFinite(raw) || raw <= 0) return '0';
  const n = Math.floor(raw);
  if (n < 1000) return String(n);
  const u = getCompactCountUnits(lang);
  const sep = lang === 'en' ? '' : ' ';
  const fmt = (val: number, unit: string) => {
    const rounded = val >= 100 ? Math.floor(val) : Math.floor(val * 10) / 10;
    const str = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(/\.0$/, '');
    return `${str}${sep}${unit}`;
  };
  if (n >= 1_000_000_000) return fmt(n / 1_000_000_000, u.b);
  if (n >= 1_000_000) return fmt(n / 1_000_000, u.m);
  return fmt(n / 1_000, u.k);
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
    var secureFlag = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = name + '=' + encodeURIComponent(val) + '; path=/; max-age=31536000; SameSite=Lax' + secureFlag;
  }

  var isSwitchingLang = false;

  async function setLanguage(code) {
    if (!code || isSwitchingLang) return;
    var currentHtmlLang = (document.documentElement.getAttribute('lang') || 'ru').toLowerCase();
    if (code === currentHtmlLang) {
      try {
        localStorage.setItem('photogram_lang', code);
      } catch(e) {}
      if (getCookie('lang') !== code) {
        setCookie('lang', code);
      }
      return;
    }

    isSwitchingLang = true;
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

    try {
      if (typeof window.ensurePushSubscription === 'function' && 'Notification' in window && Notification.permission === 'granted') {
        await window.ensurePushSubscription(false);
      }
    } catch(e) {}

    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'REFRESH_OFFLINE' });
      }
    } catch(e) {}

    var path = window.location.pathname;
    if ((path === '/login' || path === '/register') && typeof window.softReloadAuthLanguage === 'function') {
      var swapped = await window.softReloadAuthLanguage(code);
      isSwitchingLang = false;
      if (swapped) return;
    }

    window.location.reload();
  }

  if (!window.__pgLangClickBound) {
    window.__pgLangClickBound = true;
    document.addEventListener('click', function(e) {
      var btn = e.target && e.target.closest ? e.target.closest('[data-lang-code]') : null;
      if (btn) {
        var code = btn.getAttribute('data-lang-code');
        if (code) {
          e.preventDefault();
          var currentHtmlLang = (document.documentElement.getAttribute('lang') || 'ru').toLowerCase();
          if (btn.classList.contains('active') || code === currentHtmlLang) {
            try {
              localStorage.setItem('photogram_lang', code);
            } catch(err) {}
            if (getCookie('lang') !== code) {
              setCookie('lang', code);
            }
            return;
          }
          setLanguage(code);
        }
      }
    });
  }

  var savedLang = null;
  try {
    var rawSaved = localStorage.getItem('photogram_lang');
    if (rawSaved === 'ru' || rawSaved === 'en' || rawSaved === 'uz' || rawSaved === 'kz') {
      savedLang = rawSaved;
    } else if (rawSaved) {
      localStorage.removeItem('photogram_lang');
    }
  } catch(e) {}

  var rawCookieLang = getCookie('lang');
  var cookieLang = (rawCookieLang === 'ru' || rawCookieLang === 'en' || rawCookieLang === 'uz' || rawCookieLang === 'kz') ? rawCookieLang : null;

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
