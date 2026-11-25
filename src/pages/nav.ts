import { Translations, ru } from '../languages';
import { esc } from './layout';

const HOME_ICON = `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>`;
const SEARCH_ICON = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
const PLUS_ICON = `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
const USER_ICON = `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
export const CLOSE_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="5" y2="19"/><line x1="5" y1="5" x2="19" y2="19"/></svg>`;

export function renderBottomNav(activeTab: 'feed' | 'explore' | 'profile' | 'create', t: Translations = ru): string {
  return `
  <nav class="bottom-nav">
    <a href="/feed" class="bottom-nav-item ${activeTab === 'feed' ? 'active' : ''}" title="${esc(t.nav.feed)}">${HOME_ICON}</a>
    <a href="/explore" class="bottom-nav-item ${activeTab === 'explore' ? 'active' : ''}" title="${esc(t.nav.explore)}">${SEARCH_ICON}</a>
    <a href="/publishpost" class="bottom-nav-item ${activeTab === 'create' ? 'active' : ''}" aria-label="${esc(t.nav.create)}" title="${esc(t.nav.create)}">${PLUS_ICON}</a>
    <a href="/profile" class="bottom-nav-item ${activeTab === 'profile' ? 'active' : ''}" title="${esc(t.nav.profile)}">${USER_ICON}</a>
  </nav>`;
}
