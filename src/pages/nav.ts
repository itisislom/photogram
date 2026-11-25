import { Translations, ru } from '../languages';
import { esc } from './layout';

const HOME_ICON = `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>`;
const SEARCH_ICON = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
const PLUS_ICON = `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
const CHAT_ICON = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;
const USER_ICON = `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
export const CLOSE_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="5" y2="19"/><line x1="5" y1="5" x2="19" y2="19"/></svg>`;

export function renderBottomNav(activeTab: 'feed' | 'explore' | 'profile' | 'create' | 'messages', t: Translations = ru): string {
  return `
  <nav class="bottom-nav">
    <a href="/feed" class="bottom-nav-item ${activeTab === 'feed' ? 'active' : ''}" aria-label="${esc(t.nav.feed)}" title="${esc(t.nav.feed)}">${HOME_ICON}</a>
    <a href="/explore" class="bottom-nav-item ${activeTab === 'explore' ? 'active' : ''}" aria-label="${esc(t.nav.explore)}" title="${esc(t.nav.explore)}">${SEARCH_ICON}</a>
    <a href="/publishpost" class="bottom-nav-item bottom-nav-center ${activeTab === 'create' ? 'active' : ''}" aria-label="${esc(t.nav.create)}" title="${esc(t.nav.create)}">${PLUS_ICON}</a>
    <a href="/messages" class="bottom-nav-item bottom-nav-messages ${activeTab === 'messages' ? 'active' : ''}" aria-label="${esc(t.nav.messages)}" title="${esc(t.nav.messages)}">${CHAT_ICON}<span class="nav-unread-badge" id="navMessagesBadge" style="display:none;"></span></a>
    <a href="/profile" class="bottom-nav-item ${activeTab === 'profile' ? 'active' : ''}" aria-label="${esc(t.nav.profile)}" title="${esc(t.nav.profile)}">${USER_ICON}</a>
  </nav>`;
}
