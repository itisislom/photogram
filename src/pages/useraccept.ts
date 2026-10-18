import { layout, esc } from './layout';
import { Translations, ru, renderLangSwitcherHtml } from '../languages';

export function getLegalCardsHtml(t: Translations = ru): string {
  return `
  <header class="legal-header">
    <h1 class="legal-title">${esc(t.legal.title)}</h1>
    <div class="legal-date">${esc(t.legal.date)}</div>
  </header>
  ${t.legal.cards.map(card => `
  <div class="legal-card">
    <h2>${esc(card.title)}</h2>
    ${card.paragraphs.map(p => `<p>${esc(p)}</p>`).join('')}
    ${card.list ? `
    <ul>
      ${card.list.map(item => `<li>${esc(item)}</li>`).join('')}
    </ul>` : ''}
  </div>
  `).join('')}`;
}

export function renderTranslateBarHtml(t: Translations = ru): string {
  return `
<div class="legal-translate-bar notranslate" translate="no">
  <div class="legal-translate-info">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="2" y1="12" x2="22" y2="12"></line>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
    </svg>
    <span id="systemLangLabel">${esc(t.common.selectLanguage)}: ${esc(t.name)}</span>
  </div>
  <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
    ${renderLangSwitcherHtml(t.code)}
    <div id="google_translate_element" class="legal-translate-widget"></div>
  </div>
</div>`;
}

export function getTranslateScript(lazy: boolean = false): string {
  return `
window.initGoogleTranslate = function() {
  if (window.__googleTranslateLoaded) return;
  window.__googleTranslateLoaded = true;

  window.googleTranslateElementInit = function() {
    if (window.google && window.google.translate) {
      new window.google.translate.TranslateElement({
        pageLanguage: 'ru',
        includedLanguages: 'ru,uz,en,kk,ky,tg,tr,es,de,fr,ar,zh-CN',
        autoDisplay: false
      }, 'google_translate_element');
    }
  };

  function applyLanguage(targetLang) {
    if (!targetLang) return;
    targetLang = targetLang.split('-')[0].toLowerCase();

    var cookieVal = '/ru/' + targetLang;
    document.cookie = 'googtrans=' + cookieVal + '; path=/';
    var host = window.location.hostname;
    if (host && host !== 'localhost') {
      document.cookie = 'googtrans=' + cookieVal + '; path=/; domain=' + host;
    }

    var checkCount = 0;
    var interval = setInterval(function() {
      checkCount++;
      var combo = document.querySelector('.goog-te-combo');
      if (combo) {
        if (combo.value !== targetLang) {
          combo.value = targetLang;
          combo.dispatchEvent(new Event('change'));
        }
        clearInterval(interval);
      }
      if (checkCount > 60) clearInterval(interval);
    }, 150);
  }

  var rawLang = (navigator.languages && navigator.languages.length) ? navigator.languages[0] : (navigator.language || navigator.userLanguage || 'ru');
  var sysLang = (rawLang || 'ru').split('-')[0].toLowerCase();

  var sysLabel = document.getElementById('systemLangLabel');
  if (sysLabel) {
    var langNames = { 'ru': 'Язык: Русский', 'uz': "Til: O'zbekcha", 'en': 'Language: English', 'kz': 'Тіл: Қазақша' };
    if (langNames[sysLang]) {
      sysLabel.textContent = langNames[sysLang];
    }
  }

  if (sysLang && sysLang !== 'ru' && sysLang !== 'en' && sysLang !== 'uz' && sysLang !== 'kz' && sysLang !== 'kk') {
    applyLanguage(sysLang);
  }

  if (!document.getElementById('google-translate-script')) {
    var s = document.createElement('script');
    s.id = 'google-translate-script';
    s.type = 'text/javascript';
    s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    document.head.appendChild(s);
  } else if (window.googleTranslateElementInit) {
    window.googleTranslateElementInit();
  }
};
${lazy ? '' : 'window.initGoogleTranslate();'}
`;
}

export function userAcceptPage(t: Translations = ru): string {
  const body = `
<div class="legal-container">
  <div class="legal-top-bar notranslate" translate="no">
    <a href="/register" class="legal-back-btn">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="19" y1="12" x2="5" y2="12"></line>
        <polyline points="12 19 5 12 12 5"></polyline>
      </svg>
      ${esc(t.legal.backToRegister)}
    </a>
  </div>
  ${renderTranslateBarHtml(t)}
  ${getLegalCardsHtml(t)}
</div>`;

  return layout(t.legal.title, body, getTranslateScript(false), t);
}
