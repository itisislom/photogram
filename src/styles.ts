export function getStyles(): string {
  return `
:root,
html[data-theme="light"] {
  --bg-primary: #FFFFFF;
  --bg-secondary: #FAFAFA;
  --bg-elevated: #FFFFFF;
  --text-primary: #111111;
  --text-secondary: #737373;
  --border-color: #DBDBDB;
  --input-bg: #EFEFEF;
  --pill-bg: #EFEFEF;
  --modal-overlay: rgba(0, 0, 0, 0.6);
  --crop-bg: #000000;
  --like-color: #ED4956;
  --accent-color: #2196F3;
  --accent-hover: #1E88E5;
}

html[data-theme="dark"] {
  --bg-primary: #000000;
  --bg-secondary: #121212;
  --bg-elevated: #1C1C1E;
  --text-primary: #F5F5F5;
  --text-secondary: #A8A8A8;
  --border-color: #262626;
  --input-bg: #262626;
  --pill-bg: #1F1F1F;
  --modal-overlay: rgba(0, 0, 0, 0.75);
  --crop-bg: #000000;
  --like-color: #FF3040;
  --accent-color: #2196F3;
  --accent-hover: #1E88E5;
}

*,
*::before,
*::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
  background: var(--bg-primary);
  color-scheme: light dark;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

#appPageRoot {
  min-height: 100dvh;
  background: var(--bg-primary);
  transition: opacity 0.16s ease;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  line-height: 1.5;
  min-height: 100dvh;
  overflow-x: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
  overscroll-behavior: none;
  touch-action: pan-x pan-y;
}

.theme-switcher {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--input-bg);
  padding: 4px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
}

.theme-switch-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 40px;
  padding: 6px 14px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}

.theme-switch-btn svg {
  flex-shrink: 0;
  color: inherit;
}

.theme-switch-btn.active {
  background: var(--bg-elevated);
  color: var(--text-primary);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
}

::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

img:not(#cropImage),
.feed-card-photo,
.feed-card-img,
.explore-item,
.pics-image,
.post-view-image,
.avatar-box,
.avatar-circle {
  pointer-events: none !important;
  -webkit-touch-callout: none !important;
  -webkit-user-drag: none !important;
  user-drag: none !important;
  -webkit-user-select: none !important;
  user-select: none !important;
}

#cropImage {
  pointer-events: auto !important;
  -webkit-user-select: none !important;
  user-select: none !important;
}

.terms-modal-body {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  line-height: 1.6;
}

.terms-modal-body .legal-card {
  box-shadow: none;
  margin-bottom: 12px;
  padding: 14px 16px;
}

input,
textarea {
  -webkit-user-select: text;
  user-select: text;
}


a {
  text-decoration: none;
  color: inherit;
}

.auth-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  padding: 24px 16px;
  padding-top: max(24px, env(safe-area-inset-top));
  padding-bottom: max(24px, env(safe-area-inset-bottom));
  animation: pageFadeIn 0.2s ease forwards;
}

.auth-card {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
}

.auth-logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.auth-logo-icon {
  width: 72px;
  height: 72px;
  border-radius: 18px;
  background: linear-gradient(135deg, #2196F3, #F48FB1, #FFD54F);
  display: flex;
  align-items: center;
  justify-content: center;
}

.auth-logo-icon svg {
  width: 36px;
  height: 36px;
}

.auth-logo h1 {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.5px;
}

.auth-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.input-field {
  position: relative;
  width: 100%;
}

.input-field input {
  width: 100%;
  height: 56px;
  padding: 24px 16px 8px;
  border: 1.5px solid var(--border-color);
  border-radius: 12px;
  font-size: 16px;
  font-family: inherit;
  color: var(--text-primary);
  background: var(--input-bg);
  outline: none;
  transition: border-color 0.2s, background-color 0.2s;
}

.input-field input#password,
.password-field input {
  padding-right: 48px;
}

.password-toggle-btn {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  color: var(--text-secondary);
  border-radius: 8px;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition: color 0.2s;
}

.password-toggle-btn:hover {
  color: var(--text-primary);
}

.password-toggle-btn:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: -2px;
}

.password-toggle-btn .eye-closed {
  display: none;
}

.password-toggle-btn.is-revealed .eye-open {
  display: none;
}

.password-toggle-btn.is-revealed .eye-closed {
  display: block;
}

.input-field input:focus {
  border-color: var(--accent-color);
  background: var(--bg-elevated);
}

.input-field label {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 16px;
  color: var(--text-secondary);
  pointer-events: none;
  transition: top 0.2s, transform 0.2s, font-size 0.2s, color 0.2s;
}

.input-field input:focus + label,
.input-field input:not(:placeholder-shown) + label,
.input-field input:-webkit-autofill + label,
.input-field input:autofill + label,
.input-field.has-value label {
  top: 8px;
  transform: translateY(0);
  font-size: 12px;
  color: var(--text-secondary);
}

.input-field input:focus + label {
  color: var(--accent-color);
}

.input-field input:-webkit-autofill,
.input-field input:-webkit-autofill:hover,
.input-field input:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0 1000px var(--input-bg) inset;
  -webkit-text-fill-color: var(--text-primary);
}

.input-field input:focus:-webkit-autofill {
  -webkit-box-shadow: 0 0 0 1000px var(--bg-elevated) inset;
  border-color: var(--accent-color);
}

.field-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: -8px;
  margin-bottom: 2px;
  padding: 0 4px;
  line-height: 1.4;
}

.field-hint.warning {
  color: #E65100;
  font-weight: 500;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  text-decoration: none;
  box-sizing: border-box;
  width: 100%;
  height: 52px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  margin-top: 4px;
}

.btn:active {
  transform: scale(0.98);
}

.btn:disabled {
  cursor: not-allowed;
  transform: none;
}

.btn-primary {
  background: #2196F3;
  color: #FFFFFF;
}

.btn-primary:disabled {
  background: var(--input-bg);
  color: var(--text-secondary);
  cursor: not-allowed;
  transform: none;
  opacity: 1;
}

.auth-error {
  width: 100%;
  padding: 12px 16px;
  background: #FFEBEE;
  border-radius: 12px;
  color: #EF5350;
  font-size: 14px;
  text-align: center;
  display: none;
}

.auth-error.visible {
  display: block;
  animation: pageFadeIn 0.2s ease forwards;
}

.auth-footer {
  font-size: 14px;
  color: var(--text-secondary);
}

.auth-footer a {
  color: #2196F3;
  font-weight: 600;
}

.terms-checkbox-wrap {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
  user-select: none;
  font-size: 13px;
  line-height: 1.45;
  color: var(--text-secondary);
  margin: 4px 0 8px;
  text-align: left;
}

.terms-checkbox-wrap input[type="checkbox"] {
  width: 20px;
  height: 20px;
  min-width: 20px;
  margin-top: 1px;
  cursor: pointer;
  accent-color: #2196F3;
}

.terms-checkbox-text a {
  color: #2196F3;
  text-decoration: underline;
  font-weight: 500;
}

.legal-container {
  width: 100%;
  max-width: 680px;
  margin: 0 auto;
  padding: 24px 16px 60px;
  line-height: 1.6;
  color: var(--text-primary);
  animation: pageFadeIn 0.2s ease forwards;
}

.legal-header {
  margin-bottom: 24px;
}

.legal-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.legal-date {
  font-size: 13px;
  color: var(--text-secondary);
}

.legal-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  padding: 18px 20px;
  margin-bottom: 16px;
}

.legal-card h2 {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 10px;
}

.legal-card p {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 10px;
}

.legal-card p:last-child {
  margin-bottom: 0;
}

.legal-card ul {
  padding-left: 20px;
  margin: 8px 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.legal-card li {
  margin-bottom: 6px;
}

.legal-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #2196F3;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}

.legal-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 20px;
}

.legal-translate-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 10px 14px;
  margin-bottom: 16px;
}

.legal-translate-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}


.legal-translate-widget {
  min-height: 32px;
  display: flex;
  align-items: center;
}

.lang-switcher-wrap {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  padding: 3px;
  border-radius: 9px;
}

.lang-switch-btn {
  background: transparent;
  border: none;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
  padding: 4px 8px;
  border-radius: 7px;
  cursor: pointer;
  min-height: 28px;
  min-width: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.lang-switch-btn:hover {
  color: var(--text-primary);
}

.lang-switch-btn.active {
  background: var(--bg-elevated);
  color: var(--text-primary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.goog-te-gadget {
  font-family: inherit !important;
  font-size: 13px !important;
  color: #757575 !important;
}

.goog-te-gadget .goog-te-combo {
  padding: 5px 8px;
  border: 1.5px solid #E0E0E0;
  border-radius: 8px;
  font-size: 13px;
  font-family: inherit;
  color: #1A1A1A;
  background: #FFFFFF;
  outline: none;
  cursor: pointer;
}

.goog-te-banner-frame,
.goog-te-banner-frame.skiptranslate {
  display: none !important;
}

body {
  top: 0px !important;
}

.temp-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  padding: 24px 16px;
  gap: 16px;
  text-align: center;
}

.temp-page h2 {
  font-size: 24px;
  font-weight: 700;
}

.temp-page p {
  font-size: 16px;
  color: #757575;
}

.temp-page .btn {
  max-width: 200px;
}

.app-layout {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  padding-bottom: calc(56px + env(safe-area-inset-bottom));
}

.top-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  padding: 0 16px;
  padding-top: env(safe-area-inset-top);
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
}

.top-bar-title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.3px;
  color: var(--text-primary);
}

.top-bar-action {
  background: none;
  border: none;
  padding: 8px;
  cursor: pointer;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.profile-container {
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: pageFadeIn 0.2s ease forwards;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 24px;
}

.profile-avatar-wrap {
  position: relative;
  width: 86px;
  height: 86px;
  flex-shrink: 0;
}

.profile-avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  background: var(--bg-secondary);
  border: 2px solid #2196F3;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: 700;
  color: #2196F3;
  overflow: hidden;
}

.profile-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-avatar-edit-badge {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #2196F3;
  color: #FFFFFF;
  border: 2px solid #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.profile-avatar-edit-badge svg {
  width: 14px;
  height: 14px;
}

.profile-header-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.profile-header-username {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  text-align: left;
  letter-spacing: -0.2px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.follows-you-tag {
  display: inline-block;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--pill-bg);
  border: 1px solid var(--border-color);
  padding: 2px 8px;
  border-radius: 10px;
  line-height: 1.4;
}


.profile-stats {
  width: 100%;
  display: flex;
  justify-content: space-around;
  text-align: center;
}


.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-number {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.profile-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.profile-display-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.profile-bio {
  font-size: 14px;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

.profile-actions {
  display: flex;
  gap: 8px;
}

.profile-actions .btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.btn-secondary {
  background: var(--pill-bg);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:active {
  background: var(--input-bg);
}

.btn-danger {
  background: #EF5350;
  color: #FFFFFF;
}

.btn-danger:active {
  background: #E53935;
}


.btn-sm {
  height: 38px;
  font-size: 14px;
  border-radius: 10px;
  margin-top: 0;
}

.menu-action-btn {
  width: 100%;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 0 16px;
  gap: 12px;
  background: var(--pill-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  color: var(--text-primary);
  text-decoration: none;
  box-sizing: border-box;
}

.menu-action-btn svg {
  flex-shrink: 0;
  color: var(--text-primary);
}

.menu-action-btn:active {
  background: var(--input-bg);
}

.menu-action-danger {
  color: #EF5350;
}

.menu-action-danger svg {
  color: #EF5350;
}

.menu-action-danger:active {
  background: #FFEBEE;
}


.profile-empty {
  padding: 48px 16px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 14px;
}

.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: calc(54px + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--bg-primary);
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-around;
  z-index: 250;
}

.bottom-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 54px;
  height: 54px;
  color: var(--text-secondary);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: opacity 0.15s ease;
}

.bottom-nav-item:active {
  opacity: 0.6;
}

.bottom-nav-item.active {
  color: #2196F3;
}

.bottom-nav-item svg {
  width: 24px;
  height: 24px;
}

.profile-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
  margin-top: 16px;
  width: 100%;
}

.profile-grid-item {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  background: var(--input-bg);
  overflow: hidden;
  cursor: pointer;
  display: block;
  border: none;
  padding: 0;
}

.profile-grid-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: opacity 0.2s;
}

.profile-grid-item:active img {
  opacity: 0.85;
}

.explore-mosaic-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
  grid-auto-flow: dense;
  width: 100%;
}

.explore-grid-item {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  background: var(--input-bg);
  overflow: hidden;
  cursor: pointer;
  display: block;
  border: none;
  padding: 0;
}

.explore-mosaic-grid .explore-grid-item:nth-child(10n + 2) {
  grid-column: span 2;
  grid-row: span 2;
}

.explore-grid-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.explore-grid-item:hover img {
  transform: scale(1.02);
}

.explore-grid-item:active img {
  opacity: 0.85;
}

.explore-item-likes-badge {
  position: absolute;
  bottom: 6px;
  left: 6px;
  background: rgba(0, 0, 0, 0.55);
  color: #FFFFFF;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  pointer-events: none;
  opacity: 0.9;
  transition: opacity 0.15s ease, background 0.15s ease;
}

.explore-grid-item:hover .explore-item-likes-badge {
  opacity: 1;
  background: rgba(0, 0, 0, 0.75);
}

.explore-badge-part {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.post-caption-block {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.post-caption-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.post-caption-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.post-caption-counter {
  font-size: 12px;
  color: var(--text-secondary);
}

.post-caption-textarea {
  width: 100%;
  min-height: 104px;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  font-family: inherit;
  font-size: 15px;
  color: var(--text-primary);
  background: var(--input-bg);
  resize: vertical;
  outline: none;
  box-sizing: border-box;
}

.post-caption-textarea::placeholder {
  color: var(--text-secondary);
}

.post-caption-textarea:focus {
  border-color: var(--accent-color);
  background: var(--bg-elevated);
}

.post-crop-wrap {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.crop-viewport {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  background: var(--crop-bg);
  border-radius: 14px;
  overflow: hidden;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  cursor: grab;
}

.crop-viewport:active {
  cursor: grabbing;
}

.crop-viewport img {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
  display: block;
  max-width: none;
  max-height: none;
  will-change: transform;
}

.crop-grid {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 5;
  transition: opacity 0.2s ease;
  opacity: 0.45;
}

.crop-grid line {
  stroke: rgba(33, 150, 243, 0.45);
  stroke-width: 1px;
  vector-effect: non-scaling-stroke;
}

.crop-grid rect {
  fill: none;
  stroke: rgba(33, 150, 243, 0.65);
  stroke-width: 1.5px;
  vector-effect: non-scaling-stroke;
}

.crop-grid.active {
  opacity: 1;
}

.crop-grid.active line {
  stroke: rgba(33, 150, 243, 0.95);
  stroke-width: 1.5px;
}

.crop-grid.active rect {
  stroke: var(--accent-color);
  stroke-width: 2px;
}

.crop-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 0 4px;
}

.crop-zoom-icon {
  display: flex;
  align-items: center;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.crop-zoom-slider {
  -webkit-appearance: none;
  appearance: none;
  flex: 1;
  min-width: 80px;
  height: 36px;
  background: transparent;
  border: none;
  outline: none;
  cursor: pointer;
  touch-action: none;
  --zoom-progress: 0%;
}

.crop-zoom-slider:focus,
.crop-zoom-slider:focus-visible {
  outline: none;
  box-shadow: none;
}

.crop-zoom-slider::-webkit-slider-runnable-track {
  width: 100%;
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(
    to right,
    var(--accent-color) 0%,
    var(--accent-color) var(--zoom-progress),
    var(--border-color) var(--zoom-progress),
    var(--border-color) 100%
  );
}

.crop-zoom-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  margin-top: -7px;
  border-radius: 50%;
  background: var(--accent-color);
  border: 2px solid var(--bg-primary);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
  cursor: pointer;
}

.crop-zoom-slider::-moz-range-track {
  width: 100%;
  height: 4px;
  border-radius: 999px;
  background: var(--border-color);
  border: none;
}

.crop-zoom-slider::-moz-range-progress {
  height: 4px;
  border-radius: 999px;
  background: var(--accent-color);
}

.crop-zoom-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent-color);
  border: 2px solid var(--bg-primary);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
  cursor: pointer;
  box-sizing: border-box;
}

.post-view-modal-content {
  width: 100%;
  max-width: 560px;
  background: var(--bg-elevated);
  border-radius: 20px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: min(90dvh, 760px);
  overflow: hidden;
}

.post-view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
}

.post-view-back-btn {
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  cursor: pointer;
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--text-primary);
  padding: 0;
  flex-shrink: 0;
  transition: opacity 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.post-view-back-btn:active {
  opacity: 0.7;
}

.post-view-author-link {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  flex: 1;
  min-width: 0;
  color: var(--text-primary);
}

.post-view-header-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--input-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
  color: var(--text-primary);
  flex-shrink: 0;
}

.post-view-header-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.post-view-header-author {
  font-weight: 700;
  font-size: 15px;
  color: var(--text-primary);
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.post-view-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.post-view-scroll-body {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 2px;
}


@keyframes modalFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@view-transition {
  navigation: auto;
}

::view-transition-old(root) {
  animation: 0.2s ease forwards pageFadeOut;
}

::view-transition-new(root) {
  animation: 0.2s ease forwards pageFadeIn;
}

@keyframes pageFadeOut {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

@keyframes pageFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: var(--modal-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  padding-top: max(16px, env(safe-area-inset-top));
  padding-bottom: max(16px, env(safe-area-inset-bottom));
  z-index: 10050;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.2s ease, visibility 0.2s ease;
}

.modal-backdrop.visible {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

.modal-content {
  width: 100%;
  max-width: 500px;
  background: var(--bg-elevated);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: min(90dvh, 760px);
  overflow-y: auto;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.modal-backdrop.visible .modal-content {
  opacity: 1;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.modal-close,
.modal-icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: var(--text-secondary);
  padding: 0;
}

.modal-close:hover,
.modal-icon-btn:hover {
  color: var(--text-primary);
}

.modal-close svg,
.modal-icon-btn svg {
  display: block;
  flex-shrink: 0;
}

.modal-close:active,
.modal-icon-btn:active {
  background: var(--input-bg);
}

.modal-icon-danger {
  color: #EF5350;
}


.post-view-image-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  flex-shrink: 0;
  background: #000000;
  border-radius: 12px;
  overflow: hidden;
  user-select: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.post-view-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.post-like-burst {
  position: absolute;
  transform: translate(-50%, -50%) scale(0);
  opacity: 0;
  pointer-events: none;
  transition: transform 0.28s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.22s ease;
  z-index: 10;
}

.post-like-burst.active {
  transform: translate(-50%, -50%) scale(1.15);
  opacity: 1;
}

.post-view-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 2px;
  flex-shrink: 0;
}

.post-like-btn {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
  border-radius: 50%;
  transition: transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.post-like-btn:hover {
  opacity: 0.85;
}

.post-like-btn.animating {
  transform: scale(1.25);
}

.post-like-btn svg {
  transition: fill 0.15s ease, stroke 0.15s ease;
}

.post-like-btn.liked svg {
  fill: #ED4956;
  stroke: #ED4956;
}

.post-likes-count {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  padding: 0 2px;
  margin-top: -6px;
  flex-shrink: 0;
}

.post-view-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 2px;
  flex-shrink: 0;
}

.post-view-caption {
  font-size: 14px;
  line-height: 1.45;
  color: var(--text-primary);
  word-break: break-word;
}

.post-view-date {
  font-size: 12px;
  color: var(--text-secondary);
}


.explore-search-wrap {
  position: sticky;
  top: 0;
  z-index: 50;
  background: var(--bg-primary);
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

.search-input-box {
  display: flex;
  align-items: center;
  background: var(--input-bg);
  border-radius: 10px;
  border: 1px solid var(--border-color);
  padding: 8px 12px;
  gap: 8px;
  max-width: 600px;
  margin: 0 auto;
  width: 100%;
}

.search-icon {
  display: flex;
  align-items: center;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.search-input {
  border: none;
  background: transparent;
  font-size: 14px;
  outline: none;
  flex: 1;
  color: var(--text-primary);
  font-family: inherit;
  padding: 0;
}

.search-input::placeholder {
  color: var(--text-secondary);
}

.pg-ce-input {
  display: block;
  min-width: 0;
  white-space: nowrap;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -webkit-user-select: text;
  user-select: text;
  cursor: text;
  touch-action: manipulation;
}

.pg-ce-input::-webkit-scrollbar {
  display: none;
}

.pg-ce-input:empty::before {
  content: attr(data-placeholder);
  color: var(--text-secondary);
  pointer-events: none;
}

.dm-input.pg-ce-input {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  overflow-x: hidden;
  overflow-y: auto;
  line-height: 20px;
}

.comment-input.pg-ce-input {
  min-height: 36px;
  line-height: 18px;
}

.search-input.pg-ce-input,
.dm-search-input.pg-ce-input {
  min-height: 20px;
  line-height: 20px;
}

.search-clear-btn {
  width: 20px;
  height: 20px;
  border: none;
  background: #C7C7C7;
  border-radius: 50%;
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
}

.search-clear-btn svg {
  width: 12px;
  height: 12px;
}

.search-results {
  display: flex;
  flex-direction: column;
  padding: 8px 16px;
  gap: 4px;
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  animation: pageFadeIn 0.2s ease forwards;
}

.search-user-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: 10px;
  text-decoration: none;
  outline: none;
  -webkit-tap-highlight-color: transparent;
}

.search-user-item:hover,
.search-user-item:active,
.search-user-item:focus-visible {
  background: var(--input-bg);
}

.search-user-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  overflow: hidden;
  background: #EEEEEE;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 16px;
  color: #2196F3;
  flex-shrink: 0;
}

.search-user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.search-user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}

.search-user-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-user-username {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-empty {
  padding: 32px 16px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 14px;
}

.explore-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 24px;
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  animation: pageFadeIn 0.2s ease forwards;
}

.explore-section {
  display: flex;
  flex-direction: column;
}

.explore-section-header {
  padding: 12px 16px 8px;
}

.explore-section-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.explore-users-list {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding: 4px 16px 12px;
  scrollbar-width: none;
}

.explore-users-list::-webkit-scrollbar {
  display: none;
}

.explore-user-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 12px 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  text-decoration: none;
  min-width: 110px;
  max-width: 130px;
  flex-shrink: 0;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.explore-user-card:active {
  transform: scale(0.98);
}

.explore-user-avatar {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  overflow: hidden;
  background: #E3F2FD;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
  font-size: 20px;
  font-weight: 700;
  color: #2196F3;
}

.explore-user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.explore-user-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.explore-user-username {
  font-size: 12px;
  color: var(--text-secondary);
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.post-view-author {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: inherit;
}

.post-view-author-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  overflow: hidden;
  background: #E3F2FD;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: #2196F3;
  flex-shrink: 0;
}

.post-view-author-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.post-view-author-meta {
  display: flex;
  flex-direction: column;
}


.pics-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  background: #000000;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.2s ease, visibility 0.2s ease;
}

.pics-modal.visible {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

.pics-top-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  padding-top: max(14px, env(safe-area-inset-top, 14px));
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.75) 0%, rgba(0, 0, 0, 0) 100%);
  z-index: 100;
  pointer-events: none;
}

.pics-title {
  color: #FFFFFF;
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.5px;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
  user-select: none;
}

.pics-close-btn {
  background: rgba(0, 0, 0, 0.45);
  border: none;
  color: #FFFFFF;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  pointer-events: auto;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: transform 0.15s ease, background 0.15s ease;
  padding: 0;
  flex-shrink: 0;
}

.pics-close-btn:active {
  transform: scale(0.92);
  background: rgba(255, 255, 255, 0.3);
}

.pics-feed {
  width: 100%;
  flex: 1;
  height: 100%;
  min-height: 0;
  overflow-y: scroll;
  scroll-snap-type: y mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
}

.pics-feed:active {
  cursor: grabbing;
}

.pics-feed::-webkit-scrollbar {
  display: none;
}

.pics-slide {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 100%;
  scroll-snap-align: start;
  scroll-snap-stop: always;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000000;
  overflow: hidden;
  box-sizing: border-box;
  pointer-events: auto;
  user-select: none;
  -webkit-user-select: none;
}

.pics-image-wrap {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: inherit;
  pointer-events: auto;
  touch-action: manipulation;
}

.pics-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
  -webkit-user-select: none;
}

.pics-gradient-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(0,0,0,0.35) 0%,
    transparent 18%,
    transparent 60%,
    rgba(0,0,0,0.85) 100%
  );
  pointer-events: none;
}

.pics-bottom-info {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 76px;
  padding: 16px;
  padding-bottom: calc(28px + env(safe-area-inset-bottom, 0px));
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: #FFFFFF;
  pointer-events: none;
  box-sizing: border-box;
}

.pics-author-row {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: #FFFFFF;
  width: fit-content;
  pointer-events: auto;
}

.pics-author-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  border: 1.5px solid #FFFFFF;
  background: #2196F3;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  color: #FFFFFF;
  flex-shrink: 0;
}

.pics-author-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pics-author-name {
  font-size: 15px;
  font-weight: 700;
  color: #FFFFFF;
  text-shadow: 0 1px 4px rgba(0,0,0,0.8);
}

.pics-caption {
  font-size: 14px;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 1px 3px rgba(0,0,0,0.8);
  word-break: break-word;
  max-height: 110px;
  overflow-y: auto;
  pointer-events: auto;
}

.pics-date {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  text-shadow: 0 1px 2px rgba(0,0,0,0.8);
}

.pics-side-bar {
  position: absolute;
  right: 12px;
  bottom: calc(28px + env(safe-area-inset-bottom, 0px));
  z-index: 25;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  pointer-events: auto;
}

.pics-action-btn {
  background: transparent;
  border: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  padding: 6px;
  min-width: 44px;
  min-height: 44px;
  color: #FFFFFF;
  transition: transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  pointer-events: auto;
  user-select: none;
  -webkit-user-select: none;
}

.pics-action-btn:active {
  transform: scale(0.85);
}

.pics-action-btn.animating {
  transform: scale(1.3);
}

.pics-action-btn svg {
  filter: drop-shadow(0 2px 6px rgba(0,0,0,0.6));
  transition: fill 0.15s ease, stroke 0.15s ease;
}

.pics-action-btn.liked svg {
  fill: #ED4956;
  stroke: #ED4956;
}

.pics-action-count {
  font-size: 12px;
  font-weight: 700;
  color: #FFFFFF;
  text-shadow: 0 1px 4px rgba(0,0,0,0.8);
}



.pics-action-label {
  font-size: 11px;
  font-weight: 600;
  color: #FFFFFF;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
}


.feed-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 470px;
  margin: 0 auto;
  width: 100%;
  padding: 12px 0 40px;
  animation: pageFadeIn 0.2s ease forwards;
}

.feed-card {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.feed-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
}

.feed-card-author {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: inherit;
}

.feed-card-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  overflow: hidden;
  background: #E3F2FD;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  color: #2196F3;
  flex-shrink: 0;
}

.feed-card-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.feed-card-author-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.feed-card-username {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  text-decoration: none;
}

.feed-card-username:hover {
  text-decoration: underline;
}

.feed-card-dot {
  font-size: 12px;
  color: var(--text-secondary);
}

.feed-card-time {
  font-size: 12px;
  color: var(--text-secondary);
}

.feed-card-image-wrap {
  width: 100%;
  position: relative;
  background: #000000;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  aspect-ratio: 1 / 1;
  max-height: 580px;
  overflow: hidden;
}

.feed-card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.feed-card-actions {
  display: flex;
  align-items: center;
  padding: 10px 14px 6px;
  gap: 12px;
}

.feed-like-btn {
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: var(--text-primary);
  transition: transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.feed-like-btn:active {
  transform: scale(0.85);
}

.feed-like-btn.animating {
  transform: scale(1.3);
}

.feed-like-btn svg {
  transition: fill 0.15s ease, stroke 0.15s ease;
}

.feed-like-btn.liked svg {
  fill: #ED4956;
  stroke: #ED4956;
}

.feed-card-likes-count {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  padding: 0 14px 6px;
}

.feed-card-caption {
  font-size: 14px;
  line-height: 1.45;
  color: var(--text-primary);
  padding: 0 14px 6px;
  word-break: break-word;
}

.feed-caption-user {
  font-weight: 700;
  color: var(--text-primary);
  text-decoration: none;
  margin-right: 4px;
}

.feed-caption-user:hover {
  text-decoration: underline;
}

.feed-card-date {
  font-size: 11px;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 0.2px;
  padding: 0 14px 12px;
}

.feed-empty-card {
  padding: 48px 24px;
  text-align: center;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  margin: 20px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.feed-empty-card h3 {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.feed-empty-card p {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
  max-width: 280px;
}

@media (max-width: 480px) {
  .feed-card {
    border-left: none;
    border-right: none;
    border-radius: 0;
  }
}



.profile-grid-item {
  position: relative;
}

.profile-grid-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.38);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  opacity: 0;
  transition: opacity 0.15s ease;
  color: #FFFFFF;
  font-size: 14px;
  font-weight: 700;
  pointer-events: none;
}

.profile-grid-item:hover .profile-grid-overlay {
  opacity: 1;
}

.profile-grid-stat {
  display: flex;
  align-items: center;
  gap: 5px;
}

.profile-grid-stat svg {
  width: 18px;
  height: 18px;
  fill: #FFFFFF;
  stroke: #FFFFFF;
}


.post-view-comments-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-top: 1px solid var(--border-color);
  padding-top: 12px;
  margin-top: 6px;
  flex-shrink: 0;
}

.post-comments-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
}

.post-comments-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 220px;
  overflow-y: auto;
  padding-right: 4px;
  overscroll-behavior: contain;
}

.comment-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 13px;
  line-height: 1.4;
  word-break: break-word;
}

.comment-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--pill-bg);
  color: var(--accent-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 12px;
  flex-shrink: 0;
  overflow: hidden;
  text-decoration: none;
}

.comment-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.comment-content-wrap {
  flex: 1;
  min-width: 0;
}

.comment-author-name {
  font-weight: 700;
  color: var(--text-primary);
  text-decoration: none;
  margin-right: 6px;
}

.comment-author-name:hover {
  text-decoration: underline;
}

.comment-text {
  color: var(--text-primary);
}

.mention-link,
.bio-mention {
  color: var(--accent-color);
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}

.mention-link:hover,
.mention-link:active,
.bio-mention:hover,
.bio-mention:active {
  text-decoration: underline;
}

.comment-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 3px;
  font-size: 11px;
  color: var(--text-secondary);
}

.comment-delete-btn {
  background: transparent;
  border: none;
  padding: 0;
  font-size: 11px;
  color: var(--like-color);
  cursor: pointer;
  opacity: 0.8;
}

.comment-delete-btn:hover {
  opacity: 1;
  text-decoration: underline;
}

.comment-like-cluster {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.comment-author-liked-badge {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  margin-right: 2px;
}

.comment-author-liked-avatar {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-size: 9px;
  font-weight: 700;
  border: 1px solid var(--border-color);
}

.comment-author-liked-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.comment-author-liked-heart {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--bg-primary);
  color: var(--like-color);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.comment-author-liked-heart svg {
  width: 8px;
  height: 8px;
  fill: var(--like-color);
  display: block;
}

.comment-pinned-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 2px;
}

.comment-pinned-badge svg {
  width: 11px;
  height: 11px;
  flex-shrink: 0;
  display: block;
}

.comment-item[data-can-pin="1"] {
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}

.comment-ctx-backdrop {
  position: fixed;
  inset: 0;
  z-index: 25000;
  background: transparent;
}

.comment-ctx-menu {
  position: fixed;
  z-index: 25001;
  min-width: 168px;
  max-width: 240px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 6px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
}

.comment-ctx-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
}

.comment-ctx-btn:active {
  background: var(--bg-tertiary);
}

.comment-ctx-btn svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.comment-like-btn {
  flex-shrink: 0;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 44px;
  min-height: 44px;
  margin: -6px -10px -6px 0;
  padding: 6px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.comment-like-btn svg {
  width: 15px;
  height: 15px;
  display: block;
}

.comment-like-btn.liked {
  color: var(--like-color);
}

.comment-like-btn.liked svg {
  fill: var(--like-color);
  stroke: var(--like-color);
}

.comment-like-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.comment-like-count {
  font-size: 11px;
  line-height: 1;
  font-weight: 500;
  color: var(--text-secondary);
  min-height: 11px;
}

.comment-like-count:empty {
  display: none;
}

.comment-thread {
  display: flex;
  flex-direction: column;
}

.comment-reply-btn {
  background: transparent;
  border: none;
  padding: 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
}

.comment-reply-btn:hover {
  color: var(--text-primary);
}

.comment-replies-block {
  position: relative;
  margin-left: 15px;
  padding-left: 25px;
  margin-top: 4px;
}

.comment-replies-block::before {
  content: '';
  position: absolute;
  left: 0;
  top: -12px;
  width: 18px;
  height: 29px;
  border-left: 1.5px solid var(--border-color);
  border-bottom: 1.5px solid var(--border-color);
  border-bottom-left-radius: 12px;
  pointer-events: none;
}

.comment-replies-toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 32px;
  padding: 4px 10px 4px 6px;
  margin-left: -4px;
  background: transparent;
  border: none;
  border-radius: 16px;
  color: var(--accent-color);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.comment-replies-toggle:hover {
  background: var(--pill-bg);
}

.comment-replies-chevron {
  flex-shrink: 0;
  display: block;
}

.comment-replies-block.is-expanded .comment-replies-chevron {
  transform: rotate(180deg);
}

.comment-replies-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 6px;
  position: relative;
}

.comment-item.is-reply {
  position: relative;
  padding-left: 0;
}

.comment-item.is-reply::before {
  content: '';
  position: absolute;
  left: -25px;
  top: -10px;
  bottom: -10px;
  width: 1.5px;
  background: var(--border-color);
  pointer-events: none;
}

.comment-item.is-reply:last-child::before {
  bottom: auto;
  height: 22px;
}

.comment-item.is-reply::after {
  content: '';
  position: absolute;
  left: -25px;
  top: 0;
  width: 19px;
  height: 13px;
  border-left: 1.5px solid var(--border-color);
  border-bottom: 1.5px solid var(--border-color);
  border-bottom-left-radius: 11px;
  pointer-events: none;
}

.comment-avatar.is-reply-avatar {
  width: 24px;
  height: 24px;
  font-size: 11px;
}

.comments-reply-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
  font-size: 12px;
  color: var(--text-secondary);
}

.comments-reply-bar-icon {
  display: inline-flex;
  color: var(--accent-color);
  flex-shrink: 0;
}

.comments-reply-bar-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
  color: var(--text-primary);
}

.comments-reply-bar-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 50%;
  color: var(--text-secondary);
  cursor: pointer;
}

.comments-reply-bar-close:hover {
  color: var(--text-primary);
  background: var(--pill-bg);
}

.comment-empty-text {
  font-size: 13px;
  color: var(--text-secondary);
  text-align: center;
  padding: 16px 0;
}

.comment-loading {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 16px 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.comment-input-form {
  display: flex;
  align-items: center;
  gap: 8px;
  border-top: 1px solid var(--border-color);
  padding-top: 10px;
  margin-top: 4px;
}

.comment-input {
  flex: 1;
  border: 1px solid var(--border-color);
  border-radius: 20px;
  padding: 8px 14px;
  font-size: 13px;
  outline: none;
  background: var(--input-bg);
  color: var(--text-primary);
  transition: border-color 0.15s ease, background 0.15s ease;
}

.comment-input:focus {
  border-color: var(--text-secondary);
  background: var(--bg-elevated);
}

.comment-submit-btn {
  background: transparent;
  border: none;
  color: var(--accent-color);
  cursor: pointer;
  width: 44px;
  height: 44px;
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  opacity: 0.4;
  pointer-events: none;
  transition: opacity 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.comment-submit-btn svg {
  display: block;
}

.comment-submit-btn.active {
  opacity: 1;
  pointer-events: auto;
}

.comment-submit-btn.sending {
  opacity: 0.45;
  pointer-events: none;
}

.post-comments-count-btn {
  background: transparent;
  border: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  padding: 0;
  cursor: pointer;
}

.app-alert-backdrop {
  z-index: 20000;
  background: var(--modal-overlay);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.app-alert-content {
  max-width: 360px;
  text-align: center;
  align-items: center;
  gap: 16px;
  padding: 24px;
  border-radius: 20px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.app-alert-icon-box {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.app-alert-icon-box.auth {
  background: rgba(33, 150, 243, 0.15);
  color: var(--accent-color);
}

.app-alert-icon-box.error,
.app-alert-icon-box.unfollow {
  background: rgba(239, 68, 68, 0.15);
  color: #EF4444;
}

.app-alert-icon-box.info {
  background: var(--input-bg);
  color: var(--text-primary);
}

.app-alert-text {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.app-alert-text h3 {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.app-alert-text p {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.45;
  word-break: break-word;
}

.app-alert-actions {
  display: flex;
  gap: 10px;
  width: 100%;
  margin-top: 4px;
}

.app-alert-actions button {
  flex: 1;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.comments-sheet-backdrop {
  position: fixed;
  inset: 0;
  background: var(--modal-overlay);
  z-index: 15000;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.28s cubic-bezier(0.32, 0.72, 0, 1);
}

.comments-sheet-backdrop.visible {
  opacity: 1;
  pointer-events: auto;
}

.comments-sheet-panel {
  width: 100%;
  max-width: 500px;
  height: 70dvh;
  max-height: 75dvh;
  background: var(--bg-elevated);
  border-radius: 20px 20px 0 0;
  display: flex;
  flex-direction: column;
  box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  transform: translate3d(0, 100%, 0);
  opacity: 0.96;
  transition: transform 0.32s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.24s ease;
  will-change: transform, opacity;
}

.comments-sheet-backdrop.visible .comments-sheet-panel {
  transform: translate3d(0, 0, 0);
  opacity: 1;
}

.comments-sheet-header {
  position: relative;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  cursor: grab;
}

.comments-sheet-header:active {
  cursor: grabbing;
}

.comments-sheet-grabber {
  width: 36px;
  height: 4px;
  background: var(--border-color);
  border-radius: 2px;
  position: absolute;
  top: 6px;
  pointer-events: none;
}

.comments-sheet-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.comments-sheet-close-btn {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  border-radius: 50%;
  padding: 0;
}

.comments-sheet-close-btn:hover {
  background: var(--input-bg);
  color: var(--text-primary);
}

.comments-sheet-body {
  flex: 1;
  overflow-y: auto;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  -webkit-overflow-scrolling: touch;
}

.comments-sheet-form {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-elevated);
  flex-shrink: 0;
  min-height: 56px;
}

@media (min-width: 601px) {
  .comments-sheet-backdrop {
    align-items: center;
  }

  .comments-sheet-panel {
    border-radius: 20px;
    height: 560px;
    max-height: 85dvh;
    transform: scale(0.95) translate3d(0, 14px, 0);
    opacity: 0;
    transition: transform 0.26s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.22s ease;
  }

  .comments-sheet-backdrop.visible .comments-sheet-panel {
    transform: scale(1) translate3d(0, 0, 0);
    opacity: 1;
  }
}

.feed-comment-btn {
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: var(--text-primary);
  transition: transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.feed-comment-btn:active {
  transform: scale(0.85);
}

.feed-card-comments-link {
  font-size: 14px;
  color: var(--text-secondary);
  padding: 0 14px 6px;
  cursor: pointer;
  user-select: none;
}

.feed-card-comments-link:hover {
  color: var(--text-primary);
}

@media (max-width: 640px) {
  input,
  textarea,
  select,
  .input-field input,
  .comment-input,
  .search-input,
  .post-caption-textarea,
  #postCaptionInput,
  #viewPostCommentInput,
  #searchInput {
    font-size: 16px !important;
  }

  #viewPostModal {
    padding: 0 !important;
    background: var(--crop-bg);
  }

  #viewPostModal .post-view-modal-content {
    width: 100% !important;
    max-width: 100% !important;
    height: 100dvh !important;
    max-height: 100dvh !important;
    border-radius: 0 !important;
    padding: 0 !important;
    gap: 0 !important;
    background: var(--bg-elevated);
  }

  #viewPostModal .post-view-header {
    height: 52px;
    padding: env(safe-area-inset-top, 0) 12px 0 12px;
    background: var(--bg-elevated);
    border-bottom: 1px solid var(--border-color);
    box-sizing: content-box;
    z-index: 30;
  }

  #viewPostModal .post-view-scroll-body {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    gap: 0;
    padding-right: 0;
  }

  #viewPostModal .post-view-image-wrap {
    border-radius: 0 !important;
    width: 100% !important;
    aspect-ratio: 1 / 1 !important;
    max-height: none !important;
    flex-shrink: 0 !important;
    background: var(--crop-bg);
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }

  #viewPostModal .post-view-image {
    width: 100% !important;
    height: 100% !important;
    max-width: 100% !important;
    max-height: none !important;
    object-fit: cover !important;
    display: block !important;
  }

  #viewPostModal .post-view-actions {
    padding: 10px 14px 4px 14px;
    flex-shrink: 0;
  }

  #viewPostModal .post-view-meta {
    padding: 0 14px 10px 14px;
    flex-shrink: 0;
  }

  #viewPostModal .post-view-comments-section {
    padding: 12px 14px 0 14px;
    margin-top: 0;
    border-top: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  #viewPostModal .post-comments-list {
    max-height: none;
    overflow: visible;
  }

  #viewPostModal .comment-input-form {
    position: sticky;
    bottom: 0;
    background: var(--bg-elevated);
    border-top: 1px solid var(--border-color);
    padding: 8px 12px calc(8px + env(safe-area-inset-bottom, 0px)) 12px;
    margin-top: 0;
    z-index: 30;
  }
}

.feed-caught-up-banner {
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 24px 16px;
  margin: 16px 0;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.feed-caught-up-icon {
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.feed-caught-up-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.feed-caught-up-sub {
  font-size: 13px;
  color: var(--text-secondary);
}

.feed-recommended-section {
  margin: 16px 0;
  padding: 12px 0;
  border-top: 1px solid var(--border-color);
  border-bottom: 1px solid var(--border-color);
}

.feed-section-header {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 12px;
  padding: 0 4px;
}

.feed-recommended-carousel, .profile-similar-carousel {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  padding: 4px 2px 10px 2px;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
}

.feed-recommended-carousel:active, .profile-similar-carousel:active {
  cursor: grabbing;
}

.feed-recommended-carousel::-webkit-scrollbar, .profile-similar-carousel::-webkit-scrollbar {
  display: none;
}

.feed-rec-user-card {
  flex: 0 0 140px;
  min-width: 140px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 14px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  scroll-snap-align: start;
}

.feed-rec-avatar-link {
  text-decoration: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.feed-rec-avatar {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--input-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 20px;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.feed-rec-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.feed-rec-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feed-rec-username {
  font-size: 12px;
  color: var(--text-secondary);
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 10px;
}

.feed-follow-btn {
  width: 100%;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 600;
  border-radius: 6px;
  border: none;
  background: var(--accent-color);
  color: #FFFFFF;
  cursor: pointer;
  transition: background 0.15s ease;
}

.feed-follow-btn:hover {
  background: var(--accent-hover);
}

.feed-follow-btn.following {
  background: var(--pill-bg);
  color: var(--text-primary);
}

.feed-card-follow-btn {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--accent-color);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 8px;
}

.feed-card-follow-btn.following {
  color: var(--text-secondary);
}

.caption-hashtag {
  color: var(--accent-color);
  font-weight: 500;
  text-decoration: none;
}

.caption-hashtag:hover {
  text-decoration: underline;
}

.explore-tags-wrap {
  width: 100%;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: center;
}

.explore-tags-bar {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 8px 16px;
  background: transparent;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  max-width: 600px;
  width: 100%;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
}

.explore-tags-bar:active {
  cursor: grabbing;
}

.explore-tags-bar::-webkit-scrollbar {
  display: none;
}

@media (min-width: 641px) {
  .explore-tags-bar {
    justify-content: safe center;
  }
}

.explore-tag-pill {
  flex: 0 0 auto;
  padding: 6px 14px;
  border-radius: 16px;
  border: 1px solid var(--border-color);
  background: var(--pill-bg);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.explore-tag-pill:hover {
  background: var(--border-color);
}

.explore-tag-pill.active {
  background: var(--text-primary);
  color: var(--bg-primary);
  border-color: var(--text-primary);
}

.post-view-related-section {
  padding: 12px 14px 20px 14px;
  border-top: 1px solid var(--border-color);
  margin-top: 4px;
  flex-shrink: 0;
}

.post-related-header {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.post-related-grid {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding-bottom: 4px;
}

.post-related-grid::-webkit-scrollbar {
  display: none;
}

.post-related-item {
  flex: 0 0 100px;
  width: 100px;
  height: 100px;
  aspect-ratio: 1 / 1;
  position: relative;
  border: none;
  padding: 0;
  margin: 0;
  overflow: hidden;
  background: var(--input-bg);
  cursor: pointer;
  border-radius: 8px;
  scroll-snap-align: start;
}

.post-related-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.profile-similar-section {
  margin: 12px 0 16px 0;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.profile-similar-header {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.verified-badge {
  margin-left: 2px;
  vertical-align: middle;
  flex-shrink: 0;
  display: inline-flex;
}

.not-found-page {
  min-height: 100dvh;
  min-height: 100vh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
  padding: 24px;
  box-sizing: border-box;
  animation: pageFadeIn 0.2s ease forwards;
}

.not-found-text {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-secondary);
  text-align: center;
  line-height: 1.5;
}

.settings-container {
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  flex: 1;
  padding-bottom: 24px;
  box-sizing: border-box;
  animation: pageFadeIn 0.2s ease forwards;
}

.settings-top-bar {
  position: sticky;
  top: 0;
  z-index: 100;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  padding: 0 16px;
  padding-top: env(safe-area-inset-top);
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
  box-sizing: border-box;
}

.settings-back-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  color: var(--text-primary);
  text-decoration: none;
  background: transparent;
  border: none;
  cursor: pointer;
  border-radius: 50%;
  transition: opacity 0.15s ease;
}

.settings-back-btn:active {
  opacity: 0.6;
}

.settings-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  text-align: center;
  flex: 1;
}

.settings-top-spacer {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
}

.settings-content {
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-account-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  text-decoration: none;
  color: inherit;
  transition: opacity 0.15s ease;
}

.settings-account-card:hover {
  opacity: 0.95;
}

.settings-account-avatar {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--input-bg);
  color: var(--accent-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
  flex-shrink: 0;
}

.settings-account-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.settings-account-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.settings-account-username {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.settings-account-display {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.settings-account-arrow {
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.settings-group {
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.settings-group-header {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
  padding: 14px 16px 8px;
}

.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid var(--border-color);
}

.settings-row:first-of-type {
  border-top: none;
}

.settings-row-interactive {
  background: transparent;
  border: none;
  border-top: 1px solid var(--border-color);
  width: 100%;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
  color: inherit;
  font: inherit;
  transition: opacity 0.15s ease;
  user-select: none;
}

.settings-row-interactive:hover {
  opacity: 0.85;
}

.settings-row-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.settings-row-icon {
  width: 20px;
  height: 20px;
  color: var(--text-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.settings-row-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.settings-row-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.settings-row-desc {
  font-size: 12px;
  color: var(--text-secondary);
}

.settings-row-danger .settings-row-title,
.settings-row-danger .settings-row-icon {
  color: var(--like-color);
}

body.is-mouse-dragging {
  cursor: grabbing !important;
  user-select: none !important;
  -webkit-user-select: none !important;
}

body.is-mouse-dragging * {
  cursor: grabbing !important;
  user-select: none !important;
  -webkit-user-select: none !important;
}

.stat-item-link {
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: opacity 0.15s ease;
}

.stat-item-link:active {
  opacity: 0.7;
}

.sublist-container {
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  min-height: calc(100dvh - 56px - env(safe-area-inset-bottom));
  padding-bottom: 24px;
  box-sizing: border-box;
  animation: pageFadeIn 0.2s ease forwards;
}

.sublist-top-bar {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  padding: 0 16px;
  padding-top: env(safe-area-inset-top);
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
  box-sizing: border-box;
}

.sublist-back-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  color: var(--text-primary);
  text-decoration: none;
  background: transparent;
  border: none;
  cursor: pointer;
  border-radius: 50%;
  transition: opacity 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.sublist-back-btn:active {
  opacity: 0.6;
}

.sublist-title-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-width: 0;
}

.sublist-username {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  display: inline-flex;
  align-items: center;
  gap: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
}

.sublist-subtitle {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 400;
}

.sublist-top-spacer {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
}

.sublist-search-wrap {
  padding: 12px 16px 8px 16px;
  background: var(--bg-primary);
}

.sublist-top-bar.follow-top-bar {
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  border-bottom: none;
}

@media (min-width: 602px) {
  .sublist-top-bar.follow-top-bar,
  .follow-tabs,
  .sublist-container {
    border-left: 1px solid var(--border-color);
    border-right: 1px solid var(--border-color);
  }
}

.follow-tabs {
  position: sticky;
  top: 52px;
  z-index: 99;
  display: flex;
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
  box-sizing: border-box;
}

.follow-tab {
  flex: 1 1 0;
  min-width: 0;
  min-height: 46px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 10px 8px;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  -webkit-tap-highlight-color: transparent;
  transition: color 0.2s ease, border-color 0.2s ease;
}

.follow-tab.is-active {
  color: var(--text-primary);
  border-bottom-color: var(--text-primary);
}

.follow-tab-count {
  font-variant-numeric: tabular-nums;
}

.follow-tab-label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.follow-container {
  display: flex;
  flex-direction: column;
}

.follow-pager {
  flex: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
  overflow: hidden;
  touch-action: pan-y;
}

.follow-track {
  flex: 1;
  display: flex;
  align-items: stretch;
  width: 200%;
  transform: translate3d(0, 0, 0);
  will-change: transform;
}

.follow-track.is-second {
  transform: translate3d(-50%, 0, 0);
}

.follow-track.is-animating {
  transition: transform 0.25s ease;
}

.follow-panel {
  flex: 0 0 50%;
  width: 50%;
  min-width: 0;
  min-height: 100%;
}

.follow-panel.is-collapsed {
  height: 0;
  overflow: hidden;
  visibility: hidden;
}

.sublist-search-box {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  height: 40px;
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  box-sizing: border-box;
  padding: 0 12px;
  transition: border-color 0.2s, background-color 0.2s;
}

.sublist-search-box:focus-within {
  border-color: var(--accent-color);
  background: var(--bg-elevated);
}

.sublist-search-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  flex-shrink: 0;
  margin-right: 8px;
}

.sublist-search-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: none;
  background: transparent;
  outline: none;
  color: var(--text-primary);
  font-size: 14px;
  font-family: inherit;
}

.sublist-search-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0;
  border-radius: 50%;
  flex-shrink: 0;
}

.sublist-items {
  display: flex;
  flex-direction: column;
  padding: 4px 0;
}

.sublist-user-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  transition: background-color 0.15s ease;
}

.sublist-user-row:active {
  background: var(--input-bg);
}

.sublist-user-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--input-bg);
  color: var(--accent-color);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  font-weight: 700;
  flex-shrink: 0;
  text-decoration: none;
}

.sublist-user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.sublist-user-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
  text-decoration: none;
  color: inherit;
}

.sublist-user-username {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  display: inline-flex;
  align-items: center;
  gap: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sublist-user-display {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sublist-user-action {
  flex-shrink: 0;
}

.sublist-follow-btn {
  min-width: 96px;
  height: 32px;
  padding: 0 14px;
  font-size: 13px;
  font-weight: 600;
  border-radius: 8px;
}

.sublist-empty {
  padding: 48px 16px;
  text-align: center;
  font-size: 14px;
  color: var(--text-secondary);
}

img, a {
  -webkit-user-drag: none;
}
.editprofile-container {
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  min-height: 100dvh;
  padding: 16px;
  padding-bottom: calc(74px + env(safe-area-inset-bottom));
  box-sizing: border-box;
  animation: pageFadeIn 0.2s ease forwards;
}

.editprofile-top-bar {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  padding: 0 16px;
  padding-top: env(safe-area-inset-top);
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
  box-sizing: border-box;
}

.editprofile-back-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  color: var(--text-primary);
  text-decoration: none;
  background: none;
  border: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.editprofile-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  text-align: center;
  flex: 1;
}

.editprofile-save-link {
  background: none;
  border: none;
  color: var(--accent-color);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  padding: 8px 12px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  -webkit-tap-highlight-color: transparent;
}

.editprofile-save-link:disabled {
  opacity: 0.4;
  cursor: default;
}

.editprofile-avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 24px 0 16px;
}

.editprofile-avatar-wrap {
  width: 86px;
  height: 86px;
  position: relative;
}

.editprofile-avatar-wrap .profile-avatar {
  width: 86px;
  height: 86px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--input-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: 700;
  color: var(--text-secondary);
}

.editprofile-avatar-wrap .profile-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.editprofile-change-photo-btn {
  background: none;
  border: none;
  color: var(--accent-color);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  padding: 8px 12px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  -webkit-tap-highlight-color: transparent;
}

.editprofile-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  margin-top: 8px;
}

.editprofile-form .input-field textarea {
  width: 100%;
  min-height: 90px;
  padding: 24px 16px 8px;
  border: 1.5px solid var(--border-color);
  border-radius: 12px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 15px;
  outline: none;
  resize: vertical;
  transition: border-color 0.2s, background-color 0.2s;
  box-sizing: border-box;
}

.editprofile-form .input-field textarea:focus {
  border-color: var(--accent-color);
  background: var(--bg-elevated);
}

.editprofile-form .input-field textarea:focus + label,
.editprofile-form .input-field textarea:not(:placeholder-shown) + label {
  top: 8px;
  transform: translateY(0);
  font-size: 12px;
  color: var(--text-secondary);
}

.editprofile-form .input-field textarea:focus + label {
  color: var(--accent-color);
}

.editprofile-bio-hint {
  display: flex;
  justify-content: flex-end;
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: -8px;
}

.editprofile-submit-btn {
  width: 100%;
  margin-top: 8px;
  height: 46px;
  font-size: 15px;
  font-weight: 600;
}

.app-layout.publishpost-layout {
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--bg-primary);
}

.publishpost-top-bar {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: 52px;
  padding: 0 12px;
  padding-top: env(safe-area-inset-top);
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
  box-sizing: border-box;
}

.publishpost-back-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  color: var(--text-primary);
  text-decoration: none;
  background: none;
  border: none;
  cursor: pointer;
  transition: opacity 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.publishpost-back-btn:active {
  opacity: 0.6;
}

.publishpost-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  text-align: center;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.publishpost-submit-btn {
  background: none;
  border: none;
  color: var(--accent-color);
  cursor: pointer;
  width: 44px;
  height: 44px;
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  border-radius: 50%;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.publishpost-submit-btn svg {
  display: block;
}

.publishpost-submit-btn:disabled,
.publishpost-submit-btn.sending {
  opacity: 0.4;
  cursor: default;
}

.publishpost-container {
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  padding: 16px 16px 32px;
  flex: 1;
  box-sizing: border-box;
  animation: pageFadeIn 0.2s ease forwards;
}

.publishpost-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

.publishpost-media-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.publishpost-dropzone {
  width: 100%;
  aspect-ratio: 1 / 1;
  border: 1.5px dashed var(--border-color);
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  background: var(--bg-secondary);
  cursor: pointer;
  color: var(--text-secondary);
  padding: 24px;
  text-align: center;
  box-sizing: border-box;
  transition: opacity 0.2s ease;
}

.publishpost-dropzone.dragover {
  border-color: var(--accent-color);
  background: var(--input-bg);
}

.publishpost-dropzone:active {
  opacity: 0.85;
}

.publishpost-dropzone-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}

.publishpost-dropzone-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  max-width: 260px;
}

.publishpost-select-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 20px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: var(--bg-elevated);
  color: var(--accent-color);
  font-size: 14px;
  font-weight: 600;
}

.publishpost-replace-btn {
  margin-left: auto;
  min-height: 44px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  white-space: nowrap;
  transition: opacity 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.publishpost-replace-btn:active {
  opacity: 0.7;
}

.publishpost-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  box-sizing: border-box;
}

.publishpost-error {
  width: 100%;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--like-color);
  color: var(--like-color);
  font-size: 14px;
  text-align: center;
  display: none;
  box-sizing: border-box;
  animation: pageFadeIn 0.2s ease forwards;
}

.publishpost-error.visible {
  display: block;
}

@media (max-width: 640px) {
  .publishpost-container {
    padding: 0 0 24px;
  }

  .publishpost-dropzone,
  .publishpost-crop-viewport {
    border-radius: 0;
  }

  .publishpost-dropzone {
    border-left: none;
    border-right: none;
    border-top: none;
  }

  .publishpost-crop-wrap .crop-controls {
    padding: 0 16px;
  }

  .publishpost-body {
    padding: 0 16px;
  }
}

.feed-card-header-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.post-more-btn {
  background: transparent;
  border: none;
  color: var(--text-primary);
  width: 44px;
  height: 44px;
  min-width: 44px;
  min-height: 44px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: opacity 0.2s ease, background 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.post-more-btn:active {
  opacity: 0.65;
  background: var(--input-bg);
}

.pics-top-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: auto;
}

.pics-more-btn {
  margin-left: auto;
  background: rgba(0, 0, 0, 0.45);
  border: none;
  color: #FFFFFF;
  width: 44px;
  height: 44px;
  min-width: 44px;
  min-height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  pointer-events: auto;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: opacity 0.2s ease, background 0.2s ease;
  padding: 0;
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
}

.pics-top-actions .pics-more-btn {
  margin-left: 0;
}

.pics-delete-btn {
  color: #EF5350;
}

.pics-more-btn:active {
  opacity: 0.75;
  background: rgba(255, 255, 255, 0.25);
}

.post-menu-backdrop {
  z-index: 22000;
}

.post-menu-content {
  max-width: 320px;
  gap: 10px;
}

.app-bottom-toast {
  position: fixed;
  left: 50%;
  bottom: calc(74px + env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%);
  z-index: 22000;
  max-width: calc(100vw - 32px);
  padding: 11px 18px;
  border-radius: 12px;
  background: #262626;
  color: #FFFFFF;
  border: 1px solid rgba(255, 255, 255, 0.12);
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  line-height: 1.3;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.28);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.2s ease, visibility 0.2s ease;
}

.app-bottom-toast.visible {
  opacity: 1;
  visibility: visible;
}

@media (min-width: 769px) {
  .app-bottom-toast {
    bottom: 28px;
  }
}

.pw-masked {
  -webkit-text-security: disc;
}

.pw-masked.pw-revealed {
  -webkit-text-security: none;
}

input[type="search"]::-webkit-search-decoration,
input[type="search"]::-webkit-search-cancel-button,
input[type="search"]::-webkit-search-results-button,
input[type="search"]::-webkit-search-results-decoration {
  -webkit-appearance: none;
  display: none;
}

.accountlist-rows {
  display: flex;
  flex-direction: column;
}

.accountlist-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px 6px 6px;
  border-bottom: 1px solid var(--border-color);
  transition: background 0.2s ease, opacity 0.2s ease;
}

.accountlist-item:last-child {
  border-bottom: none;
}

.accountlist-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  background: transparent;
  border: none;
  border-radius: 10px;
  color: inherit;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.2s ease, opacity 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.accountlist-main.is-active {
  cursor: default;
}

button.accountlist-main:hover {
  background: var(--input-bg);
}

button.accountlist-main:active,
.accountlist-main.is-switching {
  opacity: 0.65;
}

.accountlist-active-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(0, 149, 246, 0.14);
  color: var(--accent-color);
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
  white-space: nowrap;
}

.accountlist-remove-btn {
  width: 40px;
  height: 40px;
  min-width: 40px;
  min-height: 40px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: color 0.2s ease, background 0.2s ease, opacity 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.accountlist-remove-btn:hover {
  color: var(--like-color);
  background: var(--input-bg);
}

.accountlist-remove-btn:active {
  opacity: 0.65;
}

.accountlist-add-btn {
  width: 100%;
  min-height: 52px;
  padding: 12px 16px;
  border-radius: 14px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  color: var(--accent-color);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 15px;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  box-sizing: border-box;
  transition: opacity 0.2s ease, background 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.accountlist-add-btn:hover {
  background: var(--input-bg);
}

.accountlist-add-btn:active {
  opacity: 0.75;
}

.accountlist-add-btn.is-disabled {
  color: var(--text-secondary);
  cursor: not-allowed;
  opacity: 0.75;
}

.accountlist-add-btn.is-disabled:hover {
  background: var(--bg-elevated);
}

.accountlist-add-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(0, 149, 246, 0.14);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.accountlist-add-btn.is-disabled .accountlist-add-icon {
  background: var(--input-bg);
}

.auth-back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 10px;
  align-self: flex-start;
  transition: color 0.2s ease, opacity 0.2s ease;
}

.auth-back-link:hover {
  color: var(--text-primary);
}

.bottom-nav-item {
  position: relative;
}

.nav-unread-badge {
  position: absolute;
  top: 4px;
  right: calc(50% - 20px);
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--like-color);
  color: #FFFFFF;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border: 1.5px solid var(--bg-primary);
  pointer-events: none;
}

.profile-actions {
  display: flex;
  gap: 8px;
}

.profile-actions > * {
  flex: 1;
}

.profile-message-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
}

html.dm-lock-scroll,
body.dm-lock-scroll {
  overflow: hidden !important;
  height: 100% !important;
  max-height: 100% !important;
  overscroll-behavior: none !important;
}

.app-layout.dm-page-layout {
  height: 100dvh;
  min-height: 100dvh;
  max-height: 100dvh;
  padding-bottom: 0;
  overflow: hidden;
  overscroll-behavior: none;
}

.dm-shell {
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  display: flex;
  height: calc(100dvh - 54px - env(safe-area-inset-bottom, 0px));
  background: var(--bg-primary);
  border-left: 1px solid var(--border-color);
  border-right: 1px solid var(--border-color);
  box-sizing: border-box;
  overflow: hidden;
  overscroll-behavior: none;
  animation: pageFadeIn 0.2s ease forwards;
}

.dm-sidebar {
  width: 340px;
  min-width: 280px;
  max-width: 360px;
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  height: 100%;
  flex-shrink: 0;
}

.dm-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  padding-top: max(14px, env(safe-area-inset-top, 14px));
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.dm-sidebar-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 3px;
}

.dm-sidebar-sub {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.dm-search-wrap {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.dm-search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  height: 38px;
  border-radius: 10px;
  background: var(--input-bg);
  border: 1px solid var(--border-color);
}

.dm-search-icon {
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.dm-search-input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 14px;
  font-family: inherit;
}

.dm-search-input::placeholder {
  color: var(--text-secondary);
}

.dm-search-clear {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 4px;
}

.dm-search-results,
.dm-conv-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  display: flex;
  flex-direction: column;
  -webkit-overflow-scrolling: touch;
}

.dm-conv-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  text-decoration: none;
  color: inherit;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
  transition: background 0.2s ease, opacity 0.2s ease;
}

.dm-conv-item:hover,
.dm-conv-item.active,
.dm-conv-item.is-ctx-open {
  background: var(--input-bg);
}

.dm-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--input-bg);
  color: var(--accent-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  flex-shrink: 0;
}

.dm-avatar-sm {
  width: 36px;
  height: 36px;
  font-size: 15px;
}

.dm-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.dm-conv-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.dm-conv-top,
.dm-conv-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.dm-conv-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dm-conv-item.unread .dm-conv-name,
.dm-conv-item.unread .dm-conv-preview {
  font-weight: 700;
  color: var(--text-primary);
}

.dm-conv-time {
  font-size: 12px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.dm-conv-preview {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.dm-conv-unread {
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--accent-color);
  color: #FFFFFF;
  font-size: 11px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.dm-thread {
  flex: 1;
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
}

.dm-thread-active-wrap {
  flex: 1;
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.dm-thread-empty,
.dm-empty-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 32px 24px;
  gap: 10px;
}

.dm-empty-icon {
  width: 74px;
  height: 74px;
  border-radius: 50%;
  border: 2px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.dm-empty-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
}

.dm-empty-desc {
  font-size: 14px;
  color: var(--text-secondary);
  max-width: 280px;
  line-height: 1.4;
}

.dm-thread-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  padding-top: max(10px, env(safe-area-inset-top, 10px));
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-primary);
  flex-shrink: 0;
}

.dm-back-btn {
  display: none;
  width: 40px;
  height: 40px;
  min-width: 40px;
  min-height: 40px;
  border-radius: 50%;
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
  text-decoration: none;
  flex-shrink: 0;
}

.dm-thread-partner {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: inherit;
  min-width: 0;
  flex: 1;
}

.dm-thread-partner-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.dm-thread-username {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dm-thread-display {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dm-thread-display.is-typing {
  color: var(--accent, #29B6F6);
  font-weight: 500;
}

.dm-messages-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  padding: 14px 14px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  -webkit-overflow-scrolling: touch;
}

.dm-load-older-btn {
  align-self: center;
  padding: 7px 14px;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  margin-bottom: 8px;
  transition: opacity 0.2s ease;
}

.dm-messages-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dm-no-msgs {
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
  padding: 24px 12px;
}

.dm-msg-row {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  max-width: 100%;
  touch-action: manipulation;
}

.dm-msg-row.mine {
  justify-content: flex-end;
}

.dm-msg-row.theirs {
  justify-content: flex-start;
}

.dm-msg-stack {
  max-width: min(76%, 460px);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
}

.dm-msg-row.mine .dm-msg-stack {
  align-items: flex-end;
}

.dm-msg-bubble {
  max-width: 100%;
  padding: 9px 13px 6px;
  border-radius: 18px;
  background: var(--input-bg);
  color: var(--text-primary);
  word-wrap: break-word;
  overflow-wrap: anywhere;
  display: flex;
  flex-direction: column;
  gap: 4px;
  -webkit-touch-callout: none;
}

@media (pointer: coarse) {
  .dm-msg-bubble {
    -webkit-user-select: none;
    user-select: none;
  }
}

.dm-msg-reactions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.dm-msg-reactions:empty {
  display: none;
}

.dm-reaction-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 26px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, opacity 0.2s ease;
}

.dm-reaction-pill.mine {
  border-color: var(--accent-color);
  background: rgba(0, 149, 246, 0.16);
}

.dm-reaction-emoji {
  font-size: 14px;
  line-height: 1;
}

.dm-reaction-count {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-secondary);
}

.dm-reaction-pill.mine .dm-reaction-count {
  color: var(--accent-color);
}

.dm-reaction-picker {
  position: fixed;
  top: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  max-width: calc(100vw - 20px);
  z-index: 1200;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.2s ease, visibility 0.2s ease;
}

.dm-reaction-picker.visible {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

.dm-reaction-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 2px;
  max-width: 100%;
  padding: 4px 6px;
  border-radius: 999px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
}

.dm-msg-action-list {
  display: flex;
  flex-direction: column;
  min-width: 204px;
  max-width: 100%;
  padding: 4px;
  border-radius: 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
}

.dm-msg-action-btn {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  text-align: left;
  transition: background 0.2s ease, opacity 0.2s ease;
}

.dm-msg-action-btn:hover {
  background: var(--input-bg);
}

.dm-msg-action-danger {
  color: var(--like-color);
}

.dm-msg-edited {
  font-style: italic;
  opacity: 0.9;
}

.dm-edit-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  background: var(--bg-elevated);
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}

.dm-edit-bar-icon {
  color: var(--accent-color);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.dm-edit-replace-btn {
  width: 34px;
  height: 34px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: default;
}

.dm-edit-replace-btn:not(:disabled) {
  cursor: pointer;
  background: rgba(33, 150, 243, 0.14);
}

.dm-edit-replace-btn:not(:disabled):active {
  opacity: 0.75;
}

.dm-edit-bar-preview-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.dm-edit-bar-thumb {
  width: 24px;
  height: 24px;
  border-radius: 5px;
  object-fit: cover;
  flex-shrink: 0;
  cursor: pointer;
  border: 1px solid var(--border-color);
  background: var(--input-bg);
}

.dm-edit-bar-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dm-edit-bar-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--accent-color);
  line-height: 1.2;
}

.dm-edit-bar-preview {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dm-edit-bar-close {
  width: 36px;
  height: 36px;
  min-width: 36px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.2s ease, color 0.2s ease;
}

.dm-edit-bar-close:hover {
  background: var(--input-bg);
  color: var(--text-primary);
}

.dm-reaction-pick-btn {
  min-width: 40px;
  min-height: 44px;
  padding: 0 4px;
  border: none;
  border-radius: 999px;
  background: transparent;
  font-size: 21px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s ease, opacity 0.2s ease;
}

.dm-reaction-pick-btn:hover,
.dm-reaction-pick-btn.is-selected {
  background: var(--input-bg);
}

.dm-msg-row.mine .dm-msg-bubble {
  background: var(--accent-color);
  color: #FFFFFF;
  border-bottom-right-radius: 5px;
}

.dm-msg-row.theirs .dm-msg-bubble {
  border-bottom-left-radius: 5px;
}

.dm-msg-bubble.img-only {
  padding: 4px;
  background: transparent;
}

.dm-msg-text {
  font-size: 14px;
  line-height: 1.4;
  white-space: pre-wrap;
}

.dm-msg-img-btn {
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  display: block;
  border-radius: 14px;
  overflow: hidden;
}

.dm-msg-img {
  display: block;
  max-width: 240px;
  max-height: 280px;
  width: auto;
  height: auto;
  object-fit: cover;
  border-radius: 14px;
}

.dm-msg-time {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  align-self: flex-end;
  line-height: 1;
}

.dm-msg-clock {
  opacity: 0.76;
}

.dm-msg-status {
  display: inline-flex;
  align-items: center;
  line-height: 1;
  opacity: 0.78;
}

.dm-msg-status.is-read {
  opacity: 1;
}

.dm-check-svg {
  display: block;
  flex-shrink: 0;
}

.dm-conv-top-right {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.dm-conv-check {
  display: inline-flex;
  align-items: center;
  color: var(--text-secondary);
  opacity: 0.72;
}

.dm-conv-check.is-read {
  color: var(--accent, #0095f6);
  opacity: 1;
}

.dm-date-sep {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 10px 0 6px;
  pointer-events: none;
}

.dm-date-sep span {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 999px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
}

.dm-msg-bubble.img-only .dm-msg-time {
  color: var(--text-secondary);
  padding: 2px 4px 0;
}

.dm-msg-bubble.img-only .dm-msg-status.is-read {
  color: var(--accent, #0095f6);
}

.dm-seen-indicator {
  display: none;
}

.dm-attach-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-primary);
}

.dm-attach-preview img {
  width: 54px;
  height: 54px;
  object-fit: cover;
  border-radius: 10px;
  border: 1px solid var(--border-color);
}

.dm-attach-clear {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: var(--input-bg);
  color: var(--text-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.dm-composer {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 10px 12px calc(10px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--border-color);
  background: var(--bg-primary);
  flex-shrink: 0;
}

.dm-attach-btn {
  width: 40px;
  height: 40px;
  min-width: 40px;
  min-height: 40px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--text-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: opacity 0.2s ease, background 0.2s ease;
}

.dm-attach-btn:active {
  opacity: 0.65;
  background: var(--input-bg);
}

.dm-input {
  flex: 1;
  min-width: 0;
  height: auto;
  min-height: 42px;
  max-height: 128px;
  padding: 10px 14px;
  border-radius: 21px;
  border: 1px solid var(--border-color);
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 14px;
  line-height: 20px;
  font-family: inherit;
  outline: none;
}

.dm-input::placeholder {
  color: var(--text-secondary);
}

.dm-send-btn {
  width: 42px;
  height: 42px;
  min-width: 42px;
  min-height: 42px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--accent-color);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  opacity: 0.35;
  transition: opacity 0.2s ease;
}

.dm-send-btn.active {
  opacity: 1;
}

.dm-voice-btn {
  width: 42px;
  height: 42px;
  min-width: 42px;
  min-height: 42px;
  border-radius: 50%;
  border: none;
  background: var(--accent-color, #0095f6);
  color: #FFFFFF;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  transition: opacity 0.2s ease;
}

.dm-voice-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.dm-voice-btn.recording {
  background: var(--accent-color, #0095f6);
  box-shadow: 0 0 0 5px rgba(0, 149, 246, 0.24);
}

.dm-composer.is-voice-cancelling .dm-voice-btn.recording {
  background: var(--like-color, #ed4956);
  box-shadow: 0 0 0 5px rgba(237, 73, 86, 0.24);
}

.dm-voice-rec-bar {
  display: none;
  flex: 1;
  min-width: 0;
  height: 42px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--input-bg);
  align-items: center;
  gap: 10px;
  user-select: none;
  -webkit-user-select: none;
}

.dm-composer.is-recording .dm-attach-btn,
.dm-composer.is-recording .dm-input {
  display: none;
}

.dm-composer.is-recording .dm-voice-rec-bar {
  display: flex;
}

.dm-voice-cancel-btn {
  display: none;
  width: 30px;
  height: 30px;
  min-width: 30px;
  min-height: 30px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--like-color, #ed4956);
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  margin-left: -4px;
}

.dm-composer.is-voice-locked .dm-voice-cancel-btn {
  display: inline-flex;
}

.dm-composer.is-voice-locked .dm-voice-rec-hint {
  display: none;
}

.dm-composer.is-voice-locked .dm-voice-btn.recording {
  box-shadow: none;
}

.dm-voice-rec-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--like-color, #ed4956);
  flex-shrink: 0;
}

.dm-voice-rec-timer {
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
  min-width: 34px;
  flex-shrink: 0;
}

.dm-voice-live-bars {
  flex: 1;
  min-width: 0;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2px;
  overflow: hidden;
}

.dm-voice-live-bar {
  width: 2.5px;
  min-height: 4px;
  max-height: 24px;
  border-radius: 2px;
  background: var(--accent-color, #0095f6);
  flex-shrink: 0;
}

.dm-composer.is-voice-cancelling .dm-voice-live-bar {
  background: var(--like-color, #ed4956);
}

.dm-voice-rec-hint {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}

.dm-composer.is-voice-cancelling .dm-voice-rec-hint {
  color: var(--like-color, #ed4956);
  font-weight: 600;
}

.dm-msg-bubble.voice-bubble {
  min-width: 215px;
  max-width: min(300px, 78vw);
  padding: 9px 11px 6px;
}

.dm-voice-msg {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.dm-voice-play-btn {
  width: 36px;
  height: 36px;
  min-width: 36px;
  min-height: 36px;
  border-radius: 50%;
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  background: var(--accent-color, #0095f6);
  color: #FFFFFF;
}

.dm-msg-row.mine .dm-voice-play-btn {
  background: #FFFFFF;
  color: var(--accent-color, #0095f6);
}

.dm-voice-msg.is-loading .dm-voice-play-btn {
  opacity: 0.6;
}

.dm-voice-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dm-voice-wave {
  height: 26px;
  display: flex;
  align-items: center;
  gap: 2px;
  cursor: pointer;
  padding: 1px 0;
}

.dm-voice-bar {
  flex: 1 1 2.5px;
  min-width: 2px;
  max-width: 3px;
  min-height: 4px;
  max-height: 24px;
  border-radius: 2px;
  background: var(--accent-color, #0095f6);
  opacity: 0.35;
}

.dm-voice-bar.played {
  opacity: 1;
}

.dm-msg-row.mine .dm-voice-bar {
  background: #FFFFFF;
  opacity: 0.4;
}

.dm-msg-row.mine .dm-voice-bar.played {
  opacity: 1;
}

.dm-voice-meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.dm-voice-dur {
  font-size: 11px;
  line-height: 1;
  opacity: 0.82;
  font-variant-numeric: tabular-nums;
}

.dm-voice-unheard-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #FFFFFF;
  flex-shrink: 0;
  display: inline-block;
}

[data-theme="light"] .dm-msg-row.theirs .dm-voice-unheard-dot {
  background: var(--accent-color, #0095f6);
}

.dm-mention-link {
  color: var(--accent-color, #0095f6);
  text-decoration: underline;
  text-underline-offset: 2px;
  text-decoration-thickness: 1.4px;
  font-weight: 500;
  cursor: pointer;
}

.dm-msg-row.mine .dm-mention-link {
  color: #FFFFFF;
}

.dm-reply-quote {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 5px 8px;
  margin-bottom: 5px;
  border-radius: 8px;
  border-left: 2.5px solid var(--accent-color, #0095f6);
  background: rgba(128, 128, 128, 0.14);
  cursor: pointer;
  max-width: 100%;
  min-width: 0;
  text-align: left;
  border-top: none;
  border-right: none;
  border-bottom: none;
  color: inherit;
  font-family: inherit;
}

.dm-msg-row.mine .dm-reply-quote {
  border-left-color: #FFFFFF;
  background: rgba(255, 255, 255, 0.18);
}

.dm-reply-quote-author {
  font-size: 11px;
  font-weight: 600;
  line-height: 1.25;
  color: var(--accent-color, #0095f6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dm-msg-row.mine .dm-reply-quote-author {
  color: #FFFFFF;
}

.dm-reply-quote-text {
  font-size: 12px;
  line-height: 1.25;
  opacity: 0.85;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dm-msg-bubble.is-jump-highlight {
  outline: 2px solid var(--accent-color, #0095f6);
  outline-offset: 2px;
}

.dm-msg-row.mine .dm-msg-bubble.is-jump-highlight {
  outline-color: #FFFFFF;
}

.dm-msg-row {
  position: relative;
}

.dm-swipe-reply-hint {
  position: absolute;
  right: 8px;
  top: 50%;
  margin-top: -15px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  opacity: 0;
}

.dm-swipe-reply-hint.is-ready {
  background: var(--accent-color, #0095f6);
  border-color: var(--accent-color, #0095f6);
  color: #FFFFFF;
}

.dm-lightbox-backdrop {
  z-index: 21500;
}

#dmLightboxImg {
  -webkit-touch-callout: none;
  user-select: none;
  -webkit-user-select: none;
}

.dm-lightbox-inner {
  position: relative;
  max-width: 92vw;
  max-height: 90dvh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dm-lightbox-inner img {
  max-width: 92vw;
  max-height: 86dvh;
  border-radius: 12px;
  object-fit: contain;
}

.dm-lightbox-close {
  position: absolute;
  top: -14px;
  right: -14px;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.72);
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

@media (max-width: 768px) {
  .dm-shell {
    max-width: none;
    border: none;
    height: calc(100dvh - 54px - env(safe-area-inset-bottom, 0px));
  }

  .dm-sidebar {
    width: 100%;
    max-width: none;
    min-width: 0;
    border-right: none;
  }

  .dm-thread {
    display: none;
  }

  .dm-shell.has-active-chat {
    position: fixed;
    top: var(--dm-vp-top, 0px);
    left: 0;
    right: 0;
    width: 100%;
    height: var(--dm-vp-h, 100dvh);
    max-height: var(--dm-vp-h, 100dvh);
    z-index: 300;
  }

  .dm-shell.has-active-chat .dm-sidebar {
    display: none;
  }

  .dm-shell.has-active-chat .dm-thread {
    display: flex;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .dm-input,
  .dm-search-input {
    font-size: 16px;
  }

  .dm-back-btn {
    display: inline-flex;
  }

  .dm-mobile-in-chat .bottom-nav {
    display: none;
  }
}

.top-bar-notif-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  min-width: 40px;
  min-height: 40px;
  border-radius: 50%;
  color: var(--text-primary);
  text-decoration: none;
  transition: opacity 0.2s ease, background 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.top-bar-notif-btn:active {
  opacity: 0.65;
  background: var(--input-bg);
}

.top-notif-badge {
  position: absolute;
  top: 2px;
  right: 1px;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--like-color);
  color: #FFFFFF;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border: 1.5px solid var(--bg-primary);
  pointer-events: none;
}

.settings-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.settings-row-sub {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.settings-switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 28px;
  flex-shrink: 0;
  cursor: pointer;
}

.settings-switch input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.settings-switch-slider {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: var(--border-color);
  transition: background 0.2s ease;
}

.settings-switch-slider::before {
  content: '';
  position: absolute;
  width: 22px;
  height: 22px;
  left: 3px;
  top: 3px;
  border-radius: 50%;
  background: #FFFFFF;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  transition: transform 0.2s ease;
}

.settings-switch input:checked + .settings-switch-slider {
  background: var(--accent-color);
}

.settings-switch input:checked + .settings-switch-slider::before {
  transform: translateX(20px);
}

.notif-disabled-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 13px;
}

.notif-settings-link {
  color: var(--accent-color);
  font-weight: 700;
  text-decoration: none;
  flex-shrink: 0;
}

.notif-list {
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.notif-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-color);
  transition: background 0.2s ease;
}

.notif-row:last-child {
  border-bottom: none;
}

.notif-row.is-unread {
  background: rgba(0, 149, 246, 0.07);
}

.notif-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--input-bg);
  color: var(--accent-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 16px;
  text-decoration: none;
  flex-shrink: 0;
}

.notif-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.notif-text {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  line-height: 1.38;
  color: var(--text-primary);
  word-wrap: break-word;
}

.notif-username {
  font-weight: 700;
  color: var(--text-primary);
  text-decoration: none;
  margin-right: 4px;
}

.notif-action {
  color: var(--text-primary);
}

.notif-time {
  color: var(--text-secondary);
  font-size: 12px;
  margin-left: 6px;
  white-space: nowrap;
}

.notif-right {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.notif-thumb {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  overflow: hidden;
  display: block;
  border: 1px solid var(--border-color);
}

.notif-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.notif-follow-btn {
  padding: 6px 12px;
  font-size: 13px;
  white-space: nowrap;
}

.notif-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 44px 20px;
  gap: 10px;
}

.dm-e2ee-banner {
  display: none;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.4;
  flex-shrink: 0;
}

.dm-e2ee-banner.visible {
  display: flex;
}

.dm-e2ee-banner.is-warn {
  color: #F59E0B;
}

.dm-e2ee-banner-btn {
  flex-shrink: 0;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--accent-color);
  background: var(--accent-color);
  color: #FFFFFF;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.dm-e2ee-pill {
  align-self: center;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  margin-bottom: 6px;
  border-radius: 999px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
}

.dm-msg-decrypt-err {
  font-size: 12px;
  font-style: italic;
  opacity: 0.78;
}

.dm-ctx-menu {
  position: fixed;
  top: 0;
  left: 0;
  min-width: 192px;
  max-width: calc(100vw - 20px);
  padding: 6px;
  border-radius: 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  z-index: 1200;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.2s ease, visibility 0.2s ease;
}

.dm-ctx-menu.visible {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

.dm-ctx-item {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  text-align: left;
  transition: background 0.2s ease, opacity 0.2s ease;
}

.dm-ctx-item:hover {
  background: var(--input-bg);
}

.dm-ctx-danger {
  color: var(--like-color);
}

.dm-delete-modal-card {
  width: calc(100% - 32px);
  max-width: 340px;
  padding: 0;
  overflow: hidden;
}

.dm-delete-modal-body {
  padding: 20px 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dm-delete-modal-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
  text-align: left;
}

.dm-delete-modal-desc {
  margin: 0;
  font-size: 14px;
  line-height: 1.45;
  color: var(--text-secondary);
  text-align: left;
  word-break: break-word;
}

.dm-delete-check-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
  padding: 4px 0;
  cursor: pointer;
  -webkit-user-select: none;
  user-select: none;
}

.dm-delete-checkbox {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
  pointer-events: none;
}

.dm-delete-check-box {
  width: 20px;
  height: 20px;
  border-radius: 6px;
  border: 2px solid var(--text-secondary);
  background: transparent;
  flex-shrink: 0;
  position: relative;
  box-sizing: border-box;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.dm-delete-checkbox:checked + .dm-delete-check-box {
  background: var(--accent-color);
  border-color: var(--accent-color);
}

.dm-delete-checkbox:checked + .dm-delete-check-box::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 2px;
  width: 5px;
  height: 9px;
  border: solid #FFFFFF;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.dm-delete-checkbox:focus-visible + .dm-delete-check-box {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

.dm-delete-check-label {
  font-size: 14px;
  line-height: 1.35;
  color: var(--text-primary);
  word-break: break-word;
}

.dm-delete-modal-actions {
  display: flex;
  border-top: 1px solid var(--border-color);
}

.dm-delete-action-btn {
  flex: 1;
  min-height: 48px;
  padding: 12px 10px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, opacity 0.2s ease;
}

.dm-delete-action-btn + .dm-delete-action-btn {
  border-left: 1px solid var(--border-color);
}

.dm-delete-action-btn:hover {
  background: var(--input-bg);
}

.dm-delete-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dm-delete-action-danger {
  color: var(--like-color);
  font-weight: 700;
}

.activity-top-bar {
  position: sticky;
  top: 0;
  z-index: 20;
}

.activity-select-toggle {
  min-width: 44px;
  min-height: 44px;
  padding: 0 8px;
  border: none;
  background: transparent;
  color: var(--accent-color, #0095f6);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: opacity 0.2s ease;
}

.activity-select-toggle:hover {
  opacity: 0.75;
}

.activity-select-toggle[hidden],
.activity-view[hidden],
.activity-bulk-bar[hidden],
.activity-load-more-wrap[hidden],
#activityTopSpacer[hidden] {
  display: none !important;
}

.activity-container {
  padding-bottom: calc(88px + env(safe-area-inset-bottom, 0px));
}

.activity-view {
  animation: pageFadeIn 0.2s ease;
}

.activity-hub-subtitle {
  font-size: 13px;
  line-height: 1.45;
  color: var(--text-secondary);
  padding: 4px 4px 12px;
  margin: 0;
}

.activity-row-right {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.activity-count-badge {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.activity-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  padding: 4px 0 12px;
}

.activity-pills {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.activity-pill {
  min-height: 36px;
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.activity-pill.is-active {
  background: var(--text-primary);
  color: var(--bg-primary);
  border-color: var(--text-primary);
}

.activity-sort-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  margin-left: auto;
  transition: opacity 0.2s ease;
}

.activity-sort-btn:hover {
  opacity: 0.8;
}

.activity-photo-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 3px;
  border-radius: 10px;
  overflow: hidden;
}

.activity-grid-tile {
  position: relative;
  aspect-ratio: 1 / 1;
  display: block;
  width: 100%;
  padding: 0;
  border: none;
  background: var(--input-bg);
  overflow: hidden;
  cursor: pointer;
  text-decoration: none;
}

.activity-grid-tile img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.activity-grid-tile.is-selected img {
  opacity: 0.72;
}

.activity-grid-tile .activity-select-check {
  position: absolute;
  top: 8px;
  right: 8px;
}

.activity-grid-stats {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 6px 8px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(0, 0, 0, 0.55);
  color: #FFFFFF;
  font-size: 12px;
  font-weight: 600;
}

.activity-grid-stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.activity-items-list {
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  overflow: hidden;
}

.activity-item-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
  text-decoration: none;
  transition: background 0.2s ease;
}

.activity-item-row:last-child {
  border-bottom: none;
}

.activity-item-row.activity-item-link:hover,
.activity-item-row.is-selectable:hover {
  background: var(--input-bg);
}

.activity-item-row.is-selectable {
  cursor: pointer;
}

.activity-item-row.is-selected {
  background: var(--input-bg);
}

.activity-select-check {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--text-secondary);
  background: rgba(0, 0, 0, 0.25);
  flex-shrink: 0;
  position: relative;
  margin-top: 8px;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.activity-grid-tile .activity-select-check {
  border-color: #FFFFFF;
  margin-top: 0;
}

.is-selected > .activity-select-check {
  background: var(--accent-color, #0095f6);
  border-color: var(--accent-color, #0095f6);
}

.is-selected > .activity-select-check::after {
  content: '';
  position: absolute;
  left: 6px;
  top: 2px;
  width: 5px;
  height: 10px;
  border: solid #FFFFFF;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.activity-item-avatar-link {
  flex-shrink: 0;
  text-decoration: none;
}

.activity-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--input-bg);
  color: var(--text-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 700;
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.activity-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.activity-history-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--input-bg);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.activity-item-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.activity-item-context {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.activity-reply-icon {
  display: inline-flex;
  align-items: center;
  color: var(--accent-color, #0095f6);
}

.activity-parent-quote {
  font-size: 12px;
  color: var(--text-secondary);
  padding: 4px 8px;
  border-left: 2px solid var(--border-color);
  background: var(--input-bg);
  border-radius: 0 6px 6px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-item-text {
  font-size: 14px;
  line-height: 1.4;
  color: var(--text-primary);
  word-break: break-word;
  white-space: pre-wrap;
}

.activity-item-username {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.activity-item-sub {
  font-size: 13px;
  color: var(--text-secondary);
  word-break: break-word;
}

.activity-item-time {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.activity-item-thumb {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  display: block;
}

.activity-item-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.activity-empty {
  text-align: center;
  padding: 48px 20px;
  color: var(--text-secondary);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.activity-empty-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 1.5px solid var(--border-color);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}

.activity-empty-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.activity-empty-desc {
  font-size: 13px;
  max-width: 300px;
  line-height: 1.45;
}

.activity-loading {
  text-align: center;
  padding: 36px 16px;
  color: var(--text-secondary);
  font-size: 14px;
}

.activity-load-more-wrap {
  display: flex;
  justify-content: center;
  padding: 16px 0 8px;
}

.activity-bulk-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(56px + env(safe-area-inset-bottom, 0px));
  z-index: 30;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  padding: 10px 16px;
  display: flex;
  justify-content: center;
}

.activity-bulk-action-btn {
  width: 100%;
  max-width: 600px;
  min-height: 44px;
  border: none;
  border-radius: 10px;
  background: var(--like-color);
  color: #FFFFFF;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.activity-bulk-action-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

@media (min-width: 768px) {
  .activity-bulk-bar {
    bottom: 0;
    padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px));
  }
}

.pg-no-transition,
.pg-no-transition * {
  transition: none !important;
  animation: none !important;
}

.feed-share-btn,
.post-share-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  background: transparent;
  border: none;
  padding: 4px;
  color: var(--text-primary);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: opacity 0.2s ease;
}

.feed-share-count,
.post-share-count {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.feed-share-count:empty,
.post-share-count:empty {
  display: none;
}

.feed-share-btn:hover,
.post-share-btn:hover {
  opacity: 0.7;
}

.pics-share-btn svg {
  width: 26px;
  height: 26px;
}

.share-sheet-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 22500;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.2s ease, visibility 0.2s ease;
}

.share-sheet-backdrop.visible {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

.share-sheet-panel {
  width: 100%;
  max-width: 480px;
  height: 68dvh;
  max-height: 78dvh;
  background: var(--bg-secondary);
  border-radius: 18px 18px 0 0;
  border: 1px solid var(--border-color);
  border-bottom: none;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  transform: translate3d(0, 100%, 0);
  transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
  will-change: transform;
}

.share-sheet-backdrop.visible .share-sheet-panel {
  transform: translate3d(0, 0, 0);
}

@media (min-width: 768px) {
  .share-sheet-backdrop {
    align-items: center;
    padding: 16px;
  }

  .share-sheet-panel {
    border-radius: 16px;
    border-bottom: 1px solid var(--border-color);
    height: 520px;
    max-height: 78dvh;
    transform: translate3d(0, 24px, 0);
    transition: transform 0.24s cubic-bezier(0.32, 0.72, 0, 1);
  }

  .share-sheet-backdrop.visible .share-sheet-panel {
    transform: translate3d(0, 0, 0);
  }
}

.share-sheet-drag-zone {
  flex-shrink: 0;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  cursor: grab;
}

.share-sheet-drag-zone:active {
  cursor: grabbing;
}

.share-sheet-handle {
  width: 36px;
  height: 4px;
  border-radius: 999px;
  background: var(--border-color);
  margin: 10px auto 4px;
  flex-shrink: 0;
  pointer-events: none;
}

.share-sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.share-sheet-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.share-sheet-thumb {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  object-fit: cover;
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  flex-shrink: 0;
}

.share-sheet-head-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.share-sheet-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.share-sheet-author {
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.share-sheet-close {
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 50%;
  flex-shrink: 0;
}

.share-sheet-search-wrap {
  padding: 10px 14px 8px;
  flex-shrink: 0;
}

.share-sheet-search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  height: 38px;
  border-radius: 10px;
  background: var(--input-bg);
  border: 1px solid var(--border-color);
}

.share-sheet-search-icon {
  display: inline-flex;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.share-sheet-search-input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  font-size: 14px;
}

.share-sheet-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
  padding: 4px 0;
}

.share-contact-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.share-contact-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  overflow: hidden;
  flex-shrink: 0;
}

.share-contact-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.share-contact-meta {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.share-contact-username {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.share-contact-display {
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.share-send-btn {
  width: auto;
  height: 34px;
  min-width: 78px;
  max-width: 132px;
  min-height: 34px;
  padding: 0 14px;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
}

.share-sheet-empty {
  padding: 36px 20px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.share-sheet-empty-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.share-sheet-empty-desc {
  font-size: 13px;
  max-width: 280px;
  line-height: 1.4;
}

.share-sheet-empty-btn {
  width: auto;
  padding: 0 18px;
  margin-top: 6px;
  text-decoration: none;
}

.share-sheet-note-wrap {
  padding: 10px 14px;
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}

.share-sheet-note-input {
  width: 100%;
  min-height: 38px;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: var(--input-bg);
  color: var(--text-primary);
  font: inherit;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
}

.dm-msg-bubble.shared-post-bubble {
  padding: 0;
  overflow: hidden;
  width: min(252px, 68vw);
  max-width: 260px;
  border-radius: 18px;
}

.dm-msg-bubble.shared-post-bubble .dm-reply-quote {
  margin: 8px 10px 4px;
}

.dm-msg-bubble.shared-post-bubble .dm-msg-time {
  padding: 5px 10px 7px;
}

.dm-shared-post {
  display: flex;
  flex-direction: column;
  text-decoration: none;
  color: inherit;
  background: transparent;
}

.dm-shared-post-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 11px;
}

.dm-shared-post-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.14);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.dm-shared-post-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.dm-shared-post-author {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 13px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.dm-shared-post-media {
  width: 100%;
  aspect-ratio: 1 / 1;
  background: rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.dm-shared-post-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.dm-shared-post-caption {
  padding: 8px 11px 2px;
  font-size: 13px;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.dm-shared-post-note {
  padding: 6px 11px 2px;
  border-top: 1px solid rgba(128, 128, 128, 0.22);
  margin-top: 4px;
}

.dm-msg-link {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
  word-break: break-all;
}

.dm-msg-row.theirs .dm-msg-link {
  color: #2196F3;
}

.dm-timecode-btn {
  display: inline;
  padding: 0 4px;
  margin: 0;
  border: none;
  border-radius: 4px;
  background: rgba(33, 150, 243, 0.16);
  color: #2196F3;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
  font-variant-numeric: tabular-nums;
}

.dm-msg-row.mine .dm-timecode-btn {
  background: rgba(255, 255, 255, 0.22);
  color: #FFFFFF;
}

.dm-link-preview {
  display: flex;
  align-items: stretch;
  gap: 8px;
  margin-top: 6px;
  padding: 6px 8px 6px 0;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.06);
  max-width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.dm-msg-row.mine .dm-link-preview {
  background: rgba(0, 0, 0, 0.16);
}

.dm-lp-bar {
  width: 3px;
  border-radius: 3px;
  background: #2196F3;
  flex-shrink: 0;
}

.dm-msg-row.mine .dm-lp-bar {
  background: rgba(255, 255, 255, 0.85);
}

.dm-link-preview.is-youtube .dm-lp-bar {
  background: #FF0033;
}

.dm-msg-row.mine .dm-link-preview.is-youtube .dm-lp-bar {
  background: rgba(255, 255, 255, 0.9);
}

.dm-lp-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dm-lp-site {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.01em;
  color: #2196F3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dm-link-preview.is-youtube .dm-lp-site {
  color: #FF3355;
}

.dm-msg-row.mine .dm-lp-site {
  color: rgba(255, 255, 255, 0.92);
}

.dm-lp-title {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.3;
  color: inherit;
  text-decoration: none;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.dm-lp-desc {
  font-size: 12px;
  line-height: 1.35;
  opacity: 0.82;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.dm-lp-media-wrap {
  margin-top: 6px;
  border-radius: 8px;
  overflow: hidden;
  background: #000000;
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
}

.dm-lp-video-trigger,
.dm-lp-img-link {
  display: block;
  width: 100%;
  height: 100%;
  padding: 0;
  border: none;
  background: #000000;
  cursor: pointer;
  position: relative;
}

.dm-lp-media-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.dm-lp-play-btn {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.68);
  color: #FFFFFF;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.dm-lp-play-btn svg {
  margin-left: 3px;
}

.dm-video-backdrop {
  z-index: 23500;
  padding: 12px;
}

.dm-video-dialog {
  width: 100%;
  max-width: 760px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.dm-video-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color);
}

.dm-video-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.dm-video-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dm-video-time-pill {
  flex-shrink: 0;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(33, 150, 243, 0.16);
  color: #2196F3;
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.dm-video-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.dm-video-ext-btn {
  font-size: 12px;
  font-weight: 600;
  color: #2196F3;
  text-decoration: none;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--input-bg);
  white-space: nowrap;
}

.dm-video-close-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.dm-video-frame-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000000;
}

.dm-video-iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
}

@media (max-width: 480px) {
  .dm-video-ext-btn {
    display: none;
  }
}

`;
}


